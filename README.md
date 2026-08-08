# Immersive Studio Pro

Editor de vídeo inmersivo de escritorio: **domo fulldome**, **pantalla plana 2D** y **sala 360°**.
Aplicación Electron con motor WebGL2, sin sistema de compilación. Alma Digital Studio, versión 1.0.

---

## Qué hay en cada sitio

### Código

| Ruta | Qué es |
|---|---|
| `app.js` | El programa entero: motor GL, línea de tiempo, inspector, export, interfaz. 14 500 líneas. |
| `index.html` | Marcado de la ventana y la hoja de estilo completa. |
| `main.js` · `preload.js` | Proceso principal de Electron y el puente hacia la página. |
| `splash.html` · `splash-preload.js` | Ventana de arranque. |
| `mp4-muxer.min.js` | Biblioteca de terceros, vendorizada. |
| `native/` | Añadidos nativos: `ndi-send` y `spout-send`. |
| `vendor/ffmpeg/` | Binario de FFmpeg por plataforma. Fuera del repositorio: ver `docs/FFMPEG.md`. |
| `assets/` | Iconos, tipografías y material de la aplicación. |
| `scripts/` | `deploy-verificado.ps1` (despliegue) y `mapa-codigo.py` (mapa de `app.js`). |

### Documentación

| Ruta | Qué es |
|---|---|
| **`docs/ESTRUCTURA-DEL-CODIGO.md`** | **Por dónde empezar a leer el código.** Los tres procesos, el modelo de datos, el recorrido de `app.js`, las trampas conocidas. |
| `ARCHITECTURE.md` | Cómo funciona el motor: render, flujos, conceptos transversales. |
| `COMPONENTS.md` | Inventario componente a componente. Es la «estructura de carpetas» que el código no tiene. |
| `PLAN.md` | Bitácora por rondas: cada cambio con su motivo y sus mediciones. Lo más nuevo, arriba. |
| `CLAUDE.md` | Contrato del proyecto: convenciones, comandos, gotchas. |
| `docs/adr/` | Diez decisiones de diseño con su porqué. |
| `docs/NEXT.md` | Cola de trabajo pendiente. |
| `docs/FFMPEG.md` · `docs/MACOS.md` | Export por FFmpeg y compilación en macOS. |
| `docs/manual/` | Fuentes del manual de usuario y su generador. |
| `docs/Immersive Studio Pro - User Manual.pdf` | El manual de usuario, 73 páginas. |
| `docs/historial/` | Auditorías, investigaciones y propuestas cerradas. Contexto, no referencia. |

### Carpetas de trabajo

| Ruta | Qué es |
|---|---|
| `tests/` | Tests que corren **sin la app levantada** — `npm test`. Leen `app.js` como texto (es un script clásico: no se puede importar) y comprueban REGLAS, no parches concretos. |
| `scratchpad/` | Sondas de verificación (`.mjs`) contra la aplicación **en marcha**, por CDP. Sus volcados de imagen se regeneran y no se versionan. |
| `_backup/deprecated/` | Código retirado, con fecha. Se archiva en vez de borrarse (`docs/adr/adr-0007`). |
| `dist/` · `node_modules/` | Salida de compilación y dependencias. Regenerables. |

---

## Comandos

```bash
npm start                                   # desarrollo
npm run dist                                # .exe: instalador NSIS + portable
npm run dist:mac                            # sólo funciona ejecutándolo EN un Mac
node --check app.js && node --check main.js  # comprobación de sintaxis
npm test                                    # tests sin navegador (~200 ms)
```

Las **sondas** necesitan la app levantada con el puerto de depuración abierto — miden comportamiento real
(píxeles, DOM, deshacer) en vez de leer el fuente:

```bash
npx electron . --remote-debugging-port=9222   # en una terminal
npm run redes                                 # en otra: TODAS las redes de regresión
node scratchpad/r320-verif.mjs                # o una suelta
```

Las **redes** (`npm run redes`) son el subconjunto de sondas que comprueban una REGLA y no un parche concreto —
«un gesto que cambia el proyecto se deshace con un Ctrl+Z», «si cambia algo de lo que el resultado depende, la
caché falla»—. Se pasan enteras antes de compilar: en R320 dos de ellas llevaban dos rondas sin correrse.

Despliegue — **siempre con el script, que además verifica**:

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts/deploy-verificado.ps1"
```

Verificar sobre el `.exe` real, con sondas:

```bash
npx electron . --remote-debugging-port=9222
```

---

## Datos del proyecto

- **Extensión de proyecto:** `.isp` (JSON). Abre además `.ise` y `.rdome` de versiones anteriores.
- **Identificador:** `com.almadigitalstudio.immersivestudiopro`.
- **Sin dependencias de npm en tiempo de ejecución.** Los dos añadidos nativos son opcionales y sólo Windows.

---

## Para revisar el código por primera vez

Leer `docs/ESTRUCTURA-DEL-CODIGO.md`. Describe el orden del repositorio, el recorrido de `app.js` por tramos de
línea y —lo que más ahorra tiempo— las **trampas conocidas**: una decena de cosas que parecen errores y son
intencionadas.
