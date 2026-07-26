/* ==============================================================================================================
   ARCHIVADO · 2026-07-26 · R174 · Superposición de ZONA SEGURA (action-safe / title-safe)

   ORIGEN
     · app.js → drawFlatFrame()   (guías rectangulares sobre el lienzo plano)
     · app.js → el bloque de guías del domo (anillos por elevación)
     · index.html → botón `#dispSeg button[data-d="safe"]` y el icono `safe` del catálogo ICO()
     · app.js → rama 'safe' del manejador de #dispSeg, espejo en el panel "More", interruptor de Preferences,
                tooltip en applyLang y el estado state.view.showSafe / state.prefs.safe

   MOTIVO
     Beltrán, tras comparar la barra del visor con el handoff de Claude Design: «Safe no va. Se elimina».
     El prototipo lleva CUATRO superposiciones —Grid · Outline · Horizon/Center/Seam · Alpha— y ninguna es Safe.
     (El handoff sí menciona "Safe" en la variante de TEXTO que vive dentro del panel "More", pero la decisión
     de Beltrán es quitarla del programa, no moverla.)

   RESTAURAR
     1. Devolver los dos bloques de abajo a `drawFlatFrame()` y al bloque de guías del domo, donde estaban
        (ambos justo después del dibujo de la cuadrícula, antes de las guías de centro / la costura).
     2. Reponer en index.html, dentro de `#dispSeg`, entre Grid y Outline:
        <button data-d="safe" title="Safe-zone overlay"><i class="ic" data-ico="safe"></i> Safe</button>
     3. Reponer en el manejador de #dispSeg: if(d==='safe')state.view.showSafe=!state.view.showSafe;
        y en la línea de estado del botón: d==='safe'?state.view.showSafe:
     4. Reponer la fila del espejo en "More" y el interruptor de Preferences ('safe').
     El icono `safe` del catálogo ICO() se deja donde está: no estorba y otras vistas podrían reutilizarlo.
   ============================================================================================================== */

// ── 1 · guías rectangulares (lienzo plano) — iban en drawFlatFrame(), tras la cuadrícula de tercios
  if(state.view.showSafe){ /* [R106] action-safe (inner 93%) + title-safe (inner 90%), broadcast convention, labelled */
    const rect=(inset,dash,col,lbl,bottom)=>{ const mx=w*inset,my=h*inset; gx.lineWidth=1; gx.strokeStyle=col; gx.setLineDash(dash); gx.strokeRect(x0+mx,y0+my,w-2*mx,h-2*my); gx.setLineDash([]);
      gx.font='10px Geist'; gx.textAlign='left'; gx.textBaseline='alphabetic'; const tx=x0+mx+4, ty=bottom?(y0+h-my-4):(y0+my+12), tw=gx.measureText(lbl).width; gx.fillStyle='rgba(6,7,9,0.6)'; gx.fillRect(tx-3,ty-10,tw+6,13); gx.fillStyle=col; gx.fillText(lbl,tx,ty); };
    rect(0.035,[5,4],'rgba(201,205,211,0.55)',T('ACTION SAFE','ACCIÓN'),false);
    rect(0.05 ,[3,4],'rgba(201,205,211,0.34)',T('TITLE SAFE','TÍTULOS'),true); }

// ── 2 · anillos por elevación (domo) — iban en el bloque de guías del domo, tras la cuadrícula.
//        Incluye el anillo ámbar de aviso del CENIT (contenido a menos de ~10° del cénit obliga a forzar el cuello).
  if(state.view.showSafe){ /* [R106] fulldome delivery guides: rings by ELEVATION (azimuthal-equidistant, like the grid), labelled. Keep critical action off the rim / edge-blend zone, titles tighter, and flag the neck-straining zenith. */
    const ring=(E,dash,col,lbl)=>{ const r=(90-E)/curCovDeg()*R; gx.lineWidth=1; gx.strokeStyle=col; gx.setLineDash(dash); gx.beginPath(); gx.arc(c0[0],c0[1],r,0,7); gx.stroke(); gx.setLineDash([]);
      if(lbl){ gx.font='10px Geist'; gx.textAlign='center'; gx.textBaseline='alphabetic'; const ly=c0[1]-r-4, tw=gx.measureText(lbl).width; gx.fillStyle='rgba(6,7,9,0.6)'; gx.fillRect(c0[0]-tw/2-3,ly-10,tw+6,13); gx.fillStyle=col; gx.fillText(lbl,c0[0],ly); } };
    ring(5 ,[5,4],'rgba(201,205,211,0.55)',T('ACTION SAFE','ACCIÓN')); /* rim / projector edge-blend margin */
    ring(15,[3,4],'rgba(201,205,211,0.34)',T('TITLE SAFE','TÍTULOS')); /* comfortable reading band */
    /* zenith caution: content within ~10° of straight-up makes the audience crane their necks */
    const rz=(90-80)/curCovDeg()*R; gx.strokeStyle='rgba(229,181,103,0.5)'; gx.setLineDash([2,3]); gx.beginPath(); gx.arc(c0[0],c0[1],rz,0,7); gx.stroke(); gx.setLineDash([]); }
