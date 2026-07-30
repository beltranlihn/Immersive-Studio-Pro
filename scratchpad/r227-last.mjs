import { connect, SHOTS } from './r227-lib.mjs';
import fs from 'fs';
const { evalExpr, wait, ws } = await connect();
const call=e=>evalExpr(`(function(){ ${e} return 1; })()`);
// A) salida "Save" del diálogo de tres salidas (con ruta ya conocida → sin diálogo nativo)
await call(`markDirty();`);
await call(`newProjectViaLanding();`); await wait(300);
await call(`document.getElementById('c3Save').click();`); await wait(900);
console.log('A) guardar → landing:', await evalExpr(`({landing:!!document.getElementById('landingOv'), dirty:state.dirty, path:currentPath&&currentPath.split(/[\\/]/).pop()})`));
await call(`document.getElementById('lchBack').click();`); await wait(250);
// B) recorrido genérico (Ventana → Recorrido guiado) sobre un proyecto normal
await call(`state.dirty=false; _lchVolver=false; showLanding(); _lch.ptype='dome'; _lch.pname='generico'; lchCreate();`); await wait(1000);
await call(`startTour();`); await wait(300);
const pasos=[];
for(let i=0;i<9;i++){ const inf=await evalExpr(`(function(){ const ov=document.getElementById('tourOv'); if(!ov)return null; return [ov.children[1].children[0].textContent, ov.children[1].children[1].textContent]; })()`);
  if(!inf)break; pasos.push(inf.join(' · ')); await call(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));`); await wait(200); }
console.log('B) recorrido genérico:', JSON.stringify(pasos,null,0));
// C) play 5s en los demos flat y room
for(const fmt of ['flat','room']){
  await call(`state.dirty=false;`);
  await call(`startDemoProject('${fmt}');`); await wait(1500);
  await call(`if(_tourStop)_tourStop(); state.playhead=0; play();`);
  await wait(5000);
  const b64=await evalExpr(`(function(){ const r={ph:+state.playhead.toFixed(2), png:glc.toDataURL('image/png').slice(22)}; return r; })()`);
  fs.writeFileSync(SHOTS+'play-'+fmt+'.png', Buffer.from(b64.png,'base64'));
  await call(`if(state.playing)pause();`);
  console.log('C) play '+fmt+' → playhead', b64.ph, '· captura play-'+fmt+'.png');
}
console.log('errs:', JSON.stringify(await evalExpr(`window.__errs`)));
ws.close();
