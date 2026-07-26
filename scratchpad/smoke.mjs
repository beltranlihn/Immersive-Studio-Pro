// PRUEBA FUNCIONAL — recorre lo que haría un editor: crear, importar, mover/recortar con snap, efectos,
// automatización, composición, nest, secuencias, cambio de modo, guardar/abrir y un render de un frame.
import { targets } from './cdp.mjs';
import fs from 'fs';
const wait = ms => new Promise(r => setTimeout(r, ms));
let idx = null;
for (let i = 0; i < 140; i++) { const l = await targets(9222).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(150); }
if (!idx) { console.log('sin editor'); process.exit(1); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws')); });
let _id = 0;
const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
const raw = async e => send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true });
const errors = [];
await send('Runtime.enable', {});
ws.addEventListener('message', ev => { const x = JSON.parse(ev.data); if (x.method === 'Runtime.consoleAPICalled' && x.params.type === 'error') errors.push((x.params.args || []).map(a => a.value || a.description || '').join(' ').slice(0, 160)); });
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false, screenWidth: 1600, screenHeight: 900 });
await send('Page.reload', { ignoreCache: true }); await wait(1900);
for (let i = 0; i < 60; i++) { const r = await raw('typeof state!=="undefined" && !!document.getElementById("tracks")'); if (r.result && r.result.value) break; await wait(400); }
await raw(`(()=>{ try{localStorage.setItem('dspOnboardV1','1')}catch(e){} document.querySelectorAll('.overlay,#tourOv,#landingOv').forEach(o=>o.remove()); document.body.classList.remove('preboot'); try{resize();}catch(e){} return 1; })()`);
await wait(400);

const R = [];
async function step(name, expr) {
  try {
    const r = await raw(`(async()=>{ ${expr} })()`);
    if (r.exceptionDetails) { R.push({ paso: name, ok: false, detalle: (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text || '').slice(0, 200) }); return null; }
    R.push({ paso: name, ok: true, detalle: r.result.value });
    return r.result.value;
  } catch (e) { R.push({ paso: name, ok: false, detalle: String(e.message).slice(0, 200) }); return null; }
}

await step('crear proyecto domo', `await newProject('dome',2048,2048,60,180); return {mode:activeSeq().mode,w:activeSeq().w,cov:state.seqCov};`);
await step('escena demo (formas + clips)', `await buildDemoProject(); return {clips:state.clips.length,media:state.media.length,lanes:state.lanes.length};`);
await step('render del composite', `render(); const g=document.getElementById('gl').getContext('webgl2'); return {glPerdido:g.isContextLost()};`);
await step('mover un clip (snap entre objetos)', `const c=state.clips[0]; const s0=c.start; c.start=state.clips[1]?state.clips[1].start+state.clips[1].dur+0.02:1.02;
  const sn=applySnap(c.start,c.id); return {antes:+s0.toFixed(2), pedido:+c.start.toFixed(2), snapA:sn.snap==null?null:+sn.snap.toFixed(2)};`);
await step('recortar (trim) un clip', `const c=state.clips[0]; const d0=c.dur; c.dur=Math.max(0.2,c.dur-0.5); renderTimeline(); return {antes:+d0.toFixed(2),ahora:+c.dur.toFixed(2)};`);
await step('cortar con razor', `const c=state.clips[0]; const n0=state.clips.length; razorClip(c, c.start+c.dur/2); renderTimeline(); return {clipsAntes:n0,clipsDespues:state.clips.length};`);
await step('añadir efecto reactivo', `const c=state.clips.find(x=>x.kind!=='audio')||state.clips[0]; state.selIds=[c.id]; state.selId=c.id;
  addFxToClip(c,'blur',true); renderInspector(); return {fx:(c.fx||[]).length, tipo:(c.fx||[])[0]&&c.fx[0].type};`);
await step('keyframe de automatización', `const c=selClip(); setKf(c,'opacity',0.5,60); setKf(c,'opacity',1.5,10); renderTimeline();
  return {kfs:(c.kf&&c.kf.opacity||[]).length, evalMedio:+evalP(c,'opacity',1.0).toFixed(1)};`);
await step('modo automatización', `if(!state.inlineCurves)document.getElementById('curvesBtn').click(); await new Promise(r=>setTimeout(r,250));
  return {automode:document.body.classList.contains('automode'), curvas:document.querySelectorAll('#tracks canvas').length, fadesVisibles:[...document.querySelectorAll('.clip .fadeh')].filter(f=>getComputedStyle(f).display!=='none').length};`);
