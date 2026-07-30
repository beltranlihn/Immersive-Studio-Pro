import { connect } from './r227-lib.mjs';
const { evalExpr, shot, wait, ws } = await connect();
await evalExpr(`(function(){ state.playhead=8; state.view.mode='2d'; render(); renderTimeline(); renderInspector(); return 1; })()`);
await wait(600); console.log(await shot('full-room-2d.png'));
await evalExpr(`(function(){ state.view.mode='3d'; state.view.cam.dist=1.5; render(); return 1; })()`);
await wait(600); console.log(await shot('full-room-3d.png'));
await evalExpr(`(function(){ state.view.mode='2d'; render(); return 1; })()`);
ws.close();
