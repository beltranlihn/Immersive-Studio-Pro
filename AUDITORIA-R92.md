# AUDITORÍA R92 — Immersive Studio Pro (2026-07-14)

> **R92-T6 (2026-07-15, pruebas pro E2E):** compose 6→60fps (sondeo de vídeos mudos `aelProbeSilent`), proxies persistentes entre sesiones, rate compuesto en nests + servo A/V (deriva 236→~50ms), ael con render-ahead/URL-keyed/preservesPitch, span del export con speed, fades proporcionales, envolvente blindada. **Limitaciones conocidas (decididas, no bugs abiertos):** el audio no sigue el loop inverso ping-pong → se **silencia** el preview de ese clip (T7, en vez de tartamudear); volumen >100% se clampa en el preview de vídeo (el export y los clips de audio sí aplican el boost); nest en loop cubre máx. 4000 ciclos por pase.

Auditoría completa: 5 agentes de análisis de código (keyframes/automatización, audio, rendimiento/estabilidad, estado/undo/nests/efectos, UX/UI) + 7 baterías de pruebas EN VIVO vía CDP sobre la app real con assets reales de RITO DIGITAL (película 1080p de 64 min / 12 GB, WAV máster de 967 MB, clips de `Creation` con proxies).

**Leyenda:** 🔴 ROTO (funcionalidad incorrecta o ausente) · 🟠 FRÁGIL (falla en escenarios concretos) · 🟡 MENOR · ✅ verificado en vivo · 📄 verificado por lectura de código.

---

## 0. Resultados de las pruebas en vivo (lo medido, no lo supuesto)

| Prueba | Resultado |
|---|---|
| Import WAV 967 MB (1 h) | ✅ Funciona. 28 s de decode, **+1,7 GB de RAM residente**, 2 congelones de UI de ~1 s |
| Audio en punto arbitrario | ✅ Sample-accurate: colocar en t=100, razor, mover, reproducir desde el medio — offsets exactos en todos los casos |
| Seek en la película de 1 h (12 GB) | ✅ Excelente: 13–46 ms por seek. El archivo largo NO es el cuello de botella |
| Keyframes: mover clip / razor / duplicar / copy-paste | ✅ Sólido: viajan con el clip, razor rebasa e interpola el valor de frontera, deep-copy sin contaminación |
| Trim-in con keyframes | ⚠️ NO borra kfs (desmiente al agente) pero NO los rebasa: la animación queda anclada al borde y **se desliza respecto al contenido**; quedan kfs con t>dur |
| Compose + fx + entrar + editar + recortar + undo | ✅ Fx del nest intactos, razor del nest propaga inP y fx; undo/redo consistente en la misma pestaña |
| Timeline con 300 clips | ⚠️ `renderTimeline()` = **~100 ms por rebuild** → drags a ~10 fps |
| Playback (compose + fx, ventana al frente) | ✅ 57 fps estables |
| Playback con ventana tapada/minimizada | 🔴 **1 fps** pese a `backgroundThrottling:false` en main.js — riesgo directo para NDI en función |
| Snapshot de undo con 300 clips | ✅ 2 ms (barato a esta escala) |

---

## 1. 🔴 ROTO — arreglar primero

**C1. ✔ CORREGIDO (R92-T2: preview vía `<audio>` por clip al original + export vía decodeAudioData ≤1,5GB) — Los vídeos NO tienen audio — nunca.** 📄 `addVideo` (app.js:1078) pone `muted=true` a todo `<video>` y `collectAudioEvents` (1047) solo mezcla `kind:'audio'`. La pista de audio de un MP4 no existe ni en preview ni en export. Para el flujo real (película-concierto con máster de sonido) hoy el único camino es extraer el WAV fuera de la app. **Fix mínimo viable sin FFmpeg:** al importar vídeo, `decodeAudioData` del mismo archivo (Chromium decodifica el audio de un MP4) → media de audio vinculado o `m.audioBuffer`, con clip agrupado.

**C2. ✔ CORREGIDO (R92-T1) — `loadProject` no limpia los stacks de undo** (3248; `newProject` sí lo hace). Abrir proyecto B y pulsar Ctrl+Z inyecta clips del proyecto A → clips fantasma con media inexistente. Afecta también a restaurar autosave. **Fix: 1 línea.**

