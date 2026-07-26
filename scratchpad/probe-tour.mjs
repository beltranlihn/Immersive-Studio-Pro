// [R178] El recorrido guiado: el launcher manda SIEMPRE (también en el primer arranque) y el tour sale al crear
// el primer proyecto de cada formato, con textos propios de ese formato.
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

// primer arranque de verdad: sin ninguna bandera
await evl(`(()=>{ try{ localStorage.removeItem('dspOnboardV1'); ['dome','flat','room'].forEach(f=>localStorage.removeItem('dspTour_'+f)); }catch(e){} return 1; })()`);
await send('Page.reload', { ignoreCache: true }); await wait(3200);
for (let i = 0; i < 80; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await wait(1200);
console.log('primer arranque:', JSON.stringify(await evl(`({ launcher:!!document.getElementById('landingOv'), tour:!!document.getElementById('tourOv') })`)));

// crear un proyecto DOMO desde el launcher, como haría el usuario
console.log('crear domo   :', JSON.stringify(await evl(`(async()=>{
  _lch.ptype='dome'; _lch.pname='Prueba domo';
  lchCreate(); await new Promise(r=>setTimeout(r,2200));
  const ov=document.getElementById('tourOv');
  const txt=ov?(ov.textContent||'').replace(/\\s+/g,' ').trim():'';
  return { tourVisible:!!ov, launcherFuera:!document.getElementById('landingOv'),
    mencionaDomo:/domo|dome|fisheye/i.test(txt), primeros80:txt.slice(0,80) }; })()`), null, 1));

// avanzar hasta el final y comprobar el texto del VISOR, que es el que más cambia por formato
console.log('paso visor   :', JSON.stringify(await evl(`(()=>{ const ov=document.getElementById('tourOv'); if(!ov)return {sinTour:true};
  const bs=[...ov.querySelectorAll('button')]; const sig=bs.find(b=>/next|siguiente/i.test(b.textContent||''));
  if(sig)sig.click();
  const t=(ov.textContent||'').replace(/\\s+/g,' ').trim();
  return { texto:t.slice(0,150) }; })()`), null, 1));

// cerrar el tour y crear una SALA: debe salir otro tour, con texto de muros
console.log('crear sala   :', JSON.stringify(await evl(`(async()=>{
  const ov=document.getElementById('tourOv'); if(ov){ const b=[...ov.querySelectorAll('button')].find(x=>/skip|saltar|finish|terminar/i.test(x.textContent||'')); if(b)b.click(); else ov.remove(); }
  await new Promise(r=>setTimeout(r,300));
  state.dirty=false;
  _lch.ptype='room'; _lch.pname='Prueba sala';
  lchCreate(); await new Promise(r=>setTimeout(r,2600));
  const o2=document.getElementById('tourOv'); const txt=o2?(o2.textContent||'').replace(/\\s+/g,' ').trim():'';
  return { tourVisible:!!o2, mencionaMuros:/muro|wall|tira|strip/i.test(txt), primeros90:txt.slice(0,90) }; })()`), null, 1));

// y que NO se repita: el domo ya está marcado
console.log('no repite    :', JSON.stringify(await evl(`(async()=>{
  const ov=document.getElementById('tourOv'); if(ov)ov.remove();
  try{ localStorage.setItem('dspTour_dome','1'); }catch(e){}
  state.dirty=false; _lch.ptype='dome'; lchCreate(); await new Promise(r=>setTimeout(r,1800));
  return { tourOtraVez:!!document.getElementById('tourOv') }; })()`)));
await wait(300);
console.log('errores:', errs.length ? errs : 'ninguno');
ws.close();
