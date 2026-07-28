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

## Al tocar código

`npm run dist` sigue siendo Windows (no cambia el ritual de despliegue de `CLAUDE.md`). Los específicos son
`npm run dist:win` y `npm run dist:mac`. **Compilar para macOS sólo es posible desde macOS**: electron-builder no
cruza de un sistema a otro.

⚠️ Los comentarios `_comment_*` del `package.json` van **fuera** del objeto `build`: electron-builder valida ese
objeto contra un esquema y aborta con cualquier clave que no conozca.
