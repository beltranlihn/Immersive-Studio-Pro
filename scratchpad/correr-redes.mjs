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
import fs from 'node:fs';
import { fileURLToPath } from 'url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const REDES = [
  ['r317-undo.mjs',    'un gesto que cambia el proyecto se deshace con un Ctrl+Z'],
  ['r318-caches.mjs',  'si cambia algo de lo que el resultado depende, la caché falla'],
  ['r319-verif.mjs',   'los ocho de la tanda de MEDIA siguen arreglados'],
  ['r320-verif.mjs',   'los gemelos: nada quedó arreglado a medias'],
  ['r321-verif.mjs',   'un gesto mueve el clip Y su mitad enlazada; un gesto de grupo conserva los desfases'],
  ['r325-verif.mjs',   'los cuatro que, si vuelven, cuestan material'],
  ['r327-verif.mjs',   'los arreglos inertes, medidos contra su caso original'],
  ['r328-verif.mjs',   'deshacer muerto y Shape Box huerfana'],
  ['r329-verif.mjs',   'copias enlazadas, Mix que viaja y una sola lista de lo que se ve'],
  ['r330-verif.mjs',   'cada secuencia se compone con SU contexto, y el decodificador sigue a la fuente'],
  ['r331-verif.mjs',   'NV12 sin sesgo, timecode de secuencia y fundidos en orden'],
  ['r332-verif.mjs',   'el visor no estampa fotogramas viejos y los recursos se sueltan'],
  ['r333-verif.mjs',   'un evaluador para todos, una carga por LUT y una ventana con nombre'],
  ['r334-verif.mjs',   'sin fotos muertas, proyecto sucio cuando toca y sin reintentos en bucle'],
  ['r335-verif.mjs',   'el espectro no miente arriba y el INV no se dispara sin senal'],
  ['r336-verif.mjs',   'las correcciones de la revision, medidas'],
  ['r337-verif.mjs',   'un destino por tamanyo: sin churn de VRAM'],
  ['r338-verif.mjs',   'las diez de la segunda revision, medidas'],
  ['r339-verif.mjs',   'el rotulo cuenta lo que hay en el esquema'],
];

/* Sin app levantada no se distingue «rojo» de «no medido», y esa confusión es justo la que hace inútil una red. */
const lista = await new Promise(r => {
  const req = http.get({ host: '127.0.0.1', port: 9222, path: '/json/list', timeout: 3000 },
    res => { let b = ''; res.on('data', c => b += c); res.on('end', () => { try { r(JSON.parse(b)); } catch { r(null); } }); });
  req.on('error', () => r(null)); req.on('timeout', () => { req.destroy(); r(null); });
});
if (!lista) {
  console.log('*** la aplicacion no esta escuchando en 127.0.0.1:9222.');
  console.log('    Levantala primero:  npx electron . --remote-debugging-port=9222');
  process.exit(2);
}

/* [R322] Y ANTES de tocar nada: cada red arranca con `newProject(...,true)`, y ese `true` es `skipConfirm`, que
   se salta `confirmDiscard`. Es decir, correr las redes sobre una instancia con trabajo sin guardar lo descarta
   —clips, medios e historial— sin preguntar, y cinco veces seguidas. El README manda pasarlas antes de compilar,
   así que la instrucción venía con el destrozo incluido. Se comprueba `state.dirty` y se sale sin tocar nada.
   No se ofrece «continuar de todas formas»: el que quiera medir sobre un proyecto de verdad lo guarda primero. */
const pg = lista.find(x => x.type === 'page' && x.webSocketDebuggerUrl && /index\.html/.test(x.url));
if (!pg) { console.log('*** no encuentro la ventana del editor (index.html) en el puerto 9222.'); process.exit(2); }
const sucio = await new Promise((res, rej) => {
  const ws = new WebSocket(pg.webSocketDebuggerUrl);
  ws.onerror = () => rej(new Error('no se pudo abrir el WebSocket de depuracion'));
  /* `__redes` marca la instancia como YA usada por las redes. Sin él, la propia corrida deja el proyecto sucio
     —las sondas hacen File→New— y la SIGUIENTE se negaría a arrancar sobre su propia suciedad, obligando a
     reiniciar la aplicación entre pasadas. Con la marca, «sucio» sólo significa «hay trabajo del usuario». */
  ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate',
    params: { expression: 'JSON.stringify({dirty:!!state.dirty, mio:!!window.__redes, clips:state.clips.length, ruta:currentPath||null})',
              returnByValue: true, timeout: 5000 } }));
  ws.onmessage = e => { const m = JSON.parse(e.data);
    if (m.id === 1) { ws.close(); try { res(JSON.parse(m.result.result.value)); } catch { res(null); } } };
});
if (sucio && sucio.dirty && !sucio.mio) {
  console.log('*** la instancia tiene cambios SIN GUARDAR (' + sucio.clips + ' clips' +
              (sucio.ruta ? ', ' + sucio.ruta.replace(/^.*[\\/]/, '') : ', proyecto sin titulo') + ').');
  console.log('    Las redes empiezan con File-New y se lo llevarian todo sin preguntar. Guarda primero (Ctrl+S),');
  console.log('    o levanta una instancia aparte para medir. No se ha tocado nada.');
  process.exit(2);
}
/* Pasado el control, se marca la instancia: de aquí en adelante lo sucio es nuestro. */
await new Promise(res => { const ws = new WebSocket(pg.webSocketDebuggerUrl);
  ws.onerror = () => res();
  ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate',
    params: { expression: 'window.__redes=1', returnByValue: true, timeout: 5000 } }));
  ws.onmessage = () => { ws.close(); res(); }; });

