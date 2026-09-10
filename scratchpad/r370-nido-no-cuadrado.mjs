/* [R370] SONDA — el proxy de composición admite nidos NO CUADRADOS, y activarlo NO cambia la imagen.
   ───────────────────────────────────────────────────────────────────────────────────────────────────────────
   R192 prohibió los nidos no cuadrados porque el horneado los reencuadraba: su rama `flat` de
   `renderExportFrame` EXTRAE la banda del contenido y tira el letterbox que `prepNests` conserva. R180 lo midió
   en su día: «el centro de masa se iba un 29% en vertical». R234b eximió el CLAMP (`uvlim`) pero no la
   EXTRACCIÓN, así que la prohibición seguía siendo lo único que sostenía el invariante — y con ella, la mayor
   palanca de rendimiento del programa (N decodificadores → 1) no llegaba nunca ni al 2D ni a la sala, porque
   una composición 16:9 y la tira de una sala no son cuadradas nunca.

   LA COMPROBACIÓN QUE GOBIERNA ESTO ES LA DE R180: activar el caché no puede cambiar la imagen. Se mide sobre
   el fotograma REAL (`renderExportFrame` + `readPixels`) con el caché apagado y encendido, y se comparan el
   CENTRO DE MASA (que es lo que se movía) y la diferencia media por canal.

   Y SABE FALLAR: el control negativo rehornea con el comportamiento ANTERIOR —se fuerza `_ncSquare=false`
   durante el horneado, con lo que la rama `flat` vuelve a extraer la banda— y EXIGE que el centro de masa se
   mueva. Sin ese control, un caché que no se llegara a usar daría verde igual.

   Uso:  matar la app  ->  npx electron . --remote-debugging-port=9222  ->  node scratchpad/r370-nido-no-cuadrado.mjs
*/
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const PORT = 9222;
const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const DIR  = path.join(RAIZ, 'r370-nido');
const ISP  = path.join(DIR, 'r370-nido.isp');
const IMG  = path.join(RAIZ, '..', 'assets', 'immersive-logo.png');

const NIDO = 901, TOP = 902;
const PROPS = (extra) => Object.assign({ az:0, el:0, size:80, rot:0, spin:0, mirror:false, opacity:100,
  blur:0, feather:0, crop:0, mask:'none', blend:'normal', exposure:0, contrast:0, saturation:0,
  temperature:0, tint:0, glow:0, chroma:0, react:'none', reactAmt:60, fulldome:false, fisheye:false,
  fisheyeAmt:60, equirect:false, eqPitch:0, blackKey:false, blackKeyAmt:15, blackKeySoft:30, warp:'patch',
  secAz:60, secEl:30, volume:100, x:0, y:0, scale:60, lut:null, lutMix:100,
  curves:{ l:[[0,0],[1,1]], r:[[0,0],[1,1]], g:[[0,0],[1,1]], b:[[0,0],[1,1]] } }, extra||{});
const LANES = [{id:7,name:'Audio 1',tag:'A1',kind:'audio',h:78},{id:8,name:'Video 1',tag:'V1',kind:'video',h:78}];

