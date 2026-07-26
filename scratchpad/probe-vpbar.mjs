// R174 · La barra del visor, botón por botón, en los tres estados (2D · 3D Orbit · 3D Viewer).
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
await send('Page.reload', { ignoreCache: true }); await wait(2500);
for (let i = 0; i < 80; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await evl(`(()=>{try{localStorage.setItem('dspOnboardV1','1')}catch(e){}document.querySelectorAll('.overlay,#tourOv,#landingOv').forEach(o=>o.remove());document.body.classList.remove('preboot');try{resize()}catch(e){}return 1})()`);
await evl(`(async()=>{state.dirty=false;await buildDemoProject();return 1})()`); await wait(800);

const LEER = `(()=>{ const vp=document.querySelector('.vptool');
  const vis=el=>!!(el&&el.getBoundingClientRect().width>0);
  const piezas=[];
  for(const c of vp.children){ if(!vis(c))continue;
    const bs=[...c.querySelectorAll('button')].filter(vis);
    if(bs.length) piezas.push(bs.map(b=>(b.textContent||'').replace(/\\s+/g,' ').trim()||'(icono)').join('|'));
    else { const t=(c.textContent||'').replace(/\\s+/g,' ').trim(); if(t)piezas.push('['+t+']'); }
  }
  const ovl=[...document.querySelectorAll('#dispSeg button')].filter(vis);
  return { barra:piezas,
    superposiciones:ovl.map(b=>b.dataset.d),
    conTextoVisible:ovl.filter(b=>{const s=b.querySelector('.vlbl');return s&&getComputedStyle(s).display!=='none';}).length,
    haySafe:!!document.querySelector('#dispSeg button[data-d=safe]'),
    dist:vis(document.getElementById('distCtl')), dolly:vis(document.getElementById('dollyCtl')), fov:vis(document.getElementById('fovCtl')),
    more:vis(document.getElementById('vpMoreBtn')) }; })()`;

for (const [nom, montar] of [
  ['2D        ', `state.view.mode='2d';`],
  ['3D Orbit  ', `state.view.mode='3d'; state.view.three='orbit';`],
  ['3D Viewer ', `state.view.mode='3d'; state.view.three='spec';`],
]) {
  await evl(`(()=>{ ${montar} try{updModeUI();}catch(e){} try{updViewCtl();}catch(e){} render(); return 1; })()`);
  await wait(500);
  const r = await evl(LEER);
  console.log('— ' + nom + ' —');
  console.log('   barra: ' + (r.barra || []).join('  ·  '));
  console.log('   superposiciones: ' + (r.superposiciones || []).join(',') + '  · con texto: ' + r.conTextoVisible + '  · Safe existe: ' + r.haySafe);
  console.log('   DIST=' + r.dist + '  DOLLY=' + r.dolly + '  FOV=' + r.fov + '  More=' + r.more);
}
await wait(300);
console.log('errores:', errs.length ? errs : 'ninguno');
ws.close();
