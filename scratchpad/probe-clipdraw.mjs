import fs from 'fs';
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
// UN solo clip de forma, fadeIn 0.4 / fadeOut 0.5, sin automatización, muy ampliado
await evl(`(async()=>{ await buildDemoProject();
  state.clips.length=0;
  const m={id:uid(),kind:'shape',name:'Prueba',shape:'rect',fill:'#5A8D7E',stroke:'#0E0F11',strokeW:0,w:512,h:512,dur:6,missing:false,_loading:false,color:'#5A8D7E'};
  state.media.push(m);
  const li=state.lanes.map((l,i)=>i).filter(i=>state.lanes[i].kind!=='audio')[0];
  const c={id:uid(),name:'Prueba',mediaId:m.id,lane:li,start:0.2,dur:6,inP:0,props:{},kf:{},color:'#5A8D7E',fadeIn:0.4,fadeOut:0.5};
  state.clips.push(c); state.selIds=[]; state.selId=null; state.tl.pxPerSec=120; state.playhead=0;
  if(state.inlineCurves){const b=document.getElementById('curvesBtn');if(b)b.click();}
  renderTimeline(); render(); return 1; })()`);
await wait(900);
const r = await evl(`(()=>{const e=document.querySelector('.clip'); if(!e)return null; const q=e.getBoundingClientRect(); return {x:Math.round(q.x),y:Math.round(q.y),w:Math.round(q.width),h:Math.round(q.height), hijos:[...e.children].map(n=>n.className+'|'+Math.round(n.getBoundingClientRect().width)+'x'+Math.round(n.getBoundingClientRect().height))};})()`);
console.log(JSON.stringify(r, null, 2));
const c = await send('Page.captureScreenshot', { format: 'png', clip: { x: r.x - 14, y: r.y - 10, width: r.w + 28, height: r.h + 20, scale: 3 } });
fs.writeFileSync('scratchpad/shots/zoom-clip.png', Buffer.from(c.data, 'base64'));
ws.close();
