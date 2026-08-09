/* [R339] El rotulo bajo el esquema del cuadro de composicion contaba lo PEDIDO, no lo repartido.
   `g.count` es lo que el usuario teclea; el reparto real sale de `compLayout`/`compLayoutFlat`, y no coincide
   siempre -la rejilla se cierra a filas completas, el tejido y el relleno de domo reparten por su cuenta-, asi
   que el cuadro podia anunciar «6 elementos» sobre un esquema con otra cantidad. `flashStatus` ya decia el real
   desde R247c; el rotulo del cuadro se habia quedado atras. `drawComposePreview` devuelve ahora lo que dibuja,
   por sus CINCO salidas (una por rama: plana, anillo, espiral, tunel y girasol) - eran cinco, no una.

   Uso:  npx electron . --remote-debugging-port=9222   y luego   node scratchpad/r339-verif.mjs
*/
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0; const p=new Map(); ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise(r=>{const i=++id;p.set(i,m=>r(m.result&&m.result.exceptionDetails?('EXC '+(m.result.exceptionDetails.exception?.description||'').slice(0,100)):(m.result&&m.result.result&&m.result.result.value)));ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true,timeout:60000}}));});
const r=await ev(`(async()=>{ try{
  await newProject('dome',2048,2048,30,180,true); if(typeof hideLanding==='function')hideLanding();
  const cv=document.createElement('canvas'); cv.width=260; cv.height=180;
  const mide=g=>{ ensureRand(g); const real=(FLAT_COMP_KINDS.includes(g.kind)?compLayoutFlat(g):compLayout(g)).length;
    return {pedido:g.count, real, devuelto:drawComposePreview(g,cv)}; };
  const rej=mide({id:1,kind:'grid',count:6,bands:3,spin:0,rand:[]});
  const anillo=mide({id:2,kind:'ring',count:7,spin:0,rand:[]});
  const tunel=mide({id:3,kind:'tunnel',count:5,spin:0,rand:[]});
  return JSON.stringify({rej, anillo, tunel,
    devuelveElReal: rej.devuelto===rej.real && anillo.devuelto===anillo.real && tunel.devuelto===tunel.real,
    algunoDifiereDelPedido: rej.real!==rej.pedido || anillo.real!==anillo.pedido || tunel.real!==tunel.pedido});
}catch(e){ return 'ERR '+String(e.message).slice(0,100); } })()`);
console.log('');
console.log('R339 - el rotulo del cuadro de composicion dice lo que dibuja');
console.log('  ->', r);
const malas=[];
let o={}; try{ o=JSON.parse(r); }catch(e){ malas.push('sonda rota: '+String(r).slice(0,90)); }
if(!malas.length){
  if(!o.algunoDifiereDelPedido) malas.push('la sonda no mide nada: ningun reparto difiere de lo pedido');
  if(!o.devuelveElReal) malas.push('el rotulo sigue contando lo pedido en vez de lo repartido'); }
console.log('');
for(const m of malas) console.log('   *** '+m);
console.log(malas.length?('*** '+malas.length+' FALLOS'):'el rotulo cuenta lo que hay en el esquema');
ws.close(); process.exit(malas.length?1:0);
