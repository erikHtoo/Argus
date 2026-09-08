export function activityContext(app = '', title = '') {
  const process = app.toLowerCase().replace(/\.exe$/,'');
  const games = /^(valorant(?:-win64-shipping)?|cs2|dota2|league of legends|leagueclientux|minecraft.*|javaw|robloxplayerbeta|fortniteclient.*|overwatch|rocketleague|gta5(?:_enhanced)?|r5apex|eldenring|hades2?|balatro|stardew valley|terraria|genshinimpact|starrail|wuwa.*|witcher3|cyberpunk2077)$/;
  const browser = /^(chrome|msedge|firefox|brave|opera|vivaldi|browser|arc)$/;
  if (browser.test(process)) {
    if (/\byoutube\b/i.test(title)) return {label:'YouTube',category:'entertainment',detail:'Video',confidence:'app context'};
    if (/\btwitch\b/i.test(title)) return {label:'Twitch',category:'entertainment',detail:'Stream',confidence:'app context'};
    if (/\b(netflix|disney\+|prime video)\b/i.test(title)) return {label:'Video streaming',category:'entertainment',detail:'Video',confidence:'app context'};
    if (/\b(github|stackoverflow|stack overflow|mdn web docs)\b/i.test(title)) return {label:'Development resources',category:'coding',detail:'Browser',confidence:'app context'};
    return {label:app,category:'unknown',detail:'Browser',confidence:'unknown'};
  }
  if (games.test(process) && (process!=='javaw'||/minecraft/i.test(title))) return {label:/minecraft/i.test(title)?'Minecraft':app,category:'entertainment',detail:'Game',confidence:'known app'};
  if (/^(steam|epicgameslauncher|battle\.net|riotclientservices)$/.test(process)) return {label:app,category:'other',detail:'Game launcher',confidence:'known app'};
  if (/^(code|devenv|idea64|pycharm64|webstorm64|rider64|cursor|windsurf|windowsterminal|powershell|pwsh|cmd)$/.test(process)) return {label:app,category:'coding',detail:'Development',confidence:'known app'};
  if (/^(slack|discord|outlook|teams|ms-teams|zoom)$/.test(process)) return {label:app,category:'communication',detail:'Communication',confidence:'known app'};
  return {label:app,category:'unknown',detail:'Application',confidence:'unknown'};
}

export function summarizeActivity(sessions, date, now = new Date()) {
  const floor = new Date(`${date}T00:00:00`);const ceiling=new Date(floor);ceiling.setDate(ceiling.getDate()+1);
  const apps=new Map();let totalSeconds=0,idleSeconds=0,alignedSeconds=0;
  for(const session of sessions) {
    const start=Math.max(+floor,+new Date(session.start));const end=Math.min(+ceiling,+now,+new Date(session.end));
    const seconds=Math.max(0,(end-start)/1000);if(!seconds)continue;
    const context=activityContext(session.app,session.title);
    const key=session.label||context.label||session.app;
    const item=apps.get(key)||{label:key,seconds:0,sessions:0,category:session.category,detail:session.detail||context.detail};
    item.seconds+=seconds;item.sessions++;apps.set(key,item);totalSeconds+=seconds;
    if(session.inputIdle)idleSeconds+=seconds;if(session.intent==='goal-aligned')alignedSeconds+=seconds;
  }
  return {date,totalSeconds,idleSeconds,alignedSeconds,apps:[...apps.values()].sort((a,b)=>b.seconds-a.seconds)};
}

export function captureHealth(settings,{suspended=false,lastSample=null,lastSampleAt=0,error='',restarting=false}={},now=Date.now()) {
  const enabled=settings.activityEnabled||settings.screenEnabled||settings.micEnabled||settings.playbackEnabled;
  if(!enabled)return {state:'off',label:'Tracking off'};
  if(settings.paused)return {state:'paused',label:'Paused'};
  if(suspended||lastSample?.locked)return {state:'away',label:'Computer locked or asleep'};
  if(lastSample?.excluded)return {state:'excluded',label:'Excluded app · paused'};
  if(error||lastSampleAt && now-lastSampleAt>12000)return {state:'error',label:'Tracker needs attention'};
  if(!lastSampleAt||restarting)return {state:'starting',label:'Starting tracker'};
  return {state:'active',label:'Tracking'};
}
