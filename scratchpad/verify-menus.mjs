import { evalInApp } from './cdp.mjs';
const expr = `(()=>{
  const out={};
  const btns=[...document.querySelectorAll('#menubar .menubtn')];
  out.menubtns = btns.map(b=>b.dataset.menu);
  const readMenu=which=>{ const b=document.querySelector('#menubar .menubtn[data-menu='+which+']'); openAppMenu(which,b); const m=document.querySelector('.menu'); const items=m?[...m.querySelectorAll('button[role=menuitem] span:first-child')].map(s=>s.textContent.trim()):[]; const onBtn=b.classList.contains('on'); closeMenu(); return {items,onBtn}; };
  out.file=readMenu('file'); out.edit=readMenu('edit'); out.window=readMenu('window');
  // fire a harmless command from the Window menu: toggle Media panel
  const before=!!state.prefs.mediaCollapsed;
  const wb=document.querySelector('#menubar .menubtn[data-menu=window]'); openAppMenu('window',wb);
  const mediaItem=[...document.querySelectorAll('.menu button[role=menuitem]')].find(x=>/Media/.test(x.textContent));
  if(mediaItem)mediaItem.click();
  out.mediaToggle={before, after:!!state.prefs.mediaCollapsed, changed:(before!==!!state.prefs.mediaCollapsed)};
  // restore
  state.prefs.mediaCollapsed=before; setPaneCollapsed('#mediaPane',before);
  out.menuClosedAfterClick = !document.querySelector('.menu');
  return JSON.stringify(out,null,1);
})()`;
console.log(await evalInApp(expr,{timeout:15000}));
