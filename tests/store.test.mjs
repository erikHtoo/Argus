import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';
import {openStore} from '../electron/store.mjs';
import {emptyState,makeTask} from '../shared/core.mjs';

test('encrypted database round-trips across restart without plaintext and preserves unreadable originals',async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'argus-store-test-'));const key=randomBytes(32);
  const codec={encryptString(text){const iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',key,iv);const bytes=Buffer.concat([cipher.update(text,'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),bytes]);},decryptString(bytes){const decipher=createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));decipher.setAuthTag(bytes.subarray(12,28));return Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString('utf8');}};
  try {const first=await openStore(directory,codec);const state=emptyState();state.tasks.push(makeTask({title:'Private test commitment'}));first.save(state);const encrypted=fs.readFileSync(first.filename);assert.equal(encrypted.includes(Buffer.from('Private test commitment')),false);first.close();const second=await openStore(directory,codec);assert.equal(second.load().tasks[0].title,'Private test commitment');second.close();await assert.rejects(()=>openStore(directory,{...codec,decryptString(){throw new Error('Wrong user');}}),/preserved/);assert.deepEqual(fs.readFileSync(path.join(directory,'argus.db.enc')),encrypted);}finally {fs.rmSync(directory,{recursive:true,force:true});}
});
