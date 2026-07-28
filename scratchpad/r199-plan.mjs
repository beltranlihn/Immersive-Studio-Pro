// [R199] Prueba de `roomPlan` en aislado: se extrae del app.js y se comprueba que la huella respeta las medidas
// de CADA muro y que salen las formas pedidas (4 = cuadrilátero cerrado · 3 = U · 2 contiguos = L).
import { readFileSync } from 'fs';
const src = readFileSync('C:\\Users\\beltr\\Desktop\\Alma Digital Studio\\Projects\\Immersive Studio Pro\\app.js', 'utf8');
const i = src.indexOf('function roomPlan(walls){');
const j = src.indexOf('/* Two synced schematics', i);
if (i < 0 || j < 0) { console.log('no encuentro roomPlan'); process.exit(1); }
const ROOM_ROLES = ['Front', 'Right', 'Back', 'Left'];
const roomPlan = eval('(' + src.slice(i, j).trim().replace(/^function roomPlan/, 'function') + ')');

const W = (role, wcm, hcm = 300) => ({ role, wcm, hcm, pxW: 1920, pxH: 1080 });
const len = s => Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) * 100; // cm
const ang = (p, q, r) => { // ángulo interior en q, en grados
  const a = [p[0] - q[0], p[1] - q[1]], b = [r[0] - q[0], r[1] - q[1]];
  const c = (a[0] * b[0] + a[1] * b[1]) / (Math.hypot(...a) * Math.hypot(...b));
  return Math.acos(Math.max(-1, Math.min(1, c))) * 180 / Math.PI;
};
const rep = (nombre, walls) => {
  const p = roomPlan(walls);
  const medidas = p.seg.map(s => `${s.role} ${len(s).toFixed(1)}cm (pedido ${walls.find(w => w.role === s.role).wcm})`);
  const ok = p.seg.every(s => Math.abs(len(s) - walls.find(w => w.role === s.role).wcm) < 0.6);
  const [FL, FR, BR, BL] = p.poly;
  const esquinas = p.poly.length === 4
    ? [ang(BL, FL, FR), ang(FL, FR, BR), ang(FR, BR, BL), ang(BR, BL, FL)].map(a => a.toFixed(1) + '°').join(' · ')
    : '—';
  console.log(`\n${nombre}`);
  console.log('   muros    :', p.seg.map(s => s.role).join(' → ') || '(ninguno)');
  console.log('   medidas  :', medidas.join(' | '));
  console.log('   respeta  :', ok ? 'SÍ' : '*** NO ***');
  console.log('   cerrado  :', p.closed, '· esquinas:', esquinas);
  return { ok, p };
};

console.log('=== 4 muros ===');
rep('cuadrado 800×800', [W('Front', 800), W('Right', 800), W('Back', 800), W('Left', 800)]);
rep('rectángulo 800 frente/fondo · 500 lados', [W('Front', 800), W('Right', 500), W('Back', 800), W('Left', 500)]);
rep('trapecio simétrico (frente 800 · fondo 600 · lados 500)', [W('Front', 800), W('Right', 500), W('Back', 600), W('Left', 500)]);
rep('LADOS DISTINTOS (frente/fondo 800 · izq 400 · der 600)', [W('Front', 800), W('Right', 600), W('Back', 800), W('Left', 400)]);
rep('todo distinto (700/900/450/650)', [W('Front', 700), W('Right', 650), W('Back', 900), W('Left', 450)]);
rep('imposible (fondo 5000 con frente 800 y lados 500)', [W('Front', 800), W('Right', 500), W('Back', 5000), W('Left', 500)]);

console.log('\n=== 3 muros · debe salir U en CUALQUIER orientación ===');
rep('Left+Front+Right (el del diálogo)', [W('Left', 500), W('Front', 800), W('Right', 500)]);
rep('Front+Right+Back (el del launcher)', [W('Front', 800), W('Right', 500), W('Back', 800)]);
rep('Right+Back+Left', [W('Right', 500), W('Back', 800), W('Left', 500)]);
rep('Back+Left+Front', [W('Back', 800), W('Left', 500), W('Front', 800)]);

console.log('\n=== 2 muros ===');
rep('Front+Left (contiguos · el del diálogo)', [W('Front', 800), W('Left', 500)]);
rep('Front+Right (contiguos · el del launcher)', [W('Front', 800), W('Right', 500)]);
rep('Right+Back (contiguos)', [W('Right', 500), W('Back', 800)]);
rep('Front+Back (ENFRENTADOS · pasillo)', [W('Front', 800), W('Back', 800)]);
rep('Left+Right (ENFRENTADOS · pasillo)', [W('Left', 500), W('Right', 500)]);

console.log('\n=== compatibilidad: ¿los casos que ya funcionaban dan lo MISMO? ===');
const viejo = (walls) => { // la implementación anterior, tal cual
  const by = {}; for (const w of walls) by[w.role] = w;
  const has = r => !!by[r], Wm = r => by[r] ? Math.max(0.02, by[r].wcm / 100) : 0; const seg = [];
  if (has('Front') && has('Right') && has('Back') && has('Left')) {
    const wF = Wm('Front'), wB = Wm('Back'), wL = Wm('Left'), wR = Wm('Right');
    const off = (wF - wB) / 2, avg = (wL + wR) / 2, D = Math.sqrt(Math.max(0.04, avg * avg - off * off));
    return { poly: [[-wF / 2, 0], [wF / 2, 0], [wB / 2, D], [-wB / 2, D]] };
  }
  if (has('Front') && has('Left') && has('Right')) { const wF = Wm('Front'), wL = Wm('Left'), wR = Wm('Right'); return { poly: [[-wF / 2, 0], [wF / 2, 0], [wF / 2, wR], [-wF / 2, wL]] }; }
  return null;
};
for (const [n, ws] of [
  ['cuadrado', [W('Front', 800), W('Right', 800), W('Back', 800), W('Left', 800)]],
  ['rectángulo', [W('Front', 800), W('Right', 500), W('Back', 800), W('Left', 500)]],
  ['trapecio simétrico', [W('Front', 800), W('Right', 500), W('Back', 600), W('Left', 500)]],
  ['U Left+Front+Right', [W('Left', 500), W('Front', 800), W('Right', 500)]],
]) {
  const a = roomPlan(ws).poly, b = viejo(ws).poly;
  const d = Math.max(...a.map((p, k) => Math.hypot(p[0] - b[k][0], p[1] - b[k][1])));
  console.log(`   ${n}: desvío máximo ${(d * 1000).toFixed(3)} mm  → ${d < 1e-4 ? 'IDÉNTICO' : '*** CAMBIA ***'}`);
}
