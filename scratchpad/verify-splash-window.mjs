// Verifica el arranque en dos ventanas: splash cuadrado → editor 16:9.
import { targets } from './cdp.mjs';
import fs from 'fs';
const wait = ms => new Promise(r => setTimeout(r, ms));

const snap = async () => {
  const list = await targets(9222).catch(() => []);
  return list.filter(t => t.type === 'page').map(t => ({ url: (t.url || '').split('/').pop(), title: t.title }));
};

const timeline = [];
const t0 = Date.now();
for (let i = 0; i < 40; i++) {
  timeline.push({ ms: Date.now() - t0, pages: await snap() });
  await wait(400);
  if (Date.now() - t0 > 12000) break;
}
// compactar: sólo los cambios
const seen = [];
let prev = '';
for (const s of timeline) { const k = JSON.stringify(s.pages); if (k !== prev) { seen.push(s); prev = k; } }
console.log('--- targets a lo largo del arranque ---');
console.log(JSON.stringify(seen, null, 2));

// medir la ventana del editor y el estado del splash si sigue vivo
const list = await targets(9222);
const idx = list.find(t => t.type === 'page' && /index\.html/.test(t.url || ''));
const spl = list.find(t => t.type === 'page' && /splash\.html/.test(t.url || ''));
const measure = async (tgt, expr) => {
  if (!tgt) return 'ausente';
  const ws = new WebSocket(tgt.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws')); });
  const out = await new Promise((res, rej) => {
    ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id !== 1) return; res(m.result && m.result.result && m.result.result.value); };
    ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
  });
  ws.close(); return out;
};
const editor = await measure(idx, `({ w:innerWidth, h:innerHeight, ratio:+(innerWidth/innerHeight).toFixed(4), preboot:document.body.classList.contains('preboot'), landing:!!document.getElementById('landingOv'), tour:!!document.getElementById('tourOv') })`);
const splash = await measure(spl, `({ w:innerWidth, h:innerHeight, status:(document.getElementById('status')||{}).textContent, fill:(document.getElementById('fill')||{}).style&&document.getElementById('fill').style.width })`);
const res = { cambios: seen, editor, splash };
fs.writeFileSync('scratchpad/verify-splash-window.json', JSON.stringify(res, null, 2));
console.log('--- editor ---'); console.log(JSON.stringify(editor, null, 2));
console.log('--- splash ---'); console.log(JSON.stringify(splash, null, 2));
