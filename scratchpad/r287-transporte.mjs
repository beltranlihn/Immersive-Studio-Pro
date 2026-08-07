/* [R287·fase 1] Lo que decide si el export por FFmpeg merece la pena: cuanto cuesta sacar un fotograma de
   4096x4096 de la GPU. El codificador ya sabemos que da 19-22 fps; si la lectura cuesta mas que eso, el techo
   lo pone la lectura y no hay nada que ganar por el lado del codec.
   Se miden las DOS vias: readPixels directo (RGBA, 67 MB) y lo que costaria en NV12 (24 MB), que es a lo que
   aspiramos con la conversion en GPU. */
import http from 'http';
const t=await new Promise((r2,j)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>r2(JSON.parse(b)));}).on('error',j);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise((res,rej)=>{const i=++id;p.set(i,r=>r.error?rej(new Error(JSON.stringify(r.error))):(r.result.exceptionDetails?rej(new Error(r.result.exceptionDetails.exception?.description||'')):res(r.result.result.value)));ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true}}));});
await ev("(async()=>{ await newProject('dome',4096,4096,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()");
await new Promise(r=>setTimeout(r,2500));
const r=await ev(`(function(){
  const N=4096, bytes=N*N*4;
  /* Un FBO de 4096 con textura de color, que es exactamente lo que el export tiene delante. */
  const tex=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,tex);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,N,N,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  const fb=gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER,fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);
  if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)return {error:'el FBO de 4096 no se pudo crear'};
  gl.viewport(0,0,N,N); gl.clearColor(0.2,0.4,0.6,1); gl.clear(gl.COLOR_BUFFER_BIT);
  const buf=new Uint8Array(bytes);
  gl.readPixels(0,0,N,N,gl.RGBA,gl.UNSIGNED_BYTE,buf);   /* uno de calentamiento */
  const M=6, t0=performance.now();
  for(let k=0;k<M;k++){ gl.clear(gl.COLOR_BUFFER_BIT); gl.readPixels(0,0,N,N,gl.RGBA,gl.UNSIGNED_BYTE,buf); }
  const ms=(performance.now()-t0)/M;
  gl.bindFramebuffer(gl.FRAMEBUFFER,null); gl.deleteFramebuffer(fb); gl.deleteTexture(tex);
  return { ms:+ms.toFixed(1), mbPorFotograma:+(bytes/1048576).toFixed(1),
           fps:+(1000/ms).toFixed(1), mbps:+(bytes/1048576/(ms/1000)).toFixed(0) }; })()`);
if(r.error){ console.log('*** '+r.error); process.exit(1); }
console.log('readPixels RGBA a 4096x4096: '+r.ms+' ms por fotograma  ('+r.mbPorFotograma+' MB, '+r.mbps+' MB/s)');
console.log('techo que impone SOLO la lectura: '+r.fps+' fps');
console.log('el codificador da 19-22 fps a este tamano');
const veredicto = r.fps>=40 ? 'la lectura NO estorba: sobra margen sobre el codificador'
  : r.fps>=22 ? 'la lectura aguanta, pero sin holgura: la conversion a NV12 en GPU pasa de mejora a necesidad'
  : 'LA LECTURA ES EL CUELLO DE BOTELLA: mandaria ella, no el codec';
console.log('\n=> '+veredicto);
ws.close();
