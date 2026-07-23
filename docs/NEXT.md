# NEXT — Cola de trabajo activa

> Tareas ordenadas de **más rápido de resolver → más complejo**. Marcá `[x]` a medida que se cierran (y actualizá la fila
> en `COMPONENTS.md` + una entrada en `PLAN.md` en el mismo commit, como manda el ritual de `/commit`).
> Códigos = tickets de `CORRECCIONES-V2.md`. Ubicaciones = `COMPONENTS.md`. Última revisión: 2026-07-23.

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
- [ ] **[X1] Rediseño del ecualizador** (Reactive FX) — audio-reactivo, mejor diseño.
- [~] **Grade máster de secuencia** (idea propia) — **Fase 1 (R139) + Fase 2a (R140) HECHAS:** grado global sobre el
      composite final por post-pass `applyMasterGrade` (shader `_MG`). Fase 1 = numérico + preview/export. **Fase 2a =**
      ruedas lift/gamma/gain + **LUT máster** (reusa toda la cadena de clip vía `bindClipLUT(_masterClip,_MGu)`, gracias al
      refactor `L` de R138) + cobertura **NDI/Spout**. UI en la sección **Master Grade** del inspector. Verificado por CDP.
      **Fase 2b pendiente:** editor de **curvas** máster (el motor ya lo soporta vía `hasCurve`, falta la UI).
- [ ] **[D7] Onboarding** — proyecto demo con shapes de referencia + overlay de pasos, omitible, no reaparece.
- [ ] **[V3] Spout In** — Spout como fuente en Media (addon nativo grande, solo Windows).
- [ ] **[R1] Render in-site flexible** — extender a "selección con in/out" (hoy hace clip y nest).
- [ ] Barrido de deuda técnica #2 — revisar sub-lanes `lane._auto` residuales (COMPONENTS → Deuda técnica).

## Diferido por Beltrán (para el final)
- [ ] **[D2]** Cola/encoder de export en segundo plano (snapshot congelado).
- [ ] **[P1]** Mac + **[D5]** instalador cerrado.
- [ ] **[D4]** Grilla 3D infinita (sobre la costura de "output target").

---

## Ya cerrado (referencia)
Grado de color completo (LUT + ruedas + curvas), fix bordes automatización, splash 1080², menús File/Edit/Window,
Etapas 0-5 + 9, sistema de documentación (COMPONENTS/ARCHITECTURE/ADR), limpieza automatización legacy (R137/R137b).
Detalle en `PLAN.md`. [F2] auditado sin descuadre · [U3] toggle grilla ya existe · [C2]/[C3] cubiertos.
