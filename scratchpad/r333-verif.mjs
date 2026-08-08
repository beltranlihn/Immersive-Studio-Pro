/* [R333] Un evaluador para todos, una carga por LUT y una sola pregunta por la ventana de espectro.
     1 · El bloque de imagen (desenfoque, difuminado, recorte y color) se leia con `evalP` -la BASE, solo
         keyframes- mientras la geometria usaba `evalR`: esos parametros se quedaban fuera de los modificadores
         y de la pila de modulacion, y la linea de auditoria del inspector ensenaba el valor modulado que la
         pantalla no aplicaba. Se mide espiando el uniform que se sube de verdad.
     2 · `loadLUT`: dos llamadas para la misma ruta antes de que la primera termine parseaban las dos y
         creaban DOS texturas 3D; una se quedaba sin duenyo. Ahora comparten la carga (se cuentan las cargas
         que corren, no la identidad de las promesas: la funcion es `async` y devuelve su propia envoltura).
     3 · `parseCubeLUT` se saltaba `DOMAIN_MIN/MAX`: una LUT con dominio no estandar se aplicaba con las
         coordenadas equivocadas EN SILENCIO. Ahora se detecta (y quien la carga avisa). 3b es el control: una
         LUT normal no debe dar aviso.
     4 · `m.f0&&m.f1` en SEIS sitios, y 0 es falso: una ventana que empieza en 0 Hz -la del bombo- se caia a la
         banda con nombre, cada sitio por su cuenta.

   Uso:  npx electron . --remote-debugging-port=9222   y luego   node scratchpad/r333-verif.mjs
*/
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0; const p=new Map(); ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise(r=>{const i=++id;p.set(i,m=>r(m.result&&m.result.exceptionDetails?('EXC '+(m.result.exceptionDetails.exception?.description||'').slice(0,80)):(m.result&&m.result.result&&m.result.result.value)));ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true,timeout:60000}}));});

console.log('');
console.log('R333 - un evaluador para todos, una carga por LUT, una pregunta por la ventana');
console.log('');

