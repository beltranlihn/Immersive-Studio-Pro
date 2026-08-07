# Investigación: fluidez de reproducción (R104)

> Caso de prueba real: `RIto_Film_1080.mp4` — **HEVC Main 10 (10 bits), 1920×1080@60, 25.9 Mbps, 64 minutos,
> 232.691 frames, 12,5 GB**. No es un clip: es la película entera en un fichero.

## 0. Titular: EL MOTOR NO ES EL PROBLEMA

Con la fuente **en disco** (`file://`), pasando por el camino real del motor:

| clips | minuto 5 (24.1 Mbps) | minuto 45 (22.8 Mbps) |
|---|---|---|
| 1 | 60 fps | 60 fps |
| 2 | **60 fps** | **60 fps** |
| 3 | **60 fps** | **60 fps** |

Heap 10 MB · peor hueco entre frames 18–25 ms · **subir un frame HEVC 10-bit a textura: 0.10 ms** (más barato
que H.264 8-bit, que dio 0.5 ms). Presupuesto total por frame a 60fps: 16.7 ms.

**El minuto 45 no es más pesado**: 22.8 Mbps frente a 24.1 del minuto 5. El codificador mantiene la tasa, así
que "más visuales" no significa más trabajo de decodificación.

## 1. Cinco hipótesis mías, todas FALSAS, todas medidas

Esto vale tanto como los hallazgos: cada una habría sido una reescritura inútil.

| hipótesis | medición | veredicto |
|---|---|---|
| `UNPACK_FLIP_Y_WEBGL` rompe el camino rápido de Chromium | ×1.3 (0.5 vs 0.4 ms) | **falsa** |
| Techo de decodificadores hardware simultáneos | 4 vídeos 2560×1440@60 → 62 fps, los 4 avanzan | **falsa** |
| HEVC 10-bit cae a software (el límite 1920×1088@30 de Chrome <131) | Chromium **148**; `powerEfficient=true` | **falsa** |
| Los clips duplicados comparten un `<video>` y hacen seek entre sí | `_vinst` va **por id de clip**, no de medio | **falsa** |
| El composite 4096² es el cuello | render 0.2 ms… **midiendo una escena vacía** (ver §3) | **inválida** |

El informe externo también fue honesto en lo suyo: **no existe** un tope documentado de decodificadores
concurrentes en Chromium (leyó `media/base/limits.h`: `kMaxVideoDecodeThreads=16` es un cap de hilos de
**software**, no un contador de decodificadores), y **no hay** documento primario que garantice que
`texImage2D(VideoFrame)` sea zero-copy.

## 2. ARREGLADO: la tormenta de seeks (real, medida)

R92 metió un servo de velocidad pero **dejó el seek duro a 0.2 s de deriva**. Con material pesado el
decodificador no llega → la deriva pasa de 0.2 → seek duro → **el seek VACÍA la tubería del decodificador** →
la deriva empeora → otro seek. **Medido: 56 seeks en 4 s con 3 clips** (0 con 1 ó 2). ~14 por segundo.
**La "corrección" era el problema: un seek cuesta mucho más que la deriva que corrige.**

Arreglo: manda el servo (**±12%** en vez de ±6%, ganancia 0.5 en vez de 0.35 → recupera 0.2 s en ~1.7 s en vez
de 3.3 s) y el seek duro queda para deriva irrecuperable (>0.6 s) **y como mucho 1 vez por segundo y clip**.
El elemento de vídeo va *muted* (el audio es otro elemento), así que subir el rate no altera el tono.
**Resultado: 3 clips → de 56 seeks a 0**, con el vídeo avanzando [4.01, 4.01, 4.05] en 4 s.

Es intermitente por naturaleza — sólo salta bajo carga transitoria — lo que encaja con el *"va laggeado
**a veces**"*.

## 3. Mis mediciones mintieron SIETE veces (el patrón del proyecto)

1. Medios sintéticos → **la textura nunca se subía**; `render()` medía 0.2 ms **dibujando una escena vacía**.
   Cazado con `readPixels` + contar `drawArrays` (1 sola llamada = el fondo).
