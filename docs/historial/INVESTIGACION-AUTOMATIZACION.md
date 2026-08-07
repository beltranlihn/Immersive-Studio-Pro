# INVESTIGACIÓN — Sistema de automatización de clase mundial (2026-07-16)

**Método:** 3 investigaciones paralelas con fuentes primarias (manuales oficiales) y foros de usuarios: (A) DAWs — Ableton Live 12, Bitwig, Reaper, Logic, Cubase, FL; (B) VFX/motion — After Effects, Blender, Nuke, Fusion/Resolve, Maya, Cavalry, Rive; (C) inmersivo/live — TouchDesigner, Notch, Resolume, VDMX, Millumin, Smode, Unreal, C4D Fields, Houdini + literatura de UX (Bret Victor, Adobe Research/Draco, Sketch-n-Sketch, Apparatus/Cuttle).
**Honestidad de fuentes:** lo no verificable quedó marcado como tal en cada informe (helpx de Adobe y Reddit bloquean el fetch automatizado; ahí se usó consenso de foros con autoría conocida — Creative COW, KVR, Cockos, Steinberg, BMD).

---

## 1. Veredicto: dónde estamos y dónde está el hueco

Nuestro sistema **ya está en el percentil alto** en lo básico (lanes por pista estilo Ableton, bezier libre, insert shapes, draw mode, simplificación RDP, copiar/pegar curvas, override + re-enable, FX audio-reactivos con attack/release, modificadores de movimiento con wet). Lo que falta no es "más features": es **cerrar 3 fricciones conocidas** y **apostar por 3 diferenciadores que nadie tiene**.

**El hueco de mercado, en una frase:** ningún editor de vídeo tiene el modelo de *modulación unificada* de los DAWs modernos (Bitwig) ni el de *modificadores no destructivos* de 3D (Blender/Cavalry), y **ninguna herramienta —de ningún sector— combina "elegir la banda dibujando sobre el espectro real" (Notch) con "asignar arrastrando al destino" (VDMX/Bitwig)**. Y por definición, ninguna tiene moduladores espaciales de domo.

---

## 2. Los patrones que la industria valida (consenso transversal)

### 2.1 Gestos de curva — el modelo ganador
| Patrón | Quién | Por qué gana |
|---|---|---|
| **Alt+arrastrar el SEGMENTO = curvarlo** · **Alt+doble clic = recta** | Live, Bitwig, Reaper (los 3 iguales) | Un gesto, sin modo, sin handles visibles. **La "tensión por segmento" bate al bezier de 2 handles en velocidad.** ✅ *ya lo tenemos* |
| **Alt+arrastrar el PUNTO curva los dos segmentos vecinos** | Bitwig | Ease in/out simétrico con un gesto | 
| **Hit-zones distintas: cerca de la línea ≠ encima** (mover segmento vs crear punto), **con resalte previo** | Live, Bitwig 6 | Elimina el error de clic — *la queja nº1 de Fusion es exactamente esto* |
| **Punto tipo Hold/Stairs** | Bitwig 6, FL | Cortes duros ✅ *ya lo tenemos* |
| **Freehand → reducción automática a los puntos mínimos** | Bitwig, Reaper | El trazo queda editable ✅ *tenemos RDP, pero manual* |
| **Shift = restringir eje + resolución fina** | Live, todos | Se da por hecho; se protesta si falta ✅ *parcial* |

### 2.2 Operaciones sobre RANGO (no sobre puntos) — aquí estamos flojos
| Patrón | Quién | Qué es |
|---|---|---|
| **Shape Box / Free-transform box** (`Shift+B`) | Fusion (el más completo), AE, Blender | Caja que **escala, sesga y estira en tiempo Y valor a la vez**. Si no hay selección, se arrastra para definir el alcance |
| **Stretch/Skew con handles; Alt = espejo del opuesto** | Live 12 | Igual, en DAW |
| **Taper** (`Ctrl+Alt`+esquina) | AE | Escala la **amplitud** conservando la forma |
| **Campo numérico tri-modo: Value / Offset / Scale** | Fusion | Con multiselección: asignar / sumar / multiplicar. Brillante y trivial de implementar |
| **Insert Shape escalado al rango del parámetro** | Live 12 | ✅ *ya lo tenemos* |

