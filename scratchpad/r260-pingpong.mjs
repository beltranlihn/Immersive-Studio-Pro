/* [R260] La rama que R256 toco y no se habia probado: el bucle PING-PONG (`loopRev`), donde el indice de ciclo
   `k` decide si la vuelta va al reves. Al corregir el modulo, `k` puede incrementarse — si eso quedo mal, las
   vueltas pares/impares se invierten y el ping-pong sale al reves.
   Prueba CORTA y sin exportar nada: se leen los instantes de fuente directamente del motor. */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise((res,rej)=>{const i=++id;p.set(i,r=>r.error?rej(new Error(JSON.stringify(r.error))):(r.result.exceptionDetails?rej(new Error(r.result.exceptionDetails.text)):res(r.result.result.value)));
  ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true}}));});

/* Un clip de mentira: srcT solo lee campos, no hace falta ni medio ni GPU. */
const r=await ev(`(function(){
  const c={start:0, speed:1, inP:4, loop:true, loopLen:0.4, loopRev:false};
  const leer=()=>{ const o=[]; for(let k=0;k<24;k++) o.push(+(srcT(c,k/30)-c.inP).toFixed(4)); return o; };
  const ida=leer(); c.loopRev=true; const pp=leer();
  return { ida, pp, L:c.loopLen };
})()`);
const F=(a)=>a.map(v=>v.toFixed(2)).join(' ');
console.log('bucle normal   (12 fotogramas por vuelta, fase desde inP):');
console.log('   vuelta 1: '+F(r.ida.slice(0,12)));
console.log('   vuelta 2: '+F(r.ida.slice(12,24)));
console.log('ping-pong:');
console.log('   vuelta 1: '+F(r.pp.slice(0,12)));
console.log('   vuelta 2: '+F(r.pp.slice(12,24)));

let fallos=[];
/* 1. el bucle normal repite identico */
for(let k=0;k<12;k++) if(Math.abs(r.ida[k]-r.ida[k+12])>1e-9) fallos.push('el bucle normal no repite en el fotograma '+k);
/* 2. el ping-pong: vuelta 1 IGUAL que el normal, vuelta 2 es su ESPEJO (L-fase) */
for(let k=0;k<12;k++) if(Math.abs(r.pp[k]-r.ida[k])>1e-9) fallos.push('la vuelta 1 del ping-pong no coincide con la ida, fotograma '+k);
for(let k=0;k<12;k++){ const esperado=r.L-r.ida[k]; if(Math.abs(r.pp[k+12]-esperado)>1e-9) fallos.push('la vuelta 2 del ping-pong no es el espejo en el fotograma '+k+' ('+r.pp[k+12]+' en vez de '+esperado.toFixed(4)+')'); }
/* 3. y tiene que ir hacia ATRAS en la vuelta 2 */
let baja=0; for(let k=13;k<24;k++) if(r.pp[k]<r.pp[k-1]) baja++;
if(baja<10) fallos.push('la vuelta 2 del ping-pong no va hacia atras ('+baja+' de 11 pasos descendentes)');

console.log('\n'+(fallos.length? '*** '+fallos.length+' FALLOS:\n   '+fallos.slice(0,4).join('\n   ') : 'ping-pong correcto: ida igual que el bucle normal, vuelta espejo y descendente'));
ws.close();
