import {localDate} from './core.mjs';
export const DEFAULT_VIEW={days:7,start:8,end:24};
export function viewPreferences(value={}){
 const start=Number(value.start),end=Number(value.end);
 const valid=Number.isInteger(start)&&Number.isInteger(end)&&start>=0&&end<=24&&end>start;
 return {days:[1,7,14,30].includes(Number(value.days))?Number(value.days):7,start:valid?start:8,end:valid?end:24};
}
export function dateRange(last,count){return Array.from({length:count},(_,i)=>{const d=new Date(last+'T12:00:00');d.setDate(d.getDate()-i);return localDate(d);});}
export function hourLabel(hour){return hour===24||hour===0?'12am':hour===12?'12pm':hour<12?`${hour}am`:`${hour-12}pm`;}
export function activityColor(label){
 const key=String(label).toLowerCase().replace(/\.exe$/,'').replace(/^valorant.*$/,'valorant').replace(/^(code|vs code)$/,'vs code');
 const known={'valorant':'#dcb58f','youtube':'#bdcde3','vs code':'#b8cea9','idle':'#d9dcd3','discord':'#cec5e2','chrome':'#e0d09f'};
 if(known[key])return known[key];
 let hash=0;for(const c of key)hash=(hash*31+c.charCodeAt(0))>>>0;
 return `hsl(${hash%360} 29% 78%)`;
}
export function ribbonPieces(sessions,date,start=0,end=24){
 const floor=new Date(date+'T00:00:00'),a=new Date(floor),b=new Date(floor);a.setHours(start);b.setHours(end);
 const span=+b-+a;
 return sessions.flatMap(session=>{const left=Math.max(+a,+new Date(session.start)),right=Math.min(+b,+new Date(session.end));return right>left?[{session,left:(left-a)/span*100,width:(right-left)/span*100,seconds:(right-left)/1000}]:[];});
}