**C3. ✔ CORREGIDO (R92-T1, undo por secuencia `_undoBySeq`) — El historial de undo se ANIQUILA al navegar secuencias.** `switchSeq`/`closeSeqTab`/nueva secuencia vacían ambos stacks (3055/3059/3072/3085). El flujo exacto del usuario (crear compose → entrar → efectos → recortar → volver) pierde TODO el paracaídas en cada paso. Además exportar muro/piso usa `switchSeq` internamente (2862) y vacía el undo como efecto colateral. **Fix: stacks por secuencia (map seqId→{undo,redo}).** Es la causa central de la sensación de "conexiones rotas".

**C4. ✔ CORREGIDO (R92-T1) — `nestSelection` crea el nest en modo 'dome' siempre** (528: falta el argumento mode que `createComposition` sí pasa, 3891). En proyecto 2D o sala 360, anidar una selección deforma el contenido con warp de domo e ignora x/y. Además fuerza `fulldome=true` (531). **Fix: 2 líneas.**

**C5. ✔ CORREGIDO (R92-T1, remap + resolución dentro de nests) — El motor Reactive pierde su fuente al anidar.** `state.reactive.srcClipId` apunta a un id de clip que `nestSelection` destruye (526-527, ids nuevos dentro del nest) → todos los FX audio-reactivos dejan de reaccionar en silencio. **Fix: remapear srcClipId al anidar.**

**C6. ✔ MITIGADO (R92-T1, aviso con nombres de secuencias antes de borrar) — Borrar media usada en varias secuencias es indeshacible a medias** (1385 filtra los clips de TODAS las secuencias; el snapshot solo cubre la activa). Undo recupera los clips de la secuencia activa; los de los nests se pierden sin aviso. **Fix mínimo: aviso "usado en N secuencias"; fix real: media en el snapshot.**

**C7. ✔ MITIGADO (R92-T3: flag de oclusión + verificado que NDI bombea por setInterval a 63/s minimizado — la salida al domo sobrevive; solo el preview cae) — Throttling con ventana oculta** ✅ medido: rAF a 1/s con la ventana tapada aunque `backgroundThrottling:false` está seteado. Con NDI emitiendo a un domo, minimizar la ventana mata la señal. Investigar (occlusion detection de Windows; probar `frame.setBackgroundThrottling`, o pump NDI fuera de rAF). OJO al gotcha de GPU híbrida: no meter flags Chromium agresivos.

---

## 2. 🟠 FRÁGIL — escenarios concretos que fallan
> **Estado R92-T2/T3/T4/T5:** ✔ corregidos F2 (trash dispose+reload), F3 (camino ligero en trims, 26×), F4 (nest speed/loop/vol/fades en audio), F5 (re-agendado en edits), F6 (inP×speed), F7 (kf de frontera en trim), F11 (wetKf rebase), F13 (fadeOut clamp + curvas unificadas), F14 (motionTick 30fps+hidden), F15 (export cancelable + progreso persistente). Parcial F1 (armMediaBands bajo demanda; el PCM residente y el export por ventanas siguen pendientes). Pendientes F8→hecho en T1, F9 (parcial: alias curado en restore), F10, F12.

**F1. Memoria de audio: 1,4 GB residentes por hora de audio** ✅ (medido +1,7 GB). `decodeAudioData` del archivo entero, retenido toda la sesión; `armMediaBands` corre 3 renders offline automáticos en CADA import (1031); al reabrir el proyecto se re-decodifica todo (3293); y el export materializa OTRA mezcla completa (2837) que convive con todo durante el encode (~+1,4 GB más). Dos audios de 1 h + export ≈ riesgo real de OOM. **Plan:** cachear peaks/bands en disco (como proxies), liberar el arrayBuffer intermedio, export de audio por ventanas, `armMediaBands` bajo demanda.

**F2. `mediaTrash` retiene TODO indefinidamente** (1384): AudioBuffers, `<video>` con demuxer abierto, texturas GPU — hasta cambiar de proyecto. Sesión larga de probar-y-descartar material = crecimiento monotónico. **Plan: dispose parcial al borrar (conservar solo lo serializable para undo).**

**F3. `renderTimeline` reconstruye TODO el DOM** ✅ (medido ~100 ms con 300 clips; se llama a 60 Hz coalescido durante drags y en cada click). Límite nº1 de fluidez con proyectos de película. **Plan: separar "reposicionar" (solo style.left/width) de "reconstruir", o virtualizar por ventana visible.**

**F4. Audio dentro de nests ignora speed/loop/volumen/fades del clip nest** (1053): nest al 50% → vídeo a mitad de velocidad, música a velocidad normal (desync total); nest con loop → repeticiones mudas; fade del nest no funde su audio. El caso simple (nest sin speed/loop) sí funciona ✅.

