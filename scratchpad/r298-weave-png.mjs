/* [R298] La posicion del tejido al loopear, medida DONDE PASA.
   La prueba de R297 no valia: leia `animTime` en el nivel de FUERA, donde el tiempo nunca se envuelve, asi que
   salia continuo pasara lo que pasara. El envolvimiento ocurre DENTRO del nido -es `srcT` quien lo hace- y es
   ahi donde `_animNido` tiene que compensar. Aqui se lee la posicion REAL de un elemento del tejido a los dos
   lados del salto, por el mismo camino que usa el render. */
import http from 'http';
const t=await new Promise((r2,j)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>r2(JSON.parse(b)));}).on('error',j);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise((res,rej)=>{const i=++id;p.set(i,r=>r.error?rej(new Error(JSON.stringify(r.error))):(r.result.exceptionDetails?rej(new Error(r.result.exceptionDetails.exception?.description||'')):res(r.result.result.value)));ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true}}));});
let fallos=0; const mal=m=>{ console.log('   *** '+m); fallos++; };

await ev("(async()=>{ await newProject('dome',1024,1024,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()");
await new Promise(r=>setTimeout(r,2000));

const r=await ev(`(async function(){
  /* PNG: imagenes fijas, como las que usa Beltran. Con material fijo el UNICO movimiento del tejido es el
     desplazamiento, asi que si algo salta se ve limpio, sin el ruido de un video reproduciendose. */
  const hacerPng=(c)=>{ const cv=document.createElement('canvas'); cv.width=cv.height=64;
    const x=cv.getContext('2d'); x.fillStyle=c; x.fillRect(0,0,64,64); return cv; };
  const ids=[];
  for(const col of ['#C33','#3C3','#33C']){
    const cv=hacerPng(col); const m={id:uid(),name:'p'+ids.length+'.png',kind:'image',el:cv,originalEl:cv,tex:newTex(),
      w:64,h:64,dur:5,fps:0,color:col,folder:null}; upTex(m.tex,cv); state.media.push(m); ids.push(m.id); }
  renderMedia();

  const g={id:88,kind:'weave',mediaIds:ids,mediaId:ids[0],count:9,shuffle:true,strips:3,bandW:100,gap:0,
           speed:0.25,rotSpeed:0,rotDir:'same',lay:'woven',mask:'none',maskScale:100,rand:[],jitter:0,size:40,el:30};
  const nest=state.media.find(isSeqMedia);
  /* Los elementos del tejido, como clips DENTRO del nido, con sus modificadores de disposicion. */
  const lay=weaveLayout(g);
  const dentro=[];
  for(let i=0;i<lay.length;i++){ const p=lay[i];
    const c={ id:uid(), mediaId:ids[i%ids.length], lane:0, start:0, dur:60, inP:0, props:{}, kf:{},
              anim:compWeaveAnim(g,p).map(a=>Object.assign({},a)) };
    compElProps(g,p); Object.assign(c.props,{x:p.x||0,y:p.y||0,scale:p.scale||1});
    dentro.push(c); }
  const nido={ id:uid(), kind:'nest', name:'Tejido', dur:3, color:'#679', nestClips:dentro, comp:g };
  state.media.push(nido);

  /* Y el nido, LOOPEADO en la linea de tiempo. */
  const c={ id:uid(), mediaId:nido.id, lane:state.lanes.findIndex(l=>l.kind==='video'), start:0, dur:12,
            inP:0, loop:true, loopLen:3, props:{}, kf:{} };
  state.clips.push(c);

  /* La posicion del primer elemento, leida como la lee el render: prepNests fija el reloj del nido y despues
     se evalua el modificador. */
  const pos=tt=>{ prepNests(state.clips,tt,0);
    const cc=nido.nestClips[0];
    const off=(typeof animOffset==='function')?animOffset(cc,tt):null;
    const v=off? (off.x!=null?off.x:(off.y!=null?off.y:0)) : null;
    return {t:tt, nido:_animNido, v}; };
  const muestras=[2.90,2.97,3.03,3.10,5.97,6.03].map(pos);
  state.clips=state.clips.filter(x=>x.id!==c.id);
  return {muestras, mods:(dentro[0].anim||[]).map(a=>a.mode+':'+a.param).join(',')}; })()`);

console.log('modificadores del elemento: '+r.mods);
for(const m of r.muestras) console.log('  t='+m.t.toFixed(2)+'   _animNido='+(m.nido==null?'?':m.nido.toFixed(3))+'   posicion='+(m.v==null?'(no legible)':m.v.toFixed(3)));
const v=r.muestras.map(m=>m.v);
if(v.some(x=>x==null)){ mal('no se pudo leer la posicion: la prueba no mide lo que dice'); }
else{
  /* Al cruzar de 2,97 a 3,03 el desplazamiento debe avanzar lo MISMO que de 2,90 a 2,97 por unidad de tiempo.
     Si al cruzar el bucle salta hacia atras, ahi esta el reinicio que Beltran ve. */
  const pasoDentro=(v[1]-v[0])/0.07, pasoCruce=(v[2]-v[1])/0.06;
  console.log('avance por segundo:  dentro de la vuelta '+pasoDentro.toFixed(2)+'   cruzando el salto '+pasoCruce.toFixed(2));
  if(Math.sign(pasoCruce)!==Math.sign(pasoDentro)&&Math.abs(pasoCruce)>1)
    mal('al cruzar el bucle la posicion RETROCEDE: es el reinicio que se ve en pantalla');
  else if(Math.abs(pasoCruce-pasoDentro)>Math.abs(pasoDentro)*3+1)
    mal('el avance da un salto al cruzar ('+pasoDentro.toFixed(2)+' -> '+pasoCruce.toFixed(2)+')');
}
console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'la posicion del tejido sigue corrida al cruzar el bucle'));
ws.close(); process.exit(fallos?1:0);
