# Dome Studio Pro — Implementation Plan & Improvement Backlog

## ROUND 251 — Copiar varios clips, y que una composición no estrene pista cada vez

Dos cosas que salieron editando de verdad.

### 1 · Copiar y pegar la selección entera

*«Copiar varios clips y pegar varios clips no me está funcionando, sólo me copia uno.»* Y era literal:
`copyClip()` guardaba `selClip()` —**un** clip— aunque la selección múltiple vive en `state.selIds` desde
siempre. El portapapeles nunca vio a los demás.

Ahora se guarda el conjunto junto con el instante del primero (`t0`), y al pegar cada clip se coloca en
`cabezal + (su inicio − t0)`, **en su propia pista**. Es lo que hace que pegar un montaje de varias capas lo
reproduzca tal cual en otro punto de la línea de tiempo, en vez de amontonarlo.

Dos detalles que no son adorno:
- **Los enlaces A/V se rehacen sólo si las dos mitades venían en lo copiado.** Con una sola, `linkPartner`
  buscaría un fantasma al mover o recortar; lo pegado nace suelto, que es lo que ya hacía el pegado de un clip.
  Es el mismo criterio que `nestSelection` aplica desde R225·8.
- **Un medio que ya no existe no aborta el pegado**: se salta, se cuenta y se avisa. Si copiaste cinco clips y uno
  perdió su archivo, los otros cuatro tienen que llegar igual. Antes, con un solo clip, no llegar era lo mismo que
  no pegar nada; con cinco, ya no.

Comprobado sobre el `.exe`: tres clips en V1 (2 s), V2 (4 s) y V1 (7 s), copiados con el cabezal en 20 → caen en
20, 22 y 25, en V1, V2 y V1. Distancias y pistas intactas.

### 2 · Dónde cae una composición

*«Cada vez que creo una se crea una pista, otra pista, otra pista, y termino con veinte mil quinientas pistas, y
se me agregan arriba, lejos.»*

Venía de R88, y con buena intención: **cada composición estrenaba pista para no pisar nada**. La regla nueva, suya,
conserva lo que aquello buscaba sin el coste: **la pista más cercana que tenga hueco donde va a caer, y sólo si no
hay ninguna, una nueva.** Nunca encima de otro clip.

«Más cercana» se mide desde la **pista elegida** (la cabecera marcada), que es la forma que tiene el usuario de
decir «trabajo aquí». Sin ninguna elegida se empieza **por abajo**, que es donde está el montaje — amontonar
arriba es justo la queja. A igual distancia gana la de abajo.

**A propósito NO se mide desde el clip seleccionado**, aunque parecía lo natural: tras crear una composición el
clip seleccionado es ella misma, así que cada nueva iría trepando una pista por encima de la anterior. Se vio en la
primera pasada de la prueba (una composición en tiempo libre se iba a V5 en vez de a V1) y se corrigió.

Comprobado sobre el `.exe`, con 4 pistas de vídeo, V1 ocupada de 0 a 30 s y el cabezal en 5:

| Acción | Resultado |
|---|---|
| 1.ª composición | V2 · **ninguna pista nueva** |
| 2.ª | V3 · ninguna nueva |
| 3.ª | V4 · ninguna nueva |
| 4.ª | agotadas las cuatro → **crea la quinta**, como debe |
| Otra en el minuto 2 (tiempo libre) | **V1** · reutiliza, no crea |

El caso «componer desde clips de la línea de tiempo» (`nestSelection`) ya estaba bien: quita los originales y pone
el nido en la pista que ocupaban. No se ha tocado. El único camino que estrenaba pista era `createComposition`,
que es por donde pasan las composiciones desde el panel de medios y desde un clip.

De paso, el aviso al crear dice ahora **en qué pista cayó** (`Ring → V2 · 6 elementos`): con la regla nueva puede
ser una existente, y conviene verlo sin buscarlo.

---

## ROUND 250 — El tramo del bucle ya existía: lo que faltaba era verlo y poder cambiarlo

Beltrán, tras usar el monitor de origen: *«me di cuenta de que el loopeo funciona superbién, pero sólo me permite
tomar la duración completa del clip para marcar el loop»* — y propuso dos modelos: que el in/out del monitor
marque el tramo loopeable, o que lo marque la duración del clip ya recortado en la línea de tiempo.

**Medido antes de tocar nada, y la premisa era falsa: los dos modelos ya funcionaban.** `srcT` envuelve desde R81
sobre `[inP, inP+loopLen)`, y `_applyLoopToggle` captura `loopLen` de la **duración del clip en el momento de
encender el bucle**. Sobre el `.exe`, con un archivo de 50,13 s:

| Caso | `loopLen` resultante |
|---|---|
| Clip entero → Loop | 50,13 s (el archivo entero) |
| **Recortar a 6 s → Loop** | **6 s** ← su modelo (b), ya existía |
| **Del monitor (entrada 20 s, 6,5 s marcados) → Loop** | **6,5 s, envolviendo en [20 s, 26,5 s]** ← su modelo (a), gratis |

Lo que había pasado es el caso común: encender Loop sobre un clip que aún está entero. **No faltaba una función,
faltaba que se viera.** El comportamiento dependía del ORDEN (recortar y luego encender ≠ encender y luego
recortar) sin que nada lo dijera.

### El defecto de verdad

Para cambiar el tramo había que **apagar el bucle y volver a encenderlo** — y apagarlo **recorta el clip** a lo que
quede de archivo (medido: un clip estirado a 40 s vuelve a 30,13 s). Ese recorte tiene su razón —sin él se verían
fotogramas congelados más allá del final—, pero significa que **re-decidir el bucle costaba el montaje**.

### Lo que entra

En el inspector, con el bucle encendido, dos filas nuevas:
- **Tramo del bucle** — la longitud del ciclo, con decimales (`fmtDur` redondea a segundos y un bucle de 6,5 s se
  leía «6s»), editable a doble clic, y un botón **«Del clip»** que lo toma de la longitud actual del clip.
- Debajo, en pequeño, **qué trozo de la fuente se repite** en código de tiempo: `Repite 00:00:20 → 00:00:26:15`.

`setLoopRange(c,len)` cambia **sólo** `loopLen`: la longitud del clip en la línea de tiempo no se mueve, el bucle
no se apaga, y se acota a lo que haya de fuente desde la entrada. El clip de audio enlazado va con él.

Comprobado sobre el `.exe`: encender con 6,5 s marcados da 6,5 · con el clip estirado a 40 s, «Del clip» pone 30
(el tope real de fuente) **sin tocar los 40 s de la línea de tiempo ni apagar el bucle** · a mano, 3 s deja el clip
en 40 y a los 10 s de línea de tiempo se ve el segundo 21 de la fuente (20 + 10 mód 3) · pedir 999 se acota a 30.

### De paso, la otra pregunta

*«Cuando ya lo tengo en el timeline, ¿lo puedo extender para que vuelva a aparecer el resto del vídeo?»* **Sí**, y
medido: el borde derecho de un clip con entrada en el segundo 20 llega a 30,13 s, que es exactamente lo que queda
de archivo; y arrastrando el borde izquierdo hacia atrás se recuperan los 20 s anteriores a la marca (`inP` 20 → 0).
Las marcas eligen por dónde EMPIEZA la ventana, no recortan el material.

---

## ROUND 249 — El monitor de origen: mirar el material antes de soltarlo

Beltrán: *«me di cuenta de que me faltaba… un reproductor de clip para visualizar el clip antes de arrastrarlo al
timeline. Quizás el clip que queremos arrastrar dura veinte minutos y no queremos arrastrar los veinte minutos,
sino sólo un pedacito»*. Es el Source Monitor de Premiere, y faltaba de verdad: hasta ahora, para meter veinte
segundos de un archivo largo había que soltar el archivo entero y recortarlo ya en la línea de tiempo.

### Qué es

Doble clic en un medio abre una **ventana flotante** con el material: transporte con reproducción, barra de
recorrido, marcas de **entrada y salida**, y la imagen como asa — se agarra el fotograma y se suelta en una pista,
y lo que cae es **sólo el tramo marcado**. También hay un botón **Insertar** (lo pone en el cabezal) y, en el
inspector de cada clip, un botón **Source** que abre la fuente de ese clip con su entrada y salida ya puestas.

**No es un modal, y es deliberado.** Se mira el material mientras se sigue trabajando con el editor, así que ni
velo ni bloqueo: se mueve, se redimensiona por la esquina y se cierra por su × o con Escape. Con el foco dentro,
**I** y **O** marcan y **Espacio** reproduce; el atajo global se aparta explícitamente (el monitor no es un
`.overlay`, así que había que excluirlo a mano de la guarda de atajos, que era justo el sitio donde se habría
colado un fallo silencioso).

### Dónde viven las marcas, y por qué importa

En el **MEDIO** (`m.srcIn` / `m.srcOut`), no en la ventana, y viajan en el `.isp`. Es el modelo de Premiere: la
marca es del material. La consecuencia buena es que **arrastrar desde el panel de Medios respeta las mismas
marcas** — una vez marcado un archivo, todo lo que salga de él sale ya recortado, se pase por la ventana o no.

Y la consecuencia de diseño: `srcRange(m)` devuelve **null** cuando no hay marcas o cuando marcan el archivo
entero. Por eso enchufarlo en el arrastre de siempre **no le cambia nada a quien no haya marcado nunca**: es
exactamente el camino anterior. Un cambio de comportamiento que sólo existe si lo pides.

### El doble clic cambia de significado

Antes soltaba el clip en la línea de tiempo; ahora **abre el material en el monitor**, que es lo que hace Premiere.
Para poner un clip en la línea de tiempo se arrastra, se usa Insertar, o se arrastra desde el monitor con marcas.
Las secuencias/composiciones siguen abriéndose con doble clic (son pestañas, no material), y con el diálogo de
composición abierto el doble clic sigue alimentando la cesta (R248).

### Qué se comprobó, sobre el .exe y con un vídeo real de 50 s

| Prueba | Resultado |
|---|---|
| Doble clic en el panel | abre el monitor y **no suelta ningún clip** (0 → 0 en la línea) |
| Transporte | de 2,00 s a 3,06 s en 1,2 s de reloj; pausa correcta |
| Marcar entrada 5 s / salida 9,5 s | rango 4,50 s, barra al 8,98 % del ancho |
| Soltar en una pista | `inP` 20 s · **dura 6,50 s**, no los 50,13 del archivo |
| Arrastre real con eventos de ratón | fantasma sobre la pista, clip correcto al soltar |
| Clic sin mover ≠ arrastre | no lanza reproducción por accidente |
| Guardar `.isp` y reabrir | las marcas se conservan (5 s / 9,5 s) |
| Botón **Source** del inspector | abre con la entrada y salida **del clip** (12 s / 15 s) |
| Cerrar | ventana y estado limpios, y el `<video>` suelta el decodificador |

Cada tipo de medio pinta lo suyo: vídeo con un `<video>` propio (no el del motor — el de la línea de tiempo lo
pilota el cabezal, y compartirlo habría hecho que recorrer el monitor moviera el render), secuencia de imágenes
por índice de fotograma, audio con su onda y el tramo marcado encendido, y las fijas con su imagen. Las fuentes en
vivo (NDI/Spout) no tienen nada que recorrer y lo dicen.

**Detalle de oficio:** el primer diseño de la barra usaba un azul de acento que este programa no tiene — su paleta
es de grises medidos por contraste. Ahora la marca de entrada/salida usa exactamente el mismo lenguaje que el área
de trabajo del timeline (`rgba(180,186,193,…)` con filos `--ink-2`), que es lo que ya significa «tramo marcado»
aquí. De paso se corrigieron dos azules que se me habían colado en R248.

---

## ROUND 248 — El compose deja de ser un catálogo y pasa a ser una cesta

Beltrán: *«el sistema nos muestra en un cuadradito todos los clips que hay en el archivo, con casillas… considera
que en un solo archivo podemos tener quinientos clips, buscarlos ahí y reconocerlos sólo por un nombre es una
locura»*. Y el requisito que mandaba sobre todo lo demás: *«ya tengo muchos proyectos andando que usan compose…
si abro mi proyecto en esta versión nueva, mis composes se siguen manteniendo tal y como estaban, simplemente
cambia el visor y el formato de interacción»*.

### Qué cambia

El campo Medios del diálogo ya no lista **todo el proyecto** con casillas, sino **lo que esta composición
contiene**: miniatura, nombre y número de orden, como en el panel de Medios. Se quita con la **×** de cada fila y
se añade **arrastrando desde el panel de Medios** a la cesta, que se resalta al pasar por encima.

El número de orden no es decoración: **manda**. El tejido reparte una fuente por tira y `compMediaIndex` cicla
por esa lista, así que ver el orden —y que se conserve— es parte de la herramienta.

### Lo que NO cambia (y cómo se comprobó)

`_pick` **es** `g.mediaIds`: mismos identificadores, mismo orden. No hay conversión, ni formato nuevo, ni migración.
Un `.isp` de julio se abre y se guarda exactamente igual.

De hecho la cesta es **más fiel que la lista de casillas**: `checkedIds()` leía las casillas en el orden del DOM,
que es el del PANEL de medios, no el guardado. Reaplicar una composición vieja cuyo `mediaIds` estuviera en otro
orden **rebarajaba qué fuente iba a cada tira**. La cesta devuelve lo que había, tal cual.

Verificado sobre el `.exe` con tres composiciones de tipos distintos (anillo, tejido, túnel) y fuentes puestas a
propósito fuera del orden del panel (`F,E,D,C,B,A` y `C,A,E,B`):

| Prueba | Resultado |
|---|---|
| Guardar a `.isp` → abrir | **idéntico** (geometría de los 87 clips de los tres nidos) |
| Abrir el diálogo y Aplicar sin tocar nada | **idéntico** |
| **Render real, antes vs después** | **ni un píxel cambia** en los 3 nidos × 2 instantes |
| La cesta refleja `g.mediaIds` | sí, en su orden guardado |
| × quita · arrastre añade · `g.mediaIds` resultante | `C,A,E,B` → `A,E,B` → `A,E,B,C` ✓ |
| Arrastre real con eventos de ratón | entra, resalta al pasar, limpia al soltar |

La comparación de **píxeles** es la que zanja el asunto: comparar la forma del objeto daba un falso positivo,
porque `regenComposeNest` limpia `warp`/`secAz`/`secEl` al recomponer (línea `[N5]`, anterior a esta ronda) y esas
props no las lee nadie salvo `const sector=(c.props.warp==='dome')`, donde `'patch'` y `undefined` dan las dos
`false`. Se anotó en la sonda en vez de silenciarlo.

### Tres cosas que hubo que resolver para que el arrastre fuera posible

1. **El velo del modal tapaba el panel de Medios.** Sin ratón en el panel no hay nada que arrastrar. El velo pasa a
   `pointer-events:none` y el cuadro se lo devuelve. Como el velo ya no recibe clics, **se pierde el cerrar
   pinchando fuera** → entra **Escape**, que además es lo que espera cualquiera.
2. **El fantasma del arrastre iba por detrás del velo** (z-index 80 contra 9600): se arrastraba a ciegas. Sube a
   9700 sólo mientras el diálogo está abierto.
3. **El velo decía lo contrario de lo que pasa.** Lo cazó Beltrán: *«toda la ventana queda medio opaca, lo que
   incita a que no puedes interactuar con ella, pero si ahora vamos a poder arrastrar clips desde el media, debiera
   estar disponible»*. El panel de Medios sale de debajo del velo (`body.composing`), a plena luz y con un filo
   encendido, y el cuadro sube por encima de él para que mande el diálogo si la ventana es estrecha y se solapan.
   **Primer intento fallido:** dejé el velo al 0,66 de siempre y el editor quedaba prácticamente negro —
   *«así se ve terrible, me apagaste completo el editor»*. El velo baja a **0,22**. Es lo correcto por dos motivos:
   ese gris oscuro significa «bloqueado» y aquí no lo está, y sobre todo **hay que ver la composición dibujada en
   el domo mientras se ajusta**, que es de lo que va el diálogo. Apagarla era justo lo contrario de lo que hace falta.
4. **Dos formas de tocar el proyecto por detrás del diálogo.** Con el velo transparente, soltar un medio sobre la
   zona del timeline habría **añadido un clip al proyecto** con un modal delante, y el doble clic también. Con la
   composición abierta, arrastrar y doble-clicar hacen **una sola cosa**: alimentar la cesta.

Además: la cesta puede quedarse **vacía**, cosa que antes era imposible (la lista caía siempre a la primera
casilla). Aplicar con ella vacía habría vaciado el `mediaIds` de una composición existente → Aplicar se para, avisa
y parpadea la cesta.

**Trampa del arnés, tercera vez en la sesión:** un acento grave dentro de una plantilla la cierra. Rompió `app.js`
en R247c y dos sondas aquí. Va en mayúsculas en `docs/` y en la memoria.

---

## ROUND 247d — El tejido se vuelve un instrumento (y el fallo del doble que escondía)

Beltrán, viendo el R247c funcionando: *«hay que agregarle varias opciones de configuración… si quiero que sean dos
líneas separadas, debo poder hacerlo; si quiero que sea un tejido que llene todo el domo, debo poder hacerlo; si
quiero un tejido pero no con tantas y que queden espacios transparentes, debo poder hacerlo»*. Y después: *«en una
misma fila los clips no tienen que cortarse unos con otros, tienen que partir una vez que termina el borde del
otro»*.

### El fallo que sólo apareció al medir

Al añadir el mando de **ancho de tira** salió a la luz un error de escala del R247c: en el lienzo plano el lado
dibujado de un clip mide **2×`scale`** unidades (`scale` es un porcentaje del marco, y 100 % = el lienzo entero,
200 unidades). El reparto usaba `scale = grosor`, así que **todas las tiras salían al doble de ancho**.

Se manifestaba de dos formas, y ninguna se veía a simple vista:

- **El ancho de tira mentía.** Al 100 % las tiras solapaban entera a la vecina, y el hueco transparente no empezaba
  a aparecer hasta bajar del 50 %. Medido: 100 %→0 · 80 %→0 · 60 %→0 · 40 %→8,6 % de hueco. Ahora: 100 %→0 ·
  80 %→8,6 % · 60 %→23,8 % · 40 %→44,9 %, que es una respuesta monótona y legible.
- **Los clips se cortaban dentro de la tira** — justo lo que reportó Beltrán. El paso entre clips se calculaba con
  la medida correcta pero se dibujaban al doble, así que cada uno se montaba sobre el siguiente.

Un solo `/2` arregla las dos cosas. Verificado midiendo **borde contra borde** de clips consecutivos en cada tira:
peor solape **0,000** en las cuatro configuraciones probadas, quieto y en marcha.

De paso, el **empaque se acota al 100 %**: dentro de una tira un clip empieza donde acaba el anterior y nunca se
solapan. Por debajo dejan aire a propósito; por encima ya no hay nada que ofrecer.

### Los mandos

| Mando | Qué hace |
|---|---|
| **Disposición** | tejido · líneas ↔ · líneas ↕ |
| **Tiras** | 1–24 por sentido (era 1–12) |
| **Ancho de tira** | 5–100 % del espacio entre tiras. **Es el que abre el abanico entero**: al 100 % se tocan y llenan el domo; por debajo dejan hueco transparente. Con pocas tiras y poco ancho salen dos líneas sueltas cruzando el domo |
| **Empaque** | 40–100 % a lo largo de la tira. 100 % = borde con borde |
| **Lado largo** | cruzando la tira · a lo largo (el mando que impide deformar) |
| **Movimiento** | alterno · a la vez · quieto |
| **Velocidad ↔ / ↕** | una por familia; cada fila aparece sólo si su familia existe |
| **Invertir** | da la vuelta a todos los sentidos |
| **Entrelazar** | sólo con las dos familias: sin cruces no hay nada que entrelazar |

Separación y ancho son **un solo mando**, no dos: hueco = paso − grosor, así que con dos controles podrían
contradecirse. Y **el ojo de pez sale del compose** — decisión de Beltrán: *«la deformación fisheye no se hace
directo del compose, sino desde el inspector, tal como sería con cualquier otro clip»*. El nido nace con el
interruptor puesto para que se vea como lo aprobó, y la cantidad se ajusta donde vive esa clase de parámetro.

### Verificado en el .exe (RTX 4060)

| Qué | Resultado |
|---|---|
| Solape entre clips de una misma tira | **0,000** en 4 configuraciones, quieto y en marcha |
| Tiras al 50 % de ancho, 4 líneas | −87,5…−62,5 · −37,5…−12,5 · 12,5…37,5 · 62,5…87,5 — exacto |
| «Quieto» | 0 de 97 clips con modificador (ni gasta reloj de preview) |
| «A la vez» / «Invertir» | 93 de 93 en un sentido / 93 de 93 en el contrario |
| Sólo líneas ↔ | un único eje de movimiento, 0 entrelazados |
| Hueco transparente vs ancho | 0 · 8,6 · 23,8 · 44,9 · 61,4 % — monótono |

**Trampa del arnés anotada:** medir el semieje `fy` de `flatPlace` da la respuesta equivocada cuando el clip va
girado 90° — `fy` apunta entonces en horizontal. Hay que componer la **caja envolvente** (`|fx.y| + |fy.y|`). Con
la medida mala las tiras parecían correctas y el fallo del doble habría pasado otra ronda sin verse.

---

## ROUND 247c — El TEJIDO, rehecho en plano (y el entrelazado que dábamos por imposible)

Segunda herramienta de relleno de domo. Llega después de dos intentos fallidos, y lo que la arregla no es más
matemática sino **cambiar de sitio el problema**, idea de Beltrán:

> «armáramos toda esta grilla, tejido en un plano uno a uno, y después ese plano uno a uno se convierte a un SRC
> fulldome y se le da un poco de fisheye, y así se adapta a la deformación. Entonces, cada clip con el otro
> siempre se juntan en noventa grados.»

### El diagnóstico del escalonado

Los dos primeros intentos colocaban cada clip **directamente sobre la esfera**, trazando las tiras en el plano del
ojo de pez. Conservaban la proporción y viajaban sin fin, pero se veían *«escalonados, como diente de sierra»*. La
causa es geométrica y no tiene arreglo por ese camino: en una proyección azimutal-equidistante **la única banda
recta que es un círculo máximo es la que cruza por el centro del disco**. Cualquier otra se curva, así que dos
clips vecinos de la misma tira no llegan a alinearse nunca y la junta se quiebra. La prueba estaba a la vista en
los renders: la banda central salía limpia y las demás no.

Montarlo en un plano lo disuelve. Ahí los vecinos se juntan a **90° exactos por construcción**, y la curvatura se
aplica **una sola vez, al conjunto**, al entrar en el domo. Además reutiliza el mecanismo que ya había demostrado
el túnel: `props.fulldome` + `props.fisheye`.

### Cómo queda montado

- `weaveLayout(g)` reparte en el lienzo del nido (−100..100 en los dos ejes; ahí el **lado largo de un clip mide
  exactamente `scale`**, que es lo que deja toda la geometría en una línea).
- **La proporción no se toca nunca.** El lado que CRUZA la tira mide su grosor; el otro sale de `AR` = largo/corto
  del propio medio. `fit` elige cuál cruza y un `rot` de 0 o 90° decide hacia dónde mira — girar no deforma.
- **Una fuente por tira.** Dentro de una tira todos los clips miden igual, encajan borde con borde y el salto de la
  envoltura es invisible. Repartir las fuentes clip a clip mezclaba un 16:9 con un cuadrado en la misma tira y el
  paso uniforme dejaba hueco tras uno y solape tras el otro: parecía un collage.
- **Infinito sin envoltura ninguna**: diente de sierra (R246) con amplitud **un paso justo** de la tira. Cuando un
  clip salta hacia atrás ya hay otro ocupando su sitio. Nadie desaparece — la otra queja de Beltrán.
- `createComposition` fuerza el nido a **plano y cuadrado** aunque la secuencia sea un domo, y le pone al clip
  anfitrión `fisheye` con la cantidad elegida.

### El entrelazado: lo que dimos por descartado y costó cinco líneas

En R247 se anotó que el entrelazado real por cruce *«exigiría partir cada tira o recortarla con una máscara de
damero»* y no compensaba. **Era un mal juicio**, y la pregunta de Beltrán —*«¿podemos lograr el efecto donde se van
superponiendo unas con otras? se va a ver mucho más pro»*— obligó a mirarlo otra vez.

La clave es que **el «pasa por delante» no es una propiedad del clip, que viaja, sino del CRUCE, que está quieto**.
Si el patrón viajara con el clip, el tejido resbalaría con él y parpadearía. Así que se evalúa en **píxeles del
lienzo** (`gl_FragCoord`), no en coordenadas del clip: `u_weave` lleva el tamaño de celda y el origen, y descarta
la mitad de las casillas. Cinco líneas de shader, ninguna pasada extra.

Y con las tiras contiguas ni siquiera hace falta redibujar nada: **cada familia cubre el lienzo entero, y basta con
recortar una de las dos a la mitad de los cruces**. Cada tira se ve entonces a trozos, apareciendo y desapareciendo
bajo la que la cruza — que es literalmente lo que hace una fibra en una cesta. Sin entrelazar, las tiras se
adelgazan al 62 % para que la familia de debajo asome; si no, la de arriba la tapaba entera, fallo real que salió
en la primera prueba y que el primer montaje (tres pasadas: H, V, V recortada) escondía sin resolver.

El tamaño de celda se guarda en **celdas, no en píxeles** (`weaveCells`) y se convierte contra el lienzo real en
`setWeaveGrid` — así el mismo nido vale compuesto a 1024 o a 4096 y el entrelazado no se descuadra al exportar.

### Verificado en el .exe (RTX 4060)

| Qué | Resultado |
|---|---|
| Clips deformados | **0 de 87** (peor error 0,000 %) |
| Ángulos entre vecinos | **sólo 0° y 90°** |
| Clips dentro del lienzo en 10 instantes | 84–87 — constante, nadie desaparece |
| Negro sin cubrir (fuentes opacas) | **0 %** del disco, a cualquier ojo de pez |
| Nido | `flat` 2048×2048, anfitrión `fulldome` + `fisheye` |

Los huecos negros que se ven con el material real de Descargas son **el alfa de los propios PNG**: con fuentes
opacas generadas no queda un píxel vacío. Se comprobó a propósito, para no dar por bueno un fallo de geometría ni
por malo un rasgo del contenido.

**Dos trampas del arnés** que volvieron a morder y quedan anotadas: los acentos graves dentro de la plantilla del
shader la cierran (rompió `app.js` una vez más), y el visor está al **92 % de zoom** por defecto — medir un anillo
en el borde del disco sin poner el zoom a 1 devuelve un 60 % de negro que es el fondo del visor, no el render.

### Retirado (archivado, ADR-0007)

`_backup/deprecated/20260804-tejido-esfera.js`: la rama `weave` de `compLayout`, y en `drawClip` el andamiaje que
sólo servía a ese tejido (`alignBand`, `bandHalf`, `bandAxis`). El deslizamiento `fx`/`fy` del motor se queda, con
su envoltura simple de antes. También se retiró el `orb` de `ANIM_PARAMS`, principio de un rediseño por círculos
máximos que esta ronda deja sin sentido; en su lugar entran `x`/`y`, que sí faltaban para animar a mano un clip
plano.

---

## ROUND 246 — El motor gana dos piezas, y llega el compose TÚNEL

Primera de dos rondas para las herramientas de relleno de domo que pidió Beltrán (la otra es el TEJIDO, R247).

### Por qué compose y no efecto motion — la decisión de arquitectura

Beltrán lo propuso como compose y luego lo dejó abierto: *«quizás no es un compose, sino un tipo de efecto
motion»*. Lo que decide es su propia frase siguiente: **«quiero armarlo con varios clips en conjunto»**. Un efecto
motion es *por clip* y no sabe que existen los demás; lo que define a estas dos herramientas no es cómo se mueve
UN elemento, sino **la relación entre ellos** — que los elementos vayan desfasados 1/N del ciclo para que el
chorro no tenga huecos. Esa repartición es exactamente lo que hace un compose, y de paso hereda la vista previa
en vivo, el «Regenerar» que conserva los retoques manuales y el resultado como **un nido**: un solo clip en la
línea de tiempo, con su fundido, su automatización y anidable dentro de otra composición.

**Pero las piezas nuevas van al MOTOR, no dentro del compose**, así que quedan disponibles sueltas para cualquier
clip a mano. El compose sólo las estampa — igual que el tipo `line` lleva estampando su scroll desde siempre.

### Pieza 1 · Diente de sierra (`mode:'saw'`)

Al motor le faltaba la forma de onda del ciclo que se repite: `linear` es una rampa que crece sin fin y `wave` va
y vuelve. `saw` va de 0 al tope y **vuelve a nacer**, para siempre. Con N clips desfasados 1/N se obtiene un
chorro continuo.

Trae un mando de **curva** (0-100) que dobla la subida, y no es un adorno: a velocidad constante hacia el ojo, el
radio aparente **se multiplica** con el tiempo, no se suma, así que sólo la subida exponencial se lee como
profundidad real — los elementos se agolpan al fondo y se separan al acercarse. Medido con curva 100 y amplitud
100: `0 → 5,9 → 18,3 → 44,5 → 100`, con cada tramo mayor que el anterior (frente al `0-25-50-75` lineal).

### Pieza 2 · Deslizar en el plano del ojo de pez (`fx`/`fy`)

Azimut y elevación mueven en coordenadas de la ESFERA: recorrer una banda recta que no pase por el cenit cambia
las dos a la vez y de forma no lineal, así que con los parámetros de siempre **no se puede expresar**. Los dos
nuevos llevan el clip al plano del disco —el mismo que ve el espectador—, lo desplazan y lo **envuelven** en
[-1,1] por cada eje: sale por un borde y entra por el opuesto. Los ejes envuelven por separado, que es exacto
para bandas horizontales y verticales (el caso del tejido) y por eso las bandas irán a 0° y 90°: en diagonal la
envoltura sería un salto feo. Es la pieza que sostiene R247.

### El compose TÚNEL

Las fuentes son **imágenes 1:1 con alfa** que Beltrán dibuja aparte, marcadas como máster de domo: el clip ocupa
el disco entero y `Size` pasa a ser el zoom cenital (`size/55` = 1:1). Nacer pequeño y crecer hasta salirse por la
periferia **es** el elemento acercándose. **La forma no se asume en ninguna parte:** un anillo da un túnel
legible, pero cualquier repartición de alfa —huecos, tramas, siluetas— sirve y da resultados muy distintos; lo
decide el material, no el código.

Mandos: **De → a** (tamaño inicial y objetivo), **Velocidad**, **Profundidad** (la curva), **Giro** por elemento
—para que uno no se vea calcado del anterior— y **Fundido**, que entra y sale con un seno a la misma velocidad y
desfase −¼ de ciclo. Ese seno ES un fundido de entrada en la primera mitad del viaje y de salida en la segunda
(por eso la opacidad base es 50: 50 ± 50 recorre el rango entero), y comparte reloj con el tamaño, así que no hay
forma de que se desincronicen.

### El orden de dibujo, que lo pidió Beltrán y no era cosmético

*«La textura más antigua que aparece es la que tiene que ir siempre por el frente, y las nuevas por detrás.»*
Tiene razón y **no se puede resolver con el orden de pistas**: los elementos CICLAN, así que el que ahora es el
más viejo vuelve a nacer y pasa a ser el más nuevo — el ranking por cercanía rota con el tiempo y ninguna
asignación fija lo expresa. Se ordena **en cada fotograma** por el `size` evaluado en ese instante (que en una
fuente fulldome es la distancia) y se dibuja de menor a mayor, así que el más viejo queda siempre delante y los
que nacen aparecen por detrás — que es lo que hace que un alfa se superponga a los del fondo en vez de ser tapado
por ellos. La bandera sólo se enciende mientras se compone un túnel; fuera de él no cuesta ni una comparación.

### Real time

Lo pidió explícitamente y sale por construcción: el movimiento es **procedural**, no horneado en keyframes. Con el
editor en pausa, `motionTick` adelanta un reloj de previsualización y repinta (y `anyAnim()` desciende a los
nidos, así que un túnel dentro de un nido mantiene la vista viva); en reproducción y export manda el tiempo real
del fotograma, con lo que el resultado es determinista. Medido: sin tocar el cabezal, el tamaño de un elemento
pasa de 1 a 6,21 solo.

### Verificado (`scratchpad/r246-tunel.mjs`)

Sierra que vuelve a 0 y acelera hacia el final · envoltura del plano del ojo de pez al borde opuesto · los 6
elementos como fulldome, con sierra, fundido y desfases repartidos (0 · 0,167 · 0,333 · 0,5 · 0,667 · 0,833) ·
real time sin mover el cabezal · **profundidad correcta en los 12 instantes probados, 0 fallos** · el diálogo
ofrece el tipo con sus cinco mandos y esconde los que no aplican. `__errs` vacío.

*Nota de método:* la primera corrida marcó en rojo la curva exponencial, y **la equivocada era mi comprobación**
—pedía «más de 50 al 75 % del ciclo», que es lo que hace una curva que se FRENA al final—. El motor estaba bien.
Ahora la sonda comprueba lo que de verdad significa acelerar: que cada tramo sea mayor que el anterior.

## ROUND 245 — Dos del panel de Medios que salieron usándolo

Los dos reportados por Beltrán mientras trabajaba, y los dos con la misma forma: un camino cubierto y su gemelo
olvidado.

### 1 · En CUADRÍCULA el clic-derecho sobre un clip daba el menú del panel

En vista de lista, el clic-derecho sobre un medio ofrece lo suyo (crear composición, añadir a la línea de tiempo,
renombrar, propiedades, reemplazar, eliminar). En **cuadrícula** salía «Importar medios / Nueva carpeta», es decir
el menú del **panel**.

El tile sí engancha su propio `contextmenu` — eso estaba bien desde siempre. Lo que fallaba es que el menú del
panel se abría **encima** por burbujeo: su guard excluía `.mitem` (las filas de la lista), `.folderhdr` y
`.folderdrop`, pero **no `.mtile`**. Los tiles de CARPETA no se veían afectados porque llevan además la clase
`folderhdr`, que sí estaba en la lista — por eso el fallo parecía caprichoso: en cuadrícula las carpetas
respondían bien y los clips no. Las cuatro clases pasan a comprobarse en un solo `closest`.

### 2 · Arrastrar varias imágenes las tomaba por una secuencia PNG

`importFiles` agrupa imágenes con nombre numerado (tres o más con el mismo prefijo y extensión) y pregunta los
fotogramas por segundo para toda la tanda. Eso está bien cuando la importación es deliberada — pero corría
**también en el arrastre**, así que soltar tres capturas llamadas `frame001.png`… abría un diálogo que no dejaba
seguir hasta configurar una secuencia que nadie había pedido. Beltrán: *«si simplemente las arrastro, no es un
sequence, son clips nomás»*.

`importFiles` acepta ahora `opts.noSeq`, y lo pasa **el arrastre y sólo él** (las tres llamadas de
`importDropped`, incluida la de una carpeta soltada). El selector de archivos —«Importar medios…»— conserva la
detección **entera**: es donde el gesto es deliberado y hay ocasión de decir que no.

### Verificado (`scratchpad/r245-ctx-grid.mjs`, con eventos reales)

Menú: en cuadrícula sale el del medio y no el del panel · en lista, igual que antes · el fondo del panel sigue
dando «Importar medios / Nueva carpeta» · una carpeta en cuadrícula conserva el suyo.
Importación: arrastrar cuatro `frame00N.png` crea **cuatro medios `image` y no pregunta nada**; los mismos cuatro
por el selector **sí** abren el diálogo de fotogramas por segundo.

*Dos notas de arnés, porque las dos dieron un verde falso antes de mirarlas:* el lector de menús de la sonda
buscaba `.mi/.item/div` cuando `openMenu` construye `<button role="menuitem">` — devolvía texto vacío y por tanto
«no hay menú del panel», que parecía un aprobado. Y la prueba del selector no pedía fps porque `importFiles`
**deduplica por nombre+tamaño** y los archivos ya los había metido la prueba del arrastre: hubo que darles
prefijos distintos. Las dos correcciones quedan anotadas en la propia sonda.

### [R245b] El modelo de Premiere: la secuencia se ELIGE antes, no se adivina después

Al contarme el caso con calma, Beltrán dio con la raíz y con la solución: *«Algo bueno que tiene Premiere es que
cuando pongo importar medio, me da la opción de seleccionar con un check si es una secuencia de imágenes o no. Si
no tengo seleccionado el check, simplemente selecciono las imágenes y las importa unitariamente.»*

Tiene razón, y R245 sólo había arreglado la mitad: el arrastre. Por el selector, cinco imágenes numeradas que no
son una secuencia seguían abriendo el diálogo de fotogramas por segundo, y ahí **no había salida buena** —
aceptar las convertía en un vídeo y **Cancelar descartaba los archivos enteros** (`close(false)` no llamaba al
callback), que es exactamente por qué acabó importándolas de una en una.

**La casilla de Premiere ya existía aquí, mal cableada.** El menú del panel tenía dos entradas —«Importar
medios…» e «Importar secuencia de imágenes…»— que hacían **exactamente lo mismo**; era la duplicación que R245
dejó anotada como observación. Ahora dicen la verdad, y son la casilla:

| Puerta | Qué hace |
|---|---|
| **Importar medios…** (y el botón Import, ⌘I, la zona vacía) | cada imagen entra como SU clip · **nunca pregunta nada** |
| **Importar secuencia de imágenes…** | agrupa las numeradas y pide los fotogramas por segundo |
| **Arrastrar** | siempre clips sueltos (R245) |

El selector de archivos es el **nativo del sistema** y no admite controles propios, así que la elección no puede
ir dentro del diálogo como en Premiere: vive en la puerta por la que entras. `pickMedia(seq)` es la única vía al
selector y la bandera se consume en el `onchange` y se limpia siempre — un diálogo cancelado no deja el modo
pegado para la importación siguiente.

Dos remates para que ningún camino quede mudo:
- **El diálogo estrena una tercera salida, «Como imágenes sueltas»**, para cuando el agrupador acierta la forma
  pero se equivoca de intención. Cancelar sigue significando cancelar; lo que ya no hace falta es elegir entre un
  vídeo que no querías y perder la importación.
- Si pides «Importar secuencia de imágenes…» y **no hay ninguna agrupable** (hacen falta 3 o más con el mismo
  prefijo y extensión, numeradas), entran como imágenes sueltas —que es lo correcto— **y se avisa**, porque en
  silencio parecería que el modo no funcionó.

**Verificado** (`scratchpad/r245-ctx-grid.mjs`): «Importar medios…» con cuatro `medios00N.png` → **4 medios
`image`, sin diálogo** · «Importar secuencia…» + «Como imágenes sueltas» → **4 medios `image`** · «Importar
secuencia…» + «Importar como secuencia» con cinco archivos → **1 medio `sequence` a 60 fps** · el botón Import
pasa por `pickMedia(false)`.

## ROUND 244 — El contenedor de la línea de tiempo deja de estar preso de las pistas

Pedido de Beltrán: *«El contenedor del timeline queda bloqueado por el tamaño máximo de las pistas. Cambiemos a
que si llegamos al máximo de las pistas, podamos seguir agrandando el contenedor y las pistas se agranden junto a
eso. Lo mismo al achicar. Esto sólo sucede cuando llegamos a los límites altos o bajos de cada una, ya que si
dentro hay infinitas pistas, no debiera haber problema con subir y bajar ese contenedor.»*

**El bloqueo, medido:** el arrastre del divisor topaba en `tlMaxH()` = regla + suma de alturas. Con **dos pistas en
su altura máxima de entonces (120)** el panel no pasaba de **281 px**, aunque la ventana diera para 828. R156 lo
había puesto así con una buena razón —estirar dejaba una banda vacía bajo la última pista y no aportaba nada—,
pero la conclusión era la equivocada: lo que sobra no es el gesto, es el vacío. **Ahora el gesto llega y las
pistas lo acompañan**, así que no hay vacío que evitar.

### La regla, que es literalmente la que pidió

El acoplamiento **se decide una sola vez por gesto**, en el `pointerdown`, con `tlLanesFit()`: ¿caben las pistas en
el hueco visible?

- **Caben** (pocas pistas, o muchas pero bajas) → el arrastre las lleva consigo en los **dos sentidos**, repartiendo
  el hueco proporcionalmente sobre las alturas del inicio del gesto.
- **No caben** (el contenido ya desborda: las «infinitas pistas» de Beltrán) → no se toca **nada**. Ahí el divisor
  nunca estuvo bloqueado; subir y bajar sólo enseña más o menos pistas, con su scroll de siempre.

Decidirlo una vez y no en cada movimiento no es un detalle: al **achicar**, el contenido pasa a desbordar en el
primer píxel, así que un acoplamiento re-evaluado paso a paso se habría apagado solo a mitad del gesto — y
«lo mismo al achicar» es justo lo que se pedía.

### Dos cosas que hubo que resolver para que no peleara consigo mismo

- **Un solo techo para todos los caminos.** `LANE_MAX_H` pasa de 120 a **480**. Tener dos techos (uno para el
  divisor y otro para Alt+rueda) parecía más prudente y era peor: una pista que el divisor hubiera dejado en 300
  habría **saltado a 120** al primer Alt+rueda *hacia arriba* — encoger cuando se pide crecer. Verificado que
  ahora 300 → 330 al agrandar y vuelve a 300 al encoger.
- **Dos topes peleando por la misma altura.** El arrastre permite el 92 % de la ventana y el recorte automático
  usaba el 78 %: el divisor dejaba llegar y al soltar el panel volvía atrás. Con altura manual el recorte usa
  ahora el mismo tope del gesto, y **sigue recortando al contenido**, que es lo que evita la banda vacía cuando
  las pistas ya no pueden crecer más (el motivo de R171, intacto). Y `clampTimelineH` se aparta mientras dura el
  arrastre: el reparto deja el contenido a un par de píxeles del hueco por redondeo, y devolver esa diferencia en
  cada movimiento producía temblor.

El sobrante del redondeo se le da a la última pista elástica, así que el contenido cae **exacto** sobre el hueco
(medido: 435 = 435) y no aparece una barra de scroll fantasma por un píxel.

### Verificado (`scratchpad/r244-contenedor.mjs`, con PointerEvents reales sobre el divisor)

| Caso | Resultado |
|---|---|
| El bloqueo reportado | con el techo viejo, 2 pistas topaban el panel en **281 px**; ahora llega a **828** |
| Pocas pistas, agrandar | panel 170 → 430 · pistas 57 → 207 · llenan el hueco, sin banda vacía |
| **Achicar** | panel 430 → 230 · pistas 207 → 106 · siguen llenando |
| 14 pistas (desborda) | panel 230 → 390 · **alturas intactas**, sólo scroll |
| Achicar a tope | ninguna pista por debajo de su suelo · panel en su mínimo de 170 |
| Alt+rueda tras un llenado | 300 → 330 al crecer, 330 → 300 al encoger (no salta) |

*Nota de método:* la primera corrida dio dos «fallos» que eran del arnés, no del programa —tres pistas a 480 ya
desbordan, así que ese caso no probaba lo que yo creía, y a `wheelResizeLanes` le pasé un número cuando espera un
**evento** (`e.deltaY` salía `undefined` y encogía siempre). La misma trampa nº 3 que el encargo de la auditoría
avisaba. Corregidos los dos casos, todo verde.

### [R244b] Lo que encontró la revisión del diff — tres hallazgos, y uno tumba mi verificación

- **La regla vive DENTRO del área de scroll, y yo repartía el hueco entero.** `#ruler` (24 px) es hija de
  `#tlscroll` y, aunque sea `position:sticky`, sigue **en flujo** — lo confirma el `min-height:calc(100% - 24px)`
  de `.tracks`. Repartir `clientHeight` completo dejaba un desbordamiento permanente de **exactamente esos 24 px**,
  y como `.tlscroll` lleva `scrollbar-width:none` **no se veía**: la última pista se recortaba en silencio. Ahora
  el hueco se mide sin la regla (`tlHueco`, leyendo el alto real del DOM con `RULER_H` de reserva). Medido:
  `scrollHeight − clientHeight` pasa de **24 a 0**.
- **Y esto es lo que más vale de la revisión:** mi sonda comparaba «suma de alturas» contra `clientHeight` y
  cantaba «exacto, 435 = 435»… que es **justo la igualdad que mi propio reparto impone**. Una prueba tautológica:
  no podía fallar aunque el código estuviera mal, porque medía el invariante que el código fabrica en vez de la
  propiedad que importa. La comprobación correcta es la del DOM, `scrollHeight === clientHeight`, y es la que
  lleva ahora la sonda. Vale la pena dejarlo escrito: un número verde no prueba nada si la prueba mide su propia
  premisa.
- **`maxManual` perdió el suelo de 170 px.** Al extraer `tlContentH()` de `tlMaxH()` se me quedó fuera el
  `Math.max(170, …)`. Con altura manual y las pistas plegadas, el contenido cae a 89 px y el panel lo seguía —
  por debajo de los 153 px del `#toolRail`, que quedaba recortado. Se disparaba al plegar o borrar pistas
  **después** de haber arrastrado el divisor alguna vez. Verificado: el panel se queda en 170 y tapa el rail.
- **`markDirty()` en cada `pointermove`.** El `after` corre a ~60 Hz y `markDirty` hace dos IPC al proceso
  principal (`setTitle`, `setUiState`) más `raInvalidate()`: ~120 IPC/s para anotar un alto de pista. Ahora se
  marca **una vez al soltar**, como ya hacía `startVCapDrag`. Medido: de 8 llamadas por arrastre a **1**.

*(Y una tercera del arnés, por si sirve de aviso: la sonda dejó de parsear porque escribí **backticks dentro de un
comentario que vive en una plantilla** y cierran el template — trampa nº 5 del encargo, con su propia nota ahora
en el archivo.)*

## ROUND 243 — El scrub sin proxy deja de ser inviable

Lo último que quedaba en la cola, y lo de más valor práctico para Beltrán según la auditoría de agosto (§3.3).
R241 midió el problema —4 capas de HEVC 7196×912 sin proxy: **1148 ms de mediana por salto de cabezal**, frente a
8 ms con proxy— y lo atribuyó al «reposicionamiento del decodificador». La auditoría llegó a la causa exacta con
ffprobe sobre el material real: **GOP de 250 fotogramas** (I-frames en 0, 250, 500 → uno cada 4,2 s a 60 fps).

**No es un problema de eficiencia que se pueda optimizar: es el precio de la exactitud sobre un GOP largo.**
`currentTime = t` exige el fotograma EXACTO, así que el decodificador tiene que rehacer hasta 250 fotogramas de
6,5 Mpx. Lo que cambia esta ronda no es el cómo, es **la pregunta**: mientras el cabezal se ARRASTRA no hace falta
el fotograma exacto, basta el más cercano que se pueda dar ya — que es lo que hacen Resolve y Premiere en su modo
rápido. Al SOLTAR se pide el exacto. La precisión del montaje no se toca en ningún momento.

### Lo medido, sobre el `.exe` y con el material de Beltrán

| Escenario (sin proxy) | Antes | Arrastrando | Ganancia |
|---|---|---|---|
| 4 capas de 7196×912 | 1137 ms · peor 2242 | **128 ms · peor 164** | **8,9×** |
| 1 capa | 178 ms · peor 361 | **16 ms · peor 18** | **11,1×** |

Con una capa, 16 ms es un fotograma de reloj: el arrastre va fluido. Con cuatro, 128 ms es la diferencia entre
«no se puede montar» y «se puede».

**Corrección honesta de mi propia estimación:** el informe de auditoría aventuró «~10-40 ms, 30-100× mejor». La
ganancia real es **9-11×**, no 30-100×. La estimación daba por hecho que decodificar un fotograma cuesta 10-40 ms
en total, cuando con cuatro capas son ~32 ms por capa. El orden de magnitud del alivio se cumple; el múltiplo que
prometí, no. Queda escrito porque una estimación optimista sin corregir se convierte en la cifra que alguien cita
seis meses después.

### Cómo

`fastSeek()` —la API estándar para esto— **no existe en Chromium**, comprobado en el `.exe`. Así que las
posiciones de los fotogramas clave salen del demuxador propio, que ya leía la tabla `stss` para el camino de
WebCodecs: `kfTimes(m)` construye una vez la lista de instantes clave en segundos y la cachea en el medio;
`snapKf(m,t)` hace una búsqueda binaria del mayor ≤ t. Pedir el instante EXACTO de un fotograma clave hace que el
decodificador decodifique UNO en vez de hasta 250. Medido en el material: 4 fotogramas clave por clip, **4,17 s
entre ellos** — exactamente el GOP de 250 a 60 fps que dijo ffprobe.

El modo rápido se enciende en el **primer movimiento**, no en el `pointerdown`: así un clic suelto en la regla
—que es un salto, no un arrastre— va directo al fotograma exacto sin decodificar dos veces.

### Dónde NO actúa, que es la mitad del trabajo

Un atajo que se cuele donde no debe enseñaría un fotograma equivocado **en silencio**, que en un montaje es el
peor fallo posible. Las guardas, todas verificadas:

- **Con proxy en uso, no actúa** (`kfWorthIt` → false): ya son 8 ms, no hay nada que ganar.
- **En export, no actúa** — y no por la bandera, sino porque `exporting` manda: verificado forzando la bandera a
  mano durante un export simulado, el fotograma sigue siendo el exacto.
- **Material ligero, no actúa**: por debajo de 2 Mpx el reposicionamiento ya es barato y ni se lee el moov (un
  720p da `false`; la tira de 7196×912, `true`).
- **Intra-only** (ProRes, DNx, MJPEG): si todos los fotogramas son clave, se marca `_kfAllIntra` y se deja en paz.
- **Red de seguridad:** la bandera se apaga ante cualquier `pointerup` de la ventana, `pointercancel` o pérdida de
  foco — un arrastre interrumpido por un Alt+Tab no puede dejar el editor enseñando fotogramas clave para siempre.
  Verificado disparando un `pointerup` con la bandera armada.
- **Al soltar, el fotograma es el pedido:** los cuatro clips en `currentTime` 7,317 exacto tras soltar en 7,317.

La tabla se pre-calienta al importar material pesado (se engancha al aviso de proxy de R242, que ya identifica ese
material), para que el PRIMER arrastre también sea rápido en vez de pagar la lectura del moov dentro del gesto.

Sondas: `scratchpad/r243-scrub.mjs` (la medida, con comprobación anti-trampa de que ninguna instancia se está
sirviendo del proxy) y `r243-guardas.mjs` (las seis guardas). `__errs` vacío en las dos.


## ROUND 242 — El plan de la auditoría de agosto, ejecutado

`AUDITORIA-2026-08.md` (auditoría delta R223→R241, hecha por un auditor externo sobre el `.exe` desplegado) dejó
un plan de cinco etapas y cinco decisiones. Beltrán delegó el criterio («confío en tu criterio, avanza»), así que
se ejecutan las cinco etapas y se resuelven las cinco decisiones, que quedan anotadas abajo por si alguna hay que
revertir.

### La cura de raíz: nada se hereda del proyecto anterior

La auditoría cazó la **cuarta aparición** de la familia que ya costó R239, R239b y R240b, y esta vez con
consecuencia grave: un `.isp` **legacy sin secuencias** (v2/`.rdome`) creaba la suya en `ensureSequences` con el
**`state.seqMode` del proyecto ANTERIOR**. Abriendo un domo v2 con una sala 360 abierta, el domo entraba como
`mode:'room'` sin `seq.room` — y **guardarlo dejaba esa mentira escrita en el archivo para siempre**.

En vez de tapar ese caso, se generaliza la regla de R240b: **`resetProjDefaults()` aplica los valores de FÁBRICA
antes de leer el archivo**, y lo llaman los TRES caminos (`loadProject`, `newProject`, `newRoomProject`). Cubre
`seqMode`/`seqCov`, `tl.bpm`/`sig`/`tcMode`/`audioCollapsed` (los tres primeros se leían con `if(obj.tl.X)`, así
que un archivo sin bloque `tl` se quedaba con el tempo del proyecto anterior: medido, bpm 174 y compás 7 viajando
de una sala a un domo recién abierto) y el **encuadre del visor** — zoom/pan global, `view.vp` por panel y la
cámara 3D—, que sobrevivían tanto a `newProject` como a `loadProject`. Que `newRoomProject` YA lo reseteara era la
prueba de que era descuido y no decisión. `obj.lanes||state.lanes` pasa a `obj.lanes||defLanes()` por lo mismo.

Es además la «migración centralizada de `.isp`» que la auditoría de julio pidió, hecha en su versión mínima: una
función, un punto de aplicación, y la regla explícita de que **campo ausente = fábrica, nunca lo heredado**.

### La fuga que sólo se veía abriendo proyectos

`newProject` desechaba los medios del proyecto saliente desde siempre; **`loadProject` no**. Su limpieza cubría
`_vinst`, `_fxHist`, la papelera y el registro de LUTs, pero `state.media` se reemplazaba sin `disposeMedia` y
`state.clips` sin borrar sus `maskTex`. Medido por CDP: **+5 texturas GL vivas por cada apertura**, que no volvían
nunca. Con el demo son texturas pequeñas; con material real cada medio de vídeo se lleva su textura de fotograma
(26 MB en una tira de 7196×912) más su `<video>` y su decodificador. Cuatro o cinco proyectos abiertos en una
jornada de montaje = cientos de MB que sólo devolvía reiniciar. Ahora las dos pasadas de dispose son simétricas a
las de `newProject`. Verificado: el mismo ciclo de cuatro aperturas pasa de **5→10→15→20 texturas** a **0, 0, 0, 0**.

### Lo demás del plan

- **BOM.** Un `.isp` re-guardado desde el Bloc de notas (el caso real: alguien corrige una ruta a mano) llega con
  BOM UTF-8 y `JSON.parse` lo rechazaba: **«Invalid project», sin pista de por qué**. `stripBom()` en los cinco
  parses de proyecto y autoguardado. Verificado: el mismo archivo que fallaba abre.
- **La descarga del runtime NDI llevaba muerta desde R226.** El `setWindowOpenHandler` deniega —bien— todo
  `window.open` que no sea el visor emergente, así que el «¿Abrir la página de descarga?» aceptaba y **no pasaba
  nada**. Canal nuevo `dsp:openExternal` con `shell.openExternal` y **allowlist estricta** (sólo http(s) hacia
  `ndi.video`/`ndi.link`): no es un «abrir cualquier cosa» genérico. Verificado que un dominio ajeno, un `file://`
  y una cadena que no es URL devuelven `false`.
- **macOS · el Dock.** Cerrar la ventana en macOS deja la app viva; el clic del Dock llamaba a `createWindow()`,
  que nace con `show:false` y espera a `finishBoot()`… cuyo guard `bootDone` seguía en `true` desde el primer
  arranque. **La ventana no se mostraba nunca** y la única salida era Cmd+Q. Se rearma `bootDone=false` antes de
  crear. Estático: no hay Mac para probarlo, queda anotado.
- **Las dos últimas rutas con `'\\'` cableado** (`ncBuild`, la carpeta «nest proxies» y el nombre del archivo)
  pasan a `PSEP`. Eran los supervivientes de la familia R204; en Windows son inocuas, por eso nadie las vio.
- **El viewport de relleno se acota a `MAX_VIEWPORT_DIMS`.** Con un lienzo de aspecto >512 el driver lo recortaba
  **en silencio** mientras `mstrU/mstrV` seguían calculando con el viewport pedido. Ahora cálculo y GL usan los
  mismos números. Es un caso de laboratorio (haría falta un lienzo de 16000×20), pero el arreglo es una línea y el
  fallo era del tipo que no avisa.
- **`build.files`/`asarUnpack` incluyen Spout explícitamente.** No arregla un bug —electron-builder ya lo metía
  por su cuenta, verificado en el paquete real—, pero la lista nombraba sólo NDI y **sugería que Spout faltaba**.
  Ahora la lista dice la verdad.

### Las cinco decisiones, resueltas (revisables)

1. **Encuadre del visor entre proyectos** → se **resetea** al abrir y al crear, en vez de guardarse en el `.isp`.
   Coherente con `newRoomProject` y con R239: cada proyecto abre encuadrado por sí mismo, no por el anterior.
2. **Scrub sin proxy** → se toma **sólo la mitad barata**: un aviso al importar material pesado (≥5 Mpx o
   ≥80 Mbps) que recuerda el proxy, agrupado por tanda. **ADR-0003 queda intacto: informa, no genera.** La
   previsualización al keyframe durante el arrastre (~30-100×) **NO se hace aquí**: toca el camino de
   decodificación en caliente, se merece su propia ronda con su verificación, y meterla en el mismo commit que
   siete arreglos de integridad habría hecho imposible saber qué rompió qué. Queda en `docs/NEXT.md` como lo
   siguiente de más valor.
3. **Hardening de la superficie IPC** → **no se toca**, se documenta. El renderer es código propio, no se navega a
   contenido remoto y el `setWindowOpenHandler` ya cierra la puerta de las ventanas; acotar `deleteFile`/
   `writeText` a raíces conocidas añade fricción real (render en el sitio, proxies junto al clip, export a
   cualquier carpeta) contra un riesgo que hoy es hipotético. Si algún día se abren `.isp` de terceros de forma
   habitual, se reabre.
4. **`tl.audioCollapsed`** → **revivido**. El lector de R110 seguía ahí esperando un campo que `serProject` había
   dejado de escribir en alguna reescritura; devolverlo son tres caracteres y la promesa vuelve a cumplirse.
   > **Corregido en R242b: era la salida equivocada.** Ver abajo.
5. **Interfaz de la cola de export** → **se cierra el pendiente**: la UI mínima de R216 (fila por trabajo, ✕
   individual, «Cancel queued») es suficiente ahora que **[D2] está retirado** y no se puede editar mientras
   exporta. Sin una cola que se administre en paralelo, no hay nada más que gobernar.

### Verificación

Las seis sondas de la auditoría, vueltas a pasar (`scratchpad/aud2608-*.mjs`), `__errs` vacío en todas:
herencia **sin heredar nada** en los tres frentes (vista 0,92/[0,0]/cámara de fábrica · legacy v2 tras una sala →
`mode:'dome'` · tempo 120/4/timecode) · BOM abre · migraciones v2 y v3 y el viaje v3→v4 sin cambios · fugas
**0,0,0,0** · encuadre por secuencia sin regresión (0 · 5000 · 1234) · `openExternal` deniega dominio ajeno,
`file://` y basura. `node --check` limpio en `app.js` y `main.js`.

### [R242b] Lo que encontró la revisión del diff — cuatro hallazgos, todos reales

Uno de ellos corrige una **decisión mía equivocada** de la propia ronda, así que conviene dejarlo escrito.

- **`audioCollapsed`: la decisión 4 estaba mal, y la salida buena era la otra.** La auditoría ofrecía revivir el
  campo o retirar el lector; R242 lo revivió «porque son tres caracteres». El revisor fue a mirar si alguien lo
  usaba y **no**: el módulo de audio plegable (`.audiozone`) **no existe desde R148** —lo dice el comentario que
  hay junto a `audioZoneScrollBy`, «ese módulo no existe desde R148»— y `git log -S "audioCollapsed=true"` no
  devuelve **nada** en toda la historia del repo: **nunca hubo un gesto que lo pusiera en `true`**. Es decir: el
  lector no esperaba un campo perdido, esperaba uno que jamás pudo valer otra cosa que `false`. Revivir la
  escritura sólo añadía una constante al `.isp` y, peor, dejaba tres documentos diciendo que una promesa se había
  restaurado. Retirado entero (literal de `state`, lectura y escritura) y archivado con el porqué
  (`_backup/deprecated/20260804-tl-audiocollapsed.js`, ADR-0007). `_audioScroll` no se toca: ese sí se escribe.
- **`inlineCurves` se me escapó de `resetProjDefaults`** — y es exactamente la familia que la ronda decía curar
  **de raíz**. Vive en el mismo bloque `tl` serializado y sólo se restauraba dentro del `if(obj.tl)`, así que
  abrir un legacy sin ese bloque (el propio `aud2608-legacy-v2.rdome` del repo tiene esa forma) conservaba el modo
  automatización del proyecto anterior, con `#curvesBtn` encendido, y al guardar lo escribía en un proyecto que
  nunca lo tuvo. De paso, el sincronizado de la UI sale del `if(obj.tl)` por el mismo motivo que el zoom de R240b:
  sin eso el valor se reseteaba pero el botón y las alturas de pista se quedaban como los dejó el anterior.
- **La navegación del panel de medios tampoco se limpiaba al abrir.** `newProject` y `newRoomProject` ponen
  `selFolder`/`mediaFolder` a null; `loadProject` no. El proyecto nuevo abría «dentro» de una carpeta del anterior:
  ahí aterrizaban los archivos importados (que aparecían como sin archivar) y, si el proyecto nuevo tenía una
  carpeta del mismo nombre, **Delete borraba esa carpeta con sus medios** sin que el usuario la hubiera
  seleccionado nunca ahí.
- **El resultado de `openExternal` se descartaba.** El canal devuelve `false` sin diálogo ni registro cuando la
  URL no pasa su allowlist, y esa URL **no es nuestra**: la da el addon nativo. Si NDI mudara su dominio, tirar
  ese `false` reproduciría *exactamente* la puerta muda que R242 vino a cerrar. Ahora hay un único
  `abrirDescargaNDI()` que comprueba el resultado y, si falla, **enseña la URL** para copiarla a mano. (El
  revisor lo marcó como `PLAUSIBLE` —hoy la URL pasa—; se arregla igual porque el coste es una función y el
  fallo es del tipo que no avisa.)

Verificado con las mismas sondas más una nueva para el caso de `inlineCurves` (`scratchpad/r242b-review.mjs`).

### [R242c] Las dos preguntas que quedaban abiertas, contestadas por Beltrán

Las dos venían de R239 y llevaban dos sesiones esperando. Ninguna era un bug: eran decisiones de producto que no
me correspondía tomar.

**1 · El encuadre al entrar a una secuencia — su regla, palabra por palabra:** *«Al entrar a un nest o secuencia
por primera vez, sí o sí al inicio. Luego, volver a cualquier otra secuencia, debe estar donde dejamos la última
vez esa secuencia. Si la secuencia A la dejé en el minuto 70 y la B en el 5: si entro a la A debo estar en el 70 y
si entro a la B en el 5. Siempre manda la última vez que entramos. Y si es la primera vez, 00.»*

**Eso es EXACTAMENTE lo que hace el código desde R239, así que no se toca nada.** Vale la pena dejarlo escrito
porque en su momento Beltrán había dicho «al inicio nomás» y yo lo implementé simétrico con el padre por criterio
propio, anotándolo como pregunta abierta; su respuesta confirma esa lectura. Verificado con su escenario literal
(`scratchpad/r242c-encuadre-beltran.mjs`, con dos secuencias A y B y el zoom fijo para poder hablar en segundos):
primera vez en A → **0** · primera vez en B → **0** · dejo A en 4200 s (minuto 70) y B en 300 s (minuto 5) ·
vuelvo a A → **4200** · a B → **300** · y otra vuelta más, **4200** y **300** (para descartar que aguantara sólo
un salto) · una secuencia **creada** estando en el minuto 70 abre en **0**. `__errs` vacío.

**2 · El desvanecido del borde de las pestañas: «corte hueso».** Era un añadido mío de R239b — al ocultar la barra
de scroll de las pestañas de secuencia desapareció el único aviso de que había más, y lo sustituí difuminando el
borde por el lado con contenido oculto. Beltrán prefiere el corte limpio, así que `seqTabsOvf` y sus tres
llamadas se archivan junto con las tres reglas CSS (ADR-0007,
`_backup/deprecated/20260804-seqtabs-overflow-fade.js`). **Lo que NO se va:** la rueda sobre las pestañas y
`seqTabsReveal`, que arrastra la activa a la vista — sin ellas volvería el defecto real de R239b (una pestaña
inalcanzable). Verificado con diez secuencias abiertas (`scratchpad/r242c-tabs-hueso.mjs`): la barra desborda
(1107 px de contenido en 453 de hueco), `mask-image` es **none** y no queda ni una clase `ovf-*` ni la función;
la rueda sigue desplazando (327 → 447) y activar la última pestaña la deja visible.

## ROUND 241 — Prueba de estrés tipo show, con el material real

La única cosa que quedaba en la cola y que no se podía simular. Beltrán prestó su sala (`Rito360.isp`, 7196×912,
4 muros) y nueve clips **HEVC 7196×912 @60 fps de hasta 410 Mbps** — material de masterización, ~3 GB. Se corrió
sobre el **`.exe` desplegado**, no en dev: comprobado por `WEBGL_debug_renderer_info` que estaba en la **RTX 4060**
y no en la Intel, porque una prueba de estrés medida sobre la GPU equivocada no vale nada.

### Lo que aguanta

| | 4 capas de 7196×912 simultáneas |
|---|---|
| GPU por `render()` | **0,05–0,07 ms** |
| Reproducción | **60,2 fps** sostenidos · mediana 16,6 ms · P95 19,7 ms · 2 tirones >33 ms en 5 s |
| Composite (R237) | 25 MB a Full · 6,3 a ½ · 1,6 a ¼ |
| Memoria JS | 10 MB, plana |

Ni un contexto WebGL perdido. **La GPU no es el cuello ni de lejos** — el composite no cuadrado de R237 ayuda, pero
es que cuatro quads de 6,5 Mpx no son nada para esta tarjeta.

### Lo que no: el scrub sin proxy

| | mediana | peor |
|---|---|---|
| Scrub, 4 capas, SIN proxy | **1148 ms** | 2256 ms |
| Scrub, 4 capas, CON proxy | **8 ms** | 9 ms |

**143× de diferencia.** Con este material, editar sin proxy es inviable y con proxy es instantáneo. El cuello es
el reposicionamiento del decodificador HEVC, no el motor. Confirma que la decisión de proxies manuales (ADR-0003)
necesita que el usuario SEPA cuándo hacen falta: aquí no son una optimización, son la diferencia entre poder
montar y no.

### Un aviso de método, porque casi reporto números falsos

La primera pasada dio **0,07 ms/render y `texturasVideoMB: 0`** con cuatro capas 7196×912. Increíble, y por eso no
lo reporté: paré a diagnosticar. Resultó que sí dibujaba —4 decodificadores vivos, composite al **99,6 %** de
cobertura— y que los ceros eran la **granularidad reducida de `performance.now()`** en Electron. La medida buena
promedia 400 renders de golpe para salir del ruido del reloj. Un número imposible casi siempre es el arnés, no la
app.

### Dos bugs reales, encontrados por el material y arreglados

**1 · `detectFps` fallaba con material pesado: los NUEVE clips entraban a 30 fps siendo de 60.** Recogía diez
fotogramas por `requestVideoFrameCallback` con un plazo de **2,5 s fijo** y, al vencer, **tiraba todas las
muestras** (`fn(0)` → `if(f>0)` no asigna) y dejaba el 30 por defecto. Decodificar diez fotogramas de 6,5 Mpx a
410 Mbps no entra en 2,5 s ni de lejos; el clip 1080p del mismo proyecto sí acertaba. No es cosmético: `m.fps`
manda en la **tasa del proxy** (se generaban a 455 de 911 fotogramas, la mitad), en el índice del caché de
scrub-ahead (`_raVidFrame`) y en toda cuenta de tiempo↔fotograma — un 60p editado como 30p miente sobre qué
fotograma estás viendo. Ahora se calcula con las muestras que haya (tres intervalos bastan) y el plazo escala con
los megapíxeles hasta un tope de 8 s. Medido con el material real: **0 de 9 aciertos → 9 de 9**. Los nueve proxies
se regeneraron y pasan de 30 fps/455 fotogramas a **60/1 y 911**, idénticos al original.

**2 · Un rechazo de promesa sin capturar por cada clip sin pista de audio.** `decodeAudioData` atiende los
callbacks **y además devuelve una promesa**; el `rej` capturaba el error pero la promesa devuelta quedaba sin
dueño → «Unable to decode audio data» en la consola por cada clip, para un caso que el `catch` ya trataba como
normal. El export tenía este mismo remedio puesto desde R240 (línea 7419) y `armMediaAudio` se quedó sin él.
Verificado ejercitando el camino de verdad (109 MB, dentro del tope de 1,2 GB, marca `_noAudio`): **cero rechazos
sueltos**.

Sondas: `scratchpad/r241-stress.mjs`, `r241-carga.mjs`, `r241-diag.mjs`, `r241-medir.mjs`, `r241-fps2.mjs`,
`r241-reproxy.mjs`, `r241-audio2.mjs`.

## ROUND 240 — La segunda pasada de QA que quedó pendiente de la auditoría

`AUDITORIA-2026-07.md` cerró sus cuatro etapas pero dejó anotada una **«segunda pasada de QA»** que nunca se
corrió: atajos, trim a duración 0, borrar media en uso, borrar la secuencia activa, marcadores, work in/out
invertido y zoom extremo del timeline. Se ejecutó por CDP (`scratchpad/r240-qa.mjs` y `r240-qa2.mjs`).

**Resultado: seis de siete escenarios ya se comportaban bien.** El trim topa en `CUT_MIN` (0,05 s) por los dos
bordes sin dejar duraciones negativas ni NaN, y respeta el límite del material de origen; borrar un medio en uso y
deshacer devuelve medio y clips intactos; un work in/out invertido no rompe `duration()` ni el repintado del rango;
la exclusión locator ⇄ clip funciona en las dos direcciones (los cuatro caminos que seleccionan un locator limpian
`selId`, y el gesto del timeline limpia `selMarkerId`); y el guard que impide quedarse sin secuencia abierta
aguanta.

### El hallazgo: el zoom del `.isp` entraba sin acotar

Los ocho gestos que tocan `pxPerSec` —rueda, `+`/`−`, los dos botones, la barra de zoom, Fit y zoom-a-clip— pasan
por `TL_PPS_MIN`/`TL_PPS_MAX`. **Abrir un proyecto era el único que no.** Con un `.isp` de `pxPerSec:1e7` la línea
de tiempo reservaba **33 554 432 px** de ancho y ningún gesto la devolvía a un rango usable. Acotado al cargar:
mismo archivo → 2400 y 53 869 px.

No es un caso de laboratorio por una razón concreta: el zoom **se guarda en el proyecto**, así que cualquier vía
que llegue a escribir un valor malo —un archivo tocado a mano, un `.isp` de una versión futura, un cálculo que se
desmadre— deja la línea de tiempo inservible al abrir, y el usuario no tiene forma de saber por qué.

**[R240b]** La revisión del diff no encontró defectos, pero dejó anotada como fuera de alcance una consecuencia
que resultó ser **la misma familia de bug que esta sesión ya persiguió dos veces**: un `.isp` que no trae zoom
—ni el campo, ni el bloque `tl` entero, que es lo de un archivo legacy— **heredaba el del proyecto anterior** en
vez de volver al de fábrica. Idéntico en naturaleza al encuadre horizontal de R239. Ahora el reset vive FUERA del
`if(obj.tl)`, justo por el caso del bloque ausente. Siete casos verificados (`scratchpad/r240b-zoom.mjs`): sin
zoom → 80 · absurdo alto → 2400 · absurdo bajo → 0,1 · negativo y no numérico → 80 · sin bloque `tl` → 80 · sano
→ tal cual. La constante `TL_PPS_DEF` se declara junto a MIN/MAX; en el literal del objeto `state` se deja el 80
a mano **a propósito**, porque ahí la constante estaría en zona muerta temporal y la app no arrancaría.

### Los atajos, barridos

La auditoría pedía repasarlos «uno a uno». Se hizo por lo que la app **anuncia**, que es donde este proyecto ya
tuvo un fallo real ([R92-T5]: la paleta prometía `+`/`−` de zoom que no existían): de las 56 entradas de
`commandList()`, **33 declaran atajo y las 33 tienen función detrás**, y dispararlos todos seguidos no produce un
solo error. ⌘D duplica, `0` alterna desactivado y ⌘C llena el portapapeles. Sin promesas rotas.

Un detalle del arnés que conviene recordar: `⇧⌘E` abre la hoja de export, y el guard global de atajos (`#exOv`)
bloquea **todo** lo que venga detrás. La primera corrida dio tres falsos negativos por eso; hay que barrer las
modales entre bloques o el resto del barrido mide una app sorda.

### Dos apuntes de método

Las dos primeras sondas de esta ronda dieron **falsos positivos míos**, y conviene dejarlo escrito porque es un
error fácil de repetir: `trimItem` espera el **item del arrastre** (`start0/dur0/inP0`), no el clip, y su borde es
`'L'`/`'R'` en mayúscula — al pasarle el clip y una `'r'`, `it.dur0` salía `undefined` y el NaN resultante parecía
un bug del programa. Y la selección de clip que apaga el locator vive en el **gesto** del timeline: asignar
`state.selId` a mano no la ejercita, y el camino del teclado depende de `:focus-visible`, que un script no puede
forzar. Con un `pointerdown` real sobre el clip, verde.

## ROUND 239 — Cuatro ajustes de Beltrán

Cuatro cosas pequeñas de uso diario. Dos resultaron no ser lo que parecían.

### «Entro a un nido y sigo en el minuto 55» — no era el cabezal, era el encuadre

El cabezal SÍ iba a 0 al entrar (medido: `playhead` 0, correcto). Lo que no se movía era el **scroll horizontal de la
línea de tiempo**, que vive en el DOM (`#tlscroll.scrollLeft`) y no lo tocaba nadie al cambiar de secuencia: se
quedaba en 27 788 px, o sea el minuto 10 de la prueba, con el primer clip del nido —que siempre empieza en 0— fuera
de pantalla. De ahí el «tengo que volver atrás»: no era rebobinar, era desplazar la vista.

El encuadre pasa a ser de la secuencia, como ya lo era el cabezal: `nestScrollT`, guardado en **segundos** y no en
píxeles, porque `pxPerSec` es global a la app y un cambio de zoom habría movido el sitio guardado. Entrar a un nido
recién creado da 0 (es lo que pidió Beltrán) y volver al padre devuelve su minuto 55 (también). Si ya habías estado
dentro del nido, vuelve donde lo dejaste — la misma regla que el padre, que es lo que hace que el conjunto sea
predecible en vez de una excepción.

`setTlScrollT` tiene que correr **después** de `renderTimeline` y con el truco de `_scrollTarget` (ensanchar el
contenido antes de fijar `scrollLeft`, si no se clampa contra el ancho viejo), el mismo patrón de `followPlayhead`.
De paso se enganchó a `loadProject` y `newProject`: abrir un proyecto heredaba el encuadre del anterior por
exactamente la misma razón.

### Soltar un archivo sobre una carpeta: el código ya estaba, pero no lo llamaba nadie

Beltrán pedía poder soltar sobre cualquier clip de una carpeta en vez de acertarle a la cabecera. Buscando dónde
añadirlo apareció `folderAt`, dentro de `startMediaDrag`, con la lógica **exacta** («sobre un item → la carpeta de
ese item»)… y sin un solo llamador. El flujo real de soltar, tanto interno como de archivos del sistema, siempre
pasó por `_dropTargetAt`, que sólo miraba cabeceras y zonas vacías.

Así que en vez de escribir una tercera versión, la lógica sube a `_dropTargetAt`, que es la única puerta. Con eso
quedan arreglados a la vez el arrastre de archivos del SO (lo que se pedía) y el arrastre interno de medios (que
tenía el mismo agujero). Dos añadidos que hacían falta para que el gesto sea legible: el resalte apunta a la
**cabecera de la carpeta de destino**, no a la fila bajo el cursor —lo que hay que ver es dónde va a aterrizar—, y
`wireDrop` estrena resalte en `dragover`, porque los archivos de fuera se soltaban literalmente a ciegas. `folderAt`
se retira.

### Componer desde un solo medio

El menú de media exigía dos medios seleccionados. Era una condición del camino de multi-selección de [R88], no del
compositor: `checkedIds()` siempre aceptó un solo id. Y con uno es el caso más común —un clip repetido por el domo
en anillo o cuadrícula—, así que ahora la entrada sale también con uno. Lista y cuadrícula comparten este menú, de
modo que el cambio cubre las dos vistas de un golpe.

### La barra de scroll fea de las pestañas de secuencia

No era un descuido de CSS: el `::-webkit-scrollbar{height:0}` del well **estaba escrito desde R148**. Lo que pasa es
que Chromium moderno **desactiva los pseudo-elementos `::-webkit-scrollbar` en cuanto se usa la propiedad estándar
`scrollbar-width`**, y `.seqtabs` la heredaba en `thin`. Medido: la barra se comía **12 de los 22 px** de alto del
well. Con `scrollbar-width:none` la vista se corta donde manda `max-width` y el desplazamiento va con la **rueda**
sobre las pestañas. El listener se engancha una sola vez (`bar._seqWheel`) y sólo se traga el evento cuando hay algo
que desplazar, para no secuestrar la rueda de una barra que cabe entera.

Verificado por CDP en dev: `scratchpad/r239-diag.mjs` (el estado ANTES, que es lo que separó «cabezal» de
«encuadre») y `r239-verify.mjs`, `__errs` vacío.

### [R239b] Lo que encontró la revisión del diff — cinco defectos, todos reales

Verificados en `scratchpad/r239b-review.mjs`, `__errs` vacío, y la tanda de R239 vuelta a pasar sin regresión.

- **El encuadre por secuencia se quedó a medias.** Se enganchó a `switchSeq`, `closeSeqTab`, `loadProject` y
  `newProject`, pero NO a los cuatro caminos que también aterrizan en otra secuencia: `newSequenceDialog` (y su
  variante de sala), `deleteSequenceMedia` y `newRoomProject`. Crear una secuencia estando en el minuto 55 la abría
  **vacía y encuadrada en el minuto 55** — exactamente el defecto que la ronda venía a arreglar. Una secuencia nueva
  va al origen; al borrar la activa manda el encuadre de la que queda.
- **Una carpeta arrastrada sobre una fila de medio se movía a la raíz en silencio.** `_dropTargetAt` lo comparten el
  arrastre de medios y el de CARPETAS; al hacer que las filas fueran destino, un resbalón sobre un medio **sin
  archivar** devolvía `path:null` y `moveFolder` la sacaba al nivel superior, con una fila resaltada como único
  aviso. Antes esas filas no eran destino de nada, así que el gesto era inocuo. `_dropTargetAt(ev,sinMedios)`: el
  arrastre de carpetas pasa `true` y recupera su comportamiento exacto; el de medios, que es donde se pidió el
  cambio, las sigue aceptando.
- **El realce se quedaba pegado.** `startMediaDrag` limpiaba con `clearFH`, una copia recortada de `_clearDropFX`
  que sólo conocía cabeceras y zonas vacías: al entrar el cursor en una pista, la fila de medio recién resaltada
  seguía encendida el resto del arrastre, junto al fantasma del clip. `clearFH` pasa a ser `_clearDropFX`.
- **La pestaña activa podía quedar fuera de la vista.** `renderSeqBar` empieza por `innerHTML=''`, que devuelve
  `scrollLeft` a 0 en cada repintado; con la barra de scroll ya oculta, la rueda era la única salida y no había
  ninguna pista de que hubiera más pestañas. Ahora el repintado conserva el desplazamiento, arrastra la activa a la
  vista (`seqTabsReveal`) y `.ovf-l`/`.ovf-r` desvanecen el borde **sólo por el lado en el que queda algo por ver**
  — que es lo que sustituye a la barra como aviso.

## ROUND 238 — La deuda que dejó la revisión de la sala 360

Tres puntos anotados como «bajo impacto» en R234b/c. Dos eran arreglables sin ambigüedad; el tercero era una
decisión de producto y la tomó Beltrán.

### El solver perdía LAS DOS raíces cuando el mínimo de la curva roza el cero

El barrido de `roomPlan` buscaba raíces por **cambio de signo**. Eso deja fuera dos situaciones: cuando la curva
besa el cero sin llegar a cruzarlo (raíz doble) y cuando las dos raíces caen dentro del mismo paso. En los dos
casos el barrido devolvía cero raíces y la app decía «estas medidas no cierran una sala». Fallaba del lado
seguro, sí, pero era un **falso negativo**: medidas que sí cierran se rechazaban.

Ahora, además de los cambios de signo, se refina cada **extremo local** por búsqueda ternaria; si su valor alcanza
el otro lado del cero se bisecan sus dos ramas, y si lo roza dentro de la tolerancia se toma como raíz doble.

El caso de prueba no hay que buscarlo por tanteo: en `s = sin θ` la curva es una **parábola**
(`g² = (b²−c²)s² + 2ab s + (a²+c²)`, con a=Front, b=Left+Right, c=Right−Left), así que el mínimo se calcula exacto.
Con Front 500 · Right 400 · Left 600, cae en un fondo de **172,00 cm**. Medido ahí: el barrido viejo encontraba
**0 raíces** y el nuevo cierra con **error 0**. Por debajo del mínimo sigue avisando, que es lo correcto.

No hay regresión: barrido de **28 561 combinaciones** con 0 plantas cruzadas coladas en silencio, 0 sanas
rechazadas y peor error de cierre **0 cm**. El caso real de Beltrán (648/745/641/648) sigue resolviéndose en
θ = 0,59°, la lectura casi rectangular de R232.

### El rótulo de aviso decía lo mismo para dos problemas distintos

«These sizes don't close a room» se usaba tanto cuando no hay ninguna solución como cuando la hay pero cruzada.
Son cosas distintas: en el primer caso sobran o faltan centímetros, en el segundo el error está en **qué pared se
midió como cuál**. `plan.motivo` los separa y cada uno tiene su texto. El segundo sigue siendo inalcanzable en la
práctica —el mismo barrido lo confirma, 0 de 28 561—, así que es corrección, no algo que se vaya a ver.

### Cambiar el ancho de un muro: la escala se queda como está (decisión de Beltrán)

`reubicarClipsPorMuro` mueve la posición y la curva de posición, pero no toca la escala, así que al estrechar un
muro un clip encuadrado a su medida puede desbordarlo. Se le plantearon a Beltrán las tres salidas y **eligió
dejarlo como está**: se corrige a mano. Las alternativas tenían su propio coste — escalar con el muro arrastra el
alto (`scale` es uniforme, así que estrechar un muro encogería también verticalmente y un clip que llenaba la
altura dejaría de llenarla) y recortar sólo al desbordar pierde el encuadre igual, pero de forma impredecible.
Anotado **en el código**, no sólo aquí, para que no se "arregle" en una limpieza futura.

Verificado por CDP en dev: `scratchpad/r238-solver.mjs` y `r238-antes.mjs` (que reimplementa el barrido viejo para
demostrar que el caso tangente daba 0 raíces), `__errs` vacío.

## ROUND 237 — El composite máster deja de ser cuadrado

R236 hizo que «Full» enseñara la calidad original dimensionando el composite con el lienzo, pero lo dejó CUADRADO
de lado `max(w,h)`. Eso tenía dos costes. El obvio: una tira de 7196×912 reservaba 198 MB para usar 26. El que de
verdad importaba: con el tope de **8192 por lado**, una sala de cuatro muros 4K —15360×2160— **no podía llegar a
1:1**; se quedaba a 1,875× de submuestreo. Es decir, el caso grande, el de una instalación de verdad, seguía sin
resolverse.

Hacían falta **las dos cosas a la vez**, y ese es el hallazgo de la ronda: no basta con quitar el cuadrado. El
tope tenía que dejar de medirse en LADO para medirse en **memoria** (`COMP_MAXTEXELS = 8192²`, los mismos 268 MB
que R236 ya aceptaba). Con las dos, esa sala entra entera —33,2 M de texels, 127 MB— y llega a 1:1. Con sólo la
primera se habría quedado exactamente igual de submuestreada, con mejor pinta en el código y ninguna mejora para
Beltrán.

### El truco: no se toca la matemática de colocación, se expande el viewport

Los clips se siguen dibujando en el NDC de siempre, dentro de la banda `±Fx/±Fy`. Lo único que cambia es el
viewport del composite, que se ensancha (`vw = compW/Fx`, `vx = -(vw-compW)/2`, ídem en Y) para que esa banda
cubra la textura entera. Así ni `flatPlace`, ni el warp del domo, ni el wrap de costura, ni el recorte por
superficie se enteran de nada. `gl.clear` ignora el viewport, así que el borrado tampoco cambia.

El mapeo píxel-de-lienzo → uv (`mstrU`/`mstrV`) se calcula con los **mismos enteros del viewport**, no con el
atajo `px/W`. Parece rebuscado y no lo es: el viewport es entero y `compH/Fy` no cae redondo, así que dar por
hecho el relleno exacto dejaba hasta medio texel suelto en el borde — justo la fisura que costó R233 y R233b.
Derivándolo del viewport real el mapeo es exacto por construcción. Medido: desviación **0 texels** en sala, domo
y 2D; el peor caso (¼ de calidad, 1799×228) se queda en medio texel.

### Dos convenciones conviviendo, a propósito

**Decisión registrada:** [ADR-0010](docs/adr/adr-0010-composite-relleno-vs-letterbox.md) — la deuda real de la
ronda es tener que llevar las dos convenciones en la cabeza, y eso hay que poder consultarlo dentro de un año.

El máster pasa a **relleno** (`u,v = 0..1` sobre el lienzo). El **export, NDI, Spout y el caché de nests siguen en
cuadrado con letterbox**: el `_ncSquare` de R180 depende de esa forma, y un nest 16:9 perdería su encuadre sin
ella. Por eso hay dos parejas de límites de muestreo —`mstrContentLim`/`mstrLimForRect` para el máster,
`compContentLim`/`compLimForRect` para el export— y **no se pueden mezclar**. Con un lienzo cuadrado (el domo) las
dos coinciden, así que el domo queda intacto por construcción, no por cuidado.

Tres sitios daban por hecho el cuadrado anclado en el origen y hubo que generalizarlos: los rects de tijera
(`surfaceScissorRect` y `roomWallScissorRects`, ahora vía `_ndcToVp()`, que lee el ORIGEN del viewport), las UV de
la sala 3D (`buildRoomGeo`, que las calculaba a mano descontando el letterbox) y el caché de scrub-ahead, cuya
reducción ahora sigue la proporción del máster en vez de un cuadrado de 1024.

### Dos cosas que sólo aparecieron al construirlo

**La miniatura del launcher.** Renderiza una secuencia temporal —una tira 7:1— sin pasar por `resize()`, así que
la textura conservaba la forma del proyecto de fondo. Con un domo de 4096² detrás, el viewport de relleno habría
pedido **28 672 px de alto**, por encima del máximo de muchas GPU. Se resuelve sincronizando el tamaño del máster
en cada `render()` (es un no-op si ya coincide), con un tope de 1024 de lado para las miniaturas.

**La capa de ajuste.** `drawAdjustment` fotografía el composite y le pasa la cadena de FX. Su cuadrado se
dimensionaba por el lado mayor del destino: en la sala 4K habrían sido 943 MB de instantánea más dos RT iguales,
2,8 GB. Se topa en `ADJ_MAX=8192`, que es el techo que ya tenía de hecho antes de esta ronda. La cadena se queda
CUADRADA y con su letterbox —así un desenfoque sigue siendo isótropo sobre el lienzo, en vez de ocho veces más
ancho que alto— y `PMIX` estrena `u_uvsc`/`u_uvof` para muestrear esa banda al devolver el resultado.

### Verificado por CDP en dev

`scratchpad/r237-fill.mjs`, `r237-verify2.mjs`, `r237-verify3.mjs` y `r237-verify4.mjs`; `__errs` vacío en las
cuatro. Sala 7196×912 → 1,00 en los dos ejes con 25 MB · sala de 4 muros 4K → 1,00 con 127 MB · domo 4096² y 2D
1920×1080 a 1:1 con viewport identidad · relleno exacto · **export por-muro: los cuatro muros por separado
reconstruyen la tira entera con difMax 0** (con tres transiciones duras en la tira, o sea con señal que comparar,
y las cinco pasadas a la misma resolución de composite: si no, se estaría midiendo el remuestreo y no las
costuras) · caché de nest con su letterbox · sala 3D con el borde alto en `v=1,000000` sin recortar · capa de
ajuste con la misma cobertura al píxel y el color cambiado · visor partido muros|piso sin invasión · caché de
scrub-ahead a 1024×400, la proporción del máster.

**Lo que NO cambia:** el export sigue con su FBO propio a resolución de salida, y sus límites de muestreo dan los
mismos números que midió R234b. La calidad de previsualización sigue encogiendo sólo esta textura.

## ROUND 234b/c — Revisión desde el Mac de R232→R234

Cinco commits escritos en Windows (el solver de la planta, el reorden de muros, la línea negra del blit, el color
del 3D y el anclaje del arrastre). Sus cuatro sondas pasan enteras en el Mac y mis tres de R230/R231c no muestran
regresión. Dos revisores sobre el diff dieron **seis defectos reales**; todos corregidos y verificados
(`scratchpad/r234b-review.mjs` y `r234c-reorden.mjs`), `__errs` vacío.

### El límite del muestreo es la SUPERFICIE, no la banda del lienzo

R233 acotó el muestreo del blit para matar la línea negra del borde; R233b cambió el límite del RECORTE a la BANDA
DEL LIENZO, con razón: los muros entre sí **son una superficie contigua** —un clip la cruza por la costura— y
acotar al recorte hacía que un export por-muro repitiera su columna del borde, con Front y Right sin casar en la
esquina.

Pero el piso no es eso. Su rect `[fx0,fx1]×[stripH,H]` es una **isla**: a izquierda y derecha tiene vacío, porque
los clips de piso van con scissor a su rect y los de muro nunca bajan de `stripH`. Acotando a la banda del lienzo,
los costados del piso volvían a ser exactamente el caso que R233 arregló. Y al revés: el pie del panel de muros se
mezclaba con el contenido del PISO que hay debajo en el composite — contenido válido, pero de **otra superficie**.

La regla queda: **se acota a la superficie, nunca al recorte**. `compLimForRect()` la implementa; el panel de
muros y el de piso la usan, el export por-muro sigue con la banda y el de piso con su propio rect. Medido: el piso
acota su costado derecho (0,25 frente a 1) y su techo; los muros no acotan los costados pero sí el pie.

De paso, la exención de `_ncSquare` —el horneado del caché de un nest, que debe conservar su letterbox— se hace
ahora explícita en la rama que le toca. No cambia nada hoy porque sólo se admiten nests cuadrados, pero descansaba
en esa puerta y no en el bloque que el comentario señalaba.

### El desfase del agarre se medía en un espacio y se escribía en otro

R234 ancló el arrastre en el punto de agarre, pero calculaba el desfase con `flatPlace`, que resuelve por `evalR`
= base + preset de movimiento + pila de modulación, mientras `manualEdit` escribe la **base**. Con un preset
activo, `off` traía la animación dentro y el primer movimiento la escribía en la base: el clip saltaba al doble
del desplazamiento procedimental. La rama del domo ya lo hacía bien con `evalP`; ahora las dos coinciden.

**El mismo error estaba en la escala**, y es anterior a R234: `beginFlatResize` captura toda su geometría de
`flatPlace` y escribe el centro con `manualEdit`. Se guarda el desplazamiento procedimental al empezar y se resta
al escribir, así el tirador sigue donde se ve y la base no se come la animación. Medido con un desplazamiento
inyectado de 30: arrastrar el cuerpo deja la base en 0, y escalar la deja en 0,2.

*(Nota de método: la primera prueba dio un falso positivo porque agarraba en el borde del clip y caía en un
tirador, no en el cuerpo — el modo real era `resizeFlat`. Ese falso positivo es lo que destapó el fallo de la
escala.)*

### El azimut del domo se guardaba fuera de rango

`f2azel` normaliza a [0,360), pero sumarle un desfase que cruza el corte de rama dejaba guardado un valor como
−349,9. En pantalla no se notaba —`dirAzEl` es periódica— pero el fader de Azimuth acota a [0,360] y al primer
roce el clip teleportaba; y un `az` automatizado interpolaba ~700° hacia atrás entre keyframes.

### Reordenar muros se llevaba clips que no eran de ese muro

`reubicarClipsPorMuro` (R232c) decidía la pertenencia **sólo por el centro** del clip, sin mirar cuánto mide. Una
imagen estirada sobre los cuatro muros tiene su centro en una costura: al reordenar se la llevaba entera a un solo
muro y dejaba el resto en negro. Contradecía lo que el propio R233b dejó escrito — que los muros son una
superficie contigua y cruzarla es legítimo.

Ahora **sigue a su muro el clip que CABE en él**; el que lo desborda pertenece a la tira y se queda quieto. La
holgura (1 % del ancho del muro, mínimo 2 px) absorbe el redondeo de `props.x` y el de los `x0/x1` enteros, para
que una imagen encuadrada al ras de su muro siga contando como suya. Verificado: el clip que cabe pasa de −75 a
+75 siguiendo a Front del puesto 1 al 4, y el estirado sobre toda la tira no se mueve.

### Deshacer devolvía los clips pero no la sala

Desde R232c los clips se recolocan con la geometría, así que un Ctrl+Z que restituía **sólo** los clips los dejaba
sobre los muros nuevos, en el hueco equivocado — con «Mask to wall» activo, en blanco. Es decir, el propio undo
reproducía el descuadre que R232c vino a arreglar.

`snapshot()` acepta ahora una foto opcional de la geometría, que sólo rellena `applyRoomGeometry`; en cualquier
otra acción el campo no existe y el snapshot es byte por byte el de siempre. `restore()` la aplica **antes** que
los clips, porque los clips vienen medidos contra ella. Verificado: tras deshacer, el orden vuelve a
Front·Right·Back·Left, el lienzo a 7680×3000 y el clip a −75.

### Lo que los revisores intentaron tumbar y no pudieron

Ningún camino hereda un `u_uvlim` de la llamada anterior (las cinco ramas que usan `PB` y la única que usa `PR` lo
fijan). El shader lee `textureSize`, así que cambiar la calidad de previsualización se resuelve solo. El desempate
del solver por |θ| menor es determinista: no pueden existir dos raíces distintas con el mismo |θ|, y `g` es
unimodal. Un barrido de 28 561 combinaciones extremas no encontró ni una planta cruzada sin avisar. `segCruza`
sólo se llama sobre los pares no contiguos, que es lo correcto. Y el orden de los muros no puede quedar con
huecos, repetidos ni fuera de rango por ninguna de las cuatro vías.

Quedan anotados en `docs/NEXT.md`, sin corregir por ser de bajo impacto: el barrido del solver puede perder las dos
raíces cuando el mínimo de la curva roza el cero (exige medidas degeneradas, y falla del lado seguro); el rótulo
«no cierran una sala» se reutiliza para el caso «cierra pero cruzada», que el barrido dice que no se alcanza; y el
tamaño del clip no acompaña al muro al cambiar su ancho, sólo la posición.


## ROUND 236 — «Full» ya enseña la calidad original

El composite máster estaba clavado en **2048²** pasara lo que pasara con el lienzo. Como el contenido va encajado
por la matemática de NDC, una tira de 7196×912 caía en una banda de **2048×260 texels**: 3,51× de submuestreo en
LOS DOS ejes, con el 87 % de la textura desperdiciado. A 791 % de zoom eso es lo que Beltrán vio, y con razón:
«Full» no estaba enseñando la calidad original.

Ahora el composite se dimensiona **según el lienzo**. El lado del cuadrado que da 1:1 es `max(w,h)`: con A>1 el
ancho mapea entero y el alto cae justo en `lado/A = h`. Medido, sala de 7196×912 en Full → banda de **7196×912
texels, submuestreo 1,00 en los dos ejes**. El domo mejora de regalo (4096² pasa de 2× de submuestreo a 1:1) y un
2D de 1080p gasta **menos** memoria que antes (14 MB frente a 17).

**Sigue siendo CUADRADO a propósito.** Un composite no cuadrado ahorraría memoria (26 MB en vez de 198 para esa
sala), pero el caché de scrub-ahead (`blitFramebuffer` a `RA_SIZE²`), NDI, Spout y el export dan por hecha esa
forma; cambiarla es una ronda aparte y el beneficio es sólo de VRAM, no de calidad.

El tope, `COMP_MAX=8192`, es de MEMORIA y no de calidad: 268 MB en RGBA. Por encima —una sala de cuatro muros 4K
son 15360 de ancho— se queda submuestreado, que es preferible a reservar 1 GB de VRAM.

> **Superado por R237.** Las dos afirmaciones de arriba dejaron de valer: el máster ya no es cuadrado y el tope ya
> no es por lado sino por memoria. La segunda frase resultó ser el problema de fondo, no un detalle — era lo que
> dejaba la sala de cuatro muros 4K a 1,875× de submuestreo. Ver ROUND 237.

**Coste honesto:** a Full ahora se sombrea el lienzo COMPLETO en vez de 1/12 de él. Para eso están ½ y ¼, que
siguen dividiendo el lado (y por tanto el coste por cuatro). El export no se toca: siempre usó su propio FBO a
resolución de salida.

## ROUND 235 — El paneo vertical iba cuatro veces más lento

Beltrán, con zoom dentro del lienzo de una sala: «en horizontal funciona bien, pero vertical no me deja avanzar
naturalmente». El paneo dividía el arrastre por `min(cw,ch)` en LOS DOS ejes, pero el mapeo marco→pantalla es
**anisótropo**: `flatMap` saca un `sx` y un `sy` distintos, y en una tira de 7196×912 metida en un panel apaisado
`sy` vale ~0,23. Arrastrando 100 px en vertical el contenido se movía ~23. Ahora cada eje usa SU escala
(`panScale(P)`, guardada al agarrar), así que el punto agarrado se queda bajo el cursor en las dos direcciones.
Medido: ratio 1,000 en X y en Y. El domo es isótropo y conserva `min(cw,ch)/2`.

### Medido de paso: por qué «Full» no enseña la calidad original

Beltrán también reportó que un clip sin proxy, en Full, se ve muy pixelado. Tiene razón y ahora hay números. El
composite máster es una textura **CUADRADA** de 2048² y una tira de 7196×912 va encajada en una banda de
**2048×260 texels**. Eso es **3,51× de submuestreo en LOS DOS ejes** —no sólo en vertical— y **el 87,3 % de la
textura desperdiciado** en letterbox. A 791 % de zoom se ve exactamente como lo que es: una imagen de 2048×260
estirada a 7196×912.

El export NO pasa por aquí (usa su propio FBO a resolución de salida), así que esto es sólo el visor. La deuda ya
estaba anotada desde R233; ahora está cuantificada. El arreglo correcto es un composite **no cuadrado** del
tamaño del lienzo: 7196×912 = 6,5 M texels (26 MB) frente a los 0,53 M útiles de hoy — **13× más resolución
usando 8× menos memoria**. Toca el núcleo del render (NDC del dibujado de clips, UV del blit, export y caché de
nests), así que va en su propia ronda con verificación aparte, no al final de una sesión larga.

## ROUND 234 — El clip saltaba al agarrarlo

Beltrán: «cuando arrastro un clip en el lienzo, se mueve solo para centrarse en el cursor; el anclaje debe ser
desde donde lo agarré». Cierto y de una línea: `elemFlat` escribía el punto del puntero **como centro** del clip,
sin guardar el desfase del agarre. Agarrar una esquina y ver el clip pegar un salto para centrarse.

Ahora en el `pointerdown` se guarda `vdrag.off` = dónde está el centro respecto del punto pinchado, y el
`pointermove` lo suma. El domo tenía exactamente el mismo fallo (`elem` escribía `az`/`el` del cursor); se arregla
igual, con el desfase en grados y la elevación acotada a ±90. Verificado por CDP en sala y en domo: agarrando a
21 y 19 px del centro, el `pointerdown` ya no mueve el clip ni una décima.

## ROUND 233b — Lo que encontró la revisión de R233

Dos hallazgos reales, más la duda de Beltrán sobre el color del 3D — que resultó ser el mismo shader.

- **El acotado se hacía contra el RECORTE, no contra el contenido.** Con un límite INTERIOR al lienzo —el panel de
  muros de un visor partido, que corta en `stripH` con el piso debajo, o un export **por-muro**, que corta en la
  costura entre muros— se comía hasta un texel de contenido real y repetía el borde: Front y Right dejaban de
  casar en la esquina. Ahora el límite es la **banda del lienzo** (`u_uvlim`, uniforme nuevo con `0,0,0,0` =
  sin límite para que ningún camino quede a oscuras), así que el borde exterior sigue protegido del vacío y las
  costuras interiores vuelven a muestrear el contenido de al lado. **Excepción cuidada:** el horneado del caché de
  un nest (`_ncSquare`) mantiene el límite en la textura entera — su salida tiene que conservar el letterbox, y
  acotar a la banda lo habría rellenado con contenido repetido.
- **La franja seguía viva en el 3D.** `FSR` muestrea la misma banda sin acotar, y el borde alto de cada muro cae
  justo en el límite: el alfa se desvanecía y `mix(u_base,…)` con base negra fundía el muro a negro. Mismo clamp.

**Y el color del 3D:** los muros se pintaban con `col*v_sh`, un foco direccional falso que los oscurecía **hasta un
38 %** según su orientación. Este visor es una previsualización de lo que se va a proyectar, así que las caras que
enseñan CONTENIDO pasan a ir sin sombrear — el piso ya lo hacía desde R221 («same clarity as the walls»). El
sombreado se conserva en la pasada de FUERA, la carcasa translúcida, que es donde ayuda a leer el volumen.
Medido: el píxel más brillante del 3D sube de (18,29,49) a (22,35,58).

## ROUND 233 — La línea negra del borde del lienzo

Beltrán: «en sala 360 el lienzo genera una línea negra en los bordes; por mucho que agrande el vídeo, ahí sigue».
Efectivamente no era del vídeo: **era del blit del composite**.

Se midió, no se supuso. Primero se descartó lo evidente: no es una guía del canvas 2D (separando las capas `glc`
y `gridc`, el negro está en la GL), no es la zona muerta de `drawRoomGrid2D` (`hayZonaMuerta:false`) ni el
divisor. Con las superposiciones apagadas, el alfa del contenido sube **en rampa** desde el borde: 0 → 41 → 102 →
162 → 223 → 235 a lo largo de ~15 px de lienzo.

Esa rampa mide **exactamente un texel del composite**. El composite máster es una textura **CUADRADA**
(`COMP×COMP`) y un lienzo apaisado va *encajado* en una banda: una tira de 7196×912 (aspecto 7,89) ocupa sólo
~65 texels de alto en un composite de 512², o sea **1 texel = 14 píxeles de lienzo**. El blit muestreaba justo en
el límite de la banda, así que `LINEAR` mezclaba el último texel de contenido con el vacío transparente de
alrededor. A 1000% de zoom eso son ~140 px de banda negra pegada al borde — y no se iba agrandando el clip,
porque no era del clip.

El arreglo acota el muestreo en el fragment shader del blit a la región de contenido. **Medio texel no bastaba**:
la banda no cae en múltiplos de texel (64,9), así que el texel del borde está PARCIALMENTE cubierto y ya viene
mezclado con el vacío desde el propio composite — con el clamp a medio texel la rampa sólo se aplanaba a la mitad
(0→235 pasaba a un escalón en 130 y luego 130→235). Se acota al centro del primer y del último texel
**enteramente** cubiertos: `a=(ceil(t0)+0.5)/N, b=(floor(t1)-0.5)/N`. Cuando el límite sí cae justo —el domo, un
lienzo cuadrado, los laterales u=0 y u=1— eso da exactamente `0.5/N` y `N−0.5/N`, o sea el borde de siempre: no
recorta nada.

Verificado por CDP: el contenido llega **lleno (alfa 235) desde el primer píxel** dentro del lienzo, sin rampa.
Domo, 2D plano, sala 2D y sala 3D siguen pintando igual y `__errs` vacío.

## ROUND 232c — El contenido sigue a su muro

La decisión que quedaba abierta de R232b, resuelta con Beltrán: al reordenar los muros, **el contenido va con
ellos**. Antes se recolocaban los `x0/x1` y los píxeles se quedaban donde estaban, así que mover Front al puesto 4
dejaba su clip en el puesto 1 mientras su «Mask to wall: Front» se recortaba al 4 (`roomWallScissorRects` lee el
rect nuevo): el clip salía **en blanco** y su contenido aparecía sobre el muro de otro.

`reubicarClipsPorMuro` guarda la posición **relativa dentro del muro** que contiene a cada clip y la restituye
sobre el rect nuevo de ESE mismo muro, así que «centrado en Front» sigue centrado en Front aunque Front cambie de
sitio **o de ancho**. Viaja también la curva de posición (`c.kf.x`, punto por punto), porque si no el clip se
colocaba bien y la animación lo devolvía al hueco viejo. Sólo toca pistas de muro —el piso tiene su propio rect— y
un clip fuera de todo muro (desbordado) o cuyo muro ha desaparecido se queda donde está, que es la regla de «nunca
se pierde material» que ya seguía el resto de la función. Se avisa en la barra de estado de cuántos clips se han
movido solos.

Verificado por CDP: un clip centrado en Front pasa del píxel 960 al 6720 al mandar Front del puesto 1 al 4,
**sigue centrado** (u=0.5), conserva su máscara y su curva llega con él; el clip de Back, cuyo muro no cambia de
puesto, no se mueve. `__errs` vacío.

## ROUND 232b — Lo que encontraron las dos revisiones del diff de R232

Seis hallazgos, todos reales, todos corregidos y verificados por CDP (`scratchpad/r232b-review.mjs`), `__errs`
vacío. Las dos revisiones dieron por bueno el arreglo del solver de forma independiente: una lo comprobó
analíticamente (la rama descendente siempre tiene las esquinas traseras cruzadas), la otra con un barrido de 6561
combinaciones de 4 muros y 2187 de 3 — 0 plantas cruzadas sin marcar y 0 `imposible` falsos nuevos.

- **`lchNormOrder` descolocaba la tira al cambiar la cuenta de muros.** Los que salían de juego perdían su hueco y
  al volver entraban por el final: 4→3 dejaba `Front|Right|Left` (pegando dos muros que no se tocan) y 4→2→4 daba
  `Front|Left|Right|Back` en vez del recorrido físico. Ahora cambiar la cuenta **rehace la sala** y el orden del
  lienzo vuelve al recorrido natural, que es lo predecible; `lchNormOrder` se queda sólo para lo suyo, renormalizar
  un preajuste viejo sin `ord`.
- **Pulsar la cuenta de muros YA ACTIVA parecía un no-op y reescribía todos los órdenes** — en el launcher y en el
  diálogo. Los dos salen antes de tocar nada si la cuenta no cambia.
- **La fila del piso quedaba 18 px a la izquierda.** La primera columna de los muros pasó de 16 a 34 px y la
  cabecera la siguió, pero la fila del piso sigue usando `.ix`, que se quedó en 16.
- **En el diálogo, el campo de orden perdía el foco a cada paso:** `drawWalls()` rehace todas las filas, así que
  con las flechas no se podía dar más de un paso. Se devuelve el foco a la misma fila (que es la del muro, porque
  van por orientación).
- **Las flechas movían de 10 en 10** en un rango de 1..N, así que subir desde 1 se iba al tope e intercambiaba con
  el último muro. Paso 1 para este campo.
- **Confirmar el MISMO orden no repintaba**, y lo tecleado en crudo («01») se quedaba en el campo mientras el
  estado decía otra cosa.

**Queda anotado, no corregido** (ver `docs/NEXT.md`): reordenar muros en «Geometría de la sala…» re-coloca los
`x0/x1` pero **no mueve el contenido ya colocado**, así que un clip con «Mask to wall: Front» se recorta al hueco
NUEVO de Front mientras sus píxeles siguen en el viejo, y sale en blanco. No es de esta tanda —el selector de
orientación de antes intercambiaba los muros de hueco igual— y arreglarlo es una decisión de diseño que hay que
tomar con Beltrán: si el contenido debe **seguir a su muro** o **quedarse donde está en el lienzo**.

## ROUND 232 — La sala en lazo, y por qué no era lo que parecía

Beltrán trajo una captura del launcher con la planta hecha un lazo y una petición concreta: quitar el selector de
orientación de la tabla, dejar Front·Right·Back·Left fijo, hacer editable el **orden en el lienzo** y prohibir que
se formen figuras cruzadas.

**Lo primero que hice fue reproducirlo, y desmintió el diagnóstico.** `roomPlan` deriva la huella SÓLO de los roles
(`by[role]` + recorrido de `ROOM_ROLES`), así que el orden de la tabla nunca ha entrado en la geometría: tres
disposiciones distintas de los mismos cuatro roles —la canónica, la de la captura y una deliberadamente cruzada—
dan **exactamente la misma planta y el mismo cruce**. Reasignar la orientación no deformaba la sala; sólo permitía
que la tabla dijera una cosa y la sala fuera otra.

**El cruce estaba en el solver.** La ecuación que cierra la sala, `|BR−BL| = anchoFondo`, tiene **hasta dos
raíces**, y la de |θ| grande pliega el cuadrilátero sobre sí mismo. El barrido cortaba en la PRIMERA que
encontraba, y empieza en −90°, o sea por el lado plegado. Con las medidas de la captura —648/745/641/648 cm, una
sala de lo más corriente— hay raíz en **−67,6° (cruzada)** y en **−0,6° (la sala casi rectangular que se había
medido)**: se dibujaba la primera. Ahora se recogen todas las raíces, se descartan las que se cruzan
(`planCruzada`, que prueba los dos pares de lados no contiguos) y se elige la de |θ| más pequeña — la lectura más
rectangular de las cuatro medidas, que es lo que quiere decir quien las teclea. Si todas se cruzan, se coge la
menos plegada y se marca `imposible`, que ya se avisa en la planta. Barrido de verificación: **784 combinaciones,
0 plantas cruzadas sin avisar**.

**Y el cambio de tabla, que sigue siendo bueno por otro motivo.** Un control que no hace nada sobre la forma pero
puede descuadrar la etiqueta es peor que no tenerlo. La orientación pasa a rótulo fijo y la primera columna pasa a
ser el **orden en el lienzo cosido** (1..N de izquierda a derecha), que sí es una decisión de montaje: qué trozo de
la tira va a cada proyector. Repetir un número **intercambia** los dos muros, así que siempre es una permutación:
ni huecos ni repetidos. Las filas se pintan en el orden fijo de orientaciones y la tira se cose por `ord`, que son
ya dos cosas distintas — verificado que la planta no se mueve al reordenar el lienzo. El mismo cambio va en el
diálogo «Geometría de la sala…», para que las dos puertas digan lo mismo.

Retirados con esto: `lchSetFacing`/`lchFacingMenu` (R197) y el reparto de roles sobrantes de R200/R200b, que
existía justo porque el preajuste imponía orientaciones. El preajuste ahora guarda el orden y se aplica **por
orientación**, no por índice de la lista.

## ROUND 231c — Revisión del diff de R231/R231b desde el Mac

R231 y R231b se escribieron y verificaron en la máquina Windows. Al traerlos al Mac pasé sus dos sondas —que
pasan enteras aquí también— más las tres de R230, sin una sola regresión, y encima puse un revisor sobre el diff.
Siete hallazgos, todos corregidos y verificados (`scratchpad/r231c-review.mjs`), `__errs` vacío.

### El botón «Floor» de la ventana solo-visor hacía lo contrario de lo que decía

`vpSplitOn()` había pasado a ser `… && (!_vPaint || _vFloor) && …`. Con `_vPaint` en true la condición se reduce a
`_vFloor`, así que apagar el botón apagaba **la partición entera**, y `vpPanels()` devolvía el panel único del
lienzo COMPLETO: muros arriba **y el piso abajo**, en letterbox. Pulsar «quitar el piso» enseñaba más piso, con
los muros reducidos a una fracción de la altura, y el estado «muros solos» era inalcanzable en la emergente.

La partición y la visibilidad del piso son dos decisiones distintas: `vpFloorOn()` ya distinguía la emergente, así
que `_vFloor` no pinta nada en `vpSplitOn()`. Medido: con el piso apagado, la emergente da ahora
`{n:1, surf:'wall', ry1:1080}` —muros solos a ancho completo— en vez del `ry1:3000` del lienzo entero.

### Lo demás

- **El encuadre propio de la emergente (`_vVp`) no se reiniciaba nunca.** No lo tocaban ni `openViewerWindow` ni el
  cambio de proyecto, y en 2D esa ventana no tiene gesto de paneo: el único modo de escribir en el pan es el zoom
  anclado de la rueda. Un giro con el cursor en una esquina descentraba la salida **para toda la sesión**, y ni
  cerrar y reabrir la ventana lo deshacía. Ahora arranca limpia.
- **El fantasma del punto de máscara se congelaba al hacer zoom** sin mover el ratón: guarda píxeles de pantalla y
  el `wheel` no lo apagaba. El realce se quedaba clavado sobre el encuadre viejo y el clic ya no caía en la arista
  que señalaba.
- **El divisor se pintaba en la salida de la emergente** — es cromo del editor, ahí no es arrastrable, y su tirador
  se iluminaba con el `vdrag` **del editor**: arrastrarlo aquí hacía parpadear una barra en el proyector.
- **El botón «Floor» de la barra de la emergente salía inerte en salas legacy** (sin `lane.surf`): faltaba
  `roomSurfLanes()` en su condición, que es la que exige la partición.
- **El forzado automático del piso acababa persistiéndose.** `roomVpAutoFloor` no guarda, cierto, pero
  `saveRoomVpPrefs()` también se llama al soltar el divisor — y el divisor sólo existe con el piso visible. Un
  «piso oculto» elegido a propósito desaparecía en cuanto se ajustaba el divisor una vez. Ahora sólo el botón
  decide lo que se guarda (`_vpFloorUserSet`); el resto respeta lo que ya hubiera.
- **`roomVpAutoFloor` cubría dos de las cuatro vías de creación.** Faltaban «New sequence… → 360 Room» y el diálogo
  de geometría: añadir un piso por ahí, con una preferencia de «oculto» heredada, reproducía exactamente el
  síntoma que R231 se propuso arreglar — el piso «parece perdido».

### Lo que el revisor intentó tumbar y no pudo

`openLaneColorPopup` y `TRACK_COLORS` no quedan referenciados en código vivo. El `lane.color` de un `.isp` viejo se
conserva en el archivo sin usarse: no se pisa ni rompe la carga. `snapThr(P,axis)` es la inversa exacta de
`flatMap().px`, sus dos llamantes están tras un `if(!CP)return` y dentro de `if(isRoom())`, así que domo y 2D plano
no cambian. El `splice(seg.si+1,…)` de la máscara es correcto para el anillo cerrado. Y `vWithViewport`/`viewerPaint`
restauran todo en bloques `finally`.


## ROUND 231b — Lo que encontró la revisión del diff de R231

Cinco hallazgos, todos reales, todos corregidos y verificados por CDP (`scratchpad/r231b-review.mjs`, más el
sondeo de R231 vuelto a pasar entero sin cambios). `__errs` vacío.

- **Regresión mía: el botón DERECHO movía el clip en modo máscara.** Al soltar el paneo escribí `e.button!==0 ||
  e.shiftKey → return false`, que cede al gesto normal **todos** los botones que no sean el izquierdo. Un arrastre
  con el derecho caía en `flatRectHit`/`flatHandleHit` y movía o escalaba el clip, con su `pushUndo` de regalo.
  Ahora se ceden **sólo** el central y Shift (los dos panean) y el resto se sigue tragando.
- **El fantasma del punto se quedaba congelado al panear.** El `pointermove` de la máscara se salta cuando hay un
  arrastre en curso, pero nadie apagaba `_maskHover`: la arista realzada y el círculo seguían pintados en unas
  coordenadas de pantalla viejas mientras la vista se movía por debajo. Se apaga al ceder el gesto.
- **La barra de la ventana solo-visor no se repintaba al cambiar de secuencia.** Su firma no llevaba la secuencia
  activa, y el botón `Floor` depende de `activeSeq().room.floor`: saltando entre dos salas —una con piso y otra
  sin él— el `seqMode` no cambia, así que el botón faltaba con el visor ya partido, o sobraba en una sala sin piso.
  La firma lleva ahora `activeSeqId` y el propio flag de piso.
- **`roomVpAutoFloor` borraba la preferencia guardada.** Forzar el piso al abrir está bien —es lo que se pidió—
  pero además llamaba a `saveRoomVpPrefs()`, así que un «piso oculto» guardado por el usuario se pisaba en CADA
  apertura y no volvía a sobrevivir a un reinicio. Ya no persiste: sólo toca el valor en memoria. Quien guarda es
  el botón `Floor` cuando lo pulsa el usuario.
- **El hover repintaba en cada evento de puntero.** La firma se redondeaba a píxel entero, así que cambiaba
  prácticamente en cada `pointermove` y disparaba un `render()` de GL completo — justo lo contrario de lo que decía
  su comentario. Cuantizada a 2 px: medido, 8 movimientos de 1 px pasan de 8 repintados a 4, y el fantasma (5 px de
  radio) se ve igual de fluido. Fuera de la banda de 8 px de la arista no se repinta en absoluto.

## ROUND 231 — Siete correcciones de la prueba sobre el .exe

Beltrán probó el `.exe` de R230c (compilado y desplegado en Windows ese mismo día: NDI sobrevivió al
`npmRebuild:false` de R207 porque los addons ya estaban compilados contra este mismo Electron 42.4.1) y trajo una
lista de siete puntos. Todos cerrados y verificados por CDP en dev con `__errs` vacío — `scratchpad/r231-fixes.mjs`,
más `r231-diag.mjs` y `r231-mask-dom.mjs` para el detalle de la máscara.

### La máscara manual era una trampa

Añadir un punto «en esta línea» no existía: un clic que no cayera sobre un vértice hacía `mk.pts.push(...)`, o sea
**añadía el punto al final del anillo**. El polígono se cruzaba consigo mismo y cada intento de arreglarlo lo
enredaba más — la captura que mandó Beltrán es exactamente eso. Ahora hay `maskSegHit`: la arista bajo el cursor se
realza, aparece el fantasma del punto que se insertaría (círculo con cruz) y el cursor pasa a `copy`; el clic
**inserta en su sitio** (`splice(si+1,…)`) y **en el punto proyectado sobre la arista**, así que la figura no cambia
de forma al ganar un punto. Fuera del contorno ya no se añade nada, sólo un aviso. Un polígono a medio dibujar
(menos de 3 puntos) se sigue completando clicando suelto. La tolerancia son 8 px, un pelo por debajo de los 9 del
vértice, para que en el empate mande el arrastre del punto.

El segundo síntoma —«al agregar una máscara se me bloquea el arrastre por el lienzo con la rueda del ratón»— tenía
una causa de una línea: `if(e.button!==0)return true` se tragaba **el botón central**, que es el que panea. El modo
máscara sólo se queda ya con el botón izquierdo a secas; el central y Shift+arrastre vuelven al gesto normal.

### El snap sólo parecía existir en vertical

No faltaban costuras: `roomSeamY` ya daba el borde superior e inferior de cada muro, su centro vertical y el centro
del lienzo. Lo que fallaba era el **umbral**, que estaba en unidades de MARCO — y una unidad de marco vale distinto
en cada eje. En la tira de una sala (7680×1080 metida en un panel apaisado) los mismos `0.018` daban **4.59 px** de
zona de captura en X y **0.65 px en Y**: sub-píxel, inalcanzable con el ratón. Ahora el umbral se mide en píxeles de
pantalla y por eje (`SNAP_PX=7`, `snapThr(P,axis)`, con `flatMap` exponiendo `sx/sy/z`): los dos ejes capturan a 7 px
(medido). Alt sigue anulando el imán.

### Lo demás

**El audio de un vídeo iba al revés.** La validación de pista destino leía `media.kind`, pero el clip de audio de un
vídeo **comparte medio con su pareja de imagen** (`kind:'video'`): se le dejaba caer en pistas de vídeo y se le
impedía moverse entre las de audio. Manda `isAudioClip(clip)` — la pista donde vive.

**Colores de pista fijos por función:** gris vídeo, verde audio, rojo piso (`LANE_COL`/`laneColor`). Fuera «Set track
color…» del menú de la cabecera y fuera `openLaneColorPopup`; el color por CLIP se conserva intacto. Los tags F1/F2
de R230c y el tinte de fila del piso pasan de azul a rojo, para que el marco y el color de la pista digan lo mismo.

**El launcher de sala arranca en blanco:** sin preajuste marcado (había una opción `—` nueva; antes el desplegable se
auto-marcaba con el que coincidiera con el pixelaje, así que «4K» salía elegido sin que nadie lo pidiera) y sin piso
(`roomFloor:false`). Editar `pxW`/`pxH` a mano limpia el preajuste. En cambio, **una sala QUE SÍ tiene piso entra al
editor con el visor partido abierto** (`roomVpAutoFloor`, al crear y al abrir): estrenarlo escondido detrás de una
preferencia de otra sesión lo hacía parecer perdido.

**La ventana solo-visor recupera dos cosas.** R230b la dejó entera a propósito, pero entonces no había forma de
encuadrar el piso en la segunda pantalla: ahora se parte en muros|piso según **su propio** botón `Floor` (`_vFloor`),
mientras las miniaturas del launcher siguen sacando el lienzo entero. Y su rueda en 2D ya hace zoom: salía por la
puerta con `if(viewerMode()!=='3d')return`, así que en 2D no hacía nada. El encuadre es **suyo** (`_vVp`, por
superficie), así que acercarse ahí no mueve el del editor ni al revés; `vWithViewport` le presta el viewport y el
modo mientras dura el gesto, porque si no `vpPanels()` calcularía los paneles con el tamaño del editor.

## ROUND 230b — Lo que encontró la revisión del visor partido

Auditoría del diff de R230 con dos revisores independientes (uno sobre paneles/puntero, otro sobre el piso por
defecto, las preferencias y las cabeceras). Salieron **catorce** hallazgos reales; todos corregidos y verificados
por CDP (`scratchpad/r230b-fixes.mjs`, más las dos sondas de R230 vueltas a pasar sin cambios). `__errs` vacío.

### Lo que estaba roto de verdad

- **Los controles +/− y el % de la barra habían quedado inertes.** Escribían `state.view.zoom`, que con el visor
  partido ya no es el zoom de NINGÚN panel, y el rótulo mentía («100%» aunque la rueda hubiera ampliado 6×).
  Ahora obedecen al panel con el **foco** —el último que tocó el puntero— y el botón de porcentaje recentra
  **todos**, que es la salida cuando un panel se ha ido de encuadre. El umbral de los imanes (`snapFrame`,
  `snapMoveAxis`) también leía el zoom global: a 6× capturaba desde decenas de píxeles y no dejaba colocar un clip
  cerca de una costura.
- **Con el piso oculto, sus clips se mapeaban al panel de muros.** `vpPanelFor` caía a `ps[0]`, pero
  `clipSurfA` seguía devolviendo el aspecto del piso: el contorno salía flotando sobre los muros, los tiradores de
  un clip invisible se podían agarrar, y arrastrarlo escribía coordenadas de muro en un clip que compone en el
  piso. Ahora `clipPanel()` devuelve **null** cuando la superficie del clip no está a la vista, y contorno,
  tiradores, hit-test, escala, arrastre y máscara lo respetan. El clip sigue componiendo igual; sólo deja de ser
  editable desde un visor que no lo enseña.
- **La ventana solo-visor salía partida, con divisor y con el pan/zoom del editor** — justo lo contrario de lo que
  promete (encuadre limpio en una segunda pantalla). Y **las miniaturas del launcher también**: `lchEditorShot`
  sustituye clips, media y secuencia activa pero NO `state.lanes`, así que leía las pistas del proyecto de fondo
  para decidir si partirse. `vpSplitOn()` ahora exige `!_vPaint && !_lchShot`: la partición es del editor.
- **El botón `Floor` mentía en salas legacy y en 3D.** Su condición no era la de la partición, así que en una sala
  guardada antes de R229 —sin `lane.surf`— se dejaba pulsar y anunciaba «Floor panel off» sin que pasara nada.
  Se mudó a `_updViewCtl`, que es la función que se re-evalúa al cambiar de modo, y `updModeUI` la llama para que
  cambiar de secuencia también cuente.
- **Editar la geometría de una sala existente le cambiaba el piso en silencio.** El piso sólo se consideraba
  «propio» si traía `wcm`/`dcm`; uno guardado sólo con píxeles (los que hacía el demo y «New sequence… → 360 Room»)
  se recalculaba, el lienzo pasaba de 2160 a 3000 de alto y **todos** los clips de una sala legacy se movían y
  reescalaban. Ahora basta con que traiga píxeles para que mande; las medidas que falten se completan con la
  huella de los muros.
- **Faltaba una cuarta vía de creación de piso.** `roomFloorDefault` decía ser fuente única de tres, y «New
  sequence… → 360 Room» seguía copiando el pixelaje del primer muro: reproducía el piso aplastado que R230
  arreglaba, y encima fabricaba pisos sin cm — la precondición del fallo anterior.

### Lo demás

Un preajuste **sin** `floorCfg` reemplaza los muros enteros, así que su piso vuelve a seguirlos en vez de arrastrar
el de la sala anterior. El divisor guarda en `localStorage` **al soltar**, no en cada evento de movimiento
(cientos de escrituras síncronas por arrastre; medido: ahora 1). El encuadre por panel se reinicia al abrir o
crear un proyecto, en vez de heredarse. La máscara se recorta al panel de su clip, y un clic en el panel
equivocado se ignora en vez de insertar un vértice extrapolado sin aviso. Un tirador que cae bajo la zona de
agarre del divisor ya no se pinta: ese clic se lo queda el divisor, así que dibujarlo prometía un agarre
inexistente. Con el visor muy angosto los dos paneles se reparten a la mitad antes que dejar el del piso fuera del
lienzo (verificado a 60, 90, 140 y 400 px de ancho). Y renombrar una pista de piso arranca con el campo vacío:
como el hueco se pinta vacío cuando el nombre es el propio tag, cancelar dejaba «F1 F1» escrito hasta el siguiente
repintado.

### Cabeceras de las pistas de piso

Petición de Beltrán en la misma sesión: fuera la chapa «FLOOR». La pista se identifica ahora sólo por su tag
enmarcado en azul (`.tag.floor` → F1, F2…) y nace con `name === tag`, así que la cabecera no repite la palabra
tres veces. El `.nm` se sigue pintando —vacío— porque es donde `renameLane` engancha la edición en línea y su
`flex:1` es lo que alinea los botones M/S con los de las pistas de muro (medido: misma x en W1 y F1).

**Queda sin tocar, a propósito:** las pistas que crea `migrateRoomFloor` para un `.isp` pre-R221 siguen llamándose
«Floor N» y sin `surf`. No es un descuido: sus coordenadas son del lienzo entero y etiquetarlas de superficie las
recolocaría. Que se vean distintas de las nuevas es informativo, no un fallo.

### Identidad de superficie de las pistas — el hallazgo preexistente, cerrado en R230c

`duplicateLane` no copiaba `surf`: duplicar F1 daba una pista de vídeo suelta con tag `V n`, y sus clips —copiados
con ella— dejaban de componer sobre el piso **en silencio**. Ahora la copia hereda la superficie, se numera dentro
de su propio grupo (F3, W5…) y, si el original se llama como su tag —la convención de las pistas de piso—, la copia
también, para no acabar con un «F3 · F1 copy».

Por el mismo camino aparecía un segundo agujero: `trackCreateItems` pregunta muro o piso en una sala, pero **⌘T y
la paleta de comandos** llaman a `addLane('video')` sin preguntar, y esa pista nacía sin superficie. Una pista así
se coloca contra el lienzo ENTERO y ningún panel del visor la encuadra bien. La decisión vive ahora dentro de
`addLane`: en una sala con pistas de superficie, una pista de vídeo sin `surf` cae al grupo de MUROS, que es el que
siempre existe. Así queda cubierto cualquier camino futuro que tampoco pregunte.

Verificado (`scratchpad/r230c-lanes.mjs`): duplicar F1 → F3 con `surf:'floor'`, su clip copiado devuelve el rect del
piso y el panel del piso; duplicar W1 → W5 `surf:'wall'`; `addLane('video')` en sala → W6 `surf:'wall'`. Y lo que NO
cambia: el audio sigue sin superficie, y en un proyecto 2D plano la pista nueva es `V5` y la duplicada
`V6 · Video 1 copy`, exactamente como antes.


## ROUND 230 — Visor 360: la sala se edita por superficies, y el 2D se parte en muros | piso

Cierre de la tanda del 2026-07-30 (spec en `CORRECCIONES-360-VIEWER.md`). Etapa 1 venía escrita en R229 pero sin
verificar; aquí se verifica, se hace la Etapa 2 entera y se cierra la 3. **Todo verificado por CDP en dev sobre un
Mac** (`scratchpad/r230-surfaces.mjs` mide PÍXELES leyendo el FBO composite; `scratchpad/r230-split.mjs` maneja el
visor con eventos de puntero reales), `__errs` vacío en todas las corridas. **No se compiló ni se desplegó**: el
`npm run dist` y la copia del `app.asar` a las 3 instalaciones quedan pendientes en la máquina Windows.

### 1 · Etapa 1 verificada por píxeles, no por captura

Una captura de pantalla del visor no demuestra nada de esto: en una sala el proyecto abre en 3D, y el wireframe no
dice si un clip del piso se comió una fila de muro. La sonda compone a un tamaño MÍNIMO (512², la GPU de dev se cae
en renders grandes), hace `readPixels` sobre `compFBO` y cuenta píxeles encendidos por región del lienzo.

- **Seam wrap de muros, intacto:** el mismo clip centrado da 1834 píxeles encendidos; empujado sobre la costura da
  1834 otra vez, repartidos **917 + 917** entre los dos extremos de la tira. Se parte por la mitad exacta y no pierde
  área — que es justo lo que tiene que pasar.
- **El piso ya no invade los muros:** con el clip del piso a escala 300 (desborda por los cuatro lados),
  `wallsAll`=0 y `wallsUnderFloorCols`=0. El scissor por superficie hace su trabajo.
- **El fold-wrap de R222 ya no ocurre**, que es la condición para poder archivarlo (§3).

### 2 · Etapa 2 — el visor 2D se parte en dos paneles: muros | piso

En modo sala 2D, el `#stage` pasa a tener **dos paneles lado a lado**: los muros a la izquierda (la tira
`[0,stripH]` del lienzo) y el piso a la derecha (el rect `[fx0,fx1]×[stripH,H]`). Los dos bliteán su región del
**MISMO composite** — no hay segunda FBO ni segundo lienzo —, así que el visor 3D y el export siguen leyendo
exactamente lo de siempre.

Sólo había cuatro sitios que daban por hecho "un rect = el lienzo entero": `resize()`, los uniformes del blit,
`flatMap()` y `pix2frame()` — y todos los manejadores de puntero metían píxeles crudos de `gridc` en `pix2frame`
sin preguntar en qué panel estaban. La pieza nueva es `vpPanels()`, que devuelve la lista de paneles; **fuera de la
sala con pistas de superficie devuelve UN panel que cubre el lienzo entero**, y ahí toda la matemática vuelve a ser
byte por byte la de antes (domo, 2D plano y salas legacy sin `surf` no se enteran de que existe la partición).

- **Divisor arrastrable**, con la PROPORCIÓN persistida en `localStorage` (no los píxeles: así aguanta un cambio de
  tamaño de ventana). Es una preferencia de la herramienta, no del proyecto — no viaja en el `.isp`.
- **Botón `Floor`** en la barra `.vptool`; ocultar el piso devuelve los muros al ancho completo. Sólo aparece en
  salas que tienen piso (`updModeUI`).
- **Pan/zoom POR panel** (`state.view.vp[surf]`): se puede encuadrar el piso sin descolocar los muros.
- **Hit-testing por panel**: arrastre de clip, tiradores de escala, máscara y pan/zoom mapean a la superficie
  correcta. Verificado: arrastrar 60 px en el panel del piso mueve el clip del piso 60 px **en el piso**, y los
  imanes de costura (`roomSeamX`/`roomSeamY`) trabajan en el marco de la superficie, no del lienzo.
- **Ida y vuelta pantalla↔marco con error 0** en los dos paneles (`pix2frame(P)` es el inverso exacto de
  `flatMap(P).px`). De paso se arregló una deriva vieja del zoom con rueda en modo flat, que anclaba con `pix2f`
  (el mapeo del DOMO) en vez del mapeo plano.

### 3 · Etapa 3 — se archiva el fold-wrap de R222

`computeRoomFold`/`roomFold` y sus cachés `_roomFold`/`_roomFoldSeq` se van a
`_backup/deprecated/20260730-room-floor-wall-fold-wrap.js` con su derivación completa. **No es un cambio de opinión
sobre la idea, es que se quedó sin trabajo:** desde la Etapa 1 el clip del piso está recortado a su rect, así que
nunca llega a cruzar el borde que el plegado dibujaba. Medido, no supuesto (§1). El seam wrap HORIZONTAL de muros
—que es otra cosa— sigue vivo y verificado.

### 4 · El piso por defecto hereda el pixelaje de los muros

Petición de Beltrán durante la sesión. Un piso de 500×400 cm en una sala cuyos muros van a 3,84 px/cm de ancho y
4,8 px/cm de fondo tiene que salir **1920×1920**, no 1920×1080: si no, el piso queda aplastado y su proporción no
casa con la de los muros que lo rodean. La cuenta ya existía dentro de `lchFloorCfg` (launcher), pero el demo y el
diálogo de sala clavaban `1920×1080` a mano. Ahora hay **una** función, `roomFloorDefault(walls)`, y la usan las
tres vías. En `roomSetupDialog` el piso **sigue a los muros mientras no se toque**: cambiar un muro lo reencaja
solo; al primer valor escrito a mano queda fijo (la regla de R198 — las medidas salen de la sala, el pixelaje se
puede elegir porque depende del proyector). Un preajuste guardado o una sala que ya trae piso propio también lo
fijan. El demo de sala pasa de un lienzo 7680×2160 a **7680×3000**.


## ROUND 227 — Feedback, Etapa 5: el menú File adelgaza y el recorrido guiado se muda a unos DEMOS

Última etapa de la tanda del 2026-07-29. Los dos ítems cerrados y verificados por CDP contra la app real (guiones
`scratchpad/r227-*.mjs`, capturas en `scratchpad/r227/`, `__errs` vacío en todas las corridas).

### 1 · File → una sola entrada de proyecto nuevo, que lleva a la pantalla de inicio

El menú File tenía **tres** entradas de proyecto nuevo —domo, 2D y sala—, cada una con su diálogo modal para elegir
resolución, cobertura o muros. Eran una copia peor del launcher: allí los tres formatos están juntos, con TODOS los
parámetros a la vista y una vista previa hecha con el `render()` de verdad (R182/R198). Ahora hay **una** entrada,
`New project…`, y lo que hace es **volver a la pantalla de inicio**. Ctrl+N, la paleta de comandos y el viejo
`#newBtn` van al mismo sitio: antes Ctrl+N creaba un domo 4096² a ciegas, sin preguntar nada.

**La pregunta pasa a tener tres salidas.** `confirmDiscard()` sólo ofrece *descartar* o *cancelar*, y con esa pareja
elegir «New project…» con trabajo sin guardar obliga a perderlo o a no hacer nada. `appConfirm3` añade **Guardar**
(Enter), **Descartar** y **Cancelar** (Esc / clic fuera), y devuelve `'save' | 'discard' | 'cancel'` — un booleano no
daba para tres. Si se elige guardar y el diálogo de guardado se cancela (o la escritura falla), `state.dirty` sigue
en true y **no se sigue adelante**.

**El proyecto abierto no se toca al ir al launcher.** Sigue en memoria detrás, y la barra superior estrena
**«Back to project»** — visible sólo cuando se llegó ahí desde un proyecto (`_lchVolver`), porque en el arranque no
hay nada a lo que volver. Sin esa salida la entrada del menú sería una puerta de un solo sentido: el launcher no se
puede cerrar. Por eso «descartar» **no** toca `state.dirty` (así volver devuelve el proyecto con sus cambios y su
asterisco) y en su lugar deja `_descartarYaDicho`, una bandera de un solo uso que consume la siguiente
`confirmDiscard()` — sin ella la misma pregunta salía dos veces seguidas, la de `appConfirm3` y la del `newProject`
que dispara el launcher.

De paso, `newProject`/`newRoomProject` **devuelven ahora `true`/`false`**. Antes no devolvían nada, así que quien
llamaba no podía distinguir «creado» de «el usuario dijo que no» y seguía adelante tocando el proyecto ANTERIOR:
`lchCreate` renombraba su secuencia activa con el nombre teclado para el proyecto que nunca se creó.

`domeSetupDialog` y `flatResDialog` quedaron sin llamantes → archivados (ADR-0007). **`roomSetupDialog` no**: es el
camino de Project → «Room geometry…».

### 2 · El recorrido guiado ya no sale al crear un proyecto: sale con unos DEMOS

Salía sobre un proyecto **vacío**. Hablaba de pistas, clips, curvas y composiciones señalando huecos, y encima
estorbaba justo en el momento de ponerse a trabajar. Ahora el launcher tiene un botón **«Demos»** (junto a «Open
project») con Dome / 2D / 360 Room: se construye **en memoria** una pieza pequeña pero viva y el recorrido pasea por
ella señalando cosas de verdad.

**Cada demo son ~22 s con lo mismo, dicho en el idioma de su formato:** cuatro pistas con nombre propio, un fondo con
Motion, una **composición de 2 clips** (creada por el MISMO `nestSelection` del gesto del usuario, no por una
estructura paralela inventada para el demo), un clip con **Motion + Efecto + automatización de POSICIÓN +
automatización del MIX del Motion**, y un texto con curva de **OPACIDAD**. La sala reparte el contenido entre el muro
izquierdo, una composición que cruza Frente y Fondo, el muro derecho y el **suelo**.

**Sólo medios generables** (formas + texto): el demo no depende de rutas, abre en cualquier máquina y no puede quedar
en «media offline». Arranca sin ruta y con el historial vacío (`currentPath=null`, `dirty=false`), así que es un
proyecto normal: se edita y se guarda con el Save de siempre.

Tres cosas que hubo que aprender construyéndolo:

- **Un Motion LINEAL de `x` no sirve en 2D plano.** El clip se va del lienzo y no vuelve nunca: a los pocos segundos
  el demo se queda vacío. En el domo el azimut da la vuelta y en la sala el wrap de la costura reaparece al otro
  lado, pero sólo una vuelta. Los demos 2D y de sala usan `mode:'wave'` (el argumento `over` de `_demoMotion`);
  medido el recorrido del clip 2D a lo largo de 28 s de reloj: se queda en ±62 %, siempre dentro del encuadre.
- **`newFx` nace reactivo al audio** (`int:0` / `amt:100`), y en un demo SIN audio eso es un efecto invisible.
  `_demoFx` intercambia los dos: intensidad estática y cero reactividad.
- **Los dos clips de la composición nacen en `V[1]` y `V[3]`**, no en la misma pista: así se ven a la vez. El nest
  aterriza en `V[1]` (la pista de vídeo de menor índice de las usadas) y el texto ocupa después el `V[3]` que quedó
  libre → no queda ninguna pista vacía.

**El recorrido pasa de 5 pasos a 9** (6 en la versión genérica de Ventana → «Recorrido guiado», que gana el paso de
2D/3D). Lo que los hace útiles es que cada paso puede traer un **`act`**: no sólo señala, **deja el editor en el
estado del que habla** — selecciona el clip y abre su inspector, cambia a la pestaña «Reactive FX» para que se vea el
efecto aplicado, enciende el modo automatización y fija el parámetro de la pista para que la curva esté a la vista,
resalta el clip de la composición. `act` se ejecuta en cada `draw` (también al volver atrás o al redimensionar), así
que es idempotente y no llama a `markDirty`: enseñar no es editar — al terminar, el demo sigue con `dirty:false`.
Además `sel` admite una función (los ids de clip del demo son de tiempo de ejecución) y `reveal` hace `scrollIntoView`
antes de medir el agujero, para pistas o clips fuera de la parte visible de la línea de tiempo.

`buildDemoProject()` se queda como alias del demo de domo sin recorrido: no lo llama la app, lo llaman los arneses de
`scratchpad/`. `_tourSkipNext` desapareció — ya no hay disparo automático que silenciar.

### Verificación (CDP, app real en `:9222`)

- **File:** el menú muestra exactamente una entrada de proyecto (`New project… · Ctrl+N`, más Open/Save/Save As/Export).
  Las tres salidas del diálogo: *cancelar* → se queda en el proyecto y sigue sucio · *descartar* → landing con los
  cambios intactos y sin segunda pregunta al crear · *guardar* → escribe, `dirty:false` y landing. Sin cambios → landing
  directo, y «Back to project» devuelve el proyecto con sus 4 clips y su secuencia.
- **Sin recorrido al crear:** los 3 tipos desde el launcher y los 3 tipos de «New sequence» → `#tourOv` ausente en los
  seis casos.
- **Los 3 demos:** capturas del lienzo real (`glc.toDataURL`, no la del protocolo — ojo, `Page.captureScreenshot`
  devuelve una textura de canvas rancia y pintaba una banda negra en el tercio inferior que **no existe**: comprobado
  leyendo el composite con `readPixels` y volcando el canvas). Play de 5 s en los tres con el contenido moviéndose;
  los 9 pasos del recorrido avanzados por teclado con capturas del inspector, de la automatización con la curva y de
  la composición; Skip a mitad (paso 3/9) deja el demo editable y sin marcar sucio; editar + `Save` produce un `.isp`
  de 9,7 kB que **reabre** con sus 4 clips, el nest, las curvas (`mot:az:mix`, `el`, `opacity`), los motions y los efectos.
- **Regresión:** los 3 tipos de proyecto normales, abrir un `.isp` reciente y undo/redo sobre un demo (0 → 4 → 0 → 4).
- `node --check app.js && node --check main.js` limpio · `window.__errs` vacío en todas las corridas.

## ROUND 226 — Feedback, Etapa 4: la máscara al lienzo y la ventana solo-visor complementaria

Los dos ítems de la Etapa 4 de `docs/NEXT.md`, cerrados y verificados por CDP contra la app real (guiones
`scratchpad/r226/t-mask.mjs`, `t-viewer.mjs`, `t-save.mjs`, `t-combo.mjs`, `t-reopen.mjs`; capturas en
`scratchpad/r226/shots/`; `__errs` vacío en todas las corridas).

### 1 · La pen mask se edita SOBRE EL CLIP, no en una miniatura

Beltrán no pedía una función nueva: pedía **ver dónde recorta**. El mini-editor del inspector eran 220 px cuadrados
con la miniatura del medio al 18 % de opacidad; en el domo eso es directamente inútil, porque el contenido va
deformado por el warp y el mini-lienzo lo mostraba plano. La edición pasa al **lienzo del visor**, con los puntos
encima del clip.

**Lo que hace que funcione es que la proyección es exacta, no aproximada.** El sampler de máscara lee `u_maskTex` en
`v_flat*0.5+0.5`, y `v_flat` **ES** `a_flat`: la coordenada local del cuadrilátero del clip, la misma con la que el
vértice se coloca. Así que un punto guardado `p` (0..1, y hacia abajo, escalado por `penExpand`) vale
`a_flat=[2·px−1, 1−2·py]` —el `1−` viene de `UNPACK_FLIP_Y_WEBGL`, que sube la fila 0 del lienzo a v=1— y desde ahí se
proyecta por **el mismo camino que el contenido**: `flatPlace` en 2D y sala, y en el domo el parche tangente gnomónico
+ azimutal-equidistante de `VSW`, con el `rot`, el `mirror` y el wrap de diámetro incluidos (los tres los ignora
`drawOutline2D`, que por eso nunca cuadró del todo con el contenido). `penFromPix` es el inverso analítico: un 2×2 en
flat, y en el domo una proyección sobre la base ortonormal `d/U/V` (`s=atan(mir·U·ray/d·ray)/ax`). Medido por CDP:
**error de ida y vuelta 0,000 px en los cuatro puntos, en domo y en flat**, y un arrastre aterriza en el píxel exacto
que se le pide (452,277 → 452,277).

Gestos: clic añade punto al final del polígono activo · arrastre mueve · doble clic quita (mínimo 3 puntos) · Esc o
**Done** cierra. Mientras el modo está activo se **suspenden** los gestos normales del lienzo (mover/escalar clip,
panear, orbitar) y desaparecen los tiradores de escala, porque un clic suelto crearía un punto y movería el clip a la
vez. Una pill discreta arriba dice qué modo es y cómo salir (patrón R219/R220; baja a la segunda fila si la de
«Preparando medios…» ya ocupa la primera). El modo es **auto-sanante** (patrón R218): se apaga solo si el clip
desapareció, se quedó sin máscaras o **la selección se fue a otro clip**, así que ningún camino de edición tiene que
acordarse de cerrarlo. Del inspector quedan la lista (invertir · suavizar · borrar), Expand, «Add mask» —que entra
directo al lienzo, porque es donde se dibuja— y el botón **Edit on canvas / Done**. El mini-editor se archiva
(ADR-0007) y `rasterizePenMasks` no se toca: sólo cambió la superficie de edición.

**Fallo anterior destapado por la verificación de «guardar y reabrir»:** el camino v4 de `loadProject` (rama
`m.kind==='nest'`, por la que pasan TODAS las secuencias de un `.isp` actual) sólo rasterizaba `maskData`. Una máscara
de pluma volvía del disco con `props.mask==='pen'` y `maskTex` en null → el sampler caía al `ntex` de reserva, cuyo
alfa es 1 en todo el cuadro, y el clip aparecía **sin recortar**: la máscara parecía perdida cuando estaba entera en
el archivo. Arreglado en la misma línea que ya lo hacía bien en los otros dos sitios.

### 2 · La ventana solo-visor: por qué se quedaba pegada

**Causa raíz, medida en la app real, no deducida:** el espejo re-dibujaba la escena en una FBO propia y la traía a la
CPU con **`gl.readPixels` SÍNCRONO, dentro de `render()`**. Con la ventana cerrada `render()` costaba **0,05 ms**; con
ella abierta, **9,66 ms** — unas 200 veces más — en un domo 2D con **un solo clip de forma**. Desglose: readPixels
3,57 ms a 944² (6,5 MB al tope de 1280²), `putImageData` 0,71 ms, el resto el pase extra y los binds. readPixels vacía
la tubería de la GPU en cada fotograma. Efecto en reproducción: **60,4 → 36,6 fps con una escena trivial**; con vídeo
real y un composite de 4K eso se va por debajo de 30 y el editor deja de responder entre fotogramas. Y como cada gesto
de la emergente (orbitar, rueda, botón de grilla) llamaba a `render()`, arrastrar dentro de la ventana bloqueaba
también al editor. No era un cuelgue: era el editor pagando un vaciado de GPU por cada cosa que dibujaba.

**El arreglo no optimiza el readback: lo elimina.** `viewerPaint()` intercambia los globales de vista —el patrón ya
probado de `lchEditorShot`—, llama al `render()` de siempre con el modo y el tamaño de la ventana, y copia `glc` +
`gridc` a la emergente con `drawImage` (GPU→GPU, el WebGL primero y las guías encima). Coste medido: **1,5–2,7 ms**, y
`render()` del editor vuelve a costar 0,03 ms — es decir, **el editor ya no paga nada por tener la ventana abierta**,
que es lo que hacía que se sintiera trabado al arrastrar. `_reuseComp` evita recomponer el máster una segunda vez por
fotograma (el composite depende del cabezal, no de la vista). Y hay un `render()` de cierre tras restaurar los
globales, porque cambiar `glc.width` **borra** el lienzo y el visor del editor se quedaría negro.

Regalo del enfoque: como es el mismo camino de dibujo del editor, **la sala 360 en 3D funciona sin escribir nada**
(antes caía a la tira plana), y los rótulos de muro, la grilla, las guías y el pill de «Preparando medios…» aparecen
gratis.

**El bombeo pasa a ser de la ventana.** Su propio `requestAnimationFrame`, y sólo pinta si `_vDirty` (lo marca
`render()` al final). Si la emergente se congela, se minimiza o se cierra, el editor no se entierra con ella; y en
reposo el coste es cero. `_vBusy` cubre también el render de cierre: sin eso, marcarse sucio a sí mismo sería un bucle
de repintado eterno.

**Vista complementaria:** editor en 2D ⇒ ventana en 3D y al revés, en domo y en sala. Los botones 2D/3D de su barra
fijan un override manual que se suelta solo en cuanto el editor cambia de modo. Una secuencia 2D plana no tiene 3D
(el editor tampoco ofrece el botón), así que ahí la ventana se queda en 2D y el segmento desaparece.

**Barra propia** dentro de la emergente, con **CSS auto-contenido**: el botón viejo se pintaba con `color:var(--ink)`,
variable que vive en el documento del editor y no en el `about:blank` de la emergente, así que su texto salía casi
invisible. Lleva el segmento `2D|3D`, `Grid`, el overlay contextual del formato (`Horizon` domo · `Seam` sala ·
`Center` 2D — oculto en sala+3D, donde la costura es una guía de la tira 2D) y, en 3D, `Orbit|Viewer`. Va al 35 % de
opacidad y sube al 100 % al pasar el ratón: es una ventana de salida, la barra no debe competir con la imagen.

**Segunda carrera encontrada al verificar el reabrir:** `window.open('about:blank')` entrega un documento inicial
sincrónico que Chromium **a veces sustituye** al confirmar la navegación. El síntoma es exactamente una ventana negra
sin barra, y es intermitente. En vez de intentar ganar la carrera, el bombeo detecta que falta `#vwcv` y **remonta**
el documento (`viewerBuildDoc`). Cuatro ciclos de abrir/cerrar seguidos: barra y lienzo presentes y con píxeles vivos
en los cuatro.

### Verificación (CDP, app real)
- **Máscara, flat y domo:** crear desde el inspector entra al lienzo (`mask:'pen'`, modo activo) · 4 → 7 puntos por
  clic · arrastre exacto al píxel · doble clic 7 → 6 · **Done** devuelve los gestos normales (`vdragMode:'elemFlat'`)
  y los 8 tiradores de escala · reabrir muestra los puntos donde tocaba · Esc sale · undo/redo correctos · el
  composite recorta de verdad (capturas `m-flat-*`, `m-dome-*`).
- **Guardar y reabrir:** `serProject`→`loadProject` conserva puntos, `mask:'pen'` y `maskTex` reconstruida, y la
  edición se puede reabrir con los puntos en su sitio (`s-01`…`s-04`).
- **Ventana, domo y sala:** abre en 13–65 ms sin colgarse · principal 2D ⇒ ventana 3D y viceversa en vivo · sus
  toggles cambian píxeles (grilla, overlay) · orbitar por arrastre y rueda mueven su cámara propia · override manual
  y su liberación · cerrar no deja al editor roto (`glc` con su tamaño) · reabrir funciona · **10 s de reproducción
  con la ventana abierta: ~42 fps de editor** (el resto es Chromium componiendo dos ventanas en la GPU del dev; el
  `.exe` fuerza la RTX).
- **Las dos mitades juntas:** con la ventana abierta, arrastrar un punto de la máscara sigue siendo exacto, la
  emergente NO lleva el chrome de edición (`_vPaint`), y tras repintarla el editor conserva sus tiradores y el tamaño
  de su lienzo (`c-01`…`c-02b`).

---

## ROUND 225 — Feedback, Etapa 3: inspector, capa de ajuste y composiciones

Los 11 ítems de la Etapa 3 de `docs/NEXT.md` cerrados y verificados por CDP (detalle por ítem ahí; guiones
`scratchpad/r225-*.mjs`, salidas y capturas en `scratchpad/r225/`, `__errs` vacío en las nueve corridas).

**El cambio conceptual de la ronda es el audio de las composiciones.** Beltrán puso la regla: *nunca suena audio
que no esté visible en una pista de audio*. Hasta ahora un nido con sonido dentro sonaba por su clip de VÍDEO —y con
proxy de composición, además, por el `<audio>` del archivo horneado—, así que salía sonido de una pista de vídeo sin
nada que se pudiera silenciar, mover ni ver. Ahora un nido con pistas de audio dentro estrena en el padre un **clip de
audio derivado**: un clip normal cuyo `mediaId` ES el nido, en una pista de audio, con `nestAudioOf` y el
`link`/`avRole` de siempre. Se mueve, recorta y deslinca como cualquier par A/V, el doble clic entra a la secuencia,
y acortar el contenido de dentro acorta las dos mitades. Se cerraron **tres** vías de fuga, no una: el descenso de
`collectAudioEvents` (sólo desde pista de audio), el `<audio>` del proxy (`vinstAudio` devuelve null para nests) y el
`<audio>` de previsualización de los clips que están DENTRO de un nido (ganancia 0 a `depth>0`). El horneado del proxy
no se entera —`ncBuild` exporta el nido como nivel superior, donde sus pistas de audio son de primer nivel—, así que
el proxy sigue llevando el audio.

**Un nido es SIEMPRE máster de domo.** Se archiva el conmutador Dome master/Patch de R216 (ADR-0007): una composición
es el lienzo completo de su propia secuencia, y ubicarla como parche gnomónico volvía a deformar algo ya deformado.
El motor de parche (PW) queda intacto —lo usan todos los demás tipos de clip—, sólo desaparece la elección.
`migrateNestFulldome` convierte los `.isp` guardados en Patch: **decisión asumida**, un proyecto de ayer con una
composición como parche se ve a pantalla completa al reabrirlo (el `az/el/size` no se toca, el encuadre vuelve con dos
arrastres). Se prefiere eso a dejar clips en un estado que la interfaz ya no sabe explicar.

**La capa de ajuste tiene por fin todos los efectos.** El catálogo entero se construye ahora en su inspector, no sólo
en la pestaña Reactive FX. Dos trampas por el camino, las dos vistas en captura y corregidas: `applySecCollapse`
recorre los hermanos de cada cabecera y REPONE el `display`, así que esconder las filas que no aplican no bastaba
(quedaban Azimuth/Size/Loop/Speed sueltos sobre la capa) → se vacían y se ocultan después de construir; y reusar las
claves de plegado `clip`/`motion` dejaba el panel entero plegado, porque [I1] las pliega contando con que Transform
queda abierto arriba y aquí no hay Transform → claves propias `adjfx`/`adjeff`. Verificado por píxeles: un Hue Shift
en la capa mueve los dos clips de debajo como un solo pase y quitarlo los devuelve exactos.

**Dos mandos que parecían de tamaño y eran de resolución.** Fuera los campos de píxeles del texto: la proporción del
lienzo es invariante al cuerpo de la fuente (medido: 3,790 a 300 px vs 3,784 a 90 px), así que sólo cambiaban la
nitidez — los medios nuevos nacen a 300 px y el rásterizado reduce el cuerpo si fuese a topar con 4096 px. En cambio
el interruptor **Outline sí funcionaba** (193 603 → 333 078 píxeles opacos, medido): lo que faltaba era el mando del
COLOR del contorno, que se guardaba sin control y quedaba negro sobre un domo negro. Se añade, no se archiva.

Y el resto: fila **Fisheye** deshabilitada sin fuente fulldome (con tooltip que dice por qué, y apagar fulldome apaga
también el ojo de pez) · inspector de audio sin las filas de fundido —el gesto de R223 ya es ese mando— y con una
**escala de onda** logarítmica que es preferencia de vista, no dato del clip · duración de una composición = el
contenido más largo con duración REAL, 5 s si todo son fijos (antes un texto de 6 s mandaba sobre una composición de
fotos) · acortar dentro del nido acorta la instancia del padre (`clampNestInstances` colgado de `saveActiveSeq`) ·
el audio enlazado desaparece al componer, por decisión de Beltrán, para no apilar audios · los dos interruptores de
proxy pasan a leerse como un par (⚡Clip / ⚡Comp) · y al importar un archivo se adopta el proxy que ya esté a su lado
(la maquinaria era de R107, pero sólo corría al reabrir proyectos: 201 ms medidos, y sin encolar nada — la generación
sigue manual).

## ROUND 224 — Feedback, Etapa 2: automatización que dialoga

Los 8 ítems de la Etapa 2 de `docs/NEXT.md` cerrados y verificados por CDP (detalle por ítem ahí). El corazón:
**una sola fuente de verdad para la curva visible** (`lane._autoP`, resuelta por `laneAutoP` y escrita solo por
tres gestos: chips del header, cualquier gesto del inspector con el modo encendido —`focusAutoParam`—, y
Show automation/openAuto que además lo encienden). Chooser rediseñado: izquierda = Transform/Clip/Color + cada
Motion/Effect aplicado (con ◆ donde ya hay automatización), derecha dependiente con las listas exactas del
feedback; borrar un fx/motion mata su entrada y su curva. Clic-derecho en cualquier fila de parámetro →
Show automation / Reset to default / Clear automation. La línea de fade no se dibuja en automode. Los chips del
header ya no roban la selección del clip. Chapa ↻ de motion archivada (ADR-0007), igual que el `autoDuo` viejo.

**Cambio de modelo con migración:** el Mix de los motions deja `a.wetKf` y pasa a ser el parámetro
`mot:<param>:mix` (0-100%) en `c.kf`/`c.props` — hereda evalP/setKf/curvas/copy-paste/rebase gratis;
`migrateMotionWet` convierte los `.isp` viejos (verificado numéricamente, spin intacto en 2 tiempos).
Tres agujeros de acceso a curvas cerrados (curvas de efecto/Mix inalcanzables desde el menú de clip; Transform
sin parámetros del otro modo; dispositivo cayendo al primer parámetro y no al automatizado).

## ROUND 223 — Feedback post-prueba de Beltrán, Etapa 1: timeline core + clips linkeados

Primera de 5 etapas de la tanda 2026-07-29 (30 ítems; plan completo y decisiones en `docs/NEXT.md`). Los 8
ítems cerrados y verificados por CDP con mp4 reales con audio (detalle por ítem, con el CÓMO, en el propio
NEXT.md): tinte sutil en pistas de audio (`--audio-tint` en fila y cabecera) · swatches de color 18×18 en los
tres menús · ctx menu de pista con New video/audio track desde cualquier pista · **semántica nueva de linkeados**
(selección independiente; el enlace vive en el GESTO — `drag.primaryIds` vs `drag.items` —: mover/trim/speed/loop
juntos y NADA más; fades independientes, el de audio es de volumen) · libertad vertical por tipo de pista (fix
del bug del audio cayendo en pista de video) · **solape = corte no destructivo** con los 4 casos (tapa completa/
izquierda/derecha/dentro→dos restos vía razorCore) + **crossfade manual estilo Ableton** arrastrando el handle
de fade sobre el corte (video = dissolve por solape geométrico de compositeClips, audio = ganancia cruzada
equal-gain; reajustable/eliminable; límite = material) · locators en la mitad inferior · Ctrl+R con selección
exclusiva marker↔clip/pista.

Nota de proceso: Sonnet implementó 7.5/8 ítems y cayó dos veces por 529 del API; un agente Opus fresco cerró el
ítem 6 encontrando y corrigiendo 3 defectos reales del esqueleto (vecino del lado equivocado en
`crossfadeNeighbor`, signo invertido en `inPTouch` que comía material, y `cutOverlapsOnDrop` incompleto).
Decisión de diseño tomada (a confirmar con Beltrán): clip soltado DENTRO de otro → el viejo se parte en dos
restos (overwrite estilo Premiere), coherente con el recorte no destructivo.

## ROUND 222 — Fase B: wrap con rotación entre el suelo y sus muros adyacentes

- **Pedido de Beltrán:** "con el mismo formato del infinito de los muros. Si lo muevo a un borde [del suelo],
  empieza a aparecer en su muro respectivo." Extiende el seam-wrap horizontal de la tira (el `offs` de
  `_roomWrap` en `drawClipFlat`) a los tres bordes del suelo que faltaban — el borde superior (bisagra con
  Front) ya era continuo gratis desde Fase A [R221] (mismo canvas, mismas columnas).
- **Derivación (borde → muro → transformada), a partir de `roomPlan` (`Front:[FL,FR] Left:[FR,BR] Back:[BR,BL]
  Right:[BL,FL]`) y del mapeo uv de `buildRoomGeo` (`uL=x1@a, uR=x0@b`):

  | Borde del suelo | Muro | Transformada (pixel space, y-down) |
  |---|---|---|
  | Izquierdo (`px<fx0`) | Left | `px'=Left.x1-(Left.pxW/floorH)·(py-wallsH)` · `py'=wallsH-fx0+px` — rotación 90° (swap de ejes) |
  | Derecho (`px>fx1`) | Right | `px'=Right.x0+(Right.pxW/floorH)·(py-wallsH)` · `py'=wallsH+fx1-px` — rotación 90° (swap de ejes) |
  | Inferior (`py>wallsH+floorH`) | Back | `px'=Back.x1-(Back.pxW/floorW)·(px-fx0)` · `py'=2·wallsH+floorH-py` — 180° (ejes sin swap, ambos invertidos) |

  Las tres matrices dan determinante positivo (rotación + escala anisotrópica, SIN espejo) — confirmado a mano
  (álgebra de esquinas: cada fórmula reproduce exactamente las 4 esquinas físicas compartidas suelo↔muro) y por
  captura CDP de la junta 3D en los tres bordes. La escala anisotrópica (`Left.pxW/floorH`, etc.) es necesaria
  a propósito: el suelo y cada muro son medios con resolución propia (rara vez iguales), así que iguala el
  "metro" de cada uno en vez de asumir píxeles cuadrados.
- **Implementación:** `computeRoomFold(seq)`/`roomFold()` (nuevas, cacheadas como `_roomGeo`/`_roomGeoSeq` —
  mismos sitios de invalidación: `applyRoomGeometry`, `lchEditorShot`). `drawClipFlat` gana un bloque `_roomWrap`
  que hace un AABB barato contra el rect del suelo (reject inmediato si el clip no lo toca — cero costo extra
  para clips lejos de los bordes) y, si cruza, dibuja un pass extra por borde cruzado con `fx`/`fy`/`fc`
  rotados + scissor a `roomWallScissorRects([role])` (no puede derramarse a un muro vecino). El wrap horizontal
  existente de la tira NO se tocó.
- **Verificación CDP** (proyecto sintético: 4 muros con resoluciones DISTINTAS a propósito — Front/Back 1920px,
  Left/Right 1536px — para forzar el caso de escala anisotrópica; suelo 1920×1536, texto "F" asimétrico
  rojo/blanco sobre fondo de color):
  - **Izquierdo:** captura 2D (pass rotado visible en la columna de Left) + captura 3D de la junta piso-Left →
    el glifo "F" continúa sin salto/espejo a través de la arista.
  - **Derecho:** ídem, junta piso-Right continua.
  - **Inferior:** ídem, junta piso-Back continua (flip de 180°, coherente con la derivación).
  - **Interior (sin cruzar bordes):** instrumenté `gl.drawElements` — 1 sola llamada (cero passes extra).
  - **Cruzando un borde:** 3 llamadas (1 normal + 1 wrap horizontal preexistente que también dispara porque
    `fx0` del suelo coincide con el borde 0 de TODA la tira — comportamiento previo intacto, inofensivo, no
    corresponde a ninguna superficie 3D real — + 1 fold nuevo).
  - **Sala sin suelo:** `roomFold()` devuelve `null`, 2 llamadas (normal + wrap horizontal, sin cambios).
  - **Wrap horizontal de muros (Front↔Right por la costura interna, y el wrap Left→Front por el borde exterior
    de la tira dentro de la banda de muros):** intacto — captura idéntica al comportamiento pre-R222 (copia sin
    rotar, sólo trasladada).
  - **Dome y 2D Flat:** proyectos nuevos de cada modo con un clip de texto — 0 errores, sin regresión visual
    (`drawClipFlat` fuera de `_roomWrap` no ejecuta ninguna rama nueva).
  - `node --check app.js`/`main.js` limpio, `window.__errs` en 0 durante toda la sesión de pruebas.
- **No implementado a propósito (fuera de alcance, per pedido):** el wrap INVERSO muro→suelo (un clip de muro
  que asoma no pinta en el suelo) — sólo se pidió que el suelo "aparezca en su muro respectivo".

## ROUND 221 — Fase A: el suelo de la sala 360 pasa a ser parte del mismo canvas que los muros

- **Contrato nuevo:** la secuencia de sala tiene UN canvas (`stripW × (room.stripH + floorH)`); el suelo ya no es
  una secuencia `'flat'` aparte con `room.floorSeqId` — es la franja inferior de la MISMA tira, con el mismo
  mecanismo de colocación de clips que cualquier otro rect flat. `room.floor` conserva `pxW/pxH` como resolución
  de export del suelo. `room.floorSeqId` queda obsoleto, sólo vive para migrar `.isp` viejos.
- **A1** `createRoomSequences`/`newRoomProject`/`newSequenceDialog`/`lchRoomSeqTemp`/`applyRoomGeometry`: ya no
  crean una media Floor; nuevo helper único `roomFloorH(walls,floor,stripW)`. Quitada la compensación de
  pan/zoom del dock (R211) — el letterbox centra el canvas completo solo.
- **A2** `drawRoomGrid2D` usa `room.stripH` para muros; el rect del suelo pasa a ser overlay DENTRO del canvas.
  Archivado `drawRoomFloorDock2D` (ADR-0007, `_backup/deprecated/20260729-room-floor-dock-2d.js`). `mediaWarming`
  ya no revisa una `floorSeqId` separada.
- **A3** `buildRoomGeo` re-deriva los UV del suelo al rect del dock DEL MISMO composite (ya no hay floorTex
  propia); shade del suelo pasa de 0.5 a 1.0 (misma claridad que los muros). `renderRoom3D` sin
  `compositeFloorTex`/FBO propia (archivado, `20260729-room-floor-fbo-composite.js`). `drawRoomLabels3D` proyecta
  ahora la grilla del suelo en el wireframe 3D siempre que `room.floor` exista.
- **A4** Export: `opt.wall` generalizado con `y0/y1` (antes sólo top-anchored) — el mismo mecanismo de crop por
  muro sirve para "tira completa" (sólo muros) y "suelo" (rect del dock, escalado a `room.floor.pxW×pxH`). 3
  modos en `#exRoomMode`: Full strip / Strip + floor (2 jobs) / Each wall + floor (N+1 jobs).
- **A5** `migrateRoomFloor` en `loadProject`: crece el canvas, reubica los clips del piso viejo a lanes nuevas
  (`Floor 1…`) con la orientación del dock R211 (x directa, y invertida — verificado como identidad de reflexión
  + rotación, no adivinado), borra la media Floor. `Rito360.isp` (proyecto real) no tenía piso — migración
  probada contra un `.isp` sintético construido para la ocasión (ver verificación abajo).
- **Fase B (no implementada a propósito en esta ronda — ver ROUND 222):** el wrap rotado de bordes
  suelo↔muros laterales/atrás en las costuras.
- **Verificación:** CDP contra el `.exe`/dev — ver sección de verificación más abajo en esta misma entrada de
  ronda (Beltrán: extender aquí con lo que falte tras probar en vivo).

## ROUND 216-218 — Decisiones resueltas + verificación de cierre de la auditoría

Beltrán delegó el criterio ("aplica todo"). Resuelto:

- **R216 · Lote 1**: toggle **Dome master / Patch** en el inspector para clips de nest en domo (expone
  `props.fulldome` con hint del modo activo — cierra la decisión del Size del nest: el modo Patch escala limpio
  para animaciones); `flashStatus('err')` con ⚠ + pill ámbar + 10s; **UI mínima de la cola de export** (lista de
  encolados con ✕ individual y Cancel queued).
- **R217 · Sala 360 como tercer tipo de "New sequence"**: `createRoomSequences(cfg)` extraída de
  `newRoomProject`; el diálogo crea walls+floor EN el proyecto actual (muros 2/3/4, preset por muro, toggle de
  piso, preview con el plan). Verificado proyecto MIXTO domo+sala+piso incluso tras guardar/reabrir.
- **Verificación de cierre**: segunda pasada de QA (27 ítems: todos OK o diseño intencional — p.ej. solapar
  clips = crossfade estilo Ableton) + **prueba de estrés tipo show**: 10 clips 4K simultáneos en domo 4096 →
  52-55 fps, export bajo carga estable, y el WATCH del render-ahead resuelto (la VRAM SÍ vuelve al apagar:
  6.6→5.8 GB). Único punto en observación: el control Full/½/¼ no mueve fps/VRAM cuando el cuello es el
  decode de N×4K (anotado en AUDITORIA-2026-07.md).
- **R218 · Bug nuevo del QA arreglado**: los overlays modales (tour, appAlert/appConfirm, export, colorPopup,
  vpMore — 6 sitios) instalaban `keydown` en captura sobre `document` con cleanup solo en su cierre propio: si
  el nodo moría por otra vía, el teclado quedaba muerto toda la sesión. Ahora cada handler se AUTO-SANA (guarda
  `isConnected` → se des-registra y no traga la tecla). + `job.label&&` en las 8 llamadas sin guarda de
  `runExport` (un job por API sin label producía mp4 de 0 bytes).

Quedan diferidos con justificación (ver informe): [D2] snapshot por job (el scrim lo hace inofensivo hoy),
refactors grandes, migración centralizada de `.isp`, timeline incremental 300+ clips, e indicador de horneado
al entrar al 3D de una sala pesada (observación menor).

## ROUND 215 — Code review de R214: 9 correcciones aplicadas

`/code-review` (8 revisores independientes) sobre R214 encontró regresiones reales; todas aplicadas y verificadas:

1. **`purgeMediaTrash` reescrita** (la grave): early-out real con trash vacío; CERO `JSON.parse` (extrae los
   `trashIds` del string del snapshot por regex dirigida + `clipsDelProyecto()` para clips vivos — antes parseaba
   hasta 250MB de undo/redo síncronos en CADA Ctrl+S); corre FUERA del try de escritura, solo tras éxito
   confirmado y con catch propio (antes un fallo del purge mostraba "Could not save" en un guardado exitoso);
   el branch web ya NO purga (la descarga no confirma escritura); `saveIncremental` también purga tras éxito.
   Medido: save real en ~9ms.
2. **"Effects" al sistema estándar de colapso**: `.sechead[data-sec="mfx"]` + `wireSecHeads`/`applySecCollapse`
   (antes: toggle reconstruía TODAS las tarjetas de efectos); `mfx` en los defaults de `insColState` y en el
   `secLbl` de `applyLang`.
3. **Aviso de códec por CSS** (`.exs-row.hintwrap` + `.exs-hint.wrap` con clamp de 3 líneas, fila `.span` a todo
   el ancho): sin estilos inline inalcanzables y el footer del diálogo ya no puede quedar fuera de pantalla.
4. **Hint de sala 360 correcto y honesto**: `MENU_ROOM_LABEL()` compartida entre el menú y el hint (sin drift),
   traducido de verdad y avisando que reemplaza el proyecto actual.
5. **Tooltips localizados**: `ttl()` para `#vzOut`/`#vzIn` y `#nestCacheToggle` (islas en inglés).
6. **Chips de automatización**: title = info + affordance ("… · Click to change"), escapado con `lchEsc`.
7. **`_exportCleanup`**: orden original restaurado (dims de glc ANTES de quitar la máscara [R2]) y sin el flag
   `dxt` (dxtFree es idempotente — el flag reconstruía la trampa que el refactor eliminaba).
8. **`lchAspect`** siempre bien formada (fallback `0:0` para w/h falsy; el comentario del tope vive en fmtAspect).
9. **COMPONENTS.md** al día con todo lo anterior.

## ROUND 214 — Etapas 3+4 de la auditoría: deuda preventiva + pulido UX

**Deuda (Etapa 3):** `_exportCleanup()` factoriza los dos bloques de limpieza duplicados de `runExport` (la
duplicación ya había causado un bug real; única diferencia real `dxtFree()`, parametrizada); `layoutWallStrip(walls)`
unifica el layout de tira triplicado (launcher / editar geometría / crear sala); `lchAspect` delega en `fmtAspect`
(borde unificado); `purgeMediaTrash()` en `saveProject` (barre el trash de medias no referenciadas por clips ni
por snapshots del stack de undo); `serProject` ya no escribe `tl.audioH` (vestigio R148); contratos nuevos
anotados en COMPONENTS.md.

**UX (Etapa 4):** el aviso de códec del Export hace wrap y lleva `title` completo (se truncaba justo en la parte
accionable); chips de automatización con `title` del device/parámetro completo; sección "Effects" del inspector al
patrón `.sechead` colapsable (estado en `insColState().mfx`); `title` en los botones de zoom del canvas; el diálogo
"New sequence" ahora dice dónde se crea una sala 360.

Todo verificado en vivo por CDP, incluido un export MP4 corto real ejercitando `_exportCleanup`. Con esto quedan
ejecutadas las 4 etapas del plan de `AUDITORIA-2026-07.md`; pendientes solo las "Decisiones para Beltrán" y la
verificación de cierre (segunda pasada de QA + prueba de estrés) anotadas en el informe.

## ROUND 213 — Etapa 2 de la auditoría: rendimiento que se siente

- **`_lutReg` acotado y liberable**: LRU de 16 con `gl.deleteTexture` al expulsar, `resetLutReg()` en
  new/open project, y recarga perezosa desde `bindClipLUT` si una LUT expulsada sigue asignada (degrada a
  identidad mientras carga). Cierra la fuga de VRAM sólo-crece.
- **NDI/Spout en reposo ya no recomponen ni leen la GPU**: clave `(playhead, _raGen, res)` — si el frame no
  cambió, se reenvía el buffer anterior y se salta composite+readPixels (en reproducción, igual que antes).
- **Drag de clips sin layout thrash**: rects de pistas cacheados al iniciar el drag (invalidación por scrollTop).
- **`drawScopes`**: buffer persistente + salto de `readPixels` cuando el frame no cambió.
- **VU-meter fantasma archivado** (`meters()` corría por frame contra `#mL`/`#mR` inexistentes desde R148) →
  `_backup/deprecated/20260730-vu-meters.js`.
- **`reconcileVinst` condicionado** por firma de ids (antes reconstruía un Set por cada `renderTimeline`).
- **Scratch `Float32Array(16)`** compartido en los 4 uploads de MVP por frame (domo, sala, equirect, visor).

Verificado por CDP (proyecto real, play, drag programático, `__errs` vacío, `glGetError()` 0). NDI/Spout
verificados por lectura (runtime no disponible en dev).

## ROUND 212 — Etapa 1 de la auditoría: integridad de datos y export

Primera etapa del plan de `AUDITORIA-2026-07.md`, ejecutada por 3 agentes Sonnet con verificación en vivo:

**Export cancelable de verdad (CRÍTICO del QA).** `exDeadline` ahora es un `Promise.race` de 3 vías (resultado ·
timeout `EX_AUDIO_MS` · poller de `cancelExport` a 200ms) que cubre fetch, decode y mezcla de audio; audio
indecodificable ⇒ el archivo se marca `m._exAudioBad`, avisa por `flashStatus` y el export SIGUE mudo (antes un
`EncodingError` se tragaba en silencio y el cuelgue real solo salía por consola). Verificado en vivo: cancelación
efectiva en 242ms (antes >7 min), export con audio roto completa avisando, regresión con audio sano limpia.

**Integridad (app.js):** atajos bloqueados mientras el panel de export existe (el guard ahora mira `#exOv`, no
solo `.overlay` — Ctrl+Z durante un export corrompía el resultado); autoguardado en pausa durante `exporting`
(render-in-place dejaba `state.clips` truncado y el autosave lo persistía); `saveIncremental` chequea el
resultado de `DSP.writeText` (antes confirmaba "Saved" aunque fallara); el `alert()` nativo de `webglcontextlost`
→ `appAlert` (el único nativo del archivo, y era el aviso más crítico); Ctrl+Z recupera media borrado aunque
ningún clip lo use (`pushUndo([m.id])` + trashIds en el snapshot); **nest a pista de VIDEO** (caía en `used[0]` —
con audio enlazado era una pista de audio y `activeClips()` lo excluía: nest invisible, LA sospecha histórica);
`switchSeq()` llama `projTitle()`.

**Electron (main.js/preload.js):** `_fds` se cierran si el renderer muere (un crash a mitad de export dejaba el
.mp4 bloqueado en Windows); `uncaughtException`/`unhandledRejection` con log a DIAG (antes tumbaban el main en
silencio); `dsp:powerSave` con conteo de referencias + `DSP.powerSave` en export/NDI/Spout (Windows ya no puede
suspender a mitad de render o de show); guard de reentrada en `unresponsive` + listener `responsive`; DIAG_LOG
rota a los 5MB.

## ROUND 211 — Sala 360: geometría en su sitio + suelo dockeado (cubo desenvuelto)

Cuatro arreglos pedidos por Beltrán tras revisar el landing y el editor de la sala, verificados uno a uno
con capturas por CDP:

1. **Rótulos de muros del 3D siempre legibles.** El decal afín pintado SOBRE el plano del muro se leía en
   espejo desde fuera (la cámara orbita por fuera y el texto estaba pensado para leerse desde dentro).
   Ahora `drawRoomLabels3D` los pinta en ESPACIO DE PANTALLA (horizontales, con el mismo patrón de fondo
   oscuro que los del domo), anclados al centro proyectado de cada muro. `labelWallFrac` ([R201]) quedó sin
   uso y se eliminó.
2. **Plano con Front ARRIBA.** La planta (`drawRoomIso`) ponía Front abajo ("standing inside"). Ahora Front
   arriba, Back abajo, y el eje X en el sentido que dibujó Beltrán: Right a la derecha, Left a la izquierda.
   Cuatro puntos acoplados (PP, cajaTinta, y los dos offsets de rótulos).
3. **La geometría de la sala envolvía EN ESPEJO.** El lazo de `roomPlan` colocaba Right en x+ — al mirar
   Front desde dentro, Right caía a la IZQUIERDA. Cambio quirúrgico del mapa `E` (Right↔Left de lado, con
   los anchos wR/wL intercambiados en las esquinas traseras): la tira 2D no cambia (x0/x1 intactos), los
   UVs de `buildRoomGeo` y el `fuv` del suelo quedan válidos (verificado por derivación), y plano + 3D + iso
   se corrigen solos. Cámara 3D por defecto detrás de Back (`yaw:1.99`, en `lchInit.roomCam` y al crear en
   `newRoomProject`): FRONT al fondo/arriba, calza con el plano en los cuatro muros.
4. **Suelo dockeado bajo Front en el canvas 2D** (cubo de papel desenvuelto, pedido explícito). Display-only,
   sin tocar compositing/export/mapeo de clics: `drawRoomFloorDock2D` dibuja la textura del suelo
   (`compositeFloorTex`) con el MISMO programa PB y los uniforms pan/zoom/aspect ya seteados, en un quad
   propio bajo el span de Front (uvsc.y negativo = flip vertical del desplegado; bisagra = borde con Front).
   `drawRoomGrid2D` pinta contorno + retícula + rótulo FLOOR (también sin textura, p.ej. el landing).
   Encuadre por defecto tira+suelo centrados (pan/zoom en `newRoomProject` y en `lchEditorShot` para el
   panel del launcher — el pan ya participa en blit/overlay/ratón, así que el mapeo de clics no se toca).

Ejecución: Fable planificó/derivó; dos agentes Sonnet ejecutaron los bloques 1-2 y 4; el 3 y los encuadres
los aplicó Fable directo por ser cambios acoplados de pocas líneas.

## ROUND 207b — Cerrado el pendiente de R207: `npmRebuild: false` también vale en Windows

R207 dejó anotado que faltaba comprobar, en una máquina Windows, que `dist:win` sigue empaquetando un NDI
funcional sin el paso de recompilación. Hecho.

Para que la prueba valiera había que forzar la situación real: los `.node` que había en disco venían de
recompilaciones anteriores **contra Electron**, así que habrían cargado igual y la prueba no habría demostrado
nada. Se recompilaron primero contra **Node** (`npm rebuild`), que es exactamente lo que deja un `npm install`
limpio en una máquina nueva — si la ABI no fuese estable, ahí es donde se rompe.

Compilado el `.exe` (`skipped dependencies rebuild reason=npmRebuild is set to false`) y probado **el paquete
recién hecho, antes de tocar las instalaciones**: el addon de Spout carga —y como Spout no necesita ningún
runtime externo, que su `available()` sea `true` prueba que el `.node` se cargó dentro de Electron—, el de NDI
también, sin error de carga, y `findSources()` devuelve **una fuente real**: eso ejerce la API nativa, no una
bandera. Motor WebGL vivo y consola limpia.

Conclusión: la estabilidad de ABI de N-API se sostiene en los dos sistemas y la clave se queda como está, sin
excepción para Windows. Anotado en el propio `package.json`, que era donde vivía el aviso.

## ROUND 210 — El recorrido guiado sale en CADA proyecto nuevo (y en ninguno abierto)

Beltrán usa el recorrido como **presentación del programa**, así que lo quiere siempre que se crea un proyecto —
domo, 2D o sala— y nunca al abrir uno guardado o un reciente, que es cuando estorba.

Había dos cosas mal. Una, el recorrido estaba **capado a la primera vez de cada formato** por tres banderas de
localStorage (`dspTour_dome/flat/room`): la segunda vez que creabas un domo ya no salía, así que como
presentación no servía. Dos, el disparador vivía en `lchCreate()`, o sea **sólo en el launcher**: crear desde
**File → New dome/2D/360 project…** no lo lanzaba nunca. Dos formas de crear lo mismo con comportamientos
distintos.

Ahora hay un disparador ÚNICO —`tourTrasCrear(fmt)`— al final de `newProject` y `newRoomProject`, que es
exactamente lo que significa «proyecto nuevo»: por ahí pasan el launcher, el menú File y Ctrl/Cmd+N. Y por
construcción NO puede salir al abrir: ese camino es `openProjectPath`→`loadProject` y no toca esas funciones.
Tampoco salta si `confirmDiscard()` cancela la creación, porque el disparo va después de ese `return`.

Se fueron además **las banderas y sus seis funciones** (`dspOnboardV1`, `dspTour_*`, `onboardDone`,
`setOnboardDone`, `tourHecho`, `setTourHecho`): saliendo siempre, ya nadie las leía — y `onboardDone()` llevaba
sin lectores desde R178, cuando el arranque de primera vez con escena de demostración dejó su sitio al launcher.
Escribir una bandera que nadie consulta es la clase de resto que después nadie se atreve a tocar. Si algún día se
quiere un «no volver a mostrar», el sitio es ese disparador, no seis funciones repartidas.

Verificados los ocho casos en la app corriendo, con las banderas viejas puestas a mano en `1` para que un gate
superviviente se hubiera notado: (1) domo desde el launcher ✓, (2) **segundo** domo seguido ✓ —lo que antes
fallaba—, (3) 2D por menú ✓ y (4) sala 360 ✓, cada uno con su texto propio («Your fulldome project is…», «Your
2D composition is…», «Your 360 room is…»); (5) abrir un `.isp` guardado → no sale, (6) abrir un reciente → no
sale (la tarjeta de recientes llama a `openProjectPath`, el mismo camino), (7) cancelar la creación en el aviso
de cambios sin guardar → no sale, (8) Ctrl/Cmd+N → sale, en domo.

## ROUND 209 — La app abre en la pantalla desde donde la abriste (y un crash latente menos)

Trabajando con un monitor externo, Beltrán abría la app desde una pantalla y el splash aparecía en la otra; luego
la ventana principal aparecía en una tercera combinación. Las dos ventanas se centraban en la pantalla
**PRIMARIA** (`getPrimaryDisplay()` para medir + `center:true` para colocar), que con varios monitores no tiene
por qué ser donde está el usuario — y como cada ventana resolvía su tamaño y su centro por separado, ni siquiera
coincidían entre ellas.

Ahora hay una «pantalla de lanzamiento»: la que contiene el **cursor** en el momento de abrir, que es donde
ocurrió el clic (Dock, Finder, acceso directo). `launchDisplay()` la resuelve y la **cachea**, para que splash y
principal caigan en la MISMA aunque el ratón se mueva durante los segundos de arranque; `centerOnLaunch()` las
centra en su `workArea` (respeta la barra de menús y el Dock). La principal se posiciona al crearse, antes de que
`finishBoot()` la muestre, así que no hay salto visible.

De paso salió un crash latente que apareció durante estas pruebas: **«A JavaScript error occurred in the main
process — TypeError: Object has been destroyed»** en el guardián de instancia única. `second-instance` comprobaba
`if (win)` y llamaba a `win.isMinimized()`, pero un proceso principal puede sobrevivir a su ventana (en macOS es
lo normal: `window-all-closed` no cierra la app) — entonces `win` no es null, está DESTRUIDO. Se lanzaba al abrir
la app estando ya viva sin ventana. Ahora `second-instance` y `open-file` exigen `!isDestroyed()` en la ventana y
en su `webContents`, y si no hay ventana viva el path del proyecto se guarda en `pendingOpenPath` en vez de
perderse — que era el segundo bug escondido detrás del primero.

Verificado en la app corriendo: splash y principal caen en la misma pantalla y centradas en ella (splash x=724 en
1920 → (1920−473)/2 ✓; principal x=160 → (1920−1600)/2 ✓); en otro arranque, con el cursor en el portátil, la
principal cayó en la pantalla de coordenadas −1512, que NO es la primaria — o sea, sigue al cursor de verdad.
Arranque sin una sola línea en stderr tras el arreglo del guardián.

## ROUND 208 — La rueda del pulgar del MX Master panea el timeline

Beltrán trabaja con un Logitech MX Master 3S, cuya rueda lateral manda scroll horizontal (`deltaX` puro en el
evento `wheel`). Sobre el timeline no hacía nada, y no por accidente pequeño: `#tlscroll` va con **overflow-x
hidden** —su barra horizontal es la custom `#tlZoomBar`— así que el navegador no panea con deltaX por su cuenta,
y el handler de rueda (R152) sólo contemplaba Ctrl (zoom), Alt (alto de pistas) y Shift (pan con deltaY).

Ahora hay una rama más: **gesto de eje horizontal dominante (`|deltaX| > |deltaY|`) = pan horizontal**, tanto
sobre los clips como sobre la columna de nombres de pista. Se decide por eje dominante a propósito: un trackpad
scrolleando en vertical mete siempre unos píxeles de deltaX de ruido, y con un umbral simple (`if deltaX`) ese
ruido habría secuestrado el scroll vertical nativo y su inercia. De paso salió un arreglo real de la rama Shift:
**macOS convierte Shift+rueda vertical en deltaX ya desde el sistema** (deltaY llega a 0), así que en Mac esa
rama no hacía nada; ahora suma ambos deltas (`deltaY||deltaX`) y funciona en los dos sistemas.

Verificado por CDP con eventos de rueda reales sobre la app corriendo: pulgar adelante/atrás panea (0→600→240px)
sobre clips y sobre headers; la rueda vertical sigue nativa; un diagonal con vertical dominante NO mueve el
horizontal; Shift+rueda al estilo macOS panea; Cmd+rueda sigue haciendo zoom (80→125 px/s); consola limpia.
También aplica al trackpad a dos dedos, que manda el mismo deltaX.

## ROUND 207 — El .dmg sale: `npmRebuild: false` (y la puesta en marcha en el Mac, verificada entera)

Primera sesión en el Mac de verdad (Apple Silicon, el de Vicente). La promesa de R203 se cumplió casi entera:
`npm install` limpio y sin Xcode, el editor abre, el domo pinta y orbita en 3D, el 2D y la sala 360 pintan
(tira de muros y visor 3D incluidos), los atajos de R206 responden con Cmd —incluido que Cmd+R renombra y NO
recarga, y que Cmd+C/V dentro de un campo de texto copian texto y no clips—, y el reenlazado de R204 abre un
proyecto con rutas `C:\…` reenganchando los medios por nombre junto al `.isp` (carpeta y subcarpeta), con su
aviso «N media re-linked next to the project».

Lo que NO se cumplía era el empaquetado: `npm run dist:mac` moría antes de empaquetar nada. El paso
`@electron/rebuild` de electron-builder **no respeta el `os: win32`** de los addons `file:` — npm los enlaza en
`node_modules` aunque no los compile, y el rebuild los recorre e intenta compilar `native/ndi-send` en macOS:
`ndi.cc` no compila ahí (napi.h aborta sin `NODE_ADDON_API_*_EXCEPTIONS`) y, de propina, node-gyp revienta con
espacios en la ruta («Immersive Studio Pro»). Verificado que no era cosa del espacio: en ruta limpia falla igual.

El arreglo es una clave: **`npmRebuild: false`** en el bloque `build`. No hay nada legítimo que recompilar —
cero deps npm de runtime (mp4-muxer es archivo local) y los addons usan node-addon-api (N-API, ABI estable), así
que el `.node` que compila `npm install` en Windows vale tal cual para el asar. Con la clave puesta: el `.dmg` y
el `.zip` salen, la app empaquetada arranca y carga el editor desde el asar, y quedó instalada en
`/Applications` abriendo sin avisos de Gatekeeper (compilada en el propio Mac, sin marca de cuarentena — como
documenta `docs/MACOS.md`).

Medido de paso en esta máquina, para la duda de R203 sobre el tope de H.264: **VideoToolbox topa antes que
NVENC** — H.264 cuadrado máximo ~3072² (límite práctico del nivel 5.2; 4096² no está ni por software), y el
panel de export ya lo etiqueta solo («max 3072 × 3072 here»). HEVC llega a 4096² por hardware y a 8192×1080 en
rectangular. Export real verificado: 4 s a 4096² HEVC, 120 frames por VideoToolbox, ffprobe conforme. La regla
de siempre sigue valiendo aquí: 4K cuadrado = HEVC o PNG-seq.

⚠️ Pendiente de la próxima máquina Windows: re-verificar que `dist:win` empaqueta un NDI funcional con
`npmRebuild: false` (debería — el asar ya empaqueta el `.node` pre-compilado de `node_modules/dsp-ndi-send` —
pero no está comprobado en máquina). Si fallara, quitar la clave sólo para `dist:win`. También va en este commit
el `package-lock.json` sincronizado con R203 (addons como `optionalDependencies` con `os: win32`), que estaba
desfasado. Menor, visto en consola: un MP4 sin pista de audio dispara un `unhandledrejection` de
`decodeAudioData` en la miniatura de onda (app.js:2166, falta el guard `.catch` que sí tiene la 5665); no es
específico de Mac y no afecta a nada funcional.

## ROUND 206 — Los atajos, iguales en Mac: Cmd hace lo que hace Ctrl

Beltrán preguntó si Ctrl+T y Ctrl+D funcionarían con Command, y pidió lo **más simple** que no le hiciera perder
ningún comando ni trabajo. Lo más simple resultó ser **no cambiar ni un atajo**: el manejador de teclado ya mira
`ctrlKey || metaKey`, y no hay ni un `ctrlKey` suelto en todo el archivo. Así que Command ya hacía lo mismo.

El obstáculo estaba en otro sitio. El programa llama a `win.removeMenu()` para quitarse el menú nativo, y eso
vale en Windows pero **en macOS no hace nada**: allí el menú es de la aplicación, no de la ventana. Electron
habría instalado el suyo por defecto, y los atajos de un menú nativo se atienden **antes** de que la tecla llegue
a la página. El choque grave era **Cmd+R = Recargar**: en un programa que guarda el proyecto en memoria, eso es
perder el trabajo sin guardar, y está a una tecla del Cmd+T que él va a usar. Además Cmd+Z, Cmd+C, Cmd+V y Cmd+A
habrían quedado capturados por los papeles del menú Edición —que sólo actúan sobre campos de texto—, dejando
muertos el deshacer y el copiar/pegar de clips.

Ahora hay un menú propio para macOS: **Aplicación** y **Ventana** estándar, para que Cmd+Q, Cmd+M y Cmd+W sean lo
que un Mac espera, y **sin menú Ver**, que es donde vivían Recargar y el zoom. El menú **Edición** se queda —en
macOS hace falta para que copiar y pegar funcionen dentro de los campos de texto— pero sus entradas **no usan los
papeles del sistema**: reenvían la orden a la página, que decide según dónde esté el foco. En un campo de texto,
edición nativa; en cualquier otro sitio, **se sintetiza la misma pulsación que en Windows**.

Ese último detalle es deliberado: sintetizar la tecla en vez de llamar a `undo()` o `copyClip()` directamente deja
**una sola lógica de atajos**. El manejador ya sabe distinguir los casos con matiz —copiar puntos de automatización
frente a copiar un clip, Cmd+A sobre una pista de automatización— y así no hay una segunda versión que pueda
desincronizarse cuando se toque la primera.

Verificado lo verificable desde Windows: Cmd solo (sin Ctrl) duplica un clip y crea una pista; el enrutado del
menú toma copiar, pegar y deshacer —y los ejecuta de verdad: el clip se pega y el deshacer lo quita— mientras que
Cortar, que no tiene atajo propio, cae al sistema como debe; y con el foco en un campo de texto la orden se manda
a la edición nativa. En Windows nada de esto se activa: el puente está expuesto pero nadie emite la orden.
**El menú en sí sólo se puede ver en un Mac.**

## ROUND 205b — Los cuatro hallazgos de la revisión sobre R205

**Sólo había arreglado el vídeo.** Audio e imagen seguían resolviendo antes de leer el archivo, así que reemplazar
un **audio en bucle** por otro de distinta duración no reajustaba nada: la reconciliación comparaba la duración
vieja consigo misma y se iba de largo. Exactamente el fallo que R205 venía a quitar, sin quitar para audio.

**El deshacer descuadraba, y esto es lo más importante de los cuatro.** El sistema de deshacer guarda sólo los
clips de la secuencia activa, y **nunca la lista de medios**: cambiar el archivo de un medio no fue reversible
jamás. Antes daba igual, porque el reemplazo no tocaba los clips. Con R205 sí los tocaba, así que un Ctrl+Z
devolvía los bucles al material viejo dejando el archivo nuevo puesto — peor que no deshacer nada. Ya no se apila
punto de deshacer: la forma de recuperarse de un reemplazo equivocado es **volver a reemplazar**, que reajusta
igual de bien porque la reconciliación siempre es relativa a la duración actual. Y si el medio se usa en otras
secuencias, ahora se pregunta antes y se nombran, con el mismo criterio que ya usaba borrar un medio.

**El plazo de espera resolvía en silencio.** Si el archivo tardaba más de quince segundos en leerse —y este mismo
código documenta lecturas de más de ocho en disco frío o en red— se anunciaba «reemplazado» con la duración vieja
y sin un solo bucle reajustado, sin nada que explicara por qué.

**Y un archivo ilegible se anunciaba como éxito**, dejando el medio desvinculado y el proyecto apuntando a algo que
no abre. Ahora se revierte al archivo anterior y se avisa.

Verificado en la app: un audio de 5 s en bucle reemplazado por uno de 3 s pasa a durar 3 y su ciclo también; un
archivo con basura dentro revierte, avisa y deja el medio sano; la pila de deshacer se queda igual que estaba; y
la pregunta entre secuencias nombra la otra secuencia, menciona el Ctrl+Z y al cancelar no toca nada. Del plazo de
espera se ejercitó la vía de fallo —la comparte con el archivo ilegible—; lo único no ejercitado es el temporizador
de quince segundos en sí.

## ROUND 205 — Reemplazar un medio por su upscale sin romper los bucles

Beltrán preguntó algo muy concreto: va a poner clips en bucle, y después va a reemplazar cada medio por su propio
upscale, que durará un poco más o un poco menos. ¿Sigue funcionando el bucle? Sí — el bucle vive en el clip, no en
el medio. Pero al mirarlo aparecieron **tres cosas rotas**, y las tres en ese mismo camino.

**La duración del vídeo no se refrescaba nunca.** Se leía una sola vez, al importar. Al recargar el archivo se
actualizaban el ancho, el alto y los fotogramas por segundo, pero no la duración, así que tras un reemplazo el
medio seguía creyendo que duraba lo que duraba el anterior. Con eso, el límite de recorte miente y el bucle se
captura de una duración falsa. La pista de que esto venía a medias estaba a la vista: la función de reemplazo
guardaba la duración anterior en una variable **y no la usaba**.

**La recarga de un vídeo no se podía esperar.** Registraba el oyente de metadatos y volvía en el acto, de modo que
quien hacía `await` seguía adelante antes de que el archivo se hubiera leído. Ahora devuelve una promesa de
verdad, con un plazo por si el archivo no emite ningún evento.

**Y los bucles no se reajustaban.** Seguían cortando por donde cortaba el material viejo: con uno más corto, el
último fotograma se congela en cada vuelta; con uno más largo, la cola nueva no se ve nunca.

La regla que los cuadra distingue dos intenciones, que es lo que hace que esto sea útil y no una chapuza: si el
ciclo abarcaba **todo** el material —lo normal al activar Loop sin más— se reescala a la duración nueva; si era un
**trozo elegido a mano**, se respeta, porque en un upscale del mismo clip ese trozo sigue estando en el mismo
sitio. Los clips sin bucle no se tocan: recortarlos por mi cuenta cambiaría el montaje, así que se cuentan y se
avisan en el mensaje final.

Verificado con dos vídeos reales fabricados por el propio exportador del programa —6 y 4 segundos— y tres clips:
uno con el bucle entero, otro con un ciclo de 2 s elegido a mano y otro sin bucle. Reemplazando 6→4 y luego 4→6,
la duración sigue al archivo, el ciclo entero se reescala y el trozo de 2 s queda intacto. Con el camino antiguo,
el ciclo se queda en 6 segundos aunque el material dure 4.

**Y una lección que ya estaba en mi memoria y se me pasó igual:** `DSP` viaja **congelado** por `contextBridge`,
así que sustituirle `pickMedia` desde el arnés no surte ningún efecto — el diálogo de archivo se abrió de verdad y
la prueba se quedó esperando a que alguien pulsara. La salida no es copiar el cuerpo de la función en el arnés
(así se escriben pruebas que aprueban lo que no deben), sino darle a la función una entrada por ruta y ejercitar
**la de verdad**.

## ROUND 204 — Rutas que valen en los dos sistemas, y proyectos que se pueden mudar

Salió de una pregunta de Beltrán: si se lleva la carpeta del proyecto al Mac, ¿se abrirá todo bien? Revisándolo
aparecieron dos cosas, una fea y otra útil.

**La fea: una docena de sitios unían rutas con la barra invertida de Windows escrita a mano.** Partir una ruta ya
valía en los dos sistemas —siempre se busca `\` y `/` y se coge el último—, pero unirlas no. En macOS eso **no
falla**, y ahí está el peligro: crea archivos y carpetas con una barra invertida **dentro del nombre**, colgando un
nivel por encima de donde debían ir. El resultado habría sido que los proxies no se reenganchan y la carpeta de
autoguardado aparece donde no toca, sin un solo mensaje de error que lo delatara. Afectaba a proxies,
autoguardado y render en el sitio. Ahora hay un ayudante que usa el separador del sistema; en Windows produce
exactamente la misma cadena que antes, así que allí el cambio no cambia nada.

**La útil: mover la carpeta de un proyecto ya no rompe los enlaces.** El `.isp` guarda rutas absolutas, así que
moverlo —a otro disco, a otro equipo, de Windows al Mac— dejaba todos los medios en rojo aunque los archivos
viajaran al lado. Ahora, cuando un archivo no está en su ruta, **se busca por nombre junto al proyecto** antes de
darlo por ausente: la carpeta del `.isp` y un nivel de subcarpetas, que cubre los `assets/` o `material/` de
siempre sin ponerse a recorrer un disco entero. El índice se arma una vez por proyecto, no una por medio.

No se marca el proyecto como modificado al reparar: si se guarda, las rutas nuevas quedan fijadas; si no, la
siguiente apertura las resuelve igual. Por no guardar no se pierde nada, y así no aparece un falso «cambios sin
guardar» cada vez que se abre.

Un detalle de tiempos que costó ver: el aviso de «N medios reenlazados» tiene que ir con retardo, porque
`loadProject` lanza todas las recargas **sin esperarlas** — en el punto donde termina no hay todavía nada
reparado y cualquier recuento allí da cero.

Verificado moviendo de verdad un proyecto con sus medios a otra carpeta, con un archivo en la raíz y otro en una
subcarpeta, borrando los originales para que la ruta vieja fuera imposible: se abre con **cero ausentes**, las
rutas reescritas y los clips intactos. Control contra el `.exe` de R203: allí quedan **los dos ausentes**.

## ROUND 203 — El proyecto compila también para macOS (un solo repo)

Beltrán quiere trabajar desde su Mac. Al abrir el capó resultó que el terreno estaba bastante limpio: `main.js` ya
protegía el ajuste de GPU por registro con `platform!=='win32'`, ya trataba `darwin` al cerrar ventanas y **ya
tenía el `app.on('open-file')`** que es la vía de macOS para abrir un archivo con doble clic; el medidor de GPU se
apaga solo sin `nvidia-smi`; los dos puentes nativos se cargan en `try/catch`; y no hay rutas de Windows a mano.

Lo que faltaba era el empaquetado.

**Los addons nativos pasan a opcionales y marcados `os: win32`.** Spout es DirectX y sus fuentes no compilan fuera
de Windows, así que un `npm install` en Mac reventaba entero. Ahora npm ni lo intenta. El de NDI compila, pero su
cargador sólo tiene rama Windows, así que compilarlo en Mac serviría únicamente para exigir Xcode a cambio de
nada. Con esto, **poner en marcha el proyecto en un Mac no necesita compilador**: sólo Node y Git.

**Bloque `mac` y scripts por sistema.** `npm run dist` sigue siendo Windows —el ritual de despliegue no cambia— y
se añaden `dist:win` y `dist:mac`. Sin `arch`: sale para la del equipo que compile. Sin firma de Developer ID,
porque para uso propio no hace falta: la marca de cuarentena que dispara Gatekeeper la pone la descarga, no la
compilación, y una app que compilas en tu propio Mac no la lleva.

**Un solo repo.** El mismo código en los dos sistemas y la compilación decide qué lleva cada uno. Duplicar el
proyecto por plataforma es cómo se acaba con dos versiones que nadie sabe cuál es cuál.

Una cosa que sólo se descubre compilando: **electron-builder valida el objeto `build` contra un esquema y aborta
con cualquier clave que no reconozca**, así que los comentarios `_comment_*` tuvieron que salirse de ahí. Lo cazó
el primer `npm run dist`, no el razonamiento.

Verificado lo que se puede verificar desde Windows: el build de Windows sale **idéntico** —los dos addons se
recompilan y los dos `.node` siguen en `app.asar.unpacked`— y el bloque `mac` es válido de esquema, porque
electron-builder valida la configuración entera antes de mirar la plataforma. **Lo que NO puedo probar desde aquí
es el build de Mac**: eso sólo se ejecuta en un Mac. Guía para esa parte en `docs/MACOS.md`.

## ROUND 202 — «Flat tile» en la configuración del relleno de domo (tanda 5)

Lo primero que apareció al abrir el capó: **el modo ya existía**. Se llama `noWarp` y entró en la ronda 123, pero
sólo se alcanzaba desde el inspector de una composición **ya creada**. Al crearla no había forma de pedirlo, así
que en la práctica casi nadie llegaba a él. Ahora está donde tiene que estar: en la configuración del relleno de
domo, y sólo ahí (en anillo no aparece, que no le corresponde).

**La vista previa tenía que enterarse.** Dibujaba sectores curvados para el relleno de domo pasara lo que pasara,
así que enseñaba lo contrario de lo que estabas eligiendo justo en el momento de elegirlo.

Qué hace: cada baldosa se coloca **sin estirarse** hasta llenar su celda, así que conserva su proporción real —lo
que la curva es la propia proyección del ojo de pez, no un estiramiento— y los anillos se repiten hacia arriba y
hacia abajo. Comparadas las dos capturas del máster, la diferencia es la que describía Beltrán: con sectores el
domo es un disco continuo donde el rectángulo original es irreconocible; con baldosa plana se ven los rectángulos,
cada uno con su proporción, en tres anillos de ocho.

**Dos veces tuve que rehacer la comprobación, y las dos por lo mismo.** Primero di por deformados clips que no lo
estaban: miraba `secAz`, que queda de relleno sin efecto, cuando lo único que activa la deformación es
`warp==='dome'`. Y después la prueba de la vista previa daba «correcto» **también contra el build viejo** —
comparaba las dos imágenes píxel a píxel, y allí también salen distintas porque sin `secAz` los sectores se dibujan
más estrechos, o sea que cambiaban sin que la opción hiciera nada. La medida buena es cuánto del **borde** del
disco queda cubierto: 100% con sectores, 35,7% en el build viejo, 12,7% con baldosas. Ahí sí separa.

## ROUND 201 — El rótulo de cada muro, del mismo tamaño en el 3D que en el lienzo

Pedido de Beltrán: que FRONT, LEFT y compañía ocupen en el visor 3D lo mismo que ocupan en el lienzo, respecto a
su muro. En el 3D eran el 3% del alto del muro, un número fijo; en el lienzo salían al 9,3%, más de tres veces
mayores. De ahí que en el landing, con los dos paneles uno encima del otro, cantara tanto.

Y no valía cambiar el 3% por un 9,3%. En el lienzo el rótulo es un tamaño **fijo de pantalla** —11 píxeles, porque
es una guía superpuesta— sobre un muro que sí escala, así que la proporción depende del tamaño del panel y del
zoom: medida, va del 3,9% al 16,4%. Un número fijo acertaría en un sitio y fallaría en los demás. Así que el 3D
calcula la proporción con la misma regla que usa el 2D para encajar la tira, y le sale la que toque en cada caso.

Comprobado a cuatro tamaños de panel —el del landing, el del editor, uno estrecho y otro con el zoom al doble—
midiendo la proporción real por un camino distinto del que usa el cálculo: coinciden en los cuatro dentro del 2%.

**Un detalle que ahora se ve y antes no:** el rótulo va pintado en la cara interior del muro, así que el muro que
tienes delante —que se ve desde fuera y translúcido— lo muestra espejado, como el letrero de un escaparate visto
desde la calle. Es correcto, pero con el rótulo tres veces mayor se lee. Si prefieres que se lean todos del
derecho, se voltea el que se vea por detrás.

## ROUND 200b — Los dos fallos de la revisión de código sobre R200

**Un preajuste guardado antes de R200 rompía las orientaciones.** Al aplicarlo, el reparto de los roles que quedan
fuera de juego se calculaba a partir de lo que traía el preajuste, y los de R199 y anteriores no guardan la
orientación de cada muro. Con la lista vacía, los cuatro roles contaban como sobrantes y se reetiquetaban los muros
inactivos con roles que los activos ya tenían: dos muros mirando al mismo sitio y, al subir la cuenta a cuatro, un
muro del preajuste desaparecía en silencio. Ahora el reparto se calcula sobre las orientaciones **reales** de los
muros ya aplicados, con lo que da igual si el preajuste las trae o no.

**Guardar un preajuste dejaba el piso clavado.** El pixelaje del piso se guardaba siempre, incluso cuando estaba en
automático —siguiendo a los muros—, porque la función que lo calcula devuelve un valor de todos modos. Al
recuperarlo, ese valor pasaba a ser una elección manual y el piso dejaba de seguir a los muros, sin forma de
devolverlo. Justo lo contrario de la regla que pusimos en R198. Ahora sólo se guarda si estaba puesto a mano; el
automático se recalcula solo, que para eso van los muros en el preajuste.

Y una lección sobre el arnés: **la primera comprobación del piso no valía**. Replicaba en el propio arnés el cuerpo
de la función de guardado en vez de llamarla, así que las dos ejecuciones —la arreglada y el control— ejercitaban
el mismo código nuevo y las dos daban «correcto». Reescrita para llamar a la función de verdad (cortocircuitando
el diálogo de nombre), el control falla como debe. Es la cuarta vez que un arnés que se mide a sí mismo me dice que
todo está bien: **si la prueba no falla contra el código viejo, la prueba no vale**.

## ROUND 200 — Cinco ajustes de Beltrán sobre el landing

**El desplegable de orientación de los muros no abría nada.** Sí abría: nacía **detrás** del landing. El menú se
dibuja en la capa 60 y la pantalla de inicio está en la 300, así que aparecía tapado. Un menú contextual es
siempre lo más alto —es transitorio y sale de algo que ya está debajo—, de modo que pasa por encima de cualquier
capa, incluidos los diálogos.

**El lienzo cosido, en negro**, como los dos visores de arriba. Es un viewport, no un panel de datos, y en gris no
se distinguía dónde acaba el máster.

**El preajuste guarda la sala entera:** cada muro con su orientación, sus medidas y su pixelaje, y el piso con el
suyo. Antes sólo iban los cuatro números de cada muro, así que al recuperarlo se perdían las orientaciones y el
piso — justo lo que distingue una sala montada de otra. Las medidas del piso no se guardan porque no son suyas:
salen de la huella de los muros, y se recalculan solas.

**Los dos visores 3D se giran y se acercan.** El de la sala ya lo hacía desde R198; ahora también el del domo, con
el mismo mecanismo.

**En la sala, la planta pasa a la izquierda y el 3D a la derecha:** primero el plano —lo acotado, con lo que se
trabaja— y luego cómo queda.

Los cinco, comprobados en la app contra el `.exe` de R199 como control, que es lo que hace que la medida valga:
allí el menú daba «visible de verdad: no» (el síntoma exacto), los paneles salían al revés, el lienzo cosido medía
gris (17,17,17), el domo 3D no tenía panel arrastrable y el preajuste perdía el piso. En R200, los cinco correctos
y sin errores de consola.

## ROUND 199 — La geometría de la sala sale de las medidas (tanda 4)

Beltrán lo dejó claro antes de empezar: **no quiere fijar los ángulos a mano**. Salen de las medidas, y ya está.

**Cada muro mide lo suyo.** Un cuadrilátero con los cuatro lados dados no tiene una sola forma —es una cadena de
cuatro barras, le queda un grado de libertad—, y el código anterior lo resolvía por la vía rápida: dibujaba los dos
laterales con la MEDIA de sus anchos. Un muro izquierdo de 400 y uno derecho de 600 salían los dos de 500, la sala
quedaba siempre simétrica y las medidas de dos de los cuatro muros no servían para nada. Ahora ese grado de
libertad se fija repartiendo la inclinación por igual entre los dos laterales, que es la única forma simétrica de
repartirlo, y cada muro mide exactamente lo que se ha escrito.

**Dos muros dan una L y tres una U, se elijan las orientaciones que se elijan.** Las formas estaban escritas para
una combinación concreta —izquierda, frente y derecha, que es la que reparte el diálogo—, así que desde la pantalla
de inicio, que reparte frente, derecha y fondo, dos y tres muros caían a un salvavidas que los colocaba **a 120
grados**: ni L ni U, una figura que no era ninguna sala. Ahora el muro que falta toma la medida de su opuesto y se
dibujan sólo los que existen, con lo que salen la L, la U y hasta el pasillo de dos muros enfrentados en cualquier
orientación. Y de paso el reparto de la pantalla de inicio pasa a ser el mismo del diálogo, para que tres muros
sean la U de siempre y no una U tumbada de lado.

**Si las medidas no cierran ninguna sala, se dice.** Un fondo de 5000 con un frente de 800 y laterales de 500 no
cierra nada. Antes se dibujaba en silencio una sala con el fondo cambiado, que es como un error de medición llega
hasta el montaje. Ahora se dibuja la forma sana y se avisa en la planta.

**La planta ya no se corta.** Se ajustaba reservando un margen fijo para los rótulos y confiando en que cupieran.
Ahora se mide la caja de todo lo que se va a dibujar, rótulos incluidos, y se encoge hasta que entra; y se centra
por esa caja, así que queda centrada de verdad y no el polígono centrado con los rótulos colgando.

Comprobado con dos arneses, los dos validados antes de creérselos. La geometría, en aislado, sobre dieciséis salas:
todas respetan la medida de cada muro al medio centímetro, y el cuadrado, el rectángulo, el trapecio y la U de
antes salen **idénticos al milímetro** — o sea que lo que funcionaba no se ha movido. El recorte, contra el `.exe`
de R198 como control: **ahí sí se salía del lienzo** con dos y tres muros, y con dos muros dibujaba una figura de
9.128 píxeles de tinta (la de 120 grados). En R199, cero en los ocho casos, incluidas salas de 2000×300 cm y
medidas de cinco cifras.

## ROUND 198 — Landing: los cuatro puntos que quedaban (tanda 3 cerrada)

**La línea de borde del domo ya sigue al ángulo.** El contorno del borde en el 3D se dibujaba a 90 grados
cenitales clavados, pero el borde de la malla está en la mitad de la cobertura: 110 grados en un domo de 220. En
cualquier domo de más de 180 la línea se quedaba en el horizonte y la superficie seguía por fuera. Ahora ese
ángulo entra como uniforme (`u_rimDeg`) y se escribe en los dos sitios que dibujan el domo — el visor del editor y
la ventana emergente. Era un fallo del editor, no sólo del landing.

**El visor 3D de la sala es el de verdad.** Ya no es el esquema de líneas gruesas: es `renderRoom3D`, el mismo que
corre en el editor, y se gira arrastrando y se acerca con la rueda. Lo que faltaba era que ese visor lee la sala de
la secuencia activa, y en la pantalla de inicio todavía no hay ninguna — así que ahora se le arma una temporal con
la misma forma que produce la creación de verdad. La planta cenital se queda, en su propio panel a la derecha: es
un plano acotado, no un viewport, y para las medidas sigue siendo lo que hace falta.

**El lienzo cosido sale del visor 2D.** Misma pieza: con la sala temporal montada, la tira se dibuja por el camino
2D de la sala, con su marco, su retícula y sus costuras. De ahí que ahora tenga los mismos colores y las mismas
líneas que el 2D plano — que era exactamente lo que pedía Beltrán.

**Del piso se elige el pixelaje, no las medidas.** Fila propia bajo los muros: los dos números de píxeles se
editan; el ancho y el fondo en centímetros se muestran sin marco, porque los manda la huella de la sala. Es la
regla correcta: un piso más ancho que sus paredes no existe, pero su resolución la decide el proyector. Si luego se
cambia un muro, la medida sigue al muro y el pixelaje elegido se queda.

**Y por el camino apareció uno gordo: desde la pantalla de inicio no se podía crear una sala.** Con cuatro muros el
panel de la izquierda no cabe en la ventana, y como recortaba lo que sobraba, el botón de crear quedaba fuera —
invisible y sin forma de llegar a él. Venía de antes; la fila del piso sólo lo hizo más evidente. Ahora el panel se
parte en dos: las elecciones se desplazan si hace falta, y el resumen de salida y el botón de crear se quedan
pegados abajo pase lo que pase. A 1080 de alto no se desplaza nada en ninguno de los tres formatos.

Verificado en la app con un arnés que se validó primero: para la línea de borde se proyecta el punto del casquete a
cada ángulo cenital y se mira el píxel, y **forzando el comportamiento anterior el número cambia** — o sea que la
medida distingue. La banda clara pasa de 90 a 100 grados en un domo de 200 y a 110 en uno de 220; en 180 no se
mueve nada, como debe ser. (Los dos primeros intentos de medida no valían: uno leía los rótulos de la capa de
guías, que quedan por fuera de todo, y el otro miraba el domo desde el cenit, donde el borde queda escondido
detrás de la propia cúpula.) Alto de la pantalla idéntico en los tres formatos, sin scroll, y sin errores.

## ROUND 197 — Landing: 4 de los 8 puntos de la tanda 3

**Fuera el botón de preferencias.** En la pantalla de inicio no hay todavía nada que preferir, y ocupaba sitio.

**Fuera el interruptor «Uniform».** Ganamos su fila entera, y los muros pasan a editarse **por separado** — que es
justamente lo que hace falta para la tanda 4, donde los ángulos han de salir de las medidas de cada muro. Con
Uniform puesto, tocar el ancho de un muro se lo imponía a todos.

**El preajuste sube a la fila de los muros, a su derecha, y pasa a desplegable + Guardar.** Los cinco botones
ocupaban una fila entera para algo que se elige una vez, y no dejaban guardar la sala propia. Los preajustes del
usuario se guardan en el navegador, no en el proyecto: son una preferencia del equipo, no parte de la obra.

**La orientación de cada muro se elige de una lista.** Antes el botón daba vueltas: con cinco orientaciones,
llegar a la que querías costaba hasta cuatro clics y no se veía cuáles había. Al elegir una que ya tiene otro
muro, los dos se **intercambian** — dos muros no pueden mirar al mismo sitio.

Quedan cuatro puntos del landing, los tres que tocan los visores (colores del Canvas, la línea de borde del domo
que no sigue al ángulo, el visor 3D de la sala) y la configuración del piso.

## ROUND 196 — La rotación de un compose (tanda 2)

El control ya estaba: la fila «Rotation» del Transform aparece para un compose como para cualquier otro clip. Lo
que no estaba era el efecto. Un nido dentro de una secuencia de domo se dibuja por el camino de «esto ya es un
domo entero», y ese camino sólo leía el azimut — así que se movía el control y no pasaba nada.

Ahora `rot` **se suma** al azimut en ese camino. Sumar en vez de sustituir es lo que evita mover un solo grado
los proyectos que ya giraban su composición con `az`, que era la única forma de hacerlo hasta hoy.

Verificado en la app, con el arnés validándose primero (dos capturas iguales → idénticas): con rotación a 90° la
imagen cambia de verdad, y da **exactamente** la misma imagen que poner el azimut 90° más — o sea que gira, y
gira lo que tiene que girar, no otra cosa.

## ROUND 195 — La velocidad estira el clip (tanda 1 de la lista de Beltrán)

**Cambiar la velocidad ahora estira o encoge el clip.** Abarca el mismo material, así que su duración en la línea
de tiempo va al revés que la velocidad: al doble de velocidad, la mitad de largo. Antes la duración se quedaba
fija y cambiar la velocidad recortaba o repetía material en silencio.

**La automatización viaja con él.** Los keyframes son por clip y sus tiempos son relativos a su inicio, así que se
escalan por el mismo factor: lo que empezaba a media duración sigue empezando a media duración. Los fundidos se
recortan a la nueva duración — un clip a 4× no puede tener un fundido más largo que él mismo. Un clip en bucle no
se toca: ahí el largo lo decide el usuario arrastrando, no el material.

**La fila de velocidad usa el mismo componente que el resto de parámetros**: barra arrastrable de 50 a 200% —el
rango con el que se trabaja— y doble clic para escribir cualquier valor, con la barra pegada al extremo si se
sale. Antes era un deslizador de 25-400% con la cifra sólo de lectura.

Un detalle que había que resolver: el valor **no** se aplica mientras se arrastra. Al soltar se restaura la
velocidad de partida y se llama una sola vez a `setClipSpeed`, para que el estirado se calcule desde el valor
original; aplicándolo en cada movimiento del ratón el factor se acumularía y el clip se encogería sin parar.

Y el aspa de cerrar secuencia baja de 11 a 8,5 px, manteniendo su área de clic con el relleno.

El atajo Ctrl+T / Ctrl+Shift+T queda **aplazado** a petición de Beltrán.

## ROUND 194 — Los seis hallazgos de la revisión de código

**1. Fotogramas duplicados al final de cada clip.** Un `VideoDecoder` retiene una cola de reordenación: haberle
dado la última muestra y ver su cola de entrada vacía NO significa que haya emitido todo. `passed()` daba el
visto bueno antes de tiempo y `frameNear` devolvía un fotograma anterior, así que los últimos fotogramas de un
clip se escribían **duplicados en el máster, en silencio** — justo lo que `passed` existe para impedir. Ahora se
pide `flush()` y no se da por cerrado el archivo hasta que resuelve.

**2. Un cuelgue sin plazo ni error.** El repliegue a `<video>` puede recibir una instancia que nunca llegó a
enlazarse a su archivo. Fijar `currentTime` sobre un elemento sin origen **no dispara `seeked` jamás**, y
`seekExport` se quedaba esperando para siempre. Ahora se enlaza el origen si falta, y si no hay, se sigue.

**3. El proxy no cuadrado seguía usándose.** R192 puso la restricción en `ncBuild` y en los menús, pero no en
`ncUsable`, que es la única puerta que decide de verdad: un proxy guardado en un `.isp` anterior seguía
enlazándose con el desencuadre que R192 vino a cerrar. Y de paso, **«Quitar proxy» estaba detrás de la misma
condición que impide generarlo**, así que un proxy heredado quedaba imposible de borrar.

**4. La sala por muros no se podía exportar.** El panel sondeaba el códec contra la tira entera (8192×2048) en
vez de contra el muro que de verdad se codifica (2048²), así que daba H.264 por imposible y bloqueaba Exportar
cuando cada muro cabía de sobra.

**5. Cada tecla del campo bitrate relanzaba la escalera de sondeos** — 12 peldaños × 2 códecs, y cada uno prueba
varios niveles por dentro — porque el bitrate entraba en la clave del caché aunque el techo no depende de él.

**6. Un hueco donde Exportar seguía pulsable.** Entre cambiar el tamaño y recibir la respuesta del codificador,
`S.codecOk` conservaba el valor anterior; un clic ahí encolaba un trabajo que moría en `codec-pick`. Ahora, un
códec de vídeo se da por no válido mientras se sondea.

## ROUND 193 — El proxy baja a 2048, y aparece la limitación de verdad: no tiene alfa

Beltrán: «el proxy lo ideal es que sea en baja calidad, si es para que corra rápido». Tiene razón, y además
desbloquea lo importante: **«lienzo completo» era una petición sobre el ENCUADRE, no sobre los píxeles**, y R186
las había juntado en una. El proxy conserva el encuadre entero pero baja la resolución con tope de 2048 en el
lado largo. A 4096² esta máquina sólo ofrecía AV1/VP9 por software; a 2048² entra **H.264 por hardware**, y el
visor no pasa de ~1000 px en pantalla, así que no se pierde nada visible.

**Y midiendo eso apareció otra cosa.** Tres de cinco posiciones daban ~70 dB (perfectas) y dos daban 32 dB con
desviación ~200. Reproducible en dos pasadas. Descarté por medición, una a una:

- **Compresión** — horneado con el triple de bitrate: 32,23 → 32,25 dB. No es eso.
- **Desfase de fotograma** — barrido de ±2 fotogramas: el mejor parecido está en 0. No es eso.
- **Reencuadre** — el desplazamiento del centro de masa es de 2 px sobre 256. Tampoco.

Volqué las imágenes y se vio a la primera: **el contenido y el encuadre son idénticos; lo que cambia es el
fondo**. Sin proxy, fuera de los clips la composición es transparente. Con proxy, el disco entero es negro
opaco. Un MP4 no lleva canal alfa, así que al hornear todo lo transparente se vuelve negro.

Consecuencia real: **si el nido va encima de otra capa, el proxy la tapa**. Si es la capa de abajo o va sobre
negro, no se nota — que es el caso de las composiciones en anillo. El arreglo de verdad es hornear con alfa
(VP9 y AV1 lo admiten; también HAP Q Alpha).

Anotado también el método: los tres primeros diagnósticos fueron hipótesis mías y los tres eran falsos. Lo
resolvió mirar las dos imágenes, que costó menos que cualquiera de ellos.

## ROUND 192 — El proxy de composición vuelve: lo que estaba roto era mi forma de medirlo

R186 retiró el proxy de composición de la interfaz porque, tras pasarlo a lienzo completo, medí una discrepancia
de encuadre contra la composición recompuesta: PSNR 26,6 y 7 px de desplazamiento. Con clientes entrando, una
previsualización que reencuadra es peor que no tener el acelerador, así que lo escondí.

**Esa medición era falsa.** Mi captura escribía `state.t` para mover el cabezal, y esa variable no existe — el
cabezal es `state.playhead`. Las tres «posiciones» que comparaba eran el mismo fotograma congelado. Es la tercera
vez que este componente me hace culpar al código teniendo el fallo en el test.

Rehecho con un arnés que **se valida a sí mismo antes de comparar nada**: misma configuración dos veces debe dar
capturas idénticas, y —esto es lo que faltaba— **dos instantes distintos deben dar capturas distintas**; si no,
se aborta en vez de medir. Con esa red puesta, sobre el nido real de 6 clips en domo 4096², en tres posiciones:

| | R186 (mal medido) | R192 (medido bien) |
|---|---|---|
| PSNR proxy vs recompuesto | 26,6 dB | **58 dB** |
| Desplazamiento del centro de masa | 7 px sobre 32 | **≤ 0,22 px sobre 256** |

Lo que queda es pérdida del códec, no reencuadre. **Repuestas las dos entradas de menú**, con la restricción a
composiciones **cuadradas** ahora explícita en los menús y cerrada también dentro de `ncBuild`.

**Y un coste que había que decir.** A 4096² esta máquina sólo ofrece AV1 y VP9, que codifican por software: un
nido de 20 segundos tarda unos 200 en hornearse. El códec se elige antes de abrir el diálogo para poder
anunciarlo ahí; sin ese aviso, quien pulsa «Generar» cree que el programa se ha colgado.

Las composiciones no cuadradas siguen bloqueadas. Queda una pista concreta y sin verificar: la rama `flat` de
`renderExportFrame` recorta el letterbox sin comprobar `_ncSquare`, aunque el comentario de encima dice que al
hornear un nido hay que conservarlo.

## ROUND 191 — H.265 vuelve, y los límites se dicen en vez de esconderse

Beltrán quiere poder sacar un MP4 ligero para revisar. R185 había retirado H.265 del todo y, además, **ocultaba**
del desplegable cualquier códec que no alcanzara el tamaño elegido. Eso resolvía un problema real —ofrecer lo
imposible le cuesta al cliente un render entero para descubrirlo— pero creaba otro: si el formato que quieres no
aparece, no hay forma de pedirlo, ni de saber por qué falta.

**Ahora se ven los cinco formatos siempre, cada uno con su límite escrito al lado:** «MP4 · H.265 / HEVC — máx.
1080 × 1080 aquí». Si el elegido no alcanza el tamaño, Exportar queda bloqueado con el motivo en una línea ámbar,
y se desbloquea solo al bajar el tamaño.

**Los límites no están escritos a mano: se le preguntan al codificador.** Una escalera de alturas manteniendo la
proporción, cacheada, y sólo cuando el tamaño actual no cabe. Medido así en esta máquina: H.264 llega a 3072×3072
en cuadrado y 3840×2160 en 16:9; H.265 a 1080×1080 y 1920×1080. Coincide con lo que ya estaba anotado, pero ahora
la interfaz lo vuelve a medir en vez de repetirlo, así que no envejece con la máquina ni con Chromium.

El motor ya entendía H.265; faltaban la entrada del desplegable, contarlo como vídeo (si no, desaparecía la fila
del bitrate y se exportaba con el último valor a ciegas) y dejar de filtrarlo al releer el último export usado.
Export real verificado con ffprobe: `hevc / Main / 1024×1024 / 30 fotogramas`.

## ROUND 190 — Tres arreglos del panel de export

Pedidos por Beltrán tras usarlo en producción.

**«Reiniciar render» fuera; «Exportar» bloqueado mientras corre.** El botón principal se convertía en «Reiniciar
render» durante el render y relanzaba encima del que estaba corriendo: un clic de más y perdías el trabajo hecho.
Ahora queda bloqueado hasta que termine o se cancele; para rehacerlo hay que cancelar primero, que es explícito.

**Cerrar cancela.** Cerrar el panel con un render vivo lo dejaba corriendo a ciegas — sin monitor, sin barra y sin
forma de pararlo salvo reabrir. Con render en marcha, Cerrar (y la X, y Esc) cancelan antes de irse; terminado o
en reposo, cierran y ya.

**La carpeta se abre sola al terminar.** Antes preguntaba con un diálogo cuya respuesta era siempre la misma.
Sólo en el último trabajo del lote: una sala por muro encola cuatro muros más el piso, y serían cinco ventanas
del explorador.

**Y el diálogo invisible.** Guardar un preajuste desde el panel abría un `appPrompt` que aparecía DETRÁS y no se
podía contestar. Los diálogos estaban en z-index 50, por debajo del panel de export (60) y de los paneles
flotantes (9000). Pasan a 9600: un modal bloquea a quien lo abre, así que tiene que estar por encima de todo.

## ROUND 189 — El export deja de reposicionar vídeos: 90→1037 ms se convierte en 1 ms plano

**El dato de Beltrán.** «Exporté 3 segundos de un compose con 24 clips y se demoró casi 22 minutos.» Son 180
fotogramas en 1320 s: **7,3 s por fotograma**, o **~305 ms por clip y fotograma**. Encajaba exactamente con la
curva medida en R188, y explicaba por qué la deduplicación de R188 no le sirvió: sólo agrupa clips que piden el
MISMO fotograma del MISMO archivo (un anillo de copias). Veinticuatro clips distintos no comparten nada.

**La causa, que ya estaba anotada sin arreglar.** `<video>.currentTime = t` redecodifica desde el fotograma
clave anterior en cada llamada. Como el export avanza en orden, la distancia a ese fotograma clave crece con
cada fotograma y el coste con ella: O(n²) por GOP, multiplicado por cada clip dibujado.

**El arreglo: el export decodifica por WebCodecs secuencial** (`_exCD`). Es el motor de R108, que llevaba
apagado desde entonces porque el bucle de reproducción de 60 fps hambrea sus bombas de decodificación en el
hilo principal. Ese motivo no existe en el export: no hay plazo, avanza un fotograma y espera, así que puede
bombear cuanto haga falta. Cada muestra del archivo se lee una vez.

**Medido — 24 clips distintos, 4096²@60, 60 fotogramas:**

| | `<video>` | WebCodecs |
|---|---|---|
| posicionamiento, fotograma 1 | 90 ms | 652 ms (arranque) |
| posicionamiento, fotograma 60 | 1037 ms | **1 ms** |
| media por fotograma | 895 ms | 207 ms |
| fps | 1,12 | 4,83 |

Lo que queda (207 ms) es comprimir el PNG y componer: trabajo real, no espera.

**Tres trampas encontradas midiendo, no razonando.** Ninguna se habría visto sin comparar los másters:

1. **Aceptar el fotograma «suficientemente cercano» daba másters distintos entre pasadas.** Cuando el fotograma
   correcto aún no ha salido del decodificador, el anterior cumple la tolerancia y se escribe en su lugar. La
   única condición válida es que el fotograma exacto ya esté decodificado.
2. **`<video>` no elige «el último fotograma que empieza antes de t».** Trunca el instante a microsegundos
   enteros y lo compara con el arranque **exacto** del fotograma: al pedir 33333,33 devuelve el fotograma 1, no
   el 2. Dos reglas más sencillas desalineaban uno de cada tres fotogramas.
3. **Un anillo corto se bloquea solo.** El decodificador por hardware retiene fotogramas antes de emitir el
   primero; alimentaba 6 muestras y esperaba para siempre una salida que nunca llegaba.

**Y un cuelgue latente, encontrado al revisar el propio cambio.** `seekExport` pide todos los clips dibujados de
un fotograma a la vez, pero el tope de instancias vivas era 32: con una composición de más de 32 clips
simultáneos, el bucle desalojaba instancias que estaba esperando en ese mismo instante. Por el camino de
`<video>` eso no ralentiza el export, lo **cuelga para siempre**. Llevaba ahí desde antes de esta ronda. El tope
pasa a ser el que ese fotograma necesita. Probado con 40 clips: ambos caminos terminan.

**Fidelidad verificada, no supuesta.** Cuatro exports (dos por camino) comparados por PSNR fotograma a
fotograma: cada camino es determinista consigo mismo y entre caminos todo sale idéntico salvo diferencias de un
nivel, el mismo ruido que `<video>` tiene contra sí mismo. HEVC 10 bits comprobado aparte textura contra
textura: idéntico. Repliegue a `<video>` (lento pero correcto) si la pista viene rotada por metadatos, el
contenedor no se entiende, el decodificador muere o pasan 10 s sin fotograma.

## ROUND 180 — El proxy de composición: 2,6 → 15,8 fps

**La herramienta equivocada.** Beltrán quería render-in-place para que una composición de domo con 15 clips
corriera fluida en el editor, pero que el export final saliera en alta. Con R179 eso era imposible: el horneado
crea un medio y un clip NUEVOS, y el export renderiza lo que hay en la línea de tiempo — así que ese horneado
*es* la fuente y no hay forma de volver a las originales. Lo que hacía falta era otra cosa.

**Lo que sí estaba pidiendo la arquitectura.** El mecanismo ya existía para los vídeos: `_vinstUrl()` devuelve el
proxy en previsualización y el original cuando `_exportQuality` está puesto. Editar ligero, exportar pesado. Lo
que no cubría eran los nests: `prepNests` recompone los hijos en un FBO **en cada fotograma**, siempre. No es que
el nest sea caro de dibujar — es que nada lo cachea nunca.

Ahora un nest puede tener su propio caché. `ncUsable(m)` es la única puerta y la consultan cinco sitios: la
imagen (`prepNests` enlaza la textura y NO desciende), las decodificaciones (`collectDrawnVideoClips` mete el
caché como si fuera un vídeo y corta el descenso — ahí está toda la ganancia), el sonido, y los dos del enlace de
instancias. Medido sobre un nest de 6 clips en domo 4096²: **2,6 fps con 6 decodificadores → 15,8 fps con 1**.

**La regla que lo hace seguro, y que disuelve todo el debate de calidad de R179:** el caché sólo existe en
previsualización. `runExport` pone `_exportQuality=true`, las cinco puertas se cierran y todo se recompone desde
las fuentes reales — verificado: 1 decodificador en preview, 6 en export, y vuelve solo al terminar. El máster
nunca sale del caché, así que su resolución y su códec dan igual: es material de trabajo. Por eso se hornea a
media resolución con H.264, que a 2048² va por hardware.

**La invalidación, que era el riesgo real.** No se marca un booleano al editar: se compara una FIRMA del
contenido del nest (`nestSig`, recursiva a los nests hijos). Así ningún camino de edición se puede olvidar de
invalidar, y además es **reversible** — deshacer un cambio devuelve el caché a la vida, cosa que un flag no da.
`markDirty()` sólo agenda la revisión: recorrer firmas en cada fotograma sería absurdo, y hacerlo en cada tecla
mientras se arrastra un keyframe, también. Un caché rancio nunca se muestra como bueno (chapa roja con ⚠ en el
clip, forma además de color), pero tampoco secuestra el editor: se regenera cuando el montador lo pide.

**Dos trampas que costaron sangre.** La firma hay que tomarla DESPUÉS de renderizar: entrar en la secuencia del
nest lo muta — `loadSeqIntoState` le añade una pista de audio si no tiene y corre todos los clips un índice —
así que firmando antes el caché nacía rancio en el mismo instante de crearse. Y el caché lleva la mezcla de
audio horneada dentro: es lo que permite dejar de descender a los hijos sin quedarse sin sonido, y obliga al
`continue` de `collectAudioEvents` para no oír lo de dentro dos veces.

**El interruptor.** En la barra del visor, junto a `Proxy`, va **`Comp`**: apaga todos los cachés de composición
de golpe y devuelve el visor a recomponer desde cada clip fuente. Suelta las instancias (`disposeAllVinst`) en
los dos sentidos, porque las que estaban atadas al archivo del caché tienen que soltarlo para volver a componer.

**Lo que salió del code review.** Siete cosas, todas arregladas. Las tres que más dolían: `prepNests` sólo LEÍA
las instancias (`_vinst.get`) y no las creaba, así que cualquier camino que acabara en `render()` en vez de
`scrubRender()` — el propio `ncBuild`, abrir proyecto, deshacer — dejaba la composición en NEGRO hasta mover el
cabezal; `nestSig` hasheaba la LONGITUD de las máscaras y no su contenido, con lo que mover un punto de la pluma
dejaba el caché tan fresco mostrando la versión anterior; y un horneado de render-in-place, que no tiene alfa,
puesto en la pista más alta tapaba en negro todas las demás — ahora el de UN clip se inserta justo encima de su
origen y lo que estaba por arriba sigue componiéndose por arriba. Además: cancelar el diálogo ya no se lleva por
delante la selección de entrada/salida, `ncAttach` limpia `_noAudio` (si no, una composición que ganaba sonido
después del primer horneado se quedaba muda para siempre), y la chapa dice «Proxy apagado» cuando el interruptor
Comp está apagado en vez de mentir diciendo que se está reproduciendo el proxy.

**Y una limitación que se asume en vez de disimular.** El review detectó que en un nest NO cuadrado el encuadre
con caché no coincide con el recompuesto: medido, el centro de masa se va un 29% en vertical. Se probaron las dos
hipótesis obvias — hornear cuadrado con letterbox, y el volteo de `UNPACK_FLIP_Y_WEBGL` — y ninguna lo movió (el
desplazamiento se quedó en 15,6 → 15,1 → 14,9 px, que es ruido de compresión). La causa está en cómo `flatPlace`
mapea la textura del pool frente a la de un vídeo, y no se ha aislado. Así que `ncBuild` **rechaza las
composiciones no cuadradas con un aviso explícito**: antes servir un «no» claro que un encuadre distinto en
silencio. En domo — que es para lo que existe esto — el encuadre es idéntico: **PSNR 68,7 dB, desplazamiento
0,03 px**.

**De propina:** apagar un nest no era gratis. `compositeClips` lo saltaba al dibujar, pero `prepNests` no miraba
`c.disabled` y seguía componiendo sus 15 hijos cada fotograma para producir una textura que no usaba nadie.
Una guarda de una línea.

## ROUND 179 — Render in place: nunca había renderizado nada

**La causa raíz.** Beltrán: «lo probé y sentí que no sucedió nada». No lo sintió: no sucedía nada. `uid()`
devuelve un NÚMERO (`let _id=1; const uid=()=>_id++`) y las dos entradas de render-in-place armaban el nombre de
salida con `uid().slice(0,5)`. Eso lanza un `TypeError` en la línea que construye la ruta — antes de abrir el
codificador, antes del primer fotograma. La promesa moría sin dueño en el manejador del clic, así que la función
había estado rota en silencio desde R115. Hoy es `String(uid()).padStart(4,'0')`.

**El techo real de esta máquina, medido.** Antes de decidir nada se sondeó el codificador de verdad
(`scratchpad/probe-4096*.mjs`, sobre el .exe por CDP). H.264 se niega por encima de **3072²** — 3200² ya falla, a
cualquier bitrate. **HEVC no pasa de ~1080p**, y no es la GPU: NVENC llega a 8192², es el codificador HEVC de
Chromium en Windows. O sea que el domo a 4096² tenía exactamente cero salidas, y el diálogo lo ofrecía igual (el
export normal sigue anunciando «HEVC · 4K+», que en esta compilación es mentira: queda anotado).

Lo que sí acepta 4096²: **AV1** (hasta 8192²) y **VP9**, incluido su perfil 2 de **10 bits**. Codifican por
software, ~10 fps a 4096² sobre ruido puro — pero el archivo que producen se **decodifica por hardware**
(`powerEfficient:true` a 4096²), que es lo que importa para volver a montarlo en la línea de tiempo. Probado de
punta a punta: codificar → muxear en .mp4 → escribir → reproducir a 4096×4096.

**Lo que se construyó encima.** `ripCodecOptions(w,h,fps)` le PREGUNTA al codificador qué acepta a ese tamaño
exacto y ofrece sólo eso, el mejor primero — sondear en vez de codificar a mano la tabla, porque el próximo salto
de Electron mueve estas paredes otra vez. A 4096² salen AV1 y VP9 10-bit; a 1920×1080 salen los cuatro con H.264
de cabeza. `runExport` aprende `av1`/`vp9`/`vp910` (mismo muxer, distinto selector) y `noAudio`, que se salta el
decode y la mezcla de audio enteros — un horneado es imagen, y esa etapa era la más lenta de un clip corto.

`ripProgress` es el visor de avance que faltaba: el fotograma que se está renderizando (leído de `glc` dentro de
la tarea de render, que es la única ventana en que el búfer es legible), barra, contador de fotogramas, ETA y un
Cancelar que baja la misma bandera `cancelExport` que sondea el bucle. Si se cancela o falla, el `.mp4` a medio
escribir se borra: `runExport` se traga sus propios errores con un `appAlert`, así que ahora un trabajo puede
declarar `job.fail` y quedarse con el error para no importar un archivo trunco.

**Y lo que pedía Beltrán:** el resultado ya no reemplaza nada. `ripPlaceOnNewTrack` crea una pista de vídeo
nueva y deja el clip horneado en el mismo sitio del timeline, con los originales intactos debajo — silenciarlos o
borrarlos es decisión del montador. `push` es lo que la pone arriba: `compositeClips` pinta de la pista 0 a la n
y `lanesTopDown()` invierte para mostrar, así que el índice más alto es la fila de arriba Y la capa de encima.
En domo el clip vuelve con `props.fulldome=true`, o sea que el máster fisheye entra 1:1 sin deformarse otra vez.

## ROUND 178 — El recorrido guiado por formato, y la barra vertical bien

**El recorrido, donde toca.** Beltrán: el tour no debe aparecer antes del landing, sino al abrir por primera vez
un proyecto domo, 2D o 360 ya configurado — y adaptado a cada uno. El primer arranque se SALTABA el launcher para
montar una escena de demostración y lanzar el recorrido encima. Ahora `init()` va siempre al launcher y el
recorrido lo dispara `lchCreate()` al crear el primer proyecto de cada formato, con una bandera por formato.

Los cinco pasos cambian de texto según el tipo: el visor es «el máster fisheye, cada clip en su azimut y
elevación» en domo, «tu lienzo, clips como rectángulos sin deformación» en 2D y «los muros DESENROLLADOS como una
tira» en sala; la línea de tiempo cuenta en la sala que un clip puede cruzar la junta y reaparecer al otro lado;
el inspector nombra azimut/elevación, posición/escala o «enmascarar a muro»; y el export menciona que en la sala
se puede sacar la tira entera, muro por muro o el piso aparte.

`startOnboarding()` se quedó sin llamantes y va a `_backup/deprecated/`. `buildDemoProject` NO se archiva aunque
era su única llamante en el programa: la usan todos los arneses de prueba. Es código vivo sólo para las pruebas,
y queda dicho para que nadie lo tome por muerto.

**La barra vertical, las dos cosas que faltaban.** R177 la llevó hasta abajo pero la dejó arrancando en el borde
del panel, metiéndose en la franja de la regla y tapando el final del tiempo y del cabezal: ahora empieza en 29px
(5 del asa + 24 de `RULER_H`) y baja el z-index, porque esa franja es de la regla y el cabezal.

Y **los puntos achicaban pero no agrandaban**: `startVCapDrag` hacía `if(l.collapsed)return`, así que en cuanto
el gesto plegaba una pista quedaba excluida para siempre y el gesto contrario ya no la recuperaba. Ahora se
despliega en cuanto el tamaño pedido vuelve a alcanzar el suelo, el mismo criterio que Alt+rueda. Medido:
57 → plegada → 91.

Pruebas: funcional 22/22, robustez 15/15, recorrido 4/4 (launcher sin tour · domo con texto de domo · sala con
texto de muros · no se repite), cero errores de consola.

## ROUND 177 — La barra vertical llega hasta abajo

Ajuste menor de Beltrán: la barra de la derecha del timeline debe llegar hasta la parte de abajo.

Vivía DENTRO de `.tlmain` —la fila de pistas—, así que terminaba justo donde empieza la barra horizontal y
quedaban 12px muertos en la esquina. Medido antes: la barra iba de 557 a 866 y el panel acababa en 878.

Ahora se ancla al panel (`position:absolute` sobre `.timeline`, de `top:5px` —el asa de redimensionado, para no
taparla— a `bottom:0`). `.tlmain` reserva su ancho con `padding-right:12px` y la horizontal se aparta con
`margin-right:12px`, así que la esquina es de la vertical y no se pisan.

Medido después: 557→878, hueco 0. Los puntos siguen redimensionando (57→84px al arrastrar el de abajo) y la barra
horizontal pasa a 1588px de ancho, los 12 que cede.

Pruebas: funcional 22/22, robustez 15/15, cero errores de consola.

## ROUND 176 — Tres ajustes y el arranque sin interrupciones

**El arranque, hasta el final.** Beltrán zanjó la duda que quedaba de R175b: el splash se queda SIEMPRE y no se
ve nada hasta terminar. Eso obliga a que la pregunta del autoguardado no salga a mitad del arranque —o quedaría
dentro de la ventana oculta, o forzaría a revelar un editor a medio montar—. Ahora `maybeOfferAutosave` detecta
el arranque, abre el archivo tal cual y APLAZA la oferta de recuperación: se pregunta después, con el editor ya
pintado. Los avisos (`appAlert`) siguen soltando el splash, porque un aviso durante el arranque significa que
algo falló y no va a haber proyecto que esperar. Medido: editor a los 2,6s con sus 4 clips, y la pregunta a los
3,2s, ya encima del editor. Cero launcher, cero segunda pantalla.

**Los tres ajustes:**
- **Splash al 70% del actual** (0,70 → 0,49). En una pantalla de 1080p pasa de 695 a 487px. Es una tarjeta de
  1080² escalada por transform, así que la tipografía y la diagramación encogen en la misma proporción solas.
- **Fuera el 0 y el 100** del borde del clip en modo automatización: cada parámetro tiene su escala —grados, por
  ciento, píxeles— y dos números sueltos ahí no dicen de cuál son. Archivado en
  `_backup/deprecated/20260726-auto-curve-range-labels.js` junto con su `fmtV`, que quedaba sin uso.
- **La barra vertical ya tiene sus puntos**, y sirven para redimensionar las pistas. El CSS (`.tlvzcap`) y el
  manejador (`startVCapDrag`) llevaban escritos desde R152, pero los elementos NUNCA se habían añadido al DOM:
  la barra no era el espejo de la horizontal que decía ser. Medido: arrastrar el punto inferior lleva las cinco
  pistas de 57 a 84px.

Sobre el 0/100 hubo un falso positivo de mi propia sonda: detectaba tinta abajo a la izquierda y resultó ser el
primer fotograma clave de la curva, que vale 0 y se dibuja justo ahí. Confirmado a la vista con una captura.

Pruebas: funcional 22/22, robustez 15/15, cero errores de consola.

## ROUND 175b — El parpadeo del launcher, y una pregunta invisible

Beltrán, probando R175: al abrir un proyecto, justo antes de llegar al editor se cuelan un par de fotogramas del
launcher.

**Lo causé yo en R175.** El arranque decidía su destino —launcher, demo o nada— mirando si existía `#loadingOv`
para saber si ya había un proyecto abriéndose… y `#loadingOv` es exactamente lo que R175 dejó de crear. Sin esa
señal pintaba el launcher, y `hideLanding()` lo borraba dos fotogramas después. Ahora se decide con
`_bootEsperandoProyecto`, que se fija de forma síncrona nada más arrancar. (`currentPath` tampoco servía: se
asigna DESPUÉS de leer el archivo, más tarde que esa decisión.)

**Y al verificarlo apareció algo peor, también de R175.** El proyecto de prueba tenía un autoguardado más nuevo,
así que salía el diálogo de recuperación… DENTRO de la ventana todavía oculta. El usuario se quedaba mirando el
splash, sin saber que le estaban preguntando algo, hasta el cortafuegos de 35s. Antes no pasaba porque el editor
se revelaba primero. Arreglado en el punto único por donde pasan todos: `appConfirm`, `appAlert` y `appPrompt`
sueltan el splash antes de pintarse. Si hay que preguntar algo, el editor aparece para que se vea la pregunta.

Medido en los dos caminos: con `Rito360.isp` (con autoguardado pendiente) el diálogo sale a los 2,7s **con el
editor ya revelado**; con `RitoDome.isp` (limpio, 21 medios) el editor aparece a los 2,9s con el proyecto entero
y **cero launcher, cero segunda pantalla**.

Pruebas: funcional 22/22, robustez 15/15, cero errores de consola.

## ROUND 175 — Abrir un proyecto: UNA pantalla de carga, no dos

Beltrán grabó el arranque: doble clic en un `.isp` → splash cuadrado → se abre el editor → y el editor tapa todo
al instante con su propio "Loading…". Dos pantallas de carga seguidas. Su encargo: que la ventana 1:1 sea la que
carga el proyecto y del splash se pase directo al editor con los proxys y la ruta ya puestos, para llegar y dar
al play.

**Eran dos caminos independientes:** `bootReveal()` revelaba el editor cuando terminaba de arrancar el motor, sin
saber nada del proyecto; y `loadProject()` levantaba su propia pantalla al cargar. Ahora, si el arranque trae un
proyecto, el splash SE QUEDA: la carga reporta su avance por el mismo `bootMark()` y el editor sólo se revela
cuando los medios y proxys están montados.

**Lo que costó acertar: era una CARRERA.** El primer intento colgaba el freno del aviso `dsp:openPath`, y no
funcionó — ese mensaje sale en `did-finish-load` y llega DESPUÉS de que el editor decida revelarse. Medido:
revelado a los 2,4s, proyecto cargado a los 2,6s. La solución es al revés: el renderer **PREGUNTA** al proceso
principal, con una consulta síncrona que es lo primero que hace, si este arranque viene con archivo. Así el freno
está puesto antes de que nada pueda revelar.

**Cortafuegos, porque el fallo aquí sería peor que el problema.** Si abrir el proyecto se cancela, el archivo no
se puede leer o no es JSON válido, el splash se quedaría fijo para siempre — y el proceso principal acabaría
revelando una ventana todavía en `preboot`. Cada salida de `openProjectPath` suelta el splash, y además hay un
temporizador de 35s que revela pase lo que pase, con aviso al diagnóstico.

Medido con `Rito360.isp` real: a los 2,5s el splash sigue puesto y el editor no; a los 2,7s aparece con sus 4
clips y el avance en 100. **Cero apariciones de la segunda pantalla.** Y arrancar SIN proyecto sigue revelando a
los 2,4s como siempre.

Pruebas: funcional 22/22, robustez 15/15, barra del visor 3/3 estados, cero errores de consola.

## ROUND 174 — La barra del visor, botón por botón contra el handoff

Beltrán mandó dos capturas —la nuestra y la del prototipo— con las tres vistas (2D · Orbit · Viewer) y el encargo
de mirar cada botón. Se extrajo la lista ORDENADA de botones de los tres handoffs, y ahí estaba todo:

| | Handoff | Nuestra app |
|---|---|---|
| Superposiciones | **4**: Grid · Outline · Horizon/Center/Seam · Alpha, **sólo icono** | 5, con **Safe**, y con texto |
| En 3D | siguen visibles | desaparecían enteras |
| Viewer | sólo **FOV** | FOV **+ DOLLY** |
| Orbit | DIST | DIST |

El prototipo dibuja las superposiciones sólo con icono porque su `vpLbl` nace en `'icons'` y el rótulo va con
`display:none`; el texto sólo aparece en la variante que vive dentro del panel "More" —y es ahí, y sólo ahí, donde
el handoff menciona "Safe"—. Beltrán zanjó las dos dudas sobre la marcha: **«Safe no va. Se elimina»** y
**«también se elimina el fader de DIST; sólo se queda FOV en Viewer»**.

**Aplicado:** fuera Safe (botón, estado, espejo en "More", interruptor de Preferences y tooltip; las guías de zona
segura —rectángulos del plano y anillos por elevación del domo, con su aviso de cenit— quedan archivadas en
`_backup/deprecated/20260726-safe-zone-overlay.js`). Fuera DIST y DOLLY. Superposiciones sólo icono, con el rótulo
envuelto en `.vlbl` para que el espejo de "More" lo siga leyendo.

**Y dos cosas que aparecieron al medir:**
- El grupo de superposiciones no desaparecía en 3D por decisión, sino por FALTA DE SITIO: el hueco de cámara
  reservaba 324px para FOV+DOLLY y la barra replegaba las superposiciones a "More". Con DOLLY y DIST fuera, el
  hueco baja a 150 y caben en los tres estados.
- `Orbit|Viewer` sólo se mostraba dentro del manejador de CLIC del botón 3D. Llegar a 3D por cualquier otra vía
  —abrir un proyecto, cambiar de secuencia, restaurar el espacio de trabajo— dejaba el grupo escondido. Su
  visibilidad pasa a `_updViewCtl`, que es lo que gobierna la barra.

Medido en los tres estados: 2D → `2D|3D · 4 iconos · Full ½ ¼ · Proxy · zoom · Output`; Orbit y Viewer añaden
`Orbit|Viewer`, y Viewer además `FOV`. Cero rótulos de texto en las superposiciones, cero Safe, cero DIST/DOLLY.

Pruebas: funcional 22/22, robustez 15/15, cero errores de consola.

## ROUND 173 — Los cinco agujeros del arreglo de menús de R172

La revisión de código señaló que R172 tapaba el caso feliz —pulsar dos veces el mismo píxel— y dejaba cinco
formas de fallar que su sonda no podía ver, porque siempre pulsaba en el mismo sitio y nunca descartaba con un
tercer elemento. Tenía razón en las cinco.

**El peor, y el que se lleva por delante un mecanismo entero: la ventana de 600ms.** El vínculo entre el cierre
y la reapertura era temporal, así que descartar un menú pulsando el visor y volver al MISMO botón dentro de ese
margen dejaba el botón muerto. Ahora el vínculo es el **sello del pointerdown** (`_ptrSeq`): `openMenu` sólo se
calla si lo está llamando el mismísimo pointerdown que acaba de cerrar el menú. Sin reloj, sin margen, sin falsos
positivos.

**Los otros cuatro:**
- `rectDe` caía en el elemento CRUDO si no encontraba disparador, así que guardaba contenedores enteros: con el
  menú contextual de una cabecera de pista abierto, ningún chip de dentro podía abrirse. Ahora es una lista
  cerrada y sin coincidencia devuelve null — mejor no alternar que bloquear.
- `.alab` vive DENTRO de `.achip` y `closest` devolvía la etiqueta interior: abrir el chip por su texto y
  cerrarlo por la flecha reproducía el fallo original de R172. El orden de búsqueda ahora prefiere el chip.
- El resaltado `.on` de la barra de menús se ponía aunque `openMenu` hubiera alternado a CERRADO y salido: el
  botón quedaba encendido sin menú y su propio alternador se comía el clic siguiente (tres clics para reabrir).
  Ahora sólo se pone si el menú quedó abierto de verdad.
- El dueño se apuntaba siempre desde el último punto pulsado, aunque el menú no naciera de pulsar SU disparador:
  submenús lanzados desde una entrada de menú, y el cambio de menú al pasar el ratón por la barra, guardaban el
  rectángulo de otra cosa. Ahora no se apunta dueño en esos dos casos.

**Sonda nueva** (`probe-menus2.mjs`) con los seis escenarios, incluida una regresión. Para comprobar que la sonda
sirve de algo se revirtió el arreglo y se volvió a pasar: **reproduce 3 de los 5** fallos (chip dentro de una
cabecera, descartar y volver, y texto-flecha del mismo chip). Los otros dos —el resaltado huérfano y el submenú—
no se reprodujeron con esta secuencia concreta; quedan cerrados por construcción, no por prueba, y así se anota.

Pruebas: funcional 22/22, robustez 15/15, barrido de menús 7/7, chips 3/3, escenarios 6/6, cero errores.

## ROUND 172 — Los desplegables se cierran al segundo clic

Beltrán: los menús abren al pulsar, pero pulsar otra vez no los cierra.

**Dos causas distintas, y la segunda llevaba ahí desde R135.**

La general: un `pointerdown` global cierra el menú al pulsar fuera, y acto seguido el `click` del propio botón lo
vuelve a abrir. Neto: no se cierra nunca. Ahora `openMenu` recuerda el RECTÁNGULO del disparador y, si el
pointerdown que cerró el menú cae dentro de él, no reabre. **Se compara por posición y no por nodo** porque abrir
el menú de un chip de automatización re-dibuja la cabecera de la pista: en el segundo clic el elemento ya es otro
y cualquier comparación por identidad falla. El rectángulo, además, distingue chips iguales de pistas distintas,
que una firma por clase y texto confundiría. Sólo con el botón izquierdo: un clic derecho repetido debe reabrir
su menú contextual, no cerrarlo.

La otra apareció al probar: **los cuatro botones de la barra de menús tampoco cerraban**, y ésos sí tenían su
propio alternador. `openAppMenu` ponía el resaltado `.on` ANTES de llamar a `openMenu`, y `openMenu` arranca con
`closeMenu()`, que quita `.on` de todos los botones de la barra: la clase se borraba en el acto. Así que el botón
nunca se veía activo y su comprobación `if(classList.contains(on)) closeMenu()` no entraba jamás. El resaltado
pasa a ponerse DESPUÉS de abrir — y de paso vuelve a verse, que tampoco funcionaba.

Barrido automático sobre todo lo pulsable de las barras, con eventos de ratón REALES (el arreglo depende del
orden pointerdown → click, que un `.click()` sintético no reproduce): **7 disparadores de menú, los 7 cierran**
—File, Edit, Project, Window, orden de medios, zoom y Output— más los tres chips de identidad del modo
automatización, que se probaron aparte porque sólo existen ahí.

Pruebas: funcional 22/22, robustez 15/15, enlace A/V 6/6, cero errores de consola.

## ROUND 171 — Tres ajustes del timeline

Sobre la captura que mandó Beltrán tras probar los clips enlazados.

**1 · El panel mide lo que miden las pistas.** `tlMaxH()` (R156) sólo limitaba el ARRASTRE del divisor; la altura
de partida seguía cableada en el CSS (402px) y no se recalculaba al colapsar, quitar o escalar pistas, así que
sobraba banda vacía bajo la última. Ahora `clampTimelineH()` ajusta el panel en cada re-render. **Y no sólo hacia
abajo:** la primera versión únicamente recortaba, y al enlazar audio —que puede crear una pista A2— la pista
nueva quedaba fuera de vista. Esconder una pista es peor que la banda vacía que se quería quitar. Si el usuario
arrastra el divisor, su altura manda y entonces sí sólo se recorta al tope.

**2 · Las pistas de audio miden lo mismo que las de vídeo.** Eran 44 contra 57 y se notaba; con clips enlazados
A/V la mitad de audio quedaba visiblemente más baja que su pareja. `AUDIO_LANE_H` pasa a ser `LANE_DEF_H`. Sigue
siendo sólo el valor por defecto: Alt+rueda las escala todas juntas.

**3 · La fuente va junto al nombre, en gris.** "ORIGINAL" / "PROXY" era una chapa en mayúsculas, con espaciado de
letra y sombra, flotando sobre el clip: competía con el nombre y tapaba la miniatura. Ahora es "Original" /
"Proxy" dentro del título, a 10px, peso normal y en `--ink-3`. La barrita de progreso del proxy se queda donde
estaba. Medido: dentro del título, gris rgb(140,140,140), peso 400, sin mayúsculas.

Pruebas: funcional 22/22, robustez 15/15, enlace A/V 6/6, cero errores de consola.

## ROUND 170 — Clips enlazados A/V, como Premiere

Petición de Beltrán: arrastrar un vídeo y que su audio baje solo a la pista de audio más cercana, enlazado; que
al mover uno se mueva el otro; y clic derecho para separarlos.

**Se apoya en la SELECCIÓN, y por eso es corto.** El motor ya traía arrastre multi-clip con desplazamiento
relativo de pista, recorte y borrado en grupo, audio por clip con volumen y fundidos, onda para cualquier clip
que esté en pista de audio, y `compositeClips` sólo recorre pistas de VÍDEO —así que la mitad de audio nunca se
pinta—. Basta con que seleccionar una mitad meta a la otra en la selección: todo lo demás ya funcionaba.

**El precio, y por qué no se disimula.** En previsualización el sonido de un vídeo sale de un `<audio>` pegado a
su instancia de decodificación, no de un búfer. Para que la mitad de audio sea un clip de verdad —con onda, y
movible por su cuenta tras desenlazar— hay que decodificar la pista a un AudioBuffer, y eso cuesta memoria
(~1,4 GB por hora de PCM). Se hace una vez, bajo demanda y bajo un tope de tamaño. Si el archivo es enorme o no
tiene sonido, NO se crea el par: el vídeo entra como un solo clip y suena como siempre. Preferible a un enlace a
medias.

**Cuatro cosas que la prueba con vídeo real destapó y hubo que cerrar:**
- Tras DESENLAZAR, la mitad de audio se quedaba muda: la condición miraba `avRole`, que el desenlace borra.
  Ahora mira la PISTA, que es lo que no cambia.
- Con una sola pista de audio, dos vídeos apilaban sus audios solapados en A1. Ahora se crea A2, como Premiere.
- Copiar, duplicar y pegar heredaban el `link`: dos pares con el mismo id harían que `linkPartner` eligiera al
  azar. Las copias nacen sueltas. Lo mismo si el corte no puede partir a la pareja.
- La onda no se dibujaba en la mitad de audio: `isAud` miraba el tipo de MEDIO (vídeo) y no la pista.

Verificado con `Inhaling-exhaling.mp4` real, los seis pasos: soltar → enlaza en A1 · mover → van juntos · sonido
→ un solo evento, el de la mitad de audio · cortar → dos pares v+a · desenlazar → separados y el audio sigue
sonando · guardar y reabrir → el enlace sobrevive.

Pruebas: funcional 22/22, robustez 15/15, cero errores de consola.

## ROUND 169 — [F7 fase 2]: la esfera completa, y los panoramas que salían del revés

**Autodetección 2:1.** Una fuente de 2048px o más de ancho y proporción 2:1 (con un 1% de margen) arranca como
panorama equirect, sólo en secuencias de domo. El margen y el mínimo están para no marcar un banner apaisado o un
recorte cualquiera; el interruptor del inspector manda siempre y la detección avisa por la barra de estado — nada
silencioso. Verificado: 4096×2048 sí, 3840×2160 no, 1024×512 (2:1 pero pequeño) no.

**La esfera completa.** La fase 1 deforma equirect→domo, y eso por definición tira todo lo que queda bajo el
horizonte: el máster es un casquete. Ahora, en ÓRBITA, la fuente se dibuja además sobre una esfera entera
atenuada al 45%, así que se ve el entorno del que el domo sólo recoge una parte, y dónde cae el borde. En modo
Viewer NO se dibuja: dentro eres el público, y para el público sólo existe lo que el domo proyecta. La esfera va
sin escritura de profundidad, para que el casquete gane siempre donde se solapan.

**Y el hallazgo gordo: los panoramas se veían del revés.** El patrón de prueba tenía la mitad de arriba gris y la
de abajo magenta; el cenit del domo devolvía RGB(255,0,170) — el magenta de ABAJO. Las texturas se suben con
`UNPACK_FLIP_Y_WEBGL=true`, así que `v=0` es el borde inferior del archivo, y `FSEQ` mapeaba el cenit justo ahí
con un `0.5 − lat/π`. Debe ser `0.5 + lat/π`. Con contenido abstracto esto no salta a la vista, pero con un
panorama de verdad significa el suelo sobre tu cabeza. Tras el arreglo el cenit devuelve el gris de arriba.
El fallo venía de R126 y sólo apareció porque la fase 2 necesitaba un patrón con arriba y abajo distinguibles.

Medido al final: 0% del color del hemisferio inferior en 2D y en Viewer, 2,4% en órbita — que es exactamente la
esfera enseñando lo que el casquete descarta.

Pruebas: funcional 22/22, robustez 15/15, iconos 31/31, cero errores de consola.

## ROUND 168 — Etapa 7: lo que cambia cuando cambia el formato

**El método primero.** Los tres handoffs (Domo · 2D Flat · 360) pesan casi lo mismo y traen 91-92 SVG y 109-110
botones cada uno: son variantes del mismo esquema. Auditarlos de arriba abajo por separado habría sido tres veces
el mismo trabajo. `scratchpad/handoff-diff.mjs` extrae el texto visible de los tres y se queda sólo con lo que NO
aparece en los tres: **20 de 115 textos**. Ahí está toda la Etapa 7.

**Lo que salió:**
- El botón del máster se llama **"Canvas"** en 2D y en la sala; **"2D"** sólo en el domo. Tiene sentido: ahí no hay
  un domo del que éste sea la vista plana — el lienzo ES la obra. Con sus tres tooltips distintos.
- El **3D no existe** en 2D plano (ya estaba bien) y en la sala se llama "sala 3D" (ya estaba bien).
- El **tercer hueco de superposición cambia de FUNCIÓN**, no de nombre: Horizon en el domo, **Center** en 2D,
  **Seam** en la sala. Y esto era un agujero: la app lo OCULTABA en 2D y en la sala (`display:none` cuando
  `isFlat()`), así que esos dos formatos se quedaban sin control ninguno en ese hueco.

No es un renombrado: `hfade` es un uniforme de sombreador que desvanece cerca de la línea de arranque del domo, y
no significa nada en plano. Se han escrito las otras dos: **Center** dibuja una cruz por el eje exacto del lienzo
con hueco central para no tapar lo que se encuadra (distinta de la cuadrícula de tercios, que es Grid), y **Seam**
pone tras interruptor las juntas entre muros —que antes se dibujaban siempre— y las marca más (0,24→0,34 y 1,5px)
porque con la rejilla de muro encendida se confundían con una línea más.

Verificado en los tres formatos: rótulo, tooltip y que el dibujo aparezca de verdad en el lienzo (tinta 364→688 en
2D, 579→723 en la sala). El domo no se puede medir así — su horizonte vive en el sombreador, no en el lienzo de
superposición.

**Dos diferencias que NO se tocaron, a propósito:** el handoff de la sala plantea un proyecto equirect de
3840×1920, mientras que aquí la sala es la tira de muros desenrollada (ADR); y los handoffs llevan la lectura
AZ/EL — YAW/PITCH en la sala — que Beltrán mandó quitar en R158.

Pruebas: funcional 22/22, robustez 15/15, iconos 31/31, cero errores de consola.

## ROUND 167 — Spout In, y el waveform contra audio de verdad

Beltrán dejó los dos recursos que faltaban: `Umbral.wav` y su `TDSyphonSpoutOut` encendido. Se cierran los dos
pendientes que necesitaban su entorno.

**[V3] Spout In — CERRADO.** No hizo falta un addon nuevo: la `SpoutDX` vendorizada para emitir ya trae el lado
receptor (`SetReceiverName`/`ReceiveImage`/`GetSenderCount`/`GetSender`). Se añaden cuatro funciones al `.cc`
—`inList`, `inOpen`, `inFrame`, `inClose`— sobre una instancia `spoutDX` APARTE de la del emisor, para que emitir
el composite y recibir una fuente externa a la vez no se pisen. Sin el truco del SharedArrayBuffer que usa NDI:
Spout es local y el búfer sólo cruza el puente cuando hay fotograma nuevo, así que un sondeo sin novedad no copia
nada. El volteo se pide al SDK, más barato que hacerlo fila a fila en JS.

En la app, un medio `kind:spout` que replica el camino de NDI: bombeo a 8ms + presentación por rAF, subida por
`texSubImage2D` sin realojar, miniatura cada segundo, ficha en Medios, reenganche al abrir el `.isp` y cierre del
receptor al borrar el medio. Entrada por clic derecho en el panel Medios. **Una conexión a la vez** (el receptor
nativo mantiene una), y se avisa si se añade una segunda.

Verificado contra el emisor real: enumera los dos `TDSyphonSpoutOut`, recibe 40/40 fotogramas en 2s a 1280×720,
el búfer cuadra exacto, el contenido es imagen de verdad (brillo medio 172, alfa 255) y llega al composite del
domo (4096/4096 píxeles con luz frente a 0 en vacío). Dos defectos encontrados y corregidos por el camino:
`serMedia` es una LISTA BLANCA y `spoutSource` no estaba, así que el `.isp` guardaba el medio sin su emisor y al
reabrir enganchaba al que estuviera activo —parecía funcionar por casualidad—; y la ficha de Medios anunciaba
"NDI INPUT · CONNECTING…" en un medio Spout que ya estaba recibiendo.

**Waveform con audio real — CERRADO.** `Umbral.wav`, 35,6s a 44,1kHz y 24 bits (el AudioContext lo remuestrea a
48k, que es lo normal). El pico dibujado (0,2489) coincide con el leído del propio búfer (0,2486): la onda no
miente sobre la amplitud. Cero cubos recortados, pico/RMS de 1,81 —dinámica real, no un bloque macizo—, las cuatro
bandas con recorrido de 0,88 a 0,95, espectro de 32 bandas que varía en el tiempo, 180 BPM y 171 golpes
detectados, y el medidor del ecualizador pintando el 69% de su lienzo.

**Y un item de la cola que era falso:** "pasada visual con la ventana al frente, porque las capturas salen
negras en segundo plano". No salen negras: `Page.captureScreenshot` devuelve el WebGL renderizado con la ventana
detrás. Todas las capturas de `scratchpad/shots/` lo demuestran.

## ROUND 166b — El diálogo de la sala arranca con TU sala

Defecto de lo entregado en R165 el mismo día: "Geometría de la sala…" abría `roomSetupDialog`, que siempre parte
de la sala por DEFECTO (4 muros de 500/400×300 a 1920×1080). O sea que entrar a retocar un muro sobrescribía en
silencio todos los demás — se había quitado la destrucción del proyecto, pero el diálogo seguía mintiendo sobre el
estado actual. Ahora acepta un segundo argumento `partirDe` con la sala viva; "Nueva sala 360…" sigue partiendo de
los valores por defecto, que es lo suyo. Verificado sobre una sala no estándar de 3 muros (640/310/310cm): el
diálogo abre con esos valores, y tras reconfigurar sobreviven los clips, los medios, la máscara por muro y el
enlace del piso, con la tira recalculada (5040→5280px).

También corregida una podredumbre de `NEXT.md`: daba por pendiente el panel de domo 3D del launcher, cerrado en R155.

## ROUND 166 — Los últimos checkboxes nativos, y el título del demo que vivía en la pista de audio

Cerrado el item de `NEXT.md`: los tres checkboxes que se habían quedado fuera del sistema de interruptores del
diseño (quitar negro, contorno del texto, vista en vivo de Motion) se veían como piezas de otro programa al lado
de los `.iosw`. Ahora usan `ioswHtml`/`ioswBind`, un puente que expone `.checked` (lectura y escritura) y emite un
evento `change` al pulsar: los `onchange` que ya existían siguen valiendo **sin tocarlos**, y el rótulo de al lado
conmuta igual que hacía el `<label>` nativo. Verificado por CDP: los tres cambian el estado, la fila de umbral del
recorte de negro aparece y desaparece con el suyo, y los tres vuelven a su valor al segundo clic.

**Y por el camino apareció una regresión de R155 que llevaba doce rondas escondida.** Al probar el contorno del
texto, `#txtStroke` no existía. El inspector del clip de texto salía con Transform vacío, sin propiedades de texto
y con los restos de Color del render anterior — la firma de la rama de audio, que hace `return` antes de construir
nada más. La causa: `buildDemoProject` reparte sus clips en las pistas 0..3, escrito cuando el índice 0 era V1.
Desde R155 el 0 es la pista de AUDIO, así que el título "IMMERSIVE" aterrizaba en ella y `isAudioClip()` daba que
sí. Ahora las pistas de vídeo se piden por su índice real. Esto afecta al proyecto de bienvenida, que es
literalmente lo primero que ve alguien que abre el programa por primera vez.

Pruebas: funcional 22/22, robustez 15/15, iconos 31/31, cero errores de consola.

## ROUND 165 — Lo que sacó la revisión de código sobre R152-R164

Once hallazgos; **diez reales y uno falso positivo**. Verificados uno a uno antes de tocar nada.

**El grave: "Rehacer la geometría de la sala…" borraba el proyecto entero.** La entrada que se añadió en R155
al menú Project llamaba a `newRoomProject`, que vacía medios, clips, grupos, marcadores y carpetas y limpia el
historial. Y `confirmDiscard()` devuelve que sí SIN preguntar cuando el proyecto está guardado — o sea que sobre
un proyecto recién guardado, pulsar una opción que sólo prometía tocar la geometría se llevaba todo el trabajo
en silencio. Ahora hay `applyRoomGeometry(cfg)`, que reescribe únicamente muros, tira y piso: los muros conservan
su `id` cuando conservan su ROL (que es la clave por la que los clips guardan su máscara, así que las máscaras
siguen valiendo), y si el usuario deja de querer piso se suelta el enlace pero la secuencia NO se borra: se queda
en Medios con su contenido. La malla 3D se cachea por id de secuencia, que no cambia al editar, así que hay que
invalidarla a mano (`_roomGeo`/`_roomGeoSeq`). La etiqueta pasa a "Geometría de la sala…".

**Los otros nueve.** Preferencias abría DETRÁS del launcher (overlay a 50 contra el launcher a 300, opaco) → z-index
320 como el resto de diálogos alcanzables desde la pantalla de inicio. El menú "More" del visor imprimía una lectura
inventada "AZ 0° · EL 35°" leyendo `state.view.az`/`.el`, que dejaron de existir en R158 → la sección sólo aparece en
3D. La pista de audio nacía ARRIBA por dos caminos que quedaron sin actualizar tras R155 (el alta automática de
proyectos antiguos hacía `push`, y `addLane(audio)` caía en `lanes.length` cuando no había ninguna) → `unshift` y 0,
corriendo los índices de los clips. El piso del launcher iba clavado a 500×400cm / 1920×1080 pasara lo que pasara con
los muros, mientras el previo lo dibujaba abarcando la huella real: ahora sale de los muros, a su misma densidad de
píxeles. `drawRuler` seguía con 22 cableado en cuatro sitios frente a `RULER_H=24` — que se creó justo para no tener dos
fuentes — y `.tracks{min-height:calc(100% - 22px)}` dejaba 2px de desbordamiento permanente que descuadraban el pulgar
de la barra vertical. Había DOS `hideLanding()` idénticas, con la segunda ganando por hoisting. `applyLang` traducía
File/Edit/Window pero no Project. Y el `fit()` del launcher escribía `height:100%` en línea, anulando la regla que
reserva la franja de datos — y encima medía antes de escribirlo, así que la primera pintada salía mal escalada.

**El falso positivo.** Se dijo que los grupos de la barra del visor se recortan en vez de plegarse en "More". Medido a
1600 / 1200 / 1000 / 860px: a 1200 Overlays y Quality YA están en "More", a 1000 se les une Output, y a 860 entra además
la escalada por medición. No se pierde ningún control. El bucle de medición es una red de seguridad por debajo de los
puntos de corte, que es para lo que está.

Pruebas: funcional 22/22, robustez 15/15, iconos 31/31, cero errores de consola.

## ROUND 164 — Los iconos, uno a uno, contra el handoff

Beltrán señaló que "hay íconos que no están iguales". En vez de mirarlos a ojo, dos herramientas: `icon-diff.mjs`
(extrae los 92 `<svg>` del prototipo y los 62 del catálogo `ICO()`) y, cuando la primera resultó dar demasiados
falsos positivos, `icon-bylabel.mjs`, que empareja **por el rótulo del botón** contra el DOM vivo de la app.

**El veredicto: de los 32 botones con icono del handoff, 30 existían y 28 ya eran idénticos.** Los dos que no,
más dos que faltaban:
- **Alpha** reusaba el icono de `grid` (rejilla 4×4) cuando el diseño le pone cuatro cuadrantes — que es lo que
  evoca un damero de transparencia. Icono `alpha` nuevo.
- **Add Adjustment Layer** llevaba un `+` en vez de la pila de hojas del diseño.
- **Fit** iba sin icono; el diseño le pone las cuatro esquinas. Icono `fit` nuevo.
- Y seis geometrías que estaban cerca pero no calcadas: el **ojo** de Viewer (párpado 4→3.5, pupila r 3→2.5), la
  **órbita** (rx 10/ry 4.2 → 9/4, y su centro pasa de hueco a punto macizo), la pila de **Adjust** (tres hojas → dos),
  la **papelera** (tapa 2px más estrecha), el **power** (arco r 6→8) y el **asa de puntos** (r 1.1→1.4).

Resultado medido tras aplicar: **31 de 31 iguales, 0 distintos.** El único botón del handoff que sigue sin existir
es `Simple`, el conmutador de modo Ableton que se eliminó a propósito en R155.

**Lo que NO se tocó, y por qué.** Nueve iconos del catálogo parecen no usarse, pero hay referencias dinámicas
(`ICO(k?'kfFull':'kfEmpty')`, `ICO(i.ico)` en los menús generados): `redo` sale en esa lista y sí se usa. Podar
el catálogo con una expresión regular dejaría botones sin icono en tiempo de ejecución. Queda anotado en COMPONENTS.md.

## ROUND 163 — Pasada de robustez: 15 escenarios de rotura y el suelo del modo automatización

Suite nueva (`scratchpad/robust.mjs`), distinta de la funcional: en vez de recorrer el flujo feliz, intenta
romper la app. Proyecto denso con nest dentro de nest, guardar/abrir dos veces seguidas, borrar una pista que
tiene clips, 30 deshacer y 30 rehacer, proyecto vacío, duraciones de 0/negativas/enormes, cortar justo en los
bordes del clip, bucles de secuencia, render en los tres modos, cobertura de domo en caliente, cambio de idioma
con los paneles abiertos, Alt+scroll a los dos extremos, medio ausente, copiar/pegar en cadena y un cierre que
serializa el proyecto maltratado y lo reabre. **15/15, cero errores de consola y cero excepciones.**

**El hallazgo de verdad: en modo automatización las pistas se quedaban a medias.** Al achicar con Alt+scroll
bajaban hasta 26px, los desplegables de identidad desaparecían (la cabecera los exige a partir de 52) y la pista
se quedaba ahí: ni utilizable ni plegada. Beltrán lo había pedido explícito — por debajo del mínimo tiene que
colapsar del todo. Ahora `laneFloorH(l)` es la fuente única del suelo (52 en automatización para vídeo, 26 el
resto) y la comparten `laneH`, `wheelResizeLanes` y el arrastre de la barra vertical, que antes usaba
`LANE_MIN_H` a pelo y se saltaba el suelo. Medido: **57 → 52 → plegada**, y al volver hacia arriba
**plegada → 52 con los desplegables de vuelta → 57 → … → 120**. Dos detalles más: una pista plegada sólo se
desepliega hacia ARRIBA (antes seguir bajando la rueda la reabría), y al entrar en automatización las pistas que
vienen por debajo del suelo se suben a él.

**Cuatro sustos que resultó que eran del arnés, no del programa.** Vale la pena dejarlos escritos porque los
cuatro parecían defectos serios:
- `laneH()` recibe un **índice**, no el objeto de pista. Llamarlo mal devolvía siempre 57 y parecía que
  Alt+scroll no hacía nada.
- `addClip()` recibe el **objeto** media, no el id. Con un id, `isSeqMedia` da false, el guardia de bucles ni
  se asoma y se crea un clip basura con `mediaId: undefined` — que luego aparecía como "clip huérfano" tras
  guardar/abrir. Llamado bien, los bucles directo (A dentro de A) e indirecto (A dentro de B, que ya vive en A)
  se rechazan los dos.
- Los clips de ajuste llevan `mediaId: null` por diseño; contarlos como huérfanos era un falso positivo.
- `buildDemoProject()` no colgaba: llama a `newProject`, que llama a `confirmDiscard()`. La app estaba
  protegiendo trabajo sin guardar y esperando una respuesta que en CDP no llega nunca.

**Y una comprobación que salió bien:** la pantalla de carga (`#loadingOv`, 1600×900, z-index 340) tapa la
ventana entera al abrir un proyecto, pero se cierra sola en menos de 5s en cuanto el logo completa sus dos
vueltas, con un tope de 20s por si los medios no terminan.

## ROUND 162 — Lo que se ve en los pantallazos: cinco defectos reales

Se levantó una escena de mentira (ocho formas repartidas por las pistas, carpetas en Media, un clip de audio,
dos clips con automatización) y se fotografió zona por zona. Mirar la app en vez de medirla destapó cosas que
ninguna sonda había pillado.

**`NaN°` en el inspector.** Cuando `c.props[p]` no existe —clip de un `.isp` anterior a que el parámetro se
añadiera— `evalP` devuelve `undefined` y la fila escribía `NaN°` con el surco vacío. Había ya un mapa de
valores de fábrica, pero suelto dentro del `contextmenu` de la fila; se saca a `P_DEF` y `refreshInspector` cae
en él cuando el valor no es finito. De paso el clic derecho de restablecer usa la misma fuente.

**Las etiquetas de la regla se pisaban.** El paso de etiquetado era `Math.round(66/(iv*pps))`: con los ticks a
48px eso redondea a 1 y etiqueta todos, mientras una etiqueta de timecode mide ~52px — salía
`00:00:0000:00:3000:01:00`. Es `Math.ceil`.

**El inspector de audio hablaba otro idioma.** Pomo redondo nativo para el volumen, cajas de 64px, checkbox del
sistema y un hueco de 56px cuando el medio aún no tenía picos. Pasa a la misma gramática de fila que
Transform/Source (etiqueta 60 · surco · caja), con arrastre horizontal sobre el surco y el mismo interruptor
`.iosw`; la onda sólo ocupa sitio si existe.

**El hueco de cámara reservaba 324px en 2D**, donde no hay ningún control de cámara. Esos 324px vacíos eran los
que empujaban Display y Quality al menú "More" con la barra a 1008px y sitio de sobra. Ahora sólo reserva en 3D,
que es donde su razón de ser —que al alternar Orbit ↔ Viewer no se muevan los botones que persisten— aplica.

**Y la escalada replegaba primero el `readout`**, justo lo que ese hueco existe para sostener: en Orbit acababas
con 324px reservados y vacíos. El orden pasa a `disp → qp → readout → out`. Verificado: 2D no repliega nada
(sin botón "More"), 3D Orbit muestra DIST y 3D Viewer muestra FOV+DOLLY sin que se mueva nada más.

**Comprobado y descartado:** el trapecio de fundido sobre el clip es correcto (ampliado ×3: sube en 0,4s y baja
en 0,5s); y la pista de audio no lleva selectores de automatización porque el volumen no es automatizable en
este motor — no existe `kf.volume`. No es una regresión de la paridad audio/vídeo de R156.

Prueba funcional tras cada arreglo: 22/22 pasos, 0 errores de consola.

## ROUND 161 — Revisión de código sobre R155-R160: los residuos de lo eliminado

Cinco rondas seguidas quitando cosas (Master Grade, modo Ableton, botón de modulación, Snap to Grid, resize
individual de pista, prev/next de keyframe) dejan un tipo de deuda muy concreto: **referencias huérfanas**. Se
revisó el acumulado buscando exactamente eso.

**Lo que salió limpio.** Los 266 `#id` que `app.js` consulta existen en el DOM o están guardados con `if(el)` —
ninguna rama va a encontrarse un `null`. El atajo nuevo **Alt+, / Alt+.** queda por debajo de la guarda de campos
de texto (no se dispara escribiendo) y por debajo de `Ctrl+,` (Preferences), así que AltGr —que en teclado
español es Ctrl+Alt— no colisiona con él.

**Lo que había que barrer.**
- `jumpKf(p,dir)`, el salto por parámetro, se quedó sin llamadores en R159. Archivada.
- `state.tl.snap` y `state.tl.simpleClips` seguían en el estado por defecto **y se escribían en cada `.isp`**
  aunque nadie los lee desde R158/R155. Fuera de los dos sitios; el lado de lectura ya los ignoraba.
- La regla CSS `#snapBtn{height:22px;}` apuntaba a un botón archivado en R158.

**Anotado, no tocado.** `openModPanel`/`closeModPanel`/`_modOutside` y el CSS de `.modpan` quedaron inalcanzables
al archivarse el botón `.modb` en R155. No se eliminan porque el destino del subsistema de modulación es una
decisión abierta (misma situación en la que estuvo el Master Grade entre R148 y R150).

Prueba funcional tras el barrido: 22/22 pasos, 0 errores de consola.

## ROUND 159/160 — El inspector recupera el ancho de sus faders

**Un solo botón por fila.** La fila del prototipo (RevDomo:286-290) es `etiqueta · surco · caja de valor · UN
botón de 20×20`. Nosotros teníamos tres (anterior · diamante · siguiente), y esos 40px de más salían del surco:
el fader medía 53px contra los ~125 del diseño. Se quedan sólo el diamante. Medido después del cambio:
fila 299 · etiqueta 60 · **fader 129** · caja 42 · nav 20 (1 botón). Calcado.

**El salto entre keyframes no se pierde, cambia de sitio.** `jumpAnyKf(dir)` recorre todos los parámetros
automatizados del clip seleccionado y salta al fotograma anterior/siguiente; va en **Alt+,** / **Alt+.**. El
tooltip del diamante lo anuncia. En el transport pasa lo mismo con los localizadores: el diseño tiene un único
botón "Add locator" y `,` / `.` ya navegaban entre ellos, así que `#prevMk` / `#nextMk` sobran.

**Filas de interruptor: título y switch, nada más** (R160). Las de Source (Fulldome src · Equirect 360° ·
Fisheye) y las de Playback llevaban una descripción entre la etiqueta y el interruptor. Se comía el ancho, la
etiqueta se partía en dos líneas y la fila crecía a 31px mientras sus vecinas medían 24. La descripción pasa a
tooltip de la fila y las tres quedan a 24px, alineadas con el resto del inspector.

Prueba funcional tras el cambio: 22/22 pasos, 0 errores de consola.

## ROUND 158 — Fuera "Snap to Grid" y fuera la lectura AZ/EL del visor

El imán a la rejilla y el de los objetos convivían en el mismo botón. Como en Premiere, queda **sólo el imán
entre clips y objetos**: `applySnap()` pierde su rama de rejilla, `snapGrid()` se renombra a `gridStepSec()`
(sigue dibujando la rejilla del timeline, que es lo que era en realidad: un paso, no un imán) y el botón
desaparece de la barra. Verificado: pedir 8.02s sigue pegando a 8.00 por el clip vecino.

Del visor sale la lectura de azimut/elevación, que el prototipo no tiene y ocupaba el hueco que necesitaba la
barra para no desbordar.

## ROUND 157 — Cabecera de pista con márgenes y barra del visor con hueco de cámara fijo

La cabecera pasa a dos filas en columna (`.lnrow` + `.autoctl`) con `padding:4px 8px 4px 10px`: en modo
automatización los desplegables de identidad ya no tapan el nombre ni quedan pegados al borde. La altura mínima
de pista en ese modo se limita para que quepan con margen; por debajo, la pista **colapsa entera**.

En la barra del visor, el hueco de cámara se fija en 324px (lo que mide FOV+DOLLY): al alternar Orbit ↔ Viewer
los botones que persisten ya no se desplazan, los nuevos se añaden a la derecha.

## ROUND 156 — Pistas: sin resize individual, audio colapsable, y cabecera que no se rompe al seleccionar

Se elimina el redimensionado pista a pista. Queda el triángulo de colapsar (**también en las de audio**, que lo
tenían oculto por CSS desde R110) y **Alt+scroll** como única forma de agrandar o achicar, y afecta a todas a la
vez. La extensión vertical del timeline se topa según la cantidad de pistas (`tlMaxH()`).

Al seleccionar una pista, los `<select>` altos de `autoDuo` reemplazaban a las fichas y rompían la cabecera;
ahora las fichas son siempre fichas y abren su menú con `openMenu`.

## ROUND 155 — Poda de modos duplicados, visores 3D en el launcher y menú Project

Tanda dirigida por Beltrán sobre la marcha.

**Fuera el botón de modulación del inspector.** La fila del prototipo es etiqueta(60) · surco · caja de valor · UN
botón de keyframe. El `.modb` y su arco `.modarc` se archivan. **Ojo:** el motor de modulación sigue vivo, así que
queda en el mismo estado en que estuvo el Master Grade entre R148 y R150 — sin UI para crearla, pero evaluando la
que traiga un `.isp` viejo. Anotado para decidir.

**Fuera el modo Ableton de agarre de clip.** Convivían dos modelos y un botón para alternarlos; queda sólo el de
Premiere (arrastrar desde cualquier punto). Se van `state.tl.simpleClips`, `toggleSimpleClips`, la rama del
hit-test que hacía selección de rango sobre el cuerpo del clip, el interruptor de Preferences, la entrada de la
paleta y el botón `Simple` del transport. `body.simpleclips` se fija al arrancar y no se conmuta más.

**El fade no se toca en modo automatización.** Los cuadraditos viven en la misma esquina superior donde se agarran
los keyframes: arrastrar uno era una lotería. Se ocultan por CSS y hay una guarda en el hit-test por si queda un
nodo de un render anterior. Verificado: 0 handles visibles con `body.automode`.

**El audio vuelve a nacer abajo.** Al quitar la partición por tipo en R152, `defLanes()` —que ponía el audio último
en el array— lo hacía aparecer **arriba de todo**, porque el orden de pantalla es el array al revés. Ahora va
primero en el array. Es sólo el orden INICIAL: se sigue pudiendo arrastrar a donde se quiera.

**Visores 3D en el launcher.** Nuevo `drawDomeIso(cv,cov,pal)`, hermano de `drawRoomIso`: media esfera proyectada a
mano sobre canvas 2D, con sombreado Lambert y orden de pintor. El 3D del editor es WebGL sobre `#gl` y sacarlo a un
canvas suelto obligaba a montar un segundo contexto sólo para una vista previa estática. **Se adapta al ángulo**:
la elevación arranca en −(cov−180)/2, así que a 200/210/220° la superficie baja del horizonte. Medido en píxeles
pintados bajo el centro: 180°→103, 200°→200, 220°→268. El domo pasa a tener dos paneles, como el diseño.

**Paleta monocromática en el launcher.** Beltrán la eligió para el landing: `drawRoomIso`/`drawRoomStrip`/`drawDomeIso`
aceptan un `pal` opcional (mapa rol→color) y el launcher les pasa la rampa neutra del diseño. El **editor** sigue con
`ROOM_ROLE_COL` — ahí el color por muro es información de trabajo, no decoración.

**Menú "Project".** La configuración del proyecto activo sólo se alcanzaba por el chip de formato o el menú de la
pestaña de secuencia. Ahora hay un menú propio en la barra, con entradas según el formato: ajustes de secuencia
siempre, cobertura del domo si es domo, rehacer la geometría si es sala, más nueva secuencia y preferencias.

**Un tropiezo propio:** un `.Replace` de PowerShell convirtió `$$('.clip')` en `$('.clip')` — en una cadena de
reemplazo de JS, `$$` significa un `$` literal. Rompió `applyToolCursor` en runtime (no en `node --check`). Lo
cazó la primera captura.

## ROUND 154 — Auditoría completa región por región, y sus arreglos

Barrido exhaustivo del editor contra el prototipo, midiendo en vez de mirando: se extrajeron del `.dc.html` las
declaraciones de estilo de cada región (`scratchpad/design-extract.mjs`) y se midieron los mismos elementos en la
app por CDP (`scratchpad/audit-full.mjs`). 30 diferencias, todas aplicadas.

**Dos errores más de la traducción — y de los que cambian cómo se ve.** Igual que en R149, el `.md` decía cosas que
el prototipo no dice:
- **Los overlays NO son icon-only.** El prototipo los lleva **con etiqueta** (`Grid · Outline · Horizon · Alpha`,
  10px/600, padding 0 8px). R148 los había dejado sólo con icono siguiendo la traducción. Restaurados con etiqueta.
  *(El diseño tiene cuatro; conservamos **Safe** como quinto, con etiqueta: es una función real de emisión y
  borrarla por no estar en el prototipo era perder algo, no podar.)*
- **El selector de modo se rotula "2D" y "3D" a secas** (RevDomo:137-138), con el nombre largo en el tooltip. Estaba
  como "Dome Master" / "3D Preview": 99px por botón, 177px de well. Con la etiqueta corta baja a 105 y el término de
  industria del U-42 sigue estando, al pasar el cursor.

**Medidas corregidas (todas del prototipo):**

| región | qué | antes → ahora |
|---|---|---|
| Inspector | cabecera de sección | 20 → **24px** |
| Inspector | etiqueta de fila de parámetro | 52 → **60px** |
| Inspector | surco del fader (radio) | 1 → **2px** |
| Inspector | botón Mirror | 18px/r2 → **20px/r3** |
| Inspector | padding de la cabecera de item | 11/10 → **10px 12px** |
| Transport | radio de `tbtn` / `playb` / `tcbox` | 2 → **3px** |
| Transport | timecode | 13 → **12.5px** |
| Global | radio de los wells segmentados | 2 → **3px** |
| Timeline | tool rail | 32 → **34px** |
| Timeline | barra de título del clip | 15 → **16px** |
| Timeline | cuadraditos de fade | 7×7/r2 sólido → **6×6/r1 translúcido** |
| Timeline | barras de zoom H y V | 15/9/11 → **12/5/7** (ambas) |
| Visor | botones de zoom | 25 → **24px** |

Ojo con las barras de zoom: R152 las había igualado **entre sí** (15/9/11) pero no al diseño, que las quiere en
12/5/7. Ahora coinciden con el prototipo y entre ellas.

**El colapso de la barra del visor pasa a ser por MEDICIÓN.** Al devolverle la etiqueta a los overlays, el grupo pasó
de 171 a 330px y los umbrales fijos del prototipo (620/800/980) dejaron de alcanzar: a 1440 y 1280 la barra
desbordaba. Los umbrales quedan como punto de partida, pero después se mide y, mientras `scrollWidth > clientWidth`,
se repliega el siguiente grupo en el orden de sacrificio del diseño (lecturas → calidad → overlays → Output).
Verificado a 1920 / 1600 / 1440 / 1280 / 1150: **ninguno desborda**. Esto además cierra el residual que R152 había
dejado anotado, y es robusto ante un botón nuevo o un idioma más largo.

**Sin hallazgos en Media ni Status:** las dos regiones ya coincidían con el prototipo salvo un padding de lista de
1px. Cero errores de consola en todo el barrido.

## ROUND 153 — Launcher: la pantalla de inicio del handoff, con los visores REALES del editor

Segunda mitad del handoff launcher+splash. El landing viejo eran cuatro botones que abrían los diálogos de
creación; el launcher expone **todos** los parámetros de los tres formatos y muestra el resultado antes de crear.

**La decisión que define esta ronda la puso Beltrán:** *"el código de 3D y visualizadores ya los tienes, porque los
usas en editor. Extraelos de ahí"*. El prototipo trae sus propios SVGs (fisheye con graticula, domo 3D con
proyección a mano, planta cenital, sala 3D, tira cosida) y **no se portaron**. En su lugar se reusan los painters
que el editor ya usa en los diálogos de creación:

| panel | función reusada |
|---|---|
| Máster fisheye | `drawSeqViz(cv,'dome',{cov})` — anillos de elevación, horizonte y rosa de orientación |
| Lienzo plano | `drawSeqViz(cv,'flat',{w,h})` — regla de tercios y relación de aspecto |
| Sala (3D + planta) | `drawRoomIso(cv,walls,floor,null)` — trae **las dos vistas en el mismo canvas** |
| Lienzo cosido | `drawRoomStrip(cv,walls,floor,null)` — anchos proporcionales por píxeles |

Lo que se ve en el launcher es, literalmente, lo que dibuja el editor. Y salió mejor que el plan: el visor de sala
del editor ya resuelve en un canvas lo que el diseño pedía en dos paneles separados.

**Desviación deliberada — colores de orientación.** El diseño propone una rampa neutra (Front #E4E7E9 …). Se usan
los del editor (`ROOM_ROLE_COL`), porque el visor de la derecha pinta los muros con ésos: con la rampa del diseño,
el chip de una orientación y su muro saldrían de colores distintos. Entre "más lindo" y "lo que ves es lo que hay",
gana lo segundo — que es justamente por lo que se reusan los visores.

**Detalles que costaron:**
- **Los campos numéricos no re-renderizan al teclear.** El borrador (`_lch.draft`) se escribe en `oninput` sin
  redibujar; si redibujara, el input perdería el foco en cada tecla. El commit (Enter/blur/flechas) sí redibuja y
  devuelve el foco vía `data-lk`. Mecánica del handoff completa: Enter confirma, Esc descarta, ↑/↓ ±10, Shift ±100,
  Alt ±1, y clampea.
- **`lchPaint()` va en `requestAnimationFrame`.** Llamado justo después del `innerHTML` el layout no existe todavía,
  `getBoundingClientRect()` da 0 y los canvas se quedaban en su 300×150 por defecto — pintaban, pero estirados.
- **`ROOM_ROLE_COL` se lee perezosamente.** Está definido mucho más abajo en el archivo; en una `const` de nivel
  superior saltaba la zona muerta temporal al cargar.

**Verificado por CDP:** alto idéntico en los tres tipos (panel 426×612, visor 1102×612, página 1000) y **la página no
scrollea** — el requisito duro del handoff; borrador/Enter/Esc/flechas/clamp; intercambio de orientación sin dejar
dos muros iguales; "Uniforme" escribiendo en los cuatro muros; los cuatro canvas pintados a su tamaño real; cero
errores de consola.

**Deuda anotada:** el panel de Domo del diseño lleva DOS vistas (fisheye + domo 3D) y acá va sólo el fisheye — el 3D
del editor es WebGL sobre `#gl` y extraerlo a un canvas suelto no es un copiar-pegar. En la tira cosida, el total
que dibuja `drawRoomStrip` se solapa con la etiqueta del último muro a este alto; no se tocó el painter porque lo
comparte el diálogo de sala.

**Archivado (ADR-0007):** `_backup/deprecated/20260725-landing-v1.js`.

## ROUND 152 — Pistas iguales, una sola barra vertical y barra del visor responsiva

Segunda pasada del rediseño sobre el editor, dirigida por Beltrán mientras revisaba: *"pista de audio y vídeo se
deben comportar similar, permitiendo reordenar, agrandar, achicar"*, *"en la vertical hay dos [barras], debiera
haber una como la nueva horizontal"*, *"fijate cómo Claude Design aborda las herramientas que aparecen al cambiar
entre visor 2D, 3D y viewer"*, y el splash al 70%.

**Audio y vídeo, la misma cosa.** R148 unificó la columna pero el ORDEN seguía particionado por tipo
(`lanesTopDown` reordenaba vídeo-arriba/audio-abajo) y el arrastre tenía un clamp `[R92-T8]` que impedía soltar una
pista de audio entre las de vídeo. Ambas cosas eran de cuando el audio era un módulo sticky. El prototipo lo zanja:
`trackOrder:['v4','v3','v2','v1','a1']` — **el audio está en la misma lista ordenable**. Fuera la partición, fuera
el clamp. Verificado moviendo la pista de audio al tope: queda arriba de todo (`AVVVV`), con grip y colapso como
las de vídeo. También se fueron las ramas `.audiozone` de los handlers de rueda (código muerto desde R148) y
Alt+rueda pasó a escalar TODAS las pistas, como el `onWheelH` del prototipo.

**Tamaños que estaban mal.** Alturas de pista 82→**57**, audio 41→**44**, clamp 34-260→**26-120**, colapsada
20→**24**, regla 22→**24**. El 22 de la regla estaba cableado en el CSS y en TRES sitios de JS (playhead, límite de
arrastre, brace del work-area); ahora es la constante `RULER_H`, porque desincronizarlos desalinea todo.

**Una sola barra vertical.** Había dos y no se parecían: la mía (que sólo escalaba alturas) y la scrollbar nativa de
`#tlscroll` (que sólo scrolleaba). Ahora es una sola y es el **espejo exacto de la horizontal** — 15px de barra,
thumb de 9px, dos casquetes circulares — con el mismo funcionamiento: cuerpo = scroll, casquetes = zoom anclando el
borde opuesto. La nativa se oculta.

**Barra del visor: el diseño resuelve en DOS ejes, no en uno.** El modo decide qué lectura tiene sentido (2D→Az/El ·
3D Orbit→DIST · 3D Viewer→FOV+DOLLY) — eso ya estaba bien. Lo que faltaba es que **repliega grupos enteros a un menú
"More" según el ancho de la columna**: Output 440 · overlays 620 · calidad 800 · Az/El y DIST 980. Implementado con
esos umbrales; el menú no duplica lógica, reenvía el clic al control real que quedó oculto. Medido: a 1920 todo
inline sin "More"; a 1500 cae Az/El; a 1200 caen overlays y calidad; a 900 cae Output.

**Splash al 70%** (`SPLASH_SCALE`): el lienzo sigue maquetado a 1080² y sólo cambia la escala, así que la
proporción no se toca.

**Residual anotado:** por debajo de ~380px de columna del visor la barra desborda igual (a 900px de ventana con los
dos paneles abiertos quedan 308px). El diseño no contempla ese caso porque sus paneles se pliegan a rieles de 26px,
y nuestra ventana tiene `minWidth:1100`, así que en uso real no se alcanza. Se deja anotado en vez de inventar un
umbral que el diseño no tiene.

**Archivado (ADR-0007):** `_backup/deprecated/20260725-audio-section-model.js`. Verificado por CDP con cero errores
de consola.

## ROUND 151 — Arranque en dos ventanas: splash 1080² propio → editor en 16:9

Beltrán trajo un handoff nuevo de Claude Design (`Immersive Studio Pro—UXUI.zip` → extraído en
`scratchpad/redesign/design_handoff_launcher_splash/`) con **dos pantallas**: el splash de carga y el launcher
(landing). Y una instrucción concreta sobre el arranque: *"abre en 1080x1080, termina de cargar y recién ahí abre
la app en 16/9"*. **Esta ronda cierra la pantalla 1 (splash); el launcher queda para la siguiente.**

**Cambio de arquitectura.** El splash dejó de ser una capa dentro del documento del editor y pasó a ser una
**ventana propia**. `main.js` crea `splash.html` (cuadrado, sin marco, transparente, centrado) y la ventana del
editor nace **oculta**; cuando el renderer avisa `dsp:bootReady`, se muestra el editor y recién ahí se cierra el
splash. Esto vuelve estructuralmente imposible el flash que R147 tuvo que perseguir con `body.preboot`: no se puede
ver el cromo a medio armar si la ventana ni siquiera está en pantalla.

- **1080×1080 que entra en cualquier pantalla.** El diseño es de 1080² fijos, pero en un monitor 1080p esa altura
  no cabe. El lienzo se maqueta **siempre a 1080×1080** y se escala con un `transform`, así la proporción es
  idéntica caiga donde caiga (medido: ventana 949², lienzo 1080² con `scale(0.8787)`, logo 387 = 440×0.8787).
- **Bug encontrado y corregido en el camino:** con `place-items:center` y un lienzo más ancho que la ventana, la
  pista del grid arranca en 0 y desborda a la derecha → el splash quedaba corrido ~65px y se le cortaba el borde.
  Lo delató una captura, no la medición. Ahora va `left/top:50%` + `translate(-50%,-50%)`; verificado x=0 / right=innerWidth.
- **Hitos reales, no un temporizador.** El prototipo traía un timer sintético de 7s; el README del handoff pide
  reemplazarlo por hitos de arranque de verdad. `bootMark(pct)` se dispara donde cada cosa terminó **de verdad**
  (contexto GL, warp del domo compilado, todos los programas enlazados, workspace, panel de medios, timeline +
  inspector, visores) y **sólo manda el porcentaje**: el texto lo elige `splash.html` con la tabla de umbrales del
  diseño, así no hay dos fuentes para el mismo string. El porcentaje es monótono y se topa en 91 hasta que el
  arranque termina: el 100% significa "listo", no "casi".
- **Mínimo en pantalla (2.4s).** El arranque real tarda ~1.4s y el splash no puede ser un parpadeo — el splash
  viejo hacía lo mismo con sus 2 vueltas de logo.
- **16:9 sobre el área ÚTIL.** `useContentSize:true`: medido sin él daba 1584×861 (1.84) porque Electron dimensiona
  con marco. Con él, el contenido es exactamente **1600×900**. Es el tamaño de ARRANQUE; la ventana sigue siendo
  redimensionable.
- **Salvavidas.** Si el renderer nunca avisa (cuelgue) o se muere durante el arranque, `BOOT_TIMEOUT_MS` (25s) y
  `render-process-gone` muestran la ventana igual. Sin eso, un fallo de arranque = app invisible.
- **Trampa de empaquetado.** `package.json › build.files` es una **lista explícita**: hubo que agregar `splash.html`
  y `splash-preload.js`. Sin eso el `.exe` arrancaría sin splash y esperando un `bootReady` que nunca llega.

**Archivado (ADR-0007):** `showSplash` + su CSS → `_backup/deprecated/20260725-in-page-splash.js`. `startLogoLoop`
y `preloadLogoFrames` NO se archivan: los siguen usando la pantalla de carga de proyecto y la de inicio.
**Decisión registrada:** [ADR-0009](docs/adr/adr-0009-arranque-en-dos-ventanas.md) — es cara de revertir (toca
main.js, el empaquetado y deshace el enfoque de R147), así que queda escrita con sus reglas y sus trampas.

**Verificado por CDP:** splash presente a los ~0.8s, las dos ventanas conviven hasta los ~3.6s, splash cerrado a los
~4.0s; editor 1600×900 (16:9 exacto), `preboot` quitado, landing pintado, contexto GL vivo, `showSplash` ya no
existe, cero errores de consola. Progreso muestreado: 26% "Initializing dome projection" → 38% "Building timeline
engine" → 80% "Restoring workspace" → 100% "Ready" + fundido.

## ROUND 150 — Master Grade fuera del código (cierra la deuda abierta por R148)

Decisión de Beltrán, sin rodeos: *"Eso nunca lo voy a aplicar, no me interesa. Que salga del code y se vaya a
deprecated."* Y sin proyectos activos, así que no hay compatibilidad que preservar.

Era el estado peor de los tres posibles: R148 sacó la **UI** (el diseño "Rev 1" no tiene sección Master Grade) pero
dejó el **motor** vivo, así que un `.isp` viejo con grado guardado se seguía renderizando graduado **sin nada en
pantalla que lo dijera y sin forma de resetearlo**. Ahora sale entero.

**Archivado (ADR-0007), verbatim y con encabezado:** `_backup/deprecated/20260725-master-grade-engine.js` —
shader `_MGFS`/programa `_MG`/`_MGu`, `_masterClip`, `_mgRT`/`_mgTarget`, `masterGradeOn()`, `applyMasterGrade()`,
`state.seqGrade`, el CSS huérfano de `#insMaster`, y los **seis call-sites** con su ubicación: preview (`render`),
`ndiTick`, `spoutTick`, `renderExportFrame`, `saveActiveSeq`→`s.grade`, `loadSeqIntoState`, más los dos trozos de
`preloadLUTs` (LUT de la secuencia activa y LUT por nest) y el `grade:` de `serMedia`. Restaurarlo requiere **los dos**
archivos en orden: primero el motor, después `master-grade-ui.js`.

**Verificado por CDP tras sacarlo:** los siete símbolos (`applyMasterGrade`, `masterGradeOn`, `_masterClip`, `_mgRT`,
`_MG`, `_MGu`, `renderMasterGrade`) ya no existen · `state.seqGrade` es `undefined` · el contexto WebGL no se pierde y
`render()` sigue · la sección **Color por clip queda intacta** (Exposure/Contrast/Saturation/Temp/Tint/Glow/Chroma +
3 ruedas lift/gamma/gain + LUT) · `serProject` ya no escribe `grade` · y **un `.isp` viejo con `grade` puesto —
incluso con una ruta de LUT inexistente— abre sin romper**: el campo se ignora. Cero errores de consola.

**Sobre el export:** la línea era `masterGradeOn()?applyMasterGrade(_exTex,SR):_exTex`, y `masterGradeOn()` era
siempre falso desde R148 (sin UI, defaults identidad). O sea que la rama viva ya era `_exTex`: el export es idéntico,
no hace falta re-verificar un render largo.

## ROUND 149 — Auditoría del rediseño "Rev 1" y sus arreglos

Barrido por CDP a 1920×1080 de las etapas 0-5 contra el prototipo, con informe en **`AUDITORIA-REV1.md`** y scripts
en `scratchpad/audit-rev1-{a..e}.mjs` (medición) y `scratchpad/verify-audit-fixes.mjs` (verificación). Cero errores
de consola en todos los pases.

**Lo primero que encontró la auditoría fue un problema con la auditoría.** El primer barrido se hizo contra
`REDISEÑO-UI.md`, que es una **traducción** del handoff, no el handoff. Cuatro de los nueve hallazgos resultaron
**falsos**: el `.md` describía cosas que el prototipo no tiene. Al verificar cada hallazgo contra el `.dc.html`
antes de tocar código, la app estaba bien y el que estaba mal era el documento:
- *"El menú no está unificado"* — el prototipo (`RevDomo:32-35`) tiene los **mismos tres botones** File · Edit · Window.
- *"El selector de modo no está en la top bar"* — en el prototipo tampoco: vive en la barra del visor.
- *"Los labels de la Create row nunca aparecen"* — el prototipo hace `createLbl: S.mediaW<340 ? 'display:none':''`
  con `mediaW:288` por defecto: **en el diseño tampoco se ven** al ancho por defecto. Nuestro umbral equivale a
  ~338px de panel, correcto dentro de 1.5px.
- *"El chip de parámetro trunca"* — el prototipo usa el mismo `flex:1;min-width:0` con elipsis y el mismo `hdrW:168`:
  la elipsis es intencional.
Las cuatro secciones equivocadas de `REDISEÑO-UI.md` quedaron corregidas, con nota de qué decían antes. **Regla que
queda: ante cualquier duda manda el `.dc.html`; el `.md` es un índice para navegarlo, no la fuente.**

**Alturas y superficies de barra (§0).** El diseño fija 28px para toda barra y 22 para el status; había cinco fuera:
header de Media 26→28, header de Inspector 26→28 (comparten `.panhead`), transport 30→28, status 24→22, y el well de
edición `#tlEditSeg` 18→22 con botones de 16 — era el único de los once wells fuera de medida. `.zoomgrp` y `#snapBtn`
igualados a 22. Superficies verificadas una por una: top bar `#1B1B1B`, headers `#111111`, **sólo el transport**
`#242424` (token nuevo `--bar`), status `#1B1B1B`. Mi primera lectura decía "top bar y transport en `#242424`" y era
media verdad — el prototipo pone la top bar en el mismo gris del panel.

**La barra del visor ya no salta (§3).** El grupo de cámara 3D era el **segundo** del clúster izquierdo, así que al
entrar en 3D corría todo lo de su derecha: `dispSeg` +151px, `qualitySeg` +152, `proxyToggle` +152. En el prototipo
(`RevDomo:154-158`) es el **último** del clúster, justo antes del `flex:1`; movido allí. Medido después: dispSeg 494 y
qualitySeg 681 en 2D **y** en 3D, sin overflow. De paso, el "residual de 30-50px" que arrastraban las notas **no
existía**: la barra usa ~1224px de 1328.

**Source y Playback con toggles (§4).** El `.iosw` del diseño (26×15, knob de 11, verde `#4A8D6F` al on) estaba
**bien construido pero sólo se usaba en Preferences**; el inspector seguía con checkboxes nativos. Ahora Source
(Fulldome src · Equirect 360° · Fisheye) y Playback (Loop · Reverse) usan la forma de fila del prototipo: etiqueta ·
descripción apagada · switch a la derecha. `Amount` del fisheye pasó a **su propia fila y sólo cuando Fisheye está
encendido** (`RevDomo:317-319`), en vez de un campo numérico semi-transparente pegado al checkbox.

**La búsqueda de media vuelve a existir (§2).** `#mediaSearch` había quedado `display:none` en R148, así que
**Ctrl+F era un no-op**. `showMediaSearch(on)` es ahora la única puerta: revela un campo real en la fila de filtros
apartando el well de filtros para ocupar la fila (200px útiles sobre un panel de 292), abre el panel si estaba
plegado, y Esc lo cierra **limpiando el filtro** — para que no quede un panel filtrado sin nada en pantalla que lo
explique.

**Hint de herramienta en el status (§7).** `#statInfo` ya existía (barra de ayuda al hover, R102) pero se vaciaba sin
hover, y el diseño muestra siempre la pista de la herramienta activa. Ahora `setInfo(null)` cae a
`TOOL_HINTS[state.tl.tool]` reusando el mismo parser (`Nombre (ATAJO) — descripción`), sin segundo camino de código;
`setTool` y `applyLang` lo repintan. Los valores de `TOOL_HINTS` son **funciones**, no cadenas, para que `T()` se
reevalúe al cambiar de idioma.

**Cosmética.** `.mmeta`/`.selmeta` de 11 a 10px — ojo: el uppercase **sí es del diseño** (`RevDomo:275`), sólo que se
tolera únicamente a 10px, así que mi hallazgo original ("quitar el uppercase") habría sido un error. Título de sección
`Dome · Transform` → `Transform`. Tooltip de `Fit`, que prometía "(H·W)" cuando `fitAll()` sólo ajusta el horizontal.
`#roomOutBtn` de 24 a 22px.

**Desviación deliberada anotada:** el prototipo pinta el status en `#8C8C8C`; se deja en `--ink-2` porque el token
dice explícitamente que `#8C8C8C` no es texto de cuerpo (Lc −38) y R102 ya subió los textos que estaban ahí.

**Gotcha del propio trabajo:** un comentario `//` metido a mitad de una sentencia de una sola línea (la de
`#roomOutBtn`) se comió el resto, incluidas dos llaves de cierre → `node --check` cayó con "Unexpected end of input"
al final del archivo. En un `app.js` de líneas largas, los comentarios inline van al final de la línea o en `/* */`.

**Deuda que queda:** Master Grade sigue dormido (motor vivo, sin UI para editarlo ni resetearlo — decisión de
Beltrán); tres checkboxes nativos sueltos que el diseño no cubre (`#bkToggle`, `#txtStroke`, `#motionPrev`); el
waveform de audio no se pudo verificar (el clip inyectado es sintético, sin picos decodificados); y falta el juicio
visual con la ventana al frente, porque las capturas de píxel salen negras con la ventana en segundo plano.

## ROUND 148 — Rediseño "Rev 1" (Claude Design): etapas 0-5 (tokens · shell · inspector · transport · timeline)

Recreación de la UI **calcada** al handoff de Claude Design (`scratchpad/redesign/design_handoff_immersive_studio/`,
prototipo React que **no se porta** sino que se recrea en `index.html`+`app.js`). El spec maestro vive en
**`REDISEÑO-UI.md`** (§0 reglas globales · §1 top bar · §2 media · §3 visor · §4 inspector · §5 transport · §6 timeline
· §7 status), con las refs `RevDomo:NNN` al prototipo. Regla transversal de Beltrán: **lo que no está en el diseño se
saca** — y por la política del proyecto (ADR-0007) **se archiva, no se borra**.

**Tokens y componentes base (§0).** Nuevos `--well-deep`, `--toggle-on` (verde `#4A8D6F`), `--react-blue` y el
**sistema de color por parámetro** (`--p-az/--p-el/--p-size/--p-rot/--p-op/--p-exp/--p-sat`): el mismo hue en el fader,
el diamante de keyframe y la curva de automatización. `--danger` a `#E06C6C`. Componentes nuevos: `.well` (segmentado
hundido 22px con botones de 16), `.crbtn` (botón de "crear"), `.ddbtn` (disparador de dropdown). Toggle switch
rediseñado a **26×15 con knob de 11px y ON verde**. Ítems de menú a 26px. **Sin MAYÚSCULAS shouty**: fuera
`text-transform:uppercase` de `.sechead .t`, `.fxsec`, `.cwlab`, `.grphead2`, `.mpsub`, `.rs-sec`, `.rs-hdr`.

**§1 Top bar.** Fuera los botones sueltos New / Open / Save / Export (viven en el menú File); queda nombre de proyecto +
chip de formato + `?`. El wiring se conserva **blindado** (`if($('#saveBtn')){…}`) para que atajos y menú sigan.

**§2 Panel Media.** Well **List/Grid** (`#mediaViewSeg`) en el header; fila de filtros como well + **dropdown Sort**
(`#mediaSortBtn`, `MEDIA_SORTS` name/date/type) que **reemplaza** el segmentado Group None/Folder/Type; **Create row**
con `Import` primario + Text · Shape · Compose · Adjust, cuyos labels colapsan a icono por *container-query*.
El buscador visible y el botón "New folder" salen de la vista (nodos ocultos para no romper wiring).

**§3 Barra del visor.** Overlays Grid/Safe/Outline/Horizon/Alpha pasan a **icon-only** con tooltip; los cuatro botones
sueltos Full performance · Viewer window · NDI · Spout se consolidan en un **dropdown Output** (`#outputBtn`) con punto
pulsante mientras NDI/Spout emiten (`refreshOutputInd`).

**§4 Inspector.** Tabs Inspector / Reactive FX dentro de un well. **Dos secciones nuevas**, que recogen filas que antes
estaban sueltas: **Source** (`#sourceRows`: Fulldome src · Equirect 360° + Tilt · Fisheye + Amount — sólo domo) y
**Playback** (`#playbackRows`: Loop, reverse/ping-pong y un **Speed por-clip** nuevo, `c.speed`, sólo para media con
tiempo). Ambas cabeceras se ocultan cuando la sección queda vacía (clips flat no tienen proyección; las imágenes fijas
no tienen loop). Ojo: `#sourceRows`/`#playbackRows` son destinos de `appendChild` y `buildRows` sólo
limpia tf/fx/color → hay que vaciarlos en cada render o las filas se acumulan. Los faders se pintan en el hue del
parámetro (`--pc` = `autoColor(p)`), igual que su diamante.
**Poda:** la sección **Master Grade** completa (`renderMasterGrade` + `#insMaster`) se archiva en
`_backup/deprecated/master-grade-ui.js` — el diseño no la tiene y el grado se edita por clip en **Color**. **Sólo la
UI**: el motor (`state.seqGrade`, `masterGradeOn`, `applyMasterGrade`, `_masterClip`, persistencia `saveActiveSeq`→
`s.grade`) sigue vivo, así que los grados guardados en `.isp` existentes se siguen aplicando.

**§5 Transport = donde viven las secuencias.** `#seqTabs` se **mueve del timeline a la barra del play** (zona
izquierda, estilo well compacto con scroll horizontal y tope del 36% del ancho). A la derecha, well de edición
`#tlEditSeg` con **Simple · Auto · Grid · Fit**: `Grid` (`#tlGridBtn`) muestra/oculta las líneas de grilla
(`state.tl.gridOn`, default on → proyectos viejos sin cambio) y `Fit` (`#fitAllBtn`→`fitAll()`) encaja toda la
duración en el ancho visible. `Auto` es el `#curvesBtn` de siempre; `Snap` queda fuera del well.

**§6 Timeline.** Cambio estructural: **vídeo y audio unificados en UNA sola columna** (`#tracks`/`#laneHeaders`, audio
al final). Se acabó el módulo de audio sticky: `#audioZone`/`#audioHeadZone` se vacían y ocultan en cada render y
desaparece la barra colapsable "AUDIO". Consecuencia buscada: **las pistas de audio se comportan como las de vídeo** —
`laneH` chequea `collapsed` ANTES que `kind==='audio'` y clampa `l.h||AUDIO_LANE_H` a [MIN,MAX], y el grip de resize se
cablea para todas las pistas (antes, sólo vídeo). Además: chooser de automatización de la cabecera rediseñado como **2
chips** (Effect-type + Parameter con swatch 6×6 del color del parámetro); **fade = cuadraditos** en las esquinas
superiores del clip (no círculos); **V-zoom lateral** (`#tlVZoom`/`renderVZoom`, columna de 12px a la derecha) que
escala la altura de TODAS las pistas de una; cabecera de pista **152→168px** (los chips truncaban); `.rulerpad` con
`flex-shrink:0` para conservar sus 22px ahora que quedó vacía (si no, headers y lanes se desalinean 9px).

**Deuda abierta anotada (entra a la auditoría):** (1) `#mediaSearch` quedó `display:none` → **Ctrl+F es un no-op**, la
búsqueda no tiene entrada de usuario; (2) Master Grade queda dormido y sin forma de resetearse; (3) el tooltip de `Fit`
promete "(H·W)" pero `fitAll()` sólo ajusta el horizontal; (4) residual §3: el grupo de cámara 3D todavía puede empujar
la barra del visor ~30-50px al cambiar 2D↔3D. Etapas 6 (launcher) y 7 (variantes 360/2D) sin empezar.

**Nota de higiene:** `app.js` se había reescrito con finales de línea LF (el repo lo guarda en CRLF), lo que inflaba el
diff a ~14.500 líneas de ruido. Se normalizó a CRLF antes de commitear → el diff real es de ~200 líneas.

## ROUND 147 — Arranque limpio: sin flash del editor (splash → destino)

Dos flashes del editor durante el boot, confirmados frame-a-frame extrayendo cuadros del video del usuario con ffmpeg
(y verificados en dev por captura CDP cuadro-a-cuadro):
- **Al final del loop del logo:** `showSplash.finish()` hacía fade-out del splash y **luego** llamaba `onReady()` (que
  pinta el inicio). Durante el fade, detrás del splash que se desvanecía estaba el **editor** (el inicio aún no pintado) →
  ~0.27s de editor antes del inicio. **Fix:** `finish()` llama `onReady()` **antes** del fade → el inicio (opaco, z-300)
  se pinta bajo el splash (z-360); el fade revela el inicio, nunca el editor. Determinista.
- **Antes del splash:** el HTML estático de `#app` se pinta antes de que `app.js` corra y monte el splash → flash del
  chrome del editor al arrancar. **Fix:** `<body class="preboot">` + CSS `body.preboot #app{visibility:hidden}` (los
  overlays viven fuera de `#app`, no se afectan; el body queda oscuro `var(--bg-1)`); `showSplash` quita `preboot` al
  montarse (síncrono → sin paint con `#app` visible-sin-cubrir). Arranque = oscuro → splash → destino, sin editor nunca.
- **Verificado:** captura CDP del boot en dev — primer paint oscuro (no editor), transición splash→inicio directa sin
  editor intermedio. (El video original mostraba el bug en el build `8eee21f`, previo a estos fixes.)

## ROUND 146 — [I2·Motion] efectos reactivos como no-reactivos en la sección Motion del inspector

Última pieza del rediseño del inspector (sección 4 del doc): los mismos efectos de `c.fx` que hoy viven en la pestaña
**Reactive FX** ahora también se editan en la sección **Motion** del inspector como efectos **no-reactivos** (estáticos +
automatizables), quedando Reactive solo como el lugar donde esos efectos corren **live al audio**.

- **Un solo array, dos vistas:** `fxCardHtml(c,f,reactive)` — `reactive=true` = tarjeta completa (Routing banda/modo/inv +
  Response int/amt/atk/rel/curve/spring + Parameters); `reactive=false` = tarjeta **Motion**: solo **Intensity** + los
  **Parameters** del efecto, todos con diamante de keyframe (kf `fx:<id>:<param>`), sin ruteo de audio ni lámpara de señal.
- **Wiring generalizado (reuso, sin duplicar):** `wireReactiveChain(c)` → `wireFxCards(c,'#arChain',renderReactivePanel)`;
  la sección Motion usa `wireFxCards(c,'#motionFx',renderInspector)`. Los controles solo-reactivos (`.fxband/.fxmode/.fxinv/
  .fxshape/.fxdiv`) no existen en la tarjeta Motion → sus guardas `if(el)` simplemente no hacen nada. `fxDragHandle` y
  `fxEditVal` parametrizados (`sel`/`reRender`; `fxEditVal`→`renderInspector`, superset que refresca ambos paneles).
- **Add Effect en Motion:** `openFxMenu(e,true)` → `addFxToClip(c,key,true)` crea un efecto **estático visible**
  (`int=100, band='none'`; se puede volver reactivo luego desde la pestaña Reactive). El add reactivo normal sigue igual
  (`int=0, band='bass'`).
- **Modelo unificado:** intensidad renderizada = `clamp01(int/100 + amt/100·mod_audio)` — Motion controla el piso estático
  `int`; Reactive suma la modulación de audio. Un mismo efecto puede ser ambas cosas.
- **Guardas:** la sección Motion solo se construye para clips visuales (audio y capas de ajuste retornan antes).
- **Verificado por CDP:** tarjeta Motion sin `.fxband`, con Intensity + param `size`; el mismo efecto en Reactive SÍ trae
  `.fxband`; kf de param crea `fx:id:size` + carril de automatización en la pista; regresión del panel Reactive intacta
  (add reactivo = `int:0/band:bass/amt:100`, medidor y render sin error). Captura en `scratchpad/motion-fx2.png`.
- **Ajustes de `/code-review` (5 hallazgos, aplicados y re-verificados):** (1) add desde Motion pasa a `int=60` en vez de
  100 → deja headroom para que el audio empuje por encima si luego se hace reactivo; (2/5) nuevo **`renderMotionFx(c)`**
  acotado = reRender propio de la sección Motion (los edits reconstruyen solo `#motionFx`, no todo el inspector — igual que
  `renderReactivePanel` aísla su panel; `fxEditVal` recibe el `reRender`); (4) clave de colapso `_fxCollapsed` **namespaced
  por vista** (`m:` para Motion) → colapsar en un panel no mueve el otro. (3, construir tarjetas con la sección colapsada,
  se dejó: bajo impacto). Verificado por CDP: kf en Motion NO llama `renderInspector` (0×), colapso desacoplado, panel
  Reactive intacto.

## ROUND 145b — Ajustes de la revisión de código (R144/R145)

`/code-review` (high effort) sobre `f17f895` → 6 hallazgos, **todos corregidos y re-verificados** por CDP:
- **#1 (correctness)** — el tour `#tourOv` estaba a `z-index:500`, por encima de los diálogos `.overlay` (z-50): un
  confirm de cierre (proyecto sucio) durante el tour quedaba tapado e inclicable. → **z-45** (sobre el chrome de la app,
  **debajo** de los diálogos). Verificado: `getComputedStyle(#tourOv).zIndex===45 < 50`.
- **#2 (robustez)** — `startOnboarding` era fire-and-forget sin try/catch: si `buildDemoProject` tiraba, no salía ni el
  tour ni el landing → editor en blanco, flag sin fijar, reintento cada arranque. → try/catch que cae a `showLanding()`.
  Verificado forzando un throw: `crashed:false, landingShown:true`.
- **#3 (copy)** — el relanzado desde **Window → Guided tour** mostraba copy del demo ("This demo scene is yours…") sobre
  el proyecto real del usuario. → `tourSteps(demo)`/`startTour(demo)`: `true` en primera apertura (menciona el demo),
  `false`/ausente en el relanzado (copy genérico). Verificado: `tlGenHasDemo:false, tlDemoHasDemo:true`.
- **#4 (eficiencia)** — `arDrawMeter` creaba 32 `createLinearGradient` por frame en el rAF. → **un solo** gradiente
  vertical compartido por todas las barras (barra más alta llega más claro; mismo look). Re-verificado por captura.
- **#5 (simplificación)** — `_demoAddShape`/`_demoAddText` duplicaban la cola push+addClip+props → extraída `_demoPlace`.
- **#6 (cosmético)** — fallback `cv.clientHeight||54` desfasado (el canvas es 62) → `||62`.

## ROUND 145 — [D7] Onboarding (proyecto-demo de primera apertura + tour guiado)

Al abrir por primera vez (flag `dspOnboardV1` ausente en localStorage) la app ahora **salta el landing**, arma un
**proyecto-demo domo** desechable y lanza un **tour de coach-marks**. Omitible, no reaparece, relanzable desde el menú.

- **Proyecto-demo (`buildDemoProject`):** `await newProject('dome',4096,4096,60,180)` + una escena de referencia — título
  de texto "IMMERSIVE" arriba y tres formas básicas (elipse / rectángulo / línea) repartidas por el domo en las pistas
  V1–V4 con arranques escalonados (helpers `_demoAddShape`/`_demoAddText`, que fijan `props.az/el/size` del clip domo).
  `clearAllUndo()` + `dirty=false` → un demo no molesta con "sin guardar" al cerrar. Playhead a 2s (todas las formas activas).
- **Tour (`startTour`):** overlay `#tourOv` transparente (traga clics sobre la app durante el tour) + un **foco recortado**
  (`box-shadow:0 0 0 9999px` sobre un `div` posicionado en el `getBoundingClientRect` del objetivo, `pointer-events:none`)
  + tarjeta con título/cuerpo/contador y botones Saltar/Atrás/Siguiente. 5 pasos: bienvenida (centrada, sin objetivo) →
  visor `#stage` → timeline `.timeline` → inspector `#inspPane` → export `#exportBtn`. Teclado Esc/←/→/Enter. Reposiciona
  en `resize`. Respeta movimiento reducido (sin transición del foco). El flag se fija sólo al **saltar o terminar** (`end()`).
- **Enganche:** callback de `showSplash(2,…)` → `!onboardDone() ? startOnboarding() : showLanding()`. Relanzable desde
  **Window → Guided tour** (`startTour`, **no destructivo** — no reconstruye el demo). Ícono de menú `flag` (no existe `help`).
- **Verificado por CDP** (`scratchpad/verify-onboard.mjs`): el demo arma 4 clips (texto+3 formas) en domo; el foco encaja
  exacto sobre `#inspPane` (1278,22,312×469 vs panel 1284,28,300×457, +6px pad); finish quita el overlay y persiste el flag;
  el relanzado desde menú abre el tour sin tocar los clips. Capturas en `scratchpad/onboard-*.png`.

## ROUND 144 — [X1] Rediseño del ecualizador (Reactive FX → analizador de espectro)

El medidor de audio `#arMeter` del panel Reactive FX (sección "Audio Engine") era 4 barras planas en gris
(BASS/MID/TREB/BRT). Se rediseñó como un **analizador de espectro real de 32 bandas logarítmicas**.

- **Fuente de datos:** reutiliza el FFT que ya construía el selector de frecuencias (`m.spec`, 32 bins log 40 Hz–12 kHz).
  Nuevo helper `specColAt(t,into)` samplea esa columna en el playhead con la misma ganancia/puerta que el resto del motor
  (interpola entre frames; buffer reutilizado `_arSpecBuf` → sin alloc por frame). Devuelve `null` hasta que el FFT está
  listo (se calcula tras las bandas).
- **Painter `arDrawMeter`:** barras con relleno-gradiente iluminado por energía (más fuerte = tope más claro), **picos
  con caída lenta** (`_arPeaks` peak-hold), regla de frecuencias 100/1k/10k, línea base, escarcha de onset y el punto de
  latido fase-bloqueado al BPM (conservados). **Nítido a cualquier ancho / hi-dpi:** respalda el canvas con píxeles de
  dispositivo (DPR) y dibuja en px CSS. Esquinas redondeadas vía `_rrect` (native `roundRect` con fallback a `rect`).
- **Fallback elegante:** mientras el FFT se calcula, pinta las 4 bandas (con etiquetas, vía `bandLevelAt`) con la misma
  estética. Sin fuente de audio → medidor vacío inofensivo.
- **Canvas** subido de 54→62px de alto para el analizador.
- **Verificado por CDP** (`scratchpad/verify-eq.mjs`): inyecté un espectro sintético + `_arCache` y volqué el PNG del
  canvas — ambos caminos (espectro de 32 bandas y fallback de 4) pintan sin excepción.

## ROUND 143 — Barrido de deuda técnica #2: automatización muerta (archivada, no borrada)

Segundo barrido bajo la política "archivar, no borrar" (ADR-0007). Se mapearon con **arch-explorer** (subagente aislado)
los tres sistemas de automatización que convivían, para separar lo vivo de lo residual **antes** de tocar nada.

- **Hallazgo clave:** el render de sub-carriles apilados (`appendAutoLanes`) ya estaba **neutralizado por `[A5]`** — la
  función arrancaba con `return;`. Así que todo su cuerpo (L4003-4025) era **inalcanzable**. `lane._auto` (el array) sólo
  conservaba mantenimiento residual: creación por menú, filtrado al borrar FX y serialización.
- **Archivado** (`_backup/deprecated/20260723-automation-sublanes-and-clip-auto.js`, recuperable con encabezado
  origen/motivo/restaurar) y quitado de `app.js`:
  - `lane._auto`/`lane._autoH`: `appendAutoLanes` + `laneAutoH` (render muerto), `addAutoLaneAt`/`addAutoLane` (creación),
    su llamada en `renderTimeline` (L1999), el filtro en el borrado de FX, y el ítem de menú "Show automation in a new lane"
    (que sólo duplicaba "Show automation").
  - `c._auto` (lista legacy a nivel de clip, "no longer rendered"): `closeAuto` + sus 2 llamadas (los llamadores
    re-renderizan igual), la copia en `sepAuto`, y `c._auto=[]` en `returnToDefault`.
- **INTACTO** (modelo vigente [A5]): `lane._autoP` + `laneAutoP` + `openAuto` + `attachClipAuto` + el chooser de la
  cabecera de pista — una sola superposición por pista.
- **Sin migración:** la data vieja (`lanes[]._auto`/`c._auto`) en `.isp` guardados queda ignorada, es inofensiva.
- **Verificado por CDP:** los 5 símbolos removidos → `undefined`; los 6 vivos → `function`; `renderTimeline()` y
  `render()` OK (glFallback false). `node --check` OK.



## ROUND 142 — [R1] Render in-site sobre una selección de tiempo

El "render en el sitio" (R115) horneaba un clip/nest. Ahora también hornea una **selección de tiempo (in/out)**.

- **`renderRangeInPlace()`** (app.js, junto a `renderInPlace`): toma el rango `[selA,selB]` (o `workIn/workOut`), hornea el
  **composite COMPLETO** sobre ese rango (sin `isolateClips` → incluye capas de ajuste = aplanado real) a un MP4 liviano
  en `rendered clips/`, lo importa y lo coloca como un clip en una **pista de vídeo nueva arriba** que cubre `[a,b]`.
  **No destructivo:** las fuentes quedan debajo (⌘Z revierte). Reusa `ripFormatDialog`/`addVideoFromPath`/`makeClip`.
- **Menú de clip:** se añade "Renderizar la selección en el sitio…" cuando existe una selección de rango
  (`selA/selB` con span > 1e-3), junto al "Renderizar en el sitio…" del clip.
- **`runExport`**: `range:'clips'` sólo apaga `useIO`; `rangeT` manda los tiempos; sin `isolateClips` → `state.clips`
  intacto → aplana todo. La pista nueva se agrega con `push` (mantiene válidos los `clip.lane` existentes).
- **Verificado por CDP** (nivel integración): app carga (glFallback false), `renderRangeInPlace`/`renderInPlace` existen,
  y el guard "sin selección" no lanza ni agrega pista. El render real reusa la maquinaria probada de `renderInPlace`.
  `node --check` OK.



## ROUND 141 — Grado máster de secuencia · Fase 2b (curvas) → feature COMPLETA

Última pieza del grado máster: el **editor de curvas** (luma + R/G/B). El motor ya lo soportaba (rama `hasCurve` del
shader + `bindClipCurve` vía `_masterClip`); faltaba sólo la UI.

- **UI** (`renderMasterGrade`): canvas `.mgcurvecv` + pestañas de canal `.mgctab` (l/r/g/b) + reset, replicando el editor
  de curvas de clip pero escribiendo `state.seqGrade.curves` y horneando con `markCurveDirty(_masterClip)` (el cache de
  textura de curva vive en `_masterClip`, lo reconstruye `clipCurveTex` dentro de `bindClipCurve`). Reusa la CSS
  `.curvecv`/`.ctab`.
- **Verificado por CDP:** canvas + 4 pestañas + reset presentes; añadir/arrastrar un punto → `masterGradeOn()` true;
  `render()`→`applyMasterGrade`→`bindClipCurve`→`clipCurveTex(_masterClip)` construye y muestrea la textura sin throw;
  reset → identidad. `node --check` OK.
- **Grado máster: COMPLETO** — numérico + ruedas + curvas + LUT, en preview/export/NDI/Spout, por-secuencia y persistido.

## ROUND 140 — Grado máster de secuencia · Fase 2a (ruedas + LUT + NDI/Spout)

Extensión del grado máster (R139). El refactor `L` de R138 (que hizo `bindClipLUT/Grade/Curve` parametrizables por struct
de ubicaciones) permite ahora **reutilizar TODA la cadena de grado de clip** para el máster — casi gratis.

- **Motor:** `_MGFS` pasa del bloque numérico al **bloque completo de FSW** (numérico → lift/gamma/gain → curvas → LUT;
  sin mask/blur/glow; alpha preservado). `_MGu` usa los MISMOS nombres de campo que el struct `L`, y `_masterClip =
  {props: state.seqGrade}` actúa de "clip" → `applyMasterGrade` llama `bindClipLUT(_masterClip,_MGu)` y hereda ruedas +
  curvas + LUT sin reimplementar nada.
- **UI** (`renderMasterGrade`): se añaden **3 ruedas** lift/gamma/gain (handlers frescos sobre `state.seqGrade`, reusan la
  CSS `.cwheel`) + fila **LUT** (cargar `.cube` / mezcla / quitar, vía `loadLUT`/`_lutReg` como los clips).
- **NDI/Spout:** `ndiTick`/spout-tick ahora gradúan la textura del FBO y leen de `_mgRT.fbo` → el broadcast también lleva
  el grado máster (WYSIWYG con el preview/export).
- **Persistencia:** `state.seqGrade` gana `cgLift/cgGamma/cgGain/lut/lutMix/curves`; viajan solos en el `Object.assign` de
  `loadSeqIntoState` y el spread `{...md}`. `preloadLUTs` extendido para recargar las LUT máster de cada secuencia.
- **`masterGradeOn`** extendido: activo si numérico ≠ 0 **o** alguna rueda ≠ 0 **o** hay LUT **o** curvas no-identidad.
- **Alcance:** falta la **UI de curvas** máster (fase 2b; el motor ya la soporta vía `hasCurve`).
- **Verificado por CDP:** shader extendido compila (glFallback false), UI con 5 sliders + 3 ruedas + LUT, arrastrar rueda →
  `masterGradeOn()` true, `render()`→`applyMasterGrade`→`bindClipLUT(_masterClip,_MGu)` sin throw, reset OK. `node --check` OK.

## ROUND 139 — Grado máster de secuencia (fase 1: numérico)

Idea propia de Beltrán de la cola diferida: un **grado global sobre el composite final**, además del por-clip. Fase 1
entrega el grado numérico (exposure/contrast/saturation/temperature/tint) completo y verificado.

- **Motor:** shader `_MGFS`/programa `_MG` + `applyMasterGrade(inTex,size)` — un post-pass full-screen con el MISMO
  bloque numérico que FSW (así el máster iguala al grado por-clip que el usuario ya conoce). `masterGradeOn()` → si el
  grado es identidad, `applyMasterGrade` devuelve la textura sin tocar (coste cero; proyectos existentes sin cambio).
  Alpha preservado (el surround del domo sigue transparente).
- **Inyección:** preview en `render()` (`_srcTex=applyMasterGrade(...)` **después** del bloque composite/render-ahead →
  editar el grado es en vivo, no se hornea en el caché; lo ven 2D/domo/sala/visor) + export en `renderExportFrame`
  (gradúa `_exTex` antes del blit PB → **el export iguala al preview**). Composite siempre cuadrado (`compSize`/`SR`).
- **Datos + persistencia:** `state.seqGrade` por-secuencia; viaja con el nest media (`saveActiveSeq`→`s.grade`,
  `loadSeqIntoState` con default identidad, `serMedia`→`grade`, restaurado por el spread `{...md}` de `loadProject`).
- **UI:** sección **Master Grade** siempre visible arriba del inspector (`renderMasterGrade`/`#insMaster`) — 5 sliders +
  Reset + punto "activo" + colapsable. Independiente de la UI de color por-clip (que está cableada a `selClip`).
- **Alcance fase 1:** sólo la secuencia top-level (nests y piso de sala no reciben máster). **Fase 2:** ruedas
  lift/gamma/gain, curvas, LUT máster, NDI/Spout.
- **Verificado por CDP** en el .exe dev: shader compila (`glFallback:false`), sección con 5 sliders + Reset, camino
  UI→`state.seqGrade`→`masterGradeOn()` en vivo, `render()` OK, Reset OK. `node --check` OK (tras cazar un `//` inline
  que se comía el resto de la línea → se usó `/* */`).



## ROUND 138 — Cola NEXT completa: [T5] · [R3] · grado PFD/PEQ · [T2] · [V1] · [T4] · [X2] · [T3] (+ deploy + validación CDP)

Ronda maratónica: se vació la cola near-term de `docs/NEXT.md` (8 items), se compiló/deployó a las 3 instalaciones y se
pusheó, y se validó el build real por CDP (smoke test: `glFallback:false`, todas las funciones post-shader existen →
los shaders PFD/PEQ compilaron; `bindClipLUT` arity 2; faders `.vfader` con `--pct`; `.fxsec` estilado; `render()` ok).

### [T3] Scrollbar de zoom estilo Premiere (`#tlZoomBar`)

La barra de scroll horizontal nativa de `#tlscroll` se reemplazó por una custom con **caps circulares de zoom**:

- **CSS/DOM** (index.html): `.tlscroll` pasa a `overflow-x:hidden;overflow-y:auto` (barra nativa oculta). Nuevo
  `#tlZoomBar > #tlZoomTrack > #tlZoomThumb > .tlzcap.l/.r` (dos círculos en los extremos del thumb).
- **JS** (app.js): `renderZoomBar()` alinea la pista bajo `#tlscroll` (rects vivos) y dimensiona el thumb =
  `clientWidth/scrollWidth`. `startZoomBarDrag` (cuerpo del thumb) hace scroll fijando `scrollLeft`. `startZoomCapDrag(e,side)`
  (caps) hace **zoom anclando el borde opuesto**: recalcula `pxPerSec=clientWidth/winDur` (clamp `TL_PPS_MIN/MAX`) y usa el
  truco `_scrollTarget` (crecer el ancho antes de scrollear). Se repinta desde el handler de scroll y al final de
  `renderTimeline`. Con la barra nativa oculta, `hsb`=0 → la compensación de `marginBottom` del header queda inerte.
- **Verificado por CDP** (dev electron): thumb 869→532px al hacer zoom-in ×6 (se angosta con el contenido); `thumbLeft`
  sigue el `scrollLeft` (50% → left 434); cap derecho arrastrado 70px a la izquierda → zoom-in (contenido 3662→4217) con
  el `scrollLeft` escalado en la MISMA razón (borde izquierdo anclado). `node --check` OK.

### [X2] Layout de las tarjetas de FX reactivos

### [X2] Layout de las tarjetas de FX reactivos

El cuerpo de cada tarjeta de efecto (`fxCardHtml`) era una pila plana: fila de selects (band/mode/INV) → 6 faders de
modulación → un divisor fino → params del efecto. Ahora se lee como **bloques ordenados**:

- Tres secciones etiquetadas `.fxsec` (uppercase muted, idiom del proyecto): **Routing** (band/mode/INV + fila LFO),
  **Response** (int/amt/atk/rel/curve/bounce), **Parameters** (params del efecto — sólo si `def.params.length`).
- Estilos inline del cuerpo movidos a CSS (`.fxbody`, `.fxseg` para las filas de selects). El divisor fino se reemplazó
  por el rótulo de sección.
- **Cableado intacto:** `wireReactiveChain` consulta `.fxband/.fxmode/.fxinv/.fxshape/.fxdiv/.fxrow/.fxname/.fxdel/.fxdrag`
  — todas preservadas (verificado). Cambio puramente aditivo. `node --check` OK.

### [T4] Rediseño de los faders del 3D-preview (skill impeccable)

### [T4] Rediseño de los faders del 3D-preview (skill impeccable)

Los tres faders de cámara (FOV/DOLLY/DIST, en la barra de vista) eran `<input type=range>` nativos con sólo
`accent-color:var(--ink-3)` → cramped (~54px), bajo contraste, feos. Rediseñados como sliders pro monocromos que
respetan el contrato de color Resolve/Blender del proyecto (3 superficies, estado por VALOR/lightness):

- **CSS** (clase `.vfader`, index.html): surco recesado `--s0` con hairlines; **relleno** `--ink-2` (el valor se lee por
  claridad, no por color) pintado con un `linear-gradient` cortado en la var `--pct`; **thumb** circular `--ink` con
  sombra, `hover` scale 1.15 (ease-out-quart) y halo `:active`; `:focus-visible` con anillo. Pseudo `-webkit-` (Electron)
  + `-moz-` (dev) + `prefers-reduced-motion`. Ancho 74px (antes 54–56) → más precisión.
- **JS:** helper `faderFill(el)` calcula `--pct` desde min/max/value; cableado en los 3 `oninput` y en `updModeUI` (al
  entrar en 3D). La etiqueta de FOV ahora muestra `°`.
- **Verificación:** introspección DOM en el navegador (in-project, corre scripts) → `appearance:none`, 74×14,
  `cursor:ew-resize`, `--pct` correcto (FOV 60→16.7%, DOLLY 0.8→51.5%, DIST 3→16.7%), etiqueta `60°`. `node --check` OK.

### [V1] Ventana solo-visor sigue al editor (2D ↔ 3D)

### [V1] Ventana solo-visor sigue al editor (2D ↔ 3D)

La pop-out (`openViewerWindow`/`renderViewer`) mostraba **siempre** el domo 3D. Ahora **espeja el modo del editor**:

- `renderViewer` bifurca con `_vDome3D=(state.view.mode==='3d' && !_drawFlat && !_roomWrap)`:
  - **3D dome:** igual que antes — `P3` + malla del domo + su **cámara orbit independiente** (`_viewerCam`, arrastrar/rueda).
  - **2D:** blit limpio con `PB` (`pan=0,zoom=1`, sin el pan/zoom del editor) → **flat** = rect aspect-fit (misma
    matemática `uvsc/uvof` que el viewport principal), **dome-2D** = disco fisheye centrado.
- **Room-3D** cae a la tira flat (su representación 2D) — replicar la sala 3D con cámara propia queda fuera de alcance.
- Título/lengüetas/`flashStatus` actualizados de "3D Viewer" a "Viewer" (agnóstico de modo). `node --check` OK.

### [T2] Trim con micro-snap por frame + zoom más profundo

### Grade en fulldome/equirect — gap PFD/PEQ CERRADO

Las ruedas lift/gamma/gain, las curvas de tono y el LUT `.cube` sólo se aplicaban en las rutas PW-warp y flat (vía
`bindClipLUT`→`bindClipGrade`→`bindClipCurve`, cableadas al struct `LW`). Las fuentes **fulldome (`PFD`)** y **equirect
(`PEQ`)** sólo recibían el grado numérico (exp/con/sat/temp/tint) → los controles quedaban **inertes en silencio**.

- **Bind parametrizado:** las tres funciones ahora toman un struct de ubicaciones `L` (`bindClipLUT(c,L)` etc., default
  `L=L||LW`) → todos los llamadores legacy siguen igual.
- **Shaders FSFD/FSEQ:** se les añadió el bloque de color de FSW verbatim — `pow(max(u_gain*col+u_lift,0),u_gamma)` →
  curvas (sampler2D 256×1) → LUT (sampler3D), en el mismo orden. Uniformes nuevos + handles en `LFD`/`LEQ`.
- **Unidades de textura:** LUT en unit 2, curva en unit 3 (libres en PFD/PEQ, que sólo usaban 0/1). `bindClipLUT`
  restaura `TEXTURE0` antes del bind de `u_tex`.
- **Identidad:** lift 0 / gain 1 / gamma 1, `u_hasCurve=0`, `u_hasLut=0` → clips fulldome/equirect existentes **sin
  cambio de píxel**. `glow`/`chroma` siguen siendo sólo-PW (fuera de alcance).
- **Verificación:** harness WebGL2 temporal (`_gradecheck.html`, ya borrado) → ambos programas **compilan + linkan OK**.
  `node --check` OK. Docs sincronizadas.

### [T2] Trim con micro-snap por frame + zoom más profundo

- **Frame-snap del trim:** el drag de trim contextual (ripple/roll/slip/slide) era **continuo**; ahora cuantiza el delta
  a frame por defecto (`dt=Math.round(dt·fps)/fps`) → el borde salta frame a frame, visible al acercar. **Shift** = fino
  sub-frame (`dt·=0.25`, sin snap). La lectura de estado muestra segundos **y** frames.
- **Zoom más profundo:** tope de `pxPerSec` subido 600→**2400** vía const nueva `TL_PPS_MIN/TL_PPS_MAX`, aplicada en los
  4 puntos de zoom (botones ±, rueda-Ctrl, teclas ±, `zoomToClip`). A 2400 px/s un frame mide ~40–80px y la grilla
  adaptativa (que ya elige `1/fps` cuando el paso ≥15px) dibuja líneas de frame → refuerza el snap visible.
- El path de trim por **handle** (`.hd.l/.hd.r`) sigue continuo (no tocado). `node --check` OK.

### [R3] Pestañas de secuencia reordenables

Segundo win rápido de la cola. Las pestañas `#seqTabs` ya se podían cambiar/renombrar/cerrar pero no reordenar.

- **`startSeqTabDrag(e,id)`** (app.js, antes de `renderSeqBar`): análogo **horizontal** de `startLaneDrag`. `pointerdown`
  con umbral de 5px (no rompe clic/doble-clic/✕/rename). Al arrastrar dibuja una **línea-guía vertical** en el borde de
  inserción + un **chip flotante** con el nombre. En `pointerup` reordena `state.openSeqs` (misma fórmula de índice
  `dropIdx>from?dropIdx-1:dropIdx`).
- **Flag `_seqDragged`**: un arrastre real lo pone en true (y lo limpia en `setTimeout(0)`), y el `onclick` de la pestaña
  lo consulta → un drag no dispara además `switchSeq`. Mismo patrón que `_laneJustDragged`.
- El orden **persiste** (ya se serializa `openSeqs` en `serProject`). `node --check` OK. Docs sincronizadas.

### [T5] Mute visual: pista silenciada = opacidad alta + chapa

Primer ticket de la cola `docs/NEXT.md` (win rápido). Silenciar una pista (botón **M**) ya no dejaba ninguna señal
sobre sus clips salvo el botón encendido; ahora sus clips se marcan **claramente visibles** (no ocultos) con un estado
propio, distinto y más suave que `disabled`.

- **Clip DOM** (`renderTimeline`, app.js): `lane.mute && !c.disabled` → clase `.muted`. `disabled` (`.off`) es el estado
  fuerte y gana con `else if` (un clip deshabilitado en pista muteada se ve como disabled). Se inyecta `.mutebadge`
  (chapa de altavoz-mute) en el `innerHTML` del clip.
- **CSS** (`index.html`): `.clip.muted{opacity:.82;filter:saturate(.7)}` — **opacidad alta**, sin trama diagonal (a
  diferencia de `.off`), así sigue muy legible. La chapa es un círculo con el glyph nuevo `ICO('mute')` (altavoz + X):
  **signo de forma, no de color** → daltonismo-safe, coherente con el criterio de `.off`.
- **Icono** nuevo `mute` en el diccionario `ICO()`. `node --check` OK. Docs (`COMPONENTS.md` fila Clip DOM, `NEXT.md`)
  actualizadas en el mismo commit.

## ROUND 137 — Limpieza de deuda técnica #1: automatización legacy (archivada, no borrada)

Estreno de la política "archivar, no borrar" (ADR-0007). Se sacó del software la maquinaria de automatización que el
modelo After Effects (ADR-0006 / [A2]/[D1]) dejó sin efecto, y se archivó verbatim en `_backup/deprecated/`.

- **Archivado** (`_backup/deprecated/20260722-automation-override-and-perform-bake.js`, recuperable con encabezado
  origen/motivo/restaurar):
  - perform-and-bake: `_recTouch`, `autoRecOn`, `toggleAutoRec`, `recWrite`, `bakeRecorded` + `state.autoRec` +
    `#autoRecBtn` (HTML+CSS) + la llamada `bakeRecorded()` en `pause()`.
  - override/re-enable: `anyOverride`, `reenableAll`, `updReEnableGlobal`, `reenableAuto`, `setAutoOff` + la llamada
    `updReEnableGlobal()` en `returnToDefault` (que queda vivo).
- **Confirmado antes de sacar** (grep): `setAutoOff` (único setter de `_autoOff`), `recWrite`, `autoRecOn`,
  `toggleAutoRec`, `reenableAll`, `reenableAuto` = sin llamadores; `#autoRecBtn` no estaba cableado; `#reEnAll` no existía.
- **Verificado por CDP tras la cirugía:** los 9 símbolos → `undefined`; `#autoRecBtn` fuera del DOM; motor intacto —
  `evalP` sigue la curva (0→100 → 50 a mitad), `manualEdit` escribe keyframe (modelo AE, val 77), `returnToDefault`
  OK sin crash, render + `drawAutoCurve` OK, cero errores de consola. `node --check` OK.
- **Barrido menor HECHO** (mismo día): quitados los reads no-op de `_autoOff` en `sepAuto`, `returnToDefault`,
  `drawAutoCurve` (var `off` simplificada a su rama `false` en 5 puntos del hot-path), `fxKfToggle` y borrado de fx.
  Solo queda `_autoOff` en un comentario (L463). Verificado por CDP: el canvas de automatización PINTA la curva sin error,
  `evalP`=50, `sepAuto` OK, `manualEdit`=77. `node --check` OK.
- **Nota de tooling:** se versionó la plomería `.claude` (skills/agents/commands/settings) con una excepción en `.gitignore`.

## ROUND 136 — Sistema de documentación / mapa vivo del proyecto

Pedido de Beltrán: dejar de perder tiempo/tokens re-escaneando `app.js` en cada ajuste. Se investigó (C4, arc42,
Diátaxis, ADR, docs-as-code + guías de Claude Code) y se construyó un **mapa vivo navegable**. Nada de código de app tocado.

- **`COMPONENTS.md`** (raíz, ~1700 líneas) — *referencia* (Diátaxis): índice maestro (jump table por 8 subsistemas) +
  bloques de detalle. Cada componente: `archivo · función` / `#domId` · estado (✅/🚧/⚠️/🗑️) · ticket. **Es la "estructura
  de carpetas" que `app.js` no tiene.** Mapeado por **8 subagentes en paralelo** (cada uno leyó su subsistema en su propio
  contexto → sin cargar las 5000 líneas en el hilo principal). Incluye sección "Deuda técnica & gaps".
- **`ARCHITECTURE.md`** (raíz) — *explicación* (C4 + arc42): contexto, contenedores (main/preload/renderer/native),
  componentes, flujos de render/color/export, conceptos transversales (binding manual, handedness, i18n), riesgos, glosario.
- **`docs/adr/`** — 6 ADR inmutables (sin build step, sin FFmpeg, proxies manuales, handedness, `.isp`, automatización AE) + índice.
- **Plomería Claude Code:** skill **`arch-map`** (navegar/mantener), subagente **`arch-explorer`** (Haiku, búsqueda aislada
  que devuelve `archivo:línea`), `.claude/settings.json` (no leer `node_modules`/`dist`/`*.min.js`/`_backup`), puntero en
  `CLAUDE.md` ("leer COMPONENTS.md primero"), y ritual anti-pudrición en `/commit` (actualizar la fila en el mismo commit).
- **Hallazgos del mapeo (deuda técnica a limpiar):** automatización legacy vestigial (`_autoOff` + perform-and-bake que
  [A2]/[D1] mandan quitar), sub-lanes apiladas residuales, gap de grado de color en fuentes PFD/PEQ, [D2] cola sin snapshot congelado.
- **Política "archivar, no borrar" (ADR-0007):** el código deprecado que se saque del software se copia verbatim a
  `_backup/deprecated/` (legible, recuperable) con encabezado origen/motivo/restaurar + índice; metido en el ritual de `/commit`
  y en la skill `arch-map`. Pedido de Beltrán para no perder trabajo al limpiar deuda técnica.

## ROUND 135 — Etapa 10 · [D3] barra de menús File / Edit / Window · splash a 1080²

**[F2] auditoría (sin cambios de código):** medido por CDP en dome/2D/room, el chrome del editor es **idéntico** en los
tres modos — topbar (1920×28), stage (1328×497 @292,56), mediaPane (292), inspPane (300), trackHdr (152), toolRail (32),
transport (1920×30), editseg — misma medida y posición. Lo único que cambia son los controles específicos de cada modo
(botón 3D, Horizon, lectura AZ/EL) que se ocultan cuando no aplican (intencional). Diálogos de creación: Domo=2D=416 de
ancho; 360=554 (más ancho por el editor de orden/esquema de muros, coherente con "360 ajusta al espacio"). → No hay
descuadre concreto en la UI; F2 queda a la espera de un ejemplo puntual de Beltrán si observa un caso específico.


- **Barra de menús (`.menubar` en el top bar, tras el punto):** File / Edit / Window. Reusa `openMenu()` y **solo llama
  a comandos existentes** (el menú es otra vía de acceso, sin lógica nueva):
  - **File:** New dome/2D/360 (mismos diálogos que el landing), Open, Save, Save As, Export.
  - **Edit:** Undo, Redo · Cut (= copyClip+deleteSel), Copy, Paste, Duplicate · Delete, Ripple delete · Nest selection.
  - **Window:** toggle panel Media, toggle panel Inspector (con ✓ de estado) · Ventana solo-visor, Rendimiento total ·
    Todos los comandos (F1).
  - Comportamiento de menubar: clic abre/cierra, hover cambia de menú mientras hay uno abierto, `.on` se limpia al cerrar
    (`closeMenu`). Localización por `applyLang` (File/Edit/Window ↔ Archivo/Editar/Ventana).
  - **Verificado por CDP:** 3 menús construyen sus ítems; disparar Window→Media alterna `state.prefs.mediaCollapsed` y el
    menú se cierra tras el clic.
- **Splash a 1080²** (ajuste pedido por Beltrán): el logo del splash ya no se achica a 128px — se muestra a su tamaño
  nativo `min(1080px, 82vmin)` (responsivo, tope 1080²), sin la tarjeta chica; fondo oscuro a pantalla completa.

## ROUND 134 — Splash cuadrado con loop de logo (arranque + abrir proyecto)

Pedido de Beltrán: la animación del logo debe aparecer en una **ventana cuadrada** cargando unos segundos (el loop
≈2 veces) tanto al abrir el software como al abrir un proyecto, antes de revelar la ventana completa.

- **`startLogoLoop(imgEl,fps,onLoop)`** — nuevo 3er parámetro `onLoop`, se dispara cada vez que el loop vuelve a 0
  (cuenta vueltas). El avance de frames sigue por rAF (mismo motor ya probado en el logo del landing).
- **`showSplash(minLoops,onReady)`** — tarjeta cuadrada `.splashcard` (220×220, logo 128px + título) sobre fondo
  `#0E0F11`. Tras `minLoops` vueltas hace fade-out y llama `onReady`. Red de seguridad (`minLoops*3200+1500` ms) para
  que nunca cuelgue si el rAF está throttleado (ventana en segundo plano).
- **Arranque** — `init()` ahora hace `showSplash(2, …)` → muestra el landing, salvo que ya se esté abriendo un proyecto
  por doble-clic (`loadingOv` presente o `currentPath` seteado).
- **Abrir proyecto** — `showLoadingScreen` reusa la misma tarjeta cuadrada + cuenta vueltas; `loadingWaitMedia` ahora
  exige `_loadingLoops>=2` **además** de que media/proxys estén listos (o el deadline de 20 s) → el loop corre al menos
  dos veces incluso en proyectos que cargan rápido.
- **Verificado por CDP:** tarjeta 220×220; gating determinista (loops=0 mantiene, loops=2 oculta); el splash completa por
  la red de seguridad y dispara `onReady`. El frame-advance por rAF ya está en producción (landing).

## ROUND 133 — Grado de color · Fase 3: curvas de tono (luma + R/G/B)

Cierra el grado de color (F1=LUT, F2=ruedas, F3=curvas). Curvas de tono por clip vía LUT 1D de 256 entradas.

- **Shader (`FSW`)** — `uniform sampler2D u_curve; float u_hasCurve;` (unidad de textura 3; máscara=1, LUT=2, curva=3).
  Tras el clamp y antes del LUT creativo: primero las curvas R/G/B por canal, luego la curva **luma** (canal A) aplicada
  a cada canal ya curvado. `u_hasCurve=0` → identidad (se saltea).
- **Motor** — textura 256×1 RGBA (R/G/B/luma). `evalCurve(pts,x)` = interpolación lineal entre puntos de control
  ordenados (plano fuera de los extremos). `buildCurveData` rellena las 256 entradas; `clipCurveTex(c)` cachea la
  textura en `c._curveTex` + `c._curveDirty` (rebuild lazy). `curveIsIdentity` saltea cuando los 4 canales son
  `[[0,0],[1,1]]`. `bindClipCurve(c)` llamado dentro de `bindClipGrade` (cubre flat+dome). Identidad global 256×1.
  GOTCHA aplicado: `UNPACK_FLIP_Y=false` durante `texImage2D` (aunque en 1px de alto es no-op, se restaura después).
- **Por clip** — `props.curves={l,r,g,b}`, cada uno array de `[x,y]` en 0..1 (default identidad). `serClip` borra
  `_curveTex`/`_curveDirty` (textura viva + flag transitorios; se reconstruyen de props).
- **Inspector** — editor de curva en la sección Color (bajo las ruedas): pestañas Luma/R/G/B, canvas con rejilla +
  diagonal de referencia + curva del canal en su color; clic = añadir punto, arrastrar = mover (extremos fijan x=0/1),
  doble-clic = quitar (salvo extremos), botón Reset por canal.
- **Verificado por CDP:** `buildCurveData` de una curva luma 0.5→0.8 da A=204 en idx 128 (R/G/B=128 identidad);
  píxel sobre el composite: gris 128 → 204 con la curva, 128 sin ella (exacto); UI = canvas + 4 pestañas + reset.

## ROUND 132 — Automatización: bordes del clip libres para puntos (modelo Ableton)

Bug de UX reportado por Beltrán: en modo automatización costaba poner puntos cerca de los bordes del clip porque
peleaban con los handles de trim (`.hd.l`/`.hd.r`, altura completa, z-index 2 encima del `clipautocv` z-index 1).

- **Fix (CSS, scopeado a `body.automode`):** `body.automode .clip .hd{bottom:auto;height:15px;}` — los handles de
  redimensionar se limitan a la **tira superior** (15px = `RES_TOP`, justo donde arranca el canvas de automatización).
  Igual que Ableton: en vista de automatización el clip se estira **solo desde el borde de arriba** (esquinas sup-izq/der),
  y todo el cuerpo — incluidos los bordes izq/der — queda libre para colocar breakpoints hasta el límite del clip.
- Fuera de automatización el resize sigue a altura completa (la regla es exclusiva de `automode`). El `clipautocv` ya
  detenía la propagación (`inv(e)` resuelve toda la anchura), así que ahora captura también las franjas de borde.
- **Verificado por CDP (geometría):** handles L/R top 890→bottom 905 (alto 15), canvas top 905→bottom 971; solape
  vertical = 0 (handle bottom = canvas top). Canvas cubre todo el ancho (izq 225≈clip 224, der 705≈clip 704).

## ROUND 131 — Grado de color · Fase 2: ruedas Lift / Gamma / Gain

Segunda fase del grado de color (la Fase 1 = LUTs `.cube`, R116). Ruedas de color primarias por clip, modelo
color-balance estilo DaVinci, **antes** del LUT creativo en el pipeline.

- **Shader (`FSW`/`PW`)** — nuevos `uniform vec3 u_lift,u_gamma,u_gain`; una línea tras temp/tint y antes de glow/LUT:
  `col = pow(max(u_gain*col + u_lift, 0.0), u_gamma)`. Neutro (lift=0, gain=1, gamma=1) = **identidad exacta**.
- **Por clip** — `props.cgLift/cgGamma/cgGain = [handleX, handleY, master]` en −1..1 (handle = balance de color en la
  rueda: R arriba, G abajo-izq, B abajo-der; master = luminancia). `wheelRGB(a,k)` convierte a offset por canal;
  `bindClipGrade(c)` (llamada dentro de `bindClipLUT`, así ambos paths flat/dome la ejecutan) setea los tres uniformes:
  lift = balance×0.4 additivo · gain = 1 + balance×0.5 · gamma exp = 1 − balance×0.5 (clamp ≥0.1).
- **Inspector** — sección Color: tres ruedas (Lift/Gamma/Gain) con handle arrastrable (balance), slider de luminancia
  (master) y doble-clic = reset. Arriba del LUT (primarias primero, look creativo al final). Cada edición asigna un
  **array nuevo** a props (evita compartir referencia entre clips duplicados con `{...props}` shallow).
- **Persistencia** — `serClip` ya serializa props enteros (JSON) → las ruedas se guardan solas.
- **Verificado por CDP (píxel sobre el composite real):** neutro `[128,128,128]` (identidad); gain +0.7 → `[218,218,218]`
  (=128×1.7); gain −0.7 → `[38,38,38]` (=128×0.3); lift rojo puro → `[230,77,77]` (R↑, G/B↓). PW compila, `glErr 0`,
  UI = 3 ruedas + 3 sliders con handle en la posición correcta. **Nota:** la ruta PFD (fuente fulldome) sigue sin grade
  primario ni LUT (consistente con R116). **Pendiente:** Fase 3 = curvas luma/RGB (1D LUT 256px por puntos de control).

## ROUND 130 — Correcciones v2 · Etapa 9 (UI/Branding) · [U1]/[U2] (cierre)

Cierre de la Etapa 9 de limpieza de UI.

- **[U1] ✔ Botones minimalistas** — **Snap** y **Automation** pasan a **solo icono** (magnet / curvas), como el resto del
  transport; se conserva el tooltip explicativo. Se eliminaron los `tn('#snapBtn'…)` y `tn('#curvesBtn'…)` de `applyLang`
  (dejando solo `ttl()`): sin texto que reponer, `applyLang` ya no toca esos botones → el `<i>` del icono nunca se sobre-
  escribe al cambiar de idioma (el else-branch de `tn()` hacía `textContent=` y habría borrado el icono).
- **[U1] ✔ VIDEO/AUDIO mismo estilo** — el label **VIDEO** del ruler-pad usaba `.dvlab` pero el estilo estaba scopeado a
  `.trackdivider.hdr .dvlab` (solo la barra AUDIO) → VIDEO salía sin la tipografía Geist / tracking / uppercase / color faint.
  Selector ampliado a `.rulerpad .dvlab` → ambas etiquetas de grupo (barra gris) idénticas.
- **[U2] ✔ Sin instrucciones escritas persistentes** — ya resuelto en rondas previas (se quitaron el hint del viewport 2D,
  el `#autoLegend`/gramática de automatización, el flash de `toggleCurves` y el hint de timeline vacío). Verificado que hoy
  NO queda ningún banner/leyenda/nota instructiva siempre-visible: la ayuda vive en tooltips de hover (`title=`) — justo lo
  que pide el ticket. Único sub-punto no hecho: un afordancia "?" de ayuda dedicada (feature aparte, opcional, anotada).

## ROUND 129 — Correcciones v2 · Etapa 9 (UI/Branding) · [U4]/[U6]/[U7]

Decisiones de Beltrán: [U4] la "línea amarilla del 3D" es la spring line (contorno) → dejarla **gris delgada** como las
líneas de grilla. [U6] el "botón de frames" es el readout de espaciado de grilla ("◇ 1 s", a la izq. de Simple) → quitarlo.
[U7] las "herramientas de edición" (iconos) tipo Premiere → revisar y agregar lo que falte.

- **[U4] ✔ Spring line gris delgada** — en el shader 3D (`FS3`) el contorno del rim pasó de ámbar `vec3(0.79,0.55,0.29)`
  a **gris** `vec3(0.52,0.56,0.60)` con menor intensidad (0.5) y banda más fina — combina con las líneas grises de la
  grilla. Verificado por CDP (P3 compila, render 3D OK).
- **[U6] ✔ Quitar readout de grilla** — removido `#gridReadout` ("◇ 1 s") y su wiring (onclick/contextmenu); el espaciado
  de grilla sigue por Ctrl+1/2 (angosta/ancha), Ctrl+5 (fija/adaptativa), Ctrl+4 (snap). Verificado.
- **[U7] ✔ Review de herramientas + Track Select** — CONCLUSIÓN: el toolset ya cubre Premiere: **Select, Hand, Trim
  (contextual: edge=ripple · cut=roll · title=slide · body=slip — más elegante que Premiere), Razor, Zoom**. Faltaba
  **Track Select Forward**: nuevo tool `trackselect` (botón en `#toolRail`, cursor `e-resize`) — clic en un clip
  selecciona ese + todos los de su derecha en la pista (Shift = todas las pistas). Sin atajo 'A' (ya es Automation).
  Verificado por CDP (selección hacia adelante correcta: 2 de 3, sin el anterior).

- **[U8] ✔ Herramienta de texto con edición de párrafo** — Beltrán aclaró: "texto" = la herramienta de AGREGAR texto al
  editor (no la UI). El editor de texto del inspector ahora tiene: **fuente** (dropdown con 11 presets + fuentes propias),
  **peso** (Light/Regular/Medium/Bold/Black), **itálica**, **tamaño**, **alineación L/C/R**, **interlineado**, color y
  contorno. `renderTextMedia` honra `talign`/`tlineH`/`titalic` (antes siempre centraba). **Fuentes propias**:
  `loadCustomFont` lee un .ttf/.otf/.woff2 por `DSP.openRead`/`readAt`, lo registra con `FontFace` y lo suma a la lista
  (session-scoped). Campos nuevos serializados (`talign/tlineH/titalic`). Verificado por CDP (todos los controles; font/
  weight/align/italic aplican y re-renderizan). GOTCHA: la carga de fuente propia (file picker) verificar en el .exe.

**Pendiente Etapa 9:** [U1] menos texto en botones (Snap→S, Automation→A…); [U2] quitar instrucciones escritas de la UI
(hover+"?").

## ROUND 128 — Correcciones v2 · Etapa 9 (UI/Branding) · [U9] homepage + loop de logo

Beltrán entregó los **75 frames** del loop de logo (`assets/frames logo/frame_000..074.png`, 1080² c/u). [U9] usa esos
frames en vez del WebM VP9 originalmente previsto.

- **[U9] ✔ Página de inicio + loop de logo** — helpers `logoFramePath`/`preloadLogoFrames`/`startLogoLoop` (precarga las
  75 imágenes y cicla el `src` de un `<img>` a ~26 fps; ruta con `%20` por el espacio en "frames logo", funciona en el
  asar). **Landing** rediseñada: logo **animado** (104px), título "Immersive Studio Pro", **Version 1.0**, y pie
  **"Created by Alma Digital Studio — all rights reserved"**. El loop se detiene en `hideLanding`. **Pantalla de carga**
  nueva (`showLoadingScreen`/`hideLoadingScreen`/`loadingWaitMedia`) con el mismo loop, mostrada durante `loadProject`
  mientras los medios/proxys bufferean (mensaje "Cargando proyecto/medios/proxys…"; se oculta cuando no queda media
  `_loading`/proxy en curso, o a los 20 s). Verificado por CDP (frame carga 1080², loop cicla, Version 1.0 + créditos
  presentes, loading screen aparece/oculta).

- **[U5] ✔ Quitar botones Undo/Redo** — removidos de la barra superior; los atajos Ctrl+Z / Ctrl+Shift+Z siguen (el
  wiring ya estaba guardado con `if($(...))`). Verificado por CDP (botones ausentes, app carga OK).

**Pendiente Etapa 9 (UI/Branding, section 11):** [U1] menos texto en botones (A/S…); [U2] quitar instrucciones escritas
(solo hover + "?"); [U3] toggle grilla (ya existe); [U4] quitar línea amarilla del 3D (= la "spring line" ámbar del
shader 3D, línea ~335 — confirmar si borrar o togglear); [U6] quitar botón de frames (el toggle TC/Frames — confirmar si
todo el seg o solo Frames); [U7] revisar herramientas a la izquierda; [U8] tipografías propias (grande).

## ROUND 127 — Correcciones v2 · Etapa 7 (Viewer/Performance) · [V2] Full Performance

- **[V2] ✔ Botón "Full Performance"** — junto a popout/NDI/Spout, un botón (`#perfBtn`) que pone el visor a **pantalla
  completa** ocultando todo el editor: `body.perfmode` promociona `#stage` a `position:fixed;inset:0;z-index:1000` (el
  resto del DOM queda cubierto, sin desmontar), y `setPerfMode` llama `resize()`+`render()` para que el canvas llene la
  pantalla. Muestra el visor 2D o 3D según el modo activo. Se sale con el botón **Exit** (`#perfExit`, tenue salvo hover)
  o **Esc** (guarda temprana en el keydown: solo si no hay modal abierto). Verificado por CDP (entra fixed/z-1000/exit
  visible; salen el botón Exit y `setPerfMode(false)`; la guarda de Esc es correcta).

**Pendiente Etapa 7:** [V1] viewer-only en todos los formatos y que siga el cambio 2D/3D; [V3] Spout In en Media (addon
nativo — grande, solo Windows). Y de la Etapa 6 queda [F2] (consistencia de layout entre modos — vago).

## ROUND 126 — Correcciones v2 · Etapa 6 · [F7] importar equirectangular + rotar cámara

- **[F7] ✔ (fase 1) Equirect 360° → domo** — programa de shader **nuevo y aditivo** `PEQ` (VSEQ/FSEQ, VAO `eqVAO`), no
  toca el warp core. Para cada píxel del disco reconstruye el rayo (`rho→zenith`, `azimuth`), lo rota por **yaw/pitch**
  (la "cámara") y muestrea el panorama 2:1 (`uv = az/2π+0.5 , 0.5−lat/π`). Rama en `drawClip` antes de fulldome; incluye
  grade + máscara + blend + opacidad como PFD. UI en la sección Clip: toggle **"Equirect 360°"** (mutuamente excluyente
  con Fulldome src) + slider **Tilt** (pitch); el **Azimuth** de Transform = giro de cámara (yaw). Props
  `equirect/eqPitch` en los defaults. Verificado por CDP: PEQ compila+linka (sin riesgo de domo negro), toggle excluye
  fulldome, el equirect muestrea la textura (31/49 muestras con contenido dentro del disco). **GOTCHA:** tocó GLSL (nuevo
  programa) → verificar el panorama con una imagen equirect real en el `.exe` (GPU RTX). Fase 2 posible: auto-detectar
  2:1 al importar, equirect en el visor 3D orbitando la esfera completa.

**Etapa 6:** hechos F1/F3/F4/F5/F6/F7/F8. Queda **[F2]** (consistencia de layout entre modos — vago, necesita señalar
qué descuadra).

## ROUND 125 — Correcciones v2 · Etapa 6 (Formatos) · [F5] + [F3]/[F4] (setup de sala) + [F1]

- **[F1] ✔ (sustancial) Resolución editable en el panel de ajustes** — `openSeqSettings` (el panel de formato, alcanzable
  desde el chip de formato y el menú de pestaña de secuencia) ahora deja **editar la resolución** además de la cobertura:
  domo = select de presets cuadrados (1024–8192), 2D = inputs W×H; se **re-adapta en vivo** (`applyRes`: actualiza
  `as.w/h` + `state.seqW/H` + render + updFmtChip). Seguro porque el composite máster es cuadrado 2048² fijo (la
  resolución es el tamaño de export + aspecto de display; los clips se colocan proporcionalmente). Sala = solo lectura
  (viene de los muros). Con la cobertura editable (R114) el panel cumple el núcleo de [F1] (pixelaje + ángulo con
  re-adaptación). Verificado por CDP (4096²→1024² actualiza todo). Pendiente de [F1]: unificar más el "punto único".


- **[F5] ✔ Canvas de orden** — en el diálogo "Nueva sala 360", bajo el visor iso+plano, un tercer canvas `#rsStrip`
  (`drawRoomStrip`) muestra la **tira 2D en orden 1..N**, cada muro con su resolución y el **total** (ancho sumado ×
  alto). Se refresca junto con el iso. Verificado por CDP (canvas presente y pintado).
- **[F3]/[F4] ✔ (aclarado por Beltrán)** — el "enredo" era poder elegir **Wall** y **Order** por separado. Ahora:
  **columna 1 = Order** (fijo `1,2,3,4` según cantidad de muros, no editable); **columna 2 = Wall** (dropdown editable).
  Al elegir un rol que ya existe en otra fila, **se intercambian los dos muros** (las medidas viajan con el rol; las
  posiciones de Order quedan fijas), garantizando roles **únicos** (siempre Front/Right/Back/Left una sola vez). CSS del
  grid reordenado (`20px 42px minmax(0,1.2fr) …`). Verificado por CDP (order fijo, sin input de order, swap correcto,
  todos únicos). El piso se dejó como está (la aclaración apuntaba a los muros; sus cm siguen para la geometría 3D).

**Pendiente Etapa 6:** [F1] panel único de configuración de proyecto (parcial: cobertura R114); [F2] consistencia de
layout entre modos; [F7] importar equirectangular + rotar cámara (el más grande).

## ROUND 124 — Correcciones v2 · Etapa 6 (Formatos) · [F8] + [F6]=[N1]

- **[F8] ✔ Fondo de referencia con cuadrícula (alpha)** — toggle **"Alpha"** en la barra del visor (`#dispSeg`): un
  `#checkerBg` (cuadrícula blanco-gris CSS) detrás del `#gl`. Funciona porque el canvas GL se crea con `alpha:true` y el
  path de display 2D ya limpia a transparente; los paths 3D (dome/room) limpian a transparente cuando el checker está
  activo (`clearColor(...,checkerBg?0:1)`). Verificado por CDP (toggle on→`#checkerBg` display block; off→none).
- **[F6] ✔ = [N1]** — un elemento ya-domemaster escala con `size` (uniform `u_scale` del shader PFD, R123).

**Pendiente Etapa 6 (más de fondo, requieren explorar el editor de sala / pipeline equirect):** [F1] panel único de
configuración de proyecto (pixelaje/sala/ángulo con re-adaptación — parcial: cobertura editable R114); [F2] consistencia
de layout entre modos (barras del mismo ancho; 360 ajusta tamaños); [F3] Wall fijo (no editable); [F4] Floor solo píxeles;
[F5] canvas de orden (tira de pantallas sumadas bajo el 3D+plano); [F7] importar equirectangular + rotar cámara.

## ROUND 123 — Correcciones v2 · Etapa 5 (Compose/Nest) COMPLETA · [N1][N2][N4][N5]

- **[N1] ✔ Compose/Nest se comporta como clip (scale + rotar)** — la rotación ya andaba (el path fulldome PFD usa
  `az/spin`). Faltaba **scale**: añadido `uniform u_scale` al shader PFD (VSFD divide la coord de muestreo; FSFD hace
  `discard` fuera de [0,1] → borde transparente limpio al reducir). Se maneja con `Size` mapeado `size/55` (55 = 1:1, el
  default → **sin regresión** en clips fulldome existentes). Verificado por CDP (PFD compila, `LFD.scale` presente, domo
  NO negro).
- **[N2] ✔ Opciones del inspector según el tipo de compose** — los 3 campos rápidos ahora dependen del kind: domegrid →
  Rings/Segments; grid → Columns/Arc; spiral/wave → Count/Turns; resto → Count/Elevation (+ Size siempre). Cambiar el
  kind reconstruye los campos (renderInspector). Los cambios aplican live (`regenComposeNest`+`scrubRender`). Verificado.
- **[N4] ✔ Cambios relativos dentro del nest (no se resetea)** — `regenComposeNest` ahora **reutiliza** los clips
  internos por slot (preserva opacity/mask/fades/keyframes/fx) y aplica el layout **relativo al delta del usuario**:
  guarda `_layBase` (baseline del layout) y hace `props = nuevoLayout + (props - baseAnterior)`. Un elemento escalado a
  mano ya no vuelve a 0 al recomponer desde afuera. Props controlados por el layout (`warp/secAz/secEl`) SÍ siguen al
  layout (setear/borrar). Verificado por CDP (opacity preservada; size relativo 40→base60+delta20 = 80).
- **[N5] ✔ Dome Fill: randomization + rings no deformados** — en domegrid el inspector expone **Randomize** (baraja qué
  medio va en cada celda, `g.shuffle`) y **Flat tiles** (`g.noWarp`: baldosas sin deformar en vez de sectores curvados;
  `compElProps` omite `warp/secAz`). Verificado (Flat tiles quita el warp de los 8 elementos y vuelve al desactivar).

**Etapa 5 completa. Roadmap: Etapas 0-5 hechas.** GOTCHA: [N1] tocó el shader PFD → probar en el `.exe` real (GPU RTX
forzada) además del dev. Próximo: Etapa 6 (Formatos [F1]-[F8]) u otra.

## ROUND 122 — Correcciones v2 · Etapa 5 (Compose/Nest) · [N3] (parcial)

- **[N3] ✔ Quitar la mask en compose** — en `_renderInspectorMain`, toda la sección de máscara (dropdown de formas/PNG,
  tamaño de máscara y editor de pen-mask) se envuelve en `if(!(m&&m.comp)){…}`: un nest de composición ya no muestra la
  opción de máscara. Verificado por CDP (clip normal → mask visible; compose → oculta; controles de composición intactos).
- **[N1] pendiente de verificar en `.exe`** — por arquitectura el nest se compone a una textura y se dibuja con las props
  del clip (size/rot/az/el) por el path normal, así que scale/rotar deberían andar ya; confirmar con un compose real.
- **[N2]/[N4]/[N5] pendientes (más de fondo):** [N2] opciones del inspector según el tipo de compose + live (el
  count/el/size ya aplican live vía `regenComposeNest`+`scrubRender`); [N4] cambios relativos dentro del nest (no
  resetear al regenerar); [N5] Dome Fill: mostrar randomization + modo de rings no deformados. Tocan el sistema de
  compose → hacer con exploración cuidadosa.

## ROUND 121 — Correcciones v2 · Etapa 4 (Timeline/lanes) · [L5]/[L6]

Etapa 4: [L1]/[L2] (audio anclado) y [L7] (automatización en Play) ya en Etapa 1; [L4] (una sola lane) = [A5] R118;
**[L3] obsoleto** (ya no se crean lanes múltiples). Quedaban [L5] y [L6]:

- **[L5] ✔ Copiar/pegar en la posición del clic** — el menú contextual "Pegar aquí" ya pegaba en `C.start+r.t` (clic).
  Faltaba **Ctrl+V**, que pegaba en el playhead: ahora `state.hoverAuto` guarda `t=r.absT` (el tiempo bajo el cursor) y
  Ctrl+V pega ahí (`pasteAutoAt(hoverAuto, hoverAuto.t ?? playhead)`). Verificado por CDP (curva copiada pega en t=[3,4]
  bajo el cursor, no en el playhead 0.2).
- **[L6] ✔ Handle de keyframe más fácil de agarrar** — `nearKf2` sube el radio de agarre de 18→**24px**; `inv` usa una
  **tolerancia de ~10px** (antes 0.003 s fijos) para resolver el clip, de modo que un keyframe pegado al borde del clip
  se puede tomar desde justo afuera.

**Etapa 4 completa.** Próximo: Etapa 5 (Compose/Nest [N1]-[N5]) u otra que elija Beltrán.

## ROUND 120 — Correcciones v2 · Etapa 3 (Panel de Media) · [M1]-[M6]

- **[M1] ✔ Carpeta instantánea** — `newFolderIn` ya no abre `appPrompt`: crea la carpeta al toque con nombre por defecto
  y dispara `renameFolderInline` sobre su propia etiqueta (edición inline) vía `setTimeout(0)`.
- **[M2] ✔ Deseleccionar al clic fuera** — listener `pointerdown` en `#mediaList`: si el clic no cae sobre un item/tile/
  folder/input, llama `clearMediaSel()`.
- **[M3] ✔ Estado proxy/original** — tras el nombre del clip de vídeo aparece "proxy"/"original" en color tenue
  (`.mprx`, `--ink-dim`), y el punto de estado se atenuó a gris (#8A9199 listo / #5E646C sin proxy).
- **[M4] ✔ Rojo para ausente** — Supr ya borraba el media (línea existente); ahora el media con original ausente se
  marca en **rojo** en el panel (`#E06A6A` en `.mitem`/`.mtile.missing`) y sus clips en el timeline llevan `.clip.offline`
  (borde rojo). *Nota:* mantuve el borrado que elimina los clips; la variante "borrar deja los clips en rojo" implicaría
  clips huérfanos (el render del timeline no guarda `if(!m)`) → se dejó como decisión aparte.
- **[M5] ✔ Multi-arrastre + fotos 5s** — al soltar una multi-selección en el timeline: **Ctrl** apila en pistas
  consecutivas del mismo tipo (auto-crea si faltan), por defecto **lado a lado** en la misma pista (start += dur de cada
  uno). Imágenes ahora entran con `dur:5` (antes 6).
- **[M6] ✔ Rename contextual (Ctrl+R)** — `renameSelection` ahora prioriza el **panel de Media**: media/secuencia
  seleccionada → la renombra ahí; carpeta seleccionada → la renombra; si no, sigue con marker > clip > pista > secuencia
  activa.

Verificado por CDP (M1 carpeta+selFolder, M2 deselección, M3 labels original/proxy, M4 rojo+offline, M6 apunta al media).
**Etapa 3 completa.** Próximo: Etapa 4 (Timeline/lanes) u otra que elija Beltrán.

## ROUND 119 — Correcciones v2 · Etapa 2 · [A3]/[A5] efectos + [I3] Mask pen-tool + fix regresión R118

**[I3] ✔ Máscara de puntos (pen-tool) estilo Premiere** — nueva máscara editable con puntos, **aparte** de las formas
(círculo/rombo…) y del PNG. Modelo `c.penMasks=[{pts:[[x,y]…0..1], feather, invert, on}]` + `c.penExpand`. Motor de
**riesgo mínimo**: se rasteriza la unión de polígonos (feather vía shadowBlur, invert vía `source-out`, expand escalando
los puntos al centro) a un canvas → `c.maskTex`, y se reusa el sampler de máscara custom añadiendo `pen:5` a `MASK_IDX`
(**sin tocar GLSL**). Funciona en domo y flat, y en export (mismo path de render). UI en la sección **Clip**: botón
*Add mask*, **editor canvas** (clic añade punto, arrastrar mueve, doble-clic quita; fondo con el thumbnail del clip),
lista de máscaras con **Invert** + **Feather** por máscara + borrar, y slider **Expand** global. Copia profunda de
`penMasks` en duplicar/dividir/nest/pegar (evita aliasing) y rasterizado en carga/undo. Verificado por CDP: rasterizado
correcto (inside α=255 / outside α=0; invert lo espeja; feather borde α=102) y UI (Add mask → canvas visible, modo `pen`).
*Limitación v1:* la edición de puntos es en el canvas del inspector (con el clip de fondo), no dibujando directo sobre el
visor principal — se evita así el mapeo inverso del fisheye del domo. Dibujo sobre el visor = posible fase 2.



**REGRESIÓN de R118 corregida** — la regla CSS `.prow .kf{display:none}` que puse en [A1] (para colapsar los
espaciadores del cronómetro) **también ocultaba el botón de keyframe funcional de las tarjetas de efecto**
(`fxFaderRow` usa `<button class="kf" data-kf>`). Cambiado a `.prow .kf:not([data-kf]){display:none}` (+ restaurado el
estilo base de `.kf`/`.kf.on`): los espaciadores se colapsan pero el toggle de keyframe de FX (que lleva `data-kf`) queda
visible. **El build R118 (9b12f0b) desplegado tiene esta regresión → re-deployar con este cambio.**

**[A5] ✔ estado automatizado visible en el listado de efectos** — cada tarjeta de efecto (Reactive FX › Effects Chain)
muestra un **◆** cian en la cabecera cuando cualquiera de sus parámetros tiene automatización (`fxAnyKf`). Además **todos
los parámetros del efecto son ahora automatizables uno a uno** (antes solo Intensity tenía el toggle de keyframe; ahora
también Reactivity y los `def.params` del shader — `showKf=true`).

**[A3] ✔ clic-derecho sobre efecto → "Show Automation"** — la cabecera de cada tarjeta (`.fxhdr`) tiene menú contextual
con **Show Automation** (revela la curva del efecto en la pista vía `fxShowAutomation`: fija `lane._autoP` al primer
parámetro automatizado del efecto —o Intensity— y enciende la vista de curvas), **Bypass/Enable** y **Remove**.

Verificado por CDP (4 toggles de keyframe visibles por tarjeta, ◆ oculto→visible al automatizar, Show Automation fija
`_autoP=fxt:<tipo>:int`, menú contextual enganchado).

**Etapa 2 restante:** [I3] Mask pen-tool estilo Premiere. (Nota: la visión mayor de la sección 4 del doc — mover los
efectos "reactive" a la sección **Motion** del inspector como no-reactivos con "Add Effect" — es un feature grande aparte.)

## ROUND 118 — Correcciones v2 · Etapa 2 (Inspector) · [I1]/[I2] orden + colapso

**[I1]/[I2] ✔** — el inspector tenía solo **Transform** + un cajón **Effects** que mezclaba grado de color, máscara,
blend, loop, keys, LUT y movimiento. Reorganizado en **4 secciones colapsables**: **Transform** (az/el/size/rot +
Mirror) · **Clip** (opacity/blur/feather/crop + máscara, blend, react, fulldome/fisheye, quitar negro, texto/forma) ·
**Color** (exposure/contrast/saturation/temp/tint/glow/chroma + LUT) · **Motion** (chips de movimiento + lista).
Implementación: se reusó `#secFx`/`#fxRows` como la sección **Clip** (menos churn); se añadieron secciones nuevas
`#secColor`/`#colorRows` y `#secMotion`/`#motionRows` en `index.html`. `FX_COLOR_KEYS` divide las filas de `FX` entre
Clip y Color al construir (`buildRows`). El LUT y el bloque Motion cambiaron su destino de `appendChild`. `refreshInspector`
ahora también escanea `#colorRows`. **Colapso** vía `state.insCol` (default `{clip:true,color:true,motion:true}` → solo
Transform abierta); `applySecCollapse()` aplica el estado tras cada render (sobrevive re-render); `wireSecHeads` togglea
`state.insCol[sec]`. Motion se limpia (`innerHTML=''`) cada render porque no pasa por `buildRows` (evita duplicados).
Verificado por CDP: 4 secciones con títulos correctos, Transform expandida y las otras colapsadas, LUT dentro de Color,
Motion con 8 chips, y el colapso persiste al re-renderizar. **Sin deploy/push** (pendiente `/deploy` a pedido).

**[A5-core] ✔ una sola automatización a la vez** — eliminadas las **sub-lanes apiladas** (`lane._auto`): `appendAutoLanes`
ahora es no-op (también ignora `_auto` de proyectos viejos), se quitó el botón `+` "Add automation lane" del header de
pista y `showAutomation`/`migrateArAuto` fijan un único `lane._autoP`. La automatización activa se superpone sobre el
clip (`attachClipAuto`) y el chooser del header intercambia CUÁL parámetro se ve — una a la vez. Verificado por CDP
(`addLaneButtons:0`, `stackedSubLanes:0`, `appendAutoLanesIsNoop:true`).

**[A2-limpieza] ✔ código muerto** — quitados **freeze** del panel de modulación (`.mpfrz` botón+handler; el motor sigue
leyendo `m.frz` solo por compat de proyectos viejos), los botones **re-enable** (`.reEn` por fila + `#reEnAll` global +
wiring/idioma) y confirmado que **perform-and-bake** ya no tiene call-sites (`recWrite`/`autoRecOn` inertes; REC oculto).
`updReEnableGlobal` queda como no-op seguro (guarda `if(!b)return`). Verificado por CDP (`reEnRowButtons:0`,
`reEnAllElementExists:false`, `freezeButtonsInModPanel:0`).

**[A1] ✔ un solo botón de punto** (decisión de Beltrán: dejar el diamante) — quitado el cronómetro `.kf` de cada fila del
inspector; el diamante `‹◆›` de `.nav` es el botón único: **◆ togglea** el keyframe en el cabezal (agrega si no hay /
quita si el cabezal está sobre uno), el **primer punto revela** la curva en la pista (`openAuto`→ el único `_autoP`),
**clic-derecho** sobre el diamante **borra toda la automatización** (congela el valor actual). El estado "automatizado"
se ve por el **resaltado de la fila** (`.prow.auto`, label más brillante). CSS: `.prow .kf{display:none}` colapsa los
espaciadores `.kf` que quedaban en otras filas → todas las etiquetas alinean a la izquierda. Verificado por CDP
(crear→revela+`_autoP`+fila auto · re-clic quita · clic-derecho borra).

**[A4] ✔ (ya existía)** — la modulación cierra al clic-afuera vía `_modOutside` (salvo si se clica sobre `.modb`).
Confirmado por CDP (el panel se cierra con un pointerdown externo una vez enganchado el listener).

**Pendiente Etapa 2:** [A5] dos niveles efectos→parámetros + indicador de "automatizado" en la lista de efectos ·
[I3] Mask pen-tool estilo Premiere (puntos, invertir, feather, varias máscaras).

## ROUND 117 — Correcciones v2: Etapa 0 (Git) + Etapa 1 · [L7] modelo de automatización After Effects

**Contexto:** Beltrán entregó `CORRECCIONES-V2.md` (roadmap grande post-testeo, ~40 tickets + funciones mayores, por
etapas). Trabajo por etapas, un ticket a la vez, verificando en vivo. Detalle y decisiones en la memoria
`correcciones-v2-roadmap`.

**Etapa 0 · [D6] Git ✔** — `git init` + `.gitignore` (excluye node_modules/dist/.claude/native builds) + commit inicial +
push a `github.com/beltranlihn/Immersive-Studio-Pro` (`main`) + tag `baseline-r116` (restauración pre-refactor). `gh` NO
está instalado; credential-manager cacheado hace funcionar el push. El doc quedó versionado como `CORRECCIONES-V2.md`.

**Etapa 1 · [L7]+[A2/D1] ✔ (commit `412a6a8`)** — "automatización no corre en Play". Reproducido por CDP: la evaluación
base SÍ corría; el culpable era **`_autoOff`** (el override estilo Ableton: editar un valor sobre un parámetro
automatizado lo congelaba). Cambio al modelo **After Effects** (decisión de Beltrán): `evalP` ya no lee `_autoOff` (la
automatización NUNCA se rompe); `manualEdit` → si el parámetro ya está automatizado escribe/actualiza keyframe en el
playhead, si no, solo cambia el valor estático. Perform-and-bake removido (REC `#autoRecBtn` oculto). Los botones "↻
recuperar" se auto-ocultan. Verificado por CDP (editar x=99 @ t=2 en clip animado → keyframe nuevo, sin `_autoOff`; y
no automatizado → estático). Build + deploy a las 3.

**Etapa 1 · [T1] ✔ (commit `f2873d3`)** — clic-derecho sobre clip no funcionaba: OTRO `//` se tragó el cuerpo del
handler `contextmenu` de `#tracks` (`e.preventDefault(); const id=+cd.dataset.clip; …` comentado → `id` indefinido).
Línea partida. Añadido **"Zoom to clip"** (`zoomToClip`: el clip ocupa ~96% del viewport + scroll a la izquierda).
Verificado por CDP. Deploy a las 3.

**Etapa 1 · [R2] ✔ (commit `244756a`)** — "clips deformados al renderizar" era cosmético (preview mientras renderiza; el archivo sale bien). Overlay opaco `#renderMask` sobre el viewport durante todo el export (el export sigue leyendo de #gl). Verificado por CDP + deploy.

**Etapa 1 · [L1]/[L2] ✔ (commit `8cc6a61`)** — el bloque de audio flotaba arriba con pocas pistas (sticky solo ancla con overflow). Fix CSS: `.tracks`/`.trackhdr` flex-column que llenan el viewport + `.audiozone{margin-top:auto}` → audio anclado al fondo; sticky maneja el overflow. Verificado por CDP + deploy. **Etapa 1 cerrada** salvo [A1] (movido a Etapa 2).

**[A1] diferido a Etapa 2** (dejar un solo botón de punto está acoplado al rediseño A2-A5). Limpieza pendiente (Etapa 2):
plumbing muerto de perform-bake/freeze + DOM de `.reEn`/`#reEnAll`. **Próximo:** [R2] deformados al render (ambiguo →
pedir captura), [L1]/[L2] glitches de pistas.

## ROUND 116 — Grado de color · Fase 1: import de LUT `.cube` (3D LUT en GPU)

**Objetivo (Beltrán):** hacerla competitiva a nivel mercado en color. Fase 1 = **LUTs creativas `.cube`** (lo que un
profesional abre y nota que falta). Ruedas lift/gamma/gain y curvas van en las fases 2-3.

**Motor:** el shader de fragmento `FSW` (programa `PW`) gana `uniform highp sampler3D u_lut` + `u_hasLut/u_lutMix`;
tras el clamp aplica `col = mix(col, texture(u_lut, col).rgb, u_lutMix)` (trilinear via textura 3D → el look como
transform final). Infra: registro `_lutReg` (path→textura 3D), LUT **identidad** por defecto (el sampler3D siempre
válido), parser `.cube` (`parseCubeLUT`, orden R-fastest = layout de `texImage3D`), `loadLUT` (lee por `DSP.readText`),
`bindClipLUT(c)` (setea uniformes + bind en unidad 2). Por-clip: `props.lut`=path, `props.lutMix`=0..100 (serializan en
props). `preloadLUTs()` recarga las LUTs referenciadas al abrir un proyecto. Aplica en la ruta PW (clips az/el + 2D);
el export pasa por `drawClip` → incluye la LUT. *(Pendiente: la ruta PFD de clips fulldome-source; fase 2.)*

**UI:** fila "LUT" en el inspector (cargar `.cube` vía nuevo `DSP.pickFile` con filtro / nombre / **slider de
intensidad** / quitar). `dsp:pickFile` (picker genérico con filtros) añadido a main.js + preload.

**GOTCHA cazado (clave para futuras texturas 3D):** el app deja `UNPACK_FLIP_Y_WEBGL=true` global (para subir
imágenes/vídeo 2D). `texImage3D` con FLIP_Y activo da **INVALID_OPERATION** y deja la textura VACÍA (la LUT salía
NEGRA). Fix: en `makeLutTex`, `pixelStorei(UNPACK_FLIP_Y_WEBGL,false)` + `UNPACK_ALIGNMENT,1` antes del `texImage3D`,
y restaurar después. Otro: RGBA8 3D **no es FBO-renderable** (framebufferTextureLayer da INCOMPLETE) → no sirve para
leer la LUT de vuelta; validar por sampling en un draw real.

**Verificado por CDP:** parser (2³, len 32), y píxel del composite: verde `[30,180,60]` → con LUT `[0,232,102]`, y al
50% de intensidad `[15,206,81]` = punto medio exacto (mezclado lineal correcto); fila del inspector con nombre +
intensidad + quitar. Build + deploy a las 3.

## ROUND 115 — Render in place (hornear un clip/nest y reemplazarlo en el timeline)

**Pedido (Beltrán):** aplanar composiciones pesadas para que el playback vuele. Clic-derecho en un clip/nest →
**"Render in place…"** → lo renderiza con SU duración, a tamaño de layout, con sus fx/automatización, y **reemplaza
la instancia** en la misma pista/posición. Excluye capas de ajuste externas (las internas del nest quedan). El nest
sigue en Media; solo se sustituye la instancia del timeline. Guarda en `<proyecto>/rendered clips/`.

**Implementación (reutiliza el motor de export, mínima cirugía):** `runExport` extendido con 3 flags —
`opt.rangeT` [t0,endT] (rango fijo), `opt.isolateClips` (swap temporal de `state.clips` → aísla el clip, excluye
capas de ajuste), `opt.outPath`+`opt.silent` (escribe directo, sin diálogo de guardado ni reveal). Nuevas funciones:
`ripFormatDialog` (**solo H.265 / H.264 → .mp4**, sin PNG-seq ni HAP; default HEVC para domo, H.264 para 2D —
decisión de Beltrán), `addVideoFromPath` (importa un MP4 de disco como media),
`renderInPlace(clip)` (guardado→carpeta, render aislado, import, reemplazo con `pushUndo`; domo→`props.fulldome=true`
para llenar 1:1, 2D→pantalla completa; la transformación queda horneada). Ítem en el menú contextual del clip.

**Verificado por CDP (render mínimo, la GPU del dev se cae en renders grandes — el `.exe` fuerza la RTX y exporta
bien):** flat 640² · clip imagen con `exposure` → render aislado escribe MP4 válido (2954 B, 0 errores),
`state.clips` restaurado; reemplazo: clip pasa a `video`, misma dur/pos, original removido, fuentes (nest+imagen)
siguen en el pool. Build + deploy a las 3. **Formatos: solo H.264 / H.265** (PNG-seq y HAP descartados por Beltrán).

## ROUND 114 — Paridad de diálogos de creación (Domo + 2D con visor) + COBERTURA de domo (FOV)

**Pedido (Beltrán):** dar a los formatos Domo y 2D la misma paridad que la sala 360 (diálogo con visor). En 2D,
previsualizar la proporción del lienzo según el pixelaje. En Domo, mostrar el domo y **elegir la cobertura**
(180/200/210/220°) porque hay domos de distinto FOV, y que eso **repercuta en la deformación real** del editor.

**Motor — cobertura como una sola fuente de verdad (`state.seqCov`, grados; def 180):** el radio del contenido en
el máster es `rho = zenith / (cobertura/2)`, así que un FOV mayor acerca el horizonte al centro (decisión de Beltrán:
"mantener elevación real"). Enchufada en los CUATRO puntos acoplados:
1. **Warp (forward)** — uniforme `u_covHalf` en `VSW` (sector + gnomónico); seteado en el camino de dibujo del domo.
   Init a `HP` tras crear el programa → nunca 0 (sin división por cero en el path flat).
2. **Inverso** — `f2azel`/`azel2f` usan `curCovHalf()` (clics/colocación coinciden; el borde puede caer bajo el horizonte).
3. **Guías 2D** — anillos de elevación `/90 → /curCovDeg()`; anillo **HORIZONTE** ámbar cuando cov≠180.
4. **Malla 3D** — `buildDomeMesh(covHalf)` reconstruye el casquete (zen=rr·covHalf, >hemisferio para 210°+);
   cacheada por `_domeCov` → barata por frame.
Persistencia: `cov` en `newSeqMedia`/`serMedia`/`loadSeqIntoState`/`newProject`; chip de formato muestra `210°`.

**UI — visor compartido `drawSeqViz`** (paridad con el esquema de sala): rectángulo de proporción + relación de
aspecto para 2D; disco fisheye con anillos + **horizonte que se mueve hacia adentro** al subir el FOV para Domo.
- `newSequenceDialog`: visor + segmento Domo/2D + selector de **Cobertura** (domo) / W×H (2D), en vivo.
- Landing "New dome project" → nuevo `domeSetupDialog` (resolución + cobertura + fps + visor + nota explicativa).
- Landing/`flatResDialog` (2D): visor de proporción en vivo.

**R114b — cobertura EDITABLE tras iniciar el proyecto** (pedido de Beltrán: retargetear un domo ya montado a otro
FOV y exportar rápido). `openSeqSettings()` (clic en el chip de formato, o menú de la pestaña de secuencia →
"Ajustes…"): visor fisheye + selector de cobertura que **aplica en vivo** a la secuencia activa (`as.cov` +
`state.seqCov` + `render()`), redeformando todos los clips al instante. Verificado por CDP: 180→210 en vivo, dirty ✓.

**Verificado por CDP en el .exe dev:** mapeo exacto — 180°: horizonte en rho=1 (sin regresión); 210°: horizonte en
rho=0.857, borde del disco = −15° (bajo el horizonte); `f2azel`/`azel2f` correctos; `newProject('dome',…,210)`
persiste `cov=210`; render 2D+3D sin excepción con `_domeCov`=105°; visores capturados OK. Build + deploy a las 3.

## ROUND 112 — Rediseño del editor de sala 360 (coherencia con el sistema de diseño)

**Motivo (Beltrán):** el diálogo "Nueva sala 360" (donde se configuran muros/piso y el esquema de la sala) se veía
pobre y fuera de tono con el resto del software, que sí luce bien. Aplicar las reglas de diseño ya establecidas.

**Sistema de diseño respetado:** 3 superficies (s0 pozos / s1 paneles / s2 controles), pozos oscuros para lo editable,
secciones en MAYÚSCULA espaciada (como `.grphead2`), y el color reservado a significado (el color de rol pasó de
relleno saturado a un **punto** de identidad). Bloque CSS nuevo `/* R112 · 360 room setup */` en `index.html`.

**El formulario** (antes filas tipo hoja de cálculo con inputs desnudos de colores hard-coded y cabeceras casi
invisibles en `--ink-dim`): reconstruido con clases `.rs-*` — secciones WALLS / FLOOR / OUTPUT, cabeceras legibles,
punto de color por muro, inputs en pozos `s0` con sufijo de unidad, píxeles como `W × H`. El piso alinea a la misma
grilla (SURFACE / WIDTH / DEPTH / PIXELS). Se conserva TODO el comportamiento (presets, segmentado 2/3/4, swap de
orden, validación de roles distintos, `cb(cfg)` idéntico).

**El esquema** (`drawRoomIso`, reescrito a DOS paneles sincronizados en un solo canvas 1056×440 @2×):
- **Izquierda · 3D iso** — forma/orientación: muros por rol, marcador de espectador, grilla de piso; el muro bajo
  edición se ilumina (relleno + borde + subdivisiones) y el resto se atenúa.
- **Derecha · PLANO cenital A ESCALA** — medidas: huella real (encajada al recuadro), cada muro como línea de color
  con su **ancho en cm** + nombre, espectador con tick al frente, y **barra de escala** métrica ("2 m"/"10 m"…).
- **Vínculo:** pasar el ratón/foco por una fila del formulario resalta ese muro EN AMBOS paneles (`activeRole`).
- **Robusto a cualquier proporción** (pedido de Beltrán: salas 15×5×2, 30 de ancho, etc.): el encaje usa
  `min(ancho, alto)` → la sala siempre cabe; y **los textos usan `U=W/528` (escala del canvas, NO de la sala)** → el
  nombre y las cotas NO cambian de tamaño y siempre se leen. El plano reserva márgenes (`lmx/lmy`) para que las cotas
  exteriores no se corten.

**Verificado en el .exe dev por CDP:** diálogo sin excepciones, alineación correcta, resaltado `activeRole` en ambos
paneles, y **3 casos extremos** (corredor 15 m, 30×5, 30×3) encajando sin recortes y con texto constante. Build +
deploy a las 3 instalaciones (app.asar). Preview aislado en `scratchpad/room-preview.html`.

## ROUND 108 — Motor de reproducción WebCodecs (paridad Premiere sin proxy). Fundación E1-E3 hecha y verificada; E4-6 en checkpoint

**Objetivo:** correr HEVC 10-bit pesado y multi-stream fluido SIN proxy, como Premiere. El spike (R107c) probó que el
acantilado de 3 decodificadores es del `<video>` de Chromium, no del hardware. Construcción por etapas, aisladas y
verificadas, SIN tocar el `<video>` vivo hasta el enganche (E4-6, que requiere OK de Beltrán).

**E1 — Puente de lectura binaria por rango** (`main.js`/`preload.js`: `openRead`/`readAt`/`closeRead`). Lee el `moov` y
las muestras del MP4 de 12 GB por trozos, sin cargarlo entero. **Bug de seguridad cazado:** `Buffer.allocUnsafe` es
pool-backed → por IPC se enviaba el pool entero (fuga de memoria adyacente); cambiado a `Buffer.alloc` (ArrayBuffer
dedicado de tamaño exacto). Verificado: rangos cruzados contra lectura de Node byte-a-byte, EOF-overshoot, lectura tras
cerrar → `null`. **OK.**

**E2 — Demuxer MP4 por rango** (`demuxMP4` en `app.js`): parseo ISO-BMFF (stsd/hvcC·avcC, stsz/stsc/stco/co64, stss,
stts, ctts, mdhd/timescale), encuentra el `moov` esté al principio o al final, construye offsets+pts+keyframes y la config
del decoder. Codec HEVC por sondeo, H.264 desde `avcC`. **Bug cazado:** leía el `type` de caja en el offset del `size`
(q, no q+4). Verificado end-to-end (demux → `VideoDecoder` → **150/150 frames, 0 errores**) en HEVC10 faststart,
HEVC10 con moov-al-final, y H.264. **OK.**

**E3 — Motor `ClipDecoder`** (`makeClipDecoder` en `app.js`): un `VideoDecoder` por fuente + anillo acotado de
`VideoFrame` decodificando por delante del cabezal; `frameAt(t)` síncrono para el render; evict por detrás; seek =
reset al keyframe previo (con detección de sentido para NO resetear en avance normal); racha de errores → `dead` →
fallback. Verificado en el **caso exacto de la sala** (4 decodificadores concurrentes sobre el mismo HEVC10 1080p60 en
in-points distintos): **97-100% de aciertos de frame, ~15 ms de lag (medio frame), ~10 frames en caché cada uno, seek
adelante y atrás OK.** **Bug cazado:** con clips de un solo GOP el reset hacia atrás no disparaba (regenerados con
keyframes regulares, como el material real). **OK.**

**Estado:** E1-E3 son código INERTE (nada los llama aún) → la reproducción actual con `<video>` no cambia. El
`.exe` desplegado sigue en R107; no se rehace hasta que E4-6 enganche algo real.

**E4-6 — Enganche al playback (hecho, pero TRAS UN FLAG APAGADO por ahora).** `upTex` sube también `VideoFrame`
(orientación verificada: `<video>` y CD dan rojo-arriba/azul-abajo, sin espejo). `vinstEnsure` abre un `ClipDecoder`
para el ORIGINAL sin proxy (proxy y export siguen por `<video>`); `driveCD` en `ploop` sube el frame de la caché y
salta el servo de `<video>`; `vinstSeek` scrubea por CD; el audio sigue por `vi.ael`; fallback automático a `<video>`
si el códec no entra o el decoder muere (`m._cdFail`). Lectura en bloque (4MB) para no toparse en el I/O por muestra.

**Por qué queda tras un flag (`state.view.wcDecode`, OFF por defecto):** el motor es CORRECTO y rápido **en
aislamiento** — 4 ClipDecoders sobre el film HEVC10, target móvil a 60fps: **anillo lleno (22 frames), feed 311ms POR
DELANTE del cabezal, 0 congelamiento**. Pero enganchado al `ploop` real, los pumps se **quedan sin hilo principal**:
el trabajo síncrono por frame (`render` del compositado de 4 muros + sala 3D, `collectDrawnVideoClips`,
`refreshInspector`, `meters`…) satura el event-loop y el `setTimeout` de los pumps se posterga → el feed cae ~8%
por debajo de 60fps y, con algún reset, la caché se vacía → mostraría el póster congelado. **Medido:** aislado feed
+311ms; en vivo feed −474ms. No es el motor: es contención de hilo. Por eso NO se activa (encenderlo regresaría el
caso 4× a peor que hoy). Con el flag OFF la app se comporta EXACTAMENTE como R107 (verificado: 4 clips por `<video>`,
render 60fps, sin CD).

**Lo que falta para encenderlo (E7, futuro):** mover los pumps de decodificación a un **Web Worker** (hilo propio,
como Premiere) — el reto es que el worker no ve `DSP`, así que las lecturas por rango habría que proxearlas
main↔worker, o leer en el worker por otra vía. Alternativa más barata a explorar: alimentar el decoder de forma
SÍNCRONA desde `driveCD` (una vez por frame de render, garantizado) en vez del pump con `setTimeout`.

**Estado real:** E1-E3 verificadas y activas-pero-inertes; E4-6 completas y verificadas (orientación, no-regresión)
pero **tras flag OFF**. Toda la infraestructura queda en el build, lista para E7. Nada cambia para el usuario hoy.

## ROUND 111 — Limpieza de código muerto + Salida SPOUT (addon nativo DirectX, alternativa local a NDI). Verificado en el .exe instalado

**Orden (R110 dejó código muerto):** eliminados `audioModuleMax`, `bindDividerResize` y `state.tl.audioH` (ya no se usaban
tras el rediseño del audio). `loadProject`/estado ahora persisten `audioCollapsed`. Build + deploy.

**Spout (alternativa a NDI, misma máquina).** Comparte el máster del domo como TEXTURA GPU local (Resolume/TouchDesigner/OBS
lo reciben zero-copy) en vez de por red.
- **Addon nativo `native/spout-send/`** (N-API, como el de NDI). Usa el SDK **SpoutDX** (DirectX 11, headless — crea su propio
  `ID3D11Device`, no necesita contexto GL). SDK vendorizado desde github.com/leadedge/Spout2 (SpoutDX + 6 archivos de SpoutGL,
  todos planos → `#if __has_include` resuelve). `binding.gyp` linka `d3d11.lib dxgi.lib winmm.lib` (winmm por `timeBeginPeriod`
  de SpoutFrameCount). Expone `available/start/send/stop`. Compila para el ABI de Electron 42.
- **Puente `DSP.spout`** en preload (calca `DSP.ndi`). **Render** en app.js: `spoutTick` (composite del máster → FBO → readPixels
  → `DSP.spout.send`, flip en el addon), `startSpout/stopSpout/spoutMenu`, `_spout*` vars — espejo del NDI. **Botón `#spoutBtn`**
  "SP" junto al de NDI, mismo indicador cian pulsante "en vivo". OFF por defecto, solo arranca con clic.
- **Verificado** (dev + **app instalada**): addon carga (`available:true`, sin loadError), `start` abre D3D11 + registra el sender,
  `send`→true, `spoutTick` corre ~30fps **sin excepción** (16 ticks/700ms), botón visible + toggle + `.on`. El `.node` quedó en
  `app.asar.unpacked` → el deploy copió también esa carpeta a las 3 instalaciones. Que un receptor externo lo vea lo confirma
  Beltrán en su software (como el NDI). Build + deploy (00:04).

## ROUND 110b — Correcciones tras feedback: VIDEO al ruler-pad (no franja) + menú crear-pista filtrado por tipo

- **VIDEO ya no es una franja aparte** — el texto va en el `.rulerpad` (la esquina vacía que ya existía arriba de las
  cabeceras): `renderTimeline` pone `<span class="dvlab">Vídeo</span>` ahí si hay pistas de video; `.rulerpad` pasa a
  `display:flex;padding:0 10px`. La barra de AUDIO abajo se mantiene (es también el toggle de colapso). Verificado: rulerpad
  = "Video", sin `.trackdivider` de video.
- **Menú de crear pista filtrado por tipo:** `trackCreateItems(kind)` → en pista de video solo "Crear pista de vídeo", en
  audio solo "Crear pista de audio", en área vacía ambas. Aplicado al menú del header de pista (`lane.kind`) y al del área
  de pistas (detecta el `.lane` bajo el cursor). Verificado. Build + deploy a las 3 (23:14).

## ROUND 110 — Rediseño del módulo de audio + etiquetas VIDEO/AUDIO. Verificado en el .exe + deploy

Pedido de Beltrán: el rectángulo de audio quedaba incómodo (se redimensionaba a antojo). Nuevo modelo:
- **Pistas de audio a altura FIJA = mitad del default** (`AUDIO_LANE_H = round(82/2) = 41`); `laneH` las devuelve fijas,
  sin resize ni collapse por-pista (`.lanehdr.aud .laneres/.lcol{display:none}`).
- **El contenedor mide EXACTAMENTE la suma de sus pistas** (auto height, sin `state.tl.audioH`, sin scroll interno). Se
  quitó el drag de la barra (`bindDividerResize` ya no se llama). Verificado: 1 pista → módulo 59 (18+41); 2 → 100 (18+41+41).
- **Colapsable:** la barra AUDIO ahora es un TOGGLE (`state.tl.audioCollapsed`) con chevron ▾/▸; colapsado deja solo la
  barra (18px) y oculta las filas.
- **Barra separadora más alta** (`.trackdivider` 9→**18px**) para que el texto quepa cómodo.
- **Etiqueta "VIDEO"** arriba de las pistas de video, misma barra/estilo que "AUDIO" (nueva, en `heads`+`tracks`).

Verificado por CDP: barras VIDEO (sin chevron) + AUDIO (chevron ▾) a 18px; audio 41px vs video 82px; auto-crecimiento;
colapso→18px/0 filas; resize oculto. Build + deploy a las 3 (23:06). (`bindDividerResize`/`audioModuleMax`/`state.tl.audioH`
quedan como código muerto inocuo.)

**In/Out vs Loop (consulta):** poner In/Out ya hace bucle de ese rango (`hasWork` en `ploop` vuelve al In al llegar al Out,
con o sin el flag `loop`). El botón Loop = atajo que fija el rango desde la selección Y enciende el bucle.

## ROUND 109 — Generación de proxy: rápida (WebCodecs, 7×) + feedback claro (%, ETA, barra). Verificado + deploy

**Síntoma (test de Beltrán):** clic-derecho → Generate proxy "no generó nada". **Diagnóstico:** NO estaba roto — la captura
reproducía el `<video>` a **1× tiempo real** (`dec.play()` sin bump), así que un film de 64 min tardaba **~64 min**; el
usuario vio "Generando proxy…", nada se movía rápido, y creyó que falló.

**Arreglo — ruta rápida WebCodecs (`makeProxy`):** en vez de reproducir el `<video>`, decodifica con el demuxer de R108
(`demuxMP4` + un `VideoDecoder` alimentado por bloques de 4MB) y encoda cada frame de salida. Un decoder solo llega a
~800fps → **7× tiempo real** (medido: 30s HEVC10 1080p60 → proxy en 5,1s; ffprobe: H.264 960×540, **1800/1800 frames**,
decodifica limpio). El film de 64 min pasa de ~64 min a **~9 min**. Cae a la ruta rVFC/seek de siempre si el demux falla
(no-mp4, códec raro) → sin regresión. Los caminos en tiempo real se auto-saltan (`_np=total`).

**Arreglo — feedback:** (a) status re-disparado cada 1,5s con **`Generando proxy X · 42% · ~4min restante`** (ETA); (b)
en el panel de medios, barra **cian de 14px con el % centrado** sobre la miniatura desde que arranca (`_pxGen`), se limpia
al terminar; (c) sigue el "PROXY %" en el clip. DOM throttleado a 150ms (no jankea a 800fps). Verificado por CDP: barra
`.pbar.gen` 14px, fill cian 42%, texto "42%".

**Nota de fluidez (test de Beltrán):** 2D a ½ va bien; 3D se traba — consistente con la contención GPU (el render 3D
pesa más). El proxy (ahora rápido de generar) es la vía práctica; con proxy 960p los 4 muros deberían ir fluidos.
Build + deploy a las 3 (22:39).

## ROUND 108·NDI — Indicador "en vivo" del NDI out (evitar transmitir/gastar recursos sin querer)

Auditado: el **NDI out ya arranca APAGADO** (`_ndiOn=false`; `startNDI` solo se llama desde clics del menú `ndiMenu`,
ningún arranque implícito; con off no hay `_ndiTimer` → cero composite/readback/red). Lo que faltaba: el estado ACTIVO del
botón era el gris sutil `--state-on` (igual que cualquier toggle), fácil de no notar estando transmitiendo. Añadido en
`index.html` un indicador inequívoco `#ndiBtn.on`: **borde cian (`--auto-live`) + punto cian pulsante** (`::after`, reusa
`recpulse`; se apaga con `body.rm-on`). Cian = lenguaje "en vivo" de la app (el rojo queda para REC). Verificado por CDP:
al poner `.on`, borde `rgba(79,195,232,.6)` + `::after` con `recpulse` y fondo cian. Build + deploy a las 3 (22:20).

## ROUND 108·E7 — Intento de encender WebCodecs: feed síncrono + reset por tiempo. Sigue tras flag por 2 muros duros (GPU + reset)

Objetivo: eliminar la contención de hilo que dejó E4-6 apagado. **Cambios (correctos, conservados aunque el flag siga OFF):**
- **Feed síncrono in-frame:** el pump con `setTimeout` (ahogado por el render) se partió en `step()` SÍNCRONO llamado por
  `driveCD` una vez por frame de render (cadencia 60fps garantizada) + un `keeper` async que sólo rellena el buffer de 4MB.
- **Reset por TIEMPO, no por índice de decode:** con B-frames del HEVC, decode-order ≠ display-order, así que el índice de
  decode para un tiempo NO es monótono y las condiciones `feedBase>tgtDec`/`keyBefore-feed` disparaban resets espurios.
  Reescrito a comparaciones de PTS (`targetUs>lastFedPts+2s` fwd, `targetUs<feedBasePts` back). `BEHIND` ampliado a ~0.25s.

**Por qué NO alcanzó (medido con instrumentación temporal):**
1. **Contención de GPU (NVDEC vs WebGL).** Con el render compositando 4 muros + sala 3D, la decodificación cae a ~76fps
   por decoder (apenas sobre los 60 de tiempo real). La cola del decoder se satura (`decodeQueueSize=12` casi siempre) →
   ~200ms de latencia de pipeline. En aislamiento (sin render) el mismo motor da anillo lleno y feed +311ms POR DELANTE;
   con render, feed −474ms detrás. El cuello es la GPU compartida, NO el hilo — **un Web Worker NO lo resolvería**.
2. **Reset residual cada ~GOP** que aún vacía el anillo en vivo (aislamiento: 2 resets totales; en vivo: 4, subiendo ~1
   cada 1.5-2s). El cambio a reset-por-tiempo no lo mató → el trigger es otro (probablemente el patrón de `local`/playhead
   esclavado al audio, o la interacción driveCD+keeper). Sin root-causear.

**Conclusión honesta:** el motor es correcto (probado en aislamiento: 4× HEVC10 60fps, anillo lleno). En vivo, en ESTA
GPU, 4× decode a resolución completa + render pesado de sala compiten por la GPU y el margen es demasiado fino. Esto es
exactamente por lo que Premiere ofrece **Playback Resolution (½, ¼)** y **optimized media** para lo más pesado. Palancas
prácticas reales para el usuario HOY (sin encender nada): **bajar la calidad de preview a ½** (libera GPU para decode) o
**generar proxy** (R107, ya arreglado). El flag `state.view.wcDecode` queda OFF; la app = R107 exacto (cero regresión).

**Para retomarlo (sesión enfocada):** (a) root-causear el reset por-GOP con instrumentación de `back`/`feedBasePts`/`local`;
(b) probar CD con preview a ½ (menos carga GPU → decode se adelanta → puede que ahí SÍ entregue); (c) medir si aceptar
~200ms de latencia (BEHIND ancho) da reproducción fluida-pero-retrasada usable.

## ROUND 108-rev — Revisión de código (modelo fable) de R106/R107/R108: 2 bugs ACTIVOS + 3 del motor, arreglados

Auditoría con el modelo **fable** sobre todo lo de la sesión. Hallazgos reales corregidos (verificado que el proxy sigue OK):
- **A1 (ALTA, activo):** `makeProxy` esperaba `loadedmetadata` del `<video>` fuente SIN listener de error ni timeout → un
  archivo fuente faltante/corrupto colgaba `makeProxy` para siempre y dejaba `proxyBusy=true` → **toda la cola de proxies
  congelada** hasta reiniciar. Arreglo: `error` + timeout 15s → rechaza y la cola sigue.
- **A2 (ALTA, activo):** un proxy BUENO se borraba si `bindProxyFile` superaba los 8s (disco lento/NAS) — el timeout era
  indistinguible de "corrupto" para `attachExistingProxy` y `makeProxy`, que lo borraban. Arreglo: el timeout se marca
  (`e.timeout`), sube a 15s, y **ningún llamador borra en timeout** (sólo en corrupción/corte-obsoleto real).
- **M1 (motor):** carrera en `vinstEnsure` — `_vinst.has(c.id)` no detecta un `vi` reciclado (LRU dispose + re-add con el
  demux en vuelo) → ClipDecoder zombi (fuga de fd + `VideoFrame` + pump girando). Arreglo: comparar IDENTIDAD (`get(c.id)!==vi`).
- **M2 (motor):** un decoder muerto durante scrub/pausa no se limpiaba (sólo `driveCD`, que corre reproduciendo) → se
  replicó la limpieza + fallback en `vinstSeek`.
- **M3 / B1:** tope de 256MB en `dsp:readAt` contra un `size` de caja corrupto gigante; `DSP.stat` movido dentro del `try`
  de `demuxMP4` (cierre de fd garantizado).
- Sin hallazgos: R106 (guías canvas), `upTex`+displayWidth (sin regresión), fugas internas de `VideoFrame` (todas cerradas).
- **Veredicto de la revisión:** apto para desplegar con el flag apagado; A1/A2 eran las urgentes por estar en código vivo.

## ROUND 107 — El tirón de la sala 360 era un PROXY CORRUPTO + huérfano. Escritura atómica + auto-sanado. Verificado en la app viva + juez ffmpeg, build + deploy

**Dato de Beltrán:** `Rito360.isp` (sala 360, tira 7196×912, 4 muros) con **el mismo clip 1080p duplicado 4 veces**, uno por
muro, en 4 in-points distintos → corre laggeado y desincronizado. Sospechó del proxy ("quizás se creó mal"). Acertó.

**Diagnóstico (evidencia dura, no teoría):**
- El original `RIto_Film_1080.mp4` es **HEVC 10-bit** (`yuv420p10le`, 1080p60, 64 min, 12,5 GB). Decodificarlo **4 veces a la
  vez** en 4 posiciones distintas = el tirón. TouchDesigner fluye porque no hace esto; nosotros dependemos del proxy.
- El proxy en disco `RIto_Film_1080.dsp-proxy-k9bhpy.mp4` (2,4 GB) estaba roto por **DOS** motivos independientes:
  1. **Corrupto**: ffprobe → `moov atom not found`. Es un MP4 sin átomo `moov` → la generación se **interrumpió antes de
     `mux.finalize()`** (que con `fastStart:false` escribe el `moov` al final). Quedó solo el `mdat`.
  2. **Huérfano**: el hash del nombre (`k9bhpy`) **no coincide** con el que el medio calcula hoy
     (`proxyHash(path|fsize)` = `1bua1kk`). Aunque no estuviera corrupto, `proxyCandidates` no lo encontraría.
  → resultado: la app cae en silencio al original de 12 GB ×4, sin proxy y sin avisar.

**El bug de raíz:** `makeProxy` abría el fichero de destino con **el nombre final** (`DSP.fileOpen(cache)`) y el `moov` no
se escribe hasta `finalize()`. Cualquier corte a mitad (cerrar la app, crash) deja un proxy con nombre válido pero corrupto,
que luego el chequeo de caché encuentra y `bindProxyFile` rechaza en silencio → mina permanente.

**Arreglos (R107):**
- **Escritura atómica** — nuevo puente `DSP.rename` (`main.js`/`preload.js`); `makeProxy` codifica a `<nombre>.part` y sólo
  renombra al nombre final tras `finalize()` + escritura OK. Una sesión interrumpida jamás deja un proxy corrupto con nombre
  bueno; el `.part` se borra en el `catch`/`finally` de `pumpProxy` y en el aborto por frame congelado.
- **Auto-sanado** — `attachExistingProxy(m)`: intenta enlazar (hash exacto, y **cualquier `<stem>.dsp-proxy-*.mp4` hermano**
  vía `DSP.listDir` → rescata proxies huérfanos por archivo movido); `bindProxyFile` ahora **valida la duración** (±3%) para
  no enganchar un corte viejo. Un fichero que no decodifica o es de otro corte se **borra** (con nota de estado) en vez de
  quedarse de mina. Sustituye el re-bind de R92-T6 al abrir proyecto y el cache-hit de `makeProxy`. **Generar sigue MANUAL.**
- Un fichero ya finalizado que aun así no decodifica se borra tras el `bindProxyFile` fallido (no se deja landmine).

**Verificación (app viva vía CDP + juez externo ffmpeg):**
- **A** generación atómica → `proxyReady`, proxy **960×540 H.264, 180 frames, 6.0s, decodifica sin un error** (ffprobe/ffmpeg),
  y **NO queda `.part`**.
- **B** auto-sanado → un proxy hermano corrupto (mismo `moov atom not found` que el de Beltrán) **no se enlaza y se borra**.
- `DSP.rename` presente y funcional. Build (portable+NSIS firmados) + deploy a las 3 instalaciones (22:55).

**Para el archivo de Beltrán:** al reabrir `Rito360.isp` con este build, el `k9bhpy` corrupto se detecta, se borra y sale un
aviso; luego clic-derecho en el clip → **Generar proxy** lo rehace bien (ahora a `1bua1kk`) → los 4 muros pasan a 960p H.264
= reproducción fluida. (El re-encode del film de 64 min tarda una vez; después queda cacheado.)

## ROUND 106 — Zona segura de entrega fulldome (deuda cerrada → primer paso de R98). Verificado en el .exe, build + deploy

**Contexto:** la lista de arreglos/deuda quedó vacía en R105b y HAP (R100·H1–H6) ya estaba entregado con selección
de códec (`hap`/`hapq`) y chunks en el diálogo. Así que este es roadmap nuevo, no deuda: el primer trozo
autocontenido y sin conflicto de **R98 (entrega fulldome)**.

**El overlay de "zona segura" era de juguete:** en domo un único círculo suelto a `R*0.9` (elevación 9°, sin
etiqueta); en flat un solo recuadro al 5%. Un editor de domo necesita guías con significado, no un margen genérico.

**Hecho (toggle `showSafe` existente, sin UI nueva):**
- **Domo** — anillos por ELEVACIÓN (azimutal-equidistante, como la cuadrícula): **ACTION SAFE** a 5° (margen de
  borde / edge-blend del proyector), **TITLE SAFE** a 15° (banda cómoda de lectura), ambos con etiqueta con fondo
  legible sobre contenido; **aviso de cenit** en ámbar (`--auto-ovr`) a 80° — el contenido a <10° del cenit obliga
  a estirar el cuello del público.
- **Flat** — **action-safe** (interior 93%) + **title-safe** (interior 90%), convención broadcast, etiquetados en
  esquinas opuestas para que no se pisen.

**Verificación en el .exe real (CDP, `scratchpad/verify-safe.mjs`):** diferencial ON vs OFF sobre el canvas de
overlay — robusto frente a lecturas absolutas (que ya me mintieron antes). En ambas ramas: **sin excepción** y
**Safe ON añade tinta** (domo 14051→17296 px, +anillos+etiquetas; flat 6280→11390 px, +2 recuadros+etiquetas).
Build (portable + NSIS firmados) + deploy a las 3 instalaciones (22:34).

## ROUND 105b — Los motivos de deshabilitado, por fin. Verificado 11/11 + 77/77 total, build + deploy

**El hueco que quedaba de R102·D-T4**: el mecanismo (`data-why` → Info View en ámbar) existía y **sólo lo usaba
1 sitio de la app**. Ahora lo usan todos los controles que se bloquean.

**El fallo era sutil, y por eso llevaba ahí desde R94:** `#ringBtn` y `#adjLayerBtn` **SÍ tenían motivo**, pero
se escribía en `.title` **DESPUÉS** de llamar a `setDis` → `data-why` nunca se ponía → la Info View lo leía como
una etiqueta normal, **sin ámbar**. Y `#prevMk`/`#nextMk`/`#exportBtn` no tenían motivo ninguno.
Además, en el export el motivo real (*"H.264 se topa cerca de 4096² en esta GPU — cambia a H.265 o PNG"*) ya se
calculaba pero iba **sólo** al texto de estimación: pasabas el ratón por el botón gris y la barra callaba.

**Hecho:** el motivo entra por el **3er argumento de `setDis`**, que es el único camino que marca `data-why`.
- `#prevMk`/`#nextMk` → *"No locators yet — add one with M"* — **el motivo enseña el atajo que falta**, que es
  la razón de ser de esta superficie: es el instante en que el usuario mira y quiere aprender.
- `#exportBtn` → *"Add clips to the timeline first"*
- `#ringBtn`/`#adjLayerBtn` → *"Import images or videos first"* (ahora sí en ámbar)
- Botón Exportar del diálogo → el motivo del códec, en ámbar, además de en la estimación.

**Verificación (11/11)** — lo que se comprueba no es "hay texto", es que la señal **no mienta**: los 5 controles
tienen motivo · el motivo llega a la barra **en ámbar** · el motivo **enseña el atajo** · y al habilitarse
**`data-why` se borra**, la barra **deja de ir en ámbar** y el botón **recupera su etiqueta normal** (si el
motivo se quedara pegado, el control diría que está bloqueado cuando ya funciona).
**Regresión total: 77/77** (sistema 13 · Info View 8 · color clip 10 · affordance 5 · foco 7 · derivado 6 ·
revisión 13 · R105 4 · motivos 11).

## ROUND 105 — Deuda de R102/R104: 2 arreglos reales, 1 bug inventado, 2 declinados. Verificado 4/4 + 13/13

**Un "bug" que me inventé y verifiqué antes de tocar.** Había reportado que `previewQuality` se revertía a Full
al abrir un proyecto, con el botón marcando ¼. **Falso** — medido: `newProject` y cambiar de modo la respetan, y
el botón siempre dice la verdad (`setCompSize` sólo se llama desde el handler). Es el mismo error que cometí con
el doble-export: verifiqué el síntoma, no la alcanzabilidad. Comprobar antes de arreglar lo cazó.

**Arreglos reales (2):**
- **`previewQuality` se persiste** (`localStorage.dspPreviewQuality`). El hueco de verdad no era coherencia sino
  que la elección no sobrevivía al reinicio → volvía a Full. Ahora `applyPreviewQuality()` la restaura al
  arrancar. Verificado: ½ persiste y se recupera con el botón marcado.
- **El `21px` accidental**: era el botón "+" de secuencia (`.seqadd`), 1px más alto que sus pestañas hermanas
  por el `font-weight:700`. `height:20px` explícito + `box-sizing` → 20px, dentro de la escala {16,18,20,22,24}.

**Declinados conscientemente (2), anotados en vez de forzados:**
- **undo/redo/help a 3px del borde superior → NO a 0.** Ese borde es la barra de título del SO, no un borde de
  pantalla aprovechable (Fitts: "anchura infinita" aplica a bordes reales de pantalla). Y están dentro de una
  barra con su propio padding; forzar 0 rompería la rejilla a cambio de nada.
- **Color de clip derivado siempre al pintar → NO.** Hoy el color se escribe en `m.color` al crear (un valor de
  `CLIP_HUE`, que `clipTint` respeta como si fuera elección del usuario). La corrección "limpia" (crear con
  `color:null`) tocaría 7 sitios Y rompería el punto de color del panel de medios (lee `m.color` directo, línea
  1468) — superficie de regresión real por un beneficio hipotético (reequilibrar `CLIP_HUE` algún día). Deuda
  aceptada: los colores son correctos hoy.

**Verificación: 4/4** (sin 21px · "+" a 20px · ½ persiste · se restaura marcado) + **13/13** regresión del sistema.

**Deuda que QUEDA (honesta):** motivos de deshabilitado en el Info View (sólo 1 control pasa motivo — es trabajo
de redacción sobre los `setDis`, deliberado no masivo) · dianas a 19.7–20.7px (Blender ships 22; lo peor ya
resuelto) · el coste del composite sin medir (mi control de píxeles nunca funcionó).

_Generated from an adversarially-verified multi-agent audit (17 agents). Source of truth for ongoing work._

## IN PROGRESS / DONE this pass
- [x] Clip trim clamped to source media duration (video/audio can't stretch past source); lane change restricted to same kind.
- [x] Infinite timeline (content grows with scroll).
- [x] 3D viewport full-bleed; wheel/middle-drag = Pan (grab cursor); orbit free.
- [x] tcMode 3-way (timecode/frames/bars) + fmtTime() dispatcher; removed quantize dropdown; removed L/R meters (visual focus).
- [x] i18n full sweep → English; `<html lang=en>`; verified no Spanish left in DOM.
- [x] Curve editor: add point via dbl-click on empty / right-click → Add (single click no longer creates); per-kf easing presets in right-click menu; translated. (Freeform bezier handles still pending — item 14b.)
- [x] Locators: click-select, drag with snapping (clips/playhead/other locators/bars grid), dbl-click rename, Delete key, names drawn on ruler, persisted in save/load/undo/autosave.
- [x] Blue→grey chrome: togbtn/tbtn/playb/ringbtn 'on' & idle states neutralized to #313640/greys; panel-header icons muted; blue now reserved for playhead/selection/keyframes/import/export only. Verified computed styles.
- [x] **Composition Groups** (headline feature): state.groups + clip.groupId/slot; makeClip factory; createComposition ring/grid/random; openCompose modal (kind seg + dynamic params + mask incl. "Circle (alpha)"); group inspector panel (Transform-all: Count/Spin/Elevation/Size/Mask deltas preserve per-member tweaks; Reshape/Ungroup/Delete); member highlight on timeline; membership chip on member clips → Edit group; Delete key removes group; persisted in save/load/undo/autosave. Verified ring(az spread)/grid(rows×cols)/random + transforms + chip via eval + screenshot (7 circular-masked clips + group panel).
- [x] **Freeform bezier keyframe handles** (item 14b): k.hOut/hIn (dt,dv) handles + bezSegY cubic solve in evalP; "Free (bezier)" in curve right-click menu (initBez seeds smooth tangents); handles drawn + draggable in curve editor; presets clear handles. Verified linear 50 vs bezier 33.1, flat-start slope, monotonic, handle-drag updates angle.
- [x] **NumberBox editable** (item 12): dbl-click value box → inline type+Enter/Esc; wheel = ±step (shift 0.1 / alt 5); right-click row = reset to default. Verified type 123, wheel 124, clamp 999→360.
- [x] **Disabled states** (item 8): global `.dis` token + `updEnable()` driven from updStatus/renderTimeline; Split/Delete need a clip, locator nav needs markers, Export needs clips, Compose needs media. Verified empty/filled/no-selection transitions.
- [x] **Collapse-to-rail** (item 13): media + inspector collapse to 34px rail with vertical label + expand button (#hideMedia/#hideInsp ↔ #mediaRail/#inspRail); resize() re-fits viewport. Verified 284↔34 / 328↔34.
- [x] **Workspace persistence**: panel widths + collapse states saved to localStorage ('domeProWs') on gutter-drag/collapse, restored in init (loadWorkspace). Stores the *expanded* width even while collapsed so re-expand is correct. Verified across reload.

## ROUND 103 — Auditoría adversarial: "¿qué pasa si aprieto dos cosas?". 1 bug real + 1 autocorrección

Objetivo: encontrar lo que rompe en una **sesión real de edición** antes de que le pase a Beltrán. Ocho tandas
de estrés (`scratchpad/stress-*.js`).

### 🔴 EL BUG: `Ctrl+B` armaba el RAZOR — y el siguiente clic cortaba

Los atajos de herramienta **ignoraban los modificadores**. El propio comentario del código lo admitía: *"the
bare-B razor below, **which ignores modifiers**"*. R97 arregló el ORDEN de los handlers, no la causa.
Matriz medida (6 letras × sin-mod/Shift/Ctrl/Ctrl+Shift): **9 combinaciones armaban una herramienta por
accidente**. Las graves:
- **`Ctrl+B` → razor.** Ctrl+B es memoria muscular de "negrita" en cualquier app. No pasaba nada visible… y el
  siguiente clic **cortaba un clip**.
- **`Ctrl+H` → mano.** (Ctrl+H = reemplazar en medio mundo.)
Que `V`/`Z`/`C`/`T` se salvaran **no era diseño**: era que Ctrl+V/Z/C/T ya tenían dueño y hacían `return` antes
de llegar. B y H no lo tenían, así que caían.
→ Arreglado con `const bare=!mod&&!e.shiftKey&&!e.altKey` en las 6 teclas. `Shift+T` también colaba (miraba
`!mod` pero no el Shift). Matriz ahora **limpia: 0 accidentes**.
→ Y `Shift+B` sin puntos seleccionados ya no calla: dice *"Shape Box: primero selecciona puntos en una curva"*.
Antes caía al razor; luego, al arreglar eso, no hacía nada y el usuario tampoco sabía por qué.

### ⚠️ AUTOCORRECCIÓN: mi hallazgo F1 de la revisión estaba SOBREVENDIDO

Reporté que un doble `Ctrl+Shift+E` dejaba el diálogo de export muerto. **Verifiqué el síntoma pero NO la
alcanzabilidad**: probé que llamar `openExport()` dos veces lo rompe, y *afirmé* que el teclado lo provocaba.
**Falso.** Existe una guarda global preexistente: `if(document.querySelector('.overlay'))return;` **antes** de
todos los atajos. Medido con teclas reales: Ctrl+Shift+E ×2 → **1 → 1**. Ctrl+, ×2 → 1 → 1. Ctrl+K + Ctrl+Shift+E
→ 1 → 1. Incluso con el foco forzado fuera de todo input. Y Suprimir con un modal abierto no borra clips.
La paleta además se auto-limpia (`if(ov)ov.remove()`) y **se cierra antes de ejecutar el comando**
(`run(i){ov.remove(); filtered[i][3]();}`), así que tampoco por ahí.
La guarda de `openExport` se queda (idempotencia barata), pero **no era un bug vivo**. Lección: verificar el
síntoma no es verificar que el usuario pueda llegar a él.

### Lo que se probó y AGUANTA (sin cambios)

Recursión (meter la secuencia activa dentro de sí misma: 5ms, sin cuelgue) · borrar y deshacer **mientras se
reproduce** · borrar un clip **a medio arrastre** · deshacer **a medio arrastre** · quitar un efecto que la
pista automatiza (`laneAutoP` lo resuelve a otro parámetro) · borrar el medio de un clip vivo · borrar un
**Automation Item enlazado** · borrar una **secuencia colocada como clip** · fuente de modulación desconocida
(no da NaN) · clip en pista inexistente · **duración 0** · **fps 0** · keyframes fuera del clip recortado ·
cambiar dome/flat/room en caliente · trim con el vecino borrado a mitad.
**Serialización (9/9):** `color:null` sobrevive como null · la elección del usuario sobrevive · undo/redo
conservan ambos · `audioH` se guarda · **un proyecto viejo con gris heredado se repara solo al abrirlo**.

### El patrón de la jornada: mis tests mintieron 5 veces

Captura que era Blender · dianas ocultas tras el módulo de audio · headers en orden inverso (medía V6 creyendo
que era V1) · reutilizar el botón de prueba (el tooltip hace `if(el===curEl)return`) · y aquí: stress-7 **borró
la secuencia** y stress-8 corrió sobre los restos (todo `undefined`), más leer `c.color` de una referencia
muerta tras un undo — **el mismo peligro que el código ya documenta para shapeBox**: `restore()` REEMPLAZA los
objetos clip. Regla: releer por id después de un undo, y reiniciar estado entre tandas.

**Deuda anotada:** los sitios de creación **escriben** el tono derivado en `c.color` en vez de dejar `null`, así
que si algún día se rebalancea `CLIP_HUE` los proyectos viejos no lo recogerán (hoy es correcto; sería más
limpio derivar siempre al pintar). Y 13 de los 14 creadores de overlay no son idempotentes — hoy inalcanzable
gracias a la guarda global, pero es una guarda a un nivel, no una propiedad de cada diálogo.

## ROUND 102 · REV — Revisión de código adversarial: 5 hallazgos, arreglados. Verificado 66/66, build + deploy

**Por qué importa esta ronda:** las 55 aserciones de R102 verificaban que **lo construido hacía lo prometido**,
pero **ninguna preguntaba "¿y si el usuario pulsa esto dos veces?"**. Eso sólo lo encuentra una lectura
adversarial. Encontró un fallo que rompía por completo una función central.

**F1 (grave) · El diálogo de export quedaba MUERTO al abrirlo dos veces.** `openExport()` no comprobaba si ya
estaba abierto. El overlay tapa el ratón **pero no el teclado**, así que un segundo `Ctrl+Shift+E` volvía a
entrar y dejaba **dos modales**: veías el de arriba, pero `$()` es querySelector = **PRIMER match**, así que
todo el cableado (`#exCodec`, `#exGo`…) se enganchaba al de abajo, viejo y oculto. **Medido: el botón Export
del modal visible tenía `onclick == null`** — pulsabas Exportar y no pasaba nada. Preexistente; lo destapó
tocar `openExport`. Arreglo: `if(document.getElementById('exOv'))return;`.

**F2 · La Info View mutilaba el tooltip del Trim.** El regex partía por el primer delimitador y `(` era uno,
así que "Trim (T) — the cursor picks it…" se cortaba DENTRO del paréntesis → **«Trim — T) — the cursor picks
it…»**: paréntesis huérfano (el `replace(/\)$/)` sólo quitaba paréntesis FINALES), doble raya y atajo sin
detectar. Reescrito: **se extrae el atajo PRIMERO** y luego se parte nombre/descripción. De paso se descubrió
que el código tiene **dos convenciones** de tooltip y el parser sólo entendía una: ahora acepta `Nombre (V)`,
`Nombre (T) — descripción` y `Nombre · Ctrl+Z`.

**F3 · `laneTint()` era código muerto con el fallback viejo `#3C4046`.** 0 llamadas, pero una segunda fuente de
verdad para el color de clip esperando a que alguien la usara: habría devuelto el gris heredado en vez del tono
del tipo, y como `#3C4046` es justo el centinela de "sin color", el fallo habría sido **silencioso**. Borrado.

**F4 · `state.lastExport` no sobrevivía al reinicio.** Sólo vivía en memoria: configurabas HAP Q y al reabrir la
app volvía a PNG/4096/60. Para quien exporta el mismo formato cada día, **la sesión no es la unidad que
importa**. Persistido en `localStorage` (`dspLastExport`), que ya se usa aquí para los recientes.

**F5 · `UI` era una foto de :root sin forma de refrescarla.** Hoy no rompe (el `<style>` está en `<head>` y se
parsea antes del `<script>` del final de `<body>`), pero el comentario prometía "una sola fuente de verdad" y
eso sólo era cierto al arrancar: el día que exista un tema claro o alto contraste, el DOM se re-tintaría y el
canvas —waveforms, curvas, regla— se quedaría con la paleta vieja **sin error ni aviso**. Ahora `UI` se rellena
en sitio y existe **`refreshUI()`**.

**Gotcha del test (mío):** los 4 primeros casos del parser fallaban porque reutilizaba el mismo botón de prueba
y el sistema de tooltips hace `if(el===curEl)return` → ignoraba los hovers 2º en adelante y todos devolvían el
resultado del 1º. Falso fallo del test, no del parser. Elemento nuevo por caso.

**Verificación: 66/66** (sistema 13 · Info View 8 · color de clip 10 · affordance 5 · foco 7 · derivado 6 ·
alturas 4 · **revisión 13**).

## ROUND 102 · CIERRE — Alturas (no hacía falta) · el export recuerda. Verificado 55/55, build + deploy

**1. Tiers de altura de cabecera: MEDIDO, y NO SE HIZO.** La regla de Resolve (*"The number of clips is listed,
**but only if the track is tall enough**"*) existe para que un layout único no se recorte al encoger.
Medido a las cuatro alturas (colapsada 20 · mín 34 · def 82 · máx 260): **nada se recorta en ninguna**; el
contenido rellena su caja exacta. Ya tenemos un tier de facto: el estado `collapsed`. **Implementar tiers sería
añadir maquinaria para un problema que no tenemos.** Lo que sí existe es la dirección contraria — a 260px sobra
sitio para medidores y dB en el cabezal, como hace Resolve — pero eso es **función nueva**, anotada para R98,
no colada aquí como "pulido".
*(Gotcha del test: los headers se pintan en orden INVERSO (V6 arriba), así que `.lanehdr[0]` NO es la pista 0.
La primera versión mutaba la pista 0 y medía la de V6 → 82px en los cuatro casos. Se mide por `data-lane`.)*

**2. Operate → Adjust: aplicada la mitad que aplica, y dicho por qué la otra no.**
- **Proxies: ya estaban bien.** `makeProxy(m)` no tiene ajustes: ejecuta y punto. No hay paso de configuración
  que eliminar.
- **Export: la regla NO aplica y no se aplicó.** Su justificación es *"prevents annoying popups forcing you to
  decide settings before you even know how they'd look like"* — pero en un export **sí sabes cómo quedará** (es
  tu línea de tiempo), y equivocarte cuesta **minutos de render y un fichero escrito**. Ni Premiere ni Resolve
  disparan un export sin diálogo. Inconsistencia deliberada, documentada como pide la HIG.
- **Lo que sí aplica, y estaba roto:** el diálogo **no recordaba nada**. Medido: cambias a MP4/2048/24, cierras,
  reabres → PNG/4096/60 otra vez. Cada export te volvía a interrogar. Ahora abre con `state.lastExport`.
  Detalles: se recuerda **al elegir**, no al exportar (cerrar sin exportar también es información); un códec que
  ya no exista **no deja el select en blanco**; y se llama a `upd()` tras restaurar, porque asignar `.value` **no
  dispara `change`** y el bitrate/aviso de tamaño se quedarían mostrando lo del códec anterior.

**Regresión total R102: 55/55** (sistema 13 · Info View 8 · color de clip 10 · affordance 5 · foco 7 ·
derivado 6 · alturas 4 · memoria de export 2).

**Balance de R102 — de 35 cambios propuestos:** aplicados los que la evidencia sostenía; **5 descartados tras
medir** (aclarar el fondo a #121212 · bajar el contraste del texto · escala de 6 escalones · controles a 44px ·
tiers de altura) y **3 conservados como inconsistencia deliberada** (`Offset…`, `Properties…`, export con
diálogo). Cada descarte está justificado arriba o en `PROPUESTA-DISENO-UI.md` §0.
**Deuda abierta:** pares de dianas a 19.7–20.7px (Blender ships 22) · alturas de control aún 16/18/20/21/22/24
(el 21 es un accidente) · undo/redo/help a 3px del borde (deberían ir a 0) · sólo 1 control pasa motivo a
`setDis` (el mecanismo está; falta redacción) · medidores de audio en cabecera → R98.

## ROUND 102 · D-T2d/D-T4b — Estado derivado ≠ afirmado · verbos no sustantivos. Verificado 49/49, build + deploy

**1. Estado DERIVADO ≠ estado AFIRMADO.** Un clip con `gsel` está resaltado porque **su grupo** está
seleccionado, no porque lo eligieras tú. Ableton tiene `ImplicitArm` justo para esto: una pista armada *por
consecuencia* no se ve igual que una armada con el ratón.
Dos defectos encontrados al mirarlo: (a) `gsel` usaba `--ink-2`, **más brillante** que la selección afirmada en
standby (`--ink-3`) — **lo derivado gritaba más que lo afirmado**; (b) ambos usaban la **misma forma**, así que
sólo los separaba el color. Ahora la diferencia es de **FORMA: discontinuo = por asociación**. Se lee en escala
de grises y con cualquier daltonismo, y no compite con el borde macizo de la selección propia.
Verificado (6/6): derivado discontinuo · afirmado macizo · formas distintas · **lo derivado no pesa más que lo
afirmado** (184 vs 224) · el derivado sigue visible (184 vs fondo 17).

**2. Verbos, no sustantivos** — *"Emphasize actions, not things"* (HIG de Blender). Ahí sangró FCPX: la confusión
documentada de los editores era **léxica** (*"primary storyline, secondary storyline – huh?"*), no de
comportamiento.
- `Color…` → **Set clip color…** · `Speed…` → **Change speed…** · `Track color…` → **Set track color…**
- `Return to Default` → **Reset to default** (además era Title Case suelto)
- `Show Automation` / `Show Automation in New Lane` → sentence case + ES en infinitivo.
- **1 `colour` contra 119 `color`**: la rara era esa.
**Inconsistencias DELIBERADAS, anotadas como pide la propia HIG** (*"Inconsistencies should be well founded and
documented"*): `Offset…` se queda (*to offset* **es** verbo) y `Properties…` también — es una convención casi
universal y cambiarla sorprendería más de lo que enseña. `Reveal in Explorer` y `Automation Item` conservan
mayúsculas por ser **nombres propios** (Windows Explorer; nuestra función de R95·D2).
No se tocó ni un nombre de preset (`Lower third`, `Subtitle`, `Dome master 4096`…): **esos sí son cosas**.

**3. No acoplar selección y cabezal — YA ESTABA BIEN.** Auditado, no cambiado: el código dice explícitamente
*"Clicking the clip BODY places the playhead… without selecting the clip"* y *"pure click … does NOT move the
playhead"*. Cabezal = tiempo, selección = intención. Coincide con la decisión de Blackmagic (desactivaron
"Selection Follows Playhead" por defecto desde v17). Nada que hacer.

**Regresión total: 49/49** (sistema 13, Info View 8, color de clip 10, affordance 5, foco 7, derivado 6).

## ROUND 102 · D-T2c — Selección en DOS niveles (foco por panel). Verificado 43/43, build + deploy

**Por qué.** El tema de Ableton envía `Selection` y `StandbySelection` como colores **distintos** (fondo y primer
plano), y repite el patrón para los resultados de búsqueda. Con tres paneles compitiendo por el foco (medios ·
línea de tiempo · inspector), si "seleccionado aquí" y "seleccionado allí" se ven igual, **el usuario no sabe
sobre qué van a actuar el teclado o el próximo comando**. Nosotros lo colapsábamos en un solo nivel.

**Hecho:** `setFocusPane()` marca `body.fp-timeline|fp-media|fp-inspector` en `pointerdown` **en fase de
captura** — así se pinta antes de que el clic cambie la selección y ningún handler puede tragárselo con
`stopPropagation`. Base = **standby** (atenuado); el panel con foco recupera la intensidad. Aplicado al borde
del clip, al header de pista y a las fichas de medios. **Cambiar de panel NO deselecciona**: sólo cambia quién
manda (verificado).

**Casi "arreglo" algo que no estaba roto.** El test dio `standby: none` en el contorno del título del clip →
parecía que la selección desaparecía. Investigado antes de tocar: `body.simpleclips .clip .tt{box-shadow:none}`
gana por especificidad (0,3,1 vs 0,3,0)… **y es intencionado**: en modo simple el título deja de ser el asa, así
que se le quita el indicador de asa. Y la selección **sí se ve**, porque la lleva `.clip.sel` = el **borde del
clip entero** (línea 419). Es decir: yo había apuntado los dos niveles al elemento equivocado. Corregido al
borde del clip, que es la señal que siempre está visible — y el test ahora mide **eso**, no lo que el modo
simple anula a propósito.

**Verificación (7/7):** el clic pone el foco en su panel · el foco se mueve · foco ≠ standby (borde 224 vs 140)
· standby más tenue · **standby sigue VISIBLE contra el fondo** (140 vs 17 — un standby invisible sería peor que
no tener niveles) · cambiar de panel no deselecciona · el header de pista cumple el mismo contrato.
**Regresión total: 43/43** (sistema 13, Info View 8, color de clip 10, affordance 5, foco 7).

## ROUND 102 · D-T3b — Dianas y paleta de espaciado CERRADA. Verificado 36/36, build + deploy

**El enfoque correcto no era agrandar los controles.** La norma AA (SC 2.5.8) no exige tamaño: exige
**separación**. Un control de 16px cumple si su centro está a **≥24px** del siguiente ("si un círculo de 24px
centrado en cada caja no interseca el de otro"). El 44×44 que citan los blogs es **AAA** (SC 2.5.5) y es guía
**táctil**. Así que se **midió la separación real** y se arregló sólo lo que fallaba.

**Dos errores de medición propios, ambos cazados antes de "arreglar" nada que no estuviera roto:**
1. La primera pasada dio **15 incumplimientos, uno con paso de 8px**. Imposible: dos botones de 16px no caben a
   8px sin solaparse. Causa: los controles **ocultos detrás del módulo de audio fijado siguen teniendo
   `getBoundingClientRect`**. Un rectángulo no es una diana. Con **hit-test** (`elementFromPoint`) quedaron
   **4 reales**. Misma lección que la captura de pantalla que resultó ser Blender: verificar lo que hay de verdad.
2. Los 23px de `kf`/`modb` **no eran entre botones de la misma fila: eran entre FILAS** (`.prow` medía 22px de
   alto). Estaba subiendo gaps horizontales para arreglar una distancia vertical.

**Hecho:**
- **`.prow .nav` (stepper de keyframes): 15×18 pegados, paso 15px → 20×20 con gap 4 = paso 24.** Era lo peor de
  la medición, con riesgo real de pulsar el botón contiguo.
- **M/S del header: gap 5 → 8 → paso 21 → 24.** El `gap:5px` además **no estaba en la paleta cerrada de D-T1**.
- `kf`/`modb` → 20×20 (la altura de control de Blender: *"Widget unit is 20 pixels at 1X scale"*).
- `.prow` min-height 22 → **24** (paso vertical). Nota: **Blender envía paso 22 y por tanto incumpliría** la
  norma AA de 2023 — la norma es posterior a su diseño. Preferimos la norma.
- **PALETA DE ESPACIADO CERRADA, aplicada de verdad.** En D-T1 la definí y **no la apliqué**: seguía habiendo
  11 valores. Ahora: `index.html` **{2,4,6,8}**, `app.js` **{2,4,6,8,12,16,24}** — **ninguno fuera**.
  63 gaps remapeados. Aserción nueva en `test-system.js`: sin ella, el siguiente `gap:7px` entra sin que nadie
  lo note — que es exactamente como llegamos a tener 11.

**Gotcha:** inserté `.prow .nav button{width:20px}` **justo antes** de la regla original con la misma
especificidad → ganó la última y mi regla quedó muerta. Los botones seguían a 15×18 y el test lo delató.

**Verificación: 36/36** (sistema 13, Info View 8, color de clip 10, affordance 5).

**Deuda ACEPTADA y anotada, no escondida:** quedan pares a **19.7–20.7px** de paso (`modb`, `curvesBtn`,
`tlZoomIn/Out`). Son incumplimientos reales pero menores, y cada arreglo mueve el layout y crea adyacencias
nuevas — juego del topo con retorno decreciente. Referencia: **Blender ships 22px**. Lo peor (15px) está
resuelto. Se retoma con una pasada de layout, no a base de parches.
También pendiente: alturas de control aún 16/18/20/21/22/24 (el **21 es un accidente**) y los botones
undo/redo/help a 3px del borde superior — deberían estar a **0** para ganar anchura infinita (Farris et al. 2001).

## ROUND 102 · D-T2b/D-T3 — Affordance, estado y polaridad. Verificado 6/6 + 30/30 de regresión, build + deploy

**1. Un valor arrastrable se lee como CAMPO, no como botón.**
`.prow .box` (los valores del inspector, arrastrables: `.field{cursor:ew-resize}`) estaba en **s2 — idéntico a
un botón**: dos comportamientos con la misma pinta. Ahora va a **s0**, más oscuro que el panel.
**La regla investigada NO se aplicó tal cual, y conviene dejar escrito por qué.** Decía: *"reserva exactamente
UN acento saturado para 'valor arrastrable' y no lo uses en ningún otro sitio"* (Blender: `wcol_num.item`
#4772b3, el relleno del deslizador numérico, el único acento saturado de todo su set de widgets). Pero esa regla
**presupone un presupuesto de acentos sin gastar**. El nuestro está gastado a propósito: cian = automatización
viva, ámbar = anulada — que es justo lo que nos diferencia. Un tercer acento rompería la regla que acabamos de
escribir en `:root`. La **dirección del contraste** (D-T1) hace el mismo trabajo y es gratis.

**2. El estado nunca lo lleva sólo el color.**
El clip deshabilitado (Ableton "0") se decía **sólo con opacidad + desaturación**. Ahora lleva además una
**trama diagonal**: *"Avoid using color as the only way of communicating status or other important meaning"*
(HIG de Blender), y Resolve hace lo mismo (*"A slash indicates when a track is disabled"*). La trama es **forma**:
se lee en escala de grises y con cualquier daltonismo. Movido de estilos inline a `.clip.off`.

**3. El editor de curvas invierte la polaridad.**
`.autolane` estaba en s0 — el mismo campo que la timeline. Ahora **s1 (más claro) con rejilla OSCURA**
(`rgba(0,0,0,0.38)` en `laneMode`). Blender envía graph `#303030`/rejilla `#1a1a1a` invirtiendo su secuenciador
`#181818`/rejilla `#303030`: **una curva fina y brillante necesita suelo elevado; un clip macizo necesita pozo.**
El mismo pintor sirve a los dos, así que la rejilla se elige con el `laneMode` que ya existía.

**Verificación (6/6):** el valor arrastrable es más oscuro que el panel (L* 5.1 < 9.8 < 15.2 del botón) · anuncia
el gesto con el cursor · `.clip.off` existe · lleva trama · se atenúa · la banda de curvas es más clara que el
campo. **Regresión: 30/30** (sistema 12, Info View 8, color de clip 10).

Pendiente: selección en 2 niveles (`Selection`/`StandbySelection` — necesita seguimiento de foco por panel),
estado derivado ≠ afirmado, cabecera por tiers de altura, no acoplar selección y cabezal, alturas de control
(16/18/**21**/22/24 → consolidar), verbos-no-sustantivos, Operate→Adjust.

## ROUND 102 · D-T2a — El color de clip significa algo. Verificado 9/9 + 12/12 de regresión, build + deploy

**El defecto:** `CLIP_COLORS` eran **6 grises entre L\* 19 y 29, saturación ~18%**, repartidos **por turno**
(`colorIdx++`). Es decir: indistinguibles entre sí, sin ningún significado, y encima ocupando el eje de brillo.

**LA FUENTE ESTABA MAL, y conviene dejarlo escrito.** El informe de investigación decía que los 11 colores de
strip de Blender están *"todos a la misma luminosidad (las medias RGB se agrupan en ~110–150)"*. **Medidos en
L\* se reparten 20.2** (43.0 → 63.2). La afirmación salía de promediar RGB, no de L\*. El agente la había
marcado como inferencia suya (`[I]`), no como dato — bien marcada, pero falsa.
El principio sobrevive **por otra razón**: Blender puede permitirse ese reparto porque su selección es un
**contorno**, no un cambio de brillo (la nuestra también: `.clip.sel .tt` usa `inset box-shadow`). Así que la
luminosidad constante aquí no la pide el estado — la pide que **ningún tipo de medio grite más que otro**.

**Hecho:**
- `CLIP_HUE`: 9 tonos **calculados**, no elegidos a ojo (búsqueda binaria de la L de HSL que da L\*=50 exacto
  por tono, saturación 40%). **Spread real: 0.26 L\*** frente a los 20.2 de Blender. Separación mínima entre
  tonos: 25°.
- `nest` va **neutro** (`#777777`): una secuencia es **estructura, no medio**. Se dice desaturando, sin leyenda
  — Blender hace lo mismo con `scene`. Verificado en pantalla: entre clips de color, la secuencia se lee sola.
- **El color se DERIVA del tipo al pintar** (`clipTint`), no se reparte al crear.

**Casi meto la pata:** iba a eliminar `c.color` dando por hecho que nadie elige color de clip — mi primera
búsqueda no encontró selector. **Sí existe** (`openClipColorPopup`, "Clic para elegir color del clip"). Lo cazó
comprobar antes de borrar. La solución fina la dio el propio botón *restablecer* del selector: escribe
`#3C4046`, o sea que **esos grises son el centinela de "sin color"**, no una elección. `CLIP_AUTO` los trata
como no-puestos → deriva del tipo → **arregla también los proyectos ya guardados**, sin tocar una sola elección
real del usuario. El *restablecer* ahora pone `null` (deriva) en vez de clavar un gris sin sentido.
- **Filas alternas al 2% de blanco** (`rgba(255,255,255,0.02)`). Blender envía `row_alternate #ffffff05`; la
  mayoría usa 10–15% y eso zumba sobre 30 pistas. Alfa, no un gris: sobrevive a un cambio de tema.

**Verificación (9/9):** misma luminosidad en todos los tipos (spread 0.26) · tonos separados (mín. 25°) · nest
neutro · deriva por tipo · tipo desconocido no revienta · **gris heredado tratado como sin-color** · sin color
deriva · **elección del usuario respetada** · filas alternas distinguibles. Regresión D-T1: **12/12**.

Pendiente de D-T2: selección en 2 niveles (`Selection` vs `StandbySelection`), estado derivado ≠ afirmado,
glifo además de color para muted/locked/offline, contenido de cabecera por altura (tiers), polaridad invertida
del editor de curvas, no acoplar selección y cabezal.

## ROUND 102 · D-T4 — Info View (la barra contextual que faltaba). Verificado 8/8, build + deploy

**Qué es.** Ableton y Blender tienen un sumidero de ayuda FIJO abajo a la izquierda (Live: *"Insert Mark 1.1.1
(Time: 0:00)"* · Blender: *"Set 3D Cursor · Rotate View · Select"*, que dice qué hace cada botón del ratón AHORA).
Lo vi en las capturas a pantalla completa de Beltrán, no en la investigación web.

**Por qué importa** (y por qué no es "un tooltip peor colocado"):
1. **No tapa nada.** Decisivo sobre una timeline, donde el puntero siempre está encima de datos que necesitas ver
   — que es exactamente lo que hace mal un tooltip flotante.
2. **Legitima los controles sin etiqueta**, porque siempre existe una vía de descubrimiento.
3. **Nunca abre una ventana** (y en Electron no tenemos `alert/confirm`: la restricción es el principio).
En R94f quitamos las instrucciones del viewport y **dejamos el hueco vacío**. Esto es lo que faltaba.

**Hecho:**
- `#statInfo` en la barra de estado. Se engancha al sistema de tooltips que ya existía (`title`→`data-tip`), así
  que **los 151 títulos actuales funcionan sin reescribir ninguno**.
- **Instantáneo**, frente al 1s del tooltip flotante (que se mantiene para quien se queda quieto).
- Contrato de tooltip (HIG de Blender) por parseo: `"Nombre — función"` / `"Nombre (V)"` → nombre destacado +
  atajo en su propio slot.
- **`setDis(el,dis,motivo)` ahora marca `data-why`.** Cuando un control está bloqueado, la barra pinta **el
  motivo en ámbar**: es el único momento en que el usuario mira ahí y, por tanto, el único en que de verdad
  quiere aprender → es la superficie donde enseñar el atajo que le falta.

**Gotcha (fallo mío, cazado por el test):** la primera versión deducía "está deshabilitado → su título ES el
motivo". Falso: los controles bloqueados **sin** motivo mostraban su etiqueta normal en ámbar
(*"Previous locator · ,"*), **afirmando una causa que nadie le había dado**. Ahora el motivo es un dato
explícito (`data-why`) y sin él no se pinta ámbar. Aserción añadida: *"bloqueado sin motivo NO finge una causa"*.

**Verificación (8/8):** existe · instantánea · separa nombre/atajo · nombre+descripción · **no solapa el
viewport** · **no solapa la timeline** · bloqueado sin motivo no miente · se limpia al salir. Y comprobado a
mano el caso con motivo: el botón I/O del export muestra *"Set In (I) and Out (O) marks on the timeline first"*
en ámbar — con el atajo dentro del texto.

**Deuda anotada:** solo **1 sitio** llama a `setDis` con motivo. El mecanismo está; falta el contenido. Auditar
los controles que se deshabilitan y darles un motivo es trabajo de redacción, no de código.
Pendiente de D-T4: verbos-no-sustantivos (#31) y Operate→Adjust para proxies/export (#33).

## ROUND 102 · D-T1 — El sistema de diseño, con evidencia. Verificado 12/12, build + deploy

Docs: `AUDITORIA-DISENO-UI.md` (medición de lo nuestro) · `INVESTIGACION-DISENO-UI.md` (30 reglas con fuente) ·
`PROPUESTA-DISENO-UI.md` (35 cambios). Se midieron **Ableton 12, Premiere 2025, Blender 4.0 y Unreal 5.8 en la
máquina de Beltrán**, a resolución nativa — ninguna fuente publica esos píxeles.

**Dos de mis cinco diagnósticos eran FALSOS y la investigación los tumbó** (detalle en `INVESTIGACION` §0):
- *"La escalera de fondos es imperceptible (1.03–1.11)"* → **regla equivocada.** Adobe envía 1.08–1.19; Google
  M2, 1.03–1.12. Estábamos **dentro de especificación**. APCA da **Lc 0.0 a TODOS** los pares contiguos de
  Spectrum y Material: ninguna métrica de contraste sirve para superficies grandes en el extremo oscuro (WCAG
  lleva una constante de velo `+0.05`). La regla correcta es **CIE L\***.
- *"Todo a 9/10/11px = sin jerarquía"* → **parcialmente falso.** Blender envía TODA su UI a **11pt/400**; un
  tamaño, un peso. Atlassian separa cuerpo y encabezado **solo por peso** (12px/400 vs 12px/653). Una escala
  uniforme no es el defecto: el defecto es **9px** (nadie lo envía) y no usar el canal de peso.

**Lo que NO se hizo, y por qué** (esto es la mitad del valor):
- **No aclarar el fondo a `#121212`** (regla de Material). Medido: Premiere —el análogo correcto, es vídeo— está
  en L\*=10.8 y nosotros en 8.2. Ableton (22.6) y Blender (26.7) son más claros porque **no juzgan imagen**.
- **No bajar el contraste del texto**: 16.1:1 nuestro vs 16.9:1 de Premiere.
- **No agrandar controles a 44px**: es WCAG **AAA** y guía **táctil**. La norma AA (SC 2.5.8) es 24×24 **con
  excepción de espaciado**: un control de 20px cumple si su centro está a ≥24px del siguiente. Blender usa 20px.

**Hecho:**
- **6 superficies → 3**, neutras (las cuatro referencias envían grises neutros; nuestro tinte azul sesgaba el
  juicio de color, que es para lo que existe la herramienta). `s0 #111111` (L* 5.1) · `s1 #1B1B1B` (9.8) ·
  `s2 #262626` (15.2). Pasos de **4.7 y 5.4 L\*** (objetivo Spectrum/M3: 4–5).
  **Resultado medido: la superficie dominante pasa del 26% (la más baja de las cinco apps) al 63%.** Toda
  referencia tiene UNA dominante (40–55%); nosotros teníamos seis peleándose.
- **Estados fuera del tope de 3** (no son niveles): `--state-on #4A4A4A`, `--state-hover #303030`.
- **Affordance por DIRECCIÓN del contraste** (Blender): botón = s2, más claro que el panel; campo editable = s0,
  más oscuro. Verificado por aserción.
- **Tintas con la regla correcta:** `--ink #E0E0E0` (Lc −85..−87) · `--ink-2 #B8B8B8` (−61..−64) · `--ink-3
  #8C8C8C` (−38, **NO es texto de cuerpo**: solo marcas de regla y sufijos) · `--ink-dim #6D6D6D`.
  `--ink-faint` (#8A9199, 26 usos) **pasaba WCAG AA con APCA Lc −38** — "aviso de copyright". Levantado a ink-2.
- **Escala tipográfica cerrada: 11/13/20.** 9px erradicado (Geist a 9px da x-height **4.77px**, bajo el suelo de
  renderizado). Muertos los 11.5px y 12.5px inline — eran la prueba de que no había escala.
- **Tokens de verdad:** **~280 hex cableados → tokens**. `app.js` pasa de **78 hex distintos y 4 usos de var()**
  a leer los tokens del CSS (`const UI`), así que el canvas —que no puede usar `var()`— **no crea una segunda
  paleta**. index.html: solo quedan las definiciones de token y 2 rojos semánticos.
- **Paleta CERRADA de espaciado** definida (`--sp-*` = intersección exacta de Spectrum + Primer + Atlassian).
- `.searchbox` 18px → **20px**: a 11px el texto pedía 15px de interlineado y se recortaba. Es además la altura
  de control de Blender.

**Gotcha (fallo mío, cazado de casualidad):** colapsar `--surface-3` sobre `s2` dejó el **hover idéntico al
botón en reposo** — invisible. Las comprobaciones de tokens, tamaños y desbordes **pasaban todas**. Igual,
`--bg-2` (fichas de medios, regla) mapeado a `s0` aplanaba el nivel de panel. Lección: **los alias hay que
mapearlos por lo que cada uno HACE, no por su nombre**, y hace falta la aserción *"ningún estado puede verse
igual que su reposo"* — ahora está en `scratchpad/test-system.js` y es lo que lo habría cazado.

**Verificación (12/12 en vivo):** tokens resuelven · pasos 4–5 L\* · **3 aserciones de estado≠reposo** ·
dirección del contraste · existe regla :hover · ningún tamaño fuera de {11,13,16,20} · nada bajo 11px · ningún
texto recortado.

Pendiente: D-T4 (barra contextual — Ableton y Blender la tienen y nosotros dejamos el hueco vacío en R94f;
verbos no sustantivos; contrato de tooltip), D-T2 (timeline: tipo por tono a luminosidad constante, selección
en 2 niveles, filas al 2%, polaridad del editor de curvas), D-T3 (un solo acento saturado = "arrastrable").

## ROUND 101 — Separación vídeo↔audio en la línea de tiempo: alineación y divisor. Verificado 12/12 en el .exe

Dos fallos reportados ("el rectángulo de audio está roto, se enreda al agrandarlo/achicarlo; se ve por detrás
cómo pasan los nombres de las pistas de vídeo"). Resultaron ser dos causas distintas:

**1. Los nombres no cuadraban con sus pistas (la MISMA raíz del "se ve por detrás").**
`#tlscroll` cede 9px a su barra de scroll horizontal; la columna de cabeceras (`.trackhdr`) no tiene barra, así
que su altura visible era 9px MAYOR → su recorrido máximo (contenido − visible) era 9px MENOR. El sync
`th.scrollTop = sc.scrollTop` topaba: en los últimos 9px de scroll las pistas seguían y las cabeceras no, así que
cada nombre se desalineaba de su fila y asomaba por debajo del módulo de audio fijado.
→ Se le da a la columna de cabeceras el mismo margen inferior (`marginBottom = hsb`): misma altura visible, mismo
recorrido, mismo anclaje. El módulo ya fija en `bottom:0` en ambas columnas y **se elimina el hack** que lo
levantaba 9px a posteriori (compensaba el síntoma, no la causa).

**2. El divisor "se enredaba" — zona muerta por sobredesplazamiento.**
`state.tl.audioH = clamp(h0 + (y0 − y))` acumulaba el exceso: si te pasabas 200px del techo, había que desandar
esos 200px antes de que el módulo se moviera. Medido: subir 320px → techo 197; bajar 200px → **sin respuesta**.
→ Se mide el delta respecto a la posición ANTERIOR y se re-ancla en cada movimiento: el exceso no puede acumularse.
Ahora responde en el primer píxel (197 → 157).
→ Además `audioModuleMax()` es ahora la ÚNICA fuente del techo, compartida por el arrastre y el render. Antes cada
uno tenía su fórmula (`max(80,vh*0.55)` vs `vh*0.55`): si divergen, vuelve a aparecer una zona muerta.

**Verificación (12/12 en el .exe empaquetado):** misma altura visible y mismo recorrido en ambas columnas · drift
0px en TODO el recorrido (no sólo al final) · módulo alineado entre columnas (Δ0.0 arriba y abajo) · la última
fila de vídeo queda a ras del módulo, nunca sepultada · independencia de la rueda (audio no mueve vídeo y
viceversa) · rueda sobre cabeceras de audio arrastra el módulo · ambas columnas del módulo siempre a la misma
altura · el divisor responde al primer píxel y baja hasta el suelo (49).
Opacidad comprobada por hit-test (`elementFromPoint` dentro del módulo → siempre `audio-module`, nunca una
cabecera de vídeo): no había transparencia, el síntoma era puramente el desfase.

**Gotcha de testing:** los dos tests manipulan la UI viva; encadenarlos sin reiniciar estado (audioH, scrollTop
del módulo) cambió los números y fingió un fallo de zona muerta en el .exe que en aislamiento no existía. Los
tests de UI deben reiniciar su propio estado.

## ROUND 100 — "Ecosistema directo": EXPORT HAP / HAP Q (.mov) sin FFmpeg. Verificado contra ffmpeg, build + deploy

**Qué es y por qué.** Hap (Vidvox) es el códec de intercambio del mundo del directo: Resolume, disguise, Watchout,
TouchDesigner, Millumin. Guarda texturas DXT a tasa fija que la GPU sube **sin decodificar en CPU** — por eso una
máquina reproduce varias capas 4K donde con H.264 se ahoga con una. Sin esto, entregar a un show obligaba a pasar
por AfterCodecs/ffmpeg fuera de la app. Ahora sale del editor.

**Cómo, sin FFmpeg.** Las tres etapas son nuestras: el fotograma ya está en la GPU → se comprime ahí (shader
WebGL2 que rinde a un FBO `RGBA32UI` donde **cada téxel ES un bloque** DXT, así `readPixels` ya devuelve el flujo
en el orden que DXT quiere); Snappy son ~60 líneas; y el contenedor QuickTime se escribe a mano.

- **Variantes:** `hap` → Hap1 (RGB · DXT1 · 0,5 B/px) y `hapq` → HapY (Scaled YCoCg · DXT5 · 1 B/px, más calidad).
- **Chunks (elegibles, Auto por defecto):** 1 → sección Snappy simple (0xBB/0xBF); N → sección troceada
  (0xCB/0xCF) + Decode Instructions Container (0x01) con tabla de compresores (0x02) y de tamaños (0x03).
  Sirven para que el REPRODUCTOR descomprima en N hilos. Auto = núcleos, potencia de dos, tope 8.
- **UI:** fila de Chunks sólo en HAP; bitrate oculto; la estimación es honesta y avisa del caudal
  (4096²/60 Hap1 ≈ **428 MB/s** — en ámbar, porque exige un SSD que lo alimente).
- **Contenedor:** `co64` + `mdat` de 64 bits SIEMPRE (a 4K son GB por minuto; con 32 bits los offsets se
  desbordarían en silencio). Audio PCM 16-bit `sowt` intercalado fotograma a fotograma. Escritura en streaming.

**Gotcha grande — endpoints DXT por EJE PRINCIPAL, no por caja delimitadora.** La primera versión elegía los
extremos con el min/max por canal. Un bloque de rojo `[255,0,0]` y cian `[0,255,255]` tiene una caja que va de
negro a blanco → la paleta entera sale **gris**. Medido: **27,43 dB frente a los 42,60 de ffmpeg**. Con covarianza
+ iteración de potencia (lo que hace stb_dxt): **41,65 dB**. No volver a la caja.

**Verificación (ffmpeg 8.1 como juez independiente — NO es dependencia de la app, sólo del test):**
- Snappy: 14/14 round-trips contra un descompresor escrito aparte desde la especificación (incluye incompresible
  → 100%, límites de fragmento de 64KB, copias largas).
- 7 ficheros × ffprobe/decode: fourcc, tamaño, fps, nº de fotogramas, **orientación** (3 marcas de esquina exactas),
  **orden de fotogramas**, PSNR, y **audio bit a bit exacto**.
- **Calidad contra el propio codificador hap de ffmpeg:** Hap1 41,65 vs 42,60 dB (−0,95); HapY 44,99 vs 44,78 (+0,21).
- **Chunks de verdad:** se parsea la sección del fichero y se cuentan (1→Snappy simple, 4→4 entradas, 8→8; los
  tamaños cuadran con los bytes que siguen). ffmpeg decodifica igual con 1 que con 8 → sin esto, un ajuste
  ignorado en silencio habría pasado los tests.
- **Export REAL** (no una réplica): `runExport` completo, diálogo nativo incluido → 24 fotogramas HapY 512²,
  4 chunks confirmados dentro del fichero, y **52,37 dB entre lo que pintó el motor y lo que salió del .mov**.

**Notas.** Dimensiones no múltiplo de 4 → se rellena (funciona; el borde añadido mide 44 dB). ffmpeg **rechaza**
codificar esos tamaños, así que ahí no hay baremo externo. HAP Alpha (Hap5) NO se expone: el shader DXT5 ya está,
pero `renderExportFrame` compone opaco, así que saldría un alfa inútil — pendiente si se quiere para capas.

## ROUND 97 — "NLE de verdad": J/K/L + TRIM CONTEXTUAL + trim numérico + ↑/↓ entre cortes. Verificado CDP 14/14 + 16/16, build + deploy
Del informe: *"J/K/L + trim es lo que separa 'herramienta de juguete' de 'NLE' a ojos de un profesional"*. (Stems descartados por el user: los hace en Dolby.)
- [x] **J / K / L** — el estándar universal que NO teníamos (y la `L` estaba ocupada por el marcador, justo la tecla de "play adelante"): J atrás · K para · L adelante, **repetir dobla** (1×→2×→4×→8×, con tope), invertir dirección vuelve a 1×, **K mantenida + J/L = ¼× cámara lenta** (keyup + blur para que la K nunca quede pegada). **Marcador movido a `M`** (la tecla estándar), actualizado en la paleta.
  - Diseño: a **1× se delega en el transporte real** (esclavo del reloj de audio, con sonido); a cualquier otra velocidad corre un **rAF propio que hace scrub** — WebAudio no puede reproducir a 4× ni en reversa, y `ploop` esclaviza el playhead a `actx.currentTime`, lo que hace imposible la velocidad variable. Shuttle silencioso por encima de 1×, como las platinas clásicas. **Tope de 30 fps de seek**: a 8× una tormenta de seeks a 60 fps ahoga el decoder.
- [x] **TRIM CONTEXTUAL (`T`)** — el modelo de Resolve: **una tecla y el CURSOR decide**, sin cambiar de herramienta (el informe lo señala como la mejor relación coste/beneficio disponible). Zonas: borde que toca a un vecino = **ROLL** · borde libre = **RIPPLE** (y desplaza todo lo posterior) · banda de título = **SLIDE** · cuerpo = **SLIP**. Respeta los límites de material igual que el trim normal (nunca se puede tirar de material que no existe). Botón nuevo en la barra + icono.
- [x] **Trim numérico por teclado**: con `T` armado, ←/→ trimam el borde más cercano al cabezal (1 frame · **Shift = 10**) — precisión sin cazar píxeles ni depender del zoom.
- [x] **↑ / ↓ = corte anterior / siguiente** (`jumpCut`: todos los puntos de edición de la timeline).
- Verificado CDP: shuttle 1×/2×/4×/8× con tope, inversión, K+L=0.25, `M` pone marcador y `L` ya no, ↑/↓ 0→2→6→8; y los **invariantes matemáticos de cada trim**: roll conserva la duración total y `inP` sigue al corte · rippleR/L desplazan lo posterior y el start no se mueve en rippleL · slip conserva posición y duración y solo mueve el material · slide mueve el clip, el vecino absorbe y el material queda intacto · clamps de material en slip y roll · las 4 zonas resuelven a la operación correcta.

## ROUND 96 — INVESTIGACIÓN 2 (user: "¿qué otras herramientas tenemos mal enfocadas?") + 2 BUGS DE PRODUCTO corregidos. Verificado + build + deploy
**Informe completo en `INVESTIGACION-HERRAMIENTAS.md`** (3 frentes con fuentes primarias, contrastados contra el código real; propuesta de rondas R97–R100).
- [x] 🔴 **B1 · La secuencia PNG no cumplía el estándar de entrega fulldome**: exportábamos `dome_000.png` (base 0, relleno variable con la duración); **IMERSA/AFDI exige `Nombre_000001.png` — 6 dígitos, base 1**. Un planetario NO podía ingerir la entrega sin renombrar frame a frame y dos exports de distinta duración ordenaban distinto. `pad=Math.max(6,…)` + `fnum(i)=i+1`. Verificado a 1 / 300 / 135.000 / 2M frames.
- [x] 🔴 **B2 · El `.isp` podía corromperse**: `dsp:writeText` escribía directo sobre el archivo → un crash, un corte de luz o Drive/Dropbox sincronizando a mitad dejaban el proyecto truncado (el fallo documentado que mata proyectos de Premiere; los proyectos de Beltrán viven en el Escritorio respaldado en Drive). Ahora **escritura atómica**: temp en la misma carpeta → `fh.sync()` → `rename` (atómico en el volumen) → lectores ven el viejo o el nuevo, nunca medio archivo; limpia el `.tmp` y conserva la escritura directa como último recurso. Probado fuera de Electron (1ª escritura, sobrescritura de 50 kB, sin residuos).
- **Hallazgo estratégico**: **no existe un NLE fulldome dedicado** — la lista *Dome Production Tools* de IMERSA no tiene ni un editor de timeline; los artistas montan en After Effects. La investigación **valida la arquitectura**: el warp/blend NO es del editor (pre-deformar congela la geometría de un domo concreto: anti-patrón), y la tira de muros ES el UV unwrap estándar de disguise (`stripW=Σ pxW` = su regla de densidad de píxeles). Los proxies manuales tampoco son un error (FCP 12.3 apagó el background rendering por defecto): lo que falta es **visibilidad de estado**.
- **Huecos priorizados**: (R97) **J/K/L** — no los tenemos y la `L` está ocupada por marcador, justo la tecla universal de "play adelante" — + **trim contextual `T`** (el cursor decide ripple/roll/slip/slide) + trim numérico; (R98) **stems discretos `_L/_R/_C/_LFE/_Ls/_Rs`** (hoy un solo audio.wav → bloquea entrega como B1) + **área segura fulldome** ±90°/10-60° + sweet spot + burn-in + presets multi-venue; (R99) badges/barras de proxy-caché (modelo predictivo verde/amarillo/rojo de Premiere) + fallback per-clip + borrar generados in-app; (R100) **HAP** (lingua franca de media servers, viable sin FFmpeg: DXT+Snappy), Spout, LTC. Idea propia: **snap al beat** (nuestro "Descript musical": ya tenemos detección de beats) — no lo hace bien ningún NLE mainstream.
- ⚠️ Riesgo anotado: "la independencia de resolución es mentira" — la tira de sala se compone por PÍXELES → probar proxies+sala explícitamente.

## ROUND 95-D2 — 🔷 VANGUARDIA: Automation Items (curva reutilizable y POOLED). Verificado CDP 11/11, build + deploy
La función más citada de Reaper y que **ningún editor de vídeo tiene**. En el menú contextual de cualquier curva.
- [x] **Guardar curva como Automation Item** (con nombre) → biblioteca `state.autoItems`, persistida en el `.isp` y en el undo (editar una instancia reescribe el item: es estado deshacible).
- [x] **Insertar** el item en cualquier (clip, parámetro) en el punto del clic.
- [x] **POOLED de verdad**: editas una instancia y **todas las demás cambian**. Decisión de arquitectura: pooling **por propagación**, no por indirección — el editor sigue escribiendo en `c.kf[p]` (sus 30+ puntos de escritura y `evalP` NO se tocan) y `commit()` empuja el cambio al item y a los hermanos (`poolPropagate`). Misma promesa al usuario, una fracción del riesgo.
- [x] **Repetir sobre el clip (loop)** y **Repetir acumulando (relative)** — el `Set Relative` de Fusion / `Loop+Offset` de Cavalry: paneos y rotaciones infinitas gratis (verificado: rampa 0→90 repetida acumula por encima de 180). Guarda de 512 pasadas para que un item diminuto en un clip largo no explote.
- [x] **Desvincular (hacer único)** corta el pooling; **duplicar un clip conserva la instancia** (es justo el sentido del pooling); borrar la curva desvincula.

## ROUND 95-D1/D4 — 🔷 VANGUARDIA: perform-and-bake + freeze por modulador. Verificado CDP, build + deploy
- [x] **D1 · PERFORM-AND-BAKE** (`#autoRecBtn` en el transporte, punto rojo que late — el único rojo del chrome): armas REC, das a play y **interpretas el parámetro con el ratón mientras suena la música**; el gesto se escribe como keyframes y **se hornea con RDP al parar** → curva editable, no una clave por frame. Es "Inventing on Principle" aplicado al VJ: tocar el movimiento en vez de teclearlo.
  - **Punto de captura único**: `manualEdit()` — por ahí pasan YA todas las ediciones manuales (fader del inspector, número, rueda, arrastre en el visor), así que la captura es completa sin tocar 6 sitios.
  - **Modelo TOUCH sin exponer modos** (la decisión más elegante de toda la investigación, de Live): el ratón implica touch, así que al soltar deja de escribir solo — `manualEdit` simplemente deja de dispararse. Cero UI de modos.
  - Semántica touch real: la toma **borra lo preexistente en el tramo que recorre** pero respeta lo que hay fuera. Verificado: toma 1 (seno) → `0:50 0.57:81 1.00:90 1.43:81 2.00:50` (61 puntos → **7**, error máx 1.7/100); regrabar plano sobre 0–1 s → `0:20 1.00:20 1.20:88 1.43:81 2.00:50` (tramo reescrito, **cola intacta**).
  - Grabar CANCELA el override (`_autoOff`): estás escribiendo la curva, no puenteándola. Un solo `pushUndo` por toma.
- [x] **D4 · FREEZE por capa de modulación** (`m.frz`, botón ❄ cian): congela la salida de esa capa en su valor actual — seguridad en directo ("ahora NO quiero que siga a la música"). Raro en NLEs. La línea de auditoría lo dice (`❄audio`), porque si no "¿por qué no reacciona?" no tendría respuesta visible.
- Bug cazado: un `//` dentro de `pause()` (función de una línea) se tragó el resto del cuerpo → `node --check` lo pilló. **Mismo error que ya ocurrió en R92: en este archivo, comentar dentro de funciones de una línea exige `/* */`.**

## ROUND 95-C2 — 🔷 DIFERENCIADOR: elegir la banda DIBUJÁNDOLA sobre el espectro real. Verificado CDP (3 tonos exactos + kick sintético), build + deploy
**Notch deja VER el espectro mientras eliges la banda; VDMX deja ASIGNAR arrastrando. Nadie une las dos cosas — esto sí.**
- [x] **Espectro real propio** (`computeSpectrum`): el análisis existente son 3 filtros biquad (bass/mid/treble) y **jamás puede responder "dame 220–480 Hz"**. Nueva pasada ÚNICA con **FFT radix-2 propia** (`_fftRadix2`, ~15 líneas) → **32 bandas logarítmicas** (40 Hz–12 kHz) por frame. Decimación previa a 16 kHz con anti-alias de caja → resolución fija de 15,6 Hz **sea cual sea el sample rate de origen** y coste independiente de él (~13 ms/3 s de audio ⇒ ~20 s para una película de 75 min, en segundo plano con `await` cada 1024 frames). ~17 MB para 75 min. **No toca `m.bands`** → los FX reactivos no pueden romperse.
- [x] **Picker dibujable** (`drawSpecPicker`/`bindSpecPicker`) dentro de la capa de audio del panel: espectro **vivo** en el cabezal (se repinta con él), **arrastrar cruzando = fijar f0..f1**, **arrastrar dentro de la ventana = deslizarla** (proporcional en log → conserva su ancho musical), **clic = volver a banda con nombre**, doble clic = reset. La ventana elegida se pinta en cian y el resto en gris. Retícula 100/1k/10k.
- [x] `specRangeRaw(f0,f1)` construye el envelope de una ventana arbitraria bajo demanda (con gain/gate del motor reactivo) y lo cachea en el medio; `modAudioEnv` lo usa cuando hay rango propio y conserva la ruta de bandas con nombre. La línea de auditoría nombra la fuente REAL: `audio(55-110Hz)`.
- **3 bugs de fondo cazados y corregidos** (todos habrían pasado inadvertidos sin verificación numérica): (1) 🔴 **el modulador de audio de C1 nunca funcionaba** — pedía la banda `'low'`, que no existe (son bass/mid/treble/bright) → señal 0 siempre; (2) las bandas del espectro **compartían el bin del borde** → un tono aparecía en dos bandas con el mismo pico y ganaba la más grave: todo leía una banda por debajo (`k1 = round(edge)−1`); (3) 🔴 **la normalización ×3.2 "de headroom" saturaba** las bandas vecinas a 1.0 y el empate lo ganaba la más grave → el dato ahora es lineal y honesto, y el realce (^0.55) vive solo en el pintor. Verificado con tonos a 44,1 kHz: 100 Hz→banda 98-117 ✓, 1 kHz→990-1183 ✓, 6 kHz→5882-7030 ✓, y con un bombo sintético a 70 Hz la ventana 55-110 da 31% en el golpe y 3% entre golpes.

## ROUND 95-C1/C3 — 🔷 DIFERENCIADORES: pila de modulación unificada + moduladores espaciales de domo. Verificado CDP 18/18, build + deploy
**Esto es lo que no tiene ningún editor de vídeo del mercado.** Diseño = síntesis de Bitwig (la modulación vive EN el control) + Cavalry Behaviour Mixer (blend explícito por capa) + Houdini Layer CHOP (base absoluta), en `INVESTIGACION-AUTOMATIZACION.md` §4 C1/C3.
- [x] **Modelo**: `c.mod={'<param>':[{id,src,blend,depth,on,…}]}` — serializado con el clip, deep-copiado con ids nuevos en `sepAuto` (split/duplicate/nest nunca comparten capas por referencia).
- [x] **Punto de inserción limpio**: `evalP` sigue siendo la BASE pura (keyframes) → el editor de curvas dibuja y edita eso, la pila jamás pelea con él. `evalR` (lo que ve el RENDER) = keyframes → modificadores de movimiento → **`evalModStack`**. Un solo punto, sin tocar los 33 usos de evalP.
- [x] **3 fuentes** (`modSignal`, todo derivado de `t` → determinista en export): **LFO** (sine/tri/saw/sq/random, Hz o sync a BPM con divisor, fase) · **Audio** (banda low/mid/high con envelope attack/release propio + curva de respuesta + invertir; caché `_modAudioCache` espejo del de FX) · **🔶 Dome space (C3)** = el valor depende de la POSICIÓN del clip en el domo (elevación, azimut, distancia al cenit) con rango from/to — los *Falloffs* de Cavalry en coordenadas fisheye. **Ningún NLE lo tiene porque ninguno es fulldome.**
- [x] **6 blends explícitos**: + Add · − Subtract · × Multiply · ∧ Min · ∨ Max · = Override, con profundidad en unidades del parámetro (add/sub) o % (resto), y clamp final al rango. Capas reordenables (↑) y puenteables (●/○).
- [x] **🔷 LA LÍNEA DE AUDITORÍA** (`modFormula`, cian, siempre visible al pie del panel, refrescada con el cabezal): `24% = base 40% + audio(low)(0% ×55%) × LFO 0.35Hz sine(100% 60%) × dome(dist)(50% 80%)`. Cumple la regla de oro destilada de toda la investigación: *el usuario debe poder responder "¿por qué vale eso ahora mismo?" sin abrir nada*.
- [x] **El estado vive en el control** (Bitwig): botón `.modb` cian cuando el parámetro está modulado, número en cian mostrando el valor RESUELTO, y `.modarc` = franja cian dibujada SOBRE la pista base marcando el tramo base↔modulado (base y modulación nunca se funden).
- [x] `anyAnim()` ahora incluye `hasLiveMod()` → un LFO libre anima el preview igual que un modificador de movimiento (audio/espacio siguen al cabezal).
- Verificado CDP: sin modulación evalR==evalP · LFO determinista y periódico (t0=50, medio ciclo=90 exacto) · clamp · gate multiplicativo (50/0) · espacial el=45→25 y cénit→50 · fórmula correcta · UI (botón, panel, 3 capas, +LFO/+Audio/+Dome, cierre) · deep-copy. Bug cazado: `refreshModFormula` usaba `getElementById` con el panel aún fuera del DOM → la línea salía vacía en el primer render.

## ROUND 95-AT2/AT3 — Fricciones + operaciones de RANGO (niveles A y B de INVESTIGACION-AUTOMATIZACION.md). Verificado CDP 8/8 + 10/10 + 6/6, build + deploy
- [x] **A1 · Resalte previo de la zona activa** (`cv._hoverSeg` + trazo grueso α0.28 sobre el segmento bajo el cursor, Bitwig 6): ataca la fricción nº1 documentada de TODOS los editores ("un pixel de error y agarras otra cosa" — foro BMD). Tooltips por zona: punto vs segmento.
- [x] **A2 · Alt+arrastrar un punto curva los DOS segmentos vecinos** (Bitwig — ease in/out simétrico de un gesto); Alt+clic sin arrastrar sigue borrando (clic vs drag, sin ambigüedad de modo).
- [x] **A3 · Value / Offset / Scale sobre la multiselección** (Fusion): asignar (muestra el promedio) · sumar · multiplicar, con clamp al rango del parámetro.
- [x] **A4 · LIBRERÍA DE EASING normalizada 0–1** (`EASE_PRESETS`, 12: Ease In/Out/InOut, Smooth, Slow Start/End, Expo, **Back Out (overshoot)**, **Back In (anticipate)**, Anticipate+Overshoot, Linear) — el hueco que en AE llenan Flow / Ease and Wizz (su popularidad ES la prueba del hueco). Se aplica al segmento bajo el cursor o a cada par consecutivo de la selección, escalando el bezier al span real → una curva sirve para cualquier duración/rango. + **Copiar/Pegar easing** (`state.easeClip`).
- [x] **A5 · Reducción RDP automática al soltar el trazo** freehand con Alt (Bitwig/Reaper): el trazo queda editable en vez de dejar una clave por frame.
- [x] **B1 · SHAPE BOX** (`Shift+B`, Fusion — la operación de rango más completa del sector): caja con 8 tiradores sobre la selección; esquinas escalan, bordes estiran un eje, **Ctrl+esquina = SESGA (shear en tiempo proporcional al valor)**, dentro mueve, **Alt = espejo respecto al tirador opuesto** (Live 12), Esc cierra. `state.shapeBox.base` congela las coordenadas originales → cada arrastre es absoluto (sin deriva). Gotcha resuelto: `B`=cuchilla se evaluaba antes e ignoraba modificadores → el handler de Shift+B va delante.
- [x] **B2 · Taper** (AE Ctrl+Alt+esquina): escala la AMPLITUD respecto al valor medio conservando la forma y **sin mover los tiempos**.
- [x] **B3 · Curve ghosting** (Cavalry): durante cualquier gesto (punto, segmento, Alt-curva, draw, Shape Box) la curva previa queda detrás en gris discontinuo; se limpia al soltar. Snapshot → coste cero en reposo.
- Robustez: `state.shapeBox` guarda refs vivas a keyframes → se suelta en `restore()` (undo/redo) y en `loadSeqIntoState()`, donde esos objetos se reemplazan. Verificado: sin regresiones (clic en línea añade, clic en punto borra, B a secas sigue siendo cuchilla).

## ROUND 95-AT1 — Estética de la automatización aplicada (análisis VIENDO capturas reales). Verificado CDP + build + deploy
Análisis estético en `INVESTIGACION-AUTOMATIZACION.md` §4-bis (capturas descargadas de los manuales en `scratchpad/ref/`: Ableton arranger envelopes, Bitwig modulation range/multi, Blender graph editor + captura equivalente nuestra). Reglas E1–E8 y su origen documentados ahí.
- [x] **E1 · Color = identidad del parámetro en las 3 superficies**: `PCOLOR` ya no tiene grises (opacity #E8EAED→**#7FB2E8**, crop y contrast rehuidos) — la curva primaria salía BLANCA y rompía el mapeo; + **barra lateral de 3px** con el hue del parámetro en `.autoctl` y `.autohdr` vía `--pc` (el vínculo header↔curva de Blender, sin robar ancho).
- [x] **E2 · Saturación = foco** (Ableton): `isAutoFocus(cv)` — lane bajo el cursor gana; si no, la del clip seleccionado. Curva con foco 1.8px/α1, resto mismo hue a **α0.45**/1.4px. Solo afecta alpha/grosor, nunca geometría. Los puntos siguen a su lane pero hover/selección siempre en blanco pleno (E5).
- [x] **E3 · El material se aparta**: en `body.automode`, `.clip .fill` a 0.35, `.cthumb` 0.3, `.scrim` 0.5 → la envolvente es la protagonista.
- [x] **E4 · (el hallazgo clave, era NUESTRO peor problema) Headers legibles**: los 2 dropdowns **se apilan en vertical** (como Ableton, que no los pone en fila) → cada uno usa el ancho completo del header; se acabó el "Tra∨ ◆S∨" ilegible. Además, **choosers en vivo solo en la pista con foco**; el resto muestra device/parámetro como **texto de 2 líneas** (`autoDuoText`) que al pulsarlo se convierte en los dropdowns reales.
- [x] **E6 · Tokens de estado**: `--auto-live:#4FC3E8` (cian, gobernado/modulado en vivo) y `--auto-ovr:#E5B567` (ámbar, override) — complementarios, imposibles de confundir. Preparados para C1/C2.
- Verificado CDP: hue de opacity, barras --pc (azul primaria / rojo sub-lane), apilado en columna, texto sin foco ("Opacity"), texto→dropdown al clic (y el cambio de parámetro sigue funcionando), clip a 0.35, `isAutoFocus` operativo. Captura comparativa antes/después.

## ROUND 95 — INVESTIGACIÓN del sistema de automatización (user: "es crítico, debe ser excelente para diferenciarse"). SIN cambios de código
3 agentes con fuentes primarias (manuales) + foros: (A) DAWs — Live 12/Bitwig/Reaper/Logic/Cubase/FL; (B) VFX/motion — AE/Blender/Nuke/Fusion/Maya/Cavalry/Rive; (C) inmersivo/live — TouchDesigner/Notch/Resolume/VDMX/Millumin/Smode/Unreal/C4D Fields/Houdini + UX (Bret Victor, Draco, Sketch-n-Sketch, Apparatus). **Informe completo en `INVESTIGACION-AUTOMATIZACION.md`** (fuente de verdad; propuesta en 4 niveles A/B/C/D). Titulares: el consenso de gestos es *tensión por segmento* (Alt+arrastrar, Alt+doble clic ⇒ ya lo tenemos); nos falta TODO lo de operaciones sobre RANGO (Shape Box de Fusion, taper, campo tri-modo Value/Offset/Scale) y la librería de easing normalizado (el hueco que llenan Flow/Ease and Wizz en AE); los 3 diferenciadores propuestos = **pila de modulación unificada legible** (Bitwig+Cavalry Mixer+Houdini Layer, con fórmula en texto y anillo en el control), **asignación audio-reactiva dibujando la caja sobre el espectro en vivo y arrastrándola al parámetro** (Notch+VDMX; nadie une las dos) y **moduladores espaciales de domo por az/el** (Falloffs de Cavalry en fisheye; ningún NLE lo tiene porque ninguno es fulldome). Errores documentados a evitar: auto-seleccionar value/speed graph (AE), un gesto con dos significados según modo, hit-targets frágiles (queja nº1 de Fusion/BMD), modo global vs por pista (queja nº1 de Bitwig 6).

## ROUND 94f — Playhead −15% sin línea sobre la regla · contorno 3D sin dientes · sin instrucciones · Simple por defecto. Verificado CDP + build + deploy
- [x] **Playhead**: coronilla 13×12 → **11×10 (−15%)**, `top:12px` (la punta acaba justo donde termina la regla) y **`.playhead` arranca en `top:22px`** con altura = solo las pistas → la línea vertical ya NO atraviesa la regla ni la figura; la coronilla es su remate. El `#snapline` conserva regla+pistas.
- [x] **Contorno del domo 3D (spring line) sin dientes**: el diagnóstico era que la banda ámbar estaba **centrada en e=90°, que es el borde exacto de la malla** → su mitad exterior la recortaba el polígono del borde y, con el canvas en `antialias:false` (decisión de R92-T3, no se toca), quedaba media línea aliaseada. Ahora es una banda de ~2px **flotando justo por dentro del borde**, con smoothstep a ambos lados: el borde geométrico dentado queda negro-sobre-negro (invisible) y solo se ve la banda suave. Además la malla pasa de S=96 a **S=256** segmentos (borde más redondo; geometría estática, se construye una vez).
- [x] **Fuera el empty-state del timeline** ("Drag media here…", el U-24 de la auditoría) — sin instrucciones en el lienzo; el drop-zone del panel Media ya lo dice.
- [x] **Simple clips ON por defecto** (`state.tl.simpleClips:true` + `syncSimpleUI()` en `init()`); los proyectos guardados antes de que existiera la bandera abren en Simple.

## ROUND 94e — In/Out en el transporte · viewport solo-seleccionado · Alt=copiar · sin etiqueta en el clip. Verificado CDP + build + deploy
- [x] **Botones Mark In / Mark Out** (`#markIn`/`#markOut`, iconos corchete nuevos) flanqueando el transporte: clic marca (equivalente a las teclas I/O), **clic derecho borra el rango**, y se **encienden** cuando la marca existe (`updIOBtns()` llamado desde `renderWork()` → cubre teclas, loop, arrastre del brace y carga de proyecto). Flashes renombrados a "In/Out".
- [x] **Viewport: solo el clip SELECCIONADO en el timeline es arrastrable** — en domo (nuevo `domeClipHit()`, hermano de `flatRectHit`) y en flat: sin selección no se arrastra nada (panea) y el visor **ya no re-selecciona por hit-test**, así un clip tapado por capas superiores sigue siendo el arrastrable. Verificado 5/5 con dos clips apilados (el de abajo seleccionado se mueve, el de encima intacto).
- [x] **Alt+arrastrar = duplicar** (Premiere) en vez de Ctrl+arrastrar (`drag._copy=!!e.altKey`); Ctrl+arrastrar ahora solo mueve. Sin conflicto con el bypass de snap (ese Alt vive en `startTimeSelect`, no en el drag de clip).
- [x] **Sin etiqueta de parámetro pintada sobre el clip** en modo automatización (`cv._label` fuera de `attachClipAuto`) — los dos choosers del header de pista ya lo nombran.

## ROUND 94d — Barra de extensión de clips + rango de export In/Out vs clips + coronilla del playhead. Verificado CDP + build + deploy
- [x] **Barra de extensión de clips** en la regla (`#clipExtent`, 3px al pie, gris --ink-3): abarca del primer clip al último (`renderClipExtent()` + helper `clipExtent()` reutilizable; en renderTimeline). Coordenadas de contenido → scrollea con la regla, sin hooks extra.
- [x] **Rango de export explícito** (fila "Range" en el modal, `#exRange`): **Clip extent** ⟷ **In / Out**. Con marcas I/O puestas → I/O viene seleccionado; sin marcas → el botón I/O queda deshabilitado (`setDis` + title explicativo) y manda la extensión de clips. Muestra el TC del rango (`#exRangeTc`), el estimado y el aviso de tamaño lo siguen (`exRangeSecs()`), y el modo se congela en cada job (`opt.range`, jobs legacy sin range conservan el comportamiento previo). `runExport` ahora usa `clipExtent()` en vez de `0→duration()` (antes exportaba el hueco inicial si el primer clip no empezaba en 0).
- [x] **Playhead estilo Premiere**: `#phTri` pasa de flecha (borders CSS) a **coronilla de hombros rectos con punta** (13×12px, clip-path) alojada en la regla.
- (La función In/Out con teclas I/O/X y su brace arrastrable ya existía — R94d solo la conecta al export de forma explícita.)

## ROUND 94c — Vista simple de clip + Snap to Grid off + thumbnail fijo. Verificado CDP + build + deploy
- [x] **Thumbnail SIN deslizamiento**: `.cthumb` fijo en `left:0` del clip (quitados `positionThumbs`/`scheduleThumbs` y sus hooks) — siempre en el extremo izquierdo del clip.
- [x] **Botón "Simple" (`#simpleClipBtn`, icono `clip` nuevo) — vista simple estilo Premiere** (`state.tl.simpleClips`, persistido en `tl`, también en Preferencias y en el menú contextual del transporte y la paleta): el clip entero es superficie de agarre/selección (no solo la banda de título) y la **selección de rango deja de funcionar sobre el clip** — solo fuera de él. Apagado = modelo Ableton actual. Cursor `grab` sobre el clip: OJO, `applyToolCursor()` escribe cursor INLINE en cada `.clip` → el CSS no basta; se resuelve ahí (y `syncSimpleUI()` lo llama).
- [x] **Snap → "Snap to Grid" y APAGADO por defecto** (`state.tl.snap:false`, `class="on"` fuera del HTML; persistido en `tl.snap`): renombrado en botón, tooltip, flashStatus, Preferencias, menú contextual y paleta.

## ROUND 94b(2) — Thumbnail de cabeza estilo Premiere. Verificado CDP 7/7 + build + deploy
- [x] El fill del clip ya NO estira el thumbnail (quedaba borroso); en su lugar un **cuadro `.cthumb` 16:9 en la cabeza del clip** (bajo la banda de título) que **se desliza con el scroll** (`positionThumbs()`, clampeado dentro del clip — patrón RAF como las waveforms; hook en el scroll de #tlscroll y al final de renderTimeline) para saber siempre qué clip estás usando aunque avances por un clip largo. **Oculto en modo automatización** (`body.automode .cthumb{display:none}` — el cuerpo del clip es el lienzo de la envolvente) y en pistas colapsadas; no se crea en clips más angostos que el thumb+24px ni en audio.

## ROUND 94b — Refinado de la UI de automatización (feedback directo del user con capturas). Verificado CDP 14/14 + build + deploy
- [x] **Choosers del header**: sin swatch de color; dropdown izquierdo = **Transform · Effects · <cada FX reactivo cargado en la pista>** (grupos: `XFORM_P`=TF+TF_FLAT dedupe; Effects=FX; claves fxt: como antes); derecho = parámetros del grupo/efecto elegido. Aplica al header de pista Y a los sub-carriles.
- [x] **Botones A (override) y ↻ (re-enable) ELIMINADOS de los headers** de automatización (el override sigue operable desde el inspector: manualEdit/reEn/reEnAll intactos). El "+" se conserva.
- [x] **Punto+% del playhead en las curvas ELIMINADO** (no se actualizaba durante el play — bloque de drawAutoCurve quitado).
- [x] **kfstrip vivo**: `updKfStrip(c)` reconstruye los rombos de keyframes del clip en cada `commit()` del editor de curvas (antes quedaban desactualizados hasta el siguiente renderTimeline al mover/añadir/borrar puntos).
- [x] **Instrucciones fuera**: hint del viewport 2D (elemento+CSS+applyLang), `#autoLegend` del transporte (revirtiendo U-05; la gramática vive en tooltips de hover 1s — cv.title en puntos, titles de choosers), y el flash instructivo de toggleCurves. `body.automode` se conserva (banda de agarre U-09).

## ROUND 94-UT2..UT5 — Las 4 tandas restantes de AUDITORIA-UX.md EJECUTADAS (agentes + verificación CDP propia por tanda; build+deploy final único)
- [x] **UT2 Timeline/automatización**: `ensureClipVisible()` (seleccionar clip oculto tras el módulo de audio scrollea a revelarlo, 3 gestos) + clamp 55% del módulo + sombra `.covers`; leyenda persistente `#autoLegend` junto al botón Automation (body.automode, oculta <1500px); tooltip en puntos de curva vía cv.title; choosers con title dinámico + flex 0.8/1.2; botón A estado `.ovr` ámbar (override); banda de título = zona de agarre visible en automode (cursor grab + inset); empty-state del timeline vacío; flash aviso en split por Ctrl+E. Verificado CDP 8/8. (Incidente: un perl del agente corrompió 4 lookups — detectado por node --check y reparado; desde UT3 prohibido sed/perl en los encargos.)
- [x] **UT3 Export/feedback**: cola de export PERSISTENTE (`_exJobs` registro de módulo; el DOM es vista — reabrir el modal reconstruye filas con progreso y cancelar vivos); ✕ cancelar en la barra de estado (#statXBtn, misma rutina que .jx); de paso arreglado: cancelar un job ENCOLADO ya no cancela el activo; `flashStatus(msg,'err')` ámbar 6s aplicado a ~15 call sites de error; Compose/Adjust con `.dis`+title explicativo cuando no hay media visual (updEnable + renderMedia); badge contador de jobs en #exportBtn. Verificado CDP 9/9.
- [x] **UT4 Consolidación**: 7 segmented + .togbtn2 agrupados a un canónico CSS (sin tocar HTML); selects nativos (Export/Prefs/NewSeq/Room/inspector) con look .aselect + chevron; tamaños fraccionales eliminados (50 reemplazos: 7.5/8/8.5→9, 9.5→10, 10.5→11); .ibtn 18→22 y .seqx área 19×21 (hit targets); .dsp-tip multilinea; .iosw.on track claro/knob oscuro; Done→Close; .mono→.tnum (43 refs); "2D Master"→"Dome Master" y "3D Dome"→"3D Preview" (dinámico por seqMode, aplicado también en updModeUI/applyLang/paleta — de paso arreglado que applyLang pisaba '3D Room'). Captura verificada sin regresiones.
- [x] **UT5 Teclado/a11y**: menús contextuales ARIA (role=menu/menuitem, foco al abrir, ↑↓ circular, Home/End, Escape cierra — antes NO cerraba) con stopPropagation al handler global; clips y lanehdr con tabindex=0 + aria-label + Enter/Space seleccionan (delegado en #tracks, condicionado a `:focus-visible` para NO robar Space=play tras un clic); `[tabindex]:focus-visible` con anillo; prefers-reduced-motion como default si no hay preferencia guardada; `setDis()` sincroniza .dis+aria-disabled + `button:disabled` global; `textOn()` reescrita por ratio WCAG real. Verificado CDP 11/11.
- **Estado del informe:** U-31 (retícula 4px) DIFERIDO deliberadamente (requiere revisión visual humana); U-01 indicador "▾ V1" simplificado a sombra+autoscroll; resto de U-T1..U-T5 ejecutado. Detector impeccable: 23 anti-patrones restantes (los estructurales: single-font/tiny-text son decisiones de pro-tool documentadas).

## ROUND 94-UT1 — Fundación + quick wins (11 ítems de AUDITORIA-UX.md). Verificado CDP + detector + build + deploy
- [x] **U-04 tokens CSS**: `:root{}` con 12 variables (--bg-0/1/2, --surface/-2/-3, --ink/-2/-3, --ink-faint #8A9199, --line, --danger); ~120 usos convertidos a var() en la CSS de index.html; casi-duplicados #C7CDD4/#C5CAD0/#C2C7CE colapsados a --ink-2.
- [x] **U-03 contraste WCAG**: .insEmpty/.drop/.vslab .k/.prow .kf/.nav/.meters, #fmtChip, .tcbox .du, .countbadge, .lanehdr .tag/.ms, .abt → --ink-faint (4.7:1+); .hint → #9EA5AD/11px; .dvlab "AUDIO" 7.5→9px; landing empty → #8A9199. El detector `npx impeccable detect` ya NO reporta low-contrast (24→23 anti-patrones).
- [x] **U-13** estimado de export con `fmtBytes()` → "6.04 GB" (verificado en vivo) + ámbar #E5B567 cuando ⚠ large. **U-14** ítems danger del menú → var(--danger) #D98A8A. **U-36** scrollbar 0.14/hover 0.22. **U-34** .clip .tt color por defecto accesible. **U-35** .searchbox estaba VIVA (wrapper de #mediaSearch) — no se tocó.
- [x] **U-07 Undo/Redo visibles** (#undoBtn/#redoBtn en .top, icono redo existente, i18n EN/ES) — probados en vivo (click deshace/rehace). **U-08 botón "?"** → abre la paleta de comandos (probado). **U-23** Escape ahora cierra modales vía su botón real (#exClose/#prefClose → cleanup de fmtChip; probado). **U-11** Project FPS propaga a activeSeq().fps + markDirty + updFmtChip.
- Pendiente anotado: .folderdrop/.fdel y label "RECENT" del landing conservan grises viejos (tanda futura). Implementación por agente + verificación CDP propia (undo/redo/help/Escape/GB) + captura visual sin regresiones.

## ROUND 94 — AUDITORÍA UX/UI TRIPLE (user: "mejorar el UX/UI hasta impecable"). SIN cambios de código
Skills instaladas en `.claude/skills/`: **impeccable** (pbakaus, 23 comandos + detector determinístico) + suite de auditoría UX de mastepanoski (nielsen-heuristics-audit, don-norman-principles-audit, cognitive-walkthrough, ui-design-review, ux-audit-rethink, wcag-accessibility-audit). Auditoría con 3 métodos (2 agentes + detector CLI) sobre 6 capturas reales vía CDP + index.html + app.js. **Informe completo en `AUDITORIA-UX.md`** (fuente de verdad: 46 hallazgos U-01..U-46 deduplicados + plan en 5 tandas U-T1..U-T5 pendiente de aprobación). Patrones raíz: cero tokens CSS, rampa de grises bajo WCAG, flashStatus como canal único de feedback, modelo Premiere+Ableton sin puente.

## ROUND 93 — Automatización UNIFICADA estilo Ableton (user: choosers en el header de PISTA, un solo botón, gestos de puntos, atajos contextuales). Verificado CDP dev (t1–t5 todo verde)
- [x] **UN solo botón "Automation"** (`#curvesBtn`): fusiona el viejo "Audio React" — los FX reactivos viven en la MISMA vista. `#arBtn`/`state.arCurves`/`appendArAutoLanes`/`toggleArCurves` eliminados.
- [x] **Choosers en el rectángulo de la PISTA** (como Ableton "Mixer / Speaker On"): con Automation activo, cada header de pista de vídeo lleva `.autoctl` = swatch + **2 dropdowns (Device: Clip|FX-del-track · Parameter)** + ↻/A/+. Controlan el param primario del TRACK (`lane._autoP`), dibujado como overlay en TODOS sus clips. El chip sobre el clip (`autochip`) se ELIMINÓ.
- [x] **Claves de efecto por TIPO** `fxt:<type>:<param>` a nivel de pista, resueltas POR CLIP a `fx:<id>:<param>` (`laneKey`); un clip sin ese FX no dibuja nada (y se comporta como fondo). `paramDef` resuelve `fxt:` sin clip (rangos/labels de FXBY). Migración automática `c._arAuto` → `lane._auto` con fxt-keys (`migrateArAuto`, idempotente en renderTimeline).
- [x] **Sub-lanes** (`lane._auto`): cada header lleva el MISMO par de dropdowns (`autoDuo`) + ↻/A/+/✕/resize. **+ añade carril directo** (primero animado-no-visible, luego el siguiente sin mostrar; incluye params de FX del track) — ya no abre menú.
- [x] **Gestos de puntos**: clic en línea AÑADE (ya existía) · **clic directo sobre un punto lo ELIMINA** (Shift+clic = seleccionar/extender; Alt+clic sigue borrando) · arrastre mueve (con selección/snap/swallow) · **clic derecho sobre un punto abre el editor numérico** (tiempo+valor, Enter aplica) · clic derecho en línea = menú (easing sobre el segmento/selección, shapes, copy/paste, simplify, clear).
- [x] **Selección exclusiva pista↔clip**: clic en header de pista deselecciona el clip; seleccionar un clip (timeline/visor/canvas de curva/menu contextual) llama `laneDesel()`. **Ctrl+T** crea pista del TIPO de la seleccionada (audio→audio, si no vídeo). **Ctrl+D**: clip seleccionado → duplica clip; si no, pista seleccionada → duplica pista (vídeo o audio).
- [x] Limpieza: `_arAuto/_arAutoH` fuera de sepAuto/copy-paste-attributes; al borrar un FX se purgan las lanes fxt cuyo TYPE ya no existe en la pista; `serProject` persiste `lane._autoP/_auto/_autoH` (lanes van enteras).
- Verificado CDP: header con 2 selects (Clip/RGB Split) · overlay etiqueta "RGB Split · Intensity" · eval curva fx = 45 ✓ · migración legacy ✓ · clic borra punto ✓ · clic línea añade ✓ · clic-derecho editor + tipear 42 ✓ · menú easing en línea ✓ · drag mueve ✓ · undo restaura ✓ · exclusividad ambas direcciones ✓ · Ctrl+T audio/vídeo ✓ · Ctrl+D clip/pista/pista-audio ✓.
- [x] **R93c — Rueda del ratón INDEPENDIENTE por zona** (user: "son lugares independientes"): rueda sobre vídeo scrollea SOLO el vídeo (nativo, audio pinneado quieto); rueda sobre el módulo de audio (pistas O headers) scrollea SOLO dentro del módulo (nunca encadena al vídeo, ni siquiera sin overflow); **Alt+rueda = zoom vertical de las pistas de ESA zona solamente** (`wheelResizeLanes(e,inAudio)` — antes redimensionaba TODAS); Ctrl=zoom timeline y Shift=horizontal sin cambios; `audioZoneScrollBy` sincroniza header+scroll persistido de forma síncrona (el evento scroll async retrasaba la columna un frame). Verificado CDP 13/13 (cada zona scrollea/redimensiona sin tocar la otra, en pistas y en headers).
- [x] **R93c(2)** — Quitado el botón ⚡ "Generate proxies" de la barra del panel de medios (user) — los proxys se generan por clic-derecho sobre el medio (con multi-selección), como documenta CLAUDE.md.
- [x] **R93b — Módulo de audio de altura FIJA con scroll interno** (user: pistas de audio nuevas hacia ABAJO, el recuadro no crece): `state.tl.audioH` (persistido en `tl`, se inicializa al contenido en el primer render) fija la altura del `.audiozone`; el contenido extra scrollea DENTRO (overflow-y, scrollbar oculta, rueda del ratón, `overscroll-behavior:contain`); ambas columnas sincronizadas (`scroll` ↔ `onscroll`), scroll persistido entre re-renders (`tl._audioScroll`); el divisor "AUDIO" (sticky top dentro del módulo) ahora redimensiona el MÓDULO, no las pistas (cada pista conserva su asa propia); `addLane('audio')` INSERTA en el fondo del módulo (índice mínimo del grupo audio + remap de `c.lane`/`selLane`) y auto-scrollea para revelarla; `duplicateLane` de audio inserta la copia DEBAJO de la original (vídeo sigue arriba — convención Premiere). Verificado CDP 14/14: módulo mantiene 91px con +3 pistas, nuevas al fondo, scrolleado al fondo, headers sincronizados, clips remapeados OK, duplicado debajo, divisor agranda módulo sin tocar lane.h, scroll persiste tras re-render, audioH serializado.

## ROUND 92 — AUDITORÍA COMPLETA (user: optimizar, automatización, conexiones rotas, audio 1h, UX). SIN cambios de código
5 agentes de código + 7 baterías de pruebas en vivo (CDP) con assets reales de RITO DIGITAL (película 64min/12GB, WAV 967MB). **Informe completo en `AUDITORIA-R92.md`** (fuente de verdad de esta ronda; plan de arreglos en 5 tandas al final). Titulares: 🔴 vídeos SIEMPRE muted (sin pipeline de audio de MP4); 🔴 loadProject no limpia undo (clips fantasma entre proyectos); 🔴 switchSeq aniquila el undo (la raíz de las "conexiones rotas" al mezclar nest+fx+recorte); 🔴 nestSelection siempre modo dome; 🔴 reactive pierde srcClipId al anidar; 🔴 ventana tapada = 1fps real pese a backgroundThrottling:false (riesgo NDI, medido). Medido: WAV 1h = +1,7GB RAM; renderTimeline 100ms@300 clips; seek película 1h = 13-46ms (excelente); playback compose+fx = 57fps; keyframes core sólido (razor/move/dup verificados sin aliasing). Trim-in NO borra kfs (desmentido al agente) pero no los rebasa (se deslizan del contenido). **Addendum (user):** §4a del informe REVISADO contra Ableton Live 12 (manual + código): mucha paridad ya existe (Alt-drag curva segmento, marquee, simplify, re-enable, ◆); gaps reales priorizados = lanes a nivel de PISTA persistentes (hoy solo bajo el clip seleccionado), draw mode (B), insert shapes sobre time-selection, stretch/skew de selección.

## ROUND 92-T9 — Módulo de audio FIJO abajo estilo Premiere (user: 4v+1a por defecto, audio siempre presente, redimensionable, vídeo scrollea por detrás). Verificado CDP dev + .exe + captura
- [x] **Default 4 vídeo + 1 audio** (`state.lanes` inicial + `defLanes()`).
- [x] **La pista de audio siempre existe**: `removeLane` bloquea borrar la última pista de audio (y la última de vídeo). Aviso al usuario.
- [x] **Módulo de audio FIJO abajo, vídeo pasa por detrás** (Premiere): audio en `#audioZone` (sticky bottom, hijo de `#tracks` → `#tracks .lane` lo sigue encontrando: hit-testing/waves/marquee intactos) y sus headers en `#audioHeadZone` (sticky bottom). La columna de headers pasó de `transform` a **scroll nativo sincronizado** (`#trackHdr.scrollTop=#tlscroll.scrollTop`) para que el sticky del audio pinne idéntico en ambas columnas. `.rulerpad` sticky top.
- [x] **Redimensionable**: el divisor (doble línea "AUDIO") es el asa — `bindDividerResize` arrastra para crecer/achicar todas las pistas de audio a la vez (persistido en `lane.h`).
- [x] Alineación de columnas: compensado el alto de la barra de scroll horizontal de `#tracks` (`#audioHeadZone.bottom = offsetHeight-clientHeight`) — el audio de ambas columnas queda a la misma Y exacta.
- [x] Robustez: `showMoveGhosts` (ghost al `offsetParent` real) y marquee (`getBoundingClientRect` en vez de `offsetTop`) arreglados para el anidado en `#audioZone` posicionado.
- Verificado CDP: default 4v+1a; audio en su módulo con divisor redimensionable (creció 82→146); scroll con 8+ pistas → audio PINNED abajo, vídeo scrollea por detrás, headers sincronizados (scrollTop 200/250), columnas alineadas exactas; guard última-audio bloquea; guardar/reabrir preserva; play/hit-test/marquee OK. Captura confirma el layout. En el .exe: idéntico.
- [x] **Revisión de diligencia (user: "algo que falte"):** hueco encontrado y arreglado — un proyecto SIN pista de audio (viejo, pre-T9) abría sin el módulo. `loadSeqIntoState` ahora inyecta una pista de audio a las secuencias reales SIN audio (excluye composiciones `m.comp` → siguen solo-vídeo; idempotente, sin markDirty). Verificado: proyecto viejo sin audio → módulo aparece; composición entra/sale solo-vídeo y no se le cuela audio en guardar/reabrir; modo SALA 360 crea con módulo de audio sin crash; rueda sobre la columna de headers scrollea sincronizada sin doble. (Nota: el `//` inicial se comió la línea de loadSeqIntoState → `node --check` lo cazó antes de compilar; corregido con `/* */`.)

## ROUND 92-T8 — Layout Premiere: audio agrupado abajo en contenedor independiente (user). Verificado CDP dev + .exe
Investigado el modelo de Premiere (vídeo arriba, audio abajo, doble línea divisoria, cada tipo agrupado). Implementado como **agrupación SOLO de display** — `state.lanes` y los índices `c.lane` de los clips quedan INTACTOS (compositing de vídeo, guardado y undo sin cambios; verificado round-trip idéntico byte a byte del array).
- [x] `lanesTopDown()` reescrito: `[...vídeo (orden previo), ...audio (orden previo)]` — todo el vídeo arriba, todo el audio abajo, sin tocar el array.
- [x] Divisor estilo Premiere (`.trackdivider`, doble línea + etiqueta "AUDIO") insertado en el render en la transición vídeo→audio, en AMBAS columnas (tracks + laneHeaders) para que queden alineadas. No lleva `data-lane` → invisible al hit-testing (`lanesBetweenY`/drag usan `.lane[data-lane]`).
- [x] Arrastre de pistas acotado a su grupo: una pista de vídeo no cruza el divisor a la zona de audio ni viceversa (clamp de `dropDisp` al rango del grupo). La reconstrucción `reverse(cur)` sigue siendo válida porque el orden agrupado es "todo-audio-luego-todo-vídeo" tras invertir (verificado matemáticamente: V3→tope reordena bien y sigue agrupado).
- Verificado CDP: array interleaved a propósito (video,video,video,video,audio,video,audio) → display agrupado (5 vídeo, 2 audio) con clips en su pista correcta; divisor en ambas columnas; Y monótona sin solapes; clamp vídeo/audio a pos 5; round-trip guardar/reabrir idéntico + divisor reaparece; play/undo OK. En el .exe: agrupado + divisor "Audio".

## ROUND 92-T7 — Remate de detalles (user: "ajusta cualquier detalle que te quede"). Verificado CDP en dev + .exe
- [x] **BUG propio de T6 corregido:** `aelProbeSilent` usaba `a.currentTime<0.35` como delay de sondeo, pero currentTime es la posición DENTRO del archivo → un clip de la película que arranca a min 30 tenía currentTime≈1801 en el frame 1, saltaba el guard, y si el audio aún no decodificaba se marcaba MUDO por error (silenciando un clip CON audio). Fix: medir tiempo REAL reproducido vía `a.played` (suma de rangos); sonda a los 0,5s reales. Test determinista (fake `<audio>`) 4/4: mid-film reciente=no-flag, mudo real=flag, con-bytes=no-flag, pausado=no-flag — en dev y en el .exe.
- [x] **Loop inverso (ping-pong) silencia el preview:** el vídeo va hacia atrás pero el audio no puede → `revMute=(c.loop&&c.loopRev)` pausa el ael en vez de tartamudear (limitación documentada; el vídeo sigue en ping-pong). No-regresión: audio normal (WAV) sigue sonando (1 fuente activa, liberada al pausar).
- Instalador regenerado en `dist\` (firmado). Deploy a canónica + legacy local; Program Files sigue pendiente de UAC.

## ROUND 92-T6 — PRUEBAS PRO E2E con assets reales + revisión adversarial → 8 mejoras (user: "testealo como editor profesional"). Verificado CDP
Sesión E2E real: 12 clips en 4 pistas + WAV máster 1h + compose ring 6 miembros + automatización; guardar→reabrir (round-trip 100%: kf, lane._auto, fx, inlineCurves); tormentas de scrub (6,6ms/seek) y undo (30 ops+60 undos = restauración exacta); playback medido por zonas.
- [x] **🔥 Zona de compose: 6fps → 60fps.** Diagnóstico por descarte (GL composite=0,1ms; sin audio-elements=57fps): los `<audio>` de preview demuxaban 6 originales de 67Mbps SIN pista de audio. Fix: `aelProbeSilent` — a los 0,35s de reproducción con 0 bytes de audio decodificados, `m._noAudio=true` y se destruye el pipeline para toda la sesión (se resetea al relink/replace). Verificado: warmup 40fps, estable 60fps, 3 medias auto-marcadas.
- [x] **Proxies PERSISTENTES entre sesiones**: `reloadMedia` re-vincula proxies existentes en disco (candidatos por hash path|size — estable tras reopen, verificado 5/5 re-bound). Generarlos sigue siendo manual.
- [x] **Rate compuesto a través de nests**: `collectDrawnVideoClips` lleva `rate` (producto de speeds de la cadena) → vel+ael reproducen a la velocidad EFECTIVA dentro de nests acelerados (antes: rate del clip interno + seek-corrección cada 200ms = judder).
- [x] **Servo A/V**: micro-ajuste de playbackRate (±6% vídeo, ±8% audio, proporcional a la deriva) en vez de seeks duros; deriva inicial 150-236ms → ±21-96ms y convergiendo (medido).
- [x] **ael con render-ahead**: el mantenimiento de los audio-elements corre CADA frame (antes vivía dentro de `if(!raHas())` → audio huérfano con RA activo); el pump de vídeo sigue condicionado a !ra.
- [x] **vinstAudio por URL** (antes cacheaba null para siempre si srcUrl no había cargado, y tras Replace/Locate seguía sonando el archivo VIEJO) + `preservesPitch=false` (igual que el export, que resamplea).
- [x] **exportAudioMix: span en segundos de SALIDA** (len es segundos-fuente → con speed≠1 el fadeOut caía en el tiempo equivocado, divergiendo del preview) + fades proporcionales si fadeIn+fadeOut>dur (como fadeFactor) + envolvente de startAudio anclada a `max(base,ctxStart)` (clip empezado antes del playhead con contexto fresco → tiempos negativos).
- Limitaciones conocidas anotadas en AUDITORIA-R92.md: audio no sigue loopRev (ping-pong), volumen >100% clampeado en preview (el export sí lo aplica), cap de 4000 ciclos de nest loop.
- Nota: el workflow de revisión adversarial (42 agentes) tocó el límite de sesión a mitad de verificación — los 12 hallazgos crudos de los 2 finders completados se verificaron a mano contra el código; 8 aplicados, 3 documentados, 1 descartado (setValueAtTime negativo no lanza en Chromium — igualmente blindado).

## ROUND 92-T2/T3/T4/T5 — TANDAS 2-5 de la auditoría (user: "sigue con las siguientes y no pares"). Verificado CDP por tanda, todo verde
**T2 AUDIO:** 🔴C1 los VÍDEOS ya SUENAN — preview: `<audio>` por clip vinculado al ORIGINAL (los proxys no llevan audio), ganancia por frame = volumen×fades×mute componiendo la cadena de nests (`collectDrawnVideoClips` ahora lleva `gain`); export: `decodeAudioData` del MP4 (verificado: Chromium demuxa MP4/AAC) → `m._exAudio` entra a la mezcla (cap 1,5GB por archivo, aviso si se omite; liberado en el finally). `collectAudioEvents` REESCRITO con mapeo local→top (`S`): speed del nest escala rate/posiciones, LOOP del nest repite el pase interno por ciclo (cap 4000), volumen/fades del padre componen (aprox. una rampa); F13 fadeOut=0 si la ventana corta la cola; curvas export=exponencial como preview. F5 `reschedAudio()` en onTLUp/razor/split/delete/ripple/nudge/dup/paste/mute/solo/speed/loop/disable/undo. Verificado: nest 2x → start 105/dur 20/rate 2/vol .5; loop → eventos [0,20,40]; fades padre fi4/fo6; ganancia fade en vivo 0.55=esperado; delete en vivo re-agenda.
**T3 FLUIDEZ/MEMORIA:** F3 camino LIGERO en trims (`positionClips` reposiciona nodos: 1ms vs 26ms full = 26×); F2 la papelera SUELTA lo pesado (el/tex/buffer) si hay path y el undo `reloadMedia` del disco (verificado round-trip); F14 motionTick 30fps + parked con document.hidden; armMediaBands ya NO corre en cada import (solo bajo demanda del panel Reactive); upTex usa texSubImage2D si mismo tamaño; antialias:false en el contexto GL. C7: flag `disable-features=CalculateNativeWinOcclusion` en main.js (3D verificado VIVO — no rompe la GPU híbrida); rAF minimizado sigue a 1/s (compositor) pero **NDI bombea por setInterval a 63 ticks/s minimizado (medido)** → la salida al domo sobrevive.
**T4 AUTOMATIZACIÓN (benchmark Ableton):** lanes a nivel de PISTA (`lane._auto`/`lane._autoH`, persisten en el .isp y en undo): visibles sin selección, un canvas por (pista,parámetro) dibuja TODOS los clips, gestos resuelven el clip bajo el puntero; picker "+" agrupado (animados 1º con ◆ coloreado); DRAW MODE (tecla D — B es la cuchilla): pinta pasos cuantizados a grilla (hold), Alt=a mano alzada; INSERT SHAPES en clic-derecho (seno/triángulo/cuadrada/rampas, escaladas a la time-selection o al paso de grilla); arrastrar un punto sobre un vecino lo ABSORBE (adiós puntos duplicados en el mismo frame); atajo A = vista de automatización; PCOLOR con hue fijo por parámetro (transform cálidos/óptica fríos/color magentas; fx = hsl por clave); kfstrip PASIVO atenuado en clips no seleccionados; `state.inlineCurves` persiste en el .isp. F6 inP escala por speed en trim-L y razor (verificado inP=4 con 2s×2x); F7 keyframe de FRONTERA con el valor de la curva al recortar (verificado t0 v50); F11 wetKf rebasa en trim y razor.
**T5 UX:** búsqueda del panel Media (input + Ctrl+F + ✕; el filtro `state.mediaQuery` existía sin UI — verificado filtra); export con botón ✕ CANCELAR por job + progreso en status bar + `win.setProgressBar` (taskbar, IPC dsp:setProgress); atajos S=snap, +/−=zoom (documentados que no existían); `fmtKey()` = glifos ⌘/⇧ → Ctrl+/Shift+ en Windows (menús y paleta); botón ⚡ Generate proxy visible en el panel Media; hint contextual del viewport restaurado (`#hint`); contraste de status/unidades/selmeta subido a ~#8A9199; "Export · Ctrl+Shift+E" corregido en el HTML; nombre por defecto sin hardcode español.

## ROUND 92-T1 — TANDA 1 de la auditoría: cimientos de undo/estado (user: "dale con los ajustes"). Verificado CDP, todo verde
- [x] **Undo POR SECUENCIA** (`_undoBySeq` map, caps globales 80 snapshots/250MB con evicción del stack más pesado): switchSeq/closeSeqTab/nueva secuencia YA NO vacían el historial (raíz de las "conexiones rotas" nest+fx+recorte); exportar muro/piso tampoco (usaba switchSeq). deleteSequenceMedia → `clearAllUndo()` (otras secuencias podían referenciar el media borrado).
- [x] **C2:** `loadProject` limpia el historial (`clearAllUndo`) — Ctrl+Z tras abrir proyecto B inyectaba clips fantasma de A. newProject/newRoomProject migrados al helper.
- [x] **B13+B12:** `restore()` hace `saveActiveSeq()` (re-cura el alias state.clips⇄nestClips: seqDur/seqReaches ya no leen rancio tras undo) + `markDirty()` (deshacer = cambio sin guardar).
- [x] **C4:** `nestSelection` pasa `isFlat()?'flat':'dome'` a `newSeqMedia` y `fulldome=!isFlat()` — anidar en 2D/sala ya no deforma con warp de domo.
- [x] **C5:** `nestSelection` remapea `state.reactive.srcClipId` al id nuevo dentro del nest + `reactiveSourceClip()` resuelve también dentro de nestClips/otras secuencias — los FX audio-reactivos ya no mueren al anidar (timing exacto con nest en t=0).
- [x] **F8:** `pasteClip` con guard anti-ciclo (pegar un nest dentro de sí mismo se guardaba en el .isp), clamp/creación de lane por tipo (clip en lane inexistente = invisible; audio sonaba sin verse) y guard de media inexistente.
- [x] **C6:** `deleteMedia` avisa con appConfirm cuando el media se usa en otras secuencias (lista los nombres; el undo solo restaura la activa).
- Verificación CDP (dev): 18 asserts — undo sobrevive switch ida/vuelta y deshace nestSelection/razor por secuencia; alias curado sin cambiar pestaña; ciclo/lane/media bloqueados en paste; nest flat=flat+fulldome false; reactive remapeado y resoluble; loadProject deja undo vacío; diálogo C6 con nombres y Cancelar intacto. `node --check` OK.
- [x] `openMenu` acepta ítems `{swatches:{cur,onPick,onClear}}` → fila de muestras de color INCRUSTADA en el menú contextual (paleta LANE_PALETTE + chip ✕ "sin color"). El menú de carpetas (árbol y cuadrícula) muestra los colores directamente — sin el paso intermedio "Color de carpeta…" (ítem eliminado, `openFolderColorPopup` borrado como código muerto). Verificado CDP: menú con 10 muestras inline, clic aplica color y cierra, ✕ lo quita, 0 errores GL.

## ROUND 91 (P0+P1) — MODO 360 "salas inmersivas" · rebrand a Immersive Studio Editor + fundaciones (user, plan aprobado). Deploy A+B 3153804
Plan completo aprobado: modo `room` = muros "desenrollados" en una tira flat continua (reusa TODO el pipeline flat), + visor 3D de sala (fase 4), + snap a muros/resize por esquinas (fase 3), + seamless wrap (fase 2), + export por muro (fase 5). Piso = SECUENCIA APARTE (pestaña propia) vinculada por `room.floorSeqId`. Dos ordenamientos: número = orden en tira 2D; rol (front/left/right/back) = ensamblado 3D. Salas 90°, 2/3/4 muros + piso opcional configurables al crear. Todo detrás de `seqMode==='room'` → domo/flat intactos.
- [x] **P0 rebrand + plomería inerte:** nombre visible → "Immersive Studio Editor" (landing, `DSP.setTitle`, visor 3D; NDI/appId/instalación SIN cambiar para no crear tercera copia). `projTitle` prefijo por modo (Domo/2D/Sala 360). `isFlat()` ahora incluye `room` (compositing rectangular); `isRoom()`/`flatLikeMode()` nuevos; los 3 chequeos directos `mode==='flat'` (nest draw / autoBitrate / fmtChip) usan `flatLikeMode`. `serMedia` serializa `room`+`roomFloorOf`. Domo/flat sin cambios (verificado).
- [x] **P1 setup + creación:** `roomSetupDialog` (segmentado 2/3/4 muros + checkbox Piso; por muro: rol, orden 2D, ancho/alto cm, píxeles; fila de piso ancho/profundidad/px; valida roles únicos). `newRoomProject(cfg)` construye: tira de muros ordenada por número, `stripH=max(pxH)`, `ppc=stripH/max(hcm)` (px/cm uniforme→seamless), `x0/x1` por muro, secuencia `'room'` con `.room={walls,workPxPerCm,floorSeqId,floor}`; si hay piso, secuencia `'flat'` "Piso" con `roomFloorOf`. Ambas abiertas en pestañas, activa = Muros. Botón landing "Nueva sala 360".
- [x] Verificado CDP: brand en landing + botón; sala 4 muros+piso → 2 secuencias; tira 6480×1080 (ppc 3.6: 1800+1440+1800+1440); muros ordenados Front[0,1800] Right[1800,3240] Back[3240,5040] Left[5040,6480]; piso vinculado 1920×1080 flat; `seqMode='room'`, `isFlat()=true`, 2 pestañas; serialización round-trip (4 muros+floorSeqId); chip "Room · 6480×1080 · 60p"; render ok; **no-regresión domo (3D visible) y flat (chip normal)**; 0 errores GL.
- [ ] Pendiente (siguientes fases): F3 snap a muros + resize por esquinas (scaleX/scaleY) · F4 visor 3D de sala (orbit + stand 1.7m, muestrea tira+piso sincronizados) · F5 export completa/por-muro (+ piso aparte).

## ROUND 91b (ajuste modelo + Fase 2) — tira POR PÍXELES + grilla de muros + seamless wrap (user). Deploy A+B 3156533
**Cambio de modelo (user):** los 90° dejan de forzarse. La forma real de la sala la determinan las dimensiones (cm) y **solo se ve en el visor 3D** (fase 4), donde los píxeles de cada muro se estiran/encogen a su quad real y el piso se deforma a la planta. En el **visor flat todo es EXACTO POR PIXELAJE, no por tamaño físico**.
- [x] **`newRoomProject` re-modelado:** la tira se arma por píxeles nativos — `x0/x1` de cada muro = ancho `pxW` concatenado (antes `wcm*ppc`). `stripW=Σ pxW`, `stripH=max(pxH)`. Eliminado `workPxPerCm` de `room` (los cm `wcm/hcm` quedan como metadatos SOLO-geometría para el 3D). Muros más bajos que la tira ocupan su `pxH` desde arriba; el resto es zona muerta (no pertenece a ningún muro).
- [x] **F2 grilla de muros (`drawRoomGrid2D`)**, llamada desde `drawGrid2D` solo si `isRoom()`: costuras verticales entre muros en los bordes `x0`; etiqueta de rol sutil (FRONT/RIGHT/BACK/LEFT) abajo-izquierda de cada muro con fondo semitransparente; zona muerta bajo muros cortos atenuada (rgba negro + borde punteado). Todo por píxeles exactos. El piso (secuencia flat aparte) NO lleva grilla.
- [x] **F2 seamless wrap (`_roomWrap`):** flag nuevo activo solo al componer la tira de muros (reset a false dentro de nests, y `render()`/export lo fijan a `isRoom()`). En `drawClipFlat`, si el clip cruza el borde L/R de la tira (`fc±(|fx|+|fy|) > Fx`) se dibuja una copia desplazada ±2·Fx (un ancho de tira) → el clip que sale por un borde reaparece por el opuesto. 3 draws máx por clip; el shader recorta lo que queda fuera del NDC.
- [x] Verificado CDP (`verify-p2.js`): sala 4 muros (uno corto pxH 960) → tira **6400×1080 = Σ pxW**, sin `workPxPerCm`, bounds contiguos por píxeles, piso flat 1600×900 vinculado. `drawRoomGrid2D` sin excepción, 0 GL. **Wrap definitivo por lectura de píxeles del `compFBO`:** clip centrado pequeño → bordes negros (sin copias espurias); clip desbordando la costura derecha → wrapOff borde izq **negro (L=0)**, wrapOn borde izq **iluminado (L=6170)**. No-regresión: flat (`_roomWrap=false`, 0 GL) y domo (0 GL) intactos.

## ROUND 91c (Fase 3) — resize por esquinas tipo Photoshop + snap a muros (user). Deploy A+B 3161964
- [x] **`scaleX`/`scaleY` per-eje en `flatPlace`** (default 1 → clips flat/domo existentes idénticos; multiplican `hw`/`hh`). Se serializan solos (viven en `c.props`). El resize uniforme cambia `scale`; el resize por borde cambia `scaleX` o `scaleY`.
- [x] **Handles de resize** (`drawFlatHandles`, cacheados en `_flatHandles`): 4 esquinas + 4 puntos medios de borde para el clip 2D/sala seleccionado, dibujados SIEMPRE (independiente del toggle Outline). Cursor de hover por handle (nwse/nesw/ew/ns).
- [x] **`beginFlatResize` + modo `resizeFlat`** con **anclaje en la esquina/borde opuesto** (se queda fijo en el espacio del frame): proyecta el cursor sobre los ejes locales (u,v con rotación), recalcula medias-extensiones y el centro, y escribe `scale`/`scaleX`/`scaleY` + `x`/`y`. Esquina = uniforme (Shift = libre por-eje); borde = un solo eje. Clamp anti-flip.
- [x] **Snap a muros** (solo `room`): `roomSeamX` (costuras x0/x1 + bordes de tira) y `roomSeamY` (fondos pxH de muros cortos + bordes). Resize snapea el handle (`snapFrame`); mover snapea el borde MÁS CERCANO o el centro del clip (`snapMoveAxis`). Umbral por zoom; **Alt lo omite**.
- [x] Verificado CDP (`verify-p3.js` + regresión + screenshot): scaleX=2/scaleY=0.5 → ratios 2.0/0.5 exactos; resize por esquina → escala 100→115 con **esquina opuesta fija [0,0]**; borde → solo `scaleX` (1.127), `scaleY`/`scale` intactos; snap pega 0.21→0.20 (Alt y lejano no); **no-regresión** clic en cuerpo → mover (`elemFlat`, escala intacta) y orbit del domo OK; 0 GL en todo. Screenshot: grilla + etiquetas RIGHT/BACK/LEFT + zona muerta BACK + handles visibles.
- [x] F4/F5 completadas en ROUND 91d (ver abajo).

## ROUND 91d (esquema iso + F4 visor 3D + F5 export) — MODO 360 COMPLETO (user: "sigue con todas las fases hasta terminar" + esquema iso). Deploy A+B 3177949
**Ajuste de modelo confirmado (user):** los 90° NO se fuerzan — la forma la determinan las dimensiones (cm) y solo se ve en el 3D; en el flat todo es exacto por pixelaje. `roomPlan(walls)` = geometría de planta COMPARTIDA (metros) → `{seg:[{role,a,b,h}], poly, closed}`: 4 muros = trapecio (Front/Back paralelos y centrados, laterales se inclinan si los anchos difieren → esquinas no-90°; profundidad `D=√(avg²−off²)`); 3 muros = U (fondo abierto); 2 = esquina; fallback genérico.
- [x] **Esquema isométrico EN VIVO en el diálogo de sala** (`drawRoomIso` sobre `#rsIso`): piso (polígono punteado) + muros de pie coloreados por rol (`ROOM_ROLE_COL`) con etiqueta, proyección iso 2:1, orden far→near. Se redibuja en cada cambio (input en vivo, rol, nº muros, toggle piso). Verificado: 4/3/2 muros=4/3/2 seg; inclinación 1.0 si Front≠Back, 0 si iguales.
- [x] **F4 visor 3D de sala** (`renderRoom3D`, programa GL `PR`/`LR` de quads texturizados pos+uv+shade; VAO dinámico): `buildRoomGeo(seq)` normaliza+centra la planta, cada muro muestrea su sub-rect de la tira (`compTex` letterbox → uL=x0/stripW, vBot=vMax−(pxH/stripH)·Fy) estirado a su quad real; el piso muestrea la secuencia de piso compositada aparte (`compositeFloorTex`→`_roomFloorFBO`) deformada al polígono. Cámara `roomCameraMVP` reusa `state.view.cam`: **Orbit** (fuera) + **Viewer/stand** (ojo ~1.7m `standZ`, mirar con yaw/pitch, dolly rueda, FOV). `render()` bifurca `mode==='3d' && isRoom()`; `updModeUI` muestra el botón 3D "3D Room" en sala. Geo cacheada por `_roomGeoSeq`, NO serializada → se reconstruye al cargar. Verificado+screenshot: caja 3D 4 muros+piso, Back más angosto (trapecio), wallVerts=24/floorVerts=6, orbit≠stand, 0 GL, sin regresión.
- [x] **F5 export sala** (reusa el pipeline vía sub-rect UV): segmento **Tira completa | Por muro** + checkbox **Exportar piso**. `renderExportFrame(t,res,ss,wall)` recorta la sub-región del muro (top-aligned) y la reescala a su `pxW×pxH` nativo; `runExport` compone la tira a `qRes=max(stripW,stripH)` (1:1 por muro), nombra `wall_<rol>_…`; `opt.seqId` exporta el piso en job propio (switch+restore). Título consciente del modo. Verificado: recorte FRONT=negro/RIGHT=brillante (región correcta); "Por muro"+piso encola 3 jobs; save/load OK; 0 GL.
- **360-SALA COMPLETO** (P0→F5). Todo detrás de `seqMode==='room'`; domo/flat intactos, verificado por fase.

## ROUND 91e (7 arreglos de sala pedidos por Beltrán) — Deploy A+B 3182645
- [x] **Cursor de resize invertido:** `_resizeCursor` — la Y del frame va hacia arriba y la de pantalla hacia abajo, así que la diagonal estaba al revés; ahora `sx·sy>0 → nesw`, `<0 → nwse` (verificado nesw/nwse/ew).
- [x] **Snap a centros:** `roomSeamX`/`roomSeamY` añaden el centro del strip (0) y el **centro de cada muro** (h: `(x0+x1)/2`; v: `pxH/2` desde arriba) además de bordes/costuras.
- [x] **Motion set flat/sala** (`ANIM_PRESETS_FLAT` + `curAnimPresets()` por `isFlat()`): **Rotate**(rot) · **Pulse**(scale wave) · **Horizontal**(x lineal, en sala envuelve por `_roomWrap`) · **Vertical**(y lineal con `tile:true`). `clipVTile(c)` → en `drawClipFlat` la **duplicación vertical infinita**: repite el clip por su propia altura cubriendo el frame (kLo/kHi centrados en el viewport, cap 60 copias). Verificado: static 114 filas → tiled 2034.
- [x] **Pos X / Pos Y infinitos al número directo:** `UNBOUNDED_P={x,y}` — `editNumberBox` y la rueda del box no clampan (±1e6) para esos params; el fader mantiene su rango visual.
- [x] **Viewer 3D de sala mira al frente:** `roomStandDefaults()` (yaw=−π/2, pitch=0, fov=60, back=−0.5) al entrar en Viewer/spec en sala (verificado exacto).
- [x] **Grid en 3D con nombres de muro:** `drawRoomLabels3D(mvp)` proyecta (via `proj3`, sin flipx) la subdivisión + etiqueta de rol coloreada al overlay 2D; gate por el toggle Grid; `buildRoomGeo` ahora guarda `cx,cy,sc` en `_roomGeo.norm` para reproyectar. Screenshot: FRONT/RIGHT/BACK/LEFT coloreados centrados + grilla en cada muro.
- [x] **Grid = 3 filas × 4 columnas proporcional por muro** (`ROOM_GRID_ROWS=3`, `ROOM_GRID_COLS=4`): añadido a `drawRoomGrid2D` (2D, gate por Grid) y a `drawRoomLabels3D` (3D). Verificado 0 GL en todos, sin regresión domo/flat.

## ROUND 91f (5 arreglos de sala pedidos por Beltrán) — Deploy A+B 3193143
- [x] **Invertir arrastre en Viewer 3D de sala:** en el drag `orbit`, si `isRoom()&&three==='spec'` se invierte el signo de yaw/pitch (first-person). Verificado: spec +0.39 vs orbit −0.39.
- [x] **Mask to wall (multi-selección):** `c.props.maskWalls=[roles]` → en `drawClipFlat`, si `_roomWrap` y hay `maskWalls`, se dibuja con `gl.SCISSOR_TEST` recortado a los rects de esos muros (`roomWallScissorRects`, en px del FBO cuadrado). UI: chips por muro en el inspector (solo en sala). Verificado: máscara Front → solo Front visible, Right negro.
- [x] **Optimización 3D — muros translúcidos por fuera + toggle:** programa `PR` ahora lleva **normal interior por vértice** (`a_nrm`, stride 32) + `u_cam`; `renderRoom3D` hace 2 pasadas sobre la misma geometría: pasada interior opaca (depth write) y pasada exterior translúcida (`u_backA`, sin depth write) → desde fuera se ve DENTRO (el composite del clip se hace una sola vez). Botón **"Outside tex"** (`#roomOutBtn`, `state.view.roomOutTex`) pinta la textura translúcida también por fuera. `roomCameraMVP` devuelve `{mvp,eye}`. Verificado + screenshot (muros cercanos translúcidos, fondo opaco).
- [x] **Compose flat/360 sin opciones de domo:** `FLAT_COMP_KINDS=[grid,row,col,random]` + `compLayoutFlat` (x/y/scale %) + rama flat en `compElProps`; el diálogo en flat/sala muestra solo Count/Columns/Scale/Máscara/Randomize (oculta ring/spiral/domegrid/el/az-span/etc), preview con marco rectangular. `createComposition`/`regenComposeNest` usan layout flat, nest `mode=seqMode`, `nc.props.fulldome=false`. **Extensión infinita (sala):** checkbox `#cInfinite` → cada elemento lleva scroll horizontal (`param:'x'` lineal) que envuelve por `_roomWrap`. Verificado: nest mode 'room', fulldome false, elementos con x/y/scale.
- [x] **Motion preview reproduce el video:** `motionTick` ahora reproduce (loop, mute) + sube frames de los clips de video en pantalla (`collectDrawnVideoClips`+`pumpVFClip`/`upTex`) para que el 3D room muestre el contenido moviéndose Y reproduciéndose, no un frame congelado; `stopMotionPreview` pausa esos videos; `play()`/`ploop` fuerzan `loop=false` (el timeline gobierna el loop por-clip). Sin regresión.

## ROUND 91g (5 pedidos: proxys manuales, presets de sala, orden único, .ise, renombrar Rito Movie) — Deploy A+B 3196682
- [x] **Proxys MANUALES para todos los formatos:** quitados los 2 auto-`enqProxy` (import + reloadMedia). Menú contextual de media (`openMediaCtx`) → "**Generar proxy**" (o "Regenerar" si ya existe); si hay varios videos seleccionados con shift → "**Generar proxys (N)**" para toda la selección. Verificado: import ya no auto-encola; el ítem aparece.
- [x] **Presets de sala 360 con nombre** (localStorage `iseRoomPresets`, reutilizables entre proyectos): fila Preset en `roomSetupDialog` (select + Guardar + ✕). `getRoomPresets`/`saveRoomPresets`; guardar captura muros+piso+fps; cargar rellena todo el diálogo. Verificado: guarda (wcm 1234), la opción aparece, cargar restaura wcm 1234.
- [x] **Número de pantalla único (auto-swap):** el input `order` en el diálogo, al cambiar, clampa a 1..N y si otro muro tiene ese número **intercambia** (swap) y redibuja. Verificado: [1,2,3,4] → poner muro0=2 → [2,1,3,4] (único).
- [x] **Extensión `.ise`** (Immersive Studio Editor): guardar por defecto `.ise` (`saveProject`/`saveIncremental`/dlBlob), `currentTitle`/`addRecent` quitan `.ise|.rdome`, autosave base `unsaved.ise` (+ escaneo compat `.rdome`). `main.js`: `rdomeFromArgv` acepta `.ise|.rdome`, diálogos save/open filtran `['ise','rdome','json']`, default `proyecto.ise`. `package.json`: `fileAssociations` añade `ise` (mantiene `rdome` legacy). Abre ambas (es JSON). Verificado abriendo `Rito360.ise` renombrado (título/room/0 GL). NOTA: la asociación de doble-clic `.ise` la registra el instalador NSIS → requiere reinstalar; File→Abrir ya muestra `.ise` con el asar actual.
- [x] **Renombrados los 3 proyectos de `Desktop\Rito Movie`** a `.ise`: `360/Rito360`, `Dome/RitoDome`, `Flat/RitoFlat` (autosaves `.snap`/`.autosaveN` intactos; la app abre `.rdome` igual).

## ROUND 91h (rebrand a Immersive Studio Pro + .isp + 3 fixes de sala) — Nuevo install "Immersive Studio Pro" (asar 3197163)
- [x] **Rebrand del software a "Immersive Studio Pro"** (era "Immersive Studio Editor"/"Dome Studio Pro"): `package.json` productName + appId `com.almadigitalstudio.immersivestudiopro` + name `immersive-studio-pro` + shortcutName + portable artifactName; `main.js` títulos de ventana/visor; `index.html` `<title>`; `app.js` landing, `DSP.setTitle`, título del visor 3D, nombre NDI "Immersive Studio Pro — Master". (Comentarios/telemetría interna con "Dome Studio Pro" sin tocar.)
- [x] **Extensión `.isp`** (era `.ise`): guardar/incremental/dlBlob → `.isp`; regex de título/recientes y escaneo de autosave aceptan `.isp|.ise|.rdome`; `main.js` argv + filtros save/open `['isp','ise','rdome','json']` default `proyecto.isp`; `package.json` fileAssociations añade `isp` (mantiene `ise`+`rdome` legacy). **Instalador + carpeta = "Immersive Studio Pro"** (productName). Instalado en `%LOCALAPPDATA%\Programs\Immersive Studio Pro` (silent `/S`) con asociación `.isp` + acceso directo. Renombrados los 3 proyectos de Rito Movie `.ise`→`.isp`.
- [x] **Nombre de muro en 3D pequeño/gris en la esquina** (como el 2D): `drawRoomLabels3D` — etiqueta a `pt(0.05,0.10)` (abajo-izq del muro), 9px, gris `rgba(196,201,208,0.82)` con fondo tenue (antes 12px coloreada centrada). Verificado por screenshot.
- [x] **Texturas invertidas 3D→2D arregladas:** con la planta CCW vista desde DENTRO, cada muro va a→b de derecha-a-izquierda → **U estaba espejada**. `buildRoomGeo`: swap `uL↔uR` en muros + flip x en `fuv` del piso. Vertical OK (arriba=arriba). Verificado por píxeles: clip a la izquierda del strip → aparece a la izquierda en el Viewer (left 331 > right 241).
- [x] **Doble grilla en 2D → una sola:** `drawFlatFrame` ya no dibuja la grilla genérica de tercios en modo sala (`!isRoom()`); queda solo la per-muro 3×4 de `drawRoomGrid2D`. Verificado 0 GL, sin regresión domo/flat.
- Deploy: nuevo install "Immersive Studio Pro" + asar copiado también a las 2 instalaciones antiguas "Dome Studio Pro" (corren el código nuevo). NOTA: el doble-clic `.isp` funciona en el install nuevo; las antiguas quedan como legacy (desinstalables).
- [x] **(R91i) Nombre de muro en 3D como TEXTURA pegada al muro** (pedido: "como la grilla"): `drawRoomLabels3D` ya no dibuja el texto plano en un punto — lo pinta como **decal afín sobre el plano del muro** proyectando 3 esquinas de una caja en (u,v) del muro (`pt(0.96,0.05)`/`pt(0.64,0.05)`/`pt(0.96,0.16)`) y aplicando `ctx.setTransform` para que el texto siga la perspectiva del muro (escorza/escala con él, como las líneas de grilla). Lee correcto de izq→der desde DENTRO (lado 'b' = pantalla-izq); gris `rgba(208,212,218,0.5)`. Verificado por screenshot orbit + Viewer (FRONT recto sobre el muro frontal, LEFT escorzado hacia la profundidad). Deploy 3 installs 3197483.
- [x] **(R91j) Ajustes 3D sala:** texto de muro MUCHO más chico (caja del decal `wu 0.32→0.15`, `wv 0.11→0.05`, esquina abajo-izq); **fondo de cada muro NEGRO como el 2D** (`u_base`→`(0,0,0)` + clear del visor a negro): los muros sin contenido quedan negros con solo la grilla, el contenido se pinta encima. Verificado screenshot Viewer + 0 GL. Deploy 3 installs 3197615.
- [x] **(R91l) Limpieza + rename de carpeta.** Borrados de `dist/` los artefactos **Dome** viejos (portable+Setup+blockmap, ~184 MB, regenerables) + `builder-debug.yml`; `alma-logo-OLD.png.bak` movido a `_backup/`. **Carpeta de trabajo renombrada `Dome Studio Pro/` → `Immersive Studio Pro/` y MOVIDA** a `C:\Users\beltr\Desktop\Alma Digital Studio\Projects\Immersive Studio Pro` (ya NO bajo "Rito Digital Visual"); verificado que compila e íntegra en la ruta nueva. El `deploy-ndi-to-programfiles.ps1`/`package.json` solo referencian rutas de INSTALACIÓN (no la de trabajo) → sin cambios necesarios.
- [x] **(R91k) Etiqueta 3D: mitad de tamaño + sin estirar horizontal.** La caja del decal ya no es de proporción fija (estiraba el texto): `wu` se calcula del **aspecto real** = `wv·(tw/th)·(wallH/wallW)` (ancho del texto × proporción física del muro `hypot(b−a)`) → no se deforma; `wv 0.05→0.03`. Queda compacta en la esquina abajo-izq. Verificado screenshot. Deploy 3 installs 3197745.

## ROUND 90c — Selección de medios por RANGO con Shift + colores de carpeta INLINE en el menú (user). Deploy A+B 3143374
- [x] **Shift = rango contiguo** (estilo Adobe/Explorador): clic normal fija el ancla (`state.selMediaAnchor`) y selección única; shift-clic selecciona TODOS los medios entre el ancla y el clic en el ORDEN visible (`orderedMediaIds()` lee el DOM → respeta carpetas/colapso/filtro). Ctrl/Cmd sigue siendo toggle individual. `clearMediaSel` limpia el ancla. Antes shift hacía toggle de a uno (comportamiento de Ctrl).
- [x] **Colores de carpeta INLINE en el clic derecho** (user "que aparezcan de una los colores a elegir"): `openMenu` soporta un item `{swatches:{cur,onPick,onClear}}` que dibuja la fila de muestras DENTRO del menú (paleta + ✕ = sin color); clic aplica directo sin popup extra. Reemplaza el ítem "Color de carpeta…" en árbol y cuadrícula; `openFolderColorPopup` eliminado.
- [x] Verificado CDP: clic m1 + shift-clic m3 → 3 seleccionados (3 en DOM), shift-clic m2 encoge a 2, Ctrl añade m4 (3), clic normal resetea a 1 con ancla; menú de carpeta con ≥5 muestras inline, clic de muestra fija color sin segundo popup; 0 errores GL.

## ROUND 90 — Panel de medios: rename in-place de carpetas, sin botón de basura, colores de carpeta, Propiedades y Localizar (user). Deploy A+B 3141470
- [x] **Rename de carpetas IN-PLACE** (`renameFolderInline` con `inlineEdit` sobre `.fnm` del árbol / `.tlbl` del tile de cuadrícula; fallback a prompt si no hay elemento): commit renombra vía `_reprefixFolders` → color, medios y navegación siguen al nuevo nombre. Guards `isContentEditable` en click/dblclick/pointerdown para que editar no dispare drag/navegación. El rename de medios ya era in-place (R86).
- [x] **Botón de basura (`.fdel`) eliminado** de las cabeceras: una carpeta solo se borra con **tecla Suprimir** (nueva rama en el keydown para `state.selFolder`, con confirmación si tiene medios; `clearMediaSel` también suelta la selección de carpeta al tocar timeline/viewport → Suprimir nunca borra una carpeta por sorpresa) **o clic derecho → Eliminar carpeta**.
- [x] **Colores por carpeta**: `state.folderColors{path:hex}` persistido en el proyecto; menú contextual "Color de carpeta…" → `colorPopup` (paleta existente); tiñe icono+nombre en el árbol y icono+borde del tile; los colores SIGUEN a la carpeta al renombrar/mover y se limpian al borrar (`_reprefixFolders`/`deleteFolder`).
- [x] **Clic derecho en un medio → "Propiedades…"**: modal con nombre, tipo, resolución, fps, duración (+segundos exactos), nº de fotogramas (secuencias), sample rate/canales (audio), tamaño en disco, bitrate promedio calculado, estado del proxy, carpeta y ubicación (texto seleccionable) + botón "Mostrar en el Explorador".
- [x] **Clic derecho → "Mostrar en el Explorador"** (localizar el archivo en disco, `DSP.revealPath`) para cualquier medio con ruta.
- [x] Verificado CDP: sin `.fdel`; color en icono, sigue al mover (Col→Otro/Col) y al renombrar; rename inline editable sin diálogo flotante y con medios/color remapeados; Suprimir borra la carpeta seleccionada; selección se suelta al tocar timeline; Propiedades muestra 2560×1440 / 60fps / 250MB / 200Mbps / ruta / botón Reveal; menú con Propiedades y Explorador; 0 errores GL.

## ROUND 89c — Doble clic ENTRA a la carpeta en la lista (user: "con doble click abre el rename"). Deploy A+B 3135324
- [x] Doble clic en una cabecera de carpeta del árbol NAVEGA hacia adentro (renombrar pasa al menú contextual, como en la cuadrícula): vista scoped con fila "← ruta" que vuelve al padre nivel a nivel, subcarpetas+medios del nivel actual, y `state.mediaFolder` COMPARTIDO con la cuadrícula (cambiar de vista mantiene la carpeta). GOTCHA arreglado: el clic simple re-renderizaba el panel y el elemento se reemplazaba a mitad del doble clic → el dblclick nunca disparaba; ahora la selección pinta clases IN-PLACE (`selectHdr`) sin re-render. "Nueva carpeta"/Importar/drop del SO caen en la carpeta navegada (o la seleccionada). El toggle lista↔cuadrícula ya no resetea la navegación.
- [x] Verificado CDP: click selecciona in-place (elemento vivo+fsel), dblclick entra sin diálogo, back ×2 vuelve a raíz, drill Clips→Clips/Front, target de Nueva carpeta = carpeta navegada, 0 errores GL.

## ROUND 89b — Las carpetas se ven SIEMPRE en la lista (user: "abro el media y no se ve la carpeta salvo en cuadrícula"). Deploy A+B 3133511
- [x] El árbol de carpetas ya no depende de la agrupación "Folder": la vista de lista lo renderiza SIEMPRE que existan carpetas (con "None" incluido); "None" solo queda plano con cero carpetas. Verificado CDP: None+carpetas → árbol con sangría; None sin carpetas → lista plana; 0 errores GL.

## ROUND 89 — Vista de LISTA como ÁRBOL de carpetas estilo Adobe (user, con capturas de Premiere). Deploy A+B 3133497
- [x] La agrupación por carpeta de la vista de lista ahora es un ÁRBOL real: carpetas anidadas con sangría (13px/nivel), chevron `.fchev` colapsa/expande (solo el chevron — el clic en la fila SELECCIONA la carpeta, `state.selFolder`, highlight `.fsel`), medios indentados bajo su carpeta, subcarpetas recursivas, contador = medios+subcarpetas, placeholder "Arrastra medios aquí" en carpetas hoja vacías. Cabecera raíz "Sin archivar" (fname='') = destino de drop para SACAR de carpetas.
- [x] "Nueva carpeta" crea DONDE ESTÁS (Adobe-like): grid → carpeta navegada; lista → carpeta seleccionada; la nueva queda seleccionada y sus ancestros se expanden. El botón Importar y el drop de archivos del SO también archivan en la carpeta navegada/seleccionada — y si sueltas ENCIMA de una cabecera concreta, en ésa.
- [x] Drag&drop en lista: filas de medios (multi-selección incluida) Y cabeceras de carpeta son arrastrables entre niveles (startFolderDrag en cabeceras; `_folderJustDragged` evita que el clic post-drag cambie la selección). `selFolder` se remapea en mover/renombrar y se limpia al borrar.
- [x] Verificado CDP: sangrías 6/19/32px, colapso oculta subárbol, clic selecciona + Nueva carpeta creó B/Hijo dentro de B, mover medio a carpeta anidada, mover carpeta A/Sub→B con su medio siguiéndola, cabecera raíz des-archiva, 0 errores GL.

## ROUND 88b — AUDITORÍA del lote R88 (user): 6 hallazgos corregidos, todo re-verificado CDP. Deploy A+B 3130596
- [x] **A1 (real)** Arrastrar una MULTI-selección era imposible: el pointerdown simple sobre un ítem ya seleccionado reseteaba la selección a [ese] antes del drag. Fix: si ya está en la selección, se conserva (patrón del timeline). Verificado DOM: press sobre seleccionado mantiene 2; sobre no-seleccionado resetea a 1.
- [x] **A2 (real)** `_importFolder` OBSOLETO: el botón Importar heredaba la carpeta del último drop (los archivos caían en una carpeta vieja). Fix: default null + reset tras cada import + el botón Importar archiva en la carpeta que estás navegando (grid).
- [x] **A3 (real)** El jitter (Aleatorizar) abría COSTURAS en composiciones tile/mosaico: excluido con `!g.tile` (además de domegrid/random). Verificado: ring+tile+jitter60 queda sin jitter.
- [x] **A4** `groupScale` seguía tapado a 160 con el nuevo máximo 300 → 300.
- [x] **A5 (riesgo)** `startFolderDrag` hacía preventDefault en pointerdown (puede suprimir el dblclick que ABRE la carpeta en Chromium) → quitado; verificado con eventos DOM reales: dblclick entra a la carpeta y aparece el tile ←.
- [x] **A6** Texto/forma/ajuste creados navegando una carpeta iban a la raíz (invisibles) → se archivan en la carpeta actual. + Menú "Mover a:" ahora mueve toda la multi-selección vía `moveMediaTo` (undo/dirty).
- [x] Notas de auditoría sin cambio: undo NO restaura movimientos de carpeta (snapshot no incluye folders/m.folder — igual que siempre, sin corrupción); vista LISTA muestra paths completos "A/Sub" como cabeceras planas (funciona el drop, estética pendiente); loop reverse en vídeo durante play en vivo puede no ser fluido (navegador no reproduce video hacia atrás) — scrub/export correctos. Regresiones re-verificadas: moveFolder+medios siguen, ping-pong exacto, 0 errores GL.

## ROUND 88 — Lote de 11 arreglos (user), de más difícil a más fácil. Todo verificado CDP contra fuente (1 solo build). Deploy A+B 3129344
- [x] **F1 · Carpetas ANIDADAS + drag&drop completo** (lo más difícil): modelo path-based (`state.folders`=paths "A/Sub", `m.folder`=path del contenedor; retrocompatible — nombres planos viejos = paths de nivel superior). Helpers `folderName/Parent/Children/Descendants`, `joinFolder`, `_reprefixFolders`, `moveFolder`, `moveMediaTo`. Grid reescrito para navegar el árbol (subcarpetas del actual + medios del actual + tile ←). Crear carpeta dentro de la que estás (`newFolderIn(state.mediaFolder)`). Arrastrar **medios (multi-selección shift)** y **carpetas** entre carpetas / al fondo del grid (root) / al tile ← (padre), con **highlight visual del destino** (`_dropTargetAt`/`.dragover` en folderhdr/backtile/mediagrid). Arrastrar una **carpeta del Explorador de Windows** la importa entera recreando su árbol (`importDropped` con `webkitGetAsEntry` recursivo → `_importFolder` capturado por cada `add*`). Verificado CDP: crear A + A/Sub, mover medio a A/Sub, mover carpeta A/Sub→root y el medio la SIGUE (A/Sub→Sub).
- [x] **F2 · Compose no vuelve a frame 1 al editar params**: `apply`/Recompose usan `scrubRender()` (re-busca los videos internos recreados al frame ACTUAL, no a 0). Verificado.
- [x] **F3 · Nest desde recorte muestra desde el in-point, no frame 0**: el scope (inP/speed) se PERSISTE en el comp group (`g.scopeInP/scopeSpeed`) y `regenComposeNest` lo re-aplica → editar params ya no revierte al frame del video original. Verificado (innerInP=5 inicial y tras regen).
- [x] **F4 · Aleatorizar en TODOS los modos**: overlay de jitter en `compLayout` (az±60·J, el±30·J, size±60%·J con `g.rand`) + fila "Aleatorizar" (botón Mezclar posiciones ↻ + slider %) en el diálogo, `jitter`/`rand` persistidos. No afecta domegrid (sectores sin costura) ni el modo random. Verificado (5/6 elementos cambiaron).
- [x] **F5 · Multi-selección de medios (shift) → clic-derecho → crear composición**: `state.selMediaIds`, `selectMedia(id,e)` toggle con shift/ctrl, `paintMediaSel`, item "Crear composición desde estos N" (medios componibles), `openCompose(...,preselIds)` pre-marca. Delete borra toda la multi-selección. Verificado.
- [x] **F6 · Toda composición va en pista NUEVA**: `createComposition` siempre `push` de una lane de vídeo nueva (antes reusaba la existente). Verificado.
- [x] **F7 · Viewport 2D mueve SOLO el clip seleccionado**: `flatRectHit(c,px,py)`; en modo plano el pointerdown solo arrastra el clip seleccionado (un clip encima ya no roba el drag → clips de abajo se mueven seleccionándolos primero en el timeline). Dome sin cambios.
- [x] **F8 · Scale casi infinito**: `TF_FLAT` Scale 300→**1000%**, `TF` dome Size 160→**300°** (drawClipFlat sin clamp superior → se puede tipear más). Verificado.
- [x] **F9 · Loop REVERSE (ping-pong)**: `srcT` alterna dirección en ciclos impares cuando `c.loopRev`; `toggleLoopReverse`, toggle en inspector (bajo Loop, no audio) + menú del clip. Verificado exacto (0→1→2 ida, 2→1→0 vuelta).
- [x] **F10 · Audio a mitad**: scheduling de `startAudio` para rel<0 PROBADO correcto desde cualquier posición (ruler-scrub y click-en-timeline → 1 fuente); + `startAudio` reprograma tras `resume()` si el contexto estaba suspendido. (El "no suena a mitad" del usuario era el buffer aún decodificando; ya cubierto por R87b/R88 reschedule-al-decodificar.)
- [x] **F11 · Locator con nombre editable al instante**: `addMarker` abre el rename inline diferido un tick. Verificado (tecleo "MyLoc"+Enter renombró). 0 errores GL en todo el lote.

## ROUND 87b — Audio no se escuchaba (user "revisión rápida") — reprogramar al decodificar tarde
- [x] Motor de audio + ruta de decodificación VERIFICADOS sanos por CDP (ctx 'running', 1 source programado, masterGain=1, salida estéreo; WAV real decodifica en ~100ms y programa reproducción). El hueco real: `startAudio()` solo se llama al pulsar Play; si el buffer termina de decodificar DESPUÉS (típico con el audio largo de la película, que tarda un instante tras cargar el proyecto), el clip quedaba MUDO hasta re-dar Play. Fix: `addAudio` (import) y la rama audio de `reloadMedia` ahora llaman `if(state.playing)startAudio()` al fijar el buffer → reprograma y se oye sin re-reproducir. Verificado CDP: Play sin buffer→0 sources; tras decodificar→`startAudio` dispara (ph 0.14) y queda 1 source. Deploy A+B 3114154.

## ROUND 87 — Save As visible + capa de ajuste como MEDIO + estado "cargando" (no "missing") + sync autosave (user)
- [x] **Save As visible**: caret `#saveMenuBtn` (chevron) junto a Save → menú Save / **Save As… (archivo nuevo)** / Save incremental (`openSaveMenu` compartido con el clic-derecho de Save). Ctrl+Shift+S sigue haciendo Save As.
- [x] **Capa de ajuste como MEDIO arrastrable**: el botón lateral "Adjust" (`#adjLayerBtn`) ahora crea un MEDIO `kind:'adjust'` (`createAdjustMedia`/`newAdjustMedia`) que aparece en el panel de Medios (tile rayado, etiqueta ADJ, "ajuste · FX debajo"); arrastrarlo a una pista de vídeo (o doble-clic) crea un clip de ajuste (`addClip` rama adjust → `makeAdjustClip`). Su cadena FX afecta a todo lo de debajo — **color Y audioreactivo**. VERIFICADO empíricamente que los FX reactivos SÍ modulan en capas de ajuste (banda bass alta→mod 1.0, baja→0.0). El botón "Add Adjustment Layer" del panel reactivo sigue soltando una directa en el timeline. `reloadMedia`/serialización manejan `kind:'adjust'` (sin archivo).
- [x] **Missing media falso en apertura (sobre todo audio)**: nuevo flag `_loading` — al cargar proyecto el medio de archivo arranca `missing:true,_loading:true`; `reloadMedia` limpia `_loading` en CADA salida (éxito y fallo real; +handlers `error` de img/video). Los tiles muestran "cargando…" (no "ausente") y sin contorno mientras decodifica; `updRelink` solo avisa de fallos REALES (`missing&&!_loading`) → ya no hay flash "Missing media" mientras el audio decodifica.
- [x] **Autosave sync (recents vs doble-clic ofrecían recuperación falsa)**: causa raíz = el tick de autosave escribía un autosave REDUNDANTE de un proyecto recién cargado y limpio (guard `!dirty && lastSaved` era false con `lastSaved` undefined) → ese autosave quedaba MÁS NUEVO que el .rdome → siguiente apertura ofrecía "restaurar autosave más reciente". Fix: (1) tick `if(!state.dirty)return;` — nunca autosalvar un proyecto limpio/recién-cargado; (2) `clearLiveAutosaves()` borra `.autosave1/2` tras cada Save manual → el .rdome siempre es la copia más nueva. Recents y doble-clic (ambos usan `openProjectPath`→`maybeOfferAutosave`) quedan siempre en sync con el último guardado.
- [x] Verificado CDP: menú Save As presente; `createAdjustMedia`→medio 'adjust' en panel + drop crea clip adjust; tile "cargando"→"missing" al fallar y `updRelink` ignora los que cargan; `clearLiveAutosaves` ok; reactivo en capa de ajuste modHi=1/modLo=0; 0 errores GL. Deploy A+B 3113843.

## ROUND 86 — Barra de vista + selección/renombrado de medios in-place + renombrado por clip (user)
- [x] **Barra 3D Dome**: el botón **Orbit** ahora va a la IZQUIERDA de **Viewer** (orden `orbit`,`spec` en `#threeModeSeg`). **Viewer por defecto FOV 60 / dolly 0.8** (`state.view.cam.fov:60, back:0.8` + `value`/label en HTML; `updViewCtl` sincroniza los sliders al entrar a Viewer). **Faders más cortos** (FOV 88→56px, DOLLY/DIST 78→54px, `.vslab` padding 9→7 / gap 8→6) para que no se corten los botones. **Icono de 3D Dome centrado** en su botón (`view3d` path desplazado a y=16 → bbox centrada en 12).
- [x] **Medios: clic = seleccionar** (`state.selMediaId`, `selectMedia`/`clearMediaSel`, clases `.mitem.sel`/`.mtile.sel`). Con un medio seleccionado, **Suprimir borra el MEDIO, no el clip del timeline** (rama prioritaria en el keydown antes de ripple/marker/group/deleteSel). Tocar el timeline/viewport/cabecera de pista o añadir un clip (`addClip`) devuelve la prioridad de borrado a la selección del timeline.
- [x] **Renombrar medio IN-PLACE** (no diálogo flotante): doble-clic sobre el nombre (`.mname` lista / `.tlbl` cuadrícula) o menú contextual "Renombrar" → `renameMediaInline` con `inlineEdit`. `deleteMedia` extraído y compartido (menú + tecla Suprimir).
- [x] **Renombrar por clip**: doble-clic sobre el TÍTULO de un clip (`.tt`) lo renombra in-place; menú del clip + Ctrl+R también. Como cada porción cortada es su propio objeto-clip, **cada trozo se renombra independientemente** (verificado: cortar en 2 → renombrar la 2ª parte deja la 1ª intacta). La cabecera de pista sigue con doble-clic → renombrar pista.
- [x] Verificado CDP: orden Orbit/Viewer, defaults 60/0.8 reflejados en sliders, ancho faders 56/54, `view3d` path `M3 16`; medio seleccionado + Suprimir borra el medio sin tocar el clip fake seleccionado; clear quita `.sel`; rename medio "RENAMED_B"; corte→2 clips ids únicos→2ª parte "PART_TWO" y 1ª intacta; 0 errores GL. Deploy A+B 3109569.

## ROUND 85 — "Quitar negro" (luma key) — transparencia real, mejor que screen (user)
- [x] El screen solo aclara; el usuario quería quitar el fondo negro. **Luma key** `props.blackKey`+`blackKeyAmt`(umbral)+`blackKeySoft`(suavidad): shader PP `_KEY` (`applyBlackKey`) pone la ALPHA del clip = `smoothstep(thr, thr+soft, max(R,G,B))` — usa el MAX de canales para que colores saturados sobrevivan y solo el negro/oscuro-en-todos-los-canales se vuelva transparente. Corre como último pre-pase (tras fisheye+FX) → transparencia real que compone con NORMAL blend; funciona en domo y plano. Toggle + campos Umbral/Suave en el inspector (cualquier clip visual, no audio). Serializa vía props; `_keyRT` liberado.
- [x] Verificado CDP con 2 capas fulldome (roja abajo, negra-con-cuadro-blanco arriba): key OFF → zona negra tapa (0,0,0); key ON → la zona negra deja ver el ROJO de abajo (224,16,16), el cuadro blanco intacto (255,255,255), 0 errores GL. Deploy A+B 3106097.

## ROUND 84c — Flechas ←/→ paso por frame + color POR CLIP (color de pista = solo cabecera) (user)
- [x] **Flechas ←/→ = paso exacto por frame** del cabezal (ya existía; ahora con `e.preventDefault()` para que el navegador no scrollee además, + `positionPlayhead()`). Alt+flecha sigue haciendo nudge del clip. Verificado: 3 derecha − 1 izquierda = +2 frames a 60fps (con la app en uso; detrás de un modal los atajos no disparan, correcto).
- [x] **Color por clip:** los clips ahora se pintan con SU PROPIO `c.color` (no `laneTint`); el **color de pista tiñe solo la cabecera** de la pista (ya era así, líneas 1229-1232). Popup de swatches refactorizado a `colorPopup` genérico → `openLaneColorPopup` (pista) + **`openClipColorPopup`** (todos los clips seleccionados). Entrada **"Color…"** en el menú contextual del clip + la barra de color del inspector ahora abre el picker del CLIP. Verificado CDP: clip A azul propio, clip B gris por defecto (NO el rojo de la pista), cabecera con tinte rojo. `laneTint` queda como helper muerto (inofensivo). Deploy A+B 3101516.

## ROUND 84b — Ctrl+L quita el loop tras un clic simple (user)
- [x] Antes: con un loop activo, un clic simple dejaba una marca de inserción (`selA==selB`) y `loopSelection` a propósito NO borraba el loop ("an insert marker alone must NOT destroy an existing loop"). Ahora: si no hay rango ni clip que loopear (`a==null`), Ctrl+L **quita el loop activo** (cubre el caso "clic simple en otra parte + Ctrl+L"), y si no hay loop solo avisa. Loopear un clip seleccionado o un rango sigue igual. Verificado CDP (5 casos). Deploy A+B 3100387.

## ROUND 84 — Save As visible + vista de cuadrícula de medios con navegación de carpetas (user)
- [x] **Save As:** `saveProject(true)` (forzar diálogo → guardar como archivo NUEVO, `currentPath` pasa al nuevo) ya existía con atajo Ctrl+Shift+S; ahora VISIBLE: entrada "Guardar como… (archivo nuevo)" en la paleta ⌘K + **clic derecho en el botón Guardar** (Guardar / Guardar como… / Incremental) + tooltip actualizado. Verificado: el menú del botón muestra "Save As".
- [x] **Vista de cuadrícula de medios:** botón en la cabecera del panel (2×2) alterna lista/cuadrícula (`state.mediaView`). En cuadrícula: **carpetas como tiles cuadradas** (icono carpeta + nombre + conteo); **doble-clic entra** a la carpeta (`state.mediaFolder`) mostrando SOLO sus medios + una **tile "← volver"**; medios como tiles con miniatura + duración + badge de proxy. Arrastrar un medio sobre una tile de carpeta lo archiva (reusa `folderhdr`/`dataset.fname`). Menú contextual de medios extraído a `openMediaCtx` (compartido lista+tiles). Verificado CDP: raíz muestra 1 carpeta + 1 medio suelto, entrar muestra back+alpha.png, volver regresa. Deploy A+B 3100305.

## ROUND 83b — BUG "el proyecto solo me lleva al inicio" (user, crítico — no perder trabajo)
- [x] **Causa:** al abrir (doble-clic / botón Abrir) un proyecto con autosaves más nuevos que el archivo (siempre, tras editar), `maybeOfferAutosave` mostraba el diálogo de recuperación PERO la pantalla de inicio (`#landingOv`) seguía visible ENCIMA/al lado → el usuario solo veía el inicio y no notaba/alcanzaba el diálogo. `loadProject` (que oculta el landing) no corría hasta responder el diálogo. Verificado por CDP: `overlays:["landingOv","confirmOv"]`, clips=0 en espera.
- [x] **Fix:** `hideLanding()` ANTES de `maybeOfferAutosave` en `openProject` y `openProjectPath` → el diálogo aparece en pantalla limpia. Verificado: ahora `overlays:["confirmOv"]` solo; clic en "Restaurar autoguardado" o "Abrir el archivo" carga el proyecto completo (1 clip, 2 medios, vídeo RITO DIGITAL FILM). `loadProject` sobre el archivo del usuario ya funcionaba (no era un problema de datos).
- [x] **Limpieza de datos:** MIS pruebas habían escrito autosaves VACÍOS (1105b, clips=0) en `Rito Digital Dome\autosave\` que, siendo los más nuevos, "Restaurar autoguardado" ofrecía → habrían dado estado vacío. Borrados los `.autosave1` y `.snap` de <1500b; conservados los buenos (2221b). El `.rdome` del usuario (11:44) SIEMPRE estuvo intacto. Deploy A+B 3094821.

## ROUND 83 — Pre-warp FLAT → OJO DE PEZ para clips de domo (user): botón "Ojo de pez" + cantidad, para material plano que va marcado como fulldome pero no tiene la curvatura fisheye
- [x] `props.fisheye` (bool) + `props.fisheyeAmt` (0-100). Shader PP `_FISH` (`applyFisheye`): remapeo radial barrel `rs=tan(d·k)/tan(k)` con k=0.02..1.37 según cantidad; k→0 = identidad (1:1), fuerte = ojo de pez; el borde siempre mapea al borde (llena el disco, sin anillo negro). Corre sobre la textura del clip ANTES de la cadena de FX y de la colocación en el domo (`drawClip`), así funciona con o sin fulldome.
- [x] Toggle + campo de cantidad en el inspector junto a "Fuente fulldome" (solo domo). Serializa vía props; default en `makeClip`; libera `_fishRT` en `freeFxResources`. **Fix latente:** los toggles fulldome/fisheye ahora llaman `raInvalidate()` (antes solo `render()` → con render-ahead activo el cambio no se veía).
- [x] Verificado: shader aislado mueve un anillo de r=0.46→0.84 (amt 0→100); pipeline en vivo r=0.475→0.853 al alternar; captura del máster muestra un tablero plano correctamente abombado en esfera de domo; 0 errores GL. Deploy A+B 3094600.

## ROUND 82c — HISTORIAL de recuperación (última hora) abrible como proyecto nuevo (user)
- [x] **Snapshots con timestamp** en la carpeta `autosave` del proyecto: `<archivo>.rdome.<YYYY-MM-DD_HH-mm-ss>.snap`, escritos ~1/min (`_lastHistT`, ≥55s) desde el intervalo de autosave, **podados a la última hora** (`pruneHistory` borra los `.snap` con mtime >1h de ESTE proyecto). Aparte de los 2 archivos de crash alternantes (`.autosave1/2`).
- [x] **Diálogo "Historial de recuperación…"** (paleta ⌘K, junto a "Restaurar último autoguardado"): `openRecoveryHistory` lista snapshots+crash de este proyecto (más nuevos primero, con hora + "hace X min"). Clic en uno → `confirmDiscard` → carga como **proyecto NUEVO** (`currentPath=null`, `dirty=true`) → Guardar pide nombre nuevo; el trabajo actual queda intacto hasta guardar. "Para volver atrás."
- [x] IPC nuevos: `dsp:listDir` (name+mtime+size), `dsp:deleteFile`. Verificado CDP: 3 snapshots con timestamps distintos + 1 crash, poda conserva recientes, abrir carga el snapshot correcto con currentPath limpio, diálogo renderiza 4 filas. Deploy A+B 3090928.

## ROUND 82b — Autosaves en carpeta `autosave` JUNTO al proyecto (user): `autosaveBase()` = `<projectDir>\autosave\<archivo>.rdome` (+`.autosave1/2`); antes del primer guardado siguen en `userData/autosave/unsaved.rdome.*`. `projAutosaveDir()` + `DSP.ensureDir` crea la carpeta; `emergencySave` la asegura antes de escribir. `restoreAutosave`+`maybeOfferAutosave` buscan en la carpeta nueva Y en el sidecar antiguo (compat). Verificado CDP: base=`…\autosave\MyFilm.rdome`, escritura en carpeta, oferta de recuperación con gap real >2s encuentra el archivo de la carpeta. Deploy A+B 3085375.

## ROUND 82 — 5 arreglos (user), todo verificado CDP + deploy A+B 3084339
- [x] **(1) Líneas gruesas con blur eliminadas**: el `.snapline` tenía `box-shadow:0 0 7px` (glow) → ahora línea nítida de 1px sin glow (era lo único con blur en el timeline; verificado boxShadow:none).
- [x] **(2) Zoom out casi infinito**: clamp mínimo de `pxPerSec` 8→**0.1** (los 3 sitios: `tlZoomAt`, `#tlZoomIn/Out`) + pasos de grilla ampliados a 600/1200/1800/3600s → una película de 63min (3795s) cabe en ~380px.
- [x] **(3) Composición desde un pedazo de clip**: clic derecho en un clip (no audio/secuencia) → **"Crear composición desde el clip…"** abre el modal compose pre-seleccionando ESE medio; al crear, `createComposition` con `opts._scope={inP,dur,start,speed}` → la nest dura SOLO lo del clip cortado, los clips internos usan el `inP` del corte, y se coloca en una **PISTA NUEVA** en el inicio del clip (como media independiente). Verificado: lane+1, nestDur=3, innerInP=2, en pista top, start=5, fulldome.
- [x] **(4) Import de secuencias PNG con fps** — YA existía y funciona: seleccionar ≥3 imágenes numeradas juntas → `importFiles` las agrupa → `askSeqFps` (presets 12/24/25/30/50/60) → `addSequence` crea media `kind:'sequence'` que se comporta como vídeo (dur=frames/fps). El menú Media "Importar secuencia…" abre el selector (multi, auto-detecta). Verificado por inspección + rondas previas.
- [x] **(5) Abrir carpeta tras exportar**: IPC nuevo `dsp:revealPath` (shell.showItemInFolder / openPath), `DSP.revealPath`. `doExport` captura `expOut` en cada escritura exitosa (still/PNG-seq/MP4 stream/MP4 mem) y al terminar (no cancelado) ofrece `appConfirm("¿Abrir la carpeta?")`. Verificado IPC presente.

## ROUND 81 — Clips LOOPEABLES estilo Ableton (user): toggle "Loopeable" por clip (inspector + menú contextual) → el clip se puede estirar por el borde derecho INFINITAMENTE y el contenido se repite; ticks sutiles + ↻ marcan cada frontera de loop. `srcT(c,t)` envuelve en `[inP, inP+loopLen)` (loopLen = segmento fuente capturado al activar) → vídeo/secuencia/nest/audioreactivo/scrub/export/render-ahead repiten automáticamente; el re-sync de playback (ploop L2368) reengancha el `<video>` al envolver. `trimR`/`trimItem` omiten el clamp de fuente si `c.loop`. Audio loopea vía `AudioBufferSourceNode.loop`+loopStart/loopEnd en playback y en el export mix (stop() acota el span wall-clock). Desactivar recorta `dur` de vuelta a la fuente. `c.loop`/`c.loopLen` serializan y se duplican solos. Verificado CDP: wrap t5→1/t9→1, ciclo respeta speed (×2→2s), evento de audio con loopLen, serialize, off-clamp. Deploy A+B 3081855.

## ROUND 80c — Arrastre MULTI-selección entre pistas (user): mover y Ctrl-copiar 2+ clips ahora cambia de pista con **desplazamiento RELATIVO** (estilo Premiere: el ancla sigue al cursor, cada clip conserva su offset de pista; `drag._laneDelta`), validado por clip (la pista destino debe existir y ser del mismo tipo — si algún destino es inválido, no hay desplazamiento). Fantasmas dibujados en las pistas desplazadas. Verificado CDP: copy → copias en pistas +1 relativas ✓, move ✓. Deploy A+B 3077393.

## ROUND 80b — El botón Snap ahora gates SOLO la grilla (user): el snap a bordes de clips/playhead/marcadores queda SIEMPRE activo (`applySnap` sin early-out; los call sites de timesel/razor quitan el gate `state.tl.snap`; Alt sigue anulando todo). Verificado: snap OFF → borde 10.03→10 ✓, grilla 3.03 no snapea ✓; ON → grilla vuelve ✓. Deploy A+B 3076485.

## ROUND 80 — COMPLETADO Y VERIFICADO (CDP: mapping 2×→srcT ok, rate en eventos audio, 0 clip+rango con split triple y medio disabled, paste con fx-id remapeado y kf 'fx:id:*' remapeadas, snap del borde FINAL gana a la grilla). `srcT(c,t)` reemplaza el mapeo inP en 11 sitios (drawClip/sequence/nest/render-ahead/collect/reactivo); `playbackRate` en play() + startAudio + exportAudioMix; disabled se salta en compositeClips/collectAudioEvents/audioLevelAt y se atenúa (opacity .35); menú del clip gana Velocidad…/Desactivar (0)/Copiar-Pegar atributos; trimR clamp = resto de fuente ÷ speed. Deploy A+B 3076414. (Especificación original debajo.)
- [ ] **R80-1 Velocidad por clip**: clic derecho en clip → "Velocidad…" (presets 25/50/75/100/150/200/400% + custom vía appPrompt). `c.speed` (default 1). El mapeo de tiempo fuente = `(t-c.start)*c.speed+inP` en TODOS los sitios que calculan `local` (drawClip/collectDrawnVideoClips/vinstSeek/seekMedia/export); audio: `playbackRate` en los BufferSource + export audio mix; clamp de trim a `srcDur/speed`. La duración del clip NO cambia sola (el usuario recorta).
- [ ] **R80-2 Silenciar sección estilo Ableton (tecla 0)**: con selección de tiempo (`state.selA/selB` del insert/range) sobre clips → split en los bordes de la selección y `c.disabled=true` en la parte central; sin selección → toggle `disabled` del clip seleccionado. Otro 0 = reactivar. Disabled: no se compone (skip en composite/collect), no suena (skip audio), se dibuja atenuado (opacity .35 + título tachado o similar monocromo). Serializa (ride via serClip). Undo ok (pushUndo).
- [ ] **R80-3 Copiar/pegar atributos**: menú contextual del clip → "Copiar atributos" (guarda deep-copy de props/fx/kf/_arAuto/anim del clip, sin id) y "Pegar atributos" (aplica a TODOS los selIds; regenerar ids de fx con uid() y remapear las keys 'fx:<id>:' en kf/_arAuto; pushUndo; refresh paneles).
- [ ] **R80-4 Snap entre clips (estilo Premiere)**: al arrastrar/trimear un clip, snapea (umbral ~8px) a bordes (start/end) de clips de CUALQUIER pista, al playhead y a marcadores — activo cuando el snap está ON, complementando la grilla (la grilla ya existe). Reunir candidatos una vez al iniciar el drag; mostrar la snapline existente (`#snapline`).
- Al terminar: npm run dist → verificar por CDP (speed mapping, 0-toggle con split, paste multi-clip, snap con candidatos) → deploy A+B → PLAN/memoria.

## ROUND 79c — SALVAVIDAS anticaídas (user: "integra un salvavidas para que no se caiga")
- [x] **Main:** `render-process-gone` → diálogo + `webContents.reload()` (un renderer muerto nunca tumba la sesión; el autosave a disco + la oferta de recuperación restauran ≤15s de trabajo); `unresponsive` → diálogo Esperar/Recargar. **Renderer:** `window error`/`unhandledrejection` → **autosave de emergencia inmediato** (throttle 5s) + diag. Verificado por CDP: error no capturado → autosave1 reescrito al instante, app viva.

## ROUND 79b — El proxy "completo" del clip 913Mbps salía CONGELADO (user) → detector + rescate
- [x] Causa raíz confirmada por ffprobe: `222222.mp4` = H.264 High **L5.2 a 913Mbps** (el nivel permite ~240) → el decodificador de Chromium no produce frames nuevos pasado ~2s NI en seek (seeks resuelven instantáneos con el último frame → proxy rápido pero congelado). **Detector de frames congelados** en la pasada de seeks de `makeProxy`: hash de 4×4 píxeles 1 de cada 8 frames (getImageData POR FRAME fuerza flush síncrono ≈15× más lento — muestrear); si >85% idénticos → aborta, trunca el caché a 0 bytes (no se re-enlaza) y `appAlert` explica que la FUENTE está fuera de rango y hay que recodificarla. OJO: según el estado del decoder los seeks a veces SÍ decodifican (lento ~6fps → proxy correcto en minutos) — ambos caminos aceptables.
- [x] **Clip del usuario RESCATADO**: `ffmpeg -c:v h264_nvenc -b:v 80M` → `222222_edit.mp4` (84Mbps, mismo 4K60) — verificado en la app: proxy sano con movimiento real (4/4 frames distintos muestreados del proxy). Regla práctica: capturas >~200Mbps deben recodificarse antes de editar.

## ROUND 79 — Blindaje pre-película (user: "mañana edito una película de 1h y no puede fallar") + 2 bugs reales del clip 4K del usuario
- [x] **AUTOSAVE A DISCO** (antes: localStorage cuota ~10MB — un proyecto de película lo supera y el código viejo hasta BORRABA el autosave anterior al fallar): cada 15s, fidelidad completa, **2 archivos alternantes** (`<proyecto>.rdome.autosave1/2`, o `userData/autosave/unsaved.rdome.*` antes del primer guardado) — un crash a mitad de escritura nunca destruye la única copia buena. localStorage queda como vía secundaria. Se salta cuando no hay cambios.
- [x] **Recuperación**: "Restaurar último autoguardado" lee la copia de disco más nueva parseable (torn write → prueba la siguiente); **al abrir un proyecto cuyo autosave es >2s más nuevo que el archivo** (crash sin guardar) → diálogo ofrece restaurarlo (`maybeOfferAutosave`). **`.bak` rotado en cada guardado manual.** **Undo con tope de bytes** (250MB además del tope de 80). Verificado todo por CDP (alternancia, restore, oferta, bak, contabilidad).
- [x] **BUG (user): proxy clavado en 6% con su clip 4K** (`222222.mp4`, 3840×2160@60, **850Mbps**, 2,77GB/26s): el reloj del `<video>` CORRE hasta el final en ~2s (observado: currentTime 1→26.09/ended, solo ~91 frames entregados) → el capturador rVFC esperaba frames que nunca llegan. Fix en `makeProxy`: listener `ended`→bail, **watchdog de progreso** (4s sin avanzar → bail), y el resto de frames se completa con **seeks acotados por frame** (race 1,5s; 5 timeouts seguidos → deja de seekear y rellena — el proxy SIEMPRE termina). El viejo "pad con duplicados" eliminado; la rama else de seek unificada en la pasada final. **Verificado con el archivo exacto del usuario: de 6% eterno → proxy completo en <10s** (38,9MB junto al clip).
- [x] **BUG (user): "el editor se vuelve loco tras exportar"** — 2 agujeros: (1) el early-return del export (cancelar el diálogo de guardado) reseteaba `exporting` pero **dejaba `_exportQuality=true`** (visor enganchado a originales pesados) y sin restaurar `nestSize`/vinst → limpieza completa clonada de la ruta normal; (2) exportar **sin pausar el transporte** → el rAF de reproducción y el seeker del export peleaban por los elementos de vídeo → `pause()` al inicio de `doExport`. Además el proxy 4K colgado seguía reproduciendo el original de 850Mbps en background para siempre (saturando el decodificador) — el watchdog lo corta.

## ROUND 78b — Proxies JUNTO AL CLIP (user: "¿los proxies en la misma ubicación que cada clip?")
- [x] **Ubicación preferida del proxy = la carpeta del clip fuente**: `<stem>.dsp-proxy-<hash(path|fsize)>.mp4` (el hash auto-invalida si el archivo fuente se reemplaza; el proxy viaja con el disco/carpeta de medios). Orden de búsqueda Y de escritura: **junto al clip → caché central `userData/proxies` → en-memoria** (`proxyCandidates`; el central cubre carpetas de solo lectura/red y conserva los proxies ya generados — verificado que `2.mp4` reutiliza su proxy central en 0,12s sin crear archivo local). Importar un `.dsp-proxy-*.mp4` directamente lo enlaza como su propio proxy (sin proxy-de-proxy).
- [x] Verificado en el `.exe`: copia fresca → proxy generado JUNTO al clip (`dsp-test-copy.dsp-proxy-11i1hz6.mp4`, 22,75MB, `m.proxyPath` apunta al local) · compat central ✓ · guard self-proxy ✓.

## ROUND 78 — Proxies PERSISTENTES a disco (user: "¿funcionará un clip de 30GB?" → sí con esto)
- [x] **El proxy ya no vive en RAM ni se regenera cada sesión.** Antes: MP4 del proxy muxeado en memoria (`ArrayBufferTarget`, ~12Mbps × duración → un clip de 60 min ≈ 5,4GB en RAM = riesgo real de OOM) y `loadProject` lo regeneraba desde cero en cada apertura (≈ duración real del clip). Ahora: **`Mp4Muxer.StreamTarget` → escritura posicional en streaming a disco** (`dsp:fileOpen/fileWriteAt/fileClose`, la IO del export PNG; `fastStart:false`) en un **caché global persistente** `userData/proxies/px_<hash(path|fsize)>_960.mp4` (IPC nuevo `dsp:proxyDir`). RAM plana con cualquier duración.
- [x] **Reutilización automática:** `makeProxy` comprueba el caché ANTES de crear nada — si el archivo existe se enlaza directo (`bindProxyFile`, URL file://); la carga de metadata hace de **verificación de integridad** (un parcial de una sesión matada no tiene moov → error → se regenera). La clave se recomputa de `path|fsize` → sin cambios de formato de proyecto; cualquier proyecto que use el mismo archivo fuente comparte proxy. "Regenerar proxy" fuerza sobrescritura (`_proxyForce`). Fallback al modo en-memoria para navegador / medios sin ruta / fallo de apertura. Fd huérfano cerrado si la generación falla a medias (`m._pfid` + catch de `pumpProxy`).
- [x] **Verificado en el `.exe`:** generación 17,9s → caché de 22,75MB en disco, `proxyUrl` file://; segunda importación del mismo archivo **0,13s sin re-encode**; **relanzando la app (proceso nuevo): 0,2s** — persistencia entre sesiones real. (De paso: `1.mp4`/`video.mp4` de Downloads NO son códecs soportados — código 4; `2.mp4` sí. El acceso file:// funciona.)
- [x] Nota 30GB: el archivo fuente se reproduce en streaming (no se carga en RAM); códecs soportados = H.264/HEVC/VP9/AV1 (ProRes/DNxHD no — Chromium); la generación del proxy sigue siendo ≈1× la duración del clip (una sola vez en la vida del archivo). Pendiente futuro: botón "Vaciar caché de proxies" (el caché crece sin límite) y quizá generación >1× vía WebCodecs decode directo.

## ROUND 77 — Piezas largas (75 min) sin congelar la UI + NDI 4K@60 (user: "arregla lo que hay que arreglar; prioridad análisis de piezas largas")
- [x] **`computeBands` apto para 75 min:** (1) las bandas se procesan **secuencialmente** (render 16kHz → envolvente → soltar) — antes retenía los 3 renders a la vez (75 min ≈ 288MB cada uno ≈ ~860MB de pico); ahora pico = 1 render. (2) **`env()` troceada** (~4M samples por rebanada con yield `setTimeout(0)`) → el hilo principal nunca se bloquea más de unas decenas de ms. (3) **Progreso visible** ("Analizando bandas de audio… n/3") solo para pistas >2 min.
- [x] **`computeWave` (picos del waveform al IMPORTAR) ahora async + troceada** (~8M samples por rebanada): un WAV de 75 min son ~216M samples y la pasada síncrona congelaba la UI ~1-2s en el import. Call sites actualizados (import + relink de proyecto). Archivos cortos = una sola rebanada, sin cambio de latencia.
- [x] **NDI input 4K@60 (dejado para el final a petición del usuario):** el addon gana **hilo de captura en background por receptor** (`RecvCtx`: std::thread bloqueado en `recv_capture_v3(100ms)` + swizzle [B,A,R,G]→RGBA **y flip vertical** en el hilo + doble búfer con mutex y contador `gen`; `staging.swap(buf)` recicla el almacenamiento sin realloc). `recvRead(name,lastGen,dst?)` en el hilo JS = solo un memcpy del frame más nuevo (null si `gen` no cambió → poll barato sin copias). El flip en el hilo permite subir con `UNPACK_FLIP_Y_WEBGL=false` — la ruta de flip de Chrome copiaba el frame 4K entero en CPU (**27ms→11ms por subida, medido**). Miniatura des-flipada con transform del canvas.
- [x] **VERIFICADO con emisor 4K@60 EXTERNO** (proceso Node aparte con el mismo addon — N-API es ABI-estable — barra en movimiento para esquivar el throttling de frames estáticos de NDI): **el hilo recibe los 60fps completos (59.9 medido)**; visibles ~21fps a 3840×2160 (limitado por el clon de 33MB del contextBridge por frame) y **60fps a 2048² e inferiores**. Antes: 4-14fps con stalls en el hilo principal; ahora la recepción+swizzle no toca el hilo de render.
- [x] **Intento SAB cero-copia — descartado con hallazgo:** `main.js` habilita el feature flag `SharedArrayBuffer` (NO es flag de GPU — seguro en híbridas) y `typeof SharedArrayBuffer!=='undefined'` en la página ✓, pero **el contextBridge de Electron RECHAZA SABs** («An object could not be cloned» — usa un serializador propio con lista blanca de tipos, no el structured clone estándar). El código mantiene la ruta SAB con fallback automático (`_ndiSabMode`) + guard en el preload (si un futuro Electron clonara el SAB en vez de rechazarlo, se detecta `buffer instanceof SharedArrayBuffer` y se evita mostrar frames negros). **Siguiente paso para 60fps visibles a 4K (R78, pendiente): `window.postMessage` entre mundos con ArrayBuffer transferable** (el preload bombea del addon y transfiere el buffer a la página con coste cero — el postMessage entre isolated/main world usa el clone real de blink, que sí soporta transferables).
- [x] `RecvStats` reescrito vía `gen` (nunca dos hilos en recv_capture); `recvClose/recvCloseAll` paran+join el hilo antes de destruir. **GOTCHA de build descubierto:** la dep `file:native/ndi-send` queda COPIADA en `node_modules/dsp-ndi-send` — editar `native/ndi-send/ndi.cc` no llega al `.exe` (rebuild compila la copia vieja, sin error alguno); hay que borrar `node_modules\dsp-ndi-send`, re-copiar desde `native\` y `npm run dist`.

## ROUND 76 — Audioreactivo nivel pro (TouchDesigner/Resolume) — motor + shaping + 9 FX nuevos (user: "efectos audioreactivos brutales")
- [x] **Motor de análisis v2** (`computeBands`, formato `v:2`): además de las envolventes RMS bass/mid/treble → (1) **banda `bright`** (proxy de brillo espectral: proporción de energía de agudos, calculada antes de normalizar); (2) **onsets por banda vía spectral flux** (derivada rectificada de la envolvente + umbral adaptativo media+1.4σ con prefix sums O(N) + peak-picking con separación mínima 120/90/50ms) → disparadores independientes estilo kick/snare/hat; (3) **BPM por autocorrelación** (slice central ≤150s por coste, plegado a 70-180) + **fase de beat** (`beat0` = offset de rejilla mejor alineado a los onsets, reducido a ancla de fase); (4) beats globales = onsets del flux combinado (bass×2+mid+treble×0.8) con fallback al detector viejo.
- [x] **Shaping de modulación POR EFECTO** (todo determinista/time-addressed → export idéntico): `arRecompute` ahora cachea las bandas **crudas** (solo gate+gain) + las suavizadas con A/R global (medidor/compat). Por efecto: **Attack/Release propios** (fx.atk/rel, semilla = valores del motor al crear; envolvente por-fx horneada en `_fxEnvCache` con firma banda|atk|rel|spring), **Curve** (exponente 0.25×..4× de respuesta, 50=lineal), **INV** (invertir), **Bounce/spring** (muelle subamortiguado ζ=0.28 estilo Lag CHOP de TD, integrado a 2 substeps → rebote orgánico con overshoot, horneado en el array). **Trigger** ahora usa los **onsets de la banda elegida** (antes: beats globales de energía) con rampa de ataque + release exponencial analíticos. **Modo LFO nuevo**: sine/tri/saw/square/**S&H aleatorio determinista**, sincronizado por fase al BPM detectado (o manual) vía `beat0`, divisiones 4/2/1 compases · 1/2 · 1/4 · 1/8 · 1/16. `FX_META` (atk/rel/curve/spring) viven en el objeto fx (serializan solos), NO son parámetros de shader ni automatables.
- [x] **9 efectos nuevos:** **Bloom/Glow** (multi-paso custom `FX_APPLY`: bright-pass con soft-knee → gaussiana separable 2 rondas H/V a media resolución → composición screen con alpha extendido al halo — EL look pro), **Noise Warp** (displace fbm 3 octavas, distorsión líquida), **Feedback Flow** (zoom+rotación+**hue-rotate**+warp senoidal DENTRO del bucle de feedback → túneles psicodélicos TD), **Chroma Pulse** (aberración cromática radial + respiración del centro; centro por defecto = cénit), **Flash** (blanco/negro/invertir), y categoría **DOME** (uv centro = cénit del máster 1:1; usar en capa de ajuste para barridos full-dome): **Dome Rings** (anillos concéntricos viajando desde el cénit), **Spiral Twist** (torsión azimutal ∝ radio), **Tunnel** (remapeo radial con wrap espejado → vuelo sin costuras).
- [x] **UX:** tarjeta de efecto con selects Banda (+ Bright)/Modo (+ LFO)/forma+división LFO, botón INV, faders Attack/Release/Curve/Bounce, y **lámpara de señal en vivo** en la cabecera (muestra exactamente lo que "siente" cada efecto). Motor: fila **BPM** (auto detectado / clic → manual, 0=auto), medidor a **4 bandas** (+BRT) con **flash de onset** en el tope de cada banda y **punto parpadeante sincronizado a la rejilla de beat**. Menú de efectos gana la sección Dome.
- [x] Compat: proyectos viejos → fx sin campos nuevos usan los valores del motor en eval; `snapshot/restore/newProject/loadProject` limpian `_fxEnvCache`; bloom sin frag tolerado por el loop de compilación (custom apply); `freeFxResources` libera los RT de bloom.
- [x] **AUDITORÍA post-ronda (a petición del usuario), todo verificado por CDP en el `.exe`:** ✔ BPM 120 exacto en buffer sintético; ✔ undo NO congela la reactividad (restore→renderInspector recomputa); ✔ save/load v4 incluye `reactive` + campos meta de los fx (serMedia→serClip JSON profundo); ✔ cambiar Gain/Gate del motor invalida las envolventes por-fx; ✔ LFO funciona sin fuente de audio (BPM manual/120); ✔ visual: bloom produce halo real (px 18 vs 0, alpha extendido fuera de la silueta), rings modulan 29 columnas, tunnel desplaza, warp mueve 42px, flash blanquea, 0 errores GL; ✔ carril de automatización AR con efectos nuevos (5 params en bloom); ✔ tarjeta LFO oculta atk/rel/spring y deshabilita banda; ✔ `computeBands` ≈72ms por minuto de audio (75min ≈ 5-6s async, aceptable con aviso de estado). **2 bugs encontrados y corregidos:** (1) **thrash del caché de envolventes** — split/duplicate conservan `fx.id` → dos fx con mismo id y shaping distinto se pisaban la entrada (keyed por id) recomputando el array entero cada frame (con audio de 75min ≈ ms/llamada); fix: clave = `id+firma(banda|atk|rel|spring)` → coexisten, con tope 128 entradas + clear (drags de fader no acumulan memoria); los `delete(fx.id)` obsoletos eliminados (la firma en la clave hace innecesaria la invalidación). (2) **default de Attack en Trigger** incoherente: eval usaba 2ms pero el panel muestra el default del motor (8ms) para fx de proyectos viejos; alineado a `cfg.attack`.

## ROUND 75 — Arreglos de timeline (user) + fix de conexión NDI (TouchDesigner)
- [x] **La región de loop (`#workArea`) ahora abarca TODAS las pistas.** Antes su CSS `top:0;bottom:0` daba solo la altura del viewport (el contenedor `#tlscroll` con scroll), así que con más pistas de las que caben se cortaba. `renderWork` ahora fija `height = 22 + tracks.offsetHeight` (regla + todas las pistas), igual que el playhead. Además el handler de `scroll` de `#tlscroll` re-llama `renderWork()`+`renderTimeSel()` (seguro por si cambia la altura). Verificado con captura tras scroll al fondo: los bordes blancos del loop abarcan las 3 pistas visibles (V3/V2/V1). (El sondeo inicial confundía con una selección `#timeSel` residual — es de pointer-events:none, no sale en elementsFromPoint.)
- [x] **La barra de tiempo (regla) ya no queda tapada por las cabeceras de pista al hacer scroll.** El `.rulerpad` (esquina izquierda de la barra de tiempo, en `#trackHdr`) no tenía z-index, así que el `#laneHeaders` (que se desplaza con `translateY`) lo pintaba por encima. Fix: `.rulerpad{position:relative;z-index:2}` → se mantiene por encima.
- [x] **FIX de conexión NDI (crítico para TouchDesigner):** `recvOpen` conectaba solo por nombre → NDI re-resolvía la dirección y **fallaba con TouchDesigner** (`connections:0`, 0 frames), aunque el Test Pattern sí conectaba. Ahora busca la fuente completa en el finder persistente y conecta con su **`url_address`** directo. Verificado: TD pasó de 0 frames a **149 video/2.5s a 3840×2160**. (También se revirtió el timeout de 20ms del `recvRead` que se había probado — el fix real era el url_address.) **Pendiente:** TD envía **4K@60** y la tubería (copia swizzle + clon del contextBridge + subida GPU de 33MB/frame) va a ~4-14fps → optimización de rendimiento 4K queda para una ronda futura (SharedArrayBuffer no disponible: `crossOriginIsolated=false`; requeriría hilo de recepción en el addon + cabeceras COOP/COEP).
- [x] Verificado en el `.exe` (CDP): loop abarca las 5 pistas (982px = 22+960), `.rulerpad` z-index 2/relative, playhead sin regresión. Deployado a ambas instalaciones, 3029789 bytes.

## ROUND 74b — Entrada NDI a 60fps fluidos (user: "funciona pero no corre a 60fps")
- [x] **Causa:** el receptor entregaba de sobra (medido: 61 frames/s de una fuente 60fps en movimiento; el Test Pattern estático NDI lo throttlea a ~1fps, por eso engañaba), pero el pump hacía `recvRead`+`render` juntos en un `setInterval(16ms)` → (a) 16ms vs 16.67ms del frame = **aliasing** que salta frames, (b) render no alineado a vsync → judder.
- [x] **Fixes:** (1) swizzle [B,A,R,G]→RGBA como **rotación de 16 bits de la palabra de 32 bits** por píxel (auto-vectorizable, ~4× más rápido que byte-a-byte). (2) `ndiUpload` usa **`texSubImage2D`** (reusa el almacenamiento de la textura; sin realloc por frame). (3) el pump ahora **desacopla** recepción de dibujo: `setInterval(8ms, ~120Hz)` solo recibe+sube (inmune al throttle de rAF por `backgroundThrottling:false`) y marca `_ndiDirty`; **el render lo dispara un bucle `requestAnimationFrame` alineado a vsync** → 60fps limpios sin beat. Solo redibuja si hay un clip NDI en pantalla y no se está reproduciendo (durante play, el loop de reproducción ya dibuja).
- [x] Verificado en el `.exe` con una fuente 60fps en movimiento: **uploads 61/s, renders 57/s** (~60fps, antes había judder). Coste por frame: upload 2.85ms, render 0.5ms. Deployado a ambas instalaciones, 3029476 bytes.

## ROUND 74 — Entrada NDI: una fuente de red en vivo como medio → arrastrar al timeline (user)
- [x] **Fuente NDI en vivo como MEDIO** (`kind:'ndi'`): clic-derecho en Media → **"Añadir fuente NDI…"** escanea la red (`findSources`) y muestra un menú con las fuentes; al elegir una se crea un medio `NDI · <nombre>` con indicador **"en vivo"**. Se **arrastra al timeline como cualquier clip** y muestra el **frame actual de la fuente en tiempo real**, esté donde esté el playhead. Miniatura en vivo en el panel (actualizada ~1/s).
- [x] **Pipeline:** el addon nativo gana receptor: `findSources` (**finder PERSISTENTE** — acumula fuentes locales+red en background; un finder efímero por llamada solo veía las always-on), `recvOpen/recvRead/recvClose/recvCloseAll`. `recvRead` **drena la cola al frame más nuevo** (baja latencia) y devuelve RGBA empaquetado. En el renderer, `ndiPump` (**`setInterval` 16ms**, NO rAF — rAF se throttlea cuando la ventana no tiene foco; `backgroundThrottling:false` mantiene los timers) lee cada fuente, sube el buffer a la textura del medio con `upTexRaw` (RGBA crudo con FLIP_Y), y re-renderiza si hay un clip NDI en pantalla. `drawClip` usa `m.tex` sin cambios (rama `else` genérica).
- [x] **FIX de orden de canales (crítico para color):** `NDIlib_recv_color_format_RGBX_RGBA` entrega los bytes como **[B,A,R,G]** en NDI 6 (verificado con DOS fuentes independientes: mi emisor + el **NDI Test Pattern oficial**, ambas llegaban permutadas). El addon reordena a RGBA real en el copiado (`dp[0]=sp[2];dp[1]=sp[3];dp[2]=sp[0];dp[3]=sp[1]`). **La salida NDI (ROUND 73) NO tenía este problema** — su test era en escala de grises, que no detecta swaps de canal; su envío RGBA es correcto.
- [x] Serialización: `serMedia` guarda `ndiSource`; al cargar se recrea la textura y se reabre el receptor (`recvOpen`) + arranca el pump. `reloadMedia` salta los `ndi` (no hay archivo). `newProject`/`loadProject`/beforeunload → `closeAllNdi()`. Borrar el medio → `closeNdiMedia` (cierra el receptor si ninguna otra referencia lo usa). Trim libre (sin límite de fuente, como una imagen).
- [x] **Verificado end-to-end en el `.exe` empaquetado (CDP):** descubrimiento (vio "Test Pattern" y hasta un "Adobe Premiere Pro" en otra máquina de la red), medio creado, arrastre al timeline, **recepción en vivo 1920×1080**, y **colores correctos** — las 7 barras SMPTE muestreadas de la textura del clip decodifican a RGBA correcto (rojo=R-dominante, azul=B-dominante). Screenshot confirmó las barras de color en el domo. Deployado a AMBAS instalaciones, 3028649 bytes + `.node` desempaquetado.

## ROUND 73 — Salida NDI del máster Domo 1:1 (2048 / 4096), botón junto al pop-out (user)
- [x] **Botón NDI (`#ndiBtn`, icono `ndi`) junto al de ventana emergente**, en la barra del viewport. Abre un menú: **"Máster Domo 1:1 · 2048×2048"** / **"4096×4096"** (toggle on/off, ✓ en el activo) + "Detener salida NDI". Solo-escritorio (oculto si no hay `window.dsp.ndi`).
- [x] **La salida NDI es SOLO el máster Domo 1:1 limpio, sin grilla ni overlays.** `ndiTick` compone el fulldome (`composite(playhead, res, true)`, `_drawFlat=false`) en un **FBO propio** (`_ndiFBO/_ndiTex` a `res×res`), hace `readPixels` RGBA, y lo envía por el addon nativo con **stride negativo** (flip-Y sin copia: el buffer WebGL es bottom-up → NDI top-down). 2048 a hasta 60fps (fps del proyecto), 4096 a 30fps. La grilla/overlays viven en el canvas 2D `gridc`, aparte → nunca entran al máster.
- [x] **Addon nativo N-API propio** (`native/ndi-send/`, dep `file:` en `package.json`): `ndi.cc` + `binding.gyp` + headers del NDI 6 SDK **vendorizados** (`include/`). Carga el runtime NDI **dinámicamente** vía `LoadLibrary` de `Processing.NDI.Lib.x64.dll` hallada por la env var `NDI_RUNTIME_DIR_V6` (sin linkear el `.lib` → build sin SDK, y **degrada con gracia** si el runtime no está: el menú ofrece abrir la página de descarga). API: `available/runtimeUrl/start/sendFrame(buffer,w,h,flipY)/connections/stop/probe`. Fuente `RGBA` (FourCC), nombre "Dome Studio Pro — Master". N-API = ABI estable → el mismo `.node` sirve para Node y Electron.
- [x] **Arquitectura del pipeline:** el envío ocurre en el **preload** (tiene Node), expuesto como `DSP.ndi.*` por contextBridge → los frames se leen de la GPU y se envían DESDE el renderer, sin IPC de frames a main. `send_send_video_v2` síncrono (el buffer es válido durante la llamada), `clock_video=false` (marcamos el ritmo con un `setInterval`).
- [x] **Empaquetado:** `@electron/rebuild` (que ya corría en `electron-builder`) recompila el addon para Electron 42; `files` incluye `node_modules/dsp-ndi-send/{index.js,package.json,build/Release/*.node}` y **`asarUnpack`** el `.node` (los `.node` no cargan desde dentro del asar). **NUEVO gotcha de deploy: hay que copiar `app.asar` Y `app.asar.unpacked/` a cada instalación** (antes solo el asar).
- [x] **Verificado de extremo a extremo en el `.exe` empaquetado (CDP + receptor NDI externo):** addon cargado (`available:true`, sin loadError), botón visible, `startNDI(2048)` → `_ndiOn`, frames avanzando; un **proceso receptor SEPARADO** encontró la fuente "Dome Studio Pro" y **recibió frames reales a 2048×2048 Y a 4096×4096 (FourCC RGBA)**. **Orientación verificada** (gradiente conocido: image-top blanco → `topLuma` 254 arriba, `botLuma` abajo → derecho, no invertido). El flip por stride negativo es correcto.
- [x] Deployado a **AMBAS** instalaciones (LOCALAPPDATA + Program Files) — asar 3021830 bytes + `.node` desempaquetado en las dos. Install B verificado: addon carga (`available:true`), botón + funciones presentes. (Helper `deploy-ndi-to-programfiles.ps1` en el repo para futuros deploys elevados.)
- [x] Entorno confirmado: NDI 6 Runtime + SDK + Tools instalados, VS 2022 C++, Python 3.12, Node 25. Requisito de máquina de destino: el **runtime NDI gratuito** (ndi.video); si falta, el botón ofrece descargarlo.

## ROUND 72 — Scrub en números, rename inline de localizadores, import por clic-derecho + fps de secuencias PNG (user)
- [x] **Arrastrar sube/baja CUALQUIER `<input type=number>`** (diálogos, inspector de grupo, etc.), igual que los faders del inspector. Handler global capturante: arrastre horizontal cambia el valor (`Math.round(dx/3)*step`, Shift = fino ¼, Alt = grueso ×5, respeta min/max/step), un clic simple sigue enfocando para escribir. Cursor `ew-resize` (→ `text` al enfocar). Dispara `input`+`change` para que los `oninput`/`onchange` existentes reaccionen. Verificado: #cN 6→22 al arrastrar derecha, baja a la izquierda, clampa al mínimo, clic simple no cambia.
- [x] **Rename de localizador INLINE, sobre su propio texto en la regla** (no en un rectángulo/diálogo flotante): `renameLocatorInline(mk)` coloca un `<input>` `position:fixed` en la posición del label del localizador en la regla (`rr.left + mk.time*pps + 11`), commit con Enter/blur, Esc cancela. Reemplaza los 3 `appPrompt` (doble-clic en la regla, Ctrl+R, menú contextual). Verificado: el input aparece sobre la regla (no overlay modal), Enter renombra.
- [x] **Clic-derecho en el área de Media → menú Import** ("Importar medios…" / "Importar secuencia de imágenes…" / "Nueva carpeta"). Handler `contextmenu` en `#mediaList` (los ítems y cabeceras de carpeta conservan su propio menú).
- [x] **Import de secuencias PNG como vídeo con fps elegible**: las secuencias numeradas (`nombre####.png`, ≥3 frames) ya se detectaban y se importaban como clip `kind:'sequence'` (se comporta como vídeo); ahora, al detectarse, aparece el diálogo **"Import image sequence"** mostrando nº de secuencias/frames y un selector de **fps** (campo numérico + presets 12/24/25/30/50/60, default = fps del proyecto). `addSequence(files,name,fps)` usa el fps elegido (`dur=frames/fps`). Verificado: diálogo con presets que resaltan, fps=30 aplicado → clip secuencia de 5 frames, dur 5/30, kind sequence.
- [x] Verificación CDP en el `.exe`: 20/20 PASS. Deployado a ambas instalaciones, 2599211 bytes.

## ROUND 71 — Arreglos rápidos: densidad del Compose, carpetas de Media, marcadores de automatización, grilla del visor (user)
- [x] **Menú Compose sigue la guía de densidad**: inputs `19px` alto / `10.5px` fuente (antes 22px/11px); **checkboxes monocromos compactos** (`.modal input[type=checkbox]` `appearance:none`, caja 13px con check — antes se estiraban a 37px porque `.frow input{flex:1}` los alargaba; fix `flex:0 0 13px`); **preview más grande** (222px, antes 164px), modal 648px, columna derecha 236px. Verificado: input 19px/10.5px, checkbox 16px, preview 222px.
- [x] **Carpetas de Media funcionando** (antes: "crear carpeta" no hacía nada visible): las carpetas **vacías ahora se renderizan** (antes `grp()` hacía `if(!gi.length)return` → una carpeta nueva era invisible) con una zona **"Arrastra medios aquí"**; se puede **arrastrar un medio sobre la cabecera/zona de la carpeta** para archivarlo (`startMediaDrag` detecta `.folderhdr/.folderdrop` en el `up`, con resaltado `.dragover` al pasar por encima). Cabecera de carpeta con icono, contador, doble-clic para renombrar, botón/menú de eliminar (los medios se conservan). `newFolderBtn` evita nombres duplicados; clic-derecho lista las carpetas. Verificado: carpeta vacía visible + drop-zone, arrastrar archiva, contador actualiza, eliminar desarchiva.
- [x] **Automatización marca los parámetros ya automatizados (estilo Ableton)**: los dropdowns de parámetro de los carriles (`.aselect`, e ídem en Audio-React) anteponen **◆** a los params que ya tienen keyframes; en el inspector, la fila del parámetro automatizado se **resalta** (`.prow.auto .lab` más brillante + negrita). **Bug de paso encontrado y corregido**: `classList.toggle('auto', hasKf(...))` — `hasKf` devuelve `undefined` (no `false`) para params sin animar, y `toggle(x, undefined)` **invierte** en vez de forzar apagado (WebIDL trata `undefined` como "sin argumento force") → TODAS las filas quedaban marcadas; fix con `!!`. Verificado: solo los params con keyframes se marcan.
- [x] **La ventana del visor 3D tiene botón de grilla ON/OFF** (`#vwgrid`, overlay arriba-izquierda dentro de la ventana emergente; `_viewerGrid`, default OFF). `renderViewer` pasa `L3.grid=_viewerGrid?1:0`. Verificado: uniform 0/1 según el flag, el botón lo invierte.
- [x] Verificación CDP en el `.exe`: 17/17 PASS. Deployado a ambas instalaciones, 2593037 bytes.

## ROUND 70 — Revisión integral del sistema de automatización (user: "más robusto, intuitivo y fácil de editar")
_Auditoría multi-agente (5 lentes + 20 verificaciones adversariales, wf_ab2245cf-c2c): 18 bugs confirmados, 2 refutados, ~20 hallazgos UX. Todo lo de valor aplicado y verificado en el `.exe` (27/27 PASS)._

**Robustez (bugs confirmados corregidos):**
- [x] **Split inserta keyframe de frontera en el corte** (`razorCore`): antes filtrar los kf partía el segmento que cruzaba el corte → meseta plana + salto de valor justo en el corte. Ahora se inserta un kf en el corte en AMBAS mitades (valor exacto vía `evalP`); los segmentos **bezier se subdividen con de Casteljau** → forma de curva preservada exacta (desviación medida 6e-6). Los handles se copian en profundidad en `reb` (las mitades ya no comparten objetos hOut/hIn).
- [x] **Canvases de automatización VENTANEADOS al viewport** (`windowAutoCv`/`scheduleAutoCvs`, mismo patrón que el ruler y las ondas de audio): antes los sub-carriles y el overlay eran full-width → morían en silencio pasado el límite de 32767px de Chromium (¡en una peli de 75 min quedaban PERMANENTEMENTE en blanco a cualquier zoom!). Ahora ancho máx ≈ viewport+520px, reposicionados/redibujados al hacer scroll (`cv._ox`). Verificado: maxCvWidth 1360 a zoom 600px/s, `_ox` sigue el scroll.
- [x] **`c.anim` (modificadores de movimiento + wetKf) compartido por referencia** entre un clip y sus copias (split/duplicar/anidar) → editar la velocidad de uno cambiaba el otro (y el undo "arreglaba" el alias → heisenbug). `sepAuto` ahora lo copia en profundidad (arregla los 4 sitios de clonado de una vez).
- [x] **Cronómetro del inspector sin undo**: borrar TODA la curva de un parámetro (o añadir kf con el rombo) no era deshacible. Ahora `pushUndo()` + aviso "Automatización eliminada — Ctrl+Z la restaura" + guard "el cabezal está fuera de este clip" (antes creaba kf clampado a t=0 corrompiendo el primer keyframe, o kf inalcanzables tras el final).
- [x] **`state.autoSel` zombi**: la selección de puntos guardaba referencias vivas que morían tras undo/restore/cambio de secuencia → Delete se tragaba la tecla, empujaba un undo falso y podía caer al borrado del CLIP. Ahora se limpia en `restore`/`loadSeqIntoState`/`deleteSel`, y el handler de Delete valida contra los kf vivos (selección obsoleta → solo se limpia, nunca cae a borrar el clip).
- [x] **Snap de arrastre de puntos doble-contaba el delta** (snapeaba contra el k.t vivo que ya se había movido) → los puntos nunca aterrizaban en la grilla. Ahora snapea contra el tiempo de ORIGEN del drag. Una línea.
- [x] **`commit()` por pointermove hacía rebuild completo del inspector + render GL + doble invalidación** → jank. Ahora `refreshInspector()` (solo valores) + `scheduleGL()` (1 render GL por frame vía rAF) + `markDirty()` una vez.
- [x] **`drawAutoCurve` O(ancho×kf×26)**: el sampleo ahora es solo del slice visible con **caminata incremental de segmentos** (O(SS+n)), y culling de puntos/handles fuera del canvas; hover sin cambios visuales → no redibuja.
- [x] **Tolerancia de merge de `setKf` consciente del frame** (mín(0.02, 0.5/fps)): a 60 fps era imposible crear keyframes en frames adyacentes (se fusionaban).
- [x] **Borrar un Reactive FX purga sus huérfanos** (kf `fx:id:*`, `_autoOff`, `_arAuto`, `_arAutoH`): antes persistían en los guardados y el carril colgante se re-mapeaba EN SILENCIO a otro efecto. Ahora los keys colgantes se eliminan, nunca se remapean.
- [x] **`setAutoOff` congela el valor actual de la curva** antes de anular (como `manualEdit`) → la imagen ya no salta a un valor base obsoleto al pulsar "A".
- [x] **El canvas de automatización ya no se traga las herramientas Razor/Mano/Zoom** sobre el cuerpo del clip: con herramienta ≠ selección los eventos burbujean a `#tracks`.
- [x] Código muerto eliminado/reciclado: `setClipProp` borrado (0 llamadas); `curEase()` ya no lee un `#easeSel` inexistente; `kfAt` revivido (el rombo "añadir kf" del inspector se ilumina cuando el cabezal está sobre un keyframe); comentario "amber" corregido.

**Intuitivo (UX):**
- [x] **Clic en un punto ahora lo SELECCIONA (ya no lo borra)** — el clic-borra con radio de 18px era una trampa destructiva. **Alt+clic = borrar** (gesto rápido), Shift+clic extiende la selección, arrastrar = mover (cursor `move`, no `pointer`), Delete/menú borran. Marquee igual que antes.
- [x] **Menú contextual con easing por punto** (aplicado a la selección si el punto pertenece a ella): Lineal / Suavizar entrada / salida / ambos / **Mantener (hold, por fin alcanzable)** / **Bezier libre** (revive `initBez`). Antes NO existía NINGÚN control de easing en la UI (el dropdown global era una referencia muerta → todo nacía 'both' para siempre).
- [x] **Etiquetas en los carriles**: overlay del clip muestra el NOMBRE del parámetro (cada clip puede mostrar uno distinto — antes no había forma de saber cuál era); sub-carriles muestran escala mín/máx; **punto blanco + valor en el cabezal** en todos los carriles (readout permanente, no solo el tooltip al arrastrar).
- [x] **'+' abre un selector de parámetro** (◆ marca los que ya tienen keyframes; excluye los abiertos) en vez de añadir uno arbitrario.
- [x] **Editor numérico de punto con TIEMPO y valor** (doble clic; el tiempo en segundos absolutos como la regla).
- [x] **Clic en el fondo de un carril = marca de inserción** (modelo ROUND 64 preservado también en modo automatización) además de limpiar la selección.
- [x] Chip compacto en clips estrechos (<150px: sin dropdown) y bajado bajo la banda del título (ya no tapa el agarre de mover). Carriles Audio-React simétricos: botón ↻ re-activar añadido, clamp de resize 48px, tooltip ES completo. Tooltip del cronómetro consciente del estado ("Quitar automatización (borra toda la curva)"). Rombos del kfstrip con tooltip (nombre + tiempo). Menú "Volver al valor por defecto" ya no anuncia un atajo ⌦ falso.
- [x] `attachClipAuto`/`toggleCurves` ya NO mutan `c._auto` al renderizar (el default es de solo lectura) → pintar la vista no ensucia el proyecto ni los undo.

**Fácil de editar (poder):**
- [x] **Copiar/pegar curvas**: menú contextual "Copiar curva" (selección o completa) / "Pegar aquí"; **Ctrl+C** con puntos seleccionados copia la curva; **Ctrl+V** sobre un carril (hover) pega en el cabezal. Pegar entre parámetros de rango distinto **normaliza los valores** (blur 0-20 → opacity 0-100 escala, verificado 10→50).
- [x] **Nudge con teclado de la selección**: ←/→ = paso de grilla (Shift = 1 frame), ↑/↓ = 1% del rango (Shift = 0.1%); **Escape deselecciona**; **Ctrl+A sobre un carril selecciona todos sus puntos** (`state.hoverAuto`).
- [x] **"Simplificar curva"** (Ramer-Douglas-Peucker en espacio de píxeles; conserva siempre puntos hold/bezier) — para curvas densas grabadas del audio-reactivo. Verificado 30→<10 puntos.
- [x] Verificación CDP en el `.exe` real: 27/27 PASS (continuidad de split 50/50, bezier dev 6e-6, anim aislado, kf frames adyacentes, undo del cronómetro, autoSel limpio, canvases acotados+scroll, purga fx, freeze de override, copy/paste/scale/nudge/simplify, clic-selecciona, alt-clic-borra, guard de herramientas). Deployado a ambas instalaciones, 2585657 bytes.

## ROUND 69 — Botón "Adjust" (capa de ajuste) junto a Compose (user)
- [x] **Botón "Adjust" (`#adjLayerBtn`, icono `layers`) junto al botón Compose** en la toolrow del panel de medios (misma clase `.ringbtn` → respeta la guía de diseño; queda a la izquierda de Compose con 5px de gap). Llama a `addAdjustmentLayer()` (que ya existía, sólo estaba en la pestaña Reactive FX): crea una pista `ADJ` arriba del todo + un clip de ajuste seleccionado que aplica su cadena de FX reactivos al composite de **todo lo que tiene debajo** (estilo Premiere). Traducido EN/ES (`Adjust`/`Ajuste`) vía `applyLang`. Nuevo icono `layers` (pila de capas) en el mapa `ICO`.
- [x] Verificado en el `.exe` vía CDP: el botón existe, tiene el icono SVG, misma clase que Compose, misma fila, a la izquierda de Compose, misma línea base (gap 5px, Adjust 71px / Compose 87px); al hacer click añade exactamente **+1 pista + 1 clip**, el clip queda seleccionado con `adjust===true`, la pista superior lleva tag `ADJ`, nombre "Adjustment"; `undo()` revierte pista+clip por completo (snapshot incluye `lanes`). PASS. Deployado a ambas instalaciones, 2566317 bytes.

## ROUND 68 — La ventana emergente del visor 3D no muestra la grilla (user)
- [x] **El visor emergente (pop-out 3D dome) ya no dibuja la grilla de referencia, solo el contenido.** `renderViewer` pasaba `L3.grid = state.view.showGrid?1:0` (espejaba el viewport principal); ahora fuerza `L3.grid = 0` en su pase del domo (`P3`), independiente del ajuste del viewport principal. Un único cambio en [app.js:600](app.js:600).
- [x] Verificado en el `.exe` vía CDP: con la grilla del viewport principal **forzada a ON** (`state.view.showGrid=true`), el visor sigue renderizando contenido del domo (`contentSum` 183M, no-negro) y su pase recibe `grid=0` (uniform capturado). PASS. Deployado a ambas instalaciones (LOCALAPPDATA + Program Files), 2565732 bytes.

## ROUND 67 — La ventana emergente muestra el 3D dome con cámara propia (orbitable) (user)
- [x] **El visor emergente ahora renderiza SOLO el domo 3D con su PROPIA cámara** (`_viewerCam` {yaw,pitch,dist}), independiente del viewport principal (que puede estar en 2D editando). Arrastrar en la ventana = **girar** (orbit), rueda = **zoom** (dist).
- [x] **Implementación:** `cameraMVP` acepta `(spec, camOverride, aspOverride)`. `renderViewer(srcTex)` (llamado al final de `render()` con el `_srcTex` compuesto) renderiza el domo (`P3`) desde `_viewerCam` a un **FBO offscreen al aspecto de la ventana** (con depth renderbuffer), hace `readPixels`, y lo dibuja al canvas del visor con flip-Y (WebGL es bottom-up). Resolución de render capada a 1280px para el readback. Comparte la textura compuesta con el render principal (mismo playhead) → no recomputa el composite. Handlers de orbit/wheel/resize en el canvas del visor llaman `render()` (recalcula _srcTex + redibuja ambos). `closeViewerGL()` libera FBO/tex/renderbuffer al cerrar.
- [x] Verificado en preview (ventana simulada): `cameraMVP` con override da matriz 4×4 válida, el FBO se crea/dimensiona a la ventana, y el canvas del visor recibe **contenido no-negro** (el domo renderizado desde la cámara independiente muestreando el composite gris). Sin errores de consola.

## ROUND 66 — Ventana de visor emergente (segunda pantalla) (user)
- [x] **Botón "Pop-out viewer"** (`#popoutBtn`, icono `popout`, en la barra del viewport junto al zoom) que abre una **ventana nueva, movible y redimensionable, solo con el viewport del domo** — para arrastrarla a la pantalla de al lado (proyector/segundo monitor).
- [x] **Implementación (solo renderer + un handler en main.js):** `openViewerWindow()` hace `window.open('about:blank','domeViewer',...)`, inyecta un `<canvas>` a pantalla completa, y `updateViewerWindow()` (llamado al final de `render()`) copia el canvas GL principal (`glc`) al canvas del visor con letterbox (mantiene el aspecto del domo). Es **parent-driven** → el copiado corre en el loop del editor (con `backgroundThrottling:false`), así el visor va fluido aunque esté en la otra pantalla sin foco. `preserveDrawingBuffer:true` (ya estaba) hace `drawImage(glc)` fiable.
- [x] **`main.js`: `setWindowOpenHandler`** permite explícitamente `frameName==='domeViewer'` como BrowserWindow nativa (960², sin menú, fondo negro, sin throttling) y deniega cualquier otro `window.open`. Verificado en preview: botón + icono, funciones definidas, hook en `render()` sin throw, y la lógica de dibujo/letterbox de `updateViewerWindow` corre OK contra una ventana simulada (el `window.open` real lo bloquea el navegador del preview, pero Electron no tiene bloqueador de pop-ups → funciona en el `.exe`).

## ROUND 65 — Modo Seguir centrado + fixes de la revisión adversarial de ROUND 64 (user + review)
- [x] **Modo Seguir: el playhead queda SIEMPRE al centro y el timeline avanza gradualmente** (antes hacía page-scroll a saltos). `followPlayhead` ahora `scrollLeft = playhead*pps − vw/2`, y **crece el ancho del timeline con `_scrollTarget` (como `tlZoomAt`) antes de scrollear** para no chocar con el scroll infinito. Verificado: playhead en viewport-x 261 (=vw/2) constante, avanza 50px por 0.5s.
- [x] **FIX (review MAJOR):** Ctrl+L / botón Loop tras click en el cuerpo de un clip ya **no borra el bucle**. `loopSelection` solo limpia si `selA==null` (nada seleccionado); una marca de inserción sola avisa "selecciona un rango o clip" sin destruir el loop.
- [x] **FIX (review minor):** `play()` con una inserción fuera de una región de loop activa **la clampa** a `[workIn,workOut]` (antes saltaba fuera y `ploop` la reajustaba con un glitch). Verificado: inserción a 25 con loop 10–20 → play arranca en 10.
- [x] **Aceptado (review, por diseño del nuevo modelo):** los keyframes se crean en el **playhead** (no en la marca de inserción). El playhead se posiciona con la **regla** (scrub); la inserción es solo para el inicio de reproducción. Consistente con "el click no mueve el playhead".

## ROUND 64 — Insert-marker en vez de mover el playhead + play desde la selección + contraste de pista seleccionada (user)
_Revisión adversarial de 3 agentes sobre el nuevo modelo de interacción (interacción / regresión / estado)._
- [x] **Click en el timeline = marca de inserción fina (una sola pista), NO mueve el playhead grueso.** Revierte el comportamiento de ROUND 62. `startTimeSelect`: el click deja `selA=selB=t` en la pista clicada (línea `.timesel.insert` de 1px, sin relleno) y ya no toca `state.playhead`. El clip sigue seleccionándose solo por su banner `.tt`.
- [x] **Play arranca desde la selección/inserción si existe; si no, desde donde está el playhead.** `play()`: si `state.tl.selA!=null` → `playhead=min(selA,selB)` y reproduce desde ahí; si no, continúa donde estaba. Verificado: click a 4s + play → arranca en 4.03; sin selección + playhead en 2 → arranca en 2.
- [x] **Scrub en la regla limpia la inserción** (`selA=null`) y mueve el playhead → así "play desde donde está el playhead" funciona tras un scrub. **Ctrl+E corta en la línea de inserción** (no en el playhead): `splitAtSelection` maneja rango / inserción(zero-width, corta en selA sobre selLanes) / nada(playhead). Verificado: inserción a 5s + Ctrl+E → corte en 5, no en el playhead a 1.
- [x] **Contraste de pista seleccionada incluso con color:** `.lanehdr.sel` ahora lleva un contorno interior blanco (`box-shadow inset 0 0 0 1.5px`) que se ve sobre cualquier tinte; y el fondo tintado se **aclara** al seleccionar (`hexA(color, sel?0.34:0.16)`). Verificado: seleccionada 0.34 vs normal 0.16 + contorno.

## ROUND 63 — Color del clip seleccionado arriba del inspector (user)
- [x] **Barra de color arriba del inspector** (`#selColorBar`, 4px, ancho completo, justo bajo las pestañas): muestra el color del clip seleccionado = `laneTint(c)` (color de pista o el propio del clip). Click → abre el picker de color de la pista. Verificado: barra gris por defecto, verde al colorear la pista, **coincide exactamente** con el título del clip en el timeline; el click abre el popup.

## ROUND 62 — Color en el rectángulo de la pista + playhead al click + botón "seguir" (user)
- [x] **El color de pista tiñe TODO el rectángulo de la cabecera** (no solo la línea izquierda): `hd.style.background = hexA(lane.color, 0.16)` (nuevo helper `hexA`) + la barra izquierda a color pleno + nombre/tag coloreados. Verificado: header `rgba(224,149,75,0.16)`, V1 naranja completo, V2 azul completo.
- [x] **Click en cualquier parte del timeline (vacío O sobre un clip) coloca la línea blanca de playback** y la reproducción arranca desde ahí; el clip **solo se selecciona por su banner superior**. (Ya implementado en ROUND 60 vía `startTimeSelect(e)` sin selección; ahora se despliega.) Verificado: click en el cuerpo del clip → `playhead` línea a 240px, `selId=null`.
- [x] **Botón "Seguir" junto a Play** (`#followBtn`, icono de mira): activa `state.follow`; durante la reproducción `followPlayhead()` hace page-scroll del `#tlscroll` para mantener el cabezal a la vista (estilo Ableton). Verificado: alterna `state.follow`, el timeline scrollea cuando el cabezal sale de vista.

## ROUND 61 — FIX: los atajos con Ctrl no funcionaban (foco atrapado en un `<select>`) + Ctrl+E corta en la selección + Space = play (user)
_Diagnóstico empírico por CDP en el `.exe`: con un `<select>` enfocado, un Ctrl+E dirigido al select devolvía `splitAtSelection=0` (bloqueado por el guard `tag==='select'→return`), y hacer click en el timeline **no** quitaba el foco (`activeElement` seguía en SELECT). Resultado: tras usar cualquier dropdown del inspector, TODOS los atajos (Ctrl y Space) morían._
- [x] **Causa raíz corregida (2 partes):** (1) el guard del `keydown` ya **no** bloquea por `<select>` para combos Ctrl/Cmd ni Space — solo los inputs de texto siguen capturando teclas; un `<select>` enfocado conserva sus flechas/type-ahead pero deja pasar los atajos de la app. (2) Nuevo listener global `pointerdown` (captura) que **quita el foco** de cualquier `<select>/<input>` al hacer click en una superficie sin controles (timeline, visor, paneles), así el foco vuelve al body y los atajos siguen vivos. Verificado en preview: Ctrl+E con select enfocado → dispara; click en timeline → `activeElement` pasa de SELECT a BODY.
- [x] **Ctrl+E corta en la selección (Ableton).** Ya existía `splitAtSelection` (corta cada clip que cruza selA/selB en las pistas seleccionadas); ahora que Ctrl+E dispara, funciona. Verificado: clip de 8s con selección 2→5 → **3 clips** (0-2, 2-5, 5-8).
- [x] **Space = play/pause** confirmado (dispara incluso con un select enfocado; `preventDefault` evita que el select se abra). Verificado.

## ROUND 60 — Color de pista visible en header+clip + click en el cuerpo del clip = playhead (user)
- [x] **El color de pista se ve en la cabecera Y en el clip.** Además de la barra izquierda, el **nombre + tag** de la pista se pintan con `lane.color`; y los clips de esa pista se tiñen (título + cuerpo) vía `laneTint()`. Verificado en vivo: nombre, barra, título y fondo del clip todos en `#5B8DEF`.
- [x] **Click en el cuerpo del clip coloca el playhead** (línea blanca), igual que en área vacía — **sin seleccionar** el clip. El clip **solo se selecciona por su banner superior** (`.tt`); los handles de trim/fade siguen operando. Reestructuré el `pointerdown` de `#tracks`: razor/zoom actúan primero; cuerpo (no título/handle/fade) → `startTimeSelect(e)` (mueve playhead, no selecciona); título/handle/fade → selección + drag. Verificado: cuerpo → playhead t=3, `selId=null`; título → `selId=clip`.

## ROUND 59 — Diálogo de guardar centrado + toggle de proxy en el visor (user)
- [x] **El diálogo "¿guardar antes de cerrar?" aparece centrado.** `appConfirm` usaba `alignItems:flex-start` + `margin-top:130px` (pegado arriba) → quitados; ahora usa el centrado del `.overlay` (align/justify center, margin-top 0). Afecta a todos los confirmes (cerrar sin guardar, descartar cambios, eliminar pista/secuencia, aviso de MP4 grande). Verificado.
- [x] **Toggle de proxy en el visor**, junto a los botones Full/½/¼ (`#proxyToggle`, icono ⚡). `state.view.useProxy` (default on). `_vinstUrl()` ahora respeta el flag: con proxy **on** el decodificador por-clip usa `m.proxyUrl` (rápido); **off** usa `m.srcUrl` (clip **original** en el visor). Al alternar, `disposeAllVinst()` recrea los decodificadores con la nueva fuente + `scrubRender()`. NO afecta el export (que ya fuerza original vía `_exportQuality`). Verificado: botón alterna `useProxy`, sin errores de consola.

## ROUND 58 — 9 refinements sobre el pase monocromo (user, con fotos): tamaños/layout/color de pista/timeline
_Todos verificados en el preview antes de compilar (sin errores de consola)._
- [x] **Modal Compose de tamaño constante.** El panel de parámetros pasó de `min-height:312` (crecía con cada layout) a **`height:420px;overflow-y:auto`** → el modal mide **531px igual para Ring / Dome fill / Line / todos**. Además densidad: `.frow` margin 11→8 + inputs 24→22px, y el canvas de vista previa `border-radius` 8→2px.
- [x] **Barra izquierda más ancha por defecto** (262→**292px**) para que el botón **Compose** salga completo; defaults de workspace actualizados (media 292 / inspector 300).
- [x] **3D Dome abre en Orbit por defecto** (`state.view.three` `'spec'`→`'orbit'`; el segmento marca Orbit activo). En Viewer, los faders FOV/DOLLY ahora respetan el diseño (ver sliders).
- [x] **Sliders nativos finos y monocromos** (FOV, Dolly, Volumen, etc.): `input[type=range]` con `appearance:none`, riel de 3px sobre `#0A0B0D` y pulgar de 11px blanco — igual look que los faders `.prow`. Adiós al slider gordo del navegador.
- [x] **Inspector de audio con densidad correcta:** fader de Volumen fino (por el punto anterior), número 11→**10px**, inputs de fundido 74→64px + 10px.
- [x] **Ecualizador BASS/MID/TREB (Reactive FX) más alto** — el canvas `#arMeter` 34→**54px**, ya no se ve apretado.
- [x] **Opción de layout: inspector a alto completo.** Nuevo botón (icono panel-alto) en la cabecera del inspector: reparenta `#inspPane` (+`#gutterR`) entre `.mid` (estándar) y `#bodyRow` (abarca mid+transporte+timeline) → la **barra derecha se vuelve continua en vertical y el timeline se estrecha** para dejarle sitio. El gutter sigue redimensionándola (encoge el timeline). Persiste en `domeProWs`. Envoltorios permanentes `#bodyRow`/`#stageCol` (render idéntico en modo estándar). Verificado: inspector 51→483px (alto completo), timeline 1006→706px.
- [x] **Click en la grilla del timeline coloca la línea blanca (playhead).** `startTimeSelect` mueve el playhead al punto clicado en área vacía (antes solo aparecía al arrastrar una selección). Verificado: click a 240px → playhead t=3 (exacto).
- [x] **Color por pista.** Clic-derecho en la pista → **"Color de pista…"** abre un popup con 10 swatches + "Por defecto". El color se representa en la **barra de la cabecera** (su cuadro con el nombre) y **tiñe los clips de esa pista** (`laneTint()`; título con `textOn()` para contraste). Persiste con `state.lanes`. Verificado: swatch azul → `lane.color` set + barra actualizada + popup se cierra.

## ROUND 57 — Claude-Design density/type/color handoff, applied al pie de la letra (user delivered a `design_handoff_density_pass/` bundle: README + hi-fi reference prototype)
_A 100% visual pass — typography, layout/sizing, and color only; no functionality, selectors, IDs, or DOM structure changed (except the 3 permitted layout reorganizations). Implemented against the handoff README's exact values + reference prototype, then adversarially verified with a 4-agent audit (selectors / numeric-fidelity / leftover-hue / regression-risk)._
- [x] **Single UI family = Geist.** Dropped the Inter+JetBrains-Mono mix. Self-hosted `geist-400/500/600.woff2` (downloaded, offline-first like Inter). Every `.mono`/timecode/numeric field → `font-family:Geist` + `font-variant-numeric:tabular-nums` (no monospaced font). Inter kept only as fallback + for user text-clip content. Base `body` 11.5→**11px**. All canvas `ctx.font` `'JetBrains Mono'`→`'Geist'`.
- [x] **Strict 18px control grid.** ONE interactive height = **18px** for `.seg/.vseg/.filtseg/.groupseg/.editseg/.togbtn/.togbtn2/.selsel` + icon buttons `.ibtn` 18×18. Bars/structure to the handoff table: `.top` 36→**28**, `.vptool` 30→**28**, `.transport` 42→**30**, `.panhead` 40→**26**, `.ruler` 26→**22**, `.rulerpad` 26→**22**, `.trackhdr` 158→**152**, media pane 284→**262**, inspector 328→**300**, `.toolrail` 36→**32** (buttons 28→24), `.playb` 32×30→**30×22**, value box 18→**16px** / pad 0 5. Inline inspector/modal inputs 26→18/20. Everything squared to **2px** radius. `button{padding:0}` reset (handoff's icon-centering fix).
- [x] **Monochrome color system.** Removed EVERY hue — accent blue, teal, project gold, audio/status greens, amber/red meters, comp purple/orange — remapped by role to a neutral gray scale: active `.on` = `#454C55` bg + `#FFFFFF` text; fader fill / playhead = white / `#F2F4F6`; selection/clip-sel/seqtab-active/lanehdr-sel = `#C9CDD3`; play primary = `#3A4047`. `TRACK_COLORS`/`CLIP_COLORS` → grays; audio clip title `#B4BAC1`; waveforms/meters/curves/keyframes/markers/lane-drag indicator/dome+safe guides all neutralized (canvas `fillStyle`/`strokeStyle` value-only). Text/contrast bumped per handoff. The **RGB parade scope** (histogram of real R/G/B channels) is the sanctioned color exception; user-content defaults (`#fff` text, `#000` stroke) untouched.
- [x] **3 permitted layout reorganizations** (markup, ids/handlers preserved): (a) media type-filters + group-filters merged into **one** segmented row (GROUP label kept but `display:none` — `app.js txt('#groupLbl')` still resolves); (b) **Compose** moved to its own right-aligned action row so it never clips; (c) media-header **T** and **▭** glyphs → inline SVG (line+stem / `<rect>`) for identical centering; plus seq-tab full 2px radius on all 4 sides and `.zoomgrp` restyled to a bordered 18px segment like `.vseg`.
- [x] **4-agent adversarial audit** (ultracode): **selectors PASS** (every id/class/data-* app.js relies on still present — ~110 ids verified), **fidelity PASS** (every handoff number matches), **regression PASS** (textOn() contrast holds on the new grays → readable clip titles; all canvas font strings valid; no color used as data-key/comparison; layout/hit-test dims unshrunk; `button{padding:0}` safe). **Color lens found 17 leftover hues** in app.js chrome that used hexes OUTSIDE the handoff's replacement table (purple duration-chip `#4A3F6E`/label `#C9C0F0`, blue anim-chips `rgba(143,178,246)`/badge, gold keyframe-selection `#FFD24A`+marquee, green proxy dots `#4BCF87`, red danger button `#7A2B28`, navy logo `#0A1430`, + blue-cast panel darks `#161922`/`#1B1F29`/`#0C1116`/`#151B22`/`#1E2430`/`#2E3440`) — **all neutralized**.
- [x] **Ruler geometry coherence fix** (caught by the regression lens): CSS `.ruler` shrank to 22px but `app.js` drew the ruler canvas at hard-coded 26px → 4px canvas bleed over track 1 + playhead-height off-by-4. Migrated the whole ruler draw to 22px coherently (canvas height, tick Y-coords, marker line, cache-map strip 23.5→19.5, `_tlH` 26→22). Now CSS 22 / canvas 22 / rulerpad 22 all aligned.
- [x] Verified in-browser: Geist loaded & applied, all handoff numbers match computed styles, ruler paints clean at 22px, tabs/3D/Reactive FX functional, **zero console errors**. `node --check app.js` OK; zero leftover hues on final sweep.

## ROUND 56 — Followable track-drag + deeper density/square pass (user: "el drag debe ser ordenado y fácil de seguir; botones/textos más chicos, sin bordes redondeados")
- [x] **Track drag-reorder made clearly followable.** While dragging a header: a **full-width glowing insertion bar** spans the header column through the timeline right edge (snaps between tracks), the dragged header **lifts** (blue outline + drop shadow + dim), a **name chip follows the cursor**, and the cursor becomes `grabbing`. Verified: indicator + chip appear, clean up on drop, clips follow.
- [x] **Deeper density + fully square.** All chrome `border-radius` 3/4/5px (and the `4px 4px 0 0` / `5px 5px 0 0` tab corners) → **2px** — squared to match Ableton. Toolbar/transport controls trimmed: `.togbtn`/`.togbtn2` 28→24, `.tbtn` 30→26, `.playb` 37×34→32×30, `.ibtn` 26→24, `.mbtn` 30→26, `.pantab`/`.tcbox` 30→26, `.editseg` 28→24, `.seqtab` 11→10.5; button fonts 11.5/12→11. Verified in-browser: tighter + squarer, transport/panels intact, no console errors.

## ROUND 55 — Ableton-density pass + track reorder + Ctrl+E split + automation UX (user, with Ableton screenshot reference)
_Structured with a 4-agent design audit (density / automation / timeline / radius) vs Ableton Live 12, implemented + verified in-browser._
- [x] **Global density + square corners.** Shared row/control CSS tightened to Ableton proportions: `.prow` 4→2px pad, gap 8→6; `.field` 22→20px; `.track` 4→3px; `.box` 20→18px / 56→52 min; `.lab`/`.num` 11.5→11px; `.kf` 22→18px; `.sechead` 9→6px; `.selsel` 30→22px + radius 3→2; `.clip` radius 3→2. Reactive-FX cards: radius **6→2px**, header/body paddings shaved, band/mode selects 24→20px, footer buttons 30→24px. This tightens the inspector AND the Reactive FX panel.
- [x] **Effect-card header buttons fixed** — the "big white buttons out of place": now **16px square muted icon buttons** (grip / power / collapse / trash) with a subtle hover bg; the power toggle is a soft blue (#8FB2F6) when on, not a bright beacon.
- [x] **Track drag-reorder.** Dragging a lane header vertically reorders `state.lanes` and remaps every clip's `c.lane` (handles the top-down display reversal; live drop indicator; click still selects). Verified: dragged lane moves, clips follow.
- [x] **Ctrl+E = Split** (Ableton) — razors every clip crossing the time-selection boundaries (or the playhead if no range), restricted to the selected lanes; **Export moved to Ctrl+Shift+E**. `razorClip` refactored into a reusable `razorCore`. Verified: a 2–5s selection over two clips → 4 cuts.
- [x] **Automation editing UX.** Point grab-zone widened 12→18px (handles 7→10); breakpoints drawn bigger (idle 4 / hover 6) with a **pre-click hover ring**; new **double-click-a-point inline value editor** (framed field + focus ring, Enter/Esc) — and `.numedit` restyled from frameless floating text into a real bordered field. Verified: dbl-click sets an exact value.
- [x] **Audio-React "símbolos raros" fixed** — root cause: `↻`/`✕` glyphs fall outside the latin-subset woff2 → tofu. Replaced with SVG `refresh`/`close` icons; suppressed the native `<select>` arrow (`.aselect` appearance:none + inline SVG chevron). The choosers now read clean **"RGB Split" / "Intensity"** names (Ableton-style). Verified.
- [x] **Review pass (12-agent, 5 confirmed & fixed):** (1) **HIGH** — the `.aselect{appearance:none}` change made the *regular* automation param dropdowns lose their arrow entirely (the `.autochip/.autohdr .aselect` `background:` shorthand reset the chevron image); fixed by switching to `background-color` + a `padding-right` gutter (verified chevron back). (2) command-palette Export badge `⌘E`→`⇧⌘E` + the Split entry now maps to Ctrl+E/`splitAtSelection`. (3) Export button tooltip `Ctrl+E`→`Ctrl+Shift+E`. (4) split status i18n (`n+' '+cut/cuts/corte/cortes`, no double-space, singular/plural). (5) effect-card button hover was dead (inline `background:none` beat the CSS) — moved base bg/border to CSS so hover highlights work.

## ROUND 54 — Reactive-FX aesthetic polish (user: "botones que no encajan; el formato de automatización está medio extraño, igual de intuitivo que los efectos del inspector")
- [x] **Effect cards** now use real app icons: a **grip** (new `grip` icon) to drag-reorder, a bare **power toggle** (new `power` icon — blue when on, grey when bypassed) replacing the checkbox-looking `●/○` box, and clicking the effect **name** collapses/expands. Chevron + trash kept.
- [x] **Transport buttons** de-golded to match the app convention: **Audio React** now uses a distinct **`react`** waveform icon (vs Automation's `curves`) and the neutral togbtn styling (accent only when active); the **Add Adjustment Layer** button dropped its custom gold too.
- [x] **Audio-React lane header redesigned** — the two choosers were cramped illegibly into the ~130 px lane header; now the **Effect** dropdown and **Parameter** dropdown stack vertically (full-width, legible), with the A/+/✕ controls inline under the parameter, and the AR lane has a taller floor (48 px) so both rows fit. Reads like Ableton's device/param chooser and is as tidy as the inspector rows. Verified in-browser (icons, stacked dropdowns, toggle/collapse/param-change all work; no console errors).

## ROUND 53 — Audio-React automation timeline (Ableton-style effect+param chooser) + Fase-2 review fixes (user)
- [x] **Separate "Audio React" transport button** next to "Automation". Automation stays exactly as before (inspector params only); Audio React shows a SECOND set of lanes covering ONLY the reactive-fx params (keys `fx:<id>:<param>`). Each lane has an **Ableton-style pair of dropdowns — one for the EFFECT, one for its PARAMETER** (Intensity / Reactivity + the effect's own params) — plus arm/add/remove/resize. Clicking the ⏱ stopwatch on any effect fader in the Reactive FX panel arms that param and reveals its lane here.
- [x] **Unified fx-param automation with the render.** `evalP` now resolves fx-key bases ('fx:<id>:<param>' → the fx object) and `evalFxParam` delegates to it, so the automation CURVE == the rendered value. `drawAutoCurve`/`bindAutoCurve` generalized via `paramDef`/`paramBase`/`setParamBase` (label/range from the effect def; baseline drag writes back into the fx object). Verified: a 0→50→100 intensity curve drives the strobe gray→white; dual dropdowns list the right effects (2) + params (5).
- [x] **Fase-2 review fixes (12-agent adversarial pass, 3 confirmed & fixed):** (1) **fx deep-copied** on split/duplicate/drag-copy/nest (was a shared array reference — editing one half corrupted the other; verified split → independent arrays); (2) **`loadProject` id-reseed now scans `fx[].id`** (top-level + nested) so post-load `uid()` can't collide with a saved fx id and break fx-keyed lookups (wiring/drag/keyframes/GL history/collapse); (3) **`_fxCollapsed` keyed by clip+fx** (+ cleaned on delete) so duplicating a clip with FX doesn't cross-contaminate collapse state.
- [x] **Second adversarial pass on the Audio-React code (10-agent, 4 confirmed & fixed):** (1) the shared curve `commit()` now `raInvalidate()`s + `markDirty()`s so editing ANY automation curve (regular or AR) refreshes the viewport under render-ahead (was a latent bug for regular automation too); (2) **`addArAutoLane` now picks a free effect·param** instead of blindly pushing a duplicate lane key (duplicate lanes shared height/arm/curve state); (3) the **v3 back-compat load branch** now folds `fx[].id` into its own id-reseed (the earlier fix ran before v3 sequences were in `state.media`); (4) **`sepAuto()` deep-copies the automation UI-state arrays** (`_auto/_autoH/_autoOff/_arAuto/_arAutoH`) on split/duplicate/drag-copy/nest so editing a copy's lanes no longer mutates the original. All verified in-browser (dedup int→amt→block, independent arrays after split/duplicate, curve→render).

## ROUND 52 — Reactive FX, Fase 2: pro UI + effect library + Adjustment Layer (user: "diseño pobre; reorden con drag; params desplegables; efectos pobres sobre todo glitch; falta la capa de ajuste")
- [x] **Panel redesigned to match the app.** The Reactive FX panel now uses the inspector's own controls: **app-styled faders** (the `.field`/`.track`/`.box` drag-scrub — shift=fine, alt=coarse, dbl-click to type) for the Audio Engine (Gain/Gate/Attack/Release) AND every effect parameter — **zero `<input type=range>`**. Same sechead sections, `.selsel` dropdowns, `.kf` stopwatch, icons.
- [x] **Effect cards**: **drag-to-reorder** by a grip handle (live drop indicator; ▲▼ buttons removed), **collapsible** params (chevron per card, `_fxCollapsed` set), app-styled on/off **bypass** toggle (`.ms`), name, remove. Disabled cards dim.
- [x] **Effect library ×16, categorized** (Add Effect menu grouped Distort / Stylize / Color / Feedback): **Glitch (rewritten** — block jumps + big tears + RGB, block-quantize, line dropout, scan noise), **Datamosh** (directional feedback smear), **Slice**, **Pixelate**, **Kaleidoscope**, **Mirror** (5 modes), **Wave**, **Zoom Blur**, **Edge** (Sobel), **Posterize**, **Scanlines/CRT**, **Strobe**, **RGB Split**, **Hue Shift**, **Trails/Echo**, **Feedback Zoom** (infinite tunnel). All license-clean, our own GLSL. Verified: all 16 compile + alter the frame, no GL errors.
- [x] **Adjustment Layer** (Premiere-style). New clip kind `c.adjust` (no media): `makeAdjustClip`/`addAdjustmentLayer` drop it on a new top lane spanning the work area. Render: `drawAdjustment` snapshots the composite-so-far (everything drawn below), runs the clip's FX chain on it (`applyChain`), and mixes it back by the layer's **opacity** (wet/dry) via a new `PMIX` program. Runs inside `composite()` so it inherits export + nests for free. Inspector = opacity + a pointer to the Reactive FX tab; timeline shows a gold hatched block; not dome/flat-pickable; trim already treats media-less clips as unlimited. Button in the Reactive FX panel. Verified: strobe on the adjustment layer whitens the gray layer below; opacity 50%→187; bypass restores; serializes (`adjust:true`, fx preserved).

## ROUND 51 — Audio-reactive FX engine, Fase 1 (user: "resolume/touchdesigner audioreactivo a la pista que yo elija")
_Research first: Ghost Arcade (AGPL) / glitchGL (non-commercial) rejected for licensing; adopted the ISF *concept* (shader + params + audio inputs) and wrote our own permissively-clean GLSL. Built in phases; this is Fase 1. Fase 2 = Adjustment Layer + "Audio React" timeline filter button + Kaleidoscope/Mirror + more effects._
- [x] **Offline per-band analysis (deterministic).** `computeBands(ab)` renders the audio through an `OfflineAudioContext` (16 kHz) split by biquad filters into **bass / mid / treble**, extracts a per-frame RMS envelope (90 fps), normalizes to the 98th percentile, and reuses `detectBeats` for onset times. Stored on `m.bands`; analyzed on import (`armMediaBands`) and lazily when a source is picked. Because it's precomputed + time-addressed, **preview and export are frame-identical** — no export/quality hit.
- [x] **Reactive config + eval.** `state.reactive` = {source clip, Gain, Gate, Attack, Release}. `arRecompute()` bakes a **causal attack/release one-pole** (+ gain/gate) into smoothed per-band arrays (deterministic — no per-frame filter state). `bandLevelAt/onsetLevelAt` sample them; `fxIntensity = clamp(baseIntensity + reactAmount·mod)` where `mod` = the band envelope (Follow) or a decaying beat spike (Trigger). Every value automatable via compound keyframe keys `fx:<id>:<param>` through a standalone `evalKf` (mirrors `evalP`).
- [x] **GPU post-process chain (ping-pong FBO).** New `_ppVAO` + per-effect programs (`ppCompile`, `a_p`→loc 0). `applyChain(inputTex,size,host,t)` runs an ordered, reorderable list of passes on the clip texture **before** dome/2D placement (so it's projection-agnostic and works in both). Runs only when a clip has enabled FX (existing projects = zero overhead). Effects v1: **RGB Split · Strobe · Glitch/Datamosh · Trails/Echo (feedback buffer) · Zoom-blur** — each with creative params + band + Follow/Trigger + intensity + reactivity.
- [x] **Model + hooks.** `makeClip` gains `fx:[]`; `drawClip` runs `applyChain` on `ntex`; `serProject/loadProject` persist `state.reactive` (fx chains ride along in `serClip`'s deep copy). Export path (`renderExportFrame`→`composite`→`drawClip`) inherits FX automatically at full res.
- [x] **UI.** Right inspector panel gains tabs **Inspector | Reactive FX** (`#insReactive`). Reactive FX = Audio Engine (source dropdown, live 3-band meter, Gain/Gate/Attack/Release) + a reorderable **effect-card chain** (on/off, ▲▼ reorder, remove, band+mode selectors, Intensity w/ keyframe, Reactivity, per-effect params) + **Add Effect** palette.
- [x] **Bugs found & fixed during verify** (browser CDP): (1) shared frag header declared `u_prev` → every effect flagged `needsPrev`; scoped it to Trails only. (2) `_ppRT`/`_fxHistFor` internally bind FBO/textures — calling them *after* setting the draw target/units clobbered both → the pass drew to the default framebuffer and sampled the (black) history as input. Fix: **allocate RT + history first, bind the FBO and texture units last, right before the draw.**
- [x] Verified in-browser end-to-end: strobe white/black flash; RGB Split & Glitch alter the frame; **bass envelope drives intensity** (gray→white as the ramp rises); **beat-trigger** spikes on onsets; **works in flat 2D**; **FX bake into the export render path**; disabled chain = byte-identical to no-FX (no regression); UI tabs/cards/reorder/meter all functional; no console errors.
- [x] **Adversarial multi-agent review (15 agents) → 8 hardening fixes** applied + re-verified: (1) **GPU-memory leak** — `_fxHist` feedback textures/FBOs now freed via `freeFxResources()` (newProject/loadProject), `freeFxHistFor()` (clip delete), `freeFxHistOne()` (effect remove); (2) **reactive-inside-nest** — the audio term now samples a global `_arTime` (top-timeline time) instead of nest-local time, so FX on nested clips still follow the top-timeline source; (3) **export/render-ahead determinism** — `fxResetHistory()` clears feedback buffers at export + prerender start; (4) **feedback vs render-ahead cache** — `anyFeedbackFx()` skips caching frames when a Trails effect is active (scrubbing no longer bakes wrong echoes); (5/6) live FX/Gain slider drag + async band-analysis completion now `raInvalidate()` the render-ahead cache; (7) **undo** now snapshots/restores `state.reactive`; (8) `_arCache` cleared on sequence switch (loadSeqIntoState) so no phantom reactivity across tabs. Known Fase-1 limitation (documented): the reactive source is a single project-global clip ref, so it is live only in the sequence that owns that audio clip (per-sequence reactive config = Fase 2).

## ROUND 50 — 2D (flat) project mode: normal rectangular video editing (user)
- [x] **Whole new project type.** A sequence gains `mode:'dome'|'flat'`; flat = a rectangular canvas at a chosen W×H (default 1080p, custom W×H field). The entire timeline/nests/automation/blend/FX/masks/audio/keyframes stack is projection-agnostic and reused unchanged — only the dome fisheye projection is swapped for a straight rectangle.
- [x] **Rendering.** New `u_flat` branch in the warp vertex shader `VSW` places a clip as a **rotated rectangle** (`center + a_flat·axes`) inscribed in the square composite with a **uniform scale** (no skew, rotation-safe); `FSW` (all FX/mask/blend) reused verbatim. The blit shader `PB` got a flat path (`u_flat`/`u_uvsc`/`u_uvof`) that skips the dome disc-clip and samples just the rectangular region, aspect-fitted to the window (preview) or filling W×H (export). `_drawFlat`/`_compAspect` set per-composite (top + per-nest). Verified: a 16:9 clip fills the full width, letterboxed top/bottom.
- [x] **Model + UI.** `newSeqMedia(mode)`, `serMedia.mode`; landing **"New 2D project"** button + resolution dialog (`flatResDialog`); the `+` new-sequence dialog gains a Dome/2D toggle; format chip shows W×H. Clip transform swaps to **Pos X / Pos Y / Scale / Rotation** (`TF_FLAT`), header relabels to "Transform"; dome-only controls hidden in flat (3D Dome, Horizon, Fulldome-src toggle, az/el readout, `updModeUI`).
- [x] **Viewport interaction.** Rectangular **frame + thirds + safe** guides (`drawFlatFrame`), selected-clip **rect outline**, and **click-pick + drag** to move clips (`pickClipFlat`/`pix2frame`, `elemFlat` drag → x/y).
- [x] **Export at W×H** (still/PNG/MP4/H.265): `renderExportFrame` extracts the flat rect into a non-square `glc`; codec/mux dims = seq W×H; dialog shows `W×H px` + a sane area-based default bitrate. Verified: 1920×1080 clip fills the whole 1080p output (no letterbox); dome export unchanged.
- [x] Verified end-to-end in-app and confirmed **dome mode fully intact** (disc renders, az/el/size inspector, no regression). No console errors.

## ROUND 49 — Ruler white-out at high zoom + scrollbar-corner square (user, 2 minor bugs)
- [x] **Ruler goes solid white at high zoom.** `#rulerCv` was sized to the FULL content width (`dur*pps`) — at high zoom that exceeds the browser's max canvas area and the canvas blanks to white. New `drawRuler()` sizes the canvas to the **visible viewport window** (positioned at `scrollLeft`, drawn in content coords via a `−scrollLeft` transform), draws only visible ticks/markers, and is re-run on horizontal scroll. `#ruler` element stays full-width so the sticky pointer-math (playhead scrub) is untouched. `drawCacheMap` updated for the same offset. Verified: content width 4.8M px → ruler canvas capped to 1103px, within limits, ticks present, not white, follows scroll; normal zoom still correct.
- [x] **White square, bottom-right of timeline** = the `::-webkit-scrollbar-corner` (h+v scrollbars meet) had no rule → defaulted to white. Added `::-webkit-scrollbar-corner{background:transparent}`.

## ROUND 48 — High-detail zoomable waveform + the TWO-INSTALL bug (user: "waveform pauperrima… ver transientes al acercar; y sigue el recuadro")
- [x] **Two installs found.** The rectangle "persisting" was a deployment bug: there are TWO installs — `%LOCALAPPDATA%\Programs\dome studio pro` (which I was updating) and a stale **`C:\Program Files\Dome Studio Pro`** (07-05 22:26, pre-outline-guard). The user's shortcut launches the Program Files copy → old code → rectangle + coarse wave. Fix: deploy every build to **both** locations. Proof the code was fine all along: same clip draws 0 outline px as audio, 792 as video.
- [x] **Sample-accurate, visible-window waveform.** The old `drawClipWave` built a canvas at the FULL clip width — at high zoom that blows past the canvas size limit and loses all detail. New `drawAudioWaveInto`+`redrawAudioWaves` render **only the visible slice at screen resolution**, re-drawn on scroll/zoom (`scheduleWaves` on `#tlscroll` scroll + at end of `renderTimeline`). When the visible window is small it reads **min/max/RMS straight from the AudioBuffer** (crisp transients); when zoomed out it aggregates the peak/RMS cache. Cache resolution raised to ~120 buckets/s (was 44).
- [x] **Single-sided (Premiere-style) toggle** in the audio inspector (`state.tl.waveTopHalf`). Volume-scaled; live-updates on the volume slider.
- [x] Verified in-app: dynamics visible (loud 68px / silent 2px / medium 34px); a 3 ms transient zooms into a sharp 13-column spike; zoomed canvas = visible window (843px, not full clip); centered symmetric vs single-sided bottom-anchored; no console errors.

## ROUND 47 — Real audio waveform (peak + RMS) (user: "no muestra el waveform real en el timeline")
- [x] **Root cause:** `computePeaks` stored only max-abs peaks at 1200 buckets. A mastered/loud track peaks near 1.0 almost everywhere → the timeline waveform rendered as a near-solid green block with no visible shape.
- [x] **Fix:** new `computeWave(ab)` computes per-bucket **peak AND RMS** at duration-aware resolution (~44 buckets/s, up to 24k). `drawClipWave` (timeline) and `drawWaveInto` (inspector) now draw a **dual envelope**: a light peak outline + a bright **RMS body** that reveals the actual dynamics (intro/drops/quiet sections). Amplitude scales with per-clip volume. `addAudio` + relink store `m.peaks`+`m.rms`; not serialized (recomputed on load).
- [x] Verified: synthetic loud/quiet/medium clip → RMS 0.66 / 0.09 / 0.37; rendered waveform 50 px tall in loud vs 8 px in quiet (real shape, not a block).
- [x] **Deploy note:** the earlier "still broken" was **5 stale processes** kept alive; the single-instance lock re-focuses an old window instead of launching the new build. Fix = kill all instances, relaunch.

## ROUND 46 — Audio clips have no dome presence (user: "el clip de audio no debiera visualizarse con un rectángulo en el canvas")
- [x] **No dome outline for audio.** `drawOutline2D` now returns early when the selected clip is audio (`m.kind==='audio'`), so a selected audio clip no longer draws the blue dashed rectangle in the 2D/viewport (it has no visual — it's only sound). `pickClip` also skips audio, so audio can't be grabbed/selected in the dome. Verified: outline-blue pixels 0 with Outline ON + audio selected; audio not pickable.
- [x] Note: the ROUND 45 audio inspector (waveform + Volume + fades) is present in both source and the installed `app.asar` — the earlier "still not showing" was a **stale running instance** (old JS in memory); a full quit + relaunch loads it.

## ROUND 45 — Audio: auto-track, per-clip volume + fades, real waveform, independent copies (user)
- [x] **Drag audio → auto audio track.** Before, dropping audio with no audio lane silently failed (drop rejected) or fell back to a *video* lane. Now `addClip`/drag-drop **auto-create an audio track** to hold it (`startMediaDrag` accepts an audio drop anywhere over the timeline).
- [x] **Per-clip volume.** New `props.volume` (0–200 %, default 100). Applied live in preview via a **per-clip `GainNode`** (`startAudio` now builds source→gain→master, envelope in absolute ctx time so a mid-clip start lands at the right gain), baked into export (`exportAudioMix` multiplies by `vol`), and tweakable during playback (`liveAudioGain`). Volume also scales the drawn waveform for instant feedback.
- [x] **Real waveform in the track.** `computePeaks` already builds a true max-abs envelope; `drawClipWave` now renders it sharper (DPR-scaled) and volume-scaled. Audio clips get a **dedicated inspector** (`buildAudioInspector`): waveform preview + **Volume** slider + **Fade in/out** — the dome Transform/Effects/mask/blend/motion are hidden for audio (`#secTf`/`#mirrorWrap`/`#secFx` toggled, `#insAudio` shown).
- [x] **Independent copies.** Audio was already per-clip at the buffer level (each clip → its own `BufferSource`); confirmed and hardened: `collectAudioEvents` now tags each event with the clip `id` + `vol`, so copies play, fade and mix **independently**. Verified in-app: auto-lane 0→1, inspector switches to the audio panel, volume 50 % → mix event `vol 0.5`, two copies → **2 events, distinct ids**, waveform renders 9130 px. No console errors.

## ROUND 44 — Duplicated video clips play independently (user: "el playback de cada video está siempre igual… siempre se ven sincronizados")
- [x] **Per-CLIP video decode.** Root cause: one `<video>` + one GPU texture per MEDIA can only hold ONE frame at a time, so every clip that pointed at the same source showed the SAME frame (copies looked permanently "synced", especially when overlapping). Each **drawn** video clip now gets its own private `<video>` decoder + texture (`_vinst`, keyed by clip id) sampled by `drawClip` — copies decode independently in **preview, playback AND export**, including inside nests and across same-media crossfades (which used to freeze the outgoing copy).
- [x] `collectDrawnVideoClips` mirrors `compositeClips` (per-clip, not per-media; descends into active nests; includes crossfade pairs) and drives every path: `scrubRender`, `play`/`ploop` (per-clip rVFC pump + pause of off-screen decoders), `seekExport`, render-ahead. Nothing is stored on the clip object → serialize/undo/save untouched.
- [x] Lifecycle: instances are lazily created for drawn clips, LRU-capped (`VINST_MAX=32`), GC'd on edit (`reconcileVinst` in `renderTimeline`) and wiped on new/open project + after export (`disposeAllVinst`). Export binds instances to the **original** source (`_exportQuality`), preview to **proxy-if-ready**.
- [x] Verified end-to-end in-app: built a real 2 s ramping-red MP4 (WebCodecs muxer), placed two overlapping copies at local **1.0 s** and **0.2 s**, seeked, and read back each clip's private texture → **distinct decoders + textures**, red **130 vs 23** (Δ107): the two copies now show **different frames** (before: identical). No console errors; app state left clean.

## ROUND 43 — Line = full diameter + "Scroll ↕" infinite-strip motion (user)
- [x] **Line compose is always full width** (edge → zenith → opposite edge) regardless of the old flip toggle: `compLayout('line')` now maps every element onto the full dome diameter (`s∈[-1,1]`, az flips 180° across the centre). Verified: 7 elements → el `1/30/60/90/60/30/1`, az split 180°/0°.
- [x] **Diameter wrap in `drawClip`**: a linear `el` scroll now rises over the zenith and descends the far side, reappearing at the opposite dome edge (identity for normal el∈[0,90], so nothing else changes). `{p=((el%180)+180)%180; el=p<=90?p:180-p; if(p>90)az+=180}`.
- [x] **New "Scroll ↕" motion preset** (`el` linear) + a **Scroll (Infinite strip)** checkbox + °/s (signed = up/down) in the Line compose dialog. Turning it on gives each line element a scroll modifier → the whole line reads as an **infinite strip appearing/disappearing at the edges**. Verified: an element scrolls low→high→over-zenith→far-side→opposite-edge→wraps back to the origin edge; every inner element got the scroll; preset present in the Motion chips.

## ROUND 42 — "Make unique" for nest/compose clips + keyframeable dry/wet per motion (user)
- [x] **Make unique** (right-click a nest/compose clip → "Convertir en único"): `makeClipUnique` deep-copies the nest media (`serMedia`→JSON clone, fresh ids for the media, inner clips and `comp`, masks rebuilt) and re-points only that clip to the copy, so its parameters (compose layout, inner clips) can be edited **independently** of the other instances. Verified: two clips shared a nest → made one unique → editing the copy's comp count (6→10) left the original at 6.
- [x] **Keyframeable dry/wet per procedural motion**: each modifier gets a **Mix (0–100%)** multiplier on its offset, keyframeable so the user decides **when a motion ramps in** on the timeline. `evalWet(c,a,t)` (real playhead time, own `a.wetKf` keyframes, default `a.wet`); `animOffset` multiplies each contribution by the clamped wet. Motion rows are now 2-line cards with a Mix slider + a ◆ keyframe toggle (`animToggleWetKf`/`animSetWet`), synced to the playhead via `refreshMotionWet` in `refreshInspector`. Verified: wet keyframes 0@0s→1@2s give wet 0/0.5/1 and gate a 90°/s spin to 0°/45°/180° (ramps in over 2 s), persists in the clip.

## ROUND 41 — Dome fill: randomize media order (user: "clips shouldn't always be ordered")
- [x] New **"Randomize (shuffle media)"** checkbox + **↻ reshuffle** button in the Dome fill (domegrid) dialog. When on, a multi-media dome-fill assigns media to the grid cells in a **stable shuffled order** instead of sequential `i%n`. `ensureCompOrder`/`compMediaIndex`: distributes each media ~evenly then Fisher–Yates shuffles the positions, storing the map in `comp.order` so re-renders/edits stay put; ↻ (or toggling on) forces a fresh reshuffle (`_orderR`). Persists in the comp (`shuffle`/`order`). Verified live: off → `ABCABC…`; on → randomized (e.g. `ACCBACBBAACB`) with each media appearing exactly 4×/12 cells.

## ROUND 40 — Start screen (New + Recents) + styled dialogs matching the app (user)
- [x] **Landing / start screen** on launch instead of dropping straight into an empty comp: full-screen styled overlay (`showLanding`, z-index 300) with the app logo, **New project** + **Open project…** buttons, and a **Recent projects** grid (cards with thumbnail + name + relative date, click to reopen). Recents persist in `localStorage` (`domeProRecents`, cap 12), updated on every save/open (`addRecent` with a small JPEG `projThumb()` of the dome). Dismissed by New / Open / opening a recent / a double-clicked `.rdome` (`loadProject`+`openProjectPath` call `hideLanding`). Recents shown only in the `.exe` (browser can't reopen by path). Verified live: overlay + buttons + empty-state render, New dismisses, recents store/read.
- [x] **In-app styled dialogs** replacing native `confirm`/`alert` (which don't match the theme): `appConfirm(msg,cb,{ok,cancel,danger})` and `appAlert(msg)` reuse the `.overlay`/`.modal`/`.togbtn2` look. `confirmDiscard` is now an async styled confirm; refactored callers (`newProject`/`openProject`/`openProjectPath`/`restoreAutosave` → async-await, `removeLane`/`deleteSequenceMedia`/big-MP4-warning → callback). All `alert()` → `appAlert()` (save/open/export/audio errors). Only the WebGL-context-loss alert stays native (fires during a GPU reset while the app reloads).
- [x] **Close-confirm styled too:** the unsaved-changes guard on window close no longer uses the native OS `dialog.showMessageBoxSync`; main.js sends `dsp:confirmClose` → renderer shows `appConfirm` → `DSP.forceClose()` (new IPC) closes on confirm. (OS file open/save pickers stay native — those are OS-owned and can't be themed.)

## ROUND 39b — "Cull" repurposed into a useful "Horizon fade" (user: "cull does nothing")
- [x] Verified empirically that the old **Cull** toggle was a no-op: rendered a clip crossing the horizon with cull on vs off → **pixel-identical** (the dome projection already sends below-horizon content outside the visible disc, so discarding it earlier changed nothing). User confirmed it felt dead.
- [x] Repurposed the button (with the user's pick) into **Horizon fade**: softly fades content in the outer band of the dome (the spring line) to avoid a hard bright ring at the horizon — a real fulldome need. Implemented once in the shared blit `FSB` (2D view **and** the export downsample) and in the 3D dome `FS3`, driven by `state.view.hfade` + `u_hfade` (band `HFADE=0.14`). `renderExportFrame` unified to always go through the FBO→PB blit so the fade bakes into stills/video at any resolution (ss=1 or 2). Button relabelled Cull→**Horizon** (data-d `cull`→`hfade`), command palette + i18n updated. Verified live: fulldome disc edge goes from a hard circle (off) to a smooth fade-to-black (on); no shader/console errors.

## ROUND 39 — Playhead spans all tracks + always-visible ruler triangle (user: line cut at 4 tracks, no top triangle)
- [x] The playhead (and snap guide) were `position:absolute; top:0; bottom:0` inside the fixed-height `#tlscroll`, so their height was capped at the visible ~4-track area and got "cut" once more tracks were added. Now `renderTimeline` sets `#playhead`/`#snapline` height to **26px (ruler) + `#tracks.offsetHeight`** → the line spans the ruler **plus every track** (incl. inline automation sub-lanes), regardless of count.
- [x] The downward **triangle handle** moved from a `::before` on the line (which scrolled away / sat under the ruler) to its own `#phTri` element **inside the sticky `#ruler`**, so it's **always visible** at the top; `positionPlayhead` moves it with the line. Verified live: 7 tracks → playhead height 600px (26+574), triangle present/visible and tracking the cabezal.

## ROUND 38 — Procedural infinite motion (Unreal-style Rotator / Translator), keyframe-independent (user)
_User wanted automatic looping animation (a ring spinning forever, things drifting and wrapping around) that's simple, drag-and-drop, independent of keyframes, and applies to clips/stills/comps/tiles._
- [x] **Motion modifiers.** New per-clip `c.anim=[{param,mode,speed,amp,phase,on}]`. `mode:'linear'` = a continuous ramp (Rotator/Translator: `value += speed·t` forever — angular params wrap seamlessly); `mode:'wave'` = sine oscillation (pulse/sway/flicker). Evaluated **on top of** the base/keyframed value at render time only via a new `evalR()` (renderer-only) — so it never bakes into the editable value (`evalP` stays base). Driven by absolute timeline time → **deterministic + correct in export**; a live-preview clock (`_previewClock`, rAF `motionTick`) advances it in the paused editor so the composition visibly breathes (toggle "Live", default on; auto-runs only when active anim exists; paused-only, cancels on play).
- [x] **New `spin` prop = rotate around the dome zenith.** Fulldome clips (nests/compositions/dome stills) rotate the **whole disc** via a new `u_spin` in `VSFD` (vertex-side uv rotation — exact under interpolation); gnomonic clips fold spin into `az` (orbit); sector/dome-tiles rotate their `azC`. So a **Spin** on a ring/dome-fill composition spins the entire thing; on a single image it orbits/spins.
- [x] **Presets (chips): Spin, Orbit, Bob ↕, Sway ↔, Pulse (size), Wobble (roll), Flicker (opacity).** Inspector "Motion" section: click a chip to add, or **drag it onto a timeline clip / the dome viewport**. Each modifier row = on/off · param (Rotate/Orbit/Elevation/Size/Roll/Opacity) · mode (Loop/Wave) · speed (°/s or Hz) · amount · delete. A **↻ badge** marks animated clips on the timeline. Opacity/size clamped so waves stay in range.
- [x] Verified live (preview): shaders compile clean; **Spin advances continuously** (30°/s → cross `+` renders as `×` at 45°, `_previewClock` accumulates, disc rotates in-shader); **Orbit drives az** (24°/s·2s = 48°) while the base `az` stays 0 (never baked); the 7 preset chips + modifier rows build in the inspector; no console errors. Persists automatically (plain data in the clip → save/load/undo). Export stays deterministic (`exporting` flag → uses frame time).

## ROUND 37 — Export quality, dome-fill gaps, open-by-doubleclick, 4K MP4 (HEVC), perfect circle mask, perf meters, alt+scroll (user bug list)
_Reviewed the diagnostics log (RTX 4060, ANGLE/D3D11, maxTex 16384, WebCodecs OK, zero GL/JS errors — confirmed the export problem is render quality, not a crash). Fixed the whole list; verified the visible ones live in the preview._
- [x] **Export quality (root cause).** Nest/composition FBOs were hard-coded to **COMP=2048**, so every dome-fill / ring-grid was rendered at 2048² then upscaled onto a 4K/8K dome → soft "pauperrima" stills *and* video. Added `nestSize` (COMP for preview; set to `min(res·SSAA, GL_MAX, 8192)` during export) — `nestSlot()` reallocates pool textures to that size, `prepNests` composites at it, and it's reset + `freeNestPool()` on export end. Also bumped `MAX_IMG` 4096→`min(8192, GL_MAX)` so originals stay crisp for 4K–8K. Verified the new path is live; nests now render at full export resolution.
- [x] **Dome-fill black dots/zenith hole.** Three causes: (1) the default elevation range was 10–60° → the **zenith was never covered** (the black "glass" hole in the center). Dome-fill now defaults to **0–90°** (full horizon→zenith); the top ring caps to the centre. (2) The default rectangular **edge feather** (`smoothstep` at `|v_flat|→1`) zeroed alpha exactly at every tile edge → thin black seams between sectors. New `u_tile` uniform skips the edge feather (and the mask aspect-correction) for annular-sector tiles so they abut at full alpha. (3) `rho` clamped `≥0` in the sector shader so a top ring reaching the pole caps cleanly instead of flipping past 90°, plus a 0.6° bleed on seamless sectors. Verified live (screenshot): 3×10 dome-fill fills the whole disc to the centre, no hole, no black seams.
- [x] **Open a saved project.** Added an **Open** button in the top bar (Ctrl+O → `openProject()`), plus **double-click `.rdome`** file association: `fileAssociations` in package.json (NSIS registers it), and main.js handles the path from `process.argv` (Windows), `second-instance` (single-instance lock), and `open-file` (macOS), sending it to the renderer (`dsp:openPath` → `openProjectPath`).
- [x] **4K MP4 (H.265/HEVC).** H.264 via WebCodecs/NVENC returns `null` at 4096² on this GPU (measured) — that's why 4K MP4 "didn't let you export". Added an **MP4 · H.265 / HEVC** codec option (`pickHevcCodec` probes hvc1/hev1 × levels 6.2→3.1; mp4-muxer `codec:'hevc'`). Verified in-engine: `avc 4096 → null`, **`hevc 4096 → hvc1.1.6.L186.B0` (works)**. HEVC tops out at 4096² here (6144/8192 → PNG sequence); validateRes guards per-resolution and the estimate shows H.265 + bpp.
- [x] **Perfect circle mask + resizable.** The circle was evaluated in square flat-space → stretched to the clip's 16:9 (ellipse). Now mask coords are **aspect-corrected via `u_half`** (inscribe a true circle in the short angular edge), and a new **`u_maskScale`** + a "Mask size" inspector slider (20–200%) resizes the mask. Applied to circle/rounded/diamond/vignette (FSW) and the fulldome path (FSFD). Verified live: 16:9 clip → round circle; slider shrinks/grows it.
- [x] **CPU / RAM / GPU meters.** Bottom status bar shows live usage (`#statPerf`, ~1.5 s). main.js `dsp:metrics`: CPU% from `app.getAppMetrics()` normalized to cores, RAM = app working set, **GPU% + VRAM via `nvidia-smi`** (cached; silently off on non-NVIDIA). Browser fallback shows JS-heap RAM. Verified live (browser shows "RAM N MB").
- [x] **alt+scroll resizes all tracks.** Timeline wheel handler: `altKey` grows/shrinks **every** lane height together (×1.1 / ÷1.1, clamped, un-collapses). Verified live: 82→90→…→68 across all 4 lanes.
- [x] Answered the user's questions in chat: import formats (browser/WebCodecs codecs — H.264/VP9/AV1/MP4/WebM/MOV/PNG/JPG/WAV…; **HAP/ProRes/H.265-in-MOV not decodable** by the web stack → transcode to import); ProRes export not available in WebCodecs (HEVC is the high-quality/4K path; PNG sequence = lossless master + alpha); export **is** GPU-accelerated (NVENC) and that's the right approach.

## ROUND 24 — Render/encoder quality (user: "renderé MP4 y salió muy baja calidad pese a alto bitrate")
_Investigated the full export path methodically and measured in the live preview. Findings: the pipeline is fundamentally correct — export uploads the **original full-res** frame (`seekMedia(...,useOrig=true)` → `m.originalEl`, not the proxy), re-composites the dome at the chosen `res` directly to `glc` (preview `compSize`/quality is bypassed), and the **encoder honors the bitrate** (measured: complex content under VBR hit ~140% of a 40 Mbps target; CBR 86%). So softness was NOT the encoder ignoring bitrate. Two real causes addressed:_
- [x] **2× Supersampling (SSAA) for MP4 export.** The fisheye warp samples clip textures with plain `LINEAR`/no mipmaps, so high-res footage warped onto the dome **aliases** (shimmer/jaggies) — which both looks soft *and* wastes bitrate on high-frequency noise (why "more bitrate didn't help"). Added `renderExportFrame(t,res,ss)`: renders the dome into an offscreen FBO at `ss×res` (`exportSS()` picks ss=2 when `2·res ≤ min(GL_MAX_TEXTURE_SIZE, 8192)`, else 1) and box-downsamples to `res` via the existing circular-mask blit (`PB`). FBO is freed after export. Verified: valid MP4, correct dims, decodes, export not broken; ss=2 for res ≤ 4096 (GL max here 16384).
- [x] **Resolution/fps-aware bitrate + bpp meter.** The old default 120 Mbps at 4096²/60 is only **0.12 bits/pixel** — genuinely starved for 4K60, so it looks soft no matter what. `suggestBitrate(res,fps)` targets ~0.18 bpp (clamped 16–800): 2048²/30→23, 3072²/30→51, 4096²/60→181 Mbps. The export dialog now auto-fills this (unless the user edits the field), an **Auto** button resets to it, the max was raised 400→800, and the Estimate line shows live **`X.XX bpp · ●●● High / ●●○ Good / ●○○ Low — raise bitrate`** so a starved setting is visible. Encoder also set `latencyMode:'quality'` (kept VBR — it allocates generously for complex frames).
- [ ] _Note: could not reproduce the user's exact result without their footage; these address the most likely causes. For an absolutely lossless master, PNG sequence (up to 8192²) remains the reference path. Possible future: optional output dithering to kill 8-bit gradient banding on dark dome skies._

## ROUND 33 — Full-audit fix pass (29-agent audit → fixed the confirmed bugs + medium concerns + improvements)
_Ran an exhaustive 12-dimension adversarial audit (118 findings, 16 confirmed high bugs, 20 improvements). Fixed across batches, each verified live; a second 13-agent workflow re-verified the fixes._
- [x] **Export/data/crash (critical):** audio inside a **nest** now plays + exports — new recursive `collectAudioEvents` (absolute-time flatten, front-trim, window-clip, per-level mute/solo) drives both `startAudio` and `exportAudioMix`. `pause()` + ploop loop-wrap guard `m.el` (missing-media no longer throws). Autosave writes a **light** copy (`_serLight` drops `maskData`/`_elB`/`_szB`) and always surfaces failure (no one-time gate; clears the stale key on quota error). `saveProject` + main `dsp:writeText` now try/catch and alert on write failure. Global keyboard shortcuts bail when a `.overlay` modal is open. MP4 export in Electron now uses a native **Save dialog → `dsp:writeBinary`** (new `dsp:saveFile` IPC) instead of a silent Downloads drop, and surfaces write failure. `getContext('webgl2')` null → clean message instead of a hard crash; context-loss schedules a **fallback reload** (1.8 s) so a real GPU reset that never fires `restored` still recovers.
- [x] **Blend modes (visual):** unified final blend in FSW+FSFD — `ef=mask·opacity·fade`; screen/multiply RGB now weighted by `ef` (masks/feather **work**, and multiply opacity math is now correct `mix(dst,dst·col,ef)`); darken/lighten blend toward an operator-neutral value by `ef` (white for MIN, black for MAX) and out-of-crop is `discard`, so masked/transparent/opacity-0 pixels **leave the destination unchanged** (was: blackened the whole quad). New `u_blend`/`BLEND_ID`. **Fulldome path gained mask+feather** (the nest path forces fulldome, so nested comps can now be masked). Verified by readPixels: darken/lighten/multiply exact; opacity-0 & masked preserve destination.
- [x] **Nests/sequences:** per-clip nest render via a leak-free **per-frame texture pool** (`_nestPool`) so the same nest on two clips at different local times renders two different frames (was last-prep-wins); transitive **cycle guard** (`seqReaches`) blocks A↔B loops; `deleteSequenceMedia` re-heals the `state.clips ⇄ nestClips` alias; nest-clip trim limit uses live `seqDur(m)`; `prepNests` depth cap aligned to 5.
- [x] **Timeline:** **left-trim now rebases keyframes** (from a drag-origin `kf0`, idempotent) so automation stays anchored; razor drops the inner fades at the cut (no phantom mid-clip fades); lane mute/solo/collapse/resize now `pushUndo` (undo no longer silently reverts them); multi-select trim/fade already applied per-clip.
- [x] **Media/playback:** `_raVidFrame` guards `c.inP||0` (no NaN frame); `adopt()` relinks by name **+ size** (then name-only) to avoid wrong-file relink; bin-delete frees the `VideoDecoder`; audio **reschedules on external seek** during playback (`ploop` detects a playhead jump > 0.06 s → `startAudio()`).
- [x] **Improvements:** resolution dropdowns in ascending order (3072 before 4096); "Sequence N" + Loop-button tooltip (+Ctrl+L hint) translated; compose empty-state uses in-app `flashStatus` not native `alert`; transport secondary counter seeds `0f` (was `1.1.0`); transient `_elB/_szB` stripped from saves.
- [x] **Second pass — cleared most of the deferred list:** (1) **A/V drift** — `ploop` now slaves the playhead to the AudioContext clock while audio plays (`state.playhead=_audioHead+(actx.currentTime-_audioBase)`, anchored in `startAudio`), eliminating multi-hour drift; falls back to rAF `dt` when no audio. Verified: no-audio playback still free-runs. (2) **Large-MP4 RAM** — export now warns (confirm) when the in-memory MP4 would exceed ~1.8 GB, pointing to PNG-sequence (disk-streamed). (3) **Orbit DIST slider** — on-screen zoom control in orbit mode (`#distCtl`, synced with the wheel). (4) **No-op undo** — `pushUndo` deferred until a move/trim/fade actually changes something (a plain click no longer pollutes history). Verified: click→0 undo, real move→1. (5) **Double-serialization** — v4 saves no longer duplicate the active sequence's clips/markers/groups at top level (they live in its nest media), halving the heaviest on-disk data. Verified round-trip.
- [x] **Third pass — cleared 3 more:** (1) **temp/tint** is now a white-balance **gain** (`col*=vec3(1±u_tmp,1,1∓u_tmp)` etc.) — **neutral at 0** (projects without tint unchanged) and no additive highlight crush; verified by readPixels (neutral 128/128/128, warm R↑B↓, cool B↑R↓). (2) **FX edge halo** — blur/glow taps now zero-weight samples outside the (cropped) source (`step()` bounds mask) instead of pulling clamped edge texels. (3) **Render-ahead nested video** — `raPrerenderRange` decodes via `collectActiveVideos` (descends into nests) so cached frames no longer bake a stale nested-video frame.
- [x] **Fourth pass — MP4 streams to disk (last audit item).** Added random-access fd IPC (`dsp:fileOpen`/`fileWriteAt`/`fileClose` in main.js, exposed in preload.js). The MP4 export now uses `Mp4Muxer.StreamTarget` (`fastStart:false`) when running in Electron: each muxer `onData(data,position)` chunk is written straight to the file via a serialized async write queue with backpressure (encode loop stalls when `pending>4`), so RAM stays bounded (~tens of MB) instead of buffering the whole multi-GB file. Browser keeps the `ArrayBufferTarget` fallback; the >1.8 GB RAM warning now fires only on the non-streaming (browser) path. **Closed the verification gap with Node:** proved `StreamTarget`+position-writes reconstruct a byte-identical MP4 vs `ArrayBufferTarget` (incl. the non-monotonic mdat-size backpatch), and end-to-end `StreamTarget → fs.writeSync@position → file` is byte-identical too. The only unverified piece is the standard IPC plumbing (mirrors the working `writeBinary`).
- [ ] _Still deferred (deliberate, low-value defense-in-depth only): IPC path allowlist + GPU reg-add-once on a local single-user tool. Everything else from the audit is done._

## ROUND 36 — Export Still + diagnostics session log (user) · + language rule
- [x] **Language rule (memory):** Beltrán is NOT Argentine — no voseo/argentinisms in chat OR in UI/artifacts; software in English, Spanish = neutral Castilian (buttons in infinitive). Saved to memory `language-style.md`. Audited app strings: source clean (already uses "Guardar"/"Exportar"/"Cancelar"); only `node_modules` noise matched the voseo grep.
- [x] **Export Still (PNG):** new codec option in the Export dialog. Renders ONE frame at the playhead from the **original media** (`seekExport`→`seekMedia(...,true)`) with **SSAA** (`renderExportFrame`), saves a PNG via the native Save dialog (Electron) / download (browser). No audio mix. Estimate line shows "res² PNG · 1 frame (full quality)". Verified: valid 87 KB PNG, ss=2.
- [x] **Diagnostics session log:** `DIAG` ring buffer + `diag(level,tag,msg,extra)`. Auto-captures: session header (UA, Electron, GPU via WEBGL_debug_renderer_info, MAX_TEXTURE_SIZE, screen), `window.error`/`unhandledrejection`, wrapped `console.error/warn` and `alert`, a 2 s `gl.getError` check (`glCheck`), a 5 s heartbeat (active seq, clip/media counts, playing, playhead, JS heap), the `flashStatus` trail, and key actions (clip add/delete, transport, export start/done). In Electron it **auto-appends to `%APPDATA%/Dome Studio Pro/dome-diagnostics.log`** (IPC `dsp:diagWrite` truncate-then-append; survives a crash) so it can be read back after a test; flush on 5 s tick, on error, on `beforeunload`, and on tab-hide. Command palette: **"Save diagnostics log…"** (`saveDiagLog`) for on-demand export. Verified live: session/heartbeat/clip-add/synthetic-error all captured and formatted.

## ROUND 35 — "Dome fill" tiled layout: stacked rings to creatively fill the dome (user)
- [x] **New `domegrid` compose layout** — stacked tiled rings in ONE composition. Controls: **Rings** (concentric bands), **Segments** (per ring), **Elev. range** (coverage; up to 90° = converge at zenith = "infinite"), **Ring gap** / **Seg gap** (° separation; 0 = continuous/seamless), **Offset** (brick — alternate rings shifted half a segment), + multi-media (segments cycle the chosen media). `compLayout` lays out rings×segs (capped 160) annular sectors with per-element `_secAz/_secEl`; `compElProps` reads those (and keeps centers exact — also fixed a sub-degree seam in the plain ring-tile). `drawComposePreview` renders the real sector grid live. Count field hidden for domegrid (derived = rings×segs). Added to the dialog and the inspector compose panel.
- [x] Verified live: 3×10 dome fill renders the full segmented dome (horizon→zenith, screenshot); gaps narrow the sectors (sep works), brick shifts odd rings by half a segment, coverage→90 reaches zenith, and the domegrid nest round-trips (rings/segs/inner `warp:'dome'`).

## ROUND 34 — Perfect rings: annular-sector "dome tile" warp mode (user: ring clips cut diagonally where they overlap)
_Root cause: clips render as **gnomonic tangent patches** (a flat rectangle placed tangent to the dome at az/el, warped to fisheye). Flat rectangles don't tessellate on a sphere — adjacent ones overlap with slanted seams (the "diagonal cuts"). Reference domes build rings from **annular sectors** that follow the dome's az/el grid, so they tile seamlessly. Not a bug in our warp — a different, complementary projection intent._
- [x] **New `warp:'dome'` (annular sector) mode.** `VSW` gains a sector branch: `a_flat.x→azimuth span`, `a_flat.y→elevation band`, placed directly on the fisheye disc (`rho=(π/2−el)/(π/2)`, `ndc=rho·(sin az,−cos az)`) — matches `dirAzEl`. Uniforms `u_sector,u_azC,u_azSpan,u_elC,u_elSpan`; the gnomonic path is byte-identical when `u_sector=0`. The 120-subdiv mesh + unchanged `FSW` mean all FX/mask/grade/blend still apply. Per-clip props `warp/secAz/secEl` (default `patch`/60/30).
- [x] **Compose "Seamless tile" + Band.** Ring/grid get a **Tile** checkbox; ring adds a **Band (°)** field. `compElProps` gives each element `warp:'dome'`, `secAz=360/count` (ring) or grid cell spans, `secEl=band` → N sectors tile the full 360° with no gaps/overlap. Stacking tiled rings at different elevation bands builds the segmented dome grid from the references. The dome schematic (`drawComposePreview`) draws real annular sectors when tiling.
- [x] Verified live: 8-sector tiled ring renders a seamless annulus (radial seams to zenith, concentric arcs — screenshot), multi-media + tile round-trip (tile/band/inner `warp:'dome'`/`secAz` survive save/load), and default clips stay `patch` (gnomonic unchanged); shader compiles clean.

## ROUND 33+ — Compose dialog rework: multi-media + Line layout + fixed layout (user)
- [x] **Fixed layout, preview pinned right.** The Create/Edit composition modal is now a two-column flex (582px): controls left (fixed `min-height` so the box doesn't jump as per-layout rows show/hide), live dome **preview on the right**. Long media filenames no longer overflow — the Media control is a scrollable checkbox **list** with per-item ellipsis (`.cmedialist`/`.cmname`, full name on hover).
- [x] **Multiple media per composition.** Media is now multi-select (checkboxes); `comp.mediaIds[]` cycles across the composed elements (element i → `mediaIds[i % n]`). `createComposition`/`regenComposeNest` build each nest clip from its assigned source; `mediaId` kept = first for back-compat. Verified: 4-element ring over 2 media → clips cycle A,B,A,B and survive save/load (mediaIds + per-clip mediaId round-trip).
- [x] **New `line` layout.** A line of elements crossing the dome, with a **"Rotate 180° through center"** toggle: ON = full diameter through the zenith (az flips 180° at center, el 0→90→0 — verified az [180,180,0,0,0] / el [0,45,90,45,0]); OFF = a straight radial line at one azimuth, el spanning the Elev. range (stays in place). Added to the dialog, the inspector compose panel, and `kindES`.

## ROUND 32 — Inline rename + multi-clip trim/fade + compose-in-inspector + compose schematic (user, 4 items)
- [x] **Inline rename (edit in place, no floating dialog).** New `inlineEdit(el,value,commit)` makes the label `contenteditable` where it lives (Enter commits, Esc cancels, blur commits). Wired into `renameLane` (the `.nm` in the lane header), the clip-name branch of `renameSelection`/Ctrl+R (the clip `.tt`), and `renameSequence` (the tab `.seqlab`, tabs now carry `data-seq`). Guards added so editing doesn't trigger drags/shortcuts: `#tracks` pointerdown, lane-header click/dblclick, seq-tab click all bail on `e.target.isContentEditable`; the global keydown handler ignores contenteditable. Each falls back to `appPrompt` if the element isn't found. Verified: rename commits on blur, Esc cancels.
- [x] **Multi-clip trim & fade apply to all selected.** `drag.items` now captures each selected clip's `start0/dur0/inP0`; `trimItem(it,edge,delta)` trims one clip clamped to its own source/content limits; the trimL/trimR branches apply the primary's snapped delta to every selected clip. `startFadeDrag` captures all selected clips' base fade and applies the same delta to each (clamped to each clip's dur). Verified: two clips on different tracks both 6→4.5 s on trim; both get fadeIn 0.72 on a single fade drag.
- [x] **Compose tools in the inspector.** Selecting a nest clip that has `m.comp` now shows a Composition panel at the top of the inspector: a live dome schematic + layout selector + Count/Elevation/Size + "More options…". Edits call `regenComposeNest(m)` (rebuilds the nest's `nestClips/nestLanes` from `compLayout(m.comp)`; reloads state if that nest is the active tab). "More options…" opens the full compose dialog in nest mode (`openCompose(kind,null,m)` → `nestMedia.comp` apply path). Verified: count 4→7 regenerates inner clips, preview paints.
- [x] **Compose dialog schematic.** Added `drawComposePreview(g,canvas)` — plots `compLayout` on a fisheye dome disc (front=bottom, right=right, elevation rings, numbered colored dots sized by element size). Live `<canvas id="cPrev">` in the Create-composition modal updates on every param change (and the inspector reuses it as `#icPrev`). Verified: spiral×9 renders the spiral of numbered dots; "N elements · layout" caption.

## ROUND 31 — Sequence UX fixes (user, 4 items)
- [x] **Double-click a nest/compose clip opens its sequence.** The `#tracks` dblclick was being eaten by the move-drag's pointerup/DOM-rebuild, so added manual double-click detection in the clip pointerdown (`state._lastClipClick`, two pointerdowns on the same clip <400ms → `openSeq`). Verified live (re-querying the rebuilt DOM each click → opens).
- [x] **Nest clip max length = its inner content.** `srcLim` in `onTLMove` now includes `isSeqMedia(m)`, so a nest/sequence clip's right-trim clamps to `m.dur` (= `seqDur`, the inner content span). Verified: trimming a 5 s nest 4000px right stays at 5 s.
- [x] **Track-scoped time selection (Ableton).** `startTimeSelect` now tracks the lanes the drag spans vertically (`lanesBetweenY`, stored in `state.tl.selLanes`) and selects only clips in those tracks — drag within one track selects that track only; drag up/down adds tracks. `renderTimeSel` draws the highlight band only over the selected tracks (sets top/height/bottom from the lane rects). Verified: within lane 1 → selects lane 1 only; lane 0→2 drag → selects 0,1,2.
- [x] **Compose dialog layout buttons no longer overflow.** `.kindseg` switched to `flex-wrap` (7 layout buttons wrap into 3 rows, min-width 78px, each its own border) — all inside the 430px modal (verified lastBtn 509 < modalRight 525). Also excluded sequences from the compose **Media** source list (`!isSeqMedia`) so you can't compose the active sequence into itself.

## ROUND 30 — Unified Premiere-style sequences (user: secuencias = media, pestañas en el timeline, sin aviso de nest)
_Big structural refactor: a **sequence IS a media item** (`kind:'nest'`). Removed the separate `state.sequences[]` array, the top-bar `#seqBar`, and the `_nestStack`/`enterNest`/`exitNest`/`updNestBar` "editing nest" mode + its floating notice._
- [x] **Model.** `state.openSeqs` (ordered open-tab ids) + `state.activeSeqId` (active sequence media-id) + `state.seqW/seqH`. `state.clips/lanes/markers/groups/playhead/work` mirror the active sequence's `nestClips/nestLanes/nestMarkers/nestGroups/nestPlayhead/nestWork*`. Functions: `isSeqMedia`, `newSeqMedia`, `ensureSequences`, `saveActiveSeq`, `loadSeqIntoState`, `openSeq`, `switchSeq`, `closeSeqTab`, `deleteSequenceMedia`, `newSequenceDialog`, `updFmtChip`.
- [x] **New-sequence dialog** (Name / Resolution / FPS) — default **4096²/60**. Compose (`createComposition`) and `nestSelection` now build a sequence via `newSeqMedia` (inherits the active project resolution) and drop a nest clip in the current sequence.
- [x] **Tabs in the timeline header** (`#seqTabs`, Premiere-style): switch / rename (dbl-click) / close (✕) / new (＋) / right-click menu. Timeline height 368→**402px** so the 4 default tracks still fit exactly under the new tab strip (tlscroll clientH back to 354, 0 vertical scroll). No more "editing nest" banner.
- [x] **Sequences live in the media bin** (SEQ badge): double-click opens it as a tab; drag adds it as a nest clip; self-nest guarded (`addClip` blocks `m.id===activeSeqId`). The active/open sequence is what exports (export-dialog defaults read `activeSeq().w/fps`).
- [x] **Serialization v4**: `serProject` emits `media` (sequences included as nests) + `openSeqs` + `activeSeqId` + `seqW/seqH`; `serMedia` persists the per-sequence fields. `loadProject` handles v4, converts **v3** (`obj.sequences[]` → nest media) and **v2** (single timeline → "Sequence 1"). `ensureNestFBO` no longer clobbers the sequence's declared w/h to COMP.
- [x] **Adversarial multi-agent review (21 agents, 5 dimensions → skeptic verify): 8 confirmed findings, all fixed & re-verified:** (1) `saveActiveSeq` leaked a 2048² FBO+texture per autosave (nulled `fbo/tex` without deleting → re-alloc) → stop nulling (renderNest re-composites every frame; serMedia omits them); (2) post-load `_id` max-scan omitted `nestMarkers/nestGroups/comp.id` → uid() collisions → extended scan; (3) `deleteSequenceMedia` left orphan nest clips referencing the deleted sequence → filter `nestClips` across all sequences + `state.clips`; (4) **export froze videos nested inside a nest** (`seekExport` used top-level `activeClips`) → now `collectActiveVideos` descends into nests (mirrors playback); (5) bin-deleting media used only in a non-active nest left dangling clips + made it unrestorable by undo → filter/restore across all sequences; (6) render-ahead pre-render skipped `prepNests` → cached frames dropped nested content → added `prepNests` before composite; (7) export dialog left `#fmtChip` stuck on dialog values when closed without exporting → restore on close; (8) export size estimate ignored the work area → work-area-aware `secs`. Verified live: init, multi-seq isolation, compose→seq (resolution inherited), dbl-click open, close-tab, save/load v4 + v3/v2 back-compat, FBO stability across autosaves, dangling-clip cleanup, self-nest guard, 4-track exact fit.

## ROUND 29 — Media bin: skip duplicate imports (user: "a veces aparecen elementos en media dos veces")
- [x] **Dedup on import.** `importFiles` now filters the incoming files against what's already in Media before adding: key = absolute path (`filePath`/Electron) **or** `name|byte-size` fallback. Catches re-drops, double-fired drop events, and the same file selected twice in one batch (intra-batch dedup too). Skipped count is reported via `flashStatus`. **Missing** media is excluded from the dedup set so re-importing a relocated file still relinks through `adopt()`. Stored `fsize` on image/video/audio media (+ serialized in `serMedia`) so the name+size key survives reloads. Verified live (stubbed `add*`): re-import of an existing file skipped (only the new one passes), double-drop in one batch → one pass, different size with same name still passes, missing-media re-import still passes for relink.

## ROUND 28 — Ableton-style ghost-drag for clips + Ctrl=copy (user)
- [x] **Original stays, ghost shows the landing spot.** Moving a clip no longer mutates it live. In `move` mode, `onTLMove` keeps every selected clip in place and draws a translucent `.moveghost` (clip color, title band, snap line) at the snapped destination — within the same track, across tracks (single-clip lane change to the same-kind lane under the cursor), and for multi-selection (all ghosts shift by the same applied delta). `onTLUp` applies the move. Trims (`trimL/trimR`) are unchanged (still live, like Ableton).
- [x] **Ctrl/Cmd-drag = copy.** Holding Ctrl during the drag flags `drag._copy`; the ghost border turns accent-blue with a `＋` in the title, and on release `duplicateClipAt` clones each dragged clip at the destination (deep-copies `props`/`kf`/`_auto*`, fresh `id`, rebuilds mask tex) instead of moving the originals; selection jumps to the new copies.
- [x] **Media drag shows a clip-shaped landing ghost.** `startMediaDrag` now previews a `.moveghost` (media color + name) on the track under the cursor at the snapped start, dims the floating thumbnail, and shows the snap line — only over a same-kind lane; drops at the previewed position. Verified live via synthetic pointer events: in-track move (2s→4s, original held at 2s mid-drag), Ctrl-copy (original held at lane0/2s, copy at lane1/3s), cross-lane, and media-drop (lane2/3s with landing ghost); screenshot confirms original + accent ghost shown simultaneously.

## ROUND 27 — Fixed timecode counter (white=TC, gray=frames; constant width)
- [x] **Counter decoupled from the TC/Frames toggle.** `positionPlayhead` now always sets `#tc` = `TC()` (white, MM:SS:FF) and `#bbt` = `Math.round(playhead*fps)+'f'` (gray, total frames). The TC/Frames segment only drives the **ruler/grid** (`fmtTime`); the counter is identical in both modes. Verified: at 47 s both modes show `00:47:00` / `2820f`.
- [x] **Constant-width counter box.** `.tcbox` centered with `font-variant-numeric:tabular-nums`; `.tc` `min-width:80px` (centered) and `.du` `min-width:54px` (right-aligned) reserve fixed slots so the box doesn't resize as the playhead advances. Verified box width constant at **181px** from 0 → 75 min.

## ROUND 26 — Transport centered + remove viewport hint + orbit R/L flip (user)
- [x] **Transport centered.** Wrapped the transport cluster (toStart · play · toEnd · timecode · TC/Frames · loop · locator nav) back in `.tccenter` (absolute-centered), and moved Snap + grid readout into the right group with Automation/zoom (pushed right by the flex spacer). Verified `.tccenter` present + Snap in the right group.
- [x] **Removed the viewport hint** text "Click to select · drag to move on the dome · wheel to zoom" (`#hint` element deleted; the `txt('#hint',…)` i18n line null-guards, harmless).
- [x] **3D orbit Right/Left.** Measured (788px canvas, white@az90/RIGHT + red@az270/LEFT): orbit was self-consistent and matched the 2D top-down master (RIGHT on the right) — i.e. **mirrored vs the in-dome / Viewer (spec) experience**, which is why it read as inverted. Set the 3D `flipx` to `-1` for **both** modes (was `spec?-1:1`, so only orbit changed +1→−1) in the dome render AND `drawLabels3D`, so orbit adopts the audience handedness. Verified after: RIGHT(white) now renders on the left (0.35) with the RIGHT label (0.32) — content stays under its own label (both flip together), and spec is unchanged.

## ROUND 25 — Transport reorg + loop=Ctrl+L + bigger default + Ableton clips (user, with screenshots)
- [x] **Transport bar reorganized** (per the user's before/after image): play button moved into the transport group (`⏮ ▶ ⏭`), then the timecode box, then the `TC/Frames` toggle, then loop + locator nav, then Snap + grid readout; Automation/zoom stay right. **Removed the 120-BPM box and the "Bars" mode button** (`#bpmBox` element + its tempo-drag handler deleted — that handler was an unguarded `$('#bpmBox')` that would have thrown on load; `txt/ttl` i18n helpers already null-guard so the leftover bars/bpm i18n lines are harmless). `.tccenter` absolute-centering dropped (single flex flow).
- [x] **Loop button = Ctrl+L.** `#loopBtn.onclick` now calls `loopSelection()` (set loop region to the time selection / selected clip and toggle), identical to the shortcut.
- [x] **Bigger default editor.** Default timeline height 248→**368px**; default track height `LANE_DEF_H` 64→**82** (4 tracks fill the 368px timeline exactly: track area 328 = tlscroll 354 − ruler 26, 328/4=82 — verified gap 0, no vertical scroll); default project lanes are now **4 video tracks (Video 1–4)** (user confirmed video, not audio). Updated both the initial `state.lanes` and `newProject()`.
- [x] **Ableton-style clips.** Clip headband (`.tt`) is now a **flat solid bar in the clip's color** (set inline `background:${c.color}`) with the name, height 13→**15px** (`RES_TOP`=15 to match the automation overlay), **grab** cursor; body is **translucent** (`.clip` background transparent, `.fill` opacity .42, lighter scrim) so the **grid shows through**; **body cursor = arrow** (fixed `applyToolCursor` select case from `grab`→`default`; the `.tt` keeps grab via CSS → hand only on the title bar). Headband text color auto-picks dark/light by clip-color luminance (`textOn`) for readability. Verified live: 4 video tracks, taller timeline, headband=grab + body=arrow, loop button sets the loop region, no console errors; screenshot shows colored headbands + translucent bodies revealing the gridlines.

## ROUND 23-fix3 — THE actual playhead-vs-cursor desync: ruler scrub double-counted scrollLeft
_Decisive clue from the user: scrubbing tracked the cursor fine, but after zooming with **ctrl+scroll** the playhead drifted from the cursor with an offset that **grew** as you zoomed; zooming with the **buttons** never broke it. Buttons don't change `scrollLeft`; ctrl+scroll does → the offset was ≈`scrollLeft`._
- [x] **Root cause:** the `#ruler` is `position:sticky`, so `ruler.getBoundingClientRect().left` **already** shifts left by `scrollLeft` when scrolled (measured: at scrollLeft 200, ruler.left went 194→−6). The three ruler handlers (scrub pointerdown, dblclick, contextmenu) computed time as `clientX - ruler.left + scrollLeft` — **double-counting** `scrollLeft`. So the scrubbed playhead landed at cursor + scrollLeft, and since ctrl+scroll zoom grows `scrollLeft`, the offset grew with every zoom (buttons keep scrollLeft → no offset, which is why they "worked"). Fix: drop the `+scrollLeft` in all three (the sticky rect.left is already the scrolled content origin). Verified: across 8 zoom levels (pps 40→191, scrollLeft 0→1131) the playhead lands 0–1px from the cursor (was = scrollLeft: 0,75,169,286,433,616,845,1131). _The earlier `_scrollTarget` zoom-anchor fix stays — it's correct and needed for the cursor-time invariance — but this scrub double-count was the bug the user actually saw._

## ROUND 23-fix — Grid not infinite + zoom-at-cursor desync (user report)
- [x] **Grid lost to the right.** `#tracks` had no explicit width, so its box was only the viewport width (clientWidth 422 vs content 960) and the `repeating-linear-gradient` gridlines only painted across the visible area. Fix: set `tracks.style.width = W` in renderTimeline. Verified: clientWidth now == content width, and it keeps growing as you scroll right (960→1213→1466→1972…, `neededSec()` grows + re-render) so the grid is effectively infinite.
- [x] **Ctrl+scroll zoom desynced from the cursor (content drifted right).** Root cause: at a far scroll position the target `scrollLeft` (nx) exceeds the current content width, so it **clamps**. First attempt (set `scrollLeft=nx` then render then re-set) FAILED for far positions — confirmed from the user's screen recording (`ffmpeg` frames: playhead at ~7s drifted from under the cursor to ~123px right of it after zoom-in) — because setting `scrollLeft=nx` against the still-old/narrow DOM width clamps, so `neededSec()` then computed W from the clamped value and the final set clamped again. **Correct fix:** added `state.tl._scrollTarget`; `neededSec()` widens to `max(scrollLeft, _scrollTarget)`; `tlZoomAt` sets `_scrollTarget=nx` BEFORE renderTimeline (W grows to cover nx without touching scrollLeft), then applies `scrollLeft=nx`, then clears it. Verified deep in the timeline (scrubbed to ~7–14 min): 10 successive zoom-ins, **no clamping**, cursor-time drift ≤4px (sub-pixel rounding).

## ROUND 23 — Timeline grid + clip title bar + time selection + Arrangement loop (Ableton, online manual study)
_Per user: (1) clips need a title bar at the top that is the drag-to-move handle (so the clip moves even in automation mode, and the body is free to select the grid); (2) add a timeline GRID that adapts to zoom and lets you follow/select/loop with Ctrl+L, shown in frames/timecode. Studied the Live 12 "Arrangement View" manual._
- [x] **Clip title bar = the only move handle.** `.clip .tt` is now a full-width top strip (13px, name, grab cursor, `pointer-events:auto`, z-index 2, highlighted when selected) matching `RES_TOP`. In `#tracks` pointerdown, **only the title bar (or trim/fade handles) starts a move/trim**; dragging the clip **body** now starts a **time selection** instead (Ableton: "only the clip bar is draggable"). Works in automation mode because the title bar sits above the envelope canvas.
- [x] **Time selection.** Dragging the clip body or empty lane area drags a highlighted span (`state.tl.selA/selB`, `#timeSel` band, snapped), selecting the overlapping clips; a plain click clears it (deselects on empty). `startTimeSelect`/`renderTimeSel`.
- [x] **Arrangement loop (Ctrl+L).** `loopSelection()` sets the loop region (`workIn/workOut`, which `ploop` already loops) to the time selection — or the selected clip's extent — and toggles the loop (re-pressing the same selection clears it). The loop **brace** (`#workArea`) is draggable: a top strip moves it, the `.wkh` ends resize it (grid-snapped); the full-height shading is `pointer-events:none` so it never blocks clips beneath.
- [x] **Adaptive grid.** Central `gridSec()` (zoom-adaptive `gridBaseAdaptive()` × narrow/widen, or a fixed step) drives the ruler ticks, snapping (`snapGrid` returns `gridSec()` or 0 when off), and **visible vertical gridlines** as a `repeating-linear-gradient` (minor+major) on the `#tracks` background that scrolls with content. **Ctrl+1** narrower / **Ctrl+2** wider / **Ctrl+5** adaptive↔fixed / **Ctrl+4** snap; **Alt** bypasses snap. A `#gridReadout` chip by Snap shows the spacing in **frames or seconds per the TC/Frames mode** (`◇` adaptive / `▦` fixed), click toggles fixed, right-click for the menu. Verified live: gridlines adapt on narrow/widen/fixed, title-bar drag moves the clip (2→4 s), body drag makes a 2 s selection, Ctrl+L sets the loop, no console errors; screenshot shows gridlines + title bars + gold loop brace.

## ROUND 21 — Ableton-style automation (Automatizacion_Keyframes_Ableton.md, tickets A1–A6)
_Per the spec MD: replicate Ableton's automation-envelope UX on top of the inspector stopwatch, superseding the older [2]/[21] inline-curve work. One ticket at a time, each verified live; reuses the single keyframe engine (`kf`/`evalP`/`setKf`) — no second animation model._

- [x] **[A1] "Curves" → "Automation" toggle; legacy drawer deleted.** The button now only shows/hides the inline automation sub-lanes (no separate window). Removed the dead `#curveDrawer`/`#curveCv`/`#curveGraph` DOM + `renderCurves`/`drawCurveGraph`/`wireCurve`/`curveZoomAt` JS + all `graphOpen` guards (kept `initBez`, reused by the inline menus). **GOTCHA fixed during this:** a stray top-level `$('#curveGraph').addEventListener(...)` against the now-removed node threw at load and aborted init (left `undoStack` in TDZ → every `pushUndo` failed) — removed it. Lesson again: a top-level `$('#gone')` returns null and kills the whole init.
- [x] **[A2] Per-lane parameter selector + "+"/"-".** Each automation sub-lane header now has a `<select>` (any of the animable params) — changing it swaps the lane's envelope (`setAutoLaneParam`). A **"+"** adds another lane on the first unused param (`addAutoLane`); **"✕"** removes that lane (`closeAutoLane`, by index so duplicates are safe). Verified: 2 lanes render with 2 working dropdowns (Opacity, Size), +/✕ present.
- [x] **[A3] Inspector stopwatch arms + opens the lane** (kept from [2]): stopwatch → `setKf` + `openAuto`; un-arming clears the kf + `_autoOff` + closes the lane. Verified.
- [x] **[A4] Dashed baseline + Alt-drag-to-curve.** `drawAutoCurve` now draws a **dashed, dimmed** line when the param has no keyframes (static, not automated) and a **solid** colored line once automated (`ctx.setLineDash`). **Alt-dragging a segment** between two keyframes bends it: seeds bezier handles on the bracketing keyframes (`A.hOut`/`B.hIn`, `dv = bend·1.33`). Verified: Size lane (no kf) renders dashed, Opacity lane (2 kf) solid; synthetic alt-drag turned kf0 into `bezier` with `hOut.dv≈39.9`, kf1 got `hIn`. Existing add/move/delete/handle/snap/interp-menu retained.
- [x] **[A5] Track context menu.** Right-click a clip → **Show Automation** (`showAutomation` — turns lanes on, opens a lane), **Show Automation in New Lane** (= "+"), **Return to Default** (`returnToDefault` — freezes each param at its current value, clears all kf + `_autoOff` + closes lanes). Verified: returnToDefault drops all automation to static.
- [x] **ROUND 22 — Automation rewritten to match Ableton (online manual study + 30-agent adversarial audit).** User asks: (1) automation mode shows envelopes on ALL tracks, one over each clip, opacity by default; (2) drag-select multiple breakpoints; (3) resizable automation sub-lanes; (4) curve with Alt-drag on the line instead of a right-click easing menu — plus "analiza online cómo funciona Ableton". Researched the Live 12 manual ("Automation and Editing Envelopes"): click line=add breakpoint, click point=delete, drag point=move (selection moves together), drag segment vertically=move, Alt-drag=curve / Alt-dbl-click=straighten, Shift=fine, drag background=marquee-select, lanes resizable by their bottom edge. Then ran a multi-agent audit of the prior overlay implementation → **16 confirmed bugs** (7 of them the same critical class: the full-width overlay canvas, a *sibling* of the clips, hijacked clip move/trim/fade/select/nest-enter and started a marquee on sibling clicks). **Full rewrite:**
  - **Envelope canvas is now a CHILD of each `.clip`** (`attachClipAuto`), covering the clip body **below a reserved `RES_TOP=13px` title band**, with clip chrome (`.tt` name, `.hd` trim, `.fadeh` fades, `.kfstrip`/`.kfd`) z-indexed ABOVE it. So clip move (drag title band), trim, fade, kfd-seek and selecting/dragging sibling clips all keep working while automation is shown — the whole critical class is gone (verified by `elementFromPoint`: trim→`hd`, title→clip body, fade→`fadeh`, body→`clipautocv`). Clip-local coords via `cv._local` (`ox=c.start*pps`).
  - **Shown on EVERY video clip** when automation mode is on (opacity default), not just the selected one; the param **chip** (swatch + `<select>` + A + ↻ + "+") shows only on the selected clip, anchored top-right so it never covers the name (audit #14). Audio lanes & collapsed lanes are skipped (`isAudioClip` guards in `openAuto`/`showAutomation`/`addAutoLane`/`attachClipAuto`/`appendAutoLanes`; audit #11/#12/#13).
  - **Gestures (textual Ableton):** click line=add · click point=delete · drag point=move (moves the whole marquee selection if the point is in it) · drag segment vertically=move (lead/mid/trail/flat via `segAround`) · Alt-drag=curve (bezier) · Alt-dbl-click=straighten · Shift=fine (×0.25) · grid snap is clip-local to the grid step (no longer snapping to foreign clips/playhead, audit #8) · click on the line within 0.02s of a point selects it instead of overwriting (audit #9) · **drag in the background = marquee-select breakpoints** (amber), then drag any selected one to move them together or press **Delete** to remove them all. **pushUndo is lazy** (only on a real mutation, so a plain click / double-click no longer pollutes undo with 2–3 snapshots; audit #10).
  - **Right-click easing menu removed** (curving is Alt-drag now); right-click = Add/Delete breakpoint, Delete selected, Clear automation. Breakpoints drawn as squares; ghost-point on hover; value tooltip while dragging; `ns-resize` cursor on the line, `pointer` on a point, `crosshair` on background.
  - **Sub-lanes (params 2+) are resizable** (`.autores` bottom handle → `c._autoH[param]`, `autoLaneH`); `addAutoLane` guards the "all params shown" case (audit #16); `.kfd` is now clickable (audit #15).
  - Verified live with synthetic pointer events: all-clips overlay (2 canvases/1 chip), sibling-click selects (no marquee), click-add, click-delete, 2D drag (fixed a delta-vs-live-keyframe bug), marquee selects 3 + Delete removes 3, alt-curve+alt-straighten, segment vertical drag, resizable lane 58→98, audio clip gets no canvas, and trim/title/fade hit-tests resolve to the clip not the canvas. Screenshot confirms two clips both showing their opacity envelope, chip only on the selected one, names readable.
- [x] **[A2-fix2] Ableton-faithful in-track envelope editing (user: "cópialo textual, es comodísimo editar la automatización directo en la pista").** Reworked `bindAutoCurve` + `drawAutoCurve` to match Live's automation gestures exactly: **click on the line = add a breakpoint** (press-release, no drag needed); **drag a line segment vertically = move that segment** (`segAround` finds the lead/mid/trail/flat segment; mid translates both bounding breakpoints, lead/trail move the end breakpoint, flat with no breakpoints moves the static value with NO keyframe created — like dragging Live's constant envelope); **drag a breakpoint = free 2D move**; **Shift = fine** value drag (×0.25); **Alt-drag a segment = curve it** (bezier, retained); **double-click a breakpoint = delete**. Visual fidelity: breakpoints are small **squares**, a faint **ghost breakpoint** previews where a click will add while hovering the line, a **value tooltip** (e.g. "68 %") follows the dragged point/segment, and the cursor is **`ns-resize` over the line / `pointer` over a point**. Click-vs-drag is disambiguated by a 4px move threshold so a plain click always adds and a drag always moves. Verified live (synthetic pointer events): hover→ghost+ns-resize; flat-line drag down → static value 50→lower, no kf; click → +1 breakpoint; mid-segment drag down → both breakpoints move together; breakpoint 2D drag 85→68; clip stays selected throughout.
- [x] **[A2-fix] Primary param overlaid ON the track + click-to-add (user report).** First report: "no quedó bien integrado — debería mostrarse dentro de la misma pista hasta que agregue más subpistas, y al hacer clic/doble-clic en la línea no se crean keyframes y la subpista se cierra." Two fixes: **(1)** the primary automation param (`c._auto[0]`) now draws as an **overlay on the clip's own track** (`appendClipAutoOverlay` → `.autoover` canvas + `.autochip` control: swatch + param `<select>` + A + ↻ + "+"); only params added with **"+"** become sub-lanes below (`appendAutoLanes` now skips index 0). Stopwatch arming makes that param the primary (`openAuto` unshifts). **(2)** Keyframe creation was broken because the autocv click bubbled to `#tracks` → `startMarquee` deselected the clip → `selClip()` null → the lane closed before the dblclick landed. Added `e.stopPropagation()` on the curve handlers (only when the click is within the clip's curve region, so clicks elsewhere still select other clips), made **single-click on the line add a breakpoint then drag it** (Ableton), and `inv` now returns null outside the clip bounds (no stray keyframes). Verified live: automation ON → 1 overlay in-track / 0 sub-lanes / chip selector = opacity; single-click adds a kf (count 1) with the clip **still selected** and the overlay **still open**; "+" → 1 overlay + 1 sub-lane. Screenshot confirms the envelope (3 kf) drawn over the clip with the chip.
- [x] **[A6] Auto-override on manual edit + Re-Enable.** New `manualEdit(c,p,v)` routes every **by-hand** edit (inspector value drag/type/wheel, viewport element move) so that editing an **automated** param sets `_autoOff[p]` (curve bypassed but **kept**) and holds the manual value — Ableton-style override. Re-Enable restores it: a **per-param ↻** appears in the inspector row when overridden, a **global "↻ Re-Enable"** button (`#reEnAll`) appears in the toolbar whenever any param is overridden (`anyOverride`/`updReEnableGlobal`), and `reenableAll` clears them all. Verified: manualEdit on an automated `az` (following=155) → `_autoOff.az=true`, held 123, global+inspector buttons shown; `reenableAuto`/`reenableAll` → follows curve again, buttons hidden. _The diamond "add keyframe" button + the inline lane remain the explicit curve-authoring paths; the value knob overrides, exactly like Ableton._

## ROUND 20 — Compose creates a NEST (Premiere-style), not a spread-out group
_Per user: a composition should drop a single **nest** clip into the current sequence; double-clicking it enters the nest as its own editable sequence. Supersedes the ROUND-17 [20] deviation (which kept composes as an editable group spread across the current timeline's lanes)._

- [x] **`createComposition` now builds a nest** — the ring/grid/spiral/phyllo/wave/fib/random layout (`compLayout`) becomes the `nestClips` of a new `kind:'nest'` media (one composed element per `nestLane` → no same-lane overlap → no spurious crossfade), carrying the az/el/size geometry + mask. A single nest clip (`props.fulldome=true`) is dropped into the **current** sequence at the playhead and selected; it surfaces as a `#seqBar` nest tab, and double-clicking it enters it (existing `enterNest` FBO path). Verified live: ring×6 → **1 nest clip** in the sequence (`clipsInSeq:1`), 6 internal clips on 6 lanes, az [0,60,120,180,240,300], seqBar nest tab, double-click enters (6 clips) / exit returns (1 clip), renders (~10% lit), no console errors. _The legacy group machinery (`regenComp` + group inspector) stays for back-compat with older `.rdome` projects; new composes are nests._
- [x] **Nest-internal videos play/scrub from the parent sequence** — videos inside a nest were frozen during main-sequence playback (`ploop`/`play`/`scrubRender` only drove top-level `kind:'video'` clips; a nest clip is `kind:'nest'`, so its inner videos only ran when you entered the nest to edit). Added `collectActiveVideos(clips,lanes,t)` — recurses into active nests with local-time adjustment, deduped by media — and routed `play()`, `ploop()` and `scrubRender()` through it. Verified: a video-ring nest played from the main sequence advances the inner video (0 → 0.93 s in ~0.9 s, `requestVideoFrameCallback` pumping the texture); was frozen before. Same path fixes scrubbing the nest from the parent.

## ROUND 19 — Fix: `window.prompt()` is dead in Electron → in-app prompt modal
_Caught from a user report ("Ctrl+R no funciona"). The 23-corrections audit had passed in the **web preview**, but `window.prompt()` is unsupported in the packaged Electron `.exe` (returns null), so every prompt-based dialog silently did nothing there — which is why several features "worked in dev but not the .exe"._

- [x] **`appPrompt(message, def, cb)`** — a styled in-app modal (overlay + input + OK/Cancel; Enter commits, Esc cancels, click-outside cancels) that works in Electron. Replaced **all 11 `window.prompt()` call sites**: rename clip / track / sequence / nest-tab / locator (×2) — via `Ctrl+R` and context menus — plus curve "Set value…", export "Save preset", "New folder", and the "Set clip start (seconds)" command. Verified live: `Ctrl+R` on a selected clip opens the modal pre-filled with the name, Enter renames (`clip.name` updates), Esc cancels with no change, modal closes; no console errors. _Lesson: Electron-sensitive APIs (`prompt`/`alert`/`confirm`) must be verified in the packaged build, not only the web preview where they work natively._

## ROUND 18 — Fluid playback engine · Tier 1 (decode + cache) + [T4] render-ahead
_From `Motor_Reproduccion_Fluido.md`. Phase 0 profiled live first, then implemented one point at a time, each measured in the WebGL2 preview. Additive + fallback (the old `<video>`+seek path stays for media without chunks). No console errors; serialization safe (`serMedia` is a whitelist → chunks never enter the `.rdome`)._

- [x] **Phase 0 — profiling (measured, not guessed)** — instrumented decode/upload/composite via monkey-patch. **Bottleneck = seek-based decode during scrub, scaling super-linearly:** 1 layer 10 ms → 4 layers **691 ms** → 8 layers **3776 ms**. Upload (`texImage2D`) 0.2–1.9 ms and composite dispatch <0.15 ms were *not* bottlenecks (confirms the GPU compositing is fine — untouched). Paused-idle already does 0 composites/frame (so [T5] is moot). Forward playback ~55–61 fps but 8-layer texture uploads starved (rVFC) → some layers froze.
- [x] **[T2] All-intra proxy (GOP=1) + per-frame chunk capture** — `makeProxy` now encodes every frame as a keyframe and captures each `EncodedVideoChunk` (bytes+ts) into `m.frames` + the `decoderConfig` into `m.decConfig`, with a **256 MB/clip RAM cap** (long clips drop chunks → fall back to the now all-intra `<video>` seek, still faster than before). The MP4 proxy `<video>` is still produced (fallback/compat).
- [x] **[T1-core] WebCodecs random-access decode** — new module `ensureDecoder`/`decodeIntoCache`/`showFrame`: a reused `VideoDecoder` per source decodes the chunk for the requested frame (`F=round(t*fps)`). `seekMedia` routes here when `m.frames` exists; **export untouched** (uses the original via `useOrig=true`). Decode is async/off-thread (no UI block) even without a Worker.
- [x] **[T3] LRU frame-texture cache + pool reuse + lookahead** — decoded frames cached as GPU textures keyed by `mediaId:frame` (`_fcache`, `FC_MAX=64`, LRU evict that **never evicts a displayed `m.tex`**, freed textures recycled via `_fpool`); `showFrame` prefetches the next 2 frames. `disposeDecoder` purges a media's cache on delete (`disposeMedia` calls it); `clearFrameCache` on new project. "Only active clips" was already true (`scrubRender`→`activeClips`).
- **Verified live (real edited path, test clip 480×848 @30fps):** scrub per playhead move **4 layers 691→34.5 ms (~20×)**, **8 layers 3776→46.5 ms (~81×)**, now **linear**; revisiting a cached frame **0.3 ms** with an identical pixel signature (no corruption); decoded video renders correctly (`texFrame` tracks `round(t*fps)`, ~45 k lit px); playback intact (advances real-time, clean pause); deleting a cached media does not crash. Boots clean, 0 console errors.

- [x] **[T4] Render-ahead (preview cache)** — caches the flattened master composite per frame (downscaled to 1024² via `blitFramebuffer`; LRU `_ra`, `RA_MAX=120`; generation-counter invalidation bumped by `markDirty` — cheap, no texture deletes). `render()` blits the cached flat texture on a hit (skips `prepNests`+`composite`); `ploop` skips decoding the N video layers on a hit. `raPrerenderRange(t0,t1)` pre-renders a range ("render in/out") by composing **synchronously** from the [T3] frame cache (save/set/restore `m.tex` with no await between → atomic, no race with `ploop`). Wired into ⌘K: "Render-ahead: cache range for smooth playback" / "…off + clear cache". Flag-gated (`_raOn`, default off → render path byte-identical to before). Verified live: 8-layer playback **52.4 → 60.5 fps with 0 composites + 0 uploads** (pre-cached range replays a single flat texture → independent of layer count, so it holds 60 fps for 10/20+ layers); pre-render 61 frames/1.4 s; cache hit pixel-correct (modulo the 1024² downscale); edit invalidates → recomposite; off clears; no console errors.

- [x] **[T4] Auto render-ahead scheduler** — a background idle loop (`raStartIdle`/`raIdleTick`) pre-renders the work-area's next uncached frame whenever render-ahead is on and the app is idle, and **re-fills automatically after edits** (the generation bump marks frames stale). Started by the render-ahead command; stopped/cleared by "off". Verified: after a `markDirty` invalidation the work-area re-cached itself within ~1.8 s with no interaction; no console errors.

_Verdict: Tier 1 (scrub) + T4 (render-ahead playback, now auto-maintained) both met their criteria. Multi-layer scrubbing went from unusable (seconds) to fluid (tens of ms, linear, instant revisits); a heavy stretch plays at 60 fps doing zero decode/zero composite, and the cache fills + refreshes itself in the background. A **cache-map bar** (Premiere-style render strip) now draws along the bottom of the ruler (`drawCacheMap`, teal `#3CE0D6`) showing cached ranges live, verified by pixel readback (green in-range / none out-of-range / cleared on off). **[T7] (partial): frame-exact step + scrub** — `frameSnap(t)` quantizes to the project frame grid; `←/→` now snap-then-±1-frame (was accumulating sub-frame drift by adding `1/fps` to a float) and ruler scrub snaps to the grid, so the playhead/timecode are always frame-exact. Verified: from an off-grid 1.3337 s, `→`→1.35 s (81/60), `←←`→1.31667 s (79/60), all exact frame multiples. _Still pending in [T7]: grid-quantizing the displayed frame during **uncached** playback (cached playback already lands on the grid via the cache key) and an explicit audio-slaved-to-frame clock._ **Proxy generation no longer janks the UI** — `makeProxy` now captures source frames by **sequential 1× playback via `requestVideoFrameCallback`** (decode stays in the browser media pipeline, off the UI thread) instead of a per-frame `<video>.currentTime` seek that blocked the main thread; same contiguous all-intra `m.frames` output, seek fallback when rVFC is absent. Verified: UI held **60 fps (min 60)** through a full build, 463/463 contiguous keyframes, frame content varies across the timeline (not duplicated). Pending polish: disk cache for ranges beyond ~120 frames; proxy build *speed* (still ~real-time → needs a Worker/MP4-demuxer, [T9]); [T1] decoder in a Worker; [T9] proxy encode in a Worker._

## ROUND 17 — Correcciones [1]–[23] + endurecimiento (autonomous pass)
_Applied from `Correcciones_DomeStudioPro.md`, one fix at a time, each live-verified in the WebGL2 preview (gl.readPixels / DOM checks). No console errors at any step; the 3 smoke checks (boots clean · composite non-black · export writes a file) all pass._

- [x] **[1] Resizable + collapsible tracks (Ableton-style)** — each `state.lanes[i]` now has its own `h` + `collapsed`; `laneH(li)` ([app.js](Dome Studio Pro/app.js)) drives both the clip row and the header row. Header gets a collapse chevron (`[data-m=collapse]`) and a bottom-edge drag handle (`.laneres`); clips/waveform/curves reflow to the lane height. Verified: lane resized to 120px (row==header==120), collapsed to 20px (row==header==20), full stack rows-sum==headers-sum (268==268, perfectly aligned); marquee hit-test rewritten to read real DOM row geometry.
- [x] **[2] Inline automation sub-lanes (no drawer)** — "Curves" now toggles `state.inlineCurves`; the inspector **stopwatch** opens a per-parameter automation sub-lane under the clip (`openAuto`/`appendAutoLanes`/`drawAutoCurve`/`bindAutoCurve`). Multiple sub-lanes at once (Azimuth + Size), each independently editable (dbl-click add/remove point, drag, right-click easing incl. Free bézier) — reuses `evalP`/`setKf` (no second animation engine). Canvas lives inside `#tracks` so it scrolls with the clips. Verified: stopwatch→1 sub-lane, second param→2 sub-lanes, evalP interpolates (0→10,3→155,6→300), dbl-click add 2→3 / dbl-click point delete 3→2, "Curves" off→0 sub-lanes.
- [x] **[3] No ⌘K button** — removed `#cmdkBtn` + wiring; palette still opens via Ctrl+K / F1 / "?". Verified.
- [x] **[4] `C` selects the Razor tool** (cut lands where you click, with snap) instead of an instant playhead split; "Split at playhead" stays as a command/menu item. Verified C→tool='razor'.
- [x] **[5] `Ctrl+R` renames anything** — `renameSelection()` dispatches marker > clip > track > active sequence. Verified clip + track rename via stubbed prompt.
- [x] **[6][8] Nest = sequence** — nests now surface as tabs in `#seqBar` (`⊟` group, `.nesttab`); click the tab or double-click the nest clip enters it to edit (existing `enterNest` FBO path kept). Verified: nest→1 tab "Nest 1", dbl-click enters (2 subclips, tab active), exit returns, tab-click enters. _Deviation (documented):_ composes stay editable groups (see [20]) rather than literal nests, to preserve the verified Transform-all group UX.
- [x] **[7] Fades drawn as the real opacity-envelope curve** over the clip (rises over fade-in, flat, falls over fade-out) as an SVG polyline `.fadeenv`, corner handles still draggable; crossfade shows the two crossing lines (`.xfade`). Verified envelope SVG renders.
- [x] **[9] Blend dropdown applies** — verified `change`→`clip.props.blend` + re-render (was already wired; confirmed live).
- [x] **[10] Inspector NumberBox** — dbl-click→type→Enter/Esc, clean enter/exit (verified earlier rounds; the Easing/Transition/Fade rows that complicated it are now removed, see [11]).
- [x] **[11] Inspector without Transition / Fade / Easing** — removed those rows; `Easing` control replaced by `curEase()` default + per-keyframe easing in the curve right-click. Verified the three rows are gone, keyframe-add still works.
- [x] **[12] One media entry + proxy dot** — removed the broken proxy filter (`#proxySeg`); each media shows once with a status dot (grey=no proxy/generating, green=ready, `.pdot`, updated by `updProxyUI`). Verified grey→green on proxyReady.
- [x] **[13] Proxy only for video** — `enqProxy` is only called from the video import/relink paths; images/audio/text/shape/sequence/nest never enqueue. Verified by code path.
- [x] **[14] Grid toggle button** — `#dispSeg [data-d=grid]` toggles `state.view.showGrid`. Verified.
- [x] **[15] Crossfade blending fixed** — root cause: both clips were drawn at reduced opacity over transparent black → mid-overlap alpha & brightness **dip** (`[64,0,127] α191`). Now the dissolve keeps A fully under and fades B in over it (`aXf=1,bXf=f`) → stays opaque (α255), constant brightness (R+B=255), monotonic, no double-exposure — video & photo. dipBlack transition unchanged. Verified pixel-by-pixel across the overlap.
- [x] **[16] Preview quality affects only the clips, not the grid** — `previewQuality` no longer shrinks the screen canvas; it shrinks the **composite master texture** via `setCompSize(COMP*pq)` (compTex re-allocated to 512/1024/2048), while `glc`/`gridc`/dome-mesh/2D-overlays stay full-res. Verified ¼→compSize 512 with glc unchanged; grid stays crisp.
- [x] **[17] Export with no in/out = 0→duration()** — `runExport` already defaults the range to `0..duration()` when `workIn/workOut` are null. Verified.
- [x] **[18] Hover tooltip after ~1s** — delegated tooltip module converts `title`→`data-tip` (kills the native OS tooltip, mirrors to `aria-label`) and shows a styled `.dsp-tip` after 1000ms. Verified: shows "Save · Ctrl+S" after 1.15s, hides on leave, **works on repeat hovers** (the title-strip bug was caught and fixed).
- [x] **[19] Orbit LEFT/RIGHT** — investigated thoroughly; the orbit labels/projection are **already consistent** with the 2D master (top-down orbit: FRONT=bottom, BACK=top, RIGHT=right@710, LEFT=left@278; grid.png red=LEFT sits on screen-left in both 2D and orbit). No swap reproduces in the current build, so **no change made** — and the calibrated `u_flipx` of spec/2D was left untouched per the gotcha. Validated with `assets/media/grid.png`.
- [x] **[20] Composes → one element per lane, no crossfade** — `regenComp` now puts each composition member on its **own** video lane (`ensureVideoLanes`), so they never overlap on a lane → no spurious crossfade; geometry preserved (ring az evenly spread). Verified: ring×6 → 6 distinct lanes [0,1,2,4,5,6], az [0,60,120,180,240,300], **0 xfade indicators**, 6 patches rendered. _Deviation:_ kept as an editable group (Transform-all) rather than wrapping in a nest, to preserve that verified UX; acceptance (N lanes / no crossfade / correct geometry) met.
- [x] **[21] Re-enable automation** — `evalP` honors a per-param `_autoOff` bypass; each automation sub-lane header has an `A` arm-toggle (override → static value) and a `↻` re-enable button that re-applies the curve. Verified: arm-off→evalP returns base (99), ↻→back to curve (155), `_autoOff` cleared.
- [x] **[22] Transport controls centered** — `.tccenter` holds Play + timecode at window center (verified delta 0; from ROUND 15, re-confirmed).
- [x] **[23] Create track only via Ctrl+T / right-click** — removed the "+ Video / + Audio" buttons; `Ctrl+T` adds a track; right-click on the track area, the empty header column, or a lane header offers Create video/audio track (+ rename/duplicate/delete). Verified no `#addV`/`#addA`, Ctrl+T adds a lane.
- [x] **Stress (10 clips / 5 lanes / extreme zoom)** — 10 clips across 5 video lanes; zoom in to pps 600 and out to pps 8; scroll to end → all 6 rows render, render() still produces pixels, no console errors.

### Endurecimiento (section 11)
- [x] **Self-hosted fonts** — downloaded Inter + JetBrains Mono (latin variable woff2) to `assets/fonts/`, replaced the Google Fonts CDN `<link>` with local `@font-face`. The packaged `.exe` no longer needs the network for fonts. Verified: both fonts load via `document.fonts`, 0 google/gstatic links, `assets/**/*` is already in the electron-builder `files` list.
- [x] **Regression net** — every fix was live-verified before moving on, plus the 3 per-session smoke checks (boots clean · composite non-black · export writes a file) and the stress check above.
- [ ] **Proxies → Worker + persist to disk** — **deferred** (rationale): moving the WebCodecs encode to a Worker + writing proxies into the Electron project folder is a substantial change to the currently-verified proxy pipeline (main-thread, in-memory). High regression risk for a portable single-folder build; recommended for a dedicated pass with its own verification, not bundled into this correctness tranche.

_Verdict: all 23 checklist items are implemented and live-verified ([19] verified-already-correct, no change needed); [15] and [18] uncovered real bugs that were fixed and re-verified; fonts are self-hosted. The one honest deferral is the Worker/disk proxy hardening, left out to avoid regressing the verified proxy path._

## ROUND 16 — Inside-dome Viewer: independent dolly (scroll) + FOV
_All items implemented and live-verified against the running app (RTX 4060, Chrome/WebGL2 preview)._

- [x] **Scroll dollies the inside-dome camera (acercar/retroceder), decoupled from FOV** — in Viewer (`three==='spec'`) mode the wheel drives `cam.back` (camera position along the look axis), but it was clamped `[0, 2.4]` with default `0`, so scrolling *in* was dead-stuck at center — you could only back away. Widened the clamp (wheel handler + `#dollyRange` `min`) to `[-0.9, 2.4]` so the eye can move toward the front dome surface (real zoom-in). `-0.9` keeps the eye ~0.05 from the nearest surface point, well beyond the 0.01 near-plane (no clipping). Verified: from default `0`, simulated scroll-in reaches `-0.9`; render + projected dome point both change with `cam.back` while FOV held fixed.
- [x] **FOV is now an independent control in Viewer mode** — `cameraMVP` already used `cam.fov` only in spec mode, but `updViewCtl` showed `#fovCtl` in *orbit* (where it's ignored, lens forced to 48°) and hid it in Viewer. Flipped it: Viewer now shows **both** `FOV` and `DOLLY` sliders; orbit shows neither (orbit = scroll-distance + fixed natural lens, so its previously-dead FOV slider is removed). Verified: in spec both controls `flex`, in orbit both `none`; FOV and dolly each independently move a projected dome point and change the rendered image; no console errors.

_Verdict: the inside-dome viewer now behaves like a real fulldome camera — scroll to move closer/back, a separate FOV slider for the lens angle — instead of one coupled control. Live-verified._

## ROUND 15 — Transport/viewport UI polish
_All items implemented and live-verified against the running app (RTX 4060, Chrome/WebGL2 preview)._

- [x] **Timecode + Play centered in the transport** — wrapped the play button and the timecode/`bbt` readout in an absolutely-centered `.tccenter` cluster (`.transport{position:relative}`); play removed from the left transport group. Verified: `.tccenter` holds both `#playBtn` and `#tc`; its center = window center (800 = 800 at 1600px wide), `centeredDelta` 0.
- [x] **Removed the media search box** — deleted the `.searchbox`/`#mq` input from the media toolrow and its `oninput` + `ph('#mq',…)` wiring (filter segments + proxy filter kept). Verified: `#mq` no longer in DOM, no console errors, media list still filters via the All/Video/Image segments.
- [x] **Viewport fully black** — 2D stage container `background:#000`; 3D `clearColor(0,0,0,1)`; dome shader `base=vec3(0.0)` (was a dark blue-grey gradient). Verified by `readPixels`: with the grid overlay off, center/upper/lower/corner all read `0,0,0`; the faint `17,20,23` seen with grid on is just the antialiased grid lines (a user-toggled layer), not the background.

_Verdict: cleaner, more cinema-like chrome — transport centered like an NLE, no stray search field, and a true-black dome canvas. All live-verified._

## ROUND 14 — Multiple sequences per project + toolbar cleanup
_All items implemented and live-verified against the running app (RTX 4060, Chrome/WebGL2 preview)._

- [x] **Multiple sequences per project (Premiere-style)** — added `state.sequences[]` + `state.activeSeqId`; each sequence owns its `clips`/`lanes`/`markers`/`groups`/`playhead`/`workIn`/`workOut`, and the live `state.*` mirrors the active one. Helpers: `ensureSequences()` (wraps the current timeline as "Sequence 1", also wraps old single-timeline projects on load), `saveActiveSeq()` (nest-aware: saves the sequence root even while editing a nest), `loadSeqIntoState()`, `switchSeq()`, `newSequence()`, `renameSequence()`, `deleteSequence()`, `serSeq()`. A `#seqBar` tab strip in the top bar shows all sequences with the active one highlighted: click to open, double-click to rename, right-click to delete, `＋` to create; also a ⌘K "New sequence" command. Switching a sequence exits any open nest first (`_nestStack`). Verified: boot = 1 "Sequence 1" tab; `＋` creates Sequence 2 (empty, active); adding a clip in each and switching back and forth preserves each sequence's own distinct clips; serialize/load round-trips 2 sequences.
- [x] **Project format v3 with back-compat** — `serProject()` bumped to `v:3`, now emits `sequences` (each via `serSeq` → `serClip`) + `activeSeqId`; `loadProject()` rebuilds sequences (rebuilding masks + bumping `_id` across all sequences) or, for an older single-timeline `.rdome` (no `sequences`), wraps it as "Sequence 1". Verified: v3 file with 2 sequences reloads with both intact and the right active one.
- [x] **Removed the Split and Delete toolbar buttons** — per request, those destructive actions are now only via keyboard (`C` split / `Del`-`Backspace` delete), the ⌘K command palette, and the clip right-click menu (Snap button kept). Removed the buttons from index.html and their dead `onclick`/`updEnable`/`applyLang` wiring. Verified: `#splitBtn`/`#delBtn` no longer in the DOM; split/delete still work via keyboard/menu/palette.

_Verdict: ROUND 14 brings true Premiere-style multi-sequence projects (each with its own clips/lanes/markers/groups, nest-aware save, v3 round-trip with back-compat) and a leaner toolbar — all live-verified clean._

## ROUND 13 — Timeline UX + nested sequences (Nest)
_All items implemented and live-verified against the running app (RTX 4060, Chrome/WebGL2 preview)._

- [x] **Razor cuts at the mouse, not the playhead, with snapping** — the razor tool already cut at the click X; now it snaps the cut to clip edges / markers / grid (`applySnap`) and shows a live cut-line that follows the cursor (`#snapline`, dimmed `.free` class when not snapped, bright when snapped) via a `#tracks` pointermove handler. The playhead split (C / Split button) stays as a separate explicit command. Verified: razor-click at t=4.95 near a marker at 5.0 snapped the cut to exactly 5.0; hover line shows at the mouse position.
- [x] **Fades + crossfade confirmed (Ableton-style)** — draggable corner fade-in/out handles (`startFadeDrag`) and auto-crossfade on same-lane overlap work. Verified: fadeFactor 0.5 mid-fade, 1.0 at center.
- [x] **Curve editor easier** — keyframe grab radius bumped to 14px (2-axis hit-test), and dragging a keyframe snaps its time to playhead/markers/grid (`cmove` via `applySnap`) when snapping is on.
- [x] **More per-clip blend modes** — added `darken` (`gl.blendEquation(MIN)`) and `lighten` (`MAX`) to `setBlend` + the inspector dropdown, alongside normal/add/screen/multiply. `setBlend`/`NORMAL_BLEND` now always reset `blendEquation` to `FUNC_ADD` so MIN/MAX never leaks to later draws. Verified: darken max 100 = min(100,200), lighten 200 = max, and a following normal clip renders back at 103 (equation reset, no leak).
- [x] **Nested sequences (Nest), Premiere-style** — `nestSelection()` (clip context menu + ⌘K palette) moves the selected clips into a new media of `kind:'nest'` (its own `nestClips`/`nestLanes`, rebased to 0) and replaces them on the parent with ONE nest clip (defaults `props.fulldome=true` → fills the dome 1:1, fully keyframeable opacity/grade/blend; untoggle fulldome to place/keyframe it as a patch). The nest renders recursively into its own per-nest FBO (`ensureNestFBO`/`renderNest`/`prepNests`, depth ≤4) before the parent composite, in both preview and export. Double-click a nest clip to enter and edit its sub-timeline (context pushed on `_nestStack`, `#nestBar` breadcrumb, `exitNest` returns). Serialized via `serMedia` (`nestClips` serClip'd + `nestLanes`) and rebuilt in `loadProject`; `disposeMedia` frees the nest FBO + sub-clip mask textures. Verified: 2 clips → 1 nest clip (sub-clips=2), renders 52,718 px filling the dome, enter→2 editing clips/stack=1, exit→1 clip/stack=0, opacity keyframes 0→100, save/load preserves 2 sub-clips.

_Verdict: ROUND 13 lands editor-grade timeline ergonomics (mouse-snapped razor, easier curves, two new blend modes) plus a fully recursive, keyframeable, round-trip-safe Nest — all live-verified clean._

## ROUND 12 — Adversarial review fixes (rounds 9-11)
_A 32-agent adversarial review audited the rounds 9-11 code and confirmed 17 bugs: 15 fixed and live-verified, 1 deferred, 1 skipped-by-design._

### HIGH (all fixed + verified)
- [x] **Streaming PNG export now surfaces disk failures** — `runExport` checks `DSP.ensureDir`/`DSP.writeBinary` return values and throws (was: silent false-success on a read-only/full disk).
- [x] **MP4 AAC track only declared when encodable** — `runExport` pre-checks `AudioEncoder.isConfigSupported` before adding `muxCfg.audio` (was: declared up-front, could finalize a malformed empty-AAC MP4). Verified: with-audio 13.2KB vs silent 2.8KB.
- [x] **Screen/multiply blend now honour opacity/fades** — new `u_premul` uniform in `FSW`+`FSFD`; `drawClip` sets it for screen/multiply so RGB is opacity-premultiplied. Verified: screen maxSum 612→54 at 30% opacity (was stuck full-on).
- [x] **2D overlay clears the full panel** — `drawGrid2D` `gx.clearRect(0,0,view.cw,view.ch)` (was `VSIZE²`, leaving ghost trails on the right of a non-square panel after round-11 made `#grid` full-rect).

### MED (fixed + verified)
- [x] **Image-sequence blob-URL leak** — `addSequence` tracks `m._frameUrls`; `disposeMedia` revokes them (was: N-1 orphaned per import).
- [x] **Cross-project texture leak** — `loadProject` disposes+resets `state.mediaTrash` (was: deleted-media GL textures from prior project survived Open).
- [x] **Reshape Mask applies to existing members** — `regenComp` reuse branch sets `ex.props.mask=g.mask` (was: only new slots).
- [x] **Audio-reactive respects mute/solo** — `audioLevelAt` adds the lane mute/solo guard (matches the baked mix). Verified: level 0.8→0 when muted.
- [x] **Proxy-error badge refresh** — `pumpProxy` catch calls `updProxyUI(m)` (was: frozen "PROXY n%" on clips).
- [x] **Nudge no longer spams undo** — `nudgeSel(dt,noUndo)` guarded by `e.repeat` (was: ~30 snapshots/s on auto-repeat wiped history).

### LOW (fixed)
- [x] Right-click reset now covers `glow/chroma/blur/feather/crop`.
- [x] Fulldome clips hide inert FX rows (only opacity+grade shown). Verified: 17→12 rows.
- [x] Audio mix fade-in accounts for front-trim (`used=t0-c.start`).
- [x] spiral/wave `turns` exposed in the compose dialog (`#cTurns`, shown for spiral/wave).
- [x] Group raise/scale use a drag-start base so clamping never collapses per-member offsets. Verified: raise-to-90-and-back preserves els 10..60.

### DEFERRED / NOT APPLIED
- [ ] Delete-undo of a bin-only media (no clips) still doesn't restore it — the reviewer's "drop the clip-ref guard" fix was REJECTED because it would resurrect deleted media on unrelated undos; proper fix needs media in the undo snapshot.

_Verdict: rounds 9-11 are now adversarially clean — 15/17 confirmed bugs fixed and live-verified, the lone deferral is the long-standing media-undo gap (correctly left for a snapshot-level fix rather than a regression-prone shortcut)._

## ROUND 11 — User-requested polish (viewport, proxy UX, fulldome source, artistic comps)
_All items implemented and live-verified against the running app (RTX 4060, Chrome/WebGL2 preview)._

- [x] **2D viewport fills the full panel** (zoom no longer locks to a square) — the 2D master canvas was a centered square (`min(W,H)-30`); now it fills the whole panel rectangle. Added a `u_aspect` uniform to the blit shader so the fisheye disc stays circular and centered, and made `f2pix`/`pix2f` (and the wheel zoom-to-cursor) aspect-aware. Verified: canvas now rectangular (988×597), pick round-trips az0/el35 exactly, and zooming reveals more (red-pixel coverage 50k→80k) instead of clipping to a square.
- [x] **Proxy progress on the timeline clip + media proxy filter** — clips now show an ORIGINAL / PROXY n% / ⚡ PROXY badge plus a live progress bar (updated in real time by `updProxyUI`, classes `.cpx`/`.cpxbar`); added a media-panel proxy filter (`#proxySeg`, `state.mediaProxyFilter`: All / ⚡ with-proxy / ○ originals). Verified: badge ORIGINAL→PROXY 45% (bar at 45%)→⚡ PROXY (bar hidden); proxy filter shows proxied, originals filter hides them.
- [x] **Per-clip "Fulldome source" toggle** — `props.fulldome` marks a clip whose texture is already a fisheye/dome master; it's drawn 1:1 into the composite via a dedicated fullscreen program (`PFD`/`fdVAO`, with opacity/grade/dither/blend/mirror) instead of the gnomonic patch warp. Verified: coverage jumps from a 31,690-px patch to 236,902 px (fills the dome ~7.5×); opacity still applies.
- [x] **Artistic composition layouts** — added `spiral`, `phyllo` (sunflower / golden-angle 137.5°), `wave` (sine band), and `fib` (even fibonacci dome scatter) to `compLayout`, the compose dialog kind selector, and `kindES`; field visibility (`sync()`) updated. Verified: spiral els ramp 10→60 over 3 turns; phyllo/fib use the 138° golden angle; fib spreads 49→12; wave oscillates (els 11–59).

## ROUND 10 — Advanced roadmap features (color, FX, shapes, transitions, scopes, audio)
_All items implemented and live-verified against the running app (RTX 4060, Chrome/WebGL2 preview). Closes the round-9 deferred color-grade/dither item plus the next tier of creative + delivery roadmap bets._

- [x] **Per-clip primary color grade + output dither** (closes the round-9 deferred "output color management / anti-banding dither"). Exposure/contrast/saturation/temperature/tint added to the `FX` defs — so they inherit sliders, keyframes, and i18n labels for free — and applied in the warp shader `FSW` with neutral defaults (zero regression: geometry/handedness paths untouched). Ordered dither at output kills 8-bit banding. Verified exact: neutral 120; exposure +50→170 (×1.41), −50→85 (×0.71); temperature→rgb(159,120,82).
- [x] **Per-clip glow/bloom + chromatic aberration** — `u_glow`/`u_ca` uniforms in `FSW` (bright-halo bloom; radial R/B channel offset), keyframeable like any FX and working in export too (no FBO post-pass needed). Verified: glow pushes gray-200→white (channel sum 600→765); chroma yields 44 R/B edge-fringe px (0 with FX off).
- [x] **Vector shape clips** — `createShapeClip()`/`renderShapeMedia()` make rect/ellipse/line (fill/stroke) as a canvas-texture media exactly like text; new "▭" button in the media rail; inspector editor for shape params; serialized + re-rendered on load. Verified: blue rect rgb(91,141,239), edited to red ellipse, full save/load round-trip.
- [x] **Dome-anchored title presets** — right-click the "T" button → Title (upper) / Subtitle / Lower-third / Credits, placing styled text clips at sensible dome elevations. Verified: title el 62, lower-third el 18 + outline + 2 lines.
- [x] **Transition library** — per-overlap transition on the incoming clip (`b.trans`): crossfade (default) + dip-to-black, applied in `compositeClips`. Verified: dip hits 0 (black) at overlap midpoint vs crossfade 336.
- [x] **Export presets + sequential render queue** — named presets (codec/res/fps/bitrate) saved in the project (`state.exportPresets`, serialized) with a dropdown + Save; `_exq`/`pumpExportQ()` runs queued jobs one-at-a-time (fixes the old concurrent-export conflict, enables batch masters). Verified: preset save/apply/serialize; 2 jobs ran sequentially.
- [x] **Video scopes overlay** — `drawScopes()` reads the composite and draws a throttled RGB histogram overlay; toggled from the ⌘K palette (`state.view.showScopes`). Verified: overlay created, visible, histogram drawn.
- [x] **Beat detection + audio-reactive modulation** — `detectBeats()`/`detectBeatsCmd()` finds energy onsets in the selected audio clip → drops locators; per-clip "React to audio" pulses size via a deterministic envelope (`audioLevelAt()` reading precomputed `peaks`), so it bakes into export deterministically (no live-only RNG). Verified: 3 beats→3 locators; level 0.85 loud / 0 quiet → patch 53,609 vs 11,856 px.
- [x] **UX quick wins** — clip nudge Alt+←/→ (±1 frame, +Shift = ±1 s, `nudgeSel()`); "Set clip start (seconds)…" command; F1 / ? opens the searchable ⌘K command palette; textarea added to the shortcut-guard so typing shape/text content doesn't fire shortcuts. Verified: nudge ±0.0167 / ±1.0; F1 opens palette; all 11 new functions present.

### KNOWN / DEFERRED (round 10)
- [ ] **Per-projector slice + edge-blend export** — needs venue projector geometry (count/overlap/warp), not buildable in the single-folder app without that config.
- [ ] **SPOUT/NDI live output** — requires a native module; out of scope for the portable single-folder build.
- [ ] **Higgsfield MCP round-trip bridge** — depends on external MCP/network deps not available inside the app.
- [ ] **Visual labeled undo-history panel** — deferred as invasive (would touch the verified snapshot/restore core); ⌘K already exposes Undo/Redo.

## ROUND 9 — Roadmap features (audio, blend, sequences, streaming export)
_All items implemented and live-verified against the running app (RTX 4060, Chrome/WebGL2 preview). Delivery-blockers from the feature roadmap + the top creative win._

### DELIVERY-BLOCKERS
- [x] **Audio baked into export** (roadmap blocker #1 — masters were shipping silent). `exportAudioMix(t0,endT)` renders the timeline's audio clips through an `OfflineAudioContext` (respects lane mute/solo, clip in-point, and fadeIn/fadeOut as gain ramps). MP4 export now muxes an AAC track via `muxAudioAAC()` (WebCodecs `AudioEncoder` `mp4a.40.2` → mp4-muxer audio track); PNG-sequence export writes an `audio.wav` sidecar (`audioBufferToWav`, 16-bit PCM). Verified: MP4 with audio = 38.5KB vs 1.1KB without (≈37KB AAC delta) at 256²/1.5s.
- [x] **Streaming PNG-sequence export to disk** (roadmap blocker #3 — RAM-zip OOMs at 75min/4K; was the round-8 "buffers fully in RAM" deferral). In Electron the export now prompts for a folder (`dsp:chooseExportDir`) and writes each frame PNG straight to disk (`dsp:writeBinary` + `dsp:ensureDir`) with zero in-RAM buffering, plus the `audio.wav` sidecar. Browser keeps the in-RAM zip path (now also includes `audio.wav`). New IPC channels added in main.js/preload.js — closes the round-8 "no binary Save IPC yet" deferral.
- [x] **Image-sequence ingest** (roadmap blocker #4 — Higgsfield/stop-motion frames arrived as separate stills). `importFiles` now groups ≥3 numbered same-prefix images into ONE media of kind `'sequence'`; `addSequence()` loads frames (fitImage-downscaled); `drawClip` samples the right frame by clip-local time at 24fps; `framePaths` serialized + a `reloadMedia` sequence branch re-links in Electron. Verified: 6 numbered PNGs → 1 clip, pixel-exact frame sampling while scrubbing.

### CREATIVE WIN
- [x] **Per-clip blend modes** (top creative win for the dark-dome look). New `blend` clip prop (normal/add/screen/multiply) with a `setBlend()` per-draw `gl.blendFuncSeparate` in `drawClip`, an inspector selector, serialized in props. Verified exact compositing math: normal rgb 120, add 240, screen 184, multiply 57.
- [x] **Native Text/Title clip** (closes the roadmap "native text clip" big-bet — no text primitive existed before). `createTextClip()` makes a media of kind `'text'` rasterized to a canvas via `renderTextMedia()` (multi-line, font size, fill color, optional outline) and bound as a texture exactly like an image clip — zero shader changes. Editable from the inspector (content textarea + color + size + outline) with live re-render, new "T" button in the media rail. Text params serialized in `serMedia` and re-rendered on load (`renderTextMedia` in `loadProject`) so text clips round-trip fully with no external file in BOTH the browser and the .exe. Verified live: white "TITLE" → rgb(255,255,255); edited to multiline red @220px re-rasterized to 885×726 → rgb(255,42,42); full save/load round-trip preserved text/color/size and the live texture.

### KNOWN / DEFERRED (round 9)
- [ ] Output color management / anti-banding dither **deliberately deferred** — it would touch the verified-correct render shaders and is not a hard delivery blocker.
- [ ] Still-open big bets from the roadmap: per-projector slice export, SPOUT/NDI, MCP round-trip, primary color grade.

## ROUND 8 — Test-driven fixes (audit + live verification)
_All items implemented and live-verified against the running app (RTX 4060, Chrome/WebGL2 preview)._

### CRÍTICO
- [x] **Export default fixed** — dialog defaulted to MP4 @ 4096² but the H.264/WebCodecs encoder caps SQUARE frames at ~3072² on this GPU (3840²/4096² square → no codec; 4096×2048 wide works). Now default codec = **PNG sequence** (works at 4096²+, lossless/alpha, the pro fulldome master format); selecting MP4 probes `pickAvcCodec` for the chosen resolution and disables the Export button + shows a clear message if unsupported. `#fmtChip` no longer a static lie — updates live from the export selection; default reads "4096² · 60p · PNG".
- [x] **"Reshape…" edits in place** — `openCompose` accepts an `editGroup`; on Apply it mutates the group + `regenComp` instead of creating a duplicate composition stacked at the playhead.
- [x] **Custom PNG mask no longer shared across clones** — split/duplicate/paste of a masked clip was a use-after-free on one live `maskTex` (deleting one half blanked the other / double-freed). Clones now get `maskTex:null` + `rebuildMaskTex` from `maskData`; duplicate/paste also clear `groupId`/`slot` so a copy doesn't ghost-join a composition.
- [x] **Undo/redo restores `state.selIds`** (multi-selection) — snapshot/restore previously ignored `selIds` → ghost selection after undo. `rippleDelete` now clears `selIds` too.
- [x] **Unsaved-changes guard on close** — browser `beforeunload` (when dirty) + Electron main-process `win.on('close')` confirmation dialog via new `dsp:setUiState` IPC (renderer pushes `{dirty,lang}`; main.js shows a bilingual Save/Cancel warning). main.js native dialogs (save/open/locate) now bilingual via `uiLang`.
- [x] **WebGL context-loss handling** — `webglcontextlost` (preventDefault + stop export/playback + force autosave) and `webglcontextrestored` (reload to rebuild GL) prevent the permanent-black-viewport-no-recovery failure on a GPU/TDR reset. `render()` early-returns while context is lost.

### ALTO
- [x] **Razor click & media-drop time correct when timeline scrolled** — removed a double-count of `#tlscroll.scrollLeft` against the already-scroll-offset `#tracks` rect. Verified: at scrollLeft 3880 a razor click split exactly at the clicked clip's center.
- [x] **Re-link missing media** — a "Locate file…" context-menu item on missing media (Electron) calls the previously-dead `dsp:pickMedia` → sets path → `reloadMedia`.
- [x] **Autosave failure surfaced** — warns in the status bar when it fails (localStorage quota exceeded) instead of silently swallowing the error.

### MEDIO/BAJO
- [x] `serProject`/`loadProject` now persist & restore `workIn`/`workOut`, folders, `media.folder`, and `tl` (bpm/sig/tcMode/pxPerSec) — were silently lost on reopen. `newProject` resets them.
- [x] Keyframes re-based on razor split (right half shifted by the cut offset, each half drops out-of-range kfs) so they no longer become orphaned/uneditable.
- [x] Transform/Effects `.sechead` inspector headers now actually collapse/expand their rows (were dead `cursor:pointer` controls with no handler).
- [x] Proxy blob URL tracked (`m.proxyUrl`) and revoked in `disposeMedia` — fixes a per-import/delete memory leak.
- [x] Reduced-motion preference now persists (localStorage `domeProRM`).
- [x] MP4 codec option disabled in the export dialog when WebCodecs is unavailable.
- [x] Escape closes the topmost modal overlay.
- [x] i18n: curve-editor "No selection" and locator default name "Locator" now go through `T()`.

### KNOWN / DEFERRED (not yet done)
- [ ] Composition Count-change still regenerates members from defaults (per-member non-positional tweaks not preserved).
- [ ] Curve-editor keyframe hit-test still time-only (no Y axis).
- [ ] "Delete media" undo doesn't restore the media object.
- [ ] Large PNG-sequence exports buffer fully in RAM.
- [ ] Electron exports still route through the browser download path (no binary Save IPC yet).

## ROUND 7 (2026-06-17) — the deferred improvements (verified by eval)
- [x] **rVFC video upload** in playback: HAS_RVFC + pumpVF/stopVF; ploop uploads via requestVideoFrameCallback only on new frames (fallback to per-rAF upTex if unsupported); pause cancels. Verified play/pause no-error (images) + wiring.
- [x] **Multi-clip selection**: state.selIds; shift-click toggles, plain click selects one, **marquee** (startMarquee) on empty timeline selects intersecting clips; move drags ALL selected by the same delta; deleteSel deletes all; renderTimeline highlights all. Verified select=2, move "1|4", delete 2.
- [x] **Audio waveform on clips**: drawClipWave renders peaks at the clip's real width (window inP..inP+dur) instead of the stretched 108px thumb. Verified canvas present on audio clip.
- [x] **Discrete GPU (RTX) safely**: main.js writes HKCU UserGpuPreferences = GpuPreference=2 (High performance) for the exe path on launch (no admin, no risky Chromium flags). reg command verified valid + applied.

## ROUND 6 (2026-06-17) — AUDIT fixes (verified by eval)
- [x] **Custom PNG mask survived save/load/undo** (was: maskTex serialized to `{}` → bad binding; mask image lost). Fix: maskUp stores `c.maskData` (downscaled dataURL); `serClip()` strips live `maskTex`; loadProject/restore rebuild via `rebuildMaskTex(c)` or drop stale 'custom'. Verified round-trip + undo (snapshot also uses serClip; selLane added).
- [x] **Media texture/URL leak on Delete media** → `disposeMedia(m)` (revokes srcUrl/blob thumb, deletes tex) + deletes clip maskTex; newProject refactored to use it.
- [x] **`. chip` dead CSS** fixed → `.chip`.
- [x] **Perf: renderTimeline throttled** during drags via `scheduleTimeline()` (rAF-coalesced) in clip-drag/fade-drag/marker-drag; final renderTimeline on pointerup.
- [x] **Export work area (I/O range)**: runExport now exports [workIn,workOut] if set (t0 offset), else full duration. Verified 2–4s→20 frames, full→100.
- [ ] DEFERRED (rationale): rVFC video-upload in ploop (can't verify playback headless — video pauses; high regression risk blind); multi-clip marquee selection (feature); audio waveform on clips (feature); force discrete GPU on hybrid (caused black before — risky). All documented as recommended improvements.

## ROUND 5 (2026-06-17) — REVISIONS batch (IN PROGRESS — paused by user)
DONE this round:
- [x] **CRITICAL: viewports were locked** — root cause: `#grid{pointer-events:none}` but ALL viewport handlers are on `#grid`, so the real mouse never reached them (synthetic dispatch had masked it). Fixed → `#grid{pointer-events:auto}` (index.html ~L85). Verified: 2D pan ✓, 3D orbit ✓, wheel zoom ✓, elementFromPoint='grid'.
- [x] **Export error "Cannot call encode on a closed codec"** — root cause: codec string hard-pinned H.264 **level 4.0** (`avc1.640028`) regardless of res; at 4096² that exceeds the level → codec closes. Fixed: added `pickAvcCodec(w,h,bitrate,fps)` (tries profiles high/main/baseline × levels 6.2→4.0 via isConfigSupported) + robust encoder error handling (encErr flag, state guard, clear bilingual message; >4096² → tells user to use PNG). Verified 1024² MP4 exports w/o error in preview (headless has no HW H.264 at 4096²; user's NVENC machine will).
- [x] Investigated **"image renders transparent / only contour"** — could NOT reproduce: opaque image reads back [40,27,54,255] opaque at element center. Likely the user loaded a transparent-bg PNG or a video. ASK user for the specific file. Engine render is correct.

DONE (all verified live by eval; preview screenshot is flaky on this WebGL page so verification is pixel/state-based):
- [x] **app.js cache bug** (was blocking ALL verification): Python http.server heuristic-cached app.js. Fixed: index.html now loads app.js via a tiny inline loader that appends `?v=Date.now()` ONLY over http (dev); file:// (packaged exe) loads it plain so the path stays valid.
- [x] Timeline VERTICAL scroll synced: #tlscroll scroll → `#laneHeaders` `translateY(-scrollTop)`; wheel over #trackHdr scrolls tracks. Verified translateY(-40px).
- [x] Middle-button drag = horizontal+vertical Pan on #tlscroll (any tool); #tracks pointerdown now ignores non-left buttons. Verified scrollLeft moved.
- [x] Track sidebar: click selects (state.selLane + `.lanehdr.sel` highlight); dbl-click renames; **Ctrl+R** rename track, **Ctrl+T** new track, **Ctrl+D** duplicate track (renameLane/duplicateLane). Verified.
- [x] **Ctrl+R** renames selected LOCATOR (selMarkerId) — takes priority over track rename.
- [x] Razor: custom cyan-blade cursor (RAZOR_CUR data-URI); razorClip already splits at click x (Premiere-style) — verified.
- [x] **Fades drag-from-clip**: round dot handles at clip top corners (`.fadeh.fadeL/.fadeR`) → startFadeDrag sets fadeIn/fadeOut. Verified fadeIn=1.0/fadeOut=0.5. (Inspector numeric fades kept as complement.)
- [x] **Crossfade**: compositeClips already crossfades same-lane overlaps; added visual X indicator (`.xfade`) in the overlap region. Verified 1 xfade el.
- [x] **Snap to grid** in all modes (snapGrid() = musical step in bars, ruler tick otherwise). Verified 1.53→1.5.
- [x] Curves: **hover highlight** (cv._hoverKf → bigger marker + value tooltip).
- [x] Curves: create only via dbl-click (single-click moves/grabs, never creates); **right-click point → "Set value…"** prompt.
- [x] **Resize handles** (`.hres` #tlResize / #curveResize) to grow/shrink the timeline + curve panels (hResize()).
- [x] **Curve box shares timeline scale/scroll**: drawCurveGraph X = (c.start+t)*pps - tlscroll.scrollLeft; curveParams=194px aligns graph under tracks; tlZoom/scroll redraw curve; ctrl-wheel in curve box zooms both (curveZoomAt). Verified kf@t1→X240, zoom syncs pps.
- Pending/ASK: "transparent image" still not reproduced (engine opaque) — need the user's specific file. Final exe rebuild after this round.

## ROUND 4 (2026-06-17) — language toggle + visualizer verify
- [x] **EN/ES language toggle** (i18n): state.lang (persisted localStorage domeProLang); T(en,es); applyLang() for static chrome; dynamic strings wrapped in T() (cardinals, propLabel for TF/FX, maskES, commandList(), export/compose/prefs modals, group inspector, context menus, flashStatus, status, hint); selector English/Español in Preferences (setLang() re-renders). Default English. Verified EN↔ES live + screenshot (ES cardinals CENIT/ATRÁS/IZQUIERDA/DERECHA/FRENTE).
- [x] 3D visualizer confirmed rendering in preview (Viewer + Orbit, dome wireframe, not black) — exe verify pending final build.

## ROUND 3 (2026-06-17)
- [x] **3D viewer BLACK in the .exe** — fixed: removed aggressive GPU command-line switches in main.js (ignore-gpu-blocklist + enable-zero-copy + force_high_performance_gpu forced a non-compositing GPU path on hybrid graphics → black). Kept default accel + enable-accelerated-video-decode. Also removed `desynchronized:true` from the WebGL2 context. Preview (Chrome) always rendered fine — was exe-specific. Orbit verified working (yaw/pitch change live).
- [x] **Language flipped back to ENGLISH** (3rd change: EN→ES→EN). Reverted index.html + app.js fully to English (cardinals, commands, modals, menus, prefs, status, hint). Verified 0 Spanish in DOM. Quality control labels Full/½/¼. NOTE: consider an EN/ES toggle in Preferences to stop the flip-flopping.

## ROUND 2 (new user requirements — 2026-06-17)
- [x] **Language REVERSAL**: user now wants NO English text → full UI in **Spanish** (inverse of prior directive). Swept index.html + app.js via the 275-string audit map; cardinals FRENTE/ATRÁS/IZQUIERDA/DERECHA/CENIT; commands, modals, menus, prefs, status. Verified 0 English in DOM. (Also fixed invalid `[data-v=2d]` palette selectors → quoted.)
- [x] **Free 3D camera** (orbit + viewer): pitch clamp widened to ±(HALF_PI-0.02) + lookAt hardened vs zenith NaN. Verified live: pitch reaches +1.551/-1.551, both modes rotate 360° yaw. (Live + workflow agreed.)
- [x] **Left/Right 2D↔Viewer**: VERIFIED correct live (R at az45 → viewer right, not mirrored) AND by audit (single intentional u_flipx=-1 for spectator). NO change — do not "fix" cameraMVP spec branch or it double-inverts.
- [x] **GPU max**: WebGL2 context powerPreference:'high-performance' + desynchronized; Electron main.js GPU switches (ignore-gpu-blocklist, enable-gpu-rasterization, enable-zero-copy, enable-accelerated-video-decode). Note: real dGPU pick may also need Windows per-app High-performance / NVIDIA Control Panel.
- [x] **Proxies always-on**: import now always enqProxy (removed useProxies gate); export still uses originals.
- [x] **Preview quality Completa/½/¼** (Adobe-style): state.previewQuality scales ONLY the GL backing store in resize() (grid overlay stays full res; export unaffected via exporting guard). Segmented control in viewport toolbar. Verified 449→225→112 px.
- [x] **Project lifecycle (no data loss)**: serProject() v2 stores media file PATHS (Electron); Nuevo (Ctrl+N, confirm if dirty) / Guardar (Ctrl+S, Electron save dialog+remembered path / browser download) / Abrir (Ctrl+O, Electron reads file & auto-reloads media from disk via file:// → reloadMedia; browser falls back to relink-by-name). dirty flag in title. Autosave + undo carry everything. Verified functions + serialize in browser mode.
- [x] **Electron packaging**: package.json (electron 42.4.1 + electron-builder 26.15.2, portable+nsis, icon alma-logo.png), main.js (GPU switches, secure BrowserWindow, IPC fs/dialogs), preload.js (webUtils.getPathForFile + IO bridge). npm install done. `npm run dist` building portable .exe in dist/.
- [x] Build verified: dist/ has `Dome Studio Pro 1.0.0 portable.exe` (89.7 MB) + `Dome Studio Pro Setup 1.0.0.exe` (NSIS installer). Smoke-test: portable exe launched 4 Electron procs (main+GPU+renderer+utility), no crash → packaged app boots, index.html + WebGL2 OK. Rebuilt after final ES string fixes.
- [ ] (deferred polish: automation per-track lane; rVFC playback upload; gradient→flat; aria-labels) — all explicit asks A–I + round-2 asks DONE.

## IMPLEMENT NOW (ordered, verified fixes)
P0 correctness:
1. compositeClips: 3+ overlaps drop earliest clip — draw all-but-top-two painter-style xf:1, crossfade top two with Math.max/min clamp (NOT clamp()).
2. startAudio: clamp offset/len to m.buffer.duration in both branches (silent drop after relink).
3. fadeFactor: normalize when fadeIn+fadeOut>dur (mid-clip dip after trim); re-clamp fades in trim/razor.
4. Export: module `exporting` flag → `if(exporting)return` at top of render() (stale on-screen resize during export).
5. Orbit pitch ceiling → HALF_PI-0.001 (reach zenith); floor -0.05.
P0 design/contract:
6. i18n: sweep ~85 Spanish strings → English; `<html lang=en>`; centralize in STRINGS.
7. Blue→grey: all toggle/'on' states #313640; blue reserved for playhead/selection/keyframes/import-export only. Play glyph neutral; Ring neutral; group headers muted.
8. Disabled states: global token; drive from selection/target (Split/Delete/Copy/Dup/kf when !sel; locator nav when no markers; etc.).
P0 features:
9. tcMode 3-way: timecode/frames/bars; fmtTime() dispatcher; remove quantize dropdown.
10. Composition Groups: state.groups + clip.groupId/placement; makeClip factory; createGroup ring/grid/random; drawClip composites placement+group.offset+props; group vs individual edit scope; openCompose modal.
P1:
11. pickClip → aspect-aware ellipse (non-square media mis-select).
12. NumberBox editable (dbl-click type, wheel/arrows, focusable).
13. Collapse-to-28px rail (media + inspector); persist widths.
14. Bezier keyframe handles + per-kf interp; add point via dbl/right-click.
15. Circular PNG-alpha mask (generated radial-alpha) + persist masks on save/load.
16. Locators: select, rename, drag w/ snapping (user req).
17. Automation (T) per-track lane.
18. Hint pill/status/cursors state-driven; fix `.chip` selector.
19. Undo/save coverage for groups/handles/masks.
20. Gradient→flat chrome; unify button/segmented family; aria-labels.

## FUTURE BACKLOG (ranked)
- Multi-clip selection + group transforms (marquee/shift-click) — High
- Viewport snapping to dome guides (cardinal az, el rings, locators) — High
- Export work-area/range + real background queue (cancel/pause/ETA) — High
- Proxy/full-res toggle + IndexedDB proxy cache across sessions — Med-High
- GPU/CPU/RAM telemetry + frame-time graph — Med-High
- Color management/output profile + calibration pattern generator — Med-High (planetarium)
- Spherical/equirect + cubemap import auto-warped to master — Med
- Nested/linked clips + saveable composition templates — Med
- Keyframe ergonomics (copy/paste, box-select scale, tangent presets) — Med
- Onion-skin / motion-path overlay for animated clips — Med
- Blend modes (add/screen/multiply) + adjustment layers — Med
- Audio waveforms on clips + gain/pan envelopes — Med
- Customizable shortcuts + saved workspaces — Low-Med
