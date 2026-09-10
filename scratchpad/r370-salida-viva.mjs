/* [R370] SONDA — la salida en vivo (NDI / Spout) emite el máster del MODO ACTUAL, no siempre el de domo.
   ───────────────────────────────────────────────────────────────────────────────────────────────────────────
   Antes: `ndiTick`/`spoutTick` forzaban `_drawFlat=false` con el comentario «ALWAYS the fulldome master», así
   que en 2D y en sala emitían el composite reproyectado a domo — para una instalación de sala 360, que es
   justo donde hace falta, la salida en vivo no servía.

   Qué mide, y en qué orden importa:
     [1] la GEOMETRÍA que se va a emitir (`salidaVivaRect`) en los tres modos y con dos aspectos distintos;
     [2] los PÍXELES: se ejecuta el `ndiTick` REAL y se mide SU PROPIO búfer (`_ndiBuf`), que es exactamente lo
         que la función entrega a `DSP.ndi.send`; se comprueba que mide lo anunciado, que lleva contenido y que
         NO arrastra banda negra (el defecto de leer el cuadrado entero en vez de la banda);
     [3] la etiqueta del menú, que antes decía «Dome master» en los tres modos.

   Y SABE FALLAR: el control negativo reconstruye el estado anterior forzando el rect al cuadrado completo
   (que es lo que hacía el código viejo) y EXIGE que aparezca la banda negra que hoy no está.

   Uso:  matar la app  ->  npx electron . --remote-debugging-port=9222  ->  node scratchpad/r370-salida-viva.mjs
*/
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const PORT = 9222;
const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const ISP  = path.join(RAIZ, 'r370-viva.isp');
const IMG  = path.join(RAIZ, '..', 'assets', 'immersive-logo.png');

/* Secuencia 16:9 — un aspecto NO cuadrado es lo único que distingue «emitir la banda» de «emitir el cuadrado». */
const SEQ = 901;
const PROPS = { az:0, el:0, size:80, rot:0, spin:0, mirror:false, opacity:100, blur:0, feather:0, crop:0,
  mask:'none', blend:'normal', exposure:0, contrast:0, saturation:0, temperature:0, tint:0, glow:0, chroma:0,
  react:'none', reactAmt:60, fulldome:false, fisheye:false, fisheyeAmt:60, equirect:false, eqPitch:0,
  blackKey:false, blackKeyAmt:15, blackKeySoft:30, warp:'patch', secAz:60, secEl:30, volume:100,
  x:0, y:0, scale:60, lut:null, lutMix:100,
  curves:{ l:[[0,0],[1,1]], r:[[0,0],[1,1]], g:[[0,0],[1,1]], b:[[0,0],[1,1]] } };
fs.writeFileSync(ISP, JSON.stringify({
  app:'DomeStudioPro', v:4, managed:false, fps:60, playhead:0, markers:[], groups:[], clips:[],
  media:[
    { id:801, name:'immersive-logo.png', kind:'image', w:1060, h:1081, mode:null, cov:null, room:null,
      dur:10, fps:0, color:'#B34FB3', path:IMG, fsize:0, folder:null, framePaths:null },
    { id:SEQ, name:'MAIN', kind:'nest', w:1920, h:1080, dur:10, fps:60, mode:'flat', cov:null, room:null,
      nestClips:[{ id:820, mediaId:801, name:'immersive-logo.png', lane:1, start:0, dur:10, inP:0,
        color:'#B34FB3', fadeIn:0, fadeOut:0, props:JSON.parse(JSON.stringify(PROPS)),
        kf:{}, fx:[], penMasks:[], anim:[] }],
      nestLanes:[{id:7,name:'Audio 1',tag:'A1',kind:'audio',h:78},{id:8,name:'Video 1',tag:'V1',kind:'video',h:78}],
      nestMarkers:[], nestGroups:[], nestPlayhead:0, nestWorkIn:0, nestWorkOut:10 } ],
  workIn:null, workOut:null, folders:[], folderColors:{},
  tl:{ bpm:120, sig:4, tcMode:'timecode', pxPerSec:60, inlineCurves:false },
  exportPresets:[], openSeqs:[SEQ], activeSeqId:SEQ, seqW:1920, seqH:1080, reactive:null, autoItems:{},
}, null, 1));

