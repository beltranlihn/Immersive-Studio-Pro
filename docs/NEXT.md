# NEXT — Cola de trabajo activa

> Tareas ordenadas de **más rápido de resolver → más complejo**. Marcá `[x]` a medida que se cierran (y actualizá la fila
> en `COMPONENTS.md` + una entrada en `PLAN.md` en el mismo commit, como manda el ritual de `/commit`).
> Códigos = tickets de `CORRECCIONES-V2.md`. Ubicaciones = `COMPONENTS.md`. Última revisión: 2026-08-04.

## 🔭 Lo siguiente (abierto) — el scrub sin proxy
> Sale de `AUDITORIA-2026-08.md` §3.3, y es **lo de más valor práctico que queda**. R241 midió 1148 ms de mediana
> con 4 capas sin proxy frente a 8 ms con proxy; la auditoría llegó a la causa: los clips de masterización tienen
> **GOP de 250 fotogramas** (medido con ffprobe sobre `Neuro1_7196.mp4`), así que un seek exacto decodifica hasta
> 250 fotogramas de 6,5 Mpx. No es «optimizar»: es el coste de la exactitud sobre un GOP largo.
- [ ] **Previsualización al fotograma clave más cercano mientras se arrastra**, y seek exacto al soltar (lo que
      hacen Resolve y Premiere en modo rápido). Decodificar 1 fotograma en vez de ≤250 → estimado **~10-40 ms por
      muestra, 30-100× mejor**, a cambio de una imagen «a saltos de 4 s» sólo durante el arrastre. Toca
      `vinstSeek` y el camino de scrub en caliente → **ronda propia con verificación aparte**, no se coló en R242
      junto a los arreglos de integridad a propósito. Medir con `scratchpad/r241-medir.mjs`; objetivo: mediana
      <50 ms sin proxy.
- [ ] Opcional, complementaria: encender el caché de scrub-ahead (`_raOn`) por defecto cuando hay medios pesados
      (mitiga el re-scrub sobre la misma zona, no el primer toque).
> **[R242] Ya hecho de esta zona:** el aviso al importar material pesado («clic derecho → Generar proxy»), que era
> la mitad barata. ADR-0003 intacto: informa, no genera.

## ✅ Auditoría delta 2026-08 — CERRADA EN CÓDIGO [R242]
> Informe completo en `AUDITORIA-2026-08.md` (auditor externo, sobre el `.exe`/RTX). Sus cinco etapas ejecutadas y
> sus cinco decisiones resueltas en R242 — el detalle y el porqué de cada decisión, en `PLAN.md › ROUND 242`.
> Verificado con las seis sondas del propio informe (`scratchpad/aud2608-*.mjs`), `__errs` vacío.
- [x] **Integridad de datos (ALTA):** `resetProjDefaults()` — valores de fábrica antes de leer el archivo, en los
      TRES caminos. Mata la cuarta aparición de «heredar del proyecto anterior»: un `.isp` legacy creaba su
      secuencia con el `seqMode` de la SALA anterior y **guardarlo corrompía el archivo**. Cubre también
      `tl.bpm/sig/tcMode`, el encuadre del visor y `obj.lanes`.
- [x] **Fuga de medios (ALTA por acumulación):** `loadProject` no desechaba los medios del proyecto saliente
      (`newProject` sí). Medido: +5 texturas GL por apertura → ahora 0.
- [x] **Robustez:** BOM en el `.isp` («Invalid project» sin pista) · `dsp:openExternal` con allowlist (la descarga
      del runtime NDI llevaba muerta desde R226) · macOS: reabrir desde el Dock dejaba la ventana invisible para
      siempre (estático, sin Mac para probarlo) · `PSEP` en las dos últimas rutas cableadas de `ncBuild`.
- [x] **Deuda/limpieza:** viewport de relleno acotado a `MAX_VIEWPORT_DIMS` · `build.files`/`asarUnpack` nombran
      Spout · `tl.audioCollapsed` vuelve a serializarse (el lector de R110 esperaba un campo que nadie escribía).
- [x] **Cola de export:** pendiente **cerrado**. Con [D2] retirado no se edita mientras exporta, así que la UI
      mínima de R216 es suficiente: no hay cola que administrar en paralelo.
- [ ] **Pendiente de Mac:** verificar allí el arreglo del Dock y las rutas de `ncBuild` (más el tope H.264 de
      VideoToolbox que `docs/MACOS.md` ya marca como sin medir). No hay máquina disponible.

## 🧪 QA pendiente de la auditoría de julio — 2026-08-04 · CERRADA ✅ [R240]
> La «segunda pasada de QA» que `AUDITORIA-2026-07.md` dejó anotada y nunca se corrió. Ejecutada por CDP
> (`scratchpad/r240-qa.mjs` + `r240-qa2.mjs`), `__errs` vacío.
- [x] **Seis de siete escenarios ya se comportaban bien:** trim a duración 0 (topa en `CUT_MIN` por los dos bordes,
      sin negativos ni NaN, respetando el límite del material) · borrar media en uso + deshacer (devuelve medio y
      clips) · work in/out invertido (no rompe `duration()` ni el repintado) · marcadores y exclusión locator ⇄ clip
      en las dos direcciones · borrar/cerrar la única secuencia (el guard aguanta) · zoom extremo por la UI.
- [x] **Hallazgo real, arreglado: el zoom del `.isp` entraba SIN ACOTAR.** Los ocho gestos que tocan `pxPerSec`
      pasan por `TL_PPS_MIN/MAX`; abrir un proyecto era el único que no. Con `pxPerSec:1e7` la línea de tiempo
      reservaba **33 554 432 px** de ancho y ningún gesto la devolvía a un rango usable. Acotado al cargar (mismo
      archivo → 2400 y 53 869 px). Importa porque el zoom **se guarda en el proyecto**: cualquier valor malo deja
      la línea de tiempo inservible al abrir, sin pista de por qué.
- [x] **[R240b] Y si el `.isp` no trae zoom, se vuelve al valor de fábrica** en vez de heredar el del proyecto
      anterior — la misma familia de defecto que el encuadre horizontal de R239. Salió de una nota «fuera de
      alcance» de la revisión del diff. Siete casos verificados en `scratchpad/r240b-zoom.mjs`.
- [x] **Atajos, barridos** (`scratchpad/r240-atajos.mjs`). De las 56 entradas de la paleta, **33 anuncian atajo y
      las 33 tienen función detrás**; dispararlos todos no produce ni un error. ⌘D duplica, `0` alterna
      desactivado y ⌘C llena el portapapeles. Se buscaba la clase de fallo que ya se dio una vez aquí ([R92-T5]:
      la paleta prometía `+`/`−` de zoom que no existían) — **no hay ninguno vivo**.
- [x] ~~**Lo único que no se puede simular: la prueba de estrés tipo show.**~~ **CORRIDA en R241** con la sala real de
      Beltrán (7196×912) y nueve clips HEVC 7196×912 @60fps de hasta 410 Mbps, sobre el **`.exe`** y verificando por
      `WEBGL_debug_renderer_info` que estaba en la **RTX 4060**. Aguanta de sobra: 4 capas simultáneas a **60,2 fps
      sostenidos**, 0,05 ms de GPU por render, 25 MB de composite, memoria plana, sin perder el contexto.
      **El cuello es el scrub sin proxy: 1148 ms de mediana frente a 8 ms con proxy (143×).** Y aparecieron dos
      bugs reales que sólo salen con material así: `detectFps` dejaba los NUEVE clips a 30 fps siendo de 60 (y con
      ello los proxies a media tasa), y cada clip sin pista de audio dejaba un rechazo de promesa sin capturar.
      Los dos arreglados y verificados; los nueve proxies regenerados a 60/1.

