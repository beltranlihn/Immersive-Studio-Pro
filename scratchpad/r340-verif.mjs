/* [R340] Dos entradas Spout compartian una conexion y el bombeo alimentaba siempre a la PRIMERA.
   El nativo mantiene UNA conexion y `inOpen` la re-apunta al ultimo emisor abierto, pero `spoutPump` cogia
   `spoutMediaList()[0]`: con dos entradas, los pixeles del emisor B se subian a la textura de A. A ensenaba lo
   de B y B se quedaba negro, sin aviso. Ahora se reparte por el nombre que el propio nativo declara.
   Se mide el REPARTO (`spoutDestino`), que es la decision; el camino completo pide dos emisores reales.

   Uso:  npx electron . --remote-debugging-port=9222   y luego   node scratchpad/r340-verif.mjs
*/
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0; const p=new Map(); ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise(r=>{const i=++id;p.set(i,m=>r(m.result&&m.result.exceptionDetails?('EXC '+(m.result.exceptionDetails.exception?.description||'').slice(0,100)):(m.result&&m.result.result&&m.result.result.value)));ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true,timeout:60000}}));});
const r=await ev(`(()=>{ try{
  const A={id:1,kind:'spout',spoutSource:'Emisor A'}, B={id:2,kind:'spout',spoutSource:'Emisor B'};
  const dos=[A,B], uno=[A];
  return JSON.stringify({
    aB: (spoutDestino(dos,'Emisor B')||{}).id,
    aA: (spoutDestino(dos,'Emisor A')||{}).id,
    sinNombre: (spoutDestino(dos,null)||{}).id,
    desconocido: (spoutDestino(dos,'Otro')||{}).id,
    unaSola: (spoutDestino(uno,'Emisor B')||{}).id,
    vacia: spoutDestino([],'x'),
    repartePorNombre: (spoutDestino(dos,'Emisor B')||{}).id===2 && (spoutDestino(dos,'Emisor A')||{}).id===1,
    sinNombreElPrimero: (spoutDestino(dos,null)||{}).id===1 && (spoutDestino(dos,'Otro')||{}).id===1,
    unaEntradaIntacta: (spoutDestino(uno,'Emisor B')||{}).id===1});
}catch(e){ return 'ERR '+String(e.message).slice(0,100); } })()`);
console.log('');
console.log('R340 - los fotogramas de Spout van a la entrada que los emite');
console.log('  ->', r);
const malas=[];
let o={}; try{ o=JSON.parse(r); }catch(e){ malas.push('sonda rota: '+String(r).slice(0,90)); }
if(!malas.length){
  if(!o.repartePorNombre) malas.push('los fotogramas siguen yendo siempre a la primera entrada');
  if(!o.sinNombreElPrimero) malas.push('sin nombre declarado ya no cae al primero: cambia el comportamiento de siempre');
  if(!o.unaEntradaIntacta) malas.push('con una sola entrada el reparto ha cambiado: regresion');
  if(o.vacia!==null) malas.push('con la lista vacia deberia devolver null'); }
console.log('');
for(const m of malas) console.log('   *** '+m);
console.log(malas.length?('*** '+malas.length+' FALLOS'):'cada entrada Spout recibe lo suyo');
ws.close(); process.exit(malas.length?1:0);
