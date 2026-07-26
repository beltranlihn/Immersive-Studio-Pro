// ¿el hilo del renderer sigue atendiendo? Si Runtime.evaluate no vuelve en 6s, está bloqueado.
import { targets } from './cdp.mjs';
const wait = ms => new Promise(r => setTimeout(r, ms));
const l = await targets(9222);
const idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || ''));
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws')); });
let _id = 0;
const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); res(x); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
const r = await Promise.race([
  send('Runtime.evaluate', { expression: '({clips:state.clips.length, medios:state.media.length, seq:state.activeSeqId})', returnByValue: true }),
  wait(6000).then(() => 'TIMEOUT')
]);
console.log(r === 'TIMEOUT' ? 'RENDERER BLOQUEADO (no responde en 6s)' : JSON.stringify(r.result && r.result.result && r.result.result.value));
ws.close();