## 🔧 Tanda de Beltrán — 2026-08-04 (cuatro ajustes de uso diario) · CERRADA EN CÓDIGO ✅ [R239 + R239b]
> Verificada por CDP en dev (`scratchpad/r239-diag.mjs` para el estado ANTES, `r239-verify.mjs` y
> `r239b-review.mjs`), `__errs` vacío en las tres. **Pendiente de build + deploy**, junto con R237 y R238.
- [x] **Entrar a un nido enseña su principio.** El cabezal YA iba a 0 — lo que no se movía era el **scroll
      horizontal**, que vive en el DOM y no viajaba con la secuencia (medido: cabezal 0 correcto, scroll 27 788 px,
      primer clip fuera de pantalla). El encuadre pasa a ser de la secuencia (`nestScrollT`, en SEGUNDOS porque el
      zoom es global). Volver al padre devuelve su sitio.
- [x] **Soltar un archivo sobre un clip lo archiva en la carpeta de ese clip.** La lógica ya estaba escrita
      (`folderAt`) y **no la llamaba nadie**; subida a `_dropTargetAt`, que es la única puerta, arregla también el
      arrastre interno. Con resalte de la carpeta de destino, que al arrastrar desde el explorador no existía.
- [x] **«Create composition» con UN solo medio**, en lista y en cuadrícula. El mínimo de dos era del camino de
      multi-selección de [R88], no del compositor.
- [x] **Pestañas de secuencia sin barra de scroll**, se recorren con la rueda. No era un descuido de CSS: Chromium
      desactiva `::-webkit-scrollbar` en cuanto se usa `scrollbar-width`, y la barra se comía 12 de los 22 px de alto.
- [x] ~~**Revisión del diff (R239b)**~~ — cinco hallazgos reales: el encuadre por secuencia se enganchó a cuatro
      caminos y faltaban otros cuatro (crear secuencia, su variante de sala, borrar la activa, `newRoomProject`);
      una CARPETA soltada sobre una fila de medio sin archivar se movía a la raíz en silencio; el realce de la fila
      se quedaba pegado al entrar en una pista; y la pestaña activa podía quedar fuera de la vista porque
      `renderSeqBar` reinicia el scroll en cada repintado.
- [ ] **Dos decisiones tuyas, ninguna urgente:** (a) al RE-entrar a un nido ya visitado vuelve donde lo dejaste, no
      al inicio — simétrico con el padre, pero tú dijiste «al inicio nomas»: dilo si lo quieres siempre al origen;
      (b) el desvanecido en el borde de las pestañas es un añadido mío para avisar de que hay más (al quitar la
      barra se fue el único indicio) — si prefieres el corte a hueso, se quita en una línea.
- [ ] **Probar a mano lo que no se puede simular:** arrastrar de verdad un archivo desde el explorador a una carpeta
      (por CDP se verificó `_dropTargetAt`, que es quien decide el destino, no el gesto completo) y la rueda con un
      ratón físico sobre las pestañas.

## 🧭 Sala 360 · planta en lazo + orden del lienzo — 2026-07-30 · CERRADA ✅ [R232]
- [x] **La planta ya no se cruza.** La causa NO era la tabla: `roomPlan` deriva la huella de los roles, y tres
      disposiciones distintas dan la misma planta. Era el solver, que cogía la primera de las **dos raíces** de θ
      y esa pliega la sala (648/745/641/648 → −67,6° cruzada vs −0,6° correcta). Ahora descarta las cruzadas y
      elige la de |θ| menor. Barrido: 784 combinaciones, 0 cruzadas sin avisar.
- [x] **Orientación fija (Front·Right·Back·Left)**, sin selector, en el launcher y en «Geometría de la sala…».
- [x] **Primera columna = orden en el lienzo cosido** (1..N, izquierda→derecha), con intercambio al repetir.
- [x] ~~**Revisión del diff (R232b)**~~ — seis hallazgos: `lchNormOrder` descolocaba la tira al cambiar la cuenta
      de muros, pulsar la cuenta ya activa reescribía los órdenes (launcher y diálogo), la fila del piso quedaba
      18 px a la izquierda, el campo de orden del diálogo perdía el foco a cada paso, las flechas movían de 10 en
      10, y confirmar el mismo orden no repintaba. Verificados en `scratchpad/r232b-review.mjs`.
- [x] ~~**Reordenar muros no movía el contenido ya colocado.**~~ _(R232c: decidido con Beltrán la opción (a) — el
      contenido **sigue a su muro**. `reubicarClipsPorMuro` conserva la posición relativa dentro del muro, y la
      curva `kf.x` viaja con él. Verificado: Front del puesto 1 al 4 lleva su clip del píxel 960 al 6720, centrado
      y con su máscara intacta)_
- [x] ~~**Línea negra en los bordes del lienzo (R233).**~~ _No era del vídeo ni de las guías: el composite máster es
      una textura CUADRADA y un lienzo apaisado va encajado en una banda, así que el blit muestreaba en el límite y
      `LINEAR` mezclaba el último texel con el vacío. Una tira de 7196×912 ocupa ~65 texels en un composite de 512²
      → 1 texel = 14 px de lienzo → ~140 px de banda negra a 1000%. Arreglado acotando el muestreo al primer/último
      texel ENTERAMENTE cubierto (medio texel no bastaba: la banda no cae en múltiplos de texel)._
- [x] ~~**Paneo vertical lento en el lienzo (R235).**~~ _Usaba `min(cw,ch)` en los dos ejes con un mapeo anisótropo
      (`sy`≈0,23 en una tira): 100 px de arrastre movían 23. Ahora escala por eje (`panScale`); medido 1:1 en X e Y._
- [x] ~~**«Full» no enseñaba la calidad original (R236).**~~ _El composite estaba clavado en 2048²; ahora se
      dimensiona con el lienzo (`compBase()` = `max(w,h)`, tope `COMP_MAX=8192` por memoria). Medido: sala de
      7196×912 en Full → **submuestreo 1,00 en los dos ejes** (198 MB). El domo pasa de 2× a 1:1 y un 2D 1080p
      gasta menos que antes. Coste: a Full se sombrea el lienzo completo — para eso están ½ y ¼._
- [x] ~~🟠 **Composite NO CUADRADO** (y con él, el 🔴 PRIORITARIO de la línea de abajo).~~ _(R237: hecho y verificado
      por CDP en dev — `scratchpad/r237-fill.mjs`, `r237-verify2.mjs`, `r237-verify3.mjs`, `r237-verify4.mjs`,
      `__errs` vacío en las cuatro.)_ El máster pasa a `compW×compH`, con la forma del lienzo, **y el tope deja de
      ser un lado para pasar a ser MEMORIA** (`COMP_MAXTEXELS=8192²`) — hacían falta las dos cosas: sólo con la
      primera, el tope de 8192 por lado seguía dejando la sala 4K a 1,9×. Medido:
      · sala **7196×912 → composite 7196×912, submuestreo 1,00 en los dos ejes, 25 MB** (antes 198)
      · sala de 4 muros 4K, **15360×2160 → 1,00 en los dos ejes con 127 MB** (antes 1,875× y 268 MB)
      · domo 4096² y 2D 1920×1080, 1:1 y viewport identidad — el domo queda intacto **por construcción**: con un
        lienzo cuadrado relleno y letterbox coinciden
      · relleno EXACTO (`u(0)=0, u(W)=1, v(H)=0, v(0)=1`, desviación **0 texels**; el peor caso, ¼ de calidad en
        1799×228, se queda en medio texel)
      · export por-muro: los cuatro muros exportados por separado reconstruyen la tira entera con **difMax 0**
      · caché de nest (`_ncSquare`) con su letterbox intacto · sala 3D sin franja (`vTop=1,000000` sin recortar)
      · capa de ajuste sobre el máster no cuadrado: misma cobertura al píxel y el color cambia
      · visor partido muros|piso sin invasión · caché de scrub-ahead a la proporción del máster (1024×400).
      **Dos convenciones conviviendo, a propósito:** el máster es de *relleno* (`mstrU`/`mstrV`,
      `mstrContentLim`/`mstrLimForRect`) y export, NDI, Spout y el caché de nests siguen en *cuadrado con
      letterbox* (`compContentLim`/`compLimForRect`). No mezclarlas. Detalle en la ficha de COMPONENTS.md.
