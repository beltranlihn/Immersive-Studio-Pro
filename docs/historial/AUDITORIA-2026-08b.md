# Auditoría 2026-08b — delta R247c→R252b y compatibilidad con el trabajo en curso

> ## VEREDICTO: **PUEDE ACTUALIZAR SIN MIEDO.** Abrir un proyecto hecho con el build anterior (R246/a33c70b) con el build nuevo deja el estado, los 28+9 bucles medidos, las composiciones y los PÍXELES del render **byte a byte idénticos**. No hace falta ninguna migración de datos.
>
> Lo que sí hay: **una instalación legacy (`C:\Program Files\Dome Studio Pro`) se quedó SIN el delta** (sigue en R246), un fallo real en el mando nuevo de intensidad de Flotar (el arrastre muere al primer paso), un efecto lateral del botón Source del inspector (escribe marcas en el MEDIO sin undo), y un cambio de comportamiento **deliberado pero no anunciado** en la envoltura fx/fy del domo que puede hacer desaparecer clips con Slide de mucha amplitud en proyectos viejos (censo en este equipo: **cero clips afectados**).

**Método.** Fixture «proyecto viejo» fabricado y guardado CON el código viejo (worktree `../isp-old` en a33c70b, dev en `:9223` — corre también en la RTX 4060), reabierto con esa misma app vieja para tomar la instantánea de verdad (estado + `srcT` de cada bucle + píxeles del composite leídos del FBO), y sólo entonces abierto con el **`.exe` desplegado** (`:9222`, verificado build nuevo por huella de funciones y RTX 4060 por `WEBGL_debug_renderer_info`; el `app.js` del asar canónico es **byte-idéntico** al HEAD del repo). Gestos con eventos de ratón/teclado reales (`Input.dispatchMouseEvent/KeyEvent`). Copias de los proyectos reales en `scratchpad/` (los originales no se tocaron). Sondas: `scratchpad/aud8b-*.mjs` (lista al final).

---

## 1 · Lo que AGUANTA, con su prueba

