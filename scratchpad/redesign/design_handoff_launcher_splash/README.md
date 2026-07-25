# Handoff: Launcher (landing) + Loading splash — Immersive Studio Pro

## Overview
Two entry-point surfaces for **Immersive Studio Pro**, a professional editing suite for immersive media (fulldome, 360 rooms, 2D flat canvases):

1. **Loading splash** — a fixed 1080 × 1080 window shown while the application boots (same role as the Ableton Live splash), before the main window opens.
2. **Launcher (landing)** — the first full screen after boot. It creates a new project of one of three types (Dome / 2D Flat / 360 Room), exposes every parameter that defines the project, previews the result live in technical viewers, and lists recent projects.

## About the design files
The files in this bundle are **design references authored in HTML**. They are prototypes that show intended look, structure and behavior — **not production code to copy**. The task is to **recreate these designs inside the target codebase's existing environment** (React, Vue, SwiftUI, Electron, etc.) using its established patterns, component library and state management. If no environment exists yet, pick the most appropriate framework for the product (the rest of the suite is a desktop editor, so an Electron/React or Tauri/React shell is the natural fit) and implement the designs there.

The prototypes use a small in-house HTML runtime (`support.js`, `<x-dc>`, `{{ }}` holes, `<sc-for>`, `<sc-if>`). **Ignore that runtime.** Read the markup for structure/styling and the `class Component` block for logic; both map 1:1 to a normal component with local state.

## Fidelity
**High fidelity.** Colors, typography, spacing, sizes and interactions are final. Recreate pixel-perfectly. Every value in this document is exact.

---

## Global design system

### Typography
Single family: **Geist** (Vercel), self-hosted, weights 400 / 500 / 600. Fallback `system-ui, sans-serif`.

| Use | Size | Weight | Extra |
|---|---|---|---|
| Section labels ("New project", "Recent projects") | 10px | 600 | letter-spacing .06em, color #6A6A6A |
| Micro labels (table headers, pane captions, "Created by") | 9–9.5px | 500/600 | letter-spacing .05em, color #5A5A5A |
| Body / field labels | 11px | 400 | color #9A9A9A |
| Field values, inputs | 10–10.5px | 500/600 | tabular-nums |
| Pills, tabs, segmented options | 10px | 600 | tabular-nums |
| Card titles, primary button | 11–12px | 600 | letter-spacing −.006em |
| Page title (launcher) | 27px | 600 | letter-spacing −.026em |
| Splash product name | 52px | 600 | letter-spacing −.026em |

Rules: **never use all-caps text.** All numeric readouts use `font-variant-numeric: tabular-nums`.

### Colors
| Token | Hex | Use |
|---|---|---|
| Canvas | #0A0B0C | app background |
| Canvas gradient | `radial-gradient(90% 55% at 50% -8%, #16181C 0%, #0A0B0C 60%)` | launcher backdrop |
| Panel | #101113 | properties panel, recent cards |
| Panel deep | #0C0D0F | nested wells (wall table, output block) |
| Viewer body | #0D0E10 | viewer container |
| Viewer stage | `radial-gradient(78% 78% at 50% 45%, #131519 0%, #0A0B0C 100%)` | each viewer pane |
| Bar | #121316 | 28px toolbars |
| Tile idle | #0C0D0F | unselected type tile |
| Tile active | #1C1E22 + border rgba(255,255,255,.24) + inset 0 1px 0 rgba(255,255,255,.05) | selected type tile |
| Chip | #141517 | facing selector, badges |
| Hairline | rgba(255,255,255,0.06–0.09) | all borders, .5px |
| Text primary | #F4F4F4 / #E0E0E0 | titles, inputs |
| Text default | #D8D8D8 / #C8C8C8 | values |
| Text muted | #9A9A9A | labels |
| Text dim | #7A7A7A / #6A6A6A | secondary |
| Text faint | #5A5A5A / #4E4E4E | captions |
| Accent (primary action / active pill) | #EDEDED on #141414 text; hover #FFFFFF | Create button, active segment |
| Toggle on | #4A5A66 | switches |
| Dome coverage ring | rgba(224,149,75,.5) | >180° indicator |

**Wall facing ramp (360 room)** — neutral, technical, luminance-ordered:
| Facing | Hex |
|---|---|
| Front | #E4E7E9 |
| Right | #B9C0C6 |
| Back | #98A1A8 |
| Left | #7C858D |

