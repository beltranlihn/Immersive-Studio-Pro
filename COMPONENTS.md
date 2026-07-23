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

## Índice maestro (jump table)

### 1 · Motor GL & shaders → [detalle](#1--motor-gl--shaders-detalle)
| Componente | Qué hace | Ubicación | Estado | Roadmap |
|---|---|---|---|---|
| GL2 context init | Contexto WebGL2 + helpers de compilación | app.js · `prog`/`sh` (~L118) | ✅ | — |
| PW (VSW/FSW) warp | Fisheye de domo + compositing de clip flat | app.js · `PW`/`LW` (~L213) | ✅ | R114 |
| PB (VSB/FSB) blit | Textura máster → pantalla (pan/zoom) | app.js · `PB`/`LB` (~L315) | ✅ | — |
| PFD fulldome | Máster fisheye dibujado 1:1 | app.js · `PFD`/`LFD` (~L340) | ✅ | — |
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
| Ruta sala 3D | Quads de muros + piso, cámara orbit/stand | app.js · `renderRoom3D`/`compositeFloorTex` (~L906) | ✅ | [D4] |
| `resize()` | Dimensiona #gl/#grid al #stage con DPR | app.js · `resize` (~L1233) · #stage | ✅ | — |
| Render-ahead cache | Cache de composite plano para playback pesado | app.js · `_raOn`/`raInvalidate`/`drawCacheMap` (~L801) | ✅🚧 flag-off | — |
| `markDirty()` (hub) | Marca dirty + título + invalida render-ahead | app.js · `markDirty` (~L4900) | ✅ | — |

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
| Header de pista (`.lanehdr`) | Header + operaciones de lane | app.js · renderTimeline · `.lanehdr` | ✅ | [L1],[U1] |
| Reorden de lanes | Arrastrar header para reordenar | app.js · `startLaneDrag` | ✅ | — |
| Módulo de audio anclado | Banda de audio sticky al fondo | app.js · renderTimeline · #audioZone | ✅ | [L2] |
| Gesto de mover | Move/copy de clip con ghost | app.js · `onTLMove`/`onTLUp` | ✅ | — |
| Trim contextual | ripple/roll/slip/slide (T) | app.js · `trimZone`/`applyTrim` | ✅ | [T2] |
| Trim por handle | `.hd.l`/`.hd.r` resize | app.js · `trimItem` / drag.trimL/R | ✅ | [T2] |
| Fades | Envelope de fade con handles de esquina | app.js · `startFadeDrag` · `.fadeh` | ✅ | — |
| Razor & split | Cortar clip / Ctrl+E | app.js · `razorCore`/`splitAtSelection` | ✅ | — |
| Selección temporal & marquee | Selección por span/rect → loop | app.js · `startTimeSelect`/`startMarquee` | ✅ | — |
| Snap | Snap a borde/playhead/marcador/grilla | app.js · `applySnap`/`snapTargets` | ✅ | [T2] |
| Zoom | Zoom anclado al cursor (+ scrollbar custom `#tlZoomBar` con caps de zoom) | app.js · `tlZoomAt`/`zoomToClip`/`renderZoomBar` | ✅ | — |
| Modo simple-clip | Agarre Premiere vs Ableton | app.js · `toggleSimpleClips` | ✅ | — |
| Regla & playhead | Scrub + arrastre de locator | app.js · #ruler pointerdown / `positionPlayhead` | ✅ | — |
| Marcadores / locators | Marcadores temporales con nombre | app.js · `addMarker`/`jumpMarker` | ✅ | — |
| Pestañas de secuencia | Barra de secuencias abiertas (drag para reordenar) | app.js · `renderSeqBar`/`startSeqTabDrag` · #seqTabs | ✅ | — |
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
| Toggle modo automatización | inlineCurves → body.automode | app.js · `toggleCurves`/`syncAutoUI` · #curvesBtn | ✅ | [A1] |
| Param del lane (track) | Un overlay por pista | app.js · `laneAutoP`/`openAuto`/`showAutomation` | ⚠️ | [A5]/[L3]/[L4] |
| Choosers device+param | Dropdowns Transform/Effects/fx | app.js · `autoDuo`/`autoDuoText` | ✅ | — |
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
| Diálogo de export | Selector códec/res/fps/rango/chunk + cola | app.js · `openExport` · #exOv | ✅ | [R1],[D2] |
| Cola de export | Registro de jobs uno-a-la-vez | app.js · `pumpExportQ` · #exQueue | ✅ | [D2] |
| `runExport` | Driver máster PNG/MP4/HEVC/HAP/still | app.js · `runExport` (~L4302) | ✅ | [R1],[R2],[D2] |
| Render in place | Hornear clip/nest o **selección de tiempo** → MP4 | app.js · `renderInPlace`/`renderRangeInPlace` | ✅ | R142 |
| WebCodecs + muxer | MP4 H.264/HEVC/AAC, sin FFmpeg | app.js · `Mp4Muxer`/`HAS_WC` (~L4385) | ✅ | — |
| Export HAP | Snappy + DXT GPU + QuickTime .mov | app.js · `hapFrame`/`movBuild`/`dxtEncodeCanvas` | ✅ | R100 |
| `makeProxy` | Proxy all-intra GOP=1 + m.frames | app.js · `makeProxy` (~L1477) | ✅ | [C3] |
| `attachExistingProxy` | Auto-sanar/asociar por hash+basename | app.js · `attachExistingProxy` (~L1459) | ✅ | [C3] |
| `demuxMP4` | Demuxer por rango (moov+samples) | app.js · `demuxMP4` (~L3978) | ✅ | R108 |
| ClipDecoder | Anillo WebCodecs decode-ahead | app.js · `makeClipDecoder` (~L4026) | 🚧 off | [C2] |
| vinst + servo | `<video>`+tex por clip, servo de velocidad | app.js · `vinstEnsure`/`ploop` | ✅ | [C2] |
| Frame cache | Cache LRU de texturas de m.frames | app.js · `_fcache`/`showFrame` (~L3946) | ✅ | [C2] |
| SSAA export render | Supersample→downsample | app.js · `renderExportFrame` (~L4242) | ✅ | — |

### 6 · Grado de color & Inspector → [detalle](#6--grado-de-color--inspector-detalle)
| Componente | Qué hace | Ubicación | Estado | Roadmap |
|---|---|---|---|---|
| Pipeline de color (FSW) | Pipeline completo en el fragment shader | app.js · `FSW`/`PW` (~L169) | ✅ | R116/R130/R132 |
| Import de LUT 3D | LUT `.cube` por clip como look final | app.js · `parseCubeLUT`/`loadLUT`/`bindClipLUT` | ✅ | R116 |
| Ruedas Lift/Gamma/Gain | Grado primario estilo DaVinci | app.js · `wheelRGB`/`bindClipGrade` | ✅ | R130 |
| Curvas de tono | Curvas luma+RGB → LUT 256×1 | app.js · `buildCurveData`/`clipCurveTex`/`bindClipCurve` | ✅ | R132 |
| Grado en PFD/PEQ | Fulldome/equirect ya reciben ruedas/curvas/LUT (paridad con FSW) | app.js · `bindClipLUT(c,LFD/LEQ)` en draw PFD/PEQ | ✅ | R138 (gap cerrado) |
| Grado máster de secuencia | Grado global sobre el composite (numérico + ruedas + curvas + LUT; preview/export/NDI/Spout) | app.js · `applyMasterGrade`/`_MG` · `renderMasterGrade`/#insMaster | ✅ | R139/R140/R141 (completo) |
| `renderInspector` | Reconstruye + sincroniza el inspector | app.js · `renderInspector`/`refreshInspector` | ✅ | [I1]/[I2] |
| 4 secciones colapsables | Transform/Clip/Color/Motion | app.js · `applySecCollapse` · #colorRows | ✅ | [I1]/[I2] |
| Filas de parámetro | Fader + diamante + arco de mod | app.js · `buildRows`/`startValDrag` · `.prow` | ✅ | [A1] |
| Máscara dropdown + PNG | Máscara shape/PNG + tamaño | app.js · `MASK_IDX` · #maskSel | ✅ | — |
| Máscaras pen-tool | Multi máscara por puntos, invert/feather | app.js · `buildPenMaskUI`/`rasterizePenMasks` | ✅ | [I3] |
| Editor de texto | Fuente/peso/alineación/fuentes propias | app.js · `renderTextMedia`/`loadCustomFont` | ✅ | [U8] |
| Editor de shape | Rect/elipse/línea, fill+stroke | app.js · `renderShapeMedia` · #shpType | ✅ | — |
| Inspector de audio | Waveform + volumen + fades | app.js · `buildAudioInspector` · #insAudio | ✅ | — |

### 7 · Sala/360, Compose/Nest & formatos → [detalle](#7--sala360-composenest--formatos-detalle)
| Componente | Qué hace | Ubicación | Estado | Roadmap |
|---|---|---|---|---|
| `renderRoom3D` | Dibuja la sala 3D (muros+piso+grilla) | app.js · `renderRoom3D` (~L906) | ✅ | [D4] f2 |
| `buildRoomGeo` | Geometría de quads de la sala (cacheada) | app.js · `buildRoomGeo` (~L863) | ✅ | — |
| Tira de muros desenrollada | Compositing rectangular, costuras, wall-mask | app.js · `roomWallScissorRects` (~L2621) | ✅ | — |
| Piso / compositeFloorTex | Piso como secuencia flat aparte | app.js · `compositeFloorTex` (~L856) | ✅ | [F4] |
| `drawRoomGrid2D` | Grilla 2D por-muro (px) + costuras + labels | app.js · `drawRoomGrid2D` (~L1154) | ✅ | — |
| `roomCameraMVP` | Cámara Orbit + Viewer/stand | app.js · `roomCameraMVP` (~L901) | ✅ | — |
| `roomSetupDialog` | Setup de sala: muros/roles/piso/tira | app.js · `roomSetupDialog` (~L5127) | ✅ | [F3][F4][F5] |
| `newRoomProject` | Crear secuencias de muros + piso | app.js · `newRoomProject` (~L5256) | ✅ | — |
| Export por-muro/piso | Tira completa / crop por muro / piso | app.js · `queueJob` (~L4887) · `opt.wall`/`opt.seqId` | ✅ | [R1][D2] |
| Secuencias = nest media | activeSeq, switch/load/save | app.js · `loadSeqIntoState`/`switchSeq` (~L4926) | ✅ | [R3] |
| nestSelection / makeClipUnique | Anidar clips; copia independiente | app.js · `nestSelection`/`makeClipUnique` | ✅ | — |
| Compose media (`m.comp`) | Nest generado por parámetros | app.js · `createComposition`/`regenComposeNest` (~L6086) | ✅ | [N1][N2][N3] |
| compLayout / compElProps | Generadores de layout domo & flat | app.js · `compLayout`/`compElProps` (~L6023) | ✅ | [N5] |
| `_layBase` [N4] | Preservar delta manual al recomponer | app.js · (~L6098/6119) | ✅ | [N4] |
| Dome Fill / Randomize | domegrid + jitter + tiles no deformados | app.js · `openCompose`/`drawComposePreview` (~L6129) | ✅ | [N5] |
| `makeAdjustClip` | Capa de ajuste sin media | app.js · `makeAdjustClip` (~L6787) | ✅ | — |
| Diálogos setup (domo/flat) | Diálogos de creación de formato | app.js · `domeSetupDialog`/`flatResDialog` (~L5001) | ✅ | [F1] |
| `newProject` | Reset + crear proyecto domo/flat | app.js · `newProject` (~L5245) | ✅ | — |
| `openSeqSettings`/`applyRes` | Resolución editable + cobertura (live) | app.js · `openSeqSettings` (~L5200) | ✅ | [F1] |
| `updFmtChip`/`updModeUI` | Chip de formato + UI por modo | app.js · `updFmtChip`/`updModeUI` (~L5196) | ✅ | [F2] |

