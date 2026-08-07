# Investigación 2 — Cómo robustecer la reproducción de vídeo (fluidez multi-stream)

*Investigación web con 4 agentes (Sonnet) — 18-07-2026. Fuentes al final de cada punto.*

## TL;DR — el hallazgo que lo cambia todo

1. **El tope de 3 decodificadores es un límite FÍSICO de NVDEC** (unidades de decode del chip NVIDIA en GeForce), no de
   Chromium ni ajustable por flags. Pelear contra él con más `<video>`/`VideoDecoder` no tiene salida.
2. **La solución que usan TouchDesigner y Resolume para ir fluidísimos es NO pasar por NVDEC**: reproducen **Hap**, un códec
   cuyos frames YA son texturas comprimidas DXT/BC. "Decodificar" es sólo Snappy en CPU (baratísimo) + subir los bytes
   comprimidos a una textura — **la GPU los descomprime gratis en el sampler**. NVDEC nunca compite con el render. Sidestep total.
3. **Nosotros ya tenemos el 80% de las piezas para reproducir Hap**: exportador Hap (R100), compresor Snappy (R100·H1),
   demuxer MP4 (R108). Falta: leer las secciones Hap del `.mov`, **des**comprimir Snappy, y subir con `compressedTexImage2D`.

→ **Reproducir Hap como formato de proxy resolvería exactamente el techo que medimos** (4× HEVC10 satura la GPU).

---

## 1. Hap → textura comprimida (MÁXIMO valor, ya casi lo tenemos)

- Hap guarda cada frame en **S3TC/DXT** (el formato nativo de texturas de la GPU) + una pasada ligera de **Snappy** (lossless,
  ~2:1, muy rápida). Reproducir = demux + Snappy-decompress (CPU barato) + **subir bytes DXT directo a la GPU**; la GPU
  descomprime en el sampler, gratis, cada draw. **No toca NVDEC.** Por eso 6+ capas 1080p van fluidas donde H.264 cae con 2.
- WebGL2 lo soporta HOY: extensión `WEBGL_compressed_texture_s3tc` → `compressedTexImage2D`/`compressedTexSubImage2D` con
  `COMPRESSED_RGB_S3TC_DXT1_EXT` / `COMPRESSED_RGBA_S3TC_DXT5_EXT`. Hap Q (YCoCg-DXT5) usa el mismo formato DXT5, sólo cambia
  el shader de shuffle Y/Co/Cg→RGB (que ya conocemos del export R100).
- **No hay decoder Hap en WebCodecs** → hay que demuxear las secciones Hap nosotros (ya tenemos demuxer MP4 + el parseo de
  secciones Hap del export) y **des**comprimir Snappy en JS/WASM (tenemos el compresor; falta el descompresor — es sencillo).
- **Coste:** Hap ocupa mucho más en disco (Hap Q ~300-500MB/10s a 1080p; ×4 en 4K) → necesita SSD/NVMe. El cuello pasa a ser
  banda de DISCO, no GPU — mucho más fácil de alimentar (lectura secuencial) que 4× NVDEC.
- Fuentes: Vidvox/hap, VDMX "Presenting Hap", MDN `WEBGL_compressed_texture_s3tc`, Khronos S3TC spec, Resolume DXV-vs-H264,
  vizloops comparativa de códecs, docs TouchDesigner Hap.

**Aplicable HOY. Es la recomendación nº1.** Encaja con los proxies MANUALES: en vez de (o además de) proxy H.264 960p, un
**proxy Hap** para el material inmersivo pesado → reproducción multi-muro fluida sin NVDEC.

## 2. Bajar la resolución de reproducción (palanca inmediata, ya casi existe)

- Premiere/Resolve tienen "Playback Resolution" (½, ¼) — reducen el ancho de banda de render en tiempo real. No baja solo
  frame-a-frame; es ajuste manual / proxy explícito.
- Nosotros: `previewQuality` ya escala el COMP FBO (2048²→1024²…). **Bajar el preview a ½ libera GPU para el decode** →
  NVDEC respira → el motor WebCodecs (R108) podría entregar. Es la palanca más barata para HOY, sin código nuevo.
- Mejora posible: un "playback resolution" que además baje el tamaño del render de la sala/domo durante scrubbing/multi-track.
- Fuentes: Adobe/LucidLink, Frame.io Resolve tips.

## 3. Decodificar en un Web Worker (libera el hilo, NO la GPU)

