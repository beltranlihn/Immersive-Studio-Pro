/* ARCHIVED (deprecated / unused) — Immersive Studio Pro
 * Origen:   app.js · `animBadge` (constante local de renderTimeline, interpolada en `cd.innerHTML`) · clase CSS `.animbadge`
 *           (la clase nunca tuvo regla en index.html: todo el estilo iba inline en el template)
 * Sacado:   2026-07-30
 * Motivo:   [R224 · ítem 8 de la Etapa 2 de la tanda de Beltrán] «Sin icono de motion sobre el clip»: la información
 *           de qué movimientos lleva un clip vive en el inspector (sección Motion), y desde [R224] también en el
 *           chooser de automatización de la cabecera de pista (cada Motion aplicado es una entrada del desplegable
 *           izquierdo). La chapa ↻ competía por la esquina superior derecha del clip con la chapa de mute y con los
 *           keyframes de la curva en modo automatización.
 * Restaurar:volver a declarar la constante junto a `mutedBadge` en `renderTimeline` (bloque de construcción del clip,
 *           ~L2490) y reinsertar `${animBadge}` en el template de `cd.innerHTML`, justo antes de `${mutedBadge}`.
 *           `hasLiveAnim(c)` NO se archivó (la sigue usando `anyAnim()` para el reloj de vista previa).
 * Relacion: R224, docs/NEXT.md (Etapa 2 · Automatización), docs/adr/adr-0007-archivar-no-borrar.md
 */

const animBadge=hasLiveAnim(c)?`<div class="animbadge" title="${T('Live motion','Movimiento activo')}" style="position:absolute;top:3px;right:5px;width:15px;height:15px;border-radius:50%;background:var(--ink-2);color:#0b0d10;font-size:11px;line-height:15px;text-align:center;pointer-events:none;font-weight:700;z-index:3;">↻</div>`:'';

/* …y su uso en el template del clip:
   cd.innerHTML=`… ${px2}${animBadge}${mutedBadge}<div class="hd l"></div>…`;
*/
