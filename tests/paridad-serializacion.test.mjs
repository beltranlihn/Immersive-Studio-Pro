/* [R311 · endurecido en R315 · rehecho en R320] PARIDAD serProject ↔ resetProjDefaults — el test que cierra una
   familia entera.
   ────────────────────────────────────────────────────────────────────────────────────────────────
   La familia: «heredar del proyecto anterior». Un campo que `serProject` ESCRIBE en el `.isp` pero que nadie
   devuelve a fábrica al empezar un proyecto nuevo se cuela del proyecto abierto al siguiente, y al guardar
   queda fijado ahí. Ha aparecido CINCO veces, cada una encontrada a mano y por casualidad:
     · R242  — seqMode/seqCov: un `.isp` legacy creaba su secuencia con el modo de la SALA anterior, y guardarlo
               CORROMPÍA el archivo.
     · R242b — `inlineCurves`: la misma familia, escapada del propio arreglo de R242.
     · R240b — el zoom de la línea de tiempo.
     · R311  — `autoItems` y `exportPresets`.
     · R315  — `fps`. Y éste lo encontró un repaso de código, NO este test: es el que obligó a endurecerlo.

   QUÉ COMPRUEBA, Y POR QUÉ ASÍ (R320). Se comparan FUENTES DE DATOS, no nombres de clave. Para cada campo del
   objeto que devuelve `serProject` se miran los `state.X` que aparecen en su VALOR, y se exige que cada uno de
   ellos reciba un valor de fábrica. Comparar nombres de clave no servía: `inlineCurves` se guarda dentro del
   bloque `tl` (o sea, como `tl.inlineCurves`) pero vive en `state.inlineCurves`, así que por nombre nunca
   casaban — y la regla «si el bloque padre se reasigna entero, doy por cubiertos sus hijos» tapaba el desajuste
   dando por buenas TODAS las claves de `tl`, incluida la única que la cabecera cita como motivo de existir.
   Mirando el valor, `tl:{…inlineCurves:!!state.inlineCurves…}` exige `state.inlineCurves`, que es lo correcto.
   Como efecto secundario desaparecen dos exentos: los campos con valor literal (`app:'DomeStudioPro'`, `v:3`)
   no leen nada de `state` y ya no hay nada que exigirles.

   LAS TRES VÍAS DE FALSO APROBADO QUE SE CERRARON EN R315, y siguen cerradas:
     1. `cuerpoDe` contaba llaves sobre el fuente CRUDO y limpiaba los comentarios DESPUÉS. Una llave
        desbalanceada dentro de un comentario —y el estilo de la casa comenta citando esquemas como
        `{param,mode,speed}`— hacía que el cuerpo se sobre-leyera hasta la función siguiente y arrastrase SUS
        asignaciones: el conjunto «reseteado» crecía y el test aprobaba aunque `resetProjDefaults` estuviera
        vacío. Las guardas de tamaño mínimo sólo detectaban la sub-lectura, nunca la sobre-lectura.
     2. El patrón de reseteo aceptaba asignaciones CONDICIONALES (`if(fps)state.fps=fps`) y hasta
        comparaciones (`state.x==='dome'` casa con `state\.(\w+)\s*=`). Así daba `fps` por cubierto cuando no
        lo estaba — un bug vivo, enmascarado por su propio test.
        [R320] Aquel filtro sólo miraba la sentencia, así que un `if` CON LLAVES —`if(x){ state.foo=1; }`, que
        es como se escribe casi siempre— se le escapaba entero. Ahora sube por los bloques que envuelven a la
        asignación y descarta la que cuelgue de un `if`/`else`/`for`/`while`/`switch`/`catch`.
     3. Sólo leía las claves de PRIMER nivel, así que el bloque `tl:{…}` quedaba sin comprobar.

   Cada una lleva su aserción propia —los «delatores»— para que el análisis se delate si se rompe, incluido un
   delator EN POSITIVO: un filtro que rechazara todo también daría un test verde y vacío.

   SI ESTE TEST FALLA: acabas de añadir al `.isp` un campo cuyo origen en `state` no tiene valor de fábrica.
   Asígnalo SIN CONDICIÓN en `resetProjDefaults` (el sitio bueno: por ahí pasan los tres caminos) o, si de
   verdad debe sobrevivir a un proyecto nuevo, apúntalo en EXENTOS con el motivo escrito.

   Uso:  npm test        (o: node --test "tests/*.test.mjs" — `node --test tests/` NO funciona en Node 25)
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = fs.readFileSync(path.join(RAIZ, 'app.js'), 'utf8');

/* Campos de `state` que se serializan y que NO deben resetearse, cada uno con su motivo.
   Vivir aquí es una decisión consciente, no un descuido: si añades uno, escribe por qué. */
