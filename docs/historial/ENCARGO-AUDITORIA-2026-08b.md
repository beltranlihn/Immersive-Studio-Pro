# Encargo · Auditoría 2026-08b — el delta R242 → R252b y la COMPATIBILIDAD con el trabajo en curso

> Para el auditor (Fable). Autocontenido: no hace falta el hilo de chat previo.
> **Desconfía de este encargo.** Lo escribe el mismo que ha escrito el código que vas a mirar (Opus), así que
> hereda sus puntos ciegos. Si crees que el alcance está mal planteado, dilo en el informe y audita lo que haga
> falta.

## 0 · La pregunta que manda

Beltrán **está editando ahora mismo una película fulldome importante**. En las últimas horas se han desplegado
once rondas de cambios sobre su instalación. La pregunta central no es «¿está bien el código nuevo?», sino:

> **Si actualiza el software y abre el proyecto que ya tenía a medias, ¿se le rompe algo?**
> Y donde el comportamiento nuevo sea distinto del viejo, **¿cómo se readapta su proyecto sin perder trabajo?**

Todo lo demás es secundario. Un fallo bonito en una función nueva importa menos que un proyecto suyo que se abre
mal.

**Permiso explícito que dio Beltrán:** en los clips loopeados *«no me interesa mucho dónde partan»*. Un cambio
visual pequeño en el punto de arranque de un bucle es aceptable. Perder el bucle, la duración o el montaje, no.

## 1 · Qué se ha desplegado (el delta a auditar)

Once rondas, todas ya compiladas y desplegadas a las tres instalaciones. `git log a33c70b..HEAD`:

| Ronda | Qué cambió | Riesgo declarado sobre proyectos existentes |
|---|---|---|
| R247c/d | Compose **Tejido** rehecho sobre plano 1:1 + entrelazado (`u_weave`) | Bajo: el tejido nunca se desplegó antes, no hay proyectos con él. Hay migración en `regenComposeNest` (`m.mode='flat'`) |
| R248 | El compose enseña una **cesta** de sus medios en vez de un catálogo con casillas | **`_pick` ES `g.mediaIds`.** Se verificó «ni un píxel cambia» al reaplicar. **Re-verificar sobre un proyecto REAL suyo** |
| R249 | **Monitor de origen** (doble clic en un medio). Marcas `srcIn`/`srcOut` en el MEDIO, nuevas en `serMedia` | El doble clic **ya no suelta el clip en la línea de tiempo**: cambio de gesto. `addClip`/`startMediaDrag` tienen parámetro nuevo |
| R250 | El **tramo del bucle** se ve y se edita (`setLoopRange`, filas nuevas) | Se declara PURAMENTE ADITIVO: no toca `srcT` ni `_applyLoopToggle`. **Verificarlo, no creerlo** |
| R251 | Copiar/pegar **varios clips**; una composición **ya no estrena pista** | El portapapeles cambió de forma (no se serializa). La colocación sólo afecta a composiciones NUEVAS |
| R252/b | Motion **Flotar** (acorde de 3) + **intensidad** de acorde. Arreglado: los presets se buscaban en el juego de domo primero | El arreglo del preset cambia lo que estampa el chip **Pulsar en secuencias 2D** (antes `size`, ahora `scale`) |

Antes de esto ya estaban desplegadas R242–R246 (auditoría de agosto ejecutada, scrub al fotograma clave,
contenedor del timeline, panel de medios, túnel). No hace falta reauditarlas salvo que el delta las haya tocado.

## 2 · Los tres riesgos que Beltrán nombró (empezar por aquí)

### 2.1 · El arreglo del preset `pulse`
Antes, `addAnimPreset` buscaba en `ANIM_PRESETS.concat(ANIM_PRESETS_FLAT)` → siempre el juego de **domo**
primero. `pulse` existe en los dos con parámetro distinto (`size` en domo, `scale` en plano), así que **en una
secuencia 2D el chip Pulsar creaba un modificador sobre `size`, que el camino plano ni lee**: no hacía nada.

