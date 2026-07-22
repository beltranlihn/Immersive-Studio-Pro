# Correcciones v2 — Dome Studio Pro
## Instrucciones para Claude Code · organizadas por zona

> Trabaja **un ticket a la vez**: implementa → prueba en vivo → confirma que no rompiste nada → siguiente. No declares "listo" sin verificar. Reutiliza la arquitectura actual (`state`, `composite()`, `evalP`/`setKf`, proxies, `previewQuality`). Al final, reporte honesto.
>
> La **Sección 14** no son arreglos puntuales sino funciones mayores; están decididas y se implementan igual, en el orden de la Sección 15.

---

## 1. Formatos y configuración de proyecto (Domo / 2D / 360 / salas)

- **[F1] Botón de Configuración de proyecto.** Un panel donde se define **pixelaje, tamaño de sala, ángulo de domo**, y el proyecto **se re-adapta automáticamente** a esos valores. Es el punto único de setup del formato.
- **[F2] Consistencia de layout entre modos.** Domo y 2D deben mantener proporciones/tamaños coherentes de la UI ("barras del mismo ancho"); **360** requiere ajustar el tamaño de los elementos a su espacio. Revisar que cambiar de formato no descuadre la interfaz.
- **[F3] Wall fijo.** Las paredes (Wall) van **fijas, no editables** por el usuario.
- **[F4] Floor.** No permite editar medidas, **solo pixeles**.
- **[F5] Canvas de orden.** Un canvas completo **por debajo** del 3D y del plano, para ver el orden de los elementos en pantalla.
- **[F6] Elemento ya-domemaster escala bien.** Un elemento que ya viene en formato domo debe poder escalarse igual (su `size` funciona aunque sea fisheye).
- **[F7] Importar equirectangular.** Permitir importar equirectangular y, al ser 360, **poder rotar la cámara**.
- **[F8] Fondo de referencia con cuadrícula.** Opción de poner un fondo (dome / 2D / 360) con **cuadrícula blanco-gris** para ver cómo se comporta el alpha.

---

## 2. Carga, buffer y proxies

- **[C1] Pantalla de carga al abrir proyecto.** El proyecto abre con una **ventana de carga** hasta que **todos los clips y elementos** estén cargados.
- **[C2] Buffer de video/audio óptimo.** Revisar cómo se genera el buffer para que se pueda **dar Play en cualquier punto** sin trabas. (Conecta con el motor de reproducción: decode en worker + caché.)
- **[C3] Auto-asociar proxy existente.** Al cargar un clip en Media, buscar automáticamente si su **proxy ya existe** en la carpeta destino y **asociarlo** (no regenerar).

---

## 3. Panel de Media

- **[M1] Crear carpeta instantánea.** Crear carpeta la genera al toque con el **nombre editable inline**, no un pop-up.
- **[M2] Deseleccionar al click afuera.** Si hay elementos seleccionados en Media y hago click fuera, se **deseleccionan**.
- **[M3] Estado de proxy en el nombre.** El texto "proxy"/"original" aparece **después del nombre** del clip, en **color más claro**; el ícono en **gris**.
- **[M4] Suprimir borra.** Seleccionar clip/elemento en Media + Supr → **lo borra**. Si estaba en el timeline, marcarlo **en rojo** ahí. Elementos **sin referencia original** → también **en rojo**.
- **[M5] Arrastrar múltiples desde Media.** Poder arrastrar varios clips; con **Ctrl** se apilan **hacia abajo** (pistas), por default **lado a lado** (misma pista). Fotos por default **5 segundos**.
- **[M6] Rename contextual (Ctrl+R).** Renombra **donde ocurre**: sobre un clip en Media = ese clip; sobre una sequence en Media = esa sequence; seleccionando una sequence abajo = esa misma.

---

## 4. Inspector — orden y efectos

- **[I1] Efectos colapsados salvo Transform.** El Inspector abre con **todo colapsado excepto Transformation**, y mejor ordenado.
- **[I2] Orden y agrupación de secciones:**
  1. **Transform** — efectos de transform + Loop + Full Dome + Warp Fisheye.
  2. **Clip** — Opacity, Feather, Crop, Mask, Blend Mode.
  3. **Color** — todos los efectos de color + LUT.
  4. **Motion** — efectos de motion + **todos los efectos que hoy son "reactive", aquí como no-reactivos**, con un botón **"Add Effect"** que despliega el listado. Todos sus parámetros **automatizables uno a uno**. (Reactive queda solo como el lugar donde esos efectos corren **live al audio**.)
