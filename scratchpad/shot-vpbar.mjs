import { targets } from './cdp.mjs';
import fs from 'fs';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let idx=null; for(let i=0;i<150;i++){const l=await targets(9222).catch(()=>[]);idx=l.find(t=>t.type==='page'&&/index\.html/.test(t.url||'')&&t.webSocketDebuggerUrl);if(idx)break;await wait(200);}
const ws=new WebSocket(idx.webSocketDebuggerUrl); await new Promise((r,j)=>{ws.onopen=r;ws.onerror=()=>j(new Error('ws'))});
let _id=0; const send=(m,p)=>new Promise((res,rej)=>{const id=++_id;const h=ev=>{const x=JSON.parse(ev.data);if(x.id!==id)return;ws.removeEventListener('message',h);x.error?rej(new Error(JSON.stringify(x.error))):res(x.result)};ws.addEventListener('message',h);ws.send(JSON.stringify({id,method:m,params:p}))});
const evl=async e=>{const r=await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)return{ROTO:1};return r.result.value};
await send('Emulation.setDeviceMetricsOverride',{width:1600,height:900,deviceScaleFactor:1,mobile:false,screenWidth:1600,screenHeight:900});
await send('Page.reload',{ignoreCache:true}); await wait(2500);
for(let i=0;i<80;i++){ if(await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")')===true)break; await wait(400); }
await evl(`(()=>{try{localStorage.setItem('dspOnboardV1','1')}catch(e){}document.querySelectorAll('.overlay,#tourOv,#landingOv').forEach(o=>o.remove());document.body.classList.remove('preboot');try{resize()}catch(e){}return 1})()`);
await evl(`(async()=>{state.dirty=false;await buildDemoProject();return 1})()`); await wait(800);
const tiras=[];
for(const [n,m] of [['2D',`state.view.mode='2d';`],['3D Orbit',`state.view.mode='3d';state.view.three='orbit';`],['3D Viewer',`state.view.mode='3d';state.view.three='spec';`]]){
  await evl(`(()=>{ ${m} try{updModeUI();updViewCtl();}catch(e){} render(); return 1; })()`); await wait(600);
  const r=await evl(`(()=>{const v=document.querySelector('.vptool').getBoundingClientRect();return{x:Math.round(v.x),y:Math.round(v.y),w:Math.round(v.width),h:Math.round(v.height)};})()`);
  const s=await send('Page.captureScreenshot',{format:'png',clip:{x:r.x,y:r.y,width:r.w,height:r.h,scale:2}});
  const f='scratchpad/shots/16-vpbar-'+n.replace(/ /g,'-')+'.png';
  fs.writeFileSync(f, Buffer.from(s.data,'base64')); tiras.push(f);
}
console.log(tiras.join('\n'));
ws.close();