| Qué | Prueba | Resultado |
|---|---|---|
| **Fixture viejo→nuevo, ESTADO completo**: 15 clips (bucles con `loopLen`/`inP`/`loopRev`/estirados más allá de la fuente, par A/V enlazado y loopeado, nido loopeado con clip loopeado dentro, kf, máscara, motion), 6 secuencias, 3 composiciones con retoques manuales (`_layBase`) y `mediaIds` fuera del orden del panel, secuencia 2D con el `pulse` viejo sobre `size` | `aud8b-compara.mjs` contra `aud8b-viejo-estado.json` | **IDÉNTICO** campo a campo |
| **`srcT` de los 9 bucles del fixture** en 6 instantes cada uno (el «mismo fotograma en un instante dado») | ídem | **IDÉNTICO** al 4.º decimal |
| **Píxeles del composite** (domo 2048² en 4 instantes · 2D 1920×1080 en 2) | ídem (hashes del FBO: `8a30db5c…`, `98c2bf70…`, `3dd12b80…`) | **IDÉNTICO** viejo vs nuevo |
| **RitoDome.isp (copia)**: 26 clips, 23 con bucle (28 `srcT` contando los de dentro de nidos), 3 composiciones, 6 secuencias | `aud8b-rito-viejo.mjs` (app vieja) + `aud8b-compara.mjs` (exe nuevo) | **IDÉNTICO**, 0 medios ausentes |
| **Rito360.isp y RitoFlat.isp (copias)** | ídem | **IDÉNTICO** (RitoFlat con 2 medios ausentes en los DOS builds por igual: rutas que no existen en este equipo) |
| **R248 · Abrir el diálogo de cada composición y Aplicar sin tocar nada** | `aud8b-gestos.mjs` §9, clic real en Apply, píxeles antes/después | `mediaIds` intactos y en su orden · **ni un píxel cambia** (t101.3 y t103.7) |
| **R248 · La cesta**: arrastre real de un medio del panel al diálogo | ídem | entra, se resalta al pasar, **nada cae a la línea de tiempo**, Escape cancela sin tocar la composición |
| **R249 · El doble clic** en un medio abre el monitor y **no suelta clip** | `aud8b-gestos.mjs` §1, doble clic real | correcto (15→15 clips) |
| **R249 · Marcas + arrastre desde el panel**: marcar 10→14 s con los botones y arrastrar desde el panel | §2, gestos reales | el clip cae con `inP 10 · dur 4` (más su mitad de audio enlazada) — las marcas mandan |
| **R249 · Sin marcas nada cambia** (`srcRange` = null con archivo entero) | fixture: todos los arrastres previos + estado idéntico | correcto |
| **R250 · Renderizar el inspector de CADA clip loopeado no muta nada** (la fila nueva es de sólo lectura hasta que se toca) | §4: los 8 loopeados, campos antes/después | intactos, la fila «Loop range» aparece |
| **R250 · «Del clip» / `setLoopRange`** no recorta ni apaga: `loopLen` 6→30 con `dur` 40 intacta; 999 se acota a la fuente | §5, clic real | correcto |
| **R250 · `_applyLoopToggle` no ganó llamadores** (el recorte al apagar sólo ocurre en `toggleLoop`, como siempre) | censo estático (`app.js:11008-11009` únicos call sites) | correcto |
| **R251 · Copiar/pegar VARIOS clips** con Ctrl+C/Ctrl+V reales: 3 clips (kf + motion incluidos) | §6 | caen en 130/134/145 conservando distancias, pistas, kf y motion |
| **R251 · La colocación nueva de composiciones NO toca las existentes** | estado idéntico del fixture y de RitoDome (los clips de compose siguen en sus pistas V6-V8) | correcto |
| **R252 · El chip Pulsar en 2D estampa `scale`** (clic real); **el modificador viejo sobre `size` queda tal cual** (inerte, nadie lo migra en silencio) | §7 | correcto |
| **R252 · Flotar estampa el acorde** x/y/rot con `grp`/`gid` | §8 | correcto (el fallo es el deslizador maestro — hallazgo 2.3) |
| **Legacy**: `.rdome` v2, `.ise` v3→v4 con reapertura, y `.isp` con BOM | `aud2608-legacy-migra.mjs` + `aud2608-legacy-bom.mjs` re-ejecutadas sobre el exe nuevo | sin regresión (las correcciones de R242 siguen en pie) |
| **Hacia atrás**: un `.isp` guardado por el build NUEVO abierto en la app VIEJA | `aud8b-retro.mjs` | abre limpio; los 8 bucles y las 3 composiciones intactos; `srcIn`/`srcOut` viajan como equipaje inerte. **Los únicos campos nuevos del formato son `srcIn`/`srcOut` en `serMedia`** (§10 de gestos) |
| **El asar desplegado ES el código auditado** | sha1 + extracción: `app.js` del asar canónico == HEAD byte a byte | correcto (la excepción es el hallazgo 2.1) |

Sobre el permiso explícito de Beltrán (los bucles pueden variar su punto de arranque): **no hizo falta usarlo** — ni siquiera el punto de arranque cambia.

---

## 2 · Hallazgos

### 2.1 · [VERIFICADO · **MEDIA**] La instalación de `C:\Program Files\Dome Studio Pro` se quedó SIN el delta entero

**Qué pasa.** El asar canónico y el de `%LOCALAPPDATA%\Programs\dome studio pro` son idénticos (sha1 `03bf3c5b…`, 2026-08-05 00:38 = HEAD). El de `C:\Program Files\Dome Studio Pro` es **otro** (sha1 `e6eb8da0…`, 2026-08-04 20:50) y **no contiene ninguna función de R247c-R252b** (`setLoopRange`, `openSourceMonitor`, `weaveLayout`… ausentes): es el build pre-delta. La causa evidente es que ese destino requiere elevación y el último deploy no la hizo.

**Riesgo.** Si Beltrán abre por el acceso viejo de Program Files, edita con el comportamiento viejo (doble clic suelta clips, sin monitor, sin tramo de bucle…) y el proyecto va y viene entre builds — exactamente la confusión que el ritual de 3 instalaciones quiere evitar. Los archivos en sí no se corrompen (compatibilidad verificada en las dos direcciones), pero el «¿por qué aquí no está lo nuevo?» está servido.

