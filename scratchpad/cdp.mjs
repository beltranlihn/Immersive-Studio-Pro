// Minimal CDP driver: evaluate an expression inside the running Electron renderer over the DevTools protocol.
// Node 25 has a global WebSocket, so there is no dependency here.
import http from 'http';

export function targets(port = 9222) {
  return new Promise((res, rej) => {
    http.get({ host: '127.0.0.1', port, path: '/json/list' }, r => {
      let b = ''; r.on('data', c => b += c); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } });
    }).on('error', rej);
  });
}

export async function evalInApp(expr, { port = 9222, timeout = 900000 } = {}) {
  const list = await targets(port);
  const page = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
  if (!page) throw new Error('no page target — is the app running with --remote-debugging-port=' + port + '?');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws connect failed')); });
  try {
    return await new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('CDP timeout after ' + timeout + 'ms')), timeout);
      ws.onmessage = ev => {
        const m = JSON.parse(ev.data);
        if (m.id !== 1) return;
        clearTimeout(t);
        if (m.error) return rej(new Error('CDP error: ' + JSON.stringify(m.error)));
        const r = m.result;
        if (r.exceptionDetails) {
          const e = r.exceptionDetails;
          return rej(new Error('page threw: ' + ((e.exception && (e.exception.description || e.exception.value)) || e.text)));
        }
        res(r.result.value);
      };
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expr, awaitPromise: true, returnByValue: true, timeout } }));
    });
  } finally { try { ws.close(); } catch (_) {} }
}
