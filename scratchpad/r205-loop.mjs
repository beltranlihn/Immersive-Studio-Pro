// [R205] Reemplazar un medio por otro de duración distinta (el caso del upscale):
//   · la duración del medio se refresca de verdad (antes se quedaba la vieja)
//   · un bucle que abarcaba TODO el clip se reescala a la duración nueva
//   · un bucle que era un TROZO elegido a mano se respeta
//   · los clips sin bucle no se tocan, sólo se avisa
import { targets } from './cdp.mjs';
import { spawn } from 'child_process';
const wait = ms => new Promise(r => setTimeout(r, ms));
const ROOT = 'C:\\Users\\beltr\\Desktop\\Alma Digital Studio\\Projects\\Immersive Studio Pro';
const VIEJO = process.argv[2] === 'viejo', PORT = VIEJO ? 9223 : 9222;
const p = VIEJO
  ? spawn('C:\\Users\\beltr\\AppData\\Local\\Programs\\Immersive Studio Pro\\Immersive Studio Pro.exe', ['--remote-debugging-port=' + PORT], { stdio: 'ignore' })
  : spawn(ROOT + '\\node_modules\\electron\\dist\\electron.exe', ['.', '--remote-debugging-port=' + PORT], { cwd: ROOT, stdio: 'ignore' });
