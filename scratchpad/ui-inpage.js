(() => {
  const r = {};
  const had = state.clips.length;
  if (!had) state.clips.push({ id: 'tst', mediaId: null, start: 0, dur: 2, props: {}, lane: 0 });
  openExport();
  const $ = s => document.getElementById(s);
  r.codecOptions = [...$('exCodec').options].map(o => o.value);

  const pick = v => { $('exCodec').value = v; $('exCodec').onchange(); };
  pick('hap');
  r.hap = { chunkRow: $('exChunkRow').style.display, brRow: $('exBrRow').style.display,
            est: $('exEst').textContent, hint: $('exChunkHint').textContent, goDisabled: $('exGo').disabled,
            chip: $('fmtChip') ? $('fmtChip').textContent : null };
  r.chunkValues = [...$('exChunks').options].map(o => o.value);
  $('exChunks').value = '16'; $('exChunks').onchange();
  r.hint16 = $('exChunkHint').textContent;
  $('exChunks').value = 'auto'; $('exChunks').onchange();

  pick('hapq');
  r.hapq = { est: $('exEst').textContent, chunkRow: $('exChunkRow').style.display, chip: $('fmtChip') ? $('fmtChip').textContent : null };

  pick('mp4');
  r.mp4 = { chunkRow: $('exChunkRow').style.display, brRow: $('exBrRow').style.display };
  pick('png');
  r.png = { chunkRow: $('exChunkRow').style.display, brRow: $('exBrRow').style.display };

  $('exClose').click();
  if (!had) state.clips.length = 0;

  // can we intercept the native Save dialog to drive a real runExport?
  r.dspPatchable = (() => { try { const o = DSP.saveFile; DSP.saveFile = 1; const ok = DSP.saveFile !== o; DSP.saveFile = o; return ok; } catch (e) { return 'throws: ' + e.message; } })();
  r.autoChunks = hapAutoChunks();
  r.cores = navigator.hardwareConcurrency;
  return JSON.stringify(r, null, 1);
})()
