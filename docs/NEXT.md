# NEXT — Cola de trabajo activa

> Tareas ordenadas de **más rápido de resolver → más complejo**. Marcá `[x]` a medida que se cierran (y actualizá la fila
> en `COMPONENTS.md` + una entrada en `PLAN.md` en el mismo commit, como manda el ritual de `/commit`).
> Códigos = tickets de `CORRECCIONES-V2.md`. Ubicaciones = `COMPONENTS.md`. Última revisión: 2026-07-23.

## 📋 Tanda de Beltrán — 2026-07-27 · EN CURSO
> Orden: primero lo independiente y barato, luego el landing **de una sola pasada** (son 8 puntos del mismo sitio),
> y al final lo conceptual. Las tandas 1-3 no dependen entre sí: se pueden reordenar sin coste.

**Ya hecho y desplegado en R190 — sólo falta que Beltrán lo pruebe:**
- [x] En rendering, Close = Cancel mientras renderiza · fuera el botón de restart. _(R190)_
- [x] La carpeta del export se abre sola al terminar. _(R190)_

### Tanda 1 · Editor: velocidad 🟢 — CERRADA _(R195)_
- [ ] ~~Ctrl+T / Ctrl+Shift+T para pistas nuevas~~ — **APLAZADO por Beltrán** (2026-07-27): «no hagamos lo del
      comando todavía». Sigue en pie que hoy Ctrl+T/D son contextuales (R93, automatización).
- [x] **Velocidad: `.field` como el resto de parámetros** — arrastre 50-200%, doble clic para escribir. _(R195)_
- [x] **Cambiar la velocidad estira o encoge el clip**, y su automatización viaja con él. _(R195)_
      Respuesta de Beltrán: la velocidad es POR CLIP, sólo afecta a ese clip, y la automatización se ajusta a la
      nueva extensión porque las automatizaciones también son por clip.
- [x] **La X de eliminar secuencia, más pequeña** (11 → 8,5 px; el área de clic se mantiene con el relleno). _(R195)_

### Tanda 2 · Transform de una composición 🟡 — CERRADA _(R196)_
- [x] **Rotación aplicable a un compose desde el Transform.** _(R196)_ La fila ya estaba; el camino `fulldome` no la
      leía. Ahora `rot` se suma al azimut — sumar y no sustituir mantiene intactos los proyectos que giraban con `az`.

### Tanda 3 · Landing — CERRADA _(R197 + R198)_ 🟢
- [x] Quitar el **botón de configuración**. _(R197)_
- [x] Quitar **Uniform** (así se gana espacio). _(R197)_ Los muros pasan a editarse **por separado**, que es lo que
      hace falta para que en la tanda 4 los ángulos salgan de las medidas de cada muro.
- [x] **Preset a la derecha** de la elección de muro, con **Guardar + desplegable**. _(R197)_ Los propios se guardan
      en el navegador (`ispRoomPresets`), no en el proyecto: son preferencia del equipo, no parte de la obra.
- [x] **Facing con desplegable** para elegir el muro. _(R197)_ Antes daba vueltas a un botón: con cinco
      orientaciones costaba hasta cuatro clics y no se veía cuáles había.
- [x] **Canvas igual que el 2D Flat**. _(R198)_ El lienzo cosido se dibuja por el camino **2D de la sala** del
      editor (marco, retícula, costuras, rótulos de muro), no por el painter `drawRoomStrip`.
- [x] **Domo: la línea de borde no sigue el ángulo del domo.** _(R198)_ Era el 3D del editor, no sólo el landing:
      `FS3` dibujaba el contorno a `90.0` cenitales fijos y el borde de la malla está en `cov/2` → nuevo uniforme
      `u_rimDeg`.
- [x] **Floor en las configuraciones**: pixelaje editable, medidas de sólo lectura. _(R198)_ Override en
      `_lch.floorPx`; las medidas salen siempre de la huella de la sala.
- [x] **360: visor 3D real** en vez del esquema de líneas gruesas. _(R198)_ `lchEditorShot` monta una secuencia de
      sala temporal (`lchRoomSeqTemp`) → `renderRoom3D` de verdad, arrastrable. La planta se queda en su panel.
