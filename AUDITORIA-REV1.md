# Auditoría del rediseño "Rev 1" — etapas 0-5

**Fecha:** 2026-07-25 · **Contra:** el prototipo `scratchpad/redesign/…/Editor Domo - Rev 1.dc.html` (fuente de
verdad) y `REDISEÑO-UI.md` (traducción) · **Sobre:** commit `028948b` (R148) · **Arreglos:** R149
**Método:** CDP a 1920×1080 sobre `npx electron .`, proyecto demo, medición de **DOM + estilo computado**.
Scripts: `scratchpad/audit-rev1-{a,b,c,d,e}.mjs` (barrido) y `scratchpad/verify-audit-fixes.mjs` (verificación).
**Cero errores de consola** en todos los pases.

> **Limitación:** las capturas de píxel salieron negras (la ventana en segundo plano no compone), así que todo esto
> es medición estructural. El juicio visual —peso, ritmo, aire— sigue pendiente de una pasada con la ventana al frente.

---

## Lección de esta auditoría

El primer barrido se hizo contra **`REDISEÑO-UI.md`**, que es una *traducción* del prototipo. **Cuatro de los nueve
hallazgos resultaron falsos**: el `.md` describía cosas que el prototipo no tiene. Al verificar cada hallazgo contra
el `.dc.html` antes de tocar código, la app resultó estar bien y **el que estaba mal era el documento**.

> **Regla que queda:** ante cualquier duda, manda el `.dc.html`. El `.md` es un índice para navegarlo, no la fuente.
> Los cuatro errores del `.md` ya están corregidos (§1, §2 Create row, §3 residual).

---

## Resumen

| | |
|---|---|
| ✅ Conforme desde R148 | 22 puntos |
| 🔧 Arreglado en R149 | 11 hallazgos |
| ↩️ Falso positivo (error del `.md`) | 4 hallazgos |
| ⚪ No verificable | 2 |
| 📌 Deuda abierta | 3 |

---

## 🔧 Arreglado en R149

### Alturas y superficies de barra (§0)
El diseño fija 28px para toda barra y 22px para el status. Cinco estaban fuera:

| barra | antes | ahora | fuente |
|---|---|---|---|
| header de Media (`.panhead`) | 26 | **28** | `RevDomo:49` |
| header de Inspector (`.panhead`) | 26 | **28** | `RevDomo:259` |
| `.transport` | 30 | **28** | `RevDomo:482` |
| `.status` | 24 | **22** | `RevDomo:643` |
| `#tlEditSeg` (Simple·Auto·Grid·Fit) | 18 | **22** (botones 16) | `RevDomo:511` |
| `.zoomgrp` | 18 | **22** (botones 16) | `RevDomo:517` |
| `#snapBtn` | 18 | **22** | — (misma fila) |

