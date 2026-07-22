import { evalInApp } from './cdp.mjs';
const expr = `(()=>{
  // add a shape clip so the inspector has something to show, then select it
  createShapeClip('rect');
  const c = state.clips[state.clips.length-1];
  state.selId = c.id; state.selIds = [c.id];
  renderInspector();
  const secs = [...document.querySelectorAll('#insCtl .sechead[data-sec]')].map(h=>({
    sec:h.dataset.sec,
    title:(h.querySelector('.t')||{}).textContent,
    collapsed:h.classList.contains('seccollapsed')
  }));
  const rowsIn = id => [...document.querySelectorAll('#'+id+' .prow')].map(r=>{
    const f=r.querySelector('.field'); if(f&&f.dataset.p) return f.dataset.p;
    const lab=r.querySelector('.lab'); return lab?('['+lab.textContent.trim()+']'):'?';
  });
  const visible = id => { const el=document.getElementById(id); return el?getComputedStyle(el).display!=='none':null; };
  const before = {
    sections: secs,
    insCol: JSON.parse(JSON.stringify(state.insCol||{})),
    tfRows: rowsIn('tfRows'),
    clipRows: rowsIn('fxRows'),
    colorRows: rowsIn('colorRows'),
    motionRows: [...document.querySelectorAll('#motionRows .prow')].length,
    lutInColor: !!document.querySelector('#colorRows #lutLoad'),
    motionChips: document.querySelectorAll('#motionRows .animchip').length,
    vis:{ tfRows:visible('tfRows'), fxRows:visible('fxRows'), colorRows:visible('colorRows'), motionRows:visible('motionRows') }
  };
  // toggle Color section open by clicking its header
  const colH=document.querySelector('#insCtl .sechead[data-sec="color"]');
  colH.click();
  const afterOpenColor = { insCol:JSON.parse(JSON.stringify(state.insCol)), colorVisible:visible('colorRows'), colorCollapsedClass:colH.classList.contains('seccollapsed') };
  // re-render to confirm collapse state survives a rebuild
  renderInspector();
  const afterRerender = { colorVisible:visible('colorRows'), motionVisible:visible('motionRows'), clipVisible:visible('fxRows') };
  return JSON.stringify({ before, afterOpenColor, afterRerender }, null, 1);
})()`;
console.log(await evalInApp(expr, { timeout: 20000 }));
