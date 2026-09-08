import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createPreview} from './preview';
import {localDate} from '../shared/core.mjs';
import './styles.css';
import './sessions.css';
import {daySessions} from '../shared/sessions.mjs';
const api=window.argus||createPreview();
const clock=v=>new Date(v).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
const minutes=n=>{const m=Math.round(n/60);return m<1?'<1m':m>=60?`${Math.floor(m/60)}h${m%60?' '+m%60+'m':''}`:`${m}m`;};
function SessionDetail({detail,onClose}){return (<section id={`detail-${detail.id}`} className="hour-detail" aria-label="Session details"><div className="detail-heading"><div><p className="eyebrow">{clock(detail.start)} – {clock(detail.end)}</p><h2>{detail.winner.label==='Idle'?'Idle':detail.winner.label+' session'}</h2></div><button aria-label="Close session details" onClick={onClose}>Close</button></div>
 <p className="muted">{minutes(detail.total)} recorded{detail.estimated?' · Older history, estimated':''}</p><div className="hour-breakdown">{detail.apps.map(a=><div key={a.label}><div className="breakdown-row"><span>{a.label}</span><div className="bar-track"><div style={{width:`${a.seconds/detail.total*100}%`}}/></div><span>{minutes(a.seconds)}</span></div>{a.titles.map(t=><p className="video-title" key={t.text}>{t.text} · {minutes(t.seconds)}</p>)}</div>)}</div>
 </section>);}
function App(){
 const [state,setState]=useState(null),[date,setDate]=useState(localDate()),[followToday,setFollowToday]=useState(true),[selected,setSelected]=useState(null),[settings,showSettings]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{let live=true;api.invoke('snapshot').then(s=>{if(live)setState(s);}).catch(e=>setError(e.message));const off=api.subscribe(s=>{if(live)setState(s);});return()=>{live=false;off();};},[]);
 async function run(action,payload){setBusy(true);setError('');try{await api.invoke(action,payload);setState(await api.invoke('snapshot'));}catch(e){setError(e.message);}finally{setBusy(false);}}
 function chooseDate(value){setDate(value);setFollowToday(value===localDate());setSelected(null);}
 useEffect(()=>{if(!followToday)return;const timer=setInterval(()=>{setDate(previous=>{const today=localDate();return previous===today?previous:today;});},30000);return()=>clearInterval(timer);},[followToday]);
 function step(n){const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+n);chooseDate(localDate(d));}
 if(!state)return <main><p>{error||'Opening Argus…'}</p></main>;
 const s=state.settings,sessions=daySessions(state.sessions,date,api.platform==='preview'?new Date(date+'T23:59:59'):new Date()),enabled=s.activityEnabled&&!s.paused;
 return <main>
 <header><a className="brand" href="#" onClick={e=>{e.preventDefault();showSettings(false);}}>argus</a><div className="header-actions"><span className={'status '+(enabled?'on':'')}>{api.platform==='preview'?'Sample day':state.runtime.health?.label||'Tracking off'}</span><button disabled={busy} onClick={()=>run('settings:update',s.activityEnabled?{paused:!s.paused}:{activityEnabled:true,titlesEnabled:true,paused:false})}>{enabled?'Pause':s.activityEnabled?'Resume':'Start tracking'}</button><button onClick={()=>showSettings(!settings)}>{settings?'Done':'Settings'}</button></div></header>
 {error&&<p role="alert" className="error">{error}</p>}{state.runtime.error&&<p role="alert" className="error">{state.runtime.error}</p>}
 {settings?<section className="settings"><h1>Settings</h1><p className="muted">Stored locally, encrypted on this computer.</p>
 <label className="setting"><span>Window titles<small>Recognize YouTube separately from other browser time.</small></span><input type="checkbox" checked={s.titlesEnabled} disabled={busy} onChange={e=>run('settings:update',{titlesEnabled:e.target.checked})}/></label>
 <label className="setting"><span>Keep history</span><select value={s.retentionDays} disabled={busy} onChange={e=>run('settings:update',{retentionDays:Number(e.target.value)})}>{[7,30,90,365].map(n=><option key={n} value={n}>{n} days</option>)}</select></label>
 <label className="exclusions">Excluded apps or titles<textarea key={s.exclusions.join(',')} defaultValue={s.exclusions.join(', ')} onBlur={e=>{const exclusions=e.target.value.split(',').map(x=>x.trim()).filter(Boolean);if(exclusions.join(',')!==s.exclusions.join(','))run('settings:update',{exclusions});}}/></label>
 <p className="muted">Sessions follow your main activity, regardless of the clock. Detours stay within a session; 15 minutes away starts a new one. Sessions appear after five minutes. Three minutes without input becomes idle, except on video pages. Locked time is left blank. Foreground video time does not confirm playback.</p>
 <div className="data-actions"><button disabled={busy} onClick={()=>run('data:export')}>Export history</button><button disabled={busy} className="danger" onClick={()=>{if(window.confirm('Delete all activity history? This cannot be undone.'))run('history:delete',{range:'all'});}}>Delete history</button></div>
 </section>:<section>
 <div className="day-heading"><div><p className="eyebrow">Your day</p><h1>{date===localDate()?'Today':new Date(date+'T12:00:00').toLocaleDateString([],{month:'long',day:'numeric'})}</h1></div><div className="date-controls"><button aria-label="Previous day" onClick={()=>step(-1)}>‹</button><input aria-label="Journal date" type="date" value={date} max={localDate()} onChange={e=>{if(e.target.value){chooseDate(e.target.value);}}}/><button aria-label="Next day" disabled={date>=localDate()} onClick={()=>step(1)}>›</button></div></div>
 {!s.activityEnabled&&api.platform!=='preview'&&<p className="consent">Start tracking to record foreground apps and window titles locally. No screenshots or audio.</p>}
 <div className="sessions-overview" aria-label="Daily sessions">{sessions.map(x=><React.Fragment key={x.id}><button className={'session-card '+x.winner.category+(selected===x.id?' chosen':'')} aria-expanded={selected===x.id} aria-controls={`detail-${x.id}`} onClick={()=>setSelected(selected===x.id?null:x.id)}><span className="session-time">{clock(x.start)} – {clock(x.end)}</span><strong>{x.winner.label==='Idle'?'Idle':x.winner.label+' session'}</strong><span className="session-duration">{minutes((new Date(x.end)-new Date(x.start))/1000)}</span></button>{selected===x.id&&<SessionDetail detail={x} onClose={()=>setSelected(null)}/>}</React.Fragment>)}</div>
 {!sessions.length&&<div className="empty"><h2>No sessions yet</h2><p>Your day takes shape after five minutes of activity.</p></div>}

 </section>}</main>;
}
createRoot(document.getElementById('root')).render(<App/>);
