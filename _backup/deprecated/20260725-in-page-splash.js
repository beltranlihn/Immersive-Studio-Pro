/* ============================================================================================================
   ARCHIVED — splash DENTRO del documento del editor (showSplash) · reemplazado 2026-07-25 (R151)
   ------------------------------------------------------------------------------------------------------------
   Origen:   app.js · `showSplash(minLoops,onReady)` (~L2124) · index.html · CSS `.splashcard/.splashlogo/.splashttl`
             (~L618-620). Commit previo: 83a965f.
   Sacado:   2026-07-25
   Motivo:   El handoff de Claude Design (design_handoff_launcher_splash) define el splash como una VENTANA PROPIA
             de 1080×1080 previa a la del editor, no como una capa dentro de él, y Beltrán lo pidió explícito:
             "abre en 1080x1080, termina de cargar y recién ahí abre la app en 16/9". Ahora el proceso principal
             crea `splash.html` en su propia ventana y la ventana del editor nace oculta; `dsp:bootReady` la
             revela. Este overlay quedó sin llamadores.
   Restaurar:pegar la función de abajo en app.js junto a `startLogoLoop`, devolver el CSS a index.html, y en
             `init()` volver a envolver el destino con `showSplash(2, ()=>{ … })` en vez de la cadena
             `_dest.then(bootReveal)`. Además habría que dejar de ocultar la ventana en main.js (`createSplash`,
             `finishBoot`, `bootTimer`) o el editor nunca se mostraría.
   Relacion: R147 (era la pieza que mataba el flash de arranque), R151, ADR-0007, ADR-0008
   Nota:     `startLogoLoop` / `preloadLogoFrames` NO se archivan: los siguen usando la pantalla de carga de
             proyecto (`showLoadingScreen`) y la pantalla de inicio (`showLanding`).
   ============================================================================================================ */

/* ------------------------------------------------------------------------------------------------------------
   app.js
   ------------------------------------------------------------------------------------------------------------ */
/* [R134] branded square splash: the logo loop plays in a small square window for `minLoops` cycles, then reveals. */
function showSplash(minLoops,onReady){ document.body.classList.remove('preboot'); // [boot] the splash is taking over → reveal the editor under it (kills the pre-splash flash of the empty editor chrome); synchronous, so no paint happens with #app visible-but-uncovered
  if(document.getElementById('splashOv')){ if(onReady)onReady(); return; }
  const ov=document.createElement('div'); ov.className='overlay'; ov.id='splashOv'; ov.style.background='#0E0F11'; ov.style.zIndex='360';
  ov.innerHTML=`<div class="splashcard"><img class="splashlogo" width="128" height="128" alt="Immersive Studio Pro"><div class="splashttl">Immersive Studio Pro</div></div>`;
  document.body.appendChild(ov); let loops=0, done=false;
  const stop=startLogoLoop(ov.querySelector('.splashlogo'),30,()=>{ if(++loops>=minLoops&&!done){ done=true; finish(); } });
  ov._stopLogo=stop;
  function finish(){ stop(); if(onReady)onReady(); // paint the destination (start screen / onboarding) UNDER the splash FIRST, so the fade reveals it — not a bare editor frame (landing z-300 < splash z-360)
    ov.style.transition='opacity .28s'; ov.style.opacity='0'; setTimeout(()=>{ ov.remove(); },300); }
  setTimeout(()=>{ if(!done){ done=true; finish(); } }, minLoops*3200+1500); } // safety: never hang if rAF is throttled

/* ------------------------------------------------------------------------------------------------------------
   index.html — iba junto al resto de los overlays
   ------------------------------------------------------------------------------------------------------------
  .splashcard{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;background:transparent;}
  .splashcard .splashlogo{width:min(1080px,82vmin);height:min(1080px,82vmin);object-fit:contain;border-radius:min(64px,6vmin);}
  .splashcard .splashttl{font-size:13px;color:var(--ink-3);letter-spacing:0.02em;text-align:center;padding:0 14px;}
   ------------------------------------------------------------------------------------------------------------ */

/* ------------------------------------------------------------------------------------------------------------
   Llamada que tenía en init() (app.js)
   ------------------------------------------------------------------------------------------------------------ */
// showSplash(2, ()=>{ if(document.getElementById('loadingOv') || currentPath) return; // [R134] branded logo-loop splash (~2 cycles) → then… (unless a double-clicked project is already opening)
//   if(!onboardDone()) startOnboarding(); else showLanding(); }); // [D7] first launch → demo scene + guided tour; afterwards → start screen
