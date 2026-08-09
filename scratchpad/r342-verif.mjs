/* [R342] El demuxador ignoraba la EDIT LIST (`edts/elst`).
   `elst` dice desde que instante del medio empieza la presentacion. `<video>` la aplica y este camino no, asi
   que un archivo con edit list real -y la tiene cualquier recorte hecho sin recodificar- mostraba fotogramas
   distintos en la previsualizacion y en el export.
   Se mide con DOS archivos reales de la carpeta de descargas, uno con edit list de desfase y otro sin el:
     · futuristic-circular-…utc.mp4  -> elst con media_time 1024, timescale 15360 = 66,7 ms = DOS fotogramas
     · typewriter-…mp4               -> elst con media_time 0 (el CONTROL: sin desfase no debe cambiar nada)
   El archivo con desfase lleva ademas un `ctts` inicial que lo cancela exactamente -para eso existe la edit
   list-, asi que la presentacion tiene que arrancar en 0. Sin el arreglo arrancaba en +66,7 ms.

   Uso:  npx electron . --remote-debugging-port=9222   y luego   node scratchpad/r342-verif.mjs
*/
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0; const p=new Map(); ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise(r=>{const i=++id;p.set(i,m=>r(m.result&&m.result.exceptionDetails?('EXC '+(m.result.exceptionDetails.exception?.description||'').slice(0,140)):(m.result&&m.result.result&&m.result.result.value)));ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true,timeout:60000}}));});
import { existsSync } from 'fs';
const D='C:/Users/beltr/Downloads/';
const CON=D+'futuristic-circular-minimal-hud-animation-tech-int-2026-01-28-05-35-47-utc.mp4';
const SIN=D+'typewriter-2026-07-11-17-31-07.mp4';
if(!existsSync(CON)||!existsSync(SIN)){ console.log('   -- material de prueba ausente: se salta (no es un fallo)'); ws.close(); process.exit(0); }
const r=await ev(`(async()=>{ try{
  const mide=async(ruta)=>{ const dd=await demuxMP4(ruta);
    const o={n:dd.samples.length, ts:dd.timescale, off:+dd.elstOff.toFixed(6), pts0:+dd.samples[0].ptsExact.toFixed(2)};
    try{ dd.close(); }catch(e){} return o; };
  return JSON.stringify({con:await mide(${JSON.stringify(CON)}), sin:await mide(${JSON.stringify(SIN)})});
}catch(e){ return 'ERR '+String(e.message).slice(0,140); } })()`);
console.log('');
console.log('R342 - el demuxador aplica la edit list');
console.log('  ->', r);
const malas=[];
let o={}; try{ o=JSON.parse(r); }catch(e){ malas.push('sonda rota: '+String(r).slice(0,120)); }
if(!malas.length){
  if(!(o.con.off>0.06&&o.con.off<0.07)) malas.push('no se esta leyendo la edit list del archivo con desfase (off='+o.con.off+', se esperaba 1024/15360)');
  if(o.con.pts0!==0) malas.push('la presentacion no arranca en 0 con la edit list aplicada (pts0='+o.con.pts0+' us)');
  if(o.sin.off!==0) malas.push('el archivo SIN desfase ha cogido uno (off='+o.sin.off+'): falso positivo');
  if(o.sin.pts0!==0) malas.push('el archivo sin desfase ya no arranca en 0: regresion'); }
console.log('');
for(const m of malas) console.log('   *** '+m);
console.log(malas.length?('*** '+malas.length+' FALLOS'):'la edit list se aplica, y el archivo sin ella no cambia');
ws.close(); process.exit(malas.length?1:0);
