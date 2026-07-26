import { targets } from './cdp.mjs';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let idx=null; for(let i=0;i<120;i++){const l=await targets(9222).catch(()=>[]);idx=l.find(t=>t.type==='page'&&/index\.html/.test(t.url||'')&&t.webSocketDebuggerUrl);if(idx)break;await wait(150);}
const ws=new WebSocket(idx.webSocketDebuggerUrl); await new Promise((r,j)=>{ws.onopen=r;ws.onerror=()=>j(new Error('ws'))});
let _id=0; const send=(m,p)=>new Promise((res,rej)=>{const id=++_id;const h=ev=>{const x=JSON.parse(ev.data);if(x.id!==id)return;ws.removeEventListener('message',h);x.error?rej(new Error(JSON.stringify(x.error))):res(x.result)};ws.addEventListener('message',h);ws.send(JSON.stringify({id,method:m,params:p}))});
const evl=async e=>{const r=await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails).slice(0,300));return r.result.value};
await send('Emulation.setDeviceMetricsOverride',{width:1600,height:900,deviceScaleFactor:1,mobile:false,screenWidth:1600,screenHeight:900});
await send('Page.reload',{ignoreCache:true}); await wait(2000);
for(let i=0;i<60;i++){try{if(await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")'))break}catch(e){}await wait(400)}
await evl(`(()=>{try{localStorage.setItem('dspOnboardV1','1')}catch(e){}document.querySelectorAll('.overlay,#tourOv,#landingOv').forEach(o=>o.remove());document.body.classList.remove('preboot');try{resize()}catch(e){}return 1})()`);
await evl(`(async()=>{state.dirty=false;await buildDemoProject();return 1})()`); await wait(700);
const est=()=>`(()=>{ const o=document.getElementById('loadingOv');
  if(!o) return {existe:false};
  const cs=getComputedStyle(o); const r=o.getBoundingClientRect();
  const centro=document.elementFromPoint(Math.round(innerWidth/2),Math.round(innerHeight/2));
  return {existe:true, display:cs.display, opacity:cs.opacity, visibility:cs.visibility, pointerEvents:cs.pointerEvents,
    caja:[Math.round(r.width),Math.round(r.height)], zIndex:cs.zIndex,
    loQueRecibeElClicEnElCentro:centro?(centro.id||centro.className||centro.tagName):null }; })()`;
console.log('tras arrancar  ', JSON.stringify(await evl(est())));
await evl(`(async()=>{ const j=JSON.stringify(serProject()); loadProject(JSON.parse(j)); await new Promise(r=>setTimeout(r,500)); return 1; })()`);
await wait(1200);
console.log('tras abrir un .isp', JSON.stringify(await evl(est())));
for (const t of [5000,8000,10000]) { await wait(t); console.log('+'+Math.round(t/1000)+'s          ', JSON.stringify(await evl(est()))); }
console.log('vueltas del logo:', await evl(`(typeof _loadingLoops!=='undefined'?_loadingLoops:'?')`));
ws.close();
