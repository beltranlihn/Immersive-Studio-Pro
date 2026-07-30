/* [R230] Verificación de la Etapa 2: visor 2D partido (muros | piso) en la sala 360.
   Comprueba: geometría de los paneles, ida y vuelta pantalla↔marco por panel, arrastre del divisor
   (con persistencia), interruptor de piso, pan/zoom por panel y arrastre de clip POR PANEL.
   Uso: npx electron . --remote-debugging-port=9222   y luego   node scratchpad/r230-split.mjs           */
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
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const cmd = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, m => m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result)); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async expr => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, timeout: 60000 }); if (r.exceptionDetails) throw new Error('threw: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)); return r.result.value; };
const shot = async name => { const { data } = await cmd('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(SHOTS + name, Buffer.from(data, 'base64')); return SHOTS + name; };
const wait = ms => new Promise(r => setTimeout(r, ms));

await ev(`(function(){ window.__errs=[]; window.addEventListener('error',e=>window.__errs.push(String(e.message||e)));
  window.addEventListener('unhandledrejection',e=>window.__errs.push('rej: '+String((e.reason&&e.reason.message)||e.reason)));
  const ce=console.error; console.error=function(){ try{window.__errs.push('con: '+[...arguments].map(String).join(' '));}catch(_){} return ce.apply(console,arguments); }; return 'hooked'; })()`);

/* Helper de puntero: dispara la secuencia real down→move→up sobre #gridc, en px relativos al canvas. */
await ev(`window.__drag=function(x0,y0,x1,y1,opts){ opts=opts||{};
  const g=document.getElementById('grid'), r=g.getBoundingClientRect();
  const mk=(t,x,y)=>new PointerEvent(t,{clientX:r.left+x,clientY:r.top+y,button:0,buttons:1,bubbles:true,pointerId:1,
    shiftKey:!!opts.shift,altKey:!!opts.alt});
  g.dispatchEvent(mk('pointerdown',x0,y0)); g.dispatchEvent(mk('pointermove',x1,y1)); g.dispatchEvent(mk('pointerup',x1,y1));
  window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:1})); return 1; };
window.__clipPt=function(id){ const c=state.clips.find(c=>c.id===id); if(!c)return null; const m=mediaById(c.mediaId);
  const P=clipPanel(c), M=flatMap(P), pl=flatPlace(c,m,state.playhead,clipSurfA(c));
  const p=M.px(pl.fc[0]/M.Fx, pl.fc[1]/M.Fy); return {x:p[0],y:p[1],panel:P.surf}; };
'helpers ok'`);

await ev(`(async()=>{ try{ await startDemoProject('room'); }catch(e){ window.__demoErr=String(e&&e.message||e); } })()`);
await wait(2200);
await ev(`(function(){ try{ if(typeof _tourStop==='function')_tourStop(); const o=document.getElementById('tourOv'); if(o)o.remove(); }catch(e){}
  try{ localStorage.removeItem('ispRoomVp'); }catch(_){}
  state.view.roomDiv=undefined; state.view.roomFloor=undefined; if(state.view.vp)delete state.view.vp;
  const b=document.querySelector('#viewModeSeg button[data-v="2d"]'); if(b)b.click();
  state.playhead=6; updModeUI(); resize(); renderTimeline(); return 1; })()`);
await wait(700);

const out = {};
out.demoErr = await ev(`window.__demoErr||null`);

// ---------- 1 · geometría de los paneles ----------
out.panels = await ev(`(function(){ const ps=vpPanels();
  return { n:ps.length, split:vpSplitOn(), floorOn:vpFloorOn(), divX:vpDivX(), cw:view.cw, ch:view.ch,
    ps:ps.map(P=>({surf:P.surf,rx0:P.rx0,rx1:P.rx1,ry0:P.ry0,ry1:P.ry1,x:P.x,y:P.y,w:P.w,h:P.h})) }; })()`);

// ---------- 2 · ida y vuelta pantalla↔marco, y panel correcto bajo el puntero ----------
out.roundtrip = await ev(`(function(){ const out=[];
  for(const P of vpPanels()){ const M=flatMap(P);
    for(const [fx,fy] of [[0,0],[-0.7,0.4],[0.8,-0.6]]){ const p=M.px(fx,fy); const b=pix2frame(p[0],p[1],P);
      out.push({surf:P.surf,fx,fy,dx:+(b[0]-fx).toFixed(6),dy:+(b[1]-fy).toFixed(6),
        at:(vpPanelAt(p[0],p[1])||{}).surf===undefined?null:(vpPanelAt(p[0],p[1])||{}).surf}); } }
  return out; })()`);

// ---------- 3 · botón de piso en la barra ----------
out.floorBtn = await ev(`(function(){ const b=document.querySelector('#dispSeg button[data-d="floor"]');
  return b?{vis:b.style.display!=='none',on:b.classList.contains('on')}:null; })()`);

await ev(`(function(){ const b=document.querySelector('#viewModeSeg button[data-v="2d"]'); if(b&&!b.classList.contains('on'))b.click(); state.selId=null; render(); return 1; })()`);
await wait(300); await shot('split-default.png');

// ---------- 4 · arrastre de clip en el panel del PISO ----------
const clips = await ev(`state.clips.map(c=>({id:c.id,lane:c.lane,surf:(state.lanes[c.lane]||{}).surf||null}))`);
const wallClip = clips.find(c => c.surf === 'wall');
const floorClip = clips.find(c => c.surf === 'floor');

const dragTest = async (clip, dx) => {
  await ev(`(function(){ state.selId=${clip.id}; state.selIds=[${clip.id}];
    const c=state.clips.find(c=>c.id===${clip.id}); Object.assign(c.props,{x:0,y:0,scale:60,rot:0}); render(); return 1; })()`);
  const p0 = await ev(`__clipPt(${clip.id})`);
  await ev(`__drag(${p0.x},${p0.y},${p0.x + dx},${p0.y})`);
  await wait(150);
  const p1 = await ev(`__clipPt(${clip.id})`);
  const st = await ev(`(function(){ const c=state.clips.find(c=>c.id===${clip.id});
    const SR=clipSurfRect(c); return {x:c.props.x,y:c.props.y,lane:c.lane,surf:SR&&SR.surf,panel:clipPanel(c).surf}; })()`);
  return { panel: p0.panel, from: [Math.round(p0.x), Math.round(p0.y)], to: [Math.round(p1.x), Math.round(p1.y)],
    dxWanted: dx, dxGot: +(p1.x - p0.x).toFixed(1), dyGot: +(p1.y - p0.y).toFixed(1), ...st };
};
out.dragFloor = await dragTest(floorClip, 60);
await shot('drag-floor.png');
out.dragWall = await dragTest(wallClip, 60);
await shot('drag-wall.png');

// ---------- 5 · arrastre del divisor + persistencia ----------
out.divBefore = await ev(`state.view.roomDiv==null?null:+state.view.roomDiv.toFixed(4)`);
{ const dvx = (await ev(`vpDivX()`)), cw = (await ev(`view.cw`));
  await ev(`__drag(${dvx},200,${Math.round(cw * 0.4)},200)`); }
await wait(250);
out.divAfter = await ev(`(function(){ const ps=vpPanels(); return {roomDiv:+(state.view.roomDiv||0).toFixed(4),
  wallW:Math.round(ps[0].w), floorX:Math.round(ps[1].x), floorW:Math.round(ps[1].w),
  saved:localStorage.getItem('ispRoomVp')}; })()`);
await shot('split-div-40.png');

// ---------- 6 · interruptor de piso ----------
await ev(`document.querySelector('#dispSeg button[data-d="floor"]').click()`);
await wait(300);
out.floorOff = await ev(`(function(){ const ps=vpPanels(), b=document.querySelector('#dispSeg button[data-d="floor"]');
  return { n:ps.length, surf:ps[0].surf, w:Math.round(ps[0].w), cw:Math.round(view.cw), btnOn:b.classList.contains('on'),
    saved:localStorage.getItem('ispRoomVp'), divX:vpDivX() }; })()`);
await shot('floor-off.png');
await ev(`document.querySelector('#dispSeg button[data-d="floor"]').click()`);
await wait(300);
out.floorBack = await ev(`(function(){ const ps=vpPanels(); return {n:ps.length,btnOn:document.querySelector('#dispSeg button[data-d="floor"]').classList.contains('on')}; })()`);

// ---------- 7 · pan/zoom POR panel ----------
out.panzoom = await ev(`(function(){ const ps=vpPanels(); const g=document.getElementById('grid'), r=g.getBoundingClientRect();
  const fl=ps[1], pt=[fl.x+fl.w/2, fl.h/2];
  const before={wall:JSON.parse(JSON.stringify(vpState('wall'))), floor:JSON.parse(JSON.stringify(vpState('floor')))};
  g.dispatchEvent(new WheelEvent('wheel',{clientX:r.left+pt[0],clientY:r.top+pt[1],deltaY:-240,bubbles:true,cancelable:true}));
  const after={wall:JSON.parse(JSON.stringify(vpState('wall'))), floor:JSON.parse(JSON.stringify(vpState('floor')))};
  return {before,after}; })()`);

// pan con shift dentro del panel de los muros: no debe tocar el par del piso
out.panWall = await ev(`(function(){ const ps=vpPanels(), wp=ps[0];
  const b={wall:[...vpState('wall').pan], floor:[...vpState('floor').pan]};
  __drag(wp.x+wp.w/2, wp.h/2, wp.x+wp.w/2+50, wp.h/2, {shift:true});
  return {before:b, after:{wall:vpState('wall').pan.map(v=>+v.toFixed(4)), floor:vpState('floor').pan.map(v=>+v.toFixed(4))}}; })()`);

// ---------- 8 · 3D y sala legacy (sin surf) siguen con un solo panel ----------
out.legacy = await ev(`(function(){ const keep=state.lanes.map(l=>l.surf); state.lanes.forEach(l=>{ delete l.surf; });
  const n=vpPanels().length, sp=vpSplitOn(); state.lanes.forEach((l,i)=>{ if(keep[i])l.surf=keep[i]; });
  return {panels:n, split:sp}; })()`);
await ev(`(function(){ const b=document.querySelector('#viewModeSeg button[data-v="3d"]'); if(b)b.click(); return 1; })()`);
await wait(800);
out.in3d = await ev(`({panels:vpPanels().length, split:vpSplitOn(), div:vpDivX()})`);
await shot('room-3d.png');
await ev(`(function(){ const b=document.querySelector('#viewModeSeg button[data-v="2d"]'); if(b)b.click(); return 1; })()`);
await wait(400);

out.errs = await ev(`window.__errs.slice(0,20)`);
console.log(JSON.stringify(out, null, 1));
console.log('SHOTS', SHOTS);
ws.close();
