// Like cdp.mjs's evalInApp but with includeCommandLineAPI:true so getEventListeners() works.
import http from 'http';

function targets(port = 9222) {
  return new Promise((res, rej) => {
    http.get({ host: '127.0.0.1', port, path: '/json/list' }, r => {
      let b = ''; r.on('data', c => b += c); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } });
    }).on('error', rej);
  });
}

export async function evalCLI(expr, { port = 9222, timeout = 900000 } = {}) {
  const list = await targets(port);
  const page = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
  if (!page) throw new Error('no page target');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws connect failed')); });
  try {
    return await new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('CDP timeout')), timeout);
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
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expr, awaitPromise: true, returnByValue: true, includeCommandLineAPI: true, timeout } }));
    });
  } finally { try { ws.close(); } catch (_) {} }
}
