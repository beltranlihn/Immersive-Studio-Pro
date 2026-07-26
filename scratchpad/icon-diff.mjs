// Compara los ICONOS de la maqueta de Claude Design con los que dibuja ICO() en la app.
// La maqueta es la fuente de verdad (REDISEÑO-UI.md ya se equivocó seis veces).
// Salida: por cada icono de la maqueta, su contexto (el texto del botón que lo lleva) y su geometría,
// y al lado el icono de la app que le corresponde, para poder mirarlos en paralelo.
import fs from 'fs';
/* Normalización COMÚN a los dos lados. Sin esto el 65% de los iconos salían como "distintos" por ruido:
   la barra de cierre `/`, los atributos de trazo/relleno que el prototipo pone inline y la app hereda del
   <svg> padre, y el orden de los espacios. Sólo se compara la GEOMETRÍA. */
const norm = at => String(at)
  .replace(/\s(stroke|fill|stroke-width|stroke-linecap|stroke-linejoin|vector-effect|opacity)="[^"]*"/g, '')
  .replace(/\/\s*$/, '').replace(/\s+/g, ' ').trim();
const formasDe = svg => [...String(svg).matchAll(/<(path|circle|rect|line|polyline|polygon|ellipse)\b([^>]*)>/g)]
  .map(h => h[1] + ' ' + norm(h[2]));
const HANDOFF = 'scratchpad/redesign/design_handoff_immersive_studio/Editor Domo - Rev 1.dc.html';
const html = fs.readFileSync(HANDOFF, 'utf8');

// — 1 · sacar cada <svg>…</svg> con el trozo de HTML que lo rodea (para saber a qué botón pertenece)
const svgs = [];
const re = /<svg\b[^>]*>[\s\S]*?<\/svg>/g;
let m;
while ((m = re.exec(html))) {
  const ini = m.index, fin = re.lastIndex;
  const antes = html.slice(Math.max(0, ini - 400), ini);
  const despues = html.slice(fin, fin + 200);
  // etiqueta: el texto visible más cercano (después suele ser el rótulo del botón)
  const txtDespues = despues.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 30);
  const txtAntes = antes.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().split(' ').slice(-4).join(' ');
  // atributos que identifican: title / aria-label / class del contenedor
  const titulo = (antes.match(/title="([^"]{0,60})"[^"]*$/) || [])[1] || '';
  const clase = (antes.match(/class="([^"]{0,80})"[^>]*$/) || [])[1] || '';
  const cuerpo = m[0];
  const geo = formasDe(cuerpo);
  const vb = (cuerpo.match(/viewBox="([^"]*)"/) || [])[1] || '';
  svgs.push({ n: svgs.length, rotulo: txtDespues || txtAntes, titulo, clase, viewBox: vb, formas: geo.length, geo });
}

// — 2 · sacar el catálogo ICO() de la app
// ICO() vive en index.html (no en app.js): es un switch/mapa de nombre → cuerpo del <svg>
const idx = fs.readFileSync('index.html', 'utf8');
const iIco = idx.indexOf('function ICO(');
const bloque = idx.slice(iIco, idx.indexOf('\n}', iIco) + 2);
const appIcons = {};
// el cuerpo de cada icono va entre BACKTICKS y contiene comillas dobles → hay que capturar hasta el backtick
for (const g of bloque.matchAll(/(?:^|[\s,{])([\w-]+)\s*:\s*`([^`]*)`/gm)) {
  const nombre = g[1], cuerpoIco = g[2]; if (!nombre || nombre === 'a') continue;
  const geo = formasDe(cuerpoIco);
  if (geo.length) appIcons[nombre] = geo;
}
const nombres = Object.keys(appIcons);

// — 3 · emparejar por geometría: qué icono de la maqueta tiene un gemelo exacto en la app
const firmaApp = new Map(); for (const [k, v] of Object.entries(appIcons)) firmaApp.set(v.join('|'), k);
const out = { handoff: HANDOFF, iconosEnLaMaqueta: svgs.length, iconosEnLaApp: nombres.length, catalogoApp: appIcons, iconos: svgs };
fs.writeFileSync('scratchpad/icon-diff.json', JSON.stringify(out, null, 2));

// resumen legible: agrupar por geometría idéntica para ver cuántos DISTINTOS hay de verdad
const porFirma = new Map();
for (const s of svgs) { const k = s.geo.join('|'); if (!porFirma.has(k)) porFirma.set(k, []); porFirma.get(k).push(s); }
console.log('iconos en la maqueta:', svgs.length, '· distintos:', porFirma.size, '· catálogo ICO() de la app:', nombres.length);
console.log('\n— iconos DISTINTOS de la maqueta, con dónde aparecen —');
let i = 0;
for (const [k, grupo] of porFirma) {
  const donde = [...new Set(grupo.map(g => g.rotulo || g.titulo || g.clase).filter(Boolean))].slice(0, 4).join(' / ');
  const gemelo = firmaApp.get(k);
  console.log(String(++i).padStart(3) + '. ×' + String(grupo.length).padEnd(3)
    + (gemelo ? ('IGUAL a ICO(' + gemelo + ')').padEnd(30) : 'SIN GEMELO EXACTO'.padEnd(30))
    + (donde || '(sin rótulo)').slice(0, 46).padEnd(48) + k.slice(0, 74));
}
console.log('\ncatálogo ICO():', nombres.join(' '));
