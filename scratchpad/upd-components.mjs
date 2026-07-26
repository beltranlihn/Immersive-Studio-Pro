// Anti-pudrición: pone al día las filas de COMPONENTS.md tocadas por R156-R160.
import fs from 'fs';
const p = 'COMPONENTS.md';
const raw = fs.readFileSync(p, 'utf8');
const nl = raw.includes('\r\n') ? '\r\n' : '\n';
let L = raw.split(/\r?\n/);
const log = [];
const sub = (needle, repl, why) => {
  const i = L.findIndex(l => l.includes(needle));
  if (i < 0) { log.push('✗ ' + why); return; }
  L[i] = L[i].split(needle).join(repl); log.push('✓ ' + why);
};

// — índice maestro
sub('| Filas de parámetro | Fader + diamante + arco de mod | app.js · `buildRows`/`startValDrag` · `.prow` | ✅ | [A1] |',
    '| Filas de parámetro | Fader (129px) + caja + UN diamante | app.js · `buildRows`/`startValDrag` · `.prow` | ✅ | R159 |',
    'índice: fila de parámetro sin arco de mod ni prev/next');

// — Per-param rows
sub('- **Purpose:** Render one `.prow` per automatable parameter with a fader track, modulation-arc ring, number box, modulation button, and prev/diamond/next keyframe nav.',
    '- **Purpose:** Render one `.prow` per automatable parameter: label (60px) · fader track (~129px) · number box (42px) · ONE 20px keyframe diamond — the prototype row (RevDomo:286-290).',
    'per-param: propósito sin arco/mod/prev-next');
sub('`.lab/.field[data-p]/.track>i/.modarc/.box>.num/.modb/.nav`',
    '`.lab/.field[data-p]/.track>i/.box>.num/.nav>button[data-k=add]`',
    'per-param: markup real');
sub('- **Invariants / gotchas:** `.auto` class = param automated (Ableton-style bright label; stopwatch removed). Filled diamond = playhead on a keyframe (`kfAt`). `hasKf()` returns undefined not false → toggles use `!!`. Modulation ring (`.modarc --m0/--m1`) spans base vs resolved value.',
    '- **Invariants / gotchas:** `.auto` class = param automated (Ableton-style bright label; stopwatch removed). Filled diamond = playhead on a keyframe (`kfAt`). `hasKf()` returns undefined not false → toggles use `!!`. **[R155]** the modulation button/arc are archived (engine still evaluates modulation loaded from old `.isp`). **[R159]** prev/next keyframe buttons are gone — those 40px were what the fader was missing; jumping lives in `jumpAnyKf(dir)` on **Alt+, / Alt+.**, which walks every automated param of the selected clip.',
    'per-param: invariantes R155/R159');

// — Transport bar
sub('- **Purpose:** Playback + edit controls above the timeline: mark in/out, play, go start/end, automation REC, follow-playhead, timecode readout, TC/Frames toggle, loop, locator prev/add/next, Snap, Simple-clip, automation (curves) toggle, zoom in/out.',
    '- **Purpose:** Playback + edit controls above the timeline: mark in/out, play, go start/end, automation REC, follow-playhead, timecode readout, TC/Frames toggle, loop, add locator, automation (curves) toggle, Fit, zoom in/out.',
    'transport: propósito sin Snap/Simple/prev-next locator');
sub('- **Location:** index.html `.transport`. Handlers: `#tlZoomIn/#tlZoomOut`, `#prevMk/#addMk/#nextMk`, `#snapBtn`→`toggleSnap()` (L2346), `#simpleClipBtn`→`toggleSimpleClips()` (L2350), `#tlGridBtn` (~L5822), `#fitAllBtn`→`fitAll()` (~L5820).',
    '- **Location:** index.html `.transport`. Handlers: `#tlZoomIn/#tlZoomOut`, `#addMk`, `#tlGridBtn`, `#fitAllBtn`→`fitAll()`.',
    'transport: ubicación real');
sub('- **State owned:** `state.tl.pxPerSec`, `state.tl.snap`, `state.tl.simpleClips`, `state.tl.gridOn`, `state.loop`',
    '- **State owned:** `state.tl.pxPerSec`, `state.tl.gridOn`, `state.loop`',
    'transport: estado real');
sub('edit well `#tlEditSeg` = `#simpleClipBtn` (Simple) · `#curvesBtn` (Auto, key A) · `#tlGridBtn` (Grid) · `#fitAllBtn` (Fit); `#snapBtn` sits outside the well.',
    'edit well `#tlEditSeg` = `#curvesBtn` (Auto, key A) · `#tlGridBtn` (Grid) · `#fitAllBtn` (Fit). **[R155]** `#simpleClipBtn` archived (Ableton grab mode gone). **[R158]** `#snapBtn` archived (grid snap gone). **[R159]** `#prevMk`/`#nextMk` gone — the design has one "Add locator"; `,` / `.` already navigate.',
    'transport: símbolos R155/R158/R159');

// — Snap
sub('- **Purpose:** Snapping of clip edges, playhead, markers to other clip edges / playhead / markers (always on) and to the grid (gated by the Snap button). Alt bypasses at call sites.',
    '- **Purpose:** Snapping of clip edges, playhead and markers to other clip edges / playhead / markers. Always on, like Premiere — **[R158]** there is no grid snap and no Snap button any more. Alt bypasses at call sites.',
    'snap: propósito R158');
sub('- **Location:** app.js · `applySnap()` (L2353–2356), `snapTargets()` (L2335), `snapGrid()` (L2340), `showSnap()` (L2357), `gridSec()`/`gridBaseAdaptive()`/`gridLabel()` (L2337–2341), `toggleSnap()` (L2346). Grid controls `gridNarrow/gridWiden/gridToggleFixed` (L2343–2345).',
    '- **Location:** app.js · `applySnap()`, `snapTargets()`, `showSnap()`, `gridStepSec()` (ex-`snapGrid`: it is the timeline grid STEP, not a snap), `gridSec()`/`gridBaseAdaptive()`/`gridLabel()`. Grid controls `gridNarrow/gridWiden/gridToggleFixed`.',
    'snap: ubicación R158');
sub('- **State owned:** `state.tl.snap` (default false, L80), `state.tl.gridDiv/gridFixed/gridFixedBase`',
    '- **State owned:** `state.tl.gridDiv/gridFixed/gridFixedBase` (grid drawing only; `state.tl.snap` retired in R158)',
    'snap: estado R158');
sub('- **Invariants / gotchas:** Edge/playhead/marker snap is ALWAYS on ([R80b]); the Snap button gates ONLY the grid. `snapGrid` returns bars-grid unconditionally in bars mode, else grid only when `state.tl.snap`.',
    '- **Invariants / gotchas:** Edge/playhead/marker snap is ALWAYS on ([R80b], [R158]) and ungated. Tolerance stays `9/pxPerSec`. `gridStepSec()` only feeds the ruler/grid drawing — never `applySnap`.',
    'snap: invariantes R158');

// — Markers
sub('- **Key symbols:** `#prevMk/#addMk/#nextMk`; dashed line z-index 5.',
    '- **Key symbols:** `#addMk` (single button, as in the design); `,` / `.` jump prev/next locator; dashed line z-index 5.',
    'markers: sólo #addMk');

fs.writeFileSync(p, L.join(nl), 'utf8');
console.log(log.join('\n'));
