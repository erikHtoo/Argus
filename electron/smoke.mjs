import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';

// Invoked only with ARGUS_TEST_MODE=1 and ARGUS_SMOKE=1. Uses an isolated database.
export async function runSmoke({win,app,root,store,state}) {
  const invoke=(action,payload={})=>win.webContents.executeJavaScript(`window.argus.invoke(${JSON.stringify(action)},${JSON.stringify(payload)})`);
  const initial=await invoke('snapshot');assert.equal(initial.settings.activityEnabled,false);assert.equal(initial.settings.micEnabled,undefined);assert.equal(initial.runtime.storage,'encrypted');
  // Starting again must focus the primary, exit cleanly, and never touch its cache/database.
  const before=fs.readFileSync(store.filename);
  const secondEnvironment={...process.env};delete secondEnvironment.ARGUS_SMOKE;delete secondEnvironment.ELECTRON_RUN_AS_NODE;
  let stderr='';
  const secondExit=await new Promise((resolve,reject)=>{
    const second=spawn(process.execPath,[root],{env:secondEnvironment,windowsHide:true,stdio:['ignore','ignore','pipe']});
    const timer=setTimeout(()=>{second.kill();reject(new Error('Second instance failed to exit.'));},10000);
    second.stderr.on('data',chunk=>{stderr+=chunk.toString();});
    second.on('error',error=>{clearTimeout(timer);reject(error);});
    second.on('exit',code=>{clearTimeout(timer);resolve(code);});
  });
  assert.equal(secondExit,0);assert.doesNotMatch(stderr,/Unable to (?:move|create).*cache|Gpu Cache Creation failed/i);
  assert.deepEqual(fs.readFileSync(store.filename),before);
  assert.ok(app.getPath('sessionData').endsWith('browser-session'));
  await assert.rejects(()=>invoke('chat',{question:'hello'}),/Unknown command/);
  const now=new Date();now.setDate(now.getDate()-1);now.setHours(17,0,0,0);
  for(let m=0;m<180;m++){
    const label=m>=120?'YouTube':m%20<15?'Valorant':'Chrome';
    state.sessions.push({id:m===0?'smoke-journal':`fixture-${m}`,minute:true,app:label==='YouTube'?'chrome':label,label,detail:label==='Valorant'?'Game':label==='YouTube'?'Video':'Browser',category:label==='Valorant'||label==='YouTube'?'entertainment':'unknown',start:new Date(+now+m*60000).toISOString(),end:new Date(+now+(m+1)*60000).toISOString(),activeSeconds:60,title:''});
  }
  await invoke('session:update',{id:'smoke-journal',purpose:'fun'});
  assert.equal((await invoke('snapshot')).sessions[0].purpose,'fun');
  assert.equal(store.load().sessions[0].purpose,'fun');
  assert.equal(fs.readFileSync(store.filename).includes(Buffer.from('Valorant')),false);
  await assert.rejects(()=>invoke('session:update',{id:'smoke-journal',purpose:'invented'}),/Invalid purpose/);
  await invoke('settings:update',{micEnabled:true,aiMode:'cloud'});
  assert.equal(state.settings.micEnabled,false);
  await new Promise(resolve=>setTimeout(resolve,200));
  assert.equal(await win.webContents.executeJavaScript('typeof window.require'),'undefined');
  const date=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
  await win.webContents.executeJavaScript(`(()=>{const el=document.querySelector('input[type=date]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,"${date}");el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await new Promise(resolve=>setTimeout(resolve,100));
  assert.equal(await win.webContents.executeJavaScript("document.querySelectorAll('.session-card').length"),2);
  assert.ok((await win.webContents.executeJavaScript('document.body.innerText')).includes('Valorant'));
  assert.equal(await win.webContents.executeJavaScript("document.querySelector('.hour-detail')"),null);
  await win.webContents.executeJavaScript("document.querySelectorAll('.session-card')[0].click()");
  await new Promise(resolve=>setTimeout(resolve,100));
  assert.ok((await win.webContents.executeJavaScript('document.body.innerText')).includes('Valorant session'));
  assert.ok((await win.webContents.executeJavaScript('document.body.innerText')).includes('1h 30m'));
  assert.equal(await win.webContents.executeJavaScript("document.querySelector('.session-card.chosen').nextElementSibling.getAttribute('aria-label')"),'Session details');
  assert.doesNotMatch(await win.webContents.executeJavaScript('document.body.innerText'),/Timeline|Assistant|Tasks|Goals/);
  fs.mkdirSync(path.join(root,'output','playwright'),{recursive:true});
  const frame=await win.webContents.capturePage();fs.writeFileSync(path.join(root,'output','playwright','desktop-sessions.png'),frame.toPNG());
  await win.webContents.executeJavaScript("[...document.querySelectorAll('button')].find(b=>b.textContent==='Settings').click()");
  await new Promise(resolve=>setTimeout(resolve,100));
  assert.ok((await win.webContents.executeJavaScript('document.body.innerText')).includes('Window titles'));
  win.setSize(640,720);await new Promise(resolve=>setTimeout(resolve,150));
  assert.equal(await win.webContents.executeJavaScript('document.documentElement.scrollWidth <= window.innerWidth'),true);
  await win.webContents.executeJavaScript("[...document.querySelectorAll('button')].find(b=>b.textContent==='Done').click()");
  await new Promise(resolve=>setTimeout(resolve,100));
  assert.equal(await win.webContents.executeJavaScript('document.documentElement.scrollWidth <= window.innerWidth'),true);
  await invoke('history:delete',{range:'all'});assert.equal((await invoke('snapshot')).sessions.length,0);
  console.log('PASS: variable sessions, 90/30-minute drill-down, date filtering, purpose persistence, encrypted storage, deletion, removed chat, disabled media, and second-instance cache isolation.');
  app.quit();
}
