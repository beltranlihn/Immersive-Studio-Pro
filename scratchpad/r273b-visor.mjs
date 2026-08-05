/* [R273] Punto 7, medido DE PUNTA A PUNTA: lo que el visor dibuja. La sonda anterior evaluaba el interior del
   nido FUERA del momento en que se aplica su reloj, asi que no podia ver la diferencia.
   Un tunel dentro de un clip en bucle de 2 s extendido a 10. El diente de sierra dura 3,33 s, asi que no coincide
   con el bucle: si el efecto se reinicia, la imagen de la vuelta 2 sera IDENTICA a la de la vuelta 1. */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise((res,rej)=>{const i=++id;p.set(i,r=>r.error?rej(new Error(JSON.stringify(r.error))):(r.result.exceptionDetails?rej(new Error(r.result.exceptionDetails.exception?.description||r.result.exceptionDetails.text)):res(r.result.result.value)));
  ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true}}));});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let fallos=0; const mal=m=>{ console.log('   *** '+m); fallos++; };
const VID='C:/Users/beltr/Desktop/Alma Digital Studio/Code/Alma Digital Portfolio/Asset/Reel Portfolio/Reel Portfolio.mp4';
await ev(`(async()=>{ await newProject('dome',1024,1024,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()`);
await wait(1400);
await ev(`window.__vid=function(ruta,nombre){ return new Promise(res=>{ const url=DSP.toFileURL(ruta); const v=document.createElement("video"); v.preload="metadata"; v.src=url;
  v.addEventListener("loadedmetadata",()=>{ const m={id:uid(),name:nombre,kind:"video",el:v,originalEl:v,srcUrl:url,tex:newTex(),w:v.videoWidth,h:v.videoHeight,dur:v.duration,fps:30,color:'#7A9E7E',proxyReady:false,proxyPct:0,path:ruta,fsize:0,folder:null,missing:false,_loading:false};
    state.media.push(m); renderMedia(); res(m.id); }); v.addEventListener("error",()=>res(null)); }); };1`);
const mid=await ev(`__vid(${JSON.stringify(VID)},"reel.mp4")`);
await ev(`window.__firma=function(){ const px=new Uint8Array(glc.width*glc.height*4);
  gl.bindFramebuffer(gl.FRAMEBUFFER,null); gl.readPixels(0,0,glc.width,glc.height,gl.RGBA,gl.UNSIGNED_BYTE,px);
  let s=0,n=0; for(let i=0;i<px.length;i+=4*613){ s+=px[i]*3+px[i+1]*5+px[i+2]*7; n++; }
  return Math.round(s/Math.max(1,n)*100)/100; };1`);

const r=await ev(`(async function(){
  const m=mediaById(${JSON.stringify(mid)});
  createComposition({kind:'tunnel',mediaIds:[m.id],mediaId:m.id,count:6,sizeFrom:1,sizeTo:200,speed:0.3,curve:0,
                     twist:0,helix:0,el:30,size:40,cols:3,arc:140,mask:'none',rand:[],jitter:0,name:'tunel'});
  await new Promise(s=>setTimeout(s,700));
  const c=state.clips[state.clips.length-1];
  c.start=0; c.dur=10; c.inP=0; state.selId=c.id; state.selIds=[c.id];
  toggleLoop(c); setLoopRange(c,2); c.dur=10; renderTimeline();
  const firmas=[];
  for(let k=0;k<12;k++){ const tt=k*0.5; state.playhead=tt; await scrubRender(); await new Promise(s=>setTimeout(s,220)); firmas.push(__firma()); }
  return { firmas, loopLen:c.loopLen }; })()`);
console.log('firma de lo que dibuja el visor, cada 0,5 s (bucle de '+r.loopLen+' s, sierra de 3,33 s):');
const f=r.firmas;
const v1=f.slice(0,4), v2=f.slice(4,8), v3=f.slice(8,12);
console.log('   vuelta 1: '+v1.join('  '));
console.log('   vuelta 2: '+v2.join('  '));
console.log('   vuelta 3: '+v3.join('  '));
const igual=(a,b)=>a.every((x,i)=>Math.abs(x-b[i])<0.5);
if(f.every(x=>Math.abs(x-f[0])<0.5)) mal('el visor dibuja siempre lo mismo: la prueba no discrimina');
else if(igual(v1,v2)&&igual(v2,v3)) mal('el efecto se REINICIA en cada vuelta: las tres vueltas dibujan lo mismo');
else console.log('   -> las vueltas dibujan cosas distintas: el efecto sigue corriendo');
console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'el compose loopeado es continuo'));
ws.close();
