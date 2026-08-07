# Estructura del código — Immersive Studio Pro

Guía de orientación para leer este repositorio por primera vez. Describe **qué hay, dónde está y en qué orden
leerlo**. Los números de línea corresponden a la versión 1.0 (commit de agosto de 2026) y sirven de referencia
aproximada: el fichero se edita a diario y las líneas se desplazan.

Documentos que complementan a éste, y que conviene tener a mano:

| Documento | Qué contiene |
|---|---|
| `ARCHITECTURE.md` | Cómo funciona el motor: render, flujos, conceptos transversales. |
| `COMPONENTS.md` | Inventario componente a componente, con `archivo · función` y estado. Es la «estructura de carpetas» que el código no tiene. |
| `docs/adr/` | Diez decisiones de diseño con su porqué. Explican por qué el código es como es. |
| `PLAN.md` | Bitácora por rondas. Cada cambio del último año, con su motivo y sus mediciones. |
| `docs/NEXT.md` | Cola de trabajo pendiente. |
| `docs/Immersive Studio Pro - User Manual.pdf` | Qué hace el programa desde fuera. |

---

## 1. Panorama

Editor de vídeo inmersivo de escritorio: domo fulldome, pantalla plana y sala 360. Aplicación **Electron**, sin
sistema de compilación: `index.html` carga `app.js` con una etiqueta `<script>` y eso es todo lo que hay entre
el código fuente y lo que se ejecuta (ver `adr-0001-sin-build-step.md`).

Todo el render ocurre en la GPU mediante **WebGL2**. No hay framework de interfaz: el DOM se construye a mano
con `document.createElement` y plantillas de cadena.

| Fichero | Líneas | Contenido |
|---|---:|---|
| `app.js` | 14 499 | **Todo el programa**: motor GL, línea de tiempo, inspector, export, interfaz. |
| `index.html` | 1 531 | Marcado de la ventana y **toda la hoja de estilo**, en línea. |
| `main.js` | 566 | Proceso principal de Electron: ventana, diálogos nativos, disco, FFmpeg. |
| `preload.js` | 134 | Puente seguro entre el proceso principal y la página. |
| `splash.html` · `splash-preload.js` | 138 | Ventana de arranque, previa al editor. |
| `mp4-muxer.min.js` | 7 | Biblioteca de terceros, vendorizada como fichero local. |

Sin dependencias de npm en tiempo de ejecución. `package.json` sólo declara `electron` y `electron-builder`
como dependencias de desarrollo, y los dos añadidos nativos como **opcionales** marcadas `win32`.

---

## 2. Los tres procesos y la frontera entre ellos

```
┌──────────────────────┐        IPC        ┌────────────────────────────┐
│  main.js             │ ◄──────────────►  │  preload.js                │
│  proceso principal   │   ipcMain.handle  │  contextBridge             │
│  · ventana           │                   │  expone  window.dsp        │
│  · diálogos nativos  │                   └──────────────┬─────────────┘
│  · lectura/escritura │                                  │  window.dsp
│  · FFmpeg            │                   ┌──────────────▼─────────────┐
│  · GPU discreta      │                   │  app.js  (renderer)        │
└──────────────────────┘                   │  el programa entero        │
                                           └────────────────────────────┘
```

**`main.js`** no sabe nada del editor. Ofrece **42 manejadores IPC**, todos con el prefijo `dsp:`, agrupados en
cinco familias:

- **Diálogos nativos** — `saveDialog`, `openDialog`, `pickMedia`, `pickFile`, `chooseExportDir`.
- **Disco** — `readText`, `writeText`, `writeBinary`, `stat`, `listDir`, `deleteFile`, `rename`, `exists`,
  `ensureDir`, y lectura/escritura por bloques (`fileOpen`/`fileWriteAt`/`fileClose`, `openRead`/`readAt`).
