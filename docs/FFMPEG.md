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

## Fase 3 hecha y medida (2026-08-06) — el cuello de botella se ha MOVIDO

Puente en `main.js` + `preload.js`, y prueba de punta a punta: fotogramas de nuestro FBO de 4096², por la
tubería, a `h264_nvenc`. **Sale un MP4 real de 4096×4096** que ffprobe lee sin quejarse, la memoria del
renderer se queda en **+0 MB** durante el volcado —la contrapresión funciona— y cancelar mata el proceso.

Pero la velocidad de punta a punta es **5,3 fps**, no los ~12 estimados. Desglose de los 189 ms por fotograma:

| | ms |
|---|---|
| `readPixels` | 34 |
| codificador | ~45 |
| **el resto (IPC)** | **~110** |

**El cuello de botella ya no es ni la lectura ni el codificador: es pasar 64 MB del renderer al proceso
principal.** `ipcRenderer.invoke` clona el búfer, y a 64 MB por fotograma eso se paga caro.

Y esto **resucita la fase 1 aplazada, pero por otro motivo del que se aplazó**. NV12 bajaría el fotograma de
64 a 24 MB: menos IPC, no menos lectura. Alternativas a estudiar antes de elegir:

- **NV12 en la GPU** — 2,7× menos bytes por el mismo camino.
- **Saltarse el IPC**: que el renderer escriba a un socket o a una tubería con nombre que FFmpeg lea directo,
  sin pasar por el proceso principal.
- **Solapar**: leer el fotograma N+1 mientras FFmpeg digiere el N. No baja el coste, lo esconde.

Lo honesto es medirlas antes de elegir, igual que se hizo con la fase 1 — que es precisamente lo que evitó
construir NV12 sobre una suposición equivocada.

## Fase 4 decidida por medida (2026-08-06) — NV12, y no las otras dos

Se aisló el IPC mandando a un sumidero (`-f null`): sin codificar y sin escribir a disco, lo único medido es el
viaje renderer → proceso principal.

| | ms por fotograma |
|---|---|
| RGBA, 64 MB (lo de hoy) | **161** |
| NV12, 24 MB (la meta) | **47** |

2,67× menos bytes dan **3,45× menos tiempo**: superlineal, porque los búferes de 64 MB caen en un camino más
lento del clonado. **El coste es por byte, así que NV12 es el camino** — y las otras dos ideas quedan
descartadas o aplazadas por una razón medida, no por intuición:

- **Socket en vez de IPC**: mucho más trabajo para atacar el mismo coste que NV12 ya baja 3,45×. Si algún día
  hace falta más, se retoma.
- **Solapar lectura y codificado**: no baja el coste, lo esconde. Vale la pena DESPUÉS de NV12, cuando el
  codificador vuelva a ser el que manda.

Proyección de la cadena con NV12: 34 (lectura) + 47 (IPC) + 45 (codificador) = 126 ms ≈ **8 fps en serie**, y
~12 fps si además se solapa. Contra los 5,3 de ahora, y contra el «no se puede» de antes de todo esto.

## El shader NV12 — diseño cerrado (pendiente de escribir)

La pieza que queda. Un error aquí es **sutil y caro**: colores levemente lavados que no se ven en el monitor y
sí al proyectar. Por eso el diseño va escrito antes que el código, y con una prueba que lo compare contra la
conversión del propio FFmpeg.

### Disposición de memoria

NV12 son dos planos contiguos: **Y** de W×H bytes, y detrás **UV** entrelazado (U,V,U,V…) de W×(H/2) bytes.
Total = W×H×1,5. Para 4096²: 24 MB.

El truco para sacarlo de la GPU **en una sola lectura**: un FBO RGBA8 de **(W/4) × (H + H/2)**, donde cada
téxel empaqueta 4 bytes consecutivos. Para 4096² son 1024 × 6144. `readPixels` devuelve entonces exactamente
la secuencia de bytes que FFmpeg espera, sin reordenar nada en la CPU.

- **Zona Y** (filas `0 … H-1`): el téxel `(x,y)` lleva los Y de las columnas `4x, 4x+1, 4x+2, 4x+3`.
- **Zona UV** (filas `H … H+H/2-1`): fila de croma `cy = y - H`. El téxel `(x,cy)` lleva `U₀,V₀,U₁,V₁` de los
  dos bloques de croma que cubren las columnas `4x…4x+3` y las filas fuente `2·cy` y `2·cy+1`. Cada U y cada V
  es la media de su bloque 2×2, que es lo que hace `swscale`.

### Matriz de color

**BT.709, rango limitado** — el estándar de HD/4K, y lo que asume cualquier reproductor de domo salvo que se
le diga otra cosa. Sobre R,G,B ya en 0..1 **no lineales** (con gamma, tal como salen del composite):

    Y  = 16  + 219 · ( 0,2126·R + 0,7152·G + 0,0722·B )
    U  = 128 + 224 · ( (B - Y') / 1,8556 ) / 2
    V  = 128 + 224 · ( (R - Y') / 1,5748 ) / 2

donde `Y'` es la luma en 0..1 antes de escalar. Los `/2` no son cosméticos: llevan el rango de −0,5..0,5 a
0..1 antes de aplicar la excursión de 224.

Y hay que **decírselo a FFmpeg**, o etiquetará el archivo como indefinido y cada reproductor adivinará:
`-colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv`.

### Cómo se comprueba que está bien

No a ojo. Se exporta el mismo fotograma por dos caminos: el nuestro (shader → NV12 → FFmpeg) y el de control
(RGBA → FFmpeg, que convierte con `swscale`). Se comparan los dos vídeos decodificados. **Criterio: PSNR por
encima de 45 dB.** Por debajo, la matriz o el submuestreo están mal; una diferencia de rango (limitado contra
completo) se delata sola porque hunde el PSNR a ~30 dB.

### Riesgo anotado

`readPixels` sobre un FBO de 1024×6144 — hay que comprobar que `MAX_TEXTURE_SIZE` y `MAX_RENDERBUFFER_SIZE` lo
admiten. En esta GPU sobra, pero conviene sondearlo y caer al camino RGBA si algún día no.

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

## Fase 1 medida (2026-08-06) — y el plan cambia

`readPixels` de un FBO de 4096² en esta máquina: **33,9 ms por fotograma** (64 MB a 1888 MB/s), o sea un techo
de **29,5 fps** sólo por la lectura. Con el codificador en 19-22 fps, la cadena en serie da **~12 fps a 4096²**.

Beltrán, al ver el número: «es normal que se demore, en Premiere también salía lento». Con esa vara, 12 fps
sobra — y compara contra lo de hoy, que es **no poder exportar 4096² en MP4 en absoluto**.

**Consecuencia: la conversión a NV12 en la GPU deja de ser requisito y pasa a ser optimización posterior.** Era
la pieza con más trabajo y más riesgo de todo el proyecto, y resulta que no bloquea. Se hace después, cuando
haya algo funcionando que medir de verdad, y no antes sobre una suposición.

## Plan por fases (revisado)

1. ~~**Transporte NV12.**~~ **Medido y aplazado**: `readPixels` en RGBA ya da 29,5 fps, por encima del
   codificador. Vuelve al final como optimización — pasar de 64 a 24 MB por fotograma subiría el techo de la
   lectura a ~78 fps, pero sólo se notará cuando el codificador deje de ser el límite.
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
- **HAP.** Sigue sin pasar por el recorte al círculo (ver R284). Si FFmpeg entra, quizá convenga replantear HAP
  entero en vez de arreglarlo por separado.
