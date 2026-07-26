// PRUEBA DE ROBUSTEZ — no repite la funcional (smoke.mjs). Aquí se busca romper la app como la rompería un
// editor de verdad: proyectos densos, guardar/abrir de ida y vuelta, borrar cosas que están en uso, deshacer en
// masa, casos vacíos, recursión de nests, cambio de idioma con paneles abiertos y render en los tres modos.
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
ws.addEventListener('message', ev => {
  const x = JSON.parse(ev.data);
  if (x.method === 'Runtime.consoleAPICalled' && x.params.type === 'error') errors.push('console: ' + (x.params.args || []).map(a => a.value || a.description || '').join(' ').slice(0, 200));
  if (x.method === 'Runtime.exceptionThrown') errors.push('uncaught: ' + ((x.params.exceptionDetails.exception && x.params.exceptionDetails.exception.description) || x.params.exceptionDetails.text || '').slice(0, 200));
});
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false, screenWidth: 1600, screenHeight: 900 });
await send('Page.reload', { ignoreCache: true }); await wait(2000);
for (let i = 0; i < 60; i++) { const r = await raw('typeof state!=="undefined" && !!document.getElementById("tracks")'); if (r.result && r.result.value) break; await wait(400); }
await raw(`(()=>{ try{localStorage.setItem('dspOnboardV1','1')}catch(e){} document.querySelectorAll('.overlay,#tourOv,#landingOv').forEach(o=>o.remove()); document.body.classList.remove('preboot'); try{resize();}catch(e){} return 1; })()`);
await wait(400);

const R = [];
async function step(name, expr) {
  const antes = errors.length;
  let val = null, ok = true, det = '';
  try {
    const r = await Promise.race([raw(`(async()=>{ ${expr} })()`), wait(25000).then(() => 'TIMEOUT')]);
    if (r === 'TIMEOUT') { ok = false; det = 'sin respuesta en 25s (¿un diálogo modal esperando?)'; await raw(`document.querySelectorAll('.overlay').forEach(o=>o.remove()); state.dirty=false;`); }
    else if (r.exceptionDetails) { ok = false; det = ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text || '').split('\n')[0].slice(0, 180); }
    else val = r.result.value;
  } catch (e) { ok = false; det = String(e.message).slice(0, 180); }
  await wait(120);
  const nuevos = errors.slice(antes);
  if (nuevos.length) { ok = false; det = (det ? det + ' · ' : '') + nuevos[0]; }
  R.push({ paso: name, ok, detalle: ok ? val : det });
  console.log((ok ? '  ✓ ' : '  ✗ ') + name.padEnd(52) + (typeof (ok ? val : det) === 'object' ? JSON.stringify(ok ? val : det) : (ok ? val : det) || ''));
  return val;
}
// tras cada bloque: ¿la app sigue viva y coherente?
const SANO = `renderTimeline(); renderInspector(); renderMedia(); render();
  const huerf=state.clips.filter(c=>!c.adjust&&!mediaById(c.mediaId)).length;
  const fuera=state.clips.filter(c=>c.lane==null||c.lane<0||c.lane>=state.lanes.length).length;
  const negativos=state.clips.filter(c=>!(c.dur>0)||c.start<0).length;
  return {clips:state.clips.length, pistas:state.lanes.length, medios:state.media.length, clipsSinMedio:huerf, clipsFueraDePista:fuera, duracionInvalida:negativos, glPerdido:!!(gl&&gl.isContextLost&&gl.isContextLost())};`;

// ── 1 · proyecto denso
await step('proyecto denso (nest dentro de nest, ajuste, fx, keyframes)', `
  state.dirty=false; await buildDemoProject();
  const vids=state.lanes.map((l,i)=>i).filter(i=>state.lanes[i].kind!=='audio');
  for(let k=0;k<10;k++){ const m={id:uid(),kind:'shape',name:'S'+k,shape:'rect',fill:'#5A8D7E',stroke:'#000',strokeW:0,w:256,h:256,dur:5,missing:false,_loading:false,color:'#5A8D7E'};
    state.media.push(m); state.clips.push({id:uid(),name:'S'+k,mediaId:m.id,lane:vids[k%vids.length],start:k*1.3,dur:3,inP:0,props:{az:k*10,el:35,size:55,rot:0},kf:{},color:'#5A8D7E',fadeIn:0.2,fadeOut:0.2}); }
  const c0=state.clips[state.clips.length-1]; c0.kf.opacity=[{t:0,v:0,e:'inout'},{t:1.5,v:100,e:'inout'},{t:3,v:0,e:'inout'}];
  addFxToClip(c0,'blur',true);
  state.selIds=state.clips.slice(-4).map(c=>c.id); state.selId=state.selIds[0]; nestSelection();
  state.selIds=state.clips.slice(-3).map(c=>c.id); state.selId=state.selIds[0]; nestSelection();
  makeAdjustClip();
  ${SANO}`);

