import { targets } from './cdp.mjs';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let idx=null; for(let i=0;i<120;i++){const l=await targets(9222).catch(()=>[]);idx=l.find(t=>t.type==='page'&&/index\.html/.test(t.url||'')&&t.webSocketDebuggerUrl);if(idx)break;await wait(150);}
const ws=new WebSocket(idx.webSocketDebuggerUrl); await new Promise((r,j)=>{ws.onopen=r;ws.onerror=()=>j(new Error('ws'))});
let _id=0; const send=(m,p)=>new Promise((res,rej)=>{const id=++_id;const h=ev=>{const x=JSON.parse(ev.data);if(x.id!==id)return;ws.removeEventListener('message',h);x.error?rej(new Error(JSON.stringify(x.error))):res(x.result)};ws.addEventListener('message',h);ws.send(JSON.stringify({id,method:m,params:p}))});
const evl=async e=>{const r=await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails).slice(0,300));return r.result.value};
await send('Page.reload',{ignoreCache:true}); await wait(2200);
for(let i=0;i<60;i++){try{if(await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")'))break}catch(e){}await wait(400)}
await evl(`(()=>{try{localStorage.setItem('dspOnboardV1','1')}catch(e){}document.querySelectorAll('.overlay,#tourOv,#landingOv').forEach(o=>o.remove());document.body.classList.remove('preboot');try{resize()}catch(e){}return 1})()`);
await evl(`(async()=>{state.dirty=false;await buildDemoProject();return 1})()`); await wait(700);
for (const w of [1600,1200,1000,860]) {
  await send('Emulation.setDeviceMetricsOverride',{width:w,height:900,deviceScaleFactor:1,mobile:false,screenWidth:w,screenHeight:900});
  await wait(400); await evl(`(()=>{try{resize();updViewCtl();}catch(e){}return 1})()`); await wait(300);
  const r = await evl(`(()=>{ document.getElementById('vpMorePan')&&document.getElementById('vpMorePan').remove();
    openVpMore(); const p=document.getElementById('vpMorePan');
    const secciones=p?[...p.querySelectorAll('span')].map(s=>s.textContent).filter(t=>t&&t.length<20):[];
    const botones=p?[...p.querySelectorAll('button')].map(b=>b.textContent.trim()).filter(Boolean):[];
    if(p)p.remove();
    const vp=document.querySelector('.vptool');
    const enBarra=[...vp.children].filter(c=>c.getBoundingClientRect().width>0).map(c=>(c.id||c.className).slice(0,12));
    return {enLaBarra:enBarra, enElMenu:secciones, botonesDelMenu:botones.slice(0,14)}; })()`);
  console.log(String(w).padStart(5)+'px'); console.log('   barra:', r.enLaBarra.join(' ')); console.log('   More :', r.enElMenu.join(' / ')||'(vacío)');
}
ws.close();