- [x] **(no estaba en la lista) El botón «Create 360 Room project» estaba recortado** — con cuatro muros el panel
      no cabía y `overflow:hidden` se comía la acción: no se podía crear una sala desde el landing. _(R198)_
      `.lch-pbody` scrollea; salida máster y botón quedan fijos abajo.

### Tanda 4 · Geometría de la sala 360 — CERRADA _(R199)_ 🟢
> Aclarado por Beltrán (2026-07-28): **«no quiero fijarlo mano a mano»** — los ángulos salen de las medidas, no hay
> control para tocarlos. Esa decisión es la que define toda la tanda.
- [x] **4 muros = cuadrado, con los ángulos determinados por las medidas de cada muro · 3 muros = U · 2 muros = L.**
      _(R199)_ `roomPlan` reescrita: el grado de libertad del cuadrilátero se fija repartiendo la inclinación por
      igual entre los laterales (antes se promediaban sus anchos → sala siempre simétrica), y las formas dejan de
      depender de qué roles se elijan (antes 2 y 3 muros desde el launcher caían a un salvavidas a 120°).
      Extra: `plan.imposible` avisa cuando esas medidas no cierran ninguna sala.
- [x] **La PLANTA DEL LANDING se ajusta al visor**, cambiando de escala sin cortarse. _(R199)_ Se mide la caja de
      toda la tinta, rótulos incluidos, y se encoge hasta que entra. Control contra el `.exe` de R198: ahí se
      salía del lienzo con 2 y 3 muros.

### Tanda 5 · Fill dome 🔴
- [ ] **Opción «flat tile» en la configuración de Fill dome.** _(Aclarado por Beltrán: se coloca en el fill del domo
      pero **manteniendo su proporción real de deformación**. El efecto es como el del anillo, pero con anillos
      **repetidos hacia arriba y hacia abajo** al fondo.)_

## 🎨 Rediseño "Rev 1" — EN CURSO (spec: `REDISEÑO-UI.md` · decisión: ADR-0008)
- [x] Etapas **0-5**: tokens · componentes · shell · inspector (Source/Playback, sin Master Grade) · transport
      (secuencias en la barra del play, well Simple/Auto/Grid/Fit) · timeline (pistas unificadas, chips de
      automatización, V-zoom, fade en esquinas). _(R148)_
- [x] **Auditoría por CDP a 1920×1080** de las etapas 0-5 — informe en `AUDITORIA-REV1.md`. _(R149)_
- [x] **Arreglos de la auditoría** _(R149)_: alturas de barra (media/inspector/transport/status) y wells de edición y
      zoom a 22px · superficies por barra (sólo el transport en `#242424`) · Source y Playback con toggles `.iosw` ·
      Ctrl+F con campo real · hint de herramienta en el status · micro-metadata a 10px · título "Transform" ·
      tooltip de `Fit` · barra del visor sin saltos 2D↔3D. **Cuatro hallazgos eran falsos** (errores de la
      traducción `REDISEÑO-UI.md`, ya corregida): mandá siempre el `.dc.html`.
- [x] **Master Grade — CERRADO (R150).** Beltrán decidió sacarlo del código. Motor archivado en
      `_backup/deprecated/20260725-master-grade-engine.js` (la UI ya estaba, desde R148). Verificado por CDP: nada
      roto, el grado por clip intacto, y un `.isp` viejo con `grade` abre sin problema (se ignora).