fs.rmSync(DIR,{recursive:true,force:true}); fs.mkdirSync(DIR,{recursive:true});
fs.writeFileSync(ISP, JSON.stringify({
  app:'DomeStudioPro', v:4, managed:false, fps:30, playhead:0, markers:[], groups:[], clips:[],
  media:[
    { id:801, name:'immersive-logo.png', kind:'image', w:1060, h:1081, mode:null, cov:null, room:null,
      dur:10, fps:0, color:'#B34FB3', path:IMG, fsize:0, folder:null, framePaths:null },
    /* EL NIDO, 16:9 — el caso que R192 prohibía. El logo va DESCENTRADO en vertical a propósito: un
       reencuadre por perder el letterbox mueve el centro de masa, y con el contenido centrado se notaría menos. */
    { id:NIDO, name:'NIDO 16:9', kind:'nest', w:640, h:360, dur:2, fps:30, mode:'flat', cov:null, room:null,
      nestClips:[{ id:820, mediaId:801, name:'logo', lane:1, start:0, dur:2, inP:0, color:'#B34FB3',
        fadeIn:0, fadeOut:0, props:PROPS({ y:-22, scale:45 }), kf:{}, fx:[], penMasks:[], anim:[] }],
      nestLanes:LANES, nestMarkers:[], nestGroups:[], nestPlayhead:0, nestWorkIn:0, nestWorkOut:2 },
    { id:TOP, name:'MAIN', kind:'nest', w:1024, h:1024, dur:2, fps:30, mode:'flat', cov:null, room:null,
      nestClips:[{ id:830, mediaId:NIDO, name:'NIDO 16:9', lane:1, start:0, dur:2, inP:0, color:'#C4844B',
        fadeIn:0, fadeOut:0, props:PROPS({ scale:85 }), kf:{}, fx:[], penMasks:[], anim:[] }],
      nestLanes:LANES, nestMarkers:[], nestGroups:[], nestPlayhead:0, nestWorkIn:0, nestWorkOut:2 } ],
  workIn:null, workOut:null, folders:[], folderColors:{},
  tl:{ bpm:120, sig:4, tcMode:'timecode', pxPerSec:60, inlineCurves:false },
  exportPresets:[], openSeqs:[TOP], activeSeqId:TOP, seqW:1024, seqH:1024, reactive:null, autoItems:{},
}, null, 1));

