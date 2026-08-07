# Investigación de diseño de UI para herramientas profesionales densas (R102, parte 2)

> Parte 1 = `AUDITORIA-DISENO-UI.md` (medición de lo nuestro). Esta parte 2 decide **contra qué** corregir.
> Método: se priorizaron **fuentes primarias legibles por máquina** (ficheros de tokens que publican los propios
> fabricantes, código fuente, y los binarios de fuentes de nuestro propio repo) por encima de páginas de
> documentación — las de Spectrum/Material se renderizan con JS y no devuelven texto. Cada regla lleva fuente y
> nivel de autoridad. Lo no verificable está marcado como tal.

---

## 0. LO PRIMERO: dos de mis cinco diagnósticos eran FALSOS

Esto es el resultado más valioso de la investigación. Si hubiéramos "arreglado" la UI con mi auditoría en la mano,
habríamos roto dos cosas que están bien.

### ❌ FALSO — "la escalera de fondos es imperceptible (1.03–1.11)"

Medí bien y **concluí mal: usé la regla equivocada.**

| sistema | contraste entre superficies contiguas (oscuro) |
|---|---|
| Adobe Spectrum (enviado) | **1.08 – 1.19** |
| Google Material M2 (enviado) | **1.03 – 1.12** |
| **Nosotros** | **1.03 – 1.11** |

**Estamos dentro de especificación.** Es más: implementando APCA-W3 (validado contra sus pares canónicos:
`#888` sobre `#fff` → Lc 63.06 exacto) y pasándolo por **todos** los pares contiguos de Spectrum y Material,
APCA devuelve **Lc 0.0 en todos** — por debajo de su suelo de ruido.

La razón es que **ni WCAG ni APCA sirven para esto**: (1) la fórmula de WCAG lleva una constante de velo `+0.05`
que domina la aritmética cerca del negro y aplasta las diferencias reales al rango 1.0x — deficiencia conocida y
motivo por el que existe APCA como candidata a WCAG 3; (2) ambas métricas modelan **detalle a escala de glifo**
(trazos finos, alta frecuencia espacial). Dos paneles de 400px que comparten un borde recto son otra tarea
perceptual: discriminación de luminancia de campo amplio, donde el ojo es ~un orden de magnitud más sensible.

**La regla correcta es CIE L\*** (≡ tono HCT ≡ L de OKLCH). Spectrum envía ΔL\* de **2.78–4.88**; los tonos de M3
son 4/6/10/12/17/22/24 → Δ de **2–5**.

**El defecto real es otro: tenemos SEIS superficies simultáneas.** M3 define 5 roles de contenedor y **no los usa
todos adyacentes**; Spectrum tiene 7 grises en toda la rampa, texto incluido. Seis elevaciones a la vez en un
panel denso superan el canal **a cualquier tamaño de paso**. → **Bajar a 3 y ensanchar el paso a 4–5 L\*.**

### ⚠️ PARCIALMENTE FALSO — "todo vive en 9/10/11px, no hay jerarquía"

**Blender envía TODA su UI a 11pt/400.** Un tamaño, un peso:

```c
#define UI_DEFAULT_TEXT_POINTS    11.0f
#define UI_DEFAULT_TITLE_POINTS   11.0f
#define UI_DEFAULT_TOOLTIP_POINTS 11.0f
```
Y en `interface_style.cc`, los cuatro estilos (`paneltitle`, `grouplabel`, `widget`, `tooltip`) van a
`character_weight = 400`. Con `U.dpi = 72` por defecto → `scale_factor = 1.0` → **11pt = 11px**.
La jerarquía en Blender la lleva **el layout, la agrupación, la sangría y el color**. Al 100%.

Atlassian lo demuestra por otra vía: `--ds-font-body-small` y `--ds-font-heading-xxsmall` son **ambos 12px/16px**,
separados **solo por peso** (400 vs 653).

**Una escala uniforme es un defecto solo cuando ningún otro canal lleva la jerarquía.** Nuestro problema no es
tener pocos tamaños — es que **9px no lo envía nadie** y que no tenemos otro canal trabajando.

### ✅ CONFIRMADOS — los otros tres

3. **Tokens no adoptados** (78 hex cableados en `app.js`). Ableton deriva sus colores compuestos con **11
   `*BlendFactor`** sobre tokens base en vez de enumerar cada combinación. Es la diferencia entre un tema
   retintable y 400 números mágicos.
