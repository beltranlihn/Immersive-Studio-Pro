/* [R253d] Los cinco hallazgos de la revision del diff de R253c: que un deshacer NO se lleve por delante estado
   global que su foto nunca conocio. Cada caso monta el escenario exacto que describe la revision. */
import http from 'http'; import fs from 'fs';
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
await ev(`window.__prep=function(){
  state.media=state.media.filter(m=>m.kind==='nest'); state.folders=[]; state.folderColors={}; state.collapsedGroups={}; state.clips=[];
  for(let i=0;i<3;i++){ const cv=document.createElement('canvas'); cv.width=cv.height=64; cv.getContext('2d').fillRect(0,0,64,64);
    const m={id:uid(),kind:'video',name:'m'+(i+1),el:cv,originalEl:cv,tex:newTex(),w:1920,h:1080,dur:40,fps:30,color:'#888',folder:null,missing:false,_loading:false};
    try{m.thumb=cv.toDataURL();}catch(e){} state.media.push(m); }
  const ms=state.media.filter(m=>m.kind==='video');
  const c=makeClip(ms[0],state.lanes.findIndex(l=>l.kind==='video'),0); c.dur=10; state.clips.push(c);
  renderMedia(); renderTimeline(); return { clipId:c.id, ids:ms.map(m=>m.id) }; };1`);

console.log('\n1 - color de carpeta: un Ctrl+Z ajeno ya no se lo lleva');
{
  const r=await ev(`(function(){ const pre=__prep();
    state.folders=['Tomas']; state.folderColors={}; renderMedia();
    /* el usuario pone color (ahora empuja deshacer y marca version) */
    pushUndo(); bumpMeta(); state.folderColors['Tomas']='#8899AA'; renderMedia();
    /* ...y DESPUES hace una edicion de clip cualquiera */
    pushUndo(); clipById(pre.clipId).start=6;
    const antes=state.folderColors['Tomas'];
    undo();                                   // deshace SOLO la edicion del clip
    return { antes, despues:state.folderColors['Tomas'], start:clipById(pre.clipId).start }; })()`);
  ok('el color sobrevive al deshacer de la edicion posterior', r.despues===r.antes, r.antes+' -> '+r.despues);
  ok('...y la edicion del clip si se deshizo', r.start===0, 'start '+r.start);
}

console.log('\n2 - carpetas creadas al arrastrar del explorador (sin deshacer propio)');
{
  const r=await ev(`(function(){ const pre=__prep();
    pushUndo(); clipById(pre.clipId).start=6;          // edicion previa, cuya foto NO conoce la carpeta
    bumpMeta(true); state.folders.push('Importada');    // LA MISMA llamada que hace importDropped
    mediaById(pre.ids[0]).folder='Importada'; renderMedia();
    undo();                                             // deshacer la edicion del clip
    return { carpetas:state.folders.slice(), folderDelMedio:mediaById(pre.ids[0]).folder, start:clipById(pre.clipId).start }; })()`);
  ok('la carpeta importada NO desaparece', r.carpetas.indexOf('Importada')>=0, JSON.stringify(r.carpetas));
  ok('...ni el medio queda huerfano en la raiz', r.folderDelMedio==='Importada', String(r.folderDelMedio));
  ok('...y la edicion del clip si se deshizo', r.start===0, 'start '+r.start);
}

