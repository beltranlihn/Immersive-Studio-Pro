/* [R312] Verificación de los dos arreglos de seguridad de la ronda.
   A5 · un nombre con HTML dentro (medio, clip, pista, carpeta) NO se interpreta como marcado: se ve tal cual.
        El caso real: un archivo llamado con una etiqueta ejecutable ejecutaba su contenido dentro del renderer,
        que tiene el puente DSP delante (disco entero con los permisos de la aplicación).
   A8 · borrar VARIOS medios pregunta UNA vez, y una tecla no la responden todos los cuadros apilados.
   Uso:  npx electron . --remote-debugging-port=9222   y luego   node scratchpad/r312-verif.mjs
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

/* ── A5 ── La carga útil se planta como NOMBRE y se mira si el DOM la trató como marcado.
   `window.__xss` es el testigo: si el navegador ejecuta el onerror, se pone a true. */
console.log('\n── A5 · un nombre con HTML no se interpreta ──');
const a5 = await ev(`(async()=>{ try{
  window.__xss=false;
  const CARGA='<img src=x onerror="window.__xss=true">';
  await newProject('dome',1024,1024,30,180,true); if(typeof hideLanding==='function')hideLanding();
  _demoAddShape('rect','#777777',0,0,3,{az:0,el:45,size:40});
  const m=state.media[state.media.length-1]; m.name=CARGA;                       // nombre de MEDIO
  const c=state.clips[state.clips.length-1]; if(c)c.name=CARGA;                  // nombre de CLIP
  state.lanes[0].name=CARGA;                                                     // nombre de PISTA
  state.folders=[CARGA]; m.folder=CARGA;                                         // nombre de CARPETA
  renderMedia(); renderTimeline();
  await new Promise(r=>setTimeout(r,300));
  const imgs=document.querySelectorAll('#mediaList img[src="x"], #tracks img[src="x"]').length;
  // y el texto TIENE que seguir viéndose entero, no desaparecer
  const textoOk=(document.querySelector('#mediaList .mname')||{}).textContent||'';
  return { ejecutado:!!window.__xss, imgsInyectadas:imgs, texto:textoOk.slice(0,40) };
}catch(e){ return {err:String(e&&e.message||e)}; } })()`);
if(a5.err) mal('no se pudo evaluar: '+a5.err);
else{
  if(a5.ejecutado) mal('EL CODIGO SE EJECUTO — la inyeccion sigue viva');
  else bien('el onerror no se disparo');
  if(a5.imgsInyectadas) mal('se creo '+a5.imgsInyectadas+' etiqueta(s) <img> a partir del nombre');
  else bien('no se creo ninguna etiqueta a partir del nombre');
  if(a5.texto.indexOf('<img')<0) mal('el nombre no se ve como texto: "'+a5.texto+'"');
  else bien('el nombre se muestra literal: "'+a5.texto+'…"');
}

/* ── A8 ── Tres medios, dos de ellos usados en otra secuencia: antes salían varios cuadros. */
console.log('\n── A8 · borrar varios medios pregunta UNA vez ──');
const a8 = await ev(`(async()=>{ try{
  await newProject('dome',1024,1024,30,180,true); if(typeof hideLanding==='function')hideLanding();
  for(let i=0;i<3;i++)_demoAddShape('rect','#666666',0,i*2,2,{az:i*60,el:45,size:30});
  const ids=state.media.filter(m=>m.kind==='shape').map(m=>m.id);
  // una segunda secuencia que USA dos de esos medios, que es lo que dispara el aviso
  const nido={id:uid(),kind:'nest',name:'otra',w:1024,h:1024,fps:30,mode:'dome',cov:180,dur:6,
    nestClips:ids.slice(0,2).map((mid,i)=>({id:uid(),mediaId:mid,lane:0,start:i,dur:2,inP:0,props:{}})),
    nestLanes:[{id:uid(),name:'V1',tag:'V1',kind:'video'}]};
  state.media.push(nido);
  state.selMediaIds=ids.slice(); state.selMediaId=ids[0];
  deleteMediaMany(ids.slice());
  await new Promise(r=>setTimeout(r,320));
  const cuadros=document.querySelectorAll('.overlay').length;
  const texto=(document.querySelector('.overlay .modal')||{}).textContent||'';
  // se acepta el cuadro para comprobar que borra los tres de una vez
  const ok=document.querySelector('#cfOk'); if(ok)ok.click();
  await new Promise(r=>setTimeout(r,320));
  const quedan=state.media.filter(m=>m.kind==='shape').length;
  return { cuadros, texto:texto.slice(0,150), quedan };
}catch(e){ return {err:String(e&&e.message||e)}; } })()`);
if(a8.err) mal('no se pudo evaluar: '+a8.err);
else{
  console.log('   aviso: "'+a8.texto.replace(/\s+/g,' ').slice(0,120)+'…"');
  if(a8.cuadros!==1) mal('se abrieron '+a8.cuadros+' cuadros, se esperaba 1');
  else bien('un solo cuadro para los tres medios');
  if(a8.quedan) mal('tras aceptar quedan '+a8.quedan+' medios sin borrar');
  else bien('al aceptar se borraron los tres');
}

console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'los dos arreglos de R312 verificados sobre la aplicacion viva'));
ws.close(); process.exit(fallos?1:0);
