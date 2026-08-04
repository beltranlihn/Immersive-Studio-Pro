// [AUD 2026-08b] Arreglo puntual del fixture: al construirlo, los enganches ASINCRONOS de audio insertaron una
// pista de audio en la cabeza de Flat2D y sus dos clips quedaron con lane=0 (que paso a ser la pista de audio,
// invisible para el render). Se mueven a la pista de video CON LA APP VIEJA y se re-guarda. Luego se toma la
// instantanea definitiva (la que usa aud8b-compara.mjs). Requiere la app vieja en :9223.
import { evalInApp } from './cdp.mjs';
import fs from 'fs';

const DIR = String.raw`C:\Users\beltr\Desktop\Alma Digital Studio\Projects\Immersive Studio Pro\scratchpad`;
const ISP = (DIR + '\\aud8b-viejo.isp').replace(/\\/g, '\\\\');
const ev = (x, t) => evalInApp(x, { port: 9223, timeout: t || 120000 });

const fix = await ev(`(async function(){
  state.dirty=false; await openProjectPath('${ISP}',true);
  const t0=Date.now(); while(Date.now()-t0<25000){ await new Promise(r=>setTimeout(r,250)); if(state.media.filter(m=>!isSeqMedia(m)).every(m=>!m._loading&&!m.missing))break; }
  const f=state.media.find(m=>m.name==='Flat2D');
  const vi=f.nestLanes.findIndex(l=>l.kind==='video');
  for(const c of f.nestClips) c.lane=vi;
  saveActiveSeq(); const ok=await DSP.writeText('${ISP}', JSON.stringify(serProject()));
  // esperar a que el archivo sea LEGIBLE otra vez (el read inmediato tras write puede fallar transitorio en Windows)
  let legible=false; const tr=Date.now(); while(Date.now()-tr<8000){ try{ const t=await DSP.readText('${ISP}'); if(t&&t.length>1000){legible=true;break;} }catch(e){} await new Promise(r=>setTimeout(r,300)); }
  state.dirty=false;
  return {vi, movidos:f.nestClips.map(c=>c.name+'@'+c.lane), guardado:ok!==false, legible,
    ausentes:state.media.filter(m=>m.missing).map(m=>m.name)};
})()`, 60000);
console.log('arreglo:', JSON.stringify(fix));

// reabrir el archivo YA ARREGLADO y tomar la instantanea definitiva
const SNAP_FN = fs.readFileSync(DIR + '\\aud8b-fixture-viejo.mjs', 'utf8').match(/const SNAP_FN = `([\s\S]*?)`;/)[1];
const reopen = await ev(`(async function(){ state.dirty=false; await openProjectPath('${ISP}',true);
  const t0=Date.now(); while(Date.now()-t0<25000){ await new Promise(r=>setTimeout(r,250)); if(state.media.filter(m=>!isSeqMedia(m)).every(m=>!m._loading&&!m.missing))break; }
  return { ausentes: state.media.filter(m=>m.missing).map(m=>m.name),
           alerta: (document.querySelector('#alertOv')||{textContent:null}).textContent,
           clips: state.clips.length }; })()`, 60000);
console.log('tras reabrir:', JSON.stringify(reopen));
if (reopen.alerta) { console.error('*** ALERTA ABIERTA tras reabrir — instantanea invalida: ' + reopen.alerta + ' ***'); process.exit(1); }
await new Promise(r => setTimeout(r, 1200));
await ev(SNAP_FN);
// rebote de secuencia: tras ciertas cargas encadenadas la primera tanda de composites sale vacia (arnés, no
// programa: dbg5 demostro que un openSeq de ida y vuelta lo asienta). Sin esto, t101.3 daba 0 de forma estable.
await ev(`(async function(){ const f=state.media.find(m=>m.name==='Flat2D'); openSeq(f.id); await new Promise(r=>setTimeout(r,250)); const mn=state.media.find(m=>m.name==='Sequence 1'); openSeq(mn.id); await new Promise(r=>setTimeout(r,250)); render(); return 1; })()`, 60000);
// pixeles PRIMERO. La PRIMERA pasada tras abrir difiere (texturas a medio calentar) → un tiro de calentamiento
// que se descarta, y cada instante se toma DOS veces exigiendo igualdad (autocontrol del arnés).
const shot = async (t) => { await ev(`__pix([${t}])`, 120000); const a = await ev(`__pix([${t}])`, 120000); const b = await ev(`__pix([${t}])`, 120000);
  const k = 't' + t; if (a[k].hash !== b[k].hash) console.log('*** INESTABLE en t=' + t + ': ' + a[k].hash + ' vs ' + b[k].hash + ' ***');
  return a; };
const pix = {};
for (const t of [101.3, 103.7, 116.1, 117.6]) Object.assign(pix, await shot(t));
if (!pix['t101.3'].nz) { console.error('*** t101.3 sigue vacio: instantanea de pixeles NO VALIDA ***'); process.exit(1); }
const pixFlat = {};
await ev(`(async function(){ const f=state.media.find(m=>m.name==='Flat2D'); openSeq(f.id); await new Promise(r=>setTimeout(r,300)); return 1; })()`, 60000);
for (const t of [1.0, 3.4]) Object.assign(pixFlat, await shot(t));
await ev(`(async function(){ const mn=state.media.find(m=>m.name==='Sequence 1'); openSeq(mn.id); await new Promise(r=>setTimeout(r,200)); return 1; })()`, 60000);
const snap = await ev(`__snap()`, 120000);

const out = { fecha: new Date().toISOString(), commit: 'a33c70b', snap, pix, pixFlat };
fs.writeFileSync(DIR + '\\aud8b-viejo-estado.json', JSON.stringify(out, null, 1));
console.log('instantanea definitiva escrita.');
console.log('pix:', JSON.stringify(pix));
console.log('pixFlat:', JSON.stringify(pixFlat));
console.log('bucles:', Object.keys(snap.srcT).length, '· seqs:', snap.seqs.join(' · '));
