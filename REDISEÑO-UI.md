# REDISEÑO-UI — spec maestro (handoff Claude Design "Rev 1")

Fuente de verdad para recrear la UI **calcada** al handoff de Claude Design. Se extrae de
`scratchpad/redesign/design_handoff_immersive_studio/` — sobre todo **`Editor Domo - Rev 1.dc.html`**
(prototipo React con estilos inline; **NO se porta**, se recrea en `index.html` + `app.js`) y `README.md` (spec).
Los `.dc.html` de **360** y **2D** son variantes del mismo shell (sólo cambian el visor y algún control).

> **Cómo leer las refs:** `RevDomo:NNN` = línea NNN de `Editor Domo - Rev 1.dc.html`.

---

## 0 · Reglas globales (aplican a TODO)

- **REGLA DE PODA (Beltrán, 2026-07-25):** lo que **no aparece en el diseño de Claude Design se saca** de la app.
  No borrar: **archivar en `_backup/deprecated/`** (política del proyecto). Vale para botones, secciones,
  handlers y su HTML/CSS/JS. Decisión completa en [ADR-0008](docs/adr/adr-0008-rediseno-rev1-regla-de-poda.md).
- **Sin MAYÚSCULAS shouty:** eliminar `text-transform:uppercase` de títulos de sección, botones, títulos de panel.
  (Se tolera SÓLO en micro-metadata tabular gris de 10px: p.ej. la línea `Shape · 512×512 · V3` del header del
  inspector, `RevDomo:275`, y el label vertical `INSPECTOR` del riel colapsado `RevDomo:476`.)
- **Superficies (ya casi coinciden con la app):** panel `#1B1B1B` · control `#262626` · activo `#4A4A4A` ·
  hover `#303030` · well/recessed `#111111` (o `#0A0B0C`/`#0A0A0A` en nidos profundos) · barra sup/transport `#242424`
  / `#111`. Bordes: hairline `.5px rgba(255,255,255,.08–.16)`; sombra recessed `inset 0 1px 2/3px rgba(0,0,0,.5)`.
- **Alturas de barra = 28px** (top bar, transport, header de inspector, header de media). Status = 22px.
  **Superficies por barra (verificado contra el prototipo, R149):** top bar `#1B1B1B` (`RevDomo:30`) · headers de
  Media e Inspector `#111111` (`RevDomo:49`, `:259`) · **transport `#242424`** (`RevDomo:482`, la única que lo lleva)
  · status `#1B1B1B` (`RevDomo:643`). *Todo well de barra (edición, zoom) es 22px con botones de 16.*
- **Controles = 22px** de alto; **pills/segmentos internos = 16px**; iconos 11–13px.
- **Tipografía:** títulos de item 13px/600 `letter-spacing:-0.01em`; labels de sección 11px/600 `-0.005em`;
  labels de fila 11px `#B8B8B8`; valores tabulares 11px `#E0E0E0` (`font-variant-numeric:tabular-nums`);
  micro-metadata 10–10.5px `#8C8C8C`/`#6D6D6D`. Fuente = Geist (ya en la app).
- **Toggle switch = 26×15**, knob 11px (desliza 2→13px), **VERDE `#4A8D6F` (`--toggle-on`) cuando on**. (RevDomo:315-316,332)
- **Slider/fader:** track 3px, `#111` recessed; **fill = color del parámetro**; a la derecha chip de valor 16px `#111`
  bordeado (valor 11px + unidad 10px `#8C8C8C`); a su derecha **botón keyframe = diamante 11px** con `stroke=color del
  parámetro`. (RevDomo:288-290)
- **Segmentado / "well":** contenedor `#262626` (o `#1B1B1B`) `padding:2px` `height:22px` `border-radius:3px`
  hairline; botones internos 16px, activo `background:#4A4A4A;color:#E0E0E0`, inactivo `transparent;#B8B8B8`. (RevDomo:260,484,511)
