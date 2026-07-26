// ¿el .exe EMPAQUETADO trae R170-R172? Se comprueba contra el asar, no contra los fuentes.
import { targets } from './cdp.mjs';
const wait = ms => new Promise(r => setTimeout(r, ms));
let idx = null;
for (let i = 0; i < 220; i++) { const l = await targets(9223).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(300); }
if (!idx) { console.log('el .exe no expuso la ventana'); process.exit(1); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws')); });
let _id = 0;
const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
const errs = []; await send('Runtime.enable', {});
ws.addEventListener('message', ev => { const x = JSON.parse(ev.data);
  if (x.method === 'Runtime.consoleAPICalled' && x.params.type === 'error') errs.push((x.params.args || []).map(a => a.value || a.description || '').join(' ').slice(0, 180));
  if (x.method === 'Runtime.exceptionThrown') errs.push('excepción: ' + ((x.params.exceptionDetails.exception && x.params.exceptionDetails.exception.description) || '').slice(0, 180)); });
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 250) }; return r.result.value; };
for (let i = 0; i < 90; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await evl(`(()=>{try{localStorage.setItem('dspOnboardV1','1')}catch(e){}document.querySelectorAll('.overlay,#tourOv,#landingOv').forEach(o=>o.remove());document.body.classList.remove('preboot');try{resize()}catch(e){}return 1})()`);
await evl(`(async()=>{state.dirty=false;await buildDemoProject();return 1})()`); await wait(900);

console.log(JSON.stringify(await evl(`(()=>{ const R={};
  R['R170 · enlace A/V'] = [typeof linkPartner, typeof attachLinkedAudio, typeof armMediaAudio].join('/');
  R['R171 · audio = vídeo'] = (()=>{ const h=state.lanes.map((l,i)=>laneH(i)); return h.every(x=>x===h[0])?('todas '+h[0]+'px'):h.join(','); })();
  R['R171 · panel pegado a las pistas'] = (()=>{ const el=document.querySelector('.timeline');
    const cur=Math.round(el.getBoundingClientRect().height), max=Math.round(tlMaxH()); return cur+' / tope '+max+(cur<=max+1?' ✓':' ✗'); })();
  R['R171 · fuente en el título'] = typeof clampTimelineH==='function';
  R['R172 · alternancia de menús'] = [typeof dentroDe, typeof rectDe].join('/');
  R['render'] = (()=>{try{render();return !(gl&&gl.isContextLost&&gl.isContextLost())}catch(e){return 'ROTO: '+e.message}})();
  return R; })()`), null, 2));

// prueba viva: abrir y cerrar un desplegable con eventos reales
const pos = await evl(`(()=>{const b=document.querySelector('#menubar .menubtn[data-menu=file]');const r=b.getBoundingClientRect();return{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};})()`);
const clic = async () => { await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pos.x, y: pos.y, button: 'left', clickCount: 1 });
                           await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pos.x, y: pos.y, button: 'left', clickCount: 1 }); };
await clic(); await wait(220); const abierto = await evl(`!!document.querySelector('.menu')`);
await clic(); await wait(260); const cerrado = !(await evl(`!!document.querySelector('.menu')`));
console.log('menú File en el .exe: abre ' + (abierto ? '✓' : '✗') + ' · cierra al 2.º clic ' + (cerrado ? '✓' : '✗'));
await wait(500);
console.log('errores de consola en el .exe:', errs.length ? errs : 'ninguno');
ws.close();
