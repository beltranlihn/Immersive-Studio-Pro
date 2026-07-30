# 360 Room — visores separados muros/piso + pistas de piso (spec de implementación)

> Pedido de Beltrán (2026-07-30). Plan con Opus, ejecución con Sonnet. Verificación CDP en el `.exe` y deploy al
> cierre. Este documento es la fuente de verdad mientras dure la tanda; tachar en `docs/NEXT.md` a medida que cierra.

## Objetivo (lo que pidió Beltrán, literal)
- El sistema 360 cambia: **el canvas de muros y el de piso son visores DISTINTOS**.
- Viven en el **mismo timeline**, pero las **pistas son diferidas**: hay pistas de muros y pistas de PISO, con una
  **distinción visual** para las de piso (que se note que son de piso).
- En el **visor 2D** puedo **activar o desactivar la vista del piso**. Cuando están las dos, veo la de muros y la de
  piso a la vez y puedo **agrandar/achicar cada ventana** (divisor arrastrable).
- **Quitar** que un vídeo que llega al borde del piso siga extendiéndose por los muros → **eliminar el fold-wrap
  piso↔muro (R222)**. Queda para más adelante.
- **Mantener** la **extensión infinita horizontal en muros** (seam wrap): un clip que llega al borde derecho de la
  tira de muros reaparece por la izquierda. Eso ya funciona bien y NO se toca.

## Decisiones tomadas con Beltrán (AskUserQuestion 2026-07-30)
1. **Pistas de piso = GRUPO FIJO.** La sala nace con un bloque de pistas de MUROS (arriba) + un bloque separado de
   pistas de PISO (abajo), tintado y rotulado como piso. Cada bloque tiene su propia "New track". El contenido en
   pistas de muros va al visor de muros; el de pistas de piso, al visor de piso.
2. **Layout 2D = LADO A LADO.** Muros a la izquierda, piso a la derecha, con divisor vertical arrastrable. Toggle
   para ocultar el piso (los muros toman todo el ancho).

## Arquitectura elegida (clave — no cambiar sin releer)
**Se mantiene UN solo composite** (el lienzo merged de R221: tira de muros arriba `[0,stripH]` + piso abajo
`[stripH,h]`). Motivo: el **visor 3D** y el **export** ya leen de ese lienzo (piso = dock-rect inferior, muros =
tira superior). Reusarlos intactos evita reescribir 3D/export.

Lo que cambia:
- **Modelo de pista:** campo nuevo `lane.surf` ∈ `undefined`(normal) | `'wall'` | `'floor'`. Sólo lo llevan las
  pistas de una sala. En una sala, las pistas de vídeo son `surf:'wall'` por defecto y hay un grupo `surf:'floor'`.
- **Colocación por superficie:** un clip se compone en la **sub-superficie de su pista**:
  - pista `wall` → se coloca en la tira de muros `[0,stripW]×[0,stripH]`, con **seam wrap** horizontal, y **scissor**
    a esas filas (no puede invadir el piso).
  - pista `floor` → se coloca en el **rect del piso** `[fx0,fx1]×[stripH,h]` (fx0/fx1 = columnas del muro Front),
    **sin wrap**, con **scissor** a ese rect.
  Las coords `x/y` (%) del clip pasan a ser **relativas a su superficie**, no al lienzo entero.
- **Se elimina el fold-wrap** (`computeRoomFold`/`roomFold`/las ramas `foldPasses` de `drawClipFlat`).
- **Visor 2D partido:** dos paneles (muros | piso), cada uno **blitea su región** del mismo `glc`. Divisor
  arrastrable + toggle de piso. El hit-testing del puntero mapea según el panel.

### Fórmula de remapeo superficie→lienzo (crucial)
`flatPlace(c,m,t)` ya devuelve `fc/fx/fy` en el marco NDC cuadrado-inscrito de aspecto `_compAspect`. Para un clip
ligado a superficie:
1. Colocar con el **aspecto de la superficie** `Asurf = (x1-x0)/(y1-y0)` (llamar a `flatPlace` con `_compAspect`
   temporalmente = `Asurf`, o factorizar un `flatPlaceA(c,m,t,A)`), obteniendo `fc/fx/fy` en NDC de la superficie
   con semiejes `Fxs, Fys`.
