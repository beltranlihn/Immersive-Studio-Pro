// Los sitios donde 'ndi' es caso especial y 'spout' debe entrar igual.
import fs from 'fs';
let a = fs.readFileSync('app.js', 'utf8');
const log = [];
const r = (x, y, why) => { if (!a.includes(x)) { log.push('NO  ' + why); return; } a = a.replace(x, y); log.push('OK  ' + why); };

// ficha de Medios: etiqueta de duración y trato de "fuente en vivo"
r(`    const isNdi=(m.kind==='ndi'); const seq=isSeqMedia(m); const isAdj=(m.kind==='adjust'); const dur=isNdi?'NDI':(seq?'SEQ':(isAdj?'ADJ':(m.kind==='image'?'IMG':fmtDur(m.dur))));`,
  `    const isNdi=(m.kind==='ndi'||m.kind==='spout'); const seq=isSeqMedia(m); const isAdj=(m.kind==='adjust'); const dur=(m.kind==='ndi')?'NDI':(m.kind==='spout')?'SPOUT':(seq?'SEQ':(isAdj?'ADJ':(m.kind==='image'?'IMG':fmtDur(m.dur))));`,
  'lista de medios: etiqueta SPOUT y trato de fuente viva');
r(`function makeMediaTile(m){ const seq=isSeqMedia(m), isNdi=(m.kind==='ndi');`,
  `function makeMediaTile(m){ const seq=isSeqMedia(m), isNdi=(m.kind==='ndi'||m.kind==='spout'); // [V3] Spout se comporta como NDI: fuente en vivo, sin archivo`,
  'ficha de medio: Spout como fuente viva');
// borrar el medio → cerrar el receptor
r(`try{disposeDecoder(m);}catch(e){} if(m.kind==='ndi')closeNdiMedia(m);`,
  `try{disposeDecoder(m);}catch(e){} if(m.kind==='ndi')closeNdiMedia(m); if(m.kind==='spout')closeSpoutMedia(m);`,
  'borrar medio: cierra el receptor Spout');
// relink: una fuente en vivo no tiene archivo que reenlazar
r(`  if(m.kind==='ndi'){ m.missing=false; m._loading=false; return; } // live NDI input — no file to relink`,
  `  if(m.kind==='ndi'||m.kind==='spout'){ m.missing=false; m._loading=false; return; } // entrada en vivo (NDI/Spout) — no hay archivo que reenlazar`,
  'relink: Spout exento');

// abrir proyecto: rearmar la textura y reabrir el receptor, como hace NDI
r(`else if(m.kind==='ndi'){ m.tex=newTex();`,
  `else if(m.kind==='spout'){ m.tex=newTex(); try{ upTexRaw(m.tex,16,16,new Uint8Array(16*16*4).fill(24)); }catch(e){} m.w=m.w||16; m.h=m.h||16; m.dur=m.dur||60; m._spLive=false; m._thumbT=0; m.missing=false; try{ if(m.spoutSource&&DSP&&DSP.spout)DSP.spout.inOpen(m.spoutSource); }catch(e){} spoutStartPump(); } /* [V3] al abrir un .isp: textura de relleno + reenganche al emisor si sigue vivo */
  else if(m.kind==='ndi'){ m.tex=newTex();`,
  'abrir proyecto: rearma y reengancha Spout');

fs.writeFileSync('app.js', a);
console.log(log.join('\n'));
