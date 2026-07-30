// [R228] Verificación de las correcciones del code review sobre R227.
import { evalInApp } from './cdp.mjs';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const out = [];
const log = (k, v) => { out.push([k, v]); console.log('· ' + k + ' → ' + JSON.stringify(v)); };

async function run(label, expr) { const v = await evalInApp(expr); log(label, v); return v; }

// ---------- 1. demo dome: ease REAL + batch sin pushUndo ----------
await run('boot', `(()=>{ window.__errs=window.__errs||[]; if(!window.__errHook){ window.__errHook=1; addEventListener('error',e=>window.__errs.push(String(e.message))); addEventListener('unhandledrejection',e=>window.__errs.push('rej:'+String(e.reason))); } return {ready:!!window.state, lch:typeof lchShowing==='function'?lchShowing():null}; })()`);

// contar pushUndo durante el build
await run('demo-dome-build', `(async()=>{
  const orig=window.pushUndo; if(typeof orig!=='function')return {err:'pushUndo no es global'};
  window.__pu=0; window.pushUndo=function(){ window.__pu++; return orig.apply(this,arguments); };
  try{ await startDemoProject('dome'); } finally { window.pushUndo=orig; }
  return {pushUndoDuranteBuild:window.__pu, clips:state.clips.length, media:state.media.length, dirty:state.dirty, path:currentPath, seqMode:state.seqMode, undoVacio:JSON.stringify(Object.keys(window._undoBySeq||{})), refs:_demoRefs&&{fmt:_demoRefs.fmt,autoParam:_demoRefs.autoParam,autoLane:_demoRefs.autoLane}};
})()`);

await sleep(300);

await run('demo-dome-contenido', `(()=>{
  const nest=state.media.filter(m=>m.kind==='nest');
  const conFx=state.clips.filter(c=>(c.fx||[]).length);
  const conKf=state.clips.filter(c=>c.kf&&Object.keys(c.kf).length);
  const conAnim=state.clips.filter(c=>(c.anim||[]).length);
  return {clips:state.clips.length, nests:nest.length, conFx:conFx.length, conKf:conKf.length, conAnim:conAnim.length,
    fxTipos:conFx.flatMap(c=>c.fx.map(f=>f.type+':int='+f.int+',amt='+f.amt)),
    kfKeys:conKf.map(c=>Object.keys(c.kf).join('+'))};
})()`);

// ease real: opacidad del título, muestra a mitad de segmento vs lineal
await run('ease-opacidad-titulo', `(()=>{
  const t=state.clips.find(c=>c.kf&&c.kf.opacity&&c.kf.opacity.length>1); if(!t)return 'sin curva de opacidad';
  const ks=t.kf.opacity, A=ks[0], B=ks[1];
  const eases=ks.map(k=>k.e);
  const mid=(A.t+B.t)/2, vMid=evalP(t,'opacity',t.start+mid);
  const lin=A.v+(B.v-A.v)*0.5;
  return {eases, A:{t:A.t,v:A.v}, B:{t:B.t,v:B.v}, vMid:+vMid.toFixed(4), lineal:+lin.toFixed(4), difiereDeLineal:Math.abs(vMid-lin)>0.01, esperadoBoth:+(A.v+(B.v-A.v)*0.5).toFixed(4)};
})()`);

await run('ease-mixmotion', `(()=>{
  const c=state.clips.find(x=>x.kf&&Object.keys(x.kf).some(k=>k.indexOf('mot:')===0));
  if(!c)return 'sin mix de motion';
  const k=Object.keys(c.kf).find(k=>k.indexOf('mot:')===0), ks=c.kf[k];
  const A=ks[0],B=ks[1]; const mid=(A.t+B.t)/2;
  const v=evalP(c,k,c.start+mid), lin=A.v+(B.v-A.v)*0.5;
  return {key:k, eases:ks.map(x=>x.e), vMid:+v.toFixed(3), lineal:+lin.toFixed(3), difiere:Math.abs(v-lin)>0.01};
})()`);

// también la de POSICIÓN (el), que tiene 3 puntos → el segmento medio de 'both' sí difiere
await run('ease-posicion', `(()=>{
  const R=_demoRefs; const c=clipById(R.autoClipId); const ks=c.kf[R.autoParam];
  const A=ks[0],B=ks[1]; const q=A.t+(B.t-A.t)*0.25;
  const v=evalP(c,R.autoParam,c.start+q), lin=A.v+(B.v-A.v)*0.25;
  return {param:R.autoParam, eases:ks.map(x=>x.e), t25:{ease:+v.toFixed(3),lineal:+lin.toFixed(3),difiere:Math.abs(v-lin)>0.01}};
})()`);

