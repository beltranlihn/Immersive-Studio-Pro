import { evalInApp } from './cdp.mjs';
const expr = `(()=>{
  createShapeClip('rect');
  const c = state.clips[state.clips.length-1];
  state.selId=c.id; state.selIds=[c.id]; state.playhead=c.start+1;
  // add an effect
  const fxKey = (typeof FXTYPES!=='undefined' && FXTYPES.length)?FXTYPES[0].key:null;
  addFxToClip(c, fxKey);
  const f = c.fx[c.fx.length-1];
  // switch to reactive tab + render panel
  state.inspTab='react'; renderInspector();
  const card = document.querySelector('#arChain .fxcard[data-fx="'+f.id+'"]');
  const kfButtonsBefore = card ? card.querySelectorAll('.fxrow .kf[data-kf]').length : -1;
  const kfVisibleBefore = card ? [...card.querySelectorAll('.fxrow .kf[data-kf]')].filter(e=>getComputedStyle(e).display!=='none').length : -1;
  const autoBadgeHiddenBefore = card ? getComputedStyle(card.querySelector('.fxauto')).display : '?';
  // automate the effect's first param via its kf toggle
  const firstKf = card ? card.querySelector('.fxrow .kf[data-kf]') : null;
  if(firstKf) firstKf.click();
  // re-grab (panel re-rendered)
  const card2 = document.querySelector('#arChain .fxcard[data-fx="'+f.id+'"]');
  const autoBadgeAfter = card2 ? getComputedStyle(card2.querySelector('.fxauto')).display : '?';
  const anyKf = fxAnyKf(c,f);
  // [A3] Show Automation reveals on the track
  fxShowAutomation(c,f);
  const lane = state.lanes[c.lane];
  // context-menu wiring present?
  const hdr = card2 ? card2.querySelector('.fxhdr') : null;
  const hasCtx = !!(hdr && hdr.oncontextmenu);
  return JSON.stringify({
    kfTogglesInCard: kfButtonsBefore,
    kfTogglesVisible: kfVisibleBefore,
    autoBadgeBefore: autoBadgeHiddenBefore,   // should be 'none' (not automated yet)
    autoBadgeAfterAutomating: autoBadgeAfter,  // should be 'inline' (visible)
    fxAnyKf: anyKf,
    showAutomation_autoP: lane._autoP,
    inlineCurvesOn: !!state.inlineCurves,
    headerContextMenuWired: hasCtx
  }, null, 1);
})()`;
console.log(await evalInApp(expr, { timeout: 20000 }));
