---
description: Commit local de los cambios actuales (sin push)
---

Haz un commit local de los cambios actuales del repo. **NO hagas push.**

Pasos:
1. `git status` + `git diff --stat` para ver qué cambió.
2. Si hay cambios en `app.js` / `main.js`, corre `node --check app.js && node --check main.js` antes de commitear. Si falla el check, PARA y avisa.
3. Actualiza `PLAN.md` con una entrada de la ronda si el cambio lo amerita (lo más nuevo arriba).
3b. **Anti-pudrición (docs-as-code):** si el cambio agregó/movió/renombró/eliminó un componente, función, `#domId` o botón, actualiza su fila en `COMPONENTS.md` (ubicación/estado/ticket) — **en este mismo commit**. Si tomaste una decisión importante/cara/riesgosa de revertir, agrega una ADR en `docs/adr/`.
3c. **Archivar, no borrar (ADR-0007):** si sacaste código muerto/deprecado del software, NO lo borres — archívalo verbatim en `_backup/deprecated/` con su encabezado (origen/motivo/restaurar) y agrega la fila al índice `_backup/deprecated/README.md`. Procedimiento en ese README.
4. `git add -A` y crea el commit con un mensaje claro en castellano neutro describiendo el qué y el porqué.
5. Termina el mensaje de commit con:
   ```
   Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
   ```
6. Reporta el hash corto del commit y un resumen de una línea. **No pushees ni deployes** — eso es `/deploy`.

Argumentos opcionales (`$ARGUMENTS`): si el usuario pasa texto, úsalo como base del mensaje de commit.
