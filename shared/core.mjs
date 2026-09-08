const randomUUID = () => globalThis.crypto.randomUUID();

export const DEFAULT_SETTINGS = Object.freeze({
  activityEnabled: false, titlesEnabled: false, screenEnabled: false,
  micEnabled: false, playbackEnabled: false, paused: false,
  exclusions: ['1password', 'bitwarden', 'keepass', 'lastpass'],
  retentionDays: 30, idleSeconds: 180, screenIntervalSeconds: 60,
  aiMode: 'offline', aiEndpoint: 'http://127.0.0.1:11434', aiModel: 'llama3.2',
  transcriptionEndpoint: 'http://127.0.0.1:8080/inference',
  dayEnd: '18:00', availableMinutes: 120, onboarded: false,
});

export function emptyState() { return { tasks: [], goals: [], sessions: [], memories: [], blocks: [], settings: { ...DEFAULT_SETTINGS }, focus: null }; }
const bounded = (v, min, max, fallback) => Number.isFinite(Number(v)) ? Math.max(min, Math.min(max, Number(v))) : fallback;
export function textValue(value, max = 2000) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
export function localDate(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
export function validateDate(value) {
  if (!value) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(new Date(`${value}T12:00:00`).getTime()) || localDate(new Date(`${value}T12:00:00`)) !== value) throw new Error('Choose a valid deadline.');
  return value;
}
export function makeTask(input, now = new Date()) {
  const title = textValue(input.title, 240); if (!title) throw new Error('Give your task a name.');
  return { id: randomUUID(), title, details: textValue(input.details), commitment: input.commitment === 'want_to' ? 'want_to' : 'have_to',
    status: input.status === 'inbox' ? 'inbox' : 'todo', due: validateDate(input.due), minutes: bounded(input.minutes, 5, 480, 30),
    priority: bounded(input.priority, 1, 3, 2), goalId: textValue(input.goalId, 100), sourceId: textValue(input.sourceId, 100),
    createdAt: now.toISOString(), completedAt: null };
}
export function makeGoal(input, now = new Date()) {
  const title = textValue(input.title, 140); if (!title) throw new Error('Give your goal a name.');
  return { id: randomUUID(), title, why: textValue(input.why, 500), target: textValue(input.target, 300), due: validateDate(input.due), color: ['sage','peach','lavender'].includes(input.color) ? input.color : 'sage', createdAt: now.toISOString() };
}
export function taskOrder(tasks, today = localDate()) {
  return tasks.filter(t => t.status === 'todo').sort((a,b) => {
    const urgency = t => t.due && t.due <= today ? 0 : t.due ? 1 : 2;
    return urgency(a)-urgency(b) || (a.due || '9999').localeCompare(b.due || '9999') || a.priority-b.priority || (a.commitment === 'have_to' ? 0 : 1)-(b.commitment === 'have_to' ? 0 : 1) || a.createdAt.localeCompare(b.createdAt);
  });
}
export function proposePlan(state, now = new Date(), budget = state.settings.availableMinutes) {
  const end = new Date(now); const [h,m] = state.settings.dayEnd.split(':').map(Number); end.setHours(h,m,0,0);
  let cursor = new Date(Math.ceil(now.getTime()/300000)*300000); let remaining = bounded(budget,15,720,120); const blocks=[]; const unscheduled=[];
  const existing = state.blocks.filter(b=> new Date(b.end)>now).sort((a,b)=>a.start.localeCompare(b.start));
  for (const task of taskOrder(state.tasks)) {
    if (existing.some(b=>b.taskId===task.id)) continue;
    let duration = task.minutes; let moved = true;
    while(moved) { moved=false; for(const block of existing) { if(cursor < new Date(block.end) && new Date(cursor.getTime()+duration*60000)>new Date(block.start)) { cursor=new Date(block.end); moved=true; } } }
    if(duration>remaining || cursor.getTime()+duration*60000>end.getTime()) { unscheduled.push(task.id); continue; }
    blocks.push({id:randomUUID(),taskId:task.id,title:task.title,start:cursor.toISOString(),end:new Date(cursor.getTime()+duration*60000).toISOString(),reason:task.due ? `Deadline ${task.due}` : task.commitment==='have_to' ? 'A commitment you want to keep' : 'Space for something you want'});
    remaining-=duration; cursor=new Date(cursor.getTime()+(duration+5)*60000);
  }
  return { blocks, unscheduled, message: blocks.length ? `${blocks.length} focus blocks, with 5-minute breaks where space allows.${unscheduled.length ? ` ${unscheduled.length} tasks do not fit; adjust your available time or task estimates.` : ''}` : 'No new tasks fit before your day ends. Adjust your day-end time or review existing blocks.' };
}
export function classify(app, title = '') {
  const name = `${app} ${title}`.toLowerCase();
  if (/code|devenv|jetbrains|pycharm|webstorm|terminal|powershell/.test(name)) return 'coding';
  if (/teams|slack|discord|outlook|zoom/.test(name)) return 'communication';
  if (/steam|minecraft|valorant|roblox|game/.test(name)) return 'entertainment';
  return 'unknown';
}
export function isExcluded(app, title, exclusions) { const value=`${app} ${title}`.toLowerCase(); return exclusions.some(x=> x.trim() && value.includes(x.trim().toLowerCase())); }
export function observeActivity(state, sample, now = new Date()) {
  const stamp=now.toISOString(); const previous=state.sessions.at(-1);
  if(!state.settings.activityEnabled || state.settings.paused || sample.locked || isExcluded(sample.app || '',sample.title || '',state.settings.exclusions)) { closeActivity(state); return null; }
  const app=textValue(sample.app,150); if(!app) { closeActivity(state); return null; }
  const title=state.settings.titlesEnabled ? textValue(sample.title,500) : '';
  const inputIdle=sample.idleSeconds>=state.settings.idleSeconds;
  // Never stretch a session across suspend, collector downtime, or midnight.
  if(previous && !previous.closed && previous.app===app && previous.title===title && previous.inputIdle===inputIdle && now-new Date(previous.end)<=12000 && localDate(new Date(previous.start))===localDate(now)) { previous.end=stamp; return previous; }
  const session={id:randomUUID(),app,title,start:stamp,end:stamp,inputIdle,category:classify(app,title),intent:'unknown'}; state.sessions.push(session); return session;
}
export function closeActivity(state) { const previous=state.sessions.at(-1);if(previous)previous.closed=true; }
export function acceptPlan(state,blocks) {
  if(!Array.isArray(blocks)||blocks.length>100)throw new Error('Invalid plan.');
  const proposed=[];
  for(const block of blocks) {
    if(!state.tasks.some(t=>t.id===block.taskId&&t.status==='todo'))continue;
    const start=new Date(block.start),end=new Date(block.end);
    if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start||end-start>480*60000)throw new Error('Invalid focus block.');
    if([...state.blocks,...proposed].some(b=>new Date(b.start)<end&&new Date(b.end)>start))throw new Error('This plan overlaps an existing block. Generate a fresh plan.');
    proposed.push({id:randomUUID(),taskId:block.taskId,title:textValue(block.title,240),start:start.toISOString(),end:end.toISOString(),reason:textValue(block.reason,300)});
  }
  state.blocks.push(...proposed);return proposed;
}
export function durationMinutes(session, date = null) {
  let start=new Date(session.start).getTime(), end=new Date(session.end).getTime();
  if(date) { const floor=new Date(`${date}T00:00:00`).getTime(); const ceiling=new Date(`${date}T00:00:00`); ceiling.setDate(ceiling.getDate()+1); start=Math.max(start,floor); end=Math.min(end,ceiling.getTime()); }
  return Math.max(0,(end-start)/60000);
}
export function pruneHistory(state, cutoff) {
  const ms=new Date(cutoff).getTime();
  state.sessions=state.sessions.filter(s=>new Date(s.end).getTime()>=ms).map(s=>new Date(s.start).getTime()<ms ? {...s,start:new Date(ms).toISOString()} : s);
  const removed=new Set(state.memories.filter(m=>new Date(m.createdAt).getTime()<ms).map(m=>m.id));
  state.memories=state.memories.filter(m=>!removed.has(m.id));
  state.tasks=state.tasks.filter(t=>!(t.status==='inbox' && removed.has(t.sourceId))).map(t=>removed.has(t.sourceId)?{...t,sourceId:''}:t);
}
export function deleteHistory(state, since = null) {
  const cutoff=since ? new Date(since).getTime() : -Infinity;
  state.sessions=state.sessions.filter(s=>new Date(s.start).getTime()<cutoff).map(s=>new Date(s.end).getTime()>cutoff?{...s,end:new Date(cutoff).toISOString()}:s);
  const removed=new Set(state.memories.filter(m=>new Date(m.createdAt).getTime()>=cutoff).map(m=>m.id));
  state.memories=state.memories.filter(m=>!removed.has(m.id));
  state.tasks=state.tasks.filter(t=>!(t.status==='inbox' && removed.has(t.sourceId))).map(t=>removed.has(t.sourceId)?{...t,sourceId:''}:t);
}
export function searchMemory(state, query, limit = 8) {
  const words=textValue(query,500).toLowerCase().split(/\W+/).filter(w=>w.length>2 && !['what','when','where','that','this','with','have','from','about','did','the','and','was','for','how'].includes(w));
  const records=[...state.memories.map(m=>({id:m.id,kind:m.kind,text:m.text,at:m.createdAt})),...state.sessions.map(s=>({id:s.id,kind:'activity',text:`${s.app}${s.title?`: ${s.title}`:''} · ${s.category} · ${Math.round(durationMinutes(s))} min`,at:s.start}))];
  return records.map(r=>({...r,score:words.reduce((sum,w)=>sum+(r.text.toLowerCase().includes(w)?1:0),0)})).filter(r=>!words.length || r.score>0).sort((a,b)=>b.score-a.score || b.at.localeCompare(a.at)).slice(0,limit);
}
export function suggestTasks(state, memory) {
  const matches=memory.text.split(/(?<=[.!?])\s+|\n/).filter(s=>/\b(i (?:have|need|want) to|remind me to|i must)\b/i.test(s));
  const normalize=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
  for(const sentence of matches.slice(0,8)) {
    const title=sentence.replace(/^.*?\b(?:i (?:have|need|want) to|remind me to|i must)\s+/i,'').replace(/[.!?]$/,'').trim().slice(0,240);
    if(title && !state.tasks.some(t=>normalize(t.title)===normalize(title))) state.tasks.push(makeTask({title,details:'Detected in captured context. Review the speaker, intent, and deadline before accepting.',commitment:/i want to/i.test(sentence)?'want_to':'have_to',status:'inbox',sourceId:memory.id},new Date(memory.createdAt)));
  }
}
export function validateEndpoint(value, localOnly = false) {
  let url; try { url=new URL(value); } catch { throw new Error('Enter a valid provider URL.'); }
  const local=['127.0.0.1','localhost','[::1]'].includes(url.hostname);
  if(url.username || url.password || url.hash || url.search || (!local && (localOnly || url.protocol!=='https:')) || !['http:','https:'].includes(url.protocol)) throw new Error(localOnly?'Use a local transcription server URL.':'Remote AI endpoints must use HTTPS.');
  return url.toString().replace(/\/$/,'');
}
export function updateSettings(current, input) {
  const next={...current};
  for(const key of ['activityEnabled','titlesEnabled','screenEnabled','micEnabled','playbackEnabled','paused','onboarded']) if(key in input) { if(typeof input[key]!=='boolean') throw new Error('Invalid setting.'); next[key]=input[key]; }
  if(input.exclusions!==undefined) { if(!Array.isArray(input.exclusions)) throw new Error('Invalid exclusions.'); next.exclusions=input.exclusions.map(s=>textValue(s,100)).filter(Boolean).slice(0,100); }
  if(input.retentionDays!==undefined) next.retentionDays=bounded(input.retentionDays,1,365,30);
  if(input.availableMinutes!==undefined) next.availableMinutes=bounded(input.availableMinutes,15,720,120);
  if(input.dayEnd!==undefined) { if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.dayEnd)) throw new Error('Choose a valid day-end time.'); next.dayEnd=input.dayEnd; }
  if(input.aiMode!==undefined) { if(!['offline','ollama','cloud'].includes(input.aiMode)) throw new Error('Invalid AI mode.'); next.aiMode=input.aiMode; }
  if(input.aiEndpoint!==undefined) next.aiEndpoint=validateEndpoint(input.aiEndpoint);
  if(input.transcriptionEndpoint!==undefined) next.transcriptionEndpoint=validateEndpoint(input.transcriptionEndpoint,true);
  if(input.aiModel!==undefined) next.aiModel=textValue(input.aiModel,120);
  if(next.aiMode==='ollama') validateEndpoint(next.aiEndpoint,true);
  return next;
}
