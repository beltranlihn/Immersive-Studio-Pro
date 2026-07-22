// Screenshot the running renderer via CDP → scratchpad/out/<name>.png
import fs from 'fs';
import { targets } from './cdp.mjs';

export async function capture(name, port = 9222) {
  const list = await targets(port);
  const page = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
  if (!page) throw new Error('no page target');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws fail')); });
  const data = await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('timeout')), 30000);
    ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id !== 1) return; clearTimeout(t);
      if (m.error) return rej(new Error(JSON.stringify(m.error)));
      res(m.result.data); };
    ws.send(JSON.stringify({ id: 1, method: 'Page.captureScreenshot', params: { format: 'png' } }));
  });
  ws.close();
  const out = new URL('./out/' + name + '.png', import.meta.url);
  fs.mkdirSync(new URL('./out/', import.meta.url), { recursive: true });
  fs.writeFileSync(out, Buffer.from(data, 'base64'));
  return out.pathname;
}

if (process.argv[2]) console.log(await capture(process.argv[2]));
