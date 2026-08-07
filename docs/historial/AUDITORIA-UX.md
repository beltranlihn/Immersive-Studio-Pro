# AUDITORÍA UX/UI — Immersive Studio Pro (Ronda 94, 2026-07-16)

**Métodos:** (A) Heurísticas de Nielsen + principios de Norman + walkthrough cognitivo de 4 flujos (skill `nielsen-heuristics-audit` / `don-norman-principles-audit` / `cognitive-walkthrough`) · (B) Impeccable `audit` + `critique`, registro *product* · (C) Detector determinístico `npx impeccable detect` (46 reglas anti-slop).
**Evidencia:** 6 capturas reales del renderer vía CDP (landing, editor con automatización, timeline scrolleado, export, prefs, compose) + `index.html` completo + verificaciones puntuales en `app.js`.
**Estado (2026-07-16):** ✅ **U-T1..U-T5 EJECUTADAS** (detalle por tanda en PLAN.md R94-UT1..UT5). Diferidos deliberados: U-31 (retícula 4px — requiere ojos), indicador "▾ V1" de U-01 (se implementó sombra+autoscroll), U-20 parcial (.ms intacto por densidad), U-10 acotado (Tab+Enter; sin flechas entre clips).

---

## Veredicto ejecutivo

La base es sólida (monocromo pro disciplinado, iconografía propia coherente, autosave/recovery excelente, tooltips con atajos, paleta de comandos). Distancia a "impecable": **media**. Impeccable Audit Health ≈ **12/20** (A11y 1/4 · Theming 1/4 · Perf 3/4 · Responsive 3/4 · Anti-patterns 4/4).

