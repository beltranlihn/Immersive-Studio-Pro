// Extrae verbatim el showLanding viejo y lo reemplaza por un marcador, para escribir el launcher en su lugar.
import fs from 'fs';
const raw = fs.readFileSync('app.js', 'utf8');
const nl = raw.includes('\r\n') ? '\r\n' : '\n';
const L = raw.split(/\r?\n/);
const a = 2153, b = 2187;
if (!L[a - 1].startsWith('function showLanding()')) { console.error('ANCLA A:', L[a - 1].slice(0, 80)); process.exit(1); }
const head = `/* ============================================================================================================
   ARCHIVED — pantalla de inicio "landing" v1 (showLanding) · reemplazada 2026-07-25 (R153)
   ------------------------------------------------------------------------------------------------------------
   Origen:   app.js · \`showLanding()\`. Commit previo: 42241aa.
   Sacado:   2026-07-25
   Motivo:   El handoff de Claude Design ("Launcher - Rev 4.dc.html") reemplaza esta pantalla por un LAUNCHER:
             tres tipos de proyecto con todos sus parámetros a la vista, visores técnicos en vivo, tabla de muros
             y una fila de proyectos recientes. El landing viejo eran cuatro botones que abrían los diálogos de
             creación; el launcher expone los parámetros y crea el proyecto sin pasar por ellos.
   Restaurar:pegar esta función en lugar de \`showLanding\`/\`renderLauncher\` y quitar el CSS \`.lch-*\` de index.html.
             Los diálogos que usaba (domeSetupDialog / flatResDialog / roomSetupDialog) siguen vivos — los usa el
             menú File — así que no hay que restaurar nada más.
   Relacion: handoff launcher+splash, R153, ADR-0007, ADR-0008
   ============================================================================================================ */

`;
fs.writeFileSync('_backup/deprecated/20260725-landing-v1.js', head + L.slice(a - 1, b).join('\n') + '\n', 'utf8');
L.splice(a - 1, b - a + 1, '/*__LAUNCHER_HERE__*/');
fs.writeFileSync('app.js', L.join(nl), 'utf8');
console.log('archivado y marcador puesto en la linea ' + a);
