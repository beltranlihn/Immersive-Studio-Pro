/* [R311 · endurecido en R315] PARIDAD serProject ↔ resetProjDefaults — el test que cierra una familia entera.
   ────────────────────────────────────────────────────────────────────────────────────────────────
   La familia: «heredar del proyecto anterior». Un campo que `serProject` ESCRIBE en el `.isp` pero que nadie
   devuelve a fábrica al empezar un proyecto nuevo se cuela del proyecto abierto al siguiente, y al guardar
   queda fijado ahí. Ha aparecido CINCO veces, cada una encontrada a mano y por casualidad:
     · R242  — seqMode/seqCov: un `.isp` legacy creaba su secuencia con el modo de la SALA anterior, y guardarlo
               CORROMPÍA el archivo.
     · R242b — `inlineCurves`: la misma familia, escapada del propio arreglo de R242.
     · R240b — el zoom de la línea de tiempo.
     · R310  — `autoItems` y `exportPresets`.
     · R315  — `fps`. Y éste lo encontró un repaso de código, NO este test: es el que obligó a endurecerlo.

   POR QUÉ SE ENDURECIÓ (R315). La primera versión podía dar FALSOS APROBADOS por tres vías, y una estaba viva:
     1. `cuerpoDe` contaba llaves sobre el fuente CRUDO y limpiaba los comentarios DESPUÉS. Una llave
        desbalanceada dentro de un comentario —y el estilo de la casa comenta citando esquemas como
        `{param,mode,speed}`— hacía que el cuerpo se sobre-leyera hasta la función siguiente y arrastrase SUS
        asignaciones: el conjunto «reseteado» crecía y el test aprobaba aunque `resetProjDefaults` estuviera
        vacío. Las guardas de tamaño mínimo sólo detectaban la sub-lectura, nunca la sobre-lectura.
     2. El patrón de reseteo aceptaba asignaciones CONDICIONALES (`if(fps)state.fps=fps`) y hasta
        comparaciones (`state.x==='dome'` casa con `state\.(\w+)\s*=`). Así daba `fps` por cubierto cuando no
        lo estaba — un bug vivo, enmascarado por su propio test.
     3. Sólo leía las claves de PRIMER nivel, así que el bloque `tl:{…}` quedaba sin comprobar… justo donde
        vive `inlineCurves`, que la cabecera cita como motivo de existir.
   Las tres están cerradas abajo, y cada una lleva su aserción propia para que el análisis se delate si se rompe.

   SI ESTE TEST FALLA: acabas de añadir un campo al `.isp` sin darle valor de fábrica. Añádelo a
   `resetProjDefaults` (el sitio bueno: por ahí pasan los tres caminos) o, si de verdad debe sobrevivir a un
   proyecto nuevo, apúntalo en EXENTOS con el motivo escrito.

   Uso:  npm test        (o: node --test "tests/*.test.mjs" — `node --test tests/` NO funciona en Node 25)
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = fs.readFileSync(path.join(RAIZ, 'app.js'), 'utf8');

/* Campos que se serializan y que NO deben resetearse, cada uno con su motivo.
   Vivir aquí es una decisión consciente, no un descuido: si añades uno, escribe por qué. */
const EXENTOS = new Map([
  ['app',     'firma del formato ("DomeStudioPro"), constante literal del serializador'],
  ['v',       'numero de version del formato, constante literal del serializador'],
  ['clips',   'los vacia `newProject` por su cuenta antes de llamar a resetProjDefaults'],
  ['media',   'idem: el ciclo de vida de los medios (texturas, decodificadores) se libera aparte'],
  ['lanes',   'se reconstruyen con defLanes(), que es su valor de fabrica'],
  ['markers', 'lo vacia `newProject`'],
  ['groups',  'lo vacia `newProject`'],
]);

/* ── Léxico ────────────────────────────────────────────────────────────────────────────────────────────────
   Quitar comentarios y CADENAS antes de tocar nada. Las cadenas importan tanto como los comentarios: un `{`
   dentro de un literal descuadraría el recuento igual. Se sustituyen por espacios para no mover los índices. */
