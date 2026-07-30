import { connect } from './r227-lib.mjs';
const { evalExpr, shot, wait, ws } = await connect();
const fmt=process.argv[2]||'dome';
await evalExpr(`startDemoProject(${JSON.stringify(fmt)})`);
await wait(1200);
const st = await evalExpr(`(function(){
  const seq=activeSeq();
  const lanes=state.lanes.map((l,i)=>({i,tag:l.tag,name:l.name,kind:l.kind}));
  const clips=state.clips.map(c=>{ const m=mediaById(c.mediaId); return {name:c.name,kind:m?m.kind:'?',lane:c.lane,start:+c.start.toFixed(2),dur:+c.dur.toFixed(2),
    kf:Object.keys(c.kf||{}).map(k=>k+'×'+c.kf[k].length), anim:(c.anim||[]).map(a=>a.param+':'+a.mode+'@'+a.speed), fx:(c.fx||[]).map(f=>f.type+'(int'+f.int+'/amt'+f.amt+')'),
    props:{az:c.props.az,el:c.props.el,size:c.props.size,x:c.props.x,y:c.props.y,scale:c.props.scale} }; });
  const nest=state.media.find(m=>m.kind==='nest'&&m.id!==state.activeSeqId&&(m.nestClips||[]).length);
  return { seqMode:state.seqMode, seqName:seq&&seq.name, seqW:state.seqW, seqH:state.seqH, dirty:state.dirty, path:(typeof currentPath!=='undefined'?currentPath:'?'),
    undo:(typeof _undo!=='undefined'&&_undo)?_undo.length:'n/a', playhead:state.playhead, refs:_demoRefs, lanes, clips,
    nest: nest?{name:nest.name,mode:nest.mode,w:nest.w,h:nest.h,dur:+nest.dur.toFixed(2),inner:(nest.nestClips||[]).map(c=>({lane:c.lane,start:+c.start.toFixed(2),dur:+c.dur.toFixed(2),props:{az:c.props.az,el:c.props.el,x:c.props.x,y:c.props.y}}))}:null,
    domClips: document.querySelectorAll('#tracks .clip').length, pps:+state.tl.pxPerSec.toFixed(1) };
})()`);
console.log(JSON.stringify(st,null,1));
console.log(await shot('b-'+fmt+'-editor.png'));
console.log('errs:', JSON.stringify(await evalExpr(`window.__errs`)));
ws.close();
