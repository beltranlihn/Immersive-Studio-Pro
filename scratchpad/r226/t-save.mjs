import { run, shot } from './cdp2.mjs';
import { errsHook, flatScene } from './setup.mjs';
await errsHook();
console.log('escena', JSON.stringify(await flatScene()));
console.log('mask', await run(`
  const c=selClip(); document.getElementById('penAdd').click();
  const mk=selClip().penMasks[0]; mk.pts=[[0.25,0.2],[0.8,0.3],[0.7,0.85],[0.3,0.7]]; rasterizePenMasks(selClip()); render();
  return {pts:mk.pts.length, tex:!!selClip().maskTex};`));
await shot('s-01-antes-de-guardar');
console.log('reload', await run(`
  const id=selClip().id; const json=JSON.stringify(serProject()); loadProject(JSON.parse(json)); window.__id=id; return 1;`,{timeout:30000}));
await new Promise(r=>setTimeout(r,2600));
console.log('tras cargar', await run(`
  const c=clipById(window.__id); render();
  return {mask:c&&c.props.mask, tex:!!(c&&c.maskTex), pts:c&&c.penMasks[0].pts.length, errs:(window.__errs||[]).length};`));
await shot('s-02-tras-guardar-y-reabrir');
console.log('reabrir edicion', await run(`
  state.selId=window.__id; state.selIds=[window.__id]; state.inspTab='clip'; renderInspector();
  const b=document.getElementById('penEdit'); if(!b)return {err:'no penEdit'};
  b.click(); const c=selClip(),m=mediaById(c.mediaId),t=state.playhead;
  return {editing:!!maskEditClip(), px:c.penMasks[0].pts.map(p=>{const q=penPtPix(c,m,t,p,null);return q&&[Math.round(q[0]),Math.round(q[1])];})};`));
await shot('s-03-edicion-reabierta');
console.log('__errs', await run(`return (window.__errs||[]).slice(0,5);`));
