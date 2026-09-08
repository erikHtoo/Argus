import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js/dist/sql-wasm.js';
import { emptyState } from '../shared/core.mjs';

export async function openStore(directory, codec) {
  fs.mkdirSync(directory,{recursive:true});
  const filename=path.join(directory,'argus.db.enc');
  const SQL=await initSqlJs({locateFile:file=>path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'node_modules', 'sql.js', 'dist', file)});
  let db;
  try { db=fs.existsSync(filename) ? new SQL.Database(Buffer.from(codec.decryptString(fs.readFileSync(filename)),'base64')) : new SQL.Database(); }
  catch { throw new Error('Argus could not unlock your local database. The original file has been preserved.'); }
  db.run('CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, kind TEXT NOT NULL, payload TEXT NOT NULL); CREATE INDEX IF NOT EXISTS records_kind ON records(kind);');
  function load() {
    const state=emptyState(); const stmt=db.prepare('SELECT kind, payload FROM records');
    while(stmt.step()) { const {kind,payload}=stmt.getAsObject(); const item=JSON.parse(payload); if(Array.isArray(state[kind])) state[kind].push(item); else state[kind]=item; } stmt.free();
    state.settings={...emptyState().settings,...state.settings};
    state.sessions.sort((a,b)=>a.start.localeCompare(b.start)); return state;
  }
  function save(state) {
    db.run('BEGIN');
    try { db.run('DELETE FROM records'); const stmt=db.prepare('INSERT INTO records VALUES (?, ?, ?)');
      for(const [kind,value] of Object.entries(state)) { if(Array.isArray(value)) for(const item of value) stmt.run([item.id,kind,JSON.stringify(item)]); else stmt.run([`_${kind}`,kind,JSON.stringify(value)]); }
      stmt.free(); db.run('COMMIT');
    } catch(error) { db.run('ROLLBACK'); throw error; }
    const encrypted=codec.encryptString(Buffer.from(db.export()).toString('base64'));
    const temp=`${filename}.tmp`; fs.writeFileSync(temp,encrypted); fs.renameSync(temp,filename);
  }
  return {load,save,close:()=>db.close(),filename};
}
