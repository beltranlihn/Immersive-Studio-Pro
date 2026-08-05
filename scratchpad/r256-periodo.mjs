/* [R256] Prueba INTRINSECA, sin referencia externa: un bucle de 0,4 s a 30 fps repite cada 12 fotogramas, asi que
   el fotograma k y el k+12 son el MISMO instante de fuente. Si difieren, el export entrego un fotograma erroneo. */
import fs from 'fs'; import path from 'path'; import cp from 'child_process';
function psnr(a,b){ const r=cp.spawnSync('ffmpeg',['-hide_banner','-i',a,'-i',b,'-lavfi','psnr','-f','null','-'],{encoding:'utf8'});
  const m=/average:([0-9.]+|inf)/.exec(String(r.stderr||'')); if(!m)throw new Error('sin PSNR'); return m[1]==='inf'?Infinity:+m[1]; }
for(const d of process.argv.slice(2)){
  const D='scratchpad/'+d+'/dome_512x512_30fps';
  const A=fs.readdirSync(D).filter(x=>/\.png$/.test(x)).sort();
  let malos=0, peor=Infinity, peorN='', n=0;
  for(let i=0;i+12<A.length;i++){ const p=psnr(path.join(D,A[i]),path.join(D,A[i+12])); n++;
    if(p<peor){peor=p;peorN=A[i]+' vs '+A[i+12];} if(p<90)malos++; }
  console.log(d.padEnd(14)+': '+n+' parejas k/k+12 · '+(malos?malos+' NO COINCIDEN':'todas coinciden')
    +'  · la peor: '+(peor===Infinity?'identicas':peor.toFixed(2)+' dB  ('+peorN+')'));
}
