# Dome Studio Pro — Implementation Plan & Improvement Backlog

## ROUND 117 — Correcciones v2: Etapa 0 (Git) + Etapa 1 · [L7] modelo de automatización After Effects

**Contexto:** Beltrán entregó `CORRECCIONES-V2.md` (roadmap grande post-testeo, ~40 tickets + funciones mayores, por
etapas). Trabajo por etapas, un ticket a la vez, verificando en vivo. Detalle y decisiones en la memoria
`correcciones-v2-roadmap`.

**Etapa 0 · [D6] Git ✔** — `git init` + `.gitignore` (excluye node_modules/dist/.claude/native builds) + commit inicial +
push a `github.com/beltranlihn/Immersive-Studio-Pro` (`main`) + tag `baseline-r116` (restauración pre-refactor). `gh` NO
está instalado; credential-manager cacheado hace funcionar el push. El doc quedó versionado como `CORRECCIONES-V2.md`.

**Etapa 1 · [L7]+[A2/D1] ✔ (commit `412a6a8`)** — "automatización no corre en Play". Reproducido por CDP: la evaluación
base SÍ corría; el culpable era **`_autoOff`** (el override estilo Ableton: editar un valor sobre un parámetro
automatizado lo congelaba). Cambio al modelo **After Effects** (decisión de Beltrán): `evalP` ya no lee `_autoOff` (la
automatización NUNCA se rompe); `manualEdit` → si el parámetro ya está automatizado escribe/actualiza keyframe en el
playhead, si no, solo cambia el valor estático. Perform-and-bake removido (REC `#autoRecBtn` oculto). Los botones "↻
recuperar" se auto-ocultan. Verificado por CDP (editar x=99 @ t=2 en clip animado → keyframe nuevo, sin `_autoOff`; y
no automatizado → estático). Build + deploy a las 3.

**Etapa 1 · [T1] ✔ (commit `f2873d3`)** — clic-derecho sobre clip no funcionaba: OTRO `//` se tragó el cuerpo del
handler `contextmenu` de `#tracks` (`e.preventDefault(); const id=+cd.dataset.clip; …` comentado → `id` indefinido).
Línea partida. Añadido **"Zoom to clip"** (`zoomToClip`: el clip ocupa ~96% del viewport + scroll a la izquierda).
Verificado por CDP. Deploy a las 3.

**[A1] diferido a Etapa 2** (dejar un solo botón de punto está acoplado al rediseño A2-A5). Limpieza pendiente (Etapa 2):
plumbing muerto de perform-bake/freeze + DOM de `.reEn`/`#reEnAll`. **Próximo:** [R2] deformados al render (ambiguo →
pedir captura), [L1]/[L2] glitches de pistas.

## ROUND 116 — Grado de color · Fase 1: import de LUT `.cube` (3D LUT en GPU)

**Objetivo (Beltrán):** hacerla competitiva a nivel mercado en color. Fase 1 = **LUTs creativas `.cube`** (lo que un
profesional abre y nota que falta). Ruedas lift/gamma/gain y curvas van en las fases 2-3.

**Motor:** el shader de fragmento `FSW` (programa `PW`) gana `uniform highp sampler3D u_lut` + `u_hasLut/u_lutMix`;
tras el clamp aplica `col = mix(col, texture(u_lut, col).rgb, u_lutMix)` (trilinear via textura 3D → el look como
transform final). Infra: registro `_lutReg` (path→textura 3D), LUT **identidad** por defecto (el sampler3D siempre
válido), parser `.cube` (`parseCubeLUT`, orden R-fastest = layout de `texImage3D`), `loadLUT` (lee por `DSP.readText`),
`bindClipLUT(c)` (setea uniformes + bind en unidad 2). Por-clip: `props.lut`=path, `props.lutMix`=0..100 (serializan en
props). `preloadLUTs()` recarga las LUTs referenciadas al abrir un proyecto. Aplica en la ruta PW (clips az/el + 2D);
el export pasa por `drawClip` → incluye la LUT. *(Pendiente: la ruta PFD de clips fulldome-source; fase 2.)*

**UI:** fila "LUT" en el inspector (cargar `.cube` vía nuevo `DSP.pickFile` con filtro / nombre / **slider de
intensidad** / quitar). `dsp:pickFile` (picker genérico con filtros) añadido a main.js + preload.

**GOTCHA cazado (clave para futuras texturas 3D):** el app deja `UNPACK_FLIP_Y_WEBGL=true` global (para subir
imágenes/vídeo 2D). `texImage3D` con FLIP_Y activo da **INVALID_OPERATION** y deja la textura VACÍA (la LUT salía
NEGRA). Fix: en `makeLutTex`, `pixelStorei(UNPACK_FLIP_Y_WEBGL,false)` + `UNPACK_ALIGNMENT,1` antes del `texImage3D`,
y restaurar después. Otro: RGBA8 3D **no es FBO-renderable** (framebufferTextureLayer da INCOMPLETE) → no sirve para
leer la LUT de vuelta; validar por sampling en un draw real.

**Verificado por CDP:** parser (2³, len 32), y píxel del composite: verde `[30,180,60]` → con LUT `[0,232,102]`, y al
50% de intensidad `[15,206,81]` = punto medio exacto (mezclado lineal correcto); fila del inspector con nombre +
intensidad + quitar. Build + deploy a las 3.

## ROUND 115 — Render in place (hornear un clip/nest y reemplazarlo en el timeline)

**Pedido (Beltrán):** aplanar composiciones pesadas para que el playback vuele. Clic-derecho en un clip/nest →
**"Render in place…"** → lo renderiza con SU duración, a tamaño de layout, con sus fx/automatización, y **reemplaza
la instancia** en la misma pista/posición. Excluye capas de ajuste externas (las internas del nest quedan). El nest
sigue en Media; solo se sustituye la instancia del timeline. Guarda en `<proyecto>/rendered clips/`.

**Implementación (reutiliza el motor de export, mínima cirugía):** `runExport` extendido con 3 flags —
`opt.rangeT` [t0,endT] (rango fijo), `opt.isolateClips` (swap temporal de `state.clips` → aísla el clip, excluye
capas de ajuste), `opt.outPath`+`opt.silent` (escribe directo, sin diálogo de guardado ni reveal). Nuevas funciones:
`ripFormatDialog` (**solo H.265 / H.264 → .mp4**, sin PNG-seq ni HAP; default HEVC para domo, H.264 para 2D —
decisión de Beltrán), `addVideoFromPath` (importa un MP4 de disco como media),
`renderInPlace(clip)` (guardado→carpeta, render aislado, import, reemplazo con `pushUndo`; domo→`props.fulldome=true`
para llenar 1:1, 2D→pantalla completa; la transformación queda horneada). Ítem en el menú contextual del clip.

**Verificado por CDP (render mínimo, la GPU del dev se cae en renders grandes — el `.exe` fuerza la RTX y exporta
bien):** flat 640² · clip imagen con `exposure` → render aislado escribe MP4 válido (2954 B, 0 errores),
`state.clips` restaurado; reemplazo: clip pasa a `video`, misma dur/pos, original removido, fuentes (nest+imagen)
siguen en el pool. Build + deploy a las 3. **Formatos: solo H.264 / H.265** (PNG-seq y HAP descartados por Beltrán).

## ROUND 114 — Paridad de diálogos de creación (Domo + 2D con visor) + COBERTURA de domo (FOV)

**Pedido (Beltrán):** dar a los formatos Domo y 2D la misma paridad que la sala 360 (diálogo con visor). En 2D,
previsualizar la proporción del lienzo según el pixelaje. En Domo, mostrar el domo y **elegir la cobertura**
(180/200/210/220°) porque hay domos de distinto FOV, y que eso **repercuta en la deformación real** del editor.

**Motor — cobertura como una sola fuente de verdad (`state.seqCov`, grados; def 180):** el radio del contenido en
el máster es `rho = zenith / (cobertura/2)`, así que un FOV mayor acerca el horizonte al centro (decisión de Beltrán:
"mantener elevación real"). Enchufada en los CUATRO puntos acoplados:
1. **Warp (forward)** — uniforme `u_covHalf` en `VSW` (sector + gnomónico); seteado en el camino de dibujo del domo.
   Init a `HP` tras crear el programa → nunca 0 (sin división por cero en el path flat).
2. **Inverso** — `f2azel`/`azel2f` usan `curCovHalf()` (clics/colocación coinciden; el borde puede caer bajo el horizonte).
3. **Guías 2D** — anillos de elevación `/90 → /curCovDeg()`; anillo **HORIZONTE** ámbar cuando cov≠180.
4. **Malla 3D** — `buildDomeMesh(covHalf)` reconstruye el casquete (zen=rr·covHalf, >hemisferio para 210°+);
   cacheada por `_domeCov` → barata por frame.
Persistencia: `cov` en `newSeqMedia`/`serMedia`/`loadSeqIntoState`/`newProject`; chip de formato muestra `210°`.

**UI — visor compartido `drawSeqViz`** (paridad con el esquema de sala): rectángulo de proporción + relación de
aspecto para 2D; disco fisheye con anillos + **horizonte que se mueve hacia adentro** al subir el FOV para Domo.
- `newSequenceDialog`: visor + segmento Domo/2D + selector de **Cobertura** (domo) / W×H (2D), en vivo.
- Landing "New dome project" → nuevo `domeSetupDialog` (resolución + cobertura + fps + visor + nota explicativa).
- Landing/`flatResDialog` (2D): visor de proporción en vivo.

**R114b — cobertura EDITABLE tras iniciar el proyecto** (pedido de Beltrán: retargetear un domo ya montado a otro
FOV y exportar rápido). `openSeqSettings()` (clic en el chip de formato, o menú de la pestaña de secuencia →
"Ajustes…"): visor fisheye + selector de cobertura que **aplica en vivo** a la secuencia activa (`as.cov` +
`state.seqCov` + `render()`), redeformando todos los clips al instante. Verificado por CDP: 180→210 en vivo, dirty ✓.

**Verificado por CDP en el .exe dev:** mapeo exacto — 180°: horizonte en rho=1 (sin regresión); 210°: horizonte en
rho=0.857, borde del disco = −15° (bajo el horizonte); `f2azel`/`azel2f` correctos; `newProject('dome',…,210)`
persiste `cov=210`; render 2D+3D sin excepción con `_domeCov`=105°; visores capturados OK. Build + deploy a las 3.

## ROUND 112 — Rediseño del editor de sala 360 (coherencia con el sistema de diseño)

**Motivo (Beltrán):** el diálogo "Nueva sala 360" (donde se configuran muros/piso y el esquema de la sala) se veía
pobre y fuera de tono con el resto del software, que sí luce bien. Aplicar las reglas de diseño ya establecidas.

**Sistema de diseño respetado:** 3 superficies (s0 pozos / s1 paneles / s2 controles), pozos oscuros para lo editable,
secciones en MAYÚSCULA espaciada (como `.grphead2`), y el color reservado a significado (el color de rol pasó de
relleno saturado a un **punto** de identidad). Bloque CSS nuevo `/* R112 · 360 room setup */` en `index.html`.

**El formulario** (antes filas tipo hoja de cálculo con inputs desnudos de colores hard-coded y cabeceras casi
invisibles en `--ink-dim`): reconstruido con clases `.rs-*` — secciones WALLS / FLOOR / OUTPUT, cabeceras legibles,
punto de color por muro, inputs en pozos `s0` con sufijo de unidad, píxeles como `W × H`. El piso alinea a la misma
grilla (SURFACE / WIDTH / DEPTH / PIXELS). Se conserva TODO el comportamiento (presets, segmentado 2/3/4, swap de
orden, validación de roles distintos, `cb(cfg)` idéntico).

**El esquema** (`drawRoomIso`, reescrito a DOS paneles sincronizados en un solo canvas 1056×440 @2×):
- **Izquierda · 3D iso** — forma/orientación: muros por rol, marcador de espectador, grilla de piso; el muro bajo
  edición se ilumina (relleno + borde + subdivisiones) y el resto se atenúa.
- **Derecha · PLANO cenital A ESCALA** — medidas: huella real (encajada al recuadro), cada muro como línea de color
  con su **ancho en cm** + nombre, espectador con tick al frente, y **barra de escala** métrica ("2 m"/"10 m"…).
- **Vínculo:** pasar el ratón/foco por una fila del formulario resalta ese muro EN AMBOS paneles (`activeRole`).
- **Robusto a cualquier proporción** (pedido de Beltrán: salas 15×5×2, 30 de ancho, etc.): el encaje usa
  `min(ancho, alto)` → la sala siempre cabe; y **los textos usan `U=W/528` (escala del canvas, NO de la sala)** → el
  nombre y las cotas NO cambian de tamaño y siempre se leen. El plano reserva márgenes (`lmx/lmy`) para que las cotas
  exteriores no se corten.

**Verificado en el .exe dev por CDP:** diálogo sin excepciones, alineación correcta, resaltado `activeRole` en ambos
paneles, y **3 casos extremos** (corredor 15 m, 30×5, 30×3) encajando sin recortes y con texto constante. Build +
deploy a las 3 instalaciones (app.asar). Preview aislado en `scratchpad/room-preview.html`.

## ROUND 108 — Motor de reproducción WebCodecs (paridad Premiere sin proxy). Fundación E1-E3 hecha y verificada; E4-6 en checkpoint

**Objetivo:** correr HEVC 10-bit pesado y multi-stream fluido SIN proxy, como Premiere. El spike (R107c) probó que el
acantilado de 3 decodificadores es del `<video>` de Chromium, no del hardware. Construcción por etapas, aisladas y
verificadas, SIN tocar el `<video>` vivo hasta el enganche (E4-6, que requiere OK de Beltrán).

**E1 — Puente de lectura binaria por rango** (`main.js`/`preload.js`: `openRead`/`readAt`/`closeRead`). Lee el `moov` y
las muestras del MP4 de 12 GB por trozos, sin cargarlo entero. **Bug de seguridad cazado:** `Buffer.allocUnsafe` es
pool-backed → por IPC se enviaba el pool entero (fuga de memoria adyacente); cambiado a `Buffer.alloc` (ArrayBuffer
dedicado de tamaño exacto). Verificado: rangos cruzados contra lectura de Node byte-a-byte, EOF-overshoot, lectura tras
cerrar → `null`. **OK.**

**E2 — Demuxer MP4 por rango** (`demuxMP4` en `app.js`): parseo ISO-BMFF (stsd/hvcC·avcC, stsz/stsc/stco/co64, stss,
stts, ctts, mdhd/timescale), encuentra el `moov` esté al principio o al final, construye offsets+pts+keyframes y la config
del decoder. Codec HEVC por sondeo, H.264 desde `avcC`. **Bug cazado:** leía el `type` de caja en el offset del `size`
(q, no q+4). Verificado end-to-end (demux → `VideoDecoder` → **150/150 frames, 0 errores**) en HEVC10 faststart,
HEVC10 con moov-al-final, y H.264. **OK.**

**E3 — Motor `ClipDecoder`** (`makeClipDecoder` en `app.js`): un `VideoDecoder` por fuente + anillo acotado de
`VideoFrame` decodificando por delante del cabezal; `frameAt(t)` síncrono para el render; evict por detrás; seek =
reset al keyframe previo (con detección de sentido para NO resetear en avance normal); racha de errores → `dead` →
fallback. Verificado en el **caso exacto de la sala** (4 decodificadores concurrentes sobre el mismo HEVC10 1080p60 en
in-points distintos): **97-100% de aciertos de frame, ~15 ms de lag (medio frame), ~10 frames en caché cada uno, seek
adelante y atrás OK.** **Bug cazado:** con clips de un solo GOP el reset hacia atrás no disparaba (regenerados con
keyframes regulares, como el material real). **OK.**

**Estado:** E1-E3 son código INERTE (nada los llama aún) → la reproducción actual con `<video>` no cambia. El
`.exe` desplegado sigue en R107; no se rehace hasta que E4-6 enganche algo real.

**E4-6 — Enganche al playback (hecho, pero TRAS UN FLAG APAGADO por ahora).** `upTex` sube también `VideoFrame`
(orientación verificada: `<video>` y CD dan rojo-arriba/azul-abajo, sin espejo). `vinstEnsure` abre un `ClipDecoder`
para el ORIGINAL sin proxy (proxy y export siguen por `<video>`); `driveCD` en `ploop` sube el frame de la caché y
salta el servo de `<video>`; `vinstSeek` scrubea por CD; el audio sigue por `vi.ael`; fallback automático a `<video>`
si el códec no entra o el decoder muere (`m._cdFail`). Lectura en bloque (4MB) para no toparse en el I/O por muestra.

**Por qué queda tras un flag (`state.view.wcDecode`, OFF por defecto):** el motor es CORRECTO y rápido **en
aislamiento** — 4 ClipDecoders sobre el film HEVC10, target móvil a 60fps: **anillo lleno (22 frames), feed 311ms POR
DELANTE del cabezal, 0 congelamiento**. Pero enganchado al `ploop` real, los pumps se **quedan sin hilo principal**:
el trabajo síncrono por frame (`render` del compositado de 4 muros + sala 3D, `collectDrawnVideoClips`,
`refreshInspector`, `meters`…) satura el event-loop y el `setTimeout` de los pumps se posterga → el feed cae ~8%
por debajo de 60fps y, con algún reset, la caché se vacía → mostraría el póster congelado. **Medido:** aislado feed
+311ms; en vivo feed −474ms. No es el motor: es contención de hilo. Por eso NO se activa (encenderlo regresaría el
caso 4× a peor que hoy). Con el flag OFF la app se comporta EXACTAMENTE como R107 (verificado: 4 clips por `<video>`,
render 60fps, sin CD).

**Lo que falta para encenderlo (E7, futuro):** mover los pumps de decodificación a un **Web Worker** (hilo propio,
como Premiere) — el reto es que el worker no ve `DSP`, así que las lecturas por rango habría que proxearlas
main↔worker, o leer en el worker por otra vía. Alternativa más barata a explorar: alimentar el decoder de forma
SÍNCRONA desde `driveCD` (una vez por frame de render, garantizado) en vez del pump con `setTimeout`.

**Estado real:** E1-E3 verificadas y activas-pero-inertes; E4-6 completas y verificadas (orientación, no-regresión)
pero **tras flag OFF**. Toda la infraestructura queda en el build, lista para E7. Nada cambia para el usuario hoy.

## ROUND 111 — Limpieza de código muerto + Salida SPOUT (addon nativo DirectX, alternativa local a NDI). Verificado en el .exe instalado

**Orden (R110 dejó código muerto):** eliminados `audioModuleMax`, `bindDividerResize` y `state.tl.audioH` (ya no se usaban
tras el rediseño del audio). `loadProject`/estado ahora persisten `audioCollapsed`. Build + deploy.

**Spout (alternativa a NDI, misma máquina).** Comparte el máster del domo como TEXTURA GPU local (Resolume/TouchDesigner/OBS
lo reciben zero-copy) en vez de por red.
- **Addon nativo `native/spout-send/`** (N-API, como el de NDI). Usa el SDK **SpoutDX** (DirectX 11, headless — crea su propio
  `ID3D11Device`, no necesita contexto GL). SDK vendorizado desde github.com/leadedge/Spout2 (SpoutDX + 6 archivos de SpoutGL,
  todos planos → `#if __has_include` resuelve). `binding.gyp` linka `d3d11.lib dxgi.lib winmm.lib` (winmm por `timeBeginPeriod`
  de SpoutFrameCount). Expone `available/start/send/stop`. Compila para el ABI de Electron 42.
- **Puente `DSP.spout`** en preload (calca `DSP.ndi`). **Render** en app.js: `spoutTick` (composite del máster → FBO → readPixels
  → `DSP.spout.send`, flip en el addon), `startSpout/stopSpout/spoutMenu`, `_spout*` vars — espejo del NDI. **Botón `#spoutBtn`**
  "SP" junto al de NDI, mismo indicador cian pulsante "en vivo". OFF por defecto, solo arranca con clic.
- **Verificado** (dev + **app instalada**): addon carga (`available:true`, sin loadError), `start` abre D3D11 + registra el sender,
  `send`→true, `spoutTick` corre ~30fps **sin excepción** (16 ticks/700ms), botón visible + toggle + `.on`. El `.node` quedó en
  `app.asar.unpacked` → el deploy copió también esa carpeta a las 3 instalaciones. Que un receptor externo lo vea lo confirma
  Beltrán en su software (como el NDI). Build + deploy (00:04).

## ROUND 110b — Correcciones tras feedback: VIDEO al ruler-pad (no franja) + menú crear-pista filtrado por tipo

- **VIDEO ya no es una franja aparte** — el texto va en el `.rulerpad` (la esquina vacía que ya existía arriba de las
  cabeceras): `renderTimeline` pone `<span class="dvlab">Vídeo</span>` ahí si hay pistas de video; `.rulerpad` pasa a
  `display:flex;padding:0 10px`. La barra de AUDIO abajo se mantiene (es también el toggle de colapso). Verificado: rulerpad
  = "Video", sin `.trackdivider` de video.
- **Menú de crear pista filtrado por tipo:** `trackCreateItems(kind)` → en pista de video solo "Crear pista de vídeo", en
  audio solo "Crear pista de audio", en área vacía ambas. Aplicado al menú del header de pista (`lane.kind`) y al del área
  de pistas (detecta el `.lane` bajo el cursor). Verificado. Build + deploy a las 3 (23:14).

## ROUND 110 — Rediseño del módulo de audio + etiquetas VIDEO/AUDIO. Verificado en el .exe + deploy

Pedido de Beltrán: el rectángulo de audio quedaba incómodo (se redimensionaba a antojo). Nuevo modelo:
- **Pistas de audio a altura FIJA = mitad del default** (`AUDIO_LANE_H = round(82/2) = 41`); `laneH` las devuelve fijas,
  sin resize ni collapse por-pista (`.lanehdr.aud .laneres/.lcol{display:none}`).
- **El contenedor mide EXACTAMENTE la suma de sus pistas** (auto height, sin `state.tl.audioH`, sin scroll interno). Se
  quitó el drag de la barra (`bindDividerResize` ya no se llama). Verificado: 1 pista → módulo 59 (18+41); 2 → 100 (18+41+41).
- **Colapsable:** la barra AUDIO ahora es un TOGGLE (`state.tl.audioCollapsed`) con chevron ▾/▸; colapsado deja solo la
  barra (18px) y oculta las filas.
- **Barra separadora más alta** (`.trackdivider` 9→**18px**) para que el texto quepa cómodo.
- **Etiqueta "VIDEO"** arriba de las pistas de video, misma barra/estilo que "AUDIO" (nueva, en `heads`+`tracks`).

Verificado por CDP: barras VIDEO (sin chevron) + AUDIO (chevron ▾) a 18px; audio 41px vs video 82px; auto-crecimiento;
colapso→18px/0 filas; resize oculto. Build + deploy a las 3 (23:06). (`bindDividerResize`/`audioModuleMax`/`state.tl.audioH`
quedan como código muerto inocuo.)

**In/Out vs Loop (consulta):** poner In/Out ya hace bucle de ese rango (`hasWork` en `ploop` vuelve al In al llegar al Out,
con o sin el flag `loop`). El botón Loop = atajo que fija el rango desde la selección Y enciende el bucle.

## ROUND 109 — Generación de proxy: rápida (WebCodecs, 7×) + feedback claro (%, ETA, barra). Verificado + deploy

**Síntoma (test de Beltrán):** clic-derecho → Generate proxy "no generó nada". **Diagnóstico:** NO estaba roto — la captura
reproducía el `<video>` a **1× tiempo real** (`dec.play()` sin bump), así que un film de 64 min tardaba **~64 min**; el
usuario vio "Generando proxy…", nada se movía rápido, y creyó que falló.

**Arreglo — ruta rápida WebCodecs (`makeProxy`):** en vez de reproducir el `<video>`, decodifica con el demuxer de R108
(`demuxMP4` + un `VideoDecoder` alimentado por bloques de 4MB) y encoda cada frame de salida. Un decoder solo llega a
~800fps → **7× tiempo real** (medido: 30s HEVC10 1080p60 → proxy en 5,1s; ffprobe: H.264 960×540, **1800/1800 frames**,
decodifica limpio). El film de 64 min pasa de ~64 min a **~9 min**. Cae a la ruta rVFC/seek de siempre si el demux falla
(no-mp4, códec raro) → sin regresión. Los caminos en tiempo real se auto-saltan (`_np=total`).

**Arreglo — feedback:** (a) status re-disparado cada 1,5s con **`Generando proxy X · 42% · ~4min restante`** (ETA); (b)
en el panel de medios, barra **cian de 14px con el % centrado** sobre la miniatura desde que arranca (`_pxGen`), se limpia
al terminar; (c) sigue el "PROXY %" en el clip. DOM throttleado a 150ms (no jankea a 800fps). Verificado por CDP: barra
`.pbar.gen` 14px, fill cian 42%, texto "42%".

**Nota de fluidez (test de Beltrán):** 2D a ½ va bien; 3D se traba — consistente con la contención GPU (el render 3D
pesa más). El proxy (ahora rápido de generar) es la vía práctica; con proxy 960p los 4 muros deberían ir fluidos.
Build + deploy a las 3 (22:39).

## ROUND 108·NDI — Indicador "en vivo" del NDI out (evitar transmitir/gastar recursos sin querer)

Auditado: el **NDI out ya arranca APAGADO** (`_ndiOn=false`; `startNDI` solo se llama desde clics del menú `ndiMenu`,
ningún arranque implícito; con off no hay `_ndiTimer` → cero composite/readback/red). Lo que faltaba: el estado ACTIVO del
botón era el gris sutil `--state-on` (igual que cualquier toggle), fácil de no notar estando transmitiendo. Añadido en
`index.html` un indicador inequívoco `#ndiBtn.on`: **borde cian (`--auto-live`) + punto cian pulsante** (`::after`, reusa
`recpulse`; se apaga con `body.rm-on`). Cian = lenguaje "en vivo" de la app (el rojo queda para REC). Verificado por CDP:
al poner `.on`, borde `rgba(79,195,232,.6)` + `::after` con `recpulse` y fondo cian. Build + deploy a las 3 (22:20).

## ROUND 108·E7 — Intento de encender WebCodecs: feed síncrono + reset por tiempo. Sigue tras flag por 2 muros duros (GPU + reset)

Objetivo: eliminar la contención de hilo que dejó E4-6 apagado. **Cambios (correctos, conservados aunque el flag siga OFF):**
- **Feed síncrono in-frame:** el pump con `setTimeout` (ahogado por el render) se partió en `step()` SÍNCRONO llamado por
  `driveCD` una vez por frame de render (cadencia 60fps garantizada) + un `keeper` async que sólo rellena el buffer de 4MB.
- **Reset por TIEMPO, no por índice de decode:** con B-frames del HEVC, decode-order ≠ display-order, así que el índice de
  decode para un tiempo NO es monótono y las condiciones `feedBase>tgtDec`/`keyBefore-feed` disparaban resets espurios.
  Reescrito a comparaciones de PTS (`targetUs>lastFedPts+2s` fwd, `targetUs<feedBasePts` back). `BEHIND` ampliado a ~0.25s.

**Por qué NO alcanzó (medido con instrumentación temporal):**
1. **Contención de GPU (NVDEC vs WebGL).** Con el render compositando 4 muros + sala 3D, la decodificación cae a ~76fps
   por decoder (apenas sobre los 60 de tiempo real). La cola del decoder se satura (`decodeQueueSize=12` casi siempre) →
   ~200ms de latencia de pipeline. En aislamiento (sin render) el mismo motor da anillo lleno y feed +311ms POR DELANTE;
   con render, feed −474ms detrás. El cuello es la GPU compartida, NO el hilo — **un Web Worker NO lo resolvería**.
2. **Reset residual cada ~GOP** que aún vacía el anillo en vivo (aislamiento: 2 resets totales; en vivo: 4, subiendo ~1
   cada 1.5-2s). El cambio a reset-por-tiempo no lo mató → el trigger es otro (probablemente el patrón de `local`/playhead
   esclavado al audio, o la interacción driveCD+keeper). Sin root-causear.

**Conclusión honesta:** el motor es correcto (probado en aislamiento: 4× HEVC10 60fps, anillo lleno). En vivo, en ESTA
GPU, 4× decode a resolución completa + render pesado de sala compiten por la GPU y el margen es demasiado fino. Esto es
exactamente por lo que Premiere ofrece **Playback Resolution (½, ¼)** y **optimized media** para lo más pesado. Palancas
prácticas reales para el usuario HOY (sin encender nada): **bajar la calidad de preview a ½** (libera GPU para decode) o
**generar proxy** (R107, ya arreglado). El flag `state.view.wcDecode` queda OFF; la app = R107 exacto (cero regresión).

**Para retomarlo (sesión enfocada):** (a) root-causear el reset por-GOP con instrumentación de `back`/`feedBasePts`/`local`;
(b) probar CD con preview a ½ (menos carga GPU → decode se adelanta → puede que ahí SÍ entregue); (c) medir si aceptar
~200ms de latencia (BEHIND ancho) da reproducción fluida-pero-retrasada usable.

## ROUND 108-rev — Revisión de código (modelo fable) de R106/R107/R108: 2 bugs ACTIVOS + 3 del motor, arreglados

Auditoría con el modelo **fable** sobre todo lo de la sesión. Hallazgos reales corregidos (verificado que el proxy sigue OK):
- **A1 (ALTA, activo):** `makeProxy` esperaba `loadedmetadata` del `<video>` fuente SIN listener de error ni timeout → un
  archivo fuente faltante/corrupto colgaba `makeProxy` para siempre y dejaba `proxyBusy=true` → **toda la cola de proxies
  congelada** hasta reiniciar. Arreglo: `error` + timeout 15s → rechaza y la cola sigue.
- **A2 (ALTA, activo):** un proxy BUENO se borraba si `bindProxyFile` superaba los 8s (disco lento/NAS) — el timeout era
  indistinguible de "corrupto" para `attachExistingProxy` y `makeProxy`, que lo borraban. Arreglo: el timeout se marca
  (`e.timeout`), sube a 15s, y **ningún llamador borra en timeout** (sólo en corrupción/corte-obsoleto real).
- **M1 (motor):** carrera en `vinstEnsure` — `_vinst.has(c.id)` no detecta un `vi` reciclado (LRU dispose + re-add con el
  demux en vuelo) → ClipDecoder zombi (fuga de fd + `VideoFrame` + pump girando). Arreglo: comparar IDENTIDAD (`get(c.id)!==vi`).
- **M2 (motor):** un decoder muerto durante scrub/pausa no se limpiaba (sólo `driveCD`, que corre reproduciendo) → se
  replicó la limpieza + fallback en `vinstSeek`.
- **M3 / B1:** tope de 256MB en `dsp:readAt` contra un `size` de caja corrupto gigante; `DSP.stat` movido dentro del `try`
  de `demuxMP4` (cierre de fd garantizado).
- Sin hallazgos: R106 (guías canvas), `upTex`+displayWidth (sin regresión), fugas internas de `VideoFrame` (todas cerradas).
- **Veredicto de la revisión:** apto para desplegar con el flag apagado; A1/A2 eran las urgentes por estar en código vivo.

## ROUND 107 — El tirón de la sala 360 era un PROXY CORRUPTO + huérfano. Escritura atómica + auto-sanado. Verificado en la app viva + juez ffmpeg, build + deploy

**Dato de Beltrán:** `Rito360.isp` (sala 360, tira 7196×912, 4 muros) con **el mismo clip 1080p duplicado 4 veces**, uno por
muro, en 4 in-points distintos → corre laggeado y desincronizado. Sospechó del proxy ("quizás se creó mal"). Acertó.

**Diagnóstico (evidencia dura, no teoría):**
- El original `RIto_Film_1080.mp4` es **HEVC 10-bit** (`yuv420p10le`, 1080p60, 64 min, 12,5 GB). Decodificarlo **4 veces a la
  vez** en 4 posiciones distintas = el tirón. TouchDesigner fluye porque no hace esto; nosotros dependemos del proxy.
- El proxy en disco `RIto_Film_1080.dsp-proxy-k9bhpy.mp4` (2,4 GB) estaba roto por **DOS** motivos independientes:
  1. **Corrupto**: ffprobe → `moov atom not found`. Es un MP4 sin átomo `moov` → la generación se **interrumpió antes de
     `mux.finalize()`** (que con `fastStart:false` escribe el `moov` al final). Quedó solo el `mdat`.
  2. **Huérfano**: el hash del nombre (`k9bhpy`) **no coincide** con el que el medio calcula hoy
     (`proxyHash(path|fsize)` = `1bua1kk`). Aunque no estuviera corrupto, `proxyCandidates` no lo encontraría.
  → resultado: la app cae en silencio al original de 12 GB ×4, sin proxy y sin avisar.

**El bug de raíz:** `makeProxy` abría el fichero de destino con **el nombre final** (`DSP.fileOpen(cache)`) y el `moov` no
se escribe hasta `finalize()`. Cualquier corte a mitad (cerrar la app, crash) deja un proxy con nombre válido pero corrupto,
que luego el chequeo de caché encuentra y `bindProxyFile` rechaza en silencio → mina permanente.

**Arreglos (R107):**
- **Escritura atómica** — nuevo puente `DSP.rename` (`main.js`/`preload.js`); `makeProxy` codifica a `<nombre>.part` y sólo
  renombra al nombre final tras `finalize()` + escritura OK. Una sesión interrumpida jamás deja un proxy corrupto con nombre
  bueno; el `.part` se borra en el `catch`/`finally` de `pumpProxy` y en el aborto por frame congelado.
- **Auto-sanado** — `attachExistingProxy(m)`: intenta enlazar (hash exacto, y **cualquier `<stem>.dsp-proxy-*.mp4` hermano**
  vía `DSP.listDir` → rescata proxies huérfanos por archivo movido); `bindProxyFile` ahora **valida la duración** (±3%) para
  no enganchar un corte viejo. Un fichero que no decodifica o es de otro corte se **borra** (con nota de estado) en vez de
  quedarse de mina. Sustituye el re-bind de R92-T6 al abrir proyecto y el cache-hit de `makeProxy`. **Generar sigue MANUAL.**
- Un fichero ya finalizado que aun así no decodifica se borra tras el `bindProxyFile` fallido (no se deja landmine).

**Verificación (app viva vía CDP + juez externo ffmpeg):**
- **A** generación atómica → `proxyReady`, proxy **960×540 H.264, 180 frames, 6.0s, decodifica sin un error** (ffprobe/ffmpeg),
  y **NO queda `.part`**.
- **B** auto-sanado → un proxy hermano corrupto (mismo `moov atom not found` que el de Beltrán) **no se enlaza y se borra**.
- `DSP.rename` presente y funcional. Build (portable+NSIS firmados) + deploy a las 3 instalaciones (22:55).

**Para el archivo de Beltrán:** al reabrir `Rito360.isp` con este build, el `k9bhpy` corrupto se detecta, se borra y sale un
aviso; luego clic-derecho en el clip → **Generar proxy** lo rehace bien (ahora a `1bua1kk`) → los 4 muros pasan a 960p H.264
= reproducción fluida. (El re-encode del film de 64 min tarda una vez; después queda cacheado.)

## ROUND 106 — Zona segura de entrega fulldome (deuda cerrada → primer paso de R98). Verificado en el .exe, build + deploy

**Contexto:** la lista de arreglos/deuda quedó vacía en R105b y HAP (R100·H1–H6) ya estaba entregado con selección
de códec (`hap`/`hapq`) y chunks en el diálogo. Así que este es roadmap nuevo, no deuda: el primer trozo
autocontenido y sin conflicto de **R98 (entrega fulldome)**.

**El overlay de "zona segura" era de juguete:** en domo un único círculo suelto a `R*0.9` (elevación 9°, sin
etiqueta); en flat un solo recuadro al 5%. Un editor de domo necesita guías con significado, no un margen genérico.

**Hecho (toggle `showSafe` existente, sin UI nueva):**
- **Domo** — anillos por ELEVACIÓN (azimutal-equidistante, como la cuadrícula): **ACTION SAFE** a 5° (margen de
  borde / edge-blend del proyector), **TITLE SAFE** a 15° (banda cómoda de lectura), ambos con etiqueta con fondo
  legible sobre contenido; **aviso de cenit** en ámbar (`--auto-ovr`) a 80° — el contenido a <10° del cenit obliga
  a estirar el cuello del público.
- **Flat** — **action-safe** (interior 93%) + **title-safe** (interior 90%), convención broadcast, etiquetados en
  esquinas opuestas para que no se pisen.

**Verificación en el .exe real (CDP, `scratchpad/verify-safe.mjs`):** diferencial ON vs OFF sobre el canvas de
overlay — robusto frente a lecturas absolutas (que ya me mintieron antes). En ambas ramas: **sin excepción** y
**Safe ON añade tinta** (domo 14051→17296 px, +anillos+etiquetas; flat 6280→11390 px, +2 recuadros+etiquetas).
Build (portable + NSIS firmados) + deploy a las 3 instalaciones (22:34).

## ROUND 105b — Los motivos de deshabilitado, por fin. Verificado 11/11 + 77/77 total, build + deploy

**El hueco que quedaba de R102·D-T4**: el mecanismo (`data-why` → Info View en ámbar) existía y **sólo lo usaba
1 sitio de la app**. Ahora lo usan todos los controles que se bloquean.

**El fallo era sutil, y por eso llevaba ahí desde R94:** `#ringBtn` y `#adjLayerBtn` **SÍ tenían motivo**, pero
se escribía en `.title` **DESPUÉS** de llamar a `setDis` → `data-why` nunca se ponía → la Info View lo leía como
una etiqueta normal, **sin ámbar**. Y `#prevMk`/`#nextMk`/`#exportBtn` no tenían motivo ninguno.
Además, en el export el motivo real (*"H.264 se topa cerca de 4096² en esta GPU — cambia a H.265 o PNG"*) ya se
calculaba pero iba **sólo** al texto de estimación: pasabas el ratón por el botón gris y la barra callaba.

**Hecho:** el motivo entra por el **3er argumento de `setDis`**, que es el único camino que marca `data-why`.
- `#prevMk`/`#nextMk` → *"No locators yet — add one with M"* — **el motivo enseña el atajo que falta**, que es
  la razón de ser de esta superficie: es el instante en que el usuario mira y quiere aprender.
- `#exportBtn` → *"Add clips to the timeline first"*
- `#ringBtn`/`#adjLayerBtn` → *"Import images or videos first"* (ahora sí en ámbar)
- Botón Exportar del diálogo → el motivo del códec, en ámbar, además de en la estimación.

**Verificación (11/11)** — lo que se comprueba no es "hay texto", es que la señal **no mienta**: los 5 controles
tienen motivo · el motivo llega a la barra **en ámbar** · el motivo **enseña el atajo** · y al habilitarse
**`data-why` se borra**, la barra **deja de ir en ámbar** y el botón **recupera su etiqueta normal** (si el
motivo se quedara pegado, el control diría que está bloqueado cuando ya funciona).
**Regresión total: 77/77** (sistema 13 · Info View 8 · color clip 10 · affordance 5 · foco 7 · derivado 6 ·
revisión 13 · R105 4 · motivos 11).

## ROUND 105 — Deuda de R102/R104: 2 arreglos reales, 1 bug inventado, 2 declinados. Verificado 4/4 + 13/13

**Un "bug" que me inventé y verifiqué antes de tocar.** Había reportado que `previewQuality` se revertía a Full
al abrir un proyecto, con el botón marcando ¼. **Falso** — medido: `newProject` y cambiar de modo la respetan, y
el botón siempre dice la verdad (`setCompSize` sólo se llama desde el handler). Es el mismo error que cometí con
el doble-export: verifiqué el síntoma, no la alcanzabilidad. Comprobar antes de arreglar lo cazó.

**Arreglos reales (2):**
- **`previewQuality` se persiste** (`localStorage.dspPreviewQuality`). El hueco de verdad no era coherencia sino
  que la elección no sobrevivía al reinicio → volvía a Full. Ahora `applyPreviewQuality()` la restaura al
  arrancar. Verificado: ½ persiste y se recupera con el botón marcado.
- **El `21px` accidental**: era el botón "+" de secuencia (`.seqadd`), 1px más alto que sus pestañas hermanas
  por el `font-weight:700`. `height:20px` explícito + `box-sizing` → 20px, dentro de la escala {16,18,20,22,24}.

**Declinados conscientemente (2), anotados en vez de forzados:**
- **undo/redo/help a 3px del borde superior → NO a 0.** Ese borde es la barra de título del SO, no un borde de
  pantalla aprovechable (Fitts: "anchura infinita" aplica a bordes reales de pantalla). Y están dentro de una
  barra con su propio padding; forzar 0 rompería la rejilla a cambio de nada.
- **Color de clip derivado siempre al pintar → NO.** Hoy el color se escribe en `m.color` al crear (un valor de
  `CLIP_HUE`, que `clipTint` respeta como si fuera elección del usuario). La corrección "limpia" (crear con
  `color:null`) tocaría 7 sitios Y rompería el punto de color del panel de medios (lee `m.color` directo, línea
  1468) — superficie de regresión real por un beneficio hipotético (reequilibrar `CLIP_HUE` algún día). Deuda
  aceptada: los colores son correctos hoy.

**Verificación: 4/4** (sin 21px · "+" a 20px · ½ persiste · se restaura marcado) + **13/13** regresión del sistema.

**Deuda que QUEDA (honesta):** motivos de deshabilitado en el Info View (sólo 1 control pasa motivo — es trabajo
de redacción sobre los `setDis`, deliberado no masivo) · dianas a 19.7–20.7px (Blender ships 22; lo peor ya
resuelto) · el coste del composite sin medir (mi control de píxeles nunca funcionó).

_Generated from an adversarially-verified multi-agent audit (17 agents). Source of truth for ongoing work._

## IN PROGRESS / DONE this pass
- [x] Clip trim clamped to source media duration (video/audio can't stretch past source); lane change restricted to same kind.
- [x] Infinite timeline (content grows with scroll).
- [x] 3D viewport full-bleed; wheel/middle-drag = Pan (grab cursor); orbit free.
- [x] tcMode 3-way (timecode/frames/bars) + fmtTime() dispatcher; removed quantize dropdown; removed L/R meters (visual focus).
- [x] i18n full sweep → English; `<html lang=en>`; verified no Spanish left in DOM.
- [x] Curve editor: add point via dbl-click on empty / right-click → Add (single click no longer creates); per-kf easing presets in right-click menu; translated. (Freeform bezier handles still pending — item 14b.)
- [x] Locators: click-select, drag with snapping (clips/playhead/other locators/bars grid), dbl-click rename, Delete key, names drawn on ruler, persisted in save/load/undo/autosave.
- [x] Blue→grey chrome: togbtn/tbtn/playb/ringbtn 'on' & idle states neutralized to #313640/greys; panel-header icons muted; blue now reserved for playhead/selection/keyframes/import/export only. Verified computed styles.
- [x] **Composition Groups** (headline feature): state.groups + clip.groupId/slot; makeClip factory; createComposition ring/grid/random; openCompose modal (kind seg + dynamic params + mask incl. "Circle (alpha)"); group inspector panel (Transform-all: Count/Spin/Elevation/Size/Mask deltas preserve per-member tweaks; Reshape/Ungroup/Delete); member highlight on timeline; membership chip on member clips → Edit group; Delete key removes group; persisted in save/load/undo/autosave. Verified ring(az spread)/grid(rows×cols)/random + transforms + chip via eval + screenshot (7 circular-masked clips + group panel).
- [x] **Freeform bezier keyframe handles** (item 14b): k.hOut/hIn (dt,dv) handles + bezSegY cubic solve in evalP; "Free (bezier)" in curve right-click menu (initBez seeds smooth tangents); handles drawn + draggable in curve editor; presets clear handles. Verified linear 50 vs bezier 33.1, flat-start slope, monotonic, handle-drag updates angle.
- [x] **NumberBox editable** (item 12): dbl-click value box → inline type+Enter/Esc; wheel = ±step (shift 0.1 / alt 5); right-click row = reset to default. Verified type 123, wheel 124, clamp 999→360.
- [x] **Disabled states** (item 8): global `.dis` token + `updEnable()` driven from updStatus/renderTimeline; Split/Delete need a clip, locator nav needs markers, Export needs clips, Compose needs media. Verified empty/filled/no-selection transitions.
- [x] **Collapse-to-rail** (item 13): media + inspector collapse to 34px rail with vertical label + expand button (#hideMedia/#hideInsp ↔ #mediaRail/#inspRail); resize() re-fits viewport. Verified 284↔34 / 328↔34.
- [x] **Workspace persistence**: panel widths + collapse states saved to localStorage ('domeProWs') on gutter-drag/collapse, restored in init (loadWorkspace). Stores the *expanded* width even while collapsed so re-expand is correct. Verified across reload.

## ROUND 103 — Auditoría adversarial: "¿qué pasa si aprieto dos cosas?". 1 bug real + 1 autocorrección

Objetivo: encontrar lo que rompe en una **sesión real de edición** antes de que le pase a Beltrán. Ocho tandas
de estrés (`scratchpad/stress-*.js`).

### 🔴 EL BUG: `Ctrl+B` armaba el RAZOR — y el siguiente clic cortaba

Los atajos de herramienta **ignoraban los modificadores**. El propio comentario del código lo admitía: *"the
bare-B razor below, **which ignores modifiers**"*. R97 arregló el ORDEN de los handlers, no la causa.
Matriz medida (6 letras × sin-mod/Shift/Ctrl/Ctrl+Shift): **9 combinaciones armaban una herramienta por
accidente**. Las graves:
- **`Ctrl+B` → razor.** Ctrl+B es memoria muscular de "negrita" en cualquier app. No pasaba nada visible… y el
  siguiente clic **cortaba un clip**.
- **`Ctrl+H` → mano.** (Ctrl+H = reemplazar en medio mundo.)
Que `V`/`Z`/`C`/`T` se salvaran **no era diseño**: era que Ctrl+V/Z/C/T ya tenían dueño y hacían `return` antes
de llegar. B y H no lo tenían, así que caían.
→ Arreglado con `const bare=!mod&&!e.shiftKey&&!e.altKey` en las 6 teclas. `Shift+T` también colaba (miraba
`!mod` pero no el Shift). Matriz ahora **limpia: 0 accidentes**.
→ Y `Shift+B` sin puntos seleccionados ya no calla: dice *"Shape Box: primero selecciona puntos en una curva"*.
Antes caía al razor; luego, al arreglar eso, no hacía nada y el usuario tampoco sabía por qué.

### ⚠️ AUTOCORRECCIÓN: mi hallazgo F1 de la revisión estaba SOBREVENDIDO

Reporté que un doble `Ctrl+Shift+E` dejaba el diálogo de export muerto. **Verifiqué el síntoma pero NO la
alcanzabilidad**: probé que llamar `openExport()` dos veces lo rompe, y *afirmé* que el teclado lo provocaba.
**Falso.** Existe una guarda global preexistente: `if(document.querySelector('.overlay'))return;` **antes** de
todos los atajos. Medido con teclas reales: Ctrl+Shift+E ×2 → **1 → 1**. Ctrl+, ×2 → 1 → 1. Ctrl+K + Ctrl+Shift+E
→ 1 → 1. Incluso con el foco forzado fuera de todo input. Y Suprimir con un modal abierto no borra clips.
La paleta además se auto-limpia (`if(ov)ov.remove()`) y **se cierra antes de ejecutar el comando**
(`run(i){ov.remove(); filtered[i][3]();}`), así que tampoco por ahí.
La guarda de `openExport` se queda (idempotencia barata), pero **no era un bug vivo**. Lección: verificar el
síntoma no es verificar que el usuario pueda llegar a él.

### Lo que se probó y AGUANTA (sin cambios)

Recursión (meter la secuencia activa dentro de sí misma: 5ms, sin cuelgue) · borrar y deshacer **mientras se
reproduce** · borrar un clip **a medio arrastre** · deshacer **a medio arrastre** · quitar un efecto que la
pista automatiza (`laneAutoP` lo resuelve a otro parámetro) · borrar el medio de un clip vivo · borrar un
**Automation Item enlazado** · borrar una **secuencia colocada como clip** · fuente de modulación desconocida
(no da NaN) · clip en pista inexistente · **duración 0** · **fps 0** · keyframes fuera del clip recortado ·
cambiar dome/flat/room en caliente · trim con el vecino borrado a mitad.
**Serialización (9/9):** `color:null` sobrevive como null · la elección del usuario sobrevive · undo/redo
conservan ambos · `audioH` se guarda · **un proyecto viejo con gris heredado se repara solo al abrirlo**.

### El patrón de la jornada: mis tests mintieron 5 veces

Captura que era Blender · dianas ocultas tras el módulo de audio · headers en orden inverso (medía V6 creyendo
que era V1) · reutilizar el botón de prueba (el tooltip hace `if(el===curEl)return`) · y aquí: stress-7 **borró
la secuencia** y stress-8 corrió sobre los restos (todo `undefined`), más leer `c.color` de una referencia
muerta tras un undo — **el mismo peligro que el código ya documenta para shapeBox**: `restore()` REEMPLAZA los
objetos clip. Regla: releer por id después de un undo, y reiniciar estado entre tandas.

**Deuda anotada:** los sitios de creación **escriben** el tono derivado en `c.color` en vez de dejar `null`, así
que si algún día se rebalancea `CLIP_HUE` los proyectos viejos no lo recogerán (hoy es correcto; sería más
limpio derivar siempre al pintar). Y 13 de los 14 creadores de overlay no son idempotentes — hoy inalcanzable
gracias a la guarda global, pero es una guarda a un nivel, no una propiedad de cada diálogo.

## ROUND 102 · REV — Revisión de código adversarial: 5 hallazgos, arreglados. Verificado 66/66, build + deploy

**Por qué importa esta ronda:** las 55 aserciones de R102 verificaban que **lo construido hacía lo prometido**,
pero **ninguna preguntaba "¿y si el usuario pulsa esto dos veces?"**. Eso sólo lo encuentra una lectura
adversarial. Encontró un fallo que rompía por completo una función central.

**F1 (grave) · El diálogo de export quedaba MUERTO al abrirlo dos veces.** `openExport()` no comprobaba si ya
estaba abierto. El overlay tapa el ratón **pero no el teclado**, así que un segundo `Ctrl+Shift+E` volvía a
entrar y dejaba **dos modales**: veías el de arriba, pero `$()` es querySelector = **PRIMER match**, así que
todo el cableado (`#exCodec`, `#exGo`…) se enganchaba al de abajo, viejo y oculto. **Medido: el botón Export
del modal visible tenía `onclick == null`** — pulsabas Exportar y no pasaba nada. Preexistente; lo destapó
tocar `openExport`. Arreglo: `if(document.getElementById('exOv'))return;`.

**F2 · La Info View mutilaba el tooltip del Trim.** El regex partía por el primer delimitador y `(` era uno,
así que "Trim (T) — the cursor picks it…" se cortaba DENTRO del paréntesis → **«Trim — T) — the cursor picks
it…»**: paréntesis huérfano (el `replace(/\)$/)` sólo quitaba paréntesis FINALES), doble raya y atajo sin
detectar. Reescrito: **se extrae el atajo PRIMERO** y luego se parte nombre/descripción. De paso se descubrió
que el código tiene **dos convenciones** de tooltip y el parser sólo entendía una: ahora acepta `Nombre (V)`,
`Nombre (T) — descripción` y `Nombre · Ctrl+Z`.

**F3 · `laneTint()` era código muerto con el fallback viejo `#3C4046`.** 0 llamadas, pero una segunda fuente de
verdad para el color de clip esperando a que alguien la usara: habría devuelto el gris heredado en vez del tono
del tipo, y como `#3C4046` es justo el centinela de "sin color", el fallo habría sido **silencioso**. Borrado.

**F4 · `state.lastExport` no sobrevivía al reinicio.** Sólo vivía en memoria: configurabas HAP Q y al reabrir la
app volvía a PNG/4096/60. Para quien exporta el mismo formato cada día, **la sesión no es la unidad que
importa**. Persistido en `localStorage` (`dspLastExport`), que ya se usa aquí para los recientes.

**F5 · `UI` era una foto de :root sin forma de refrescarla.** Hoy no rompe (el `<style>` está en `<head>` y se
parsea antes del `<script>` del final de `<body>`), pero el comentario prometía "una sola fuente de verdad" y
eso sólo era cierto al arrancar: el día que exista un tema claro o alto contraste, el DOM se re-tintaría y el
canvas —waveforms, curvas, regla— se quedaría con la paleta vieja **sin error ni aviso**. Ahora `UI` se rellena
en sitio y existe **`refreshUI()`**.

**Gotcha del test (mío):** los 4 primeros casos del parser fallaban porque reutilizaba el mismo botón de prueba
y el sistema de tooltips hace `if(el===curEl)return` → ignoraba los hovers 2º en adelante y todos devolvían el
resultado del 1º. Falso fallo del test, no del parser. Elemento nuevo por caso.

**Verificación: 66/66** (sistema 13 · Info View 8 · color de clip 10 · affordance 5 · foco 7 · derivado 6 ·
alturas 4 · **revisión 13**).

## ROUND 102 · CIERRE — Alturas (no hacía falta) · el export recuerda. Verificado 55/55, build + deploy

**1. Tiers de altura de cabecera: MEDIDO, y NO SE HIZO.** La regla de Resolve (*"The number of clips is listed,
**but only if the track is tall enough**"*) existe para que un layout único no se recorte al encoger.
Medido a las cuatro alturas (colapsada 20 · mín 34 · def 82 · máx 260): **nada se recorta en ninguna**; el
contenido rellena su caja exacta. Ya tenemos un tier de facto: el estado `collapsed`. **Implementar tiers sería
añadir maquinaria para un problema que no tenemos.** Lo que sí existe es la dirección contraria — a 260px sobra
sitio para medidores y dB en el cabezal, como hace Resolve — pero eso es **función nueva**, anotada para R98,
no colada aquí como "pulido".
*(Gotcha del test: los headers se pintan en orden INVERSO (V6 arriba), así que `.lanehdr[0]` NO es la pista 0.
La primera versión mutaba la pista 0 y medía la de V6 → 82px en los cuatro casos. Se mide por `data-lane`.)*

**2. Operate → Adjust: aplicada la mitad que aplica, y dicho por qué la otra no.**
- **Proxies: ya estaban bien.** `makeProxy(m)` no tiene ajustes: ejecuta y punto. No hay paso de configuración
  que eliminar.
- **Export: la regla NO aplica y no se aplicó.** Su justificación es *"prevents annoying popups forcing you to
  decide settings before you even know how they'd look like"* — pero en un export **sí sabes cómo quedará** (es
  tu línea de tiempo), y equivocarte cuesta **minutos de render y un fichero escrito**. Ni Premiere ni Resolve
  disparan un export sin diálogo. Inconsistencia deliberada, documentada como pide la HIG.
- **Lo que sí aplica, y estaba roto:** el diálogo **no recordaba nada**. Medido: cambias a MP4/2048/24, cierras,
  reabres → PNG/4096/60 otra vez. Cada export te volvía a interrogar. Ahora abre con `state.lastExport`.
  Detalles: se recuerda **al elegir**, no al exportar (cerrar sin exportar también es información); un códec que
  ya no exista **no deja el select en blanco**; y se llama a `upd()` tras restaurar, porque asignar `.value` **no
  dispara `change`** y el bitrate/aviso de tamaño se quedarían mostrando lo del códec anterior.

**Regresión total R102: 55/55** (sistema 13 · Info View 8 · color de clip 10 · affordance 5 · foco 7 ·
derivado 6 · alturas 4 · memoria de export 2).

**Balance de R102 — de 35 cambios propuestos:** aplicados los que la evidencia sostenía; **5 descartados tras
medir** (aclarar el fondo a #121212 · bajar el contraste del texto · escala de 6 escalones · controles a 44px ·
tiers de altura) y **3 conservados como inconsistencia deliberada** (`Offset…`, `Properties…`, export con
diálogo). Cada descarte está justificado arriba o en `PROPUESTA-DISENO-UI.md` §0.
**Deuda abierta:** pares de dianas a 19.7–20.7px (Blender ships 22) · alturas de control aún 16/18/20/21/22/24
(el 21 es un accidente) · undo/redo/help a 3px del borde (deberían ir a 0) · sólo 1 control pasa motivo a
`setDis` (el mecanismo está; falta redacción) · medidores de audio en cabecera → R98.

## ROUND 102 · D-T2d/D-T4b — Estado derivado ≠ afirmado · verbos no sustantivos. Verificado 49/49, build + deploy

**1. Estado DERIVADO ≠ estado AFIRMADO.** Un clip con `gsel` está resaltado porque **su grupo** está
seleccionado, no porque lo eligieras tú. Ableton tiene `ImplicitArm` justo para esto: una pista armada *por
consecuencia* no se ve igual que una armada con el ratón.
Dos defectos encontrados al mirarlo: (a) `gsel` usaba `--ink-2`, **más brillante** que la selección afirmada en
standby (`--ink-3`) — **lo derivado gritaba más que lo afirmado**; (b) ambos usaban la **misma forma**, así que
sólo los separaba el color. Ahora la diferencia es de **FORMA: discontinuo = por asociación**. Se lee en escala
de grises y con cualquier daltonismo, y no compite con el borde macizo de la selección propia.
Verificado (6/6): derivado discontinuo · afirmado macizo · formas distintas · **lo derivado no pesa más que lo
afirmado** (184 vs 224) · el derivado sigue visible (184 vs fondo 17).

**2. Verbos, no sustantivos** — *"Emphasize actions, not things"* (HIG de Blender). Ahí sangró FCPX: la confusión
documentada de los editores era **léxica** (*"primary storyline, secondary storyline – huh?"*), no de
comportamiento.
- `Color…` → **Set clip color…** · `Speed…` → **Change speed…** · `Track color…` → **Set track color…**
- `Return to Default` → **Reset to default** (además era Title Case suelto)
- `Show Automation` / `Show Automation in New Lane` → sentence case + ES en infinitivo.
- **1 `colour` contra 119 `color`**: la rara era esa.
**Inconsistencias DELIBERADAS, anotadas como pide la propia HIG** (*"Inconsistencies should be well founded and
documented"*): `Offset…` se queda (*to offset* **es** verbo) y `Properties…` también — es una convención casi
universal y cambiarla sorprendería más de lo que enseña. `Reveal in Explorer` y `Automation Item` conservan
mayúsculas por ser **nombres propios** (Windows Explorer; nuestra función de R95·D2).
No se tocó ni un nombre de preset (`Lower third`, `Subtitle`, `Dome master 4096`…): **esos sí son cosas**.

**3. No acoplar selección y cabezal — YA ESTABA BIEN.** Auditado, no cambiado: el código dice explícitamente
*"Clicking the clip BODY places the playhead… without selecting the clip"* y *"pure click … does NOT move the
playhead"*. Cabezal = tiempo, selección = intención. Coincide con la decisión de Blackmagic (desactivaron
"Selection Follows Playhead" por defecto desde v17). Nada que hacer.

**Regresión total: 49/49** (sistema 13, Info View 8, color de clip 10, affordance 5, foco 7, derivado 6).

## ROUND 102 · D-T2c — Selección en DOS niveles (foco por panel). Verificado 43/43, build + deploy

**Por qué.** El tema de Ableton envía `Selection` y `StandbySelection` como colores **distintos** (fondo y primer
plano), y repite el patrón para los resultados de búsqueda. Con tres paneles compitiendo por el foco (medios ·
línea de tiempo · inspector), si "seleccionado aquí" y "seleccionado allí" se ven igual, **el usuario no sabe
sobre qué van a actuar el teclado o el próximo comando**. Nosotros lo colapsábamos en un solo nivel.

**Hecho:** `setFocusPane()` marca `body.fp-timeline|fp-media|fp-inspector` en `pointerdown` **en fase de
captura** — así se pinta antes de que el clic cambie la selección y ningún handler puede tragárselo con
`stopPropagation`. Base = **standby** (atenuado); el panel con foco recupera la intensidad. Aplicado al borde
del clip, al header de pista y a las fichas de medios. **Cambiar de panel NO deselecciona**: sólo cambia quién
manda (verificado).

**Casi "arreglo" algo que no estaba roto.** El test dio `standby: none` en el contorno del título del clip →
parecía que la selección desaparecía. Investigado antes de tocar: `body.simpleclips .clip .tt{box-shadow:none}`
gana por especificidad (0,3,1 vs 0,3,0)… **y es intencionado**: en modo simple el título deja de ser el asa, así
que se le quita el indicador de asa. Y la selección **sí se ve**, porque la lleva `.clip.sel` = el **borde del
clip entero** (línea 419). Es decir: yo había apuntado los dos niveles al elemento equivocado. Corregido al
borde del clip, que es la señal que siempre está visible — y el test ahora mide **eso**, no lo que el modo
simple anula a propósito.

**Verificación (7/7):** el clic pone el foco en su panel · el foco se mueve · foco ≠ standby (borde 224 vs 140)
· standby más tenue · **standby sigue VISIBLE contra el fondo** (140 vs 17 — un standby invisible sería peor que
no tener niveles) · cambiar de panel no deselecciona · el header de pista cumple el mismo contrato.
**Regresión total: 43/43** (sistema 13, Info View 8, color de clip 10, affordance 5, foco 7).

## ROUND 102 · D-T3b — Dianas y paleta de espaciado CERRADA. Verificado 36/36, build + deploy

**El enfoque correcto no era agrandar los controles.** La norma AA (SC 2.5.8) no exige tamaño: exige
**separación**. Un control de 16px cumple si su centro está a **≥24px** del siguiente ("si un círculo de 24px
centrado en cada caja no interseca el de otro"). El 44×44 que citan los blogs es **AAA** (SC 2.5.5) y es guía
**táctil**. Así que se **midió la separación real** y se arregló sólo lo que fallaba.

**Dos errores de medición propios, ambos cazados antes de "arreglar" nada que no estuviera roto:**
1. La primera pasada dio **15 incumplimientos, uno con paso de 8px**. Imposible: dos botones de 16px no caben a
   8px sin solaparse. Causa: los controles **ocultos detrás del módulo de audio fijado siguen teniendo
   `getBoundingClientRect`**. Un rectángulo no es una diana. Con **hit-test** (`elementFromPoint`) quedaron
   **4 reales**. Misma lección que la captura de pantalla que resultó ser Blender: verificar lo que hay de verdad.
2. Los 23px de `kf`/`modb` **no eran entre botones de la misma fila: eran entre FILAS** (`.prow` medía 22px de
   alto). Estaba subiendo gaps horizontales para arreglar una distancia vertical.

**Hecho:**
- **`.prow .nav` (stepper de keyframes): 15×18 pegados, paso 15px → 20×20 con gap 4 = paso 24.** Era lo peor de
  la medición, con riesgo real de pulsar el botón contiguo.
- **M/S del header: gap 5 → 8 → paso 21 → 24.** El `gap:5px` además **no estaba en la paleta cerrada de D-T1**.
- `kf`/`modb` → 20×20 (la altura de control de Blender: *"Widget unit is 20 pixels at 1X scale"*).
- `.prow` min-height 22 → **24** (paso vertical). Nota: **Blender envía paso 22 y por tanto incumpliría** la
  norma AA de 2023 — la norma es posterior a su diseño. Preferimos la norma.
- **PALETA DE ESPACIADO CERRADA, aplicada de verdad.** En D-T1 la definí y **no la apliqué**: seguía habiendo
  11 valores. Ahora: `index.html` **{2,4,6,8}**, `app.js` **{2,4,6,8,12,16,24}** — **ninguno fuera**.
  63 gaps remapeados. Aserción nueva en `test-system.js`: sin ella, el siguiente `gap:7px` entra sin que nadie
  lo note — que es exactamente como llegamos a tener 11.

**Gotcha:** inserté `.prow .nav button{width:20px}` **justo antes** de la regla original con la misma
especificidad → ganó la última y mi regla quedó muerta. Los botones seguían a 15×18 y el test lo delató.

**Verificación: 36/36** (sistema 13, Info View 8, color de clip 10, affordance 5).

**Deuda ACEPTADA y anotada, no escondida:** quedan pares a **19.7–20.7px** de paso (`modb`, `curvesBtn`,
`tlZoomIn/Out`). Son incumplimientos reales pero menores, y cada arreglo mueve el layout y crea adyacencias
nuevas — juego del topo con retorno decreciente. Referencia: **Blender ships 22px**. Lo peor (15px) está
resuelto. Se retoma con una pasada de layout, no a base de parches.
También pendiente: alturas de control aún 16/18/20/21/22/24 (el **21 es un accidente**) y los botones
undo/redo/help a 3px del borde superior — deberían estar a **0** para ganar anchura infinita (Farris et al. 2001).

## ROUND 102 · D-T2b/D-T3 — Affordance, estado y polaridad. Verificado 6/6 + 30/30 de regresión, build + deploy

**1. Un valor arrastrable se lee como CAMPO, no como botón.**
`.prow .box` (los valores del inspector, arrastrables: `.field{cursor:ew-resize}`) estaba en **s2 — idéntico a
un botón**: dos comportamientos con la misma pinta. Ahora va a **s0**, más oscuro que el panel.
**La regla investigada NO se aplicó tal cual, y conviene dejar escrito por qué.** Decía: *"reserva exactamente
UN acento saturado para 'valor arrastrable' y no lo uses en ningún otro sitio"* (Blender: `wcol_num.item`
#4772b3, el relleno del deslizador numérico, el único acento saturado de todo su set de widgets). Pero esa regla
**presupone un presupuesto de acentos sin gastar**. El nuestro está gastado a propósito: cian = automatización
viva, ámbar = anulada — que es justo lo que nos diferencia. Un tercer acento rompería la regla que acabamos de
escribir en `:root`. La **dirección del contraste** (D-T1) hace el mismo trabajo y es gratis.

**2. El estado nunca lo lleva sólo el color.**
El clip deshabilitado (Ableton "0") se decía **sólo con opacidad + desaturación**. Ahora lleva además una
**trama diagonal**: *"Avoid using color as the only way of communicating status or other important meaning"*
(HIG de Blender), y Resolve hace lo mismo (*"A slash indicates when a track is disabled"*). La trama es **forma**:
se lee en escala de grises y con cualquier daltonismo. Movido de estilos inline a `.clip.off`.

**3. El editor de curvas invierte la polaridad.**
`.autolane` estaba en s0 — el mismo campo que la timeline. Ahora **s1 (más claro) con rejilla OSCURA**
(`rgba(0,0,0,0.38)` en `laneMode`). Blender envía graph `#303030`/rejilla `#1a1a1a` invirtiendo su secuenciador
`#181818`/rejilla `#303030`: **una curva fina y brillante necesita suelo elevado; un clip macizo necesita pozo.**
El mismo pintor sirve a los dos, así que la rejilla se elige con el `laneMode` que ya existía.

**Verificación (6/6):** el valor arrastrable es más oscuro que el panel (L* 5.1 < 9.8 < 15.2 del botón) · anuncia
el gesto con el cursor · `.clip.off` existe · lleva trama · se atenúa · la banda de curvas es más clara que el
campo. **Regresión: 30/30** (sistema 12, Info View 8, color de clip 10).

Pendiente: selección en 2 niveles (`Selection`/`StandbySelection` — necesita seguimiento de foco por panel),
estado derivado ≠ afirmado, cabecera por tiers de altura, no acoplar selección y cabezal, alturas de control
(16/18/**21**/22/24 → consolidar), verbos-no-sustantivos, Operate→Adjust.

## ROUND 102 · D-T2a — El color de clip significa algo. Verificado 9/9 + 12/12 de regresión, build + deploy

**El defecto:** `CLIP_COLORS` eran **6 grises entre L\* 19 y 29, saturación ~18%**, repartidos **por turno**
(`colorIdx++`). Es decir: indistinguibles entre sí, sin ningún significado, y encima ocupando el eje de brillo.

**LA FUENTE ESTABA MAL, y conviene dejarlo escrito.** El informe de investigación decía que los 11 colores de
strip de Blender están *"todos a la misma luminosidad (las medias RGB se agrupan en ~110–150)"*. **Medidos en
L\* se reparten 20.2** (43.0 → 63.2). La afirmación salía de promediar RGB, no de L\*. El agente la había
marcado como inferencia suya (`[I]`), no como dato — bien marcada, pero falsa.
El principio sobrevive **por otra razón**: Blender puede permitirse ese reparto porque su selección es un
**contorno**, no un cambio de brillo (la nuestra también: `.clip.sel .tt` usa `inset box-shadow`). Así que la
luminosidad constante aquí no la pide el estado — la pide que **ningún tipo de medio grite más que otro**.

**Hecho:**
- `CLIP_HUE`: 9 tonos **calculados**, no elegidos a ojo (búsqueda binaria de la L de HSL que da L\*=50 exacto
  por tono, saturación 40%). **Spread real: 0.26 L\*** frente a los 20.2 de Blender. Separación mínima entre
  tonos: 25°.
- `nest` va **neutro** (`#777777`): una secuencia es **estructura, no medio**. Se dice desaturando, sin leyenda
  — Blender hace lo mismo con `scene`. Verificado en pantalla: entre clips de color, la secuencia se lee sola.
- **El color se DERIVA del tipo al pintar** (`clipTint`), no se reparte al crear.

**Casi meto la pata:** iba a eliminar `c.color` dando por hecho que nadie elige color de clip — mi primera
búsqueda no encontró selector. **Sí existe** (`openClipColorPopup`, "Clic para elegir color del clip"). Lo cazó
comprobar antes de borrar. La solución fina la dio el propio botón *restablecer* del selector: escribe
`#3C4046`, o sea que **esos grises son el centinela de "sin color"**, no una elección. `CLIP_AUTO` los trata
como no-puestos → deriva del tipo → **arregla también los proyectos ya guardados**, sin tocar una sola elección
real del usuario. El *restablecer* ahora pone `null` (deriva) en vez de clavar un gris sin sentido.
- **Filas alternas al 2% de blanco** (`rgba(255,255,255,0.02)`). Blender envía `row_alternate #ffffff05`; la
  mayoría usa 10–15% y eso zumba sobre 30 pistas. Alfa, no un gris: sobrevive a un cambio de tema.

**Verificación (9/9):** misma luminosidad en todos los tipos (spread 0.26) · tonos separados (mín. 25°) · nest
neutro · deriva por tipo · tipo desconocido no revienta · **gris heredado tratado como sin-color** · sin color
deriva · **elección del usuario respetada** · filas alternas distinguibles. Regresión D-T1: **12/12**.

Pendiente de D-T2: selección en 2 niveles (`Selection` vs `StandbySelection`), estado derivado ≠ afirmado,
glifo además de color para muted/locked/offline, contenido de cabecera por altura (tiers), polaridad invertida
del editor de curvas, no acoplar selección y cabezal.

## ROUND 102 · D-T4 — Info View (la barra contextual que faltaba). Verificado 8/8, build + deploy

**Qué es.** Ableton y Blender tienen un sumidero de ayuda FIJO abajo a la izquierda (Live: *"Insert Mark 1.1.1
(Time: 0:00)"* · Blender: *"Set 3D Cursor · Rotate View · Select"*, que dice qué hace cada botón del ratón AHORA).
Lo vi en las capturas a pantalla completa de Beltrán, no en la investigación web.

**Por qué importa** (y por qué no es "un tooltip peor colocado"):
1. **No tapa nada.** Decisivo sobre una timeline, donde el puntero siempre está encima de datos que necesitas ver
   — que es exactamente lo que hace mal un tooltip flotante.
2. **Legitima los controles sin etiqueta**, porque siempre existe una vía de descubrimiento.
3. **Nunca abre una ventana** (y en Electron no tenemos `alert/confirm`: la restricción es el principio).
En R94f quitamos las instrucciones del viewport y **dejamos el hueco vacío**. Esto es lo que faltaba.

**Hecho:**
- `#statInfo` en la barra de estado. Se engancha al sistema de tooltips que ya existía (`title`→`data-tip`), así
  que **los 151 títulos actuales funcionan sin reescribir ninguno**.
- **Instantáneo**, frente al 1s del tooltip flotante (que se mantiene para quien se queda quieto).
- Contrato de tooltip (HIG de Blender) por parseo: `"Nombre — función"` / `"Nombre (V)"` → nombre destacado +
  atajo en su propio slot.
- **`setDis(el,dis,motivo)` ahora marca `data-why`.** Cuando un control está bloqueado, la barra pinta **el
  motivo en ámbar**: es el único momento en que el usuario mira ahí y, por tanto, el único en que de verdad
  quiere aprender → es la superficie donde enseñar el atajo que le falta.

**Gotcha (fallo mío, cazado por el test):** la primera versión deducía "está deshabilitado → su título ES el
motivo". Falso: los controles bloqueados **sin** motivo mostraban su etiqueta normal en ámbar
(*"Previous locator · ,"*), **afirmando una causa que nadie le había dado**. Ahora el motivo es un dato
explícito (`data-why`) y sin él no se pinta ámbar. Aserción añadida: *"bloqueado sin motivo NO finge una causa"*.

**Verificación (8/8):** existe · instantánea · separa nombre/atajo · nombre+descripción · **no solapa el
viewport** · **no solapa la timeline** · bloqueado sin motivo no miente · se limpia al salir. Y comprobado a
mano el caso con motivo: el botón I/O del export muestra *"Set In (I) and Out (O) marks on the timeline first"*
en ámbar — con el atajo dentro del texto.

**Deuda anotada:** solo **1 sitio** llama a `setDis` con motivo. El mecanismo está; falta el contenido. Auditar
los controles que se deshabilitan y darles un motivo es trabajo de redacción, no de código.
Pendiente de D-T4: verbos-no-sustantivos (#31) y Operate→Adjust para proxies/export (#33).

## ROUND 102 · D-T1 — El sistema de diseño, con evidencia. Verificado 12/12, build + deploy

Docs: `AUDITORIA-DISENO-UI.md` (medición de lo nuestro) · `INVESTIGACION-DISENO-UI.md` (30 reglas con fuente) ·
`PROPUESTA-DISENO-UI.md` (35 cambios). Se midieron **Ableton 12, Premiere 2025, Blender 4.0 y Unreal 5.8 en la
máquina de Beltrán**, a resolución nativa — ninguna fuente publica esos píxeles.

**Dos de mis cinco diagnósticos eran FALSOS y la investigación los tumbó** (detalle en `INVESTIGACION` §0):
- *"La escalera de fondos es imperceptible (1.03–1.11)"* → **regla equivocada.** Adobe envía 1.08–1.19; Google
  M2, 1.03–1.12. Estábamos **dentro de especificación**. APCA da **Lc 0.0 a TODOS** los pares contiguos de
  Spectrum y Material: ninguna métrica de contraste sirve para superficies grandes en el extremo oscuro (WCAG
  lleva una constante de velo `+0.05`). La regla correcta es **CIE L\***.
- *"Todo a 9/10/11px = sin jerarquía"* → **parcialmente falso.** Blender envía TODA su UI a **11pt/400**; un
  tamaño, un peso. Atlassian separa cuerpo y encabezado **solo por peso** (12px/400 vs 12px/653). Una escala
  uniforme no es el defecto: el defecto es **9px** (nadie lo envía) y no usar el canal de peso.

**Lo que NO se hizo, y por qué** (esto es la mitad del valor):
- **No aclarar el fondo a `#121212`** (regla de Material). Medido: Premiere —el análogo correcto, es vídeo— está
  en L\*=10.8 y nosotros en 8.2. Ableton (22.6) y Blender (26.7) son más claros porque **no juzgan imagen**.
- **No bajar el contraste del texto**: 16.1:1 nuestro vs 16.9:1 de Premiere.
- **No agrandar controles a 44px**: es WCAG **AAA** y guía **táctil**. La norma AA (SC 2.5.8) es 24×24 **con
  excepción de espaciado**: un control de 20px cumple si su centro está a ≥24px del siguiente. Blender usa 20px.

**Hecho:**
- **6 superficies → 3**, neutras (las cuatro referencias envían grises neutros; nuestro tinte azul sesgaba el
  juicio de color, que es para lo que existe la herramienta). `s0 #111111` (L* 5.1) · `s1 #1B1B1B` (9.8) ·
  `s2 #262626` (15.2). Pasos de **4.7 y 5.4 L\*** (objetivo Spectrum/M3: 4–5).
  **Resultado medido: la superficie dominante pasa del 26% (la más baja de las cinco apps) al 63%.** Toda
  referencia tiene UNA dominante (40–55%); nosotros teníamos seis peleándose.
- **Estados fuera del tope de 3** (no son niveles): `--state-on #4A4A4A`, `--state-hover #303030`.
- **Affordance por DIRECCIÓN del contraste** (Blender): botón = s2, más claro que el panel; campo editable = s0,
  más oscuro. Verificado por aserción.
- **Tintas con la regla correcta:** `--ink #E0E0E0` (Lc −85..−87) · `--ink-2 #B8B8B8` (−61..−64) · `--ink-3
  #8C8C8C` (−38, **NO es texto de cuerpo**: solo marcas de regla y sufijos) · `--ink-dim #6D6D6D`.
  `--ink-faint` (#8A9199, 26 usos) **pasaba WCAG AA con APCA Lc −38** — "aviso de copyright". Levantado a ink-2.
- **Escala tipográfica cerrada: 11/13/20.** 9px erradicado (Geist a 9px da x-height **4.77px**, bajo el suelo de
  renderizado). Muertos los 11.5px y 12.5px inline — eran la prueba de que no había escala.
- **Tokens de verdad:** **~280 hex cableados → tokens**. `app.js` pasa de **78 hex distintos y 4 usos de var()**
  a leer los tokens del CSS (`const UI`), así que el canvas —que no puede usar `var()`— **no crea una segunda
  paleta**. index.html: solo quedan las definiciones de token y 2 rojos semánticos.
- **Paleta CERRADA de espaciado** definida (`--sp-*` = intersección exacta de Spectrum + Primer + Atlassian).
- `.searchbox` 18px → **20px**: a 11px el texto pedía 15px de interlineado y se recortaba. Es además la altura
  de control de Blender.

**Gotcha (fallo mío, cazado de casualidad):** colapsar `--surface-3` sobre `s2` dejó el **hover idéntico al
botón en reposo** — invisible. Las comprobaciones de tokens, tamaños y desbordes **pasaban todas**. Igual,
`--bg-2` (fichas de medios, regla) mapeado a `s0` aplanaba el nivel de panel. Lección: **los alias hay que
mapearlos por lo que cada uno HACE, no por su nombre**, y hace falta la aserción *"ningún estado puede verse
igual que su reposo"* — ahora está en `scratchpad/test-system.js` y es lo que lo habría cazado.

**Verificación (12/12 en vivo):** tokens resuelven · pasos 4–5 L\* · **3 aserciones de estado≠reposo** ·
dirección del contraste · existe regla :hover · ningún tamaño fuera de {11,13,16,20} · nada bajo 11px · ningún
texto recortado.

Pendiente: D-T4 (barra contextual — Ableton y Blender la tienen y nosotros dejamos el hueco vacío en R94f;
verbos no sustantivos; contrato de tooltip), D-T2 (timeline: tipo por tono a luminosidad constante, selección
en 2 niveles, filas al 2%, polaridad del editor de curvas), D-T3 (un solo acento saturado = "arrastrable").

## ROUND 101 — Separación vídeo↔audio en la línea de tiempo: alineación y divisor. Verificado 12/12 en el .exe

Dos fallos reportados ("el rectángulo de audio está roto, se enreda al agrandarlo/achicarlo; se ve por detrás
cómo pasan los nombres de las pistas de vídeo"). Resultaron ser dos causas distintas:

**1. Los nombres no cuadraban con sus pistas (la MISMA raíz del "se ve por detrás").**
`#tlscroll` cede 9px a su barra de scroll horizontal; la columna de cabeceras (`.trackhdr`) no tiene barra, así
que su altura visible era 9px MAYOR → su recorrido máximo (contenido − visible) era 9px MENOR. El sync
`th.scrollTop = sc.scrollTop` topaba: en los últimos 9px de scroll las pistas seguían y las cabeceras no, así que
cada nombre se desalineaba de su fila y asomaba por debajo del módulo de audio fijado.
→ Se le da a la columna de cabeceras el mismo margen inferior (`marginBottom = hsb`): misma altura visible, mismo
recorrido, mismo anclaje. El módulo ya fija en `bottom:0` en ambas columnas y **se elimina el hack** que lo
levantaba 9px a posteriori (compensaba el síntoma, no la causa).

**2. El divisor "se enredaba" — zona muerta por sobredesplazamiento.**
`state.tl.audioH = clamp(h0 + (y0 − y))` acumulaba el exceso: si te pasabas 200px del techo, había que desandar
esos 200px antes de que el módulo se moviera. Medido: subir 320px → techo 197; bajar 200px → **sin respuesta**.
→ Se mide el delta respecto a la posición ANTERIOR y se re-ancla en cada movimiento: el exceso no puede acumularse.
Ahora responde en el primer píxel (197 → 157).
→ Además `audioModuleMax()` es ahora la ÚNICA fuente del techo, compartida por el arrastre y el render. Antes cada
uno tenía su fórmula (`max(80,vh*0.55)` vs `vh*0.55`): si divergen, vuelve a aparecer una zona muerta.

**Verificación (12/12 en el .exe empaquetado):** misma altura visible y mismo recorrido en ambas columnas · drift
0px en TODO el recorrido (no sólo al final) · módulo alineado entre columnas (Δ0.0 arriba y abajo) · la última
fila de vídeo queda a ras del módulo, nunca sepultada · independencia de la rueda (audio no mueve vídeo y
viceversa) · rueda sobre cabeceras de audio arrastra el módulo · ambas columnas del módulo siempre a la misma
altura · el divisor responde al primer píxel y baja hasta el suelo (49).
Opacidad comprobada por hit-test (`elementFromPoint` dentro del módulo → siempre `audio-module`, nunca una
cabecera de vídeo): no había transparencia, el síntoma era puramente el desfase.

**Gotcha de testing:** los dos tests manipulan la UI viva; encadenarlos sin reiniciar estado (audioH, scrollTop
del módulo) cambió los números y fingió un fallo de zona muerta en el .exe que en aislamiento no existía. Los
tests de UI deben reiniciar su propio estado.

## ROUND 100 — "Ecosistema directo": EXPORT HAP / HAP Q (.mov) sin FFmpeg. Verificado contra ffmpeg, build + deploy

**Qué es y por qué.** Hap (Vidvox) es el códec de intercambio del mundo del directo: Resolume, disguise, Watchout,
TouchDesigner, Millumin. Guarda texturas DXT a tasa fija que la GPU sube **sin decodificar en CPU** — por eso una
máquina reproduce varias capas 4K donde con H.264 se ahoga con una. Sin esto, entregar a un show obligaba a pasar
por AfterCodecs/ffmpeg fuera de la app. Ahora sale del editor.

**Cómo, sin FFmpeg.** Las tres etapas son nuestras: el fotograma ya está en la GPU → se comprime ahí (shader
WebGL2 que rinde a un FBO `RGBA32UI` donde **cada téxel ES un bloque** DXT, así `readPixels` ya devuelve el flujo
en el orden que DXT quiere); Snappy son ~60 líneas; y el contenedor QuickTime se escribe a mano.

- **Variantes:** `hap` → Hap1 (RGB · DXT1 · 0,5 B/px) y `hapq` → HapY (Scaled YCoCg · DXT5 · 1 B/px, más calidad).
- **Chunks (elegibles, Auto por defecto):** 1 → sección Snappy simple (0xBB/0xBF); N → sección troceada
  (0xCB/0xCF) + Decode Instructions Container (0x01) con tabla de compresores (0x02) y de tamaños (0x03).
  Sirven para que el REPRODUCTOR descomprima en N hilos. Auto = núcleos, potencia de dos, tope 8.
- **UI:** fila de Chunks sólo en HAP; bitrate oculto; la estimación es honesta y avisa del caudal
  (4096²/60 Hap1 ≈ **428 MB/s** — en ámbar, porque exige un SSD que lo alimente).
- **Contenedor:** `co64` + `mdat` de 64 bits SIEMPRE (a 4K son GB por minuto; con 32 bits los offsets se
  desbordarían en silencio). Audio PCM 16-bit `sowt` intercalado fotograma a fotograma. Escritura en streaming.

**Gotcha grande — endpoints DXT por EJE PRINCIPAL, no por caja delimitadora.** La primera versión elegía los
extremos con el min/max por canal. Un bloque de rojo `[255,0,0]` y cian `[0,255,255]` tiene una caja que va de
negro a blanco → la paleta entera sale **gris**. Medido: **27,43 dB frente a los 42,60 de ffmpeg**. Con covarianza
+ iteración de potencia (lo que hace stb_dxt): **41,65 dB**. No volver a la caja.

**Verificación (ffmpeg 8.1 como juez independiente — NO es dependencia de la app, sólo del test):**
- Snappy: 14/14 round-trips contra un descompresor escrito aparte desde la especificación (incluye incompresible
  → 100%, límites de fragmento de 64KB, copias largas).
- 7 ficheros × ffprobe/decode: fourcc, tamaño, fps, nº de fotogramas, **orientación** (3 marcas de esquina exactas),
  **orden de fotogramas**, PSNR, y **audio bit a bit exacto**.
- **Calidad contra el propio codificador hap de ffmpeg:** Hap1 41,65 vs 42,60 dB (−0,95); HapY 44,99 vs 44,78 (+0,21).
- **Chunks de verdad:** se parsea la sección del fichero y se cuentan (1→Snappy simple, 4→4 entradas, 8→8; los
  tamaños cuadran con los bytes que siguen). ffmpeg decodifica igual con 1 que con 8 → sin esto, un ajuste
  ignorado en silencio habría pasado los tests.
- **Export REAL** (no una réplica): `runExport` completo, diálogo nativo incluido → 24 fotogramas HapY 512²,
  4 chunks confirmados dentro del fichero, y **52,37 dB entre lo que pintó el motor y lo que salió del .mov**.

**Notas.** Dimensiones no múltiplo de 4 → se rellena (funciona; el borde añadido mide 44 dB). ffmpeg **rechaza**
codificar esos tamaños, así que ahí no hay baremo externo. HAP Alpha (Hap5) NO se expone: el shader DXT5 ya está,
pero `renderExportFrame` compone opaco, así que saldría un alfa inútil — pendiente si se quiere para capas.

## ROUND 97 — "NLE de verdad": J/K/L + TRIM CONTEXTUAL + trim numérico + ↑/↓ entre cortes. Verificado CDP 14/14 + 16/16, build + deploy
Del informe: *"J/K/L + trim es lo que separa 'herramienta de juguete' de 'NLE' a ojos de un profesional"*. (Stems descartados por el user: los hace en Dolby.)
- [x] **J / K / L** — el estándar universal que NO teníamos (y la `L` estaba ocupada por el marcador, justo la tecla de "play adelante"): J atrás · K para · L adelante, **repetir dobla** (1×→2×→4×→8×, con tope), invertir dirección vuelve a 1×, **K mantenida + J/L = ¼× cámara lenta** (keyup + blur para que la K nunca quede pegada). **Marcador movido a `M`** (la tecla estándar), actualizado en la paleta.
  - Diseño: a **1× se delega en el transporte real** (esclavo del reloj de audio, con sonido); a cualquier otra velocidad corre un **rAF propio que hace scrub** — WebAudio no puede reproducir a 4× ni en reversa, y `ploop` esclaviza el playhead a `actx.currentTime`, lo que hace imposible la velocidad variable. Shuttle silencioso por encima de 1×, como las platinas clásicas. **Tope de 30 fps de seek**: a 8× una tormenta de seeks a 60 fps ahoga el decoder.
- [x] **TRIM CONTEXTUAL (`T`)** — el modelo de Resolve: **una tecla y el CURSOR decide**, sin cambiar de herramienta (el informe lo señala como la mejor relación coste/beneficio disponible). Zonas: borde que toca a un vecino = **ROLL** · borde libre = **RIPPLE** (y desplaza todo lo posterior) · banda de título = **SLIDE** · cuerpo = **SLIP**. Respeta los límites de material igual que el trim normal (nunca se puede tirar de material que no existe). Botón nuevo en la barra + icono.
- [x] **Trim numérico por teclado**: con `T` armado, ←/→ trimam el borde más cercano al cabezal (1 frame · **Shift = 10**) — precisión sin cazar píxeles ni depender del zoom.
- [x] **↑ / ↓ = corte anterior / siguiente** (`jumpCut`: todos los puntos de edición de la timeline).
- Verificado CDP: shuttle 1×/2×/4×/8× con tope, inversión, K+L=0.25, `M` pone marcador y `L` ya no, ↑/↓ 0→2→6→8; y los **invariantes matemáticos de cada trim**: roll conserva la duración total y `inP` sigue al corte · rippleR/L desplazan lo posterior y el start no se mueve en rippleL · slip conserva posición y duración y solo mueve el material · slide mueve el clip, el vecino absorbe y el material queda intacto · clamps de material en slip y roll · las 4 zonas resuelven a la operación correcta.

## ROUND 96 — INVESTIGACIÓN 2 (user: "¿qué otras herramientas tenemos mal enfocadas?") + 2 BUGS DE PRODUCTO corregidos. Verificado + build + deploy
**Informe completo en `INVESTIGACION-HERRAMIENTAS.md`** (3 frentes con fuentes primarias, contrastados contra el código real; propuesta de rondas R97–R100).
- [x] 🔴 **B1 · La secuencia PNG no cumplía el estándar de entrega fulldome**: exportábamos `dome_000.png` (base 0, relleno variable con la duración); **IMERSA/AFDI exige `Nombre_000001.png` — 6 dígitos, base 1**. Un planetario NO podía ingerir la entrega sin renombrar frame a frame y dos exports de distinta duración ordenaban distinto. `pad=Math.max(6,…)` + `fnum(i)=i+1`. Verificado a 1 / 300 / 135.000 / 2M frames.
- [x] 🔴 **B2 · El `.isp` podía corromperse**: `dsp:writeText` escribía directo sobre el archivo → un crash, un corte de luz o Drive/Dropbox sincronizando a mitad dejaban el proyecto truncado (el fallo documentado que mata proyectos de Premiere; los proyectos de Beltrán viven en el Escritorio respaldado en Drive). Ahora **escritura atómica**: temp en la misma carpeta → `fh.sync()` → `rename` (atómico en el volumen) → lectores ven el viejo o el nuevo, nunca medio archivo; limpia el `.tmp` y conserva la escritura directa como último recurso. Probado fuera de Electron (1ª escritura, sobrescritura de 50 kB, sin residuos).
- **Hallazgo estratégico**: **no existe un NLE fulldome dedicado** — la lista *Dome Production Tools* de IMERSA no tiene ni un editor de timeline; los artistas montan en After Effects. La investigación **valida la arquitectura**: el warp/blend NO es del editor (pre-deformar congela la geometría de un domo concreto: anti-patrón), y la tira de muros ES el UV unwrap estándar de disguise (`stripW=Σ pxW` = su regla de densidad de píxeles). Los proxies manuales tampoco son un error (FCP 12.3 apagó el background rendering por defecto): lo que falta es **visibilidad de estado**.
- **Huecos priorizados**: (R97) **J/K/L** — no los tenemos y la `L` está ocupada por marcador, justo la tecla universal de "play adelante" — + **trim contextual `T`** (el cursor decide ripple/roll/slip/slide) + trim numérico; (R98) **stems discretos `_L/_R/_C/_LFE/_Ls/_Rs`** (hoy un solo audio.wav → bloquea entrega como B1) + **área segura fulldome** ±90°/10-60° + sweet spot + burn-in + presets multi-venue; (R99) badges/barras de proxy-caché (modelo predictivo verde/amarillo/rojo de Premiere) + fallback per-clip + borrar generados in-app; (R100) **HAP** (lingua franca de media servers, viable sin FFmpeg: DXT+Snappy), Spout, LTC. Idea propia: **snap al beat** (nuestro "Descript musical": ya tenemos detección de beats) — no lo hace bien ningún NLE mainstream.
- ⚠️ Riesgo anotado: "la independencia de resolución es mentira" — la tira de sala se compone por PÍXELES → probar proxies+sala explícitamente.

## ROUND 95-D2 — 🔷 VANGUARDIA: Automation Items (curva reutilizable y POOLED). Verificado CDP 11/11, build + deploy
La función más citada de Reaper y que **ningún editor de vídeo tiene**. En el menú contextual de cualquier curva.
- [x] **Guardar curva como Automation Item** (con nombre) → biblioteca `state.autoItems`, persistida en el `.isp` y en el undo (editar una instancia reescribe el item: es estado deshacible).
- [x] **Insertar** el item en cualquier (clip, parámetro) en el punto del clic.
- [x] **POOLED de verdad**: editas una instancia y **todas las demás cambian**. Decisión de arquitectura: pooling **por propagación**, no por indirección — el editor sigue escribiendo en `c.kf[p]` (sus 30+ puntos de escritura y `evalP` NO se tocan) y `commit()` empuja el cambio al item y a los hermanos (`poolPropagate`). Misma promesa al usuario, una fracción del riesgo.
- [x] **Repetir sobre el clip (loop)** y **Repetir acumulando (relative)** — el `Set Relative` de Fusion / `Loop+Offset` de Cavalry: paneos y rotaciones infinitas gratis (verificado: rampa 0→90 repetida acumula por encima de 180). Guarda de 512 pasadas para que un item diminuto en un clip largo no explote.
- [x] **Desvincular (hacer único)** corta el pooling; **duplicar un clip conserva la instancia** (es justo el sentido del pooling); borrar la curva desvincula.

## ROUND 95-D1/D4 — 🔷 VANGUARDIA: perform-and-bake + freeze por modulador. Verificado CDP, build + deploy
- [x] **D1 · PERFORM-AND-BAKE** (`#autoRecBtn` en el transporte, punto rojo que late — el único rojo del chrome): armas REC, das a play y **interpretas el parámetro con el ratón mientras suena la música**; el gesto se escribe como keyframes y **se hornea con RDP al parar** → curva editable, no una clave por frame. Es "Inventing on Principle" aplicado al VJ: tocar el movimiento en vez de teclearlo.
  - **Punto de captura único**: `manualEdit()` — por ahí pasan YA todas las ediciones manuales (fader del inspector, número, rueda, arrastre en el visor), así que la captura es completa sin tocar 6 sitios.
  - **Modelo TOUCH sin exponer modos** (la decisión más elegante de toda la investigación, de Live): el ratón implica touch, así que al soltar deja de escribir solo — `manualEdit` simplemente deja de dispararse. Cero UI de modos.
  - Semántica touch real: la toma **borra lo preexistente en el tramo que recorre** pero respeta lo que hay fuera. Verificado: toma 1 (seno) → `0:50 0.57:81 1.00:90 1.43:81 2.00:50` (61 puntos → **7**, error máx 1.7/100); regrabar plano sobre 0–1 s → `0:20 1.00:20 1.20:88 1.43:81 2.00:50` (tramo reescrito, **cola intacta**).
  - Grabar CANCELA el override (`_autoOff`): estás escribiendo la curva, no puenteándola. Un solo `pushUndo` por toma.
- [x] **D4 · FREEZE por capa de modulación** (`m.frz`, botón ❄ cian): congela la salida de esa capa en su valor actual — seguridad en directo ("ahora NO quiero que siga a la música"). Raro en NLEs. La línea de auditoría lo dice (`❄audio`), porque si no "¿por qué no reacciona?" no tendría respuesta visible.
- Bug cazado: un `//` dentro de `pause()` (función de una línea) se tragó el resto del cuerpo → `node --check` lo pilló. **Mismo error que ya ocurrió en R92: en este archivo, comentar dentro de funciones de una línea exige `/* */`.**

## ROUND 95-C2 — 🔷 DIFERENCIADOR: elegir la banda DIBUJÁNDOLA sobre el espectro real. Verificado CDP (3 tonos exactos + kick sintético), build + deploy
**Notch deja VER el espectro mientras eliges la banda; VDMX deja ASIGNAR arrastrando. Nadie une las dos cosas — esto sí.**
- [x] **Espectro real propio** (`computeSpectrum`): el análisis existente son 3 filtros biquad (bass/mid/treble) y **jamás puede responder "dame 220–480 Hz"**. Nueva pasada ÚNICA con **FFT radix-2 propia** (`_fftRadix2`, ~15 líneas) → **32 bandas logarítmicas** (40 Hz–12 kHz) por frame. Decimación previa a 16 kHz con anti-alias de caja → resolución fija de 15,6 Hz **sea cual sea el sample rate de origen** y coste independiente de él (~13 ms/3 s de audio ⇒ ~20 s para una película de 75 min, en segundo plano con `await` cada 1024 frames). ~17 MB para 75 min. **No toca `m.bands`** → los FX reactivos no pueden romperse.
- [x] **Picker dibujable** (`drawSpecPicker`/`bindSpecPicker`) dentro de la capa de audio del panel: espectro **vivo** en el cabezal (se repinta con él), **arrastrar cruzando = fijar f0..f1**, **arrastrar dentro de la ventana = deslizarla** (proporcional en log → conserva su ancho musical), **clic = volver a banda con nombre**, doble clic = reset. La ventana elegida se pinta en cian y el resto en gris. Retícula 100/1k/10k.
- [x] `specRangeRaw(f0,f1)` construye el envelope de una ventana arbitraria bajo demanda (con gain/gate del motor reactivo) y lo cachea en el medio; `modAudioEnv` lo usa cuando hay rango propio y conserva la ruta de bandas con nombre. La línea de auditoría nombra la fuente REAL: `audio(55-110Hz)`.
- **3 bugs de fondo cazados y corregidos** (todos habrían pasado inadvertidos sin verificación numérica): (1) 🔴 **el modulador de audio de C1 nunca funcionaba** — pedía la banda `'low'`, que no existe (son bass/mid/treble/bright) → señal 0 siempre; (2) las bandas del espectro **compartían el bin del borde** → un tono aparecía en dos bandas con el mismo pico y ganaba la más grave: todo leía una banda por debajo (`k1 = round(edge)−1`); (3) 🔴 **la normalización ×3.2 "de headroom" saturaba** las bandas vecinas a 1.0 y el empate lo ganaba la más grave → el dato ahora es lineal y honesto, y el realce (^0.55) vive solo en el pintor. Verificado con tonos a 44,1 kHz: 100 Hz→banda 98-117 ✓, 1 kHz→990-1183 ✓, 6 kHz→5882-7030 ✓, y con un bombo sintético a 70 Hz la ventana 55-110 da 31% en el golpe y 3% entre golpes.

## ROUND 95-C1/C3 — 🔷 DIFERENCIADORES: pila de modulación unificada + moduladores espaciales de domo. Verificado CDP 18/18, build + deploy
**Esto es lo que no tiene ningún editor de vídeo del mercado.** Diseño = síntesis de Bitwig (la modulación vive EN el control) + Cavalry Behaviour Mixer (blend explícito por capa) + Houdini Layer CHOP (base absoluta), en `INVESTIGACION-AUTOMATIZACION.md` §4 C1/C3.
- [x] **Modelo**: `c.mod={'<param>':[{id,src,blend,depth,on,…}]}` — serializado con el clip, deep-copiado con ids nuevos en `sepAuto` (split/duplicate/nest nunca comparten capas por referencia).
- [x] **Punto de inserción limpio**: `evalP` sigue siendo la BASE pura (keyframes) → el editor de curvas dibuja y edita eso, la pila jamás pelea con él. `evalR` (lo que ve el RENDER) = keyframes → modificadores de movimiento → **`evalModStack`**. Un solo punto, sin tocar los 33 usos de evalP.
- [x] **3 fuentes** (`modSignal`, todo derivado de `t` → determinista en export): **LFO** (sine/tri/saw/sq/random, Hz o sync a BPM con divisor, fase) · **Audio** (banda low/mid/high con envelope attack/release propio + curva de respuesta + invertir; caché `_modAudioCache` espejo del de FX) · **🔶 Dome space (C3)** = el valor depende de la POSICIÓN del clip en el domo (elevación, azimut, distancia al cenit) con rango from/to — los *Falloffs* de Cavalry en coordenadas fisheye. **Ningún NLE lo tiene porque ninguno es fulldome.**
- [x] **6 blends explícitos**: + Add · − Subtract · × Multiply · ∧ Min · ∨ Max · = Override, con profundidad en unidades del parámetro (add/sub) o % (resto), y clamp final al rango. Capas reordenables (↑) y puenteables (●/○).
- [x] **🔷 LA LÍNEA DE AUDITORÍA** (`modFormula`, cian, siempre visible al pie del panel, refrescada con el cabezal): `24% = base 40% + audio(low)(0% ×55%) × LFO 0.35Hz sine(100% 60%) × dome(dist)(50% 80%)`. Cumple la regla de oro destilada de toda la investigación: *el usuario debe poder responder "¿por qué vale eso ahora mismo?" sin abrir nada*.
- [x] **El estado vive en el control** (Bitwig): botón `.modb` cian cuando el parámetro está modulado, número en cian mostrando el valor RESUELTO, y `.modarc` = franja cian dibujada SOBRE la pista base marcando el tramo base↔modulado (base y modulación nunca se funden).
- [x] `anyAnim()` ahora incluye `hasLiveMod()` → un LFO libre anima el preview igual que un modificador de movimiento (audio/espacio siguen al cabezal).
- Verificado CDP: sin modulación evalR==evalP · LFO determinista y periódico (t0=50, medio ciclo=90 exacto) · clamp · gate multiplicativo (50/0) · espacial el=45→25 y cénit→50 · fórmula correcta · UI (botón, panel, 3 capas, +LFO/+Audio/+Dome, cierre) · deep-copy. Bug cazado: `refreshModFormula` usaba `getElementById` con el panel aún fuera del DOM → la línea salía vacía en el primer render.

## ROUND 95-AT2/AT3 — Fricciones + operaciones de RANGO (niveles A y B de INVESTIGACION-AUTOMATIZACION.md). Verificado CDP 8/8 + 10/10 + 6/6, build + deploy
- [x] **A1 · Resalte previo de la zona activa** (`cv._hoverSeg` + trazo grueso α0.28 sobre el segmento bajo el cursor, Bitwig 6): ataca la fricción nº1 documentada de TODOS los editores ("un pixel de error y agarras otra cosa" — foro BMD). Tooltips por zona: punto vs segmento.
- [x] **A2 · Alt+arrastrar un punto curva los DOS segmentos vecinos** (Bitwig — ease in/out simétrico de un gesto); Alt+clic sin arrastrar sigue borrando (clic vs drag, sin ambigüedad de modo).
- [x] **A3 · Value / Offset / Scale sobre la multiselección** (Fusion): asignar (muestra el promedio) · sumar · multiplicar, con clamp al rango del parámetro.
- [x] **A4 · LIBRERÍA DE EASING normalizada 0–1** (`EASE_PRESETS`, 12: Ease In/Out/InOut, Smooth, Slow Start/End, Expo, **Back Out (overshoot)**, **Back In (anticipate)**, Anticipate+Overshoot, Linear) — el hueco que en AE llenan Flow / Ease and Wizz (su popularidad ES la prueba del hueco). Se aplica al segmento bajo el cursor o a cada par consecutivo de la selección, escalando el bezier al span real → una curva sirve para cualquier duración/rango. + **Copiar/Pegar easing** (`state.easeClip`).
- [x] **A5 · Reducción RDP automática al soltar el trazo** freehand con Alt (Bitwig/Reaper): el trazo queda editable en vez de dejar una clave por frame.
- [x] **B1 · SHAPE BOX** (`Shift+B`, Fusion — la operación de rango más completa del sector): caja con 8 tiradores sobre la selección; esquinas escalan, bordes estiran un eje, **Ctrl+esquina = SESGA (shear en tiempo proporcional al valor)**, dentro mueve, **Alt = espejo respecto al tirador opuesto** (Live 12), Esc cierra. `state.shapeBox.base` congela las coordenadas originales → cada arrastre es absoluto (sin deriva). Gotcha resuelto: `B`=cuchilla se evaluaba antes e ignoraba modificadores → el handler de Shift+B va delante.
- [x] **B2 · Taper** (AE Ctrl+Alt+esquina): escala la AMPLITUD respecto al valor medio conservando la forma y **sin mover los tiempos**.
- [x] **B3 · Curve ghosting** (Cavalry): durante cualquier gesto (punto, segmento, Alt-curva, draw, Shape Box) la curva previa queda detrás en gris discontinuo; se limpia al soltar. Snapshot → coste cero en reposo.
- Robustez: `state.shapeBox` guarda refs vivas a keyframes → se suelta en `restore()` (undo/redo) y en `loadSeqIntoState()`, donde esos objetos se reemplazan. Verificado: sin regresiones (clic en línea añade, clic en punto borra, B a secas sigue siendo cuchilla).

## ROUND 95-AT1 — Estética de la automatización aplicada (análisis VIENDO capturas reales). Verificado CDP + build + deploy
Análisis estético en `INVESTIGACION-AUTOMATIZACION.md` §4-bis (capturas descargadas de los manuales en `scratchpad/ref/`: Ableton arranger envelopes, Bitwig modulation range/multi, Blender graph editor + captura equivalente nuestra). Reglas E1–E8 y su origen documentados ahí.
- [x] **E1 · Color = identidad del parámetro en las 3 superficies**: `PCOLOR` ya no tiene grises (opacity #E8EAED→**#7FB2E8**, crop y contrast rehuidos) — la curva primaria salía BLANCA y rompía el mapeo; + **barra lateral de 3px** con el hue del parámetro en `.autoctl` y `.autohdr` vía `--pc` (el vínculo header↔curva de Blender, sin robar ancho).
- [x] **E2 · Saturación = foco** (Ableton): `isAutoFocus(cv)` — lane bajo el cursor gana; si no, la del clip seleccionado. Curva con foco 1.8px/α1, resto mismo hue a **α0.45**/1.4px. Solo afecta alpha/grosor, nunca geometría. Los puntos siguen a su lane pero hover/selección siempre en blanco pleno (E5).
- [x] **E3 · El material se aparta**: en `body.automode`, `.clip .fill` a 0.35, `.cthumb` 0.3, `.scrim` 0.5 → la envolvente es la protagonista.
- [x] **E4 · (el hallazgo clave, era NUESTRO peor problema) Headers legibles**: los 2 dropdowns **se apilan en vertical** (como Ableton, que no los pone en fila) → cada uno usa el ancho completo del header; se acabó el "Tra∨ ◆S∨" ilegible. Además, **choosers en vivo solo en la pista con foco**; el resto muestra device/parámetro como **texto de 2 líneas** (`autoDuoText`) que al pulsarlo se convierte en los dropdowns reales.
- [x] **E6 · Tokens de estado**: `--auto-live:#4FC3E8` (cian, gobernado/modulado en vivo) y `--auto-ovr:#E5B567` (ámbar, override) — complementarios, imposibles de confundir. Preparados para C1/C2.
- Verificado CDP: hue de opacity, barras --pc (azul primaria / rojo sub-lane), apilado en columna, texto sin foco ("Opacity"), texto→dropdown al clic (y el cambio de parámetro sigue funcionando), clip a 0.35, `isAutoFocus` operativo. Captura comparativa antes/después.

## ROUND 95 — INVESTIGACIÓN del sistema de automatización (user: "es crítico, debe ser excelente para diferenciarse"). SIN cambios de código
3 agentes con fuentes primarias (manuales) + foros: (A) DAWs — Live 12/Bitwig/Reaper/Logic/Cubase/FL; (B) VFX/motion — AE/Blender/Nuke/Fusion/Maya/Cavalry/Rive; (C) inmersivo/live — TouchDesigner/Notch/Resolume/VDMX/Millumin/Smode/Unreal/C4D Fields/Houdini + UX (Bret Victor, Draco, Sketch-n-Sketch, Apparatus). **Informe completo en `INVESTIGACION-AUTOMATIZACION.md`** (fuente de verdad; propuesta en 4 niveles A/B/C/D). Titulares: el consenso de gestos es *tensión por segmento* (Alt+arrastrar, Alt+doble clic ⇒ ya lo tenemos); nos falta TODO lo de operaciones sobre RANGO (Shape Box de Fusion, taper, campo tri-modo Value/Offset/Scale) y la librería de easing normalizado (el hueco que llenan Flow/Ease and Wizz en AE); los 3 diferenciadores propuestos = **pila de modulación unificada legible** (Bitwig+Cavalry Mixer+Houdini Layer, con fórmula en texto y anillo en el control), **asignación audio-reactiva dibujando la caja sobre el espectro en vivo y arrastrándola al parámetro** (Notch+VDMX; nadie une las dos) y **moduladores espaciales de domo por az/el** (Falloffs de Cavalry en fisheye; ningún NLE lo tiene porque ninguno es fulldome). Errores documentados a evitar: auto-seleccionar value/speed graph (AE), un gesto con dos significados según modo, hit-targets frágiles (queja nº1 de Fusion/BMD), modo global vs por pista (queja nº1 de Bitwig 6).

## ROUND 94f — Playhead −15% sin línea sobre la regla · contorno 3D sin dientes · sin instrucciones · Simple por defecto. Verificado CDP + build + deploy
- [x] **Playhead**: coronilla 13×12 → **11×10 (−15%)**, `top:12px` (la punta acaba justo donde termina la regla) y **`.playhead` arranca en `top:22px`** con altura = solo las pistas → la línea vertical ya NO atraviesa la regla ni la figura; la coronilla es su remate. El `#snapline` conserva regla+pistas.
- [x] **Contorno del domo 3D (spring line) sin dientes**: el diagnóstico era que la banda ámbar estaba **centrada en e=90°, que es el borde exacto de la malla** → su mitad exterior la recortaba el polígono del borde y, con el canvas en `antialias:false` (decisión de R92-T3, no se toca), quedaba media línea aliaseada. Ahora es una banda de ~2px **flotando justo por dentro del borde**, con smoothstep a ambos lados: el borde geométrico dentado queda negro-sobre-negro (invisible) y solo se ve la banda suave. Además la malla pasa de S=96 a **S=256** segmentos (borde más redondo; geometría estática, se construye una vez).
- [x] **Fuera el empty-state del timeline** ("Drag media here…", el U-24 de la auditoría) — sin instrucciones en el lienzo; el drop-zone del panel Media ya lo dice.
- [x] **Simple clips ON por defecto** (`state.tl.simpleClips:true` + `syncSimpleUI()` en `init()`); los proyectos guardados antes de que existiera la bandera abren en Simple.

## ROUND 94e — In/Out en el transporte · viewport solo-seleccionado · Alt=copiar · sin etiqueta en el clip. Verificado CDP + build + deploy
- [x] **Botones Mark In / Mark Out** (`#markIn`/`#markOut`, iconos corchete nuevos) flanqueando el transporte: clic marca (equivalente a las teclas I/O), **clic derecho borra el rango**, y se **encienden** cuando la marca existe (`updIOBtns()` llamado desde `renderWork()` → cubre teclas, loop, arrastre del brace y carga de proyecto). Flashes renombrados a "In/Out".
- [x] **Viewport: solo el clip SELECCIONADO en el timeline es arrastrable** — en domo (nuevo `domeClipHit()`, hermano de `flatRectHit`) y en flat: sin selección no se arrastra nada (panea) y el visor **ya no re-selecciona por hit-test**, así un clip tapado por capas superiores sigue siendo el arrastrable. Verificado 5/5 con dos clips apilados (el de abajo seleccionado se mueve, el de encima intacto).
- [x] **Alt+arrastrar = duplicar** (Premiere) en vez de Ctrl+arrastrar (`drag._copy=!!e.altKey`); Ctrl+arrastrar ahora solo mueve. Sin conflicto con el bypass de snap (ese Alt vive en `startTimeSelect`, no en el drag de clip).
- [x] **Sin etiqueta de parámetro pintada sobre el clip** en modo automatización (`cv._label` fuera de `attachClipAuto`) — los dos choosers del header de pista ya lo nombran.

## ROUND 94d — Barra de extensión de clips + rango de export In/Out vs clips + coronilla del playhead. Verificado CDP + build + deploy
- [x] **Barra de extensión de clips** en la regla (`#clipExtent`, 3px al pie, gris --ink-3): abarca del primer clip al último (`renderClipExtent()` + helper `clipExtent()` reutilizable; en renderTimeline). Coordenadas de contenido → scrollea con la regla, sin hooks extra.
- [x] **Rango de export explícito** (fila "Range" en el modal, `#exRange`): **Clip extent** ⟷ **In / Out**. Con marcas I/O puestas → I/O viene seleccionado; sin marcas → el botón I/O queda deshabilitado (`setDis` + title explicativo) y manda la extensión de clips. Muestra el TC del rango (`#exRangeTc`), el estimado y el aviso de tamaño lo siguen (`exRangeSecs()`), y el modo se congela en cada job (`opt.range`, jobs legacy sin range conservan el comportamiento previo). `runExport` ahora usa `clipExtent()` en vez de `0→duration()` (antes exportaba el hueco inicial si el primer clip no empezaba en 0).
- [x] **Playhead estilo Premiere**: `#phTri` pasa de flecha (borders CSS) a **coronilla de hombros rectos con punta** (13×12px, clip-path) alojada en la regla.
- (La función In/Out con teclas I/O/X y su brace arrastrable ya existía — R94d solo la conecta al export de forma explícita.)

## ROUND 94c — Vista simple de clip + Snap to Grid off + thumbnail fijo. Verificado CDP + build + deploy
- [x] **Thumbnail SIN deslizamiento**: `.cthumb` fijo en `left:0` del clip (quitados `positionThumbs`/`scheduleThumbs` y sus hooks) — siempre en el extremo izquierdo del clip.
- [x] **Botón "Simple" (`#simpleClipBtn`, icono `clip` nuevo) — vista simple estilo Premiere** (`state.tl.simpleClips`, persistido en `tl`, también en Preferencias y en el menú contextual del transporte y la paleta): el clip entero es superficie de agarre/selección (no solo la banda de título) y la **selección de rango deja de funcionar sobre el clip** — solo fuera de él. Apagado = modelo Ableton actual. Cursor `grab` sobre el clip: OJO, `applyToolCursor()` escribe cursor INLINE en cada `.clip` → el CSS no basta; se resuelve ahí (y `syncSimpleUI()` lo llama).
- [x] **Snap → "Snap to Grid" y APAGADO por defecto** (`state.tl.snap:false`, `class="on"` fuera del HTML; persistido en `tl.snap`): renombrado en botón, tooltip, flashStatus, Preferencias, menú contextual y paleta.

## ROUND 94b(2) — Thumbnail de cabeza estilo Premiere. Verificado CDP 7/7 + build + deploy
- [x] El fill del clip ya NO estira el thumbnail (quedaba borroso); en su lugar un **cuadro `.cthumb` 16:9 en la cabeza del clip** (bajo la banda de título) que **se desliza con el scroll** (`positionThumbs()`, clampeado dentro del clip — patrón RAF como las waveforms; hook en el scroll de #tlscroll y al final de renderTimeline) para saber siempre qué clip estás usando aunque avances por un clip largo. **Oculto en modo automatización** (`body.automode .cthumb{display:none}` — el cuerpo del clip es el lienzo de la envolvente) y en pistas colapsadas; no se crea en clips más angostos que el thumb+24px ni en audio.

## ROUND 94b — Refinado de la UI de automatización (feedback directo del user con capturas). Verificado CDP 14/14 + build + deploy
- [x] **Choosers del header**: sin swatch de color; dropdown izquierdo = **Transform · Effects · <cada FX reactivo cargado en la pista>** (grupos: `XFORM_P`=TF+TF_FLAT dedupe; Effects=FX; claves fxt: como antes); derecho = parámetros del grupo/efecto elegido. Aplica al header de pista Y a los sub-carriles.
- [x] **Botones A (override) y ↻ (re-enable) ELIMINADOS de los headers** de automatización (el override sigue operable desde el inspector: manualEdit/reEn/reEnAll intactos). El "+" se conserva.
- [x] **Punto+% del playhead en las curvas ELIMINADO** (no se actualizaba durante el play — bloque de drawAutoCurve quitado).
- [x] **kfstrip vivo**: `updKfStrip(c)` reconstruye los rombos de keyframes del clip en cada `commit()` del editor de curvas (antes quedaban desactualizados hasta el siguiente renderTimeline al mover/añadir/borrar puntos).
- [x] **Instrucciones fuera**: hint del viewport 2D (elemento+CSS+applyLang), `#autoLegend` del transporte (revirtiendo U-05; la gramática vive en tooltips de hover 1s — cv.title en puntos, titles de choosers), y el flash instructivo de toggleCurves. `body.automode` se conserva (banda de agarre U-09).

## ROUND 94-UT2..UT5 — Las 4 tandas restantes de AUDITORIA-UX.md EJECUTADAS (agentes + verificación CDP propia por tanda; build+deploy final único)
- [x] **UT2 Timeline/automatización**: `ensureClipVisible()` (seleccionar clip oculto tras el módulo de audio scrollea a revelarlo, 3 gestos) + clamp 55% del módulo + sombra `.covers`; leyenda persistente `#autoLegend` junto al botón Automation (body.automode, oculta <1500px); tooltip en puntos de curva vía cv.title; choosers con title dinámico + flex 0.8/1.2; botón A estado `.ovr` ámbar (override); banda de título = zona de agarre visible en automode (cursor grab + inset); empty-state del timeline vacío; flash aviso en split por Ctrl+E. Verificado CDP 8/8. (Incidente: un perl del agente corrompió 4 lookups — detectado por node --check y reparado; desde UT3 prohibido sed/perl en los encargos.)
- [x] **UT3 Export/feedback**: cola de export PERSISTENTE (`_exJobs` registro de módulo; el DOM es vista — reabrir el modal reconstruye filas con progreso y cancelar vivos); ✕ cancelar en la barra de estado (#statXBtn, misma rutina que .jx); de paso arreglado: cancelar un job ENCOLADO ya no cancela el activo; `flashStatus(msg,'err')` ámbar 6s aplicado a ~15 call sites de error; Compose/Adjust con `.dis`+title explicativo cuando no hay media visual (updEnable + renderMedia); badge contador de jobs en #exportBtn. Verificado CDP 9/9.
- [x] **UT4 Consolidación**: 7 segmented + .togbtn2 agrupados a un canónico CSS (sin tocar HTML); selects nativos (Export/Prefs/NewSeq/Room/inspector) con look .aselect + chevron; tamaños fraccionales eliminados (50 reemplazos: 7.5/8/8.5→9, 9.5→10, 10.5→11); .ibtn 18→22 y .seqx área 19×21 (hit targets); .dsp-tip multilinea; .iosw.on track claro/knob oscuro; Done→Close; .mono→.tnum (43 refs); "2D Master"→"Dome Master" y "3D Dome"→"3D Preview" (dinámico por seqMode, aplicado también en updModeUI/applyLang/paleta — de paso arreglado que applyLang pisaba '3D Room'). Captura verificada sin regresiones.
- [x] **UT5 Teclado/a11y**: menús contextuales ARIA (role=menu/menuitem, foco al abrir, ↑↓ circular, Home/End, Escape cierra — antes NO cerraba) con stopPropagation al handler global; clips y lanehdr con tabindex=0 + aria-label + Enter/Space seleccionan (delegado en #tracks, condicionado a `:focus-visible` para NO robar Space=play tras un clic); `[tabindex]:focus-visible` con anillo; prefers-reduced-motion como default si no hay preferencia guardada; `setDis()` sincroniza .dis+aria-disabled + `button:disabled` global; `textOn()` reescrita por ratio WCAG real. Verificado CDP 11/11.
- **Estado del informe:** U-31 (retícula 4px) DIFERIDO deliberadamente (requiere revisión visual humana); U-01 indicador "▾ V1" simplificado a sombra+autoscroll; resto de U-T1..U-T5 ejecutado. Detector impeccable: 23 anti-patrones restantes (los estructurales: single-font/tiny-text son decisiones de pro-tool documentadas).

## ROUND 94-UT1 — Fundación + quick wins (11 ítems de AUDITORIA-UX.md). Verificado CDP + detector + build + deploy
- [x] **U-04 tokens CSS**: `:root{}` con 12 variables (--bg-0/1/2, --surface/-2/-3, --ink/-2/-3, --ink-faint #8A9199, --line, --danger); ~120 usos convertidos a var() en la CSS de index.html; casi-duplicados #C7CDD4/#C5CAD0/#C2C7CE colapsados a --ink-2.
- [x] **U-03 contraste WCAG**: .insEmpty/.drop/.vslab .k/.prow .kf/.nav/.meters, #fmtChip, .tcbox .du, .countbadge, .lanehdr .tag/.ms, .abt → --ink-faint (4.7:1+); .hint → #9EA5AD/11px; .dvlab "AUDIO" 7.5→9px; landing empty → #8A9199. El detector `npx impeccable detect` ya NO reporta low-contrast (24→23 anti-patrones).
- [x] **U-13** estimado de export con `fmtBytes()` → "6.04 GB" (verificado en vivo) + ámbar #E5B567 cuando ⚠ large. **U-14** ítems danger del menú → var(--danger) #D98A8A. **U-36** scrollbar 0.14/hover 0.22. **U-34** .clip .tt color por defecto accesible. **U-35** .searchbox estaba VIVA (wrapper de #mediaSearch) — no se tocó.
- [x] **U-07 Undo/Redo visibles** (#undoBtn/#redoBtn en .top, icono redo existente, i18n EN/ES) — probados en vivo (click deshace/rehace). **U-08 botón "?"** → abre la paleta de comandos (probado). **U-23** Escape ahora cierra modales vía su botón real (#exClose/#prefClose → cleanup de fmtChip; probado). **U-11** Project FPS propaga a activeSeq().fps + markDirty + updFmtChip.
- Pendiente anotado: .folderdrop/.fdel y label "RECENT" del landing conservan grises viejos (tanda futura). Implementación por agente + verificación CDP propia (undo/redo/help/Escape/GB) + captura visual sin regresiones.

## ROUND 94 — AUDITORÍA UX/UI TRIPLE (user: "mejorar el UX/UI hasta impecable"). SIN cambios de código
Skills instaladas en `.claude/skills/`: **impeccable** (pbakaus, 23 comandos + detector determinístico) + suite de auditoría UX de mastepanoski (nielsen-heuristics-audit, don-norman-principles-audit, cognitive-walkthrough, ui-design-review, ux-audit-rethink, wcag-accessibility-audit). Auditoría con 3 métodos (2 agentes + detector CLI) sobre 6 capturas reales vía CDP + index.html + app.js. **Informe completo en `AUDITORIA-UX.md`** (fuente de verdad: 46 hallazgos U-01..U-46 deduplicados + plan en 5 tandas U-T1..U-T5 pendiente de aprobación). Patrones raíz: cero tokens CSS, rampa de grises bajo WCAG, flashStatus como canal único de feedback, modelo Premiere+Ableton sin puente.

## ROUND 93 — Automatización UNIFICADA estilo Ableton (user: choosers en el header de PISTA, un solo botón, gestos de puntos, atajos contextuales). Verificado CDP dev (t1–t5 todo verde)
- [x] **UN solo botón "Automation"** (`#curvesBtn`): fusiona el viejo "Audio React" — los FX reactivos viven en la MISMA vista. `#arBtn`/`state.arCurves`/`appendArAutoLanes`/`toggleArCurves` eliminados.
- [x] **Choosers en el rectángulo de la PISTA** (como Ableton "Mixer / Speaker On"): con Automation activo, cada header de pista de vídeo lleva `.autoctl` = swatch + **2 dropdowns (Device: Clip|FX-del-track · Parameter)** + ↻/A/+. Controlan el param primario del TRACK (`lane._autoP`), dibujado como overlay en TODOS sus clips. El chip sobre el clip (`autochip`) se ELIMINÓ.
- [x] **Claves de efecto por TIPO** `fxt:<type>:<param>` a nivel de pista, resueltas POR CLIP a `fx:<id>:<param>` (`laneKey`); un clip sin ese FX no dibuja nada (y se comporta como fondo). `paramDef` resuelve `fxt:` sin clip (rangos/labels de FXBY). Migración automática `c._arAuto` → `lane._auto` con fxt-keys (`migrateArAuto`, idempotente en renderTimeline).
- [x] **Sub-lanes** (`lane._auto`): cada header lleva el MISMO par de dropdowns (`autoDuo`) + ↻/A/+/✕/resize. **+ añade carril directo** (primero animado-no-visible, luego el siguiente sin mostrar; incluye params de FX del track) — ya no abre menú.
- [x] **Gestos de puntos**: clic en línea AÑADE (ya existía) · **clic directo sobre un punto lo ELIMINA** (Shift+clic = seleccionar/extender; Alt+clic sigue borrando) · arrastre mueve (con selección/snap/swallow) · **clic derecho sobre un punto abre el editor numérico** (tiempo+valor, Enter aplica) · clic derecho en línea = menú (easing sobre el segmento/selección, shapes, copy/paste, simplify, clear).
- [x] **Selección exclusiva pista↔clip**: clic en header de pista deselecciona el clip; seleccionar un clip (timeline/visor/canvas de curva/menu contextual) llama `laneDesel()`. **Ctrl+T** crea pista del TIPO de la seleccionada (audio→audio, si no vídeo). **Ctrl+D**: clip seleccionado → duplica clip; si no, pista seleccionada → duplica pista (vídeo o audio).
- [x] Limpieza: `_arAuto/_arAutoH` fuera de sepAuto/copy-paste-attributes; al borrar un FX se purgan las lanes fxt cuyo TYPE ya no existe en la pista; `serProject` persiste `lane._autoP/_auto/_autoH` (lanes van enteras).
- Verificado CDP: header con 2 selects (Clip/RGB Split) · overlay etiqueta "RGB Split · Intensity" · eval curva fx = 45 ✓ · migración legacy ✓ · clic borra punto ✓ · clic línea añade ✓ · clic-derecho editor + tipear 42 ✓ · menú easing en línea ✓ · drag mueve ✓ · undo restaura ✓ · exclusividad ambas direcciones ✓ · Ctrl+T audio/vídeo ✓ · Ctrl+D clip/pista/pista-audio ✓.
- [x] **R93c — Rueda del ratón INDEPENDIENTE por zona** (user: "son lugares independientes"): rueda sobre vídeo scrollea SOLO el vídeo (nativo, audio pinneado quieto); rueda sobre el módulo de audio (pistas O headers) scrollea SOLO dentro del módulo (nunca encadena al vídeo, ni siquiera sin overflow); **Alt+rueda = zoom vertical de las pistas de ESA zona solamente** (`wheelResizeLanes(e,inAudio)` — antes redimensionaba TODAS); Ctrl=zoom timeline y Shift=horizontal sin cambios; `audioZoneScrollBy` sincroniza header+scroll persistido de forma síncrona (el evento scroll async retrasaba la columna un frame). Verificado CDP 13/13 (cada zona scrollea/redimensiona sin tocar la otra, en pistas y en headers).
- [x] **R93c(2)** — Quitado el botón ⚡ "Generate proxies" de la barra del panel de medios (user) — los proxys se generan por clic-derecho sobre el medio (con multi-selección), como documenta CLAUDE.md.
- [x] **R93b — Módulo de audio de altura FIJA con scroll interno** (user: pistas de audio nuevas hacia ABAJO, el recuadro no crece): `state.tl.audioH` (persistido en `tl`, se inicializa al contenido en el primer render) fija la altura del `.audiozone`; el contenido extra scrollea DENTRO (overflow-y, scrollbar oculta, rueda del ratón, `overscroll-behavior:contain`); ambas columnas sincronizadas (`scroll` ↔ `onscroll`), scroll persistido entre re-renders (`tl._audioScroll`); el divisor "AUDIO" (sticky top dentro del módulo) ahora redimensiona el MÓDULO, no las pistas (cada pista conserva su asa propia); `addLane('audio')` INSERTA en el fondo del módulo (índice mínimo del grupo audio + remap de `c.lane`/`selLane`) y auto-scrollea para revelarla; `duplicateLane` de audio inserta la copia DEBAJO de la original (vídeo sigue arriba — convención Premiere). Verificado CDP 14/14: módulo mantiene 91px con +3 pistas, nuevas al fondo, scrolleado al fondo, headers sincronizados, clips remapeados OK, duplicado debajo, divisor agranda módulo sin tocar lane.h, scroll persiste tras re-render, audioH serializado.

## ROUND 92 — AUDITORÍA COMPLETA (user: optimizar, automatización, conexiones rotas, audio 1h, UX). SIN cambios de código
5 agentes de código + 7 baterías de pruebas en vivo (CDP) con assets reales de RITO DIGITAL (película 64min/12GB, WAV 967MB). **Informe completo en `AUDITORIA-R92.md`** (fuente de verdad de esta ronda; plan de arreglos en 5 tandas al final). Titulares: 🔴 vídeos SIEMPRE muted (sin pipeline de audio de MP4); 🔴 loadProject no limpia undo (clips fantasma entre proyectos); 🔴 switchSeq aniquila el undo (la raíz de las "conexiones rotas" al mezclar nest+fx+recorte); 🔴 nestSelection siempre modo dome; 🔴 reactive pierde srcClipId al anidar; 🔴 ventana tapada = 1fps real pese a backgroundThrottling:false (riesgo NDI, medido). Medido: WAV 1h = +1,7GB RAM; renderTimeline 100ms@300 clips; seek película 1h = 13-46ms (excelente); playback compose+fx = 57fps; keyframes core sólido (razor/move/dup verificados sin aliasing). Trim-in NO borra kfs (desmentido al agente) pero no los rebasa (se deslizan del contenido). **Addendum (user):** §4a del informe REVISADO contra Ableton Live 12 (manual + código): mucha paridad ya existe (Alt-drag curva segmento, marquee, simplify, re-enable, ◆); gaps reales priorizados = lanes a nivel de PISTA persistentes (hoy solo bajo el clip seleccionado), draw mode (B), insert shapes sobre time-selection, stretch/skew de selección.

## ROUND 92-T9 — Módulo de audio FIJO abajo estilo Premiere (user: 4v+1a por defecto, audio siempre presente, redimensionable, vídeo scrollea por detrás). Verificado CDP dev + .exe + captura
- [x] **Default 4 vídeo + 1 audio** (`state.lanes` inicial + `defLanes()`).
- [x] **La pista de audio siempre existe**: `removeLane` bloquea borrar la última pista de audio (y la última de vídeo). Aviso al usuario.
- [x] **Módulo de audio FIJO abajo, vídeo pasa por detrás** (Premiere): audio en `#audioZone` (sticky bottom, hijo de `#tracks` → `#tracks .lane` lo sigue encontrando: hit-testing/waves/marquee intactos) y sus headers en `#audioHeadZone` (sticky bottom). La columna de headers pasó de `transform` a **scroll nativo sincronizado** (`#trackHdr.scrollTop=#tlscroll.scrollTop`) para que el sticky del audio pinne idéntico en ambas columnas. `.rulerpad` sticky top.
- [x] **Redimensionable**: el divisor (doble línea "AUDIO") es el asa — `bindDividerResize` arrastra para crecer/achicar todas las pistas de audio a la vez (persistido en `lane.h`).
- [x] Alineación de columnas: compensado el alto de la barra de scroll horizontal de `#tracks` (`#audioHeadZone.bottom = offsetHeight-clientHeight`) — el audio de ambas columnas queda a la misma Y exacta.
- [x] Robustez: `showMoveGhosts` (ghost al `offsetParent` real) y marquee (`getBoundingClientRect` en vez de `offsetTop`) arreglados para el anidado en `#audioZone` posicionado.
- Verificado CDP: default 4v+1a; audio en su módulo con divisor redimensionable (creció 82→146); scroll con 8+ pistas → audio PINNED abajo, vídeo scrollea por detrás, headers sincronizados (scrollTop 200/250), columnas alineadas exactas; guard última-audio bloquea; guardar/reabrir preserva; play/hit-test/marquee OK. Captura confirma el layout. En el .exe: idéntico.
- [x] **Revisión de diligencia (user: "algo que falte"):** hueco encontrado y arreglado — un proyecto SIN pista de audio (viejo, pre-T9) abría sin el módulo. `loadSeqIntoState` ahora inyecta una pista de audio a las secuencias reales SIN audio (excluye composiciones `m.comp` → siguen solo-vídeo; idempotente, sin markDirty). Verificado: proyecto viejo sin audio → módulo aparece; composición entra/sale solo-vídeo y no se le cuela audio en guardar/reabrir; modo SALA 360 crea con módulo de audio sin crash; rueda sobre la columna de headers scrollea sincronizada sin doble. (Nota: el `//` inicial se comió la línea de loadSeqIntoState → `node --check` lo cazó antes de compilar; corregido con `/* */`.)

## ROUND 92-T8 — Layout Premiere: audio agrupado abajo en contenedor independiente (user). Verificado CDP dev + .exe
Investigado el modelo de Premiere (vídeo arriba, audio abajo, doble línea divisoria, cada tipo agrupado). Implementado como **agrupación SOLO de display** — `state.lanes` y los índices `c.lane` de los clips quedan INTACTOS (compositing de vídeo, guardado y undo sin cambios; verificado round-trip idéntico byte a byte del array).
- [x] `lanesTopDown()` reescrito: `[...vídeo (orden previo), ...audio (orden previo)]` — todo el vídeo arriba, todo el audio abajo, sin tocar el array.
- [x] Divisor estilo Premiere (`.trackdivider`, doble línea + etiqueta "AUDIO") insertado en el render en la transición vídeo→audio, en AMBAS columnas (tracks + laneHeaders) para que queden alineadas. No lleva `data-lane` → invisible al hit-testing (`lanesBetweenY`/drag usan `.lane[data-lane]`).
- [x] Arrastre de pistas acotado a su grupo: una pista de vídeo no cruza el divisor a la zona de audio ni viceversa (clamp de `dropDisp` al rango del grupo). La reconstrucción `reverse(cur)` sigue siendo válida porque el orden agrupado es "todo-audio-luego-todo-vídeo" tras invertir (verificado matemáticamente: V3→tope reordena bien y sigue agrupado).
- Verificado CDP: array interleaved a propósito (video,video,video,video,audio,video,audio) → display agrupado (5 vídeo, 2 audio) con clips en su pista correcta; divisor en ambas columnas; Y monótona sin solapes; clamp vídeo/audio a pos 5; round-trip guardar/reabrir idéntico + divisor reaparece; play/undo OK. En el .exe: agrupado + divisor "Audio".

## ROUND 92-T7 — Remate de detalles (user: "ajusta cualquier detalle que te quede"). Verificado CDP en dev + .exe
- [x] **BUG propio de T6 corregido:** `aelProbeSilent` usaba `a.currentTime<0.35` como delay de sondeo, pero currentTime es la posición DENTRO del archivo → un clip de la película que arranca a min 30 tenía currentTime≈1801 en el frame 1, saltaba el guard, y si el audio aún no decodificaba se marcaba MUDO por error (silenciando un clip CON audio). Fix: medir tiempo REAL reproducido vía `a.played` (suma de rangos); sonda a los 0,5s reales. Test determinista (fake `<audio>`) 4/4: mid-film reciente=no-flag, mudo real=flag, con-bytes=no-flag, pausado=no-flag — en dev y en el .exe.
- [x] **Loop inverso (ping-pong) silencia el preview:** el vídeo va hacia atrás pero el audio no puede → `revMute=(c.loop&&c.loopRev)` pausa el ael en vez de tartamudear (limitación documentada; el vídeo sigue en ping-pong). No-regresión: audio normal (WAV) sigue sonando (1 fuente activa, liberada al pausar).
- Instalador regenerado en `dist\` (firmado). Deploy a canónica + legacy local; Program Files sigue pendiente de UAC.

## ROUND 92-T6 — PRUEBAS PRO E2E con assets reales + revisión adversarial → 8 mejoras (user: "testealo como editor profesional"). Verificado CDP
Sesión E2E real: 12 clips en 4 pistas + WAV máster 1h + compose ring 6 miembros + automatización; guardar→reabrir (round-trip 100%: kf, lane._auto, fx, inlineCurves); tormentas de scrub (6,6ms/seek) y undo (30 ops+60 undos = restauración exacta); playback medido por zonas.
- [x] **🔥 Zona de compose: 6fps → 60fps.** Diagnóstico por descarte (GL composite=0,1ms; sin audio-elements=57fps): los `<audio>` de preview demuxaban 6 originales de 67Mbps SIN pista de audio. Fix: `aelProbeSilent` — a los 0,35s de reproducción con 0 bytes de audio decodificados, `m._noAudio=true` y se destruye el pipeline para toda la sesión (se resetea al relink/replace). Verificado: warmup 40fps, estable 60fps, 3 medias auto-marcadas.
- [x] **Proxies PERSISTENTES entre sesiones**: `reloadMedia` re-vincula proxies existentes en disco (candidatos por hash path|size — estable tras reopen, verificado 5/5 re-bound). Generarlos sigue siendo manual.
- [x] **Rate compuesto a través de nests**: `collectDrawnVideoClips` lleva `rate` (producto de speeds de la cadena) → vel+ael reproducen a la velocidad EFECTIVA dentro de nests acelerados (antes: rate del clip interno + seek-corrección cada 200ms = judder).
- [x] **Servo A/V**: micro-ajuste de playbackRate (±6% vídeo, ±8% audio, proporcional a la deriva) en vez de seeks duros; deriva inicial 150-236ms → ±21-96ms y convergiendo (medido).
- [x] **ael con render-ahead**: el mantenimiento de los audio-elements corre CADA frame (antes vivía dentro de `if(!raHas())` → audio huérfano con RA activo); el pump de vídeo sigue condicionado a !ra.
- [x] **vinstAudio por URL** (antes cacheaba null para siempre si srcUrl no había cargado, y tras Replace/Locate seguía sonando el archivo VIEJO) + `preservesPitch=false` (igual que el export, que resamplea).
- [x] **exportAudioMix: span en segundos de SALIDA** (len es segundos-fuente → con speed≠1 el fadeOut caía en el tiempo equivocado, divergiendo del preview) + fades proporcionales si fadeIn+fadeOut>dur (como fadeFactor) + envolvente de startAudio anclada a `max(base,ctxStart)` (clip empezado antes del playhead con contexto fresco → tiempos negativos).
- Limitaciones conocidas anotadas en AUDITORIA-R92.md: audio no sigue loopRev (ping-pong), volumen >100% clampeado en preview (el export sí lo aplica), cap de 4000 ciclos de nest loop.
- Nota: el workflow de revisión adversarial (42 agentes) tocó el límite de sesión a mitad de verificación — los 12 hallazgos crudos de los 2 finders completados se verificaron a mano contra el código; 8 aplicados, 3 documentados, 1 descartado (setValueAtTime negativo no lanza en Chromium — igualmente blindado).

## ROUND 92-T2/T3/T4/T5 — TANDAS 2-5 de la auditoría (user: "sigue con las siguientes y no pares"). Verificado CDP por tanda, todo verde
**T2 AUDIO:** 🔴C1 los VÍDEOS ya SUENAN — preview: `<audio>` por clip vinculado al ORIGINAL (los proxys no llevan audio), ganancia por frame = volumen×fades×mute componiendo la cadena de nests (`collectDrawnVideoClips` ahora lleva `gain`); export: `decodeAudioData` del MP4 (verificado: Chromium demuxa MP4/AAC) → `m._exAudio` entra a la mezcla (cap 1,5GB por archivo, aviso si se omite; liberado en el finally). `collectAudioEvents` REESCRITO con mapeo local→top (`S`): speed del nest escala rate/posiciones, LOOP del nest repite el pase interno por ciclo (cap 4000), volumen/fades del padre componen (aprox. una rampa); F13 fadeOut=0 si la ventana corta la cola; curvas export=exponencial como preview. F5 `reschedAudio()` en onTLUp/razor/split/delete/ripple/nudge/dup/paste/mute/solo/speed/loop/disable/undo. Verificado: nest 2x → start 105/dur 20/rate 2/vol .5; loop → eventos [0,20,40]; fades padre fi4/fo6; ganancia fade en vivo 0.55=esperado; delete en vivo re-agenda.
**T3 FLUIDEZ/MEMORIA:** F3 camino LIGERO en trims (`positionClips` reposiciona nodos: 1ms vs 26ms full = 26×); F2 la papelera SUELTA lo pesado (el/tex/buffer) si hay path y el undo `reloadMedia` del disco (verificado round-trip); F14 motionTick 30fps + parked con document.hidden; armMediaBands ya NO corre en cada import (solo bajo demanda del panel Reactive); upTex usa texSubImage2D si mismo tamaño; antialias:false en el contexto GL. C7: flag `disable-features=CalculateNativeWinOcclusion` en main.js (3D verificado VIVO — no rompe la GPU híbrida); rAF minimizado sigue a 1/s (compositor) pero **NDI bombea por setInterval a 63 ticks/s minimizado (medido)** → la salida al domo sobrevive.
**T4 AUTOMATIZACIÓN (benchmark Ableton):** lanes a nivel de PISTA (`lane._auto`/`lane._autoH`, persisten en el .isp y en undo): visibles sin selección, un canvas por (pista,parámetro) dibuja TODOS los clips, gestos resuelven el clip bajo el puntero; picker "+" agrupado (animados 1º con ◆ coloreado); DRAW MODE (tecla D — B es la cuchilla): pinta pasos cuantizados a grilla (hold), Alt=a mano alzada; INSERT SHAPES en clic-derecho (seno/triángulo/cuadrada/rampas, escaladas a la time-selection o al paso de grilla); arrastrar un punto sobre un vecino lo ABSORBE (adiós puntos duplicados en el mismo frame); atajo A = vista de automatización; PCOLOR con hue fijo por parámetro (transform cálidos/óptica fríos/color magentas; fx = hsl por clave); kfstrip PASIVO atenuado en clips no seleccionados; `state.inlineCurves` persiste en el .isp. F6 inP escala por speed en trim-L y razor (verificado inP=4 con 2s×2x); F7 keyframe de FRONTERA con el valor de la curva al recortar (verificado t0 v50); F11 wetKf rebasa en trim y razor.
**T5 UX:** búsqueda del panel Media (input + Ctrl+F + ✕; el filtro `state.mediaQuery` existía sin UI — verificado filtra); export con botón ✕ CANCELAR por job + progreso en status bar + `win.setProgressBar` (taskbar, IPC dsp:setProgress); atajos S=snap, +/−=zoom (documentados que no existían); `fmtKey()` = glifos ⌘/⇧ → Ctrl+/Shift+ en Windows (menús y paleta); botón ⚡ Generate proxy visible en el panel Media; hint contextual del viewport restaurado (`#hint`); contraste de status/unidades/selmeta subido a ~#8A9199; "Export · Ctrl+Shift+E" corregido en el HTML; nombre por defecto sin hardcode español.

## ROUND 92-T1 — TANDA 1 de la auditoría: cimientos de undo/estado (user: "dale con los ajustes"). Verificado CDP, todo verde
- [x] **Undo POR SECUENCIA** (`_undoBySeq` map, caps globales 80 snapshots/250MB con evicción del stack más pesado): switchSeq/closeSeqTab/nueva secuencia YA NO vacían el historial (raíz de las "conexiones rotas" nest+fx+recorte); exportar muro/piso tampoco (usaba switchSeq). deleteSequenceMedia → `clearAllUndo()` (otras secuencias podían referenciar el media borrado).
- [x] **C2:** `loadProject` limpia el historial (`clearAllUndo`) — Ctrl+Z tras abrir proyecto B inyectaba clips fantasma de A. newProject/newRoomProject migrados al helper.
- [x] **B13+B12:** `restore()` hace `saveActiveSeq()` (re-cura el alias state.clips⇄nestClips: seqDur/seqReaches ya no leen rancio tras undo) + `markDirty()` (deshacer = cambio sin guardar).
- [x] **C4:** `nestSelection` pasa `isFlat()?'flat':'dome'` a `newSeqMedia` y `fulldome=!isFlat()` — anidar en 2D/sala ya no deforma con warp de domo.
- [x] **C5:** `nestSelection` remapea `state.reactive.srcClipId` al id nuevo dentro del nest + `reactiveSourceClip()` resuelve también dentro de nestClips/otras secuencias — los FX audio-reactivos ya no mueren al anidar (timing exacto con nest en t=0).
- [x] **F8:** `pasteClip` con guard anti-ciclo (pegar un nest dentro de sí mismo se guardaba en el .isp), clamp/creación de lane por tipo (clip en lane inexistente = invisible; audio sonaba sin verse) y guard de media inexistente.
- [x] **C6:** `deleteMedia` avisa con appConfirm cuando el media se usa en otras secuencias (lista los nombres; el undo solo restaura la activa).
- Verificación CDP (dev): 18 asserts — undo sobrevive switch ida/vuelta y deshace nestSelection/razor por secuencia; alias curado sin cambiar pestaña; ciclo/lane/media bloqueados en paste; nest flat=flat+fulldome false; reactive remapeado y resoluble; loadProject deja undo vacío; diálogo C6 con nombres y Cancelar intacto. `node --check` OK.
- [x] `openMenu` acepta ítems `{swatches:{cur,onPick,onClear}}` → fila de muestras de color INCRUSTADA en el menú contextual (paleta LANE_PALETTE + chip ✕ "sin color"). El menú de carpetas (árbol y cuadrícula) muestra los colores directamente — sin el paso intermedio "Color de carpeta…" (ítem eliminado, `openFolderColorPopup` borrado como código muerto). Verificado CDP: menú con 10 muestras inline, clic aplica color y cierra, ✕ lo quita, 0 errores GL.

## ROUND 91 (P0+P1) — MODO 360 "salas inmersivas" · rebrand a Immersive Studio Editor + fundaciones (user, plan aprobado). Deploy A+B 3153804
Plan completo aprobado: modo `room` = muros "desenrollados" en una tira flat continua (reusa TODO el pipeline flat), + visor 3D de sala (fase 4), + snap a muros/resize por esquinas (fase 3), + seamless wrap (fase 2), + export por muro (fase 5). Piso = SECUENCIA APARTE (pestaña propia) vinculada por `room.floorSeqId`. Dos ordenamientos: número = orden en tira 2D; rol (front/left/right/back) = ensamblado 3D. Salas 90°, 2/3/4 muros + piso opcional configurables al crear. Todo detrás de `seqMode==='room'` → domo/flat intactos.
- [x] **P0 rebrand + plomería inerte:** nombre visible → "Immersive Studio Editor" (landing, `DSP.setTitle`, visor 3D; NDI/appId/instalación SIN cambiar para no crear tercera copia). `projTitle` prefijo por modo (Domo/2D/Sala 360). `isFlat()` ahora incluye `room` (compositing rectangular); `isRoom()`/`flatLikeMode()` nuevos; los 3 chequeos directos `mode==='flat'` (nest draw / autoBitrate / fmtChip) usan `flatLikeMode`. `serMedia` serializa `room`+`roomFloorOf`. Domo/flat sin cambios (verificado).
- [x] **P1 setup + creación:** `roomSetupDialog` (segmentado 2/3/4 muros + checkbox Piso; por muro: rol, orden 2D, ancho/alto cm, píxeles; fila de piso ancho/profundidad/px; valida roles únicos). `newRoomProject(cfg)` construye: tira de muros ordenada por número, `stripH=max(pxH)`, `ppc=stripH/max(hcm)` (px/cm uniforme→seamless), `x0/x1` por muro, secuencia `'room'` con `.room={walls,workPxPerCm,floorSeqId,floor}`; si hay piso, secuencia `'flat'` "Piso" con `roomFloorOf`. Ambas abiertas en pestañas, activa = Muros. Botón landing "Nueva sala 360".
- [x] Verificado CDP: brand en landing + botón; sala 4 muros+piso → 2 secuencias; tira 6480×1080 (ppc 3.6: 1800+1440+1800+1440); muros ordenados Front[0,1800] Right[1800,3240] Back[3240,5040] Left[5040,6480]; piso vinculado 1920×1080 flat; `seqMode='room'`, `isFlat()=true`, 2 pestañas; serialización round-trip (4 muros+floorSeqId); chip "Room · 6480×1080 · 60p"; render ok; **no-regresión domo (3D visible) y flat (chip normal)**; 0 errores GL.
- [ ] Pendiente (siguientes fases): F3 snap a muros + resize por esquinas (scaleX/scaleY) · F4 visor 3D de sala (orbit + stand 1.7m, muestrea tira+piso sincronizados) · F5 export completa/por-muro (+ piso aparte).

## ROUND 91b (ajuste modelo + Fase 2) — tira POR PÍXELES + grilla de muros + seamless wrap (user). Deploy A+B 3156533
**Cambio de modelo (user):** los 90° dejan de forzarse. La forma real de la sala la determinan las dimensiones (cm) y **solo se ve en el visor 3D** (fase 4), donde los píxeles de cada muro se estiran/encogen a su quad real y el piso se deforma a la planta. En el **visor flat todo es EXACTO POR PIXELAJE, no por tamaño físico**.
- [x] **`newRoomProject` re-modelado:** la tira se arma por píxeles nativos — `x0/x1` de cada muro = ancho `pxW` concatenado (antes `wcm*ppc`). `stripW=Σ pxW`, `stripH=max(pxH)`. Eliminado `workPxPerCm` de `room` (los cm `wcm/hcm` quedan como metadatos SOLO-geometría para el 3D). Muros más bajos que la tira ocupan su `pxH` desde arriba; el resto es zona muerta (no pertenece a ningún muro).
- [x] **F2 grilla de muros (`drawRoomGrid2D`)**, llamada desde `drawGrid2D` solo si `isRoom()`: costuras verticales entre muros en los bordes `x0`; etiqueta de rol sutil (FRONT/RIGHT/BACK/LEFT) abajo-izquierda de cada muro con fondo semitransparente; zona muerta bajo muros cortos atenuada (rgba negro + borde punteado). Todo por píxeles exactos. El piso (secuencia flat aparte) NO lleva grilla.
- [x] **F2 seamless wrap (`_roomWrap`):** flag nuevo activo solo al componer la tira de muros (reset a false dentro de nests, y `render()`/export lo fijan a `isRoom()`). En `drawClipFlat`, si el clip cruza el borde L/R de la tira (`fc±(|fx|+|fy|) > Fx`) se dibuja una copia desplazada ±2·Fx (un ancho de tira) → el clip que sale por un borde reaparece por el opuesto. 3 draws máx por clip; el shader recorta lo que queda fuera del NDC.
- [x] Verificado CDP (`verify-p2.js`): sala 4 muros (uno corto pxH 960) → tira **6400×1080 = Σ pxW**, sin `workPxPerCm`, bounds contiguos por píxeles, piso flat 1600×900 vinculado. `drawRoomGrid2D` sin excepción, 0 GL. **Wrap definitivo por lectura de píxeles del `compFBO`:** clip centrado pequeño → bordes negros (sin copias espurias); clip desbordando la costura derecha → wrapOff borde izq **negro (L=0)**, wrapOn borde izq **iluminado (L=6170)**. No-regresión: flat (`_roomWrap=false`, 0 GL) y domo (0 GL) intactos.

## ROUND 91c (Fase 3) — resize por esquinas tipo Photoshop + snap a muros (user). Deploy A+B 3161964
- [x] **`scaleX`/`scaleY` per-eje en `flatPlace`** (default 1 → clips flat/domo existentes idénticos; multiplican `hw`/`hh`). Se serializan solos (viven en `c.props`). El resize uniforme cambia `scale`; el resize por borde cambia `scaleX` o `scaleY`.
- [x] **Handles de resize** (`drawFlatHandles`, cacheados en `_flatHandles`): 4 esquinas + 4 puntos medios de borde para el clip 2D/sala seleccionado, dibujados SIEMPRE (independiente del toggle Outline). Cursor de hover por handle (nwse/nesw/ew/ns).
- [x] **`beginFlatResize` + modo `resizeFlat`** con **anclaje en la esquina/borde opuesto** (se queda fijo en el espacio del frame): proyecta el cursor sobre los ejes locales (u,v con rotación), recalcula medias-extensiones y el centro, y escribe `scale`/`scaleX`/`scaleY` + `x`/`y`. Esquina = uniforme (Shift = libre por-eje); borde = un solo eje. Clamp anti-flip.
- [x] **Snap a muros** (solo `room`): `roomSeamX` (costuras x0/x1 + bordes de tira) y `roomSeamY` (fondos pxH de muros cortos + bordes). Resize snapea el handle (`snapFrame`); mover snapea el borde MÁS CERCANO o el centro del clip (`snapMoveAxis`). Umbral por zoom; **Alt lo omite**.
- [x] Verificado CDP (`verify-p3.js` + regresión + screenshot): scaleX=2/scaleY=0.5 → ratios 2.0/0.5 exactos; resize por esquina → escala 100→115 con **esquina opuesta fija [0,0]**; borde → solo `scaleX` (1.127), `scaleY`/`scale` intactos; snap pega 0.21→0.20 (Alt y lejano no); **no-regresión** clic en cuerpo → mover (`elemFlat`, escala intacta) y orbit del domo OK; 0 GL en todo. Screenshot: grilla + etiquetas RIGHT/BACK/LEFT + zona muerta BACK + handles visibles.
- [x] F4/F5 completadas en ROUND 91d (ver abajo).

## ROUND 91d (esquema iso + F4 visor 3D + F5 export) — MODO 360 COMPLETO (user: "sigue con todas las fases hasta terminar" + esquema iso). Deploy A+B 3177949
**Ajuste de modelo confirmado (user):** los 90° NO se fuerzan — la forma la determinan las dimensiones (cm) y solo se ve en el 3D; en el flat todo es exacto por pixelaje. `roomPlan(walls)` = geometría de planta COMPARTIDA (metros) → `{seg:[{role,a,b,h}], poly, closed}`: 4 muros = trapecio (Front/Back paralelos y centrados, laterales se inclinan si los anchos difieren → esquinas no-90°; profundidad `D=√(avg²−off²)`); 3 muros = U (fondo abierto); 2 = esquina; fallback genérico.
- [x] **Esquema isométrico EN VIVO en el diálogo de sala** (`drawRoomIso` sobre `#rsIso`): piso (polígono punteado) + muros de pie coloreados por rol (`ROOM_ROLE_COL`) con etiqueta, proyección iso 2:1, orden far→near. Se redibuja en cada cambio (input en vivo, rol, nº muros, toggle piso). Verificado: 4/3/2 muros=4/3/2 seg; inclinación 1.0 si Front≠Back, 0 si iguales.
- [x] **F4 visor 3D de sala** (`renderRoom3D`, programa GL `PR`/`LR` de quads texturizados pos+uv+shade; VAO dinámico): `buildRoomGeo(seq)` normaliza+centra la planta, cada muro muestrea su sub-rect de la tira (`compTex` letterbox → uL=x0/stripW, vBot=vMax−(pxH/stripH)·Fy) estirado a su quad real; el piso muestrea la secuencia de piso compositada aparte (`compositeFloorTex`→`_roomFloorFBO`) deformada al polígono. Cámara `roomCameraMVP` reusa `state.view.cam`: **Orbit** (fuera) + **Viewer/stand** (ojo ~1.7m `standZ`, mirar con yaw/pitch, dolly rueda, FOV). `render()` bifurca `mode==='3d' && isRoom()`; `updModeUI` muestra el botón 3D "3D Room" en sala. Geo cacheada por `_roomGeoSeq`, NO serializada → se reconstruye al cargar. Verificado+screenshot: caja 3D 4 muros+piso, Back más angosto (trapecio), wallVerts=24/floorVerts=6, orbit≠stand, 0 GL, sin regresión.
- [x] **F5 export sala** (reusa el pipeline vía sub-rect UV): segmento **Tira completa | Por muro** + checkbox **Exportar piso**. `renderExportFrame(t,res,ss,wall)` recorta la sub-región del muro (top-aligned) y la reescala a su `pxW×pxH` nativo; `runExport` compone la tira a `qRes=max(stripW,stripH)` (1:1 por muro), nombra `wall_<rol>_…`; `opt.seqId` exporta el piso en job propio (switch+restore). Título consciente del modo. Verificado: recorte FRONT=negro/RIGHT=brillante (región correcta); "Por muro"+piso encola 3 jobs; save/load OK; 0 GL.
- **360-SALA COMPLETO** (P0→F5). Todo detrás de `seqMode==='room'`; domo/flat intactos, verificado por fase.

## ROUND 91e (7 arreglos de sala pedidos por Beltrán) — Deploy A+B 3182645
- [x] **Cursor de resize invertido:** `_resizeCursor` — la Y del frame va hacia arriba y la de pantalla hacia abajo, así que la diagonal estaba al revés; ahora `sx·sy>0 → nesw`, `<0 → nwse` (verificado nesw/nwse/ew).
- [x] **Snap a centros:** `roomSeamX`/`roomSeamY` añaden el centro del strip (0) y el **centro de cada muro** (h: `(x0+x1)/2`; v: `pxH/2` desde arriba) además de bordes/costuras.
- [x] **Motion set flat/sala** (`ANIM_PRESETS_FLAT` + `curAnimPresets()` por `isFlat()`): **Rotate**(rot) · **Pulse**(scale wave) · **Horizontal**(x lineal, en sala envuelve por `_roomWrap`) · **Vertical**(y lineal con `tile:true`). `clipVTile(c)` → en `drawClipFlat` la **duplicación vertical infinita**: repite el clip por su propia altura cubriendo el frame (kLo/kHi centrados en el viewport, cap 60 copias). Verificado: static 114 filas → tiled 2034.
- [x] **Pos X / Pos Y infinitos al número directo:** `UNBOUNDED_P={x,y}` — `editNumberBox` y la rueda del box no clampan (±1e6) para esos params; el fader mantiene su rango visual.
- [x] **Viewer 3D de sala mira al frente:** `roomStandDefaults()` (yaw=−π/2, pitch=0, fov=60, back=−0.5) al entrar en Viewer/spec en sala (verificado exacto).
- [x] **Grid en 3D con nombres de muro:** `drawRoomLabels3D(mvp)` proyecta (via `proj3`, sin flipx) la subdivisión + etiqueta de rol coloreada al overlay 2D; gate por el toggle Grid; `buildRoomGeo` ahora guarda `cx,cy,sc` en `_roomGeo.norm` para reproyectar. Screenshot: FRONT/RIGHT/BACK/LEFT coloreados centrados + grilla en cada muro.
- [x] **Grid = 3 filas × 4 columnas proporcional por muro** (`ROOM_GRID_ROWS=3`, `ROOM_GRID_COLS=4`): añadido a `drawRoomGrid2D` (2D, gate por Grid) y a `drawRoomLabels3D` (3D). Verificado 0 GL en todos, sin regresión domo/flat.

## ROUND 91f (5 arreglos de sala pedidos por Beltrán) — Deploy A+B 3193143
- [x] **Invertir arrastre en Viewer 3D de sala:** en el drag `orbit`, si `isRoom()&&three==='spec'` se invierte el signo de yaw/pitch (first-person). Verificado: spec +0.39 vs orbit −0.39.
- [x] **Mask to wall (multi-selección):** `c.props.maskWalls=[roles]` → en `drawClipFlat`, si `_roomWrap` y hay `maskWalls`, se dibuja con `gl.SCISSOR_TEST` recortado a los rects de esos muros (`roomWallScissorRects`, en px del FBO cuadrado). UI: chips por muro en el inspector (solo en sala). Verificado: máscara Front → solo Front visible, Right negro.
- [x] **Optimización 3D — muros translúcidos por fuera + toggle:** programa `PR` ahora lleva **normal interior por vértice** (`a_nrm`, stride 32) + `u_cam`; `renderRoom3D` hace 2 pasadas sobre la misma geometría: pasada interior opaca (depth write) y pasada exterior translúcida (`u_backA`, sin depth write) → desde fuera se ve DENTRO (el composite del clip se hace una sola vez). Botón **"Outside tex"** (`#roomOutBtn`, `state.view.roomOutTex`) pinta la textura translúcida también por fuera. `roomCameraMVP` devuelve `{mvp,eye}`. Verificado + screenshot (muros cercanos translúcidos, fondo opaco).
- [x] **Compose flat/360 sin opciones de domo:** `FLAT_COMP_KINDS=[grid,row,col,random]` + `compLayoutFlat` (x/y/scale %) + rama flat en `compElProps`; el diálogo en flat/sala muestra solo Count/Columns/Scale/Máscara/Randomize (oculta ring/spiral/domegrid/el/az-span/etc), preview con marco rectangular. `createComposition`/`regenComposeNest` usan layout flat, nest `mode=seqMode`, `nc.props.fulldome=false`. **Extensión infinita (sala):** checkbox `#cInfinite` → cada elemento lleva scroll horizontal (`param:'x'` lineal) que envuelve por `_roomWrap`. Verificado: nest mode 'room', fulldome false, elementos con x/y/scale.
- [x] **Motion preview reproduce el video:** `motionTick` ahora reproduce (loop, mute) + sube frames de los clips de video en pantalla (`collectDrawnVideoClips`+`pumpVFClip`/`upTex`) para que el 3D room muestre el contenido moviéndose Y reproduciéndose, no un frame congelado; `stopMotionPreview` pausa esos videos; `play()`/`ploop` fuerzan `loop=false` (el timeline gobierna el loop por-clip). Sin regresión.

## ROUND 91g (5 pedidos: proxys manuales, presets de sala, orden único, .ise, renombrar Rito Movie) — Deploy A+B 3196682
- [x] **Proxys MANUALES para todos los formatos:** quitados los 2 auto-`enqProxy` (import + reloadMedia). Menú contextual de media (`openMediaCtx`) → "**Generar proxy**" (o "Regenerar" si ya existe); si hay varios videos seleccionados con shift → "**Generar proxys (N)**" para toda la selección. Verificado: import ya no auto-encola; el ítem aparece.
- [x] **Presets de sala 360 con nombre** (localStorage `iseRoomPresets`, reutilizables entre proyectos): fila Preset en `roomSetupDialog` (select + Guardar + ✕). `getRoomPresets`/`saveRoomPresets`; guardar captura muros+piso+fps; cargar rellena todo el diálogo. Verificado: guarda (wcm 1234), la opción aparece, cargar restaura wcm 1234.
- [x] **Número de pantalla único (auto-swap):** el input `order` en el diálogo, al cambiar, clampa a 1..N y si otro muro tiene ese número **intercambia** (swap) y redibuja. Verificado: [1,2,3,4] → poner muro0=2 → [2,1,3,4] (único).
- [x] **Extensión `.ise`** (Immersive Studio Editor): guardar por defecto `.ise` (`saveProject`/`saveIncremental`/dlBlob), `currentTitle`/`addRecent` quitan `.ise|.rdome`, autosave base `unsaved.ise` (+ escaneo compat `.rdome`). `main.js`: `rdomeFromArgv` acepta `.ise|.rdome`, diálogos save/open filtran `['ise','rdome','json']`, default `proyecto.ise`. `package.json`: `fileAssociations` añade `ise` (mantiene `rdome` legacy). Abre ambas (es JSON). Verificado abriendo `Rito360.ise` renombrado (título/room/0 GL). NOTA: la asociación de doble-clic `.ise` la registra el instalador NSIS → requiere reinstalar; File→Abrir ya muestra `.ise` con el asar actual.
- [x] **Renombrados los 3 proyectos de `Desktop\Rito Movie`** a `.ise`: `360/Rito360`, `Dome/RitoDome`, `Flat/RitoFlat` (autosaves `.snap`/`.autosaveN` intactos; la app abre `.rdome` igual).

## ROUND 91h (rebrand a Immersive Studio Pro + .isp + 3 fixes de sala) — Nuevo install "Immersive Studio Pro" (asar 3197163)
- [x] **Rebrand del software a "Immersive Studio Pro"** (era "Immersive Studio Editor"/"Dome Studio Pro"): `package.json` productName + appId `com.almadigitalstudio.immersivestudiopro` + name `immersive-studio-pro` + shortcutName + portable artifactName; `main.js` títulos de ventana/visor; `index.html` `<title>`; `app.js` landing, `DSP.setTitle`, título del visor 3D, nombre NDI "Immersive Studio Pro — Master". (Comentarios/telemetría interna con "Dome Studio Pro" sin tocar.)
- [x] **Extensión `.isp`** (era `.ise`): guardar/incremental/dlBlob → `.isp`; regex de título/recientes y escaneo de autosave aceptan `.isp|.ise|.rdome`; `main.js` argv + filtros save/open `['isp','ise','rdome','json']` default `proyecto.isp`; `package.json` fileAssociations añade `isp` (mantiene `ise`+`rdome` legacy). **Instalador + carpeta = "Immersive Studio Pro"** (productName). Instalado en `%LOCALAPPDATA%\Programs\Immersive Studio Pro` (silent `/S`) con asociación `.isp` + acceso directo. Renombrados los 3 proyectos de Rito Movie `.ise`→`.isp`.
- [x] **Nombre de muro en 3D pequeño/gris en la esquina** (como el 2D): `drawRoomLabels3D` — etiqueta a `pt(0.05,0.10)` (abajo-izq del muro), 9px, gris `rgba(196,201,208,0.82)` con fondo tenue (antes 12px coloreada centrada). Verificado por screenshot.
- [x] **Texturas invertidas 3D→2D arregladas:** con la planta CCW vista desde DENTRO, cada muro va a→b de derecha-a-izquierda → **U estaba espejada**. `buildRoomGeo`: swap `uL↔uR` en muros + flip x en `fuv` del piso. Vertical OK (arriba=arriba). Verificado por píxeles: clip a la izquierda del strip → aparece a la izquierda en el Viewer (left 331 > right 241).
- [x] **Doble grilla en 2D → una sola:** `drawFlatFrame` ya no dibuja la grilla genérica de tercios en modo sala (`!isRoom()`); queda solo la per-muro 3×4 de `drawRoomGrid2D`. Verificado 0 GL, sin regresión domo/flat.
- Deploy: nuevo install "Immersive Studio Pro" + asar copiado también a las 2 instalaciones antiguas "Dome Studio Pro" (corren el código nuevo). NOTA: el doble-clic `.isp` funciona en el install nuevo; las antiguas quedan como legacy (desinstalables).
- [x] **(R91i) Nombre de muro en 3D como TEXTURA pegada al muro** (pedido: "como la grilla"): `drawRoomLabels3D` ya no dibuja el texto plano en un punto — lo pinta como **decal afín sobre el plano del muro** proyectando 3 esquinas de una caja en (u,v) del muro (`pt(0.96,0.05)`/`pt(0.64,0.05)`/`pt(0.96,0.16)`) y aplicando `ctx.setTransform` para que el texto siga la perspectiva del muro (escorza/escala con él, como las líneas de grilla). Lee correcto de izq→der desde DENTRO (lado 'b' = pantalla-izq); gris `rgba(208,212,218,0.5)`. Verificado por screenshot orbit + Viewer (FRONT recto sobre el muro frontal, LEFT escorzado hacia la profundidad). Deploy 3 installs 3197483.
- [x] **(R91j) Ajustes 3D sala:** texto de muro MUCHO más chico (caja del decal `wu 0.32→0.15`, `wv 0.11→0.05`, esquina abajo-izq); **fondo de cada muro NEGRO como el 2D** (`u_base`→`(0,0,0)` + clear del visor a negro): los muros sin contenido quedan negros con solo la grilla, el contenido se pinta encima. Verificado screenshot Viewer + 0 GL. Deploy 3 installs 3197615.
- [x] **(R91l) Limpieza + rename de carpeta.** Borrados de `dist/` los artefactos **Dome** viejos (portable+Setup+blockmap, ~184 MB, regenerables) + `builder-debug.yml`; `alma-logo-OLD.png.bak` movido a `_backup/`. **Carpeta de trabajo renombrada `Dome Studio Pro/` → `Immersive Studio Pro/` y MOVIDA** a `C:\Users\beltr\Desktop\Alma Digital Studio\Projects\Immersive Studio Pro` (ya NO bajo "Rito Digital Visual"); verificado que compila e íntegra en la ruta nueva. El `deploy-ndi-to-programfiles.ps1`/`package.json` solo referencian rutas de INSTALACIÓN (no la de trabajo) → sin cambios necesarios.
- [x] **(R91k) Etiqueta 3D: mitad de tamaño + sin estirar horizontal.** La caja del decal ya no es de proporción fija (estiraba el texto): `wu` se calcula del **aspecto real** = `wv·(tw/th)·(wallH/wallW)` (ancho del texto × proporción física del muro `hypot(b−a)`) → no se deforma; `wv 0.05→0.03`. Queda compacta en la esquina abajo-izq. Verificado screenshot. Deploy 3 installs 3197745.

## ROUND 90c — Selección de medios por RANGO con Shift + colores de carpeta INLINE en el menú (user). Deploy A+B 3143374
- [x] **Shift = rango contiguo** (estilo Adobe/Explorador): clic normal fija el ancla (`state.selMediaAnchor`) y selección única; shift-clic selecciona TODOS los medios entre el ancla y el clic en el ORDEN visible (`orderedMediaIds()` lee el DOM → respeta carpetas/colapso/filtro). Ctrl/Cmd sigue siendo toggle individual. `clearMediaSel` limpia el ancla. Antes shift hacía toggle de a uno (comportamiento de Ctrl).
- [x] **Colores de carpeta INLINE en el clic derecho** (user "que aparezcan de una los colores a elegir"): `openMenu` soporta un item `{swatches:{cur,onPick,onClear}}` que dibuja la fila de muestras DENTRO del menú (paleta + ✕ = sin color); clic aplica directo sin popup extra. Reemplaza el ítem "Color de carpeta…" en árbol y cuadrícula; `openFolderColorPopup` eliminado.
- [x] Verificado CDP: clic m1 + shift-clic m3 → 3 seleccionados (3 en DOM), shift-clic m2 encoge a 2, Ctrl añade m4 (3), clic normal resetea a 1 con ancla; menú de carpeta con ≥5 muestras inline, clic de muestra fija color sin segundo popup; 0 errores GL.

## ROUND 90 — Panel de medios: rename in-place de carpetas, sin botón de basura, colores de carpeta, Propiedades y Localizar (user). Deploy A+B 3141470
- [x] **Rename de carpetas IN-PLACE** (`renameFolderInline` con `inlineEdit` sobre `.fnm` del árbol / `.tlbl` del tile de cuadrícula; fallback a prompt si no hay elemento): commit renombra vía `_reprefixFolders` → color, medios y navegación siguen al nuevo nombre. Guards `isContentEditable` en click/dblclick/pointerdown para que editar no dispare drag/navegación. El rename de medios ya era in-place (R86).
- [x] **Botón de basura (`.fdel`) eliminado** de las cabeceras: una carpeta solo se borra con **tecla Suprimir** (nueva rama en el keydown para `state.selFolder`, con confirmación si tiene medios; `clearMediaSel` también suelta la selección de carpeta al tocar timeline/viewport → Suprimir nunca borra una carpeta por sorpresa) **o clic derecho → Eliminar carpeta**.
- [x] **Colores por carpeta**: `state.folderColors{path:hex}` persistido en el proyecto; menú contextual "Color de carpeta…" → `colorPopup` (paleta existente); tiñe icono+nombre en el árbol y icono+borde del tile; los colores SIGUEN a la carpeta al renombrar/mover y se limpian al borrar (`_reprefixFolders`/`deleteFolder`).
- [x] **Clic derecho en un medio → "Propiedades…"**: modal con nombre, tipo, resolución, fps, duración (+segundos exactos), nº de fotogramas (secuencias), sample rate/canales (audio), tamaño en disco, bitrate promedio calculado, estado del proxy, carpeta y ubicación (texto seleccionable) + botón "Mostrar en el Explorador".
- [x] **Clic derecho → "Mostrar en el Explorador"** (localizar el archivo en disco, `DSP.revealPath`) para cualquier medio con ruta.
- [x] Verificado CDP: sin `.fdel`; color en icono, sigue al mover (Col→Otro/Col) y al renombrar; rename inline editable sin diálogo flotante y con medios/color remapeados; Suprimir borra la carpeta seleccionada; selección se suelta al tocar timeline; Propiedades muestra 2560×1440 / 60fps / 250MB / 200Mbps / ruta / botón Reveal; menú con Propiedades y Explorador; 0 errores GL.

## ROUND 89c — Doble clic ENTRA a la carpeta en la lista (user: "con doble click abre el rename"). Deploy A+B 3135324
- [x] Doble clic en una cabecera de carpeta del árbol NAVEGA hacia adentro (renombrar pasa al menú contextual, como en la cuadrícula): vista scoped con fila "← ruta" que vuelve al padre nivel a nivel, subcarpetas+medios del nivel actual, y `state.mediaFolder` COMPARTIDO con la cuadrícula (cambiar de vista mantiene la carpeta). GOTCHA arreglado: el clic simple re-renderizaba el panel y el elemento se reemplazaba a mitad del doble clic → el dblclick nunca disparaba; ahora la selección pinta clases IN-PLACE (`selectHdr`) sin re-render. "Nueva carpeta"/Importar/drop del SO caen en la carpeta navegada (o la seleccionada). El toggle lista↔cuadrícula ya no resetea la navegación.
- [x] Verificado CDP: click selecciona in-place (elemento vivo+fsel), dblclick entra sin diálogo, back ×2 vuelve a raíz, drill Clips→Clips/Front, target de Nueva carpeta = carpeta navegada, 0 errores GL.

## ROUND 89b — Las carpetas se ven SIEMPRE en la lista (user: "abro el media y no se ve la carpeta salvo en cuadrícula"). Deploy A+B 3133511
- [x] El árbol de carpetas ya no depende de la agrupación "Folder": la vista de lista lo renderiza SIEMPRE que existan carpetas (con "None" incluido); "None" solo queda plano con cero carpetas. Verificado CDP: None+carpetas → árbol con sangría; None sin carpetas → lista plana; 0 errores GL.

## ROUND 89 — Vista de LISTA como ÁRBOL de carpetas estilo Adobe (user, con capturas de Premiere). Deploy A+B 3133497
- [x] La agrupación por carpeta de la vista de lista ahora es un ÁRBOL real: carpetas anidadas con sangría (13px/nivel), chevron `.fchev` colapsa/expande (solo el chevron — el clic en la fila SELECCIONA la carpeta, `state.selFolder`, highlight `.fsel`), medios indentados bajo su carpeta, subcarpetas recursivas, contador = medios+subcarpetas, placeholder "Arrastra medios aquí" en carpetas hoja vacías. Cabecera raíz "Sin archivar" (fname='') = destino de drop para SACAR de carpetas.
- [x] "Nueva carpeta" crea DONDE ESTÁS (Adobe-like): grid → carpeta navegada; lista → carpeta seleccionada; la nueva queda seleccionada y sus ancestros se expanden. El botón Importar y el drop de archivos del SO también archivan en la carpeta navegada/seleccionada — y si sueltas ENCIMA de una cabecera concreta, en ésa.
- [x] Drag&drop en lista: filas de medios (multi-selección incluida) Y cabeceras de carpeta son arrastrables entre niveles (startFolderDrag en cabeceras; `_folderJustDragged` evita que el clic post-drag cambie la selección). `selFolder` se remapea en mover/renombrar y se limpia al borrar.
- [x] Verificado CDP: sangrías 6/19/32px, colapso oculta subárbol, clic selecciona + Nueva carpeta creó B/Hijo dentro de B, mover medio a carpeta anidada, mover carpeta A/Sub→B con su medio siguiéndola, cabecera raíz des-archiva, 0 errores GL.

## ROUND 88b — AUDITORÍA del lote R88 (user): 6 hallazgos corregidos, todo re-verificado CDP. Deploy A+B 3130596
- [x] **A1 (real)** Arrastrar una MULTI-selección era imposible: el pointerdown simple sobre un ítem ya seleccionado reseteaba la selección a [ese] antes del drag. Fix: si ya está en la selección, se conserva (patrón del timeline). Verificado DOM: press sobre seleccionado mantiene 2; sobre no-seleccionado resetea a 1.
- [x] **A2 (real)** `_importFolder` OBSOLETO: el botón Importar heredaba la carpeta del último drop (los archivos caían en una carpeta vieja). Fix: default null + reset tras cada import + el botón Importar archiva en la carpeta que estás navegando (grid).
- [x] **A3 (real)** El jitter (Aleatorizar) abría COSTURAS en composiciones tile/mosaico: excluido con `!g.tile` (además de domegrid/random). Verificado: ring+tile+jitter60 queda sin jitter.
- [x] **A4** `groupScale` seguía tapado a 160 con el nuevo máximo 300 → 300.
- [x] **A5 (riesgo)** `startFolderDrag` hacía preventDefault en pointerdown (puede suprimir el dblclick que ABRE la carpeta en Chromium) → quitado; verificado con eventos DOM reales: dblclick entra a la carpeta y aparece el tile ←.
- [x] **A6** Texto/forma/ajuste creados navegando una carpeta iban a la raíz (invisibles) → se archivan en la carpeta actual. + Menú "Mover a:" ahora mueve toda la multi-selección vía `moveMediaTo` (undo/dirty).
- [x] Notas de auditoría sin cambio: undo NO restaura movimientos de carpeta (snapshot no incluye folders/m.folder — igual que siempre, sin corrupción); vista LISTA muestra paths completos "A/Sub" como cabeceras planas (funciona el drop, estética pendiente); loop reverse en vídeo durante play en vivo puede no ser fluido (navegador no reproduce video hacia atrás) — scrub/export correctos. Regresiones re-verificadas: moveFolder+medios siguen, ping-pong exacto, 0 errores GL.

## ROUND 88 — Lote de 11 arreglos (user), de más difícil a más fácil. Todo verificado CDP contra fuente (1 solo build). Deploy A+B 3129344
- [x] **F1 · Carpetas ANIDADAS + drag&drop completo** (lo más difícil): modelo path-based (`state.folders`=paths "A/Sub", `m.folder`=path del contenedor; retrocompatible — nombres planos viejos = paths de nivel superior). Helpers `folderName/Parent/Children/Descendants`, `joinFolder`, `_reprefixFolders`, `moveFolder`, `moveMediaTo`. Grid reescrito para navegar el árbol (subcarpetas del actual + medios del actual + tile ←). Crear carpeta dentro de la que estás (`newFolderIn(state.mediaFolder)`). Arrastrar **medios (multi-selección shift)** y **carpetas** entre carpetas / al fondo del grid (root) / al tile ← (padre), con **highlight visual del destino** (`_dropTargetAt`/`.dragover` en folderhdr/backtile/mediagrid). Arrastrar una **carpeta del Explorador de Windows** la importa entera recreando su árbol (`importDropped` con `webkitGetAsEntry` recursivo → `_importFolder` capturado por cada `add*`). Verificado CDP: crear A + A/Sub, mover medio a A/Sub, mover carpeta A/Sub→root y el medio la SIGUE (A/Sub→Sub).
- [x] **F2 · Compose no vuelve a frame 1 al editar params**: `apply`/Recompose usan `scrubRender()` (re-busca los videos internos recreados al frame ACTUAL, no a 0). Verificado.
- [x] **F3 · Nest desde recorte muestra desde el in-point, no frame 0**: el scope (inP/speed) se PERSISTE en el comp group (`g.scopeInP/scopeSpeed`) y `regenComposeNest` lo re-aplica → editar params ya no revierte al frame del video original. Verificado (innerInP=5 inicial y tras regen).
- [x] **F4 · Aleatorizar en TODOS los modos**: overlay de jitter en `compLayout` (az±60·J, el±30·J, size±60%·J con `g.rand`) + fila "Aleatorizar" (botón Mezclar posiciones ↻ + slider %) en el diálogo, `jitter`/`rand` persistidos. No afecta domegrid (sectores sin costura) ni el modo random. Verificado (5/6 elementos cambiaron).
- [x] **F5 · Multi-selección de medios (shift) → clic-derecho → crear composición**: `state.selMediaIds`, `selectMedia(id,e)` toggle con shift/ctrl, `paintMediaSel`, item "Crear composición desde estos N" (medios componibles), `openCompose(...,preselIds)` pre-marca. Delete borra toda la multi-selección. Verificado.
- [x] **F6 · Toda composición va en pista NUEVA**: `createComposition` siempre `push` de una lane de vídeo nueva (antes reusaba la existente). Verificado.
- [x] **F7 · Viewport 2D mueve SOLO el clip seleccionado**: `flatRectHit(c,px,py)`; en modo plano el pointerdown solo arrastra el clip seleccionado (un clip encima ya no roba el drag → clips de abajo se mueven seleccionándolos primero en el timeline). Dome sin cambios.
- [x] **F8 · Scale casi infinito**: `TF_FLAT` Scale 300→**1000%**, `TF` dome Size 160→**300°** (drawClipFlat sin clamp superior → se puede tipear más). Verificado.
- [x] **F9 · Loop REVERSE (ping-pong)**: `srcT` alterna dirección en ciclos impares cuando `c.loopRev`; `toggleLoopReverse`, toggle en inspector (bajo Loop, no audio) + menú del clip. Verificado exacto (0→1→2 ida, 2→1→0 vuelta).
- [x] **F10 · Audio a mitad**: scheduling de `startAudio` para rel<0 PROBADO correcto desde cualquier posición (ruler-scrub y click-en-timeline → 1 fuente); + `startAudio` reprograma tras `resume()` si el contexto estaba suspendido. (El "no suena a mitad" del usuario era el buffer aún decodificando; ya cubierto por R87b/R88 reschedule-al-decodificar.)
- [x] **F11 · Locator con nombre editable al instante**: `addMarker` abre el rename inline diferido un tick. Verificado (tecleo "MyLoc"+Enter renombró). 0 errores GL en todo el lote.

## ROUND 87b — Audio no se escuchaba (user "revisión rápida") — reprogramar al decodificar tarde
- [x] Motor de audio + ruta de decodificación VERIFICADOS sanos por CDP (ctx 'running', 1 source programado, masterGain=1, salida estéreo; WAV real decodifica en ~100ms y programa reproducción). El hueco real: `startAudio()` solo se llama al pulsar Play; si el buffer termina de decodificar DESPUÉS (típico con el audio largo de la película, que tarda un instante tras cargar el proyecto), el clip quedaba MUDO hasta re-dar Play. Fix: `addAudio` (import) y la rama audio de `reloadMedia` ahora llaman `if(state.playing)startAudio()` al fijar el buffer → reprograma y se oye sin re-reproducir. Verificado CDP: Play sin buffer→0 sources; tras decodificar→`startAudio` dispara (ph 0.14) y queda 1 source. Deploy A+B 3114154.

## ROUND 87 — Save As visible + capa de ajuste como MEDIO + estado "cargando" (no "missing") + sync autosave (user)
- [x] **Save As visible**: caret `#saveMenuBtn` (chevron) junto a Save → menú Save / **Save As… (archivo nuevo)** / Save incremental (`openSaveMenu` compartido con el clic-derecho de Save). Ctrl+Shift+S sigue haciendo Save As.
- [x] **Capa de ajuste como MEDIO arrastrable**: el botón lateral "Adjust" (`#adjLayerBtn`) ahora crea un MEDIO `kind:'adjust'` (`createAdjustMedia`/`newAdjustMedia`) que aparece en el panel de Medios (tile rayado, etiqueta ADJ, "ajuste · FX debajo"); arrastrarlo a una pista de vídeo (o doble-clic) crea un clip de ajuste (`addClip` rama adjust → `makeAdjustClip`). Su cadena FX afecta a todo lo de debajo — **color Y audioreactivo**. VERIFICADO empíricamente que los FX reactivos SÍ modulan en capas de ajuste (banda bass alta→mod 1.0, baja→0.0). El botón "Add Adjustment Layer" del panel reactivo sigue soltando una directa en el timeline. `reloadMedia`/serialización manejan `kind:'adjust'` (sin archivo).
- [x] **Missing media falso en apertura (sobre todo audio)**: nuevo flag `_loading` — al cargar proyecto el medio de archivo arranca `missing:true,_loading:true`; `reloadMedia` limpia `_loading` en CADA salida (éxito y fallo real; +handlers `error` de img/video). Los tiles muestran "cargando…" (no "ausente") y sin contorno mientras decodifica; `updRelink` solo avisa de fallos REALES (`missing&&!_loading`) → ya no hay flash "Missing media" mientras el audio decodifica.
- [x] **Autosave sync (recents vs doble-clic ofrecían recuperación falsa)**: causa raíz = el tick de autosave escribía un autosave REDUNDANTE de un proyecto recién cargado y limpio (guard `!dirty && lastSaved` era false con `lastSaved` undefined) → ese autosave quedaba MÁS NUEVO que el .rdome → siguiente apertura ofrecía "restaurar autosave más reciente". Fix: (1) tick `if(!state.dirty)return;` — nunca autosalvar un proyecto limpio/recién-cargado; (2) `clearLiveAutosaves()` borra `.autosave1/2` tras cada Save manual → el .rdome siempre es la copia más nueva. Recents y doble-clic (ambos usan `openProjectPath`→`maybeOfferAutosave`) quedan siempre en sync con el último guardado.
- [x] Verificado CDP: menú Save As presente; `createAdjustMedia`→medio 'adjust' en panel + drop crea clip adjust; tile "cargando"→"missing" al fallar y `updRelink` ignora los que cargan; `clearLiveAutosaves` ok; reactivo en capa de ajuste modHi=1/modLo=0; 0 errores GL. Deploy A+B 3113843.

## ROUND 86 — Barra de vista + selección/renombrado de medios in-place + renombrado por clip (user)
- [x] **Barra 3D Dome**: el botón **Orbit** ahora va a la IZQUIERDA de **Viewer** (orden `orbit`,`spec` en `#threeModeSeg`). **Viewer por defecto FOV 60 / dolly 0.8** (`state.view.cam.fov:60, back:0.8` + `value`/label en HTML; `updViewCtl` sincroniza los sliders al entrar a Viewer). **Faders más cortos** (FOV 88→56px, DOLLY/DIST 78→54px, `.vslab` padding 9→7 / gap 8→6) para que no se corten los botones. **Icono de 3D Dome centrado** en su botón (`view3d` path desplazado a y=16 → bbox centrada en 12).
- [x] **Medios: clic = seleccionar** (`state.selMediaId`, `selectMedia`/`clearMediaSel`, clases `.mitem.sel`/`.mtile.sel`). Con un medio seleccionado, **Suprimir borra el MEDIO, no el clip del timeline** (rama prioritaria en el keydown antes de ripple/marker/group/deleteSel). Tocar el timeline/viewport/cabecera de pista o añadir un clip (`addClip`) devuelve la prioridad de borrado a la selección del timeline.
- [x] **Renombrar medio IN-PLACE** (no diálogo flotante): doble-clic sobre el nombre (`.mname` lista / `.tlbl` cuadrícula) o menú contextual "Renombrar" → `renameMediaInline` con `inlineEdit`. `deleteMedia` extraído y compartido (menú + tecla Suprimir).
- [x] **Renombrar por clip**: doble-clic sobre el TÍTULO de un clip (`.tt`) lo renombra in-place; menú del clip + Ctrl+R también. Como cada porción cortada es su propio objeto-clip, **cada trozo se renombra independientemente** (verificado: cortar en 2 → renombrar la 2ª parte deja la 1ª intacta). La cabecera de pista sigue con doble-clic → renombrar pista.
- [x] Verificado CDP: orden Orbit/Viewer, defaults 60/0.8 reflejados en sliders, ancho faders 56/54, `view3d` path `M3 16`; medio seleccionado + Suprimir borra el medio sin tocar el clip fake seleccionado; clear quita `.sel`; rename medio "RENAMED_B"; corte→2 clips ids únicos→2ª parte "PART_TWO" y 1ª intacta; 0 errores GL. Deploy A+B 3109569.

## ROUND 85 — "Quitar negro" (luma key) — transparencia real, mejor que screen (user)
- [x] El screen solo aclara; el usuario quería quitar el fondo negro. **Luma key** `props.blackKey`+`blackKeyAmt`(umbral)+`blackKeySoft`(suavidad): shader PP `_KEY` (`applyBlackKey`) pone la ALPHA del clip = `smoothstep(thr, thr+soft, max(R,G,B))` — usa el MAX de canales para que colores saturados sobrevivan y solo el negro/oscuro-en-todos-los-canales se vuelva transparente. Corre como último pre-pase (tras fisheye+FX) → transparencia real que compone con NORMAL blend; funciona en domo y plano. Toggle + campos Umbral/Suave en el inspector (cualquier clip visual, no audio). Serializa vía props; `_keyRT` liberado.
- [x] Verificado CDP con 2 capas fulldome (roja abajo, negra-con-cuadro-blanco arriba): key OFF → zona negra tapa (0,0,0); key ON → la zona negra deja ver el ROJO de abajo (224,16,16), el cuadro blanco intacto (255,255,255), 0 errores GL. Deploy A+B 3106097.

## ROUND 84c — Flechas ←/→ paso por frame + color POR CLIP (color de pista = solo cabecera) (user)
- [x] **Flechas ←/→ = paso exacto por frame** del cabezal (ya existía; ahora con `e.preventDefault()` para que el navegador no scrollee además, + `positionPlayhead()`). Alt+flecha sigue haciendo nudge del clip. Verificado: 3 derecha − 1 izquierda = +2 frames a 60fps (con la app en uso; detrás de un modal los atajos no disparan, correcto).
- [x] **Color por clip:** los clips ahora se pintan con SU PROPIO `c.color` (no `laneTint`); el **color de pista tiñe solo la cabecera** de la pista (ya era así, líneas 1229-1232). Popup de swatches refactorizado a `colorPopup` genérico → `openLaneColorPopup` (pista) + **`openClipColorPopup`** (todos los clips seleccionados). Entrada **"Color…"** en el menú contextual del clip + la barra de color del inspector ahora abre el picker del CLIP. Verificado CDP: clip A azul propio, clip B gris por defecto (NO el rojo de la pista), cabecera con tinte rojo. `laneTint` queda como helper muerto (inofensivo). Deploy A+B 3101516.

## ROUND 84b — Ctrl+L quita el loop tras un clic simple (user)
- [x] Antes: con un loop activo, un clic simple dejaba una marca de inserción (`selA==selB`) y `loopSelection` a propósito NO borraba el loop ("an insert marker alone must NOT destroy an existing loop"). Ahora: si no hay rango ni clip que loopear (`a==null`), Ctrl+L **quita el loop activo** (cubre el caso "clic simple en otra parte + Ctrl+L"), y si no hay loop solo avisa. Loopear un clip seleccionado o un rango sigue igual. Verificado CDP (5 casos). Deploy A+B 3100387.

## ROUND 84 — Save As visible + vista de cuadrícula de medios con navegación de carpetas (user)
- [x] **Save As:** `saveProject(true)` (forzar diálogo → guardar como archivo NUEVO, `currentPath` pasa al nuevo) ya existía con atajo Ctrl+Shift+S; ahora VISIBLE: entrada "Guardar como… (archivo nuevo)" en la paleta ⌘K + **clic derecho en el botón Guardar** (Guardar / Guardar como… / Incremental) + tooltip actualizado. Verificado: el menú del botón muestra "Save As".
- [x] **Vista de cuadrícula de medios:** botón en la cabecera del panel (2×2) alterna lista/cuadrícula (`state.mediaView`). En cuadrícula: **carpetas como tiles cuadradas** (icono carpeta + nombre + conteo); **doble-clic entra** a la carpeta (`state.mediaFolder`) mostrando SOLO sus medios + una **tile "← volver"**; medios como tiles con miniatura + duración + badge de proxy. Arrastrar un medio sobre una tile de carpeta lo archiva (reusa `folderhdr`/`dataset.fname`). Menú contextual de medios extraído a `openMediaCtx` (compartido lista+tiles). Verificado CDP: raíz muestra 1 carpeta + 1 medio suelto, entrar muestra back+alpha.png, volver regresa. Deploy A+B 3100305.

## ROUND 83b — BUG "el proyecto solo me lleva al inicio" (user, crítico — no perder trabajo)
- [x] **Causa:** al abrir (doble-clic / botón Abrir) un proyecto con autosaves más nuevos que el archivo (siempre, tras editar), `maybeOfferAutosave` mostraba el diálogo de recuperación PERO la pantalla de inicio (`#landingOv`) seguía visible ENCIMA/al lado → el usuario solo veía el inicio y no notaba/alcanzaba el diálogo. `loadProject` (que oculta el landing) no corría hasta responder el diálogo. Verificado por CDP: `overlays:["landingOv","confirmOv"]`, clips=0 en espera.
- [x] **Fix:** `hideLanding()` ANTES de `maybeOfferAutosave` en `openProject` y `openProjectPath` → el diálogo aparece en pantalla limpia. Verificado: ahora `overlays:["confirmOv"]` solo; clic en "Restaurar autoguardado" o "Abrir el archivo" carga el proyecto completo (1 clip, 2 medios, vídeo RITO DIGITAL FILM). `loadProject` sobre el archivo del usuario ya funcionaba (no era un problema de datos).
- [x] **Limpieza de datos:** MIS pruebas habían escrito autosaves VACÍOS (1105b, clips=0) en `Rito Digital Dome\autosave\` que, siendo los más nuevos, "Restaurar autoguardado" ofrecía → habrían dado estado vacío. Borrados los `.autosave1` y `.snap` de <1500b; conservados los buenos (2221b). El `.rdome` del usuario (11:44) SIEMPRE estuvo intacto. Deploy A+B 3094821.

## ROUND 83 — Pre-warp FLAT → OJO DE PEZ para clips de domo (user): botón "Ojo de pez" + cantidad, para material plano que va marcado como fulldome pero no tiene la curvatura fisheye
- [x] `props.fisheye` (bool) + `props.fisheyeAmt` (0-100). Shader PP `_FISH` (`applyFisheye`): remapeo radial barrel `rs=tan(d·k)/tan(k)` con k=0.02..1.37 según cantidad; k→0 = identidad (1:1), fuerte = ojo de pez; el borde siempre mapea al borde (llena el disco, sin anillo negro). Corre sobre la textura del clip ANTES de la cadena de FX y de la colocación en el domo (`drawClip`), así funciona con o sin fulldome.
- [x] Toggle + campo de cantidad en el inspector junto a "Fuente fulldome" (solo domo). Serializa vía props; default en `makeClip`; libera `_fishRT` en `freeFxResources`. **Fix latente:** los toggles fulldome/fisheye ahora llaman `raInvalidate()` (antes solo `render()` → con render-ahead activo el cambio no se veía).
- [x] Verificado: shader aislado mueve un anillo de r=0.46→0.84 (amt 0→100); pipeline en vivo r=0.475→0.853 al alternar; captura del máster muestra un tablero plano correctamente abombado en esfera de domo; 0 errores GL. Deploy A+B 3094600.

## ROUND 82c — HISTORIAL de recuperación (última hora) abrible como proyecto nuevo (user)
- [x] **Snapshots con timestamp** en la carpeta `autosave` del proyecto: `<archivo>.rdome.<YYYY-MM-DD_HH-mm-ss>.snap`, escritos ~1/min (`_lastHistT`, ≥55s) desde el intervalo de autosave, **podados a la última hora** (`pruneHistory` borra los `.snap` con mtime >1h de ESTE proyecto). Aparte de los 2 archivos de crash alternantes (`.autosave1/2`).
- [x] **Diálogo "Historial de recuperación…"** (paleta ⌘K, junto a "Restaurar último autoguardado"): `openRecoveryHistory` lista snapshots+crash de este proyecto (más nuevos primero, con hora + "hace X min"). Clic en uno → `confirmDiscard` → carga como **proyecto NUEVO** (`currentPath=null`, `dirty=true`) → Guardar pide nombre nuevo; el trabajo actual queda intacto hasta guardar. "Para volver atrás."
- [x] IPC nuevos: `dsp:listDir` (name+mtime+size), `dsp:deleteFile`. Verificado CDP: 3 snapshots con timestamps distintos + 1 crash, poda conserva recientes, abrir carga el snapshot correcto con currentPath limpio, diálogo renderiza 4 filas. Deploy A+B 3090928.

## ROUND 82b — Autosaves en carpeta `autosave` JUNTO al proyecto (user): `autosaveBase()` = `<projectDir>\autosave\<archivo>.rdome` (+`.autosave1/2`); antes del primer guardado siguen en `userData/autosave/unsaved.rdome.*`. `projAutosaveDir()` + `DSP.ensureDir` crea la carpeta; `emergencySave` la asegura antes de escribir. `restoreAutosave`+`maybeOfferAutosave` buscan en la carpeta nueva Y en el sidecar antiguo (compat). Verificado CDP: base=`…\autosave\MyFilm.rdome`, escritura en carpeta, oferta de recuperación con gap real >2s encuentra el archivo de la carpeta. Deploy A+B 3085375.

## ROUND 82 — 5 arreglos (user), todo verificado CDP + deploy A+B 3084339
- [x] **(1) Líneas gruesas con blur eliminadas**: el `.snapline` tenía `box-shadow:0 0 7px` (glow) → ahora línea nítida de 1px sin glow (era lo único con blur en el timeline; verificado boxShadow:none).
- [x] **(2) Zoom out casi infinito**: clamp mínimo de `pxPerSec` 8→**0.1** (los 3 sitios: `tlZoomAt`, `#tlZoomIn/Out`) + pasos de grilla ampliados a 600/1200/1800/3600s → una película de 63min (3795s) cabe en ~380px.
- [x] **(3) Composición desde un pedazo de clip**: clic derecho en un clip (no audio/secuencia) → **"Crear composición desde el clip…"** abre el modal compose pre-seleccionando ESE medio; al crear, `createComposition` con `opts._scope={inP,dur,start,speed}` → la nest dura SOLO lo del clip cortado, los clips internos usan el `inP` del corte, y se coloca en una **PISTA NUEVA** en el inicio del clip (como media independiente). Verificado: lane+1, nestDur=3, innerInP=2, en pista top, start=5, fulldome.
- [x] **(4) Import de secuencias PNG con fps** — YA existía y funciona: seleccionar ≥3 imágenes numeradas juntas → `importFiles` las agrupa → `askSeqFps` (presets 12/24/25/30/50/60) → `addSequence` crea media `kind:'sequence'` que se comporta como vídeo (dur=frames/fps). El menú Media "Importar secuencia…" abre el selector (multi, auto-detecta). Verificado por inspección + rondas previas.
- [x] **(5) Abrir carpeta tras exportar**: IPC nuevo `dsp:revealPath` (shell.showItemInFolder / openPath), `DSP.revealPath`. `doExport` captura `expOut` en cada escritura exitosa (still/PNG-seq/MP4 stream/MP4 mem) y al terminar (no cancelado) ofrece `appConfirm("¿Abrir la carpeta?")`. Verificado IPC presente.

## ROUND 81 — Clips LOOPEABLES estilo Ableton (user): toggle "Loopeable" por clip (inspector + menú contextual) → el clip se puede estirar por el borde derecho INFINITAMENTE y el contenido se repite; ticks sutiles + ↻ marcan cada frontera de loop. `srcT(c,t)` envuelve en `[inP, inP+loopLen)` (loopLen = segmento fuente capturado al activar) → vídeo/secuencia/nest/audioreactivo/scrub/export/render-ahead repiten automáticamente; el re-sync de playback (ploop L2368) reengancha el `<video>` al envolver. `trimR`/`trimItem` omiten el clamp de fuente si `c.loop`. Audio loopea vía `AudioBufferSourceNode.loop`+loopStart/loopEnd en playback y en el export mix (stop() acota el span wall-clock). Desactivar recorta `dur` de vuelta a la fuente. `c.loop`/`c.loopLen` serializan y se duplican solos. Verificado CDP: wrap t5→1/t9→1, ciclo respeta speed (×2→2s), evento de audio con loopLen, serialize, off-clamp. Deploy A+B 3081855.

## ROUND 80c — Arrastre MULTI-selección entre pistas (user): mover y Ctrl-copiar 2+ clips ahora cambia de pista con **desplazamiento RELATIVO** (estilo Premiere: el ancla sigue al cursor, cada clip conserva su offset de pista; `drag._laneDelta`), validado por clip (la pista destino debe existir y ser del mismo tipo — si algún destino es inválido, no hay desplazamiento). Fantasmas dibujados en las pistas desplazadas. Verificado CDP: copy → copias en pistas +1 relativas ✓, move ✓. Deploy A+B 3077393.

## ROUND 80b — El botón Snap ahora gates SOLO la grilla (user): el snap a bordes de clips/playhead/marcadores queda SIEMPRE activo (`applySnap` sin early-out; los call sites de timesel/razor quitan el gate `state.tl.snap`; Alt sigue anulando todo). Verificado: snap OFF → borde 10.03→10 ✓, grilla 3.03 no snapea ✓; ON → grilla vuelve ✓. Deploy A+B 3076485.

## ROUND 80 — COMPLETADO Y VERIFICADO (CDP: mapping 2×→srcT ok, rate en eventos audio, 0 clip+rango con split triple y medio disabled, paste con fx-id remapeado y kf 'fx:id:*' remapeadas, snap del borde FINAL gana a la grilla). `srcT(c,t)` reemplaza el mapeo inP en 11 sitios (drawClip/sequence/nest/render-ahead/collect/reactivo); `playbackRate` en play() + startAudio + exportAudioMix; disabled se salta en compositeClips/collectAudioEvents/audioLevelAt y se atenúa (opacity .35); menú del clip gana Velocidad…/Desactivar (0)/Copiar-Pegar atributos; trimR clamp = resto de fuente ÷ speed. Deploy A+B 3076414. (Especificación original debajo.)
- [ ] **R80-1 Velocidad por clip**: clic derecho en clip → "Velocidad…" (presets 25/50/75/100/150/200/400% + custom vía appPrompt). `c.speed` (default 1). El mapeo de tiempo fuente = `(t-c.start)*c.speed+inP` en TODOS los sitios que calculan `local` (drawClip/collectDrawnVideoClips/vinstSeek/seekMedia/export); audio: `playbackRate` en los BufferSource + export audio mix; clamp de trim a `srcDur/speed`. La duración del clip NO cambia sola (el usuario recorta).
- [ ] **R80-2 Silenciar sección estilo Ableton (tecla 0)**: con selección de tiempo (`state.selA/selB` del insert/range) sobre clips → split en los bordes de la selección y `c.disabled=true` en la parte central; sin selección → toggle `disabled` del clip seleccionado. Otro 0 = reactivar. Disabled: no se compone (skip en composite/collect), no suena (skip audio), se dibuja atenuado (opacity .35 + título tachado o similar monocromo). Serializa (ride via serClip). Undo ok (pushUndo).
- [ ] **R80-3 Copiar/pegar atributos**: menú contextual del clip → "Copiar atributos" (guarda deep-copy de props/fx/kf/_arAuto/anim del clip, sin id) y "Pegar atributos" (aplica a TODOS los selIds; regenerar ids de fx con uid() y remapear las keys 'fx:<id>:' en kf/_arAuto; pushUndo; refresh paneles).
- [ ] **R80-4 Snap entre clips (estilo Premiere)**: al arrastrar/trimear un clip, snapea (umbral ~8px) a bordes (start/end) de clips de CUALQUIER pista, al playhead y a marcadores — activo cuando el snap está ON, complementando la grilla (la grilla ya existe). Reunir candidatos una vez al iniciar el drag; mostrar la snapline existente (`#snapline`).
- Al terminar: npm run dist → verificar por CDP (speed mapping, 0-toggle con split, paste multi-clip, snap con candidatos) → deploy A+B → PLAN/memoria.

## ROUND 79c — SALVAVIDAS anticaídas (user: "integra un salvavidas para que no se caiga")
- [x] **Main:** `render-process-gone` → diálogo + `webContents.reload()` (un renderer muerto nunca tumba la sesión; el autosave a disco + la oferta de recuperación restauran ≤15s de trabajo); `unresponsive` → diálogo Esperar/Recargar. **Renderer:** `window error`/`unhandledrejection` → **autosave de emergencia inmediato** (throttle 5s) + diag. Verificado por CDP: error no capturado → autosave1 reescrito al instante, app viva.

## ROUND 79b — El proxy "completo" del clip 913Mbps salía CONGELADO (user) → detector + rescate
- [x] Causa raíz confirmada por ffprobe: `222222.mp4` = H.264 High **L5.2 a 913Mbps** (el nivel permite ~240) → el decodificador de Chromium no produce frames nuevos pasado ~2s NI en seek (seeks resuelven instantáneos con el último frame → proxy rápido pero congelado). **Detector de frames congelados** en la pasada de seeks de `makeProxy`: hash de 4×4 píxeles 1 de cada 8 frames (getImageData POR FRAME fuerza flush síncrono ≈15× más lento — muestrear); si >85% idénticos → aborta, trunca el caché a 0 bytes (no se re-enlaza) y `appAlert` explica que la FUENTE está fuera de rango y hay que recodificarla. OJO: según el estado del decoder los seeks a veces SÍ decodifican (lento ~6fps → proxy correcto en minutos) — ambos caminos aceptables.
- [x] **Clip del usuario RESCATADO**: `ffmpeg -c:v h264_nvenc -b:v 80M` → `222222_edit.mp4` (84Mbps, mismo 4K60) — verificado en la app: proxy sano con movimiento real (4/4 frames distintos muestreados del proxy). Regla práctica: capturas >~200Mbps deben recodificarse antes de editar.

## ROUND 79 — Blindaje pre-película (user: "mañana edito una película de 1h y no puede fallar") + 2 bugs reales del clip 4K del usuario
- [x] **AUTOSAVE A DISCO** (antes: localStorage cuota ~10MB — un proyecto de película lo supera y el código viejo hasta BORRABA el autosave anterior al fallar): cada 15s, fidelidad completa, **2 archivos alternantes** (`<proyecto>.rdome.autosave1/2`, o `userData/autosave/unsaved.rdome.*` antes del primer guardado) — un crash a mitad de escritura nunca destruye la única copia buena. localStorage queda como vía secundaria. Se salta cuando no hay cambios.
- [x] **Recuperación**: "Restaurar último autoguardado" lee la copia de disco más nueva parseable (torn write → prueba la siguiente); **al abrir un proyecto cuyo autosave es >2s más nuevo que el archivo** (crash sin guardar) → diálogo ofrece restaurarlo (`maybeOfferAutosave`). **`.bak` rotado en cada guardado manual.** **Undo con tope de bytes** (250MB además del tope de 80). Verificado todo por CDP (alternancia, restore, oferta, bak, contabilidad).
- [x] **BUG (user): proxy clavado en 6% con su clip 4K** (`222222.mp4`, 3840×2160@60, **850Mbps**, 2,77GB/26s): el reloj del `<video>` CORRE hasta el final en ~2s (observado: currentTime 1→26.09/ended, solo ~91 frames entregados) → el capturador rVFC esperaba frames que nunca llegan. Fix en `makeProxy`: listener `ended`→bail, **watchdog de progreso** (4s sin avanzar → bail), y el resto de frames se completa con **seeks acotados por frame** (race 1,5s; 5 timeouts seguidos → deja de seekear y rellena — el proxy SIEMPRE termina). El viejo "pad con duplicados" eliminado; la rama else de seek unificada en la pasada final. **Verificado con el archivo exacto del usuario: de 6% eterno → proxy completo en <10s** (38,9MB junto al clip).
- [x] **BUG (user): "el editor se vuelve loco tras exportar"** — 2 agujeros: (1) el early-return del export (cancelar el diálogo de guardado) reseteaba `exporting` pero **dejaba `_exportQuality=true`** (visor enganchado a originales pesados) y sin restaurar `nestSize`/vinst → limpieza completa clonada de la ruta normal; (2) exportar **sin pausar el transporte** → el rAF de reproducción y el seeker del export peleaban por los elementos de vídeo → `pause()` al inicio de `doExport`. Además el proxy 4K colgado seguía reproduciendo el original de 850Mbps en background para siempre (saturando el decodificador) — el watchdog lo corta.

## ROUND 78b — Proxies JUNTO AL CLIP (user: "¿los proxies en la misma ubicación que cada clip?")
- [x] **Ubicación preferida del proxy = la carpeta del clip fuente**: `<stem>.dsp-proxy-<hash(path|fsize)>.mp4` (el hash auto-invalida si el archivo fuente se reemplaza; el proxy viaja con el disco/carpeta de medios). Orden de búsqueda Y de escritura: **junto al clip → caché central `userData/proxies` → en-memoria** (`proxyCandidates`; el central cubre carpetas de solo lectura/red y conserva los proxies ya generados — verificado que `2.mp4` reutiliza su proxy central en 0,12s sin crear archivo local). Importar un `.dsp-proxy-*.mp4` directamente lo enlaza como su propio proxy (sin proxy-de-proxy).
- [x] Verificado en el `.exe`: copia fresca → proxy generado JUNTO al clip (`dsp-test-copy.dsp-proxy-11i1hz6.mp4`, 22,75MB, `m.proxyPath` apunta al local) · compat central ✓ · guard self-proxy ✓.

## ROUND 78 — Proxies PERSISTENTES a disco (user: "¿funcionará un clip de 30GB?" → sí con esto)
- [x] **El proxy ya no vive en RAM ni se regenera cada sesión.** Antes: MP4 del proxy muxeado en memoria (`ArrayBufferTarget`, ~12Mbps × duración → un clip de 60 min ≈ 5,4GB en RAM = riesgo real de OOM) y `loadProject` lo regeneraba desde cero en cada apertura (≈ duración real del clip). Ahora: **`Mp4Muxer.StreamTarget` → escritura posicional en streaming a disco** (`dsp:fileOpen/fileWriteAt/fileClose`, la IO del export PNG; `fastStart:false`) en un **caché global persistente** `userData/proxies/px_<hash(path|fsize)>_960.mp4` (IPC nuevo `dsp:proxyDir`). RAM plana con cualquier duración.
- [x] **Reutilización automática:** `makeProxy` comprueba el caché ANTES de crear nada — si el archivo existe se enlaza directo (`bindProxyFile`, URL file://); la carga de metadata hace de **verificación de integridad** (un parcial de una sesión matada no tiene moov → error → se regenera). La clave se recomputa de `path|fsize` → sin cambios de formato de proyecto; cualquier proyecto que use el mismo archivo fuente comparte proxy. "Regenerar proxy" fuerza sobrescritura (`_proxyForce`). Fallback al modo en-memoria para navegador / medios sin ruta / fallo de apertura. Fd huérfano cerrado si la generación falla a medias (`m._pfid` + catch de `pumpProxy`).
- [x] **Verificado en el `.exe`:** generación 17,9s → caché de 22,75MB en disco, `proxyUrl` file://; segunda importación del mismo archivo **0,13s sin re-encode**; **relanzando la app (proceso nuevo): 0,2s** — persistencia entre sesiones real. (De paso: `1.mp4`/`video.mp4` de Downloads NO son códecs soportados — código 4; `2.mp4` sí. El acceso file:// funciona.)
- [x] Nota 30GB: el archivo fuente se reproduce en streaming (no se carga en RAM); códecs soportados = H.264/HEVC/VP9/AV1 (ProRes/DNxHD no — Chromium); la generación del proxy sigue siendo ≈1× la duración del clip (una sola vez en la vida del archivo). Pendiente futuro: botón "Vaciar caché de proxies" (el caché crece sin límite) y quizá generación >1× vía WebCodecs decode directo.

## ROUND 77 — Piezas largas (75 min) sin congelar la UI + NDI 4K@60 (user: "arregla lo que hay que arreglar; prioridad análisis de piezas largas")
- [x] **`computeBands` apto para 75 min:** (1) las bandas se procesan **secuencialmente** (render 16kHz → envolvente → soltar) — antes retenía los 3 renders a la vez (75 min ≈ 288MB cada uno ≈ ~860MB de pico); ahora pico = 1 render. (2) **`env()` troceada** (~4M samples por rebanada con yield `setTimeout(0)`) → el hilo principal nunca se bloquea más de unas decenas de ms. (3) **Progreso visible** ("Analizando bandas de audio… n/3") solo para pistas >2 min.
- [x] **`computeWave` (picos del waveform al IMPORTAR) ahora async + troceada** (~8M samples por rebanada): un WAV de 75 min son ~216M samples y la pasada síncrona congelaba la UI ~1-2s en el import. Call sites actualizados (import + relink de proyecto). Archivos cortos = una sola rebanada, sin cambio de latencia.
- [x] **NDI input 4K@60 (dejado para el final a petición del usuario):** el addon gana **hilo de captura en background por receptor** (`RecvCtx`: std::thread bloqueado en `recv_capture_v3(100ms)` + swizzle [B,A,R,G]→RGBA **y flip vertical** en el hilo + doble búfer con mutex y contador `gen`; `staging.swap(buf)` recicla el almacenamiento sin realloc). `recvRead(name,lastGen,dst?)` en el hilo JS = solo un memcpy del frame más nuevo (null si `gen` no cambió → poll barato sin copias). El flip en el hilo permite subir con `UNPACK_FLIP_Y_WEBGL=false` — la ruta de flip de Chrome copiaba el frame 4K entero en CPU (**27ms→11ms por subida, medido**). Miniatura des-flipada con transform del canvas.
- [x] **VERIFICADO con emisor 4K@60 EXTERNO** (proceso Node aparte con el mismo addon — N-API es ABI-estable — barra en movimiento para esquivar el throttling de frames estáticos de NDI): **el hilo recibe los 60fps completos (59.9 medido)**; visibles ~21fps a 3840×2160 (limitado por el clon de 33MB del contextBridge por frame) y **60fps a 2048² e inferiores**. Antes: 4-14fps con stalls en el hilo principal; ahora la recepción+swizzle no toca el hilo de render.
- [x] **Intento SAB cero-copia — descartado con hallazgo:** `main.js` habilita el feature flag `SharedArrayBuffer` (NO es flag de GPU — seguro en híbridas) y `typeof SharedArrayBuffer!=='undefined'` en la página ✓, pero **el contextBridge de Electron RECHAZA SABs** («An object could not be cloned» — usa un serializador propio con lista blanca de tipos, no el structured clone estándar). El código mantiene la ruta SAB con fallback automático (`_ndiSabMode`) + guard en el preload (si un futuro Electron clonara el SAB en vez de rechazarlo, se detecta `buffer instanceof SharedArrayBuffer` y se evita mostrar frames negros). **Siguiente paso para 60fps visibles a 4K (R78, pendiente): `window.postMessage` entre mundos con ArrayBuffer transferable** (el preload bombea del addon y transfiere el buffer a la página con coste cero — el postMessage entre isolated/main world usa el clone real de blink, que sí soporta transferables).
- [x] `RecvStats` reescrito vía `gen` (nunca dos hilos en recv_capture); `recvClose/recvCloseAll` paran+join el hilo antes de destruir. **GOTCHA de build descubierto:** la dep `file:native/ndi-send` queda COPIADA en `node_modules/dsp-ndi-send` — editar `native/ndi-send/ndi.cc` no llega al `.exe` (rebuild compila la copia vieja, sin error alguno); hay que borrar `node_modules\dsp-ndi-send`, re-copiar desde `native\` y `npm run dist`.

## ROUND 76 — Audioreactivo nivel pro (TouchDesigner/Resolume) — motor + shaping + 9 FX nuevos (user: "efectos audioreactivos brutales")
- [x] **Motor de análisis v2** (`computeBands`, formato `v:2`): además de las envolventes RMS bass/mid/treble → (1) **banda `bright`** (proxy de brillo espectral: proporción de energía de agudos, calculada antes de normalizar); (2) **onsets por banda vía spectral flux** (derivada rectificada de la envolvente + umbral adaptativo media+1.4σ con prefix sums O(N) + peak-picking con separación mínima 120/90/50ms) → disparadores independientes estilo kick/snare/hat; (3) **BPM por autocorrelación** (slice central ≤150s por coste, plegado a 70-180) + **fase de beat** (`beat0` = offset de rejilla mejor alineado a los onsets, reducido a ancla de fase); (4) beats globales = onsets del flux combinado (bass×2+mid+treble×0.8) con fallback al detector viejo.
- [x] **Shaping de modulación POR EFECTO** (todo determinista/time-addressed → export idéntico): `arRecompute` ahora cachea las bandas **crudas** (solo gate+gain) + las suavizadas con A/R global (medidor/compat). Por efecto: **Attack/Release propios** (fx.atk/rel, semilla = valores del motor al crear; envolvente por-fx horneada en `_fxEnvCache` con firma banda|atk|rel|spring), **Curve** (exponente 0.25×..4× de respuesta, 50=lineal), **INV** (invertir), **Bounce/spring** (muelle subamortiguado ζ=0.28 estilo Lag CHOP de TD, integrado a 2 substeps → rebote orgánico con overshoot, horneado en el array). **Trigger** ahora usa los **onsets de la banda elegida** (antes: beats globales de energía) con rampa de ataque + release exponencial analíticos. **Modo LFO nuevo**: sine/tri/saw/square/**S&H aleatorio determinista**, sincronizado por fase al BPM detectado (o manual) vía `beat0`, divisiones 4/2/1 compases · 1/2 · 1/4 · 1/8 · 1/16. `FX_META` (atk/rel/curve/spring) viven en el objeto fx (serializan solos), NO son parámetros de shader ni automatables.
- [x] **9 efectos nuevos:** **Bloom/Glow** (multi-paso custom `FX_APPLY`: bright-pass con soft-knee → gaussiana separable 2 rondas H/V a media resolución → composición screen con alpha extendido al halo — EL look pro), **Noise Warp** (displace fbm 3 octavas, distorsión líquida), **Feedback Flow** (zoom+rotación+**hue-rotate**+warp senoidal DENTRO del bucle de feedback → túneles psicodélicos TD), **Chroma Pulse** (aberración cromática radial + respiración del centro; centro por defecto = cénit), **Flash** (blanco/negro/invertir), y categoría **DOME** (uv centro = cénit del máster 1:1; usar en capa de ajuste para barridos full-dome): **Dome Rings** (anillos concéntricos viajando desde el cénit), **Spiral Twist** (torsión azimutal ∝ radio), **Tunnel** (remapeo radial con wrap espejado → vuelo sin costuras).
- [x] **UX:** tarjeta de efecto con selects Banda (+ Bright)/Modo (+ LFO)/forma+división LFO, botón INV, faders Attack/Release/Curve/Bounce, y **lámpara de señal en vivo** en la cabecera (muestra exactamente lo que "siente" cada efecto). Motor: fila **BPM** (auto detectado / clic → manual, 0=auto), medidor a **4 bandas** (+BRT) con **flash de onset** en el tope de cada banda y **punto parpadeante sincronizado a la rejilla de beat**. Menú de efectos gana la sección Dome.
- [x] Compat: proyectos viejos → fx sin campos nuevos usan los valores del motor en eval; `snapshot/restore/newProject/loadProject` limpian `_fxEnvCache`; bloom sin frag tolerado por el loop de compilación (custom apply); `freeFxResources` libera los RT de bloom.
- [x] **AUDITORÍA post-ronda (a petición del usuario), todo verificado por CDP en el `.exe`:** ✔ BPM 120 exacto en buffer sintético; ✔ undo NO congela la reactividad (restore→renderInspector recomputa); ✔ save/load v4 incluye `reactive` + campos meta de los fx (serMedia→serClip JSON profundo); ✔ cambiar Gain/Gate del motor invalida las envolventes por-fx; ✔ LFO funciona sin fuente de audio (BPM manual/120); ✔ visual: bloom produce halo real (px 18 vs 0, alpha extendido fuera de la silueta), rings modulan 29 columnas, tunnel desplaza, warp mueve 42px, flash blanquea, 0 errores GL; ✔ carril de automatización AR con efectos nuevos (5 params en bloom); ✔ tarjeta LFO oculta atk/rel/spring y deshabilita banda; ✔ `computeBands` ≈72ms por minuto de audio (75min ≈ 5-6s async, aceptable con aviso de estado). **2 bugs encontrados y corregidos:** (1) **thrash del caché de envolventes** — split/duplicate conservan `fx.id` → dos fx con mismo id y shaping distinto se pisaban la entrada (keyed por id) recomputando el array entero cada frame (con audio de 75min ≈ ms/llamada); fix: clave = `id+firma(banda|atk|rel|spring)` → coexisten, con tope 128 entradas + clear (drags de fader no acumulan memoria); los `delete(fx.id)` obsoletos eliminados (la firma en la clave hace innecesaria la invalidación). (2) **default de Attack en Trigger** incoherente: eval usaba 2ms pero el panel muestra el default del motor (8ms) para fx de proyectos viejos; alineado a `cfg.attack`.

## ROUND 75 — Arreglos de timeline (user) + fix de conexión NDI (TouchDesigner)
- [x] **La región de loop (`#workArea`) ahora abarca TODAS las pistas.** Antes su CSS `top:0;bottom:0` daba solo la altura del viewport (el contenedor `#tlscroll` con scroll), así que con más pistas de las que caben se cortaba. `renderWork` ahora fija `height = 22 + tracks.offsetHeight` (regla + todas las pistas), igual que el playhead. Además el handler de `scroll` de `#tlscroll` re-llama `renderWork()`+`renderTimeSel()` (seguro por si cambia la altura). Verificado con captura tras scroll al fondo: los bordes blancos del loop abarcan las 3 pistas visibles (V3/V2/V1). (El sondeo inicial confundía con una selección `#timeSel` residual — es de pointer-events:none, no sale en elementsFromPoint.)
- [x] **La barra de tiempo (regla) ya no queda tapada por las cabeceras de pista al hacer scroll.** El `.rulerpad` (esquina izquierda de la barra de tiempo, en `#trackHdr`) no tenía z-index, así que el `#laneHeaders` (que se desplaza con `translateY`) lo pintaba por encima. Fix: `.rulerpad{position:relative;z-index:2}` → se mantiene por encima.
- [x] **FIX de conexión NDI (crítico para TouchDesigner):** `recvOpen` conectaba solo por nombre → NDI re-resolvía la dirección y **fallaba con TouchDesigner** (`connections:0`, 0 frames), aunque el Test Pattern sí conectaba. Ahora busca la fuente completa en el finder persistente y conecta con su **`url_address`** directo. Verificado: TD pasó de 0 frames a **149 video/2.5s a 3840×2160**. (También se revirtió el timeout de 20ms del `recvRead` que se había probado — el fix real era el url_address.) **Pendiente:** TD envía **4K@60** y la tubería (copia swizzle + clon del contextBridge + subida GPU de 33MB/frame) va a ~4-14fps → optimización de rendimiento 4K queda para una ronda futura (SharedArrayBuffer no disponible: `crossOriginIsolated=false`; requeriría hilo de recepción en el addon + cabeceras COOP/COEP).
- [x] Verificado en el `.exe` (CDP): loop abarca las 5 pistas (982px = 22+960), `.rulerpad` z-index 2/relative, playhead sin regresión. Deployado a ambas instalaciones, 3029789 bytes.

## ROUND 74b — Entrada NDI a 60fps fluidos (user: "funciona pero no corre a 60fps")
- [x] **Causa:** el receptor entregaba de sobra (medido: 61 frames/s de una fuente 60fps en movimiento; el Test Pattern estático NDI lo throttlea a ~1fps, por eso engañaba), pero el pump hacía `recvRead`+`render` juntos en un `setInterval(16ms)` → (a) 16ms vs 16.67ms del frame = **aliasing** que salta frames, (b) render no alineado a vsync → judder.
- [x] **Fixes:** (1) swizzle [B,A,R,G]→RGBA como **rotación de 16 bits de la palabra de 32 bits** por píxel (auto-vectorizable, ~4× más rápido que byte-a-byte). (2) `ndiUpload` usa **`texSubImage2D`** (reusa el almacenamiento de la textura; sin realloc por frame). (3) el pump ahora **desacopla** recepción de dibujo: `setInterval(8ms, ~120Hz)` solo recibe+sube (inmune al throttle de rAF por `backgroundThrottling:false`) y marca `_ndiDirty`; **el render lo dispara un bucle `requestAnimationFrame` alineado a vsync** → 60fps limpios sin beat. Solo redibuja si hay un clip NDI en pantalla y no se está reproduciendo (durante play, el loop de reproducción ya dibuja).
- [x] Verificado en el `.exe` con una fuente 60fps en movimiento: **uploads 61/s, renders 57/s** (~60fps, antes había judder). Coste por frame: upload 2.85ms, render 0.5ms. Deployado a ambas instalaciones, 3029476 bytes.

## ROUND 74 — Entrada NDI: una fuente de red en vivo como medio → arrastrar al timeline (user)
- [x] **Fuente NDI en vivo como MEDIO** (`kind:'ndi'`): clic-derecho en Media → **"Añadir fuente NDI…"** escanea la red (`findSources`) y muestra un menú con las fuentes; al elegir una se crea un medio `NDI · <nombre>` con indicador **"en vivo"**. Se **arrastra al timeline como cualquier clip** y muestra el **frame actual de la fuente en tiempo real**, esté donde esté el playhead. Miniatura en vivo en el panel (actualizada ~1/s).
- [x] **Pipeline:** el addon nativo gana receptor: `findSources` (**finder PERSISTENTE** — acumula fuentes locales+red en background; un finder efímero por llamada solo veía las always-on), `recvOpen/recvRead/recvClose/recvCloseAll`. `recvRead` **drena la cola al frame más nuevo** (baja latencia) y devuelve RGBA empaquetado. En el renderer, `ndiPump` (**`setInterval` 16ms**, NO rAF — rAF se throttlea cuando la ventana no tiene foco; `backgroundThrottling:false` mantiene los timers) lee cada fuente, sube el buffer a la textura del medio con `upTexRaw` (RGBA crudo con FLIP_Y), y re-renderiza si hay un clip NDI en pantalla. `drawClip` usa `m.tex` sin cambios (rama `else` genérica).
- [x] **FIX de orden de canales (crítico para color):** `NDIlib_recv_color_format_RGBX_RGBA` entrega los bytes como **[B,A,R,G]** en NDI 6 (verificado con DOS fuentes independientes: mi emisor + el **NDI Test Pattern oficial**, ambas llegaban permutadas). El addon reordena a RGBA real en el copiado (`dp[0]=sp[2];dp[1]=sp[3];dp[2]=sp[0];dp[3]=sp[1]`). **La salida NDI (ROUND 73) NO tenía este problema** — su test era en escala de grises, que no detecta swaps de canal; su envío RGBA es correcto.
- [x] Serialización: `serMedia` guarda `ndiSource`; al cargar se recrea la textura y se reabre el receptor (`recvOpen`) + arranca el pump. `reloadMedia` salta los `ndi` (no hay archivo). `newProject`/`loadProject`/beforeunload → `closeAllNdi()`. Borrar el medio → `closeNdiMedia` (cierra el receptor si ninguna otra referencia lo usa). Trim libre (sin límite de fuente, como una imagen).
- [x] **Verificado end-to-end en el `.exe` empaquetado (CDP):** descubrimiento (vio "Test Pattern" y hasta un "Adobe Premiere Pro" en otra máquina de la red), medio creado, arrastre al timeline, **recepción en vivo 1920×1080**, y **colores correctos** — las 7 barras SMPTE muestreadas de la textura del clip decodifican a RGBA correcto (rojo=R-dominante, azul=B-dominante). Screenshot confirmó las barras de color en el domo. Deployado a AMBAS instalaciones, 3028649 bytes + `.node` desempaquetado.

## ROUND 73 — Salida NDI del máster Domo 1:1 (2048 / 4096), botón junto al pop-out (user)
- [x] **Botón NDI (`#ndiBtn`, icono `ndi`) junto al de ventana emergente**, en la barra del viewport. Abre un menú: **"Máster Domo 1:1 · 2048×2048"** / **"4096×4096"** (toggle on/off, ✓ en el activo) + "Detener salida NDI". Solo-escritorio (oculto si no hay `window.dsp.ndi`).
- [x] **La salida NDI es SOLO el máster Domo 1:1 limpio, sin grilla ni overlays.** `ndiTick` compone el fulldome (`composite(playhead, res, true)`, `_drawFlat=false`) en un **FBO propio** (`_ndiFBO/_ndiTex` a `res×res`), hace `readPixels` RGBA, y lo envía por el addon nativo con **stride negativo** (flip-Y sin copia: el buffer WebGL es bottom-up → NDI top-down). 2048 a hasta 60fps (fps del proyecto), 4096 a 30fps. La grilla/overlays viven en el canvas 2D `gridc`, aparte → nunca entran al máster.
- [x] **Addon nativo N-API propio** (`native/ndi-send/`, dep `file:` en `package.json`): `ndi.cc` + `binding.gyp` + headers del NDI 6 SDK **vendorizados** (`include/`). Carga el runtime NDI **dinámicamente** vía `LoadLibrary` de `Processing.NDI.Lib.x64.dll` hallada por la env var `NDI_RUNTIME_DIR_V6` (sin linkear el `.lib` → build sin SDK, y **degrada con gracia** si el runtime no está: el menú ofrece abrir la página de descarga). API: `available/runtimeUrl/start/sendFrame(buffer,w,h,flipY)/connections/stop/probe`. Fuente `RGBA` (FourCC), nombre "Dome Studio Pro — Master". N-API = ABI estable → el mismo `.node` sirve para Node y Electron.
- [x] **Arquitectura del pipeline:** el envío ocurre en el **preload** (tiene Node), expuesto como `DSP.ndi.*` por contextBridge → los frames se leen de la GPU y se envían DESDE el renderer, sin IPC de frames a main. `send_send_video_v2` síncrono (el buffer es válido durante la llamada), `clock_video=false` (marcamos el ritmo con un `setInterval`).
- [x] **Empaquetado:** `@electron/rebuild` (que ya corría en `electron-builder`) recompila el addon para Electron 42; `files` incluye `node_modules/dsp-ndi-send/{index.js,package.json,build/Release/*.node}` y **`asarUnpack`** el `.node` (los `.node` no cargan desde dentro del asar). **NUEVO gotcha de deploy: hay que copiar `app.asar` Y `app.asar.unpacked/` a cada instalación** (antes solo el asar).
- [x] **Verificado de extremo a extremo en el `.exe` empaquetado (CDP + receptor NDI externo):** addon cargado (`available:true`, sin loadError), botón visible, `startNDI(2048)` → `_ndiOn`, frames avanzando; un **proceso receptor SEPARADO** encontró la fuente "Dome Studio Pro" y **recibió frames reales a 2048×2048 Y a 4096×4096 (FourCC RGBA)**. **Orientación verificada** (gradiente conocido: image-top blanco → `topLuma` 254 arriba, `botLuma` abajo → derecho, no invertido). El flip por stride negativo es correcto.
- [x] Deployado a **AMBAS** instalaciones (LOCALAPPDATA + Program Files) — asar 3021830 bytes + `.node` desempaquetado en las dos. Install B verificado: addon carga (`available:true`), botón + funciones presentes. (Helper `deploy-ndi-to-programfiles.ps1` en el repo para futuros deploys elevados.)
- [x] Entorno confirmado: NDI 6 Runtime + SDK + Tools instalados, VS 2022 C++, Python 3.12, Node 25. Requisito de máquina de destino: el **runtime NDI gratuito** (ndi.video); si falta, el botón ofrece descargarlo.

## ROUND 72 — Scrub en números, rename inline de localizadores, import por clic-derecho + fps de secuencias PNG (user)
- [x] **Arrastrar sube/baja CUALQUIER `<input type=number>`** (diálogos, inspector de grupo, etc.), igual que los faders del inspector. Handler global capturante: arrastre horizontal cambia el valor (`Math.round(dx/3)*step`, Shift = fino ¼, Alt = grueso ×5, respeta min/max/step), un clic simple sigue enfocando para escribir. Cursor `ew-resize` (→ `text` al enfocar). Dispara `input`+`change` para que los `oninput`/`onchange` existentes reaccionen. Verificado: #cN 6→22 al arrastrar derecha, baja a la izquierda, clampa al mínimo, clic simple no cambia.
- [x] **Rename de localizador INLINE, sobre su propio texto en la regla** (no en un rectángulo/diálogo flotante): `renameLocatorInline(mk)` coloca un `<input>` `position:fixed` en la posición del label del localizador en la regla (`rr.left + mk.time*pps + 11`), commit con Enter/blur, Esc cancela. Reemplaza los 3 `appPrompt` (doble-clic en la regla, Ctrl+R, menú contextual). Verificado: el input aparece sobre la regla (no overlay modal), Enter renombra.
- [x] **Clic-derecho en el área de Media → menú Import** ("Importar medios…" / "Importar secuencia de imágenes…" / "Nueva carpeta"). Handler `contextmenu` en `#mediaList` (los ítems y cabeceras de carpeta conservan su propio menú).
- [x] **Import de secuencias PNG como vídeo con fps elegible**: las secuencias numeradas (`nombre####.png`, ≥3 frames) ya se detectaban y se importaban como clip `kind:'sequence'` (se comporta como vídeo); ahora, al detectarse, aparece el diálogo **"Import image sequence"** mostrando nº de secuencias/frames y un selector de **fps** (campo numérico + presets 12/24/25/30/50/60, default = fps del proyecto). `addSequence(files,name,fps)` usa el fps elegido (`dur=frames/fps`). Verificado: diálogo con presets que resaltan, fps=30 aplicado → clip secuencia de 5 frames, dur 5/30, kind sequence.
- [x] Verificación CDP en el `.exe`: 20/20 PASS. Deployado a ambas instalaciones, 2599211 bytes.

## ROUND 71 — Arreglos rápidos: densidad del Compose, carpetas de Media, marcadores de automatización, grilla del visor (user)
- [x] **Menú Compose sigue la guía de densidad**: inputs `19px` alto / `10.5px` fuente (antes 22px/11px); **checkboxes monocromos compactos** (`.modal input[type=checkbox]` `appearance:none`, caja 13px con check — antes se estiraban a 37px porque `.frow input{flex:1}` los alargaba; fix `flex:0 0 13px`); **preview más grande** (222px, antes 164px), modal 648px, columna derecha 236px. Verificado: input 19px/10.5px, checkbox 16px, preview 222px.
- [x] **Carpetas de Media funcionando** (antes: "crear carpeta" no hacía nada visible): las carpetas **vacías ahora se renderizan** (antes `grp()` hacía `if(!gi.length)return` → una carpeta nueva era invisible) con una zona **"Arrastra medios aquí"**; se puede **arrastrar un medio sobre la cabecera/zona de la carpeta** para archivarlo (`startMediaDrag` detecta `.folderhdr/.folderdrop` en el `up`, con resaltado `.dragover` al pasar por encima). Cabecera de carpeta con icono, contador, doble-clic para renombrar, botón/menú de eliminar (los medios se conservan). `newFolderBtn` evita nombres duplicados; clic-derecho lista las carpetas. Verificado: carpeta vacía visible + drop-zone, arrastrar archiva, contador actualiza, eliminar desarchiva.
- [x] **Automatización marca los parámetros ya automatizados (estilo Ableton)**: los dropdowns de parámetro de los carriles (`.aselect`, e ídem en Audio-React) anteponen **◆** a los params que ya tienen keyframes; en el inspector, la fila del parámetro automatizado se **resalta** (`.prow.auto .lab` más brillante + negrita). **Bug de paso encontrado y corregido**: `classList.toggle('auto', hasKf(...))` — `hasKf` devuelve `undefined` (no `false`) para params sin animar, y `toggle(x, undefined)` **invierte** en vez de forzar apagado (WebIDL trata `undefined` como "sin argumento force") → TODAS las filas quedaban marcadas; fix con `!!`. Verificado: solo los params con keyframes se marcan.
- [x] **La ventana del visor 3D tiene botón de grilla ON/OFF** (`#vwgrid`, overlay arriba-izquierda dentro de la ventana emergente; `_viewerGrid`, default OFF). `renderViewer` pasa `L3.grid=_viewerGrid?1:0`. Verificado: uniform 0/1 según el flag, el botón lo invierte.
- [x] Verificación CDP en el `.exe`: 17/17 PASS. Deployado a ambas instalaciones, 2593037 bytes.

## ROUND 70 — Revisión integral del sistema de automatización (user: "más robusto, intuitivo y fácil de editar")
_Auditoría multi-agente (5 lentes + 20 verificaciones adversariales, wf_ab2245cf-c2c): 18 bugs confirmados, 2 refutados, ~20 hallazgos UX. Todo lo de valor aplicado y verificado en el `.exe` (27/27 PASS)._

**Robustez (bugs confirmados corregidos):**
- [x] **Split inserta keyframe de frontera en el corte** (`razorCore`): antes filtrar los kf partía el segmento que cruzaba el corte → meseta plana + salto de valor justo en el corte. Ahora se inserta un kf en el corte en AMBAS mitades (valor exacto vía `evalP`); los segmentos **bezier se subdividen con de Casteljau** → forma de curva preservada exacta (desviación medida 6e-6). Los handles se copian en profundidad en `reb` (las mitades ya no comparten objetos hOut/hIn).
- [x] **Canvases de automatización VENTANEADOS al viewport** (`windowAutoCv`/`scheduleAutoCvs`, mismo patrón que el ruler y las ondas de audio): antes los sub-carriles y el overlay eran full-width → morían en silencio pasado el límite de 32767px de Chromium (¡en una peli de 75 min quedaban PERMANENTEMENTE en blanco a cualquier zoom!). Ahora ancho máx ≈ viewport+520px, reposicionados/redibujados al hacer scroll (`cv._ox`). Verificado: maxCvWidth 1360 a zoom 600px/s, `_ox` sigue el scroll.
- [x] **`c.anim` (modificadores de movimiento + wetKf) compartido por referencia** entre un clip y sus copias (split/duplicar/anidar) → editar la velocidad de uno cambiaba el otro (y el undo "arreglaba" el alias → heisenbug). `sepAuto` ahora lo copia en profundidad (arregla los 4 sitios de clonado de una vez).
- [x] **Cronómetro del inspector sin undo**: borrar TODA la curva de un parámetro (o añadir kf con el rombo) no era deshacible. Ahora `pushUndo()` + aviso "Automatización eliminada — Ctrl+Z la restaura" + guard "el cabezal está fuera de este clip" (antes creaba kf clampado a t=0 corrompiendo el primer keyframe, o kf inalcanzables tras el final).
- [x] **`state.autoSel` zombi**: la selección de puntos guardaba referencias vivas que morían tras undo/restore/cambio de secuencia → Delete se tragaba la tecla, empujaba un undo falso y podía caer al borrado del CLIP. Ahora se limpia en `restore`/`loadSeqIntoState`/`deleteSel`, y el handler de Delete valida contra los kf vivos (selección obsoleta → solo se limpia, nunca cae a borrar el clip).
- [x] **Snap de arrastre de puntos doble-contaba el delta** (snapeaba contra el k.t vivo que ya se había movido) → los puntos nunca aterrizaban en la grilla. Ahora snapea contra el tiempo de ORIGEN del drag. Una línea.
- [x] **`commit()` por pointermove hacía rebuild completo del inspector + render GL + doble invalidación** → jank. Ahora `refreshInspector()` (solo valores) + `scheduleGL()` (1 render GL por frame vía rAF) + `markDirty()` una vez.
- [x] **`drawAutoCurve` O(ancho×kf×26)**: el sampleo ahora es solo del slice visible con **caminata incremental de segmentos** (O(SS+n)), y culling de puntos/handles fuera del canvas; hover sin cambios visuales → no redibuja.
- [x] **Tolerancia de merge de `setKf` consciente del frame** (mín(0.02, 0.5/fps)): a 60 fps era imposible crear keyframes en frames adyacentes (se fusionaban).
- [x] **Borrar un Reactive FX purga sus huérfanos** (kf `fx:id:*`, `_autoOff`, `_arAuto`, `_arAutoH`): antes persistían en los guardados y el carril colgante se re-mapeaba EN SILENCIO a otro efecto. Ahora los keys colgantes se eliminan, nunca se remapean.
- [x] **`setAutoOff` congela el valor actual de la curva** antes de anular (como `manualEdit`) → la imagen ya no salta a un valor base obsoleto al pulsar "A".
- [x] **El canvas de automatización ya no se traga las herramientas Razor/Mano/Zoom** sobre el cuerpo del clip: con herramienta ≠ selección los eventos burbujean a `#tracks`.
- [x] Código muerto eliminado/reciclado: `setClipProp` borrado (0 llamadas); `curEase()` ya no lee un `#easeSel` inexistente; `kfAt` revivido (el rombo "añadir kf" del inspector se ilumina cuando el cabezal está sobre un keyframe); comentario "amber" corregido.

**Intuitivo (UX):**
- [x] **Clic en un punto ahora lo SELECCIONA (ya no lo borra)** — el clic-borra con radio de 18px era una trampa destructiva. **Alt+clic = borrar** (gesto rápido), Shift+clic extiende la selección, arrastrar = mover (cursor `move`, no `pointer`), Delete/menú borran. Marquee igual que antes.
- [x] **Menú contextual con easing por punto** (aplicado a la selección si el punto pertenece a ella): Lineal / Suavizar entrada / salida / ambos / **Mantener (hold, por fin alcanzable)** / **Bezier libre** (revive `initBez`). Antes NO existía NINGÚN control de easing en la UI (el dropdown global era una referencia muerta → todo nacía 'both' para siempre).
- [x] **Etiquetas en los carriles**: overlay del clip muestra el NOMBRE del parámetro (cada clip puede mostrar uno distinto — antes no había forma de saber cuál era); sub-carriles muestran escala mín/máx; **punto blanco + valor en el cabezal** en todos los carriles (readout permanente, no solo el tooltip al arrastrar).
- [x] **'+' abre un selector de parámetro** (◆ marca los que ya tienen keyframes; excluye los abiertos) en vez de añadir uno arbitrario.
- [x] **Editor numérico de punto con TIEMPO y valor** (doble clic; el tiempo en segundos absolutos como la regla).
- [x] **Clic en el fondo de un carril = marca de inserción** (modelo ROUND 64 preservado también en modo automatización) además de limpiar la selección.
- [x] Chip compacto en clips estrechos (<150px: sin dropdown) y bajado bajo la banda del título (ya no tapa el agarre de mover). Carriles Audio-React simétricos: botón ↻ re-activar añadido, clamp de resize 48px, tooltip ES completo. Tooltip del cronómetro consciente del estado ("Quitar automatización (borra toda la curva)"). Rombos del kfstrip con tooltip (nombre + tiempo). Menú "Volver al valor por defecto" ya no anuncia un atajo ⌦ falso.
- [x] `attachClipAuto`/`toggleCurves` ya NO mutan `c._auto` al renderizar (el default es de solo lectura) → pintar la vista no ensucia el proyecto ni los undo.

**Fácil de editar (poder):**
- [x] **Copiar/pegar curvas**: menú contextual "Copiar curva" (selección o completa) / "Pegar aquí"; **Ctrl+C** con puntos seleccionados copia la curva; **Ctrl+V** sobre un carril (hover) pega en el cabezal. Pegar entre parámetros de rango distinto **normaliza los valores** (blur 0-20 → opacity 0-100 escala, verificado 10→50).
- [x] **Nudge con teclado de la selección**: ←/→ = paso de grilla (Shift = 1 frame), ↑/↓ = 1% del rango (Shift = 0.1%); **Escape deselecciona**; **Ctrl+A sobre un carril selecciona todos sus puntos** (`state.hoverAuto`).
- [x] **"Simplificar curva"** (Ramer-Douglas-Peucker en espacio de píxeles; conserva siempre puntos hold/bezier) — para curvas densas grabadas del audio-reactivo. Verificado 30→<10 puntos.
- [x] Verificación CDP en el `.exe` real: 27/27 PASS (continuidad de split 50/50, bezier dev 6e-6, anim aislado, kf frames adyacentes, undo del cronómetro, autoSel limpio, canvases acotados+scroll, purga fx, freeze de override, copy/paste/scale/nudge/simplify, clic-selecciona, alt-clic-borra, guard de herramientas). Deployado a ambas instalaciones, 2585657 bytes.

## ROUND 69 — Botón "Adjust" (capa de ajuste) junto a Compose (user)
- [x] **Botón "Adjust" (`#adjLayerBtn`, icono `layers`) junto al botón Compose** en la toolrow del panel de medios (misma clase `.ringbtn` → respeta la guía de diseño; queda a la izquierda de Compose con 5px de gap). Llama a `addAdjustmentLayer()` (que ya existía, sólo estaba en la pestaña Reactive FX): crea una pista `ADJ` arriba del todo + un clip de ajuste seleccionado que aplica su cadena de FX reactivos al composite de **todo lo que tiene debajo** (estilo Premiere). Traducido EN/ES (`Adjust`/`Ajuste`) vía `applyLang`. Nuevo icono `layers` (pila de capas) en el mapa `ICO`.
- [x] Verificado en el `.exe` vía CDP: el botón existe, tiene el icono SVG, misma clase que Compose, misma fila, a la izquierda de Compose, misma línea base (gap 5px, Adjust 71px / Compose 87px); al hacer click añade exactamente **+1 pista + 1 clip**, el clip queda seleccionado con `adjust===true`, la pista superior lleva tag `ADJ`, nombre "Adjustment"; `undo()` revierte pista+clip por completo (snapshot incluye `lanes`). PASS. Deployado a ambas instalaciones, 2566317 bytes.

## ROUND 68 — La ventana emergente del visor 3D no muestra la grilla (user)
- [x] **El visor emergente (pop-out 3D dome) ya no dibuja la grilla de referencia, solo el contenido.** `renderViewer` pasaba `L3.grid = state.view.showGrid?1:0` (espejaba el viewport principal); ahora fuerza `L3.grid = 0` en su pase del domo (`P3`), independiente del ajuste del viewport principal. Un único cambio en [app.js:600](app.js:600).
- [x] Verificado en el `.exe` vía CDP: con la grilla del viewport principal **forzada a ON** (`state.view.showGrid=true`), el visor sigue renderizando contenido del domo (`contentSum` 183M, no-negro) y su pase recibe `grid=0` (uniform capturado). PASS. Deployado a ambas instalaciones (LOCALAPPDATA + Program Files), 2565732 bytes.

## ROUND 67 — La ventana emergente muestra el 3D dome con cámara propia (orbitable) (user)
- [x] **El visor emergente ahora renderiza SOLO el domo 3D con su PROPIA cámara** (`_viewerCam` {yaw,pitch,dist}), independiente del viewport principal (que puede estar en 2D editando). Arrastrar en la ventana = **girar** (orbit), rueda = **zoom** (dist).
- [x] **Implementación:** `cameraMVP` acepta `(spec, camOverride, aspOverride)`. `renderViewer(srcTex)` (llamado al final de `render()` con el `_srcTex` compuesto) renderiza el domo (`P3`) desde `_viewerCam` a un **FBO offscreen al aspecto de la ventana** (con depth renderbuffer), hace `readPixels`, y lo dibuja al canvas del visor con flip-Y (WebGL es bottom-up). Resolución de render capada a 1280px para el readback. Comparte la textura compuesta con el render principal (mismo playhead) → no recomputa el composite. Handlers de orbit/wheel/resize en el canvas del visor llaman `render()` (recalcula _srcTex + redibuja ambos). `closeViewerGL()` libera FBO/tex/renderbuffer al cerrar.
- [x] Verificado en preview (ventana simulada): `cameraMVP` con override da matriz 4×4 válida, el FBO se crea/dimensiona a la ventana, y el canvas del visor recibe **contenido no-negro** (el domo renderizado desde la cámara independiente muestreando el composite gris). Sin errores de consola.

## ROUND 66 — Ventana de visor emergente (segunda pantalla) (user)
- [x] **Botón "Pop-out viewer"** (`#popoutBtn`, icono `popout`, en la barra del viewport junto al zoom) que abre una **ventana nueva, movible y redimensionable, solo con el viewport del domo** — para arrastrarla a la pantalla de al lado (proyector/segundo monitor).
- [x] **Implementación (solo renderer + un handler en main.js):** `openViewerWindow()` hace `window.open('about:blank','domeViewer',...)`, inyecta un `<canvas>` a pantalla completa, y `updateViewerWindow()` (llamado al final de `render()`) copia el canvas GL principal (`glc`) al canvas del visor con letterbox (mantiene el aspecto del domo). Es **parent-driven** → el copiado corre en el loop del editor (con `backgroundThrottling:false`), así el visor va fluido aunque esté en la otra pantalla sin foco. `preserveDrawingBuffer:true` (ya estaba) hace `drawImage(glc)` fiable.
- [x] **`main.js`: `setWindowOpenHandler`** permite explícitamente `frameName==='domeViewer'` como BrowserWindow nativa (960², sin menú, fondo negro, sin throttling) y deniega cualquier otro `window.open`. Verificado en preview: botón + icono, funciones definidas, hook en `render()` sin throw, y la lógica de dibujo/letterbox de `updateViewerWindow` corre OK contra una ventana simulada (el `window.open` real lo bloquea el navegador del preview, pero Electron no tiene bloqueador de pop-ups → funciona en el `.exe`).

## ROUND 65 — Modo Seguir centrado + fixes de la revisión adversarial de ROUND 64 (user + review)
- [x] **Modo Seguir: el playhead queda SIEMPRE al centro y el timeline avanza gradualmente** (antes hacía page-scroll a saltos). `followPlayhead` ahora `scrollLeft = playhead*pps − vw/2`, y **crece el ancho del timeline con `_scrollTarget` (como `tlZoomAt`) antes de scrollear** para no chocar con el scroll infinito. Verificado: playhead en viewport-x 261 (=vw/2) constante, avanza 50px por 0.5s.
- [x] **FIX (review MAJOR):** Ctrl+L / botón Loop tras click en el cuerpo de un clip ya **no borra el bucle**. `loopSelection` solo limpia si `selA==null` (nada seleccionado); una marca de inserción sola avisa "selecciona un rango o clip" sin destruir el loop.
- [x] **FIX (review minor):** `play()` con una inserción fuera de una región de loop activa **la clampa** a `[workIn,workOut]` (antes saltaba fuera y `ploop` la reajustaba con un glitch). Verificado: inserción a 25 con loop 10–20 → play arranca en 10.
- [x] **Aceptado (review, por diseño del nuevo modelo):** los keyframes se crean en el **playhead** (no en la marca de inserción). El playhead se posiciona con la **regla** (scrub); la inserción es solo para el inicio de reproducción. Consistente con "el click no mueve el playhead".

## ROUND 64 — Insert-marker en vez de mover el playhead + play desde la selección + contraste de pista seleccionada (user)
_Revisión adversarial de 3 agentes sobre el nuevo modelo de interacción (interacción / regresión / estado)._
- [x] **Click en el timeline = marca de inserción fina (una sola pista), NO mueve el playhead grueso.** Revierte el comportamiento de ROUND 62. `startTimeSelect`: el click deja `selA=selB=t` en la pista clicada (línea `.timesel.insert` de 1px, sin relleno) y ya no toca `state.playhead`. El clip sigue seleccionándose solo por su banner `.tt`.
- [x] **Play arranca desde la selección/inserción si existe; si no, desde donde está el playhead.** `play()`: si `state.tl.selA!=null` → `playhead=min(selA,selB)` y reproduce desde ahí; si no, continúa donde estaba. Verificado: click a 4s + play → arranca en 4.03; sin selección + playhead en 2 → arranca en 2.
- [x] **Scrub en la regla limpia la inserción** (`selA=null`) y mueve el playhead → así "play desde donde está el playhead" funciona tras un scrub. **Ctrl+E corta en la línea de inserción** (no en el playhead): `splitAtSelection` maneja rango / inserción(zero-width, corta en selA sobre selLanes) / nada(playhead). Verificado: inserción a 5s + Ctrl+E → corte en 5, no en el playhead a 1.
- [x] **Contraste de pista seleccionada incluso con color:** `.lanehdr.sel` ahora lleva un contorno interior blanco (`box-shadow inset 0 0 0 1.5px`) que se ve sobre cualquier tinte; y el fondo tintado se **aclara** al seleccionar (`hexA(color, sel?0.34:0.16)`). Verificado: seleccionada 0.34 vs normal 0.16 + contorno.

## ROUND 63 — Color del clip seleccionado arriba del inspector (user)
- [x] **Barra de color arriba del inspector** (`#selColorBar`, 4px, ancho completo, justo bajo las pestañas): muestra el color del clip seleccionado = `laneTint(c)` (color de pista o el propio del clip). Click → abre el picker de color de la pista. Verificado: barra gris por defecto, verde al colorear la pista, **coincide exactamente** con el título del clip en el timeline; el click abre el popup.

## ROUND 62 — Color en el rectángulo de la pista + playhead al click + botón "seguir" (user)
- [x] **El color de pista tiñe TODO el rectángulo de la cabecera** (no solo la línea izquierda): `hd.style.background = hexA(lane.color, 0.16)` (nuevo helper `hexA`) + la barra izquierda a color pleno + nombre/tag coloreados. Verificado: header `rgba(224,149,75,0.16)`, V1 naranja completo, V2 azul completo.
- [x] **Click en cualquier parte del timeline (vacío O sobre un clip) coloca la línea blanca de playback** y la reproducción arranca desde ahí; el clip **solo se selecciona por su banner superior**. (Ya implementado en ROUND 60 vía `startTimeSelect(e)` sin selección; ahora se despliega.) Verificado: click en el cuerpo del clip → `playhead` línea a 240px, `selId=null`.
- [x] **Botón "Seguir" junto a Play** (`#followBtn`, icono de mira): activa `state.follow`; durante la reproducción `followPlayhead()` hace page-scroll del `#tlscroll` para mantener el cabezal a la vista (estilo Ableton). Verificado: alterna `state.follow`, el timeline scrollea cuando el cabezal sale de vista.

## ROUND 61 — FIX: los atajos con Ctrl no funcionaban (foco atrapado en un `<select>`) + Ctrl+E corta en la selección + Space = play (user)
_Diagnóstico empírico por CDP en el `.exe`: con un `<select>` enfocado, un Ctrl+E dirigido al select devolvía `splitAtSelection=0` (bloqueado por el guard `tag==='select'→return`), y hacer click en el timeline **no** quitaba el foco (`activeElement` seguía en SELECT). Resultado: tras usar cualquier dropdown del inspector, TODOS los atajos (Ctrl y Space) morían._
- [x] **Causa raíz corregida (2 partes):** (1) el guard del `keydown` ya **no** bloquea por `<select>` para combos Ctrl/Cmd ni Space — solo los inputs de texto siguen capturando teclas; un `<select>` enfocado conserva sus flechas/type-ahead pero deja pasar los atajos de la app. (2) Nuevo listener global `pointerdown` (captura) que **quita el foco** de cualquier `<select>/<input>` al hacer click en una superficie sin controles (timeline, visor, paneles), así el foco vuelve al body y los atajos siguen vivos. Verificado en preview: Ctrl+E con select enfocado → dispara; click en timeline → `activeElement` pasa de SELECT a BODY.
- [x] **Ctrl+E corta en la selección (Ableton).** Ya existía `splitAtSelection` (corta cada clip que cruza selA/selB en las pistas seleccionadas); ahora que Ctrl+E dispara, funciona. Verificado: clip de 8s con selección 2→5 → **3 clips** (0-2, 2-5, 5-8).
- [x] **Space = play/pause** confirmado (dispara incluso con un select enfocado; `preventDefault` evita que el select se abra). Verificado.

## ROUND 60 — Color de pista visible en header+clip + click en el cuerpo del clip = playhead (user)
- [x] **El color de pista se ve en la cabecera Y en el clip.** Además de la barra izquierda, el **nombre + tag** de la pista se pintan con `lane.color`; y los clips de esa pista se tiñen (título + cuerpo) vía `laneTint()`. Verificado en vivo: nombre, barra, título y fondo del clip todos en `#5B8DEF`.
- [x] **Click en el cuerpo del clip coloca el playhead** (línea blanca), igual que en área vacía — **sin seleccionar** el clip. El clip **solo se selecciona por su banner superior** (`.tt`); los handles de trim/fade siguen operando. Reestructuré el `pointerdown` de `#tracks`: razor/zoom actúan primero; cuerpo (no título/handle/fade) → `startTimeSelect(e)` (mueve playhead, no selecciona); título/handle/fade → selección + drag. Verificado: cuerpo → playhead t=3, `selId=null`; título → `selId=clip`.

## ROUND 59 — Diálogo de guardar centrado + toggle de proxy en el visor (user)
- [x] **El diálogo "¿guardar antes de cerrar?" aparece centrado.** `appConfirm` usaba `alignItems:flex-start` + `margin-top:130px` (pegado arriba) → quitados; ahora usa el centrado del `.overlay` (align/justify center, margin-top 0). Afecta a todos los confirmes (cerrar sin guardar, descartar cambios, eliminar pista/secuencia, aviso de MP4 grande). Verificado.
- [x] **Toggle de proxy en el visor**, junto a los botones Full/½/¼ (`#proxyToggle`, icono ⚡). `state.view.useProxy` (default on). `_vinstUrl()` ahora respeta el flag: con proxy **on** el decodificador por-clip usa `m.proxyUrl` (rápido); **off** usa `m.srcUrl` (clip **original** en el visor). Al alternar, `disposeAllVinst()` recrea los decodificadores con la nueva fuente + `scrubRender()`. NO afecta el export (que ya fuerza original vía `_exportQuality`). Verificado: botón alterna `useProxy`, sin errores de consola.

## ROUND 58 — 9 refinements sobre el pase monocromo (user, con fotos): tamaños/layout/color de pista/timeline
_Todos verificados en el preview antes de compilar (sin errores de consola)._
- [x] **Modal Compose de tamaño constante.** El panel de parámetros pasó de `min-height:312` (crecía con cada layout) a **`height:420px;overflow-y:auto`** → el modal mide **531px igual para Ring / Dome fill / Line / todos**. Además densidad: `.frow` margin 11→8 + inputs 24→22px, y el canvas de vista previa `border-radius` 8→2px.
- [x] **Barra izquierda más ancha por defecto** (262→**292px**) para que el botón **Compose** salga completo; defaults de workspace actualizados (media 292 / inspector 300).
- [x] **3D Dome abre en Orbit por defecto** (`state.view.three` `'spec'`→`'orbit'`; el segmento marca Orbit activo). En Viewer, los faders FOV/DOLLY ahora respetan el diseño (ver sliders).
- [x] **Sliders nativos finos y monocromos** (FOV, Dolly, Volumen, etc.): `input[type=range]` con `appearance:none`, riel de 3px sobre `#0A0B0D` y pulgar de 11px blanco — igual look que los faders `.prow`. Adiós al slider gordo del navegador.
- [x] **Inspector de audio con densidad correcta:** fader de Volumen fino (por el punto anterior), número 11→**10px**, inputs de fundido 74→64px + 10px.
- [x] **Ecualizador BASS/MID/TREB (Reactive FX) más alto** — el canvas `#arMeter` 34→**54px**, ya no se ve apretado.
- [x] **Opción de layout: inspector a alto completo.** Nuevo botón (icono panel-alto) en la cabecera del inspector: reparenta `#inspPane` (+`#gutterR`) entre `.mid` (estándar) y `#bodyRow` (abarca mid+transporte+timeline) → la **barra derecha se vuelve continua en vertical y el timeline se estrecha** para dejarle sitio. El gutter sigue redimensionándola (encoge el timeline). Persiste en `domeProWs`. Envoltorios permanentes `#bodyRow`/`#stageCol` (render idéntico en modo estándar). Verificado: inspector 51→483px (alto completo), timeline 1006→706px.
- [x] **Click en la grilla del timeline coloca la línea blanca (playhead).** `startTimeSelect` mueve el playhead al punto clicado en área vacía (antes solo aparecía al arrastrar una selección). Verificado: click a 240px → playhead t=3 (exacto).
- [x] **Color por pista.** Clic-derecho en la pista → **"Color de pista…"** abre un popup con 10 swatches + "Por defecto". El color se representa en la **barra de la cabecera** (su cuadro con el nombre) y **tiñe los clips de esa pista** (`laneTint()`; título con `textOn()` para contraste). Persiste con `state.lanes`. Verificado: swatch azul → `lane.color` set + barra actualizada + popup se cierra.

## ROUND 57 — Claude-Design density/type/color handoff, applied al pie de la letra (user delivered a `design_handoff_density_pass/` bundle: README + hi-fi reference prototype)
_A 100% visual pass — typography, layout/sizing, and color only; no functionality, selectors, IDs, or DOM structure changed (except the 3 permitted layout reorganizations). Implemented against the handoff README's exact values + reference prototype, then adversarially verified with a 4-agent audit (selectors / numeric-fidelity / leftover-hue / regression-risk)._
- [x] **Single UI family = Geist.** Dropped the Inter+JetBrains-Mono mix. Self-hosted `geist-400/500/600.woff2` (downloaded, offline-first like Inter). Every `.mono`/timecode/numeric field → `font-family:Geist` + `font-variant-numeric:tabular-nums` (no monospaced font). Inter kept only as fallback + for user text-clip content. Base `body` 11.5→**11px**. All canvas `ctx.font` `'JetBrains Mono'`→`'Geist'`.
- [x] **Strict 18px control grid.** ONE interactive height = **18px** for `.seg/.vseg/.filtseg/.groupseg/.editseg/.togbtn/.togbtn2/.selsel` + icon buttons `.ibtn` 18×18. Bars/structure to the handoff table: `.top` 36→**28**, `.vptool` 30→**28**, `.transport` 42→**30**, `.panhead` 40→**26**, `.ruler` 26→**22**, `.rulerpad` 26→**22**, `.trackhdr` 158→**152**, media pane 284→**262**, inspector 328→**300**, `.toolrail` 36→**32** (buttons 28→24), `.playb` 32×30→**30×22**, value box 18→**16px** / pad 0 5. Inline inspector/modal inputs 26→18/20. Everything squared to **2px** radius. `button{padding:0}` reset (handoff's icon-centering fix).
- [x] **Monochrome color system.** Removed EVERY hue — accent blue, teal, project gold, audio/status greens, amber/red meters, comp purple/orange — remapped by role to a neutral gray scale: active `.on` = `#454C55` bg + `#FFFFFF` text; fader fill / playhead = white / `#F2F4F6`; selection/clip-sel/seqtab-active/lanehdr-sel = `#C9CDD3`; play primary = `#3A4047`. `TRACK_COLORS`/`CLIP_COLORS` → grays; audio clip title `#B4BAC1`; waveforms/meters/curves/keyframes/markers/lane-drag indicator/dome+safe guides all neutralized (canvas `fillStyle`/`strokeStyle` value-only). Text/contrast bumped per handoff. The **RGB parade scope** (histogram of real R/G/B channels) is the sanctioned color exception; user-content defaults (`#fff` text, `#000` stroke) untouched.
- [x] **3 permitted layout reorganizations** (markup, ids/handlers preserved): (a) media type-filters + group-filters merged into **one** segmented row (GROUP label kept but `display:none` — `app.js txt('#groupLbl')` still resolves); (b) **Compose** moved to its own right-aligned action row so it never clips; (c) media-header **T** and **▭** glyphs → inline SVG (line+stem / `<rect>`) for identical centering; plus seq-tab full 2px radius on all 4 sides and `.zoomgrp` restyled to a bordered 18px segment like `.vseg`.
- [x] **4-agent adversarial audit** (ultracode): **selectors PASS** (every id/class/data-* app.js relies on still present — ~110 ids verified), **fidelity PASS** (every handoff number matches), **regression PASS** (textOn() contrast holds on the new grays → readable clip titles; all canvas font strings valid; no color used as data-key/comparison; layout/hit-test dims unshrunk; `button{padding:0}` safe). **Color lens found 17 leftover hues** in app.js chrome that used hexes OUTSIDE the handoff's replacement table (purple duration-chip `#4A3F6E`/label `#C9C0F0`, blue anim-chips `rgba(143,178,246)`/badge, gold keyframe-selection `#FFD24A`+marquee, green proxy dots `#4BCF87`, red danger button `#7A2B28`, navy logo `#0A1430`, + blue-cast panel darks `#161922`/`#1B1F29`/`#0C1116`/`#151B22`/`#1E2430`/`#2E3440`) — **all neutralized**.
- [x] **Ruler geometry coherence fix** (caught by the regression lens): CSS `.ruler` shrank to 22px but `app.js` drew the ruler canvas at hard-coded 26px → 4px canvas bleed over track 1 + playhead-height off-by-4. Migrated the whole ruler draw to 22px coherently (canvas height, tick Y-coords, marker line, cache-map strip 23.5→19.5, `_tlH` 26→22). Now CSS 22 / canvas 22 / rulerpad 22 all aligned.
- [x] Verified in-browser: Geist loaded & applied, all handoff numbers match computed styles, ruler paints clean at 22px, tabs/3D/Reactive FX functional, **zero console errors**. `node --check app.js` OK; zero leftover hues on final sweep.

## ROUND 56 — Followable track-drag + deeper density/square pass (user: "el drag debe ser ordenado y fácil de seguir; botones/textos más chicos, sin bordes redondeados")
- [x] **Track drag-reorder made clearly followable.** While dragging a header: a **full-width glowing insertion bar** spans the header column through the timeline right edge (snaps between tracks), the dragged header **lifts** (blue outline + drop shadow + dim), a **name chip follows the cursor**, and the cursor becomes `grabbing`. Verified: indicator + chip appear, clean up on drop, clips follow.
- [x] **Deeper density + fully square.** All chrome `border-radius` 3/4/5px (and the `4px 4px 0 0` / `5px 5px 0 0` tab corners) → **2px** — squared to match Ableton. Toolbar/transport controls trimmed: `.togbtn`/`.togbtn2` 28→24, `.tbtn` 30→26, `.playb` 37×34→32×30, `.ibtn` 26→24, `.mbtn` 30→26, `.pantab`/`.tcbox` 30→26, `.editseg` 28→24, `.seqtab` 11→10.5; button fonts 11.5/12→11. Verified in-browser: tighter + squarer, transport/panels intact, no console errors.

## ROUND 55 — Ableton-density pass + track reorder + Ctrl+E split + automation UX (user, with Ableton screenshot reference)
_Structured with a 4-agent design audit (density / automation / timeline / radius) vs Ableton Live 12, implemented + verified in-browser._
- [x] **Global density + square corners.** Shared row/control CSS tightened to Ableton proportions: `.prow` 4→2px pad, gap 8→6; `.field` 22→20px; `.track` 4→3px; `.box` 20→18px / 56→52 min; `.lab`/`.num` 11.5→11px; `.kf` 22→18px; `.sechead` 9→6px; `.selsel` 30→22px + radius 3→2; `.clip` radius 3→2. Reactive-FX cards: radius **6→2px**, header/body paddings shaved, band/mode selects 24→20px, footer buttons 30→24px. This tightens the inspector AND the Reactive FX panel.
- [x] **Effect-card header buttons fixed** — the "big white buttons out of place": now **16px square muted icon buttons** (grip / power / collapse / trash) with a subtle hover bg; the power toggle is a soft blue (#8FB2F6) when on, not a bright beacon.
- [x] **Track drag-reorder.** Dragging a lane header vertically reorders `state.lanes` and remaps every clip's `c.lane` (handles the top-down display reversal; live drop indicator; click still selects). Verified: dragged lane moves, clips follow.
- [x] **Ctrl+E = Split** (Ableton) — razors every clip crossing the time-selection boundaries (or the playhead if no range), restricted to the selected lanes; **Export moved to Ctrl+Shift+E**. `razorClip` refactored into a reusable `razorCore`. Verified: a 2–5s selection over two clips → 4 cuts.
- [x] **Automation editing UX.** Point grab-zone widened 12→18px (handles 7→10); breakpoints drawn bigger (idle 4 / hover 6) with a **pre-click hover ring**; new **double-click-a-point inline value editor** (framed field + focus ring, Enter/Esc) — and `.numedit` restyled from frameless floating text into a real bordered field. Verified: dbl-click sets an exact value.
- [x] **Audio-React "símbolos raros" fixed** — root cause: `↻`/`✕` glyphs fall outside the latin-subset woff2 → tofu. Replaced with SVG `refresh`/`close` icons; suppressed the native `<select>` arrow (`.aselect` appearance:none + inline SVG chevron). The choosers now read clean **"RGB Split" / "Intensity"** names (Ableton-style). Verified.
- [x] **Review pass (12-agent, 5 confirmed & fixed):** (1) **HIGH** — the `.aselect{appearance:none}` change made the *regular* automation param dropdowns lose their arrow entirely (the `.autochip/.autohdr .aselect` `background:` shorthand reset the chevron image); fixed by switching to `background-color` + a `padding-right` gutter (verified chevron back). (2) command-palette Export badge `⌘E`→`⇧⌘E` + the Split entry now maps to Ctrl+E/`splitAtSelection`. (3) Export button tooltip `Ctrl+E`→`Ctrl+Shift+E`. (4) split status i18n (`n+' '+cut/cuts/corte/cortes`, no double-space, singular/plural). (5) effect-card button hover was dead (inline `background:none` beat the CSS) — moved base bg/border to CSS so hover highlights work.

## ROUND 54 — Reactive-FX aesthetic polish (user: "botones que no encajan; el formato de automatización está medio extraño, igual de intuitivo que los efectos del inspector")
- [x] **Effect cards** now use real app icons: a **grip** (new `grip` icon) to drag-reorder, a bare **power toggle** (new `power` icon — blue when on, grey when bypassed) replacing the checkbox-looking `●/○` box, and clicking the effect **name** collapses/expands. Chevron + trash kept.
- [x] **Transport buttons** de-golded to match the app convention: **Audio React** now uses a distinct **`react`** waveform icon (vs Automation's `curves`) and the neutral togbtn styling (accent only when active); the **Add Adjustment Layer** button dropped its custom gold too.
- [x] **Audio-React lane header redesigned** — the two choosers were cramped illegibly into the ~130 px lane header; now the **Effect** dropdown and **Parameter** dropdown stack vertically (full-width, legible), with the A/+/✕ controls inline under the parameter, and the AR lane has a taller floor (48 px) so both rows fit. Reads like Ableton's device/param chooser and is as tidy as the inspector rows. Verified in-browser (icons, stacked dropdowns, toggle/collapse/param-change all work; no console errors).

## ROUND 53 — Audio-React automation timeline (Ableton-style effect+param chooser) + Fase-2 review fixes (user)
- [x] **Separate "Audio React" transport button** next to "Automation". Automation stays exactly as before (inspector params only); Audio React shows a SECOND set of lanes covering ONLY the reactive-fx params (keys `fx:<id>:<param>`). Each lane has an **Ableton-style pair of dropdowns — one for the EFFECT, one for its PARAMETER** (Intensity / Reactivity + the effect's own params) — plus arm/add/remove/resize. Clicking the ⏱ stopwatch on any effect fader in the Reactive FX panel arms that param and reveals its lane here.
- [x] **Unified fx-param automation with the render.** `evalP` now resolves fx-key bases ('fx:<id>:<param>' → the fx object) and `evalFxParam` delegates to it, so the automation CURVE == the rendered value. `drawAutoCurve`/`bindAutoCurve` generalized via `paramDef`/`paramBase`/`setParamBase` (label/range from the effect def; baseline drag writes back into the fx object). Verified: a 0→50→100 intensity curve drives the strobe gray→white; dual dropdowns list the right effects (2) + params (5).
- [x] **Fase-2 review fixes (12-agent adversarial pass, 3 confirmed & fixed):** (1) **fx deep-copied** on split/duplicate/drag-copy/nest (was a shared array reference — editing one half corrupted the other; verified split → independent arrays); (2) **`loadProject` id-reseed now scans `fx[].id`** (top-level + nested) so post-load `uid()` can't collide with a saved fx id and break fx-keyed lookups (wiring/drag/keyframes/GL history/collapse); (3) **`_fxCollapsed` keyed by clip+fx** (+ cleaned on delete) so duplicating a clip with FX doesn't cross-contaminate collapse state.
- [x] **Second adversarial pass on the Audio-React code (10-agent, 4 confirmed & fixed):** (1) the shared curve `commit()` now `raInvalidate()`s + `markDirty()`s so editing ANY automation curve (regular or AR) refreshes the viewport under render-ahead (was a latent bug for regular automation too); (2) **`addArAutoLane` now picks a free effect·param** instead of blindly pushing a duplicate lane key (duplicate lanes shared height/arm/curve state); (3) the **v3 back-compat load branch** now folds `fx[].id` into its own id-reseed (the earlier fix ran before v3 sequences were in `state.media`); (4) **`sepAuto()` deep-copies the automation UI-state arrays** (`_auto/_autoH/_autoOff/_arAuto/_arAutoH`) on split/duplicate/drag-copy/nest so editing a copy's lanes no longer mutates the original. All verified in-browser (dedup int→amt→block, independent arrays after split/duplicate, curve→render).

## ROUND 52 — Reactive FX, Fase 2: pro UI + effect library + Adjustment Layer (user: "diseño pobre; reorden con drag; params desplegables; efectos pobres sobre todo glitch; falta la capa de ajuste")
- [x] **Panel redesigned to match the app.** The Reactive FX panel now uses the inspector's own controls: **app-styled faders** (the `.field`/`.track`/`.box` drag-scrub — shift=fine, alt=coarse, dbl-click to type) for the Audio Engine (Gain/Gate/Attack/Release) AND every effect parameter — **zero `<input type=range>`**. Same sechead sections, `.selsel` dropdowns, `.kf` stopwatch, icons.
- [x] **Effect cards**: **drag-to-reorder** by a grip handle (live drop indicator; ▲▼ buttons removed), **collapsible** params (chevron per card, `_fxCollapsed` set), app-styled on/off **bypass** toggle (`.ms`), name, remove. Disabled cards dim.
- [x] **Effect library ×16, categorized** (Add Effect menu grouped Distort / Stylize / Color / Feedback): **Glitch (rewritten** — block jumps + big tears + RGB, block-quantize, line dropout, scan noise), **Datamosh** (directional feedback smear), **Slice**, **Pixelate**, **Kaleidoscope**, **Mirror** (5 modes), **Wave**, **Zoom Blur**, **Edge** (Sobel), **Posterize**, **Scanlines/CRT**, **Strobe**, **RGB Split**, **Hue Shift**, **Trails/Echo**, **Feedback Zoom** (infinite tunnel). All license-clean, our own GLSL. Verified: all 16 compile + alter the frame, no GL errors.
- [x] **Adjustment Layer** (Premiere-style). New clip kind `c.adjust` (no media): `makeAdjustClip`/`addAdjustmentLayer` drop it on a new top lane spanning the work area. Render: `drawAdjustment` snapshots the composite-so-far (everything drawn below), runs the clip's FX chain on it (`applyChain`), and mixes it back by the layer's **opacity** (wet/dry) via a new `PMIX` program. Runs inside `composite()` so it inherits export + nests for free. Inspector = opacity + a pointer to the Reactive FX tab; timeline shows a gold hatched block; not dome/flat-pickable; trim already treats media-less clips as unlimited. Button in the Reactive FX panel. Verified: strobe on the adjustment layer whitens the gray layer below; opacity 50%→187; bypass restores; serializes (`adjust:true`, fx preserved).

## ROUND 51 — Audio-reactive FX engine, Fase 1 (user: "resolume/touchdesigner audioreactivo a la pista que yo elija")
_Research first: Ghost Arcade (AGPL) / glitchGL (non-commercial) rejected for licensing; adopted the ISF *concept* (shader + params + audio inputs) and wrote our own permissively-clean GLSL. Built in phases; this is Fase 1. Fase 2 = Adjustment Layer + "Audio React" timeline filter button + Kaleidoscope/Mirror + more effects._
- [x] **Offline per-band analysis (deterministic).** `computeBands(ab)` renders the audio through an `OfflineAudioContext` (16 kHz) split by biquad filters into **bass / mid / treble**, extracts a per-frame RMS envelope (90 fps), normalizes to the 98th percentile, and reuses `detectBeats` for onset times. Stored on `m.bands`; analyzed on import (`armMediaBands`) and lazily when a source is picked. Because it's precomputed + time-addressed, **preview and export are frame-identical** — no export/quality hit.
- [x] **Reactive config + eval.** `state.reactive` = {source clip, Gain, Gate, Attack, Release}. `arRecompute()` bakes a **causal attack/release one-pole** (+ gain/gate) into smoothed per-band arrays (deterministic — no per-frame filter state). `bandLevelAt/onsetLevelAt` sample them; `fxIntensity = clamp(baseIntensity + reactAmount·mod)` where `mod` = the band envelope (Follow) or a decaying beat spike (Trigger). Every value automatable via compound keyframe keys `fx:<id>:<param>` through a standalone `evalKf` (mirrors `evalP`).
- [x] **GPU post-process chain (ping-pong FBO).** New `_ppVAO` + per-effect programs (`ppCompile`, `a_p`→loc 0). `applyChain(inputTex,size,host,t)` runs an ordered, reorderable list of passes on the clip texture **before** dome/2D placement (so it's projection-agnostic and works in both). Runs only when a clip has enabled FX (existing projects = zero overhead). Effects v1: **RGB Split · Strobe · Glitch/Datamosh · Trails/Echo (feedback buffer) · Zoom-blur** — each with creative params + band + Follow/Trigger + intensity + reactivity.
- [x] **Model + hooks.** `makeClip` gains `fx:[]`; `drawClip` runs `applyChain` on `ntex`; `serProject/loadProject` persist `state.reactive` (fx chains ride along in `serClip`'s deep copy). Export path (`renderExportFrame`→`composite`→`drawClip`) inherits FX automatically at full res.
- [x] **UI.** Right inspector panel gains tabs **Inspector | Reactive FX** (`#insReactive`). Reactive FX = Audio Engine (source dropdown, live 3-band meter, Gain/Gate/Attack/Release) + a reorderable **effect-card chain** (on/off, ▲▼ reorder, remove, band+mode selectors, Intensity w/ keyframe, Reactivity, per-effect params) + **Add Effect** palette.
- [x] **Bugs found & fixed during verify** (browser CDP): (1) shared frag header declared `u_prev` → every effect flagged `needsPrev`; scoped it to Trails only. (2) `_ppRT`/`_fxHistFor` internally bind FBO/textures — calling them *after* setting the draw target/units clobbered both → the pass drew to the default framebuffer and sampled the (black) history as input. Fix: **allocate RT + history first, bind the FBO and texture units last, right before the draw.**
- [x] Verified in-browser end-to-end: strobe white/black flash; RGB Split & Glitch alter the frame; **bass envelope drives intensity** (gray→white as the ramp rises); **beat-trigger** spikes on onsets; **works in flat 2D**; **FX bake into the export render path**; disabled chain = byte-identical to no-FX (no regression); UI tabs/cards/reorder/meter all functional; no console errors.
- [x] **Adversarial multi-agent review (15 agents) → 8 hardening fixes** applied + re-verified: (1) **GPU-memory leak** — `_fxHist` feedback textures/FBOs now freed via `freeFxResources()` (newProject/loadProject), `freeFxHistFor()` (clip delete), `freeFxHistOne()` (effect remove); (2) **reactive-inside-nest** — the audio term now samples a global `_arTime` (top-timeline time) instead of nest-local time, so FX on nested clips still follow the top-timeline source; (3) **export/render-ahead determinism** — `fxResetHistory()` clears feedback buffers at export + prerender start; (4) **feedback vs render-ahead cache** — `anyFeedbackFx()` skips caching frames when a Trails effect is active (scrubbing no longer bakes wrong echoes); (5/6) live FX/Gain slider drag + async band-analysis completion now `raInvalidate()` the render-ahead cache; (7) **undo** now snapshots/restores `state.reactive`; (8) `_arCache` cleared on sequence switch (loadSeqIntoState) so no phantom reactivity across tabs. Known Fase-1 limitation (documented): the reactive source is a single project-global clip ref, so it is live only in the sequence that owns that audio clip (per-sequence reactive config = Fase 2).

## ROUND 50 — 2D (flat) project mode: normal rectangular video editing (user)
- [x] **Whole new project type.** A sequence gains `mode:'dome'|'flat'`; flat = a rectangular canvas at a chosen W×H (default 1080p, custom W×H field). The entire timeline/nests/automation/blend/FX/masks/audio/keyframes stack is projection-agnostic and reused unchanged — only the dome fisheye projection is swapped for a straight rectangle.
- [x] **Rendering.** New `u_flat` branch in the warp vertex shader `VSW` places a clip as a **rotated rectangle** (`center + a_flat·axes`) inscribed in the square composite with a **uniform scale** (no skew, rotation-safe); `FSW` (all FX/mask/blend) reused verbatim. The blit shader `PB` got a flat path (`u_flat`/`u_uvsc`/`u_uvof`) that skips the dome disc-clip and samples just the rectangular region, aspect-fitted to the window (preview) or filling W×H (export). `_drawFlat`/`_compAspect` set per-composite (top + per-nest). Verified: a 16:9 clip fills the full width, letterboxed top/bottom.
- [x] **Model + UI.** `newSeqMedia(mode)`, `serMedia.mode`; landing **"New 2D project"** button + resolution dialog (`flatResDialog`); the `+` new-sequence dialog gains a Dome/2D toggle; format chip shows W×H. Clip transform swaps to **Pos X / Pos Y / Scale / Rotation** (`TF_FLAT`), header relabels to "Transform"; dome-only controls hidden in flat (3D Dome, Horizon, Fulldome-src toggle, az/el readout, `updModeUI`).
- [x] **Viewport interaction.** Rectangular **frame + thirds + safe** guides (`drawFlatFrame`), selected-clip **rect outline**, and **click-pick + drag** to move clips (`pickClipFlat`/`pix2frame`, `elemFlat` drag → x/y).
- [x] **Export at W×H** (still/PNG/MP4/H.265): `renderExportFrame` extracts the flat rect into a non-square `glc`; codec/mux dims = seq W×H; dialog shows `W×H px` + a sane area-based default bitrate. Verified: 1920×1080 clip fills the whole 1080p output (no letterbox); dome export unchanged.
- [x] Verified end-to-end in-app and confirmed **dome mode fully intact** (disc renders, az/el/size inspector, no regression). No console errors.

## ROUND 49 — Ruler white-out at high zoom + scrollbar-corner square (user, 2 minor bugs)
- [x] **Ruler goes solid white at high zoom.** `#rulerCv` was sized to the FULL content width (`dur*pps`) — at high zoom that exceeds the browser's max canvas area and the canvas blanks to white. New `drawRuler()` sizes the canvas to the **visible viewport window** (positioned at `scrollLeft`, drawn in content coords via a `−scrollLeft` transform), draws only visible ticks/markers, and is re-run on horizontal scroll. `#ruler` element stays full-width so the sticky pointer-math (playhead scrub) is untouched. `drawCacheMap` updated for the same offset. Verified: content width 4.8M px → ruler canvas capped to 1103px, within limits, ticks present, not white, follows scroll; normal zoom still correct.
- [x] **White square, bottom-right of timeline** = the `::-webkit-scrollbar-corner` (h+v scrollbars meet) had no rule → defaulted to white. Added `::-webkit-scrollbar-corner{background:transparent}`.

## ROUND 48 — High-detail zoomable waveform + the TWO-INSTALL bug (user: "waveform pauperrima… ver transientes al acercar; y sigue el recuadro")
- [x] **Two installs found.** The rectangle "persisting" was a deployment bug: there are TWO installs — `%LOCALAPPDATA%\Programs\dome studio pro` (which I was updating) and a stale **`C:\Program Files\Dome Studio Pro`** (07-05 22:26, pre-outline-guard). The user's shortcut launches the Program Files copy → old code → rectangle + coarse wave. Fix: deploy every build to **both** locations. Proof the code was fine all along: same clip draws 0 outline px as audio, 792 as video.
- [x] **Sample-accurate, visible-window waveform.** The old `drawClipWave` built a canvas at the FULL clip width — at high zoom that blows past the canvas size limit and loses all detail. New `drawAudioWaveInto`+`redrawAudioWaves` render **only the visible slice at screen resolution**, re-drawn on scroll/zoom (`scheduleWaves` on `#tlscroll` scroll + at end of `renderTimeline`). When the visible window is small it reads **min/max/RMS straight from the AudioBuffer** (crisp transients); when zoomed out it aggregates the peak/RMS cache. Cache resolution raised to ~120 buckets/s (was 44).
- [x] **Single-sided (Premiere-style) toggle** in the audio inspector (`state.tl.waveTopHalf`). Volume-scaled; live-updates on the volume slider.
- [x] Verified in-app: dynamics visible (loud 68px / silent 2px / medium 34px); a 3 ms transient zooms into a sharp 13-column spike; zoomed canvas = visible window (843px, not full clip); centered symmetric vs single-sided bottom-anchored; no console errors.

## ROUND 47 — Real audio waveform (peak + RMS) (user: "no muestra el waveform real en el timeline")
- [x] **Root cause:** `computePeaks` stored only max-abs peaks at 1200 buckets. A mastered/loud track peaks near 1.0 almost everywhere → the timeline waveform rendered as a near-solid green block with no visible shape.
- [x] **Fix:** new `computeWave(ab)` computes per-bucket **peak AND RMS** at duration-aware resolution (~44 buckets/s, up to 24k). `drawClipWave` (timeline) and `drawWaveInto` (inspector) now draw a **dual envelope**: a light peak outline + a bright **RMS body** that reveals the actual dynamics (intro/drops/quiet sections). Amplitude scales with per-clip volume. `addAudio` + relink store `m.peaks`+`m.rms`; not serialized (recomputed on load).
- [x] Verified: synthetic loud/quiet/medium clip → RMS 0.66 / 0.09 / 0.37; rendered waveform 50 px tall in loud vs 8 px in quiet (real shape, not a block).
- [x] **Deploy note:** the earlier "still broken" was **5 stale processes** kept alive; the single-instance lock re-focuses an old window instead of launching the new build. Fix = kill all instances, relaunch.

## ROUND 46 — Audio clips have no dome presence (user: "el clip de audio no debiera visualizarse con un rectángulo en el canvas")
- [x] **No dome outline for audio.** `drawOutline2D` now returns early when the selected clip is audio (`m.kind==='audio'`), so a selected audio clip no longer draws the blue dashed rectangle in the 2D/viewport (it has no visual — it's only sound). `pickClip` also skips audio, so audio can't be grabbed/selected in the dome. Verified: outline-blue pixels 0 with Outline ON + audio selected; audio not pickable.
- [x] Note: the ROUND 45 audio inspector (waveform + Volume + fades) is present in both source and the installed `app.asar` — the earlier "still not showing" was a **stale running instance** (old JS in memory); a full quit + relaunch loads it.

## ROUND 45 — Audio: auto-track, per-clip volume + fades, real waveform, independent copies (user)
- [x] **Drag audio → auto audio track.** Before, dropping audio with no audio lane silently failed (drop rejected) or fell back to a *video* lane. Now `addClip`/drag-drop **auto-create an audio track** to hold it (`startMediaDrag` accepts an audio drop anywhere over the timeline).
- [x] **Per-clip volume.** New `props.volume` (0–200 %, default 100). Applied live in preview via a **per-clip `GainNode`** (`startAudio` now builds source→gain→master, envelope in absolute ctx time so a mid-clip start lands at the right gain), baked into export (`exportAudioMix` multiplies by `vol`), and tweakable during playback (`liveAudioGain`). Volume also scales the drawn waveform for instant feedback.
- [x] **Real waveform in the track.** `computePeaks` already builds a true max-abs envelope; `drawClipWave` now renders it sharper (DPR-scaled) and volume-scaled. Audio clips get a **dedicated inspector** (`buildAudioInspector`): waveform preview + **Volume** slider + **Fade in/out** — the dome Transform/Effects/mask/blend/motion are hidden for audio (`#secTf`/`#mirrorWrap`/`#secFx` toggled, `#insAudio` shown).
- [x] **Independent copies.** Audio was already per-clip at the buffer level (each clip → its own `BufferSource`); confirmed and hardened: `collectAudioEvents` now tags each event with the clip `id` + `vol`, so copies play, fade and mix **independently**. Verified in-app: auto-lane 0→1, inspector switches to the audio panel, volume 50 % → mix event `vol 0.5`, two copies → **2 events, distinct ids**, waveform renders 9130 px. No console errors.

## ROUND 44 — Duplicated video clips play independently (user: "el playback de cada video está siempre igual… siempre se ven sincronizados")
- [x] **Per-CLIP video decode.** Root cause: one `<video>` + one GPU texture per MEDIA can only hold ONE frame at a time, so every clip that pointed at the same source showed the SAME frame (copies looked permanently "synced", especially when overlapping). Each **drawn** video clip now gets its own private `<video>` decoder + texture (`_vinst`, keyed by clip id) sampled by `drawClip` — copies decode independently in **preview, playback AND export**, including inside nests and across same-media crossfades (which used to freeze the outgoing copy).
- [x] `collectDrawnVideoClips` mirrors `compositeClips` (per-clip, not per-media; descends into active nests; includes crossfade pairs) and drives every path: `scrubRender`, `play`/`ploop` (per-clip rVFC pump + pause of off-screen decoders), `seekExport`, render-ahead. Nothing is stored on the clip object → serialize/undo/save untouched.
- [x] Lifecycle: instances are lazily created for drawn clips, LRU-capped (`VINST_MAX=32`), GC'd on edit (`reconcileVinst` in `renderTimeline`) and wiped on new/open project + after export (`disposeAllVinst`). Export binds instances to the **original** source (`_exportQuality`), preview to **proxy-if-ready**.
- [x] Verified end-to-end in-app: built a real 2 s ramping-red MP4 (WebCodecs muxer), placed two overlapping copies at local **1.0 s** and **0.2 s**, seeked, and read back each clip's private texture → **distinct decoders + textures**, red **130 vs 23** (Δ107): the two copies now show **different frames** (before: identical). No console errors; app state left clean.

## ROUND 43 — Line = full diameter + "Scroll ↕" infinite-strip motion (user)
- [x] **Line compose is always full width** (edge → zenith → opposite edge) regardless of the old flip toggle: `compLayout('line')` now maps every element onto the full dome diameter (`s∈[-1,1]`, az flips 180° across the centre). Verified: 7 elements → el `1/30/60/90/60/30/1`, az split 180°/0°.
- [x] **Diameter wrap in `drawClip`**: a linear `el` scroll now rises over the zenith and descends the far side, reappearing at the opposite dome edge (identity for normal el∈[0,90], so nothing else changes). `{p=((el%180)+180)%180; el=p<=90?p:180-p; if(p>90)az+=180}`.
- [x] **New "Scroll ↕" motion preset** (`el` linear) + a **Scroll (Infinite strip)** checkbox + °/s (signed = up/down) in the Line compose dialog. Turning it on gives each line element a scroll modifier → the whole line reads as an **infinite strip appearing/disappearing at the edges**. Verified: an element scrolls low→high→over-zenith→far-side→opposite-edge→wraps back to the origin edge; every inner element got the scroll; preset present in the Motion chips.

## ROUND 42 — "Make unique" for nest/compose clips + keyframeable dry/wet per motion (user)
- [x] **Make unique** (right-click a nest/compose clip → "Convertir en único"): `makeClipUnique` deep-copies the nest media (`serMedia`→JSON clone, fresh ids for the media, inner clips and `comp`, masks rebuilt) and re-points only that clip to the copy, so its parameters (compose layout, inner clips) can be edited **independently** of the other instances. Verified: two clips shared a nest → made one unique → editing the copy's comp count (6→10) left the original at 6.
- [x] **Keyframeable dry/wet per procedural motion**: each modifier gets a **Mix (0–100%)** multiplier on its offset, keyframeable so the user decides **when a motion ramps in** on the timeline. `evalWet(c,a,t)` (real playhead time, own `a.wetKf` keyframes, default `a.wet`); `animOffset` multiplies each contribution by the clamped wet. Motion rows are now 2-line cards with a Mix slider + a ◆ keyframe toggle (`animToggleWetKf`/`animSetWet`), synced to the playhead via `refreshMotionWet` in `refreshInspector`. Verified: wet keyframes 0@0s→1@2s give wet 0/0.5/1 and gate a 90°/s spin to 0°/45°/180° (ramps in over 2 s), persists in the clip.

## ROUND 41 — Dome fill: randomize media order (user: "clips shouldn't always be ordered")
- [x] New **"Randomize (shuffle media)"** checkbox + **↻ reshuffle** button in the Dome fill (domegrid) dialog. When on, a multi-media dome-fill assigns media to the grid cells in a **stable shuffled order** instead of sequential `i%n`. `ensureCompOrder`/`compMediaIndex`: distributes each media ~evenly then Fisher–Yates shuffles the positions, storing the map in `comp.order` so re-renders/edits stay put; ↻ (or toggling on) forces a fresh reshuffle (`_orderR`). Persists in the comp (`shuffle`/`order`). Verified live: off → `ABCABC…`; on → randomized (e.g. `ACCBACBBAACB`) with each media appearing exactly 4×/12 cells.

## ROUND 40 — Start screen (New + Recents) + styled dialogs matching the app (user)
- [x] **Landing / start screen** on launch instead of dropping straight into an empty comp: full-screen styled overlay (`showLanding`, z-index 300) with the app logo, **New project** + **Open project…** buttons, and a **Recent projects** grid (cards with thumbnail + name + relative date, click to reopen). Recents persist in `localStorage` (`domeProRecents`, cap 12), updated on every save/open (`addRecent` with a small JPEG `projThumb()` of the dome). Dismissed by New / Open / opening a recent / a double-clicked `.rdome` (`loadProject`+`openProjectPath` call `hideLanding`). Recents shown only in the `.exe` (browser can't reopen by path). Verified live: overlay + buttons + empty-state render, New dismisses, recents store/read.
- [x] **In-app styled dialogs** replacing native `confirm`/`alert` (which don't match the theme): `appConfirm(msg,cb,{ok,cancel,danger})` and `appAlert(msg)` reuse the `.overlay`/`.modal`/`.togbtn2` look. `confirmDiscard` is now an async styled confirm; refactored callers (`newProject`/`openProject`/`openProjectPath`/`restoreAutosave` → async-await, `removeLane`/`deleteSequenceMedia`/big-MP4-warning → callback). All `alert()` → `appAlert()` (save/open/export/audio errors). Only the WebGL-context-loss alert stays native (fires during a GPU reset while the app reloads).
- [x] **Close-confirm styled too:** the unsaved-changes guard on window close no longer uses the native OS `dialog.showMessageBoxSync`; main.js sends `dsp:confirmClose` → renderer shows `appConfirm` → `DSP.forceClose()` (new IPC) closes on confirm. (OS file open/save pickers stay native — those are OS-owned and can't be themed.)

## ROUND 39b — "Cull" repurposed into a useful "Horizon fade" (user: "cull does nothing")
- [x] Verified empirically that the old **Cull** toggle was a no-op: rendered a clip crossing the horizon with cull on vs off → **pixel-identical** (the dome projection already sends below-horizon content outside the visible disc, so discarding it earlier changed nothing). User confirmed it felt dead.
- [x] Repurposed the button (with the user's pick) into **Horizon fade**: softly fades content in the outer band of the dome (the spring line) to avoid a hard bright ring at the horizon — a real fulldome need. Implemented once in the shared blit `FSB` (2D view **and** the export downsample) and in the 3D dome `FS3`, driven by `state.view.hfade` + `u_hfade` (band `HFADE=0.14`). `renderExportFrame` unified to always go through the FBO→PB blit so the fade bakes into stills/video at any resolution (ss=1 or 2). Button relabelled Cull→**Horizon** (data-d `cull`→`hfade`), command palette + i18n updated. Verified live: fulldome disc edge goes from a hard circle (off) to a smooth fade-to-black (on); no shader/console errors.

## ROUND 39 — Playhead spans all tracks + always-visible ruler triangle (user: line cut at 4 tracks, no top triangle)
- [x] The playhead (and snap guide) were `position:absolute; top:0; bottom:0` inside the fixed-height `#tlscroll`, so their height was capped at the visible ~4-track area and got "cut" once more tracks were added. Now `renderTimeline` sets `#playhead`/`#snapline` height to **26px (ruler) + `#tracks.offsetHeight`** → the line spans the ruler **plus every track** (incl. inline automation sub-lanes), regardless of count.
- [x] The downward **triangle handle** moved from a `::before` on the line (which scrolled away / sat under the ruler) to its own `#phTri` element **inside the sticky `#ruler`**, so it's **always visible** at the top; `positionPlayhead` moves it with the line. Verified live: 7 tracks → playhead height 600px (26+574), triangle present/visible and tracking the cabezal.

## ROUND 38 — Procedural infinite motion (Unreal-style Rotator / Translator), keyframe-independent (user)
_User wanted automatic looping animation (a ring spinning forever, things drifting and wrapping around) that's simple, drag-and-drop, independent of keyframes, and applies to clips/stills/comps/tiles._
- [x] **Motion modifiers.** New per-clip `c.anim=[{param,mode,speed,amp,phase,on}]`. `mode:'linear'` = a continuous ramp (Rotator/Translator: `value += speed·t` forever — angular params wrap seamlessly); `mode:'wave'` = sine oscillation (pulse/sway/flicker). Evaluated **on top of** the base/keyframed value at render time only via a new `evalR()` (renderer-only) — so it never bakes into the editable value (`evalP` stays base). Driven by absolute timeline time → **deterministic + correct in export**; a live-preview clock (`_previewClock`, rAF `motionTick`) advances it in the paused editor so the composition visibly breathes (toggle "Live", default on; auto-runs only when active anim exists; paused-only, cancels on play).
- [x] **New `spin` prop = rotate around the dome zenith.** Fulldome clips (nests/compositions/dome stills) rotate the **whole disc** via a new `u_spin` in `VSFD` (vertex-side uv rotation — exact under interpolation); gnomonic clips fold spin into `az` (orbit); sector/dome-tiles rotate their `azC`. So a **Spin** on a ring/dome-fill composition spins the entire thing; on a single image it orbits/spins.
- [x] **Presets (chips): Spin, Orbit, Bob ↕, Sway ↔, Pulse (size), Wobble (roll), Flicker (opacity).** Inspector "Motion" section: click a chip to add, or **drag it onto a timeline clip / the dome viewport**. Each modifier row = on/off · param (Rotate/Orbit/Elevation/Size/Roll/Opacity) · mode (Loop/Wave) · speed (°/s or Hz) · amount · delete. A **↻ badge** marks animated clips on the timeline. Opacity/size clamped so waves stay in range.
- [x] Verified live (preview): shaders compile clean; **Spin advances continuously** (30°/s → cross `+` renders as `×` at 45°, `_previewClock` accumulates, disc rotates in-shader); **Orbit drives az** (24°/s·2s = 48°) while the base `az` stays 0 (never baked); the 7 preset chips + modifier rows build in the inspector; no console errors. Persists automatically (plain data in the clip → save/load/undo). Export stays deterministic (`exporting` flag → uses frame time).

## ROUND 37 — Export quality, dome-fill gaps, open-by-doubleclick, 4K MP4 (HEVC), perfect circle mask, perf meters, alt+scroll (user bug list)
_Reviewed the diagnostics log (RTX 4060, ANGLE/D3D11, maxTex 16384, WebCodecs OK, zero GL/JS errors — confirmed the export problem is render quality, not a crash). Fixed the whole list; verified the visible ones live in the preview._
- [x] **Export quality (root cause).** Nest/composition FBOs were hard-coded to **COMP=2048**, so every dome-fill / ring-grid was rendered at 2048² then upscaled onto a 4K/8K dome → soft "pauperrima" stills *and* video. Added `nestSize` (COMP for preview; set to `min(res·SSAA, GL_MAX, 8192)` during export) — `nestSlot()` reallocates pool textures to that size, `prepNests` composites at it, and it's reset + `freeNestPool()` on export end. Also bumped `MAX_IMG` 4096→`min(8192, GL_MAX)` so originals stay crisp for 4K–8K. Verified the new path is live; nests now render at full export resolution.
- [x] **Dome-fill black dots/zenith hole.** Three causes: (1) the default elevation range was 10–60° → the **zenith was never covered** (the black "glass" hole in the center). Dome-fill now defaults to **0–90°** (full horizon→zenith); the top ring caps to the centre. (2) The default rectangular **edge feather** (`smoothstep` at `|v_flat|→1`) zeroed alpha exactly at every tile edge → thin black seams between sectors. New `u_tile` uniform skips the edge feather (and the mask aspect-correction) for annular-sector tiles so they abut at full alpha. (3) `rho` clamped `≥0` in the sector shader so a top ring reaching the pole caps cleanly instead of flipping past 90°, plus a 0.6° bleed on seamless sectors. Verified live (screenshot): 3×10 dome-fill fills the whole disc to the centre, no hole, no black seams.
- [x] **Open a saved project.** Added an **Open** button in the top bar (Ctrl+O → `openProject()`), plus **double-click `.rdome`** file association: `fileAssociations` in package.json (NSIS registers it), and main.js handles the path from `process.argv` (Windows), `second-instance` (single-instance lock), and `open-file` (macOS), sending it to the renderer (`dsp:openPath` → `openProjectPath`).
- [x] **4K MP4 (H.265/HEVC).** H.264 via WebCodecs/NVENC returns `null` at 4096² on this GPU (measured) — that's why 4K MP4 "didn't let you export". Added an **MP4 · H.265 / HEVC** codec option (`pickHevcCodec` probes hvc1/hev1 × levels 6.2→3.1; mp4-muxer `codec:'hevc'`). Verified in-engine: `avc 4096 → null`, **`hevc 4096 → hvc1.1.6.L186.B0` (works)**. HEVC tops out at 4096² here (6144/8192 → PNG sequence); validateRes guards per-resolution and the estimate shows H.265 + bpp.
- [x] **Perfect circle mask + resizable.** The circle was evaluated in square flat-space → stretched to the clip's 16:9 (ellipse). Now mask coords are **aspect-corrected via `u_half`** (inscribe a true circle in the short angular edge), and a new **`u_maskScale`** + a "Mask size" inspector slider (20–200%) resizes the mask. Applied to circle/rounded/diamond/vignette (FSW) and the fulldome path (FSFD). Verified live: 16:9 clip → round circle; slider shrinks/grows it.
- [x] **CPU / RAM / GPU meters.** Bottom status bar shows live usage (`#statPerf`, ~1.5 s). main.js `dsp:metrics`: CPU% from `app.getAppMetrics()` normalized to cores, RAM = app working set, **GPU% + VRAM via `nvidia-smi`** (cached; silently off on non-NVIDIA). Browser fallback shows JS-heap RAM. Verified live (browser shows "RAM N MB").
- [x] **alt+scroll resizes all tracks.** Timeline wheel handler: `altKey` grows/shrinks **every** lane height together (×1.1 / ÷1.1, clamped, un-collapses). Verified live: 82→90→…→68 across all 4 lanes.
- [x] Answered the user's questions in chat: import formats (browser/WebCodecs codecs — H.264/VP9/AV1/MP4/WebM/MOV/PNG/JPG/WAV…; **HAP/ProRes/H.265-in-MOV not decodable** by the web stack → transcode to import); ProRes export not available in WebCodecs (HEVC is the high-quality/4K path; PNG sequence = lossless master + alpha); export **is** GPU-accelerated (NVENC) and that's the right approach.

## ROUND 24 — Render/encoder quality (user: "renderé MP4 y salió muy baja calidad pese a alto bitrate")
_Investigated the full export path methodically and measured in the live preview. Findings: the pipeline is fundamentally correct — export uploads the **original full-res** frame (`seekMedia(...,useOrig=true)` → `m.originalEl`, not the proxy), re-composites the dome at the chosen `res` directly to `glc` (preview `compSize`/quality is bypassed), and the **encoder honors the bitrate** (measured: complex content under VBR hit ~140% of a 40 Mbps target; CBR 86%). So softness was NOT the encoder ignoring bitrate. Two real causes addressed:_
- [x] **2× Supersampling (SSAA) for MP4 export.** The fisheye warp samples clip textures with plain `LINEAR`/no mipmaps, so high-res footage warped onto the dome **aliases** (shimmer/jaggies) — which both looks soft *and* wastes bitrate on high-frequency noise (why "more bitrate didn't help"). Added `renderExportFrame(t,res,ss)`: renders the dome into an offscreen FBO at `ss×res` (`exportSS()` picks ss=2 when `2·res ≤ min(GL_MAX_TEXTURE_SIZE, 8192)`, else 1) and box-downsamples to `res` via the existing circular-mask blit (`PB`). FBO is freed after export. Verified: valid MP4, correct dims, decodes, export not broken; ss=2 for res ≤ 4096 (GL max here 16384).
- [x] **Resolution/fps-aware bitrate + bpp meter.** The old default 120 Mbps at 4096²/60 is only **0.12 bits/pixel** — genuinely starved for 4K60, so it looks soft no matter what. `suggestBitrate(res,fps)` targets ~0.18 bpp (clamped 16–800): 2048²/30→23, 3072²/30→51, 4096²/60→181 Mbps. The export dialog now auto-fills this (unless the user edits the field), an **Auto** button resets to it, the max was raised 400→800, and the Estimate line shows live **`X.XX bpp · ●●● High / ●●○ Good / ●○○ Low — raise bitrate`** so a starved setting is visible. Encoder also set `latencyMode:'quality'` (kept VBR — it allocates generously for complex frames).
- [ ] _Note: could not reproduce the user's exact result without their footage; these address the most likely causes. For an absolutely lossless master, PNG sequence (up to 8192²) remains the reference path. Possible future: optional output dithering to kill 8-bit gradient banding on dark dome skies._

## ROUND 33 — Full-audit fix pass (29-agent audit → fixed the confirmed bugs + medium concerns + improvements)
_Ran an exhaustive 12-dimension adversarial audit (118 findings, 16 confirmed high bugs, 20 improvements). Fixed across batches, each verified live; a second 13-agent workflow re-verified the fixes._
- [x] **Export/data/crash (critical):** audio inside a **nest** now plays + exports — new recursive `collectAudioEvents` (absolute-time flatten, front-trim, window-clip, per-level mute/solo) drives both `startAudio` and `exportAudioMix`. `pause()` + ploop loop-wrap guard `m.el` (missing-media no longer throws). Autosave writes a **light** copy (`_serLight` drops `maskData`/`_elB`/`_szB`) and always surfaces failure (no one-time gate; clears the stale key on quota error). `saveProject` + main `dsp:writeText` now try/catch and alert on write failure. Global keyboard shortcuts bail when a `.overlay` modal is open. MP4 export in Electron now uses a native **Save dialog → `dsp:writeBinary`** (new `dsp:saveFile` IPC) instead of a silent Downloads drop, and surfaces write failure. `getContext('webgl2')` null → clean message instead of a hard crash; context-loss schedules a **fallback reload** (1.8 s) so a real GPU reset that never fires `restored` still recovers.
- [x] **Blend modes (visual):** unified final blend in FSW+FSFD — `ef=mask·opacity·fade`; screen/multiply RGB now weighted by `ef` (masks/feather **work**, and multiply opacity math is now correct `mix(dst,dst·col,ef)`); darken/lighten blend toward an operator-neutral value by `ef` (white for MIN, black for MAX) and out-of-crop is `discard`, so masked/transparent/opacity-0 pixels **leave the destination unchanged** (was: blackened the whole quad). New `u_blend`/`BLEND_ID`. **Fulldome path gained mask+feather** (the nest path forces fulldome, so nested comps can now be masked). Verified by readPixels: darken/lighten/multiply exact; opacity-0 & masked preserve destination.
- [x] **Nests/sequences:** per-clip nest render via a leak-free **per-frame texture pool** (`_nestPool`) so the same nest on two clips at different local times renders two different frames (was last-prep-wins); transitive **cycle guard** (`seqReaches`) blocks A↔B loops; `deleteSequenceMedia` re-heals the `state.clips ⇄ nestClips` alias; nest-clip trim limit uses live `seqDur(m)`; `prepNests` depth cap aligned to 5.
- [x] **Timeline:** **left-trim now rebases keyframes** (from a drag-origin `kf0`, idempotent) so automation stays anchored; razor drops the inner fades at the cut (no phantom mid-clip fades); lane mute/solo/collapse/resize now `pushUndo` (undo no longer silently reverts them); multi-select trim/fade already applied per-clip.
- [x] **Media/playback:** `_raVidFrame` guards `c.inP||0` (no NaN frame); `adopt()` relinks by name **+ size** (then name-only) to avoid wrong-file relink; bin-delete frees the `VideoDecoder`; audio **reschedules on external seek** during playback (`ploop` detects a playhead jump > 0.06 s → `startAudio()`).
- [x] **Improvements:** resolution dropdowns in ascending order (3072 before 4096); "Sequence N" + Loop-button tooltip (+Ctrl+L hint) translated; compose empty-state uses in-app `flashStatus` not native `alert`; transport secondary counter seeds `0f` (was `1.1.0`); transient `_elB/_szB` stripped from saves.
- [x] **Second pass — cleared most of the deferred list:** (1) **A/V drift** — `ploop` now slaves the playhead to the AudioContext clock while audio plays (`state.playhead=_audioHead+(actx.currentTime-_audioBase)`, anchored in `startAudio`), eliminating multi-hour drift; falls back to rAF `dt` when no audio. Verified: no-audio playback still free-runs. (2) **Large-MP4 RAM** — export now warns (confirm) when the in-memory MP4 would exceed ~1.8 GB, pointing to PNG-sequence (disk-streamed). (3) **Orbit DIST slider** — on-screen zoom control in orbit mode (`#distCtl`, synced with the wheel). (4) **No-op undo** — `pushUndo` deferred until a move/trim/fade actually changes something (a plain click no longer pollutes history). Verified: click→0 undo, real move→1. (5) **Double-serialization** — v4 saves no longer duplicate the active sequence's clips/markers/groups at top level (they live in its nest media), halving the heaviest on-disk data. Verified round-trip.
- [x] **Third pass — cleared 3 more:** (1) **temp/tint** is now a white-balance **gain** (`col*=vec3(1±u_tmp,1,1∓u_tmp)` etc.) — **neutral at 0** (projects without tint unchanged) and no additive highlight crush; verified by readPixels (neutral 128/128/128, warm R↑B↓, cool B↑R↓). (2) **FX edge halo** — blur/glow taps now zero-weight samples outside the (cropped) source (`step()` bounds mask) instead of pulling clamped edge texels. (3) **Render-ahead nested video** — `raPrerenderRange` decodes via `collectActiveVideos` (descends into nests) so cached frames no longer bake a stale nested-video frame.
- [x] **Fourth pass — MP4 streams to disk (last audit item).** Added random-access fd IPC (`dsp:fileOpen`/`fileWriteAt`/`fileClose` in main.js, exposed in preload.js). The MP4 export now uses `Mp4Muxer.StreamTarget` (`fastStart:false`) when running in Electron: each muxer `onData(data,position)` chunk is written straight to the file via a serialized async write queue with backpressure (encode loop stalls when `pending>4`), so RAM stays bounded (~tens of MB) instead of buffering the whole multi-GB file. Browser keeps the `ArrayBufferTarget` fallback; the >1.8 GB RAM warning now fires only on the non-streaming (browser) path. **Closed the verification gap with Node:** proved `StreamTarget`+position-writes reconstruct a byte-identical MP4 vs `ArrayBufferTarget` (incl. the non-monotonic mdat-size backpatch), and end-to-end `StreamTarget → fs.writeSync@position → file` is byte-identical too. The only unverified piece is the standard IPC plumbing (mirrors the working `writeBinary`).
- [ ] _Still deferred (deliberate, low-value defense-in-depth only): IPC path allowlist + GPU reg-add-once on a local single-user tool. Everything else from the audit is done._

## ROUND 36 — Export Still + diagnostics session log (user) · + language rule
- [x] **Language rule (memory):** Beltrán is NOT Argentine — no voseo/argentinisms in chat OR in UI/artifacts; software in English, Spanish = neutral Castilian (buttons in infinitive). Saved to memory `language-style.md`. Audited app strings: source clean (already uses "Guardar"/"Exportar"/"Cancelar"); only `node_modules` noise matched the voseo grep.
- [x] **Export Still (PNG):** new codec option in the Export dialog. Renders ONE frame at the playhead from the **original media** (`seekExport`→`seekMedia(...,true)`) with **SSAA** (`renderExportFrame`), saves a PNG via the native Save dialog (Electron) / download (browser). No audio mix. Estimate line shows "res² PNG · 1 frame (full quality)". Verified: valid 87 KB PNG, ss=2.
- [x] **Diagnostics session log:** `DIAG` ring buffer + `diag(level,tag,msg,extra)`. Auto-captures: session header (UA, Electron, GPU via WEBGL_debug_renderer_info, MAX_TEXTURE_SIZE, screen), `window.error`/`unhandledrejection`, wrapped `console.error/warn` and `alert`, a 2 s `gl.getError` check (`glCheck`), a 5 s heartbeat (active seq, clip/media counts, playing, playhead, JS heap), the `flashStatus` trail, and key actions (clip add/delete, transport, export start/done). In Electron it **auto-appends to `%APPDATA%/Dome Studio Pro/dome-diagnostics.log`** (IPC `dsp:diagWrite` truncate-then-append; survives a crash) so it can be read back after a test; flush on 5 s tick, on error, on `beforeunload`, and on tab-hide. Command palette: **"Save diagnostics log…"** (`saveDiagLog`) for on-demand export. Verified live: session/heartbeat/clip-add/synthetic-error all captured and formatted.

## ROUND 35 — "Dome fill" tiled layout: stacked rings to creatively fill the dome (user)
- [x] **New `domegrid` compose layout** — stacked tiled rings in ONE composition. Controls: **Rings** (concentric bands), **Segments** (per ring), **Elev. range** (coverage; up to 90° = converge at zenith = "infinite"), **Ring gap** / **Seg gap** (° separation; 0 = continuous/seamless), **Offset** (brick — alternate rings shifted half a segment), + multi-media (segments cycle the chosen media). `compLayout` lays out rings×segs (capped 160) annular sectors with per-element `_secAz/_secEl`; `compElProps` reads those (and keeps centers exact — also fixed a sub-degree seam in the plain ring-tile). `drawComposePreview` renders the real sector grid live. Count field hidden for domegrid (derived = rings×segs). Added to the dialog and the inspector compose panel.
- [x] Verified live: 3×10 dome fill renders the full segmented dome (horizon→zenith, screenshot); gaps narrow the sectors (sep works), brick shifts odd rings by half a segment, coverage→90 reaches zenith, and the domegrid nest round-trips (rings/segs/inner `warp:'dome'`).

## ROUND 34 — Perfect rings: annular-sector "dome tile" warp mode (user: ring clips cut diagonally where they overlap)
_Root cause: clips render as **gnomonic tangent patches** (a flat rectangle placed tangent to the dome at az/el, warped to fisheye). Flat rectangles don't tessellate on a sphere — adjacent ones overlap with slanted seams (the "diagonal cuts"). Reference domes build rings from **annular sectors** that follow the dome's az/el grid, so they tile seamlessly. Not a bug in our warp — a different, complementary projection intent._
- [x] **New `warp:'dome'` (annular sector) mode.** `VSW` gains a sector branch: `a_flat.x→azimuth span`, `a_flat.y→elevation band`, placed directly on the fisheye disc (`rho=(π/2−el)/(π/2)`, `ndc=rho·(sin az,−cos az)`) — matches `dirAzEl`. Uniforms `u_sector,u_azC,u_azSpan,u_elC,u_elSpan`; the gnomonic path is byte-identical when `u_sector=0`. The 120-subdiv mesh + unchanged `FSW` mean all FX/mask/grade/blend still apply. Per-clip props `warp/secAz/secEl` (default `patch`/60/30).
- [x] **Compose "Seamless tile" + Band.** Ring/grid get a **Tile** checkbox; ring adds a **Band (°)** field. `compElProps` gives each element `warp:'dome'`, `secAz=360/count` (ring) or grid cell spans, `secEl=band` → N sectors tile the full 360° with no gaps/overlap. Stacking tiled rings at different elevation bands builds the segmented dome grid from the references. The dome schematic (`drawComposePreview`) draws real annular sectors when tiling.
- [x] Verified live: 8-sector tiled ring renders a seamless annulus (radial seams to zenith, concentric arcs — screenshot), multi-media + tile round-trip (tile/band/inner `warp:'dome'`/`secAz` survive save/load), and default clips stay `patch` (gnomonic unchanged); shader compiles clean.

## ROUND 33+ — Compose dialog rework: multi-media + Line layout + fixed layout (user)
- [x] **Fixed layout, preview pinned right.** The Create/Edit composition modal is now a two-column flex (582px): controls left (fixed `min-height` so the box doesn't jump as per-layout rows show/hide), live dome **preview on the right**. Long media filenames no longer overflow — the Media control is a scrollable checkbox **list** with per-item ellipsis (`.cmedialist`/`.cmname`, full name on hover).
- [x] **Multiple media per composition.** Media is now multi-select (checkboxes); `comp.mediaIds[]` cycles across the composed elements (element i → `mediaIds[i % n]`). `createComposition`/`regenComposeNest` build each nest clip from its assigned source; `mediaId` kept = first for back-compat. Verified: 4-element ring over 2 media → clips cycle A,B,A,B and survive save/load (mediaIds + per-clip mediaId round-trip).
- [x] **New `line` layout.** A line of elements crossing the dome, with a **"Rotate 180° through center"** toggle: ON = full diameter through the zenith (az flips 180° at center, el 0→90→0 — verified az [180,180,0,0,0] / el [0,45,90,45,0]); OFF = a straight radial line at one azimuth, el spanning the Elev. range (stays in place). Added to the dialog, the inspector compose panel, and `kindES`.

## ROUND 32 — Inline rename + multi-clip trim/fade + compose-in-inspector + compose schematic (user, 4 items)
- [x] **Inline rename (edit in place, no floating dialog).** New `inlineEdit(el,value,commit)` makes the label `contenteditable` where it lives (Enter commits, Esc cancels, blur commits). Wired into `renameLane` (the `.nm` in the lane header), the clip-name branch of `renameSelection`/Ctrl+R (the clip `.tt`), and `renameSequence` (the tab `.seqlab`, tabs now carry `data-seq`). Guards added so editing doesn't trigger drags/shortcuts: `#tracks` pointerdown, lane-header click/dblclick, seq-tab click all bail on `e.target.isContentEditable`; the global keydown handler ignores contenteditable. Each falls back to `appPrompt` if the element isn't found. Verified: rename commits on blur, Esc cancels.
- [x] **Multi-clip trim & fade apply to all selected.** `drag.items` now captures each selected clip's `start0/dur0/inP0`; `trimItem(it,edge,delta)` trims one clip clamped to its own source/content limits; the trimL/trimR branches apply the primary's snapped delta to every selected clip. `startFadeDrag` captures all selected clips' base fade and applies the same delta to each (clamped to each clip's dur). Verified: two clips on different tracks both 6→4.5 s on trim; both get fadeIn 0.72 on a single fade drag.
- [x] **Compose tools in the inspector.** Selecting a nest clip that has `m.comp` now shows a Composition panel at the top of the inspector: a live dome schematic + layout selector + Count/Elevation/Size + "More options…". Edits call `regenComposeNest(m)` (rebuilds the nest's `nestClips/nestLanes` from `compLayout(m.comp)`; reloads state if that nest is the active tab). "More options…" opens the full compose dialog in nest mode (`openCompose(kind,null,m)` → `nestMedia.comp` apply path). Verified: count 4→7 regenerates inner clips, preview paints.
- [x] **Compose dialog schematic.** Added `drawComposePreview(g,canvas)` — plots `compLayout` on a fisheye dome disc (front=bottom, right=right, elevation rings, numbered colored dots sized by element size). Live `<canvas id="cPrev">` in the Create-composition modal updates on every param change (and the inspector reuses it as `#icPrev`). Verified: spiral×9 renders the spiral of numbered dots; "N elements · layout" caption.

## ROUND 31 — Sequence UX fixes (user, 4 items)
- [x] **Double-click a nest/compose clip opens its sequence.** The `#tracks` dblclick was being eaten by the move-drag's pointerup/DOM-rebuild, so added manual double-click detection in the clip pointerdown (`state._lastClipClick`, two pointerdowns on the same clip <400ms → `openSeq`). Verified live (re-querying the rebuilt DOM each click → opens).
- [x] **Nest clip max length = its inner content.** `srcLim` in `onTLMove` now includes `isSeqMedia(m)`, so a nest/sequence clip's right-trim clamps to `m.dur` (= `seqDur`, the inner content span). Verified: trimming a 5 s nest 4000px right stays at 5 s.
- [x] **Track-scoped time selection (Ableton).** `startTimeSelect` now tracks the lanes the drag spans vertically (`lanesBetweenY`, stored in `state.tl.selLanes`) and selects only clips in those tracks — drag within one track selects that track only; drag up/down adds tracks. `renderTimeSel` draws the highlight band only over the selected tracks (sets top/height/bottom from the lane rects). Verified: within lane 1 → selects lane 1 only; lane 0→2 drag → selects 0,1,2.
- [x] **Compose dialog layout buttons no longer overflow.** `.kindseg` switched to `flex-wrap` (7 layout buttons wrap into 3 rows, min-width 78px, each its own border) — all inside the 430px modal (verified lastBtn 509 < modalRight 525). Also excluded sequences from the compose **Media** source list (`!isSeqMedia`) so you can't compose the active sequence into itself.

## ROUND 30 — Unified Premiere-style sequences (user: secuencias = media, pestañas en el timeline, sin aviso de nest)
_Big structural refactor: a **sequence IS a media item** (`kind:'nest'`). Removed the separate `state.sequences[]` array, the top-bar `#seqBar`, and the `_nestStack`/`enterNest`/`exitNest`/`updNestBar` "editing nest" mode + its floating notice._
- [x] **Model.** `state.openSeqs` (ordered open-tab ids) + `state.activeSeqId` (active sequence media-id) + `state.seqW/seqH`. `state.clips/lanes/markers/groups/playhead/work` mirror the active sequence's `nestClips/nestLanes/nestMarkers/nestGroups/nestPlayhead/nestWork*`. Functions: `isSeqMedia`, `newSeqMedia`, `ensureSequences`, `saveActiveSeq`, `loadSeqIntoState`, `openSeq`, `switchSeq`, `closeSeqTab`, `deleteSequenceMedia`, `newSequenceDialog`, `updFmtChip`.
- [x] **New-sequence dialog** (Name / Resolution / FPS) — default **4096²/60**. Compose (`createComposition`) and `nestSelection` now build a sequence via `newSeqMedia` (inherits the active project resolution) and drop a nest clip in the current sequence.
- [x] **Tabs in the timeline header** (`#seqTabs`, Premiere-style): switch / rename (dbl-click) / close (✕) / new (＋) / right-click menu. Timeline height 368→**402px** so the 4 default tracks still fit exactly under the new tab strip (tlscroll clientH back to 354, 0 vertical scroll). No more "editing nest" banner.
- [x] **Sequences live in the media bin** (SEQ badge): double-click opens it as a tab; drag adds it as a nest clip; self-nest guarded (`addClip` blocks `m.id===activeSeqId`). The active/open sequence is what exports (export-dialog defaults read `activeSeq().w/fps`).
- [x] **Serialization v4**: `serProject` emits `media` (sequences included as nests) + `openSeqs` + `activeSeqId` + `seqW/seqH`; `serMedia` persists the per-sequence fields. `loadProject` handles v4, converts **v3** (`obj.sequences[]` → nest media) and **v2** (single timeline → "Sequence 1"). `ensureNestFBO` no longer clobbers the sequence's declared w/h to COMP.
- [x] **Adversarial multi-agent review (21 agents, 5 dimensions → skeptic verify): 8 confirmed findings, all fixed & re-verified:** (1) `saveActiveSeq` leaked a 2048² FBO+texture per autosave (nulled `fbo/tex` without deleting → re-alloc) → stop nulling (renderNest re-composites every frame; serMedia omits them); (2) post-load `_id` max-scan omitted `nestMarkers/nestGroups/comp.id` → uid() collisions → extended scan; (3) `deleteSequenceMedia` left orphan nest clips referencing the deleted sequence → filter `nestClips` across all sequences + `state.clips`; (4) **export froze videos nested inside a nest** (`seekExport` used top-level `activeClips`) → now `collectActiveVideos` descends into nests (mirrors playback); (5) bin-deleting media used only in a non-active nest left dangling clips + made it unrestorable by undo → filter/restore across all sequences; (6) render-ahead pre-render skipped `prepNests` → cached frames dropped nested content → added `prepNests` before composite; (7) export dialog left `#fmtChip` stuck on dialog values when closed without exporting → restore on close; (8) export size estimate ignored the work area → work-area-aware `secs`. Verified live: init, multi-seq isolation, compose→seq (resolution inherited), dbl-click open, close-tab, save/load v4 + v3/v2 back-compat, FBO stability across autosaves, dangling-clip cleanup, self-nest guard, 4-track exact fit.

## ROUND 29 — Media bin: skip duplicate imports (user: "a veces aparecen elementos en media dos veces")
- [x] **Dedup on import.** `importFiles` now filters the incoming files against what's already in Media before adding: key = absolute path (`filePath`/Electron) **or** `name|byte-size` fallback. Catches re-drops, double-fired drop events, and the same file selected twice in one batch (intra-batch dedup too). Skipped count is reported via `flashStatus`. **Missing** media is excluded from the dedup set so re-importing a relocated file still relinks through `adopt()`. Stored `fsize` on image/video/audio media (+ serialized in `serMedia`) so the name+size key survives reloads. Verified live (stubbed `add*`): re-import of an existing file skipped (only the new one passes), double-drop in one batch → one pass, different size with same name still passes, missing-media re-import still passes for relink.

## ROUND 28 — Ableton-style ghost-drag for clips + Ctrl=copy (user)
- [x] **Original stays, ghost shows the landing spot.** Moving a clip no longer mutates it live. In `move` mode, `onTLMove` keeps every selected clip in place and draws a translucent `.moveghost` (clip color, title band, snap line) at the snapped destination — within the same track, across tracks (single-clip lane change to the same-kind lane under the cursor), and for multi-selection (all ghosts shift by the same applied delta). `onTLUp` applies the move. Trims (`trimL/trimR`) are unchanged (still live, like Ableton).
- [x] **Ctrl/Cmd-drag = copy.** Holding Ctrl during the drag flags `drag._copy`; the ghost border turns accent-blue with a `＋` in the title, and on release `duplicateClipAt` clones each dragged clip at the destination (deep-copies `props`/`kf`/`_auto*`, fresh `id`, rebuilds mask tex) instead of moving the originals; selection jumps to the new copies.
- [x] **Media drag shows a clip-shaped landing ghost.** `startMediaDrag` now previews a `.moveghost` (media color + name) on the track under the cursor at the snapped start, dims the floating thumbnail, and shows the snap line — only over a same-kind lane; drops at the previewed position. Verified live via synthetic pointer events: in-track move (2s→4s, original held at 2s mid-drag), Ctrl-copy (original held at lane0/2s, copy at lane1/3s), cross-lane, and media-drop (lane2/3s with landing ghost); screenshot confirms original + accent ghost shown simultaneously.

## ROUND 27 — Fixed timecode counter (white=TC, gray=frames; constant width)
- [x] **Counter decoupled from the TC/Frames toggle.** `positionPlayhead` now always sets `#tc` = `TC()` (white, MM:SS:FF) and `#bbt` = `Math.round(playhead*fps)+'f'` (gray, total frames). The TC/Frames segment only drives the **ruler/grid** (`fmtTime`); the counter is identical in both modes. Verified: at 47 s both modes show `00:47:00` / `2820f`.
- [x] **Constant-width counter box.** `.tcbox` centered with `font-variant-numeric:tabular-nums`; `.tc` `min-width:80px` (centered) and `.du` `min-width:54px` (right-aligned) reserve fixed slots so the box doesn't resize as the playhead advances. Verified box width constant at **181px** from 0 → 75 min.

## ROUND 26 — Transport centered + remove viewport hint + orbit R/L flip (user)
- [x] **Transport centered.** Wrapped the transport cluster (toStart · play · toEnd · timecode · TC/Frames · loop · locator nav) back in `.tccenter` (absolute-centered), and moved Snap + grid readout into the right group with Automation/zoom (pushed right by the flex spacer). Verified `.tccenter` present + Snap in the right group.
- [x] **Removed the viewport hint** text "Click to select · drag to move on the dome · wheel to zoom" (`#hint` element deleted; the `txt('#hint',…)` i18n line null-guards, harmless).
- [x] **3D orbit Right/Left.** Measured (788px canvas, white@az90/RIGHT + red@az270/LEFT): orbit was self-consistent and matched the 2D top-down master (RIGHT on the right) — i.e. **mirrored vs the in-dome / Viewer (spec) experience**, which is why it read as inverted. Set the 3D `flipx` to `-1` for **both** modes (was `spec?-1:1`, so only orbit changed +1→−1) in the dome render AND `drawLabels3D`, so orbit adopts the audience handedness. Verified after: RIGHT(white) now renders on the left (0.35) with the RIGHT label (0.32) — content stays under its own label (both flip together), and spec is unchanged.

## ROUND 25 — Transport reorg + loop=Ctrl+L + bigger default + Ableton clips (user, with screenshots)
- [x] **Transport bar reorganized** (per the user's before/after image): play button moved into the transport group (`⏮ ▶ ⏭`), then the timecode box, then the `TC/Frames` toggle, then loop + locator nav, then Snap + grid readout; Automation/zoom stay right. **Removed the 120-BPM box and the "Bars" mode button** (`#bpmBox` element + its tempo-drag handler deleted — that handler was an unguarded `$('#bpmBox')` that would have thrown on load; `txt/ttl` i18n helpers already null-guard so the leftover bars/bpm i18n lines are harmless). `.tccenter` absolute-centering dropped (single flex flow).
- [x] **Loop button = Ctrl+L.** `#loopBtn.onclick` now calls `loopSelection()` (set loop region to the time selection / selected clip and toggle), identical to the shortcut.
- [x] **Bigger default editor.** Default timeline height 248→**368px**; default track height `LANE_DEF_H` 64→**82** (4 tracks fill the 368px timeline exactly: track area 328 = tlscroll 354 − ruler 26, 328/4=82 — verified gap 0, no vertical scroll); default project lanes are now **4 video tracks (Video 1–4)** (user confirmed video, not audio). Updated both the initial `state.lanes` and `newProject()`.
- [x] **Ableton-style clips.** Clip headband (`.tt`) is now a **flat solid bar in the clip's color** (set inline `background:${c.color}`) with the name, height 13→**15px** (`RES_TOP`=15 to match the automation overlay), **grab** cursor; body is **translucent** (`.clip` background transparent, `.fill` opacity .42, lighter scrim) so the **grid shows through**; **body cursor = arrow** (fixed `applyToolCursor` select case from `grab`→`default`; the `.tt` keeps grab via CSS → hand only on the title bar). Headband text color auto-picks dark/light by clip-color luminance (`textOn`) for readability. Verified live: 4 video tracks, taller timeline, headband=grab + body=arrow, loop button sets the loop region, no console errors; screenshot shows colored headbands + translucent bodies revealing the gridlines.

## ROUND 23-fix3 — THE actual playhead-vs-cursor desync: ruler scrub double-counted scrollLeft
_Decisive clue from the user: scrubbing tracked the cursor fine, but after zooming with **ctrl+scroll** the playhead drifted from the cursor with an offset that **grew** as you zoomed; zooming with the **buttons** never broke it. Buttons don't change `scrollLeft`; ctrl+scroll does → the offset was ≈`scrollLeft`._
- [x] **Root cause:** the `#ruler` is `position:sticky`, so `ruler.getBoundingClientRect().left` **already** shifts left by `scrollLeft` when scrolled (measured: at scrollLeft 200, ruler.left went 194→−6). The three ruler handlers (scrub pointerdown, dblclick, contextmenu) computed time as `clientX - ruler.left + scrollLeft` — **double-counting** `scrollLeft`. So the scrubbed playhead landed at cursor + scrollLeft, and since ctrl+scroll zoom grows `scrollLeft`, the offset grew with every zoom (buttons keep scrollLeft → no offset, which is why they "worked"). Fix: drop the `+scrollLeft` in all three (the sticky rect.left is already the scrolled content origin). Verified: across 8 zoom levels (pps 40→191, scrollLeft 0→1131) the playhead lands 0–1px from the cursor (was = scrollLeft: 0,75,169,286,433,616,845,1131). _The earlier `_scrollTarget` zoom-anchor fix stays — it's correct and needed for the cursor-time invariance — but this scrub double-count was the bug the user actually saw._

## ROUND 23-fix — Grid not infinite + zoom-at-cursor desync (user report)
- [x] **Grid lost to the right.** `#tracks` had no explicit width, so its box was only the viewport width (clientWidth 422 vs content 960) and the `repeating-linear-gradient` gridlines only painted across the visible area. Fix: set `tracks.style.width = W` in renderTimeline. Verified: clientWidth now == content width, and it keeps growing as you scroll right (960→1213→1466→1972…, `neededSec()` grows + re-render) so the grid is effectively infinite.
- [x] **Ctrl+scroll zoom desynced from the cursor (content drifted right).** Root cause: at a far scroll position the target `scrollLeft` (nx) exceeds the current content width, so it **clamps**. First attempt (set `scrollLeft=nx` then render then re-set) FAILED for far positions — confirmed from the user's screen recording (`ffmpeg` frames: playhead at ~7s drifted from under the cursor to ~123px right of it after zoom-in) — because setting `scrollLeft=nx` against the still-old/narrow DOM width clamps, so `neededSec()` then computed W from the clamped value and the final set clamped again. **Correct fix:** added `state.tl._scrollTarget`; `neededSec()` widens to `max(scrollLeft, _scrollTarget)`; `tlZoomAt` sets `_scrollTarget=nx` BEFORE renderTimeline (W grows to cover nx without touching scrollLeft), then applies `scrollLeft=nx`, then clears it. Verified deep in the timeline (scrubbed to ~7–14 min): 10 successive zoom-ins, **no clamping**, cursor-time drift ≤4px (sub-pixel rounding).

## ROUND 23 — Timeline grid + clip title bar + time selection + Arrangement loop (Ableton, online manual study)
_Per user: (1) clips need a title bar at the top that is the drag-to-move handle (so the clip moves even in automation mode, and the body is free to select the grid); (2) add a timeline GRID that adapts to zoom and lets you follow/select/loop with Ctrl+L, shown in frames/timecode. Studied the Live 12 "Arrangement View" manual._
- [x] **Clip title bar = the only move handle.** `.clip .tt` is now a full-width top strip (13px, name, grab cursor, `pointer-events:auto`, z-index 2, highlighted when selected) matching `RES_TOP`. In `#tracks` pointerdown, **only the title bar (or trim/fade handles) starts a move/trim**; dragging the clip **body** now starts a **time selection** instead (Ableton: "only the clip bar is draggable"). Works in automation mode because the title bar sits above the envelope canvas.
- [x] **Time selection.** Dragging the clip body or empty lane area drags a highlighted span (`state.tl.selA/selB`, `#timeSel` band, snapped), selecting the overlapping clips; a plain click clears it (deselects on empty). `startTimeSelect`/`renderTimeSel`.
- [x] **Arrangement loop (Ctrl+L).** `loopSelection()` sets the loop region (`workIn/workOut`, which `ploop` already loops) to the time selection — or the selected clip's extent — and toggles the loop (re-pressing the same selection clears it). The loop **brace** (`#workArea`) is draggable: a top strip moves it, the `.wkh` ends resize it (grid-snapped); the full-height shading is `pointer-events:none` so it never blocks clips beneath.
- [x] **Adaptive grid.** Central `gridSec()` (zoom-adaptive `gridBaseAdaptive()` × narrow/widen, or a fixed step) drives the ruler ticks, snapping (`snapGrid` returns `gridSec()` or 0 when off), and **visible vertical gridlines** as a `repeating-linear-gradient` (minor+major) on the `#tracks` background that scrolls with content. **Ctrl+1** narrower / **Ctrl+2** wider / **Ctrl+5** adaptive↔fixed / **Ctrl+4** snap; **Alt** bypasses snap. A `#gridReadout` chip by Snap shows the spacing in **frames or seconds per the TC/Frames mode** (`◇` adaptive / `▦` fixed), click toggles fixed, right-click for the menu. Verified live: gridlines adapt on narrow/widen/fixed, title-bar drag moves the clip (2→4 s), body drag makes a 2 s selection, Ctrl+L sets the loop, no console errors; screenshot shows gridlines + title bars + gold loop brace.

## ROUND 21 — Ableton-style automation (Automatizacion_Keyframes_Ableton.md, tickets A1–A6)
_Per the spec MD: replicate Ableton's automation-envelope UX on top of the inspector stopwatch, superseding the older [2]/[21] inline-curve work. One ticket at a time, each verified live; reuses the single keyframe engine (`kf`/`evalP`/`setKf`) — no second animation model._

- [x] **[A1] "Curves" → "Automation" toggle; legacy drawer deleted.** The button now only shows/hides the inline automation sub-lanes (no separate window). Removed the dead `#curveDrawer`/`#curveCv`/`#curveGraph` DOM + `renderCurves`/`drawCurveGraph`/`wireCurve`/`curveZoomAt` JS + all `graphOpen` guards (kept `initBez`, reused by the inline menus). **GOTCHA fixed during this:** a stray top-level `$('#curveGraph').addEventListener(...)` against the now-removed node threw at load and aborted init (left `undoStack` in TDZ → every `pushUndo` failed) — removed it. Lesson again: a top-level `$('#gone')` returns null and kills the whole init.
- [x] **[A2] Per-lane parameter selector + "+"/"-".** Each automation sub-lane header now has a `<select>` (any of the animable params) — changing it swaps the lane's envelope (`setAutoLaneParam`). A **"+"** adds another lane on the first unused param (`addAutoLane`); **"✕"** removes that lane (`closeAutoLane`, by index so duplicates are safe). Verified: 2 lanes render with 2 working dropdowns (Opacity, Size), +/✕ present.
- [x] **[A3] Inspector stopwatch arms + opens the lane** (kept from [2]): stopwatch → `setKf` + `openAuto`; un-arming clears the kf + `_autoOff` + closes the lane. Verified.
- [x] **[A4] Dashed baseline + Alt-drag-to-curve.** `drawAutoCurve` now draws a **dashed, dimmed** line when the param has no keyframes (static, not automated) and a **solid** colored line once automated (`ctx.setLineDash`). **Alt-dragging a segment** between two keyframes bends it: seeds bezier handles on the bracketing keyframes (`A.hOut`/`B.hIn`, `dv = bend·1.33`). Verified: Size lane (no kf) renders dashed, Opacity lane (2 kf) solid; synthetic alt-drag turned kf0 into `bezier` with `hOut.dv≈39.9`, kf1 got `hIn`. Existing add/move/delete/handle/snap/interp-menu retained.
- [x] **[A5] Track context menu.** Right-click a clip → **Show Automation** (`showAutomation` — turns lanes on, opens a lane), **Show Automation in New Lane** (= "+"), **Return to Default** (`returnToDefault` — freezes each param at its current value, clears all kf + `_autoOff` + closes lanes). Verified: returnToDefault drops all automation to static.
- [x] **ROUND 22 — Automation rewritten to match Ableton (online manual study + 30-agent adversarial audit).** User asks: (1) automation mode shows envelopes on ALL tracks, one over each clip, opacity by default; (2) drag-select multiple breakpoints; (3) resizable automation sub-lanes; (4) curve with Alt-drag on the line instead of a right-click easing menu — plus "analiza online cómo funciona Ableton". Researched the Live 12 manual ("Automation and Editing Envelopes"): click line=add breakpoint, click point=delete, drag point=move (selection moves together), drag segment vertically=move, Alt-drag=curve / Alt-dbl-click=straighten, Shift=fine, drag background=marquee-select, lanes resizable by their bottom edge. Then ran a multi-agent audit of the prior overlay implementation → **16 confirmed bugs** (7 of them the same critical class: the full-width overlay canvas, a *sibling* of the clips, hijacked clip move/trim/fade/select/nest-enter and started a marquee on sibling clicks). **Full rewrite:**
  - **Envelope canvas is now a CHILD of each `.clip`** (`attachClipAuto`), covering the clip body **below a reserved `RES_TOP=13px` title band**, with clip chrome (`.tt` name, `.hd` trim, `.fadeh` fades, `.kfstrip`/`.kfd`) z-indexed ABOVE it. So clip move (drag title band), trim, fade, kfd-seek and selecting/dragging sibling clips all keep working while automation is shown — the whole critical class is gone (verified by `elementFromPoint`: trim→`hd`, title→clip body, fade→`fadeh`, body→`clipautocv`). Clip-local coords via `cv._local` (`ox=c.start*pps`).
  - **Shown on EVERY video clip** when automation mode is on (opacity default), not just the selected one; the param **chip** (swatch + `<select>` + A + ↻ + "+") shows only on the selected clip, anchored top-right so it never covers the name (audit #14). Audio lanes & collapsed lanes are skipped (`isAudioClip` guards in `openAuto`/`showAutomation`/`addAutoLane`/`attachClipAuto`/`appendAutoLanes`; audit #11/#12/#13).
  - **Gestures (textual Ableton):** click line=add · click point=delete · drag point=move (moves the whole marquee selection if the point is in it) · drag segment vertically=move (lead/mid/trail/flat via `segAround`) · Alt-drag=curve (bezier) · Alt-dbl-click=straighten · Shift=fine (×0.25) · grid snap is clip-local to the grid step (no longer snapping to foreign clips/playhead, audit #8) · click on the line within 0.02s of a point selects it instead of overwriting (audit #9) · **drag in the background = marquee-select breakpoints** (amber), then drag any selected one to move them together or press **Delete** to remove them all. **pushUndo is lazy** (only on a real mutation, so a plain click / double-click no longer pollutes undo with 2–3 snapshots; audit #10).
  - **Right-click easing menu removed** (curving is Alt-drag now); right-click = Add/Delete breakpoint, Delete selected, Clear automation. Breakpoints drawn as squares; ghost-point on hover; value tooltip while dragging; `ns-resize` cursor on the line, `pointer` on a point, `crosshair` on background.
  - **Sub-lanes (params 2+) are resizable** (`.autores` bottom handle → `c._autoH[param]`, `autoLaneH`); `addAutoLane` guards the "all params shown" case (audit #16); `.kfd` is now clickable (audit #15).
  - Verified live with synthetic pointer events: all-clips overlay (2 canvases/1 chip), sibling-click selects (no marquee), click-add, click-delete, 2D drag (fixed a delta-vs-live-keyframe bug), marquee selects 3 + Delete removes 3, alt-curve+alt-straighten, segment vertical drag, resizable lane 58→98, audio clip gets no canvas, and trim/title/fade hit-tests resolve to the clip not the canvas. Screenshot confirms two clips both showing their opacity envelope, chip only on the selected one, names readable.
- [x] **[A2-fix2] Ableton-faithful in-track envelope editing (user: "cópialo textual, es comodísimo editar la automatización directo en la pista").** Reworked `bindAutoCurve` + `drawAutoCurve` to match Live's automation gestures exactly: **click on the line = add a breakpoint** (press-release, no drag needed); **drag a line segment vertically = move that segment** (`segAround` finds the lead/mid/trail/flat segment; mid translates both bounding breakpoints, lead/trail move the end breakpoint, flat with no breakpoints moves the static value with NO keyframe created — like dragging Live's constant envelope); **drag a breakpoint = free 2D move**; **Shift = fine** value drag (×0.25); **Alt-drag a segment = curve it** (bezier, retained); **double-click a breakpoint = delete**. Visual fidelity: breakpoints are small **squares**, a faint **ghost breakpoint** previews where a click will add while hovering the line, a **value tooltip** (e.g. "68 %") follows the dragged point/segment, and the cursor is **`ns-resize` over the line / `pointer` over a point**. Click-vs-drag is disambiguated by a 4px move threshold so a plain click always adds and a drag always moves. Verified live (synthetic pointer events): hover→ghost+ns-resize; flat-line drag down → static value 50→lower, no kf; click → +1 breakpoint; mid-segment drag down → both breakpoints move together; breakpoint 2D drag 85→68; clip stays selected throughout.
- [x] **[A2-fix] Primary param overlaid ON the track + click-to-add (user report).** First report: "no quedó bien integrado — debería mostrarse dentro de la misma pista hasta que agregue más subpistas, y al hacer clic/doble-clic en la línea no se crean keyframes y la subpista se cierra." Two fixes: **(1)** the primary automation param (`c._auto[0]`) now draws as an **overlay on the clip's own track** (`appendClipAutoOverlay` → `.autoover` canvas + `.autochip` control: swatch + param `<select>` + A + ↻ + "+"); only params added with **"+"** become sub-lanes below (`appendAutoLanes` now skips index 0). Stopwatch arming makes that param the primary (`openAuto` unshifts). **(2)** Keyframe creation was broken because the autocv click bubbled to `#tracks` → `startMarquee` deselected the clip → `selClip()` null → the lane closed before the dblclick landed. Added `e.stopPropagation()` on the curve handlers (only when the click is within the clip's curve region, so clicks elsewhere still select other clips), made **single-click on the line add a breakpoint then drag it** (Ableton), and `inv` now returns null outside the clip bounds (no stray keyframes). Verified live: automation ON → 1 overlay in-track / 0 sub-lanes / chip selector = opacity; single-click adds a kf (count 1) with the clip **still selected** and the overlay **still open**; "+" → 1 overlay + 1 sub-lane. Screenshot confirms the envelope (3 kf) drawn over the clip with the chip.
- [x] **[A6] Auto-override on manual edit + Re-Enable.** New `manualEdit(c,p,v)` routes every **by-hand** edit (inspector value drag/type/wheel, viewport element move) so that editing an **automated** param sets `_autoOff[p]` (curve bypassed but **kept**) and holds the manual value — Ableton-style override. Re-Enable restores it: a **per-param ↻** appears in the inspector row when overridden, a **global "↻ Re-Enable"** button (`#reEnAll`) appears in the toolbar whenever any param is overridden (`anyOverride`/`updReEnableGlobal`), and `reenableAll` clears them all. Verified: manualEdit on an automated `az` (following=155) → `_autoOff.az=true`, held 123, global+inspector buttons shown; `reenableAuto`/`reenableAll` → follows curve again, buttons hidden. _The diamond "add keyframe" button + the inline lane remain the explicit curve-authoring paths; the value knob overrides, exactly like Ableton._

## ROUND 20 — Compose creates a NEST (Premiere-style), not a spread-out group
_Per user: a composition should drop a single **nest** clip into the current sequence; double-clicking it enters the nest as its own editable sequence. Supersedes the ROUND-17 [20] deviation (which kept composes as an editable group spread across the current timeline's lanes)._

- [x] **`createComposition` now builds a nest** — the ring/grid/spiral/phyllo/wave/fib/random layout (`compLayout`) becomes the `nestClips` of a new `kind:'nest'` media (one composed element per `nestLane` → no same-lane overlap → no spurious crossfade), carrying the az/el/size geometry + mask. A single nest clip (`props.fulldome=true`) is dropped into the **current** sequence at the playhead and selected; it surfaces as a `#seqBar` nest tab, and double-clicking it enters it (existing `enterNest` FBO path). Verified live: ring×6 → **1 nest clip** in the sequence (`clipsInSeq:1`), 6 internal clips on 6 lanes, az [0,60,120,180,240,300], seqBar nest tab, double-click enters (6 clips) / exit returns (1 clip), renders (~10% lit), no console errors. _The legacy group machinery (`regenComp` + group inspector) stays for back-compat with older `.rdome` projects; new composes are nests._
- [x] **Nest-internal videos play/scrub from the parent sequence** — videos inside a nest were frozen during main-sequence playback (`ploop`/`play`/`scrubRender` only drove top-level `kind:'video'` clips; a nest clip is `kind:'nest'`, so its inner videos only ran when you entered the nest to edit). Added `collectActiveVideos(clips,lanes,t)` — recurses into active nests with local-time adjustment, deduped by media — and routed `play()`, `ploop()` and `scrubRender()` through it. Verified: a video-ring nest played from the main sequence advances the inner video (0 → 0.93 s in ~0.9 s, `requestVideoFrameCallback` pumping the texture); was frozen before. Same path fixes scrubbing the nest from the parent.

## ROUND 19 — Fix: `window.prompt()` is dead in Electron → in-app prompt modal
_Caught from a user report ("Ctrl+R no funciona"). The 23-corrections audit had passed in the **web preview**, but `window.prompt()` is unsupported in the packaged Electron `.exe` (returns null), so every prompt-based dialog silently did nothing there — which is why several features "worked in dev but not the .exe"._

- [x] **`appPrompt(message, def, cb)`** — a styled in-app modal (overlay + input + OK/Cancel; Enter commits, Esc cancels, click-outside cancels) that works in Electron. Replaced **all 11 `window.prompt()` call sites**: rename clip / track / sequence / nest-tab / locator (×2) — via `Ctrl+R` and context menus — plus curve "Set value…", export "Save preset", "New folder", and the "Set clip start (seconds)" command. Verified live: `Ctrl+R` on a selected clip opens the modal pre-filled with the name, Enter renames (`clip.name` updates), Esc cancels with no change, modal closes; no console errors. _Lesson: Electron-sensitive APIs (`prompt`/`alert`/`confirm`) must be verified in the packaged build, not only the web preview where they work natively._

## ROUND 18 — Fluid playback engine · Tier 1 (decode + cache) + [T4] render-ahead
_From `Motor_Reproduccion_Fluido.md`. Phase 0 profiled live first, then implemented one point at a time, each measured in the WebGL2 preview. Additive + fallback (the old `<video>`+seek path stays for media without chunks). No console errors; serialization safe (`serMedia` is a whitelist → chunks never enter the `.rdome`)._

- [x] **Phase 0 — profiling (measured, not guessed)** — instrumented decode/upload/composite via monkey-patch. **Bottleneck = seek-based decode during scrub, scaling super-linearly:** 1 layer 10 ms → 4 layers **691 ms** → 8 layers **3776 ms**. Upload (`texImage2D`) 0.2–1.9 ms and composite dispatch <0.15 ms were *not* bottlenecks (confirms the GPU compositing is fine — untouched). Paused-idle already does 0 composites/frame (so [T5] is moot). Forward playback ~55–61 fps but 8-layer texture uploads starved (rVFC) → some layers froze.
- [x] **[T2] All-intra proxy (GOP=1) + per-frame chunk capture** — `makeProxy` now encodes every frame as a keyframe and captures each `EncodedVideoChunk` (bytes+ts) into `m.frames` + the `decoderConfig` into `m.decConfig`, with a **256 MB/clip RAM cap** (long clips drop chunks → fall back to the now all-intra `<video>` seek, still faster than before). The MP4 proxy `<video>` is still produced (fallback/compat).
- [x] **[T1-core] WebCodecs random-access decode** — new module `ensureDecoder`/`decodeIntoCache`/`showFrame`: a reused `VideoDecoder` per source decodes the chunk for the requested frame (`F=round(t*fps)`). `seekMedia` routes here when `m.frames` exists; **export untouched** (uses the original via `useOrig=true`). Decode is async/off-thread (no UI block) even without a Worker.
- [x] **[T3] LRU frame-texture cache + pool reuse + lookahead** — decoded frames cached as GPU textures keyed by `mediaId:frame` (`_fcache`, `FC_MAX=64`, LRU evict that **never evicts a displayed `m.tex`**, freed textures recycled via `_fpool`); `showFrame` prefetches the next 2 frames. `disposeDecoder` purges a media's cache on delete (`disposeMedia` calls it); `clearFrameCache` on new project. "Only active clips" was already true (`scrubRender`→`activeClips`).
- **Verified live (real edited path, test clip 480×848 @30fps):** scrub per playhead move **4 layers 691→34.5 ms (~20×)**, **8 layers 3776→46.5 ms (~81×)**, now **linear**; revisiting a cached frame **0.3 ms** with an identical pixel signature (no corruption); decoded video renders correctly (`texFrame` tracks `round(t*fps)`, ~45 k lit px); playback intact (advances real-time, clean pause); deleting a cached media does not crash. Boots clean, 0 console errors.

- [x] **[T4] Render-ahead (preview cache)** — caches the flattened master composite per frame (downscaled to 1024² via `blitFramebuffer`; LRU `_ra`, `RA_MAX=120`; generation-counter invalidation bumped by `markDirty` — cheap, no texture deletes). `render()` blits the cached flat texture on a hit (skips `prepNests`+`composite`); `ploop` skips decoding the N video layers on a hit. `raPrerenderRange(t0,t1)` pre-renders a range ("render in/out") by composing **synchronously** from the [T3] frame cache (save/set/restore `m.tex` with no await between → atomic, no race with `ploop`). Wired into ⌘K: "Render-ahead: cache range for smooth playback" / "…off + clear cache". Flag-gated (`_raOn`, default off → render path byte-identical to before). Verified live: 8-layer playback **52.4 → 60.5 fps with 0 composites + 0 uploads** (pre-cached range replays a single flat texture → independent of layer count, so it holds 60 fps for 10/20+ layers); pre-render 61 frames/1.4 s; cache hit pixel-correct (modulo the 1024² downscale); edit invalidates → recomposite; off clears; no console errors.

- [x] **[T4] Auto render-ahead scheduler** — a background idle loop (`raStartIdle`/`raIdleTick`) pre-renders the work-area's next uncached frame whenever render-ahead is on and the app is idle, and **re-fills automatically after edits** (the generation bump marks frames stale). Started by the render-ahead command; stopped/cleared by "off". Verified: after a `markDirty` invalidation the work-area re-cached itself within ~1.8 s with no interaction; no console errors.

_Verdict: Tier 1 (scrub) + T4 (render-ahead playback, now auto-maintained) both met their criteria. Multi-layer scrubbing went from unusable (seconds) to fluid (tens of ms, linear, instant revisits); a heavy stretch plays at 60 fps doing zero decode/zero composite, and the cache fills + refreshes itself in the background. A **cache-map bar** (Premiere-style render strip) now draws along the bottom of the ruler (`drawCacheMap`, teal `#3CE0D6`) showing cached ranges live, verified by pixel readback (green in-range / none out-of-range / cleared on off). **[T7] (partial): frame-exact step + scrub** — `frameSnap(t)` quantizes to the project frame grid; `←/→` now snap-then-±1-frame (was accumulating sub-frame drift by adding `1/fps` to a float) and ruler scrub snaps to the grid, so the playhead/timecode are always frame-exact. Verified: from an off-grid 1.3337 s, `→`→1.35 s (81/60), `←←`→1.31667 s (79/60), all exact frame multiples. _Still pending in [T7]: grid-quantizing the displayed frame during **uncached** playback (cached playback already lands on the grid via the cache key) and an explicit audio-slaved-to-frame clock._ **Proxy generation no longer janks the UI** — `makeProxy` now captures source frames by **sequential 1× playback via `requestVideoFrameCallback`** (decode stays in the browser media pipeline, off the UI thread) instead of a per-frame `<video>.currentTime` seek that blocked the main thread; same contiguous all-intra `m.frames` output, seek fallback when rVFC is absent. Verified: UI held **60 fps (min 60)** through a full build, 463/463 contiguous keyframes, frame content varies across the timeline (not duplicated). Pending polish: disk cache for ranges beyond ~120 frames; proxy build *speed* (still ~real-time → needs a Worker/MP4-demuxer, [T9]); [T1] decoder in a Worker; [T9] proxy encode in a Worker._

## ROUND 17 — Correcciones [1]–[23] + endurecimiento (autonomous pass)
_Applied from `Correcciones_DomeStudioPro.md`, one fix at a time, each live-verified in the WebGL2 preview (gl.readPixels / DOM checks). No console errors at any step; the 3 smoke checks (boots clean · composite non-black · export writes a file) all pass._

- [x] **[1] Resizable + collapsible tracks (Ableton-style)** — each `state.lanes[i]` now has its own `h` + `collapsed`; `laneH(li)` ([app.js](Dome Studio Pro/app.js)) drives both the clip row and the header row. Header gets a collapse chevron (`[data-m=collapse]`) and a bottom-edge drag handle (`.laneres`); clips/waveform/curves reflow to the lane height. Verified: lane resized to 120px (row==header==120), collapsed to 20px (row==header==20), full stack rows-sum==headers-sum (268==268, perfectly aligned); marquee hit-test rewritten to read real DOM row geometry.
- [x] **[2] Inline automation sub-lanes (no drawer)** — "Curves" now toggles `state.inlineCurves`; the inspector **stopwatch** opens a per-parameter automation sub-lane under the clip (`openAuto`/`appendAutoLanes`/`drawAutoCurve`/`bindAutoCurve`). Multiple sub-lanes at once (Azimuth + Size), each independently editable (dbl-click add/remove point, drag, right-click easing incl. Free bézier) — reuses `evalP`/`setKf` (no second animation engine). Canvas lives inside `#tracks` so it scrolls with the clips. Verified: stopwatch→1 sub-lane, second param→2 sub-lanes, evalP interpolates (0→10,3→155,6→300), dbl-click add 2→3 / dbl-click point delete 3→2, "Curves" off→0 sub-lanes.
- [x] **[3] No ⌘K button** — removed `#cmdkBtn` + wiring; palette still opens via Ctrl+K / F1 / "?". Verified.
- [x] **[4] `C` selects the Razor tool** (cut lands where you click, with snap) instead of an instant playhead split; "Split at playhead" stays as a command/menu item. Verified C→tool='razor'.
- [x] **[5] `Ctrl+R` renames anything** — `renameSelection()` dispatches marker > clip > track > active sequence. Verified clip + track rename via stubbed prompt.
- [x] **[6][8] Nest = sequence** — nests now surface as tabs in `#seqBar` (`⊟` group, `.nesttab`); click the tab or double-click the nest clip enters it to edit (existing `enterNest` FBO path kept). Verified: nest→1 tab "Nest 1", dbl-click enters (2 subclips, tab active), exit returns, tab-click enters. _Deviation (documented):_ composes stay editable groups (see [20]) rather than literal nests, to preserve the verified Transform-all group UX.
- [x] **[7] Fades drawn as the real opacity-envelope curve** over the clip (rises over fade-in, flat, falls over fade-out) as an SVG polyline `.fadeenv`, corner handles still draggable; crossfade shows the two crossing lines (`.xfade`). Verified envelope SVG renders.
- [x] **[9] Blend dropdown applies** — verified `change`→`clip.props.blend` + re-render (was already wired; confirmed live).
- [x] **[10] Inspector NumberBox** — dbl-click→type→Enter/Esc, clean enter/exit (verified earlier rounds; the Easing/Transition/Fade rows that complicated it are now removed, see [11]).
- [x] **[11] Inspector without Transition / Fade / Easing** — removed those rows; `Easing` control replaced by `curEase()` default + per-keyframe easing in the curve right-click. Verified the three rows are gone, keyframe-add still works.
- [x] **[12] One media entry + proxy dot** — removed the broken proxy filter (`#proxySeg`); each media shows once with a status dot (grey=no proxy/generating, green=ready, `.pdot`, updated by `updProxyUI`). Verified grey→green on proxyReady.
- [x] **[13] Proxy only for video** — `enqProxy` is only called from the video import/relink paths; images/audio/text/shape/sequence/nest never enqueue. Verified by code path.
- [x] **[14] Grid toggle button** — `#dispSeg [data-d=grid]` toggles `state.view.showGrid`. Verified.
- [x] **[15] Crossfade blending fixed** — root cause: both clips were drawn at reduced opacity over transparent black → mid-overlap alpha & brightness **dip** (`[64,0,127] α191`). Now the dissolve keeps A fully under and fades B in over it (`aXf=1,bXf=f`) → stays opaque (α255), constant brightness (R+B=255), monotonic, no double-exposure — video & photo. dipBlack transition unchanged. Verified pixel-by-pixel across the overlap.
- [x] **[16] Preview quality affects only the clips, not the grid** — `previewQuality` no longer shrinks the screen canvas; it shrinks the **composite master texture** via `setCompSize(COMP*pq)` (compTex re-allocated to 512/1024/2048), while `glc`/`gridc`/dome-mesh/2D-overlays stay full-res. Verified ¼→compSize 512 with glc unchanged; grid stays crisp.
- [x] **[17] Export with no in/out = 0→duration()** — `runExport` already defaults the range to `0..duration()` when `workIn/workOut` are null. Verified.
- [x] **[18] Hover tooltip after ~1s** — delegated tooltip module converts `title`→`data-tip` (kills the native OS tooltip, mirrors to `aria-label`) and shows a styled `.dsp-tip` after 1000ms. Verified: shows "Save · Ctrl+S" after 1.15s, hides on leave, **works on repeat hovers** (the title-strip bug was caught and fixed).
- [x] **[19] Orbit LEFT/RIGHT** — investigated thoroughly; the orbit labels/projection are **already consistent** with the 2D master (top-down orbit: FRONT=bottom, BACK=top, RIGHT=right@710, LEFT=left@278; grid.png red=LEFT sits on screen-left in both 2D and orbit). No swap reproduces in the current build, so **no change made** — and the calibrated `u_flipx` of spec/2D was left untouched per the gotcha. Validated with `assets/media/grid.png`.
- [x] **[20] Composes → one element per lane, no crossfade** — `regenComp` now puts each composition member on its **own** video lane (`ensureVideoLanes`), so they never overlap on a lane → no spurious crossfade; geometry preserved (ring az evenly spread). Verified: ring×6 → 6 distinct lanes [0,1,2,4,5,6], az [0,60,120,180,240,300], **0 xfade indicators**, 6 patches rendered. _Deviation:_ kept as an editable group (Transform-all) rather than wrapping in a nest, to preserve that verified UX; acceptance (N lanes / no crossfade / correct geometry) met.
- [x] **[21] Re-enable automation** — `evalP` honors a per-param `_autoOff` bypass; each automation sub-lane header has an `A` arm-toggle (override → static value) and a `↻` re-enable button that re-applies the curve. Verified: arm-off→evalP returns base (99), ↻→back to curve (155), `_autoOff` cleared.
- [x] **[22] Transport controls centered** — `.tccenter` holds Play + timecode at window center (verified delta 0; from ROUND 15, re-confirmed).
- [x] **[23] Create track only via Ctrl+T / right-click** — removed the "+ Video / + Audio" buttons; `Ctrl+T` adds a track; right-click on the track area, the empty header column, or a lane header offers Create video/audio track (+ rename/duplicate/delete). Verified no `#addV`/`#addA`, Ctrl+T adds a lane.
- [x] **Stress (10 clips / 5 lanes / extreme zoom)** — 10 clips across 5 video lanes; zoom in to pps 600 and out to pps 8; scroll to end → all 6 rows render, render() still produces pixels, no console errors.

### Endurecimiento (section 11)
- [x] **Self-hosted fonts** — downloaded Inter + JetBrains Mono (latin variable woff2) to `assets/fonts/`, replaced the Google Fonts CDN `<link>` with local `@font-face`. The packaged `.exe` no longer needs the network for fonts. Verified: both fonts load via `document.fonts`, 0 google/gstatic links, `assets/**/*` is already in the electron-builder `files` list.
- [x] **Regression net** — every fix was live-verified before moving on, plus the 3 per-session smoke checks (boots clean · composite non-black · export writes a file) and the stress check above.
- [ ] **Proxies → Worker + persist to disk** — **deferred** (rationale): moving the WebCodecs encode to a Worker + writing proxies into the Electron project folder is a substantial change to the currently-verified proxy pipeline (main-thread, in-memory). High regression risk for a portable single-folder build; recommended for a dedicated pass with its own verification, not bundled into this correctness tranche.

_Verdict: all 23 checklist items are implemented and live-verified ([19] verified-already-correct, no change needed); [15] and [18] uncovered real bugs that were fixed and re-verified; fonts are self-hosted. The one honest deferral is the Worker/disk proxy hardening, left out to avoid regressing the verified proxy path._

## ROUND 16 — Inside-dome Viewer: independent dolly (scroll) + FOV
_All items implemented and live-verified against the running app (RTX 4060, Chrome/WebGL2 preview)._

- [x] **Scroll dollies the inside-dome camera (acercar/retroceder), decoupled from FOV** — in Viewer (`three==='spec'`) mode the wheel drives `cam.back` (camera position along the look axis), but it was clamped `[0, 2.4]` with default `0`, so scrolling *in* was dead-stuck at center — you could only back away. Widened the clamp (wheel handler + `#dollyRange` `min`) to `[-0.9, 2.4]` so the eye can move toward the front dome surface (real zoom-in). `-0.9` keeps the eye ~0.05 from the nearest surface point, well beyond the 0.01 near-plane (no clipping). Verified: from default `0`, simulated scroll-in reaches `-0.9`; render + projected dome point both change with `cam.back` while FOV held fixed.
- [x] **FOV is now an independent control in Viewer mode** — `cameraMVP` already used `cam.fov` only in spec mode, but `updViewCtl` showed `#fovCtl` in *orbit* (where it's ignored, lens forced to 48°) and hid it in Viewer. Flipped it: Viewer now shows **both** `FOV` and `DOLLY` sliders; orbit shows neither (orbit = scroll-distance + fixed natural lens, so its previously-dead FOV slider is removed). Verified: in spec both controls `flex`, in orbit both `none`; FOV and dolly each independently move a projected dome point and change the rendered image; no console errors.

_Verdict: the inside-dome viewer now behaves like a real fulldome camera — scroll to move closer/back, a separate FOV slider for the lens angle — instead of one coupled control. Live-verified._

## ROUND 15 — Transport/viewport UI polish
_All items implemented and live-verified against the running app (RTX 4060, Chrome/WebGL2 preview)._

- [x] **Timecode + Play centered in the transport** — wrapped the play button and the timecode/`bbt` readout in an absolutely-centered `.tccenter` cluster (`.transport{position:relative}`); play removed from the left transport group. Verified: `.tccenter` holds both `#playBtn` and `#tc`; its center = window center (800 = 800 at 1600px wide), `centeredDelta` 0.
- [x] **Removed the media search box** — deleted the `.searchbox`/`#mq` input from the media toolrow and its `oninput` + `ph('#mq',…)` wiring (filter segments + proxy filter kept). Verified: `#mq` no longer in DOM, no console errors, media list still filters via the All/Video/Image segments.
- [x] **Viewport fully black** — 2D stage container `background:#000`; 3D `clearColor(0,0,0,1)`; dome shader `base=vec3(0.0)` (was a dark blue-grey gradient). Verified by `readPixels`: with the grid overlay off, center/upper/lower/corner all read `0,0,0`; the faint `17,20,23` seen with grid on is just the antialiased grid lines (a user-toggled layer), not the background.

_Verdict: cleaner, more cinema-like chrome — transport centered like an NLE, no stray search field, and a true-black dome canvas. All live-verified._

## ROUND 14 — Multiple sequences per project + toolbar cleanup
_All items implemented and live-verified against the running app (RTX 4060, Chrome/WebGL2 preview)._

- [x] **Multiple sequences per project (Premiere-style)** — added `state.sequences[]` + `state.activeSeqId`; each sequence owns its `clips`/`lanes`/`markers`/`groups`/`playhead`/`workIn`/`workOut`, and the live `state.*` mirrors the active one. Helpers: `ensureSequences()` (wraps the current timeline as "Sequence 1", also wraps old single-timeline projects on load), `saveActiveSeq()` (nest-aware: saves the sequence root even while editing a nest), `loadSeqIntoState()`, `switchSeq()`, `newSequence()`, `renameSequence()`, `deleteSequence()`, `serSeq()`. A `#seqBar` tab strip in the top bar shows all sequences with the active one highlighted: click to open, double-click to rename, right-click to delete, `＋` to create; also a ⌘K "New sequence" command. Switching a sequence exits any open nest first (`_nestStack`). Verified: boot = 1 "Sequence 1" tab; `＋` creates Sequence 2 (empty, active); adding a clip in each and switching back and forth preserves each sequence's own distinct clips; serialize/load round-trips 2 sequences.
- [x] **Project format v3 with back-compat** — `serProject()` bumped to `v:3`, now emits `sequences` (each via `serSeq` → `serClip`) + `activeSeqId`; `loadProject()` rebuilds sequences (rebuilding masks + bumping `_id` across all sequences) or, for an older single-timeline `.rdome` (no `sequences`), wraps it as "Sequence 1". Verified: v3 file with 2 sequences reloads with both intact and the right active one.
- [x] **Removed the Split and Delete toolbar buttons** — per request, those destructive actions are now only via keyboard (`C` split / `Del`-`Backspace` delete), the ⌘K command palette, and the clip right-click menu (Snap button kept). Removed the buttons from index.html and their dead `onclick`/`updEnable`/`applyLang` wiring. Verified: `#splitBtn`/`#delBtn` no longer in the DOM; split/delete still work via keyboard/menu/palette.

_Verdict: ROUND 14 brings true Premiere-style multi-sequence projects (each with its own clips/lanes/markers/groups, nest-aware save, v3 round-trip with back-compat) and a leaner toolbar — all live-verified clean._

## ROUND 13 — Timeline UX + nested sequences (Nest)
_All items implemented and live-verified against the running app (RTX 4060, Chrome/WebGL2 preview)._

- [x] **Razor cuts at the mouse, not the playhead, with snapping** — the razor tool already cut at the click X; now it snaps the cut to clip edges / markers / grid (`applySnap`) and shows a live cut-line that follows the cursor (`#snapline`, dimmed `.free` class when not snapped, bright when snapped) via a `#tracks` pointermove handler. The playhead split (C / Split button) stays as a separate explicit command. Verified: razor-click at t=4.95 near a marker at 5.0 snapped the cut to exactly 5.0; hover line shows at the mouse position.
- [x] **Fades + crossfade confirmed (Ableton-style)** — draggable corner fade-in/out handles (`startFadeDrag`) and auto-crossfade on same-lane overlap work. Verified: fadeFactor 0.5 mid-fade, 1.0 at center.
- [x] **Curve editor easier** — keyframe grab radius bumped to 14px (2-axis hit-test), and dragging a keyframe snaps its time to playhead/markers/grid (`cmove` via `applySnap`) when snapping is on.
- [x] **More per-clip blend modes** — added `darken` (`gl.blendEquation(MIN)`) and `lighten` (`MAX`) to `setBlend` + the inspector dropdown, alongside normal/add/screen/multiply. `setBlend`/`NORMAL_BLEND` now always reset `blendEquation` to `FUNC_ADD` so MIN/MAX never leaks to later draws. Verified: darken max 100 = min(100,200), lighten 200 = max, and a following normal clip renders back at 103 (equation reset, no leak).
- [x] **Nested sequences (Nest), Premiere-style** — `nestSelection()` (clip context menu + ⌘K palette) moves the selected clips into a new media of `kind:'nest'` (its own `nestClips`/`nestLanes`, rebased to 0) and replaces them on the parent with ONE nest clip (defaults `props.fulldome=true` → fills the dome 1:1, fully keyframeable opacity/grade/blend; untoggle fulldome to place/keyframe it as a patch). The nest renders recursively into its own per-nest FBO (`ensureNestFBO`/`renderNest`/`prepNests`, depth ≤4) before the parent composite, in both preview and export. Double-click a nest clip to enter and edit its sub-timeline (context pushed on `_nestStack`, `#nestBar` breadcrumb, `exitNest` returns). Serialized via `serMedia` (`nestClips` serClip'd + `nestLanes`) and rebuilt in `loadProject`; `disposeMedia` frees the nest FBO + sub-clip mask textures. Verified: 2 clips → 1 nest clip (sub-clips=2), renders 52,718 px filling the dome, enter→2 editing clips/stack=1, exit→1 clip/stack=0, opacity keyframes 0→100, save/load preserves 2 sub-clips.

_Verdict: ROUND 13 lands editor-grade timeline ergonomics (mouse-snapped razor, easier curves, two new blend modes) plus a fully recursive, keyframeable, round-trip-safe Nest — all live-verified clean._

## ROUND 12 — Adversarial review fixes (rounds 9-11)
_A 32-agent adversarial review audited the rounds 9-11 code and confirmed 17 bugs: 15 fixed and live-verified, 1 deferred, 1 skipped-by-design._

### HIGH (all fixed + verified)
- [x] **Streaming PNG export now surfaces disk failures** — `runExport` checks `DSP.ensureDir`/`DSP.writeBinary` return values and throws (was: silent false-success on a read-only/full disk).
- [x] **MP4 AAC track only declared when encodable** — `runExport` pre-checks `AudioEncoder.isConfigSupported` before adding `muxCfg.audio` (was: declared up-front, could finalize a malformed empty-AAC MP4). Verified: with-audio 13.2KB vs silent 2.8KB.
- [x] **Screen/multiply blend now honour opacity/fades** — new `u_premul` uniform in `FSW`+`FSFD`; `drawClip` sets it for screen/multiply so RGB is opacity-premultiplied. Verified: screen maxSum 612→54 at 30% opacity (was stuck full-on).
- [x] **2D overlay clears the full panel** — `drawGrid2D` `gx.clearRect(0,0,view.cw,view.ch)` (was `VSIZE²`, leaving ghost trails on the right of a non-square panel after round-11 made `#grid` full-rect).

### MED (fixed + verified)
- [x] **Image-sequence blob-URL leak** — `addSequence` tracks `m._frameUrls`; `disposeMedia` revokes them (was: N-1 orphaned per import).
- [x] **Cross-project texture leak** — `loadProject` disposes+resets `state.mediaTrash` (was: deleted-media GL textures from prior project survived Open).
- [x] **Reshape Mask applies to existing members** — `regenComp` reuse branch sets `ex.props.mask=g.mask` (was: only new slots).
- [x] **Audio-reactive respects mute/solo** — `audioLevelAt` adds the lane mute/solo guard (matches the baked mix). Verified: level 0.8→0 when muted.
- [x] **Proxy-error badge refresh** — `pumpProxy` catch calls `updProxyUI(m)` (was: frozen "PROXY n%" on clips).
- [x] **Nudge no longer spams undo** — `nudgeSel(dt,noUndo)` guarded by `e.repeat` (was: ~30 snapshots/s on auto-repeat wiped history).

### LOW (fixed)
- [x] Right-click reset now covers `glow/chroma/blur/feather/crop`.
- [x] Fulldome clips hide inert FX rows (only opacity+grade shown). Verified: 17→12 rows.
- [x] Audio mix fade-in accounts for front-trim (`used=t0-c.start`).
- [x] spiral/wave `turns` exposed in the compose dialog (`#cTurns`, shown for spiral/wave).
- [x] Group raise/scale use a drag-start base so clamping never collapses per-member offsets. Verified: raise-to-90-and-back preserves els 10..60.

### DEFERRED / NOT APPLIED
- [ ] Delete-undo of a bin-only media (no clips) still doesn't restore it — the reviewer's "drop the clip-ref guard" fix was REJECTED because it would resurrect deleted media on unrelated undos; proper fix needs media in the undo snapshot.

_Verdict: rounds 9-11 are now adversarially clean — 15/17 confirmed bugs fixed and live-verified, the lone deferral is the long-standing media-undo gap (correctly left for a snapshot-level fix rather than a regression-prone shortcut)._

## ROUND 11 — User-requested polish (viewport, proxy UX, fulldome source, artistic comps)
_All items implemented and live-verified against the running app (RTX 4060, Chrome/WebGL2 preview)._

- [x] **2D viewport fills the full panel** (zoom no longer locks to a square) — the 2D master canvas was a centered square (`min(W,H)-30`); now it fills the whole panel rectangle. Added a `u_aspect` uniform to the blit shader so the fisheye disc stays circular and centered, and made `f2pix`/`pix2f` (and the wheel zoom-to-cursor) aspect-aware. Verified: canvas now rectangular (988×597), pick round-trips az0/el35 exactly, and zooming reveals more (red-pixel coverage 50k→80k) instead of clipping to a square.
- [x] **Proxy progress on the timeline clip + media proxy filter** — clips now show an ORIGINAL / PROXY n% / ⚡ PROXY badge plus a live progress bar (updated in real time by `updProxyUI`, classes `.cpx`/`.cpxbar`); added a media-panel proxy filter (`#proxySeg`, `state.mediaProxyFilter`: All / ⚡ with-proxy / ○ originals). Verified: badge ORIGINAL→PROXY 45% (bar at 45%)→⚡ PROXY (bar hidden); proxy filter shows proxied, originals filter hides them.
- [x] **Per-clip "Fulldome source" toggle** — `props.fulldome` marks a clip whose texture is already a fisheye/dome master; it's drawn 1:1 into the composite via a dedicated fullscreen program (`PFD`/`fdVAO`, with opacity/grade/dither/blend/mirror) instead of the gnomonic patch warp. Verified: coverage jumps from a 31,690-px patch to 236,902 px (fills the dome ~7.5×); opacity still applies.
- [x] **Artistic composition layouts** — added `spiral`, `phyllo` (sunflower / golden-angle 137.5°), `wave` (sine band), and `fib` (even fibonacci dome scatter) to `compLayout`, the compose dialog kind selector, and `kindES`; field visibility (`sync()`) updated. Verified: spiral els ramp 10→60 over 3 turns; phyllo/fib use the 138° golden angle; fib spreads 49→12; wave oscillates (els 11–59).

## ROUND 10 — Advanced roadmap features (color, FX, shapes, transitions, scopes, audio)
_All items implemented and live-verified against the running app (RTX 4060, Chrome/WebGL2 preview). Closes the round-9 deferred color-grade/dither item plus the next tier of creative + delivery roadmap bets._

- [x] **Per-clip primary color grade + output dither** (closes the round-9 deferred "output color management / anti-banding dither"). Exposure/contrast/saturation/temperature/tint added to the `FX` defs — so they inherit sliders, keyframes, and i18n labels for free — and applied in the warp shader `FSW` with neutral defaults (zero regression: geometry/handedness paths untouched). Ordered dither at output kills 8-bit banding. Verified exact: neutral 120; exposure +50→170 (×1.41), −50→85 (×0.71); temperature→rgb(159,120,82).
- [x] **Per-clip glow/bloom + chromatic aberration** — `u_glow`/`u_ca` uniforms in `FSW` (bright-halo bloom; radial R/B channel offset), keyframeable like any FX and working in export too (no FBO post-pass needed). Verified: glow pushes gray-200→white (channel sum 600→765); chroma yields 44 R/B edge-fringe px (0 with FX off).
- [x] **Vector shape clips** — `createShapeClip()`/`renderShapeMedia()` make rect/ellipse/line (fill/stroke) as a canvas-texture media exactly like text; new "▭" button in the media rail; inspector editor for shape params; serialized + re-rendered on load. Verified: blue rect rgb(91,141,239), edited to red ellipse, full save/load round-trip.
- [x] **Dome-anchored title presets** — right-click the "T" button → Title (upper) / Subtitle / Lower-third / Credits, placing styled text clips at sensible dome elevations. Verified: title el 62, lower-third el 18 + outline + 2 lines.
- [x] **Transition library** — per-overlap transition on the incoming clip (`b.trans`): crossfade (default) + dip-to-black, applied in `compositeClips`. Verified: dip hits 0 (black) at overlap midpoint vs crossfade 336.
- [x] **Export presets + sequential render queue** — named presets (codec/res/fps/bitrate) saved in the project (`state.exportPresets`, serialized) with a dropdown + Save; `_exq`/`pumpExportQ()` runs queued jobs one-at-a-time (fixes the old concurrent-export conflict, enables batch masters). Verified: preset save/apply/serialize; 2 jobs ran sequentially.
- [x] **Video scopes overlay** — `drawScopes()` reads the composite and draws a throttled RGB histogram overlay; toggled from the ⌘K palette (`state.view.showScopes`). Verified: overlay created, visible, histogram drawn.
- [x] **Beat detection + audio-reactive modulation** — `detectBeats()`/`detectBeatsCmd()` finds energy onsets in the selected audio clip → drops locators; per-clip "React to audio" pulses size via a deterministic envelope (`audioLevelAt()` reading precomputed `peaks`), so it bakes into export deterministically (no live-only RNG). Verified: 3 beats→3 locators; level 0.85 loud / 0 quiet → patch 53,609 vs 11,856 px.
- [x] **UX quick wins** — clip nudge Alt+←/→ (±1 frame, +Shift = ±1 s, `nudgeSel()`); "Set clip start (seconds)…" command; F1 / ? opens the searchable ⌘K command palette; textarea added to the shortcut-guard so typing shape/text content doesn't fire shortcuts. Verified: nudge ±0.0167 / ±1.0; F1 opens palette; all 11 new functions present.

### KNOWN / DEFERRED (round 10)
- [ ] **Per-projector slice + edge-blend export** — needs venue projector geometry (count/overlap/warp), not buildable in the single-folder app without that config.
- [ ] **SPOUT/NDI live output** — requires a native module; out of scope for the portable single-folder build.
- [ ] **Higgsfield MCP round-trip bridge** — depends on external MCP/network deps not available inside the app.
- [ ] **Visual labeled undo-history panel** — deferred as invasive (would touch the verified snapshot/restore core); ⌘K already exposes Undo/Redo.

## ROUND 9 — Roadmap features (audio, blend, sequences, streaming export)
_All items implemented and live-verified against the running app (RTX 4060, Chrome/WebGL2 preview). Delivery-blockers from the feature roadmap + the top creative win._

### DELIVERY-BLOCKERS
- [x] **Audio baked into export** (roadmap blocker #1 — masters were shipping silent). `exportAudioMix(t0,endT)` renders the timeline's audio clips through an `OfflineAudioContext` (respects lane mute/solo, clip in-point, and fadeIn/fadeOut as gain ramps). MP4 export now muxes an AAC track via `muxAudioAAC()` (WebCodecs `AudioEncoder` `mp4a.40.2` → mp4-muxer audio track); PNG-sequence export writes an `audio.wav` sidecar (`audioBufferToWav`, 16-bit PCM). Verified: MP4 with audio = 38.5KB vs 1.1KB without (≈37KB AAC delta) at 256²/1.5s.
- [x] **Streaming PNG-sequence export to disk** (roadmap blocker #3 — RAM-zip OOMs at 75min/4K; was the round-8 "buffers fully in RAM" deferral). In Electron the export now prompts for a folder (`dsp:chooseExportDir`) and writes each frame PNG straight to disk (`dsp:writeBinary` + `dsp:ensureDir`) with zero in-RAM buffering, plus the `audio.wav` sidecar. Browser keeps the in-RAM zip path (now also includes `audio.wav`). New IPC channels added in main.js/preload.js — closes the round-8 "no binary Save IPC yet" deferral.
- [x] **Image-sequence ingest** (roadmap blocker #4 — Higgsfield/stop-motion frames arrived as separate stills). `importFiles` now groups ≥3 numbered same-prefix images into ONE media of kind `'sequence'`; `addSequence()` loads frames (fitImage-downscaled); `drawClip` samples the right frame by clip-local time at 24fps; `framePaths` serialized + a `reloadMedia` sequence branch re-links in Electron. Verified: 6 numbered PNGs → 1 clip, pixel-exact frame sampling while scrubbing.

### CREATIVE WIN
- [x] **Per-clip blend modes** (top creative win for the dark-dome look). New `blend` clip prop (normal/add/screen/multiply) with a `setBlend()` per-draw `gl.blendFuncSeparate` in `drawClip`, an inspector selector, serialized in props. Verified exact compositing math: normal rgb 120, add 240, screen 184, multiply 57.
- [x] **Native Text/Title clip** (closes the roadmap "native text clip" big-bet — no text primitive existed before). `createTextClip()` makes a media of kind `'text'` rasterized to a canvas via `renderTextMedia()` (multi-line, font size, fill color, optional outline) and bound as a texture exactly like an image clip — zero shader changes. Editable from the inspector (content textarea + color + size + outline) with live re-render, new "T" button in the media rail. Text params serialized in `serMedia` and re-rendered on load (`renderTextMedia` in `loadProject`) so text clips round-trip fully with no external file in BOTH the browser and the .exe. Verified live: white "TITLE" → rgb(255,255,255); edited to multiline red @220px re-rasterized to 885×726 → rgb(255,42,42); full save/load round-trip preserved text/color/size and the live texture.

### KNOWN / DEFERRED (round 9)
- [ ] Output color management / anti-banding dither **deliberately deferred** — it would touch the verified-correct render shaders and is not a hard delivery blocker.
- [ ] Still-open big bets from the roadmap: per-projector slice export, SPOUT/NDI, MCP round-trip, primary color grade.

## ROUND 8 — Test-driven fixes (audit + live verification)
_All items implemented and live-verified against the running app (RTX 4060, Chrome/WebGL2 preview)._

### CRÍTICO
- [x] **Export default fixed** — dialog defaulted to MP4 @ 4096² but the H.264/WebCodecs encoder caps SQUARE frames at ~3072² on this GPU (3840²/4096² square → no codec; 4096×2048 wide works). Now default codec = **PNG sequence** (works at 4096²+, lossless/alpha, the pro fulldome master format); selecting MP4 probes `pickAvcCodec` for the chosen resolution and disables the Export button + shows a clear message if unsupported. `#fmtChip` no longer a static lie — updates live from the export selection; default reads "4096² · 60p · PNG".
- [x] **"Reshape…" edits in place** — `openCompose` accepts an `editGroup`; on Apply it mutates the group + `regenComp` instead of creating a duplicate composition stacked at the playhead.
- [x] **Custom PNG mask no longer shared across clones** — split/duplicate/paste of a masked clip was a use-after-free on one live `maskTex` (deleting one half blanked the other / double-freed). Clones now get `maskTex:null` + `rebuildMaskTex` from `maskData`; duplicate/paste also clear `groupId`/`slot` so a copy doesn't ghost-join a composition.
- [x] **Undo/redo restores `state.selIds`** (multi-selection) — snapshot/restore previously ignored `selIds` → ghost selection after undo. `rippleDelete` now clears `selIds` too.
- [x] **Unsaved-changes guard on close** — browser `beforeunload` (when dirty) + Electron main-process `win.on('close')` confirmation dialog via new `dsp:setUiState` IPC (renderer pushes `{dirty,lang}`; main.js shows a bilingual Save/Cancel warning). main.js native dialogs (save/open/locate) now bilingual via `uiLang`.
- [x] **WebGL context-loss handling** — `webglcontextlost` (preventDefault + stop export/playback + force autosave) and `webglcontextrestored` (reload to rebuild GL) prevent the permanent-black-viewport-no-recovery failure on a GPU/TDR reset. `render()` early-returns while context is lost.

### ALTO
- [x] **Razor click & media-drop time correct when timeline scrolled** — removed a double-count of `#tlscroll.scrollLeft` against the already-scroll-offset `#tracks` rect. Verified: at scrollLeft 3880 a razor click split exactly at the clicked clip's center.
- [x] **Re-link missing media** — a "Locate file…" context-menu item on missing media (Electron) calls the previously-dead `dsp:pickMedia` → sets path → `reloadMedia`.
- [x] **Autosave failure surfaced** — warns in the status bar when it fails (localStorage quota exceeded) instead of silently swallowing the error.

### MEDIO/BAJO
- [x] `serProject`/`loadProject` now persist & restore `workIn`/`workOut`, folders, `media.folder`, and `tl` (bpm/sig/tcMode/pxPerSec) — were silently lost on reopen. `newProject` resets them.
- [x] Keyframes re-based on razor split (right half shifted by the cut offset, each half drops out-of-range kfs) so they no longer become orphaned/uneditable.
- [x] Transform/Effects `.sechead` inspector headers now actually collapse/expand their rows (were dead `cursor:pointer` controls with no handler).
- [x] Proxy blob URL tracked (`m.proxyUrl`) and revoked in `disposeMedia` — fixes a per-import/delete memory leak.
- [x] Reduced-motion preference now persists (localStorage `domeProRM`).
- [x] MP4 codec option disabled in the export dialog when WebCodecs is unavailable.
- [x] Escape closes the topmost modal overlay.
- [x] i18n: curve-editor "No selection" and locator default name "Locator" now go through `T()`.

### KNOWN / DEFERRED (not yet done)
- [ ] Composition Count-change still regenerates members from defaults (per-member non-positional tweaks not preserved).
- [ ] Curve-editor keyframe hit-test still time-only (no Y axis).
- [ ] "Delete media" undo doesn't restore the media object.
- [ ] Large PNG-sequence exports buffer fully in RAM.
- [ ] Electron exports still route through the browser download path (no binary Save IPC yet).

## ROUND 7 (2026-06-17) — the deferred improvements (verified by eval)
- [x] **rVFC video upload** in playback: HAS_RVFC + pumpVF/stopVF; ploop uploads via requestVideoFrameCallback only on new frames (fallback to per-rAF upTex if unsupported); pause cancels. Verified play/pause no-error (images) + wiring.
- [x] **Multi-clip selection**: state.selIds; shift-click toggles, plain click selects one, **marquee** (startMarquee) on empty timeline selects intersecting clips; move drags ALL selected by the same delta; deleteSel deletes all; renderTimeline highlights all. Verified select=2, move "1|4", delete 2.
- [x] **Audio waveform on clips**: drawClipWave renders peaks at the clip's real width (window inP..inP+dur) instead of the stretched 108px thumb. Verified canvas present on audio clip.
- [x] **Discrete GPU (RTX) safely**: main.js writes HKCU UserGpuPreferences = GpuPreference=2 (High performance) for the exe path on launch (no admin, no risky Chromium flags). reg command verified valid + applied.

## ROUND 6 (2026-06-17) — AUDIT fixes (verified by eval)
- [x] **Custom PNG mask survived save/load/undo** (was: maskTex serialized to `{}` → bad binding; mask image lost). Fix: maskUp stores `c.maskData` (downscaled dataURL); `serClip()` strips live `maskTex`; loadProject/restore rebuild via `rebuildMaskTex(c)` or drop stale 'custom'. Verified round-trip + undo (snapshot also uses serClip; selLane added).
- [x] **Media texture/URL leak on Delete media** → `disposeMedia(m)` (revokes srcUrl/blob thumb, deletes tex) + deletes clip maskTex; newProject refactored to use it.
- [x] **`. chip` dead CSS** fixed → `.chip`.
- [x] **Perf: renderTimeline throttled** during drags via `scheduleTimeline()` (rAF-coalesced) in clip-drag/fade-drag/marker-drag; final renderTimeline on pointerup.
- [x] **Export work area (I/O range)**: runExport now exports [workIn,workOut] if set (t0 offset), else full duration. Verified 2–4s→20 frames, full→100.
- [ ] DEFERRED (rationale): rVFC video-upload in ploop (can't verify playback headless — video pauses; high regression risk blind); multi-clip marquee selection (feature); audio waveform on clips (feature); force discrete GPU on hybrid (caused black before — risky). All documented as recommended improvements.

## ROUND 5 (2026-06-17) — REVISIONS batch (IN PROGRESS — paused by user)
DONE this round:
- [x] **CRITICAL: viewports were locked** — root cause: `#grid{pointer-events:none}` but ALL viewport handlers are on `#grid`, so the real mouse never reached them (synthetic dispatch had masked it). Fixed → `#grid{pointer-events:auto}` (index.html ~L85). Verified: 2D pan ✓, 3D orbit ✓, wheel zoom ✓, elementFromPoint='grid'.
- [x] **Export error "Cannot call encode on a closed codec"** — root cause: codec string hard-pinned H.264 **level 4.0** (`avc1.640028`) regardless of res; at 4096² that exceeds the level → codec closes. Fixed: added `pickAvcCodec(w,h,bitrate,fps)` (tries profiles high/main/baseline × levels 6.2→4.0 via isConfigSupported) + robust encoder error handling (encErr flag, state guard, clear bilingual message; >4096² → tells user to use PNG). Verified 1024² MP4 exports w/o error in preview (headless has no HW H.264 at 4096²; user's NVENC machine will).
- [x] Investigated **"image renders transparent / only contour"** — could NOT reproduce: opaque image reads back [40,27,54,255] opaque at element center. Likely the user loaded a transparent-bg PNG or a video. ASK user for the specific file. Engine render is correct.

DONE (all verified live by eval; preview screenshot is flaky on this WebGL page so verification is pixel/state-based):
- [x] **app.js cache bug** (was blocking ALL verification): Python http.server heuristic-cached app.js. Fixed: index.html now loads app.js via a tiny inline loader that appends `?v=Date.now()` ONLY over http (dev); file:// (packaged exe) loads it plain so the path stays valid.
- [x] Timeline VERTICAL scroll synced: #tlscroll scroll → `#laneHeaders` `translateY(-scrollTop)`; wheel over #trackHdr scrolls tracks. Verified translateY(-40px).
- [x] Middle-button drag = horizontal+vertical Pan on #tlscroll (any tool); #tracks pointerdown now ignores non-left buttons. Verified scrollLeft moved.
- [x] Track sidebar: click selects (state.selLane + `.lanehdr.sel` highlight); dbl-click renames; **Ctrl+R** rename track, **Ctrl+T** new track, **Ctrl+D** duplicate track (renameLane/duplicateLane). Verified.
- [x] **Ctrl+R** renames selected LOCATOR (selMarkerId) — takes priority over track rename.
- [x] Razor: custom cyan-blade cursor (RAZOR_CUR data-URI); razorClip already splits at click x (Premiere-style) — verified.
- [x] **Fades drag-from-clip**: round dot handles at clip top corners (`.fadeh.fadeL/.fadeR`) → startFadeDrag sets fadeIn/fadeOut. Verified fadeIn=1.0/fadeOut=0.5. (Inspector numeric fades kept as complement.)
- [x] **Crossfade**: compositeClips already crossfades same-lane overlaps; added visual X indicator (`.xfade`) in the overlap region. Verified 1 xfade el.
- [x] **Snap to grid** in all modes (snapGrid() = musical step in bars, ruler tick otherwise). Verified 1.53→1.5.
- [x] Curves: **hover highlight** (cv._hoverKf → bigger marker + value tooltip).
- [x] Curves: create only via dbl-click (single-click moves/grabs, never creates); **right-click point → "Set value…"** prompt.
- [x] **Resize handles** (`.hres` #tlResize / #curveResize) to grow/shrink the timeline + curve panels (hResize()).
- [x] **Curve box shares timeline scale/scroll**: drawCurveGraph X = (c.start+t)*pps - tlscroll.scrollLeft; curveParams=194px aligns graph under tracks; tlZoom/scroll redraw curve; ctrl-wheel in curve box zooms both (curveZoomAt). Verified kf@t1→X240, zoom syncs pps.
- Pending/ASK: "transparent image" still not reproduced (engine opaque) — need the user's specific file. Final exe rebuild after this round.

## ROUND 4 (2026-06-17) — language toggle + visualizer verify
- [x] **EN/ES language toggle** (i18n): state.lang (persisted localStorage domeProLang); T(en,es); applyLang() for static chrome; dynamic strings wrapped in T() (cardinals, propLabel for TF/FX, maskES, commandList(), export/compose/prefs modals, group inspector, context menus, flashStatus, status, hint); selector English/Español in Preferences (setLang() re-renders). Default English. Verified EN↔ES live + screenshot (ES cardinals CENIT/ATRÁS/IZQUIERDA/DERECHA/FRENTE).
- [x] 3D visualizer confirmed rendering in preview (Viewer + Orbit, dome wireframe, not black) — exe verify pending final build.

## ROUND 3 (2026-06-17)
- [x] **3D viewer BLACK in the .exe** — fixed: removed aggressive GPU command-line switches in main.js (ignore-gpu-blocklist + enable-zero-copy + force_high_performance_gpu forced a non-compositing GPU path on hybrid graphics → black). Kept default accel + enable-accelerated-video-decode. Also removed `desynchronized:true` from the WebGL2 context. Preview (Chrome) always rendered fine — was exe-specific. Orbit verified working (yaw/pitch change live).
- [x] **Language flipped back to ENGLISH** (3rd change: EN→ES→EN). Reverted index.html + app.js fully to English (cardinals, commands, modals, menus, prefs, status, hint). Verified 0 Spanish in DOM. Quality control labels Full/½/¼. NOTE: consider an EN/ES toggle in Preferences to stop the flip-flopping.

## ROUND 2 (new user requirements — 2026-06-17)
- [x] **Language REVERSAL**: user now wants NO English text → full UI in **Spanish** (inverse of prior directive). Swept index.html + app.js via the 275-string audit map; cardinals FRENTE/ATRÁS/IZQUIERDA/DERECHA/CENIT; commands, modals, menus, prefs, status. Verified 0 English in DOM. (Also fixed invalid `[data-v=2d]` palette selectors → quoted.)
- [x] **Free 3D camera** (orbit + viewer): pitch clamp widened to ±(HALF_PI-0.02) + lookAt hardened vs zenith NaN. Verified live: pitch reaches +1.551/-1.551, both modes rotate 360° yaw. (Live + workflow agreed.)
- [x] **Left/Right 2D↔Viewer**: VERIFIED correct live (R at az45 → viewer right, not mirrored) AND by audit (single intentional u_flipx=-1 for spectator). NO change — do not "fix" cameraMVP spec branch or it double-inverts.
- [x] **GPU max**: WebGL2 context powerPreference:'high-performance' + desynchronized; Electron main.js GPU switches (ignore-gpu-blocklist, enable-gpu-rasterization, enable-zero-copy, enable-accelerated-video-decode). Note: real dGPU pick may also need Windows per-app High-performance / NVIDIA Control Panel.
- [x] **Proxies always-on**: import now always enqProxy (removed useProxies gate); export still uses originals.
- [x] **Preview quality Completa/½/¼** (Adobe-style): state.previewQuality scales ONLY the GL backing store in resize() (grid overlay stays full res; export unaffected via exporting guard). Segmented control in viewport toolbar. Verified 449→225→112 px.
- [x] **Project lifecycle (no data loss)**: serProject() v2 stores media file PATHS (Electron); Nuevo (Ctrl+N, confirm if dirty) / Guardar (Ctrl+S, Electron save dialog+remembered path / browser download) / Abrir (Ctrl+O, Electron reads file & auto-reloads media from disk via file:// → reloadMedia; browser falls back to relink-by-name). dirty flag in title. Autosave + undo carry everything. Verified functions + serialize in browser mode.
- [x] **Electron packaging**: package.json (electron 42.4.1 + electron-builder 26.15.2, portable+nsis, icon alma-logo.png), main.js (GPU switches, secure BrowserWindow, IPC fs/dialogs), preload.js (webUtils.getPathForFile + IO bridge). npm install done. `npm run dist` building portable .exe in dist/.
- [x] Build verified: dist/ has `Dome Studio Pro 1.0.0 portable.exe` (89.7 MB) + `Dome Studio Pro Setup 1.0.0.exe` (NSIS installer). Smoke-test: portable exe launched 4 Electron procs (main+GPU+renderer+utility), no crash → packaged app boots, index.html + WebGL2 OK. Rebuilt after final ES string fixes.
- [ ] (deferred polish: automation per-track lane; rVFC playback upload; gradient→flat; aria-labels) — all explicit asks A–I + round-2 asks DONE.

## IMPLEMENT NOW (ordered, verified fixes)
P0 correctness:
1. compositeClips: 3+ overlaps drop earliest clip — draw all-but-top-two painter-style xf:1, crossfade top two with Math.max/min clamp (NOT clamp()).
2. startAudio: clamp offset/len to m.buffer.duration in both branches (silent drop after relink).
3. fadeFactor: normalize when fadeIn+fadeOut>dur (mid-clip dip after trim); re-clamp fades in trim/razor.
4. Export: module `exporting` flag → `if(exporting)return` at top of render() (stale on-screen resize during export).
5. Orbit pitch ceiling → HALF_PI-0.001 (reach zenith); floor -0.05.
P0 design/contract:
6. i18n: sweep ~85 Spanish strings → English; `<html lang=en>`; centralize in STRINGS.
7. Blue→grey: all toggle/'on' states #313640; blue reserved for playhead/selection/keyframes/import-export only. Play glyph neutral; Ring neutral; group headers muted.
8. Disabled states: global token; drive from selection/target (Split/Delete/Copy/Dup/kf when !sel; locator nav when no markers; etc.).
P0 features:
9. tcMode 3-way: timecode/frames/bars; fmtTime() dispatcher; remove quantize dropdown.
10. Composition Groups: state.groups + clip.groupId/placement; makeClip factory; createGroup ring/grid/random; drawClip composites placement+group.offset+props; group vs individual edit scope; openCompose modal.
P1:
11. pickClip → aspect-aware ellipse (non-square media mis-select).
12. NumberBox editable (dbl-click type, wheel/arrows, focusable).
13. Collapse-to-28px rail (media + inspector); persist widths.
14. Bezier keyframe handles + per-kf interp; add point via dbl/right-click.
15. Circular PNG-alpha mask (generated radial-alpha) + persist masks on save/load.
16. Locators: select, rename, drag w/ snapping (user req).
17. Automation (T) per-track lane.
18. Hint pill/status/cursors state-driven; fix `.chip` selector.
19. Undo/save coverage for groups/handles/masks.
20. Gradient→flat chrome; unify button/segmented family; aria-labels.

## FUTURE BACKLOG (ranked)
- Multi-clip selection + group transforms (marquee/shift-click) — High
- Viewport snapping to dome guides (cardinal az, el rings, locators) — High
- Export work-area/range + real background queue (cancel/pause/ETA) — High
- Proxy/full-res toggle + IndexedDB proxy cache across sessions — Med-High
- GPU/CPU/RAM telemetry + frame-time graph — Med-High
- Color management/output profile + calibration pattern generator — Med-High (planetarium)
- Spherical/equirect + cubemap import auto-warped to master — Med
- Nested/linked clips + saveable composition templates — Med
- Keyframe ergonomics (copy/paste, box-select scale, tangent presets) — Med
- Onion-skin / motion-path overlay for animated clips — Med
- Blend modes (add/screen/multiply) + adjustment layers — Med
- Audio waveforms on clips + gain/pan envelopes — Med
- Customizable shortcuts + saved workspaces — Low-Med
