import { evalInApp } from './cdp.mjs';
import { capture } from './cap.mjs';
const run = e => evalInApp('(function(){' + e + '})()');
const shot = async n => { await capture('../r225/' + n); console.log('shot', n); };

// texto grande y a la vista, con la sección Clip DESPLEGADA (para ver que no hay campos de píxeles)
await run(`
  const tc=state.clips.find(c=>{const m=mediaById(c.mediaId); return m&&m.kind==='text';});
  tc.start=0; tc.dur=6; tc.props.size=100; tc.props.el=35; tc.props.az=0;
  state.selId=tc.id; state.selIds=[tc.id]; state.playhead=2;
  const st=insColState(); st.clip=false; st.tf=true;
  renderTimeline(); renderInspector(); render(); return 1;`);
await shot('10-texto-clip-desplegado-sin-pixeles');
await run(`const st=insColState(); st.clip=true; st.tf=false; renderInspector(); return 1;`);

// nest CON audio dentro → clip derivado en el padre
await run(`
  state.clips=[]; state.lanes=[{id:uid(),name:'Audio 1',tag:'A1',kind:'audio'},{id:uid(),name:'Video 1',tag:'V1',kind:'video'}];
  const sh=state.media.find(m=>m.kind==='shape');
  const P=()=>({az:0,el:30,size:60,rot:0,spin:0,opacity:100,blur:0,feather:0,crop:0,exposure:0,contrast:0,saturation:0,temperature:0,tint:0,glow:0,chroma:0,x:0,y:0,scale:100,volume:100,fulldome:false,fisheye:false,equirect:false,mask:'none',blend:'normal'});
  const c1={id:uid(),mediaId:sh.id,lane:1,start:0,dur:6,inP:0,name:'S',props:P(),kf:{},fx:[]};
  state.clips.push(c1); state.selIds=[c1.id]; state.selId=c1.id; nestSelection();
  const nest=mediaById(selClip().mediaId), padre=state.activeSeqId;
  openSeq(nest.id);
  const am=state.media.find(m=>m.kind==='audio');
  const la=state.lanes.findIndex(l=>l.kind==='audio');
  state.clips.push({id:uid(),mediaId:am.id,lane:la,start:0,dur:am.dur,inP:0,name:am.name,color:am.color,fadeIn:0,fadeOut:0,props:{volume:100},kf:{},fx:[]});
  renderTimeline(); return 1;`);
await shot('11-dentro-del-nest-con-pista-de-audio');
await run(`const padre=state.openSeqs[0]; switchSeq(padre); state.tl.pxPerSec=110; renderTimeline(); scheduleWaves(); return 1;`);
await new Promise(r=>setTimeout(r,350));
await shot('12-padre-con-el-clip-de-audio-derivado');
await run(`const d=state.clips.find(isNestAudioClip); state.selId=d.id; state.selIds=[d.id]; renderInspector(); return 1;`);
await shot('13-inspector-del-derivado');
console.log('listo');
