# ADR-0006: Modelo de automatización After Effects

- **Estado:** Accepted
- **Fecha:** 2026-07-22
- **Deciden:** Beltrán, Claude

## Contexto
Un modelo previo estilo Ableton tenía override, "perform-and-bake" y un botón de "recuperar/re-enable" la automatización.
Era confuso: se podía "romper" la automatización de un parámetro y había que reactivarla. Beltrán pidió el modelo de
After Effects, donde la automatización nunca se rompe.

## Decisión
Modelo **After Effects** (tickets [A2]/[D1]):
- Apretar el punto → crea keyframe.
- Mover un valor **cuando el clip ya está automatizado** → crea keyframe en ese punto.
- **Editar un valor siempre escribe un keyframe. La automatización nunca se rompe.**
- **No hay override ni botón de "recuperar automatización".**
Implementado en `manualEdit` (regla de escritura) + `evalP` (ignora `_autoOff`).

## Consecuencias
- (+) Comportamiento predecible y familiar (AE); imposible "romper" una curva por accidente.
- (−) **Deuda técnica:** la maquinaria legacy (`_autoOff` override/re-enable con `#reEnAll`, y perform-and-bake REC
  `recWrite`/`bakeRecorded` con `#autoRecBtn`) **sigue en el código** aunque esta decisión la deja sin efecto. Está marcada
  🗑️ en COMPONENTS.md y hay que **removerla** (código muerto en tensión con el modelo).

## Confirmación
Editar cualquier valor de un parámetro automatizado durante el playback debe insertar un keyframe y seguir la curva; no
debe existir ningún estado desde el cual la automatización "no corre" hasta reactivarla.
