import { evalInApp } from './cdp.mjs';
const P = { port: 9222 };
const set = (mode, w, h) => evalInApp(`(()=>{ const as=activeSeq(); as.w=${w};as.h=${h};as.mode='${mode}';as.fps=30;
  state.seqW=${w};state.seqH=${h};state.seqMode='${mode}';state.fps=30;
  const p=document.getElementById('exOv'); if(p)p.remove(); openExport();
  document.querySelector('#exSz button[data-sz="custom"]').click(); return true; })()`, P);

console.log('2D — teclear, Enter aplica:', await (async () => { await set('flat', 1920, 1080); await new Promise(r => setTimeout(r, 400));
  return evalInApp(`(()=>{ const w=document.getElementById('exSzW'), h=document.getElementById('exSzH');
    w.value='1280'; h.value='536';
    w.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
    const e=document.getElementById('exEst').textContent;
    return JSON.stringify({est:e.slice(0,40), proxy:document.getElementById('exProxy').textContent}); })()`, P); })());

console.log('2D — Esc revierte:', await evalInApp(`(()=>{ const w=document.getElementById('exSzW');
  const antes=w.value; w.value='999'; w.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  const d=document.getElementById('exSzW');
  return JSON.stringify({antes, tecleado:'999', tras_Esc:d?d.value:null, revirtio:(d&&d.value===antes)}); })()`, P));

console.log('2D — recorta a 16..16384:', await evalInApp(`(()=>{ const w=document.getElementById('exSzW'), h=document.getElementById('exSzH');
  w.value='99999'; h.value='2'; w.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  const d=document.getElementById('exSzW'), e=document.getElementById('exSzH');
  return JSON.stringify({w:d.value, h:e.value}); })()`, P));

console.log('\ndomo — el alto sigue al ancho:', await (async () => { await set('dome', 4096, 4096); await new Promise(r => setTimeout(r, 400));
  return evalInApp(`(()=>{ const w=document.getElementById('exSzW'), h=document.getElementById('exSzH');
    const desactivado=h.disabled; w.value='3000'; w.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
    const d=document.getElementById('exSzW'), e=document.getElementById('exSzH');
    return JSON.stringify({altoDeshabilitado:desactivado, w:d.value, h:e.value, cuadrado:d.value===e.value,
      proxy:document.getElementById('exProxy').textContent}); })()`, P); })());
