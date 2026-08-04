// Reproduce EXACTAMENTE la secuencia de aud8b-fixture-arreglo (fix+save+reopen) y diagnostica el porque del 0.
import { evalInApp } from './cdp.mjs';
const DIR = String.raw`C:\Users\beltr\Desktop\Alma Digital Studio\Projects\Immersive Studio Pro\scratchpad`;
const ISP = (DIR + '\\aud8b-viejo.isp').replace(/\\/g, '\\\\');
const ev = (x, t) => evalInApp(x, { port: 9223, timeout: t || 120000 });

const fix = await ev(`(async function(){
  state.dirty=false; await openProjectPath('${ISP}',true);
  const t0=Date.now(); while(Date.now()-t0<25000){ await new Promise(r=>setTimeout(r,250)); if(state.media.filter(m=>!isSeqMedia(m)).every(m=>!m._loading&&!m.missing))break; }
  const f=state.media.find(m=>m.name==='Flat2D');
  const vi=f.nestLanes.findIndex(l=>l.kind==='video');
  for(const c of f.nestClips) c.lane=vi;
  saveActiveSeq(); const ok=await DSP.writeText('${ISP}', JSON.stringify(serProject()));
  return {ok:ok!==false, act:activeSeq()&&activeSeq().name};
})()`, 60000);
console.log('fix:', JSON.stringify(fix));

const diag = await ev(`(async function(){
  state.dirty=false; await openProjectPath('${ISP}',true);
  const t0=Date.now(); while(Date.now()-t0<25000){ await new Promise(r=>setTimeout(r,250)); if(state.media.filter(m=>!isSeqMedia(m)).every(m=>!m._loading&&!m.missing))break; }
  await new Promise(r=>setTimeout(r,1200));
  const R={act:activeSeq()&&activeSeq().name, overlays:[...document.querySelectorAll('.overlay')].map(o=>o.id||o.className),
    clips:state.clips.length, ph0:state.playhead,
    vis:state.clips.filter(c=>101.3>=c.start&&101.3<c.start+c.dur).map(c=>c.name+'/'+c.lane)};
  const o=await __pix([101.3]); R.pix=o['t101.3'];
  R.vis2=state.clips.filter(c=>101.3>=c.start&&101.3<c.start+c.dur).map(c=>c.name+'/'+c.lane+'/'+(state.lanes[c.lane]&&state.lanes[c.lane].kind));
  R.lanes=state.lanes.map(l=>l.tag||l.kind);
  return R;
})()`, 120000);
console.log('diag:', JSON.stringify(diag, null, 1));