- **FFmpeg** — `ffProbe`, `ffStart`, `ffWrite`, `ffEnd`, `ffKill`. Ver `docs/FFMPEG.md`.
- **Ventana y sistema** — `setTitle`, `setProgress`, `forceClose`, `powerSave`, `metrics`, `openExternal`
  (con lista blanca estricta), `revealPath`.
- **Arranque** — `bootProgress`, `bootReady`, `nativeEdit`, `setUiState`.

Funciones propias del proceso principal, en orden: `preferHighPerfGPU` (fuerza la GPU discreta por registro,
sin banderas de Chromium — ver los *gotchas*), `createSplash` / `finishBoot` (arranque en dos ventanas,
`adr-0009`), `createWindow`, `rdomeFromArgv` (abrir un proyecto por doble clic), `_ffCandidatos` / `_ffBuscar`
(localizar el binario de FFmpeg empaquetado).

**`preload.js`** expone un único objeto, `window.dsp`, **congelado por `contextBridge`**. Es la lista completa
de lo que la página puede pedirle al sistema. Contiene además dos envoltorios de los añadidos nativos, `ndi` y
`spout`.

---

## 3. El modelo de datos

Leer esto antes que ninguna función. Casi todo el programa es una transformación sobre estas cinco formas.

### `state` — el estado global mutable (`app.js:124`)

Un único objeto literal. No hay *store*, ni inmutabilidad, ni reactividad.

```js
const state = {
  fps, media:[], lanes:[], clips:[],           // el proyecto
  playhead, playing, loop, follow,             // transporte
  selId, selIds:[], selMediaId, selLane,       // selección
  view:{ mode:'2d'|'3d', zoom, pan:[x,y], cam:{…} },
  tl:{ pxPerSec, tool, tcMode, bpm, … },       // línea de tiempo
  workIn, workOut, markers:[],                 // rango de trabajo
  slate:{…},                                   // datos de esquina
  prefs:{…}, folders:[], mediaView, …          // interfaz
  openSeqs:[], activeSeqId, seqW, seqH,        // secuencias
  seqMode:'dome'|'flat'|'room', seqCov,        // formato activo
};
```

### `media` — un elemento del panel de medios

`kind` distingue: `video`, `image`, `audio`, `text`, `shape`, `nest`, `ndi`. Un medio lleva sus datos de
archivo, su textura GL, su miniatura, sus marcas de entrada/salida (`srcIn`/`srcOut`) y, si es un **nest**, su
contenido: `nestClips`, `nestLanes` y, cuando es una composición generada, `comp`.

### `clip` — una instancia en la línea de tiempo

`{ id, mediaId, lane, start, dur, inP, props:{…}, kf:{…}, anim:[…], fx:[…], loop, speed, link, avRole }`

- `props` — los valores base (posición, opacidad, máscara, mezcla…).
- `kf` — los fotogramas clave por parámetro.
- `anim` — los modificadores procedurales (Motion).
- `fx` — la cadena de efectos.

### `lane` — una pista

`{ id, name, tag, kind:'video'|'audio', surf }`. `state.lanes[0]` puede ser de audio: **el índice no implica el
tipo**, hay que mirar `kind`.

### Secuencia = medio de tipo `nest`

Una secuencia **es** un elemento del panel de medios, y por eso puede colocarse dentro de otra como un clip.
De ahí salen, con un solo mecanismo, las pestañas de secuencia, el anidado y las composiciones generadas.
`loadSeqIntoState` (`app.js:9940`) vuelca el nest activo en `state.clips`/`state.lanes`, y `saveActiveSeq` hace
el camino inverso al cambiar de pestaña.

### El vínculo estado → pantalla es **manual**

No hay enlace de datos. Tras mutar `state` hay que llamar a la función de repintado que corresponda:

| Llamada | Repinta |
|---|---|
| `render()` | El lienzo GL. |
| `renderTimeline()` | El DOM de la línea de tiempo. |
| `renderInspector()` | El panel derecho. |
| `renderMedia()` | El panel de medios. |
| `markDirty()` | Marca el proyecto como modificado e invalida cachés. |

