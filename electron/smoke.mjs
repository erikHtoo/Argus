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
  const now=new Date();now.setHours(17,0,0,0);
  state.sessions.push({id:'smoke-journal',journal:true,app:'Valorant',label:'Valorant',detail:'Game',start:now.toISOString(),end:new Date(+now+7200000).toISOString(),activeSeconds:6900,title:''});
  state.sessions.push({id:'smoke-video',journal:true,app:'chrome',label:'YouTube',detail:'Video',start:new Date(+now+7200000).toISOString(),end:new Date(+now+10800000).toISOString(),activeSeconds:3480,title:'A quiet evening in Japan — YouTube',purpose:'fun'});
  await invoke('session:update',{id:'smoke-journal',purpose:'fun'});
  assert.equal((await invoke('snapshot')).sessions[0].purpose,'fun');
  assert.equal(store.load().sessions[0].purpose,'fun');
  assert.equal(fs.readFileSync(store.filename).includes(Buffer.from('Valorant')),false);
  await assert.rejects(()=>invoke('session:update',{id:'smoke-journal',purpose:'invented'}),/Invalid purpose/);
  await invoke('settings:update',{micEnabled:true,aiMode:'cloud'});
  assert.equal(state.settings.micEnabled,false);
  await new Promise(resolve=>setTimeout(resolve,200));
  assert.equal(await win.webContents.executeJavaScript('typeof window.require'),'undefined');
  assert.ok((await win.webContents.executeJavaScript('document.body.innerText')).includes('Played Valorant'));
  assert.doesNotMatch(await win.webContents.executeJavaScript('document.body.innerText'),/Timeline|Assistant|Tasks|Goals/);
  fs.mkdirSync(path.join(root,'output','playwright'),{recursive:true});
  const frame=await win.webContents.capturePage();fs.writeFileSync(path.join(root,'output','playwright','desktop-journal.png'),frame.toPNG());
  await win.webContents.executeJavaScript("[...document.querySelectorAll('button')].find(b=>b.textContent==='Settings').click()");
  await new Promise(resolve=>setTimeout(resolve,100));
  assert.ok((await win.webContents.executeJavaScript('document.body.innerText')).includes('Window titles'));
  win.setSize(640,720);await new Promise(resolve=>setTimeout(resolve,150));
  assert.equal(await win.webContents.executeJavaScript('document.documentElement.scrollWidth <= window.innerWidth'),true);
  await win.webContents.executeJavaScript("[...document.querySelectorAll('button')].find(b=>b.textContent==='Done').click()");
  await new Promise(resolve=>setTimeout(resolve,100));
  assert.equal(await win.webContents.executeJavaScript('document.documentElement.scrollWidth <= window.innerWidth'),true);
  await invoke('history:delete',{range:'all'});assert.equal((await invoke('snapshot')).sessions.length,0);
  console.log('PASS: journal UI, purpose persistence, encrypted storage, deletion, removed chat, disabled media, and second-instance cache isolation.');
  app.quit();
}
