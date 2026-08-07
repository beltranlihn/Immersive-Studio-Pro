# Propuesta de rediseño de UI (R102) — Immersive Studio Pro

> Se apoya en: `AUDITORIA-DISENO-UI.md` (medición de lo nuestro) + `INVESTIGACION-DISENO-UI.md` (30 reglas con
> fuente) + medición directa de Ableton Live 12, Premiere Pro 2025, Blender 4.0 y Unreal 5.8 **en la máquina de
> Beltrán**, a resolución nativa.
> **Todo valor de abajo tiene una razón trazable. Si algo no la tiene, no está.**

---

## 0. Lo que NO vamos a hacer (y por qué)

Esto importa tanto como lo que sí. Tres cosas que parecían obvias y la evidencia tumbó:

| Idea descartada | Por qué |
|---|---|
| **Subir el fondo a `#121212` (regla de Material)** | Medido: Premiere (vídeo, el análogo correcto) está en L\*=10.8; nosotros en 8.2. **No estamos fuera de sitio.** Ableton (22.6) y Blender (26.7) son más claros porque **no juzgan imagen**. Un entorno oscuro alrededor del visor está justificado en una herramienta de vídeo. |
| **Bajar el contraste del texto porque "16:1 es mucho"** | Premiere corre 16.9:1; nosotros 16.1:1. Estamos con el análogo correcto. (Ableton 5.9:1 y Blender 3.3:1 son otra liga porque su campo es medio.) |
| **Crear una escala tipográfica de 5–6 escalones** | Blender envía **toda su UI a 11pt/400**: un tamaño, un peso. Atlassian envía cuerpo y encabezado al mismo tamaño, separados solo por peso. Una escala uniforme **no es el defecto**. |
| **Forzar todos los espaciados a múltiplos de 4** | Spectrum, Primer y Atlassian **envían 2px y 6px como tokens con nombre**. Blender envía 5px. El mecanismo real es **paleta cerrada**, no pureza de rejilla. |
| **Agrandar los controles a 44px** | Es WCAG **AAA** y es guía **táctil**. La norma AA (SC 2.5.8) es 24×24 **con excepción de espaciado**: un control de 20px cumple si su centro está a ≥24px del siguiente. Blender usa 20px en toda la app. **Nuestra densidad está justificada por norma.** |

---

## D-T1 · El sistema (invisible, pero lo cambia todo)

**Problema medido:** 8 valores de gap (7 fuera de rejilla) · 78 hex cableados en `app.js` contra 4 usos de token ·
`#B4BAC1` usado 23 veces sin ser token · 6 superficies · 32 elementos a 9px · tamaños inline de 11,5 y 12,5px.

| # | Cambio | Valor | Razón |
|---|---|---|---|
| 1 | **Paleta CERRADA de espaciado** | `{2, 4, 6, 8, 12, 16, 20, 24, 32}` | Intersección exacta de Spectrum + Primer + Atlassian. Mapear nuestros 8 gaps al más cercano y **borrar el resto**. Sin escotilla. |
| 2 | **6 superficies → 3** | `--s0` fondo · `--s1` panel · `--s2` control | **Nuestro defecto estructural real.** M3 define 5 roles y no los usa adyacentes. Y medido: toda referencia tiene **una superficie dominante** con 30–54% del área; la nuestra manda solo en el 26% porque repartimos en seis. |
| 3 | **Paso entre superficies** | **4–5 L\*** | Spectrum envía ΔL\* 2.78–4.88; M3 Δ 2–5. Medir en **L\***, nunca en ratio de contraste (WCAG y APCA dan Lc 0.0 a *todos* los sistemas publicados en el extremo oscuro). |
| 4 | **Suelo tipográfico: matar 9px** | **11px** mínimo | Nadie envía 9px: Spectrum 10, Blender 11, Primer 12, Atlassian 12. Y Geist a 9px da x-height **4,77px** — bajo el suelo de renderizado. |
| 5 | **Escala: 3 tamaños** | **11 / 13 / 16** | Escalón mínimo útil 2px (~1.17). A 11px un escalón de 1px está por debajo del umbral de discriminación. Matar 11,5 y 12,5. |
| 6 | **Peso como canal de jerarquía** | **400 / 500 / 600** | Ya empaquetados. Atlassian: cuerpo 12/400 vs encabezado 12/653. **Es nuestro presupuesto sin gastar.** |
| 7 | **Inter como cuerpo** (Geist para marca) | tracking **+0.005em @11px**, **0 @12px** | Inter x-height 0.5459 vs Geist 0.530 (**medido en nuestro repo**): +3% gratis. Tabla del propio autor de Inter. |
| 8 | **Interlineado** | `round(px × 1.4)` | `InterDynamicLineHeight`. |
| 9 | **Texto secundario arriba** | **#AFAFAF–#C4C4C4** | `#8A9199` (nuestro `--ink-faint`) pasa WCAG AA y da **APCA Lc −38**. La métrica que nos tranquilizó miente en oscuro. Objetivo **≥7:1**, no 4.5 (M3 apunta a 7:1 en oscuro). |
| 10 | **Tokens de verdad** | `app.js` sin hex | Ableton deriva sus colores con **11 blend factors** sobre tokens base. La diferencia entre un tema retintable y 78 números mágicos. |
| 11 | **Separadores: 3 alfas, no 10** | `{0.05, 0.10, 0.16}` | Nadie distingue 0.08 de 0.09. M3: separador decorativo objetivo **1:1** (sin mínimo); borde con significado **3:1**. |

