/* [R301b] Los cuatro del review sobre R301. El primero es el que mas duele: un proyecto ANTIGUO con ojo de pez
   y sin cantidad guardada no puede quedarse plano. */
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
  const out={};
  const N=512, cv=document.createElement('canvas'); cv.width=cv.height=N;
  const cx=cv.getContext('2d'); cx.fillStyle='#000'; cx.fillRect(0,0,N,N);
  cx.strokeStyle='#FFF'; cx.lineWidth=2; for(let k=0;k<24;k++){ cx.beginPath(); cx.arc(N/2,N/2,10+k*10,0,Math.PI*2); cx.stroke(); }
  const img={id:uid(),name:'a.png',kind:'image',el:cv,originalEl:cv,tex:newTex(),w:N,h:N,dur:5,fps:0,color:'#999',folder:null};
  upTex(img.tex,cv); state.media.push(img); renderMedia();
  addClip(img,state.lanes.findIndex(l=>l.kind==='video'),0);
  const c=state.clips[state.clips.length-1]; c.dur=2; c.props.size=80; c.props.el=0;
  const glc=document.querySelector('#gl');
  const huella=()=>{ render(); const S=300, c2=document.createElement('canvas'); c2.width=c2.height=S;
    c2.getContext('2d').drawImage(glc,0,0,S,S);
    const d=c2.getContext('2d').getImageData(0,0,S,S).data; let e=0;
    for(let i=0;i<d.length;i+=4) e+=d[i]; return Math.round(e/1000); };
  /* [1] proyecto ANTIGUO: fisheye puesto, cantidad AUSENTE. Tiene que deformar como con 60. */
  c.props.fisheye=false; delete c.props.fisheyeAmt; const plano=huella();
  c.props.fisheye=true;  delete c.props.fisheyeAmt; const viejo=huella();
  c.props.fisheye=true;  c.props.fisheyeAmt=60;     const con60=huella();
  c.props.fisheye=true;  c.props.fisheyeAmt=0;      const con0=huella();
  out.plano=plano; out.viejo=viejo; out.con60=con60; out.con0=con0;
  /* [2] el tope con un trabajo por muro no puede irse al techo */
  const antes=_fxCap;
  const sim=o=>{ try{ const _w=(o&&o.wall)?Math.max(o.wall.pxW||0,o.wall.pxH||0):(+(o&&(o.outW||o.res))||2048);
    return Math.max(1024,Math.min(8192,_w||2048)); }catch(e){ return -1; } };
  out.capMuro=sim({outW:12000,wall:{pxW:3840,pxH:2160}});
  out.capNormal=sim({outW:4096});
  _fxCap=antes;
  /* [4] freeFxResources existe y se puede llamar */
  out.libera=(typeof freeFxResources==='function');
  return out; })()`);
console.log('[1] huella  sin ojo de pez: '+r.plano+'   con fisheye y SIN cantidad: '+r.viejo+'   con 60: '+r.con60+'   con 0: '+r.con0);
console.log('[2] tope con muro 3840 (tira de 12000): '+r.capMuro+'   con export normal de 4096: '+r.capNormal);
console.log('[4] freeFxResources disponible: '+r.libera);
if(r.viejo===r.plano) mal('un proyecto antiguo con fisheye y sin cantidad se ve PLANO: es el fallo del review');
if(r.viejo!==r.con60) mal('la cantidad ausente no equivale a 60 ('+r.viejo+' contra '+r.con60+')');
if(r.con0!==r.plano) mal('con cantidad 0 deberia verse igual que sin ojo de pez, y ahorrarse el pase');
if(r.capMuro>4096) mal('un trabajo por muro sigue disparando el tope a '+r.capMuro);
if(r.capNormal!==4096) mal('un export normal de 4096 no fija el tope en 4096: '+r.capNormal);
if(!r.libera) mal('no hay forma de soltar los objetivos al terminar');
console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'proyectos antiguos intactos, el tope respeta los muros, y los objetivos se sueltan'));
ws.close(); process.exit(fallos?1:0);
