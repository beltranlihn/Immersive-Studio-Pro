/* [R103] Lo que MÁS riesgo tiene de R102: cambié la semántica del color de clip (`null` = deriva del tipo).
   Eso viaja por serialización y por undo/redo. Si `null` no sobrevive un guardar/abrir, los proyectos se
   corrompen en silencio: el color volvería a un gris sin significado y nadie se enteraría hasta abrir el .isp. */
(async () => {
  const out = []; const w = (n = 120) => new Promise(r => setTimeout(r, n));
  const ok = (n, c, d) => out.push((c ? 'ok   ' : 'FAIL ') + n + (d ? '  → ' + d : ''));

  const c = state.clips[0];
  const m = mediaById(c.mediaId);
  const kindColor = clipColorFor(m && m.kind);

  // ── 1. IDA Y VUELTA por serialización con color=null (el centinela de "sin color")
  c.color = null;
  const json = serProject();
  const round = JSON.parse(JSON.stringify(json));
  const seq = (round.media || []).find(x => x.kind === 'nest' && x.nestClips);
  const sClips = seq ? seq.nestClips : (round.clips || []);
  const sc = sClips.find(x => x.id === c.id) || sClips[0];
  out.push('--   clip serializado: color=' + JSON.stringify(sc && sc.color));
  ok('1 color=null sobrevive la serialización (no se convierte en gris)',
     !sc || sc.color == null || sc.color === kindColor, 'guardado=' + JSON.stringify(sc && sc.color));

  // ── 2. y al re-hidratar, sigue derivando del tipo
  const rehydrated = { color: sc ? sc.color : null };
  ok('2 al reabrir, el color se deriva del tipo', clipTint(rehydrated, m) === kindColor,
     clipTint(rehydrated, m) + ' esperado ' + kindColor);

  // ── 3. una elección REAL del usuario sí debe viajar
  c.color = '#FF00AA';
  const j2 = JSON.parse(JSON.stringify(serProject()));
  const seq2 = (j2.media || []).find(x => x.kind === 'nest' && x.nestClips);
  const s2 = (seq2 ? seq2.nestClips : (j2.clips || [])).find(x => x.id === c.id);
  ok('3 el color elegido por el usuario sobrevive el guardado', !s2 || s2.color === '#FF00AA', 'guardado=' + (s2 && s2.color));
  ok('3b y al reabrir se respeta (no se pisa con el del tipo)', clipTint({ color: '#FF00AA' }, m) === '#FF00AA', clipTint({ color: '#FF00AA' }, m));

  /* ── 4. UNDO/REDO con color.
     OJO: `restore()` hace `state.clips=o.clips.map(...)` → REEMPLAZA los objetos clip. Cualquier referencia
     guardada antes del undo queda muerta. La 1ª versión de este test leía `c.color` de la referencia vieja y
     daba un FAIL falso. Hay que releer por id — es el mismo peligro que el código ya documenta para shapeBox
     ("the box holds live keyframe refs — undo/sequence switch replaces those objects"). */
  const cid = c.id;
  clipById(cid).color = null; pushUndo(); clipById(cid).color = '#00FF88'; renderTimeline(); await w();
  key_undo(); await w(220);
  const trasUndo = clipById(cid) ? clipById(cid).color : 'CLIP DESAPARECIDO';
  ok('4 deshacer devuelve el color a null (sin color → deriva)', trasUndo == null || trasUndo === kindColor, 'tras undo: ' + JSON.stringify(trasUndo));
  key_redo(); await w(220);
  const trasRedo = clipById(cid) ? clipById(cid).color : 'CLIP DESAPARECIDO';
  ok('4b rehacer recupera el color elegido', trasRedo === '#00FF88', 'tras redo: ' + JSON.stringify(trasRedo));
  if (clipById(cid)) clipById(cid).color = null;
  renderTimeline();

  function key_undo() { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true })); }
  function key_redo() { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true, bubbles: true })); }

  // ── 5. state.tl.audioH y las preferencias de R101/R102 sobreviven al guardado
  state.tl.audioH = 137;
  const j3 = JSON.parse(JSON.stringify(serProject()));
  ok('5 la altura del módulo de audio se guarda', j3.tl && j3.tl.audioH === 137, 'audioH=' + (j3.tl && j3.tl.audioH));

  // ── 6. abrir un proyecto VIEJO (con los grises heredados) → debe repararse solo
  const legacy = { color: '#3C4046' };
  ok('6 un proyecto viejo con gris heredado se repara al abrirlo', clipTint(legacy, m) === kindColor,
     clipTint(legacy, m) + ' (era ' + legacy.color + ')');
  return out.join('\n');
})()
