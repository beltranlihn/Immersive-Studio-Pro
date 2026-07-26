// ¿El cenit del domo muestra el borde SUPERIOR del equirect (correcto) o el inferior (invertido)?
// Patrón: mitad superior GRIS, mitad inferior MAGENTA. Se lee el centro del composite = cenit.
import { targets } from './cdp.mjs';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let idx=null; for(let i=0;i<150;i++){const l=await targets(9222).catch(()=>[]);idx=l.find(t=>t.type==='page'&&/index\.html/.test(t.url||'')&&t.webSocketDebuggerUrl);if(idx)break;await wait(200);}
const ws=new WebSocket(idx.webSocketDebuggerUrl); await new Promise((r,j)=>{ws.onopen=r;ws.onerror=()=>j(new Error('ws'))});
let _id=0; const send=(m,p)=>new Promise((res,rej)=>{const id=++_id;const h=ev=>{const x=JSON.parse(ev.data);if(x.id!==id)return;ws.removeEventListener('message',h);x.error?rej(new Error(JSON.stringify(x.error))):res(x.result)};ws.addEventListener('message',h);ws.send(JSON.stringify({id,method:m,params:p}))});
const evl=async e=>{const r=await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)return{ROTO:JSON.stringify(r.exceptionDetails).slice(0,400)};return r.result.value};
await send('Page.reload',{ignoreCache:true}); await wait(2400);
for(let i=0;i<80;i++){ if(await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")')===true)break; await wait(400); }
await evl(`(()=>{try{localStorage.setItem('dspOnboardV1','1')}catch(e){}document.querySelectorAll('.overlay,#tourOv,#landingOv').forEach(o=>o.remove());document.body.classList.remove('preboot');try{resize()}catch(e){}return 1})()`);
await evl(`(async()=>{state.dirty=false;await buildDemoProject();state.clips.length=0;render();return 1})()`); await wait(600);
console.log(JSON.stringify(await evl(`(async()=>{
  const W=4096,H=2048; const cv=document.createElement('canvas'); cv.width=W; cv.height=H; const x=cv.getContext('2d');
  x.fillStyle='#8A9199'; x.fillRect(0,0,W,H/2);      // ARRIBA del archivo = cielo/cenit
  x.fillStyle='#FF00AA'; x.fillRect(0,H/2,W,H/2);    // ABAJO del archivo = suelo/nadir
  const m={id:uid(),kind:'image',name:'eq.png',el:cv,originalEl:cv,tex:newTex(),w:W,h:H,dur:6,fps:0,thumb:null,
    color:'#888',proxyReady:false,proxyPct:0,path:null,fsize:0,folder:null,missing:false,_loading:false};
  upTex(m.tex,cv); state.media.push(m);
  const li=state.lanes.map((l,i)=>i).filter(i=>state.lanes[i].kind!=='audio')[0];
  const c=makeClip(m,li,0); c.props.equirect=true; c.props.eqPitch=0; c.props.az=0; state.clips.push(c);
  state.playhead=1; render(); await new Promise(r=>setTimeout(r,400)); render();
  // centro del composite = CENIT del domo
  const px=new Uint8Array(4*16*16); gl.bindFramebuffer(gl.FRAMEBUFFER,compFBO);
  gl.readPixels(Math.round(compSize/2)-8,Math.round(compSize/2)-8,16,16,gl.RGBA,gl.UNSIGNED_BYTE,px);
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  let R=0,G=0,B=0,n=0; for(let k=0;k<px.length;k+=4){R+=px[k];G+=px[k+1];B+=px[k+2];n++;}
  R=Math.round(R/n); G=Math.round(G/n); B=Math.round(B/n);
  const esMagenta=(R>60&&B>40&&G<R*0.6);
  return { cenitRGB:[R,G,B], cenitEsMagenta:esMagenta,
    veredicto: esMagenta ? 'INVERTIDO: el cenit muestra el borde INFERIOR del archivo'
                         : 'correcto: el cenit muestra el borde superior' }; })()`),null,2));
ws.close();
