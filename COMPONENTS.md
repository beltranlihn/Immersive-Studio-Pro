# COMPONENTS — Mapa vivo de Immersive Studio Pro

> **Tipo (Diátaxis): Referencia.** Solo hechos: qué hace cada componente, dónde vive (`archivo · función` / `#domId`),
> su estado y su ticket de roadmap. El *relato* (cómo funciona el render, el porqué) está en [ARCHITECTURE.md](ARCHITECTURE.md);
> las *decisiones* en [docs/adr/](docs/adr/). Este archivo **es la estructura de carpetas** que `app.js` no tiene:
> es el índice para saltar directo a una función sin re-escanear las ~5000 líneas.
>
> **Regla anti-pudrición (docs-as-code):** cuando cambies código, actualizá la fila correspondiente **en el mismo commit**.
> Las líneas (`~L`) son aproximadas — orientan la búsqueda, no son exactas al dígito.
>
> **Estados:** ✅ estable · 🚧 en progreso / parcial · ⚠️ frágil / cuidado · 🗑️ obsoleto (a limpiar)
> **Verificado contra el código:** 2026-07-22 (mapeo por subagentes).

---

> Para **orientarse por primera vez** (los tres procesos, el modelo de datos, el recorrido de `app.js` por
> tramos de línea y las trampas conocidas), leer antes `docs/ESTRUCTURA-DEL-CODIGO.md`. Este fichero es el
> inventario de detalle.

## Índice maestro (jump table)

### 1 · Motor GL & shaders → [detalle](#1--motor-gl--shaders-detalle)
| Componente | Qué hace | Ubicación | Estado | Roadmap |
|---|---|---|---|---|
| GL2 context init | Contexto WebGL2 + helpers de compilación | app.js · `prog`/`sh` (~L118) | ✅ | — |
| PW (VSW/FSW) warp | Fisheye de domo + compositing de clip flat | app.js · `PW`/`LW` (~L213) | ✅ | R114 |
| PB (VSB/FSB) blit | Textura máster → pantalla (pan/zoom) | app.js · `PB`/`LB` (~L315) | ✅ | — |
| PFD fulldome | Máster fisheye dibujado 1:1. **[R305]** el ojo de pez se PLIEGA en el muestreo (`u_fishK`, var. `_fishFold`) en vez de pasar por una textura intermedia — sólo si es el único pre-pase (sin FX ni clave de negro); +12,1 % de nitidez, mismo aspecto (borde con `clamp`, como el pase viejo) | app.js · `PFD`/`LFD` (~L340), `FSFD`, `drawClip` | ✅ | R305 |
| PEQ equirect→domo | 360 equirect reproyectado al domo | app.js · `PEQ`/`LEQ` (~L365) | ✅ | [F7] |
| P3 (VS3/FS3) malla 3D | Máster sobre casquete esférico 3D | app.js · `P3`/`buildDomeMesh` (~L389) | ✅ | [U4], R114 |
| PR (VSR/FSR) sala 3D | Quads de muros+piso de la sala 360 | app.js · `PR`/`LR` (~L422) | ✅ | — |
| Structs de uniformes | Handles de attrib/uniform por programa | app.js · `LW/LB/LFD/LEQ/L3/LR` | ✅ | — |
| VAOs | Buffers de geometría por programa | app.js · `meshVAO`/`quadVAO`/`fdVAO`/`eqVAO` (~L298) | ✅ | — |
| Texture helpers | Crear/subir/reducir texturas de clip | app.js · `newTex`/`upTex`/`fitImage` (~L1243) | ✅ | — |
| UNPACK_FLIP_Y (gotcha) | Estado global de flip compartido | app.js · `makeLutTex`/`uploadCurveTex` (~L231) | ⚠️ | R116 |
| Post-process factory | Quad VS compartido + `ppCompile` para FX | app.js · `VSPP`/`ppCompile` (~L6534) | ✅ | R100 |

### 2 · Render, compositor & modos → [detalle](#2--render-compositor--modos-detalle)
| Componente | Qué hace | Ubicación | Estado | Roadmap |
|---|---|---|---|---|
| Composite FBO + máster tex | Target cuadrado 2048² para todos los clips | app.js · `compTex`/`compFBO`/`setCompSize` (~L430) | ✅ | [D4] |
| `render()` máster | Compone y despacha por modo view/seq | app.js · `render` (~L921) · #gl #grid | ✅ | [L7][R2] |
| `composite()` + colección | Dibuja clips activos; stacking + dissolves | app.js · `composite`/`compositeClips` (~L732) | ✅ | — |
| `drawClip()` dispatch | Rutea cada clip a PW/PEQ/PFD por flags | app.js · `drawClip`/`drawClipFlat`/`flatPlace` (~L669) | ✅ | [R2] |
| Bifurcación flat/domo/sala | Predicados rect vs fisheye | app.js · `isFlat`/`isRoom`/`flatLikeMode` (~L633) | ✅ | [F2] |
| Cobertura de domo (FOV) | Fuente única; rho=zenith/covHalf | app.js · `curCovHalf`/`f2azel`/`azel2f` (~L632) | ✅ | — |
| Blit 2D + mapeo flat | Blit aspect-correcto + grilla 2D | app.js · `render` blit (~L943) · `flatMap`/`drawGrid2D` | ✅ | [U3] |
| Ruta sala 3D | Quads de muros + piso (mismo composite, [R221]), cámara orbit/stand | app.js · `renderRoom3D`/`buildRoomGeo` (~L1184) | ✅ | [D4] |
| `resize()` | Dimensiona #gl/#grid al #stage con DPR | app.js · `resize` (~L1233) · #stage | ✅ | — |
| Render-ahead cache | Cache de composite plano para playback pesado | app.js · `_raOn`/`raInvalidate`/`drawCacheMap` (~L801) | ✅🚧 flag-off | — |
| `markDirty()` (hub) | Marca dirty + título + invalida render-ahead | app.js · `markDirty` (~L4900) | ✅ | — |
| Pill "Preparing media…" | Overlay 2D+3D si algún clip de vídeo activo no tiene textura aún | app.js · `mediaWarming`/`drawPreparingPill`/`clipTexReady` (~L1116) | ✅ | [R220] |

### 3 · Timeline, herramientas & clips/lanes → [detalle](#3--timeline-herramientas--clipslanes-detalle)
| Componente | Qué hace | Ubicación | Estado | Roadmap |
|---|---|---|---|---|
| `renderTimeline()` | Reconstrucción completa del DOM del timeline | app.js · `renderTimeline` · #tracks | ✅ | [T2]-[T5],[L1]-[L7] |
| `scheduleTimeline()` | Render coalescido por rAF / reposición liviana | app.js · `scheduleTimeline` | ✅ | — |
| Esqueleto DOM | Markup estático del timeline | index.html · #tracks/#trackHdr/#tlscroll | ✅ | — |
| Barra de transporte | Controles de playback + edición | index.html · `.transport` | ✅ | [U1],[U6] |
| Herramientas + tool rail | 6 herramientas + cursor | app.js · `setTool`/`applyToolCursor` · #toolRail | ✅ | [U7] |
| #tracks pointerdown | Dispatch selección/move/trim/razor/zoom | app.js · `$('#tracks')` pointerdown | ✅ | [T1],[T2] |
| Clip DOM (`.clip`) | Nodo renderizado por clip | app.js · loop de renderTimeline · `.clip` | ✅ | [T5],[T2] |
| Header de pista (`.lanehdr`) | Header + operaciones de lane. **[R230b]** `addLane`/`duplicateLane` conservan la SUPERFICIE (`lane.surf`): en una sala, una pista de vídeo sin `surf` cae al grupo de muros, y duplicar una de piso sigue siendo de piso. Pistas de audio con **tinte sutil** (`.aud` en cabecera Y fila) y menú con **ambas** opciones de pista nueva. **[R230]** las pistas de PISO de una sala se identifican por su tag enmarcado en azul (`.tag.floor` → F1, F2…), sin chapa «FLOOR»: nacen con `name===tag` y la cabecera omite el `.nm` cuando coinciden  **[R314]** `duplicateLane` clona con `duplicateClipAt` (clon canónico: sin `maskTex` serializada ni `link` compartido) pero CONSERVANDO `avRole` — sin él las copias de un par A/V vuelven a sonar y el audio se oye dos veces (+6 dB) en previsualización y máster; «Desenlazar» acepta `avRole` sin pareja para que la copia muda siga siendo recuperable | app.js · renderTimeline · `.lanehdr`/`.lane.aud`/`.lane.floor`/`.tag.floor` · `trackCreateItems`/`roomDefLanes`/`addLane`/`duplicateLane` | ✅ | R314 |
| Reorden de lanes | Arrastrar header para reordenar | app.js · `startLaneDrag` | ✅ | — |
| ~~Módulo de audio anclado~~ | **RETIRADO R148** — audio unificado en la columna principal (#tracks/#laneHeaders), al final | app.js · renderTimeline · #audioZone/#audioHeadZone (vaciados) | 🗑️ | Rev1 §6 |
| Barra vertical del timeline | Espejo de la horizontal: cuerpo = scroll · casquetes = alto de pistas. Una sola (la nativa se oculta) | app.js · `renderVZoom`/`startVBarDrag`/`startVCapDrag` · #tlVZoom | ✅ | R152 |
| Menú "More" del visor | Repliega overlays/calidad/Output/lecturas **por medición** (umbrales del diseño + escalada mientras desborde) | app.js · `VP_BP`/`_vpHide`/`vpFits`/`updViewCtl`/`_updViewCtl`/`openVpMore` · #vpMoreBtn | ✅ | R152/R154 |
| Gesto de mover | Move/copy de clip con ghost. Partner A/V enlazado: sólo horizontal (`primaryIds` vs `items`). **[R231]** la pista destino se valida por la PISTA del clip (`isAudioClip`), no por el medio | app.js · `onTLMove`/`onTLUp` | ✅ | [R231] |
| **Solape = corte** | Al soltar, el clip movido RECORTA al quieto (no destructivo; parte en dos si cae dentro). Sin fundido automático | app.js · `cutOverlapsOnDrop`/`_cutEdgeTo`/`_dropClip` | ✅ | [R223] |
| Trim contextual | ripple/roll/slip/slide (T); espeja el recorte en el partner enlazado. **[R313·A10 → R314]** rebasa la automatización cuando el MATERIAL se mueve. La instantánea se toma DENTRO de `applyTrim` (`capAuto`, perezosa y cacheada en `base`), no en el llamador: así queda cubierto también `trimNudge` —el mismo recorte por TECLADO, que en R313 era un no-op— y no se puede invocar sin ella. Y el rebase del PARTNER enlazado vive en `_mirrorLinkTrim`. **[R320]** aquel «punto único por el que pasan los cinco modos» no lo era —son SIETE llamadas— y faltaban tres cosas: `slip` no rebasaba el clip agarrado (su mitad enlazada SÍ, así que un par A/V quedaba con vídeo y audio desalineados), `slide` no rebasaba a su vecino de la derecha, y `slide` y el crossfade llamaban sin instantánea. Deuda anotada: `slide` no captura `pLinkBase`/`nLinkBase`, así que las mitades enlazadas de sus vecinos no se mueven con ellos (el roll sí las captura). | app.js · `trimZone`/`applyTrim`/`capAuto`/`_mirrorLinkTrim`/`rebaseAutoPorMaterial` | ✅ | R314 |
| Trim por handle | `.hd.l`/`.hd.r` resize. **[R320]** el rebase de keyframes ya NO está duplicado aquí: `trimItem` delega en `rebaseAutoPorMaterial`, que nació como copia suya en R313 y había recibido dos arreglos que el original nunca vio (sin `src.length>1`, saltando entradas vacías). | app.js · `trimItem` / drag.trimL/R | ✅ | [T2] |
| Fades + **crossfade manual** | Handle de esquina: hacia dentro = fundido · hacia fuera sobre el corte = fundido cruzado (vídeo por geometría, audio por ganancia) | app.js · `startFadeDrag`/`crossfadeNeighbor` · `.fadeh`/`.xfade` | ✅ | [R223] |
| Razor & split | Cortar clip / Ctrl+E | app.js · `razorCore`/`splitAtSelection` | ✅ | — |
| Selección temporal & marquee | Selección por span/rect → loop | app.js · `startTimeSelect`/`startMarquee` | ✅ | — |
| Snap | Snap a borde/playhead/marcador/grilla | app.js · `applySnap`/`snapTargets` | ✅ | [T2] |
| Zoom | Zoom anclado al cursor (+ scrollbar custom `#tlZoomBar` con caps de zoom) | app.js · `tlZoomAt`/`zoomToClip`/`renderZoomBar` | ✅ | — |
| Ruteo de rueda | Ctrl/Cmd=zoom · Alt=alto de pistas · Shift=pan H (deltaY o deltaX: macOS convierte Shift+rueda en deltaX) · **deltaX dominante=pan H** (rueda del pulgar MX Master / trackpad; hace falta porque `#tlscroll` va overflow-x hidden) · vertical=nativo | app.js · handlers `wheel` de `#tlscroll`/`#trackHdr` | ✅ | R208 |
| Modo simple-clip | Agarre Premiere vs Ableton | app.js · `toggleSimpleClips` | ✅ | — |
| Regla & playhead | Scrub + arrastre de locator | app.js · #ruler pointerdown / `positionPlayhead` | ✅ | — |
| Marcadores / locators | Marcadores temporales con nombre, dibujados en la **mitad inferior** de la regla; selección exclusiva con clip/pista (prioridad de Ctrl+R) | app.js · `addMarker`/`jumpMarker`/`drawRuler` · `state.selMarkerId` | ✅ | [R223] |
| Pestañas de secuencia | Barra de secuencias abiertas (drag para reordenar) — **movida al transport** (R148); **[R239]** sin barra de scroll, se recorre con la RUEDA sobre las pestañas | app.js · `renderSeqBar`/`startSeqTabDrag` · #seqTabs (dentro de `.transport`) | ✅ | Rev1 §5 |
| Well de edición del transport | Simple · Auto · Grid · Fit | app.js · `toggleSimpleClips`/`toggleCurves`/`fitAll` · #tlEditSeg (#simpleClipBtn/#curvesBtn/#tlGridBtn/#fitAllBtn) | ✅ | Rev1 §5 |
| Menú contextual de clip | Acciones clic-derecho sobre clip | app.js · #tracks contextmenu | ✅ | [T1] |

### 4 · Automatización, keyframes & modulación → [detalle](#4--automatización-keyframes--modulación-detalle)
| Componente | Qué hace | Ubicación | Estado | Roadmap |
|---|---|---|---|---|
| Modelo de keyframes | Arrays por-param `c.kf[p]` | app.js · `CURVE_PARAMS`/`paramDef` | ✅ | — |
| easeF / bezSegY | Easing + bezier libre | app.js · `bezSegY` | ✅ | — |
| `hasKf` | Test de automatización (devuelve undefined ⚠️) | app.js · `hasKf` | ✅ | — |
| `evalP` | Evaluador puro de keyframes/base | app.js · `evalP` | ✅ | [A2]/[D1] |
| `setKf` / clearKf | Escribir/mergear/borrar keyframes | app.js · `setKf` | ✅ | — |
| `evalR` | Base+motion+mod en tiempo de render | app.js · `evalR` | ✅ | [L7] |
| `manualEdit` | Regla AE (editar valor → keyframe) | app.js · `manualEdit` | ✅ | [A2]/[D1] |
| Toggle modo automatización | inlineCurves → body.automode | app.js · `toggleCurves`/`syncAutoUI` · #curvesBtn (dentro de #tlEditSeg) | ✅ | [A1] |
| Param del lane (track) | Un overlay por pista (`lane._autoP`) = **única fuente de qué curva se ve** | app.js · `laneAutoP`/`openAuto`/`showAutomation`/`clipArmedTrackKeys` | ✅ | [A5]/[L3]/[L4] |
| Choosers device+param | 2 chips (Categoría/dispositivo + Parámetro con swatch); **[R224]** izquierda = Transform·Clip·Color + un dispositivo por Motion/Effect **aplicado**, con ◆ en lo ya automatizado; derecha dependiente | app.js · `autoCats`/`autoDuoText`/`autoCatKeyOf`/`autoHasKf`/`autoDevClip` · `.autoduo.txt .achip` | ✅ | R224 · Rev1 §6 |
| Sincronía inspector→curva | **[R224]** tocar un parámetro del inspector pone SU curva a la vista (sin exigir keyframe) | app.js · `focusAutoParam`/`trackKeyFor`/`showAutomationParam` | ✅ | R224 |
| Mix de Motion como parámetro | **[R224]** `mot:<param>:mix` (0-100 %) en `c.kf`/`c.props` — antes `a.wetKf`/`a.wet` aparte | app.js · `isMotKey`/`motKeyFor`/`evalWet`/`migrateMotionWet` | ✅ | R224 |
| ~~`autoDuo` (chooser con selects)~~ | **ARCHIVADO R224** — sin llamadores desde R156 | `_backup/deprecated/20260730-auto-duo-selects.js` | 🗄️ | ADR-0007 |
| Canvas de automatización | Canvas ventaneado por clip | app.js · `windowAutoCv`/`drawAutoCurve` | ✅ | — |
| Puntos (add/move/delete) | Gestos sobre el canvas | app.js · `bindAutoCurve` (`inv`/`nearKf`) | ✅ | [L6] |
| Ops de selección auto | select/nudge/tri-modo/taper | app.js · `nudgeAutoSel`/`autoSelApply`/`taperSel` | ✅ | R95 |
| Copy/paste automatización | Copiar curva, pegar en el clic | app.js · `pasteAutoAt` | ✅ | [L5] |
| Shape Box | Free-transform sobre selección | app.js · `shapeBoxApply` | ✅ | R95·B1 |
| Presets de easing | cubic-bezier presets | app.js · `applyEasePreset`/`EASE_PRESETS` | ✅ | R95·A4 |
| Simplificar curva (RDP) | Adelgazado de puntos | app.js · `simplifyAuto`/`rdpKeep` | ✅ | — |
| Automation Items (pool) | Curvas reutilizables pooled | app.js · `poolPropagate`/`applyItem` | ✅ | R95·D2 |
| Motor de modulación | Pila base→capas (lfo/audio/space) | app.js · `evalModStack`/`modSignal` | ✅ | R95·C1 |
| Panel de modulación | Lista de capas + espectro | app.js · `openModPanel` · `.modb` | ✅ | [A4] |
| Motion procedural | Rotator/Translator infinitos | app.js · `animOffset` | ✅ | — |
| ~~Override / re-enable (legacy)~~ | **ARCHIVADO R137** — máquina `_autoOff` de bypass | `_backup/deprecated/20260722-automation-override-and-perform-bake.js` | 🗄️ | ADR-0006 |
| ~~Perform-and-bake REC~~ | **ARCHIVADO R137** — play + performar → keyframes | `_backup/deprecated/20260722-automation-override-and-perform-bake.js` | 🗄️ | ADR-0006 |

### 5 · Export, proxies & decode → [detalle](#5--export-proxies--decode-detalle)
| Componente | Qué hace | Ubicación | Estado | Roadmap |
|---|---|---|---|---|
| Panel de export | **Hoja flotante** arrastrable + monitor de render + bloque de estado. **[R310]** declara `job.fail` y fase `'fail'`: un export que falla ya no se anuncia «Terminado · Guardado» (contador `S.batchFail`, para que un muro fallido no cuente como entregado ni deje el lote colgado) | app.js · `openExport` · #exOv.exs-scrim | ✅ | R310 |
| Monitor de render | 160×90, el fotograma que acaba de escribir el codificador | app.js · `exDrawMon`/`exFit` · #exMon | ✅ | R183 |
| `exPx()` | Fuente ÚNICA del tamaño de salida | app.js · `exPx` | ✅ | R183 |
| Cola de export | Registro de jobs uno-a-la-vez | app.js · `pumpExportQ` · #exQueue | ✅ | [D2] |
| `runExport` | Driver máster PNG/MP4/HEVC/HAP/still. **[R310]** los descriptores de HAP y del MP4 en streaming se cierran en `finally` (una excepción en el bucle dejaba el archivo a medias con el fd abierto → bloqueado en Windows hasta cerrar la app) | app.js · `runExport` (~L8411) | ✅ | R310 |
| **Export por FFmpeg** | H.264/H.265 a 4096² por el chip de vídeo, NV12 en GPU. **[R310]** dos fallos que se tapaban: `fn` no existía en su ámbito (todo export desde la HOJA moría con ReferenceError; las sondas lo esquivaban pasando `outPath`) y el bucle convertía `compTex`, que durante un export NO ESCRIBE NADIE → el MP4 salía con el fotograma del visor congelado. Ahora se codifica el LIENZO (`exLienzoATex`), como los otros tres caminos. **[R314 → R320]** y su bucle avanza `_arTime`: `renderExportFrame` es el único sitio que lo hace durante un export, y esta rama no pasa por él, así que el domo salía con los FX reactivos CONGELADOS en el instante del cabezal. R314 lo arregló sólo aquí y los DOS bucles de secuencia PNG seguían igual; R320 unifica los tres en **`pintarFotograma(t,resDome)`**, un único punto que decide plano/domo y pone el reloj. **[R320]** y el panel ya no ofrece estos dos códecs por el mero hecho de que exista el binario: `ffDisponible(v)` mira la LISTA de codificadores que devuelve `dsp:ffProbe`, por fila —un FFmpeg sin libx265 ofrecía H.265 y sólo fallaba al arrancar el render— | app.js · rama `ffh264`/`ffhevc` de `runExport` · `exLienzoATex` (~L8410) | ✅ | R314 |
| Render in place | Hornear clip/nest o **selección** → MP4 mudo → pista nueva | app.js · `ripRun`/`renderInPlace`/`renderRangeInPlace` | ✅ | R179 |
| **Proxy de composición** | Caché de un nest: 1 decodificador en vez de N (**medido 2,6 → 15,8 fps**) · sólo cuadradas | app.js · `ncBuild`/`ncUsable`/`nestSig` | ✅ | R180 · R192 |
| Visor de avance RIP | Fotograma en vivo + barra + ETA + Cancelar | app.js · `ripProgress` · #ripPv | ✅ | R179 |
| Sonda de códecs | Pregunta al codificador qué acepta a ese tamaño | app.js · `ripCodecOptions`/`pickVideoCodec` | ✅ | R179 |
| WebCodecs + muxer | MP4 H.264/HEVC/**AV1**/**VP9**/AAC, sin FFmpeg | app.js · `Mp4Muxer`/`HAS_WC` (~L4385) | ✅ | R179 |
| Export HAP | Snappy + DXT GPU + QuickTime .mov | app.js · `hapFrame`/`movBuild`/`dxtEncodeCanvas` | ✅ | R100 |
| `makeProxy` | Proxy all-intra GOP=1 + m.frames. **[R241] su tasa sale de `m.fps`** → si `detectFps` falla, el proxy nace a media tasa (medido: 455 de 911 fotogramas) y el montaje enseña un fotograma de cada dos | app.js · `makeProxy` (~L2524) | ✅ | [C3] |
| `detectFps` | Tasa real del vídeo por `requestVideoFrameCallback`. **[R241]** al vencer el plazo YA NO tira las muestras (tres intervalos bastan para la mediana) y el plazo escala con los megapíxeles hasta 8 s: con 2,5 s fijos, un HEVC de 7196×912 a 410 Mbps no llegaba a diez fotogramas y se quedaba en el 30 por defecto — **0 de 9 aciertos en el material real de Beltrán, ahora 9 de 9** | app.js · `detectFps` (~L2467) | ✅ | R241 |
| `attachExistingProxy` | Auto-sanar/asociar por hash+basename. **[R225·11] también AL IMPORTAR** (`addVideo`, el camino de `importFiles`: diálogo y arrastre), no sólo al reabrir proyectos (`reloadMedia`) — reimportar un clip ya proxyficado lo dejaba reproduciendo el original pesado. La GENERACIÓN sigue manual (ADR-0003): esto sólo adopta lo que ya hay en disco | app.js · `attachExistingProxy` (~L1459) · llamadas desde `addVideo`, `reloadMedia`, `makeProxy` | ✅ | [C3]/R225 |
| `demuxMP4` | Demuxer por rango (moov+samples) | app.js · `demuxMP4` (~L3978) | ✅ | R108 |
| ClipDecoder | Anillo WebCodecs decode-ahead. **[R256] Sale solo del bloqueo mutuo** que producía un salto hacia atrás corto (un clip en bucle, cada vuelta): los fotogramas retenidos por delante del destino agotan el fondo de salida del decodificador y `evict` no los suelta, así que ni se alimenta ni se decoda. Antes aguantaba 10 s, se rendía y el export caía a `<video>` (914 → 90 ms/fotograma) | app.js · `makeClipDecoder` (~L7140) · la salida del atasco en `step()` — **[R259] la condición es LÓGICA** (el fotograma pedido es más viejo que TODO lo cacheado → no puede llegar), no un contador de vueltas: contar vueltas disparaba sobre exportaciones sanas de 3+ capas y la tormenta de reinicios tiraba el contexto gráfico · **[R261] el vaciado lleva la generación del decodificador** (el `flush()` que `close()` rechaza ya no marca como vaciado al que acaba de nacer) | ✅ export · 🚧 preview | R189 · R256 · R259 · R261 · [C2] |
| vinst + servo | `<video>`+tex por clip, servo de velocidad | app.js · `vinstEnsure`/`ploop` | ✅ | [C2] |
| Frame cache | Cache LRU de texturas de m.frames | app.js · `_fcache`/`showFrame` (~L3946) | ✅ | [C2] |
| SSAA export render | Supersample→downsample | app.js · `renderExportFrame` (~L4242) | ✅ | — |

### 6 · Grado de color & Inspector → [detalle](#6--grado-de-color--inspector-detalle)
| Componente | Qué hace | Ubicación | Estado | Roadmap |
|---|---|---|---|---|
| Pipeline de color (FSW) | Pipeline completo en el fragment shader | app.js · `FSW`/`PW` (~L169) | ✅ | R116/R130/R132 |
| Import de LUT 3D | LUT `.cube` por clip como look final; [R213] `_lutReg` = LRU de 16 con deleteTexture + `resetLutReg()` en new/open + recarga perezosa desde `bindClipLUT` | app.js · `parseCubeLUT`/`loadLUT`/`bindClipLUT` | ✅ | R116 |
| Ruedas Lift/Gamma/Gain | Grado primario estilo DaVinci | app.js · `wheelRGB`/`bindClipGrade` | ✅ | R130 |
| Curvas de tono | Curvas luma+RGB → LUT 256×1 | app.js · `buildCurveData`/`clipCurveTex`/`bindClipCurve` | ✅ | R132 |
| Grado en PFD/PEQ | Fulldome/equirect ya reciben ruedas/curvas/LUT (paridad con FSW) | app.js · `bindClipLUT(c,LFD/LEQ)` en draw PFD/PEQ | ✅ | R138 (gap cerrado) |
| ~~Grado máster de secuencia~~ | **ARCHIVADO COMPLETO** — UI en R148, motor en R150. El grado vive **por clip** en la sección Color | `_backup/deprecated/master-grade-ui.js` + `20260725-master-grade-engine.js` | 🗄️ | R150, ADR-0008 |
| `renderInspector` | Reconstruye + sincroniza el inspector | app.js · `renderInspector`/`refreshInspector` | ✅ | [I1]/[I2] |
| 6 secciones colapsables | Transform/Clip/**Source**/**Playback**/Color/Motion | app.js · `applySecCollapse` · #fxRows/#sourceRows/#playbackRows/#colorRows/#motionFx | ✅ | Rev1 §4 |
| Toggles de Source/Playback | Switch `.iosw` (26×15, verde al on) — fila: etiqueta · descripción · switch. **[R225·3]** la fila **Fisheye** se DESHABILITA (opacidad .42 + `aria-disabled` + tooltip que lo explica) si `props.fulldome` está apagado, y apagar Fulldome src apaga también `props.fisheye`; su fila Amount sólo sale con las dos condiciones. **[R225·2]** para un nest NO se dibujan ni Fulldome src (implícito) ni Equirect | app.js · `swRow`/`swBind` (Source ~L2966) y `pbRow` (Playback ~L3072) | ✅ | R149/R225 |
| **Velocidad por clip** | `.field` (arrastre 50-200% · doble clic para escribir) · **estira el clip y su automatización** | app.js · fila en `#playbackRows` · `setClipSpeed` | ✅ | R195 |
| Filas de parámetro | Fader (129px) + caja + UN diamante | app.js · `buildRows`/`startValDrag` · `.prow` | ✅ | R159 |
| Máscara dropdown + PNG | Máscara shape/PNG + tamaño | app.js · `MASK_IDX` · #maskSel | ✅ | — |
| Máscaras pen-tool | Multi máscara por puntos, invert/feather · **se editan EN EL LIENZO del visor (R226)** | app.js · `startMaskEdit`/`drawMaskEditOverlay`/`penPix`+`penFromPix` · panel `buildPenMaskUI` · raster `rasterizePenMasks` | ✅ | [I3] |
| Editor de texto | Fuente/peso/alineación/fuentes propias. **[R225·6]** sin campos de píxeles (`#txtSize`/`#txtLineH` archivados): el cuerpo era resolución, no tamaño —la proporción del lienzo es invariante al cuerpo— así que los medios nuevos nacen con `TXT_BASE_PX`=300 y `renderTextMedia` lo reduce si el lienzo fuese a topar con `TXT_MAX_PX`=4096 (párrafo largo recortado). Estrena `#txtStrokeCol` (color del contorno: `tstrokeColor` se guardaba sin mando y dejaba el contorno negro invisible sobre el domo) | app.js · `renderTextMedia`/`loadCustomFont` · `TXT_BASE_PX` | ✅ | [U8]/R225 |
| Editor de shape | Rect/elipse/línea, fill+stroke | app.js · `renderShapeMedia` · #shpType | ✅ | — |
| Inspector de audio | Waveform + volumen + **escala de onda** + onda a un lado. **[R225·5]** SIN filas de fade in/out (archivadas: desde R223 el fundido de audio es el tirador del clip y ES el volumen). `#auWScale` = zoom vertical del visualizador (`state.tl.waveScale`, log 0,25×…8×, 1× al centro) — preferencia de VISTA global a la línea de tiempo, no dato del clip: no toca el sonido ni el export | app.js · `buildAudioInspector` · #insAudio · `waveScale`/`wsLabel`/`WSCALE_MAX` | ✅ | R225 |
| Dibujo del waveform | Onda por clip a resolución de pantalla (sólo la franja visible) y onda mini del inspector; las dos multiplican por `waveScale()` | app.js · `drawAudioWaveInto` (~L2421) · `redrawAudioWaves`/`scheduleWaves` · `drawWaveInto` (~L4520) | ✅ | R225 |

### 7 · Sala/360, Compose/Nest & formatos → [detalle](#7--sala360-composenest--formatos-detalle)
| Componente | Qué hace | Ubicación | Estado | Roadmap |
|---|---|---|---|---|
| `renderRoom3D` | Dibuja la sala 3D (muros+piso+grilla); rótulos [R211] en espacio de pantalla vía `drawRoomLabels3D` (siempre legibles). [R221] piso ya no compone a FBO propia — muestrea el MISMO `wallsTex` que los muros | app.js · `renderRoom3D` (~L1184) | ✅ | [D4] f2 |
| `buildRoomGeo` | Geometría de quads de la sala (cacheada). [R221] UV del piso re-derivados: mapean al rect del dock DEL MISMO composite (antes, una textura cuadrada propia); shade del piso = 1.0 (antes 0.5, misma claridad que los muros) | app.js · `buildRoomGeo` (~L1081) | ✅ | — |
| Arrastre de clip en el visor | **[R234]** `vdrag.off` = desfase del agarre (centro − punto pinchado), sumado en el `pointermove`. Antes se escribía el punto del cursor COMO centro, así que el clip saltaba a centrarse al agarrarlo. Igual en plano/sala (`elemFlat`, marco) y en domo (`elem`, grados, `el` acotada a ±90) | app.js · `pointerdown`/`pointermove` de `gridc` | ✅ | — |
| Sala 3D (`FSR`) | **[R233b]** mismo `uvLim` que el blit (sin él, el borde alto del muro se fundía a negro) · **el contenido va SIN sombrear**: `v_sh` era un foco falso que oscurecía hasta un 38 %, y este visor previsualiza lo que se proyecta. El sombreado queda sólo en la pasada de FUERA (carcasa translúcida) | app.js · `FSR` (~L581) | ✅ | — |
| Blit del composite (`PB`/`FSB`) | **[R233]** acota el muestreo al primer/último texel ENTERAMENTE cubierto de la región (`a=(ceil(t0)+0.5)/N, b=(floor(t1)-0.5)/N`). El composite es CUADRADO y un lienzo apaisado va encajado en una banda: sin clamp, `LINEAR` mezclaba el borde con el vacío y dejaba una franja negra de UN TEXEL (en sala, 1 texel = 14 px de lienzo → ~140 px a 1000% de zoom). Medio texel no basta: la banda no cae en múltiplos de texel | app.js · `FSB` (~L390) | ✅ | — |
| `roomPlan` | Lazo de muros → planta; [R211] envuelve en sentido natural (desde dentro mirando Front, Right a la DERECHA = lado x−); **[R232]** de las dos raíces de θ se coge la que NO se cruza (+ `segCruza`/`planCruzada`); **[R238]** el barrido ya no mira sólo cambios de signo — refina los EXTREMOS locales, así que no pierde las dos raíces cuando el mínimo roza el cero, y `plan.motivo` distingue `'nocierra'` de `'cruzada'` | app.js · `roomPlan` (~L8695) | ✅ | — |
| Tira de muros desenrollada | Compositing rectangular, costuras, wall-mask | app.js · `roomWallScissorRects` (~L2621) | ✅ | — |
| `layoutWallStrip(walls)` | [R214] Layout de la tira (x0/x1 por muro cosidos por pxW + stripW/stripH); MUTA `walls` y devuelve `{stripW,stripH}` (stripH = SÓLO muros, `room.stripH`). Antes vivía TRIPLICADO — unificado en una sola función | app.js · `layoutWallStrip` (~L2995) | ✅ | — |
| `roomFloorDefault(walls)` [R230] | Piso POR DEFECTO a partir de los muros — **fuente única** de las tres vías que crean un piso (launcher vía `lchFloorCfg`, `roomSetupDialog`, demo `startDemoProject('room')`). Medidas = huella (ancho del Front/Back más ancho × fondo del Left/Right más ancho); píxeles = esas medidas por la DENSIDAD px/cm de esos mismos muros. Antes el demo y el diálogo clavaban 1920×1080 y el piso salía aplastado | app.js · `roomFloorDefault` (~L3288) | ✅ | — |
| `roomFloorH(walls,floor,stripW)` [R221] | Alto del piso en píxeles de tira, una vez fusionado al canvas: `floor.pxH` escalado por `frontW/floor.pxW` (conserva el aspecto de `floor.pxW×pxH`). Fuente única — la usan `createRoomSequences`/`lchRoomSeqTemp`/`applyRoomGeometry`/`migrateRoomFloor`/export | app.js · `roomFloorH` (~L3005) | ✅ | — |
| Canvas único muros+piso [R221] | El suelo dejó de ser una secuencia flat aparte "dockeada" bajo Front (R211) — es la franja inferior del MISMO canvas que los muros (`seq.h = room.stripH + floorH`). Pinta con el blit normal del composite (sin segunda textura). Migración de proyectos viejos: `migrateRoomFloor` | app.js · `render()` rama flat + `drawRoomGrid2D` (rect del piso) | ✅ | — |
| `drawRoomGrid2D` | Grilla 2D por-muro (px) + costuras + labels + rect FLOOR (overlay, ahora DENTRO del canvas vía `room.stripH`, [R221]) | app.js · `drawRoomGrid2D` (~L1511) | ✅ | — |
| `roomCameraMVP` | Cámara Orbit + Viewer/stand | app.js · `roomCameraMVP` (~L1179) | ✅ | — |
| `roomSetupDialog` | Setup de sala: muros/roles/piso/tira. **[R227]** único diálogo de creación que sobrevive (`domeSetupDialog`/`flatResDialog` archivados → `_backup/deprecated/20260730-creation-dialogs-file-menu.js`) | app.js · `roomSetupDialog` (~L7343) | ✅ | [F3][F4][F5] |
| `createRoomSequences(cfg)` | [R217] Extraído de `newRoomProject`: crea SÓLO la media walls (sin wipe/vista/tour) — [R221] ya no crea una media Floor aparte; `wseq.h` incluye el piso vía `roomFloorH`, `room.stripH` guarda el alto sólo-muros. Lo comparten `newRoomProject` y el tipo "360 Room" de `newSequenceDialog` | app.js · `createRoomSequences` (~L7546) | ✅ | — |
| `newRoomProject` | Crear PROYECTO nuevo de sala (wipe + `createRoomSequences` + vista). [R221] sin compensación de pan/zoom para el dock (ya no hace falta, el letterbox centra el canvas completo). **[R227] devuelve `true`/`false`** y ya NO lanza el recorrido guiado | app.js · `newRoomProject` (~L8290) | ✅ | — |
| `migrateRoomFloor(wseq)` [R221] | Migra un `.isp` guardado antes de R221: si `room.floorSeqId` sigue puesto, crece `wseq.h` (+`room.stripH`), reubica los clips del piso viejo a lanes nuevas (`Floor 1…`) con la transformación de orientación del dock (x directa, y invertida — escala uniforme `s=frontW/floor.pxW`; rot'=180−rot, mirror'=!mirror, identidad verificada por composición de matrices), borra la media Floor y limpia `floorSeqId`. Corre desde `loadProject`, tras fijar `_id` (usa `uid()`) | app.js · `migrateRoomFloor` (~L7609), llamado desde `loadProject` | ✅ | — |
| "360 Room" en New sequence [R217] | Tercer tipo del diálogo `newSequenceDialog` (junto a Dome/2D): muros 2/3/4 + preset de resolución (reusa `LCH_ROOM_PRE`) + toggle de piso; preview con `drawRoomIso(...,'plan')`; crea vía `createRoomSequences` y activa la nueva secuencia SIN tocar el resto del proyecto (sin confirmDiscard, sin tour) | app.js · `newSequenceDialog` (~L7055) | ✅ | — |
| Export sala: tira/piso/por-muro [R221] | 3 modos en `#exRoomMode`: Full strip (sólo muros, crop `y<room.stripH`) · Strip + floor (2 jobs) · Each wall + floor (N+1 jobs, sólo si hay piso). El crop de `opt.wall` se generalizó con `y0/y1` (antes sólo top-anchored) — el piso y la tira completa reusan el mismo mecanismo que el crop por muro, ya no dependen de `floorSeqId` | app.js · `queueJob`/`addFloorJob` (~L6905) · `renderExportFrame` (~L5631) · `opt.wall={x0,x1,y0,y1,pxW,pxH,stripW,stripH,kind?}` | ✅ | [R1][D2] |
| Secuencias = nest media | activeSeq, switch/load/save | app.js · `loadSeqIntoState`/`switchSeq` (~L4926) | ✅ | [R3] |
| nestSelection / makeClipUnique | Anidar clips; copia independiente. **[R225·8]** los clips de audio ENLAZADOS a la selección no entran al nido y se BORRAN del timeline (decisión de Beltrán: evita audios superpuestos); la copia de vídeo de dentro conserva `avRole:'v'` sin `link` — el flag que impide que el nest saque el sonido del original por dentro. **[R225·2]** la instancia nace `fulldome:true, equirect:false` | app.js · `nestSelection`/`makeClipUnique` | ✅ | R225 |
| Compose media (`m.comp`) | Nest generado por parámetros | app.js · `createComposition`/`regenComposeNest` (~L6086) | ✅ | [N1][N2][N3] |
| compLayout / compElProps | Generadores de layout domo & flat | app.js · `compLayout`/`compElProps` (~L6023) | ✅ | [N5] |
| **Campos rápidos de composición** (inspector) [R263] | La OTRA superficie donde se edita una composición: tipo, dos campos propios del tipo y `Más opciones…` (que abre el cuadro). Escriben directo en `m.comp` y llaman a `regenComposeNest`, así que no pueden perder valores como los perdía el cuadro (R262) — pero su lista de tipos **era fija y de domo**: sin túnel ni tejido, y sin cambiar a los tipos planos. Con un túnel seleccionado no quedaba ningún botón marcado y pulsar cualquiera lo convertía en otra cosa. **La lista la decide la SECUENCIA** (`isFlat()`), no el modo del nido: un tejido vive en un nido plano aunque la secuencia sea de domo. Campos propios: túnel → Cantidad + Hasta · tejido → Tiras + Ancho, **sin `Tamaño`** en ninguno (igual que el cuadro) | app.js · `renderInspector` rama `m.comp` (~L5666) · `regenComposeNest` (modo del nido segun el tipo, y el movimiento del reparto marcado con `_lay`) | ✅ | R263 · R263b |
| **Máscara de composición** [R268] | Forma y **tamaño** de recorte para los clips de CUALQUIER compose. La forma ya estaba en todos menos en el túnel (R246 la fijó a none porque su fuente ocupa el disco entero — que es justo lo que la hace útil ahí); el tamaño existía por clip desde siempre (maskScale, u_maskScale en los dos shaders) pero no se podía pedir al componer. Un solo `compMaskScale(g)` alimenta las CUATRO ramas de `compElProps` — plano, tejido, túnel y domo general — para que no discrepen; la cuarta se quedó fuera al escribirlo y la prueba la cazó | app.js · `compMaskScale` · `compElProps` (4 ramas) · `#cMask`/`#cMaskSz` en `openCompose` · `sync()` decide si la fila de tamaño se ve | ✅ | R268 |
| Compose **Túnel** [R246] | Relleno de domo con sensación de profundidad. Las fuentes son **imágenes 1:1 con alfa** marcadas `fulldome` (ocupan el disco entero; `Size` es zoom cenital, `size/55` = 1:1), que nacen pequeñas y crecen hasta salir por la periferia. **No se asume forma alguna** — un anillo da un túnel legible, pero cualquier repartición de alfa sirve. Cada elemento lleva su `_phase`=i/n → diente de sierra desfasado = chorro continuo. Mandos: De→a · Velocidad · Profundidad (curva) · **Giro** (grados POR CICLO: el elemento rota mientras se acerca — invisible con un anillo perfectamente simétrico) · **Hélice** [R264] (aparta los elementos del eje en espiral; esto SÍ se ve con cualquier fuente. Necesitó enseñarle a desplazar al camino fulldome: `u_off` en `VSFD`, multiplicado por la escala para que la separación crezca al acercarse) · **fundido de ENTRADA y de SALIDA por separado, cada uno con su cantidad en % del ciclo** [R262] (envolvente `mode:'fade'`/`fadeEnv`, rampa de coseno alzado: con 50%+50% reproduce EXACTAMENTE el seno único de R246, medido 0,0000 de diferencia, así que los túneles existentes no cambian). **Orden de dibujo por profundidad en CADA fotograma** (`_zsortSize`): los elementos ciclan, así que el ranking por cercanía rota y el orden de pistas no lo puede expresar | app.js · `compLayout` rama `tunnel` · `compTunnelAnim` · `tunnelFadeIn/Out` · `fadeEnv` + `animOffset` · `tunnelHelix` · `compElProps` (rama `_phase`) · `VSFD`/`LFD.off` · `composite` (z-sort) · `prepNests` (bandera) | ✅ | R246 · R262 · R264 |
| Motion `mode:'saw'` [R246] | Diente de sierra: 0 → amp y **vuelve a nacer**, la forma de onda que faltaba para un ciclo que se repite (`linear` crece sin fin, `wave` va y vuelve). `curve` 0-100 dobla la subida: la exponencial es la que se lee como PERSPECTIVA (a velocidad constante hacia el ojo el radio se multiplica, no se suma). Disponible para cualquier parámetro y cualquier clip, no sólo dentro del compose | app.js · `animOffset` + `sawShape`/`_frac` (junto a `ANIM_PARAMS`) | ✅ | R246 |
| Motion **Flotar** [R252·b] | El primer preset que es un ACORDE y no un parámetro: la sensación de flotar no vive en ninguno, vive en la MEZCLA de ↔ + ↕ + giro en vaivén y desfasados (definición de Beltrán). `ANIM_PRESETS` admite `parts`, que estampa varios modificadores NORMALES —se tocan, se apagan o se automatizan uno a uno, no es una caja negra—. En el domo usa `fx`/`fy` y NO `az`/`el`: az/el se mueven sobre la esfera y cerca del cenit un grado de azimut recorre mucho menos, así que el mismo flotar se vería distinto según dónde esté el clip. **Las tres velocidades no son múltiplos entre sí** (11 · 14 · 18 s): con la misma velocidad los tres cierran ciclo a la vez y el recorrido se repite idéntico, que es lo que delata a una animación. **[R252b] Mando de INTENSIDAD del acorde** (0-300 %): los miembros llevan `grp`+`gid`, y el maestro recalcula `g0` (la amplitud al 100 %) desde la amplitud ACTUAL antes de aplicar la intensidad nueva — así respeta los retoques a mano y bajar a 0 no borra las proporciones (multiplicar ×nuevo/viejo dejaria el 0 como agujero negro). El maestro va ENCIMA de los tres, que siguen enteros y editables. GOTCHA arreglado de paso: `addAnimPreset` buscaba el preset en el juego de DOMO primero, así que en 2D el chip Pulsar animaba `size` (que el camino plano ni lee) en vez de `scale` | app.js · `ANIM_PRESETS` / `ANIM_PRESETS_FLAT` (clave `float`) · `addAnimPreset` · **[R252b]** `setAnimGroupInt` / `animGroups` + fila maestra en `buildAnimList` · **[R253·b]** `refreshAnimAmps`: el maestro **NUNCA** reconstruye la lista (ni en `oninput` ni en `onchange` — una flecha del teclado dispara los dos y destruía igual el control con el foco) | ✅ | R253 |
| Copiar/pegar **la selección** [R251] | `copyClip` guardaba `selClip()` —UN clip— aunque la selección múltiple vive en `state.selIds` desde siempre: copiar cinco pegaba uno. Ahora guarda el conjunto y el instante del primero (`t0`); al pegar, cada clip cae en `cabezal + (su inicio − t0)` y **en su propia pista**, así que un montaje de varias capas se reproduce tal cual. Los enlaces A/V se rehacen SÓLO si las dos mitades venían copiadas (con una, `linkPartner` buscaría un fantasma) y un medio que ya no existe se salta y se avisa en vez de abortar el pegado entero | app.js · `copyClip` / `pasteClip` / `selClipsAll` | ✅ | R251 |
| **Dónde cae una composición** [R251] | Antes cada una estrenaba pista (R88, para no pisar nada) → torres de pistas y la composición siempre arriba, lejos del material. Ahora: **la pista más cercana con hueco en [start, start+dur), y sólo si no hay, una nueva**. «Más cercana» se mide desde la pista ELEGIDA (cabecera marcada); sin ninguna, desde ABAJO. **NO desde el clip seleccionado**: tras crear una composición el seleccionado es ella misma, así que cada nueva treparía una pista (se vio en la prueba y se corrigió). `nestSelection` no se toca: ya reutilizaba la pista de los originales | app.js · `laneLibreCerca` · `createComposition` | ✅ | R251 |
| **Tramo del bucle** [R250] | El motor envuelve desde R81 sobre `[inP, inP+loopLen)` y `loopLen` se captura de la duración del clip AL ENCENDER el bucle — o sea que recortar primero (o venir del monitor de origen con marcas) ya daba un bucle corto. **No faltaba función, faltaba verla**: el inspector muestra ahora la longitud del ciclo (con decimales: `fmtDur` redondea y un bucle de 6,5 s se leía «6s»), qué trozo de la fuente repite en código de tiempo, y un botón **«Del clip»**. `setLoopRange` cambia SÓLO `loopLen`: antes había que apagar el bucle para re-decidirlo, y apagarlo RECORTA el clip a lo que quede de archivo (40 s → 30,13 s medidos), así que re-decidir costaba el montaje | app.js · `setLoopRange` · `_renderInspectorMain` (filas de Playback) · `srcT` (**[R256] el ciclo ya cierra**: el módulo en coma flotante repetía el último fotograma en una de cada tres vueltas, y el mismo punto del ciclo salía como 4,2 o 4,199999999999999 — que `keyForTime` trunca a DOS fotogramas distintos) / `_applyLoopToggle` | ✅ | R250 · R256 |
| **Deshacer de medios y carpetas** [R253c·d] | `snapshot()` nunca serializó `state.media`, así que renombrar un medio, moverlo de carpeta o crear/renombrar/borrar carpetas **no eran deshacibles** pese a llamar a `pushUndo`: la foto salía idéntica y el Ctrl+Z se comía la edición ANTERIOR. Ahora el snapshot lleva `mmeta` (id + nombre + carpeta + marcas de CADA medio, la lista entera para poder QUITAR lo recién puesto) + `folders` + `folderColors`. **No entra nada de runtime** (texturas, decodificadores, proxy, miniatura): pesado, derivado y peor restaurado. El criterio no es una opinión — es deshacible exactamente lo que llama a `pushUndo` tocando medios o carpetas. `restore` saca además la vista de una carpeta que el deshacer acabe de borrar. **[R253d] Guardado contra el pisotón:** hacer el estado global restaurable lo hizo REVERTIBLE por fotos que nunca lo capturaron (las pilas son por secuencia y los medios son globales; y hay mutadores que no empujan deshacer). La parte global de una foto sólo se aplica si el último cambio global lo hizo ESTA secuencia, hay como mucho UNO entre la foto y el ahora, y la foto es posterior a la última marca de agua (`bumpMeta(true)`, que dejan los cambios sin deshacer propio). Si no cuadra: se restauran los clips y el estado global se deja en paz | app.js · `snapshot` / `restore` · `bumpMeta` / `_metaVer` / `_metaOwner` / `_metaFree` | ✅ | R253d |
| **Monitor de origen** [R249·R253] | El reproductor de clip de Premiere. **Doble clic** en un medio (o el botón **Source** del inspector) abre una ventana **FLOTANTE**: transporte, barra de recorrido, marcas de entrada/salida, botón Insertar, y **la imagen es el asa de arrastre** — lo que cae en la pista es SÓLO el tramo marcado. No es modal a propósito (se mira el material mientras se trabaja); se mueve, se redimensiona por la esquina, se cierra con × o Escape; con el foco dentro, `I`/`O`/Espacio son suyos. **Las marcas viven en el MEDIO** (`m.srcIn`/`m.srcOut`) y viajan en el `.isp`, así que arrastrar desde el PANEL las respeta igual — y por eso la ficha del panel enseña `[dur]` cuando un medio entra recortado. **[R253] MIRAR NO ESCRIBE**: la ventana lleva su propia selección (`mon.in`/`mon.out`), y las marcas del medio sólo cambian por gesto explícito vía `smCommitMarks` (con `pushUndo`+`markDirty`); abrir desde el inspector enseña el tramo del clip sin estamparlo. `srcRange()` devuelve null sin marcas → el camino de siempre queda intacto. Cada tipo pinta lo suyo: vídeo con un `<video>` PROPIO (compartir el del motor habría movido el render al recorrer), secuencia por índice de fotograma, audio con su onda, fijas con su imagen. **El doble clic ya no suelta el clip en la línea de tiempo** (modelo Premiere: para eso se arrastra) | app.js · `openSourceMonitor` / `closeSourceMonitor` / `smPlay` / `smTick` / `smAccion` / `srcRange` · `addClip(…,rango)` · `startMediaDrag(e,m,rango)` · `serMedia` · `smCommitMarks`/`smRangeVisible` · `makeMediaItem` **y `makeMediaTile`** (distintivo `[dur]` en las DOS vistas) · **[R253b]** `smCommitMarks` es deshacible de verdad: `snapshot` lleva `mcut` (las marcas de CADA medio) y `restore` las devuelve — antes el `pushUndo` empujaba una foto idéntica y el Ctrl+Z se comía la edición anterior · index.html `#srcMon` + `#selSrcMon` | ✅ | R253 |
| **Copiar / pegar atributos** [R278] | Lleva de un clip a otro todo lo que es del CLIP: transform, bucle, velocidad, color, mascaras, efectos, motion y las automatizaciones. Funciona en los dos sentidos entre clip y composicion, porque un compose es un clip del timeline. **NO viaja** la configuracion de la composicion (`comp`), ni identidad/sitio/duracion/medio: el destino conserva su hueco en la linea de tiempo. Se enumera lo que NO se copia (`ATTR_FUERA`), no lo que si: una lista de inclusion envejece mal y el dia que se anada un parametro al inspector el pegado saldria incompleto sin fallar a la vista. **Automatizacion recortada**: los tiempos de `kf` son relativos al inicio del clip, asi que al pegar de uno de 40 s en uno de 15 s se quedan los puntos que caben; si el primero superviviente no esta en 0 se inserta el valor interpolado ahi, o el tramo arrancaria con el valor base y daria un salto. `loopLen` se acota al archivo del destino | app.js · `ATTR_FUERA` / `attrsDeClip` / `copyAttrs` / `recortarKf` / `kfEval` / `pasteAttrs` · menus de clip · Ctrl+Alt+C / Ctrl+Alt+V (antes que Ctrl+C/V: comparten tecla) | ✅ | R278 |
| **Copiar / pegar atributos** [R278b] | Tras la auditoría: `slot` fuera de la copia (era la otra mitad de la relación de grupo y el re-layout borraba el clip en silencio); reemplazo SIMÉTRICO (se retira lo que sí es atributo antes de asignar, o las claves opcionales del destino —máscaras, bucle, velocidad— sobrevivían); reprogramación de audio y vídeo como en `setClipSpeed`; `state.autoSel`/`shapeBox` a null al reemplazar `kf`; el par VIEJO de R80 retirado a `_backup/deprecated/` (dos semánticas bajo el mismo rótulo en el mismo menú); los tres manejadores de breakpoints exigen ahora que Alt no esté pulsado | app.js · `ATTR_FUERA` / `pasteAttrs` · manejador de teclas | ✅ | R278b |
| **Cesta de medios** del compose [R248] | El campo Medios del diálogo enseña **lo que la composición contiene** (miniatura + nombre + número de orden, como el panel de Medios), no un catálogo con casillas de todo el proyecto — con 500 clips era impracticable. **×** quita; **arrastrar desde Medios** añade (también el doble clic). `_pick` **ES** `g.mediaIds`: mismos ids, mismo orden, sin migración — y más fiel que las casillas, que devolvían el orden del PANEL y podían rebarajar qué fuente iba a cada tira al reaplicar. Para que el arrastre sea posible: velo con `pointer-events:none` y aclarado a 0,22 (**el editor tiene que seguir viéndose**: se sigue trabajando con él, y hay que ver la composición sobre el domo mientras se ajusta), panel de Medios por encima del velo (`body.composing`), fantasma a z 9700, y Escape sustituye al cerrar-pinchando-fuera | app.js · `openCompose` (`_pick` / `pintarCesta` / `cestaAnadir` / `cerrarComp`) · `startMediaDrag` (rama `_composeDrop`) · `makeMediaItem` (doble clic) · **[R253b]** `_cerrarComp`: abrir otro diálogo cierra el anterior POR SU CAMINO, para que se retire también su Escape de captura (si no, se comía el siguiente Escape del usuario) · index.html `.cbasket` | ✅ | R253b |
| **Mandos del cuadro de Compose** [R276] | Los diálogos de composición siguen el sistema de diseño del inspector: pista de 3 px teñida **por parámetro** (`autoColor('fxt:'+id+':v')`, el mismo generador que distingue los efectos) y valor en recuadro, en vez del slider nativo con puntito blanco y el número como texto suelto. **El `input[type=range]` no se retira**: se oculta y sigue siendo el que guarda el valor, así que `readForm`, el pre-rellenado al editar una composición existente y todos los `oninput` siguen intactos — el arrastre sólo escribe en él y dispara `input`. El repintado cuelga de `preview()`, por donde pasan todos los caminos de actualización. Retícula de 24 px acotada a `#compOv` (`.frow` lo comparten export/proyecto nuevo/sala). **Gotcha:** fijar `min-height` en un ítem de columna flex anula su `min-height:auto` implícito y las filas altas (cesta, rejilla de disposiciones) se aplastan unas sobre otras → hace falta `flex:none` al lado | app.js · `openCompose` (pase que sustituye los range) · `preview()` (repinta) · index.html `.frow .cfield` / `.frow .cfield + .tnum` / `#compOv .frow` | ✅ | R276 |
| Compose **Tejido** [R247c·d] | Cestería que llena el domo: dos familias de tiras cruzadas que viajan sin fin. Se monta en un **nido PLANO 1:1** —donde los vecinos se juntan a **90° exactos**— y entra en el domo como **fuente fulldome con ojo de pez**, así la deformación se aplica UNA vez al conjunto (los intentos que colocaban clip a clip sobre la esfera salían escalonados: sólo la banda por el centro del disco es un círculo máximo). **Nunca deforma**: el lado que cruza la tira mide su grosor y el otro sale de la proporción del medio; `fit` elige cuál cruza y `rot` 0/90 hacia dónde mira. **Una fuente por tira** (proporciones mezcladas encajarían mal dentro de una misma tira). **Infinito** por diente de sierra de un paso: al saltar atrás ya hay otro clip en su sitio. **Entrelazado por cruce** con `u_weave`. Mandos [R247d]: disposición (tejido/↔/↕) · tiras 1-24 · **ancho de tira** (% del paso: 100 = se tocan y llenan el domo, menos = hueco transparente; separación y ancho son el mismo mando) · empaque **acotado a 100** (un clip empieza donde acaba el anterior, nunca se cortan) · lado largo · **sentido: un sentido / el otro / intercalado / quieto** [R265] (antes «el otro» había que armarlo con «a la vez» + una casilla Invertir aparte; lo viejo se pliega al reabrir) · una velocidad por familia · **barajar qué fuente va a cada tira** [R265] (la fila sólo se ofrecía en el relleno de domo, y el tejido ni la miraba: tomaba la fuente por el índice de tira sin pasar por el mapa de barajado). GOTCHA de escala: el lado dibujado mide **2×`scale`** unidades de lienzo, no `scale` — el fallo del doble hacía que las tiras solaparan y los clips se cortaran dentro de la tira | app.js · `weaveLayout` · `compWeaveAnim` · `compElProps` (rama `_weave`) · `setWeaveGrid` + `u_weave` en FSW · `createComposition` (fuerza nido plano) · `drawComposePreview` | ✅ | R247d |
| Rejilla de cruces `u_weave` [R247c] | El «por encima / por debajo» de una cestería. La decisión NO es del clip (que viaja) sino del CRUCE (que está quieto), así que se evalúa en **píxeles del lienzo** (`gl_FragCoord`) y no en coordenadas del clip: la tira fluye por ventanas fijas en vez de arrastrar el patrón consigo. `weaveCells`=[celdas a lo ancho, a lo alto] + `weavePar`; el tamaño en píxeles se deriva del lienzo real, así que el entrelazado no se descuadra al exportar a otra resolución. Descarta la mitad de las casillas con `discard` | app.js · FSW (`u_weave`) · `setWeaveGrid` · `drawClipFlat` | ✅ | R247c |
| Motion `fx`/`fy` [R246] | Deslizar en el **plano del ojo de pez** con envoltura en [-1,1] por eje: sale por un borde y entra por el opuesto. Existe porque az/el mueven en coordenadas de la ESFERA y una banda recta que no pase por el cenit no se puede expresar con ellos. Los ejes envuelven POR SEPARADO → exacto para bandas a 0°/90°, salto feo en diagonal (por eso el tejido va en recto) | app.js · `ANIM_PARAMS` + rama en `drawClip` (tras el diameter-wrap, antes de `frame(az,el)`) | ✅ | R246 |
| `_layBase` [N4] | Preservar delta manual al recomponer | app.js · (~L6098/6119) | ✅ | [N4] |
| Dome Fill / Randomize | domegrid + jitter + tiles no deformados | app.js · `openCompose`/`drawComposePreview` (~L6129) | ✅ | [N5] |
| `makeAdjustClip` | Capa de ajuste sin media | app.js · `makeAdjustClip` (~L6787) | ✅ | — |
| Inspector de la capa de ajuste [R225·1] | CONTRATO: un solo clip fulldome a cuadro completo sobre todo lo de debajo (así compone `drawAdjustment`: fotografía el composite y le pasa la cadena). Sin fuente ni Transform, con la **cadena de efectos completa** (`#motionFx`, catálogo `FXBY`, estáticos y automatizables) — antes sólo se alcanzaba desde la pestaña Reactive FX. **Dos gotchas:** (a) claves de plegado PROPIAS `adjfx`/`adjeff` (reusar `clip`/`motion` dejaba el panel entero plegado, porque [I1] los pliega contando con que Transform queda abierto); (b) las filas que no aplican se VACÍAN y se ocultan DESPUÉS de `renderMotionFx`, porque `applySecCollapse` recorre los hermanos de cada cabecera y les repone el `display`. **Color no se ofrece:** el grado vive en los shaders por clip y el post-pass máster se archivó en R150 | app.js · rama `if(c.adjust)` de `_renderInspectorMain` (~L4146) | ✅ | R225 |
| Audio de composición (clip derivado) [R225·9] | REGLA DE ORO: nunca suena audio que no esté visible en una pista de audio. Un nest con pistas de audio DENTRO estrena en el padre un clip de audio DERIVADO (`mediaId` = el nest + `nestAudioOf`, enlazado con el `link`/`avRole` de R170/R223 → se mueve/recorta/deslinca como cualquier par A/V, y el doble clic entra a la secuencia porque ese camino sólo mira el medio). Tres vías de fuga cerradas: `collectAudioEvents` sólo desciende a un nest en pista de AUDIO · `vinstAudio` devuelve null para nests (el `<audio>` del proxy de R180 ya no suena) · dentro de un nest (depth>0) el `<audio>` de previsualización va con ganancia 0. `serClip` es clon profundo → `nestAudioOf` viaja en el `.isp` | app.js · `syncNestAudioClips`/`nestHasInnerAudio`/`isNestAudioClip` (~L2360) · llamadas desde `nestSelection`, `switchSeq`, `closeSeqTab`, `loadProject` | ✅ | R225 |
| `clampNestInstances(nestId)` [R225·7] | Si el contenido de un nest se ACORTA, sus instancias en las secuencias padre se acortan solas (antes el límite `seqDur` sólo se consultaba al intentar EXTENDER, y la cola de la instancia mostraba el último fotograma congelado). Colgada de `saveActiveSeq`, el punto por el que se pasa siempre al abandonar/guardar una secuencia. Sólo recorta; respeta `c.loop` | app.js · `clampNestInstances` (junto a `saveActiveSeq`, ~L7272) | ✅ | R225 |
| `compSrcDur(srcs)` [R225·7] | Duración de una composición al crearla = el contenido MÁS LARGO con duración real (vídeo·audio·secuencia·nest); si todo son fijos (foto/texto/forma), `COMP_STILL_DUR`=5 s. Antes `max(s.dur||6)` sobre todos los medios dejaba que un texto o una forma mandara sobre una composición de fotos | app.js · `compSrcDur` (antes de `createComposition`) · usada por `createComposition` y `regenComposeNest` | ✅ | R225 |
| `migrateNestFulldome()` [R225·2] | Migra los `.isp` con un clip de nest en "Patch" (`fulldome:false`) → máster de domo, y le quita el equirect. Decisión asumida: una composición ubicada como parche se ve a PANTALLA COMPLETA al reabrir (el `az/el/size` no se toca, así que el encuadre se recupera con dos arrastres). Idempotente | app.js · `migrateNestFulldome` (junto a `migrateRoomFloor`), llamada desde `loadProject` | ✅ | R225 |
| Diálogos setup (domo/flat) | ~~Diálogos de creación de formato~~ | **ARCHIVADOS [R227]** → `_backup/deprecated/20260730-creation-dialogs-file-menu.js` · el menú File tiene UNA entrada, `New project…` → pantalla de inicio | 🗑️ | R227 |
| `newProject` | Reset + crear proyecto domo/flat. **[R227] devuelve `true`/`false`** (false = `confirmDiscard` canceló) y ya NO lanza el recorrido guiado. **[R228]** 6.º argumento `skipConfirm` (consentimiento del launcher). **[R242]** llama `resetProjDefaults()` — el encuadre del visor y el tempo tampoco se heredan del proyecto anterior | app.js · `newProject` (~L8374) | ✅ | R242 |
| `resetProjDefaults()`/`resetProjView()` [R242] | Defaults de FÁBRICA aplicados SIEMPRE antes de leer un `.isp` (y al crear proyecto): `seqMode/seqCov`, `tl.bpm/sig/tcMode`, **[R242b] `inlineCurves`** (vivía en el mismo bloque `tl` y sólo se restauraba dentro del `if(obj.tl)` → un legacy heredaba el modo automatización y al guardar lo escribía) y **[R242b] `selFolder`/`mediaFolder`** (`newProject` los limpiaba y `loadProject` no: el proyecto nuevo abría dentro de una carpeta del anterior, donde aterrizaban los imports y donde Delete podía borrar la carpeta homónima del nuevo), además del encuadre del visor (zoom/pan global + `view.vp` + cámara 3D). El sincronizado de la UI de curvas va **fuera** del `if(obj.tl)`, como el zoom de R240b. La cura de raíz de la familia «heredar estado del proyecto anterior» — un legacy sin secuencias creaba la suya con el `seqMode` de la SALA abierta antes y guardarlo lo corrompía (auditoría 2026-08, hallazgo 2.1). Regla R240b generalizada: campo ausente → fábrica, nunca lo heredado. **[R311]** la CUARTA aparición de la familia, encontrada por la auditoría exhaustiva: `autoItems`, `exportPresets` y `tl.pxPerSec` los escribe `serProject` y nadie los reseteaba, así que File→New los heredaba del proyecto abierto y los fijaba en el `.isp` nuevo. **La familia queda cerrada por un TEST, no por otro parche**: `tests/paridad-serializacion.test.mjs` compara las dos listas (lo que se serializa contra lo que se resetea) y falla si alguien añade un campo sin valor de fábrica. **[R315]** endurecido tras el repaso: podía dar falsos aprobados (llaves contadas en crudo, asignaciones CONDICIONALES aceptadas, claves anidadas de `tl` sin leer) y daba por cubierto `fps`, el QUINTO miembro de la familia. Ahora limpia comentarios y cadenas antes de contar, exige asignación incondicional, baja un nivel, y lleva tres aserciones que delatan su propio análisis. Lo corre `npm test` | app.js · `resetProjDefaults`/`resetProjView` (justo antes de `loadProject`) · llamadas desde `loadProject`, `newProject`, `newRoomProject` · `tests/paridad-serializacion.test.mjs` | ✅ | R311 |
| `newProjectViaLanding()` [R227] | File → «New project…» / Ctrl+N: pregunta de tres salidas (`appConfirm3`: guardar/descartar/cancelar) si hay cambios y lleva a la **pantalla de inicio**, dejando el proyecto abierto intacto detrás («Back to project» lo devuelve). **[R228]** arma el consentimiento en la SESIÓN del launcher (`lchArmConsent`), no en una bandera global | app.js · junto a `confirmDiscard` (~L8353) | ✅ | R228 |
| `lchLeave` / `lchConsent` / `lchArmConsent` [R228] | Salir del launcher CON ÉXITO (limpia `_lchVolver` + `_lch.discardOk`) · leer/armar el consentimiento de descarte de la sesión del launcher, que viaja como `skipConfirm` | app.js · junto a `hideLanding` (~L3008) y a `_lchVolver` (~L3092) | ✅ | R228 |
| `startDemoProject(fmt)` [R227] | Construye en memoria un proyecto DEMO del formato pedido (formas + texto, 4 pistas, composición, Motion, Efecto, automatizaciones) y lanza el recorrido guiado encima. Botón «Demos» de la pantalla de inicio. **[R228]** build en LOTE (`_demoBatch`: sin historial ni repintados intermedios) con `try/finally` | app.js · `startDemoProject`/`_demoBuild*`/`_demoFinish` (~L3630) | ✅ | R228 |
| `openSeqSettings`/`applyRes` | Resolución editable + cobertura (live) | app.js · `openSeqSettings` (~L5200) | ✅ | [F1] |
| `updFmtChip`/`updModeUI` | Chip de formato + UI por modo | app.js · `updFmtChip`/`updModeUI` (~L5196) | ✅ | [F2] |

### 8 · Shell, media & UI chrome → [detalle](#8--shell-media--ui-chrome-detalle)
| Componente | Qué hace | Ubicación | Estado | Roadmap |
|---|---|---|---|---|
| BrowserWindow / shell | Ventana única + salvavidas crash/hang/close | main.js · `createWindow` (~L43) | ✅ | — |
| GPU/RTX forcing | Preferir GPU discreta sin flags de blackout | main.js · `preferHighPerfGPU` (~L12) | ✅ | — |
| Single-instance + assoc | Reusar ventana, abrir path de doble-clic | main.js · `rdomeFromArgv`/`second-instance` | ✅ | — |
| IPC handlers | Diálogos, disco IO, streaming, métricas. **[R242]** `dsp:openExternal` (navegador del sistema, allowlist estricta — sólo http(s) a `ndi.video`/`ndi.link`): `window.open('_blank')` está denegado a propósito por el `setWindowOpenHandler` y la página de descarga del runtime NDI llevaba muerta desde entonces. **[R242b]** el renderer entra por `abrirDescargaNDI()`, que **comprueba el `false`** y enseña la URL si la allowlist la rechaza — la URL la da el addon nativo, así que descartarlo reproduciría la misma puerta muda si NDI mudara de dominio | main.js · (~L114-250) · app.js · `abrirDescargaNDI` (junto a `ndiAvailable`) | ✅ | R242b |
| macOS · activate (Dock) [R242] | Reabrir desde el Dock con la app viva sin ventana: se rearma `bootDone=false` antes de `createWindow()` — sin eso la ventana nueva (show:false) esperaba un `finishBoot()` que el guard `bootDone` se tragaba y no se mostraba NUNCA (hallazgo estático 4.2 de la auditoría 2026-08; pendiente de verificar en un Mac real) | main.js · `app.on('activate')` | ✅ | R242 |
| DSP bridge | API segura `window.dsp` renderer↔main | preload.js · (~L48) | ✅ | — |
| Wrapper NDI | `dsp-ndi-send` salida+entrada | preload.js · `ndiApi` (~L8) | ✅ | — |
| Wrapper Spout | `dsp-spout-send` share GPU local | preload.js · `spoutApi` (~L40) | ✅ | [V3] |
| Salida NDI/Spout | Broadcast del máster de domo limpio | app.js · `startNDI`/`startSpout` (~L1028) · desde #outputBtn | ✅ | — |
| Dropdown Output | Consolida Full performance · Viewer window · NDI · Spout (4 botones sueltos → 1 menú, punto pulsante si emite) | app.js · `refreshOutputInd` + wiring `#outputBtn`→`openMenu` (~L5769-5770) | ✅ | Rev1 §3 |
| Entrada NDI | NDI en vivo como clip de media | app.js · `addNdiInput`/`makeNdiMedia` (~L1089) | ✅ | [V3] |
| `renderMedia` | Reconstruye el panel de media | app.js · `renderMedia` (~L1628) · #mediaList | ✅ | [M1],[M2] |
| media item/tile | Fila/tile + badges + wiring | app.js · `makeMediaItem`/`makeMediaTile` (~L1698) | ✅ | [M3],[M4] |
| Selección de media | Single/range/toggle multi-select | app.js · `selectMedia` (~L1774) | ✅ | [M2] |
| Import | Archivos/drag/carpetas/secuencias. **[R245b] La secuencia de imágenes se ELIGE ANTES de abrir el selector (modelo Premiere), no se adivina después.** Tres puertas: `pickMedia(false)` —Importar medios…, botón Import, ⌘I, zona vacía— cada imagen es su clip y **nunca pregunta**; `pickMedia(true)` —Importar secuencia de imágenes…— agrupa las numeradas y pide fps; **arrastrar** nunca agrupa (`opts.noSeq` en las tres llamadas de `importDropped`). Las dos entradas del menú hacían lo MISMO hasta R245b: ahí estaba la casilla de Premiere, sin cablear. El selector es el nativo del SO y no admite controles propios → la elección vive en la puerta. `askSeqFps` estrena una tercera salida («Como imágenes sueltas»): antes Cancelar **descartaba los archivos enteros** y con numeradas-que-no-son-secuencia no había salida buena. **Ojo al probar:** `importFiles` deduplica por nombre+tamaño, así que dos pruebas seguidas con los mismos nombres dan un falso «no preguntó» | app.js · `importFiles(files,folder,opts)`/`importDropped`/`pickMedia`/`askSeqFps` (~L2294) | ✅ | R245b |
| Scrub al fotograma clave [R243] | Mientras se ARRASTRA el cabezal, el instante se lleva al fotograma clave anterior → el decodificador decodifica UNO en vez de hasta 250 (GOP del material de masterización). **Medido sin proxy: 4 capas de 7196×912 pasan de 1137 a 128 ms de mediana (8,9×); una capa, de 178 a 16 (11,1×).** Al soltar se pide el exacto, así que la precisión no se toca. `fastSeek()` NO existe en Chromium → los instantes clave salen del demuxador propio (tabla `stss`, que ya leía el camino de WebCodecs). **Guardas (la mitad del trabajo, todas verificadas):** con proxy en uso no actúa · en export manda `exporting`, no la bandera · <2 Mpx ni se lee el moov · intra-only (`_kfAllIntra`) se deja en paz · la bandera se apaga ante `pointerup`/`pointercancel`/`blur` de ventana, para que un arrastre interrumpido no deje el editor enseñando fotogramas clave en silencio · el modo se enciende en el PRIMER movimiento, no en el `pointerdown`, para que un clic suelto no decodifique dos veces | app.js · `kfTimes`/`snapKf`/`kfWorthIt`/`kfWarm` + `_scrubFast` (junto a `_vinstUrl`) · enganche en `vinstSeekVideo` · gesto en el `pointerdown` de `#ruler` · `scrubWarmKf` (junto a `scrubRender`) | ✅ | R243 |
| `adviseHeavyMedia(m)` [R242] | Al importar un clip **pesado** (≥5 Mpx o ≥80 Mbps estimados) sin proxy adoptable, un aviso en la barra de estado recuerda «clic derecho → Generar proxy». Agrupado por tanda (un solo mensaje para N clips, ventana de 900 ms). **ADR-0003 intacto: informa, no genera** — R241 midió que con material de masterización (HEVC 6,5 Mpx, GOP 250) el proxy no es optimización sino la diferencia entre 8 ms y 1148 ms de scrub | app.js · `adviseHeavyMedia` (justo antes de `addVideo`) · llamada desde `addVideo` | ✅ | R242 |
| Carpetas | Árbol de carpetas anidadas + colores | app.js · `drawFolder` (~L1663) · #newFolderBtn (**oculto R148**: clic-derecho en Media) | ✅ | [M1] |
| Búsqueda de media | Filtro de texto con debounce; **Ctrl+F revela el campo** en la fila de filtros, Esc lo cierra | app.js · `showMediaSearch` (~L5660) · #mediaSearch | ✅ | R149 |
| Orden de media (Sort) | Dropdown Name/Date/Type — reemplaza el segmentado Group None/Folder/Type | app.js · `MEDIA_SORTS`/`mediaSortLabel` (~L5673) · `state.mediaSort` · #mediaSortBtn | ✅ | Rev1 §2 |
| Vista List/Grid | Well de 2 botones en el header del panel | app.js · #mediaViewSeg (`state.mediaView`) | ✅ | Rev1 §2 |
| Create row | Import (primario) + Text/Shape/Compose/Adjust; labels colapsan a icono (container-query) | index.html `.crrow`/`.crbtn` · #importBtn/#textBtn/#shapeBtn/#ringBtn/#adjLayerBtn | ✅ | Rev1 §2 |
| Serialización | serProject/serMedia/serClip (v4) | app.js · `serProject` (~L5230) | ✅ | — |
| `saveProject` | Escritura atómica `.isp` + `.bak` | app.js · `saveProject` (~L5231) | ✅ | — |
| open/load | Abrir + reconstruir estado. **[R242]** tres curas de la auditoría 2026-08: (a) `resetProjDefaults()` al entrar — nada del proyecto anterior se hereda; (b) `disposeMedia` de los medios salientes + `deleteTexture` de sus `maskTex` (fuga medida: +5 texturas GL vivas por apertura, con medios reales = VRAM acumulada; `newProject` siempre lo hizo, aquí faltaba); (c) `stripBom` antes de cada `JSON.parse` de proyecto/autoguardado (un `.isp` re-guardado con el Bloc de notas daba «Invalid project») | app.js · `loadProject`/`openProjectPath` (~L9430) · `stripBom` junto a `PSEP` | ✅ | R242 |
| reloadMedia/replace | Relink/swap/adoptar archivos | app.js · `reloadMedia`/`replaceMedia` (~L5335) | ✅ | — |
| autosave/recovery/recents | Autosave a disco, snapshots, recientes | app.js · autosave (~L5482) / `addRecent` (~L2089) | ✅ | — |
| Splash de arranque | **Ventana propia 1080²** previa al editor; barra por hitos reales | splash.html · splash-preload.js · main.js `createSplash`/`finishBoot` · app.js `bootMark`/`bootReveal` | ✅ | R151 |
| Pantalla de lanzamiento (multi-monitor) | Splash Y ventana principal se centran en la pantalla **del cursor**, no en la primaria; se captura UNA vez para que las dos coincidan | main.js · `launchDisplay()`/`centerOnLaunch()` (usadas por `createSplash`+`initialSize169`+`createWindow`) | ✅ | R209 |
| Launcher (pantalla de inicio) | Elegir tipo, editar TODOS los parámetros y ver el resultado antes de crear. **[R227]** barra superior con **«Demos»** (`#lchDemo` → Dome / 2D / 360 Room) y **«Back to project»** (`#lchBack`, sólo si se llegó desde un proyecto abierto) | app.js · `showLanding`/`renderLauncher`/`lchPaint`/`lchCreate` · #landingOv.lch · CSS `.lch-*` | ✅ | R153 |
| landing/loading | Pantalla de inicio + loop de logo (el splash ya no vive acá) | app.js · `showLanding`/`showLoadingScreen`/`startLogoLoop` (~L2073) | ✅ | [U9] |
| Barra de menús | Dropdowns File/Edit/Window | app.js · `openAppMenu` (~L5809) · #menubar | ✅ | [D3] |
| Sistema de menú contextual | Primitiva `openMenu`/`closeMenu` | app.js · `openMenu` (~L5788) | ✅ | — |
| Command palette | Ctrl+K/F1/? todos los comandos | app.js · `openPalette` (~L5972) · #helpBtn | ✅ | — |
| Diálogos estilados | appPrompt/appAlert/appConfirm + **[R227] `appConfirm3`** (guardar/descartar/cancelar → `'save'\|'discard'\|'cancel'`, z-360). **[R228] `_dialogBase`** = andamiaje único de los dos confirm (antes duplicado literal) y **Enter responde el botón ENFOCADO**. **[R312·A8]** con dos cuadros apilados, una sola tecla los respondía TODOS (escuchan en `document`, y `stopPropagation` no frena a los hermanos del mismo nodo): ahora sólo responde el de más arriba y usa `stopImmediatePropagation`. **[R316]** la comprobación vive en `ovTop(ov)`, compartida con `appAlert` — que tenía su propio manejador en `document` y se quedó fuera de R312: dos avisos apilados (los encola `pumpProxy` sin esperar) se cerraban con UNA pulsación. `appPrompt` es inmune por construcción: escucha en su `<input>`, no en `document`. **[R314]** «el de más arriba» se resuelve con `ovs[ovs.length-1]`, NO con `:last-of-type` — ese pseudo-selector mira el último hermano de la misma ETIQUETA, así que cualquier `<div>` que apareciera encima del cuadro lo dejaba sordo a Enter y filtraba la tecla a los atajos globales. **[R312·A5]** el mensaje se **escapa en el sumidero**, no en los 53 llamadores — por estos cuadros pasan nombres de archivo | app.js · `_dialogBase`/`appConfirm`/`appConfirm3` (~L3772) | ✅ | R312 |
| **`esc()` — escape de HTML** [R312·A5] | **EL** escape del programa, y la regla que lo acompaña: todo dato que no haya escrito este programa y acabe en `innerHTML` va envuelto. El DOM se construye con plantillas de cadena, y por ellas pasan nombres de medio, clip, pista y carpeta que escribe el usuario: uno con `<img onerror=…>` ejecutaba su contenido con el puente `DSP` delante (disco entero). Había DOS escapes y casi nadie los usaba — `lchEsc` (completo, sólo en el launcher) y `escAttr` (incompleto: sin `>` ni `'`); los dos pasan a ser **alias** de éste. Escapado en los sumideros: mensajes de diálogo y etiquetas de menú. **[R314]** una entrada de menú con marcado a propósito (el rombo ◆ y la negrita de los selectores de automatización) se marca `html:true` — escaparla a ciegas rompía esos menús | app.js · `esc` (~L110) · `escAttr`/`lchEsc` (alias) · plantillas de `renderMedia`/`renderTimeline`/`mediaProperties`/cesta de compose | ✅ | R312 |
| **Borrado de varios medios** [R312·A8] | Supr sobre una selección pregunta **una vez** y resume qué se pierde (secuencias + medios usados en otras secuencias). Antes llamaba a `deleteMedia` en bucle: N cuadros apilados, y un Enter los aceptaba todos con el botón primario —Eliminar— borrando de golpe clips que el propio aviso declara irrecuperables con Ctrl+Z | app.js · `deleteMediaMany` · `deleteMedia(m,sinPreguntar)` · `deleteSequenceMedia(id,sinPreguntar)` | ✅ | R312 |
| Paneles collapse/resize | Rails + gutters + workspace | app.js · `setPaneCollapsed` (~L5533) | ✅ | — |
| i18n | T/applyLang/setLang | app.js · `applyLang` (~L6256) | ✅ | — |
| Perf mode | Visor a ventana completa | app.js · `setPerfMode` (~L5613) · desde #outputBtn (**#perfBtn retirado R148**) | ✅ | [V2] |
| Ventana solo-visor | Pop-out con la vista **COMPLEMENTARIA** del editor (2D ⇄ 3D, domo y sala) + barra propia; bombeo con rAF propio, sin readPixels (**R226**) | app.js · `openViewerWindow`/`viewerBuildDoc`/`viewerPump`/`viewerPaint` · desde #outputBtn (**#popoutBtn retirado R148**) | ✅ | — |

---

### Catálogo de iconos — `ICO(n,s)` (index.html ~L1126)
- **Purpose:** mapa `nombre → cuerpo del <svg>` (viewBox 0 0 24 24, stroke currentColor 1.8). Se inyecta por `ICO(nombre,tamaño)` o por `<i class="ic" data-ico="nombre">` (el arranque recorre `[data-ico]`).
- **[R164] Calcado verificado:** de los 32 botones con icono del handoff *Editor Domo Rev 1*, **31 de 31 existentes son idénticos** (el 32.º es `Simple`, el conmutador Ableton eliminado a propósito). Herramienta: `scratchpad/icon-bylabel.mjs` empareja **por rótulo de botón** contra el DOM vivo — no por selector adivinado, que daba falsos positivos.
- **Invariants / gotchas:** hay referencias **DINÁMICAS** (`ICO(k?'kfFull':'kfEmpty')`, `ICO(i.ico)` en menús generados) → **no podar el catálogo con una expresión regular**: `redo` aparece como "sin uso" y sí se usa.
- **Status:** ✅

### Superposiciones del visor — `#dispSeg` (index.html) · `updModeUI` / drawFlatFrame / drawRoomGrid2D
- **Purpose:** **[R174]** Grid · Outline · **[3.º por formato]** · Alpha — CUATRO, como el handoff, y **sólo icono** (`.vseg.iconly` oculta `.vlbl`; el texto queda en el DOM para el espejo de "More"). Safe se eliminó (archivado). El tercer hueco cambia de FUNCIÓN con `state.seqMode`, no sólo de nombre.
- **[R168·Etapa 7]** domo → `hfade` (Horizon, desvanecido cerca de la línea de arranque: uniforme de sombreador en `PB`/`PR`) · 2D plano → `state.view.showCenter` (Center, cruz de centro en `drawFlatFrame`) · sala → `state.view.showSeam` (Seam, juntas entre muros en `drawRoomGrid2D`). El botón mantiene `data-d="hfade"` como id de hueco; `updModeUI` reescribe rótulo, tooltip y estado `.on`.
- **Invariants / gotchas:** `isFlat()` incluye `room`, así que el orden de comprobación es **isRoom() antes que isFlat()** en el manejador y en el dibujo. El horizonte NO se puede medir en el lienzo `#grid`: vive en el sombreador del WebGL.
- **Status:** ✅

### Equirect 360° — `FSEQ`/`PEQ` (composite) · `FSPH`/`PSPH` + `sphVAO` (visor 3D)
- **Purpose:** una fuente 2:1 se trata como panorama esférico. En el composite se deforma a domo (fase 1, R126); en el visor 3D en ÓRBITA se dibuja además sobre una esfera entera atenuada al 45% (fase 2, R169) para ver el entorno que el casquete descarta.
- **Location:** app.js · `FSEQ` (~L389) · `FSPH`/`PSPH`/`buildSphereMesh`/`equirectClipAt`/`drawEquirectSphere` (~L457) · llamada dentro del bloque 3D de `render()` · `pareceEquirect(m)` junto a `makeClip`.
- **Invariants / gotchas:** **el signo de la v.** Las texturas suben con `UNPACK_FLIP_Y_WEBGL=true`, así que `v=0` es el borde INFERIOR del archivo → el cenit debe ser `v = 0.5 + lat/π`, NO `0.5 − lat/π`. Con el signo malo el panorama sale invertido (suelo arriba) y no salta a la vista con contenido abstracto. Los dos sombreadores comparten el criterio: si se toca uno, tocar el otro. La esfera NO se dibuja en modo Viewer (dentro eres el público: sólo existe lo que el domo proyecta) ni escribe profundidad, para que el casquete gane donde se solapan.
- **Status:** ✅

### Clips enlazados A/V — `link` · `avRole` (app.js, ~L1990)
- **Purpose:** un vídeo con sonido entra como DOS clips (imagen + audio en la pista de audio más cercana) unidos por `c.link`. **[R223]** El enlace significa exactamente esto y nada más: **mover juntos (sólo en horizontal), recortar juntos, velocidad juntos, loop juntos** y borrar juntos. La **selección es INDEPENDIENTE** (se edita una mitad sin tocar la otra) y los **fundidos son independientes** (el fade manual del vídeo no crea fade en el audio; el fade de un clip de audio es su volumen). Clic derecho → Desenlazar / Enlazar.
- **Key symbols:** `linkPartner(c)` · `linkedIds(ids)` · `_mirrorLinkTrim(clip,cBase,lb,snap)` **[R223 · R314 · R320]** (espeja en el partner el delta absoluto del recorte, con su propia base congelada; con `snap` rebasa además SU automatización. **Son SIETE los puntos de llamada**, no «los cinco modos» que decía el comentario de R314: el roll llama dos veces —una por lado— y el crossfade del tirador de fundido es el séptimo; `slide` y el crossfade llamaban sin `snap`) · `armMediaAudio(m)` (decodifica el audio del vídeo a búfer + picos, tope `LINK_MAX_BYTES`; **[R241]** `decodeAudioData` atiende los callbacks **y además devuelve una promesa**: hay que `.catch()`-earla o cada clip SIN pista de audio deja un rechazo no capturado en consola, aunque el `catch` de la función ya trate el caso como normal — mismo remedio que el export lleva en su decodificación) · `attachLinkedAudio(cv,m)` · `nearestAudioLane(li,start,dur)` → `{lane,creada}` · `_applyClipSpeed` / `_applyLoopToggle` **[R223]** (núcleos sin undo/render, aplicados al clip y a su partner en la misma transacción) · `unlinkClip` / `linkClips`.
- **Invariants / gotchas:** **[R223] el enlace ya NO vive en la selección, vive en el GESTO.** Antes el `pointerdown` hacía `state.selIds=linkedIds(...)` y todo lo demás salía gratis; ahora `drag.items` sí incluye al partner (`items[].linked=true`) pero `drag.primaryIds` guarda la selección REAL, y sólo lo primario puede cambiar de pista → **libertad vertical**: el vídeo se mueve entre pistas de vídeo y su audio se queda quieto (antes el audio acababa arrastrado a una pista de vídeo). Corolario: "single vs multi" en `onTLMove`/`onTLUp`/`showMoveGhosts` se decide por `primaryIds.size`, NO por `items.length`. El recorte de cualquier tipo (`applyTrim`, `trimNudge`, `trimL/trimR`) espeja al partner vía `base.linkBase`/`aLinkBase`/`bLinkBase`. `collectAudioEvents` decide por la PISTA (`lane.kind===audio`), NO por `avRole`: al desenlazar se borra el rol y con `avRole` la mitad de audio se quedaba muda. La mitad `avRole===v` se silencia en previsualización (`vinstAudio`) o sonaría dos veces. Copiar/duplicar/pegar produce clips SUELTOS: dos pares con el mismo `link` romperían `linkPartner`. Si el corte no puede partir la pareja, la mitad derecha queda suelta por el mismo motivo.
- **Status:** ✅
- **Ticket:** [R223] Etapa 1

### Audio de una composición — el clip DERIVADO (`nestAudioOf`) · [R225·9]
- **Purpose:** **REGLA DE ORO (Beltrán): nunca suena audio que no esté visible en una pista de audio.** Un nest con pistas de audio DENTRO estrena en la secuencia padre un **clip de audio derivado**: un clip normal cuyo `mediaId` ES el nest, en una pista de audio, marcado `nestAudioOf:<id del clip de vídeo>` y enlazado a él con el `link`/`avRole` de siempre. Se mueve, recorta, cambia de velocidad y se deslinca como cualquier par A/V; el doble clic entra a la secuencia del nest (ese camino sólo mira el medio del clip, que es el nest); su sonido es la mezcla de las pistas de audio del nest.
- **Key symbols:** `nestHasInnerAudio(m,depth)` (¿algún clip suyo en una pista de audio de SU secuencia? recursivo) · `isNestAudioClip(c)` · `syncNestAudioClips()` → `{creados,quitados}` (crea el que falte, retira el que sobre y limpia el `avRole` de la mitad de vídeo) · llamadas: `nestSelection`, `switchSeq`, `closeSeqTab`, `loadProject`.
- **Cómo era antes:** el nest sonaba por su clip de VÍDEO — `collectAudioEvents` descendía a sus `nestClips`, y con proxy de composición ([R180]) sonaba además el `<audio>` del archivo horneado. En los dos casos el sonido salía de una pista de vídeo, sin nada que se pudiera silenciar, mover ni ver.
- **Invariants / gotchas:** **tres vías de fuga, las tres cerradas** — (a) `collectAudioEvents` sólo desciende a un nest si `lane.kind==='audio'`, y cuando desciende IGNORA el proxy (la mezcla se recompone de las fuentes: es sólo audio, y da el mismo resultado con o sin proxy); (b) `vinstAudio` devuelve **null** para cualquier nest; (c) `collectDrawnVideoClips` pone `gain:0` a todo lo que esté a `depth>0` (dentro de un nest) — no se inventa un flag porque `gain<=0.001` ya es lo que mutea en `play()` y en `ploop()`, y se compone hacia dentro. **El nivel más alto del export no pasa por (a):** `ncBuild` hornea con `runExport({seqId: el propio nest})`, donde sus clips de audio son de primer nivel → **el proxy conserva el audio**. **Consecuencia asumida:** un vídeo metido en un nest cuya mitad de audio no existe (archivo por encima de `LINK_MAX_BYTES`, o sin sonido demuxable) queda mudo — que es exactamente lo que la regla pide, porque su sonido no está representado en ninguna pista. El derivado NO se dibuja: `prepNests` y `collectActiveVideos` lo saltan (componer su nest en una FBO cada fotograma sería trabajo tirado). `serClip` es un clon profundo → `nestAudioOf` viaja en el `.isp` sin tocar la serialización. Si el usuario lo borra a mano, la siguiente sincronización lo repone (es lo que pide el ticket).
- **Status:** ✅
- **Ticket:** [R225] Etapa 3 · ítem 9

### Alto del panel del timeline — `tlMaxH` / `clampTimelineH` (app.js ~L6720)
- **Purpose:** el panel mide lo que miden sus pistas: ni banda vacía debajo de la última, ni pistas escondidas.
- **[R171]** `tlMaxH()` sólo limitaba el ARRASTRE; la altura de partida está cableada en el CSS (`.timeline{height:402px}`) y no se recalculaba. `clampTimelineH()` —llamada al final de `renderTimeline`— ajusta el panel a `tlMaxH()` en AMBOS sentidos mientras nadie haya tocado el divisor; si el usuario lo arrastró (`_tlAltoManual`), se respeta su altura y sólo se recorta al tope.
- **[R244] El arrastre YA NO lo limitan las pistas: las pistas lo acompañan.** Con dos pistas en la altura máxima de entonces (120) el panel topaba en **281 px** aunque la ventana diera para 828 — el bloqueo que reportó Beltrán. Ahora el arrastre topa en la VENTANA (`tlDragMaxH()`, 92 %) y `fillLanesToViewport(base)` reparte el hueco entre las pistas, **en los dos sentidos**. El acoplamiento se decide **una sola vez por gesto** (`tlLanesFit()` en el `pointerdown`, vía el parámetro `before` de `hResize`): si las pistas CABEN, el arrastre las lleva; si el contenido ya desborda —«infinitas pistas»— no se toca nada y manda el scroll de siempre. Decidirlo en cada movimiento NO vale: al achicar, el contenido desborda en el primer píxel y el acoplamiento se apagaría a mitad del gesto, que es justo el caso que se pedía cubrir.
- **[R244] Dos trampas resueltas:** (a) **un solo techo** — `LANE_MAX_H` 120 → **480** para TODOS los caminos; con dos techos, una pista que el divisor dejara en 300 saltaba a 120 al primer Alt+rueda hacia arriba (encoger al pedir crecer); (b) **dos topes peleando** — el arrastre llega al 92 % y el recorte usaba el 78 %, así que al soltar el panel retrocedía: con altura manual el recorte usa ahora `min(tlDragMaxH(), tlContentH())`. Y `clampTimelineH` se aparta durante el arrastre (`_tlResizing`): el reparto deja un par de píxeles de deriva por redondeo y devolverlos en cada movimiento producía temblor. El sobrante se le da a la última pista elástica → el contenido cae exacto sobre el hueco (medido 435 = 435), sin barra de scroll fantasma.
- **[R267] Con TODAS las pistas plegadas el divisor no repartía** — y «achicar al mínimo con Alt+rueda» las PLIEGA (`wheelResizeLanes` pliega al bajar del suelo), así que era el caso normal, no uno raro: el panel volvía a 233 px por mucho que se subiera. Ahora se despliegan y se reparten, sólo si SOBRA sitio y sólo si estaban plegadas TODAS (las plegadas a mano se respetan). · **El reparto es IGUAL, no proporcional**: antes conservaba la relación entre pistas y daba el sobrante entero a la última (siete a 82 px y una a 85); ahora la diferencia máxima entre dos elásticas es de un píxel, y las que topan salen del reparto devolviendo lo suyo a las demás.
- **[R266] La banda muerta bajo la última pista tenía DOS causas.** (a) El acoplamiento se decidía una sola vez, en el `pointerdown`, y esa decisión **caduca**: en cuanto el panel supera al contenido, el hueco crece y nadie lo rellena — la secuencia que reportó Beltrán («achiqué al mínimo y después volví a extender»). Ahora, si aparece banda muerta a mitad del gesto, las pistas **se acoplan desde ese instante**; lo que se sigue sin hacer es desacoplar a mitad, que es lo que R244 evitó a propósito. (b) `_tlResizing` sólo la apagaba un `pointerup` **en la ventana**: soltar fuera la dejaba encendida y `clampTimelineH` moría para el resto de la sesión (medido: 387 px de banda muerta y creciendo al plegar pistas). `hResize` **captura el puntero** y cierra también con `pointercancel`/`lostpointercapture`/`blur`, una sola vez, y el que llama le pasa su limpieza como gancho de final en vez de colgarla de un `pointerup` propio.
- **[R244b] `#ruler` está DENTRO de `#tlscroll` y cuenta.** Es hija del área de scroll y, aunque sea `position:sticky`, sigue en flujo (`.tracks{min-height:calc(100% - 24px)}` lo confirma), así que el hueco para pistas es `clientHeight − alto de la regla` → `tlHueco(sc)`. R244 repartía el `clientHeight` entero y dejaba un desbordamiento permanente de esos 24 px; con `.tlscroll{scrollbar-width:none}` **no se veía** y recortaba la última pista en silencio. · **`maxManual` necesita el suelo de 170** (`Math.max(170,…)`, que `tlMaxH()` sí llevaba): sin él, plegar las pistas tras un arrastre hundía el panel a 89 px, por debajo del `#toolRail`. · **`markDirty()` va en el `pointerup`, no en el `pointermove`**: son dos IPC + `raInvalidate()` por llamada y el `after` corre a 60 Hz.
- **Invariants / gotchas:** sólo recortar NO vale: al enlazar audio se puede crear una pista nueva (A2) y quedaría fuera de vista, que es peor que la banda vacía que se quería quitar. · `tlMaxH()` (78 %, contenido) manda en el AJUSTE AUTOMÁTICO; `tlDragMaxH()` (92 % de ventana) en el ARRASTRE — no confundirlos. · `wheelResizeLanes` recibe un **evento**, no un número: pasarle `-100` deja `e.deltaY` en `undefined` y encoge siempre (falso hallazgo que ya costó una corrida). · **Al medir el reparto, comprobar `scrollHeight === clientHeight`, NO «suma de alturas === clientHeight»**: lo segundo es la igualdad que el propio reparto impone, así que da verde aunque el cálculo esté mal (le pasó a la sonda de R244 y ocultó el desbordamiento de 24 px).
- **Status:** ✅ _(R244: verificado con PointerEvents reales — agrandar 170→430 con pistas 57→207 · achicar 430→230 con pistas 207→106 · 14 pistas con alturas intactas · suelo y techo respetados)_

### Menús desplegables — `openMenu` / `closeMenu` (app.js ~L6871)
- **Purpose:** todo desplegable se abre al pulsar su disparador y se CIERRA al pulsarlo otra vez.
- **[R172]** El `pointerdown` global cerraba el menú y el `click` siguiente —del mismo botón— lo reabría, así que no se cerraba nunca. `openMenu` guarda ahora el RECTÁNGULO del disparador; si el pointerdown que cerró el menú cae dentro de ese rectángulo y llega en menos de 600ms con el botón izquierdo, no reabre.
- **Invariants / gotchas:** se compara por POSICIÓN, no por nodo (abrir el menú de un chip re-dibuja la cabecera y el elemento ya es OTRO), y el vínculo cierre↔reapertura es el **sello del pointerdown** (`_ptrSeq`), no una ventana de tiempo — con reloj, descartar en el visor y volver al mismo botón dejaba el botón muerto **[R173]**. `rectDe` busca en una lista CERRADA y por orden (`.achip` antes que `.alab`, que vive dentro); sin coincidencia devuelve null, porque caer en el elemento crudo guardaba contenedores enteros y bloqueaba todo lo de dentro. El dueño NO se apunta si el pointerdown cayó dentro de otro menú (submenús) ni si no hubo pointerdown (la barra cambia de menú al pasar el ratón). Sólo con el botón IZQUIERDO. En `openAppMenu` el resaltado `.on` va DESPUÉS de `openMenu` y **sólo si el menú quedó abierto**.
- **[R200] `z-index:500`, por encima de CUALQUIER overlay** (landing 300, modales 320). Con `60` el menú nacía **detrás** del landing: el desplegable de orientación de los muros parecía «no abrir nada» — abría, con sus cuatro opciones, pero tapado. Un menú contextual es siempre lo más alto: es transitorio y sale de algo que ya está debajo. Se detecta con `document.elementFromPoint` sobre el propio menú, no con `getComputedStyle`: lo que importa es quién recibe el clic.
- **Status:** ✅

### Barra del visor — `.vptool` / `_updViewCtl` (app.js ~L6522)
- **Purpose:** `2D|3D` · superposiciones · calidad · `Orbit|Viewer` · FOV · **⚡Clip / ⚡Comp** · zoom · Output.
- **[R225·10] los dos interruptores de proxy son un PAR:** mismo icono (`bolt`) y el rótulo los distingue — `#proxyToggle` = **Clip** (proxy de cada clip, `state.view.useProxy`) · `#nestCacheToggle` = **Comp** (proxy de composición, `state.view.useNestCache`). Antes decían "Proxy" y "Comp" con iconos distintos (`bolt` y `layers`) y no se leían como el mismo mando. El desplegable `openVpMore` estrena la entrada del segundo: cuando la barra se estrecha, `Comp` no aparecía en ningún sitio.
- **[R174]** Calcada del handoff: fuera **Safe**, fuera **DIST** y **DOLLY** (en Viewer sólo queda FOV), superposiciones sólo icono y **presentes también en 3D** (en el prototipo su visibilidad depende sólo del ancho, `dispInline: centerW>=620`). `.camslot` baja de 324 a 150px: reservaba FOV+DOLLY y el hueco vacío empujaba las superposiciones fuera de la barra en 3D.
- **Invariants / gotchas:** la visibilidad de `#threeModeSeg` (Orbit|Viewer) vive en `_updViewCtl`, NO en el manejador de clic del botón 3D — estaba sólo ahí y llegar a 3D por otra vía (abrir proyecto, cambiar de secuencia) dejaba el grupo escondido.
- **Status:** ✅

### Arranque con proyecto — `bootReveal` / `bootEsperarProyecto` (app.js, cabecera)
- **Purpose:** abrir un `.isp` con doble clic muestra UNA sola pantalla: el splash 1080² carga el proyecto y el editor aparece ya montado, con medios y proxys.
- **Key symbols:** `_bootEsperandoProyecto` · `bootEsperarProyecto()` (+ cortafuegos de 35s) · `bootProyectoListo()` · `esperarMediosArranque(deadline)` · puente `DSP.bootProject()` ⇄ `ipcMain.on('dsp:bootProject')`.
- **Invariants / gotchas:** **[R175b]** el destino del arranque (launcher / demo / nada) se decide con `_bootEsperandoProyecto`, NO con la presencia de `#loadingOv` — R175 dejó de crearlo y el launcher se pintaba un par de fotogramas antes de que `hideLanding()` lo quitara. Y **todo diálogo** (`appConfirm`/`appAlert`/`appPrompt`) suelta el splash antes de pintarse: si no, la pregunta —p. ej. la de recuperar autoguardado— queda dentro de la ventana aún oculta. El renderer **PREGUNTA** si el arranque trae proyecto (`sendSync`), no espera `dsp:openPath`: ese mensaje sale en `did-finish-load` y llega DESPUÉS de que el editor decida revelarse — medido: revelado a 2,4s, proyecto a 2,6s. Toda salida de `openProjectPath` debe llamar a `bootProyectoListo()` o el splash se queda fijo para siempre y el proceso principal acabaría revelando una ventana aún en `preboot`.
- **Status:** ✅

### Recorrido guiado — `tourSteps(fmt,demo)` / `startTour(fmt,demo)` / `tourTrasCrear(fmt,demo)` + demos (app.js ~L3577)
- **Purpose:** **[R227]** sale con los **DEMOS de la pantalla de inicio** (`startDemoProject('dome'|'flat'|'room')`), no al crear un proyecto: sobre un proyecto vacío señalaba huecos y estorbaba al empezar. 9 pasos sobre el demo (incluidos clip seleccionado + inspector, efectos, automatización encendida con curva, y la composición) y 6 genéricos desde **Ventana → Recorrido guiado**. Ficha completa: [Recorrido guiado + proyectos demo](#recorrido-guiado-d7--proyectos-demo-r227).
- **[R227]** `newProject`/`newRoomProject` ya NO lo disparan: **devuelven `true`/`false`** para que el launcher y los demos sepan si la creación ocurrió. `_tourSkipNext` desapareció (no queda disparo automático que silenciar).
- **[R210]** Antes: disparador único al final de `newProject`/`newRoomProject`, por donde pasan launcher, menú File y Ctrl+N. **[R178]** Antes de eso: ANTES del launcher, sobre una escena de demostración (`startOnboarding`, archivada), y sólo la primera vez de cada formato.
- **Invariants / gotchas:** `startTour` recibe el FORMATO, no un booleano. Espera 900 ms a que el editor esté pintado — recorta agujeros sobre elementos reales y necesita sus medidas. **[R210]** Se eliminaron las banderas de localStorage `dspOnboardV1` y `dspTour_*` con sus seis funciones: al salir siempre ya nadie las leía (y `onboardDone()` llevaba sin lectores desde R178).
- **Status:** ✅

### Manual de usuario — `docs/manual/`
| Componente | Qué hace | Ubicación | Estado | Roadmap |
|---|---|---|---|---|
| Texto del manual | 29 capítulos en inglés, seis partes | `docs/manual/manual.html` | ✅ | R306 |
| Extracción de catálogos | Vuelca `commandList()`, `FXTYPES`, `ANIM_PRESETS`, menús, códecs y tipos de composición de la app VIVA → `datos.json`; el índice y los capítulos 26 y 28 se generan desde ahí | `docs/manual/build/extraer.mjs` · `extraer2.mjs` | ✅ | R306 |
| Capturas | Fotos por CDP: monta los demos, abre cada cuadro, recorta por selector a escala 2. **Los selectores se prueban EN ORDEN** (`querySelector` con lista devuelve el primero del DOCUMENTO) y el recorrido guiado se cierra por `_tourStop` TRAS la espera | `docs/manual/build/capturar.mjs` · `tomas.json` | ✅ | R306 |
| **Capturas numeradas** [R307] | Modelo Ableton: se enseña la ZONA de la que se habla, ampliada, con los controles numerados encima. Los rectángulos los mide `capturar.mjs` sobre el DOM vivo; `"discos":true` dibuja sólo el número, porque en zonas CONTIGUAS dos recuadros trazan filetes paralelos que se leen como error de encuadre | `docs/manual/build/tomas-m.json` · `anotar.py` | ✅ | R307 |
| Recorte del pie [R307] | Quita la franja inferior uniforme de las capturas altas (el inspector mide 850 px con media vacía y a ancho de columna se salía de la hoja). Mide ignorando los bordes laterales — el borde del panel es más claro que el fondo — y **salta las imágenes con alfa**, o se come el logotipo | `docs/manual/build/recortar.py` | ✅ | R307 |
| Impresión a PDF | Portada (sin pie, sin márgenes) y cuerpo (con pie numerado) por separado, porque Chromium reserva margen de pie en todas las hojas | `docs/manual/build/imprimir.js` | ✅ | R306 |
| Armado + índice | Dos pasadas: imprime, LOCALIZA los titulares por **tamaño de fuente** (19-24 pt; la altura que devuelve `search_for` es la de la línea y metía cuatro capítulos en la página equivocada), reimprime con los números y pega + marcadores | `docs/manual/build/armar.py` | ✅ | R306 |

---

## Deuda técnica & gaps detectados en el mapeo

- **🗄️ Automatización legacy — ARCHIVADO (R137).** Las funciones muertas (`_autoOff` override/re-enable + perform-and-bake `recWrite`/`bakeRecorded` + `#autoRecBtn`) se sacaron del software y viven en `_backup/deprecated/20260722-automation-override-and-perform-bake.js` (recuperables). Verificado por CDP: motor de automatización intacto. **Barrido menor HECHO (R137):** removidos los reads no-op de `_autoOff` en sepAuto, returnToDefault, `drawAutoCurve` (var `off`), fxKfToggle y borrado de fx — solo queda `_autoOff` en un comentario (app.js L463). Curva renderiza OK (verificado por píxel).
- **✅ Sub-lanes apiladas — LIMPIADO (R143).** Confirmado código muerto (mapeo arch-explorer): el render de sub-carriles apilados `appendAutoLanes` ya estaba neutralizado por `[A5]` (`return;` de cabeza), así que `lane._auto`/`lane._autoH` + `addAutoLane(At)` + `laneAutoH` y la lista legacy de clip `c._auto` (`closeAuto` + copia en `sepAuto` + `returnToDefault` + filtro en fx-delete) no dirigían nada. Archivado en `_backup/deprecated/20260723-automation-sublanes-and-clip-auto.js` y quitado. Único modelo vigente: `lane._autoP` (una superposición por pista vía `laneAutoP`/`attachClipAuto` + chooser de cabecera). Data vieja en `.isp` (lanes[]._auto) queda ignorada (sin migración necesaria). Verificado por CDP.
- **✅ Gap de grado en fulldome/equirect — CERRADO (R138).** Las rutas PFD/PEQ ahora llaman `bindClipLUT(c,LFD/LEQ)` (que encadena grade+curve) y los shaders FSFD/FSEQ aplican ruedas/curvas/LUT igual que FSW. Las tres funciones bind aceptan un struct de ubicaciones `L` (default `LW`). LUT en unit 2, curva en unit 3 (libres en PFD/PEQ). Identidad por defecto → clips existentes sin cambio. Verificado: ambos shaders compilan+linkan en WebGL2 real.
- **🗄️ Master Grade — ARCHIVADO DEL TODO (R148 UI + R150 motor). CERRADO.** Beltrán decidió (c): fuera del código. Ya no queda nada vivo — `state.seqGrade`, `masterGradeOn`, `applyMasterGrade`, `_masterClip`, `_MG` y sus seis call-sites salieron a `_backup/deprecated/20260725-master-grade-engine.js`. Verificado por CDP: los siete símbolos no existen, el render sigue, la sección **Color por clip** queda intacta (5 numéricos + Glow/Chroma + 3 ruedas LGG + LUT), `serProject` ya no escribe `grade`, y **un `.isp` viejo con `grade` (incluso con una ruta de LUT inexistente) abre sin romper** — el campo se ignora. Cero errores de consola.
- **✅ Búsqueda de media — CERRADO (R149).** `Ctrl+F` revela un campo real en la fila de filtros (`showMediaSearch`), abre el panel si estaba plegado y aparta el well de filtros para ocupar la fila (200px útiles sobre un panel de 292); `Esc` lo cierra limpiando el filtro. Antes enfocaba un input `display:none`.
- **✅ Tooltip de `Fit` — CERRADO (R149).** Ya no promete "(H·W)": dice "Fit the whole timeline to the visible width", que es lo que `fitAll()` hace.
- **[R196] La rotación de un compose.** La fila «Rotation» del Transform SIEMPRE estuvo en el panel (`TF` la incluye), pero el camino de dibujo de una imagen que ya es un domo entero —que es como se dibuja un nido en una secuencia de domo, `c.props.fulldome`— sólo leía el azimut, así que el control se movía y no pasaba nada. Ahora `rot` **se SUMA al azimut** en ese camino: sumar y no sustituir es lo que evita mover un solo grado los proyectos que ya giraban su composición con `az`. Verificado: `rot=90` da exactamente la misma imagen que `az+90` (PSNR infinito).
- **[R195] Velocidad por clip.** La fila usa el componente `.field` como el resto de parámetros: **arrastrar recorre 50-200%** (el rango con el que se trabaja) y **doble clic escribe cualquier valor**, con la barra pegada al extremo si se sale. Antes era un `<input type=range>` de 25-400% con la cifra sólo de lectura.
  - **Cambiar la velocidad ESTIRA O ENCOGE el clip** (`setClipSpeed`): abarca el mismo material, así que la duración va al revés que la velocidad. Antes la duración se quedaba fija y cambiar la velocidad recortaba o repetía material en silencio.
  - **La automatización viaja con él**: los keyframes son POR CLIP y sus tiempos son relativos a su inicio, así que se escalan por el mismo factor — lo que empezaba a media duración sigue empezando a media duración. Los fundidos se recortan a la nueva duración. **Un clip en BUCLE no se toca**: su largo lo decide el usuario arrastrando, no el material.
  - **⚠ El valor NO se aplica mientras se arrastra.** Al soltar se restaura la velocidad de partida y se llama UNA vez a `setClipSpeed`, para que el estirado se calcule desde el valor original; aplicándolo en cada `pointermove` el factor se acumularía y el clip se encogería sin parar durante el arrastre.
- **⚠️ Tres checkboxes nativos fuera del sistema de toggles (R149).** `#bkToggle` (Remove black) y `#txtStroke` en la sección Clip, `#motionPrev` en Motion. La regla §0 del rediseño da un toggle `.iosw` (26×15, verde) para todo booleano, y Source/Playback ya lo usan; estas tres filas no las cubre el diseño, así que se convierten cuando se toquen.
- **✅ [D2] cola de export sin snapshot — CERRADO POR DECISIÓN (2026-08-04), no por implementación.** La cola corre sobre el `state` vivo, y eso es seguro **porque el scrim impide editar mientras exporta**. Beltrán decidió que NO se va a poder editar durante el export, así que el scrim pasa a ser la solución y el "snapshot congelado al enviar" deja de hacer falta. Esto cierra también el pendiente condicional de `AUDITORIA-2026-07.md` (L42/L340: «se vuelve urgente si se permite editar con jobs en cola»). **Si algún día se levanta el scrim, el snapshot vuelve a ser obligatorio** — no quitar esa protección sin reabrir [D2].
- **🚧 ClipDecoder streaming** — apagado por defecto (`state.view.wcDecode`), pendiente de mover a worker.
- **Colisión de nombres de tickets** — códigos viejos del PLAN (T2/T3/T4/T5 del motor de reproducción, R18) NO son los mismos que los de CORRECCIONES-V2 (T2 trim micro-snap, T4 faders 3D, etc.). Ojo al enlazar.

---

# Bloques de detalle

> Generados por el mapeo de subagentes. Cada bloque: propósito · ubicación · estado/datos · símbolos clave · invariantes/gotchas · estado · roadmap.


---

## 1 · Motor GL & shaders (detalle)

# Subsystem map — WebGL2 engine & shader programs (`app.js`)

Scope: GL2 context init, shader program pairs, uniform-location structs, VAOs, texture helpers, global GL-state gotchas. Color-grade math (lift/gamma/gain/curves/LUT) is owned by another map; here only noted as "FSW hosts those uniforms".

Constants (L3): `PI`, `HALF_PI=PI/2`, `D2R`, `R2D`, `COMP=2048` (dome composite master edge).

---

## GL2 context init
- **Purpose:** Acquire the single WebGL2 context on `#gl` used by the whole renderer; hard-fail with an on-screen message if WebGL2 is unavailable. Installs shared shader-compile helpers.
- **Location:** app.js · top-level (~L117-137) · DOM: `#gl` (`glc`), sibling 2D grid canvas `#grid` (`gridc`/`gx`)
- **Key symbols:** `gl=glc.getContext('webgl2',{...})` (~L118), `sh(type,src)` compile helper (~L136), `prog(vs,fs)` link helper (~L137), `glCheck(tag)` error probe (~L126)
- **Invariants / gotchas:** Context flags `premultipliedAlpha:false, alpha:true, antialias:false, preserveDrawingBuffer:true, powerPreference:'high-performance'` — antialias off on purpose ([R92-T3], all compositing happens in non-MSAA FBOs). `webglcontextlost` autosaves + reloads after 1800ms (~L134); no real restore path. Do NOT add aggressive Chromium flags (hybrid-GPU gotcha → black 3D). Global blend set once at ~L428: `blendFuncSeparate(SRC_ALPHA,ONE_MINUS_SRC_ALPHA,ONE,ONE_MINUS_SRC_ALPHA)`.
- **Status:** ✅ stable
- **Roadmap:** —

## PW — warp program (VSW/FSW): dome fisheye + flat 2D compositing
- **Purpose:** Master per-clip compositing program. Warps a clip's textured mesh into the composite master: three vertex paths — flat (2D rect), annular-sector dome tile, and gnomonic tangent patch (azimuthal-equidistant fisheye). Fragment stage does crop/blur/CA/mask/exposure/contrast/sat/temp/tint/glow/dither + blend modes; also HOSTS the color-grade uniforms (owned elsewhere).
- **Location:** app.js · `VSW` (~L140), `FSW` (~L166), `PW=prog(VSW,FSW)` (~L213) · draws via `meshVAO`
- **Key symbols:** `PW` (~L213), `LW` uniform/attrib struct (~L214-221), `BLEND_ID` (~L222: normal/add/screen/multiply=0, darken=1/MIN, lighten=2/MAX), `MASK_IDX` (~L223: none0/circle1/rounded2/diamond3/vignette4/custom5/pen5). Default `LW.covHalf=HALF_PI` set at ~L224 to avoid divide-by-zero.
- **Invariants / gotchas:** `u_covHalf` = dome coverage half-angle (π/2=180°); content radius `rho=zenith/u_covHalf` — one of the FOUR coupled coverage points ([dome-coverage-r114]). VSW uses `u_mir`/`u_flat`/`u_sector` to select path. Color-grade uniforms `u_lift/u_gamma/u_gain` (R130), `u_curve/u_hasCurve` (R132), `u_lut/u_hasLut/u_lutMix` (R116) live in FSW on texture units 2 (LUT/3D) and 3 (curve) — bound by `bindClipLUT`/`bindClipGrade`/`bindClipCurve` (color-grade map owns these). Out-of-crop pixels `discard` (not `o=0`) so darken/lighten stay neutral.
- **Status:** ✅ stable
- **Roadmap:** color grade = [color-grade-r116] (other map); coverage = [dome-coverage-r114]

## PB — blit program (VSB/FSB): master → screen
- **Purpose:** Blits the composite master texture to the visible canvas with pan/zoom/aspect; clips to the dome disc (unless flat), applies optional horizon fade.
- **Location:** app.js · `VSB` (~L308), `FSB` (~L311), `PB=prog(VSB,FSB)` (~L315) · draws via `quadVAO`
- **Key symbols:** `PB` (~L315), `LB` struct (~L316), `HFADE=0.14` (~L317)
- **Invariants / gotchas:** `u_flat<0.5` discards fragments with `r>1.0` (dome disc clip); flat mode shows the full rect. `u_uvsc/u_uvof` sub-rect the source. Uses screen framebuffer (null FBO).
- **Status:** ✅ stable
- **Roadmap:** —

## PFD — fulldome source program (VSFD/FSFD): fisheye master drawn 1:1
- **Purpose:** Draws a clip whose texture is ALREADY a fisheye/dome master straight into the composite (no gnomonic patch warp). Supports spin/mirror/scale and mask/color adjust. Disc-clipped.
- **Location:** app.js · `VSFD` (~L322), `FSFD` (~L325), `PFD=prog(VSFD,FSFD)` (~L340) · draws via `fdVAO`
- **Key symbols:** `PFD` (~L340), `LFD` struct (~L341). `u_scale` = fulldome zoom ([N1]), `u_spin`, `u_mir`.
- **Invariants / gotchas:** `length(v_p)>1.0` discards (keeps disc). Zoom-out (`u_scale<1`) samples outside source → discard for clean transparent border. NOTE (per PLAN R131): the PFD path has NO primary grade / LUT (consistent with R116).
- **Status:** ✅ stable
- **Roadmap:** —

## PEQ — equirect→dome program (VSEQ/FSEQ)
- **Purpose:** Converts a 2:1 equirectangular (360°) source into a dome master: per disc pixel reconstructs the view ray (rho→zenith, azimuth), rotates by yaw/pitch ("camera"), samples the equirect. Separate program so the core warp is untouched.
- **Location:** app.js · `VSEQ` (~L347), `FSEQ` (~L349), `PEQ=prog(VSEQ,FSEQ)` (~L365) · draws via `eqVAO`
- **Key symbols:** `PEQ` (~L365), `LEQ` struct (~L366). Uniforms `u_yaw`, `u_pitch`, `u_covHalf`, `u_mir`.
- **Invariants / gotchas:** `rho>1.0` discards. UV = `az/(2π)+0.5`, `0.5 − lat/π`. Coverage via `u_covHalf` like PW.
- **Status:** ✅ stable
- **Roadmap:** [F7] (equirect 360 source, tagged in code)

## P3 — 3D dome mesh program (VS3/FS3)
- **Purpose:** Renders the composite master onto a 3D spherical-cap mesh for the dome preview (orbit/viewer), with grid overlay + spring-line rim + horizon fade.
- **Location:** app.js · `VS3` (~L372), `FS3` (~L375), `P3=prog(VS3,FS3)` (~L389) · draws via `domeVAO`
- **Key symbols:** `P3` (~L389), `L3` struct (~L390), `buildDomeMesh(covHalf)` (~L396, cached by `_domeCov`; R=64 rings × S=256 segments), `domeVAO`/`domeCount`/`_domeVB` (~L391), initial `buildDomeMesh(HALF_PI)` (~L409). Screen-space FRONT/RIGHT/BACK/LEFT/ZENITH card labels for this viewer are a separate 2D-overlay function, `drawLabels3D(mvp,spec)` (app.js ~L1589) — also where the [R220] "Preparing media…" pill is painted for this viewer (first thing, right after `clearRect`).
- **Invariants / gotchas:** `u_flipx` = the ONE intentional 2D↔3D handedness inversion — do NOT "fix" it. Mesh UV (`rho=rr`) is coverage-independent; only cap geometry (`zen=rr·covHalf`) changes → coverage switch just re-uploads the VB. S=256 so the rim polygon hides facets ([R94f]). Rim/spring line is thin GREY (was amber) per [U4] (FS3 ~L386).
  **[R198] `u_rimDeg` — la línea de borde sigue al ángulo del domo.** El contorno del borde se dibujaba a `90.0` grados cenitales clavados, pero el borde de la malla está en `cov/2` (110° en un domo de 220°): en cualquier domo >180° la línea se quedaba en el horizonte con la superficie siguiendo por fuera. Ahora `u_rimDeg=curCovDeg()`, escrito en los DOS sitios que usan `P3` (`render` y `renderViewer`) + un valor por defecto de 90 tras enlazar el programa (un uniforme nunca escrito vale 0 → la línea saldría en el cenit). Medido por CDP proyectando el punto del casquete a cada ángulo cenital: la banda clara (gris 82, frente a 21-41 de una línea de rejilla) pasa de 90° a 100° en un domo de 200° y a 110° en uno de 220°; en 180° no cambia nada.
- **Status:** ✅ stable
- **Roadmap:** [U4] (spring line grey), [dome-coverage-r114]

## PR — 3D room program (VSR/FSR): walls + floor quads
- **Purpose:** Renders the 360 immersive room in 3D: textured wall quads (each samples its sub-rect of the unwrapped strip) + floor quad. **[R221]** the floor quad samples the SAME composite/texture as the walls (its own sub-rect, the "dock"), not a separate floor sequence. Multi-pass (outside translucent / inside opaque / floor) with per-face shade + normal-based cull.
- **Location:** app.js · `VSR`/`FSR`, `PR=prog(VSR,FSR)` · draws via `roomVAO`/`roomVB`
- **Key symbols:** `PR`, `LR` struct, `roomVAO`+`roomVB`, geo cache `_roomGeo`/`_roomGeoSeq`, `buildRoomGeo` (builds both wall AND floor UVs into the one buffer)
- **Invariants / gotchas:** `u_pass`: >1.5 floor (opaque), >0.5 inside (opaque, `inward>0` else discard), else outside (translucent `u_backA`, `u_outTex` toggles texture vs flat). `inward = nrm·(cam−wp)`. **[R221]** no more `compositeFloorTex`/second FBO to rebind — archived (`_backup/deprecated/20260729-room-floor-fbo-composite.js`).
- **Status:** ✅ stable
- **Roadmap:** —

## Uniform-location structs (LW / LB / LFD / LEQ / L3 / LR)
- **Purpose:** Per-program dictionaries of `getAttribLocation`/`getUniformLocation` handles, resolved once at program-create time.
- **Location:** app.js · `LW` (~L214), `LB` (~L316), `LFD` (~L341), `LEQ` (~L366), `L3` (~L390), `LR` (~L423)
- **Key symbols:** as above. `LW` is the largest (crop/mask/blur/color/grade/LUT/curve).
- **Invariants / gotchas:** Locations captured at init; adding a uniform to a shader requires adding it to the matching L-struct. `LW` shares texture units: 0=source, 1=maskTex, 2=LUT(3D), 3=curve.
- **Status:** ✅ stable
- **Roadmap:** —

## VAOs (meshVAO / quadVAO / fdVAO / eqVAO / domeVAO / roomVAO)
- **Purpose:** Vertex-array + buffer setup for each program's geometry.
- **Location:** app.js · `meshVAO` (~L298, N=120 grid, 121² verts, Uint32 index, `meshCount`), `quadVAO` (~L318, full-screen tri-pair), `fdVAO` (~L342), `eqVAO` (~L367), `domeVAO` (~L391/L402, dynamic cap), `roomVAO` (~L424, dynamic). Post-process `_ppVAO` (~L537/L6537).
- **Key symbols:** `meshVAO`/`meshCount`, `quadVAO`, `fdVAO`, `eqVAO`, `domeVAO`/`domeCount`/`_domeVB`, `roomVAO`/`roomVB`
- **Invariants / gotchas:** meshVAO is a static 120×120 tessellated `[-1,1]²` grid with UVs, stride 16 (flat vec2 + uv vec2), Uint32 indices. quad/fd/eq VAOs are the same 6-vertex full-quad, but bound to different attrib locations (`LB.p`/`LFD.p`/`LEQ.p`), so they are NOT interchangeable. domeVAO/roomVAO buffers are re-uploaded on coverage/geo change. Always `gl.bindVertexArray(null)` after setup.
- **Status:** ✅ stable
- **Roadmap:** —

## Texture helpers (newTex / upTex / upTexRaw / fitImage / MAX_IMG)
- **Purpose:** Create and upload clip/media textures; downscale oversized images to fit GPU limits.
- **Location:** app.js · `newTex()` (~L1243), `upTex(tex,src)` (~L1246), `upTexRaw(tex,w,h,u8)` (~L1251), `fitImage(el)` (~L1256), `MAX_IMG` (~L1255)
- **Key symbols:** `newTex` (LINEAR + CLAMP_TO_EDGE, FLIP_Y on), `upTex` (same-size `texSubImage2D` re-upload without realloc — [R92-T3] — else `texImage2D`, caches `tex._w/_h`; also handles WebCodecs VideoFrame via displayWidth/Height — R108), `upTexRaw` (raw RGBA byte buffer, used by live NDI input), `fitImage` (canvas-downscale when `max(w,h)>MAX_IMG`), `MAX_IMG=Math.min(8192, MAX_TEXTURE_SIZE||4096)`.
- **Invariants / gotchas:** All three uploaders set `UNPACK_FLIP_Y_WEBGL=true` — this is the app's PREVAILING default (2D image/video uploads are top-down). Oversized upload silently fails (transparent) on integrated GPUs → `fitImage` guards it. NDI upload path (`ndiUpload` ~L1086) sets FLIP_Y=false because the addon already writes bottom-up.
- **Status:** ✅ stable
- **Roadmap:** WebCodecs = [render-in-place-r115]/R108 (other maps)

## Global GL-state gotcha — UNPACK_FLIP_Y
- **Purpose:** Document the single most error-prone shared GL state.
- **Location:** app.js · default set inside `newTex`/`upTex`/`upTexRaw` (FLIP_Y=true); overridden+restored inside `makeLutTex` (~L231-233), `uploadCurveTex` (~L284-286), `ndiUpload` (~L1086)
- **Key symbols:** `gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,...)`
- **Invariants / gotchas:** The app leaves `UNPACK_FLIP_Y_WEBGL=true` globally (2D uploads). **`texImage3D` with FLIP_Y=true is INVALID_OPERATION → LUT texture uploads EMPTY (black).** Any 3D texture (LUT) or specially-oriented 2D upload (curve LUT, NDI) MUST set FLIP_Y=false before upload and RESTORE it to true after (also restores UNPACK_ALIGNMENT 1→4). This is the critical documented gotcha in [color-grade-r116].
- **Status:** ⚠️ fragile (shared global state; forgetting to restore breaks later uploads)
- **Roadmap:** [color-grade-r116] (other map)

## Post-process program factory (VSPP / ppCompile / _ppVAO)
- **Purpose:** Shared full-screen-quad vertex shader + compile helper + VAO for the ping-pong FBO post/FX chain. Note: the FX/post fragment shaders themselves (fisheye pre-warp, keyer, bloom, FXTYPES, mix, DXT-for-HAP) belong to other subsystems; listed here only as the GL infra they share.
- **Location:** app.js · `VSPP` (~L6534), `ppCompile(fs)` (~L6536), `_ppVAO` (~L6537). Consumers: `_FISH` (~L6547), `_KEY` (~L6565), `FXTYPES` compile loop (~L6704), `_BLOOM_BP/_BL/_MX` (~L6706-6714), `PMIX`/`LMIX` (~L6773-6776), DXT progs via `ppCompile` (~L4624).
- **Key symbols:** `VSPP`, `ppCompile` (binds attrib 0 = `a_p`), `_ppVAO`
- **Invariants / gotchas:** `ppCompile` uses `bindAttribLocation(p,0,'a_p')` before link (fixed attrib slot 0) — different from the main programs that read locations back. Fragment-math (fisheye k, keyer, bloom, HAP DXT) owned elsewhere.
- **Status:** ✅ stable
- **Roadmap:** HAP = [hap-export-r100] (other map)


---

## 2 · Render, compositor & modos (detalle)

# Subsystem 20 — Render dispatch, compositor & view/sequence modes

> Crosscutting invariant: **manual `state → render()` binding.** Nothing observes `state`. After any
> mutation, call sites must call `render()` (GL) — and typically `raInvalidate()` when render-ahead is on
> (`raInvalidate()` — **[R318] SIEMPRE, nunca `if(_raOn)`**: `_raGen` no es sólo del caché de render-ahead, es la GENERACIÓN del fotograma compuesto, y de ella cuelgan también los scopes, la salida NDI, la salida Spout y `_warmCache`). Missing a re-render leaves the viewport stale. `markDirty()` (L4900) both
> flags the project dirty AND calls `raInvalidate()`. This is the single most fragile contract of the file.

## Composite FBO + master texture
- **Purpose:** Single master render target into which every clip is composited. View-independent → the same texture feeds the 2D blit, the 3D dome mesh, and the room walls. **[R237] `compW×compH`, con la FORMA del lienzo** (antes era cuadrado de lado `max(w,h)`).
- **Location:** app.js · `COMP` const (L50) · `compTex`/`compFBO` (L634-639) · `compBase()`/`setCompSize(w,h)`/`syncCompSize()` (L685-707) · `composite(t,size,opaque,fill)` (L1049).
- **State owned:** `compTex`, `compFBO`, `compW`, `compH`, `_compTgtW`/`_compTgtH`/`_compFill` (module-level, not in `state`).
- **Key symbols:** `COMP_MAXTEXELS=8192²` (techo de MEMORIA, no de lado) · `GL_MAXSIDE` (mín. de MAX_TEXTURE_SIZE y MAX_VIEWPORT_DIMS) · **[R242] `GL_MAXVP`** (MAX_VIEWPORT_DIMS a secas: acota el viewport de relleno) · `compBase()` → par `[w,h]` · `syncCompSize()` = lienzo × `previewQuality`, lo llaman `resize()`, el selector de calidad y **`render()` en cada fotograma**. Blend init en L632.
- **Invariants / gotchas:** **DOS convenciones conviviendo.** (a) *Relleno* — el máster: el contenido llena la textura, `u,v = 0..1` sobre el lienzo, viewport EXPANDIDO por `compFillVp()` (`vw=compW/Fx`), UV por `mstrU`/`mstrV` y límites por `mstrContentLim`/`mstrLimForRect`. (b) *Cuadrado con letterbox* — export, caché de nests (`_ncSquare` de R180), NDI y Spout: `composite()` sin `fill`, límites por `compContentLim`/`compLimForRect`. **No mezclar las dos parejas.** La matemática de colocación de los clips (NDC, `Fx/Fy`) es la MISMA en los dos casos; sólo cambia el viewport. Los rects de tijera se traducen por `_ndcToVp()`, que lee el origen del viewport (no vale suponerlo en 0,0). Con un lienzo cuadrado (domo) relleno y letterbox COINCIDEN, así que el domo queda intacto por construcción. La calidad de previsualización encoge SÓLO esta textura — nunca el lienzo de pantalla, la malla del domo, la retícula ni los overlays 2D. **[R242]** `compFillVp()` acota sus dimensiones a `GL_MAXVP`: con un lienzo de aspecto >512 (sólo alcanzable tecleando una resolución absurda) el viewport pedido superaba `MAX_VIEWPORT_DIMS` y **el driver lo recortaba en silencio** mientras `mstrU/mstrV` seguían calculando con el pedido → mapeo roto. Acotándolo aquí, cálculo y GL usan los mismos números y el caso patológico degrada a submuestreo consistente. No-op en todo lienzo realista.
- **Status:** ✅ _(R237: sala de 7196×912 a 1:1 con 25 MB — antes 198; sala de 4 muros 4K, 15360×2160, a 1:1 con 127 MB — antes 1,875× de submuestreo)_
- **Roadmap:** [D4] wants this to become an interchangeable "output target" layer (dome fisheye / N-wall room / 3D grid) over the same composite.

## Master `render()`
- **Purpose:** Top-level frame draw. Builds/reuses the master composite for `state.playhead`, then dispatches to one of three view paths (room-3D / dome-3D / 2D-blit) based on `state.view.mode` + sequence mode.
- **Location:** app.js · `render()` (L921).
- **State owned:** reads `state.view.mode` ('2d'/'3d'), `state.seqMode`, `state.playhead`, `state.seqW/seqH`, `state.view.three` ('orbit'/'spec'), grid/checker/hfade flags.
- **Key symbols:** **[R237]** arranca llamando a `syncCompSize()` — el máster lleva la FORMA de lo que se va a dibujar, y de ahí depende el viewport de relleno. Luego fija los globales `_drawFlat=isFlat()`, `_roomWrap=isRoom()`, `_compAspect=seqW/seqH`, `_arTime`. Composite step: `raGet(playhead)` cache hit → reuse `_raHit`; else `prepNests()` + `composite(t,null,false,true)` (con RELLENO) into `compFBO` + `raStore()`. Branch: `mode==='3d'&&isRoom()`→`renderRoom3D()` (L930); `mode==='3d'&&!flat`→dome mesh program `P3`/`domeVAO`, `cameraMVP`, `buildDomeMesh(curCovHalf())` (L931); else→2D blit program `PB`/`quadVAO` + `drawGrid2D()` (L943). Pop-out viewer via `renderViewer(_srcTex)` (L955).
- **Invariants / gotchas:** Early-returns on `glLost` and `exporting`. `u_flipx=-1` in the dome program (L938) is the ONE intentional 2D↔3D handedness inversion — do not "fix". Both 3D paths share the same `_srcTex` (composite is view-independent). Guard: if flat/non-room sequence but mode is '3d', `syncViewForSeq` (L4934) forces back to '2d'.
- **Status:** ✅
- **Roadmap:** [L7] evalP must feed render in real-time (Transform automation in Play); [R2] deformed-clips-on-export bug touches this dispatch.

## `composite()` + clip collection
- **Purpose:** Draws all active clips for time `t` into the currently-bound FBO at `size²`. `compositeClips()` resolves per-lane clip stacking + cross-dissolve transitions; `activeClips()`/`compositeClips()` pick winners.
- **Location:** app.js · `composite(t,size,opaque)` (L732) · `compositeClips(t)` (L719) · `activeClips(t)` (L717).
- **State owned:** reads `state.lanes` (kind/mute/solo/disabled), `state.clips`.
- **Key symbols:** `compositeClips` handles solo/mute, painter-order overlaps, A→B dissolve (`xf` crossfade factor, `dipBlack` transition). Each entry → `drawAdjustment()` (adjustment layer) or `drawClip()`.
- **Invariants / gotchas:** `opaque` controls clear alpha (transparent for nest/checker; opaque for base). Disabled clips (Ableton "0") skipped. Nests must be pre-rendered (`prepNests`) BEFORE `composite`, since `drawClip` samples their pooled tex.
- **Status:** ✅
- **Roadmap:** —

## `drawClip()` per-clip program dispatch
- **Purpose:** Resolves a clip's source texture (video per-clip decode tex / nest pool tex / image), runs pre-warp + FX + black-key, then dispatches to the correct GPU program by clip flags & sequence mode.
- **Location:** app.js · `drawClip(c,m,t,xf)` (L669) · flat path `drawClipFlat()` (L644) / `flatPlace()` (L637).
- **State owned:** reads `_drawFlat` (flat vs dome branch), clip `props` (equirect/fulldome/warp/blend/mask), `_roomWrap`.
- **Key symbols / program map:**
  - `_drawFlat` true → `drawClipFlat` → program **PW** with `u_fmode=1` (flat rectangle; x/y/scale/rot; room seam-wrap `offs`, vertical infinite tile `clipVTile`/`voffs`, `maskWalls` scissor).
  - `props.equirect` → program **PEQ** (`eqVAO`): 360° equirect→dome, yaw=az, `eqPitch` tilt, `covHalf` ([F7]).
  - `props.fulldome` → program **PFD** (`fdVAO`): pre-warped domemaster placed by spin/size ([N1]/[F6] — size scales at 55=1:1).
  - default dome → program **PW** with `u_fmode=0`: azimuthal-equidistant fisheye, `frame(az,el)`, `covHalf`; `props.warp==='dome'` enables annular-sector tiling (`sector`).
  - Pre-passes: `applyFisheye` (flat→fisheye, if `props.fisheye`), `applyChain` (reactive FX, if `hasFx`), `applyBlackKey` (luma key).
- **Invariants / gotchas:** Dome path must reset `u_fmode=0` (a prior flat composite left it 1) — L697. Diameter-wrap el handling (L692). Videos sample per-clip decode tex (`_vinst`) so duplicated clips show different frames; nests sample `c._ntex`.
- **Status:** ✅
- **Roadmap:** [R2] deformed background clips on render.

## Flat/dome/room bifurcation
- **Purpose:** Central predicates deciding rectangular vs fisheye compositing and room-strip behavior.
- **Location:** app.js · `isFlat()` (L633) · `isRoom()` (L634) · `flatLikeMode(md)` (L635).
- **State owned:** `state.seqMode` ∈ `'dome'|'flat'|'room'`.
- **Key symbols:** `isFlat()` = seqMode 'flat' OR 'room' (room composites as a rectangular unwrapped strip); `isRoom()` = 'room' only; `flatLikeMode` for export dims / format chip / nested-sequence draw. Globals set per-composite: `_drawFlat`, `_compAspect`, `_roomWrap` (L628) — reset around nested `composite()` in `prepNests` (L775).
- **Invariants / gotchas:** room is "flat for compositing" but has its own 3D path (`renderRoom3D`) and per-wall grid (skips generic thirds grid, L1147). Nests inherit compositing mode from `m.mode` via `flatLikeMode` (a nest made in 2D/room must not default to dome warping — L791).
- **Status:** ✅
- **Roadmap:** [F2] layout consistency between Domo/2D/360 (pending, task #52).

## Dome coverage (fisheye FOV)
- **Purpose:** Single source of truth for fisheye field of view (180°=fulldome hemisphere). Content radius on master = `rho = zenithAngle / covHalf` — wider coverage pulls the horizon inward.
- **Location:** app.js · `curCovDeg()` (L631) · `curCovHalf()` (L632) · `f2azel()` (L742) · `azel2f()` (L745).
- **State owned:** `state.seqCov` (degrees; default 180). Per-sequence persisted; setup dialog `#ssCov` (L5218).
- **Key symbols:** `curCovHalf()`=half-angle radians → warp uniform `u_covHalf` (PW/PEQ/PFD), dome mesh `buildDomeMesh(curCovHalf())`, `renderViewer`. `f2azel` (2D master pixel→az/el inverse), `azel2f` (forward, for 2D guides).
- **Invariants / gotchas:** All four coupled points (warp uniform, f2azel/azel2f inverse, 2D guides, 3D mesh) must move together (R114). For cov>180° the edge dips below the horizon.
- **Status:** ✅
- **Roadmap:** —

## 2D blit path + flat viewport mapping
- **Purpose:** Final path when not 3D. Blits the square composite to the screen canvas aspect-corrected (dome disc stays circular; flat content letterboxed to sequence aspect), then draws the 2D overlay grid.
- **Location:** app.js · blit branch inside `render()` (L943-952, program **PB**/`quadVAO`) · `flatMap()` (L1142) · `drawFlatFrame()` (L1145) · `drawGrid2D()` (L1173) · `f2pix`/`pix2f` (L739-740).
- **State owned:** reads `state.view.zoom`, `state.view.pan`, `state.seqW/seqH`, `state.view.showGrid/showSafe/hfade`.
- **Key symbols:** flat: uniforms `u_aspect`, `u_flat=1`, `u_uvsc`(Fx,Fy), `u_uvof` inset (L948). dome: `u_aspect=mn/W,mn/H`, `u_flat=0`, `hfade`. `flatMap()` returns `{A,Fx,Fy,px()}` (frame→canvas-pixel) used by the 2D-canvas overlay `gridc`/`gx`.
- **Invariants / gotchas:** Two separate flat-aspect calculations — the GL blit (L947) and `flatMap` (L1142) — must stay consistent. `f2pix`/`pix2f` are the dome (fisheye) pixel↔frame mappings, separate from `flatMap`.
- **Status:** ✅
- **Roadmap:** [U3] hide-grid toggle (`showGrid`).

## 3D room path
- **Purpose:** Renders the 360-room as textured wall quads (sampling their sub-rect of the composite strip) + floor (**[R221]** samples the SAME composite, its own dock sub-rect — no longer a separate texture), with an orbit / viewer-stand camera.
- **Location:** app.js · `renderRoom3D(wallsTex)`.
- **State owned:** `state.view.three` ('spec'=viewer-stand vs orbit), `state.view.checkerBg/roomOutTex`, `seq.room`, `room.stripH` (walls-only height — [R221]).
- **Key symbols:** program **PR**/`roomVAO`; `buildRoomGeo(seq)` cached by `_roomGeoSeq`; two-pass depth (inside opaque, outside translucent) + floor pass (same texture).
- **Invariants / gotchas:** Walls strip is by exact pixels; cm are 3D-geometry-only. **[R211]** el lazo de `roomPlan` envuelve con Right en x− (natural desde dentro); los UVs de `buildRoomGeo` (uL=x1 en a / uR=x0 en b) y el `fuv` del suelo siguen válidos con ese lazo — NO "corregirlos" por separado. Rótulos 3D en espacio de pantalla (`drawRoomLabels3D`), nunca decals sobre el muro. Cámara por defecto de sala detrás de Back (`yaw:1.99`). **[R221]** En 2D el suelo ya no "dockea" fuera del canvas — es la franja inferior del MISMO canvas (`drawRoomGrid2D` dibuja su contorno/grilla/etiqueta; el contenido pinta con el blit normal, sin quad aparte). El wireframe 3D también proyecta la grilla del suelo (`drawRoomLabels3D`) siempre que `room.floor` exista.
- **Status:** ✅
- **Roadmap:** [D4] (fase 2) 3D infinite grid over the same room seam.

## `resize()` + canvas sizing
- **Purpose:** Sizes the two overlaid stage canvases (`#gl` WebGL, `#grid` 2D overlay) to `#stage` at DPR (capped 2), sets `view.cw/ch`/`VSIZE`, then re-renders.
- **Location:** app.js · `resize()` (L1233). DOM: `#stage` (index.html L740), `#gl`→`glc` (L742), `#grid`→`gridc`/`gx` (L743). Grab: `glc=$('#gl'), gridc=$('#grid'), gx=gridc.getContext('2d')` (L117).
- **State owned:** `view.cw`, `view.ch`, `VSIZE` (module globals, not `state`).
- **Key symbols:** both 3d and 2d branches size identically (full panel; blit aspect-corrects). `gx.setTransform(dpr,...)` then `render()`.
- **Invariants / gotchas:** Screen canvas is always full-res (comment L1233); only the composite shrinks for preview quality. Early-returns while `exporting`.
- **Status:** ✅
- **Roadmap:** —

## Render-ahead cache (T4)
- **Purpose:** Optional frame cache of the flattened master composite (downscaled via `blitFramebuffer`), so heavy playback replays one flat texture instead of recompositing N layers + decoding N videos. View-independent → serves both 2D and 3D. **[R237]** La reducción sigue la PROPORCIÓN del máster (`_raW×_raH`, lado mayor = `RA_SIZE`), no un cuadrado: guardar una tira de 7,9:1 en 1024² la habría dejado a 1/8 de resolución horizontal.
- **Location:** app.js · state block (L801) · `raInvalidate()` (L804) · `raGet()` (L806) · `raStore()` (L807) · `raReset()` (L803) · `raHas()`/`_raFrame()` (L805,818) · `raPrerenderRange()` (L823) · idle `raIdleTick`/`raStartIdle`/`raStopIdle` (L835,832,831) · `renderAheadWork`/`renderAheadOff` (L840,847) · `drawCacheMap()` (L817).
- **State owned:** `_raOn` (flag, default off), `_ra` (Map frame→{tex,last,gen}), `_raPool` (tex pool), `_raGen` (generation counter), `_raClock` (LRU), `_raFBO`; mirrors `state.renderAhead`.
- **Key symbols:** `RA_SIZE=1024` (lado MAYOR), `_raW`/`_raH` (dims reales), `raSyncDims()`, `RA_MAX=120` (LRU cap). `raInvalidate()` just bumps `_raGen` (cheap invalidate, no tex delete). `raGet` returns tex only if `gen===_raGen`. `drawCacheMap` paints the Premiere-style cached-frame strip on `#rulerCv`.
- **Invariants / gotchas:** `raStore` never caches when `anyFeedbackFx()` (Trails/feedback is path-dependent → scrubbing would bake temporally-wrong echoes, L807). **[R318] Every edit path calls `raInvalidate()` UNCONDITIONALLY.** Hasta R318, 36 llamadores escribían `if(_raOn)raInvalidate()` —una «optimización» que no ahorra nada, el cuerpo es un `++`— y con render-ahead APAGADO (el valor por defecto) rompía a los otros cuatro consumidores de `_raGen`: scopes congelados al arrastrar una rueda de color, y NDI/Spout emitiendo el fotograma anterior a la edición. **[R320]** diez mutaciones más repintaban sin invalidar (mute/solo de pista, máscaras, `mirror`, los cuatro `group*`): cerradas, y el barrido queda a cero. The manual-binding invariant extends here. `markDirty()` calls `raInvalidate()`. **[R237]** `setCompSize` llama a `raSyncDims()`: si cambia la forma del máster, el caché entero se TIRA (`raReset`) porque sus texturas ya no valen — no basta con invalidar la generación.
- **Status:** ✅ (feature-flagged; off by default)
- **Roadmap:** — (nota: la "[T4]" del ticket = faders del 3D-preview, ya rediseñada en R138; distinta del tag interno "[T4]" de este caché).

## `markDirty()` (binding hub)
- **Purpose:** The canonical "state changed" call: sets `state.dirty`, updates title, invalidates render-ahead.
- **Location:** app.js · `markDirty()` (L4900).
- **State owned:** `state.dirty`.
- **Key symbols:** `state.dirty=true; projTitle(); raInvalidate();`.
- **Invariants / gotchas:** Does NOT itself call `render()` — callers still must. Note `hasKf()` returns `undefined` (not false) → use `!!hasKf(...)` for WebIDL toggles.
- **Status:** ✅
- **Roadmap:** —

## [R220] "Preparing media…" pill — mediaWarming/drawPreparingPill/clipTexReady
- **Purpose:** Discreet centered-top overlay telling the user a video (or nest-cache) clip active at the current playhead doesn't have a texture yet (decoder still spinning up). Shown in BOTH the 2D viewers (dome disc, flat, room strip) and the 3D viewers (dome orbit/spec, room orbit/stand).
- **Location:** app.js · `clipTexReady(c,m)` (~L1119) · `mediaWarming()` (~L1128) · `armWarmTimer()` (~L1144) · `drawPreparingPill()` (~L1147). Called from `drawRoomLabels3D` (~L1153), `drawLabels3D` (~L1200-ish, dome 3D), and `drawGrid2D()` (both the `isFlat()` early-return branch and its final line, ~L1563/1577).
- **State/data:** module cache `_warmCache={t,gen,ts,val}`, single-flight timer `_warmTimer`, pill width cache `_pillW`/`_pillWLang`. Reads `state.playhead`, `_raGen`, `state.clips/lanes`. **[R221]** no longer checks a separate `room.floorSeqId` sequence — the floor's clips live in `state.clips`/`state.lanes` already (same sequence as the walls), so the single `warm(state.clips,state.lanes)` call covers them.
- **Key symbols:** `clipTexReady(c,m)` — single source of truth for "is this clip's texture actually ready", mirrors the `ntex` branching `drawClip()` does at its own top so the hot draw path and this check can't drift apart. `mediaWarming()` — memoized: recomputes `collectDrawnVideoClips()` (O(lanes×clips log clips) via `compositeClips`) only when `state.playhead` OR `_raGen` changed, OR when >250ms elapsed since the last compute (catches a decoder finishing mid-pause with the playhead not moving); otherwise returns the cached bool. At rest with media ready this is ≈free. `armWarmTimer()` — since nothing else repaints while idle once warming ends (e.g. `addVideo` doesn't call `render()`), arms a single `setTimeout(300ms)` that calls `render()`; `render()` re-evaluates `mediaWarming()`, which either re-arms the same cycle (still warming) or lets it die (pill gone, no user interaction needed). Skipped while `exporting`/`glLost`. `lchShowing()` gates the 2D pill — checks `document.getElementById('landingOv')`, NOT the `_lch` module var (which is set once at first launcher init and never nulled back, so `!_lch` alone would permanently suppress the pill after the app's first boot — caught during R220 CDP verification).
- **Invariants / gotchas:** Don't change `drawClip`'s `ntex` branching without mirroring it in `clipTexReady`. The 3D call sites paint the pill FIRST (right after `clearRect`, before grid/labels); the 2D call sites paint it LAST (after all overlay drawing) so it sits on top — same visual outcome, different code shape, intentional per R220 ticket (only the 2D path needed the explicit ordering fix).
- **Status:** ✅
- **Roadmap:** —


---

## 3 · Timeline, herramientas & clips/lanes (detalle)

# Subsystem 30 — Timeline UI, tools, clips & tracks/lanes

Reference map of the timeline layer of `app.js` (~4700 lines) + `index.html`.
Automation-lane rendering (`appendAutoLanes`, `attachClipAuto`, `clipautocv`/`autocv` canvases) is a
separate subsystem — only cross-references appear here.

---

## renderTimeline() — master timeline rebuild
- **Purpose:** Full teardown+rebuild of the timeline DOM: ruler width, adaptive grid background, every lane row, every clip element, the pinned audio module, markers, playhead/snapline sizing. The single entry point every mutation calls after touching clips/lanes.
- **Location:** app.js · `renderTimeline()` (L1876–1993) · DOM: `#tracks`, `#laneHeaders`, `#audioHeadZone`, `#ruler`, `#trackHdr .rulerpad`
- **State owned (reads):** `state.tl.pxPerSec`, `state.tl.audioCollapsed`, `state.tl.tcMode/bpm/sig`, `state.lanes`, `state.clips`, `state.selIds/selId/selLane/selGroupId`, `state.markers`, `state.inlineCurves`; writes `state.tl._w`.
- **Key symbols:** `neededSec()`, `gridSec()`, `laneH(li)`, `lanesTopDown()`, `drawRuler()`, `positionPlayhead()`, `attachClipAuto()`, `appendAutoLanes()` (other subsystem), `redrawAudioWaves()`, `reconcileVinst()`, `migrateArAuto()`.
- **Invariants / gotchas:** Manual binding — nothing auto-renders; every state mutation must call this or `scheduleTimeline()`. Full rebuild costs ~100ms at 300 clips → trim/move drags avoid it via `positionClips()`. Header column (`#trackHdr`) is given a bottom `marginBottom = hsb` so it matches `#tlscroll` height. **[R148 · Rev1] Video and audio lanes are UNIFIED in the same column** (`#tracks`/`#laneHeaders`, audio rows last/at the bottom): no sticky `#audioZone`, no "AUDIO" collapse bar, no VIDEO label in the rulerpad corner — `#audioZone`/`#audioHeadZone` are emptied and hidden each render. Also calls `renderVZoom()` at the end (wrapped in try — the V-zoom DOM may be absent).
- **Status:** ✅
- **Roadmap:** underlies [T2]–[T5], [L1]–[L7]

## scheduleTimeline() — rAF-coalesced re-render / light reposition
- **Purpose:** Throttles renders to one per animation frame. During a trim drag it calls `positionClips()` (moves existing nodes, no rebuild) instead of the full `renderTimeline()`.
- **Location:** app.js · `scheduleTimeline()` (L2470–2472), `positionClips()` (L2467–2469)
- **State owned:** reads `drag`, `state.tl.pxPerSec`
- **Key symbols:** `_tlRaf`, `positionClips()`, `scheduleWaves()`, `scheduleAutoCvs()`
- **Invariants / gotchas:** `positionClips()` only updates `left`/`width` of `.clip[data-clip]`; the full rebuild happens once on pointerup. Returns false if any clip node is stale → falls back to full render.
- **Status:** ✅
- **Roadmap:** —

## Timeline DOM skeleton (index.html)
- **Purpose:** Static markup for the whole timeline region: transport bar, sequence tabs, tool rail, track-header column, scroller with ruler/tracks/playhead/snapline.
- **Location:** index.html · `.transport` (holds `#seqTabs` since R148), `.timeline`; `#toolRail`, `#trackHdr`>`.rulerpad`+`#laneHeaders`+`#audioHeadZone`, `#tlscroll` > `#ruler`(canvas `#rulerCv`, `#clipExtent`, `#phTri`) + `#workArea` + `#timeSel` + `#tracks` + `#playhead` + `#snapline`, `#tlVZoom`>`#tlVZoomTrack`>`#tlVZoomThumb` (R148). CSS: `.tlscroll`, `.trackhdr`, `.tlvzoom`.
- **State owned:** —
- **Key symbols:** `#tracks` (clip rows host), `#trackHdr` scrolls natively in sync with `#tlscroll`.
- **Invariants / gotchas:** **[R148 · Rev1]** `#seqTabs` moved OUT of `.timeline` into `.transport` (design §5: sequences live on the play bar). `#tlVZoom` is a 12px column to the RIGHT of `#tlscroll` inside `.tlmain`. `.trackhdr` width is 168px (was 152 — the automation chips truncated). `.trackhdr .rulerpad` needs `flex-shrink:0` to keep its 22px now that it is empty, otherwise headers/lanes misalign by 9px. `#audioZone`/`#audioHeadZone` survive as empty/hidden nodes only (audio is a normal lane in the unified column).
- **Status:** ✅
- **Roadmap:** —

## Transport bar
- **Purpose:** Playback + edit controls above the timeline: mark in/out, play, go start/end, automation REC, follow-playhead, timecode readout, TC/Frames toggle, loop, add locator, automation (curves) toggle, Fit, zoom in/out.
- **Location:** index.html `.transport`. Handlers: `#tlZoomIn/#tlZoomOut`, `#addMk`, `#tlGridBtn`, `#fitAllBtn`→`fitAll()`.
- **State owned:** `state.tl.pxPerSec`, `state.tl.gridOn`, `state.loop`
- **Key symbols:** `#seqTabs` (sequences, LEFT zone since R148), `#markIn/#markOut`, `#playBtn`, `#followBtn`, `#tc/#bbt`, `#tcModeSeg`, `#loopBtn`; edit well `#tlEditSeg` = `#curvesBtn` (Auto, key A) · `#tlGridBtn` (Grid) · `#fitAllBtn` (Fit). **[R155]** `#simpleClipBtn` archived (Ableton grab mode gone). **[R158]** `#snapBtn` archived (grid snap gone). **[R159]** `#prevMk`/`#nextMk` gone — the design has one "Add locator"; `,` / `.` already navigate.
- **Invariants / gotchas:** Zoom buttons clamp `pxPerSec` to [TL_PPS_MIN, TL_PPS_MAX]. `#curvesBtn` toggles `state.inlineCurves` (automation subsystem). **[R148 · Rev1]** design §5 layout = 3 zones: sequences (left) · transport (centre) · Simple/Auto/Grid/Fit + zoom (right). `state.tl.gridOn===false` hides the timeline grid lines (default = on, so old projects are unchanged); `fitAll()` fits the whole duration to the visible WIDTH only — track height is the V-zoom's job (the tooltip used to promise "H·W"; fixed R149). **[R149 · auditoría]** the bar is 28px on `--bar` (#242424 — the ONLY bar with that surface); `#tlEditSeg`, `.zoomgrp` and `#snapBtn` are all 22px wells with 16px buttons.
- **Status:** ✅
- **Roadmap:** [U1] (minimalist labels: Snap→"S" etc.), [U6] frames button removal

## Tools & tool rail (select/trackselect/hand/trim/razor/zoom)
- **Purpose:** Six timeline tools selectable in `#toolRail`; the active tool changes the `#tracks` pointerdown behaviour and cursor.
- **Location:** index.html `#toolRail` buttons (L817–824). Wiring: `$('#toolRail')…onclick=setTool` (L5650), `setTool()` (L5651), `applyToolCursor()` (L2583–2584). Keys: V/H (L5723), T toggles trim (L5732), B & C razor / Z zoom (L5733–5734).
- **State owned:** `state.tl.tool` (default `'select'`, L80)
- **Key symbols:** tools = `select`, `trackselect`, `hand`, `trim`, `razor`, `zoom`. `RAZOR_CUR` (L2582, teal SVG cursor). Cursor map in `applyToolCursor` — `{select:'default',trackselect:'e-resize',hand:'grab',razor:RAZOR_CUR,zoom:'zoom-in',trim:'col-resize'}`.
- **Invariants / gotchas:** `trackselect` = Premiere "Track Select Forward" (clip + everything right; Shift = all lanes). `trim` = contextual (Resolve model): the zone under cursor picks the sub-trim, no separate tool per trim. `applyToolCursor` also overrides each `.clip` cursor (simple-clip mode → `grab`).
- **Status:** ✅
- **Roadmap:** [U7] (review which tools go left)

## #tracks pointerdown — selection / move / trim / razor / zoom dispatch
- **Purpose:** The central hit-test. On pointerdown over `#tracks` it branches by `state.tl.tool` and by which part of the clip was hit (title `.tt`, handles `.l`/`.r`, fade `.fadeh`, body, keyframe `.kfd`), starting the right gesture.
- **Location:** app.js · `$('#tracks').addEventListener('pointerdown', …)` (L2251–2301)
- **State owned:** `drag` (L2250, module-global), `state.selIds/selId/selGroupId`, `state._lastClipClick`
- **Key symbols:** `startPan()` (L2525), `tlZoomAt()` (L2519), `startTimeSelect()` (L2312), `trimZone()`/`applyTrim()`, `razorClip()`, `onTLMove()`/`onTLUp()`, `startFadeDrag()`, `inlineEdit()`, `openSeq()`. Also `#tracks` `keydown` (Enter/Space select, L2305), `pointermove`/`pointerleave` (razor preview, L2332–2333), `dblclick` (open nest, L2334).
- **Invariants / gotchas:** Empty area → zoom (zoom tool) or `startTimeSelect`. Double-click detect is manual (400ms via `state._lastClipClick`) because the move-drag eats the native dblclick. Ableton model: title-only grab; body places playhead — UNLESS `simpleClips` (Premiere: whole clip grabs, range-select only outside clips). `drag` object snapshots `start0/dur0/inP0/lane0` + per-item `kf0/anim0` (deep-cloned). `pushUndo` deferred until a drag actually changes something.
- **Status:** ✅
- **Roadmap:** [T1] context menu fixed; move/trim underlie [T2]

## Clip DOM element (.clip)
- **Purpose:** Per-clip rendered node built inside each lane row: fill/tint, scrim, head thumbnail, fade envelope SVG, loop marks, title band, proxy badge, mute badge, resize handles, fade handles, keyframe strip. **[R224]** the live-motion `↻` badge is ARCHIVED (`_backup/deprecated/20260730-clip-motion-badge.js`) — that information lives in the inspector's Motion section and in the track header's chooser.
- **Location:** app.js · built in `renderTimeline` clip loop (L1906–1934). Innerhtml assembled L1926.
- **State owned:** reads `c.start/dur/lane/disabled/loop/fadeIn/fadeOut/kf/color/name/adjust`, `state.selIds/selId/selGroupId`
- **Key symbols:** classes `.clip .sel .gsel .offline .off .muted .audioclip`; children `.fill`, `.scrim`, `.cthumb`, `.fadeenv` (SVG), `.tt` (title, tinted `clipTint`), `.cpx`/`.cpxbar` (proxy), `.mutebadge` (speaker-mute glyph), `.hd.l`/`.hd.r` (resize handles), `.fadeh.fadeL`/`.fadeh.fadeR` (fade handles), `.kfstrip`>`.kfd` (keyframe diamonds), `.xfade` (crossfade X). Helpers: `clipTint()`, `textOn()`, `hasLiveAnim()`, `loopCycleSec()`.
- **Invariants / gotchas:** `cd.style.width=Math.max(14,c.dur*pps)` — min 14px. Missing/deleted media → `.offline` (red, [M4]). `c.disabled` → `.off` diagonal hatch (not colour-only, colourblind-safe). `lane.mute && !c.disabled` → `.muted` [T5]: opacidad ALTA (`.82`, sin trama → sigue muy visible) + `.mutebadge`; `.off` es el estado fuerte y gana si el clip está deshabilitado. Clip carries its OWN colour; lane colour only tints the header. `.kfstrip` shown live for selected clip (with `data-t` handlers), dimmed passive strip otherwise. Motion-chip drop targets set here (dragover/drop → `addAnimPreset`). **[R224]** in automation mode the ONLY polyline crossing the clip is the parameter's curve: `body.automode` hides `.fadeh` (since R155) **and** `.fadeenv` — the fade envelope was a second line of the same weight and colour (`--ink-2`), read as another curve and not editable (its handles were already gone). The dark corner gradient stays, so the fade is still visible.
- **Status:** ✅
- **Roadmap:** [T2] frame-snap trim

## Track header (.lanehdr) & lane operations
- **Purpose:** The 168px-wide row header for each lane (colour bar, tag/name, collapse chevron, mute/solo, resize grip); hosts drag-to-reorder, rename, context menu, and (in automation mode) the device/param choosers.
- **Location:** app.js · header build in `renderTimeline` (L1941–1969). Ops: `addLane()` (L2024), `removeLane()` (L2036), `duplicateLane()` (L2163), `renameLane()` (L2152), `startLaneDrag()` (L2173), `trackCreateItems()` (L2032), `defLanes()` (L4916).
- **State owned:** `state.lanes[]` (each: `{id,name,tag,kind,surf?,mute?,solo?,collapsed?,h?,_autoP?}`), `state.selLane`. **[R231]** `lane.color` ya NO se usa: el color de pista es fijo por función (ver *Código de color de pistas*); los `.isp` viejos que lo traigan lo llevan ignorado.
- **Key symbols:** classes `.lanehdr .sel .collapsed .aud`; buttons `[data-m=collapse|mute|solo]`, `.laneres [data-m=resize]`. `laneH(li)`. Constantes **del diseño (R152)**: `LANE_DEF_H=57, LANE_MIN_H=26, LANE_MAX_H=120, LANE_COLLAPSED_H=24`, `AUDIO_LANE_H=LANE_DEF_H` (**[R171]** el audio mide lo MISMO que el vídeo; sigue siendo sólo el valor por defecto), `RULER_H=24`, **[R231] `LANE_COL`/`laneColor(lane)`** (sustituyen al rotativo `TRACK_COLORS`). **[R163]** `AUTO_LANE_MIN_H=52` = suelo en modo automatización para pistas de vídeo (los desplegables de identidad necesitan margen); `laneFloorH(l)` es la fuente única y la usan `laneH`, `wheelResizeLanes` y el arrastre de la barra vertical. Por debajo del suelo la pista NO se queda a medias: `collapsed=true`. `lanesTopDown()` display order.
- **Invariants / gotchas:** Selecting a track deselects the clip (mutual exclusion, [R93]) **y también el locator ([R223], ver *Markers / locators*)** — **pero [R224] `hd.onclick` y `hd.ondblclick` ignoran `.autoctl`**: elegir qué curva se ve es navegación DENTRO de la pista, no seleccionarla. El `stopPropagation` de los chips era sólo del `pointerdown`; el `click` posterior llegaba a la cabecera y `state.selId=null` se llevaba por delante justo el clip cuyos parámetros se querían enfocar. **[R223] `trackCreateItems(kind)` ignora el `kind`**: cualquier cabecera —vídeo o audio— ofrece **New video track** Y **New audio track** (revierte el filtro por tipo de [R110b], que en una pista de audio escondía la opción de crear vídeo). **[R223] Tinte de las pistas de audio:** `.lanehdr.aud` **y** `.lane.aud` (la clase ya existía en la cabecera; faltaba en la FILA) pintan `var(--audio-tint)` = `rgba(150,175,130,0.045)`, un verdoso apenas perceptible. Se aplica con `background-color` y las variantes hover / `:nth-child(even)` se superponen con `background-image:linear-gradient(...)` para no pisarlo. **[R152] AUDIO Y VÍDEO SE COMPORTAN IGUAL** — misma lista ordenable (el prototipo trae `trackOrder:['v4','v3','v2','v1','a1']`), mismo grip de resize, mismo colapso. `lanesTopDown()` ya **no** particiona por tipo y `startLaneDrag` ya **no** clampea el drop al grupo: una pista de audio se puede soltar entre las de vídeo. Si hace falta volver a separarlas, hay que restaurar TAMBIÉN el módulo sticky (ver `_backup/deprecated/20260725-audio-section-model.js`) — sin él la partición sólo impide reordenar. `laneH` chequea `collapsed` ANTES que el tipo. Resize mutará `lane.h` y llama a `scheduleTimeline()` (no debe mover la vista — [L1]). `removeLane` mantiene ≥1 de vídeo y ≥1 de audio. Cabecera 168px.
- **Status:** ✅
- **Roadmap:** [L1] resize-view glitch, [U1] VIDEO/AUDIO same grey-bar style

## Código de color de pistas — LANE_COL / laneColor() [R231]
- **Purpose:** El color de una PISTA lo manda su función, no una elección del momento: **gris = vídeo · verde = audio · rojo = piso**. Se retiró «Set track color…» del menú contextual de la cabecera (el color por CLIP sigue siendo libre). Con colores fijos, la lectura del timeline es la misma en cualquier proyecto.
- **Location:** app.js · `LANE_COL`/`laneColor(lane)` (~L77) · `.bar` de la cabecera en `renderTimeline` · menú contextual `hd.oncontextmenu`. CSS: `--audio-tint`/`--floor-tint` y `.lanehdr.aud`/`.lanehdr.floor`/`.lanehdr .tag.floor` (index.html).
- **State/data:** ninguno nuevo. `lane.color` queda huérfano a propósito (no se lee ni se escribe); `openLaneColorPopup` eliminado, `openClipColorPopup` intacto.
- **Key symbols:** `laneColor(lane)` = `surf==='floor' ? rojo : (kind==='audio' ? verde : gris)`. `--floor-tint` pasó de azulado a `rgba(200,100,85,0.07)` y `.tag.floor` (los tags F1/F2 de R230c) de azul a rojo, para que el marco del tag y el color de la pista digan lo mismo.
- **Invariants / gotchas:** El orden de la condición importa — una pista de piso es `kind:'video'`, así que `surf` se mira ANTES que `kind`. Verificado por CDP: `#B4BAC1` / `#8FBF7A` / `#D8624F` y el menú contextual ya sin entrada de color.
- **Status:** ✅
- **Roadmap:** —

## Lane reorder — startLaneDrag()
- **Purpose:** Drag a track header vertically to reorder lanes; remaps every clip's `lane` index and `state.selLane`, handling the top-down display reversal.
- **Location:** app.js · `startLaneDrag()` (L2173–2195), guard flag `_laneJustDragged` (L2172)
- **State owned:** `state.lanes`, remaps `state.clips[].lane`, `state.selLane`
- **Key symbols:** `lanesTopDown()`, drop indicator chip, `oldToNew` remap map.
- **Invariants / gotchas:** `hd.onclick` bails if `_laneJustDragged` (drag must not also fire a select). Bound in header pointerdown (L1951), skipped when the target is a `[data-m]` control or contenteditable.
- **Status:** ✅
- **Roadmap:** —

## 🗑️ Pinned audio module (#audioZone / #audioHeadZone) — RETIRADO R148
> **[R148 · Rev1] No longer in use.** The design has ONE unified track column: audio lanes render inline in `#tracks`/`#laneHeaders` like any other lane (last, at the bottom), resizable and collapsible. `renderTimeline` empties and hides `#audioZone`/`#audioHeadZone` every pass; the "AUDIO" collapse bar is gone. `state.tl.audioCollapsed` / the wheel-scroll sync below are dormant. Kept documented because the DOM nodes and the wheel handlers still exist.

- **Purpose (legacy):** Premiere-style bottom-pinned audio band: audio lane rows live in a sticky `.audiozone` at the bottom of `#tracks`; the AUDIO bar tops it and toggles collapse of the whole module.
- **Location:** app.js · audio-zone assembly in `renderTimeline` (L1892–1904, 1971–1976). Scroll sync: `audioZoneScrollBy()` (L2566), wheel handlers (L2567–2575).
- **State owned:** `state.tl.audioCollapsed`, `state.tl._audioScroll`
- **Key symbols:** `.audiozone`, `.audiozone.hdr` (`#audioHeadZone`), `.trackdivider.collapsible` (AUDIO bar), `.audiozone.covers` (top shadow when video hidden behind).
- **Invariants / gotchas:** Module is auto-height (exactly as tall as its tracks; no drag-resize, no internal scroll — [R110]). Appended LAST inside `#tracks` after all video rows so it pins. Wheel over audio never moves the video area; Alt-wheel resizes only that section's tracks (`wheelResizeLanes`). Move ghosts for audio clips must be appended to the audiozone (its own offsetParent) — L2420.
- **Status:** 🗑️ retirado (R148) — nodos y handlers presentes pero inertes
- **Roadmap:** [L2] cerrado por el rediseño (la columna unificada elimina el problema)

## V-zoom lateral (#tlVZoom) — renderVZoom
- **Purpose:** 12px column to the right of the clip area (design §6). Dragging the thumb scales the height of ALL lanes at once; the thumb size/position reflect the current average track height.
- **Location:** app.js · `renderVZoom()` (~L5809), called at the end of `renderTimeline` (wrapped in try). DOM `#tlVZoom`>`#tlVZoomTrack`>`#tlVZoomThumb` (index.html, inside `.tlmain`). CSS `.tlvzoom`/`.tlvztrack`/`.tlvzthumb`.
- **State/data:** writes `lane.h` on every lane (clamped to [`laneFloorH(l)`, LANE_MAX_H]; below the floor it sets `collapsed` instead — [R163], same rule as Alt+scroll).
- **[R178]** Arranca DEBAJO de la regla (`top:29px` = 5 del asa + 24 de `RULER_H`) y con `z-index:1`: la franja del tiempo y el cabezal son suyos, no de la barra. Y los puntos AGRANDAN además de achicar — `startVCapDrag` excluía las pistas plegadas (`if(l.collapsed)return`), así que una vez plegadas el gesto contrario no las recuperaba.
- **[R177]** La barra ya llega hasta el BORDE INFERIOR del panel: vivía dentro de `.tlmain` y moría 12px antes, justo la fila de la barra horizontal. Ahora es `position:absolute` respecto a `.timeline` (`top:5px` = el asa de redimensionado, `bottom:0`), `.tlmain` reserva su ancho con `padding-right` y la horizontal se aparta con `margin-right:12px`.
- **[R176]** La barra vertical ya tiene sus DOS PUNTOS (`.tlvzcap` t/b): existían en CSS y `startVCapDrag` estaba escrito y enganchado, pero los elementos nunca se habían añadido al DOM — la barra no era el espejo de la horizontal. Arrastrar un punto escala TODAS las pistas anclando el borde opuesto.
- **Invariants / gotchas:** it is a SCALE, not a per-lane resize — **[R156]** the per-lane grip is gone; Alt+scroll and this bar are the only two ways to resize, and both move ALL lanes at once. Collapsed lanes keep `LANE_COLLAPSED_H` (`laneH` checks `collapsed` first) and only come back up (`wheelResizeLanes` refuses to un-collapse on a downward wheel — [R163]).
- **Status:** ✅
- **Roadmap:** Rev1 §6

## Move gesture — onTLMove / onTLUp / ghosts
- **Purpose:** Ableton-style clip move: original stays put, a translucent ghost shows the destination, applied on pointerup. Supports multi-select (relative lane shift), lane retargeting (single), Alt-drag copy, and edge-snapping on both clip edges.
- **Location:** app.js · `onTLMove()` (L2427–2456), `onTLUp()` (L2473–2483), `showMoveGhosts()` (L2416), `clearMoveGhosts()` (L2415), `duplicateClipAt()` (L2424).
- **[R231] Compatibilidad de pista destino:** `wantKind` (rama simple) y `kind` (rama múltiple) salen de **`isAudioClip(clip) || media.kind==='audio'`**. Antes leían SÓLO `media.kind`, y el audio de un vídeo **comparte medio con su pareja de imagen** (`kind:'video'`): se le dejaba caer en pistas de vídeo y se le impedía moverse entre pistas de audio — exactamente al revés de lo que debía. La pista donde vive el clip es la que manda.
- **State owned:** `drag` (fields `_applied/_lane/_laneDelta/_copy/items/primaryIds`), `state.selIds/selId`
- **Key symbols:** `applySnap()`, `showSnap()`, `mediaById`, `seqDur`, `sepAuto`, `rebuildMaskTex`, `cutOverlapsOnDrop()` **[R223]**.
- **Invariants / gotchas:** Single move picks the lane under cursor (same kind only); multi move applies a RELATIVE `_laneDelta` only if every destination lane exists and kind-matches. End edge snaps too — whichever edge is nearer wins. Undo recorded only if something actually changed. Alt = copy (Premiere); Ctrl is free. **[R223]** "single vs multi" se mide con `drag.primaryIds.size` (la selección real), no con `items.length` — `items` también trae al partner A/V enlazado, marcado `linked:true`, que se mueve en horizontal pero NUNCA cambia de pista (ni su ghost). Al soltar, `cutOverlapsOnDrop(ids)` recorta lo que se haya pisado: solape = corte, nunca fundido automático.
- **Status:** ✅
- **Roadmap:** —

## Solape = corte no destructivo — cutOverlapsOnDrop() **[R223]**
- **Purpose:** estilo Ableton/Premiere-overwrite: al soltar (mover, copiar, redimensionar o soltar desde el bin) un clip que pisa a otro **en la misma pista**, el clip QUIETO se recorta por el borde invadido — **no hay fundido automático** (el crossfade pasó a ser el gesto explícito del handle de fade, ver *Fades*). El recorte es **no destructivo**: sólo cambia `start/dur/inP`, así que mover el intruso y re-arrastrar el borde recupera el material.
- **Location:** app.js · `cutOverlapsOnDrop()` · helpers `_cutEdgeTo()` / `_dropClip()` / `CUT_MIN`. Llamadas: `onTLUp()` (move, copia y `trimL/trimR`) y el `up` de `startMediaDrag` (soltar desde el bin).
- **State owned:** `state.clips` (recorta, PARTE y elimina clips), `state.selId/selIds` (limpia los ids eliminados).
- **Key symbols:** cuatro casos según cómo se solapan — tapa completa → `_dropClip` (el viejo desaparece) · entra por la izquierda → `_cutEdgeTo(oc,'L',mcEnd)` · por la derecha → `_cutEdgeTo(oc,'R',mcStart)` · **cae dentro** → `razorCore(oc,mcStart)` + recorte izquierdo del resto = **dos restos**, como el overwrite de Premiere. `flashStatus` avisa y menciona el gesto del crossfade.
- **Invariants / gotchas:** `movedIds` = lo que acaba de moverse/crecer; esos clips **no se cortan entre sí**, sólo cortan a los quietos. `_cutEdgeTo` delega en **`trimItem`** a propósito: así hereda gratis los límites de origen y el rebase de keyframes con keyframe de frontera (recortar a mano `start/inP` descolgaba la automatización del material). Un resto menor que `CUT_MIN` (50 ms) se elimina en vez de dejar un muñón de dos frames que además seguiría solapando. El resto derecho de un split nace **suelto** (`delete link/avRole`): tres clips con el mismo `link` harían que `linkPartner` eligiera al azar. `_dropClip` también limpia el `link` del superviviente. **Nunca se llama desde `startFadeDrag`** — ahí el solape es intencionado.
- **Status:** ✅
- **Ticket:** [R223] Etapa 1

## Contextual trim — trimZone / applyTrim (ripple/roll/slip/slide)
- **Purpose:** One trim tool (T); the cursor's zone inside the clip selects the trim kind: free edge = ripple, edge touching a neighbour = roll, title band = slide, body = slip. Source limits honoured exactly.
- **Location:** app.js · `trimZone()` (L2369–2373), `applyTrim()` (L2376–2403), `laneNeighbours()` (L2366), `clipSrc()` (L2364), `TRIM_LABEL` (L2374), `trimNudge()` keyboard (L2405–2413). Invoked from `#tracks` pointerdown trim branch (L2271–2284).
- **State owned:** mutates `c.start/dur/inP` + neighbour clips; `base` snapshot frozen at pointerdown.
- **Key symbols:** zones `roll|rippleL|rippleR|slip|slide`; `EDGE=12`px. Keyboard: Trim tool + ←/→ nudges the edge nearest playhead (Shift=10f, L5756).
- **Invariants / gotchas:** [T2] the contextual-trim drag frame-snaps `dt` by default (`dt=round(dt·fps)/fps`) → the edge steps whole frames (visible once zoomed in; deep zoom now reaches `TL_PPS_MAX`=2400 and the adaptive grid draws frame lines there). **Shift** = sub-frame fine (`dt·=0.25`, no snap). Readout shows seconds + frames. Snap is on the DELTA, so a frame-aligned base stays aligned; source-limit clamps may still land off-grid at the extreme. Handles/resize the `.hd.l`/`.hd.r` handles feed the SEPARATE plain trim path (`drag.mode='trimL'/'trimR'` via `trimItem`, L2458) — distinct from the contextual trim tool (that path is NOT frame-snapped). `inP` is SOURCE seconds (× speed) — trim shifts consume source proportionally. Keyframes rebased on trim-in with a boundary keyframe so ramps aren't discarded ([R92-T4 F7]).
- **Status:** ✅
- **Roadmap:** —

## Plain-handle trim — trimItem / drag.mode trimL/trimR
- **Purpose:** The `.hd.l`/`.hd.r` corner handles resize a clip (all selected clips get the same delta), clamped to each clip's own source limits. This is the default resize, independent of the Trim tool.
- **Location:** app.js · `onTLMove` trimL/trimR branches (L2446–2455), `trimItem()` (L2458–2464).
- **State owned:** `drag.items[]` with `start0/dur0/inP0/kf0/anim0`
- **Key symbols:** `srcLim`, `srcDur`, keyframe/anim rebasing on left-trim.
- **Invariants / gotchas:** Loopable clips extend past source. Right-trim clamps `ndP` to `(srcDur-inP0)/speed`. Uses `scheduleTimeline`→`positionClips` for cheap live feedback.
- **Status:** ✅
- **Roadmap:** [T2]

## Fades + crossfade manual — startFadeDrag()
- **Purpose:** dos gestos en el MISMO handle `.fadeh`. **(a) Fundido:** arrastrarlo hacia DENTRO fija `fadeIn`/`fadeOut` (a todos los clips seleccionados); se dibuja como la envolvente real de opacidad (`.fadeenv` SVG). **(b) [R223] Crossfade manual estilo Ableton:** con UN solo clip seleccionado, arrastrarlo hacia FUERA, sobre el corte con el vecino de la misma pista, hace crecer el clip hacia él y crea el fundido cruzado — reajustable (volver a arrastrar) y eliminable (arrastrar de vuelta al punto de contacto). Es la ÚNICA forma de tener un crossfade: el solape crudo ahora se corta (ver *Solape = corte*).
- **Location:** app.js · `startFadeDrag()` · `crossfadeNeighbor(cc,which)`. Pintado del fade en `renderTimeline`; handles `.fadeh.fadeL/.fadeR`; chapa `.xfade` (X estilo Ableton) sobre el solape.
- **State owned:** `c.fadeIn`, `c.fadeOut` y, en el camino de crossfade, `c.start/dur/inP/kf/anim` del clip y los fundidos del vecino + del partner A/V enlazado.
- **Key symbols:** `xf` = estado congelado del gesto (`touchEdge`, `extPrev`, `plainDur`, `inPTouch`, `maxExt`, `f0eff`, `kfBase`, `ppBase`, **[R320] `ppAuto`** —la automatización del partner congelada al empezar el gesto). `rebaseKf` (rebase de keyframes al crecer por la izquierda) · `mirrorLink` → `_mirrorLinkTrim` **con instantánea desde R320**: era el séptimo llamador y el único que rebasaba el clip agarrado y no su mitad enlazada. `refreshInspector()` + `reschedAudio()` + `markDirty()` al soltar.
- **Invariants / gotchas:** **Vídeo vs audio:** en vídeo el dissolve lo da el SOLAPE GEOMÉTRICO (`compositeClips` ya lo hacía y se reutiliza tal cual) → `fadeIn/fadeOut` se quedan en **0**; en audio no existe ese mecanismo, así que ahí SÍ se usan los fundidos, espejados con el vecino → ganancia cruzada equal-gain (suma 1 en todo el cruce). Un clip de vídeo con audio enlazado hace las dos cosas: geometría en la imagen y ganancia cruzada en su mitad de audio. **Todo se mide contra el estado de CONTACTO**, no contra el actual: `inPTouch = inP + extPrev·speed` (crecer por la izquierda GASTA `inP`, volver lo DEVUELVE — con el signo al revés reajustar un crossfade perdía material hasta dejar `inP=0`, es decir mostrando otro trozo de la fuente) y `room` se mide desde ahí, de modo que a `maxExt` **no** se le suma `extPrev`. **`crossfadeNeighbor` exige que el candidato esté REALMENTE a ese lado** (empezar después de `cc.start` para el `fadeOut`, antes para el `fadeIn`): sin esa guarda un `gap` muy negativo hacía ganar a un clip del otro lado y el arrastre estiraba el clip diez segundos. Límites del crossfade: material propio disponible **y** el largo del vecino (`nb.dur-0.05`, que además conserva el orden A→B del que depende `compositeClips`). `extPrev>0` → `f0eff=-extPrev` (geométrico), porque en vídeo `fadeOut` no refleja el solape y sin esto el handle saltaba al reagarrarlo. Multi-selección (>1 clip) mantiene el gesto clásico, sin vecino. `stopPropagation` evita que arranque un move.
- **Status:** ✅
- **Ticket:** [R223] Etapa 1

## Razor & split
- **Purpose:** Razor tool cuts a clip wherever clicked (snapped); live cut-line preview follows the mouse. Ctrl+E splits every clip crossing the time-selection/playhead. Keyframes/beziers subdivided at the cut for value continuity.
- **Location:** app.js · `razorCore()` (L2491–2509), `razorClip()` (L2510), `splitAtSelection()` (L2512–2518). Razor branch in pointerdown (L2286); preview in pointermove (L2332).
- **State owned:** `state.clips` (pushes a second half `c2`)
- **Key symbols:** de Casteljau bezier subdivision, `reb()` keyframe rebase, `sepAuto`, `rebuildMaskTex`, `evalP`.
- **Invariants / gotchas:** No-op within 0.02s of either edge. Handle objects deep-copied so the two halves never share `hIn/hOut`. Left half keeps fadeIn only, right half fadeOut only.
- **Status:** ✅
- **Roadmap:** —

## Time selection & marquee
- **Purpose:** Drag over empty area (or clip body in Ableton mode) to select a time span across the tracks you drag over (Ableton-style); marquee rectangle selects clips it touches. Feeds Loop (Ctrl+L) and Split.
- **Location:** app.js · `startTimeSelect()` (L2312–2319), `renderTimeSel()` (L2320–2323), `lanesBetweenY()` (L2310), `startMarquee()` (L2527–2533), `loopSelection()` (L2325–2330).
- **State owned:** `state.tl.selA/selB/selLanes`
- **Key symbols:** `#timeSel` element (`.insert` when zero-width), `#workArea` loop brace, `renderWork()`.
- **Invariants / gotchas:** Pure click = thin insert marker (does NOT move the playhead); play() starts from selA. Selection binds to only the lanes the drag spans vertically.
- **Status:** ✅
- **Roadmap:** —

## Snap — applySnap / snapTargets / grid
- **Purpose:** Snapping of clip edges, playhead and markers to other clip edges / playhead / markers. Always on, like Premiere — **[R158]** there is no grid snap and no Snap button any more. Alt bypasses at call sites.
- **Location:** app.js · `applySnap()`, `snapTargets()`, `showSnap()`, `gridStepSec()` (ex-`snapGrid`: it is the timeline grid STEP, not a snap), `gridSec()`/`gridBaseAdaptive()`/`gridLabel()`. Grid controls `gridNarrow/gridWiden/gridToggleFixed`.
- **State owned:** `state.tl.gridDiv/gridFixed/gridFixedBase` (grid drawing only; `state.tl.snap` retired in R158)
- **Key symbols:** snap tolerance `9/pxPerSec` px; `#snapline` (`.free` variant). Adaptive grid steps array (frame-aware).
- **Invariants / gotchas:** Edge/playhead/marker snap is ALWAYS on ([R80b], [R158]) and ungated. Tolerance stays `9/pxPerSec`. `gridStepSec()` only feeds the ruler/grid drawing — never `applySnap`.
- **Status:** ✅
- **Roadmap:** [T2] micro-snap-to-frame at extreme zoom

## Zoom — tlZoomAt / zoomToClip
- **Purpose:** Zoom the timeline keeping the time under the cursor fixed; wheel-Ctrl and the ± buttons drive it. `zoomToClip` fits a clip to the visible width ([T1] "Zoom to clip").
- **Location:** app.js · `tlZoomAt()` (L2519–2523), `zoomToClip()` (L2217), button handlers (L5647–5648), wheel handler (L2567–2571).
- **State owned:** `state.tl.pxPerSec` (default 80, L80), `state.tl._scrollTarget`
- **Key symbols:** `neededSec()` (L2577) grows content width to cover the scroll target during the render.
- **Invariants / gotchas:** `pxPerSec` clamped `[TL_PPS_MIN, TL_PPS_MAX]` = `[0.1, 2400]` (const at L112; 0.1 floor fits feature-length clips, 2400 ceiling gives ~40–80px/frame for the [T2] per-frame trim snap). All 4 zoom entry points (buttons, wheel-Ctrl, ± keys, `zoomToClip`) use the consts. `_scrollTarget` is published BEFORE render so width grows first, then `scrollLeft` is applied unclamped — keeps the cursor time fixed.
- **Status:** ✅
- **Roadmap:** —
- **[T3] Zoom-scrollbar (`#tlZoomBar`):** custom Premiere-style bar replacing the native h-scrollbar (`.tlscroll` is `overflow-x:hidden`). `renderZoomBar()` aligns the track under `#tlscroll` (live rects) and sizes the thumb = `clientWidth/scrollWidth`; `startZoomBarDrag` (thumb body) scrolls via `scrollLeft`; `startZoomCapDrag(e,side)` (circular end-caps `.tlzcap`) zooms, keeping the OPPOSITE edge's time fixed (recomputes `pxPerSec=clientWidth/winDur`, clamped to `TL_PPS_MIN/MAX`, then the `_scrollTarget` grow-then-scroll trick). Repainted from the `#tlscroll` scroll handler + end of `renderTimeline`. Native h-scroll gone → `hsb`=0 so the header `marginBottom` compensation is now a no-op.

## Simple-clip mode
- **Purpose:** Toggle between Premiere-style whole-clip grab (default) and Ableton-style title-band-only grab (body drags a range).
- **Location:** app.js · `toggleSimpleClips()` (L2350), `syncSimpleUI()` (L2352). Gate in pointerdown (L2290). Persisted in `serProject` (L5230), restored (L5314).
- **State owned:** `state.tl.simpleClips` (default true, L80)
- **Key symbols:** `#simpleClipBtn`, `body.simpleclips` CSS class, `applyToolCursor`.
- **Invariants / gotchas:** View-only state — persisted with the project, no undo entry. Pre-flag projects open in Simple.
- **Status:** ✅
- **Roadmap:** —

## Ruler, playhead & scrubbing
- **Purpose:** The sticky ruler (canvas) draws time ticks; pointerdown scrubs the playhead (frame-snapped) or selects/drags a locator; dblclick adds/renames a locator. Playhead + snapline are sized to the tracks height.
- **Location:** app.js · `#ruler` pointerdown (L2535–2547), dblclick (L2558–2561), contextmenu (L5930–5938), `positionPlayhead()` (L2210), `drawRuler()`, `renameLocatorInline()` (L2549–2557).
- **State owned:** `state.playhead`, `state.selMarkerId`
- **Key symbols:** `#ruler`>`#rulerCv`, `#phTri`, `#clipExtent`; `#playhead`, `#snapline`; `frameSnap()`, `scrubRender()`.
- **Invariants / gotchas:** Ruler is `position:sticky` → its rect.left already reflects scroll (don't add scrollLeft). Playhead line spans every track but stops at the ruler; snapline spans ruler+tracks (22px + tracks height).
- **Status:** ✅
- **Roadmap:** —

## Markers / locators
- **Purpose:** Named time markers drawn as dashed lines across tracks + labelled flags on the ruler; add / jump / rename / delete.
- **Location:** app.js · `addMarker()` (L2196), `jumpMarker()` (L2206), marker lines in `renderTimeline` (L1981), inline rename `renameLocatorInline` (L2549), transport buttons (L5646), ruler context menu (L5930).
- **State owned:** `state.markers[]` (`{id,time,name,color}`), `state.selMarkerId`
- **Key symbols:** `#addMk` (single button, as in the design); `,` / `.` jump prev/next locator; dashed line z-index 5. Banderín + etiqueta dibujados por `drawRuler`.
- **Invariants / gotchas:** Markers are a snap target. Add drops straight into inline rename (deferred a tick so the triggering key doesn't type into the field). NOTE: `serProject` currently serializes `markers:[]` at top level (L5230) — active-sequence markers live in the nest media. **[R223] los locators se dibujan en la MITAD INFERIOR de la regla** (banderín en y=14..20, tallo desde y=12 hasta `RULER_H`, etiqueta en y=17): arriba competían con los ticks y las etiquetas de timecode. **[R223] `state.selMarkerId` es una selección EXCLUSIVA** con el clip/pista, porque `renameSelection` (Ctrl+R) da prioridad al locator sobre el clip: seleccionar/crear/renombrar un locator apaga `selId/selIds/selGroupId/selLane`, y **cualquier `pointerdown` en el cuerpo del timeline** (más la cabecera de pista y el Enter/Space sobre un clip) apaga `selMarkerId`. Sin eso, un locator viejo seguía "seleccionado" y Ctrl+R renombraba el locator en vez del clip recién elegido.
- **Status:** ✅
- **Ticket:** [R223] Etapa 1 (posición + bug de Ctrl+R)

## Sequence tabs (#seqTabs) — renderSeqBar
- **Purpose:** Premiere-style tabs for open sequences/nests; click to switch, dblclick rename, right-click options, ✕ to close, ＋ to create, **drag to reorder** ([R3]).
- **Location:** app.js · `renderSeqBar()` (~L9128), `startSeqTabDrag()` (~L9107), `switchSeq()` (~L8577), `renameSequence()` (~L8585). DOM `#seqTabs` — **[R148 · Rev1] moved into `.transport`** (left zone of the play bar, design §5); styled as a compact well by `.transport .seqtabs/.seqtab` (max-width 36%, horizontal scroll, no scrollbar).
- **State owned:** `state.openSeqs[]`, `state.activeSeqId`
- **Key symbols:** `.seqtab .on`, `.seqlab`, `.seqx`, `.seqadd`; `newSequenceDialog`, `closeSeqTab`, `openSeqSettings`, `startSeqTabDrag`, flag `_seqDragged`, **[R239]** flag `bar._seqWheel`.
- **Invariants / gotchas:** Sequences = media `kind:'nest'`; switching saves the active seq (`saveActiveSeq`) then loads the target into `state.clips/lanes`. [R3] `startSeqTabDrag` (pointerdown, 5px threshold, horizontal analog of `startLaneDrag`) reorders `openSeqs`; a real drag sets `_seqDragged` so the trailing click doesn't ALSO `switchSeq`. Order persists (serialized in `serProject`). **[R239] `scrollbar-width` (estándar) DESACTIVA los pseudo-elementos `::-webkit-scrollbar` en Chromium moderno**, así que el `height:0` del well no servía mientras `.seqtabs` heredase `scrollbar-width:thin`: medido, la barra se comía **12 de los 22 px** de alto. Ahora `scrollbar-width:none` y el desplazamiento va con la **rueda** (listener enganchado UNA vez vía `bar._seqWheel`, no en cada `renderSeqBar`; sólo hace `preventDefault` si hay desbordamiento, para no secuestrar la rueda de una barra que cabe entera). **[R239b] `renderSeqBar` empieza por `innerHTML=''`, que devuelve `scrollLeft` a 0**: sin barra visible, la pestaña activa podía quedar fuera de la vista sin ninguna pista de que hubiera más. El repintado conserva el desplazamiento (`_sl`) y `seqTabsReveal()` arrastra la activa a la vista. **[R242c] El desvanecido del borde se RETIRÓ por decisión de Beltrán («corte hueso»):** `seqTabsOvf()` y las reglas `.ovf-l`/`.ovf-r` se archivaron (`_backup/deprecated/20260804-seqtabs-overflow-fade.js`). La rueda y `seqTabsReveal` se quedan — son las que evitan el defecto real de R239b (una pestaña inalcanzable); lo que se va es sólo la máscara de degradado.
- **Status:** ✅
- **Roadmap:** —

## Clip context menu ([T1])
- **Purpose:** Right-click a clip → rename, split, zoom-to-clip, duplicate/copy, colour, speed, loop toggles, disable, copy/paste attributes, compose/nest, render-in-place, show automation, delete/ripple-delete.
- **Location:** app.js · `$('#tracks').addEventListener('contextmenu', …)` (L5905–5929). Empty-area/lane variant → `trackCreateItems` (L5906).
- **State owned:** selects the clip under cursor (`state.selId/selIds`)
- **Key symbols:** `openMenu()`, `zoomToClip`, `razorClip`, `duplicateClip`, `nestSelection`, `renderInPlace`, `showAutomation`, `rippleDelete`.
- **Invariants / gotchas:** [T1] BUG was a stray `//` comment swallowing the body — fixed (L5907 note). Menu re-renders the timeline first so the fresh row is measured before `openMenu`. `.trackhdr` context menu is a separate handler (L1959, L2576).
- **Status:** ✅ (was broken; fixed)
- **Roadmap:** [T1] done (menu + "Zoom to clip" added)

## Automation lane hook (cross-reference only)
- **Purpose:** Per-clip automation envelopes and inline automation sub-lanes. Owned by another subsystem.
- **Location:** app.js · `attachClipAuto()` (called L1934), `appendAutoLanes()` (called L1969), `clipautocv`/`autocv` canvases (`scheduleAutoCvs` L3900, `clipautocv` created L3904). Track-header choosers `autoDuo/autoDuoText` (L1966).
- **State owned:** `state.inlineCurves`, `lane._autoP`
- **Key symbols:** `clipautocv`, `windowAutoCv`, `laneAutoP`.
- **Invariants / gotchas:** Only mentioned here; see the automation subsystem doc for detail.
- **Status:** ✅ (external)
- **Roadmap:** [L3][L4][L6][L7], [A1]–[A5]


---

## 4 · Automatización, keyframes & modulación (detalle)

# Subsystem 40 — Automation, keyframes & modulation

Reference map of `app.js`. Line numbers verified against the current file.

---

## Keyframe data model
- **Purpose:** A clip carries `c.kf[param] = [ {t,v,e,hIn,hOut}, … ]`. `t` = clip-local seconds, `v` = value, `e` = easing name (`'linear'|'in'|'out'|'both'|'hold'|'bezier'`), `hIn`/`hOut` = optional freeform bezier handles `{dt,dv}`. Params are inspector keys (from `CURVE_PARAMS`) or reactive-fx keys `'fx:<id>:<param>'`.
- **Location:** app.js · comment header `/* keyframes + easing */` (~L450); `CURVE_PARAMS=TF.concat(TF_FLAT).concat(FX)` (~L3241)
- **State owned:** `c.kf` (per-clip map), `c.props` (static base values)
- **Key symbols:** `CURVE_PARAMS`, param-def tuple `[key,label,unit,min,max]`, `TF`/`TF_FLAT`/`FX`
- **Invariants / gotchas:** Keyframe times are clip-LOCAL (`t-c.start`). A param-def is `[key,label,unit,min,max]`; `paramDef()` resolves both inspector and fx keys. Handles live in (time,value) space, not pixels.
- **Status:** ✅
- **Roadmap:** —

## easeF / bezSegY (easing + bezier eval)
- **Purpose:** `easeF(f,mode)` maps normalised 0..1 fraction through the named easing. `bezSegY(lt,A,B)` evaluates a freeform cubic-bezier segment in (time,value) space using `A.hOut`/`B.hIn` (default thirds when absent), Newton-free bisection (26 iters).
- **Location:** app.js · `easeF` (L451) · `bezSegY` (L454)
- **State owned:** — (pure)
- **Key symbols:** `easeF`, `bezSegY`, handle defaults `seg/3`
- **Invariants / gotchas:** `hold` returns 0 (step). A segment uses bezier if `A.e==='bezier'` OR either handle exists.
- **Status:** ✅
- **Roadmap:** —

## hasKf (undefined gotcha)
- **Purpose:** Truthiness test that a param is automated.
- **Location:** app.js · `hasKf` (L452)
- **State owned:** reads `c.kf`
- **Key symbols:** `hasKf(c,p)` → `c.kf&&c.kf[p]&&c.kf[p].length>0`
- **Invariants / gotchas:** Returns `undefined` (not `false`) when `c.kf` is absent. CLAUDE.md rule: wrap with `!!` before `classList.toggle` (WebIDL inverts on `undefined`).
- **Status:** ✅
- **Roadmap:** —

## evalP (pure keyframe/base evaluator)
- **Purpose:** Resolve a param's value at absolute time `t` from keyframes only (base value if none). The curve editor draws and edits THIS. Interpolates via `bezSegY` or `easeF`; clamps to first/last outside range.
- **Location:** app.js · `evalP` (L462)
- **State owned:** reads `c.kf`, `c.props`, fx base via `fxBaseFor`
- **Key symbols:** `evalP(c,p,t)`, `fxBaseFor` (for `'fx:'` keys)
- **Invariants / gotchas:** [A2/D1] After-Effects model — a keyframed param ALWAYS follows its curve; `_autoOff` is NOT consulted here (comment at L463). No second evaluation engine: `drawAutoCurve` and modulation all reuse `evalP`.
- **Status:** ✅
- **Roadmap:** [A2]/[D1]

## setKf / clearKf
- **Purpose:** `setKf(c,p,t,v,e)` writes/updates a keyframe (merges within a frame-aware tolerance window, else inserts + re-sorts). `clearKf` deletes the whole param curve.
- **Location:** app.js · `setKf` (L469) · `clearKf` (L472)
- **State owned:** mutates `c.kf[p]`
- **Key symbols:** `setKf`, `clearKf`, `tol=Math.min(0.02,0.5/fps)` (half-frame merge)
- **Invariants / gotchas:** Clamps local time to `[0, c.dur]`. Merge tolerance keeps adjacent-frame keys distinct at 60 fps.
- **Status:** ✅
- **Roadmap:** —

## evalR (render-time evaluator)
- **Purpose:** The value the RENDERER sees: `base (evalP) → + procedural motion (animOffset) → modulation stack (evalModStack)`. Keeps `evalP` pure so the stack never fights the editor.
- **Location:** app.js · `evalR` (L521)
- **State owned:** reads `c.anim`, `c.mod`
- **Key symbols:** `evalR(c,p,t)`, `animOffset` (L512), `evalModStack` (L563)
- **Invariants / gotchas:** [L7] the RENDERER must call `evalR` (not raw props) for automation to run in Play. Order is fixed: keyframes → motion → modulation.
- **Status:** ✅
- **Roadmap:** [L7]

## manualEdit (After-Effects write rule)
- **Purpose:** Single funnel for every manual param change (inspector drag/type/wheel, viewport move). If the param is already automated → writes a keyframe at the playhead; otherwise just sets the static `c.props[p]`.
- **Location:** app.js · `manualEdit` (L2727); call sites L2655/2658/2665/2668, L3184/3191/3235
- **State owned:** mutates `c.kf` or `c.props`
- **Key symbols:** `manualEdit(c,p,v)`, `hasKf`, `setKf`, `curEase()`
- **Invariants / gotchas:** [A2/D1] editing a value NEVER breaks automation — it appends a keyframe. This is the single, complete capture point relied on by perform-and-bake (`recWrite`).
- **Status:** ✅
- **Roadmap:** [A2]/[D1]

## Automation mode toggle (#curvesBtn / body.automode)
- **Purpose:** `state.inlineCurves` boolean turns the inline automation sub-lanes on/off; `syncAutoUI` mirrors it to `body.automode` (CSS marks the clip title band as grab zone). `toggleCurves` flips + re-renders.
- **Location:** app.js · `syncAutoUI` (L3254) · `toggleCurves` (L3255) · DOM `#curvesBtn`; restored on load L5315
- **State owned:** `state.inlineCurves`
- **Key symbols:** `syncAutoUI`, `toggleCurves`, `#curvesBtn.on`
- **Invariants / gotchas:** [A1] the legacy "Curves" drawer is gone — automation lives entirely in inline sub-lanes. Every place that sets `state.inlineCurves` must also call `syncAutoUI` + toggle `#curvesBtn`.
- **Status:** ✅
- **Roadmap:** [A1]

## Param key resolvers (fx / fxt)
- **Purpose:** Distinguish inspector params, per-clip reactive-fx keys `'fx:<id>:<param>'`, and TRACK-level fx-type keys `'fxt:<type>:<param>'`. `laneKey(c,p)` resolves a track fxt-key to that clip's own `fx:` instance (or null). `paramDef` returns the def for any of them.
- **Location:** app.js · `isFxKey` (L3269), `fxBaseFor` (L3270), `paramBase`/`setParamBase` (L3271/3272), `isFxtKey` (L3273), `laneKey` (L3274), `fxParamDefOf` (L3275), `paramDef` (L3276)
- **State owned:** reads `c.fx`, `FXBY`, `CURVE_PARAMS`
- **Key symbols:** `isFxKey`, `isFxtKey`, `isMotKey`, `laneKey`, `paramDef`, `fxBaseFor`, `setParamBase`
- **Invariants / gotchas:** [R93] fxt-lanes name an EFFECT TYPE; each clip resolves independently — `laneKey` returns null for a clip lacking that effect (draws/edits nothing). `paramDef` works with a null clip for fxt-keys (empty-track headers). **[R224]** a third namespace joins them: `'mot:<animParam>:mix'` (a Motion's Mix). It is the same key at track and clip level — the identity is the motion's `param`, not an instance id — so `laneKey` only has to check that the clip owns such a motion; `paramDef` answers with `[key,'Motion · <param> · Mix','%',0,100]` and needs no clip either.
- **Status:** ✅
- **Roadmap:** —

## Track-level automation lane (lane._autoP / laneAutoP / openAuto)
- **Purpose:** [R93/A5] one automation overlay per track. `lane._autoP` = the track's primary param (the two header dropdowns pick it). `laneAutoP` resolves the effective param (saved choice, else first animated, else `'opacity'`). `openAuto(c,p)` arms a param on its track — **[R228] es ya un wrapper de `revealAutomation(c,p,{fallback:true})`** (ver *Inspector→curve sync*). `showAutomation(c)` reveals the clip's animated params as the single overlay.
- **Location:** app.js · `openAuto` (L3283), `closeAuto` (L3284), `laneFxTypes`/`laneFxKeys` (L3286/3287), `laneHasKf` (L3288), `laneAutoP` (L3290), `addAutoLaneAt`/`addAutoLane` (L3294/3300), `showAutomation` (L3578)
- **State owned:** `lane._autoP`, `lane._auto` (extra sub-lane param list)
- **Key symbols:** `laneAutoP`, `openAuto`, `showAutomation`, `clipArmedTrackKeys`
- **Invariants / gotchas:** [A5] one automation at a time — `showAutomation` sets a SINGLE overlay. fxt choice dropped if its effect type leaves the track; **[R224]** same rule for `mot:` keys when the motion leaves. **[R224] WHO DECIDES THE VISIBLE CURVE — one answer:** `lane._autoP` (a TRACK key, serialized in the `.isp`), resolved by `laneAutoP` (saved choice → first automated param → `'opacity'`) and translated to each clip by `laneKey`. Exactly three things write it: the two header chips (`autoDuoText`'s `onPick`), `focusAutoParam` (any inspector gesture, only while the mode is on) and `showAutomationParam`/`showAutomation`/`openAuto`/`fxKfToggle` (which also turn the mode on). Nothing else may set it, or the chips and the drawn curve can disagree.
- **Status:** ✅
- **Roadmap:** [L3], [L4]

## Device+param choosers (autoCats / autoDuoText)
- **Purpose:** The two chips in the track header that pick which curve the track shows. **[R224]** LEFT = three fixed CATEGORIES (Transform · Clip · Color) + one DEVICE per Motion and per Effect **applied**; RIGHT = that entry's exact parameter list. Both menus come from `autoCats(li)`.
- **Location:** app.js · `XFORM_P`, `CLIP_P`, `COLOR_P`, `autoDevClip`, `autoDevFxTypes`, `autoDevMotParams`, `autoHasKf`, `autoCats`, `autoCatKeyOf`, `autoParamLabel`, `autoDuoText`, `fxParamLabel`
- **State owned:** writes back via `onPick` → `lane._autoP`
- **Key symbols:** `autoCats` (`{k,label,params:[[value,label,TRACK KEY]]}`), `autoCatKeyOf` (visible key → category, so the two chips can never disagree), `autoHasKf` (◆ = automated **on this clip**, or on the track when no clip of it is selected)
- **Invariants / gotchas:** Devices come from the SELECTED clip when it sits on this lane (that's what the inspector is showing), else from the union of the lane's clips — an empty/unselected header stays navigable. Transform lists only the ACTIVE sequence mode's params (2D no longer offers azimuth) **plus** any param of the other mode that carries automation, so no curve is unreachable. Effect params = Intensity + **Reactivity** + the effect's declared params (Reactivity stays: it is automatable, and dropping it from the menu would orphan its curve). Picking a device lands on its **already-automated** param when there is one. `autoDuo` (the `<select>` variant) is ARCHIVED (R224). Chips `stopPropagation` on `pointerdown`, and `renderTimeline`'s `hd.onclick`/`hd.ondblclick` skip `.autoctl` — the later `click` used to reach the header and wipe `state.selId`.
- **Status:** ✅
- **Roadmap:** —

## Inspector→curve sync (focusAutoParam / showAutomationParam)
- **Purpose:** **[R224 · ítems 4-5]** With automation mode on, touching ANY inspector parameter puts ITS curve on the clip and the header chips follow. `focusAutoParam(c,p)` is the cheap focus change (no automation written, no keyframe required, no-op when the mode is off); `showAutomationParam(c,p)` is the explicit menu version — it turns the mode ON and then focuses. `trackKeyFor(c,p)` translates the inspector's per-clip key (`fx:<id>:<p>`) into the TRACK key the chooser stores (`fxt:<type>:<p>`); plain params and `mot:<param>:mix` are the same at both levels.
- **[R228] `revealAutomation(c,p,opts)` = EL GESTO COMPARTIDO** «mostrar en su pista la automatización de este parámetro»: enciende `state.inlineCurves`, arma `lane._autoP` (normalizado con `trackKeyFor`), sincroniza `syncAutoUI()` + `#curvesBtn.on` y repinta. Devuelve la clave de pista aplicada o `null`. Opciones: `fallback` (una clave `fx:` cuyo efecto ya no está en el clip se arma tal cual — lo que hacía `openAuto`), `dirty` (marca el proyecto sucio; `_autoP` se guarda en el `.isp`), `lazy` (no repinta si nada cambió — para llamadores que corren en cada fotograma). Lo usan `openAuto(c,p)` = `{fallback:true}` sin dirty, `showAutomationParam(c,p)` = `{dirty:true}` + su `flashStatus`, y el **acto del paso «Automation» del recorrido guiado** = `{lazy:true}` sin dirty. Estaba copiado tres veces, con la normalización `fx:`→`fxt:` escrita a mano en dos.
- **Location:** app.js · `trackKeyFor`, **`revealAutomation`** (~L5704), `focusAutoParam`, `showAutomationParam`, `clipArmedTrackKeys`; hooks in `buildRows` (field pointerdown / box dblclick / box wheel / diamond click / row contextmenu), `wireFxCards` (`.fxrow` pointerdown / dblclick / kf click / contextmenu) and `buildAnimList` (Mix slider + `.awetkf`)
- **State owned:** writes `lane._autoP` (and `state.inlineCurves` in the `showAutomation*` path)
- **Key symbols:** `focusAutoParam`, `trackKeyFor`, `showAutomationParam`, `clipArmedTrackKeys`
- **Invariants / gotchas:** Hooked ONCE per gesture (at pointerdown), never inside the drag loop — `renderTimeline` on every mousemove would be wasted work. `markDirty` is honest: `lane._autoP` is serialized. The parameter row's context menu (**Show automation · Reset to default · Clear automation**) replaces the invisible right-click-to-reset gesture on the groove; the reset survives as a menu entry. `clipArmedTrackKeys` is what keeps clip-level "Show automation" from opening `opacity` when the clip's only curve lives in an effect or a Motion Mix.
- **Status:** ✅
- **Roadmap:** —

## Motion Mix as a parameter (mot:&lt;param&gt;:mix)
- **Purpose:** **[R224 · ítem 3]** A Motion's dry/wet Mix is now a normal automatable parameter: curve in `c.kf['mot:<param>:mix']` and static value in `c.props` under the same key, both 0-100 %. It used to live apart in `a.wetKf` (0..1) / `a.wet`, which made it the only automatable value the curve editor could neither draw nor offer.
- **Location:** app.js · `isMotKey`, `motKeyFor`, `animOfMotKey`, `motParamLabel`, `evalWet`, `migrateMotionWet` (called at the top of `renderTimeline`, next to `migrateArAuto`); `laneKey`/`paramDef`/`autoColor` branches; `animWetKfAt`/`animSetWet`/`animHasWetKf`/`animToggleWetKf`; `laneMotParams`/`laneMotKeys`
- **State owned:** `c.kf['mot:<param>:mix']`, `c.props['mot:<param>:mix']`
- **Key symbols:** `motKeyFor(a)`, `evalWet` read chain, `migrateMotionWet`
- **Invariants / gotchas:** A Motion's identity is its `param` — the same thing `animOffset` sums, so two modifiers on one param share the Mix exactly as they share a destination. The key is IDENTICAL at track and clip level (`laneKey` only checks that the clip owns such a motion). `evalWet`'s read chain is additive and cannot break: curve → static value → legacy `a.wetKf` → legacy `a.wet`. **The static base must always exist** (`migrateMotionWet` seeds 100 when missing, `addAnimPreset` seeds it at creation): `evalP` reads `c.props`, and a motion created by `compose` (which builds `c.anim` by hand) would otherwise leave the curve without a floor. Deleting the motion kills its curve, its base, the breakpoint selection and any lane pointing at it — mirroring what fx deletion already did with `fxt:` keys. Because the Mix now rides in `c.kf`, trim/split/speed rebase it for free (the `aa.wetKf` rebase branches in `_cutEdgeTo`/`razorCore` are vestigial but harmless).
- **Status:** ✅
- **Roadmap:** —

## Inline automation canvas (clipautocv / autocv / windowAutoCv)
- **Purpose:** Canvases inside `#tracks` that scroll with the clips. Clip-overlay canvas = `.clipautocv` (fixed `cv._c`); track-lane canvas = `.autocv` (`cv._li` set, draws every clip of that lane). `windowAutoCv` windows each canvas to the viewport (Chromium's 32767px canvas limit) setting `cv._W`/`cv._ox`.
- **Location:** app.js · `windowAutoCv` (L3893), `scheduleAutoCvs` (L3900), creation of `.clipautocv` (L3904) / `.autocv` (L3915)
- **State owned:** per-canvas `cv._c`/`cv._li`/`cv._p`/`cv._W`/`cv._ox`/`cv._H`/`cv._kind`
- **Key symbols:** `windowAutoCv`, `scheduleAutoCvs`, `AUTO_H`/`AUTO_MIN_H`/`AUTO_MAX_H`/`RES_TOP` (L3266)
- **Invariants / gotchas:** X is timeline-absolute; a full-width canvas dies past the pixel limit → always windowed. `scheduleAutoCvs` re-windows on scroll. Note: the task brief named `clipautocv`/`windowAutoCv`; there is no symbol literally named `clipautocv` beyond the CSS class.
- **Status:** ✅
- **Roadmap:** —

## drawAutoCurve (curve renderer)
- **Purpose:** Renders one param's curve into a sub-lane canvas — for ONE clip (overlay) or MANY (track-lane draws all clips of the lane). Draws grid, curve (sampled via `evalP`, incremental segment walk), bezier handles, breakpoint squares, ghost trail, hover-segment highlight, Shape Box, marquee, ghost-add point, value tip. Populates `cv._handles` and `cv._map`.
- **Location:** app.js · `drawAutoCurve` (L3597); helpers `autoColor` (L3267), `isAutoFocus` (L3591), `autoSelMatch` (L3588)
- **State owned:** writes `cv._handles`, `cv._map`, `cv._sbHandles`; reads `state.autoSel`, `state.shapeBox`, `state.hoverAuto`
- **Key symbols:** `drawAutoCurve`, `cv._map` (`{c,li,p,mn,mx,padT,gh,pps,unit,ox}`), `isAutoFocus`, `autoColor`
- **Invariants / gotchas:** [R95·E2] focus (hovered lane, else selected clip's track) drives only alpha/width — never geometry. Reuses `evalP`/`bezSegY`/`easeF` — no second engine. fxt lanes resolve per clip via `laneKey`; clips without that effect draw nothing.
- **Status:** ✅
- **Roadmap:** —

## bindAutoCurve — pointer editing (inv / nearKf)
- **Purpose:** Ableton-style envelope editing on a canvas: click line = add breakpoint · click point = remove (plain) / select (Shift) · Alt+click = delete · drag point = move (whole selection if selected) · drag segment vertically · Alt-drag = curve · dbl-click = numeric editor · background drag = marquee · right-click = menu. `inv(e)` maps pixels→{t,v,clip}; `nearKf` finds the nearest breakpoint within a 24px grab zone; `commit()` propagates pooled edits.
- **Location:** app.js · `bindAutoCurve` (L3694); `inv` (L3699), `kxy` (L3705), `nearKf2`/`nearKf` (L3706/3707), `nearHandle` (L3708), `lineDy` (L3709), `commit` (L3716), pointerdown handler (L3718+)
- **State owned:** `cv._hoverKf`, `cv._ghostK`, `cv._marq`, `state.autoSel`
- **Key symbols:** `inv`, `nearKf`, `nearHandle`, `commit`, `RK` (per-clip key via `laneKey`)
- **Invariants / gotchas:** [L6] 24px point grab-zone + ~10px edge tolerance so boundary keyframes are catchable. Lane-mode `inv` resolves the clip under the pointer; clip-overlay keeps its fixed clip. Non-select tools (razor/hand/zoom) let the event bubble to `#tracks`.
- **Status:** ✅
- **Roadmap:** [L6]

## autoSel — selection, nudge, tri-mode, taper
- **Purpose:** `state.autoSel={cid,p,set:Set<kf>}` holds a breakpoint selection. `selectAllAuto`, `nudgeAutoSel` (arrow-key move: ←/→ time, ↑/↓ value), `autoSelApply` (Fusion tri-mode: value/offset/scale), `taperSel` (AE amplitude scale about mid-value).
- **Location:** app.js · `selectAllAuto` (L3353), `nudgeAutoSel` (L3356), `autoSelApply` (L3453), `taperSel` (L3389), `autoSelMatch` (L3588)
- **State owned:** `state.autoSel`
- **Key symbols:** `state.autoSel`, `nudgeAutoSel`, `autoSelApply`, `taperSel`
- **Invariants / gotchas:** Selection holds live kf object refs → filtered against `ks.includes` before use (stale after undo/reload). Dropped on paste/simplify.
- **Status:** ✅
- **Roadmap:** [R70], [R95·A3]/[R95·B2]

## Copy / paste automation (kfClipboard / pasteAutoAt)
- **Purpose:** `copyAutoCurve` copies a curve (or selected breakpoints, time-normalised to first) into `state.kfClipboard` (with min/max for range rescale). `pasteAutoAt(target,tAbs)` stamps at a given absolute time (rescaling value range if different), merging within tolerance. `copyAutoSel` is the selection helper.
- **Location:** app.js · `copyAutoCurve` (L3340), `pasteAutoAt` (L3344), `copyAutoSel` (L3352)
- **State owned:** `state.kfClipboard` `{mn,mx,ks:[{t,v,e,hOut,hIn}]}`
- **Key symbols:** `state.kfClipboard`, `pasteAutoAt`, `copyAutoCurve`
- **Invariants / gotchas:** [L5] paste uses the CLICK position (`tAbs`), not the playhead. Value range is rescaled unless src/dst min-max match.
- **Status:** ✅
- **Roadmap:** [L5]

## hoverAuto (focus source)
- **Purpose:** `state.hoverAuto={cv,…}` = the lane currently under the pointer; `isAutoFocus` uses it to decide which curve reads at full alpha.
- **Location:** app.js · read in `isAutoFocus` (L3591)
- **State owned:** `state.hoverAuto`
- **Key symbols:** `state.hoverAuto`, `isAutoFocus`
- **Invariants / gotchas:** Focus drives alpha/width only — never geometry, so nothing moves on hover.
- **Status:** ✅
- **Roadmap:** —

## Shape Box (state.shapeBox)
- **Purpose:** [R95·B1] Fusion-style free-transform box over a breakpoint selection: corners scale (Alt mirror), edges stretch one axis, top corners skew in time, inside moves. Shift+B toggles. `base` freezes original coords so each drag is absolute.
- **Location:** app.js · `shapeBoxOpen` (L3368), `shapeBoxClose` (L3375), `shapeBoxToggle` (L3376), `shapeBoxSync` (L3378), `shapeBoxApply` (L3381); drawn in `drawAutoCurve` (~L3657), dragged in `bindAutoCurve` (~L3720)
- **State owned:** `state.shapeBox={cid,p,t0,t1,v0,v1,base:[{k,t,v}]}`
- **Key symbols:** `shapeBoxApply`, `shapeBoxSync`, `cv._sbHandles`
- **Invariants / gotchas:** [R95] holds live kf refs → must be dropped on undo / project or sequence load. Needs ≥2 selected breakpoints.
- **Status:** ✅
- **Roadmap:** [R95·B1]

## Easing library (EASE_PRESETS)
- **Purpose:** [R95·A4] CSS-style cubic-bezier presets applied to a segment (writes `A.hOut`/`B.hIn` scaled to the segment's real span). `easeTargets` finds the segment(s): every consecutive pair in the selection, else the one under the cursor. `initBez` seeds default thirds handles.
- **Location:** app.js · `EASE_PRESETS` (L3440), `applyEasePreset` (L3446), `easeTargets` (L3449), `initBez` (L3260)
- **State owned:** mutates kf `hOut`/`hIn`/`e`
- **Key symbols:** `EASE_PRESETS`, `applyEasePreset`, `initBez`
- **Invariants / gotchas:** One normalised curve fits any duration/value range (scaled at apply time).
- **Status:** ✅
- **Roadmap:** [R95·A4]

## Curve simplification (RDP)
- **Purpose:** Ramer-Douglas-Peucker thinning in pixel space; hold/bezier/handled points always kept. Also used by perform-and-bake.
- **Location:** app.js · `rdpKeep` (L3463), `simplifyAuto` (L3468)
- **State owned:** rewrites `c.kf[p]`
- **Key symbols:** `rdpKeep`, `simplifyAuto`
- **Invariants / gotchas:** Needs ≥4 points; no-ops if nothing removable.
- **Status:** ✅
- **Roadmap:** [R70]

## Pooled Automation Items (state.autoItems / kfLink / poolPropagate)
- **Purpose:** [R95·D2] a curve becomes a reusable POOLED item. `state.autoItems={id:{id,name,kf,dur}}`; `c.kfLink={param:itemId}` links an instance. Pooling by PROPAGATION: the editor keeps writing `c.kf[p]`, and `commit()` calls `poolPropagate` to push the edit to the item + every sibling instance. `applyItem` stamps an item (with loop / relative-accumulate options).
- **Location:** app.js · `ensureItems` (L3400), `itemFromCurve` (L3401), `linkItem`/`unlinkItem` (L3405/3406), `poolPropagate` (L3408), `applyItem` (L3416), `itemMenuItems` (L3426); `commit` hook (L3716)
- **State owned:** `state.autoItems`, `c.kfLink`
- **Key symbols:** `poolPropagate`, `applyItem`, `kfLink`, `itemFromCurve`
- **Invariants / gotchas:** Items normalise time to first key (t0). `sepAuto` copies `kfLink` by value so a duplicate stays an instance of the same item. `applyItem` guards against explosion (n>512) on tiny item over long clip.
- **Status:** ✅
- **Roadmap:** [R95·D2]

## Perform-and-bake REC (state.autoRec)
- **Purpose:** [D1-legacy] arm REC, play, and perform a control with the mouse; the gesture is captured via `manualEdit`→`recWrite` as keyframes, then RDP-thinned on stop (`bakeRecorded`). Touch semantics: the performance wipes pre-existing points in the span it covers.
- **Location:** app.js · comment header ~L2700; `autoRecOn` (L2707), `toggleAutoRec` (L2708), `recWrite` (L2710), `bakeRecorded` (L2718); DOM `#autoRecBtn`
- **State owned:** `state.autoRec` (never persisted), `_recTouch` map
- **Key symbols:** `toggleAutoRec`, `recWrite`, `bakeRecorded`
- **Invariants / gotchas:** CORRECCIONES-V2 memory note says the AE model should ELIMINATE perform-and-bake; still present in code. Recording deletes `c._autoOff[p]` on touch (writes the curve rather than bypassing).
- **Status:** ⚠️
- **Roadmap:** [D1] (roadmap says remove)

## Legacy override / re-enable (_autoOff)
- **Purpose:** Ableton-style override machinery: `setAutoOff` freezes the current curve value and bypasses automation; `reenableAuto`/`reenableAll` restore; `returnToDefault` drops all automation freezing each param; `#reEnAll` global button shown via `updReEnableGlobal`/`anyOverride`.
- **Location:** app.js · `anyOverride` (L2731), `reenableAll` (L2732), `updReEnableGlobal` (L2733), `returnToDefault` (L3583), `reenableAuto` (L3584), `setAutoOff` (L3585); `sepAuto` copies `_autoOff` (L3279)
- **State owned:** `c._autoOff` map, `#reEnAll` visibility
- **Key symbols:** `setAutoOff`, `reenableAuto`, `_autoOff`, `#reEnAll`
- **Invariants / gotchas:** DEAD in the eval path — `evalP` (L463) deliberately ignores `_autoOff` per [A2/D1]. `drawAutoCurve`/`inv` still read it, and these UI functions remain. [A2] mandates removing the "recover automation" button entirely. Vestigial tension.
- **Status:** 🗑️ (partly removed; residue remains)
- **Roadmap:** [A2]/[D1]

## Modulation stack — engine (c.mod / evalModStack)
- **Purpose:** [R95·C1] a param = `base → layer₁ → layer₂ …`, each layer = `source ⊗ blend ⊗ depth`. `c.mod={param:[{id,src,blend,depth,on,…srcParams}]}`. Sources: `lfo` (shapes), `audio` (band envelope), `space` (dome az/el/dist). `modSignal` returns a normalised 0..1 signal; `evalModStack` folds the layers (add/sub in param units; mul/min/max/set as 0..100%).
- **Location:** app.js · comment header L522; `MOD_BLENDS`/`MOD_SRCS`/`LFO_SHAPES` (L529-531), `modDefaults` (L532), `modSignal` (L537), `modAudioEnv` (L554), `evalModStack` (L563), `hasMod`/`anyMod` (L574/575), `modFormula` (L578)
- **State owned:** `c.mod`
- **Key symbols:** `evalModStack`, `modSignal`, `modDefaults`, `MOD_BLENDS`
- **Invariants / gotchas:** Deterministic in export (everything derives from `t`, never wall-clock). · **[R318→R320] las cachés de este camino son tres y se invalidan distinto.** `_modAudioCache` (envolvente moldeada por banda+atk+rel) deriva de `_arCache` y muere con él —se vacía junto a `_fxEnvCache` en los seis puntos de invalidación, siempre las dos juntas—. `m._specRaw` (rango de frecuencia a medida) cachea **la media cruda de los bins, que NO depende de Gain ni de Gate**, con una entrada por rango; puerta y ganancia se aplican después en una pasada lineal sobre `m._specOut`. R318 lo había «arreglado» metiendo los dos mandos en la CLAVE, y el fader de Gain —que recorre 0..300 de uno en uno— reintegraba el espectro entero en cada píxel del arrastre. Ninguna de las dos se serializa: `serMedia` es lista blanca. · [R95·D4] `m.frz` freezes a layer's output. Audio band names must match `computeBands` (`bass|mid|treble|bright`). `evalP` stays untouched — the stack rides on top only in `evalR`.
- **Status:** ✅
- **Roadmap:** [R95·C1]

## Modulation panel (openModPanel / .modb)
- **Purpose:** [R95·C1/A4] the modulation UI: reorderable layer list with per-layer source/blend/depth, source-specific rows (LFO shape/sync/phase; audio band/attack/release + spectrum picker; space axis/from/to), the live audit line (`modFormula`), and an add row. Anchored to its `.modb` button; closes on outside click / Esc.
- **Location:** app.js · `openModPanel` (L3519), `closeModPanel` (L3517), `_modOutside` (L3518), `refreshModFormula` (L3574); spectrum picker `drawSpecPicker` (L3479) / `bindSpecPicker` (L3496); DOM `.modpan` / `.modb`
- **State owned:** `_modPanel`; edits `c.mod`
- **Key symbols:** `openModPanel`, `refreshModFormula`, `bindSpecPicker`, `_modOutside`
- **Invariants / gotchas:** [A4] closes on click outside. Audit line + spectrum repaint live with the playhead. Panel is not in the DOM on first build → `refreshModFormula` queries INSIDE the panel (not `getElementById`).
- **Status:** ✅
- **Roadmap:** [A4], [R95·C1]

## Procedural motion (c.anim / animOffset)
- **Purpose:** Unreal-style infinite Rotator/Translator: `c.anim=[{param,mode,speed,amp,phase,on}]`, `mode:'linear'` (ramp) or `'wave'` (sine). Added on top of the base value at render time only (`evalR`), scaled by a keyframeable dry/wet (`evalWet`) — **[R224]** which no longer lives on the modifier (`wetKf`/`wet`) but as the parameter `mot:<param>:mix` in `c.kf`/`c.props`; see *Motion Mix as a parameter*.
- **Location:** app.js · comment L474; `ANIM_PRESETS`/`ANIM_PRESETS_FLAT` (L482/493), `animTime` (L504), `evalWet` (L507), `animOffset` (L512), `addAnimPreset` (L502)
- **State owned:** `c.anim`
- **Key symbols:** `animOffset`, `evalWet`, `ANIM_PRESETS`
- **Invariants / gotchas:** Adjacent to but distinct from keyframes/modulation. Deterministic in export; paused editor advances `_previewClock` so the comp "breathes". `sepAuto` deep-copies `anim` (fresh refs).
- **Status:** ✅
- **Roadmap:** —

## sepAuto (clone isolation)
- **Purpose:** Deep-copies the per-clip automation UI-state arrays (`_auto`, `_autoOff`, `anim`, `mod` with fresh layer ids, `kfLink`) onto a clone so split/duplicate/nest don't share by reference.
- **Location:** app.js · `sepAuto` (L3279)
- **State owned:** copies onto clone `n`
- **Key symbols:** `sepAuto`
- **Invariants / gotchas:** `kfLink` copied by value on purpose (duplicate stays a pooled instance). `mod` layers get new ids; `anim` fully deep-copied.
- **Status:** ✅
- **Roadmap:** —


---

## 5 · Export, proxies & decode (detalle)

# Subsystem map — Export, proxies & decode engine

Source: `app.js` (~6992 lines). Line numbers verified against the working tree on 2026-07-22.

---

## Export dialog (openExport)
- **Purpose:** Builds the modal that lets the user choose codec / resolution / fps / bitrate / range / chunks and pushes one or more jobs onto the export queue. Single instance guarded.
- **Location:** app.js · `openExport()` (~L4777) · DOM: `#exOv` overlay, `#exCodec`, `#exRes`, `#exFps`, `#exBr`/`#exBrRow`, `#exChunkRow`/`#exChunks`/`#exChunkHint`, `#exRange` (clips|inout), `#exRoomRow`/`#exRoomMode`/`#exFloor`, `#exPreset`/`#exSavePreset`, `#exEst`, `#exGo`, `#exQueue`.
- **State/data:** `state.exportPresets`, `lastExportGet()/lastExportSet()` (remembers last codec/res/fps/br), `state.workIn/workOut`, `activeSeq()`.
- **Key symbols:** codec options `png|mp4|hevc|hap|hapq|still`; `upd()` (live estimate + `#fmtChip`), `validateRes()` (probes `pickAvcCodec`/`pickHevcCodec`, greys `#exGo` with reason via `setDis`), `autoBr()`→`suggestBitrate`, `HAP_FMT`, `hapAutoChunks`, `exRangeSecs`. `$('#exGo').onclick` → `addJob`/`queueJob` → `pumpExportQ`.
- **Invariants / gotchas:** `$()` = querySelector (first match) → a second modal would steal the wiring, hence the `#exOv` early-return (L4784). Assigning `.value` doesn't fire `change` → `upd()` called manually after restoring last-used values. Flat sequences hide `#exRes` and export at seq W×H. Per-wall room export builds one job per `room.walls` entry with a `wall:{role,x0,x1,pxW,pxH,stripW,stripH}` payload; floor exports as its own `seqId` job. Without HAS_WC, mp4/hevc options disabled. Browser (non-Electron) MP4 >1.8 GB triggers a RAM warning (`appConfirm`).
- **Status:** ✅
- **Roadmap:** [R1] flexible render range (done), [D2] background encoder w/ frozen project snapshot (pending)

## Export job queue (registry + pump)
- **Purpose:** Persistent job registry decoupled from the modal view; jobs survive closing/reopening the dialog and run one at a time.
- **Location:** app.js · `_exJobs`/`_exq` (~L6458), `exJobRow`/`exPaintJob` (~L6459-6464), `exCancelJob`/`exCancelActive` (~L6474-6477), `updExportUI` (~L6478), `pumpExportQ` (~L6484), **`renderExQueue`/`exCancelQueued`** (~L6486, R216) · DOM: `#exQList .qjob` (R216 minimal list), `#exQueueWrap`/`#exQCancelAll`, `#statXBtn`, `#exportBtn .exbadge`.
- **State/data:** rec `{id,name,status:queued|running|cancelling|done|cancelled,p,labelTxt,opt}`; `opt._rec` back-reference.
- **Key symbols:** `job.prog/label/done` callbacks built in `addJob`; `stat()` throttled 500ms + `DSP.setProgress` (Windows taskbar). `cancelExport` flag polled by encoder loops.
- **Invariants / gotchas:** queued cancel = splice from `_exq`; running cancel = set `cancelExport=true`. Finished/cancelled jobs pruned only on modal close. **[R216]** `renderExQueue()` is a SEPARATE, minimal list — just the `_exq` items not yet started (label + ✕), rendered into `#exQList`; it does NOT reuse `exJobRow`/`exPaintJob` (those stay dead code, guarded by a `#exQueue` id that doesn't exist in the DOM — see the export-panel block below). Looked up fresh by `document.getElementById` each call (same pattern as `exJobRow`), so it's correct regardless of which call site (enqueue/consume/remove/cancel-all/panel-reopen) triggered it, and no-ops quietly when the panel is closed. "Cancel queued" (`exCancelQueued`) empties `_exq` WITHOUT touching a running job — different from `cancelarRender`'s Cancel, which does both.
- **Status:** ✅ (R216 closes the "queue has no UI" gap with the minimal version; the fuller per-job progress view via `exJobRow`/`exPaintJob` is still deferred)
- **Roadmap:** [D2] (queue exists; missing project-snapshot isolation + off-thread worker)

## runExport (master export driver)
- **Purpose:** Renders the timeline frame-by-frame at export resolution and writes PNG-seq / MP4(H.264) / MP4(HEVC) / HAP MOV / still PNG. Handles render-in-place isolation, per-wall & floor room export, SSAA, audio bake.
- **Location:** app.js · `runExport(opt)` (~L4302).
- **State/data:** `opt={codec,res,fps,bitrate,chunks,range,job, rangeT?,isolateClips?,outPath?,wall?,seqId?,silent?}`. Globals flipped: `exporting`, `_exportQuality`, `_drawFlat`, `_roomWrap`, `_compAspect`, `nestSize`, `cancelExport`.
- **[R214] Reentry-flag reset lives in `_exportCleanup(doneArg,flags)`** (local function nested in `runExport`, ~L5738) — the ONE place that resets `exporting/_exportQuality/_exCD/_vinstCap/_ncSquare` + disposes vinst + `DSP.powerSave(false)` + frees `_exAudio` + restores the isolated-clips/active-seq state + calls `job.done`. Called from runExport's two mutually-exclusive exits: the streaming-save-cancelled early return (`_exportCleanup(true)`) and the normal end-of-function exit (`_exportCleanup(cancelExport,{dxt:true})` — `dxtFree()` only runs there, the early return never touches DXT). Used to be two literal copies of this block; a fix (R212's `powerSave(false)` balance) had landed in only one of them.
- **Key symbols:** range resolution (`opt.range` 'inout'|'clips', `opt.rangeT` overrides for RIP); `eW/eH/qRes/dimStr/filePre` dims (wall vs flat vs dome-square); `seekExport(t)`→`vinstSeek`; `prepNests`; `renderExportFrame` (dome) / `composite` (png flat); `exportAudioMix`→`audioBufferToWav`/`muxAudioAAC`/`audioPCM16`. Decodes source-clip audio tracks into `m._exAudio` (≤1.5 GB cap via `decodeAudioData`). `_rsSeq` switches to `opt.seqId` and restores.
- **[R187] VRAM del export — el `GPU reset` que reportó Beltrán.** El SSAA se decide **una sola vez** (`ssExport`) y lo comparten `nestSize` y los tres caminos de render, que antes podían discrepar: el camino **PNG nunca supersamplea** el fotograma (`renderExportFrame(...,1,...)` · `composite(t,res,false)`) pero `nestSize` se reservaba igualmente al DOBLE. En un domo de 4096 eso son ranuras de nest de **8192² = 268 MB cada una** para dibujar a 4096. **Medido sobre `RitoDome.isp` (4096²@60, 3 nests a la vista): 805 MB → 201 MB.** Se pierde el suavizado extra de componer el nest al doble y reducir; a cambio el export termina.
- **[R187] El monitor de render leía la GPU entera en CADA fotograma.** `drawImage()` sobre un lienzo WebGL fuerza una instantánea del búfer de dibujo: a 4096² son 67 MB por fotograma para pintar 160×90, y en PNG venía ENCIMA de la lectura que ya hace `toBlob()` — dos lecturas completas por fotograma a 60 fps. Limitado a ~6/s (`_monT`), con el primero y el último siempre pintados. El visor del render in place ya iba limitado; el del panel se quedó suelto al portarlo.
- **[R187] La fase se quedaba clavada** en «Decodificando audio…» durante todo el render (`job.label` escribía y nadie la devolvía) — de ahí que la captura del crash mostrara esa fase con el contador ya en «frame 1 / 455».
- **⚠ Sin reproducir:** el crash NO se reprodujo en esta máquina ni con el código viejo (21 fotogramas del proyecto real, contexto vivo). Beltrán exportaba 455. Lo anterior son dos excesos reales eliminados sobre la operación exacta que falló, no una causa confirmada. **Dato que falta: si al reintentar llega más lejos del fotograma 1.**
- **[R188] Por qué el export va lento — MEDIDO sobre `untitled.isp` (domo 4096²@60, anillo de 6 sobre 2 archivos).** Reparto por fotograma: `seekExport` **80%** (498 ms), comprimir PNG 19% (118 ms), disco 1%, componer nests **0 ms**, composite final **0 ms**. La GPU no hace nada: el export está PARADO esperando a los `<video>`.
  - **Arreglado: `seekExport` deduplica.** Varios clips del MISMO medio en el MISMO instante —que es exactamente lo que hace una composición en anillo— reposicionaban N decodificadores para el mismo fotograma. Ahora se reposiciona uno por grupo y su fotograma se sube a la textura de los demás (~1 ms frente a ~80). **Medido en caliente: seek 498 → 96 ms, total 625 → 257 ms por fotograma (1,6 → 3,9 fps).**
  - **Tubería de compresión PNG** (`EX_PNG_INFLIGHT`): comprimir y escribir se lanzan sin esperarlos, sobre la instantánea que hace `toBlob`. **Medido: NO ayuda todavía** (1→769 ms/fot · 2→838 · 3→817), porque el cuello sigue siendo el reposicionamiento. Se deja en 1 y se conserva para cuando eso se arregle.
  - **La causa de fondo (ARREGLADA en R189):** `<video>.currentTime = t` decodifica **desde el fotograma clave anterior** en cada llamada. Como el export avanza secuencialmente, la distancia al fotograma clave crece con cada fotograma y el coste con ella — **medido: 90 ms en el fotograma 1 → ~1000 ms en el 60**. Exportar así es O(n²) por GOP, y la deduplicación de R188 no llega: sólo agrupa clips que piden el MISMO fotograma del MISMO archivo (un anillo de copias), no 24 clips distintos.
  - **`opt.outDir`** salta el diálogo nativo de carpeta (simetría con el `outPath` del MP4). Sin él la secuencia PNG no se puede probar de punta a punta por CDP.
- **[R212] Export cancelable + audio indecodificable.** `exDeadline` = `Promise.race` de 3 vías (resultado · timeout `EX_AUDIO_MS` · poller de `cancelExport` a 200ms) — cubre fetch/decode/mezcla de audio. Audio que falla o vence ⇒ `m._exAudioBad` ('timeout'/'error') + `flashStatus`, y el export SIGUE mudo (el relink borra la marca). Cancel efectivo en <300ms medido. Los atajos globales se bloquean mientras exista `#exOv` (guard ~L8105); el autoguardado se salta el tick con `exporting` (render-in-place ya no persiste `state.clips` truncado). `DSP.powerSave(on)` (main.js con ref-count) en export/NDI/Spout.
- **[R189] El export decodifica por WebCodecs secuencial, no por `<video>`** (`_exCD`, se enciende en `runExport`, `opt.wcDecode:false` lo apaga). Es el motor de R108 (`demuxMP4`/`makeClipDecoder`), que en previsualización sigue apagado: allí el bucle de 60 fps hambrea las bombas de decodificación, pero el export no tiene plazo — avanza un fotograma y ESPERA, así que puede bombear cuanto haga falta. Cada muestra se lee UNA vez.
  - **Medido, 24 clips distintos a 4096²@60, 60 fotogramas:** posicionamiento **90→1037 ms** (`<video>`) frente a **652 ms de arranque y luego 1 ms PLANO** (WebCodecs). Total por fotograma **895 → 207 ms** (1,12 → 4,83 fps). Lo que queda es comprimir el PNG y componer, o sea trabajo real.
  - **Fidelidad verificada, no supuesta:** cuatro exports (2 por camino) comparados por PSNR fotograma a fotograma. `<video>` consigo mismo y WebCodecs consigo mismo son deterministas; entre caminos, todo idéntico salvo diferencias de **1 nivel**, el mismo ruido que `<video>` tiene contra sí mismo. HEVC 10 bits comprobado aparte, textura contra textura: idéntico en los 8 instantes (`scratchpad/cd-textura.mjs`).
  - **⚠ `keyForTime` NO es "el último fotograma que empieza antes de t".** MEDIDO (`scratchpad/cd-mapa.mjs`): `<video>` **trunca el instante pedido a microsegundos enteros** y lo compara con el arranque **exacto, sin redondear**, del fotograma. Al pedir 33333,33 µs devuelve el fotograma 1, no el 2, porque trunca a 33333 y el 2 arranca en 33333,33. Por eso `samples[i].ptsExact` existe además de `pts`. Se probaron dos reglas más sencillas y **ambas desalineaban uno de cada tres fotogramas** (PSNR 45-50 dB contra `<video>`).
  - **⚠ Aceptar un fotograma sólo por cercanía es un fallo silencioso.** La primera versión aceptaba el fotograma en caché si estaba a menos de 1,5 de distancia: cuando el correcto aún no había salido del decodificador, el anterior cumplía y se escribía en su lugar. Daba **másters distintos entre pasadas**. La única condición válida es `passed()` = ese fotograma exacto ya está decodificado. Si no llega en 10 s, no se entrega nada dudoso: se marca `m._cdFail` y se rehace por `<video>`.
  - **⚠ [R194] `passed()` en el fin de archivo necesita `flush()`, no `decodeQueueSize===0`.** Un `VideoDecoder` retiene una cola de reordenación: haberle dado la última muestra y ver la cola de entrada vacía NO significa que haya emitido todos los fotogramas. Sin `flush()`, `passed()` daba el visto bueno antes de tiempo y `frameNear` devolvía uno anterior → **los últimos fotogramas de cada clip se escribían DUPLICADOS en el máster, en silencio**. `resetTo` reinicia las banderas: el decodificador es nuevo y su cola vuelve a estar por vaciar.
  - **⚠ [R194] El repliegue a `<video>` puede recibir una instancia SIN origen enlazado** (el caso `_vinst.get(c.id)!==vi` al resolver el demux, que no marca `m._cdFail`). Fijar `currentTime` sobre un elemento en `HAVE_NOTHING` **no dispara `seeked` jamás** y `seekExport` se colgaba sin plazo ni error. `vinstSeekVideo` enlaza el origen si falta (`bindVideoSrc`, extraído de `vinstEnsure`) y, si no hay origen, resuelve en vez de esperar.
  - **⚠ Un anillo corto por sí solo se bloquea.** El decodificador por hardware retiene varios fotogramas antes de emitir el primero; con sólo AHEAD como límite alimentaba 6 muestras y esperaba para siempre una salida que nunca llegaba. `MINC` (alimentar mientras la caché esté por debajo de 6) lo rompe sin depender de cuánto retenga el decodificador. Va en el bucle de alimentación **y** en el relleno del búfer del keeper: si falta en uno de los dos, se bloquea igual.
  - **⚠ [R189] `_vinstCap` — un cuelgue latente que llevaba ahí desde siempre.** `seekExport` pide TODOS los clips dibujados de un fotograma a la vez; con más de `VINST_MAX`=32 el propio bucle desalojaba instancias que estaba esperando en ese mismo instante. Por el camino de `<video>` eso **cuelga el export para siempre** (el `seeked` esperado nunca llega porque el elemento se desmontó), no lo ralentiza. `seekExport` sube el tope a `dibujados+2` y el final del export lo devuelve a `VINST_MAX`. Probado con 40 clips simultáneos: ambos caminos terminan.
  - **Repliegues a `<video>` (lentos pero correctos):** pista con matriz de rotación no identidad (un vídeo vertical de móvil saldría tumbado — el demuxador entrega muestras crudas), contenedor no soportado, decodificador muerto, o 10 s sin fotograma. Anillo de export: AHEAD 6 · BEHIND 2 · CAP 24 · MINC 6 (en previsualización 18/16/72/0), porque en export puede haber hasta `VINST_MAX`=32 decodificadores vivos y el anillo de previsualización serían ~9 GB de `VideoFrame`. Medido en uso: ~7 fotogramas por decodificador.
- **Invariants / gotchas:** **techos de codificación MEDIDOS en esta máquina** (Chromium 148 + RTX, `scratchpad/probe-4096*.mjs`): H.264 se niega por encima de **3072²** (3200² ya falla, a cualquier bitrate); **HEVC no pasa de ~1080p** — NO es límite de la GPU (NVENC llega a 8192²), es el codificador HEVC de Chromium en Windows; **AV1 llega a 8192²** y **VP9 a 4096²** (también su perfil 2 de 10 bits), ambos por software (~10 fps a 4096²) pero con decodificación **por hardware** al reproducirlos. **[R191] El panel ya no repite estos números: los vuelve a medir con `exTopeCodec` y los escribe junto a cada opción**, así que esta lista es referencia histórica, no la fuente de verdad de la interfaz. · `opt.noAudio` salta el decode+mezcla de audio entero. · never export over live transport (pauses first). `_exportQuality=true` binds vinst to ORIGINAL media (not proxy). MP4 streams to disk via `Mp4Muxer.StreamTarget`+`DSP.fileWriteAt` (no multi-GB RAM buffer); browser falls back to `ArrayBufferTarget`. Early-return on cancelled Save dialog does FULL cleanup (leaked `_exportQuality` once = "editor went crazy after export"). Backpressure caps `enc.encodeQueueSize` and `pending` disk writes. Cleanup at end frees FBO/dxt/nestPool, disposes vinst, deletes `_exAudio`.
- **Status:** ✅
- **Roadmap:** [R1] (done), [R2] deformed-clips-on-render bug, [D2]

## Nest proxy — el caché de una composición
- **Purpose:** Un nest de N clips se **recompone entero en cada fotograma** (`prepNests` decodifica y compone los N, 60 veces por segundo) — por eso una composición de domo con mucho material se arrastra. El caché lo hornea UNA vez a un archivo ligero y lo sustituye por completo mientras siga vigente. **Medido**: nest de 6 clips en domo 4096² pasa de **2,6 fps / 6 decodificadores** a **15,8 fps / 1 decodificador** (caché a 2048², H.264).
- **Location:** app.js · motor justo antes de `prepNests` (`ncUsable`, `nestSig`, `ncTouch`/`ncRecheck`, `ncAttach`/`ncDetach`/`ncReattach`, `ncDropVinst`); horneado `ncBuild`/`ncDialog`/`ncBitrate`/`ncDivOptions` junto al bloque RIP. Menús: panel Media (clic-derecho en una secuencia) y clic-derecho en un clip de nest.
- **State/data:** en el medio del nest — `ncPath`/`ncSig`/`ncW`/`ncH`/`ncFps` (persistidos en `serMedia`) + `ncUrl`/`ncReady`/`ncStale` (runtime). Archivos en `<proyecto>/nest proxies/`.
- **[R194] La restricción a cuadradas vive en `ncUsable`**, no sólo en `ncBuild` y los menús: sin ella, un proxy no cuadrado guardado en un `.isp` anterior seguía enlazándose en previsualización. Y **«Quitar proxy» NO lleva esa restricción** — si no, un proxy heredado en una composición no cuadrada quedaba imposible de borrar, porque la única entrada que lo hacía estaba detrás de la misma condición que impide generarlo.
- **Key symbols:** **`ncUsable(m)` es la única puerta**, y la consultan exactamente cinco sitios: `prepNests` (imagen), `collectDrawnVideoClips` (no descender = la ganancia real), `collectAudioEvents` (no duplicar el sonido), `_vinstUrl` y `vinstAudio` (enlace). `nestSig(m)` = firma del contenido, recursiva a nests hijos.
- **Invariants / gotchas:** **EL CACHÉ SÓLO EXISTE EN PREVISUALIZACIÓN.** `runExport` pone `_exportQuality=true` → `ncUsable()` pasa a false en los cinco sitios → todo se recompone desde las fuentes reales (verificado: 1 decodificador en preview, 6 en export, y vuelve solo). Por eso la calidad del caché da igual: nunca llega al máster. · La firma se toma **después** de renderizar, no antes: entrar en la secuencia del nest lo MUTA (`loadSeqIntoState` le añade una pista de audio si no tiene y corre los clips un índice) — firmando antes, el caché nacía rancio en el mismo instante de crearse. · El caché lleva la **mezcla de audio horneada**: es lo que permite dejar de descender a los hijos sin quedarse sin sonido, y obliga al `continue` de `collectAudioEvents` para no oírlo dos veces. · Regenerar escribe un **nombre nuevo** y borra el viejo sólo tras enlazar: sobrescribir un archivo atado a un `<video>` vivo falla en Windows. · La invalidación es **reversible** — deshacer devuelve el caché a la vida (se compara la firma, no se marca un booleano).
- **Limitación conocida:** **sólo composiciones CUADRADAS** (domo). En un nest 16:9 el encuadre con caché NO coincide con el recompuesto — medido: el centro de masa se va un 29% en vertical, y no lo explican ni el letterbox (el archivo se hornea cuadrado) ni el volteo de `UNPACK_FLIP_Y_WEBGL` (probados los dos, sin efecto). La causa está en cómo `flatPlace` (`ca=m.w/m.h`, uv 0..1) mapea la textura del pool frente a la de un vídeo, y falta aislarla. `ncBuild` rechaza los no cuadrados con un aviso explícito antes que servir un encuadre distinto en silencio. En domo el encuadre es idéntico (**PSNR 68,7 dB, desplazamiento 0,03 px**).
- **[R186] se retiró de la interfaz · [R192] REPUESTO.** El proxy es **siempre el lienzo completo** (`ncFullSize`; fuera los divisores 1/2, 1/3, 1/4 — Beltrán lo usa siempre a tamaño completo y una opción que nadie toca es una decisión que le cobras al usuario por nada). R186 lo retiró por una discrepancia de encuadre de **PSNR 26,6 y 7 px sobre 32** … **que era un fallo del arnés de medida, no del programa**: la captura escribía `state.t`, que NO EXISTE, en vez de `state.playhead`, así que las tres «posiciones» comparadas eran el mismo fotograma congelado. Ver abajo.
- **[R192] ⚠ REGLA para cualquier medida de este componente: el arnés se valida ANTES de comparar nada.** Dos comprobaciones obligatorias, y la segunda es la que faltaba: (a) misma configuración dos veces → debe salir IDÉNTICO; (b) **dos instantes distintos → deben SALIR DISTINTOS**; si son iguales, el arnés no está moviendo el cabezal y todo lo que midiera después es ruido. Con ese arnés (`scratchpad/nc-fidelidad.mjs`), medido en tres posiciones sobre el nest real de 6 clips en domo 4096²: **PSNR 58 dB · desplazamiento del centro de masa ≤ 0,22 px sobre 256**. Lo que queda es pérdida del códec, no reencuadre. Es la TERCERA vez que este componente me hace culpar al código teniendo el fallo en el test.
- **[R193] ⚠ EL PROXY NO TIENE ALFA, y es la limitación de verdad.** Un MP4 no lleva canal alfa: al hornear, todo lo que en la composición era **transparente sale NEGRO OPACO**. Visto en imágenes (`scratchpad/nc-fidelidad.mjs` PASO 4), no deducido: en un anillo de 6 clips, sin proxy se ven las seis cuñas sobre fondo transparente; con proxy se ve el disco entero relleno de negro. **Consecuencia: si el nido va encima de otra capa, el proxy la tapa.** Si el nido es la capa de abajo (o va sobre negro), no se nota. Esto explica las medidas que no encajaban con nada: PSNR ~32 dB con desviación ~200, **reproducible, independiente del bitrate** (probado ×3, idéntico) y **sin desfase temporal** (el fotograma correcto es el 0 en el barrido ±2). Descartadas por medición: compresión, desfase de fotograma y reencuadre. **DECISIÓN DE BELTRÁN (2026-07-27): el fondo negro le parece correcto** — sus composiciones van al fondo o sobre negro, así que la pérdida de alfa no le afecta. Queda como compromiso aceptado, NO como defecto pendiente. Sólo hay que volver a esto si algún día pone un nido con proxy ENCIMA de otra capa y ve que la tapa; el arreglo sería hornear con alfa (VP9/AV1 lo admiten, y HAP Q Alpha).
- **[R193] El proxy baja la RESOLUCIÓN (tope 2048 en el lado largo), conservando el encuadre completo.** Son dos cosas distintas que R186 juntó en una: «lienzo completo» era una petición sobre el ENCUADRE, no sobre los píxeles. Bajar la resolución es lo que hace que el proxy cumpla su oficio: a 4096² esta máquina sólo ofrece AV1/VP9 por software; **a 2048² entra H.264 por hardware** (verificado: `h264 @ 2048x2048`). Y no se pierde nada visible: el visor no pasa de ~1000 px en pantalla. `NC_MAX=2048`, nunca amplía.
- **[R192] Coste de horneado, medido y ahora DICHO en el diálogo:** a 4096² esta máquina sólo ofrece **AV1 y VP9, que codifican por software** → un nido de 20 s tarda **~200 s** (≈10× su duración). El códec se elige antes de abrir el diálogo para poder anunciarlo; sin ese aviso, quien pulsa «Generar» cree que se ha colgado.
- **Status:** ✅ en composiciones cuadradas (velocidad 2,6→15,8 fps · 6 decodificadores → 1 · bypass en export · invalidación reversible · persistencia · **fidelidad 58 dB / 0,2 px**) · ⛔ bloqueado en no cuadradas
- **UI:** menús de generar/regenerar/quitar (Media + clip), **sólo si `m.w===m.h`** · chapa `Proxy` / `⚠ Proxy stale` en el clip · interruptor global **Comp** en la barra del visor (`#nestCacheToggle`, junto a `Proxy`) que alterna `state.view.useNestCache`.
- **Roadmap:** levantar la restricción de cuadradas. **Pista concreta, SIN VERIFICAR** (sale de leer, no de medir): en `renderExportFrame` la rama `else if(flat)` recorta el letterbox —correcto para un export de entrega— **sin comprobar `_ncSquare`**, aunque el comentario justo encima dice que al hornear un nest hay que conservarlo. Si es eso, el archivo horneado de un nido 16:9 sale recortado mientras que `prepNests` lo conserva, y de ahí el desencuadre. Medirlo antes de tocarlo. · Regeneración automática tras un rato de quietud (hoy es manual y a propósito: regenerar en cada cambio secuestraría el editor).

## Panel de export — hoja flotante (R183)
- **Purpose:** Recreado del handoff `scratchpad/redesign/export-panel/…/Export Panel - Rev 1.dc.html`. Deja de ser un overlay a pantalla completa: es una **hoja de 660px centrada y arrastrable por su cabecera**, con velo `rgba(8,9,10,0.52)` para que el editor siga legible. Añade un **monitor de render**, sube el estado a bloque de primera clase, pone los ajustes en rejilla de dos columnas y sustituye el selector de resolución por **tamaño en píxeles** (Igualar fuente / Preajuste / Personalizado).
- **Location:** app.js · `openExport()` + `exPx()`/`exDeadline()`/`exWaitPause()`/`exFmtDur()` y `_exPaused`/`_exStage` (módulo). CSS `.exs-*` en index.html.
- **Key symbols:** **`exPx(S) → {w,h}` es LA fuente de verdad del tamaño**: de ahí salen estimación, bitrate automático, bpp, recuento de fotogramas, aspecto del monitor y el nombre del render. El handoff lo exigía explícito porque el código viejo multiplicaba `res*res` en cinco sitios y se desincronizaban. · `job.frame` (de R179) es lo que alimenta el monitor — el mismo enganche del visor de avance del render in place.
- **Invariants / gotchas:**
  - **[R190] Con un render vivo, «Exportar» está BLOQUEADO y «Cerrar» pasa a «Cancelar y cerrar».** El botón decía «Reiniciar render» y relanzaba encima de un render en curso — un clic de más y perdías lo hecho; para rehacerlo hay que cancelar primero, que es explícito. Y cerrar el panel dejaba el render corriendo a ciegas: sin monitor, sin barra y sin manera de pararlo salvo reabrir. La X de la cabecera y Esc hacen lo mismo que Cerrar. **Verificado en la app** (`scratchpad/ex-botones.mjs`), incluido que un clic en Exportar durante el render no encola nada.
  - **[R190] Al terminar se abre la carpeta directamente**, sin el `appConfirm` que preguntaba: la respuesta era siempre la misma. Sólo en el ÚLTIMO trabajo (`!_exq.length`) — una sala por muro encola 4 + piso y serían cinco ventanas del explorador. `pumpExportQ` saca el trabajo de `_exq` ANTES de llamar a `runExport`, así que esa condición es exacta.
  - **[R190] ⚠ Los diálogos (`.overlay`) van en z-index 9600, no 50.** Estaban por DEBAJO del panel de export (`.exs-scrim`, 60) y de los paneles flotantes (`.modpan`, 9000): guardar un preajuste desde el panel abría un `appPrompt` invisible e imposible de contestar. Un modal bloquea a quien lo abre, así que tiene que estar por encima de todo. Cualquier capa nueva debe quedar por debajo de 9600.
  - **El monitor se dibuja en `job.frame`, no en un rAF**: así sigue avanzando con la ventana en segundo plano (rAF se estrangula), y `exDrawMon` va en try/catch porque un fallo de dibujo NUNCA puede congelar el modelo de progreso.
  - **Letterbox en una sola pantalla 16:9**: domo 4096² → proxy 90×90 · 2D 16:9 → 160×90 · sala 5760×1080 → 160×30. Verificado en los tres.
  - **Pausa**: `_exPaused` lo sondean los TRES bucles de render vía `exWaitPause()`. Al reanudar se corrige `S.t0` con el tiempo pausado, o el transcurrido pega un salto y la ETA se dispara.
  - **`e.target.closest` no existe en `document`** — el manejador de Esc lo lanzaba y la hoja no cerraba. Guarda `t&&t.closest`.
  - **Bytes escritos reales**, no estimados: `job.wrote` se alimenta desde el `onData` del muxer, el `writeBinary` del PNG y el `put` del HAP. El muxer vuelca por trozos, así que la celda está en «—» al principio; se rellena también en `done`.
  - **`decodeAudioData` atiende sus callbacks Y ADEMÁS devuelve una promesa**: sin un `.catch` en esa promesa, su rechazo salía como excepción no capturada aunque el error ya estuviera atendido.
  - **`exDeadline`** acota las dos etapas de audio (`EX_AUDIO_MS` = **3 min**). Se añadió persiguiendo una hipótesis EQUIVOCADA sobre un cuelgue (ver abajo), pero se conserva por su propio mérito: son las únicas etapas que dependen de material arbitrario del usuario y ninguna debe poder colgar un render sin barra, sin error y sin archivo. El plazo existe para distinguir **colgado** de **lento**, y por eso son 3 minutos y no 45 segundos: 1,5 GB desde un disco lento tardan más sin estar rotos.
  - **Un clip que pierde su audio se DICE POR SU NOMBRE.** El error de plazo se marca (`e.exTimeout`) para distinguirlo de «este clip no trae pista de audio», que es normal y siempre fue mudo. El aviso va por `job.warn` a una línea ámbar persistente del panel (`#exWarn`) —no un `flashStatus` que se va— y sobrevive al «Terminado»: perder el audio de un plano y enterarte al reproducir el máster es el peor final posible. Se limpia al relanzar, porque los avisos son del render en curso.
  - **`_exStage`** es una miga de pan con la etapa actual de `runExport`. Fue lo único que localizó el cuelgue de la prueba: **`DSP` viene de `contextBridge` y está CONGELADO**, así que parchear `DSP.saveFile` desde un arnés no surte efecto y se abre el diálogo nativo, que espera a una persona. Para probar exports de punta a punta hay que interceptar `runExport` (global en un script clásico) e inyectarle `outPath`.
  - La cola (`_exJobs`) sigue viva en el registro; `exJobRow`/`exPaintJob` (la vista de progreso POR trabajo, con barra) siguen sin usarse — `#exQueue` sigue sin existir en el DOM — esa revisión sigue diferida (decisión del handoff). **[R216]** lo que SÍ se cerró es la falta total de interfaz: `#exQueueWrap`/`#exQList` (dentro de `.exs-st`, bajo `#exWarn`) muestran una lista mínima de los trabajos de `_exq` que TODAVÍA no arrancaron (etiqueta + ✕ cada uno) más un botón «Cancel queued» que vacía la cola sin tocar el que está corriendo (ese ya tenía su propio Cancel en `#exActs`). Ver el bloque "Export job queue" arriba para los símbolos (`renderExQueue`/`exCancelQueued`).
- **[R185] Endurecido para producción.**
  - **[R191] La lista de códecs muestra SIEMPRE los cinco formatos, cada uno con SU LÍMITE ESCRITO** («MP4 · H.265 / HEVC — máx. 1080 × 1080 aquí»). R185 los escondía cuando no cabían, lo que resolvía un problema real —ofrecer lo imposible cuesta un render entero para descubrirlo— pero creaba otro: **un MP4 ligero para revisar es una petición legítima y el desplegable no dejaba pedirlo**. Si el elegido no alcanza el tamaño, Exportar queda **bloqueado con el motivo escrito** (`exGoGate` combina los dos motivos de bloqueo: render en curso y códec que no llega; si cada sitio lo tocara por su cuenta, ganaría el último en escribir).
  - **[R194] Se sondea lo que se va a CODIFICAR, no lo que se ve en el panel.** En la sala por muros cada muro se codifica aparte a `pxW×pxH`; sondear la tira entera (8192×2048) daba H.264 por imposible y **bloqueaba Exportar aunque cada muro de 2048² cabe de sobra**. · **El bitrate NO entra en el caché del sondeo** (el techo no depende de él, medido): con él dentro, cada tecla del campo Mbps disparaba la escalera entera ×2 códecs, y `_cdTok` sólo cancela la escritura en el DOM, no el sondeo. · **Mientras se sondea, un códec de vídeo se da por NO válido**: entre el cambio de tamaño y la respuesta del codificador, Exportar seguía pulsable y encolaba un trabajo que moría en `codec-pick`.
  - **[R191] Los límites NO están escritos a mano: se le preguntan al codificador** (`exTopeCodec`, escalera de alturas manteniendo la proporción, cacheada por códec+proporción+fps). Se consulta sólo cuando el tamaño actual no cabe. **Medido así en esta máquina:** H.264 → 3072×3072 (1:1) · 3840×2160 (16:9). H.265 → 1080×1080 · 1920×1080. Coincide con las cifras de `probe-4096*.mjs`, pero ahora la interfaz las vuelve a medir en vez de repetirlas, así que no envejecen con la máquina ni con Chromium.
  - **[R191] H.265 vuelve a la lista** (se había retirado del todo). Export real verificado con ffprobe: `hevc / Main / 1024×1024 / 30 fotogramas` (`scratchpad/ex-hevc.mjs`). `runExport` ya lo entendía por `VCODECS`+`pickHevcCodec`; faltaban la entrada del desplegable, incluirlo en `isVid` (o desaparecía la fila del bitrate y se exportaba con el último valor a ciegas) y dejar de filtrarlo al releer el último export usado.
  - **H.265 / HEVC retirado del todo.** Sólo funcionaba a 1080p en esta compilación. Una memoria de «último export» antigua tampoco puede resucitarlo.
  - **El panel habla del LOTE, no de una pieza.** La sala por muro encola N trabajos: antes, al terminar el primer muro el panel anunciaba «Terminado» con tres muros y el piso por renderizar, y el reloj de los muros 2–N arrancaba del clic inicial (restante falso). Ahora progreso = piezas terminadas + fracción de la que corre, la sub-línea nombra la pieza (`front · 1/3`), y sólo se declara terminado al caer la última. **Cancelar vacía la cola entera**, que antes dejaba corriendo los muros siguientes.
- **Verificado de punta a punta:** cableado correcto de opciones al motor en PNG / H.264 / HAP / HAP Q / fotograma / domo / sala-por-muro; y **export real de sala por 3 muros**: progreso 6→28% (muro 1), 40→61% (muro 2), 70→94% (muro 3), «3 archivos escritos», tres ficheros con contenido real (0,35 / 1,84 / 0,47 MB), 0 errores de consola. *(Nota de método: un primer intento dio dos muros de 1524 bytes y parecía un fallo grave — eran 30 fotogramas en NEGRO porque el clip de prueba sólo cubría el tercio central de la tira. Con contenido en toda la tira los tres traen imagen.)*
- **Sin ejecutar todavía:** el render completo de PNG-seq / HAP / fotograma abre un diálogo NATIVO (`chooseExportDir` / `saveFile`) que un arnés por CDP no puede contestar; de esos caminos se verificó que las opciones llegan bien al motor, y el motor es el de siempre. Conviene que Beltrán haga una secuencia PNG a mano antes de la primera entrega.
- **Status:** ✅ lista de aceptación del handoff completa: hoja centrada no-pantalla-completa, arrastre (120px medidos), ✕/Cerrar/Esc, letterbox en los 3 formatos, monitor por fotograma, %/fotogramas/transcurrido/restante/escrito/fps, pausa que congela y reanuda sin salto, cancelar, Personalizado con Enter/Esc/recorte 16–16384 y cuadrado en domo, filas condicionales (bitrate sólo H.264/H.265, trozos sólo HAP, sala sólo en 360), sin mayúsculas sostenidas ni glifos de macOS, 0 errores de consola. Export real verificado: 640×360 · 30 fotogramas · 1,65 MB reproducible.
- **[R186] Los preajustes recuerdan el MODO de tamaño.** Guardaban sólo el ancho, así que aplicar un preajuste hecho con «Igualar a la fuente» o con un personalizado 2560×1072 lo devolvía como un preajuste cuadrado — te cambiaba el encuadre sin decírtelo. Ahora viaja `szMode` (y `szH` para los personalizados); los preajustes antiguos sin `szMode` se leen como antes.
- **Roadmap:** vuelve la interfaz de la cola (el handoff la deja fuera de esta revisión).

## Render in place (RIP) — clip + time-selection
- **Purpose:** Bake to an MP4 in `<project>/rendered clips/` and drop it on a **new top video track at the same position, without removing anything** — muting or deleting the sources is the editor's call. Always **silent** (a bake is picture only). Two entry points: `renderInPlace(clip)` bakes a SINGLE clip/nest (own fx + automation, external adjustment layers excluded); `renderRangeInPlace()` bakes the FULL composite over the in/out time selection (`state.tl.selA/selB`, or `workIn/workOut`) — a true flatten.
- **Location:** app.js · `ripRun()` (shared body) ← `renderInPlace(clip)` / `renderRangeInPlace()` (~L5320+). Helpers: `ripBitrate`, `RIP_CODECS`, `ripCodecOptions`, `ripFormatDialog`, `ripProgress`, `ripPlaceOnNewTrack`, `addVideoFromPath`. Clip menu: "Render in place…" for non-audio clips; "Render selection in place…" when a range selection exists.
- **State/data:** clip → `runExport({...,range:'clips',rangeT:[c.start,c.start+c.dur],isolateClips:[c],noAudio:true,job:ui.job})`. Range → same but **no `isolateClips`** (full composite) → then `ripPlaceOnNewTrack` pushes a lane + `makeClip` at `[a, b-a]`.
- **Key symbols:** `ripCodecOptions(w,h,fps)` **probes the encoder** and offers only what it accepts at that exact size, best-first (H.264 → HEVC → AV1 → VP9 10-bit). `ripProgress` = the progress viewer (live frame off `glc`, bar, frame count, ETA, Cancel → `cancelExport`). `nc.props.fulldome=true` on re-import so a dome master fills the dome 1:1 (no re-warp).
- **Invariants / gotchas:** requires desktop app + saved project. **`uid()` returns a NUMBER** — the old `uid().slice(0,5)` threw a TypeError before rendering a single frame, so RIP silently did nothing from R115 until R179; never call string methods on it. `runExport` swallows its own errors via `appAlert`, so a job that must not import a half-written file passes `job.fail` (RIP does) and deletes `outPath` on failure/cancel. `opt.isolateClips` temporarily replaces `state.clips` (restored in finally); the range path deliberately omits it so adjustment layers ARE baked in. New video lane via `push` = top row AND top layer, and keeps existing `clip.lane` indices valid. `job.frame()` must read `glc` inside the render task (drawing buffer is not preserved).
- **Status:** ✅ verificado de extremo a extremo en el .exe (domo 4096² AV1 y 2D 1920×1080 H.264)
- **Roadmap:** `demuxMP4` no lee `av01`/`vp09` → un máster horneado en AV1 cae al camino `<video>` en vez del rápido de WebCodecs (funciona, sólo menos eficiente).

## WebCodecs encode + mp4-muxer
- **Purpose:** Video/audio encoding for MP4 export without FFmpeg — Chromium `VideoEncoder`/`AudioEncoder` + local `mp4-muxer.min.js`.
- **Location:** app.js · L4385-4420 (video), `muxAudioAAC` (~L4293) · `HAS_WC` (~L1259) · `window.Mp4Muxer`.
- **State/data:** `HAS_WC=(VideoEncoder!==undefined)&&(window.Mp4Muxer!==undefined)`.
- **Key symbols:** `pickAvcCodec(w,h,br,fps)` (~L4257, profiles high/main/baseline × levels 6.2→4.0), `pickHevcCodec` (~L4264, hvc1/hev1 Main × levels 6.2→3.1), `enc.configure({bitrateMode:'variable',latencyMode:'quality'})`, keyframe every `gop=round(fps)`, AAC `mp4a.40.2` @192 kbps.
- **Invariants / gotchas:** **No runtime FFmpeg → only Chromium codecs. H.264 tops out ~4096² on this GPU** → 4K needs HEVC or PNG-seq (dialog validates & explains). AAC track only declared if `isConfigSupported` (else valid silent MP4). StreamTarget writeAt reconstructs byte-identical MP4 (verified in Node).
- **Status:** ✅
- **Roadmap:** —

## HAP export path (Snappy + GPU DXT + QuickTime muxer)
- **Purpose:** Author Hap1 / HapY .mov for live players (Resolume, disguise, Watchout, TouchDesigner) with no FFmpeg — every stage is in-house: GPU DXT/YCoCg compress, JS Snappy, hand-written .mov.
- **Location:** app.js · runExport HAP branch (~L4349-4384). `HAP_FMT` (~L4488). Snappy `snappyCompress`/`_snapFrag` (~L4497). GPU DXT `DXT_FS` shader + `dxtEncodeCanvas`/`dxtEnsure`/`dxtProgram`/`dxtFree` (~L4549-4662). Frame packing `hapSection`/`hapFrame` (~L4665-4687). MOV muxer `movBuild`/`_atom`/`_stsd*`/`_co64`/`audioPCM16`/`movFtyp` (~L4692-4736). `hapAutoChunks` (~L4736).
- **State/data:** `HAP_FMT.hap={fourcc:'Hap1',tex:'dxt1',bpb:8,none:0xAB,snappy:0xBB,chunked:0xCB}`, `HAP_FMT.hapq={fourcc:'HapY',tex:'ycocg',bpb:16,none:0xAF,snappy:0xBF,chunked:0xCF}`. `_dxtFBO/_dxtTex/_dxtBuf` (RGBA32UI FBO, one texel = one block).
- **Key symbols:** DXT endpoints on the block PRINCIPAL AXIS via covariance + power iteration (box-based = 27 dB vs ffmpeg 42; the "15 dB" gotcha). YCoCg: Y in BC3 alpha block, (Co,Cg,scale) in colour block, scale factor stashed in blue as (scale-1)*8. Section type values NON-sequential (read from table). co64 + 64-bit mdat (HAP 4K = GBs/min, 32-bit offsets would wrap). Chunks = parallel decode threads on the player (each Snappy-compressed independently). Streams to disk via `DSP.fileWriteAt`, patches mdat largesize + appends moov at end.
- **Invariants / gotchas:** HAP is FIXED-RATE (texture size = frame size, Snappy only shaves flat areas). Desktop-only (`DSP.fileOpen`+`DSP.saveFile`). Incompressible chunks stored raw (type 0x0A vs 0x0B). Verified against ffmpeg's own decoder (R100·H6).
- **Status:** ✅
- **Roadmap:** — (HAP tickets R100·H1-H6 all done)

## Proxy generation (makeProxy)
- **Purpose:** Encode an all-intra (GOP=1) low-res H.264 MP4 proxy per source video for fast scrub; also populates in-RAM `m.frames`/`m.decConfig` for the WebCodecs frame-cache playback path.
- **Location:** app.js · `makeProxy(m)` (~L1477), queue `enqProxy`/`pumpProxy` (~L1474-1475), consts `PMAX=960,PMBPS=12` (~L1440).
- **State/data:** `m.frames` (array of `{ts,dur,type,data}` all-intra chunks), `m.decConfig` (VideoDecoder config from encoder meta), `m.proxyEl/el/proxyUrl/proxyPath/pw/ph/proxyReady/proxyPct`, `m._pfid`/`m._ppart` (open fd + .part path), `proxyQ`/`proxyBusy`.
- **Key symbols:** `PMAX` = 960px long-edge cap; even dims; `avc1.42E01E`/`4D0028`. FAST capture path (~L1512): WebCodecs demux (`demuxMP4`) + one `VideoDecoder` (~800 fps) instead of 1× `<video>` playback (64-min film: ~64 min → ~5 min). Fallbacks: rVFC sequential 1× capture (~L1532), then bounded per-frame seeks (~L1547). `FR_BUDGET=256 MB` cap on in-RAM `m.frames` (`_frOvf` → drop to `<video>` seek). Frozen-frame detector (pixel-hash sampling 1-in-8) aborts on out-of-level bitrate sources.
- **Invariants / gotchas:** **Manual proxies** (right-click media → Generate proxy) — no longer automatic. Atomic write: encode to `<name>.part` → `DSP.rename` on finalize (killed session never leaves a moov-less proxy at the real name; `fastStart:false` streaming). An imported file that IS a proxy is its own proxy (no proxy-of-proxy). Bind after finalize doubles as integrity check. proxies carry NO audio track.
- **Status:** ✅
- **Roadmap:** [C3] auto-associate existing proxy (largely done via attachExistingProxy)

## Proxy auto-heal / attach (attachExistingProxy)
- **Purpose:** On media load, find an existing valid proxy by exact hash or sibling basename and bind it; delete corrupt/stale ones.
- **Location:** app.js · `attachExistingProxy(m,clean)` (~L1459), `bindProxyFile` (~L1470), `proxyCandidates`/`proxyCachePath`/`proxyLocalPath`/`proxyScanDir`/`proxyHash` (~L1442-1452).
- **State/data:** `_proxyDir` (central cache, `DSP.proxyDir()`), path = `px_<hash(path|fsize)>_<PMAX>.mp4`; lookup order local (beside clip) → central.
- **Key symbols:** `bindProxyFile` loads metadata (a partial/moov-less file errors → regenerate); duration mismatch >3% = "stale cut" → reject; 15 s bind timeout marks `e.timeout` (slow NAS/cold HDD) so a valid-but-slow proxy is NOT deleted as corrupt.
- **Invariants / gotchas:** never delete on a bind TIMEOUT — only on real corruption / stale-cut ([R108-rev A2]). Diagnosis of the "tirón": corrupt/orphan proxy silently fell back to HEVC 10-bit ×N.
- **Status:** ✅
- **Roadmap:** [C3]

## MP4/HEVC range demuxer (demuxMP4)
- **Purpose:** Parse moov + sample tables out of a huge source by byte-range (never loads whole file), yielding EncodedVideoChunk-ready samples + decoder config for WebCodecs.
- **Location:** app.js · `demuxMP4(path)` (~L3978).
- **State/data:** returns `{path,codec,fmt,description,codedWidth,codedHeight,timescale,fps,samples[{offset,size,key,pts,ptsExact}],readSample,readRange,close}`.
- **Key symbols:** `DSP.openRead`/`DSP.readAt`/`DSP.closeRead`. Handles hvc1/hev1/avc1/avc3, faststart or moov-at-end, stco/co64, stts, ctts (B-frame PTS), stss. HEVC codec string probed via `VideoDecoder.isConfigSupported`.
- **Invariants / gotchas:** desktop-only (range reads). fd closed even if stat rejects (`size` read inside try). Verified end-to-end demux→decode 150/150 frames 0 errors on HEVC10 + H.264. · **[R189] `ptsExact`** = el pts SIN redondear a microsegundos; imprescindible para reproducir la elección de fotograma de `<video>` (ver `keyForTime` en ClipDecoder). · **[R189] rechaza las pistas con matriz de rotación** distinta de la identidad: entrega muestras crudas, así que un vídeo vertical de móvil saldría tumbado → mejor que caiga a `<video>`. ⚠ La matriz de `tkhd` está a `+4 +(v1?32:20) +16` — usar 24 en la versión 0 (error cometido) lee 4 bytes desplazado y rechaza TODOS los archivos.
- **Status:** ✅
- **Roadmap:** [R108] (done) · no lee `elst`: una lista de edición con desplazamiento desalinearía este camino respecto a `<video>` (no visto en el material real)

## ClipDecoder (WebCodecs playback ring)
- **Purpose:** Per-source decode-ahead engine replacing `<video>` for heavy no-proxy media: one `VideoDecoder` + bounded ring of decoded VideoFrames kept just ahead of the local playhead. Plays 4 walls where `<video>` collapses at the 4th HW decoder.
- **Location:** app.js · `makeClipDecoder(d,ex)` (~L4026). Per-clip glue `vinstEnsure`/`_useCD`/`_vinstUrl` (~L4093-4115), `vinstSeek`/`seekCDExport`/`vinstSeekVideo` (~L4135), `driveCD` (~L4149).
- **State/data:** cache Map keyed by frame timestamp; previsualización `AHEAD=18f, BEHIND=16f, CAP=72, MINC=0` · **export (`ex=true`) `6/2/24/6`**; `READAHEAD=4 MB` bulk read (mdat is decode-ordered). `_vinst` Map keyed by clip id (`VINST_MAX=32`), `HAS_WEBCODECS`, `m._cdFail`, `_exCD`.
- **Key symbols:** `setTarget(t)`, `pump()` (synchronous in-frame feed from `driveCD` — [R108·E7]), `frameAt(t)`, **`keyForTime(t)`/`passed(t)`/`frameNear(t)` [R189]**, `isDead()`, `close()`. TIME-based (not decode-index) reset decision (HEVC B-frames: decode ≠ display order). Async `keeper` refills the 4 MB buffer while paused.
- **Invariants / gotchas:** **OFF in preview** — `_useCD` gated on `state.view.wcDecode` (in-app main-thread render loop starves the pump; needs a worker) — pero **SIEMPRE ON en export** desde R189 (`_exCD`): allí no hay plazo de 60 fps que hambree la bomba. Proxied playback keeps the proven `<video>` path. A decoder that dies while paused/scrubbing is torn down + `m._cdFail` → permanent `<video>` fallback. Recycled `vi` compared by IDENTITY not `has()` (else zombie decoder = fd + VideoFrame leak). · **[R189] las tres trampas del camino de export** (detalle y cifras en «Export pipeline»): `keyForTime` replica que `<video>` TRUNCA el instante a µs enteros y compara con el arranque exacto; aceptar por cercanía en vez de por `passed()` produce másters distintos entre pasadas; y sin `MINC` el anillo corto se bloquea porque el decodificador por hardware retiene fotogramas antes de emitir.
- **Status:** ✅ en export (verificado contra `<video>` por PSNR, H.264 y HEVC 10 bits) · 🚧 en previsualización (pendiente de mover a un worker)
- **Roadmap:** [C2] optimal buffer / play-anywhere (decode in worker + cache) — encenderlo también en previsualización

## Per-clip video instances + <video> servo playback
- **Purpose:** One private `<video>` decoder + GPU texture per DRAWN clip (keyed by clip id) so duplicate clips of one source play independently (preview/playback/export/nests/crossfades). LRU-capped, GC'd when the clip disappears.
- **Location:** app.js · `_vinst` map (~L4090), `vinstEnsure` (~L4102), `vinstCap`/`vinstDispose`/`reconcileVinst`/`disposeAllVinst` (~L4116-4134), `vinstAudio`/`aelProbeSilent` (~L4122-4132), `ploop` servo (~L4201-4226), `play`/`pause` (~L4165-4200), `collectDrawnVideoClips` (~L4157).
- **State/data:** vi `{vel,vtex,vsrc,ready,vf,last,loadP,cd,cdPending,cdReadyP,ael,_aelUrl,_seekT}`; `m._noAudio`, `m._exAudio`.
- **Key symbols:** speed servo (±12% playbackRate, gain 0.5) instead of hard seeks ([R104] "seek storm" fix — hard seek ≤~1×/s/clip); audio servo ±8%; `aelProbeSilent` tears down silent audio elements after ~0.5s (6 silent ring members → 57→6 fps). `_vinstUrl` picks proxy-if-ready unless `_exportQuality`.
- **Invariants / gotchas:** proxies have no audio → `vinstAudio` always binds ORIGINAL. Ping-pong reverse mutes preview (audio can't reverse). Render-ahead (`raHas`) serves cached frames → `<video>` paused but audio still serviced each frame.
- **Status:** ✅
- **Roadmap:** [C2]

## Frame cache (all-intra proxy playback)
- **Purpose:** LRU GPU-texture cache decoding `m.frames` all-intra chunks on demand for scrub; pooled textures, never evicts a displayed frame, prefetches next 2.
- **Location:** app.js · `_fcache`/`_fpool`/`FC_MAX=64` (~L3946), `ensureDecoder`/`_vdec` (~L3941), `decodeIntoCache` (~L3948), `showFrame`/`decodeFrameToTex` (~L3954), `disposeDecoder`/`clearFrameCache` (~L3956), `seekMedia` (~L3958).
- **State/data:** `_vdec` Map (one VideoDecoder per media id), `_fcache` keyed `m.id+':'+F` → `{tex,last}`, `_fpool` reusable textures, `_fclock`.
- **Key symbols:** `_fcEvict` skips textures currently in use (`state.media.map(x=>x.tex)`). Each `m.frames[F]` decoded as a keyframe chunk + immediate `flush`.
- **Invariants / gotchas:** distinct from the ClipDecoder ring — this path is fed by `makeProxy`'s in-RAM `m.frames` (capped 256 MB); `seekMedia` uses it when `!useOrig && m.frames && m.decConfig`, else falls back to `<video>` seek.
- **Status:** ✅
- **Roadmap:** [C2]

## SSAA export render + bitrate helpers
- **Purpose:** Render one export frame supersampled into an offscreen FBO then box-downsample to res (kills fisheye minification aliasing); suggest generous bitrates.
- **Location:** app.js · `renderExportFrame` (~L4242), `ensureExportFBO`/`freeExportFBO`/`exportSS` (~L4234-4240), `suggestBitrate` (~L4256).
- **State/data:** `_exFBO/_exTex/_exSR`.
- **Key symbols:** `exportSS(res)` = 2× when `res*2 ≤ min(MAX_TEXTURE_SIZE,8192)` else 1×; `suggestBitrate` ≈0.18 bpp; per-wall crops strip sub-rect via `PB` blit uniforms.
- **Invariants / gotchas:** `gl.finish()` before `toBlob`/`VideoFrame` read; opaque black bg for MP4.
- **Status:** ✅
- **Roadmap:** —


---

## 6 · Grado de color & Inspector (detalle)

# 60 · Color grade & Inspector

Subsystem map of `app.js` — verified line numbers (app.js = 6992 lines). Two halves:
(A) **Color grade** — 3D LUT, lift/gamma/gain wheels, tone curves (all sampled in the fragment shader FSW / program `PW`).
(B) **Inspector** — `renderInspector()` and its four collapsible sections, per-param rows, masks, text/shape media editors.

---

# (A) COLOR GRADE

## Fragment-shader grade pipeline (FSW / program PW)
- **Purpose:** The single fragment shader `FSW` (compiled into program `PW`, the dome-warp program) applies the whole color pipeline in order: numeric grade (exposure/contrast/sat/temp/tint) → lift/gamma/gain → tone curves → glow → LUT. Order matters and is fixed.
- **Location:** app.js · GLSL string `FSW` uniforms declared ~L169-171; math ~L200-206.
- **State/data:** uniforms `u_lift/u_gamma/u_gain` (vec3), `u_curve`(sampler2D)+`u_hasCurve`, `u_lut`(sampler3D)+`u_hasLut`+`u_lutMix`.
- **Key symbols:** `col=pow(max(u_gain*col+u_lift,0.0),u_gamma)` (L200); curve branch L203-205 (per-channel R/G/B then luma/A channel applied to each); LUT `col=mix(col,texture(u_lut,col).rgb,u_lutMix)` L206 as final look.
- **Invariants / gotchas:** LGG neutral = lift 0, gain 1, gamma 1. Curve texture RGBA = R/G/B/luma. LUT is the last transform. Uniform locations grabbed on `PW` at L219-221 (`LW.lift/gamma/gain/curve/hasCurve/lut/hasLut/lutMix`).
- **Status:** ✅
- **Roadmap:** color-grade phases R116/R130/R132 done

## 3D LUT import (.cube)
- **Purpose:** Load a creative 3D LUT (.cube) per clip, register it as a GL 3D texture keyed by file path, blend it in as the final look with a 0..100 mix.
- **Location:** app.js · `_lutReg`/`makeLutTex` L227-233 · identity IIFE L234 · `parseCubeLUT` L235-244 · `loadLUT` L245-248 · `bindClipLUT` L249-252 · `preloadLUTs` L295-297 · inspector LUT row L2941-2954.
- **State/data:** `props.lut` (file path or null), `props.lutMix` (0..100, default 100). Registry `_lutReg` (Map path→{tex,size,name,path}); `_lutIdentity` (2³ identity so sampler3D always valid). Defaults seeded in `makeAdjustClip`/base props L1802 (`lut:null,lutMix:100`).
- **Key symbols:** `makeLutTex(data,size)`, `parseCubeLUT(text)` (rejects LUT_1D, requires LUT_3D_SIZE + exact vals count), `loadLUT(path)` (async, dedups via registry, needs `IS_ELEC&&DSP.readText`), `bindClipLUT(c)` binds on `gl.TEXTURE2`, sets `LW.hasLut/lutMix`, then chains `bindClipGrade(c)`.
- **Invariants / gotchas:** **UNPACK_FLIP_Y gotcha** — app leaves `UNPACK_FLIP_Y_WEBGL=true` globally for 2D image uploads; `texImage3D` with FLIP_Y=true is INVALID_OPERATION → LUT would be empty (black). `makeLutTex` sets FLIP_Y=false before upload and restores true+ALIGNMENT 4 after (L231-233). `.cube` R-fastest order matches texImage3D x=r-fastest. `preloadLUTs()` re-loads LUTs referenced by a just-opened project (called from `loadProject` L5332) so the look reappears without manual reload. LUT load needs the desktop app (`DSP.pickFile`).
- **Status:** ✅
- **Roadmap:** R116 (phase 1 color grade)

## Lift/Gamma/Gain color wheels (primary grade)
- **Purpose:** DaVinci-style primary grade: three color wheels (Lift/Gamma/Gain) each with a draggable balance handle + a luminance master slider, per visual clip.
- **Location:** app.js · `_Z3`/`wheelRGB` L255-257 · `bindClipGrade` L258-265 · inspector wheel UI L2882-2903.
- **State/data:** `props.cgLift`, `props.cgGamma`, `props.cgGain` — each `[handleX, handleY, master]` in -1..1 (handle = color balance, master = luminance).
- **Key symbols:** `wheelRGB(a,k)` converts a wheel handle to a per-channel RGB offset on a DaVinci layout (R top, G lower-left, B lower-right) plus master: returns `[y*k+m, (-0.5y-0.866x)*k+m, (-0.5y+0.866x)*k+m]`. `bindClipGrade` uploads `u_lift=lf` (k=0.4 additive), `u_gain=1+gn` (k=0.5 multiplicative), `u_gamma=max(0.1,1-gm)` (k=0.5, power), then chains `bindClipCurve(c)`.
- **Invariants / gotchas:** Wheels default `_Z3=[0,0,0]` (identity). Wheel UI (`.cwheel/.cwh/.cwm/.cwcol`) clamps handle to unit circle; double-click resets to `[0,0,0]`; drag → `raInvalidate()`+`render()`. Master slider writes index [2]. `bindClipGrade(c,L)` is called only via `bindClipLUT(c,L)` → now on ALL clip paths (PW-warp, flat, PFD fulldome, PEQ equirect) since R138 closed the grade gap.
- **Status:** ✅
- **Roadmap:** R130

## Tone curves (luma + R/G/B)
- **Purpose:** Per-clip tone curves for luma and each of R/G/B, built from draggable control points into a 256×1 RGBA texture sampled in FSW.
- **Location:** app.js · `makeCurveTex` L270-273 · `evalCurve` L274-277 · `curveIsIdentity` L278 · `buildCurveData` L279-282 · `uploadCurveTex` L283-286 · identity IIFE L287 · `clipCurveTex` L288-291 · `markCurveDirty` L292 · `bindClipCurve` L293-294 · curve editor UI L2904-2939.
- **State/data:** `props.curves = {l,r,g,b}`, each an array of `[x,y]` control points in 0..1 (default identity `[[0,0],[1,1]]`). Per-clip cache `c._curveTex`, dirty flag `c._curveDirty`.
- **Key symbols:** `evalCurve(pts,x)` linear-interp, flat outside endpoints. `buildCurveData(cv)` → 256×4 (R/G/B in RGB, luma in A). `curveIsIdentity(cv)` short-circuits (all four channels default 2-point). `clipCurveTex(c)` returns null on identity → `u_hasCurve=0`; else lazily builds/uploads `c._curveTex` when `_curveDirty`. `bindClipCurve` binds on `gl.TEXTURE3`.
- **Invariants / gotchas:** Same **UNPACK_FLIP_Y gotcha** — `uploadCurveTex` sets FLIP_Y=false before `texImage2D` and restores after (L284-286). Curve texture is a 1D LUT laid out 256×1. `_curveDirty!==false` means dirty (undefined counts as dirty on first build). Editor: endpoint x locked (0/1), interior x clamped between neighbors; click adds a point, drag moves, double-click removes interior point; `.ctab` tabs switch channel, `#curveReset` resets one channel. Draw uses `evalCurve` over 96 samples.
- **Status:** ✅
- **Roadmap:** R132

## PFD/PEQ grade parity (gap CLOSED · R138)
- **Purpose:** Fulldome-source (`PFD`) and equirect-source (`PEQ`) clips now receive the FULL color chain (wheels/curves/LUT), matching the PW-warp and flat paths.
- **Location:** app.js · PEQ draw (`bindClipLUT(c,LEQ)` before the tex bind) · PFD draw (`bindClipLUT(c,LFD)`) · shaders FSFD/FSEQ carry the LGG+curve+LUT block · bind fns `bindClipLUT/Grade/Curve` take a location struct `L` (default `LW`).
- **State/data:** `props.fulldome`, `props.equirect` (mutually exclusive toggles); `props.cgLift/cgGamma/cgGain`, `props.curves`, `props.lut/lutMix`.
- **Key symbols:** `bindClipLUT(c,L)` → `bindClipGrade(c,L)` → `bindClipCurve(c,L)`; `L∈{LW,LFD,LEQ}`. LUT sampler on `gl.TEXTURE2`, curve on `gl.TEXTURE3` (both free in PFD/PEQ, which use only units 0/1). FSFD/FSEQ apply `pow(max(u_gain*col+u_lift,0),u_gamma)` → curves → LUT, same order as FSW (glow/chroma remain PW-only, out of scope).
- **Invariants / gotchas:** Identity defaults (lift 0 / gain 1 / gamma 1, `u_hasCurve=0`, `u_hasLut=0`) → existing fulldome/equirect clips render pixel-identical. `L` is defaulted (`L=L||LW`) so every legacy caller of `bindClipLUT(c)` is unchanged. Verified: FSFD+FSEQ compile+link in real WebGL2. Fulldome inspector still restricts the numeric FX rows to opacity+basic grade (L2773) — that's a separate UI choice, not a shader gap.
- **Status:** ✅ (gap closed R138)
- **Roadmap:** —

## 🗄️ Sequence master grade (R139/R140/R141) — ARCHIVADO DEL TODO (R148 + R150)
> **Ya no existe en el software.** Salió en dos pasos: la **UI** en R148 (regla de poda del rediseño — el diseño no
> tiene sección "Master Grade") y el **motor** en R150 (decisión de Beltrán: *"eso nunca lo voy a aplicar"*). Sin UI,
> el motor seguía aplicando en silencio el grado de un `.isp` viejo sin forma de verlo ni resetearlo, así que quedarse
> a mitad era el peor de los tres estados.
> **Dónde vive ahora:** `_backup/deprecated/master-grade-ui.js` (UI) + `_backup/deprecated/20260725-master-grade-engine.js`
> (shader `_MGFS`/`_MG`/`_MGu`, `_masterClip`, `_mgRT`/`_mgTarget`, `masterGradeOn`, `applyMasterGrade`, `state.seqGrade`,
> los seis call-sites y el CSS de `#insMaster`). **Restaurar requiere los DOS, en orden: motor y después UI.**
> **Compatibilidad:** un `grade` guardado en un `.isp` viejo se ignora al abrir (verificado por CDP, incluso con una
> ruta de LUT inexistente); `serProject` ya no lo escribe. El grado por clip (Color) no se tocó.
> **Nota sobre el export:** el bake era `masterGradeOn()?applyMasterGrade(_exTex,SR):_exTex` y `masterGradeOn()` era
> siempre falso desde R148 (sin UI, defaults identidad) → la rama viva ya era `_exTex`. El export es idéntico.

El detalle de abajo queda como **historia** de cómo funcionaba, no como descripción del código actual.

- **Purpose:** A per-sequence GLOBAL grade over the FINAL composite (on top of per-clip grading): numeric (exp/con/sat/temp/tint) + lift/gamma/gain wheels + curves + master LUT, in preview + export + NDI + Spout.
- **Location:** app.js · shader `_MGFS`/prog `_MG` + `applyMasterGrade(inTex,size)`/`masterGradeOn()`/`_mgTarget`/`_masterClip` (near `applyBlackKey`) · preview injection in `render()` · export injection in `renderExportFrame` (grades `_exTex` before the PB blit) · NDI `ndiTick`/Spout tick (grade the FBO tex, read from `_mgRT.fbo`) · UI `renderMasterGrade()` + `#insMaster`.
- **State/data:** `state.seqGrade={exposure,contrast,saturation,temperature,tint, cgLift,cgGamma,cgGain, lut,lutMix, curves}` (per-sequence). Persisted: `saveActiveSeq`→`s.grade`, `loadSeqIntoState`→`state.seqGrade` (identity numeric defaults via `Object.assign`, extra keys ride along), `serMedia`→`grade`, restored by loadProject's `{...md}` spread. Master LUT paths reloaded by `preloadLUTs` (extended to scan seq grades).
- **Key symbols:** `_MGFS` = same chain as FSW (numeric → LGG → curves → LUT; no mask/blur/glow; alpha preserved). `_MGu` uses the SAME field names as the `L` uniform struct, and `_masterClip={props:state.seqGrade}` is a stand-in clip, so `applyMasterGrade` reuses `bindClipLUT/Grade/Curve` (the R138 `L` refactor). `applyMasterGrade` is a no-op when `masterGradeOn()` is false (identity → zero cost). `renderMasterGrade` (built by `renderInspector`, always visible, independent of the `selClip`-bound clip color UI): `MASTER_PARAMS` sliders + `MASTER_WHEELS` (fresh handlers on `state.seqGrade`) + LUT row (reuses `loadLUT`/`_lutReg`).
- **Invariants / gotchas:** Grade applied POST render-ahead cache → live edits, no `raInvalidate`. Composite always square (`compSize`/`SR`/`_ndiRes`/`_spoutRes`) so `_mgTarget` is square; `_mgRT` is SHARED across preview/export/NDI/Spout so it reallocates when their sizes differ (fine — deliberate output modes). Applies to the TOP-LEVEL active sequence only — nested sequences and the room floor bypass these call-sites. Verified by CDP (both phases): shader compiles (glFallback false), UI (5 sliders + 3 wheels + LUT), wheel drag → `masterGradeOn()` true, `render()`→`applyMasterGrade`→`bindClipLUT(_masterClip,_MGu)` no throw, reset OK.
- **Master curves UI (R141):** the curve editor (`.mgcurvecv` canvas + `.mgctab` l/r/g/b tabs + `#mgCurveReset`) in `renderMasterGrade` mirrors the clip curve editor but writes `state.seqGrade.curves` and rebakes via `markCurveDirty(_masterClip)` (the texture cache lives on `_masterClip`, rebuilt by `clipCurveTex` inside `bindClipCurve`). Reuses the `.curvecv`/`.ctab` CSS.
- **Status:** ✅ (numeric + wheels + curves + LUT, all verified by CDP)
- **Roadmap:** —

---

# (B) INSPECTOR

## renderInspector / _renderInspectorMain / refreshInspector
- **Purpose:** Rebuild the whole right-hand inspector for the current selection (group / adjustment / audio / visual clip), then keep live values synced to the playhead on scrub without a full rebuild.
- **Location:** app.js · `renderInspector` L2743 (wraps `_renderInspectorMain`+`renderReactivePanel`+`applyInspTab`) · `_renderInspectorMain` L2744-3043 · `refreshInspector` L3217-3228.
- **State/data:** `state.selId/selIds`, `state.selGroupId`, `state.insCol` (section collapse), `state.motionPreview`. Reads `selClip()`, `mediaById(c.mediaId)`.
- **Key symbols:** branches: group → `renderGroupInspector`; `c.adjust` → opacity-only + Reactive-FX hint; audio → `buildAudioInspector` (L3053); else visual clip. `refreshInspector` walks `#tfRows/#fxRows/#colorRows .prow`, updates `.num`/track width via `evalP`/`evalR`, toggles `.modon`/`.auto`, refreshes diamond fill via `kfAt`; also `refreshMotionWet`+`refreshModFormula`. Called on every scrub (`scrubRender` L3963, `ploop` L4226). The Reactive-FX tab is `renderReactivePanel`; each effect box `fxCardHtml` — [X2] its body is grouped into labelled sections `.fxsec` (Routing / Response / Parameters) inside `.fxbody`, select rows in `.fxseg`; wiring in `wireReactiveChain` keys off `.fxband/.fxmode/.fxinv/.fxshape/.fxdiv/.fxrow/.fxname/.fxdel/.fxdrag` (all preserved). [I2·Motion] the reactive-FX effects also surface in the inspector's **Motion** section (`#motionFx`) as **non-reactive** cards — `fxCardHtml(c,f,false)` renders just Intensity + params (no band/mode routing); "Add Effect" (`#motionAddFx` → `openFxMenu(e,true)`) adds a **static** effect (`int=100,band='none'`). Same `c.fx` as the Reactive tab. Card wiring is generalized: `wireFxCards(c,sel,reRender)` (reactive = `wireFxCards(c,'#arChain',renderReactivePanel)`, motion = `renderMotionFx(c)` which wires `wireFxCards(c,'#motionFx',()=>renderMotionFx(c))` — a **scoped** rebuild of only `#motionFx`, not the whole inspector), and `fxDragHandle(e,host,fxId,sel,reRender)`; `fxEditVal(host,fx,k,field,reRender)` takes the panel's reRender too. Collapse state (`_fxCollapsed`) is **namespaced per view** — key `(reactive?'':'m:')+c.id+':'+f.id` in `fxCardHtml`, `cp=(sel==='#motionFx')?'m:':''` in `wireFxCards` — so a card's collapse in Motion doesn't move it in Reactive. Motion-added effects seed `int=60` (visible but with reactive headroom). The Audio-Engine section's equalizer `#arMeter` is painted live by `arDrawMeter` (rAF loop `arMeterStart`) — [X1/R144] a **32-band log spectrum analyzer** fed by `specColAt(t)` (samples the `m.spec` FFT the frequency picker builds), with energy-lit gradient bars, `_arPeaks` slow-fall caps, DPR backing, `_rrect` rounded fills, and a **4-band fallback** (BASS/MID/TREB/BRT via `bandLevelAt`) until the FFT lands; beat-blink dot + onset frost retained.
- **Invariants / gotchas:** Manual binding — every mutation must call `render()`+`renderInspector()`/`refreshInspector()`. `_renderInspectorMain` wrapped in try/catch (L2743). Fragile: full rebuild re-wires all handlers each call.
- **Status:** ✅
- **Roadmap:** [I1]/[I2]

## Four collapsible sections (Transform / Clip / Color / Motion) + Effects sub-section
- **Purpose:** Group the visual-clip inspector into four sections; Transform expanded by default, the rest collapsed and persisted. **[R215]** Motion's nested "Effects" block (`#motionFx`, the non-reactive `c.fx` cards) is now a FIFTH member of the same standard registry (`data-sec="mfx"`), not a bespoke collapse of its own — see the Motion-FX row below.
- **Location:** app.js · section title wiring L2770-2771 · row builds L2772-2775 · Motion section L3025-3040 · `applySecCollapse` L7927 · `wireSecHeads` L7930 · `insColState` L7926 · Effects sub-header `renderMotionFx` L9591.
- **State/data:** DOM hosts `#secTf/#tfRows`, `#secFx/#fxRows` (reused as "Clip"), `#secColor/#colorRows`, `#secMotion/#motionRows`, and nested inside Motion: `#secMotionFx/#motionFxBody` (`data-sec="mfx"`). Collapse state via `insColState()` / `state.insCol` keyed by `data-sec` — `mfx` default `false` (expanded).
- **Key symbols:** `buildRows('#tfRows', isFlat()?TF_FLAT:TF, c)` (transform); `#fxRows` = FX minus `FX_COLOR_KEYS`; `#colorRows` = FX in `FX_COLOR_KEYS` + wheels/curves/LUT. `FX_COLOR_KEYS` L2740 = `{exposure,contrast,saturation,temperature,tint,glow,chroma}`. Motion section rebuilt manually (not via buildRows) → cleared each render (L3026). **[R215]** `renderMotionFx` rebuilds `#secMotionFx`/`#motionFxBody` as standard `.sechead[data-sec]` markup (chevron `<span class="ic">`, no inline onclick/transform) and calls `wireSecHeads()`+`applySecCollapse()` at the end of every call (it's a fresh DOM node each time, so `_wired` never survives a rebuild — same pattern `renderReactivePanel` doesn't need since that panel isn't part of this registry).
- **Invariants / gotchas:** `secFx` title relabeled "Clip"; Color/Motion titles set at L2771; `applyLang`'s `secLbl` helper also relabels `mfx` → Effects/Efectos. `applySecCollapse` walks each header's siblings to the next `.sechead` (skips `#insAudio`) — this also correctly scopes `#secMotionFx` to just its own `#motionFxBody` sibling, since `#motionFx` (the JS-created host div) only ever has those two children. Called at end of `_renderInspectorMain` (L3041) AND at the end of every `renderMotionFx` call.
- **Status:** ✅
- **Roadmap:** [I1]/[I2]

## Per-param rows (buildRows / value drag / keyframe diamond)
- **Purpose:** Render one `.prow` per automatable parameter: label (60px) · fader track (~129px) · number box (42px) · ONE 20px keyframe diamond — the prototype row (RevDomo:286-290).
- **Location:** app.js · `buildRows` L3164-3187 · `UNBOUNDED_P` L3188 · `editNumberBox` L3189-3193 · `startValDrag` L3233-3237 · `refreshInspector` value sync L3219-3227.
- **State/data:** param defs from `TF`/`TF_FLAT`/`FX` (`[key,label,unit,min,max]`). `c.kf[p]` keyframe arrays, `c.props[p]` base values.
- **Key symbols:** row markup `.lab/.field[data-p]/.track>i/.box>.num/.nav>button[data-k=add]`. Diamond `[data-k=add]`: click toggles keyframe at playhead (first reveals overlay via `openAuto`); right-click clears whole curve via `clearKf`+`closeAuto` (L3179). `startValDrag` drags the field (shift=fine, alt=coarse). `editNumberBox` dbl-click inline edit. Wheel on box steps value. `UNBOUNDED_P={x,y}` unclamped when typed/wheeled. **[R224]** the row now has a CONTEXT MENU (`row.oncontextmenu` → `openMenu`): **Show automation** (`showAutomationParam`) · **Reset to default** · **Clear automation** (only when automated). The old right-click-on-the-groove reset survives as its middle entry — it was a useful gesture that no tooltip ever mentioned, and it occupied the only right-click the row had. Every gesture of the row also calls `focusAutoParam(cc,p)` once at pointerdown (see *Inspector→curve sync*).
- **Invariants / gotchas:** `.auto` class = param automated (Ableton-style bright label; stopwatch removed). Filled diamond = playhead on a keyframe (`kfAt`). `hasKf()` returns undefined not false → toggles use `!!`. **[R155]** the modulation button/arc are archived (engine still evaluates modulation loaded from old `.isp`). **[R159]** prev/next keyframe buttons are gone — those 40px were what the fader was missing; jumping lives in `jumpAnyKf(dir)` on **Alt+, / Alt+.**, which walks every automated param of the selected clip.
- **Status:** ✅
- **Roadmap:** [A1]

## Mask dropdown + PNG/shape mask + mask size
- **Purpose:** Per-clip mask: dropdown of built-in shapes (circle/rounded/diamond/vignette) + custom PNG import, plus a mask-size slider for the shape masks.
- **Location:** app.js · `MASK_IDX` L223 · dropdown/size UI L2816-2836 · `rebuildMaskTex` L5274.
- **State/data:** `props.mask` (none/circle/rounded/diamond/vignette/custom/pen), `props.maskScale` (0.2..2), `c.maskData` (persisted PNG dataURL), `c.maskTex`, `c.maskName`.
- **Key symbols:** `MASK_IDX={none:0,circle:1,rounded:2,diamond:3,vignette:4,custom:5,pen:5}` — pen reuses the custom sampler branch (index 5), no shader change. `#maskSel`, `#maskUp` (PNG import → canvas → `upTex`), `#maskScaleR/#maskScaleV`. Skipped for compose nests ([N3], guarded by `!(m&&m.comp)` L2816).
- **Invariants / gotchas:** Mask size row only shown for non-none/non-custom shapes (`msShow`). PNG downscaled to max 1024. `rebuildMaskTex` delegates to `rasterizePenMasks` when pen masks exist.
- **Status:** ✅
- **Roadmap:** —

## Pen-tool point masks ([I3]) — **se editan EN EL LIENZO DEL VISOR** (R226)
- **Purpose:** Premiere-style pen masks — draw silhouettes with points, invert, feather, expand; several per clip; rasterized into the custom-mask texture. **[R226]** los puntos se dibujan y arrastran **sobre el clip, en el visor 2D** (domo, 2D y sala); el inspector conserva sólo la lista y los parámetros.
- **Location:** app.js · bloque «PEN MASK SOBRE EL LIENZO DEL VISOR» (tras `drawFlatHandles`): `_maskEdit`/`_maskDrag` · `maskEditClip`/`maskEditMask` · `penLocal`/`penUnlocal` · `penDomeBasis` · `penPix`/`penFromPix`/`penPtPix` · `maskPointHit` · `drawMaskEditOverlay` · `startMaskEdit`/`endMaskEdit`. Gestos: `maskEditPointerDown`/`maskEditPointerMove` + el `dblclick` de `gridc`, enganchados al principio de los handlers de `gridc` (pointerdown/pointermove) y en `endVdrag`. Esc en el `keydown` global. Panel del inspector: `buildPenMaskUI`. Raster: `penMaskActive` / `rasterizePenMasks`. Deep-copy en dup/split/nest.
- **State/data:** `c.penMasks` = array of `{pts:[[x,y]...] in 0..1, feather:0..60, invert:bool, on:bool}`. `c._penSel` (active index), `c.penExpand` (0.2..2 scale-about-center), `c._penCv` (offscreen 512² canvas), `c.maskTex`. Modo de edición: `_maskEdit={clipId}` + `_maskDrag={pi}`.
- **Key symbols:**
  - `startMaskEdit(c,mi)` — selecciona el clip, mete el cabezal dentro si estaba fuera, fuerza vista 2D (el 3D no tiene inverso píxel→clip) y enciende el modo. `endMaskEdit(silent)` lo apaga.
  - **Proyección exacta:** el sampler lee `u_maskTex` en `v_flat*0.5+0.5`, y `v_flat` ES `a_flat`, la coordenada local del cuadrilátero del clip → un punto guardado `p` vale `a_flat=[2·px−1, 1−2·py]` (el `1−` es `UNPACK_FLIP_Y_WEBGL`), y desde ahí se proyecta por el MISMO camino que el contenido: `flatPlace` en 2D/sala, y en el domo el parche tangente gnomónico + azimutal-equidistante de `VSW` con `rot`, `mirror` y el wrap de diámetro. `penFromPix` es su inverso analítico (2×2 en flat; proyección sobre la base ortonormal `d/U/V` en el domo). Verificado por CDP: **error de ida y vuelta 0 px** en los dos modos.
  - `drawMaskEditOverlay()` — polígonos + puntos del activo sobre `gx`, llamado al final de las DOS ramas de `drawGrid2D`; incluye la pill de modo (patrón R219/R220, baja a y=46 si la de «Preparando medios…» ocupa la fila). **[R231]** dibuja además el realce de la arista bajo el cursor y el fantasma (círculo con cruz) del punto que se insertaría.
  - **[R231] `maskSegHit(px,py)`** — arista bajo el cursor: `{si, x,y (punto proyectado), ax,ay,bx,by}`, tolerancia 8 px (un pelo por debajo de los 9 px del vértice, para que el vértice gane el empate) y los extremos (`u<6%` / `u>94%`) cedidos al vértice. `_maskHover`/`_maskHoverSig` guardan el hover; **[R231b]** la firma se cuantiza a **2 px** — a píxel entero cambiaba en casi cada `pointermove` y disparaba un `render()` de GL completo (medido: 8 movimientos de 1 px pasan de 8 repintados a 4). `maskHoverClear()` lo apaga (`endMaskEdit`, `pointerleave` de `gridc`, al insertar/agarrar y **al ceder el gesto a un paneo**).
  - `buildPenMaskUI(host,c)` — `#penAdd`, `#penList` (`.penSel/.penInv/.penFe/.penDel`), `#penEdit` (**Edit on canvas / Done**), `#penExp`, `#penHint`. «Add mask» entra directo al lienzo.
  - `rasterizePenMasks(c)` **no cambió**: unión con `lighten`, feather por shadowBlur, invert por `source-out`, sube a `c.maskTex`, pone `props.mask='pen'`.
- **Invariants / gotchas:** Separate from the shape/PNG mask. `_penCv` y `penMasks` se deep-copian (y se re-rasterizan con `rebuildMaskTex`) en nest/duplicate/split. Al quitar la última máscara activa `props.mask` vuelve a `'none'`. **Auto-sanante (patrón R218):** `maskEditClip()` apaga el modo solo si el clip desapareció, se quedó sin máscaras o **la selección se fue a otro clip** — ningún camino de edición tiene que acordarse de cerrarlo. Mientras el modo está activo se suspenden los gestos normales del lienzo (mover/escalar clip, orbitar) y no se dibujan los tiradores de escala. **[R231] DOS correcciones de uso:** (1) un clic que no cae sobre un vértice ya **no** hace `pts.push(...)` — eso añadía el punto AL FINAL del anillo, así que el polígono se cruzaba consigo mismo y cada intento de «añadir un punto en esta línea» lo enredaba más; ahora sobre una arista se **inserta en su sitio** (`splice(si+1,…)`) y en el punto proyectado, así que la figura no cambia de forma al ganar un punto, y fuera de ella no se añade nada (aviso en la barra de estado). Un polígono a medio dibujar (`<3` puntos) sí se sigue completando clicando suelto. (2) **el paneo vuelve a funcionar:** `maskEditPointerDown` sólo se queda con el botón izquierdo a secas — antes `if(e.button!==0)return true` se tragaba el botón CENTRAL, que es el que arrastra el lienzo, así que añadir una máscara dejaba el visor sin paneo. Botón central y Shift+arrastre se devuelven al gesto normal, y el `pointermove` de la máscara se salta si hay un `vdrag` en curso. **[R231b]** se ceden **SÓLO** esos dos (`e.button===1||e.shiftKey`): cediendo `button!==0` a secas, un arrastre con el botón **derecho** caía en `flatRectHit`/`flatHandleHit` y movía o escalaba el clip (con `pushUndo`). Al ceder el gesto se llama a `maskHoverClear()`, o el realce de la arista y el fantasma se quedaban congelados en coordenadas viejas mientras la vista panea por debajo. `drawFlatHandles`/`drawMaskEditOverlay` se saltan cuando `_vPaint` (la ventana solo-visor repinta por el mismo `render()` y no debe llevar chrome de edición). **[R226] Bug de carga arreglado de paso:** el camino v4 de `loadProject` (rama `m.kind==='nest'`) sólo rasterizaba `maskData`, así que una pen mask volvía del disco con `props.mask==='pen'` y `maskTex` en null → el sampler caía al `ntex` de reserva (alfa 1) y el clip aparecía SIN recortar.
- **Status:** ✅
- **Roadmap:** [I3] — mini-editor del inspector archivado en `_backup/deprecated/20260730-pen-mask-inspector-canvas.js` (ADR-0007)

## Text media editor
- **Purpose:** Paragraph text tool — content, font (incl. custom loaded), weight, italic, alignment, size, line-height, color, outline; rasterizes to a media texture.
- **Location:** app.js · editor UI L2980-3009 · `renderTextMedia` L1326 · `_customFonts`/`loadCustomFont` L1316-1324.
- **State/data:** media fields `m.text/tfont/tweight/titalic/talign/tfontSize/tlineH/tcolor/tstroke`. Global `_customFonts` (loaded family names).
- **Key symbols:** `#txtContent/#txtFont/#txtWeight/#txtItalic/#txtAlign/#txtSize/#txtLineH/#txtColor/#txtStroke/#txtLoadFont`. `reTxt()` reads all fields → `renderTextMedia(mm)` → re-texture. `loadCustomFont()` (async, needs `DSP.pickFile/openRead/readAt`) registers a FontFace and pushes family into `_customFonts`. FONTS list = 11 built-ins + custom.
- **Invariants / gotchas:** Only shown for `m.kind==='text'`. `renderTextMedia` re-run on `document.fonts.ready` (L1342) so late-loaded fonts repaint. curFont strips CSS fallback suffix.
- **Status:** ✅
- **Roadmap:** [U8]

## Shape media editor
- **Purpose:** Vector shape tool — rectangle/ellipse/line with fill, stroke color, stroke width; rasterized to a media texture.
- **Location:** app.js · editor UI L3010-3024 · `renderShapeMedia` L1344.
- **State/data:** media fields `m.shape` (rect/ellipse/line), `m.fill`, `m.stroke`, `m.strokeW`, `m.sw/sh`.
- **Key symbols:** `#shpType/#shpFill/#shpStroke/#shpStrokeW`, `reShp()` → `renderShapeMedia(mm)`.
- **Invariants / gotchas:** Only shown for `m.kind==='shape'`.
- **Status:** ✅
- **Roadmap:** —

## Audio-clip inspector
- **Purpose:** Dedicated panel for audio clips — waveform, per-clip volume, fade in/out, single-sided waveform toggle (dome Transform/FX hidden).
- **Location:** app.js · `buildAudioInspector` L3053-3073 · `drawWaveInto` L3045-3051.
- **State/data:** `c.props.volume`, `c.fadeIn/fadeOut`, `state.tl.waveTopHalf`, `m.peaks/rms`.
- **Key symbols:** `#insAudio` host, `#auWave/#auVol/#auVolV/#auFi/#auFo/#auHalf`. Volume live via `liveAudioGain`.
- **Invariants / gotchas:** `#insAudio` is never section-owned (skipped by `applySecCollapse`). Branch guarded by `m.kind==='audio' || isAudioClip(c)`.
- **Status:** ✅
- **Roadmap:** —


---

## 7 · Sala/360, Compose/Nest & formatos (detalle)

# Subsystem 70 — Room/360, Compose/Nest & Format setup

Reference map of `app.js` (single-file WebGL2 renderer). Line numbers verified against the current `app.js`.

---

# (A) ROOM / 360

## renderRoom3D
- **Purpose:** Draws the assembled 3D room to the default framebuffer: walls as textured quads (two passes — inside opaque + outside translucent), then the floor, then the projected grid/labels overlay. Called from `render()` when `view.mode==='3d' && isRoom()`.
- **Location:** app.js · `renderRoom3D(wallsTex)` (~L1184) · program `PR`, uniforms `LR.*`
- **State/data:** `activeSeq().room`, `state.view.three` ('spec'|orbit), `state.view.checkerBg`, `state.view.roomOutTex`, `_roomGeo`, `_roomGeoSeq`
- **Key symbols:** `roomVAO`, `LR.pass` (1=inside,0=outside,2=floor), `LR.backA=0.17`, `buildRoomGeo`, `drawRoomLabels3D`, `roomCameraMVP`
- **Invariants / gotchas:** `wallsTex` is the live master composite (`_srcTex` from `render()`). **[R221]** the floor pass reuses the SAME `wallsTex` (no more `compositeFloorTex`/second FBO — archived, see `_backup/deprecated/20260729-room-floor-fbo-composite.js`); its UVs come from `buildRoomGeo` pointing at the composite's own dock sub-rect. depthMask toggled between wall passes; DEPTH_TEST + CULL disabled around it. Rebuilds geometry lazily when `_roomGeoSeq!==seq.id`.
- **Status:** ✅
- **Roadmap:** [D4] fase 2 (output-target layer) — not built

## buildRoomGeo / _roomGeo / _roomGeoSeq
- **Purpose:** Builds the room's textured-quad vertex buffer (normalized + centered) into `roomVB`: one quad per wall sampling its own sub-rect of the strip, plus a triangulated floor fan sampling the SAME composite's dock rect. Caches per active-seq id.
- **Location:** app.js · `buildRoomGeo(seq)` (~L1081); globals `_roomGeo`,`_roomGeoSeq`
- **State/data:** `seq.room.walls`, `seq.w`/`seq.h` (stripW × walls+floor canvas height), `room.stripH` (walls-only height), `room.floor`, `room.floor.pxW/pxH`, `roomPlan(room.walls)`
- **Key symbols:** vertex layout = pos(3)+uv(2)+shade(1)+inward-normal xy(2) = 8 floats/32 bytes (`LR.pos/uv/shade/nrm`). `_roomGeo={wallVerts,floorVerts,norm:{cx,cy,sc,midZ,standZ,radius}}`. `standZ=min(maxH*0.95,1.7)*sc` (eye at ~1.7 m). **[R237]** Todas las UV (muros y piso) salen de `uOf=mstrU(px,stripW)` / `vOf=mstrV(py,stripH)` — la MISMA pareja que usa el blit 2D del máster de relleno; antes se calculaban a mano descontando el letterbox del cuadrado (`Fy`/`vMax`, ya retirados). Strip UV: `uL=uOf(w.x1), uR=uOf(w.x0)` (swapped so inside-view a→b runs right→left, matches 2D viewer, not mirrored).
- **Invariants / gotchas:** Per-wall vBot/vTop derive from `pxH` sobre `seq.h` (now the FULL canvas — walls automatically occupy a smaller fraction once the floor grows `seq.h`, no separate math needed). **[R221]** Floor UV: same world→uv orientation as before (X flipped, Y direct — `fuv`), but the destination is the dock rect (Front wall's x-span, `[room.stripH, seq.h]` in y) of THIS composite, not a dedicated floor-texture letterbox. Floor vertex shade is a flat `1.0` (was `0.5`) — same clarity as the walls, per Beltrán. Normalization scale `sc=1/max(rad,maxH*0.6,0.5)`. **[R237]** Se construye desde `renderRoom3D`, o sea DESPUÉS de que `render()` fije `_compAspect` y sincronice `compW/compH`: `mstrU`/`mstrV` dependen de los dos. No llamarla fuera de esa ventana.
- **Status:** ✅
- **Roadmap:** —

## Unrolled wall strip (compositing) — _roomWrap / roomSeamX / roomSeamY / roomWallScissorRects
- **Purpose:** Room content composites as a rectangular flat strip (`stripW=Σ pxW`); each wall is a sub-rect. Clips wrap across the seam (`_roomWrap`), snap to wall seams, and can be masked to specific walls.
- **Location:** app.js · flags/consts L628–637; `roomSeamX` (~L2618), `roomSeamY` (~L2619), `roomWallScissorRects(roles)` (~L2621); wrap logic in `flatPlace`/composite path (L659, L666)
- **State/data:** `_roomWrap` (true only for the top room sequence, not nests), `_compAspect=(seqW/seqH)`, `c.props.maskWalls` (roles), `w.x0/w.x1/pxW/pxH`
- **Key symbols:** `isRoom()` (seqMode==='room'), `isFlat()` (flat OR room — rectangular compositing), `flatLikeMode(md)`. Strip x assigned at creation: `w.x0=x; w.x1=x+pxW` (L5265).
- **Invariants / gotchas:** `_roomWrap=false` for nests and floor composite (only the outermost strip wraps). "Mask to wall" = GL scissor rects in the square FBO. `roomSeamX/Y` feed clip-drag snapping (wall edges + centres).
- **Status:** ✅
- **Roadmap:** —

## Canvas único muros+piso — room.stripH / roomFloorH / migrateRoomFloor [R221]
- **Purpose:** The floor stopped being a separate `'flat'` sequence (`room.floorSeqId`) composited into its own square FBO and shown as a "dock" glued below the canvas (R211). It is now the bottom pixel slice of the SAME sequence as the walls: `seq.h = room.stripH (walls-only) + floorH`. Its content paints with the normal flat blit — no second texture, no second quad, no FBO to rebind/restore.
- **Location:** app.js · `roomFloorH(walls,floor,stripW)` (~L3005, single source for the floor-height formula) · `createRoomSequences`/`applyRoomGeometry`/`lchRoomSeqTemp` (build the canvas this way) · `migrateRoomFloor(wseq)` (~L7609, called from `loadProject`) migrates a pre-R221 `.isp` that still has `room.floorSeqId` set.
- **State/data:** `room.floorSeqId` (obsolete — kept only so `migrateRoomFloor` can detect an old project and fold it in; always `null` on anything created after R221), `room.stripH` (walls-only height, the field everything that used to assume `seq.h===stripH` now reads), `room.floor` (`{pxW,pxH,wcm,dcm}` — unchanged meaning: the floor's OWN resolution, used as its export size).
- **Key symbols:** `roomFloorH` = `round(floor.pxH * frontW/floor.pxW)` (keeps the dock rect's aspect exactly `floor.pxW:floor.pxH`, so "the floor adapts to whatever resolution you work at"). Dock rect = `x∈[fw.x0,fw.x1], y∈[room.stripH, seq.h]`.
- **Invariants / gotchas:** Every place that used to treat `seq.h` as "the strip height" now needs `room.stripH` instead (walls-only spans, wall dead-zone/seam drawing, `roomFloorH`'s `frontW`); places that need the FULL canvas (letterbox/`_compAspect`, mouse↔frame mapping, `roomSeamY`'s NDC conversion) keep using `seq.h` as-is — it grew, and that's correct for them. `migrateRoomFloor` maps each clip's x/y/scale/rot (base value AND every keyframe) through the SAME orientation the R211 dock always showed (mirrored vertically vs. the floor's own editor); verified as a derived identity (reflect∘rotate(θ) = rotate(180−θ)∘mirror), not guessed.
- **Status:** ✅ (Fase A + Fase B [R222] — wrap rotado del suelo↔muros laterales/atrás, ver `computeRoomFold` más abajo).
- **Roadmap:** —

## Floor↔wall fold-wrap — computeRoomFold / roomFold [R222] — 🗄️ ARCHIVADO [R230]
- **Purpose (histórico):** Extendía el seam wrap horizontal de la tira a los otros tres bordes del piso (izquierda/derecha/abajo), que se encuentran con su muro en una bisagra de 90° en vez de estar uno al lado del otro: un clip que cruzaba uno reaparecía GIRADO sobre el muro correspondiente.
- **Por qué se archivó:** desde la Etapa 1 del visor 360 ([R229]) cada clip se coloca en el marco de SU superficie y se recorta con scissor a su sub-rect del lienzo (`clipSurfRect`/`surfaceScissorRect`/`drawClipFlat`), así que un clip del piso ya no puede desbordar a los muros — el plegado se quedó sin trabajo. Verificado por píxeles ([R230], `scratchpad/r230-surfaces.mjs`): con el clip del piso a escala 300, `wallsAll`=0 y `wallsUnderFloorCols`=0.
- **Location:** `_backup/deprecated/20260730-room-floor-wall-fold-wrap.js` (código + la derivación completa en su comentario). En `app.js` sólo queda la línea de archivado donde vivían `_roomFold`/`_roomFoldSeq`.
- **Status:** 🗄️ archivado — el seam wrap HORIZONTAL de muros sigue vivo y verificado (ver «Room seam wrap»).
- **Roadmap:** si algún día se quiere un piso que "derrame" sobre los muros, este archivo es el punto de partida — pero tendría que convivir con el scissor de superficie, no reemplazarlo.

## Visor 2D partido muros | piso — vpPanels [R230]
- **Purpose:** En una sala 360 con pistas de superficie (`lane.surf`), el `#stage` 2D se parte en DOS paneles lado a lado: los MUROS a la izquierda (la tira `[0,stripH]` del lienzo) y el PISO a la derecha (el rect `[fx0,fx1]×[stripH,H]`). Los dos bliteán su región del MISMO composite — no hay segunda FBO —, así que el visor 3D y el export siguen leyendo exactamente lo de siempre.
- **Location:** app.js · modelo de paneles `VP_DIVW`/`VP_DIV_HIT`/`roomSurfLanes`/`vpSplitOn`/`vpFloorOn`/`vpState`/`vpPanels`/`vpPanelFor`/`vpPanelAt`/`clipPanel`/`vpDivX` (~L1727) · `flatMap(P)` · `drawFlatFrame(P)` · `drawRoomGrid2D(P)` · `drawVpDivider()` · rama flat de `drawGrid2D()` · lazo de blit por panel en `render()` · `pix2frame(px,py,P)` · manejadores de puntero de `gridc` (~L4753) · botón `#dispSeg button[data-d="floor"]` (index.html) + `updModeUI`.
- **State/data:** `state.view.roomDiv` (proporción del divisor, 0.15–0.88) · `state.view.roomFloor` (false = piso oculto) · `state.view.vp[surf] = {pan,zoom}` (un par POR panel). Los dos primeros se persisten en `localStorage['ispRoomVp']` vía `saveRoomVpPrefs()`/`restoreRoomVpPrefs()` — son preferencia de la herramienta, no viajan en el `.isp`.
- **Key symbols:** un panel = `{surf, rx0..rx1 × ry0..ry1 (px del lienzo, y abajo), x,y,w,h (px CSS de pantalla)}`. `vpSplitOn()` exige `isRoom() && mode!=='3d' && roomSurfLanes()`. `clipPanel(c)` rutea cada clip a su panel vía `clipSurfRect(c)`; `roomSeamX(SR)`/`roomSeamY(SR)` dan los imanes en el marco de la superficie. **[R231]** `flatMap(P)` expone también `sx/sy/z` (lo que convierte unidades de marco en píxeles de pantalla) — lo necesita el umbral del imán.
- **[R231] Umbral del imán, por EJE y en píxeles de pantalla:** `SNAP_PX=7` + `snapThr(P,axis)`; `snapFrame`/`snapMoveAxis` reciben `(…,P,axis)`. Antes el umbral era `0.018` en unidades de MARCO, que valen distinto en cada eje: en la tira de una sala (7680×1080 dentro de un panel apaisado) daba ~4.6 px de captura en X pero **0.65 px en Y** — sub-píxel. De ahí que «sólo hiciera snap con los bordes verticales»: los horizontales (arriba/abajo del muro), el centro vertical del lienzo y el centro de cada muro **ya estaban** en `roomSeamY`/`roomSeamX`, pero eran inalcanzables con el puntero. Ahora los dos ejes capturan a 7 px (verificado por CDP). Alt sigue anulando el imán.
- **Invariants / gotchas:** **[R230b]** `vpSplitOn()` exige además `!_lchShot`: las miniaturas del launcher sacan el lienzo entero (ni siquiera sustituyen `state.lanes`, así que leerían las pistas del proyecto de fondo). **[R231/R231c]** la ventana solo-visor **sí** se parte, con su propio encuadre (`_vVp`, vía `vpState`) y su propio interruptor — pero ese interruptor decide en `vpFloorOn()`, **NUNCA en `vpSplitOn()`**: metido ahí, `(!_vPaint || _vFloor)` se reduce a `_vFloor` bajo `_vPaint` y apagar el botón devolvía el panel único del lienzo ENTERO, con el piso incluido — el botón enseñaba MÁS piso. `drawVpDivider` lleva `if(_vPaint)return`: el divisor es cromo del editor. `openViewerWindow` reinicia `_vVp`/`_vFloor` (en 2D la emergente no tiene gesto de paneo, así que sin eso un zoom descentrado no tenía vuelta atrás). **`clipPanel(c)` devuelve NULL** cuando la superficie del clip no tiene panel a la vista (piso oculto, o pista de vídeo sin `surf` en una sala partida) — contorno, tiradores, `flatRectHit`, `beginFlatResize`, los dos arrastres y `penPix`/`penFromPix` lo comprueban; sin esa guarda se mezclaba el marco de una superficie con el encuadre de otra. Los controles +/−/% de la barra y el umbral de los imanes van por `vpFocusState()` (el panel con el foco, que fija el puntero en `pointerdown`/rueda), NUNCA por `state.view.zoom`. El botón `Floor` vive en `_updViewCtl` —la función que se re-evalúa al cambiar de modo— con la MISMA condición que la partición. `state.view.vp`/`vpFocus` se reinician en `loadProject` y `newRoomProject`. **[R231c]** `roomVpAutoFloor` cubre las CUATRO vías de creación (proyecto nuevo, abrir, «New sequence… → 360 Room» y el diálogo de geometría) y **no persiste**: sólo el botón `Floor` escribe la preferencia (`_vpFloorUserSet`), porque `saveRoomVpPrefs` también corre al soltar el divisor y borraba un «piso oculto» elegido a mano. **`vpPanels()` degenera al panel único histórico** (domo, 2D plano y salas legacy sin `surf`) — ahí toda la matemática es byte por byte la de siempre. `pix2frame(px,py,P)` tiene que seguir siendo el inverso EXACTO de `flatMap(P).px` (verificado: error 0). El divisor gana a cualquier otro gesto en `pointerdown`. Tocar `roomDiv` obliga a `resize()`: los rects de pantalla cambian y el viewport de GL sale de ellos.
- **[R231] El piso se estrena abierto:** `roomVpAutoFloor(hayPiso)` fuerza `state.view.roomFloor=true` al CREAR (`newRoomProject`) y al ABRIR (`loadProject`) una sala con piso. Estrenarlo escondido detrás de una preferencia de otra sesión lo hacía parecer perdido. El botón `Floor` sigue mandando durante la sesión; esto sólo fija el punto de partida. **[R231b] no persiste**: llamar a `saveRoomVpPrefs()` aquí pisaba el «piso oculto» guardado por el usuario en CADA apertura, y esa preferencia no volvía a sobrevivir a un reinicio. Sólo toca el valor en memoria; quien guarda es el botón `Floor` al pulsarlo.
- **Status:** ✅ — verificado por CDP ([R230], `scratchpad/r230-split.mjs`): geometría de paneles, ida y vuelta con error 0, `vpPanelAt` acierta el panel, arrastre de clip en cada panel, divisor con persistencia, toggle de piso (muros a ancho completo), pan/zoom aislados por panel, y un solo panel en 3D y en salas legacy. **[R231]** `scratchpad/r231-fixes.mjs` añade: umbral del imán a 7 px en los DOS ejes (antes 4.59 / 0.65), piso abierto al entrar, y partición de la emergente por `_vFloor`. `__errs` vacío.
- **Roadmap:** —

## 2D strip editor overlay — drawRoomGrid2D
- **Purpose:** Draws the room's per-wall grid on the flat 2D strip: dead-zones under short walls, per-wall 3×4 subdivision (Grid toggle), vertical seams between walls, bottom-left role labels, and **[R221]** the floor's outline/grid/label — now just an overlay over the bottom slice of the SAME canvas (the pixel content paints via the normal blit, see above). All by exact pixels, never cm.
- **Location:** app.js · `drawRoomGrid2D()` (~L1511); dispatched from `drawGrid2D()` (only when `isFlat()&&isRoom()`)
- **State/data:** `activeSeq().room.walls`, `as.w` (stripW), `as.h` (FULL canvas height, walls+floor), `room.stripH` (walls-only height), `state.view.showGrid`, `flatMap()`
- **Key symbols:** `ROOM_GRID_COLS=4, ROOM_GRID_ROWS=3`, `roomRoleLabel`, `fx/fy` px→NDC mappers (`fy` denominator = `as.h`, the FULL canvas)
- **Invariants / gotchas:** Outer L/R edges drawn by `drawFlatFrame` (not here). Room uses this grid instead of the generic thirds grid. **[R221]** wall dead-zone/seams/labels use `room.stripH` as their bound (walls only occupy the top slice now); the floor rect overlay spans `[room.stripH, as.h]` — no longer glued past the frame's bottom edge like the old dock.
- **Status:** ✅
- **Roadmap:** —

## 3D overlay labels/grid — drawRoomLabels3D
- **Purpose:** Projects the wall grid (3×4) and painted-on role labels onto the 2D canvas overlay using the same 3D camera MVP. Gated by the Grid toggle.
- **Location:** app.js · `drawRoomLabels3D(mvp)` (~L887)
- **State/data:** `state.view.showGrid`, `_roomGeo.norm`, `roomPlan(room.walls)`
- **Key symbols:** `proj3`, affine-decal `setTransform` for perspective-correct labels, `ROOM_GRID_COLS/ROWS`, **[R201] `labelWallFrac(room,seq,role)`**
- **Invariants / gotchas:** No-op if grid off or `_roomGeo` missing. **[R220]** paints the "Preparing media…" pill (`if(mediaWarming())drawPreparingPill()`) first thing, right after `clearRect` — before the grid lines below it; see the dedicated [R220] entry under §2 for how `mediaWarming()` is memoized and self-clears.
- **[R201] El rótulo ocupa del muro lo mismo que en el lienzo 2D.** Era `wv=0.03` fijo (3% del alto del muro) y en el panel del launcher salía **tres veces más pequeño** que el rótulo del lienzo cosido de al lado. No vale una constante: en el 2D el rótulo es un tamaño FIJO de pantalla (11px, es una guía superpuesta) sobre un muro que sí escala, así que su proporción depende del panel — medida, va de 0,039 a 0,164 según tamaño y zoom. `labelWallFrac` replica el encaje del visor 2D (la tira cabe a lo alto o a lo ancho según el aspecto, por `view.zoom`) y devuelve `11/altoDelMuroEnPantalla`, con topes [0,012 · 0,25] para zooms extremos. Verificado a cuatro tamaños de panel contra la proporción REAL medida por otro camino (`flatMap`): coinciden en los cuatro dentro del 2%.
- **Nota de comportamiento:** el rótulo va PINTADO en la cara interior del muro, así que el muro que tienes delante (que se ve por fuera y translúcido) lo muestra **espejado**, como el rótulo de un escaparate visto desde la calle. Es correcto geométricamente, pero desde R201 se lee mucho más porque el rótulo es 3× mayor.
- **Status:** ✅
- **Roadmap:** —

## Camera — roomCameraMVP / state.view.three / standZ
- **Purpose:** Builds the room's view+projection matrix. Two modes: 'spec' = first-person Viewer/stand (eye at `standZ` ~1.7 m, yaw/pitch look, dolly along view, `cam.fov`); else = Orbit (`ctr` at midZ, `cam.dist`, yaw/pitch).
- **Location:** app.js · `roomCameraMVP(spec,aspect)` (~L901)
- **State/data:** `state.view.three` ('spec' → stand), `state.view.cam` {pitch,yaw,back,dist,fov}, `_roomGeo.norm` {midZ,standZ,radius}
- **Key symbols:** `persp`, `lookAt`, `mul4`; up vector `[0,0,1]`; near 0.005 far 60. Fallback norm `{midZ:0.25,standZ:0.35,radius:1}`.
- **Invariants / gotchas:** Spec fov from `cam.fov`; orbit fixed 52°. Returns `{mvp,eye}` (eye also feeds `LR.cam` for outside-translucency). [T4] the on-screen faders that drive `cam.fov/back/dist` (`#fovRange/#dollyRange/#distRange`, class `.vfader`) were redesigned in R138: custom monochrome track+fill (`--pct` var via `faderFill()`) + thumb with hover/active, replacing the raw `accent-color` native slider. FOV label shows `°`.
- **Status:** ✅
- **Roadmap:** —

## Room setup dialog — roomSetupDialog / roomPlan / drawRoomIso / drawRoomStrip
- **Purpose:** Landing/menu dialog to define a 360 room: N walls (2/3/4), roles Front/Right/Back/Left, per-wall width/height (cm) + pixel res, optional floor (px + cm). Live iso+plan schematic and the summed 2D strip preview. Presets in localStorage.
- **Location:** app.js · `roomSetupDialog(cb,partirDe)` (~L8932); `roomPlan(walls)` (~L8695); `drawRoomIso(cv,walls,floorOn,activeRole,pal,solo)` (~L8774); `drawRoomStrip` [F5] (~L8917); presets `getRoomPresets`/`saveRoomPresets` (L8869/8870)
- **[R198] `solo='plan'`** en `drawRoomIso` = sólo la PLANTA, a todo el ancho (se salta el divisor, el rótulo "3D" y todo el bloque iso). Lo usa el launcher, donde el hueco del iso lo ocupa ya el visor 3D de verdad. El editor y el diálogo llaman sin `solo` y conservan los dos paneles en un mismo lienzo.
- **[R199] La planta se ajusta MIDIENDO su tinta, rótulos incluidos** (`etiquetas`/`cajaTinta`), en vez de reservar un margen fijo de 30×15 unidades y confiar. Se parte del ajuste del polígono, se mide la caja de todo lo que se va a dibujar y se encoge hasta que entra — iterando, porque los rótulos miden lo mismo a cualquier escala y la cuenta no es lineal. Al final se centra por esa caja, así que queda centrada de verdad y no «el polígono centrado con los rótulos colgando». Verificado contra el `.exe` de R198 como control: **ahí sí se salía del lienzo** con 2 y 3 muros desde el launcher; en R199 los ocho casos (incluidas salas de 2000×300 cm y medidas de cinco cifras) dan cero píxeles pegados al borde.
- **State/data:** emits `cfg={walls:[{role,order,wcm,hcm,pxW,pxH}], floor:{wcm,dcm,pxW,pxH}|null, fps}`. Consts `ROOM_ROLES=['Front','Right','Back','Left']` (L5028), `ROOM_ROLE_COL` (L5029)
- **Key symbols:** `roomPlan` → footprint segments `{role,a,b,h}` in METERS + `poly` + `closed` + `imposible` + **[R238]** `motivo` (`'nocierra'` | `'cruzada'` | `null`, que es lo que elige el rótulo de aviso); los ángulos salen de las medidas, ninguno se fija a mano. `#rsN` wall count, `#rsWalls` rows, `#rsFloorRow`, `#rsStrip` [F5] canvas.
- **[R199 · tanda 4] `roomPlan` reescrita: la huella sale SÓLO de las medidas, para cualquier combinación de muros.**
  - **El grado de libertad.** Un cuadrilátero con los cuatro lados dados no es rígido (cadena de cuatro barras). Se fija repartiendo la inclinación **por igual** entre los dos laterales: es la única convención simétrica y devuelve el rectángulo/trapecio exactos cuando las medidas lo son. θ se resuelve por barrido de 360 pasos + bisección sobre `|BR−BL| = anchoFondo` (barrido y no bisección directa: la función no es monótona con un frente estrecho frente a los laterales).
  - **[R232] La ecuación tiene HASTA DOS raíces, y hay que quedarse con la que NO se cruza.** La de |θ| grande pliega la sala sobre sí misma: las esquinas traseras se intercambian de lado y la planta sale como un lazo. El código cortaba en la PRIMERA raíz del barrido —que empieza en −90°, o sea por el lado plegado—, así que medidas de sala perfectamente corrientes dibujaban el lazo y no la sala. Caso real: **648/745/641/648 cm** tiene raíz en **−67,6° (cruzada)** y en **−0,6° (la sala casi rectangular medida)**, y se dibujaba la primera. Ahora se recogen TODAS las raíces, se descartan las cruzadas con `planCruzada(wF,wL,wR,θ)` (que prueba los dos pares de lados no contiguos, `Front×Back` y `Left×Right`, vía `segCruza`) y se elige la de **|θ| más pequeña**: la lectura más rectangular de las cuatro medidas, que es lo que quiere decir quien las teclea. Si TODAS las raíces se cruzan, se coge la menos plegada y se marca `imposible`. Verificado por CDP con un barrido de **784 combinaciones: 0 plantas cruzadas sin avisar**.
  - **Antes los dos laterales se dibujaban con la MEDIA de sus anchos** (`avg`), así que un izquierdo de 400 y un derecho de 600 salían ambos de 500: la sala era siempre simétrica y dos de las cuatro medidas no pintaban nada.
  - **Las formas ya no dependen de QUÉ roles.** Estaban escritas para `Left+Front(+Right)`; el launcher reparte `Front/Right/Back`, así que dos y tres muros caían al salvavidas genérico y salían a **120°, ni L ni U**. Ahora el muro que falta toma la medida de su opuesto y se emiten sólo los segmentos presentes → 3 = U, 2 contiguos = L, 2 enfrentados = pasillo, en cualquier orientación.
  - **`imposible`**: si esas cuatro medidas no cierran ninguna sala (p.ej. fondo 5000 con frente 800 y laterales 500) no hay raíz → θ=0, forma sana, y `drawRoomIso` lo dice en la planta. Antes se dibujaba en silencio un fondo que no era el escrito.
  - **Compatibilidad medida:** cuadrado, rectángulo, trapecio simétrico y la U del diálogo salen **idénticos al milímetro** (`scratchpad/r199-plan.mjs`).
- **[R200] Ajustes de Beltrán:** lienzo cosido en **negro** (`.lch-stitch`) como los visores de arriba · el preajuste guarda la sala ENTERA (rol + medidas + pixelaje por muro, y el piso con su pixelaje y su on/off; las medidas del piso no, que salen de la huella) · **los dos** visores 3D se giran y se acercan (`lchOrbit` + `lchPaint3D(cual)` + `_lch.domeCam`/`roomCam`; `lchEditorShot` aplica `o.cam` también en domo) · en la sala, **planta a la izquierda y 3D a la derecha**.
  - **Al aplicar un preajuste hay que recolocar los roles sobrantes:** si el preajuste usa un rol que el reparto por cuenta había dejado detrás, quedarían DOS muros mirando al mismo sitio y la huella se rompe. **[R200b]** El complemento se calcula sobre los roles REALES de los muros ya aplicados, **no sobre lo que traía el preajuste**: los preajustes de R199 y anteriores no guardan `role`, así que la lista de usados salía vacía, los cuatro roles contaban como sobrantes y se reetiquetaban los muros inactivos con roles que los activos ya tenían — dos muros mirando al mismo sitio y, al subir la cuenta, un muro del preajuste desaparecía en silencio (el `porRol` de `lchSetWallCount` es último-gana).
  - **[R200b] El pixelaje del piso se guarda SÓLO si estaba puesto a mano.** `lchFloorCfg` devuelve siempre un valor calculado, así que guardar su salida convertía en fijo cualquier piso en automático con sólo pasar por un preajuste, sin forma de devolverlo — lo contrario de la regla de R198. No se pierde nada: los muros van en el preajuste y el pixelaje automático se recalcula igual.
- **[R199] `LCH_ROOM_ROLES`/`lchSetWallCount`** — el launcher reparte las orientaciones como el diálogo (2 = Left+Front, 3 = Left+Front+Right, 4 = las cuatro), conservando las medidas de cada rol. Sin eso, tres muros daban una U tumbada de lado.
- **Invariants / gotchas:** **[F3]** Order = fixed row position (screen order), not user-editable; picking a role already used SWAPS the two walls (dims travel, positions stay) so roles stay unique. Duplicate-role guard on Create (L5192). Floor depth spans front-to-back.
- **Status:** ✅
- **Roadmap:** [F3] wall fixed ✅, [F4] floor px-only ✅, [F5] order canvas ✅ (`drawRoomStrip`)

## newRoomProject
- **Purpose:** Creates a 360-room project from the setup cfg: a single `'room'` walls sequence whose canvas is `stripW × (stripH + floorH)` — **[R221]** the floor is no longer a second `'flat'` sequence; `createRoomSequences` folds it into this one canvas via `roomFloorH`.
- **Location:** app.js · **[R228] `newRoomProject(cfg,skipConfirm)`** (~L8435). **[R227]** devuelve `true`/`false` (false = `confirmDiscard` canceló) y ya no lanza el recorrido guiado; **[R228]** `skipConfirm` = consentimiento de descarte del launcher (`lchConsent()`).
- **State/data:** sets `state.seqMode='room'`, `state.seqW/seqH` = the full canvas; `room={walls,floorSeqId:null,floor,stripH}`
- **Key symbols:** strip layout `w.x0/w.x1` by native pixels (`layoutWallStrip`); `newSeqMedia(...,'room')`; opens all seq media, active=walls seq.
- **Invariants / gotchas:** cm (wcm/hcm) are geometry-only (3D wall placement); the 2D strip is exact pixelage. `clearAllUndo()` after (undo belongs to previous project). **[R221]** no more pan/zoom compensation for a "dock outside the canvas" — the default letterbox (`pan=[0,0], zoom=0.92`) already centers the whole canvas since the floor is inside it now.
- **Status:** ✅
- **Roadmap:** —

## Room export — Full strip / Strip+floor / Each wall+floor [R221]
- **Purpose:** Room export offers 3 modes in `#exRoomMode`: **Full strip** (walls only, crop `y<room.stripH`) · **Strip + floor** (2 files) · **Each wall + floor** (N+1 files) — the last two only offered when `room.floor` exists.
- **Location:** app.js · export dialog room row (~L6617); `queueJob`/`addFloorJob` (~L6905); `runExport` wall params (`opt.wall`); `renderExportFrame` crop (~L5631)
- **State/data:** job `opt.wall={x0,x1,y0,y1,pxW,pxH,stripW,stripH,role?,kind?}` — **[R221]** generalized with `y0/y1` (strip-space vertical crop range; defaults to `[0,pxH]` for plain per-wall jobs, unchanged behaviour) so the SAME mechanism crops a per-wall rect, the walls-only strip (`kind:'strip'`), or the floor's dock rect (`kind:'floor'`, scaled to `room.floor.pxW×pxH`). `S.roomMode` ∈ `strip|stripfloor|walls`.
- **Key symbols:** `addFloorJob()` builds the floor's crop descriptor from the Front wall's x-span + `[room.stripH, seq.h]`. No more `opt.seqId`/`switchSeq` dance for the floor — it's the SAME active sequence, just a different crop.
- **Invariants / gotchas:** `exPx(S)` returns the walls-only height (`room.stripH`) for the "match source" size when the room has a floor and mode isn't `walls` — otherwise the estimate/monitor/codec-probe would overstate the primary job's size using the taller merged canvas. Per-wall label = ROLE · pxW×pxH.
- **Status:** ✅
- **Roadmap:** [R1] render in-place flexibility, [D2] queued encoder snapshot

---

# (B) COMPOSE / NEST

## Sequences as nest media — newSeqMedia / activeSeq / loadSeqIntoState / saveActiveSeq
- **Purpose:** Sequences ARE media of `kind:'nest'` (Premiere-style tabs). One is active; its clips/lanes/markers alias into `state.*`. Switching saves the old, loads the new.
- **Location:** app.js · `newSeqMedia` (~L8516), `activeSeq` (~L8513), `ensureSequences` (~L8518), `saveActiveSeq` (~L8524), `loadSeqIntoState` (~L8540), `switchSeq` (~L8577), `openSeq` (~L8576), `closeSeqTab` (~L8582), `deleteSequenceMedia` (~L8588), `renderSeqBar` (~L9128); **[R239]** `tlScrollT`/`setTlScrollT` (~L8515)
- **State/data:** `state.openSeqs[]`, `state.activeSeqId`, per-seq `nestClips/nestLanes/nestMarkers/nestGroups/nestPlayhead/nestScrollT/nestWorkIn/nestWorkOut`, `m.mode`, `m.cov`, `m.w/m.h/m.fps`
- **Key symbols:** `isSeqMedia`, per-sequence undo stacks (`_undoBySeq`, `_ustk` L5418) survive switch. `state.clips` is a live ALIAS of `activeSeq().nestClips` — must be re-healed after filters (L4951, L5427).
- **Invariants / gotchas:** `loadSeqIntoState` also sets seqMode/seqW/seqH/seqCov, resets selection, invalidates render-ahead, and calls `updModeUI`. Audio lane force-added on real timelines (not on comps, L4927). Cycle guard prevents nesting a seq inside itself (L1805/5775). **[R239] el ENCUADRE horizontal es de la secuencia (`nestScrollT`, en SEGUNDOS).** El cabezal ya viajaba (`nestPlayhead`) pero el scroll vive en el DOM (`#tlscroll.scrollLeft`) y no lo tocaba nadie: entrar a un nido creado en el minuto 55 dejaba la vista clavada allí con el contenido —que siempre empieza en 0— fuera de pantalla (medido: cabezal 0 correcto, scroll 27 788 px, primer clip invisible). Se guarda en segundos porque `pxPerSec` es global a la app, no de la secuencia. **`setTlScrollT` tiene que correr DESPUÉS de `renderTimeline`** y usa el truco de `_scrollTarget` (ensanchar el contenido antes de fijar `scrollLeft`, si no se clampa contra el ancho viejo) — mismo patrón que `followPlayhead`/`tlZoomAt`. **[R239b] Va en los OCHO caminos que aterrizan en una secuencia distinta**, no sólo en los obvios: `switchSeq`, `closeSeqTab`, `loadProject`, `newProject`, `newSequenceDialog` (+ su variante de sala), `deleteSequenceMedia` y `newRoomProject`. Los cuatro últimos se olvidaron en R239 y reproducían el mismo defecto — crear una secuencia desde el minuto 55 la abría vacía y encuadrada allí. Regla: **secuencia NUEVA → `setTlScrollT(0)`; aterrizar en una EXISTENTE → su `nestScrollT`.**
- **Status:** ✅
- **Roadmap:** [R3] sequences reorderable (seq bar)

## nestSelection / makeClipUnique
- **Purpose:** `nestSelection` wraps selected clips into a new nest sequence (inherits flat/dome compositing mode). `makeClipUnique` deep-copies a nest/comp media so an instance can be edited independently.
- **Location:** app.js · `nestSelection()` (~L783), `makeClipUnique(c)` (~L5846)
- **State/data:** new nest via `newSeqMedia(..., isFlat()?'flat':'dome')` (L791); unique copy re-uids clips + comp, rebuilds masks
- **Key symbols:** [R92-T1 C4] nest inherits compositing mode (room content nests flat — the strip IS rectangular). `serMedia` deep-copy drops live GL fields.
- **Invariants / gotchas:** Only sequences/compositions can be made unique. `makeClipUnique` rebuilds `maskTex` from `maskData`/`penMasks` (L5854). **[R228]** `nestSelection` (igual que `addClip`) sale ANTES de su suite de renders cuando `_demoBatch` está encendida — el estado ya está mutado y el nido seleccionado; repinta `_demoFinish` (ver *Recorrido guiado + proyectos demo*).
- **Status:** ✅
- **Roadmap:** —

## Dome master / Patch toggle (nest clips in a dome sequence) — [R216]
- **Purpose:** A nest clip in a dome sequence is created with `c.props.fulldome=true` (drawn 1:1 as a fisheye master via `PFD`, Size zooms the whole thing around the zenith — [N1]); flipping it to Patch (`fulldome=false`) draws the SAME clip through the normal gnomonic path (`PW`, az/el/size place it like any other clip). Previously there was no UI for this — only the generic "Fulldome src" switch, worded for imported fisheye footage, not nest semantics.
- **Location:** app.js · `_renderInspectorMain`, Source section, `if(isSeqMedia(m)){…}` branch (~L4001) — segmented `.seg2#domeModeSeg` (same visual pattern as `#txtAlign`), replaces the generic `fdrow`/`fdToggle` switch for nest media only (non-nest clips still get the generic switch, unchanged). Engine branch it toggles: `drawClip` (~L835) `if(c.props.fulldome){…PFD fulldome…} else {…PW gnomonic patch…}`.
- **State/data:** same prop as the generic toggle, `c.props.fulldome` (true=master, false=patch); setting master also clears `c.props.equirect` (mutually exclusive, same rule as the generic switch).
- **Invariants / gotchas:** `az` keeps acting as spin in master mode and as azimuth in patch mode — untouched, pre-existing semantics. Hint text under the segment shows only the active mode's explanation.
- **Status:** ✅ verified in the running app (CDP): toggle flips `c.props.fulldome`, inspector repaints with the right button + hint, and the canvas genuinely renders a different projection in each mode (compared master vs. patch screenshots at the same Size — different footprint on the dome, not just a UI flag).
- **Roadmap:** —

## Compose media — m.comp / createComposition / regenComposeNest / openCompose
- **Purpose:** A composition is a nest whose inner clips are generated from stored params `m.comp` (`g`). `createComposition` builds it; `regenComposeNest` rebuilds inner clips live from params (inspector/Recompose dialog); `openCompose` is the create/edit dialog.
- **Location:** app.js · `createComposition(opts)` (~L6086), `regenComposeNest(m)` (~L6112), `openCompose(...)` (~L6166), inspector quick-row (L2797–2813), `regenComp` (group variant, L6065)
- **State/data:** `m.comp = g` {id,kind,mediaIds/mediaId,count,spin,el,size,arc,cols,elMin/elMax,turns,tile,band,rings,segs,gap*,brick,shuffle,order,jitter,rand,mask,noWarp,infinite,scroll,scopeInP,scopeSpeed}
- **Key symbols:** `compMode=flat?state.seqMode:'dome'`; nest clip carries `c.slot`, `c._layBase` (layout baseline). Media assignment `compMediaIndex`/`ensureCompOrder` (shuffle). Top nest clip gets `props.fulldome=true` in dome.
- **Invariants / gotchas:** `regenComposeNest` reuses existing inner clips by slot to preserve manual tweaks + keyframes; `raInvalidate()` + `loadSeqIntoState` if active. Cut in-point persisted on `g.scopeInP` (R88).
- **Status:** ✅
- **Roadmap:** [N1] compose behaves as clip (scale/rotate), [N2] live inspector edits, [N3] remove mask ✅ (R122)

## Layout generators — compLayout / compLayoutFlat / compElProps
- **Purpose:** `compLayout` = dome placements (az/el/size) per kind: ring, grid, spiral, phyllo, wave, fib, domegrid (tiled sectors), line, random. `compLayoutFlat` = flat/room x/y/scale for grid/row/col/random. `compElProps` converts a layout point to clip props (dome vs flat/room; sector warp for tiles).
- **Location:** app.js · `compLayoutFlat(g)` (~L6011), `compLayout(g)` (~L6023), `compElProps(g,p)` (~L6053), `ensureRand` (L6022)
- **State/data:** `FLAT_COMP_KINDS=['grid','row','col','random']` (L6009); dome kinds list at L6171
- **Key symbols:** `g.jitter` randomize overlay (any structured mode except tiled/random, L6046); `p._secAz/_secEl` per-element annular spans (domegrid); `pr.warp='dome'` for tiled sectors; `g.noWarp` → [N5] flat undeformed tiles.
- **Invariants / gotchas:** Dome-tile centers kept EXACT (no rounding) so adjacent sectors tile seamlessly. `!g.tile` guard so jitter doesn't open mosaic seams.
- **Status:** ✅
- **Roadmap:** [N5] Dome Fill randomize + non-warped rings ✅ (`g.jitter`, `g.noWarp`)

## _layBase (relative deltas) — [N4]
- **Purpose:** Each composed inner clip stores `_layBase` = the layout baseline it was generated from. On recompose, the user's manual delta (`ex.props[k]-base[k]`) is preserved and re-applied relative to the new layout, so hand-tweaked clips don't snap back to 0.
- **Location:** app.js · set at L6098 (create) & L6123/6124 (regen); applied at L6119–6122
- **State/data:** `c._layBase` (copy of `layP`), numeric positional props only; mask (string) left as user set; warp/secAz/secEl are layout-controlled (follow layout, e.g. Flat tiles removes them).
- **Key symbols:** delta `d = ex.props[k]-base[k]`; `ex.props[k]=layP[k]+d`.
- **Invariants / gotchas:** Only reused when `ex.mediaId===src.id` for that slot; otherwise a fresh clip is made.
- **Status:** ✅
- **Roadmap:** [N4] relative changes inside nest ✅

## Compose preview + Ring/Grid/Random + Dome Fill UI
- **Purpose:** `drawComposePreview` renders the dome-disc (or flat-frame) schematic of a composition. `openCompose` dialog exposes layout kinds, count, dome-fill (domegrid: rings/segs/gaps/brick/shuffle/**flat tile**), tile, jitter randomize row [N5].
- **[R202 · tanda 5] «Flat tile» en la configuración del relleno de domo (`#cNoWarp`).** El modo existía desde [N5] (`g.noWarp`) pero **sólo se alcanzaba desde el inspector de una composición ya creada**: al crearla no había forma de pedirlo. Ahora está en el diálogo, entra en `readForm` (vista previa) y en los `opts` de Crear/Aplicar, y se rellena desde `pre.noWarp` al reabrir.
  - **La vista previa tenía que enterarse:** dibujaba sectores curvados para `domegrid` pasara lo que pasara, así que mentía justo en la opción que se estaba eligiendo. La condición pasa a `(g.tile||g.kind==='domegrid') && !g.noWarp`.
  - **Qué hace en el domo:** cada baldosa se coloca SIN estirarse hasta llenar su celda, así que conserva su proporción real; lo que la curva es la propia proyección del ojo de pez. El efecto es el del anillo repetido hacia arriba y hacia abajo. Medido: con sectores el disco queda cubierto al 100% hasta el borde; con baldosas, el anillo exterior baja al 12,7%.
  - **Gotcha al medir:** lo que decide la deformación es **sólo** `c.props.warp==='dome'` (uniforme `LW.sector`, L844). `warp:'patch'` es el modo sin deformar y `secAz/secEl` quedan de relleno **sin efecto** — mirarlos también marca como deformados clips que no lo están.
- **Location:** app.js · `drawComposePreview(g,canvas)` (~L6129); `openCompose` dialog markup L6172+; sync/preview L6214–6242
- **State/data:** `#cKind`, `#cN`, `#cRings/#cSegs/#cGapEl/#cGapAz/#cBrick`, `#cShuffle/#cReshuffle`, `#cJit`/`#cRandomize` (jitter row), `#cInfinite` (room wrap)
- **Key symbols:** `kindES`, `cap`; Dome Fill defaults el 0→90 (whole dome, no central hole, L6227).
- **Invariants / gotchas:** Flat/room comps hide dome params, relabel Size→Scale (%), show Infinite only in room.
- **Status:** ✅
- **Roadmap:** [N2] inspector params match compose type

## makeAdjustClip (adjustment layers)
- **Purpose:** Creates a media-less adjustment clip (`adjust:true`, no mediaId) that applies its `fx` to layers beneath it.
- **Location:** app.js · `makeAdjustClip(lane,start,dur)` (~L6787); inserted at L6795 & L1809
- **State/data:** `{adjust:true,mediaId:null,props:{opacity:100},kf:{},fx:[]}`
- **Key symbols:** color `#B4BAC1`. El dibujado es `drawAdjustment(c,t,xf)` (~L11340): fotografía el composite de debajo → `applyChain` → mezcla de vuelta con `PMIX`.
- **Invariants / gotchas:** **[R237]** El destino es la TEXTURA (`_compTgtW/_compTgtH`), no el viewport — con el máster de relleno el viewport está expandido y desplazado. La cadena de FX se queda CUADRADA y con el letterbox de siempre (así un desenfoque sigue siendo isótropo sobre el lienzo; estirar una tira de 7,9:1 al cuadrado lo dejaría ocho veces más ancho que alto), y `PMIX` estrena `u_uvsc`/`u_uvof` para muestrear esa banda. Sin relleno (export, nest) los uniformes valen (1,1)/(0,0) y el camino es idéntico al anterior. Tope `ADJ_MAX=8192` en el lado del cuadrado: sin él, una sala de 4 muros 4K pediría 2,8 GB entre instantánea y RT de la cadena.
- **Status:** ✅
- **Roadmap:** —

---

# (C) FORMATS

## Sequence-creation dialogs — roomSetupDialog (domeSetupDialog / flatResDialog ARCHIVADOS)
- **Purpose:** **[R227]** Los formatos ya NO se configuran en diálogos modales sueltos: el **launcher** (pantalla de inicio) los configura los tres juntos, con vista previa en vivo del `render()` real. Sólo sobrevive el de la sala, que además del alta hace la RE-configuración de geometría.
- **Location:** app.js · `roomSetupDialog(cb)` (~L7343) — Project → «Room geometry…» (→ `applyRoomGeometry`, que NO crea proyecto) y el alta de sala. `drawSeqViz(cv,kind,o)`/`DOME_COV=[180,200,210,220]` siguen vivos, los usa el visor del launcher.
- **State/data:** room cb → `{walls,fps,floor}`; el equivalente de domo/2D vive ahora en `_lch` (`domeRes/domeCov/flatW/flatH/fps`) → `lchCreate`.
- **Archivado (R227, ADR-0007):** `flatResDialog(cb)` y `domeSetupDialog(cb)` → **`_backup/deprecated/20260730-creation-dialogs-file-menu.js`** (junto a `MENU_ROOM_LABEL()`), fila en `_backup/deprecated/README.md`. Se quedaron sin llamantes al pasar el menú File de TRES entradas de proyecto nuevo a UNA (`New project…` → launcher).
- **Invariants / gotchas:** Dome always square. Coverage = fisheye FOV; wider pulls horizon inward. **⚠️ El segmento «Resolution» de domo del launcher NO se aplica:** `newProject` fija `seqW/seqH=4096` para domo pase lo que pase (ver ficha `newProject`) — el máster de domo es siempre 4096². Si se quiere que el control mande, hay que tocar `newProject`.
- **Status:** ✅ (`roomSetupDialog`) · 🗑️→archivados los otros dos
- **Roadmap:** [F1] unified project-config panel (partly `openSeqSettings`)

## newProject
- **Purpose:** Resets all state and creates a fresh dome or flat project. Disposes media/GL, sets seqMode/seqW/seqH/seqCov, then `ensureSequences()`.
- **Location:** app.js · **[R228] `newProject(mode,w,h,fps,cov,skipConfirm)`** (~L8374); `ensureSequences`
- **State/data:** flat → seqW/H = w/h (def 1920×1080), **dome → 4096² SIEMPRE** (el `w`/`h` que le pasa el launcher se ignora en domo), seqCov=cov||180
- **Key symbols:** `disposeAllVinst`, `disposeMedia`, `clearFrameCache`, `clearAllUndo`, `defLanes`
- **Invariants / gotchas:** `clearAllUndo()` mandatory (undo belongs to previous project). `confirmDiscard(skipConfirm)` gate first — **[R228]** `skipConfirm` es el consentimiento de descarte que trae la sesión del launcher (`lchConsent()`), pasado explícito en vez de la bandera global de R227. Devuelve `true`/`false` (**[R227]**: `false` = `confirmDiscard` canceló) y quien llama TIENE que mirarlo o toca el proyecto ANTERIOR.
- **Status:** ✅
- **Roadmap:** —

## Editable resolution / coverage — openSeqSettings / applyRes
- **Purpose:** Re-configure the ACTIVE sequence after creation. Dome: resolution + coverage (both live, re-deform every clip). Flat: editable W×H (live re-adapt). Room: read-only (resolution comes from walls).
- **Location:** app.js · `openSeqSettings()` (~L5200); inner `applyRes(w,h)` (~L5214); reached from `#fmtChip` click (L5617) and seq-tab menu (L5227)
- **State/data:** mutates `as.w/as.h/as.cov`; mirrors to `state.seqW/seqH/seqCov` when active; `markDirty`, `raInvalidate`, `render`, `updFmtChip`
- **Key symbols:** `#ssRes` (dome square), `#ssW/#ssH` (flat), `#ssCov`; clamps 128–8192
- **Invariants / gotchas:** [F1] resolution is output/export size; clips placed proportionally (no rebuild). Coverage change is a live retarget (finished dome film → 200/210°).
- **Status:** ✅
- **Roadmap:** [F1] single setup panel

## Dome coverage source of truth — seqCov / curCovDeg
- **Purpose:** Single source `state.seqCov` (per-active) + `seq.cov` (persisted per sequence) drives the fisheye warp, inverse, 2D guides, and 3D dome mesh. `rho = zenithAngle / covHalf`.
- **Location:** app.js · `state.seqCov` init L85; `curCovDeg()` (~L631) HALF-angle; coverage rings drawn in `drawGrid2D` (L1180–1182); `DOME_COV` (L4955)
- **State/data:** `seq.cov` (only dome mode; null for flat/room in `newSeqMedia` L4917)
- **Key symbols:** `curCovHalf`, `buildDomeMesh(curCovHalf())` (L935), warp uniform `u_covHalf`
- **Invariants / gotchas:** loadSeqIntoState sets `state.seqCov=s.cov||180`. See memory note dome-coverage-r114 (four coupled points).
- **Status:** ✅
- **Roadmap:** —

## updFmtChip / updModeUI
- **Purpose:** `updFmtChip` refreshes the format chip text (dims + coverage + fps + codec, "Room ·" prefix). `updModeUI` adapts view-mode buttons & readouts per mode (3D Room vs 3D Preview vs hidden for flat; Dome Master vs 2D Master; horizon-fade dome-only).
- **Location:** app.js · `updFmtChip()` (~L5196); `updModeUI()` (~L4929, called from loadSeqIntoState & relabel L6279)
- **State/data:** `activeSeq().mode/w/h/cov/fps`, `fc._codec`, `#viewModeSeg`, `#dispSeg`, `#azelReadout`
- **Key symbols:** `flatLikeMode`; flat (non-room) forces `view.mode='2d'` (no 3D) at L4934
- **Invariants / gotchas:** Chip covers dome coverage only when ≠180. Room has a real 3D view (assembled walls); plain flat does not. **[R154] Los botones de modo se rotulan "2D"/"3D" a secas** (RevDomo:137-138) y el nombre largo (Dome master / 2D master / 3D preview / 3D room) va al **tooltip**, que pone `updModeUI`. `applyLang` ya no reescribe esas etiquetas: llama a `updModeUI()`. **[R149 · auditoría §3] ORDEN DE LA BARRA DEL VISOR — no reordenar:** el clúster izquierdo es `#viewModeSeg` · `#dispSeg` · `#qualitySeg` · `#proxyToggle` · **`#d3sep`+`#threeModeSeg`(+`#roomOutBtn`, insertado por JS tras el seg)** y recién ahí el `flex:1`. El grupo de cámara 3D va ÚLTIMO a propósito (prototipo RevDomo:154-158): puesto antes, al entrar en 3D empujaba overlays y calidad +151px. Todo lo que aparezca/desaparezca por modo tiene que colgar del final del clúster o del lado derecho.
- **Status:** ✅
- **Roadmap:** [F2] layout consistency across modes (pending, Ticket #52)


---

## 8 · Shell, media & UI chrome (detalle)

# 80 — App shell, media panel, project I/O & UI chrome

Subsystem map. Line numbers verified against `app.js` (6992 L), `main.js` (233 L), `preload.js` (99 L), `index.html` (929 L) as of this pass.

Bootstrap constants (app.js): `HAS_WC` (~L1259) = WebCodecs + Mp4Muxer present; `DSP=window.dsp||null` and `IS_ELEC=!!(DSP&&DSP.isElectron)` (~L1261). Init runs bottom of file: `init()` (~L6971) → `init();` (~L6992).

---

# main.js

## Electron main / BrowserWindow
- **Purpose:** Creates the single 1600×980 app window (`#0E0F11`, menu auto-hidden, `show:false` until ready-to-show), loads `index.html`, wires the crash/hang lifelines and the close guard.
- **Location:** main.js · `createWindow()` (L43-100)
- **State/data:** module globals `win`, `forceClose`, `pendingOpenPath`, `uiDirty`, `uiLang`.
- **Key symbols:** webPreferences: `preload`, `contextIsolation:true`, `nodeIntegration:false`, `sandbox:false`, `webgl:true`, `backgroundThrottling:false`. `win.removeMenu()`. `render-process-gone`→reload after warning (L80), `unresponsive`→offer reload (L85), `close`→`dsp:confirmClose` unless `forceClose||!uiDirty` (L90).
- **Invariants / gotchas:** backgroundThrottling:false is deliberate (NDI/viewer keep rendering unfocused). A crashed renderer reloads instead of killing the session; disk autosave (15s) recovers work.
- **Status:** ✅
- **Roadmap:** —

## GPU / RTX forcing
- **Purpose:** Prefers the discrete NVIDIA GPU on hybrid laptops WITHOUT the Chromium flags that black out the 3D view.
- **Location:** main.js · `preferHighPerfGPU()` (L12-14, called L14); commandLine switches (L22-30).
- **Key symbols:** registry `HKCU\...\DirectX\UserGpuPreferences` `GpuPreference=2;` per exe. Switches: `enable-accelerated-video-decode`, `enable-features=SharedArrayBuffer` (NDI zero-copy), `disable-features=CalculateNativeWinOcclusion` (R92-T3: occluded window stops rAF → kills NDI).
- **Invariants / gotchas:** NEVER add ignore-gpu-blocklist / zero-copy → selects non-compositing GPU → 3D black. Only feature/scheduling flags are safe.
- **Status:** ✅
- **Roadmap:** —

## Single-instance + file association
- **Purpose:** Second launch (e.g. double-click `.isp`) reuses the existing window and hands it the path; supplies the double-clicked path on first launch.
- **Location:** main.js · `requestSingleInstanceLock()` (L103), `second-instance` (L106), `open-file` macOS (L107), `rdomeFromArgv()` (L36), `did-finish-load`→`dsp:openPath` (L99).
- **Key symbols:** accepts `.isp|.ise|.rdome` (regex L36). Renderer receives via `dsp:openPath`.
- **Invariants / gotchas:** the `.isp` double-click association is registered by the NSIS installer, NOT the asar → only updates on reinstall.
- **Status:** ✅
- **Roadmap:** —

## IPC handlers — dialogs, disk IO, metrics
- **Purpose:** All native dialogs, filesystem read/write, random-access file streaming, taskbar progress, and live CPU/RAM/GPU meters exposed to the renderer.
- **Location:** main.js L114-232.
- **Key symbols:** dialogs `dsp:saveDialog` (L117, filters isp/ise/rdome), `dsp:saveFile` (L125), `dsp:openDialog` (L134, +json), `dsp:pickMedia` (L143), `dsp:chooseExportDir` (L152), `dsp:pickFile` (L156, generic e.g. .cube). Atomic text write `dsp:writeText` (L193: tmp→fsync→rename). `dsp:readText` (L189), `dsp:stat`/`dsp:listDir`/`dsp:deleteFile`/`dsp:rename`/`dsp:exists` (L209-213). Streaming fd map `_fds` : write path `dsp:fileOpen/fileWriteAt/fileClose` (L177-179), read path `dsp:openRead/readAt/closeRead` (L182-184, 256MB cap, `Buffer.alloc`). Persistent dirs `dsp:proxyDir` (L174), `dsp:autosaveDir` (L176). `dsp:revealPath` (L175), `dsp:setTitle` (L214), `dsp:setProgress` (L215), `dsp:forceClose` (L216), `dsp:setUiState` (L114), `dsp:diagWrite/diagPath` (L187-188). Metrics `dsp:metrics` (L228) via `app.getAppMetrics()` + `queryGPU()` nvidia-smi cached (L220).
- **Invariants / gotchas:** writeText is atomic (rename) so a torn write can never leave a truncated `.isp`; falls back to direct write across weird mounts. readAt uses `Buffer.alloc` (not allocUnsafe → would leak pooled memory over IPC). nvidia-smi self-disables on ENOENT (`_nvOff`).
- **Status:** ✅
- **Roadmap:** —

---

# preload.js

## DSP bridge (contextBridge `window.dsp`)
- **Purpose:** The secure renderer↔main API surface (contextIsolation ON). Wraps every IPC channel plus path helpers and the native addon wrappers.
- **Location:** preload.js · `contextBridge.exposeInMainWorld('dsp', {...})` (L48-98).
- **Key symbols:** `isElectron:true`; `getPathForFile(file)` (webUtils, replaces removed `File.path`, L51); dialogs/IO 1:1 with main handlers; `onOpenPath(cb)` (L68, `dsp:openPath`), `onConfirmClose(cb)` (L69), `forceClose()` (L70); `basename(p)` (L90), `toFileURL(p)` (L91, backslash→slash + encodeURI). Sub-namespaces `ndi` (L87) and `spout` (L88).
- **Invariants / gotchas:** the JS side reads absolute paths via `getPathForFile` — Electron ≥32 removed `File.path`.
- **Status:** ✅
- **Roadmap:** —

## Native NDI wrapper (`ndiApi`)
- **Purpose:** Wraps the `dsp-ndi-send` native addon for NDI output AND input; loaded in preload (has Node access) so WebGL readback frames go straight to the addon without per-frame main-process IPC.
- **Location:** preload.js · `_ndi=require('dsp-ndi-send')` (L7), `ndiApi` (L8-35). Addon source `native/ndi-send` (copied to `node_modules/dsp-ndi-send`).
- **Key symbols:** out: `available/runtimeUrl/loadError/start/send/connections/stop/probe`. in: `findSources/recvOpen/recvRead/recvClose/recvCloseAll`. `send(u8,w,h,flipY)` wraps as Node Buffer no-copy; `recvRead(name,lastGen,dst)` uses a SharedArrayBuffer-backed dst for zero per-frame clones.
- **Invariants / gotchas:** if `dst.buffer` is NOT a real SharedArrayBuffer it falls back to data-copy mode (a plain clone would fill the wrong buffer → black frames). Editing the `.cc` requires re-copying `native/ndi-send`→`node_modules/dsp-ndi-send` before `npm run dist`.
- **Status:** ✅
- **Roadmap:** —

## Native Spout wrapper (`spoutApi`)
- **Purpose:** Wraps `dsp-spout-send` (DirectX SpoutDX) — same-machine GPU-texture share, local alternative to NDI.
- **Location:** preload.js · `_spout=require('dsp-spout-send')` (L39), `spoutApi` (L40-46). Addon source `native/spout-send`.
- **Key symbols:** `available/loadError/start/send/stop`. `send(u8,w,h,flipY)`.
- **Invariants / gotchas:** the `.node` lives in `app.asar.unpacked` → deploy must copy that folder too, not only `app.asar` (memory: spout-send R111).
- **Status:** ✅
- **Roadmap:** —

## NDI / Spout OUTPUT wiring (renderer)
- **Purpose:** Broadcasts the clean fulldome master (square 1:1, no grid/overlays) at 2048 or 4096; composites into an offscreen FBO, reads pixels, sends with flipY.
- **Location:** app.js · NDI `startNDI` (L1028), `ndiTick` (L1019), `ensureNdiFBO` (L1011), `stopNDI` (L1034), `ndiMenu` (L1035), `ndiAvailable` (L1010). Spout `startSpout` (L1064), `spoutTick` (L1055), `stopSpout` (L1070), `spoutMenu` (L1071), `spoutAvailable` (L1046). **[R148 · Rev1]** the standalone `#ndiBtn`/`#spoutBtn` buttons were removed — both are now entries of the **Output dropdown** (`#outputBtn`, ~L5770, alongside Full performance and Viewer window); `refreshOutputInd()` (~L5769) lights `#outputBtn.on` with a pulsing dot while either is broadcasting.
- **State/data:** `_ndiOn,_ndiRes,_ndiFps,_ndiTimer,_ndiFBO,_ndiTex,_ndiBuf` (L1009); Spout equivalents (L1045).
- **Key symbols:** ticks on `setInterval` at fps; `composite(playhead,res,true)` opaque surround; `DSP.ndi.send(buf,res,res,true)`.
- **Invariants / gotchas:** always the dome master regardless of `state.view.mode` (saves/restores `_drawFlat`,`_compAspect`). 4096 forced to 30fps.
- **Status:** ✅
- **Roadmap:** —

## NDI INPUT as a media source
- **Purpose:** A `kind:'ndi'` media whose GL texture refreshes live from a received NDI stream; drag to timeline like any clip, always shows the current source frame.
- **Location:** app.js · `addNdiInput` (L1094), `makeNdiMedia` (L1089), `ndiUpload` (L1086), `ndiSourceLabel` (L1082), pump globals L1081. Menu entry in empty-media context menu (L5519).
- **Key symbols:** `DSP.ndi.recvOpen/findSources/recvRead`; `_ndiLive` flag drives the green dot in `makeMediaItem`.
- **Invariants / gotchas:** `ndiUpload` sets `UNPACK_FLIP_Y_WEBGL=false` (addon writes bottom-up; Chrome's flip re-copies the whole 4K frame on CPU ~27ms).
- **Status:** ✅
- **Roadmap:** —

---

# Media

## renderMedia()
- **Purpose:** Rebuilds `#mediaList` from `state.media`, honoring filter/search/group/folder mode and grid-vs-list view. The single re-render entry point for the media panel.
- **Location:** app.js · `renderMedia()` (L1628-1697); DOM: `#mediaList`, `#mediaCount`.
- **State/data:** reads `state.mediaFilter`, `state.mediaQuery`, `state.mediaView` ('grid'|'list'), `state.mediaGroupBy` ('none'|'folder'|'type'), `state.mediaFolder` (current nav folder), `state.selFolder`, `state.folders`, `state.folderColors`, `state.collapsedGroups`.
- **Key symbols:** empty state → drop zone (`#dropZone`+`wireDrop`); grid path builds `.mediagrid` with folder tiles + `makeMediaTile`; list path builds folder tree via nested `drawFolder(f,depth)` + `makeMediaItem`. Calls `updEnable()` first (keeps Compose/Adjust availability synced).
- **Invariants / gotchas:** folder header select is done IN PLACE (no re-render) so a mid-double-click element swap doesn't kill the dblclick. Both views SHARE `state.mediaFolder`.
- **Status:** ✅
- **Roadmap:** [M1] inline folder create, [M2] deselect on empty click — done.

## makeMediaItem() / makeMediaTile()
- **Purpose:** Build one media row (list) / square tile (grid) with thumb, duration/kind badge, proxy bar, dots, and drag / dblclick / context-menu wiring.
- **Location:** app.js · `makeMediaItem(m)` (L1698-1718), `makeMediaTile(m)` (L1759-1769).
- **State/data:** per-media `m.proxyReady`, `m.proxyPct`, `m._pxGen`, `m.missing`, `m._loading`, `m._ndiLive`/`m._spLive`, `m.thumb`, `m.color`, `m.folder`. · **[R319·R320] Spout no es NDI:** su bandera de «en vivo» es `_spLive` (el punto de la LISTA la leía de `_ndiLive` y se quedaba apagado —R319—) y su chapa de tipo dice `SPOUT` (en CUADRÍCULA decía `NDI` —R320—). El texto de al lado ya los distinguía desde [V3]: los dos gemelos se quedaron atrás.
- **Key symbols:** `[M3]` proxy/original label = `.mprx` span (L1708: `proxyReady?'proxy':'original'`). `[M4]` missing original → red inset shadow (L1701). dblclick: `openSeq` if nest else `addClip`. pointerdown → `selectMedia`+`startMediaDrag` (multi keeps selection). contextmenu → `openMediaCtx`.
- **Invariants / gotchas:** `reallyMissing = m.missing && !m._loading` — decoding (esp. audio) is not "missing". · **[R245] El menú del PANEL (`#mediaList` › contextmenu) tiene que excluir la clase del elemento, o lo tapa por burbujeo.** Su guard nombra `.mitem,.mtile,.folderhdr,.folderdrop`: faltaba `.mtile` y en vista de CUADRÍCULA el clic-derecho sobre un clip acababa enseñando «Importar medios / Nueva carpeta» en vez de las opciones del medio. Los tiles de carpeta se libraban porque llevan además `folderhdr`. **Si algún día se añade otro tipo de ficha al panel, hay que sumar su clase a ese `closest`.**
- **Status:** ✅
- **Roadmap:** [M3]/[M4] done.

## Media context menu / properties
- **Purpose:** Shared right-click menu for rows and tiles (add, rename, properties, reveal, proxy gen, replace, locate, move-to-folder, delete) + the read-only Properties dialog.
- **Location:** app.js · `openMediaCtx(e,m)` (~L2792), `mediaProperties(m)` (~L2775), `fmtBytes`.
- **Key symbols:** compose entry (~L2794); manual proxy generation `enqProxy` over the (shift-)selection; `replaceMedia`; `Locate file…`→`DSP.pickMedia`+`reloadMedia`; move-to-folder via `moveMediaTo`; `deleteMedia`.
- **Invariants / gotchas:** proxies are MANUAL (project convention) — no auto-generation. **[R239] «Create composition» sale también con UN SOLO medio.** Una composición en anillo/cuadrícula repite la MISMA fuente en N sitios, así que con uno basta —y es el caso más común, un clip multiplicado por el domo—; el mínimo de dos venía del camino de multi-selección de [R88], no del compositor (`checkedIds()` ya devolvía un solo id sin quejarse). Cuando hay varios seleccionados y el clic cae sobre uno de ellos, manda la selección. Las dos vistas (lista y cuadrícula) llaman a este mismo menú, así que el cambio cubre ambas.
- **Status:** ✅
- **Roadmap:** —

## Media selection
- **Purpose:** Single / shift-range / ctrl-toggle multi-selection with an anchor; deselect on empty-space click; takes Delete priority over timeline clip selection.
- **Location:** app.js · `selectedMediaIds` (L1771), `selectMedia(id,e)` (L1774), `paintMediaSel` (L1772), `orderedMediaIds` (L1773), `clearMediaSel` (L1781), `renameMediaInline` (L1785), `deleteMedia` (L1787). Empty-space deselect wired L5529.
- **State/data:** `state.selMediaId`, `state.selMediaIds[]`, `state.selMediaAnchor`, `state.selFolder`.
- **Invariants / gotchas:** `[M2]` clicking empty media space clears selection; touching timeline/viewport also drops `selFolder` so Delete can't nuke a folder by surprise.
- **Status:** ✅
- **Roadmap:** [M2] done.

## Import (files, drag-drop, folders, sequences)
- **Purpose:** Turn dropped/picked files into media objects; detect numbered image batches as sequences; recreate dropped-folder trees; dedup re-drops.
- **Location:** app.js · `importFiles(files,folder)`, `importDropped(dt,baseFolder)`, `askSeqFps`, `wireDrop(el)` (~L9760), `_dropTargetAt(ev)` (~L2667). Wiring: `#fileInput.onchange`, `#importBtn`, `wireDrop($('#mediaList'))`+`$('#stage')`, empty-area menu.
- **State/data:** dedup by absolute path or name+size; `_importFolder` transient target; `state.folders` gets subfolders from dropped dirs.
- **Key symbols:** dispatch to `addVideo`/`addImage`/`addAudio`/`addSequence`; `#fileInput` (hidden input), `#dropZone`.
- **Invariants / gotchas:** import target folder is passed explicitly (never inherits the previous import's folder — stale bug fix). ≥3 numbered images = a sequence; asks fps once per batch. **[R239] `_dropTargetAt(ev,sinMedios)` es la ÚNICA puerta que resuelve la carpeta de destino**, y ahora acepta también un `.mitem`: soltar sobre un medio cuenta como soltar en SU carpeta. Con el árbol desplegado la cabecera es una franja de 20 px entre decenas de filas, y fallar mandaba el archivo a «Sin archivar» en silencio. La lógica ya estaba escrita (`folderAt`, dentro de `startMediaDrag`) pero **no la llamaba nadie**; al subirla aquí quedan arreglados de una vez el arrastre interno y el de archivos del sistema. `wireDrop` estrena además el resalte en `dragover` (antes sólo lo tenía el arrastre interno, así que los archivos de fuera se soltaban a ciegas) y `_clearDropFX` incluye `.mitem`. **⚠️ [R239b] La función la comparte el arrastre de CARPETAS (`startFolderDrag`), que pasa `sinMedios=true`**: sin esa puerta, soltar una carpeta sobre una fila de medio SIN ARCHIVAR devolvía `path:null` y `moveFolder` la sacaba al nivel superior en silencio — un gesto que antes era inocuo porque esas filas no eran destino de nada. **[R239b]** `startMediaDrag` usaba además un `clearFH` propio (copia recortada, sólo cabeceras) que dejaba la fila resaltada encendida el resto del arrastre; ahora es `_clearDropFX`.
- **Status:** ✅
- **Roadmap:** —

## Folders (state.folders)
- **Purpose:** Nested media folders (Adobe-like tree + grid navigation), inline create/rename, drag-to-file, per-folder color.
- **Location:** app.js · tree render inside `renderMedia` (`drawFolder`, L1663); `#newFolderBtn`, `newFolderIn`, `renameFolder`/`renameFolderInline`, `deleteFolder`, `moveFolder`, `showFolders`, `startFolderDrag`. `#groupSeg` toggle still wired.
- **[R148 · Rev1]:** `#newFolderBtn` and `#groupSeg` are **no longer visible** — the design's Media panel has no "New folder" button and replaces group-by with the Sort dropdown. Both survive as hidden nodes so their wiring (context menu → New folder; `state.mediaGroupBy`) keeps working without `if(el)` guards everywhere.
- **State/data:** `state.folders[]` (path strings, FSEP-joined), `state.folderColors{}`, `state.mediaFolder`, `state.selFolder`, `state.collapsedGroups`.
- **Invariants / gotchas:** deleting a folder keeps its media (unfiled). Colors are edited inline in the context menu swatch row.
- **Status:** ✅
- **Roadmap:** [M1] inline create — done.

## Media search
- **Purpose:** Live text filter of the media panel (`#mediaSearch`, debounced 150ms).
- **Location:** app.js L5500-5504; DOM: `#mediaSearch`, `#mediaSearchClr`.
- **State/data:** `state.mediaQuery` (consumed in `renderMedia` L1632).
- **Invariants / gotchas:** the filter existed in renderMedia before the input did (R92-T5 P1). **[R148 · Rev1]** the visible search box left the panel (design §2) and `#mediaSearchClr` no longer exists (wiring is `if(sc)`-guarded). **[R149 · auditoría]** `showMediaSearch(on)` is the single entry point: `Ctrl+F` un-collapses the media pane if needed, adds `.show` to `#mediaSearch` and hides BOTH `#filtSpacer` and `#filtSeg` so the field owns the row (~200px on a 292px panel); `Esc` (or blurring it empty) closes it and clears `state.mediaQuery`, so a filtered panel never survives with nothing on screen explaining it.
- **Status:** ✅
- **Roadmap:** —

---

# Project I/O

## Serialization (serProject / serMedia / serClip)
- **Purpose:** Build the JSON project object. v4 format: the active sequence's clips/markers/groups live inside their nest media, so top-level `clips/markers/groups` are kept empty to avoid doubling the heaviest data.
- **Location:** app.js · `serProject()` (L5230), `serMedia(m)` (L4903-4908), `serClip(c)` (L4910).
- **State/data:** header `{app:'DomeStudioPro', v:4, fps, lanes, media:[serMedia], folders, folderColors, tl:{...}, exportPresets, openSeqs, activeSeqId, seqW, seqH, reactive, autoItems}`.
- **Key symbols:** `serClip` deep-clones + strips live GL fields (`maskTex,_penCv,_elB,_szB,_curveTex,_curveDirty`); `_serLight` (L4909) also drops `maskData` PNGs for the localStorage autosave copy. `serMedia` carries nest sub-state (nestClips/nestLanes/nestMarkers/nestGroups/nestPlayhead/comp) + room/cov.
- **Invariants / gotchas:** `serProject` calls `saveActiveSeq()` first so the live `state.clips` alias is flushed into the active nest.
- **[R214] Vestigial fields removed from `serProject`:** `tl.audioH` — `loadProject` never read it back (leftover from R148). If you find another field like this, check `loadProject` before assuming it's load-bearing.
- **Status:** ✅
- **Roadmap:** —

## saveProject()
- **Purpose:** Serialize + write the `.isp` (atomic, with `.bak` rotation of the previous save); browser build downloads a Blob.
- **Location:** app.js · `saveProject(saveAs)` (L5231-5236); `saveIncremental()` (L5374, `_vNN.isp`).
- **Key symbols:** `DSP.saveDialog`→`DSP.writeText`; rotates `p+'.bak'` (L5233); on success `addRecent(p, projThumb())` + `clearLiveAutosaves()`. `currentPath`, `currentTitle()`, `state.dirty`.
- **[R214→R215] `purgeMediaTrash()` runs on the Electron success path only, AFTER the write is confirmed, in its own try/catch.** `state.mediaTrash` used to only ever be wiped wholesale (new/open/newRoomProject, which already discard all media anyway) — a media deleted from the panel mid-session stayed in the trash for the rest of it. R214's version had two bugs, both fixed in R215: it JSON.parsed every snapshot in every per-sequence undo/redo stack on **every** save (main-thread freeze on big projects), and its early-out (`if(!state.mediaTrash)`) never fired because the trash object always exists once created. R215: real early-out on an empty trash; ZERO `JSON.parse` (trashIds lives only inside each snapshot's JSON *string* — a regex pulls just that slice instead of parsing the whole tree); "referenced by a live clip" now reuses `clipsDelProyecto()`. Also moved OUT of `saveProject`'s write `try{}` (a purge failure must never surface as "Could not save") and removed from the web/download branch (`dlBlob` never confirms the file reached disk) — same reasoning newly applied to `saveIncremental`'s Electron branch, which now also purges post-success. The periodic autosave does not purge. See `purgeMediaTrash` (app.js, next to `undo`/`redo`).
- **Invariants / gotchas:** after a manual save the crash autosaves are dropped so a later open never falsely offers "restore a newer autosave". Save failure → styled alert suggesting Save As.
- **Status:** ✅
- **Roadmap:** —

## openProject / openProjectPath / loadProject
- **Purpose:** Open via dialog, via double-clicked path, and the shared loader that rebuilds `state` from a project object.
- **Location:** app.js · `openProject()` (L5238), `openProjectPath(p)` (L5241), `loadProject(obj)` (L5296-5334). Double-click wiring `DSP.onOpenPath(openProjectPath)` (L5576).
- **Key symbols:** `confirmDiscard()` (L5237) guards unsaved work; `maybeOfferAutosave(p,obj)` (L5385) offers recovery when the on-disk autosave is newer; `hideLanding()` first. loadProject rebuilds media as `missing/_loading`, re-renders text/shape/ndi/nest synchronously, recomputes `_id` counter, restores masks (`rebuildMaskTex`), version back-compat (v4 openSeqs / v3 sequences[] / v≤2 single timeline), then `reloadMedia(m)` for each. `showLoadingScreen`→`loadingWaitMedia` (20s deadline).
- **Invariants / gotchas:** `clearAllUndo()` in loadProject — undo history belongs to the previous project (Ctrl+Z must not inject old clips). Accepts `.isp/.ise/.rdome/.json`. · **[R319→R320] un `.isp` dañado no puede acabar pisando el proyecto bueno.** `loadProject` es un envoltorio con `try/finally` sobre `_loadProjectCore`: si revienta a mitad, siempre suelta el splash (`hideLoadingScreen`/`bootProyectoListo`) y lo deja anotado en el diagnóstico —cubre los SIETE llamadores, no sólo el del menú—. Y el `catch` de `openProject` deja **`currentPath=null`**, no la ruta anterior: como `saveProject` sólo abre diálogo cuando no hay ruta, reponerla permitía que un Ctrl+S posterior escribiera el estado a medias ENCIMA del proyecto bueno y sin preguntar.
- **Status:** ✅
- **Roadmap:** —

## reloadMedia / replaceMedia / adopt
- **Purpose:** Re-link a media object to its file on disk (image/video/audio/sequence), swap a file for another (offline→online), and relink a re-imported file to a missing slot.
- **Location:** app.js · `reloadMedia(m)` (L5335-5352), `replaceMedia(m)` (L5357), `adopt(m)` (L5369). `disposeMedia` (L5244).
- **Key symbols:** video re-attaches an existing on-disk proxy via `attachExistingProxy(m,true)` (R92-T6/R107); missing file → `m.missing=true`+`updRelink()`. `replaceMedia` keeps clips (referenced by id) and resets proxy/bands/thumb.
- **Invariants / gotchas:** replace requires same kind; adopt prefers name+size match, falls back to name-only.
- **Status:** ✅
- **Roadmap:** —

## Autosave / recovery / recents
- **Purpose:** Disk-first alternating autosave (never destroys the only good copy), emergency save on uncaught error, per-minute history snapshots, crash-recovery prompt, recovery history browser, and the recents list for the landing.
- **Location:** app.js · autosave interval (L5482-5492, 15s); `emergencySave()` (L5463, error/rejection handlers L5465-5466, throttled 5s); `autosaveBase`/`projAutosaveDir`/`autosaveBaseName` (L5470-5472); `clearLiveAutosaves` (L5474); `writeHistory`/`pruneHistory` (L5478-5481); `restoreAutosave` (L5377), `maybeOfferAutosave` (L5385), `openRecoveryHistory` (L5395). Recents: `getRecents` (L2086), `saveRecents` (L2087), `addRecent` (L2089), `projThumb` (L2088).
- **State/data:** files `<dir>\autosave\<projectFile>.autosave1/2` (+`.snap` snapshots); before first save → `userData/autosave/unsaved.isp.*`. Recents in `localStorage['domeProRecents']` (max 12, with thumb). `_asFlip`, `_asBusy`, `_lastHistT`.
- **Invariants / gotchas:** autosave skipped when `!state.dirty` (a redundant autosave would out-date the `.isp` → false "newer autosave" prompt). Snapshots pruned to last hour. localStorage is only the browser/secondary path (10MB quota; `_serLight` drops maskData).
- **Status:** ✅
- **Roadmap:** —

## Formats .isp / .ise / .rdome
- **Purpose:** Project file extensions — all JSON. `.isp` is canonical (Immersive Studio Pro); `.ise`/`.rdome` are legacy accepted on open.
- **Location:** save filter main.js L121; open filter L138; regex main.js L36 + app.js `addRecent` L2089.
- **Invariants / gotchas:** saves always `.isp`. Header key stays `app:'DomeStudioPro'` for back-compat.
- **Status:** ✅
- **Roadmap:** —

---

# UI chrome

## Landing / splash / loading + logo loop
- **Purpose:** Branded square splash (logo loop ~2 cycles) → start screen with recents + New/Open; a logo-loop loading screen while a project buffers.
- **Location:** app.js · `showLanding()` (L2106-2140), `showSplash(minLoops,onReady)` (L2078), `showLoadingScreen(msg)` (L2095) / `setLoadingMsg`/`hideLoadingScreen`/`loadingWaitMedia` (L2098-2104), `startLogoLoop(imgEl,fps,onLoop)` (L2073), `preloadLogoFrames`/`logoFramePath` (L2070-2072), `hideLanding` (L2091). Init: `showSplash(2, …showLanding)` (L6989).
- **State/data:** 75 PNG frames `assets/frames logo/frame_NNN.png` (`LOGO_FRAMES=75`); `_logoImgs`, `_loadingOv`, `LOADING_MIN_LOOPS=2`.
- **Key symbols:** landing buttons `#lgNew`(dome)/`#lgNew2d`/`#lgNewRoom`/`#lgOpen`, recent cards `.lgcard[data-path]` → `openProjectPath`; missing file prunes the recent + re-shows landing.
- **Invariants / gotchas:** splash has a safety timeout so a throttled rAF never hangs boot. Loading screen holds until loop ran ≥2× AND media/proxies ready (or 20s deadline). [R147] **no editor flash on boot:** (a) `finish()` calls `onReady()` (paint start screen/onboarding) BEFORE the opacity fade, so the fade reveals the destination, not the editor; (b) `<body class="preboot">` + `body.preboot #app{visibility:hidden}` hides the editor chrome until `showSplash` removes `preboot` (overlays live outside `#app`), killing the pre-script paint of the editor.
- **Status:** ✅

## Recorrido guiado [D7] + PROYECTOS DEMO [R227]
- **Purpose:** coach-marks sobre el editor REAL con textos propios de cada formato. **[R227]** Ya NO sale al crear un proyecto (salía sobre un lienzo VACÍO, hablando de pistas, clips, curvas y composiciones que no existían, y estorbaba al empezar a trabajar): ahora lo lanzan los **DEMOS** de la pantalla de inicio (botón «Demos» → Dome / 2D / 360 Room), que construyen en memoria una pieza pequeña pero VIVA y el recorrido pasea por ella señalando cosas de verdad. Sobre un proyecto cualquiera sigue disponible a mano desde **Ventana → Recorrido guiado**, con los 6 pasos genéricos. Se salta con Esc / «Skip tour».
- **Location:** app.js · demos: `DEMO_DUR`/`_demoRefs`/**`_demoBatch` [R228]** · `_demoPlace`/`_demoAddShape`/`_demoAddText`/`_demoKf`/`_demoMotion`/`_demoFx`/`_demoCompose`/`_demoLaneName`/`_demoRoomPos` · `_demoBuildDome`/`_demoBuildFlat`/`_demoBuildRoom` · `DEMO_LABEL`/`startDemoProject(fmt)`/**`_demoFinish(fmt)`**/`buildDemoProject` (bloque tras `lchCreate`, ~L3630). Recorrido: `tourTrasCrear(fmt,demo)` / `startTour(fmt,demo)` / `tourSteps(fmt,demo)` / `_demoSelect(clipId,tab)`. Disparos: `startDemoProject` (único automático) e ítem de menú en `openAppMenu('window')`.
- **State/data:** **sin persistencia** — [R210] se fueron `dspOnboardV1` y `dspTour_*`. DOM `#tourOv` (captura de clics transparente) → `.hole` (foco por `box-shadow:0 0 0 9999px`, pointer-events:none) + `.card` (`#tourSkip/#tourBack/#tourNext`). `tourSteps(fmt,demo)` = 6 pasos genéricos / **9 con demo**: bienvenida · visor · línea de tiempo · **inspector (clip seleccionado)** · **efectos (pestaña Reactive FX)** · **automatización (modo encendido, curva a la vista)** · **composición (el nest resaltado)** · 2D/3D · export. `_tourStop` guarda el desmontaje activo. `_demoRefs={fmt,fxClipId,autoClipId,autoParam,autoLane,compClipId}` = los ids que el recorrido señala.
- **Key symbols:** paso = `{sel,title,body,act?,reveal?}`. **`act`** deja el editor en el estado del que habla el paso (`_demoSelect` selecciona el clip y cambia de pestaña; el paso de automatización usa **[R228] `revealAutomation(c,p,{lazy:true})`**) — se ejecuta en CADA `draw` (volver atrás, redimensionar), así que es IDEMPOTENTE y no llama a `markDirty` (enseñar no es editar). **[R228]** ambos usan el **idioma ligero de selección** (`$$('.clip').forEach(x=>x.classList.toggle('sel',…))` + `renderInspector()`, el mismo que los clics reales de la línea de tiempo) en vez de reconstruir la línea de tiempo entera; y el acto de automatización mete TODO —incluido el cambio de selección— dentro de su guard `cambio`, así una selección rancia (el usuario tocó otro clip) se corrige y nada corre en balde en cada fotograma. **`sel` admite función** (los ids de clip del demo son de tiempo de ejecución) y **`reveal`** hace `scrollIntoView` antes de medir. `draw()` coloca el agujero sobre `getBoundingClientRect(sel)` (centrado a pantalla completa si `sel:null`); teclas Esc/←/→/Enter; `resize` redibuja.
- **[R228] El paso «2D and 3D» tiene copy propio en 2D plano:** `updModeUI` ESCONDE el botón 3D en flat (sólo la sala tiene vista 3D de verdad) y llama «Canvas» al que queda, así que el texto genérico prometía un 3D inexistente. En flat el paso se titula «The canvas view» y habla del lienzo y su zoom/pan; domo y sala conservan el suyo.
- **El material demo (cómo extenderlo):** los tres `_demoBuild*(V,dur)` son la ÚNICA parte específica de formato; comparten los ayudantes y devuelven `_demoRefs`. Añadir un formato = un `_demoBuild*` + su rama en `startDemoProject`. Cada demo trae, dicho en el idioma de su formato: 4 pistas de vídeo con nombre propio, un fondo con Motion, una **composición de 2 clips** (por el mismo `nestSelection` del gesto del usuario), un clip con **Motion + Efecto + automatización de POSICIÓN + automatización del MIX del Motion**, y un texto con curva de **OPACIDAD**. Sólo medios GENERABLES (formas + texto): el demo no depende de archivos en disco y no puede quedar "media offline". `_demoFinish` encaja la línea de tiempo a la pieza y devuelve el proyecto a recién nacido (`currentPath=null`, `dirty=false`, historial vacío) → se edita y se guarda con el Save normal.
- **[R228] LOTE de construcción — `_demoBatch`:** mientras está encendida, `pushUndo` hace early-return y `addClip`/`nestSelection` **mutan el estado pero NO repintan** (guard justo antes de su suite de renders). Antes cada uno de los ~8 clips repintaba línea de tiempo + inspector + visor para nada; `_demoFinish` hace el único render que importa. La enciende y la apaga SÓLO `startDemoProject`/`buildDemoProject`, siempre con `try/finally` (+ un `_demoBatch=false` de cinturón en el `catch`): nada más debe poder dejarla encendida. Medido por CDP: **0 snapshots** durante el build (antes 8) y el resultado final idéntico.
- **[R228] Otros arreglos del review:** `_demoKf` usaba `'easeInOut'`, un token que **no existe** (`easeF` sólo entiende `in|out|both|hold` y lo demás cae en el `default` LINEAL) → TODAS las curvas del demo interpolaban recto y el token inventado se guardaba en el `.isp`; ahora `'both'`. `_demoFx` crea el efecto por el CAMINO REAL (`addFxToClip(c,type,true)`) y luego sobreescribe int/amt/params. `_demoFinish(fmt)` reusa `fitAll()` (ya no recibe `dur`). `buildDemoProject` **mira el booleano** de `newProject` (si no, construía encima del proyecto anterior). El `catch` de `startDemoProject` deja un estado digno: el proyecto previo YA fue destruido en ese punto, así que limpia `_demoRefs`, apaga `_lchVolver`/el consentimiento y vuelve a la pantalla de inicio tras el aviso (el aviso va PRIMERO: el launcher es z-300 y taparía el diálogo z-50).
- **Invariants / gotchas:** `startTour` recibe el FORMATO (`dome|flat|room`), **no** un booleano — cambió en R178. `#tourOv` es **z-45 a propósito**: encima del cromo pero DEBAJO de los `.overlay` (z-50), para que un diálogo de confirmación siga siendo clicable durante el recorrido. `tourTrasCrear` espera 900 ms a que el editor esté pintado (el agujero se mide sobre elementos reales). `newProject`/`newRoomProject` son async, llaman a `confirmDiscard` y **[R227] devuelven `true`/`false`** — hay que `await`earlos Y mirar el resultado (si es `false` no hay proyecto nuevo que poblar). Movimiento reducido: sin transición del agujero. **[R227] Un Motion LINEAL de `x` no vale en 2D plano**: el clip se va del lienzo y no vuelve nunca (en el domo el azimut da la vuelta y en la sala envuelve la costura, pero sólo una vuelta) → los demos 2D y de sala usan `mode:'wave'` vía el argumento `over` de `_demoMotion`. **`_demoFx` intercambia `int`/`amt`**: `newFx` nace en `int:0`/`amt:100` (reactivo al audio) y en un demo SIN audio eso es un efecto invisible. Los dos clips de la composición nacen en `V[1]` y `V[3]` para poder verse a la vez; el nest aterriza en `V[1]` y el texto ocupa después el `V[3]` que quedó libre → ninguna pista vacía. **[R210]** `startOnboarding()` archivado desde R178. `buildDemoProject()` se mantiene como alias del demo de domo SIN recorrido: no lo llama la app, lo llaman los arneses de `scratchpad/`.
- **Status:** ✅ (R145 · rehecho en R227)
- **Roadmap:** [U9] homepage + logo loop — done.

## App menu bar (File / Edit / Window)
- **Purpose:** Top-bar dropdown menus that reuse existing commands; hover switches menus while the bar is open.
- **Location:** app.js · `openAppMenu(which,btn)` (L5809-5841), wiring L5842-5844. DOM: `#menubar .menubtn[data-menu=file|edit|window]` (index.html L634-638).
- **Key symbols:** File: **[R227] UNA sola entrada de proyecto nuevo** — `New project…` (⌘N) → `newProjectViaLanding()` —, Open/Save/Save As, Export. Edit: undo/redo/cut/copy/paste/duplicate/delete/ripple/nest. Window: media/inspector pane toggles, viewer-only window, full performance, guided tour, all-commands (→ `#helpBtn`).
- **[R227] `newProjectViaLanding()`** (junto a `confirmDiscard`, ~L8218): si hay cambios sin guardar pregunta con **`appConfirm3`** (guardar / descartar / cancelar; `appConfirm` sólo tiene dos botones y "guárdalo primero" no cabe en un booleano) y después muestra la **pantalla de inicio**, que es donde se configura un proyecto nuevo con los tres formatos a la vista y vista previa en vivo. El proyecto abierto NO se toca: sigue en memoria detrás del launcher y **«Back to project»** lo devuelve intacto. Lo destruye después `newProject`/`newRoomProject` si de verdad se crea otro. Mismo destino para **Ctrl+N**, la paleta de comandos y `#newBtn` (antes Ctrl+N creaba un domo por defecto a ciegas). Los tres diálogos de creación del menú (`domeSetupDialog`, `flatResDialog`) están **archivados** → `_backup/deprecated/20260730-creation-dialogs-file-menu.js`; `roomSetupDialog` sigue vivo en Project → «Room geometry…».
- **Invariants / gotchas:** built on `openMenu`; the active `.menubtn` highlight is cleared by `closeMenu` (R135). **[R228] EL CONSENTIMIENTO DE DESCARTAR ES DE LA SESIÓN DEL LAUNCHER — `_lch.discardOk`** (`lchConsent()`/`lchArmConsent()`), y viaja EXPLÍCITO como argumento `skipConfirm` a `newProject`/`newRoomProject`/`openProject`/`openProjectPath`. Sustituye a la bandera global de un solo uso `_descartarYaDicho` de R227, que consumía a distancia la siguiente `confirmDiscard()` **quien fuera**: bastaba abrir el selector de archivos desde el launcher y cancelarlo para quemarla y volver a preguntar por unos cambios ya aceptados. Se arma al responder Descartar (o Guardar con éxito) en `newProjectViaLanding`; se limpia SÓLO al abandonar el launcher con éxito (`lchLeave()`, que también apaga `_lchVolver`) o al pulsar «Back to project». NO se toca `state.dirty`, para que volver devuelva el proyecto con sus cambios y su asterisco. `appConfirm3` va a **z-360** (por encima del launcher, z-300) y con **[R228]** Enter responde el botón ENFOCADO (antes Enter respondía siempre Guardar aunque el usuario hubiera llegado con Tab hasta «Descartar»).
- **Status:** ✅
- **Roadmap:** [D3] menu bar — done.

## Context-menu system (openMenu / closeMenu)
- **Purpose:** The single popup-menu primitive used everywhere (media, timeline, folders, NDI, ruler, app menus). Keyboard-navigable; supports separators, danger items, shortcut glyphs, and an inline color-swatch row.
- **Location:** app.js · `openMenu(x,y,items)` (L5788-5806), `closeMenu()` (L5785), `fmtKey(s)` (L5787). Outside-click close L5807.
- **Key symbols:** item = `{label,fn,ico?,key?,danger?}` | `'sep'` | `{swatches:{cur,onPick,onClear}}`. Auto-repositions if it overflows the viewport; focuses the first enabled item; Arrow/Home/End/Esc handled inside (stopPropagation).
- **Invariants / gotchas:** `fmtKey` rewrites ⌘/⇧/⌥ to Ctrl+/Shift+/Alt+ on non-Mac (the app is Windows). **[R223] los swatches de color son CUADRADOS de 18×18** en los tres sitios que los muestran — la fila inline de `openMenu({swatches})` y el popup `colorPopup` (que sirve tanto a `openLaneColorPopup` como a `openClipColorPopup`). **Gotcha:** hay que declarar `min-height:18px` en el estilo inline; la regla global `.menu button{min-height:26px}` alargaba el cuadrado a un rectángulo vertical y `height:18px` sola no la vencía. El botón "Default (no color)" es texto, no swatch, y sí es rectangular a propósito.
- **Status:** ✅
- **Ticket:** [R223] Etapa 1 (swatches cuadrados)

## Command palette / help (Ctrl+K / F1 / ?)
- **Purpose:** Searchable list of all commands + shortcuts across 9 categories; the `?` button and F1/? open it.
- **Location:** app.js · `openPalette()` (L5972), `commandList()` (L5941-5971). `#helpBtn`→`openPalette` (L5574); key handlers F1/? (L5687), Ctrl+K (L5688). DOM: `#helpBtn` (index.html L650), `#palOv`/`#palIn`/`#palList`.
- **Key symbols:** each command = `[category, label, key, fn]`; live filter by category+label; Arrow/Enter to run.
- **Invariants / gotchas:** the palette is also the "all commands & shortcuts" reference (U-08).
- **Status:** ✅
- **Roadmap:** —

## Top bar (title / format chip)
- **Purpose:** Project title with dirty marker + mode prefix, and the clickable format chip (dims·fps·codec) that opens sequence settings.
- **Location:** app.js · `projTitle()` (L4902), `updFmtChip()` (L5196). DOM: `#projTitle`, `#fmtChip` (click→`openSeqSettings`), `#helpBtn`. **[R148 · Rev1]** the loose top-bar buttons `#newBtn/#openBtn/#saveBtn/#saveMenuBtn/#exportBtn` were removed (design §1: they live in the File menu); their wiring is kept but blindado with `if($('#saveBtn'))`-style guards, so the keyboard shortcuts and the File menu keep working.
- **Key symbols:** `projTitle` also pushes native title + `DSP.setUiState({dirty,lang})` for the close guard. `updFmtChip` shows `Room·`/coverage suffixes.
- **Invariants / gotchas:** `fmtChip._codec` transiently overrides the codec suffix during the export dialog; restored on close.
- **Status:** ✅
- **Roadmap:** —

## Styled dialogs (appPrompt / appAlert / appConfirm)
- **Purpose:** In-app modal replacements for browser prompt/alert/confirm (Electron doesn't support the natives).
- **Location:** app.js · **[R228] `_dialogBase(message,buttons,opts)`** (~L2949, el andamiaje único), `appConfirm(message,cb,opts)` y `appConfirm3(message,opts)` = wrappers suyos; `appPrompt(message,def,cb)`, `appAlert(message,cb)`. Related inline editor `inlineEdit(el,value,commit)`.
- **Key symbols:** `opts.ok/cancel/danger`; Esc=cancel; each `closeMenu()`s first. `appConfirm` returns via callback (often wrapped in a Promise, e.g. `confirmDiscard`) **y además devuelve la promesa [R228]**. `_dialogBase`: `buttons=[{v,id,label,style,primary}]` en orden de pintado, `opts={id,esc,width,z}`; los `id` (`#cfOk`/`#cfCancel`/`#c3Save`/`#c3Discard`/`#c3Cancel`) se conservan porque los pulsan los arneses de prueba y el CDP.
- **Invariants / gotchas:** project rule — NEVER use native prompt/alert/confirm; always these. **[R218]** guarda de conexión en el `keydown`: si el overlay se destruyó por otra vía, el listener se retira (si no, mata los atajos para siempre). **[R228] Enter activa el botón ENFOCADO**, no el default, cuando el foco está en uno de los botones del diálogo — el default (`primary`, que recibe el foco inicial) sólo manda si el foco está en otra parte. Antes `appConfirm3` respondía siempre Guardar aunque el usuario hubiera llegado con Tab hasta «Descartar». El andamiaje (overlay + fila de botones + guarda + foco + Esc + clic fuera) estaba DUPLICADO literal entre `appConfirm` y `appConfirm3`.
- **Status:** ✅
- **Roadmap:** —

## Panels collapse / resize / workspace
- **Purpose:** Collapse the media / inspector panes to rails, drag gutters to resize, persist widths + collapse state.
- **Location:** app.js · `setPaneCollapsed(pane,on)` (L5533), rail/hide wiring L5534-5537, `gutter` (L5654)+`gutter(...)` L5655, `hResize` (L5657), `saveWorkspace`/`loadWorkspace` (L5661-5663). DOM: `#mediaPane`/`#inspPane`/`#mediaRail`/`#inspRail`/`#hideMedia`/`#hideInsp`/`#gutterL`/`#gutterR`/`#tlResize`.
- **State/data:** `state.prefs.mediaCollapsed`/`inspCollapsed`/`tallInsp`; `localStorage['domeProWs']`.
- **Invariants / gotchas:** pane width clamped 180–560; timeline height clamp 170..78%vh.
- **Status:** ✅
- **Roadmap:** —

## i18n (T / applyLang / setLang)
- **Purpose:** Two-language UI (English/Spanish). Software UI is English by default; `T(en,es)` picks strings; `applyLang` re-labels the static chrome.
- **Location:** app.js · `T(en,es)` (L95), `applyLang()` (L6256-6304), `setLang(l)` (L6254). Lang loaded from `localStorage['domeProLang']` (L90).
- **State/data:** `state.lang` ∈ 'en'|'es'.
- **Key symbols:** `applyLang` uses helpers `txt/ttl/ph/tn` (tn preserves an icon's trailing text node); relabels menubar, top bar, media panel, view segs, inspector, transport.
- **Invariants / gotchas:** project convention — Spanish is castellano neutro; UI strings in English with `T('EN','ES')`. `setLang` also reports lang to main via `DSP.setUiState` (localized native dialogs).
- **Status:** ✅
- **Roadmap:** —

## Perf mode (Full Performance)
- **Purpose:** Viewer takes over the whole window (editor stays in DOM, covered); Esc exits.
- **Location:** app.js · `setPerfMode(on)` (L5613). DOM: `#perfExit`, `body.perfmode`. **[R148 · Rev1]** `#perfBtn` removed — entered from the **Output** dropdown (`#outputBtn`).
- **Invariants / gotchas:** `[V2]` done.
- **Status:** ✅
- **Roadmap:** —

## Viewer-only window (pop-out) — vista **COMPLEMENTARIA** + barra propia (reescrita en R226)
- **Purpose:** Ventana de salida movible/redimensionable para una segunda pantalla que muestra la vista **COMPLEMENTARIA** del editor ([V1]): editor en 2D ⇒ ventana en 3D, y al revés. Vale para **domo Y sala 360**. Con barra de herramientas propia dentro de la emergente.
- **Location:** app.js · sección «[R226 · V1] VENTANA SOLO-VISOR» justo detrás de `render()`: `openViewerWindow()` · `viewerBuildDoc(w)` · `viewerClosed()` · `viewerPump()` · `viewerPaint()` · `viewerOpen()`/`vDirty()`/`viewerMode()`/`viewerHas3D()`/`viewerOverlayLabel()`. Se abre desde el desplegable **Output** (`#outputBtn`); `#popoutBtn` se retiró en R148. Handler del proceso principal `frameName==='domeViewer'` (main.js ~L226, `backgroundThrottling:false`).
- **State/data:** `_viewerWin`, `_viewerCtx` (2D ctx del lienzo de la emergente), `_vMode` (`auto|2d|3d`) + `_vEditorMode`, `_vCam` (cámara propia: `yaw/pitch/dist/fov/back`, sirve para domo y sala), `_vThree` (`orbit|spec`), `_vGrid`, `_vOverlay`, **[R231] `_vFloor`** (su propio interruptor de piso) , `_vDirty`, `_vRaf`, `_vPaint`, `_vBusy`, `_vBarSig`, `_viewerBar`, **[R231] `_vVp`/`vVpState(surf)`** (encuadre PROPIO por superficie, `'_'` = panel único). Además `_reuseComp`/`_lastSrcTex` en `render()`.
- **CAUSA RAÍZ DEL CUELGUE QUE ARREGLA (medida por CDP):** el espejo anterior re-dibujaba la escena en una FBO propia y la traía a la CPU con **`gl.readPixels` SÍNCRONO dentro de `render()`**. `render()` pasaba de **0,05 ms a 9,66 ms** con la ventana abierta (≈200×; readPixels 3,57 ms a 944² · putImageData 0,71 ms · el resto, el pase extra y los binds), y la reproducción caía de **60,4 a 36,6 fps con una escena TRIVIAL**. readPixels vacía la tubería de la GPU cada fotograma; con vídeo real el editor se va por debajo de 30 y deja de responder entre fotogramas. Encima, cada gesto de la emergente llamaba a `render()`, así que orbitar dentro de ella bloqueaba al editor.
- **Key symbols / diseño nuevo:**
  - `viewerPaint()` — **no lee píxeles**. Intercambia los globales de vista (mismo patrón probado de `lchEditorShot`: `V.mode/three/cam/zoom/pan/showGrid/showOutline/hfade/showSeam/showCenter/checkerBg/showScopes` + `view.cw/ch`, `VSIZE`, `glc.width/height`, `gridc.width/height`, `gx.setTransform`), llama al `render()` de siempre y copia `glc` + `gridc` a la emergente con `drawImage` (GPU→GPU, WebGL primero y las guías encima). **Coste medido 1,5–2,7 ms** (5,6× mejor) y `render()` del editor vuelve a costar 0,03 ms. De regalo: sala 360 en 3D, rótulos, grilla, guías y el pill de «Preparando medios…» salen gratis — es el mismo camino de dibujo.
  - `_reuseComp` — el composite del máster no depende de la vista, sólo del cabezal: se reutiliza `_lastSrcTex` en vez de recomponer (`prepNests` + N clips) una segunda vez por fotograma.
  - **Render de cierre:** tras restaurar los globales hay otro `render()`, porque cambiar `glc.width` BORRA el lienzo y el visor del editor se quedaría negro.
  - `viewerPump()` — bombeo **de la ventana**, con su propio `requestAnimationFrame`, que sólo pinta si `_vDirty` (lo marca `render()` al final). Si la emergente se congela, se minimiza o se cierra, el editor no se entierra con ella; en reposo el coste es cero.
  - `viewerBuildDoc(w)` — monta/**remonta** el documento. `window.open('about:blank')` entrega un documento inicial sincrónico que Chromium a veces SUSTITUYE al confirmar la navegación (carrera reproducida al reabrir; síntoma = ventana negra sin barra). El bombeo detecta la falta de `#vwcv` y remonta.
  - Barra `#vwbar` dentro de la emergente, **CSS auto-contenido**: segmento `2D|3D` (override manual que se suelta en cuanto el editor cambia de modo), `Grid`, el overlay contextual (`Horizon` domo / `Seam` sala / `Center` 2D), **[R231] `Floor`** (sólo en sala 2D con piso) y en 3D el segmento `Orbit|Viewer`. Se reconstruye por firma (`modo efectivo|seqMode|activeSeqId|tienePiso|toggles|idioma`). **[R231b]** la secuencia activa y su flag de piso son imprescindibles: el botón `Floor` depende de `activeSeq().room.floor`, así que saltando entre dos salas —una con piso y otra sin él— el `seqMode` no cambia y la barra no se repintaba nunca. Arrastre = orbitar, rueda = `dist` (Orbit) o `back` (Viewer) **en 3D**.
  - **[R231] Zoom del visor 2D + piso partido.** La rueda salía por la puerta con `if(viewerMode()!=='3d')return`, así que **en 2D no hacía nada**. Ahora la rama 2D hace el mismo zoom anclado que el editor (el punto bajo el cursor se queda quieto) sobre el panel bajo el cursor, escribiendo en `_vVp` — el encuadre de la ventana es SUYO: acercarse ahí no mueve el del editor ni al revés. `vWithViewport(w,fn)` pone viewport (`view.cw/ch`, `VSIZE`), modo y encuadre de la emergente mientras dura el gesto y los restaura en un `finally`: sin eso, `vpPanels()` calcularía los paneles con el tamaño del EDITOR. En el camino del domo hay que sincronizar `state.view.zoom/pan` con el par del panel único, porque `pix2f` los lee directamente.
- **Invariants / gotchas:** `viewerHas3D()` = domo o sala; una secuencia 2D plana no tiene 3D, así que la ventana se queda en 2D y su segmento 2D/3D desaparece (igual que en el editor). El botón de overlay se oculta en **sala + 3D** (la costura es una guía de la tira 2D). La ventana es una **salida limpia**: sin contornos, sin scopes, sin alfa, sin tiradores ni overlay de máscara (`_vPaint` los apaga). **[R231]** lo que ya NO hereda es el pan/zoom del editor: tiene el suyo (`_vVp`, arranca en `0.94`/`[0,0]`), y **sí se parte** en muros|piso cuando su botón `Floor` está activo — R230b la dejaba entera a propósito, pero entonces no había forma de encuadrar el piso en la segunda pantalla. `_vBusy` cubre también el render de cierre: sin eso, marcarse sucio a sí mismo sería un bucle de repintado eterno. Coste medido con la ventana abierta y 10 s de reproducción: **~42 fps** de editor (el resto es Chromium componiendo dos ventanas en la GPU del dev; el `.exe` fuerza la RTX). Camino viejo archivado con el desglose de la medición en `_backup/deprecated/20260730-viewer-window-readback.js`.
- **Status:** ✅
- **Roadmap:** —

## Reemplazar medio + duración + bucles — replaceMedia / reconciliarDuracion
- **Purpose:** cambiar el ARCHIVO de un medio conservando toda la edición (los clips lo referencian por id), y cuadrar los clips cuando la duración nueva no coincide con la vieja. Caso real de Beltrán: reemplazar un clip por su propio **upscale**, que dura unas décimas más o menos.
- **Location:** app.js · `replaceMedia(m,ruta)` (~L7455) · `reconciliarDuracion(m,oldDur)` + `clipsDelProyecto()` justo debajo · duración refrescada en `reloadMedia` (rama vídeo).
- **[R205] Tres cosas que estaban mal:**
  1. **La duración del vídeo no se refrescaba nunca.** `dur:v.duration` sólo se leía al IMPORTAR; `reloadMedia` ponía `w`/`h`/`fps` pero no `dur`. Tras un reemplazo el medio conservaba la duración del archivo anterior → el límite de recorte mentía y `toggleLoop` capturaba el ciclo de una duración falsa. Pista de que venía a medias: `replaceMedia` guardaba `oldDur` **y no lo usaba**.
  2. **`reloadMedia` no se podía esperar en vídeo.** Registraba el oyente de `loadedmetadata` y volvía en el acto, así que un `await reloadMedia(m)` resolvía antes de leer el archivo. Ahora la rama de vídeo devuelve una promesa (con plazo de 15 s por si el archivo no emite ningún evento). El bucle de carga del proyecto lo llama **sin** esperar → allí no cambia nada.
  3. **Los bucles no se reajustaban.** `loop`/`loopLen` viven en el CLIP (en segundos de origen), así que sobreviven al reemplazo — pero seguían cortando por donde cortaba el material viejo: con uno más corto, el último fotograma se congela en cada vuelta; con uno más largo, la cola nueva no se ve nunca.
- **La regla de `reconciliarDuracion`:** si el ciclo abarcaba **todo lo que quedaba de origen** (`|loopLen − (oldDur − inP)| ≤ 0,02 s`, que es lo normal al activar Loop sin más) se reescala a la duración nueva; si era un **trozo elegido a mano** se respeta —en un upscale del mismo clip ese trozo sigue en el mismo sitio— y sólo se recorta si ya no cabe. Los clips **sin** bucle no se tocan (recortarlos cambiaría el montaje): se cuentan y se avisan. Recorre los clips de TODAS las secuencias, no sólo la activa (`clipsDelProyecto`).
- **Invariants / gotchas:**
  - **`replaceMedia` acepta `ruta` opcional** para saltarse el diálogo. Es una costura de prueba deliberada: **`DSP` viaja congelado** por `contextBridge`, así que sustituirle `pickMedia` desde el arnés NO surte efecto — el diálogo se abre de verdad y la prueba se cuelga. La alternativa (copiar el cuerpo en el arnés) es justo como se escriben pruebas que aprueban lo que no deben.
  - Tras reconciliar se rehacen instancias de vídeo, audio programado y caché de render-ahead: el material cambió y los tres quedan obsoletos.
- **[R205b] Los cuatro hallazgos de la revisión sobre R205:**
  - **Sólo el vídeo era esperable.** Audio e imagen seguían resolviendo antes de leer el archivo, así que reemplazar un **audio en bucle** por otro de distinta duración no reajustaba nada: `reconciliarDuracion` comparaba la duración vieja consigo misma y se iba de largo. Las tres ramas devuelven ya una promesa.
  - **El deshacer descuadraba.** `snapshot()` guarda **sólo `state.clips`** (la secuencia activa) y **nunca `state.media`**: cambiar el archivo de un medio no fue reversible jamás. Con R205 los clips SÍ cambiaban, así que un Ctrl+Z devolvía los bucles al material viejo dejando el archivo nuevo puesto — peor que no deshacer. Ya no se apila punto de deshacer; la vía de recuperación es **volver a reemplazar**, que reajusta igual de bien porque la reconciliación es relativa a la duración actual. Y si el medio se usa en otras secuencias se **pregunta antes**, nombrándolas, con el mismo criterio que ya usaba borrar un medio (L2125).
  - **El plazo de 15 s resolvía en silencio** con la duración vieja → «reemplazado» sin un solo bucle reajustado y sin explicación. Ahora marca `m._plazo` y entra por la vía de fallo. (Este archivo documenta lecturas de metadatos de más de 8 s en disco frío o red: no es hipotético.)
  - **Un archivo ilegible se anunciaba como éxito**, dejando `path`/`name`/`fsize` pisados y el medio desvinculado. Ahora **se revierte** al archivo anterior, se recarga y se avisa; el proyecto no se queda apuntando a algo que no abre.
- **Status:** ✅ verificado con dos vídeos reales fabricados por el propio exportador (6 s y 4 s) y tres clips: bucle entero, bucle de trozo y sin bucle. Reemplazo 6→4 y 4→6: la duración sigue al archivo, el ciclo entero se reescala, el trozo de 2 s queda intacto. Control con el camino antiguo: el ciclo se queda en 6 s con material de 4.
- **Roadmap:** —

## Rutas multiplataforma + reenlace junto al proyecto — pjoin / relinkIndex / repararRuta
- **Purpose:** que armar rutas valga en Windows y macOS, y que mover la carpeta de un proyecto no deje los medios en rojo.
- **Location:** app.js · `PSEP`/`pjoin`/`pdir`/`pbase` (~L1745, justo antes del bloque de proxies) · `relinkIndex`/`repararRuta`/`relinkReport`/`relinkReset` (~L7381, junto a `reloadMedia`) · `preload.js` expone `sep` y `listSubdirs` · `main.js` `dsp:listSubdirs`.
- **[R204] Unir rutas.** **Partirlas** ya valía en los dos sistemas (siempre se busca `\` y `/` y se coge el último); lo que estaba mal era **unirlas**: una docena de sitios —proxies, autoguardado, render en el sitio— escribían `dir+'\\'+nombre`. En macOS eso **no falla**, que es lo peligroso: crea archivos y carpetas con una barra invertida **dentro del nombre**, colgando un nivel por encima de donde debían ir → el rescate de proxies por nombre no encontraba nada y la carpeta `autosave` aparecía donde no era. En Windows `pjoin` produce la MISMA cadena que antes, así que allí el cambio es un no-op por construcción.
- **[R204] Reenlace.** El `.isp` guarda rutas absolutas. `repararRuta(p)` devuelve `p` si existe; si no, lo busca **por nombre** en un índice de la carpeta del `.isp` + **un** nivel de subcarpetas (se saltan `autosave` y `rendered clips`). El índice se arma **una vez por proyecto** (no una por medio) y `relinkReset()` lo tira en `loadProject`. Cubre también las secuencias de imágenes (`m.framePaths`). Al reparar se limpia `proxyReady/proxyUrl/proxyEl` para que el proxy se re-enganche desde la ubicación nueva.
- **Invariants / gotchas:**
  - **El aviso va con retardo (900 ms) a propósito:** `loadProject` lanza todas las `reloadMedia` **sin esperarlas**, así que en el punto donde termina no hay todavía nada reparado — un `updRelink()` allí siempre contaría cero. Cada reparación reinicia el temporizador → un solo mensaje al acabar la ráfaga, y después del «Proyecto cargado», que si no lo pisaría.
  - **No marca el proyecto como modificado:** guardar fija las rutas nuevas; no guardar no pierde nada (la próxima apertura las resuelve igual). Marcar `dirty` daría un falso «cambios sin guardar» en cada apertura.
  - **`dsp:listSubdirs` es un canal NUEVO**, no una ampliación de `dsp:listDir`: ése devuelve sólo archivos y de él dependen el rescate de proxies y el historial de autoguardado, que filtran por nombre — colarles carpetas sería pedir un falso positivo.
- **Status:** ✅ verificado moviendo de verdad un proyecto con sus medios a otra carpeta (uno en la raíz, otro en una subcarpeta) y reabriéndolo desde allí: 0 ausentes, rutas reescritas, clips intactos. Control contra el `.exe` de R203: allí quedan **2 ausentes**.
- **Roadmap:** —

## Close-confirm + dirty guard
- **Purpose:** On window close with unsaved changes, show the app-styled confirm instead of a native OS dialog.
- **Location:** app.js · `DSP.onConfirmClose(...)` in init (L6990) → `appConfirm` → `DSP.forceClose()`. Main side: `win.on('close')`→`dsp:confirmClose` (main.js L90), `uiDirty` from `dsp:setUiState` (L114).
- **Invariants / gotchas:** `projTitle()` pushes the dirty flag to main every time; a failed IPC send falls back to `forceClose`.
- **Status:** ✅
- **Roadmap:** —

## Launcher (pantalla de inicio) — showLanding / renderLauncher
- **Purpose:** Crear un proyecto de uno de los tres tipos (Domo / 2D Flat / Sala 360) con **todos** sus parámetros a la vista y una **vista previa en vivo** antes de comprometerse, reabrir un reciente o **[R227] abrir un DEMO** con su recorrido guiado. Recreado del handoff `Launcher - Rev 4.dc.html`.
- **Location:** app.js · `showLanding()`/`hideLanding()` (nombres conservados: los llaman `init`, `loadProject`, `newProjectViaLanding`…), **[R228] `lchLeave()`/`lchConsent()`/`lchArmConsent()`**, `renderLauncher()`, `lchPaint()/lchPaintNow()`, `lchRenderRecents()`, `lchCreate()`, `lchNum`/`lchWireNums`/`lchApply` (campos con borrador), `lchCycleFacing`, `lchFacings`/`lchColor`, `LCH_TYPES`, `LCH_SVG`/`LCH_ICO`. Estado local `_lch` (+ **[R228] `_lch.discardOk`**) + **[R227] `_lchVolver`**. CSS `.lch-*` en index.html. DOM `#landingOv.lch`.
- **[R228] Salir del launcher — dos verbos, no uno:** `hideLanding()` sólo QUITA EL OVERLAY; `lchLeave()` = «abandonado con éxito» (limpia `_lchVolver` + `_lch.discardOk` y quita el overlay). En R227 `hideLanding()` limpiaba `_lchVolver`, y como se llama al EMPEZAR una creación —antes de que resuelva el `confirmDiscard` de `newProject`— cualquier cancelación devolvía al launcher ya sin «Back to project»: puerta de un solo sentido con el proyecto viejo todavía vivo detrás. Llaman a `lchLeave()`: `lchCreate` (rama `after(true)`), `startDemoProject` (tras `ok`), `loadProject` (la carga llegó a buen puerto) y el botón «Back to project» (a mano). Los caminos de cancelación (`after(false)`, `if(!ok)`, el `.catch` de `lchCreate`) llaman a `showLanding()` **sin tocar las banderas** → el Back sigue ahí.
- **[R227] Barra superior:** `#lchDemo` («Demos», junto a `#lchOpen`) abre el menú global (z-500, se pinta sobre el launcher sin trucos) con **Demo · Dome / 2D / 360 Room** → `startDemoProject(fmt)`. `#lchBack` («Back to project») se pinta **sólo si `_lchVolver`** — es decir, si se llegó aquí desde un proyecto abierto por File → «New project…» — porque el launcher no se puede cerrar y sin esa salida la entrada del menú sería una puerta de un solo sentido; **[R228]** la bandera la limpia `lchLeave()` (éxito) o el propio botón de volver, NO `hideLanding()`.
- **VISORES — se REUSAN los del editor, no se dibujan de nuevo.** Hoy (R198) los cuatro viewports son el `render()` real vía `lchEditorShot` (domo 3D, lienzo 2D, sala 3D, tira cosida); quedan como painters sólo los DIAGRAMAS: `drawSeqViz(cv,'dome',{cov})` (cobertura fisheye) y `drawRoomIso(...,'plan')` (planta acotada). `drawSeqViz(cv,'flat')`/`drawDomeIso`/`drawRoomIso`/`drawRoomStrip` siguen siendo el camino de respaldo si la captura falla. Son los MISMOS painters que usan los diálogos de creación, así que lo que se ve en el launcher es lo que se obtiene. El prototipo traía SVGs propios (fisheye, domo 3D, planta, sala 3D, tira): **no se portaron** — pedido explícito de Beltrán.
- **[R232] La orientación de un muro YA NO SE ELIGE; lo editable es su orden en el lienzo.** `roomPlan` siempre ha derivado la huella de los ROLES (mapea `by[role]` y recorre `ROOM_ROLES`), así que reasignar la orientación en la tabla **no cambiaba la forma ni un píxel** — verificado: tres disposiciones distintas de los mismos cuatro roles dan la MISMA planta. Sólo servía para dejar la tabla diciendo una cosa y la sala siendo otra. Lo que sí es una decisión de montaje es **en qué orden salen los muros en la tira cosida** (qué trozo va a cada proyector), y eso pasa a la primera columna: `ord` = 1..N de izquierda a derecha, con **intercambio** al repetir un número (es una permutación: ni huecos ni repetidos). Las filas se pintan en el orden FIJO de orientaciones; la tira se cose por `ord`. Retirados `lchSetFacing`/`lchFacingMenu` (R197) y el reparto de roles sobrantes de R200/R200b (existía porque el preajuste imponía orientaciones). Nuevo: `lchSetOrder(i,n)`, `lchNormOrder()` (renormaliza al cambiar la cuenta de muros o al abrir un preajuste viejo sin `ord`), `lchCfgWalls()` ordena por `ord`, y el preajuste guarda/restaura `ord` y se aplica **por orientación**, no por índice. Mismo cambio en `roomSetupDialog` (`rs-ordnum` pasa de rótulo a `<input>`, `rs-role` de `<select>` a `<span>`).
- **[R232b] Invariantes del orden del lienzo:** cambiar la CUENTA de muros rehace la sala y devuelve `ord` al recorrido físico (`LCH_ROOM_ROLES[n]`) — renormalizar el orden viejo dejaba huecos perdidos y pegaba muros no contiguos (4→3 → `Front|Right|Left`; 4→2→4 → `Front|Left|Right|Back`). Pulsar la cuenta **ya activa** es un no-op en las dos puertas. Las flechas mueven **un** puesto (el paso de 10 de los píxeles se saltaba el rango 1..N entero). Confirmar el mismo valor **repinta igualmente**, o lo tecleado en crudo se queda en el campo. En el diálogo se devuelve el foco tras `drawWalls()`, que rehace todas las filas. La fila del piso usa `.ix`, que subió a 34px con la columna nueva.
- **[R232c] El contenido SIGUE A SU MURO** (`reubicarClipsPorMuro`, junto a `layoutWallStrip`; se llama desde `applyRoomGeometry` con la huella VIEJA capturada antes de recolocar la tira). Reordenar muros re-coloca `x0/x1`, pero `props.x` es el % del marco de la superficie y la superficie de un muro es **la tira completa** (`clipSurfRect` → `{x0:0,x1:W}`), así que sin esto los píxeles se quedaban en el hueco viejo mientras «Mask to wall» se recortaba al nuevo (`roomWallScissorRects`) → clip **en blanco** y contenido sobre el muro de otro. Se guarda la posición **relativa dentro del muro** y se restituye sobre su rect nuevo: «centrado en Front» sigue centrado en Front aunque Front cambie de sitio **o de ancho**. Viaja también `c.kf.x` punto por punto (si no, la animación devolvía el clip al hueco viejo). Sólo pistas de muro; un clip desbordado o cuyo muro desapareció se queda donde está. Verificado por CDP: Front del puesto 1 al 4 lleva su clip del píxel 960 al 6720, con u=0.5 intacto.
- **[R231] La sala 360 arranca en blanco:** `lchInit()` da `roomFloor:false` (el piso ya no viene puesto de fábrica: añadirlo era una decisión que nadie había tomado) y `roomPre:''`. El desplegable **Preset** marca lo que el usuario **eligió**, no lo que coincida con el pixelaje de los muros — antes `lchPresetOptions` comparaba `walls[0].pxW+'x'+pxH` contra la lista, así que «4K» salía preseleccionado de arranque. Ahora hay una opción `—` por delante, `lchApplyPreset('')` no deshace nada (sólo deja de anunciar un preajuste) y **editar a mano `pxW`/`pxH` en `lchApply` limpia `roomPre`**: dejó de ser «el preajuste X».
- **Invariants / gotchas:**
  - **Alto idéntico para los tres tipos** y la página **no scrollea nunca** (requisito duro del handoff). Verificado: panel 426×612, visor 1102×612, página 1000 en Domo, 2D y Sala.
  - **`lchPaint()` va en `requestAnimationFrame`**: llamado justo después de escribir el `innerHTML` el layout todavía no existe, `getBoundingClientRect()` da 0 y los canvas se quedaban en su 300×150 por defecto (se veían estirados).
  - **Los campos numéricos NO re-renderizan al teclear**: `oninput` sólo escribe en `_lch.draft`. Si re-renderizaran, el input perdería el foco en cada tecla. El commit (Enter/blur/flechas) sí re-renderiza y devuelve el foco vía `data-lk`.
  - **Colores de orientación = los del EDITOR (`ROOM_ROLE_COL`), no la rampa neutra del diseño.** Si no, el chip de una orientación y su muro en el visor saldrían de colores distintos. `ROOM_ROLE_COL` se define más abajo en el archivo → se lee **perezosamente** (`lchFacings()`), nunca en una `const` de nivel superior (TDZ al cargar).
  - **La sala usó UN panel arriba entre R153 y R197** porque `drawRoomIso` trae 3D **y** planta cenital en el mismo canvas. **Desde R198 vuelven a ser DOS**, como pedía el diseño: 3D real a la izquierda, planta a la derecha. Sin `.lch-cap` en ninguno de los dos: cada canvas dibuja su propio rótulo y superponer otro los pisaba.
  - **Crear delega en `newProject`/`newRoomProject`** — las mismas que usan los diálogos, así el proyecto sale idéntico venga de donde venga. Los muros se pasan con la forma que ya espera `newRoomProject` (`{role,order,wcm,hcm,pxW,pxH}`) y sus roles coinciden con las orientaciones del diseño.
  - **[R215] `lchAspect(w,h)`** (app.js L2641) envuelve `fmtAspect` (L6929, cap >40 → forma decimal "W/H:1") con un fallback `(w&&h)?fmtAspect(w,h):((w||0)+':'+(h||0))`: sus dos call-sites del panel 2D concatenan el resultado con `' · '` a ambos lados sin comprobar nada, así que un `w`/`h` falsy (0/NaN mientras se edita un campo) dejaba un separador huérfano (`" ·  · "`) en vez de simplemente mostrar `0:0`.
- **[R181] Paleta y proporciones.** La pantalla usaba hex a mano y azulados (`#0A0B0C`, `#131519`) en vez de los tokens del editor: ahora todo el bloque `.lch-*` va con `--s0/--s1/--s2`, `--ink/--ink-2/--ink-3/--ink-dim` y `--line-soft/--line/--line-strong`, y los visores van en **negro** como en el editor. Tres bugs de medida, todos medidos antes de tocar nada:
  - **Rótulos gigantes:** `drawRoomIso` (`U=W/528`) y `drawDomeIso` (`U=min(W,H)/300`) atan el TEXTO a la escala geométrica. Diseñados para los lienzos chicos de los diálogos (U≈1), en los paneles del launcher U llega a ~4 y un rótulo de 9px salía a **18px CSS**, el doble que el H1. Se añade `TU` (unidad de texto = sólo DPR, como ya hacía `drawSeqViz`) y las fuentes pasan a `TU`; la geometría sigue con `U`.
  - **Lienzo clavado a media altura:** `.lch-pane.hasdata>canvas{height:auto}` — en un elemento reemplazado `auto` es el tamaño INTRÍNSECO, o sea el atributo `height` del propio canvas, así que `fit()` medía su propio valor y se lo reescribía. Quedaba en 268px dentro de un panel de 462 (fisheye al 50% del ancho). Con `calc(100% - 24px)`: 82%.
  - **Domo 3D diminuto:** `sc=118*U` lo dejaba al **21%** del ancho. Atado al lienzo (`min(W,H)*1.02`): 54%.
  - **La página scrolleaba** y cortaba los recientes: `min-height:612px` fijo + un `.lch-spacer{flex:1}` que competía con el visor por el espacio libre. Ahora el aire es fijo y crece el visor. Verificado a 780/900/1000/1200px: scroll 0 y alto idéntico en los tres formatos (388→720).
- **[R182] VISORES REALES.** `lchEditorShot(cv,{w,h,mode,cov,view})` monta un estado TEMPORAL con el formato elegido, llama al MISMO `render()` del editor y bliteda `glc` (WebGL) + `gridc` (guías y rótulos) al canvas del panel — el mismo truco que `ripProgress.frame`: leer el búfer de dibujo DENTRO de la tarea de render. Lo usan el panel **Domo · 3D** (malla real con ZENITH/FRONT/BACK/LEFT/RIGHT) y el **lienzo 2D** (encuadre con retícula de tercios). Restaura TODO en el `finally` (formato, clips, modo de vista, zoom/pan, `view.cw/ch`, `VSIZE`, tamaños de `glc`/`gridc`, transform de `gx`): el launcher corre con el editor detrás y no puede dejarle el visor descuadrado. Si falla (contexto perdido, lienzo sin caja) cae al painter esquemático y la pantalla no se rompe. Medido: el domo 3D pasa del 21% al **100%** del ancho del panel.
- **[R198] La SALA pasa también a los visores reales.** `lchEditorShot` acepta `o.room`: `lchRoomSeqTemp(cfg)` arma una secuencia TEMPORAL con la misma forma que produce `newRoomProject` (tira cosida por píxeles nativos, `x0/x1` por muro, `.room` colgando) y la deja como activa mientras dura la captura — que es lo que le faltaba a `renderRoom3D`/`drawRoomGrid2D`, ambos leen la sala de `activeSeq().room`. Consecuencias:
  - **Panel 3D real** (`#lchCvRoom3d`, celda izquierda) con `renderRoom3D`, **arrastrable** (girar) y con rueda (acercar); la cámara vive en `_lch.roomCam` para sobrevivir a los re-render del panel. `lchPaintRoom3D()` repinta SÓLO ese lienzo: el arrastre no puede permitirse tres capturas del render por movimiento del ratón.
  - **Lienzo cosido** (`#lchCvStrip`) por el camino 2D de la sala → marco, retícula y costuras **idénticos al 2D plano**, que era el punto («el Canvas tiene otros colores y otras líneas»). Cae a `drawRoomStrip` si la captura falla.
  - **Planta** (`#lchCvIso`, celda derecha) con `drawRoomIso(...,'plan')`: es un plano acotado, no un viewport, así que sigue siendo painter.
  - `lchEditorShot` guarda y restaura además `state.media`, `activeSeqId`, `view.three/cam`, `_roomGeo`/`_roomGeoSeq` (la malla se cachea por id de secuencia y el id no cambia al editar los muros → se invalida en cada captura) y `_raOn` (el caché de render-ahead es del proyecto de detrás: ni se lee ni se ensucia).
- **[R198] El panel se parte en dos: `.lch-pbody` (scrollea) + salida máster y botón de crear (fijos abajo).** Antes todo el contenido colgaba directo de `.lch-panel{overflow:hidden}` con un muelle `.lch-grow` empujando el resumen hacia abajo; con la sala de cuatro muros el contenido pasa del alto del panel y **el botón «Create 360 Room project» quedaba recortado del todo** — desde la pantalla de inicio no se podía crear una sala (venía de antes de R198; la fila del piso lo empeoró). Ahora las ELECCIONES scrollean y el RESULTADO + la acción no se mueven. `.lch-grow` retirado (su trabajo lo hace el `flex:1` de `.lch-pbody`, que además no compite con el contenido). Medido: a 900px de ventana el cuerpo de la sala scrollea 78px pero el botón siempre está dentro y la página sigue sin scroll; **a 1080 no scrollea nada** en ninguno de los tres formatos.
- **[R198] Piso: pixelaje sí, medidas no.** Fila propia (`.lch-floorrow`) dentro de la tabla de muros con `fpxW`/`fpxH` editables y el ancho/fondo en cm como `span.lch-wnum.ro` (sin marco ni fondo, para que se vea que no se tocan). El override vive en `_lch.floorPx` y lo aplica `lchFloorCfg` al final, así que las medidas siguen saliendo de la huella de la sala aunque se cambien los muros. Un preajuste limpia el override (es una decisión de resolución).
- **Deuda anotada:** el fisheye del domo sigue con `drawSeqViz` a propósito (es un diagrama de cobertura, no un viewport). En la tira cosida, el total que dibuja `drawRoomStrip` se solapa con la etiqueta del último muro a este alto — pero eso ya sólo se ve en el camino de respaldo (painter compartido con el diálogo de sala; no se tocó para no cambiar el diálogo).
- **Status:** ✅ verificado por CDP (alto estable en los 3 tipos, sin scroll, borrador/Enter/Esc/flechas/clamp, intercambio de orientación sin repetidos, uniforme, canvas pintados a tamaño real, 0 errores de consola)
- **Roadmap:** handoff launcher+splash, pantalla 2

## Splash de arranque — ventana propia (splash.html)
- **Purpose:** Ventana cuadrada sin cromo que se muestra SOLA mientras el editor arranca oculto; al terminar se revela el editor en 16:9 y el splash se desvanece. Recreado del handoff `scratchpad/redesign/design_handoff_launcher_splash/Loading Splash - Rev 1.dc.html`.
- **Location:** `splash.html` (diseño + animación) · `splash-preload.js` (puente `SPLASH.onInit/onProgress/onBye`) · `main.js` `createSplash()`/`splashSend()`/`finishBoot()`/`initialSize169()` · `app.js` `bootMark(pct)`/`bootReveal()` (arriba del todo) + los hitos repartidos por el arranque · `preload.js` `bootProgress`/`bootReady` · IPC `dsp:bootProgress`/`dsp:bootReady`, `splash:init`/`splash:progress`/`splash:bye`.
- **State/data:** `_bootPct` (monótono) y `_bootT0` en el renderer; `bootDone`/`bootTimer`/`splashWin` en el main.
- **Invariants / gotchas:**
  - **La ventana del editor nace oculta** (`show:false`) y NO se muestra en `ready-to-show`: la revela `finishBoot()`. Si se toca eso sin más, el editor no aparece nunca. Salvavidas: `BOOT_TIMEOUT_MS` (25s) y `render-process-gone` también llaman a `finishBoot()`.
  - **Se muestra la principal ANTES de cerrar el splash** (y el cierre va 420ms después): al revés se ve el escritorio en el medio.
  - **El lienzo del splash mide siempre 1080×1080** y se escala con `transform`. Va posicionado con `left/top:50% + translate(-50%,-50%)`, **no** con `place-items:center`: con la ventana más chica que 1080 (p.ej. 949 en una pantalla 1080p) la pista del grid arranca en 0 y desborda → el lienzo quedaba corrido ~65px. Verificado: caja en x=0 y right=innerWidth.
  - **Hitos reales, texto del diseño:** `bootMark()` sólo manda el porcentaje; el texto lo elige `splash.html` con la tabla de umbrales del handoff, así no hay dos fuentes para el mismo string. El porcentaje es monótono (nunca retrocede) y se topa en 91 hasta que el arranque termina de verdad — el 100% significa "listo", no "casi".
  - **Mínimo en pantalla `BOOT_MIN_MS` (2400ms):** el arranque real puede tardar 300ms y el splash no puede ser un parpadeo (el splash viejo hacía lo mismo con sus 2 vueltas de logo).
  - **`package.json` › `build.files` es una LISTA EXPLÍCITA:** `splash.html` y `splash-preload.js` tuvieron que agregarse ahí. Sin eso el `.exe` empaquetado arranca sin splash y, como la ventana espera un `bootReady` que nunca llega, se ve vacío hasta el timeout.
  - `body.preboot` (R147) queda por si se abre `index.html` fuera de Electron; dentro de Electron ya no hace falta (la ventana está oculta), pero `bootReveal()` lo quita igual.
- **Status:** ✅ verificado por CDP (splash a los ~0.8s, editor 1600×900 = 16:9 exacto, splash cerrado a los ~4.0s, cero errores de consola)
- **Roadmap:** handoff launcher+splash, pantalla 1

## Status bar / tooltips
- **Purpose:** Info-view status line (instant tooltip text + **active-tool hint**), autosave status, hover tooltips (~1s) converted from `title` attrs.
- **Location:** app.js · tooltips IIFE, `#statInfo`/`#statAuto`. `updEnable`/`setDis` write `data-why` for disabled-control reasons. **[R149]** `TOOL_HINTS` (next to `setTool`) + `toolHintEl()`/`window.refreshToolHint()` inside the IIFE.
- **Invariants / gotchas:** tooltip contract "Name — what it does · SHORTCUT"; native `title` moved to `data-tip` once so the OS tooltip never double-shows. **[R149 · Rev1 §7]** `setInfo(null)` (and any element with an empty `data-tip`) no longer clears the bar: it falls back to the ACTIVE TOOL's hint, which the design shows permanently (RevDomo:645). The fallback builds a detached `<span data-tip=…>` so the same parser renders it — no second code path. `setTool` and `applyLang` both call `refreshToolHint()`; the IIFE calls it once at boot. `TOOL_HINTS` values are FUNCTIONS, not strings, so they re-evaluate `T()` after a language switch. Height is 22px (design §7). **[R216]** `flashStatus(msg,'err')` now prefixes `⚠ `, sets `font-weight:600` + a subtle amber pill (`rgba(229,181,103,0.12)`, `padding:2px 8px`, `border-radius:3px`) on `#statAuto`, and holds for 10s (was 6s) — all reset by the same `setTimeout` that restores the autosave/Ready text. Non-`err` flashes are untouched (still plain text, 2.6s).
- **Status:** ✅
- **Roadmap:** —