**Ésta es la fragilidad estructural principal del programa**: un olvido no falla, simplemente deja la pantalla
desactualizada.

---

## 4. Recorrido de `app.js` en orden de lectura

14 499 líneas, 1 392 declaraciones de primer nivel (1 068 funciones). El fichero **sí tiene un orden**, aunque
no lleve separadores: va de lo más bajo (GPU) a lo más alto (interfaz), y termina en los subsistemas añadidos
más tarde.

| Líneas | Bloque | Puntos de entrada |
|---:|---|---|
| 1 – 120 | Arranque y utilidades | `bootMark`, `bootReveal`, `$`, `uid` |
| 124 – 210 | **El estado global** e i18n | `state`, `T()` |
| 213 – 700 | **Shaders y programas GL** | `VSW`/`FSW`→`PW` (warp de domo y plano), `PB` (blit), `PFD` (fuente fulldome), `PEQ` (equirect), `P3` (malla 3D), `PR` (sala 3D) |
| 700 – 915 | Buffers, texturas, FBO del máster | `newTex`, `upTex`, `setCompSize` |
| 769 – 1 080 | **Evaluación de parámetros** | `evalP` (fotogramas clave, L769), `animOffset` (Motion, L915), `evalR` (valor final en render, L927) |
| 1 088 – 1 280 | **Dibujo de un clip** | `drawClipFlat`, `drawClip` |
| 1 276 – 1 700 | **Compositor** | `compositeClips`, `composite`, `renderRoom3D` |
| 1 696 – 1 900 | **El bucle de render** | `render` → `_renderNucleo` |
| 1 900 – 2 600 | Salidas en vivo y decodificación | `startNDI`, `startSpout`, instancias de vídeo |
| 2 596 – 3 000 | **Importación de medios** y proxies | `importFiles`, `makeProxy`, `detectFps` |
| 3 023 – 3 500 | Carpetas y **panel de medios** | `renderMedia`, `makeMediaItem` |
| 3 529 – 4 050 | **Línea de tiempo** | `renderTimeline`, gestos de mover/recortar/cortar |
| 4 058 – 4 700 | **Pantalla de inicio** y proyectos de demostración | `showLanding`, `renderLauncher`, `startDemoProject` |
| 4 700 – 5 770 | Herramientas, ajuste, zoom, marcadores | `applySnap`, `tlZoomAt`, `addMarker` |
| 5 774 – 7 400 | **Inspector** | `renderInspector` → `_renderInspectorMain`, `buildRows`, `buildAnimList` |
| 7 415 – 7 900 | **Decodificador de clip** | `makeClipDecoder`, caché de fotogramas |
| 7 871 – 8 040 | Supersampling de export y mezcla de audio | `renderExportFrame`, `exportAudioMix` |
| 8 042 – 8 270 | **Datos de esquina** | `chapaLienzo`, `chapaTC`, `chapaPintaVisor` |
| 8 276 – 8 500 | **Conversión RGBA→NV12 en GPU** | `nv12Read` |
| 8 500 – 9 380 | Export: HAP, DXT, escritor `.mov` | `hapFrame`, `movBuild`, `dxtEncodeCanvas` |
| 9 384 – 9 900 | **Panel y motor de export** | `openExport`, `runExport`, `renderInPlace` |
| 9 940 – 10 550 | **Secuencias, salas y diálogos de creación** | `loadSeqIntoState`, `switchSeq`, `newSequenceDialog`, `roomSetupDialog`, `roomPlan` |
| 10 555 – 11 000 | **Serialización** | `serProject`, `serClip`, `loadProject`, `saveProject` |
| 11 000 – 12 000 | Autoguardado, recuperación, **deshacer** | `snapshot`, `restore`, `pushUndo` |
| 12 000 – 12 300 | **Copiar/pegar atributos** | `ATTR_FUERA`, `copyAttrs`, `pasteAttrs` |
| 12 225 – 12 500 | **Menús y paleta de comandos** | `openAppMenu`, `commandList`, `openPalette` |
| 12 500 – 13 380 | **Composiciones** | `compLayout`, `weaveLayout`, `createComposition`, `openCompose` |
| 13 391 – 13 700 | **Monitor de origen** | `openSourceMonitor` |
| 13 719 – 13 930 | **Análisis de audio** | bandas, envolventes, detección de tempo |
| 13 931 – 14 200 | **Catálogo de efectos** y cadena GPU | `FXTYPES`, `FXBY`, `applyChain`, `drawAdjustment` |
| 14 206 – 14 499 | Panel de Reactive FX | `renderReactivePanel` |

