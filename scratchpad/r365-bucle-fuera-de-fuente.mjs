/* [R365] SONDA — un clip en bucle no puede pedir material que su fuente no tiene.
   ───────────────────────────────────────────────────────────────────────────────────────────────────────────
   Reproduce la forma EXACTA del caso medido en el proyecto de domo de Vicente: una composicion cuyo contenido
   dura 5 s, instanciada con `loop`, `loopLen`=5 y `inP`=2,873. La ventana del bucle es `[inP, inP+loopLen)` =
   [2,873 · 7,873), o sea que 2,873 s de cada vuelta caen MAS ALLA del final del contenido y no hay nada que
   componer: la composicion se ve vacia y reaparece en la vuelta siguiente.

   Mide la CONCLUSION, no la premisa: recorre una vuelta entera fotograma a fotograma y cuenta, con el `srcT`
   REAL de la aplicacion y los rangos REALES de los hijos, cuantos clips hay dibujables en cada instante. Un
   instante con cero es un fotograma vacio en pantalla.

   [R368 · ACTUALIZADA] El MECANISMO de la reparacion cambio, y con el las aserciones que lo miraban. R365
   arreglaba el hueco DESLIZANDO la ventana (`inP`→0); R368 hizo que `srcT` ENVUELVA el instante dentro de la
   fuente, asi que `inP` ya no es un defecto sino la FASE del bucle —y aplastarla se llevaba por delante el
   desfase de un corte—. Lo que NO cambia es la conclusion que esta sonda mide: ni un fotograma de la vuelta
   puede quedarse sin nada que componer. Su gemela offline (`r365-srct-offline.mjs`) se retiro en R368 por
   describir el modelo viejo; esta se queda porque mide en la APP y por el camino real.

   Y SABE FALLAR: la fase 3 reconstruye el `srcT` ANTERIOR a R368 —sin el envoltorio, que es lo unico que hoy
   impide el hueco— haciendo que `duracionFuente` devuelva Infinity, y EXIGE que aparezcan instantes vacios.
   Sin ese control, un `srcT` que devolviera siempre 0 tambien daria verde.

   Uso:  npx electron . --remote-debugging-port=9222   →   node scratchpad/r365-bucle-fuera-de-fuente.mjs
*/
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const PORT = 9222;
const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const ISP = path.join(RAIZ, 'r365-prueba.isp');

const CONTENIDO = 5.0;      // lo que dura el interior de la composicion
const BUCLE     = 5.0;      // el ciclo que pide el clip
const IN_MALO   = 2.873;    // el `inP` medido en «Ring 137»

/* Composicion de 2 hijos que cubren [0,5), instanciada en la secuencia con el bucle desbordado. */
const texto = (id, name) => ({ id, name, kind:'text', w:1920, h:1080, dur:6, fps:0, color:'#4B84C4',
  text:name, tfontSize:120, tweight:'700', tfont:'Inter, sans-serif', tcolor:'#ffffff', tbg:'transparent',
  tstroke:false, tstrokeColor:'#000000' });
const hijo = (id, mediaId, name) => ({ id, mediaId, name, lane:0, start:0, dur:CONTENIDO, inP:0, color:'#4B84C4' });
const NIDO_ID = 900, SEQ_ID = 901;
fs.writeFileSync(ISP, JSON.stringify({
  app:'DomeStudioPro', v:4, fps:60, playhead:0, markers:[], groups:[], clips:[],
  media:[
    texto(801,'Foto A'), texto(802,'Foto B'),
    { id:NIDO_ID, name:'Anillo de prueba', kind:'nest', w:2048, h:2048, dur:CONTENIDO, fps:60, mode:'dome', cov:180,
      nestClips:[ hijo(811,801,'A'), hijo(812,802,'B') ], nestLanes:null, nestMarkers:[], nestGroups:[] },
    { id:SEQ_ID, name:'MAIN', kind:'nest', w:2048, h:2048, dur:60, fps:60, mode:'dome', cov:180,
      nestClips:[ { id:820, mediaId:NIDO_ID, name:'Anillo de prueba', lane:0, start:10, dur:40,
                    inP:IN_MALO, loop:true, loopLen:BUCLE, color:'#C4844B' } ],
      nestLanes:null, nestMarkers:[], nestGroups:[] },
  ],
  workIn:null, workOut:null, folders:[], folderColors:{},
  tl:{bpm:120,sig:4,tcMode:'timecode',pxPerSec:60,inlineCurves:false},
  exportPresets:[], openSeqs:[SEQ_ID], activeSeqId:SEQ_ID, seqW:2048, seqH:2048, reactive:null, autoItems:{},
}, null, 1));
console.log('· proyecto de prueba escrito:', ISP);
console.log('  contenido %ss · bucle %ss · inP %s  →  ventana [%s · %s)', CONTENIDO, BUCLE, IN_MALO, IN_MALO, IN_MALO+BUCLE);