- **COLOR POR PARÁMETRO (efectos):** cada parámetro tiene su hue y se usa **igual en fader + diamante + curva de
  automatización + chip de pista**. Map (ya en `PCOLOR`, app.js): Az `#E0954B` · El `#D8C24B` · Size `#E0645C` ·
  Rot `#C58BD0` · Opacity `#7FB2E8` · Blur `#4FB3C9` · Feather `#6FBF95` · Crop `#8FA8C0` · Exposure `#E8C84B` ·
  Contrast `#B0C4DE` · Saturation `#D06FB0` · Temperature `#E08A4B` · Tint `#B08AD0` · Glow `#F0E68C` · Chroma `#5FC9A8`.
- **Azul reactivo `#7FB2E8`** (Reactive FX). **Danger `#E06C6C`** (remove/hover destructivo).
- **REGLA DE DROPDOWN MENUS (todos):** panel `#1B1B1B` `padding:4px` `border-radius:2px` hairline
  `.5px rgba(255,255,255,.14)` sombra `0 12px 34px rgba(0,0,0,.55)` min-width ~184px; ítems 26px, `font-size:11px`,
  gap 9px, icono 13px a la izq (stroke 1.7), atajo a la derecha `#6D6D6D` tabular; separador `.5px` con margen 4px;
  hover `#303030`; clamp a viewport (x≤W-196, y≤H-alto). Un scrim `position:fixed;inset:0` cierra al click/again.
  (RevDomo:670-684, `openMenu`/`renderVals` del script).
- **REGLA 2D↔3D (botones que aparecen/desaparecen):** los controles propios de cada modo del visor se muestran/ocultan
  según `view.mode`; **no deben empujar** el resto (reservar el hueco o icon-only). Detalle exacto por región en §3.

---

## 1 · TOP BAR (28px) — `RevDomo:29-41`
> ⚠️ **CORREGIDO EN LA AUDITORÍA (2026-07-25).** Esta sección decía "botón de menú unificado (hamburguesa/logo)" y
> "selector de modo de vista en el centro". **El prototipo no tiene ninguna de las dos cosas** (`RevDomo:32-35` son
> tres botones File · Edit · Window; el selector de modo vive en la barra del visor, `RevDomo:136`). Era un error de
> esta traducción, no de la app. Se auditó contra este texto y se levantaron dos hallazgos falsos.

- Contenedor 28px, **`#1B1B1B`** (`RevDomo:30` — el `#242424` es del **transport**, no de aquí), borde inferior hairline.
- **Izquierda:** punto de 6px + **menubar de tres botones**: `File` · `Edit` · `Window` (22px de alto, 11px/500).
- **Centro:** nada — un `flex:1` que empuja el resto a la derecha.
- **Derecha:** **nombre de proyecto** (11px/600) + **chip de formato** (`#6D6D6D`) + `?` ayuda (22×22).
- **QUITAR (→ deprecated):** botones sueltos New / Open / Save / Export de la barra (viven en el menú File). JS
  blindado con `if($('#saveBtn'))` etc. *(hecho en R148)*.

## 2 · PANEL MEDIA — `RevDomo:46`
- **Header (28px):** well **List/Grid** + título.
- **Fila de filtros:** well **All · Video · Image · Audio** + **dropdown Sort** (Name/Date/Type) — reemplaza None/Folder/Type.
- **Create row:** `Import` (primario) + `Text · Shape · Compose · Adjust`; labels colapsan a icono por container-query.
  **Umbral exacto del prototipo:** `createLbl: S.mediaW < 340 ? 'display:none' : ''` con `mediaW:288` por defecto →
  **en el diseño, al ancho por defecto los labels NO se ven**; aparecen al ensanchar el panel más allá de ~340px.
  Nuestro `@container (min-width:322px)` sobre `.crrow` equivale a ~338px de panel: correcto, no tocar.
