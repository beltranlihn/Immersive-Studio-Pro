# Handoff: Immersive Studio Pro — Launcher + Format Editors

## Overview
Immersive Studio Pro is a timeline-based compositing tool for immersive content: **fulldome** (fisheye), **360 room** (multi-wall/equirect), and **2D flat** canvases. This bundle contains the redesigned UI: a **Launcher** (project picker) and three **format editors** that share one editor shell with format-specific tools.

## About the Design Files
The `.dc.html` files in this bundle are **design references authored in HTML** (a prototype runtime — they paint from inline styles + a small logic class). They are **not production code to ship**. The task is to **recreate these designs in the target codebase's environment** (React/Vue/Electron/etc.) using its established patterns and component libraries. If no environment exists yet, pick the most appropriate stack and implement there. `support.js` is only the prototype runtime — do not port it.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, and interactions are all intentional and specified below. Recreate pixel-for-pixel using the codebase's libraries. Exact hex/px values are in **Design Tokens**.

---

## Screens / Views

### 1. Launcher (`Launcher - Rev 1.dc.html`)
- **Purpose:** first view on app open — pick a project type, set its properties with a live canvas preview, or reopen a recent project.
- **Layout (max-width 940px, centered):**
  - Top bar (38px): software logo (15px) + "Immersive Studio Pro" + `v1.0` + "Open project" button (right).
  - Hero (padding 34px top): software logo (42px) + `<h1>` 23px + tagline 11.5px muted.
  - Two-column row: **left 380px** create panel; **right flex** preview stage.
    - Create panel: uppercase "NEW PROJECT" label (10px, letter-spacing .14em) → segmented type tabs (Dome / 2D / 360 Room, well with 3px pad) → one-line description → property rows → footer with Output summary + primary "Create <type>" button (ivory `#EDEDED`, dark text).
    - Preview stage: bordered radial-gradient panel (min-height 270px) rendering a live SVG of the chosen canvas (dome disc + coverage ring / flat rect at true aspect / room top-down plan with colored walls + floor), with a label + caption bottom-left.
  - Recents (secondary, below a hairline): uppercase "RECENT" + horizontal scroll row of compact cards (198px: 34×22 thumb + name 11px + meta/때 9.5px).
  - Footer (42px, hairline top): Alma Digital logo (17px) + "Created by Alma Digital Studio · 2026" + "All rights reserved" (right).
- **Property rows per type:**
  - **Dome:** Resolution (2048/3072/4096/6144/8192 px²), Coverage (180/200/210/220°), Frame rate (24/25/30/48/50/60).
  - **2D:** Preset (1080p / 4K / 9:16 / 1:1 / Custom), Frame rate.
  - **360 Room:** Walls (2/3/4), Floor (toggle switch), Frame rate.
- The preview + Output summary update live from these values. "Create" links to the matching editor file.

### 2. Dome editor (`Editor Domo - Rev 1.dc.html`)
Full editor shell. Regions: top bar (44px) → mid row [Media panel · Viewport · Inspector] → Transport (28px) → Timeline. Viewport toggle **2D / 3D**; viewport shows a **fisheye disc** with az/el grid. Transform params **Azimuth · Elevation · Size · Rotation · Opacity**.

### 3. 360 editor (`Editor 360 - Rev 1.dc.html`)
Same shell; viewport toggle **Canvas / 3D** (3D = isometric-cube icon). Viewport shows an **equirectangular 2:1 strip** (lat/long grid, horizon, ZENITH/NADIR, ±180°). Transform params **Yaw · Pitch · Size · Rotation · Opacity**. Projection defaults to Equirect.

### 4. 2D flat editor (`Editor 2D Flat - Rev 1.dc.html`)
Same shell; single **Canvas** viewport mode (no 3D). Viewport shows a **16:9 rectangle** with thirds + center guides. Transform params **X · Y · Scale · Rotation · Opacity**.

---

## Shared editor shell (applies to all 3 editors)
- **Bars:** every horizontal bar is **28px**; controls inside are **22px** (rule: 28 = 22 + 3px air each side); inner pills **16–18px**.
- **Media panel:** header (view List/Grid toggle + collapse) · filter row (All/Video/Image/Audio well + Sort dropdown) · Create row (Import primary + Text/Shape/Compose/Adjust) · list or grid of media with folders; functional type filter + sort.
- **Viewport bar:** view-mode toggle, overlay toggles (Grid/Outline/Horizon/Alpha — icon-only, collapse by priority into a "…" overflow at narrow widths), quality (Full/½/¼), Proxy, zoom, Output dropdown.
- **Inspector:** tabs **Inspector / Reactive FX** (well toggle) + full-height + collapse buttons (same 18×16 icon frame). Collapsible sections with chevron + hairline (Title case, 11px/600): **Transform, Clip, Source, Playback, Color, Motion**. Reactive FX tab: Audio Engine (Source dropdown, spectrum, Gain/Gate/Attack/Release) + Effects Chain cards (per-parameter colors).
  - **Source:** Projection dropdown, Mirror toggle, Fisheye toggle + Amount, Tilt (equirect only).
  - **Playback:** Loop toggle, Reverse/Ping-pong (when looping), Speed.
  - **Motion:** preset chips (Spin/Orbit/Bob/Scroll/Sway/Pulse/Wobble/Flicker) that add motion cards (name+param, Loop/Wave dropdown, Speed, remove).
  - **Parameter color system:** each param has a fixed hue (Azimuth `#E0954B`, Elevation `#D8C24B`, Size `#E0645C`, Rotation `#C58BD0`, Opacity `#7FB2E8`, Exposure `#E8C84B`, Saturation `#D06FB0`) used on its fader fill, keyframe diamond AND the matching timeline automation curve.
  - Color grading: Lift/Gamma/Gain wheels with draggable handle (clamped to radius), LUT, curves.