Superficies, verificadas una por una contra el prototipo (mi primera lectura del `.md` decía "top bar y transport en
`#242424`" y era **media verdad**): top bar `#1B1B1B` · headers `#111111` · **sólo el transport** `#242424`
(token nuevo `--bar`) · status `#1B1B1B`.
**Desviación deliberada:** el status del prototipo va en `#8C8C8C`; lo dejamos en `--ink-2` porque el token dice
explícitamente que `#8C8C8C` no es texto de cuerpo (Lc −38) y R102 ya subió los textos que estaban ahí.

### La barra del visor ya no salta al pasar 2D↔3D (§3)
El grupo de cámara 3D era el **segundo** del clúster izquierdo, así que al aparecer corría todo lo de su derecha:
`dispSeg` +151px, `qualitySeg` +152, `proxyToggle` +152. En el prototipo (`RevDomo:154-158`) es el **último** del
clúster, justo antes del `flex:1`. Movido allí.

| | 2D antes | 3D antes | 2D ahora | 3D ahora |
|---|---|---|---|---|
| `#dispSeg` | 494 | 645 | **494** | **494** |
| `#qualitySeg` | 681 | 833 | **681** | **681** |
| `#proxyToggle` | 781 | 933 | **781** | **781** |

Sin overflow en ningún modo. De paso: **el residual de "30-50px" que arrastraban las notas no existía** — la barra
usa ~1224px de 1328 disponibles.

### Source y Playback con toggles, no checkboxes (§4)
El `.iosw` del diseño (26×15, knob 11px, verde `#4A8D6F` al on) estaba **perfectamente construido pero sólo se usaba
en Preferences**. Ahora Source (`Fulldome src`, `Equirect 360°`, `Fisheye`) y Playback (`Loop`, `Reverse`) usan la
forma de fila del prototipo: etiqueta · descripción apagada · switch a la derecha. Verificado: 3 toggles en Source,
26×15 con knob de 11.
De paso, `Amount` del fisheye pasó a **su propia fila, sólo cuando Fisheye está encendido** (`RevDomo:317-319`), en
vez de un campo numérico semi-transparente pegado al checkbox.

### La búsqueda de media vuelve a existir (§2)
`#mediaSearch` había quedado `display:none`, así que **Ctrl+F era un no-op**. Ahora el atajo revela un campo real en
la fila de filtros (aparta el well de filtros para ocupar la fila: 200px útiles en un panel de 292), abre el panel si
estaba plegado, y **Esc** lo cierra limpiando el filtro — para que no quede un panel filtrado sin nada que lo explique.

### Hint de herramienta en el status (§7)
El prototipo muestra siempre la pista de la herramienta activa junto a `Ready` (`RevDomo:645`). `#statInfo` ya existía
(barra de ayuda al hover, R102) pero se vaciaba sin hover. Ahora cae a `TOOL_HINTS[state.tl.tool]` reusando el mismo
parser (`Nombre (ATAJO) — descripción`), y se repinta al cambiar de herramienta y de idioma.
Verificado: *"Select — click a clip to select · drag its title to move"* + atajo `V`.

### Cosmética
- `.mmeta` y `#selmeta`: 11px → **10px**. El uppercase **sí es del diseño** (`RevDomo:275`), pero sólo se tolera a
  ese tamaño; mi hallazgo original pedía quitarlo y eso habría sido un error.
- Título de sección: `Dome · Transform` → **`Transform`** (`RevDomo:280`). El modo ya se lee en el chip de formato.
- Tooltip de `Fit`: prometía "(H·W)" y `fitAll()` sólo ajusta el horizontal (la altura la da el V-zoom).
- `#roomOutBtn`: 24px → 22px, la medida de control del diseño.

---

## ↩️ Falsos positivos (el `.md` estaba mal, la app bien)

1. **"El menú no está unificado".** El `.md` §1 pedía un botón hamburguesa único. `RevDomo:32-35` son **tres botones
   File · Edit · Window**, exactamente lo que la app tiene.
2. **"El selector de modo de vista no está en la top bar".** El `.md` lo ponía en el centro de la top bar. En el
   prototipo la top bar es: punto · menubar · `flex:1` · título · chip · `?`. El selector vive en la barra del visor.
3. **"Los labels de la Create row nunca aparecen".** El prototipo hace `createLbl: S.mediaW < 340 ? 'display:none'
   : ''` con `mediaW:288` por defecto: **en el diseño tampoco se ven al ancho por defecto**. Nuestro
   `@container (min-width:322px)` equivale a ~338px de panel — correcto dentro de 1.5px.
4. **"El chip de Parámetro sigue truncando".** El prototipo usa `flex:1; min-width:0` con `text-overflow:ellipsis` y
   el mismo `hdrW:168`: **la elipsis es intencional**, y la cabecera es redimensionable hasta 240px.

---

## ✅ Conforme desde R148 (verificado, no tocado)

Master Grade fuera de verdad (`#insMaster` no existe, `renderMasterGrade` es `undefined`) · color por parámetro
completo, 15 parámetros con el hue exacto del map · unificación real del timeline (5 cabeceras en la columna
principal, 0 en `#audioHeadZone`, audio con grip de resize y colapso como las de vídeo) · cabecera 168px ·
`.rulerpad` 22px vacía · fade = cuadradito 7×7 `radius:2px` · V-zoom 12px · chips de automatización con swatch ·
secuencias en el transport como well de 22px · overlays icon-only · dropdown Output (y los 4 botones sueltos
eliminados del DOM) · `#selColorBar` de 4px con el color del clip y clic → picker · toggle `.iosw` exacto ·
10 de 11 wells ya estaban a 22/16.

---

## ⚪ No verificable en esta pasada

- **Waveform de audio (§6).** El clip de audio que se inyectó es sintético y no tiene picos decodificados: la
  ausencia de `<svg>` **no prueba nada**. Requiere un archivo real.
- **Juicio visual.** Ver la limitación de arriba.

---

## 📌 Deuda abierta

- ~~**Master Grade dormido.**~~ **CERRADO (R150).** Beltrán eligió sacarlo: *"eso nunca lo voy a aplicar"*. El motor
  entero está archivado en `_backup/deprecated/20260725-master-grade-engine.js` (la UI ya estaba desde R148).
  Verificado por CDP: siete símbolos fuera, render y grado por clip intactos, y un `.isp` viejo con `grade` abre sin
  romper (se ignora).
- **Tres checkboxes nativos sueltos:** `#bkToggle` (Remove black) y `#txtStroke` en la sección Clip, `#motionPrev` en
  Motion. El diseño no cubre esas filas, pero la regla §0 del toggle es global → convertirlos al tocarlas.
- **Etapas 6 (Launcher) y 7 (variantes 360/2D)** sin empezar.
