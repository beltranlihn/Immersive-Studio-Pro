// [R192] ¿El proxy de composición muestra LO MISMO que la composición recompuesta?
// El arnés se valida a sí mismo ANTES de comparar nada: si la misma configuración no da dos capturas idénticas,
// cualquier diferencia que midiera después sería ruido mío, no del programa. (Ya me pasó dos veces.)
import { targets } from './cdp.mjs';
import { spawn } from 'child_process';
import fs from 'fs';
const wait = ms => new Promise(r => setTimeout(r, ms));
const ROOT = 'C:\\Users\\beltr\\Desktop\\Alma Digital Studio\\Projects\\Immersive Studio Pro';
const WORK = 'C:\\Users\\beltr\\AppData\\Local\\Temp\\claude\\ncwork';
// Se trabaja sobre una COPIA: ncBuild escribe una carpeta "nest proxies" junto al proyecto y no toca su escritorio.
fs.rmSync(WORK, { recursive: true, force: true }); fs.mkdirSync(WORK, { recursive: true });
fs.copyFileSync('C:\\Users\\beltr\\Desktop\\untitled.isp', WORK + '\\prueba.isp');
const PROJ = (WORK + '\\prueba.isp').replace(/\\/g, '\\\\');

const p = spawn(ROOT + '\\node_modules\\electron\\dist\\electron.exe', ['.', '--remote-debugging-port=9222'], { cwd: ROOT, stdio: 'ignore' });
let idx = null;
for (let i = 0; i < 250; i++) { const l = await targets(9222).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(200); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws')); });
let _id = 0;
const send = (m, pr) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: pr })); });
const errs = []; await send('Runtime.enable', {});
ws.addEventListener('message', ev => { const x = JSON.parse(ev.data); if (x.method === 'Runtime.exceptionThrown') errs.push(((x.params.exceptionDetails.exception || {}).description || '').slice(0, 200)); });
const evl = async e => { try { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, timeout: 1800000 }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 350) }; return r.result.value; } catch (err) { return { CAIDA: String(err.message).slice(0, 140) }; } };
for (let i = 0; i < 150; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await wait(1200);
await evl(`window._autoCf=setInterval(()=>{const b=document.querySelector('#confirmOv #cfCancel'); if(b)b.click();},120), 1`);
await evl(`(async()=>{ const o=document.getElementById('landingOv'); if(o)o.remove(); await openProjectPath('${PROJ}');
  for(let i=0;i<80;i++){ if(state.media.length>2)break; await new Promise(r=>setTimeout(r,400)); } await new Promise(r=>setTimeout(r,4500));
  const t=document.getElementById('tourOv'); if(t)t.remove(); clearInterval(window._autoCf); return 1; })()`);

// --- utilidades que se instalan en la página ---
await evl(`
window.NC={};
NC.nest=()=>state.media.find(m=>m.kind==='nest'&&(m.nestClips||[]).length&&m.nestClips.some(c=>{const q=mediaById(c.mediaId);return q&&q.kind==='video';}));
NC.clipDeNest=()=>state.clips.find(c=>{const m=mediaById(c.mediaId);return m&&m.kind==='nest';});
/* Captura del visor a N×N. Se exige ANTES que el nest tenga textura: sin esa comprobación, una captura tomada
   mientras el <video> del caché todavía carga sale sin la composición y parece una diferencia enorme del programa
   cuando es una carrera del arnés. */
NC.cap=async(t,N)=>{ N=N||256;
  state.playhead=t; await scrubRender(); await new Promise(r=>setTimeout(r,1400)); render();
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  const c=NC.clipDeNest(); const conTex=!!(c&&c._ntex);
  const m=NC.nest(); const vi=c?_vinst.get(c.id):null;
  const cv=document.createElement('canvas'); cv.width=N; cv.height=N; const g=cv.getContext('2d',{willReadFrequently:true});
  g.drawImage(glc,0,0,N,N); const d=g.getImageData(0,0,N,N).data;
  const px=new Float64Array(N*N); let sum=0,cx=0,cy=0;
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){ const i=(y*N+x)*4; const v=(d[i]+d[i+1]+d[i+2])/3; px[y*N+x]=v; sum+=v; cx+=v*x; cy+=v*y; }
  return {px:Array.from(px), N, luz:+(sum/(N*N)).toFixed(4), cx:sum?+(cx/sum).toFixed(3):null, cy:sum?+(cy/sum).toFixed(3):null,
          conTex, cacheEnUso:ncUsable(m), vidListo:!!(vi&&vi.ready) };
};
NC.cmp=(a,b)=>{ if(!a.px||!b.px)return {error:'captura vacia'};
  let se=0,mx=0; for(let i=0;i<a.px.length;i++){ const d=a.px[i]-b.px[i]; se+=d*d; if(Math.abs(d)>mx)mx=Math.abs(d); }
  const mse=se/a.px.length;
  return { psnr: mse===0?'INFINITO':+(10*Math.log10(255*255/mse)).toFixed(2), maxDif:+mx.toFixed(1),
           desplazamiento:{x:+(b.cx-a.cx).toFixed(3), y:+(b.cy-a.cy).toFixed(3)}, luzA:a.luz, luzB:b.luz }; };
1`);

console.log('nest:', await evl(`(()=>{ const m=NC.nest(); const c=NC.clipDeNest();
  return JSON.stringify({nombre:m&&m.name, lienzo:m&&(m.w+'x'+m.h), modo:m&&m.mode, clipsDentro:m&&(m.nestClips||[]).length,
    hayClipDeNestEnRaiz:!!c, secuencia:state.seqW+'x'+state.seqH, cov:state.seqCov, nestSize:(typeof nestSize!=='undefined'?nestSize:null)}); })()`));

// ---------- PASO 0: ¿es determinista el arnés? ----------
console.log('\n=== PASO 0 · validacion del arnes (misma configuracion, dos capturas) ===');
console.log('a · misma configuracion, dos capturas (debe ser IDENTICO):', await evl(`(async()=>{ state.view.useNestCache=false; disposeAllVinst();
  const a=await NC.cap(0.4), b=await NC.cap(0.4);
  return JSON.stringify({estadoA:{conTex:a.conTex,cache:a.cacheEnUso}, cmp:NC.cmp(a,b)}); })()`));
/* Esta segunda comprobación es la que faltaba: si dos instantes distintos dan la MISMA captura, el arnés no está
   moviendo el cabezal y toda comparación posterior mide un fotograma congelado. Es exactamente el fallo que tuve
   (escribía `state.t`, que no existe, en vez de `state.playhead`). */
console.log('b · dos tiempos distintos (debe DIFERIR):', await evl(`(async()=>{
  const a=await NC.cap(0.25), b=await NC.cap(1.05);
  const c=NC.cmp(a,b); return JSON.stringify({cmp:c, veredicto:(c.psnr==='INFINITO'||c.maxDif<1)?'EL ARNES NO MUEVE EL CABEZAL':'el cabezal se mueve, ok'}); })()`));

// ---------- PASO 1: hornear el proxy ----------
console.log('\n=== PASO 1 · hornear el proxy ===');
console.log('codificadores disponibles a 4096²:', await evl(`(async()=>{ const c=await ripCodecOptions(4096,4096,60); return JSON.stringify(c.map(x=>x.kind+' ('+x.label+')')); })()`));
console.log(await evl(`(async()=>{ const m=NC.nest();
  window.ncDialog=async(mm,opts)=>opts;                       // se acepta el dialogo sin persona delante
  let usado=null; const orig=runExport; window.runExport=function(o){ usado=o.codec+' @ '+o.outW+'x'+o.outH; return orig(o); };
  const t0=performance.now(); await ncBuild(m); window.runExport=orig;
  const seg=(performance.now()-t0)/1000, n=Math.round((m.dur||1)*(m.fps||60));
  return JSON.stringify({segundos:+seg.toFixed(1), fotogramas:n, sPorFotograma:+(seg/Math.max(1,n)).toFixed(2), codecUsado:usado,
    ncPath:(m.ncPath||'').split('\\\\').pop(), ncW:m.ncW, ncH:m.ncH, listo:!!m.ncReady, rancio:!!m.ncStale}); })()`));

// ---------- PASO 2: la comparacion real ----------
console.log('\n=== PASO 2 · con proxy vs recompuesto ===');
for (const t of [0.3, 0.7, 1.1]) {
  console.log('t=' + t + ':', await evl(`(async()=>{
    state.view.useNestCache=false; disposeAllVinst(); const sin=await NC.cap(${t});
    state.view.useNestCache=true;  disposeAllVinst(); const con=await NC.cap(${t});
    return JSON.stringify({ sinCache:{conTex:sin.conTex,cacheEnUso:sin.cacheEnUso,luz:sin.luz},
      conCache:{conTex:con.conTex,cacheEnUso:con.cacheEnUso,vidListo:con.vidListo,luz:con.luz},
      cmp:NC.cmp(sin,con) }); })()`));
}

console.log('\nerrores:', errs.length ? errs.slice(0, 8) : 'ninguno');
try { ws.close(); } catch (_) { } try { p.kill('SIGKILL'); } catch (_) { }
