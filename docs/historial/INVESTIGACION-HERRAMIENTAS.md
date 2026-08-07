# INVESTIGACIÓN 2 — Qué otras herramientas tenemos mal enfocadas (2026-07-16)

**Método:** 3 frentes en paralelo con fuentes primarias (manuales, specs) + foros, contrastados **contra nuestro código real** (no contra suposiciones): (A) timeline y herramientas de edición — FCP/Resolve/Premiere/Avid/Vegas/Kdenlive/Descript/CapCut; (B) medios, proxies, caché, export, proyecto — Resolve/FCP/Premiere/AE/Lightroom/Avid/Blender/Resolume/VDMX/TouchDesigner; (C) fulldome, sala y directo — IMERSA/AFDI, Digistar, Sky-Skan, Uniview, disguise, Watchout, VIOSO, HAP.
**Honestidad:** cada informe marcó lo no verificable. Correcciones a mis propias premisas incluidas (p. ej. el idle de FCP es 0,3 s, no 5 s; la caché de Resolve solo tiene 2 colores; Resolume rechaza el preload a propósito).

---

## 0. Titular: el hallazgo estratégico

**No existe un NLE fulldome dedicado.** La prueba: la propia lista *Dome Production Tools* de IMERSA no contiene **ni un solo editor de timeline** — hay reproducción, 3D, mapping, audio espacial y post, pero nadie edita. Los artistas montan en **After Effects**, que pelea con los másters cuadrados (downscale que emborrona campos de estrellas, deriva de audio, "dog ears", re-export combinatorio por venue). Ese es exactamente nuestro hueco.

Y la investigación **valida nuestra arquitectura** en lo que más dudas podía dar:
- **El warp/blend NO es del editor.** Todas las herramientas de calibración (VIOSO, Scalable, ProjectionTools) emiten datos para el *reproductor* (`.vwf`, MPCDI, `.ol`), nunca para un editor. Pre-deformar contenido es un anti-patrón: lo congela a la geometría de un domo concreto. **No construir**: warp, blending, troceado por proyector, calibración con cámara, show control.
- **La tira de muros de la sala 360 es el patrón estándar**, no una ingenuidad: es el mismo UV unwrap que usa disguise, y `stripW=Σ pxW` es literalmente su regla de densidad de píxeles.
- **Los proxies manuales NO son un error de diseño.** Apple apagó el background rendering por defecto en FCP 12.3 razonando que el hardware moderno ya no lo necesita. Lo que sí falta es *visibilidad de estado*.

---

## 1. 🔴 BUGS DE PRODUCTO detectados y ya corregidos en esta ronda
| # | Hallazgo | Estado |
|---|---|---|
| **B1** | **Las secuencias PNG no cumplían el estándar de entrega.** Exportábamos `dome_000.png`: base 0 y relleno variable según duración. IMERSA/AFDI exige `Nombre_000001.png` — **6 dígitos, base 1**. Un planetario **no podía ingerir la entrega sin renombrar frame a frame**, y dos exports de distinta duración ordenaban distinto. | ✅ **R96** |
| **B2** | **El `.isp` podía corromperse**: `writeText` escribía directo sobre el archivo. Crash, corte de luz o Drive/Dropbox sincronizando a mitad = proyecto truncado (el fallo documentado que mata proyectos de Premiere). | ✅ **R96** escritura atómica (temp + fsync + rename) |

---

## 2. Lo que nos falta, por frente

### 2.1 Edición — el hueco que nos delata como "no-NLE"
> *"JKL + insert/overwrite es lo que separa 'herramienta de juguete' de 'NLE' a ojos de un profesional."*

**Verificado en nuestro código:** no tenemos slip/slide/roll/ripple-trim (solo trim de bordes + ripple delete), **no tenemos JKL** (y la `L` está ocupada por "añadir marcador", justo la tecla que en todos los NLE significa "reproducir adelante"), no hay insert/overwrite ni trim numérico por teclado.

