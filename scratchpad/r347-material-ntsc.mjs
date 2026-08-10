/* [R347] Material NTSC, que es el agujero que R346 dejo escrito y nunca se midio.

   Dos preguntas abiertas y ninguna medida:
     1) La tolerancia `TOL_DECOD` se eligio frente al centro del fotograma PORQUE no depende de la cadencia.
        Eso es un argumento, no una medida: sobre 23,976 / 29,97 / 59,94 no se ha probado nunca.
     2) `detectFps` canoniza a {24,25,30,48,50,60,120} con tolerancia 1,2, asi que 59,94 -> 60 y 23,976 -> 24.
        `makeProxy` construye su rejilla de seek con `m.fps`, o sea que sobre NTSC la rejilla DERIVA respecto
        de los pts reales: 1/59,94 - 1/60 = 16,7 us por fotograma, medio fotograma a los ~8 s.

   Se fabrica desde los clips de `C:\Users\beltr\Desktop\Rito Movie`, igual que el material de R344:

     ntsc-2397.mp4   24000/1001 = 23,976 fps
     ntsc-2997.mp4   30000/1001 = 29,97  fps
     ntsc-5994.mp4   60000/1001 = 59,94  fps

   `Tunel 1` se elige por movimiento MEDIDO entre fotogramas (14,0 de diferencia media, frente a 1,3-4,7 del
   resto): sin movimiento, cualquier comparacion de vecinos sale empatada y no discrimina.
   GOP de 2 s con `-sc_threshold 0` para que un corte de plano no meta un fotograma clave extra.
   Los `.mp4` no se versionan (pesan y son derivados).

   DURAN 30 s, y la duracion es parte del banco, no un detalle. El error relativo de canonizar NTSC es 1/1001,
   asi que la deriva alcanza MEDIO FOTOGRAMA -el punto en el que la rejilla equivocada empieza a elegir otro
   fotograma- en `1001/(2*fps)`: 8,3 s a 59,94 · 16,7 s a 29,97 · 20,9 s a 23,976. Con la fuente tal cual
   (8 s) el caso de 23,976 ni se rozaba y el de 59,94 se quedaba justo en el borde: la primera version de este
   banco no podia discriminar y habria dado un aprobado vacio. Por eso `-stream_loop`.

   Uso:  node scratchpad/r347-material-ntsc.mjs
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
const FUENTE = path.join(RITO, 'Tunel 1.mp4');
if (!existsSync(FUENTE)) { console.log('*** falta el material de origen: ' + FUENTE); process.exit(2); }
mkdirSync(OUT, { recursive: true });

const ff = (args, que) => { process.stdout.write('   ' + que + ' ... '); execFileSync(FF, ['-y', '-v', 'error', ...args]); console.log('hecho'); };
const O = n => path.join(OUT, n);

console.log('');
console.log('R347 - fabricando material NTSC en ' + OUT);
/* `-r` fija la cadencia de salida; `-video_track_timescale` deja el timebase en la rejilla NTSC exacta, que es
   lo que hace que los pts sean k*1001/30000 y no una aproximacion a milisegundos. */
for (const [nom, num, den, gop] of [
  ['ntsc-2397.mp4', 24000, 1001, 48],
  ['ntsc-2997.mp4', 30000, 1001, 60],
  ['ntsc-5994.mp4', 60000, 1001, 120],
]) {
  ff(['-stream_loop', '4', '-i', FUENTE, '-t', '30', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
    '-r', num + '/' + den, '-video_track_timescale', String(num),
    '-g', String(gop), '-keyint_min', String(gop), '-sc_threshold', '0', '-bf', '3',
    '-pix_fmt', 'yuv420p', '-an', O(nom)],
    nom + '  (' + (num / den).toFixed(3) + ' fps, GOP ' + gop + ')');
}
console.log('');
console.log('   Se comprueba con:  node scratchpad/r347-ntsc.mjs');
console.log('');
