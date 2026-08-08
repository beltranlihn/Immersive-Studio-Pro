/* [R320] Lanzador de las REDES de regresión — las sondas que comprueban una REGLA, no un parche suelto.
   Cada una se escribió al cerrar una familia de fallos y sigue viva para que esa familia no vuelva; hasta ahora
   había que acordarse de correrlas una a una, y en R320 dos de ellas llevaban dos rondas sin pasarse.

   No incluye las sondas de una ronda concreta que ya no tienen nada que vigilar: aquí sólo lo que debe seguir
   verde para siempre.

   Uso:  npx electron . --remote-debugging-port=9222   y luego   node scratchpad/correr-redes.mjs
   (o `npm run redes`, que es lo mismo)
*/
import http from 'http';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const REDES = [
  ['r317-undo.mjs',    'un gesto que cambia el proyecto se deshace con un Ctrl+Z'],
  ['r318-caches.mjs',  'si cambia algo de lo que el resultado depende, la caché falla'],
  ['r319-verif.mjs',   'los ocho de la tanda de MEDIA siguen arreglados'],
  ['r320-verif.mjs',   'los gemelos: nada quedó arreglado a medias'],
];

/* Sin app levantada no se distingue «rojo» de «no medido», y esa confusión es justo la que hace inútil una red. */
const vivo = await new Promise(r => {
  const req = http.get({ host: '127.0.0.1', port: 9222, path: '/json/list', timeout: 3000 },
    res => { res.resume(); r(res.statusCode === 200); });
  req.on('error', () => r(false)); req.on('timeout', () => { req.destroy(); r(false); });
});
if (!vivo) {
  console.log('*** la aplicacion no esta escuchando en 127.0.0.1:9222.');
  console.log('    Levantala primero:  npx electron . --remote-debugging-port=9222');
  process.exit(2);
}

const correr = f => new Promise(r => {
  const p = spawn(process.execPath, [path.join(AQUI, f)], { stdio: ['ignore', 'pipe', 'pipe'] });
  let sal = '';
  p.stdout.on('data', d => sal += d); p.stderr.on('data', d => sal += d);
  p.on('close', code => r({ code, sal }));
});

let rojas = 0;
for (const [f, que] of REDES) {
  const { code, sal } = await correr(f);
  const ok = code === 0;
  if (!ok) rojas++;
  console.log((ok ? '  OK  ' : '  ROJA') + '  ' + f.padEnd(18) + '  ' + que);
  if (!ok) console.log(sal.split(/\r?\n/).filter(l => /\*\*\*/.test(l)).map(l => '        ' + l.trim()).join('\n'));
}
console.log('\n' + (rojas ? '*** ' + rojas + ' de ' + REDES.length + ' redes en ROJO (detalle: corre la sonda suelta)'
                          : 'las ' + REDES.length + ' redes en verde'));
process.exit(rojas ? 1 : 0);