**Los 4 patrones sistémicos raíz** (resolverlos eleva la mitad de la lista):
1. **Cero tokens de diseño** — 40+ grises hex hardcodeados con casi-duplicados (#B4BAC1/#B3B8C0, #C9CDD3/#C7CDD4/#C5CAD0/#C2C7CE…) que ya produjeron deriva.
2. **Media rampa de texto por debajo de WCAG** — #585E66→#767C85 rinden 2.5:1–3.9:1 sobre los fondos reales, justo en los textos de 9–10.5px.
3. **flashStatus como canal único de feedback y enseñanza** — 2.6 s, 9.5px, esquina inferior: ahí viven la gramática de automatización, los errores y los avisos.
4. **Modelo híbrido Premiere+Ableton sin puente** — el usuario Premiere pisa trampas (Ctrl+E parte el clip, clic sobre punto borra, clic en cuerpo de clip no selecciona en modo automatización).

---

## HALLAZGOS CONSOLIDADOS (deduplicados; fuente entre ⟨⟩)

### 🔴 ALTA (severidad Nielsen 3 / Impeccable P1)

| ID | Hallazgo | Detalle / arreglo propuesto |
|---|---|---|
| **U-01** | **Pista de vídeo oculta tras el módulo de audio** ⟨A⟩ | El módulo pinneado tapa V1: el clip seleccionado puede ser invisible mientras el Inspector lo muestra. → auto-scroll al seleccionar clip fuera de vista + indicador de overflow (sombra/“▾ V1”) + tope de altura del módulo relativo al timeline. |
| **U-02** | **La exportación pierde su botón Cancelar al cerrar el modal** ⟨A⟩ | La cola vive solo en `#exQueue`; cerrado el modal, un render de 60 min ya no se puede cancelar (reabrir muestra cola vacía). → reconstruir cola al reabrir + cancelar desde la barra de estado. |
| **U-03** | **Rampa de contraste bajo WCAG AA** ⟨B C1–C4, TY2 + C detector + A16/A23⟩ | #5E646C = 3.2:1 (2.5:1 sobre #24272C): `.insEmpty`, `.drop`, `.vslab .k` (AZ/EL casi invisibles), `.prow .kf/.nav`, `#fmtChip` 2.5:1, `.tcbox .du` 3:1, `.hint` 3.9:1, `.lanehdr .ms` (M/S) 3.3:1, `.dvlab` "AUDIO" 7.5px 3.9:1. → subir a #8A9199 (4.7:1) / #9EA5AD (6:1) según capa. |
| **U-04** | **Cero tokens CSS** ⟨B T1⟩ | Todo hardcodeado en index.html + HTML generado por app.js. → extraer ~12 variables (`--bg0/--bg1/--surface/--ink/--ink2/--ink3/--line/--sel`…) y colapsar grises casi-duplicados. Prerrequisito de U-03. |
| **U-05** | **Gramática de automatización solo en un flash de 2.6 s** ⟨A3⟩ | "pick device + parameter…" se ve una vez y se esfuma. → mini-leyenda fija mientras Automation esté activo + tooltips en los choosers. |
| **U-06** | **Clic sobre punto ELIMINA pero el cursor promete "move"** ⟨A4⟩ | Decisión deliberada del usuario (R93) — NO revertir. Mitigar: cursor distintivo sobre punto + tooltip "clic elimina · arrastrar mueve · clic-derecho edita" + los avisos ya existentes de Undo. |
| **U-07** | **Undo/Redo sin ningún affordance visible** ⟨A8⟩ | No hay botón ni menú; con gestos destructivos sin confirmación la salida de emergencia es invisible. → botones ↶/↷ en la barra superior con tooltip Ctrl+Z / Ctrl+Shift+Z. |
| **U-08** | **Ayuda/paleta de comandos indescubrible** ⟨A7⟩ | F1/?/Ctrl+K no se anuncian en ninguna parte. → icono "?" en la barra superior + mención en el landing. |
| **U-09** | **En modo Automation, clic en el cuerpo del clip no selecciona** ⟨A9⟩ | Solo la banda de título de 15px selecciona/mueve; sin señal visual del cambio de semántica. → resaltar la banda como zona de agarre y/o clic simple = seleccionar también sobre la envolvente. |
| **U-10** | **Superficie de edición inoperable por teclado** ⟨B A1⟩ | Clips, lanes, media, menús = divs sin tabindex/roles. → tabindex+roles+flechas al menos en clips/lanes/menús; extender `:focus-visible` a `[tabindex]`. (Tanda propia — es la mayor de todas.) |
| **U-11** | **"Project FPS" en Prefs se revierte en silencio** ⟨A6⟩ | Muta `state.fps` sin markDirty ni escribir en la secuencia; al cambiar de secuencia se pierde. → mover a ajustes de secuencia o propagar + markDirty. |
| **U-12** | **Feedback de Compose/Adjust a 900px del botón** ⟨A5⟩ | Con biblioteca vacía parecen rotos (solo flash inferior-izquierda). → tooltip de error anclado al botón o botón deshabilitado con title. |

### 🟠 MEDIA (severidad 2 / P2)

| ID | Hallazgo | Arreglo |
|---|---|---|
| U-13 | Estimado de export "16911.4 MB" ⟨B M1⟩ | usar `fmtBytes()` existente → "16.9 GB"; fila Estimated en color de aviso ⟨A14⟩. |
| U-14 | Ítems `danger` del menú contextual idénticos a los normales ⟨B E1⟩ | rojo desaturado #D98A8A + separador. |
| U-15 | Choosers del header truncados ("Opac∨") ⟨A10 + B M3⟩ | ensanchar header con Automation activo o `title` con nombre completo. |
| U-16 | Botón "A" críptico (bypass automatización) ⟨A11⟩ | icono bypass estándar + estado de color contrastado (naranja override estilo Ableton). |
| U-17 | Dos vocabularios de `<select>` (aselect vs nativos en Export) ⟨B F1⟩ | aplicar `.aselect` a todos. |
| U-18 | 7 variantes de segmented control + `.togbtn2` clon de `.togbtn` ⟨B K1⟩ | unificar en `.seg` + modificador. |
| U-19 | 10 tamaños tipográficos sin escala (7.5–13px) ⟨B TY1 + C⟩ | consolidar en 4 pasos: 9/10/11/13. |
| U-20 | Hit targets <24px (`.ms` 16², `.ibtn` 18², `.seqx` 12px) ⟨B A2⟩ | subir zona clicable a 20–22px vía padding (el icono no cambia). |
| U-21 | Errores con el mismo flash de 2.6 s que lo informativo ⟨A17⟩ | variante de status con color/icono + mayor duración para errores. |
| U-22 | Supr sobre media borra medio+clips sin confirmar (caso simple) ⟨A15⟩ | confirmación ligera si tiene clips en timeline, o toast con Undo. |
| U-23 | Escape en modales hace `.remove()` sin cleanup (fmtChip queda sucio) ⟨A13⟩ | despachar el cierre real del modal. |
| U-24 | Timeline vacío sin empty-state ⟨A18⟩ | hint fantasma "arrastra un medio aquí · doble clic inserta" mientras no haya clips. |
| U-25 | Ctrl+E parte el clip (esperable: export) ⟨A12⟩ | flashStatus al hacer split por atajo + mapa visible en paleta. |
| U-26 | `textOn()` umbral 0.62 → texto claro a ~2.5:1 en clips medios ⟨B C5⟩ | decidir por ratio WCAG real. |
| U-27 | Sin `prefers-reduced-motion` (solo toggle manual) ⟨B A3⟩ | inicializar con matchMedia. |
| U-28 | Tooltips largos desbordan (`.dsp-tip` nowrap) ⟨B S1⟩ | white-space normal + line-height 1.4. |
| U-29 | `.vptool` recorta controles en ventanas angostas sin acceso ⟨B L1⟩ | overflow-menu "»". |
| U-30 | Sin estilo `:disabled` (solo `.dis` sin ARIA) ⟨B E2⟩ | `button:disabled` + aria-disabled. |
| U-31 | Espaciado sin retícula (3,5,6,7,9,11,14…) ⟨B SP1 + C cramped-padding ×15⟩ | retícula 4px (4/8/12/16, excepción 6 documentada). |
| U-32 | Landing con lenguaje visual distinto (radio 9px vs sistema 2px) ⟨B K2⟩ | alinear o declarar excepción con tokens propios. |
| U-33 | Cola de export = concepto invisible hasta pulsarla ⟨A19⟩ | indicador de jobs junto al botón Export (depende de U-02). |

### 🟡 BAJA (cosmético / pulido)

U-34 CSS muerta peligrosa `.clip .tt` color 1.8:1 por defecto ⟨B D1⟩ · U-35 `.searchbox` muerta vs inline ⟨B D2⟩ · U-36 scrollbar thumb 0.09 casi invisible ⟨B V1⟩ · U-37 bordes 0.5px irregulares en Windows 100% — verificar en .exe ⟨B V2⟩ · U-38 "Done" vs "Close" entre modales ⟨B M2⟩ · U-39 `.mono` no es monoespaciada (renombrar `.tnum`) ⟨B TY3⟩ · U-40 `.tccenter` absoluto colisiona en anchos mínimos ⟨B L2⟩ · U-41 toggle `.iosw.on` gris≈gris (estado solo por posición del knob) ⟨B E3⟩ · U-42 "2D Master" → "Dome Master" (término de industria) ⟨A20⟩ · U-43 Prefs duplica toggles y omite autosave ⟨A21⟩ · U-44 landing sin versión/ayuda ⟨A22⟩ · U-45 suelo tipográfico 8px en thumbnails ⟨A23⟩ · U-46 `overflow:hidden` en body/tlmain recorta capas posicionadas ⟨C⟩.

### Walkthrough cognitivo (tasas de éxito estimadas, usuario nuevo pro)
F1 Importar→domo **~85%** · F2 Automatizar opacidad **~40-50%** (la gramática solo se enseña 2.6 s) · F3 Exportar **~80%** · F4 Deshacer/recuperarse **~60%** (undo invisible).

### Lo que ya está bien (NO tocar)
Monocromo intencional que pasa el test "¿confiaría un usuario de Resolve?" · anti-patterns 4/4 (sin gradientes, sin glass, sin card-grids) · autosave + crash-recovery + historial (raro incluso en NLEs comerciales) · destino de export ANTES del render + streaming a disco · validación en vivo de códec con mensajes accionables bilingües · tooltips espejando title→aria-label · empty states del inspector/media · paleta de comandos completa · confirmaciones al descartar.

---

## PLAN DE TANDAS PROPUESTO (pendiente de aprobación)

- **U-T1 · Fundación + quick wins (máximo impacto/esfuerzo):** U-04 tokens → U-03 contraste completo → U-13 GB → U-14 danger → U-07 botones Undo/Redo → U-08 ayuda "?" → U-23 Escape → U-11 FPS → U-36/U-34/U-35.
- **U-T2 · Timeline y automatización:** U-01 pista oculta → U-05 leyenda persistente → U-06 cursor/tooltip puntos → U-15 choosers → U-16 botón A → U-09 banda de agarre → U-24 empty-state → U-25 aviso split.
- **U-T3 · Export y feedback:** U-02 cola persistente/cancelar → U-21 jerarquía de errores → U-12 feedback anclado → U-33 indicador de jobs → U-13b fila estimated en aviso.
- **U-T4 · Consolidación de sistema:** U-18 segmented → U-17 selects → U-19 escala tipo → U-31 retícula → U-20 hit targets → U-28 tooltips → U-41 toggle → U-38/U-39/U-42.
- **U-T5 · Teclado y a11y (la grande):** U-10 tabindex/roles/flechas → U-27 reduced-motion → U-30 disabled/ARIA → U-26 textOn.

Cada tanda cierra con: `/impeccable polish` de lo tocado + `node --check` + verificación CDP con capturas + `npm run dist` + deploy.
