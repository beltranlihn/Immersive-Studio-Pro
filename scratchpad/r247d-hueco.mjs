import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:60000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
await ev(`state.view.zoom=1; state.view.pan=[0,0]; resize(); render(); 1`); await wait(300);
/* mide el VACIO de verdad: alfa 0 en el master del nido, no negro en pantalla (las fuentes llevan trazo negro) */
await ev(`window.__vacio=function(){ const S=Math.min(glc.width,glc.height), sx=(glc.width-S)/2, sy=(glc.height-S)/2;
  const cv=document.createElement('canvas'); cv.width=cv.height=300; const g=cv.getContext('2d');
  g.fillStyle='#FF00FF'; g.fillRect(0,0,300,300);          // fondo magenta: lo que quede magenta es hueco real
  g.drawImage(glc, sx,sy,S,S, 0,0,300,300); const d=g.getImageData(0,0,300,300).data;
  let dentro=0,hueco=0;
  for(let y=0;y<300;y++)for(let x=0;x<300;x++){ const dx=x-149.5,dy=y-149.5; if(Math.hypot(dx,dy)>140)continue;
    dentro++; const i=(y*300+x)*4; if(d[i]>200&&d[i+1]<60&&d[i+2]>200)hueco++; }
  return +(hueco/dentro*100).toFixed(1); };1`);
console.log('ancho de tira → hueco transparente dentro del disco');
for(const bw of [100,80,60,40,25]){
  await ev(`__monta({bands:5,weaveMode:'weave',bandW:${bw},fit:'across',density:1,speed:0.1,speedV:0.1,motion:'alternate',interlace:true})`);
  await wait(400); await ev(`__grab(1.2)`);
  console.log('  '+String(bw).padStart(4)+'%  →  '+await ev(`__vacio()`)+'%');
}
console.log('\nlineas paralelas (sin tejido):');
for(const [b,bw] of [[2,30],[4,50],[8,70]]){
  await ev(`__monta({bands:${b},weaveMode:'h',bandW:${bw},fit:'across',density:1,speed:0.1,motion:'same',interlace:false})`);
  await wait(400); await ev(`__grab(1.2)`);
  console.log('  '+b+' lineas al '+String(bw).padStart(3)+'%  →  hueco '+await ev(`__vacio()`)+'%');
}
await ev(`state.view.zoom=0.92; render();1`);
ws.close();
