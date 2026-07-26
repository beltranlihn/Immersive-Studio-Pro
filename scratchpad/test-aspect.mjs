// ¿Encuadra IGUAL un nest 16:9 con el caché puesto que recompuesto desde las fuentes?
import { targets } from './cdp.mjs';
const wait = ms => new Promise(r => setTimeout(r, ms));
let idx = null;
for (let i = 0; i < 300; i++) { const l = await targets(9222).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(150); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws')); });
let _id = 0;
const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
const errs = []; await send('Runtime.enable', {});
ws.addEventListener('message', ev => { const x = JSON.parse(ev.data); if (x.method === 'Runtime.exceptionThrown') errs.push(((x.params.exceptionDetails.exception||{}).description || '').slice(0, 180)); });
const evl = async (e, t = 900000) => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, timeout: t }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 300) }; return r.result.value; };
for (let i = 0; i < 90; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await wait(1200);

const SRC = 'C:\\\\Users\\\\beltr\\\\Desktop\\\\Rito Movie\\\\Asset\\\\Creation\\\\Front1.mp4';
const OUT = 'C:\\\\Users\\\\beltr\\\\AppData\\\\Local\\\\Temp\\\\claude\\\\asp-test';

console.log('montaje 2D 1920×1080 con nest 16:9:', JSON.stringify(await evl(`(async()=>{
  const ov=document.getElementById('landingOv'); if(ov)ov.remove(); const t=document.getElementById('tourOv'); if(t)t.remove();
  const as=activeSeq(); as.w=1920; as.h=1080; as.fps=30; state.fps=30; state.seqW=1920; state.seqH=1080; state.seqMode='flat';
  await DSP.ensureDir('${OUT}'); currentPath='${OUT}\\\\a.isp';
  const src=await addVideoFromPath('${SRC}','Front1'); if(!src)return{error:'sin vídeo'};
  const nl=[{id:uid(),name:'V1',tag:'V1',kind:'video'}];
  const c1=makeClip(src,0,0); c1.start=0; c1.dur=1.0; c1.inP=4; c1.props.x=-18; c1.props.y=9; c1.props.scale=52; // descentrado a propósito: un desajuste de encuadre saltaría a la vista
  const nest={id:uid(),name:'N169',kind:'nest',w:1920,h:1080,dur:1.0,fps:30,mode:'flat',nestClips:[c1],nestLanes:nl,nestMarkers:[],nestGroups:[],tex:newTex(),thumb:null,color:clipColorFor('nest'),folder:null};
  state.media.push(nest); adopt(nest);
  state.clips=[]; const nc=makeClip(nest,0,0); nc.start=0; nc.dur=1.0; nc.inP=0; state.clips.push(nc);
  window._N=nest.id; state.playhead=0.5;
  renderMedia(); renderTimeline(); render(); return {seq:state.seqW+'x'+state.seqH, nest:nest.w+'x'+nest.h, flat:isFlat()}; })()`), null, 1));

const shot = `(async()=>{ await scrubRender(); await new Promise(r=>setTimeout(r,700));
  const c=document.createElement('canvas'); c.width=96; c.height=54; const x=c.getContext('2d',{willReadFrequently:true});
  x.drawImage(glc,0,0,96,54); const d=x.getImageData(0,0,96,54).data;
  const px=[]; for(let i=0;i<d.length;i+=4)px.push(d[i],d[i+1],d[i+2]);
  return px.join(','); })()`;

console.log('\nreferencia (sin caché, recompuesto desde la fuente)…');
const ref = await evl(`(async()=>{ state.view.useNestCache=false; return await (${shot}); })()`);

console.log('generando el caché…');
await evl(`(()=>{ window._P=ncBuild(mediaById(window._N)); return true; })()`);
for (let i = 0; i < 60; i++) { if (await evl(`!!document.getElementById('ncGo')`)) break; await wait(300); }
await evl(`document.getElementById('ncGo').click()`);
for (let i = 0; i < 40; i++) { if (await evl(`!!document.getElementById('ripPv')`)) break; await wait(250); }
for (let i = 0; i < 160; i++) { if (!(await evl(`!!document.getElementById('ripPv')`))) break; await wait(1200); }
await wait(3000);
console.log('cache:', JSON.stringify(await evl(`(()=>{const m=mediaById(window._N);return {listo:!!m.ncReady,rancio:!!m.ncStale,dim:m.ncW+'x'+m.ncH};})()`)));

console.log('\ncon el caché…');
const con = await evl(`(async()=>{ state.view.useNestCache=true; return await (${shot}); })()`);

if (typeof ref !== 'string' || typeof con !== 'string') { console.log('ROTO', JSON.stringify({ref, con}).slice(0, 300)); }
else {
  const A = ref.split(',').map(Number), B = con.split(',').map(Number);
  let se = 0, mx = 0; for (let i = 0; i < A.length; i++) { const e = A[i] - B[i]; se += e * e; if (Math.abs(e) > mx) mx = Math.abs(e); }
  const mse = se / A.length, psnr = mse > 0 ? (10 * Math.log10(65025 / mse)).toFixed(1) : 'INF';
  // centro de masa del brillo: si el encuadre se desplazara, esto se movería mucho
  const cm = arr => { let sx=0,sy=0,s=0; for(let y=0;y<54;y++)for(let x=0;x<96;x++){ const i=(y*96+x)*3; const v=arr[i]+arr[i+1]+arr[i+2]; sx+=x*v; sy+=y*v; s+=v; } return s>0?[+(sx/s).toFixed(2),+(sy/s).toFixed(2)]:[0,0]; };
  const a = cm(A), b = cm(B);
  console.log(JSON.stringify({ psnr, errorMax: mx, centroSinCache: a, centroConCache: b,
    desplazamiento: [+(b[0]-a[0]).toFixed(2), +(b[1]-a[1]).toFixed(2)],
    veredicto: (Math.abs(b[0]-a[0]) < 1 && Math.abs(b[1]-a[1]) < 1) ? 'ENCUADRE IGUAL (las diferencias son de compresión)' : 'DESAJUSTE DE ENCUADRE — hay que corregir' }, null, 1));
}
console.log('errores:', errs.length ? errs.slice(0,5) : 'ninguno');
ws.close();
