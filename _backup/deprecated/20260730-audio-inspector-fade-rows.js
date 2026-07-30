/* ============================================================================================================
   ARCHIVADO 2026-07-30 · [R225·5] · política: ADR-0007 (archivar, no borrar)
   Procedencia: app.js · buildAudioInspector (~L4538) + su cableado al final de la misma función

   QUÉ ERA
   Las dos filas numéricas "Fade in" / "Fade out" del inspector de un clip de AUDIO, en segundos.

   POR QUÉ SE VA (decisión de Beltrán, 2026-07-29)
   Desde [R223] el fundido de un clip de audio se hace arrastrando el tirador de la esquina del clip, ES el volumen, y
   se ve mientras se hace (y sobre un corte se convierte en crossfade). Las cajas eran un segundo mando para lo mismo,
   más lejos del gesto y sin retorno visual.

   QUÉ NO SE VA
   Los DATOS: `c.fadeIn` / `c.fadeOut` siguen existiendo, los escribe `startFadeDrag` y los aplica
   `collectAudioEvents` (envolvente por nodo de ganancia) igual que antes. Sólo desaparece el duplicado del inspector.

   CÓDIGO RETIRADO (tal cual estaba)
   ------------------------------------------------------------------------------------------------------------
   // en el template de host.innerHTML, entre Volume y "Single-sided wave":
      <div class="prow"><span class="kf" style="cursor:default;"></span><span class="lab">${T('Fade in','Entrada')}</span><span style="flex:1;"></span><input type="number" id="auFi" class="tnum" value="${(+(c.fadeIn||0)).toFixed(2)}" min="0" max="60" step="0.1" style="${box42}"><span style="color:var(--ink-dim);font-size:11px;width:14px;text-align:right;">s</span></div>
      <div class="prow"><span class="kf" style="cursor:default;"></span><span class="lab">${T('Fade out','Salida')}</span><span style="flex:1;"></span><input type="number" id="auFo" class="tnum" value="${(+(c.fadeOut||0)).toFixed(2)}" min="0" max="60" step="0.1" style="${box42}"><span style="color:var(--ink-dim);font-size:11px;width:14px;text-align:right;">s</span></div>

   // y al final de buildAudioInspector:
   const fi=host.querySelector('#auFi'), fo=host.querySelector('#auFo');
   fi.onchange=()=>{ const cc=selClip(); if(!cc)return; pushUndo(); cc.fadeIn=Math.max(0,+fi.value||0); renderTimeline(); if(state.playing)startAudio(); markDirty(); };
   fo.onchange=()=>{ const cc=selClip(); if(!cc)return; pushUndo(); cc.fadeOut=Math.max(0,+fo.value||0); renderTimeline(); if(state.playing)startAudio(); markDirty(); };
   ------------------------------------------------------------------------------------------------------------

   EN SU LUGAR
   Una fila "Wave scale" (`#auWScale`) = zoom vertical del visualizador de onda (`state.tl.waveScale`, global a la
   línea de tiempo como `waveTopHalf`; sólo dibujo, no toca el sonido ni el export).
   ============================================================================================================ */
