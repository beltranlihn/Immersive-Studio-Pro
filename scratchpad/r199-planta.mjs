// [R199] ¿la planta se corta? Se dibuja en un lienzo del tamaño del panel del launcher y se mira si queda TINTA
// pegada al borde (que es la firma de un recorte). Salas extremas a propósito: muy anchas, muy planas, con
// medidas de cuatro cifras, y las tres formas (4/3/2 muros).
import { targets } from './cdp.mjs';
import { spawn } from 'child_process';
const wait = ms => new Promise(r => setTimeout(r, ms));
const ROOT = 'C:\\Users\\beltr\\Desktop\\Alma Digital Studio\\Projects\\Immersive Studio Pro';
/* `node r199-planta.mjs viejo` ataca el .exe INSTALADO, que todavía lleva R198 (ajuste por márgenes fijos y el
   roomPlan anterior). Sirve de control: si ahí tampoco se corta nada, la medida no distingue y no vale. */
const VIEJO = process.argv[2] === 'viejo';
const PORT = VIEJO ? 9223 : 9222;
const p = VIEJO
  ? spawn('C:\\Users\\beltr\\AppData\\Local\\Programs\\Immersive Studio Pro\\Immersive Studio Pro.exe', ['--remote-debugging-port=' + PORT], { stdio: 'ignore' })
  : spawn(ROOT + '\\node_modules\\electron\\dist\\electron.exe', ['.', '--remote-debugging-port=' + PORT], { cwd: ROOT, stdio: 'ignore' });
console.log(VIEJO ? '=== CONTROL: .exe instalado (R198) ===' : '=== dev (R199) ===');
let idx = null;
for (let i = 0; i < 250; i++) { const l = await targets(PORT).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(200); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws')); });
let _id = 0;
const send = (m, pr) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: pr })); });
const errs = []; await send('Runtime.enable', {});
ws.addEventListener('message', ev => { const x = JSON.parse(ev.data); if (x.method === 'Runtime.exceptionThrown') errs.push(((x.params.exceptionDetails.exception || {}).description || '').slice(0, 200)); });
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, timeout: 120000 }); return r.exceptionDetails ? JSON.stringify(r.exceptionDetails).slice(0, 400) : r.result.value; };
for (let i = 0; i < 150; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await wait(2500);

const ARNES = `window.__recorte=function(muros,ancho,alto,solo){
  const cv=document.createElement('canvas'); cv.width=ancho; cv.height=alto;
  cv.style.cssText='position:fixed;left:0;top:0;opacity:0.01;pointer-events:none;width:'+(ancho/2)+'px;height:'+(alto/2)+'px;';
  document.body.appendChild(cv);
  try{ drawRoomIso(cv,muros,true,null,LCH_PAL,solo||undefined); }catch(e){ cv.remove(); return {ROTO:String(e)}; }
  const d=cv.getContext('2d').getImageData(0,0,ancho,alto).data; cv.remove();
  const enc=(x,y)=>d[(y*ancho+x)*4+3]>12;               // alfa: cualquier cosa dibujada
  let borde=0,total=0;
  for(let y=0;y<alto;y++)for(let x=0;x<ancho;x++){ if(!enc(x,y))continue; total++;
    if(x<=1||y<=1||x>=ancho-2||y>=alto-2)borde++; }
  return {tinta:total, tocaElBorde:borde};
};1`;
console.log('arnes:', await evl(ARNES));

const M = (r, w, h) => `{role:'${r}',wcm:${w},hcm:${h || 300},pxW:1920,pxH:1080}`;
const casos = [
  ['4 muros normales (800/800)', `[${M('Front', 800)},${M('Right', 800)},${M('Back', 800)},${M('Left', 800)}]`],
  ['4 muros MUY ancha (2000 frente · 300 lados)', `[${M('Front', 2000)},${M('Right', 300)},${M('Back', 2000)},${M('Left', 300)}]`],
  ['4 muros MUY profunda (300 frente · 2000 lados)', `[${M('Front', 300)},${M('Right', 2000)},${M('Back', 300)},${M('Left', 2000)}]`],
  ['4 muros con medidas de 5 cifras', `[${M('Front', 12000)},${M('Right', 9500)},${M('Back', 12000)},${M('Left', 9500)}]`],
  ['4 muros lados distintos', `[${M('Front', 800)},${M('Right', 600)},${M('Back', 800)},${M('Left', 400)}]`],
  ['3 muros (launcher: Front/Right/Back)', `[${M('Front', 800)},${M('Right', 500)},${M('Back', 800)}]`],
  ['2 muros (launcher: Front/Right)', `[${M('Front', 800)},${M('Right', 500)}]`],
  ['imposible (fondo 5000)', `[${M('Front', 800)},${M('Right', 500)},${M('Back', 5000)},${M('Left', 500)}]`],
];
for (const [n, m] of casos) {
  const launcher = await evl(`JSON.stringify(__recorte(${m},1060,700,'plan'))`);
  const dialogo = await evl(`JSON.stringify(__recorte(${m},1056,440))`);
  console.log(`\n${n}`);
  console.log('   panel launcher (planta sola): ' + launcher);
  console.log('   lienzo del diálogo (iso+plan): ' + dialogo);
}
console.log('\nerrores:', errs.length ? errs.slice(0, 6) : 'ninguno');
try { ws.close(); } catch (_) { } try { p.kill('SIGKILL'); } catch (_) { }
