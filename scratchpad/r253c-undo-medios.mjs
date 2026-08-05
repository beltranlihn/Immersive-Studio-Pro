/* [R253c] Deshacer para los cambios de MEDIO y de CARPETA. Cada accion se prueba con el mismo patron:
   1) una edicion REAL previa (mover un clip), 2) la accion sobre el medio/carpeta, 3) Ctrl+Z -> debe revertir SOLO
   la accion, 4) Ctrl+Z -> ahora si deshace la edicion previa. Ese cuarto paso es el que cazaba el fallo: antes, el
   primer Ctrl+Z se comia la edicion anterior porque el snapshot salia identico. */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:60000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let fallos=0; const ok=(t,c,d)=>{ if(!c)fallos++; console.log('   '+(c?'OK  ':'*** FALLA *** ')+t+(d?' - '+d:'')); };

await cmd('Page.enable'); await cmd('Page.reload',{ignoreCache:true}); await wait(3800);
await ev(`(function(){ window.__errs=[]; addEventListener('error',e=>__errs.push(String(e.message||e))); return 1; })()`);
await ev(`(async()=>{ await newProject('dome',2048,2048,60,180,true); if(typeof hideLanding==='function')hideLanding(); })()`); await wait(1100);

/* medios de prueba + un clip para tener una "edicion previa" que proteger */
await ev(`window.__preparar=function(){
  state.media=state.media.filter(m=>m.kind==='nest'); state.folders=[]; state.folderColors={}; state.clips=[];
  for(let i=0;i<3;i++){ const cv=document.createElement('canvas'); cv.width=cv.height=64; cv.getContext('2d').fillRect(0,0,64,64);
    const m={id:uid(),kind:'video',name:'m'+(i+1),el:cv,originalEl:cv,tex:newTex(),w:1920,h:1080,dur:40,fps:30,color:'#888',folder:null,missing:false,_loading:false};
    try{m.thumb=cv.toDataURL();}catch(e){} state.media.push(m); }
  const ms=state.media.filter(m=>m.kind==='video');
  const c=makeClip(ms[0],state.lanes.findIndex(l=>l.kind==='video'),0); c.dur=10; state.clips.push(c);
  renderMedia(); renderTimeline();
  return { clipId:c.id, ids:ms.map(m=>m.id) }; };1`);

/* `prepararJS` deja el escenario montado ANTES de tomar la referencia: en los casos de carpeta, crear la carpeta
   y meterle un medio es preparacion, no la accion que se deshace. Tomar la referencia antes de eso hacia que la
   sonda esperase un estado que nunca existio en el momento del pushUndo -fallo de la medida, no del programa-. */
async function caso(nombre, prepararJS, accionJS, comprobarJS){
  const r=await ev(`(function(){ const pre=__preparar(); const c=clipById(pre.clipId);
    (${prepararJS})(pre);                        // escenario
    pushUndo(); c.start=6;                       // edicion REAL previa, la que hay que proteger
    const antes=(${comprobarJS})(pre);           // la referencia: el estado JUSTO ANTES de la accion
    (${accionJS})(pre);
    const trasAccion=(${comprobarJS})(pre);
    undo();
    const trasUndo1={ v:(${comprobarJS})(pre), start:clipById(pre.clipId)?clipById(pre.clipId).start:null };
    undo();
    const trasUndo2={ start:clipById(pre.clipId)?clipById(pre.clipId).start:null };
    return { antes, trasAccion, trasUndo1, trasUndo2 }; })()`);
  console.log('\n' + nombre);
  console.log('   ' + JSON.stringify(r.antes) + '  ->accion->  ' + JSON.stringify(r.trasAccion) + '  ->undo->  ' + JSON.stringify(r.trasUndo1.v));
  ok('el 1er Ctrl+Z revierte la accion', JSON.stringify(r.trasUndo1.v) === JSON.stringify(r.antes), '');
  ok('...y NO se come la edicion anterior', r.trasUndo1.start === 6, 'start ' + r.trasUndo1.start);
  ok('el 2o Ctrl+Z deshace ya la edicion anterior', r.trasUndo2.start === 0, 'start ' + r.trasUndo1.start + ' -> ' + r.trasUndo2.start);
}

await caso('1 - renombrar un medio', `pre=>{}`,
  `pre=>{ const m=mediaById(pre.ids[0]); pushUndo(); m.name='RENOMBRADO'; renderMedia(); }`,
  `pre=>mediaById(pre.ids[0]).name`);

await caso('2 - mover un medio a una carpeta', `pre=>{ state.folders=['Tomas']; renderMedia(); }`,
  `pre=>{ moveMediaTo([pre.ids[0]],'Tomas'); }`,
  `pre=>mediaById(pre.ids[0]).folder`);

await caso('3 - crear una carpeta', `pre=>{}`,
  `pre=>{ pushUndo(); state.folders.push('Nueva'); renderMedia(); }`,
  `pre=>state.folders.slice()`);

await caso('4 - renombrar una carpeta (arrastra la carpeta de sus medios)',
  `pre=>{ state.folders=['Vieja']; mediaById(pre.ids[1]).folder='Vieja'; renderMedia(); }`,
  `pre=>{ pushUndo(); _reprefixFolders('Vieja','NuevaCarpeta'); renderMedia(); }`,
  `pre=>[state.folders.slice(), mediaById(pre.ids[1]).folder]`);

await caso('5 - borrar una carpeta',
  `pre=>{ state.folders=['Borrame']; mediaById(pre.ids[2]).folder='Borrame'; renderMedia(); }`,
  `pre=>{ pushUndo(); state.folders=state.folders.filter(x=>x!=='Borrame');
          for(const m2 of state.media) if(m2.folder==='Borrame') m2.folder=null; renderMedia(); }`,
  `pre=>[state.folders.slice(), mediaById(pre.ids[2]).folder]`);

await caso('6 - marcar entrada/salida (lo de R253b, sigue OK)', `pre=>{}`,
  `pre=>{ const m=mediaById(pre.ids[0]); openSourceMonitor(m); _srcMon.in=8; _srcMon.out=14; smCommitMarks(); closeSourceMonitor(); }`,
  `pre=>{ const m=mediaById(pre.ids[0]); return [m.srcIn==null?null:m.srcIn, m.srcOut==null?null:m.srcOut]; }`);

/* la vista no puede quedar apuntando a una carpeta que el deshacer acaba de borrar */
console.log('\n7 - la carpeta que se estaba mirando deja de existir');
{
  const r=await ev(`(function(){ const pre=__preparar();
    pushUndo(); state.folders.push('Mirando'); state.mediaFolder='Mirando'; renderMedia();
    const antes=state.mediaFolder;
    undo();
    return { antes, despues:state.mediaFolder, carpetas:state.folders.slice(), errs:window.__errs.length }; })()`);
  ok('la vista sale de la carpeta borrada', r.despues===null, r.antes + ' -> ' + r.despues);
  ok('sin errores JS', r.errs===0, JSON.stringify(r.errs));
}

console.log('\nerrs JS: ' + JSON.stringify(await ev(`window.__errs.slice(0,5)`)));
console.log(fallos ? ('\n=== *** ' + fallos + ' fallos *** ===') : '\n=== DESHACER DE MEDIOS Y CARPETAS: TODO OK ===');
ws.close();
