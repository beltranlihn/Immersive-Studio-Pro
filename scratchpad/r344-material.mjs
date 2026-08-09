/* [R344] Rehace el material de prueba de las redes de R344. Los `.mp4` no se versionan (pesan y son
   derivados), asi que esto es lo que los devuelve. Todo sale de los clips de `C:\Users\beltr\Desktop\Rito Movie`.

     gop120-60fps.mp4   fotograma clave cada 2 s   } GOP LARGO: el material que hacia falta para medir el
     gop240-60fps.mp4   fotograma clave cada 4 s   } comportamiento del ClipDecoder ante un salto.
     tunel-control.mp4  edit list de 2 fotogramas (solo el retardo de reordenacion)
     tunel-elst.mp4     edit list de 14 fotogramas: RECORTE de verdad, hecho sin recodificar

   `Tunel 1` se elige por movimiento medido entre fotogramas (14,0 de diferencia media, frente a 1,3-4,7 del
   resto del material y 0,1 de los archivos de descargas): sin movimiento, comparar fotogramas vecinos no
   distingue nada y la sonda no puede afirmar ni desmentir.

   Uso:  node scratchpad/r344-material.mjs
*/
import { existsSync, mkdirSync } from 'fs';
import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(AQUI, 'media');
const RITO = 'C:/Users/beltr/Desktop/Rito Movie/Asset/Creation';
const FF = 'C:/Users/beltr/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1-full_build/bin/ffmpeg.exe';

if (!existsSync(FF)) { console.log('*** no encuentro ffmpeg en ' + FF); process.exit(2); }
for (const f of ['o1.mp4', 'Tunel 1.mp4'])
  if (!existsSync(path.join(RITO, f))) { console.log('*** falta el material de origen: ' + path.join(RITO, f)); process.exit(2); }
mkdirSync(OUT, { recursive: true });

const ff = (args, que) => { process.stdout.write('   ' + que + ' ... '); execFileSync(FF, ['-y', '-v', 'error', ...args]); console.log('hecho'); };
const O = n => path.join(OUT, n);

console.log('');
console.log('R344 - rehaciendo el material de prueba en ' + OUT);
/* GOP largo: -sc_threshold 0 impide que un corte de plano meta un fotograma clave extra y rompa el espaciado. */
ff(['-i', path.join(RITO, 'o1.mp4'), '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
    '-g', '120', '-keyint_min', '120', '-sc_threshold', '0', '-bf', '3', '-pix_fmt', 'yuv420p', '-an', O('gop120-60fps.mp4')],
   'gop120-60fps.mp4  (clave cada 2 s a 60 fps)');
ff(['-i', path.join(RITO, 'o1.mp4'), '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
    '-g', '240', '-keyint_min', '240', '-sc_threshold', '0', '-bf', '3', '-pix_fmt', 'yuv420p', '-an', O('gop240-60fps.mp4')],
   'gop240-60fps.mp4  (clave cada 4 s a 60 fps)');
ff(['-i', path.join(RITO, 'Tunel 1.mp4'), '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
    '-g', '48', '-keyint_min', '48', '-sc_threshold', '0', '-bf', '3', '-pix_fmt', 'yuv420p', '-an', O('tunel-control.mp4')],
   'tunel-control.mp4 (control, con movimiento)');
/* `-ss` ANTES de `-i` con `-c copy`: no recodifica, corta en el fotograma clave anterior y compensa la
   diferencia con una EDIT LIST — que es justo el caso que R342 dice cerrar y que hay que poder medir. */
ff(['-ss', '0.5', '-i', O('tunel-control.mp4'), '-c', 'copy', '-avoid_negative_ts', 'auto', O('tunel-elst.mp4')],
   'tunel-elst.mp4    (recorte sin recodificar -> edit list real)');
console.log('');
console.log('   Se comprueba con:  node scratchpad/r344-lee-elst.mjs scratchpad/media/tunel-elst.mp4');
console.log('   Se esperan 14 fotogramas de desfase en tunel-elst y 2 en tunel-control.');
console.log('');
