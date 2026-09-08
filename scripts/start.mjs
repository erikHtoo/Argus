import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(import.meta.url);
const run=(file,args,options={})=>new Promise((resolve,reject)=>{const child=spawn(file,args,{stdio:'inherit',windowsHide:true,...options});child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(new Error(`Process exited with ${code}`)));});
try {
  // Always launch the current UI. A stale dist previously hid source updates.
  await run(process.execPath,[path.join(path.dirname(require.resolve('vite/package.json')),'bin','vite.js'),'build']);
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
  const args=process.argv.slice(2);const background=args.includes('--background');
  const desktop=spawn(require('electron'),['.',...args],{env,windowsHide:true,detached:background,stdio:background?'ignore':'inherit'});
  desktop.once('error',error=>{console.error(error.message);process.exitCode=1;});
  if(background){desktop.unref();console.log('Argus is running in the system tray. Open it from the tray; use Quit Argus to stop.');}
  else desktop.once('exit',code=>{process.exitCode=code||0;});
}catch(error){console.error(error.message);process.exitCode=1;}
