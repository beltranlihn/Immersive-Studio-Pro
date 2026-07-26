import { targets } from './cdp.mjs';
import fs from 'fs';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let idx=null; for(let i=0;i<150;i++){const l=await targets(9222).catch(()=>[]);idx=l.find(t=>t.type==='page'&&/index\.html/.test(t.url||'')&&t.webSocketDebuggerUrl);if(idx)break;await wait(200);}
const ws=new WebSocket(idx.webSocketDebuggerUrl); await new Promise((r,j)=>{ws.onopen=r;ws.onerror=()=>j(new Error('ws'))});
let _id=0; const send=(m,p)=>new Promise((res,rej)=>{const id=++_id;const h=ev=>{const x=JSON.parse(ev.data);if(x.id!==id)return;ws.removeEventListener('message',h);x.error?rej(new Error(JSON.stringify(x.error))):res(x.result)};ws.addEventListener('message',h);ws.send(JSON.stringify({id,method:m,params:p}))});
const evl=async e=>{const r=await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)return{ROTO:JSON.stringify(r.exceptionDetails).slice(0,400)};return r.result.value};
await send('Emulation.setDeviceMetricsOverride',{width:1600,height:900,deviceScaleFactor:1,mobile:false,screenWidth:1600,screenHeight:900});
await send('Page.reload',{ignoreCache:true}); await wait(2400);
for(let i=0;i<80;i++){ if(await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")')===true)break; await wait(400); }
await evl(`(()=>{try{localStorage.setItem('dspOnboardV1','1')}catch(e){}document.querySelectorAll('.overlay,#tourOv,#landingOv').forEach(o=>o.remove());document.body.classList.remove('preboot');try{resize()}catch(e){}return 1})()`);
await evl(`(async()=>{state.dirty=false;await buildDemoProject();return 1})()`); await wait(700);
const RUTA='C:\\Users\\beltr\\Desktop\\Alma Digital Studio\\Projects\\VR Unreal\\Recursos\\Asset\\Calibration\\Inhaling-exhaling.mp4';
console.log('montaje:', JSON.stringify(await evl(`(async()=>{
  state.clips.length=0; state.media=state.media.filter(m=>isSeqMedia(m)); renderMedia(); renderTimeline(); render();
  const url=DSP.toFileURL('${RUTA}');
  const v=document.createElement('video'); v.src=url; v.muted=true; v.preload='auto';
  await new Promise(r=>{ v.addEventListener('loadedmetadata',r,{once:true}); setTimeout(r,8000); });
  if(!v.videoWidth) return {noCargo:true, url:url.slice(0,60)};
  const m={id:uid(),name:'Inhaling-exhaling.mp4',kind:'video',el:v,originalEl:v,srcUrl:url,tex:newTex(),
    w:v.videoWidth,h:v.videoHeight,dur:v.duration,fps:30,thumb:null,color:clipColorFor('video'),
    proxyReady:false,proxyPct:0,path:'${RUTA}',fsize:0,folder:null,missing:false,_loading:false};
  state.media.push(m);
  const li=state.lanes.map((l,i)=>i).filter(i=>state.lanes[i].kind!=='audio')[0];
  addClip(m,li,0.5);
  const cv=state.clips[state.clips.length-1];
  for(let i=0;i<260;i++){ if(cv&&cv.link) break; await new Promise(r=>setTimeout(r,150)); }
  const p=linkPartner(cv);
  state.selIds=linkedIds([cv.id]); state.selId=cv.id;
  state.playhead=2; renderTimeline(); renderMedia(); renderInspector(); render();
  try{ redrawAudioWaves(); }catch(e){}
  await new Promise(r=>setTimeout(r,1000)); try{ redrawAudioWaves(); }catch(e){}
  return { video:!!cv, enlazado:!!(cv&&cv.link), audioEn:p?state.lanes[p.lane].tag:null, onda:!!m.peaks }; })()`)));
await wait(1200);
const s=await send('Page.captureScreenshot',{format:'png'});
fs.writeFileSync('scratchpad/shots/15-clips-enlazados.png', Buffer.from(s.data,'base64'));
console.log('guardada');
ws.close();
