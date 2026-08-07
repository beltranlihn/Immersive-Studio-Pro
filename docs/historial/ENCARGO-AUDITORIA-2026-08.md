# Encargo de auditoría — Immersive Studio Pro · agosto 2026

> **Para el auditor.** Este documento es el encargo completo: no hace falta ningún contexto previo de chat.
> Lo escribe el desarrollador que hizo los cambios que vas a auditar (rondas R223→R241), así que léelo como
> lo que es: **la declaración del autor sobre dónde cree que puede haberse equivocado**. Desconfía de ella
> con criterio; si algo que doy por bueno no lo está, ese es justamente el hallazgo que más vale.

---

## 1. Qué es esto

Editor de vídeo **inmersivo** (domo fulldome 180° · 2D · sala 360) de Alma Digital Studio. App de escritorio
**Electron sin build step**: `index.html` carga `mp4-muxer.min.js` y `app.js` con `<script>`. Un único
**`app.js` de ~11.800 líneas** (motor WebGL2 + línea de tiempo + export WebCodecs) corre en el *renderer*;
`main.js` (445 líneas) sólo da diálogos nativos y disco vía `preload.js`.

**Lee primero `CLAUDE.md`** en la raíz: es el contrato del proyecto (convenciones, comandos, gotchas).

### Cómo orientarte sin quemar tiempo

El código no tiene estructura de carpetas, así que la estructura vive en documentos:

| Documento | Qué es |
|---|---|
| `COMPONENTS.md` | **Inventario de referencia.** Cada componente con `archivo · función` / `#domId`, estado y ticket. Es «la estructura de carpetas» que el código no tiene. Empieza por su índice maestro. |
| `ARCHITECTURE.md` | Cómo funciona: render, flujos, conceptos transversales, riesgos. |
| `docs/adr/` | **Por qué.** Decisiones inmutables, con sus consecuencias asumidas. `docs/adr/README.md` es el índice. |
| `PLAN.md` | Bitácora por rondas, lo más nuevo arriba. Cada ronda explica qué se cambió y por qué. |
| `docs/NEXT.md` | Cola de trabajo. **Hoy está vacía de accionables** — de ahí que toque auditar. |
| `AUDITORIA-2026-07.md` | La auditoría anterior (29 de julio) con su plan de 4 etapas, **todas ejecutadas**. |

---

## 2. Alcance: el delta, no otra vez todo

Desde la auditoría del 29 de julio han entrado **35 commits / ~30 rondas** (R223→R241). Esa auditoría cerró
sus cuatro etapas y su lista de verificación; **rehacer su recorrido completo gastaría muchísimo para
redescubrir lo ya arreglado**.

**El encargo es:**

- **(a) El delta R223→R241** — todo lo que ha cambiado desde entonces.
- **(b) Lo que nunca se ha auditado** (§5).
- **(c) La deuda que julio dejó explícitamente diferida** y sigue viva (§4.4).

**Fuera de alcance:** volver a recorrer lo que `AUDITORIA-2026-07.md` ya cerró, salvo que sospeches una
regresión concreta.

### Qué cambió en el delta, en una línea cada uno

`R223` timeline core + clips enlazados · `R224` automatización unificada · `R225` inspector/adjustment/nest ·
`R226` máscara en el lienzo + ventana solo-visor · `R227` tour y demos · `R229-R231` visor 360 por superficies,
visor 2D partido muros|piso · `R232-R234` solver de la planta de la sala, reorden de muros, arrastre ·
`R235-R236` paneo y tamaño del composite · **`R237` el composite máster deja de ser cuadrado** ·
`R238` deuda del solver · `R239` cuatro ajustes de uso diario · `R240` pasada de QA + zoom al abrir ·
`R241` prueba de estrés con material real.

---

## 3. Método esperado

### Verificación en la app REAL, no sólo lectura

El patrón del repo es **CDP sobre el `.exe` desplegado**:

```bash
"C:\Users\beltr\AppData\Local\Programs\Immersive Studio Pro\Immersive Studio Pro.exe" --remote-debugging-port=9222
```

