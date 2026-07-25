# Código deprecado / archivado

> **Política: archivar, no borrar.** Cuando se saca código muerto/duplicado/deprecado del software principal, **no se
> borra** — se **copia verbatim** acá con un encabezado que registra de dónde salió, por qué y cómo restaurarlo. Queda
> fuera del código que corre, pero recuperable. (Git guarda el historial, pero rescatar un bloque de un commit viejo es
> incómodo y fácil de olvidar que existió.)

## Cómo archivar un bloque
1. Copiá el código a sacar **verbatim** a `_backup/deprecated/AAAAMMDD-<nombre-corto>.<ext>`.
2. Poné arriba un encabezado:
   ```
   /* ARCHIVED (deprecated / unused)
    * Origen:   <archivo> · <función/símbolo> / <#id>   (commit <hash> "<msg>")
    * Sacado:   AAAA-MM-DD
    * Motivo:   <por qué — enlazá el ticket/ADR>
    * Restaurar:<dónde/cómo re-insertarlo y qué re-cablear>
    * Relacion: <[ticket], docs/adr/adr-NNNN>
    */
   ```
3. Sacá el bloque del código principal (dejá una línea donde estaba: `// [archivado AAAAMMDD] <qué> → _backup/deprecated/…`).
4. Actualizá la fila en `COMPONENTS.md` (estado 🗄️ / quitá la fila) y la sección "Deuda técnica & gaps".
5. Sumá una fila a la tabla de abajo. Corré el check de sintaxis y verificá que no rompiste nada. Commit.

## Cómo restaurar
Abrí el archivo, seguí su línea **Restaurar**, pegá el bloque de vuelta, re-cableá lo que indique, actualizá `COMPONENTS.md`.

## Registro de bloques archivados

| Fecha | Archivo de respaldo | Origen (símbolo / #id) | Motivo | Ticket / ADR |
|---|---|---|---|---|
| _(vacío)_ | | | | |
