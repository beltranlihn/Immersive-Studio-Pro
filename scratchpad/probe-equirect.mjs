// [F7 fase 2] · autodetección 2:1 al importar + esfera completa en el visor 3D.
// El patrón es una rejilla equirect sintética con el hemisferio INFERIOR de un color que el domo NO puede
// mostrar: si ese color aparece en el visor 3D, la esfera está dibujando lo que el casquete descarta.
import { targets } from './cdp.mjs';
const wait = ms => new Promise(r => setTimeout(r, ms));
let idx = null;
for (let i = 0; i < 150; i++) { const l = await targets(9222).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(200); }
if (!idx) { console.log('sin editor'); process.exit(1); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws')); });
let _id = 0;
const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
const errs = []; await send('Runtime.enable', {});
ws.addEventListener('message', ev => { const x = JSON.parse(ev.data); if (x.method === 'Runtime.consoleAPICalled' && x.params.type === 'error') errs.push((x.params.args || []).map(a => a.value || a.description || '').join(' ').slice(0, 220)); });
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 400) }; return r.result.value; };
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false, screenWidth: 1600, screenHeight: 900 });
await send('Page.reload', { ignoreCache: true }); await wait(2400);
for (let i = 0; i < 80; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await evl(`(()=>{try{localStorage.setItem('dspOnboardV1','1')}catch(e){}document.querySelectorAll('.overlay,#tourOv,#landingOv').forEach(o=>o.remove());document.body.classList.remove('preboot');try{resize()}catch(e){}return 1})()`);
await evl(`(async()=>{state.dirty=false;await buildDemoProject();state.clips.length=0;render();return 1})()`); await wait(700);

// patrón equirect 4096×2048: arriba gris con rejilla, ABAJO magenta (sólo visible en la esfera)
console.log('detección', JSON.stringify(await evl(`(()=>{
  const W=4096,H=2048; const cv=document.createElement('canvas'); cv.width=W; cv.height=H; const x=cv.getContext('2d');
  x.fillStyle='#8A9199'; x.fillRect(0,0,W,H/2);
  x.fillStyle='#FF00AA'; x.fillRect(0,H/2,W,H/2);              // hemisferio inferior: el domo NO lo puede mostrar
  x.strokeStyle='rgba(255,255,255,0.5)'; x.lineWidth=3;
  for(let i=1;i<12;i++){ const px=W*i/12; x.beginPath();x.moveTo(px,0);x.lineTo(px,H);x.stroke(); }
  for(let j=1;j<6;j++){ const py=H*j/6; x.beginPath();x.moveTo(0,py);x.lineTo(W,py);x.stroke(); }
  const m={id:uid(),kind:'image',name:'equirect-prueba.png',el:cv,originalEl:cv,tex:newTex(),w:W,h:H,dur:6,fps:0,
    thumb:null,color:clipColorFor('image'),proxyReady:false,proxyPct:0,path:null,fsize:0,folder:null,missing:false,_loading:false};
  try{ upTex(m.tex,cv); }catch(e){}
  state.media.push(m);
  const antes=pareceEquirect(m);
  const li=state.lanes.map((l,i)=>i).filter(i=>state.lanes[i].kind!=='audio')[0];
  const c=makeClip(m,li,0); state.clips.push(c);
  // control: un 16:9 no debe marcarse
  const m2={id:uid(),kind:'image',name:'normal.png',w:3840,h:2160,dur:5,tex:newTex(),color:'#888',missing:false,_loading:false};
  const c2=makeClip(m2,li,0);
  renderTimeline(); renderInspector(); render();
  return { detecta2a1:antes, clipArrancaEquirect:!!c.props.equirect,
    control16a9Detectado:pareceEquirect(m2), control16a9Equirect:!!c2.props.equirect,
    chicoNoDetectado:!pareceEquirect({kind:'image',w:1024,h:512}) }; })()`)));

// esfera: ¿aparece el magenta del hemisferio inferior en el visor 3D en órbita?
console.log('esfera 3D', JSON.stringify(await evl(`(async()=>{
  const mide=()=>{ const W=glc.width,H=glc.height; const px=new Uint8Array(W*H*4);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null); gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,px);
    let magenta=0,total=0; for(let k=0;k<px.length;k+=4*29){ total++; const R=px[k],G=px[k+1],B=px[k+2];
      if(R>60&&B>40&&G<R*0.6&&G<B*0.9) magenta++; }
    return {magenta, total, proporcion:+(magenta/total).toFixed(4)}; };
  state.view.mode='2d'; render(); await new Promise(r=>setTimeout(r,300));
  const en2d=mide();
  state.view.mode='3d'; state.view.three='orbit'; try{updModeUI();}catch(e){} render(); await new Promise(r=>setTimeout(r,500)); render();
  const enOrbita=mide();
  state.view.three='spec'; render(); await new Promise(r=>setTimeout(r,500)); render();
  const enViewer=mide();
  state.view.mode='2d'; state.view.three='orbit'; render();
  return { en2d, enOrbita, enViewer,
    laEsferaSoloEnOrbita: enOrbita.magenta>0 && enViewer.magenta<=enOrbita.magenta*0.15,
    glPerdido:!!(gl&&gl.isContextLost&&gl.isContextLost()) }; })()`), null, 1));
await wait(400);
console.log('errores:', errs.length ? errs : 'ninguno');
ws.close();