// ── 2 · guardar y abrir de ida y vuelta, dos veces (la segunda sobre lo ya recargado)
await step('guardar/abrir ×2 (round-trip estable)', `
  const a=JSON.parse(JSON.stringify(serProject())); loadProject(a); await new Promise(r=>setTimeout(r,300));
  const n1={clips:state.clips.length,medios:state.media.length,pistas:state.lanes.length};
  const b=JSON.parse(JSON.stringify(serProject())); loadProject(b); await new Promise(r=>setTimeout(r,300));
  const n2={clips:state.clips.length,medios:state.media.length,pistas:state.lanes.length};
  render();
  return {primera:n1, segunda:n2, estable:JSON.stringify(n1)===JSON.stringify(n2)};`);

// ── 3 · borrar una pista que TIENE clips
await step('borrar una pista con clips dentro', `
  const li=state.lanes.findIndex(l=>l.kind!=='audio'&&state.clips.some(c=>c.lane===state.lanes.indexOf(l)));
  const li2=state.lanes.map((l,i)=>i).find(i=>state.lanes[i].kind!=='audio'&&state.clips.some(c=>c.lane===i));
  const antes=state.clips.length, pistasAntes=state.lanes.length;
  if(li2!=null) removeLane(li2);
  await new Promise(r=>setTimeout(r,250));
  const capas=[...document.querySelectorAll('.overlay')].map(o=>o.id||'(sin id)');
  const ok=document.querySelector('#confirmOv #cfOk'); const pidioConfirmacion=!!ok;
  if(ok)ok.click();   // appConfirm expone #confirmOv > #cfOk
  await new Promise(r=>setTimeout(r,250));
  ${SANO.replace('return {', 'return {pistasAntes, clipsAntes:antes, pidioConfirmacion, capas, ')}`);

// ── 4 · deshacer/rehacer en masa (30 operaciones)
await step('deshacer/rehacer ×30', `
  const firma=()=>JSON.stringify(state.clips.map(c=>[c.id,c.lane,Math.round(c.start*100),Math.round(c.dur*100)]));
  const f0=firma();
  for(let i=0;i<30;i++){ pushUndo(); const c=state.clips[i%state.clips.length]; if(c){c.start=Math.max(0,c.start+0.25);} }
  const fMov=firma();
  for(let i=0;i<30;i++) undo();
  const fUndo=firma();
  for(let i=0;i<30;i++) redo();
  const fRedo=firma();
  renderTimeline(); render();
  return {volvioAlOrigen:fUndo===f0, rehizo:fRedo===fMov, clips:state.clips.length};`);

// ── 5 · casos vacíos: proyecto sin clips
await step('proyecto vacío (render, automatización, inspector, export)', `
  state.clips.length=0; state.selIds=[]; state.selId=null;
  renderTimeline(); renderInspector(); render();
  const b=document.getElementById('curvesBtn'); if(b)b.click(); renderTimeline();
  if(b)b.click(); renderTimeline();
  const f=(typeof renderExportFrame==='function');
  return {sinClips:state.clips.length===0, curvasOk:true, exportFn:f};`);

// ── 6 · geometría absurda: duración cero, negativa, y clip más allá del final
await step('duraciones absurdas (0, negativa, fuera de rango)', `
  state.dirty=false; await buildDemoProject();
  const c=state.clips[0]; const orig={s:c.start,d:c.dur};
  c.dur=0; renderTimeline(); render();
  c.dur=-5; renderTimeline(); render();
  c.start=-3; renderTimeline(); render();
  c.dur=1e6; renderTimeline(); render();
  c.start=orig.s; c.dur=orig.d; renderTimeline(); render();
  return {sobrevive:true, clips:state.clips.length};`);

// ── 7 · cortar exactamente en los bordes del clip
await step('razor en los bordes exactos del clip', `
  state.dirty=false; await buildDemoProject();
  const c=state.clips[0]; const n0=state.clips.length;
  razorClip(c, c.start);               // justo al principio → no debe cortar
  razorClip(c, c.start+c.dur);         // justo al final → no debe cortar
  razorClip(c, c.start+c.dur/2);       // en medio → este SÍ debe cortar
  const cortos=state.clips.filter(x=>x.dur<=0.0001).length;
  renderTimeline(); render();
  return {antes:n0, ahora:state.clips.length, clipsDeDuracionCero:cortos};`);

// ── 8 · bucles de secuencia: directo (A dentro de A) e indirecto (A dentro de B, que ya vive en A)
//      OJO: addClip recibe el OBJETO media, no el id — con un id el guardia de bucle no llega a mirar nada.
await step('bucle de secuencia: directo e indirecto, ambos rechazados', `
  const li=()=>state.lanes.map((l,i)=>i).find(i=>state.lanes[i].kind!=='audio');
  const n0=state.clips.length; addClip(mediaById(state.activeSeqId), li(), 0);
  const directo=state.clips.length===n0;
  state.selIds=state.clips.slice(0,2).map(c=>c.id); state.selId=state.selIds[0]; nestSelection();
  const B=state.media.filter(m=>isSeqMedia(m)).slice(-1)[0]; const A=state.activeSeqId;
  switchSeq(B.id); const n1=state.clips.length; addClip(mediaById(A), li(), 0);
  const indirecto=state.clips.length===n1; switchSeq(A); render();
  return {directoRechazado:directo, indirectoRechazado:indirecto, glPerdido:!!(gl&&gl.isContextLost&&gl.isContextLost())};`);

