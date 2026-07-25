import { evalInApp } from './cdp.mjs';
const probe = `(()=>{ const s=document.getElementById('splashOv'); const l=document.getElementById('landingOv');
  const card=s&&s.querySelector('.splashcard'); const logo=s&&s.querySelector('.splashlogo');
  const r=card&&card.getBoundingClientRect();
  return JSON.stringify({ splash:!!s, landing:!!l, hasCard:!!card, square: r?(Math.abs(r.width-r.height)<2 && Math.round(r.width)):null, logoSrc: logo?logo.getAttribute('src'):null }); })()`;
// t=~1.3s: splash should be up, logo cycling
console.log('early:', await evalInApp(probe,{timeout:8000}));
await new Promise(r=>setTimeout(r,1200));
console.log('t~2.5s:', await evalInApp(probe,{timeout:8000}));
await new Promise(r=>setTimeout(r,6000));
console.log('t~8.5s:', await evalInApp(probe,{timeout:8000}));
