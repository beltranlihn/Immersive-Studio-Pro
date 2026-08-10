/* [R349] Volcado del inspector con Motion + Efectos, para MIRAR el punto 4 (estetica). Regla de la memoria: el
   material que fabrico y no miro esconde fallos. Deja scratchpad/r349-motion.png (no se versiona).

   Uso:  npx electron . --remote-debugging-port=9222   y luego  node scratchpad/r349-motion.mjs
*/
import http from 'http';
import { writeFileSync } from 'fs';

const lista = await new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: 9222, path: '/json/list' }, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => res(JSON.parse(b))); }).on('error', rej); });
const pg = lista.find(x => x.type === 'page' && /index\.html/.test(x.url));
if (!pg) { console.log('*** la app no esta escuchando en 9222'); process.exit(2); }
const ws = new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const cmd = (method, params) => new Promise(r => { const i = ++id; pend.set(i, m => r(m.result)); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
const ev = x => cmd('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true, timeout: 60000 }).then(r => r && (r.exceptionDetails ? ('EXC ' + (r.exceptionDetails.exception?.description || '').slice(0, 400)) : (r.result && r.result.value)));

const r = await ev(`(async()=>{ try{
  if(typeof hideLanding==='function')try{hideLanding();}catch(e){}
  if(!state.clips.length)await Promise.resolve(startDemoProject('dome'));
  for(let i=0;i<40&&!state.clips.length;i++)await new Promise(r=>setTimeout(r,150));
  const c=state.clips.find(x=>{const m=mediaById(x.mediaId);return m&&m.kind!=='audio';})||state.clips[0];
  state.selId=c.id; state.selIds=[c.id]; state.selGroupId=null;
  c.anim=[]; addAnimPreset(c,'spin'); addAnimPreset(c,'bob'); addAnimPreset(c,'float');
  c.fx=[]; addFxToClip(c,'posterize',true);
  state.insCol=state.insCol||{}; state.insCol.motion=false; state.insCol.mfx=false;
  renderInspector(); await new Promise(r=>setTimeout(r,150));
  const sec=document.getElementById('secMotion'); if(sec)sec.scrollIntoView({block:'start'});
  const host=document.getElementById('insCtl')||document.getElementById('inspector')||document.querySelector('.inspector');
  await new Promise(r=>setTimeout(r,250));
  const b=(host||document.body).getBoundingClientRect();
  return JSON.stringify({x:Math.round(b.left),y:Math.round(b.top),w:Math.round(b.width),h:Math.round(b.height),
                         mods:(c.anim||[]).length, fx:(c.fx||[]).length});
}catch(e){ return 'ERR '+String((e&&(e.stack||e.message))||e).slice(0,400); } })()`);
console.log('   inspector: ' + r);
let box = null; try { box = JSON.parse(r); } catch (e) { console.log('*** ' + r); process.exit(1); }

const shot = await cmd('Page.captureScreenshot', { format: 'png', clip: { x: box.x, y: box.y, width: box.w, height: box.h, scale: 1 } });
writeFileSync('scratchpad/r349-motion.png', Buffer.from(shot.data, 'base64'));
console.log('   escrito scratchpad/r349-motion.png  (' + box.w + '×' + box.h + ')');
ws.close();
