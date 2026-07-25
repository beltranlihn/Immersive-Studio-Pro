# ADR-0008: La UI se recrea calcada al diseño "Rev 1" y lo que no está en el diseño se poda

- **Estado:** Accepted
- **Fecha:** 2026-07-25
- **Deciden:** Beltrán (director creativo), Claude

## Contexto
La UI del editor creció por acumulación: cada ronda agregó botones y paneles donde había hueco (cuatro botones sueltos de
salida en la barra del visor, un buscador y un "New folder" siempre visibles en Media, una sección "Master Grade" fija
arriba del inspector, un módulo de audio sticky y aparte del resto de las pistas…). El resultado era funcional pero sin
una gramática única, y el coste de decidir "¿dónde va esto?" recaía en cada ronda.

Claude Design entregó un handoff completo (`scratchpad/redesign/design_handoff_immersive_studio/`): un prototipo React
con estilos inline para los tres formatos (Domo / 2D / 360) más el launcher, y un README con la spec. El prototipo NO es
portable a la app (la app no tiene build step — ver ADR-0001) y su stack no es el nuestro.

## Decisión
1. **La UI se RECREA, no se porta.** El prototipo es la referencia visual; la implementación se escribe a mano en
   `index.html` + `app.js`. El spec maestro traducido vive en **`REDISEÑO-UI.md`**, con refs `RevDomo:NNN` al prototipo,
   y es la fuente de verdad para la auditoría.
2. **Regla de poda:** *lo que no aparece en el diseño se saca de la app.* Vale para botones, secciones, handlers y su
   HTML/CSS/JS. No es "esconder por ahora": es reducir la superficie.
3. **Podar ≠ borrar.** Todo lo que se saca se archiva según **ADR-0007** (`_backup/deprecated/` + fila en su índice +
   fila actualizada en `COMPONENTS.md`, en el mismo commit).
4. **Excepción — nodos ocultos como puente:** cuando el elemento visible se retira pero su *wiring* sigue siendo válido
   y usado por otra vía (atajo de teclado, menú contextual, menú File), se deja el nodo en el DOM con `display:none` en
   vez de blindar cada llamador con `if(el)`. Es deuda consciente y **hay que anotarla**, porque puede dejar una función
   sin entrada de usuario (pasó con `#mediaSearch`: Ctrl+F quedó apuntando a un input oculto).
5. **La lógica sobrevive a su UI.** Cuando se poda sólo la interfaz de un subsistema, el motor queda vivo y en estado
   identidad (caso `state.seqGrade`/`applyMasterGrade`), para no romper proyectos `.isp` ya guardados.

## Consecuencias
- (+) Una sola gramática visual (wells, toggles verdes, color por parámetro, alturas de 28/22/16px) en vez de decisiones
  caso por caso; las rondas siguientes tienen a dónde mirar antes de inventar.
- (+) Menos superficie: cuatro botones de salida → un dropdown; dos columnas de pistas → una.
- (−) **Se pierden puntos de entrada** si la poda no se audita: una función viva puede quedar inalcanzable. Mitigación:
  cada poda anota su residual en `REDISEÑO-UI.md` y en "Deuda técnica" de `COMPONENTS.md`, y la auditoría los recorre.
- (−) El diseño puede no cubrir un caso que la app sí tiene (formatos 360/sala, export por muro). Ahí manda la app y se
  extiende el diseño, no al revés — pero la extensión se escribe en `REDISEÑO-UI.md` antes de codificarla.
- (−) Los `.dc.html` del handoff quedan versionados en `scratchpad/redesign/` (~770 KB) como referencia congelada.

## Confirmación
Una región está "hecha" cuando: su checklist en `REDISEÑO-UI.md` está tachado, lo podado tiene fila en
`_backup/deprecated/README.md`, `COMPONENTS.md` refleja el estado nuevo, y la región se verificó por CDP a 1920×1080
contra la sección correspondiente del spec.
