// [R170] Clips enlazados A/V, con un vídeo REAL con sonido. Se comprueba el ciclo completo que pidió Beltrán:
// soltar → aparece la mitad de audio en la pista más cercana → mover arrastra las dos → cortar parte las dos →
// clic derecho desenlaza → y el sonido no se duplica ni se pierde.
import { targets } from './cdp.mjs';
const wait = ms => new Promise(r => setTimeout(r, ms));
let idx = null;
for (let i = 0; i < 150; i++) { const l = await targets(9222).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(200); }
if (!idx) { console.log('sin editor'); process.exit(1); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws')); });
let _id = 0;
const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
const errs = []; await send('Runtime.enable', {});
ws.addEventListener('message', ev => { const x = JSON.parse(ev.data); if (x.method === 'Runtime.consoleAPICalled' && x.params.type === 'error') errs.push((x.params.args || []).map(a => a.value || a.description || '').join(' ').slice(0, 220)); });
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 400) }; return r.result.value; };
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false, screenWidth: 1600, screenHeight: 900 });
await send('Page.reload', { ignoreCache: true }); await wait(2400);
for (let i = 0; i < 80; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await evl(`(()=>{try{localStorage.setItem('dspOnboardV1','1')}catch(e){}document.querySelectorAll('.overlay,#tourOv,#landingOv').forEach(o=>o.remove());document.body.classList.remove('preboot');try{resize()}catch(e){}return 1})()`);
await evl(`(async()=>{state.dirty=false;await buildDemoProject();state.clips.length=0;render();return 1})()`); await wait(600);

const RUTA = 'C:\\\\Users\\\\beltr\\\\Desktop\\\\Alma Digital Studio\\\\Projects\\\\VR Unreal\\\\Recursos\\\\Asset\\\\Calibration\\\\Inhaling-exhaling.mp4';
console.log('1 · soltar el vídeo', JSON.stringify(await evl(`(async()=>{
  const url=DSP.toFileURL('${RUTA}');
  const v=document.createElement('video'); v.src=url; v.muted=true; v.preload='auto';
  await new Promise(r=>{ v.addEventListener('loadedmetadata',r,{once:true}); setTimeout(r,6000); });
  const m={id:uid(),name:'Inhaling-exhaling.mp4',kind:'video',el:v,originalEl:v,srcUrl:url,tex:newTex(),
    w:v.videoWidth,h:v.videoHeight,dur:v.duration,fps:30,thumb:null,color:clipColorFor('video'),
    proxyReady:false,proxyPct:0,path:'${RUTA}',fsize:0,folder:null,missing:false,_loading:false};
  state.media.push(m);
  const li=state.lanes.map((l,i)=>i).filter(i=>state.lanes[i].kind!=='audio')[0];
  addClip(m,li,0); const c=state.clips[state.clips.length-1]; // addClip no retorna el clip
  for(let i=0;i<200;i++){ if(c&&c.link) break; await new Promise(r=>setTimeout(r,150)); }
  const p=c?linkPartner(c):null;
  return { duracion:+m.dur.toFixed(2), clipVideo:!!c, enlazado:!!(c&&c.link), rolVideo:c&&c.avRole,
    mitadAudio:!!p, rolAudio:p&&p.avRole, pistaAudio:p&&state.lanes[p.lane].tag,
    mismoInicio:!!(p&&Math.abs(p.start-c.start)<1e-6), mismaDuracion:!!(p&&Math.abs(p.dur-c.dur)<1e-6),
    tieneOnda:!!(m.peaks&&m.peaks.length) }; })()`), null, 1));

console.log('2 · mover      ', JSON.stringify(await evl(`(()=>{
  const c=state.clips.find(x=>x.avRole==='v'); const p=linkPartner(c);
  // seleccionar la mitad de VÍDEO debe meter la de audio en la selección
  state.selIds=linkedIds([c.id]);
  const antes={v:c.start,a:p.start};
  for(const sid of state.selIds){ const s=clipById(sid); s.start+=3; }   // lo que hace el arrastre multi-clip
  renderTimeline();
  return { seleccionArrastraPareja:state.selIds.length===2, antes, ahora:{v:c.start,a:p.start},
    siguenAlineados:Math.abs(c.start-p.start)<1e-6 }; })()`)));

console.log('3 · sonido     ', JSON.stringify(await evl(`(()=>{
  const ev=collectAudioEvents(state.clips,state.lanes,0,0,Infinity,0,[]);
  const c=state.clips.find(x=>x.avRole==='v'), p=linkPartner(c);
  return { eventosDeAudio:ev.length,
    laMitadDeVideoNoAporta:!ev.some(e=>e.id===c.id),
    laMitadDeAudioSiAporta:ev.some(e=>e.id===p.id) }; })()`)));

console.log('4 · cortar     ', JSON.stringify(await evl(`(()=>{
  const c=state.clips.find(x=>x.avRole==='v'); const t=c.start+c.dur/2; const n0=state.clips.length;
  razorClip(c,t);
  const trozos=state.clips.filter(x=>x.link);
  const pares={}; for(const x of trozos)(pares[x.link]=pares[x.link]||[]).push(x.avRole);
  return { clipsAntes:n0, clipsAhora:state.clips.length,
    paresResultantes:Object.values(pares).map(a=>a.sort().join('+')),
    cadaParEsVmasA:Object.values(pares).every(a=>a.length===2&&a.includes('v')&&a.includes('a')) }; })()`)));

console.log('5 · desenlazar ', JSON.stringify(await evl(`(()=>{
  const c=state.clips.find(x=>x.avRole==='v'); const p=linkPartner(c);
  unlinkClip(c);
  const ev=collectAudioEvents(state.clips,state.lanes,0,0,Infinity,0,[]);
  return { videoSinEnlace:!c.link&&!c.avRole, audioSinEnlace:!p.link&&!p.avRole,
    elAudioSigueSonando:ev.some(e=>e.id===p.id),
    seleccionYaNoArrastra:linkedIds([c.id]).length===1 }; })()`)));

console.log('6 · guardar    ', JSON.stringify(await evl(`(async()=>{
  const c=state.clips.find(x=>x.link); if(!c) return {sinParesQueGuardar:true};
  const j=JSON.stringify(serProject()); loadProject(JSON.parse(j)); await new Promise(r=>setTimeout(r,700));
  const v=state.clips.find(x=>x.avRole==='v');
  return { sobreviveElEnlace:!!(v&&v.link&&linkPartner(v)), rol:v&&v.avRole }; })()`)));
await wait(400);
console.log('errores:', errs.length ? errs : 'ninguno');
ws.close();
