import {activityContext} from './activity.mjs';
import {isExcluded,localDate} from './core.mjs';

export const MIN_ACTIVITY_MS=5*60000;
const DETOUR_MS=2*60000;
const trackers=new WeakMap();
const iso=ms=>new Date(ms).toISOString();
function context(sample,settings){
  const title=settings.titlesEnabled?String(sample.title||'').slice(0,500):'';
  const c=activityContext(sample.app,title);
  if(/^valorant/i.test(sample.app))c.label='Valorant';
  if(/^code(?:\.exe)?$/i.test(sample.app))c.label='VS Code';
  return {...c,app:String(sample.app).slice(0,150),title,key:c.label.toLowerCase()};
}
function candidate(c,time){return {c,start:time,end:time,ms:0,titles:new Map(),record:null};}
function add(block,c,from,to){
  block.ms+=to-from;block.end=to;
  if(c.title){block.titles.set(c.title,(block.titles.get(c.title)||0)+to-from);if(block.titles.size>100)block.titles.delete(block.titles.keys().next().value);}
}
function publish(state,b){
  if(b.ms<MIN_ACTIVITY_MS)return;
  if(!b.record){b.record={id:crypto.randomUUID(),journal:true,app:b.c.app,label:b.c.label,detail:b.c.detail,category:b.c.category,intent:'unknown',inputIdle:false,start:iso(b.start)};state.sessions.push(b.record);}
  Object.assign(b.record,{end:iso(b.end),activeSeconds:Math.round(b.ms/1000),title:[...b.titles].filter(([,ms])=>ms>=MIN_ACTIVITY_MS).sort((a,b)=>b[1]-a[1])[0]?.[0]||''});
}
export function closeJournal(state){
  const t=trackers.get(state);if(t?.active?.record)t.active.record.closed=true;
  trackers.delete(state);
}
// Only qualified blocks enter persisted state. Transient samples stay in memory.
export function observeJournal(state,sample,now=new Date()){
  const time=+now,s=state.settings,c=context(sample,s);
  const passive=c.detail==='Video'||c.detail==='Stream';
  if(!s.activityEnabled||s.paused||sample.locked||!sample.app||isExcluded(sample.app,sample.title||'',s.exclusions)||(!passive&&sample.idleSeconds>=s.idleSeconds)){closeJournal(state);return;}
  let t=trackers.get(state);
  if(t&&(time-t.time>12000||time<=t.time||localDate(new Date(t.time))!==localDate(now))){closeJournal(state);t=null;}
  if(!t){trackers.set(state,{time,c,active:candidate(c,time),detour:null});return;}
  // Attribute each interval to the last observed foreground app, not the new one.
  const prev=t.c;
  if(prev.key===t.active.c.key){
    if(t.detour){
      const span=time-t.active.start;
      if(t.active.ms/(span||1)<.7){if(t.active.record)t.active.record.closed=true;t.active=candidate(prev,t.time);}
      t.detour=null;
    }
    add(t.active,prev,t.time,time);publish(state,t.active);
  }else{
    if(!t.detour||t.detour.c.key!==prev.key)t.detour=candidate(prev,t.time);
    add(t.detour,prev,t.time,time);
    // Two minutes away closes the old block. A new app still needs five minutes.
    if(time-t.active.end>=DETOUR_MS){
      if(t.active.record)t.active.record.closed=true;
      t.active=t.detour;t.detour=null;publish(state,t.active);
    }
  }
  t.time=time;t.c=c;
}

export function journalEntries(sessions){
  // Preserve legacy records on disk, but keep brief switches out of the journal.
  return sessions.filter(s=>!s.inputIdle&&(s.journal||new Date(s.end)-new Date(s.start)>=MIN_ACTIVITY_MS)).map(s=>({...s,label:s.label||activityContext(s.app,s.title||'').label}));
}
