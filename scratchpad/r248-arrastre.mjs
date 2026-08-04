/* [R248] El arrastre DE VERDAD: eventos de raton reales desde un clip del panel de Medios hasta la cesta del
   dialogo, para ejercitar startMediaDrag y el velo transparente. Y una captura del dialogo nuevo. */
import http from 'http'; import fs from 'fs';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:60000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const raton=(type,x,y)=>cmd('Input.dispatchMouseEvent',{type,x,y,button:'left',buttons:type==='mouseReleased'?0:1,clickCount:1,pointerType:'mouse'});

/* asegurar el panel de Medios visible y una composicion abierta */
await ev(`(function(){ document.querySelectorAll('#compOv').forEach(o=>o.remove());
  const pane=document.querySelector('#mediaPane'); if(pane&&pane.classList.contains('collapsed'))pane.classList.remove('collapsed');
  const n=state.media.find(x=>x.kind==='nest'&&x.comp&&x.comp.kind==='ring');
  openCompose(null,null,n,null,null);
  const x=document.querySelector('#cMedia .cbx'); if(x)x.click();   // libera una fuente para poder arrastrarla de vuelta
  return 1; })()`);
await wait(300);

const geo=await ev(`(function(){
  const cesta=document.querySelector('#cMedia'); const rc=cesta.getBoundingClientRect();
  const enCesta=[...cesta.querySelectorAll('.cbname')].map(e=>e.textContent);
  /* un medio del panel que NO este ya dentro */
  const items=[...document.querySelectorAll('#mediaList .mitem, #mediaList .mtile')];
  let src=null;
  for(const it of items){ const m=mediaById(+it.dataset.id); if(m&&m.kind==='image'&&!enCesta.includes(m.name)){ src={r:it.getBoundingClientRect(), nombre:m.name}; break; } }
  return { cesta:{x:rc.left+rc.width/2, y:rc.top+rc.height/2, w:rc.width, h:rc.height},
           src:src?{x:src.r.left+src.r.width/2, y:src.r.top+src.r.height/2, nombre:src.nombre}:null,
           antes:enCesta, visible:items.length }; })()`);
if(!geo.src){ console.log('no hay medio libre que arrastrar (items en panel: '+geo.visible+')'); ws.close(); process.exit(0); }
console.log('cesta antes : '+geo.antes.join(','));
console.log('arrastrando : '+geo.src.nombre+'  ('+Math.round(geo.src.x)+','+Math.round(geo.src.y)+') → ('+Math.round(geo.cesta.x)+','+Math.round(geo.cesta.y)+')');

await raton('mousePressed',geo.src.x,geo.src.y); await wait(60);
for(let i=1;i<=8;i++){ await raton('mouseMoved', geo.src.x+(geo.cesta.x-geo.src.x)*i/8, geo.src.y+(geo.cesta.y-geo.src.y)*i/8); await wait(35); }
const resalte=await ev(`document.querySelector('#cMedia').classList.contains('over')`);
await raton('mouseReleased',geo.cesta.x,geo.cesta.y); await wait(250);

const r=await ev(`(function(){ const c=document.querySelector('#cMedia');
  return { cesta:[...c.querySelectorAll('.cbname')].map(e=>e.textContent), resalteQuitado:!c.classList.contains('over') }; })()`);
console.log('resaltada al pasar por encima : '+(resalte?'SI':'NO'));
console.log('cesta despues: '+r.cesta.join(','));
console.log('resalte limpiado al soltar    : '+(r.resalteQuitado?'SI':'NO'));
console.log(r.cesta.includes(geo.src.nombre) ? '\nEl arrastre real desde Medios funciona.' : '\n*** el clip no entro en la cesta ***');

/* captura del dialogo */
const shot=await cmd('Page.captureScreenshot',{format:'png'});
fs.writeFileSync('scratchpad/r248-dialogo.png', Buffer.from(shot.data,'base64'));
console.log('captura: scratchpad/r248-dialogo.png');
ws.close();
