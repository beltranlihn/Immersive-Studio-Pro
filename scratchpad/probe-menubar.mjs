import { targets } from './cdp.mjs';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let idx=null; for(let i=0;i<150;i++){const l=await targets(9222).catch(()=>[]);idx=l.find(t=>t.type==='page'&&/index\.html/.test(t.url||'')&&t.webSocketDebuggerUrl);if(idx)break;await wait(200);}
const ws=new WebSocket(idx.webSocketDebuggerUrl); await new Promise((r,j)=>{ws.onopen=r;ws.onerror=()=>j(new Error('ws'))});
let _id=0; const send=(m,p)=>new Promise((res,rej)=>{const id=++_id;const h=ev=>{const x=JSON.parse(ev.data);if(x.id!==id)return;ws.removeEventListener('message',h);x.error?rej(new Error(JSON.stringify(x.error))):res(x.result)};ws.addEventListener('message',h);ws.send(JSON.stringify({id,method:m,params:p}))});
const evl=async e=>{const r=await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)return{ROTO:JSON.stringify(r.exceptionDetails).slice(0,300)};return r.result.value};
await send("Page.reload",{ignoreCache:true}); await wait(2600);
for(let i=0;i<60;i++){ if(await evl("typeof state!=='undefined'")===true) break; await wait(300); }
await evl(`(()=>{try{localStorage.setItem('dspOnboardV1','1')}catch(e){}document.querySelectorAll('.overlay,#tourOv,#landingOv').forEach(o=>o.remove());document.body.classList.remove('preboot');try{resize()}catch(e){}return 1})()`);
const pos=await evl(`(()=>{const b=document.querySelector('#menubar .menubtn[data-menu=file]');const r=b.getBoundingClientRect();return{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};})()`);
const est=()=>evl(`(()=>{const b=document.querySelector('#menubar .menubtn[data-menu=file]');return{menuAbierto:!!document.querySelector('.menu'), claseOn:b.classList.contains('on')};})()`);
const clic=async()=>{ await send('Input.dispatchMouseEvent',{type:'mousePressed',x:pos.x,y:pos.y,button:'left',clickCount:1});
                      await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:pos.x,y:pos.y,button:'left',clickCount:1}); };
await evl(`(()=>{closeMenu();return 1})()`); await wait(80);
console.log('inicio      ', JSON.stringify(await est()));
await clic(); await wait(200); console.log('tras 1 clic ', JSON.stringify(await est()));
await clic(); await wait(250); console.log('tras 2 clics', JSON.stringify(await est()));
// ¿y si se mueve el ratón antes del segundo clic? (mouseenter reabre: btn.onmouseenter)
await evl(`(()=>{closeMenu();return 1})()`); await wait(80);
await clic(); await wait(200);
await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:pos.x,y:pos.y});
await wait(120); console.log('tras mover  ', JSON.stringify(await est()));
ws.close();