y evaluar por WebSocket (`Runtime.evaluate`). Hay decenas de sondas de ejemplo en `scratchpad/*.mjs`; las de
`r241-*.mjs` son las más recientes y sirven de plantilla.

**Importante:** mide sobre el **`.exe`**, no sobre `npx electron .`. Confirma con
`WEBGL_debug_renderer_info` que estás en la **RTX 4060** y no en la Intel integrada — una medida de
rendimiento sobre la GPU equivocada no vale nada. `scratchpad/gpu-check.mjs` lo comprueba en un comando.

Antes de nada: `node --check app.js && node --check main.js`.

### Trampas del arnés que ya me costaron falsos hallazgos

Te las paso porque son exactamente donde tropecé y perderías el mismo tiempo:

1. **`performance.now()` en Electron tiene granularidad reducida.** Medir un solo `render()` da `0,00 ms` y
   parece que no dibuja. Promedia **cientos** de iteraciones en un solo cronometraje.
2. **`⇧⌘E` abre la hoja de export y su guard (`#exOv`) deja la app SORDA a todo atajo posterior.** Si barres
   atajos, limpia `.overlay, #palOv, #exOv, .exs-scrim` entre bloques o medirás una app que no escucha.
3. **`trimItem(it,edge,delta)` espera el ITEM del arrastre** (`{id,start0,dur0,inP0,kf0,anim0}`), no el clip,
   y su borde es `'L'`/`'R'` **en mayúscula**. Pasarle el clip produce `NaN` que parece un bug del programa.
4. **El camino de selección por teclado depende de `:focus-visible`**, que un script no puede forzar. Usa
   `pointerdown`/`pointerup` reales.
5. **Cuidado con los backticks** dentro de plantillas de JS al escribir sondas: cierran el template.
6. Un número imposible **casi siempre es el arnés**, no la app. Para y diagnostica antes de reportarlo.

### Reglas del proyecto que hay que respetar

- **Idioma:** chat y comentarios en **castellano neutro — prohibido el voseo**. La **UI del software va en
  inglés** (con `T('EN','ES')` para strings nuevos); botones en infinitivo.
- **Archivar, no borrar (ADR-0007):** el código muerto que se retire va **verbatim** a `_backup/deprecated/`
  con su encabezado y su fila en el índice, nunca al cubo.
- **Anti-pudrición:** si tocas un componente, actualiza su fila en `COMPONENTS.md` **en el mismo commit**.
- **No toques el material de Beltrán.** Los clips de prueba (§6) se pueden usar y se pueden generar proxies,
  **pero no se borran**. Su proyecto se abre sobre una copia en memoria; no guardes encima.

### Gotchas del motor (no «arreglar» esto)

- **Handedness 2D↔3D:** hay **UNA** inversión intencional (`u_flipx=-1` en el domo). Tocar `cameraMVP` o la
  malla la duplica. Ver `docs/adr/adr-0004-handedness.md`.
- **GPU híbrida:** NO añadir flags Chromium agresivos (`ignore-gpu-blocklist`, zero-copy) — ponen el 3D negro.
- **Electron no soporta `prompt/alert/confirm`** → `appPrompt/appAlert/appConfirm`.
- Tras editar código hay que `npm run dist` para que el `.exe` empaquetado tome los cambios.

---

## 4. Zonas de riesgo, por prioridad

### 4.1 · Las DOS convenciones del composite — **máxima prioridad**

Lee `docs/adr/adr-0010-composite-relleno-vs-letterbox.md` antes de tocar nada aquí.

En R237 el composite máster dejó de ser cuadrado: pasa a `compW×compH` con la forma del lienzo y el contenido
lo **rellena** (`u,v = 0..1`). Pero **export, NDI, Spout y el caché de nests siguen en cuadrado con letterbox**,
porque el `_ncSquare` de R180 depende de esa forma. Conviven dos convenciones a propósito, con **dos parejas
de funciones de límite de muestreo** que no se pueden mezclar:

| Convención | Quién la usa | Límites |
|---|---|---|
| Relleno | el máster de previsualización | `mstrContentLim` / `mstrLimForRect` |
| Cuadrado con letterbox | export, NDI, Spout, caché de nests | `compContentLim` / `compLimForRect` |

**Lo que quiero que verifiques:**
- ¿Hay algún sitio que use la pareja equivocada? Un error aquí es **silencioso**: da contenido repetido en el
  borde o una franja negra, que es exactamente la fisura que costó las rondas R233 y R233b.
- ¿Algún consumidor del máster que yo no haya convertido? Busca todo lo que lea `compTex`/`compFBO`.
- El viewport de relleno se **expande** (`compFillVp`). ¿Queda algún cálculo que dé por hecho un viewport
  cuadrado anclado en el origen? Yo encontré tres (`surfaceScissorRect`, `roomWallScissorRects`,
  `buildRoomGeo`) y los pasé por `_ndcToVp()`. **Sospecho que puede quedar alguno.**
- El tope pasó de ser un lado (`COMP_MAX=8192`) a ser memoria (`COMP_MAXTEXELS=8192²`). ¿Aguanta los casos
  extremos de forma (una tira larguísima, un lienzo casi cuadrado, el clamp de `GL_MAXSIDE`)?

### 4.2 · El encuadre por secuencia (R239) — **alta**

`nestScrollT` guarda el encuadre horizontal de la línea de tiempo por secuencia, en segundos.
`setTlScrollT()` debe correr **después** de `renderTimeline` y usa el truco de `_scrollTarget`.

**Confesión útil:** lo enganché a cuatro caminos y **se me escaparon otros cuatro** (`newSequenceDialog` y su
variante de sala, `deleteSequenceMedia`, `newRoomProject`) — los cazó una revisión posterior. La regla es:
**secuencia nueva → `setTlScrollT(0)`; aterrizar en una existente → su `nestScrollT`.**

**Verifica que no queda ningún quinto camino.** Busca todo lo que llame a `loadSeqIntoState`.

### 4.3 · Estado que se hereda entre proyectos — **alta**

Esta familia de bug ha aparecido **tres veces** en el delta, siempre igual: algo que vive fuera de `state`
—o que no se resetea al cargar— sobrevive al cambio de proyecto o de secuencia.

Casos ya arreglados: el scroll de la línea de tiempo (R239), el zoom `pxPerSec` al abrir un `.isp` sin él
(R240b), el encuadre en `newRoomProject` (R239b).

**Barre `loadProject` y `newProject` buscando el cuarto caso.** Todo lo que se lea del archivo con
`if(obj.X)` en vez de asignar siempre es sospechoso: si el campo falta, se hereda el valor anterior.

### 4.4 · Deuda que julio dejó diferida y sigue viva — **media**

De `AUDITORIA-2026-07.md`, sección «Diferido»:
- Refactors grandes: **`openExport`**, **`_renderInspectorMain`**, **`bindAutoCurve`** (se dijo «sólo al
  volver a tocarlos» — desde entonces se han tocado varias veces).
- **Migración centralizada de `.isp`**: hoy cada campo nuevo se migra a mano en `loadProject`. Con `nestScrollT`
  (R239) el patrón ha crecido otra vez.
- **Interfaz de la cola de export**: sigue sin existir. Ojo: **[D2] (el encoder en segundo plano) fue RETIRADO
  por decisión de Beltrán** el 2026-08-04, pero la *interfaz* de la cola es otra cosa y sigue viva.

### 4.5 · Rendimiento — **media, con línea base**

R241 dejó números medidos con material real sobre la RTX 4060 (§6). **Úsalos como referencia**, no midas a
ciegas:

