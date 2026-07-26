// Verificación del waveform con un archivo REAL (Umbral.wav · 35.6s · 44.1k · 24-bit estéreo).
// No basta con que dibuje algo: hay que comprobar que la amplitud es la del archivo, que no se recorta,
// que el RMS revela dinámica (no un bloque macizo) y que el análisis por bandas responde a música.
import { targets } from './cdp.mjs';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let idx=null; for(let i=0;i<150;i++){const l=await targets(9222).catch(()=>[]);idx=l.find(t=>t.type==='page'&&/index\.html/.test(t.url||'')&&t.webSocketDebuggerUrl);if(idx)break;await wait(200);}
if(!idx){console.log('sin editor');process.exit(1);}
const ws=new WebSocket(idx.webSocketDebuggerUrl); await new Promise((r,j)=>{ws.onopen=r;ws.onerror=()=>j(new Error('ws'))});
let _id=0; const send=(m,p)=>new Promise((res,rej)=>{const id=++_id;const h=ev=>{const x=JSON.parse(ev.data);if(x.id!==id)return;ws.removeEventListener('message',h);x.error?rej(new Error(JSON.stringify(x.error))):res(x.result)};ws.addEventListener('message',h);ws.send(JSON.stringify({id,method:m,params:p}))});
const errs=[]; await send('Runtime.enable',{});
ws.addEventListener('message',ev=>{const x=JSON.parse(ev.data); if(x.method==='Runtime.consoleAPICalled'&&x.params.type==='error')errs.push((x.params.args||[]).map(a=>a.value||a.description||'').join(' ').slice(0,220));});
await send('Page.reload',{ignoreCache:true}); await wait(2300);
const evl=async e=>{const r=await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)return{ROTO:JSON.stringify(r.exceptionDetails).slice(0,400)};return r.result.value};
for(let i=0;i<80;i++){ if(await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")')===true)break; await wait(400); }
await evl(`(()=>{try{localStorage.setItem('dspOnboardV1','1')}catch(e){}document.querySelectorAll('.overlay,#tourOv,#landingOv').forEach(o=>o.remove());document.body.classList.remove('preboot');try{resize()}catch(e){}return 1})()`);
await evl(`(async()=>{ state.dirty=false; await buildDemoProject(); return 1; })()`); await wait(800);

const RUTA='C:\\Users\\beltr\\Desktop\\Alma Digital Studio\\Projects\\VR Unreal\\Recursos\\Audio\\Breath\\Umbral.wav';
console.log('importando…');
const imp = await evl(`(async()=>{
  const buf = await DSP.readBinary ? DSP.readBinary('${RUTA}') : null;
  let file;
  if(buf){ const u8=new Uint8Array(buf); file=new File([u8],'Umbral.wav',{type:'audio/wav'}); }
  else { const r=await fetch('file:///C:/Users/beltr/Desktop/Alma Digital Studio/Projects/VR Unreal/Recursos/Audio/Breath/Umbral.wav');
         file=new File([await r.blob()],'Umbral.wav',{type:'audio/wav'}); }
  const antes=state.media.length;
  addAudio(file,'${RUTA}');
  for(let i=0;i<120;i++){ if(state.media.length>antes) break; await new Promise(r=>setTimeout(r,150)); }
  const m=state.media.find(x=>x.name==='Umbral.wav');
  if(!m) return {importado:false};
  for(let i=0;i<120;i++){ if(m.peaks&&m.peaks.length) break; await new Promise(r=>setTimeout(r,150)); }
  return {importado:true, id:m.id, dur:+m.dur.toFixed(2), canales:m.buffer?m.buffer.numberOfChannels:null,
    hz:m.buffer?m.buffer.sampleRate:null, muestras:m.buffer?m.buffer.length:null, cubos:m.peaks?m.peaks.length:0};
})()`);
console.log('import   ', JSON.stringify(imp));
if(!imp || !imp.importado){ console.log('no se pudo importar'); ws.close(); process.exit(1); }

console.log('onda     ', JSON.stringify(await evl(`(()=>{ const m=state.media.find(x=>x.name==='Umbral.wav');
  const P=Array.from(m.peaks), R=Array.from(m.rms||[]);
  const max=Math.max(...P), min=Math.min(...P);
  const prom=P.reduce((a,b)=>a+b,0)/P.length;
  const recortados=P.filter(v=>v>=0.999).length;            // ¿pega en el techo?
  const silencio=P.filter(v=>v<0.01).length;                 // ¿hay silencios de verdad?
  const rmsMax=R.length?Math.max(...R):null, rmsProm=R.length?R.reduce((a,b)=>a+b,0)/R.length:null;
  // dinámica: cuánto se separa el pico del cuerpo RMS (un bloque macizo daría casi 1)
  const dinamica=rmsProm?+(prom/rmsProm).toFixed(2):null;
  // comparación contra la fuente: pico real leído del propio AudioBuffer
  const ch=m.buffer.getChannelData(0); let picoReal=0; for(let i=0;i<ch.length;i+=7){const a=Math.abs(ch[i]); if(a>picoReal)picoReal=a;}
  return { picoDeLaOnda:+max.toFixed(4), picoDelArchivo:+picoReal.toFixed(4),
    coinciden:Math.abs(max-picoReal)<0.02, minimo:+min.toFixed(4), promedio:+prom.toFixed(4),
    cubosRecortados:recortados, cubosEnSilencio:silencio, rmsMax:rmsMax&&+rmsMax.toFixed(4),
    picoSobreRms:dinamica, miniatura:!!m.thumb }; })()`)));

console.log('bandas   ', JSON.stringify(await evl(`(async()=>{ const m=state.media.find(x=>x.name==='Umbral.wav');
  if(typeof armMediaBands!=='function') return {sinFuncion:true};
  armMediaBands(m);
  for(let i=0;i<200;i++){ if(m.bands) break; await new Promise(r=>setTimeout(r,150)); }
  if(!m.bands) return {noAnalizo:true};
  const b=m.bands, nom=Object.keys(b).filter(k=>b[k]&&b[k].length);
  const est=k=>{ const a=b[k]; const mx=Math.max(...a), pr=a.reduce((x,y)=>x+y,0)/a.length; return {max:+mx.toFixed(3), prom:+pr.toFixed(3), varia:+(mx-Math.min(...a)).toFixed(3)}; };
  const r={bandas:nom}; for(const k of nom) r[k]=est(k);
  r.espectro = b.spec? {columnas:b.spec.length} : 'sin spec';
  return r; })()`)));

// dibujarla en el timeline y comprobar que el lienzo tiene tinta de verdad
console.log('dibujo   ', JSON.stringify(await evl(`(()=>{ const m=state.media.find(x=>x.name==='Umbral.wav');
  const ai=state.lanes.findIndex(l=>l.kind==='audio');
  state.clips.push({id:uid(),name:m.name,mediaId:m.id,lane:ai,start:0,dur:Math.min(20,m.dur),inP:0,props:{},kf:{},color:m.color,fadeIn:0,fadeOut:0});
  renderTimeline(); try{redrawAudioWaves();}catch(e){}
  const cv=document.querySelector('#tracks canvas.awave');
  if(!cv) return {sinLienzo:true};
  const x=cv.getContext('2d'); const d=x.getImageData(0,0,cv.width,cv.height).data;
  let pintados=0; for(let i=3;i<d.length;i+=4*17) if(d[i]>8) pintados++;
  return { lienzo:[cv.width,cv.height], muestrasConTinta:pintados, proporcion:+(pintados/(d.length/(4*17))).toFixed(3) }; })()`)));
await wait(500);
console.log('errores :', errs.length?errs:'ninguno');
ws.close();
