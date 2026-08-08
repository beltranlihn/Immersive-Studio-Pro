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
     5 · `_specRaw` — la ganancia y la puerta van horneadas en el resultado. R318 las metió en la CLAVE, lo que
         reintegraba el espectro entero en cada píxel del fader; R320 cachea la media cruda de los bins —que no
         depende de ninguno de los dos mandos— y aplica puerta y ganancia en una pasada aparte.

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

/* Y la comprobación ESTRUCTURAL de la misma pareja: las dos cachés se limpian SIEMPRE juntas. El arreglo de
   R318 se hizo con un reemplazo masivo de cadenas y uno de los seis sitios era un `if` SIN LLAVES, así que la
   segunda sentencia quedó fuera del `if` y vaciaba la caché en cada fotograma. Contar aquí las dos ocurrencias
   no basta —salían iguales— así que lo que se comprueba es que ningún `if` de una línea las separe. */
console.log('\n── las dos caches hermanas se limpian juntas y dentro del mismo bloque ──');
const par = await ev(`(async()=>{ try{
  const bruto=await (await fetch('app.js')).text();
  const t=bruto.replace(/\\/\\*[\\s\\S]*?\\*\\//g,' ').replace(/\\/\\/[^\\n]*/g,' ');
  const fx=(t.match(/_fxEnvCache\\.clear\\(\\)/g)||[]).length;
  const mo=(t.match(/_modAudioCache\\.clear\\(\\)/g)||[]).length;
  /* un \`if(...)\` sin llaves seguido de las dos: la segunda queda SIEMPRE fuera del if */
  const suelto=(t.match(/if\\([^)\\n]*\\)\\s*_fxEnvCache\\.clear\\(\\);\\s*_modAudioCache\\.clear\\(\\)/g)||[]).length;
  return {fx,mo,suelto};
}catch(e){ return {err:String(e&&e.message||e)}; } })()`);
if(par.err) mal('no se pudo leer el fuente: '+par.err);
else{
  console.log('   _fxEnvCache.clear() x'+par.fx+'   _modAudioCache.clear() x'+par.mo);
  if(par.fx!==par.mo) mal('las dos no van siempre juntas ('+par.fx+' vs '+par.mo+'): queda un punto de invalidacion a medias');
  else if(par.suelto) mal(par.suelto+' sitio(s) con un `if` sin llaves delante: la segunda clear() se ejecuta SIEMPRE');
  else bien('las '+par.fx+' parejas van juntas, ninguna colgando de un `if` sin llaves');
}

/* ── 5 ── El espectro por rango de frecuencia. La ganancia y la puerta van HORNEADAS en el resultado, así que
   el resultado no puede cachearse ignorándolas. R318 lo arregló metiéndolas en la CLAVE, y el remedio salió
   peor que la enfermedad: el fader de Gain recorre 0..300 de uno en uno, así que cada píxel del arrastre era
   una clave nueva — una integración completa del espectro (frames × bins) y su propio búfer reservado.
   R320 cachea lo que NO depende de esos dos mandos (la media cruda de los bins, UNA entrada por rango) y
   aplica puerta y ganancia después, en una pasada lineal. Las dos mitades se comprueban por separado:
     a) mover ganancia o puerta CAMBIA lo que devuelve — la corrección;
     b) treinta valores distintos dejan UNA sola entrada — el coste.
   Se monta un espectro sintético porque analizar audio de verdad tarda y no aporta nada a lo que se mide. */
console.log('\n── 5 · el espectro por rango responde a ganancia y puerta sin recomputarse ──');
const sp = await ev(`(async()=>{ try{
  await newProject('flat',1920,1080,30,180,true); if(typeof hideLanding==='function')hideLanding();
  const frames=64, bins=SPEC_BINS, data=new Float32Array(frames*bins);
  for(let f=0;f<frames;f++){ const v=0.1+0.3*(f/frames); for(let b=0;b<bins;b++)data[f*bins+b]=v; }
  const m={id:990001,kind:'audio',name:'sintetico',dur:frames/90,spec:{frames,bins,data}};
  state.media.push(m); _arCache={clip:{mediaId:m.id},raw:null,fps:90};
  const cfg=ensureReactive();
  const leer=()=>Array.from(specRangeRaw(100,8000).slice(30,33)).map(x=>Math.round(x*1000)/1000);
  cfg.gain=100; cfg.gate=0;  const base=leer();
  cfg.gain=200;              const masGanancia=leer();
  cfg.gain=100; cfg.gate=20; const conPuerta=leer();
  cfg.gate=0;
  for(let gn=100;gn<130;gn++){ cfg.gain=gn; specRangeRaw(100,8000); }   // un arrastre del fader, pixel a pixel
  const entradas=Object.keys(m._specRaw||{}).length;
  _arCache=null; state.media=state.media.filter(x=>x.id!==990001);
  return {base,masGanancia,conPuerta,entradas};
}catch(e){ return {err:String(e&&e.message||e)}; } })()`);
if(sp.err) mal('no se pudo evaluar: '+sp.err);
else{
  const j=a=>'['+a.join(', ')+']';
  console.log('   ganancia 100 '+j(sp.base)+'  →  ganancia 200 '+j(sp.masGanancia)+'  →  con puerta '+j(sp.conPuerta));
  if(j(sp.base)===j(sp.masGanancia)) mal('subir la ganancia no cambio nada: el rango a medida se queda con el valor viejo');
  else if(j(sp.base)===j(sp.conPuerta)) mal('subir la puerta no cambio nada: mismo fallo por el otro mando');
  else bien('ganancia y puerta se reflejan en el resultado');
  console.log('   entradas en cache tras un arrastre de 30 valores: '+sp.entradas);
  if(sp.entradas>1) mal('el arrastre dejo '+sp.entradas+' entradas: cada pixel reintegra el espectro entero y reserva su propio bufer');
  else bien('una sola entrada por rango: el arrastre no reintegra el espectro');
}

console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'la familia de caches queda cubierta por esta red'));
ws.close(); process.exit(fallos?1:0);
