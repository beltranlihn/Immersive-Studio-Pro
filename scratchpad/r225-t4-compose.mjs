// [R225·7/·8] Duración de compose por contenido · acortar dentro acorta la instancia · audio enlazado se elimina
import { evalInApp } from './cdp.mjs';
const expr = `(async function(){
  const R={};
  const seq=mediaById(state.activeSeqId);
  const V8=state.media.find(m=>m.name==='A8s.mp4'), V3=state.media.find(m=>m.name==='B3s.mp4');
  const F1=state.media.find(m=>m.name==='Foto1.jpg'), F2=state.media.find(m=>m.name==='Foto2.jpg');
  R.duraciones={ V8:V8.dur, V3:V3.dur, F1:F1.dur, F2:F2.dur };
  // ---------- A) compose desde 2 vídeos (8 s y 3 s) → 8 s ----------
  R.compVideos=+compSrcDur([V8,V3]).toFixed(2);
  // ---------- B) compose desde 2 fotos → 5 s ----------
  R.compFotos=+compSrcDur([F1,F2]).toFixed(2);
  R.compFotoYVideo=+compSrcDur([F1,V3]).toFixed(2);
  R.compTextoYFoto=+compSrcDur([F1,{kind:'text',dur:6}]).toFixed(2);   // antes ganaba el 6 nominal del texto
  // creación real por el camino de createComposition
  const limpia=()=>{ state.clips=[]; state.lanes=[{id:uid(),name:'Audio 1',tag:'A1',kind:'audio'},{id:uid(),name:'Video 1',tag:'V1',kind:'video'}]; };
  limpia(); state.playhead=0;
  const n1=createComposition({kind:'ring',count:4,mediaIds:[V8.id,V3.id],size:40,el:30});
  R.creadoVideos={ nestDur:+n1.dur.toFixed(2), instancia:+selClip().dur.toFixed(2), fulldome:selClip().props.fulldome };
  limpia(); state.playhead=0;
  const n2=createComposition({kind:'ring',count:4,mediaIds:[F1.id,F2.id],size:40,el:30});
  R.creadoFotos={ nestDur:+n2.dur.toFixed(2), instancia:+selClip().dur.toFixed(2) };
  // ---------- C) acortar el contenido DENTRO acorta la instancia del padre ----------
  limpia(); state.playhead=0;
  const n3=createComposition({kind:'ring',count:3,mediaIds:[V8.id],size:40,el:30});
  const inst=selClip(); const padre=state.activeSeqId;
  R.antesDeEntrar={ nestDur:+n3.dur.toFixed(2), instancia:+inst.dur.toFixed(2) };
  openSeq(n3.id);                                  // entra al nest
  for(const c of state.clips) c.dur=4;             // se acorta TODO el contenido a 4 s
  switchSeq(padre);                                // vuelve al padre
  const inst2=state.clips.find(c=>c.id===inst.id);
  R.alVolver={ nestDur:+mediaById(n3.id).dur.toFixed(2), instancia:inst2?+inst2.dur.toFixed(2):null, seqDur:+seqDur(mediaById(n3.id)).toFixed(2) };
  R.seAcorto=(inst2&&inst2.dur<=4.001);
  // ---------- D) compose desde clips CON audio enlazado → el audio se elimina ----------
  limpia();
  const P=()=>({az:0,el:30,size:55,rot:0,spin:0,opacity:100,blur:0,feather:0,crop:0,exposure:0,contrast:0,saturation:0,temperature:0,tint:0,glow:0,chroma:0,x:0,y:0,scale:100,volume:100,fulldome:false,fisheye:false,equirect:false,mask:'none',blend:'normal'});
  state.lanes=[{id:uid(),name:'Audio 1',tag:'A1',kind:'audio'},{id:uid(),name:'Video 1',tag:'V1',kind:'video'},{id:uid(),name:'Video 2',tag:'V2',kind:'video'}];
  const lk1=uid(), lk2=uid();
  const v1={id:uid(),mediaId:V8.id,lane:1,start:0,dur:5,inP:0,name:'V8',props:P(),kf:{},fx:[],link:lk1,avRole:'v'};
  const a1={id:uid(),mediaId:V8.id,lane:0,start:0,dur:5,inP:0,name:'V8 audio',props:{volume:100},kf:{},fx:[],link:lk1,avRole:'a'};
  const v2={id:uid(),mediaId:V3.id,lane:2,start:0,dur:3,inP:0,name:'V3',props:P(),kf:{},fx:[],link:lk2,avRole:'v'};
  const a2={id:uid(),mediaId:V3.id,lane:0,start:5.2,dur:3,inP:0,name:'V3 audio',props:{volume:100},kf:{},fx:[],link:lk2,avRole:'a'};
  state.clips.push(v1,a1,v2,a2);
  R.antesDeComponer={ clips:state.clips.length, enPistaAudio:state.clips.filter(c=>state.lanes[c.lane].kind==='audio').length };
  state.selIds=[v1.id,v2.id]; state.selId=v1.id;
  nestSelection();
  const nn=mediaById(selClip().mediaId);
  R.trasComponer={ clips:state.clips.length, enPistaAudio:state.clips.filter(c=>state.lanes[c.lane].kind==='audio').length,
    nestLanesKinds:(nn.nestLanes||[]).map(l=>l.kind), nestClips:(nn.nestClips||[]).map(c=>({name:c.name,avRole:c.avRole,link:c.link!=null})),
    nestTieneAudioDentro:nestHasInnerAudio(nn), derivados:state.clips.filter(c=>isNestAudioClip(c)).length };
  // ¿suena algo el nest? (mezcla del padre) → 0 eventos
  R.eventosAudio=collectAudioEvents(state.clips,state.lanes,0,0,Infinity,0,[]).length;
  return {R, errs:window.__errs};
})()`;
evalInApp(expr).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error('ERR',e.message);process.exit(1);});
