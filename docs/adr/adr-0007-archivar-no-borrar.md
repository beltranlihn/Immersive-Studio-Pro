# ADR-0007: Código deprecado se archiva, no se borra

- **Estado:** Accepted
- **Fecha:** 2026-07-22
- **Deciden:** Beltrán, Claude

## Contexto
El mapeo de arquitectura (R136) destapó código muerto/vestigial (p. ej. la maquinaria legacy de automatización `_autoOff`
+ perform-and-bake, que [A2]/[D1]/ADR-0006 dejan sin efecto). Hay que sacarlo del software principal para bajar la deuda
técnica, pero borrarlo del todo pierde trabajo que quizá se quiera recuperar más adelante. Git guarda el historial, pero
rescatar un bloque desde un commit viejo es incómodo y fácil de olvidar que existió.

## Decisión
El código deprecado/duplicado/no usado **se archiva, no se borra.** Al sacarlo del código principal se **copia verbatim**
a `_backup/deprecated/AAAAMMDD-<nombre>.<ext>` con un encabezado que registra: **origen** (archivo·símbolo·commit), **fecha**,
**motivo** (con ticket/ADR) y **cómo restaurarlo**. Se agrega una fila al índice `_backup/deprecated/README.md` y se
actualiza la fila del componente en `COMPONENTS.md`. El procedimiento completo vive en ese README.

`_backup/deprecated/` es **legible** (no está en el deny de `.claude/settings.json`) justamente para poder restaurar.

## Consecuencias
- (+) El software principal queda limpio, pero nada se pierde: el bloque es recuperable en 1 paso, con contexto de por qué salió.
- (+) El índice hace visible qué se archivó y desde dónde — mejor que bucear en el historial de git.
- (−) Duplica el bloque (código principal ya no lo tiene, pero vive en el respaldo) — aceptable: es respaldo, no código vivo.
- (−) Requiere disciplina de actualizar el índice + COMPONENTS.md al archivar (metido en el ritual de `/commit`).

## Confirmación
Tras archivar un bloque: el código principal ya no lo referencia, `node --check` pasa, el archivo de respaldo tiene su
encabezado completo, y hay fila nueva en `_backup/deprecated/README.md`.
