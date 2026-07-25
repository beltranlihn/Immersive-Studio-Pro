// Aplica los arreglos de la auditoría R154 sobre index.html (medidas del prototipo).
import fs from 'fs';
const P = 'index.html';
let s = fs.readFileSync(P, 'utf8');
const before = s;
const R = [];
const rep = (find, repl, why) => { if (!s.includes(find)) { R.push(['NO ENCONTRADO', why, find.slice(0, 70)]); return; } s = s.replace(find, repl); R.push(['ok', why]); };

/* §4 INSPECTOR ---------------------------------------------------------------------------------------------- */
// cabecera de sección 20 → 24px (prototipo RevDomo:278)
rep('.sechead{display:flex;align-items:center;gap:6px;height:20px;',
    '.sechead{display:flex;align-items:center;gap:6px;height:24px;', 'sechead 20→24px');
// etiqueta de fila de parámetro 52 → 60px (RevDomo:287)
rep('.prow .lab{width:52px;', '.prow .lab{width:60px;', 'label de .prow 52→60px');
// surco del fader radio 1 → 2 (RevDomo:288)
rep('.prow .track{flex:1;height:3px;border-radius:1px;', '.prow .track{flex:1;height:3px;border-radius:2px;', 'track radio 1→2');
// botón Mirror 18 → 20px y radio 2 → 3 (RevDomo:293)
rep('.togbtn,.togbtn2{display:inline-flex;align-items:center;gap:var(--sp-6);height:18px;padding:0 9px;font-size:11px;font-weight:500;border-radius:2px;',
    '.togbtn,.togbtn2{display:inline-flex;align-items:center;gap:var(--sp-6);height:20px;padding:0 9px;font-size:11px;font-weight:500;border-radius:3px;', 'togbtn 18→20px, radio 2→3');
// cabecera de item: padding 11/10 → 10px 12px (RevDomo:271)
rep('.selhead{display:flex;align-items:center;gap:var(--sp-12);padding:11px 12px 10px;}',
    '.selhead{display:flex;align-items:center;gap:12px;padding:10px 12px;}', 'selhead padding → 10px 12px');

/* §5 TRANSPORT ---------------------------------------------------------------------------------------------- */
// controles del transporte: radio 2 → 3 (RevDomo:490-498)
rep('.tbtn{width:22px;height:22px;display:grid;place-items:center;border:none;border-radius:2px;',
    '.tbtn{width:22px;height:22px;display:grid;place-items:center;border:none;border-radius:3px;', 'tbtn radio 2→3');
rep('.playb{width:30px;height:22px;display:grid;place-items:center;border:.5px solid rgba(255,255,255,0.12);border-radius:2px;',
    '.playb{width:30px;height:22px;display:grid;place-items:center;border:.5px solid rgba(255,255,255,0.12);border-radius:3px;', 'playb radio 2→3');
rep('height:22px;padding:0 11px;border-radius:2px;background:var(--bg-0);border:.5px solid rgba(255,255,255,0.06);box-shadow:inset 0 1px 3px rgba(0,0,0,0.5);}',
    'height:22px;padding:0 11px;border-radius:3px;background:var(--bg-0);border:.5px solid rgba(255,255,255,0.06);box-shadow:inset 0 1px 3px rgba(0,0,0,0.5);}', 'tcbox radio 2→3');
// timecode 13 → 12.5px (RevDomo:499)
rep(".tcbox .tc{font-size:13px;", ".tcbox .tc{font-size:12.5px;", 'timecode 13→12.5px');
// wells segmentados: radio 2 → 3 (todos los wells del diseño son radius:3)
rep('.seg,.vseg,.filtseg,.editseg,.groupseg,.seg2{background:var(--surface-2);border:.5px solid rgba(255,255,255,0.1);border-radius:2px;}',
    '.seg,.vseg,.filtseg,.editseg,.groupseg,.seg2{background:var(--surface-2);border:.5px solid rgba(255,255,255,0.1);border-radius:3px;}', 'wells segmentados radio 2→3');

/* §6 TIMELINE ----------------------------------------------------------------------------------------------- */
// tool rail 32 → 34px (RevDomo:529)
rep('.toolrail{width:32px;', '.toolrail{width:34px;', 'toolrail 32→34px');
// barra horizontal: 15/9/11 → 12/5/7 (RevDomo:632-636)
rep('.tlzoom{height:15px;', '.tlzoom{height:12px;', 'barra H 15→12px');
rep('.tlztrack{position:absolute;top:3px;height:9px;background:var(--s1);border-radius:5px;box-shadow:inset 0 0 0 .5px rgba(255,255,255,0.05);}',
    '.tlztrack{position:absolute;top:3.5px;height:5px;background:#161616;border-radius:2px;}', 'pista H 9→5px');
rep('.tlzthumb{position:absolute;top:0;height:9px;min-width:24px;background:rgba(255,255,255,0.15);border-radius:5px;cursor:grab;transition:background .12s;}',
    '.tlzthumb{position:absolute;top:0;height:5px;min-width:24px;background:rgba(255,255,255,0.10);border-radius:2px;cursor:grab;transition:background .12s;}', 'thumb H 9→5px');
rep('.tlzcap{position:absolute;top:50%;width:11px;height:11px;transform:translateY(-50%);border-radius:50%;background:var(--ink-2);',
    '.tlzcap{position:absolute;top:50%;width:7px;height:7px;transform:translateY(-50%);border-radius:50%;background:rgba(184,184,184,0.7);', 'casquete H 11→7px');
