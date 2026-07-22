/* [R104] ¿Chromium decodifica NUESTRO fichero por hardware, o por software?
   RIto_Film_1080.mp4 = HEVC Main 10 (10 bits) 1920×1080 @60fps.
   La investigación avisaba: Chrome <130 limitaba HEVC por hardware a 1920×1088 @30fps → por encima, software.
   Dos decodificaciones HEVC 10-bit 1080p60 por software revientan cualquier CPU. */
(async () => {
  const out = [];
  const ua = navigator.userAgent;
  const chrome = (ua.match(/Chrome\/([0-9.]+)/) || [])[1] || '?';
  const elec = (ua.match(/Electron\/([0-9.]+)/) || [])[1] || '?';
  out.push('Electron ' + elec + '  ·  Chromium ' + chrome);
  const major = parseInt(chrome, 10) || 0;
  out.push('  → el límite HEVC 1920×1088@30 se quitó en Chrome 131. Aquí: ' + (major >= 131 ? 'POR ENCIMA (sin límite) ✓' : 'POR DEBAJO (limitado) ⚠'));
  out.push('');

  const tests = {
    'HEVC Main10 1080p60  ← NUESTRO FICHERO': 'video/mp4; codecs="hvc1.2.4.L123.B0"',
    'HEVC Main   1080p60  (8 bits)': 'video/mp4; codecs="hvc1.1.6.L123.B0"',
    'H.264 High  1080p60': 'video/mp4; codecs="avc1.640028"',
    'H.264 High  1440p60': 'video/mp4; codecs="avc1.640033"',
  };
  for (const [k, type] of Object.entries(tests)) {
    const cp = document.createElement('video').canPlayType(type) || 'NO';
    let info = '';
    if (navigator.mediaCapabilities) {
      try {
        const d = await navigator.mediaCapabilities.decodingInfo({
          type: 'file', video: { contentType: type, width: 1920, height: 1080, bitrate: 25888641, framerate: 60 } });
        info = 'soportado=' + d.supported + ' fluido=' + d.smooth + ' eficiente(=HW)=' + d.powerEfficient;
      } catch (e) { info = 'error: ' + e.message; }
    }
    out.push(k.padEnd(40) + 'canPlayType=' + String(cp).padEnd(11) + info);
  }
  out.push('');
  out.push('  powerEfficient=false → Chromium avisa de que NO usará el bloque de hardware: decodifica por CPU.');
  return out.join('\n');
})()