Preguntas: ¿cuántos modificadores así hay en los proyectos de Beltrán? ¿Se quedan inertes (no rompen nada pero
tampoco hacen nada) o conviene **migrarlos a `scale`**? Ojo: migrarlos haría aparecer un movimiento que él nunca
vio — puede ser peor que dejarlos. **Recomendar con argumento, no elegir por defecto.**

### 2.2 · Los bucles
`RitoDome.isp` tiene **44 clips, 32 con `loop`**, 6 nidos y 5 composes. Beltrán además loopea composes enteros, de
modo que los clips de dentro repiten por el bucle del nido.

Verificar que **abrir ese proyecto con el build nuevo deja los 32 bucles idénticos**: mismo `loopLen`, mismo
`inP`, misma duración, mismo fotograma en un instante dado. Y que la fila nueva del inspector no altera nada por
el mero hecho de renderizarse.

Atención especial a `_applyLoopToggle`, que al APAGAR un bucle **recorta el clip** a lo que quede de fuente. Si
algún camino nuevo lo llama sin querer, se le encoge el montaje.

### 2.3 · Composes
- Los suyos son de tipos previos (anillo, cuadrícula…), no tejido. Abrir, mirar en el inspector, **Aplicar sin
  tocar nada** y comparar el render píxel a píxel — el método está en `scratchpad/r248-pixeles.mjs`.
- La colocación nueva (R251) sólo actúa al CREAR. Confirmar que no reordena ni mueve nada existente.

## 3 · Método

- **Sobre el `.exe` desplegado**, no en dev: `C:\Users\beltr\AppData\Local\Programs\Immersive Studio Pro\`.
  Lanzarlo con `--remote-debugging-port=9222` y pilotar por CDP (`Runtime.evaluate`). Patrón: cualquier
  `scratchpad/r2*.mjs`.
- **Confirmar la GPU** (`WEBGL_debug_renderer_info` debe decir RTX 4060) y **matar TODAS las instancias** antes de
  lanzar: el bloqueo de instancia única re-enfoca la ventana vieja y te sirve código viejo en silencio. Esa trampa
  ya produjo un falso hallazgo en esta sesión.
- **Probar como usuario**, no sólo como API: eventos de ratón reales (`Input.dispatchMouseEvent`) donde el gesto
  importe (arrastres, dobles clics, deslizadores). Un `.click()` no ejercita el mismo camino.
- **Fixtures «proyecto viejo» — esto es lo más importante del método.** El proyecto de verdad de Beltrán está en
  OTRO ordenador; lo que hay en este escritorio son versiones de trabajo suyas, y él ha autorizado usarlas a
  discreción (ver §4). Pero seguramente **no contienen todos los casos de riesgo**. Su instrucción textual:
  *«si esos proyectos no tienen cosas para testear, simúlalos»*.

  Así que el fixture principal hay que **fabricarlo con el código VIEJO**:
  ```
  git worktree add ../isp-old a33c70b     # R246: lo último desplegado antes de esta tanda
  cd ../isp-old && npx electron . --remote-debugging-port=9223
  ```
  Con esa app vieja, construir y **guardar** uno o dos `.isp` que contengan a propósito TODOS los casos que la
  tanda toca — y sólo entonces abrirlos con el build nuevo y comparar. Es la única forma honesta de responder
  «actualizo y abro lo que tenía». Casos que el fixture debería llevar sí o sí:
  - clips con `loop` (varios `loopLen`, alguno con `loopRev`, alguno con `inP`≠0, alguno estirado más allá de la
    fuente) y **al menos un nido loopeado con clips loopeados dentro**;
  - composiciones de varios tipos, alguna con el orden de medios **distinto del orden del panel** (es el caso que
    R248 podría reordenar), alguna con retoques manuales por elemento (`_layBase`);
  - en una secuencia **2D**, clips con el motion `pulse` puesto con la app vieja (los que quedan sobre `size`);
  - clips con enlace A/V, clips con máscaras, keyframes y automatización;
  - un `.isp` guardado con la app vieja y otro **legacy de verdad** (`.ise`/`.rdome`), que ya hay ejemplos en
    `scratchpad/aud2608-legacy-*`.

### Las trampas del arnés (ya cobraron víctimas)
1. `performance.now()` tiene granularidad reducida: no midas tiempos cortos con una sola muestra.
2. `#exOv` abierto deja la app sorda a los atajos.
3. **Los acentos graves dentro de una plantilla la cierran.** Rompió `app.js` una vez y tres sondas en esta sesión.
4. `:focus-visible` sólo se activa con eventos de puntero reales.
5. **El visor arranca al 92 % de zoom**: medir un anillo en el borde del disco sin poner `state.view.zoom=1`
   devuelve ~60 % de negro que es el fondo del visor, no el render.
