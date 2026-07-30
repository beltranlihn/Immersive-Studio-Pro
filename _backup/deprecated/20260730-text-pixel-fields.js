/* ============================================================================================================
   ARCHIVADO 2026-07-30 · [R225·6] · política: ADR-0007 (archivar, no borrar)
   Procedencia: app.js · _renderInspectorMain → editor de texto (`if(m && m.kind==='text')`, ~L4447)

   QUÉ ERA
   Los dos campos numéricos de la fila de párrafo del editor de texto:
     · `#txtSize`  — "Size (px)", el cuerpo de la fuente en píxeles (8…600).
     · `#txtLineH` — "Line height", el interlineado como factor (0,7…3).

   POR QUÉ SE VA (decisión de Beltrán, 2026-07-29: «quitar los dos campos de pixelaje»)
   El texto es VECTORIAL hasta el render, y su tamaño en pantalla lo pone el Size/Scale del clip. El cuerpo en píxeles
   no cambiaba el encuadre: el lienzo generado crece proporcionalmente en ancho Y alto con el cuerpo
   (W≈maxw+0,8·fs, H≈líneas·lh+0,8·fs), así que la PROPORCIÓN es invariante al cuerpo — lo único que cambiaba era la
   RESOLUCIÓN del rásterizado. Es decir: un mando que parecía de tamaño y sólo era de nitidez. Con presets de 74 px
   (Créditos) el texto se veía blando al escalarlo, que es justo el problema que se quería resolver.

   EVIDENCIA (por qué el interruptor "Outline" SÍ se queda)
   El otro punto del ticket pedía retirar «el switch sin función conocida». Comprobado por CDP sobre el clip de texto:
   `#txtStroke` (Outline) está cableado (`ioswBind(trow,'txtStroke')` → `reTxt` → `m.tstroke` → `strokeText` en
   `renderTextMedia`) y CAMBIA el rásterizado. Lo que fallaba era la legibilidad del efecto: el color del contorno
   (`m.tstrokeColor`) ya se guardaba en el `.isp` pero NO tenía ningún control, así que quedaba clavado en negro y
   sobre un domo negro un contorno negro no se ve → parecía que el interruptor no hacía nada. No se archiva: se le
   añade su selector de color al lado (`#txtStrokeCol`), que era el mando realmente ausente.

   CÓDIGO RETIRADO (tal cual estaba)
   ------------------------------------------------------------------------------------------------------------
        <input type="number" id="txtSize" value="${m.tfontSize||160}" min="8" max="600" title="${T('Size (px)','Tamaño (px)')}" style="width:54px;${inp}">
        <input type="number" id="txtLineH" value="${(m.tlineH||1.25)}" min="0.7" max="3" step="0.05" title="${T('Line height','Interlineado')}" style="width:50px;${inp}">

   // y en reTxt():
        mm.tfontSize=+$('#txtSize').value||160;
        mm.tlineH=Math.max(0.7,+$('#txtLineH').value||1.25);
   // y en el cableado:
        trow.querySelector('#txtSize').onchange=reTxt; trow.querySelector('#txtLineH').onchange=reTxt;
   ------------------------------------------------------------------------------------------------------------

   COMPATIBILIDAD
   `m.tfontSize` y `m.tlineH` SIGUEN en el modelo y en `serMedia`: un `.isp` viejo se dibuja exactamente igual que
   antes (misma proporción, misma resolución). Los medios NUEVOS nacen con `tfontSize = TXT_BASE_PX` (300) y el
   interlineado por defecto de 1,25. `renderTextMedia` incorpora además un ajuste que reduce el cuerpo si el lienzo
   fuera a topar con el límite de 4096 px — el ÚNICO caso en que el cuerpo sí habría cambiado el encuadre (párrafo
   largo recortado).

   SI HAY QUE DEVOLVER EL INTERLINEADO
   Es una fila: reponer el `<input id="txtLineH">` de arriba y su línea de `reTxt` + su `onchange`. Nada más depende
   de él (`renderTextMedia` ya lee `m.tlineH`).
   ============================================================================================================ */
