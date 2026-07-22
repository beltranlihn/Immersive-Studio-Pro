# Auditoría de diseño — medición de NUESTRA UI (R102, parte 1 de 2)

> ⚠️ **CORREGIDO tras la parte 2.** Las mediciones de este documento son correctas; **dos de sus conclusiones
> eran falsas** y están rectificadas en línea abajo (§1 y §4). Leer `INVESTIGACION-DISENO-UI.md` §0.
> Se mantiene el texto original tachado a propósito: el error es parte del registro.

> Parte 1: **qué es medible hoy en nuestra UI**, sin opinión. Números extraídos del CSS (`index.html`), del JS que
> genera UI inline (`app.js`) y de la app viva por CDP (`scratchpad/audit-ui.js`).
> Parte 2 (pendiente): investigación de DAWs/NLEs con buena reputación de UX + sistemas de diseño publicados,
> para decidir **contra qué** corregir. Sin esa parte, los objetivos de abajo serían inventados.

## 1. La tipografía no tiene jerarquía

Renderizado en la app viva (nº de elementos con texto):

| tamaño | elementos |
|---|---|
| 9px  | 32 |
| 10px | 25 |
| 11px | 60 |
| 12px | 1 |
| 13px | 1 |

> ⚠️ **RECTIFICADO.** La conclusión de abajo ("no hay jerarquía → hay que crear una escala") **era falsa**.
> **Blender envía TODA su UI a 11pt/400** — un tamaño, un peso — y su jerarquía la llevan layout, agrupación y
> color. Atlassian envía cuerpo y encabezado **al mismo tamaño** (12px), separados solo por peso (400 vs 653).
> Una escala uniforme es un defecto **solo si ningún otro canal lleva la jerarquía**. Lo verdaderamente malo aquí
> es (a) **9px, que no lo envía ningún sistema publicado**, y (b) que no usamos el canal de **peso**, que ya
> tenemos empaquetado. La corrección no es añadir escalones: es **elegir pocos y quitar los accidentes**.

**117 de 119 elementos viven en 9/10/11px** — 2px de rango total. Un salto de 1px no es una jerarquía: es ruido.
12px y 13px se usan una vez cada uno, así que en la práctica no existen. Además hay 32 elementos a **9px**, que es
muy pequeño para leer sostenidamente sobre fondo oscuro.

En el código fuente hay más tamaños que en pantalla: `app.js` tiene inline `11.5px` (×7) y `12.5px` (×2). Un valor
fraccionario es la prueba de que no hay escala: se ajustó a ojo hasta que "cuadró".

Pesos: 500 (×60), 400 (×47), 600 (×11), 700 (×1). Cuatro pesos, uno de ellos usado una sola vez.
Familia: Geist, consistente (bien).

## 2. No hay rejilla de espaciado

Gaps medidos en vivo: **5, 6, 9, 7, 1, 4, 10, 14 px** → 8 valores, **7 fuera de cualquier rejilla de 4px**.
En el CSS hay 11 valores de `gap` distintos y paddings ad-hoc (`7px 9px`, `6px 9px`, `4px 8px`, `14px 16px`…).

Esto es lo que produce la sensación de "está casi bien pero no del todo": nada se alinea con nada porque no hay
un módulo común.

Radios: `2px` en 90 sitios — **esto sí es consistente**, se mantiene.

## 3. Los tokens son aspiracionales, no reales

- `app.js`: **78 colores hexadecimales cableados** frente a **4** usos de `var(--…)`.
- `index.html`: 40 hex literales conviviendo con los tokens.
- `#B4BAC1` se usa **23 veces** y no es un token. `#9EA5AD` ×11, `#7A828B` ×9, `#454C55` ×8 — tampoco.
- Bordes: 10 alfas de blanco casi idénticas (0.04 / 0.05 / 0.08 / 0.09 / 0.1 / 0.12 / 0.14 / 0.15 / 0.16 / 0.25).
  Nadie distingue 0.08 de 0.09: son tres niveles disfrazados de diez.

Tenemos el coste de un sistema de diseño sin su beneficio: existe la definición, pero la UI real no la usa.

## 4. La escalera de fondos es imperceptible ~~(FALSO)~~

