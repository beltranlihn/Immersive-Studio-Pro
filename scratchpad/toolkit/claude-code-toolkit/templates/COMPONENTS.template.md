# COMPONENTS — Mapa vivo de <TU PROYECTO>

> **Tipo (Diátaxis): Referencia.** Solo hechos: qué hace cada componente, dónde vive (`archivo · función` / `#id`), su
> estado y su ticket de roadmap. El *relato* (cómo/por qué) está en [ARCHITECTURE.md](ARCHITECTURE.md); las *decisiones*
> en [docs/adr/](docs/adr/). Este archivo **es la estructura de carpetas** que el código no tiene: el índice para saltar
> directo a una función sin re-escanear todo.
>
> **Regla anti-pudrición (docs-as-code):** al cambiar código, actualizá la fila correspondiente **en el mismo commit**.
> Los `~L` son aproximados — orientan la búsqueda, no son exactos.
>
> **Estados:** ✅ estable · 🚧 en progreso/parcial · ⚠️ frágil/cuidado · 🗑️ obsoleto (a limpiar) · 🗄️ archivado.
> **Verificado contra el código:** <AAAA-MM-DD>.

---

## Índice maestro (jump table)

### 1 · <Subsistema A> → [detalle](#1--subsistema-a-detalle)
| Componente | Qué hace | Ubicación | Estado | Roadmap |
|---|---|---|---|---|
| <Componente> | <propósito ≤8 palabras> | `archivo` · `func()` (~L..) / #id | ✅ | — |

### 2 · <Subsistema B> → [detalle](#2--subsistema-b-detalle)
| Componente | Qué hace | Ubicación | Estado | Roadmap |
|---|---|---|---|---|
| … | … | … | … | … |

<!-- Repetí una sección por subsistema. Objetivo: 5-10 subsistemas. -->

---

## Deuda técnica & gaps
- <Lo que quedó frágil / muerto / a medias, con su ubicación y por qué.>

---

# Bloques de detalle

## 1 · <Subsistema A> (detalle)

## <Nombre del componente>
- **Propósito:** <1-3 frases factuales, sin narrativa>
- **Ubicación:** `archivo` · `funcion()` (~L<línea>) · #id / .clase · UI "label"
- **Estado/datos:** <state/props/vars que posee>
- **Símbolos clave:** `a()`, `b()`, …
- **Depende de / toca:** <otros componentes>
- **Invariantes / gotchas:** <lo que hay que saber para no romperlo>
- **Estado:** ✅/🚧/⚠️/🗑️/🗄️  ·  **Roadmap:** <ticket> o —
- **Relacionado:** ADR-XXXX, ARCHITECTURE.md#<seccion>

<!-- Un bloque por componente importante. Mirror de la estructura del producto (Diátaxis: la referencia refleja el producto). -->