/* Los casos 2 y 6 llaman a `bumpMeta` como lo hace el codigo; esto comprueba que el codigo lo hace de verdad, para
   que la sonda no se despegue de la app y siga dando verde sobre una simulacion que ya no existe. */
{
  const src=fs.readFileSync('app.js','utf8');
  const conMarca=(src.match(/bumpMeta\(true\)/g)||[]).length;
  const importa=/if\(!folderExists\(sub\)\)\{ bumpMeta\(true\)/.test(src);
  const reenlace=/bumpMeta\(true\); \/\* \[R253d\] reparar un medio ausente/.test(src);
  const total=(src.match(/bumpMeta\(/g)||[]).length;
  ok('el codigo real marca los cambios SIN deshacer propio', importa && reenlace && conMarca===2,
     conMarca+' con marca de '+(total-2)+' llamadas · importDropped='+importa+' reenlace='+reenlace);
}

console.log('\n3 - pilas POR SECUENCIA con medios GLOBALES (el caso cruzado)');
{
  const r=await ev(`(function(){ const pre=__prep();
    const seqA=state.activeSeqId;
    const nest=newSeqMedia('SecB',state.fps,state.seqW,state.seqH,[],[{id:uid(),name:'V1',tag:'V1',kind:'video'}],'dome');
    state.media.push(nest);
    pushUndo(); clipById(pre.clipId).start=6;            // edicion en A
    loadSeqIntoState(nest); state.activeSeqId=nest.id;   // me voy a B
    pushUndo(); bumpMeta(); mediaById(pre.ids[1]).name='RENOMBRADO_EN_B'; renderMedia();
    const seqB=state.activeSeqId;
    /* vuelvo a A y deshago: su foto es anterior al renombre hecho en B */
    const mA=state.media.find(m=>m.id===seqA); if(mA)loadSeqIntoState(mA); state.activeSeqId=seqA;
    undo();
    return { nombre:mediaById(pre.ids[1]).name, start:(clipById(pre.clipId)||{}).start }; })()`);
  ok('el renombre hecho en la otra secuencia SOBREVIVE', r.nombre==='RENOMBRADO_EN_B', r.nombre);
}

console.log('\n4 - deshacer el borrado de una carpeta la devuelve como estaba (plegada)');
{
  const r=await ev(`(function(){ const pre=__prep();
    state.folders=['Plegada']; state.collapsedGroups={'f_Plegada':true}; mediaById(pre.ids[2]).folder='Plegada'; renderMedia();
    const antes=!!state.collapsedGroups['f_Plegada'];
    pushUndo(); bumpMeta(); state.folders=state.folders.filter(x=>x!=='Plegada');
    for(const k of Object.keys(state.collapsedGroups)) if(k==='f_Plegada')delete state.collapsedGroups[k];
    for(const m of state.media) if(m.folder==='Plegada') m.folder=null; renderMedia();
    undo();
    return { antes, vuelve:state.folders.indexOf('Plegada')>=0, plegada:!!state.collapsedGroups['f_Plegada'] }; })()`);
  ok('la carpeta vuelve', r.vuelve, '');
  ok('...y vuelve PLEGADA, como estaba', r.plegada===r.antes, 'antes '+r.antes+' -> '+r.plegada);
}

console.log('\n5 - crear una carpeta cuesta UN solo Ctrl+Z');
{
  const r=await ev(`(function(){ const pre=__prep();
    const antes=_ustk().u.length;
    newFolderIn(null);
    const path=state.folders[state.folders.length-1];
    const trasCrear=_ustk().u.length;
    /* el renombre inmediato del nombre automatico NO debe empujar otro deshacer */
    const el=document.querySelector('#mediaList .folderhdr[data-fname=\\"'+path+'\\"] .fnm')||document.querySelector('#mediaList .foldertile[data-fname=\\"'+path+'\\"] .tlbl');
    renameFolderInline(path,el);
    const inp=document.querySelector('[contenteditable=true]');
    if(inp){ inp.textContent='MiCarpeta'; inp.dispatchEvent(new FocusEvent('blur')); }
    const trasRenombrar=_ustk().u.length;
    undo();
    return { antes, trasCrear, trasRenombrar, carpetas:state.folders.slice() }; })()`);
  console.log('   pila: '+r.antes+' -> crear '+r.trasCrear+' -> renombrar '+r.trasRenombrar);
  ok('el renombre inmediato NO empuja un segundo deshacer', r.trasRenombrar===r.trasCrear, r.trasCrear+' vs '+r.trasRenombrar);
  ok('un solo Ctrl+Z deja el arbol vacio', r.carpetas.length===0, JSON.stringify(r.carpetas));
}

console.log('\n6 - el caso normal sigue funcionando (no me he pasado de conservador)');
{
  const r=await ev(`(function(){ const pre=__prep();
    pushUndo(); clipById(pre.clipId).start=6;
    pushUndo(); bumpMeta(); mediaById(pre.ids[0]).name='NUEVO'; renderMedia();
    const trasRenombrar=mediaById(pre.ids[0]).name;
    undo();
    const trasUndo1={ nombre:mediaById(pre.ids[0]).name, start:clipById(pre.clipId).start };
    undo();
    return { trasRenombrar, trasUndo1, start2:clipById(pre.clipId).start }; })()`);
  ok('el 1er Ctrl+Z revierte el renombre', r.trasUndo1.nombre==='m1', r.trasRenombrar+' -> '+r.trasUndo1.nombre);
  ok('...sin tocar la edicion anterior', r.trasUndo1.start===6, 'start '+r.trasUndo1.start);
  ok('el 2o Ctrl+Z deshace ya la edicion', r.start2===0, 'start '+r.start2);
}

console.log('\nerrs JS: ' + JSON.stringify(await ev(`window.__errs.slice(0,5)`)));
console.log(fallos ? ('\n=== *** ' + fallos + ' fallos *** ===') : '\n=== LOS CINCO ARREGLADOS, Y EL CASO NORMAL INTACTO ===');
ws.close();
