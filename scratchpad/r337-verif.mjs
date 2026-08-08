/* [R337] El ping-pong de FX se reasignaba en cada fotograma con una capa de ajuste activa.
   Hay DOS cadenas con tamanyos distintos en el mismo fotograma: la de un clip corre a fxChainSize() -1280 en
   previsualizacion- y la de una capa de ajuste al tamanyo del composite -2048 en domo-. Los dos destinos del
   ping-pong eran una pareja unica, asi que alternar entre ambas hacia cuatro texImage2D de reasignacion por
   fotograma, dos de ellas de 2048x2048 RGBA (16 MB), solo para dejarlo como estaba. Ahora hay un destino por
   tamanyo. Se cuentan las reservas de verdad, no el tiempo: el tiempo aqui mide la GPU del que mida.

   Uso:  npx electron . --remote-debugging-port=9222   y luego   node scratchpad/r337-verif.mjs
*/
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0; const p=new Map(); ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise(r=>{const i=++id;p.set(i,m=>r(m.result&&m.result.exceptionDetails?('EXC '+(m.result.exceptionDetails.exception?.description||'').slice(0,100)):(m.result&&m.result.result&&m.result.result.value)));ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true,timeout:60000}}));});
const r=await ev(`(()=>{ try{
  freeFxResources();
  const orig=WebGL2RenderingContext.prototype.texImage2D; let n=0;
  gl.texImage2D=function(){ n++; return orig.apply(gl,arguments); };
  try{
    _ppRT(0,1280); _ppRT(1,1280); _ppRT(0,2048); _ppRT(1,2048);   // primera vez: cuatro reservas
    const primera=n;
    for(let k=0;k<20;k++){ _ppRT(0,1280); _ppRT(1,1280); _ppRT(0,2048); _ppRT(1,2048); } // veinte fotogramas alternando
    const tras20=n-primera;
    return JSON.stringify({primeraVez:primera, reservasEn20Fotogramas:tras20, entradas:_fxRT.size,
      sinChurn:tras20===0, reservaLoJusto:primera===4});
  } finally { delete gl.texImage2D; }
}catch(e){ return 'ERR '+String(e.message).slice(0,100); } })()`);
console.log('');
console.log('R337 - el ping-pong de FX no se reasigna en cada fotograma');
console.log('  ->', r);
const malas=[];
let o={}; try{ o=JSON.parse(r); }catch(e){ malas.push('sonda rota: '+String(r).slice(0,90)); }
if(!malas.length){
  if(!o.reservaLoJusto) malas.push('la primera vez no reserva los cuatro destinos ('+o.primeraVez+')');
  if(!o.sinChurn) malas.push('sigue reasignando en cada fotograma ('+o.reservasEn20Fotogramas+' reservas en 20)');
  if(o.entradas!==4) malas.push('el pool no guarda un destino por tamanyo ('+o.entradas+')'); }
console.log('');
for(const m of malas) console.log('   *** '+m);
console.log(malas.length?('*** '+malas.length+' FALLOS'):'un destino por tamanyo: sin churn de VRAM');
ws.close(); process.exit(malas.length?1:0);