// ── 9 · los tres modos de secuencia, con render de composite en cada uno
await step('render en dome / flat / room', `
  const out={};
  for(const modo of ['dome','flat','room']){
    state.seqMode=modo; if(modo==='room'&&!(activeSeq()&&activeSeq().room)) { out[modo]='sin sala configurada'; continue; }
    try{ updModeUI(); }catch(e){}
    render(); out[modo]=!(gl&&gl.isContextLost&&gl.isContextLost());
  }
  state.seqMode='dome'; try{updModeUI();}catch(e){} render();
  return out;`);

// ── 10 · cobertura del domo 180 → 220 en caliente
await step('cambiar la cobertura del domo en caliente (180→200→210→220)', `
  const out={};
  for(const cov of [180,200,210,220]){ state.seqCov=cov; const s=activeSeq(); if(s)s.cov=cov;
    try{ if(typeof buildDomeMesh==='function')buildDomeMesh(); }catch(e){ out['err'+cov]=String(e.message).slice(0,60); }
    render(); out[cov]=!(gl&&gl.isContextLost&&gl.isContextLost()); }
  state.seqCov=180; const s=activeSeq(); if(s)s.cov=180; try{if(typeof buildDomeMesh==='function')buildDomeMesh();}catch(e){} render();
  return out;`);

// ── 11 · cambio de idioma con todos los paneles abiertos
await step('cambiar idioma (EN↔ES) con los paneles abiertos', `
  const c=state.clips.find(x=>{const m=mediaById(x.mediaId);return m&&m.kind!=='audio'&&m.kind!=='adjust';}); if(c){state.selIds=[c.id];state.selId=c.id;}
  renderInspector();
  const prev=state.lang;
  state.lang=(String(prev).toLowerCase()==='es'?'en':'es'); applyLang(); renderInspector(); renderTimeline(); renderMedia();
  state.lang=prev; applyLang(); renderInspector(); renderTimeline(); renderMedia();
  const filas=document.querySelectorAll('#tfRows .prow').length;
  const vacias=[...document.querySelectorAll('#tfRows .prow .lab')].filter(e=>!e.textContent.trim()).length;
  return {filas, etiquetasVacias:vacias, idioma:state.lang};`);

// ── 12 · alt+scroll al extremo: colapsar y expandir todas las pistas
await step('alt+scroll a los dos extremos (colapso total y máximo)', `
  const tl=document.getElementById('tlscroll')||document.getElementById('tracks');
  const disp=(dy)=>tl.dispatchEvent(new WheelEvent('wheel',{deltaY:dy,altKey:true,bubbles:true,cancelable:true}));
  for(let i=0;i<40;i++) disp(120);   // achicar a tope
  const min=state.lanes.map((l,i)=>laneH(i));
  for(let i=0;i<60;i++) disp(-120);  // agrandar a tope
  const max=state.lanes.map((l,i)=>laneH(i));
  renderTimeline();
  return {minimos:min, maximos:max, todasPositivas:min.every(h=>h>0)&&max.every(h=>h>0)};`);

// ── 13 · medio ausente (el archivo ya no está en disco)
await step('medio ausente: el clip no debe tumbar el render', `
  const m=state.media.find(x=>x.kind==='shape'); if(!m) return {sinMedio:true};
  const antes=m.missing; m.missing=true; m.src=null;
  renderMedia(); renderTimeline(); render(); renderInspector();
  m.missing=antes; renderMedia(); render();
  return {sobrevive:true, glPerdido:!!(gl&&gl.isContextLost&&gl.isContextLost())};`);

// ── 14 · copiar/pegar y duplicar en cadena
await step('copiar/pegar y duplicar ×10', `
  const c=state.clips[0]; if(!c) return {sinClips:true};
  state.selIds=[c.id]; state.selId=c.id;
  const n0=state.clips.length;
  for(let i=0;i<10;i++){ copyClip(); pasteClip(); }
  renderTimeline(); render();
  const solapesRaros=state.clips.filter(x=>x.lane==null||!(x.dur>0)).length;
  return {antes:n0, ahora:state.clips.length, invalidos:solapesRaros};`);

// ── 15 · estado final: guardar lo que quedó y volver a abrirlo
await step('cierre: serializar el proyecto maltratado y reabrirlo', `
  const j=JSON.stringify(serProject());
  const bytes=j.length;
  loadProject(JSON.parse(j)); await new Promise(r=>setTimeout(r,400));
  ${SANO.replace('return {', 'return {bytesDelProyecto:bytes, ')}`);

const fallos = R.filter(r => !r.ok);
console.log('\nFALLOS: ' + (fallos.length || 'ninguno') + '   ERRORES/EXCEPCIONES: ' + (errors.length || 0));
if (errors.length) console.log(errors.slice(0, 12).map(e => '   · ' + e).join('\n'));
fs.writeFileSync('scratchpad/robust.json', JSON.stringify({ pasos: R, errores: errors }, null, 2));
ws.close();
