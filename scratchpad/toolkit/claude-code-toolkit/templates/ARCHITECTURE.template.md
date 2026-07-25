# ARCHITECTURE — <TU PROYECTO>

> **Tipo (Diátaxis): Explicación.** Cuenta *cómo* y *por qué* funciona. El índice austero de "dónde vive cada cosa" está
> en [COMPONENTS.md](COMPONENTS.md); las decisiones en [docs/adr/](docs/adr/). Estructura: **C4** (zoom) + **arc42** (secciones).
> Verificado contra el código: <AAAA-MM-DD>.

## 1 · Propósito y metas de calidad (arc42 §1)
<Qué es el software, para quién, y las 3-5 metas de calidad prioritarias (p. ej. performance, estabilidad, fidelidad).>

## 2 · Restricciones (arc42 §2)
<Limitaciones técnicas/organizativas que moldean todo: sin build step, sin tal dependencia, tal plataforma, etc.>

## 3 · Contexto del sistema (C4 L1 / arc42 §3)
<El software como una caja + usuarios + sistemas externos con los que habla (filesystem, APIs, dispositivos, servicios).>

## 4 · Contenedores (C4 L2 / arc42 §5)
| Contenedor | Archivo/proceso | Responsabilidad |
|---|---|---|
| <p. ej. frontend / backend / worker / CLI> | <archivo> | <qué hace> |

## 5 · Componentes (C4 L3)
Ver [COMPONENTS.md](COMPONENTS.md) para el inventario autoritativo. Mapa de subsistemas:
<lista corta de los 5-10 subsistemas y una frase cada uno.>

## 6 · Flujos de runtime clave (arc42 §6 / C4 dinámico)
<Los 2-4 caminos que importan, paso a paso. P. ej. "una petición", "un render de frame", "un export". Este es el corazón.>

## 7 · Conceptos transversales (arc42 §8)
<Patrones/reglas que cruzan todo el sistema: manejo de estado, convenciones, i18n, seguridad, error handling.>

## 8 · Decisiones (arc42 §9)
Registradas en [docs/adr/](docs/adr/). Las grandes: <listalas con su número de ADR>.

## 9 · Riesgos y deuda técnica (arc42 §11)
<Lo frágil, lo monolítico, lo que hay que vigilar. Detalle completo en COMPONENTS.md → "Deuda técnica & gaps".>

## 10 · Glosario (arc42 §12)
- **<término del dominio>** — <definición corta>.