2. `fps()` contaba **mi propio bucle rAF**, que corre a 60 haga lo que haga la app.
3. El control de píxeles miraba el **centro** del canvas — en domo es el cénit: ahí no hay clips.
4. `readPixels` tras un `await` → con `preserveDrawingBuffer:false` el buffer ya se compuso y limpió → negro.
5. Fabricar pistas a mano reventaba `migrateArAuto` dentro de `renderTimeline`.
6. **El peor**: `fetch(file://…).blob()` creaba un `File` respaldado por **12,6 GB en RAM**. La app real recibe
   un File del disco. **Mi "1 fps con 2 clips" era mi propio blob gigante, no el software.** Reporté ese 1 fps
   con seguridad antes de comprobarlo.
7. Calentamiento corto (1.5 s) vs largo (4 s) daban resultados opuestos: mezclaba el transitorio de arranque con
   el estado estable.

**Regla que queda:** medir por el camino del usuario, con un control que demuestre que la medida vale, y separar
arranque de estado estable.

## 4. Lo que sí dice la investigación externa (fuentes primarias)

- **MDN**: *"Most texture uploads from DOM elements will incur a processing pass that will temporarily switch GL
  Programs internally, causing a pipeline flush."* Cada `texImage2D(video)` = un render pass oculto + 2 vaciados.
  **PERO** al leer el código: `motionTick` **ya agrupa** las subidas antes del `render()` y **ya usamos
  `requestVideoFrameCallback`** (`HAS_RVFC`, `pumpVFClip`). Las dos primeras recomendaciones **ya estaban hechas**.
- **TouchDesigner** es fluido por cuatro cosas, no una: (a) Hap = Snappy + subir bytes **ya comprimidos** —
  *"Codecs such as Hap have a very light CPU decompression stage, while codecs like H264 have a very heavy CPU
  decompression stage"*; (b) **se queda comprimida en VRAM** (¼–⅛ del tráfico PCIe); (c) `prereadframes`
  (anillo de pre-lectura); (d) decodificación troceada multinúcleo (12 chunks). Y **Hap ni toca NVDEC**.
  Caveat: **Hap Q @4K60 = ~506 MB/s por stream** → sin anillo de pre-lectura tironearía **peor** que H.264.
- **Premiere/Resolve**: separan **Playback Resolution** de **Paused Resolution** (¼ al reproducir, Full al
  pausar). La lección no es el proxy: **la resolución de decodificación es una decisión de tiempo de ejecución,
  no de importación**, y la calidad baja **mientras hay movimiento**, que es cuando nadie lo nota.

## 4-bis. Cerrado: blob: NO es el problema · el composite no se pudo medir

**`file://` vs `blob:`** (la única diferencia que quedaba entre mi banco y una sesión real, porque `addVideo`
usa `URL.createObjectURL` aunque ya tiene la ruta): **[0, 0, 0] fps de diferencia** con 1/2/3 clips.
**No tocar `addVideo`.**

**Trabajo por frame que escale con el proyecto: no hay.** El bucle de reproducción no reconstruye DOM por frame
(ni `renderTimeline` ni `renderMedia`); los dos recorridos de `state.media` son triviales sobre 26 elementos.

**El coste del composite sigue SIN medir.** El control de píxeles nunca funcionó (0.0% de canvas con contenido
incluso con clips reales desde disco y `readPixels` dentro del frame), así que los números de COMP 1024/2048/4096
**no valen y no se usan**. La verdad que sí vale es indirecta pero sólida: **la app llega a 60 fps con 3 clips**,
así que cueste lo que cueste el composite, cabe en el presupuesto.

**Bug menor encontrado:** `state.previewQuality` se **escribe** en el handler de los botones `Full/½/¼` y **no se
lee en ningún otro sitio**. Los botones funcionan en el momento (llaman a `setCompSize` directo), pero el ajuste
**no se reaplica**: si algo más cambia el composite (abrir proyecto, cambiar de secuencia), la calidad vuelve a
Full **y el botón sigue marcando ¼** → la UI miente sobre el estado. Pendiente.

