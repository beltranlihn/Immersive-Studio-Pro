/* [R272] Punto 10, con el sintoma bien acotado por Beltran: es SOLO visual, en el visor, y el play lo arregla.
   Eso es exactamente "se dibuja antes de colocar el video". La mitad DERECHA del corte nace con identificador
   nuevo, asi que su instancia de video nace sin posicionar y el visor la pinta en su fotograma 0.
   Se mide el instante en el que queda esa instancia justo despues de cortar, sin dar play. */
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

const r=await ev(`(async function(){
  const m=mediaById(${JSON.stringify(mid)});
  state.clips=[]; const c=makeClip(m,state.lanes.findIndex(l=>l.kind==='video'),0); c.dur=20; c.inP=0; state.clips.push(c);
  state.selId=c.id; state.selIds=[c.id];
  /* el cabezal en 12 s: bien dentro de la MITAD DERECHA de un corte hecho en 8 */
  state.playhead=12; renderTimeline(); await scrubRender(); await new Promise(s=>setTimeout(s,800));
  const idIzq=c.id;
  const antes=(function(){ const vi=_vinst.get(idIzq); return vi&&vi.vel?+(vi.vel.currentTime||0).toFixed(3):null; })();
  razorClip(c, 8);
  /* SIN play y sin esperar de mas: lo que el visor pinta justo despues del corte */
  await new Promise(s=>setTimeout(s,450));
  const dch=state.clips.find(x=>x.id!==idIzq);
  const vi=dch?_vinst.get(dch.id):null;
  const tDch=vi&&vi.vel?+(vi.vel.currentTime||0).toFixed(3):null;
  const esperado=dch?+(srcT(dch,state.playhead)).toFixed(3):null;
  return { antes, clips:state.clips.length, hayInstancia:!!vi, tDerecha:tDch, esperado,
           listo:vi?!!vi.ready:null }; })()`);
console.log('antes de cortar, el clip estaba en '+r.antes+' s');
console.log('tras cortar en 8 con el cabezal en 12:');
console.log('   clips: '+r.clips+'   instancia para la mitad derecha: '+r.hayInstancia);
console.log('   esa instancia esta en: '+r.tDerecha+' s   ·  deberia estar en: '+r.esperado+' s   ·  lista: '+r.listo);
if(r.clips!==2) mal('el corte no partio el clip');
if(!r.hayInstancia) mal('la mitad derecha no tiene instancia de video: el visor la pinta vacia');
else if(r.tDerecha==null) mal('no se pudo leer el instante');
else if(Math.abs(r.tDerecha-r.esperado)>0.2) mal('la mitad derecha esta en '+r.tDerecha+' en vez de '+r.esperado+' — el visor la pinta en su fotograma 0');
console.log('\n'+(fallos?'*** '+fallos+' FALLOS (el glitch esta presente)':'la mitad nueva nace ya colocada: sin salto en el visor'));
ws.close();
