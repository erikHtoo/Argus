import { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, safeStorage, powerMonitor, session, dialog } from 'electron';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { openStore } from './store.mjs';
import {observeSessionTotals as observeActivity,closeSessionTotals as closeActivity,daySessions} from '../shared/sessions.mjs';
const journalEntries=sessions=>sessions.filter(s=>!s.inputIdle);
import {activityContext,captureHealth,summarizeActivity} from '../shared/activity.mjs';
import {isExcluded,updateSettings,deleteHistory,pruneHistory} from '../shared/core.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const testMode=process.env.ARGUS_TEST_MODE==='1';
const background=process.argv.includes('--background');
const verifyUntil=process.argv.includes('--verify-activity')?Date.now()+30*60000:0;
const testProfile=/^[a-z0-9-]{1,60}$/.test(process.env.ARGUS_TEST_RUN||'')?`electron-${process.env.ARGUS_TEST_RUN}`:'electron';
app.setPath('userData',testMode?path.join(root,'.test-data',testProfile):path.join(process.env.LOCALAPPDATA || os.homedir(),'Argus'));
app.setAppUserModelId('com.argus.desktop');
// A secondary process must stop before opening the database or Chromium caches.
if(!app.requestSingleInstanceLock()) app.exit(0);
const browserData=path.join(app.getPath('userData'),'browser-session');
fs.mkdirSync(browserData,{recursive:true});
app.setPath('sessionData',browserData);
let win,tray,store,state,collector,saveTimer,healthTimer,retryTimer,shutdown=false,suspended=false,lastSample=null,lastSampleAt=0,captureEpoch=0,collectorStartedAt=0;
let samplesReceived=0,collectorRestarts=0,collectorError='',lastSavedAt=null,diagnosticError='';
let showOnReady=!background;
app.on('second-instance',()=>{
  showOnReady=true;
  if(win&&!win.isDestroyed()){if(win.isMinimized())win.restore();win.show();win.focus();}
});
const runtime={activity:'off',screen:'off',microphone:'off',playback:'off',storage:'encrypted',error:'',platform:process.platform};
const script=name=>path.join(root.includes('app.asar')?root.replace('app.asar','app.asar.unpacked'):root,'native',name);
const powershell=path.join(process.env.SystemRoot || 'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
function liveHealth() {
  const excluded=lastSample&&isExcluded(lastSample.app||'',lastSample.title||'',state.settings.exclusions);
  return captureHealth(state.settings,{suspended,lastSample:lastSample?{...lastSample,excluded}:null,lastSampleAt,error:collectorError});
}
function publicState() {
  const {activityEnabled,titlesEnabled,paused,exclusions,retentionDays}=state.settings;
  const settings={activityEnabled,titlesEnabled,paused,exclusions,retentionDays};const health=liveHealth();
  const current=health.state==='active'&&lastSample?activityContext(lastSample.app,settings.titlesEnabled?lastSample.title:''):null;
  return {sessions:journalEntries(state.sessions),settings,runtime:{...runtime,suspended,captureAllowed:canCapture(),health,current,lastSampleAt,lastSavedAt,samplesReceived,collectorRestarts,collectorError,diagnosticError}};
}
function emit() { if(win && !win.isDestroyed()) win.webContents.send('argus:state',publicState()); }
function persist(immediate=false) { clearTimeout(saveTimer); const run=()=>{try{store.save(state);lastSavedAt=new Date().toISOString();runtime.error='';}catch{runtime.error='Local save failed. Check available disk space; keep Argus open until resolved.';}emit();}; if(immediate)run();else saveTimer=setTimeout(run,500); }
function canCapture() { return !suspended && !state?.settings.paused && !lastSample?.locked && Boolean(lastSample) && Date.now()-lastSampleAt<12000 && !isExcluded(lastSample.app || '',lastSample.title || '',state.settings.exclusions); }
function trayMenu() {
  if(!tray)return;
  tray.setToolTip(`Argus · ${state.settings.paused?'Paused':state.settings.activityEnabled||state.settings.screenEnabled||state.settings.micEnabled||state.settings.playbackEnabled?'Capture enabled':'Capture off'}`);
  tray.setContextMenu(Menu.buildFromTemplate([{label:'Open Argus',click:()=>{win.show();win.focus();}},{label:state.settings.paused?'Resume capture':'Pause all capture',click:()=>{state.settings.paused=!state.settings.paused;captureEpoch++;reconcileCapture();persist(true);}},{label:'Delete last 15 minutes',click:()=>{captureEpoch++;closeActivity(state);deleteHistory(state,new Date(Date.now()-900000));persist(true);}},{type:'separator'},{label:'Quit Argus',click:()=>app.quit()}]));
}
function stopCollector() { if(state)closeActivity(state);if(collector){collector.kill();collector=null;}lastSample=null;lastSampleAt=0;runtime.activity='off'; }
function startCollector() {
  if(collector || process.platform!=='win32')return;
  let pending=''; const child=spawn(powershell,['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script('activity.ps1')],{windowsHide:true,stdio:['ignore','pipe','pipe']}); collector=child;collectorStartedAt=Date.now();collectorError='';
  runtime.activity='starting';
  child.stdout.on('data',chunk=>{pending+=chunk.toString('utf8');if(pending.length>32768){pending='';collectorError='Tracker output was invalid.';}const lines=pending.split(/\r?\n/);pending=lines.pop();for(const line of lines){try{const sample=JSON.parse(line);if(sample.error){runtime.activity='unavailable';collectorError='Windows activity sample unavailable.';continue;}const wasAllowed=canCapture();lastSample=sample;lastSampleAt=Date.now();samplesReceived++;collectorError='';if(wasAllowed&&!canCapture())captureEpoch++;runtime.activity=state.settings.activityEnabled?'active':'context only';if(!suspended)observeActivity(state,sample);emit();}catch{}}});
  child.stderr.on('data',()=>{runtime.activity='unavailable';});
  child.on('error',()=>{runtime.activity='unavailable';collectorError='Could not start the Windows tracker.';emit();});
  child.on('exit',()=>{if(collector===child){collector=null;runtime.activity='unavailable';collectorError='Tracker stopped. Retrying automatically.';lastSample=null;closeActivity(state);emit();}});
}
function monitorCollector() {
  const s=state.settings;const needed=(s.activityEnabled||s.screenEnabled||s.micEnabled||s.playbackEnabled)&&!s.paused&&!suspended&&!shutdown;
  if(needed&&collector&&Date.now()-(lastSampleAt||collectorStartedAt)>15000){stopCollector();collectorError='Tracker stopped responding. Retrying automatically.';captureEpoch++;}
  if(needed&&!collector&&!retryTimer){retryTimer=setTimeout(()=>{retryTimer=null;const s=state.settings;if(!shutdown&&!suspended&&!s.paused&&(s.activityEnabled||s.screenEnabled||s.micEnabled||s.playbackEnabled)){collectorRestarts++;startCollector();}},5000);}
  const health=liveHealth();if(tray)tray.setToolTip(`Argus · ${health.label}`);
  // Opt-in verification output contains aggregate app labels, never titles, notes, or credentials.
  if(verifyUntil){const file=path.join(app.getPath('userData'),'activity-check.json');
    if(Date.now()<=verifyUntil){const d=new Date();const day=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const since=verifyUntil-30*60000;
      const current=health.state==='active'&&lastSample?activityContext(lastSample.app,state.settings.titlesEnabled?lastSample.title:''):null;
      try{fs.writeFileSync(file,JSON.stringify({checkedAt:d.toISOString(),startedAt:new Date(since).toISOString(),expiresAt:new Date(verifyUntil).toISOString(),health,current,samplesReceived,collectorRestarts,lastSampleAt,lastSavedAt,storageError:runtime.error,sinceStart:summarizeActivity(state.sessions.filter(s=>+new Date(s.start)>=since),day),...summarizeActivity(state.sessions,day)},null,2));diagnosticError='';}catch{diagnosticError='Activity verification report could not be written.';}
    }
  }
  emit();
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
async function command(action,payload) {
  if(!payload || typeof payload!=='object')throw new Error('Invalid request.');
  switch(action){
    case 'snapshot':return publicState();
    case 'settings:update':{
      const allowed={};for(const key of ['activityEnabled','titlesEnabled','paused','exclusions','retentionDays'])if(payload[key]!==undefined)allowed[key]=payload[key];
      closeActivity(state);state.settings=updateSettings(state.settings,allowed);
      pruneHistory(state,new Date(Date.now()-state.settings.retentionDays*86400000));
      reconcileCapture();persist(true);return publicState();
    }
    case 'session:update':{
      const row=state.sessions.find(s=>s.id===payload.id);
      if(!row)throw new Error('Activity no longer exists.');
      if(!['unknown','fun','learning','work'].includes(payload.purpose))throw new Error('Invalid purpose.');
      row.purpose=payload.purpose;persist(true);return true;
    }
    case 'history:delete':{
      if(!['all','recent'].includes(payload.range))throw new Error('Invalid range.');
      closeActivity(state);deleteHistory(state,payload.range==='recent'?new Date(Date.now()-900000):null);persist(true);return true;
    }
    case 'data:export':{
      const result=await dialog.showSaveDialog(win,{defaultPath:'argus-journal.json',filters:[{name:'JSON',extensions:['json']}]});
      if(result.canceled)return false;
      const dates=[...new Set(state.sessions.map(s=>{const d=new Date(s.start);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}))].sort();
      fs.writeFileSync(result.filePath,JSON.stringify(dates.map(date=>({date,sessions:daySessions(state.sessions,date)})),null,2));return true;
    }
    default:throw new Error('Unknown command.');
  }
}

app.whenReady().then(async()=>{
  if(!safeStorage.isEncryptionAvailable())throw new Error('Windows user encryption is unavailable. Argus will not store unencrypted personal data.');
  store=await openStore(app.getPath('userData'),safeStorage);state=store.load();
  closeActivity(state);
  if(process.argv.includes('--track-activity')){state.settings.activityEnabled=true;state.settings.titlesEnabled=true;state.settings.paused=false;state.settings.onboarded=true;}
  // A fresh launch always requires explicitly re-enabling audio and screen capture.
  state.settings.micEnabled=false;state.settings.playbackEnabled=false;state.settings.screenEnabled=false;
  pruneHistory(state,new Date(Date.now()-state.settings.retentionDays*86400000));
  session.defaultSession.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
  session.defaultSession.setPermissionCheckHandler(()=>false);
  win=new BrowserWindow({width:1050,height:800,minWidth:640,minHeight:540,show:!testMode&&showOnReady,backgroundColor:'#f6f7f2',title:'Argus',autoHideMenuBar:true,webPreferences:{preload:path.join(root,'electron','preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',event=>event.preventDefault());
  ipcMain.handle('argus:command',async(event,action,payload)=>{if(event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame)return {ok:false,error:'Untrusted caller.'};try{return {ok:true,value:await command(action,payload)};}catch(error){return {ok:false,error:error.message || 'Unable to complete the action.'};}});
  await win.loadFile(path.join(root,'dist','index.html'));
  if(!testMode&&showOnReady){win.show();win.focus();}
  // A generated geometric tray mark avoids external icon assets.
  const pixels=Buffer.alloc(16*16*4);for(let y=0;y<16;y++)for(let x=0;x<16;x++){const d=Math.hypot(x-7.5,y-7.5);const i=(y*16+x)*4;pixels[i]=80;pixels[i+1]=103;pixels[i+2]=65;pixels[i+3]=(d<7&&d>4)||d<2?255:0;}
  tray=new Tray(nativeImage.createFromBitmap(pixels,{width:16,height:16}));tray.on('double-click',()=>{win.show();win.focus();});
  win.on('close',event=>{if(!shutdown&&!testMode){event.preventDefault();win.hide();}});
  powerMonitor.on('suspend',()=>{suspended=true;captureEpoch++;reconcileCapture();persist(true);});powerMonitor.on('resume',()=>{suspended=false;reconcileCapture();});
  powerMonitor.on('lock-screen',()=>{suspended=true;captureEpoch++;reconcileCapture();persist(true);});powerMonitor.on('unlock-screen',()=>{suspended=false;reconcileCapture();});
  reconcileCapture();
  healthTimer=setInterval(monitorCollector,3000);persist(true);
  setInterval(()=>{if(state.settings.activityEnabled)persist();},30000).unref();
  setInterval(()=>{captureEpoch++;pruneHistory(state,new Date(Date.now()-state.settings.retentionDays*86400000));persist();},3600000).unref();
  if(testMode&&process.env.ARGUS_SMOKE==='1') {
    try {const {runSmoke}=await import('./smoke.mjs');await runSmoke({win,app,root,store,state});}
    catch(error){console.error('FAIL: desktop smoke:',error.message);app.exit(1);}
  }
}).catch(error=>{if(testMode){console.error('Argus test startup failed:',error.message);app.exit(1);}else{dialog.showErrorBox('Argus could not start',error.message);app.quit();}});
app.on('before-quit',()=>{shutdown=true;clearInterval(healthTimer);clearTimeout(retryTimer);clearTimeout(saveTimer);stopCollector();if(store&&state){try{store.save(state);}catch{}}});
app.on('window-all-closed',()=>{if(testMode)app.quit();});
