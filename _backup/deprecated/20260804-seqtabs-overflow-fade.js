/* ARCHIVED (deprecated / unused) — Immersive Studio Pro
 * Origen:   app.js · `seqTabsOvf()` + sus tres llamadas (dentro de `seqTabsReveal`, en el manejador de rueda y
 *           en el listener de `scroll` de `renderSeqBar`) · index.html · reglas CSS `.transport .seqtabs.ovf-l`,
 *           `.ovf-r` y `.ovf-l.ovf-r`   (commit 99b4f85 "R242b …", introducido en R239b)
 * Sacado:   2026-08-04
 * Motivo:   [R242c] DECISIÓN DE BELTRÁN: «corte hueso». El desvanecido era un añadido propio de R239b — al ocultar
 *           la barra de scroll de las pestañas de secuencia se perdió el único aviso de que había más pestañas, y
 *           se compensó difuminando el borde por el lado con contenido oculto. Preguntado, Beltrán prefiere el
 *           corte limpio. La barra se sigue recorriendo con la RUEDA y la pestaña activa se sigue arrastrando a
 *           la vista (`seqTabsReveal`, que NO se archiva): lo que desaparece es sólo la máscara de degradado.
 * Restaurar:Volver a pegar la función y sus tres llamadas en `renderSeqBar`/`seqTabsReveal`, y las tres reglas
 *           CSS en index.html (junto a `.transport .seqtabs`).
 * Relacion: R239b (origen) · R242c (retirada) · docs/adr/adr-0007-archivar-no-borrar.md
 */

/* --- app.js ------------------------------------------------------------------------------------------- */
function seqTabsOvf(){ const bar=$('#seqTabs'); if(!bar)return;
  const max=bar.scrollWidth-bar.clientWidth;
  bar.classList.toggle('ovf-l', max>1 && bar.scrollLeft>1);
  bar.classList.toggle('ovf-r', max>1 && bar.scrollLeft<max-1); }

// … y sus tres llamadas:
//   1) última línea de `seqTabsReveal()`:            seqTabsOvf();
//   2) final del manejador de rueda de renderSeqBar: e.preventDefault(); bar.scrollLeft+=d; seqTabsOvf();
//   3) junto al enganche de la rueda:                bar.addEventListener('scroll',seqTabsOvf);

/* --- index.html (CSS, junto a `.transport .seqtabs`) --------------------------------------------------- */
/*
  .transport .seqtabs.ovf-r{-webkit-mask-image:linear-gradient(90deg,#000 calc(100% - 12px),transparent);mask-image:linear-gradient(90deg,#000 calc(100% - 12px),transparent);}
  .transport .seqtabs.ovf-l{-webkit-mask-image:linear-gradient(90deg,transparent,#000 12px);mask-image:linear-gradient(90deg,transparent,#000 12px);}
  .transport .seqtabs.ovf-l.ovf-r{-webkit-mask-image:linear-gradient(90deg,transparent,#000 12px,#000 calc(100% - 12px),transparent);mask-image:linear-gradient(90deg,transparent,#000 12px,#000 calc(100% - 12px),transparent);}
*/