### 8 · Shell, media & UI chrome → [detalle](#8--shell-media--ui-chrome-detalle)
| Componente | Qué hace | Ubicación | Estado | Roadmap |
|---|---|---|---|---|
| BrowserWindow / shell | Ventana única + salvavidas crash/hang/close | main.js · `createWindow` (~L43) | ✅ | — |
| GPU/RTX forcing | Preferir GPU discreta sin flags de blackout | main.js · `preferHighPerfGPU` (~L12) | ✅ | — |
| Single-instance + assoc | Reusar ventana, abrir path de doble-clic | main.js · `rdomeFromArgv`/`second-instance` | ✅ | — |
| IPC handlers | Diálogos, disco IO, streaming, métricas | main.js · (~L114-232) | ✅ | — |
| DSP bridge | API segura `window.dsp` renderer↔main | preload.js · (~L48) | ✅ | — |
| Wrapper NDI | `dsp-ndi-send` salida+entrada | preload.js · `ndiApi` (~L8) | ✅ | — |
| Wrapper Spout | `dsp-spout-send` share GPU local | preload.js · `spoutApi` (~L40) | ✅ | [V3] |
| Salida NDI/Spout | Broadcast del máster de domo limpio | app.js · `startNDI`/`startSpout` (~L1028) | ✅ | — |
| Entrada NDI | NDI en vivo como clip de media | app.js · `addNdiInput`/`makeNdiMedia` (~L1089) | ✅ | [V3] |
| `renderMedia` | Reconstruye el panel de media | app.js · `renderMedia` (~L1628) · #mediaList | ✅ | [M1],[M2] |
| media item/tile | Fila/tile + badges + wiring | app.js · `makeMediaItem`/`makeMediaTile` (~L1698) | ✅ | [M3],[M4] |
| Selección de media | Single/range/toggle multi-select | app.js · `selectMedia` (~L1774) | ✅ | [M2] |
| Import | Archivos/drag/carpetas/secuencias | app.js · `importFiles`/`importDropped` (~L1264) | ✅ | [M5] |
| Carpetas | Árbol de carpetas anidadas + colores | app.js · `drawFolder` (~L1663) · #newFolderBtn | ✅ | [M1] |
| Búsqueda de media | Filtro de texto con debounce | app.js · (~L5500) · #mediaSearch | ✅ | — |
| Serialización | serProject/serMedia/serClip (v4) | app.js · `serProject` (~L5230) | ✅ | — |
| `saveProject` | Escritura atómica `.isp` + `.bak` | app.js · `saveProject` (~L5231) | ✅ | — |
| open/load | Abrir + reconstruir estado | app.js · `loadProject`/`openProjectPath` (~L5296) | ✅ | — |
| reloadMedia/replace | Relink/swap/adoptar archivos | app.js · `reloadMedia`/`replaceMedia` (~L5335) | ✅ | — |
| autosave/recovery/recents | Autosave a disco, snapshots, recientes | app.js · autosave (~L5482) / `addRecent` (~L2089) | ✅ | — |
| landing/splash/loading | Pantalla de inicio + loop de logo | app.js · `showLanding`/`showSplash`/`startLogoLoop` (~L2073) | ✅ | [U9] |
| Barra de menús | Dropdowns File/Edit/Window | app.js · `openAppMenu` (~L5809) · #menubar | ✅ | [D3] |
| Sistema de menú contextual | Primitiva `openMenu`/`closeMenu` | app.js · `openMenu` (~L5788) | ✅ | — |
| Command palette | Ctrl+K/F1/? todos los comandos | app.js · `openPalette` (~L5972) · #helpBtn | ✅ | — |
| Diálogos estilados | appPrompt/appAlert/appConfirm | app.js · (~L2042-2064) | ✅ | — |
| Paneles collapse/resize | Rails + gutters + workspace | app.js · `setPaneCollapsed` (~L5533) | ✅ | — |
| i18n | T/applyLang/setLang | app.js · `applyLang` (~L6256) | ✅ | — |
| Perf mode | Visor a ventana completa | app.js · `setPerfMode` (~L5613) · #perfBtn | ✅ | [V2] |
| Ventana solo-visor | Pop-out que sigue al editor (2D/3D); domo con cámara orbit propia | app.js · `openViewerWindow`/`renderViewer` | ✅ | — |

---

## Deuda técnica & gaps detectados en el mapeo

- **🗄️ Automatización legacy — ARCHIVADO (R137).** Las funciones muertas (`_autoOff` override/re-enable + perform-and-bake `recWrite`/`bakeRecorded` + `#autoRecBtn`) se sacaron del software y viven en `_backup/deprecated/20260722-automation-override-and-perform-bake.js` (recuperables). Verificado por CDP: motor de automatización intacto. **Barrido menor HECHO (R137):** removidos los reads no-op de `_autoOff` en sepAuto, returnToDefault, `drawAutoCurve` (var `off`), fxKfToggle y borrado de fx — solo queda `_autoOff` en un comentario (app.js L463). Curva renderiza OK (verificado por píxel).
- **✅ Sub-lanes apiladas — LIMPIADO (R143).** Confirmado código muerto (mapeo arch-explorer): el render de sub-carriles apilados `appendAutoLanes` ya estaba neutralizado por `[A5]` (`return;` de cabeza), así que `lane._auto`/`lane._autoH` + `addAutoLane(At)` + `laneAutoH` y la lista legacy de clip `c._auto` (`closeAuto` + copia en `sepAuto` + `returnToDefault` + filtro en fx-delete) no dirigían nada. Archivado en `_backup/deprecated/20260723-automation-sublanes-and-clip-auto.js` y quitado. Único modelo vigente: `lane._autoP` (una superposición por pista vía `laneAutoP`/`attachClipAuto` + chooser de cabecera). Data vieja en `.isp` (lanes[]._auto) queda ignorada (sin migración necesaria). Verificado por CDP.
- **✅ Gap de grado en fulldome/equirect — CERRADO (R138).** Las rutas PFD/PEQ ahora llaman `bindClipLUT(c,LFD/LEQ)` (que encadena grade+curve) y los shaders FSFD/FSEQ aplican ruedas/curvas/LUT igual que FSW. Las tres funciones bind aceptan un struct de ubicaciones `L` (default `LW`). LUT en unit 2, curva en unit 3 (libres en PFD/PEQ). Identidad por defecto → clips existentes sin cambio. Verificado: ambos shaders compilan+linkan en WebGL2 real.
- **🚧 [D2] cola de export = snapshot congelado** — la cola actual muta el `state` vivo; falta el "snapshot congelado al enviar" que pide [D2].
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
- **Key symbols:** `P3` (~L389), `L3` struct (~L390), `buildDomeMesh(covHalf)` (~L396, cached by `_domeCov`; R=64 rings × S=256 segments), `domeVAO`/`domeCount`/`_domeVB` (~L391), initial `buildDomeMesh(HALF_PI)` (~L409)
- **Invariants / gotchas:** `u_flipx` = the ONE intentional 2D↔3D handedness inversion — do NOT "fix" it. Mesh UV (`rho=rr`) is coverage-independent; only cap geometry (`zen=rr·covHalf`) changes → coverage switch just re-uploads the VB. S=256 so the rim polygon hides facets ([R94f]). Rim/spring line is thin GREY (was amber) per [U4] (FS3 ~L386).
- **Status:** ✅ stable
- **Roadmap:** [U4] (spring line grey), [dome-coverage-r114]

## PR — 3D room program (VSR/FSR): walls + floor quads
- **Purpose:** Renders the 360 immersive room in 3D: textured wall quads (each samples its sub-rect of the unwrapped strip) + floor quad (samples the floor sequence). Multi-pass (outside translucent / inside opaque / floor) with per-face shade + normal-based cull.
- **Location:** app.js · `VSR` (~L412), `FSR` (~L415), `PR=prog(VSR,FSR)` (~L422) · draws via `roomVAO`/`roomVB`
- **Key symbols:** `PR` (~L422), `LR` struct (~L423), `roomVAO`+`roomVB` (~L424), geo cache `_roomGeo`/`_roomGeoSeq` (~L425), floor FBO `_roomFloorFBO`/`_roomFloorTex`/`_roomFloorSize` (~L426), `compositeFloorTex(m,sz)` (~L856)
- **Invariants / gotchas:** `u_pass`: >1.5 floor (opaque), >0.5 inside (opaque, `inward>0` else discard), else outside (translucent `u_backA`, `u_outTex` toggles texture vs flat). `inward = nrm·(cam−wp)`. `compositeFloorTex` rebinds FBO → caller must restore viewport/FBO (see ~L910-911).
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
> (`if(_raOn)raInvalidate()`). Missing a re-render leaves the viewport stale. `markDirty()` (L4900) both
> flags the project dirty AND calls `raInvalidate()`. This is the single most fragile contract of the file.