| Prioridad | Qué | Origen | Por qué |
|---|---|---|---|
| **P0** | **J/K/L** (J atrás · K pausa · L adelante; repetir = 2×/4×/8×; K+L = cámara lenta) | Universal | *El* estándar. Mover marcador a `M` (que es lo estándar) |
| **P0** | **Trim mode contextual** (una tecla `T`, el **cursor decide** si es ripple/roll/slip/slide según dónde estés dentro del clip) | Resolve | Elimina 5 herramientas y el "¿qué herramienta necesito?". Mejor coste/beneficio del informe |
| **P1** | **Dynamic trim / trimar mientras suena** (JKL en trim) | Avid | Para vídeo **musical** es decisivo: el corte se juzga oyendo, no mirando |
| **P1** | **Trim numérico por teclado** (←/→ = 1 frame, Shift = 10) | Avid/Kdenlive | Precisión sin depender del zoom ni cazar píxeles |
| **P1** | **Clips conectados** (adjuntar overlay/audio a un clip padre; al mover el padre, se mueven) | FCP | Roba lo bueno del magnetismo **sin** el trackless |
| **P2** | **Three-point editing** (insert/overwrite con in/out de origen) | Universal | |
| **P2** | **Dual timeline** (vista global + zoom a la vez) | Resolve Cut | Encaja perfecto con piezas largas de domo |
| **P2** | **↑/↓ = corte anterior/siguiente**, `Shift+Z` = ajustar a ventana | Universal | |

**Qué NO robar del magnetic timeline de FCP:** el trackless. En un editor de domo el eje dominante es **el tiempo musical**, que es rígido y no debe rippelear nunca; y con capas espaciales simultáneas (az/el, grupos ring/grid) el magnetismo sería letal (queja documentada: al apilar clips verticalmente "cada uno se pega al primario y no se alinean").

**Idea propia derivada:** el equivalente real de "edición por texto" (Descript) para nuestro caso **no es texto: es estructura musical** — detección de beats/onsets → marcadores automáticos → **snap al beat en vez de snap a rejilla**. Ya tenemos detección de beats (`detectBeatsCmd`) y el análisis de bandas: es un paso corto y **no lo hace bien ningún NLE mainstream**.

### 2.2 Medios / caché / render — el hueco es *visibilidad*, no automatismo
| Prioridad | Qué | Origen | Por qué |
|---|---|---|---|
| **P0** | **Estado visible de proxy/caché**: columna o badge de "qué clips tienen proxy" + barras en la regla. El patrón ganador: **verde/amarillo/rojo de Premiere = capacidad PREDICHA de reproducir en tiempo real** (la única señal que comunica algo útil de antemano); el eje AE/Blender (tipo de caché) es el que encaja con nuestro FBO | Premiere/AE | Hoy el usuario no sabe qué está preparado. La peor fricción de Resolve es justo esto |
| **P0** | **Fallback per-clip** ("usar proxy si existe" en vez de todo/nada) | Resolve + FCP | **El patrón más validado del informe**: los dos lo enviaron en 2ª iteración tras fracasar el modo estricto |
| **P1** | **Borrar lo generado desde dentro de la app** (proxies/caché, con tamaño en disco) | FCP | La peor fricción documentada de Resolve es obligar a borrarlo en el explorador |
| **P1** | **Resolución de reproducción vs pausa separadas** (¼ al reproducir, full al pausar) | Premiere | Directamente aplicable a nuestro compositor |
| **P1** | **Caché en idle** (aprovechar el tiempo muerto; ya tenemos render-ahead, pero **apagado y manual**) | Resolve | "El tiempo muerto es gratis" |
| **P2** | **Panel de tareas en background** con progreso y cancelar por tarea | FCP/Avid | Ya tenemos cola de export: extender a proxies |
| **P2** | **Relink con previsualización de coincidencias** ("3 de 3 archivos") + **propagación por carpeta** | FCP + Resolume/Lightroom | El mejor patrón del sector |
| **P2** | **Autosave: modelo abuelo-padre-hijo** (10 min → horarios 8 h → diarios 5 días) + **recuperación de 1 clic que NO viva en TEMP** (superaría a los 4 grandes: Blender la tiene pero en `%TEMP%`, que el SO limpia) | Resolve + Blender | Ya tenemos autosave+historial; falta el esquema y el 1-clic |

