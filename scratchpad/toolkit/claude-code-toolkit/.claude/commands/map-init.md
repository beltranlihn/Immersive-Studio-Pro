---
description: Bootstrap del mapa vivo (COMPONENTS.md) mapeando el codebase con subagentes en paralelo
---

Generá (o regenerá) `COMPONENTS.md` — el mapa vivo del proyecto — **sin cargar todo el código en el contexto principal**.

Pasos:
1. **Descubrí los subsistemas.** Con Glob/Grep y una lectura liviana, listá los grandes bloques del codebase (por dominio:
   p. ej. motor/núcleo, UI, datos/estado, red/IO, export, etc.). Apuntá a 5-10 subsistemas. Si el proyecto es un archivo
   monolítico, partí por regiones de funciones; si es multi-archivo, por carpeta/módulo.
2. **Faneá un subagente por subsistema** (Agent tool, en un solo mensaje para que corran en paralelo). A cada uno pedile
   que lea SU parte y **escriba su fragmento** a `scratchpad/map/NN-<area>.md`, y que **devuelva solo** las filas de la
   tabla maestra (compactas) + una nota de ambigüedades. Contrato de salida para cada agente:
   - Bloque de detalle por componente:
     ```
     ## <Nombre>
     - **Propósito:** <1-3 frases factuales>
     - **Ubicación:** <archivo> · `funcion()` (~L<línea>) · #id (si aplica)
     - **Estado/datos:** <state/props/vars que posee>
     - **Símbolos clave:** ...
     - **Invariantes / gotchas:** ...
     - **Estado:** ✅/🚧/⚠️/🗑️
     - **Roadmap:** <ticket> o —
     ```
   - Fila de la tabla maestra: `| <Componente> | <propósito ≤8 palabras> | <archivo> · \`func\` / #id | <estado> | <deps> | <ticket o —> |`
   - Reglas para el agente: **solo hechos** (estilo referencia), nombres de símbolo exactos, números de línea reales
     (verificados leyendo), **no** pegar archivos completos en la respuesta.
3. **Ensamblá `COMPONENTS.md`:** cabecera (qué es, leyenda de estados, regla anti-pudrición) + índice maestro (agrupá las
   filas devueltas por subsistema, con enlaces a los bloques) + los bloques de detalle (concatenados desde
   `scratchpad/map/*.md`). Borrá los fragmentos temporales al terminar (su contenido ya vive en `COMPONENTS.md`).
4. **Revisá** que las ubicaciones sean correctas y agregá una sección "Deuda técnica & gaps" con lo que los agentes
   marcaron. Ofrecé sembrar `ARCHITECTURE.md` (el relato) y las primeras ADR.

Leyenda de estados: ✅ estable · 🚧 en progreso/parcial · ⚠️ frágil/cuidado · 🗑️ obsoleto · 🗄️ archivado.
