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
await evl(`(async()=>{state.dirty=false;await buildDemoProject();state.clips.length=0;render();return 1})()`); await wait(600);
const R='C:\\Users\\beltr\\Desktop\\Alma Digital Studio\\Projects\\VR Unreal\\Recursos\\Asset\\Calibration\\';
await evl(`(async()=>{
  const V=state.lanes.map((l,i)=>i).filter(i=>state.lanes[i].kind!=='audio');
  for(const [f,li,st] of [['Inhaling-exhaling.mp4',V[0],0],['Rapida.mp4',V[1],1.5]]){
    const url=DSP.toFileURL('${R}'+f);
    const v=document.createElement('video'); v.src=url; v.muted=true; v.preload='auto';
    await new Promise(r=>{ v.addEventListener('loadedmetadata',r,{once:true}); setTimeout(r,6000); });
    const m={id:uid(),name:f,kind:'video',el:v,originalEl:v,srcUrl:url,tex:newTex(),w:v.videoWidth,h:v.videoHeight,
      dur:v.duration,fps:30,thumb:null,color:clipColorFor('video'),proxyReady:false,proxyPct:0,
      path:'${R}'+f,fsize:0,folder:null,missing:false,_loading:false};
    state.media.push(m); addClip(m,li,st);
  }
  for(let i=0;i<250;i++){ if(state.clips.filter(x=>x.avRole==='a').length>=2) break; await new Promise(r=>setTimeout(r,150)); }
  const v0=state.clips.find(x=>x.avRole==='v'); if(v0){ state.selIds=linkedIds([v0.id]); state.selId=v0.id; }
  state.playhead=2; renderTimeline(); renderMedia(); renderInspector(); render();
  try{redrawAudioWaves();}catch(e){}
  await new Promise(r=>setTimeout(r,900)); return 1; })()`);
await wait(1500);
const s=await send('Page.captureScreenshot',{format:'png'});
fs.writeFileSync('scratchpad/shots/15-clips-enlazados.png', Buffer.from(s.data,'base64'));
console.log('guardada');
ws.close();
