/* [R365] SONDA OFFLINE — mide el hueco del bucle ejecutando el codigo REAL de app.js.
   ───────────────────────────────────────────────────────────────────────────────────────────────────────────
   No es una copia a mano: extrae de `app.js` el texto de `srcT`, `seqDur`, `duracionFuente` y `acotarBucle` y
   los EJECUTA. Una reimplementacion seria un gemelo que diverge — el defecto que este repositorio repite mas.
   Mismo precedente que R346c, que ya midio `srcT` fuera de la aplicacion.

   Que mide: recorre una vuelta completa del bucle fotograma a fotograma y cuenta en cuantos instantes NO hay
   ningun hijo de la composicion que dibujar. Eso es, literalmente, un fotograma en negro en pantalla.
   Caso: el de «Ring 137» del proyecto de domo — contenido 5 s, bucle 5 s, inP 2,873.

   Uso:  node scratchpad/r365-srct-offline.mjs
*/
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = fs.readFileSync(path.join(RAIZ, 'app.js'), 'utf8');

/* Extrae `function <nombre>(...){...}` contando llaves. Si el recuento no cuadra, se aborta: preferimos no
   medir a medir sobre un trozo mal cortado. */
function extraer(nombre){
  const rx = new RegExp('function\\s+' + nombre + '\\s*\\(', 'g');
  const m = rx.exec(SRC);
  if(!m) throw new Error('no encuentro function ' + nombre + '() en app.js');
  let i = SRC.indexOf('{', m.index), prof = 0, ini = i;
  for(; i < SRC.length; i++){
    const ch = SRC[i];
    if(ch === '{') prof++;
    else if(ch === '}'){ prof--; if(!prof){ i++; break; } }
  }
  if(prof !== 0) throw new Error('las llaves de ' + nombre + '() no cuadran');
  return SRC.slice(m.index, i);
}

const FUENTES = ['seqDur','duracionFuente','acotarBucle','srcT'].map(extraer);
console.log('· extraidas de app.js:', ['seqDur','duracionFuente','acotarBucle','srcT'].join(', '));

/* El minimo que esas cuatro funciones tocan del resto del programa. */
const PRELUDIO = `
  let _MEDIA = [], _PAREJA = null;
  function isSeqMedia(m){ return !!(m && m.kind === 'nest'); }
  function mediaById(id){ return _MEDIA.find(m => m.id === id); }
  function linkPartner(c){ return (_PAREJA && _PAREJA.de === c) ? _PAREJA.a : null; }
`;
const armar = new Function(PRELUDIO + FUENTES.join('\n') + `
  return { srcT, acotarBucle, seqDur, duracionFuente,
           setMedia(a){ _MEDIA = a; }, setPareja(de, a){ _PAREJA = de ? {de, a} : null; } };`);
const API = armar();

/* ── El caso ────────────────────────────────────────────────────────────────────────────────────────────── */
const CONTENIDO = 5.0, BUCLE = 5.0, IN_MALO = 2.873;
const NIDO = { id: 900, kind: 'nest', name: 'Anillo', dur: CONTENIDO, nestClips: [
  { id: 811, start: 0, dur: CONTENIDO }, { id: 812, start: 0, dur: CONTENIDO } ] };
API.setMedia([NIDO]);
const nuevoClip = inP => ({ id: 820, mediaId: 900, start: 10, dur: 40, inP, loop: true, loopLen: BUCLE, speed: 1 });

/* Una vuelta entera a 60 fps: ¿cuantos instantes se quedan sin nada que componer? */
function censo(c){
  const paso = 1/60; let vacios = 0, total = 0, ltMax = -1, primerVacio = null;
  for(let k = 0; k < Math.round(c.loopLen/paso); k++){
    const t = c.start + k*paso, lt = API.srcT(c, t);
    if(lt > ltMax) ltMax = lt;
    const n = NIDO.nestClips.filter(h => lt >= h.start && lt < h.start + h.dur).length;
    total++;
    if(!n){ vacios++; if(primerVacio === null) primerVacio = +lt.toFixed(3); }
  }
  return { total, vacios, pct: +(100*vacios/total).toFixed(1), ltMax: +ltMax.toFixed(3), primerVacio };
}

const fallos = [];
const exigir = (ok, msg) => { console.log((ok ? '  ✔ ' : '  ✘ ') + msg); if(!ok) fallos.push(msg); };

console.log('\ncontenido %ss · bucle %ss · inP %s  →  ventana [%s · %s)',
  CONTENIDO, BUCLE, IN_MALO, IN_MALO, +(IN_MALO+BUCLE).toFixed(3));

console.log('\n[1] ANTES del guardian (el estado que trae el .isp)');
const antes = censo(nuevoClip(IN_MALO));
console.log('   ', JSON.stringify(antes));
exigir(antes.vacios > 0, 'se ven fotogramas VACIOS: ' + antes.vacios + ' de ' + antes.total + ' (' + antes.pct + '% de cada vuelta)');
exigir(antes.ltMax > CONTENIDO, 'el bucle pide material mas alla del contenido (' + antes.ltMax + ' > ' + CONTENIDO + ')');
exigir(antes.primerVacio !== null && Math.abs(antes.primerVacio - CONTENIDO) < 0.05,
  'y el hueco empieza justo donde se acaba el contenido (' + antes.primerVacio + ' ≈ ' + CONTENIDO + ')');

