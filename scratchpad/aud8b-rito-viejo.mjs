// [AUD 2026-08b] Linea base del PROYECTO REAL: abre la COPIA de RitoDome.isp (y las de Rito360/RitoFlat) con la
// app VIEJA (:9223) y guarda la instantanea de estado (bucles, srcT, composiciones, clips). Sin pixeles: el
// contenido es video y el fotograma decodificado no es determinista entre sesiones; el invariante honesto del
// "mismo fotograma" es srcT. Requiere la app vieja en :9223 (o pasar otro puerto como argv[2] y otro sufijo argv[3]).
import { evalInApp } from './cdp.mjs';
import fs from 'fs';

const DIR = String.raw`C:\Users\beltr\Desktop\Alma Digital Studio\Projects\Immersive Studio Pro\scratchpad`;
const port = +(process.argv[2] || 9223);
const sufijo = process.argv[3] || 'viejo';
const ev = (x, t) => evalInApp(x, { port, timeout: t || 120000 });

const SNAP_FN = fs.readFileSync(DIR + '\\aud8b-fixture-viejo.mjs', 'utf8').match(/const SNAP_FN = `([\s\S]*?)`;/)[1];

for (const [isp, tag] of [['aud8b-rito-copia.isp', 'rito'], ['aud8b-rito360-copia.isp', 'rito360'], ['aud8b-ritoflat-copia.isp', 'ritoflat']]) {
  const ISP = (DIR + '\\' + isp).replace(/\\/g, '\\\\');
  const abre = await ev(`(async function(){ state.dirty=false; await openProjectPath('${ISP}',true);
    const t0=Date.now(); while(Date.now()-t0<20000){ await new Promise(r=>setTimeout(r,300)); if(state.media.filter(m=>!isSeqMedia(m)).every(m=>!m._loading))break; }
    return { alerta:(document.querySelector('#alertOv')||{textContent:null}).textContent,
             clips: state.clips.length, media: state.media.length,
             ausentes: state.media.filter(m=>m.missing&&!isSeqMedia(m)).map(m=>m.name) }; })()`, 60000);
  console.log(tag, 'abierto:', JSON.stringify(abre));
  if (abre.alerta) { console.error('*** alerta al abrir ' + tag + ': ' + abre.alerta + ' ***'); continue; }
  await new Promise(r => setTimeout(r, 800));
  await ev(SNAP_FN);
  const snap = await ev(`__snap()`, 180000);
  fs.writeFileSync(DIR + '\\aud8b-' + tag + '-estado-' + sufijo + '.json', JSON.stringify({ fecha: new Date().toISOString(), puerto: port, snap }, null, 1));
  const nLoop = Object.keys(snap.srcT).length;
  const nComp = Object.keys(snap.comps).length;
  console.log('   secuencias:', snap.seqs.length, '· clips con bucle:', nLoop, '· composiciones:', nComp);
}
console.log('listo.');
