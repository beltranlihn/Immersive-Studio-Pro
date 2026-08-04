import http from 'http';
const PORT=9222;
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:PORT,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:60000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
await ev(`state.view.zoom=1; state.view.pan=[0,0]; resize(); render(); 1`); await wait(300);
await ev(`window.__anillo=function(r0,r1){ const S=Math.min(glc.width,glc.height), sx=(glc.width-S)/2, sy=(glc.height-S)/2;
  const cv=document.createElement('canvas'); cv.width=cv.height=400; const g=cv.getContext('2d');
  g.drawImage(glc, sx,sy,S,S, 0,0,400,400); const d=g.getImageData(0,0,400,400).data;
  let dentro=0,negro=0;
  for(let y=0;y<400;y++)for(let x=0;x<400;x++){ const dx=x-199.5,dy=y-199.5,r=Math.hypot(dx,dy)/199.5;
    if(r<r0||r>r1)continue; dentro++; const i=(y*400+x)*4; if(d[i]<10&&d[i+1]<10&&d[i+2]<10)negro++; }
  return +(negro/Math.max(1,dentro)*100).toFixed(1); };1`);
console.log('estado actual (tejido con imagenes reales, fish 50):');
for(const [a,b] of [[0.0,0.5],[0.5,0.8],[0.8,0.92],[0.92,0.985]])
  console.log('  anillo r '+a+'-'+b+' → negro '+await ev(`__anillo(${a},${b})`)+'%');
console.log('\ncon fuentes OPACAS y varios tamanos del anfitrion:');
await ev(`(function(){ state.clips=[]; state.media=state.media.filter(m=>m.kind!=='nest'); __opacas();
  const ids=state.media.filter(m=>m.kind==='image').map(m=>m.id);
  createComposition({kind:'weave',mediaIds:ids,bands:5,weaveMode:'weave',fit:'across',density:1,speed:0.1,alternate:true,interlace:true,fish:50}); return 1; })()`);
await wait(600);
for(const sz of [55,60,66,72,80]){
  const v=await ev(`(function(){ const c=state.clips.find(c=>{const m=mediaById(c.mediaId);return m&&m.kind==='nest';});
    c.props.size=${sz}; _previewClock=0; render(); return __anillo(0.92,0.985); })()`);
  console.log('  size '+String(sz).padStart(3)+' → negro en el borde '+v+'%');
}
await ev(`state.view.zoom=0.92; render();1`);
ws.close();
