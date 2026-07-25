# Guía — Sistema de mapa vivo + tooling para trabajar con Claude en un codebase grande

Esta guía explica **por qué** funciona este toolkit y **cómo** montarlo en tu proyecto. La idea central: cuando un
agente (Claude) trabaja sobre un codebase grande, pierde tiempo y tokens **re-escaneando** los archivos cada vez que hay
que ubicar algo. La solución es un **mapa vivo** —un índice de componentes con su ubicación exacta— que el agente lee
primero para saltar directo al lugar, más un ritual para que ese mapa **no se pudra**.

Sirve para cualquier lenguaje/stack (un `app.js` monolítico, un monorepo, un backend, lo que sea).

---

## El problema

- Codebase grande (miles de líneas, o muchos archivos) → el agente hace `grep`/`read` una y otra vez para ubicar cosas.
- Eso quema **tokens** (contexto) y **tiempo**, y encima el conocimiento se pierde entre sesiones.
- La documentación tradicional se **pudre**: se escribe una vez y queda desactualizada.

## La solución: 5 marcos que se componen en un sistema

| Pieza | Marco | Qué aporta |
|---|---|---|
| Niveles de zoom del mapa | **C4** | Contexto → Contenedor → Componente → Código |
| Qué documentar | **arc42** | Secciones estándar de una doc de arquitectura |
| Que no se mezclen tipos de doc | **Diátaxis** | *referencia* (el mapa) separada de *explicación* (el relato) |
| El "por qué" no se pierde | **ADR** | 1 archivo inmutable por decisión |
| Que no se pudra | **docs-as-code** | docs en el repo, actualizadas **en el mismo commit** que el código |

(Fuentes en `SOURCES.md`.)

## Los artefactos

1. **`COMPONENTS.md`** (raíz) — *el mapa vivo* (referencia austera, Diátaxis). Una tabla índice + un bloque de detalle
   por componente: **Componente · Qué hace · Ubicación (`archivo · función` / `#id`) · Estado · Depende de · Roadmap**.
   Como un archivo monolítico no tiene carpetas, **esta tabla ES la estructura de carpetas**. Es lo que el agente lee
   primero para saltar directo a una función sin grepear todo.
2. **`ARCHITECTURE.md`** (raíz) — *el relato* (explicación). C4 (contexto/contenedores/componentes) + los flujos clave +
   conceptos transversales + riesgos/deuda + glosario. Cuenta *cómo* y *por qué* funciona.
3. **`docs/adr/`** — *las decisiones* (el porqué). Un archivo inmutable por decisión importante/cara/riesgosa de revertir.
4. **`NEXT.md`** (raíz) — la *cola de trabajo* activa (checklist rápido→complejo) que se va tachando.
5. **`_backup/deprecated/`** — respaldo de código muerto: se **archiva, no se borra** (recuperable con contexto).

## La plomería de Claude Code

- **Skill `arch-map`** — le dice a Claude: "antes de buscar, leé `COMPONENTS.md`; después de cambiar código, actualizá su
  fila en el mismo commit".
- **Subagente `arch-explorer`** — cuando el mapa no tiene algo, Claude delega la búsqueda a este agente barato (Haiku), que
  busca en **su propio contexto** y devuelve solo `archivo:línea`. Así el contexto principal no se llena de reads.
- **Comando `/commit`** — ritual que obliga a actualizar el mapa (anti-pudrición) y a archivar-no-borrar.
- **Comando `/map-init`** — bootstrap: fanea subagentes en paralelo para mapear el codebase y generar `COMPONENTS.md` la
  primera vez (sin cargar todo el código en el contexto principal).
- **`.claude/settings.json`** — bloquea leer `node_modules`/`dist`/`build`/`*.min.js` (no gastar contexto en código generado).

---

## Cómo montarlo en tu proyecto (paso a paso)

1. **Copiá la carpeta `.claude/`** de este toolkit a la raíz de tu repo (fusionala con la que ya tengas). Ajustá
   `.claude/commands/commit.md` y creá tu propio `deploy` según tu build/deploy.
2. **Copiá las plantillas** de `templates/` a la raíz:
   - `COMPONENTS.template.md` → `COMPONENTS.md`
   - `ARCHITECTURE.template.md` → `ARCHITECTURE.md`
   - `NEXT.template.md` → `NEXT.md`
   - `templates/docs/adr/` → `docs/adr/`
   - `templates/_backup/deprecated/README.md` → `_backup/deprecated/README.md`
3. **Agregá un puntero en tu `CLAUDE.md`** (el archivo de contexto que Claude lee cada sesión):
   ```
   ## 🗺️ Para ubicar cualquier cosa — LEER PRIMERO
   Antes de re-escanear el código, consultá COMPONENTS.md (mapa: archivo·función/#id · estado · roadmap),
   ARCHITECTURE.md (cómo funciona) y docs/adr/ (por qué). Skill `arch-map` para navegar/mantener.
   Al cambiar código, actualizá la fila de COMPONENTS.md en el mismo commit.
   ```
4. **Bootstrapeá el mapa:** corré `/map-init` (o pedile a Claude que "mapee el codebase con subagentes en paralelo al
   formato de COMPONENTS.md"). Cada subagente mapea un subsistema en su propio contexto y devuelve las filas + bloques de
   detalle; vos/Claude ensamblan `COMPONENTS.md`. Revisá y ajustá.
5. **Sembrá `ARCHITECTURE.md`** (el relato) y **2-6 ADR** de las decisiones grandes ya tomadas (stack, formatos, patrones).
6. **A partir de ahí, la disciplina** (lo que hace que sea "vivo"): al cambiar código, actualizá la fila en el mismo
   commit; código muerto → archivá en `_backup/deprecated/` (no borres); decisión grande → ADR nueva (no edites las viejas).

## Por qué ahorra tokens (el punto)
- **Mapa primero:** Claude lee una fila de `COMPONENTS.md` y hace `Read` con offset a esa línea, en vez de grepear miles de líneas.
- **Subagentes:** la búsqueda/mapeo pesado ocurre en contextos aislados que devuelven solo el resumen (`archivo:línea`).
- **Deny de código generado:** no se gastan tokens leyendo `node_modules`/`dist`/minificados.
- **Docs chicas y frescas** (bonsái): mejor una referencia mínima y al día que un mamotreto desactualizado.

## Estados (vocabulario del mapa)
✅ estable · 🚧 en progreso/parcial · ⚠️ frágil/cuidado · 🗑️ obsoleto (a limpiar) · 🗄️ archivado.
