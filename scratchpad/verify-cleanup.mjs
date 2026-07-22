import { evalInApp } from './cdp.mjs';
const expr = `(()=>{
  createShapeClip('rect');
  const c = state.clips[state.clips.length-1];
  state.selId=c.id; state.selIds=[c.id]; state.playhead=c.start+1;
  renderInspector();
  // inspector rows: no .reEn buttons anymore
  const reEnRows = document.querySelectorAll('#insCtl .reEn').length;
  const reEnAllEl = !!document.getElementById('reEnAll');
  // open the modulation panel for 'opacity' and check the freeze button is gone
  const modb = document.querySelector('#fxRows .modb[data-p="opacity"]') || document.querySelector('.modb');
  let frzButtons = -1, modRows = -1;
  if(modb){ openModPanel(c,'opacity',modb); // add one lfo layer so a row renders
    c.mod=c.mod||{}; c.mod.opacity=c.mod.opacity||[]; if(!c.mod.opacity.length){ c.mod.opacity.push(modDefaults('lfo')); }
    openModPanel(c,'opacity',modb);
    const pan=document.querySelector('.modpan');
    frzButtons = pan?pan.querySelectorAll('.mpfrz').length:-2;
    modRows = pan?pan.querySelectorAll('.mprow').length:-2;
    closeModPanel();
  }
  return JSON.stringify({
    reEnRowButtons: reEnRows,
    reEnAllElementExists: reEnAllEl,
    modPanelRows: modRows,
    freezeButtonsInModPanel: frzButtons,
    kfButtonStillPresent: document.querySelectorAll('#insCtl .kf').length>0,
    navDiamondStillPresent: document.querySelectorAll('#insCtl .nav [data-k=add]').length>0
  }, null, 1);
})()`;
console.log(await evalInApp(expr, { timeout: 20000 }));
