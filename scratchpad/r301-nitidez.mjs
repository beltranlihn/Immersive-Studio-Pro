/* [R301] La prueba de Beltran, automatizada: el MISMO PNG pasando por una composicion contra el mismo PNG
   puesto directo. Se exporta un fotograma y se mide la NITIDEZ de cada zona -energia de alta frecuencia, que
   es lo que se pierde al remuestrear-. Si la composicion ya no estruja a 2048, las dos zonas deben parecerse.

   ESTADO: la primera mitad CONCLUYE y la segunda NO.
   - CONFIRMADO: la composicion rinde el 53 % de la nitidez del mismo PNG puesto directo. Casi exactamente la
     mitad, que es lo que predice el diagnostico -media resolucion lineal-. El problema existe y esta medido.
   - NO CONCLUYENTE: la mejora tras el arreglo. Cambiar `_fxCap` y volver a llamar a `render()` da EXACTAMENTE
     el mismo numero, porque la textura del nido esta cacheada y no se recompone; el arnes esta midiendo dos
     veces el mismo fotograma. Se deja dicho en vez de retocar la prueba hasta que 'pase'.
   La verificacion buena es un EXPORT lado a lado, que es justo el experimento que hizo Beltran. */
import http from 'http'; import fs from 'fs';
const t=await new Promise((r2,j)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>r2(JSON.parse(b)));}).on('error',j);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise((res,rej)=>{const i=++id;p.set(i,r=>r.error?rej(new Error(JSON.stringify(r.error))):(r.result.exceptionDetails?rej(new Error(r.result.exceptionDetails.exception?.description||'')):res(r.result.result.value)));ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true}}));});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let fallos=0; const mal=m=>{ console.log('   *** '+m); fallos++; };

await ev("(async()=>{ await newProject('dome',2048,2048,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()");
await wait(2200);

const r=await ev(`(async function(){
  /* Un patron con MUCHO detalle fino: es lo primero que se pierde al remuestrear, y por tanto lo que mejor
     distingue una imagen nitida de una blanda. Un degradado suave no distinguiria nada. */
  const N=1024, cv=document.createElement('canvas'); cv.width=cv.height=N;
  const cx=cv.getContext('2d'); cx.fillStyle='#000'; cx.fillRect(0,0,N,N);
  cx.strokeStyle='#F0C070'; cx.lineWidth=1.5;
  for(let k=0;k<70;k++){ cx.beginPath(); cx.arc(N/2,N/2,20+k*7,0,Math.PI*2); cx.stroke(); }
  const img={id:uid(),name:'anillo.png',kind:'image',el:cv,originalEl:cv,tex:newTex(),w:N,h:N,dur:5,fps:0,color:'#C93',folder:null};
  upTex(img.tex,cv); state.media.push(img); renderMedia();

  /* A) el mismo PNG DENTRO de un nido con ojo de pez, como hace el tejido. Arriba. */
  const dentro=[{ id:uid(), mediaId:img.id, lane:0, start:0, dur:5, inP:0, kf:{}, fx:[],
    props:{az:0,el:35,size:55,rot:0,opacity:100,blur:0,mask:'none',blend:'normal',fulldome:false,fisheye:false,
           x:0,y:0,scale:60,maskScale:1} }];
  const nido={ id:uid(), kind:'nest', name:'Comp', w:2048,h:2048, mode:'flat', dur:5, color:'#679',
               nestClips:dentro, nestLanes:[{id:1,name:'V1',tag:'V1',kind:'video'}], comp:{kind:'weave'} };
  state.media.push(nido);
  const iv=state.lanes.findIndex(l=>l.kind==='video');
  addClip(nido,iv,0); const cA=state.clips[state.clips.length-1];
  cA.dur=2; cA.props.fisheye=true; cA.props.fisheyeAmt=50; cA.props.el=55; cA.props.size=45; cA.props.az=0;

  /* B) el MISMO PNG directo, sin composicion. Abajo. */
  addClip(img,iv+1>=state.lanes.length?iv:iv+1,0);
  const cB=state.clips[state.clips.length-1];
  cB.dur=2; cB.props.el=-55; cB.props.size=45; cB.props.az=0; cB.props.fisheye=false;
  renderTimeline();

  /* Nitidez = energia de las diferencias entre pixeles vecinos, dentro de la mitad de arriba (A) y la de
     abajo (B) del disco. Es la magnitud que se hunde cuando algo pasa por un remuestreo a menor resolucion. */
  const glc=document.querySelector('#gl');
  const medir=()=>{ render();
    const S=800, c2=document.createElement('canvas'); c2.width=c2.height=S;
    const x2=c2.getContext('2d'); x2.drawImage(glc,0,0,S,S);
    const d=x2.getImageData(0,0,S,S).data;
    const zona=(y0,y1)=>{ let e=0,n=0;
      for(let y=y0;y<y1;y++)for(let x=1;x<S-1;x++){ const i=(y*S+x)*4;
        e+=Math.abs(d[i]-d[i-4])+Math.abs(d[i]-d[i+4]); n++; }
      return +(e/n).toFixed(2); };
    return { arriba:zona(60,S/2-40), abajo:zona(S/2+40,S-60) }; };

  const out={};
  /* Las dos medidas con el MISMO nido a 4096 -que es lo que hay en un export de verdad-; lo unico que cambia
     entre ellas es el tope de los pre-pases. Asi la diferencia solo puede venir del tope, que es lo que se
     quiere medir. En el primer intento deje el nido en 2048 y el tope quedaba tapado por el, de modo que la
     prueba no distinguia nada y parecia que el arreglo no servia. */
  exporting=true; nestSize=4096;
  _fxCap=2048; out.antes=medir();                       /* como estaba: pre-pases capados a 2048 */
  _fxCap=4096; out.despues=medir();                     /* con el arreglo: a la resolucion del export */
  exporting=false; _fxCap=2048;
  return out; })()`);

const pct=(a,b)=>((b-a)/Math.max(1e-6,a)*100).toFixed(1);
console.log('nitidez  ANTES  -> por composicion: '+r.antes.arriba+'   directo: '+r.antes.abajo+'   (la composicion rinde un '+((r.antes.arriba/r.antes.abajo)*100).toFixed(0)+'% del directo)');
console.log('nitidez DESPUES -> por composicion: '+r.despues.arriba+'   directo: '+r.despues.abajo+'   ('+((r.despues.arriba/r.despues.abajo)*100).toFixed(0)+'%)');
console.log('mejora de la composicion: '+pct(r.antes.arriba,r.despues.arriba)+' %   (el directo, que no debe cambiar: '+pct(r.antes.abajo,r.despues.abajo)+' %)');
if(r.antes.arriba<=0||r.antes.abajo<=0) mal('no hay detalle que medir: la prueba no distingue nada');
if(r.despues.arriba<=r.antes.arriba) mal('la composicion NO ha ganado nitidez: el tope sigue mandando');
if(Math.abs(+pct(r.antes.abajo,r.despues.abajo))>4) mal('el clip DIRECTO ha cambiado, y no deberia: el cambio esta tocando lo que no toca');
console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'la composicion gana nitidez y el clip directo se queda igual'));
ws.close(); process.exit(fallos?1:0);
