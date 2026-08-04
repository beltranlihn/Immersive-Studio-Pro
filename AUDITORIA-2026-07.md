# Auditoría integral — Immersive Studio Pro · 2026-07-29

> Contexto: el software está funcional y entra en producción con clientes esta semana. Esta auditoría es la fase de
> *fine tuning*: levantar TODO lo que está bien, lo que está mal y lo que se puede mejorar, en 4 áreas, y cerrar con
> un plan de mejoras priorizado. Metodología: Fable planifica/verifica/consolida; agentes Sonnet ejecutan el
> levantamiento (código por dimensiones + QA destructivo vía CDP sobre la app corriendo + medición de recursos +
> heurísticas UX/UI). Los hallazgos se reportan con severidad, ubicación y escenario de fallo.
>
> Estado del código auditado: commit `1efdc07` (R211, sala 360 geometría + suelo dockeado), ya deployado.

## Índice
1. [Área 1 · Código](#área-1--código) — correctness, rendimiento/fugas, estructura/deuda, lado Electron
2. [Área 2 · Usabilidad realista](#área-2--usabilidad-realista) — QA destructivo de flujos de editor
3. [Área 3 · Recursos](#área-3--recursos) — RAM/VRAM/CPU/fps medidos en vivo
4. [Área 4 · UX/UI](#área-4--uxui) — distribución, affordances, consistencia
5. [Plan de mejoras priorizado](#plan-de-mejoras-priorizado)

---

## Área 1 · Código

### 1a. Correctness / robustez

**Hallazgos:**

- **[ALTA] app.js:8100 + 6414 — los atajos de teclado NO se bloquean durante un export del panel principal.** El
  guard global de atajos solo mira `.overlay`, pero el panel de Export usa la clase `exs-scrim` (bloquea ratón, no
  teclado). `runExport` lee `state.clips` en vivo en cada iteración: un Ctrl+Z o Supr a mitad de export dispara
  `undo()`/borrado y el archivo sale con fotogramas de ANTES y DESPUÉS mezclados, sin aviso. (Render-in-place sí
  usa `.overlay` y está a salvo.) *Fix: añadir `#exOv` al guard (o unificar la clase).*
- **[ALTA] app.js:5671 + 7710-7720 — el autoguardado puede escribir el timeline TRUNCADO durante Render-in-place.**
  `renderInPlace()` deja `state.clips = [un solo clip]` durante todo el bake (minutos con codec por software); el
  timer de autoguardado (cada 15 s) no mira `exporting` y persiste vía `saveActiveSeq()` un proyecto casi vacío en
  `.autosave1/2` — si la app se cae en ese intervalo, la única recuperación es ese autosave truncado. Además, tras
  restaurar, `activeSeq().nestClips` queda apuntando al array truncado hasta la próxima `saveActiveSeq()`. *Fix:
  pausar el autoguardado mientras `exporting`/`isolateClips` activo.*
- **[MEDIA] app.js:2140-2150 + 7655-7656 — Ctrl+Z no recupera un medio borrado si ningún clip lo usaba.**
  `deleteMedia` hace `pushUndo()` (promete deshacer), pero `restore()` solo resucita del trash los medios
  referenciados por clips restaurados. Importar un vídeo, borrarlo del panel sin haberlo usado, Ctrl+Z → no vuelve.
  *Fix: resucitar siempre el trash de ese push (o incluir media en el snapshot).*
- **[MEDIA] app.js:6736 — la cola de export muta `state` vivo, no un snapshot** (confirmación por lectura del gap
  documentado [D2]): cada job lee `state.clips` cuando le toca correr. Hoy el scrim lo tapa; si mañana se permite
  editar con jobs en cola, los jobs 2-N compondrían con los cambios intermedios. *Fix: snapshot por job al encolar.*
- **[BAJA] app.js:2142 — `state.mediaTrash` crece sin límite en la sesión** (los borrados nunca usados no se purgan
  jamás). Solo memoria de sesión (no se serializa). *Fix: purga al guardar/cerrar o al vaciar el stack de undo.*

**Zonas revisadas y sanas (verificado):** el gotcha `UNPACK_FLIP_Y_WEBGL` correctamente guardado/restaurado en los
tres uploads especiales (LUT/curvas/NDI); `compositeFloorTex` restaura FBO y viewport en sus dos call-sites;
`hasKf()` siempre usado en contexto booleano (ni un caso violado); la migración de `.isp` legacy (v2/v3/v4)
defaultea `kf`/`nestClips`/`nestLanes`/`props.mask` consistentemente — sin accesos sin guardar detectados.

### 1b. Rendimiento y fugas de recursos (estático)

**Hallazgos:**

- **[ALTA] app.js:292,310,313 — `_lutReg` (registro de LUTs 3D) nunca se vacía.** Cada `.cube` importado crea una
  textura `TEXTURE_3D` en un Map global por path; no existe `clear()`/`delete()` en todo el archivo, ni al abrir
  proyecto nuevo. VRAM solo-crece durante la sesión. *Fix: LRU con tope + `gl.deleteTexture`, o limpiar en
  newProject/openProject.*
- **[ALTA] app.js:1273-1284 (`ndiTick`) y 1310-1319 (`spoutTick`) — cada salida recompone TODO el máster por su
  cuenta + `readPixels` síncrono en su propio `setInterval`.** No reutilizan el composite del `render()`: con NDI
  y/o Spout activos el coste de composición se duplica/triplica por frame y cada tick mete un stall de GPU (hasta
  60/s a hasta 4096²). *Fix: compartir la textura ya compuesta cuando el playhead coincide + doble-PBO asíncrono.*
- **[MEDIA] app.js:2333 (`renderTimeline`) — `innerHTML=''` reconstruye TODO el DOM de pistas/clips en cada
  llamada completa** (~100ms/10fps a 300 clips según medición documentada en el propio código). El trim ya tiene
  mitigación (`positionClips`), pero fades, keyframes, mute/solo, pegar atributos, etc. siguen reconstruyendo todo.
  *Fix: extender el patrón ligero a más rutas frecuentes.*
- **[MEDIA] app.js:892-903 (`drawScopes`) — con Scopes abierto, cada ~120ms `readPixels` de pantalla completa a un
  `Uint8Array` nuevo + `getBoundingClientRect()`.** Stall síncrono + varios MB reservados por llamada. *Fix: buffer
  reutilizado y muestreo a menor resolución.*
- **[MEDIA] app.js:3481-3484 (`onTLMove`) — en cada `pointermove` de un drag consulta todas las `.lane` y les hace
  `getBoundingClientRect()`.** Layout thrash proporcional al nº de pistas durante todo el arrastre. *Fix: cachear
  los rects al iniciar el drag.*
- **[BAJA] app.js:5365 (`reconcileVinst`) — reconstruye un Set recorriendo clips+nestClips al inicio de CADA
  `renderTimeline()`.** *Fix: solo cuando cambió la lista de ids.*
- **[BAJA] app.js:1127,1177,1242 — `new Float32Array(mvp)` alocado cada frame en los tres visores 3D.** *Fix:
  scratch de 16 floats reutilizado.*

**Lo que ya está bien optimizado (verificado, no rehacer):** render-ahead con LRU real (RA_MAX=120) y pool de
texturas; decoders por-clip capados (VINST_MAX=32, LRU, dispose completo de video/textura/rVFC); WebCodecs con
cierre disciplinado de VideoFrame/VideoDecoder y anillo acotado; frame-cache all-intra acotado (FC_MAX=64) con
pool; la papelera de media ya no retiene video/AudioBuffer/textura (fix histórico R92-T3); NDI/Spout limpian
intervalos y FBOs al apagarse.

### 1c. Estructura / deuda técnica

**Hallazgos:**

- **[ALTA] app.js:197 — `alert()` NATIVO en el handler de `webglcontextlost`.** El único alert/confirm/prompt crudo
  de todo app.js (gotcha explícito del proyecto: Electron no los soporta) — y es justo el mensaje que más importa:
  "tu trabajo se autoguardó" tras un reset de GPU. *Fix: `appAlert(...)` (cuidando el timing con la recarga a
  1800ms).*
- **[ALTA] app.js:2940 + 7313 + 7345 — el layout de la tira de sala (`x0/x1/stripW`) está reimplementado 3 veces**
  (launcher, editar geometría, crear sala). Un cambio futuro en uno y no en los otros dos desalinea las costuras
  entre preview y proyecto real. *Fix: extraer `layoutWallStrip(walls)` y llamarla desde los 3.*
- **[ALTA] app.js:5804 vs 5840 — la limpieza de banderas de reentrada del export está duplicada literalmente**, y
  olvidarla YA causó un bug de producción una vez (comentario en el propio código); la corrección fue copiar el
  bloque, no centralizarlo. *Fix: factorizar `_exportCleanup()` y llamarla en ambos sitios.*
- **[MEDIA] app.js:2612 + 6841 — dos formateadores de aspect-ratio por GCD con comportamiento distinto en el borde**
  (uno con tope→decimal, otro fracción cruda). *Fix: uno llama al otro.*
- **[MEDIA] app.js:6405-6753 — `openExport` (~348 líneas): plantilla + wiring de ~20 controles + máquina de fases
  en una función.** No urgente; separar cuando se vuelva a tocar.
- **[MEDIA] app.js:3829-4176 — `_renderInspectorMain` (~347 líneas) con todas las ramas por tipo** (ya en roadmap
  [I1]/[I2]).
- **[MEDIA] app.js:4879 — `bindAutoCurve` (~199 líneas): todos los gestos del canvas de automatización comparten
  estado en closures** (ya en roadmap [L6]).
- **[MEDIA] app.js:7382 — `loadProject` sin migración centralizada por versión** (cada campo se defiende solo con
  `||default`; la rama v3→v4 de sequences es la excepción). Sin bug confirmado hoy; patrón inconsistente. *Fix
  mínimo: documentarlo como decisión en COMPONENTS.md.*
- **[BAJA] app.js:7267 — `serProject` escribe `tl.audioH` que `loadProject` nunca lee** (vestigio R148).
- **[BAJA] app.js:1748-1749 + 5487 — `meters()` calcula RMS de audio EN CADA FRAME de reproducción y escribe en
  `#mL`/`#mR`… que ya no existen en el DOM** (VU-meter retirado en R148 sin quitar el cálculo). *Fix: quitar la
  llamada en `ploop`.*

**Bien estructurado (verificado):** el mapa vivo COMPONENTS/ARCHITECTURE/ADR es inusualmente completo (la mayoría
de hipótesis de bug oculto ya estaban documentadas); `exPx()` fuente única del tamaño de export; contrato de 4
puntos de `seqCov`; patrón `_drawFlat/_compAspect/_roomWrap` bien guardado/restaurado; reentrancia
`glLost`/`exporting` consistente. Contratos a añadir a COMPONENTS.md: los 3 sitios del layout de tira; el set de
banderas de `runExport` y sus 2 sitios de reseteo; qué campos de `serProject` son vestigiales vs restaurados.

### 1d. Lado Electron (main.js / preload.js / empaquetado)

**Hallazgos:**

- **[MEDIA] main.js:318-329 — los `FileHandle` del Map global `_fds` no se cierran si el renderer muere.**
  Escenario: un export revienta a mitad de escritura → el renderer se recarga solo (guardia de main.js:219-223)
  pero main queda con el archivo abierto en escritura → en Windows el .mp4 queda BLOQUEADO (no se puede reabrir/
  sobreescribir/borrar) hasta cerrar toda la app. *Fix: en `render-process-gone`, cerrar y vaciar `_fds`.*
- **[MEDIA] main.js — sin `uncaughtException`/`unhandledRejection` a nivel del proceso main.** Un error fuera de
  los handlers IPC (callback de exec, evento de app) tumba TODAS las ventanas sin mensaje. *Fix: logger de proceso
  que evite el cierre silencioso.*
- **[MEDIA] app.js:7599-7601 — "Guardar versión" (`saveIncremental`) ignora el booleano de `DSP.writeText` y
  siempre confirma "Saved vN".** Con disco lleno/bloqueado la escritura falla en silencio y el usuario cree tener
  un punto de restauración que no existe (a diferencia de `saveProject`, que sí chequea). *Fix: chequear + appAlert.*
- **[MEDIA] main.js — sin `powerSaveBlocker` durante export largo ni salida NDI/Spout.** Windows puede suspender
  el equipo a mitad de un render sin supervisión o de un show por NDI. *Fix: `powerSaveBlocker.start(...)` al
  arrancar export/NDI y `stop()` al terminar.*
- **[BAJA] main.js:301-362 — el puente FS del preload no valida que las rutas caigan dentro de carpetas del
  proyecto/caché/userData.** Riesgo real solo si algún día se intercambian `.isp` de terceros (media.path podría
  apuntar a cualquier archivo). *Fix mínimo: avisar cuando un media cae fuera de la carpeta del proyecto.*
- **[BAJA] main.js:224-228 — `unresponsive` sin contraparte `responsive` ni bandera de reentrada** (diálogos
  apilables). *Fix: bandera + listener responsive.*
- **[BAJA] main.js:331-333 — `DIAG_LOG` crece por append sin rotación.** *Fix: truncar sobre cierto tamaño.*

**Bien resuelto (verificado):** escritura de `.isp` atómica de verdad (temp + fsync + rename + `.bak`); ciclo de
vida ante crash del renderer (reload + autoguardado 15s + snapshots + oferta de recuperación); `contextIsolation`
con API curada por contextBridge (sin ipcRenderer crudo); manejo de GPU híbrida sin flags agresivos; `dsp:readAt`
con tope de 256MB.

---

## Área 2 · Usabilidad realista

QA destructivo sobre la app corriendo (CDP), con medios de vídeo reales. Capturas de evidencia en el scratchpad
de la sesión (`state-NN-*.png`).

**Hallazgos:**

- **[CRÍTICO] El export se cuelga con audio no decodificable y "Cancel" NO lo detiene; el visor queda bloqueado
  en "● RENDERING…" sin salida desde la UI.** Repro: sala 360 con 2 mp4 cuyo audio tira `EncodingError: Unable to
  decode audio data` al importar → Export → fase "Decoding video audio…" al 0% → Cancel no hace nada (>7 min en
  `exporting=true`, muy por encima del deadline de 180 s/archivo que el propio código define en `EX_AUDIO_MS`).
  Cerrar el diálogo deja el visor congelado indefinidamente; solo se recupera forzando `exporting=false` por
  consola. Causa probable (~app.js:5700): `cancelExport` solo se revisa ENTRE iteraciones del bucle de audio, no
  durante la promesa de decodificación en curso, y el deadline no dispara para estos archivos. *Fix: hacer la
  decodificación cancelable (race con el flag + timeout real) y restaurar el visor al cerrar.*
- **[CRÍTICO] El Size de un clip-nido recorta el contenido DESCENTRADO en vez de escalarlo como un clip normal.**
  Repro: domo, 3 clips con az/el distintos → nest → en la secuencia padre subir Size del nido 20→100: el contenido
  descentrado (p.ej. az=60) crece hasta ~70 y de ahí se recorta contra el borde del fisheye hasta casi desaparecer
  a 100; un clip NORMAL con los mismos az/el/size escala limpio (comparación directa en capturas state-17 vs
  state-18). Contraprueba: contenido centrado en el nido escala bien. Impacto directo: automatizar el Size de un
  nest (flujo clave) recorta el contenido a mitad de animación.
  **Diagnóstico (Fable, confirmado en código):** no es un bug de implementación — un nest de domo se dibuja por el
  camino fulldome (`PFD`, [N1], app.js:387-390 y 826-831): Size = zoom del máster fisheye COMPLETO alrededor del
  cenit (`u_scale=size/55`; az se reutiliza como rotación). Ópticamente correcto para un domo: al hacer zoom la
  periferia sale del disco. El choque es de EXPECTATIVA (el editor espera que escale "como un clip"). Es una
  decisión de diseño a tomar: (a) dejarlo (zoom óptico de cenit) y documentarlo en la UI, (b) añadir un modo de
  reencuadre que preserve el contenido (re-proyección con pivote configurable), o (c) ambas con un toggle.
- **[MEDIO] La barra de título no se actualiza al cambiar de secuencia entre modos.** Walls(room)→Floor(2D)→Walls:
  el título queda en "2D · …" hasta que otra acción llama `projTitle()`. Causa: `switchSeq()` (~app.js:6821) no
  llama `projTitle()`. Solo cosmético (el compositing usa `state.seqMode`, correcto en todo momento). *Fix: 1 línea.*
- **[BAJO] `EncodingError: Unable to decode audio data` al importar ciertos mp4** — no rompe importación ni
  preview, pero es la causa raíz del hallazgo crítico del export. *Fix ligado al primero: tratar el audio
  indecodificable como "sin audio" con aviso, no como bloqueo.*

**Flujos verificados OK (evidencia de solidez):** nest con preview IDÉNTICO al contenido directo y reflejo EN VIVO
de los cambios internos (la sospecha previa queda descartada); automatización dentro del nest y del propio nest
correcta; proxy de nest correcto y su detección de caducidad (`ncStale`) instantánea; undo/redo byte-idéntico en
lotes de 15 y 29 operaciones; validación de inputs del inspector sólida (clamp + rechazo de no-numéricos); valores
extremos degradan con gracia; sala 360: creación, tira+suelo dockeado (R211), seam-wrap Front↔Left y visor 3D con
muros y piso texturizados correctos; el diálogo de export valida códec vs resolución con aviso claro.

**No probado (pendiente para una segunda pasada):** reproducción real multi-clip con automatización simultánea y
métricas (se cubre en Área 3); atajos de teclado uno a uno; barrido sistemático de botones fantasma (se cubre en
Área 4); trim a duración 0, borrar media en uso, borrar secuencia activa, marcadores, work in/out invertido, zoom
extremo del timeline; export limpio de punta a punta con audio sano (verificación pendiente tras el fix del
hallazgo crítico).

---

## Área 3 · Recursos

Medición en vivo vía CDP con clips reales (1080p→4K). Tabla completa de mediciones en el reporte del agente;
resumen aquí.

**Sano (con carga de prueba de 4 clips 4K simultáneos):**
- **60.0-60.7 fps en TODOS los escenarios** (domo 2D/3D, sala 2D/3D con tira+suelo, nest, render-ahead llenando).
- `render()` livianísimo: avg 0.14-0.26 ms, max 1.3 ms (presupuesto: 16.6 ms/frame). CPU ~24% de un núcleo en
  play. Scrub de 50 seeks: ~16 ms/seek sin degradación ni crecimiento de memoria.
- 5 ciclos nuevo-proyecto→importar→descartar: RSS estable (1190→1184 MB tras reposo) — sin fuga detectable.
- La app quedó sana tras toda la batería (sin modales colgados ni zombies).

**En observación (WATCH):**
- **VRAM tras apagar render-ahead no vuelve al nivel previo** (5.1→5.3 durante→5.5 GB tras "cache cleared");
  dentro del ruido de medición, no concluyente — merece prueba dedicada con caché lleno del timeline completo.
- **El control de calidad Full/½/¼ no cambió nada medible** (ni render() ni VRAM): con 4 clips el composite es
  trivial; sugiere además que el FBO podría reservarse siempre al máximo. Confirmar con carga pesada real.
- **VRAM base del sistema 4.5/8.0 GB ya en el landing** (~2.5 GB de margen en esta GPU para el show real). No se
  pudo aislar cuánto es de la app.
- **Nest añade ~37% al costo de render()** (0.19→0.26 ms con 3 clips). Insignificante hoy; se acumula con nesting
  profundo.

**Metodológico:** `performance.memory` está discretizado en Electron (9.5 MB clavado toda la sesión) — inútil para
fugas; usar RSS por proceso o heap snapshots reales de CDP.

**No medido:** fuga de `_lutReg` en vivo (no hay `.cube` en el disco — queda confirmada solo por análisis
estático); carga de estrés tipo show (8-10 clips 4K/8K + LUTs + sala completa) — recomendado antes de la semana
de producción.

---

## Área 4 · UX/UI

Auditoría con capturas de cada zona (launcher, toolbar, media, timeline, inspector, diálogos, estados) + barrido
sistemático de botones. Capturas `ux-NN-*.png` en el scratchpad de la sesión.

**Hallazgos:**

- **[ALTO] Anidar con audio enlazado deja el nest INVISIBLE y sin controles.** `nestSelection` (app.js:1008) coloca
  el nido en la pista de MENOR índice de la selección (`used[0]`); con audio enlazado esa es una pista de AUDIO, y
  `activeClips()` (app.js:863) excluye del render los clips en pistas no-video → el nest desaparece del canvas sin
  aviso y el inspector solo muestra la sección Audio. **Esto confirma y explica la "sospecha grave" anotada en la
  memoria del proyecto** (un nest que no se ve igual que su contenido directo): el preview del nest es correcto
  (verificado en Área 2); lo que falla es a QUÉ PISTA cae. *Fix: elegir la primera pista de VIDEO entre las usadas.*
- **[ALTO] El aviso de códec del diálogo Export se trunca justo en la parte accionable** ("H.264 does not reach
  4096×4096 … (max 3072×3072). Lower the size…" → se ve "…on this machin…"), sin title de respaldo. *Fix: wrap de
  2 líneas o title con el texto completo.*
- **[ALTO] "New sequence" no ofrece el tipo 360 Room** — solo Dome/2D. Crear una sala exige File→"New 360 room…",
  que arranca OTRO proyecto (con descarte). Un editor en un proyecto domo no tiene ruta visible para anexar una
  secuencia de sala. *Fix corto: indicarlo en el diálogo; fix real: Room como tercer tipo del mismo diálogo.*
- **[MEDIO] El chip de parámetro de automatización se trunca ("Opa…") y perdió el title** que la versión anterior
  sí tenía (regresión reconocida en el propio código, R94-UT2·U-15 vs R156). *Fix: title con el nombre completo.*
- **[MEDIO] La sección "Effects" del inspector no sigue el patrón `.sechead`** (chevron + colapsable) del resto.
  *Fix: unificar.*
- **[BAJO] Botones de zoom del canvas (`vzOut`/`vzIn`) sin title** (de 133 botones, 105 tienen tooltip; estos dos
  son los únicos realmente "ciegos"). *Fix: title.*
- **[BAJO] Los errores solo aparecen como texto ámbar pequeño en la status bar 6 s** — coherente con la estética,
  pero fácil de no ver con la mirada en el canvas. *Decisión de diseño, no fix mecánico.*
- **[MEDIO, de Área 2] La barra de título no se actualiza al cambiar de secuencia** (`switchSeq` sin `projTitle()`).

**Botones fantasma: NINGUNO.** Barrido automatizado de ~104 botones visibles con colector de errores: cero errores
JS, todos con efecto verificable (los 5 candidatos con "delta 0" se verificaron a mano y funcionan).

**Bien resuelto (nivel profesional, con evidencia):** grading completo por clip (LGG + curvas + LUT) dentro del
inspector; diálogo de export con monitor en vivo, estimación de tamaño y avisos de capacidad; diálogo de sala 360
con esquema 3D + planta a escala; protección de cambios sin guardar consistente; automatización embebida en la
cabecera de pista (idea potente y poco común); menú contextual de clip completo con atajos visibles; onboarding
contextual al tipo de proyecto.

**No auditado:** cada entrada de cada menú/submenú; NDI/Spout (dependen de hardware); interacción 3D real (drag);
point mask interactivo; ventana viewer multi-monitor; lector de pantalla real; media con biblioteca grande;
proyecto 2D Flat dedicado.

---

## Plan de mejoras priorizado

> Criterio de prioridad: primero lo que puede corromper datos o un export en producción esta semana; después
> rendimiento percibido; después robustez; al final deuda/limpieza. Cada etapa = un commit verificable
> (node --check + verificación CDP dirigida). Los ítems de usabilidad/recursos/UX se integran cuando cierren
> sus áreas.

### Etapa 1 — Integridad de datos y export (ALTA, ~1 sesión)
0. **Export cancelable de verdad** (CRÍTICO de usabilidad): la decodificación de audio debe correr en `Promise.race`
   con `cancelExport` + deadline efectivo (`EX_AUDIO_MS`); audio indecodificable ⇒ tratar como "sin audio" con
   aviso (no bloquear); al cancelar/cerrar, restaurar el visor (nada de "● RENDERING…" perpetuo). [2]
1. Bloquear atajos durante export: añadir `#exOv` al guard global de atajos (app.js:8100). [1a]
2. Pausar autoguardado mientras `exporting`/render-in-place activo (app.js:7710). [1a]
3. `saveIncremental`: chequear el resultado de `DSP.writeText` + appAlert en fallo (app.js:7599). [1d]
4. `alert()` nativo del `webglcontextlost` → `appAlert` (app.js:197). [1c]
5. Ctrl+Z recupera media borrado aunque ningún clip lo use (restore del trash incondicional). [1a]
6. main.js: cerrar `_fds` en `render-process-gone`; handler `uncaughtException`/`unhandledRejection` con log. [1d]
7. `powerSaveBlocker` durante export y salida NDI/Spout. [1d]

### Etapa 2 — Rendimiento que se siente (ALTA/MEDIA, ~1 sesión)
8. `_lutReg`: tope LRU + `deleteTexture` (o limpieza en new/openProject). [1b]
9. NDI/Spout: reutilizar el composite de `render()` cuando el playhead coincide (dejar el doble-PBO para después). [1b]
10. Drag de clips: cachear rects de pistas al iniciar el drag (app.js:3481). [1b]
11. `drawScopes`: buffer reutilizado + muestreo reducido. [1b]
12. Quitar `meters()` muerto de `ploop` (VU-meter sin DOM). [1c]
13. `reconcileVinst` solo cuando cambian los ids; scratch Float32Array en los 3 visores 3D. [1b]

### Etapa 3 — Deuda que previene bugs (MEDIA, ~1 sesión)
14. Factorizar `_exportCleanup()` (2 sitios duplicados que ya causaron un bug). [1c]
15. Extraer `layoutWallStrip(walls)` y usarla en los 3 sitios. [1c]
16. Unificar formateadores de aspect (uno llama al otro). [1c]
17. Purga de `state.mediaTrash` al guardar/cerrar. [1a]
18. Quitar `tl.audioH` vestigial de `serProject`. [1c]
19. Contratos nuevos en COMPONENTS.md (tira ×3, banderas de export, campos vestigiales de serProject). [1c]
20. `unresponsive` con bandera + listener `responsive`; rotación de DIAG_LOG. [1d]

### Etapa 4 — Usabilidad y UX (ALTA/MEDIA, ~1 sesión)
21. **Nest a pista de VIDEO**: `nestSelection` debe elegir la primera pista de video de la selección, no `used[0]`
    (hoy el nest puede caer en una pista de audio y desaparecer del render). [4]
22. `switchSeq()` + `projTitle()` (1 línea): el título sigue al modo de la secuencia activa. [2]
23. Aviso de códec del Export con wrap de 2 líneas + title completo. [4]
24. Chip de automatización: title con el nombre completo del parámetro (reponer la mitigación R94-UT2·U-15). [4]
25. Sección "Effects" del inspector al patrón `.sechead` colapsable. [4]
26. `title` en `vzOut`/`vzIn`. [4]
27. Diálogo "New sequence": indicar que 360 Room existe y desde dónde se crea (la integración completa como
    tercer tipo queda en Decisiones). [4]

### Verificación de cierre (tras las etapas)
- Export limpio de punta a punta con audio sano + con audio indecodificable (debe avisar y seguir) + cancelación
  a mitad (debe volver en segundos). Re-correr los flujos OK de Área 2 como regresión.
- ~~Segunda pasada de QA pendiente: atajos uno a uno, trim a duración 0, borrar media en uso, borrar secuencia
  activa, marcadores, work in/out invertido, zoom extremo del timeline.~~ **CORRIDA en R240**
  (`scratchpad/r240-qa.mjs` + `r240-qa2.mjs`): seis de siete escenarios ya se comportaban bien. Un hallazgo real y
  arreglado — **el zoom guardado en el `.isp` entraba sin acotar** (los ocho gestos de la UI pasan por
  `TL_PPS_MIN/MAX`; abrir un proyecto era el único que no: con `pxPerSec:1e7` la línea de tiempo reservaba 33,5 M
  de píxeles de ancho y ningún gesto la recuperaba). Los atajos uno a uno siguen sin barrer de forma exhaustiva.
- Prueba de estrés tipo show (8-10 clips 4K/8K + sala completa) para ejercer de verdad calidad de preview,
  render-ahead y VRAM.

### Decisiones para Beltrán (no se ejecutan sin su OK)
- **Semántica del Size de un nest de domo**: hoy es zoom óptico sobre el cenit ([N1], la periferia sale del disco
  al crecer — comportamiento correcto para un domo, sorprendente para un editor). Opciones: dejar y documentar en
  la UI / modo reencuadre que preserva contenido / toggle con ambas.
- **Feedback de errores más prominente** (hoy: texto ámbar 6 s en la status bar): ¿toast/icono persistente?
- **360 Room como tercer tipo en "New sequence"** (esfuerzo mayor: hoy sala = proyecto entero, no secuencia suelta).
- **Interfaz de la cola de export** (pendiente previo, sigue diferido del handoff).

### Diferido (no bloquea producción)
- Snapshot por job en la cola de export ([D2], se vuelve urgente si se permite editar con jobs en cola).
- Refactors grandes: `openExport`, `_renderInspectorMain`, `bindAutoCurve` (solo al volver a tocarlos).
- Migración centralizada de `.isp` (documentar el patrón actual como decisión).
- Aviso de rutas de media fuera de la carpeta del proyecto (relevante solo si se intercambian .isp de terceros).
- renderTimeline incremental para proyectos 300+ clips (extender patrón positionClips).