- WebCodecs ya decodifica off-thread (GPU process); un Worker **no acelera el decode**, pero saca del hilo principal los
  callbacks `output`/feed/demux que compiten con el render — que fue parte de nuestro cuello (feed ahogado). `VideoFrame` es
  **transferible** (postMessage zero-copy) worker→main; o subir dentro del worker con `OffscreenCanvas`+webgl2.
- **Matiz honesto:** nuestro cuello medido era GPU (NVDEC vs WebGL), no sólo el hilo → el worker ayuda pero puede no bastar
  para 4× HEVC10. Vale como complemento, no como bala de plata.
- Fuentes: Chrome for Developers "Video processing with WebCodecs", web.dev OffscreenCanvas.

## 4. Subida a textura más eficiente

- `texImage2D(VideoFrame)` **no garantiza zero-copy**; 10-bit/YUV "esotéricos" fuerzan readback CPU (justo nuestro caso HEVC10).
- Benchmarks (webcodecsfundamentals): `createImageBitmap`+BitmapRenderer 3-4× más rápido que Canvas2D; **WebGPU
  `importExternalTexture` es el único zero-copy real** (conversión YUV→RGB en shader del navegador). Migrar WebGL2→WebGPU es
  grande (motor de ~4700 líneas) pero es el salto de mayor impacto a futuro.
- **PBOs (Pixel Buffer Objects)** en WebGL2 (`PIXEL_UNPACK_BUFFER`) + doble-buffer → subida por DMA en segundo plano, menos
  estancamiento del pipeline al subir frames grandes. Aplicable a WebGL2 hoy (el no-bloqueo real depende del driver).
- Cerrar el `VideoFrame` **inmediatamente tras subirlo** (no esperar al reciclado del anillo) — evita fuga de VRAM.
- Fuentes: webcodecsfundamentals rendering, webgpufundamentals video, MDN texSubImage2D, Khronos PBO, songho PBO.

## 5. Arquitectura de los que van fluidos (patrón universal)

- **demux → decode (hilo propio) → cola de frames con PTS → present**, con back-pressure; decode NUNCA bloquea el present
  (mpv, VLC, OBS, ffmpeg). TouchDesigner: **"Pre-Read Frames"** = decode-ahead a RAM (nuestro anillo R108 = mismo patrón;
  auditar su tamaño y disciplina de `close()`).
- Multi-stream: compartir decoders donde se pueda, resolución distinta por pista, priorizar el clip visible.
- Los chunks salen en **orden de decode, no de display** (B-frames) → el anillo debe ordenar por `timestamp` (ya lo hacemos).
- Fuentes: mpv DeepWiki, VLC architecture, OBS DeepWiki, ffmpeg multithreading, MDN WebCodecs.

## 6. Diagnóstico seguro (sin flags peligrosos)

- `chrome://gpu` → "Video Acceleration Information" (¿figura `hevc main 10` soportado?).
- `chrome://media-internals` → por cada `<video>`, el nombre real del decoder (`D3D11VideoDecoder`=HW; FFmpeg/libgav1=software).
- Sirven para confirmar si un stream cae a software sin avisar. Fuentes: DaTosh guía, StaZhu enable-hevc.

---

## Recomendación priorizada

| # | Acción | Impacto | Esfuerzo | Ya tenemos |
|---|--------|---------|----------|------------|
| **1** | **Reproducción Hap** (demux Hap + Snappy-decompress + `compressedTexImage2D`) | **ALTO** — evita NVDEC, multi-stream fluido | Medio | Export Hap (R100), Snappy (R100·H1), demuxer MP4 (R108) |
| 2 | **Preview a ½ durante multi-track** (palanca ya existente + auto-baja) | Medio-alto | Bajo | `previewQuality`/`setCompSize` |
| 3 | Mover ClipDecoder a **Web Worker** | Medio | Medio-alto | ClipDecoder (R108) |
| 4 | **PBO doble-buffer** para subida de textura | Bajo-medio | Medio | upTex |
| 5 | (Futuro) Migrar compositor a **WebGPU** (zero-copy real) | Alto | ALTO | — |

**Camino recomendado:** empezar por **Hap playback** (nº1) — es lo que hace fluido a TouchDesigner, sidestepa el límite
físico de NVDEC que medimos, y ya tenemos casi todas las piezas. La palanca nº2 (preview ½) es gratis para probar HOY.
