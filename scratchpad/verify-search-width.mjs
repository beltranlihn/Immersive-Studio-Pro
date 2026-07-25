import { targets } from './cdp.mjs';
const page = (await targets(9222)).find(t => t.type === 'page' && t.webSocketDebuggerUrl);
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws')); });
let _id = 0;
const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error('threw: ' + JSON.stringify(r.exceptionDetails).slice(0, 300)); return r.result.value; };
const wait = ms => new Promise(r => setTimeout(r, ms));
await send('Page.reload', { ignoreCache: true }); await wait(1500);
for (let i = 0; i < 50; i++) { try { if (await evl('typeof state!=="undefined" && !!document.getElementById("mediaSearch")')) break; } catch (e) {} await wait(400); }
await evl(`(()=>{ try{localStorage.setItem('dspOnboardV1','1')}catch(e){} document.querySelectorAll('.overlay,#splashOv,#tourOv').forEach(o=>{try{if(o._stopLogo)o._stopLogo();}catch(e){}o.remove();}); document.body.classList.remove('preboot'); try{resize();}catch(e){} return 1; })()`);
await wait(400);
console.log(JSON.stringify(await evl(`(()=>{
  const si=document.getElementById('mediaSearch');
  showMediaSearch(true);
  const open={ w:Math.round(si.getBoundingClientRect().width), filtSegHidden:getComputedStyle(document.getElementById('filtSeg')).display==='none', sortVisible:getComputedStyle(document.getElementById('mediaSortBtn')).display!=='none' };
  showMediaSearch(false);
  const closed={ inputHidden:getComputedStyle(si).display==='none', filtSegBack:getComputedStyle(document.getElementById('filtSeg')).display!=='none', spacerBack:getComputedStyle(document.getElementById('filtSpacer')).display!=='none' };
  return {open, closed};
})()`), null, 2));
ws.close();
