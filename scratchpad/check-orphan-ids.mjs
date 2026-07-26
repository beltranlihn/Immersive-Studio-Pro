// Revisión estática: cada `$('#x')` / `getElementById('x')` de app.js debe existir en index.html
// o crearse en runtime (innerHTML/createElement con ese id). Lo que no aparezca en ninguno de los dos
// es una referencia huérfana → `null.algo` en cuanto se ejecute esa rama.
import fs from 'fs';
const app = fs.readFileSync('app.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

const refs = new Set();
for (const m of app.matchAll(/\$\(\s*['"]#([A-Za-z][\w-]*)['"]\s*\)/g)) refs.add(m[1]);
for (const m of app.matchAll(/getElementById\(\s*['"]([A-Za-z][\w-]*)['"]\s*\)/g)) refs.add(m[1]);

const staticIds = new Set([...html.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)].map(m => m[1]));
// ids que app.js fabrica en runtime (markup en plantillas o createElement)
const madeIds = new Set([...app.matchAll(/\bid\s*=\s*(?:["']|\\?["'])([A-Za-z][\w-]*)/g)].map(m => m[1]));
for (const m of app.matchAll(/\.id\s*=\s*['"`]([A-Za-z][\w-]*)['"`]/g)) madeIds.add(m[1]);

const huerfanos = [...refs].filter(id => !staticIds.has(id) && !madeIds.has(id)).sort();
const conGuarda = [];
const sinGuarda = [];
for (const id of huerfanos) {
  // ¿la referencia está protegida (`if(el)`, `?.`, `el&&`)? Se mira la línea entera.
  const lineas = app.split(/\r?\n/).filter(l => l.includes(`'#${id}'`) || l.includes(`"${id}"`) || l.includes(`'${id}'`));
  const guardada = lineas.every(l => /if\s*\(\s*\w+\s*\)|&&|\?\./.test(l));
  (guardada ? conGuarda : sinGuarda).push({ id, muestra: (lineas[0] || '').trim().slice(0, 110) });
}
console.log(JSON.stringify({ referenciados: refs.size, huerfanosSinGuarda: sinGuarda, huerfanosConGuarda: conGuarda.map(x => x.id) }, null, 2));