4. **Sin paleta cerrada de espaciado.** Ver §3 — y el mecanismo real no es "redondear a 4".
5. **Grises fuera del sistema fallan** — y **peor de lo que creía**. Ver §2.

---

## 1. Tipografía — números

### Los suelos que envían los sistemas reales

| sistema | suelo | base escritorio |
|---|---|---|
| Adobe Spectrum (`variables.json`) | **10px** (`font-size-25`) | **14px** (`font-size-100`) |
| GitHub Primer (`typography.json5`) | **12px** | 16px |
| Atlassian (`@atlaskit/tokens`) | **12px** (`body-small`) | 14px (`body`) |
| Blender (fuente) | **11px** | 11px (único) |

**Nadie envía 9px. Nuestros 32 elementos a 9px no tienen respaldo en ningún sistema publicado.**

### Y hay una razón adicional, con investigación real, para subir *porque* somos oscuros

**Piepenbrock, Mayr & Buchner (2014), *Human Factors* 56(5)** — revisado por pares, tarea de corrección de
pruebas, cuatro tamaños (8/10/12/14pt). Resultado: *"the positive polarity advantage linearly increased with
decreasing character size"*. Conclusión textual: **"Especially with small font sizes, negative polarity displays
should be avoided."**

Mecanismo (estudio complementario, *Ergonomics* 57(11)): un fondo claro **contrae la pupila** → menos aberración
esférica, más profundidad de campo → imagen retiniana más nítida. El tamaño de pupila **predijo el rendimiento de
forma significativa**.

**Oscuro + texto pequeño son penalizaciones multiplicativas.** El tema oscuro no se negocia (evaluar imagen lo
exige), así que **hay que pagarlo en tamaño**: nuestro suelo debe ser *más alto* que el de una herramienta clara,
no más bajo.

### El escalón mínimo útil

A 11px, un escalón de tipo ≈ 1px ≈ 9% — el propio salto 11→12 de Spectrum es ratio **1.09**, en o por debajo del
umbral de discriminación. **No se puede construir jerarquía perceptible con ratios de tamaño por debajo de ~14px.**
Escalón mínimo útil en el extremo pequeño: **2px (~1.17)** → **11 / 13 / 16**, no 9 / 10 / 11.

### Nuestras fuentes, medidas con fontTools sobre `assets/fonts/`

| fichero | x-height | cap | ejes |
|---|---|---|---|
| `geist-400.woff2` | **0.530 em** | 0.710 | **ninguno (estática)** |
| `inter-latin.woff2` | **0.5459 em** | 0.7275 | **solo `wght`** |
| `jetbrainsmono-latin.woff2` | 0.550 | 0.730 | wght 400–800 |

- **Geist tiene la x-height 3.0% menor que Inter.** A 11px: Geist **5.83px** vs Inter **6.00px**.
  A 9px: Geist **4.77px** — por debajo de 5px, el suelo práctico de renderizado (una `e` tiene que resolver 3
  trazos horizontales y 2 contraformas ahí dentro).
- **Nuestro `inter-latin.woff2` NO tiene eje `opsz`** — solo `wght`. La Inter real trae `opsz 14–32`.
  Es decir: **ninguna de nuestras fuentes hace compensación óptica alguna.**
- Inter a 11px nos da +3% de x-height gratis. **Inter es mejor cuerpo que Geist para esto**; Geist puede quedarse
  para texto grande/marca. JetBrains Mono (x-height 0.550, la mayor) está bien elegida para números.

### Tracking de Inter (tabla del propio autor, recuperada de su archivo)

Fórmula activa: `tracking(px) = −0.0223 + 0.185·e^(−0.1745·px)` (em), y `lineHeight = round(px × 1.4)`.

| px | tracking | interlineado |
|---|---|---|
| 10 | +0.010 | 14 |
| **11** | **+0.005** | **15** |
| **12** | **0.000** | **17** |
| 13 | −0.0025 | 18 |
| 14 | −0.006 | 20 |

**12px es la bisagra: el tamaño al que Inter no necesita tracking.** Por debajo hay que añadir positivo.

---

## 2. Color en oscuro — números

