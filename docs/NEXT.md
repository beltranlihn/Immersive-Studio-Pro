# NEXT — Cola de trabajo activa

> Tareas ordenadas de **más rápido de resolver → más complejo**. Marcá `[x]` a medida que se cierran (y actualizá la fila
> en `COMPONENTS.md` + una entrada en `PLAN.md` en el mismo commit, como manda el ritual de `/commit`).
> Códigos = tickets de `CORRECCIONES-V2.md`. Ubicaciones = `COMPONENTS.md`. Última revisión: 2026-07-23.

## Arranque (wins rápidos) 🟢
- [ ] **[T5] Mute visual** — silenciar clip/secuencia lo deja **muy transparente** (no lo oculta). Aislado; existe el estado
      `disabled`/`.off` (hatch + opacity) como referencia → agregar el caso "mute" con opacidad alta.
      _Toca:_ Timeline (clip DOM) + draw en `composite`/`drawClip`.
- [ ] **[R3] Secuencias reordenables** — drag para reordenar las pestañas `#seqTabs`. Reusa el patrón de `startLaneDrag`
      (reorden de lanes). _Toca:_ `renderSeqBar` (#seqTabs) + `state.openSeqs`.

## Media mañana (acotado, alto valor) 🟡
- [ ] **[T3] Círculos de zoom en la barra de scroll** (estilo Premiere) — handles circulares en los extremos de `#tlscroll`
      que al arrastrarlos acercan/alejan. _Toca:_ Timeline (`tlZoomAt`, `#tlscroll`).
- [ ] **Grade en fulldome/equirect (tapar el gap PFD/PEQ)** — las ruedas/curvas/LUT NO se aplican a fuentes fulldome
      (`PFD`) ni equirect (`PEQ`) porque esas rutas no llaman `bindClipLUT`/`bindClipGrade`/`bindClipCurve`. Portar la
      cadena de color a esos shaders (uniformes en `LFD`/`LEQ` + el bloque de color en sus fragment shaders + el bind).
      _Cierra un hueco real de algo recién construido._ _Toca:_ Motor GL (`PFD`/`PEQ`) + Color (`bindClipLUT` y cía).

## Tarde (medio) 🟡
- [ ] **[T2] Trim micro-snap + más zoom** — el trim ya es por frame; hacer visible el snap al acercar mucho y permitir
      **zoom más profundo**. _Toca:_ Timeline (`trimZone`/`applyTrim`, `tlZoomAt`).
- [ ] **[V1] Viewer-only sigue 2D/3D** — la ventana `openViewerWindow` hoy es solo domo 3D; que **cambie con el editor**
      (2D ↔ 3D). _Toca:_ Shell/UI (`openViewerWindow`/`renderViewer`).

## Si queda energía (UI, rinde menos con cansancio) 🟠
- [ ] **[T4] Rediseño de faders del 3D preview** — "están muy malos", rediseñar (FOV/dolly/dist). Usar skill `impeccable`.
- [ ] **[X2] Layout de las tarjetas de FX reactivos** — recuadro de cada efecto mejor ordenado.

---

## Para días siguientes (complejo / diferido)
- [ ] **[X1] Rediseño del ecualizador** (Reactive FX) — audio-reactivo, mejor diseño.
- [ ] **Grade máster de secuencia** (idea propia) — un grado global sobre el composite final, además del por-clip.
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