- **QUITAR (→ deprecated):** buscador visible y "New folder" visible (quedan por atajo/clic-derecho). *(hecho)*.
  El atajo tiene que **funcionar**: **Ctrl+F** revela el campo en la fila de filtros (aparta el well de filtros para
  ocupar la fila), **Esc** lo cierra y limpia el filtro. *(R149 — antes enfocaba un input `display:none`.)*
- Estado: `mediaSort`, `mediaFilter`.

## 3 · BARRA DEL VISOR — `RevDomo:133`
- Overlays (Grid/Safe/Outline/Horizon/Alpha) **icon-only** en well; Proxy + calidad Full/½/¼ a la derecha.
- **Output dropdown** consolida Full performance · Viewer window · NDI · Spout (los 4 botones sueltos → deprecated;
  indicador pulsante en `#outputBtn` si NDI/Spout on). *(ya hecho)*.
- **Regla 2D↔3D:** en 3D aparecen controles de cámara (Orbit/Viewer, faders); en 2D aparece Az/El. En el prototipo el
  well de modo 3D es **el último del clúster izquierdo** (`RevDomo:154-158`: va después de calidad, justo antes del
  `flex:1`), así que al aparecer **no empuja nada**. *(R149: era el segundo del clúster y corría overlays/calidad
  +151px; movido. Medido: dispSeg 494 y qualitySeg 681 en 2D **y** en 3D, sin overflow a 1920.)*
- El "residual de 30-50px de overflow" que arrastraban las notas **no existe**: a 1920 la barra usa ~1224 de 1328.

## 4 · INSPECTOR — `RevDomo:255`
Panel `#1B1B1B`, header 28px `#111`.
- **Tabs (well):** **Inspector** · **Reactive FX** (RevDomo:260-263). A la derecha: botón "altura completa"
  (`togInspFull`) + botón colapsar. Riel colapsado 26px con label vertical `INSPECTOR` (RevDomo:474-477).
- **Barra de color del clip/pista:** franja 4px arriba, `background = color del clip/pista`, **clickable** → picker.
  (RevDomo:270). **PRESERVAR la elección de color de pista/clip.**
- **Header de item:** thumb 44×28 + nombre 13px/600 + metadata `Shape · 512×512 · V3` (10px, gris, uppercase tolerado).

### Tab Inspector — secciones (cada una: botón 24px con chevron + hairline; RevDomo:278-413)
1. **Transform** — filas Position/Scale/Rotation/… (sliders con color de parámetro + diamante) + botón **Mirror**.
2. **Clip** — Blend (select) + Speed.
3. **Source** *(NUEVA)* — Projection (dropdown), Mirror (toggle), Fisheye (toggle + Amount), Tilt (si equirect). (RevDomo:312-323)
4. **Playback** *(NUEVA)* — Loop (toggle), Reverse/Ping-pong (si loop), Speed. (RevDomo:330-337)
5. **Color** — sliders Exposure/Contrast/Saturation/Temperature/Tint (color de parámetro) + **3 ruedas Lift/Gamma/Gain**
   (56px) + **LUT** (Load…/Reset) + canales **Luma/R/G/B** + **editor de curvas** (svg 260×120). (RevDomo:344-383)
6. **Motion** — chips de preset (Orbit/Pulse/…) + tarjetas de motion (drag · label+param · **Mode** dropdown ·
   remove · Speed). (RevDomo:390-412)

### Tab Reactive FX (RevDomo:415-468)
- Header item (icono onda + "Reactive FX" + "… audio-reactive chain").
- **Audio Engine** — Source (dropdown) + **espectro** (barras azul `#7FB2E8`) + filas (color azul reactivo).
- **Effects Chain** — tarjetas de FX (drag · bypass · nombre · ◆ signal + barra · colapsar · remove; params con color).
- Pie: **Add Effect** (primario) + **Add Adjustment Layer**.

