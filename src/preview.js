import {emptyState,makeTask,makeGoal,updateSettings,proposePlan,searchMemory,deleteHistory,suggestTasks,taskOrder,localDate} from '../shared/core.mjs';
import {activityAnswer} from '../shared/activity-answer.mjs';

function exampleDay() {
  const state=emptyState();const today=localDate();const at=(h,m)=>new Date(`${today}T${h}:${m}:00`).toISOString();
  state.settings.onboarded=true;
  state.goals=[{id:'g-code',title:'Become a confident developer',why:'Build things that are useful to people.',target:'Ship my first full-stack project',color:'sage',due:'',createdAt:at('08','00')},{id:'g-exam',title:'Feel ready for the exam',why:'Understand the concepts, not just the answers.',target:'Finish two practice papers',color:'peach',due:today,createdAt:at('08','00')}];
  state.tasks=[makeTask({title:'Practice data structures & algorithms',commitment:'have_to',minutes:45,goalId:'g-code',due:today}),makeTask({title:'Review chapter 4 — practice questions',commitment:'have_to',minutes:30,goalId:'g-exam',due:today}),makeTask({title:'Build the authentication flow',commitment:'want_to',minutes:60,goalId:'g-code'}),makeTask({title:'Read 10 pages before bed',commitment:'want_to',minutes:15})];
  const complete=makeTask({title:'Finish the morning practice set',minutes:30,goalId:'g-exam'});complete.status='done';complete.completedAt=at('09','00');state.tasks.push(complete);
  state.sessions=[{id:'s1',app:'Code',title:'Personal project · auth.ts',start:at('09','00'),end:at('10','12'),category:'coding',intent:'goal-aligned',inputIdle:false},{id:'s2',app:'Chrome',title:'Understanding binary search — YouTube',start:at('10','12'),end:at('10','38'),category:'studying',intent:'goal-aligned',inputIdle:false},{id:'s3',app:'Spotify',title:'A little space to reset',start:at('10','38'),end:at('10','50'),category:'other',intent:'planned leisure',inputIdle:false},{id:'s4',app:'Code',title:'Practice · binary-search.ts',start:at('10','50'),end:at('11','34'),category:'coding',intent:'goal-aligned',inputIdle:false},{id:'s5',app:'Chrome',title:'Reading project documentation',start:at('11','34'),end:at('11','51'),category:'unknown',intent:'unknown',inputIdle:true}];
  state.memories=[{id:'m1',kind:'note',label:'Personal note',text:'I need to review the practice questions before the exam. Focus on chapter 4 and explain each solution out loud.',createdAt:at('10','35')},{id:'m2',kind:'screen',label:'Chrome',text:'Binary search divides a sorted search space in half on each step. Keep the loop invariant explicit and check the boundary conditions.',createdAt:at('10','24')}];
  return state;
}
export function createPreview() {
  let state;try{state=JSON.parse(localStorage.getItem('argus-preview-v1'))||exampleDay();}catch{state=exampleDay();}
  const listeners=new Set();const snapshot=()=>structuredClone({...state,runtime:{activity:'preview',screen:'off',microphone:'off',playback:'off',storage:'preview only',platform:'browser',captureAllowed:false}});
  function save(){localStorage.setItem('argus-preview-v1',JSON.stringify(state));for(const listener of listeners)listener(snapshot());}
  return {platform:'preview',subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},async invoke(action,p={}){
    if(action==='chat'){const answer=activityAnswer(state,p.question);if(answer)return {...answer,text:`${answer.text}\n\nPreview · sample activity.`};}
    let result=true;
    switch(action){
      case 'snapshot':return snapshot();
      case 'task:add':result=makeTask(p);state.tasks.push(result);break;
      case 'task:update':{const t=state.tasks.find(t=>t.id===p.id);if(t){Object.assign(t,p);if(p.status)t.completedAt=p.status==='done'?new Date().toISOString():null;}break;}
      case 'task:delete':state.tasks=state.tasks.filter(t=>t.id!==p.id);state.blocks=state.blocks.filter(b=>b.taskId!==p.id);break;
      case 'goal:add':result=makeGoal(p);state.goals.push(result);break;
      case 'goal:delete':state.goals=state.goals.filter(g=>g.id!==p.id);state.tasks=state.tasks.map(t=>t.goalId===p.id?{...t,goalId:''}:t);break;
      case 'settings:update':if(['activityEnabled','screenEnabled','micEnabled','playbackEnabled'].some(k=>p[k]))throw new Error('Capture is available in the Windows desktop app. This preview uses sample data.');state.settings=updateSettings(state.settings,p);break;
      case 'plan:propose':return proposePlan(state);
      case 'plan:accept':state.blocks.push(...p.blocks);break;
      case 'block:delete':state.blocks=state.blocks.filter(b=>b.id!==p.id);break;
      case 'focus:start':{const t=state.tasks.find(t=>t.id===p.taskId);state.focus={taskId:t.id,title:t.title,start:new Date().toISOString(),end:new Date(Date.now()+Math.min(t.minutes,90)*60000).toISOString()};break;}
      case 'focus:stop':state.focus=null;break;
      case 'session:update':Object.assign(state.sessions.find(s=>s.id===p.id),p);break;
      case 'memory:add':result={id:crypto.randomUUID(),text:p.text,kind:'note',createdAt:new Date().toISOString(),label:'Personal note'};state.memories.push(result);suggestTasks(state,result);break;
      case 'memory:delete':state.memories=state.memories.filter(m=>m.id!==p.id);state.tasks=state.tasks.filter(t=>!(t.status==='inbox'&&t.sourceId===p.id)).map(t=>t.sourceId===p.id?{...t,sourceId:''}:t);break;
      case 'memory:search':return searchMemory(state,p.query);
      case 'history:delete':deleteHistory(state,p.range==='recent'?new Date(Date.now()-900000):null);break;
      case 'chat':{const sources=searchMemory(state,p.question);const priorities=taskOrder(state.tasks).slice(0,3);return {text:/next|plan|should/i.test(p.question)?`A little direction for your day:\n\n${priorities.map((t,i)=>`${i+1}. ${t.title} — ${t.minutes} min`).join('\n')}\n\nStart with the nearest deadline, then make space for your longer-term goal.\n\nPreview · rule-based suggestion using sample tasks.`:sources.length?`Here is what matches in this sample day:\n\n${sources.map((s,i)=>`[${i+1}] ${s.text}`).join('\n\n')}\n\nPreview · local keyword search.`:'No matching memories in this sample day. Try “binary search” or add a note.',sources};}
      case 'data:export':{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='argus-preview.json';a.click();URL.revokeObjectURL(a.href);return true;}
      default:throw new Error('This feature requires the desktop app.');
    }save();return result;
  }};
}
