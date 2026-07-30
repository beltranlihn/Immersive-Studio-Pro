// [R228] captura de pantalla del renderer por CDP (Page.captureScreenshot) — cdp.mjs sólo evalúa expresiones.
import http from 'http';
import fs from 'fs';

function targets(port = 9222) {
  return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port, path: '/json/list' }, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej); });
}
export async function shot(outPath, { port = 9222 } = {}) {
  const list = await targets(port);
  const page = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl && !/viewer|splash/i.test(t.url));
  if (!page) throw new Error('no page target');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws fail')); });
  try {
    const send = (id, method, params) => new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('timeout ' + method)), 30000);
      const h = ev => { const m = JSON.parse(ev.data); if (m.id !== id) return; ws.removeEventListener('message', h); clearTimeout(t); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); };
      ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method, params }));
    });
    await send(1, 'Page.enable', {});
    const r = await send(2, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(outPath, Buffer.from(r.data, 'base64'));
    return outPath;
  } finally { try { ws.close(); } catch (_) {} }
}
if (process.argv[2]) shot(process.argv[2]).then(p => console.log('→ ' + p));