- **[I3] Mask estilo Premiere.** En Clip, la Mask debe permitir **crear una silueta con puntos**, agrandar, **invertir**, definir feather — todo sobre la misma figura, y **crear varias masks**. La mask **por foto** o las default (círculo/cuadrado) van **aparte** de esta mask de puntos.

---

## 5. Inspector — automatización y modulación

- **[A1] Un solo botón de automatización.** Hoy hay **dos** botones de punto; dejar **solo el de la derecha**.
- **[A2] Regla de automatización (modelo After Effects).** Si aprieto el punto → crea keyframe. Si **muevo un valor y el clip ya estaba automatizado** → **crea keyframe** en ese punto. **En ningún caso se rompe la automatización.** No hay override ni botón de "recuperar/re-enable": editar un valor siempre escribe un keyframe. **Elimina cualquier botón de "recuperar automatización" que exista** (deja sin efecto la spec previa de re-enable estilo Ableton).
- **[A3] Click derecho sobre efecto → "Show Automation"**, y que la muestre **completa**.
- **[A4] Botón Modulation se cierra al click afuera.** Si abro Modulation, un click fuera lo **cierra**.
- **[A5] Estado automatizado visible en el listado.** En el primer listado (efectos) debe verse **si un parámetro o efecto está automatizado**.

---

## 6. Timeline — clips e interacción

- **[T1] Click derecho sobre clip.** Hoy **no funciona**; arreglarlo. Añadir en ese menú **"Zoom"** → el clip toma **todo el ancho visible del timeline**.
- **[T2] Trim por frame con micro-snap.** Extender el ancho/largo de un clip ocurre **por frame**: de lejos fluido, pero al acercar mucho debe verse el **pequeño snap** de cómo se ajusta a cada frame (máxima precisión). El **zoom debe permitir acercar aún más**.
- **[T3] Zoom en la barra de scroll.** La barra de scroll inferior debe tener **círculos en los extremos** (estilo Premiere) para acercar/alejar fácil arrastrándolos.
- **[T4] Faders de 3D Preview.** Están muy malos; rediseñar.
- **[T5] Silenciar clip/sequence = opacidad alta.** Silenciar un clip o sequence lo deja **muy transparente** (mute visual), no lo oculta.

---

## 7. Timeline — pistas de audio y automatización (lanes)

- **[L1] Vista fija al redimensionar pistas.** Agrandar/achicar una pista (video/audio/automatización) **no debe mover la vista** ni arrastrar el rectángulo de audio. Hoy hay glitch: a veces arrastra el bloque de audio.
- **[L2] Audio minimizable y anclado abajo.** Los clips de audio deben ser **minimizables**; al compactar el bloque de audio, va **al fondo**, no se queda flotando donde estaba. (El glitch aparece con pocas pistas de video: queda espacio vacío hasta el bloque de audio.)
- **[L3] Nueva lane del mismo efecto muestra su automatización.** Al crear una nueva pista de automatización que muestra el **mismo efecto**, debe mostrar **la misma automatización** claramente.
- **[L4] Una sola lane sobre el clip.** En edición de automatización, **eliminar las pistas múltiples**: solo la **seleccionada** sobre el clip. Modelo de dos niveles: **primer listado = efectos**, **segundo = parámetros**.
- **[L5] Copy de automatización donde hago click.** El copiar/pegar de automatización usa la **posición del click**, no la del playhead.
- **[L6] Handle de keyframe fácil de agarrar.** El punto de automatización que llega al borde es difícil de tomar; agrandar su zona de click.
- **[L7] BUG: automatización no corre en Play.** Las de **Transform en 2D** no se aplican en playback (probablemente tampoco en otros modos). Verificar que `evalP` alimente el render en tiempo real. **Prioridad alta.**

---

## 8. Compose / Nest

