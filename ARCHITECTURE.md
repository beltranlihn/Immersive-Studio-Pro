# ARCHITECTURE — Immersive Studio Pro

> **Tipo (Diátaxis): Explicación.** Este archivo cuenta *cómo* y *por qué* funciona el software. El índice austero de
> "dónde vive cada cosa" está en [COMPONENTS.md](COMPONENTS.md); las decisiones puntuales en [docs/adr/](docs/adr/); la
> bitácora por ronda en [PLAN.md](PLAN.md). Estructura basada en **C4** (niveles de zoom) + **arc42** (secciones).
> Verificado contra el código: 2026-07-22.

---

## 1 · Propósito y metas de calidad (arc42 §1)

Editor de vídeo **inmersivo** (fulldome 180-220° · 2D · sala 360°) de Alma Digital Studio. App de escritorio de un solo
desarrollador (director creativo: Beltrán; developer: Claude). Metas de calidad, en orden:

1. **Estabilidad de GPU** en GPUs híbridas (la RTX se fuerza por registro; nada de flags Chromium agresivos).
2. **Scrubbing y playback en tiempo real** con varias capas (motor de decode + cache de frames + render-ahead).
3. **Fidelidad de export** sin FFmpeg en runtime (solo códecs de Chromium + HAP propio).

## 2 · Restricciones (arc42 §2)

- **Sin build step:** `index.html` carga `mp4-muxer.min.js` y `app.js` con `<script>`. No hay bundler, no hay transpilación.
- **Sin FFmpeg en runtime** → solo códecs de Chromium (H.264 topa ~4096² cuadrado en esta GPU → 4K usa PNG-seq o HEVC).
- **GPU híbrida:** NO usar flags Chromium agresivos (ponen el 3D negro). `main.js` fuerza la RTX por registro.
- **Electron sin `prompt/alert/confirm`** → usar `appPrompt`/`appAlert`/`appConfirm`.
- **Idioma:** UI del software en **inglés** (con `T('EN','ES')`); chat/comentarios en **castellano neutro** (sin voseo).

## 3 · Contexto del sistema (C4 L1 / arc42 §3)

```
Usuario (Beltrán) ── usa ──▶ Immersive Studio Pro
App ── lee/escribe ──▶ Filesystem (.isp proyectos · media · proxies)
App ── emite ──▶ NDI / Spout (receptores en red / GPU local: Resolume, TouchDesigner, OBS)
App ── exporta ──▶ MP4 / MOV(HAP) / PNG-seq
App ── verificada-por ──▶ FFmpeg (juez externo, NO dependencia de runtime)
```

## 4 · Contenedores (C4 L2 / arc42 §5)

| Contenedor | Archivo | Responsabilidad |
|---|---|---|
| **Electron main** | `main.js` | Ventana, diálogos nativos, disco, forzado de RTX por registro, asociación de archivos, single-instance |
| **Preload bridge** | `preload.js` | API `DSP` + flag `IS_ELEC` (puente seguro renderer↔main); NDI/Spout wrappers |
| **Renderer** | `app.js` + `index.html` | **Todo lo demás**: motor WebGL2 + timeline + inspector + export + color + sala/360 |
| **Addons nativos** | `native/ndi-send`, `native/spout-send` | Salida NDI / Spout (dep `file:`; el `.node` va en `app.asar.unpacked`) |

El grueso del sistema vive en el **renderer** (`app.js`, ~5000+ líneas). Como no tiene módulos ni carpetas, **COMPONENTS.md
es su "estructura de carpetas"**.

## 5 · Componentes del renderer (C4 L3)

Ver [COMPONENTS.md](COMPONENTS.md) para el inventario autoritativo. Mapa de subsistemas:

1. **Motor GL & shaders** — contexto WebGL2, programas PW (warp/fisheye+flat), PB (blit), PFD (fulldome), PEQ (equirect), P3 (malla 3D), PR (sala 3D).
2. **Render, compositor & modos** — `render()` bifurca por `state.view.mode` + modo de secuencia; composite a un FBO máster.
3. **Timeline, herramientas & clips/lanes** — `renderTimeline()`, 6 herramientas, clips, lanes de vídeo/audio, transporte.
4. **Automatización, keyframes & modulación** — modelo After Effects (`evalP`/`setKf`/`manualEdit`), overlay por pista, modulación.
5. **Export, proxies & decode** — WebCodecs + mp4-muxer + HAP; proxies all-intra; ClipDecoder; frame cache.
6. **Grado de color & Inspector** — LUT 3D + ruedas Lift/Gamma/Gain + curvas; inspector de 4 secciones; máscaras pen-tool.
7. **Sala/360, Compose/Nest & formatos** — muros desenrollados + piso + visor 3D; compose generativo; diálogos de creación.
8. **Shell, media & UI chrome** — main/preload/DSP + addons; panel de media; I/O de proyecto; landing/splash/menús/paneles.

## 6 · Flujos de runtime clave (arc42 §6 / C4 dinámico)

