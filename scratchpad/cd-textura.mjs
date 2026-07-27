// Compara la TEXTURA que sube cada camino (sin export ni composición): <video> vs decodificador secuencial.
// Sirve para cualquier archivo suelto — se usa para validar HEVC 10 bits, donde un decodificador distinto
// podría cambiar el color en silencio.
import { targets } from './cdp.mjs';
import { spawn } from 'child_process';
const wait = ms => new Promise(r => setTimeout(r, ms));
const ROOT = 'C:\\Users\\beltr\\Desktop\\Alma Digital Studio\\Projects\\Immersive Studio Pro';
const FILE = process.argv[2] || 'C:\\Users\\beltr\\AppData\\Local\\Temp\\claude\\hevc\\prueba10.mp4';
const p = spawn(ROOT + '\\node_modules\\electron\\dist\\electron.exe', ['.', '--remote-debugging-port=9222'], { cwd: ROOT, stdio: 'ignore' });
let idx = null;
for (let i = 0; i < 250; i++) { const l = await targets(9222).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(200); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws')); });
let _id = 0;
const send = (m, pr) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: pr })); });
const errs = []; await send('Runtime.enable', {});
ws.addEventListener('message', ev => { const x = JSON.parse(ev.data); if (x.method === 'Runtime.exceptionThrown') errs.push(((x.params.exceptionDetails.exception || {}).description || '').slice(0, 200)); });
const evl = async e => { try { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, timeout: 900000 }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 300) }; return r.result.value; } catch (err) { return { CAIDA: String(err.message).slice(0, 140) }; } };
for (let i = 0; i < 150; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await wait(1200);
await evl(`window._autoCf=setInterval(()=>{const b=document.querySelector('#confirmOv #cfCancel'); if(b)b.click();},120), 1`);
await evl(`{const o=document.getElementById('landingOv'); if(o)o.remove(); const t=document.getElementById('tourOv'); if(t)t.remove(); 1}`);

const F = FILE.replace(/\\/g, '\\\\');
console.log('archivo:', FILE);
console.log(await evl(`(async()=>{
  let d; try{ d=await demuxMP4('${F}'); }catch(e){ return JSON.stringify({demux:'RECHAZADO: '+(e&&e.message||e)+' → se decodificaria por <video> (correcto, solo mas lento)'}); }
  const cd=makeClipDecoder(d,true);
  const v=document.createElement('video'); v.muted=true; v.preload='auto'; v.src='file:///'+'${F}'.replace(/\\\\/g,'/');
  await new Promise(r=>{ const on=()=>{v.removeEventListener('loadeddata',on);r();}; v.addEventListener('loadeddata',on); v.load(); });
  const W=512,H=288;                                       // se compara a escala reducida: basta para detectar color o fotograma equivocados
  const c=document.createElement('canvas'); c.width=W; c.height=H; const g=c.getContext('2d',{willReadFrequently:true});
  const leer=(src)=>{ g.clearRect(0,0,W,H); g.drawImage(src,0,0,W,H); return g.getImageData(0,0,W,H).data; };
  const filas=[];
  for(let k=1;k<=8;k++){ const t=k*7/60;                   // instantes salteados, no consecutivos
    await new Promise(r=>{ const on=()=>{v.removeEventListener('seeked',on);r();}; v.addEventListener('seeked',on); v.currentTime=t; });
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    const a=leer(v);
    const tus=t*1e6; cd.setTarget(tus); let f=null;
    for(let i=0;i<4000;i++){ cd.pump(); if(cd.passed(tus)){ f=cd.frameNear(tus); break; } await new Promise(r=>setTimeout(r,0)); }
    if(!f){ filas.push({k,error:'sin fotograma'}); continue; }
    const b=leer(f);
    let se=0,n=0,maxd=0; for(let i=0;i<a.length;i+=4)for(let q=0;q<3;q++){ const dd=a[i+q]-b[i+q]; se+=dd*dd; n++; if(Math.abs(dd)>maxd)maxd=Math.abs(dd); }
    const mse=se/n;
    filas.push({k, psnr:(mse===0?'INFINITO':+(10*Math.log10(255*255/mse)).toFixed(2)), maxDif:maxd}); }
  const st=cd.stats(); cd.close(); try{v.removeAttribute('src');v.load();}catch(e){}
  return JSON.stringify({codec:d.codec, fmt:d.fmt, muestras:d.samples.length, stats:st, filas},null,1); })()`));

console.log('\nerrores:', errs.length ? errs.slice(0, 6) : 'ninguno');
try { ws.close(); } catch (_) { } try { p.kill('SIGKILL'); } catch (_) { }