**Riesgo:** toca todo. **Mitigación:** los tokens ya existen; es sustitución mecánica + verificación por CDP de
que no queda ningún tamaño fuera de {11,13,16} ni ningún gap fuera de la paleta.

---

## D-T2 · La línea de tiempo (donde vive el trabajo)

| # | Cambio | Valor | Razón |
|---|---|---|---|
| 12 | **Filas alternas** | `rgba(255,255,255,0.02)` | Blender envía `row_alternate = #ffffff05` (~2%). La mayoría usa 10–15% y zumba. |
| 13 | **Tipo de clip por TONO a luminosidad constante** | brillo = **estado**, nunca tipo | Los 11 colores de strip de Blender están todos al mismo valor. **Si el tipo varía el brillo, la selección se queda sin canal.** Nuestras secuencias (`kind:'nest'`) → gris neutro como el `scene` de Blender: son estructura, no medio. |
| 14 | **Selección en DOS niveles** | `Selection` + `StandbySelection` | Ableton lo envía en fondo *y* primer plano. Tenemos tres zonas peleando por el foco (timeline/cabeceras/inspector) y lo colapsamos en uno. |
| 15 | **Estado derivado ≠ afirmado** | | Ableton tiene `ImplicitArm`. Un clip seleccionado *porque su pista lo está* no debe verse igual que uno que seleccionaste tú. |
| 16 | **Hover como token, y sutil** | | `AutomationMouseOver` vive junto a `AutomationColor`. Pero Blender: *"strong mouse hover highlights can be very flashy"*. Sobre 30 pistas, un hover fuerte hace estroboscopio. |
| 17 | **Nunca color como único portador de estado** | glifo + tinte | Resolve: *"A slash indicates when a track is disabled."* Para daltonismo y para recuerdo. |
| 18 | **Contenido de cabecera según altura** | tiers explícitos | Resolve, textual: *"The number of clips is listed, **but only if the track is tall enough**."* Envían Micro/Mini/Medium/Large/XL. Nuestra fila mide **82px** — decidir tiers en vez de recortar un layout. |
| 19 | **Editor de curvas: polaridad invertida** | campo más claro, rejilla más oscura | Blender: graph `#303030` con rejilla `#1a1a1a`, invirtiendo su secuenciador (`#181818` con rejilla `#303030`). Curvas finas piden campo elevado; los clips piden pozo. |
| 20 | **La barra de título de la pista ES el color** | | Visto en Ableton: sin muestra aparte; el nombre va sobre la barra coloreada y los clips heredan. Nos ahorra un elemento. |
| 21 | **No acoplar selección y cabezal** | | Blackmagic **desactivó "Selection Follows Playhead" por defecto desde v17**. Cabezal = tiempo; selección = intención. |

---

## D-T3 · Controles y affordances