## 5. Qué hacer (por retorno / esfuerzo)

1. **HECHO — servo de seeks.** Elimina un fallo intermitente real.
2. **Proxy AUTOMÁTICO + resolución de reproducción vs pausa.** El trabajo de verdad, y no es reescribir el
   motor: es **política**. Ya tenemos generación de proxy (manual) y camino WebCodecs. Le estamos pidiendo al
   editor que reproduzca **en directo un máster de cine de 12,5 GB**; Premiere y Resolve simplemente **no hacen
   eso**. Días, no semanas.
3. **Vigilar**: `addVideo` usa `URL.createObjectURL(file)` **aunque ya tiene la ruta en disco** (`path`).
   Comparación `file://` vs `blob:` en marcha; **no tocar sin evidencia**.
4. Sólo si 2 no basta: HAP + anillo de pre-lectura (paridad TouchDesigner, 1–2 semanas).

**NO hacer:** tocar flags de Chromium (sin evidencia, y ya dejaron el 3D negro una vez); mover el Y-flip al
shader (toca el eje de handedness que el CLAUDE.md prohíbe); re-arquitecturar suponiendo que WebCodecs es
zero-copy (no verificado).

---

## ADENDA R107b (17-07-2026) — MEDIDO: el límite es 3 decodificadores HW HEVC 10-bit concurrentes. Qué hace Premiere

**Pregunta de Beltrán:** Premiere corre ESE mismo clip duplicado 4× SIN proxy, fluido. ¿Qué hace que nosotros no?

**Medición honesta en la app viva** (Rito360, HEVC 10-bit 1080p60, sala 360, 4 muros; métrica que NO puede mentir:
`video.getVideoPlaybackQuality()` — frames realmente presentados por cada `<video>`, no el fps de nuestro render):

| Decodificadores `<video>` simultáneos | fps presentados por decodificador | readyState |
|---|---|---|
| 1 | 60.3 | 4 (perfecto) |
| 2 | 60.3 · 60.0 | 4 (perfecto) |
| **3** | 60.3 · 60.3 · 60.3 | **4 (perfecto)** |
| **4** | 2.0 · 1.3 · 5.0 · 4.3  (total ~12.7) | **1 (hambriento)** |

Nuestro `render()` va a **60fps en los 4 casos** — el motor WebGL (composite de la tira + sala 3D) NO es el cuello.
El cuello es la DECODIFICACIÓN: esta GPU/Chromium sostiene **exactamente 3 sesiones de hardware HEVC 10-bit
concurrentes**; el 4º `<video>` desborda el pool y tumba a los cuatro a decodificación por software (que no puede
con 1080p60 10-bit) → todo se congela. Acantilado nítido entre 3 y 4. La sala de Beltrán tiene 4 muros = 4 = uno de más.

**Qué hace Premiere que nosotros no:**
- No entrega N reproductores `<video>` de caja negra al sistema operativo. **Posee su propia tubería de decodificación**
  (Media Foundation / NVDEC directo) y no está atado al límite del pool de decodificadores de Chromium.
- **Decode-ahead + caché de frames:** decodifica POR DELANTE del cabezal a una caché acotada (RAM/GPU). Así no necesita
  4 sesiones VIVAS cada instante — sirve frames ya decodificados y multiplexa ≤3 sesiones de hardware en el tiempo.
- Playback resolution (1/2, 1/4): decodifica MENOS píxeles. Nuestro `<video>` decodifica a resolución completa siempre.

**Nosotros usamos `<video>` por clip (`_vinst`), que da: (a) tope de ~3 decodificadores HW, (b) cero control de
decode-ahead, (c) cero control de resolución de decodificación.** Ésa es toda la brecha.

**Opciones (con coste honesto):**
1. **Proxy** (lo que ya existe) — 960p H.264 ×4 es trivial, corre de sobra. Es lo que TODO NLE recomienda para HEVC
   10-bit pesado. Resuelve HOY. Contra: hay que generarlo una vez; no es "sin proxy".
