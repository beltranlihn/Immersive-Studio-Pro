import { connect } from './r222-lib.mjs';
const { evalExpr, shot, ws } = await connect();
const place = await evalExpr(`(function(){
  document.querySelectorAll('.overlay').forEach(o=>o.remove());
  const c = state.clips.find(cc=>cc.id===window.__testClipId);
  const info = window.__placeAtPixel(c, 0, 500, 300, 0);
  state.view.mode='2d';
  render(); renderTimeline(); renderInspector();
  return info;
})()`);
console.log('placed:', JSON.stringify(place));
await new Promise(r=>setTimeout(r,300));
await shot('C:/Users/beltr/AppData/Local/Temp/claude/C--Users-beltr-Desktop-Alma-Digital-Studio-Projects-Immersive-Studio-Pro/f0de9ad5-8bdc-480b-8a2f-b96e2600a726/scratchpad/r222-wallseam-old-2d.png');
ws.close();
