import { targets } from './cdp.mjs';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let idx=null; for(let i=0;i<150;i++){const l=await targets(9222).catch(()=>[]);idx=l.find(t=>t.type==='page'&&/index\.html/.test(t.url||'')&&t.webSocketDebuggerUrl);if(idx)break;await wait(200);}
if(!idx){console.log('sin editor');process.exit(1);}
const ws=new WebSocket(idx.webSocketDebuggerUrl); await new Promise((r,j)=>{ws.onopen=r;ws.onerror=()=>j(new Error('ws'))});
let _id=0; const send=(m,p)=>new Promise((res,rej)=>{const id=++_id;const h=ev=>{const x=JSON.parse(ev.data);if(x.id!==id)return;ws.removeEventListener('message',h);x.error?rej(new Error(JSON.stringify(x.error))):res(x.result)};ws.addEventListener('message',h);ws.send(JSON.stringify({id,method:m,params:p}))});
const errs=[]; await send('Runtime.enable',{});
ws.addEventListener('message',ev=>{const x=JSON.parse(ev.data); if(x.method==='Runtime.consoleAPICalled'&&x.params.type==='error')errs.push((x.params.args||[]).map(a=>a.value||a.description||'').join(' ').slice(0,200));});
await send("Page.reload",{ignoreCache:true}); await wait(2400);
const evl=async e=>{const r=await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)return{ROTO:JSON.stringify(r.exceptionDetails).slice(0,400)};return r.result.value};
for(let i=0;i<80;i++){ if(await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")')===true)break; await wait(400); }
await evl(`(()=>{try{localStorage.setItem('dspOnboardV1','1')}catch(e){}document.querySelectorAll('.overlay,#tourOv,#landingOv').forEach(o=>o.remove());document.body.classList.remove('preboot');try{resize()}catch(e){}return 1})()`);
await evl(`(async()=>{state.dirty=false;await buildDemoProject();return 1})()`); await wait(800);

console.log('puente   ', JSON.stringify(await evl(`({ hayApi:!!(window.dsp&&window.dsp.spout&&window.dsp.spout.inList), emisores:(window.dsp&&window.dsp.spout&&window.dsp.spout.inList)?window.dsp.spout.inList():'sin api' })`)));
console.log('crear    ', JSON.stringify(await evl(`(async()=>{
  const srcs=DSP.spout.inList(); if(!srcs.length) return {sinEmisores:true};
  const m=makeSpoutMedia(srcs[0]);
  for(let i=0;i<120;i++){ if(m._spLive) break; await new Promise(r=>setTimeout(r,80)); }
  return { medio:m.name, vivo:!!m._spLive, w:m.w, h:m.h, miniatura:!!m.thumb, kind:m.kind }; })()`)));
console.log('en escena', JSON.stringify(await evl(`(async()=>{
  const m=state.media.find(x=>x.kind==='spout'); if(!m)return {sinMedio:true};
  const li=state.lanes.map((l,i)=>i).filter(i=>state.lanes[i].kind!=='audio').slice(-1)[0];
  state.clips.push({id:uid(),name:m.name,mediaId:m.id,lane:li,start:0,dur:10,inP:0,props:{az:0,el:90,size:120,rot:0},kf:{},color:m.color,fadeIn:0,fadeOut:0});
  state.playhead=2; renderTimeline(); render();
  await new Promise(r=>setTimeout(r,600)); render();
  // leer el composite: ¿llegó la imagen de TouchDesigner al domo?
  const px=new Uint8Array(4*64*64); gl.bindFramebuffer(gl.FRAMEBUFFER,compFBO);
  gl.readPixels(Math.round(compSize/2)-32,Math.round(compSize/2)-32,64,64,gl.RGBA,gl.UNSIGNED_BYTE,px);
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  let claros=0,suma=0; for(let k=0;k<px.length;k+=4){ const v=(px[k]+px[k+1]+px[k+2])/3; suma+=v; if(v>18)claros++; }
  return { pixelesLeidos:px.length/4, conLuz:claros, brilloMedio:+(suma/(px.length/4)).toFixed(1), glPerdido:!!(gl&&gl.isContextLost&&gl.isContextLost()) }; })()`)));
console.log('guardar  ', JSON.stringify(await evl(`(async()=>{
  const j=JSON.stringify(serProject()); loadProject(JSON.parse(j)); await new Promise(r=>setTimeout(r,900));
  const m=state.media.find(x=>x.kind==='spout');
  for(let i=0;i<100;i++){ if(m&&m._spLive) break; await new Promise(r=>setTimeout(r,80)); }
  return { sobrevive:!!m, fuente:(m&&m.spoutSource)||"(indefinido)", reenganchado:!!(m&&m._spLive), w:m&&m.w, h:m&&m.h }; })()`)));
console.log('borrar   ', JSON.stringify(await evl(`(()=>{ const m=state.media.find(x=>x.kind==='spout');
  closeSpoutMedia(m); state.media=state.media.filter(x=>x.id!==m.id); state.clips=state.clips.filter(c=>c.mediaId!==m.id);
  renderMedia(); renderTimeline(); render();
  return { medios:state.media.filter(x=>x.kind==='spout').length, glPerdido:!!(gl&&gl.isContextLost&&gl.isContextLost()) }; })()`)));
await wait(600);
console.log('errores :', errs.length?errs:'ninguno');
ws.close();