### Geometry
- Toolbars **28px**, controls **22px**, segmented pills **16px**, table inputs **20px**, primary button **32–34px**.
- Border radius: **5px** panels, **4px** cards/tiles/buttons, **3px** inputs/segment groups, **2px** pills/badges.
- Borders are always **.5px** hairlines.
- Grid gaps: 16px between panel and viewer, 8px between viewer panes, 9px between panel rows, 6px between type tiles, 2px inside segmented groups.

---

## Screen 1 — Loading splash
File: `Loading Splash - Rev 1.dc.html`

### Purpose
Shown immediately on launch while the app initializes; closes when the main window is ready.

### Layout
Fixed **1080 × 1080** window, no chrome. Border .5px rgba(255,255,255,.08), radius 8px, background `radial-gradient(78% 60% at 22% 18%, #1B1D20 0%, #121315 52%, #0E0F11 100%)`. Padding **84px**. Flex column.

1. **Upper block** (`flex:1`, row, align center, space-between)
   - App mark `assets/immersive-logo.png` at **440 × 440**, object-fit contain.
   - Edition pill: text "Pro", height **72px**, padding 0 34px, radius 36px, background #EDEDED, color #101012, 32px/600, letter-spacing −.01em.
2. **Lower block** (row, align flex-end) — single left column, gap 14px:
   - Product name — "Immersive Studio Pro", 52px/600, −.026em, #F4F4F4.
   - Build line — "1.0.0  ·  Build 2026-07-25_a41f9c2", 24px/500, #7A7A7A, tabular.
   - Status line — 24px/400, #9A9A9A, fixed 32px height so the block never reflows.
   - Credit (margin-top 16px) — Alma Digital mark 30 × 30 at .6 opacity + "Created by **Alma Digital Studio**", 21px, #6A6A6A / #8A8A8A 500.
3. **Progress bar** — absolutely positioned, full bleed at the bottom edge, height **4px**. Track rgba(255,255,255,.07); fill #EDEDED with `transition: width .12s linear`; a 40px white sheen gradient sweeps across the fill (`@keyframes ispSheen`: translateX(−100%) → translateX(320%), 1.6s linear infinite).

### Behavior
- Progress is time-based over `durationSec` (default **7s**) with ease-out: `p = 100 * (1 − (1 − t)^2.1)`, ticked every 40ms.
- On reaching 100% it holds **1.4s**, then restarts if `loop` is true (loop exists for design review; in production the splash closes when boot finishes).
- Status text is driven by progress thresholds:

| ≥ % | Status |
|---|---|
| 0 | Starting up |
| 9 | Loading render engine |
| 22 | Initializing dome projection |
| 38 | Building timeline engine |
| 54 | Loading effects library |
| 68 | Scanning media cache |
| 80 | Restoring workspace |
| 91 | Preparing viewports |
| 100 | Ready |

In production, replace the synthetic timer with real boot milestones and drive both the bar and the status from them.

### State
`progress: number (0–100)`. Config: `durationSec`, `loop`, `buildLabel`.

---

## Screen 2 — Launcher (landing)
File: `Launcher - Rev 4.dc.html`

### Purpose
Create a new project of a chosen type with all its parameters, see it previewed in technical viewers before committing, or reopen a recent project.

### Page shell
`height:100vh; min-height:1000px; overflow:hidden` — **the page never scrolls and never changes size when the project type changes.** This is a hard requirement: all three types must produce an identical page height and an identical properties-panel height (verified at 1000px / 610px). Content column `max-width:1760px`, horizontal padding 28px.