- [x] **Pasada visual** — el supuesto de las capturas negras era falso: `Page.captureScreenshot` devuelve el WebGL renderizado con la ventana en segundo plano. Las capturas de `scratchpad/shots/` lo demuestran. _(R167)_
- [x] Tres checkboxes nativos fuera del sistema de toggles: `#bkToggle`, `#txtStroke` (Clip), `#motionPrev` (Motion). _(R166)_ — pasan al `.iosw` del diseño vía `ioswHtml`/`ioswBind`, un puente que expone `.checked` y emite `change`, así que los `onchange` que ya existían siguen valiendo sin tocarlos.
- [x] Verificar el **waveform de audio** con un archivo real _(R167)_ — `Umbral.wav` (35,6s · 44,1k · 24-bit). El pico dibujado (0,2489) coincide con el del archivo (0,2486), sin recortes, pico/RMS 1,81 (dinámica real), 180 BPM y 171 golpes detectados, espectro de 32 bandas variando en el tiempo y el medidor pintando el 69% de su lienzo.
- [x] **Etapa 6a · Splash de carga** — ventana propia de 1080² → editor en 16:9 _(R151)_. Handoff nuevo en
      `scratchpad/redesign/design_handoff_launcher_splash/` (`Loading Splash - Rev 1.dc.html` + README).
- [x] **Etapa 6b · Launcher (landing)** — hecho _(R153)_ con los **visores reales del editor** (`drawSeqViz`,
      `drawRoomIso`, `drawRoomStrip`) en vez de los SVGs del prototipo. Alto estable en los tres tipos y sin scroll,
      verificado. El segundo panel de Domo (domo 3D) se cerró en **R155** con `drawDomeIso` (pintor 2D propio, no WebGL) y responde al ángulo 180/200/210/220.
- [x] Etapa **7 · variantes por formato** (360 / 2D) del editor. _(R168)_ Método: en vez de auditar tres maquetas casi idénticas, `scratchpad/handoff-diff.mjs` aísla lo que VARÍA entre ellas (20 textos de 115). Resultado: el botón del máster se llama **Canvas** en 2D y sala (**2D** sólo en domo), el 3D no existe en 2D plano, y el tercer hueco de superposición cambia de FUNCIÓN — Horizon (domo) · **Center** (2D, guías nuevas) · **Seam** (sala, juntas de muro). Antes ese botón se ocultaba en 2D y en sala, dejando ambos formatos sin control.

## Arranque (wins rápidos) 🟢
- [x] **[T5] Mute visual** — pista silenciada → sus clips a opacidad **alta** (`.muted`, `.82`, sin trama → claramente
      visibles, no ocultos) + chapa de altavoz-mute (`.mutebadge`, signo de forma → daltonismo). `.off` (disabled) sigue
      siendo el estado fuerte y gana si el clip está deshabilitado. _(R138)_
- [x] **[R3] Secuencias reordenables** — `startSeqTabDrag` (pointerdown, umbral 5px, análogo horizontal de `startLaneDrag`):
      arrastrar una pestaña `#seqTabs` la reordena en `state.openSeqs` con línea-guía + chip flotante; el flag `_seqDragged`
      evita que el clic final además cambie de secuencia. El orden persiste (`serProject`). _(R138)_

## Media mañana (acotado, alto valor) 🟡
- [x] **[T3] Círculos de zoom en la barra de scroll** (estilo Premiere) — scrollbar custom `#tlZoomBar`: se ocultó la
      barra nativa (`overflow-x:hidden`) y se añadió un thumb (arrastrar cuerpo = scroll) con **cap circular en cada
      extremo** que al arrastrarlo hace zoom anclando el borde opuesto (`renderZoomBar`/`startZoomBarDrag`/`startZoomCapDrag`).
      Verificado por CDP: thumb dimensiona con el zoom, sigue el scroll, y el cap-drag ancla el borde opuesto. _(R138)_
- [x] **Grade en fulldome/equirect (gap PFD/PEQ) — CERRADO** — FSFD/FSEQ ahora aplican ruedas/curvas/LUT igual que FSW;
      las tres funciones `bindClipLUT/Grade/Curve` aceptan un struct de ubicaciones `L` (default `LW`) y las rutas PFD/PEQ
      llaman `bindClipLUT(c,LFD/LEQ)` (LUT unit 2, curva unit 3). Identidad por defecto → clips existentes sin cambio.
      Verificado: ambos shaders compilan+linkan en WebGL2. _(R138)_

## Tarde (medio) 🟡
- [x] **[T2] Trim micro-snap + más zoom** — el drag de trim ahora **cuantiza a frame** por defecto (`dt=round(dt·fps)/fps`)
      → el borde salta frame a frame (visible al acercar); **Shift** = sub-frame fino. Lectura muestra `s` y `f`. Zoom máximo
      subido 600→**2400 px/s** (`TL_PPS_MAX`) → ~40–80px por frame; la grilla adaptativa ya muestra líneas de frame ahí. _(R138)_
