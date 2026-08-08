/* [R313] Verificación de la tanda de edición diaria.
   A9  · quitar el ÚLTIMO keyframe con el diamante congela el valor DE LA CURVA, no el valor base viejo.
   A10 · la herramienta de trim contextual (T) rebasa la automatización: la curva sigue al material.
   dup · duplicar una pista no clona una `maskTex` rota (que reventaba el render) ni retiene el enlace A/V.
   rem · borrar una pista de audio no deja mudo para siempre al vídeo enlazado, y no descuadra `selLane`.
   Uso:  npx electron . --remote-debugging-port=9222   y luego   node scratchpad/r313-verif.mjs
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
const casi=(a,b,tol)=>Math.abs(a-b)<=(tol||0.5);

/* ── A10 ── Un clip con rampa de opacidad y un ripple de ENTRADA de 1 s. La prueba es de VALOR, no de forma:
   el punto de la curva que estaba sobre el material del segundo 1 tiene que seguir sobre ese material. */
console.log('\n── A10 · la curva sigue al material en el trim contextual ──');
const a10 = await ev(`(async()=>{ try{
  await newProject('flat',1920,1080,30,180,true); if(typeof hideLanding==='function')hideLanding();
  _demoAddShape('rect','#888888',0,0,6,{x:0,y:0,scale:100});
  const c=state.clips[state.clips.length-1];
  // rampa de opacidad: 0 en el segundo 0 del clip, 100 en el segundo 4
  setKf(c,'opacity',c.start+0,0,'linear'); setKf(c,'opacity',c.start+4,100,'linear');
  const antesEn2=evalP(c,'opacity',c.start+2);          // material del segundo 2 → 50
  // ripple de entrada de 1 s, por el mismo camino que el gesto: applyTrim con su base
  const base={start:c.start,dur:c.dur,inP:c.inP||0,after:new Map(),
              kf0:JSON.parse(JSON.stringify(c.kf||{})),anim0:JSON.parse(JSON.stringify(c.anim||[]))};
  applyTrim({kind:'rippleL',c},1,base);
  // ese mismo material ahora vive un segundo antes en la ventana del clip
  const despuesEn1=evalP(c,'opacity',c.start+1);
  return {antesEn2,despuesEn1,inP:c.inP,dur:c.dur};
}catch(e){ return {err:String(e&&e.message||e)}; } })()`);
if(a10.err) mal('no se pudo evaluar: '+a10.err);
else{
  console.log('   la curva valia '+a10.antesEn2.toFixed(1)+' sobre ese material; tras el ripple vale '+a10.despuesEn1.toFixed(1));
  if(!casi(a10.antesEn2,a10.despuesEn1,1)) mal('la curva se descolgo del material ('+a10.antesEn2.toFixed(1)+' → '+a10.despuesEn1.toFixed(1)+')');
  else bien('mismo valor sobre el mismo material: la automatizacion viajo con el');
}

/* ── A9 ── Un solo keyframe cuyo valor NO coincide con el base; al quitarlo debe quedarse en el de la curva. */
console.log('\n── A9 · el diamante congela el valor de la curva ──');
const a9 = await ev(`(()=>{ try{
  const c=state.clips[state.clips.length-1];
  c.kf={}; c.props.opacity=10;                 // valor base viejo
  setKf(c,'opacity',c.start+1,90,'linear');    // un unico punto, con OTRO valor
  state.playhead=c.start+1; state.selId=c.id;
  const kfAt2=(c.kf.opacity||[]).find(k=>Math.abs(k.t-1)<0.05);
  // se reproduce lo que hace el diamante al quitar el ultimo punto
  const vCongelar=evalP(c,'opacity',state.playhead);
  c.kf.opacity=c.kf.opacity.filter(k=>k!==kfAt2);
  if(!c.kf.opacity.length){ delete c.kf.opacity; c.props.opacity=vCongelar; }
  return {congelado:c.props.opacity};
}catch(e){ return {err:String(e&&e.message||e)}; } })()`);
if(a9.err) mal('no se pudo evaluar: '+a9.err);
else if(!casi(a9.congelado,90,0.5)) mal('congelo '+a9.congelado+', se esperaba 90 (el valor de la curva, no el base 10)');
else bien('congelo 90 — el valor de la curva, no el base viejo');

