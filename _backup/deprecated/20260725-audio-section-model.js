/* ============================================================================================================
   ARCHIVED — modelo de "secciones" de pista (vídeo arriba / audio abajo) · retirado 2026-07-25 (R152)
   ------------------------------------------------------------------------------------------------------------
   Origen:   app.js — partición de `lanesTopDown()` [R92-T8], clamp por grupo de `startLaneDrag`, filtro por tipo de
             `wheelResizeLanes`, ramas `.audiozone` de los dos handlers de rueda, y el `renderVZoom` de sólo-alturas.
             Commit previo: 0da6d43.
   Sacado:   2026-07-25
   Motivo:   R148 ya había unificado audio y vídeo en una sola columna, pero el ORDEN seguía particionado por tipo y
             el arrastre tenía un clamp que impedía soltar una pista de audio entre las de vídeo. El diseño de
             Claude Design usa una única lista ordenada que incluye el audio (`trackOrder:['v4','v3','v2','v1','a1']`)
             y Beltrán lo pidió explícito: "audio y vídeo se deben comportar similar, permitiendo reordenar,
             agrandar, achicar". Las ramas `.audiozone` ya eran código muerto desde R148 (ese nodo no se renderiza).
   Restaurar:volver a poner la partición en `lanesTopDown`, el clamp en `startLaneDrag` y el filtro por tipo en
             `wheelResizeLanes`. OJO: sólo tiene sentido si además se restaura el módulo sticky de audio
             (`#audioZone`/`#audioHeadZone`), que se retiró en R148 — sin él, esto sólo impide reordenar.
   Relacion: R92-T8, R110, R148, R152, ADR-0007, ADR-0008
   ============================================================================================================ */

/* --- 1 · orden de pantalla particionado por tipo (app.js, junto a `view`) --- */
/* [R92-T8] Premiere-style layout: video tracks grouped ON TOP, audio tracks grouped at the BOTTOM, split by a
   divider. Display-ONLY grouping — state.lanes (and every clip's lane INDEX) is untouched, so compositing/save/undo
   are unaffected. Within each group the previous top-first order is preserved. reverse(grouped) still reconstructs
   a valid array (all-audio-then-all-video), so the track-reorder drag keeps working with a same-group clamp. */
const lanesTopDown = ()=>{ const rev=state.lanes.map((l,i)=>i).reverse();
  return [...rev.filter(i=>state.lanes[i]&&state.lanes[i].kind!=='audio'), ...rev.filter(i=>state.lanes[i]&&state.lanes[i].kind==='audio')]; };

/* --- 2 · el mismo reordenamiento dentro de renderTimeline --- */
// const _o0=lanesTopDown(); const _order=[..._o0.filter(li=>state.lanes[li].kind!=='audio'),..._o0.filter(li=>state.lanes[li].kind==='audio')];

/* --- 3 · clamp por grupo del arrastre de cabeceras (dentro de `startLaneDrag`, antes de `dropDisp=pos`) --- */
// { const isAud=(state.lanes[li]||{}).kind==='audio'; const inG=disp.map(idx=>((state.lanes[idx]||{}).kind==='audio')===isAud); const gLo=inG.indexOf(true),gHi=inG.lastIndexOf(true)+1; pos=Math.max(gLo,Math.min(gHi,pos)); } // [R92-T8] reorder only within the same group (can't drag video into the audio section or vice-versa)

/* --- 4 · Alt+rueda escalaba sólo las pistas "de esta sección" --- */
function wheelResizeLanes(e,inAudio){ const f=e.deltaY<0?1.1:1/1.1; for(const l of state.lanes){ if((l.kind==='audio')!==inAudio)continue; if(l.collapsed)l.collapsed=false; l.h=Math.max(LANE_MIN_H,Math.min(LANE_MAX_H,Math.round((l.h||LANE_DEF_H)*f))); } scheduleTimeline(); }

/* --- 5 · ramas `.audiozone` de los handlers de rueda (muertas desde R148) --- */
// $('#tlscroll').addEventListener('wheel',e=>{ const inAudio=!!e.target.closest('.audiozone');
//   if(e.ctrlKey||e.metaKey){e.preventDefault();tlZoomAt(e,e.deltaY<0?1:-1);}
//   else if(e.altKey){ e.preventDefault(); wheelResizeLanes(e,inAudio); }
//   else if(e.shiftKey){e.preventDefault();$('#tlscroll').scrollLeft+=e.deltaY;}
//   else if(inAudio){ e.preventDefault(); audioZoneScrollBy(e.deltaY); } },{passive:false});
// $('#trackHdr').addEventListener('wheel',e=>{ e.preventDefault(); const inAudio=!!e.target.closest('.audiozone');
//   if(e.altKey){ wheelResizeLanes(e,inAudio); return; }
//   if(inAudio)audioZoneScrollBy(e.deltaY); else $('#tlscroll').scrollTop+=e.deltaY; },{passive:false});

/* --- 6 · V-zoom de sólo-alturas (reemplazado por la barra vertical completa: scroll + zoom con casquetes) --- */
function renderVZoom(){ const th=$('#tlVZoomThumb'), tr=$('#tlVZoomTrack'); if(!th||!tr)return;
  const ls=state.lanes.filter(l=>!l.collapsed); if(!ls.length){ th.style.display='none'; return; } th.style.display='';
  const avg=ls.reduce((s,l)=>s+_laneDefH(l),0)/ls.length; const H=tr.clientHeight||100;
  const f=Math.max(0,Math.min(1,(avg-LANE_MIN_H)/Math.max(1,LANE_MAX_H-LANE_MIN_H)));
  const thH=Math.max(26,Math.round(H*0.3)); th.style.height=thH+'px'; th.style.top=Math.round((H-thH)*f)+'px'; }
// if($('#tlVZoomThumb'))$('#tlVZoomThumb').addEventListener('pointerdown',ev=>{ ev.preventDefault(); pushUndo();
//   const y0=ev.clientY, base=state.lanes.map(_laneDefH);
//   const mv=e2=>{ const f=Math.max(0.25,Math.min(4,1+(e2.clientY-y0)/160));
//     state.lanes.forEach((l,i)=>{ if(l.collapsed)return; l.h=Math.max(LANE_MIN_H,Math.min(LANE_MAX_H,Math.round(base[i]*f))); }); scheduleTimeline(); };
//   const up=()=>{ window.removeEventListener('pointermove',mv); window.removeEventListener('pointerup',up); renderTimeline(); markDirty(); };
//   window.addEventListener('pointermove',mv); window.addEventListener('pointerup',up); });

/* --- CSS que acompañaba a la barra vertical vieja (index.html) ---
  .tlvzoom{width:12px;flex-shrink:0;background:var(--bg-0);position:relative;border-left:.5px solid rgba(0,0,0,0.4);}
  .tlvztrack{position:absolute;left:3.5px;top:27px;bottom:6px;width:5px;background:#161616;border-radius:2px;}
  .tlvzthumb{position:absolute;left:0;width:5px;background:rgba(255,255,255,0.10);border-radius:2px;cursor:grab;}
  .tlvzthumb::before,.tlvzthumb::after{content:'';position:absolute;left:50%;width:7px;height:7px;transform:translateX(-50%);border-radius:50%;background:rgba(184,184,184,0.7);}
  .tlvzthumb::before{top:-1px;} .tlvzthumb::after{bottom:-1px;}
--- */
