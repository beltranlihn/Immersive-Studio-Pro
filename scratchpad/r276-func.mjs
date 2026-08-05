/* [R276] Los faders nuevos del cuadro de Compose deben ARRASTRAR y seguir guardando igual. */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise((res,rej)=>{const i=++id;p.set(i,r=>r.error?rej(new Error(JSON.stringify(r.error))):(r.result.exceptionDetails?rej(new Error(r.result.exceptionDetails.exception?.description||r.result.exceptionDetails.text)):res(r.result.result.value)));
  ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true}}));});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let fallos=0; const mal=m=>{ console.log('   *** '+m); fallos++; };
await ev(`(async()=>{ await newProject('dome',1024,1024,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()`);
await wait(1400);
await ev(`(function(){ for(let k=0;k<2;k++) state.media.push({id:uid(),name:'c'+k+'.mp4',kind:'video',w:1920,h:1080,dur:10,fps:30,color:'#888',path:'x'+k,folder:null}); renderMedia(); return 1; })()`);
const r=await ev(`(async function(){
  const ids=state.media.filter(m=>m.kind==='video').map(m=>m.id);
  const g={id:3,kind:'tunnel',mediaIds:ids,mediaId:ids[0],count:6,sizeFrom:1,sizeTo:200,speed:0.4,curve:25,twist:0,helix:0,
           fadeIn:0.5,fadeOut:0.5,el:30,size:40,cols:3,arc:140,mask:'none',maskScale:100,rand:[],jitter:0};
  openCompose('tunnel',g,null,null,null); await new Promise(s=>setTimeout(s,600));
  const rng=document.querySelector('#cTCurve'); const f=rng.nextElementSibling;
  const ocultos=[...document.querySelectorAll('.frow input[type=range]')].every(x=>x.style.display==='none');
  const conFader=[...document.querySelectorAll('.frow input[type=range]')].every(x=>x.nextElementSibling&&x.nextElementSibling.classList.contains('cfield'));
  /* el pre-rellenado debe haber pintado la barra: curva 25 de 0..100 */
  const anchoAntes=f.querySelector('i').style.width;
  const v0=+rng.value;
  const tr=f.querySelector('.ctrack').getBoundingClientRect();
  f.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:tr.left+tr.width*0.8,clientY:tr.top+2,pointerId:9}));
  window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:tr.left+tr.width*0.8,clientY:tr.top+2,pointerId:9}));
  await new Promise(s=>setTimeout(s,250));
  const v1=+rng.value, anchoDesp=f.querySelector('i').style.width;
  const rot=document.querySelector('#cTCurveV').textContent;
  /* y que al aplicar se guarde ese valor */
  document.querySelector('#cGo').click(); await new Promise(s=>setTimeout(s,350));
  return { ocultos, conFader, v0, v1, anchoAntes, anchoDesp, rotulo:rot, guardado:g.curve }; })()`);
console.log('sliders nativos ocultos: '+r.ocultos+'   todos con fader: '+r.conFader);
console.log('pre-rellenado: curva '+r.v0+' -> barra al '+r.anchoAntes);
console.log('tras arrastrar al 80%: valor '+r.v1+' -> barra al '+r.anchoDesp+'   rotulo: '+r.rotulo);
console.log('guardado al aplicar: '+r.guardado);
if(!r.ocultos) mal('quedan sliders nativos visibles');
if(!r.conFader) mal('algun slider no tiene fader');
if(r.v0!==25) mal('el pre-rellenado no llego al mando');
if(r.anchoAntes!=='25%') mal('la barra no refleja el valor restaurado (esta al '+r.anchoAntes+')');
if(!(r.v1>70&&r.v1<90)) mal('arrastrar al 80% no ha puesto el valor ahi (v='+r.v1+')');
if(r.rotulo.indexOf(String(r.v1))<0) mal('el rotulo no sigue al fader');
if(r.guardado!==r.v1) mal('al aplicar no se guarda lo que marca el fader');
console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'los faders del cuadro funcionan y guardan igual'));
ws.close();
