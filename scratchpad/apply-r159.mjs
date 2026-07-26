// R159 · Inspector: la fila queda con UN botón de keyframe (el diamante), como el prototipo → el fader recupera
// su ancho. La navegación entre keyframes no se pierde: pasa a Alt+, / Alt+. sobre el clip seleccionado.
// Transport: un solo botón de localizador (el diseño tiene "Add locator"); prev/next ya estaban en , y .
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
  // la fila del prototipo (RevDomo:286-290) es etiqueta · surco · caja de valor · UN botón de 20×20
  ['repl',
   `<div class="nav"><button data-k="prev" title="\${T('Previous keyframe','Fotograma anterior')}">\${ICO('kfprev',12)}</button><button data-k="add" title="\${T('Add / remove keyframe here · right-click to clear automation','Añadir / quitar fotograma aquí · clic derecho borra la automatización')}">\${ICO('diamond',12)}</button><button data-k="next" title="\${T('Next keyframe','Fotograma siguiente')}">\${ICO('kfnext',12)}</button></div>`,
   `<div class="nav"><button data-k="add" title="\${T('Add / remove keyframe here · right-click clears the automation · Alt+, / Alt+. jump between keyframes','Añadir / quitar fotograma aquí · clic derecho borra la automatización · Alt+, / Alt+. saltan entre fotogramas')}">\${ICO('diamond',12)}</button></div>`,
   'inspector: la fila queda con UN botón (el diamante)'],
  ['repl', `row.querySelector('[data-k=prev]').onclick=()=>jumpKf(p,-1); row.querySelector('[data-k=next]').onclick=()=>jumpKf(p,1);`,
   `/* [R159] prev/next salieron de la fila (el prototipo tiene un solo botón y esos 40px eran los que le faltaban\n       al fader). El salto entre fotogramas vive ahora en Alt+, / Alt+. — ver jumpAnyKf. */`,
   'inspector: fuera el wiring de prev/next'],
]);
edit('index.html', [
  ['dropline', '<button class="tbtn" id="prevMk"', null, 'transport: fuera "localizador anterior"'],
  ['dropline', '<button class="tbtn" id="nextMk"', null, 'transport: fuera "localizador siguiente"'],
]);
console.log(log.join('\n'));
