// [R228] parte 1b — ease muestreado a 25 % (a mitad, 'both' COINCIDE con lineal por simetría) + coste real del batch.
import { evalInApp } from './cdp.mjs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const run = async (k, e) => { const v = await evalInApp(e); console.log('· ' + k + ' → ' + JSON.stringify(v)); return v; };

// coste REAL: cuántos snapshots (lo caro) y cuántos renderTimeline durante el build
await run('batch-coste', `(async()=>{
  const oSnap=window.snapshot, oRT=window.renderTimeline, oRender=window.render;
  window.__n={snap:0,rt:0,rd:0};
  window.snapshot=function(){ window.__n.snap++; return oSnap.apply(this,arguments); };
  window.renderTimeline=function(){ window.__n.rt++; return oRT.apply(this,arguments); };
  window.render=function(){ window.__n.rd++; return oRender.apply(this,arguments); };
  state.dirty=false;
  try{ await startDemoProject('dome'); } finally { window.snapshot=oSnap; window.renderTimeline=oRT; window.render=oRender; }
  return Object.assign({}, window.__n, {clips:state.clips.length, undoStacks:Object.keys(window._undoBySeq||{}).length});
})()`);
await sleep(400);

await run('batch-resultado-identico', `(()=>{
  const nest=state.clips.find(c=>{const m=mediaById(c.mediaId); return m&&m.kind==='nest'&&m.id!==state.activeSeqId;});
  const R=_demoRefs;
  return {clips:state.clips.length, lanes:state.lanes.map(l=>l.kind+':'+l.name).join(' | '),
    nestPresente:!!nest, nestDentro:nest?mediaById(nest.mediaId).nestClips.length:0,
    fxClip:(clipById(R.fxClipId).fx||[]).map(f=>f.type), curvas:Object.keys(clipById(R.autoClipId).kf||{}),
    motion:(clipById(R.autoClipId).anim||[]).map(a=>a.key||a.param||JSON.stringify(a).slice(0,30)),
    tituloCurva:Object.keys(state.clips.map(c=>c.kf||{}).find(k=>k.opacity)||{}), dirty:state.dirty, path:currentPath};
})()`);

// ease a 25 % y 75 % en TODAS las curvas del demo
await run('ease-todas-al-25', `(()=>{
  const res=[];
  for(const c of state.clips){ for(const p in (c.kf||{})){ const ks=c.kf[p]; if(ks.length<2)continue;
    const A=ks[0],B=ks[1]; if(B.t-A.t<0.2||A.v===B.v)continue;
    const q=A.t+(B.t-A.t)*0.25, v=evalP(c,p,c.start+q), lin=A.v+(B.v-A.v)*0.25;
    res.push({p, e:A.e, v:+v.toFixed(3), lineal:+lin.toFixed(3), difiere:Math.abs(v-lin)>0.01}); } }
  return res;
})()`);

// ¿queda algún token de ease inventado?
await run('sin-tokens-falsos', `(()=>{
  const ok=['linear','in','out','both','hold','bezier']; const malos=[];
  for(const c of state.clips) for(const p in (c.kf||{})) for(const k of c.kf[p]) if(k.e&&ok.indexOf(k.e)<0)malos.push(p+':'+k.e);
  return {malos, todos:[...new Set(state.clips.flatMap(c=>Object.values(c.kf||{}).flat().map(k=>k.e)))]};
})()`);

await run('inspector-contenido', `(()=>{ const p=document.querySelector('#inspPane'); return {existe:!!p, tab:state.inspTab, txt:p?p.innerText.replace(/\\s+/g,' ').slice(0,220):null}; })()`);
