/* [R244] El contenedor de la línea de tiempo ya no queda bloqueado por la altura máxima de las pistas.
   Regla pedida por Beltrán: al llegar al límite de las pistas, el contenedor sigue creciendo y las pistas crecen
   con él; lo mismo al achicar. Con muchas pistas dentro (el contenido ya desborda) NO se toca nada: ahí subir y
   bajar el divisor nunca estuvo bloqueado, sólo enseña más o menos pistas.
   El arrastre se hace con PointerEvents REALES sobre `#tlResize`, no llamando a las funciones a mano. */
import http from 'http';
const PORT=process.argv[2]||9222;
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:PORT,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:60000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const out={};
await ev(`(function(){ window.__errs=[]; addEventListener('error',e=>__errs.push(String(e.message||e)));
  /* arrastre real del divisor: dy<0 agranda el panel (el borde superior sube) */
  window.__arrastraDivisor=function(dy){ const h=document.getElementById('tlResize'); const r=h.getBoundingClientRect();
    const x=r.left+r.width/2, y=r.top+r.height/2;
    h.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,clientX:x,clientY:y,button:0}));
    const pasos=8; for(let i=1;i<=pasos;i++){ window.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:x,clientY:y+dy*i/pasos})); }
    window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:x,clientY:y+dy}));
    return 1; };
  /* [R244b] OJO CON ESTA MEDIDA. La versión anterior comparaba "suma de alturas" contra clientHeight y daba
     "exacto" — pero es la comparación que NO puede detectar el fallo, porque es justo la igualdad que el propio
     reparto impone. La regla (#ruler, 24 px) vive DENTRO de #tlscroll, así que el hueco de pistas es
     clientHeight menos la regla; repartir el clientHeight entero desbordaba 24 px, y con scrollbar-width:none eso
     no se ve: recorta la última pista en silencio. La propiedad que hay que exigir es la del DOM:
     scrollHeight === clientHeight.
     (Y sin backticks en este comentario: está dentro de una plantilla y la cerrarían — trampa nº 5 del encargo.) */
  window.__foto=function(){ const el=document.querySelector('.timeline'), sc=document.getElementById('tlscroll');
    const rl=document.getElementById('ruler'); const regla=(rl&&rl.offsetHeight)||24;
    return { panel:Math.round(el.getBoundingClientRect().height), clientHeight:sc.clientHeight,
      hueco:sc.clientHeight-regla, regla,
      contenido:state.lanes.reduce((s,l,i)=>s+laneH(i),0), alturas:state.lanes.map((l,i)=>laneH(i)),
      scrollHeight:sc.scrollHeight, desbordaPx:sc.scrollHeight-sc.clientHeight,
      desborda:sc.scrollHeight>sc.clientHeight+1, topeViejo:Math.round(tlMaxH()), topeArrastre:Math.round(tlDragMaxH()) }; };
  return 1; })()`);

/* ---- CASO 0 · el bloqueo ORIGINAL, con el techo viejo de 120: las pistas topaban y el panel con ellas ---- */
await ev(`state.dirty=false;1`);
await ev(`(async()=>{ await newProject('flat',1920,1080,60,180,true); })()`); await wait(700);
out['0_elBloqueoQueSeReporto']=await ev(`(function(){
  state.lanes=state.lanes.slice(0,2); state.lanes.forEach(l=>{l.h=120;l.collapsed=false;}); // el MÁXIMO de antes
  renderTimeline(); const f=__foto();
  return { conElTechoViejo:{ contenido:f.contenido, topeQueTeniaElPanel:24+f.contenido+17 },
    ahoraElPanelPuedeLlegarA:f.topeArrastre,
    antesSeQuedabaEn:24+f.contenido+17 }; })()`);

/* ---- CASO 1 · pocas pistas que NO llenan el hueco: el panel crece y las pistas con él ---- */
out['1_pocasPistas']=await ev(`(function(){
  state.lanes=state.lanes.slice(0,2); state.lanes.forEach(l=>{l.h=LANE_DEF_H;l.collapsed=false;});
  renderTimeline();
  /* partir de un panel pequeño para que las pistas NO llenen el hueco */
  document.querySelector('.timeline').style.height='260px'; resize(); renderTimeline();
  const antes=__foto();
  __arrastraDivisor(-260);                                  // pedir 260 px MÁS de panel
  const despues=__foto();
  return { antes, despues,
    panelCrecio: despues.panel>antes.panel+100,
    pistasCrecieron: despues.contenido>antes.contenido+100,
    llenanElHueco: Math.abs(despues.contenido-despues.hueco)<=6,
    sinDesbordamiento: !despues.desborda,          // [R244b] LA prueba de verdad: nada recortado en silencio
    sinBandaVacia: !(despues.contenido < despues.hueco-6) }; })()`);
await wait(300);

