/* [R272] Diagnostico del punto 10. La pista que dio Beltran es que saltan TODOS los clips, no solo el cortado,
   asi que se miran las INSTANCIAS de video (una por clip dibujado) antes y despues del corte: cuantas hay, cuales
   sobreviven, y en que instante quedan. */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise((res,rej)=>{const i=++id;p.set(i,r=>r.error?rej(new Error(JSON.stringify(r.error))):(r.result.exceptionDetails?rej(new Error(r.result.exceptionDetails.exception?.description||r.result.exceptionDetails.text)):res(r.result.result.value)));
  ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true}}));});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const VID='C:/Users/beltr/Desktop/Alma Digital Studio/Code/Alma Digital Portfolio/Asset/Reel Portfolio/Reel Portfolio.mp4';
await ev(`(async()=>{ await newProject('dome',1024,1024,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()`);
await wait(1400);
await ev(`window.__vid=function(ruta,nombre){ return new Promise(res=>{ const url=DSP.toFileURL(ruta); const v=document.createElement("video"); v.preload="metadata"; v.src=url;
  v.addEventListener("loadedmetadata",()=>{ const m={id:uid(),name:nombre,kind:"video",el:v,originalEl:v,srcUrl:url,tex:newTex(),w:v.videoWidth,h:v.videoHeight,dur:v.duration,fps:30,color:'#7A9E7E',proxyReady:false,proxyPct:0,path:ruta,fsize:0,folder:null,missing:false,_loading:false};
    state.media.push(m); renderMedia(); res(m.id); }); v.addEventListener("error",()=>res(null)); }); };1`);
const mid=await ev(`__vid(${JSON.stringify(VID)},"reel.mp4")`);

const r=await ev(`(async function(){
  const m=mediaById(${JSON.stringify(mid)});
  /* un compose de VERDAD, con muchos elementos: es el caso de Beltran */
  createComposition({kind:'ring',mediaIds:[m.id],mediaId:m.id,count:12,el:30,size:40,cols:3,arc:140,
    elMin:10,elMax:60,turns:3,rings:3,segs:8,mask:'none',rand:[],jitter:0,name:'compose'});
  await new Promise(s=>setTimeout(s,600));
  const c=state.clips[state.clips.length-1]; c.dur=12; c.start=0;
  state.selId=c.id; state.selIds=[c.id];
  state.playhead=6; renderTimeline(); await scrubRender(); await new Promise(s=>setTimeout(s,900));
  const foto=()=>{ const o=[]; for(const [cid,vi] of _vinst){ o.push({cid, t:vi.vel?+(vi.vel.currentTime||0).toFixed(3):null, listo:!!vi.ready}); } return o; };
  const antes=foto();
  razorClip(c, 6); await new Promise(s=>setTimeout(s,900));
  const despues=foto();
  const idsAntes=new Set(antes.map(x=>x.cid)), idsDesp=new Set(despues.map(x=>x.cid));
  const sobreviven=[...idsAntes].filter(x=>idsDesp.has(x)).length;
  const enCero=despues.filter(x=>x.t!=null&&x.t<0.05).length;
  const enCeroAntes=antes.filter(x=>x.t!=null&&x.t<0.05).length;
  return { nAntes:antes.length, nDesp:despues.length, sobreviven, enCeroAntes, enCero,
           muestraAntes:antes.slice(0,4), muestraDesp:despues.slice(0,4), clips:state.clips.length,
           tope:(typeof VINST_MAX!=='undefined')?VINST_MAX:'?' }; })()`);
console.log('instancias de video: '+r.nAntes+' antes -> '+r.nDesp+' despues   (tope '+r.tope+')');
console.log('   sobreviven al corte: '+r.sobreviven+'   clips en la linea de tiempo: '+r.clips);
console.log('   instancias en el fotograma 0:  antes '+r.enCeroAntes+'  ·  despues '+r.enCero);
console.log('   muestra antes  : '+JSON.stringify(r.muestraAntes));
console.log('   muestra despues: '+JSON.stringify(r.muestraDesp));
ws.close();
