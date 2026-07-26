// Lista, EN ORDEN, los controles del prototipo de una región: qué es, qué dice y qué tooltip tiene.
// Uso: node scratchpad/design-controls.mjs <desde> <hasta>
import fs from 'fs';
const F = 'scratchpad/redesign/design_handoff_immersive_studio/Editor Domo - Rev 1.dc.html';
const L = fs.readFileSync(F, 'utf8').split(/\r?\n/);
const a = +process.argv[2], b = +process.argv[3];
const clean = s => s.replace(/<svg[\s\S]*?<\/svg>/g, '⬚').replace(/<[^>]*>/g, '').replace(/\{\{[^}]*\}\}/g, '·').replace(/\s+/g, ' ').trim();
for (let i = a; i <= b && i <= L.length; i++) {
  const line = L[i - 1]; if (!line || !line.trim()) continue;
  const t = line.trim();
  // controles
  const m = t.match(/^<(button|input|select|a)\b/);
  const isIf = /^<sc-if/.test(t), isFor = /^<sc-for/.test(t);
  const title = (t.match(/title="([^"]*)"/) || [, ''])[1];
  const txt = clean(t);
  if (m) { console.log(`${String(i).padStart(3)} ${m[1].toUpperCase().padEnd(6)} “${txt.slice(0, 34)}”${title ? '  [' + title.slice(0, 40) + ']' : ''}`); }
  else if (isIf) { const v = (t.match(/value="\{\{\s*([^}\s]+)/) || [, '?'])[1]; console.log(`${String(i).padStart(3)} ┌ SI ${v}`); }
  else if (isFor) { const v = (t.match(/list="\{\{\s*([^}\s]+)/) || [, '?'])[1]; console.log(`${String(i).padStart(3)} ┌ POR CADA ${v}`); }
  else if (/^<div[^>]*display:inline-flex[^>]*height:22px/.test(t)) { console.log(`${String(i).padStart(3)} ▭ WELL 22px${title ? '  [' + title.slice(0, 40) + ']' : ''}`); }
  else if (/^<div[^>]*width:\.5px;height:16px/.test(t)) { console.log(`${String(i).padStart(3)} │ separador`); }
  else if (/^<div[^>]*flex:1/.test(t) && t.length < 90) { console.log(`${String(i).padStart(3)} ⟷ espaciador`); }
  else if (/^<span/.test(t) && txt && txt.length < 30 && /font-size/.test(t)) { console.log(`${String(i).padStart(3)} SPAN   “${txt.slice(0, 34)}”`); }
}
