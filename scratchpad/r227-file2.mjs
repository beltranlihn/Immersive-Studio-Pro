import { connect } from './r227-lib.mjs';
const { evalExpr, wait, ws } = await connect();
const call=e=>evalExpr(`(function(){ ${e} return 1; })()`);
// B) sucio → cancelar
await call(`markDirty();`);
await call(`newProjectViaLanding();`); await wait(350);
console.log('B) diálogo 3 salidas:', await evalExpr(`(function(){ const o=document.getElementById('confirm3Ov'); return o?[...o.querySelectorAll('button')].map(b=>b.textContent.trim()):null; })()`));
await call(`document.getElementById('c3Cancel').click();`); await wait(350);
console.log('   cancelar → se queda:', await evalExpr(`({landing:!!document.getElementById('landingOv'), dirty:state.dirty, clips:state.clips.length})`));
// C) sucio → descartar
await call(`newProjectViaLanding();`); await wait(300);
await call(`document.getElementById('c3Discard').click();`); await wait(450);
console.log('C) descartar → landing:', await evalExpr(`({landing:!!document.getElementById('landingOv'), dirty:state.dirty, yaDicho:_descartarYaDicho})`));
await call(`_lch.ptype='flat'; _lch.pname='post-descarte'; lchCreate();`); await wait(1100);
console.log('   crear tras descartar:', await evalExpr(`({confirmOv:!!document.getElementById('confirmOv'), landing:!!document.getElementById('landingOv'), seqMode:state.seqMode, seq:activeSeq().name, clips:state.clips.length, dirty:state.dirty, tour:!!document.getElementById('tourOv'), yaDicho:_descartarYaDicho})`));
console.log('errs:', JSON.stringify(await evalExpr(`window.__errs`)));
ws.close();
