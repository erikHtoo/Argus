const { contextBridge, ipcRenderer } = require('electron');
const actions=new Set(['snapshot','settings:update','session:update','history:delete','data:export']);
contextBridge.exposeInMainWorld('argus',Object.freeze({
  invoke(action,payload={}) { if(!actions.has(action)) return Promise.reject(new Error('Unknown command.')); return ipcRenderer.invoke('argus:command',action,payload).then(result=>{if(!result.ok)throw new Error(result.error);return result.value;}); },
  subscribe(callback) { const handler=(_event,value)=>callback(value); ipcRenderer.on('argus:state',handler); return ()=>ipcRenderer.removeListener('argus:state',handler); },
  platform: process.platform,
}));
