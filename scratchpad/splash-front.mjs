import { targets } from './cdp.mjs';
const list = await targets(9222);
const page = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res,rej)=>{ ws.onopen=res; ws.onerror=()=>rej(new Error('ws')); });
let id=0; const send=(method,params={})=>new Promise(res=>{ const mid=++id; const h=ev=>{ const m=JSON.parse(ev.data); if(m.id===mid){ ws.removeEventListener('message',h); res(m.result); } }; ws.addEventListener('message',h); ws.send(JSON.stringify({id:mid,method,params})); });
const evalE=async expr=>{ const r=await send('Runtime.evaluate',{expression:expr,returnByValue:true}); return r&&r.result&&r.result.value; };
await send('Page.enable',{});
await send('Page.bringToFront',{});
// start a splash
console.log('start:', await evalE(`(()=>{['splashOv','landingOv','loadingOv'].forEach(i=>{const e=document.getElementById(i);if(e)e.remove();}); window.__d=false; showSplash(2,()=>{window.__d=true;}); const l=document.querySelector('#splashOv .splashlogo'); return JSON.stringify({src:l&&l.getAttribute('src').slice(-11)}); })()`));
await new Promise(r=>setTimeout(r,900));
console.log('t0.9:', await evalE(`(()=>{ const l=document.querySelector('#splashOv .splashlogo'); return JSON.stringify({src:l&&l.getAttribute('src').slice(-11), done:window.__d}); })()`));
await new Promise(r=>setTimeout(r,4800));
console.log('t5.7:', await evalE(`(()=>{ return JSON.stringify({splash:!!document.getElementById('splashOv'), landing:!!document.getElementById('landingOv'), done:window.__d}); })()`));
ws.close();