> 🔴 **REFUTADO — medí bien y concluí mal: usé la regla equivocada.**
> Adobe Spectrum envía sus superficies contiguas a **1.08–1.19** de contraste. Google Material M2, a **1.03–1.12**.
> Nosotros: **1.03–1.11**. **Estamos dentro de especificación.** Pasando APCA por *todos* los pares contiguos de
> Spectrum y Material, la métrica devuelve **Lc 0.0 en todos** — ninguna métrica de contraste separa superficies
> contiguas oscuras, porque **WCAG lleva una constante de velo `+0.05`** que aplasta el extremo oscuro, y porque
> ambas métricas modelan **detalle de glifo**, no bordes de campo amplio. La regla correcta es **CIE L\***:
> Spectrum envía ΔL\* 2.78–4.88; M3, Δ 2–5. Lo nuestro equivale a ~2–4 L\*: algo justo, no roto.
> **El defecto real es tener SEIS superficies simultáneas** (M3 define 5 roles y no los usa todos adyacentes).
> → bajar a **3** y ensanchar el paso a **4–5 L\***. Detalle en `INVESTIGACION-DISENO-UI.md` §0.

*(Texto original, conservado como registro del error:)*

Luminancia relativa y contraste entre pasos contiguos:

| token | hex | L | contraste vs anterior |
|---|---|---|---|
| bg-0 | #0A0B0D | 0.0033 | — |
| bg-1 | #0E0F11 | 0.0048 | **1.03** |
| bg-2 | #16181B | 0.0090 | 1.08 |
| surface | #1C1F23 | 0.0135 | 1.08 |
| surface-2 | #24272C | 0.0201 | 1.10 |
| surface-3 | #2B2F35 | 0.0280 | 1.11 |

Seis superficies cuyos pasos contiguos van de **1.03 a 1.11** de contraste. `bg-0` y `bg-1` son literalmente
indistinguibles. Pagamos la complejidad de seis niveles de elevación y percibimos quizá tres.

## 5. Contraste de texto: bien en los tokens, mal fuera de ellos ~~(era peor de lo que creía)~~

> 🔴 **AGRAVADO.** Abajo me tranquilicé porque los tokens pasan AA. **El número que me tranquilizó estaba
> mintiendo.** `#8A8A8A` pasa WCAG AA sobre oscuro (4.99:1) y APCA lo puntúa **Lc −38** — territorio "aviso de
> copyright". Nuestro `--ink-faint` es **`#8A9199`**: exactamente esa clase de gris. WCAG 2.x es una regla rota
> en el extremo oscuro (por eso APCA es candidata a WCAG 3), y APCA **no bendice texto de cuerpo por debajo de
> 14px/400 a ningún contraste**. M3 apunta a **7:1 (AAA)** para texto primario en oscuro, no a 4.5.
> → texto secundario a **#AFAFAF–#C4C4C4**; objetivo **≥7:1**, no 4.5.

Los tokens pasan AA con holgura (de 4.22 a 15.91 según fondo) — herencia de la tanda WCAG de R94.
Los grises **no tokenizados** son los que fallan:

- `#7A828B` → 3.85 sobre surface-2, **3.46** sobre surface-3 (AA de texto pide 4.5)
- `#6A7079` → **2.70** sobre surface-3 (por debajo incluso del 3.0 de UI)

Es decir: el problema de contraste que creíamos resuelto sigue vivo justo en los colores que se escaparon del sistema.

## 6. Controles

- 100 botones visibles, **5 alturas distintas**: 16, 18, 21, 22, 24. (Los 37 "tamaños" distintos son sobre todo
  anchos que siguen a la etiqueta — eso es normal; las **alturas** son la señal real.) El 21px es un accidente.
- Ningún botón baja de 16px de lado menor: no hay dianas imposibles.
- Tamaños dominantes: 16×16 (×33) y 22×22 (×18).

## 7. Geometría de la línea de tiempo

- Fila de pista: **82px** — alto comparado con lo habitual en un NLE.
- Ancho de cabecera de pista: 151px.
- Regla: 22px.

*(Si 82px es correcto o no depende de contra qué se compare — eso es exactamente lo que debe decidir la parte 2.)*

---

## Resumen: cinco problemas reales y medidos

1. **Jerarquía tipográfica plana** — todo vive en 9/10/11px; 32 elementos a 9px.
2. **Sin rejilla de espaciado** — 8 gaps en vivo, 7 fuera de rejilla; paddings a ojo.
3. **Tokens no adoptados** — 78 hex cableados en `app.js`; `#B4BAC1` ×23 sin token.
4. **Elevación invisible** — 6 fondos con pasos de 1.03–1.11 de contraste.
5. **Los grises fuera del sistema fallan AA** — #7A828B y #6A7079.

Bien: radio 2px consistente, una sola familia, contraste correcto en los tokens, sin dianas <16px.

**Nada de esto se arregla "a ojo".** Lo que falta para decidir los valores objetivo (¿qué escala tipográfica?
¿qué altura de fila? ¿cuántas superficies?) es la parte 2: qué hacen y por qué los programas con buena
reputación de UX. Sin esa evidencia, cambiar 9px por 12px sería sustituir un capricho por otro.
