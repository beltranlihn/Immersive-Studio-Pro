import { targets } from './cdp.mjs';
const page = (await targets(9222)).find(t => t.type === 'page' && t.webSocketDebuggerUrl);
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws')); });
let _id = 0;
const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error('threw'); return r.result.value; };
console.log(JSON.stringify(await evl(`(()=>[...document.querySelectorAll('#insCtl input[type=checkbox]')].map(i=>({id:i.id||null, sec:(i.closest('#tfRows')?'tfRows':i.closest('#fxRows')?'fxRows':i.closest('#colorRows')?'colorRows':i.closest('#sourceRows')?'sourceRows':i.closest('#playbackRows')?'playbackRows':i.closest('#motionRows')?'motionRows':'?'), lab:((i.closest('.prow')||{}).querySelector?((i.closest('.prow')).querySelector('.lab')||{}).textContent:null)})))()`), null, 2));
ws.close();
