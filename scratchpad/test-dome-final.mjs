// Verificación FINAL del caso domo (el de Beltrán) con todos los arreglos del review puestos.
import { targets } from './cdp.mjs';
const wait = ms => new Promise(r => setTimeout(r, ms));
let idx = null;
for (let i = 0; i < 300; i++) { const l = await targets(9222).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(150); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws')); });
let _id = 0;
const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
const errs = []; await send('Runtime.enable', {});
ws.addEventListener('message', ev => { const x = JSON.parse(ev.data); if (x.method === 'Runtime.exceptionThrown') errs.push(((x.params.exceptionDetails.exception || {}).description || '').slice(0, 150)); });
const evl = async (e, t = 900000) => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, timeout: t }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 300) }; return r.result.value; };
for (let i = 0; i < 90; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await wait(1300);
const SRC = 'C:\\\\Users\\\\beltr\\\\Desktop\\\\Rito Movie\\\\Asset\\\\Creation\\\\';
const OUT = 'C:\\\\Users\\\\beltr\\\\AppData\\\\Local\\\\Temp\\\\claude\\\\dome-final';

console.log('montaje domo 4096² con nest de 6 clips:', JSON.stringify(await evl(`(async()=>{
  const ov=document.getElementById('landingOv'); if(ov)ov.remove(); const t=document.getElementById('tourOv'); if(t)t.remove();
  const as=activeSeq(); as.w=4096; as.h=4096; as.fps=60; state.fps=60; state.seqW=4096; state.seqH=4096; state.seqMode='dome';
  await DSP.ensureDir('${OUT}'); currentPath='${OUT}\\\\d.isp';
  const meds=[]; for(const n of ['Front1','Front2','Front3']){ const m=await addVideoFromPath('${SRC}'+n+'.mp4',n); if(m)meds.push(m); }
  if(meds.length<3)return{error:'sin videos'};
  const nl=[],ncl=[];
  for(let i=0;i<6;i++){ nl.push({id:uid(),name:'V'+(i+1),tag:'V'+(i+1),kind:'video'});
    const c=makeClip(meds[i%3],i,0); c.start=0;c.dur=2;c.inP=3+i*0.4; c.props.az=i*60; c.props.el=28; c.props.size=42; ncl.push(c); }
  const nest={id:uid(),name:'Compose Domo',kind:'nest',w:4096,h:4096,dur:2,fps:60,mode:'dome',nestClips:ncl,nestLanes:nl,nestMarkers:[],nestGroups:[],tex:newTex(),thumb:null,color:clipColorFor('nest'),folder:null};
  state.media.push(nest); adopt(nest);
  state.clips=[]; const nc=makeClip(nest,0,0); nc.start=0;nc.dur=2;nc.inP=0; state.clips.push(nc);
  window._N=nest.id; state.playhead=1.0; renderMedia(); renderTimeline(); render();
  return {seq:state.seqW+'x'+state.seqH, nestCuadrado:nest.w===nest.h, clipsDentro:ncl.length}; })()`), null, 1));

const shot = `(async()=>{ await scrubRender(); await new Promise(r=>setTimeout(r,800));
  const c=document.createElement('canvas'); c.width=72;c.height=72; const x=c.getContext('2d',{willReadFrequently:true});
  x.drawImage(glc,0,0,72,72); const d=x.getImageData(0,0,72,72).data;
  const px=[]; for(let i=0;i<d.length;i+=4)px.push(d[i],d[i+1],d[i+2]); return px.join(','); })()`;
const bench = `(async()=>{ const t0=performance.now(); const N=20;
  for(let i=0;i<N;i++){ state.playhead=0.1+i*0.08;
    await Promise.all(collectDrawnVideoClips(state.clips,state.lanes,state.playhead,0,[]).map(({c,m,local})=>vinstSeek(c,m,local)));
    prepNests(state.clips,state.playhead,0);
    gl.bindFramebuffer(gl.FRAMEBUFFER,compFBO); composite(state.playhead,compSize,false); gl.bindFramebuffer(gl.FRAMEBUFFER,null); }
  gl.finish(); const ms=performance.now()-t0;
  return JSON.stringify({fps:+(N/(ms/1000)).toFixed(1), decodificadores:collectDrawnVideoClips(state.clips,state.lanes,1.0,0,[]).length}); })()`;

console.log('\nreferencia sin cache...');
const ref = await evl(`(async()=>{ state.view.useNestCache=false; state.playhead=1.0; return await (${shot}); })()`);
console.log('velocidad SIN cache:', await evl(`(async()=>{ state.view.useNestCache=false; return await (${bench}); })()`));

console.log('\ngenerando...');
await evl(`(()=>{ window._P=ncBuild(mediaById(window._N)); return true; })()`);
for (let i = 0; i < 60; i++) { if (await evl(`!!document.getElementById('ncGo')`)) break; await wait(300); }
await evl(`document.getElementById('ncGo').click()`);
for (let i = 0; i < 40; i++) { if (await evl(`!!document.getElementById('ripPv')`)) break; await wait(250); }
for (let i = 0; i < 200; i++) { if (!(await evl(`!!document.getElementById('ripPv')`))) break; await wait(1500); }
for (let i = 0; i < 40; i++) { if (await evl(`(()=>{const m=mediaById(window._N);return !!m.ncReady;})()`)) break; await wait(700); }
console.log('cache:', JSON.stringify(await evl(`(()=>{const m=mediaById(window._N);return {listo:!!m.ncReady,rancio:!!m.ncStale,dim:m.ncW+'x'+m.ncH};})()`)));

console.log('\nvelocidad CON cache:', await evl(`(async()=>{ state.view.useNestCache=true; state.playhead=1.0; await scrubRender(); await new Promise(r=>setTimeout(r,1500)); return await (${bench}); })()`));
const con = await evl(`(async()=>{ state.view.useNestCache=true; state.playhead=1.0; return await (${shot}); })()`);

if (typeof ref !== 'string' || typeof con !== 'string') { console.log('ROTO', JSON.stringify({ ref, con }).slice(0, 250)); }
else {
  const A = ref.split(',').map(Number), B = con.split(',').map(Number);
  let se = 0, mx = 0; for (let i = 0; i < A.length; i++) { const e = A[i] - B[i]; se += e * e; if (Math.abs(e) > mx) mx = Math.abs(e); }
  const mse = se / A.length, psnr = mse > 0 ? (10 * Math.log10(65025 / mse)).toFixed(1) : 'INF';
  const cm = a => { let sx = 0, sy = 0, s = 0; for (let y = 0; y < 72; y++) for (let x = 0; x < 72; x++) { const i = (y * 72 + x) * 3; const v = a[i] + a[i + 1] + a[i + 2]; sx += x * v; sy += y * v; s += v; } return s > 0 ? [+(sx / s).toFixed(2), +(sy / s).toFixed(2)] : [0, 0]; };
  const a = cm(A), b = cm(B);
  console.log('\nENCUADRE:', JSON.stringify({ psnr, errorMax: mx, centroSinCache: a, centroConCache: b,
    desplazamiento: [+(b[0] - a[0]).toFixed(2), +(b[1] - a[1]).toFixed(2)],
    veredicto: (Math.abs(b[0] - a[0]) < 1 && Math.abs(b[1] - a[1]) < 1) ? 'ENCUADRE IGUAL - OK' : 'DESAJUSTE' }, null, 1));
}

console.log('\nexport vuelve a las fuentes:', await evl(`(()=>{
  const m=mediaById(window._N); const c=state.clips.find(x=>x.mediaId===m.id);
  const prev={usable:ncUsable(m),decod:collectDrawnVideoClips(state.clips,state.lanes,1.0,0,[]).length};
  _exportQuality=true;
  const exp={usable:ncUsable(m),url:_vinstUrl(m),decod:collectDrawnVideoClips(state.clips,state.lanes,1.0,0,[]).length};
  _exportQuality=false;
  const back={usable:ncUsable(m),decod:collectDrawnVideoClips(state.clips,state.lanes,1.0,0,[]).length};
  return JSON.stringify({prev,exp,back,veredicto:(prev.usable&&prev.decod===1&&!exp.usable&&exp.url===null&&exp.decod===6&&back.usable&&back.decod===1)?'CORRECTO':'REVISAR'}); })()`));

console.log('\nnest 16:9 se rechaza con aviso:', await evl(`(async()=>{
  const m=mediaById(window._N); const w=m.w,h=m.h; m.w=1920; m.h=1080;
  ncBuild(m); await new Promise(r=>setTimeout(r,700));
  const ov=[...document.querySelectorAll('.overlay')].map(o=>(o.textContent||'').replace(/\\s+/g,' ')).join(' ');
  [...document.querySelectorAll('.overlay')].forEach(o=>o.remove()); m.w=w; m.h=h;
  return JSON.stringify({aviso:ov.slice(0,130), correcto:/square compositions|composiciones cuadradas/.test(ov)}); })()`));

console.log('\nerrores:', errs.length ? errs.slice(0, 6) : 'ninguno');
ws.close();
