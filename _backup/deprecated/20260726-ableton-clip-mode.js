/* ============================================================================================================
   ARCHIVED — modo de agarre de clip "Ableton" y su conmutador (Simple) · retirado 2026-07-26 (R155)
   ------------------------------------------------------------------------------------------------------------
   Origen:   app.js · `state.tl.simpleClips` · `toggleSimpleClips()` · `syncSimpleUI()` · la rama Ableton del
             pointerdown de `#tracks` · el cursor condicional de `applyToolCursor` · restauración en `loadProject`
             · el interruptor de Preferences · la entrada de la paleta de comandos · `applyLang` del botón.
             index.html · `#simpleClipBtn` en el well del transport · CSS `body.simpleclips …`.
             Commit previo: f5d718c.
   Sacado:   2026-07-26
   Motivo:   Pedido de Beltrán: "eliminemos el formato tipo Ableton y dejemos sólo el tipo Premiere para arrastrar
             el clip desde donde queramos". Convivían DOS modelos de interacción con el clip y un botón para
             cambiarlos; el de Premiere (arrastrar desde cualquier punto del clip) pasa a ser el único, así que el
             conmutador deja de tener sentido. El diseño tampoco lo tiene: su well de edición es Simple·Auto·Grid·
             Fit, pero "Simple" ahí ya no describe un modo alternativo.
   Restaurar:1) devolver `simpleClips:true` a `state.tl`;
             2) devolver `toggleSimpleClips`/`syncSimpleUI` y sus llamadas (init, loadProject, Preferences, paleta);
             3) devolver la guarda `&& !state.tl.simpleClips` del pointerdown (la que daba selección de rango
                arrastrando SOBRE el clip, al estilo Ableton);
             4) devolver el cursor condicional en `applyToolCursor`;
             5) devolver el botón y el CSS `body.simpleclips`.
   OJO:      Al quedar sólo Premiere, `body.simpleclips` está SIEMPRE puesto — no se borró la clase, se fija en el
             arranque, para no tener que tocar las reglas de CSS que dependen de ella.
   Relacion: R94c/R94f (donde nació), R155, ADR-0007, ADR-0008
   ============================================================================================================ */

/* --- estado --- */
// tl:{ …, simpleClips:true }   // [R94c/f]

/* --- conmutador --- */
function toggleSimpleClips(){ state.tl.simpleClips=!state.tl.simpleClips; syncSimpleUI(); markDirty();
  flashStatus(state.tl.simpleClips?T('Simple clips — drag from anywhere · range selection outside clips','Clips simples — arrastra desde cualquier punto · selección de rango fuera de los clips'):T('Clip grab: title bar only (Ableton)','Agarre de clip: sólo la barra de título (Ableton)')); }
function syncSimpleUI(){ const b=$('#simpleClipBtn'); if(b)b.classList.toggle('on',!!state.tl.simpleClips); document.body.classList.toggle('simpleclips',!!state.tl.simpleClips); applyToolCursor(); }

/* --- la rama Ableton del hit-test de #tracks: arrastrar sobre el CUERPO del clip hacía selección de rango --- */
// if(!isTitle&&!isL&&!isR&&!isFade&&!state.tl.simpleClips){ startTimeSelect(e); return; }

/* --- cursor condicional --- */
// const sel=(state.tl.tool==='select'); $$('.clip').forEach(c=>c.style.cursor=sel?(state.tl.simpleClips?'grab':'default'):cur);

/* --- restauración al abrir un proyecto --- */
// state.tl.simpleClips=(obj.tl.simpleClips!=null)?!!obj.tl.simpleClips:true; syncSimpleUI(); // [R94f]

/* --- wiring del botón, interruptor de Preferences y entrada de paleta --- */
// { const b=$('#simpleClipBtn'); if(b)b.onclick=()=>toggleSimpleClips(); } // [R94c]
// ${sw('simpleclips',state.tl.simpleClips,T('Simple clips','Clips simples'))}
// if(k==='simpleclips'){state.tl.simpleClips=b.classList.contains('on');syncSimpleUI();markDirty();} // [R94c]
// [c5,T('Toggle simple clips (Premiere-style)','Activar/desactivar clips simples (estilo Premiere)'),'',()=>$('#simpleClipBtn').click()]
// tn('#simpleClipBtn','Simple','Simple'); ttl('#simpleClipBtn','Simple clips (Premiere-style)…','Clips simples (estilo Premiere)…')

/* --- index.html · botón del well de edición del transport ---
  <button id="simpleClipBtn" title="Simple clips (Premiere-style): drag and select a clip from anywhere on it — range selection works outside clips only"><i class="ic" data-ico="clip"></i> Simple</button>
--- */
