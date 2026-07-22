# Dome Studio Pro — Enfoque técnico (cómo está construido el software)

> Documento de **arquitectura real**, escrito inspeccionando el código del repo
> (no el manual de diseño). Pensado para que otra persona/IA pueda analizar el
> proyecto rápido. Cuando algo no se pudo confirmar leyendo el código, se marca
> **sin verificar**. No se infla nada.
>
> Leyenda de estado: ✅ funciona y verificado en vivo · 🟡 parcial/con límites ·
> ❌ ausente/no implementado · 🐞 bug conocido · ⚠️ riesgo/deuda.
>
> Archivos base: `app.js` (1652 líneas, motor + UI), `index.html` (503),
> `main.js` (122, proceso Electron main), `preload.js` (32, puente IPC),
> `mp4-muxer.min.js` (librería vendorizada), `package.json`, `PLAN.md` (changelog
> de diseño — **no** es fuente de verdad para el "as-built**).

---

## 1. Idea central en una frase

Es un **editor de vídeo fulldome** (proyección 180° azimutal-equidistante / "fisheye")
empotrado en una sola ventana web, empaquetado como `.exe` con Electron. Toda la
lógica (motor de render + timeline + export) vive en un único `app.js` de JS
plano que corre en el *renderer*, usando **WebGL2** para pintar el domo y
**WebCodecs + mp4-muxer** para exportar. El proceso *main* de Electron solo
aporta diálogos nativos y acceso a disco.

---

## 2. Filosofía de construcción (las decisiones de fondo)

1. **Cero build step.** No hay bundler, ni transpilador, ni framework. `index.html`
   carga `mp4-muxer.min.js` y luego `app.js` con un `<script>`. Esto hace el
   proyecto trivial de servir en web (preview) y de empaquetar (Electron lee los
   mismos archivos). Coste: todo el motor vive en **un archivo gigante** (1652
   líneas) sin módulos ES ⚠️.

2. **Un solo estado global mutable.** Un objeto `const state = {…}` que se muta
   directamente; tras cada cambio se llama a `render()` (GL) y a funciones
   `renderTimeline()/renderInspector()/renderMedia()` (DOM). No hay Redux/MobX/
   reactividad: el "binding" es manual. Simple y rápido de razonar; frágil ante
   olvidos de re-render.

3. **El render del domo es el corazón.** Todo se compone primero en una textura
   "máster" fisheye (un FBO de 2048²) y de ahí se muestra en 2D (blit) o se mapea
   sobre una malla de domo en 3D. Esto desacopla "qué se ve" de "cómo se mira".

4. **WebCodecs en vez de FFmpeg.** No hay binario sidecar. El export y los proxies
   usan el `VideoEncoder`/`AudioEncoder` del navegador + `mp4-muxer` para el
   contenedor. Ventaja: sin dependencias nativas. Límite: solo lo que el navegador
   soporta (H.264 8-bit, AAC) 🟡.

5. **El mismo código corre en web y en `.exe`.** Una bandera `IS_ELEC` decide si
   usar el puente `DSP` (IPC a disco) o las APIs del navegador (`<input file>`,
   descarga de blobs). El preview web es la herramienta de desarrollo/verificación.

---

## 3. Stack y arquitectura

| Capa | Qué es | Detalle real |
|------|--------|--------------|
| Runtime | **Electron 42.4.1** | `devDependencies` en `package.json`; `main: "main.js"` |
| Empaquetado | **electron-builder 26.15.2** | `npm run dist` → `electron-builder --win` → target `portable` + `nsis` (x64) |
| Lenguaje | **JavaScript plano** (`"use strict"`) | sin TypeScript, sin bundler, sin transpilación |
| Render | **WebGL2** | contexto `gl`, composite a FBO 2048² (`COMP=2048`) |
| Códec | **WebCodecs** + `mp4-muxer` (vendorizado) | sin FFmpeg |
| UI | DOM + CSS a mano en `index.html` | iconos SVG inline (`ICO()`), Google Fonts por CDN ⚠️ |
| Deps npm runtime | **ninguna** | `package.json` solo tiene devDeps; mp4-muxer es un archivo local |

**Split main / renderer**
- `main.js` (proceso Node): crea la `BrowserWindow`, registra los handlers IPC y
  hace diálogos nativos. (122 líneas.)
- `preload.js` (contextBridge): expone `window.dsp` con canales `dsp:*`
  (verificados en uso desde `app.js`): `saveDialog`, `openDialog`, `pickMedia`,
  `readText`, `writeText`, `stat`, `exists`, `setTitle`, `setUiState`,
  `chooseExportDir`, `writeBinary`, `ensureDir`, `basename`. *(La lista exacta y
  completa es la de `preload.js`; aquí van los que se usan de hecho en el motor.)*
- `app.js` (renderer): **todo lo demás** — estado, motor GL, timeline, keyframes,
  import, proxies, export, persistencia, i18n.

**Cómo se compila y corre**
- Desarrollo web (preview): se sirve la carpeta por HTTP; el loader de `app.js`
  añade `?v=<timestamp>` solo sobre `http` para cache-busting; en `file://`
  (empaquetado) lo carga plano.
- `.exe`: `npm run dist`. **Importante (gotcha real):** tras editar el código hay
  que volver a correr `dist` para que el `.exe` tome los cambios; el preview web
  los toma al instante.

❌ **No hay tests automatizados ni CI** (no hay scripts de test en `package.json`
ni archivos de test). La verificación ha sido **manual/en vivo** (lectura de
píxeles con `gl.readPixels` y comprobaciones de DOM en el preview).

---

## 4. Estructura del proyecto (archivos clave)

```
Dome Studio Pro/
├─ index.html         # DOM + CSS + defs de iconos + loader de app.js (503 líneas)
├─ app.js             # Motor (GL, timeline, export) + UI (1652 líneas) — el grueso
├─ main.js            # Electron main: ventana + handlers IPC dsp:* (122)
├─ preload.js         # contextBridge: window.dsp (32)
├─ mp4-muxer.min.js   # librería de muxing MP4 vendorizada (minificada)
├─ package.json       # Electron + electron-builder; sin deps de runtime
├─ PLAN.md            # changelog/roadmap de diseño (NO es el as-built)
└─ assets/
   ├─ alma-logo.png   # icono de la app
   └─ media/          # (assets de medios)
```

---

## 5. Modelo de datos (el `state`, esquema real)

No hay librería de store. Es un objeto global que se muta directamente
(`app.js:13`):

```js
const state = {
  fps:60, media:[],
  lanes:[ {id:uid(),name:'Video 1',tag:'V1',kind:'video'}, … , {…,kind:'audio'} ],
  clips:[],
  playhead:0, playing:false, loop:false,
  selId:null,
  view:{ mode:'2d', three:'spec', zoom:0.92, pan:[0,0], showGrid:true, showSafe:false,
         showOutline:true, cull:false, cw:400, ch:400,
         cam:{yaw:0, pitch:0.5, dist:3.0, fov:100, back:0} },
  tl:{ pxPerSec:80, tool:'select', snap:true, tcMode:'timecode', bpm:120, sig:4 },
  workIn:null, workOut:null,
  graphOpen:false, graphProp:'az',
  prefs:{ reducedMotion, snapping, grid, safe, mediaCollapsed, inspCollapsed },
  mediaFilter:'all', mediaQuery:'', mediaGroupBy:'none', collapsedGroups:{}, folders:[],
  useProxies:true, previewQuality:1, markers:[], selMarkerId:null, clipboard:null,
  groups:[], selGroupId:null, dirty:false, selLane:null, selIds:[],
  sequences:[], activeSeqId:null, lang:'en', lastSaved:null,
};
```

**Media item** (creado en `importFiles`, `app.js:417`+). Ejemplo vídeo:
```js
{ id, name, kind:'video', el:v, originalEl:v, srcUrl:url, tex:newTex(),
  w:videoWidth, h:videoHeight, dur:v.duration, fps:30 /*luego autodetectado*/,
  thumb, color, proxyReady:false, proxyPct:0, path }
```
- `el` = fuente "viva" usada por el **preview** (se **reemplaza por el proxy**
  cuando este queda listo). `originalEl` = siempre el original (lo usa el **export**).
- `kind` ∈ `video | image | audio | sequence | text | shape | nest`.
- audio añade `buffer` (AudioBuffer), `peaks`, `thumb` (waveform).
- nest añade `nestClips` / `nestLanes` (subtimeline) + su propio FBO.

**Clip** (`makeClip`, `app.js:557`): tiene `id`, `mediaId`, `lane` (índice),
`start`, `dur`, `inP` (in-point en la fuente), `props{…}`, `kf{…}` (keyframes),
`maskData`/`maskTex`, `groupId`, `trans` (transición), blend, fades, etc.
`props` incluye transform en el domo (`az`, `el`, `size`, `rot`, `op`),
y grade por clip (`exp, con, sat, tmp, tnt, glow, ca`) + `fulldome` (bool).

**Keyframes**: `clip.kf = { <prop>: [ {t, v, ease, hOut?, hIn?}, … ] }` — `t`
relativo al inicio del clip; `ease` ∈ `linear|in|out|both|hold`; `hOut/hIn` son
los manejadores bézier (opcionales).

**Serialización** (`serClip` `app.js:1227`, `serSeq` `:1237`): deep-clone JSON,
se elimina `maskTex` (textura GL viva) y se conserva `maskData` (dataURL).

---

## 6. Render del domo (WebGL2)

**Sí es WebGL2** (no Canvas2D, no WebGPU). Pipeline en capas:

1. **Composite a textura máster fisheye.** `composite(t, size, opaque)`
   (`app.js:277`) pinta cada clip activo en un FBO (`compFBO`/`compTex`, 2048²)
   con `compositeClips(t)` ordenando por pista y resolviendo transiciones:
   ```js
   function composite(t,size,opaque){
     gl.viewport(0,0,size,size); gl.clearColor(0,0,0,opaque?1:0); gl.clear(COLOR_BUFFER_BIT);
     for(const x of compositeClips(t)) drawClip(x.c, mediaById(x.c.mediaId), t, x.xf);
   }
   ```
2. **`drawClip`** (`app.js:233`) deforma cada fuente de proyección **gnomónica →
   fisheye** con una malla + shader de warp (programa `PW`/`VSW`/`FSW`), aplicando
   en el fragment shader el grade primario por clip (exposición/contraste/sat/
   temp/tint), glow, aberración cromática, opacidad y dither. Si el clip está
   marcado `props.fulldome`, usa un programa 1:1 (`PFD`) que mapea la textura
   directa al domo sin warp (para material que ya viene en fisheye).
3. **Mostrar** según `state.view.mode`:
   - **2D** (`'2d'`): blit del composite a pantalla (programa `PB`), con
     corrección de aspecto (`u_aspect`) para que el disco quede circular y
     centrado llenando todo el panel; fondo negro.
   - **3D** (`'3d'`): el composite se mapea sobre una **malla de hemisferio**
     (programa `VS3/FS3`) y se observa con una cámara en perspectiva.

**Matemática de proyección** (`app.js:380`+), toda a mano (no usa three.js):
```js
function persp(fovy,a,n,fr){…}              // matriz de perspectiva
function lookAt(eye,ctr,up){…}              // matriz de vista
function mul4(a,b){…}                        // multiplicación 4×4
function cameraMVP(spec){…}                  // MVP de la cámara (ver abajo)
function proj3(P,mvp,flipx){…}               // proyecta punto 3D → pixel de pantalla
function f2azel(nx,ny){…} / azel2f(az,el){…} // fisheye ↔ azimut/elevación
function dirAzEl(az,el){…} / frame(az,el){…} // dirección 3D desde az/el
function f2pix(nx,ny){…} / pix2f(px,py){…}   // fisheye normalizado ↔ pixel (modo 2D)
```

**Cámara 3D** (`cameraMVP(spec)`, `app.js:383`): dos sub-modos en `state.view.three`:
- `'spec'` (**Visor desde dentro del domo**): FOV = `cam.fov` (independiente),
  posición = "dolly" sobre el eje de mirada (`cam.back`, rango `[-0.9, 2.4]`); el
  scroll mueve la cámara (acercar/retroceder) y el FOV es un slider aparte. ✅
- `'orbit'` (vista externa): FOV fijo 48°, scroll = distancia (`cam.dist`).

**Handedness 2D↔3D** (`u_flipx = -1`): hay **un flip horizontal intencional** en
el shader para que la imagen coincida entre el visor 2D y el 3D. ⚠️ No tocar:
está calibrado; "corregirlo" rompe la correspondencia.

**Cull de horizonte**: la malla del domo solo llega a elevación 90° (hemisferio),
así que no hay "suelo". Existe `state.view.cull` como toggle. *El efecto exacto
de `cull` en el fragment está sin verificar a fondo en esta inspección.*

---

## 7. Reproducción y audio

- **Reloj maestro**: bucle `requestAnimationFrame` (`playRaf`) que avanza
  `state.playhead` por delta de `performance.now()` (`play()`/`pause()`,
  `app.js:1069`).
- **Sincronía vídeo**: durante la reproducción, cada vídeo sube su frame a textura
  por su cuenta con `requestVideoFrameCallback` (`pumpVF`, `app.js:1066`); en
  scrub/seek manual se usa `seekMedia(m, t, /*useOrig=*/false)` (proxy).
  `HAS_RVFC` detecta soporte. 🟡 No es un PLL estricto vídeo↔reloj: el vídeo
  "sigue" al playhead vía seek/rVFC, lo que puede derivar en clips largos
  (**sin verificar** la magnitud del drift).
- **Audio**: Web Audio. Al importar, `decodeAudioData` → `AudioBuffer`; se
  calculan `peaks` (`computePeaks`) y un thumbnail de onda (`waveThumb`). El
  **mezclado** de audio (mute/solo + fades) se hace en el **export** con
  `OfflineAudioContext` (`exportAudioMix`). 🟡 El detalle del *scheduling* de
  audio en la reproducción en vivo está **sin verificar** en esta pasada (hay
  `stopAudio`/`setMeters`).
- **Waveform**: extraída de los `peaks` del `AudioBuffer`; se dibuja en el clip
  (`drawClipWave`, `app.js:570`) y en el panel de medios.

---

## 8. Import y proxies

**Formatos** (`importFiles`, `app.js:417`): imágenes (→ canvas ajustado), vídeo
(`HTMLVideoElement`), audio (decodificado), **secuencias de imágenes numeradas**
(≥3 con mismo prefijo → un clip `kind:'sequence'` @24fps), además de clips de
**texto/título** y **formas** generados a canvas, y **nests**.

**Detección de FPS de vídeo** (`detectFps`, `app.js:482`): muestrea ~10 frames con
`requestVideoFrameCallback`, toma la mediana del delta y la "imanta" a
`24/25/30/48/50/60`.

**Proxies** — 🟡 con un límite importante:
```js
const PMAX=960, PMBPS=12, proxyQ=[]; let proxyBusy=false;   // app.js:487
function enqProxy(m){ proxyQ.push(m); pumpProxy(); }
async function pumpProxy(){ … const m=proxyQ.shift(); await makeProxy(m); … }  // SECUENCIAL
```
- **Códec**: H.264 vía WebCodecs — `avc1.42E01E` (Baseline), con fallback
  `avc1.4D0028` (Main L4.0); bitrate **12 Mbps**; reescalado a máx **960 px**;
  contenedor mp4-muxer (`ArrayBufferTarget`, in-memory).
- **Keyframes**: GOP periódico — `enc.encode(vf, {keyFrame: i%gop===0})`
  (`app.js:503`). Es decir, *sí* hay keyframes periódicos para permitir seek; la
  frecuencia depende de `gop`.
- **Hilo**: corre en el **main thread del renderer**, no en un Worker ⚠️. Cede con
  `await new Promise(r=>setTimeout(r,0))` y aplica backpressure
  (`while(enc.encodeQueueSize>4) await …`), pero importar muchos vídeos **puede
  causar jank** en la UI mientras se generan los proxies.
- **Dónde se guarda**: en **memoria** (blob URL, `m.proxyUrl`); `m.el` se
  **reemplaza** por el elemento de proxy (`m.el=pv`). No se persiste a disco; al
  reabrir el proyecto, los proxies **se regeneran**.
- **Enlace original↔proxy**: `m.originalEl` siempre es el original; `m.el` apunta
  al proxy cuando `m.proxyReady`. Estado visible en el clip (`⚡ PROXY` / `PROXY n%`
  / `ORIGINAL`) y filtro en el panel de medios.

**¿Export lee original o proxy?** ✅ **El export lee el ORIGINAL.** El preview usa
proxy y el export pide el original explícitamente:
```js
// preview/scrub  (app.js:1062)  → proxy:
tasks.push(seekMedia(m, local, false));
// export        (seekExport, app.js:1080) → original:
tasks.push(seekMedia(m, local, true));
// seekMedia(m,t,useOrig): const v = useOrig ? m.originalEl : (m.el||m.originalEl);
```

---

## 9. Export / encoding

**WebCodecs + mp4-muxer** (sin FFmpeg). Gate: `HAS_WC = VideoEncoder && window.Mp4Muxer`
(`app.js:413`). Dos salidas (`runExport`, `app.js:1121`):

1. **Secuencia PNG (por defecto)** — `option value="png" selected` en el diálogo.
   - Electron: cada frame se **escribe a disco en streaming** (`DSP.writeBinary`,
     `dome_NNNN.png`) + `audio.wav`; lanza error real si el disco falla.
   - Browser: se construye un **ZIP en memoria** (clase `Zip` propia, método
     *store* + CRC) y se descarga.
   - ✅ Soporta **alfa** y es **sin pérdida** (8-bit RGBA). Es la ruta recomendada
     para 4K+ y para composición posterior.

2. **MP4 · H.264** — cuadrado `res×res`, `codec:'avc'`, `fastStart:'in-memory'`,
   fondo **negro** (sin alfa). Audio **AAC** `mp4a.40.2` 192 kbps vía
   `muxAudioAAC`, declarado **solo si** `AudioEncoder.isConfigSupported` (evita un
   MP4 con pista vacía malformada). Si la resolución supera el límite de H.264
   (≈4096²/nivel) **se lanza error** y se pide usar PNG. 🟡 **Sin 10-bit, sin
   alfa** en MP4 (limitación de WebCodecs/H.264 8-bit aquí).

- **Cola de render**: `_exq` / `pumpExportQ` — **secuencial** (un job a la vez),
  con barra de progreso y cancelación (`cancelExport`). Cada frame:
  `seekExport(t)` (original) → `prepNests` → `composite(t,res,true)` → `gl.finish()`.
- **Presets de export**: `state.exportPresets` (resolución/fps/códec).

---

## 10. Timeline

- **Modelo**: `state.lanes[]` (pistas: `{id,name,tag,kind}`) + `state.clips[]`
  (cada clip lleva `lane` = índice de pista). El orden visual es *top-down*
  (`lanesTopDown`).
- **Snapping** (`applySnap`, `app.js:696`): tolerancia = **9 px** convertidos a
  segundos (`const px = 9/state.tl.pxPerSec`); imanta a bordes de clips,
  localizadores y grilla de compases. Indicador visual: `#snapline` (con clase
  `.free` cuando *no* hay snap, para evidenciar el estado bajo el cursor). ✅
- **Razor (corte)**: corta donde está el **mouse** (no en el playhead) y respeta
  el snap. ✅
- **Ruler adaptativo** (`drawRuler`): elige intervalos según el zoom (`pxPerSec`).
  *(Heurística exacta de selección de intervalos: ver `drawRuler`.)*
- **Timeline infinito**: `duration()` crece con el contenido y el scroll; no hay
  longitud fija.
- **Pistas redimensionables/colapsables (ronda 17)**: cada `lane` tiene `h` +
  `collapsed`; `laneH(li)` rige fila de clips y header (alineados). Chevron de
  colapsar + tirador de redimensionar en el borde inferior del header.
- **Crear/borrar tracks (ronda 17)**: `Ctrl+T` crea pista; **clic derecho** (área
  de pistas / columna de headers / header de pista) ofrece Crear/Renombrar/Duplicar/
  Eliminar. `Ctrl+R` = **renombrar** lo seleccionado (clip/pista/secuencia/marcador);
  `Ctrl+D` = duplicar. Ya **no** hay botones "+ Video/+ Audio".
- **Crossfade limpio (ronda 17)**: la disolvencia A→B mantiene A completo debajo y
  funde B encima (`aXf=1,bXf=f` en `compositeClips`), así el solape queda **opaco**
  sin caída de brillo ni doble exposición (antes ambos a opacidad reducida → bajón).
- **Calidad de previsualización (ronda 17)**: `previewQuality` ya **no** reduce el
  canvas de pantalla; reduce sólo la textura máster del composite (`setCompSize`),
  de modo que los clips bajan de resolución pero rejilla del domo y overlays siguen
  nítidos.
- **Múltiples secuencias** (estilo Premiere): pestañas `#seqBar` (abrir/crear/
  renombrar/borrar); cada secuencia guarda sus propios clips/lanes/markers/grupos.
  ✅
- **Nests**: agrupar selección → un clip compuesto con su propio subtimeline,
  renderizado a un FBO propio (recursivo, prof. ≤4), editable y keyframeable. ✅

---

## 11. Curvas / keyframes

- **Modelo**: ver §5 — `clip.kf[prop] = [{t,v,ease,hOut?,hIn?}]`.
- **Interpolación** (`easeF`, `app.js:191`):
  ```js
  function easeF(f,m){switch(m){
    case'in':return f*f; case'out':return 1-(1-f)*(1-f);
    case'both':return f<.5?2*f*f:1-Math.pow(-2*f+2,2)/2;
    case'hold':return 0; default:return f; }}   // default = lineal
  ```
  Más **bézier libre** con manejadores `hOut/hIn` y resolución cúbica (`bezSegY`).
- **Evaluación por frame**: `evalP(c,p,t)` (`app.js:202`) es la **única fuente de
  verdad** del valor de una propiedad en un tiempo dado. ✅ **El inspector y el
  editor de curvas comparten la misma envolvente**: ambos leen con `evalP` y
  escriben con `setKf` (`app.js:209`); no hay dos motores de animación distintos.
- **Edición de curvas (ronda 17): automatización INLINE por pista** (estilo
  Ableton). El botón "Curves" ya **no** abre un drawer: alterna `state.inlineCurves`
  y muestra **sub-pistas** de automatización bajo el clip, una por parámetro. El
  cronómetro (stopwatch) del inspector abre la sub-pista de ese parámetro
  (`openAuto`/`appendAutoLanes`/`drawAutoCurve`/`bindAutoCurve`); se pueden abrir
  varias a la vez, cada una editable (doble-clic añade/quita punto, arrastre, bézier)
  — leyendo/escribiendo con `evalP`/`setKf` (sin segundo motor). El canvas vive
  dentro de `#tracks`, así que hace scroll horizontal con los clips. El drawer y
  `drawCurveGraph` antiguos quedan en el código pero sin uso (`state.graphOpen`
  siempre false).
- **Re-enable automation** ([21]): `evalP` respeta un bypass por-parámetro
  `clip._autoOff`; el header de la sub-pista tiene un toggle "A" (anular) y un "↻"
  (reactivar la curva).

---

## 12. Herramientas y comandos (estado real)

| Herramienta / atajo | Estado |
|---|---|
| Select / mover clips | ✅ |
| Razor (C) — corta en el mouse + snap | ✅ |
| Borrar (Supr/Backspace) | ✅ |
| Snap (S) + indicador `#snapline` | ✅ |
| Play/Pause (Espacio), ir a inicio/fin (Home/End) | ✅ |
| Nudge de clip (Alt+flechas) | ✅ |
| Zoom de timeline (+/−) | ✅ |
| Zoom/pan en viewport (scroll/arrastre) | ✅ |
| Scroll = dolly + FOV independiente (visor 3D) | ✅ (ronda 16) |
| Curvas / keyframes (editor) | ✅ |
| Nest (anidar selección) | ✅ |
| Secuencias múltiples (pestañas) | ✅ |
| Localizadores/markers (L, `,` `.`) | ✅ |
| Paleta de comandos (⌘K/Ctrl+K) | ✅ |
| Ayuda (F1/?) → abre paleta | ✅ |
| Blend por clip (add/screen/multiply/darken/lighten) | ✅ |
| Botones de toolbar Split/Delete | ❌ eliminados a propósito (solo tecla/paleta/clic-derecho) |
| Buscador de medios | ❌ eliminado a propósito |

*(Estados según el wiring real de `onclick`/`keydown` y verificación en vivo de
esta serie de sesiones.)*

---

## 13. Persistencia

- **Formato de proyecto**: JSON, extensión **`.rdome`**. `serProject()` (v3,
  `app.js:1239`) emite `media` (sin `el/tex/buffer` vivos), `sequences`
  (vía `serSeq`→`serClip`) y `activeSeqId`, entre otros.
- **Guardar**: `saveProject(saveAs)` (`app.js:1240`) — Electron usa
  `DSP.saveDialog` + `DSP.writeText`; en browser descarga el blob. Incremental:
  `saveIncremental` → `nombre_vNN.rdome`.
- **Cargar**: `loadProject(obj)` (`app.js:1257`) reconstruye medios con
  `missing:true` y `proxyReady:false` → se **re-enlazan** (Electron re-lee por
  `m.path`) y los **proxies se regeneran**; el audio se vuelve a `fetch` + decode.
  Proyectos viejos de una sola línea se envuelven como "Sequence 1" (back-compat).
- **Autosave**: a `localStorage` (clave `domeProPro`); restaurable desde la paleta
  ("Restore last autosave", `restoreAutosave` `app.js:1292`) + guarda de
  `beforeunload` si hay cambios sin guardar. ⚠️ El *trigger* exacto de escritura
  del autosave (intervalo/eventos) está **sin verificar** en esta inspección (sí
  está confirmada la lectura/restore).
- **Relink**: en Electron, medios ausentes se reabren por ruta; en web no hay
  acceso a ruta → quedan `missing` y se re-importan a mano.

---

## 14. Rendimiento

- **Composite fijo a 2048²** (`COMP=2048`) por frame: cada frame recompone todas
  las capas activas a un FBO de 2048² y luego lo muestra. Es el coste dominante.
- **`gl.readPixels`** se usa en scopes y en export (lectura GPU→CPU): es un
  cuello de botella conocido si se abusa.
- **Proxies en main thread** (§8): jank al importar lotes grandes ⚠️.
- **Cuántas capas/clips aguanta fluido**: **sin verificar** — no hay benchmark
  formal. El diseño (composite único + texturas por clip) escala razonable para
  decenas de clips; no hay cifras medidas que reportar honestamente.
- **Resolución de export**: MP4 H.264 cuadrado topa ≈3072²–4096² (límite de
  nivel); por encima, **usar secuencia PNG** (que no tiene ese tope).

---

## 15. Bugs conocidos, ausencias y deuda técnica (honesto)

- ⚠️ **Proxies sin Worker**: corren en el hilo de UI; jank en imports grandes.
  (Endurecimiento recomendado pendiente: mover el encode a un Worker + persistir el
  proxy a disco; **diferido a propósito** en la ronda 17 por riesgo de regresión.)
- ✅ **Fuentes self-hosted** (ronda 17): Inter + JetBrains Mono (woff2 variable,
  subconjunto latin) viven en `assets/fonts/` con `@font-face` local; ya **no** hay
  dependencia de Google Fonts por CDN, así que el `.exe` funciona sin red.
- 🟡 **MP4 limitado**: H.264 8-bit, cuadrado, fondo negro, sin alfa ni 10-bit
  (alfa/lossless solo por PNG).
- 🐞 **Undo de medios sin clips**: NO se "arregló" a propósito — el fix propuesto
  resucitaba medios borrados en undos no relacionados (peor que la limitación).
- ❌ **SPOUT / NDI** (salida en vivo a otros programas): no implementado (requiere
  módulo nativo).
- ❌ **Slice por proyector + edge-blending** (multi-proyector real): no
  implementado (requiere geometría del recinto).
- ❌ **Bridge a Higgsfield MCP** dentro de la app: no implementado.
- ❌ **Tests automatizados / CI**: no existen; toda la verificación es manual.
- 🟡 **Un solo `app.js` de 1652 líneas** sin módulos: deuda de mantenibilidad.

No se encontraron marcadores `TODO`/`FIXME`/`stub`/`placeholder` en `app.js`: las
ausencias de arriba son features **no escritas**, no esqueletos a medio hacer.

---

## 16. Flujo de datos (import → timeline → render → export)

1. **Import**: arrastrar/elegir archivo → `importFiles` crea un *media item*
   (`el`/`originalEl`/`tex`), detecta fps (vídeo) y **encola un proxy**
   (`enqProxy`) si hay WebCodecs.
2. **Colocar en timeline**: `makeClip(m, lane, start, …)` crea un *clip* que
   referencia el media por `mediaId`, con `props` (transform/grade) y `kf`.
3. **Edición**: timeline (mover/trim/razor/snap/keyframes/nests/secuencias);
   todo muta `state` y dispara re-render del DOM + GL.
4. **Render (cada frame)**: `render()` → `prepNests` → `composite(playhead, 2048,
   false)` pinta clips activos al FBO máster (warp gnomónico→fisheye + grade) →
   se muestra en 2D (blit) o 3D (malla de domo + cámara). El preview usa **proxy**.
5. **Export**: `runExport` recorre los frames del rango de *work-area*; por frame
   hace `seekExport` (busca los **originales**) → `composite(t, res, true)` →
   o bien codifica H.264/AAC con WebCodecs+mp4-muxer (MP4), o bien escribe PNG
   (a disco en Electron / a ZIP en browser) + `audio.wav`. Cola secuencial.

---

## 17. Desviaciones respecto al manual de diseño (`PLAN.md`)

`PLAN.md` es el *roadmap/changelog* ("debería ser"). Diferencias reales notables:

- **Export por defecto**: el código entrega **PNG con alfa** como opción por
  defecto y MP4 como secundario; cualquier expectativa de "MP4 como salida
  principal de alta calidad" no aplica (H.264 8-bit es el techo).
- **Proxies**: el plan habla de proxies; la realidad es que son **en memoria, en
  main thread y se regeneran al reabrir** (no persistidos).
- **Color management / dither de salida**: marcado en `PLAN.md` como diferido a
  propósito; **no** hay pipeline de gestión de color de salida más allá del
  dither anti-banding en el shader.
- En general, `PLAN.md` describe capacidades que **sí** existen, pero su tono es
  de "feature completa"; este documento acota los **límites reales** (MP4,
  proxies, rendimiento sin medir, dependencia de CDN, ausencia de tests).

---

### Resumen para quien revise

Producto **funcional y usable** como editor fulldome: render WebGL2 correcto,
timeline completo (clips/keyframes/nests/secuencias), export a PNG-alfa (sólido) y
MP4 H.264 (limitado). Los **riesgos reales** a mirar primero: proxies en el hilo
de UI, dependencia de Google Fonts por CDN en el `.exe`, ausencia de tests
automatizados, y el techo de calidad del MP4 (8-bit/sin alfa). Lo marcado **sin
verificar** merece una segunda pasada con el código a la vista.
