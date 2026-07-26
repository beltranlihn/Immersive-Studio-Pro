import { targets } from './cdp.mjs';
import fs from 'fs';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let idx=null; for(let i=0;i<150;i++){const l=await targets(9222).catch(()=>[]);idx=l.find(t=>t.type==='page'&&/index\.html/.test(t.url||'')&&t.webSocketDebuggerUrl);if(idx)break;await wait(200);}
const ws=new WebSocket(idx.webSocketDebuggerUrl); await new Promise((r,j)=>{ws.onopen=r;ws.onerror=()=>j(new Error('ws'))});
let _id=0; const send=(m,p)=>new Promise((res,rej)=>{const id=++_id;const h=ev=>{const x=JSON.parse(ev.data);if(x.id!==id)return;ws.removeEventListener('message',h);x.error?rej(new Error(JSON.stringify(x.error))):res(x.result)};ws.addEventListener('message',h);ws.send(JSON.stringify({id,method:m,params:p}))});
const evl=async e=>{const r=await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)return{ROTO:JSON.stringify(r.exceptionDetails).slice(0,300)};return r.result.value};
await send('Emulation.setDeviceMetricsOverride',{width:1600,height:900,deviceScaleFactor:1,mobile:false,screenWidth:1600,screenHeight:900});
await send('Page.reload',{ignoreCache:true}); await wait(2400);
for(let i=0;i<80;i++){ if(await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")')===true)break; await wait(400); }
await evl(`(()=>{try{localStorage.setItem('dspOnboardV1','1')}catch(e){}document.querySelectorAll('.overlay,#tourOv,#landingOv').forEach(o=>o.remove());document.body.classList.remove('preboot');try{resize()}catch(e){}return 1})()`);
await evl(`(async()=>{state.dirty=false;await buildDemoProject();return 1})()`); await wait(700);
await evl(`(async()=>{
  state.clips.length=0;
  const srcs=DSP.spout.inList(); const sp=makeSpoutMedia(srcs[0]);
  for(let i=0;i<150;i++){ if(sp._spLive) break; await new Promise(r=>setTimeout(r,80)); }
  const V=state.lanes.map((l,i)=>i).filter(i=>state.lanes[i].kind!=='audio');
  state.clips.push({id:uid(),name:sp.name,mediaId:sp.id,lane:V[0],start:0,dur:12,inP:0,props:{az:0,el:62,size:110,rot:0,opacity:100},kf:{},color:sp.color,fadeIn:0,fadeOut:0});
  const sp2=state.media.find(x=>x.kind==='spout');
  state.selIds=[state.clips[0].id]; state.selId=state.clips[0].id;
  state.playhead=3; renderTimeline(); renderMedia(); renderInspector(); render();
  await new Promise(r=>setTimeout(r,900)); render();
  return 1; })()`);
await wait(1200);
const s=await send('Page.captureScreenshot',{format:'png'});
fs.writeFileSync('scratchpad/shots/11-spout-in.png', Buffer.from(s.data,'base64'));
console.log('captura guardada');
ws.close();
