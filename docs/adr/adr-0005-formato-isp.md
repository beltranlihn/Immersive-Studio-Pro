# ADR-0005: Formato de proyecto `.isp` (JSON)

- **Estado:** Accepted
- **Fecha:** 2026-07-22
- **Deciden:** Beltrán, Claude

## Contexto
El software se renombró de "Dome Studio Pro" a "Immersive Studio Pro". El proyecto necesita una extensión propia,
legible y versionable, y compatibilidad con proyectos legacy.

## Decisión
La extensión de proyecto es **`.isp`** (guarda `.isp`; abre `.isp` + legacy `.ise`/`.rdome`). El contenido es **JSON**
(`serProject`/`serMedia`/`serClip`, v4). La asociación de doble-clic la registra el instalador NSIS (no el asar) → solo
se actualiza reinstalando. `appId`: `com.almadigitalstudio.immersivestudiopro`.

## Consecuencias
- (+) JSON = inspeccionable, diffeable, fácil de migrar entre versiones.
- (+) Retro-compatibilidad con `.ise`/`.rdome`.
- (−) Los proyectos con muchas máscaras dataURL pesan (base64 inline).
- (−) La asociación `.isp` depende del instalador → cambiarla requiere reinstalar, no solo copiar el asar.

## Notas
El save es atómico (`.isp` + `.bak`); hay autosave/recovery y lista de recientes (`getRecents`/`addRecent`).
