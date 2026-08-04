/* [R236] El composite se dimensiona con el lienzo: «Full» debe dar resolución 1:1, sin submuestreo. */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:60000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const out={};
await ev(`window.__errs=[];addEventListener('error',e=>__errs.push(String(e.message||e)));
 const ce=console.error;console.error=function(){try{__errs.push('con: '+[...arguments].map(String).join(' '));}catch(_){}return ce.apply(console,arguments);};
 localStorage.removeItem('ispRoomVp');1`);

const mide=async()=>ev(`(function(){ const A=(state.seqW||1)/(state.seqH||1);
  const bw=compSize, bh=compSize/A;
  return { lienzo:[state.seqW,state.seqH], compSize, calidad:state.previewQuality||1,
    bandaTexels:[Math.round(bw),Math.round(bh)],
    submuestreoH:+(state.seqW/bw).toFixed(2), submuestreoV:+(state.seqH/bh).toFixed(2),
    vramMB:+((compSize*compSize*4)/1048576).toFixed(0) }; })()`);

/* sala 7196x912, el caso de Beltrán */
await ev(`state.dirty=false;1`);
await ev(`(async()=>{try{await startDemoProject('room');}catch(e){window.__d=String(e);}})()`); await wait(2600);
await ev(`(function(){try{if(typeof _tourStop==='function')_tourStop();const o=document.getElementById('tourOv');if(o)o.remove();}catch(e){}
 document.querySelector('#viewModeSeg button[data-v="2d"]').click(); resize(); return 1;})()`); await wait(700);
await ev(`(function(){ const as=activeSeq();
  applyRoomGeometry({walls:as.room.walls.map((w,i)=>({role:w.role,order:i+1,wcm:w.wcm,hcm:w.hcm,pxW:1799,pxH:912})),floor:null,fps:60}); return 1; })()`); await wait(800);
await ev(`applyPreviewQuality(1); render(); 1`); await wait(400);
out.sala_Full = await mide();
await ev(`applyPreviewQuality(0.5); render(); 1`); await wait(300);
out.sala_Media = await mide();
await ev(`applyPreviewQuality(0.25); render(); 1`); await wait(300);
out.sala_Cuarto = await mide();
await ev(`applyPreviewQuality(1); render(); 1`); await wait(400);

/* que el domo y el 2D plano sigan bien */
for(const fmt of ['dome','flat']){
  await ev(`state.dirty=false;1`);
  await ev(`(async()=>{try{await startDemoProject('${fmt}');}catch(e){window.__d=String(e);}})()`); await wait(2500);
  await ev(`(function(){try{if(typeof _tourStop==='function')_tourStop();const o=document.getElementById('tourOv');if(o)o.remove();}catch(e){}
    const b=document.querySelector('#viewModeSeg button[data-v="2d"]'); if(b)b.click(); resize(); vpFit(); render(); return 1;})()`); await wait(700);
  out[fmt]=await mide();
  out[fmt].pinta=await ev(`(function(){ const cv=document.createElement('canvas'); cv.width=glc.width; cv.height=glc.height;
    const g=cv.getContext('2d'); g.drawImage(glc,0,0); const d=g.getImageData(0,0,cv.width,cv.height).data;
    let n=0; for(let i=3;i<d.length;i+=4)if(d[i]>8)n++; return +(n/(cv.width*cv.height)).toFixed(4); })()`);
}
out.errs = await ev(`window.__errs.slice(0,15)`);
console.log(JSON.stringify(out,null,1));
ws.close();