- [x] ~~🔴 PRIORITARIO · composite no cuadrado.~~ _(cerrado por R237, arriba)_ Reportado por Beltrán en producción:
      un clip sin proxy en **Full** se ve muy pixelado. Medido entonces: lienzo 7196×912 → banda de **2048×260
      texels** = **3,51× de submuestreo en LOS DOS ejes** y **87,3 % de la textura desperdiciado**.
- [x] ~~**Revisión de R233 (R233b)**~~ — el acotado se hacía contra el RECORTE y no contra el contenido (comía un
      texel en las costuras interiores: export por-muro y panel de muros); la franja seguía viva en el 3D. Ambos
      corregidos con `u_uvlim` = banda del lienzo, salvando el caso `_ncSquare` (letterbox del caché de nest).
- [x] ~~**El 3D apagaba los colores del lienzo.**~~ _(R233b: `v_sh`, un foco falso, oscurecía los muros hasta un 38 %.
      El contenido va sin sombrear; el sombreado queda en la carcasa translúcida de fuera)_
- [x] ~~**El clip saltaba a centrarse en el cursor al arrastrarlo (R234).**~~ _Ahora se ancla en el punto de agarre;
      igual en plano/sala y en domo._
- [x] ~~**Revisión desde el Mac (R234b/c)**~~ — seis hallazgos reales: el acotado del muestreo tiene que ser por
      SUPERFICIE (el piso es una isla; el pie de los muros se mezclaba con el piso), el desfase del agarre se medía
      en `evalR` y se escribía en la base (igual en la ESCALA, anterior a R234), el azimut del domo se guardaba
      fuera de [0,360), reordenar muros se llevaba clips más anchos que su muro, y deshacer devolvía los clips sin
      la geometría. Verificados en `scratchpad/r234b-review.mjs` y `r234c-reorden.mjs`.
- [x] ~~**Deuda anotada (bajo impacto, de la misma revisión).**~~ _(R238, verificada por CDP en
      `scratchpad/r238-solver.mjs` y `r238-antes.mjs`, `__errs` vacío)_
  - [x] **El barrido del solver perdía LAS DOS raíces cuando el mínimo de la curva roza el cero.** Ahora, además
        de los cambios de signo, se refina cada EXTREMO local por búsqueda ternaria y, si alcanza el otro lado del
        cero, se bisecan sus dos ramas (con tolerancia de raíz doble). El caso se construye EXACTO porque en
        `s=sin θ` la curva es una parábola: con Front 500 · Right 400 · Left 600 el mínimo cae en un fondo de
        **172,00 cm**, y ahí el barrido viejo encontraba **0 raíces** —avisaba «no cierran» siendo falso— y ahora
        cierra con error 0. Por debajo del mínimo sigue avisando. Barrido de **28 561 combinaciones sin
        regresión**: 0 cruzadas en silencio, 0 sanas rechazadas, peor error de cierre **0 cm**; el caso real de
        Beltrán (648/745/641/648) sigue en θ=0,59°.
  - [x] **El rótulo ya distingue los dos casos:** «no cierran una sala» (sobran o faltan centímetros) frente a
        «sólo cierran cruzándose» (el error está en qué pared se midió como cuál). El segundo sigue siendo
        inalcanzable en la práctica —el barrido lo confirma, 0 de 28 561—, así que es corrección, no algo que se vea.
  - [x] **Al cambiar el ANCHO de un muro el clip se recentra pero no se reescala.** _(DECISIÓN de Beltrán,
        2026-08-04: **dejarlo como está.** Se valoraron y descartaron escalar con el muro —`scale` es uniforme, así
        que estrechar un muro encogería también el alto y un clip que llenaba la altura dejaría de llenarla— y
        recortar sólo al desbordar. Anotado en `reubicarClipsPorMuro` para que no se "arregle" sin volver a preguntar.)_
- [ ] Probar en el `.exe` desplegado y confirmar con una sala real medida a mano.

## 🧪 Tanda de Beltrán — 2026-07-30 (prueba sobre el .exe desplegado) · CERRADA EN CÓDIGO ✅ [R231]
> Siete puntos de una prueba real sobre el `.exe` de R230c. Todos verificados por CDP en dev
> (`scratchpad/r231-fixes.mjs`, con `r231-diag.mjs` y `r231-mask-dom.mjs` de apoyo), `__errs` vacío.
- [x] **Máscara manual · hover sobre la arista** — realce del segmento + fantasma del punto y cursor `copy`. El clic
      **inserta en su sitio** (`splice`) y en el punto proyectado, en vez de hacer `push` al final del anillo (que era
      lo que convertía la máscara en una maraña). Fuera del contorno ya no añade nada.
- [x] **Máscara manual · el paneo volvía bloqueado** — `maskEditPointerDown` se tragaba el botón CENTRAL. Ahora sólo
      se queda con el izquierdo a secas; botón central y Shift+arrastre vuelven al paneo.
- [x] **Landing 360 · sin preajuste por defecto** (opción `—`; el desplegable marca lo elegido, no lo que coincida con
      los muros) y **sin piso por defecto** (`roomFloor:false`).
- [x] **Sala con piso ⇒ visor partido abierto al entrar** (`roomVpAutoFloor`, al crear y al abrir).
- [x] **Visor externo 2D · botón `Floor` + zoom** — se parte en muros|piso según su propio `_vFloor`, y la rueda en 2D
      hace zoom anclado con encuadre PROPIO (`_vVp`); antes salía por la puerta con `if(viewerMode()!=='3d')return`.
- [x] **Colores de pista fijos por función** — gris vídeo · verde audio · rojo piso (`LANE_COL`/`laneColor`); fuera
      «Set track color…» del menú de la cabecera. El color por CLIP se conserva.
- [x] **Audio de un clip de vídeo → sólo a pistas de audio** — la validación leía `media.kind` (que es `'video'`,
      porque comparte medio con su pareja de imagen); ahora manda `isAudioClip(clip)`.
- [x] **Snap 360 · bordes horizontales y centros** — el umbral estaba en unidades de MARCO: ~4.6 px de captura en X
      pero **0.65 px en Y**. Pasa a píxeles de pantalla por eje (`SNAP_PX=7`, `snapThr(P,axis)`). Las costuras de
      borde superior/inferior, centro de muro y centro vertical del lienzo **ya existían**; eran inalcanzables.
- [x] ~~**Revisión del diff (R231b)**~~ — cinco hallazgos, todos reales: el botón DERECHO movía el clip en modo
      máscara (regresión de esta misma tanda), el fantasma del hover se congelaba al panear, la barra del visor
      externo no se repintaba al cambiar de secuencia, `roomVpAutoFloor` borraba la preferencia guardada de piso,
      y el hover repintaba en cada evento. Verificados en `scratchpad/r231b-review.mjs`.
- [x] ~~**Windows: `npm run dist` + copiar `app.asar` a las 3 instalaciones**~~ _(cierre de esta tanda)_

