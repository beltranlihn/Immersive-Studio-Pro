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

const ESCENA=`
  const V=state.lanes.map((l,i)=>i).filter(i=>state.lanes[i].kind!=='audio');
  const col=['#C9CDD3','#8A9199','#5A8D7E','#B4BAC1'];
  for(let k=0;k<3;k++){ const m={id:uid(),kind:'shape',name:'F'+k,shape:k===0?'ellipse':k===1?'rect':'line',fill:col[k],stroke:'#000',strokeW:0,w:512,h:512,dur:8,missing:false,_loading:false,color:col[k]};
    state.media.push(m); renderShapeMedia(m);
    state.clips.push({id:uid(),name:'F'+k,mediaId:m.id,lane:V[k%V.length],start:k*0.6,dur:7-k,inP:0,
      props:isFlat()?{x:(k-1)*32,y:(1-k)*18,scale:60+k*14,rot:0,opacity:100}:{az:(k-1)*55,el:40+k*10,size:55+k*12,rot:0,opacity:100},
      kf:{},color:col[k],fadeIn:0.3,fadeOut:0.4}); }
  state.playhead=2; renderTimeline(); renderMedia(); renderInspector(); render();`;

for (const [arch,montar] of [
  ['12-editor-2d-flat', `state.dirty=false; await newProject('flat',1920,1080,60,180); state.view.showCenter=true;`],
  ['13-editor-sala-360', `state.dirty=false; await newRoomProject({fps:60, floor:null,
      walls:[{role:'Front',order:1,wcm:500,hcm:300,pxW:1920,pxH:1080},{role:'Right',order:2,wcm:400,hcm:300,pxW:1536,pxH:1080},
             {role:'Back',order:3,wcm:500,hcm:300,pxW:1920,pxH:1080},{role:'Left',order:4,wcm:400,hcm:300,pxW:1536,pxH:1080}]});`],
]) {
  await evl(`(async()=>{ ${montar} try{updModeUI();}catch(e){} ${ESCENA} await new Promise(r=>setTimeout(r,700)); render(); return 1; })()`);
  await wait(1100);
  const s=await send('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync('scratchpad/shots/'+arch+'.png', Buffer.from(s.data,'base64'));
  console.log('guardada '+arch);
}
ws.close();