⚠️ **Riesgo estructural detectado en la sala 360:** "la independencia de resolución es mentira" — Premiere avisa de que máscaras y efectos posicionales se desalinean si las dimensiones no dividen limpio. **Nuestra tira se compone por PÍXELES (`stripW=Σ pxW`) → tenemos ese modo de fallo por arquitectura.** Hay que probar proxies + sala explícitamente.

### 2.3 Fulldome / sala / directo — donde podemos ser únicos
| Prioridad | Qué | Por qué |
|---|---|---|
| **P0** | **Stems de audio discretos** `_L/_R/_C/_LFE/_Ls/_Rs` (WAV 48k/16, start frame 00:00:00:01) | Hoy escribimos un solo `audio.wav`. El spec IMERSA lo exige — **bloquea entrega igual que B1** |
| **P0** | **Overlay de área segura fulldome**: máscara ±90° / 10–60° de latitud + anillo del *sweet spot* (30–40° sobre la spring line) + aviso de "dog ears" | Tenemos la guía de spring line, pero no el área de acción segura. Es *el* error de composición del sector |
| **P1** | **Export HAP / HAP Q (.mov)** | Es la lingua franca de Watchout, disguise, Resolume, Millumin, QLab, TouchDesigner, Notch. **Viable sin FFmpeg**: HAP = DXT1/5 + Snappy (comprimible en WASM). Nos conecta con TODO el ecosistema de directo |
| **P1** | **Burn-in de entrega**: nombre de show + copyright (abajo izq.), timecode + nº de frame (arriba izq.), en el negro exterior | Lo pide el spec literalmente |
| **P1** | **Presets de entrega multi-venue** (un master → 1K/2K/4K por lote) | La queja documentada de Loch Ness: re-exportar a mano cada variante. Ya tenemos cola: es encadenar |
| **P2** | **LTC (SMPTE) in / MTC / OSC** | La lingua franca de sincronía con audio e iluminación. Nuestro `tcMode` es solo un modo de regla. (Timecode = identidad del frame; genlock = fase: cosas distintas) |
| **P2** | **Spout** (Windows, GPU zero-copy) | NDI es CPU y 10–60 ms: sirve para monitorizar, no para playback crítico. Spout es lo que encadena con Resolume/TD/MadMapper |
| **P2** | **Import de geometría OBJ** para la sala | OBJ es el formato de facto de venue; hoy la sala es solo una caja |
| **P3** | **Bake de perspectiva anclada al espectador** | El mayor hueco conceptual de la sala: una tira plana es *papel pintado independiente del espectador* — correcto para textura, geométricamente falso para ilusión de perspectiva. Los CAVE calculan proyección off-axis por muro desde la cabeza. **Previsualizamos con la cámara Viewer pero no podemos hornear esa perspectiva** |
| **P3** | **Grading dome-aware** (preview con luz difusa simulada: las reflexiones cruzadas del domo destruyen el contraste; ganancia útil ~25–30%) | No lo tiene nadie |

---

## 3. Propuesta de rondas (orden recomendado)

