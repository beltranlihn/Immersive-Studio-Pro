# AUDITORÍA 2026-08c — Revisión general del proyecto (código · arquitectura · herramientas · UX)

> **Encargo de Beltrán (2026-08-07):** revisar el proyecto entero como desarrollador senior externo — si está
> bien planteado, estructurado y construido; qué herramientas sobran o faltan; deficiencias y errores; qué
> decisiones de UI/UX se pueden tomar mejor — con la mira puesta en un software profesional de alta calidad.
>
> **Método:** lectura completa de la documentación (README, ARCHITECTURE, ESTRUCTURA-DEL-CODIGO, CLAUDE,
> NEXT, índice de COMPONENTS, ADRs, cabeceras de auditorías previas), lectura completa de `main.js`,
> `preload.js` y `package.json`, lectura por muestreo de `app.js` (arranque/estado, shaders, render,
> replaceMedia/reconciliación, undo/meta, autosave/recuperación) e `index.html` (tokens de diseño), y prueba
> de la app en marcha por CDP (landing → demo domo → editor 2D/3D → panel de export, con capturas).
> Este informe **evita repetir** lo ya cazado por las auditorías R94/R102/Rev1/2026-07/2026-08/2026-08b.

---

## 0 · Veredicto ejecutivo

**El proyecto está bien planteado y notablemente bien construido para lo que es hoy: una herramienta
profesional de un solo usuario, desarrollada por una persona + IA.** Tres cosas están muy por encima de la
media de la industria: (1) la **disciplina de documentación** (ADRs, mapa vivo, bitácora con mediciones — la
mayoría de los equipos profesionales no tiene nada así), (2) la **cultura de verificación medida** (sondas
CDP, medianas A/B, PSNR por píxeles, deploy con verificación de sha1), y (3) la **arquitectura de render de
un único máster compuesto** (visor = NDI/Spout = export por el mismo camino: por eso lo que se ve es lo que
sale, sin segunda ruta que desincronizar).

Las debilidades no son de calidad de código sino de **forma y de escalabilidad del proceso**: un monolito de
14 500 líneas sin módulos, el binding manual estado→pantalla (reconocido como "la clase de bug #1"), la
ausencia de una suite de regresión que corra sin la app levantada, y una serie de huecos de "producto
distribuible" (firma de código, auto-update, licencias de terceros) que hoy no duelen porque el único usuario
es el autor, pero que son la lista exacta de lo que separa esto de un software comercial.

**Recomendación de fondo:** no hay nada que "rehacer". Hay que **consolidar** (partir el monolito de forma
mecánica, extraer lo puro a testeable, cerrar 4 bugs menores encontrados) y, si algún día se distribuye,
ejecutar la sección 6.

---

## 1 · Lo que está bien y NO hay que tocar

| Qué | Por qué es correcto |
|---|---|
| **Un único máster compuesto** (FBO → visor/NDI/Spout/export) | Elimina de raíz la clase de bug "el export no coincide con el visor". Es la decisión arquitectónica más valiosa del proyecto. |
| **Secuencia = media `kind:'nest'`** | Un solo mecanismo da pestañas, anidado y composes generativos. Elegante y barato de mantener. |
| **`main.js`** | Escritura atómica con fsync+rename, contrapresión real en el puente FFmpeg, guardias de crash/unresponsive con anti-apilado, single-instance, powerSaveBlocker con contador de referencias, allowlist estricta en `openExternal`, cierre de FileHandles huérfanos al morir el renderer. Es un proceso main **mejor** que el de muchas apps Electron comerciales. |
| **Postura de seguridad Electron** | `contextIsolation` on, `nodeIntegration` off, puente congelado por `contextBridge`, popup del visor sin preload (no puede tocar IPC), `setWindowOpenHandler` que deniega todo lo demás. Correcta para una app local sin contenido remoto. |
| **Sistema de diseño medido** (R102/Rev1) | Tokens con fuente citada, contraste por APCA y no solo WCAG, presupuesto de acentos escrito en el propio CSS. La UI resultante se ve profesional — lo confirmé en las capturas de esta sesión. |
| **ADRs + marcas `[R###]`** | El "porqué" de cada línea es rastreable. Esto es lo que hace revisable el monolito. |
| **Robustez de datos** | Autosave a disco cada 15 s + historial de snapshots + oferta de recuperación + `.bak` al guardar + proxies con escritura atómica y auto-sanado + `resetProjDefaults()` en los tres caminos de carga. La historia de "no perder trabajo" está muy completa. |
| **Sin dependencias npm de runtime** | Superficie de ataque y de rotura mínima. `mp4-muxer` vendorizado y addons propios como deps `file:` opcionales es la forma correcta de hacerlo aquí. |
| **Archivar, no borrar** (ADR-0007) | Con `_backup/deprecated/` fechado. Bien. |

---

## 2 · Estructura del código — el punto flaco real

### 2.1 · El monolito `app.js` (14 500 líneas) — ALTA, pero ejecutable en frío

