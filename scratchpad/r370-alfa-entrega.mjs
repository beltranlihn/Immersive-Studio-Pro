/* [R370] SONDA — el PNG "con alfa" entrega alfa DE VERDAD, y en los tres modos.
   ───────────────────────────────────────────────────────────────────────────────────────────────────────────
   Mide la CONCLUSION: el canal alfa de los pixeles del PNG que de verdad se escribe en disco (se vuelve a
   cargar el archivo y se muestrea), no la premisa «pngBg vale 'alpha'».

   Y SABE FALLAR por dos caminos distintos:
     · el CONTROL NEGATIVO apaga `_exportAlfa` -el estado anterior a R370- y exige que el alfa se pierda.
     · las GUARDAS exigen que el PNG con fondo NEGRO siga saliendo opaco: si el arreglo se pasa de listo y
       transparenta todas las entregas, esto se pone rojo.

   Linea de salida MEDIDA en el .exe ANTES del arreglo (2026-09-10, proyecto de Beltran):
     flat -> esquina [0,0,0,255]  ·  domo -> esquina [0,0,0,0] pero CENTRO [0,0,0,255]
   O sea que el domo tampoco entregaba alfa: entregaba el recorte circular de `chapaLienzo`.

   El PNG se juzga OFFLINE (`leer-png.mjs`, solo zlib) y NO recargandolo en la propia pagina. Primera version
   de esta sonda lo muestreaba con un `<img>`: como cada pasada escribe la MISMA ruta, Chromium servia la imagen
   CACHEADA de la pasada anterior y el control negativo y las dos guardas salian rojos con el codigo bien. Un
   juez externo no tiene ese problema y ademas no depende del programa que se esta juzgando.

   Uso:  matar la app  ->  npx electron . --remote-debugging-port=9222  ->  node scratchpad/r370-alfa-entrega.mjs
*/
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { leerPNG } from './leer-png.mjs';

const PORT = 9222;
const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const ISP  = path.join(RAIZ, 'r370-prueba.isp');
const OUT  = path.join(RAIZ, 'r370-salida');

/* Proyecto de prueba: el LOGO del propio repositorio (`assets/immersive-logo.png`, 1060x1081, 68,7% opaco y
   30,3% transparente medido con `leer-png.mjs`) centrado sobre un lienzo mayor. Asi hay a la vez zona VACIA
   (la esquina) y zona con CONTENIDO, y el material es real y del repo — no depende de archivos del usuario.
   Dos versiones anteriores de esta sonda usaron un clip de TEXTO con `props` a mano: no se dibujaba, el export
   salia «100% transparente» y la sonda lo cantaba como exito. Un fotograma VACIO pasa cualquier prueba de
   transparencia — por eso se exige tambien que HAYA contenido. */
const SEQ = 901, IMG = path.join(RAIZ, '..', 'assets', 'immersive-logo.png');
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
    { id:SEQ, name:'MAIN', kind:'nest', w:1024, h:1024, dur:10, fps:60, mode:'flat', cov:null, room:null,
      nestClips:[{ id:820, mediaId:801, name:'immersive-logo.png', lane:1, start:0, dur:10, inP:0,
        color:'#B34FB3', fadeIn:0, fadeOut:0, props:JSON.parse(JSON.stringify(PROPS)),
        kf:{}, fx:[], penMasks:[], anim:[] }],
      /* Las pistas van EXPLICITAS y el clip en la 1: el indice 0 es la pista de AUDIO (asi las crea la propia
         aplicacion, «Audio 1» primero), y un clip de imagen colocado ahi no se dibuja. Version anterior de esta
         sonda lo puso en la 0 y el export salia vacio — con los medios cargados y la textura creada. */
      nestLanes:[{id:7,name:'Audio 1',tag:'A1',kind:'audio',h:78},{id:8,name:'Video 1',tag:'V1',kind:'video',h:78}],
      nestMarkers:[], nestGroups:[], nestPlayhead:0, nestWorkIn:0, nestWorkOut:10 } ],
  workIn:null, workOut:null, folders:[], folderColors:{},
  tl:{ bpm:120, sig:4, tcMode:'timecode', pxPerSec:60, inlineCurves:false },
  exportPresets:[], openSeqs:[SEQ], activeSeqId:SEQ, seqW:1024, seqH:1024, reactive:null, autoItems:{},
}, null, 1));

