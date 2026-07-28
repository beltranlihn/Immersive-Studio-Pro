// [R196] ¿Gira de verdad un compose con el control Rotation, y sigue igual con rot=0?
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
const errs = []; await send('Runtime.enable', {});
ws.addEventListener('message', ev => { const x = JSON.parse(ev.data); if (x.method === 'Runtime.exceptionThrown') errs.push(((x.params.exceptionDetails.exception || {}).description || '').slice(0, 200)); });
const evl = async e => { try { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, timeout: 300000 }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 300) }; return r.result.value; } catch (err) { return { CAIDA: String(err.message).slice(0, 140) }; } };
for (let i = 0; i < 150; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await wait(1200);
await evl(`window._autoCf=setInterval(()=>{const b=document.querySelector('#confirmOv #cfCancel'); if(b)b.click();},120), 1`);
await evl(`(async()=>{ const o=document.getElementById('landingOv'); if(o)o.remove(); await openProjectPath('${PROJ}');
  for(let i=0;i<80;i++){ if(state.media.length>2)break; await new Promise(r=>setTimeout(r,400)); } await new Promise(r=>setTimeout(r,4500));
  const t=document.getElementById('tourOv'); if(t)t.remove(); clearInterval(window._autoCf); return 1; })()`);

await evl(`window.CAP=async(N)=>{ N=N||192; state.playhead=0.5; await scrubRender(); await new Promise(r=>setTimeout(r,1200)); render();
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  const cv=document.createElement('canvas'); cv.width=N; cv.height=N; const g=cv.getContext('2d',{willReadFrequently:true});
  g.drawImage(glc,0,0,N,N); const d=g.getImageData(0,0,N,N).data; const px=[]; for(let i=0;i<d.length;i+=4)px.push((d[i]+d[i+1]+d[i+2])/3); return px; };
window.DIF=(a,b)=>{ let se=0,mx=0; for(let i=0;i<a.length;i++){ const dd=a[i]-b[i]; se+=dd*dd; if(Math.abs(dd)>mx)mx=Math.abs(dd); }
  const mse=se/a.length; return {psnr:mse===0?'INFINITO':+(10*Math.log10(255*255/mse)).toFixed(2), maxDif:+mx.toFixed(1)}; }; 1`);

console.log('clip de compose:', await evl(`(()=>{ const c=state.clips.find(x=>{const m=mediaById(x.mediaId);return m&&m.kind==='nest';});
  if(!c)return 'no hay clip de compose'; state.selId=c.id; state.selIds=[c.id]; renderInspector();
  return JSON.stringify({fulldome:!!c.props.fulldome, rot:c.props.rot, az:c.props.az, filasTransform:[...document.querySelectorAll('#tfRows .prow')].map(r=>{const l=r.querySelector('.lab');return l?l.textContent.trim():null;}).filter(Boolean)}); })()`));

console.log('\nrot=0 dos veces (control del arnes, debe ser IDENTICO):', await evl(`(async()=>{
  const c=state.clips.find(x=>{const m=mediaById(x.mediaId);return m&&m.kind==='nest';});
  c.props.rot=0; const a=await CAP(), b=await CAP(); return JSON.stringify(DIF(a,b)); })()`));

console.log('\nrot=0 vs rot=90 (debe DIFERIR):', await evl(`(async()=>{
  const c=state.clips.find(x=>{const m=mediaById(x.mediaId);return m&&m.kind==='nest';});
  c.props.rot=0; const a=await CAP(); c.props.rot=90; const b=await CAP(); c.props.rot=0;
  const d=DIF(a,b); return JSON.stringify({...d, veredicto:(d.psnr!=='INFINITO'&&d.maxDif>20)?'GIRA, correcto':'NO GIRA — sigue muerto'}); })()`));

console.log('\nrot=90 equivale a az+90 (misma rotacion, no otra cosa):', await evl(`(async()=>{
  const c=state.clips.find(x=>{const m=mediaById(x.mediaId);return m&&m.kind==='nest';});
  const az0=c.props.az||0;
  c.props.rot=90; c.props.az=az0; const a=await CAP();
  c.props.rot=0;  c.props.az=az0+90; const b=await CAP();
  c.props.rot=0;  c.props.az=az0;
  const d=DIF(a,b); return JSON.stringify({...d, veredicto:(d.psnr==='INFINITO'||d.maxDif<=1)?'equivalente, correcto':'distinto'}); })()`));

console.log('\nerrores:', errs.length ? errs.slice(0, 6) : 'ninguno');
try { ws.close(); } catch (_) { } try { p.kill('SIGKILL'); } catch (_) { }
