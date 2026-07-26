/* ==============================================================================================================
   ARCHIVADO · 2026-07-26 · R178 · `startOnboarding()` — entrada del PRIMER ARRANQUE

   ORIGEN
     app.js, junto a startTour(). `init()` la llamaba cuando la bandera `dspOnboardV1` no existía: se SALTABA el
     launcher, montaba una escena de demostración y lanzaba el recorrido guiado encima de ella.

   MOTIVO
     Beltrán: «el tour instructivo no debe aparecer antes del landing. Debe aparecer cuando abrimos por primera
     vez un proyecto domo, 2d o 360 luego de configurarlo en el landing».
     Ahora `init()` va SIEMPRE al launcher y el recorrido lo dispara `lchCreate()` al crear el primer proyecto de
     cada formato (banderas `dspTour_dome` / `dspTour_flat` / `dspTour_room`), con textos propios de ese formato.
     Esta función se quedó sin llamantes.

   RESTAURAR
     Devolverla junto a startTour() y reponer en `init()` la rama:
       : (onboardDone() ? Promise.resolve(showLanding()) : startOnboarding());
     Ojo: `startTour` ahora recibe el FORMATO ('dome'|'flat'|'room'), no un booleano — el `startTour(true)` de
     abajo tendría que pasar a `startTour()` (textos genéricos) o al formato que corresponda.

   NOTA SOBRE `buildDemoProject()`
     NO se archiva, aunque esta función era su única llamante dentro del programa: la usan todos los arneses de
     prueba de `scratchpad/` (smoke, robustez y las sondas) para montar una escena reproducible. Es código de la
     app vivo sólo para las pruebas — queda dicho para que nadie lo tome por muerto y lo borre.
   ============================================================================================================== */

/* first-run entry (init routes here); the Help/Window re-launch calls startTour() directly (non-destructive) */
async function startOnboarding(){ if(_tourStop)_tourStop();
  try{ await buildDemoProject(); startTour(true); }
  catch(e){ try{diag('error','onboard','build failed',{err:String((e&&e.message)||e)});}catch(_){} try{showLanding();}catch(_){} } } // never strand the user on a blank editor: fall back to the start screen
