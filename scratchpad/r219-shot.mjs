// Capture a screenshot of the running Electron app's main page via CDP, and optionally eval an expression first.
import http from 'http';
import fs from 'fs';

function targets(port = 9222) {
  return new Promise((res, rej) => {
    http.get({ host: '127.0.0.1', port, path: '/json/list' }, r => {
      let b = ''; r.on('data', c => b += c); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } });
    }).on('error', rej);
  });
}

async function main() {
  const outPath = process.argv[2] || 'scratchpad/r219-shot.png';
  const expr = process.argv[3] || null; // optional JS to eval before the screenshot
  const port = 9222;
  const list = await targets(port);
  const page = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
  if (!page) throw new Error('no page target');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws connect failed')); });
  let id = 1;
  const pending = new Map();
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (pending.has(m.id)) { const {res, rej} = pending.get(m.id); pending.delete(m.id); if (m.error) rej(new Error(JSON.stringify(m.error))); else res(m.result); }
  };
  function send(method, params) {
    const myId = ++id;
    return new Promise((res, rej) => { pending.set(myId, {res, rej}); ws.send(JSON.stringify({ id: myId, method, params: params||{} })); });
  }
  if (expr) {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error('eval threw: ' + JSON.stringify(r.exceptionDetails));
    console.log('eval result:', JSON.stringify(r.result.value));
  }
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
  console.log('saved', outPath);
  ws.close();
}
main().catch(e => { console.error('ERR', e.message); process.exit(1); });