// ---------- 2. tour completo + paso Automation ----------
await run('tour-arranca', `(()=>{ if(_tourStop)_tourStop(); startTour('dome',true); const ov=document.getElementById('tourOv'); return {ov:!!ov, txt:ov?ov.querySelector('div:nth-child(2)').innerText.slice(0,60):null}; })()`);
await sleep(200);
await run('tour-avanzar-hasta-automation', `(()=>{
  const pasos=[]; for(let i=0;i<12;i++){ const c=document.querySelector('#tourOv > div:nth-child(2)'); if(!c)break;
    pasos.push(c.querySelector('div:nth-child(2)').textContent);
    const nx=c.querySelector('#tourNext'); const last=nx.textContent.indexOf('Done')>=0||nx.textContent.indexOf('Listo')>=0; if(last)break; nx.click(); }
  return pasos;
})()`);

await run('tour-automation-estado', `(()=>{
  // relanzar y llegar al paso de automatización
  if(_tourStop)_tourStop();
  state.inlineCurves=false; state.selId=null; state.selIds=[]; renderTimeline();
  startTour('dome',true);
  const c=()=>document.querySelector('#tourOv > div:nth-child(2)');
  for(let i=0;i<12;i++){ const t=c().querySelector('div:nth-child(2)').textContent; if(t.indexOf('utomation')>=0||t.indexOf('utomatiz')>=0)break; c().querySelector('#tourNext').click(); }
  const R=_demoRefs, lane=state.lanes[R.autoLane];
  const selDom=[...document.querySelectorAll('.clip.sel')].map(x=>+x.dataset.clip);
  return {titulo:c().querySelector('div:nth-child(2)').textContent, inlineCurves:state.inlineCurves, autoP:lane._autoP, esperado:R.autoParam,
    selId:state.selId, autoClipId:R.autoClipId, selDom, inspectorMuestraClip:(document.querySelector('#inspPane')||{}).innerText?.indexOf('Motion')>=0};
})()`);

// selección rancia: el usuario toca otro clip → volver atrás y adelante debe recomponerla
await run('tour-automation-seleccion-rancia', `(()=>{
  const R=_demoRefs; const otro=state.clips.find(c=>c.id!==R.autoClipId);
  state.selId=otro.id; state.selIds=[otro.id]; renderTimeline(); renderInspector();
  const antes={selId:state.selId};
  const c=document.querySelector('#tourOv > div:nth-child(2)');
  c.querySelector('#tourBack').click(); c.querySelector('#tourNext').click(); // fuerza un draw del paso
  const selDom=[...document.querySelectorAll('.clip.sel')].map(x=>+x.dataset.clip);
  return {antes, despuesSelId:state.selId, autoClipId:R.autoClipId, coherente:state.selId===R.autoClipId&&selDom.length===1&&selDom[0]===R.autoClipId, selDom};
})()`);

await run('tour-cerrar', `(()=>{ if(_tourStop)_tourStop(); return !document.getElementById('tourOv'); })()`);

// ---------- 3. demo 2D: copy nuevo ----------
await run('demo-flat', `(async()=>{ state.dirty=false; await startDemoProject('flat'); return {seqMode:state.seqMode, clips:state.clips.length, dirty:state.dirty}; })()`);
await sleep(400);
await run('flat-boton-3d-oculto', `(()=>{ const b3=document.querySelector('#viewModeSeg button[data-v="3d"]'), b2=document.querySelector('#viewModeSeg button[data-v="2d"]');
  return {b3display:b3?b3.style.display:'n/a', b2label:b2?b2.textContent.trim():'n/a'}; })()`);
await run('flat-copy-paso-visores', `(()=>{ const p=tourSteps('flat',true).find(s=>s.sel==='#viewModeSeg'); return {title:p.title, body:p.body}; })()`);
await run('dome-copy-paso-visores', `(()=>{ const p=tourSteps('dome',true).find(s=>s.sel==='#viewModeSeg'); return {title:p.title, body:p.body.slice(0,70)}; })()`);
await run('room-copy-paso-visores', `(()=>{ const p=tourSteps('room',true).find(s=>s.sel==='#viewModeSeg'); return {title:p.title, body:p.body.slice(0,70)}; })()`);

console.log('\n== errores ==');
await run('errs', `window.__errs||[]`);
