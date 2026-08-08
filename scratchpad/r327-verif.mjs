/* [R327] LOS ARREGLOS QUE NO ARREGLABAN. Un repaso midio tres de los cierres de R325/R326 contra el caso del
   hallazgo ORIGINAL y salieron inertes: el codigo estaba puesto, pero nunca se ejecutaba o protegia una rama
   inalcanzable. Esta red mide justo esos casos, no algo que se les parezca.
     1 · rehacer un borrado de medio tiene que dejarlo FUERA del panel (false/true/false). R325 puso el retorno a
         la papelera dentro de la guarda `_segura`, que en el par deshacer/rehacer es falsa: no corria nunca.
     2 · y no puede llevarse por delante un medio IMPORTADO, que no aparece en ninguna foto porque importar no
         empuja deshacer. Por eso se entierran solo los `trashIds` de la propia foto, no todo lo que falte.
     3 · la guarda de `enqProxy` se apoyaba en `_pxGen`, que no se ponia a true en ninguna parte.
     4 · las carpetas desaparecian con un filtro activo — el arreglo de R326 miraba `state.media`, que nunca esta
         vacio porque la secuencia vive ahi, asi que protegia una rama inalcanzable.

   Uso:  npx electron . --remote-debugging-port=9222   y luego   node scratchpad/r327-verif.mjs
*/
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0; const p=new Map(); ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise(r=>{const i=++id;p.set(i,m=>r(m.result&&m.result.exceptionDetails?('EXC '+(m.result.exceptionDetails.exception?.description||'').slice(0,80)):(m.result&&m.result.result&&m.result.result.value)));ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true,timeout:60000}}));});

console.log('1) REHACER un borrado de medio (debe ser false/true/false)');
const r1 = await ev(`(async()=>{ try{
  await newProject('flat',1920,1080,30,180,true); if(typeof hideLanding==='function')hideLanding();
  const m={id:850001,kind:'video',name:'suelto.mp4',w:16,h:16,dur:5,fsize:9};
  state.media.push(m); clearAllUndo();
  pushUndo([m.id]); state.mediaTrash=state.mediaTrash||{}; m._trashed=true; state.mediaTrash[m.id]=m;
  state.media=state.media.filter(x=>x.id!==m.id);
  const a=state.media.some(x=>x.id===850001); undo();
  const b=state.media.some(x=>x.id===850001); redo();
  const c=state.media.some(x=>x.id===850001);
  return JSON.stringify({trasBorrar:a,trasUndo:b,trasRedo:c,ok:(!a&&b&&!c)});
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r1);

console.log('2) y un medio IMPORTADO no se lo lleva un Ctrl+Z ajeno');
const r2 = await ev(`(async()=>{ try{
  await newProject('flat',1920,1080,30,180,true); if(typeof hideLanding==='function')hideLanding();
  const LV=state.lanes.findIndex(l=>l.kind!=='audio');
  _demoAddShape('rect','#888',LV,0,4,{x:0,y:0,scale:100});
  clearAllUndo();
  pushUndo(); state.clips[state.clips.length-1].props.opacity=50;      // accion sin relacion
  state.media.push({id:850002,kind:'video',name:'importado.mp4',w:16,h:16,dur:5,fsize:9});   // import: no empuja deshacer
  undo();
  return JSON.stringify({sigueEnElPanel:state.media.some(x=>x.id===850002)});
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r2);

console.log('3) enqProxy con pumpProxy DE VERDAD (que es como se pone _pxGen)');
const r3 = await ev(`(async()=>{ try{
  const m={id:850003,kind:'video',name:'v',path:'C:/no-existe.mp4'};
  const n0=proxyQ.length; proxyBusy=false;
  enqProxy(m); pumpProxy();                    // arranca de verdad: pone _pxGen y saca de la cola
  await new Promise(z=>setTimeout(z,120));
  const genera=!!m._pxGen, enCola1=proxyQ.length-n0;
  enqProxy(m); enqProxy(m);                    // dos clics MIENTRAS genera
  const enCola2=proxyQ.length-n0;
  return JSON.stringify({marcaPuesta:genera, reencoladoMientrasGenera:enCola2-enCola1});
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r3);

console.log('4) el filtro no hace desaparecer las carpetas');
const r4 = await ev(`(async()=>{ try{
  await newProject('flat',1920,1080,30,180,true); if(typeof hideLanding==='function')hideLanding();
  state.folders=['Carpeta X']; state.mediaFilter='audio';    // no hay audio: items queda vacio
  renderMedia(); await new Promise(z=>setTimeout(z,150));
  const html=(document.getElementById('mediaList')||{}).innerHTML||'';
  state.mediaFilter='all';
  return JSON.stringify({seVeLaCarpeta:/Carpeta X/.test(html), diceSinCoincidencias:/No matching|coincidentes/.test(html)});
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r4);
const malas=[];
if(!/\"ok\":true/.test(r1))malas.push('rehacer un borrado de medio no lo devuelve a la papelera');
if(!/\"sigueEnElPanel\":true/.test(r2))malas.push('un Ctrl+Z ajeno se lleva un medio importado');
if(!/\"seVeLaCarpeta\":true/.test(r4))malas.push('un filtro activo hace desaparecer las carpetas');
console.log('');
for(const m of malas)console.log('   *** '+m);
console.log(malas.length?('*** '+malas.length+' FALLOS'):'los arreglos inertes quedan medidos contra su caso original');
ws.close(); process.exit(malas.length?1:0);
