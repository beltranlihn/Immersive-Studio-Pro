# Architecture Decision Records (ADR)

> Registro de decisiones de arquitectura. **Un archivo por decisión, inmutable.** Si una decisión cambia, se escribe una
> ADR nueva que **supersede** a la vieja (y se marca el estado de la vieja como `Superseded by ADR-NNNN`). No se editan las
> aceptadas ni se borran las equivocadas — se dejan como historia. Formato: Nygard (Contexto · Decisión · Estado · Consecuencias).

| # | Decisión | Estado |
|---|---|---|
| [0001](adr-0001-sin-build-step.md) | Sin build step (`<script>` directo) | Accepted |
| [0002](adr-0002-sin-ffmpeg-codecs.md) | Sin FFmpeg en runtime → códecs de Chromium + fallback 4K | Accepted |
| [0003](adr-0003-proxies-manuales.md) | Proxies manuales (no automáticos) | Accepted |
| [0004](adr-0004-handedness.md) | Una sola inversión de handedness (`u_flipx=-1`) | Accepted |
| [0005](adr-0005-formato-isp.md) | Formato de proyecto `.isp` (JSON) | Accepted |
| [0006](adr-0006-automatizacion-after-effects.md) | Modelo de automatización After Effects | Accepted |
| [0007](adr-0007-archivar-no-borrar.md) | Código deprecado se archiva, no se borra | Accepted |

**Cuándo escribir una ADR:** cuando una decisión sea **importante, cara o riesgosa de revertir**. No para cada cambio —
para las que un desarrollador (o Claude) futuro necesitaría entender el *porqué*.