const lista = () => new Promise((res, rej) => {
  http.get({ host:'127.0.0.1', port:PORT, path:'/json/list' }, r => {
    let b=''; r.on('data',c=>b+=c); r.on('end',()=>{ try{res(JSON.parse(b));}catch(e){rej(e);} });
  }).on('error', rej);
});
async function evalEn(url, expr, ms=180000) {
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

const JOB = '{ done:()=>{}, frame:()=>{}, wrote:()=>{}, err:()=>{}, warn:()=>{}, label:()=>{}, prog:()=>{}, cancel:()=>{} }';

/* `forzarOpaco` reconstruye el estado ANTERIOR a R370 ENVOLVIENDO `renderExportFrame`: apaga la bandera en el
   instante justo antes de cada fotograma, que es donde se lee. Dos intentos anteriores no servian: apagarla una
   sola vez antes del `await` la pisa `_runExportCore` (la enciende despues de varios awaits), y sostenerla con
   un `setInterval` pierde la carrera contra el bucle de fotogramas. Envolver la funcion no tiene carrera. */
const EXPORTA = (dir, modo, bg, forzarOpaco) => `(async()=>{
  state.seqMode=${JSON.stringify(modo)};
  const p = runExport({ codec:'png', res:256, outW:256, outH:256, fps:2, rangeT:[0.5,1.0],
                        outDir:${JSON.stringify(dir)}, pngBg:${JSON.stringify(bg)}, job:${JOB} });
  await p; return true; })()`;
const CON_OPACO_FORZADO = expr => `(async()=>{
  const orig=renderExportFrame;
  renderExportFrame=function(){ _exportAlfa=false; return orig.apply(this,arguments); };
  try{ return await ${expr}; } finally { renderExportFrame=orig; } })()`;

const MUESTREA = file => `(async()=>{
  const url='file:///'+${JSON.stringify(file)}.replace(/\\\\/g,'/');
  const im=new Image();
  await new Promise((ok,ko)=>{ im.onload=ok; im.onerror=()=>ko(new Error('no carga '+url)); im.src=url; });
  const cv=document.createElement('canvas'); cv.width=im.naturalWidth; cv.height=im.naturalHeight;
  const cx=cv.getContext('2d'); cx.clearRect(0,0,cv.width,cv.height); cx.drawImage(im,0,0);
  const px=(x,y)=>Array.from(cx.getImageData(x,y,1,1).data);
  return { w:cv.width, esquina:px(2,2), centro:px(cv.width>>1,cv.height>>1) };
})()`;

const primerPng = () => {
  try { for(const sub of fs.readdirSync(OUT)){ const p=path.join(OUT,sub);
    if(fs.statSync(p).isDirectory()){ const f=fs.readdirSync(p).filter(x=>x.toLowerCase().endsWith('.png')).sort();
      if(f.length)return path.join(p,f[0]); } } } catch(e){}
  return null;
};

async function entrega(pag, modo, bg, forzarOpaco) {
  fs.rmSync(OUT,{recursive:true,force:true}); fs.mkdirSync(OUT,{recursive:true});
  const js = EXPORTA(OUT,modo,bg,forzarOpaco);
  await evalEn(pag, forzarOpaco ? CON_OPACO_FORZADO(js) : js, 300000);
  await dormir(1200);
  const f = primerPng(); if(!f) return null;
  return leerPNG(f);   /* juez OFFLINE: ni cache del navegador, ni depender del programa juzgado */
}

(async () => {
  let pag=null;
  for(const t of (await lista()).filter(t=>t.type==='page'&&t.webSocketDebuggerUrl)){
    try{ if(await evalEn(t.webSocketDebuggerUrl,'typeof runExport==="function" && typeof _exportAlfa!=="undefined"',8000)){ pag=t.webSocketDebuggerUrl; break; } }catch(_){}
  }
  if(!pag){ console.error('✘ no encuentro la pagina del editor CON `_exportAlfa` — ¿estas corriendo el build ANTERIOR?'); process.exitCode=2; return; }
  console.log('· pagina del editor encontrada');

  await evalEn(pag, `openProjectPath(${JSON.stringify(ISP)}, true)`, 120000);
  for(let i=0;i<30;i++){ await dormir(1000);
    const s=await evalEn(pag,'({n:state.media.length,c:state.media.filter(m=>m._loading).length})',20000);
    if(s.n>0&&!s.c)break; }
  console.log('· proyecto de prueba cargado');

  for(const modo of ['flat','dome','room']){
    console.log('\n['+modo.toUpperCase()+'] PNG pidiendo alfa');
    const r=await entrega(pag,modo,'alpha',false);
    if(!r){ exigir(false,'el export escribio un PNG en '+modo); continue; }
    console.log('   esquina='+JSON.stringify(r.esquina)+'  centro='+JSON.stringify(r.centro)+'  opaco='+r.pctOpaco+'%  transparente='+r.pctTransp+'%');
    exigir(r.esquina[3]===0, modo+': la zona VACIA sale transparente (alfa 0) — sale '+r.esquina[3]);
    exigir(r.pctTransp>50, modo+': la mayor parte del fotograma es transparente, no un pixel suelto — '+r.pctTransp+'%');
    exigir(r.pctOpaco>0.5, modo+': Y SIGUE HABIENDO CONTENIDO dibujado ('+r.pctOpaco+'% opaco) — un fotograma vacio pasaria la prueba de arriba sin merecerlo');
  }

  console.log('\n[CONTROL] el estado ANTERIOR a R370 (bandera apagada) tiene que perder el alfa');
  const c=await entrega(pag,'flat','alpha',true);
  console.log('   esquina='+JSON.stringify(c&&c.esquina)+'  opaco='+(c&&c.pctOpaco)+'%');
  exigir(!!c&&c.esquina[3]===255, 'CONTROL: sin la bandera, flat vuelve a salir OPACO — sale '+(c&&c.esquina[3])+' (la sonda sabe fallar)');
  exigir(!!c&&c.pctOpaco===100, 'CONTROL: y el fotograma entero es opaco — '+(c&&c.pctOpaco)+'%');

  console.log('\n[GUARDA] el PNG con fondo NEGRO tiene que seguir siendo opaco');
  for(const modo of ['flat','dome']){
    const g=await entrega(pag,modo,'black',false);
    console.log('   '+modo+' esquina='+JSON.stringify(g&&g.esquina)+'  opaco='+(g&&g.pctOpaco)+'%');
    exigir(!!g&&g.pctOpaco===100, modo+' con fondo negro sigue 100% OPACO — es '+(g&&g.pctOpaco)+'%');
  }

  console.log('\n'+(fallos.length ? '✘ '+fallos.length+' comprobacion(es) en rojo' : '✔ todo verde'));
  process.exitCode = fallos.length?1:0;
})().catch(e=>{ console.error('✘ sonda reventada:', e.message); process.exitCode=2; });