- **QUITAR (→ deprecated): la sección/panel "Master Grade" completa.** En el diseño NO existe; el grado es la sección
  **Color** por-clip. Archivar `renderMasterGrade` + `#insMaster`/`#secMaster` + su HTML/CSS.

## 5 · TRANSPORT (28px) — `RevDomo:481`  ⟵ **las SECUENCIAS viven acá**
- Contenedor 28px `#242424`, 3 zonas (flex-1 izq / centro / flex-1 der).
- **Izquierda — SECUENCIAS:** well con la pestaña activa `Sequence N` (pill 16px, activo `#4A4A4A`) + botón **`+`**
  (nueva secuencia, 22px). (RevDomo:484-487). *Reemplaza la ubicación actual de las tabs de secuencia.*
- **Centro — transporte:** Mark In · Go to start · **Play/Pause** (30×22, bordeado) · Go to end · Mark Out ·
  **timecode** (caja recessed `#111`: TC 12.5px + separador + frames 11px) · toggle **TC/Frames** (well) ·
  (si markers) Loop selection + Add locator. (RevDomo:490-508)
- **Derecha:** well **Simple · Auto · Grid · Fit** (RevDomo:512-515) + well **zoom −/＋** (RevDomo:517-519).
  - `Simple` = clips estilo Premiere; `Auto` = mostrar automatización (tecla A); `Grid` = líneas de grilla;
    `Fit` = encajar todo (H·W).

## 6 · TIMELINE — `RevDomo:524`
Contenedor `#111`, handle de resize arriba (RevDomo:526). Estructura en columnas:
- **Tool rail (34px):** Select(V) · Track select · Hand(H) · Trim(T) · Razor(B) · Zoom(Z), botones 24px, activo resaltado. (RevDomo:529-536)
- **Track headers (`hdrW`, def 168, rango 152-240):** una **sola columna** para **vídeo + audio unificados**.
  Cada cabecera (RevDomo:542-564): franja de color 3px (`tr.c` = **color de pista, preservar**) · chevron ·
  tag (V4/…/A1) · nombre (editable) · botón **M** (mute) 20×18. **Audio (A1)** = misma estructura, franja `#5A8D7E`.
  - **Automatización (cuando `curvesOn`):** fila con **2 chips** — **Effect-type** (`onCat`) + **Parameter**
    (`onParam`, con swatch 6×6 del color del parámetro). (RevDomo:551-561). Éste es el "sistema visual de
    automatización" rediseñado en la cabecera.
  - **Resize de pista:** handle 5px abajo (`onResize`) **+ barra de V-zoom lateral** (col 12px derecha, thumb
    arrastrable con topes) que escala TODAS las alturas. (RevDomo:563, 622-628). Sistema de resize mejorado.
- **Lanes (tracks):** por pista, clips absolutos (RevDomo:586-614):
  - Clip: `top:4px;bottom:5px` radius 2px; fill = `cl.fill` @0.30; **franja de color 3px** izq (`cl.c` = color de clip);
    barra de título 16px `#262626` (nombre + tag `Proxy`); thumbnail de vídeo 56px.
  - **FADE = cuadraditos 6×6 en las esquinas SUPERIORES del clip** (izq = fade in, der = fade out; `cursor:ew-resize`).
    (RevDomo:595-596). *Ésta es la ubicación/jerarquía de fade corregida — no es un botón aparte.*
  - **Curva de automatización (cuando `curvesOn`):** svg polyline + relleno en `tr.armedColor` (color del parámetro) +
    diamantes de keyframe. (RevDomo:598-607).
  - **Audio:** waveform svg en `cl.c`. (RevDomo:609-611).
  - **Playhead:** línea 2px `#E0E0E0` + cabeza de flecha. (RevDomo:619-620).
- **Scrollbar/zoom horizontal (12px abajo):** thumb arrastrable con topes ew. (RevDomo:632-638).

