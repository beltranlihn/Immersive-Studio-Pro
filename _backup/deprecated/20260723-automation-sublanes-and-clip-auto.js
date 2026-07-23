/* ============================================================================
 * ARCHIVADO 2026-07-23 · R143 · Barrido de deuda técnica #2
 * Política: "archivar, no borrar" (ADR-0007).
 *
 * ORIGEN:  app.js (varios sitios — automatización de timeline)
 * MOTIVO:  Dos sistemas de automatización MUERTOS que convivían con el modelo
 *          vigente [A5] "una automatización a la vez" (`lane._autoP`, que sigue
 *          VIVO y NO se toca):
 *            1) `lane._auto` (+ `lane._autoH`) — carriles de automatización
 *               APILADOS por pista ([R92-T4→R93]). Su RENDER ya estaba neutralizado:
 *               `appendAutoLanes()` empezaba con `return;` (comentario [A5]), así que
 *               TODO el render de sub-carriles (L4003-4025) era inalcanzable. Sólo
 *               quedaba mantenimiento residual: creación por menú, filtrado al borrar
 *               FX, y serialización. Confirmado por mapeo (arch-explorer): ninguna
 *               lectura de `lane._auto` dirige el render.
 *            2) `c._auto` — lista de automatización a nivel de CLIP (pre-modelo de
 *               pista). El propio comentario decía "legacy clip-level list (no longer
 *               rendered)". Nunca se lee para renderizar; sólo se mantenía.
 *
 * VERIFICADO ANTES DE SACAR (grep + arch-explorer):
 *   - `appendAutoLanes` sólo se llamaba en L1999 y retornaba de inmediato.
 *   - `addAutoLaneAt`/`addAutoLane` sólo alimentaban `lane._auto` (render muerto).
 *   - `closeAuto` sólo filtraba `c._auto` + `renderTimeline()` REDUNDANTE (sus dos
 *     llamadores, L3268/L3271, re-renderizan igual después).
 *   - `laneAutoH` sólo lo usaba el `appendAutoLanes` muerto.
 *   - `lane._autoP` (modelo vigente [A5]) queda intacto: `laneAutoP()`, `openAuto()`,
 *     el chooser de la cabecera de pista y `attachClipAuto` siguen igual.
 *
 * RESTAURAR: re-pegar estas funciones en app.js, re-añadir la llamada
 *   `if(!_isAud)appendAutoLanes(li,W,tracks,heads);` en `renderTimeline` (tras las
 *   filas de clip), el ítem de menú "Show automation in a new lane", las clausulas
 *   `_auto` en `sepAuto`/`returnToDefault`/fx-delete, y quitar el `return;` de cabeza
 *   de `appendAutoLanes`.
 * ============================================================================ */

// ---- lane._auto : creación de sub-carriles (menú "Show automation in a new lane") ----
/* [R93] '+' adds the next automation sub-lane directly (Ableton): first an animated-but-hidden param, else the next unshown one */
function addAutoLaneAt(li){ const lane=state.lanes[li]; if(!lane||lane.kind==='audio')return; lane._auto=Array.isArray(lane._auto)?lane._auto:[];
  const used=new Set(lane._auto); used.add(laneAutoP(lane,li));
  const cands=CURVE_PARAMS.map(d=>d[0]).concat(laneFxKeys(li));
  const free=cands.find(p=>!used.has(p)&&laneHasKf(li,p))||cands.find(p=>!used.has(p));
  if(!free){ flashStatus(T('All parameters already shown','Todos los parámetros ya están visibles')); return; }
  lane._auto.push(free); state.inlineCurves=true; syncAutoUI(); const cb=$('#curvesBtn'); if(cb)cb.classList.add('on'); renderTimeline(); markDirty(); }
function addAutoLane(c){ if(!c||isAudioClip(c))return; addAutoLaneAt(c.lane); } // context-menu path ("Show Automation in New Lane")

// Ítem de menú de clip (contextmenu):
//   {label:T('Show automation in a new lane','Mostrar la automatización en una línea nueva'),fn:()=>{const c=clipById(id);if(c){showAutomation(c);addAutoLane(c);}}},