## 🧭 Tanda de Beltrán — 2026-07-30 (post-testeo) · CERRADA EN CÓDIGO ✅
> Spec completa: **`CORRECCIONES-360-VIEWER.md`** (arquitectura, fórmulas, anclas, etapas). Decisiones: grupo fijo de
> pistas de piso · visores 2D lado a lado (muros | piso) · quitar fold-wrap R222 · mantener seam wrap de muros.
> **⚠️ 360 listo y verificado — pendiente build+deploy en Windows.** Las tres etapas están cerradas y verificadas por
> CDP en dev sobre el Mac (`scratchpad/r230-surfaces.mjs` por píxeles + `scratchpad/r230-split.mjs` por interacción,
> `__errs` vacío en las dos). En el Mac NO se compila ni se despliega: falta `npm run dist` en la máquina Windows y
> copiar el `app.asar` a las 3 instalaciones (rutas en `CLAUDE.md`).
- [x] **Iconos de los demos** en el menú del landing (2D → `view2d`, 360 → `grid`). _(hecho)_
- [x] **Locator ~3px más arriba** para que la etiqueta no se corte abajo (regla, `drawRuler`). _(hecho)_
- [x] **Demo = recorrido completo desde el landing** — ya cableado en fuente (`startDemoProject`→`tourTrasCrear(fmt,true)`,
      pasos por parte). Sólo faltaba deploy (el `.exe` estaba viejo). _(verificado en fuente)_
- [x] ~~**360 · Etapa 1** — `lane.surf` (grupo fijo muros/piso) + colocación por superficie + quitar fold-wrap.~~ _(R229,
      verificado en R230 por píxeles: seam wrap de muros parte el clip 917+917 sin perder área; el clip de piso a
      escala 300 deja `wallsUnderFloorCols`=0 y no se sale del rect)_
- [x] ~~**360 · Etapa 2** — visor 2D partido muros|piso (lado a lado, divisor, toggle de piso, hit-testing por panel).~~
      _(R230: `vpPanels()`, divisor arrastrable con proporción persistida, botón `Floor` en `#dispSeg`, pan/zoom y
      arrastre de clip por panel; ida y vuelta pantalla↔marco con error 0)_
- [x] ~~**360 · Etapa 3** — pulido de overlays + deploy.~~ _(R230 en código: fold-wrap R222 archivado en
      `_backup/deprecated/`, overlays y grilla por panel. **El deploy queda pendiente en Windows**)_
- [x] ~~**Windows: `npm run dist` + copiar `app.asar` a las 3 instalaciones.**~~ _(2026-07-30: compilado y desplegado a
      las 3 rutas; NDI verificado vivo pese a `npmRebuild:false` — los `.node` estaban compilados contra el mismo
      Electron 42.4.1 y `DSP.ndi.start()` devolvió `true`. Visor partido, piso cuadrado, `F1/F2` y 3D comprobados)_

## 🎯 Tanda de Beltrán — 2026-07-29 (post-prueba real) · EN CURSO · R223+
> 30 ítems en 5 etapas. Decisiones tomadas con Beltrán: (1) al crear un compose, el audio linkeado de los clips
> SE ELIMINA (evita audios superpuestos); (2) nest SIEMPRE dome master (eliminar toggle R216, archivar ADR-0007);
> (3) crossfade = arrastrar el handle de fade sobre el corte (estilo Ableton); (4) demos del tour con shapes.
> Commit por etapa · verificación CDP · deploy al cierre de la tanda.
> **Las 5 etapas están CERRADAS (R223→R227). Queda el deploy de cierre de la tanda.**

### Etapa 1 · Timeline core + clips linkeados [R223] — CERRADA ✅
> Verificada por CDP con dos mp4 reales con audio (`Multimedia2/3.mp4`); capturas en `scratchpad/r223/shots/`.
- [x] Pistas de audio con diferenciación visual sutil (tinte de fondo, propuesta propia). _(R223)_ `--audio-tint`
      `rgba(150,175,130,0.045)` en `.lanehdr.aud` **y** `.lane.aud` (la clase existía sólo en la cabecera).
- [x] Swatches de "Set color" (tracks y clips) CUADRADOS (hoy rectangulares verticales). _(R223)_ 18×18 en los tres
      sitios (`colorPopup` de pista y de clip + la fila inline de `openMenu`). El truco era `min-height:18px`: la
      regla global `.menu button{min-height:26px}` los estiraba.
- [x] Clic-derecho en cualquier cabecera de pista: "New video track" Y "New audio track". _(R223)_ `trackCreateItems`
      deja de filtrar por `kind` (revierte [R110b]).
- [x] Linked video↔audio: selección INDEPENDIENTE. Link = mover juntos (horizontal), trim juntos, speed juntos,
      loop juntos; NADA más. Fade manual de video NO crea fade en el audio; fade de clip de audio = volumen. _(R223)_
      El enlace deja de vivir en la selección y pasa al GESTO: `drag.primaryIds` (selección real) vs `drag.items`
      (incluye al partner, `linked:true`); `_mirrorLinkTrim` para el recorte; `_applyClipSpeed`/`_applyLoopToggle`
      para velocidad y loop.
- [x] Libertad vertical de linkeados: video solo entre pistas de video (el audio se queda), audio solo entre
      pistas de audio. BUG: hoy mover el video linkeado arrastra el audio a una pista de video. _(R223)_ Sólo los ids
      de `primaryIds` pueden cambiar de pista — el partner (y su ghost) se queda en la suya.
- [x] Solape = CORTE sin fundido automático (no destructivo, estilo Ableton: el material recortado se puede
      re-extender). Crossfade manual arrastrando el handle de fade sobre el corte (límite = material disponible;
      efecto cross dissolve). _(R223)_ `cutOverlapsOnDrop` con los cuatro casos (tapa completa → el viejo se elimina ·
      izquierda/derecha → recorte · **dentro → dos restos** vía `razorCore`), delegando en `trimItem` para heredar
      límites de origen y rebase de keyframes. El crossfade es el gesto del handle de fade (`startFadeDrag` +
      `crossfadeNeighbor`): en **vídeo** lo dibuja el solape geométrico que `compositeClips` ya sabía hacer (fades a
      0), en **audio** la ganancia cruzada (equal-gain, suma 1). Reajustable, eliminable arrastrando de vuelta.
      Nada quedó muerto del sistema anterior: el "crossfade automático" era ese mismo solape geométrico, que se
      reutiliza — **no hay ADR que archivar**.
- [x] Locators dibujados en la MITAD INFERIOR de la barra de tiempo. _(R223)_ Banderín y=14..20, tallo desde y=12.
- [x] BUG Ctrl+R: con un locator presente renombra el locator en vez del elemento seleccionado. _(R223)_
      `state.selMarkerId` pasa a ser una selección EXCLUSIVA con clip/pista en las dos direcciones.

### Etapa 2 · Automatización [R224] — CERRADA ✅
> Verificada por CDP (dominio domo, 2 clips, un Motion **Spin** y un Effect **Glitch** aplicados); capturas en
> `scratchpad/r224/`, guiones `scratchpad/r224-{setup,chooser,sync,regress,roundtrip,shots}.mjs`. `__errs` vacío.
> **Quién decide la curva visible:** una sola fuente, `lane._autoP` (clave DE PISTA, persistida), resuelta por
> `laneAutoP` (elección guardada → si su motion/effect se fue, primer parámetro automatizado → `opacity`) y
> traducida a cada clip por `laneKey`. La escriben tres gestos: los chips del header, `focusAutoParam` (cualquier
> gesto del inspector, sólo si el modo está encendido) y `showAutomationParam`/`showAutomation` (que además lo
> encienden). Sigue siendo **una automatización a la vez** por pista [A5].
- [x] Línea de fade oculta en modo automatización. _(R224)_ `body.automode .clip .fadeenv{display:none}` — los
      handles ya se ocultaban desde R155, faltaba la polilínea, que se leía como una segunda curva no editable.
      El degradado oscuro de las esquinas se queda (es lo que sigue diciendo que hay fundido).
