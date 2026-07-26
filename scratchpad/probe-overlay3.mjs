// El TERCER hueco de superposición por formato: rótulo, tooltip y que su dibujo aparezca de verdad en el lienzo.
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
await send('Page.reload', { ignoreCache: true }); await wait(2400);
for (let i = 0; i < 80; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await evl(`(()=>{try{localStorage.setItem('dspOnboardV1','1')}catch(e){}document.querySelectorAll('.overlay,#tourOv,#landingOv').forEach(o=>o.remove());document.body.classList.remove('preboot');try{resize()}catch(e){}return 1})()`);
await evl(`(async()=>{state.dirty=false;await buildDemoProject();return 1})()`); await wait(700);

// tinta del lienzo de superposición (#grid), que es donde se pintan guías y costuras
const TINTA = `(()=>{ const c=document.getElementById('grid'); const x=c.getContext('2d');
  const d=x.getImageData(0,0,c.width,c.height).data; let n=0; for(let k=3;k<d.length;k+=4*7) if(d[k]>6) n++;
  return n; })()`;

for (const [nombre, montar, esperado] of [
  ['DOMO', `state.dirty=false; await newProject('dome',4096,4096,60,180);`, 'Horizon'],
  ['2D FLAT', `state.dirty=false; await newProject('flat',1920,1080,60,180);`, 'Center'],
  ['SALA 360', `state.dirty=false; await newRoomProject({fps:60, floor:null,
      walls:[{role:'Front',order:1,wcm:500,hcm:300,pxW:1920,pxH:1080},{role:'Right',order:2,wcm:400,hcm:300,pxW:1536,pxH:1080},
             {role:'Back',order:3,wcm:500,hcm:300,pxW:1920,pxH:1080},{role:'Left',order:4,wcm:400,hcm:300,pxW:1536,pxH:1080}]});`, 'Seam'],
]) {
  await evl(`(async()=>{ ${montar} try{updModeUI();}catch(e){} render(); return 1; })()`); await wait(800);
  const r = await evl(`(async()=>{
    const b=document.querySelector('#dispSeg button[data-d="hfade"]');
    if(!b) return {sinBoton:true};
    const et=(b.textContent||'').replace(/\\s+/g,' ').trim();
    // apagar todo lo demás para que la tinta medida sea SÓLO de este control
    state.view.showGrid=false; state.view.showSafe=false; state.view.showOutline=false;
    const apagado=(()=>{ if(isRoom())state.view.showSeam=false; else if(isFlat())state.view.showCenter=false; else state.view.hfade=false; render(); return 1; })();
    await new Promise(r=>setTimeout(r,250)); const sinEl=${TINTA};
    b.click(); render(); await new Promise(r=>setTimeout(r,250)); const conEl=${TINTA};
    const encendido=isRoom()?state.view.showSeam:isFlat()?state.view.showCenter:state.view.hfade;
    return { rotulo:et, tooltip:b.title, visible:b.getBoundingClientRect().width>0,
      tintaSinEl:sinEl, tintaConEl:conEl, dibujaAlgo:conEl>sinEl, estadoTrasClic:!!encendido }; })()`);
  console.log('— ' + nombre + ' (esperado: ' + esperado + ') —');
  console.log('  ' + JSON.stringify(r));
}
await wait(400);
console.log('errores:', errs.length ? errs : 'ninguno');
ws.close();