// ---- lane._auto + lane._autoH : render de sub-carriles (YA muerto por el `return;`) ----
/* [R92-T4→R93] TRACK-level automation sub-lanes (Ableton): they belong to the LANE (lane._auto), show the parameter
   across every clip of the track, and stay visible regardless of the selection. Resizable per (lane,param).
   [R93] Each header carries the Ableton chooser PAIR (device + parameter) — fx lanes use type-keys 'fxt:<type>:<p>'. */
function laneAutoH(lane,p){ return Math.max(AUTO_MIN_H,Math.min(AUTO_MAX_H,(lane._autoH&&lane._autoH[p])||AUTO_H)); }
function appendAutoLanes(li,W,tracks,heads){
  if(!state.inlineCurves)return; const lane=state.lanes[li]; if(!lane||lane.kind==='audio')return; const list=Array.isArray(lane._auto)?lane._auto:[]; if(!list.length)return;
  list.forEach((p,idx)=>{ if(!paramDef(null,p))return; const LHa=laneAutoH(lane,p);
    const sub=document.createElement('div'); sub.className='autolane'; sub.style.height=LHa+'px'; sub.style.width=W+'px';
    const cv=document.createElement('canvas'); cv.className='autocv'; cv.style.height=LHa+'px'; cv._H=LHa; cv._c=null; cv._li=li; cv._p=p; cv._kind='lane'; sub.appendChild(cv); tracks.appendChild(sub);
    windowAutoCv(cv); bindAutoCurve(cv);
    const sh=document.createElement('div'); sh.className='autohdr'; sh.style.height=LHa+'px';
    sh.style.setProperty('--pc',autoColor(p));
    const selC0=selClip(); const focused=!!(selC0&&selC0.lane===li);
    const pick=np=>{ lane._auto[idx]=np; renderTimeline(); markDirty(); };
    sh.appendChild(focused?autoDuo(li,p,pick):autoDuoText(li,p,pick));
    const btns=document.createElement('div'); btns.style.cssText='display:flex;gap:4px;align-items:center;flex-shrink:0;';
    btns.innerHTML=`<button class="abt" data-a="add" title="${T('Add automation lane','Añadir carril de automatización')}">+</button>`+
      `<button class="abt" data-a="close" title="${T('Remove this lane','Quitar este carril')}">${ICO('close',11)}</button>`;
    sh.appendChild(btns);
    const res=document.createElement('div'); res.className='autores'; res.title=T('Drag to resize lane','Arrastra para redimensionar el carril'); sh.appendChild(res);
    sh.querySelector('[data-a=add]').onclick=()=>addAutoLaneAt(li);
    sh.querySelector('[data-a=close]').onclick=()=>{ lane._auto.splice(idx,1); renderTimeline(); markDirty(); };
    res.addEventListener('pointerdown',ev=>{ ev.preventDefault(); ev.stopPropagation(); const h0=LHa,y0=ev.clientY; lane._autoH=lane._autoH||{};
      const mv=e2=>{ lane._autoH[p]=Math.max(AUTO_MIN_H,Math.min(AUTO_MAX_H,h0+(e2.clientY-y0))); scheduleTimeline(); };
      const up=()=>{ window.removeEventListener('pointermove',mv); window.removeEventListener('pointerup',up); renderTimeline(); }; window.addEventListener('pointermove',mv); window.addEventListener('pointerup',up); });
    heads.appendChild(sh);
  });
}
// Llamada (en renderTimeline, tras las filas de clip):  if(!_isAud)appendAutoLanes(li,W,tracks,heads);

// ---- c._auto : lista de automatización a nivel de CLIP (legacy, nunca renderizada) ----
function closeAuto(c,p){ if(!c||!c._auto)return; c._auto=c._auto.filter(x=>x!==p); renderTimeline(); } // legacy clip-level list (no longer rendered)
// En sepAuto:        for(const k of ['_auto']) if(Array.isArray(c[k])) n[k]=c[k].slice();
// En returnToDefault: c._auto=[];
// En el borrado de FX (fxdel): if(Array.isArray(l._auto))l._auto=l._auto.filter(k=>!isFxtKey(k)||laneFxTypes(state.lanes.indexOf(l)).includes(k.split(':')[1]));
