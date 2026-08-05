/* [R256] Aceptacion del arreglo del bloqueo mutuo. Compara la salida CON el arreglo (camino WebCodecs) contra la
   REFERENCIA guardada sin el arreglo (camino <video>, el que R189 probo identico bit a bit).
   El criterio NO es el hash del PNG: se midio que dos pasadas identicas difieren en UN pixel de 1/255 por
   redondeo de la GPU (PSNR 102 dB en un canal). El criterio es de PIXELES: ningun fotograma por debajo de 90 dB,
   que deja pasar un punado de pixeles a +-1 y no deja pasar un fotograma equivocado (un vecino da 30-45 dB). */
import fs from 'fs'; import path from 'path'; import cp from 'child_process';
const DIR=(n)=>'scratchpad/'+n+'/dome_512x512_30fps';
/* ffmpeg escribe el informe de PSNR por STDERR, no por stdout: leerlo de stdout devolvia NaN en silencio
   y el probe daba por bueno cualquier cosa. */
function psnr(a,b){
  const r=cp.spawnSync('ffmpeg',['-hide_banner','-i',a,'-i',b,'-lavfi','psnr','-f','null','-'],{encoding:'utf8'});
  const m=/average:([0-9.]+|inf)/.exec(String(r.stderr||'')+String(r.stdout||''));
  if(!m) throw new Error('ffmpeg no dio PSNR para '+a+': '+String(r.stderr||'').slice(-200));
  return m[1]==='inf'?Infinity:+m[1];
}
const ref=process.argv[2]||'r256-ref-1', nue=process.argv[3]||'r256-bucle-1';
const A=fs.readdirSync(DIR(ref)).filter(x=>/\.png$/.test(x)).sort();
let peor=Infinity, peorN='', malos=0, iguales=0;
for(const n of A){
  const p=psnr(path.join(DIR(ref),n), path.join(DIR(nue),n));
  if(p===Infinity){ iguales++; continue; }
  if(p<peor){ peor=p; peorN=n; }
  if(p<90){ malos++; if(malos<=6) console.log('   *** '+n+'  PSNR '+p.toFixed(2)+' dB'); }
}
console.log(ref+' vs '+nue+':  '+A.length+' fotogramas · '+iguales+' identicos bit a bit · '
  +(malos?malos+' POR DEBAJO DE 90 dB':'ninguno por debajo de 90 dB')
  +(peor===Infinity?'':'  · el peor: '+peorN+' '+peor.toFixed(2)+' dB'));
process.exit(malos?1:0);
