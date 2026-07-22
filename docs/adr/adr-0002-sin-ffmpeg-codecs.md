# ADR-0002: Sin FFmpeg en runtime → códecs de Chromium + fallback de 4K

- **Estado:** Accepted
- **Fecha:** 2026-07-22
- **Deciden:** Beltrán, Claude

## Contexto
Empaquetar FFmpeg agrega ~70-100 MB, licencias y una superficie de proceso externo. La app ya tiene WebCodecs
(`VideoEncoder`/`AudioEncoder`) y `mp4-muxer` en el navegador. Pero en esta GPU híbrida el encoder H.264 de Chromium
topa alrededor de **4096² para cuadros cuadrados** → los másters de domo 4K fallan o degradan en silencio.

## Decisión
El export usa WebCodecs + `mp4-muxer`, **sin FFmpeg en runtime**. Para cuadros por encima del tope de H.264 se usa
**HEVC** cuando el encoder lo reporta, y si no, **secuencia de PNG**. Se sumó además un códec **HAP propio** (Snappy +
DXT en GPU + muxer QuickTime `.mov`) para entrega a media servers. FFmpeg (si está instalado) se usa solo como **juez
externo** para verificar exports, nunca en runtime.

## Consecuencias
- (+) Sin dependencia pesada; entrega 4K confiable (ruta PNG lossless) + HAP para Resolume/TouchDesigner.
- (−) PNG-seq es grande y necesita un mux externo para entrega final.
- (−) Varias rutas de export a mantener (MP4 / HEVC / PNG / HAP).

## Confirmación
Round-trip de un export 4K de domo; decodificar con ffmpeg y comparar contra el original (patrón usado en R100 HAP).
