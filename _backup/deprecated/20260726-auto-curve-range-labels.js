/* ==============================================================================================================
   ARCHIVADO · 2026-07-26 · R176 · Etiquetas de RANGO de la curva de automatización (el «100%» y el «0%»)

   ORIGEN
     app.js → drawAutoCurve(), justo después del rótulo del parámetro. Dibujaban el tope del rango arriba y el
     suelo abajo, pegados al borde izquierdo del clip, en el modo automatización.

   MOTIVO
     Beltrán: «no debe aparecer el 0 y 100 al costado, puesto que cada parámetro tiene numeración distinta».
     Un par de números sueltos ahí no dicen de qué parámetro son —los hay en grados, por ciento y píxeles— y
     ensucian el clip. La identidad y el valor ya están en los chips de la cabecera de pista y en el inspector.

   RESTAURAR
     Devolver las dos líneas a `drawAutoCurve()`, en el `else` del `if(cv._label)`. `lx` sigue existiendo (lo usa
     la rama del rótulo); `mx`, `mn` y `unit` también siguen calculándose ahí.
   ============================================================================================================== */

  const fmtV=v=>{const r=Math.round(v*10)/10;return (r%1===0?r.toFixed(0):r.toFixed(1))+(unit||'');};
  else if(H>=30){ ctx.font='11px Geist'; ctx.fillStyle='rgba(154,160,168,0.55)'; ctx.textBaseline='top'; ctx.fillText(fmtV(mx),lx,1); ctx.textBaseline='alphabetic'; ctx.fillText(fmtV(mn),lx,H-2); }
