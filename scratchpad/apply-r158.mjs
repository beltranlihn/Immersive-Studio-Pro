// R158 · Fuera "Snap to Grid" (función + botón + atajos) y fuera la lectura AZ/EL de la barra del visor.
// El snap ENTRE OBJETOS (bordes de clip, playhead, marcadores) se queda: es el de Premiere y es el que sirve.
import fs from 'fs';
const log = [];
function edit(path, ops) {
  const raw = fs.readFileSync(path, 'utf8');
  const nl = raw.includes('\r\n') ? '\r\n' : '\n';
  let L = raw.split(/\r?\n/);
  for (const [kind, needle, repl, why] of ops) {
    const i = L.findIndex(l => l.includes(needle));
    if (i < 0) { log.push('✗ ' + why); continue; }
    if (kind === 'dropline') L.splice(i, 1); else L[i] = L[i].replace(needle, repl);
    log.push('✓ ' + why);
  }
  fs.writeFileSync(path, L.join(nl), 'utf8');
}

edit('app.js', [
  // --- el snap a la cuadrícula deja de existir ---
  ['repl', 'selA:null, selB:null, audioCollapsed:false },', 'selA:null, selB:null, audioCollapsed:false },', 'estado (sin cambio: tl.snap ya no se declara)'],
  ['repl', "function snapGrid(){ if(state.tl.tcMode==='bars')return gridStep()*Math.pow(2,-(state.tl.gridDiv||0)); return state.tl.snap?gridSec():0; }",
   "/* [R158] YA NO ES UN SNAP: es sólo el PASO de la cuadrícula, que varios ayudantes usan para cuantizar (flechas\n   sobre keyframes, tamaño de celda de las operaciones de automatización, rango por defecto). El ajuste a la\n   cuadrícula al arrastrar se eliminó — queda el snap entre objetos, como en Premiere. */\nfunction gridStepSec(){ return state.tl.tcMode==='bars'?gridStep()*Math.pow(2,-(state.tl.gridDiv||0)):gridSec(); }",
   'snapGrid → gridStepSec (paso, no snap)'],
  ['repl', "    const st=snapGrid(); if(st>0){ const g=Math.round(val/st)*st; const d=Math.abs(g-val); if(d<bd){bd=d;best=g;} }",
   "    // [R158] acá iba el ajuste a la CUADRÍCULA; se eliminó. Sólo quedan los objetos (bordes, playhead, marcadores).",
   'applySnap: fuera la rama de cuadrícula'],
  ['repl', "function toggleSnap(){ state.tl.snap=!state.tl.snap; const b=$('#snapBtn'); if(b)b.classList.toggle('on',state.tl.snap); flashStatus((state.tl.snap?T('Snap to Grid on','A",
   "function _toggleSnapRETIRADO(){ // [R158] sin uso: el snap a la cuadrícula ya no existe\n  const b=$('#snapBtn'); if(b)b.classList.toggle('on',false); flashStatus((false?T('Snap to Grid on','A",
   'toggleSnap desactivado'],
  ['dropline', "$('#snapBtn').onclick=()=>toggleSnap();", null, 'wiring del botón Snap'],
  ['dropline', "if(mod&&e.key==='4'){e.preventDefault(); toggleSnap(); return;}", null, 'atajo Ctrl+4'],
  ['dropline', "if(e.key==='s'||e.key==='S'){ toggleSnap(); return; }", null, 'atajo S'],
  ['dropline', "ttl('#snapBtn','Snap to Grid · S','Ajustar a la cuadrícula · S');", null, 'i18n del botón Snap'],
  ['repl', "state.tl.snap=!!obj.tl.snap; { const sb=$('#snapBtn'); if(sb)sb.classList.toggle('on',state.tl.snap); } // [R94c] snap to grid + simple-clip view reopen as saved (both de",
   "// [R158] `tl.snap` de un .isp viejo se ignora: el ajuste a la cuadrícula ya no existe // (both de",
   'loadProject: no restaurar tl.snap'],
  ['repl', "[c5,T('Toggle Snap to Grid','Activar/desactivar ajuste a la cuadrícula'),'S',()=>$('#snapBtn').click()],", '', 'paleta: fuera la entrada de Snap'],
  ['repl', "${sw('snapping',state.tl.snap,T('Snap to Grid','Ajustar a la cuadrícula'))}", '', 'Preferences: fuera el interruptor'],
  // --- fuera la lectura AZ/EL ---
  ['dropline', "const azr=document.getElementById('azelReadout');", null, 'updModeUI: fuera AZ/EL'],
  ['dropline', "{ const az=$('#azelReadout'); if(az)az.style.display=(!is3&&F.readout)?'inline-flex':'none'; }", null, 'updViewCtl: fuera AZ/EL'],
]);
edit('index.html', [
  ['dropline', '<div class="vslab" id="azelReadout">', null, 'markup: fuera AZ/EL'],
  ['dropline', '<button class="togbtn2" id="snapBtn"', null, 'markup: fuera el botón Snap'],
]);
console.log(log.join('\n'));
