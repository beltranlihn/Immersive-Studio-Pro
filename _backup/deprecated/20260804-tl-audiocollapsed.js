/* ARCHIVED (deprecated / unused) — Immersive Studio Pro
 * Origen:   app.js · state.tl.audioCollapsed (literal de `state`) + su lectura en `loadProject`
 *           + su escritura en `serProject` (commit 3467792 "R242 - El plan de la auditoria de agosto, ejecutado")
 * Sacado:   2026-08-04
 * Motivo:   [R242b] Campo MUERTO desde R148. Era la persistencia de "el módulo de audio reabre plegado" ([R110]),
 *           pero ese módulo (`.audiozone`) **no existe desde R148** — lo dice el propio comentario de app.js
 *           junto a `audioZoneScrollBy`: «ese módulo no existe desde R148, así que `inAudio` era siempre false».
 *           Nunca hubo un setter: `git log -S "audioCollapsed=true"` no devuelve NADA en toda la historia del
 *           repo, así que el valor sólo podía ser `false` y reabrir "plegado" era un estado inalcanzable.
 *           La auditoría 2026-08 (§2.5) ofrecía dos salidas —revivir o retirar—; R242 eligió REVIVIR y se
 *           equivocó: devolver la escritura sólo añadía un campo constante al `.isp`. Una revisión de código
 *           posterior lo cazó y aquí se corrige por la salida buena.
 * Restaurar:Sólo tiene sentido si vuelve a existir un módulo de audio plegable. Entonces: (1) re-añadir
 *           `audioCollapsed:false` al literal `state.tl`; (2) el reset en `resetProjDefaults()`; (3) la lectura
 *           dentro del `if(obj.tl)` de `loadProject`; (4) la escritura en el objeto `tl` de `serProject`; y
 *           (5) —lo que faltó siempre— un GESTO que lo ponga en `true`.
 * Relacion: AUDITORIA-2026-08.md §2.5 · PLAN.md ROUND 242 (decisión 4, corregida en R242b) · docs/adr/adr-0007
 */

// 1) literal de `state.tl` (app.js ~L133) — el campo, dentro del objeto tl:
//    audioCollapsed:false      // [R110] audioCollapsed = the audio module is compacted to just its bar

// 2) resetProjDefaults() (app.js ~L9446):
//    state.tl.audioCollapsed=false;

// 3) loadProject(), dentro de `if(obj.tl){ … }` (app.js ~L9498):
state.tl.audioCollapsed=!!obj.tl.audioCollapsed; state.tl._audioScroll=0; // [R110] the audio module reopens collapsed if it was saved collapsed

// 4) serProject(), dentro del objeto `tl` (app.js ~L9209):
//    audioCollapsed:!!state.tl.audioCollapsed   // [R242] añadido y retirado el mismo día (ver Motivo)

/* NOTA: `state.tl._audioScroll` NO se archiva — lo sigue escribiendo `audioZoneScrollBy` y su reset a 0 se
   conserva en `loadProject`. Sólo se retira `audioCollapsed`. */
