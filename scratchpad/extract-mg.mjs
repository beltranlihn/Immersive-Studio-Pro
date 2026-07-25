// Extrae verbatim el motor de Master Grade + sus call-sites para archivarlo en _backup/deprecated/.
import fs from 'fs';
const L = fs.readFileSync('app.js', 'utf8').split(/\r?\n/);
const at = n => L[n - 1];
const block = (a, b) => L.slice(a - 1, b).join('\n');

const header = `/* ============================================================================================================
   ARCHIVED — Master Grade ENGINE  ·  removed 2026-07-25 (R150)
   ------------------------------------------------------------------------------------------------------------
   Origen:   app.js — shader _MGFS / programa _MG / _MGu / _masterClip / _mgRT / _mgTarget / masterGradeOn() /
             applyMasterGrade(), state.seqGrade, y sus seis call-sites (preview, NDI, Spout, export, save, load).
             Commit previo: 028948b "R148 · Rediseño Rev 1".
   Sacado:   2026-07-25
   Motivo:   Decisión de Beltrán: "Eso nunca lo voy a aplicar, no me interesa. Que salga del code y se vaya a
             deprecated." El rediseño "Rev 1" ya había sacado la UI (ver master-grade-ui.js, 2026-07-25); el motor
             quedaba vivo pero sin forma de editarse ni resetearse — un grado guardado en un .isp viejo se seguía
             aplicando sin nada en pantalla que lo dijera. Beltrán confirmó que no tiene proyectos activos, así que
             no hay compatibilidad que preservar.
   Restaurar:1) pegar el BLOQUE DEL MOTOR de abajo en app.js justo después de applyBlackKey (antes de const _FH).
             2) volver a poner los seis call-sites en sus funciones (cada uno está abajo con su ubicación).
             3) restaurar state.seqGrade en el init de state (L85).
             4) para poder EDITARLO hace falta además la UI: ver _backup/deprecated/master-grade-ui.js.
   Relacion: REDISEÑO-UI.md §4, ADR-0007 (archivar no borrar), ADR-0008 (regla de poda), AUDITORIA-REV1.md
   ============================================================================================================ */

/* ------------------------------------------------------------------------------------------------------------
   1 · ESTADO — dentro del objeto literal \`state\` (app.js ~L85), entre \`seqCov:180,\` y \`groups:[]\`
   ------------------------------------------------------------------------------------------------------------ */
// seqGrade:{exposure:0,contrast:0,saturation:0,temperature:0,tint:0}, // [master grade] per-sequence global grade over the final composite (phase 1: numeric)

/* ------------------------------------------------------------------------------------------------------------
   2 · CALL-SITES (uno por línea, en el orden en que aparecían en app.js)
   ------------------------------------------------------------------------------------------------------------ */
`;

const sites = [
  ['preloadLUTs (~L298) — que el LUT máster también se precargue', 298],
  ['render() (~L945) — grade del composite final, post render-ahead cache', 945],
  ['ndiTick (~L1050) — NDI emite el máster ya graduado', 1050],
  ['spoutTick (~L1087) — Spout idem', 1087],
  ['renderExportFrame (~L4349) — hornear el grade en el frame exportado', 4349],
];

let out = header;
for (const [desc, n] of sites) out += `\n// ${desc}\n${at(n).trim()}\n`;

out += `
// serMedia (~L5040) — fragmento dentro del objeto serializado:
//   grade:(m.kind==='nest'?(m.grade||null):null),

// saveActiveSeq (~L5058) — fragmento:
//   s.grade=state.seqGrade;   // [master grade] per-sequence grade travels with the nest media

// loadSeqIntoState (~L5061) — fragmento:
//   state.seqGrade=Object.assign({exposure:0,contrast:0,saturation:0,temperature:0,tint:0}, s.grade||{}); /* [master grade] restore this sequence's grade (identity default) */

/* ------------------------------------------------------------------------------------------------------------
   3 · BLOQUE DEL MOTOR — iba en app.js entre applyBlackKey() y const _FH
   ------------------------------------------------------------------------------------------------------------ */
`;
out += block(6805, 6836) + '\n';

fs.writeFileSync('_backup/deprecated/20260725-master-grade-engine.js', out, 'utf8');
console.log('escrito, ' + out.split(/\n/).length + ' lineas');