2. Mapear NDC-superficie → NDC-lienzo (K = `2*Fx_c/stripW`, `nx(px)=K*px-Fx_c`, `ny(py)=Fy_c-K*py`, con
   `Fx_c/Fy_c` los del lienzo entero, aspecto `A_canvas=seqW/seqH`):
   ```
   mX = K*(x1-x0)/(2*Fxs)      bX = K*(x0+x1)/2 - Fx_c
   mY = K*(y1-y0)/(2*Fys)      bY = Fy_c - K*(y0+y1)/2
   fc' = [mX*fc.x + bX, mY*fc.y + bY]
   fx' = [mX*fx.x,      mY*fx.y]
   fy' = [mX*fy.x,      mY*fy.y]
   ```
   (Sin términos cruzados: X depende sólo de sx, Y sólo de sy. Si el rect y la superficie comparten aspecto,
   `mX==mY` → sin distorsión.)
3. **Scissor** al rect de la superficie (pasar px→scissor del FBO composite, igual que `roomWallScissorRects`).
4. **Seam wrap** sólo para `wall`: el span sigue siendo `2*Fx_c` (los muros ocupan todo el ancho del lienzo).

## Anclas de código (verificadas 2026-07-30, pueden correrse ±)
- `flatPlace` — app.js:799 · `drawClipFlat` (seam/fold/scissor) — app.js:838-892
- `computeRoomFold`/`roomFold` (R222, A ELIMINAR) — app.js:806-837
- `roomWallScissorRects` — buscar por nombre · `_roomWrap` flag — app.js:790, seteo en composite/export 1302/6582/6768
- Timeline lanes: `renderTimeline` — app.js:2764 · fila `.lane` — app.js:2790 · cabecera `.lanehdr` — app.js:2839
- `lanesTopDown`, `addLane` — app.js:2924 · `trackCreateItems` — app.js:2932 · `removeLane` — app.js:2936
- `defLanes` — app.js:7909 · `ensureVideoLanes` — app.js:9905
- Sala: `createRoomSequences`/`newRoomProject`/`migrateRoomFloor` — app.js:~8476-8622
- `drawRoomStrip`/`drawRoomGrid2D` (overlay 2D, rótulo FLOOR) — app.js:1717-1755
- `renderRoom3D`/`buildRoomGeo` (NO tocar) — app.js:1081-1300 · export piso `addFloorJob` — app.js:7866
- Stage/canvas: `#stage`, `glc`/`gridc` — app.js:180 · `resize()` — app.js:1903 · `render()` 2D room path
- Tinte de audio a espejar para piso: CSS `.lane.aud`/`.lanehdr.aud` (`--audio-tint`) en index.html

## Staging (cada etapa: `node --check` + commit; CDP al cerrar 2 y 3; deploy al final)

### Etapa 1 — Modelo de pista + colocación por superficie (sin partir el visor todavía)
- `lane.surf` nuevo; `defLanes`/creación de sala siembra muros (`surf:'wall'`) + grupo de piso (`surf:'floor'`).
- Timeline: pistas de piso agrupadas abajo, tinte + rótulo "FLOOR" (clases `.lane.floor`/`.lanehdr.floor`).
  `trackCreateItems` en sala: "New wall track" / "New floor track".
- Colocación por superficie en `drawClipFlat` (fórmula de arriba) + scissor; **eliminar fold-wrap**; seam wrap
  sólo en muros. `serMedia`/`loadProject` persisten `surf`. Migración de salas viejas: inferir piso por región `y`
  o marcar el grupo de piso existente. `_demoBuildRoom`: piso en pista de piso.
- **Verificar (CDP):** clip de muro cruza la costura y reaparece; clip de piso queda en el piso y NO invade muros;
  3D y export siguen bien.

### Etapa 2 — Visor 2D partido (muros | piso) lado a lado
- Partir el `#stage` en dos paneles en modo sala-2D; cada panel bli­tea su región de `glc`. Divisor vertical
  arrastrable (persistir proporción). Toggle de piso en la `.vptool` (ocultar piso → muros a ancho completo).
- Hit-testing del puntero por panel → superficie correcta (drag de clip, edición de máscara, pan/zoom).
- **Verificar (CDP):** arrastrar clip en el panel de piso lo mueve en el piso; en muros, en los muros; toggle y
  resize funcionan.

