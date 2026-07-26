# NEXT — Cola de trabajo activa

> Tareas ordenadas de **más rápido de resolver → más complejo**. Marcá `[x]` a medida que se cierran (y actualizá la fila
> en `COMPONENTS.md` + una entrada en `PLAN.md` en el mismo commit, como manda el ritual de `/commit`).
> Códigos = tickets de `CORRECCIONES-V2.md`. Ubicaciones = `COMPONENTS.md`. Última revisión: 2026-07-23.

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
- [ ] **Pasada visual** con la ventana al frente (las capturas de píxel salen negras en segundo plano).
- [x] Tres checkboxes nativos fuera del sistema de toggles: `#bkToggle`, `#txtStroke` (Clip), `#motionPrev` (Motion). _(R166)_ — pasan al `.iosw` del diseño vía `ioswHtml`/`ioswBind`, un puente que expone `.checked` y emite `change`, así que los `onchange` que ya existían siguen valiendo sin tocarlos.
- [ ] Verificar el **waveform de audio** con un archivo real (el clip de prueba era sintético).
- [x] **Etapa 6a · Splash de carga** — ventana propia de 1080² → editor en 16:9 _(R151)_. Handoff nuevo en
      `scratchpad/redesign/design_handoff_launcher_splash/` (`Loading Splash - Rev 1.dc.html` + README).
- [x] **Etapa 6b · Launcher (landing)** — hecho _(R153)_ con los **visores reales del editor** (`drawSeqViz`,
      `drawRoomIso`, `drawRoomStrip`) en vez de los SVGs del prototipo. Alto estable en los tres tipos y sin scroll,
      verificado. **Falta:** el segundo panel de Domo (domo 3D) — es WebGL sobre `#gl` y extraerlo no es directo.
- [ ] Etapa **7 · variantes por formato** (360 / 2D) del editor.

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
- [ ] **[V3] Spout In** — Spout como fuente en Media (addon nativo grande, solo Windows).
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
- [ ] **[F7 fase 2]** — equirect en el **visor 3D** (esfera completa) + **auto-detección 2:1** al importar. La fase 1
      (warp equirect→domo en el composite 2D, shader `PEQ`) ya está (R126). GL, verificable.
- [ ] **[D2]** — cola/encoder de export en **segundo plano** con **snapshot congelado** del proyecto al enviar (seguir
      editando/borrando mientras exporta; encolar varios con progreso). **Grande** pero JS + verificable. (Beltrán lo tenía
      "para el final"; sigue en pie, es el de mayor esfuerzo.)

## Necesitan el entorno de Beltrán para cerrarse
- [ ] **[V3] Spout In** — Spout como fuente en Media (addon nativo, solo Windows). Requiere rebuild del `.node` + un
      **emisor Spout real** para validar; Claude puede escribir todo pero no verificarlo solo.

## En pausa por Beltrán (no tocar hasta aviso)
- **[P1] Mac + [D5] instalador cerrado** — hasta que Beltrán lo pida.
- **[D4] Grilla 3D infinita** — RETIRADA de la cola: idea que Beltrán quiere **reestructurar** antes de encararla (fase 2).
      Solo queda la nota de diseño (dejar el mapeo de salida como capa "output target" intercambiable cuando se toque el motor).

---

## Ya cerrado (referencia)
Grado de color completo (LUT + ruedas + curvas), fix bordes automatización, splash 1080², menús File/Edit/Window,
Etapas 0-5 + 9, sistema de documentación (COMPONENTS/ARCHITECTURE/ADR), limpieza automatización legacy (R137/R137b).
Detalle en `PLAN.md`. [F2] auditado sin descuadre · [U3] toggle grilla ya existe · [C2]/[C3] cubiertos.
