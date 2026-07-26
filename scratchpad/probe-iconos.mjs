// ¿Qué dibuja la app HOY en los ocho sitios donde el handoff tiene un icono que el catálogo no reproduce?
import { targets } from './cdp.mjs';
const wait = ms => new Promise(r => setTimeout(r, ms));
let idx = null;
for (let i = 0; i < 120; i++) { const l = await targets(9222).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(150); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws')); });
let _id = 0;
const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300)); return r.result.value; };
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false, screenWidth: 1600, screenHeight: 900 });
await send('Page.reload', { ignoreCache: true }); await wait(2000);
for (let i = 0; i < 60; i++) { try { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")')) break; } catch (e) {} await wait(400); }
await evl(`(()=>{ try{localStorage.setItem('dspOnboardV1','1')}catch(e){} document.querySelectorAll('.overlay,#tourOv,#landingOv').forEach(o=>o.remove()); document.body.classList.remove('preboot'); try{resize();}catch(e){} return 1; })()`);
await evl(`(async()=>{ state.dirty=false; await buildDemoProject(); return 1; })()`); await wait(800);

console.log(JSON.stringify(await evl(`(()=>{
  const geo=el=>{ const sv=el&&el.querySelector('svg'); if(!sv)return null;
    return [...sv.querySelectorAll('path,circle,rect,ellipse,line,polygon,polyline')]
      .map(n=>n.tagName.toLowerCase()+' '+(n.getAttribute('d')||[...n.attributes].filter(a=>!/^(stroke|fill)/.test(a.name)).map(a=>a.name+'="'+a.value+'"').join(' '))).join(' | ').slice(0,110); };
  const porTexto=(raiz,txt)=>[...document.querySelectorAll(raiz)].find(b=>(b.textContent||'').trim().toLowerCase().startsWith(txt));
  const R={};
  R['2·hamburguesa (menú de Media)']   = geo(document.querySelector('#mediaMenuBtn,#mediaMore,[data-m=mediaMenu]'))||'no existe ese botón';
  R['3·vista de rejilla (Media)']      = geo(document.querySelector('#mediaViewBtn,#mediaGridBtn,[data-mv],[data-m=view]'))||'no existe ese botón';
  R['8·ordenar (Media)']               = geo(document.querySelector('#mediaSortBtn,#sortBtn,[data-m=sort]'))||'no existe ese botón';
  R['11·Text (barra lateral)']         = geo(porTexto('button,.sbtn,.sideb','text'))||'no encontrado';
  R['12·Shape (barra lateral)']        = geo(porTexto('button,.sbtn,.sideb','shape'))||'no encontrado';
  R['15·chevron derecha (sección plegada)'] = geo(document.querySelector('.sec.col .t, .sec .caret, .seccar'))||'no encontrado';
  R['21·Alpha (barra del visor)']      = geo(porTexto('button','alpha'))||'no encontrado';
  R['49·Fit (barra del visor)']        = geo(porTexto('button','fit'))||'no encontrado';
  // por si acaso: todos los botones de la barra lateral de medios y de la barra del visor, con su rótulo
  R['_barraLateral'] = [...document.querySelectorAll('#mediaSide button, .mediaside button, #mediaPane .sbtn')].map(b=>(b.textContent||'').trim().slice(0,10)).filter(Boolean).slice(0,12);
  R['_barraVisor']   = [...document.querySelectorAll('#viewCtl button')].map(b=>(b.textContent||'').trim().slice(0,10)).filter(Boolean).slice(0,20);
  return R; })()`), null, 2));
ws.close();