**Cómo se reproduce.** `sha1sum` de los tres `resources/app.asar` (o buscar `setLoopRange` en el binario).

### 2.2 · [VERIFICADO · MEDIA-BAJA] La envoltura fx/fy del domo cambió: lo que antes se apelotonaba en el borde ahora desaparece bajo el horizonte

**Qué pasa.** R247c cambió en `drawClip` la reproyección de los desplazamientos `fx`/`fy` de `f2azel` (acotada: `min(r,1)`) a `f2azelUnclamped` (`app.js`, junto a `f2azel`). Consecuencia sobre proyectos VIEJOS: un clip con modificador Slide (`fx`/`fy`) cuya amplitud lo saque del disco **antes quedaba clavado en el borde (el=0) y seguía viéndose; ahora se hunde bajo el horizonte y desaparece** hasta que la onda lo trae de vuelta.

**Medido.** Barrido numérico con las DOS fórmulas sobre el mismo clip (`aud8b-fxwrap.mjs`): con `fx` amp 0,9 y `fy` amp 0,5 (el=35), **37 de 81 instantes** salen del disco, con `el` viejo=0 vs nuevo hasta **−24°**. Y en píxeles (`aud8b-fxwrap-pix.mjs`, mismo fixture en los dos builds): en t=120,4 la app vieja pinta **160 343** píxeles no-negros (clip clavado en el borde) y la nueva **105 131** (hundido) — hashes `5392244e…` vs `2c1178a7…`, estables en dos pasadas cada uno.

**A quién afecta.** Sólo clips de DOMO con modificadores `fx`/`fy` (Slide ↔/↕ o manuales) de amplitud suficiente para salir del disco. **Censo de los proyectos de este equipo: cero** (RitoDome tiene un único modificador, `spin`; Rito360 y RitoFlat, ninguno). El proyecto real del otro ordenador habría que censarlo igual (la sonda sirve tal cual). Nota: es la corrección de un defecto (el apelotonamiento en el borde era feo y R252/Flotar lo necesitaba), no un descuido — pero es un cambio visual silencioso sobre material viejo y hay que decirlo.

### 2.3 · [VERIFICADO · MEDIA-BAJA] R252b: el arrastre del deslizador maestro de intensidad muere al primer paso

**Qué pasa.** En `buildAnimList` (fila maestra del acorde), `sl.oninput` llama a `setAnimGroupInt(...)` y acto seguido a **`buildAnimList(cc)`**, que hace `host.innerHTML=''` y **destruye el propio deslizador que se está arrastrando**. El primer evento `input` llega; los siguientes van a un elemento muerto.

**Medido** (`aud8b-gestos.mjs` §8, arrastre real de 100 % hacia 200 %): la intensidad queda en **109 %** y el arrastre deja de responder — el usuario tiene que soltar y volver a agarrar por cada pasito. Sin errores JS (por eso no se vio: la verificación de R252b movía el valor por API, no con el ratón).

**Arreglo evidente** (no aplicado): en `oninput`, actualizar sólo el rótulo % y los `amp` (ya lo hace `setAnimGroupInt`) + `render()`, y reconstruir la lista en `onchange` (al soltar). Los modificadores de abajo muestran su `amp` desactualizado durante el arrastre — aceptable, o refrescar sólo esos textos.

### 2.4 · [VERIFICADO · BAJA] R249: el botón Source del inspector ESCRIBE las marcas del clip en el MEDIO, sin undo y sin marcar sucio

**Qué pasa.** `openSourceMonitor(m,{inP,dur})` (camino del botón `#selSrcMon` del inspector) hace `m.srcIn=…; m.srcOut=…` sobre el MEDIO compartido. Medido (`aud8b-gestos.mjs` §3): con `c_trim` (inP 20, dur 6,5) seleccionado, pulsar Source deja `vidC.srcIn/srcOut = 20/26,5` — **sin `pushUndo` (0→0) y sin `markDirty`**. Desde ese momento, **todo arrastre de ese medio desde el panel entra recortado a 6,5 s** en vez de los 50 del archivo, sin que el usuario haya «marcado» nada: sólo quiso mirar la fuente de un clip. Ctrl+Z no lo deshace (no hay snapshot), y el asterisco de proyecto sucio no aparece aunque el estado ya difiere de lo guardado.

