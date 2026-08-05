/* [R253b] Los cuatro hallazgos de la revision del diff de R253, comprobados uno a uno sobre el .exe. */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:90000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const vk={Escape:27,ArrowRight:39};
const tecla=async(k)=>{ await cmd('Input.dispatchKeyEvent',{type:'keyDown',key:k,code:k,windowsVirtualKeyCode:vk[k]||0,nativeVirtualKeyCode:vk[k]||0});
                        await cmd('Input.dispatchKeyEvent',{type:'keyUp',  key:k,code:k,windowsVirtualKeyCode:vk[k]||0,nativeVirtualKeyCode:vk[k]||0}); };
let fallos=0; const ok=(t,c,d)=>{ if(!c)fallos++; console.log('   '+(c?'OK  ':'*** FALLA *** ')+t+(d?' - '+d:'')); };

await cmd('Page.enable'); await cmd('Page.reload',{ignoreCache:true}); await wait(3800);
await ev(`(function(){ window.__errs=[]; addEventListener('error',e=>__errs.push(String(e.message||e))); return 1; })()`);
await ev(`(async()=>{ await newProject('dome',2048,2048,60,180,true); if(typeof hideLanding==='function')hideLanding(); })()`); await wait(1100);
await ev(`window.__mk=function(n){ const out=[]; for(let i=0;i<n;i++){ const cv=document.createElement('canvas'); cv.width=cv.height=64; cv.getContext('2d').fillRect(0,0,64,64);
  const m={id:uid(),kind:'video',name:'v'+(i+1),el:cv,originalEl:cv,tex:newTex(),w:1920,h:1080,dur:50,fps:30,color:'#888',missing:false,_loading:false};
  try{m.thumb=cv.toDataURL();}catch(e){} state.media.push(m); out.push(m); } renderMedia(); return out; };1`);

console.log('\n1 - Escape huerfano del dialogo de composicion');
{
  const r=await ev(`(function(){ __mk(2);
    openCompose(null,null,null,null,null);
    openCompose(null,null,null,null,null);
    return { cuadros:document.querySelectorAll('#compOv').length }; })()`);
  ok('la segunda apertura deja UN solo cuadro', r.cuadros===1, r.cuadros+' cuadros');
  await ev(`(function(){ const b=document.querySelector('#cCancel'); if(b)b.click(); return 1; })()`); await wait(250);
  await ev(`(function(){ const ov=document.createElement('div'); ov.className='overlay'; ov.id='pruebaOv';
    ov.innerHTML='<div class="modal"></div>'; document.body.appendChild(ov); return 1; })()`);
  await tecla('Escape'); await wait(300);
  const r3=await ev(`({ fuera:!document.getElementById('pruebaOv') })`);
  ok('un Escape posterior YA NO se lo come el dialogo cerrado', r3.fuera, r3.fuera?'el overlay generico se cerro':'el Escape se perdio');
  await ev(`(function(){ const o=document.getElementById('pruebaOv'); if(o)o.remove(); return 1; })()`);
}

console.log('\n2 - Ctrl+Z sobre las marcas de origen');
{
  const r=await ev(`(function(){ state.clips=[]; const ms=state.media.filter(m=>m.kind==='video');
    const c=makeClip(ms[0],state.lanes.findIndex(l=>l.kind==='video'),0); c.dur=10; state.clips.push(c);
    pushUndo(); c.start=7; const startTrasEdicion=c.start;
    openSourceMonitor(ms[0]); _srcMon.in=12; _srcMon.out=18; smCommitMarks(); closeSourceMonitor();
    const trasMarcar=[ms[0].srcIn,ms[0].srcOut];
    undo();
    const m1=mediaById(ms[0].id), c1=clipById(c.id);
    const trasUndo1=[m1.srcIn==null?null:m1.srcIn, m1.srcOut==null?null:m1.srcOut, c1?c1.start:null];
    undo();
    const c2=clipById(c.id);
    return { startTrasEdicion, trasMarcar, trasUndo1, startTrasUndo2:c2?c2.start:null }; })()`);
  console.log('   marcado 12->18 · tras undo1: marcas=' + JSON.stringify(r.trasUndo1.slice(0,2)) + ' start=' + r.trasUndo1[2] + ' · tras undo2: start=' + r.startTrasUndo2);
  ok('el 1er Ctrl+Z QUITA las marcas', r.trasUndo1[0]==null, 'srcIn ' + r.trasMarcar[0] + ' -> ' + r.trasUndo1[0]);
  ok('...y NO toca la edicion anterior', r.trasUndo1[2]===r.startTrasEdicion, 'start sigue en ' + r.trasUndo1[2]);
  ok('el 2o Ctrl+Z ya deshace la edicion anterior', r.startTrasUndo2===0, 'start ' + r.trasUndo1[2] + ' -> ' + r.startTrasUndo2);
}

console.log('\n3 - el maestro de intensidad con TECLADO');
{
  await ev(`(function(){ state.clips=[]; const ms=state.media.filter(m=>m.kind==='video');
    const c=makeClip(ms[0],state.lanes.findIndex(l=>l.kind==='video'),0); c.dur=30; state.clips.push(c);
    state.selId=c.id; state.selIds=[c.id]; addAnimPreset(c,'float');
    state.insCol=state.insCol||{}; for(const k in state.insCol)state.insCol[k]=false;
    renderInspector(); return 1; })()`); await wait(350);
  const g=await ev(`(function(){ const sl=document.querySelector('#animList input[type=range]'); if(!sl)return {err:1};
    sl.focus(); const r=sl.getBoundingClientRect(); return { v0:+sl.value, foco:sl===document.activeElement }; })()`);
  if(g.err){ ok('hay deslizador maestro', false, 'no aparece'); }
  else {
    for(let i=0;i<5;i++){ await tecla('ArrowRight'); await wait(90); }
    const r=await ev(`(function(){ const sl=document.querySelector('#animList input[type=range]');
      const c=selClip(); const a=c&&c.anim?c.anim.find(x=>x.gid):null;
      return { existe:!!sl, valor:sl?+sl.value:null, conFoco:sl===document.activeElement, gint:a?a.gint:null }; })()`);
    ok('el deslizador sigue vivo tras 5 flechas', r.existe, '');
    ok('...y conserva el foco', r.conFoco, '');
    ok('las 5 flechas SUMAN (no se pierde ninguna)', r.valor>=g.v0+4, g.v0 + ' -> ' + r.valor + ' (gint ' + r.gint + ')');
  }
}

console.log('\n4 - distintivo de recorte en las DOS vistas');
{
  const r=await ev(`(function(){ const m=state.media.find(x=>x.kind==='video'); m.srcIn=5; m.srcOut=11;
    const seg=document.querySelector('#mediaViewSeg');
    state.mediaView='list'; renderMedia();
    const enFila=!!document.querySelector('#mediaList .mrange');
    state.mediaView='grid'; renderMedia();
    const tile=document.querySelector('#mediaList .tcut');
    const enTile=!!tile, txt=tile?tile.textContent:'-';
    state.mediaView='list'; renderMedia();
    return { enFila, enTile, txt }; })()`);
  ok('vista de lista lo ensena', r.enFila, '');
  ok('vista de cuadricula lo ensena', r.enTile, r.txt);
}

console.log('\nerrs JS: ' + JSON.stringify(await ev(`window.__errs.slice(0,5)`)));
console.log(fallos ? ('\n=== *** ' + fallos + ' fallos *** ===') : '\n=== LOS CUATRO ARREGLADOS ===');
ws.close();