### 2.3 Reutilización — el patrón más potente que ningún editor de vídeo tiene
- **Automation Items (Reaper):** la curva **es un clip**: se arrastra, se **loopea estirando el borde**, y los duplicados son **pooled** (editas uno, cambian todos). Función más citada de Reaper.
- **Bucles como instancias, no copias** (Fusion): editar el original actualiza las repeticiones. `Duplicate` sí copia. Distinción explícita.
- **`Set Relative` / Loop with Offset** (Fusion, Cavalry): cada repetición **acumula** sobre la anterior → rotaciones/paneos infinitos gratis.
- **Buffer curves (Maya):** guarda una copia antes de editar, para comparar y volver. Versionado local sin undo.
- **Librería de easing sobre curva normalizada 0–1**: AE **no la tiene** → por eso existen Flow y Ease and Wizz. *La popularidad de esos plugins es la prueba del hueco de diseño.*

### 2.4 Modelos de composición (keyframes + moduladores)
Tres modelos reales, todos válidos: **Override** (TouchDesigner export, Houdini OVER, Notch) · **Additive con peso** (Houdini Layer CHOP: base absoluta w=1 + capas relativas; Unreal Animation Mixer) · **Pila con blend modes** (Cavalry Behaviour Mixer: Add/Minus/Multiply/Screen/Min/Max/Overlay, reordenable; C4D Fields igual).
**Regla de oro extraída:** el usuario debe poder responder *"¿por qué este parámetro vale eso ahora mismo?"* **sin abrir nada**.

### 2.5 Modificadores no destructivos (el patrón de 3D que falta en vídeo)
- **Blender F-modifiers:** Generator, Built-In Function, Envelope, **Cycles**, **Noise**, Limits, Stepped, Smooth. Se **apilan**, se evalúan en orden, y cada uno tiene **rango de frames + influencia con fade in/out**. Se ajustan siempre, sin hornear.
- **Cavalry Behaviours:** 80+ (Noise, Random, **Spring**, Oscillator, Stagger…) que se adjuntan **con clic derecho sobre cualquier atributo** — "AE sin expresiones". **Spring** añade movimiento secundario *encima* de las keys existentes sin tocarlas.
- **Cavalry Falloffs:** un nodo que vale 1 en el centro y 0 en los bordes y **multiplica la fuerza** de cualquier Behaviour → modulación espacial reutilizable. *(Encaja perfecto con az/el del domo.)*
- **Procedural → horneable:** Cavalry convierte Behaviours a keyframes cuando hace falta. ✅ *nuestro `anim` va por ahí, pero es un preset cerrado, no una pila*

### 2.6 Audio-reactivo — cadena canónica y visualización
**Cadena:** entrada → FFT/bandas → **normalización** → envelope follower (**attack/release asimétricos**; attack rápido + decay lento sigue el beat) → **curva de respuesta** → rango min/max → parámetro. ✅ *tenemos atk/rel/curve/spring*
- **Notch** deja **elegir la región del espectro dibujando sobre el gráfico frecuencia/amplitud en vivo**. Es lo que mejor funciona.
- **Resolume** solo expone Gain + Fall (sin attack → todo "salta"); **Millumin** depende de OSC externo; **TouchDesigner** exige construir el follower a mano.
- **Buena práctica (TD):** un **bus de control normalizado** (bass/mid/high/onset/level) que consumen todas las escenas, en vez de cablear cada parámetro a una señal.

### 2.7 Visualización de la modulación — el patrón ganador
**Bitwig:** clic en el botón de routing (dibujado como *un puerto con un cable*) → los destinos válidos se tiñen → **arrastrar sobre el destino define profundidad y signo** (rango **relativo**) → el control queda con **anillo de color** (azul=mono, verde=poly) y **marcadores cian del valor modulado en vivo sobre el valor base**. Varios moduladores **se apilan y suman**. 7 curvas de transferencia (Linear, Positives, Negatives, Absolute, Toward Zero, Exp, Log).
**VDMX:** right-click-drag desde la fuente al slider, flecha roja, destinos válidos teñidos, **el slider cambia de color** al tener receivers.
**TouchDesigner:** el parámetro tiene 4 modos con **código de color** (gris=constante, azul=expresión, verde=export, morado=bind).