**Matiz.** Es coherente con el modelo «las marcas son del material» y las marcas se ven al abrir el monitor — pero un gesto de SÓLO MIRAR no debería reescribir estado del proyecto sin rastro. Decisión de diseño para Beltrán (ver plan, acción 4).

### 2.5 · [VERIFICADO · BAJA] R249: los botones ⇤ [ ] ⌫ del monitor SE MUEVEN al marcar (el rótulo del rango cambia de ancho)

En la fila de transporte, el rótulo `Range …`/`Full clip` está entre los botones y su ancho cambia con el texto → **[ ] y ⌫ se desplazan horizontalmente justo después de pulsar [**. La probabilidad de puntear ⌫ (borrar marcas) queriendo pulsar ] es real: le pasó al propio arnés de esta auditoría (el clic aterrizó en ⌫ y borró las marcas recién puestas). Arreglo: ancho fijo (`min-width`) para `.smnum[data-n="r"]` (y de paso el de tiempo).

### 2.6 · [VERIFICADO · BAJA] R248: abrir el diálogo de composición estando ya abierto APILA un segundo diálogo

Con el velo transparente al ratón, el menú sigue accesible y `openCompose` no comprueba si ya hay un `#compOv`: se apilan dos (medido: 2 y hasta 3 en pasadas repetidas). La salida es benigna — cada Escape cierra el suyo y al final `_composeDrop` queda limpio y sin velos huérfanos (verificado) — pero mientras conviven, `_composeDrop` apunta sólo al último y los arrastres alimentan la cesta equivocada. Guardia de una línea en `openCompose`.

### 2.7 · [OBSERVACIÓN · sin acción] Los modificadores `pulse` inertes sobre `size` en secuencias 2D (pregunta §2.1 del encargo)

Censo sobre los proyectos de este equipo: **cero casos** (un solo modificador en total, `spin`, en RitoDome). El fixture demuestra además que el build nuevo **no los migra ni los toca**: siguen presentes e inertes, y el chip nuevo añade `scale` sin borrar el `size` viejo. **Recomendación argumentada: NO migrar.** Un modificador que nunca hizo nada, al migrarlo a `scale`, haría aparecer un latido que Beltrán nunca vio ni aprobó en material ya montado — el coste (sorpresa visual silenciosa) supera al beneficio (honrar una intención de hace semanas que ya se re-expresaría con un clic). Si acaso, detectar y avisar (plan, acción 6).

### 2.8 · [OBSERVACIÓN · menor] El doble clic sobre el NOMBRE de un medio sigue renombrando

El renombrado en línea (previo al delta) captura el doble clic sobre `.mname`/`.tlbl`; el monitor sólo se abre doble-clicando el resto de la ficha. Quien apunte al nombre esperando el monitor obtiene un cuadro de renombre. No es del delta y quizá es hasta deseable — se deja anotado porque el doble clic acaba de cambiar de significado y la zona «que renombra» no se distingue visualmente.

### 2.9 · Trampas del arnés nuevas (para la lista del encargo — ya cobraron tiempo en esta sesión)

1. **La primera pasada de render tras abrir un proyecto difiere** (texturas/nidos a medio calentar): toda comparación de píxeles necesita un tiro de calentamiento descartado y doble lectura verificada.
2. **`composite()` a pelo no basta**: `render()` llama antes a `prepNests`; hay que leer el compFBO como lo deja `render()` (o los nidos salen negros).
3. **El confirm de autosave** («An autosave newer…») bloquea las aperturas por sonda si la sonda anterior guardó con `DSP.writeText` directo: llamar `clearLiveAutosaves()` antes de abrir.
4. **Los botones del monitor se mueven** al cambiar el rótulo del rango (hallazgo 2.5): medir el rect JUSTO antes de cada clic.
5. **La barra de herramientas flotante tapa el borde izquierdo del panel de medios** y el nombre renombra al doble clic: el punto de clic de una ficha hay que elegirlo con `elementFromPoint`.
6. Un item de panel puede estar **desplazado fuera del área visible** (rect válido, clic imposible): `scrollIntoView` antes de medir.

