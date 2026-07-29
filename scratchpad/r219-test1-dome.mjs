import { evalInApp } from './cdp.mjs';

const expr = `
(async () => {
  await newProject('dome', 2048, 2048, 30, 180);
  const paths = [
    'C:\\\\Users\\\\beltr\\\\Downloads\\\\REEL EMPRESES.mp4',
    'C:\\\\Users\\\\beltr\\\\Downloads\\\\clip_free spinning_5_chr2_rxl1.mp4',
    'C:\\\\Users\\\\beltr\\\\Downloads\\\\222222_edit.mp4',
    'C:\\\\Users\\\\beltr\\\\Downloads\\\\clip_free spinning.mp4'
  ];
  const ids = [];
  for (const p of paths) {
    const m = await addVideoFromPath(p, p.split(/[\\\\/]/).pop());
    ids.push(m && m.id);
  }
  const vlanes = state.lanes.map((l,i)=>({l,i})).filter(x=>x.l.kind==='video').map(x=>x.i);
  for (let i=0;i<ids.length;i++) { const id=ids[i]; if(!id) continue; const m=state.media.find(x=>x.id===id); addClip(m, vlanes[i % vlanes.length], 0); }
  // jump into 3D view IMMEDIATELY after adding clips
  document.querySelector('#viewModeSeg button[data-v="3d"]').click();
  return { media: state.media.map(m=>({id:m.id,kind:m.kind,w:m.w,h:m.h})), clips: state.clips.length, mode: state.view.mode, warming: mediaWarming() };
})()
`;

const r = await evalInApp(expr, { timeout: 60000 });
console.log(JSON.stringify(r, null, 2));
