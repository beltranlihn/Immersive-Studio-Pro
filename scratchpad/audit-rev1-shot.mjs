import { targets } from './cdp.mjs';
import fs from 'fs';
const page = (await targets(9222)).find(t => t.type === 'page' && t.webSocketDebuggerUrl);
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws')); });
let _id = 0;
const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error('threw'); return r.result.value; };
const wait = ms => new Promise(r => setTimeout(r, ms));

await send('Page.enable', {});
await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false, screenWidth: 1920, screenHeight: 1080 });
await evl(`(()=>{ try{resize();}catch(e){} render(); renderTimeline(); renderInspector(); return [innerWidth,innerHeight]; })()`);
await wait(900);
const vp = await evl(`[innerWidth, innerHeight, Math.round(document.querySelector('.transport').getBoundingClientRect().y), Math.round(document.querySelector('.timeline').getBoundingClientRect().y), Math.round((document.querySelector('.statusbar')||document.querySelector('#statusBar')||document.querySelector('.status')).getBoundingClientRect().y)]`);
console.log('viewport/anchors:', vp);
const [W, H, trY, tlY, stY] = vp;

const shot = async (name, clip) => { const c = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, clip: { ...clip, scale: 1 } }); fs.writeFileSync('scratchpad/audit-' + name + '.png', Buffer.from(c.data, 'base64')); };
await shot('r-full', { x: 0, y: 0, width: W, height: H });
await shot('r-topbar', { x: 0, y: 0, width: W, height: 30 });
await shot('r-media', { x: 0, y: 26, width: 300, height: 66 });
await shot('r-vptool', { x: 292, y: 26, width: W - 292 - 300, height: 32 });
await shot('r-inspector', { x: W - 300, y: 26, width: 300, height: 360 });
await shot('r-transport', { x: 0, y: trY - 2, width: W, height: 34 });
await shot('r-timeline', { x: 0, y: tlY, width: 1000, height: 300 });
await shot('r-status', { x: 0, y: stY - 2, width: W, height: 28 });
console.log('capturas OK');
ws.close();
