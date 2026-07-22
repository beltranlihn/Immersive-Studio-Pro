import { evalInApp } from './cdp.mjs';
const expr = `(()=>{
  createShapeClip('rect');
  const c = state.clips[state.clips.length-1];
  state.selId=c.id; state.selIds=[c.id]; state.playhead=c.start+1;
  renderInspector();
  const kfVisible = [...document.querySelectorAll('#insCtl .kf')].some(e=>getComputedStyle(e).display!=='none');
  const kfCount = document.querySelectorAll('#insCtl .kf').length;
  const diamond = document.querySelector('#tfRows .prow .nav [data-k=add]');
  const row = ()=>document.querySelector('#tfRows .prow'); // first row = az
  const st = {};
  st.autoBefore = !!(c.kf && c.kf.az);
  // click diamond → create first kf + reveal
  diamond.click();
  st.afterAdd = { hasKf: !!(c.kf&&c.kf.az&&c.kf.az.length), inlineCurves: !!state.inlineCurves, autoP: state.lanes[c.lane]._autoP, rowAutoClass: row().classList.contains('auto') };
  // click again on same spot (playhead on the kf) → remove it
  diamond.click();
  st.afterToggleOff = { hasKf: !!(c.kf&&c.kf.az&&c.kf.az.length) };
  // add two points then right-click clear
  state.playhead=c.start+0.5; diamond.click(); state.playhead=c.start+1.5; diamond.click();
  st.afterTwo = { hasKf: !!(c.kf&&c.kf.az&&c.kf.az.length), n:(c.kf&&c.kf.az?c.kf.az.length:0) };
  diamond.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true}));
  st.afterRightClickClear = { hasKf: !!(c.kf&&c.kf.az&&c.kf.az.length) };
  return JSON.stringify({ stopwatchVisible:kfVisible, kfElementsInInspector:kfCount, diamondPresent:!!diamond, flow:st }, null, 1);
})()`;
console.log(await evalInApp(expr, { timeout: 20000 }));
