# Código deprecado / archivado — Immersive Studio Pro

> **Política: archivar, no borrar.** Cuando se saca código muerto/duplicado/deprecado del software principal
> (`app.js`/`index.html`/`main.js`), **no se borra** — se **copia verbatim** a esta carpeta con un encabezado que registra
> de dónde salió, por qué y cómo restaurarlo. Así queda fuera del código que corre, pero recuperable si alguna vez se necesita.
> Decisión completa en [docs/adr/adr-0007-archivar-no-borrar.md](../../docs/adr/adr-0007-archivar-no-borrar.md).

## Cómo archivar un bloque (procedimiento)
1. Copiá el código a sacar **verbatim** a un archivo nuevo acá: `_backup/deprecated/AAAAMMDD-<nombre-corto>.js`
   (o `.html`/`.css`/`.md` según el tipo).
2. Poné arriba de ese archivo un encabezado:
   ```
   /* ARCHIVED (deprecated / unused) — Immersive Studio Pro
    * Origen:   app.js · <función/símbolo> / <#domId>   (commit <hash> "<msg>")
    * Sacado:   AAAA-MM-DD
    * Motivo:   <por qué se saca — enlazá el ticket/ADR>
    * Restaurar:<dónde/cómo re-insertarlo y qué re-cablear>
    * Relacion: <[ticket], docs/adr/adr-XXXX>
    */
   ```
3. Sacá el bloque del código principal (dejá un comentario de una línea donde estaba: `// [archivado AAAAMMDD] <qué> → _backup/deprecated/…`).
4. Actualizá la fila en `COMPONENTS.md` (estado 🗑️ → archivado, o quitá la fila) y la sección "Deuda técnica & gaps".
5. Agregá una fila a la tabla de abajo.
6. `node --check app.js && node --check main.js` y verificá que no rompiste nada. Commit.

## Cómo restaurar
Abrí el archivo en `_backup/deprecated/`, seguí la línea **Restaurar** de su encabezado, pegá el bloque de vuelta, re-cableá
lo que indique, y actualizá `COMPONENTS.md`. Corré el syntax check.

## Registro de bloques archivados