- [x] Dropdown IZQUIERDO: Transform, Clip, Color + cada Motion/Effect aplicado (Spin, Glitch…). Resaltar las
      opciones que YA tienen automatización. Si se elimina el motion/effect, desaparece del chooser. _(R224)_
      `autoCats(li)` es la fuente de las dos listas. Los dispositivos salen del **clip seleccionado** si está en esa
      pista, y de la unión de la pista si no. Resaltado = rombo en `--auto-live` (`autoHasKf`, alcance de clip) y la
      entrada vigente en negrita. Elegir un dispositivo aterriza en su parámetro **ya automatizado** si lo hay.
      Borrar el efecto/movimiento lo saca de la lista y `laneAutoP` deja caer la elección guardada.
- [x] Dropdown DERECHO dependiente: Transform→azimuth/elevation/size/rotation · Clip→opacity/blur/feather/crop ·
      Color→exposure/contrast/saturation/temp/tint/glow/chroma · Motion→MIX · Effect→sus parámetros. _(R224)_
      Transform lista los del **modo de secuencia activo** (en 2D ya no ofrece azimut) + cualquiera del otro modo que
      lleve automatización, para que ninguna curva quede inalcanzable. Effect = Intensity + **Reactivity** + sus
      parámetros reales (Reactivity se queda: es automatizable y sacarla del menú la volvía huérfana).
      **Motion→MIX exigió modelo nuevo:** el Mix vivía aparte, en `a.wetKf`/`a.wet` (0..1), y era el único
      automatizable que el editor de curvas no sabía dibujar. Ahora es el parámetro `mot:<param>:mix` (0-100 %) en
      `c.kf`/`c.props` — hereda evalP, setKf, drawAutoCurve, bindAutoCurve, copiar/pegar, el pool de items y el
      rebase de keyframes al recortar/partir/cambiar velocidad. `migrateMotionWet` convierte los `.isp` viejos.
- [x] Sincronía inspector↔curva visible: en modo automatización, tocar cualquier parámetro muestra SU curva en
      el clip (aunque no haya keyframe); los dropdowns siguen la selección. _(R224)_ `focusAutoParam(c,p)` +
      `trackKeyFor` (clave de clip `fx:<id>:<p>` → clave de pista `fxt:<type>:<p>`), enganchado UNA vez por gesto
      —no dentro del bucle de arrastre— en las filas de Transform/Clip/Color (fader, número, rueda, diamante), en
      las de efecto (Motion y Reactive) y en el Mix de cada Motion.
- [x] Clic-derecho en un parámetro del inspector → "Show automation" (activa vista + curva de ese parámetro).
      _(R224)_ La fila estrena menú contextual: **Show automation · Reset to default · Clear automation**. El clic
      derecho sobre el surco ya restablecía el valor de fábrica, pero era un gesto invisible y el único que había;
      ahora se ve, y las filas de parámetro de efecto tienen su propia entrada equivalente.
- [x] Auditoría del diálogo de visualizadores (hoy puede quedar una curva inaccesible). _(R224)_ Tres agujeros
      cerrados: (a) `showAutomation` del menú de clip sólo miraba `CURVE_PARAMS` → un clip cuya única automatización
      estuviera en un efecto o en un Mix abría `opacity` y su curva no aparecía por ningún lado (`clipArmedTrackKeys`);
      (b) el chooser no ofrecía los parámetros de Transform del otro modo aunque estuvieran automatizados;
      (c) elegir un dispositivo caía siempre en su primer parámetro, no en el que tenía curva.
- [x] Clic en los menús de automatización del header NO selecciona la pista. _(R224)_ Guarda `.autoctl` en
      `hd.onclick` y en `hd.ondblclick`. El `stopPropagation` de los chips era de `pointerdown`: el `click` posterior
      llegaba igual a la cabecera y `state.selId=null` se llevaba por delante el clip cuyos parámetros se querían ver.
- [x] Sin icono de motion sobre el clip. _(R224)_ Chapa ↻ archivada en
      `_backup/deprecated/20260730-clip-motion-badge.js`. También sale del código `autoDuo` (variante del chooser con
      `<select>`, sin llamadores desde R156) → `20260730-auto-duo-selects.js`.

### Etapa 3 · Inspector + adjustment + nest/compose [R225] — CERRADA ✅
> Verificada por CDP (guiones `scratchpad/r225-*.mjs`, salidas y capturas en `scratchpad/r225/`). `__errs` vacío en las
> nueve corridas · `node --check` limpio. Eliminaciones archivadas (ADR-0007): conmutador Dome master/Patch, filas de
> fundido del inspector de audio, campos de píxeles del texto.
- [x] Adjustment layer: todos los efectos; afecta lo de abajo como un solo clip fulldome; default fulldome full. _(R225)_
      El catálogo entero (`#motionFx`, `FXBY`, estático y automatizable) se construye ahora también para `c.adjust`
      —antes sólo se alcanzaba desde la pestaña Reactive FX y el inspector de la capa no mostraba ni un efecto—, con
      **claves de plegado propias** (`adjfx`/`adjeff`): reusar `clip`/`motion` dejaba el panel entero plegado, porque
      [I1] los pliega por defecto contando con que Transform queda abierto arriba, y aquí no hay Transform. Las filas
      de las secciones que no aplican se VACÍAN además de esconderse: `applySecCollapse` recorre los hermanos de cada
      cabecera y les repone el `display`, así que quedaban Azimuth/Size/Loop/Speed sueltos sobre la capa (visto en
      captura, corregido). Contrato confirmado por píxeles: un Hue Shift en la capa mueve los DOS clips de debajo
      (rojo 255,32,32 → 202,170,0 · azul 32,64,255 → 0,181,181) y quitarlo los devuelve exactos. **Color NO se ofrece**
      a propósito: el grado vive en los shaders por clip y el post-pass máster se archivó en R150 (serían mandos muertos).
- [x] Nest SIEMPRE dome master: eliminar toggle R216 (archivar), sin dome placement, equirect deshabilitado. _(R225)_
      `makeClip` nace con `fulldome:isSeqMedia(m)` y nunca autodetecta equirect para un nest; `nestSelection` y
      `createComposition` lo fijan; la fila Equirect no se dibuja para nests; salvavidas en el inspector.
      **Migración:** `migrateNestFulldome()` en `loadProject` convierte los `.isp` guardados en Patch — un proyecto de
      ayer con una composición como parche se ve a PANTALLA COMPLETA al reabrirlo (decisión asumida; el `az/el/size`
      guardado no se toca, así que el encuadre se recupera con dos arrastres). Archivo:
      `_backup/deprecated/20260730-nest-dome-placement-toggle.js`. El motor de parche (PW) queda intacto.
- [x] Fisheye solo habilitado con fulldome src activo. _(R225)_ Fila deshabilitada (opacidad .42 + `aria-disabled` +
      tooltip que dice por qué) en vez de escondida, y apagar Fulldome src apaga también el ojo de pez, para que el
      dato no contradiga a la interfaz. En un nest queda habilitada (su fulldome es siempre true).
- [x] Sin textos instructivos en Motion/Effects del inspector. _(R225)_ El párrafo de los chips y el del estado vacío
      de efectos pasan a tooltip; el estado vacío se queda en «No effects» a secas. La ayuda de la capa de ajuste
      desaparece con la sección Effects real.
- [x] Inspector de audio: sin fade in/out (queda el manual del clip) + escala del waveform. _(R225)_ Fila **Wave scale**
      (`state.tl.waveScale`, recorrido logarítmico 0,25×…8×, 1× en el centro del surco): preferencia de VISTA global a
      la línea de tiempo como «Onda a un lado», no dato del clip — no toca el sonido ni el export. Se aplica en
      `drawAudioWaveInto` (clip) y en `drawWaveInto` (inspector). `c.fadeIn/fadeOut` siguen vivos: los escribe el
      tirador de R223. Archivo: `_backup/deprecated/20260730-audio-inspector-fade-rows.js`.
