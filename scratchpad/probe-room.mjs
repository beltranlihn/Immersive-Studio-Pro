import { targets } from './cdp.mjs';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let idx=null; for(let i=0;i<150;i++){const l=await targets(9222).catch(()=>[]);idx=l.find(t=>t.type==='page'&&/index\.html/.test(t.url||'')&&t.webSocketDebuggerUrl);if(idx)break;await wait(200);}
if(!idx){console.log('sin editor');process.exit(1);}
const ws=new WebSocket(idx.webSocketDebuggerUrl); await new Promise((r,j)=>{ws.onopen=r;ws.onerror=()=>j(new Error('ws'))});
let _id=0; const send=(m,p)=>new Promise((res,rej)=>{const id=++_id;const h=ev=>{const x=JSON.parse(ev.data);if(x.id!==id)return;ws.removeEventListener('message',h);x.error?rej(new Error(JSON.stringify(x.error))):res(x.result)};ws.addEventListener('message',h);ws.send(JSON.stringify({id,method:m,params:p}))});
const errs=[]; await send('Runtime.enable',{});
ws.addEventListener('message',ev=>{const x=JSON.parse(ev.data); if(x.method==='Runtime.consoleAPICalled'&&x.params.type==='error')errs.push((x.params.args||[]).map(a=>a.value||a.description||'').join(' ').slice(0,180));});
await send('Page.reload',{ignoreCache:true}); await wait(2300);
const evl=async e=>{const r=await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)return{ROTO:JSON.stringify(r.exceptionDetails).slice(0,300)};return r.result.value};
for(let i=0;i<80;i++){ if(await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")')===true)break; await wait(400); }
await evl(`(()=>{try{localStorage.setItem('dspOnboardV1','1')}catch(e){}document.querySelectorAll('.overlay,#tourOv,#landingOv').forEach(o=>o.remove());document.body.classList.remove('preboot');try{resize()}catch(e){}return 1})()`);
// crear una sala NO estándar: 3 muros con medidas raras
await evl(`(async()=>{ state.dirty=false; await newRoomProject({ fps:60, floor:{wcm:640,dcm:310,pxW:2560,pxH:1240},
  walls:[{role:'Front',order:1,wcm:640,hcm:280,pxW:2560,pxH:1120},
         {role:'Right',order:2,wcm:310,hcm:280,pxW:1240,pxH:1120},
         {role:'Left', order:3,wcm:310,hcm:280,pxW:1240,pxH:1120}] }); return 1; })()`);
await wait(1200);
const antes=await evl(`(()=>{const r=activeSeq().room;return {muros:r.walls.length, medidas:r.walls.map(w=>w.role+' '+w.wcm+'x'+w.hcm+'cm '+w.pxW+'x'+w.pxH), tira:[activeSeq().w,activeSeq().h], piso:!!r.floorSeqId, medios:state.media.length};})()`);
console.log('sala creada     ', JSON.stringify(antes));
// meter un clip y enmascararlo a un muro, para comprobar que sobrevive
await evl(`(()=>{ const m={id:uid(),kind:'shape',name:'P',shape:'rect',fill:'#8A9199',stroke:'#000',strokeW:0,w:256,h:256,dur:5,missing:false,_loading:false,color:'#8A9199'};
  state.media.push(m); const li=state.lanes.map((l,i)=>i).filter(i=>state.lanes[i].kind!=='audio')[0];
  state.clips.push({id:uid(),name:'P',mediaId:m.id,lane:li,start:0,dur:4,inP:0,props:{x:0,y:0,scale:100,rot:0,maskWalls:['Right']},kf:{},color:'#8A9199',fadeIn:0,fadeOut:0});
  renderTimeline(); return 1; })()`);
// abrir el diálogo de geometría y leer con qué valores ARRANCA
console.log('diálogo arranca ', JSON.stringify(await evl(`(()=>{ const as=activeSeq();
  roomSetupDialog(()=>{}, as&&as.room);
  const ov=[...document.querySelectorAll('.overlay')].pop();
  const filas=[...ov.querySelectorAll('[data-k=wcm]')].map(i=>i.value);
  const altos=[...ov.querySelectorAll('[data-k=hcm]')].map(i=>i.value);
  const pxs=[...ov.querySelectorAll('[data-k=pxW]')].map(i=>i.value);
  const r={murosEnElDialogo:filas.length, anchosCm:filas, altosCm:altos, anchosPx:pxs};
  ov.remove(); return r; })()`)));
// aplicar un cambio de geometría y comprobar que NO se pierde nada
console.log('tras reconfigurar', JSON.stringify(await evl(`(()=>{ const as=activeSeq(); const r0=as.room;
  const cfg={ fps:60, floor:{wcm:640,dcm:310,pxW:2560,pxH:1240},
    walls:r0.walls.map(w=>({role:w.role,order:w.order,wcm:w.role==='Front'?700:w.wcm,hcm:w.hcm,pxW:w.role==='Front'?2800:w.pxW,pxH:w.pxH})) };
  const mediosAntes=state.media.length, clipsAntes=state.clips.length;
  applyRoomGeometry(cfg);
  const rr=activeSeq().room;
  return { clipsAntes, clipsAhora:state.clips.length, mediosAntes, mediosAhora:state.media.length,
    frontAhora:rr.walls.find(w=>w.role==='Front').wcm, tira:[activeSeq().w,activeSeq().h],
    mascaraIntacta:JSON.stringify(state.clips.map(c=>c.props&&c.props.maskWalls).filter(Boolean)),
    pisoSigue:!!rr.floorSeqId, hayUndo:typeof undo==='function' }; })()`)));
await wait(400);
console.log('errores:', errs.length?errs:'ninguno');
ws.close();
