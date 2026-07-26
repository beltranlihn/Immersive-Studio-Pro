import { targets } from './cdp.mjs';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let idx=null; for(let i=0;i<150;i++){const l=await targets(9222).catch(()=>[]);idx=l.find(t=>t.type==='page'&&/index\.html/.test(t.url||'')&&t.webSocketDebuggerUrl);if(idx)break;await wait(200);}
const ws=new WebSocket(idx.webSocketDebuggerUrl); await new Promise((r,j)=>{ws.onopen=r;ws.onerror=()=>j(new Error('ws'))});
let _id=0; const send=(m,p)=>new Promise((res,rej)=>{const id=++_id;const h=ev=>{const x=JSON.parse(ev.data);if(x.id!==id)return;ws.removeEventListener('message',h);x.error?rej(new Error(JSON.stringify(x.error))):res(x.result)};ws.addEventListener('message',h);ws.send(JSON.stringify({id,method:m,params:p}))});
const evl=async e=>{const r=await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)return{ROTO:JSON.stringify(r.exceptionDetails).slice(0,300)};return r.result.value};
await send('Emulation.setDeviceMetricsOverride',{width:1600,height:900,deviceScaleFactor:1,mobile:false,screenWidth:1600,screenHeight:900});
await send('Page.reload',{ignoreCache:true}); await wait(2500);
for(let i=0;i<80;i++){ if(await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")')===true)break; await wait(400); }
await evl(`(()=>{try{localStorage.setItem('dspOnboardV1','1')}catch(e){}document.querySelectorAll('.overlay,#tourOv,#landingOv').forEach(o=>o.remove());document.body.classList.remove('preboot');try{resize()}catch(e){}return 1})()`);
await evl(`(async()=>{state.dirty=false;await buildDemoProject(); const b=document.getElementById('curvesBtn'); if(b&&!state.inlineCurves)b.click(); renderTimeline(); return 1})()`); await wait(1400);
const chips=await evl(`(()=>[...document.querySelectorAll('#trackHdr .autoctl *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>10&&r.height>8;}).slice(0,4).map(e=>{const r=e.getBoundingClientRect();return{t:(e.textContent||'').trim().slice(0,14),cls:(e.className||'').slice(0,18),x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};}))()`);
console.log('chips encontrados:', JSON.stringify(chips));
const clic=async(x,y)=>{ await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});
                         await send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1}); };
for(const c of chips){
  await evl(`(()=>{closeMenu();return 1})()`); await wait(80);
  await clic(c.x,c.y); await wait(200);
  const abrio=await evl(`!!document.querySelector('.menu')`);
  if(!abrio){ console.log('  '+(c.t||c.cls)+': no abre desplegable'); continue; }
  await clic(c.x,c.y); await wait(250);
  const sigue=await evl(`!!document.querySelector('.menu')`);
  console.log('  '+(c.t||c.cls)+': abre ✓  cierra al 2.º clic '+(sigue?'✗ NO':'✓ sí'));
  await evl(`(()=>{closeMenu();return 1})()`);
}
ws.close();
