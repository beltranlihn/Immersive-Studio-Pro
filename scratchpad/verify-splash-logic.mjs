import { evalInApp } from './cdp.mjs';
// (a) loadingWaitMedia min-loops gating — deterministic, no rAF
const gating = `(()=>{ ['splashOv','landingOv','loadingOv'].forEach(i=>{const e=document.getElementById(i);if(e)e.remove();}); _loadingOv=null;
  const savedMedia=state.media; state.media=[]; // no media loading
  showLoadingScreen('test');
  _loadingLoops=0; loadingWaitMedia(Date.now()+100000);           // loops not done → must STAY up
  const stayed = !!document.getElementById('loadingOv');
  _loadingLoops=2; loadingWaitMedia(Date.now()+100000);           // loops done + no media → must HIDE now
  const hidden = !document.getElementById('loadingOv');
  state.media=savedMedia; if(_loadingPoll){clearTimeout(_loadingPoll);_loadingPoll=0;}
  return JSON.stringify({ PASS_staysUntilLoops: stayed, PASS_hidesWhenLoopsDone: hidden }); })()`;
console.log('gating:', await evalInApp(gating,{timeout:8000}));

// (b) splash completes via the safety timeout (rAF frozen here) and fires onReady
const startSplash = `(()=>{ ['splashOv','landingOv','loadingOv'].forEach(i=>{const e=document.getElementById(i);if(e)e.remove();}); window.__sd=false; showSplash(2,()=>{window.__sd=true;}); return JSON.stringify({up:!!document.getElementById('splashOv')}); })()`;
console.log('splash start:', await evalInApp(startSplash,{timeout:8000}));
console.log('waiting 8.6s for safety-timeout completion...');
await new Promise(r=>setTimeout(r,8600));
console.log('after safety:', await evalInApp(`JSON.stringify({splashGone:!document.getElementById('splashOv'), onReadyFired:window.__sd})`,{timeout:8000}));
