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
  ['r340-verif.mjs',   'cada entrada Spout recibe lo suyo'],
  ['r341-verif.mjs',   'el cache conserva el cuadrado y la entrega sigue siendo un disco'],
  ['r342-verif.mjs',   'la edit list se aplica, y el archivo sin ella no cambia'],
  /* [R344] Las tres que hacen falta porque r342-verif midio la premisa y no la conclusion: una comprueba el
     FOTOGRAMA entregado (y se comprueba a si misma reconstruyendo el estado pre-R342), otra que un salto no
     cueste mas de un reinicio del decodificador, y la tercera que un destino LEJOS de su fotograma clave
     tambien llegue — ese caso necesita GOP mayor de 2 s y por eso no lo veia ninguna de las otras dos.
     Su material se rehace con `node scratchpad/r344-material.mjs`; sin el salen con codigo 3 (NO MEDIDA). */
  ['r344-fotograma-vs-video.mjs', 'el ClipDecoder entrega el MISMO fotograma que <video>'],
  ['r344-atasco-7472.mjs',        'un salto cuesta un reinicio, no una tormenta; y el bucle sigue entero'],
  ['r344-gop-mayor-2s.mjs',       'un destino a mas de 2 s de su clave tambien llega, sin reiniciar en bucle'],
  /* [R344c] Deja de ser una sonda de una ronda y pasa a red: mientras el decodificador se rendia, tapaba el
     sintoma y no discriminaba nada; al cerrar esa rendicion canto 10 fotogramas equivocados en el master. Es
     la unica que mide un EXPORT COMPLETO de un bucle al final del archivo, o sea el caso en que `passed()`
     puede dar por cerrado el archivo y devolver el vecino. Tarda ~20 s. */
  ['r261-finarchivo.mjs',         'un bucle pegado al final del archivo no escribe fotogramas equivocados'],
  /* [R345] Las dos que la auditoria 2026-08-06 dejo marcadas como NO CONFIRMADAS. La de ids cazo un hueco real
     (el barrido legacy no contaba grupos ni marcadores de dentro de una secuencia); la de la caja de forma
     confirmo que la guarda de R328 cubre los cinco caminos. Ninguna necesita material externo. */
  ['r345-ids-legacy.mjs',         'uid() reparte por encima de todo lo que trae el proyecto, tambien en legacy'],
  ['r345-shapebox.mjs',           'la caja de forma no actua sobre puntos que ya no existen'],
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
   de salida y sin decir en qué red se había quedado. 180 s es holgado: la más lenta (`r344-fotograma-vs-video`,
   que posiciona un `<video>` decenas de veces) tarda ~27 s medidos. **Las sondas tienen que fijar su propio
   plazo de CDP por debajo de éste**: si el lanzador mata antes, el diagnóstico de la sonda no llega a salir y
   un fallo concreto se lee como «quedó colgada». */
