import { connect, SHOTS } from './r227-lib.mjs';
import fs from 'fs';
const { evalExpr, shot, wait, ws } = await connect();
const fmt=process.argv[2]||'dome';
const dump=async(name,expr)=>{ const b64=await evalExpr(`(function(){ ${expr||''} render(); return glc.toDataURL('image/png').slice(22); })()`);
  fs.writeFileSync(SHOTS+name, Buffer.from(b64,'base64')); console.log(name); };
await evalExpr(`startDemoProject(${JSON.stringify(fmt)})`); await wait(1400);
await evalExpr(`(function(){ if(_tourStop)_tourStop(); return 1; })()`);
for(const t of [3,8,15,21]) await dump('cv-'+fmt+'-t'+t+'.png','state.playhead='+t+';');
if(fmt==='room'){ await dump('cv-room-3d.png',`state.view.mode='3d'; state.playhead=8;`); await evalExpr(`(function(){ state.view.mode='2d'; render(); return 1; })()`); }
if(fmt==='dome'){ await dump('cv-dome-3d.png',`state.view.mode='3d'; state.playhead=8;`); await evalExpr(`(function(){ state.view.mode='2d'; render(); return 1; })()`); }
console.log('errs:', JSON.stringify(await evalExpr(`window.__errs`)));
ws.close();
