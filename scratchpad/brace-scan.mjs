// Localiza el desbalance de llaves en app.js (ignora strings y comentarios de forma tosca pero suficiente).
import fs from 'fs';
const src = fs.readFileSync('app.js', 'utf8').split(/\r?\n/);
let depth = 0, inBlock = false;
const marks = [];
const BS = String.fromCharCode(92), SQ = "'", DQ = '"', BT = '`';
for (let i = 0; i < src.length; i++) {
  const l = src[i]; let out = '', j = 0;
  while (j < l.length) {
    if (inBlock) { const e = l.indexOf('*/', j); if (e < 0) { j = l.length; } else { inBlock = false; j = e + 2; } continue; }
    const ch = l[j];
    if (ch === '/' && l[j + 1] === '/') break;
    if (ch === '/' && l[j + 1] === '*') { inBlock = true; j += 2; continue; }
    if (ch === SQ || ch === DQ || ch === BT) {
      const q = ch; j++;
      while (j < l.length) { if (l[j] === BS) { j += 2; continue; } if (l[j] === q) { j++; break; } j++; }
      continue;
    }
    out += ch; j++;
  }
  for (const ch of out) { if (ch === '{') depth++; else if (ch === '}') depth--; }
  marks.push(depth);
}
console.log('profundidad final (0 = balanceado):', depth);
const probe = [2961, 2999, 3068, 3081, 3082, 5838, 5852, 6529, 6560, 6570];
for (const ln of probe) if (marks[ln - 1] !== undefined) console.log('  linea', ln, '-> depth', marks[ln - 1]);
// primer punto donde la profundidad se queda "colgada" al final de una función de nivel 0
let last0 = 0;
for (let i = 0; i < marks.length; i++) if (marks[i] === 0) last0 = i + 1;
console.log('ultima linea con depth 0:', last0, '→', (src[last0 - 1] || '').trim().slice(0, 120));
