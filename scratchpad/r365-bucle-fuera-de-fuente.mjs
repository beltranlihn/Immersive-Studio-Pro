/* [R365] SONDA — un clip en bucle no puede pedir material que su fuente no tiene.
   ───────────────────────────────────────────────────────────────────────────────────────────────────────────
   Reproduce la forma EXACTA del caso medido en el proyecto de domo de Vicente: una composicion cuyo contenido
   dura 5 s, instanciada con `loop`, `loopLen`=5 y `inP`=2,873. La ventana del bucle es `[inP, inP+loopLen)` =
   [2,873 · 7,873), o sea que 2,873 s de cada vuelta caen MAS ALLA del final del contenido y no hay nada que
   componer: la composicion se ve vacia y reaparece en la vuelta siguiente.

   Mide la CONCLUSION, no la premisa: recorre una vuelta entera fotograma a fotograma y cuenta, con el `srcT`
   REAL de la aplicacion y los rangos REALES de los hijos, cuantos clips hay dibujables en cada instante. Un
   instante con cero es un fotograma vacio en pantalla.

   Y SABE FALLAR: la fase 3 vuelve a poner `inP`=2,873 a mano —el estado anterior al arreglo— y EXIGE que
   aparezcan instantes vacios. Sin ese control, un `srcT` que devolviera siempre 0 tambien daria verde.

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
  if(!pag){ console.error('✘ no encuentro la pagina del editor con `srcT`. ¿Lanzaste `npx electron . --remote-debugging-port=9222`?'); process.exit(2); }
  console.log('· pagina del editor encontrada');

  console.log('\n[1] abriendo el proyecto de prueba (con el bucle desbordado grabado en el archivo)');
  await evalEn(pag, `openProjectPath(${JSON.stringify(ISP)}, true)`, 120000);
  let m=null;
  for(let i=0;i<40;i++){ await dormir(1000); m=await evalEn(pag, CENSO, 20000); if(m&&!m.error)break; }
  if(!m||m.error){ console.error('✘ no se estabilizó:', JSON.stringify(m)); process.exit(2); }
  console.log('  censo de una vuelta:', JSON.stringify(m));

  console.log('\n[2] ¿lo repara al abrir, y deja de haber fotogramas vacios?');
  exigir(m.contenido===CONTENIDO, 'el contenido de la composicion mide '+CONTENIDO+' s — mide '+m.contenido);
  exigir(m.loopLen===BUCLE, 'el ciclo del bucle se CONSERVA en '+BUCLE+' s (no se recorta para que quepa) — es '+m.loopLen);
  exigir(m.inP===0, '`inP` se ha deslizado a 0 (la ventana cabe justa) — es '+m.inP);
  exigir(m.ltMax<CONTENIDO+1e-6, 'el instante mas alto que pide el bucle ('+m.ltMax+') ya no se sale del contenido');
  exigir(m.vacios===0, 'NINGUN fotograma de la vuelta se queda sin nada que componer — hay '+m.vacios);

  console.log('\n[3] control negativo — devuelvo `inP` al valor averiado');
  const malo = await evalEn(pag, `(()=>{ const c=state.clips.find(x=>x.mediaId===${NIDO_ID}); c.inP=${IN_MALO}; return ${CENSO}; })()`, 30000);
  console.log('  con inP='+IN_MALO+':', JSON.stringify({vacios:malo.vacios, pctVacio:malo.pctVacio, ltMax:malo.ltMax, primerVacio:malo.primerVacio}));
  exigir(malo.vacios>0, 'la sonda SABE fallar: con el bucle desbordado aparecen '+malo.vacios+' fotogramas vacios ('+malo.pctVacio+'% de la vuelta)');
  exigir(malo.ltMax>CONTENIDO, 'y el bucle pide material mas alla del contenido ('+malo.ltMax+' > '+CONTENIDO+')');
  exigir(malo.primerVacio!==null && Math.abs(malo.primerVacio-CONTENIDO)<0.05,
    'el hueco empieza justo donde se acaba el contenido ('+malo.primerVacio+' ≈ '+CONTENIDO+')');

  console.log('\n[4] y el guardian tambien lo arregla en caliente');
  const curado = await evalEn(pag, `(()=>{ const c=state.clips.find(x=>x.mediaId===${NIDO_ID}); acotarBucle(c); return ${CENSO}; })()`, 30000);
  exigir(curado.vacios===0 && curado.inP===0, '`acotarBucle` deja la ventana dentro y sin fotogramas vacios');

  console.log('\n'+(fallos.length ? '✘ '+fallos.length+' comprobacion(es) en rojo' : '✔ todo verde'));
  process.exit(fallos.length?1:0);
})().catch(e=>{ console.error('✘ sonda reventada:', e.message); process.exit(2); });
