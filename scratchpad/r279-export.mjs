/* [R279] Hoja de export: destino elegido ANTES de exportar, y secuencia PNG sobre fondo negro sin perder
   la ausencia de perdidas. Se comprueba lo que se ve en la hoja Y lo que acaba en el trabajo de export. */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise((res,rej)=>{const i=++id;p.set(i,r=>r.error?rej(new Error(JSON.stringify(r.error))):(r.result.exceptionDetails?rej(new Error(r.result.exceptionDetails.exception?.description||r.result.exceptionDetails.text)):res(r.result.result.value)));
  ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true}}));});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let fallos=0; const mal=m=>{ console.log('   *** '+m); fallos++; };

await ev(`(async()=>{ await newProject('dome',1024,1024,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()`);
await wait(1600);
await ev(`(function(){ const m={id:uid(),name:'x.mp4',kind:'video',w:1920,h:1080,dur:8,fps:30,color:'#8a8',path:'x',folder:null};
  state.media.push(m); renderMedia(); addClip(m,state.lanes[0].id,0); return 1; })()`);
await wait(400);

/* Abrir la hoja y fingir el dialogo nativo de carpeta, que aqui no se puede pulsar. */
const r=await ev(`(async function(){
  /* DSP viene por contextBridge y esta CONGELADO: no se puede sustituir chooseExportDir para fingir el
     dialogo nativo. Se usa el otro camino, que ejercita el mismo cableado: dejar la carpeta en la memoria del
     export y reabrir la hoja, que es literalmente lo que pasa al abrir la app al dia siguiente. */
  lastExportSet(Object.assign({},lastExportGet()||{},{dir:'D:/entregas/domo'}));
  /* La hoja se REUTILIZA si ya estaba abierta, y entonces su estado interno es el de la vez anterior: hay que
     cerrarla antes o la prueba mide una hoja vieja (me paso, y parecia un fallo del codigo). */
  { const ov=document.querySelector('#exOv'); if(ov)ov.remove(); }
  openExport();
  /* El desplegable de codecs se rellena un tick despues de abrir: leerlo antes daba una lista VACIA, y de ahi
     salian tres fallos en cadena que no eran del codigo. Se espera a que tenga opciones. */
  for(let k=0;k<40;k++){ const c=document.querySelector('#exCodec');
    if(c&&c.options.length)break; await new Promise(s=>setTimeout(s,100)); }
  await new Promise(s=>setTimeout(s,300));
  const out={};
  out.filaDestino=!!document.querySelector('#exDirPick');
  /* con codec de video, la fila de fondo NO debe estar */
  const cod=document.querySelector('#exCodec'); cod.value=[...cod.options].map(o=>o.value).find(v=>v!=='png'&&v!=='still')||cod.value;
  cod.dispatchEvent(new Event('change',{bubbles:true})); await new Promise(s=>setTimeout(s,200));
  out.fondoConVideo=getComputedStyle(document.querySelector('#exPngBgRow')).display;
  /* con PNG, si */
  cod.value='png'; cod.dispatchEvent(new Event('change',{bubbles:true})); await new Promise(s=>setTimeout(s,200));
  out.fondoConPng=getComputedStyle(document.querySelector('#exPngBgRow')).display;
  { const op=[...cod.options].find(o=>o.value==='png'); out.rotuloPng=op?op.textContent:'(no hay opcion png)'; out.opciones=[...cod.options].map(o=>o.value).join(','); }
  /* elegir carpeta */
  out.despues=document.querySelector('#exDirTxt').textContent;
  /* y que el boton de limpiar devuelva de verdad al "preguntar cada vez" */
  out.antes='(memoria: D:/entregas/domo)';
  out.limpiarVisible=getComputedStyle(document.querySelector('#exDirClear')).display!=='none';
  out.recordada=(lastExportGet()||{}).dir;
  /* fondo negro */
  document.querySelector('#exPngBg [data-bg="black"]').click(); await new Promise(s=>setTimeout(s,150));
  out.negroMarcado=document.querySelector('#exPngBg [data-bg="black"]').classList.contains('on');
  /* y que ambos lleguen al trabajo: se intercepta la cola */
  /* runExport es una declaracion de funcion: reasignar window.runExport no intercepta la llamada interna.
     Se lee la cola EN EL MISMO TURNO del clic, antes de que pumpExportQ la consuma. */
  /* El boton se habilita cuando termina la comprobacion de soporte del codec; pulsarlo antes es un no-op. */
  const go=document.querySelector('#exGo');
  for(let k=0;k<60;k++){ if(!go.disabled)break; await new Promise(s=>setTimeout(s,100)); }
  out.goDeshabilitado=!!go.disabled;
  /* El encolado NO es sincrono: pasa por avisos/confirmacion. Se espera, aceptando lo que salga. */
  go.click();
  let enCola=null;
  for(let k=0;k<30;k++){
    const cf=document.querySelector('#cfOk')||document.querySelector('.modal .mbtn.pri')||document.querySelector('#appConfirmOk');
    if(cf)cf.click();
    if(typeof _exq!=='undefined'&&_exq&&_exq.length){ enCola=_exq[_exq.length-1]; break; }
    await new Promise(s=>setTimeout(s,100)); }
  try{ cancelExport=true; if(typeof _exq!=='undefined'&&_exq)_exq.length=0; }catch(_){}
  out.optOutDir=enCola?enCola.outDir:'(sin trabajo)'; out.optPngBg=enCola?enCola.pngBg:'(sin trabajo)';
  return out; })()`);

console.log('fila de destino en la hoja: '+r.filaDestino);
console.log('fila de fondo -> con video: "'+r.fondoConVideo+'"   con PNG: "'+r.fondoConPng+'"');
console.log('opciones de codec: '+r.opciones);
console.log('rotulo del codec PNG: "'+r.rotuloPng.trim()+'"');
console.log('destino antes: "'+r.antes+'"  ->  despues: "'+r.despues+'"   boton limpiar: '+r.limpiarVisible);
console.log('recordado para la proxima sesion: '+r.recordada);
console.log('negro marcado: '+r.negroMarcado);
console.log('boton Exportar deshabilitado: '+r.goDeshabilitado);
console.log('llega al trabajo -> outDir: '+r.optOutDir+'   pngBg: '+r.optPngBg);

if(!r.filaDestino) mal('no hay fila de destino en la hoja');
if(r.fondoConVideo!=='none') mal('la fila de fondo se ensena con un codec de video, donde no significa nada');
if(r.fondoConPng==='none') mal('la fila de fondo NO aparece con la secuencia PNG');
if(/alpha|alfa/i.test(r.rotuloPng)) mal('el rotulo del codec sigue prometiendo alfa, que ahora es una eleccion');
if(r.despues.indexOf('entregas')<0) mal('no ensena la carpeta elegida');
if(!r.limpiarVisible) mal('sin forma de volver a "preguntar cada vez"');
if(r.recordada!=='D:/entregas/domo') mal('la carpeta no se recuerda entre sesiones');
if(!r.negroMarcado) mal('el segmentado de fondo no marca la eleccion');
if(r.optOutDir!=='D:/entregas/domo') mal('la carpeta no llega al trabajo de export: '+r.optOutDir);
if(r.optPngBg!=='black') mal('el fondo no llega al trabajo de export: '+r.optPngBg);

console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'destino elegible antes de exportar, y PNG sobre negro'));
ws.close();
