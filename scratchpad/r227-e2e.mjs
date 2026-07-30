import { connect, SHOTS } from './r227-lib.mjs';
import fs from 'fs';
const { evalExpr, shot, wait, ws } = await connect();
const call=e=>evalExpr(`(function(){ ${e} return 1; })()`);
console.log('boot → landing:', await evalExpr(`({landing:!!document.getElementById('landingOv'), demo:!!document.getElementById('lchDemo'), back:!!document.getElementById('lchBack')})`));
// clic real en el menú de demos → 360 Room
await call(`document.getElementById('lchDemo').click();`); await wait(200);
await call(`[...document.querySelectorAll('.menu button')].find(b=>/360/.test(b.textContent)).click();`);
await wait(1600);
console.log('demo 360 + tour:', await evalExpr(`({seqMode:state.seqMode, clips:state.clips.length, tour:!!document.getElementById('tourOv'), paso:(function(){const o=document.getElementById('tourOv');return o?o.children[1].children[0].textContent:null;})(), dirty:state.dirty, path:currentPath})`));
console.log(await shot('e2e-room-tour.png'));
await call(`document.getElementById('tourSkip').click();`); await wait(300);
console.log('tras skip:', await evalExpr(`({tour:!!document.getElementById('tourOv'), dirty:state.dirty})`));
console.log('errs:', JSON.stringify(await evalExpr(`window.__errs`)));
ws.close();
