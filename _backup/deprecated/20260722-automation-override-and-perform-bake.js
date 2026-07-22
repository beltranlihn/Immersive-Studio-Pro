/* ARCHIVED (deprecated / unused) — Immersive Studio Pro
 * Origen:   app.js (funciones sueltas del subsistema de automatización) — commit previo a R137 (base 8dfe3f0/bbe83ab)
 *           · perform-and-bake: `_recTouch`, `autoRecOn`, `toggleAutoRec`, `recWrite`, `bakeRecorded` (~L2699-2726) +
 *             `state.autoRec` (~L86) + `#autoRecBtn` (index.html ~L791 + CSS ~L326-329) + su hide-line (~L5629) +
 *             la llamada `bakeRecorded()` en `pause()` (~L4200)
 *           · override/re-enable: `anyOverride`, `reenableAll`, `updReEnableGlobal` (~L2731-2733) +
 *             `reenableAuto`, `setAutoOff` (~L3584-3585) + la llamada `updReEnableGlobal()` en `returnToDefault` (~L3583)
 * Sacado:   2026-07-22 (R137)
 * Motivo:   El modelo de automatización After Effects (ADR-0006 / [A2]/[D1]) deja SIN EFECTO esta maquinaria:
 *           editar un valor SIEMPRE escribe un keyframe (`manualEdit`) y la automatización nunca se rompe → no hay
 *           override ni "re-enable". Verificado por grep: `setAutoOff` (único setter de `_autoOff`), `recWrite`,
 *           `autoRecOn`, `toggleAutoRec`, `reenableAll`, `reenableAuto` = SIN LLAMADORES; `#autoRecBtn` no estaba
 *           cableado y ya salía oculto; `#reEnAll` no existe en el DOM (updReEnableGlobal ya era no-op).
 * Restaurar:re-pegar estas funciones en app.js (cerca de `manualEdit`, ~L2727), volver a declarar `state.autoRec:false`
 *           en el init de state (~L86), re-añadir el `<button id="autoRecBtn">` + CSS en index.html, y re-cablearlo a
 *           `toggleAutoRec`. Para el override, re-conectar `setAutoOff` a un gesto de UI (no lo tenía) y volver a poner
 *           las llamadas `bakeRecorded()`/`updReEnableGlobal()`. Contradice ADR-0006 → si se restaura, revisar esa ADR.
 * Relacion: [A2]/[D1], docs/adr/adr-0006-automatizacion-after-effects.md
 * NOTA:     Quedan reads no-op de `_autoOff` en funciones vivas (sepAuto, returnToDefault, drawAutoCurve `off`,
 *           fxKfToggle, borrado de fx) — inertes porque nadie setea `_autoOff`. Barrido menor pendiente.
 */

/* ---------- PERFORM-AND-BAKE (perform + hornear gesto → curva) ---------- */
/* ===================== [R95·D1] PERFORM-AND-BAKE =====================
   Hit REC, press play, and PERFORM the parameter with the mouse while the music runs — the gesture is written as keyframes and
   simplified (RDP) on release, so you get an editable curve, not one key per frame. This is "Inventing on Principle" applied to
   VJ work: play the move instead of typing it. Live's decision — the most elegant in the whole research — is to expose NO modes
   and infer them from the device: a mouse means TOUCH, so writing stops the moment you let go (manualEdit simply stops firing).
   Every manual edit in the app already funnels through manualEdit (inspector drag/type/wheel, viewport move), so this is the
   single, complete capture point. */
let _recTouch=new Map(); // 'clipId|param' → {c,p,t0,t1,last}
function autoRecOn(){ return !!state.autoRec&&state.playing; }
function toggleAutoRec(){ state.autoRec=!state.autoRec; const b=$('#autoRecBtn'); if(b)b.classList.toggle('on',state.autoRec);
  if(!state.autoRec)bakeRecorded(); else flashStatus(T('Automation REC — play, then move any control to perform it','REC de automatización — reproduce y mueve cualquier control para interpretarlo')); }
