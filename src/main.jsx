import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createPreview} from './preview';
import {localDate} from '../shared/core.mjs';
import './styles.css';
const api=window.argus||createPreview();
const clock=v=>new Date(v).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
const duration=r=>{const m=Math.round((new Date(r.end)-new Date(r.start))/60000);return m>=60?`${Math.floor(m/60)}h${m%60?' '+m%60+'m':''}`:`${m}m`;};
function App(){
 const [state,setState]=useState(null),[date,setDate]=useState(localDate()),[settings,showSettings]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{let live=true;api.invoke('snapshot').then(s=>{if(live)setState(s);}).catch(e=>setError(e.message));const off=api.subscribe(s=>{if(live)setState(s);});return()=>{live=false;off();};},[]);
 async function run(action,payload){setBusy(true);setError('');try{await api.invoke(action,payload);setState(await api.invoke('snapshot'));}catch(e){setError(e.message);}finally{setBusy(false);}}
 function step(n){const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+n);setDate(localDate(d));}
 if(!state)return <main><p>{error||'Opening Argus…'}</p></main>;
 const s=state.settings,rows=state.sessions.filter(r=>localDate(new Date(r.start))===date).sort((a,b)=>a.start.localeCompare(b.start)),enabled=s.activityEnabled&&!s.paused;
 return <main>
 <header><a className="brand" href="#" onClick={e=>{e.preventDefault();showSettings(false);}}>argus</a><div className="header-actions"><span className={'status '+(enabled?'on':'')}>{api.platform==='preview'?'Sample day':state.runtime.health?.label||'Tracking off'}</span><button disabled={busy} onClick={()=>run('settings:update',s.activityEnabled?{paused:!s.paused}:{activityEnabled:true,titlesEnabled:true,paused:false})}>{enabled?'Pause':s.activityEnabled?'Resume':'Start tracking'}</button><button onClick={()=>showSettings(!settings)}>{settings?'Done':'Settings'}</button></div></header>
 {error&&<p role="alert" className="error">{error}</p>}{state.runtime.error&&<p role="alert" className="error">{state.runtime.error}</p>}
 {settings?<section className="settings"><h1>Settings</h1><p className="muted">Stored locally, encrypted on this computer.</p>
 <label className="setting"><span>Window titles<small>Recognize YouTube and retain titles after five minutes.</small></span><input type="checkbox" checked={s.titlesEnabled} disabled={busy} onChange={e=>run('settings:update',{titlesEnabled:e.target.checked})}/></label>
 <label className="setting"><span>Keep history</span><select value={s.retentionDays} disabled={busy} onChange={e=>run('settings:update',{retentionDays:Number(e.target.value)})}>{[7,30,90,365].map(n=><option key={n} value={n}>{n} days</option>)}</select></label>
 <label className="exclusions">Excluded apps or titles<textarea key={s.exclusions.join(',')} defaultValue={s.exclusions.join(', ')} onBlur={e=>{const exclusions=e.target.value.split(',').map(x=>x.trim()).filter(Boolean);if(exclusions.join(',')!==s.exclusions.join(','))run('settings:update',{exclusions});}}/></label>
 <p className="muted">Five minutes makes a block. Detours under two minutes are included when the main activity accounts for at least 70% of the block. Locked time and idle apps are skipped; video pages can stay open without input. Foreground time does not verify playback. Purpose labels are yours.</p>
 <div className="data-actions"><button disabled={busy} onClick={()=>run('data:export')}>Export history</button><button disabled={busy} className="danger" onClick={()=>{if(window.confirm('Delete all activity history? This cannot be undone.'))run('history:delete',{range:'all'});}}>Delete history</button></div>
 </section>:<section>
 <div className="day-heading"><div><p className="eyebrow">Your day</p><h1>{date===localDate()?'Today':new Date(date+'T12:00:00').toLocaleDateString([],{month:'long',day:'numeric'})}</h1></div><div className="date-controls"><button aria-label="Previous day" onClick={()=>step(-1)}>‹</button><input aria-label="Journal date" type="date" value={date} max={localDate()} onChange={e=>{if(e.target.value)setDate(e.target.value);}}/><button aria-label="Next day" disabled={date>=localDate()} onClick={()=>step(1)}>›</button></div></div>
 {!s.activityEnabled&&api.platform!=='preview'&&<p className="consent">Start tracking to record foreground apps and window titles locally. No screenshots or audio.</p>}
 {rows.length?<div className="journal">{rows.map(row=><article key={row.id}><div className="time">{clock(row.start)}<span>– {clock(row.end)}</span></div><div className="activity"><h2>{row.detail==='Game'?'Played ':row.category==='coding'?'Worked in ':''}{row.label||row.app}</h2>{row.title&&<p className="video-title" title={row.title}>{row.title.replace(/\s*[-–—]\s*YouTube.*$/i,'')}</p>}<select aria-label={`Purpose for ${row.label||row.app} at ${clock(row.start)}`} className="purpose" value={row.purpose||'unknown'} disabled={busy} onChange={e=>run('session:update',{id:row.id,purpose:e.target.value})}><option value="unknown">Label purpose</option><option value="fun">For fun</option><option value="learning">Learning</option><option value="work">Work</option></select></div><span className="duration">{duration(row)}</span></article>)}</div>:<div className="empty"><h2>{date===localDate()?'Nothing yet':'No activity recorded'}</h2><p>Activities appear after five minutes. Brief switches stay out.</p></div>}
 </section>}</main>;
}
createRoot(document.getElementById('root')).render(<App/>);
