// [R226] CDP helper que puede atacar CUALQUIER target (la ventana emergente incluida), no sólo la page principal.
import http from 'http';
import fs from 'fs';

export function targets(port = 9222) {
  return new Promise((res, rej) => {
    http.get({ host: '127.0.0.1', port, path: '/json/list' }, r => {
      let b = ''; r.on('data', c => b += c); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } });
    }).on('error', rej);
  });
}
async function pick(match, port) {
  const list = await targets(port);
  const pages = list.filter(t => t.type === 'page' && t.webSocketDebuggerUrl);
  if (!match) return pages.find(t => /app\.js|index\.html|Immersive Studio Pro$/.test(t.url + '|' + t.title)) || pages[0];
  const re = new RegExp(match, 'i');
  const hit = pages.find(t => re.test(t.title) || re.test(t.url));
  if (hit) return hit;
  // la emergente nace con url about:blank y el título puede tardar en propagarse al /json/list
  if (/viewer/i.test(match)) return pages.find(t => t.url === 'about:blank');
  return null;
}
async function send(target, method, params, timeout = 60000) {
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws fail ' + target.url)); });
  try {
    return await new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('CDP timeout ' + method)), timeout);
      ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id !== 1) return; clearTimeout(t);
        if (m.error) return rej(new Error(JSON.stringify(m.error)));
        res(m.result); };
      ws.send(JSON.stringify({ id: 1, method, params }));
    });
  } finally { try { ws.close(); } catch (_) {} }
}
export async function evalIn(match, expr, { port = 9222, timeout = 60000 } = {}) {
  const t = await pick(match, port); if (!t) throw new Error('no target matching ' + match);
  const r = await send(t, 'Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, timeout }, timeout);
  if (r.exceptionDetails) { const e = r.exceptionDetails; throw new Error('page threw: ' + ((e.exception && (e.exception.description || e.exception.value)) || e.text)); }
  return r.result.value;
}
export const run = (expr, o) => evalIn(null, '(function(){' + expr + '})()', o);
export const runIn = (match, expr, o) => evalIn(match, '(function(){' + expr + '})()', o);
export async function shot(name, match = null, port = 9222) {
  const t = await pick(match, port); if (!t) throw new Error('no target matching ' + match);
  const r = await send(t, 'Page.captureScreenshot', { format: 'png' });
  const dir = new URL('./shots/', import.meta.url);
  fs.mkdirSync(dir, { recursive: true });
  const out = new URL('./shots/' + name + '.png', import.meta.url);
  fs.writeFileSync(out, Buffer.from(r.data, 'base64'));
  return out.pathname;
}
export const list = targets;