Vertical stack:
1. **Title bar — 38px.** App mark 15px + "Immersive Studio Pro" 11px/600 #C8C8C8 + "v1.0" 10px #5A5A5A. Right: "Open project" button (22px, folder icon 12px, .5px border, hover border rgba(255,255,255,.2) + text #E8E8E8) and a 22 × 22 settings icon button.
2. **Hero** — padding 22px top / 18px bottom. App mark **46 × 46** + `<h1>` "Immersive Studio Pro" 27px/600. Right: Alma lockup — 24 × 24 mark + "Created by" (9.5px/500 #5A5A5A) over "Alma Digital Studio" (11.5px/600 #C8C8C8), inside a .5px box, radius 4, padding 7px 12px 7px 9px, background rgba(255,255,255,.015).
3. **Work row** — `display:grid; grid-template-columns:426px minmax(0,1fr); gap:16px; flex:1; min-height:612px; max-height:720px`.
4. **Flexible spacer** (`flex:1; min-height:18px`) — absorbs extra viewport height so the layout is stable from 1000px to any taller screen.
5. **Recent projects** — label row + `grid-template-columns:repeat(8,minmax(0,1fr)); gap:9px`.
6. **Footer — 40px**, top hairline. Alma mark 16px at .6 + "Immersive Studio Pro · Created by **Alma Digital Studio**" 10.5px, right "© 2026 · All rights reserved" 10.5px #4E4E4E.

### A. Properties panel (left, 426px)
Panel: .5px border, radius 5, background #101113, padding 14, flex column, gap 9, `overflow:hidden`.

1. **"New project"** section label + hairline rule.
2. **Type tiles** — 3 equal columns, gap 6, each **68px** tall, padding 8px 9px, radius 4, icon 21px stroke 1.4 top-left, name 11px/600 and sub-label 9.5px #6A6A6A bottom-left.
   - Dome / "Fulldome fisheye" · 2D Flat / "Screens & LED" · 360 Room / "Walls & floor".
   - Selecting a type resets the viewer camera (orbit 0, pitch 22, pan 0) and clears input drafts.
3. **Name** — label 70px wide + text input, 24px, radius 3, background #0A0B0C, placeholder "Untitled project", focus border rgba(255,255,255,.28).
4. **Parameter rows** (22px tall, label column 70px, gap 9):

   **Dome**
   | Row | Control |
   |---|---|
   | Resolution | segmented 2048 / 3072 / 4096 / 6144 / 8192 **+** numeric field (64px, suffix "px", range 512–16384) |
   | Angle | segmented 180° / 200° / 210° / 220° **+** numeric field (suffix "°", range 140–240) |
   | Frame rate | segmented 24 / 25 / 30 / 48 / 50 / 60 |

   **2D Flat**
   | Row | Control |
   |---|---|
   | Preset | 1080p / 4K / 9:16 / 1:1 / Wall (2560×720) — highlights when it matches the current size |
   | Size | width input × height input (72px each, 16–16384) + swap button (22 × 22, ⇅ icon) + computed aspect ratio, right-aligned |
   | Color | Rec.709 / P3 / Rec.2020 |
   | Frame rate | 24 / 25 / 30 / 48 / 50 / 60 |

   **360 Room**
   | Row | Control |
   |---|---|
   | Walls | 2 / 3 / 4 |
   | Preset | HD / 1440p / 4K / DCI / Square — applies to every wall, highlights when it matches wall 1 |
   | Floor | toggle "Add a floor surface" |
   | Uniform | toggle "Edit one wall, apply to all" |
   | Frame rate | 24 / 25 / 30 / 48 / 50 / 60 |

5. **Wall table** (360 Room only) — well: .5px border, radius 4, background #0C0D0F, padding 9, gap 5. Header row 12px, 9px/600 #5A5A5A. Rows 21px tall, gap 5. **Six columns, exactly:**
   | Col | Width | Content |
   |---|---|---|
   | # | 16px | fixed index 1…N, 9.5px/600 #7A7A7A |
   | Facing | 84px | button: 6 × 6 color swatch + facing name in the facing color + chevron. **Click reassigns the facing**, swapping with whichever row currently holds it — two walls can never share a facing |
   | Width px | 58px | numeric input, 16–16384 |
   | Height px | 58px | numeric input, 16–16384 |
   | Width cm | 52px | numeric input, 10–20000, text #9A9A9A |
   | Height cm | 52px | numeric input, 10–20000, text #9A9A9A |

   Defaults: 4 walls, Front/Right/Back/Left, 3840 × 2160 px, 800 × 450 cm each. With **Uniform** on, editing any px/cm field writes to all walls; facing is always per-row.

6. **Spacer** (`flex:1`) — keeps the block below pinned to the bottom.
7. **Master output** well — label + three key/value rows (key 70px, 10px #6A6A6A; value 11px/600 #D8D8D8 tabular, ellipsis):
   - Dome: Master `N × N fisheye` · Coverage `180° · hemisphere` (or "below horizon" when >180) · Timing `60 fps · 16.8 MP`
   - Flat: Canvas `1920 × 1080 · 16:9` · Color `Rec.709` · Timing `60 fps · 2.1 MP`
   - Room: Stitched `15360 × 2160 px` · Surfaces `4 walls + floor · 33.2 MP` · Timing `60 fps`
8. **Create button** — full width, 32px, radius 4, background #EDEDED (hover #FFFFFF), text #101012 12px/600, label "Create <Type> project", arrow icon 13px. Navigates to the corresponding editor.

#### Numeric-field editing mechanic (applies to every numeric input)
- Controlled by a **draft map**: typing writes a raw string to `draft[key]`; the committed number is untouched until commit.
- **Enter** commits and blurs · **Blur** commits · **Escape** discards the draft and blurs.
- **↑ / ↓** nudge by **10**, **Shift+↑/↓** by **100**, **Alt+↑/↓** by **1**; commits immediately.
- Commit sanitizes to digits and clamps to the field's min/max.

### B. Viewer panel (right, fills remaining width)
Container: .5px border, radius 5, background #0D0E10, `overflow:hidden`.

**Toolbar (28px)**: viewer name pill (16px, radius 2, background #242629, 10px/600 #D0D0D0 — "Dome viewer" / "Canvas viewer" / "Room viewer"), then a summary line (10px #6A6A6A tabular, ellipsis), then the drag hint (10px #4E4E4E, right). No other controls.

**Panes** (8px padding, 8px gaps, each pane .5px border, radius 4, stage gradient, caption 9.5px/600 #5A5A5A top-left at 10/9px):

| Type | Grid | Panes |
|---|---|---|
| Dome | `1fr 1fr` | **Fisheye master** (left) · **Dome · 3D** (right) |
| 2D Flat | single | **Flat canvas** |
| 360 Room | `1fr 1fr` / rows `1fr 158px` | **Top-down plan** (left) · **Room · 3D** (right) · **Stitched canvas** (spans both columns) |

All panes draw into an SVG with `viewBox="0 0 360 300"`, `preserveAspectRatio="xMidYMid meet"`.

**Fisheye master** — dome circle r=100 at (180,150) on #050506; media stand-in clipped to the circle and rotated by orbit; graticule rings r=75/50/25 + cross axes at rgba(255,255,255,.06); 24 azimuth ticks (major every 90°: 10px long, 1.2 wide, opacity .34; minor every 30°: 5px, .8, .15); dashed coverage ring at `r = 100 × 180/angle` when angle > 180; outer ring rgba(255,255,255,.16); N/E/S/W labels at r−17 rotating with orbit. Bottom **data strip** (24px, rgba(10,11,12,.72), top hairline): dimensions `4096 × 4096 px` (10px/600 #C8C8C8), divider, `16.8 MP · 180° · 60 fps` (10px #8A8A8A), and the orbit readout right-aligned.

**Flat canvas** — rectangle fitted into 246 × 192 units preserving the real aspect; colour-bar test pattern clipped inside and offset by pan; rule-of-thirds lines rgba(255,255,255,.07); 1px frame rgba(255,255,255,.18). Same bottom data strip: `1920 × 1080 px | 2.1 MP · 16:9 · Rec.709 · 60 fps` + pan readout.

**Top-down plan** — **fixed orientation, not rotatable, no drag: Front is always the top edge.** Room rect x96 y68 w168 h164; floor fill rgba(180,190,200,.045) when the Floor toggle is on; 3 × 3 grid rgba(255,255,255,.05); each active wall drawn as a 4px line in its facing color (Front top, Right right, Back bottom, Left left); viewer cone (70 unit radius, ±30°, pointing up) + 3.5px dot at the centre. Each wall is labelled outside the room in three lines: `1 · Front` (9.5px/600, facing color), `800 × 450 cm` (8.5px #7A7A7A), `3840 × 2160 px` (8.5px #5A5A5A). Caption right: "Fixed · front up".

**Dome · 3D / Room · 3D** — a hand-rolled perspective projection, no 3D library needed:
```
rotateY(yaw) → rotateX(pitch) → f = scale / (dist + z') → (180 + x'·f, 150 − y'·f)
```
- Dome: hemisphere of 18 × 8 quads, elevation from `−(angle−180)/2` to 90° (so >180° domes extend below the horizon), Lambert shading against light (−.42,.78,.46) → `rgb(15+λ·42 …)`, quads painter-sorted back-to-front, hairline wireframe rgba(255,255,255,.055), horizon ring rgba(232,232,232,.28), N/E/S/W at 1.16 × radius. `dist 3.4, scale 250`.
- Room: ground grid, optional floor quad, one quad per wall filled at 9% of its facing color with a 1.2px stroke at 70%, painter-sorted; each wall labelled at its centroid with `1 · Front` (facing color) over `3840 × 2160 px` (8.5px #6A6A6A). `dist 4.6, scale 268`.
- Readout bottom-right: `orbit° · pitch°`.

**Stitched canvas** (360 Room) — header: caption "Stitched canvas · wall order", hairline rule, then `15360 × 2160 px` (10px/600 #C8C8C8) | `33.2 MP` | `60 fps`. Below, one strip: a single container with a .5px border and radius 2 whose background is rgba(255,255,255,.07), with the screens as #0A0B0C tiles separated by 1px gaps (that is how the hairline dividers are produced — **no per-tile colored borders or inset shadows**). Each tile is `flex: <width> 1 0` so its width is proportional to the real pixel width, and contains: 6 × 6 facing swatch + index (10px/600 #C8C8C8) + facing name (10px/500, facing color); then `3840 × 2160 px` (10.5px/600 #C8C8C8), `800 × 450 cm` (9.5px #6A6A6A), `x offset 3840` (9.5px #5A5A5A).

#### Camera interaction
| Pane | Drag |
|---|---|
| Fisheye master | horizontal → orbit (0.45°/px, wraps 0–360) |
| Flat canvas | pan, 0.5 unit/px, clamped ±40 x / ±28 y |
| Any 3D pane | horizontal → orbit; vertical → pitch (0.28°/px, clamped 4–78°) |
| Top-down plan | none — fixed |

Orbit is shared: rotating a dome fisheye also rotates its 3D pane. Pointer capture on pointerdown, cursor `grab` → `grabbing`.

### C. Recent projects
8 cards in a single row. Card: .5px border, radius 4, background #101113, hover border rgba(255,255,255,.18) + background #15161A. Thumbnail `aspect-ratio:16/9` with a per-project gradient and a schematic SVG of the project type (dome circle / flat rectangle at the real aspect / room plan with the four facing colors). Overlays: type badge top-left (15px, radius 2, background rgba(10,11,12,.72), 9px/600 in the project's accent — "Dome" / "2D" / "360") and duration bottom-right (9px/500 #9A9A9A tabular on rgba(10,11,12,.65)). Body: padding 7px 8px 8px, name 10.5px/500 #D8D8D8 (ellipsis) over meta 9.5px #6A6A6A (ellipsis).

---

## State model (launcher)
```ts
type Facing = 'Front' | 'Right' | 'Back' | 'Left';
type Wall = { facing: Facing; w: number; h: number; wcm: number; hcm: number };

type LauncherState = {
  ptype: 'dome' | 'flat' | 'room';
  pname: string;
  // dome
  domeRes: number;      // default 4096
  domeCov: number;      // default 180
  // flat
  flatW: number;        // 1920
  flatH: number;        // 1080
  flatColor: 'Rec.709' | 'P3' | 'Rec.2020';
  // room
  roomCount: 2 | 3 | 4; // 4
  roomFloor: boolean;   // true
  roomUniform: boolean; // true
  walls: Wall[];        // always length 4; the first roomCount are active
  // shared
  fps: number;          // 60
  // camera
  orbit: number; pitch: number; panX: number; panY: number;
  // input drafts
  draft: Record<string, string>;
  dragging: boolean;
};
```
Derived: `totalW = Σ wall.w`, `totalH = max(wall.h)`, `totalPx = Σ (w × h)`, per-wall x offset = sum of previous widths.

## Assets
| File | Use |
|---|---|
| `assets/immersive-logo.png` | Immersive Studio Pro mark — white on transparent, 1060 × 1081. Title bar 15px, hero 46px, splash 440px |
| `assets/alma-logo.png` | Alma Digital Studio mark — white on transparent, 952 × 1081. Hero 24px, footer 16px, splash 30px |
| `assets/fonts/geist-400.woff2` · `geist-500.woff2` · `geist-600.woff2` | Geist |

Both logos are supplied by the client; keep them as-is and never recolor them.

## Files in this bundle
| File | What it is |
|---|---|
| `Launcher - Rev 4.dc.html` | Launcher / landing design reference |
| `Loading Splash - Rev 1.dc.html` | 1080 × 1080 boot splash design reference |
| `support.js` | Prototype runtime — required only to open the HTML files in a browser. Do not port it |
| `assets/` | Logos and fonts |

To view a prototype: open the `.dc.html` file directly in a browser (no build step, no server).

## Acceptance checklist
- [ ] Page height and properties-panel height are identical for Dome, 2D Flat and 360 Room; nothing shifts when switching type.
- [ ] The page itself never scrolls at ≥1000px viewport height.
- [ ] No all-caps text anywhere.
- [ ] Two walls can never share the same facing.
- [ ] The top-down plan never rotates and always shows Front at the top.
- [ ] Numeric fields support Enter / Esc / arrow-key nudging with clamping.
- [ ] Dome, flat and stitched-canvas viewers all surface their pixel data in the same visual language.
- [ ] Splash is exactly 1080 × 1080 and its text block never reflows as the status changes.
