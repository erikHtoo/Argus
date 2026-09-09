import React,{useEffect,useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Sunrise,Sun,Moon} from 'lucide-react';
import {createPreview} from './preview';
import {localDate} from '../shared/core.mjs';
import {daySessions} from '../shared/sessions.mjs';
import {activityColor,dateRange,hourLabel,ribbonPieces,viewPreferences,restoreViewPreferences} from '../shared/day-view.mjs';
import './styles.css';
import './sessions.css';
import './days.css';
const api=window.argus||createPreview();
const clock=v=>new Date(v).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
const minutes=n=>{const m=Math.round(n/60);return m<1?'<1m':m>=60?`${Math.floor(m/60)}h${m%60?' '+m%60+'m':''}`:`${m}m`;};
function SessionDetail({detail,onClose}){return (<section id={`detail-${detail.id}`} className="hour-detail" aria-label="Session details"><div className="detail-heading"><div><p className="eyebrow">{clock(detail.start)} – {clock(detail.end)}</p><h2>{detail.winner.label==='Idle'?'Idle':detail.winner.label+' session'}</h2></div><button aria-label="Close session details" onClick={onClose}>Close</button></div>
 <p className="muted">{minutes(detail.total)} recorded{detail.estimated?' · Older history, estimated':''}</p><div className="hour-breakdown">{detail.apps.map(a=><div key={a.label}><div className="breakdown-row"><span>{a.label}</span><div className="bar-track"><div style={{width:`${a.seconds/detail.total*100}%`,background:activityColor(a.label)}}/></div><span>{minutes(a.seconds)}</span></div>{a.titles.map(t=><p className="video-title" key={t.text}>{t.text} · {minutes(t.seconds)}</p>)}</div>)}</div>
 </section>);}