- **Superficie base `#121212`.** Google, textual: *"the bottom-most layer of the interface is typically a dark
  gray with the hex value #121212."*
- **Negro puro prohibido.** Google, textual: el blanco puro sobre oscuro *"would visually 'vibrate'"* y
  *"appears to bleed or blur against the dark background"* — eso **es halación**, descrita sin nombrarla.
  Mecanismo doble: pupila dilatada → aberración esférica ↑; y **~1 de cada 3 adultos tiene astigmatismo
  significativo**, que emborrona un glifo brillante sobre campo oscuro mucho más que al revés, porque el
  emborronamiento **añade luz** a la oscuridad en vez de restarla a la claridad.
  Además: **sobre negro no se ve una sombra** → la elevación se vuelve irrepresentable (por eso existe el sistema
  de overlays).
- **La tabla de overlays de Material no es una tabla, es una fórmula.** Extraída de la implementación normativa de
  Google (`ElevationOverlayProvider.java`): `alpha = (4.5·ln(dp+1) + 2) / 100`. Reproduce la tabla publicada
  exactamente (1dp→5.12%≈5%, 8dp→11.89%≈12%, 24dp→16.48%≈16%).
- **M3 abandonó los overlays** y usa roles de superficie con tonos fijos: `surface` 6, `surface-container` 12,
  `surface-container-high` 17, `surface-container-highest` 22, `surface-bright` 24.
- **M3 apunta a 7:1 (AAA) para el texto primario en oscuro**, no 4.5. Y `outline-variant` (separadores
  decorativos) tiene objetivo **1:1** — Google dice formalmente que un separador decorativo **no necesita
  contraste alguno**.

### 🔴 El hallazgo que más nos toca: WCAG miente en modo oscuro

| texto sobre `#1B1B1B` | WCAG | APCA Lc |
|---|---|---|
| `#8A8A8A` | **4.99:1 ✅ AA** | **−38.1 ❌** |
| `#AFAFAF` | 7.85:1 ✅ AAA | −57.5 |
| `#C4C4C4` | 9.88:1 | −69.5 |
| `#DBDBDB` | 12.44:1 | −83.3 |

**`#8A8A8A` pasa AA y APCA lo puntúa Lc −38 — territorio "aviso de copyright".** Y APCA **no bendice texto de
cuerpo por debajo de 14px/400 a ningún contraste**.

Nuestro `--ink-faint` es **`#8A9199`** — exactamente esa clase de gris. Pasaba AA en mi auditoría (4.22–6.02) y
eso me tranquilizó. **El número que me tranquilizó estaba mintiendo.**

→ Texto secundario a **`#AFAFAF`–`#C4C4C4`**, y **4.5:1 no es objetivo suficiente a 11px sobre oscuro; usar ≥7:1.**

### Folclore desmontado

- **"Material exige 15.8:1"** — ❌ **no verificable y se contradice.** Fuente primaria inalcanzable; la
  reconstrucción da 15.61:1 (87% blanco sobre `#000`), no 15.8. Y el blanco sobre la propia rampa de elevación de
  M2 **cae a 11.55:1 a 24dp** → "al menos 15.8:1" es **falso para las superficies del propio Material**. No usar.
- **"La HIG de Blender dice…"** — ⚠️ **no dice nada numérico.** Es enteramente cualitativa y se autodescribe como
  *"Work in Progress… unpolished and a lot of content is missing still"*. **Citar el código de Blender, no su HIG.**
- **"Gris de bajo contraste = elegante"** — ❌ falso, y peor: es un fallo de métrica, no de gusto.

---

## 3. Espaciado — la rejilla base es 4px, y el mecanismo no es redondear

Tres ficheros de tokens independientes, extraídos de tres fabricantes:

| Spectrum | Primer | Atlassian |
|---|---|---|
| 1, **2**, **4**, **6**, **8**, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96 | **2**, **4**, **6**, **8**, 12, 16, 20, 24, 28, 32… | **2**, **4**, **6**, **8**, 12, 16, 20, 24, 32, 40, 48, 64, 80 |

Atlassian lo hace explícito: `space-025`=2, `space-050`=4, `space-075`=6, **`space-100`=8**.

1. **La base es 4, no 8.** 8 es el escalón *cómodo*, no la base.
2. **Los tres envían 2px. Spectrum envía 1px.** No son violaciones: son **tokens con nombre**, justo para los
   casos densos que tenemos (hueco icono-etiqueta, separadores en línea).
