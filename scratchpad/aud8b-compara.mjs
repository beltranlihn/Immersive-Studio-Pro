// [AUD 2026-08b] LA COMPARACION CENTRAL: abre con el BUILD NUEVO (el .exe desplegado, :9222) los mismos archivos
// que la app vieja abrio y snapshoteo (aud8b-fixture-viejo/arreglo + aud8b-rito-viejo), toma la MISMA instantanea
// y lista todas las diferencias campo a campo, srcT a srcT y pixel a pixel.
// Requiere: el .exe desplegado corriendo con --remote-debugging-port=9222 y las lineas base *.json ya escritas.
import { evalInApp } from './cdp.mjs';
import fs from 'fs';

const DIR = String.raw`C:\Users\beltr\Desktop\Alma Digital Studio\Projects\Immersive Studio Pro\scratchpad`;
const ev = (x, t) => evalInApp(x, { port: 9222, timeout: t || 120000 });
const SNAP_FN = fs.readFileSync(DIR + '\\aud8b-fixture-viejo.mjs', 'utf8').match(/const SNAP_FN = `([\s\S]*?)`;/)[1];

// ---- es el build nuevo y la RTX ----
const ver = await ev(`({nuevo: typeof setLoopRange==='function' && typeof openSourceMonitor==='function' && typeof weaveLayout==='function', gpu:(function(){try{const e=gl.getExtension('WEBGL_debug_renderer_info');return gl.getParameter(e.UNMASKED_RENDERER_WEBGL);}catch(x){return '?';}})()})`);
console.log('build nuevo:', ver.nuevo, '· GPU:', ver.gpu);
if (!ver.nuevo || !/RTX 4060/.test(ver.gpu)) { console.error('*** o no es el build nuevo o no es la RTX — abortando ***'); process.exit(1); }

// ---- diff profundo con rutas ----
function diff(a, b, ruta, out) {
  if (a === b) return;
  if (typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 1e-6) return;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ks = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of ks) diff(a[k], b[k], ruta + '.' + k, out);
    return;
  }
  out.push(ruta + ': viejo=' + JSON.stringify(a) + ' nuevo=' + JSON.stringify(b));
}

const abre = async (isp) => {
  const ISP = (DIR + '\\' + isp).replace(/\\/g, '\\\\');
  const r = await ev(`(async function(){ state.dirty=false; await openProjectPath('${ISP}',true);
    const t0=Date.now(); while(Date.now()-t0<20000){ await new Promise(r=>setTimeout(r,300)); if(state.media.filter(m=>!isSeqMedia(m)).every(m=>!m._loading))break; }
    return { alerta:(document.querySelector('#alertOv')||{textContent:null}).textContent,
             ausentes: state.media.filter(m=>m.missing&&!isSeqMedia(m)).map(m=>m.name) }; })()`, 60000);
  if (r.alerta) { console.error('*** alerta al abrir ' + isp + ': ' + r.alerta); process.exit(1); }
  await new Promise(rr => setTimeout(rr, 800));
  await ev(SNAP_FN);
  return r;
};

let TOTAL = 0;
const compara = (nombre, viejo, nuevo) => {
  const out = [];
  diff(viejo, nuevo, nombre, out);
  if (!out.length) console.log('   ' + nombre + ': IDENTICO');
  else { TOTAL += out.length; console.log('   ' + nombre + ': *** ' + out.length + ' diferencias ***'); out.slice(0, 60).forEach(d => console.log('      ' + d)); }
};

// ============ 1 · el fixture construido con la app vieja ============
console.log('\n=== FIXTURE aud8b-viejo.isp (construido y snapshoteado con a33c70b) ===');
const base = JSON.parse(fs.readFileSync(DIR + '\\aud8b-viejo-estado.json', 'utf8'));
const ra = await abre('aud8b-viejo.isp');
console.log('ausentes:', JSON.stringify(ra.ausentes));
// rebote de secuencia (mismo asiento del arnés que en la línea base) y pixeles con calentamiento
await ev(`(async function(){ const f=state.media.find(m=>m.name==='Flat2D'); openSeq(f.id); await new Promise(r=>setTimeout(r,250)); const mn=state.media.find(m=>m.name==='Sequence 1'); openSeq(mn.id); await new Promise(r=>setTimeout(r,250)); render(); return 1; })()`, 60000);
const shot = async (t) => { await ev(`__pix([${t}])`, 120000); const a = await ev(`__pix([${t}])`, 120000); const b = await ev(`__pix([${t}])`, 120000);
  const k = 't' + t; if (a[k].hash !== b[k].hash) console.log('   *** INESTABLE t=' + t + ' ***'); return a; };
const pixN = {};
for (const t of [101.3, 103.7, 116.1, 117.6]) Object.assign(pixN, await shot(t));
const pixFlatN = {};
await ev(`(async function(){ const f=state.media.find(m=>m.name==='Flat2D'); openSeq(f.id); await new Promise(r=>setTimeout(r,300)); return 1; })()`, 60000);
for (const t of [1.0, 3.4]) Object.assign(pixFlatN, await shot(t));
await ev(`(async function(){ const mn=state.media.find(m=>m.name==='Sequence 1'); openSeq(mn.id); await new Promise(r=>setTimeout(r,200)); return 1; })()`, 60000);
const snapN = await ev(`__snap()`, 180000);

compara('estado', base.snap, snapN);
compara('pixeles-domo', base.pix, pixN);
compara('pixeles-2D', base.pixFlat, pixFlatN);
fs.writeFileSync(DIR + '\\aud8b-viejo-estado-nuevo.json', JSON.stringify({ fecha: new Date().toISOString(), snap: snapN, pix: pixN, pixFlat: pixFlatN }, null, 1));

// ============ 2 · los proyectos reales de Beltran (copias) ============
for (const [isp, tag] of [['aud8b-rito-copia.isp', 'rito'], ['aud8b-rito360-copia.isp', 'rito360'], ['aud8b-ritoflat-copia.isp', 'ritoflat']]) {
  console.log('\n=== ' + isp + ' ===');
  const b = JSON.parse(fs.readFileSync(DIR + '\\aud8b-' + tag + '-estado-viejo.json', 'utf8'));
  const rr = await abre(isp);
  console.log('ausentes:', JSON.stringify(rr.ausentes));
  const sN = await ev(`__snap()`, 180000);
  compara('estado', b.snap, sN);
  fs.writeFileSync(DIR + '\\aud8b-' + tag + '-estado-nuevo.json', JSON.stringify({ fecha: new Date().toISOString(), snap: sN }, null, 1));
}

console.log('\n=== RESULTADO: ' + (TOTAL ? ('*** ' + TOTAL + ' diferencias en total ***') : 'TODO IDENTICO viejo→nuevo') + ' ===');
