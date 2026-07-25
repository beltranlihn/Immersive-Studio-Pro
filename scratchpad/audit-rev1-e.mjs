// AUDITORÍA REDISEÑO Rev 1 — parte E: toggle .iosw real (Preferences) + capturas de las regiones.
import { targets } from './cdp.mjs';
import fs from 'fs';
const page = (await targets(9222)).find(t => t.type === 'page' && t.webSocketDebuggerUrl);
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws')); });
let _id = 0;
const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error('threw: ' + JSON.stringify(r.exceptionDetails).slice(0, 400)); return r.result.value; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const shot = async (name, clip) => { const c = await send('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale: 1 } }); fs.writeFileSync('scratchpad/audit-' + name + '.png', Buffer.from(c.data, 'base64')); return 'scratchpad/audit-' + name + '.png'; };

// capturas de regiones (antes de abrir el modal)
const shots = [];
shots.push(await shot('r-topbar', { x: 0, y: 0, width: 1920, height: 30 }));
shots.push(await shot('r-media', { x: 0, y: 26, width: 300, height: 66 }));
shots.push(await shot('r-vptool', { x: 292, y: 26, width: 1330, height: 32 }));
shots.push(await shot('r-inspector', { x: 1620, y: 26, width: 300, height: 340 }));
shots.push(await shot('r-transport', { x: 0, y: 622, width: 1920, height: 34 }));
shots.push(await shot('r-timeline', { x: 0, y: 654, width: 1000, height: 300 }));
shots.push(await shot('r-status', { x: 0, y: 1054, width: 1920, height: 26 }));

// toggle real en Preferences
await evl(`(()=>{ openPrefs(); return 1; })()`);
await wait(600);
const tog = await evl(`(()=>{
  const R=el=>{const b=el.getBoundingClientRect();return {w:Math.round(b.width*10)/10,h:Math.round(b.height*10)/10};};
  const hex=c=>{const m=c.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);return m?'#'+[m[1],m[2],m[3]].map(n=>(+n).toString(16).padStart(2,'0')).join('').toUpperCase():c;};
  const on=[...document.querySelectorAll('.iosw')].find(s=>s.classList.contains('on'));
  const off=[...document.querySelectorAll('.iosw')].find(s=>!s.classList.contains('on'));
  const one=on||off; if(!one) return 'sin toggles';
  return { n:document.querySelectorAll('.iosw').length,
    track:R(one), knob:R(one.querySelector('i')),
    onBg: on? hex(getComputedStyle(on).backgroundColor):null,
    offBg: off? hex(getComputedStyle(off).backgroundColor):null,
    knobLeftOn: on? getComputedStyle(on.querySelector('i')).left:null,
    knobLeftOff: off? getComputedStyle(off.querySelector('i')).left:null };
})()`);
const modalBox = await evl(`(()=>{ const m=document.querySelector('#prefOv .modal'); const b=m.getBoundingClientRect(); return {x:Math.round(b.x),y:Math.round(b.y),width:Math.round(b.width),height:Math.round(Math.min(b.height,300))}; })()`);
shots.push(await shot('r-toggle', modalBox));
await evl(`(()=>{ const o=document.getElementById('prefOv'); if(o)o.remove(); return 1; })()`);

console.log(JSON.stringify({ toggle: tog, shots }, null, 2));
ws.close();