function Axis({start,end}){
 const ticks=[start];for(let h=Math.ceil((start+1)/4)*4;h<end;h+=4)ticks.push(h);ticks.push(end);
 const periods=[{hour:3,label:'Night',Icon:Moon},{hour:9,label:'Morning',Icon:Sunrise},{hour:15,label:'Afternoon',Icon:Sun},{hour:21,label:'Night',Icon:Moon}];
 return <div className="ribbon-axis" aria-hidden="true">{periods.filter(p=>p.hour>start&&p.hour<end).map(({hour,label,Icon})=><i className={'day-period '+(label==='Night'?'night':'daylight')} key={hour} style={{left:`${(hour-start)/(end-start)*100}%`}}><Icon size={16} strokeWidth={1.5}/><small>{label}</small></i>)}{ticks.map(h=><span key={h} style={{left:`${(h-start)/(end-start)*100}%`}}>{hourLabel(h)}</span>)}</div>;
}
function Marks({pieces,interactive=false,onSelect,selected}){
 return pieces.map(p=>{const x=p.session,style={left:`${p.left}%`,width:`${p.width}%`,background:activityColor(x.winner.label)},label=`${x.winner.label}, ${clock(x.start)}–${clock(x.end)}, ${minutes((new Date(x.end)-new Date(x.start))/1000)}`;
 return interactive?<button key={x.id} className="ribbon-session" style={style} aria-label={label} aria-pressed={selected===x.id} title={label} onClick={()=>onSelect(x.id)}>{p.width>=4?<span>{x.winner.label}</span>:null}</button>:<span key={x.id} className="ribbon-session" style={style} title={label}>{p.width>=4?<span>{x.winner.label}</span>:null}</span>;
 });
}
function App(){
 const [state,setState]=useState(null),[date,setDate]=useState(localDate()),[followToday,setFollowToday]=useState(true),[activeDay,setActiveDay]=useState(null),[selected,setSelected]=useState(null),[settings,showSettings]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [view,setView]=useState(()=>{try{return restoreViewPreferences(JSON.parse(localStorage.getItem('argus-day-view'))||{});}catch{return viewPreferences();}});
 const [expanded,setExpanded]=useState(false);
 useEffect(()=>{let live=true;api.invoke('snapshot').then(s=>{if(live)setState(s);}).catch(e=>setError(e.message));const off=api.subscribe(s=>{if(live)setState(s);});return()=>{live=false;off();};},[]);
 useEffect(()=>{try{localStorage.setItem('argus-day-view',JSON.stringify({...view,version:2}));}catch{}},[view]);
 useEffect(()=>{if(!followToday)return;const timer=setInterval(()=>setDate(localDate()),30000);return()=>clearInterval(timer);},[followToday]);
 async function run(action,payload){setBusy(true);setError('');try{await api.invoke(action,payload);setState(await api.invoke('snapshot'));}catch(e){setError(e.message);}finally{setBusy(false);}}
 function chooseDate(value){setDate(value);setFollowToday(value===localDate());setActiveDay(null);setSelected(null);}
 function openDay(value){setActiveDay(value);setSelected(null);}
 function step(n){const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+n*view.days);chooseDate(localDate(d));}
 const days=useMemo(()=>dateRange(date,view.days),[date,view.days]);
 const journal=useMemo(()=>Object.fromEntries([...new Set([...days,...(activeDay?[activeDay]:[])])].map(d=>[d,daySessions(state?.sessions||[],d,api.platform==='preview'?new Date(d+'T23:59:59'):new Date())])),[state,days,activeDay]);
 if(!state)return <main><p>{error||'Opening Argus…'}</p></main>;
 const s=state.settings,enabled=s.activityEnabled&&!s.paused,start=expanded?0:view.start,end=expanded?24:view.end;
 const cols=`105px ${start>0?'72px ':''}minmax(0,1fr)${end<24?' 72px':''}`;
 const sessions=activeDay?journal[activeDay]:[],detail=sessions.find(x=>x.id===selected);
 const labels=[...new Set((activeDay?sessions:days.flatMap(d=>journal[d])).map(x=>x.winner.label))];
 const legend=<div className="activity-key" aria-label="Activity colors">{labels.map(label=><span key={label}><i style={{background:activityColor(label)}}/>{label}</span>)}<span className="key-gap">Blank = unrecorded{!activeDay&&(start>0||end<24)?' · Dashed = folded time':''}</span></div>;
 return <main>
 <header><a className="brand" href="#" onClick={e=>{e.preventDefault();showSettings(false);setActiveDay(null);}}>argus</a><div className="header-actions"><span className={'status '+(enabled?'on':'')}>{api.platform==='preview'?'Sample days':state.runtime.health?.label||'Tracking off'}</span><button disabled={busy} onClick={()=>run('settings:update',s.activityEnabled?{paused:!s.paused}:{activityEnabled:true,titlesEnabled:true,paused:false})}>{enabled?'Pause':s.activityEnabled?'Resume':'Start tracking'}</button><button onClick={()=>showSettings(!settings)}>{settings?'Done':'Settings'}</button></div></header>
 {error&&<p role="alert" className="error">{error}</p>}{state.runtime.error&&<p role="alert" className="error">{state.runtime.error}</p>}
 {settings?<section className="settings"><h1>Settings</h1><p className="muted">Stored locally, encrypted on this computer.</p>
 <label className="setting"><span>Window titles<small>Recognize YouTube separately from other browser time.</small></span><input type="checkbox" checked={s.titlesEnabled} disabled={busy} onChange={e=>run('settings:update',{titlesEnabled:e.target.checked})}/></label>
 <label className="setting"><span>Keep history</span><select value={s.retentionDays} disabled={busy} onChange={e=>run('settings:update',{retentionDays:Number(e.target.value)})}>{[7,30,90,365].map(n=><option key={n} value={n}>{n} days</option>)}</select></label>
 <label className="exclusions">Excluded apps or titles<textarea key={s.exclusions.join(',')} defaultValue={s.exclusions.join(', ')} onBlur={e=>{const exclusions=e.target.value.split(',').map(x=>x.trim()).filter(Boolean);if(exclusions.join(',')!==s.exclusions.join(','))run('settings:update',{exclusions});}}/></label>
 <p className="muted">Sessions follow your main activity, regardless of the clock. Detours stay within a session; 15 minutes away starts a new one. Sessions appear after five minutes. Three minutes without input becomes idle, except on video pages. Locked time is left blank. Foreground video time does not confirm playback.</p>
 <div className="data-actions"><button disabled={busy} onClick={()=>run('data:export')}>Export history</button><button disabled={busy} className="danger" onClick={()=>{if(window.confirm('Delete all activity history? This cannot be undone.'))run('history:delete',{range:'all'});}}>Delete history</button></div>
 </section>:<section className="day-browser">
 <div className="day-heading"><div><p className="eyebrow">{activeDay?'Your day':'Your time'}</p><h1>{activeDay?(activeDay===localDate()?'Today':new Date(activeDay+'T12:00:00').toLocaleDateString([],{month:'long',day:'numeric'})):'Days'}</h1></div>{activeDay?<button onClick={()=>{setActiveDay(null);setSelected(null);}}>All days</button>:<div className="date-controls"><button aria-label="Previous period" onClick={()=>step(-1)}>‹</button><input aria-label="Ending date" type="date" value={date} max={localDate()} onChange={e=>{if(e.target.value)chooseDate(e.target.value);}}/><button aria-label="Next period" disabled={date>=localDate()} onClick={()=>{const next=new Date(date+'T12:00:00');next.setDate(next.getDate()+view.days);chooseDate(localDate(next)>localDate()?localDate():localDate(next));}}>›</button></div>}</div>
 {!s.activityEnabled&&api.platform!=='preview'&&<p className="consent">Start tracking to record foreground apps locally. No screenshots or audio.</p>}
 {!activeDay?<><div className="view-filters">
 <label>Show <select aria-label="Number of days" value={view.days} onChange={e=>setView({...view,days:Number(e.target.value)})}>{[1,7,14,30].map(n=><option key={n} value={n}>{n} {n===1?'day':'days'}</option>)}</select></label>
 <label>Visible hours <select aria-label="Visible start hour" value={view.start} onChange={e=>{const v=Number(e.target.value);setView({...view,start:v,end:Math.max(v+1,view.end)});setExpanded(false);}}>{Array.from({length:24},(_,h)=><option key={h} value={h}>{hourLabel(h)}</option>)}</select><span>–</span><select aria-label="Visible end hour" value={view.end} onChange={e=>{setView({...view,end:Number(e.target.value)});setExpanded(false);}}>{Array.from({length:24-view.start},(_,i)=>view.start+i+1).map(h=><option key={h} value={h}>{hourLabel(h)}</option>)}</select></label>
 {(view.start>0||view.end<24)&&<button onClick={()=>setExpanded(!expanded)}>{expanded?'Fold quiet hours':'Show 24 hours'}</button>}
 </div>
 {legend}
 <div className="day-rows" style={{'--day-columns':cols}}>
 <div className="day-ruler"><span/>{start>0&&<span className="fold-label">{hourLabel(0)}–{hourLabel(start)}</span>}<Axis start={start} end={end}/>{end<24&&<span className="fold-label">{hourLabel(end)}–{hourLabel(24)}</span>}</div>
 {days.map(d=>{const items=journal[d],before=ribbonPieces(items,d,0,start),after=ribbonPieces(items,d,end,24);const folded=(parts,which)=><button className={'folded-hours '+(parts.length?'has-activity':'')} aria-label={`Open ${d}, ${which} folded hours: ${parts.length?minutes(parts.reduce((n,p)=>n+p.seconds,0))+' of sessions':'no activity'}`} onClick={()=>openDay(d)}><span>{parts.length?minutes(parts.reduce((n,p)=>n+p.seconds,0)):'—'}</span><small>{parts.length?'recorded':'folded'}</small></button>;
 return <div className="day-row" key={d} data-date={d}><button className="day-name" onClick={()=>openDay(d)} aria-label={`Open day ${d}`}><strong>{d===localDate()?'Today':new Date(d+'T12:00:00').toLocaleDateString([],{weekday:'short'})}</strong><span>{new Date(d+'T12:00:00').toLocaleDateString([],{month:'short',day:'numeric'})}</span></button>{start>0&&folded(before,'early')}<button className="day-track" aria-label={`Open activity for ${d}`} onClick={()=>openDay(d)}><Marks pieces={ribbonPieces(items,d,start,end)}/>{!items.length&&<span className="no-recording">No activity</span>}</button>{end<24&&folded(after,'late')}</div>;
 })}
 </div></>:<><Axis start={0} end={24}/><div className="detail-ribbon" aria-label="Full 24-hour activity"><Marks pieces={ribbonPieces(sessions,activeDay)} interactive selected={selected} onSelect={setSelected}/></div>{!sessions.length&&<p className="muted">No sessions recorded for this day.</p>}</>}
 {activeDay&&legend}
 {activeDay&&sessions.length>0&&<label className="session-picker">Session <select aria-label="Choose a session" value={selected||''} onChange={e=>setSelected(e.target.value||null)}><option value="">Select a session</option>{sessions.map(x=><option key={x.id} value={x.id}>{clock(x.start)} · {x.winner.label} · {minutes((new Date(x.end)-new Date(x.start))/1000)}</option>)}</select></label>}
 {detail&&<SessionDetail detail={detail} onClose={()=>setSelected(null)}/>}
 </section>}</main>;
}
createRoot(document.getElementById('root')).render(<App/>);
