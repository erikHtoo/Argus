import {activityContext} from './activity.mjs';
import {isExcluded} from './core.mjs';

const tracking=new WeakMap();
const iso=n=>new Date(n).toISOString();
function context(app,title){
 const c=activityContext(app,title);
 if(/^valorant/i.test(app))c.label='Valorant';
 if(/^code(?:\.exe)?$/i.test(app))c.label='VS Code';
 return c;
}
export function closeSessionTotals(state){tracking.delete(state);}
// Accumulate app totals into minute buckets, never a chronological tab-switch log.
// Minute precision makes hourly boundaries, retention, and recent deletion accurate.
export function observeSessionTotals(state,sample,now=new Date()){
 const time=+now,s=state.settings;let c=context(sample.app||'',s.titlesEnabled?sample.title||'':'');
 const passive=['Video','Stream'].includes(c.detail);
 if(!s.activityEnabled||s.paused||!sample.app||sample.locked||isExcluded(sample.app,sample.title||'',s.exclusions)){closeSessionTotals(state);return;}
 if(!passive&&sample.idleSeconds>=s.idleSeconds)c={label:'Idle',detail:'Idle',category:'idle'};
 const previous=tracking.get(state);
 if(previous&&time>previous.time&&time-previous.time<=12000){
  let from=previous.time;
  while(from<time){
   const start=Math.floor(from/60000)*60000,end=Math.min(time,start+60000),label=previous.c.label;
   const id=`minute:${start}:${label.toLowerCase()}`;
   let row=state.sessions.find(r=>r.id===id);
   if(!row){row={id,minute:true,app:previous.app,label,detail:previous.c.detail,category:previous.c.category,start:iso(start),end:iso(start+60000),activeSeconds:0,title:''};state.sessions.push(row);}
   row.activeSeconds+=(end-from)/1000;
   if(previous.title&&previous.c.detail==='Video'){
    row.titles??=[];let title=row.titles.find(t=>t.text===previous.title);
    if(!title&&row.titles.length<20){title={text:previous.title,seconds:0};row.titles.push(title);}
    if(title)title.seconds+=(end-from)/1000;
   }
   from=end;
  }
 }
 tracking.set(state,{time,c,app:sample.app,title:s.titlesEnabled?String(sample.title||'').slice(0,500):''});
}

// Variable-length sessions: an ongoing activity absorbs detours, while fifteen
// minutes consistently away starts a new session at the beginning of that change.
export function daySessions(rows,date,now=new Date()){
 const floor=+new Date(`${date}T00:00:00`),endDate=new Date(floor);endDate.setDate(endDate.getDate()+1);
 const ceiling=Math.min(+endDate,+now),cells=new Map();
 for(const row of rows){
  const a=+new Date(row.start),b=+new Date(row.end),from=Math.max(a,floor),to=Math.min(b,ceiling);
  if(to<=from)continue;
  const c=row.inputIdle?{label:'Idle',detail:'Idle',category:'idle'}:{...context(row.app||'',row.title||''),...(row.label?{label:row.label}:{}),...(row.detail?{detail:row.detail}:{}),...(row.category?{category:row.category}:{})};
  for(let t=Math.floor(from/60000)*60000;t<to;t+=60000){
   const overlap=Math.max(0,Math.min(b,t+60000,ceiling)-Math.max(a,t,floor));
   const seconds=row.minute?row.activeSeconds:overlap/1000*Math.min(1,Math.max(0,(row.activeSeconds??((b-a)/1000))/((b-a)/1000)));
   if(seconds<=0)continue;
   let cell=cells.get(t);if(!cell){cell={start:t,end:Math.min(t+60000,to),apps:new Map(),estimated:false};cells.set(t,cell);}
   cell.end=Math.max(cell.end,Math.min(t+60000,to));cell.estimated||=!row.minute;
   const key=c.label.toLowerCase(),item=cell.apps.get(key)||{...c,seconds:0,titles:new Map()};item.seconds+=seconds;
   for(const title of row.titles||[])item.titles.set(title.text,(item.titles.get(title.text)||0)+title.seconds);
   if(!row.minute&&row.title)item.titles.set(row.title,(item.titles.get(row.title)||0)+seconds);
   cell.apps.set(key,item);
  }
 }
 const rank=items=>[...items.values()].sort((a,b)=>b.seconds-a.seconds||a.label.localeCompare(b.label));
 function summarize(group){
  const apps=new Map();for(const cell of group)for(const [key,item] of cell.apps){const app=apps.get(key)||{...item,seconds:0,titles:new Map()};app.seconds+=item.seconds;for(const [title,seconds] of item.titles)app.titles.set(title,(app.titles.get(title)||0)+seconds);apps.set(key,app);}
  const ranked=rank(apps).map(a=>({...a,titles:[...a.titles].filter(([,s])=>s>=300).sort((a,b)=>b[1]-a[1]).map(([text,seconds])=>({text,seconds}))}));
  return {id:String(group[0].start),start:iso(group[0].start),end:iso(group.at(-1).end),apps:ranked,winner:ranked[0],total:ranked.reduce((n,a)=>n+a.seconds,0),estimated:group.some(c=>c.estimated)};
 }
 const result=[];let current=[],pending=[];
 function finish(){if(current.length){const s=summarize(current);if(s.total>=300)result.push(s);}current=[];}
 for(const cell of [...cells.values()].sort((a,b)=>a.start-b.start)){
  if(!current.length){current=[cell];continue;}
  const main=summarize(current).winner.label,leader=rank(cell.apps)[0].label,last=pending.at(-1)||current.at(-1);
  if(cell.start-last.end>=5*60000||(main==='Idle')!==(leader==='Idle')){current.push(...pending);pending=[];finish();current=[cell];continue;}
  if(leader===main){current.push(...pending,cell);pending=[];}
  else {
   // A browser detour before YouTube begins belongs to the previous session;
   // it must not move the new YouTube boundary backwards into that detour.
   if(pending.length&&leader!==summarize(pending).winner.label){current.push(...pending);pending=[];}
   pending.push(cell);if(cell.end-pending[0].start>=15*60000){finish();current=pending;pending=[];}
  }
 }
 // A short unfinished detour belongs to the current session until it establishes a change.
 current.push(...pending);finish();return result;
}
