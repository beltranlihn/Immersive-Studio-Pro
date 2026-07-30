import { connect, SHOTS } from './r227-lib.mjs';
import fs from 'fs';
const { evalExpr, wait, ws } = await connect();
const fmt=process.argv[2];
const dump=async(name,expr)=>{ const b64=await evalExpr(`(function(){ ${expr||''} render(); return glc.toDataURL('image/png').slice(22); })()`);
  fs.writeFileSync(SHOTS+name, Buffer.from(b64,'base64')); console.log(name); };
await evalExpr(`(function(){ state.dirty=false; return 1; })()`);
await evalExpr(`startDemoProject(${JSON.stringify(fmt)})`); await wait(1400);
await evalExpr(`(function(){ if(_tourStop)_tourStop(); return 1; })()`);
// muestrear la x del clip con vaivén a lo largo de 40s de reloj de preview para comprobar que no se va del lienzo
console.log('x range:', JSON.stringify(await evalExpr(`(function(){ const c=clipById(_demoRefs.autoClipId); const xs=[];
  for(let k=0;k<40;k++){ const t=k*0.7; xs.push(+(evalR(c,'x',t)).toFixed(1)); } return {min:Math.min(...xs),max:Math.max(...xs)}; })()`)));
for(const t of [3,8,15,21]) await dump('cv2-'+fmt+'-t'+t+'.png','state.playhead='+t+';');
console.log('errs:', JSON.stringify(await evalExpr(`window.__errs`)));
ws.close();
