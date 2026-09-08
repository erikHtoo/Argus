import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';

// Invoked only with ARGUS_TEST_MODE=1 and ARGUS_SMOKE=1. Uses an isolated database.
export async function runSmoke({win,app,root,store,state}) {
  const invoke=(action,payload={})=>win.webContents.executeJavaScript(`window.argus.invoke(${JSON.stringify(action)},${JSON.stringify(payload)})`);
  const initial=await invoke('snapshot');assert.equal(initial.settings.activityEnabled,false);assert.equal(initial.settings.micEnabled,false);assert.equal(initial.runtime.storage,'encrypted');
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
  const title=`Smoke task ${Date.now()}`;
  const goal=await invoke('goal:add',{title:'Test goal: build something useful',target:'Ship a tested desktop companion'});
  const task=await invoke('task:add',{title,commitment:'want_to',goalId:goal.id,minutes:25});
  let snapshot=await invoke('snapshot');assert.ok(snapshot.tasks.some(t=>t.id===task.id));
  await invoke('focus:start',{taskId:task.id});assert.equal((await invoke('snapshot')).focus.taskId,task.id);await invoke('focus:stop');
  const memory=await invoke('memory:add',{text:'I need to review the synthetic chapter-four fixture.'});
  snapshot=await invoke('snapshot');assert.ok(snapshot.tasks.some(t=>t.sourceId===memory.id&&t.status==='inbox'));
  const found=await invoke('memory:search',{query:'synthetic chapter'});assert.equal(found[0].id,memory.id);
  const answer=await invoke('chat',{question:'What should I work on next?'});assert.ok(answer.text.includes(title));
  await invoke('settings:update',{apiKey:'SYNTHETIC_TEST_KEY'});snapshot=await invoke('snapshot');assert.equal(snapshot.settings.apiKey,undefined);assert.equal(snapshot.settings.hasApiKey,true);await invoke('settings:update',{apiKey:''});
  await invoke('task:update',{id:task.id,status:'done'});assert.equal((await invoke('snapshot')).tasks.find(t=>t.id===task.id).status,'done');
  store.save(state);const reloaded=store.load();assert.ok(reloaded.tasks.some(t=>t.id===task.id&&t.status==='done'));
  assert.equal(fs.readFileSync(store.filename).includes(Buffer.from(title)),false);
  await invoke('memory:delete',{id:memory.id});snapshot=await invoke('snapshot');assert.equal(snapshot.memories.some(m=>m.id===memory.id),false);assert.equal(snapshot.tasks.some(t=>t.sourceId===memory.id),false);
  await invoke('task:delete',{id:task.id});await invoke('goal:delete',{id:goal.id});
  assert.equal(await win.webContents.executeJavaScript('typeof window.require'),'undefined');
  assert.ok((await win.webContents.executeJavaScript('document.body.innerText')).includes('Time by app'));
  fs.mkdirSync(path.join(root,'output','playwright'),{recursive:true});
  const frame=await win.webContents.capturePage();fs.writeFileSync(path.join(root,'output','playwright','desktop-empty.png'),frame.toPNG());
  console.log('PASS: native Electron launch, second-instance exit without cache errors or database changes, sandboxed IPC, task/goal/focus flows, source-linked search, key redaction, encrypted persistence, and deletion.');
  app.quit();
}