const lista = () => new Promise((res, rej) => {
  http.get({ host:'127.0.0.1', port:PORT, path:'/json/list' }, r => {
    let b=''; r.on('data',c=>b+=c); r.on('end',()=>{ try{res(JSON.parse(b));}catch(e){rej(e);} });
  }).on('error', rej);
});
async function evalEn(url, expr, ms=300000) {
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

/* Un fotograma por el camino REAL de la aplicación, con el caché en el estado pedido. Devuelve el centro de
   masa (normalizado 0..1), el % con contenido y una firma para poder compararlos entre sí. */
const FOTO = (cache) => `(async()=>{
  state.view.useNestCache=${cache?'true':'false'};
  const R=256; glc.width=R; glc.height=R; const t=1.0;
  const mide=()=>{ const px=new Uint8Array(R*R*4); gl.readPixels(0,0,R,R,gl.RGBA,gl.UNSIGNED_BYTE,px);
    let n=0, sx=0, sy=0, suma=0;
    for(let y=0;y<R;y++) for(let x=0;x<R;x++){ const i=(y*R+x)*4;
      const l=(px[i]+px[i+1]+px[i+2])/3;
      if(l>8){ n++; sx+=x; sy+=y; } suma+=l; }
    return { pct:+(100*n/(R*R)).toFixed(2), cx:n?+(sx/n/R).toFixed(4):-1, cy:n?+(sy/n/R).toFixed(4):-1,
             media:+(suma/(R*R)).toFixed(2) }; };
  /* Espera ACOTADA a que el material este decodificado antes de medir. Con el cache puesto, la instancia de
     video del proxy puede no estar lista todavia: mientras vi.ready es false el nido no tiene textura y el
     fotograma sale NEGRO -es el sintoma que R353 describe, "un negro que va y viene"-. Medir ahi seria medir
     una carrera, no el codigo. Si no se asienta en el plazo, se devuelve lo ultimo y la comprobacion sale
     roja: la espera no puede tapar un cache que de verdad no dibuje. */
  let r=null;
  for(let i=0;i<40;i++){
    await seekExport(t); prepNests(state.clips,t,0); renderExportFrame(t,R,1,null);
    r=mide(); if(r.pct>0.2)break;
    await new Promise(res=>setTimeout(res,250));
  }
  return r;
})()`;

/* Hornea el proxy del nido puenteando SOLO el diálogo de tamaño (no la lógica que se está probando).
   `viejo` reconstruye el horneado ANTERIOR: `_ncSquare=false` durante el render hace que la rama `flat`
   vuelva a extraer la banda y a perder el letterbox, que es exactamente lo que hacía el código de R192. */
const HORNEA = (viejo) => `(async()=>{
  const m=mediaById(${NIDO});
  m.ncPath=null; m.ncUrl=null; m.ncReady=false; m.ncStale=false; m.ncSig=null;
  const dlg=ncDialog, rEF=renderExportFrame;
  ncDialog=async()=>({ w:256, h:144, s:256 });
  ${viejo ? 'renderExportFrame=function(){ _ncSquare=false; return rEF.apply(this,arguments); };' : ''}
  try { await ncBuild(m); } finally { ncDialog=dlg; renderExportFrame=rEF; }
  /* Se espera tambien a que el export TERMINE de limpiar: ncUsable empieza por !_exportQuality, y
     preguntarlo con la bandera aun puesta devuelve false por un motivo que no tiene nada que ver con lo
     que aqui se prueba. La primera version lo leia antes de tiempo y salia roja con el codigo bien.
     (Sin acentos graves: este comentario vive DENTRO de una plantilla, y uno solo la cierra.) */
  for(let i=0;i<60;i++){ if(m.ncReady&&m.ncUrl&&!_exportQuality&&!exporting)break; await new Promise(r=>setTimeout(r,500)); }
  /* ncUsable empieza por la PREFERENCIA del usuario (state.view.useNestCache), y la fase anterior la dejo
     apagada para medir la referencia. Preguntarla asi devolvia false por esa preferencia y no por lo que aqui
     se prueba — que es si la puerta del tamano sigue cerrada. Se pregunta con la preferencia puesta. */
  const prefBak=state.view.useNestCache; state.view.useNestCache=true;
  const usable=ncUsable(m); state.view.useNestCache=prefBak;
  return { path:!!m.ncPath, ready:!!m.ncReady, url:!!m.ncUrl, w:m.ncW, h:m.ncH,
           stale:!!m.ncStale, exportQuality:!!_exportQuality, usable };
})()`;

(async () => {
  let pag=null;
  for(const t of (await lista()).filter(t=>t.type==='page'&&t.webSocketDebuggerUrl)){
    try{ if(await evalEn(t.webSocketDebuggerUrl,'typeof ncBuild==="function" && typeof ncUsable==="function"',8000)){ pag=t.webSocketDebuggerUrl; break; } }catch(_){}
  }
  if(!pag){ console.error('✘ no encuentro la pagina del editor'); process.exitCode=2; return; }
  console.log('· pagina del editor encontrada');
  await evalEn(pag, `openProjectPath(${JSON.stringify(ISP)}, true)`, 120000);
  for(let i=0;i<30;i++){ await dormir(1000);
    const s=await evalEn(pag,'({n:state.media.length,c:state.media.filter(m=>m._loading).length,ruta:!!currentPath})',20000);
    if(s.n>0&&!s.c&&s.ruta)break; }
  console.log('· proyecto cargado (nido 16:9 de 640×360 dentro de un maestro 1024²)');

  console.log('\n[0] la puerta que R192 cerro ya no esta');
  const puerta = await evalEn(pag, `(()=>{ const m=mediaById(${NIDO});
    return { w:m.w, h:m.h, cuadrado:(m.w===m.h) }; })()`, 20000);
  console.log('   ', JSON.stringify(puerta));
  exigir(puerta.cuadrado===false, 'el nido de la prueba NO es cuadrado ('+puerta.w+'×'+puerta.h+') — es el caso prohibido');

  console.log('\n[1] fotograma SIN cache (la referencia: la composicion recompuesta)');
  const A = await evalEn(pag, FOTO(false), 120000);
  console.log('   ', JSON.stringify(A));
  exigir(A.pct > 1, 'la referencia tiene contenido dibujado ('+A.pct+'%) — si no, comparar no significaria nada');

  console.log('\n[2] se hornea el proxy del nido 16:9');
  const h = await evalEn(pag, HORNEA(false), 600000);
  console.log('   ', JSON.stringify(h));
  exigir(h.path && h.ready && h.url, 'el horneado produjo archivo y quedo enlazado');
  exigir(h.usable === true, '`ncUsable` lo acepta — la puerta de R194 esta abierta');

  console.log('\n[3] fotograma CON cache — la comprobacion de R180');
  const B = await evalEn(pag, FOTO(true), 120000);
  console.log('   ', JSON.stringify(B));
  const dCy = Math.abs(B.cy - A.cy), dCx = Math.abs(B.cx - A.cx);
  console.log('   desplazamiento del centro de masa:  vertical '+(100*dCy).toFixed(2)+'%  horizontal '+(100*dCx).toFixed(2)+'%');
  exigir(B.pct > 1, 'con el cache puesto SIGUE habiendo contenido ('+B.pct+'%)');
  exigir(dCy < 0.01, 'el centro de masa NO se mueve en vertical ('+(100*dCy).toFixed(2)+'% < 1%) — la condicion de R180');
  exigir(dCx < 0.01, 'ni en horizontal ('+(100*dCx).toFixed(2)+'%)');
  exigir(Math.abs(B.pct-A.pct) < 1.5, 'la superficie con contenido es la misma dentro de tolerancia ('+A.pct+'% vs '+B.pct+'%; el proxy es video comprimido y reescalado, asi que suaviza bordes)');
  exigir(Math.abs(B.media-A.media) < 0.5, 'y la luminancia media apenas cambia ('+A.media+' vs '+B.media+') — la imagen es la misma, no solo el encuadre');

  console.log('\n[4] GUARDA: un proxy no cuadrado de una version ANTERIOR no puede enlazarse');
  /* R194 cerraba esto con la puerta del tamano, que R370 retira. `nestSig` NO lo delata: incluye m.w/m.h,
     que son los mismos en los dos horneados. Lo sostiene ahora la marca de formato `ncFmt`. */
  const leg = await evalEn(pag, `(()=>{ const m=mediaById(${NIDO}); const bak=m.ncFmt, pref=state.view.useNestCache;
    state.view.useNestCache=true;
    m.ncFmt=null;      const sinMarca=ncUsable(m);
    m.ncFmt=2;         const conMarca=ncUsable(m);
    const w=m.w,h=m.h; m.w=m.h=640; m.ncFmt=null; const cuadradoViejo=ncUsable(m);
    m.w=w; m.h=h; m.ncFmt=bak; state.view.useNestCache=pref;
    return { sinMarca, conMarca, cuadradoViejo }; })()`, 30000);
  console.log('   ', JSON.stringify(leg));
  exigir(leg.sinMarca === false, 'un proxy NO cuadrado SIN marca de formato queda fuera — es el agujero que R194 tapaba');
  exigir(leg.conMarca === true, 'con la marca del horneado nuevo si entra');
  exigir(leg.cuadradoViejo === true, 'y un proxy CUADRADO de siempre sigue valiendo — no se invalidan las horas de proxies de domo ya hechas');

  console.log('\n[CONTROL] se rehornea con el comportamiento ANTERIOR (la rama flat extrae la banda)');
  const h2 = await evalEn(pag, HORNEA(true), 600000);
  console.log('   ', JSON.stringify(h2));
  const C = await evalEn(pag, FOTO(true), 120000);
  console.log('   ', JSON.stringify(C));
  const dCy2 = Math.abs(C.cy - A.cy);
  console.log('   desplazamiento con el horneado viejo: vertical '+(100*dCy2).toFixed(2)+'%');
  exigir(dCy2 > 0.02, 'CONTROL: con el horneado anterior el centro de masa SI se mueve ('+(100*dCy2).toFixed(2)+'%) — la sonda sabe fallar');
  exigir(Math.abs(C.media-A.media) > 1, 'CONTROL: y la imagen entera cambia — luminancia media '+A.media+' → '+C.media);

  console.log('\n'+(fallos.length ? '✘ '+fallos.length+' comprobacion(es) en rojo' : '✔ todo verde'));
  process.exitCode = fallos.length?1:0;
})().catch(e=>{ console.error('✘ sonda reventada:', e.message); process.exitCode=2; });
