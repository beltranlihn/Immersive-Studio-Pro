# Immersive Studio Pro — contrato del proyecto (leer siempre)

Editor de vídeo **inmersivo** (Domo fulldome 180° · 2D · Sala 360) de Alma Digital Studio (director creativo: Beltrán; developer: Claude). App de escritorio Electron, **sin build step**: `index.html` carga `mp4-muxer.min.js` y `app.js` con `<script>`. Un único `app.js` (~4700 líneas: motor WebGL2 + timeline + export WebCodecs) corre en el *renderer*; `main.js` (Electron main) sólo da diálogos nativos + disco vía `preload.js` (puente `DSP`, `IS_ELEC`).

## Convenciones (obligatorias)
- **Idioma:** en el chat y en el software, **castellano neutro — PROHIBIDO el voseo/argentinismos**. La **UI del software va en inglés** (con `T('EN','ES')` para strings nuevos); botones en **infinitivo**.
- **Higgsfield / billing:** NUNCA ejecutar compras, top-ups ni checkouts; sólo consultar saldo/costes.
- **Acciones destructivas** (borrar/mover archivos del usuario, reinstalar): confirmar o dejar backup, salvo que el usuario lo pida explícito.

## Comandos
- **Compilar el .exe:** `npm run dist` (electron-builder → `dist/win-unpacked/…` + instalador NSIS + portable). `npm start` = dev.
- **Syntax check rápido:** `node --check app.js && node --check main.js`.
- **Verificar en el .exe real (CDP):** lanzar `npx electron . --remote-debugging-port=9222` y evaluar por WebSocket (`Runtime.evaluate`) — patrón en `scratchpad/*.js`. Reléer `<system-reminder>` de rutas; matar todas las instancias antes de relanzar (single-instance re-enfoca la ventana vieja).

## Deploy (tras `npm run dist`, copiar `dist/win-unpacked/resources/app.asar` a las 3 instalaciones)
1. `C:\Users\beltr\AppData\Local\Programs\Immersive Studio Pro\resources\app.asar`  ← **canónica** (asociación `.isp`, acceso directo)
2. `C:\Users\beltr\AppData\Local\Programs\dome studio pro\resources\app.asar`  ← legacy
3. `C:\Program Files\Dome Studio Pro\resources\app.asar`  ← legacy (requiere elevación: `Start-Process powershell -Verb RunAs`)
- Matar TODAS las instancias antes de copiar. Reinstalar del todo = `dist\Immersive Studio Pro Setup 1.0.0.exe /S` (silent, per-user).
- La asociación de doble-clic `.isp` la registra el instalador NSIS (no el asar) → sólo se actualiza reinstalando.

## Datos clave
- **Extensión de proyecto:** `.isp` (guarda `.isp`; abre `.isp`/`.ise`/`.rdome` legacy). Es JSON.
- **Nombre/appId:** "Immersive Studio Pro" / `com.almadigitalstudio.immersivestudiopro`.
- **Sin deps npm de runtime** (mp4-muxer es archivo local; NDI = addon nativo propio en `native/ndi-send`, dep `file:`).
- **Proxys MANUALES** (clic-derecho media → Generar proxy; multi-selección con shift). Ya no son automáticos.

## Arquitectura en 12 líneas
- Estado global mutable `state`; el "binding" es manual: tras mutar se llama `render()` (GL) + `renderTimeline/renderInspector/renderMedia` (DOM). Frágil ante olvidos de re-render.
- **Composite máster** a un FBO (`COMP=2048²` domo; flat/room = W×H). `render()` bifurca por `state.view.mode` + modo de secuencia.
- **Secuencias = media `kind:'nest'`** (pestañas estilo Premiere). `state.seqMode` ∈ `dome|flat|room`. `isFlat()` incluye `room` (compositing rectangular); `isRoom()` para la sala.
- **Domo:** fisheye azimutal-equidistante; cada clip por az/el/size, deformado en GPU (programa `PW`/warp). **Flat/2D:** rectángulos x/y/scale (`drawClipFlat`, `flatPlace`).
- **Sala 360 (`room`):** muros "desenrollados" en una **tira flat** por PÍXELES (`stripW=Σ pxW`); los cm son geometría sólo-3D. Piso = **secuencia flat aparte** (`room.floorSeqId`). Visor 3D `renderRoom3D` (programa `PR`, quads texturizados; muros muestrean su sub-rect de la tira, piso de `compositeFloorTex`); cámara Orbit + Viewer/stand (`state.view.three`). Export completa/por-muro (`opt.wall`) + piso (`opt.seqId`).
- **Export/proxies:** WebCodecs (`VideoEncoder`/`AudioEncoder`) + `mp4-muxer`. Sin FFmpeg → sólo códecs de Chromium (H.264 topa ~4096² cuadrado en esta GPU → 4K usa PNG-seq o HEVC).

## Gotchas (no repetir errores)
- **Handedness 2D↔3D:** UNA inversión intencional (`u_flipx=-1` en el domo). NO "arreglar" cameraMVP/malla → duplica la inversión.
- **GPU híbrida (.exe):** NO usar flags Chromium agresivos → ponen el 3D negro. `main.js` fuerza la RTX por registro.
- **Electron NO soporta `prompt/alert/confirm`** → usar `appPrompt/appAlert/appConfirm`.
- **`hasKf()` devuelve `undefined`** (no `false`) → `classList.toggle(x, !!hasKf(...))` (WebIDL invierte con `undefined`).
- **Tras editar código hay que `npm run dist`** para que el `.exe` empaquetado tome los cambios (el asar es lo que corre).
- **Addon NDI:** `node_modules/dsp-ndi-send` es COPIA de `native/ndi-send` → editar el `.cc` requiere re-copiar antes de `npm run dist`.

## Docs del repo
- **`PLAN.md`** = bitácora / changelog por rondas (ROUND …, lo más nuevo arriba). Se le agrega una entrada por sesión.
- **`_backup/`** = archivos archivados (logo viejo, ENFOQUE-TECNICO histórico).
- El detalle profundo y multi-sesión también vive en la **memoria de Claude** (se carga sola cada sesión).
