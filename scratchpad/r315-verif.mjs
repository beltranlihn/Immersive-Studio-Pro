/* [R315] Verificación de lo que quedaba del repaso de código.
     1 · los sumideros de `innerHTML` que faltaban ya no interpretan un nombre de usuario
         (fantasma de arrastre de clip, fantasma desde el panel, chip de grupo, preajustes de sala) y
         `appPrompt` —el tercer diálogo— tampoco
     2 · borrar un lote con una secuencia dentro ya no deja el resto sin deshacer
   Uso:  npx electron . --remote-debugging-port=9222   y luego   node scratchpad/r315-verif.mjs
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

console.log('\n── 1 · los sumideros que faltaban ──');
const s1 = await ev(`(async()=>{ try{
  window.__x=0; const CARGA='<img src=x onerror="window.__x++">';
  await newProject('flat',1920,1080,30,180,true); if(typeof hideLanding==='function')hideLanding();
  _demoAddShape('rect','#888888',0,0,4,{x:0,y:0,scale:100});
  const m=state.media[state.media.length-1], c=state.clips[state.clips.length-1];
  m.name=CARGA; c.name=CARGA;
  const r={};
  // fantasma de arrastre de CLIP (ghostFor) y desde el PANEL: se invocan por su camino real si existen
  try{ if(typeof ghostFor==='function'){ ghostFor(c,c.start,c.lane,false); } }catch(e){ r.gh=String(e&&e.message||e); }
  // chip de grupo
  try{ state.groups=[{id:1,name:CARGA,spin:0,el:45,size:40}]; c.groupId=1; renderInspector(); }catch(e){ r.grp=String(e&&e.message||e); }
  // el tercer dialogo
  try{ appPrompt(CARGA,'',()=>{}); }catch(e){ r.pr=String(e&&e.message||e); }
  await new Promise(z=>setTimeout(z,250));
  const inyectadas=document.querySelectorAll('img[src="x"]').length;
  const literalEnPrompt=(document.querySelector('#promptOv .modal')||{}).textContent||'';
  document.querySelectorAll('.overlay').forEach(o=>o.remove());
  document.querySelectorAll('.tlghost,.ghost').forEach(o=>o.remove());
  return Object.assign(r,{ejecutado:window.__x, inyectadas, promptLiteral:literalEnPrompt.indexOf('<img')>=0});
}catch(e){ return {err:String(e&&e.message||e)}; } })()`);
if(s1.err) mal('no se pudo evaluar: '+s1.err);
else{
  if(s1.ejecutado) mal('la carga se EJECUTO '+s1.ejecutado+' vez/veces');
  else bien('el onerror no se disparo en ninguno de los sumideros');
  if(s1.inyectadas) mal('se crearon '+s1.inyectadas+' etiquetas <img> a partir de los nombres');
  else bien('no nacio ninguna etiqueta a partir de los nombres');
  if(!s1.promptLiteral) mal('appPrompt no muestra el texto literal (se ha perdido o se interpreto)');
  else bien('appPrompt muestra el mensaje literal');
}

console.log('\n── 2 · borrar un lote con una secuencia no deja al resto sin deshacer ──');
const s2 = await ev(`(async()=>{ try{
  await newProject('flat',1920,1080,30,180,true); if(typeof hideLanding==='function')hideLanding();
  for(let i=0;i<3;i++)_demoAddShape('rect','#666666',0,i*2,2,{x:0,y:0,scale:50});
  // una segunda secuencia, para que el guardian de "al menos una" no bloquee su borrado
  const extra={id:uid(),kind:'nest',name:'extra',w:1920,h:1080,fps:30,mode:'flat',cov:180,dur:6,
    nestClips:[],nestLanes:[{id:uid(),name:'V1',tag:'V1',kind:'video'}]};
  state.media.push(extra);
  const ids=state.media.filter(m=>m.kind==='shape').map(m=>m.id).concat([extra.id]);  // la secuencia, LA ULTIMA de la seleccion
  const antes=state.media.filter(m=>m.kind==='shape').length;
  deleteMediaMany(ids);
  await new Promise(r=>setTimeout(r,200));
  const ok=document.querySelector('#cfOk'); if(ok)ok.click();
  await new Promise(r=>setTimeout(r,300));
  const tras=state.media.filter(m=>m.kind==='shape').length;
  undo();                                        // un solo Ctrl+Z
  await new Promise(r=>setTimeout(r,150));
  return {antes,tras,recuperados:state.media.filter(m=>m.kind==='shape').length};
}catch(e){ return {err:String(e&&e.message||e)}; } })()`);
if(s2.err) mal('no se pudo evaluar: '+s2.err);
else{
  console.log('   medios: '+s2.antes+' → '+s2.tras+' tras borrar → '+s2.recuperados+' tras un Ctrl+Z');
  if(s2.tras!==0) mal('el lote no borro todo ('+s2.tras+' quedan)');
  else if(!s2.recuperados) mal('Ctrl+Z no recupero NADA: el clearAllUndo de la secuencia se llevo el historial');
  else bien('Ctrl+Z recupera lo borrado pese a haber una secuencia en el lote');
}

console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'lo que quedaba del repaso queda cerrado'));
ws.close(); process.exit(fallos?1:0);
