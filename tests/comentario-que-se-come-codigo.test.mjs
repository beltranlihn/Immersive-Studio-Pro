/* [R336] EL COMENTARIO QUE SE COME EL CÓDIGO — una regla, no un recuerdo.
   ────────────────────────────────────────────────────────────────────────────────────────────────────────
   `app.js` empaqueta MUCHAS sentencias por línea física. Eso convierte un comentario `//` puesto a mitad de
   línea en un borrador silencioso: todo lo que va detrás desaparece sin error de sintaxis, sin aviso del
   editor y sin que el `node --check` diga nada, porque el resultado sigue siendo JavaScript válido.

   Ha pasado DOS veces en la misma sesión, las dos veces al anotar un arreglo:
     · R334 — `m._bandsFail=false; // [R334] …` se comió las seis asignaciones siguientes de `replaceMedia`
              (`m.thumb`, `m._texW`, `m._texH`, `m.peaks`, `m.rms`, `m.buffer`). Resultado: reemplazar el
              archivo de un medio dejaba el AudioBuffer VIEJO, y esa banda sonora seguía sonando en la
              previsualización y en el export, y sus bandas se analizaban como si fueran las del archivo nuevo.
     · R336 — al arreglar lo anterior, tres anotaciones más se comieron el resto de sus líneas (entre ellas el
              cuerpo entero de `pickClip`). Esa vez sí saltó el `node --check`, por casualidad: las líneas que
              se comió llevaban llaves de cierre.

   Acordarse de mirar no funciona: son dos veces en un día. Aquí queda la regla — si un comentario de línea
   tiene DETRÁS algo que parece código ejecutable, el test falla y hay que usar un comentario de bloque.

   La heurística es deliberadamente estrecha (una asignación, un `return`, un `const`/`let`, y la línea
   terminando en `;`) para no protestar por prosa que mencione código. Si algún día un comentario legítimo la
   dispara, la respuesta correcta es cambiarlo a `/* … *\/`: en este fichero eso es siempre más seguro.
*/
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');

/* `//` que no sea `://` (una URL) ni el principio de `/*`, seguido de algo con pinta de sentencia y un `;` al
   final de la línea. */
const SOSPECHA = /(?<!:)\/\/(?![/*]).*?(?:[A-Za-z_$][\w$.[\]]*\s*=\s*[^=]|\breturn\b|\bconst\b|\blet\b).*?;\s*$/;

for (const fichero of ['app.js', 'main.js', 'preload.js']) {
  test(`${fichero}: ningún comentario de línea se come código`, () => {
    const texto = readFileSync(join(raiz, fichero), 'utf8');
    const culpables = [];
    texto.split('\n').forEach((linea, i) => {
      const t = linea.trim();
      if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return; // comentario de pleno derecho
      const m = SOSPECHA.exec(linea);
      if (m) culpables.push(`${fichero}:${i + 1}  ${linea.slice(m.index, m.index + 120).trim()}`);
    });
    assert.deepStrictEqual(culpables, [],
      'Un comentario de línea deja código ejecutable detrás — en este fichero eso lo BORRA en silencio.\n' +
      'Usa un comentario de bloque:\n  ' + culpables.join('\n  '));
  });
}
