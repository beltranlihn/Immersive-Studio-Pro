// ¿El .exe DESPLEGADO (app.asar de la instalación canónica) trae R179 + R180?
import { targets } from './cdp.mjs';
const wait = ms => new Promise(r => setTimeout(r, ms));
let idx = null;
for (let i = 0; i < 400; i++) { const l = await targets(9223).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(150); }
if (!idx) { console.log('el .exe no expuso la ventana'); process.exit(1); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws')); });
let _id = 0;
const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
const errs = []; await send('Runtime.enable', {});
ws.addEventListener('message', ev => { const x = JSON.parse(ev.data);
  if (x.method === 'Runtime.consoleAPICalled' && x.params.type === 'error') errs.push((x.params.args || []).map(a => a.value || a.description || '').join(' ').slice(0, 160));
  if (x.method === 'Runtime.exceptionThrown') errs.push('excepcion: ' + ((x.params.exceptionDetails.exception || {}).description || '').slice(0, 160)); });
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, timeout: 240000 }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 250) }; return r.result.value; };
for (let i = 0; i < 120; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await wait(1500);

console.log('R179 · render in place:', JSON.stringify(await evl(`(async()=>{
  const r={};
  r.uidFixSinTypeError = (()=>{ try{ return typeof String(uid()).padStart(4,'0')==='string'; }catch(e){ return 'ROTO '+e.message; } })();
  r.codecsNuevos = { av1:typeof pickAv1Codec==='function', vp9:typeof pickVp9Codec==='function', dispatch:typeof pickVideoCodec==='function' };
  r.visorDeAvance = typeof ripProgress==='function';
  r.colocacionNoDestructiva = typeof ripPlaceOnNewTrack==='function';
  r.opcionesA4096 = (await ripCodecOptions(4096,4096,60)).map(o=>o.kind);
  r.opcionesA1080 = (await ripCodecOptions(1920,1080,60)).map(o=>o.kind);
  return r; })()`), null, 1));

console.log('\nR180 · proxy de composicion:', JSON.stringify(await evl(`(()=>{
  const fake={kind:'nest',ncReady:true,ncUrl:'file:///x.mp4',ncStale:false};
  const b=document.querySelector('#nestCacheToggle button');
  const r={ motor:{ncUsable:typeof ncUsable==='function', nestSig:typeof nestSig==='function', ncBuild:typeof ncBuild==='function', ncReattach:typeof ncReattach==='function'},
    interruptorEnLaBarra:!!b, etiqueta:b?b.textContent.trim():null, encendidoPorDefecto:b?b.classList.contains('on'):null,
    defaultEnState:state.view.useNestCache,
    usableEnPreview:ncUsable(fake) };
  _exportQuality=true; r.usableEnExport=ncUsable(fake); _exportQuality=false;
  r.serMediaPersiste = (()=>{ const s=serMedia({id:1,kind:'nest',name:'x',ncPath:'p',ncSig:'s',ncW:2,ncH:2,ncFps:60,nestClips:[],nestLanes:[]}); return !!(s.ncPath&&s.ncSig&&s.ncW); })();
  r.guardaDeDisabledEnPrepNests = /c\\.disabled/.test(prepNests.toString());
  return r; })()`), null, 1));

console.log('\nversion:', JSON.stringify(await evl(`(()=>({ ua:(navigator.userAgent.match(/Electron\\/[0-9.]+/)||['?'])[0], titulo:document.title }))()`)));
console.log('\nerrores de consola:', errs.length ? errs.slice(0, 8) : 'ninguno');
ws.close();
