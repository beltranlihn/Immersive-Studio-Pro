// [R191] Export H.265 REAL de punta a punta, y H.264 de control. Se juzgan con ffprobe, no con la interfaz.
import { targets } from './cdp.mjs';
import { spawn } from 'child_process';
import fs from 'fs';
const wait = ms => new Promise(r => setTimeout(r, ms));
const ROOT = 'C:\\Users\\beltr\\Desktop\\Alma Digital Studio\\Projects\\Immersive Studio Pro';
const PROJ = 'C:\\\\Users\\\\beltr\\\\Desktop\\\\untitled.isp';
const OUT = 'C:\\Users\\beltr\\AppData\\Local\\Temp\\claude\\exvid';
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
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
await evl(`(async()=>{ const o=document.getElementById('landingOv'); if(o)o.remove(); await openProjectPath('${PROJ}');
  for(let i=0;i<80;i++){ if(state.media.length>2)break; await new Promise(r=>setTimeout(r,400)); } await new Promise(r=>setTimeout(r,4500));
  const t=document.getElementById('tourOv'); if(t)t.remove(); clearInterval(window._autoCf); return 1; })()`);

const correr = (codec, w, salida) => `(async()=>{
  let ultimo=0, err=null;
  const job={ prog:k=>{ultimo=k;}, label:()=>{}, frame:()=>{}, wrote:()=>{}, warn:()=>{}, done:()=>{}, fail:e=>{err=String(e&&e.message||e);} };
  const ext=clipExtent(); const a=performance.now();
  try{ await runExport({codec:'${codec}', res:${w}, outW:${w}, outH:${w}, fps:60, bitrate:40e6, range:'clips',
    rangeT:[ext[0], ext[0]+30/60], outPath:'${salida.replace(/\\/g, '\\\\')}', job, silent:true, noAudio:true}); }catch(e){ err=String(e&&e.message||e); }
  return JSON.stringify({fotogramas:ultimo, segundos:+((performance.now()-a)/1000).toFixed(1), err}); })()`;

const H265 = OUT + '\\prueba_h265.mp4', H264 = OUT + '\\prueba_h264.mp4';
console.log('H.265 a 1024²:', await evl(correr('hevc', 1024, H265)));
await wait(1500);
console.log('H.264 a 1024² (control):', await evl(correr('mp4', 1024, H264)));
console.log('\n¿H.265 a 4096² da un error CLARO?', await evl(correr('hevc', 4096, OUT.replace(/\\/g, '\\\\') + '\\\\no_deberia.mp4')));

console.log('\nerrores en la app:', errs.length ? errs.slice(0, 6) : 'ninguno');
try { ws.close(); } catch (_) { } try { p.kill('SIGKILL'); } catch (_) { }

for (const f of [H265, H264]) {
  if (!fs.existsSync(f)) { console.log('\n' + f + ': NO SE ESCRIBIO'); continue; }
  const pr = spawn('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,profile,width,height,nb_frames,pix_fmt', '-of', 'default=nw=1', f]);
  let o = ''; pr.stdout.on('data', d => o += d); pr.stderr.on('data', d => o += d);
  await new Promise(r => pr.on('close', r));
  console.log('\n' + f.split('\\').pop() + '  (' + (fs.statSync(f).size / 1e6).toFixed(2) + ' MB)\n' + o.trim());
}