Para regenerar esta tabla tras un cambio grande:

```bash
python scripts/mapa-codigo.py app.js 1000
```

---

## 5. Los flujos principales

### Un fotograma

```
render()                         envoltorio; pinta además los datos de esquina en el visor
 └ _renderNucleo()
    ├ composite(t, size)         dibuja TODOS los clips activos en el FBO del máster
    │   └ compositeClips(t)      recoge los clips vivos, ordena y aplica solo/mute
    │       └ drawClip(c,m,t)    por clip: elige programa GL según sus banderas
    │           ├ applyChain()      efectos, si los hay          → textura intermedia
    │           ├ applyFisheye()    ojo de pez, si hace falta    → textura intermedia
    │           └ dibuja con PW | PFD | PEQ
    └ según state.view.mode y seqMode:
       ├ 2D    → blit del máster a pantalla (PB)
       ├ 3D    → malla del domo (P3)   o   quads de la sala (PR)
       └ salidas en vivo: NDI / Spout leen el mismo máster
```

Todo lo visible pasa por **un único máster compuesto**. Ésa es la razón de que el visor, las salidas en vivo y
el export coincidan siempre: no hay una segunda ruta de render.

### Abrir y guardar

`saveProject` (L10557) → `serProject` → JSON → se conserva la versión anterior como `.bak` y se escribe el
`.isp` con `dsp.writeText`. La escritura atómica de verdad — fichero `.part` y `rename` al terminar — la usa
`makeProxy` (L2917), donde una generación interrumpida dejaría un vídeo sin índice que el editor usaría en
silencio.
`loadProject` → `resetProjDefaults()` (valores de fábrica **siempre**, para que nada se herede del proyecto
anterior) → reconstrucción de medios y secuencias → migraciones (`migrateRoomFloor`, `migrateNestFulldome`).

Formato de proyecto `.isp`, JSON versión 4. Ver `adr-0005-formato-isp.md`.

### Exportar

`openExport` recoge la configuración; `runExport` es el motor. Por cada fotograma: `renderExportFrame`
(supersampling opcional) → conversión → codificador. Hay tres caminos de codificación:

- **FFmpeg** por tubería (`dsp:ffWrite`), con conversión RGBA→NV12 en la GPU. Es el camino de 4096².
- **WebCodecs** + `mp4-muxer`, limitado por lo que acepte Chromium.
- **Escritores propios**: secuencia PNG y HAP/`.mov`.

---

## 6. Añadidos nativos y binarios

| Ruta | Qué es |
|---|---|
| `native/ndi-send/ndi.cc` | Añadido N-API para emitir y recibir NDI. |
| `native/spout-send/spout.cc` | Añadido N-API sobre SpoutDX, sólo Windows. |
| `vendor/ffmpeg/win/` · `mac/` | Binario de FFmpeg, empaquetado como `extraResources`. |

Los dos añadidos son `optionalDependencies` marcadas `os: win32`, de modo que en macOS npm ni los intenta.
**Cuidado**: `node_modules/dsp-ndi-send` es una *copia* de `native/ndi-send`; editar el `.cc` obliga a volver a
copiar antes de empaquetar.

---

## 7. Empaquetado y despliegue