**F5. Editar durante reproducción no re-agenda el audio** (solo los fades lo hacen, 2239): mover/recortar/borrar/mute/solo con el transporte andando deja sonando el schedule viejo (un media borrado sigue sonando). **Fix: `if(state.playing)startAudio()` en los pointerup de edición.**

**F6. Trim-in con speed≠1 desincroniza contenido** (1810: `inP += d` sin multiplicar por speed; `srcT` define fuente=(t-start)*speed+inP). Recortar 2 s un clip al 50% corre el contenido 1 s de más respecto a sus keyframes.

**F7. Trim-in no rebasa keyframes** ✅ verificado: la animación se desliza con el borde en vez de quedar anclada al contenido (estándar NLE), y trim-R deja kfs con t>dur pintados fuera del clip (2454). **Fix: rebasar como hace `razorCore` + clamp visual.**

**F8. ✔ CORREGIDO (R92-T1: guard de ciclo + clamp/creación de lane + guard de media) — `pasteClip` sin validaciones** (3628): sin guard de ciclo (pegar un nest dentro de sí mismo → recursión que SE GUARDA en el .isp) y sin clamp de lane (clip pegado en lane inexistente = invisible; si es audio, SUENA sin verse — "audio fantasma").

**F9. `pushUndo` sobre mutaciones que el snapshot no captura** → Ctrl+Z "no hace nada" o revierte a medias: `openCompose` apply (4028, regenera nestClips del media), `replaceMedia`, `moveMediaTo`, `deleteFolder`, `renameMediaInline`.

**F10. `groupSpin/Raise/Scale` escriben el base de params automatizados** (3943-3945): con automatización activa no se ve nada pero corrompe el valor base; ignoran `_autoOff`.

**F11. `wetKf` (mix de Motion) nunca se rebasa** en trim/split (1809/1847 solo rebasan `c.kf`) → la rampa de mix se desliza respecto al contenido.

**F12. `duplicateClipAt` (alt-drag, 1775) conserva `groupId`/`slot`** → la copia es absorbida/recolocada/borrada por las operaciones de grupo. `duplicateClip` (3626) sí los limpia.

**F13. fadeOut mal aplicado cuando la ventana corta la cola** (1052): nest que recorta a su hijo o export con work-area → bajada de volumen audible antes del corte. Y curvas de fade distintas preview (exponencial) vs export (lineal) — suenan diferente.

**F14. `motionTick` = rAF infinito con la app quieta** (341): un solo clip con Motion preset composita el máster a 60 fps para siempre (GPU 30-60 % en reposo, mata el cache render-ahead). **Fix: throttle 30 fps + pausar con document.hidden + solo si hay clip animado bajo el playhead.**

**F15. Export sin cancelar y con progreso frágil** (2861-3016): `cancelExport` solo se activa por GPU perdida; Escape/Close desmonta el overlay mientras el export sigue corriendo a ciegas. Para exports de 75 min: botón ✕ por job, progreso en status bar + `win.setProgressBar`, y bloquear el cierre del modal mientras `_exbusy`.

---

## 3. 🟡 MENOR (lista corta de las ~25 encontradas)

- ✔ CORREGIDO (R92-T1) — Undo/redo no marcan dirty (3361) → cerrar sin aviso tras deshacer pierde trabajo. (Además `restore()` ahora re-cura el alias state.clips⇄nestClips — parte de B12.)
- `serClip` serializa `_ntex` (textura GL) como `{}` basura en el .isp (3031).
- Secuencias de imágenes: TODOS los frames a RAM a la vez (995/3283); reabrir dispara todos los `new Image()` simultáneos.
- Autosave/`pushUndo` = `JSON.stringify` síncrono en hilo UI (con maskData dentro) → hitches de 100-300 ms en proyectos grandes.
- `liveAudioGain` destruye los fades agendados al tocar el volumen en vivo (1072).
- Object URLs de audio nunca revocados (1028).
- Posible offset AAC constante de ~20-40 ms en el MP4 exportado (sin compensación de priming).
- `upTex` usa `texImage2D` (realloc) en vez de `texSubImage2D` para frames del mismo tamaño (934) — el camino NDI sí lo hace bien.
- Escrituras del proxy a disco sin backpressure (1150) — disco lento acumula miles de promesas.
- `drawScopes` = readPixels síncrono del viewport completo cada 120 ms (486).
- `antialias:true` en el contexto GL no aporta nada (todo va por FBOs) y cuesta ancho de banda (55).
- Tolerancias de "estoy sobre un kf" inconsistentes: ±0.06 s / ±medio frame / ±0.03 (2340/290/2243).
- 4 copias de la lógica de interpolación (evalP, evalWet sin bezier, drawAutoCurve, evalKf muerta).
- Curve editor: arrastrar puede dejar 2 kfs en el mismo t (2510, sin merge).
- `speed` no reescala dur ni kfs (3658) — decidir política (¿diálogo tipo Premiere?); hoy deja cola muda cuando la fuente se agota ✅.
- Borrar el "Piso" de una sala deja `room.floorSeqId` colgante sin aviso (no crashea).
- Fades no se reclampan al recortar por debajo de su longitud.
- `'proyecto.isp'` hardcodeado en español como nombre por defecto (3205).

