import { evalInApp } from './cdp.mjs';
const expr = `(async function(){
  const out={};
  // automatización ON
  if(!state.inlineCurves)toggleCurves();
  out.automode=document.body.classList.contains('automode');
  const hd=()=>document.querySelector('#laneHeaders .lanehdr[data-lane="0"]')||document.querySelectorAll('#laneHeaders .lanehdr')[0];
  const chips=()=>{ const h=hd(); return {cat:h&&h.querySelector('.acat .alab')&&h.querySelector('.acat .alab').textContent, par:h&&h.querySelector('.apac .alab')&&h.querySelector('.apac .alab').textContent}; };
  out.cats=autoCats(0).map(c=>({k:c.k,label:c.label,params:c.params.map(p=>p[1]+'→'+p[2])}));
  out.chips0=chips();
  const openChip=sel=>{ const el=hd().querySelector(sel); const r=el.getBoundingClientRect();
    el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,button:0,clientX:r.left+4,clientY:r.top+4}));
    const m=document.querySelector('.menu'); const items=m?[...m.querySelectorAll('button')].map(b=>({txt:b.textContent.trim(),dia:!!b.querySelector('span[style*="auto-live"]'),bold:!!b.querySelector('b')})):null;
    return {items, html:m?m.innerHTML.slice(0,0):null}; };
  const pick=(sel,idx)=>{ openChip(sel); const m=document.querySelector('.menu'); const bs=[...m.querySelectorAll('button')]; bs[idx].click(); };
  // izquierda: lista de dispositivos
  out.left=openChip('.acat').items; closeMenu();
  // derecha por categoría
  out.right={};
  const cats=autoCats(0);
  for(let i=0;i<cats.length;i++){ pick('.acat',i); out.right[cats[i].k]={chips:chips(), params:openChip('.apac').items}; closeMenu(); }
  // dejar en Transform/az
  const l=state.lanes[0]; l._autoP='az'; renderTimeline();
  out.chipsEnd=chips();
  out.errs=window.__errs;
  return out;
})()`;
evalInApp(expr).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error('ERR',e.message);process.exit(1);});
