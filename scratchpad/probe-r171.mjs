// R171 · los tres ajustes: alto del panel pegado a las pistas, audio igual que vídeo, y la fuente junto al nombre.
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
ws.addEventListener('message', ev => { const x = JSON.parse(ev.data); if (x.method === 'Runtime.consoleAPICalled' && x.params.type === 'error') errs.push((x.params.args || []).map(a => a.value || a.description || '').join(' ').slice(0, 200)); });
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 400) }; return r.result.value; };
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false, screenWidth: 1600, screenHeight: 900 });
await send('Page.reload', { ignoreCache: true }); await wait(2400);
for (let i = 0; i < 80; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await evl(`(()=>{try{localStorage.setItem('dspOnboardV1','1')}catch(e){}document.querySelectorAll('.overlay,#tourOv,#landingOv').forEach(o=>o.remove());document.body.classList.remove('preboot');try{resize()}catch(e){}return 1})()`);
await evl(`(async()=>{state.dirty=false;await buildDemoProject();return 1})()`); await wait(700);

console.log('2 · alturas ', JSON.stringify(await evl(`(()=>{
  const h=state.lanes.map((l,i)=>({pista:l.tag,alto:laneH(i)}));
  const v=h.filter(x=>/^V/.test(x.pista)).map(x=>x.alto), a=h.filter(x=>/^A/.test(x.pista)).map(x=>x.alto);
  return { alturas:h, audioIgualQueVideo: a.every(x=>v.includes(x)) }; })()`)));

console.log('1 · panel   ', JSON.stringify(await evl(`(()=>{
  const el=document.querySelector('.timeline'); const antes=Math.round(el.getBoundingClientRect().height);
  const max=Math.round(tlMaxH());
  clampTimelineH();
  const ahora=Math.round(el.getBoundingClientRect().height);
  // hueco por debajo de la última pista dentro del área de scroll
  const sc=document.getElementById('tlscroll'); const tr=document.getElementById('tracks');
  const hueco=Math.round(sc.clientHeight - tr.getBoundingClientRect().height);
  return { antes, tope:max, ahora, sinExceso:ahora<=max+1, huecoBajoLaUltimaPista:hueco }; })()`)));

console.log('3 · fuente  ', JSON.stringify(await evl(`(async()=>{
  // hace falta un clip de VÍDEO para que aparezca la etiqueta
  const RUTA='C:\\\\Users\\\\beltr\\\\Desktop\\\\Alma Digital Studio\\\\Projects\\\\VR Unreal\\\\Recursos\\\\Asset\\\\Calibration\\\\Rapida.mp4';
  const url=DSP.toFileURL(RUTA);
  const v=document.createElement('video'); v.src=url; v.muted=true; v.preload='auto';
  await new Promise(r=>{ v.addEventListener('loadedmetadata',r,{once:true}); setTimeout(r,8000); });
  if(!v.videoWidth) return {noCargoElVideo:true};
  const m={id:uid(),name:'Rapida.mp4',kind:'video',el:v,originalEl:v,srcUrl:url,tex:newTex(),w:v.videoWidth,h:v.videoHeight,
    dur:v.duration,fps:30,thumb:null,color:clipColorFor('video'),proxyReady:false,proxyPct:0,path:RUTA,fsize:0,folder:null,missing:false,_loading:false};
  state.media.push(m);
  const li=state.lanes.map((l,i)=>i).filter(i=>state.lanes[i].kind!=='audio')[0];
  addClip(m,li,0); renderTimeline();
  await new Promise(r=>setTimeout(r,400));
  const cd=[...document.querySelectorAll('.clip')].find(x=>/Rapida/.test(x.textContent||''));
  if(!cd) return {sinClip:true};
  const tag=cd.querySelector('.tt .cpx'); const flotante=cd.querySelector(':scope > .cpx');
  const cs=tag?getComputedStyle(tag):null;
  return { dentroDelTitulo:!!tag, texto:tag&&tag.textContent, sigueLaChapaFlotante:!!flotante,
    color:cs&&cs.color, peso:cs&&cs.fontWeight, enMayusculas: tag? tag.textContent===tag.textContent.toUpperCase() : null }; })()`)));
await wait(400);
console.log('errores:', errs.length ? errs : 'ninguno');
ws.close();
