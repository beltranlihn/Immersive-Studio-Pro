import { evalInApp } from './cdp.mjs';
import { promises as fs } from 'fs';

const FILE = 'C:\\Users\\beltr\\Desktop\\Alma Digital Studio\\Projects\\Immersive Studio Pro\\mp4-muxer.min.js';

// node-side truth: three ranges + EOF-overshoot
const fh = await fs.open(FILE, 'r'); const st = await fh.stat();
const ranges = [[0, 32], [10000, 64], [st.size - 20, 20], [st.size - 10, 40]]; // last one overshoots EOF
const truth = [];
for (const [pos, len] of ranges) { const b = Buffer.allocUnsafe(len); const { bytesRead } = await fh.read(b, 0, len, pos); truth.push(b.subarray(0, bytesRead).toString('hex')); }
await fh.close();

const expr = `(async()=>{
  const out=[]; const hex=u=>{ if(!u)return 'NULL'; const a=(u instanceof Uint8Array)?u:new Uint8Array(u); let s=''; for(let i=0;i<a.length;i++)s+=a[i].toString(16).padStart(2,'0'); return s; };
  const id=await DSP.openRead(${JSON.stringify(FILE)});
  out.push('id='+id);
  const R=[]; const ranges=${JSON.stringify(ranges)};
  for(const [p,l] of ranges){ const u=await DSP.readAt(id,p,l); R.push(hex(u)); }
  await DSP.closeRead(id);
  // a read after close must fail cleanly (null)
  const afterClose=await DSP.readAt(id,0,8);
  R.push('afterClose='+(afterClose===null?'null(ok)':hex(afterClose)));
  return JSON.stringify(R);
})()`;

const appRaw = await evalInApp(expr, { timeout: 30000 });
const app = JSON.parse(appRaw);
console.log('ranges:', JSON.stringify(ranges), 'fileSize:', st.size);
let allOk = true;
for (let i = 0; i < truth.length; i++) {
  const ok = app[i] === truth[i];
  if (!ok) allOk = false;
  console.log((ok ? 'ok   ' : 'FAIL ') + 'rango ' + i + ' [' + ranges[i][0] + ',+' + ranges[i][1] + ']  ' + (ok ? '(' + truth[i].length / 2 + ' bytes coinciden)' : ('app=' + app[i] + ' node=' + truth[i])));
}
console.log((app[4] === 'afterClose=null(ok)' ? 'ok   ' : 'FAIL ') + 'lectura tras closeRead → ' + app[4]);
console.log(allOk && app[4] === 'afterClose=null(ok)' ? '\nETAPA 1 OK' : '\nETAPA 1 FALLA');