### 2.8 Modos de grabación (touch/latch/write) — el modelo correcto
| Modo | Empieza | Termina | Al soltar |
|---|---|---|---|
| Read | nunca | — | solo reproduce |
| **Touch** | al tocar | **al soltar** | vuelve a la curva existente |
| **Latch** | al tocar | al parar transporte | **mantiene el último valor** |
| Write | al arrancar | al parar | borra todo lo que pasa por debajo |
| **Trim** (Logic) | — | — | **desplaza** la curva ±, no la reemplaza |
| **Cross-Over** (Cubase) | al tocar | **al cruzar la curva original** | punch-out sin salto |

**La decisión de diseño más elegante (Live): no expone modos** — deduce touch vs latch del dispositivo (ratón→touch, mando→latch). Y al mover un control automatizado sin grabar, **apaga el LED de automatización** (override) con un botón **Re-Enable**. ✅ *esto último ya lo copiamos*

---

## 3. Errores documentados que NO debemos cometer
1. **Nunca auto-seleccionar el tipo de gráfico.** AE elige value/speed graph solo, y en Position —la propiedad que más necesita overshoot— te deja por defecto en el gráfico donde el overshoot es ilegible. Es *la* confusión clásica del graph editor.
2. **Un gesto nunca debe significar dos cosas según el modo.** En el speed graph de AE, arrastrar vertical cambia el valor por accidente y **no se puede bloquear** (hilo abierto en Adobe).
3. **Los targets de clic y la estabilidad de la selección importan más que la matemática.** Foro de BMD: *"un pixel de error al pulsar un handle"* y te cambia de atributo en silencio. → hit-zones generosas + resalte previo + separar "visible" de "editable" (Fusion).
4. **No encerrar el gráfico en un panel diminuto** ni obligar a editar clave a clave: por eso Unreal añadió Lattice/Tween tools.
5. **Detalles de implementación fuera de la UI**: el "Influence 33.33%" de AE es 1/3 de un bezier cúbico filtrado al usuario.
6. **Reversibilidad**: VDMX es amado y **no tiene undo**; es su defecto más citado. ✅ *tenemos undo profundo*
7. **Modo global vs por pista**: la queja nº1 de Bitwig 6 es que el modo automatización es global y hay que alternar constantemente.
8. **Borrado por clic simple** (Live) es arma de doble filo → borrados accidentales. ⚠️ *lo tenemos por decisión explícita del usuario; mitigado con cursor+tooltip*

---

## 4. Propuesta para Immersive Studio Pro

### Nivel 1 — Cerrar fricciones (barato, alto impacto)
- **A1 · Hit-zones con resalte previo**: al pasar el ratón, iluminar *qué* se va a editar (punto / segmento / línea) antes del clic. Ataca la queja nº1 de todos los editores.
- **A2 · Alt+arrastrar el punto = curvar ambos segmentos vecinos** (Bitwig).
- **A3 · Campo tri-modo Value/Offset/Scale** sobre la selección de puntos (Fusion) — trivial y muy potente.
- **A4 · Presets de easing sobre curva normalizada 0–1** (lo que Flow le añade a AE): librería + guardar el easing actual + aplicar a la selección.
- **A5 · Reducción RDP automática al soltar el trazo freehand** (Bitwig/Reaper), no como comando manual.
- **A6 · Shift = eje restringido + resolución fina** de forma consistente.

### Nivel 2 — Operaciones de rango (nos falta todo esto)
- **B1 · Shape Box** (`Shift+B`): caja de transformación sobre la selección — escalar/sesgar/estirar en tiempo y valor, Alt = espejo del handle opuesto, sin selección = arrastrar para definir alcance.
- **B2 · Taper**: escalar amplitud conservando forma.
- **B3 · Curve ghosting**: mientras editas, la curva anterior en gris tenue (Cavalry) + **Buffer curve** (Maya) para comparar/volver.

