/* [R245] Menú contextual del panel de Medios en vista de CUADRÍCULA.
   Reportado por Beltran: en LISTA el clic-derecho sobre un clip da sus opciones; en CUADRÍCULA salía el menú del
   PANEL (Importar medios / Nueva carpeta). Causa: el guard del menú del panel no excluía `.mtile`, así que su
   menú reemplazaba al del tile por burbujeo.
   Se comprueba el menú REAL que queda en pantalla tras un contextmenu real sobre cada superficie. */
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
  /* clic-derecho REAL sobre un elemento y lectura del menú que queda en pantalla */
  window.__ctx=function(sel){ document.querySelectorAll('.menu,.ctxmenu').forEach(x=>x.remove());
    const el=document.querySelector(sel); if(!el)return {err:'no existe '+sel};
    const r=el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2}));
    /* OJO: las entradas de openMenu son <button role="menuitem">, no divs con clase. Leerlas mal daba texto
       vacío y un veredicto falso — el menú SÍ estaba (nMenus:1) pero la sonda no sabía mirarlo. */
    const menus=[...document.querySelectorAll('.menu')];
    const plano=menus.map(mn=>[...mn.querySelectorAll('button')].map(x=>(x.textContent||'').trim()).filter(Boolean).join(' | ')).join(' // ');
    menus.forEach(x=>x.remove());
    return { nMenus:menus.length, plano:plano.slice(0,300) }; };
  return 1; })()`);

/* proyecto con UN medio generable (forma), sin depender de archivos del disco */
await ev(`state.dirty=false;1`);
await ev(`(async()=>{ await newProject('flat',1920,1080,60,180,true); })()`); await wait(600);
await ev(`(function(){ createShapeClip('rect'); renderMedia(); return 1; })()`); await wait(300);

/* --- LISTA (el que YA funcionaba: sirve de referencia de qué debe salir) --- */
out.lista=await ev(`(function(){ state.mediaView='list'; renderMedia(); const r=__ctx('#mediaList .mitem');
  return { ...r, tieneOpcionesDelClip:/composition|composici|timeline|l.nea de tiempo|Rename|Renombrar|Delete media|Eliminar medio/i.test(r.plano),
    esElMenuDelPanel:/Import media|Importar medios|New folder|Nueva carpeta/i.test(r.plano) }; })()`);

/* --- CUADRÍCULA (el que fallaba) --- */
out.cuadricula=await ev(`(function(){ state.mediaView='grid'; renderMedia(); const r=__ctx('#mediaList .mtile');
  return { ...r, tieneOpcionesDelClip:/composition|composici|timeline|l.nea de tiempo|Rename|Renombrar|Delete media|Eliminar medio/i.test(r.plano),
    esElMenuDelPanel:/Import media|Importar medios|New folder|Nueva carpeta/i.test(r.plano) }; })()`);

/* --- el fondo del panel DEBE seguir dando el menú de importar --- */
out.fondoDelPanel=await ev(`(function(){ state.mediaView='grid'; renderMedia(); const r=__ctx('#mediaList .mediagrid');
  return { ...r, esElMenuDelPanel:/Import media|Importar medios|New folder|Nueva carpeta/i.test(r.plano) }; })()`);

/* --- y una CARPETA en cuadrícula conserva el suyo --- */
out.carpetaEnCuadricula=await ev(`(function(){ newFolderIn(null); state.mediaView='grid'; renderMedia();
  const r=__ctx('#mediaList .foldertile');
  return { ...r, esElMenuDeCarpeta:/Open folder|Abrir carpeta|subfolder|subcarpeta|Delete folder|Eliminar carpeta/i.test(r.plano) }; })()`);

out.veredicto=await ev(`(function(){ return 1; })()`).then(()=>({
  cuadriculaArreglada: out.cuadricula.tieneOpcionesDelClip && !out.cuadricula.esElMenuDelPanel,
  listaSinRegresion: out.lista.tieneOpcionesDelClip && !out.lista.esElMenuDelPanel,
  fondoIntacto: out.fondoDelPanel.esElMenuDelPanel,
  carpetaIntacta: out.carpetaEnCuadricula.esElMenuDeCarpeta }));

/* ===== [R245·2] Arrastrar varias imágenes NO puede asumir secuencia PNG =====================================
   Reportado por Beltrán: al arrastrar varias imágenes salía el diálogo de fotogramas por segundo y no dejaba
   cargarlas hasta configurarlo. La detección debe quedar SÓLO en el selector de archivos. Se construyen Files
   reales con nombre numerado (frame001.png…), que es lo que disparaba el agrupador. */
await ev(`(async()=>{ state.dirty=false; await newProject('flat',1920,1080,60,180,true); })()`); await wait(500);
/* OJO: `importFiles` DEDUPLICA por nombre+tamaño, así que las dos pruebas necesitan prefijos DISTINTOS. Con el
   mismo nombre, la segunda tanda se descarta entera y el diálogo no sale — un falso "arreglado" (me pasó). */
await ev(`window.__pngs=function(n,pref){ const out=[];
  const cv=document.createElement('canvas'); cv.width=cv.height=8; const cx=cv.getContext('2d');
  for(let i=1;i<=n;i++){ cx.fillStyle='rgb('+(i*30%255)+',80,120)'; cx.fillRect(0,0,8,8);
    const b=atob(cv.toDataURL('image/png').split(',')[1]); const u=new Uint8Array(b.length);
    for(let k=0;k<b.length;k++)u[k]=b.charCodeAt(k);
    out.push(new File([u],(pref||'frame')+String(i).padStart(3,'0')+'.png',{type:'image/png'})); }
  return out; };1`);

out['R245_2_arrastre']=await ev(`(async function(){
  const n0=state.media.length; const files=__pngs(4,'arrastre');
  const dt=new DataTransfer(); files.forEach(f=>dt.items.add(f));
  document.getElementById('mediaList').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));
  await new Promise(r=>setTimeout(r,900));
  const dlg=!!document.getElementById('seqFpsOv');
  const nuevos=state.media.slice(n0);
  const r={ pidioFps:dlg, mediosNuevos:nuevos.length, tipos:nuevos.map(m=>m.kind),
    todosImagen:nuevos.length>0&&nuevos.every(m=>m.kind==='image') };
  if(dlg)document.getElementById('seqFpsOv').remove();
  return r; })()`);

/* y el SELECTOR de archivos conserva la detección (es donde el gesto es deliberado) */
out['R245_2_selectorConserva']=await ev(`(async function(){
  const n0=state.media.length; const files=__pngs(4,'selector');   // prefijo distinto: si no, el dedup los tira
  importFiles(files,null);                       // el camino de #fileInput, sin opts
  await new Promise(r=>setTimeout(r,700));
  const dlg=!!document.getElementById('seqFpsOv');
  const r={ pidioFps:dlg, seSaltoPorDedup:(state.media.length===n0&&!dlg) };
  if(dlg)document.getElementById('seqFpsOv').remove();
  return r; })()`);

/* ===== [R245b] MODELO PREMIERE: la secuencia se ELIGE antes de abrir el selector ==========================
   «Importar medios…» nunca agrupa · «Importar secuencia de imágenes…» sí. Y el diálogo tiene una TERCERA salida
   («Como imágenes sueltas») para cuando las numeradas no son una secuencia — el caso que obligó a Beltrán a
   importarlas de una en una. */
out['R245b_dosPuertas']=await ev(`(function(){
  return { pickMedia:(typeof pickMedia), importBtnUsaPick:/pickMedia\\(false\\)/.test(String(document.getElementById('importBtn').onclick)) }; })()`);

out['R245b_importarMedios_noAgrupa']=await ev(`(async function(){
  const n0=state.media.length; const files=__pngs(4,'medios');
  importFiles(files,null,{noSeq:true});          // lo que hace ahora «Importar medios…»
  await new Promise(r=>setTimeout(r,800));
  const dlg=!!document.getElementById('seqFpsOv'); const nuevos=state.media.slice(n0);
  if(dlg)document.getElementById('seqFpsOv').remove();
  return { pidioFps:dlg, nuevos:nuevos.length, todosImagen:nuevos.length===4&&nuevos.every(m=>m.kind==='image') }; })()`);

out['R245b_terceraSalida']=await ev(`(async function(){
  const n0=state.media.length; const files=__pngs(4,'sueltas');
  importFiles(files,null,{noSeq:false});         // «Importar secuencia…» → sale el diálogo
  await new Promise(r=>setTimeout(r,700));
  const ov=document.getElementById('seqFpsOv'); if(!ov)return {err:'no salió el diálogo'};
  const btn=document.getElementById('sfLoose'); if(!btn)return {err:'no existe el botón de imágenes sueltas'};
  btn.click(); await new Promise(r=>setTimeout(r,900));
  const nuevos=state.media.slice(n0);
  return { hayBoton:true, nuevos:nuevos.length, tipos:nuevos.map(m=>m.kind),
    entraronComoImagenes:nuevos.length===4&&nuevos.every(m=>m.kind==='image') }; })()`);

out['R245b_secuenciaSigueFuncionando']=await ev(`(async function(){
  const n0=state.media.length; const files=__pngs(5,'lasecuencia');
  importFiles(files,null,{noSeq:false});
  await new Promise(r=>setTimeout(r,700));
  const ov=document.getElementById('seqFpsOv'); if(!ov)return {err:'no salió el diálogo'};
  document.getElementById('sfOk').click(); await new Promise(r=>setTimeout(r,1200));
  const nuevos=state.media.slice(n0);
  return { nuevos:nuevos.length, tipos:nuevos.map(m=>m.kind),
    esUnaSecuencia:nuevos.length===1&&nuevos[0].kind==='sequence', fps:nuevos[0]&&nuevos[0].fps }; })()`);

await ev(`(async()=>{ state.dirty=false; await newProject('dome',4096,4096,60,180,true); })()`);
out.errs=await ev(`window.__errs.slice(0,10)`);
console.log(JSON.stringify(out,null,1));
ws.close();
