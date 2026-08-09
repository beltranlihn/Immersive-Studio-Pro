/* [R341] El horneado del cache de un nido recortaba las esquinas del cuadrado.
   `chapaLienzo` recorta al disco del domo siempre que la secuencia sea de domo, y el horneado de un cache de
   nido pasa por ahi. Pero ese archivo NO es una entrega: es una textura intermedia que el padre muestrea
   ENTERA -un nido se coloca, se escala y se gira, asi que sus esquinas son contenido-. Recortarlas hacia que
   ACTIVAR el cache cambiara la imagen, que es la regresion que R180 midio y cerro por otro lado.
   Se mide POR PIXELES en una esquina: con `squareNest` tiene que sobrevivir, y sin el -una entrega de domo de
   verdad- tiene que seguir recortandose. El segundo caso es el control: sin el, "no recortar nunca" pasaria.

   Uso:  npx electron . --remote-debugging-port=9222   y luego   node scratchpad/r341-verif.mjs
*/
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0; const p=new Map(); ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise(r=>{const i=++id;p.set(i,m=>r(m.result&&m.result.exceptionDetails?('EXC '+(m.result.exceptionDetails.exception?.description||'').slice(0,100)):(m.result&&m.result.result&&m.result.result.value)));ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true,timeout:60000}}));});
const r=await ev(`(async()=>{ try{
  await newProject('dome',2048,2048,30,180,true); if(typeof hideLanding==='function')hideLanding();
  /* Se pinta el lienzo entero de blanco: la esquina esta clarisimamente FUERA del disco inscrito. */
  /* El lienzo se devuelve como estaba en un finally: la primera version lo dejaba en 256 y las redes que
     vienen detras -que miden PIXELES- se encontraban un lienzo que no era el suyo y fallaban con un
     'la sonda no mide nada' que no tenia nada que ver con su arreglo. Una sonda que ensucia el estado
     contamina a las siguientes. */
  const _gw=glc.width, _gh=glc.height, _rw=gridc.width, _rh=gridc.height;
  try{
  const W=glc.width=256, H=glc.height=256;
  gl.viewport(0,0,W,H); gl.disable(gl.SCISSOR_TEST);
  gl.bindFramebuffer(gl.FRAMEBUFFER,null); gl.clearColor(1,1,1,1); gl.clear(gl.COLOR_BUFFER_BIT);
  const esquina=(cv)=>{ const c2=document.createElement('canvas'); c2.width=1; c2.height=1;
    const x2=c2.getContext('2d'); x2.drawImage(cv,3,3,1,1,0,0,1,1);
    const d=x2.getImageData(0,0,1,1).data; return {r:d[0],a:d[3]}; };
  /* [R343] La excepcion vive en la bandera de modulo _ncSquare -la misma que usan las otras excepciones por
     este hecho- y no en el opt: leerla por duplicado dejaba que las dos divergieran. La red se actualiza al
     contrato nuevo en vez de borrar el caso. (Undecima vez: nada de acentos graves aqui dentro.) */
  const bak=_ncSquare;
  _ncSquare=true;  const conNido=esquina(chapaLienzo(glc,{},0,0,1,30));
  gl.clearColor(1,1,1,1); gl.clear(gl.COLOR_BUFFER_BIT);
  _ncSquare=false; const entrega=esquina(chapaLienzo(glc,{},0,0,1,30));
  _ncSquare=bak;
  return JSON.stringify({conNido, entrega,
    elNidoConservaLaEsquina: conNido.a>200 && conNido.r>200,
    laEntregaSigueRecortando: entrega.a<40});
  } finally { glc.width=_gw; glc.height=_gh; gridc.width=_rw; gridc.height=_rh;
    try{ resize(); }catch(e){} try{ render(); }catch(e){} }
}catch(e){ return 'ERR '+String(e.message).slice(0,110); } })()`);
console.log('');
console.log('R341 - el horneado de un nido conserva sus esquinas');
console.log('  ->', r);
const malas=[];
let o={}; try{ o=JSON.parse(r); }catch(e){ malas.push('sonda rota: '+String(r).slice(0,100)); }
if(!malas.length){
  if(!o.elNidoConservaLaEsquina) malas.push('el horneado del cache sigue recortando las esquinas ('+JSON.stringify(o.conNido)+')');
  if(!o.laEntregaSigueRecortando) malas.push('una entrega de domo ya no se recorta al disco: regresion ('+JSON.stringify(o.entrega)+')'); }
console.log('');
for(const m of malas) console.log('   *** '+m);
console.log(malas.length?('*** '+malas.length+' FALLOS'):'el cache conserva el cuadrado y la entrega sigue siendo un disco');
ws.close(); process.exit(malas.length?1:0);
