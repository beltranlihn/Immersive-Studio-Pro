// Extrae verbatim el showLanding viejo para archivarlo antes de reemplazarlo por el launcher.
import fs from 'fs';
const L = fs.readFileSync('app.js', 'utf8').split(/\r?\n/);
const a = 2145, b = 2179;
if (!L[a - 1].startsWith('function showLanding()')) { console.error('ANCLA A:', L[a - 1].slice(0, 80)); process.exit(1); }
const head = `/* ============================================================================================================
   ARCHIVED — pantalla de inicio "landing" (showLanding) · reemplazada 2026-07-25 (R152)
   ------------------------------------------------------------------------------------------------------------
   Origen:   app.js · \`showLanding()\` (~L2145-2179). Commit previo: 0da6d43.
   Sacado:   2026-07-25
   Motivo:   El handoff de Claude Design (design_handoff_launcher_splash · "Launcher - Rev 4.dc.html") reemplaza
             esta pantalla por un LAUNCHER completo: tres tipos de proyecto con todos sus parámetros a la vista,
             visores técnicos en vivo (fisheye, domo 3D, planta cenital, sala 3D, tira cosida), tabla de muros y
             una fila de proyectos recientes. El landing viejo eran cuatro botones que abrían los diálogos de
             creación; el launcher expone los parámetros directamente y crea el proyecto sin pasar por ellos.
   Restaurar:pegar la función de abajo en app.js en lugar de \`showLanding\`/\`renderLauncher\` y devolver el CSS
             \`.lgcard\` si hiciera falta. Los diálogos que usaba (domeSetupDialog / flatResDialog /
             roomSetupDialog) siguen vivos: los usa el menú File, así que no hay que restaurar nada más.
   Relacion: handoff launcher+splash, ADR-0007, ADR-0008
   ============================================================================================================ */

`;
fs.writeFileSync('_backup/deprecated/20260725-landing-v1.js', head + L.slice(a - 1, b).join('\n') + '\n', 'utf8');
console.log('archivado, lineas ' + a + '..' + b);