- **R96 ✅ (hecho)** — B1 numeración IMERSA · B2 escritura atómica.
- **R97 · "NLE de verdad"**: J/K/L (+ marcador a `M`) · trim contextual `T` (ripple/roll/slip/slide por cursor) · trim numérico ←/→ · ↑/↓ entre cortes. *El mayor salto de percepción profesional por línea de código.*
- **R98 · "Entrega fulldome impecable"**: stems discretos · área segura + sweet spot · burn-in · presets multi-venue. *Nos hace entregables a planetario sin retoques.*
- **R99 · "Saber qué está listo"**: badges/columna de proxy · barras de caché en la regla (modelo Premiere) · fallback per-clip · borrar generados in-app · resolución play/pausa.
- **R100 · "Ecosistema directo"**: HAP · Spout · LTC.
- **Explorar**: snap al beat (nuestro "Descript musical") · clips conectados · dual timeline · OBJ · perspectiva off-axis.

---

## 4. Fuentes principales
**Edición:** [Apple Magnetic Timeline](https://support.apple.com/guide/final-cut-pro/intro-to-the-magnetic-timeline-verb8fcfc133/mac) · [Resolve Cut page](https://www.blackmagicdesign.com/products/davinciresolve/cut) · [PremiumBeat Dynamic Trim](https://www.premiumbeat.com/blog/dynamic-trim-tool-resolve/) · [Adobe ripple edits](https://helpx.adobe.com/premiere/desktop/edit-projects/trim-clips/perform-ripple-edits.html) · [Chris Nicholas — Avid Trimming](https://www.chrisnicholas.net/tutorials/avid/trimming.html) · [FCPXpert — Fighting the Magnetic Timeline](https://fcpxpert.net/2014/02/18/part-1-fighting-the-magnetic-timeline/) · [Adobe — autosave crash](https://community.adobe.com/questions-729/premiere-pro-2025-crash-deleted-all-project-files-and-auto-saves-1419848)
**Medios/caché:** [Manual Resolve 18.6](https://www.steakunderwater.com/VFXPedia/__man/Resolve18-6/DaVinciResolve18_Manual_files/part250.htm) · [Apple playback quality](https://support.apple.com/guide/final-cut-pro/control-playback-quality-ver2fd7a8b94/mac) · [Apple background rendering](https://support.apple.com/guide/final-cut-pro/background-rendering-ver717f3ca3/mac) · [PVC — FCP 12.3](https://www.provideocoalition.com/surprise-its-final-cut-pro-12-3/) · [Adobe — render bars](https://blog.adobe.com/en/publish/2011/02/20/red-yellow-and-green-render-bars) · [Screenlight — RAM/disk cache AE](https://screenlight.tv/blog/the-definitive-guide-to-ram-previews-and-disk-caches-in-after-effects-ie-those-blue-and-green-lines) · [Apple relink](https://support.apple.com/guide/final-cut-pro/relink-clips-to-media-files-ver26f5c8c9/mac) · [TD Realtime flag](https://nvoid.gitbooks.io/introduction-to-touchdesigner/content/User_Interface/2-8-Realtime-Flag.html) · [Blender recover](https://docs.blender.org/manual/en/latest/troubleshooting/recover.html)
**Fulldome:** [IMERSA Dome Master Specs 2019](https://imersa.org/images/standards/Dome_Master_Specifications_2019.pdf) · [IMERSA Dome Production Tools](https://imersa.org/dome-production-tools) · [Melbourne Planetarium delivery specs](https://museumsvictoria.com.au/scienceworks/visiting/melbourne-planetarium/content-delivery-specifications/) · [HAP integrations](https://hap.video/integrations) · [Watchout LTC](https://docs.dataton.com/watchout-7/wo-time/LTC.html) · [disguise UV templates](https://help.disguise.one/workflows/3d-modelling/uv-mapping/uv-maps-as-content-templates) · [VIOSO export](https://helpdesk.vioso.com/documentation/core-export-calibration/) · [Loch Ness — AE para fulldome](https://www.lochnessproductions.com/reference/2014IMERSA_ae/2014IMERSA_ae.html) · [Paul Bourke — domos inclinados](https://paulbourke.net/dome/tilted/)
