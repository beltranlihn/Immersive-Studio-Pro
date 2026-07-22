import { evalInApp } from './cdp.mjs';
const FILM = 'C:\\\\Users\\\\beltr\\\\Desktop\\\\Rito Movie\\\\Asset\\\\RIto_Film_1080.mp4';
const expr = `(async()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const decs=[]; for(let n=0;n<4;n++){ const d=await demuxMP4(${JSON.stringify(FILM)}); decs.push(makeClipDecoder(d)); }
  const base=[600e6,900e6,500e6,790e6];
  for(let j=0;j<4;j++)decs[j].setTarget(base[j]);
  await w(1500);
  const primed=decs.map(c=>c.stats().cache);
  const t0=performance.now();
  while(performance.now()-t0<4000){ const el=(performance.now()-t0)*1000; for(let j=0;j<4;j++)decs[j].setTarget(base[j]+el); await w(16); }
  const s=decs.map(c=>{ const x=c.stats(); return {cache:x.cache, resets:x.resets, behindMs:x.target-x.lastFedMs}; });
  for(const c of decs)c.close();
  return JSON.stringify({primedCache:primed, moving:s});
})()`;
console.log(await evalInApp(expr, { timeout: 20000 }));
