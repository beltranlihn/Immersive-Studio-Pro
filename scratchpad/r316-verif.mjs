/* [R316] Dos avisos apilados ya no se cierran con UNA sola pulsación.
   El caso real: `pumpProxy` llama a `appAlert(e.userMsg)` sin esperar y sigue con la cola, así que dos proxys
   que fallan seguidos apilan dos `#alertOv`. Los dos escuchan el teclado en `document` y en captura, y el
   oyente MÁS VIEJO corre primero — con `stopPropagation`, que no frena a los hermanos del mismo nodo, un Enter
   cerraba los dos y el segundo aviso no llegaba a leerse nunca.
   Se comprueba además que el de arriba SÍ responde (una guarda que lo dejara sordo sería peor que el fallo).
   Uso:  npx electron . --remote-debugging-port=9222   y luego   node scratchpad/r316-verif.mjs
*/
import http from 'http';
const targets = await new Promise((res,rej)=>{ http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{
  let b=''; r.on('data',c=>b+=c); r.on('end',()=>res(JSON.parse(b))); }).on('error',rej); });
const pg = targets.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
if(!pg){ console.log('*** la aplicacion no esta abierta con --remote-debugging-port=9222'); process.exit(1); }
const ws = new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let _id=0; const pend=new Map();
ws.onmessage = e => { const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){ pend.get(m.id)(m); pend.delete(m.id); } };
const ev = expr => new Promise((res,rej)=>{ const i=++_id; pend.set(i,r=>{
    if(r.error) return rej(new Error(JSON.stringify(r.error)));
    if(r.result.exceptionDetails) return rej(new Error(r.result.exceptionDetails.exception?.description||'excepcion'));
    res(r.result.result.value); });
  ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:expr,awaitPromise:true,returnByValue:true,timeout:60000}})); });

let fallos=0; const mal=m=>{ console.log('   *** '+m); fallos++; };
const bien=m=>console.log('   ✓ '+m);

console.log('\n── dos avisos apilados: un Enter cierra UNO ──');
const r = await ev(`(async()=>{ try{
  document.querySelectorAll('.overlay').forEach(o=>o.remove());
  const leidos=[];
  appAlert('primer aviso',()=>leidos.push(1));     // como hace pumpProxy: sin esperar
  appAlert('segundo aviso',()=>leidos.push(2));
  await new Promise(z=>setTimeout(z,200));
  const abiertos=document.querySelectorAll('#alertOv').length;
  document.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  await new Promise(z=>setTimeout(z,200));
  const trasUno=document.querySelectorAll('#alertOv').length;
  document.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  await new Promise(z=>setTimeout(z,200));
  const trasDos=document.querySelectorAll('#alertOv').length;
  document.querySelectorAll('.overlay').forEach(o=>o.remove());
  return {abiertos,trasUno,trasDos,leidos};
}catch(e){ return {err:String(e&&e.message||e)}; } })()`);
if(r.err) mal('no se pudo evaluar: '+r.err);
else{
  console.log('   avisos abiertos: '+r.abiertos+' → tras un Enter: '+r.trasUno+' → tras el segundo: '+r.trasDos+'   (respondidos: ['+r.leidos+'])');
  if(r.abiertos!==2) mal('no se apilaron los dos avisos ('+r.abiertos+')');
  else if(r.trasUno!==1) mal('un solo Enter cerro '+(2-r.trasUno)+' avisos: el segundo no llega a leerse');
  else if(r.trasDos!==0) mal('el segundo Enter no cerro el aviso que quedaba → el de abajo se quedo sordo');
  else bien('cada Enter cierra UN aviso, en orden, y los dos se leen');
}

console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'la guarda de apilado cubre tambien los avisos'));
ws.close(); process.exit(fallos?1:0);
