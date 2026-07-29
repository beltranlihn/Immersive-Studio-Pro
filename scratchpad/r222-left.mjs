import { connect } from './r222-lib.mjs';
const { evalExpr, shot, ws } = await connect();

const place = await evalExpr(`(function(){
  const c = state.clips.find(cc=>cc.id===window.__testClipId);
  const info = window.__placeAtPixel(c, 0, 1848, 300, 0);
  state.view.mode='2d';
  render(); renderTimeline(); renderInspector();
  return info;
})()`);
console.log('placed L:', JSON.stringify(place));
await new Promise(r=>setTimeout(r,300));
await shot('C:/Users/beltr/AppData/Local/Temp/claude/C--Users-beltr-Desktop-Alma-Digital-Studio-Projects-Immersive-Studio-Pro/f0de9ad5-8bdc-480b-8a2f-b96e2600a726/scratchpad/r222-left-2d.png');

await evalExpr(`(function(){ state.view.mode='3d'; state.view.three='orbit'; state.view.cam.yaw=1.55; state.view.cam.pitch=-0.15; state.view.cam.dist=1.6; state.view.cam.fov=65; render(); })()`);
await new Promise(r=>setTimeout(r,300));
await shot('C:/Users/beltr/AppData/Local/Temp/claude/C--Users-beltr-Desktop-Alma-Digital-Studio-Projects-Immersive-Studio-Pro/f0de9ad5-8bdc-480b-8a2f-b96e2600a726/scratchpad/r222-left-3d.png');

const errs = await evalExpr(`(window.__errs||[]).length`);
console.log('errs:', errs);
ws.close();
