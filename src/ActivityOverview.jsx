import React from 'react';
import {activityContext,summarizeActivity} from '../shared/activity.mjs';
import {localDate} from '../shared/core.mjs';

const elapsed=s=>s<60?`${Math.floor(s)}s`:s<3600?`${Math.floor(s/60)}m`:`${Math.floor(s/3600)}h ${Math.floor(s%3600/60)}m`;
export default function ActivityOverview({state,onSettings,onAction,onTimeline,preview=false}) {
  const summary=summarizeActivity(state.sessions,localDate());
  const health=state.runtime.health||{state:'off',label:preview?'Sample activity':'Tracking off'};
  const current=state.runtime.current;
  const last=state.sessions.at(-1);
  const currentContext=last?activityContext(last.app,last.title):null;
  const live=health.state==='active';
  return <section className="activity-overview" aria-label="Activity tracking">
    <div className="tracking-status">
      <div className="tracking-copy"><span className={`health-dot ${health.state}`}/><div><strong>{preview?'Sample activity':health.label}</strong><p>{live&&current?`${current.label} · ${current.detail}`:health.state==='off'?'Track the apps you use throughout the day.':health.state==='error'?'Argus is reconnecting to the Windows tracker.':health.state==='excluded'?'This app is excluded from capture.':health.state==='paused'?'Resume when you’re ready.':health.state==='starting'?'Waiting for the first Windows sample.':'No activity is recorded while locked or asleep.'}</p></div></div>
      <div className="tracking-controls">{!preview&&<button className="button small" onClick={()=>onAction('settings:update',state.settings.activityEnabled?{paused:!state.settings.paused}:{activityEnabled:true})}>{state.settings.activityEnabled?(state.settings.paused?'Resume':'Pause'):'Start tracking'}</button>}<button className="text-link" onClick={onSettings}>Settings</button></div>
    </div>
    {live&&last?.inputIdle&&<p className="tracking-note">No recent keyboard or mouse input{currentContext?.detail==='Video'?' · YouTube may still be playing.':' · reading or watching may still be active.'}</p>}
    {!preview&&state.settings.activityEnabled&&!state.settings.titlesEnabled&&<div className="tracking-note">Enable window titles to distinguish YouTube and other browser activity. <button className="text-link" onClick={()=>onAction('settings:update',{titlesEnabled:true})}>Enable titles</button></div>}
    {state.runtime.error&&<p className="tracking-error" role="alert">{state.runtime.error}</p>}
    <div className="activity-summary-header"><h2>Time by app</h2><span>{elapsed(summary.totalSeconds)} recorded today</span></div>
    {summary.apps.length?<div className="app-breakdown">{summary.apps.slice(0,5).map(item=><div className="app-time-row" key={item.label}><span className="app-time-name">{item.label}<small>{item.detail}</small></span><div className="app-time-track"><span style={{width:`${item.seconds/summary.totalSeconds*100}%`}}/></div><span className="app-time-value">{elapsed(item.seconds)}</span></div>)}</div>:<p className="activity-empty">App time appears here after the first few samples.</p>}
    <div className="activity-overview-footer"><span>{live&&state.runtime.lastSampleAt?`Updated ${Math.max(0,Math.floor((Date.now()-state.runtime.lastSampleAt)/1000))}s ago`:preview?'Sample data':'Foreground activity only'}</span><button className="text-link" onClick={onTimeline}>Open timeline</button></div>
  </section>;
}