const lista = () => new Promise((res, rej) => {
  http.get({ host:'127.0.0.1', port:PORT, path:'/json/list' }, r => {
    let b=''; r.on('data',c=>b+=c); r.on('end',()=>{ try{res(JSON.parse(b));}catch(e){rej(e);} });
  }).on('error', rej);
});
async function evalEn(url, expr, ms=60000) {
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
async function paginaEditor(){
  for(const t of (await lista()).filter(t=>t.type==='page'&&t.webSocketDebuggerUrl)){
    try{ if(await evalEn(t.webSocketDebuggerUrl,'typeof state!=="undefined" && !!state.media && typeof srcT==="function"',8000)) return t.webSocketDebuggerUrl; }catch(_){}
  }
  return null;
}
const dormir = ms => new Promise(r=>setTimeout(r,ms));

/* Recorre una vuelta con el `srcT` real y cuenta hijos dibujables en cada fotograma. */
const CENSO = `(()=>{
  const c = state.clips.find(x=>x.mediaId===${NIDO_ID});
  if(!c) return {error:'no encuentro el clip de la composicion'};
  const m = mediaById(${NIDO_ID});
  const hijos = m.nestClips||[];
  const paso = 1/60; let vacios=0, total=0, primerVacio=null, lt0=null, ltMax=-1;
  for(let k=0;k<Math.round((c.loopLen||1)/paso);k++){
    const t = c.start + k*paso;
    const lt = srcT(c,t);
    if(lt0===null) lt0=+lt.toFixed(4);
    if(lt>ltMax) ltMax=lt;
    const n = hijos.filter(h=>lt>=h.start && lt<h.start+h.dur).length;
    total++;
    if(n===0){ vacios++; if(primerVacio===null)primerVacio=+lt.toFixed(3); }
  }
  return { inP:+(c.inP||0).toFixed(4), loopLen:c.loopLen, contenido:+seqDur(m).toFixed(3),
           fotogramas:total, vacios, pctVacio:+(100*vacios/total).toFixed(1),
           ltMin:lt0, ltMax:+ltMax.toFixed(3), primerVacio };
})()`;

const fallos=[];
const exigir=(ok,msg)=>{ console.log((ok?'  ✔ ':'  ✘ ')+msg); if(!ok)fallos.push(msg); };

(async () => {
  const pag = await paginaEditor();
  if(!pag){ console.error('✘ no encuentro la pagina del editor con `srcT`. ¿Lanzaste `npx electron . --remote-debugging-port=9222`?'); process.exitCode=2; return; }
  console.log('· pagina del editor encontrada');

  console.log('\n[1] abriendo el proyecto de prueba (con el bucle desbordado grabado en el archivo)');
  await evalEn(pag, `openProjectPath(${JSON.stringify(ISP)}, true)`, 120000);
  let m=null;
  for(let i=0;i<40;i++){ await dormir(1000); m=await evalEn(pag, CENSO, 20000); if(m&&!m.error)break; }
  if(!m||m.error){ console.error('✘ no se estabilizó:', JSON.stringify(m)); process.exitCode=2; return; }
  console.log('  censo de una vuelta:', JSON.stringify(m));

  console.log('\n[2] ¿lo repara al abrir, y deja de haber fotogramas vacios?');
  exigir(m.contenido===CONTENIDO, 'el contenido de la composicion mide '+CONTENIDO+' s — mide '+m.contenido);
  exigir(m.loopLen===BUCLE, 'el ciclo del bucle se CONSERVA en '+BUCLE+' s (no se recorta para que quepa) — es '+m.loopLen);
  /* [R368] Ya NO se exige `inP`=0: la entrada es la FASE del bucle y el guardian solo la normaliza dentro de
     la fuente. 2,873 < 5, o sea que es una fase legitima y tiene que sobrevivir intacta. */
  exigir(Math.abs(m.inP-IN_MALO)<1e-6, '`inP` se CONSERVA como fase del bucle ('+IN_MALO+') — es '+m.inP);
  exigir(m.ltMax<CONTENIDO+1e-6, 'el instante mas alto que pide el bucle ('+m.ltMax+') ya no se sale del contenido');
  exigir(m.vacios===0, 'NINGUN fotograma de la vuelta se queda sin nada que componer — hay '+m.vacios);

  console.log('\n[3] control negativo — reconstruyo el `srcT` ANTERIOR a R368 (sin envoltorio)');
  /* El envoltorio de R368 es la ultima linea de `srcT`, y solo actua si `duracionFuente` da un numero finito.
     Devolviendo Infinity se recupera EXACTAMENTE el `srcT` de antes SIN tocar `srcT`: la sonda no reimplementa
     la ruta, la desarma por donde el propio codigo la condiciona (regla 16). `seqDur` —de donde sale
     `contenido`— no pasa por ahi, asi que la medida de referencia no se mueve.
     El postizo se pone y se quita en llamadas SEPARADAS, con el `finally` en NODE y no en la pagina: el
     `timeout` de `Runtime.evaluate` mata a V8 sin ejecutar sus `finally`, asi que un censo lento dejaba la app
     viva con el envoltorio desactivado PARA SIEMPRE — y las fases siguientes midiendo otro programa. */
  const PONER = `(()=>{ window.__dfReal=duracionFuente; window.duracionFuente=()=>Infinity; return true; })()`;
  const QUITAR = `(()=>{ if(window.__dfReal){ window.duracionFuente=window.__dfReal; delete window.__dfReal; }
    return isFinite(duracionFuente(mediaById(${NIDO_ID}))); })()`;
  let malo, repuesto=false;
  await evalEn(pag, PONER, 15000);
  try { malo = await evalEn(pag, CENSO, 30000); }
  finally { try { repuesto = await evalEn(pag, QUITAR, 15000); } catch(_) {} }
  console.log('  sin envoltorio, con inP='+IN_MALO+':', JSON.stringify({vacios:malo.vacios, pctVacio:malo.pctVacio, ltMax:malo.ltMax, primerVacio:malo.primerVacio}));
  exigir(malo.vacios>0, 'la sonda SABE fallar: sin el envoltorio aparecen '+malo.vacios+' fotogramas vacios ('+malo.pctVacio+'% de la vuelta)');
  exigir(malo.ltMax>CONTENIDO, 'y el bucle pide material mas alla del contenido ('+malo.ltMax+' > '+CONTENIDO+')');
  exigir(malo.primerVacio!==null && Math.abs(malo.primerVacio-CONTENIDO)<0.05,
    'el hueco empieza justo donde se acaba el contenido ('+malo.primerVacio+' ≈ '+CONTENIDO+')');
  exigir(repuesto===true, '`duracionFuente` vuelve a ser la de verdad: el postizo no sobrevive a la fase');
  /* [R364b] Restaurar la linea de salida es una comprobacion mas: un control negativo que no deshace lo suyo
     tiñe de rojo las fases siguientes y el fallo parece del codigo. */
  const vuelta = await evalEn(pag, CENSO, 30000);
  exigir(vuelta.vacios===0, 'restaurada la linea de salida: con el envoltorio vuelve a haber 0 vacios — hay '+vuelta.vacios);

  console.log('\n[4] lo que el guardian SIGUE evitando que se vea: la entrada NEGATIVA');
  /* [R366b] `clipSrc` devuelve `lim: lim && !c.loop`, o sea que para un clip EN BUCLE los recortes se quedan
     sin suelo y arrastrar su borde izquierdo mete `inP` en negativo. Y el envoltorio de R368 esta condicionado
     a `(c.inP||0)>0`: con la entrada negativa NO actua, asi que este es el unico caso que hoy sigue teniendo
     consecuencia VISIBLE — y por eso es el que lleva el control negativo de esta fase. MEDIDO: 120 de 300. */
  const neg = await evalEn(pag, `(()=>{ const c=state.clips.find(x=>x.mediaId===${NIDO_ID});
    c.inP=-2; c.loopLen=${BUCLE}; return ${CENSO}; })()`, 30000);
  console.log('  con inP=-2 y SIN guardian:', JSON.stringify({inP:neg.inP, vacios:neg.vacios, pctVacio:neg.pctVacio, ltMin:neg.ltMin}));
  exigir(neg.vacios>0, 'CONTROL: una entrada negativa deja '+neg.vacios+' fotogramas vacios ('+neg.pctVacio+'%) — la fase sabe fallar');
  const negOk = await evalEn(pag, `(()=>{ const c=state.clips.find(x=>x.mediaId===${NIDO_ID});
    const toco=acotarBucle(c); const r=${CENSO}; r.toco=toco; return r; })()`, 30000);
  exigir(negOk.toco===true && negOk.inP===0, 'el guardian sube la entrada a 0 — queda en '+negOk.inP);
  exigir(negOk.vacios===0, 'y no queda ni un fotograma vacio — hay '+negOk.vacios);

  console.log('\n[5] higiene de estado: lo que el guardian normaliza SIN consecuencia visible');
  /* Honestidad sobre el alcance: desde R368 estas dos correcciones ya NO se ven en pantalla —el envoltorio
     dibuja lo mismo con la entrada sin normalizar—. MEDIDO aqui mismo antes de escribirlo: `inP`=7 da 0 vacios
     con y sin guardian, y `loopLen`=15 tambien. Exigirles «0 fotogramas vacios» seria una comprobacion que no
     puede ponerse roja, o sea ninguna comprobacion. Lo que si se exige es lo que de verdad hacen —dejar el
     estado en su rango— y, explicitamente, que el DIBUJO no cambie: si algun dia cambiara, esto se entera. */
  const fuera = await evalEn(pag, `(()=>{ const c=state.clips.find(x=>x.mediaId===${NIDO_ID});
    c.inP=${CONTENIDO}+2; c.loopLen=${BUCLE}; const antes=${CENSO};
    const toco=acotarBucle(c); const r=${CENSO}; r.toco=toco; r.vaciosAntes=antes.vacios; return r; })()`, 30000);
  exigir(fuera.toco===true && Math.abs(fuera.inP-2)<1e-6, '`inP` fuera de la fuente ('+(CONTENIDO+2)+') se normaliza dentro — queda en '+fuera.inP);
  exigir(fuera.vaciosAntes===fuera.vacios, 'y el dibujo NO cambia por normalizarla ('+fuera.vaciosAntes+' vacios antes y despues): es higiene, no imagen');
  const largo = await evalEn(pag, `(()=>{ const c=state.clips.find(x=>x.mediaId===${NIDO_ID});
    c.inP=${IN_MALO}; c.loopLen=${CONTENIDO}*3; const antes=${CENSO};
    const toco=acotarBucle(c); const r=${CENSO}; r.toco=toco; r.vaciosAntes=antes.vacios; return r; })()`, 30000);
  exigir(largo.toco===true && Math.abs(largo.loopLen-CONTENIDO)<1e-6, 'un ciclo mas largo que la fuente entera se acota — queda en '+largo.loopLen);
  exigir(largo.vaciosAntes===largo.vacios, 'y tampoco cambia el dibujo ('+largo.vaciosAntes+' vacios antes y despues)');

  console.log('\n'+(fallos.length ? '✘ '+fallos.length+' comprobacion(es) en rojo' : '✔ todo verde'));
  /* `process.exit` en caliente revienta el WebSocket a medio cerrar y Windows saca un
     `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)` con codigo 127 DESPUES del 'todo verde':
     el veredicto se leia bien en pantalla y mal en el codigo de salida. Se deja terminar el bucle. */
  process.exitCode = fallos.length?1:0;
})().catch(e=>{ console.error('✘ sonda reventada:', e.message); process.exitCode = 2; });
