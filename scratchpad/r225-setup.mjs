// [R225] Escenario base: domo, 2 vídeos con audio "real" (buffer sintético), 1 foto, pistas V1/V2/A1.
import { evalInApp } from './cdp.mjs';
const expr = `(async function(){
  window.__errs = window.__errs || [];
  if(!window.__errHook){ window.__errHook=1; window.addEventListener('error',e=>window.__errs.push(String(e.message))); window.addEventListener('unhandledrejection',e=>window.__errs.push('rej:'+String(e.reason))); }
  try{ if(typeof closeLanding==='function')closeLanding(); }catch(_){}
  document.querySelectorAll('.lch, #tourOv, .tourcard').forEach(el=>el.remove());
  state.seqMode='dome';
  state.media=(state.media||[]).filter(m=>m.kind==='nest');
  if(!Number.isFinite(uid()))_id=1000;
  for(const m of state.media) if(!Number.isFinite(m.id)) m.id=uid();
  state.openSeqs=state.media.filter(m=>m.kind==='nest').map(m=>m.id); state.activeSeqId=state.openSeqs[0];
  const seq=mediaById(state.activeSeqId); seq.mode='dome';
  // --- búfer de audio sintético para poder medir la mezcla sin archivos ---
  const ctx=ACTX(); const mkBuf=(dur,f)=>{ const b=ctx.createBuffer(1,Math.round(ctx.sampleRate*dur),ctx.sampleRate); const d=b.getChannelData(0); for(let i=0;i<d.length;i++)d[i]=0.5*Math.sin(2*Math.PI*f*i/ctx.sampleRate); return b; };
  const peaksOf=b=>{ const d=b.getChannelData(0); const N=600, out=new Float32Array(N); for(let i=0;i<N;i++){ let mx=0; const s=Math.floor(i/N*d.length), e=Math.floor((i+1)/N*d.length); for(let j=s;j<e;j++){ const v=Math.abs(d[j]); if(v>mx)mx=v; } out[i]=mx; } return out; };
  const MV1=uid(), MV2=uid(), MI1=uid(), MA1=uid();
  const b8=mkBuf(8,220), b3=mkBuf(3,440), ba=mkBuf(6,110);
  const vm1={id:MV1,kind:'video',name:'A8s.mp4',w:1920,h:1080,dur:8,fps:30,path:'C:/fake/A8s.mp4',thumb:null,proxyReady:false,buffer:b8,peaks:peaksOf(b8),rms:peaksOf(b8)};
  const vm2={id:MV2,kind:'video',name:'B3s.mp4',w:1920,h:1080,dur:3,fps:30,path:'C:/fake/B3s.mp4',thumb:null,proxyReady:false,buffer:b3,peaks:peaksOf(b3),rms:peaksOf(b3)};
  const im1={id:MI1,kind:'image',name:'Foto1.jpg',w:1600,h:900,dur:5,fps:0,path:'C:/fake/Foto1.jpg',thumb:null,proxyReady:false};
  const im2={id:uid(),kind:'image',name:'Foto2.jpg',w:1600,h:900,dur:5,fps:0,path:'C:/fake/Foto2.jpg',thumb:null,proxyReady:false};
  const am1={id:MA1,kind:'audio',name:'Music.wav',dur:6,buffer:ba,peaks:peaksOf(ba),rms:peaksOf(ba),path:'C:/fake/Music.wav'};
  state.media.push(vm1,vm2,im1,im2,am1);
  state.lanes=[{id:uid(),name:'Audio 1',tag:'A1',kind:'audio'},{id:uid(),name:'Video 1',tag:'V1',kind:'video'},{id:uid(),name:'Video 2',tag:'V2',kind:'video'}];
  state.clips=[]; state.markers=[]; state.groups=[];
  state.selId=null; state.selIds=[]; state.selLane=null; state.selMarkerId=null; state.selGroupId=null;
  state.playhead=0;
  renderMedia(); renderTimeline(); renderInspector(); render();
  return {ok:true, seq:seq.id, MV1,MV2,MI1,im2:im2.id,MA1, lanes:state.lanes.map((l,i)=>i+':'+l.kind), errs:window.__errs};
})()`;
evalInApp(expr).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error('ERR',e.message);process.exit(1);});
