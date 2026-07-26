// Pantallazos de todas las zonas del editor pedidas por Beltrán, sobre una escena de mentira.
import fs from 'fs';
import { targets } from './cdp.mjs';
const wait = ms => new Promise(r => setTimeout(r, ms));
let idx = null;
for (let i = 0; i < 120; i++) { const l = await targets(9222).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(150); }
if (!idx) { console.log('no hay ventana del editor en el 9222'); process.exit(1); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws')); });
let _id = 0;
const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error('threw: ' + JSON.stringify(r.exceptionDetails).slice(0, 400)); return r.result.value; };
const errors = [];
await send('Runtime.enable', {});
ws.addEventListener('message', ev => { const x = JSON.parse(ev.data); if (x.method === 'Runtime.consoleAPICalled' && x.params.type === 'error') errors.push((x.params.args || []).map(a => a.value || a.description || '').join(' ').slice(0, 250)); });

const W = 1600, H = 900;
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false, screenWidth: W, screenHeight: H });
await send('Page.reload', { ignoreCache: true }); await wait(2100);
for (let i = 0; i < 60; i++) { try { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")')) break; } catch (e) {} await wait(400); }
await evl(`(()=>{ try{localStorage.setItem('dspOnboardV1','1')}catch(e){} document.querySelectorAll('.overlay,#tourOv,#landingOv').forEach(o=>o.remove()); document.body.classList.remove('preboot'); try{resize();}catch(e){} return 1; })()`);
await wait(400);

// ── escena de mentira: formas repartidas por las pistas, carpetas en Media, un clip de audio y algo de automatización
const n = await evl(`(async()=>{
  state.dirty=false; await buildDemoProject();
  const SH=[['rect','#8A8D5A'],['ellipse','#A8924C'],['rect','#5A8D7E'],['line','#8A6FA8'],['ellipse','#A85A5A'],['rect','#5A7FA8']];
  const NM=['Intro plate','Halo ring','Nebula wash','Grid lines','Bloom pass','Horizon bar','Star field','Vignette'];
  const mk=(i)=>{ const s=SH[i%SH.length]; const m={id:uid(),kind:'shape',name:NM[i%NM.length],shape:s[0],fill:s[1],stroke:'#0E0F11',strokeW:0,w:512,h:512,dur:6,missing:false,_loading:false,color:s[1]};
    state.media.push(m); return m; };
  const lay=[[0,0,4.5],[0,5.2,3.4],[1,1.2,5.0],[1,7.0,3.0],[2,0.6,6.2],[2,7.4,2.6],[3,2.0,4.0],[3,6.6,3.6]];
  const vids=state.lanes.map((l,i)=>i).filter(i=>state.lanes[i].kind!=='audio');
  const nuevos=[];
  lay.forEach((L,k)=>{ const m=mk(k); const li=vids[L[0]%vids.length]; if(li==null)return;
    const c={id:uid(),name:m.name,mediaId:m.id,lane:li,start:L[1],dur:L[2],inP:0,props:{},kf:{},color:m.color,fadeIn:0.4,fadeOut:0.5};
    state.clips.push(c); nuevos.push(c); });
  const ai=state.lanes.findIndex(l=>l.kind==='audio');
  if(ai>=0){ const am={id:uid(),kind:'audio',name:'Ambient bed.wav',dur:11,missing:false,_loading:false,color:'#5A8D7E'};
    state.media.push(am); state.clips.push({id:uid(),name:am.name,mediaId:am.id,lane:ai,start:0.8,dur:9.4,inP:0,props:{},kf:{},color:'#5A8D7E'}); }
  // carpetas en Media, con contenido repartido
  state.folders=['Plates','Plates/Sky','Overlays','Audio'];
  state.folderColors={'Plates':'#5A7FA8','Overlays':'#A8924C','Audio':'#5A8D7E'};
  const dest=['Plates','Plates/Sky','Overlays','Plates','Overlays','Plates/Sky'];
  state.media.filter(m=>m.kind==='shape').forEach((m,i)=>{ m.folder=dest[i%dest.length]; });
  state.media.filter(m=>m.kind==='audio').forEach(m=>{ m.folder='Audio'; });
  // automatización de verdad en dos clips, para que las curvas se vean
  if(nuevos[2]){ const c=nuevos[2]; c.kf.opacity=[{t:0,v:20,e:'inout'},{t:c.dur*0.45,v:100,e:'inout'},{t:c.dur,v:35,e:'inout'}]; }
  if(nuevos[4]){ const c=nuevos[4]; c.kf.size=[{t:0,v:60,e:'inout'},{t:c.dur*0.6,v:150,e:'inout'}]; c.kf.az=[{t:0,v:-40,e:'inout'},{t:c.dur,v:60,e:'inout'}]; }
  state.playhead=3.1; state.tl.pxPerSec=96;
  const c0=nuevos[4]||nuevos[0]; if(c0){ state.selIds=[c0.id]; state.selId=c0.id; }
  renderMedia(); renderTimeline(); renderInspector(); render(); return state.clips.length;
})()`);
await wait(1100);

const shot = async (name, clip) => {
  const c = await send('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale: 1 } });
  fs.writeFileSync('scratchpad/shots/' + name + '.png', Buffer.from(c.data, 'base64'));
};
const rect = async sel => await evl(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); if(!e)return null; const r=e.getBoundingClientRect(); return {x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height)};})()`);
try { fs.mkdirSync('scratchpad/shots', { recursive: true }); } catch (e) {}
const hechas = [];
const pad = (r, p = 6) => ({ x: Math.max(0, r.x - p), y: Math.max(0, r.y - p), width: Math.min(W, r.width + p * 2), height: Math.min(H, r.height + p * 2) });

// 1 · editor completo, modo normal
await evl(`(()=>{ if(state.inlineCurves){ const b=document.getElementById('curvesBtn'); if(b)b.click(); } return 1; })()`); await wait(600);
await shot('01-editor-completo', { x: 0, y: 0, width: W, height: H }); hechas.push('01-editor-completo');

// 2 · timeline con clips, modo normal
const tlY = await evl(`Math.round(document.querySelector('.transport').getBoundingClientRect().y)`);
await shot('02-timeline', { x: 0, y: tlY - 4, width: W, height: H - tlY + 4 }); hechas.push('02-timeline');

// 3 · panel Media con carpetas
const rMedia = await rect('#mediaPane') || await rect('.mediapane');
if (rMedia) { await shot('03-media-carpetas', pad(rMedia)); hechas.push('03-media-carpetas'); }

// 4 · inspector completo (secciones desplegadas)
await evl(`(()=>{ state.insCol={}; renderInspector(); document.querySelectorAll('#inspPane .sec').forEach(s=>s.classList.remove('col')); return 1; })()`); await wait(500);
const rIns = await rect('#inspPane');
if (rIns) { await shot('04-inspector', pad(rIns)); hechas.push('04-inspector'); }

// 5 · pestaña Reactive FX
await evl(`(()=>{ const t=document.querySelector('.instab[data-tab=react]'); if(t)t.click(); return 1; })()`); await wait(800);
const rRe = await rect('#insReactive');
if (rRe && rRe.height > 40) { await shot('05-reactive-fx', pad(rIns || rRe)); hechas.push('05-reactive-fx'); }

// 6 · inspector de audio (ecualizador)
await evl(`(()=>{ const t=document.querySelector('.instab[data-tab=insp]')||document.querySelector('.instab'); if(t)t.click();
  const c=state.clips.find(x=>{const m=mediaById(x.mediaId);return m&&m.kind==='audio';}); if(c){ state.selIds=[c.id]; state.selId=c.id; renderInspector(); } return !!c; })()`); await wait(800);
const rAud = await rect('#inspPane');
if (rAud) { await shot('06-inspector-audio-eq', pad(rAud)); hechas.push('06-inspector-audio-eq'); }

// 7 · timeline en modo automatización (con curvas y los desplegables de identidad)
await evl(`(()=>{ const c=state.clips.find(x=>x.kf&&Object.keys(x.kf).length); if(c){ state.selIds=[c.id]; state.selId=c.id; renderInspector(); }
  const b=document.getElementById('curvesBtn'); if(b&&!state.inlineCurves)b.click(); return state.inlineCurves; })()`); await wait(1000);
await shot('07-timeline-automatizacion', { x: 0, y: tlY - 4, width: W, height: H - tlY + 4 }); hechas.push('07-timeline-automatizacion');
const hdr = await rect('.trackhdr');
if (hdr) { await shot('07b-cabeceras-automatizacion', { x: 0, y: hdr.y, width: 420, height: Math.min(H - hdr.y, 360) }); hechas.push('07b-cabeceras-automatizacion'); }
await evl(`(()=>{ const b=document.getElementById('curvesBtn'); if(b&&state.inlineCurves)b.click(); return 1; })()`); await wait(500);

// 8 · visor 3D en Orbit
await evl(`(()=>{ if(typeof setViewMode==='function')setViewMode('3d'); else { const b=document.querySelector('#viewModeSeg [data-v="3d"]'); if(b)b.click(); }
  const o=document.querySelector('#threeModeSeg button[data-m="orbit"]'); if(o)o.click(); render(); return state.view.mode; })()`); await wait(1400);
const rV = await rect('main');
if (rV) { await shot('08-visor-3d-orbit', pad(rV, 2)); hechas.push('08-visor-3d-orbit'); }

// 9 · visor 3D en Viewer (persona)
await evl(`(()=>{ const v=document.querySelector('#threeModeSeg button[data-m="spec"]'); if(v)v.click(); render(); return state.view.three; })()`); await wait(1400);
if (rV) { await shot('09-visor-3d-viewer', pad(rV, 2)); hechas.push('09-visor-3d-viewer'); }

// 10 · barra del visor en los dos modos, recortada (para comparar que los botones no bailan)
const rBar = await rect('.vptool');
if (rBar) {
  await shot('10-barra-visor-viewer', pad(rBar, 3)); hechas.push('10-barra-visor-viewer');
  await evl(`(()=>{ const o=document.querySelector('#threeModeSeg button[data-m="orbit"]'); if(o)o.click(); return state.view.three; })()`); await wait(700);
  await shot('10b-barra-visor-orbit', pad(rBar, 3)); hechas.push('10b-barra-visor-orbit');
}
await evl(`(()=>{ if(typeof setViewMode==='function')setViewMode('2d'); render(); return 1; })()`); await wait(700);

console.log(JSON.stringify({ clips: n, capturas: hechas, errores: errors.length ? errors : 'ninguno' }, null, 2));
ws.close();