## Composite FBO + master texture
- **Purpose:** Single square master render target (`COMP`=2048²) into which every clip is composited. View-independent → the same texture feeds the 2D blit, the 3D dome mesh, and the room walls.
- **Location:** app.js · `COMP` const (L3) · `compTex` (L430) · `compFBO` (L434) · `setCompSize()` (L439).
- **State owned:** `compTex`, `compFBO`, `compSize` (module-level, not in `state`).
- **Key symbols:** `COMP=2048`, `compSize` (live preview-quality res, 256..COMP), `setCompSize(s)` reallocs `compTex` only. Blend init at L428 (`blendFuncSeparate` premultiplied-alpha-safe).
- **Invariants / gotchas:** Preview quality (`setCompSize`) shrinks ONLY this master texture — never the screen canvas, dome mesh, grid, or 2D overlays (comment L436). Texture is always square regardless of sequence aspect; flat/room fit inside via `_compAspect`.
- **Status:** ✅
- **Roadmap:** [D4] wants this to become an interchangeable "output target" layer (dome fisheye / N-wall room / 3D grid) over the same composite.

## Master `render()`
- **Purpose:** Top-level frame draw. Builds/reuses the master composite for `state.playhead`, then dispatches to one of three view paths (room-3D / dome-3D / 2D-blit) based on `state.view.mode` + sequence mode.
- **Location:** app.js · `render()` (L921).
- **State owned:** reads `state.view.mode` ('2d'/'3d'), `state.seqMode`, `state.playhead`, `state.seqW/seqH`, `state.view.three` ('orbit'/'spec'), grid/checker/hfade flags.
- **Key symbols:** sets globals `_drawFlat=isFlat()`, `_roomWrap=isRoom()`, `_compAspect=seqW/seqH`, `_arTime`. Composite step: `raGet(playhead)` cache hit → reuse `_raHit`; else `prepNests()` + `composite()` into `compFBO` + `raStore()`. Branch: `mode==='3d'&&isRoom()`→`renderRoom3D()` (L930); `mode==='3d'&&!flat`→dome mesh program `P3`/`domeVAO`, `cameraMVP`, `buildDomeMesh(curCovHalf())` (L931); else→2D blit program `PB`/`quadVAO` + `drawGrid2D()` (L943). Pop-out viewer via `renderViewer(_srcTex)` (L955).
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
- **Purpose:** Renders the 360-room as textured wall quads (sampling their sub-rect of the composite strip) + floor (from `compositeFloorTex`), with an orbit / viewer-stand camera.
- **Location:** app.js · `renderRoom3D(wallsTex)` (L906) · `compositeFloorTex()` (L856) · `ensureRoomFloorFBO()` (L849).
- **State owned:** `state.view.three` ('spec'=viewer-stand vs orbit), `state.view.checkerBg/roomOutTex`, `seq.room`, `room.floorSeqId`.
- **Key symbols:** program **PR**/`roomVAO`; `buildRoomGeo(seq)` cached by `_roomGeoSeq`; two-pass depth (inside opaque, outside translucent). Floor is a separate flat sequence composited to `_roomFloorTex`.
- **Invariants / gotchas:** `compositeFloorTex` rebinds FBO/viewport → must restore (L911). Walls strip is by exact pixels; cm are 3D-geometry-only.
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
- **Purpose:** Optional frame cache of the flattened master composite (downscaled 1024² via `blitFramebuffer`), so heavy playback replays one flat texture instead of recompositing N layers + decoding N videos. View-independent → serves both 2D and 3D.
- **Location:** app.js · state block (L801) · `raInvalidate()` (L804) · `raGet()` (L806) · `raStore()` (L807) · `raReset()` (L803) · `raHas()`/`_raFrame()` (L805,818) · `raPrerenderRange()` (L823) · idle `raIdleTick`/`raStartIdle`/`raStopIdle` (L835,832,831) · `renderAheadWork`/`renderAheadOff` (L840,847) · `drawCacheMap()` (L817).
- **State owned:** `_raOn` (flag, default off), `_ra` (Map frame→{tex,last,gen}), `_raPool` (tex pool), `_raGen` (generation counter), `_raClock` (LRU), `_raFBO`; mirrors `state.renderAhead`.
- **Key symbols:** `RA_SIZE=1024`, `RA_MAX=120` (LRU cap). `raInvalidate()` just bumps `_raGen` (cheap invalidate, no tex delete). `raGet` returns tex only if `gen===_raGen`. `drawCacheMap` paints the Premiere-style cached-frame strip on `#rulerCv`.
- **Invariants / gotchas:** `raStore` never caches when `anyFeedbackFx()` (Trails/feedback is path-dependent → scrubbing would bake temporally-wrong echoes, L807). Every edit path guards `if(_raOn)raInvalidate()` — the manual-binding invariant extends here. `markDirty()` calls `raInvalidate()`.
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
- **Invariants / gotchas:** Manual binding — nothing auto-renders; every state mutation must call this or `scheduleTimeline()`. Full rebuild costs ~100ms at 300 clips → trim/move drags avoid it via `positionClips()`. Header column (`#trackHdr`) is given a bottom `marginBottom = hsb` so it matches `#tlscroll` height and the sticky audio module pins identically (L1989). `_hasVideo`/`_hasAudio` gate the VIDEO label (rulerpad corner) and the AUDIO collapse bar.
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
- **Location:** index.html · `.transport` (L784–810), `.timeline` (L813–835); `#seqTabs` (L815), `#toolRail` (L817–824), `#trackHdr`>`.rulerpad`+`#laneHeaders`+`#audioHeadZone` (L825), `#tlscroll` (L826) > `#ruler`(canvas `#rulerCv`, `#clipExtent`, `#phTri`) + `#workArea` + `#timeSel` + `#tracks` + `#playhead` + `#snapline`. CSS: `.tlscroll`(L408), `.trackhdr`(L302).
- **State owned:** —
- **Key symbols:** `#tracks` (clip rows host + sticky `.audiozone`), `#trackHdr` scrolls natively in sync with `#tlscroll`.
- **Invariants / gotchas:** Audio rows live inside a sticky `#audioZone` div appended last inside `#tracks` (so `#tracks .lane` still matches them). `#trackHdr` is `flex-direction:column` so `#audioHeadZone` (`margin-top:auto`) pins to the bottom in lockstep with the clip column ([L2]). `.trackhdr` width is fixed 152px.
- **Status:** ✅
- **Roadmap:** —

## Transport bar
- **Purpose:** Playback + edit controls above the timeline: mark in/out, play, go start/end, automation REC, follow-playhead, timecode readout, TC/Frames toggle, loop, locator prev/add/next, Snap, Simple-clip, automation (curves) toggle, zoom in/out.
- **Location:** index.html `.transport` (L784–810). Handlers: `#tlZoomIn/#tlZoomOut` (L5647–5648), `#prevMk/#addMk/#nextMk` (L5646), `#snapBtn`→`toggleSnap()` (L2346), `#simpleClipBtn`→`toggleSimpleClips()` (L2350).
- **State owned:** `state.tl.pxPerSec`, `state.tl.snap`, `state.tl.simpleClips`, `state.loop`
- **Key symbols:** `#markIn/#markOut`, `#playBtn`, `#autoRecBtn`, `#followBtn`, `#tc/#bbt`, `#tcModeSeg`, `#loopBtn`, `#curvesBtn` (automation toggle, key A), `#gridReadout` (removed per [U6]).
- **Invariants / gotchas:** Zoom buttons clamp `pxPerSec` to [0.1, 600]. `#curvesBtn` toggles `state.inlineCurves` (automation subsystem).
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
- **Purpose:** Per-clip rendered node built inside each lane row: fill/tint, scrim, head thumbnail, fade envelope SVG, loop marks, title band, proxy badge, live-anim badge, resize handles, fade handles, keyframe strip.
- **Location:** app.js · built in `renderTimeline` clip loop (L1906–1934). Innerhtml assembled L1926.
- **State owned:** reads `c.start/dur/lane/disabled/loop/fadeIn/fadeOut/kf/color/name/adjust`, `state.selIds/selId/selGroupId`
- **Key symbols:** classes `.clip .sel .gsel .offline .off .muted .audioclip`; children `.fill`, `.scrim`, `.cthumb`, `.fadeenv` (SVG), `.tt` (title, tinted `clipTint`), `.cpx`/`.cpxbar` (proxy), `.animbadge`, `.mutebadge` (speaker-mute glyph), `.hd.l`/`.hd.r` (resize handles), `.fadeh.fadeL`/`.fadeh.fadeR` (fade handles), `.kfstrip`>`.kfd` (keyframe diamonds), `.xfade` (crossfade X). Helpers: `clipTint()`, `textOn()`, `hasLiveAnim()`, `loopCycleSec()`.
- **Invariants / gotchas:** `cd.style.width=Math.max(14,c.dur*pps)` — min 14px. Missing/deleted media → `.offline` (red, [M4]). `c.disabled` → `.off` diagonal hatch (not colour-only, colourblind-safe). `lane.mute && !c.disabled` → `.muted` [T5]: opacidad ALTA (`.82`, sin trama → sigue muy visible) + `.mutebadge`; `.off` es el estado fuerte y gana si el clip está deshabilitado. Clip carries its OWN colour; lane colour only tints the header. `.kfstrip` shown live for selected clip (with `data-t` handlers), dimmed passive strip otherwise. Motion-chip drop targets set here (dragover/drop → `addAnimPreset`).
- **Status:** ✅
- **Roadmap:** [T2] frame-snap trim

