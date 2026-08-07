/* [R305] El ojo de pez plegado. El criterio NO es "se parece": es IDENTIDAD. Se dibuja el mismo clip por los
   dos caminos -pase aparte y plegado- y se comparan pixeles. Y ademas tiene que GANAR nitidez, que es para lo
   que se hace: el camino viejo pasa por una textura intermedia y el nuevo no. */
import http from 'http';
const t=await new Promise((r2,j)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>r2(JSON.parse(b)));}).on('error',j);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise((res,rej)=>{const i=++id;p.set(i,r=>r.error?rej(new Error(JSON.stringify(r.error))):(r.result.exceptionDetails?rej(new Error(r.result.exceptionDetails.exception?.description||'')):res(r.result.result.value)));ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true}}));});
let fallos=0; const mal=m=>{ console.log('   *** '+m); fallos++; };
await ev("(async()=>{ await newProject('dome',2048,2048,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()");
await new Promise(r=>setTimeout(r,2200));
const r=await ev(`(function(){
  const N=2048, cv=document.createElement('canvas'); cv.width=cv.height=N;
  const cx=cv.getContext('2d'); cx.fillStyle='#000'; cx.fillRect(0,0,N,N);
  cx.strokeStyle='#F0C070'; cx.lineWidth=3;
  for(let k=0;k<90;k++){ cx.beginPath(); cx.arc(N/2,N/2,14+k*11,0,Math.PI*2); cx.stroke(); }
  cx.fillStyle='#6CF'; for(let k=0;k<40;k++)cx.fillRect((k*53)%N,(k*97)%N,26,26);
  const img={id:uid(),name:'a.png',kind:'image',el:cv,originalEl:cv,tex:newTex(),w:N,h:N,dur:5,fps:0,color:'#C93',folder:null};
  upTex(img.tex,cv); mipTex(img.tex,N,N); state.media.push(img); renderMedia();
  addClip(img,state.lanes.findIndex(l=>l.kind==='video'),0);
  const c=state.clips[state.clips.length-1];
  c.dur=3; c.props.fulldome=true; c.props.fisheye=true; c.props.fisheyeAmt=50; c.props.size=100; c.props.el=0; c.props.az=0;
  state.playhead=0.5;
  const glc=document.querySelector('#gl');
  const foto=()=>{ render(); const S=700, c2=document.createElement('canvas'); c2.width=c2.height=S;
    c2.getContext('2d').drawImage(glc,0,0,S,S); return c2.getContext('2d').getImageData(0,0,S,S).data; };
  const nitido=d=>{ let e=0,n=0; const S=700;
    for(let y=1;y<S-1;y++)for(let x=1;x<S-1;x++){ const i=(y*S+x)*4; e+=Math.abs(d[i]-d[i-4]); n++; } return +(e/n).toFixed(3); };
  /* PLEGADO (lo nuevo) */
  const A=foto();
  /* PASE APARTE (lo de antes): se fuerza anadiendo una clave de negro inocua, que es lo que impide plegar */
  c.props.blackKey=true; c.props.blackKeyAmt=0; c.props.blackKeySoft=0;
  const B=foto();
  c.props.blackKey=false;
  let dif=0,vivos=0; for(let i=0;i<A.length;i+=4){ dif+=Math.abs(A[i]-B[i]); if(A[i]>25)vivos++; }
  return { dif:+(dif/(A.length/4)).toFixed(2), vivos, nA:nitido(A), nB:nitido(B) }; })()`);
console.log('pixeles con imagen: '+r.vivos);
console.log('diferencia media entre plegado y pase aparte: '+r.dif);
console.log('nitidez  plegado: '+r.nA+'   pase aparte: '+r.nB);
if(r.vivos<3000) mal('apenas hay imagen: la prueba no compara nada');
if(r.dif>6) mal('los dos caminos NO dan lo mismo (diferencia '+r.dif+'): el aspecto cambiaria');
if(r.nA<=r.nB) mal('el plegado no gana nitidez ('+r.nA+' contra '+r.nB+'), que es para lo que se hace');
else console.log('   ganancia de nitidez: '+((r.nA/r.nB-1)*100).toFixed(1)+' %');
console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'el plegado da lo mismo que el pase aparte y con mas detalle'));
ws.close(); process.exit(fallos?1:0);
