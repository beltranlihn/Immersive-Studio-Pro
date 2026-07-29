import { connect } from './r222-lib.mjs';
const { evalExpr, shot, ws } = await connect();
const place = await evalExpr(`(function(){
  document.querySelectorAll('.overlay').forEach(o=>o.remove());
  const c = state.clips.find(cc=>cc.id===window.__testClipId);
  const info = window.__placeAtPixel(c, 1920, 500, 300, 0); // crosses Front|Right wall seam, well within the walls band (py=500 < wallsH=1080)
  state.view.mode='2d';
  render(); renderTimeline(); renderInspector();
  return info;
})()`);
console.log('placed wall-seam:', JSON.stringify(place));
await new Promise(r=>setTimeout(r,300));
await shot('C:/Users/beltr/AppData/Local/Temp/claude/C--Users-beltr-Desktop-Alma-Digital-Studio-Projects-Immersive-Studio-Pro/f0de9ad5-8bdc-480b-8a2f-b96e2600a726/scratchpad/r222-wallwrap-2d.png');
const errs = await evalExpr(`(window.__errs||[]).length`);
console.log('errs:', errs);
ws.close();