- **[N1] Compose/Nest se comportan como clip.** Deben permitir **scale, rotar, etc.** como si fueran un clip normal.
- **[N2] Cambios de compose en tiempo real.** Al cambiar opciones del compose desde el Inspector, **se ven en vivo** mientras las muevo. Y las opciones del Inspector deben **corresponder al tipo de compose** (hoy en Dome Fill no siempre están bien asociadas).
- **[N3] Quitar Mask en compose.** En los compose, **quitar la opción de mask**.
- **[N4] Cambios relativos dentro del nest.** Si dentro del nest de un compose ajusto un clip unitario (escala, ubicación, mask) y luego modifico el compose desde afuera, los nuevos cambios son **relativos** a lo que tiene ese clip — **no se resetea**. (Ej: agrandé un clip dentro del nest; al cambiar la escala global del compose, ese clip escala relativo a su estado, no vuelve a 0.)
- **[N5] Dome Fill: randomization + rings no deformados.** Mostrar la **randomization** en Dome Fill, y ofrecer un modo de dome fill con **rings no deformados**.

---

## 9. Viewer, performance mode, NDI / Spout

- **[V1] Viewer-only en todos los formatos.** La ventana de solo-visor debe servir en todos los formatos; si en el editor cambio entre **2D y 3D**, la viewer-only **cambia con él**.
- **[V2] Botón "Full Performance".** Junto a NDI In / Spout, un botón que **esconde todo el editor** y muestra solo el visor 2D o 3D, **forzando todos los recursos** a ese render.
- **[V3] Spout In en Media.** Además de NDI, **Spout In** debe existir como fuente en Media. *(Solo Windows — ver [P1].)*

---

## 10. Render y export

- **[R1] Render in-site flexible.** Debe funcionar con: un **clip**, **todos los elementos seleccionados con in/out**, o una **sequence / compo / nest**.
- **[R2] BUG: clips deformados al renderizar.** Al renderizar se ven todos los clips **deformados de fondo**; arreglar.
- **[R3] Sequences reordenables.** Las sequences de la barra horizontal deben ser **reordenables**.

---

## 11. UI, limpieza visual y branding

- **[U1] Menos texto en botones.** Botones minimalistas: **Automation → "A"**, **Snap → "S"**, etc. VIDEO y AUDIO con el **mismo estilo** (barra gris).
- **[U2] Solo hover + "?" para explicar.** **Quitar todas las instrucciones escritas** de la interfaz; la ayuda aparece con **hover** (tooltip) y con un **"?"**.
- **[U3] Botón para ocultar la grilla.** (Toggle de rejilla.)
- **[U4] Quitar línea amarilla del 3D dome.**
- **[U5] Quitar botones Undo/Redo** (dejar solo atajos).
- **[U6] Quitar el botón de frames** (innecesario).
- **[U7] Revisar qué herramientas van a la izquierda.**
- **[U8] Tipografías personalizadas.** Poder **cargar fuentes propias** + opciones de configuración tipográfica.
- **[U9] Página de inicio rediseñada.** Video en **loop** (asset **WebM VP9** que provee el usuario), título del software bien armado, **Versión 1.0**, "**Created by Alma Digital Studio — all rights reserved**".

---

## 12. Reactive FX

- **[X1] Ecualizador con mejor diseño.**
- **[X2] Recuadro de cada efecto mejor ordenado.**

---

## 13. Plataforma (Mac)

- **[P1] Adaptar a Mac (uso personal).** Que corra bien en Mac. **Spout** (solo Windows) queda **bloqueado/deshabilitado** en Mac — desactiva su botón, no lo elimines. Revisar soporte de **ProRes** en Mac. Al ser de uso personal, **no** hace falta firma/notarización de Apple ni empaquetado de tienda.

---

## 14. Funciones mayores

Todas se implementan, salvo **[D4]**, que es fase 2: por ahora solo hay que dejar preparada la costura que describe.

- **[D1] Modelo de automatización.** Modelo After Effects: editar un valor siempre crea keyframe, la automatización **nunca se rompe**, y **no hay botón de recuperar**. (Detalle en [A2].)
- **[D2] Encoder separado (tipo Media Encoder).** Cola de exports en segundo plano: mando un export → sigo trabajando (incluso **borrar clips**) → el export usa un **snapshot del proyecto congelado al momento del envío**, así el resultado sale correcto aunque el proyecto cambie después. Corre en un proceso/worker aparte para no bloquear la edición.
  *Aceptación:* puedo enviar un export a la cola y seguir editando/borrando; el archivo exportado refleja el estado del proyecto **al momento del envío**, no el actual; puedo encolar varios y ver su progreso.
