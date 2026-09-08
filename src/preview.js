import {localDate} from '../shared/core.mjs';
export function createPreview(){
 const day=localDate(),at=(h)=>new Date(`${day}T${h}:00:00`).toISOString();
 const state={sessions:[{id:'game',journal:true,app:'Valorant',label:'Valorant',detail:'Game',start:at('17'),end:at('19'),purpose:'fun'},{id:'video',journal:true,app:'Chrome',label:'YouTube',detail:'Video',title:'A quiet evening in Japan — YouTube',start:at('19'),end:at('20'),purpose:'fun'}],settings:{activityEnabled:false,paused:false,titlesEnabled:true,retentionDays:30,exclusions:['1password','bitwarden']},runtime:{health:{label:'Sample day'},storage:'preview'}};
 const listeners=new Set(),snapshot=()=>structuredClone(state);
 return {platform:'preview',subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},async invoke(action,p={}){
 if(action==='snapshot')return snapshot();
 if(action==='settings:update'){if(p.activityEnabled)throw new Error('Open the desktop app to track activity.');Object.assign(state.settings,p);}
 else if(action==='session:update')Object.assign(state.sessions.find(s=>s.id===p.id),{purpose:p.purpose});
 else if(action==='history:delete')state.sessions=[];
 else if(action==='data:export'){const url=URL.createObjectURL(new Blob([JSON.stringify(state.sessions,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='argus-sample.json';a.click();URL.revokeObjectURL(url);}
 else throw new Error('Unknown command.');
 for(const fn of listeners)fn(snapshot());return true;
 }};
}
