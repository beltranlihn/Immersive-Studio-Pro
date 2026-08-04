// [AUD 2026-08b] Confirmacion en PIXELES del cambio de envoltura fx/fy: abre el fixture y fotografia el composite
// en dos instantes donde el barrido numerico (aud8b-fxwrap.mjs) dice que el clip c_fx sale del disco.
// Se ejecuta DOS veces: contra la app vieja (node ... 9223) y contra el .exe nuevo (node ... 9222); comparar hashes.
import { evalInApp } from './cdp.mjs';
import fs from 'fs';
const DIR = String.raw`C:\Users\beltr\Desktop\Alma Digital Studio\Projects\Immersive Studio Pro\scratchpad`;
const ISP = (DIR + '\\aud8b-viejo.isp').replace(/\\/g, '\\\\');
const port = +(process.argv[2] || 9222);
const ev = (x, t) => evalInApp(x, { port, timeout: t || 120000 });
const SNAP_FN = fs.readFileSync(DIR + '\\aud8b-fixture-viejo.mjs', 'utf8').match(/const SNAP_FN = `([\s\S]*?)`;/)[1];

await ev(`(async function(){ state.dirty=false; try{clearLiveAutosaves();}catch(e){} if(typeof closeSourceMonitor==='function'&&_srcMon)closeSourceMonitor();
  await openProjectPath('${ISP}',true);
  { const o=document.querySelector('#confirmOv'); if(o){ const b=[...o.querySelectorAll('button')].find(x=>/Open the file/.test(x.textContent)); if(b)b.click(); } }
  const t0=Date.now(); while(Date.now()-t0<20000){ await new Promise(r=>setTimeout(r,250)); if(state.media.filter(m=>!isSeqMedia(m)).every(m=>!m._loading&&!m.missing))break; }
  const t1=Date.now(); while(document.querySelector('#loadingOv')&&Date.now()-t1<20000) await new Promise(r=>setTimeout(r,200));
  return 1; })()`, 60000);
await ev(SNAP_FN);
// rebote (asiento del arnés, ver aud8b-fixture-arreglo)
await ev(`(async function(){ const f=state.media.find(m=>m.name==='Flat2D'); openSeq(f.id); await new Promise(r=>setTimeout(r,250)); const mn=state.media.find(m=>m.name==='Sequence 1'); openSeq(mn.id); await new Promise(r=>setTimeout(r,250)); render(); return 1; })()`, 60000);
const out = {};
for (const t of [119.3, 120.4]) {
  await ev(`__pix([${t}])`); const a = await ev(`__pix([${t}])`); const b = await ev(`__pix([${t}])`);
  const k = 't' + t; if (a[k].hash !== b[k].hash) console.log('*** INESTABLE t=' + t + ' ***');
  out[k] = a[k];
}
console.log('puerto ' + port + ':', JSON.stringify(out));
fs.writeFileSync(DIR + '\\aud8b-fxwrap-pix-' + port + '.json', JSON.stringify(out, null, 1));
