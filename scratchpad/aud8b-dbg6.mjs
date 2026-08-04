import http from 'http';
const t = await new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: 9222, path: '/json/list' }, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => res(JSON.parse(b))); }).on('error', rej); });
const page = t.find(x => x.type === 'page' && x.webSocketDebuggerUrl && /index\.html/.test(x.url));
const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map(); ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const cmd = (m, q = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, x => x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result)); ws.send(JSON.stringify({ id: i, method: m, params: q })); });
const ev = async x => { const r = await cmd('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true, timeout: 60000 }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
const wait = ms => new Promise(r => setTimeout(r, ms));

const g = await ev(`(function(){ renderMedia();
  const it=[...document.querySelectorAll('#mediaList .mitem,#mediaList .mtile')].filter(e=>{const r=e.getBoundingClientRect();return r.width>2;}).find(d=>d.textContent.includes('vidC'));
  if(!it)return {err:'sin item'};
  const r=it.getBoundingClientRect();
  window.__log=[];
  for(const evt of ['pointerdown','mousedown','click','dblclick']) it.addEventListener(evt,()=>__log.push(evt));
  const x=r.left+12,y=r.top+r.height/2;
  const at=document.elementFromPoint(x,y);
  return {x,y,rect:{l:r.left,t:r.top,w:r.width,h:r.height}, at:at&&(at.className||at.id||at.tagName), dentro:!!(at&&it.contains(at)), dpr:devicePixelRatio, iw:innerWidth, ih:innerHeight};
})()`);
console.log(JSON.stringify(g));
if (!g.err) {
  await cmd('Input.dispatchMouseEvent', { type: 'mousePressed', x: g.x, y: g.y, button: 'left', buttons: 1, clickCount: 1, pointerType: 'mouse' });
  await wait(40);
  await cmd('Input.dispatchMouseEvent', { type: 'mouseReleased', x: g.x, y: g.y, button: 'left', buttons: 0, clickCount: 1, pointerType: 'mouse' });
  await wait(200);
  console.log('eventos recibidos por el item:', JSON.stringify(await ev(`__log`)));
}
ws.close();
