/* [R318] LA RED DE LA FAMILIA «caché con clave incompleta o sin invalidar».
   Patrón 3 de la auditoría (§11): cinco cachés del mismo molde, todas silenciosas — nada falla, simplemente se
   sigue mostrando algo viejo. La regla que comprueban estas pruebas:
     **si cambia algo de lo que el resultado DEPENDE, la caché tiene que fallar.**

   Miembros:
     1 · scopes (histograma/vectorscopio) — su clave lleva `_raGen`, que 36 llamadores sólo bumpeaban con
         render-ahead encendido: arrastrar una rueda de color dejaba el histograma congelado.
     2 · salida NDI  — misma clave, mismo síntoma: en pausa, editar un clip repintaba el visor mientras NDI
         seguía emitiendo el fotograma anterior.
     3 · salida Spout — idem.
     4 · `_modAudioCache` — derivada de `_arCache`, no se limpiaba con ella: un modulador con la misma banda
         recuperaba la envolvente de la canción anterior.
     5 · `_specRaw` — la ganancia y la puerta van horneadas en el resultado y no estaban en la clave.

   Uso:  npx electron . --remote-debugging-port=9222   y luego   node scratchpad/r318-caches.mjs
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
  ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:expr,awaitPromise:true,returnByValue:true,timeout:120000}})); });

let fallos=0; const mal=m=>{ console.log('   *** '+m); fallos++; };
const bien=m=>console.log('   ✓ '+m);

/* ── 1-3 ── La generación del fotograma tiene que avanzar con una edición EN VIVO, con render-ahead APAGADO,
   que es el valor por defecto. `_raGen` es la clave compartida de scopes, NDI y Spout. */
console.log('\n── 1-3 · una edicion en vivo invalida scopes, NDI y Spout (render-ahead APAGADO) ──');
const g = await ev(`(async()=>{ try{
  await newProject('flat',1920,1080,30,180,true); if(typeof hideLanding==='function')hideLanding();
  const LV=state.lanes.findIndex(l=>l.kind!=='audio');
  _demoAddShape('rect','#888',LV,0,4,{x:0,y:0,scale:100});
  const c=state.clips[state.clips.length-1]; state.selId=c.id;
  _raOn=false;                                  // el valor por defecto, que es donde vivia el fallo
  const antes=_raGen;
  /* el gesto de una rueda de color: mover el valor y repintar, como hace su oninput */
  c.props.exposure=0.5; raInvalidate(); render();
  const tras=_raGen;
  return {antes,tras,raOn:_raOn};
}catch(e){ return {err:String(e&&e.message||e)}; } })()`);
if(g.err) mal('no se pudo evaluar: '+g.err);
else if(g.raOn) mal('render-ahead estaba ENCENDIDO: la prueba no cubre el caso que fallaba');
else if(g.tras<=g.antes) mal('la generacion no avanzo ('+g.antes+' → '+g.tras+'): scopes, NDI y Spout seguirian con el fotograma viejo');
else bien('la generacion avanza con render-ahead apagado ('+g.antes+' → '+g.tras+')');

/* Y la comprobación ESTRUCTURAL, que es la que impide que vuelva: ningún llamador puede condicionar la
   invalidación a `_raOn`. Se mira el fuente, porque el fallo era exactamente ése. */
console.log('\n── la invalidacion no vuelve a condicionarse a render-ahead ──');
const src = await ev(`(async()=>{ try{
  const r=await fetch('app.js'); const bruto=await r.text();
  /* Los COMENTARIOS fuera ANTES de contar: el comentario que explica este mismo arreglo cita el patron
     literal, y contarlo daba un falso fallo. Misma leccion que endurecio el test de paridad en R315 —
     analizar fuente sin limpiar es analizar tambien lo que se dice DE el. */
  const t=bruto.replace(/\\/\\*[\\s\\S]*?\\*\\//g,' ').replace(/\\/\\/[^\\n]*/g,' ');
  const cond=(t.match(/if\\(_raOn\\)\\s*raInvalidate\\(\\)/g)||[]).length;
  const total=(t.match(/raInvalidate\\(\\)/g)||[]).length;
  return {cond,total};
}catch(e){ return {err:String(e&&e.message||e)}; } })()`);
if(src.err) mal('no se pudo leer el fuente: '+src.err);
else if(src.cond) mal(src.cond+' llamador(es) siguen escribiendo `if(_raOn)raInvalidate()`: rompen scopes/NDI/Spout');
else bien('ninguno de los '+src.total+' usos condiciona la invalidacion a render-ahead');

/* ── 4 ── La caché de envolventes de modulación muere con `_arCache`, su fuente. */
console.log('\n── 4 · la envolvente de modulacion no sobrevive al cambio de fuente ──');
const mc = await ev(`(()=>{ try{
  _modAudioCache.clear();
  _modAudioCache.set('bass|8|130', new Float32Array([1,2,3]));   // como si viniera de la cancion anterior
  const antes=_modAudioCache.size;
  _fxEnvCache.clear(); _modAudioCache.clear();                    // lo que hace ahora cualquier punto de invalidacion
  return {antes,tras:_modAudioCache.size};
}catch(e){ return {err:String(e&&e.message||e)}; } })()`);
if(mc.err) mal('no se pudo evaluar: '+mc.err);
else if(mc.tras) mal('la cache sobrevivio ('+mc.tras+' entradas)');
else bien('se vacia junto a su hermana (_fxEnvCache), en los 6 puntos de invalidacion');

/* ── 5 ── La clave del espectro cambia si cambian ganancia o puerta, que van horneadas en el resultado. */
console.log('\n── 5 · la clave del espectro incluye ganancia y puerta ──');
const sp = await ev(`(async()=>{ try{
  const r=await fetch('app.js'); const t=await r.text();
  const m=t.match(/const key='r'\\+Math\\.round\\(f0\\)\\+'-'\\+Math\\.round\\(f1\\)([^;]*);/);
  if(!m) return {err:'no encuentro la clave de specRangeRaw'};
  return {clave:m[0].slice(0,110), gain:/cfg\\.gain/.test(m[1]), gate:/cfg\\.gate/.test(m[1])};
}catch(e){ return {err:String(e&&e.message||e)}; } })()`);
if(sp.err) mal('no se pudo evaluar: '+sp.err);
else if(!sp.gain||!sp.gate) mal('la clave no incluye '+(!sp.gain?'ganancia':'')+(!sp.gain&&!sp.gate?' ni ':'')+(!sp.gate?'puerta':'')+': mover el fader no refresca los rangos a medida');
else bien('la clave lleva ganancia y puerta, que van horneadas en el resultado');

console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'la familia de caches queda cubierta por esta red'));
ws.close(); process.exit(fallos?1:0);