## Track header (.lanehdr) & lane operations
- **Purpose:** The 152px-wide row header for each lane (colour bar, tag/name, collapse chevron, mute/solo, resize grip); hosts drag-to-reorder, rename, context menu, and (in automation mode) the device/param choosers.
- **Location:** app.js · header build in `renderTimeline` (L1941–1969). Ops: `addLane()` (L2024), `removeLane()` (L2036), `duplicateLane()` (L2163), `renameLane()` (L2152), `startLaneDrag()` (L2173), `trackCreateItems()` (L2032), `defLanes()` (L4916).
- **State owned:** `state.lanes[]` (each: `{id,name,tag,kind,color?,mute?,solo?,collapsed?,h?,_autoP?}`), `state.selLane`
- **Key symbols:** classes `.lanehdr .sel .collapsed .aud`; buttons `[data-m=collapse|mute|solo]`, `.laneres [data-m=resize]`. `laneH(li)` (L109). Constants `LANE_DEF_H=82, LANE_MIN_H=34, LANE_MAX_H=260, LANE_COLLAPSED_H=20` (L107), `AUDIO_LANE_H=41` (L108, fixed), `TRACK_COLORS` (L30). `lanesTopDown()` display order.
- **Invariants / gotchas:** Selecting a track deselects the clip (mutual exclusion, [R93]). Video lanes grow upward; audio grows DOWNWARD (module displays audio index-descending). Per-lane resize is VIDEO-ONLY — audio is fixed half-height. Resize handler mutates `lane.h` clamped to [MIN,MAX] and calls `scheduleTimeline()` (must not move the view — [L1]). `removeLane` keeps ≥1 video and ≥1 audio lane.
- **Status:** ✅
- **Roadmap:** [L1] resize-view glitch, [U1] VIDEO/AUDIO same grey-bar style

## Lane reorder — startLaneDrag()
- **Purpose:** Drag a track header vertically to reorder lanes; remaps every clip's `lane` index and `state.selLane`, handling the top-down display reversal.
- **Location:** app.js · `startLaneDrag()` (L2173–2195), guard flag `_laneJustDragged` (L2172)
- **State owned:** `state.lanes`, remaps `state.clips[].lane`, `state.selLane`
- **Key symbols:** `lanesTopDown()`, drop indicator chip, `oldToNew` remap map.
- **Invariants / gotchas:** `hd.onclick` bails if `_laneJustDragged` (drag must not also fire a select). Bound in header pointerdown (L1951), skipped when the target is a `[data-m]` control or contenteditable.
- **Status:** ✅
- **Roadmap:** —

## Pinned audio module (#audioZone / #audioHeadZone)
- **Purpose:** Premiere-style bottom-pinned audio band: audio lane rows live in a sticky `.audiozone` at the bottom of `#tracks`; the AUDIO bar tops it and toggles collapse of the whole module.
- **Location:** app.js · audio-zone assembly in `renderTimeline` (L1892–1904, 1971–1976). Scroll sync: `audioZoneScrollBy()` (L2566), wheel handlers (L2567–2575).
- **State owned:** `state.tl.audioCollapsed`, `state.tl._audioScroll`
- **Key symbols:** `.audiozone`, `.audiozone.hdr` (`#audioHeadZone`), `.trackdivider.collapsible` (AUDIO bar), `.audiozone.covers` (top shadow when video hidden behind).
- **Invariants / gotchas:** Module is auto-height (exactly as tall as its tracks; no drag-resize, no internal scroll — [R110]). Appended LAST inside `#tracks` after all video rows so it pins. Wheel over audio never moves the video area; Alt-wheel resizes only that section's tracks (`wheelResizeLanes`). Move ghosts for audio clips must be appended to the audiozone (its own offsetParent) — L2420.
- **Status:** ✅
- **Roadmap:** [L2] minimizable audio anchored at bottom (glitch with few video tracks)

## Move gesture — onTLMove / onTLUp / ghosts
- **Purpose:** Ableton-style clip move: original stays put, a translucent ghost shows the destination, applied on pointerup. Supports multi-select (relative lane shift), lane retargeting (single), Alt-drag copy, and edge-snapping on both clip edges.
- **Location:** app.js · `onTLMove()` (L2427–2456), `onTLUp()` (L2473–2483), `showMoveGhosts()` (L2416), `clearMoveGhosts()` (L2415), `duplicateClipAt()` (L2424).
- **State owned:** `drag` (fields `_applied/_lane/_laneDelta/_copy/items`), `state.selIds/selId`
- **Key symbols:** `applySnap()`, `showSnap()`, `mediaById`, `seqDur`, `sepAuto`, `rebuildMaskTex`.
- **Invariants / gotchas:** Single move picks the lane under cursor (same kind only); multi move applies a RELATIVE `_laneDelta` only if every destination lane exists and kind-matches. End edge snaps too — whichever edge is nearer wins. Undo recorded only if something actually changed. Alt = copy (Premiere); Ctrl is free.
- **Status:** ✅
- **Roadmap:** —

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

