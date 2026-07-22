(async () => {
  const OUT = 'C:/Users/beltr/Desktop/Alma Digital Studio/Projects/Immersive Studio Pro/scratchpad/out/ref_frame0.raw';
  const res = 512, oW = glc.width, oH = glc.height;
  exporting = true; _exportQuality = true; _drawFlat = isFlat(); _roomWrap = isRoom(); _compAspect = (state.seqW || 1) / (state.seqH || 1);
  glc.width = res; glc.height = res;
  await seekExport(0); prepNests(state.clips, 0, 0); renderExportFrame(0, res, exportSS(res), null);
  const px = new Uint8Array(res * res * 4); gl.readPixels(0, 0, res, res, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const flip = new Uint8Array(res * res * 4);   // GL reads bottom-up; store top-down like a decoder emits
  for (let y = 0; y < res; y++) flip.set(px.subarray((res - 1 - y) * res * 4, (res - y) * res * 4), y * res * 4);
  const ok = await DSP.writeBinary(OUT, flip);
  glc.width = oW; glc.height = oH; freeExportFBO(); dxtFree(); exporting = false; _exportQuality = false;
  resize(); try { scrubRender(); } catch (e) {}
  return JSON.stringify({ written: ok, bytes: flip.length });
})()
