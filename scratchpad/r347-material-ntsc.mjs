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

   [R347b] Y LOS DOS DE TIMEBASE GRUESO, que son los que de verdad hacian falta:

     ms-24.mp4   24 fps EXACTOS con `-video_track_timescale 1000`
     ms-60.mp4   60 fps EXACTOS con `-video_track_timescale 1000`

   Matroska fija su timebase en milisegundos y `ffmpeg -i x.mkv -c copy out.mp4` lo arrastra, asi que esta clase
   de archivo es corriente. Ahi los intervalos de un 24 exacto son 42,41,42,42,41... ms, la mediana es 42 y
   `1/md` = 23,8095, que cae MAS CERCA de 23,976 que de 24: es la entrada con la que R347 se equivocaba, y la
   que ningun archivo del banco tenia. Sin estos dos, los controles de cadencia entera pasaban por construccion
   -sus timebases son multiplos exactos del fotograma- y la red seguia verde con la regresion viva.

   DURAN 30 s. La razon NO es la que decia la primera version de esta cabecera ("con 8 s el caso de 23,976 ni se
   rozaba"): eso sale de los `1001/(2*fps)` s en los que la deriva alcanza medio fotograma, que es el numero del
   CENTRO del fotograma. Sobre la rejilla de FRONTERA -la que piden el export y el generador de proxys- una
   cadencia equivocada desplaza ya el fotograma 1, asi que un banco de 8 s habria discriminado igual. Se quedan
   en 30 s porque ahi tambien se ve crecer el desplazamiento (uno mas cada `1001/fps` s), que es informacion, no
   porque hiciera falta para verlo.

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

const FP = FF.replace(/ffmpeg\.exe$/i, 'ffprobe.exe');
const ff = (args, que) => { process.stdout.write('   ' + que + ' ... '); execFileSync(FF, ['-y', '-v', 'error', ...args]); console.log('hecho'); };
const O = n => path.join(OUT, n);
/* [R347b] El banco se COMPRUEBA, no se supone. PLAN.md llego a decir "comprobado con ffprobe" cuando esa
   comprobacion se habia hecho a mano una vez y el guion no la hacia: si otro ffmpeg emitiera 24 en vez de
   24000/1001, o la fuente se recortara y el archivo saliera mas corto, el banco dejaria de probar NTSC en
   silencio y la red seguiria verde. ffprobe es ademas un juez INDEPENDIENTE del demuxador de la app. */
const comprueba = (nom, rateEsperado, tsEsperado, durMin) => {
  const r = execFileSync(FP, ['-v', 'error', '-select_streams', 'v:0', '-show_entries',
    'stream=r_frame_rate,time_base,nb_frames,duration', '-of', 'default=nw=1', O(nom)], { encoding: 'utf8' });
  const g = k => (new RegExp('^' + k + '=(.*)$', 'm').exec(r) || [, ''])[1].trim();
  const rate = g('r_frame_rate'), tb = g('time_base'), dur = parseFloat(g('duration')) || 0;
  const mal = [];
  if (rate !== rateEsperado) mal.push('cadencia ' + rate + ' (se esperaba ' + rateEsperado + ')');
  if (tsEsperado && tb !== '1/' + tsEsperado) mal.push('timebase ' + tb + ' (se esperaba 1/' + tsEsperado + ')');
  if (dur < durMin) mal.push('dura ' + dur.toFixed(2) + ' s (se esperaban >=' + durMin + ')');
  if (mal.length) { console.log('   *** ' + nom + ': ' + mal.join(' · ')); return false; }
  console.log('   ok  ' + nom + '  ' + rate + '  timebase ' + tb + '  ' + dur.toFixed(2) + ' s');
  return true;
};

if (!existsSync(FP)) { console.log('*** no encuentro ffprobe en ' + FP); process.exit(2); }
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
/* [R347b] Los dos de timebase GRUESO: 24 y 60 EXACTOS en milisegundos, que es la clase de archivo con la que
   R347 se equivocaba y de la que el banco no tenia ni un ejemplar. */
for (const [nom, fps, gop] of [['ms-24.mp4', 24, 48], ['ms-60.mp4', 60, 120]]) {
  ff(['-stream_loop', '4', '-i', FUENTE, '-t', '30', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
    '-r', String(fps), '-video_track_timescale', '1000',
    '-g', String(gop), '-keyint_min', String(gop), '-sc_threshold', '0', '-bf', '3',
    '-pix_fmt', 'yuv420p', '-an', O(nom)],
    nom + '  (' + fps + ' exactos, timebase de milisegundos)');
}
/* [R347b] Y el PAL. El `canon` anterior a R347 devolvia el PRIMER candidato dentro de 1,2 y 24 precede a 25, con
   lo que |25-24| = 1 disparaba antes de probar el 25: TODO material de 25p se detectaba como 24 — un 4 % de
   error, cuarenta veces el de NTSC, y desde el commit inicial. R347 lo arreglo de rebote al pasar a "el mas
   cercano" y no lo cubria ninguna prueba, asi que una vuelta a la busqueda por orden lo revive en silencio. */
ff(['-stream_loop', '4', '-i', FUENTE, '-t', '30', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
  '-r', '25', '-video_track_timescale', '12800',
  '-g', '50', '-keyint_min', '50', '-sc_threshold', '0', '-bf', '3',
  '-pix_fmt', 'yuv420p', '-an', O('pal-25.mp4')],
  'pal-25.mp4  (25 exactos: el que se detectaba como 24)');

console.log('');
console.log('   comprobando el banco con ffprobe (juez independiente del demuxador de la app):');
let bien = true;
bien = comprueba('ntsc-2397.mp4', '24000/1001', 24000, 29) && bien;
bien = comprueba('ntsc-2997.mp4', '30000/1001', 30000, 29) && bien;
bien = comprueba('ntsc-5994.mp4', '60000/1001', 60000, 29) && bien;
bien = comprueba('ms-24.mp4', '24/1', 1000, 29) && bien;
bien = comprueba('ms-60.mp4', '60/1', 1000, 29) && bien;
bien = comprueba('pal-25.mp4', '25/1', 12800, 29) && bien;
console.log('');
console.log('   OJO: `r347-ntsc.mjs` usa ademas `tunel-control.mp4` y `gop240-60fps.mp4`, que NO salen de aqui');
console.log('        sino de:  node scratchpad/r344-material.mjs');
console.log('   Se comprueba con:  node scratchpad/r347-ntsc.mjs');
console.log('');
if (!bien) process.exit(1);