/* [R322] Con PLAZO. Sin él, una sonda cuyo WebSocket no se abre —la app ocupada en un `spawnSync` de FFmpeg, un
   cuelgue de GL, un `#exOv` comiéndose el teclado— dejaba `npm run redes` bloqueado para siempre, sin una línea
   de salida y sin decir en qué red se había quedado. 180 s es holgado: la más lenta de las cinco tarda ~25 s. */
const PLAZO = 180000;
/* [R322] Un acento grave dentro de la plantilla que se manda por CDP la cierra a media expresión y la sonda muere
   con un `SyntaxError` que no dice nada del código bajo prueba. Me ha pasado SIETE veces, las últimas tres
   escribiendo un comentario explicativo dentro de la plantilla — que es donde no se piensa en ello. Se comprueba
   aquí, antes de lanzar nada, porque el síntoma (una red en ROJO) es indistinguible de un fallo real. */
{ const malas = [];
  for (const [f] of REDES) {
    const txt = fs.readFileSync(path.join(AQUI, f), 'utf8');
    let dentro = false, ln = 0;
    for (const l of txt.split(/\r?\n/)) { ln++;
      const abre = /await ev\(`/.test(l), cierra = /\}\)\(\)`\);/.test(l);
      /* Los acentos ESCAPADOS (`\``) son legales dentro de la plantilla y hay sondas que los usan para citar
         código en un comentario; sólo cuentan los sueltos. Sin esta línea el guardián daba un falso positivo en
         `r318-caches.mjs:97`, que lleva funcionando desde R318 — el guardián tenía el fallo, no la sonda. */
      const graves = (l.replace(/\\`/g, '').match(/`/g) || []).length;
      const esperados = (abre ? 1 : 0) + (cierra ? 1 : 0);
      if ((dentro || abre) && graves !== esperados) malas.push(f + ':' + ln);
      if (abre) dentro = true;
      if (cierra) dentro = false;
    } }
  /* [R323] AVISA, no aborta. La maquina de estados exige que la plantilla cierre con el patron exacto
     `})()`+"`);"+`, asi que una sonda escrita de otra forma deja `dentro` puesto para el resto del fichero y todo
     lo que venga despues se marca. Con `exit(2)` un solo falso positivo dejaba las CINCO redes sin medir —y ya
     dio uno en su primera pasada, por no contar los acentos escapados—. El sintoma real (la sonda muere con un
     SyntaxError) se ve igual en su linea de salida; esto solo lo explica antes. */
  if (malas.length) {
    console.log('    aviso: posible acento grave suelto dentro de la plantilla de una sonda');
    for (const m of malas) console.log('           ' + m + '  (si esa red sale ROJA con un SyntaxError, es esto)');
    console.log('');
  } }
const correr = f => new Promise(r => {
  const p = spawn(process.execPath, [path.join(AQUI, f)], { stdio: ['ignore', 'pipe', 'pipe'] });
  let sal = '', cortada = false;
  const t = setTimeout(() => { cortada = true; p.kill(); }, PLAZO);
  p.stdout.on('data', d => sal += d); p.stderr.on('data', d => sal += d);
  p.on('close', code => { clearTimeout(t); r({ code, sal, cortada }); });
});
const sigueViva = () => new Promise(r => {
  const req = http.get({ host: '127.0.0.1', port: 9222, path: '/json/list', timeout: 3000 },
    res => { res.resume(); r(res.statusCode === 200); });
  req.on('error', () => r(false)); req.on('timeout', () => { req.destroy(); r(false); });
});

let rojas = 0, sinMedir = 0;
for (const [f, que] of REDES) {
  const { code, sal, cortada } = await correr(f);
  /* [R322] «Rojo» y «no medido» son cosas distintas, y confundirlas es lo que hace inútil una red. Estas sondas
     crean y destruyen proyectos y machacan WebGL: si la app muere en la red 2, las tres siguientes fallaban por
     no encontrarla y el resumen decía «3 de 5 en ROJO», que es exactamente la mentira que la comprobación de
     arranque quería evitar. Si la app ya no responde, se para y se dice. */
  if (code !== 0 && !(await sigueViva())) {
    console.log('  ??    ' + f.padEnd(18) + '  NO MEDIDA: la aplicacion ha dejado de responder');
    sinMedir = REDES.length - REDES.findIndex(([x]) => x === f);
    console.log('        (se abandona: las ' + (sinMedir - 1) + ' restantes tampoco se pueden medir)');
    break;
  }
  const ok = code === 0;
  if (!ok) rojas++;
  console.log((ok ? '  OK  ' : cortada ? '  PLAZO' : '  ROJA') + '  ' + f.padEnd(18) + '  ' + que);
  if (cortada) console.log('        se agoto el plazo de ' + (PLAZO / 1000) + ' s: la sonda quedo colgada');
  else if (!ok) console.log(sal.split(/\r?\n/).filter(l => /\*\*\*/.test(l)).map(l => '        ' + l.trim()).join('\n'));
}
console.log('\n' + (sinMedir ? '*** corrida ABANDONADA: la aplicacion murio a mitad, ' + sinMedir + ' red(es) sin medir'
                  : rojas ? '*** ' + rojas + ' de ' + REDES.length + ' redes en ROJO (detalle: corre la sonda suelta)'
                          : 'las ' + REDES.length + ' redes en verde'));
process.exit(rojas || sinMedir ? 1 : 0);
