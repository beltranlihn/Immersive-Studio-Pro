import { targets } from './cdp.mjs';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let idx=null; for(let i=0;i<150;i++){const l=await targets(9222).catch(()=>[]);idx=l.find(t=>t.type==='page'&&/index\.html/.test(t.url||'')&&t.webSocketDebuggerUrl);if(idx)break;await wait(200);}
const ws=new WebSocket(idx.webSocketDebuggerUrl); await new Promise((r,j)=>{ws.onopen=r;ws.onerror=()=>j(new Error('ws'))});
let _id=0; const send=(m,p)=>new Promise((res,rej)=>{const id=++_id;const h=ev=>{const x=JSON.parse(ev.data);if(x.id!==id)return;ws.removeEventListener('message',h);x.error?rej(new Error(JSON.stringify(x.error))):res(x.result)};ws.addEventListener('message',h);ws.send(JSON.stringify({id,method:m,params:p}))});
const evl=async e=>{const r=await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)return{ROTO:JSON.stringify(r.exceptionDetails).slice(0,300)};return r.result.value};
console.log(JSON.stringify(await evl(`(()=>{
  const cds=[...document.querySelectorAll('.clip.audioclip')];
  return cds.map(cd=>{ const c=clipById(+cd.dataset.clip); const m=c&&mediaById(c.mediaId);
    const cv=cd.querySelector('canvas.awave');
    let tinta=0; if(cv){ const d=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data; for(let k=3;k<d.length;k+=4*9) if(d[k]>8) tinta++; }
    return { clip:c&&c.name, tieneClaseAudioclip:true, medio:m&&m.kind, picos:!!(m&&m.peaks),
      lienzoDeOnda:!!cv, tintaEnLaOnda:tinta }; });
})()`),null,1));
ws.close();
