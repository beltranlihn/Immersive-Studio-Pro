# ADR-0003: Proxies manuales (no automáticos)

- **Estado:** Accepted
- **Fecha:** 2026-07-22
- **Deciden:** Beltrán, Claude

## Contexto
Los proxies antes se generaban automáticamente al importar. Con clips pesados esto disparaba builds en momentos no
elegidos, competía por GPU/CPU con la edición, y un proxy corrupto/huérfano (generación cortada) caía al original HEVC
10-bit en silencio (ver memoria `proxy-corrupt-r107`).

## Decisión
Los proxies se generan **manualmente**: clic-derecho sobre el media → "Generar proxy" (multi-selección con Shift). La
escritura es atómica (`.part` + `DSP.rename`) y hay auto-sanado (`attachExistingProxy`: escaneo por basename, valida
duración, borra corruptos con aviso, y asocia un proxy ya existente sin regenerar → cubre [C3]).

## Consecuencias
- (+) El usuario controla cuándo se paga el costo del proxy.
- (+) Escritura atómica + auto-sanado evitan el fallo silencioso anterior.
- (−) El usuario debe acordarse de generar proxies para material pesado.

## Confirmación
Archivo de prueba `Rito360.isp`; diagnóstico con ffprobe (original vs proxy), comparar hash `path|fsize`.
