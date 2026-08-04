# Immersive Studio Pro en macOS

Guía para poner el programa a funcionar en un Mac. El proyecto es **uno solo**: el mismo código corre en Windows y
en macOS, y es la compilación la que decide qué lleva cada sistema. **No hay ni debe haber un repo aparte para Mac.**

## Lo que hace falta

- **Node.js LTS** (https://nodejs.org) y **Git**. Nada más.
- **Xcode NO hace falta.** Los dos addons nativos están marcados `os: win32` y como opcionales, así que en macOS
  npm ni los intenta. Sin compilación nativa, no hace falta el compilador.

## Puesta en marcha

```bash
git clone https://github.com/beltranlihn/Immersive-Studio-Pro.git
cd Immersive-Studio-Pro
npm install
npm start
```

`npm start` ya abre el editor. Para tenerlo como aplicación de verdad en `/Applications`:

```bash
npm run dist:mac
```

Sale un `.dmg` y un `.zip` en `dist/`, para la arquitectura del propio equipo (Apple Silicon o Intel; no se fija
aquí a propósito).

## Gatekeeper: por qué NO molesta

La app no va firmada con Developer ID (`build.mac.identity: null`) y **no hace falta** mientras sea para uso
propio: la marca de cuarentena que dispara Gatekeeper la pone la **descarga**, no la compilación. Una app que
compilas tú en tu propio Mac no la lleva, así que abre sin avisos.

Sólo se vuelve un problema el día que el `.dmg` se le mande a otra persona por un enlace. Entonces hay que pagar
el Apple Developer Program (99 USD/año) y notarizar — y sólo se toca este `package.json`, nada del programa.
Si alguna vez una copia descargada da «la aplicación está dañada», se arregla con:

```bash
xattr -cr "/Applications/Immersive Studio Pro.app"
```

## Qué NO está en macOS, y por qué

| Función | Estado en macOS | Motivo |
|---|---|---|
| **Spout** (salida y entrada) | No disponible | Es DirectX, existe sólo en Windows. El equivalente Mac es Syphon, que sería un addon nativo nuevo. |
| **NDI** (salida y entrada) | No disponible | El addon compila, pero su cargador sólo tiene rama Windows (`ndi.cc`, `loadNDI()`). Para activarlo habría que añadir la rama `dlopen` de la dylib de macOS y ampliar el `os` de `native/ndi-send/package.json`. |
| **Medidor de GPU** en la barra de estado | Vacío | Va por `nvidia-smi`. Se apaga solo, sin error. |
| **Preferencia de GPU dedicada** | No aplica | Es un ajuste del registro de Windows para portátiles híbridos Intel+NVIDIA. En Mac no hay nada que forzar. |

Todo lo anterior degrada **solo**: `preload.js` carga los addons en `try/catch` y la interfaz avisa con
«no está disponible en este sistema». No hay que desactivar nada a mano.

## Lo que sí funciona igual (o mejor)

- **Todo el motor de render.** Es WebGL2 sobre Chromium, que en macOS va por ANGLE→**Metal**: aceleración por
  hardware completa. La memoria unificada de Apple Silicon le sienta bien a los composites de 4096²/8192².
- **El export.** El código **sondea** los códecs (`VideoEncoder.isConfigSupported` recorriendo perfiles y niveles)
  en vez de dar ninguno por supuesto, así que coge lo que ofrezca **VideoToolbox** — H.264 y HEVC por hardware.
  ⚠️ **Sin medir todavía:** el tope conocido de H.264 sobre ~4096² es un límite de **NVENC**, no del programa;
  en Apple Silicon podría no aplicar. Hay que comprobarlo en la máquina antes de darlo por bueno.
- **Doble clic en un `.isp`.** `main.js` ya trae el `app.on('open-file')`, que es la vía de macOS.

## Atajos de teclado

**No cambia ninguno: Cmd hace en el Mac exactamente lo que hace Ctrl en Windows.** El manejador de teclado mira
`e.ctrlKey || e.metaKey`, así que Cmd+T, Cmd+D, Cmd+Z, Cmd+S, Cmd+E, Cmd+K… responden igual. Un solo juego de
costumbres para las dos máquinas.

Lo que **sí** hubo que resolver (R206) es el menú nativo. `win.removeMenu()` vale en Windows pero **en macOS no
hace nada**: allí el menú es de la APLICACIÓN, así que Electron instalaba el suyo por defecto y los atajos de un
menú nativo se atienden **antes** de que la tecla llegue a la página. Traía tres choques:

| Choque | Consecuencia |
|---|---|
| **Cmd+R = Recargar** | El peor con diferencia: recarga la aplicación y, como el proyecto vive en memoria, **se pierde lo no guardado**. En el programa Cmd+R es «renombrar». |
| **Cmd+Z/X/C/V/A** | Capturados por los papeles del menú Edición, que sólo actúan sobre campos de texto → deshacer y copiar/pegar de clips quedarían muertos. |
| **Cmd+0 / Cmd+± ** | Zoom de toda la interfaz. |

Ahora `menuMac()` (main.js) instala un menú propio: **Aplicación** y **Ventana** estándar (Cmd+Q, Cmd+M, Cmd+W,
como espera un Mac) y **sin menú Ver** — no hay nada que recargar ni que ampliar. El menú **Edición** conserva sus
atajos porque en macOS hace falta para que copiar y pegar funcionen dentro de los campos de texto, pero sus
entradas **no usan los papeles del sistema**: reenvían la orden a la página (`dsp:edit`), que decide por el foco —
campo de texto → edición nativa (`webContents`, la única vía para pegar); cualquier otro sitio → se sintetiza la
misma pulsación que en Windows, de modo que **hay una sola lógica de atajos** y no dos que puedan desincronizarse.

## Llevarte un proyecto de Windows al Mac

El `.isp` guarda **rutas absolutas**, así que las de Windows (`C:\…`) no existen en el Mac. Desde **R204** eso se
resuelve solo: al abrir un proyecto, cualquier archivo que no esté en su ruta **se busca por nombre junto al
`.isp`** — su carpeta y **un** nivel de subcarpetas (`assets/`, `material/`, `video/`…). Así que si te llevas la
carpeta entera, se abre y funciona sin tocar nada.

- Los cortes, keyframes, efectos y composiciones **no dependen de la ruta**: los clips referencian los medios por
  identificador. Aunque un archivo no aparezca, el montaje sigue intacto.
- Los **proxies** viven junto al clip de origen (`MiClip.dsp-proxy-xxxx.mp4`), así que viajan con el material y se
  vuelven a enganchar.
- Sale un aviso «N medios reenlazados junto al proyecto — guarda para fijarlo». Si guardas, las rutas nuevas
  quedan escritas; si no, la próxima apertura las resuelve igual. No se pierde nada por no guardar.
- Si algo queda en rojo (porque no viajó), clic derecho sobre el medio → **«Localizar archivo…»**, o arrastra los
  archivos al panel de Medios: se reenganchan solos por nombre + tamaño.

## ⚠️ Pendiente de verificar EN un Mac (2026-08-04)

Tres cosas están razonadas sobre el código pero **nunca se han ejecutado en macOS**. Las dos primeras son
correcciones de la auditoría de agosto escritas *a ciegas*: el razonamiento es inequívoco, pero hasta que alguien
las vea funcionar no están verificadas. Ponerlas a prueba son diez minutos.

### 1 · Reabrir desde el Dock ([R242], `main.js` · `app.on('activate')`)
**El fallo que se corrigió:** en macOS cerrar la ventana no cierra la app. El clic del Dock llamaba a
`createWindow()`, que nace con `show:false` y espera a `finishBoot()`… cuyo guard `bootDone` seguía en `true`
desde el primer arranque. **La ventana no se mostraba nunca** y la única salida era Cmd+Q.

```
1. npm start
2. Cmd+W  (cerrar la ventana; la app sigue viva, con su icono en el Dock)
3. Clic en el icono del Dock
```
**Bien:** vuelve a aparecer la ventana del editor, con el proyecto en blanco y utilizable.
**Mal:** no aparece nada (habría que salir con Cmd+Q) → el arreglo no funcionó, avisar.

### 2 · Carpeta y archivo del proxy de composición ([R242], `app.js` · `ncBuild`)
**El fallo que se corrigió:** dos rutas con la barra invertida de Windows cableada. En macOS eso NO falla: crea
una carpeta llamada `…\nest proxies` —con la barra DENTRO del nombre— colgando un nivel por encima de donde
debía. Eran los dos últimos supervivientes de la familia que arregló R204.

```
1. Guardar un proyecto en cualquier carpeta.
2. Crear una composición CUADRADA (selecciona 2 clips → componer; el proxy sólo admite cuadradas).
3. Clic-derecho sobre la composición en Medios → «Nest proxy…» → Generar.
```
**Bien:** aparece una carpeta `nest proxies` **dentro** de la carpeta del proyecto, con el `.mp4` dentro.
**Mal:** aparece un archivo/carpeta con `\` en el nombre, o el `.mp4` cae un nivel más arriba.

### 3 · El techo de H.264 en el export (nunca medido en ningún sistema)
El tope conocido de ~4096² es un límite de **NVENC**, no del programa. En Apple Silicon el codificador es
**VideoToolbox** y podría no aplicar — o aplicar en otro tamaño. Merece la pena saberlo antes de exportar un
máster grande desde el Mac.

```
Export → domo 4096 → H.264.  Y luego 8192 si el de 4096 pasa.
```
**Apuntar** el tamaño donde deja de aceptar (el código sondea perfiles y niveles con
`VideoEncoder.isConfigSupported`, así que degradará solo a otro códec en vez de fallar). Si aguanta más que en
Windows, se puede subir el umbral que hoy empuja a PNG-seq / HEVC.

### Y de paso, lo que conviene mirar por ser la primera vez
- **Arranque en dos ventanas:** el splash cuadrado sale y la ventana 16:9 lo reemplaza (ADR-0009).
- **Atajos con Cmd:** Cmd+Z, Cmd+S, Cmd+R (renombrar, NO recargar), Cmd+T. El menú propio de R206 es lo que
  impide que Cmd+R recargue la app y se lleve por delante lo no guardado.
- **NDI y Spout** deben anunciarse como *no disponibles* sin romper nada (son `optionalDependencies` de win32).
- **Abrir un `.isp` hecho en Windows** llevándote la carpeta entera: el reenlace por nombre de R204 debería
  encontrar los medios solo.

## Al tocar código

`npm run dist` sigue siendo Windows (no cambia el ritual de despliegue de `CLAUDE.md`). Los específicos son
`npm run dist:win` y `npm run dist:mac`. **Compilar para macOS sólo es posible desde macOS**: electron-builder no
cruza de un sistema a otro.

⚠️ Los comentarios `_comment_*` del `package.json` van **fuera** del objeto `build`: electron-builder valida ese
objeto contra un esquema y aborta con cualquier clave que no conozca.