### Nivel 3 — Los 3 diferenciadores (esto es lo que nos separa del mercado)
- **C1 · Pila de modulación unificada, legible** — la síntesis de Bitwig + Cavalry Mixer + Houdini Layer:
  `base (keyframes) → +LFO → ×Audio(low) → clamp` con **blend explícito por capa** (Add/Mult/Min/Max/Override), reordenable, **y la fórmula escrita en texto plano debajo**. Anillo en el control del inspector: arco = rango modulado, punto brillante = valor actual, base = handle. **Tooltip que audita**: *"0.62 = base 0.40 + audio(low ×0.55, atk 8ms/rel 220ms)"*. Ninguna herramienta de vídeo tiene esto; responde la regla de oro sin abrir nada.
- **C2 · Asignación audio-reactiva dibujando sobre el espectro** — caja sobre el FFT **en vivo** (frecuencia × ganancia) y **arrastrarla al parámetro**. Fusiona Notch (elegir banda viéndola) + VDMX (drag-to-assign). **Nadie une las dos.** Complemento: **attack/release dibujables** (mini-curva con el envelope real superpuesto) en vez de dos números, y un **bus de control normalizado** (bass/mid/high/onset) reutilizable por toda la secuencia.
- **C3 · Moduladores espaciales de domo** — un modulador cuyo valor depende de **az/el** del clip (los *Falloffs* de Cavalry en coordenadas fisheye): "más intensidad cerca del cénit", "fade hacia el horizonte". **Ningún NLE lo tiene porque ninguno es fulldome.** Es nuestro terreno exclusivo.

### Nivel 4 — Apuestas de vanguardia (si queremos ir más lejos)
- **D1 · Perform-and-bake**: REC + mover el clip en el domo/fader con el ratón mientras suena → se hornea a curva **simplificada por RDP** (no una clave por frame). Es "Inventing on Principle" aplicado a VJ. Requiere el modelo touch/latch (§2.8).
- **D2 · Automation Items** (Reaper): la curva como clip reutilizable, loopable estirando el borde, **pooled** (instancias, no copias) + **Set Relative** (cada repetición acumula).
- **D3 · Film-strip bajo la curva**: miniaturas del render real en N puntos → ver la *consecuencia*, no el número.
- **D4 · Freeze por modulador** ("latch de espectáculo"): congela la salida al valor actual. Imprescindible en vivo, raro en NLEs.
- **D5 · Modificadores no destructivos apilables estilo Blender** (Noise/Cycles/Spring/Stepped) con **rango + influencia con fade**, y **horneables a keyframes** (Cavalry).

---

## 4-bis. ANÁLISIS ESTÉTICO (hecho VIENDO capturas reales, no leyendo)

Descargué capturas de los manuales oficiales y las comparé con una captura equivalente de nuestro editor (3 lanes: Opacity primaria sobre el clip + Size + Azimuth). Archivos en `scratchpad/ref/`.

### 4-bis.1 Qué hacen visualmente los que funcionan

**Ableton Live (`ab-ArrangerEnvelopeWithBreakouts.png`)** — el más cercano a nuestro modelo:
| Decisión visual | Detalle |
|---|---|
| **Un solo hue por pista, saturación = foco** | TODAS las curvas de la pista son rojas. La que tiene foco: **rojo saturado, opaco**. Las otras lanes: **mismo rojo, desaturado/pálido**. Jerarquía sin introducir colores nuevos. |
| **El contenido se aparta** | El waveform del clip se **oscurece y desatura** bajo la automatización. La curva es la protagonista; el material es contexto. |
| **Headers: texto, no controles** | La lane con foco muestra los **dropdowns** ("Mixer ▾" / "Track Volume ▾"). Las lanes sin foco muestran lo mismo como **texto gris en 2 líneas** ("Mixer" / "Speaker On"). ← **patrón clave** |
| **Color = estado, no decoración** | **Cian** = valor gobernado por automatización ahora mismo · **ámbar** = override/off · el resto, grises. |
| **Puntos** | Círculos pequeños rellenos del color de la curva. Grosor de línea ~2px, esquinas vivas. |

