/* ARCHIVED (deprecated / unused) — Immersive Studio Pro
 * Origen:   app.js · `meters()` + `setMeters(v)`, llamado desde `ploop()` en cada frame de reproduccion   (commit b55e152 "R212 · Etapa 1 de la auditoria: integridad de datos y export")
 * Sacado:   2026-07-30
 * Motivo:   VU-meter fantasma — `meters()` corria en CADA frame de `ploop` (analiser + getByteTimeDomainData + math),
 *           pero escribia en `#mL`/`#mR`, dos elementos del DOM retirados en R148. Trabajo 100% desperdiciado en el
 *           camino mas caliente del reproductor. AUDITORIA-2026-07.md, Etapa 2 (rendimiento), item 5.
 * Restaurar:si el VU-meter vuelve a la UI, reinsertar `#mL`/`#mR` en index.html, restaurar `meters()` abajo y su
 *           llamada `meters();` en `ploop()` (justo antes de `_phLast=state.playhead;`). `setMeters(v)` SIGUE VIVA
 *           en app.js (la usa `pause()` para apagar el meter) — no hace falta restaurarla, ya está.
 * Relacion: AUDITORIA-2026-07.md Etapa 2 #5, ADR-0007
 */
function meters(){ if(!analyser||!state.playing){setMeters(0);return;} const a=new Uint8Array(analyser.fftSize); analyser.getByteTimeDomainData(a); let sum=0; for(let i=0;i<a.length;i++){const v=(a[i]-128)/128;sum+=v*v;} setMeters(Math.min(1,Math.sqrt(sum/a.length)*2.6)); }