await step('salir de automatización', `if(state.inlineCurves)document.getElementById('curvesBtn').click(); await new Promise(r=>setTimeout(r,250)); return {automode:document.body.classList.contains('automode')};`);
await step('composición (Compose)', `const vis=state.media.filter(m=>m.kind!=='audio'&&m.kind!=='adjust'&&!isSeqMedia(m)).slice(0,3);
  const m=createComposition?createComposition({ids:vis.map(x=>x.id),layout:'ring',count:6}):null; renderMedia(); return {creada:!!m, media:state.media.length};`);
await step('anidar selección (nest)', `state.selIds=state.clips.slice(0,2).map(c=>c.id); state.selId=state.selIds[0]; const n0=state.media.length;
  nestSelection(); renderTimeline(); renderMedia(); return {mediaAntes:n0, mediaDespues:state.media.length, nests:state.media.filter(isSeqMedia).length};`);
await step('capa de ajuste', `const m=newAdjustMedia?newAdjustMedia():null; if(m)state.media.push(m); renderMedia(); return {ajuste:!!m};`);
await step('nueva secuencia + cambiar', `const n0=state.openSeqs.length; const s=newSeqMedia('Prueba',60,1920,1080,null,null,'flat'); state.media.push(s); state.openSeqs.push(s.id);
  switchSeq(s.id); renderSeqBar(); return {seqs:state.openSeqs.length, modo:activeSeq().mode, flat:isFlat()};`);
await step('volver a la secuencia domo', `const d=state.media.filter(isSeqMedia).find(m=>m.mode==='dome'); if(d)switchSeq(d.id); render(); return {modo:activeSeq().mode};`);
await step('cambiar a 3D y a Viewer', `document.querySelector('#viewModeSeg button[data-v="3d"]').click(); await new Promise(r=>setTimeout(r,300));
  document.querySelector('#threeModeSeg button[data-m="spec"]').click(); await new Promise(r=>setTimeout(r,300)); render();
  return {modo:state.view.mode, three:state.view.three, fovVisible:getComputedStyle(document.getElementById('fovCtl')).display!=='none'};`);
await step('volver a 2D', `document.querySelector('#viewModeSeg button[data-v="2d"]').click(); await new Promise(r=>setTimeout(r,300)); render(); return {modo:state.view.mode};`);
await step('serializar y recargar el proyecto', `const j=JSON.parse(JSON.stringify(serProject())); const n0=state.clips.length; loadProject(j); render(); renderTimeline();
  return {clipsAntes:n0, clipsDespues:state.clips.length, media:state.media.length};`);
await step('render de un frame de export', `if(typeof renderExportFrame!=='function')return 'no existe';
  return {fn:typeof renderExportFrame, exportDialog:typeof openExport};`);
await step('undo / redo', `const n0=state.clips.length; pushUndo(); state.clips.pop(); const n1=state.clips.length; undo(); const n2=state.clips.length;
  return {antes:n0, trasBorrar:n1, trasUndo:n2, recuperado:n2===n0};`);
await step('grado de color por clip', `const c=state.clips.find(x=>x.kind!=='audio')||state.clips[0]; state.selIds=[c.id]; state.selId=c.id;
  c.props.exposure=20; c.props.saturation=-10; render(); renderInspector();
  return {filasColor:document.querySelectorAll('#colorRows .prow').length, ruedas:document.querySelectorAll('#colorRows .cwheel').length};`);
await step('paneles y menús', `const r={}; ['file','edit','project','window'].forEach(k=>{ const b=document.querySelector('.menubtn[data-menu="'+k+'"]'); if(b){ b.click(); r[k]=document.querySelectorAll('.menu button').length; closeMenu(); } else r[k]='FALTA'; }); return r;`);

const res = { pasos: R, errores: errors.length ? errors : 'ninguno' };
fs.writeFileSync('scratchpad/smoke.json', JSON.stringify(res, null, 2));
const fail = R.filter(x => !x.ok);
console.log(R.map(x => (x.ok ? '  ✓ ' : '  ✗ ') + x.paso.padEnd(34) + ' ' + JSON.stringify(x.detalle)).join('\n'));
console.log('\nFALLOS: ' + (fail.length || 'ninguno') + '   ERRORES DE CONSOLA: ' + (errors.length || 0));
if (errors.length) console.log(errors.slice(0, 6).join('\n'));
ws.close();