2. **Optimized media a resolución completa (H.264/ProRes-like 8-bit)** — un "proxy" a 1080p pero en un códec de edición
   ligero. Calidad completa y probablemente >3 concurrentes (el tope de 3 es específico del HEVC 10-bit; H.264 8-bit usa
   otra ruta). A medир. Sigue siendo material intermedio, pero con calidad de entrega.
3. **Caché de decode-ahead con WebCodecs `VideoDecoder`** — la paridad real con Premiere sin proxy: demultiplexar el MP4
   una vez, decodificar por delante del cabezal a un anillo acotado de `VideoFrame`→textura GPU, ≤3 sesiones HW
   multiplexadas. Es la arquitectura correcta a largo plazo. Coste ALTO (necesita un demuxer MP4/HEVC + planificador) y
   RIESGO: hay que verificar con un spike que WebCodecs supera el acantilado de 3 ANTES de construir todo.

**Recomendación:** proxy para trabajar hoy; y un **spike acotado de WebCodecs** (¿4 `VideoDecoder` concurrentes superan
el tope de 3 `<video>`?) antes de comprometer la re-arquitectura. NO tocar flags de Chromium (regla del CLAUDE.md).

---

## ADENDA R107c (18-07-2026) — SPIKE WebCodecs: el acantilado de 3 es del `<video>`, NO del hardware. Confirmado

**Spike** (`scratchpad/spike-webcodecs.mjs`): demuxer MP4 mínimo (parseo ISO-BMFF: stsd/hvcC + stsz/stsc/stco/stss)
que alimenta N `VideoDecoder` de WebCodecs (`prefer-hardware`) con el mismo HEVC Main10 1080p60, midiendo frames de
salida por decodificador. Codec `hvc1.2.4.L123.B0`, hardware confirmado, 0 errores.

| Decodificadores concurrentes | `<video>` (fps c/u) | **WebCodecs (fps c/u)** |
|---|---|---|
| 1 | 60 | **804** |
| 3 | 60 · 60 · 60 | **259 · 259 · 259** |
| 4 | 2 · 1 · 5 · 4  (colapso) | **196 · 196 · 196 · 196** |
| 6 | — | **130 ×6** |

**Conclusión:** WebCodecs comparte UN pool de throughput (~780 fps constante) que se reparte parejo, **sin acantilado**.
Con 4 muros cada decodificador da 196 fps = **3,3× tiempo real**; con 6, 130 fps c/u. El tope de 3 era una limitación
del pool de decodificadores de `<video>` de Chromium, **no del hardware ni del códec**. La arquitectura de Premiere
(decode-ahead + caché, decodificación propia) es replicable con WebCodecs. El margen (196 fps con 4) cubre de sobra el
coste extra de demux-desde-disco + subida `VideoFrame`→textura.

**→ Decisión: la re-arquitectura de reproducción con WebCodecs (opción 3) está JUSTIFICADA y de-riesgada.**

**Plan por etapas (cada una verificable, sin romper el `<video>` actual hasta el final):**
1. Puente de lectura binaria por rango en `DSP` (hoy `fileOpen` es sólo escritura) → leer `moov` + samples on-demand del archivo de 12 GB sin cargarlo entero.
2. Demuxer MP4/HEVC como módulo (el del spike, endurecido: co64, edts, VFR, múltiples `stsd`).
3. Motor `ClipDecoder`: un `VideoDecoder` por fuente, anillo acotado de `VideoFrame` decodificando por delante del cabezal; API `frameAt(t)`.
4. Enganche en `upTex`/`motionTick`: si la fuente tiene `ClipDecoder`, tomar la `VideoFrame` de la caché en vez del `<video>`. Audio sigue por elemento/WebAudio.
5. Seek = decodificar desde el keyframe previo (stss). Fallback al `<video>` si WebCodecs no soporta el códec.
6. Quitar el `<video>` de vídeo del camino de preview cuando el `ClipDecoder` está activo.

**Riesgo:** es el núcleo de reproducción (la función más crítica). Etapas 1-3 son aisladas y no tocan el playback vivo;
el enganche (4-6) es donde hay que ir con cuidado y con el `<video>` como fallback.