// barra vertical: espejo de la de arriba, mismas medidas
rep('.tlvzoom{width:15px;', '.tlvzoom{width:12px;', 'barra V 15→12px');
rep('.tlvztrack{position:absolute;left:3px;width:9px;background:var(--s1);border-radius:5px;box-shadow:inset 0 0 0 .5px rgba(255,255,255,0.05);}',
    '.tlvztrack{position:absolute;left:3.5px;width:5px;background:#161616;border-radius:2px;}', 'pista V 9→5px');
rep('.tlvzthumb{position:absolute;left:0;width:9px;min-height:24px;background:rgba(255,255,255,0.15);border-radius:5px;cursor:grab;transition:background .12s;}',
    '.tlvzthumb{position:absolute;left:0;width:5px;min-height:24px;background:rgba(255,255,255,0.10);border-radius:2px;cursor:grab;transition:background .12s;}', 'thumb V 9→5px');
rep('.tlvzcap{position:absolute;left:50%;width:11px;height:11px;transform:translateX(-50%);border-radius:50%;background:var(--ink-2);',
    '.tlvzcap{position:absolute;left:50%;width:7px;height:7px;transform:translateX(-50%);border-radius:50%;background:rgba(184,184,184,0.7);', 'casquete V 11→7px');
// fade: 7×7 radio 2 sólido → 6×6 radio 1 translúcido (RevDomo:595)
rep(".clip .fadeh::after{content:'';position:absolute;top:3px;width:7px;height:7px;border-radius:2px;background:var(--ink);border:1px solid var(--bg-1);box-shadow:0 1px 2px rgba(0,0,0,0.6);}",
    ".clip .fadeh::after{content:'';position:absolute;top:3px;width:6px;height:6px;border-radius:1px;background:rgba(255,255,255,0.35);}", 'fade 7×7→6×6, radio 1, translúcido');
// barra de título del clip 15 → 16px (RevDomo:612)
rep('.clip .tt{position:absolute;left:0;right:0;top:0;height:15px;', '.clip .tt{position:absolute;left:0;right:0;top:0;height:16px;', 'título de clip 15→16px');

/* §3 VISOR -------------------------------------------------------------------------------------------------- */
rep("<button id=\"vzOut\" style=\"width:25px;padding:0;justify-content:center;\">", "<button id=\"vzOut\" style=\"width:24px;padding:0;justify-content:center;\">", 'zoom out 25→24px');
rep("<button id=\"vzIn\" style=\"width:25px;padding:0;justify-content:center;\">", "<button id=\"vzIn\" style=\"width:24px;padding:0;justify-content:center;\">", 'zoom in 25→24px');
// overlays: el prototipo los lleva CON etiqueta (RevDomo:143-146), no icon-only
rep('<button data-d="grid" class="on" title="Reference grid"><i class="ic" data-ico="grid"></i></button>',
    '<button data-d="grid" class="on" title="Grid overlay"><i class="ic" data-ico="grid"></i> Grid</button>', 'overlay Grid con etiqueta');
rep('<button data-d="safe" title="Safe-zone overlay"><i class="ic" data-ico="safe"></i></button>',
    '<button data-d="safe" title="Safe-zone overlay"><i class="ic" data-ico="safe"></i> Safe</button>', 'overlay Safe con etiqueta');
rep('<button data-d="outline" title="Clip outlines"><i class="ic" data-ico="outline"></i></button>',
    '<button data-d="outline" title="Clip outlines"><i class="ic" data-ico="outline"></i> Outline</button>', 'overlay Outline con etiqueta');
rep('<button data-d="hfade" title="Fade content near the dome horizon (spring line)"><i class="ic" data-ico="cull"></i></button>',
    '<button data-d="hfade" title="Fade content near the dome horizon (spring line)"><i class="ic" data-ico="cull"></i> Horizon</button>', 'overlay Horizon con etiqueta');
rep('<button data-d="checker" title="Alpha checkerboard — see how the alpha behaves"><i class="ic" data-ico="safe"></i> α</button>',
    '<button data-d="checker" title="Checkerboard background (alpha)"><i class="ic" data-ico="grid"></i> Alpha</button>', 'overlay Alpha con etiqueta');
// selector de modo: etiquetas cortas + tooltip descriptivo (RevDomo:137-138)
rep('<button data-v="2d" class="on"><i class="ic" data-ico="view2d"></i> Dome Master</button>',
    '<button data-v="2d" class="on" title="Dome master (2D)"><i class="ic" data-ico="view2d"></i> 2D</button>', 'modo 2D etiqueta corta');
rep('<button data-v="3d"><i class="ic" data-ico="view3d"></i> 3D Preview</button>',
    '<button data-v="3d" title="3D preview"><i class="ic" data-ico="view3d"></i> 3D</button>', 'modo 3D etiqueta corta');

fs.writeFileSync(P, s, 'utf8');
console.log(R.map(x => (x[0] === 'ok' ? '  ✓ ' : '  ✗ ') + x[1] + (x[2] ? '  → ' + x[2] : '')).join('\n'));
console.log('\ncambios: ' + (before === s ? 'NINGUNO' : R.filter(x => x[0] === 'ok').length + ' aplicados, ' + R.filter(x => x[0] !== 'ok').length + ' fallidos'));
