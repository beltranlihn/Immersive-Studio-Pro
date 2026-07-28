// [R204] 1) unir rutas con el separador del sistema · 2) reenlace de medios junto al proyecto.
// La prueba MUEVE de verdad un proyecto con sus medios a otra carpeta y lo reabre desde alli.
import { targets } from './cdp.mjs';
import { spawn } from 'child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync, copyFileSync } from 'fs';
const wait = ms => new Promise(r => setTimeout(r, ms));
const ROOT = 'C:\\Users\\beltr\\Desktop\\Alma Digital Studio\\Projects\\Immersive Studio Pro';
const VIEJO = process.argv[2] === 'viejo', PORT = VIEJO ? 9223 : 9222;
const p = VIEJO
  ? spawn('C:\\Users\\beltr\\AppData\\Local\\Programs\\Immersive Studio Pro\\Immersive Studio Pro.exe', ['--remote-debugging-port=' + PORT], { stdio: 'ignore' })
  : spawn(ROOT + '\\node_modules\\electron\\dist\\electron.exe', ['.', '--remote-debugging-port=' + PORT], { cwd: ROOT, stdio: 'ignore' });
console.log(VIEJO ? '=== CONTROL: .exe instalado (R203, sin reenlace) ===' : '=== dev (R204) ===');
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
await evl(`setInterval(()=>{const b=document.querySelector('#confirmOv #cfCancel'); if(b)b.click();},120);1`);

// --- montaje en disco: carpeta A (original) y carpeta B (a donde se "muda") ---
const TMP = ROOT + '\\scratchpad\\_r204';
const A = TMP + '\\origen', B = TMP + '\\mudanza', SUB = B + '\\material';
rmSync(TMP, { recursive: true, force: true });
mkdirSync(A, { recursive: true }); mkdirSync(SUB, { recursive: true });
// dos imagenes PNG reales (1x1) como medios
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
writeFileSync(A + '\\uno.png', PNG); writeFileSync(A + '\\dos.png', PNG);
// las mismas, en la mudanza: una en la raiz y otra en una SUBCARPETA
copyFileSync(A + '\\uno.png', B + '\\uno.png');
copyFileSync(A + '\\dos.png', SUB + '\\dos.png');
console.log('carpetas de prueba creadas');

console.log('\n--- 1 · las rutas se unen con el separador del sistema ---');
console.log(await evl(`(()=>{
  if(typeof pjoin!=='function')return JSON.stringify({hayAyudante:false});
  const s=(typeof PSEP!=='undefined')?PSEP:'?';
  return JSON.stringify({hayAyudante:true, separador:JSON.stringify(s),
    ejemplo:pjoin('C:\\\\carpeta','autosave','proy.isp'),
    partir:{dir:pdir('C:/a/b/c.mp4'), base:pbase('C:/a/b/c.mp4')},
    // las rutas que arma el programa no pueden llevar una barra invertida DENTRO de un nombre
    proxyDeEjemplo:(function(){ return proxyLocalPath({path:'C:\\\\videos\\\\clip.mp4',fsize:100}); })() }); })()`));

console.log('\n--- 2 · guardar un proyecto en la carpeta ORIGEN ---');
console.log(await evl(`(async()=>{ try{ hideLanding(); }catch(e){}
  await newProject('flat',1920,1080,60);
  const A=${JSON.stringify(A)};
  const lane=ensureVideoLanes(1)[0];
  for(const f of ['uno.png','dos.png']){
    const m={id:uid(),name:f,kind:'image',el:null,originalEl:null,tex:null,w:1,h:1,dur:5,fps:0,
             thumb:null,color:clipColorFor('image'),proxyReady:false,proxyPct:0,path:A+'\\\\'+f,fsize:70,folder:null};
    state.media.push(m); await reloadMedia(m); addClip(m,lane,0);
  }
  const png=state.media.filter(m=>m.kind==='image');
  const p=A+'\\\\proyecto.isp';
  await DSP.writeText(p, JSON.stringify(serProject())); currentPath=p;
  return JSON.stringify({medios:png.length, ausentes:png.filter(m=>m.missing).length,
    rutas:png.map(m=>m.path), clips:state.clips.length}); })()`));

console.log('\n--- 3 · reabrirlo desde la MUDANZA (rutas viejas ya no existen) ---');
// el .isp se copia a B; los PNG de A se BORRAN para que la ruta original sea imposible
copyFileSync(A + '\\proyecto.isp', B + '\\proyecto.isp');
rmSync(A + '\\uno.png', { force: true }); rmSync(A + '\\dos.png', { force: true });
console.log(await evl(`(async()=>{
  const p=${JSON.stringify(B)}+'\\\\proyecto.isp';
  const txt=await DSP.readText(p); currentPath=p; loadProject(JSON.parse(txt));
  await new Promise(r=>setTimeout(r,3000));
  const png=state.media.filter(m=>m.kind==='image');
  return JSON.stringify({
    medios:png.length,
    ausentes:png.filter(m=>m.missing).length,
    rutasNuevas:png.map(m=>m.path),
    clipsIntactos:state.clips.length,
    veredicto:(png.length===2&&png.every(m=>!m.missing))
      ? 'correcto: reenlazados solos (uno en la raiz, otro en una subcarpeta)'
      : '*** MAL: quedan ausentes ***' },null,1); })()`));

console.log('\nerrores:', errs.length ? errs.slice(0, 6) : 'ninguno');
try { ws.close(); } catch (_) { } try { p.kill('SIGKILL'); } catch (_) { }
try { rmSync(TMP, { recursive: true, force: true }); } catch (_) { }
