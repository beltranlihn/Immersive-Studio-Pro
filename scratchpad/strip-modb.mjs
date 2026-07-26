// Quita el botón de modulación (.modb) y su arco (.modarc) de la fila del inspector, y su CSS.
// Trabaja por LÍNEAS y preserva el fin de línea de cada archivo (app.js es CRLF, index.html es LF).
import fs from 'fs';
const log = [];
function edit(path, ops) {
  const raw = fs.readFileSync(path, 'utf8');
  const nl = raw.includes('\r\n') ? '\r\n' : '\n';
  let L = raw.split(/\r?\n/);
  for (const [kind, needle, repl, why] of ops) {
    if (kind === 'dropline') {
      const i = L.findIndex(l => l.includes(needle));
      if (i < 0) { log.push('✗ ' + why); continue; }
      L.splice(i, 1); log.push('✓ ' + why);
    } else if (kind === 'drop2') {           // borra la línea que contiene `needle` y la siguiente
      const i = L.findIndex(l => l.includes(needle));
      if (i < 0) { log.push('✗ ' + why); continue; }
      L.splice(i, 2); log.push('✓ ' + why);
    } else {                                  // reemplazo dentro de la línea
      const i = L.findIndex(l => l.includes(needle));
      if (i < 0) { log.push('✗ ' + why); continue; }
      L[i] = L[i].replace(needle, repl); log.push('✓ ' + why);
    }
  }
  fs.writeFileSync(path, L.join(nl), 'utf8');
}

edit('app.js', [
  ['repl', '<div class="track"><i style="width:0%"></i></div><div class="modarc"></div><div class="box">',
           '<div class="track"><i style="width:0%"></i></div><div class="box">', 'app: quitar .modarc del markup'],
  ['dropline', '<button class="modb" data-p=', null, 'app: quitar el botón .modb del markup'],
  ['dropline', "row.querySelector('.modb').onclick=", null, 'app: quitar el wiring del .modb'],
  ['drop2', "if(md){ const arc=row.querySelector('.modarc');", null, 'app: quitar el pintado del arco (2 líneas)'],
]);
edit('index.html', [
  ['dropline', '.prow .modb{width:20px;', null, 'css: .prow .modb'],
  ['dropline', '.prow .modb:hover{', null, 'css: .prow .modb:hover'],
  ['dropline', '.prow.modon .modb{', null, 'css: .prow.modon .modb'],
  ['dropline', '.prow .modarc{position:absolute;', null, 'css: .prow .modarc'],
  ['dropline', '.prow.modon .modarc{', null, 'css: .prow.modon .modarc'],
]);
console.log(log.join('\n'));