- **[D3] Menús de aplicación (File / Edit / Window).** Barra de menús estándar. En **File/Archive**: nuevo, abrir, guardar, guardar como, exportar. En **Edit**: deshacer/rehacer, cortar tiempo, duplicar tiempo, copiar/pegar, eliminar. En **Window**: mostrar/ocultar paneles (inspector, media, viewer-only). Reutiliza los comandos que ya existen; el menú es solo otra vía de acceso, no lógica nueva.
  *Aceptación:* los menús existen y sus acciones ejecutan los mismos comandos que los atajos.
- **[D4] Grilla 3D infinita (fase 2 — no construir ahora).** Objetos dispuestos en rectángulo / cubo / cilindro **al infinito**; conecta con las salas 360. **No lo implementes todavía**, pero cuando toques el motor de salida, deja el mapeo final como una **capa de "output target" intercambiable** (domo fisheye / sala N-superficies / grilla 3D) sobre el mismo composite, para que agregarlo después sea abrir una puerta, no rehacer el motor.
- **[D5] Distribución (instalador cerrado).** Empaquetar como **instalador cerrado**, sin sistema de licencias/activación por ahora. No metas DRM ni activación online todavía. (Al ser de uso personal, basta un build empaquetado y actualizable.)
- **[D6] Repo en GitHub + versionado.** Armar el repo y una estrategia de versiones (commits + tags/releases por versión). Es la red de seguridad; hazlo cuanto antes.
- **[D7] Tour de primera apertura.** Al abrir por primera vez, cargar un **proyecto-demo pre-armado con shapes de referencia** (como el set base de Ableton) + un **overlay de pasos** que explique lo esencial (viewport, timeline, inspector, export). Debe poder saltarse y no volver a aparecer salvo que se pida desde ayuda.
  *Aceptación:* la primera apertura muestra el demo + tour; se puede omitir; no reaparece en aperturas siguientes.

---

## 15. Plan de etapas (orden sugerido para iterar con Claude Code)

Este documento es el mapa completo. **No lo ataques todo de una vez.** Avanza por etapas; cierra y prueba cada una antes de pasar a la siguiente. Orden recomendado:

**Etapa 0 — Base.** [D6] repo de GitHub + versionado. (Todo lo demás se hace sobre control de versiones.)

**Etapa 1 — Bugs que rompen el core.** [L7] automatización no corre en Play (Transform 2D), [R2] clips deformados al renderizar, [T1] click derecho sobre clip, [L1]/[L2] glitches al redimensionar pistas y audio, [A1] botón doble de automatización. **Prioridad máxima.**

**Etapa 2 — Inspector.** [I1][I2][I3] orden, secciones y mask estilo Premiere; [A2]–[A5] automatización y modulation.

**Etapa 3 — Media.** [M1]–[M6].

**Etapa 4 — Timeline y lanes.** [T2]–[T5], [L3]–[L6].

**Etapa 5 — Compose / Nest.** [N1]–[N5].

**Etapa 6 — Formatos y configuración.** [F1]–[F8].

**Etapa 7 — Viewer / NDI / Spout / Performance.** [V1]–[V3].

**Etapa 8 — Render, export y encoder.** [R1][R3] + [D2] encoder en cola.

**Etapa 9 — UI, limpieza y branding.** [U1]–[U9], [X1][X2].

**Etapa 10 — Menús de aplicación.** [D3].

**Etapa 11 — Plataforma y distribución.** [P1] Mac + [D5] instalador cerrado.

**Etapa 12 — Onboarding.** [D7] tour + proyecto demo.

**Fase 2 (después).** [D4] grilla 3D infinita + salas 360, sobre la costura de "output target".

**Cómo reportar cada etapa:** marca los tickets completados, di qué cambiaste, el resultado de cada prueba en vivo, y qué quedó pendiente. No pases de etapa sin que la anterior funcione y no haya roto nada previo.
