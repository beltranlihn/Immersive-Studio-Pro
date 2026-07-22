(() => {
  const c = state.clips[0];
  c.color = '#FF00AA';
  const j = JSON.parse(JSON.stringify(serProject()));
  // ¿dónde acaban los clips? v4 los guarda dentro del nest de la secuencia activa (serMedia), no arriba.
  const topClips = (j.clips || []).length;
  const nests = (j.media || []).filter(m => m.kind === 'nest');
  const info = nests.map(n => ({ nombre: n.name, clips: (n.nestClips || []).length,
    colores: (n.nestClips || []).map(x => x.color === undefined ? 'AUSENTE' : JSON.stringify(x.color)).slice(0, 4) }));
  // y el clip concreto por id
  let found = null;
  for (const n of nests) for (const x of (n.nestClips || [])) if (x.id === c.id) found = x;
  c.color = null;
  const j2 = JSON.parse(JSON.stringify(serProject()));
  let found2 = null;
  for (const n of (j2.media || []).filter(m => m.kind === 'nest')) for (const x of (n.nestClips || [])) if (x.id === c.id) found2 = x;
  return JSON.stringify({
    clipsArriba: topClips, nests: info,
    conColorElegido: found ? { id: found.id, color: found.color === undefined ? 'AUSENTE' : found.color } : 'NO ENCONTRADO',
    conColorNull: found2 ? { id: found2.id, color: found2.color === undefined ? 'AUSENTE (JSON borra undefined)' : found2.color } : 'NO ENCONTRADO',
  }, null, 1);
})()
