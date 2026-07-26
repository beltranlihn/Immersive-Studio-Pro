import { targets } from './cdp.mjs';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let idx=null; for(let i=0;i<120;i++){const l=await targets(9222).catch(()=>[]);idx=l.find(t=>t.type==='page'&&/index\.html/.test(t.url||'')&&t.webSocketDebuggerUrl);if(idx)break;await wait(150);}
const ws=new WebSocket(idx.webSocketDebuggerUrl); await new Promise((r,j)=>{ws.onopen=r;ws.onerror=()=>j(new Error('ws'))});
let _id=0; const send=(m,p)=>new Promise((res,rej)=>{const id=++_id;const h=ev=>{const x=JSON.parse(ev.data);if(x.id!==id)return;ws.removeEventListener('message',h);x.error?rej(new Error(JSON.stringify(x.error))):res(x.result)};ws.addEventListener('message',h);ws.send(JSON.stringify({id,method:m,params:p}))});
const evl=async e=>{const r=await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails).slice(0,300));return r.result.value};
await send('Page.reload',{ignoreCache:true}); await wait(2200);
for(let i=0;i<60;i++){try{if(await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")'))break}catch(e){}await wait(400)}
await evl(`(()=>{try{localStorage.setItem('dspOnboardV1','1')}catch(e){}document.querySelectorAll('.overlay,#tourOv,#landingOv').forEach(o=>o.remove());document.body.classList.remove('preboot');try{resize()}catch(e){}return 1})()`);
await evl(`(async()=>{state.dirty=false;await buildDemoProject();return 1})()`); await wait(700);
const medir=`(()=>{ const vp=document.querySelector('.vptool');
  return { ancho:Math.round(vp.clientWidth), contenido:Math.round(vp.scrollWidth), desborda:vp.scrollWidth>vp.clientWidth+1,
    plegados:Object.keys(_vpHide||{}), botonMore:!!document.getElementById('vpMoreBtn'),
    hijos:[...vp.children].map(c=>({ que:(c.id||c.className||c.tagName).slice(0,18),
      ancho:Math.round(c.getBoundingClientRect().width), natural:c.scrollWidth,
      shrink:getComputedStyle(c).flexShrink, minw:getComputedStyle(c).minWidth })) }; })()`;
for (const w of [1600,1200,1000,860,720]) {
  await send('Emulation.setDeviceMetricsOverride',{width:w,height:900,deviceScaleFactor:1,mobile:false,screenWidth:w,screenHeight:900});
  await wait(400); await evl(`(()=>{try{resize();updViewCtl();}catch(e){}return 1})()`); await wait(350);
  console.log(String(w).padStart(5)+'px →', JSON.stringify(await evl(medir)));
}
ws.close();
