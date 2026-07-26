/* ============================================================================================================
   ARCHIVED — botón de modulación de la fila de parámetro (.modb) + su arco (.modarc) · retirado 2026-07-26 (R155)
   ------------------------------------------------------------------------------------------------------------
   Origen:   app.js · `buildRows()` (markup del botón + wiring a `openModPanel`) y el pintado del arco en el
             refresco de filas · index.html · CSS `.prow .modb`, `.prow.modon .modb`, `.prow .modarc`,
             `.prow.modon .modarc`. Commit previo: f5d718c.
   Sacado:   2026-07-26
   Motivo:   Pedido de Beltrán: "quitar los botones de modulación en inspector para que quede igual a la
             diagramación, los anchos y los faders del prototipo". La fila del prototipo (RevDomo:286-290) es
             etiqueta(60) · surco · caja de valor · UN botón de keyframe (20×20) — no tiene botón de modulación ni
             arco bajo el surco, y esos 20px + su hueco eran parte de lo que estrechaba el fader.
   Restaurar:1) devolver el `<button class="modb">` al innerHTML de la fila en `buildRows`, entre `.field` y `.nav`;
             2) devolver la línea `row.querySelector('.modb').onclick=…openModPanel(...)`;
             3) devolver el `<div class="modarc"></div>` dentro de `.field`, después de `.track`;
             4) devolver el bloque `if(md){ … arc.style.setProperty('--m0'/'--m1') … }` del refresco;
             5) devolver el CSS de abajo.
   OJO:      El MOTOR de modulación NO se archiva y sigue vivo (`c.mod`, `evalModStack`, `modSignal`, `hasMod`,
             `openModPanel`, y la llamada desde `evalR`). Sin el botón no hay forma de crear ni de editar una
             modulación desde la UI, pero un `.isp` viejo que ya tenga `c.mod` se sigue evaluando al renderizar.
             Es el mismo estado en que quedó el Master Grade en R148 y que hubo que cerrar en R150: si Beltrán
             decide que la modulación tampoco se usa, hay que archivar también el motor.
   Relacion: R95·C1 (donde nació), R150 (precedente del motor dormido), R155, ADR-0007, ADR-0008
   ============================================================================================================ */

/* --- app.js · dentro del innerHTML de la fila, entre `.field` y `.nav` --- */
// <button class="modb" data-p="${p}" title="${T('Modulation — LFO · audio · dome space','Modulación — LFO · audio · espacio del domo')}">${ICO('react',11)}</button>

/* --- app.js · dentro de `.field`, justo después de `.track` --- */
// <div class="modarc"></div>

/* --- app.js · wiring, después de `host.appendChild(row)` --- */
// row.querySelector('.modb').onclick=ev=>{ ev.stopPropagation(); openModPanel(selClip(),p,ev.currentTarget); }; // [R95·C1] the modulation stack lives behind this button

/* --- app.js · pintado del arco en el refresco de filas --- */
// if(md){ const arc=row.querySelector('.modarc'); if(arc){ const a=Math.max(0,Math.min(100,(v-mn)/(mx-mn)*100)), b=Math.max(0,Math.min(100,(vm-mn)/(mx-mn)*100));
//   arc.style.setProperty('--m0',Math.min(a,b)+'%'); arc.style.setProperty('--m1',Math.max(a,b)+'%'); } } // the span between base and modulated = what the modulation is doing right now

/* --- index.html · CSS ---
  .prow .modb{width:20px;height:20px;flex-shrink:0;display:grid;place-items:center;border:.5px solid rgba(255,255,255,0.1);border-radius:2px;background:transparent;color:var(--ink-faint);cursor:pointer;}
  .prow .modb:hover{color:var(--ink);background:var(--surface-3);}
  .prow.modon .modb{color:var(--auto-live);border-color:rgba(79,195,232,0.55);}
  .prow .modarc{position:absolute;left:0;right:0;bottom:-1px;height:2px;pointer-events:none;display:none;border-radius:1px;}
  .prow.modon .modarc{display:block;background:linear-gradient(90deg,transparent var(--m0,0%),var(--auto-live) var(--m0,0%),var(--auto-live) var(--m1,0%),transparent var(--m1,0%));}
--- */
