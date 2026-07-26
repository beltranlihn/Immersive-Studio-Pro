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
await evl(`(async()=>{ state.dirty=false; await buildDemoProject(); state.clips.length=0;
  const W=4096,H=2048; const cv=document.createElement('canvas'); cv.width=W; cv.height=H; const x=cv.getContext('2d');
  // cielo arriba, tierra abajo, con horizonte marcado: se ve de un vistazo si está derecho
  const g=x.createLinearGradient(0,0,0,H/2); g.addColorStop(0,'#7C93AD'); g.addColorStop(1,'#C7D2DC');
  x.fillStyle=g; x.fillRect(0,0,W,H/2);
  const g2=x.createLinearGradient(0,H/2,0,H); g2.addColorStop(0,'#6E6152'); g2.addColorStop(1,'#3A342C');
  x.fillStyle=g2; x.fillRect(0,H/2,W,H/2);
  x.strokeStyle='rgba(255,255,255,0.28)'; x.lineWidth=3;
  for(let i=1;i<12;i++){ const px=W*i/12; x.beginPath();x.moveTo(px,0);x.lineTo(px,H);x.stroke(); }
  for(let j=1;j<6;j++){ const py=H*j/6; x.beginPath();x.moveTo(0,py);x.lineTo(W,py);x.stroke(); }
  x.fillStyle='#E8EAED'; x.font='bold 150px sans-serif'; x.textAlign='center';
  x.fillText('CIELO',W*0.25,H*0.22); x.fillText('SUELO',W*0.25,H*0.82);
  const m={id:uid(),kind:'image',name:'panorama.png',el:cv,originalEl:cv,tex:newTex(),w:W,h:H,dur:8,fps:0,thumb:cv.toDataURL('image/jpeg',0.5),
    color:clipColorFor('image'),proxyReady:false,proxyPct:0,path:null,fsize:0,folder:null,missing:false,_loading:false};
  upTex(m.tex,cv); state.media.push(m);
  const li=state.lanes.map((l,i)=>i).filter(i=>state.lanes[i].kind!=='audio')[0];
  const c=makeClip(m,li,0); state.clips.push(c);
  state.selIds=[c.id]; state.selId=c.id; state.playhead=2;
  state.view.mode='3d'; state.view.three='orbit'; state.view.cam.pitch=0.35; state.view.cam.dist=3.4;
  try{updModeUI();}catch(e){}
  renderTimeline(); renderMedia(); renderInspector(); render();
  await new Promise(r=>setTimeout(r,900)); render(); return 1; })()`);
await wait(1200);
const s=await send('Page.captureScreenshot',{format:'png'});
fs.writeFileSync('scratchpad/shots/14-equirect-esfera-3d.png', Buffer.from(s.data,'base64'));
console.log('guardada');
ws.close();
