---
name: arch-map
description: Navigate and maintain the Immersive Studio Pro architecture map. Use BEFORE searching the codebase to locate any component, function, button, DOM id, subsystem, render/viewer/export flow, or "where does X live" — and AFTER changing code to keep the map in sync. Covers COMPONENTS.md (the living component inventory), ARCHITECTURE.md (how it works), and docs/adr/ (why decisions were made).
user-invocable: true
argument-hint: "[find <thing> | update <subsystem> | adr <decision>]"
---

# arch-map — mapa vivo de Immersive Studio Pro

Este proyecto es un `app.js` monolítico (~5000+ líneas) SIN carpetas ni módulos. **No re-escanees el archivo entero para
ubicar algo.** El mapa ya existe:

- **`COMPONENTS.md`** (raíz) — inventario de referencia: cada componente con `archivo · función` / `#domId` · estado · ticket.
  **ES la estructura de carpetas** que el código no tiene. Índice maestro arriba (jump table por 8 subsistemas) + bloques de detalle.
- **`ARCHITECTURE.md`** (raíz) — el relato: C4/arc42, el pipeline de render, los flujos, los conceptos transversales (binding
  manual `state→render()`, handedness, i18n), riesgos/deuda técnica, glosario.
- **`docs/adr/`** — las decisiones y su porqué (sin build step, sin FFmpeg, proxies manuales, handedness, `.isp`, automatización AE).
- **`PLAN.md`** — bitácora por ronda (lo más nuevo arriba). **`CORRECCIONES-V2.md`** — el roadmap de tickets ([F2], [V1], etc.).

## Para LOCALIZAR algo (antes de grepear)
1. Abrí `COMPONENTS.md` y buscá en el **índice maestro** el subsistema (Motor GL, Render/modos, Timeline, Automatización,
   Export/proxies, Color/Inspector, Sala/Compose/Formatos, Shell/Media/UI).
2. La fila te da `archivo · función` (~L) y `#domId`. Saltá directo ahí con Read (offset a esa línea) o Grep del símbolo exacto.
3. Si necesitás el *porqué* o el *flujo*, mirá el bloque de detalle del componente, luego ARCHITECTURE.md, luego docs/adr/.
4. **Si el mapa NO tiene lo que buscás**, delegá la búsqueda al subagente `arch-explorer` (Agent tool, subagent_type
   "arch-explorer") — busca en su propio contexto y te devuelve solo `archivo:línea` (ahorra tokens del contexto principal).
   Cuando lo encuentres, **agregá la fila que faltaba a COMPONENTS.md**.

## Para MANTENER el mapa (regla anti-pudrición)
Cuando cambies código:
- Actualizá la fila correspondiente de `COMPONENTS.md` (nombre/ubicación/estado/ticket) **en el mismo commit** que el código.
- Si limpiaste deuda técnica (código 🗑️), **archivá, no borres** (ADR-0007): copiá el bloque verbatim a `_backup/deprecated/`
  con su encabezado (origen/motivo/restaurar), agregá la fila al índice `_backup/deprecated/README.md`, y actualizá la fila /
  la sección "Deuda técnica & gaps" de `COMPONENTS.md`.
- Si tomaste una decisión importante, cara o riesgosa de revertir, escribí una **ADR nueva** en `docs/adr/` (nunca edites
  una aceptada — escribí una que la supersede).
- Mantené el mapa **mínimo y podado** (bonsái): una doc chica y fresca vale más que una grande y desactualizada.

## Estados
✅ estable · 🚧 en progreso/parcial · ⚠️ frágil/cuidado · 🗑️ obsoleto (a limpiar).

## Notas de precisión
- Los `~L` son aproximados (orientan, no son exactos). Verificá el símbolo con Grep, no confíes en el número solo.
- Cuidado con la **colisión de códigos de ticket**: T2/T3/T4/T5 del PLAN viejo (motor de reproducción, R18) NO son los de
  CORRECCIONES-V2 (T2 trim micro-snap, T4 faders 3D, etc.).