const lista = () => new Promise((res, rej) => {
  http.get({ host:'127.0.0.1', port:PORT, path:'/json/list' }, r => {
    let b=''; r.on('data',c=>b+=c); r.on('end',()=>{ try{res(JSON.parse(b));}catch(e){rej(e);} });
  }).on('error', rej);
});
async function evalEn(url, expr, ms=120000) {
  const ws = new WebSocket(url);
  await new Promise((res,rej)=>{ ws.onopen=res; ws.onerror=()=>rej(new Error('ws no conecta')); });
  try {
    return await new Promise((res,rej)=>{
      const t=setTimeout(()=>rej(new Error('CDP sin respuesta en '+ms+' ms')), ms);
      ws.onmessage=ev=>{ const m=JSON.parse(ev.data); if(m.id!==1)return; clearTimeout(t);
        if(m.error)return rej(new Error('CDP: '+JSON.stringify(m.error)));
        const r=m.result;
        if(r.exceptionDetails)return rej(new Error('la pagina reventó: '+((r.exceptionDetails.exception&&(r.exceptionDetails.exception.description||r.exceptionDetails.exception.value))||r.exceptionDetails.text)));
        res(r.result.value); };
      ws.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:expr,awaitPromise:true,returnByValue:true,timeout:ms}}));
    });
  } finally { try{ws.close();}catch(_){} }
}
const dormir = ms => new Promise(r=>setTimeout(r,ms));
const fallos = [];
const exigir = (ok,msg) => { console.log((ok?'  ✔ ':'  ✘ ')+msg); if(!ok)fallos.push(msg); };

/* Ejecuta el `ndiTick` REAL y mide SU PROPIO bufer (`_ndiBuf`), que es exactamente lo que la funcion entrega a
   `DSP.ndi.send`. No se sustituye el puente `DSP` -es de solo lectura (contextBridge) y el primer intento de
   esta sonda se quedo sin medir nada por eso- ni se emite a la red: `readPixels` llena el bufer ANTES del
   envio, y si no hay emisor levantado el `catch` del propio tick absorbe el fallo del envio.
   `forzarCuadrado` reconstruye el codigo ANTERIOR (leer el cuadrado entero en vez de la banda). */
const TICK = (modo, forzarCuadrado) => `(()=>{
  state.seqMode=${JSON.stringify(modo)};
  const rectOrig = salidaVivaRect;
  ${forzarCuadrado ? 'salidaVivaRect = r => ({x:0,y:0,w:r,h:r});' : ''}
  const R = salidaVivaRect(512);
  const onBak=_ndiOn, resBak=_ndiRes, ckBak=_ndiCacheKey, bufBak=_ndiBuf;
  _ndiOn=true; _ndiRes=512; _ndiCacheKey=null; _ndiBuf=null; _closeNdiGL();
  let out;
  try {
    ndiTick();
    const b=_ndiBuf;
    if(!b) out={ error:'ndiTick no lleno el bufer' };
    else { let noNegro=0; for(let i=0;i<b.length;i+=4) if(b[i]||b[i+1]||b[i+2]) noNegro++;
      const n=b.length>>2;
      out={ w:R.w, h:R.h, n:b.length, esperado:R.w*R.h*4, pctNoNegro:+(100*noNegro/n).toFixed(1) }; }
  } finally { _ndiOn=onBak; _ndiRes=resBak; _ndiCacheKey=ckBak; _ndiBuf=bufBak;
              salidaVivaRect=rectOrig; _closeNdiGL(); }
  return out;
})()`;

