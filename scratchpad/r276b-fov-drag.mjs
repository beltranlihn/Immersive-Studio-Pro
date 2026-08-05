/* [R276b] Un pulgar transparente sigue siendo un pulgar: hay que DEMOSTRAR que se arrastra. Raton de verdad por
   CDP (Input.dispatchMouseEvent), no eventos sinteticos -que en un input[type=range] de Chromium no arrastran. */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let fallos=0; const mal=m=>{ console.log('   *** '+m); fallos++; };

const r=await ev(`(function(){ const e=document.querySelector('#fovRange'); if(!e)return null;
  const b=e.getBoundingClientRect(); return {x:b.left,y:b.top,w:b.width,h:b.height,v:+e.value,
    fov:state.view.cam.fov, rot:'', pct:e.style.getPropertyValue('--pct')}; })()`);
if(!r){ console.log('*** no esta #fovRange (hay que estar en el visor 3D)'); process.exit(1); }
console.log('antes:  valor '+r.v+'   camara '+r.fov+'   barra '+r.pct);

const cy=Math.round(r.y+r.h/2);
const raton=(type,x,btn)=>cmd('Input.dispatchMouseEvent',{type,x:Math.round(x),y:cy,button:btn||'left',buttons:type==='mouseReleased'?0:1,clickCount:1});
/* agarrar en el pulgar (16,7 % del recorrido) y llevarlo al 75 % */
await raton('mousePressed', r.x+r.w*0.167);
await wait(60);
await raton('mouseMoved', r.x+r.w*0.45); await wait(60);
await raton('mouseMoved', r.x+r.w*0.75); await wait(80);
await raton('mouseReleased', r.x+r.w*0.75);
await wait(200);

const d=await ev(`(function(){ const e=document.querySelector('#fovRange');
  return {v:+e.value, fov:state.view.cam.fov, pct:e.style.getPropertyValue('--pct'),
          rotulo:document.querySelector('#fovLbl').textContent}; })()`);
console.log('despues: valor '+d.v+'   camara '+d.fov+'   barra '+d.pct+'   rotulo '+d.rotulo);

const esperado=40+(160-40)*0.75;               /* 130 */
if(d.v===r.v) mal('el arrastre no ha movido nada: el pulgar transparente no se agarra');
if(Math.abs(d.v-esperado)>8) mal('acabo en '+d.v+' y el 75 % del recorrido es '+esperado);
if(Math.abs(d.fov-d.v)>0.01) mal('la camara no ha seguido al mando (fov='+d.fov+')');
if(d.pct!=='75.0%'&&Math.abs(parseFloat(d.pct)-75)>7) mal('la barra pintada ('+d.pct+') no coincide con el valor');
if(d.rotulo.indexOf(String(Math.round(d.v)))<0) mal('el rotulo no sigue al mando: '+d.rotulo);
console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'el FOV se arrastra, mueve la camara y pinta donde debe'));
ws.close();