3. **Los tres envían 6px** — el valor "fuera de rejilla" que todo el mundo necesita y nadie se disculpa por él.
4. **Cómo tratan los valores que no encajan: no tienen ninguno.** Nombran cada valor legal como token y **no hay
   escotilla de escape**. El mecanismo real es **"la paleta está cerrada"**.

Y el matiz que evita el purismo: **Blender envía `templatespace = 5` y `boxspace = 5`**, fuera de cualquier
rejilla de 4 — pero su set completo tiene **4 valores** (2, 4, 5, 8). **El número de valores importa más que la
pureza de la rejilla.** Nosotros tenemos 8.

→ **Mapear nuestros 8 gaps al valor más cercano de `{2, 4, 6, 8, 12, 16, 20, 24, 32}` y borrar el resto.**

---

## 4. Dianas — el 44px es folclore mal citado, y la norma cambió

- **SC 2.5.5 "Target Size (Enhanced)" = 44×44 es Nivel AAA.** Nadie conforma AAA en un producto entero; el propio
  W3C dice que no es alcanzable para sitios completos. **El 44 que citan los blogs de móvil es un criterio AAA.**
  Apple 44pt y Google 48dp son guía **táctil** (yema ≈10mm; el punto caliente de un cursor es 1px).
- **SC 2.5.8 "Target Size (Minimum)", nuevo en WCAG 2.2, es Nivel AA y el número es 24×24 CSS px.**
- **Y la excepción que gobierna las herramientas densas, textual:** *"Undersized targets… are positioned so that
  if a 24 CSS pixel diameter circle is centered on the bounding box of each, the circles do not intersect another
  target"*.

→ **Un control de 16 o 20px es plenamente conforme AA si su centro está a ≥24px del siguiente.**
Dos botones de 20×20 con 4px de hueco = 24px de paso = **pasa**. Es exactamente así como se construye una
herramienta densa, y lo dice el W3C.

**Blender:** *"Widget unit is 20 pixels at 1X scale"* — `UI_UNIT_X = UI_UNIT_Y = 20`, `buttonspacey = 2` → paso de
**22px**, en toda la aplicación.

**Fitts bien aplicado:** `MT = a + b·log₂(2D/W)` — el tiempo depende de la distancia **y** del tamaño. Los layouts
densos reducen *D* más rápido de lo que reducen *W*: **esa es toda la justificación de la densidad**, y por eso
"haz todo de 44px" es **contraproducente** en una herramienta profesional (infla *D* para todos los objetivos a
cambio de *W* en uno).

**Bordes de pantalla:** tienen *W* infinita en el eje perpendicular. **Farris, Jones & Anders (2001), *Proc.
HFES* 45(15)** — investigación empírica real: los objetivos en el borde se adquieren de forma fiable más rápido
que los situados **un solo píxel** hacia dentro. → **Controles anclados al borde: margen exterior 0.**

---

## 5. Reglas de arquitectura (de los informes de DAW y de vídeo)

- **Presupuesto de acentos = 2.** Live se diseñó como sistema de dos colores; el tercero *"muddies the waters"*.
  Eric Carl (Principal Designer, Ableton) defendió 2 en Drift y **perdió internamente**. La disciplina solo
  aguanta si está escrita.
- **La selección tiene DOS niveles:** `Selection` vs `StandbySelection` (fondo *y* primer plano). Enfocado vs
  seleccionado-pero-sin-foco. Con timeline + cabeceras + inspector compitiendo por el foco, colapsarlo pierde al
  usuario.
- **Estado derivado ≠ estado afirmado:** Ableton tiene `ImplicitArm` — armado por consecuencia de la selección se
  ve distinto de armado por clic.
- **El hover es un token**, no un detalle de CSS: `AutomationMouseOver` vive junto a `AutomationColor`/`Grid`/
  `Disabled`. Sobre una timeline oscura, el hover **es** la affordance de "esto se edita".
  Pero: *"strong mouse hover highlights can be very flashy and cause distracting visual noise"* — sutil.
- **Un botón es MÁS CLARO que su fondo; un campo editable es MÁS OSCURO** (Blender: `#545454` vs `#1d1d1d` sobre
  `#181818`). La affordance se codifica en la **dirección** del contraste.