const EXENTOS = new Map([
  ['clips',   'los vacia `newProject` por su cuenta antes de llamar a resetProjDefaults'],
  ['media',   'idem: el ciclo de vida de los medios (texturas, decodificadores) se libera aparte'],
  ['lanes',   'se reconstruyen con defLanes(), que es su valor de fabrica'],
  ['markers', 'lo vacia `newProject`'],
  ['groups',  'lo vacia `newProject`'],
]);

/* ── Léxico ────────────────────────────────────────────────────────────────────────────────────────────────
   Quitar comentarios, CADENAS y EXPRESIONES REGULARES antes de tocar nada. Los tres importan por lo mismo: un
   `{` o una comilla dentro de cualquiera de ellos descuadraría el recuento. Se sustituyen por espacios para no
   mover los índices.
   [R320] Las regex faltaban, y son el caso más traicionero de los tres: app.js está lleno de patrones como
   `/['"]/` o `/\{/`, y una comilla dentro de una regex abría una «cadena» que se comía todo hasta la comilla
   siguiente —potencialmente funciones enteras— sin que nada lo delatara. Para saber si un `/` abre regex o es
   una división se mira el último carácter con contenido: tras un identificador, un número, `)` o `]` es
   división; en cualquier otro sitio, regex. */
function finCadena(src, i){                 // i = la comilla de apertura (' o ")
  const q = src[i]; let j = i + 1;
  while (j < src.length && src[j] !== q) { if (src[j] === '\\') j++; j++; }
  return Math.min(j + 1, src.length);
}
/* Una plantilla y sus interpolaciones, con ANIDAMIENTO. Es lo que faltaba: `${cond?`a`:`b`}` es el pan de cada
   día de los constructores de HTML de app.js, y cerrar la plantilla en la primera comilla invertida interior
   dejaba el resto del texto —comillas, llaves y todo— leyéndose como si fuera código. */
function finPlantilla(src, i){              // i = la comilla invertida de apertura
  let j = i + 1;
  while (j < src.length) {
    const e = src[j];
    if (e === '\\') { j += 2; continue; }
    if (e === '`') return j + 1;
    if (e === '$' && src[j + 1] === '{') { j = finInterp(src, j + 2); continue; }
    j++;
  }
  return src.length;
}
function finInterp(src, j){                 // j = justo tras `${`; devuelve el índice tras su `}`
  let prof = 1;
  while (j < src.length) {
    const e = src[j];
    if (e === '\\') { j += 2; continue; }
    if (e === '`') { j = finPlantilla(src, j); continue; }
    if (e === "'" || e === '"') { j = finCadena(src, j); continue; }
    if (e === '{') prof++;
    else if (e === '}') { prof--; if (!prof) return j + 1; }
    j++;
  }
  return src.length;
}
function limpiar(src){
  let out = '', i = 0, ult = '';
  const blanco = t => { out += t.replace(/[^\n]/g, ' '); };   // conserva los saltos de línea
  const saltar = fin => { blanco(src.slice(i, fin)); i = fin; };
  while (i < src.length) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '*') { const j = src.indexOf('*/', i + 2); saltar(j < 0 ? src.length : j + 2); continue; }
    if (c === '/' && d === '/') { const j = src.indexOf('\n', i); saltar(j < 0 ? src.length : j); continue; }
    if (c === "'" || c === '"') { saltar(finCadena(src, i)); ult = c; continue; }
    if (c === '`') { saltar(finPlantilla(src, i)); ult = '`'; continue; }
    if (c === '/' && !/[\w$)\]]/.test(ult)) {
      let j = i + 1, clase = false, ok = false;
      for (; j < src.length; j++) {
        const e = src[j];
        if (e === '\\') { j++; continue; }
        if (e === '\n') break;                       // una regex no cruza la línea: era una división rara
        if (e === '[') clase = true;
        else if (e === ']') clase = false;
        else if (e === '/' && !clase) { ok = true; break; }
      }
      if (ok) { while (j + 1 < src.length && /[a-z]/.test(src[j + 1])) j++;   // las banderas (gimsuy)
        saltar(j + 1); ult = '/'; continue; }
    }
    out += c; if (!/\s/.test(c)) ult = c;
    i++;
  }
  return out;
}
const LIMPIO = limpiar(SRC);
/* Delatores del limpiado, que es de lo que cuelga todo lo demás. Si se descuadran las llaves de un fichero que
   Node ejecuta sin quejarse, es que el limpiado se ha comido algo. */
