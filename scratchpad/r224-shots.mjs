import { evalInApp } from './cdp.mjs';
import { capture } from './cap.mjs';
import fs from 'fs';
fs.mkdirSync(new URL('./r224/', import.meta.url), { recursive: true });

const run = e => evalInApp('(function(){' + e + '})()');
const shot = async n => { const p = await capture('../r224/' + n); console.log('shot', n); return p; };

// estado base: automatización ON, clip A seleccionado, algo automatizado en cada sitio
await run(`
  const A=state.clips.find(c=>c.lane===0), lane=state.lanes[0];
  state.selId=A.id; state.selIds=[A.id]; state.selLane=null;
  A.kf['az']=[{t:0,v:0,e:'linear'},{t:2.5,v:180,e:'linear'},{t:5,v:0,e:'linear'}];
  A.kf['mot:spin:mix']=[{t:0,v:0,e:'linear'},{t:5,v:100,e:'linear'}];
  const f=A.fx[0]; A.kf['fx:'+f.id+':block']=[{t:0,v:2,e:'linear'},{t:5,v:20,e:'linear'}];
  if(!state.inlineCurves)toggleCurves(); lane._autoP='az'; state.playhead=2; renderTimeline(); renderInspector(); render(); return 1;`);
await shot('01-automode-az');

// fade: comparación off/on
await run(`if(state.inlineCurves)toggleCurves(); renderTimeline(); return 1;`);
await shot('02-fade-normal');
await run(`if(!state.inlineCurves)toggleCurves(); renderTimeline(); return 1;`);
await shot('03-fade-automode');

// menú izquierdo (categorías + Motion + Glitch, con ◆ donde hay automatización)
const open = sel => run(`const h=document.querySelector('#laneHeaders .lanehdr[data-lane="0"]'); const el=h.querySelector('${sel}'); const r=el.getBoundingClientRect();
  el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,button:0,clientX:r.left+4,clientY:r.top+4})); return 1;`);
const pickCat = i => run(`const h=document.querySelector('#laneHeaders .lanehdr[data-lane="0"]'); const el=h.querySelector('.acat'); const r=el.getBoundingClientRect();
  el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,button:0,clientX:r.left+4,clientY:r.top+4}));
  [...document.querySelector('.menu').querySelectorAll('button')][${i}].click(); renderTimeline(); return state.lanes[0]._autoP;`);

await open('.acat'); await shot('04-left-menu-devices');
await run('closeMenu(); return 1;');
for (const [i, n] of [[0,'xf'],[1,'clip'],[2,'color'],[3,'motion'],[4,'glitch']]) {
  const p = await pickCat(i); await open('.apac'); await shot('05-right-' + n); await run('closeMenu(); return 1;');
  console.log('  cat', n, '→', p);
}

// inspector: fila con menú contextual "Show automation"
await run(`const lane=state.lanes[0]; lane._autoP='az'; state.inspTab='clip'; renderInspector(); renderTimeline();
  const r0=[...document.querySelectorAll('#colorRows .prow')].find(r=>r.querySelector('.field').dataset.p==='saturation');
  const r=r0.getBoundingClientRect(); r0.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:r.left+30,clientY:r.top+8})); return 1;`);
await shot('06-row-ctxmenu');
await run('closeMenu(); return 1;');

// Motion Mix como curva visible
await run(`state.lanes[0]._autoP='mot:spin:mix'; state.inspTab='motion'; renderInspector(); renderTimeline(); return 1;`);
await shot('07-motion-mix-curve');

// Efecto Glitch: parámetro Blocks como curva visible
await run(`state.lanes[0]._autoP='fxt:glitch:block'; state.inspTab='react'; renderInspector(); renderTimeline(); return 1;`);
await shot('08-glitch-blocks-curve');

console.log('errs', JSON.stringify(await evalInApp('window.__errs')));