- **Filas alternas a 2% de blanco** (`#ffffff05`). La mayoría usa 10–15% y zumba.
- **Un solo acento saturado = "esto se arrastra"** (`wcol_num.item #4772b3`, el relleno del deslizador numérico).
  Enseña el gesto en toda la app sin una etiqueta.
- **Tipo por TONO a luminosidad constante; el eje de brillo entero reservado al estado.** Los 11 colores de clip
  de Blender están todos al mismo valor. Si el tipo varía el brillo, la selección se queda sin canal.
- **Nunca color como único portador de estado** — *"Avoid using color as the only way of communicating status"*.
  Resolve: *"A slash indicates when a track is disabled."*
- **El contenido de la cabecera es función de su altura**, dicho explícitamente por Blackmagic: *"The number of
  clips… is listed, but only if the track is tall enough to have room for them."* Resolve envía tiers
  Micro/Mini/Medium/Large/Extra Large/Custom.
- **Cabeceras asimétricas por tipo de pista:** vídeo = 5 controles, audio ≈ 10 (incl. dB en el cabezal y medidores
  en vivo). La simetría no es virtud.
- **No acoplar selección y cabezal:** Blackmagic **desactivó "Selection Follows Playhead" por defecto desde v17**.
  Cabezal = tiempo, selección = intención.
- **El editor de curvas va sobre campo MÁS CLARO con rejilla MÁS OSCURA** (`#303030` con rejilla `#1a1a1a`),
  invirtiendo la polaridad del secuenciador (`#181818` con rejilla `#303030`).
- **Verbos, no sustantivos.** *"Emphasize actions, not things."* Ahí sangró FCPX: la confusión documentada de los
  editores era **léxica** (*"primary storyline, secondary storyline – huh?"*). Nuestro dominio ya es pesado en
  sustantivos (nest, seqMode, room, strip, warp).
- **Operate → Adjust, no Configure → Operate:** ejecutar con los últimos ajustes y exponer los parámetros
  *después* — *"This prevents annoying popups forcing you to decide settings before you even know how they'd
  look like."* Es el patrón correcto para proxies y export.
- **Nada bloquea.** Ya no podemos usar `alert/confirm` en Electron: convertir la restricción en principio.
- **Constancia posicional (regla de cabina):** los controles necesarios aparecen en lugares esperados sin
  configuración. Riesgo directo para nosotros: el **mismo control debe vivir en el mismo sitio en dome/flat/room**.
- **Documentar las inconsistencias:** *"Inconsistencies should be well founded and documented… Breaking can be an
  acceptable trade-off if there are good reasons to do so - but only then."* Y el documento de diseño más creíble
  del sector es el que **nombra sus propias violaciones** (la HIG de Blender admite que abusa de los acentos).

### Higiene: una cita famosa que resultó falsa

La frase crítica sobre la timeline magnética de FCPX que los buscadores atribuyen a **Larry Jordan** **no está en
su texto** — es un comentario de un lector. Sus palabras reales: *"Some good, some bad, though, overall, its been
mostly good."* **No citarla.**

---

## 6. Reglas numéricas para adoptar

