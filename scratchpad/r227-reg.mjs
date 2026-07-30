import { connect } from './r227-lib.mjs';
const { evalExpr, wait, ws } = await connect();
const call=e=>evalExpr(`(function(){ ${e} return 1; })()`);
// 1) New sequence (los 3 tipos) → sin tour
for(const tipo of ['dome','flat','room']){
  await call(`newSequenceDialog(); const b=[...document.querySelectorAll('#nsMode button')].find(x=>x.dataset.m==='${tipo}'); b.click(); document.getElementById('nsGo').click();`);
  await wait(500);
  console.log('New sequence '+tipo+':', await evalExpr(`({seqMode:state.seqMode, tour:!!document.getElementById('tourOv'), seqs:state.media.filter(isSeqMedia).length})`));
}
// 2) landing → los 3 tipos de proyecto normales
for(const t of ['dome','flat','room']){
  await call(`state.dirty=false; _lchVolver=false; showLanding(); _lch.ptype='${t}'; _lch.pname='reg-${t}'; lchCreate();`);
  await wait(1100);
  console.log('launcher '+t+':', await evalExpr(`({landing:!!document.getElementById('landingOv'), seqMode:state.seqMode, seq:activeSeq()&&activeSeq().name, tour:!!document.getElementById('tourOv'), lanes:state.lanes.length, dirty:state.dirty, path:currentPath})`));
}
// 3) menú de demos del landing
await call(`state.dirty=false; showLanding();`); await wait(300);
console.log('menú Demos:', await evalExpr(`(function(){ document.getElementById('lchDemo').click(); const m=document.querySelector('.menu'); const o=m?[...m.querySelectorAll('button')].map(b=>b.textContent.trim()):null; closeMenu(); return o; })()`));
// 4) abrir un .isp reciente
const P='C:/Users/beltr/Desktop/Alma Digital Studio/Projects/Immersive Studio Pro/scratchpad/r227-demo-save.isp';
await evalExpr(`openProjectPath(${JSON.stringify(P)})`); await wait(1200);
console.log('abrir .isp:', await evalExpr(`({landing:!!document.getElementById('landingOv'), seq:activeSeq()&&activeSeq().name, clips:state.clips.length, tour:!!document.getElementById('tourOv'), path:currentPath&&currentPath.split(/[\\/]/).pop()})`));
console.log('errs:', JSON.stringify(await evalExpr(`window.__errs`)));
ws.close();