### Etapa 3 — Pulido + deploy
- Overlays (grilla/rótulos) por panel; ventana emergente de visor respeta el modo; export sin cambios.
- Deploy a las 3 instalaciones + push (skill `/deploy`).

## 📍 Estado / Handoff 2026-07-30 (para continuar en otra máquina — p. ej. Mac)
> La memoria de Claude es LOCAL a la cuenta/máquina; esta nota vive en el repo a propósito, para que cualquier sesión
> nueva (otra cuenta con acceso a este GitHub) retome sin perder contexto. Nada de esto está verificado por CDP aún.

**HECHO (código, `node --check` limpio) — sin commitear todavía cuando se escribió esto → se commitea junto con esta nota:**
- Arreglos sueltos: iconos de los demos en el landing (2D=`view2d`, 360=`grid`), locator ~3px más arriba
  (`drawRuler`), y verificado en fuente que el demo lanza el recorrido completo (`startDemoProject`→`tourTrasCrear(fmt,true)`).
- **360 · Etapa 1** COMPLETA en código:
  - *Colocación por superficie* (núcleo WebGL): `flatPlace(c,m,t,aOv)` acepta aspecto de superficie y devuelve `Fx/Fy`;
    nuevos `clipSurfaceRect(c)` y `surfaceScissorRect(SR)`; `drawClipFlat` remapea+scissorea el clip a su muro/piso
    según `lane.surf`. **Seam wrap** de muros mantenido; **fold-wrap R222 eliminado del render** (la llamada a
    `roomFold()` ya no existe; `computeRoomFold`/`roomFold` quedaron como CÓDIGO MUERTO → archivar en Etapa 3).
  - *Modelo*: `roomDefLanes(walls,hasFloor)` siembra `[Audio, Floor1, Floor2, Wall1..4]`; `createRoomSequences` lo usa.
  - *Timeline*: pistas de piso con clase `.floor` (fila+cabecera), tinte `--floor-tint` en index.html + badge "FLOOR".
  - *Creación de pistas*: en sala, `trackCreateItems`→ "New wall/floor track"; `addLane(kind,surf)` inserta el piso
    entre audio y muros con reindexado de clips.
  - *Demo*: `_demoBuildRoom`/`_demoRoomPos` reescritos a coords relativas a superficie; resuelven muros/piso por `surf`.
  - *Serialización*: NO requiere cambios (las lanes se serializan como objetos completos → `surf` viaja solo).
  - *Legacy*: salas `.isp` viejas SIN `surf` mantienen colocación clásica de lienzo entero (seguro); `migrateRoomFloor`
    a propósito NO etiqueta `surf:'floor'` (sus coords son del lienzo entero). Sólo salas NUEVAS usan el modelo nuevo.

**NO HECHO / PRÓXIMO:**
1. **Verificar Etapa 1 por CDP** (quedó a mitad). Harness listo: `scratchpad/r229-verify.mjs` (en Mac, cambiar la
   constante `SHOTS` a un path local). Pasos: matar instancias → `npx electron . --remote-debugging-port=9222` →
   `node scratchpad/r229-verify.mjs`. Comprobar: clip de muro cruza la costura y reaparece al otro lado; clip de piso
   queda en el piso y NO invade muros; el demo de sala se ve bien; 3D y export siguen OK; `__errs` vacío.
2. **Etapa 2** — visor 2D partido muros|piso lado a lado (divisor arrastrable, toggle de piso, hit-testing por panel).
3. **Etapa 3** — archivar `computeRoomFold`/`roomFold` (+vars `_roomFold`/`_roomFoldSeq`) en `_backup/deprecated/`,
   pulir overlays por panel, y **deploy**.

**Recordatorio de plataforma (Mac):** build = `npm run dist:mac` (ver `docs/MACOS.md`); el deploy a las 3 rutas de
Windows NO aplica; dev/CDP = `npm start` o `npx electron .`. `node --check app.js && node --check main.js` para lint.

## Riesgos
- La colocación por superficie es WebGL delicado → verificar por píxeles en el `.exe` (no basta `node --check`).
- El puntero del visor asume un solo mapeo lienzo↔pantalla; partir en dos paneles toca todo el hit-testing 2D.
- Migración: no romper salas `.isp` ya guardadas (R221 merged).
