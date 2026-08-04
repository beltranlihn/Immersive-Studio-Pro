/* [R247c] Cuanto encoge el ojo de pez el plano 1:1, y que tamano hay que darle al clip anfitrion para que el
   tejido siga llenando el domo hasta el borde. Mide pixeles negros en el ANILLO exterior del disco (r 0.90-0.99),
   que es justo donde se nota el encogimiento. Sin acentos graves dentro de las plantillas. */
import http from 'http';
const PORT=process.argv[2]||9222;
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:PORT,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:120000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));

/* el visor por defecto esta al 92% de zoom: sin esto el anillo exterior cae FUERA del disco y sale 60% de negro
   que no es del tejido sino del fondo del visor (trampa del arnes, ya me la comi una vez) */
await ev(`state.view.zoom=1; state.view.pan=[0,0]; resize(); render(); 1`); await wait(300);
await ev(`window.__anillo=function(){ const S=Math.min(glc.width,glc.height), sx=(glc.width-S)/2, sy=(glc.height-S)/2;
  const cv=document.createElement('canvas'); cv.width=cv.height=400; const g=cv.getContext('2d');
  g.drawImage(glc, sx,sy,S,S, 0,0,400,400); const d=g.getImageData(0,0,400,400).data;
  let dentro=0,negro=0;
  for(let y=0;y<400;y++)for(let x=0;x<400;x++){ const dx=x-199.5,dy=y-199.5,r=Math.hypot(dx,dy)/199.5;
    if(r<0.90||r>0.99)continue; dentro++; const i=(y*400+x)*4; if(d[i]<12&&d[i+1]<12&&d[i+2]<12)negro++; }
  return +(negro/Math.max(1,dentro)*100).toFixed(1); };1`);

const host=async()=>ev(`(function(){ const c=state.clips.find(c=>{const m=mediaById(c.mediaId);return m&&m.kind==='nest';}); return c?c.id:null; })()`);
console.log('ojo de pez   tamano   negro en el anillo exterior');
for(const fish of [0,35,50,70]){
  await ev(`(function(){ state.clips=[]; state.media=state.media.filter(m=>m.kind!=='nest');
    const ids=__fuentes();
    createComposition({kind:'weave',mediaIds:ids,bands:5,weaveMode:'weave',fit:'across',density:1,speed:0.1,alternate:true,interlace:true,fish:${fish}});
    return 1; })()`);
  await wait(500);
  const linea=[];
  for(const sz of [55,62,70,78,86]){
    const v=await ev(`(function(){ const c=state.clips.find(c=>{const m=mediaById(c.mediaId);return m&&m.kind==='nest';});
      if(!c)return -1; c.props.size=${sz}; _previewClock=0; render(); return __anillo(); })()`);
    linea.push(String(sz).padStart(3)+':'+String(v).padStart(5)+'%');
  }
  console.log(String(fish).padStart(6)+'%      '+linea.join('   '));
}
ws.close();