- [x] **[V1] Viewer-only sigue 2D/3D** — `renderViewer` ahora bifurca según el editor: domo 3D (con su cámara orbit
      propia) ↔ blit 2D limpio (rect flat aspect-fit / disco fisheye), vía `_vDome3D=(view.mode==='3d' && !_drawFlat && !_roomWrap)`.
      Room-3D cae a la tira flat (su forma 2D). _(R138)_

## Si queda energía (UI, rinde menos con cansancio) 🟠
- [x] **[T4] Rediseño de faders del 3D preview** — FOV/DOLLY/DIST (`.vfader`): sliders custom monocromos (surco `--s0`,
      relleno `--ink-2` por lightness vía `--pct`/`faderFill()`, thumb `--ink` con hover-scale + halo activo) que reemplazan
      el `accent-color` nativo. FOV muestra `°`. Verificado por introspección DOM (appearance:none, `--pct` correcto). _(R138, skill impeccable)_
- [x] **[X2] Layout de las tarjetas de FX reactivos** — el cuerpo de cada `fxCardHtml` se agrupa en secciones etiquetadas
      `.fxsec` (**Routing / Response / Parameters**) dentro de `.fxbody`, filas de selects en `.fxseg`; estilos movidos de
      inline a CSS. Se preservó todo el cableado (`.fxband/.fxmode/.fxinv/.fxshape/.fxdiv/.fxrow/…`). _(R138)_

---

## Para días siguientes (complejo / diferido)
- [x] **[X1] Rediseño del ecualizador** (Reactive FX) — **HECHO (R144).** El medidor `#arMeter` pasó de 4 barras planas
      (BASS/MID/TREB/BRT) a un **analizador de espectro real de 32 bandas log** alimentado por el FFT que ya construía el
      selector de frecuencias (`m.spec` vía nuevo `specColAt(t)`); barras con relleno-gradiente iluminado por energía, picos
      con caída lenta (peak-hold), regla de frecuencias 100/1k/10k, nítido a cualquier ancho/hi-dpi (backing DPR). Fallback
      elegante a las 4 bandas con etiquetas mientras el FFT se calcula. Verificado por CDP (ambos caminos). _(R144, skill impeccable)_
- [x] **Grade máster de secuencia** (idea propia) — **COMPLETO (R139/R140/R141).** Grado global sobre el composite final
      por post-pass `applyMasterGrade` (shader `_MG`): **numérico + ruedas lift/gamma/gain + LUT + curvas**, en
      preview/export/NDI/Spout, por-secuencia (persistido). Reusa toda la cadena de clip vía `bindClipLUT(_masterClip,_MGu)`
      (refactor `L` de R138). ⚠️ **UI ARCHIVADA en R148** (el diseño "Rev 1" no tiene Master Grade): el motor sigue vivo y
      los grados guardados en `.isp` se siguen aplicando, pero ya no hay forma de editarlos — ver `_backup/deprecated/master-grade-ui.js`.
      Verificado por CDP en cada fase.
- [x] **[D7] Onboarding** — **HECHO (R145).** Primera apertura (flag `dspOnboardV1` ausente) → salta el landing, arma un
      **proyecto-demo domo** con formas de referencia (título + elipse/rect/línea en pistas V1–V4, `buildDemoProject`) y
      lanza un **tour de coach-marks** (`startTour`): overlay con foco recortado (box-shadow) sobre visor→timeline→inspector→export,
      tarjeta con Atrás/Siguiente/Saltar, teclado (Esc/←/→/Enter). Omitible; al saltar/terminar fija el flag y no reaparece.
      Relanzable desde **Window → Guided tour** (no destructivo). Verificado por CDP (build, foco por objetivo, finish, relaunch). _(R145)_
