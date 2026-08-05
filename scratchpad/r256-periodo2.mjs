import fs from 'fs'; import path from 'path'; import cp from 'child_process';
function psnr(a,b){ const r=cp.spawnSync('ffmpeg',['-hide_banner','-i',a,'-i',b,'-lavfi','psnr','-f','null','-'],{encoding:'utf8'});
  const m=/average:([0-9.]+|inf)/.exec(String(r.stderr||'')); if(!m)throw new Error('sin PSNR'); return m[1]==='inf'?Infinity:+m[1]; }
const D='scratchpad/'+process.argv[2]+'/dome_512x512_30fps';
const A=fs.readdirSync(D).filter(x=>/\.png$/.test(x)).sort();
console.log(process.argv[2]+'  (primer archivo: '+A[0]+')');
for(let i=0;i+12<A.length;i++){ const p=psnr(path.join(D,A[i]),path.join(D,A[i+12]));
  if(p<90) console.log('   indice '+i+'  '+A[i]+' vs '+A[i+12]+'   '+(p===Infinity?'inf':p.toFixed(2))+' dB'); }
