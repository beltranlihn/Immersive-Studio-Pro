import { targets } from './cdp.mjs';
// Reload the renderer via CDP Page.reload so it re-fetches app.js/index.html.
const list = await targets(9222);
const page = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
if (!page) { console.error('no page target'); process.exit(1); }
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws fail')); });
ws.send(JSON.stringify({ id: 1, method: 'Page.enable' }));
ws.send(JSON.stringify({ id: 2, method: 'Page.reload', params: { ignoreCache: true } }));
await new Promise(r => setTimeout(r, 500));
ws.close();
console.log('reload sent');