- **Timeline:** ruler + track headers (168px) + lanes + custom thin scroll rails (header & lanes scroll synced). Tracks (video + audio unified) are **drag-reorderable** (animated FLIP) and **resizable from the bottom edge** (only affects that track; list scrolls, never clips). Alt+scroll scales all track heights incl. audio. Clips: normal view = fixed-left thumbnail + title bar + fade squares (top corners); automation view = colored envelope + keyframe diamonds (waveform for audio). Transport: **Simple / Automation / Grid / Fit** (Fit zooms both vertical rows and horizontal content). "Proxy" clip label only shows when the Proxy toggle is on.
- **Unified menu component:** ONE dropdown/context-menu style used everywhere (surface `#1B1B1B`, .5px border, radius 2px, shadow `0 12px 34px rgba(0,0,0,.55)`, items 26px/11px with optional icon + shortcut, `danger` red, closes on outside click). Used for: Output, Source, automation type/param, Media sort, and right-click on clips / track headers / media items / keyframes / timeline. Shortcuts show **Ctrl+key** (Windows).

## Interactions & Behavior
- Toggle switches: 26×15 track, 11px knob, green `#4A8D6F` when on, slides `.12s`.
- Segmented controls: active pill filled (`#4A4A4A` in editors; `#EDEDED` on the launcher), inactive transparent muted.
- Section chevrons rotate 0° open / −90° closed.
- Track reorder: FLIP transform `.2s cubic-bezier(.2,.7,.3,1)`; dragged row elevated with shadow.
- Right-click opens the unified menu at the cursor; left-click dropdowns open below the trigger.
- Launcher "Create" and recents are `<a href>` to the editor files (swap for real routes).

## State Management
- Launcher: `ptype`, `domeRes`, `domeCov`, `roomWalls`, `roomFloor`, `flatPreset`, `fps` → drive preview + Output + Create target.
- Editors: `view` (2d/3d), `tool`, display toggles, `proxy`, `curves` (automation view), `tlGrid`, `trackH{}`, `trackOrder[]`, `audioH`, `tlZoom`, `dragId`, per-track `cat`/`armed` (automation param), `clipSrc{}` (projection/mirror/fisheye/loop), `motions[]`, `secs{}` (open sections), `menu` (open menu descriptor), `mediaFilter`/`mediaSort`, panel widths.

## Design Tokens
- **Backgrounds:** app `#0A0B0C`→`#111` (launcher gradient), panels `#141517`/`#16171A`/`#1B1B1B`, controls `#262626`, control-active `#4A4A4A`, wells `#0A0B0C`/`#111111`.
- **Text:** primary `#E0E0E0`/`#F0F0F0`, secondary `#B8B8B8`, muted `#8C8C8C`, faint `#6D6D6D`/`#5A5A5A`.
- **Lines:** `rgba(255,255,255,0.05–0.14)`; dark seams `rgba(0,0,0,0.4)`.
- **Accents:** primary button ivory `#EDEDED` (launcher) / grey `#4A4A4A` (editors); toggle-on `#4A8D6F`; danger `#E06C6C`; audio/reactive blue `#7FB2E8`; room walls Front `#5AA9E6` / Right `#6FCF97` / Back `#E6A15A` / Left `#C98BE0`.
- **Type:** Geist 400/500/600. Sizes: 9.5–13px UI, `<h1>` 23px; timecode/tabular use `font-variant-numeric:tabular-nums`. Section labels 10–11px, uppercase labels letter-spacing .10–.14em.
- **Radius:** 2px (menus/wells) · 3px (controls) · 4–6px (cards/panels). **Spacing:** gaps 2/4/6/8/12; bar padding 8px; inspector rows 12px.
- **Shadow:** menu `0 12px 34px rgba(0,0,0,.55)`.

## Assets
- `assets/immersive-logo.png` — Immersive Studio Pro logo (white, transparent).
- `assets/alma-logo.png` — Alma Digital Studio logo (white, transparent).
- `assets/fonts/geist-400|500|600.woff2` — Geist font. Substitute the app's own font if licensing differs, keeping the weights/scale.

## Files
- `Launcher - Rev 1.dc.html` — launcher / project picker.
- `Editor Domo - Rev 1.dc.html` — dome (fisheye) editor.
- `Editor 360 - Rev 1.dc.html` — 360 room editor.
- `Editor 2D Flat - Rev 1.dc.html` — 2D flat editor.
- `support.js` — prototype runtime only (reference; do not port).
- Open any `.dc.html` directly in a browser to see the intended result.