| Escenario | Medido en R241 |
|---|---|
| 4 capas de 7196×912, GPU por `render()` | 0,05–0,07 ms |
| 4 capas, reproducción | 60,2 fps · mediana 16,6 ms · P95 19,7 ms |
| Scrub 4 capas **sin** proxy | mediana **1148 ms**, peor 2256 |
| Scrub 4 capas **con** proxy | mediana **8 ms**, peor 9 |
| Composite Full / ½ / ¼ | 25 MB / 6,3 / 1,6 |

El cuello conocido es el **reposicionamiento del decodificador HEVC**, no el motor. Si encuentras una vía para
mejorar el scrub sin proxy, es el hallazgo de mayor valor práctico para el usuario.

Zonas de fugas que conviene re-verificar tras 30 rondas: texturas de máscara y de curvas, `_vinst` (pool de
decodificadores por clip), `_fxHist`, `_nestPool`, `_lutReg`.

---

## 5. Lo que no se ha auditado NUNCA

1. **El empaquetado tras el rename** a «Immersive Studio Pro» (`.isp`, appId
   `com.almadigitalstudio.immersivestudiopro`). Hay **tres** instalaciones conviviendo (una canónica y dos
   legacy «Dome Studio Pro») y el deploy copia el `app.asar` a las tres a mano. `package.json › build.files`
   es una **lista explícita**: un archivo de arranque nuevo que no se añada ahí no falla en dev, **falla sólo
   en el `.exe`** (ver `docs/adr/adr-0009`).
2. **La rama macOS** (`docs/MACOS.md`, `npm run dist:mac`). **Nadie la ha ejecutado nunca.** Los addons
   nativos (NDI/Spout) son `optionalDependencies` marcadas `os: win32`. Revisión **estática**: ¿qué se
   rompería? No hay Mac disponible para probarlo.
3. **`main.js` y `preload.js` a fondo** (445 + N líneas): superficie IPC, validación de rutas, qué puede pedir
   el renderer al proceso principal.
4. **Los `.isp` legacy**: el formato va por la v4 y se abren `.isp`/`.ise`/`.rdome`. ¿Se abre de verdad un
   archivo viejo, o hay migraciones que nadie ejerce?

---

## 6. Material de prueba disponible

- **Proyecto de sala real:** `C:\Users\beltr\Desktop\Rito Movie\360\Rito360.isp`
  (sala 7196×912, 4 muros, sin piso, 60 fps). Es de prueba: se puede modificar, pero mejor sobre copia.
- **Clips pesados:** `C:\Users\beltr\Desktop\Alma Digital Studio\Studio\Reel 360\Edit Reel 360\Neurocosm 360`
  — nueve `Neuro*_7196.mp4`, **HEVC 7196×912 @60 fps, hasta 410 Mbps**, ~3 GB en total. Ya tienen proxy
  generado a 60/1. **Se pueden usar y re-proxyficar; NO se borran.**
- `scratchpad/r241-*.mjs` son las sondas de la prueba de estrés: sirven de plantilla.

---

## 7. Qué entregar

Mismo formato que `AUDITORIA-2026-07.md`, que funcionó bien:

1. **Informe por áreas** — código (correctness, rendimiento/fugas, estructura), lado Electron, usabilidad
   realista, UX/UI. Cada hallazgo con **archivo:línea**, por qué importa y **cómo se reproduce**.
2. **Plan priorizado por etapas**, con este criterio: primero lo que **puede corromper datos o un export en
   producción**; después el rendimiento que se siente; después robustez; al final deuda y limpieza. Cada etapa
   debe ser **un commit verificable**.
3. **Decisiones para Beltrán** — lo que no se ejecuta sin su visto bueno, con las opciones y su coste.
4. **Diferido**, con la razón explícita de por qué no bloquea.

**Distingue siempre lo verificado de lo sospechado.** Un hallazgo reproducido con una sonda vale diez
señalados de oído; si algo es una corazonada, dilo así.

## 8. Contexto de negocio

Esto se usa en **producción con clientes**, en instalaciones de domo y salas 360. El fallo caro no es una
interfaz fea: es **un export corrupto la noche antes de un montaje**, o un proyecto que no abre. Prioriza con
esa vara.
