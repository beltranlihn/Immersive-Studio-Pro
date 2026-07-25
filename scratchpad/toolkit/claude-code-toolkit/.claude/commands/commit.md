---
description: Commit local con ritual anti-pudrición del mapa (sin push)
---

Hacé un commit local de los cambios actuales. **NO hagas push** (eso es `/deploy`).

Pasos:
1. `git status` + `git diff --stat` para ver qué cambió.
2. Corré el check de sintaxis/lint/tests rápido del proyecto antes de commitear (adaptá al stack: `node --check`,
   `tsc --noEmit`, `ruff`, `go vet`, etc.). Si falla, **PARA** y avisá.
3. Si el cambio lo amerita, agregá una entrada a la bitácora (`PLAN.md` / changelog).
4. **Anti-pudrición (docs-as-code):** si el cambio agregó/movió/renombró/eliminó un componente, función, `#id` o elemento
   de UI, actualizá su fila en `COMPONENTS.md` (ubicación/estado/ticket) — **en este mismo commit**. Decisión
   importante/cara/riesgosa de revertir → agregá una ADR en `docs/adr/`.
5. **Archivar, no borrar:** si sacaste código muerto/deprecado, NO lo borres — archívalo verbatim en `_backup/deprecated/`
   con su encabezado (origen/motivo/restaurar) y sumá la fila al índice `_backup/deprecated/README.md`.
6. `git add -A` y creá el commit con un mensaje claro (el qué y el porqué).
7. Reportá el hash corto y un resumen de una línea. **No pushees ni deployes.**

Argumentos opcionales (`$ARGUMENTS`): si el usuario pasa texto, usalo como base del mensaje de commit.