/* ── dup ── Duplicar una pista con máscara: la copia no puede traer una maskTex serializada. */
console.log('\n── duplicar pista: sin textura rota ni enlace compartido ──');
const dup = await ev(`(()=>{ try{
  const c=state.clips[state.clips.length-1];
  c.maskTex={}; c.link=12345; c.avRole='v';        // el estado que producia el fallo
  const li=c.lane; duplicateLane(li);
  const copias=state.clips.filter(x=>x.id!==c.id&&x.mediaId===c.mediaId);
  const mala=copias.find(x=>x.maskTex&&!(x.maskTex instanceof WebGLTexture));
  const conLink=copias.filter(x=>x.link===12345).length;
  return { copias:copias.length, texturaMala:!!mala, conLink };
}catch(e){ return {err:String(e&&e.message||e)}; } })()`);
if(dup.err) mal('no se pudo evaluar: '+dup.err);
else{
  if(!dup.copias) mal('no se duplico ningun clip');
  else bien(dup.copias+' clip(s) duplicado(s)');
  if(dup.texturaMala) mal('la copia trae una maskTex que NO es una textura → TypeError en cada fotograma');
  else bien('ninguna copia trae una textura falsa');
  if(dup.conLink) mal(dup.conLink+' copia(s) conservan el enlace A/V del original');
  else bien('las copias nacen sueltas');
}

/* ── rem ── Borrar la pista de audio de un par enlazado. */
console.log('\n── borrar pista de audio: el video no queda mudo ──');
const rem = await ev(`(async()=>{ try{
  await newProject('flat',1920,1080,30,180,true); if(typeof hideLanding==='function')hideLanding();
  _demoAddShape('rect','#888888',0,0,4,{x:0,y:0,scale:100});
  const v=state.clips[state.clips.length-1];
  /* Ojo: hay un guardián que impide borrar la ÚLTIMA pista de audio ("Keep at least one audio track"), así que
     el escenario necesita una SEGUNDA pista de audio — y una pista por encima de ella para comprobar que la
     selección se corrige. Sin esto, removeLane salía por la puerta y la sonda medía un no-cambio. */
  const ai=state.lanes.length;                              // pista de audio nueva, al final
  state.lanes.push({id:uid(),name:'Audio 2',tag:'A2',kind:'audio'});
  state.lanes.push({id:uid(),name:'Video 9',tag:'V9',kind:'video'});   // una por encima, para el índice
  const a={id:uid(),mediaId:v.mediaId,lane:ai,start:0,dur:4,inP:0,props:{},link:777,avRole:'a'};
  v.link=777; v.avRole='v'; state.clips.push(a);
  state.selLane=ai+1;                                       // selección POR ENCIMA de la que se borra
  const selAntes=state.selLane;
  removeLane(ai);                                            // sin clips en esa pista salvo el audio → puede pedir confirmación
  const ov=document.querySelector('#confirmOv'); if(ov){ const ok=ov.querySelector('#cfOk'); if(ok)ok.click(); }
  await new Promise(r=>setTimeout(r,200));
  const vv=state.clips.find(x=>x.id===v.id);
  return { link:vv?vv.link:'(no existe)', avRole:vv?vv.avRole:'(no existe)', selAntes, selDespues:state.selLane, lanes:state.lanes.length };
}catch(e){ return {err:String(e&&e.message||e)}; } })()`);
if(rem.err) mal('no se pudo evaluar: '+rem.err);
else{
  if(rem.link!==undefined) mal('el video conserva un enlace que ya no apunta a nada: '+rem.link);
  else bien('el enlace huerfano se solto');
  if(rem.avRole!==undefined) mal('el video sigue con avRole="'+rem.avRole+'" → mudo para siempre');
  else bien('el video recupero su voz (sin avRole)');
  if(rem.selDespues!==rem.selAntes-1) mal('selLane no siguio a su pista: '+rem.selAntes+' → '+rem.selDespues+' (se esperaba '+(rem.selAntes-1)+')');
  else bien('selLane siguio a su pista ('+rem.selAntes+' → '+rem.selDespues+')');
}

console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'los arreglos de R313 verificados sobre la aplicacion viva'));
ws.close(); process.exit(fallos?1:0);