Es el riesgo estructural número uno, y los propios docs lo reconocen. Lo importante: **ADR-0001 ("sin build
step") no obliga a un solo archivo.** Se puede partir en 10–15 ficheros cargados con varias etiquetas
`<script>` en orden (o `<script type="module">` nativo), sin bundler, sin transpilación, sin tocar el ADR.
Los cortes ya están decididos: son exactamente los tramos de la tabla de `ESTRUCTURA-DEL-CODIGO.md` §4
(estado/GL/render/timeline/inspector/export/serialización/…).

- **Por qué ahora sí:** COMPONENTS.md funciona como "estructura de carpetas" para un dev+Claude, pero no
  escala a un segundo colaborador ni a revisión externa (diffs enormes, conflictos de merge imposibles,
  imposible proteger un subsistema). El propio encargo de "entregar el repositorio a revisión" (R308/R309)
  apunta a que eso viene.
- **Cómo, sin riesgo:** partición **mecánica** (cortar y pegar por tramos, cero refactor semántico), en una
  ronda propia, verificada con `node --check` por fichero + las sondas de humo + comparación de píxeles de un
  proyecto de referencia. Con `<script>` clásicos el ámbito compartido se conserva tal cual (las ~1 400
  declaraciones top-level siguen viéndose entre sí), así que el riesgo es casi nulo.
- **Mismo tratamiento para `index.html`:** las ~1 500 líneas de CSS inline → `app.css` con `<link>`. Cero
  build, y el CSS pasa a tener diff propio.

### 2.2 · Binding manual estado→pantalla — la clase de bug #1, mitigable sin framework

No hay que meter React ni un store reactivo (el ADR-0001 y el rendimiento lo desaconsejan). Pero sí se puede
**estrechar la puerta**: hoy cualquier función muta `state` y debe acordarse de llamar 1–4 repintados.

- **Propuesta mínima:** un `commit({tl,insp,media,gl})` único que coalesce por rAF (el patrón ya existe:
  `scheduleTimeline()`); regla de estilo "ninguna función llama a dos `renderX()` seguidos — llama a
  `commit`". Convierte el olvido de un repintado de "bug silencioso" a "grep-able".
- **Barato y valioso:** una sonda de invariantes (`smoke.mjs` ampliada) que tras cada gesto simulado compare
  un hash del DOM/estado contra lo esperado — detectaría los olvidos de re-render que hoy solo se ven a ojo.

### 2.3 · Undo por snapshot completo — vigilar, no rehacer

Ya identificado en ARCHITECTURE §9, con tope de 250 MB y pilas por secuencia. El parche R253d (versionado de
metadatos con dueño y marca de agua) es ingenioso pero es **complejidad síntoma**: el día que el undo dé más
problemas, la salida de fondo es command-pattern por gesto (cada mutador registra su inverso), no más
contadores. No urge; queda anotado como dirección.

### 2.4 · Menores de higiene

- **352 `catch` vacíos**: la mayoría son deliberados (estilo defensivo documentado). Recomendación: en los
  caminos de DATOS (carga/guardado/migraciones) que hoy tragan en silencio, rutear a `diag('warn',…)` — ya
  se hace en muchos; completar el barrido.
- **`scratchpad/`**: conviven 553 sondas (valiosas, versionadas) con ~80 `.log`, `.bak`, `.json` de volcado y
  fixtures `.isp`. Separar: `scratchpad/` solo sondas; volcados y logs a una carpeta ignorada por git (el
  README ya dice que no se versionan — hacer que sea verdad por `.gitignore`, no por costumbre).
- **PDF duplicado en la raíz**: `Immersive Studio Pro - User Manual.pdf` está sin versionar en la raíz y su
  copia canónica vive en `docs/`. Borrar la de la raíz (rompe la regla de higiene R309).

---

## 3 · Bugs y defectos concretos encontrados en esta revisión

Cuatro reales, ninguno grave; los dos primeros valen la pena ya.

1. **`main.js · dsp:ffWrite` — el drain compartido se pisa** (`main.js:448-456`). El comentario promete "una
   sola promesa de drain compartida", pero la implementación **reemplaza** el resolver: si alguna vez hay dos
   `ffWrite` en vuelo con el buffer lleno, el primero queda colgado hasta su timeout de 30 s (su `res` se
   pierde al ser sobrescrito `st.drenando`). Hoy no muerde porque el renderer serializa los writes — es
   exactamente la clase de "nos protege una casualidad" que NEXT.md ya sabe cazar. Arreglo: array de
   resolvers (`st.drenando=[]`, el drain los vacía todos). De paso, la línea
   `if (!st.drenando) st.drenando = null;` es un no-op muerto.

2. **`preload.js · toFileURL` no escapa `%`** (`preload.js:127-133`). `encodeURI` deja `%` tal cual: un medio
   llamado `render 50%.mp4` (nombre típico de descarga) produce una URL con escape inválido y el medio no
   carga, sin mensaje claro. Escapar `%` **antes** de `encodeURI` (`.replace(/%/g,'%25')`).

3. **Guardar ofrece extensiones legacy** (`main.js:301-308`): el diálogo de guardado filtra
   `['isp','ise','rdome']`, así que se puede *escribir* un proyecto nuevo con extensión muerta. Leer los tres
   es correcto; guardar debería ofrecer solo `.isp`.

4. **Media panel · la miniatura de un medio TEXT desborda su tile** (visto en la captura de esta sesión: el
   rótulo "IMMERSIVE" pinta encima del borde del tile y pisa la insignia de duración). Cosmético, pero es lo
   primero que se ve al abrir el demo.

**Además, dos incoherencias de documentación** (importan porque la doc es el mapa):
- `ARCHITECTURE.md` §2 dice "Sin FFmpeg en runtime → solo códecs de Chromium", pero desde R288 existe el
  puente FFmpeg (`vendor/ffmpeg`, `dsp:ff*`) y es el camino canónico de 4096². Actualizar §2/§6 y ADR-0002
  con el estado real: *FFmpeg opcional, empaquetado, para el export; nunca para playback*.
- `CLAUDE.md` y ARCHITECTURE siguen diciendo "app.js ~5000 líneas"; son 14 500. Detalle, pero es la primera
  cifra que lee un revisor.

---

## 4 · Herramientas y stack — qué está bien, qué sobra, qué falta

### Bien elegidas (mantener)
- **Electron + WebGL2 + WebCodecs + mp4-muxer**: para un NLE de nicho con salida NDI/Spout, es un stack
  razonable y ya amortizado. Cambiarlo no compra nada.
- **Sondas CDP como verificación**: pragmáticas y honestas (miden sobre el `.exe` real y la RTX). Mantener.
- **`deploy-verificado.ps1`** con sha1: correcto.
- **Addons nativos propios (NDI/Spout)** como deps `file:` opcionales `os:win32`: correcto.

### Sobra / simplificar
- **Las dos instalaciones legacy "Dome Studio Pro"**: el deploy mantiene 3 rutas por historia. Decidir de una
  vez: desinstalar las dos viejas y dejar el script en 1 ruta canónica (mitad de superficie de error del
  despliegue). Si algo aún abre por la asociación vieja, reinstalar con el NSIS lo migra.
- **Volcados/logs en `scratchpad/`** (ver §2.4).
- **Extensión `.ise`/`.rdome` en el diálogo de GUARDAR** (ver §3.3).

### Falta (por orden de valor)
1. **Una suite de regresión que corra sin la app.** Las sondas exigen app levantada y son de una ronda; no
   hay nada que un `git commit` pueda correr en 5 s. Lo puro ya existe y está identificado: `evalP`/easing,
   el solver de la sala (¡28 561 combinaciones ya barridas una vez — eso ES un test, solo que se tiró!),
   `parseCubeLUT`, `compLayout`/`weaveLayout`, serialización + migraciones (`serProject`/`loadProject` con
   fixtures `.isp` viejos, que ya existen en scratchpad), `reconciliarDuracion`, `f2azel`/`azel2f` (ida y
   vuelta). **Propuesta:** extraerlas a un fichero cargado tanto por `index.html` como por `node --test`
   (`tests/*.test.mjs`, cero dependencias), y un hook de pre-commit que corra `node --check` + esa suite.
2. **Una suite de humo CDP "golden"**: elegir ~12 sondas existentes (arranque limpio, demo, export corto,
   guardar/abrir, undo, sala) y un runner que las corra en orden contra el `.exe`. Hoy ese conocimiento está
   disperso en 553 archivos sin índice de cuáles siguen siendo válidas.
3. **ESLint plano (sin build)**: `no-undef` + `no-unused-vars` sobre un ámbito compartido cazaría la clase de
   error "identificador huérfano tras un refactor" que las sondas solo ven en runtime. Config de 20 líneas.

---

## 5 · UI/UX — evaluación sobre la app en marcha

Contexto: la UI ya pasó por R94 (heurísticas), R102 (medición del sistema de diseño) y Rev1 (rediseño
completo). El resultado **se ve profesional de verdad** — landing, editor, export están a la altura de
herramientas comerciales. Lo que sigue son los huecos que quedan, de mayor a menor:

1. **Recent projects sin miniatura** (landing). Ocho tarjetas negras idénticas: el reconocimiento es por
   nombre, que es lo más débil. Guardar un thumbnail al guardar el proyecto (un JPEG ~320px del máster,
   dataURL dentro del `.isp` o `.png` junto al archivo) y pintarlo en la tarjeta. Es el cambio de mayor
   retorno visible de esta lista.
2. **Export · el desplegable Codec abre vacío** mientras se sondea FFmpeg/WebCodecs. Un usuario que abre y
   mira durante ese medio segundo ve un control roto. Placeholder "Detecting encoders…" deshabilitado hasta
   que el probe resuelva.
3. **Los puntos de estado del panel de medios** (verde/gris a la derecha de cada fila) no tienen leyenda ni
   tooltip inmediato. Si codifican proxy/salud, un `title` que lo diga en palabras cuesta una línea.
4. **Escala de interfaz.** El cuerpo base es 11px sobre densidad alta. Para el autor en su monitor está bien;
   para "software profesional de alta calidad" (y monitores 4K con escalado raro, o proyecciones en cabina
   oscura) falta un ajuste de zoom de UI (Ctrl+± sobre `webFrame.setZoomFactor` — 10 líneas, y es lo que
   hacen Premiere/Resolve). Nota: los tokens de espaciado ya son variables, así que envejecerá bien.
5. **Accesibilidad mínima**: la app es 100 % ratón+atajos. Sin llegar a WCAG completo: foco visible en los
   controles del inspector y navegación por teclado en los diálogos (Tab entre botones de un modal) es el
   80/20. Los modales propios (`appConfirm`) ya centran bien el patrón.
6. **Onboarding**: el tour desde Demos existe y está cableado — bien. Lo que no hay es ayuda contextual
   *dentro* del trabajo (p. ej. primer uso de la sala 360: el diálogo de geometría es potente pero denso).
   Un enlace "¿cómo se mide esto?" al PDF (que ya existe, ¡73 páginas!) en los 2–3 diálogos densos cerraría
   el círculo con lo ya escrito.
7. **Decisiones que otros cuestionarían y yo NO tocaría:** colores de pista fijos por función (R231 — más
   legible que el color libre), proxies manuales (ADR-0003 — correcto para material de 400 Mbps), solape =
   corte estilo Ableton (R223 — decisión de modelo, documentada), automatización una-curva-por-pista (A5 —
   mantiene el timeline legible).

---

## 6 · La distancia a "producto distribuible"

Hoy nada de esto duele (un usuario, una máquina). Es la lista exacta para el día que se venda o regale:

| Hueco | Qué implica |
|---|---|
| **Firma de código** | Sin firma, SmartScreen bloquea el instalador en cualquier PC ajeno. Windows: certificado OV/EV o Azure Trusted Signing. macOS: Developer ID + notarización (el `identity:null` actual está bien SOLO para uso propio, como ya documenta package.json). |
| **Licencias de terceros** | ⚠️ La más seria: el binario FFmpeg empaquetado — según cómo esté compilado es **GPL** (obliga a liberar fuentes o cambiar a build LGPL sin componentes GPL). Revisar también: NDI SDK (marca y redistribución), SpoutDX (BSD, ok), mp4-muxer (MIT, ok), fuentes Geist/Inter (OFL, ok). Falta un `THIRD-PARTY-LICENSES` generado. |
| **Auto-update** | electron-updater + un feed (GitHub Releases basta). Sin esto, cada usuario queda clavado en su versión. |
| **Versionado real** | Todo es 1.0.0 + fecha de build por mtime. Adoptar semver por release y un CHANGELOG (destilable de PLAN.md, que ya es mejor que el changelog de casi cualquiera). |
| **Crash reporting opt-in** | El diag log local es excelente para uno; para terceros, `crashReporter` de Electron o al menos un botón "enviar diagnóstico". |
| **Hardware ajeno** | Todo está medido sobre UNA RTX 4060 + un Mac. Los topes de códec ya se sondean en runtime (bien), pero el forzado de GPU por registro y los umbrales de composite necesitarían una pasada en 2–3 GPUs más. |

---

## 7 · Plan priorizado

**P0 — esta semana, horas:**
1. Fix `ffWrite` drain + línea muerta (§3.1). 2. Fix `toFileURL` con `%` (§3.2). 3. Guardar solo `.isp`
(§3.3). 4. Tile de TEXT en media panel (§3.4). 5. Borrar el PDF duplicado de la raíz; `.gitignore` para
volcados de scratchpad. 6. Actualizar ARCHITECTURE/ADR-0002 (FFmpeg) y la cifra de líneas en CLAUDE.md.

**P1 — próximas 2–4 rondas, el fondo:**
7. Partición mecánica de `app.js` en ficheros por tramo + CSS a `app.css` (§2.1) — ronda propia, verificación
por píxeles. 8. Suite de tests puros con `node --test` + pre-commit (§4-falta-1). 9. Suite de humo CDP
"golden" con runner (§4-falta-2). 10. `commit()` coalescido para el binding manual (§2.2). 11. Thumbnails en
Recent projects (§5.1). 12. Placeholder del probe de codecs (§5.2) + tooltips de estado de medios (§5.3).

**P2 — cuando toque:**
13. Zoom de UI (§5.4) y foco/Tab en modales (§5.5). 14. Retirar las 2 instalaciones legacy y simplificar el
deploy (§4-sobra). 15. ESLint plano. 16. La sección 6 completa, EN ESTE ORDEN: licencias → firma → updater →
semver, solo si se decide distribuir.

---
---

# PARTE 2 — Auditoría exhaustiva de `app.js`, línea por línea (2026-08-08)

> **Método:** a pedido de Beltrán, las 14 499 líneas se repartieron en **12 tramos** (los del mapa de
> `ESTRUCTURA-DEL-CODIGO.md` §4, con solape de ~30 líneas) y cada tramo lo leyó íntegro un agente auditor con
> las trampas conocidas cargadas (handedness, `hasKf`, catches deliberados, marcas `[R###]`…) y la orden de
> verificar llamadores por grep antes de marcar CONFIRMADO. Los 12 devolvieron informe; los hallazgos ALTA
> más graves los **verifiqué después directamente contra el código** (marcados ✔). Total tras deduplicar:
> **13 ALTA · ~35 MEDIA · ~25 BAJA**. Los agentes también dejaron constancia de lo que revisaron y quedó
> LIMPIO (round-trip de serialización campo por campo, clonación profunda de copiar/pegar, guardas de
> división por cero de curvas, estado GL restaurado, monotonía del muxer, Snappy, solver de sala…), que vale
> tanto como los hallazgos.

## 8 · Hallazgos ALTA (romper el trabajo o el resultado)

| # | Dónde | Qué pasa |
|---|---|---|
| **A1 ✔** | `app.js:8566` | **Todo export MP4 por FFmpeg lanzado desde la hoja muere con `ReferenceError: fn is not defined`.** La hoja pasa `outDir`, nunca `outPath`; el `\|\|` evalúa entonces una expresión que usa `fn`… que solo existe en los bloques hermanos (8539/8716/8758). Verificado: no hay `fn` en ese ámbito. Las sondas r290-r292 lo esquivan porque pasan `outPath`. |
| **A2 ✔** | `app.js:8637` | **Y si A1 se arregla solo, el MP4 saldría con un fotograma congelado:** el bucle FFmpeg llama `composite(t,eW,false)` — que **no** ata `compFBO` (verificado: `composite()` solo pone viewport; el bind lo hace siempre el llamador, como en `_renderNucleo:1714`) — y luego lee `nv12Read(compTex,…)`, una textura que nadie escribió durante el export. Dos fallos independientes que se enmascaran: A1 impide llegar a A2 desde la UI, y ninguna sonda valida los píxeles de un MP4 por FFmpeg (r291 mira metadatos, r292 rótulos). **Hace falta la pareja de arreglos + una sonda de contenido** (2 fotogramas distintos, compararlos). |
| **A3** | `app.js:8799 + 9796` | **Un export que falla se anuncia «Terminado · Guardado en el destino elegido».** El job del panel no declara `fail`: el error termina en `appAlert` + `_exportCleanup(false)` → `job.done(false)` que cuenta la pieza como exitosa (`batchDone++`). En una sala por muros, el muro fallido figura entregado. Con A1, además, es la pareja perfecta: el export FFmpeg falla siempre Y siempre dice que terminó. |
| **A4** | `app.js:8747, 8790` | Los FileHandles de HAP y MP4-streaming no se cierran si el bucle lanza excepción (el cierre está en línea recta y `_exportCleanup` no cierra handles) → en Windows el archivo a medias queda **bloqueado** (ni borrar ni re-exportar a esa ruta) hasta cerrar la app. |
| **A5 ✔** | `app.js:3178` y ~9 sitios más | **Inyección HTML:** `${m.name}`, `${c.name}`, `${lane.name}`, nombres de carpeta y mensajes de confirm se interpolan en `innerHTML` sin escapar (existen `escAttr` y `lchEsc` pero casi solo las usa el launcher). Un nombre de archivo con `<img onerror=…>` ejecuta script en el renderer **con acceso al puente DSP** (disco completo). Verificado en 3178. Arreglo: una `esc()` única + barrido de las plantillas. |
| **A6** | `app.js:2937/3002` | Una generación de proxy que **falla a mitad** deja `m.frames` parcial con `m.decConfig` puesto, y `seekMedia` los prefiere al original → scrub clampa al último fotograma codificado: **clip congelado en silencio**. Solo el camino «frozen decode» limpia; los otros tres fallos no. |
| **A7** | `app.js:13803` | **Exportar un proyecto recién abierto con FX reactivos sale sin reactividad.** `m.bands` se analiza perezosamente al abrir el panel Reactive; `runExport` ni lo espera ni lo dispara → `fxModLevel` devuelve 0 en follow/trigger y el LFO cae al BPM de emergencia con otra fase. Silencioso: el máster «se ve bien», solo que sin la modulación. |
| **A8** | `app.js:11945` | **Supr con N medios seleccionados apila N `appConfirm` y UNA pulsación de Enter los acepta todos** (los `onk` son listeners de captura sobre `document`; `stopPropagation` no frena a los hermanos del mismo nodo — hace falta `stopImmediatePropagation` o confirmación agregada). Tres medios usados en otras secuencias, Supr, Enter: borrados de golpe, irrecuperables por Ctrl+Z según el propio aviso. |
| **A9** | `app.js:6457` | Quitar el **último** keyframe con el diamante del inspector calcula el valor de congelado DESPUÉS de borrar → congela el valor estático viejo, no el de la curva; el parámetro salta en pantalla. Las tres rutas análogas (6461, 6477, 6348) lo hacen bien. |
| **A10** | `app.js:5050` | La herramienta de trim contextual **T** (roll/ripple/slip/slide) muta `inP`/`start` **sin rebasar keyframes** — el rebase que `trimItem`, `razorCore` y el crossfade sí hacen. La automatización «se descuelga del material», el defecto que el comentario de `_cutEdgeTo` declara inaceptable. Afecta también a `trimNudge` y al partner enlazado. |
| **A11 ✔** | `app.js:13151` | Un `else if(mm==='count')` quedó **tragado por el comentario `[R265]` en la misma línea física** → la fila «Cantidad» no aparece nunca en composiciones de domo (anillo/espiral/girasol/…): toda composición nueva sale con 6 elementos. Verificado a la vista. Arreglo: un salto de línea. |
| **A12 ✔** | `app.js:1242` | **El arreglo que R301c dio por cerrado sigue abierto:** la firma del tejido barajado busca el diente de sierra con `x.k==='saw'`/`x.p==='x'`, pero el esquema real es `mode`/`param` (verificado contra 825-828) → `sw` es siempre undefined, la velocidad jamás entra en la firma, y el desacople rotación/salto que R300 eliminó puede reaparecer. |
| **A13** | `app.js:10603/10674` | **File→New hereda `autoItems` y `exportPresets` del proyecto anterior** y los fija en el `.isp` nuevo — la cuarta aparición de la familia que R242 curó («heredar del proyecto anterior»): ni `newProject` ni `resetProjDefaults` los limpian aunque `serProject` los escribe. Pariente directo: el rebase de `_id` al cargar no escanea los ids de `autoItems` (10837) → colisión posible que hace que clips sigan curvas ajenas. |

## 9 · Hallazgos MEDIA (por subsistema, compactos)

**Render/compositor** — `_zsortSize` (orden por profundidad del túnel) solo se activa en `prepNests`: exportar o
hornear el túnel como pestaña activa apila por pistas, no por cercanía (1463) · un nido de domo se compone con la
**cobertura del padre** en vivo pero con la propia al hornear → activar el caché mueve la geometría (1449) · los
**scopes se congelan durante el arrastre** de una rueda de color — justo el gesto para el que existen (1350) ·
carrera del visor emergente con render-ahead: puede estampar un fotograma de otro tiempo también en el editor
(1710) · `mediaEfId` rota el medio del tejido barajado pero no el decodificador (por CLIP): con fuentes de vídeo
la rotación mezcla fotogramas del medio original (1321) · en pausa y sin render-ahead, **la salida NDI/Spout
sigue emitiendo el fotograma pre-edición** mientras el visor ya muestra el nuevo — el caso «proyectar mientras se
ajusta» (1983/2026) · `flatPlace`: `evalR(...)||100` convierte Scale=0 en 100 — el clip reaparece a tamaño
completo en el fotograma en que debía ser invisible (1060) · `_modAudioCache` no se invalida al cambiar de
canción ni de proyecto (967) · la esfera equirect del visor órbita ignora disabled/mute (654) · **el panel de
modulación es inalcanzable**: `openModPanel` tiene 0 llamadores — todo el motor R95·C1 sin puerta, sin nota de
retiro (6862).

**Medios/proxies/salidas** — dos entradas Spout: el nativo re-apunta la única conexión al último `inOpen` pero el
bombeo alimenta al primero → B pinta sobre la textura de A (2114) · cambiar resolución con la salida activa
duplica el refcount de `powerSave` y no se libera hasta cerrar la app (1996) · un archivo que Chromium no
decodifica (ProRes, MXF) se descarta **sin mensaje** al importar — ni medio ni error (2829) · proxy de fuente VFR
estampa timestamps CFR → deriva >3 % → «stale cut» lo borra y el ciclo re-encodea para siempre (2947) · doble
clic en «Generar proxy» encola dos encodes completos del mismo medio (3228).

**Panel de medios/pistas** — borrar una pista de audio deja al vídeo del par enlazado **mudo para siempre**
(`link`/`avRole:'v'` sin limpiar; `removeLane` no pasa por `_dropClip`) (3727) · `removeLane` tampoco corrige
`selLane` cuando `selLane>li` → off-by-one: Delete track actúa sobre la pista equivocada (3727) · con
`state.media` vacío el panel no pinta carpetas: «New folder» en un proyecto nuevo crea una carpeta invisible
(3099) · quitar el color de carpeta va sin undo/`bumpMeta` — la asimetría exacta que R253d corrigió al lado
(3115/3136) · el punto «en vivo» de una entrada Spout mira `_ndiLive` (3181).

**Gestos del timeline** — `duplicateLane` clona clips con `JSON.stringify` sin anular `maskTex` → la copia
hereda un objeto-no-textura truthy y el render lanza TypeError **en cada frame** (4818); además retiene el `link`
→ tres clips con el mismo id de enlace y partner al azar (4818) · el **ripple no arrastra a los partners A/V**
de los clips desplazados → todos los pares aguas abajo quedan desfasados (4930) · slide no acota el crecimiento
del vecino a su fuente → fotograma congelado (5078) · el clamp de trimL del drag no divide `inP0` por `speed`
— con 0.5× no se puede recuperar material que existe (5137) · la tecla **M no empuja undo** (su gemelo del
dblclick sí) (4846) · dos clips soltados a la vez: el segundo no corta el «resto» que creó el primero (5187) ·
el move multi-selección clampa cada clip a 0 por separado y destruye los offsets relativos (5213) · el rebase del
crossfade no sintetiza el keyframe de frontera que `trimItem` sí ([R92-T4 F7]) (5275).

**Inspector/curvas** — `${hasKf?'◆':''}` usa la FUNCIÓN global (siempre truthy): el rombo del Mix se pinta
siempre desde los handlers de Motion — resto del refactor R224 que renombró la local a `hasWK` (6400) · el
**Shape Box no se suelta** en 5 caminos que borran/reemplazan sus keyframes (Supr, «Delete selected», «Clear
automation», `simplifyAuto`, `pasteAutoAt`) → arrastrar sus tiradores muta objetos huérfanos (11941/7269/7286/
6815/6694) · los handlers de cada modificador Motion (velocidad, amplitud, modo…) mutan sin `pushUndo` — borrar
y el diamante del Mix sí lo hacen (6402-6406) · ídem todas las ediciones de capa del panel de modulación
(cambiar fuente además destruye la config entera) (6896-6905) · «Mask size» sin undo mientras sus cinco filas
hermanas sí (5916).

**Decoder/export frame** — NV12 con ancho par no múltiplo de 4: imagen corrida en diagonal en silencio; impar:
RangeError (8356) · el demuxador ignora `edts/elst` → fuentes con edit list real muestran fotogramas corridos
entre preview (`<video>`) y export (WebCodecs) (7403) · salto atrás con un vecino ≤2 fotogramas en caché: ni
reinicio ni la rama de atasco de R256 disparan → 10 s muertos y `_cdFail` degrada todo el medio (7472) · **la
rama FFmpeg mezcla el audio DOS veces** (descarta el `audioBuf` de la fase 'audio-mix' y re-llama
`exportAudioMix` sin deadline ni cancelación) (8578/8525) · `nv12Prep` borra fbo/tex viejos antes de validar el
nuevo → al volver al tamaño A usa handles destruidos (8365) · el horneado de caché de nest pasa por
`chapaLienzo` y en domo recorta las esquinas del cuadrado — la regresión que R180 midió y cerró (8783).

**Motor/panel de export** — `ffh264`/`ffhevc` nunca se sondean en el panel (`cabe:true` incondicional): sin
FFmpeg se ofrecen igual y mueren en runtime (9607) · la estimación de tamaño HAP multiplica **×16 de más** (~390
GB donde son 24) (9553) · el ✕ de la barra de estado cancela solo el muro activo y no vacía `_exq` — los 3 muros
+ piso encolados siguen renderizando con el panel ya en idle (9328) · en excepción del bucle FFmpeg se saltan la
limpieza del WAV temporal y las texturas de la chapa (~67 MB por fallo) (8646).

**Serialización/secuencias** — `openProject` (menú Abrir) llama `loadProject` sin try/catch y sin rollback: un
.isp con estructura inválida deja el editor a medias con `currentPath` ya apuntando al archivo — y Ctrl+S lo
pisaría (10587; `openProjectPath` sí captura) · `migrateRoomFloor` no limpia los clips de otras secuencias que
referencien la secuencia de piso eliminada (10768) · `repararRuta` reenlaza por basename a la primera
coincidencia — dos homónimos en subcarpetas distintas y elige en silencio (10936).

**Undo/atajos/autosave** — `renameFolder` (camino appPrompt) es el mutador de carpetas sin `bumpMeta` → rompe el
invariante R253d (11387; ídem `adopt`, 11069) · **redo de un borrado de medio queda a medias**: los clips se
re-borran pero el medio revive huérfano en el panel (11211) · **Ctrl+A con el ratón fuera del carril cae a
`toggleCurves()`** — la memoria muscular de «seleccionar todo» alterna la vista de automatización (11934) ·
M/I/O/X/D aceptan cualquier modificador — la regla `bare` de R103 se aplicó a las herramientas y a estos no
(11957) · `emergencySave` no comprueba `exporting`: un throw durante un export con `isolateClips` persiste el
proyecto **truncado** como autosave «más reciente» (11273).

**Composes/monitor** — «Rebarajar» muta el comp real antes de confirmar; Cancelar no lo revierte y la bandera
viaja al .isp (13210) · la vista previa de Cuadrícula/Aleatorio en domo dibuja el esquema PLANO (x/y) mientras
los mandos son az/el — el esquema miente justo mientras se ajusta (12879) · editar un compose de domo desde una
secuencia plana coerciona `kind` a 'grid' y Aplicar destruye el túnel/tejido en silencio (12978).

**Audio/FX** — aliasing sobre Nyquist: la banda de ~12 kHz muestra la energía espejada de ~4 kHz, y los rangos
custom >8 kHz modulan con contenido espejo (13745) · `_specRaw` hornea gain/gate en la envolvente pero su clave
no los incluye — moverlos no refresca los rangos custom (13758) · clip con FX + capa de ajuste activos: los
ping-pong compartidos se realojan 1280↔2048 **cada fotograma** — churn de VRAM y stutter (14117) · follow con
INV salta al 100 % cuando no hay señal (fuera del clip fuente, o durante todo un export sin bandas — se compone
con A7) (13874).

## 10 · Hallazgos BAJA (lista compacta)

Selección con impacto o valor de limpieza; el detalle vive en los informes: `activeClips` del hit-testing no
filtra disabled/mute y elige por orden de array (1213) · máscara pen sobre nido por PFD/PEQ arranca invisible
(fallback de sampler distinto al de PW) (1173) · muro de ancho 0 → NaN y el clip desaparece sin pista (1092) ·
listeners `resize`/`beforeunload` de la emergente se acumulan en cada auto-sanado (1893) · `c._curveTex` nunca
pasa por `deleteTexture` — fuga pequeña y sistemática (381) · carrera de `loadLUT` duplica texturas 3D (330) ·
`parseCubeLUT` ignora `DOMAIN_MIN/MAX` y clampa LUTs HDR en silencio (319) · rango de espectro desde 0 Hz cae a
la banda nombrada (`f0&&f1` falsy) (961) · blur/feather/crop/color se leen con `evalP` (sin `mod`) mientras la
línea de auditoría muestra `evalR` (1100) · object URLs sin revocar en audio import y regeneración de proxy en
memoria (2727/3013) · dedup de import por nombre+tamaño descarta archivos distintos (2596) · `detectFps` espera
el plazo entero con clips de <10 fotogramas y re-pausa el elemento hasta 8 s después (2851) · doble
`fileClose` en el catch de `pumpProxy` (2915) · selector de carpeta sin `CSS.escape` revienta con `"` en el
nombre (3041) · `attachLinkedAudio` aborta sin reintento si el decode de audio está ocupado (3343) · clic suelto
sobre un locator empuja un undo muerto y ensucia el proyecto (5391); ídem la herramienta T sin arrastre (4938) y
`toggleDisable` sobre rango vacío (11366) · Alt-copiar un par A/V produce copias sueltas sin link nuevo (5210) ·
cambiar `a.param` de un Motion deja huérfana la curva `mot:<viejo>:mix` en el .isp (6403) · parche de
`largesize` del .mov ignora el retorno del write — disco lleno al final de horas = archivo ilegible anunciado
como guardado (8744) · escritor ZIP del fallback navegador desborda >65 535 fotogramas (9306) · `runExport` sin
guarda de reentrada (8411) · el contador de fotogramas de la chapa ignora las marcas I/O que la duración sí usa
(8229) · Pausa no funciona durante un export por FFmpeg (`exWaitPause` ausente en ese bucle) (8631) · clip corto
con ambos fundidos largos: eventos de ganancia desordenados en el export de audio (8025) · `tl.pxPerSec` se
hereda en File→New (10556) · cambiar/cerrar pestañas no marca dirty; cerrar la activa no actualiza el título
(10978/10985) · borrar una secuencia anidada no recalcula la duración del padre anidado (10007) ·
`emergencySave` ignora la alternancia `_asFlip` (11274) · Escape del diálogo de compose cierra también el
monitor de origen (13072) · el monitor puede abrir con marcas invertidas si `inP` > duración nueva (13400) ·
rótulo «6 elementos» bajo el esquema del tejido (13137) · análisis de bandas fallido se reintenta en bucle en
cada repintado del panel (14298) · `_arCache.clip` retiene el clip borrado (13875) · `collectActiveVideos` está
muerto — candidato a `_backup/deprecated/` (1465).

## 11 · Patrones transversales (lo que los hallazgos dicen en conjunto)

1. **La familia «pushUndo/bumpMeta ausente» tiene ~10 miembros vivos** (M, Motion, modulación, Mask size, color
   de carpeta, renameFolder, adopt…). Siempre se detectan por asimetría con un gemelo que sí lo hace. Vale un
   barrido único con esa heurística exacta, y de fondo refuerza la propuesta del `commit()` de la Parte 1.
2. **La familia «heredar del proyecto anterior» no está cerrada** pese a R240b/R242: A13 (autoItems,
   exportPresets, pxPerSec vía File→New). La cura definitiva es la ya conocida: TODO campo que `serProject`
   escriba debe estar en `resetProjDefaults` — un test puro puede comparar ambas listas automáticamente.
3. **Cachés con clave incompleta o sin invalidación** (`_modAudioCache`, `_specRaw`, scopes, salida NDI en
   pausa, firma del tejido A12): cinco casos del mismo molde. Un helper único de invalidación (colgado de
   `markDirty`/`arRecompute`) los cierra de raíz.
4. **Las sondas validan metadatos y rótulos, no contenido.** A1+A2 convivieron enmascarándose porque ninguna
   sonda mira los píxeles de un MP4 por FFmpeg. Añadir a la suite «golden» al menos una sonda por camino de
   export que codifique 2 fotogramas distintos y los compare (el criterio de PSNR ya está escrito en NEXT.md).
5. **`innerHTML` + datos del usuario sin una `esc()` canónica** (A5). Una función y un barrido de ~10 plantillas.
6. **Diálogos apilables + `stopPropagation`** (A8, Escape del compose): los `onk` de `_dialogBase` necesitan
   `stopImmediatePropagation` y/o una cola de diálogos que impida apilar.

## 12 · Plan actualizado (sustituye al P0/P1 de la Parte 1 en lo que toca a bugs)

**P0 — pérdida de trabajo o resultado roto (esta semana):**
A1+A2 rama FFmpeg (con sonda de píxeles) · A3 `job.fail` · A4 FileHandles en `finally` · A5 `esc()` + barrido ·
A6 limpieza de proxy fallido · A7 export espera bandas · A8 confirmación agregada de Supr · A11 salto de línea
del `else if` · A12 firma `mode`/`param` · los 4 fixes de la Parte 1 (§3) siguen vigentes.

**P1 — corrección de edición diaria:**
A9 diamante del último keyframe · A10 rebase en la herramienta T · A13 + patrón 2 (reset completo + test de
paridad ser/reset) · duplicateLane (maskTex+link) · removeLane (par mudo + selLane) · redo de medio · Ctrl+A y
atajos `bare` · ripple con partners · doble mezcla FFmpeg · codecs ff sondeados en el panel · estimación HAP ·
✕ de la barra vacía la cola · patrón 3 (invalidación de cachés) · patrón 6 (diálogos).

**P2 — el resto de MEDIA/BAJA**, al ritmo de las rondas, más las decisiones de producto: qué hacer con el panel
de modulación inalcanzable (¿retirarlo con ADR-0007 o darle puerta?) y con `collectActiveVideos`.

---

*Parte 1: 2026-08-07 (revisión general). Parte 2: 2026-08-08 (auditoría exhaustiva de app.js por 12 agentes,
con verificación directa de los ALTA marcados ✔). Working tree en `main`, último commit 21fdfce (R309).
Capturas en `scratchpad/out/audit-*.png` (no versionadas).*
