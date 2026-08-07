# El manual de usuario — cómo se hace y cómo se rehace

Dos salidas del MISMO texto:

- **`docs/Immersive Studio Pro - User Manual.pdf`** — 79 páginas, A4, para imprimir o leer en el escritorio.
- **`docs/manual/manual-web.html`** — la versión de pantalla, de una sola columna y con las imágenes
  empotradas en `data:`, para leerla en el teléfono. Se genera con `build/web.py`.

No son dos manuales: la de pantalla **reutiliza `manual.html`** y sólo le cambia la hoja de estilo. Escribir
el texto dos veces sería garantizar que las dos versiones se separen.

## La regla que lo sostiene

**Nada del manual se escribe de memoria.** Las fotos se capturan de la aplicación en marcha y las tablas de
menús, atajos, efectos y composiciones se leen de los catálogos vivos (`commandList()`, `FXTYPES`,
`ANIM_PRESETS`, las opciones reales de los cuadros). Un manual que documenta funciones que ya no existen es peor
que no tener manual, y esa es exactamente la avería que aparece cuando alguien transcribe a mano.

Por eso el índice, el capítulo de atajos y el de efectos se **generan** al imprimir, desde `build/datos.json`.

## Rehacerlo

Con la aplicación abierta en modo depuración:

```bash
npx electron . --remote-debugging-port=9222
```

Después, en este orden:

```bash
node docs/manual/build/extraer.mjs
node docs/manual/build/extraer2.mjs
node docs/manual/build/capturar.mjs
node docs/manual/build/capturar.mjs docs/manual/build/tomas2.json
python docs/manual/build/armar.py      # el PDF
python docs/manual/build/web.py        # la version de pantalla
```

- **`extraer.mjs` / `extraer2.mjs`** → `build/datos.json` y `build/datos2.json`: comandos y atajos, catálogo de
  efectos con sus parámetros, presets de movimiento, máscaras, mezclas, menús, códecs de export y tipos de
  composición.
- **`capturar.mjs`** → `img/*.png`: monta los proyectos de demostración, abre cada cuadro y captura por
  selector, a escala 2 porque el destino es papel. La lista de tomas está en `build/tomas.json`.
- **`armar.py`** → el PDF: imprime **dos veces**. Un índice sin números de página no es un índice, y Chromium no
  sabe en qué página cae cada capítulo; así que la primera pasada sirve para medir —se buscan los titulares en
  el PDF resultante— y la segunda ya lleva los números puestos. Luego pega portada y cuerpo y escribe los
  marcadores.

`manual.html` es el texto. Al cambiar algo de la aplicación que el manual describa, se edita ahí y se vuelve a
ejecutar `armar.py`; si lo que cambió fue un menú, un atajo o un efecto, hay que volver a pasar `extraer.mjs`
primero, porque esas tablas no están escritas en el HTML.

## Trampas que ya costaron una vuelta

- **La portada se imprime aparte.** Chromium aplica el pie de página a todas las hojas y reserva margen para él;
  con una portada a sangre eso obliga a elegir entre portada encajonada o documento sin numerar. Se imprimen los
  dos rangos por separado (`pageRanges`) y se pegan con PyMuPDF.
- **`search_for` devuelve la altura de la LÍNEA, no del tipo.** Filtrar titulares por esa altura metía cuatro
  capítulos en la página equivocada, porque un párrafo destacado a 11,6 pt con interlineado 1,55 mide lo mismo
  que un titular. Se identifican por **tamaño de fuente** del span (19–24 pt) y se exige orden creciente.
- **`querySelector('a, b')` devuelve el primero en orden del DOCUMENTO**, no el primero de la lista. El velo
  salía elegido antes que el cuadro que contiene y la foto era la ventana entera. `capturar.mjs` prueba los
  selectores uno a uno.
- **El recorrido guiado se lanza DESPUÉS** de que `startDemoProject` resuelve, y oscurece la interfaz entera. Se
  cierra por su propio camino (`_tourStop`) tras una espera, no borrando nodos.
- **Los `heredoc` de bash se comen las barras invertidas y los acentos graves.** Estos ficheros se editan con
  Write/Edit, no por heredoc.
