/* [R230] Verificación por PÍXELES de la Etapa 1 del visor 360 (colocación por superficie).
   Lee el FBO composite directamente (no la pantalla) y mide cobertura por región:
     - tira de muros  = [0,W] x [0,stripH]        (px del lienzo, y hacia abajo)
     - rect del piso  = [Front.x0,Front.x1] x [stripH,H]
   Comprueba: (1) seam wrap en muros, (2) el piso NO invade los muros, (3) el fold-wrap piso→muro ya no ocurre.
   Uso: npx electron . --remote-debugging-port=9222   y luego   node scratchpad/r230-surfaces.mjs          */
import http from 'http'; import fs from 'fs'; import os from 'os'; import path from 'path';
const port = 9222;
const SHOTS = (process.env.ISP_SHOTS || path.join(os.tmpdir(), 'isp-r230')) + path.sep;
try { fs.mkdirSync(SHOTS, { recursive: true }); } catch (_) {}

const targets = () => new Promise((res, rej) => {
  http.get({ host: '127.0.0.1', port, path: '/json/list' }, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej);
});
const page = (await targets()).find(t => t.type === 'page' && t.webSocketDebuggerUrl);
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws fail')); });
let id = 0; const pend = new Map();
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const cmd = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, m => m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result)); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async expr => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, timeout: 60000 }); if (r.exceptionDetails) throw new Error('threw: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)); return r.result.value; };
const shot = async name => { const { data } = await cmd('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(SHOTS + name, Buffer.from(data, 'base64')); return SHOTS + name; };
const wait = ms => new Promise(r => setTimeout(r, ms));

await ev(`(function(){ window.__errs=[]; window.addEventListener('error',e=>window.__errs.push(String(e.message||e)));
  window.addEventListener('unhandledrejection',e=>window.__errs.push('rej: '+String((e.reason&&e.reason.message)||e.reason)));
  const ce=console.error; console.error=function(){ try{window.__errs.push('con: '+[...arguments].map(String).join(' '));}catch(_){} return ce.apply(console,arguments); }; return 'hooked'; })()`);

/* Sonda instalada en la página: compone a compFBO y cuenta píxeles NO negros por región.
   Se compone a un tamaño MÍNIMO (512) — la GPU de dev se cae en renders grandes (CLAUDE.md). */
await ev(`window.__probe=function(opts){
  const as=activeSeq(), room=as&&as.room; if(!room)return {err:'no room'};
  const W=as.w||1, H=as.h||1, stripH=Math.min(H,room.stripH||H);
  const fw=(room.walls||[]).find(w=>w.role==='Front')||(room.walls||[])[0];
  const fx0=fw?fw.x0:0, fx1=fw?fw.x1:W;
  const S=512, prevSize=compSize; setCompSize(S);
  const fb=_drawFlat, ca=_compAspect, rw=_roomWrap;
  _drawFlat=true; _roomWrap=true; _compAspect=W/H;
  prepNests(state.clips,state.playhead,0);
  gl.bindFramebuffer(gl.FRAMEBUFFER,compFBO); composite(state.playhead,S,false);
  const buf=new Uint8Array(S*S*4); gl.readPixels(0,0,S,S,gl.RGBA,gl.UNSIGNED_BYTE,buf);
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  _drawFlat=fb; _compAspect=ca; _roomWrap=rw; setCompSize(prevSize);
  // px del lienzo -> px del FBO cuadrado (y hacia ARRIBA en el FBO)
  const A=W/H, sC=Math.min(2/A,2), FxC=sC*A/2, FyC=sC/2, K=2*FxC/W;
  const vX=px=>Math.round(((K*px-FxC)*0.5+0.5)*S), vY=py=>Math.round(((FyC-K*py)*0.5+0.5)*S);
  const lit=(x,y)=>{ const i=(y*S+x)*4; return (buf[i+3]>16 && (buf[i]+buf[i+1]+buf[i+2])>24); };
  function count(px0,px1,py0,py1){ const X0=Math.max(0,vX(px0)),X1=Math.min(S,vX(px1));
    const Y0=Math.max(0,vY(py1)),Y1=Math.min(S,vY(py0)); let n=0,tot=0; // vY invierte: py1 (abajo) -> Y menor
    for(let y=Y0;y<Y1;y++)for(let x=X0;x<X1;x++){ tot++; if(lit(x,y))n++; }
    return {lit:n,tot,pct:tot?+(100*n/tot).toFixed(2):0}; }
  const q=Math.max(1,Math.round((fx1-fx0)*0.35)); // franja de sondeo junto a cada costura
  return { W,H,stripH,fx0,fx1,
    wallsAll:   count(0,W,0,stripH),
    wallLeft:   count(0,q,0,stripH),
    wallRight:  count(W-q,W,0,stripH),
    floorAll:   count(fx0,fx1,stripH,H),
    floorOutL:  count(0,fx0,stripH,H),            // fuera del piso por la izquierda (debe quedar a 0)
    floorOutR:  count(fx1,W,stripH,H),            // fuera del piso por la derecha  (debe quedar a 0)
    wallsUnderFloorCols: count(fx0,fx1,0,stripH)  // filas de MURO en las columnas del piso
  };
}; 'probe ok'`);

const soloOnly = laneIdx => ev(`(function(){ state.lanes.forEach((l,i)=>{ if(l.kind==='video'){ l.solo=(i===${laneIdx}); l.mute=false; } }); return 1; })()`);
const setClip = (clipId, props) => ev(`(function(){ const c=state.clips.find(c=>c.id===${clipId}); if(!c)return 'no clip';
  Object.assign(c.props, ${JSON.stringify(props)}); return 1; })()`);

const out = {};
// Estado base: sala demo, vista 2D, sin tour
await ev(`(async()=>{ try{ await startDemoProject('room'); }catch(e){ window.__demoErr=String(e&&e.message||e); } })()`);
await wait(2000);
await ev(`(function(){ try{ if(typeof _tourStop==='function')_tourStop(); const o=document.getElementById('tourOv'); if(o)o.remove(); }catch(e){}
  const b=document.querySelector('#viewModeSeg button[data-v="2d"]'); if(b)b.click();
  state.playhead=6; render(); renderTimeline(); return 1; })()`);
await wait(600);
out.demoErr = await ev(`window.__demoErr||null`);

const lanes = await ev(`state.lanes.map((l,i)=>({i,name:l.name,surf:l.surf||null,kind:l.kind}))`);
const clips = await ev(`state.clips.map(c=>({id:c.id,lane:c.lane,surf:(state.lanes[c.lane]||{}).surf||null}))`);
const wallClip = clips.find(c => c.surf === 'wall');
const floorClip = clips.find(c => c.surf === 'floor');
console.log('LANES', JSON.stringify(lanes));
console.log('WALL CLIP', JSON.stringify(wallClip), ' FLOOR CLIP', JSON.stringify(floorClip));

// ---------- TEST 1 · muro: clip centrado (referencia) ----------
await soloOnly(wallClip.lane);
await setClip(wallClip.id, { x: 0, y: 0, scale: 60, rot: 0 });
out.wall_centered = await ev(`__probe()`);

// ---------- TEST 2 · muro: clip sobre la costura derecha → debe reaparecer por la izquierda ----------
await setClip(wallClip.id, { x: 100, y: 0, scale: 60, rot: 0 });
out.wall_seam = await ev(`__probe()`);
await ev(`render()`); await shot('wall-seam.png');

// ---------- TEST 3 · piso: clip empujado fuera de su borde → NO debe invadir muros ni salirse del rect ----------
await soloOnly(floorClip.lane);
await setClip(floorClip.id, { x: 0, y: 0, scale: 60, rot: 0 });
out.floor_centered = await ev(`__probe()`);

await setClip(floorClip.id, { x: 95, y: 95, scale: 90, rot: 0 });
out.floor_pushed = await ev(`__probe()`);
await ev(`render()`); await shot('floor-pushed.png');

// ---------- TEST 4 · piso: clip enorme (desborda por los 4 lados) ----------
await setClip(floorClip.id, { x: 0, y: 0, scale: 300, rot: 0 });
out.floor_huge = await ev(`__probe()`);
await ev(`render()`); await shot('floor-huge.png');

out.errs = await ev(`window.__errs.slice(0,20)`);
console.log(JSON.stringify(out, null, 1));
console.log('SHOTS', SHOTS);
ws.close();