- [x] Inspector de text: sin campos de pixelaje ni switch sin función. _(R225)_ Fuera `#txtSize` y `#txtLineH`: el
      cuerpo en píxeles no cambiaba el encuadre (ancho y alto del lienzo crecen los dos con el cuerpo → **proporción
      invariante**, medido: 3,790 a 300 px vs 3,784 a 90 px) sino sólo la nitidez. Los medios nuevos nacen con
      `TXT_BASE_PX`=300 y `renderTextMedia` reduce el cuerpo si el lienzo fuese a topar con 4096 px (párrafo largo →
      4093×129, sin recorte). Los presets dejan de llevar cuerpo: la jerarquía la marca `size`.
      **El switch NO estaba muerto:** medido, `Outline` añade píxeles al rásterizado (193 603 → 333 078 opacos) y su
      color cambia el resultado; lo que faltaba era el mando de ese color (`tstrokeColor` se guardaba sin control, así
      que quedaba negro sobre un domo negro → parecía no hacer nada). Se añade `#txtStrokeCol`.
- [x] Compose: duración = clip más largo (solo fotos: 5s); acortar dentro del nest acorta la instancia padre
      automáticamente (hoy solo al intentar extender). _(R225)_ `compSrcDur(srcs)`: sólo cuentan los medios con
      duración real (vídeo/audio/secuencia/nest); si todo son fijos, 5 s. Antes `max(s.dur||6)` sobre TODOS dejaba que
      un texto o una forma (dur 6) mandara sobre una composición de fotos. Verificado: 8 s+3 s → 8 · dos fotos → 5 ·
      foto+vídeo de 3 s → 3 · texto+foto → 5. El acortado lo hace `clampNestInstances(nestId)` colgado de
      `saveActiveSeq` —el punto por el que pasa siempre que se abandona o se guarda una secuencia—: contenido de 8 s
      recortado a 4 s dentro ⇒ la instancia del padre pasa de 8 a 4 al volver. Sólo recorta (extender sigue siendo
      manual) y respeta los clips en bucle.
- [x] Compose desde clips con audio: el audio SE ELIMINA. _(R225)_ Los clips de audio enlazados a la selección no
      entran al nido y se borran de la línea de tiempo (4 clips → 1). La copia de vídeo de dentro conserva `avRole:'v'`
      sin `link`: es el flag que impide que el nest vuelva a sacar el sonido del archivo original por dentro.
- [x] Audio de nest: si el nest tiene pistas de audio (agregadas dentro), el padre muestra clip de audio DERIVADO
      linkeado (deslinkeable); doble clic entra al nest; acortar dentro acorta ambos; proxy conserva ese audio;
      REGLA: nunca suena audio no visible en una pista de audio. _(R225)_ `syncNestAudioClips()` crea/retira el
      derivado (clip de audio cuyo `mediaId` ES el nest + `nestAudioOf`, con el `link`/`avRole` de R170/R223) al
      componer, al aterrizar en una secuencia y al abrir proyecto. **Tres vías de fuga cerradas** para la regla de oro:
      (a) `collectAudioEvents` sólo desciende a un nest si el clip está en pista de AUDIO; (b) `vinstAudio` devuelve
      null para nests, así que el `<audio>` del proxy horneado ([R180]) no suena; (c) dentro de un nest (depth>0) el
      `<audio>` de previsualización de los clips de vídeo va con ganancia 0. Medido: con derivado 1 evento, sin
      derivado 0, con su pista muteada 0. El proxy sí conserva el audio (`ncBuild` exporta el nest como nivel superior,
      donde sus pistas de audio son de primer nivel: 1 evento al hornear). Consecuencia asumida: un vídeo dentro de un
      nest cuya mitad de audio no existe (archivo por encima de `LINK_MAX_BYTES`) queda mudo — que es lo que la regla pide.
- [x] Botones ⚡Clip / ⚡Comp en la toolbar de proxy. _(R225)_ Los dos comparten el icono de rayo y se distinguen por
      el rótulo (`Clip` = proxy de cada clip · `Comp` = proxy de composición); el desplegable `vpMore` estrena la
      entrada del segundo, que antes no aparecía en ningún sitio cuando la barra se estrechaba.
- [x] Al arrastrar un clip a media: buscar proxy existente en la carpeta de origen automáticamente. _(R225)_
      `addVideo` (el camino de `importFiles`, diálogo y arrastre) llama a `attachExistingProxy`, que existía desde
      R107 pero sólo corría al REABRIR proyectos. Medido: al importar un archivo con su proxy al lado queda
      `proxyReady` en 201 ms, el visor ya usa el proxy y **nadie encoló nada** (la generación sigue manual, ADR-0003).

### Etapa 4 · Mask en canvas + viewer window [R226] — CERRADA ✅
> Verificada por CDP (guiones `scratchpad/r226/t-*.mjs`, capturas en `scratchpad/r226/shots/`, `__errs` vacío en
> todas las corridas). Ver la entrada ROUND 226 de `PLAN.md` y las fichas [I3] y [V1] de `COMPONENTS.md`.
- [x] Pen mask editable EN EL CANVAS (no en el inspector). _(R226)_ `startMaskEdit`/`drawMaskEditOverlay` +
      `penPix`/`penFromPix`: los puntos se proyectan por el MISMO camino que el contenido (`flatPlace` en 2D/sala;
      parche gnomónico + azimutal-equidistante con `rot`/`mirror`/wrap de diámetro en el domo) → **error de ida y
      vuelta 0 px** en los dos modos. Clic añade · arrastre mueve · doble clic quita · Esc/Done cierra; pill de modo
      y gestos normales suspendidos. Mini-editor del inspector archivado (ADR-0007). De paso: `loadProject` v4 no
      rasterizaba las pen masks al abrir (el clip salía sin recortar).
- [x] Viewer-only window: arreglar el cuelgue + vista COMPLEMENTARIA (principal 2D ⇄ ventana 3D), domo y 360,
      con las herramientas básicas del visor mostrado (2D/3D, grilla, borde, horizonte + las del 3D). _(R226)_
      **Causa raíz del cuelgue: el `gl.readPixels` síncrono del espejo, dentro de `render()`** — `render()` pasaba de
      0,05 a 9,66 ms (≈200×) y la reproducción de 60,4 a 36,6 fps con una escena trivial. Ahora `viewerPaint()`
      intercambia los globales de vista y copia `glc`+`gridc` con `drawImage` (1,5–2,7 ms), el bombeo es el rAF
      PROPIO de la emergente con marca de sucio, y la ventana lleva su barra (2D/3D · Grid · Horizon/Seam/Center ·
      Orbit/Viewer) con CSS auto-contenido. Camino viejo archivado (ADR-0007).

### Etapa 5 · Tour/demos + File [R227] — CERRADA ✅
> Verificada por CDP (guiones `scratchpad/r227-*.mjs`, capturas en `scratchpad/r227/`, `__errs` vacío en todas las
> corridas). Ver la entrada ROUND 227 de `PLAN.md` y la ficha [Recorrido guiado + proyectos demo] de `COMPONENTS.md`.
- [x] File en proyecto: solo "New project…" → pregunta guardar si dirty → LANDING. El tour ya no aparece al
      crear proyecto. _(R227)_ `newProjectViaLanding()`: una entrada (⌘N, la paleta y `#newBtn` van al mismo sitio) y
      **pregunta de TRES salidas** (`appConfirm3` → guardar / descartar / cancelar; `confirmDiscard` sólo ofrecía
      descartar o cancelar, y perder el trabajo no podía ser el único camino). El proyecto abierto **no se toca**:
      sigue detrás del launcher y **«Back to project»** lo devuelve con sus cambios (el launcher no se puede cerrar;
      sin esa salida la entrada era una puerta de un solo sentido). `_descartarYaDicho` evita la doble pregunta.
      Los dos diálogos de creación que quedaron sin llamantes están archivados (ADR-0007); `roomSetupDialog` sigue
      vivo en Project → «Room geometry…».