---

## 3 · Sondas y fixtures de esta auditoría (reejecutables)

| Archivo | Qué hace |
|---|---|
| `scratchpad/aud8b-fixture-viejo.mjs` | Construye el fixture de riesgo CON la app vieja (`:9223`) y lo guarda (`aud8b-viejo.isp`). Contiene `SNAP_FN` (la instantánea compartida: estado + srcT + píxeles) |
| `scratchpad/aud8b-fixture-arreglo.mjs` | Recoloca los 2 clips de Flat2D (ruido de construcción), re-guarda y toma la **instantánea de verdad** (`aud8b-viejo-estado.json`) reabriendo con la app vieja |
| `scratchpad/aud8b-rito-viejo.mjs` | Instantánea de las COPIAS de RitoDome/Rito360/RitoFlat con la app vieja (`aud8b-*-estado-viejo.json`) |
| `scratchpad/aud8b-compara.mjs` | **La comparación central** sobre el exe nuevo (`:9222`): mismos archivos, misma instantánea, diff campo a campo/píxel a píxel |
| `scratchpad/aud8b-gestos.mjs` | Las 10 tandas de pruebas COMO USUARIO (ratón/teclado reales) sobre el exe |
| `scratchpad/aud8b-fxwrap.mjs` | Barrido numérico vieja-vs-nueva fórmula de envoltura fx/fy sobre el clip `c_fx` |
| `scratchpad/aud8b-fxwrap-pix.mjs` | Píxeles del mismo instante en los dos builds (argumento = puerto) |
| `scratchpad/aud8b-retro.mjs` | El `.isp` guardado por el build nuevo abierto en la app vieja |
| `scratchpad/aud8b-dbg1..8.mjs` | Diagnósticos del arnés (documentan las trampas de §2.9) |
| Fixtures | `aud8b-media/` (vídeos/imágenes/audio generados con ffmpeg, deterministas) · `aud8b-viejo.isp` · `aud8b-viejo-resave.isp` · `aud8b-*-estado-*.json` · `aud8b-rito*-copia.isp` |

Cómo relanzar cada lado: app vieja = `node_modules\.bin\electron.cmd "..\isp-old" --remote-debugging-port=9223` (el worktree `../isp-old` en a33c70b queda creado); exe nuevo = `"%LOCALAPPDATA%\Programs\Immersive Studio Pro\Immersive Studio Pro.exe" --remote-debugging-port=9222`. **Nunca los dos a la vez** (bloqueo de instancia única compartido) y matar todas las instancias antes de cambiar de lado.

---

## 4 · EL PLAN (para Opus, en orden; ninguna acción es migración de datos)