test('el limpiado lexico no deforma app.js', () => {
  assert.equal(LIMPIO.length, SRC.length, 'limpiar() ha movido los indices: se sustituye por espacios, no se borra');
  assert.equal((LIMPIO.match(/\{/g) || []).length, (LIMPIO.match(/\}/g) || []).length,
    'tras limpiar, las llaves de app.js no cuadran: el analisis se comio (o dejo) algo — mira cadenas y regex');
  assert.equal((LIMPIO.match(/\(/g) || []).length, (LIMPIO.match(/\)/g) || []).length,
    'tras limpiar, los parentesis de app.js no cuadran: idem');
  assert.ok(!/['"`]/.test(LIMPIO), 'han sobrevivido comillas al limpiado: alguna cadena no se ha reconocido');
});

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
  assert.ok(!/\bfunction\s+[A-Za-z_$][\w$]*\s*\(/.test(cuerpo.replace(/=>/g, '')),
    'el cuerpo extraido de ' + nombre + '() contiene otra declaracion `function`: se ha sobre-leido');
  return cuerpo;
}

/* Los `state.X` / `state.X.Y` que aparecen en una expresión: de dónde sale el dato que se guarda. */
function fuentesDe(expr){
  const out = new Set();
  const rx = /\bstate\.([A-Za-z_$][\w$]*)(?:\.([A-Za-z_$][\w$]*))?/g;
  let m;
  while ((m = rx.exec(expr))) out.add(m[2] ? m[1] + '.' + m[2] : m[1]);
  return out;
}

/* Descompone un objeto literal en campos `clave → expresión de valor`, bajando a los literales anidados
   (`tl:{bpm:…}` da `tl` y `tl.bpm`). Un campo cuyo valor es OTRO literal no reclama fuentes propias: las
   reclaman sus hijos, uno a uno. */
function camposDe(lit, prefijo){
  const out = [];
  const seg = []; let cur = '', prof = 0;
  for (let i = 1; i < lit.length - 1; i++) {
    const c = lit[i];
    if (c === '{' || c === '[' || c === '(') prof++;
    else if (c === '}' || c === ']' || c === ')') prof--;
    if (prof === 0 && c === ',') { seg.push(cur); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) seg.push(cur);
  for (const s of seg) {
    const m = /^\s*([A-Za-z_$][\w$]*)\s*:([\s\S]*)$/.exec(s);
    if (!m) continue;
    const clave = (prefijo ? prefijo + '.' : '') + m[1], val = m[2];
    if (/^\s*\{/.test(val)) { out.push({ clave, fuentes: new Set() }); for (const x of camposDe(val.trim(), clave)) out.push(x); }
    else out.push({ clave, fuentes: fuentesDe(val) });
  }
  return out;
}

/* ¿La asignación que está en `idx` cuelga de una condición? Se mira su propia sentencia Y los bloques que la
   envuelven, porque el `if` con llaves —el caso normal— no deja rastro dentro de la sentencia. */
function esCondicional(cuerpo, idx){
  const ini = Math.max(0, cuerpo.lastIndexOf(';', idx), cuerpo.lastIndexOf('{', idx), cuerpo.lastIndexOf('}', idx));
  if (/\bif\s*\(|\?|&&|\|\|/.test(cuerpo.slice(ini, idx))) return true;
  let prof = 0;
  for (let i = idx; i-- > 0;) {
    const c = cuerpo[i];
    if (c === '}') prof++;
    else if (c === '{') {
      if (prof) { prof--; continue; }
      const cab = cuerpo.slice(Math.max(0, i - 300), i);
      /* Bloques que PUEDEN no ejecutarse. `try{…}` no está: su cuerpo corre siempre. */
      if (/\b(if|for|while|switch|catch)\s*\([^()]*\)\s*$/.test(cab) || /\belse\s*$/.test(cab)) return true;
    }
  }
  return false;
}

/* Asignaciones `state.X=` / `state.X.Y=` incondicionales: las que son un valor de fábrica de verdad. */
function reseteosDe(cuerpo){
  const out = new Set();
  const rx = /\bstate\.([A-Za-z_$][\w$]*)(?:\.([A-Za-z_$][\w$]*))?\s*=(?!=)/g;
  let m;
  while ((m = rx.exec(cuerpo))) {
    if (esCondicional(cuerpo, m.index)) continue;
    out.add(m[1]);
    if (m[2]) out.add(m[1] + '.' + m[2]);
  }
  return out;
}

test('todo dato que serProject escribe tiene valor de fabrica al crear un proyecto', () => {
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
  const campos = camposDe(lit, '');
  assert.ok(campos.length > 15, 'solo he leido ' + campos.length + ' campos de serProject: el analisis se ha roto');
  /* El análisis TIENE que ver dentro de `tl`, y ver de dónde sale cada valor. Si dejara de bajar un nivel,
     `inlineCurves` (R242b) volvería a quedar sin vigilar y el test aprobaría con la fuga puesta. */
  assert.ok(campos.some(c => c.clave.startsWith('tl.')),
    'el analisis ya no lee las claves anidadas de `tl`: el bloque que contiene inlineCurves quedaria sin comprobar');
  assert.ok(campos.some(c => c.fuentes.has('inlineCurves')),
    'el analisis ya no ve que `tl.inlineCurves` se lee de `state.inlineCurves`: volveria a compararse por NOMBRE, ' +
    'que es lo que daba por cubierto todo el bloque `tl`');

  const resetea = new Set();
  for (const fn of ['resetProjDefaults', 'newProject', 'newRoomProject']) for (const k of reseteosDe(cuerpoDe(fn))) resetea.add(k);
  assert.ok(resetea.size > 10, 'solo he leido ' + resetea.size + ' reseteos: el analisis se ha roto');
  /* Delatores del filtro de condicionales, en las dos direcciones. */
  assert.ok(!reseteosDe('if(fps)state.__p=fps;').has('__p'),
    'el filtro de condicionales ha dejado de ver el `if` sin llaves: el test volveria a dar falsos aprobados');
  assert.ok(!reseteosDe('function f(){ if(fps){ state.__p=fps; } }').has('__p'),
    'el filtro de condicionales no ve el `if` CON LLAVES, que es como se escribe casi siempre (R320)');
  assert.ok(reseteosDe('function f(){ state.__p=1; }').has('__p'),
    'el filtro se ha vuelto tan estricto que ya no reconoce una asignacion normal: daria un test verde y vacio');

  const cubierto = f => resetea.has(f) || EXENTOS.has(f) ||
    (f.includes('.') && (resetea.has(f.split('.')[0]) || EXENTOS.has(f.split('.')[0])));
  const huerfanos = [];
  for (const c of campos) for (const f of c.fuentes) if (!cubierto(f)) huerfanos.push(c.clave + ' ← state.' + f);
  assert.deepEqual([...new Set(huerfanos)].sort(), [],
    'Estos datos se GUARDAN en el .isp pero su origen en `state` no vuelve a fabrica al crear un proyecto, asi\n' +
    '   que se heredan del proyecto anterior y quedan fijados en el archivo nuevo:\n     ' +
    [...new Set(huerfanos)].sort().join('\n     ') +
    '\n   Arreglo: asignarlos SIN CONDICION en resetProjDefaults(). Si alguno debe sobrevivir a proposito,\n' +
    '   apuntalo en EXENTOS de este test con el motivo. Ver PLAN.md › ROUND 311, 315 y 320.');
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
