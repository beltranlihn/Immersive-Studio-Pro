import { evalInApp } from './cdp.mjs';
const expr = `(async function(){
  window.__errs=[]; const out={}; const A=()=>state.clips.find(c=>c.lane===0); const lane=()=>state.lanes[0];
  const cd=()=>[...document.querySelectorAll('#tracks .clip')].find(el=>+el.dataset.id===A().id)||document.querySelector('#tracks .clip');

  // ---- ítem 1: la línea de fade (svg.fadeenv) no se dibuja en automatización; el degradado sí
  if(state.inlineCurves)toggleCurves(); renderTimeline();
  { const el=cd(); const sv=el.querySelector('.fadeenv'); out.fadeOff={hasSvg:!!sv, display:sv?getComputedStyle(sv).display:null, handles:[...el.querySelectorAll('.fadeh')].map(h=>getComputedStyle(h).display)}; }
  toggleCurves(); renderTimeline();
  { const el=cd(); const sv=el.querySelector('.fadeenv'); out.fadeOn={automode:document.body.classList.contains('automode'), hasSvg:!!sv, display:sv?getComputedStyle(sv).display:null, handles:[...el.querySelectorAll('.fadeh')].map(h=>getComputedStyle(h).display)}; }

  // ---- ítem 8: sin chapa de motion sobre el clip (el clip TIENE un motion activo)
  out.motionBadge={hasLiveAnim:hasLiveAnim(A()), badges:document.querySelectorAll('#tracks .animbadge').length};

  // ---- Regresión evalR: el spin sigue animando (linear 30°/s ⇒ crece con t) y el Mix lo escala
  { const c=A(); const t1=c.start+1, t2=c.start+3;
    out.evalR={spin_t1:Math.round(evalR(c,'spin',t1)*100)/100, spin_t2:Math.round(evalR(c,'spin',t2)*100)/100,
      base_t1:evalP(c,'spin',t1), wet_t1:evalWet(c,c.anim[0],t1)}; }
  // Mix a 50% (valor estático) → el offset se parte en dos
  { const c=A(); delete c.kf['mot:spin:mix']; c.props['mot:spin:mix']=50; const t2=c.start+3;
    out.evalRmix50={spin_t2:Math.round(evalR(c,'spin',t2)*100)/100, wet:evalWet(c,c.anim[0],t2)}; c.props['mot:spin:mix']=100; }
  // Mix con curva 0→100 en la duración: a mitad debe valer ~50%
  { const c=A(); c.kf['mot:spin:mix']=[{t:0,v:0,e:'linear'},{t:c.dur,v:100,e:'linear'}];
    out.evalRmixCurve={wet_mid:Math.round(evalWet(c,c.anim[0],c.start+c.dur/2)*1000)/1000}; }

  // ---- ítem 2: borrar el EFECTO → desaparece del chooser y la lane deja caer su elección
  { const c=A(); c.kf['fxt:glitch:block']=undefined; delete c.kf['fxt:glitch:block'];
    const f=c.fx[0]; c.kf['fx:'+f.id+':block']=[{t:0,v:5,e:'linear'}]; // automatización real del efecto
    lane()._autoP='fxt:glitch:block'; renderTimeline();
    out.beforeFxDel={cats:autoCats(0).map(x=>x.k), autoP:lane()._autoP, laneAutoP:laneAutoP(lane(),0)};
    state.inspTab='motion'; renderInspector();
    const del=document.querySelector('#motionFx .fxcard .fxdel'); if(del)del.onclick(); else out.noDel=true;
    out.afterFxDel={cats:autoCats(0).map(x=>x.k), autoP:lane()._autoP, laneAutoP:laneAutoP(lane(),0), kfKeys:Object.keys(A().kf)}; }

  // ---- ítem 2: borrar el MOTION → su automatización muere con él
  { const c=A(); c.kf['mot:spin:mix']=[{t:0,v:0,e:'linear'},{t:1,v:100,e:'linear'}]; lane()._autoP='mot:spin:mix'; renderTimeline();
    out.beforeMotDel={cats:autoCats(0).map(x=>x.k), autoP:lane()._autoP, mixKf:(c.kf['mot:spin:mix']||[]).length};
    renderInspector(); const d=document.querySelector('#animList .animdel'); d.onclick();
    out.afterMotDel={cats:autoCats(0).map(x=>x.k), autoP:lane()._autoP, mixKf:(A().kf['mot:spin:mix']||[]).length, props:A().props['mot:spin:mix'], laneAutoP:laneAutoP(lane(),0)}; }

  // ---- undo/redo
  out.undo1=(function(){ undo(); const c=A(); return {anim:(c&&c.anim||[]).length, mixKf:(c&&c.kf&&c.kf['mot:spin:mix']||[]).length}; })();
  out.redo1=(function(){ redo(); const c=A(); return {anim:(c&&c.anim||[]).length, mixKf:(c&&c.kf&&c.kf['mot:spin:mix']||[]).length}; })();

  out.errs=window.__errs;
  return out;
})()`;
evalInApp(expr).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error('ERR',e.message);process.exit(1);});