---

## 4. UX/UI — con foco en AUTOMATIZACIÓN (pedido explícito)

### 4a. Automatización: funcionamiento + orden visual — **plan revisado contra Ableton Live 12** (pedido del usuario; manual de Live cap. "Automation and Editing Envelopes" + lectura de la implementación actual, app.js:2351-2647)

**Paridad que YA existe (no tocar, ya es "estilo Ableton"):** clic en la línea = añadir punto · arrastre vertical de segmento (lead/mid/trail, segAround 2477) · **Alt-arrastre de segmento = curvarlo** (2508) · Alt-doble-clic = enderezar (2564) · Alt+clic en punto = borrar · marquee en el fondo (2531) · punto fantasma al hover (2469) y tooltips de valor (2471) · doble clic en punto = editor numérico t/v (2551, equivale al "Edit Value" de Live) · snap a grilla con escape vía Alt/Ctrl (2513) · Simplify (RDP 2413, = "Simplify Envelope") · copy/paste de curvas con reescalado de rango entre parámetros (2389, Live lo tiene como "cross-parameter paste") · override manual + botón global Re-Enable (2427-2428, = LED apagado + "Re-Enable Automation") · ◆ marca los parámetros ya automatizados en los choosers (2609, = LEDs rojos de Live) · lanes redimensionables con chooser de parámetro intercambiable · AR lanes con doble chooser efecto→parámetro (2652, = device chooser→param chooser). Divergencias deliberadas a CONSERVAR: clic en punto = seleccionar (Live lo borra — lo nuestro es menos propenso a error), easing por punto + bezier libre (Live no los tiene).

**Los huecos reales contra Live, en orden (esto reemplaza la lista anterior):**

1. **Lanes a nivel de PISTA, persistentes** — el gap estructural nº1. Hoy las sub-lanes solo existen bajo el clip SELECCIONADO y desaparecen al deseleccionar (`appendAutoLanes` 2624: `selClip()`); en Live las lanes pertenecen a la pista, muestran el envelope a lo largo de TODO el timeline y conviven varias apiladas hacia abajo. Cambio: sub-lane por (pista, parámetro) que dibuje las curvas de TODOS los clips de esa pista (los canvases ya están ventaneados, escala bien), visible sin selección, con colapso/expansión por pista (= flechas ←/→ de Live) y "pin" desde el chip del clip para separar el overlay a su lane propia. Guardar el layout de lanes en el .isp (junto con `inlineCurves` y `_autoH`).
2. **Draw mode (tecla B, lápiz)** — no existe. Como Live: arrastrar dibuja pasos al ancho de la grilla; con grilla oculta o manteniendo Alt, trazo libre; Shift+vertical = ajuste fino; mantener B pulsada = modo temporal. Al soltar, ofrecer auto-Simplify (ya implementado) para convertir el trazo en puntos limpios. Encaja directo sobre `bindAutoCurve`.
3. **Insert Shapes (Live 12)** — clic derecho sobre una time-selection → insertar seno / triángulo / sierra / sierra inversa / cuadrada / rampas, escaladas al rango del parámetro y a la selección (sin selección: al paso de grilla). ISP ya tiene time-selection estilo Ableton (`state.tl.selA/selB`) — es plug-and-play en el menú contextual de 2567. Para un show de domo esto sustituye muchos usos de Motion presets con control total.
4. **Stretch/skew de la selección** — Live 12 muestra handles alrededor de la selección de puntos (estirar vertical/horizontal, skew en esquinas, espejo con Alt). ISP tiene marquee + nudge por flechas pero ninguna transformación en bloque. Mínimo viable: handles L/R para estirar en tiempo y T/B para escalar valores del grupo seleccionado.
5. **Atajos de modo** — 'A' = toggle de automatización (hoy solo el botón `#curvesBtn`), 'B' = draw mode. Verificar colisiones con los bindings de 3571-3619 antes de asignar.
6. **Micro-gestos de Live que arreglan bugs nuestros:** arrastrar un punto "por encima" de un vecino lo elimina (hoy quedan 2 kfs en el mismo t — MENOR ya reportado); snap del punto arrastrado también a los tiempos de puntos vecinos, no solo a la grilla.
7. **Color por parámetro** — hoy `PCOLOR`/`autoColor` son grises (2353/2367). Live diferencia por posición de lane + header; nosotros además superponemos la curva primaria sobre el clip, así que el color por parámetro sí paga: hues fijos (transform=cálidos, ópticos=fríos, color-grade=magentas) consistentes en inspector, chip, lane, curva y rombos.
8. **Indicador pasivo en clips no seleccionados** cuando el modo automatización está APAGADO (con él encendido, el overlay ya se dibuja en todos los clips): mini-tira tenue o contador "◆3" en la barra de título (1484).
9. **Complementos no-Live que mantienen su lugar** (de la lista original): panel "Animated" en el inspector (equivale al "Show Automated Parameters Only" de Live) · picker "+" agrupado con animados primero · navegación global prev/next keyframe · easing por defecto visible/configurable (`DEFAULT_EASE` 40) · kfstrip interactivo con rombos arrastrables · exponer `wetKf` como carril normal.

