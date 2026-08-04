# Auditoría delta — Immersive Studio Pro · 2026-08-04

> ## ✅ EJECUTADA — el plan de §6 está hecho (R242)
> Beltrán delegó el criterio el mismo día. **Las cinco etapas están implementadas y verificadas**, y las cinco
> decisiones de §7 resueltas — el porqué de cada una, en `PLAN.md › ROUND 242`. Resumen: defaults de fábrica
> centralizados (`resetProjDefaults`) · fuga de medios de `loadProject` cerrada (5→0 texturas por ciclo) · BOM ·
> `dsp:openExternal` con allowlist · Dock de macOS · `PSEP` en `ncBuild` · viewport de relleno acotado ·
> `build.files` simétrico · `audioCollapsed` revivido · aviso de proxy al importar.
> **Lo único NO ejecutado a propósito:** la previsualización al fotograma clave durante el scrub (§3.3, opción 1)
> — toca el camino de decodificación en caliente y va en ronda propia; queda como lo siguiente en `docs/NEXT.md`.
> El texto de abajo se conserva **tal como se escribió**, sin retocar: es el diagnóstico, no el parte de obra.

> **Alcance:** el delta R223→R241 (35 commits desde la auditoría del 29 de julio), lo nunca auditado
> (empaquetado post-rename, rama macOS, `main.js`/`preload.js` a fondo, `.isp` legacy) y la deuda que julio
> dejó diferida. **No** se re-recorrió lo que `AUDITORIA-2026-07.md` cerró.
>
> **Método:** verificación por CDP sobre el **`.exe` desplegado** (confirmado por huella de código que es R241
> y por `WEBGL_debug_renderer_info` que corre en la **RTX 4060**, no en la Intel), más lectura dirigida del
> código. Sondas nuevas en `scratchpad/aud2608-*.mjs` (con sus fixtures `aud2608-legacy-*.rdome/.ise`);
> cada hallazgo indica con cuál se reproduce. Se respetaron las seis trampas del arnés del encargo.
> El material de Beltrán no se tocó (sólo lectura de un clip con ffprobe); `Rito360.isp` no hizo falta abrirlo.
>
> **Etiquetas:** **[VERIFICADO]** = reproducido con sonda o constatado en el artefacto real ·
> **[VERIFICADO-estático]** = probado sobre el código/paquete sin ejecutar la plataforma (macOS) ·
> **[SOSPECHADO]** = corazonada argumentada, sin reproducir.

---

## Índice