console.log('1) una capa de modulacion sobre el desenfoque llega al uniform');
const r1 = await ev(`(async()=>{ try{
  await newProject('dome',2048,2048,30,180,true); if(typeof hideLanding==='function')hideLanding();
  const LV=state.lanes.findIndex(l=>l.kind!=='audio');
  _demoAddShape('rect','#888',LV,0,4,{x:0,y:0,scale:100});
  const c=state.clips[state.clips.length-1];
  c.props.blur=0; state.playhead=1;
  const espia=()=>{ const loc=LW.blur; const orig=WebGL2RenderingContext.prototype.uniform1f; let visto=null;
    gl.uniform1f=function(l,v){ if(l===loc)visto=v; return orig.call(gl,l,v); };
    try{ render(); } finally { delete gl.uniform1f; }
    return visto; };
  const sinMod=espia();
  // capa de modulacion CONSTANTE: un LFO congelado en su valor (frz) es la fuente mas predecible
  c.mod={blur:[{id:1,src:'lfo',blend:'add',depth:100,on:true,shape:'sine',rate:0.5,phase:0,frz:1}]};
  const conMod=espia();
  const base=evalP(c,'blur',1), conR=evalR(c,'blur',1);
  return JSON.stringify({sinMod, conMod, base, conR,
    laModulacionExiste: Math.abs(conR-base)>1e-6,
    llegaAlUniform: Math.abs(conMod-sinMod)>1e-9,
    cuadraConEvalR: Math.abs(conMod-(conR*0.0016))<1e-6});
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r1);

console.log('2) dos cargas simultaneas de la misma LUT comparten una sola');
const r2 = await ev(`(async()=>{ try{
  /* Se cuentan las CARGAS que corren de verdad, no la identidad de las promesas: loadLUT es async, asi que
     devuelve su propia envoltura y comparar punteros no dice nada. Lo que el arreglo evita es parsear y crear
     la textura 3D dos veces. (Novena vez: nada de acentos graves aqui dentro, cierran la plantilla.) */
  const ruta='C:/no/existe/prueba-r333.cube';
  const orig=_cargarLUT; let n=0;
  _cargarLUT=function(q){ n++; return orig(q); };
  try{
    const [a,b]=await Promise.all([loadLUT(ruta),loadLUT(ruta)]);
    const nSimultaneas=n;
    await loadLUT(ruta);            // ya no hay ninguna en vuelo: tiene que volver a cargar
    return JSON.stringify({cargasSimultaneas:nSimultaneas, cargasTotales:n, mismoResultado:a===b,
      unaSola:nSimultaneas===1, seLimpiaAlTerminar:n===2});
  } finally { _cargarLUT=orig; }
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r2);

console.log('3) una .cube con dominio no estandar se detecta');
const r3 = await ev(`(()=>{ try{
  const cuerpo=(cab)=>cab+String.fromCharCode(10)+'LUT_3D_SIZE 2'+String.fromCharCode(10)+
    ['0 0 0','1 0 0','0 1 0','1 1 0','0 0 1','1 0 1','0 1 1','1 1 1'].join(String.fromCharCode(10));
  const raro=parseCubeLUT(cuerpo('DOMAIN_MIN 0 0 0'+String.fromCharCode(10)+'DOMAIN_MAX 4 4 4'));
  const normal=parseCubeLUT(cuerpo('DOMAIN_MIN 0 0 0'+String.fromCharCode(10)+'DOMAIN_MAX 1 1 1'));
  const sinDominio=parseCubeLUT(cuerpo('TITLE prueba'));
  return JSON.stringify({raroDetectado:!!(raro&&raro.dominioRaro), dmax:raro?raro.dmax:null,
    normalLimpia:!!(normal&&!normal.dominioRaro), sinDominioLimpia:!!(sinDominio&&!sinDominio.dominioRaro),
    sigueParseando:!!(raro&&raro.size===2&&raro.data.length===2*2*2*4)});
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r3);

console.log('4) una ventana de espectro que empieza en 0 Hz cuenta como ventana');
const r4 = await ev(`(()=>{ try{
  const desde0=modVentana({f0:0,f1:200});
  const alReves=modVentana({f0:800,f1:120});
  const vacia=modVentana({f0:0,f1:0});
  const sinNada=modVentana({band:'bass'});
  const etiqueta=modLabel({src:'audio',f0:0,f1:200});
  const etiquetaBanda=modLabel({src:'audio',band:'treble'});
  return JSON.stringify({desde0, alReves, vacia, sinNada, etiqueta, etiquetaBanda,
    cuentaDesdeCero: !!(desde0&&desde0.lo===0&&desde0.hi===200),
    seOrdena: !!(alReves&&alReves.lo===120&&alReves.hi===800),
    laEtiquetaLaNombra: /0-200Hz/.test(etiqueta),
    labandaSigue: /treble/.test(etiquetaBanda)});
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r4);

const malas=[];
const J=s=>{ try{ return JSON.parse(s); }catch(e){ return {err:String(s).slice(0,90)}; } };
const o1=J(r1),o2=J(r2),o3=J(r3),o4=J(r4);
for(const [n,o] of [['1',o1],['2',o2],['3',o3],['4',o4]]) if(o.err) malas.push('sonda '+n+' rota: '+o.err);
if(!o1.err){ if(!o1.laModulacionExiste) malas.push('la capa de modulacion no cambia evalR: la sonda no mide nada');
  if(!o1.llegaAlUniform) malas.push('la modulacion del desenfoque no llega al uniform: se sigue subiendo la base');
  if(!o1.cuadraConEvalR) malas.push('el uniform no cuadra con evalR'); }
if(!o2.err){ if(!o2.unaSola||!o2.mismoResultado) malas.push('dos cargas simultaneas de la misma LUT siguen corriendo dos veces ('+o2.cargasSimultaneas+')');
  if(!o2.seLimpiaAlTerminar) malas.push('la promesa en vuelo no se limpia: la LUT no se podria recargar nunca'); }
if(!o3.err){ if(!o3.raroDetectado) malas.push('un dominio no estandar sigue pasando en silencio');
  if(!o3.normalLimpia||!o3.sinDominioLimpia) malas.push('una LUT normal da aviso: falso positivo');
  if(!o3.sigueParseando) malas.push('la tabla ya no se parsea: regresion'); }
if(!o4.err){ if(!o4.cuentaDesdeCero) malas.push('una ventana desde 0 Hz sigue cayendo a la banda con nombre');
  if(!o4.seOrdena) malas.push('la ventana no se ordena');
  if(o4.vacia!==null||o4.sinNada!==null) malas.push('modVentana inventa ventanas donde no las hay');
  if(!o4.laEtiquetaLaNombra||!o4.labandaSigue) malas.push('la linea de auditoria no nombra la fuente real'); }
console.log('');
for(const m of malas) console.log('   *** '+m);
console.log(malas.length ? ('*** '+malas.length+' FALLOS') : 'un evaluador para todos, una carga por LUT y una ventana con nombre');
ws.close(); process.exit(malas.length?1:0);