console.log(VIEJO ? '=== CONTROL: .exe instalado (R204, sin reconciliación) ===' : '=== dev (R205) ===');
let idx = null;
for (let i = 0; i < 250; i++) { const l = await targets(PORT).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(200); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws')); });
let _id = 0;
const send = (m, pr) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: pr })); });
const errs = []; await send('Runtime.enable', {});
ws.addEventListener('message', ev => { const x = JSON.parse(ev.data); if (x.method === 'Runtime.exceptionThrown') errs.push(((x.params.exceptionDetails.exception || {}).description || '').slice(0, 200)); });
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, timeout: 180000 }); return r.exceptionDetails ? JSON.stringify(r.exceptionDetails).slice(0, 400) : r.result.value; };
for (let i = 0; i < 150; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await wait(2500);
await evl(`setInterval(()=>{const b=document.querySelector('#confirmOv #cfCancel'); if(b)b.click();},120);1`);

/* Se fabrican DOS vídeos reales con el propio exportador del programa (WebCodecs + mp4-muxer), de 6 s y 4 s:
   hacen de "original" y de "upscale que cambió de duración". Se comprueba la duración leída del archivo. */
console.log('\nfabricando dos vídeos de prueba (6 s y 4 s)…');
console.log(await evl(`(async()=>{
  window.__fab=async(seg,fps,nombre)=>{
    const W=256,H=256, cv=document.createElement('canvas'); cv.width=W; cv.height=H; const cx=cv.getContext('2d');
    const mx=new Mp4Muxer.Muxer({target:new Mp4Muxer.ArrayBufferTarget(),video:{codec:'avc',width:W,height:H},fastStart:'in-memory'});
    const enc=new VideoEncoder({output:(ch,meta)=>mx.addVideoChunk(ch,meta),error:e=>console.error(e)});
    enc.configure({codec:'avc1.42001f',width:W,height:H,bitrate:400000,framerate:fps});
    const total=Math.round(seg*fps);
    for(let i=0;i<total;i++){ cx.fillStyle='hsl('+(i*7%360)+',70%,50%)'; cx.fillRect(0,0,W,H);
      const fr=new VideoFrame(cv,{timestamp:Math.round(i*1e6/fps),duration:Math.round(1e6/fps)});
      enc.encode(fr,{keyFrame:i%30===0}); fr.close(); if(i%30===0)await enc.flush().catch(()=>{}); }
    await enc.flush(); mx.finalize();
    const buf=mx.target.buffer; const ruta=${JSON.stringify(ROOT)}+'\\\\scratchpad\\\\'+nombre;
    await DSP.writeBinary(ruta,new Uint8Array(buf)); return ruta; };
  const a=await window.__fab(6,30,'_r205_largo.mp4');
  const b=await window.__fab(4,30,'_r205_corto.mp4');
  return JSON.stringify({largo:a,corto:b}); })()`));

console.log('\n--- montaje: 3 clips del vídeo de 6 s ---');
console.log(await evl(`(async()=>{ try{ hideLanding(); }catch(e){}
  await newProject('flat',1920,1080,30);
  const ruta=${JSON.stringify(ROOT)}+'\\\\scratchpad\\\\_r205_largo.mp4';
  const st=await DSP.stat(ruta);
  const m={id:uid(),name:'clip.mp4',kind:'video',el:null,originalEl:null,tex:null,w:256,h:256,dur:0,fps:30,
           thumb:null,color:clipColorFor('video'),proxyReady:false,proxyPct:0,path:ruta,fsize:(st&&st.size)||0,folder:null};
  state.media.push(m); await reloadMedia(m); window.__m=m;
  const lane=ensureVideoLanes(1)[0];
  // A: bucle que abarca TODO el clip · B: bucle de un TROZO (2 s) · C: sin bucle
  addClip(m,lane,0);   const A=state.clips[state.clips.length-1];
  addClip(m,lane,20);  const B=state.clips[state.clips.length-1];
  addClip(m,lane,40);  const C=state.clips[state.clips.length-1];
  toggleLoop(A); A.dur=15;                       // estirado, como haría Beltrán
  B.dur=2; toggleLoop(B); B.dur=9;               // ciclo de 2 s, estirado a 9
  return JSON.stringify({durMedio:+m.dur.toFixed(3),
    A:{loop:!!A.loop,loopLen:+(A.loopLen||0).toFixed(3),dur:A.dur},
    B:{loop:!!B.loop,loopLen:+(B.loopLen||0).toFixed(3),dur:B.dur},
    C:{loop:!!C.loop,dur:C.dur}},null,1); })()`));

console.log('\n--- reemplazo por el de 4 s (MÁS CORTO) ---');
console.log(await evl(`(async()=>{
  const m=window.__m, ruta=${JSON.stringify(ROOT)}+'\\\\scratchpad\\\\_r205_corto.mp4';
  /* Se le pasa la ruta a la funcion REAL: DSP viaja congelado por contextBridge y sustituirle pickMedia desde
     fuera no surte efecto — el dialogo se abria de verdad y la prueba se quedaba esperando.
     En el build VIEJO esa entrada no existe, asi que alli se hace lo mismo que hacia el: cambiar el archivo del
     medio y recargarlo, sin reconciliar. Es un control honesto: mismas operaciones, codigo antiguo. */
  if(replaceMedia.length>=2){ await replaceMedia(m,ruta); }
  else { const st=await DSP.stat(ruta); m.path=ruta; m.fsize=(st&&st.size)||0; m.name=DSP.basename(ruta);
         m.proxyReady=false; m.proxyUrl=null; m.proxyEl=null; try{disposeAllVinst();}catch(e){} await reloadMedia(m); }
  await new Promise(r=>setTimeout(r,2500));
  const [A,B,C]=state.clips;
  const est=document.getElementById('statInfo');
  return JSON.stringify({
    durMedioTrasReemplazo:+m.dur.toFixed(3),
    A_bucleEntero:{loopLen:+(A.loopLen||0).toFixed(3), esperado:'≈4.0 (toda la duración nueva)'},
    B_bucleDeTrozo:{loopLen:+(B.loopLen||0).toFixed(3), esperado:'2.0 (intacto)'},
    C_sinBucle:{dur:C.dur, loop:!!C.loop},
    veredicto:(Math.abs(m.dur-4)<0.2 && Math.abs(A.loopLen-m.dur)<0.05 && Math.abs(B.loopLen-2)<0.05)
      ? 'correcto: duración refrescada · bucle entero reescalado · trozo respetado'
      : '*** MAL ***'},null,1); })()`));

console.log('\n--- y ahora al revés: de 4 s al de 6 s (MÁS LARGO) ---');
console.log(await evl(`(async()=>{
  const m=window.__m, ruta=${JSON.stringify(ROOT)}+'\\\\scratchpad\\\\_r205_largo.mp4';
  if(replaceMedia.length>=2){ await replaceMedia(m,ruta); }
  else { const st=await DSP.stat(ruta); m.path=ruta; m.fsize=(st&&st.size)||0; m.name=DSP.basename(ruta);
         m.proxyReady=false; m.proxyUrl=null; m.proxyEl=null; try{disposeAllVinst();}catch(e){} await reloadMedia(m); }
  await new Promise(r=>setTimeout(r,2500));
  const [A,B]=state.clips;
  return JSON.stringify({
    durMedio:+m.dur.toFixed(3),
    A_bucleEntero:+(A.loopLen||0).toFixed(3),
    B_bucleDeTrozo:+(B.loopLen||0).toFixed(3),
    veredicto:(Math.abs(m.dur-6)<0.2 && Math.abs(A.loopLen-m.dur)<0.05 && Math.abs(B.loopLen-2)<0.05)
      ? 'correcto: el ciclo entero vuelve a cubrir todo el material'
      : '*** MAL ***'},null,1); })()`));

console.log('\nerrores:', errs.length ? errs.slice(0, 6) : 'ninguno');
try { ws.close(); } catch (_) { } try { p.kill('SIGKILL'); } catch (_) { }
