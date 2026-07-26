# Export panel — design handoff

**Component:** the floating Export sheet of Immersive Studio Pro, redesigned.
**Replaces:** `openExport()` in `app.js` (the `#exOv` overlay + `.modal` markup, ~line 5523).
**Fidelity:** high — every hex, px and label below is final. Recreate with the app's own DOM/CSS conventions; nothing here needs a new library.

## Files

- `Export Panel - Rev 1.dc.html` — the runnable design. Open it in a browser; press **Export** to watch the render simulation.
- `assets/fonts/geist-400|500|600.woff2` — Geist. Substitute the app's font if licensing differs, keeping weights and scale.
- `support.js` — only needed to run the HTML locally.

## What changed vs. the current dialog

1. It is a **floating sheet, centered on screen, draggable by its header** — not a full-screen overlay. Nothing behind it is dimmed to black; the editor stays legible (a `rgba(8,9,10,0.52)` scrim only).
2. A **render monitor**: a small low-resolution screen that shows the frame being written, live, while the export runs. This is the core addition.
3. Status is a first-class block (phase, %, frame counter, elapsed / remaining / written, real fps and MB/s) instead of a status-bar string.
4. Settings are a **two-column grid** of 22px rows instead of one tall stack.
5. **Pixel size** replaces the old Resolution select: `Match source` / `Preset` / `Custom` with typed W × H.
6. The queue list is **out of this revision** (the persistent `_exJobs` registry stays in the code; its UI comes back later).
7. Shortcut shown as **Ctrl+Shift+E** (Windows only — no macOS glyphs). No all-caps labels anywhere; only codec acronyms (PNG, HAP, HEVC, MOV) are uppercase.

## Geometry

Sheet **660px wide**, radius 6px, `#16171A`, border `.5px rgba(255,255,255,0.12)`, shadow `0 24px 64px rgba(0,0,0,0.62)` + `inset 0 2px 0 rgba(255,255,255,0.03)`. Centered with `display:grid;place-items:center` on a full-bleed layer; drag applies a `translate(dx,dy)` on top of that.

| Region | Height / padding | Notes |
|---|---|---|
| Header | 28px, padding `0 6px 0 8px`, bg `#1B1B1B`, hairline bottom | share icon 13px · title 11px/600 · state chip · `Ctrl+Shift+E` 10.5px `#5A5A5A` · ✕ 22×22. `cursor:grab`. |
| Monitor + status | padding `12px 12px 14px`, hairline bottom | two columns, gap 14px: monitor 296px, status flex. |
| Settings | padding 12px, grid `1fr 1fr`, column-gap 16px, row-gap 6px | rows 22px; Pixel size and Estimated span both columns. |
| Footer | 44px, padding `0 12px`, bg `#131417`, hairline top | destination path left; `Close` + primary right. |

All controls are **22px** tall; pills inside segmented wells are **16px** (2px well padding). Labels in each row are a fixed **66px** column, 10.5px/500 `#8C8C8C`.

## Render monitor (the new part)

- Label row: "Render monitor" 10.5px/600 `#8C8C8C`.
- Well: `#0A0B0C`, `.5px rgba(255,255,255,0.1)`, radius 3px, padding 5px.
- Screen: **fixed 16:9** box, `background:#000`, `overflow:hidden`, radius 2px. The canvas fills it with `image-rendering:pixelated`.
- Buffer: **160 × 90 px** at scale 1 (that IS the resolution — it is meant to look coarse). The tweak `monitorScale` multiplies it (0.5–2.5).
- **The exported canvas is letterboxed inside that 16:9 box**, so all three formats share one monitor:
  - dome → 1:1, drawn 90×90 centered, black bars left/right;
  - 2D → 16:9, fills the box;
  - 360 room → 4:1 strip, drawn 160×40 centered, black bars top/bottom.
  - Fit math: `ar = w/h of the export`; `w = W, h = W/ar`; if `h > H` then `h = H, w = H*ar`; center and round. Never upscale past the box.
- Under the screen: state dot (green `#4A8D6F` rendering · amber `#E5B567` paused · blue `#7FB2E8` done · `#5A5A5A` idle), the **real proxy size** (`90×90 proxy`), the fit note (`Dome 1:1 in 16:9`), and the frame timecode right-aligned.
- Content while running = the frame the encoder just wrote, i.e. **draw the real render target downscaled to the buffer**, once per encoded frame (the design fakes it with drifting bands + a rotating layer). While idle it shows the current playhead frame. A 1px `rgba(255,255,255,0.16)` line sweeps as the encoder head.
- Implementation notes that mattered: drive the monitor from **one** rAF loop plus a ~160ms interval fallback (rAF is throttled when the window is hidden, and the export must keep progressing when the app is in the background); guard the draw in try/catch so a drawing error can never freeze the progress model.

## Status block