### 4b. UX general (lo más valioso)
- **P1 GRAVE: no hay búsqueda en el panel Media** — el backend (`state.mediaQuery` en renderMedia) existe; el input jamás se creó. Con cientos de medios de una película es la pérdida nº1. Fix barato.
- **P3: atajos documentados que NO existen** — 'S' para Snapping (en tooltip y paleta, sin binding), '+/−' zoom. La documentación miente en 3 sitios.
- Glifos macOS (⌘/⇧/⌫) en menús de una app Windows (3641/3472); tooltips dicen "Ctrl+" — unificar con un helper.
- Botón "Generate proxy" visible (panhead Media + inspector) — hoy solo en clic-derecho.
- Contraste bajo (#585E66 sobre #141619 ≈ 2.5:1 a 8-9 px) en status/unidades — fatiga en sala oscura; subir a ~#8A9199.
- Hit targets <20 px (cerrar pestaña de secuencia ~10 px, nav-kf 15×18).
- `.vptool` con `overflow:hidden` corta controles en ventanas estrechas — wrap o menú "⋯".
- Restaurar el hint contextual del viewport (CSS `.hint` existe; el div se perdió).
- In/Out/Dur numéricos editables en el selhead del inspector.
- Filmstrip en clips largos (mínimo: thumb en mosaico, 1 línea de CSS).
- Tokens CSS (#24272C, #454C55… repetidos ~30 veces) → variables.
- **Fortalezas a conservar:** densidad NLE pro coherente, curvas estilo Ableton (marquee/bezier/simplify RDP), drag-to-scrub universal, waveforms ventaneados sample-accurate, workspace persistente, arquitectura de autosave/lifeline notablemente sólida.

---

## 5. Plan de arreglos propuesto (por tandas, verificando cada una en el .exe)

**Tanda 1 — Cimientos rotos (riesgo de pérdida de trabajo):** C2 (undo en loadProject), C3 (undo por secuencia), C4 (nestSelection mode), C5 (reactive srcClipId), C6 (aviso multi-secuencia), F8 (pasteClip), F9 (pushUndo huérfanos), B13 (dirty en restore).
**Tanda 2 — Audio de verdad:** C1 (audio de vídeos — el grande), F4 (nest speed/loop/vol/fades), F5 (re-agendar en edits), F13 (fadeOut/curvas), F1 parcial (peaks/bands cacheados a disco + armMediaBands bajo demanda).
**Tanda 3 — Fluidez y memoria:** F3 (renderTimeline incremental), F2 (mediaTrash dispose), F14 (motionTick throttle), F1 resto (export por ventanas), upTexSub, antialias off, C7 (throttling oculto/NDI).
**Tanda 4 — Automatización pro (benchmark Ableton Live 12, ver §4a revisado):** 4a.1 lanes a nivel de pista persistentes → 4a.2 draw mode (B) → 4a.3 insert shapes → 4a.7 colores por parámetro → 4a.4 stretch/skew de selección → 4a.5-6 atajos y micro-gestos → 4a.8-9 resto; + F7/F11 (rebase de kf/wetKf en trim) + F6 (trim con speed).
**Tanda 5 — UX:** búsqueda de media, export cancelable + progreso, atajos (S, +/−, glifos), proxy visible, contraste/hit targets, hint viewport, tokens CSS.