**Bitwig (`bw-range.png`, `bw-multi.png`)** — la referencia de modulación:
- El knob lleva su anillo del color del dispositivo (**ámbar**) = valor base; la modulación se dibuja **encima como arco cian** con el rango, y el valor actual se marca dentro.
- **Ámbar vs cian = complementarios**: base y modulación nunca se confunden.
- Tooltip textual literal: `-> Resonance [+0.50]`, `A -> Hi Freq [-33.70]`. Auditable de un vistazo.

**Blender (`bl-graph.png`)** — el editor de múltiples curvas:
- **Un color por canal** (X rojo, Y verde, Z azul) con **swatch cuadrado en la lista** = el vínculo visual entre lista y curva.
- **Puntos de contraste inverso**: círculos **negros** sobre curvas claras → el punto nunca se camufla en la línea.
- Fondo neutro, rejilla apenas perceptible, escala de valores en el eje con aire.

### 4-bis.2 Qué revela NUESTRA captura (`ours-zoom.png`)
1. 🔴 **Los headers de sub-lane son ilegibles.** "Tra ∨ ◆S ∨ + ✕" — dos dropdowns más tres botones en 152px. No se lee el parámetro que estás editando. **Es el peor problema estético que tenemos** y no lo tiene ninguna referencia: Ableton lo resuelve con texto de 2 líneas y dropdowns solo en la lane con foco.
2. 🔴 **Incoherencia de color**: la curva primaria (Opacity) sale **blanca** sobre el clip, mientras Size sale roja y Azimuth ámbar. El color debe identificar al parámetro **siempre**, en las tres superficies (header, overlay del clip, sub-lane).
3. 🟠 **Se perdió el vínculo header ↔ curva**: al quitar el swatch (R94b) no quedó nada que asocie "esta curva ámbar" con "este header". Blender demuestra que ese swatch es justo el vínculo. Hay que devolverlo, pero **como barra lateral de 2-3px** (no un cuadrado que robe ancho).
4. 🟠 **El clip compite con la curva**: el rayado diagonal del adjustment y el thumbnail pelean con la envolvente. Ableton atenúa el contenido.
5. 🟠 **Sin foco visual**: las 3 curvas pesan lo mismo. No se sabe cuál se está editando.
6. 🟡 Escalas de valor pegadas al borde y casi solapadas entre lanes contiguas ("5°" / "360°").

### 4-bis.3 Reglas estéticas que adopto (y de dónde salen)
| # | Regla | Origen |
|---|---|---|
| E1 | **El color identifica el parámetro en las 3 superficies** (barra del header, overlay del clip, sub-lane). Ningún parámetro en gris/blanco. | Blender |
| E2 | **Saturación = foco**: curva activa 100% / 1.8px · resto mismo hue al ~45% / 1.4px. Jerarquía sin colores nuevos. | Ableton |
| E3 | **El material se aparta**: con automatización activa, el fill/thumbnail del clip baja a ~35%. | Ableton |
| E4 | **Controles solo con foco**: sub-lane con foco = dropdowns; sin foco = **texto de 2 líneas** (dispositivo / parámetro). Mata la ilegibilidad y el ruido. | Ableton |
| E5 | **Punto ≠ línea**: relleno del color + borde oscuro; hover/selección en **blanco**. | Blender |
| E6 | **Color = estado, jamás decoración**: cian `#4FC3E8` = gobernado/modulado en vivo · ámbar `#E5B567` = override · gris = inerte. Cian y ámbar son complementarios → nunca se confunden. | Ableton + Bitwig |
| E7 | **La modulación se dibuja encima del valor base**, no lo reemplaza (arco cian sobre el anillo base) + **tooltip textual auditable**. | Bitwig |
| E8 | Rejilla al mínimo, escalas con aire, fondo neutro. | Blender |

Se añaden 2 tokens al sistema: `--auto-live:#4FC3E8` (cian, gobernado/modulado) y `--auto-ovr:#E5B567` (ámbar, override — ya en uso).

---

