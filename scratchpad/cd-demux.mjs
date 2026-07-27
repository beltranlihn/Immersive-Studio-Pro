// ¿Por qué demuxMP4 rechaza los archivos de Beltrán?
import { targets } from './cdp.mjs';
import { spawn } from 'child_process';
const wait = ms => new Promise(r => setTimeout(r, ms));
const ROOT = 'C:\\Users\\beltr\\Desktop\\Alma Digital Studio\\Projects\\Immersive Studio Pro';
const PROJ = 'C:\\\\Users\\\\beltr\\\\Desktop\\\\untitled.isp';
const p = spawn(ROOT + '\\node_modules\\electron\\dist\\electron.exe', ['.', '--remote-debugging-port=9222'], { cwd: ROOT, stdio: 'ignore' });
let idx = null;
for (let i = 0; i < 250; i++) { const l = await targets(9222).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(200); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws')); });
let _id = 0;
const send = (m, pr) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: pr })); });
await send('Runtime.enable', {});
const evl = async e => { try { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, timeout: 600000 }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 300) }; return r.result.value; } catch (err) { return { CAIDA: String(err.message).slice(0, 140) }; } };
for (let i = 0; i < 150; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await wait(1200);
// El autoguardado "más reciente" (lo deja cada SIGKILL de estas pruebas) abre un confirm que cuelga el script → se responde "Abrir el archivo".
await evl(`window._autoCf=setInterval(()=>{const b=document.querySelector('#confirmOv #cfCancel'); if(b)b.click();},120), 1`);
await evl(`(async()=>{ const o=document.getElementById('landingOv'); if(o)o.remove(); await openProjectPath('${PROJ}');
  for(let i=0;i<80;i++){ if(state.media.length>2)break; await new Promise(r=>setTimeout(r,400)); } await new Promise(r=>setTimeout(r,4000));
  const t=document.getElementById('tourOv'); if(t)t.remove(); return 1; })()`);

console.log('demux de cada archivo:', await evl(`(async()=>{ const out=[];
  for(const m of state.media){ if(m.kind!=='video'||!m.path)continue;
    try{ const d=await demuxMP4(m.path);
      out.push({n:m.name, ok:true, codec:d.codec, fmt:d.fmt, muestras:d.samples.length, fps:+d.fps.toFixed(2), coded:d.codedWidth+'x'+d.codedHeight});
      d.close();
    }catch(e){ out.push({n:m.name, ok:false, error:String(e&&e.message||e)}); } }
  return JSON.stringify(out,null,1); })()`));

console.log('\nestructura de todos los clips (raiz + nests):', await evl(`(async()=>{
  const info={raiz:state.clips.map(c=>{const m=mediaById(c.mediaId); return (m?m.kind:'?')+':'+(m?m.name:'?');}), nests:{}};
  for(const m of state.media) if(m.kind==='nest'&&m.nestClips) info.nests[m.name]=m.nestClips.map(c=>{const q=mediaById(c.mediaId); return (q?q.kind+':'+q.name:'?')+' in='+(c.in||0).toFixed(2);});
  return JSON.stringify(info,null,1); })()`));

try { ws.close(); } catch (_) { } try { p.kill('SIGKILL'); } catch (_) { }
