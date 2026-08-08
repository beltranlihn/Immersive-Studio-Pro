/* [R326] Importacion, medios y proxies — del inventario de la auditoria (§9/§10).
     1 · un archivo que no encaja en ninguna rama (`.mxf`, `.r3d`, `.braw` llegan sin tipo MIME) desaparecia:
         ni medio ni error. Arrastrar una carpeta de camara importaba unos si y otros no, sin decir cuales.
     2 · el dedup de import consultaba `nombre|tamaño` AUNQUE hubiera ruta, y descartaba como «duplicados»
         archivos distintos que coinciden en los dos.
     3 · dos clics en «Generar proxy» encolaban el mismo medio dos veces = dos codificaciones completas.
     4 · con el panel de medios vacio, «Nueva carpeta» creaba una carpeta INVISIBLE que si viajaba al `.isp`.
     5 · el selector de `renameFolderInline` no escapaba el nombre: una comilla lo hacia reventar.
   (En la misma ronda, sin sonda propia: doble `fileClose` en el catch de `pumpProxy`, URLs de objeto sin revocar
   en el import de audio y en la regeneracion de proxy, el plazo de `detectFps` que no se cancelaba, el reintento
   de `attachLinkedAudio` y la segunda entrada Spout que pintaba sobre la primera.)

   Uso:  npx electron . --remote-debugging-port=9222   y luego   node scratchpad/r326-verif.mjs
*/
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0; const p=new Map(); ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise(r=>{const i=++id;p.set(i,m=>r(m.result&&m.result.exceptionDetails?('EXC '+(m.result.exceptionDetails.exception?.description||'').slice(0,80)):(m.result&&m.result.result&&m.result.result.value)));ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true,timeout:60000}}));});

console.log('1) un formato no reconocido se DICE en vez de desaparecer');
console.log('  ->', await ev(`(async()=>{ try{
  await newProject('flat',1920,1080,30,180,true); if(typeof hideLanding==='function')hideLanding();
  const antes=(document.getElementById('statAuto')||{}).textContent||'';
  const f=new File([new Uint8Array(8)],'toma.mxf',{type:''});     // sin tipo MIME, como un MXF real
  importFiles([f],null,{noSeq:true});
  await new Promise(z=>setTimeout(z,250));
  const msg=(document.getElementById('statAuto')||{}).textContent||'';
  return JSON.stringify({avisa:/mxf|admitido|supported/i.test(msg), medios:state.media.length, msg:msg.slice(0,70)});
}catch(e){ return 'ERR '+String(e.message).slice(0,80); } })()`));

console.log('2) el dedup: con RUTA manda la ruta y solo la ruta');
console.log('  ->', await ev(`(async()=>{ try{
  /* No se puede medir con un File sintetico: getPathForFile devuelve vacio, asi que nunca hay ruta y el
     camino arreglado no llega a ejecutarse. Se buscan las dos formas LITERALES en el fuente. */
  const t=await (await fetch('app.js')).text();
  const nueva="if(kp?seen.has(kp):seen.has(kn))";
  const vieja="if((kp&&seen.has(kp))||seen.has(kn))";
  return JSON.stringify({rutaManda:t.indexOf(nueva)>=0, yaNoConsultaLasDos:t.indexOf(vieja)<0});
}catch(e){ return 'ERR '+String(e.message).slice(0,80); } })()`));

console.log('3) enqProxy no encola el mismo medio dos veces');
console.log('  ->', await ev(`(()=>{ try{
  const m={id:870002,kind:'video',name:'v',path:'C:/x.mp4'};
  const n0=proxyQ.length; proxyBusy=true;            // que no arranque
  enqProxy(m); enqProxy(m); enqProxy(m);
  const n1=proxyQ.length; proxyQ.length=n0; proxyBusy=false;
  return JSON.stringify({encoladas:n1-n0});
}catch(e){ return 'ERR '+String(e.message).slice(0,80); } })()`));

console.log('4) el panel pinta las carpetas aunque no haya medios');
console.log('  ->', await ev(`(async()=>{ try{
  await newProject('flat',1920,1080,30,180,true); if(typeof hideLanding==='function')hideLanding();
  state.folders=['Carpeta nueva']; renderMedia();
  await new Promise(z=>setTimeout(z,150));
  const txt=(document.getElementById('mediaList')||{}).innerHTML||'';
  return JSON.stringify({medios:state.media.length, seVeLaCarpeta:/Carpeta nueva/.test(txt), soloZonaArrastre:/dropZone/.test(txt)&&!/Carpeta nueva/.test(txt)});
}catch(e){ return 'ERR '+String(e.message).slice(0,80); } })()`));

console.log('5) renameFolderInline con una comilla en el nombre no revienta');
console.log('  ->', await ev(`(()=>{ try{
  renameFolderInline('mi "carpeta"', null);
  return JSON.stringify({sobrevive:true});
}catch(e){ return JSON.stringify({sobrevive:false, err:String(e.message).slice(0,60)}); } })()`));
ws.close(); process.exit(0);
