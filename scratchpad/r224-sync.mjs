import { evalInApp } from './cdp.mjs';
const expr = `(async function(){
  const out={}; const A=()=>state.clips.find(c=>c.lane===0); const lane=()=>state.lanes[0];
  const chips=()=>{ const h=document.querySelector('#laneHeaders .lanehdr[data-lane="0"]'); return h?{cat:h.querySelector('.acat .alab').textContent,par:h.querySelector('.apac .alab').textContent}:null; };
  const row=p=>[...document.querySelectorAll('#tfRows .prow, #fxRows .prow, #colorRows .prow')].find(r=>{const f=r.querySelector('.field');return f&&f.dataset.p===p;});
  if(!state.inlineCurves)toggleCurves();
  state.selId=A().id; state.selIds=[A().id]; renderInspector(); renderTimeline();

  // ---- ítem 4a: arrastrar el fader de OPACITY sin keyframes → la curva visible pasa a opacity
  lane()._autoP='size'; renderTimeline();
  out.before={autoP:lane()._autoP, chips:chips()};
  { const f=row('opacity').querySelector('.field'); const r=f.getBoundingClientRect();
    f.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,button:0,clientX:r.left+40,clientY:r.top+6}));
    window.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:r.left+10,clientY:r.top+6}));
    window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:r.left+10,clientY:r.top+6})); }
  out.afterOpacityDrag={autoP:lane()._autoP, chips:chips(), opacity:Math.round(A().props.opacity*10)/10, hasKf:!!hasKf(A(),'opacity')};

  // ---- ítem 4b: crear un keyframe de AZIMUTH desde el diamante del inspector
  renderInspector();
  { const b=row('az').querySelector('[data-k=add]'); b.click(); }
  out.afterAzKf={autoP:lane()._autoP, chips:chips(), azKf:(A().kf['az']||[]).length};

  // ---- ítem 5: clic-derecho en la fila de SATURATION → menú con "Show automation"
  lane()._autoP='opacity'; renderTimeline(); renderInspector();
  { const r0=row('saturation'); const r=r0.getBoundingClientRect();
    r0.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:r.left+20,clientY:r.top+6}));
    const m=document.querySelector('.menu'); out.ctxMenu=m?[...m.querySelectorAll('button')].map(b=>b.textContent.trim()):null;
    if(m){ [...m.querySelectorAll('button')][0].click(); } }
  out.afterShowAuto={autoP:lane()._autoP, chips:chips(), automode:document.body.classList.contains('automode')};

  // ---- ítem 5b: show automation con el modo APAGADO
  toggleCurves(); out.offNow=state.inlineCurves;
  renderInspector();
  { const r0=row('glow'); const r=r0.getBoundingClientRect();
    r0.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:r.left+20,clientY:r.top+6}));
    const m=document.querySelector('.menu'); [...m.querySelectorAll('button')][0].click(); }
  out.afterShowAutoFromOff={autoP:lane()._autoP, automode:document.body.classList.contains('automode'), btnOn:$('#curvesBtn').classList.contains('on'), chips:chips()};

  // ---- Motion Mix como parámetro: keyframe desde el inspector de Motion
  state.inspTab='motion'; renderInspector();
  { const kb=document.querySelector('#animList .awetkf'); if(kb)kb.click(); }
  out.motion={mixKf:(A().kf['mot:spin:mix']||[]).length, autoP:lane()._autoP, chips:chips(), mixBase:A().props['mot:spin:mix']};

  // ---- ítem 2: resaltado ◆ en los menús (ya hay automatización en opacity? az? mix?)
  renderTimeline();
  const openChip=sel=>{ const h=document.querySelector('#laneHeaders .lanehdr[data-lane="0"]'); const el=h.querySelector(sel); const r=el.getBoundingClientRect();
    el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,button:0,clientX:r.left+4,clientY:r.top+4}));
    const m=document.querySelector('.menu'); const it=m?[...m.querySelectorAll('button')].map(b=>({txt:b.textContent.trim(),dia:!!b.querySelector('span[style*="auto-live"]'),bold:!!b.querySelector('b')})):null; closeMenu(); return it; };
  out.leftHighlight=openChip('.acat');
  lane()._autoP='az'; renderTimeline(); out.rightHighlightXf=openChip('.apac');

  // ---- ítem 7: clic en el chip NO selecciona la pista, y el clip sigue seleccionado
  state.selId=A().id; state.selIds=[A().id]; state.selLane=null; renderTimeline();
  { const h=document.querySelector('#laneHeaders .lanehdr[data-lane="0"]'); const el=h.querySelector('.acat'); const r=el.getBoundingClientRect();
    el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,button:0,clientX:r.left+4,clientY:r.top+4}));
    el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,clientX:r.left+4,clientY:r.top+4})); closeMenu(); }
  out.chipClick={selId:state.selId, selIsA:state.selId===A().id, selLane:state.selLane};
  // clic FUERA del chip en la misma cabecera → pista seleccionada
  { const h=document.querySelector('#laneHeaders .lanehdr[data-lane="0"]'); const nm=h.querySelector('.nm'); const r=nm.getBoundingClientRect();
    nm.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,clientX:r.left+2,clientY:r.top+2})); }
  out.headerClick={selId:state.selId, selLane:state.selLane};

  out.errs=window.__errs;
  return out;
})()`;
evalInApp(expr).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error('ERR',e.message);process.exit(1);});
