# ADR-0004: Una sola inversión de handedness (`u_flipx = -1`)

- **Estado:** Accepted
- **Fecha:** 2026-07-22
- **Deciden:** Beltrán, Claude

## Contexto
El domo se ve desde adentro (proyección hemisférica). Eso invierte el sentido horizontal respecto de la vista 2D/3D
convencional. Si se "corrige" en varios lugares (malla, cameraMVP, warp) se duplica la inversión y todo queda al revés.

## Decisión
Hay **exactamente UNA** inversión intencional: `u_flipx = -1` en la ruta del domo (programa de warp / VS3 de la malla 3D).
El resto de la cadena (cameraMVP, malla, guías) queda sin invertir.

## Consecuencias
- (+) El domo se ve correcto desde el punto de vista del espectador.
- (−) Es contra-intuitivo al leer el código: parece un bug que "falta arreglar" en cameraMVP/malla.
- (⚠️) **NO tocar** cameraMVP ni la malla para "arreglar" la orientación → duplica la inversión.

## Confirmación
Cualquier cambio en la orientación del domo debe verificarse comparando 2D↔3D↔export; si el texto/logo se ve espejado
en el domo pero bien en 2D (o viceversa), se rompió esta invariante.
