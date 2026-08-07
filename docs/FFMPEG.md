# Export por FFmpeg — estudio previo (2026-08-06)

Objetivo de Beltrán: **MP4 rápido a 4096², bitrates altos, H.264 y H.265, en Windows con RTX y en macOS
Silicon.** Uso **interno**, sin distribución.

## Lo que ya está medido, no supuesto

Sobre esta máquina (RTX 4060, FFmpeg 8.1 full de gyan.dev), con fuente sintética de 4096²:

| | Techo | Velocidad a 4096² |
|---|---|---|
| `h264_nvenc` | **4096²** (a 8192² responde «No capable devices found») | **22 fps** en p7 · 35 fps en p4 |
| `hevc_nvenc` | **8192²** | **19 fps** en p7 |

Contra lo que da Chromium hoy: H.264 se niega por encima de 3072², HEVC no pasa de ~1080p.

**La conclusión que manda sobre el diseño:** a 19-22 fps el codificador NO es el cuello de botella. Lo serán el
render y el transporte de fotogramas. Optimizar el codificador antes que el transporte sería trabajar en el
sitio equivocado.

## La licencia deja de ser un problema

Las obligaciones de la GPL se disparan al **distribuir**, no al usar. Siendo herramienta interna del estudio se
puede usar la compilación completa —con x264 y x265— sin obligaciones. Si algún día se distribuyera, habría que
volver aquí: la ruta limpia sería una compilación LGPL sin x264/x265, apoyada sólo en los codificadores del
hardware, que no son GPL.

## El punto difícil: cómo llegan los fotogramas al codificador

A 4096² un fotograma RGBA son **67 MB**. A 30 fps eso es 2 GB/s por una tubería: demasiado. Y escribir PNG
intermedios es peor todavía.

**La salida es convertir a YUV 4:2:0 EN LA GPU** antes de enviarlo — ya tenemos el motor WebGL para hacerlo — y
mandar NV12. A 4096² son **24 MB por fotograma**, unos 500 MB/s a 20 fps, que una tubería local lleva holgada.

Sin ese paso, el cuello de botella sería la tubería y no se notaría la mejora. Es la pieza con más trabajo real
de todo esto, y la que hay que hacer primero para no construir sobre arena.

## Codificadores por plataforma

| | Windows / RTX | macOS Silicon |
|---|---|---|
| H.264 | `h264_nvenc` | `h264_videotoolbox` |
| H.265 | `hevc_nvenc` | `hevc_videotoolbox` |
| Respaldo | `libx264` / `libx265` | `libx264` / `libx265` |

Se **sondea** cuál acepta el tamaño pedido en vez de codificarlo a mano, igual que ya hace `ripCodecOptions`
con WebCodecs: el mismo binario en otra máquina responde distinto, y el sondeo envejece bien.

## Calidad

«Maximum render quality» de Premiere es sobre el reescalado, y aquí no aplica: ya renderizamos a resolución
completa en la GPU y no hay escalado intermedio. Lo que sí se controla es el codificado:

- `-preset p7 -tune hq` (NVENC) — el más lento y mejor; p4 si se prefiere velocidad.
- `-rc vbr -b:v <alto> -maxrate <mayor>` — bitrates altos de verdad.
- `-spatial-aq 1 -temporal-aq 1` — reparte bits hacia donde se ve.
- `-rc-lookahead 32 -bf 3` — mejor decisión por fotograma.
- **10 bits en HEVC** (`-pix_fmt p010le -profile:v main10`) — importa en el domo, donde los degradados grandes
  hacen bandas en 8 bits.

## Plan por fases

1. **Transporte.** Conversión RGBA→NV12 en la GPU y tubería al proceso principal. Medir de punta a punta antes
   de seguir: si esto no da los ~500 MB/s, lo demás no sirve.
2. **El binario.** FFmpeg como `extraResources` de electron-builder (no dentro del asar), uno por plataforma,
   con `asarUnpack` como ya se hace con los addons de NDI y Spout. Suma unos 80 MB al instalador.
3. **Puente en `main.js`.** `spawn` del proceso, tubería por stdin, progreso leyendo stderr, y cancelación que
   de verdad mate el proceso hijo. `child_process` ya está importado.
4. **La rama de export.** Un códec nuevo en `EX_CODECS` con su sondeo, y los ajustes de calidad en la hoja.
5. **macOS.** Verificar en el Mac de Beltrán: VideoToolbox tiene sus propios topes y no se puede dar por hecho.

## Audio — DECIDIDO

Beltrán, 2026-08-06: **si el export es MP4, audio estéreo integrado; en cualquier otro códec, el audio va
aparte.**

La mezcla ya existe y no hay que rehacerla: `exportAudioMix(t0,endT)` la produce con un `OfflineAudioContext`.
Lo que cambia es a dónde va:

- **MP4** (los nuevos `h264_nvenc` / `hevc_nvenc`, y el actual por WebCodecs): la mezcla entra a FFmpeg como
  segunda entrada y se muxea dentro. Estéreo, AAC.
- **Secuencia PNG, HAP, y lo que venga**: la mezcla se escribe como **WAV suelto** junto a la salida. Un HAP no
  lleva audio y una secuencia de imágenes tampoco; ponerlo aparte es lo único honesto, y además es lo que
  esperan los reproductores de domo, que sincronizan el sonido por su cuenta.

Consecuencia de diseño: la mezcla se calcula IGUAL en los dos casos y sólo cambia el destino. Un solo camino de
audio, dos finales — no dos caminos que puedan divergir.

## Riesgos anotados

- **`h264_nvenc` topa justo en 4096².** Es exactamente lo que se pide, sin margen: por encima hay que ir a HEVC.
- **VideoToolbox sin medir.** Todos los números de arriba son de Windows. El Mac puede responder distinto y sólo
  se sabrá probándolo allí.
- **HAP.** (ver abajo)
- **HAP.** Sigue sin pasar por el recorte al círculo (ver R284). Si FFmpeg entra, quizá convenga replantear HAP
  entero en vez de arreglarlo por separado.
