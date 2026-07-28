/* ARCHIVED (deprecated / unused) — Immersive Studio Pro
 * Origen:   app.js · `labelWallFrac(room,seq,role)` + bloque del decal afín dentro de `drawRoomLabels3D`
 * Sacado:   2026-07-29 (R211)
 * Motivo:   los rótulos de muro pintados SOBRE el plano del muro (decal afín) se leían EN ESPEJO cuando la
 *           cámara orbital mira la sala desde fuera, y parecían flotar fuera de sitio. Beltrán pidió rótulos
 *           SIEMPRE legibles → se reemplazaron por texto en espacio de pantalla (horizontal, con fondo oscuro,
 *           patrón de drawLabels3D del domo) anclado al centro proyectado de cada muro. `labelWallFrac`
 *           ([R201], calculaba la fracción de alto del muro para el decal) quedó sin ningún caller.
 * Restaurar: re-insertar `labelWallFrac` a nivel de módulo junto a `drawRoomLabels3D`, y el bloque del decal
 *           dentro del bucle `for(const s of plan.seg){...}` de `drawRoomLabels3D` (reemplazando el bloque
 *           [R211] de rótulo en pantalla). `pt(u,v)` y `roomRoleLabel` siguen existiendo ahí.
 * Relacion: [R201] (origen), [R211] (retiro), PLAN.md ROUND 211
 */

/* [R201] Qué fracción del ALTO DE SU MURO ocupa el rótulo (FRONT/LEFT/…). Pedido de Beltrán: que en el 3D ocupe lo
   mismo que en el lienzo, respecto a su muro. En el lienzo el rótulo es un tamaño FIJO de pantalla (11px, es una
   guía superpuesta) sobre un muro que sí escala, así que su proporción sale de cuánto mide el muro en pantalla —
   y eso depende del panel. Por eso aquí no vale una constante: se replica el encaje del visor 2D (la tira cabe a
   lo alto o a lo ancho según el aspecto, por el zoom) y se devuelve 11/altoDelMuroEnPantalla. Antes era 0.03
   fijo, que en el panel del launcher salía tres veces más pequeño que en el lienzo de al lado.
   Los topes evitan un rótulo absurdo con zooms extremos. */
function labelWallFrac(room,seq,role){
  const stripW=seq&&seq.w||1, stripH=seq&&seq.h||1, A=stripW/stripH;
  const wa=(view.cw||1)/(view.ch||1);
  const sy=(A>=wa)?(wa/A):1;                                  // el mismo reparto que hace render() en el camino plano
  const tiraPx=Math.max(1,(view.ch||1)*sy*(state.view.zoom||1));
  const w=(room&&room.walls||[]).find(x=>x.role===role);
  const altoMuro=Math.max(1, tiraPx*((w?w.pxH:stripH)/stripH));
  return Math.max(0.012, Math.min(0.25, 11/altoMuro));
}

/* ——— bloque del decal (vivía dentro del bucle de muros de drawRoomLabels3D) ——— */
    // wall-role label PAINTED ON the wall plane (affine decal → follows perspective like the grid), small, in the bottom-left corner (from INSIDE). Aspect-corrected so it isn't stretched.
    const lbl=roomRoleLabel(s.role).toUpperCase(); const Fpx=44; gx.save(); gx.font='700 '+Fpx+'px Geist'; const tw=Math.max(1,gx.measureText(lbl).width), th=Fpx;
    const wallW=Math.hypot(s.b[0]-s.a[0],s.b[1]-s.a[1])||1, wallH=s.h||1;
    const wv=labelWallFrac(room,seq,s.role), wu=Math.min(0.9, wv*(tw/th)*(wallH/wallW)); // wu from text aspect × wall's physical aspect → no horizontal stretch
    const uA=0.96, vA=0.04; const O=pt(uA,vA), Xp=pt(Math.max(0.02,uA-wu),vA), Yp=pt(uA,vA+wv);
    if(O&&Xp&&Yp){ gx.setTransform((Xp[0]-O[0])/tw,(Xp[1]-O[1])/tw,(O[0]-Yp[0])/th,(O[1]-Yp[1])/th,Yp[0],Yp[1]); gx.textAlign='left'; gx.textBaseline='top'; gx.fillStyle='rgba(208,212,218,0.5)'; gx.fillText(lbl,0,0); }
    gx.restore(); }