/* ---- CASO 2 · y al ACHICAR, las pistas vuelven con él ---- */
out['2_alAchicar']=await ev(`(function(){ const antes=__foto();
  __arrastraDivisor(+200);                                   // devolver 200 px
  const despues=__foto();
  return { antes, despues, panelEncogio:despues.panel<antes.panel-100,
    pistasEncogieron:despues.contenido<antes.contenido-100,
    llenanElHueco:Math.abs(despues.contenido-despues.hueco)<=6,
    sinDesbordamiento:!despues.desborda }; })()`);
await wait(300);

/* ---- CASO 3 · MUCHAS pistas (el contenido ya desborda): no se toca nada, sólo scroll ---- */
out['3_muchasPistas']=await ev(`(function(){
  state.lanes=[]; for(let i=0;i<14;i++)state.lanes.push({id:uid(),name:'V'+(i+1),tag:'V'+(i+1),kind:'video',h:LANE_DEF_H});
  renderTimeline(); const antes=__foto();
  __arrastraDivisor(-160);
  const despues=__foto();
  return { antes, despues, desbordabaAntes:antes.desborda,
    alturasIntactas: JSON.stringify(antes.alturas)===JSON.stringify(despues.alturas),
    panelCrecio: despues.panel>antes.panel+60 }; })()`);
await wait(300);

/* ---- CASO 4 · el suelo se respeta al achicar a tope (no hay pistas de 3 px) ---- */
out['4_sueloAlAchicar']=await ev(`(function(){
  state.lanes=state.lanes.slice(0,2); state.lanes.forEach(l=>{l.h=LANE_DEF_H;l.collapsed=false;}); renderTimeline();
  __arrastraDivisor(+400);                                   // achicar todo lo posible
  const f=__foto(); const suelos=state.lanes.map(l=>laneFloorH(l));
  return { alturas:f.alturas, suelos, ningunaPorDebajoDelSuelo:f.alturas.every((h,i)=>h>=suelos[i]),
    panel:f.panel, minimoDelPanel:170 }; })()`);
await wait(300);

/* ---- CASO 5 · el techo: LANE_MAX_H ya no es 120 ---- */
out['5_techo']=await ev(`(function(){ return { LANE_MAX_H, LANE_MIN_H, eraCiento20:LANE_MAX_H===120 }; })()`);

/* ---- CASO 6 · Alt+rueda sigue funcionando y NO salta hacia abajo tras un llenado ---- */
out['6_altRuedaNoSalta']=await ev(`(function(){
  state.lanes=state.lanes.slice(0,2); state.lanes.forEach(l=>{l.h=300;l.collapsed=false;}); renderTimeline();
  const antes=state.lanes.map((l,i)=>laneH(i));
  wheelResizeLanes({deltaY:-100});   // OJO: recibe un EVENTO, no un número (deltaY<0 = agrandar)
  const despues=state.lanes.map((l,i)=>laneH(i));
  wheelResizeLanes({deltaY:+100});
  const trasEncoger=state.lanes.map((l,i)=>laneH(i));
  return { antes, trasAgrandar:despues, trasEncoger,
    noSaltaHaciaAbajoAlPedirCrecer: despues.every((h,i)=>h>=antes[i]),
    yEncogeCuandoSeLePide: trasEncoger.every((h,i)=>h<despues[i]) }; })()`);

/* ---- CASO 7 · [R244b] el suelo del panel: plegar pistas tras un arrastre no puede hundirlo bajo 170 ---- */
out['7_sueloDelPanel']=await ev(`(function(){
  state.lanes=state.lanes.slice(0,2); state.lanes.forEach(l=>{l.h=LANE_DEF_H;l.collapsed=false;}); renderTimeline();
  __arrastraDivisor(-120);                                   // deja _tlAltoManual en true
  state.lanes.forEach(l=>l.collapsed=true);                  // plegarlas hunde tlContentH a ~89
  renderTimeline(); const f=__foto();
  const railH=(document.getElementById('toolRail')||{offsetHeight:0}).offsetHeight;
  return { panel:f.panel, contenidoCrudo:24+f.contenido+17, railH,
    noBajaDe170:f.panel>=170, tapaElRail:f.panel>=railH }; })()`);

/* ---- CASO 8 · [R244b] markDirty NO se dispara en cada movimiento del arrastre ---- */
out['8_markDirtyUnaVez']=await ev(`(function(){
  state.lanes.forEach(l=>{l.collapsed=false;l.h=LANE_DEF_H;}); renderTimeline();
  let n=0; const orig=window.markDirty; window.markDirty=function(){ n++; return orig.apply(this,arguments); };
  state.dirty=false; __arrastraDivisor(-150);                // 8 pasos + pointerup
  window.markDirty=orig;
  return { llamadas:n, pasosDelArrastre:8, unaSolaVezOMenos:n<=1 }; })()`);

await ev(`(async()=>{ state.dirty=false; await newProject('dome',4096,4096,60,180,true); })()`);
out.errs=await ev(`window.__errs.slice(0,10)`);
console.log(JSON.stringify(out,null,1));
ws.close();
