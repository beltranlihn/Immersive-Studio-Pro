// [R205b] Los cuatro hallazgos de la revisión sobre R205:
//   1 · audio (e imagen) esperables → un audio en bucle también se reajusta al reemplazar
//   2 · aviso entre secuencias + ya no se apila un punto de deshacer que descuadraba
//   3 · el plazo de espera se distingue y no se anuncia éxito
//   4 · un archivo ilegible revierte el cambio en vez de dejar el medio desvinculado
import { targets } from './cdp.mjs';
import { spawn } from 'child_process';
const wait = ms => new Promise(r => setTimeout(r, ms));
const ROOT = 'C:\\Users\\beltr\\Desktop\\Alma Digital Studio\\Projects\\Immersive Studio Pro';
const p = spawn(ROOT + '\\node_modules\\electron\\dist\\electron.exe', ['.', '--remote-debugging-port=9222'], { cwd: ROOT, stdio: 'ignore' });
let idx = null;
for (let i = 0; i < 250; i++) { const l = await targets(9222).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(200); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws')); });
let _id = 0;
const send = (m, pr) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: pr })); });
const errs = []; await send('Runtime.enable', {});
ws.addEventListener('message', ev => { const x = JSON.parse(ev.data); if (x.method === 'Runtime.exceptionThrown') errs.push(((x.params.exceptionDetails.exception || {}).description || '').slice(0, 200)); });
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, timeout: 180000 }); return r.exceptionDetails ? JSON.stringify(r.exceptionDetails).slice(0, 400) : r.result.value; };
for (let i = 0; i < 150; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await wait(2500);
// el descartador de diálogos se guarda para poder APAGARLO cuando la prueba quiera ver uno
await evl(`window.__desc=setInterval(()=>{const b=document.querySelector('#confirmOv #cfCancel'); if(b)b.click();},120);1`);

console.log('\n--- material de prueba: dos WAV (5 s y 3 s) y un .wav con basura ---');
console.log(await evl(`(async()=>{
  const wav=(seg,sr)=>{ const n=Math.round(seg*sr), b=new ArrayBuffer(44+n*2), d=new DataView(b);
    const put=(o,s)=>{ for(let i=0;i<s.length;i++)d.setUint8(o+i,s.charCodeAt(i)); };
    put(0,'RIFF'); d.setUint32(4,36+n*2,true); put(8,'WAVE'); put(12,'fmt '); d.setUint32(16,16,true);
    d.setUint16(20,1,true); d.setUint16(22,1,true); d.setUint32(24,sr,true); d.setUint32(28,sr*2,true);
    d.setUint16(32,2,true); d.setUint16(34,16,true); put(36,'data'); d.setUint32(40,n*2,true);
    for(let i=0;i<n;i++)d.setInt16(44+i*2, Math.round(Math.sin(i/20)*8000), true);
    return new Uint8Array(b); };
  const R=${JSON.stringify(ROOT)}+'\\\\scratchpad\\\\';
  await DSP.writeBinary(R+'_r205b_5s.wav', wav(5,44100));
  await DSP.writeBinary(R+'_r205b_3s.wav', wav(3,44100));
  await DSP.writeBinary(R+'_r205b_roto.wav', new Uint8Array([1,2,3,4,5,6,7,8,9,10]));
  return 'ok'; })()`));

console.log('\n--- 1 · AUDIO en bucle: reemplazar 5 s por 3 s reajusta el ciclo ---');
console.log(await evl(`(async()=>{ try{ hideLanding(); }catch(e){}
  await newProject('flat',1920,1080,30);
  const R=${JSON.stringify(ROOT)}+'\\\\scratchpad\\\\', ruta=R+'_r205b_5s.wav';
  const st=await DSP.stat(ruta);
  const m={id:uid(),name:'son.wav',kind:'audio',buffer:null,dur:0,peaks:null,rms:null,thumb:null,
           color:clipColorFor('audio'),path:ruta,fsize:(st&&st.size)||0,folder:null};
  state.media.push(m); await reloadMedia(m); window.__a=m;
  const durTrasCargar=m.dur;
  const lane=state.lanes.findIndex(l=>l.kind==='audio');
  addClip(m,lane,0); const A=state.clips[state.clips.length-1];
  toggleLoop(A); A.dur=12;
  const antes=A.loopLen;
  await replaceMedia(m,R+'_r205b_3s.wav');
  await new Promise(r=>setTimeout(r,800));
  return JSON.stringify({durTrasCargar:+durTrasCargar.toFixed(2), bucleAntes:+antes.toFixed(2),
    durTrasReemplazo:+m.dur.toFixed(2), bucleDespues:+(A.loopLen||0).toFixed(2),
    veredicto:(Math.abs(durTrasCargar-5)<0.1 && Math.abs(m.dur-3)<0.1 && Math.abs(A.loopLen-3)<0.1)
      ? 'correcto: el audio también se lee y su bucle sigue al material'
      : '*** MAL ***'},null,1); })()`));

console.log('\n--- 4 · archivo ILEGIBLE: se revierte y NO se anuncia éxito ---');
console.log(await evl(`(async()=>{
  const R=${JSON.stringify(ROOT)}+'\\\\scratchpad\\\\';
  await newProject('flat',1920,1080,30);
  const ruta=R+'_r205b_5s.wav'; const st=await DSP.stat(ruta);
  const m={id:uid(),name:'son.wav',kind:'audio',buffer:null,dur:0,peaks:null,rms:null,thumb:null,
           color:clipColorFor('audio'),path:ruta,fsize:(st&&st.size)||0,folder:null};
  state.media.push(m); await reloadMedia(m);
  const rutaBuena=m.path, durBuena=m.dur;
  // se apaga el descartador para que el aviso de error no se cierre solo, y se lee su texto
  clearInterval(window.__desc);
  const pr=replaceMedia(m, R+'_r205b_roto.wav');
  await new Promise(r=>setTimeout(r,600));
  const ov=document.getElementById('alertOv');
  const txt=ov?(ov.textContent||'').slice(0,90):'(sin aviso)';
  const b=ov&&ov.querySelector('#alOk'); if(b)b.click();
  await pr; await new Promise(r=>setTimeout(r,900));
  window.__desc=setInterval(()=>{const x=document.querySelector('#confirmOv #cfCancel'); if(x)x.click();},120);
  return JSON.stringify({avisoMostrado:txt, rutaVuelveALaBuena:m.path===rutaBuena,
    durIntacta:Math.abs(m.dur-durBuena)<0.01, medioSano:!m.missing,
    veredicto:(m.path===rutaBuena && !m.missing && /no se pudo leer|could not be read|tipo|type/i.test(txt))
      ? 'correcto: revierte y avisa' : '*** MAL ***'},null,1); })()`));

console.log('\n--- 2 · el reemplazo ya NO apila un punto de deshacer descuadrado ---');
console.log(await evl(`(async()=>{
  const R=${JSON.stringify(ROOT)}+'\\\\scratchpad\\\\';
  await newProject('flat',1920,1080,30);
  const ruta=R+'_r205b_5s.wav'; const st=await DSP.stat(ruta);
  const m={id:uid(),name:'son.wav',kind:'audio',buffer:null,dur:0,peaks:null,rms:null,thumb:null,
           color:clipColorFor('audio'),path:ruta,fsize:(st&&st.size)||0,folder:null};
  state.media.push(m); await reloadMedia(m);
  const lane=state.lanes.findIndex(l=>l.kind==='audio');
  addClip(m,lane,0); const A=state.clips[state.clips.length-1];
  toggleLoop(A); A.dur=12;
  const pila=()=>{ try{ return _ustk().u.length; }catch(e){ return -1; } };
  const antesPila=pila();
  await replaceMedia(m,R+'_r205b_3s.wav'); await new Promise(r=>setTimeout(r,700));
  const bucleTrasReemplazo=A.loopLen, trasPila=pila();
  undo(); await new Promise(r=>setTimeout(r,400));
  const A2=state.clips[0];
  return JSON.stringify({pilaAntes:antesPila, pilaDespues:trasPila,
    bucleTrasReemplazo:+bucleTrasReemplazo.toFixed(2), durMedio:+m.dur.toFixed(2),
    bucleTrasDeshacer:+((A2&&A2.loopLen)||0).toFixed(2),
    veredicto:(trasPila===antesPila && Math.abs(bucleTrasReemplazo-3)<0.1)
      ? 'correcto: no apila punto, así que Ctrl+Z no puede devolver el bucle al material viejo'
      : '*** MAL: sigue apilando y el deshacer descuadra ***'},null,1); })()`));

console.log('\n--- 2b · si el medio se usa en OTRA secuencia, se pregunta antes ---');
console.log(await evl(`(async()=>{
  const R=${JSON.stringify(ROOT)}+'\\\\scratchpad\\\\';
  await newProject('flat',1920,1080,30);
  const ruta=R+'_r205b_5s.wav'; const st=await DSP.stat(ruta);
  const m={id:uid(),name:'son.wav',kind:'audio',buffer:null,dur:0,peaks:null,rms:null,thumb:null,
           color:clipColorFor('audio'),path:ruta,fsize:(st&&st.size)||0,folder:null};
  state.media.push(m); await reloadMedia(m);
  // una SEGUNDA secuencia que usa el mismo medio, sin ser la activa
  const otra=newSeqMedia('Otra',30,1920,1080,null,null,'flat');
  otra.nestClips=[makeClip(m,0,0)]; state.media.push(otra);
  clearInterval(window.__desc);
  const pr=replaceMedia(m, R+'_r205b_3s.wav');
  await new Promise(r=>setTimeout(r,500));
  const ov=document.getElementById('confirmOv');
  const txt=ov?(ov.textContent||'').slice(0,220):'(sin pregunta)';
  const cancelar=ov&&ov.querySelector('#cfCancel'); if(cancelar)cancelar.click();  // se CANCELA
  await pr; await new Promise(r=>setTimeout(r,500));
  const trasCancelar={ruta:m.path.endsWith('_5s.wav'), dur:+m.dur.toFixed(2)};
  window.__desc=setInterval(()=>{const x=document.querySelector('#confirmOv #cfCancel'); if(x)x.click();},120);
  return JSON.stringify({pregunta:txt, alCancelarNoCambiaNada:trasCancelar,
    veredicto:(/Otra/.test(txt) && /Ctrl\\+Z/.test(txt) && trasCancelar.ruta && Math.abs(trasCancelar.dur-5)<0.1)
      ? 'correcto: nombra la otra secuencia, avisa del deshacer, y cancelar no toca nada'
      : '*** MAL ***'},null,1); })()`));

console.log('\nerrores:', errs.length ? errs.slice(0, 6) : 'ninguno');
try { ws.close(); } catch (_) { } try { p.kill('SIGKILL'); } catch (_) { }
