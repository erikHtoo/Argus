import { useEffect } from 'react';

function wav(samples,rate) {
  const outRate=16000;const length=Math.floor(samples.length*outRate/rate);const bytes=new ArrayBuffer(44+length*2);const view=new DataView(bytes);
  const label=(offset,text)=>[...text].forEach((c,i)=>view.setUint8(offset+i,c.charCodeAt(0)));
  label(0,'RIFF');view.setUint32(4,36+length*2,true);label(8,'WAVE');label(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,outRate,true);view.setUint32(28,outRate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);label(36,'data');view.setUint32(40,length*2,true);
  for(let i=0;i<length;i++){const s=Math.max(-1,Math.min(1,samples[Math.floor(i*rate/outRate)]));view.setInt16(44+i*2,s<0?s*32768:s*32767,true);}return bytes;
}
export function useAudioCapture(api,state) {
  const allowed=Boolean(state?.runtime.captureAllowed && !state.settings.paused && api.platform!=='preview');
  const mic=Boolean(state?.settings.micEnabled),playback=Boolean(state?.settings.playbackEnabled);
  useEffect(()=>{
    if(!allowed)return;
    let canceled=false;const cleanup=[];
    async function start(source) {
      let stream,context;
      try {
        stream=source==='microphone'?await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false}):await navigator.mediaDevices.getDisplayMedia({audio:true,video:true});
        if(canceled){stream.getTracks().forEach(t=>t.stop());return;}
        if(!stream.getAudioTracks().length)throw new Error('No audio track is available for this source.');
        // Playback capture requires a display stream on Windows. No video frames are read or stored.
        stream.getVideoTracks().forEach(t=>{t.enabled=false;});
        context=new AudioContext();await context.resume();
        const input=context.createMediaStreamSource(stream);const processor=context.createScriptProcessor(4096,1,1);const silent=context.createGain();silent.gain.value=0;
        let chunks=[],length=0,startedAt=new Date().toISOString();
        processor.onaudioprocess=event=>{
          if(canceled)return;const data=new Float32Array(event.inputBuffer.getChannelData(0));chunks.push(data);length+=data.length;
          if(length<context.sampleRate*20)return;
          const combined=new Float32Array(length);let pos=0;for(const chunk of chunks){combined.set(chunk,pos);pos+=chunk.length;}chunks=[];length=0;
          const at=startedAt;startedAt=new Date().toISOString();const rms=Math.sqrt(combined.reduce((sum,x)=>sum+x*x,0)/combined.length);
          if(rms<0.003)return;
          api.invoke('audio:chunk',{source,bytes:wav(combined,context.sampleRate),mime:'audio/wav',createdAt:at}).catch(()=>{});
        };
        input.connect(processor);processor.connect(silent);silent.connect(context.destination);
        cleanup.push(()=>{processor.disconnect();input.disconnect();silent.disconnect();stream.getTracks().forEach(t=>t.stop());context.close();});
        await api.invoke('capture:error',{source,message:'listening'});
      } catch(error) {stream?.getTracks().forEach(t=>t.stop());context?.close();if(!canceled)api.invoke('capture:error',{source,message:error.message}).catch(()=>{});}
    }
    if(mic)start('microphone');if(playback)start('playback');return()=>{canceled=true;cleanup.forEach(fn=>fn());};
  },[api,allowed,mic,playback]);
}