## 5. Fuentes principales
**DAWs:** [Ableton — Automation & Editing Envelopes](https://www.ableton.com/en/manual/automation-and-editing-envelopes/) · [Bitwig — Unified Modulation System](https://www.bitwig.com/userguide/latest/the_unified_modulation_system/) · [Bitwig — Automation](https://www.bitwig.com/userguide/latest/automation/) · [Bitwig Studio 6](https://www.bitwig.com/stories/bitwig-studio-6-416/) · [Polarity — Bitwig 6 automation problems](https://polarity.me/posts/polarity-music/2025-09-02-bitwig-6-automation-is-insane/) · [ReaperTips — Automation Items](https://www.reapertips.com/post/a-guide-to-automation-items-in-reaper) · [Logic — Automation modes](https://support.apple.com/guide/logicpro/choose-automation-modes-lgcpb1a6ab26/mac) · [Cubase — Automation Modes](https://www.steinberg.help/r/cubase-pro/15.0/en/cubase_nuendo/topics/automation/automation_automation_modes_c.html) · [SOS — Automation Modes](https://www.soundonsound.com/techniques/automation-modes) · [FL — Automation Clips](https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/playlist_automationclip.htm) · [KVR — Which DAW is best for automation](https://www.kvraudio.com/forum/viewtopic.php?t=543386)
**VFX/motion:** [Blender — F-Curve Modifiers](https://docs.blender.org/manual/en/latest/editors/graph_editor/fcurves/modifiers.html) · [Fusion — Spline Editor](https://www.steakunderwater.com/VFXPedia/__man/Fusion18-6/Fusion18_Manual_files/part409.htm) · [AE — Keyframe interpolation](https://helpx.adobe.com/after-effects/using/keyframe-interpolation.html) · [AE — Editing/moving keyframes](https://helpx.adobe.com/after-effects/using/editing-moving-copying-keyframes.html) · [School of Motion — Graph Editor](https://schoolofmotion.com/blog/intro-to-the-graph-editor-in-after-effects) · [Creative COW — missing handles/speed graph](https://creativecow.net/forums/thread/missing-handles-on-graph-editors-transform-box/) · [Adobe — Disable value editing in speed graph](https://community.adobe.com/t5/after-effects-discussions/disable-value-editing-in-speed-graph/td-p/13709710) · [BMD — Edit page keyframe editor](https://forum.blackmagicdesign.com/viewtopic.php?f=33&t=127056) · [Cavalry — Behaviours](https://cavalry.studio/docs/nodes/behaviours/) · [Cavalry — Behaviour Mixer](https://docs.cavalry.scenegroup.co/nodes/behaviours/behaviour-mixer/) · [Rive vs AE](https://rive.app/blog/rive-vs-after-effects)
**Inmersivo/live + UX:** [TouchDesigner — Parameter Mode](https://derivative.ca/UserGuide/Parameter_Mode) · [Notch — Sound FFT Modifier](https://manual.notch.one/1.0/en/docs/reference/nodes/modifiers/sound-fft-modifier/) · [Resolume — Parameter Animation](https://resolume.com/support/en/7.12/parameter-animation) · [VDMX — UI Controls](https://docs.vidvox.net/vdmx/vdmx_ui_controls) · [Houdini — Layer CHOP](https://www.sidefx.com/docs/houdini/nodes/chop/layer.html) · [C4D — Fields](https://www.maxon.net/en/cinema-4d/features/fields-system) · [UE — Animation Mixer](https://dev.epicgames.com/documentation/unreal-engine/cinematic-animation-track-in-unreal-engine) · [Envelope followers](https://kferg.dev/posts/2020/audio-reactive-programming-envelope-followers/) · [Bret Victor — Inventing on Principle](https://jamesclear.com/great-speeches/inventing-on-principle-by-bret-victor) · [Drawing Dynamic Visualizations](https://worrydream.com/DrawingDynamicVisualizationsTalkAddendum/) · [Draco (CHI 2014, R. Habib Kazi)](https://rubaiathabib.me/portfolio/draco/) · [Sketch-n-Sketch](https://arxiv.org/pdf/1507.02988) · [Apparatus](https://aprt.us/) · [Resolume vs VDMX vs TD](https://projectileobjects.com/2025/11/28/resolume-vs-vdmx-vs-madmapper-vs-touchdesigner-which-live-visuals-software-and-why/)
