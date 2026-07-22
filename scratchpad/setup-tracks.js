(async () => {
  const blob = await (await fetch('assets/media/nebula.png')).blob();
  const ab = await (await fetch('assets/media/aurora.png')).blob();
  if (!state.media.some(m => m.name === 'nebula.png')) importFiles([new File([blob], 'nebula.png', { type: 'image/png' })]);
  await new Promise(r => setTimeout(r, 1200));
  // 6 video lanes + 5 audio lanes so both columns overflow
  state.lanes = [];
  for (let i = 1; i <= 6; i++) state.lanes.push({ id: uid(), name: 'Video ' + i, tag: 'V' + i, kind: 'video' });
  for (let i = 1; i <= 5; i++) state.lanes.push({ id: uid(), name: 'Audio ' + i, tag: 'A' + i, kind: 'audio' });
  const md = state.media.find(m => m.name === 'nebula.png');
  state.clips = [];
  for (let i = 0; i < 6; i++) state.clips.push(Object.assign(makeClip ? makeClip(md, i, i * 0.5) : {}, {}));
  renderTimeline(); render();
  return JSON.stringify({ lanes: state.lanes.length, clips: state.clips.length, audioH: state.tl.audioH });
})()