| # | Cambio | Valor | Razón |
|---|---|---|---|
| 22 | **UN acento saturado = "esto se arrastra"** | y en ningún otro sitio | El único acento del set de widgets de Blender es `wcol_num.item #4772b3`, el relleno del deslizador. **Enseña el gesto en toda la app sin una etiqueta.** La decisión de mayor apalancamiento de la lista. |
| 23 | **Presupuesto de acentos = 2, escrito** | | Live se diseñó a dos colores; el tercero *"muddies the waters"*. Carl lo defendió y **perdió**. Solo aguanta si está escrito. |
| 24 | **Dirección del contraste = affordance** | botón **más claro** que el fondo; campo editable **más oscuro** | Blender: `#545454` (botón) vs `#1d1d1d` (campo) sobre `#181818`. Sin bordes, sin iconos. |
| 25 | **Altura de control** | **20–24px**, paso **≥24px centro a centro** | Blender: 20px en toda la app, paso 22px. Y así se cumple SC 2.5.8 AA. Nuestras alturas actuales: 16/18/**21**/22/24 → colapsar; el 21 es un accidente. |
| 26 | **Controles al borde: margen exterior 0** | | Los bordes tienen *W* infinita. **Farris et al. 2001** (empírico): los objetivos al borde se adquieren más rápido que a **1px** hacia dentro. Aplica a regla, scrollbars y toolbars ancladas. |
| 27 | **Ejes por color en el borde del campo** | R/G/B | Visto en Unreal: Location X/Y/Z llevan franja roja/verde/azul **en el campo**. Identifica sin gastar etiqueta. Para az/el/size. |
| 28 | **Etiquetas por defecto; icon-only con tooltip SIEMPRE** | | HIG de Blender: icon-only solo si (a) universal, (b) el espacio es *claramente* limitado, (c) reduces peso a propósito, (d) indicador de estado, (e) ancla visual. |
| 29 | **Etiquetas a la derecha, pegadas al campo** | | Visto en Blender: crea un eje vertical de lectura limpio en el panel de propiedades. Nuestro inspector no lo hace. |

---

## D-T4 · Lenguaje y ayuda (lo más barato, y no lo tenemos)

| # | Cambio | Razón |
|---|---|---|
| 30 | **Barra contextual fija abajo-izquierda** | **El hallazgo de las capturas.** Ableton: *"Insert Mark 1.1.1 (Time: 0:00)"*. Blender: *"Set 3D Cursor · Rotate View · Select"* — **qué hace cada botón del ratón AHORA**. Un sumidero fijo: **no tapa nada** (decisivo sobre una timeline), **legitima los controles sin etiqueta**, y **nunca abre ventana**. Quitamos las instrucciones en R94f y no pusimos nada. Esto es lo que faltaba. |
| 31 | **Verbos, no sustantivos** | *"Emphasize actions, not things."* Ahí sangró FCPX: la confusión era **léxica** (*"primary storyline – huh?"*). Nuestro dominio es pesado en sustantivos: nest, seqMode, room, strip, warp. Auditar cada entrada de menú. |
| 32 | **Contrato de tooltip** | Nombre sin punto → descripción en imperativo, 2–3 líneas → **atajo** → **motivo de deshabilitado**. **Nunca documentar valores por defecto.** El campo "por qué está deshabilitado" es **nuestra superficie para enseñar atajos**: es el único sitio donde el usuario mira cuando está bloqueado, que es justo cuando quiere aprender. |
| 33 | **Operate → Adjust** | Ejecutar con los últimos ajustes y exponer parámetros *después*: *"prevents annoying popups forcing you to decide settings before you even know how they'd look like."* Patrón correcto para **proxies y export**. |
| 34 | **Constancia posicional (regla de cabina)** | El **mismo control en el mismo sitio** en dome/flat/room. Nuestra bifurcación por `seqMode` es el riesgo. |
| 35 | **Documentar las inconsistencias** | *"Inconsistencies should be well founded and documented."* La HIG de Blender admite que **abusa de los acentos**. El documento de diseño más creíble es el que nombra sus propias violaciones. |

---

## Orden propuesto

1. **D-T1** — el sistema. Nada de lo demás cuadra sin esto, y es el 80% de la sensación de "casi bien pero no".
2. **D-T4** — lenguaje y ayuda. Lo más barato, alto impacto, riesgo casi nulo.
3. **D-T2** — la línea de tiempo.
4. **D-T3** — controles.

Verificación por CDP en cada tanda, con el mismo rigor que R100/R101: aserciones automáticas de que no queda
ningún tamaño fuera de {11,13,16}, ningún gap fuera de la paleta, ningún hex cableado en `app.js`, y contraste
de todo par texto/superficie medido en L\* y APCA, no solo WCAG.
