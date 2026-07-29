// [R223] ítem 2: los TRES sitios con swatches → colorPopup (pista + clip) y la fila inline del menú de carpeta
import { fn, shot, errs, close } from './lib.mjs';
const out = {};
const measure = `sel=>[...document.querySelectorAll(sel)].map(b=>{const r=b.getBoundingClientRect();
  return {t:b.title||b.textContent.trim(),w:+r.width.toFixed(1),h:+r.height.toFixed(1),sq:Math.abs(r.width-r.height)<0.6};}).filter(x=>x.w>0)`;

out.trackPopup = await fn(`
  const measure=${measure};
  document.querySelectorAll('.lanecolpop').forEach(m=>m.remove());
  openLaneColorPopup(0, 250, 300); await new Promise(r=>setTimeout(r,150));
  const all=measure('.lanecolpop button');
  const sw=all.filter(x=>/^#/.test(x.t));
  return {swatches:sw.length, allSquare:sw.every(x=>x.sq), dims:[...new Set(sw.map(x=>x.w+'x'+x.h))], other:all.filter(x=>!/^#/.test(x.t))};
`);
await shot('r223-item2a-track-color-popup');

out.clipPopup = await fn(`
  const measure=${measure};
  document.querySelectorAll('.lanecolpop').forEach(m=>m.remove());
  const c=state.clips.find(x=>x.avRole==='v')||state.clips[0]; state.selId=c.id; state.selIds=[c.id];
  openClipColorPopup(250,340); await new Promise(r=>setTimeout(r,150));
  const sw=measure('.lanecolpop button').filter(x=>/^#/.test(x.t));
  return {swatches:sw.length, allSquare:sw.every(x=>x.sq), dims:[...new Set(sw.map(x=>x.w+'x'+x.h))]};
`);
await shot('r223-item2b-clip-color-popup');

out.folderInlineRow = await fn(`
  const measure=${measure};
  document.querySelectorAll('.lanecolpop').forEach(m=>m.remove()); closeMenu&&closeMenu();
  // fila inline de swatches dentro de openMenu (la usan los menús de carpeta de Media)
  openMenu(260,300,[{label:'probe'},'sep',{swatches:{cur:null,onPick:()=>{},onClear:()=>{}}}]);
  await new Promise(r=>setTimeout(r,150));
  const all=measure('.menu button');
  const sw=all.filter(x=>/^#/.test(x.t)||x.t==='✕');
  return {swatches:sw.length, allSquare:sw.every(x=>x.sq), dims:[...new Set(sw.map(x=>x.w+'x'+x.h))]};
`);
await shot('r223-item2c-menu-inline-swatches');
await fn(`closeMenu&&closeMenu(); document.querySelectorAll('.lanecolpop').forEach(m=>m.remove()); return true;`);

console.log(JSON.stringify(out, null, 2));
console.log('ERRS', JSON.stringify(await errs()));
close();