| # | Regla | Valor | Fuente |
|---|---|---|---|
| T1 | Suelo tipográfico absoluto | **11px** — matar 9px | Spectrum, Primer, Atlassian, Blender: nadie baja de 10 |
| T2 | Tamaño base de UI | **12–13px** | Inter no necesita tracking a 12px (bisagra) |
| T3 | Recargo por tema oscuro | **+1px** vs herramienta clara | Piepenbrock 2014 (revisado por pares) |
| T4 | Escala (máx. 3 tamaños) | **11 / 13 / 16** | escalón mínimo útil 2px (~1.17); 1px < umbral |
| T5 | Canal de jerarquía por debajo de 14px | **peso, no tamaño** | Atlassian: 12px/400 vs 12px/653 |
| T6 | Rampa de pesos | **400 / 500 / 600** | ya empaquetados en `assets/fonts/` |
| T7 | Tracking a 11px | **+0.005em** (12px → 0) | tabla del autor de Inter |
| T8 | Interlineado | **round(px × 1.4)** | `InterDynamicLineHeight` |
| T9 | Cuerpo de texto | **Inter sobre Geist** | x-height 0.5459 vs 0.530 (medido en nuestro repo) |
| D1 | Superficie base | **#121212** | Google, textual |
| D2 | Negro puro | **prohibido** | halación; sombras invisibles |
| D3 | Medir superficies en **L\***, no en contraste | — | APCA da Lc 0.0 a TODOS los sistemas publicados |
| D4 | Paso entre superficies contiguas | **4–5 L\*** | Spectrum ΔL* 2.78–4.88; M3 Δ 2–5 |
| D6 | **Máx. superficies simultáneas** | **3** (+1 peso de borde) | **nuestro defecto real: tenemos 6** |
| C1 | Texto primario | **#DBDBDB–#E0E0E0** | M2 87%; Spectrum gray-800 |
| C2 | Texto secundario | **#AFAFAF–#C4C4C4** — nunca #8A8A8A | #8A8A8A pasa AA y da APCA Lc −38 |
| C4 | Objetivo de contraste a 11px oscuro | **≥7:1**, no 4.5 | M3 apunta a 7:1 para `on-surface` |
| C5 | Separadores decorativos | **sin mínimo** | M3 `outline-variant` objetivo 1:1 |
| C6 | Bordes con significado / foco | **3:1** | SC 1.4.11 AA |
| S1 | Base de rejilla | **4px** (no 8) | 3 ficheros de tokens independientes |
| S2 | Paleta **cerrada** de espaciado | **{2, 4, 6, 8, 12, 16, 20, 24, 32}** | intersección exacta de los tres |
| S4 | No sobre-purificar | cuentan los **valores**, no la rejilla | Blender: 4 valores, uno de ellos 5px |
| H1 | Tamaño mínimo de control | **24×24** (AA, SC 2.5.8) | W3C normativo |
| H2 | El 44×44 es **AAA** | ignorar en escritorio | W3C normativo |
| H3 | **Regla para controles densos** | **≥24px de centro a centro** | excepción de espaciado de SC 2.5.8 |
| H4 | Altura de fila / control | **20–24px** | Blender: 20px, paso 22px, toda la app |
| H5 | Controles anclados al borde | **margen exterior 0** | Farris 2001 (empírico) + Tognazzini |
| V1 | Niveles por panel denso | **≤3 superficies + 1 borde** | M3, Spectrum |
| V3 | Orden de codificación | **espacio → peso → color → tamaño → borde** | el tamaño es el canal más débil <14px |
| A1 | Presupuesto de acentos | **2 tonos, escrito** | Ableton (Carl perdió la discusión por no escribirlo) |

---

## Fuentes

**Primarias legibles por máquina:** `@adobe/spectrum-tokens` `dist/json/variables.json` · `primer/primitives`
`typography.json5`, `size.json5` · `@atlaskit/tokens@15.8.0` · Blender `UI_interface_c.hh`, `wm_window.cc`,
`interface_style.cc`, `userdef_default_theme.c` · `material-color-utilities` `color_spec_2021.ts` ·
`material-components-android` `ElevationOverlayProvider.java` · `InterVariable.ttf` (tabla `fvar`) ·
nuestros `assets/fonts/*.woff2` (fontTools).

**Investigación revisada por pares:** Piepenbrock, Mayr & Buchner (2014), *Human Factors* 56(5) y *Ergonomics*
57(11) · Farris, Jones & Anders (2001), *Proc. HFES* 45(15) · Fitts (1954).

**Normativa:** W3C WCAG 2.2 SC 2.5.5, SC 2.5.8, SC 1.4.11 · APCA-W3 v0.1.9.

**Diseñadores explicando su razonamiento:** Eric Carl (Principal Designer, Ableton), *Ableton Live and Designing
for Authenticity* · Letters from Sweden (Ableton Sans) · Bitwig user guide + roundtable MusicRadar ·
Blender HIG (cualitativa) · Manual de referencia DaVinci Resolve 18.6 · Resolume support · Tognazzini (AskTog).

**No verificable / descartado:** "Material exige 15.8:1" (folclore) · cita de Larry Jordan sobre FCPX (es de un
comentarista) · foros de Ableton (403) · racionalización de las Pages de Resolve (no existe documento) ·
Premiere Workspaces (Adobe agotó el tiempo de espera) · números de la HIG de Blender (no tiene).
