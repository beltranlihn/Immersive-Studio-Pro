/* [R299] Lo que Beltran VE: un tejido hecho con fotos, loopeado justo a la duracion por defecto de una foto.
   Se comparan PIXELES, que es la unica forma de saber si la imagen salta: se mide cuanto cambia el cuadro al
   cruzar el bucle y se compara con cuanto cambia en un tramo igual de largo pero SIN cruzarlo. Si el tejido
   sigue corrido, los dos numeros se parecen; si se reinicia, el del cruce se dispara. */
import http from 'http';
const t=await new Promise((r2,j)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>r2(JSON.parse(b)));}).on('error',j);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise((res,rej)=>{const i=++id;p.set(i,r=>r.error?rej(new Error(JSON.stringify(r.error))):(r.result.exceptionDetails?rej(new Error(r.result.exceptionDetails.exception?.description||'')):res(r.result.result.value)));ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true}}));});
let fallos=0; const mal=m=>{ console.log('   *** '+m); fallos++; };
await ev("(async()=>{ await newProject('dome',1024,1024,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()");
await new Promise(r=>setTimeout(r,2200));
const r=await ev(`(async function(){
  /* Tres fotos, como las suyas. La duracion por defecto de una foto es la que acabara midiendo el compose. */
  const ids=[];
  for(const col of ['#E04','#0C6','#26E']){
    const cv=document.createElement('canvas'); cv.width=cv.height=128; const x=cv.getContext('2d');
    x.fillStyle=col; x.fillRect(0,0,128,128); x.fillStyle='#fff'; x.fillRect(0,0,128,18);
    const m={id:uid(),name:'f'+ids.length+'.png',kind:'image',el:cv,originalEl:cv,tex:newTex(),w:128,h:128,dur:5,fps:0,color:col,folder:null};
    upTex(m.tex,cv); state.media.push(m); ids.push(m.id); }
  renderMedia();
  const srcs=ids.map(i=>mediaById(i));
  const dur=compSrcDur(srcs);                 /* lo que el software le da al compose hecho de fotos */
  const g={id:99,kind:'weave',mediaIds:ids,mediaId:ids[0],count:9,shuffle:true,strips:3,bandW:100,gap:0,
           speed:0.25,rotSpeed:0,rotDir:'same',lay:'woven',mask:'none',maskScale:100,rand:[],jitter:0,size:40,el:30};
  const lay=weaveLayout(g);
  const dentro=[];
  for(let i=0;i<lay.length;i++){ const p=lay[i];
    const c={ id:uid(), mediaId:ids[compMediaIndex(g,p._src!=null?p._src:i,ids.length)], lane:0, start:0, dur:dur, inP:0, props:{}, kf:{},
              anim:compWeaveAnim(g,p).map(a=>Object.assign({},a)) };
    compElProps(g,p); Object.assign(c.props,{x:p.x||0,y:p.y||0,scale:p.scale||1}); dentro.push(c); }
  const nido={ id:uid(), kind:'nest', name:'Tejido', dur:dur, color:'#679', nestClips:dentro,
               nestLanes:[{id:1,name:'V1',tag:'V1',kind:'video'}], comp:g };
  state.media.push(nido);
  const c={ id:uid(), mediaId:nido.id, lane:state.lanes.findIndex(l=>l.kind==='video'), start:0, dur:dur*4,
            inP:0, loop:true, loopLen:dur, props:{}, kf:{} };
  state.clips.push(c); renderTimeline();

  const glc=document.querySelector('#gl');
  const foto=tt=>{ state.playhead=tt; render();
    const cv=document.createElement('canvas'); cv.width=cv.height=200;
    const cx=cv.getContext('2d'); cx.drawImage(glc,0,0,200,200);
    return cx.getImageData(0,0,200,200).data; };
  const dif=(a,b)=>{ let s=0; for(let i=0;i<a.length;i+=4) s+=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]); return Math.round(s/(a.length/4)); };
  const D=0.05;
  const antes=foto(dur-D), despues=foto(dur+D);      /* cruzando el bucle */
  const q1=foto(dur*0.5-D), q2=foto(dur*0.5+D);      /* mismo intervalo, sin cruzar */
  state.clips=state.clips.filter(x=>x.id!==c.id);
  return { dur, cruce:dif(antes,despues), normal:dif(q1,q2) }; })()`);
console.log('duracion del compose hecho con fotos: '+r.dur+' s   (bucle del mismo largo)');
console.log('cambio de imagen en 0,10 s CRUZANDO el bucle: '+r.cruce);
console.log('cambio de imagen en 0,10 s sin cruzarlo:      '+r.normal);
if(r.normal===0&&r.cruce===0) mal('el tejido no se mueve: la prueba no distingue nada');
else if(r.cruce>Math.max(4,r.normal*4)) mal('SALTA al cruzar el bucle: '+r.cruce+' contra '+r.normal+' — es el reinicio que se ve');
console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'la imagen no salta al cruzar el bucle'));
ws.close(); process.exit(fallos?1:0);
