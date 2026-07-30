import { connect } from './r227-lib.mjs';
const { evalExpr, shot, wait, ws } = await connect();
const fmt=process.argv[2]||'dome';
const shots=(process.argv[3]||'').split(',').map(Number);
await evalExpr(`startDemoProject(${JSON.stringify(fmt)})`);
await wait(1400);
const info=()=>evalExpr(`(function(){ const ov=document.getElementById('tourOv'); if(!ov)return null; const card=ov.children[1];
  return {step:card.children[0].textContent, title:card.children[1].textContent,
    tab:state.inspTab, automode:document.body.classList.contains('automode'), autoP:(state.lanes[_demoRefs.autoLane]||{})._autoP,
    sel:(state.selId===_demoRefs.fxClipId?'fxClip':state.selId===_demoRefs.compClipId?'compClip':String(state.selId)) }; })()`);
const next=()=>evalExpr(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})),1`);
for(let i=1;i<=12;i++){
  const inf=await info(); if(!inf){ console.log('tour ended at',i); break; }
  console.log(i, JSON.stringify(inf));
  if(shots.includes(i)){ await wait(260); console.log('   ',await shot('t-'+fmt+'-step'+i+'.png')); }
  await next(); await wait(330);
}
console.log('tour closed:', await evalExpr(`!document.getElementById('tourOv')`));
console.log('state after:', JSON.stringify(await evalExpr(`({dirty:state.dirty,path:currentPath,clips:state.clips.length,tab:state.inspTab})`)));
console.log('errs:', JSON.stringify(await evalExpr(`window.__errs`)));
ws.close();
