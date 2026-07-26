import { targets } from './cdp.mjs';
const wait = ms => new Promise(r => setTimeout(r, ms));
let idx=null; for(let i=0;i<120;i++){const l=await targets(9222).catch(()=>[]);idx=l.find(t=>t.type==='page'&&/index\.html/.test(t.url||'')&&t.webSocketDebuggerUrl);if(idx)break;await wait(150);}
const ws=new WebSocket(idx.webSocketDebuggerUrl); await new Promise((r,j)=>{ws.onopen=r;ws.onerror=()=>j(new Error('ws'))});
let _id=0; const send=(m,p)=>new Promise((res,rej)=>{const id=++_id;const h=ev=>{const x=JSON.parse(ev.data);if(x.id!==id)return;ws.removeEventListener('message',h);x.error?rej(new Error(JSON.stringify(x.error))):res(x.result)};ws.addEventListener('message',h);ws.send(JSON.stringify({id,method:m,params:p}))});
const evl=async e=>{const r=await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails).slice(0,300));return r.result.value};
await send('Emulation.setDeviceMetricsOverride',{width:1600,height:900,deviceScaleFactor:1,mobile:false,screenWidth:1600,screenHeight:900});
await send('Page.reload',{ignoreCache:true}); await wait(2000);
for(let i=0;i<60;i++){try{if(await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")'))break}catch(e){}await wait(400)}
await evl(`(()=>{try{localStorage.setItem('dspOnboardV1','1')}catch(e){}document.querySelectorAll('.overlay,#tourOv,#landingOv').forEach(o=>o.remove());document.body.classList.remove('preboot');try{resize()}catch(e){}return 1})()`);
await evl(`(async()=>{state.dirty=false;await buildDemoProject();return 1})()`); await wait(700);
await evl(`(()=>{const b=document.getElementById('curvesBtn');if(b&&!state.inlineCurves)b.click();return 1})()`); await wait(500);
const v1=i=>`(()=>{const l=state.lanes[1];return laneH(1)+(l.collapsed?'·plegada':'')})()`;
let seq=[await evl(v1())];
for(let i=0;i<8;i++){ await evl(`wheelResizeLanes({deltaY:120})`); seq.push(await evl(v1())); }
console.log('V1 achicando : '+seq.join(' → '));
seq=[await evl(v1())];
for(let i=0;i<8;i++){ await evl(`wheelResizeLanes({deltaY:-120})`); seq.push(await evl(v1())); }
console.log('V1 agrandando: '+seq.join(' → '));
console.log('selectores al volver: '+JSON.stringify(await evl(`(()=>{const h=[...document.querySelectorAll('#trackHdr .lanehdr')].filter(x=>!x.classList.contains('aud'))[0];const a=h&&h.querySelector('.autoctl');return {alto:h?Math.round(h.getBoundingClientRect().height):null, selectores:!!(a&&a.getBoundingClientRect().height>0)}})()`)));
ws.close();
