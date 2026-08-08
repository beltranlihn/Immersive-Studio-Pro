/* [R311] PARIDAD serProject ↔ resetProjDefaults — el test que cierra una familia de fallos entera.
   ────────────────────────────────────────────────────────────────────────────────────────────────
   La familia: «heredar del proyecto anterior». Un campo que `serProject` ESCRIBE en el `.isp` pero que nadie
   devuelve a fabrica al empezar un proyecto nuevo se cuela del proyecto abierto al siguiente, y al guardar
   queda fijado ahi. Ha aparecido CUATRO veces, cada una encontrada a mano y por casualidad:
     · R242  — seqMode/seqCov: un `.isp` legacy creaba su secuencia con el modo de la SALA anterior, y guardarlo
               CORROMPIA el archivo.
     · R242b — `inlineCurves`: la misma familia, escapada del propio arreglo de R242.
     · R240b — el zoom de la linea de tiempo.
     · R310  — `autoItems` y `exportPresets` (auditoria exhaustiva).
   Cada vez se arreglo el miembro, no la familia. Esto comprueba la REGLA: todo campo que se serializa tiene que
   resetearse. Corre en Node, sin navegador y sin dependencias, en milisegundos.

   COMO FUNCIONA. No se puede importar `app.js` (es un script clasico de 14 500 lineas que toca `document` y
   WebGL en su primera linea), asi que se lee como TEXTO y se extraen las dos listas de nombres:
     · lo que ESCRIBE  → las claves del objeto literal que devuelve `serProject`
     · lo que RESETEA  → las asignaciones `state.X=` dentro de `resetProjDefaults` (+ las de los dos creadores
                          de proyecto, `newProject` y `newRoomProject`, que son los caminos que sufren la fuga)
   Es analisis lexico, no ejecucion: no prueba que el valor de fabrica sea el correcto, prueba que ALGUIEN lo
   pone. Es exactamente el descuido que produjo las cuatro apariciones.

   SI ESTE TEST FALLA: acabas de añadir un campo al `.isp` sin darle valor de fabrica. Añadelo a
   `resetProjDefaults` (el sitio bueno: por ahi pasan los tres caminos) o, si de verdad debe sobrevivir a un
   proyecto nuevo, apuntalo en EXENTOS de abajo con el motivo escrito.

   Uso:  node --test tests/
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = fs.readFileSync(path.join(RAIZ, 'app.js'), 'utf8');

/* Campos que se serializan y que NO deben resetearse, cada uno con su motivo.
   Vivir aqui es una decision consciente, no un descuido: si añades uno, escribe por que. */
const EXENTOS = new Map([
  ['app',     'firma del formato ("DomeStudioPro"), constante literal del serializador'],
  ['v',       'numero de version del formato, constante literal del serializador'],
  ['clips',   'los vacia `newProject` por su cuenta antes de llamar a resetProjDefaults'],
  ['media',   'idem: el ciclo de vida de los medios (texturas, decodificadores) se libera aparte'],
  ['lanes',   'se reconstruyen con defLanes(), que es su valor de fabrica'],
  ['markers', 'lo vacia `newProject`'],
  ['groups',  'lo vacia `newProject`'],
]);

/* Extrae el cuerpo de una funcion contando llaves desde su cabecera. Basta para este fichero: las funciones que
   nos interesan no llevan llaves dentro de cadenas ni de expresiones regulares. */
function cuerpoDe(nombre){
  const cab = new RegExp('function\\s+' + nombre + '\\s*\\([^)]*\\)\\s*\\{');
  const m = cab.exec(SRC);
  assert.ok(m, 'no encuentro la funcion ' + nombre + '() en app.js');
  let i = m.index + m[0].length, prof = 1;
  const ini = i;
  for (; i < SRC.length && prof > 0; i++) {
    const c = SRC[i];
    if (c === '{') prof++;
    else if (c === '}') prof--;
  }
  return SRC.slice(ini, i - 1);
}

/* Quita comentarios: un campo NOMBRADO en un comentario no es un campo asignado, y varios de estos bloques
   estan muy comentados (es el estilo de la casa). Sin esto el test daria falsos aprobados. */
const sinComentarios = s => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');

