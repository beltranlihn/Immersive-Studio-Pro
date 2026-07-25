import { evalInApp } from './cdp.mjs';
// start a fresh splash and capture its state + loop advance
const start = `(()=>{ ['splashOv','landingOv','loadingOv'].forEach(id=>{const e=document.getElementById(id); if(e)e.remove();});
  window.__splashDone=false; showSplash(2, ()=>{ window.__splashDone=true; });
  const s=document.getElementById('splashOv'), card=s&&s.querySelector('.splashcard'), logo=s&&s.querySelector('.splashlogo');
  const r=card&&card.getBoundingClientRect();
  return JSON.stringify({ created:!!s, square:r?[Math.round(r.width),Math.round(r.height)]:null, src0:logo&&logo.getAttribute('src') }); })()`;
console.log('t0:', await evalInApp(start,{timeout:8000}));
await new Promise(r=>setTimeout(r,700));
console.log('t0.7 (src should have advanced):', await evalInApp(`(()=>{ const l=document.querySelector('#splashOv .splashlogo'); return JSON.stringify({src:l&&l.getAttribute('src'), done:window.__splashDone}); })()`,{timeout:8000}));
await new Promise(r=>setTimeout(r,5500));
console.log('t6.2 (should be done, splash gone):', await evalInApp(`(()=>{ return JSON.stringify({splash:!!document.getElementById('splashOv'), done:window.__splashDone}); })()`,{timeout:8000}));