const PLAZO = 180000;
/* [R322] Un acento grave dentro de la plantilla que se manda por CDP la cierra a media expresión y la sonda muere
   con un `SyntaxError` que no dice nada del código bajo prueba. Me ha pasado SIETE veces, las últimas tres
   escribiendo un comentario explicativo dentro de la plantilla — que es donde no se piensa en ello. Se comprueba
   aquí, antes de lanzar nada, porque el síntoma (una red en ROJO) es indistinguible de un fallo real. */
{ const malas = [];
  for (const [f] of REDES) {
    const txt = fs.readFileSync(path.join(AQUI, f), 'utf8');
    /* [R345b] Por PARIDAD, sin conocer idiomas. La versión anterior emparejaba una apertura y un cierre
       literales (`await ev(\`` … `})()\`);`), y eso fallaba por los dos lados a la vez: las sondas que declaran
       la plantilla aparte (`const PAGINA = \`…\``, las tres más nuevas) no se miraban EN ABSOLUTO, y cualquier
       sonda que cerrara de otra forma —una llamada de una sola línea, o el `};1\`);` de r261— dejaba el autómata
       creyéndose dentro para el resto del fichero y soltaba avisos falsos en cada corrida. Un aviso que siempre
       está deja de ser un aviso, y una vigilancia que no mira los ficheros nuevos no vigila nada.
       La regla nueva no necesita saber cómo se escribe la sonda: una línea con un número IMPAR de acentos
       graves abre (o cierra) una plantilla; una línea con un número PAR **dentro** de una plantilla es
       exactamente la trampa — el par que la parte en dos y produce el `SyntaxError` que ha mordido siete veces,
       casi siempre citando código en un comentario. Y si el fichero acaba con una plantilla sin cerrar, también
       se dice. */
    let dentro = false, ln = 0;
    for (const l of txt.split(/\r?\n/)) { ln++;
      /* Los acentos ESCAPADOS (`\``) son legales dentro de la plantilla y hay sondas que los usan para citar
         código en un comentario; sólo cuentan los sueltos. Sin esta línea el guardián daba un falso positivo en
         `r318-caches.mjs:97`, que lleva funcionando desde R318 — el guardián tenía el fallo, no la sonda. */
      const graves = (l.replace(/\\`/g, '').match(/`/g) || []).length;
      if (!dentro) { if (graves % 2 === 1) dentro = true; }        // impar: se abre y no se cierra aquí
      else if (graves === 0) { /* línea normal dentro de la plantilla */ }
      else if (graves % 2 === 1) dentro = false;                    // impar: cierra
      else malas.push(f + ':' + ln);                                // PAR dentro de la plantilla = el par suelto
    }
    if (dentro) malas.push(f + ': la plantilla no cierra');
  }
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

let rojas = 0, sinMedir = 0, saltadas = 0;
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
  /* [R344] CODIGO 3 = «no medida por falta de material», el cuarto estado. Antes una sonda que se saltaba por
     no encontrar sus archivos salia con 0 y esto la pintaba OK: el resumen decia «en verde» habiendo medido
     menos redes de las que contaba. Es la misma confusion «rojo vs no medido» que el bloque de arriba explica,
     colada por la puerta del codigo de salida — y muerde justo donde mas duele, porque el material de las
     redes de R344 no se versiona (se rehace con `node scratchpad/r344-material.mjs`), asi que en un clon
     nuevo, en el Mac, o tras limpiar la carpeta, se saltaban TODAS en verde. */
  if (code === 3) {
    saltadas++;
    console.log('  --    ' + f.padEnd(30) + '  NO MEDIDA: ' + que);
    console.log(sal.split(/\r?\n/).filter(l => l.trim()).map(l => '        ' + l.trim()).join('\n'));
    continue;
  }
  const ok = code === 0;
  if (!ok) rojas++;
  console.log((ok ? '  OK  ' : cortada ? '  PLAZO' : '  ROJA') + '  ' + f.padEnd(30) + '  ' + que);
  if (cortada) console.log('        se agoto el plazo de ' + (PLAZO / 1000) + ' s: la sonda quedo colgada');
  else if (!ok) console.log(sal.split(/\r?\n/).filter(l => /\*\*\*/.test(l)).map(l => '        ' + l.trim()).join('\n'));
}
const medidas = REDES.length - saltadas;
console.log('\n' + (sinMedir ? '*** corrida ABANDONADA: la aplicacion murio a mitad, ' + sinMedir + ' red(es) sin medir'
                  : rojas ? '*** ' + rojas + ' de ' + medidas + ' redes medidas en ROJO (detalle: corre la sonda suelta)'
                          : 'las ' + medidas + ' redes medidas, en verde')
           + (saltadas ? '\n*** ' + saltadas + ' red(es) NO MEDIDAS por falta de material: no cuentan como verdes' : ''));
process.exit(rojas || sinMedir ? 1 : 0);
