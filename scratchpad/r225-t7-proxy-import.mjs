// [R225·11] Al IMPORTAR un archivo que YA tiene su proxy en la carpeta de origen, el proxy se adjunta SOLO.
// En la carpeta hay un `r225clip.dsp-proxy-<hash>.mp4` con el hash exacto de `path|size` (lo que escribiría makeProxy).
// Se importa por el camino real de la app —`addVideo(file, ruta)`, que es lo que llama `importFiles`— y se comprueba
// que el medio queda proxyReady sin que nadie pida «Generar proxy».
import { evalInApp } from './cdp.mjs';
const RUTA = String.raw`C:\Users\beltr\Desktop\Alma Digital Studio\Projects\Immersive Studio Pro\scratchpad\r225media\r225clip.mp4`.replace(/\\/g,'\\\\');
const expr = `(async function(){
  const R={}; const RUTA='${RUTA}'; const dir=pdir(RUTA);
  state.media=state.media.filter(m=>m.kind==='nest'); state.clips=[]; renderMedia();
  { const files=await DSP.listDir(dir); R.enDisco=files.map(f=>f.name); }
  const blob=await (await fetch(DSP.toFileURL(RUTA))).blob();
  const file=new File([blob],'r225clip.mp4',{type:'video/mp4'});
  const t0=Date.now();
  addVideo(file,RUTA);                                   // === el camino de import ===
  let m=null; while(Date.now()-t0<25000){ await new Promise(r=>setTimeout(r,200)); m=state.media.find(x=>x.kind==='video'&&x.path===RUTA); if(m&&m.proxyReady)break; }
  R.import={ importado:!!m, dur:m&&+m.dur.toFixed(2), proxyReady:!!(m&&m.proxyReady), proxyPct:m&&m.proxyPct,
             proxyPath:m&&m.proxyPath&&pbase(m.proxyPath), pw:m&&m.pw, ph:m&&m.ph,
             elVisorUsaElProxy:!!(m&&_vinstUrl(m)===m.proxyUrl), generandoAhora:!!(m&&m._pxGen), ms:Date.now()-t0 };
  R.seEnganchoSoloAlImportar = !!(m&&m.proxyReady&&!m._pxGen);
  // la generación sigue siendo MANUAL: nadie encoló nada
  R.colaDeProxies=proxyQ.length;
  // el badge de la ficha lo dice
  renderMedia(); await new Promise(r=>setTimeout(r,120));
  R.badge=[...document.querySelectorAll('#mediaList .cpx, #mediaList [class*=px]')].map(e=>(e.textContent||'').trim()).filter(Boolean).slice(0,4);
  return {R, errs:window.__errs};
})()`;
evalInApp(expr).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error('ERR',e.message);process.exit(1);});
