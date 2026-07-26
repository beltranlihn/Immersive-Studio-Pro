// R164 · Iconos calcados del handoff. Sólo geometría; ni tamaños ni sitios cambian.
import fs from 'fs';
let s = fs.readFileSync('index.html', 'utf8');
const log = [];
const r = (a, b, why) => { if (!s.includes(a)) { log.push('NO  ' + why); return; } s = s.replace(a, b); log.push('OK  ' + why); };

// los puntos del asa: la maqueta los hace de r=1.4, no 1.1
const gripViejo = s.match(/^\s*grip:`.*`,$/m);
if (gripViejo) {
  const nuevo = gripViejo[0].replace(/r="1\.1"/g, 'r="1.4"')
    .replace('grip:`', 'grip:/* [R164] puntos de r=1.4 como la maqueta; 1.1 se veía anémico */`');
  s = s.replace(gripViejo[0], nuevo); log.push('OK  asa de puntos: r 1.1 → 1.4');
} else log.push('NO  asa de puntos');

r('layers:`<path d="M12 3l8 4.5-8 4.5-8-4.5z"/><path d="M4 12l8 4.5 8-4.5"/><path d="M4 16l8 4.5 8-4.5"/>`,',
  'layers:`<path d="M12 3l8 4.5-8 4.5-8-4.5z"/><path d="M4 12l8 4.5 8-4.5"/>`, /* [R164] la maqueta apila DOS hojas, no tres */',
  'Adjust: dos hojas, no tres');

r('    tallpanel:`<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M14 3v18"/>`,',
  '    /* [R164] El botón de OCULTAR el inspector usa la misma caja que panel/panelL con la divisoria en 14\n'
  + '       (el ICO panel la tiene en 15: ése es el de MOSTRAR). La caja 3,3,18,18 no aparece en el handoff. */\n'
  + '    tallpanel:`<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M14 4v16"/>`,',
  'ocultar inspector: caja y divisoria de la maqueta');

fs.writeFileSync('index.html', s);
console.log(log.join('\n'));
