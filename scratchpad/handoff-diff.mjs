// Qué cambia ENTRE los tres handoffs (Domo · 2D Flat · 360). Es la pregunta de la Etapa 7: no auditar tres
// maquetas casi idénticas de arriba abajo, sino aislar lo que varía por formato y comprobar que la app lo hace.
import fs from 'fs';
const DIR = 'scratchpad/redesign/design_handoff_immersive_studio/';
const FICH = { domo: 'Editor Domo - Rev 1.dc.html', flat: 'Editor 2D Flat - Rev 1.dc.html', sala: 'Editor 360 - Rev 1.dc.html' };

// Texto VISIBLE: fuera etiquetas, fuera plantillas {{ }}, fuera <style>/<script>.
function visibles(html) {
  const limpio = html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/g, ' ');
  const out = [];
  for (const m of limpio.matchAll(/>([^<>]{1,60})</g)) {
    const t = m[1].replace(/\{\{[^}]*\}\}/g, '').replace(/\s+/g, ' ').trim();
    if (t && !/^[|·—–\-–:,.]+$/.test(t)) out.push(t);
  }
  return out;
}
const set = a => new Set(a);
const D = {}, S = {};
for (const [k, f] of Object.entries(FICH)) { const h = fs.readFileSync(DIR + f, 'utf8'); D[k] = visibles(h); S[k] = set(D[k]); }

const todos = [...new Set([...D.domo, ...D.flat, ...D.sala])].sort();
const filas = todos.map(t => ({ t, domo: S.domo.has(t), flat: S.flat.has(t), sala: S.sala.has(t) }))
  .filter(r => !(r.domo && r.flat && r.sala));   // lo común a los tres no dice nada

const marca = r => (r.domo ? 'D' : '·') + (r.flat ? 'F' : '·') + (r.sala ? 'S' : '·');
console.log('textos que NO aparecen en los tres (D=Domo · F=2D Flat · S=Sala 360)\n');
for (const r of filas) console.log('  ' + marca(r) + '  ' + r.t);
console.log('\ntotal de textos distintos: ' + todos.length + ' · varían por formato: ' + filas.length);
fs.writeFileSync('scratchpad/handoff-diff.json', JSON.stringify({ filas, conteos: { domo: D.domo.length, flat: D.flat.length, sala: D.sala.length } }, null, 2));
