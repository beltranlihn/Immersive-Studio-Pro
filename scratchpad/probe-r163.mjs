import { targets } from './cdp.mjs';
const wait = ms => new Promise(r => setTimeout(r, ms));
let idx = null;
for (let i = 0; i < 120; i++) { const l = await targets(9222).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(150); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws')); });
let _id = 0;
const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error('threw: ' + JSON.stringify(r.exceptionDetails).slice(0, 400)); return r.result.value; };
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false, screenWidth: 1600, screenHeight: 900 });
await send('Page.reload', { ignoreCache: true }); await wait(2000);
for (let i = 0; i < 60; i++) { try { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")')) break; } catch (e) {} await wait(400); }
await evl(`(()=>{ try{localStorage.setItem('dspOnboardV1','1')}catch(e){} document.querySelectorAll('.overlay,#tourOv,#landingOv').forEach(o=>o.remove()); document.body.classList.remove('preboot'); try{resize();}catch(e){} return 1; })()`);
await evl(`(async()=>{ state.dirty=false; await buildDemoProject(); return 1; })()`); await wait(700);

// ── A · modo automatización: ¿el mínimo respeta los desplegables y colapsa al pasarse?
await evl(`(()=>{ const b=document.getElementById('curvesBtn'); if(b&&!state.inlineCurves)b.click(); return state.inlineCurves; })()`); await wait(600);
const box = await evl(`(()=>{const r=document.getElementById('tlscroll').getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};})()`);
const medir = `(()=>{ const heads=[...document.querySelectorAll('#trackHdr .lanehdr')].filter(h=>!h.classList.contains('aud'));
  const h0=heads[0]; const ac=h0&&h0.querySelector('.autoctl');
  return { automode:document.body.classList.contains('automode')||!!state.inlineCurves,
    alturas:state.lanes.map((l,i)=>laneH(i)), colapsadas:state.lanes.map(l=>!!l.collapsed),
    cabecera:h0?Math.round(h0.getBoundingClientRect().height):null,
    selectores:ac?Math.round(ac.getBoundingClientRect().height):0,
    selectoresVisibles:!!(ac&&getComputedStyle(ac).display!=='none'&&ac.getBoundingClientRect().height>0) }; })()`;
console.log('auto · inicio   ', JSON.stringify(await evl(medir)));
for (let i = 0; i < 10; i++) await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: box.x, y: box.y, deltaX: 0, deltaY: 120, modifiers: 1 });
await wait(400);
console.log('auto · ×10 abajo', JSON.stringify(await evl(medir)));
for (let i = 0; i < 15; i++) await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: box.x, y: box.y, deltaX: 0, deltaY: 120, modifiers: 1 });
await wait(400);
console.log('auto · a tope   ', JSON.stringify(await evl(medir)));
await evl(`(()=>{ state.lanes.forEach(l=>{delete l.h;l.collapsed=false;}); const b=document.getElementById('curvesBtn'); if(b&&state.inlineCurves)b.click(); renderTimeline(); return 1; })()`);
await wait(400);

// ── B · el clip huérfano tras guardar/abrir: reproducir el escenario del paso 14+15
console.log('\n-- huérfano --');
console.log('antes de nada  ', JSON.stringify(await evl(`({clips:state.clips.length, medios:state.media.length, huerfanos:state.clips.filter(c=>!mediaById(c.mediaId)).length})`)));
console.log('tras copiar×10 ', JSON.stringify(await evl(`(()=>{ const c=state.clips[0]; state.selIds=[c.id]; state.selId=c.id;
  for(let i=0;i<10;i++){ copyClip(); pasteClip(); }
  return {clips:state.clips.length, medios:state.media.length, huerfanos:state.clips.filter(c=>!mediaById(c.mediaId)).length}; })()`)));
console.log('tras round-trip', JSON.stringify(await evl(`(async()=>{ const j=JSON.stringify(serProject()); loadProject(JSON.parse(j)); await new Promise(r=>setTimeout(r,400));
  const h=state.clips.filter(c=>!mediaById(c.mediaId));
  return {clips:state.clips.length, medios:state.media.length, huerfanos:h.length,
    detalle:h.slice(0,3).map(c=>({nombre:c.name, mediaId:c.mediaId, pista:c.lane, ajuste:!!c.adjust}))}; })()`)));
ws.close();
