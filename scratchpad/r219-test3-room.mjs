import { evalInApp } from './cdp.mjs';

const expr = `
(async () => {
  hideLanding();
  const cfg = {
    walls: [
      {role:'Front',order:1,wcm:500,hcm:300,pxW:1920,pxH:1080},
      {role:'Right',order:2,wcm:400,hcm:300,pxW:1920,pxH:1080},
      {role:'Back',order:3,wcm:500,hcm:300,pxW:1920,pxH:1080},
      {role:'Left',order:4,wcm:400,hcm:300,pxW:1920,pxH:1080}
    ],
    floor: {pxW:1920,pxH:1080},
    fps: 30
  };
  await newRoomProject(cfg);
  const paths = [
    'C:\\\\Users\\\\beltr\\\\Downloads\\\\222222_edit.mp4',
    'C:\\\\Users\\\\beltr\\\\Downloads\\\\clip_free spinning_5_chr2_rxl1.mp4'
  ];
  const ids = [];
  for (const p of paths) {
    const m = await addVideoFromPath(p, p.split(/[\\\\/]/).pop());
    ids.push(m && m.id);
  }
  // clip 0 -> wall strip (active sequence, state.clips), lane 0 (Video 1)
  const m0 = state.media.find(x=>x.id===ids[0]);
  addClip(m0, state.lanes.findIndex(l=>l.kind==='video'), 0);
  // clip 1 -> floor sequence's nestClips
  const seq = activeSeq(); const room = seq && seq.room;
  const fm = mediaById(room.floorSeqId);
  const m1 = state.media.find(x=>x.id===ids[1]);
  const c1 = makeClip(m1, 0, 0);
  fm.nestClips = fm.nestClips || [];
  fm.nestClips.push(c1);
  document.querySelector('#viewModeSeg button[data-v="3d"]').click();
  return { clips: state.clips.length, floorClips: (fm.nestClips||[]).length, mode: state.view.mode, seqMode: state.seqMode, warming: mediaWarming() };
})()
`;

const r = await evalInApp(expr, { timeout: 60000 });
console.log(JSON.stringify(r, null, 2));
