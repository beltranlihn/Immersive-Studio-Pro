import { evalInApp } from './cdp.mjs';
const r = await evalInApp(`(async function(){
  const act=activeSeq();
  const vis=state.clips.filter(c=>101.3>=c.start&&101.3<c.start+c.dur).map(c=>({n:c.name,lane:c.lane,kind:state.lanes[c.lane]&&state.lanes[c.lane].kind,m:(mediaById(c.mediaId)||{}).name,mm:(mediaById(c.mediaId)||{}).missing}));
  const nests=state.media.filter(m=>m.kind==='nest'&&m.comp).map(m=>({n:m.name,els:(m.nestClips||[]).length,medias:(m.comp.mediaIds||[]).map(id=>{const x=mediaById(id);return x?x.name+(x.missing?'(MISS)':''):'?'+id;})}));
  const imgs=state.media.filter(m=>m.kind==='image').map(m=>({n:m.name,missing:m.missing,tex:!!m.tex,el:!!(m.el&&(m.el.naturalWidth||m.el.width))}));
  render(); await new Promise(r=>requestAnimationFrame(r));
  return {act:act&&act.name, lanes:state.lanes.map(l=>l.tag||l.kind), vis, nests, imgs, ph:state.playhead};
})()`, { port: 9223, timeout: 60000 });
console.log(JSON.stringify(r, null, 1));
