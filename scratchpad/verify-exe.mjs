// ¿el .exe EMPAQUETADO trae de verdad R163-R165? Se comprueba contra el asar, no contra los fuentes.
import { targets } from './cdp.mjs';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let idx=null;
for(let i=0;i<200;i++){ const l=await targets(9223).catch(()=>[]);
  idx=l.find(t=>t.type==='page'&&/index\.html/.test(t.url||'')&&t.webSocketDebuggerUrl); if(idx)break; await wait(300); }
if(!idx){ console.log('el .exe no expuso la ventana del editor'); process.exit(1); }
const ws=new WebSocket(idx.webSocketDebuggerUrl); await new Promise((r,j)=>{ws.onopen=r;ws.onerror=()=>j(new Error('ws'))});
let _id=0; const send=(m,p)=>new Promise((res,rej)=>{const id=++_id;const h=ev=>{const x=JSON.parse(ev.data);if(x.id!==id)return;ws.removeEventListener('message',h);x.error?rej(new Error(JSON.stringify(x.error))):res(x.result)};ws.addEventListener('message',h);ws.send(JSON.stringify({id,method:m,params:p}))});
const errs=[]; await send('Runtime.enable',{});
ws.addEventListener('message',ev=>{const x=JSON.parse(ev.data);
  if(x.method==='Runtime.consoleAPICalled'&&x.params.type==='error')errs.push((x.params.args||[]).map(a=>a.value||a.description||'').join(' ').slice(0,160));
  if(x.method==='Runtime.exceptionThrown')errs.push('excepción: '+((x.params.exceptionDetails.exception&&x.params.exceptionDetails.exception.description)||'').slice(0,160));});
const evl=async e=>{const r=await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)return{ROTO:JSON.stringify(r.exceptionDetails).slice(0,200)};return r.result.value};
for(let i=0;i<80;i++){ if(await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")')===true)break; await wait(400); }
await evl(`(()=>{try{localStorage.setItem('dspOnboardV1','1')}catch(e){}document.querySelectorAll('.overlay,#tourOv,#landingOv').forEach(o=>o.remove());document.body.classList.remove('preboot');try{resize()}catch(e){}return 1})()`);
await evl(`(async()=>{state.dirty=false;await buildDemoProject();return 1})()`); await wait(900);
console.log(JSON.stringify(await evl(`(()=>{
  const R={};
  R['R163 · suelo de automatización'] = (typeof laneFloorH==='function' && typeof AUTO_LANE_MIN_H!=='undefined') ? AUTO_LANE_MIN_H : 'NO ESTÁ';
  R['R164 · iconos alpha y fit']      = [!!document.querySelector('[data-ico=alpha] svg'), !!document.querySelector('[data-ico=fit] svg')].join('/');
  R['R165 · geometría no destructiva']= typeof applyRoomGeometry==='function' ? 'sí' : 'NO ESTÁ';
  R['R165 · regla a 24']              = (typeof RULER_H!=='undefined'?RULER_H:'?');
  R['R165 · audio abajo']             = state.lanes.findIndex(l=>l.kind==='audio');
  R['R165 · una sola hideLanding']    = (''+hideLanding).length;
  R['render']                         = (()=>{try{render();return !(gl&&gl.isContextLost&&gl.isContextLost())}catch(e){return 'ROTO: '+e.message}})();
  R['clips']                          = state.clips.length;
  return R; })()`),null,2));
await wait(600);
console.log('errores de consola en el .exe:', errs.length?errs:'ninguno');
ws.close();
