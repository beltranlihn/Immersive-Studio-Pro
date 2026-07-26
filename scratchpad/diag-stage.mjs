import { evalInApp } from './cdp.mjs';
const P = { port: 9222 };
const SRC = 'C:\\\\Users\\\\beltr\\\\Desktop\\\\Rito Movie\\\\Asset\\\\Creation\\\\Front1.mp4';
const OUT = 'C:\\\\Users\\\\beltr\\\\AppData\\\\Local\\\\Temp\\\\claude\\\\exp-run2';
console.log('montaje:', await evalInApp(`(async()=>{
  const ov=document.getElementById('landingOv'); if(ov)ov.remove(); const t=document.getElementById('tourOv'); if(t)t.remove();
  const as=activeSeq(); as.w=960; as.h=540; as.fps=30; state.fps=30; state.seqW=960; state.seqH=540; state.seqMode='flat';
  await DSP.ensureDir('${OUT}'); currentPath='${OUT}\\\\e.isp';
  const m=await addVideoFromPath('${SRC}','Front1'); if(!m)return'sin video';
  state.clips=[]; const c=makeClip(m,0,0); c.start=0; c.dur=1; c.inP=3; state.clips.push(c);
  state.workIn=null; state.workOut=null; renderTimeline(); render();
  DSP.saveFile=async()=>'${OUT}\\\\out.mp4';
  return 'ok'; })()`, P));

await evalInApp(`(()=>{ const o=document.getElementById('exOv'); if(o)o.remove(); openExport();
  const p=document.getElementById('exOv'); const s=p.querySelector('#exCodec'); s.value='mp4'; s.dispatchEvent(new Event('change'));
  const f=p.querySelector('#exFps'); f.value='30'; f.dispatchEvent(new Event('change')); return true; })()`, P);
// esperar a que exValidate suelte el boton (lo deshabilita mientras sondea el codec)
let listo = false;
for (let i = 0; i < 40; i++) { listo = await evalInApp(`(()=>{const b=document.getElementById('exGo');return !!b&&!b.disabled;})()`, P); if (listo) break; await new Promise(r => setTimeout(r, 400)); }
console.log('boton habilitado:', listo);
await evalInApp(`(()=>{ document.getElementById('exOv').querySelector('#exGo').click(); return true; })()`, P);

for (let i = 0; i < 20; i++) {
  await new Promise(r => setTimeout(r, 2500));
  const s = await evalInApp(`(()=>JSON.stringify({etapa:_exStage,exporting:exporting,p:_exJobs.length?+(_exJobs[_exJobs.length-1].p||0).toFixed(3):null,pct:(document.getElementById('exPct')||{}).textContent}))()`, P);
  console.log(' ', s);
  if (/"exporting":false/.test(s)) break;
}
console.log('archivo:', await evalInApp(`(async()=>{try{const st=await DSP.stat('${OUT}\\\\out.mp4');return 'MB '+(st.size/1e6).toFixed(2);}catch(e){return 'no existe';}})()`, P));
