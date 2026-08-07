/* [R302] Que los mipmaps hagan lo que prometen: menos hormigueo al dibujar una imagen MAS PEQUENA que su
   tamano original. Se mide la diferencia entre dos fotogramas casi identicos -el mismo clip desplazado medio
   pixel-: sin mipmaps, ese medio pixel hace que el muestreo caiga en texels distintos y la imagen "hierve";
   con mipmaps promedia y la diferencia baja. Es el aliasing, medido en vez de mirado. */
import http from 'http';
const t=await new Promise((r2,j)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>r2(JSON.parse(b)));}).on('error',j);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise((res,rej)=>{const i=++id;p.set(i,r=>r.error?rej(new Error(JSON.stringify(r.error))):(r.result.exceptionDetails?rej(new Error(r.result.exceptionDetails.exception?.description||'')):res(r.result.result.value)));ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true}}));});
let fallos=0; const mal=m=>{ console.log('   *** '+m); fallos++; };
await ev("(async()=>{ await newProject('dome',2048,2048,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()");
await new Promise(r=>setTimeout(r,2200));
const r=await ev(`(async function(){
  let out0=0;
  /* Imagen GRANDE con detalle fino, dibujada PEQUENA: la minificacion es donde los mipmaps trabajan. */
  const N=2048, cv=document.createElement('canvas'); cv.width=cv.height=N;
  const cx=cv.getContext('2d'); cx.fillStyle='#000'; cx.fillRect(0,0,N,N);
  cx.strokeStyle='#F0C070'; cx.lineWidth=2;
  for(let k=0;k<180;k++){ cx.beginPath(); cx.arc(N/2,N/2,8+k*5.5,0,Math.PI*2); cx.stroke(); }
  const mk=()=>{ const m={id:uid(),name:'a.png',kind:'image',el:cv,originalEl:cv,tex:newTex(),w:N,h:N,dur:5,fps:0,color:'#C93',folder:null};
    upTex(m.tex,cv); state.media.push(m); return m; };
  const sinMip=mk();                       /* como estaba */
  const conMip=mk(); mipTex(conMip.tex);   /* con el arreglo */
  renderMedia();
  const iv=state.lanes.findIndex(l=>l.kind==='video');
  addClip(sinMip,iv,0); const c=state.clips[state.clips.length-1];
  c.dur=3; c.props.size=35; c.props.el=0; c.props.az=0;
  state.playhead=0.5; render();
  /* PRIMERO comprobar que hay imagen. La vez anterior el brillo medio salio 0 -no se dibujaba nada- y el
     '78 % menos de aliasing' era ruido dividido entre ruido. Una prueba que mide la nada aprueba cualquier cosa. */
  { const S=420,c2=document.createElement('canvas'); c2.width=c2.height=S;
    c2.getContext('2d').drawImage(document.querySelector('#gl'),0,0,S,S);
    const d=c2.getContext('2d').getImageData(0,0,S,S).data; let vivos=0;
    for(let i=0;i<d.length;i+=4) if(d[i]>30)vivos++;
    /* Se CUENTAN pixeles con imagen en vez de promediar: el material son anillos finos sobre negro, asi que el
       brillo medio es bajo por diseno y umbralarlo declaraba invisible algo que si estaba. */
    if(vivos<400)return {err:'el clip no se dibuja (solo '+vivos+' pixeles con imagen): no hay nada que medir'};
    out0=vivos; }
  const glc=document.querySelector('#gl');
  const foto=()=>{ render(); const S=420, c2=document.createElement('canvas'); c2.width=c2.height=S;
    c2.getContext('2d').drawImage(glc,0,0,S,S);
    return c2.getContext('2d').getImageData(0,0,S,S).data; };
  /* Hervor = cuanto cambia la imagen ante un desplazamiento minusculo. Menos es mejor. */
  const hervor=()=>{ c.props.az=0; const a=foto(); c.props.az=0.06; const b=foto(); c.props.az=0;
    let s=0; for(let i=0;i<a.length;i+=4) s+=Math.abs(a[i]-b[i]); return +(s/(a.length/4)).toFixed(2); };
  const antes=hervor();
  c.mediaId=conMip.id; const despues=hervor();
  /* y que la imagen siga estando: unos mipmaps mal hechos la dejarian gris */
  const brillo=()=>{ const d=foto(); let s=0; for(let i=0;i<d.length;i+=4)s+=d[i]; return Math.round(s/(d.length/4)); };
  c.mediaId=sinMip.id; const bA=brillo(); c.mediaId=conMip.id; const bB=brillo();
  return { antes, despues, bA, bB, aniso:_anisoMax, vivos:out0 }; })()`);
if(r.err){ console.log('*** '+r.err); process.exit(1); }
console.log('pixeles con imagen en el cuadro: '+r.vivos);
console.log('anisotropico maximo de la tarjeta: '+r.aniso);
console.log('hervor al mover medio pixel  SIN mipmaps: '+r.antes+'   CON mipmaps: '+r.despues);
console.log('brillo medio  sin: '+r.bA+'   con: '+r.bB+'   (no debe desplomarse: seria una imagen lavada)');
if(r.antes<=0.02) mal('apenas hay aliasing que reducir: la prueba no distingue nada');
if(r.despues>=r.antes) mal('los mipmaps no reducen el hervor ('+r.antes+' -> '+r.despues+')');
else console.log('   reduccion del aliasing: '+((1-r.despues/r.antes)*100).toFixed(0)+' %');
if(r.bA>2&&Math.abs(r.bB-r.bA)>r.bA*0.45) mal('el brillo cambia demasiado: los mipmaps estan lavando la imagen');
console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'los mipmaps reducen el aliasing sin lavar la imagen'));
ws.close(); process.exit(fallos?1:0);
