import {localDate} from './core.mjs';
import {activityContext,summarizeActivity} from './activity.mjs';

export function activityAnswer(state,question,now=new Date()) {
  const specific=/youtube|gaming|games?\b|twitch/i.test(question);
  if(!specific&&!/where.*time|time.*spent|summari[sz]e.*(?:day|today)|what.*(?:doing|do today|did today)|how.*(?:day|time)|activity.*(?:today|yesterday)/i.test(question))return null;
  if(/last week|this week|last month|\d{4}-\d{2}-\d{2}/i.test(question))return {text:'The activity summary currently supports today or yesterday. Open Timeline to inspect another date.',sources:[]};
  const date=new Date(now);if(/yesterday/i.test(question))date.setDate(date.getDate()-1);const day=localDate(date);
  const summary=summarizeActivity(state.sessions,day,now);
  const match=item=>/youtube/i.test(question)?item.label==='YouTube':/twitch/i.test(question)?item.label==='Twitch':/gaming|games?\b/i.test(question)?item.detail==='Game':true;
  const items=summary.apps.filter(match);const seconds=items.reduce((n,i)=>n+i.seconds,0);
  const format=s=>s<60?`${Math.floor(s)} seconds`:`${Math.floor(s/60)} minutes`;
  if(!seconds)return {text:`No matching foreground activity was recorded ${day===localDate(now)?'today':'yesterday'}. That means no evidence in the log, not that you did not do it.${specific&&!state.settings.titlesEnabled?' Enable window titles to distinguish browser sites.':''}`,sources:[]};
  const labels=new Set(items.map(i=>i.label));
  const sessions=state.sessions.filter(s=>localDate(new Date(s.start))===day&&labels.has(s.label||activityContext(s.app,s.title).label));
  const sources=sessions.slice(-8).map(s=>({id:s.id,kind:'activity',at:s.start,text:`${s.label||s.app}${s.title?`: ${s.title}`:''}`}));
  return {text:`Recorded ${day===localDate(now)?'today':'yesterday'}: ${format(seconds)}${specific?' matching your question':''}.\n\n${items.slice(0,10).map(i=>`${i.label}: ${format(i.seconds)}`).join('\n')}\n\nThis measures foreground time. It does not prove a video was playing or that time was wasted. You can review and label the sessions in Timeline.`,sources};
}