(async () => {
  let pag=null;
  for(const t of (await lista()).filter(t=>t.type==='page'&&t.webSocketDebuggerUrl)){
    try{ if(await evalEn(t.webSocketDebuggerUrl,'typeof salidaVivaRect==="function" && typeof ndiTick==="function"',8000)){ pag=t.webSocketDebuggerUrl; break; } }catch(_){}
  }
  if(!pag){ console.error('✘ no encuentro la pagina CON `salidaVivaRect` — ¿estas corriendo el build ANTERIOR?'); process.exitCode=2; return; }
  console.log('· pagina del editor encontrada');
  await evalEn(pag, `openProjectPath(${JSON.stringify(ISP)}, true)`, 120000);
  for(let i=0;i<30;i++){ await dormir(1000);
    const s=await evalEn(pag,'({n:state.media.length,c:state.media.filter(m=>m._loading).length})',20000);
    if(s.n>0&&!s.c)break; }
  console.log('· proyecto de prueba cargado (secuencia 1920×1080)');

  console.log('\n[1] geometria anunciada por `salidaVivaRect(2048)`');
  const g = await evalEn(pag, `(()=>{ const o={};
    for(const m of ['dome','flat','room']){ state.seqMode=m; o[m]=salidaVivaRect(2048); }
    state.seqW=1920; state.seqH=1080; state.seqMode='flat'; o.flat169=salidaVivaRect(2048);
    state.seqW=2048; state.seqH=2048; o.flatCuadrada=salidaVivaRect(2048);
    state.seqW=1920; state.seqH=1080; return o; })()`, 30000);
  console.log('   ', JSON.stringify(g));
  exigir(g.dome.w===2048 && g.dome.h===2048, 'DOMO sigue emitiendo el cuadrado entero 2048×2048 — es '+g.dome.w+'×'+g.dome.h);
  exigir(g.flat169.w===2048 && g.flat169.h===1152, '2D de 16:9 emite una BANDA 2048×1152, no un cuadrado — es '+g.flat169.w+'×'+g.flat169.h);
  exigir(g.flatCuadrada.w===2048 && g.flatCuadrada.h===2048, 'una secuencia 2D CUADRADA emite el cuadrado (no se recorta de más) — es '+g.flatCuadrada.w+'×'+g.flatCuadrada.h);

  console.log('\n[2] pixeles emitidos por el `ndiTick` REAL (con un DSP.ndi capturador)');
  for(const modo of ['flat','dome']){
    const r = await evalEn(pag, TICK(modo,false), 60000);
    if(r && r.error){ exigir(false, modo+': '+r.error); continue; }
    console.log('   '+modo+' → '+r.w+'×'+r.h+'  bytes='+r.n+'  con contenido='+r.pctNoNegro+'%');
    exigir(r.n === r.esperado, modo+': el bufer emitido mide exactamente w×h×4 — '+r.n+' vs '+r.esperado);
    exigir(r.pctNoNegro > 1, modo+': lo emitido lleva CONTENIDO ('+r.pctNoNegro+'% no negro), no un fotograma vacio');
    if(modo==='flat') exigir(Math.abs(r.w/r.h - 16/9) < 0.02, 'flat: lo emitido sale al aspecto de la secuencia (16:9) — es '+(r.w/r.h).toFixed(3));
  }

  console.log('\n[CONTROL] el codigo ANTERIOR (leer el cuadrado entero) tiene que meter banda negra');
  const c = await evalEn(pag, TICK('flat',true), 60000);
  if(c && c.error) exigir(false, 'control: '+c.error);
  else {
    console.log('   flat forzado a cuadrado → '+c.w+'×'+c.h+'  con contenido='+c.pctNoNegro+'%');
    exigir(c.w===c.h, 'CONTROL: emite un CUADRADO '+c.w+'×'+c.h+' para una secuencia 16:9 — el defecto de antes');
    exigir(c.pctNoNegro < 60, 'CONTROL: y por eso una buena parte es banda negra ('+c.pctNoNegro+'% con contenido) — la sonda sabe fallar');
  }

  console.log('\n[3] la etiqueta del menu dice el modo, no «Dome master» siempre');
  const et = await evalEn(pag, `(()=>{ const o={}; for(const m of ['dome','flat','room']){ state.seqMode=m; o[m]=salidaVivaEtiqueta(2048); } return o; })()`, 20000);
  console.log('   ', JSON.stringify(et));
  exigir(/Dome|Domo/.test(et.dome), 'en domo la etiqueta habla de domo — «'+et.dome+'»');
  exigir(/2D/.test(et.flat), 'en 2D la etiqueta habla de 2D — «'+et.flat+'»');
  exigir(/360/.test(et.room), 'en sala la etiqueta habla de la sala — «'+et.room+'»');

  console.log('\n'+(fallos.length ? '✘ '+fallos.length+' comprobacion(es) en rojo' : '✔ todo verde'));
  process.exitCode = fallos.length?1:0;
})().catch(e=>{ console.error('✘ sonda reventada:', e.message); process.exitCode=2; });
