// Extrae del prototipo las MEDIDAS de una región (alturas, paddings, radios, tamaños de fuente, colores)
// para poder compararlas con lo que mide la app. Uso: node scratchpad/design-extract.mjs <desde> <hasta> [filtro]
import fs from 'fs';
const F = 'scratchpad/redesign/design_handoff_immersive_studio/Editor Domo - Rev 1.dc.html';
const L = fs.readFileSync(F, 'utf8').split(/\r?\n/);
const a = +process.argv[2], b = +process.argv[3], filt = process.argv[4];
const KEYS = /(height|min-height|max-height|width|min-width|padding|margin|gap|border-radius|font-size|font-weight|letter-spacing|background|color|border)\s*:\s*([^;"]+)/g;
for (let i = a; i <= b && i <= L.length; i++) {
  const line = L[i - 1]; if (!line || !line.trim()) continue;
  if (filt && !line.includes(filt)) continue;
  const styles = [...line.matchAll(/style="([^"]*)"/g)].map(m => m[1]);
  if (!styles.length) continue;
  const tag = (line.trim().match(/^<\/?([a-z-]+)/) || [, '?'])[1];
  const txt = (line.replace(/<[^>]*>/g, '').trim().slice(0, 26)) || '';
  const id = (line.match(/(?:title|data-screen-label)="([^"]{0,28})/) || [, ''])[1];
  styles.forEach((s, k) => {
    const props = {};
    let m; KEYS.lastIndex = 0;
    while ((m = KEYS.exec(s))) props[m[1]] = m[2].trim();
    const keep = Object.entries(props).filter(([k2]) => /height|padding|gap|radius|font-size|font-weight|letter-spacing|^width|background|^color/.test(k2));
    if (keep.length) console.log(`${i}${styles.length > 1 ? '.' + k : ''} <${tag}> ${id ? '[' + id + '] ' : ''}${txt ? '“' + txt + '” ' : ''}` + keep.map(([k2, v]) => k2 + ':' + v).join(' · '));
  });
}
