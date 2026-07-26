import { evalInApp } from './cdp.mjs';
const P = { port: 9222 };
const q = `(()=>{const o=document.getElementById('exOv');
  return JSON.stringify({ fase:o?o.querySelector('#exPhase').textContent:'-', pct:o?o.querySelector('#exPct').textContent:'-',
    p:_exJobs.length?_exJobs[_exJobs.length-1].p:null, exporting:exporting, busy:_exbusy,
    glc:glc.width+'x'+glc.height, nestSize:(typeof nestSize!=='undefined'?nestSize:'?') });})()`;
for (let i = 0; i < 4; i++) { console.log(await evalInApp(q, P)); await new Promise(r => setTimeout(r, 4000)); }
