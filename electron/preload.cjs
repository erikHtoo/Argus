const { contextBridge, ipcRenderer } = require('electron');
const actions=new Set(['snapshot','task:add','task:update','task:delete','goal:add','goal:delete','settings:update','plan:propose','plan:accept','block:delete','focus:start','focus:stop','session:update','memory:add','memory:delete','memory:search','chat','history:delete','data:export','audio:chunk','capture:error']);
contextBridge.exposeInMainWorld('argus',Object.freeze({
  invoke(action,payload={}) { if(!actions.has(action)) return Promise.reject(new Error('Unknown command.')); return ipcRenderer.invoke('argus:command',action,payload).then(result=>{if(!result.ok)throw new Error(result.error);return result.value;}); },
  subscribe(callback) { const handler=(_event,value)=>callback(value); ipcRenderer.on('argus:state',handler); return ()=>ipcRenderer.removeListener('argus:state',handler); },
  platform: process.platform,
}));