### El pipeline de un frame
1. Algo muta `state`.
2. **El que muta llama manualmente** a `render()` (GL) + `renderTimeline`/`renderInspector`/`renderMedia` (DOM).
   No hay binding reactivo: **olvidar un re-render es la clase de bug #1** (ver §8).
3. `render()` bifurca por `state.view.mode` ('2d'/'3d') y el modo de secuencia (`state.seqMode` ∈ `dome|flat|room`).
4. Cada clip se compone en un FBO máster:
   - **Domo:** `COMP = 2048²` fisheye azimutal-equidistante; cada clip colocado por az/el/size y deformado en GPU (programa `PW`).
   - **Flat / sala:** rectángulos W×H (`drawClipFlat` / `flatPlace`).
5. El composite se presenta (blit `PB` aspect-correcto para 2D; `renderRoom3D` para la sala; `P3` para preview 3D del domo).
6. La cobertura de domo (`state.seqCov`) acopla CUATRO puntos: warp `u_covHalf`, inverso `f2azel`/`azel2f`, guías 2D, malla 3D.
7. Con playback pesado, el **render-ahead** (`_raOn`, off por defecto) cachea el composite plano por frame y lo re-blitea.

### El grado de color por clip (dentro de FSW/PW)
Orden en el fragment shader: exposure → contrast → saturation → temp/tint → **lift/gamma/gain** → glow → clamp →
**curvas** → **LUT**. `bindClipGrade`/`bindClipCurve` se llaman dentro de `bindClipLUT` (cubre las rutas flat y domo).
**Gap conocido:** las rutas PFD (fulldome) y PEQ (equirect) NO llaman esa cadena → esos clips no reciben grado.

### Un export
`runExport()` maneja PNG-seq / MP4(H.264/HEVC) / HAP / still. Empuja frames a WebCodecs `VideoEncoder`/`AudioEncoder`
→ `mp4-muxer`. Sin FFmpeg → límites de códec de Chromium (ver ADR-0002). Opciones: `rangeT` (in/out), `isolateClips`
(render-in-place), `opt.wall`/`opt.seqId` (export por-muro/piso de la sala).

## 7 · Conceptos transversales (arc42 §8)

- **Binding manual `state → render()`.** No hay reactividad. Tras mutar `state`, hay que llamar al re-render que corresponda.
  Frágil ante olvidos. Es el patrón central del renderer.
- **Handedness 2D↔3D.** UNA inversión intencional (`u_flipx = -1` en la ruta del domo). **NO** "arreglar" cameraMVP/malla
  → duplica la inversión. Ver ADR-0004.
- **i18n.** `T('EN','ES')`; UI en inglés, botones en infinitivo; `applyLang` reetiqueta por idioma (ojo: los `tn()` que ponen
  `textContent` borran iconos → para botones icon-only quitar el `tn`).
- **`hasKf()` devuelve `undefined`** (no `false`) → usar `!!hasKf(...)` con `classList.toggle`.
- **Secuencias = media `kind:'nest'`** (pestañas estilo Premiere). Los compose son nests generados por parámetros (`m.comp`).

## 8 · Decisiones (arc42 §9)

Registradas en [docs/adr/](docs/adr/). Las grandes: sin build step (ADR-0001), sin FFmpeg/límite de códec (ADR-0002),
proxies manuales (ADR-0003), inversión de handedness (ADR-0004), extensión `.isp` (ADR-0005), modelo de automatización
After Effects (ADR-0006).

## 9 · Riesgos y deuda técnica (arc42 §11)

- **`app.js` monolítico** (~5000+ líneas, sin módulos) + **binding manual de re-render** → mantenibilidad frágil.
- **GPU de desarrollo ≠ RTX del `.exe`** → renders grandes se caen en dev pero andan en el `.exe`. Verificar en el `.exe`.
- **Undo por snapshot JSON del estado completo** → costoso en memoria/latencia con proyectos pesados.
- **Automatización legacy vestigial** (`_autoOff`, perform-and-bake) que [A2]/[D1] mandan quitar (ver COMPONENTS.md → Deuda técnica).
- **Grado de color no llega a PFD/PEQ** (fuentes fulldome/equirect).
- Detalle completo de gaps: sección "Deuda técnica & gaps" de [COMPONENTS.md](COMPONENTS.md).

## 10 · Glosario (arc42 §12)

- **Domo / fulldome** — proyección hemisférica 180-220°.
- **Fisheye azimutal-equidistante** — mapeo disco↔esfera del domo (`rho = zenith / covHalf`).
- **Warp** — deformación GPU de un clip a su parche az/el/size (programa `PW`).
- **Nest** — secuencia (media `kind:'nest'`); pestaña estilo Premiere.
- **Compose** — nest generado por parámetros (anillo/grilla/random/Dome Fill).
- **Tira (strip)** — muros de la sala 360 "desenrollados" lado a lado por píxeles (`stripW = Σ pxW`).
- **COMP** — FBO composite máster (2048² en domo).
- **Proxy** — versión all-intra ligera de un vídeo para scrub fluido.
- **Cobertura (`seqCov`)** — FOV del fisheye del domo (180/200/210/220°).
- **`.isp`** — extensión de proyecto (JSON).