## 7 · STATUS (22px) — `RevDomo:642`
`Ready` + hint contextual de herramienta · (spacer) · `CPU% · RAM · GPU%` · `N clip selected` · `WebGL · WebCodecs`.
- El hint es el de la **herramienta activa** (`RevDomo:645`: *"Select (V) — click a clip to select · drag its title to
  move"*, en `#6D6D6D`). Implementado en `TOOL_HINTS` + `refreshToolHint()`: `#statInfo` cae a este texto cuando no
  hay hover, reusando el parser de tooltips de R102 (`Nombre (ATAJO) — descripción`). *(R149.)*
- **Desviación deliberada:** el prototipo pinta el status en `#8C8C8C`; lo dejamos en `--ink-2` porque el token dice
  que `#8C8C8C` no es texto de cuerpo (Lc −38) y R102 ya subió los textos que estaban ahí.

---

## Orden de ejecución (parte por parte; verificar cada una por CDP a 1920×1080)
- [x] **0 · Tokens** (`:root`) — hecho.
- [x] **1 · Componentes** (menú, toggles verdes, wells) — hecho.
- [x] **2 · Shell** (top bar, media, visor, tabs inspector) — hecho; **re-auditar contra §1-3**.
- [x] **3 · Inspector** — color-por-parámetro, **Source** + **Playback** (nuevas), **Master Grade quitado** (UI archivada
  en `_backup/deprecated/master-grade-ui.js`; el motor sigue vivo). **Pendiente: auditar** Color (ruedas/LUT/canales/
  curvas), Motion y Reactive FX contra §4.
- [x] **4 · Transport + Secuencias** (§5) — `#seqTabs` movido a la barra del play (well compacto); well
  Simple · Auto · Grid · Fit (`#tlEditSeg`); zoom −/＋. **Pendiente: auditar** contra §5.
- [x] **5 · Timeline** (§6) — vídeo y audio **unificados** en una sola columna (audio redimensionable/colapsable;
  `#audioZone`/`#audioHeadZone` en desuso), chips de automatización en la cabecera (2 × `.achip`, con swatch de color),
  fade como cuadraditos en las esquinas superiores, V-zoom lateral (`#tlVZoom`), cabecera 152→168px.
  **Pendiente: auditar** curvas coloreadas y waveform contra §6.
- [ ] **6 · Launcher** + **7 · variantes por formato** (360/2D).

### Auditoría (2026-07-25) — informe en `AUDITORIA-REV1.md`
Barrido por CDP a 1920×1080 contra §0-§7. **Cerrados en R149:** alturas de barra (media/inspector/transport/status),
wells de edición y zoom a 22px, superficies por barra, Source y Playback con toggles, hint de herramienta en el
status, Ctrl+F con campo real, micro-metadata a 10px, título "Transform", tooltip de `Fit`, y la barra del visor sin
saltos 2D↔3D. **Cuatro hallazgos resultaron falsos** (menú unificado, selector de modo en la top bar, labels de la
Create row, truncado del chip de parámetro): venían de errores de esta traducción, ya corregidos arriba.

### Deuda abierta
- ~~**Master Grade dormido**~~ — **CERRADO (R150):** Beltrán lo sacó del código. El motor está archivado junto a su
  UI; el grado vive por clip en la sección Color, como manda el diseño.
- **Tres checkboxes nativos sueltos** fuera de las secciones del diseño: `#bkToggle` (Remove black) y `#txtStroke`
  (Clip), `#motionPrev` (Motion). El diseño no los cubre, pero la regla §0 del toggle es global → convertirlos
  cuando se toquen esas filas.
- **Juicio visual:** la auditoría es por DOM/estilo computado; falta una pasada mirando la ventana al frente.
- Etapas **6 · Launcher** y **7 · variantes por formato** sin empezar.

**Poda transversal:** a medida que se toca cada región, archivar en `_backup/deprecated/` todo lo que el diseño no
muestre (con su HTML/CSS/JS), actualizando la fila en `COMPONENTS.md` en el mismo commit.
