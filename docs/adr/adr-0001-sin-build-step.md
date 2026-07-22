# ADR-0001: Sin build step (carga directa por `<script>`)

- **Estado:** Accepted
- **Fecha:** 2026-07-22 (documenta una decisión pre-existente)
- **Deciden:** Beltrán, Claude

## Contexto
Es una app de escritorio de un solo desarrollador. Un bundler (webpack/vite/esbuild) agrega una capa de tooling,
watch, source-maps y tiempos de build entre editar y ver el cambio.

## Decisión
No hay build step. `index.html` carga `mp4-muxer.min.js` y `app.js` con `<script>`. El renderer corre el JS tal cual.
Para ver cambios en el `.exe` empaquetado hay que `npm run dist` (el asar es lo que corre); en dev, `npm start`.

## Consecuencias
- (+) Ciclo editar→ver directo; cero tooling de build; fácil de razonar.
- (+) `node --check app.js && node --check main.js` alcanza como verificación de sintaxis.
- (−) Todo el renderer vive en un `app.js` monolítico (~5000+ líneas) sin módulos → mantenibilidad frágil (ver ARCHITECTURE §9).
- (−) Sin tree-shaking ni minificación propia.

## Futuro posible
Si el monolito se vuelve inmanejable, partir en varios `<script>` por dominio (motor GL / timeline / inspector / export)
**sin** bundler mantendría esta decisión y mejoraría la navegación. Sería una ADR nueva que refina esta.