function recWrite(c,p,v){ const key=c.id+'|'+p; const t=state.playhead; let r=_recTouch.get(key);
  if(!r){ r={c,p,t0:t,t1:t,last:t,own:new Set()}; _recTouch.set(key,r); if(!_recTouch._undone){ pushUndo(); _recTouch._undone=true; } if(c._autoOff)delete c._autoOff[p]; } // recording REPLACES the override: you're writing the curve, not bypassing it
  const lt=Math.max(0,Math.min(c.dur,t-c.start)); const tol=Math.min(0.02,0.5/(state.fps||30));
  { const ks=(c.kf&&c.kf[p])||null; if(ks){ const a=Math.min(r.last,t)-c.start-1e-4, b=Math.max(r.last,t)-c.start+1e-4; // wipe the PRE-EXISTING points the gesture just passed over (touch semantics: the performance wins in the span it covers)
      for(let i=ks.length-1;i>=0;i--){ const k=ks[i]; if(r.own.has(k))continue; if(k.t>a&&k.t<b)ks.splice(i,1); } } } // ...but never the points THIS take wrote
  setKf(c,p,t,v,'linear'); const nk=(c.kf[p]||[]).find(x=>Math.abs(x.t-lt)<=tol); if(nk)r.own.add(nk);
  r.t1=Math.max(r.t1,t); r.t0=Math.min(r.t0,t); r.last=t; }
/* on stop / REC off: thin every performed span down to the fewest points that keep its shape (Bitwig/Reaper do this on freehand) */
function bakeRecorded(){ if(!_recTouch.size)return; let total=0;
  for(const [,r] of _recTouch){ const c=r.c, p=r.p; const ks=c.kf&&c.kf[p]; if(!ks||ks.length<4)continue;
    const d=paramDef(c,p); if(!d)continue; const mn=d[3],mx=d[4];
    const a=r.t0-c.start, b=r.t1-c.start; const inSpan=ks.filter(k=>k.t>=a-1e-3&&k.t<=b+1e-3); if(inSpan.length<4)continue;
    const pts=inSpan.map(k=>[k.t*state.tl.pxPerSec,(1-(k.v-mn)/((mx-mn)||1))*60]); const keep=rdpKeep(pts,1.2);
    const drop=new Set(inSpan.filter((k,i)=>!keep.has(i))); if(!drop.size)continue;
    c.kf[p]=ks.filter(k=>!drop.has(k)); total+=drop.size; }
  _recTouch=new Map(); if(total)flashStatus(T('Performance baked — ','Interpretación horneada — ')+total+T(' points thinned',' puntos reducidos'));
  renderTimeline(); renderInspector(); markDirty(); }

/* ---------- OVERRIDE / RE-ENABLE (bypass de automatización, pre-AE) ---------- */
function anyOverride(){ return state.clips.some(c=>c._autoOff&&Object.keys(c._autoOff).some(k=>c._autoOff[k])); }
function reenableAll(){ pushUndo(); for(const c of state.clips){ if(c._autoOff)c._autoOff={}; } render(); renderTimeline(); refreshInspector(); updReEnableGlobal(); flashStatus(T('All automation re-enabled','Toda la automatización reactivada')); }
function updReEnableGlobal(){ const b=$('#reEnAll'); if(!b)return; b.style.display=anyOverride()?'inline-flex':'none'; }
function reenableAuto(c,p){ if(c._autoOff)delete c._autoOff[p]; render(); renderTimeline(); refreshInspector(); updReEnableGlobal(); flashStatus(T('Automation re-enabled — parameter follows its curve again','Automatización reactivada — el parámetro vuelve a seguir su curva')); }
function setAutoOff(c,p,off){ c._autoOff=c._autoOff||{}; if(off){ setParamBase(c,p,evalP(c,p,state.playhead)); c._autoOff[p]=true; } else delete c._autoOff[p]; render(); renderTimeline(); refreshInspector(); updReEnableGlobal(); } // overriding freezes the CURRENT curve value first (like manualEdit) so the picture never jumps to a stale base

/* DOM archivado (index.html): <button class="tbtn" id="autoRecBtn" title="Automation REC — play, then move any control to perform it; released gestures are baked to an editable curve"><span class="recdot"></span></button>
   CSS archivado (index.html):
   #autoRecBtn .recdot{width:9px;height:9px;border-radius:50%;background:var(--ink-faint);display:block;}
   #autoRecBtn.on{border-color:rgba(224,100,92,0.6);} #autoRecBtn.on .recdot{background:#E0645C;animation:recpulse 1.4s ease-in-out infinite;}
   body.rm-on #autoRecBtn.on .recdot{animation:none;} */
