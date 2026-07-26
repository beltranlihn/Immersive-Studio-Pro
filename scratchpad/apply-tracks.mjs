// R156 · Pistas: fuera el redimensionado individual · el audio también colapsa · Alt+rueda es la única
// forma de cambiar la altura · la timeline no crece más allá de lo que ocupan sus pistas.
import fs from 'fs';
const log = [];
function edit(path, ops) {
  const raw = fs.readFileSync(path, 'utf8');
  const nl = raw.includes('\r\n') ? '\r\n' : '\n';
  let L = raw.split(/\r?\n/);
  for (const [kind, needle, repl, why] of ops) {
    const i = L.findIndex(l => l.includes(needle));
    if (i < 0) { log.push('✗ ' + why); continue; }
    if (kind === 'dropline') L.splice(i, 1);
    else if (kind === 'drop3') L.splice(i, 3);
    else L[i] = L[i].replace(needle, repl);
    log.push('✓ ' + why);
  }
  fs.writeFileSync(path, L.join(nl), 'utf8');
}

edit('app.js', [
  // 1 · fuera el asa de redimensionado por pista (markup + handler de 3 líneas)
  ['repl', '<div class="laneres" data-m="resize" title="${T(\'Drag to resize track\',\'Arrastra para redimensionar la pista\')}"></div>', '', 'markup: fuera el asa de resize'],
  ['drop3', "{ const rz=hd.querySelector('[data-m=resize]');", null, 'handler: fuera el resize por pista (3 líneas)'],
]);
edit('index.html', [
  // 2 · el audio recupera el triángulo de colapso (la regla de R110 se lo quitaba junto con el resize)
  ['repl', '.lanehdr.aud .laneres,.lanehdr.aud .lcol{display:none;} /* [R110] audio tracks: fixed height → no per-lane resize / collapse */',
           '/* [R156] el audio se comporta como el vídeo: SÍ colapsa (triángulo) — la regla de R110 que se lo quitaba\n     junto con el resize ya no aplica, porque el resize por pista no existe para nadie. */',
   'css: el audio recupera el triángulo'],
  ['dropline', '.lanehdr .laneres{position:absolute;', null, 'css: fuera .laneres'],
  ['dropline', '.lanehdr .laneres:hover{', null, 'css: fuera .laneres:hover'],
  // 3 · la barra vertical deja de hacer zoom: sólo scroll (Alt+rueda es la única forma de cambiar la altura)
  ['repl', '<div class="tlvzthumb" id="tlVZoomThumb" title="Drag to scroll · drag the round ends to resize tracks"><span class="tlvzcap t" data-vcap="t"></span><span class="tlvzcap b" data-vcap="b"></span></div>',
           '<div class="tlvzthumb" id="tlVZoomThumb" title="Drag to scroll · Alt+wheel resizes every track"></div>',
   'markup: la barra vertical pierde los casquetes de zoom'],
]);
console.log(log.join('\n'));
