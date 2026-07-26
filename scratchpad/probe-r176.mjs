// R176 · los tres ajustes: puntos de la barra vertical que redimensionan, sin 0/100 en automatización.
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
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 300) }; return r.result.value; };
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false, screenWidth: 1600, screenHeight: 900 });
await send('Page.reload', { ignoreCache: true }); await wait(2600);
for (let i = 0; i < 80; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await evl(`(()=>{try{localStorage.setItem('dspOnboardV1','1')}catch(e){}document.querySelectorAll('.overlay,#tourOv,#landingOv').forEach(o=>o.remove());document.body.classList.remove('preboot');try{resize()}catch(e){}return 1})()`);
await evl(`(async()=>{state.dirty=false;await buildDemoProject();return 1})()`); await wait(900);

// ── 3 · los puntos de la barra vertical existen y REDIMENSIONAN
console.log('puntos  ', JSON.stringify(await evl(`(()=>{
  const caps=[...document.querySelectorAll('#tlVZoom .tlvzcap')];
  return { cuantos:caps.length, lados:caps.map(c=>c.dataset.vcap).join(','),
    visibles:caps.filter(c=>c.getBoundingClientRect().width>0).length }; })()`)));

const capPos = await evl(`(()=>{const c=document.querySelector('#tlVZoom .tlvzcap.b'); if(!c)return null; const r=c.getBoundingClientRect(); return {x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2)};})()`);
if (capPos) {
  const antes = await evl(`state.lanes.map((l,i)=>laneH(i))`);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: capPos.x, y: capPos.y, button: 'left', clickCount: 1 });
  for (let k = 1; k <= 8; k++) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: capPos.x, y: capPos.y + k * 9, button: 'left' }); await wait(35); }
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: capPos.x, y: capPos.y + 72, button: 'left', clickCount: 1 });
  await wait(400);
  const despues = await evl(`state.lanes.map((l,i)=>laneH(i))`);
  const cambio = JSON.stringify(antes) !== JSON.stringify(despues);
  console.log('arrastre', JSON.stringify({ antes, despues, redimensiona: cambio ? '✓ sí' : '✗ NO' }));
} else console.log('arrastre  no encontré el punto inferior');

// ── 2 · en automatización no debe quedar el 0/100 en el clip
console.log('0 y 100 ', JSON.stringify(await evl(`(async()=>{
  const c=state.clips.find(x=>{const m=mediaById(x.mediaId);return m&&m.kind==='shape';});
  state.selIds=[c.id]; state.selId=c.id;
  c.kf.opacity=[{t:0,v:0,e:'inout'},{t:Math.max(0.5,c.dur/2),v:100,e:'inout'}];
  const b=document.getElementById('curvesBtn'); if(b&&!state.inlineCurves)b.click();
  renderTimeline(); await new Promise(r=>setTimeout(r,700));
  // leer los lienzos de curva y buscar píxeles de texto en la columna izquierda (donde iban los rótulos)
  const cvs=[...document.querySelectorAll('canvas')].filter(x=>x.width>40&&x.height>20&&x.closest('.clip'));
  let conTexto=0;
  for(const cv of cvs){ const g=cv.getContext('2d'); if(!g)continue;
    const d=g.getImageData(0,0,Math.min(46,cv.width),cv.height).data; let n=0;
    for(let k=3;k<d.length;k+=4) if(d[k]>40) n++;
    // el rótulo del parámetro sigue arriba; se mira sólo la franja BAJA, donde iba el mínimo
    const dz=g.getImageData(0,Math.max(0,cv.height-14),Math.min(46,cv.width),14).data; let nz=0;
    for(let k=3;k<dz.length;k+=4) if(dz[k]>40) nz++;
    if(nz>25) conTexto++; }
  return { lienzosDeCurva:cvs.length, conNumeroAbajo:conTexto,
    veredicto: conTexto? '✗ sigue habiendo algo abajo a la izquierda' : '✓ sin el 0 abajo' }; })()`)));
await wait(300);
console.log('errores:', errs.length ? errs : 'ninguno');
ws.close();