- [x] Botón de configuración en el landing → Demo Domo / Demo Flat / Demo 360 (generados con shapes/texto/solids
      + automatizaciones + compose + efectos). Tour guiado completo (timeline, clip+inspector, automatización
      con curvas, compose) y al terminar el demo queda libre para editar/guardar. _(R227)_ Botón **«Demos»** en la
      barra superior del launcher, junto a «Open project». Cada demo son ~22 s con 4 pistas, un fondo con Motion, una
      **composición de 2 clips** (por el mismo `nestSelection` del usuario), un clip con Motion + Efecto +
      automatización de posición + automatización del MIX del Motion, y un texto con curva de opacidad; la sala
      reparte contenido en Left / Front+Back / Right y el **suelo**. Sólo medios generables → ningún archivo en disco.
      El recorrido pasa a **9 pasos** con `act` por paso (selecciona el clip, cambia a la pestaña Reactive FX,
      enciende la automatización, resalta el nest). El demo arranca sin ruta y sin historial: se edita y se guarda
      con el Save normal (verificado: guardar + reabrir conserva clips, nest, curvas, motions y efectos).

**[R228] Correcciones del code review de la Etapa 5** (8 revisores; guiones `scratchpad/r228-verify*.mjs`, captura
`scratchpad/r228-demo-flat-canvas.png`, `__errs` vacío en todas las corridas):
- **Bugs.** `_demoKf` pasaba `'easeInOut'`, un token que `easeF` no conoce → TODAS las curvas del demo interpolaban
  LINEAL y el token falso se guardaba en el `.isp` (ahora `'both'`). **La trampa de la puerta única del launcher:** el
  consentimiento de descartar deja de ser una bandera global de un solo uso (`_descartarYaDicho`) y pasa a ser de la
  SESIÓN del launcher (`_lch.discardOk`), viajando explícito como `skipConfirm`; `hideLanding()` ya no borra
  `_lchVolver` (lo hace `lchLeave()`, sólo al salir con éxito), así que cancelar a mitad de camino devuelve al launcher
  **con «Back to project»**. `buildDemoProject` mira el booleano de `newProject`. `appConfirm3` con Enter responde el
  botón ENFOCADO, no siempre Guardar. El paso «2D and 3D» tiene copy propio en 2D plano (ahí no hay 3D). El `catch` de
  `startDemoProject` vuelve al landing en vez de dejar un proyecto mestizo. El acto del paso «Automation» mete la
  selección en su guard `cambio` y corrige una selección rancia.
- **Calidad.** `_dialogBase` = andamiaje único de `appConfirm`/`appConfirm3`. `revealAutomation(c,p,opts)` = gesto
  compartido por `openAuto`/`showAutomationParam`/el recorrido. `_demoBatch` = build del demo en LOTE (0 snapshots de
  undo y 3 repintados en vez de ~10). `_demoFx` crea por `addFxToClip`. `_demoFinish` reusa `fitAll()`. Fuera el
  cinturón muerto de pistas (`ensureVideoLanes(4)`). `lchCreate` ya no se traga los errores en su `.catch`.
- **DIFERIDO (decidido, no hacer hoy):** consolidar los tres `_demoBuild*` en un script configurable por formato — el
  churn supera el beneficio mientras sólo hay tres formatos y los ayudantes ya están compartidos. La rama web de
  `saveProject` (`dlBlob`) marca limpio sin confirmación de escritura: SABIDO Y ACEPTADO (el objetivo de distribución
  es el `.exe`), documentado en el propio código.
- [x] **Hallazgo suelto ARREGLADO en R228** (decisión: manda el control): `newProject` ahora respeta la resolución
  de domo elegida en el launcher (`seqW/seqH = w` cuadrado, clamp mínimo 512; antes forzaba 4096 siempre).
  Verificado por CDP: launcher a 2048 → proyecto 2048².

## 📋 Tanda de Beltrán — 2026-07-27 · EN CURSO
> Orden: primero lo independiente y barato, luego el landing **de una sola pasada** (son 8 puntos del mismo sitio),
> y al final lo conceptual. Las tandas 1-3 no dependen entre sí: se pueden reordenar sin coste.

**Ya hecho y desplegado en R190 — sólo falta que Beltrán lo pruebe:**
- [x] En rendering, Close = Cancel mientras renderiza · fuera el botón de restart. _(R190)_
- [x] La carpeta del export se abre sola al terminar. _(R190)_

### Tanda 1 · Editor: velocidad 🟢 — CERRADA _(R195)_
- [ ] ~~Ctrl+T / Ctrl+Shift+T para pistas nuevas~~ — **APLAZADO por Beltrán** (2026-07-27): «no hagamos lo del
      comando todavía». Sigue en pie que hoy Ctrl+T/D son contextuales (R93, automatización).
- [x] **Velocidad: `.field` como el resto de parámetros** — arrastre 50-200%, doble clic para escribir. _(R195)_
- [x] **Cambiar la velocidad estira o encoge el clip**, y su automatización viaja con él. _(R195)_
      Respuesta de Beltrán: la velocidad es POR CLIP, sólo afecta a ese clip, y la automatización se ajusta a la
      nueva extensión porque las automatizaciones también son por clip.
- [x] **La X de eliminar secuencia, más pequeña** (11 → 8,5 px; el área de clic se mantiene con el relleno). _(R195)_

### Tanda 2 · Transform de una composición 🟡 — CERRADA _(R196)_
- [x] **Rotación aplicable a un compose desde el Transform.** _(R196)_ La fila ya estaba; el camino `fulldome` no la
      leía. Ahora `rot` se suma al azimut — sumar y no sustituir mantiene intactos los proyectos que giraban con `az`.

### Tanda 3 · Landing — CERRADA _(R197 + R198)_ 🟢
- [x] Quitar el **botón de configuración**. _(R197)_
- [x] Quitar **Uniform** (así se gana espacio). _(R197)_ Los muros pasan a editarse **por separado**, que es lo que
      hace falta para que en la tanda 4 los ángulos salgan de las medidas de cada muro.
- [x] **Preset a la derecha** de la elección de muro, con **Guardar + desplegable**. _(R197)_ Los propios se guardan
      en el navegador (`ispRoomPresets`), no en el proyecto: son preferencia del equipo, no parte de la obra.
- [x] **Facing con desplegable** para elegir el muro. _(R197)_ Antes daba vueltas a un botón: con cinco
      orientaciones costaba hasta cuatro clics y no se veía cuáles había.
- [x] **Canvas igual que el 2D Flat**. _(R198)_ El lienzo cosido se dibuja por el camino **2D de la sala** del
      editor (marco, retícula, costuras, rótulos de muro), no por el painter `drawRoomStrip`.
- [x] **Domo: la línea de borde no sigue el ángulo del domo.** _(R198)_ Era el 3D del editor, no sólo el landing:
      `FS3` dibujaba el contorno a `90.0` cenitales fijos y el borde de la malla está en `cov/2` → nuevo uniforme
      `u_rimDeg`.
- [x] **Floor en las configuraciones**: pixelaje editable, medidas de sólo lectura. _(R198)_ Override en
      `_lch.floorPx`; las medidas salen siempre de la huella de la sala.
- [x] **360: visor 3D real** en vez del esquema de líneas gruesas. _(R198)_ `lchEditorShot` monta una secuencia de
      sala temporal (`lchRoomSeqTemp`) → `renderRoom3D` de verdad, arrastrable. La planta se queda en su panel.
- [x] **(no estaba en la lista) El botón «Create 360 Room project» estaba recortado** — con cuatro muros el panel
      no cabía y `overflow:hidden` se comía la acción: no se podía crear una sala desde el landing. _(R198)_
      `.lch-pbody` scrollea; salida máster y botón quedan fijos abajo.