console.log('\n[2] DESPUES del guardian');
const c = nuevoClip(IN_MALO);
const toco = API.acotarBucle(c);
console.log('    acotarBucle → tocado:', toco, '· inP:', IN_MALO, '→', c.inP, '· loopLen:', c.loopLen);
const desp = censo(c);
console.log('   ', JSON.stringify(desp));
exigir(toco === true, 'el guardian reconoce la ventana desbordada y la corrige');
exigir(c.loopLen === BUCLE, 'CONSERVA el ciclo de ' + BUCLE + ' s (no lo recorta para que quepa) — es ' + c.loopLen);
exigir(c.inP === 0, 'desliza `inP` a 0, que es donde la ventana cabe justa — es ' + c.inP);
exigir(desp.vacios === 0, 'y ya no queda NI UN fotograma vacio en toda la vuelta — hay ' + desp.vacios);
exigir(desp.ltMax <= CONTENIDO, 'el instante mas alto que pide ya cabe en el contenido (' + desp.ltMax + ' ≤ ' + CONTENIDO + ')');

console.log('\n[3] el guardian no toca lo que ya estaba bien (no puede "arreglar" de mas)');
const sano = nuevoClip(0);
exigir(API.acotarBucle(sano) === false, 'un clip con la ventana dentro se deja en paz');
exigir(sano.inP === 0 && sano.loopLen === BUCLE, 'y sale intacto');

console.log('\n[4] ciclo MAS LARGO que la fuente entera: ahi si hay que acotar el ciclo');
const largo = { id: 821, mediaId: 900, start: 0, dur: 20, inP: 0, loop: true, loopLen: 12, speed: 1 };
API.acotarBucle(largo);
exigir(Math.abs(largo.loopLen - CONTENIDO) < 1e-6, 'el ciclo baja a la duracion de la fuente (' + largo.loopLen + ')');
exigir(largo.inP === 0, 'y la entrada se queda en 0');

console.log('\n[5] medio sin duracion conocida: no se toca nada a ciegas');
API.setMedia([{ id: 902, kind: 'video', dur: 0 }]);
const sinDur = { id: 822, mediaId: 902, start: 0, dur: 10, inP: 7, loop: true, loopLen: 5, speed: 1 };
exigir(API.acotarBucle(sinDur) === false && sinDur.inP === 7, 'con `dur` 0 (medio aun sin cargar) el guardian se abstiene');

console.log('\n[6] [R365b] un nido VACIO no tiene duracion conocida — `seqDur` la INVENTA (suelo 0,1 s)');
API.setMedia([{ id: 903, kind: 'nest', name: 'Nido vacio', nestClips: [] }]);
const vacio = { id: 823, mediaId: 903, start: 0, dur: 20, inP: 0, loop: true, loopLen: 5, speed: 1 };
exigir(API.duracionFuente(mediaVacio()) === 0, '`duracionFuente` devuelve 0 para un nido sin clips, no el suelo 0,1 de seqDur');
exigir(API.acotarBucle(vacio) === false && vacio.loopLen === 5,
  'y el guardian se abstiene: el ciclo de 5 s NO se machaca a 0,1 s — es ' + vacio.loopLen);
function mediaVacio(){ return { id: 903, kind: 'nest', nestClips: [] }; }

console.log('\n[7] [R365b] al acortar el ciclo, la mitad de audio enlazada va con el');
API.setMedia([NIDO]);
const video = { id: 830, mediaId: 900, start: 0, dur: 20, inP: 0, loop: true, loopLen: 12, speed: 1 };
const audio = { id: 831, mediaId: 900, start: 0, dur: 20, inP: 0, loop: true, loopLen: 12, speed: 1 };
API.setPareja(video, audio);
API.acotarBucle(video);
API.setPareja(null);
exigir(Math.abs(video.loopLen - CONTENIDO) < 1e-6, 'el video baja a ' + video.loopLen + ' s');
exigir(Math.abs(audio.loopLen - video.loopLen) < 1e-6,
  'y el audio le sigue (' + audio.loopLen + '): dos periodos distintos separarian imagen y sonido en cada vuelta');

console.log('\n[8] [R366b] CORTAR un clip en bucle: la mitad derecha avanza `inP` y hereda `loopLen`');
/* Forma exacta de lo que hace `razorCore`: c2 = {...c, start:corte, dur:resto, inP: inP + left*speed} */
const bucle30 = { id: 840, mediaId: 900, start: 0, dur: 30, inP: 0, loop: true, loopLen: CONTENIDO, speed: 1 };
const left = 3;
const mitadDer = { ...bucle30, id: 841, start: left, dur: bucle30.dur - left, inP: (bucle30.inP||0) + left*(bucle30.speed||1) };
const antesCorte = censo({ ...mitadDer, loopLen: mitadDer.loopLen });
console.log('    sin guardian: inP', mitadDer.inP, '· ciclo', mitadDer.loopLen, '→', JSON.stringify(antesCorte));
exigir(antesCorte.vacios > 0, 'sin el guardian la mitad derecha se ve VACIA ' + antesCorte.pct + '% de cada vuelta');
API.acotarBucle(mitadDer);
const despCorte = censo(mitadDer);
exigir(mitadDer.inP === 0 && despCorte.vacios === 0,
  'con el guardian la ventana vuelve a caber y no queda ni un fotograma vacio (inP ' + mitadDer.inP + ')');
exigir(mitadDer.loopLen === CONTENIDO, 'y el ciclo se conserva en ' + mitadDer.loopLen + ' s');

console.log('\n[9] [R366b] entrada NEGATIVA (recorte izquierdo de un clip en bucle, que no lleva suelo)');
const neg = { id: 842, mediaId: 900, start: 0, dur: 20, inP: -1.4, loop: true, loopLen: CONTENIDO, speed: 1 };
exigir(API.acotarBucle(neg) === true && neg.inP === 0, 'el guardian la sube a 0 — es ' + neg.inP);

console.log('\n' + (fallos.length ? '✘ ' + fallos.length + ' comprobacion(es) en rojo' : '✔ todo verde'));
process.exit(fallos.length ? 1 : 0);
