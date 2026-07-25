# ADR-0009: El arranque usa dos ventanas — splash propio y editor oculto hasta estar listo

- **Estado:** Accepted
- **Fecha:** 2026-07-25
- **Deciden:** Beltrán (director creativo), Claude

## Contexto
Hasta R150 el splash era una **capa dentro del documento del editor** (`showSplash`, un `.overlay` con z-index 360).
Esa forma arrastraba un problema estructural: la ventana del editor está en pantalla desde el primer paint, así que
cualquier hueco entre "la ventana existe" y "el splash cubre todo" se ve como un flash del cromo a medio armar.
R147 se dedicó entero a taparlo — `body.preboot` con `visibility:hidden` sobre `#app`, y reordenar `finish()` para
pintar el destino **antes** del fundido. Funcionaba, pero era una carrera ganada por milisegundos: cada cambio en el
orden de arranque podía volver a destaparlo.

El handoff de Claude Design para launcher+splash define el splash como una **ventana fija de 1080×1080 sin cromo,
previa a la ventana principal** (el mismo rol que el splash de Ableton Live). Beltrán lo pidió explícito:
*"abre en 1080x1080, termina de cargar y recién ahí abre la app en 16/9"*.

## Decisión
El arranque pasa a usar **dos ventanas**:

1. `main.js` crea primero una ventana **cuadrada, sin marco, transparente y centrada** que carga `splash.html`.
2. La ventana del editor se crea **oculta** (`show:false`) y **no** se muestra en `ready-to-show`.
3. El renderer reporta **hitos reales** de arranque (`dsp:bootProgress`) que el main reenvía al splash, y avisa
   `dsp:bootReady` cuando el destino (inicio u onboarding) ya está pintado.
4. `finishBoot()` muestra el editor **y después** cierra el splash (420ms más tarde), nunca al revés.
5. El editor abre en **16:9 medido sobre el área útil** (`useContentSize:true`), como tamaño de arranque; la ventana
   sigue siendo redimensionable.

Reglas que acompañan a la decisión:
- **El splash no inventa texto.** `bootMark()` manda sólo el porcentaje; el rótulo lo elige `splash.html` con la
  tabla de umbrales del diseño. Una sola fuente por string.
- **El porcentaje es monótono y se topa en 91** hasta que el arranque termina de verdad: 100% significa "listo".
- **Mínimo en pantalla (`BOOT_MIN_MS`, 2.4s).** El arranque real tarda ~1.4s y un splash que parpadea se lee como
  un error, no como una marca.
- **Siempre hay salvavidas.** `BOOT_TIMEOUT_MS` (25s) y `render-process-gone` llaman a `finishBoot()`. Una ventana
  que espera un aviso que nunca llega es una app invisible.

## Consecuencias
- (+) El flash de arranque deja de ser algo que hay que **evitar** y pasa a ser **imposible**: no se puede ver el
  editor a medio armar si la ventana no está en pantalla. `body.preboot` queda sólo para abrir `index.html` suelto.
- (+) El splash puede tener su propio tamaño y forma (1080² cuadrado) sin pelearse con la geometría del editor.
- (+) Los hitos son reales: si algún día el arranque se pone lento, la barra lo va a mostrar de verdad.
- (−) **`package.json › build.files` es una lista explícita**: todo archivo nuevo de arranque (`splash.html`,
  `splash-preload.js`) hay que agregarlo ahí. Olvidarlo no rompe en dev — rompe **sólo en el `.exe` empaquetado**,
  y de la peor manera: sin splash y con la ventana esperando un `bootReady` que nunca llega.
- (−) Dos ventanas durante el arranque: hay que cuidar el orden de mostrar/cerrar y que `window-all-closed` no
  dispare antes de tiempo.
- (−) El `.dc.html` del prototipo trae un temporizador sintético de 7s. **No se porta**: es andamio de diseño.

## Confirmación
Arrancar con `--remote-debugging-port` y comprobar por CDP: existe un target `splash.html` mientras `index.html`
está oculto; el editor queda en 16:9 exacto sobre `innerWidth/innerHeight`; el target del splash desaparece después
de que el editor se muestra; y la consola del editor no tiene errores. Medido en R151: splash a ~0.8s, convivencia
hasta ~3.6s, cierre a ~4.0s, editor 1600×900.
