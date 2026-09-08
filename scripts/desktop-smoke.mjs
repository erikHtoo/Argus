import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);const executable=require('electron');
const environment={...process.env,ARGUS_TEST_MODE:'1',ARGUS_SMOKE:'1'};
delete environment.ELECTRON_RUN_AS_NODE;
const proc=spawn(executable,['.'],{stdio:'inherit',windowsHide:true,env:environment});
const timer=setTimeout(()=>{proc.kill();console.error('Desktop smoke timed out.');process.exitCode=1;},45000);
proc.on('exit',code=>{clearTimeout(timer);process.exitCode=code||0;});
proc.on('error',error=>{clearTimeout(timer);console.error(error.message);process.exitCode=1;});
