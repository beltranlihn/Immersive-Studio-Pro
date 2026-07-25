# Claude Code Toolkit — mapa vivo + tooling para codebases grandes

Un kit para trabajar con **Claude Code** sobre un proyecto grande **sin perder tiempo ni tokens re-escaneando el código**.
Da un *mapa vivo* de componentes que Claude lee primero para saltar directo al lugar, más los rituales para que el mapa
no se pudra. **Genérico**: sirve para cualquier lenguaje/stack.

> Armado a partir de un sistema probado en un proyecto real. Todo acá es genérico y adaptable — **no** hay nada del
> proyecto original. Podés traducirlo/renombrar lo que quieras (Claude lee cualquier idioma).

## Qué hay adentro
```
GUIDE.md            La metodología completa (por qué + cómo montarlo). ← empezá acá
SOURCES.md          Fuentes fidedignas (C4, arc42, Diátaxis, ADR, docs-as-code, Claude Code)
.claude/
  skills/arch-map/  Skill: navegar y mantener el mapa
  agents/arch-explorer.md   Subagente barato de búsqueda aislada (devuelve archivo:línea)
  commands/commit.md        Ritual de commit con anti-pudrición del mapa
  commands/map-init.md      Bootstrap: mapea el codebase con subagentes en paralelo
  settings.json             No leer node_modules/dist/build/minificados
templates/
  COMPONENTS.template.md    El mapa vivo (referencia)
  ARCHITECTURE.template.md  El relato (C4 + arc42)
  NEXT.template.md          Cola de trabajo (checklist)
  docs/adr/                 Índice + plantilla de ADR (Nygard/MADR)
  _backup/deprecated/       Política "archivar, no borrar"
```

## Quick start (5 pasos)
1. Copiá la carpeta **`.claude/`** a la raíz de tu repo (fusionala con la que ya tengas). Ajustá `commands/commit.md` a tu
   check de sintaxis/tests, y creá tu propio `deploy` si querés.
2. Copiá las **plantillas** de `templates/` a la raíz, renombrando: `COMPONENTS.template.md` → `COMPONENTS.md`, etc.
   (`docs/adr/` y `_backup/deprecated/` van tal cual).
3. Agregá a tu **`CLAUDE.md`** un puntero: *"Antes de re-escanear el código, leé COMPONENTS.md; skill `arch-map` para
   navegar/mantener; al cambiar código actualizá la fila en el mismo commit."*
4. Corré **`/map-init`** (o pedile a Claude que "mapee el codebase con subagentes al formato de COMPONENTS.md"). Revisá.
5. Sembrá **`ARCHITECTURE.md`** y **2-6 ADR** de las decisiones grandes ya tomadas. Listo.

Detalle y el "por qué" en **`GUIDE.md`**.

## Sobre las skills de terceros (auditorías UX, diseño, etc.)
Este kit **no incluye** skills de terceros (p. ej. *Impeccable* u otras de auditoría UX/accesibilidad) — son de sus
autores y tienen su propia licencia. Si las querés, instalalas vos desde su fuente oficial (marketplace/repo de skills de
Claude Code). Este toolkit es solo el sistema de mapa + tooling propio, libre de usar y adaptar.

## Licencia
Usá y adaptá libremente. Sin garantías.
