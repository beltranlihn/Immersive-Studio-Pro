import { targets } from './cdp.mjs';
const wait = ms => new Promise(r => setTimeout(r, ms));
let idx = null;
for (let i = 0; i < 120; i++) { const l = await targets(9222).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(150); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws')); });
let _id = 0;
const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error('threw: ' + JSON.stringify(r.exceptionDetails).slice(0, 300)); return r.result.value; };
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false, screenWidth: 1600, screenHeight: 900 });
await send('Page.reload', { ignoreCache: true }); await wait(2000);
for (let i = 0; i < 60; i++) { try { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")')) break; } catch (e) {} await wait(400); }
await evl(`(()=>{ try{localStorage.setItem('dspOnboardV1','1')}catch(e){} document.querySelectorAll('.overlay,#tourOv,#landingOv').forEach(o=>o.remove()); document.body.classList.remove('preboot'); try{resize();}catch(e){} return 1; })()`);
await evl(`(async()=>{ state.dirty=false; await buildDemoProject(); return 1; })()`); await wait(700);

console.log('inicio         ', JSON.stringify(await evl(`({alturas:state.lanes.map((l,i)=>laneH(i)), hCrudo:state.lanes.map(l=>l.h||null), existeTlscroll:!!document.getElementById('tlscroll')})`)));

// A · evento sintético sobre #tlscroll (lo que hacía la prueba)
console.log('sintético ×5   ', JSON.stringify(await evl(`(()=>{ const el=document.getElementById('tlscroll');
  for(let i=0;i<5;i++) el.dispatchEvent(new WheelEvent('wheel',{deltaY:-120,altKey:true,bubbles:true,cancelable:true}));
  return {alturas:state.lanes.map((l,i)=>laneH(i)), hCrudo:state.lanes.map(l=>l.h||null)}; })()`)));

// B · llamada directa al manejador
console.log('directo ×5     ', JSON.stringify(await evl(`(()=>{ for(let i=0;i<5;i++) wheelResizeLanes({deltaY:-120});
  return {alturas:state.lanes.map((l,i)=>laneH(i)), hCrudo:state.lanes.map(l=>l.h||null)}; })()`)));

// C · rueda REAL por CDP sobre las coordenadas del área de pistas
const box = await evl(`(()=>{const r=document.getElementById('tlscroll').getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};})()`);
await evl(`(()=>{ state.lanes.forEach(l=>{delete l.h; l.collapsed=false;}); renderTimeline(); return 1; })()`);
for (let i = 0; i < 6; i++) await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: box.x, y: box.y, deltaX: 0, deltaY: -120, modifiers: 1 }); // 1 = Alt
await wait(500);
console.log('rueda real ×6  ', JSON.stringify(await evl(`({alturas:state.lanes.map((l,i)=>laneH(i)), hCrudo:state.lanes.map(l=>l.h||null)})`)));
for (let i = 0; i < 20; i++) await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: box.x, y: box.y, deltaX: 0, deltaY: 120, modifiers: 1 });
await wait(500);
console.log('achicar a tope ', JSON.stringify(await evl(`({alturas:state.lanes.map((l,i)=>laneH(i)), colapsadas:state.lanes.map(l=>!!l.collapsed), LANE_MIN_H:(typeof LANE_MIN_H!=='undefined'?LANE_MIN_H:'?')})`)));
ws.close();
