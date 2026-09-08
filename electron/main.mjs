import { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, safeStorage, powerMonitor, session, desktopCapturer, dialog } from 'electron';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { openStore } from './store.mjs';
import { answerQuestion, transcribeAudio } from './ai.mjs';
import { makeTask, makeGoal, observeActivity, closeActivity, acceptPlan, isExcluded, updateSettings, textValue, validateDate, proposePlan, searchMemory, suggestTasks, deleteHistory, pruneHistory } from '../shared/core.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const testMode=process.env.ARGUS_TEST_MODE==='1';
app.setPath('userData',testMode?path.join(root,'.test-data','electron'):path.join(process.env.LOCALAPPDATA || os.homedir(),'Argus'));
app.setAppUserModelId('com.argus.desktop');
if(!app.requestSingleInstanceLock()) app.quit();
let win,tray,store,state,collector,saveTimer,screenTimer,shutdown=false,suspended=false,lastSample=null,lastSampleAt=0,captureEpoch=0,screenBusy=false,aiBusy=false;
const audioBusy=new Set();
const runtime={activity:'off',screen:'off',microphone:'off',playback:'off',storage:'encrypted',error:'',platform:process.platform};
const script=name=>path.join(root.includes('app.asar')?root.replace('app.asar','app.asar.unpacked'):root,'native',name);
const powershell=path.join(process.env.SystemRoot || 'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
function publicState() { const {apiKey,...settings}=state.settings; return {...state,settings:{...settings,hasApiKey:Boolean(apiKey)},runtime:{...runtime,suspended,captureAllowed:canCapture()}}; }
function emit() { if(win && !win.isDestroyed()) win.webContents.send('argus:state',publicState()); }
function persist(immediate=false) { clearTimeout(saveTimer); const run=()=>{try{store.save(state);runtime.error='';}catch{runtime.error='Local save failed. Check available disk space; keep Argus open until resolved.';}emit();}; if(immediate)run();else saveTimer=setTimeout(run,500); }
function canCapture() { return !suspended && !state?.settings.paused && !lastSample?.locked && Boolean(lastSample) && Date.now()-lastSampleAt<12000 && !isExcluded(lastSample.app || '',lastSample.title || '',state.settings.exclusions); }
function trayMenu() {
  if(!tray)return;
  tray.setToolTip(`Argus · ${state.settings.paused?'Paused':state.settings.activityEnabled||state.settings.screenEnabled||state.settings.micEnabled||state.settings.playbackEnabled?'Capture enabled':'Capture off'}`);
  tray.setContextMenu(Menu.buildFromTemplate([{label:'Open Argus',click:()=>{win.show();win.focus();}},{label:state.settings.paused?'Resume capture':'Pause all capture',click:()=>{state.settings.paused=!state.settings.paused;captureEpoch++;reconcileCapture();persist(true);}},{label:'Delete last 15 minutes',click:()=>{captureEpoch++;deleteHistory(state,new Date(Date.now()-900000));persist(true);}},{type:'separator'},{label:'Quit Argus',click:()=>app.quit()}]));
}
function stopCollector() { if(state)closeActivity(state);if(collector){collector.kill();collector=null;}lastSample=null;lastSampleAt=0;runtime.activity='off'; }
function startCollector() {
  if(collector || process.platform!=='win32')return;
  let pending=''; const child=spawn(powershell,['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script('activity.ps1')],{windowsHide:true,stdio:['ignore','pipe','pipe']}); collector=child;
  runtime.activity='starting';
  child.stdout.on('data',chunk=>{pending+=chunk.toString('utf8');const lines=pending.split(/\r?\n/);pending=lines.pop();for(const line of lines){try{const sample=JSON.parse(line);if(sample.error){runtime.activity='unavailable';continue;}lastSample=sample;lastSampleAt=Date.now();runtime.activity=state.settings.activityEnabled?'active':'context only';if(!suspended)observeActivity(state,sample);emit();}catch{}}});
  child.stderr.on('data',()=>{runtime.activity='unavailable';});
  child.on('error',()=>{runtime.activity='unavailable';emit();});
  child.on('exit',()=>{if(collector===child){collector=null;runtime.activity='unavailable';lastSample=null;emit();}});
}
function reconcileCapture() {
  closeActivity(state);const settings=state.settings;
  const any=settings.activityEnabled||settings.screenEnabled||settings.micEnabled||settings.playbackEnabled;
  if(any && !settings.paused && !suspended)startCollector();else stopCollector();
  runtime.screen=settings.screenEnabled ? settings.paused?'paused':'waiting' : 'off';
  runtime.microphone=settings.micEnabled ? settings.paused?'paused':'waiting' : 'off';
  runtime.playback=settings.playbackEnabled ? settings.paused?'paused':'waiting' : 'off';
  trayMenu();emit();
}
function addMemory(text,kind,at=new Date().toISOString(),label='') {
  const trimmed=textValue(text,30000);if(!trimmed)return null;
  const memory={id:randomUUID(),text:trimmed,kind,createdAt:at,label:textValue(label,150)};state.memories.push(memory);suggestTasks(state,memory);persist();return memory;
}
async function captureScreen() {
  if(screenBusy || !state.settings.screenEnabled || !canCapture() || !lastSample?.handle)return;
  screenBusy=true;const epoch=captureEpoch;const sample={...lastSample};
  try {
    if(epoch!==captureEpoch || !canCapture() || lastSample.handle!==sample.handle)return;
    const result=await new Promise((resolve,reject)=>{
      let stdout=''; const child=spawn(powershell,['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script('ocr.ps1'),'-WindowHandle',String(sample.handle),'-ExclusionsBase64',Buffer.from(JSON.stringify(state.settings.exclusions)).toString('base64')],{windowsHide:true,stdio:['ignore','pipe','pipe']});
      const timeout=setTimeout(()=>{child.kill();reject(new Error('OCR timed out.'));},25000);
      child.stdout.on('data',b=>{stdout+=b.toString('utf8');});child.stderr.on('data',()=>{});
      child.on('error',error=>{clearTimeout(timeout);reject(error);});child.on('exit',code=>{clearTimeout(timeout);if(code!==0)reject(new Error('Windows OCR unavailable. Install an OCR language pack.'));else {try{resolve(JSON.parse(stdout));}catch{reject(new Error('OCR response unavailable.'));}}});
    });
    if(epoch!==captureEpoch || !canCapture() || sample.handle!==lastSample?.handle)return;
    if(result.text && !state.memories.slice(-10).some(m=>m.kind==='screen' && m.text===result.text))addMemory(result.text,'screen',new Date().toISOString(),sample.app);
    runtime.screen='active';
  } catch(error) {runtime.screen=error.message;} finally {screenBusy=false;emit();}
}

async function command(action,payload) {
  if(!payload || typeof payload!=='object')throw new Error('Invalid request.');
  switch(action) {
    case 'snapshot':return publicState();
    case 'task:add': {const task=makeTask(payload);state.tasks.push(task);persist();return task;}
    case 'task:update': {const task=state.tasks.find(t=>t.id===payload.id);if(!task)throw new Error('Task no longer exists.');if(payload.title!==undefined){const title=textValue(payload.title,240);if(!title)throw new Error('Task title is required.');task.title=title;}if(payload.status!==undefined){if(!['todo','done','inbox'].includes(payload.status))throw new Error('Invalid task status.');task.status=payload.status;task.completedAt=payload.status==='done'?new Date().toISOString():null;}if(payload.due!==undefined)task.due=validateDate(payload.due);persist();return task;}
    case 'task:delete': state.tasks=state.tasks.filter(t=>t.id!==payload.id);state.blocks=state.blocks.filter(b=>b.taskId!==payload.id);if(state.focus?.taskId===payload.id)state.focus=null;persist();return true;
    case 'goal:add': {const goal=makeGoal(payload);state.goals.push(goal);persist();return goal;}
    case 'goal:delete':state.goals=state.goals.filter(g=>g.id!==payload.id);state.tasks=state.tasks.map(t=>t.goalId===payload.id?{...t,goalId:''}:t);persist();return true;
    case 'settings:update': {const next=updateSettings(state.settings,payload);if(payload.apiKey!==undefined)next.apiKey=textValue(payload.apiKey,1000);captureEpoch++;state.settings=next;pruneHistory(state,new Date(Date.now()-next.retentionDays*86400000));reconcileCapture();persist(true);return publicState();}
    case 'plan:propose': return proposePlan(state);
    case 'plan:accept':acceptPlan(state,payload.blocks);persist();return true;
    case 'block:delete':state.blocks=state.blocks.filter(b=>b.id!==payload.id);persist();return true;
    case 'focus:start': {const task=state.tasks.find(t=>t.id===payload.taskId&&t.status==='todo');if(!task)throw new Error('Choose an open task first.');state.focus={taskId:task.id,title:task.title,start:new Date().toISOString(),end:new Date(Date.now()+Math.min(task.minutes,90)*60000).toISOString()};persist();return state.focus;}
    case 'focus:stop':state.focus=null;persist();return true;
    case 'session:update': {const item=state.sessions.find(s=>s.id===payload.id);if(!item)throw new Error('Activity no longer exists.');if(payload.intent!==undefined){if(!['goal-aligned','planned leisure','possible distraction','unknown'].includes(payload.intent))throw new Error('Invalid intention.');item.intent=payload.intent;}if(payload.category!==undefined){if(!['coding','studying','communication','entertainment','other','unknown'].includes(payload.category))throw new Error('Invalid category.');item.category=payload.category;}persist();return true;}
    case 'memory:add':return addMemory(payload.text,'note');
    case 'memory:delete': {captureEpoch++;state.memories=state.memories.filter(m=>m.id!==payload.id);state.tasks=state.tasks.filter(t=>!(t.status==='inbox'&&t.sourceId===payload.id)).map(t=>t.sourceId===payload.id?{...t,sourceId:''}:t);persist(true);return true;}
    case 'memory:search':return searchMemory(state,payload.query);
    case 'chat': {if(aiBusy)throw new Error('An answer is already being prepared.');const question=textValue(payload.question,2000);if(!question)throw new Error('Ask a question first.');aiBusy=true;const epoch=captureEpoch;try {const result=await answerQuestion(state,question,state.settings.apiKey);if(epoch!==captureEpoch)throw new Error('Your context changed. Please ask again.');return result;}finally{aiBusy=false;}}
    case 'history:delete': {if(payload.range!=='all'&&payload.range!=='recent')throw new Error('Choose a deletion range.');captureEpoch++;deleteHistory(state,payload.range==='recent'?new Date(Date.now()-900000):null);persist(true);return true;}
    case 'data:export': {const result=await dialog.showSaveDialog(win,{defaultPath:'argus-export.json',filters:[{name:'JSON',extensions:['json']}]});if(result.canceled)return false;const {settings,...data}=state;fs.writeFileSync(result.filePath,JSON.stringify({...data,settings:{...settings,apiKey:undefined}},null,2));return true;}
    case 'capture:error': {if(['microphone','playback'].includes(payload.source))runtime[payload.source]=textValue(payload.message,200);emit();return true;}
    case 'audio:chunk': {const source=payload.source;const enabled=source==='microphone'?state.settings.micEnabled:source==='playback'?state.settings.playbackEnabled:false;if(!enabled||!canCapture())return false;if(audioBusy.has(source))throw new Error('Transcription is slower than capture. This chunk was dropped.');const bytes=Buffer.from(payload.bytes || []);if(bytes.length>8*1024*1024)throw new Error('Audio chunk too large.');const epoch=captureEpoch;audioBusy.add(source);runtime[source]='transcribing';emit();try {const text=await transcribeAudio(state.settings,bytes,textValue(payload.mime,100));if(epoch===captureEpoch&&canCapture()&&text)addMemory(text,'audio',new Date().toISOString(),source);runtime[source]='listening';}catch(error){runtime[source]=error.message;throw error;}finally{audioBusy.delete(source);emit();}return true;}
    default:throw new Error('Unknown command.');
  }
}

app.whenReady().then(async()=>{
  if(!safeStorage.isEncryptionAvailable())throw new Error('Windows user encryption is unavailable. Argus will not store unencrypted personal data.');
  store=await openStore(app.getPath('userData'),safeStorage);state=store.load();
  // A fresh launch always requires explicitly re-enabling audio and screen capture.
  state.settings.micEnabled=false;state.settings.playbackEnabled=false;state.settings.screenEnabled=false;
  pruneHistory(state,new Date(Date.now()-state.settings.retentionDays*86400000));
  session.defaultSession.setPermissionRequestHandler((contents,permission,callback,details)=>callback(contents===win?.webContents&&permission==='media'&&Boolean(state.settings.micEnabled||state.settings.playbackEnabled)&&!state.settings.paused));
  session.defaultSession.setPermissionCheckHandler((contents,permission)=>contents===win?.webContents&&permission==='media'&&Boolean(state.settings.micEnabled||state.settings.playbackEnabled)&&!state.settings.paused);
  session.defaultSession.setDisplayMediaRequestHandler(async(request,callback)=>{try{if(!state.settings.playbackEnabled||!canCapture()){callback({});return;}const sources=await desktopCapturer.getSources({types:['screen'],thumbnailSize:{width:0,height:0}});callback({video:sources[0],audio:'loopback'});}catch{callback({});}});
  win=new BrowserWindow({width:1440,height:960,minWidth:1000,minHeight:720,show:!testMode,backgroundColor:'#f6f7f2',title:'Argus',autoHideMenuBar:true,webPreferences:{preload:path.join(root,'electron','preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',event=>event.preventDefault());
  ipcMain.handle('argus:command',async(event,action,payload)=>{if(event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame)return {ok:false,error:'Untrusted caller.'};try{return {ok:true,value:await command(action,payload)};}catch(error){return {ok:false,error:error.message || 'Unable to complete the action.'};}});
  await win.loadFile(path.join(root,'dist','index.html'));
  // A generated geometric tray mark avoids external icon assets.
  const pixels=Buffer.alloc(16*16*4);for(let y=0;y<16;y++)for(let x=0;x<16;x++){const d=Math.hypot(x-7.5,y-7.5);const i=(y*16+x)*4;pixels[i]=80;pixels[i+1]=103;pixels[i+2]=65;pixels[i+3]=(d<7&&d>4)||d<2?255:0;}
  tray=new Tray(nativeImage.createFromBitmap(pixels,{width:16,height:16}));tray.on('double-click',()=>{win.show();win.focus();});
  win.on('close',event=>{if(!shutdown&&!testMode){event.preventDefault();win.hide();}});
  powerMonitor.on('suspend',()=>{suspended=true;captureEpoch++;reconcileCapture();persist(true);});powerMonitor.on('resume',()=>{suspended=false;reconcileCapture();});
  powerMonitor.on('lock-screen',()=>{suspended=true;captureEpoch++;reconcileCapture();persist(true);});powerMonitor.on('unlock-screen',()=>{suspended=false;reconcileCapture();});
  reconcileCapture();screenTimer=setInterval(captureScreen,60000);
  setInterval(()=>{if(state.settings.activityEnabled)persist();},30000).unref();
  setInterval(()=>{captureEpoch++;pruneHistory(state,new Date(Date.now()-state.settings.retentionDays*86400000));persist();},3600000).unref();
  if(testMode&&process.env.ARGUS_SMOKE==='1') {
    try {const {runSmoke}=await import('./smoke.mjs');await runSmoke({win,app,root,store,state});}
    catch(error){console.error('FAIL: desktop smoke:',error.message);app.exit(1);}
  }
}).catch(error=>{dialog.showErrorBox('Argus could not start',error.message);app.quit();});
app.on('second-instance',()=>{if(win){win.show();win.focus();}});
app.on('before-quit',()=>{shutdown=true;clearInterval(screenTimer);clearTimeout(saveTimer);stopCollector();if(store&&state){try{store.save(state);}catch{}}});
app.on('window-all-closed',()=>{if(testMode)app.quit();});