test('todo campo que serProject escribe tiene valor de fabrica al crear un proyecto', () => {
  /* Lo que se ESCRIBE: las claves de primer nivel del literal que devuelve serProject. Se toma el texto entre
     `return {` y el `}` que lo cierra, y se leen las claves a profundidad 1 (`tl:{...}` cuenta como `tl`). */
  const ser = sinComentarios(cuerpoDe('serProject'));
  const r = ser.indexOf('return {');
  assert.ok(r >= 0, 'serProject ya no devuelve un objeto literal — hay que actualizar este test');
  let prof = 0, lit = '';
  for (let i = r + 'return '.length; i < ser.length; i++) {
    const c = ser[i];
    if (c === '{') prof++;
    if (prof >= 1) lit += c;
    if (c === '}') { prof--; if (prof === 0) break; }
  }
  /* Una clave de primer nivel es un identificador seguido de `:` que aparece a profundidad 0 y JUSTO despues
     de `{` o de una coma. Las dos condiciones hacen falta: sin la primera se cuelan las claves de los objetos
     anidados (`tl:{bpm:…}`), y sin la segunda se cuela la rama de un ternario (`a?b:c` daria la clave `b`).
     Las cadenas se saltan enteras — un `:` dentro de un texto no es una clave. */
  const escribe = new Set();
  { let p = 0, esperaClave = true;
    for (let i = 1; i < lit.length; i++) {           // i=1: saltamos la llave de apertura
      const c = lit[i];
      if (c === "'" || c === '"' || c === '`') {      // cadena: hasta su cierre, respetando el escape
        const q = c; i++;
        while (i < lit.length && lit[i] !== q) { if (lit[i] === '\\') i++; i++; }
        esperaClave = false; continue;
      }
      if (c === '{' || c === '[' || c === '(') { p++; continue; }
      if (c === '}' || c === ']' || c === ')') { p--; continue; }
      if (p === 0 && c === ',') { esperaClave = true; continue; }
      if (p === 0 && esperaClave && /[A-Za-z_$]/.test(c)) {
        const resto = lit.slice(i);
        const k = /^([A-Za-z_$][\w$]*)\s*:/.exec(resto);
        const id = /^[A-Za-z_$][\w$]*/.exec(resto)[0];
        if (k) { escribe.add(k[1]); esperaClave = false; }
        i += id.length - 1;                           // saltar el identificador ENTERO, o se leerian sus sufijos
        continue;
      }
      if (p === 0 && !/\s/.test(c)) esperaClave = false;
    }
  }
  assert.ok(escribe.size > 15, 'solo he leido ' + escribe.size + ' claves de serProject: el analisis se ha roto');

  /* Lo que se RESETEA: asignaciones `state.X = …` en los tres puntos de partida de un proyecto. */
  const resetea = new Set();
  for (const fn of ['resetProjDefaults', 'newProject', 'newRoomProject']) {
    const cuerpo = sinComentarios(cuerpoDe(fn));
    for (const m of cuerpo.matchAll(/\bstate\.([A-Za-z_$][\w$]*)\s*=/g)) resetea.add(m[1]);
    /* `state.tl.pxPerSec=…` cuenta como que `tl` se toca; el bloque `tl` se serializa entero. */
    for (const m of cuerpo.matchAll(/\bstate\.([A-Za-z_$][\w$]*)\.[A-Za-z_$][\w$]*\s*=/g)) resetea.add(m[1]);
  }
  assert.ok(resetea.size > 10, 'solo he leido ' + resetea.size + ' reseteos: el analisis se ha roto');

  const huerfanos = [...escribe].filter(k => !resetea.has(k) && !EXENTOS.has(k)).sort();
  assert.deepEqual(huerfanos, [],
    'Estos campos se GUARDAN en el .isp pero no vuelven a fabrica al crear un proyecto, asi que se heredan del\n' +
    '   proyecto anterior y quedan fijados en el archivo nuevo:\n     ' + huerfanos.join(', ') +
    '\n   Arreglo: asignarlos en resetProjDefaults(). Si alguno debe sobrevivir a proposito, apuntalo en EXENTOS\n' +
    '   de este test con el motivo. Ver PLAN.md › ROUND 311.');
});

test('los cuatro campos que ya se colaron una vez siguen cubiertos', () => {
  /* Guardia explicita contra la regresion concreta: estos son los miembros conocidos de la familia. Si el
     analisis lexico de arriba se rompiera algun dia, este test seguiria protegiendo los casos reales. */
  const cuerpo = sinComentarios(cuerpoDe('resetProjDefaults'));
  for (const campo of ['seqMode', 'seqCov', 'inlineCurves', 'autoItems', 'exportPresets']) {
    assert.match(cuerpo, new RegExp('state\\.' + campo + '\\s*='),
      'resetProjDefaults ya no devuelve `' + campo + '` a fabrica — es un miembro conocido de la familia ' +
      '«heredar del proyecto anterior» (ver la cabecera de este archivo)');
  }
  assert.match(cuerpo, /state\.tl\.pxPerSec\s*=/,
    'resetProjDefaults ya no devuelve el zoom de la linea de tiempo a fabrica (R240b)');
});