```bash
npm start          # desarrollo
npm run dist       # .exe: electron-builder → dist/win-unpacked, instalador NSIS y portable
npm run dist:mac   # sólo funciona ejecutándolo EN un Mac
node --check app.js && node --check main.js     # comprobación de sintaxis
```

El despliegue **se hace siempre con el script**, que además verifica:

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts/deploy-verificado.ps1"
```

Copia las tres instalaciones (una canónica y dos heredadas) y **compara el sha1 de los tres `app.asar`**. El
motivo está en el propio script: la copia elevada se lanza con `Start-Process -Verb RunAs -Wait`, cuyo éxito no
dice nada sobre si la copia ocurrió, y una instalación estuvo días con un asar viejo dándose por buena.

---

## 8. Convenciones del código

- **Idioma.** Comentarios y documentación en castellano; identificadores y cadenas de interfaz en inglés. La
  interfaz se traduce con `T('English','Español')`.
- **Marcas de ronda.** Los comentarios llevan `[R###]`, que remite a la entrada correspondiente de `PLAN.md`.
  Es el historial de por qué una línea es como es, y suele explicar qué se rompía antes.
- **Archivar, no borrar.** El código retirado va a `_backup/deprecated/` con fecha (33 ficheros). Ver
  `adr-0007`.
- **Sin pruebas automatizadas.** La verificación se hace con **sondas** contra la aplicación en marcha, por el
  protocolo de depuración de Chrome:

  ```bash
  npx electron . --remote-debugging-port=9222
  node scratchpad/<sonda>.mjs
  ```

  Hay 553 sondas en `scratchpad/`, una o varias por ronda. Cada una monta un caso, mide y sale con código
  distinto de cero si falla.

---

## 9. Trampas conocidas

Un revisor debería leer esto antes de proponer cambios: varias de estas cosas parecen errores y no lo son.

| Asunto | Qué hay que saber |
|---|---|
| **Handedness 2D↔3D** | Hay **una** inversión intencional (`u_flipx=-1` en el domo). «Arreglar» la matriz de cámara o la malla la duplica. Ver `adr-0004`. |
| **GPU híbrida** | La GPU discreta se fuerza por registro desde `main.js`. Las banderas agresivas de Chromium dejan el 3D en negro. |
| **`hasKf()` devuelve `undefined`** | No `false`. Con `classList.toggle(x, hasKf(...))` la semántica de WebIDL invierte el resultado; hay que forzar `!!`. |
| **`UNPACK_FLIP_Y_WEBGL` es estado global** | Con el volteo activo, `texImage3D` deja la textura vacía. Hay que desactivarlo antes de subir una LUT 3D. |
| **`window.dsp` está congelado** | `contextBridge` lo sella: no se puede sustituir ni instrumentar desde una sonda. |
| **Las declaraciones `function` no se pueden interceptar** | Reasignar `window.X` no cambia a quién llama el código interno: se resuelve por ámbito léxico. |
| **`addClip(m, laneINDEX, …)`** | Toma el **índice** de pista, no el `id`. |
| **Electron no tiene `prompt`/`alert`/`confirm`** | Usar `appPrompt` / `appAlert` / `appConfirm` / `appConfirm3`. |
| **WebGL no lanza excepciones** | Un `try/catch` alrededor de una llamada GL no protege nada; hay que consultar `gl.getError()`. |
| **El `.exe` empaquetado no ve los cambios** | Hay que ejecutar `npm run dist`: lo que corre es el asar. |

---

## 10. Por dónde empezar a leer

Un recorrido de una tarde, en este orden:

1. `docs/adr/` completo — son diez ficheros cortos y explican las decisiones que más condicionan el código.
2. `ARCHITECTURE.md`.
3. `app.js:124` — el objeto `state`.
4. `app.js:1696` — `render` y `_renderNucleo`, y desde ahí hacia abajo hasta `drawClip`.
5. `app.js:3529` — `renderTimeline`, para ver cómo se construye el DOM.
6. `COMPONENTS.md` — su índice maestro, para localizar cualquier otra cosa sin volver a escanear `app.js`.
