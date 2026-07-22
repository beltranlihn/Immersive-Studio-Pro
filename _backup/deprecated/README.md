# Código deprecado / archivado — Immersive Studio Pro

> **Política: archivar, no borrar.** Cuando se saca código muerto/duplicado/deprecado del software principal
> (`app.js`/`index.html`/`main.js`), **no se borra** — se **copia verbatim** a esta carpeta con un encabezado que registra
> de dónde salió, por qué y cómo restaurarlo. Así queda fuera del código que corre, pero recuperable si alguna vez se necesita.
> Decisión completa en [docs/adr/adr-0007-archivar-no-borrar.md](../../docs/adr/adr-0007-archivar-no-borrar.md).

## Cómo archivar un bloque (procedimiento)
1. Copiá el código a sacar **verbatim** a un archivo nuevo acá: `_backup/deprecated/AAAAMMDD-<nombre-corto>.js`
   (o `.html`/`.css`/`.md` según el tipo).
2. Poné arriba de ese archivo un encabezado:
   ```
   /* ARCHIVED (deprecated / unused) — Immersive Studio Pro
    * Origen:   app.js · <función/símbolo> / <#domId>   (commit <hash> "<msg>")
    * Sacado:   AAAA-MM-DD
    * Motivo:   <por qué se saca — enlazá el ticket/ADR>
    * Restaurar:<dónde/cómo re-insertarlo y qué re-cablear>
    * Relacion: <[ticket], docs/adr/adr-XXXX>
    */
   ```
3. Sacá el bloque del código principal (dejá un comentario de una línea donde estaba: `// [archivado AAAAMMDD] <qué> → _backup/deprecated/…`).
4. Actualizá la fila en `COMPONENTS.md` (estado 🗑️ → archivado, o quitá la fila) y la sección "Deuda técnica & gaps".
5. Agregá una fila a la tabla de abajo.
6. `node --check app.js && node --check main.js` y verificá que no rompiste nada. Commit.

## Cómo restaurar
Abrí el archivo en `_backup/deprecated/`, seguí la línea **Restaurar** de su encabezado, pegá el bloque de vuelta, re-cableá
lo que indique, y actualizá `COMPONENTS.md`. Corré el syntax check.

## Registro de bloques archivados

| Fecha | Archivo de respaldo | Origen (símbolo / #id) | Motivo | Ticket / ADR |
|---|---|---|---|---|
| 2026-07-22 | `20260722-automation-override-and-perform-bake.js` | app.js · `setAutoOff`/`reenableAuto`/`reenableAll`/`anyOverride`/`updReEnableGlobal` + `recWrite`/`bakeRecorded`/`autoRecOn`/`toggleAutoRec`/`_recTouch` · `state.autoRec` · index.html `#autoRecBtn` + CSS | Sin efecto bajo el modelo After Effects; sin llamadores (verificado). Motor de automatización verificado intacto por CDP tras sacarlo. | [A2]/[D1], ADR-0006 |

<!-- Al archivar, agregá una fila aquí. Ejemplo:
| 2026-07-22 | 20260722-auto-override.js | app.js · `setAutoOff`/`reenableAuto` · #reEnAll | Reemplazado por modelo After Effects; `evalP` ya lo ignora | [A2]/[D1], ADR-0006 |
-->