1. [Lo que se verificó y AGUANTA](#lo-que-aguanta)
2. [Área 1 · Código — correctness](#area-1)
3. [Área 2 · Recursos y rendimiento](#area-2)
4. [Área 3 · Lado Electron (main/preload/empaquetado/macOS)](#area-3)
5. [Área 4 · Deuda diferida de julio, constatada](#area-4)
6. [Plan priorizado por etapas](#plan)
7. [Decisiones para Beltrán](#decisiones)
8. [Diferido, con su razón](#diferido)

---

<a name="lo-que-aguanta"></a>
## 1 · Lo que se verificó y AGUANTA (para no redescubrirlo)

El encargo pedía desconfiar de lo que el autor da por bueno. Se re-ejecutó sobre el `.exe`/RTX y **aguanta**:

- **Las dos convenciones del composite (R237/ADR-0010).** Censo estático exhaustivo de los consumidores de
  `compTex`/`compFBO` (8 sitios: creación, `setCompSize`, caché de scrub-ahead, `render()`, NDI, Spout,
  export, y la capa de ajuste vía `_compFill`): **ninguno usa la pareja de límites equivocada**. Toda la
  matemática de letterbox inline vive sólo en el export (`app.js:7204`, `app.js:7219`) y en
  `drawAdjustment` (que maneja las dos convenciones explícitamente, `app.js:11493-11508`). Los únicos
  `gl.scissor` del camino de composición pasan por `_ndcToVp()`. NDI/Spout respaldan `_compAspect` sin
  tocarlo — correcto porque en domo vale 1 y son salidas de domo.
- **Casos extremos de forma realistas** (`aud2608-forma-extrema.mjs`, sobre el `.exe`): tira real 7196×912,
  tira 16000×2000, sala de 4 muros 4K 15360×2160 → relleno **exacto (0 texels de desviación)** y 1:1;
  casi-cuadrado 9000×8999 al tope de memoria → 8192² con medio texel en el peor borde (el caso documentado
  en la ADR). El tope por memoria (`COMP_MAXTEXELS`) y el clamp de `GL_MAXSIDE` funcionan.
- **Export por-muro** (re-ejecutada la sonda del autor `r237-verify3.mjs` sobre el `.exe`): los cuatro muros
  por separado reconstruyen la tira con **difMax 0** en los cuatro, con transiciones duras que comparar, y
  la sala 3D sin franja en el borde alto (`ratioAlto 1.0`, `uv.bordeAltoNoRecortado true`).
- **El encuadre por secuencia (R239)** no tiene quinto camino. Censo completo de los llamadores de
  `loadSeqIntoState`: los 10 que aterrizan en otra secuencia llaman `setTlScrollT` con la regla correcta;
  los 2 que no lo hacen son legítimos (`ensureSequences` en el arranque, sin encuadre previo que heredar, y
  `recomposeNest`, que se queda en la misma secuencia). Dinámico (`aud2608-encuadre.mjs`): entrar a un nido
  nuevo → 0 · volver al padre → su scroll exacto · reentrar → donde se dejó.
- **El acotado del zoom del `.isp` (R240/R240b)** funciona: un archivo sin bloque `tl` entra con
  `pxPerSec` de fábrica (80), no con el del proyecto anterior (`aud2608-herencia.mjs`, h2.tlTras).
- **Los `.isp` legacy abren** (`aud2608-legacy-migra.mjs`): un v2 sintético (`.rdome`, sin secuencias)
  desde estado limpio → secuencia domo con sus pistas + la de audio añadida, fps y cabezal conservados; un
  v3 (`.ise`, con `sequences[]`) → las 2 secuencias, la activa correcta, y **el viaje v3→v4→reabrir** sin
  errores. *(El caso NO limpio es el hallazgo 2.1.)*
- **Los registros de recursos están limpios en ciclos de proyecto**: `_vinst`, `_fxHist`, `_nestPool`, `_ra`
  vuelven a 0/constante tras 4 ciclos demo→abrir (`aud2608-fugas.mjs`). *(La excepción son las texturas de
  media: hallazgo 3.1.)*

---

<a name="area-1"></a>
## 2 · Área 1 · Código — correctness

### 2.1 · [VERIFICADO · **ALTA**] Un `.isp` legacy hereda el MODO de secuencia del proyecto anterior — y guardarlo lo corrompe

**Qué pasa.** `loadProject` sólo resetea `state.seqW/seqH` (`app.js:9461`) antes de decidir la rama de
secuencias. En la rama legacy (sin `openSeqs` ni `sequences`, `app.js:9473`) llama a `ensureSequences()`,
que crea la secuencia con **`state.seqMode` y `state.seqCov` del proyecto ANTERIOR** (`app.js:8555`:
`newSeqMedia(…, state.seqMode||'dome', state.seqCov||180)`).

**Medido en el `.exe`** (`aud2608-herencia.mjs`, h2): con una sala 360 abierta, cargar un `.rdome` v2 de
domo 2048² crea su secuencia con **`mode:'room'` y `cov:null`** — una "sala" sin `seq.room`. El editor la
trata como sala (`isFlat()`/`isRoom()` leen `seqMode`), y si el usuario guarda, **el archivo queda
permanentemente en `mode:'room'`**: la corrupción sobrevive al reinicio. Es la cuarta aparición de la
familia «estado que se hereda entre proyectos» que el encargo pedía cazar (§4.3), y la de peor consecuencia.

De la misma familia y el mismo sitio:
- `state.lanes=obj.lanes||state.lanes` (`app.js:9418`): un legacy sin `lanes` hereda las pistas del
  proyecto anterior. [SOSPECHADO: no se conoce ningún archivo real sin `lanes`, pero la puerta está.]

**Cómo se reproduce.** `node scratchpad/aud2608-herencia.mjs` con el `.exe` en `:9222` (usa
`startDemoProject('room')` + un v2 sintético en memoria). También con archivo real:
`aud2608-legacy-v2.rdome` abierto tras una sala.

**Arreglo sugerido** (no aplicado): resetear los campos de secuencia a fábrica al entrar en `loadProject`
—`seqMode:'dome'`, `seqCov:180`, `lanes:defLanes()` como *default* si el archivo no trae— igual que R240b
hizo con `pxPerSec`. Idealmente como parte de la migración centralizada (§5, deuda que julio ya señaló).

### 2.2 · [VERIFICADO · MEDIA] `tl.bpm/sig/tcMode` también se heredan (y `bpm:0` guardado se pisa)

`app.js:9456`: `if(obj.tl.bpm)state.tl.bpm=obj.tl.bpm; if(obj.tl.sig)…; if(obj.tl.tcMode)…` — el patrón
`if(truthy)` que el encargo marcaba como sospechoso. Con un archivo **sin bloque `tl`** (legacy), los tres
conservan el valor del proyecto anterior. Medido (`aud2608-herencia.mjs`, h2.tlTras): tras fijar
174/7/'frames' en la sala y abrir el v2, el proyecto nuevo abre con **bpm 174, compás 7, timecode en
frames**. Además, un proyecto actual guardado con `bpm:0` re-entraría con el bpm del anterior (0 es falsy).
Consecuencia práctica: la grilla de beats y el imán musical del proyecto recién abierto miden contra el
tempo de OTRO proyecto.

### 2.3 · [VERIFICADO · MEDIA] El encuadre del VISOR (zoom/pan global y cámara 3D) se hereda al crear y al abrir proyecto

`state.view.zoom/pan/cam` no viajan en el `.isp` (`serProject`, `app.js:9186`) ni se resetean en
`loadProject` (`app.js:9414` sólo resetea el encuadre POR PANEL `view.vp`, decisión de R230b) ni en
`newProject` (`app.js:9233-9240`). **`newRoomProject` sí los resetea** (`app.js:9309`) — la inconsistencia
delata que es descuido, no decisión. Medido (`aud2608-herencia.mjs`, h1/h1b): zoom 5.5, pan [0.7,−0.4] y
cámara yaw 2.2/dist 9 **sobreviven** a `newProject('dome')` y a `loadProject`. Es la misma familia que el
encuadre horizontal de R239, en el eje del visor: abrir un proyecto te deja mirando el encuadre del
anterior. Baja gravedad por reversible (doble clic/Fit recentra), pero es exactamente el «cuarto caso» del
encargo, tres veces.

### 2.4 · [VERIFICADO · BAJA] Un `.isp` con BOM UTF-8 no abre: «Invalid project»

`openProjectPath` hace `JSON.parse(txt)` directo (`app.js:9224`) y `dsp:readText` (`main.js:379`) no pela
el BOM. Un proyecto re-guardado desde el Bloc de notas (o cualquier editor de Windows que escriba UTF-8 con
BOM — el caso real: alguien "arregla" una ruta a mano) **deja de abrir sin pista de por qué**. Medido
(`aud2608-legacy-bom.mjs` con `aud2608-legacy-v2-bom.rdome`): alerta «Invalid project». El arreglo es una
línea (`txt.replace(/^\uFEFF/,'')` antes de los `JSON.parse` de apertura y de autosave).

### 2.5 · [VERIFICADO · BAJA] `tl.audioCollapsed` ya no se guarda: el «reabre plegado» de R110 está muerto

`serProject` (`app.js:9186`) escribe `tl:{bpm,sig,tcMode,pxPerSec,inlineCurves}` — sin `audioCollapsed`.
El lector sigue existiendo (`app.js:9457`) y las preferencias de workspace tampoco lo llevan
(`app.js:10204`). Resultado: el módulo de audio abre SIEMPRE desplegado; el campo que el lector espera no
lo escribe nadie. No hereda nada (el `!!` lo fuerza a false) — es una función que murió en silencio en
alguna reescritura de `serProject`. Decisión pequeña para Beltrán: revivirla (añadir el campo al
serializador) o retirar el lector.

### 2.6 · [VERIFICADO · BAJA] Con lienzos de aspecto >512, el viewport de relleno se recorta en silencio y el mapeo se rompe

`setCompSize` acota cada lado a `[64, GL_MAXSIDE]` por separado (`app.js:693`): con un lienzo de 16000×20
la textura queda 16000×64 y el viewport de relleno pide `compH/Fy = 51 200 px` — por encima de
`MAX_VIEWPORT_DIMS` (32 767 en la RTX 4060). El driver **recorta el viewport en silencio** mientras
`mstrU/mstrV` siguen calculando con el que pidió `compFillVp()` (`app.js:452`): el contenido se coloca
contra un viewport que no es el real. Medido en el `.exe` (`aud2608-forma-extrema.mjs`, casos f/g:
`vpClampeado:true`, calculado 51 200 vs real 32 767). **Umbral: aspecto > 512** (= 32 767/64), en los dos
ejes. Inalcanzable con salas reales (4 muros 4K = aspecto 7,1; haría falta un muro de 30 px de alto) —
sólo se llega tecleando una resolución absurda en un 2D custom. Por eso BAJA: el arreglo barato es acotar
el aspecto del lienzo al crear (o avisar), no complicar el composite.

---

<a name="area-2"></a>
## 3 · Área 2 · Recursos y rendimiento

### 3.1 · [VERIFICADO · **MEDIA/ALTA con medios reales**] `loadProject` no libera los medios del proyecto anterior: fuga de texturas GL por cada proyecto abierto

`newProject` desecha todo lo del proyecto saliente: `disposeMedia(m)` por cada media y `deleteTexture` de
cada `maskTex` (`app.js:9231-9232`). **`loadProject` no**: su limpieza (`app.js:9416`) cubre `_vinst`,
`_fxHist`, `mediaTrash`, `_lutReg`… pero `state.media` se REEMPLAZA (`app.js:9421`) sin `disposeMedia` de
los viejos, y `state.clips` (`app.js:9418`) sin borrar sus `maskTex`.

**Medido en el `.exe`** (`aud2608-fugas.mjs`): 4 ciclos «demo domo → abrir proyecto» dejan las texturas GL
vivas en **5 → 10 → 15 → 20** (+5 por ciclo, nunca vuelven), con `_vinst/_fxHist/_nestPool/_ra` limpios.
Con el demo son texturas pequeñas (formas/texto); con un proyecto real cada media de vídeo aporta su
textura de fotograma (una tira 7196×912 son 26 MB) más `originalEl`/`el` (elementos `<video>` con su
decodificador) y object-URLs sin revocar. Abrir 4-5 proyectos pesados seguidos en una jornada de montaje
acumula cientos de MB de VRAM/RAM que sólo devuelve reiniciar. El arreglo es simétrico al de `newProject`:
las mismas dos pasadas de dispose al entrar en `loadProject`.

### 3.2 · Línea base de rendimiento: vigente, no re-medida a ciegas

El binario desplegado ES el que midió R241 (misma huella de código), así que su línea base sigue siendo la
referencia (4 capas 7196×912: 60,2 fps · 0,05-0,07 ms de GPU por render · scrub con proxy 8 ms). No se
repitió la prueba de estrés: nada del delta posterior la toca (no hay delta posterior).

### 3.3 · [VERIFICADO] El scrub sin proxy, cuantificado hasta la causa — y la vía de mejora con números

R241 dejó el diagnóstico en «reposicionamiento del decodificador HEVC». Esta pasada midió el material:
**GOP de 250 fotogramas** (ffprobe sobre `Neuro1_7196.mp4`: I-frames en 0, 250, 500 — 4,2 s a 60 fps). Un
seek exacto decodifica hasta 250 fotogramas de 6,5 Mpx: a ~220 fps de decodificador hardware son los
~1 148 ms medidos. No es arreglable «optimizando»: es el coste de exactitud sobre GOP largo.

Vías reales, por coste (ninguna aplicada; ver Decisiones):
1. **Previsualización al keyframe más cercano durante el arrastre** + seek exacto al soltar. Decodificar 1
   fotograma en vez de ≤250 → **~10-40 ms por muestra de scrub, 30-100× mejor**, con la imagen «a saltos
   de 4 s» mientras se arrastra (lo que hacen Resolve/Premiere en modo rápido). Toca `vinstSeek`/el camino
   de scrub; el cabezal y el audio no cambian.
2. **Detectar material pesado al importar y OFRECER el proxy** (bitrate×resolución sobre umbral →
   un aviso con botón). No contradice ADR-0003 (sigue siendo manual: es información, no automatismo), pero
   roza su espíritu → decisión de Beltrán. R241 demostró que con este material el proxy no es optimización
   sino condición de montaje.
3. Scrub-ahead (`_raOn`) encendido por defecto cuando hay media pesada: mitiga el re-scrub sobre la misma
   zona, no el primer toque. Complementaria de la 1.

---

<a name="area-3"></a>
## 4 · Área 3 · Lado Electron

### 4.1 · [VERIFICADO · MEDIA] La página de descarga del runtime NDI no abre nunca: `window.open('_blank')` está denegado por diseño

`main.js:226-236` (`setWindowOpenHandler`) sólo permite `frameName==='domeViewer'` y **deniega todo lo
demás** — correcto como política. Pero `app.js:1708` y `app.js:1774` responden al «¿Abrir la página de
descarga?» del runtime NDI con `window.open(url,'_blank')`. Verificado en vivo en el `.exe`:
`window.open('https://…','_blank')` devuelve `null` (denegado). En una máquina sin runtime NDI el usuario
acepta el diálogo y **no pasa nada**, sin error. Arreglo: un canal `dsp:openExternal` en main con
`shell.openExternal` y una allowlist (p. ej. sólo `ndi.video`/`ndi.link`), y usar ese en los dos sitios.

### 4.2 · [VERIFICADO-estático · macOS] Reabrir desde el Dock crea una ventana que nunca se muestra

En macOS, cerrar la ventana no cierra la app (`main.js:285`) y el clic del Dock dispara
`app.on('activate')` → `createWindow()` (`main.js:286`). La ventana nace con `show:false` y sólo se
muestra en `finishBoot()` (`main.js:163-170`)… que tiene el guard `if(bootDone)return;` y **`bootDone` ya
quedó en `true` desde el primer arranque**. Ni el `dsp:bootReady` del renderer ni el salvavidas de 25 s
la mostrarán: la app queda «abierta» sin ventana, y la única salida es Cmd+Q. No ejecutable aquí (no hay
Mac), pero el flujo es inequívoco en el código. Arreglo: en `activate`, o resetear `bootDone=false` antes
de crear (y re-armar el salvavidas), o mostrar directamente cuando `bootDone` ya es true.

### 4.3 · [VERIFICADO-estático · macOS] `ncBuild` une rutas con `'\\'` cableado — la familia R204 tiene dos supervivientes

`app.js:7773` (`dir=currentPath.slice(0,i)+'\\nest proxies'`) y `app.js:7776` (`outPath=dir+'\\'+…`). En
macOS eso crea la carpeta y el archivo con la barra invertida DENTRO del nombre, un nivel por encima —
exactamente lo que R204 arregló «en una docena de sitios» (existe `PSEP`, `app.js:2497`, para esto). Es el
único superviviente: el barrido del resto del archivo no encontró más uniones cableadas. En Windows es
inocuo, por eso nadie lo ha visto.

### 4.4 · [VERIFICADO] Empaquetado post-rename: el paquete está bien; el DEPLOY manual ya falló una vez

- **Las 3 instalaciones llevan el mismo `app.asar`** (byte-idéntico, 2026-08-04 14:25 = R241) ✓.
- **Spout viaja aunque `build.files` no lo lista.** `files` (`package.json:50-62`) y `asarUnpack` sólo
  nombran `dsp-ndi-send`, pero electron-builder incluye las dependencias de `package.json` por su cuenta y
  auto-desempaqueta los `.node`: verificado en el paquete real (los DOS addons están en el asar y sus
  `.node` en `app.asar.unpacked`). O sea: no hay bug hoy, pero **la lista explícita de `node_modules` en
  `files` es redundante y engañosa** — sugiere que Spout falta cuando no falta. Documentarlo o simetrizarla.
- **[Hallazgo de deploy] La instalación canónica tiene `app.asar.unpacked\app.asar.unpacked\…`**: una copia
  anidada completa de la carpeta dentro de sí misma. El `dist\win-unpacked` recién compilado NO la tiene →
  fue un accidente del ritual manual (copiar la carpeta DENTRO de la carpeta). Hoy es sólo basura (~7 MB
  duplicados; Electron resuelve por la ruta correcta), pero demuestra que el paso manual del unpacked es
  propenso a error. Además la carpeta unpacked desplegada es del 29-07 mientras el asar es del 04-08 —
  inocuo mientras los addons no cambien, que es exactamente el tipo de condición que un día deja de
  cumplirse (el gotcha ya documentado de R111). Sugerencia: que el deploy copie `resources\` entera o use
  siempre el instalador silencioso.
- El unpacked embarca **fuentes `.cpp/.h`, `.iobj/.ipdb` y tlogs** del addon (varios MB): cosmético,
  excluible con dos globs.
- `build.files` contra lo que referencian `index.html`/`splash.html`/`main.js`: **completo** (fuentes e
  imágenes caen bajo `assets/**/*`; no hay archivo de arranque fuera de la lista).

### 4.5 · [OBSERVACIÓN · decisión] La superficie IPC no valida rutas: el renderer puede leer/escribir/borrar cualquier archivo del usuario

`dsp:readText/writeText/writeBinary/deleteFile/rename/openRead/fileOpen/listDir/ensureDir/exists` aceptan
rutas arbitrarias (`main.js:296-407`), y `preload.js` las expone tal cual. Para una app de escritorio sin
contenido remoto es el modelo de amenaza aceptado (el renderer es código propio; `setWindowOpenHandler`
deniega ventanas; no se navega a URLs). El riesgo real es indirecto: **cualquier inyección de HTML en el
renderer** (nombres de archivo/medios/proyectos que acaben en `innerHTML` sin escapar) escalaría a disco
completo. No se encontró un vector concreto en esta pasada (los nombres pasan mayormente por
`textContent`/plantillas controladas), pero no se barrió el 100 % de los `innerHTML` (~200 usos). Queda
como decisión: aceptar y documentar, o acotar los canales destructivos (`deleteFile`/`writeText`) a
raíces conocidas (userData, carpeta del proyecto, carpeta de export elegida).

Menores del mismo lado: `toFileURL` (`preload.js:117`) no escapa `%` (un archivo con `%20` literal en el
nombre resuelve mal); los timeouts/validaciones de `dsp:readAt` están bien (tope 256 MB, `Buffer.alloc`).

---

<a name="area-4"></a>
## 5 · Área 4 · Deuda diferida de julio, constatada

| Ítem de julio | Estado a 2026-08-04 |
|---|---|
| Refactor `openExport` («sólo al volver a tocarlos») | **Se volvió a tocar y creció**: 347 → 369 líneas. Sigue monolito. |
| Refactor `_renderInspectorMain` | **Se volvió a tocar y creció**: 346 → 391 líneas (R225). Sigue monolito. |
| Refactor `bindAutoCurve` | Sin tocar: 194 líneas, igual que julio. La regla se cumple aquí. |
| Migración centralizada de `.isp` | **La deuda creció y ya cobró intereses**: `loadProject` pasó de 42 a 71 líneas de migraciones a mano (`nestScrollT`, zoom R240b, `stripH`, `migrateRoomFloor`, `migrateNestFulldome`, `migrateMotionWet`…), y los hallazgos 2.1/2.2/2.3 de este informe son exactamente el tipo de bug que una tabla de *defaults* centralizada habría impedido (campo ausente → SIEMPRE valor de fábrica, nunca el heredado). |
| Interfaz de la cola de export | La UI mínima de R216 existe (fila por trabajo, ✕ individual, «Cancel queued», `app.js:8073-8111`); la interfaz completa sigue sin decidir. **[D2] (encoder en segundo plano) está RETIRADO por Beltrán (2026-08-04)** — fuera de la mesa; la interfaz es la parte que sigue viva. |
| Aviso de rutas fuera de la carpeta del proyecto · renderTimeline incremental 300+ clips | Sin cambios; siguen diferidos con la misma razón. |

---

<a name="plan"></a>
## 6 · Plan priorizado por etapas

Cada etapa = un commit verificable con las sondas indicadas. El criterio es el del encargo: primero lo que
corrompe datos, después lo que se siente, después robustez, al final deuda.

### Etapa 1 — Integridad de datos: matar la familia «herencia entre proyectos» de raíz (ALTA, ~1 sesión)
1. En `loadProject`, **resetear a fábrica ANTES de leer `obj`** todo campo de proyecto que hoy sólo se
   escribe `if(obj.X)`: `seqMode:'dome'`, `seqCov:180`, `tl.bpm:120`, `tl.sig:4`, `tl.tcMode:'timecode'`,
   `lanes:defLanes()` (como default de `obj.lanes`), y el par global `view.zoom/pan/cam` + `view.vp`
   (mismo reset que ya hace `newRoomProject`). Aplicar el mismo reset de vista en `newProject`.
   Idealmente: extraer una tabla `PROJ_DEFAULTS` y un único punto de aplicación — es la «migración
   centralizada» que julio pidió, hecha mínima.
2. Pelar el BOM en los `JSON.parse` de apertura y de autosave (una línea por sitio).
3. Verificación: `aud2608-herencia.mjs` (h1 y h1b deben dar `hereda:false`; h2 debe dar
   `seqCreada.modo:'dome'`, `tlTras` 120/4/'timecode'), `aud2608-legacy-bom.mjs` (sin alerta) y
   `aud2608-legacy-migra.mjs` (sin regresión).

### Etapa 2 — La fuga de medios en `loadProject` (ALTA por acumulación, ~½ sesión)
1. Replicar en `loadProject` las dos pasadas de dispose de `newProject`: `disposeMedia` de cada media
   saliente y `deleteTexture` de cada `maskTex` de los clips salientes, antes de reemplazar
   `state.media`/`state.clips`.
2. Ojo con el orden: después de `saveActiveSeq()` implícito ninguno — `loadProject` no guarda la secuencia
   activa (el proyecto saliente se descarta), así que el dispose es seguro; el único cuidado es no tocar
   medios que compartan textura con `mediaTrash` ya desechado (hoy no ocurre).
3. Verificación: `aud2608-fugas.mjs` — `texTrasLoad` debe quedar plano (5,5,5,5), no 5→20.

### Etapa 3 — Robustez Electron/plataforma (MEDIA, ~1 sesión)
1. Canal `dsp:openExternal` con `shell.openExternal` + allowlist; usarlo en `app.js:1708`/`1774`.
2. macOS: arreglar el `activate` (4.2) — mostrar la ventana recreada cuando `bootDone` ya es true.
3. `PSEP` en `ncBuild` (`app.js:7773`/`7776`).
4. Deploy: borrar el `app.asar.unpacked\app.asar.unpacked` anidado de la instalación canónica y cambiar el
   ritual a «copiar `resources\` completa» (o instalador `/S`), para que asar y unpacked no puedan
   divergir. Documentarlo en `CLAUDE.md` (sección Deploy).
5. Verificación: sonda de `window.open` (en vivo), lectura del árbol de `resources\`, y en el Mac —cuando
   haya uno— el ciclo Cmd+W → Dock.

### Etapa 4 — El scrub sin proxy (rendimiento que se siente; requiere decisión previa, §7.2)
1. Si Beltrán aprueba: prototipo de scrub al keyframe (decodificar sólo el I-frame ≤ t durante el
   arrastre, seek exacto en `pointerup`). Medir con las sondas de R241 (`r241-medir.mjs`): objetivo
   mediana <50 ms sin proxy.
2. Si además aprueba el aviso de proxy al importar: umbral (p. ej. >1080p y >80 Mbps) + botón en el aviso.

### Etapa 5 — Deuda y limpieza (BAJA, oportunista)
- `audioCollapsed`: revivir o retirar (decisión §7.4).
- Simetrizar/limpiar `build.files` y excluir fuentes del unpacked.
- Acotar el aspecto del lienzo a ≤512 al crear secuencias/proyectos custom (cierra 2.6).
- `toFileURL` con `%`.

---

<a name="decisiones"></a>
## 7 · Decisiones para Beltrán (no se ejecutan sin su OK)

1. **Encuadre del visor entre proyectos** (2.3): la opción recomendada es resetear siempre al abrir/crear
   (coherente con `newRoomProject` y con el espíritu de R239); la alternativa es guardarlo en el `.isp`
   como parte del proyecto (más «volver donde estaba», pero más estado que migrar). Coste: trivial la
   primera, pequeña la segunda.
2. **Scrub sin proxy** (3.3): ¿previsualización al keyframe más cercano durante el arrastre (imagen «a
   saltos» de hasta 4 s mientras se arrastra, exacta al soltar; ~30-100× más fluida)? ¿Y el aviso de
   proxy al importar material pesado (roza ADR-0003: sigue manual, pero la app toma la iniciativa de
   avisar)? Son independientes; la segunda es la que más protege el caso real de R241.
3. **Hardening de IPC** (4.5): aceptar y documentar el modelo actual (recomendado si no se van a abrir
   `.isp` de terceros con regularidad), o acotar `deleteFile`/`writeText`/`writeBinary` a raíces
   conocidas (coste ~½ sesión, algo de fricción en features futuras).
4. **`audioCollapsed`** (2.5): ¿revivir (una clave más en `serProject.tl`) o retirar el lector? Coste
   idéntico (~3 líneas); es decidir si la promesa de R110 sigue en pie.
5. **Interfaz completa de la cola de export** (pendiente desde julio, con [D2] ya retirado): ¿se diseña, o
   se declara suficiente la UI mínima de R216 y se cierra el pendiente?

---

<a name="diferido"></a>
## 8 · Diferido (no bloquea, con su razón)

- **Aspecto >512 del lienzo** (2.6): no alcanzable con salas ni domos reales; sólo resoluciones custom
  absurdas. Se cierra barato en Etapa 5; no urge.
- **`state.lanes=obj.lanes||state.lanes`** con archivo sin `lanes`: no se conoce archivo real que lo
  dispare; queda cubierto de todos modos por la tabla de defaults de Etapa 1.
- **Refactors grandes** (`openExport`, `_renderInspectorMain`): mismo criterio que julio — pero constatado
  que «sólo al volver a tocarlos» no se está cumpliendo (§5); si se vuelven a tocar en la próxima ronda,
  el refactor debería ir en ese mismo commit.
- **Barrido exhaustivo de `innerHTML`** (~200 usos) buscando inyección desde nombres de archivo: no se
  encontró vector en el muestreo; hacerlo completo es ~1 sesión y sólo tiene sentido si se decide el
  hardening de 4.5 — van juntos.
- **Prueba de estrés repetida**: sin sentido hasta que entre código nuevo; la línea base R241 es de este
  mismo binario.
- **Rama macOS ejecutada**: imposible sin Mac; 4.2 y 4.3 quedan listados para verificarse el primer día
  que haya uno (junto con el tope H.264 de VideoToolbox que `docs/MACOS.md` ya marca como sin medir).

---

## Apéndice · Sondas y fixtures de esta auditoría

| Archivo | Qué prueba |
|---|---|
| `scratchpad/aud2608-forma-extrema.mjs` | Formas extremas del composite de relleno (límites GL, clamp de viewport, exactitud del mapeo) |
| `scratchpad/aud2608-encuadre.mjs` | Encuadre por secuencia: ida y vuelta padre⇄nido |
| `scratchpad/aud2608-herencia.mjs` | Herencia entre proyectos: vista global, legacy seqMode/cov, tl.bpm/sig/tcMode |
| `scratchpad/aud2608-legacy-bom.mjs` + `aud2608-legacy-v2-bom.rdome` | Apertura de proyecto con BOM |
| `scratchpad/aud2608-legacy-migra.mjs` + `aud2608-legacy-v2.rdome` / `aud2608-legacy-v3.ise` | Migraciones v2/v3 y viaje a v4 |
| `scratchpad/aud2608-fugas.mjs` | Fuga de texturas de media en ciclos de cambio de proyecto |
| `scratchpad/r237-verify3.mjs` (del autor, re-ejecutada) | Export por-muro difMax 0 + sala 3D sin franja, ahora sobre el `.exe`/RTX |

Todas asumen el `.exe` canónico lanzado con `--remote-debugging-port=9222` y dejan la app en un proyecto
limpio al terminar. La GPU se confirma con `scratchpad/gpu-check.mjs`.