function limpiar(src){
  let out = '', i = 0;
  const blanco = t => out += t.replace(/[^\n]/g, ' ');   // conserva los saltos de línea
  while (i < src.length) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '*') { const j = src.indexOf('*/', i + 2); const fin = j < 0 ? src.length : j + 2; blanco(src.slice(i, fin)); i = fin; continue; }
    if (c === '/' && d === '/') { const j = src.indexOf('\n', i); const fin = j < 0 ? src.length : j; blanco(src.slice(i, fin)); i = fin; continue; }
    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1;
      while (j < src.length && src[j] !== c) { if (src[j] === '\\') j++; j++; }
      blanco(src.slice(i, Math.min(j + 1, src.length))); i = j + 1; continue;
    }
    out += c; i++;
  }
  return out;
}
const LIMPIO = limpiar(SRC);

/* Cuerpo de una función, contando llaves sobre el fuente YA LIMPIO. */
function cuerpoDe(nombre){
  const cab = new RegExp('function\\s+' + nombre + '\\s*\\([^)]*\\)\\s*\\{');
  const m = cab.exec(LIMPIO);
  assert.ok(m, 'no encuentro la funcion ' + nombre + '() en app.js');
  let i = m.index + m[0].length, prof = 1;
  const ini = i;
  for (; i < LIMPIO.length && prof > 0; i++) {
    const c = LIMPIO[i];
    if (c === '{') prof++;
    else if (c === '}') prof--;
  }
  const cuerpo = LIMPIO.slice(ini, i - 1);
  /* Delator de SOBRE-lectura: si el recuento se descuadra, el cuerpo se come la función siguiente y el test
     empezaria a dar por reseteado medio fichero. Es exactamente el fallo que R315 vino a cerrar. */
  assert.ok(prof === 0, 'las llaves de ' + nombre + '() no cuadran: el analisis de este test se ha roto');
  assert.ok(!/\bfunction\s+[A-Za-z_$][\w$]*\s*\(/.test(cuerpo.slice(0, cuerpo.length).replace(/=>/g, '')) || nombre === 'loadProject',
    'el cuerpo extraido de ' + nombre + '() contiene otra declaracion `function`: se ha sobre-leido');
  return cuerpo;
}

/* Claves de un objeto literal, incluidas las de UN nivel anidado (`tl:{bpm:…}` → `tl` y `tl.bpm`). */
function clavesDe(lit, prefijo){
  const out = new Set();
  let p = 0, esperaClave = true;
  for (let i = 1; i < lit.length; i++) {
    const c = lit[i];
    if (c === '{' || c === '[' || c === '(') { p++; continue; }
    if (c === '}' || c === ']' || c === ')') { p--; continue; }
    if (p === 0 && c === ',') { esperaClave = true; continue; }
    if (p === 0 && esperaClave && /[A-Za-z_$]/.test(c)) {
      const resto = lit.slice(i);
      const k = /^([A-Za-z_$][\w$]*)\s*:/.exec(resto);
      const id = /^[A-Za-z_$][\w$]*/.exec(resto)[0];
      if (k) {
        const nombre = (prefijo ? prefijo + '.' : '') + k[1];
        out.add(nombre);
        /* ¿el valor es OTRO objeto literal? entonces se baja un nivel (`tl.bpm`, `tl.inlineCurves`…) */
        const tras = resto.slice(k[0].length);
        if (/^\s*\{/.test(tras) && !prefijo) {
          const abre = i + k[0].length + tras.indexOf('{');
          let q = 0, sub = '';
          for (let j = abre; j < lit.length; j++) { const e = lit[j];
            if (e === '{') q++; if (q >= 1) sub += e; if (e === '}') { q--; if (q === 0) break; } }
          for (const s of clavesDe(sub, nombre)) out.add(s);
        }
        esperaClave = false;
      }
      i += id.length - 1;
      continue;
    }
    if (p === 0 && !/\s/.test(c)) esperaClave = false;
  }
  return out;
}

/* Asignaciones `state.X=` / `state.X.Y=` que NO están bajo condición. Se mira hacia atrás hasta el principio
   de la sentencia: si por el camino hay un `if(`, un `?` o un `&&`, la asignación no es incondicional y no
   cuenta como valor de fábrica — que es justo lo que dejaba pasar `fps`. */
function reseteosDe(cuerpo){
  const out = new Set();
  const rx = /\bstate\.([A-Za-z_$][\w$]*)(?:\.([A-Za-z_$][\w$]*))?\s*=(?!=)/g;
  let m;
  while ((m = rx.exec(cuerpo))) {
    const ini = Math.max(0, cuerpo.lastIndexOf(';', m.index), cuerpo.lastIndexOf('{', m.index), cuerpo.lastIndexOf('}', m.index));
    const previo = cuerpo.slice(ini, m.index);
    if (/\bif\s*\(|\?|&&|\|\|/.test(previo)) continue;   // condicional: no es un valor de fabrica
    out.add(m[1]);
    if (m[2]) out.add(m[1] + '.' + m[2]);
  }
  return out;
}

test('todo campo que serProject escribe tiene valor de fabrica al crear un proyecto', () => {
  const ser = cuerpoDe('serProject');
  const r = ser.indexOf('return {');
  assert.ok(r >= 0, 'serProject ya no devuelve un objeto literal — hay que actualizar este test');
  let prof = 0, lit = '';
  for (let i = r + 'return '.length; i < ser.length; i++) {
    const c = ser[i];
    if (c === '{') prof++;
    if (prof >= 1) lit += c;
    if (c === '}') { prof--; if (prof === 0) break; }
  }
  const escribe = clavesDe(lit, '');
  assert.ok(escribe.size > 15, 'solo he leido ' + escribe.size + ' claves de serProject: el analisis se ha roto');
  /* El análisis TIENE que ver dentro de `tl`. Si deja de verlo, `inlineCurves` (R242b) volvería a quedar
     sin vigilar y el test aprobaría con la fuga puesta. */
  assert.ok([...escribe].some(k => k.startsWith('tl.')),
    'el analisis ya no lee las claves anidadas de `tl`: el bloque que contiene inlineCurves quedaria sin comprobar');

  const resetea = new Set();
  for (const fn of ['resetProjDefaults', 'newProject', 'newRoomProject']) for (const k of reseteosDe(cuerpoDe(fn))) resetea.add(k);
  assert.ok(resetea.size > 10, 'solo he leido ' + resetea.size + ' reseteos: el analisis se ha roto');
  /* Delator del filtro de condicionales: si dejara de filtrar, `fps` volvería a colarse como cubierto. */
  assert.ok(!reseteosDe('if(fps)state.__prueba=fps;').has('__prueba'),
    'el filtro de asignaciones condicionales ha dejado de funcionar: el test volveria a dar falsos aprobados');

  const huerfanos = [...escribe].filter(k => {
    if (resetea.has(k) || EXENTOS.has(k)) return false;
    if (k.includes('.') && resetea.has(k.split('.')[0])) return false;   // el bloque entero se reasigna
    return true;
  }).sort();
  assert.deepEqual(huerfanos, [],
    'Estos campos se GUARDAN en el .isp pero no vuelven a fabrica al crear un proyecto, asi que se heredan del\n' +
    '   proyecto anterior y quedan fijados en el archivo nuevo:\n     ' + huerfanos.join(', ') +
    '\n   Arreglo: asignarlos SIN CONDICION en resetProjDefaults(). Si alguno debe sobrevivir a proposito,\n' +
    '   apuntalo en EXENTOS de este test con el motivo. Ver PLAN.md › ROUND 311 y ROUND 315.');
});

test('los campos que ya se colaron una vez siguen cubiertos', () => {
  /* Guardia explicita contra la regresion concreta: estos son los miembros conocidos de la familia. Si el
     analisis lexico de arriba se rompiera algun dia, este test seguiria protegiendo los casos reales. */
  const cuerpo = cuerpoDe('resetProjDefaults');
  for (const campo of ['seqMode', 'seqCov', 'inlineCurves', 'autoItems', 'exportPresets', 'fps']) {
    assert.match(cuerpo, new RegExp('state\\.' + campo + '\\s*='),
      'resetProjDefaults ya no devuelve `' + campo + '` a fabrica — es un miembro conocido de la familia ' +
      '«heredar del proyecto anterior» (ver la cabecera de este archivo)');
  }
  assert.match(cuerpo, /state\.tl\.pxPerSec\s*=/,
    'resetProjDefaults ya no devuelve el zoom de la linea de tiempo a fabrica (R240b)');
});
