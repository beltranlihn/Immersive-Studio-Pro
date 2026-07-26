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
await send('Page.reload', { ignoreCache: true }); await wait(2100);
for (let i = 0; i < 60; i++) { try { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")')) break; } catch (e) {} await wait(400); }
await evl(`(()=>{ try{localStorage.setItem('dspOnboardV1','1')}catch(e){} document.querySelectorAll('.overlay,#tourOv,#landingOv').forEach(o=>o.remove()); document.body.classList.remove('preboot'); try{resize();}catch(e){} return 1; })()`);
await evl(`(async()=>{ await buildDemoProject(); return 1; })()`); await wait(700);
const dump = sel => `(()=>{ const b=document.querySelector('.vptool'); const mb=document.getElementById('vpMoreBtn');
  const hijos=[...b.children].map(n=>({ cls:(n.className||'').toString().slice(0,26), id:n.id||'', w:Math.round(n.getBoundingClientRect().width), vis:getComputedStyle(n).display!=='none' }));
  return { modo:state.view.mode, three:state.view.three, oculto:(typeof _vpHide!=='undefined'?_vpHide:'?'),
    barra:Math.round(b.getBoundingClientRect().width), scrollW:b.scrollWidth, clientW:b.clientWidth,
    masVisible:mb?getComputedStyle(mb).display!=='none':null, hijos:hijos.filter(h=>h.vis) }; })()`;
console.log('2D  ', JSON.stringify(await evl(dump()), null, 1));
await evl(`document.querySelector('#viewModeSeg button[data-v="3d"]').click()`); await wait(600);
console.log('3D  ', JSON.stringify(await evl(dump()), null, 1));
ws.close();
