---
name: arch-map
description: Navigate and maintain this project's living architecture map. Use BEFORE searching the codebase to locate any component, function, symbol, UI element, or "where does X live" — and AFTER changing code to keep the map in sync. Covers COMPONENTS.md (the living component inventory), ARCHITECTURE.md (how it works), and docs/adr/ (why decisions were made).
user-invocable: true
argument-hint: "[find <thing> | update <subsystem> | adr <decision>]"
---

# arch-map — mapa vivo del proyecto

**No re-escanees archivos enteros para ubicar algo.** El mapa ya existe:

- **`COMPONENTS.md`** (raíz) — inventario de referencia: cada componente con `archivo · función` / `#id` · estado · ticket.
  **ES la estructura de carpetas** que el código monolítico no tiene. Índice maestro arriba + bloques de detalle.
- **`ARCHITECTURE.md`** (raíz) — el relato: cómo funciona, flujos, conceptos transversales, riesgos/deuda, glosario.
- **`docs/adr/`** — las decisiones y su porqué (inmutables).
- **`NEXT.md`** — cola de trabajo activa (checklist). · **`PLAN.md`** (si existe) — bitácora por ronda.

## Para LOCALIZAR algo (antes de grepear)
1. Abrí `COMPONENTS.md`, buscá en el **índice maestro** el subsistema.
2. La fila te da `archivo · función` (~línea) y `#id`. Saltá directo con Read (offset a esa línea) o Grep del símbolo exacto.
3. Para el *porqué*/*flujo*, mirá el bloque de detalle, luego `ARCHITECTURE.md`, luego `docs/adr/`.
4. **Si el mapa NO lo tiene**, delegá la búsqueda al subagente `arch-explorer` (Agent tool, subagent_type "arch-explorer"):
   busca en su propio contexto y devuelve solo `archivo:línea` (ahorra tokens). Cuando lo encuentres, **agregá la fila que
   faltaba a `COMPONENTS.md`**.

## Para MANTENER el mapa (regla anti-pudrición)
Cuando cambies código, en el **mismo commit**:
- Actualizá la fila de `COMPONENTS.md` (ubicación/estado/ticket).
- Si limpiaste código muerto, **archivá, no borres**: copialo a `_backup/deprecated/` con su encabezado y sumá la fila al
  índice de ahí (ver `_backup/deprecated/README.md`).
- Decisión importante/cara/riesgosa de revertir → **ADR nueva** en `docs/adr/` (no edites las aceptadas; escribí una que las supersede).
- Mantené el mapa **mínimo y podado** (bonsái): una doc chica y fresca vale más que una grande y desactualizada.

## Estados
✅ estable · 🚧 en progreso/parcial · ⚠️ frágil/cuidado · 🗑️ obsoleto (a limpiar) · 🗄️ archivado.

## Precisión
Los `~L` son aproximados (orientan, no exactos). Verificá el símbolo con Grep, no confíes solo en el número.