### Tanda 4 · Geometría de la sala 360 — CERRADA _(R199)_ 🟢
> Aclarado por Beltrán (2026-07-28): **«no quiero fijarlo mano a mano»** — los ángulos salen de las medidas, no hay
> control para tocarlos. Esa decisión es la que define toda la tanda.
- [x] **4 muros = cuadrado, con los ángulos determinados por las medidas de cada muro · 3 muros = U · 2 muros = L.**
      _(R199)_ `roomPlan` reescrita: el grado de libertad del cuadrilátero se fija repartiendo la inclinación por
      igual entre los laterales (antes se promediaban sus anchos → sala siempre simétrica), y las formas dejan de
      depender de qué roles se elijan (antes 2 y 3 muros desde el launcher caían a un salvavidas a 120°).
      Extra: `plan.imposible` avisa cuando esas medidas no cierran ninguna sala.
- [x] **La PLANTA DEL LANDING se ajusta al visor**, cambiando de escala sin cortarse. _(R199)_ Se mide la caja de
      toda la tinta, rótulos incluidos, y se encoge hasta que entra. Control contra el `.exe` de R198: ahí se
      salía del lienzo con 2 y 3 muros.

### Tanda 5 · Fill dome — CERRADA _(R202)_ 🟢
- [x] **Opción «flat tile» en la configuración de Fill dome.** _(R202)_ El modo existía desde [N5] (`g.noWarp`) pero
      sólo se alcanzaba desde el **inspector** de una composición ya creada: al crearla no había forma de pedirlo.
      Ahora está en el diálogo (`#cNoWarp`), entra en la vista previa y en los `opts` de Crear/Aplicar, y la vista
      previa deja de dibujar sectores curvados cuando está marcada (antes mentía justo en esa opción).
      Cada baldosa conserva su proporción real; lo que la curva es la propia proyección del ojo de pez, y los
      anillos se repiten hacia arriba y hacia abajo — que es lo que pedía Beltrán.

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
- [x] **Pasada visual** — el supuesto de las capturas negras era falso: `Page.captureScreenshot` devuelve el WebGL renderizado con la ventana en segundo plano. Las capturas de `scratchpad/shots/` lo demuestran. _(R167)_
- [x] Tres checkboxes nativos fuera del sistema de toggles: `#bkToggle`, `#txtStroke` (Clip), `#motionPrev` (Motion). _(R166)_ — pasan al `.iosw` del diseño vía `ioswHtml`/`ioswBind`, un puente que expone `.checked` y emite `change`, así que los `onchange` que ya existían siguen valiendo sin tocarlos.
- [x] Verificar el **waveform de audio** con un archivo real _(R167)_ — `Umbral.wav` (35,6s · 44,1k · 24-bit). El pico dibujado (0,2489) coincide con el del archivo (0,2486), sin recortes, pico/RMS 1,81 (dinámica real), 180 BPM y 171 golpes detectados, espectro de 32 bandas variando en el tiempo y el medidor pintando el 69% de su lienzo.
- [x] **Etapa 6a · Splash de carga** — ventana propia de 1080² → editor en 16:9 _(R151)_. Handoff nuevo en
      `scratchpad/redesign/design_handoff_launcher_splash/` (`Loading Splash - Rev 1.dc.html` + README).
- [x] **Etapa 6b · Launcher (landing)** — hecho _(R153)_ con los **visores reales del editor** (`drawSeqViz`,
      `drawRoomIso`, `drawRoomStrip`) en vez de los SVGs del prototipo. Alto estable en los tres tipos y sin scroll,
      verificado. El segundo panel de Domo (domo 3D) se cerró en **R155** con `drawDomeIso` (pintor 2D propio, no WebGL) y responde al ángulo 180/200/210/220.
- [x] Etapa **7 · variantes por formato** (360 / 2D) del editor. _(R168)_ Método: en vez de auditar tres maquetas casi idénticas, `scratchpad/handoff-diff.mjs` aísla lo que VARÍA entre ellas (20 textos de 115). Resultado: el botón del máster se llama **Canvas** en 2D y sala (**2D** sólo en domo), el 3D no existe en 2D plano, y el tercer hueco de superposición cambia de FUNCIÓN — Horizon (domo) · **Center** (2D, guías nuevas) · **Seam** (sala, juntas de muro). Antes ese botón se ocultaba en 2D y en sala, dejando ambos formatos sin control.

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
- [x] **[V3] Spout In** — Spout como fuente en Media. _(R167)_ Receptor añadido al addon existente (`inList/inOpen/inFrame/inClose` sobre la misma `SpoutDX` vendorizada, instancia aparte de la del emisor). Verificado contra el `TDSyphonSpoutOut` real de Beltrán.
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
- [x] **[F7 fase 2]** — equirect en el **visor 3D** (esfera completa) + **auto-detección 2:1** al importar. _(R169)_ Y por el camino apareció que la fase 1 mostraba los panoramas **del revés** (el suelo sobre la cabeza): signo equivocado en la v de `FSEQ` frente al `UNPACK_FLIP_Y_WEBGL=true` de `upTex`.
- [x] ~~**[D2]** — cola/encoder de export en segundo plano con snapshot congelado.~~ **FUERA DE LA COLA por decisión de
      Beltrán (2026-08-04): «lo mejor es no seguir editando mientras exporta».** Ver la sección de abajo — no es un
      pendiente aplazado, es una decisión que además cierra deuda.

## Necesitan el entorno de Beltrán para cerrarse
- [x] **[V3] Spout In** — CERRADO en R167 con el emisor real de Beltrán encendido.

## En pausa por Beltrán (no tocar hasta aviso)
- **[P1] Mac + [D5] instalador cerrado** — hasta que Beltrán lo pida.
- **[D4] Grilla 3D infinita** — RETIRADA de la cola: idea que Beltrán quiere **reestructurar** antes de encararla (fase 2).
      Solo queda la nota de diseño (dejar el mapeo de salida como capa "output target" intercambiable cuando se toque el motor).
- **[D2] Encoder en segundo plano** — RETIRADO de la cola (2026-08-04). Beltrán, tras repasar el coste: **«creo que lo
      mejor es no seguir editando mientras exporta; quizás dejémoslo fuera. Para un futuro podría ser.»**
      **Lo que ya funciona y NO hace falta tocar:** la cola de trabajos existe (`pumpExportQ`/`#exQueue`) y encola varios
      con su progreso — un export «Each wall + floor» ya lanza N+1 trabajos seguidos.
      **Lo que se descarta:** levantar el scrim para poder editar durante el export, y con ello el snapshot congelado y
      el worker con OffscreenCanvas + contexto GL propio (el motor es WebGL2 + WebCodecs en el renderer; sacarlo fuera
      son varias rondas, no una).
      **Consecuencia que conviene no perder:** al decidir que NO se edita durante el export, **el scrim pasa a ser la
      solución, no un parche**, y el snapshot congelado deja de ser deuda. Con eso se cierra el pendiente condicional
      que dejó la auditoría de 2026-07 («se vuelve urgente si se permite editar con jobs en cola», `AUDITORIA-2026-07.md`
      líneas 42 y 340): la condición ya no se va a dar. Si algún día se reabre, ese es el punto de partida.

---

## Ya cerrado (referencia)
Grado de color completo (LUT + ruedas + curvas), fix bordes automatización, splash 1080², menús File/Edit/Window,
Etapas 0-5 + 9, sistema de documentación (COMPONENTS/ARCHITECTURE/ADR), limpieza automatización legacy (R137/R137b).
Detalle en `PLAN.md`. [F2] auditado sin descuadre · [U3] toggle grilla ya existe · [C2]/[C3] cubiertos.