- [x] **[V3] Spout In** — Spout como fuente en Media. _(R167)_ Receptor añadido al addon existente (`inList/inOpen/inFrame/inClose` sobre la misma `SpoutDX` vendorizada, instancia aparte de la del emisor). Verificado contra el `TDSyphonSpoutOut` real de Beltrán.
- [x] **[R1] Render in-site flexible** — nuevo `renderRangeInPlace()`: hornea el **composite completo** sobre la
      selección de tiempo `[selA,selB]` (o In/Out) → un clip en una **pista nueva arriba** que la cubre (aplana). No
      destructivo (las fuentes quedan debajo; ⌘Z). Ítem "Renderizar la selección en el sitio…" en el menú de clip cuando
      hay selección de rango. Reusa la maquinaria de `renderInPlace` (runExport `rangeT` sin `isolateClips`). _(R142)_
- [x] Barrido de deuda técnica #2 — **HECHO (R143).** Mapeado por arch-explorer: el render de sub-carriles apilados
      (`appendAutoLanes`) ya estaba neutralizado por `[A5]` (`return;`) → `lane._auto`/`lane._autoH` + `addAutoLane(At)` +
      `laneAutoH` y la lista legacy de clip `c._auto` (`closeAuto`, copia en `sepAuto`, `returnToDefault`, filtro fx) eran
      **código muerto**. Archivados en `_backup/deprecated/20260723-…` y quitados. El modelo vigente `lane._autoP`
      (una superposición por pista) queda intacto. Verificado por CDP.

## Pendientes reales (construibles y verificables por Claude)
- [x] **[I2·Motion]** — **HECHO (R146).** Los efectos de `c.fx` se muestran también en la sección **Motion** del inspector
      como **no-reactivos**: cada tarjeta trae solo **Intensity + sus parámetros** (sin ruteo de banda/modo), todos
      automatizables (diamante ◆ por fila + indicador ◆ en la cabecera), con **"Add Effect"**. Mismo `c.fx` compartido con
      la pestaña Reactive (que sigue siendo donde corren *live al audio*). `fxCardHtml(c,f,reactive)` + wiring generalizado
      `wireFxCards(c,sel,reRender)` + `fxDragHandle(…,sel,reRender)`; añadir desde Motion → efecto **estático** (`int=100`,
      `band='none'`). Verificado por CDP (tarjeta sin banda, param con kf, se comparte con Reactive, regresión del panel
      Reactive intacta: add reactivo sigue `int=0/band=bass`). _(R146)_
- [x] **[F7 fase 2]** — equirect en el **visor 3D** (esfera completa) + **auto-detección 2:1** al importar. _(R169)_ Y por el camino apareció que la fase 1 mostraba los panoramas **del revés** (el suelo sobre la cabeza): signo equivocado en la v de `FSEQ` frente al `UNPACK_FLIP_Y_WEBGL=true` de `upTex`.
- [ ] **[D2]** — cola/encoder de export en **segundo plano** con **snapshot congelado** del proyecto al enviar (seguir
      editando/borrando mientras exporta; encolar varios con progreso). **Grande** pero JS + verificable. (Beltrán lo tenía
      "para el final"; sigue en pie, es el de mayor esfuerzo.)

## Necesitan el entorno de Beltrán para cerrarse
- [x] **[V3] Spout In** — CERRADO en R167 con el emisor real de Beltrán encendido.

## En pausa por Beltrán (no tocar hasta aviso)
- **[P1] Mac + [D5] instalador cerrado** — hasta que Beltrán lo pida.
- **[D4] Grilla 3D infinita** — RETIRADA de la cola: idea que Beltrán quiere **reestructurar** antes de encararla (fase 2).
      Solo queda la nota de diseño (dejar el mapeo de salida como capa "output target" intercambiable cuando se toque el motor).

---

## Ya cerrado (referencia)
Grado de color completo (LUT + ruedas + curvas), fix bordes automatización, splash 1080², menús File/Edit/Window,
Etapas 0-5 + 9, sistema de documentación (COMPONENTS/ARCHITECTURE/ADR), limpieza automatización legacy (R137/R137b).
Detalle en `PLAN.md`. [F2] auditado sin descuadre · [U3] toggle grilla ya existe · [C2]/[C3] cubiertos.