## Fades — startFadeDrag()
- **Purpose:** Drag the `.fadeh` corner handle inward to set `fadeIn`/`fadeOut`; applies to every selected clip. Fade is drawn as the real opacity-envelope polyline (`.fadeenv` SVG) over the clip.
- **Location:** app.js · `startFadeDrag()` (L2485–2489). Fade rendering in `renderTimeline` (L1913–1919). Handles `.fadeh.fadeL/.fadeR` (L1926).
- **State owned:** `c.fadeIn`, `c.fadeOut`
- **Key symbols:** `refreshInspector()` on up; envelope polyline points computed from `fiPx/foPx`.
- **Invariants / gotchas:** `nf` clamped to `[0, c.dur]`. Multi-clip fade when >1 selected. `stopPropagation` prevents starting a move.
- **Status:** ✅
- **Roadmap:** —

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
- **Purpose:** Snapping of clip edges, playhead, markers to other clip edges / playhead / markers (always on) and to the grid (gated by the Snap button). Alt bypasses at call sites.
- **Location:** app.js · `applySnap()` (L2353–2356), `snapTargets()` (L2335), `snapGrid()` (L2340), `showSnap()` (L2357), `gridSec()`/`gridBaseAdaptive()`/`gridLabel()` (L2337–2341), `toggleSnap()` (L2346). Grid controls `gridNarrow/gridWiden/gridToggleFixed` (L2343–2345).
- **State owned:** `state.tl.snap` (default false, L80), `state.tl.gridDiv/gridFixed/gridFixedBase`
- **Key symbols:** snap tolerance `9/pxPerSec` px; `#snapline` (`.free` variant). Adaptive grid steps array (frame-aware).
- **Invariants / gotchas:** Edge/playhead/marker snap is ALWAYS on ([R80b]); the Snap button gates ONLY the grid. `snapGrid` returns bars-grid unconditionally in bars mode, else grid only when `state.tl.snap`.
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
- **Key symbols:** `#prevMk/#addMk/#nextMk`; dashed line z-index 5.
- **Invariants / gotchas:** Markers are a snap target. Add drops straight into inline rename (deferred a tick so the triggering key doesn't type into the field). NOTE: `serProject` currently serializes `markers:[]` at top level (L5230) — active-sequence markers live in the nest media.
- **Status:** ✅
- **Roadmap:** —

## Sequence tabs (#seqTabs) — renderSeqBar
- **Purpose:** Premiere-style tabs for open sequences/nests; click to switch, dblclick rename, right-click options, ✕ to close, ＋ to create, **drag to reorder** ([R3]).
- **Location:** app.js · `renderSeqBar()` (L5221–5229), `startSeqTabDrag()` (before `renderSeqBar`), `switchSeq()` (L4936), `renameSequence()` (L4943). DOM `#seqTabs` (index.html L815).
- **State owned:** `state.openSeqs[]`, `state.activeSeqId`
- **Key symbols:** `.seqtab .on`, `.seqlab`, `.seqx`, `.seqadd`; `newSequenceDialog`, `closeSeqTab`, `openSeqSettings`, `startSeqTabDrag`, flag `_seqDragged`.
- **Invariants / gotchas:** Sequences = media `kind:'nest'`; switching saves the active seq (`saveActiveSeq`) then loads the target into `state.clips/lanes`. [R3] `startSeqTabDrag` (pointerdown, 5px threshold, horizontal analog of `startLaneDrag`) reorders `openSeqs`; a real drag sets `_seqDragged` so the trailing click doesn't ALSO `switchSeq`. Order persists (serialized in `serProject`).
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
- **Key symbols:** `isFxKey`, `isFxtKey`, `laneKey`, `paramDef`, `fxBaseFor`, `setParamBase`
- **Invariants / gotchas:** [R93] fxt-lanes name an EFFECT TYPE; each clip resolves independently — `laneKey` returns null for a clip lacking that effect (draws/edits nothing). `paramDef` works with a null clip for fxt-keys (empty-track headers).
- **Status:** ✅
- **Roadmap:** —

## Track-level automation lane (lane._autoP / laneAutoP / openAuto)
- **Purpose:** [R93/A5] one automation overlay per track. `lane._autoP` = the track's primary param (the two header dropdowns pick it). `laneAutoP` resolves the effective param (saved choice, else first animated, else `'opacity'`). `openAuto(c,p)` arms a param on its track. `showAutomation(c)` reveals the clip's animated params as the single overlay.
- **Location:** app.js · `openAuto` (L3283), `closeAuto` (L3284), `laneFxTypes`/`laneFxKeys` (L3286/3287), `laneHasKf` (L3288), `laneAutoP` (L3290), `addAutoLaneAt`/`addAutoLane` (L3294/3300), `showAutomation` (L3578)
- **State owned:** `lane._autoP`, `lane._auto` (extra sub-lane param list)
- **Key symbols:** `laneAutoP`, `openAuto`, `showAutomation`, `addAutoLaneAt`
- **Invariants / gotchas:** [A5] one automation at a time — `showAutomation` sets a SINGLE overlay. `lane._auto` (legacy stacked sub-lanes) still exists via `addAutoLaneAt` ("Show Automation in New Lane") — partial tension with the one-at-a-time model (see Task #44). fxt choice dropped if its effect type leaves the track.
- **Status:** ⚠️
- **Roadmap:** [A5], [L3], [L4]

## Device+param choosers (autoDuo / autoDuoText)
- **Purpose:** The Ableton chooser pair in the track/sub-lane header: device select (Transform | Effects | each reactive fx type on the track) + parameter select. `autoDuoText` shows the same info as plain 2-line text when the lane lacks focus; clicking swaps to live selects.
- **Location:** app.js · `XFORM_P` (L3302), `autoDuoText` (L3306), `fxParamLabel` (L3313), `autoDuo` (L3314)
- **State owned:** writes back via `onPick` → `lane._autoP`
- **Key symbols:** `autoDuo`, `autoDuoText`, `XFORM_P`, `◆` marker = already automated on this track
- **Invariants / gotchas:** [R94b/R95·E4] only the focused lane shows the two selects; others render as text. Selects stop pointer/click/dblclick propagation so the track header's select/drag-reorder/rename don't fire.
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
- **Invariants / gotchas:** Deterministic in export (everything derives from `t`, never wall-clock). [R95·D4] `m.frz` freezes a layer's output. Audio band names must match `computeBands` (`bass|mid|treble|bright`). `evalP` stays untouched — the stack rides on top only in `evalR`.
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
- **Purpose:** Unreal-style infinite Rotator/Translator: `c.anim=[{param,mode,speed,amp,phase,on,wetKf}]`, `mode:'linear'` (ramp) or `'wave'` (sine). Added on top of the base value at render time only (`evalR`), keyframeable dry/wet (`evalWet`).
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
- **Location:** app.js · `_exJobs`/`_exq` (~L4747-4748), `exJobRow`/`exPaintJob` (~L4749), `exCancelJob`/`exCancelActive` (~L4762), `updExportUI` (~L4767), `pumpExportQ` (~L4773) · DOM: `#exQueue .qjob`, `#statXBtn`, `#exportBtn .exbadge`.
- **State/data:** rec `{id,name,status:queued|running|cancelling|done|cancelled,p,labelTxt,opt}`; `opt._rec` back-reference.
- **Key symbols:** `job.prog/label/done` callbacks built in `addJob`; `stat()` throttled 500ms + `DSP.setProgress` (Windows taskbar). `cancelExport` flag polled by encoder loops.
- **Invariants / gotchas:** queued cancel = splice from `_exq`; running cancel = set `cancelExport=true`. Finished/cancelled jobs pruned only on modal close.
- **Status:** ✅
- **Roadmap:** [D2] (queue exists; missing project-snapshot isolation + off-thread worker)

## runExport (master export driver)
- **Purpose:** Renders the timeline frame-by-frame at export resolution and writes PNG-seq / MP4(H.264) / MP4(HEVC) / HAP MOV / still PNG. Handles render-in-place isolation, per-wall & floor room export, SSAA, audio bake.
- **Location:** app.js · `runExport(opt)` (~L4302).
- **State/data:** `opt={codec,res,fps,bitrate,chunks,range,job, rangeT?,isolateClips?,outPath?,wall?,seqId?,silent?}`. Globals flipped: `exporting`, `_exportQuality`, `_drawFlat`, `_roomWrap`, `_compAspect`, `nestSize`, `cancelExport`.
- **Key symbols:** range resolution (`opt.range` 'inout'|'clips', `opt.rangeT` overrides for RIP); `eW/eH/qRes/dimStr/filePre` dims (wall vs flat vs dome-square); `seekExport(t)`→`vinstSeek`; `prepNests`; `renderExportFrame` (dome) / `composite` (png flat); `exportAudioMix`→`audioBufferToWav`/`muxAudioAAC`/`audioPCM16`. Decodes source-clip audio tracks into `m._exAudio` (≤1.5 GB cap via `decodeAudioData`). `_rsSeq` switches to `opt.seqId` and restores.
- **Invariants / gotchas:** never export over live transport (pauses first). `_exportQuality=true` binds vinst to ORIGINAL media (not proxy). MP4 streams to disk via `Mp4Muxer.StreamTarget`+`DSP.fileWriteAt` (no multi-GB RAM buffer); browser falls back to `ArrayBufferTarget`. Early-return on cancelled Save dialog does FULL cleanup (leaked `_exportQuality` once = "editor went crazy after export"). Backpressure caps `enc.encodeQueueSize` and `pending` disk writes. Cleanup at end frees FBO/dxt/nestPool, disposes vinst, deletes `_exAudio`.
- **Status:** ✅
- **Roadmap:** [R1] (done), [R2] deformed-clips-on-render bug, [D2]

## Render in place (RIP) — clip + time-selection
- **Purpose:** Bake to a light MP4 in `<project>/rendered clips/` and drop it on the timeline. Two entry points: `renderInPlace(clip)` bakes a SINGLE clip/nest (own fx + automation, external adjustment layers excluded) and SWAPS the instance; [R1] `renderRangeInPlace()` bakes the FULL composite over the in/out time selection (`state.tl.selA/selB`, or `workIn/workOut`) — a true flatten — onto a NEW top video track covering the range (non-destructive; sources stay underneath).
- **Location:** app.js · `renderInPlace(clip)` / `renderRangeInPlace()` (adjacent, ~L4520+), `ripFormatDialog` (shared; range passes a `{name:'Time selection'}` stand-in), `addVideoFromPath`. Clip menu (~L6040): "Render in place…" always for non-audio clips; "Render selection in place…" added when a range selection exists.
- **State/data:** clip → `runExport({...,range:'clips',rangeT:[c.start,c.start+c.dur],isolateClips:[c],...})`. Range → same but **no `isolateClips`** (full composite over `rangeT:[a,b]`) → then a new lane (`state.lanes.push`, index preserved) + `makeClip` at `[a, b-a]`.
- **Key symbols:** H.264/H.265 only (no PNG/HAP). `nc.props.fulldome=true` on re-import so the dome master fills 1:1 (no re-warp).
- **Invariants / gotchas:** requires desktop app + saved project. `opt.isolateClips` temporarily replaces `state.clips` (restored in finally); the range path deliberately omits it so adjustment layers ARE baked in. New video lane via `push` keeps existing `clip.lane` indices valid. Dev GPU crashes on big renders → verify with minimal render (the `.exe` forces the RTX). RIP builds `nc` manually. Range verified at integration level (load + guard); the render path reuses the proven single-clip machinery.
- **Status:** ✅
- **Roadmap:** —

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
- **State/data:** returns `{path,codec,fmt,description,codedWidth,codedHeight,timescale,fps,samples[{offset,size,key,pts}],readSample,readRange,close}`.
- **Key symbols:** `DSP.openRead`/`DSP.readAt`/`DSP.closeRead`. Handles hvc1/hev1/avc1/avc3, faststart or moov-at-end, stco/co64, stts, ctts (B-frame PTS), stss. HEVC codec string probed via `VideoDecoder.isConfigSupported`.
- **Invariants / gotchas:** desktop-only (range reads). fd closed even if stat rejects (`size` read inside try). Verified end-to-end demux→decode 150/150 frames 0 errors on HEVC10 + H.264.
- **Status:** ✅
- **Roadmap:** [R108] (done)

## ClipDecoder (WebCodecs playback ring)
- **Purpose:** Per-source decode-ahead engine replacing `<video>` for heavy no-proxy media: one `VideoDecoder` + bounded ring of decoded VideoFrames kept just ahead of the local playhead. Plays 4 walls where `<video>` collapses at the 4th HW decoder.
- **Location:** app.js · `makeClipDecoder(d)` (~L4026). Per-clip glue `vinstEnsure`/`_useCD`/`_vinstUrl` (~L4093-4115), `vinstSeek` (~L4135), `driveCD` (~L4149).
- **State/data:** cache Map keyed by frame timestamp; `AHEAD=18f, BEHIND=16f, CAP=72`; `READAHEAD=4 MB` bulk read (mdat is decode-ordered). `_vinst` Map keyed by clip id (`VINST_MAX=32`), `HAS_WEBCODECS`, `m._cdFail`.
- **Key symbols:** `setTarget(t)`, `pump()` (synchronous in-frame feed from `driveCD` — [R108·E7]), `frameAt(t)`, `isDead()`, `close()`. TIME-based (not decode-index) reset decision (HEVC B-frames: decode ≠ display order). Async `keeper` refills the 4 MB buffer while paused.
- **Invariants / gotchas:** **OFF by default** — `_useCD` gated on `state.view.wcDecode` (in-app main-thread render loop starves the pump; needs a worker). Proxied playback keeps the proven `<video>` path. A decoder that dies while paused/scrubbing is torn down + `m._cdFail` → permanent `<video>` fallback. Recycled `vi` compared by IDENTITY not `has()` (else zombie decoder = fd + VideoFrame leak).
- **Status:** 🚧 (engine complete + verified in isolation; disabled in-app pending off-thread move)
- **Roadmap:** [C2] optimal buffer / play-anywhere (decode in worker + cache)

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

## Sequence master grade (R139 phase 1 + R140 phase 2a)
- **Purpose:** A per-sequence GLOBAL grade over the FINAL composite (on top of per-clip grading). Done: numeric (exp/con/sat/temp/tint) + lift/gamma/gain wheels + master LUT, in preview + export + NDI + Spout. **Phase 2b pending:** master curves UI (engine already supports it).
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
- **Key symbols:** branches: group → `renderGroupInspector`; `c.adjust` → opacity-only + Reactive-FX hint; audio → `buildAudioInspector` (L3053); else visual clip. `refreshInspector` walks `#tfRows/#fxRows/#colorRows .prow`, updates `.num`/track width via `evalP`/`evalR`, toggles `.modon`/`.auto`, refreshes diamond fill via `kfAt`; also `refreshMotionWet`+`refreshModFormula`. Called on every scrub (`scrubRender` L3963, `ploop` L4226). The Reactive-FX tab is `renderReactivePanel`; each effect box `fxCardHtml` — [X2] its body is grouped into labelled sections `.fxsec` (Routing / Response / Parameters) inside `.fxbody`, select rows in `.fxseg`; wiring in `wireReactiveChain` keys off `.fxband/.fxmode/.fxinv/.fxshape/.fxdiv/.fxrow/.fxname/.fxdel/.fxdrag` (all preserved).
- **Invariants / gotchas:** Manual binding — every mutation must call `render()`+`renderInspector()`/`refreshInspector()`. `_renderInspectorMain` wrapped in try/catch (L2743). Fragile: full rebuild re-wires all handlers each call.
- **Status:** ✅
- **Roadmap:** [I1]/[I2]

## Four collapsible sections (Transform / Clip / Color / Motion)
- **Purpose:** Group the visual-clip inspector into four sections; Transform expanded by default, the rest collapsed and persisted.
- **Location:** app.js · section title wiring L2770-2771 · row builds L2772-2775 · Motion section L3025-3040 · `applySecCollapse` L5563-5565 · `wireSecHeads` L5566-5567.
- **State/data:** DOM hosts `#secTf/#tfRows`, `#secFx/#fxRows` (reused as "Clip"), `#secColor/#colorRows`, `#secMotion/#motionRows`. Collapse state via `insColState()` / `state.insCol` keyed by `data-sec`.
- **Key symbols:** `buildRows('#tfRows', isFlat()?TF_FLAT:TF, c)` (transform); `#fxRows` = FX minus `FX_COLOR_KEYS`; `#colorRows` = FX in `FX_COLOR_KEYS` + wheels/curves/LUT. `FX_COLOR_KEYS` L2740 = `{exposure,contrast,saturation,temperature,tint,glow,chroma}`. Motion section rebuilt manually (not via buildRows) → cleared each render (L3026).
- **Invariants / gotchas:** `secFx` title relabeled "Clip"; Color/Motion titles set at L2771. `applySecCollapse` walks each header's siblings to the next `.sechead` (skips `#insAudio`). Called at end of `_renderInspectorMain` (L3041).
- **Status:** ✅
- **Roadmap:** [I1]/[I2]

## Per-param rows (buildRows / value drag / keyframe diamond)
- **Purpose:** Render one `.prow` per automatable parameter with a fader track, modulation-arc ring, number box, modulation button, and prev/diamond/next keyframe nav.
- **Location:** app.js · `buildRows` L3164-3187 · `UNBOUNDED_P` L3188 · `editNumberBox` L3189-3193 · `startValDrag` L3233-3237 · `refreshInspector` value sync L3219-3227.
- **State/data:** param defs from `TF`/`TF_FLAT`/`FX` (`[key,label,unit,min,max]`). `c.kf[p]` keyframe arrays, `c.props[p]` base values.
- **Key symbols:** row markup `.lab/.field[data-p]/.track>i/.modarc/.box>.num/.modb/.nav`. Diamond `[data-k=add]`: click toggles keyframe at playhead (first reveals overlay via `openAuto`); right-click clears whole curve via `clearKf`+`closeAuto` (L3179). `startValDrag` drags the field (shift=fine, alt=coarse). `editNumberBox` dbl-click inline edit. Wheel on box steps value; field right-click resets to per-param default (L3185). `UNBOUNDED_P={x,y}` unclamped when typed/wheeled.
- **Invariants / gotchas:** `.auto` class = param automated (Ableton-style bright label; stopwatch removed). Filled diamond = playhead on a keyframe (`kfAt`). `hasKf()` returns undefined not false → toggles use `!!`. Modulation ring (`.modarc --m0/--m1`) spans base vs resolved value.
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

## Pen-tool point masks ([I3])
- **Purpose:** Premiere-style pen masks — draw silhouettes with points, invert, feather, expand; several per clip; rasterized into the custom-mask texture.
- **Location:** app.js · `buildPenMaskUI` L3076-3124 · `penMaskActive` L5278 · `rasterizePenMasks` L5279-5295 · dup/split/nest deep-copy L789-790,2424-2426,2507-2509.
- **State/data:** `c.penMasks` = array of `{pts:[[x,y]...] in 0..1, feather:0..60, invert:bool, on:bool}`. `c._penSel` (active index), `c.penExpand` (0.2..2 scale-about-center), `c._penCv` (offscreen 512² canvas), `c.maskTex`.
- **Key symbols:** `buildPenMaskUI(host,c)` builds `#penCv` (draw canvas), `#penList` (per-mask row: `.penSel/.penInv/.penFe/.penDel`), `#penExp`, `#penAdd`, `#penHint`. Canvas: click adds point, drag moves, dbl-click removes (needs >3 pts). `rasterizePenMasks(c)` unions masks with `lighten` composite, feather via shadowBlur, invert via `source-out`, uploads to `c.maskTex`, sets `props.mask='pen'`. `penMaskActive(c)` = any on mask with ≥3 pts.
- **Invariants / gotchas:** Separate from the shape/PNG mask. `_penCv` and `penMasks` must be deep-copied (and re-rasterized via `rebuildMaskTex`) on nest/duplicate/split (maskTex reset to null). When last active mask removed, `props.mask` falls back to `'none'`.
- **Status:** ✅
- **Roadmap:** [I3]

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
- **Location:** app.js · `renderRoom3D(wallsTex)` (~L906) · called at L930 · program `PR`, uniforms `LR.*`
- **State/data:** `activeSeq().room`, `state.view.three` ('spec'|orbit), `state.view.checkerBg`, `state.view.roomOutTex`, `_roomGeo`, `_roomGeoSeq`
- **Key symbols:** `roomVAO`, `LR.pass` (1=inside,0=outside,2=floor), `LR.backA=0.17`, `compositeFloorTex`, `buildRoomGeo`, `drawRoomLabels3D`, `roomCameraMVP`
- **Invariants / gotchas:** `wallsTex` is the live master composite (`_srcTex` from `render()`). `compositeFloorTex` rebinds the FBO/viewport → renderRoom3D restores default FBO + viewport (L911) after computing the floor. depthMask toggled between passes; DEPTH_TEST + CULL disabled around it. Rebuilds geometry lazily when `_roomGeoSeq!==seq.id`.
- **Status:** ✅
- **Roadmap:** [D4] fase 2 (output-target layer) — not built

## buildRoomGeo / _roomGeo / _roomGeoSeq
- **Purpose:** Builds the room's textured-quad vertex buffer (normalized + centered) into `roomVB`: one quad per wall sampling its own sub-rect of the strip, plus a triangulated floor fan. Caches per active-seq id.
- **Location:** app.js · `buildRoomGeo(seq)` (~L863); globals `_roomGeo`,`_roomGeoSeq` (L425)
- **State/data:** `seq.room.walls`, `seq.w`/`seq.h` (stripW/stripH), `room.floor`, `room.floor.pxW/pxH`, `roomPlan(room.walls)`
- **Key symbols:** vertex layout = pos(3)+uv(2)+shade(1)+inward-normal xy(2) = 8 floats/32 bytes (`LR.pos/uv/shade/nrm`). `_roomGeo={wallVerts,floorVerts,norm:{cx,cy,sc,midZ,standZ,radius}}`. `standZ=min(maxH*0.95,1.7)*sc` (eye at ~1.7 m). Strip UV: `uL=w.x1/stripW, uR=w.x0/stripW` (swapped so inside-view a→b runs right→left, matches 2D viewer, not mirrored).
- **Invariants / gotchas:** Per-wall vBot/vTop derive from `pxH/stripH` (walls shorter than strip don't fill full height). Floor U is flipped (`fuv`) to match walls' inside-view handedness. Normalization scale `sc=1/max(rad,maxH*0.6,0.5)`.
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

## Floor — room.floorSeqId / compositeFloorTex / _roomFloorFBO
- **Purpose:** The floor is a separate flat sequence (`room.floorSeqId`) composited into its own square FBO and fed to the 3D floor quads. `roomFloorOf` back-links the floor seq to its walls seq.
- **Location:** app.js · `ensureRoomFloorFBO(sz)` (~L849), `compositeFloorTex(m,sz)` (~L856); globals `_roomFloorFBO/_roomFloorTex/_roomFloorSize` (L426); usage L910
- **State/data:** `room.floorSeqId`, `fseq.roomFloorOf`, `room.floor` (cm+px cfg), floor seq mode `'flat'`
- **Key symbols:** letterboxes floor to its aspect via `_compAspect=(m.w/m.h)`; swaps `state.clips/lanes/_drawFlat/_roomWrap/_compAspect` around `composite()`, restores after. Called with sz=1024 from renderRoom3D.
- **Invariants / gotchas:** Rebinds FBO+viewport (caller must restore). `_drawFlat=true,_roomWrap=false` for the floor. Floor sequence has no `.room` and no per-wall grid.
- **Status:** ✅
- **Roadmap:** [F4] floor edits px-only (no cm) — enforced at setup

## 2D strip editor overlay — drawRoomGrid2D
- **Purpose:** Draws the room's per-wall grid on the flat 2D strip: dead-zones under short walls, per-wall 3×4 subdivision (Grid toggle), vertical seams between walls, and bottom-left role labels. All by exact pixels, never cm.
- **Location:** app.js · `drawRoomGrid2D()` (~L1154); dispatched from `drawGrid2D()` (L1175, only when `isFlat()&&isRoom()`)
- **State/data:** `activeSeq().room.walls`, `as.w/as.h` (stripW/stripH), `state.view.showGrid`, `flatMap()`
- **Key symbols:** `ROOM_GRID_COLS=4, ROOM_GRID_ROWS=3` (L5030), `roomRoleLabel`, `fx/fy` px→NDC mappers
- **Invariants / gotchas:** Outer L/R edges drawn by `drawFlatFrame` (not here). Room uses this grid instead of the generic thirds grid (see L1147 comment).
- **Status:** ✅
- **Roadmap:** —

## 3D overlay labels/grid — drawRoomLabels3D
- **Purpose:** Projects the wall grid (3×4) and painted-on role labels onto the 2D canvas overlay using the same 3D camera MVP. Gated by the Grid toggle.
- **Location:** app.js · `drawRoomLabels3D(mvp)` (~L887)
- **State/data:** `state.view.showGrid`, `_roomGeo.norm`, `roomPlan(room.walls)`
- **Key symbols:** `proj3`, affine-decal `setTransform` for perspective-correct labels, `ROOM_GRID_COLS/ROWS`
- **Invariants / gotchas:** No-op if grid off or `_roomGeo` missing.
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
- **Location:** app.js · `roomSetupDialog(cb)` (~L5127); `roomPlan(walls)` (~L5033); `drawRoomIso` (~L5051); `drawRoomStrip` [F5] (~L5113); presets `getRoomPresets`/`saveRoomPresets` (L5110/5111)
- **State/data:** emits `cfg={walls:[{role,order,wcm,hcm,pxW,pxH}], floor:{wcm,dcm,pxW,pxH}|null, fps}`. Consts `ROOM_ROLES=['Front','Right','Back','Left']` (L5028), `ROOM_ROLE_COL` (L5029)
- **Key symbols:** `roomPlan` → footprint segments `{role,a,b,h}` in METERS; angles fall out of dimensions (Front/Back parallel & centered; sides slant if widths differ → non-90°). `#rsN` wall count, `#rsWalls` rows, `#rsFloorRow`, `#rsStrip` [F5] canvas.
- **Invariants / gotchas:** **[F3]** Order = fixed row position (screen order), not user-editable; picking a role already used SWAPS the two walls (dims travel, positions stay) so roles stay unique. Duplicate-role guard on Create (L5192). Floor depth spans front-to-back.
- **Status:** ✅
- **Roadmap:** [F3] wall fixed ✅, [F4] floor px-only ✅, [F5] order canvas ✅ (`drawRoomStrip`)

## newRoomProject
- **Purpose:** Creates a 360-room project from the setup cfg: a `'room'` walls sequence (strip = Σ pxW × max pxH, `.room` attached) + optional `'flat'` floor sequence, linked via `room.floorSeqId` / `fseq.roomFloorOf`.
- **Location:** app.js · `newRoomProject(cfg)` (~L5256)
- **State/data:** sets `state.seqMode='room'`, `state.seqW=stripW`, `state.seqH=stripH`; `room={walls,floorSeqId,floor}`
- **Key symbols:** strip layout `w.x0/w.x1` by native pixels (L5265); `stripH=max(pxH)`; `newSeqMedia(...,'room')`; opens all seq media, active=walls seq.
- **Invariants / gotchas:** cm (wcm/hcm) are geometry-only (3D wall placement); the 2D strip is exact pixelage. `clearAllUndo()` after (undo belongs to previous project).
- **Status:** ✅
- **Roadmap:** —

## Per-wall / floor export hooks
- **Purpose:** Room export offers Full strip OR one file per wall (native pxW×pxH crop) + optional floor as its own file/job.
- **Location:** app.js · export dialog room row build (~L4813–4817); `queueJob` per-wall/floor (~L4887–4892); `runExport` wall/seqId params (L4303 seqId switch, L4310–4311 wall crop); `renderExportFrame` wall UV crop (L4242, L4247)
- **State/data:** job `opt.wall={role,x0,x1,pxW,pxH,stripW,stripH}`, job `opt.seqId` (floor exports as its own sequence then restores active). `#exRoomMode` (strip|walls), `#exFloor` checkbox.
- **Key symbols:** wall crop composites full strip at native res then extracts the wall's sub-rect (`uSc/uOf/vSc/vOf` at L4247); floor job switches to the floor seq via `switchSeq` and restores (`_rsSeq`).
- **Invariants / gotchas:** Floor job skipped with warning if it has no clips (L4891). Per-wall label = ROLE · pxW×pxH.
- **Status:** ✅
- **Roadmap:** [R1] render in-place flexibility, [D2] queued encoder snapshot

---

# (B) COMPOSE / NEST

## Sequences as nest media — newSeqMedia / activeSeq / loadSeqIntoState / saveActiveSeq
- **Purpose:** Sequences ARE media of `kind:'nest'` (Premiere-style tabs). One is active; its clips/lanes/markers alias into `state.*`. Switching saves the old, loads the new.
- **Location:** app.js · `newSeqMedia` (~L4917), `activeSeq` (~L4914), `ensureSequences` (~L4919), `saveActiveSeq` (~L4925), `loadSeqIntoState` (~L4926), `switchSeq` (~L4936), `openSeq` (L4935), `closeSeqTab` (L4939), `deleteSequenceMedia` (L4945), `renderSeqBar` (L5221)
- **State/data:** `state.openSeqs[]`, `state.activeSeqId`, per-seq `nestClips/nestLanes/nestMarkers/nestGroups/nestPlayhead/nestWorkIn/nestWorkOut`, `m.mode`, `m.cov`, `m.w/m.h/m.fps`
- **Key symbols:** `isSeqMedia`, per-sequence undo stacks (`_undoBySeq`, `_ustk` L5418) survive switch. `state.clips` is a live ALIAS of `activeSeq().nestClips` — must be re-healed after filters (L4951, L5427).
- **Invariants / gotchas:** `loadSeqIntoState` also sets seqMode/seqW/seqH/seqCov, resets selection, invalidates render-ahead, and calls `updModeUI`. Audio lane force-added on real timelines (not on comps, L4927). Cycle guard prevents nesting a seq inside itself (L1805/5775).
- **Status:** ✅
- **Roadmap:** [R3] sequences reorderable (seq bar)

## nestSelection / makeClipUnique
- **Purpose:** `nestSelection` wraps selected clips into a new nest sequence (inherits flat/dome compositing mode). `makeClipUnique` deep-copies a nest/comp media so an instance can be edited independently.
- **Location:** app.js · `nestSelection()` (~L783), `makeClipUnique(c)` (~L5846)
- **State/data:** new nest via `newSeqMedia(..., isFlat()?'flat':'dome')` (L791); unique copy re-uids clips + comp, rebuilds masks
- **Key symbols:** [R92-T1 C4] nest inherits compositing mode (room content nests flat — the strip IS rectangular). `serMedia` deep-copy drops live GL fields.
- **Invariants / gotchas:** Only sequences/compositions can be made unique. `makeClipUnique` rebuilds `maskTex` from `maskData`/`penMasks` (L5854).
- **Status:** ✅
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
- **Purpose:** `drawComposePreview` renders the dome-disc (or flat-frame) schematic of a composition. `openCompose` dialog exposes layout kinds, count, dome-fill (domegrid: rings/segs/gaps/brick/shuffle), tile, jitter randomize row [N5].
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
- **Key symbols:** color `#B4BAC1`
- **Invariants / gotchas:** —
- **Status:** ✅
- **Roadmap:** —

---

# (C) FORMATS

## Sequence-creation dialogs — domeSetupDialog / flatResDialog / roomSetupDialog
- **Purpose:** Landing entry points for the three formats. Dome: resolution + fisheye coverage (FOV) with live viz. Flat: preset/custom W×H + fps. Room: see (A).
- **Location:** app.js · `flatResDialog(cb)` (~L5001), `domeSetupDialog(cb)` (~L5015), `roomSetupDialog(cb)` (~L5127); wired at landing L2135–2137 & menu L5811–5813
- **State/data:** dome cb → `{res,cov,fps}`; flat cb → `(w,h,fps)`; `drawSeqViz(cv,kind,o)` (L4959) live preview; `DOME_COV=[180,200,210,220]` (L4955)
- **Key symbols:** `#dsRes/#dsCov/#dsFps`, `#fpW/#fpH/#fpFps/#fpPre`
- **Invariants / gotchas:** Dome always square. Coverage = fisheye FOV; wider pulls horizon inward.
- **Status:** ✅
- **Roadmap:** [F1] unified project-config panel (partly `openSeqSettings`)

## newProject
- **Purpose:** Resets all state and creates a fresh dome or flat project. Disposes media/GL, sets seqMode/seqW/seqH/seqCov, then `ensureSequences()`.
- **Location:** app.js · `newProject(mode,w,h,fps,cov)` (~L5245); `ensureSequences` (L4919)
- **State/data:** flat → seqW/H = w/h (def 1920×1080), dome → 4096², seqCov=cov||180
- **Key symbols:** `disposeAllVinst`, `disposeMedia`, `clearFrameCache`, `clearAllUndo`, `defLanes`
- **Invariants / gotchas:** `clearAllUndo()` mandatory (undo belongs to previous project). `confirmDiscard()` gate first.
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
- **Invariants / gotchas:** Chip covers dome coverage only when ≠180. Room has a real 3D view (assembled walls); plain flat does not.
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
- **Location:** app.js · NDI `startNDI` (L1028), `ndiTick` (L1019), `ensureNdiFBO` (L1011), `stopNDI` (L1034), `ndiMenu` (L1035), `ndiAvailable` (L1010). Spout `startSpout` (L1064), `spoutTick` (L1055), `stopSpout` (L1070), `spoutMenu` (L1071), `spoutAvailable` (L1046). Buttons `#ndiBtn`/`#spoutBtn` wired L5615-5616 (hidden when addon absent).
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
- **State/data:** per-media `m.proxyReady`, `m.proxyPct`, `m._pxGen`, `m.missing`, `m._loading`, `m._ndiLive`, `m.thumb`, `m.color`, `m.folder`.
- **Key symbols:** `[M3]` proxy/original label = `.mprx` span (L1708: `proxyReady?'proxy':'original'`). `[M4]` missing original → red inset shadow (L1701). dblclick: `openSeq` if nest else `addClip`. pointerdown → `selectMedia`+`startMediaDrag` (multi keeps selection). contextmenu → `openMediaCtx`.
- **Invariants / gotchas:** `reallyMissing = m.missing && !m._loading` — decoding (esp. audio) is not "missing".
- **Status:** ✅
- **Roadmap:** [M3]/[M4] done.

## Media context menu / properties
- **Purpose:** Shared right-click menu for rows and tiles (add, rename, properties, reveal, proxy gen, replace, locate, move-to-folder, delete) + the read-only Properties dialog.
- **Location:** app.js · `openMediaCtx(e,m)` (L1741-1757), `mediaProperties(m)` (L1721-1739), `fmtBytes` (L1720).
- **Key symbols:** multi-select compose entry (L1743); manual proxy generation `enqProxy` over the (shift-)selection (L1750); `replaceMedia` (L1751); `Locate file…`→`DSP.pickMedia`+`reloadMedia` (L1752); move-to-folder via `moveMediaTo`; `deleteMedia`.
- **Invariants / gotchas:** proxies are MANUAL (project convention) — no auto-generation.
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
- **Location:** app.js · `importFiles(files,folder)` (L1264), `importDropped(dt,baseFolder)` (L1278), `askSeqFps` (L1292), `wireDrop(el)` (L5495). Wiring: `#fileInput.onchange` (L5514), `#importBtn` (L5498), `wireDrop($('#mediaList'))`+`$('#stage')` (L5515), empty-area menu (L5517).
- **State/data:** dedup by absolute path or name+size; `_importFolder` transient target; `state.folders` gets subfolders from dropped dirs.
- **Key symbols:** dispatch to `addVideo`/`addImage`/`addAudio`/`addSequence`; `#fileInput` (hidden input), `#dropZone`.
- **Invariants / gotchas:** import target folder is passed explicitly (never inherits the previous import's folder — stale bug fix). ≥3 numbered images = a sequence; asks fps once per batch.
- **Status:** ✅
- **Roadmap:** —

## Folders (state.folders)
- **Purpose:** Nested media folders (Adobe-like tree + grid navigation), inline create/rename, drag-to-file, per-folder color.
- **Location:** app.js · tree render inside `renderMedia` (`drawFolder`, L1663); `#newFolderBtn` (L5528), `newFolderIn`, `renameFolder` (L5530)/`renameFolderInline`, `deleteFolder` (L5531), `moveFolder`, `showFolders` (L5527), `startFolderDrag`. `#groupSeg` toggle L5523.
- **State/data:** `state.folders[]` (path strings, FSEP-joined), `state.folderColors{}`, `state.mediaFolder`, `state.selFolder`, `state.collapsedGroups`.
- **Invariants / gotchas:** deleting a folder keeps its media (unfiled). Colors are edited inline in the context menu swatch row.
- **Status:** ✅
- **Roadmap:** [M1] inline create — done.

## Media search
- **Purpose:** Live text filter of the media panel (`#mediaSearch`, debounced 150ms).
- **Location:** app.js L5500-5504; DOM: `#mediaSearch`, `#mediaSearchClr`.
- **State/data:** `state.mediaQuery` (consumed in `renderMedia` L1632).
- **Invariants / gotchas:** the filter existed in renderMedia before the input did (R92-T5 P1). Esc clears + blurs.
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
- **Status:** ✅
- **Roadmap:** —

## saveProject()
- **Purpose:** Serialize + write the `.isp` (atomic, with `.bak` rotation of the previous save); browser build downloads a Blob.
- **Location:** app.js · `saveProject(saveAs)` (L5231-5236); `saveIncremental()` (L5374, `_vNN.isp`).
- **Key symbols:** `DSP.saveDialog`→`DSP.writeText`; rotates `p+'.bak'` (L5233); on success `addRecent(p, projThumb())` + `clearLiveAutosaves()`. `currentPath`, `currentTitle()`, `state.dirty`.
- **Invariants / gotchas:** after a manual save the crash autosaves are dropped so a later open never falsely offers "restore a newer autosave". Save failure → styled alert suggesting Save As.
- **Status:** ✅
- **Roadmap:** —

## openProject / openProjectPath / loadProject
- **Purpose:** Open via dialog, via double-clicked path, and the shared loader that rebuilds `state` from a project object.
- **Location:** app.js · `openProject()` (L5238), `openProjectPath(p)` (L5241), `loadProject(obj)` (L5296-5334). Double-click wiring `DSP.onOpenPath(openProjectPath)` (L5576).
- **Key symbols:** `confirmDiscard()` (L5237) guards unsaved work; `maybeOfferAutosave(p,obj)` (L5385) offers recovery when the on-disk autosave is newer; `hideLanding()` first. loadProject rebuilds media as `missing/_loading`, re-renders text/shape/ndi/nest synchronously, recomputes `_id` counter, restores masks (`rebuildMaskTex`), version back-compat (v4 openSeqs / v3 sequences[] / v≤2 single timeline), then `reloadMedia(m)` for each. `showLoadingScreen`→`loadingWaitMedia` (20s deadline).
- **Invariants / gotchas:** `clearAllUndo()` in loadProject — undo history belongs to the previous project (Ctrl+Z must not inject old clips). Accepts `.isp/.ise/.rdome/.json`.
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
- **Invariants / gotchas:** splash has a safety timeout so a throttled rAF never hangs boot. Loading screen holds until loop ran ≥2× AND media/proxies ready (or 20s deadline).
- **Status:** ✅
- **Roadmap:** [U9] homepage + logo loop — done.

## App menu bar (File / Edit / Window)
- **Purpose:** Top-bar dropdown menus that reuse existing commands; hover switches menus while the bar is open.
- **Location:** app.js · `openAppMenu(which,btn)` (L5809-5841), wiring L5842-5844. DOM: `#menubar .menubtn[data-menu=file|edit|window]` (index.html L634-638).
- **Key symbols:** File: new dome/2D/room, Open/Save/Save As, Export. Edit: undo/redo/cut/copy/paste/duplicate/delete/ripple/nest. Window: media/inspector pane toggles, viewer-only window, full performance, all-commands (→ `#helpBtn`).
- **Invariants / gotchas:** built on `openMenu`; the active `.menubtn` highlight is cleared by `closeMenu` (R135).
- **Status:** ✅
- **Roadmap:** [D3] menu bar — done.

## Context-menu system (openMenu / closeMenu)
- **Purpose:** The single popup-menu primitive used everywhere (media, timeline, folders, NDI, ruler, app menus). Keyboard-navigable; supports separators, danger items, shortcut glyphs, and an inline color-swatch row.
- **Location:** app.js · `openMenu(x,y,items)` (L5788-5806), `closeMenu()` (L5785), `fmtKey(s)` (L5787). Outside-click close L5807.
- **Key symbols:** item = `{label,fn,ico?,key?,danger?}` | `'sep'` | `{swatches:{cur,onPick,onClear}}`. Auto-repositions if it overflows the viewport; focuses the first enabled item; Arrow/Home/End/Esc handled inside (stopPropagation).
- **Invariants / gotchas:** `fmtKey` rewrites ⌘/⇧/⌥ to Ctrl+/Shift+/Alt+ on non-Mac (the app is Windows).
- **Status:** ✅
- **Roadmap:** —

## Command palette / help (Ctrl+K / F1 / ?)
- **Purpose:** Searchable list of all commands + shortcuts across 9 categories; the `?` button and F1/? open it.
- **Location:** app.js · `openPalette()` (L5972), `commandList()` (L5941-5971). `#helpBtn`→`openPalette` (L5574); key handlers F1/? (L5687), Ctrl+K (L5688). DOM: `#helpBtn` (index.html L650), `#palOv`/`#palIn`/`#palList`.
- **Key symbols:** each command = `[category, label, key, fn]`; live filter by category+label; Arrow/Enter to run.
- **Invariants / gotchas:** the palette is also the "all commands & shortcuts" reference (U-08).
- **Status:** ✅
- **Roadmap:** —

## Top bar (title / format chip)
- **Purpose:** Project title with dirty marker + mode prefix, and the clickable format chip (dims·fps·codec) that opens sequence settings.
- **Location:** app.js · `projTitle()` (L4902), `updFmtChip()` (L5196). DOM: `#projTitle` (index.html L639), `#fmtChip` (L640, click→`openSeqSettings` L5617). Top-bar buttons `#newBtn/#openBtn/#saveBtn/#saveMenuBtn/#exportBtn/#helpBtn` (index.html L644-650).
- **Key symbols:** `projTitle` also pushes native title + `DSP.setUiState({dirty,lang})` for the close guard. `updFmtChip` shows `Room·`/coverage suffixes.
- **Invariants / gotchas:** `fmtChip._codec` transiently overrides the codec suffix during the export dialog; restored on close.
- **Status:** ✅
- **Roadmap:** —

## Styled dialogs (appPrompt / appAlert / appConfirm)
- **Purpose:** In-app modal replacements for browser prompt/alert/confirm (Electron doesn't support the natives).
- **Location:** app.js · `appPrompt(message,def,cb)` (L2042), `appConfirm(message,cb,opts)` (L2051), `appAlert(message,cb)` (L2058). Related inline editor `inlineEdit(el,value,commit)` (L2143).
- **Key symbols:** `opts.ok/cancel/danger`; Enter=confirm, Esc=cancel; each `closeMenu()`s first. `appConfirm` returns via callback (often wrapped in a Promise, e.g. `confirmDiscard`).
- **Invariants / gotchas:** project rule — NEVER use native prompt/alert/confirm; always these.
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
- **Location:** app.js · `setPerfMode(on)` (L5613), wiring L5614. DOM: `#perfBtn` (index.html L735), `#perfExit` (L745), `body.perfmode`.
- **Invariants / gotchas:** `[V2]` done.
- **Status:** ✅
- **Roadmap:** —

## Viewer-only window (pop-out, follows editor 2D/3D)
- **Purpose:** A movable/resizable second-screen output window that **mirrors the editor's mode** ([V1]): 3D dome (own independent orbit camera), 2D flat, or the 2D fisheye disc.
- **Location:** app.js · `openViewerWindow()` (L961-982), `renderViewer(srcTex)` (L984), `closeViewerGL` (L983). Driven from the main render loop (L955). `#popoutBtn`→`openViewerWindow` (L5611). Main-process window handler `frameName==='domeViewer'` (main.js L65).
- **State/data:** `_viewerWin`, `_viewerCtx`, `_viewerCam{yaw,pitch,dist,fov}`, `_viewerGrid`, offscreen FBO `_vFBO/_vTex/_vDepth`.
- **Key symbols:** `window.open('about:blank','domeViewer',...)`; renders into an FBO (capped 1280), reads back, draws flipped (WebGL bottom-up). Own grid toggle button (only meaningful in 3D).
- **Invariants / gotchas:** [V1] `renderViewer` branches on `_vDome3D=(view.mode==='3d' && !_drawFlat && !_roomWrap)` → dome via `P3`+`_viewerCam`, else a CLEAN 2D blit via `PB` (`pan=0,zoom=1` — no editor pan/zoom; flat = aspect-fit rect, dome-2D = centred fisheye disc). Room-3D falls to the flat strip (its 2D form) — replicating room-3D with an independent cam is out of scope. The 3D orbit camera stays independent of the main viewport; backgroundThrottling:false keeps it smooth while unfocused.
- **Status:** ✅
- **Roadmap:** —

## Close-confirm + dirty guard
- **Purpose:** On window close with unsaved changes, show the app-styled confirm instead of a native OS dialog.
- **Location:** app.js · `DSP.onConfirmClose(...)` in init (L6990) → `appConfirm` → `DSP.forceClose()`. Main side: `win.on('close')`→`dsp:confirmClose` (main.js L90), `uiDirty` from `dsp:setUiState` (L114).
- **Invariants / gotchas:** `projTitle()` pushes the dirty flag to main every time; a failed IPC send falls back to `forceClose`.
- **Status:** ✅
- **Roadmap:** —

## Status bar / tooltips
- **Purpose:** Info-view status line (instant tooltip text), autosave status, hover tooltips (~1s) converted from `title` attrs.
- **Location:** app.js · tooltips IIFE (L6307-…), `#statInfo`/`#statAuto` (index.html L840,847). `updEnable`/`setDis` write `data-why` for disabled-control reasons (L5440-5455).
- **Invariants / gotchas:** tooltip contract "Name — what it does · SHORTCUT"; native `title` moved to `data-tip` once so the OS tooltip never double-shows.
- **Status:** ✅
- **Roadmap:** —