- Phase 12px/600 `#E0E0E0` left; **percentage 16px/600** `#F0F0F0` right, tabular.
- Sub-line 10.5px `#8C8C8C`: `frame 812 / 1440 · PNG · 4096²` while running, `1440 frames written · 3.2 GB` when done, `1440 frames · 00:11 of timeline` when idle.
- Progress rail 3px, track `#0A0B0C`, fill green `#4A8D6F` (amber when paused, blue when done), `transition:width .18s linear`.
- Three stat cells in a 1px-gap grid on `#131417`: Elapsed · Remaining · Written (label 10.5px `#6D6D6D`, value 11px/600 `#B8B8B8`, tabular). `—` when not applicable.
- Bottom line: `31.2 fps rendered · 626 MB/s to disk` while running / `Paused at frame N · partial output kept` / `Saved to the project render folder` / `Monitor shows the current playhead frame`.
- Buttons appear only while running or paused: **Pause ⇄ Resume** (`#262626`) and **Cancel** (transparent, `#E06C6C`, border `rgba(224,108,108,0.42)`). Resume must reset the elapsed-time delta so the bar doesn't jump.

## Settings rows

| Row | Control |
|---|---|
| Preset | select + `Save` button. Options: Dome 4K · PNG / Resolume · HAP Q / Review · H.264 1080p. Applying one sets codec + size + fps. |
| Range | segmented `Clip extent` / `In / Out` + timecode `00:04:12 → 00:15:36`. I/O is disabled without marks (existing rule). |
| Codec | select: PNG sequence · alpha, lossless / MP4 · H.264 / MP4 · H.265 / HEVC / MOV · HAP / MOV · HAP Q / Still frame · PNG. |
| **Pixel size** (spans both columns) | segmented `Match source` / `Preset` / `Custom`.<br>· Match source → `4096 × 4096 px · from the active sequence` (dome 4096², 2D 1920×1080, room strip 8192×1080).<br>· Preset → 2048 / 3072 / 4096 / 6144 / 8192 (+ unit `px²` for dome, `px wide` otherwise).<br>· Custom → two typed number fields `W × H` on `#0A0B0C`, right-aligned tabular, min 16 max 16384 step 2; in dome the height is disabled and mirrors the width (`square — height follows width`), room notes `unwrapped strip`. Switching to Custom seeds the fields from the current size. |
| Frame rate | select 24 / 25 / 30 / 48 / 50 / 60 + `fps`. |
| Bitrate | number + `Mbps` + `Auto` — **only for H.264 / H.265**. `Auto` = `w*h*fps*0.11 / 1e6`, clamped 24–800; it stops auto-updating once the user types a value. |
| Chunks | select Auto/1/2/4/8/16 + hint `8 · parallel decode threads` — **only for HAP / HAP Q**. |
| Room | segmented `Full strip` / `Per wall · 3` — **only in 360 room**. |
| Estimated | full-width strip on `#131417`: size, frame count, codec, and for video `0.18 bpp · High`; amber `#E5B567` when a PNG sequence goes over 1.5 GB (`· large, high RAM`) or a codec/size combination is unsupported. |

**Everything derives from one pixel-size source of truth** (`px()` → `{w,h}`): estimate, auto bitrate, bpp, frame count, monitor aspect, render name. Keep that single function when porting — the old code multiplied `res*res` in five places.

Estimate math (unchanged from the app): PNG `w*h*1.2*frames` · video `bitrate/8*seconds` · HAP `ceil(w/4)*ceil(h/4)*bpb*16*frames*0.85` (bpb 0.5 HAP / 1.0 HAP Q) · still `w*h*1.2`.

## Footer

Destination path 10.5px `#5A5A5A` left (`Destination · …/Show 01/renders`, and the written filename once done). `Close` secondary, primary **Export** → `Restart render` while active → `Export again` when done, bg `#4A4A4A`, hover `#565656`, 11px/600 + 12px share icon.

## Tokens used

Surfaces `#16171A` sheet · `#1B1B1B` header · `#131417` insets/footer · `#262626` controls · `#4A4A4A` active/primary · `#0A0B0C` wells. Text `#F0F0F0` / `#E0E0E0` / `#B8B8B8` / `#8C8C8C` / `#6D6D6D` / `#5A5A5A`. Lines `rgba(255,255,255,0.07–0.12)`. Accents green `#4A8D6F`, amber `#E5B567`, blue `#7FB2E8`, danger `#E06C6C`. Radius 2px inner / 3px controls / 6px sheet. Geist 400/500/600, 9.5–16px, tabular numerals on every number. Sentence case only.

## Acceptance checklist

- [ ] Sheet opens centered, does not cover the whole screen, drags by the header, closes with ✕ / Close / Esc.
- [ ] Monitor is a 16:9 black box; dome, 2D and room all fit inside it with black bars and no distortion.
- [ ] While exporting, the monitor updates per encoded frame and keeps updating when the app window is not focused.
- [ ] %, frame counter, elapsed, remaining, written, fps and MB/s all advance; ETA is stable within a few seconds.
- [ ] Pause freezes progress and the monitor timecode; Resume continues without a jump; Cancel returns to idle.
- [ ] `Match source` reflects the active sequence; `Custom` accepts typed pixels (Enter applies, Esc reverts, arrows nudge) and clamps 16–16384; dome keeps a square.
- [ ] Estimate, auto bitrate and bpp change with the pixel size, codec, range and fps.
- [ ] Bitrate row only for H.264/H.265; Chunks only for HAP; Room only in 360 room.
- [ ] No all-caps labels; no macOS shortcut glyphs.
