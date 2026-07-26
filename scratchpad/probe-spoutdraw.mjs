// ¿Por qué el clip Spout no aparece en el composite? Control: una FORMA en el MISMO sitio.
// Si la forma se ve y el Spout no, el problema está en el medio; si no se ve ninguna, leo donde no toca.
import { targets } from './cdp.mjs';
const wait = ms => new Promise(r => setTimeout(r, ms));
let idx = null;
for (let i = 0; i < 150; i++) { const l = await targets(9222).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(200); }
if (!idx) { console.log('sin editor'); process.exit(1); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws')); });
let _id = 0;
const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 400) }; return r.result.value; };
await send('Page.reload', { ignoreCache: true }); await wait(2400);
for (let i = 0; i < 80; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await evl(`(()=>{try{localStorage.setItem('dspOnboardV1','1')}catch(e){}document.querySelectorAll('.overlay,#tourOv,#landingOv').forEach(o=>o.remove());document.body.classList.remove('preboot');try{resize()}catch(e){}return 1})()`);
await evl(`(async()=>{state.dirty=false;await buildDemoProject();return 1})()`); await wait(800);

const LEER = `(()=>{ const px=new Uint8Array(4*64*64); gl.bindFramebuffer(gl.FRAMEBUFFER,compFBO);
  gl.readPixels(Math.round(compSize/2)-32,Math.round(compSize/2)-32,64,64,gl.RGBA,gl.UNSIGNED_BYTE,px);
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  let n=0,s=0; for(let k=0;k<px.length;k+=4){ const v=(px[k]+px[k+1]+px[k+2])/3; s+=v; if(v>18)n++; }
  return {conLuz:n, brillo:+(s/(px.length/4)).toFixed(1)}; })()`;

console.log(JSON.stringify(await evl(`(async()=>{
  const R={};
  // dejar la escena vacía para que nada más entre en el muestreo
  state.clips.length=0; render(); await new Promise(r=>setTimeout(r,200));
  R.vacio = ${LEER};

  const li=state.lanes.map((l,i)=>i).filter(i=>state.lanes[i].kind!=='audio').slice(-1)[0];
  const props={az:0,el:90,size:120,rot:0,opacity:100};

  // control: forma blanca al cenit
  const sm={id:uid(),kind:'shape',name:'ctl',shape:'rect',fill:'#FFFFFF',stroke:'#000',strokeW:0,w:256,h:256,dur:5,missing:false,_loading:false,color:'#fff'};
  state.media.push(sm); renderShapeMedia(sm);
  const sc={id:uid(),name:'ctl',mediaId:sm.id,lane:li,start:0,dur:10,inP:0,props:{...props},kf:{},color:'#fff',fadeIn:0,fadeOut:0};
  state.clips.push(sc); state.playhead=2; render(); await new Promise(r=>setTimeout(r,300));
  R.controlForma = ${LEER};
  state.clips.length=0; render(); await new Promise(r=>setTimeout(r,150));

  // el Spout, mismo sitio
  const srcs=DSP.spout.inList(); if(!srcs.length) return {...R, sinEmisores:true};
  const sp=makeSpoutMedia(srcs[0]);
  for(let i=0;i<120;i++){ if(sp._spLive) break; await new Promise(r=>setTimeout(r,80)); }
  const pc={id:uid(),name:sp.name,mediaId:sp.id,lane:li,start:0,dur:10,inP:0,props:{...props},kf:{},color:sp.color,fadeIn:0,fadeOut:0};
  state.clips.push(pc); render(); await new Promise(r=>setTimeout(r,500)); render();
  R.spout = ${LEER};
  R.medio = { vivo:!!sp._spLive, w:sp.w, h:sp.h, texW:sp._texW, texH:sp._texH, hayTex:!!sp.tex, missing:!!sp.missing, dur:sp.dur };
  R.clipVisible = (()=>{ const t=state.playhead; return t>=pc.start && t<pc.start+pc.dur; })();
  // ¿drawClip llega a ejecutarse para este clip?
  let llamadas=0; const orig=drawClip;
  try{ window.drawClip=function(c,m,t,xf){ if(m&&m.kind==='spout')llamadas++; return orig.apply(this,arguments); };
       render(); await new Promise(r=>setTimeout(r,200)); }catch(e){ R.errorEspia=String(e.message); }
  R.drawClipLlamado = llamadas;
  return R; })()`), null, 2));
ws.close();