6. **Medir un semieje suelto de `flatPlace` engaña** cuando el clip lleva `rot` 90 (ahí `fy` apunta en
   horizontal): hay que componer la caja envolvente `|fx.y| + |fy.y|`.
7. **No midas el invariante que el propio código impone.** En R244 una sonda comparaba «suma de alturas» contra
   `clientHeight` —la igualdad que el reparto fabrica— y daba verde con el cálculo mal. Mide la propiedad del
   sistema (`scrollHeight === clientHeight`), no la que tú acabas de escribir.
8. **Un número imposible casi siempre es el arnés**, no el programa.

## 4 · Restricciones (inviolables)

- **Los proyectos de este ordenador se pueden tocar.** Textual de Beltrán: *«no me importa que toques los
  proyectos originales, porque en este computador no tengo nada definitivo; el proyecto real lo estoy trabajando
  en otro»*. Aun así, **trabaja sobre copias en `scratchpad/`** por higiene —un fixture que se ensucia a mitad de
  una tanda de pruebas te hace perder el hilo, no por miedo a romperle nada—, y **no borres** ninguno.
  Los que hay: `Rito Movie/Dome/RitoDome.isp` (44 clips, **32 con bucle**, 6 nidos, 5 composes — el más jugoso),
  `Rito Movie/360/Rito360.isp`, `Rito Movie/Flat/RitoFlat.isp`, `Studio/Reel 360/…/Reel360.isp`.
- **No borrar material** de `…\Alma Digital Studio\`. Se puede usar y regenerar proxys.
- Código retirado → `_backup/deprecated/` (ADR-0007), nunca borrado.
- **Sin flags agresivos de Chromium** (dejan el 3D negro en la GPU híbrida).
- **No tocar la inversión de handedness** del domo (ADR-0004).
- Castellano neutro en informe y comentarios (**sin voseo**); la UI del software, en inglés con `T('EN','ES')`.
- **AUDITA E INFORMA. NO ARREGLES.** El plan lo ejecuta Opus después. Si encuentras algo que se pueda romper con
  sólo mirarlo, dilo, no lo toques.

## 5 · Entregable

### 5.1 · `AUDITORIA-2026-08b.md` (raíz del repo)
Con, como mínimo:
- **Veredicto de compatibilidad**, arriba del todo y en una línea: ¿puede actualizar sin romper su película?
- Un hallazgo por bloque, cada uno con: qué falla · **cómo reproducirlo** (pasos o sonda) · **VERIFICADO o
  SOSPECHADO** (no los mezcles) · gravedad · qué proyectos afecta.
- Lo que **AGUANTA**, con la prueba que lo respalda. Un «no encontré nada» sin prueba no vale.
- Las sondas en `scratchpad/aud8b-*.mjs`, reejecutables.

### 5.2 · El plan, al final del informe
Acciones **numeradas, ordenadas y autocontenidas**, para que Opus las ejecute sin volver a deducir nada:
qué archivo, qué función, qué cambia, cómo se verifica que quedó bien, y qué riesgo tiene la propia acción.
Marca cuáles son **migraciones de datos** (tocan proyectos existentes) — ésas necesitan además: cómo detectar el
caso viejo, qué se hace con él, y por qué es seguro.

Si el veredicto es «no rompe nada», dilo claramente y que el plan sea corto. No hay premio por encontrar cosas.