**1 · Re-desplegar (o retirar) la instalación de Program Files.** [hallazgo 2.1 · riesgo bajo]
Qué: igualar `C:\Program Files\Dome Studio Pro\resources\` al build actual. Cómo: `Start-Process powershell -Verb RunAs` y copiar `dist\win-unpacked\resources\` ENTERA (regla [R242] del CLAUDE.md), o decidir con Beltrán retirar esa instalación legacy de una vez (nada en el sistema depende de ella: la asociación `.isp` apunta a la canónica). Verificar: `sha1sum` de los tres `app.asar` idénticos (o el fingerprint de `setLoopRange`). Riesgo de la acción: ninguno sobre datos; requiere elevación.

**2 · Arreglar el arrastre del maestro de intensidad (R252b).** [hallazgo 2.3 · riesgo bajo]
Qué: `app.js`, `buildAnimList`, la fila maestra del acorde: en `sl.oninput` NO llamar a `buildAnimList(cc)` (destruye el deslizador en pleno arrastre); dejar `setAnimGroupInt + out.textContent + render() + startMotionPreview()`, y mover la reconstrucción de la lista a `sl.onchange` (junto al `markDirty()` que ya está). Si se quiere que los `amp` de los modificadores de abajo se vean al vivo, actualizar sólo esos `textContent` por `data-ai`, sin `innerHTML=''`. Verificar: `node scratchpad/aud8b-gestos.mjs` §8 debe dar `gint≈200%` tras el arrastre real (hoy da 109 %). Riesgo: bajo (UI local); cuidar de no perder el `pushUndo` del `onpointerdown`.

**3 · Ancho fijo para los rótulos del transporte del monitor.** [hallazgo 2.5 · riesgo nulo]
Qué: `index.html` (CSS del monitor): `min-width` fijo para `.smnum[data-n="r"]` (p. ej. 76px) y confirmar el del tiempo, para que `[ ] ⌫ Insert` no se muevan al marcar. Verificar: en `aud8b-gestos.mjs` §2 ya no haría falta re-medir el rect antes de cada clic (la sonda seguirá pasando igual). Riesgo: ninguno.

**4 · Decidir el efecto lateral del botón Source (R249) — recomendación: mirar no debe escribir.** [hallazgo 2.4 · riesgo bajo]
Qué: `app.js`, `openSourceMonitor(m,pre)`: hoy la rama `pre` estampa `m.srcIn/srcOut`. Opción recomendada: mostrar el rango del clip en la ventana SIN escribirlo en el medio (un campo `mon.preIn/preOut` que pinta la selección; las marcas del medio sólo cambian por acción explícita: I/O, asas, ⌫ — que ya hacen `markDirty`). Opción B (si Beltrán prefiere el modelo actual): mantener la escritura pero con `pushUndo()` + `markDirty()` + `flashStatus('Marcas del clip aplicadas al medio', …)`. Verificar: adaptar la expectativa de `aud8b-gestos.mjs` §3 a la opción elegida; con la A, tras pulsar Source el arrastre del panel debe soltar el archivo ENTERO. Riesgo: bajo; la A cambia un comportamiento nuevo de hace un día, no hay proyectos que dependan de él.

**5 · Guardia contra el doble diálogo de composición.** [hallazgo 2.6 · riesgo nulo]
Qué: `app.js`, `openCompose`, primera línea útil: si existe `#compOv`, cerrarlo por su camino (`Escape` sintético no: invocar el mismo cierre — hoy `cerrarComp` es local, así que basta `document.getElementById('compOv')?.remove(); _composeDrop=null; document.body.classList.remove('composing')` antes de crear el nuevo, o guardar `window._cerrarComp`). Verificar: `aud8b-gestos.mjs` §9 «doble apertura» debe reportar 1 diálogo. Riesgo: ninguno.

**6 · Documentar (NO migrar) el cambio de envoltura fx/fy y el `pulse` inerte.** [hallazgos 2.2 y 2.7 · riesgo nulo]
Qué: una entrada en `PLAN.md` (ROUND siguiente) y una línea en `ARCHITECTURE.md` (sección del motor de motion): «desde R247c, un desplazamiento fx/fy que sale del disco se hunde bajo el horizonte (antes quedaba clavado en el borde); los modificadores `pulse` sobre `size` estampados en secuencias 2D por builds ≤R246 quedan inertes a propósito». Sin migración: el censo de este equipo da cero afectados y migrar introduciría movimiento nunca visto (argumento en 2.7). Si el proyecto REAL del otro ordenador quiere censarse: abrirlo y ejecutar el conteo de `aud8b-fxwrap.mjs` (o el censo de una línea de la sonda de estado). Verificar: n/a (docs). Riesgo: ninguno.

**7 · (Opcional, decisión de Beltrán) Señalizar los medios con marcas.** [derivado de 2.4 · riesgo nulo]
Qué: un puntito o corchetes en la ficha del panel cuando `srcRange(m)` no sea null, para que «este archivo entra recortado» se vea sin abrir el monitor. Coste pequeño en `makeMediaItem`/`makeMediaTile`. Verificar: visual. Riesgo: ninguno.

**Migraciones de datos: NINGUNA.** El formato sólo ganó `srcIn`/`srcOut` (inertes hacia atrás, verificado en la app vieja), y todo lo existente abre idéntico. No hay caso viejo que detectar ni transformar.

---

*Auditoría ejecutada la noche del 2026-08-04→05 sobre el `.exe` desplegado (RTX 4060) y el worktree a33c70b. El fixture y las líneas base quedan en `scratchpad/` para re-ejecución.*
