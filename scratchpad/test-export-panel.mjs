// R183 · La hoja de export: estructura, tamaño en píxeles, monitor, y las reglas condicionales.
import { targets } from './cdp.mjs';
import fs from 'fs';
const wait = ms => new Promise(r => setTimeout(r, ms));
let idx = null;
for (let i = 0; i < 300; i++) { const l = await targets(9222).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(150); }
if (!idx) { console.log('sin ventana'); process.exit(1); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws')); });
let _id = 0;
const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
const errs = []; await send('Runtime.enable', {});
ws.addEventListener('message', ev => { const x = JSON.parse(ev.data);
  if (x.method === 'Runtime.consoleAPICalled' && x.params.type === 'error') errs.push((x.params.args || []).map(a => a.value || a.description || '').join(' ').slice(0, 170));
  if (x.method === 'Runtime.exceptionThrown') errs.push('exc: ' + ((x.params.exceptionDetails.exception || {}).description || '').slice(0, 170)); });
const evl = async (e, t = 120000) => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, timeout: t }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 300) }; return r.result.value; };
for (let i = 0; i < 120; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await wait(1400);

const SRC = 'C:\\\\Users\\\\beltr\\\\Desktop\\\\Rito Movie\\\\Asset\\\\Creation\\\\Front1.mp4';

console.log('montaje domo 4096²:', JSON.stringify(await evl(`(async()=>{
  const ov=document.getElementById('landingOv'); if(ov)ov.remove(); const t=document.getElementById('tourOv'); if(t)t.remove();
  const as=activeSeq(); as.w=4096; as.h=4096; as.fps=60; state.fps=60; state.seqW=4096; state.seqH=4096; state.seqMode='dome';
  const m=await addVideoFromPath('${SRC}','Front1'); if(!m)return{error:'sin video'};
  state.clips=[]; const c=makeClip(m,0,0); c.start=0; c.dur=2; c.inP=3; state.clips.push(c);
  renderTimeline(); render(); return {clips:state.clips.length, seq:state.seqW+'x'+state.seqH}; })()`), null, 1));

await evl(`(()=>{ openExport(); return true; })()`); await wait(900);

console.log('\nestructura:', JSON.stringify(await evl(`(()=>{
  const ov=document.getElementById('exOv'); if(!ov)return{error:'no abrio'};
  const sh=ov.querySelector('.exs'); const r=sh.getBoundingClientRect();
  const g=s=>{const e=ov.querySelector(s);return e?(e.textContent||'').trim():null;};
  return { esHojaNoOverlay:!ov.classList.contains('overlay'), ancho:Math.round(r.width),
    cubreTodo:(r.width>=window.innerWidth-4), velo:getComputedStyle(ov).backgroundColor,
    cabecera:g('.exs-hd .t'), atajo:g('.exs-key'), chip:g('#exChip'),
    monitor:(()=>{const c=ov.querySelector('#exMon');return c?c.width+'x'+c.height:null;})(),
    aspectoPantalla:(()=>{const e=ov.querySelector('.exs-screen');const b=e.getBoundingClientRect();return +(b.width/b.height).toFixed(2);})(),
    proxy:g('#exProxy'), encaje:g('#exFit'), fase:g('#exPhase'), pct:g('#exPct'), sub:g('#exSub'),
    est:g('#exEst'), pie:g('#exDest'), primario:g('#exGoTxt') }; })()`), null, 1));

console.log('\ntamaño en pixeles — los tres modos:', JSON.stringify(await evl(`(()=>{
  const ov=document.getElementById('exOv'); const out={};
  const click=m=>{ov.querySelector('#exSz button[data-sz="'+m+'"]').click();};
  for(const m of ['match','preset','custom']){ click(m);
    out[m]={ hint:(ov.querySelector('#exSzCtl').textContent||'').replace(/\\s+/g,' ').trim().slice(0,60),
             est:(ov.querySelector('#exEst').textContent||'').slice(0,52),
             proxy:(ov.querySelector('#exProxy').textContent||''),
             altoDeshabilitado:(()=>{const h=ov.querySelector('#exSzH');return h?h.disabled:null;})() }; }
  click('match'); return out; })()`), null, 1));

console.log('\nfilas condicionales por codec:', JSON.stringify(await evl(`(()=>{
  const ov=document.getElementById('exOv'); const sel=ov.querySelector('#exCodec'); const out={};
  for(const c of ['png','mp4','hevc','hap','hapq','still']){ sel.value=c; sel.dispatchEvent(new Event('change'));
    out[c]={ bitrate:ov.querySelector('#exBrRow').style.display, chunks:ov.querySelector('#exChunkRow').style.display,
             est:(ov.querySelector('#exEst').textContent||'').slice(0,58) }; }
  sel.value='png'; sel.dispatchEvent(new Event('change')); return out; })()`), null, 1));

console.log('\nmonitor pintado (brillo > 0 = tiene imagen):', JSON.stringify(await evl(`(()=>{
  const c=document.getElementById('exMon'); const x=c.getContext('2d');
  const d=x.getImageData(0,0,c.width,c.height).data; let s=0,mx=0,nz=0;
  for(let i=0;i<d.length;i+=4){const v=(d[i]+d[i+1]+d[i+2])/3; s+=v; if(v>mx)mx=v; if(v>8)nz++;}
  return { medio:+(s/(c.width*c.height)).toFixed(1), max:Math.round(mx), pxConLuz:nz,
           bandasNegras:(()=>{ // en domo debe ser 1:1 centrado: columnas negras a izq y der
             let f=-1,l=-1; for(let X=0;X<c.width;X++){ let any=false; for(let Y=0;Y<c.height;Y++){const i=(Y*c.width+X)*4; if(d[i+3]>0&&(d[i]+d[i+1]+d[i+2])>10){any=true;break;}} if(any){if(f<0)f=X;l=X;} }
             return f>=0? {desde:f,hasta:l,ancho:l-f+1} : null; })() }; })()`), null, 1));

const shot = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync('scratchpad/exp-panel.png', Buffer.from(shot.data, 'base64'));
console.log('\nexp-panel.png');
console.log('\nerrores:', errs.length ? errs.slice(0, 8) : 'ninguno');
ws.close();