| Fecha | Archivo de respaldo | Origen (símbolo / #id) | Motivo | Ticket / ADR |
|---|---|---|---|---|
| 2026-07-22 | `20260722-automation-override-and-perform-bake.js` | app.js · `setAutoOff`/`reenableAuto`/`reenableAll`/`anyOverride`/`updReEnableGlobal` + `recWrite`/`bakeRecorded`/`autoRecOn`/`toggleAutoRec`/`_recTouch` · `state.autoRec` · index.html `#autoRecBtn` + CSS | Sin efecto bajo el modelo After Effects; sin llamadores (verificado). Motor de automatización verificado intacto por CDP tras sacarlo. | [A2]/[D1], ADR-0006 |
| 2026-07-23 | `20260723-automation-sublanes-and-clip-auto.js` | app.js · `appendAutoLanes`/`addAutoLane(At)`/`laneAutoH` · `lane._auto`/`lane._autoH` · lista legacy `c._auto` (`closeAuto`, copia en `sepAuto`, `returnToDefault`, filtro en borrado de fx) | Código muerto: el render de sub-carriles apilados ya estaba neutralizado por `[A5]`. Único modelo vigente: `lane._autoP`. Verificado por CDP. | [A5], R143 |
| 2026-07-25 | `master-grade-ui.js` | app.js · `renderMasterGrade()` + `MASTER_PARAMS`/`MASTER_WHEELS` + editor de curvas máster (`.mgcurvecv`/`.mgctab`/`#mgCurveReset`) · index.html `#insMaster` | El diseño "Rev 1" de Claude Design no tiene sección "Master Grade": el grado se edita por clip en la sección **Color**. Regla de poda del rediseño. **Paso 1 de 2** (sólo la UI). | REDISEÑO-UI §4, ADR-0007 |
| 2026-07-26 | `20260726-mod-button-inspector.js` | app.js · botón `.modb` + arco `.modarc` de la fila de parámetro y su wiring · index.html · su CSS | Pedido de Beltrán: dejar la fila igual a la del prototipo (etiqueta · surco · caja de valor · UN botón de keyframe). Esos 20px y su hueco eran parte de lo que estrechaba el fader. **El motor de modulación sigue vivo** (`c.mod`, `evalModStack`, `openModPanel`): sin botón no se puede crear ni editar, pero un `.isp` viejo con `c.mod` se sigue evaluando — mismo estado que tuvo el Master Grade entre R148 y R150. | R155, ADR-0007 |
| 2026-07-26 | `20260726-ableton-clip-mode.js` | app.js · `state.tl.simpleClips`, `toggleSimpleClips`, la rama Ableton del hit-test, el cursor condicional, el interruptor de Preferences, la entrada de paleta · index.html · `#simpleClipBtn` | Pedido de Beltrán: "eliminemos el formato tipo Ableton y dejemos sólo el tipo Premiere para arrastrar el clip desde donde queramos". Convivían dos modelos de interacción y un botón para cambiarlos. `body.simpleclips` se fija al arrancar y no se conmuta más. | R155, ADR-0007 |
| 2026-07-25 | `20260725-landing-v1.js` | app.js · `showLanding()` v1 (cuatro botones + rejilla de recientes) | Reemplazada por el LAUNCHER del handoff de Claude Design: tres tipos de proyecto con todos sus parámetros a la vista, visores técnicos en vivo, tabla de muros y fila de recientes. El landing viejo abría los diálogos de creación; el launcher expone los parámetros y crea sin pasar por ellos. Los diálogos siguen vivos (los usa el menú File). | R153, ADR-0007 |
| 2026-07-25 | `20260725-audio-section-model.js` | app.js · partición por tipo de `lanesTopDown` [R92-T8] · clamp por grupo de `startLaneDrag` · filtro por tipo de `wheelResizeLanes` · ramas `.audiozone` de los handlers de rueda · `renderVZoom` de sólo-alturas + su CSS | El diseño usa UNA lista ordenada que incluye el audio (`trackOrder:[…,'a1']`) y Beltrán lo pidió explícito: audio y vídeo se comportan igual (reordenar/agrandar/achicar). Las ramas `.audiozone` ya eran código muerto desde R148. La barra vertical pasó a ser el espejo de la horizontal (scroll + zoom), así que el V-zoom de sólo-alturas quedó reemplazado. | R152, ADR-0007/0008 |
| 2026-07-25 | `20260725-in-page-splash.js` | app.js · `showSplash(minLoops,onReady)` · index.html CSS `.splashcard/.splashlogo/.splashttl` | El handoff de launcher+splash define el splash como **ventana propia de 1080²** previa a la del editor, y Beltrán lo pidió explícito ("abre en 1080x1080… y recién ahí abre la app en 16/9"). Reemplazado por `splash.html` + `splash-preload.js` + `createSplash`/`finishBoot` en main.js. `startLogoLoop` NO se archiva: lo siguen usando la pantalla de carga de proyecto y la de inicio. | R151, ADR-0007 |
| 2026-07-25 | `20260725-master-grade-engine.js` | app.js · shader `_MGFS`/programa `_MG`/`_MGu` · `_masterClip`/`_mgRT`/`_mgTarget` · `masterGradeOn()`/`applyMasterGrade()` · `state.seqGrade` · seis call-sites (preview `render`, `ndiTick`, `spoutTick`, `renderExportFrame`, `saveActiveSeq`, `loadSeqIntoState`) + `preloadLUTs` · index.html CSS de `#insMaster` | **Paso 2 de 2.** Decisión de Beltrán: *"eso nunca lo voy a aplicar, no me interesa"*. Sin UI desde R148 el motor quedaba aplicando en silencio el grado de `.isp` viejos, sin forma de verlo ni resetearlo. Sin proyectos activos → no hay compatibilidad que preservar; un `grade` en un `.isp` viejo se ignora al abrir (verificado por CDP). | R150, ADR-0007/0008 |

<!-- Al archivar, agregá una fila aquí. Ejemplo:
| 2026-07-22 | 20260722-auto-override.js | app.js · `setAutoOff`/`reenableAuto` · #reEnAll | Reemplazado por modelo After Effects; `evalP` ya lo ignora | [A2]/[D1], ADR-0006 |
-->
