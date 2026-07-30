/* ============================================================================================================
   ARCHIVADO 2026-07-30 · [R225·2] · política: ADR-0007 (archivar, no borrar)
   Procedencia: app.js · _renderInspectorMain → sección Source (~L4271, justo antes de la fila "Equirect 360°")
   Añadido en: [R216]

   QUÉ ERA
   Un conmutador segmentado (`.seg2#domeModeSeg`) que sólo aparecía cuando el clip seleccionado era una SECUENCIA /
   COMPOSICIÓN (`isSeqMedia(m)`), y que reemplazaba para ese caso al interruptor genérico "Fulldome src". Escribía la
   MISMA propiedad, `c.props.fulldome`:
     · "Dome master" (fulldome = true)  → el nest se dibuja 1:1 por PFD, Size hace zoom cenital del domo completo.
     · "Patch"       (fulldome = false) → el mismo clip entra por el camino gnomónico normal (PW), y az/el/size lo
                                          ubican como un clip cualquiera.

   POR QUÉ SE VA (decisión de Beltrán, 2026-07-29)
   Un nest ES el lienzo completo de su propia secuencia. Ubicarlo como un parche gnomónico vuelve a deformar algo que
   ya venía deformado, y esa doble deformación era la causa del grueso de las confusiones al trabajar con composiciones.
   La decisión es que el nest sea SIEMPRE máster de domo, sin elección que equivocar.

   QUÉ NO SE VA
   El motor de parche (programa PW, la rama `else` de `drawClip`) sigue intacto: lo usan todos los demás tipos de clip.
   Lo único que desaparece es la posibilidad de elegirlo PARA UN NEST. Transform sigue aplicando al nest (Size = zoom
   cenital, rot se suma al azimut desde R196, color, opacidad, máscaras…).

   CÓMO SE SUSTITUYE
   · `makeClip`  → `fulldome: isSeqMedia(m)` (antes `false` fijo) y `equirect` nunca se autodetecta para un nest.
   · `nestSelection` / `createComposition` → `nc.props.fulldome=true; nc.props.equirect=false;`.
   · El inspector, para un nest, no dibuja ni este conmutador ni la fila Equirect (deshabilitada: un nest no es un
     panorama 2:1), y trae un salvavidas que corrige `fulldome` si alguna ruta futura lo dejara en false.
   · `migrateNestFulldome()` (llamada desde `loadProject`) convierte los `.isp` guardados en Patch.

   CÓDIGO RETIRADO (tal cual estaba)
   ------------------------------------------------------------------------------------------------------------
    if(isSeqMedia(m)){
      const master=!!c.props.fulldome;
      const dmRow=document.createElement('div'); dmRow.className='prow'; dmRow.style.cssText='flex-direction:column;align-items:stretch;gap:4px;padding-top:5px;padding-bottom:6px;';
      dmRow.innerHTML=`<div style="display:flex;align-items:center;gap:8px;">
          <span class="kf" style="cursor:default;visibility:hidden;"></span>
          <span class="lab" style="flex:1;min-width:0;">${T('Dome placement','Ubicación en domo')}</span>
          <div class="seg2" id="domeModeSeg"><button data-v="master" class="${master?'on':''}">${T('Dome master','Máster domo')}</button><button data-v="patch" class="${!master?'on':''}">${T('Patch','Parche')}</button></div>
        </div>
        <div style="font-size:10px;color:var(--ink-3);line-height:1.4;">${master
          ? T('Size zooms the whole dome around the zenith — off-center content exits at the rim','Size hace zoom del domo completo sobre el cenit — lo descentrado sale por el borde')
          : T('Places and scales like a regular clip','Se ubica y escala como un clip normal')}</div>`;
      $('#sourceRows').appendChild(dmRow);
      dmRow.querySelectorAll('#domeModeSeg button').forEach(b=>b.onclick=()=>{ if(b.classList.contains('on'))return; const cc=selClip(); if(!cc)return; pushUndo();
        cc.props.fulldome=(b.dataset.v==='master'); if(cc.props.fulldome)cc.props.equirect=false;
        if(_raOn)raInvalidate(); render(); markDirty(); renderInspector(); });
    } else {
   ------------------------------------------------------------------------------------------------------------
   ============================================================================================================ */
