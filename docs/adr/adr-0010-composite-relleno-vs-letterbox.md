# ADR-0010: El composite máster es de RELLENO; el export, NDI, Spout y el caché de nests siguen en cuadrado con letterbox

- **Estado:** Accepted
- **Fecha:** 2026-08-04
- **Deciden:** Beltrán (director creativo), Claude
- **Ronda:** R237 (ver `PLAN.md` › ROUND 237)

## Contexto

El composite máster —la textura a la que se compone todo antes de mandarla al visor 2D, a la malla del domo o a
los muros de la sala— fue **cuadrado** desde el primer día. La colocación de los clips vive en un NDC cuadrado con
el lienzo encajado en una banda de semiejes `Fx=min(1,A)`, `Fy=min(1,1/A)`, así que un lienzo apaisado dejaba dos
franjas vacías arriba y abajo.

R236 arregló la mitad del problema que reportó Beltrán en producción («un clip sin proxy en Full se ve muy
pixelado»): el lado del cuadrado pasó de estar clavado en 2048 a valer `max(w,h)`. Pero el cuadrado se quedó, con
dos costes. El obvio: una tira de 7196×912 reservaba 198 MB para usar 26. El que de verdad importaba: con el tope
de **8192 por lado**, una sala de cuatro muros 4K —15360×2160— **no podía llegar a 1:1**; se quedaba a 1,875× de
submuestreo. El caso grande, el de una instalación de verdad, seguía sin resolverse.

Cambiar la forma del máster no es gratis, y por eso hubo que decidir en vez de simplemente hacerlo: **hay cuatro
consumidores que dan por hecha la forma cuadrada con letterbox** — el export por-muro, el caché horneado de nests
(`_ncSquare`, ADR de R180: la salida tiene que quedar EXACTAMENTE como la textura que produce `prepNests`, o un
nest 16:9 se encuadra distinto con el caché puesto que sin él), NDI y Spout.

## Decisión

**El máster pasa a relleno y los demás no.** Conviven dos convenciones, a propósito:

1. **Relleno** — sólo el máster de previsualización. La textura es `compW×compH`, con la forma del lienzo, y el
   contenido la llena entera: `u,v = 0..1` sobre el lienzo. Se consigue **expandiendo el viewport**
   (`compFillVp()`: `vw=compW/Fx`, `vx=-(vw-compW)/2`, ídem en Y), **sin tocar la matemática de colocación**: los
   clips se siguen dibujando en el NDC de siempre, dentro de la banda `±Fx/±Fy`. UV por `mstrU`/`mstrV`, límites
   de muestreo por `mstrContentLim`/`mstrLimForRect`.
2. **Cuadrado con letterbox** — export, caché de nests, NDI y Spout. `composite(t,size,opaque)` sin el cuarto
   argumento `fill`. Límites por `compContentLim`/`compLimForRect`.

Reglas que acompañan a la decisión:

- **Las dos parejas de límites NO se mezclan.** Un `compContentLim()` en el camino del máster (o al revés) da un
  error silencioso: contenido repetido en el borde o una franja negra. Son las dos caras de la misma fisura que
  costaron R233 y R233b.
- **El tope del máster se mide en MEMORIA, no en lado** (`COMP_MAXTEXELS = 8192²`, los mismos 268 MB que R236 ya
  aceptaba). Sin este cambio, el no-cuadrado no habría servido de nada para el caso que motivó la ronda.
- **El mapeo píxel-de-lienzo → uv se deriva de los enteros REALES del viewport**, no del atajo `px/W`. El viewport
  es entero (GLint) y `compH/Fy` no cae redondo; dar por hecho el relleno exacto dejaba hasta medio texel suelto
  en el borde.
- **Nada puede suponer que el viewport es un cuadrado anclado en el origen.** Los rects de tijera pasan por
  `_ndcToVp()`, que lee también `vp[0]`/`vp[1]`.
- **El máster se sincroniza en cada `render()`** (`syncCompSize()`, no-op si ya coincide), no sólo en `resize()`.

## Consecuencias

- (+) La sala de 7196×912 llega a 1:1 con 25 MB (antes 198). La de cuatro muros 4K, 15360×2160, llega a 1:1 con
  127 MB — antes era imposible a cualquier precio.
- (+) **El domo queda intacto por construcción, no por cuidado.** Con un lienzo cuadrado `Fx=Fy=1`, el viewport de
  relleno ES el cuadrado y las dos convenciones coinciden exactamente. No hay una rama del domo que mantener.
- (+) La colocación de clips, el warp, el wrap de costura y el recorte por superficie **no se enteran del cambio**:
  lo único que se movió es el viewport.
- (−) **Dos convenciones que hay que tener en la cabeza.** Es la deuda real de esta decisión. Mitigada con nombres
  distintos (`mstr*` vs `comp*`), comentarios en los dos sitios y la ficha de `COMPONENTS.md`.
- (−) Cualquier consumidor NUEVO del máster tiene que elegir convención explícitamente. Si un día NDI o Spout
  quieren salir con la forma del lienzo, es un cambio deliberado, no un efecto secundario.
- (−) El caché de scrub-ahead ya no puede reusar sus texturas cuando cambia la forma del máster: `setCompSize`
  llama a `raSyncDims()`, que TIRA el caché entero. Con el caché apagado por defecto (`_raOn=false`) el coste real
  es cero, pero es un tirón completo, no una invalidación barata de generación.
- (−) La capa de ajuste necesita un tope propio (`ADJ_MAX=8192`): su cadena de FX corre en un cuadrado del lado
  mayor del destino, y sin tope la sala 4K pedía 2,8 GB entre instantánea y RT. La cadena se queda **cuadrada y
  con letterbox** a propósito, para que un desenfoque siga siendo isótropo sobre el lienzo.

## Alternativas descartadas

- **Pasar todo a relleno, incluido el export.** Rompe el contrato de R180 para el caché de nests y obliga a tocar
  el export por-muro, que hoy está verificado al píxel. Beneficio nulo: el export ya usa su propio FBO a
  resolución de salida.
- **Escalar el NDC en los shaders en vez de expandir el viewport.** Matemáticamente más limpio, pero toca todos
  los programas de dibujo de clips (`PW`, `PFD`, `PEQ`, …). El viewport lo resuelve en un sitio.
- **Dejarlo cuadrado y subir el tope.** Un cuadrado de 15360² son 943 MB. No es una opción.

## Confirmación

Verificado por CDP en dev (`scratchpad/r237-fill.mjs`, `r237-verify2.mjs`, `r237-verify3.mjs`, `r237-verify4.mjs`;
`__errs` vacío en las cuatro): submuestreo 1,00 en los dos ejes en las dos salas · relleno exacto con desviación
**0 texels** (peor caso, ¼ de calidad en 1799×228: medio texel) · domo 4096² y 2D 1920×1080 con viewport identidad
· **export por-muro: los cuatro muros por separado reconstruyen la tira entera con difMax 0** · caché de nest con
su letterbox (`uvlim = 0,0,1,1`) · sala 3D con el borde alto en `v=1,000000` sin recortar · capa de ajuste con la
misma cobertura al píxel · caché de scrub-ahead a la proporción del máster.
