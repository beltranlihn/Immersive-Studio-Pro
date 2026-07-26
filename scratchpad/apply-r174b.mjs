// R174b · limpiar los restos de Safe y retirar DIST / DOLLY de la lógica.
import fs from 'fs';
const log = [];
let a = fs.readFileSync('app.js', 'utf8');
const r = (x, y, w) => { if (!a.includes(x)) { log.push('NO  ' + w); return; } a = a.replace(x, y); log.push('OK  ' + w); };

// estado: showSafe / prefs.safe ya no los toca nadie
r(`showGrid:true, showSafe:false, showOutline:true,`, `showGrid:true, showOutline:true,`, 'estado: fuera showSafe');
r(`prefs:{ reducedMotion:false, snapping:true, grid:true, safe:false,`, `prefs:{ reducedMotion:false, snapping:true, grid:true,`, 'prefs: fuera safe');
// espejo del panel "More"
r(`[['grid',T('Grid','Cuadrícula')],['safe',T('Safe','Zona segura')],['outline'`, `[['grid',T('Grid','Cuadrícula')],['outline'`, 'More: fuera la fila Safe');
// estado visual del botón
r(`d==='grid'?state.view.showGrid:d==='safe'?state.view.showSafe:d==='outline'`, `d==='grid'?state.view.showGrid:d==='outline'`, 'estado del botón: fuera safe');
// interruptor de Preferences
r(`    if(k==='safe'){state.view.showSafe=b.classList.contains('on');$('#dispSeg button[data-d=safe]').classList.toggle('on',state.view.showSafe);render();} });`, `  });`, 'Preferences: fuera el interruptor');
// tooltip traducido
r(` ttl('#dispSeg button[data-d="safe"]','Safe-zone overlay','Zona segura');`, '', 'applyLang: fuera el tooltip');

// DIST y DOLLY: fuera de la lógica de la barra (el marcado ya quedó oculto en R174)
r(`  show('#distCtl', is3&&!spec&&F.readout);`, `  show('#distCtl', false); // [R174] DIST retirado a petición de Beltrán: en 3D sólo queda FOV, y sólo en Viewer`, 'barra: DIST siempre oculto');
r(`  show('#dollyCtl', is3&&spec);`, `  show('#dollyCtl', false); // [R174] DOLLY retirado: el handoff sólo tiene FOV`, 'barra: DOLLY siempre oculto');

fs.writeFileSync('app.js', a);
console.log(log.join('\n'));
