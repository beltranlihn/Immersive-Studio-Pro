// [R225·9] Audio de composición: clip DERIVADO en el padre · regla de oro · deslinkear · acortar · ida y vuelta por .isp
import { evalInApp } from './cdp.mjs';
const expr = `(async function(){
  const R={};
  const V8=state.media.find(m=>m.name==='A8s.mp4'), MU=state.media.find(m=>m.kind==='audio');
  const P=()=>({az:0,el:30,size:55,rot:0,spin:0,opacity:100,blur:0,feather:0,crop:0,exposure:0,contrast:0,saturation:0,temperature:0,tint:0,glow:0,chroma:0,x:0,y:0,scale:100,volume:100,fulldome:false,fisheye:false,equirect:false,mask:'none',blend:'normal'});
  // ---------- partida limpia: un nest de un solo vídeo, sin audio ----------
  state.clips=[]; state.lanes=[{id:uid(),name:'Audio 1',tag:'A1',kind:'audio'},{id:uid(),name:'Video 1',tag:'V1',kind:'video'}];
  state.playhead=0;
  const sh=state.media.find(m=>m.kind==='shape');
  const c1={id:uid(),mediaId:sh.id,lane:1,start:0,dur:6,inP:0,name:'S',props:P(),kf:{},fx:[]};
  state.clips.push(c1); state.selIds=[c1.id]; state.selId=c1.id;
  nestSelection();
  const inst=selClip(), nest=mediaById(inst.mediaId), padre=state.activeSeqId;
  R.paso0={ derivados:state.clips.filter(isNestAudioClip).length, nestTieneAudio:nestHasInnerAudio(nest), eventos:collectAudioEvents(state.clips,state.lanes,0,0,Infinity,0,[]).length };
  // ---------- 1) ENTRAR al nest y añadirle una pista de audio con un clip ----------
  openSeq(nest.id);
  state.lanes.unshift({id:uid(),name:'Audio 1',tag:'A1',kind:'audio'}); for(const c of state.clips)c.lane++;
  const ia={id:uid(),mediaId:MU.id,lane:0,start:0,dur:MU.dur,inP:0,name:MU.name,color:MU.color,fadeIn:0,fadeOut:0,props:{volume:100},kf:{},fx:[]};
  state.clips.push(ia);
  R.dentro={ lanes:state.lanes.map(l=>l.kind), clips:state.clips.length, eventosDentro:collectAudioEvents(state.clips,state.lanes,0,0,Infinity,0,[]).length };
  // ---------- 2) VOLVER al padre → aparece el clip derivado ----------
  switchSeq(padre);
  const der=state.clips.filter(isNestAudioClip);
  const iv=state.clips.find(c=>c.id===inst.id);
  R.alVolver={ derivados:der.length,
    derivado: der[0]?{ id:der[0].id, mediaId:der[0].mediaId, esElNest:der[0].mediaId===nest.id, lane:der[0].lane, laneKind:state.lanes[der[0].lane].kind,
      start:der[0].start, dur:der[0].dur, link:der[0].link, avRole:der[0].avRole, nestAudioOf:der[0].nestAudioOf, nombre:der[0].name }:null,
    videoLink:iv&&iv.link, videoRole:iv&&iv.avRole, sonPareja: !!(der[0]&&iv&&der[0].link===iv.link),
    partnerDelVideo: (iv&&linkPartner(iv))?linkPartner(iv).id:null };
  // ---------- 3) REGLA DE ORO: la mezcla suena SÓLO por el derivado ----------
  const ev=()=>collectAudioEvents(state.clips,state.lanes,0,0,Infinity,0,[]);
  R.mezcla={ eventos:ev().length, ids:ev().map(e=>e.id) };
  R.sueneSoloPorElDerivado = ev().length>0 && ev().every(e=>{ const c=state.clips.find(x=>x.id===e.id); return !c; }); // los eventos vienen de clips INTERNOS del nest, alcanzados a través del derivado
  // mutear la PISTA del derivado lo silencia
  state.lanes[der[0].lane].mute=true; R.conPistaMuteada=ev().length; state.lanes[der[0].lane].mute=false;
  // y quitar el derivado deja el nest MUDO (nada suena desde una pista de vídeo)
  const guardado=state.clips.filter(isNestAudioClip); state.clips=state.clips.filter(c=>!isNestAudioClip(c));
  R.sinDerivado=ev().length; state.clips.push(...guardado);
  R.conDerivado=ev().length;
  // el <audio> del proxy tampoco puede sonar: vinstAudio devuelve null para nests
  R.vinstAudioDeNest = vinstAudio({ael:null}, nest);
  // ---------- 4) el derivado ENTRA al nest con doble clic (mismo camino que el clip de vídeo) ----------
  R.doblarClicEntra = isSeqMedia(mediaById(der[0].mediaId));
  // ---------- 5) DESLINKEAR funciona ----------
  unlinkClip(der[0]);
  const d2=state.clips.filter(isNestAudioClip)[0], v2=state.clips.find(c=>c.id===inst.id);
  R.trasDeslinkear={ derivadoLink:d2.link, videoLink:v2.link, derivadoSigue:!!d2, sigueSonando:ev().length, nestSiguePorVideo:false };
  linkClips(v2,d2);
  // ---------- 6) acortar el contenido dentro acorta AMBOS ----------
  openSeq(nest.id); for(const c of state.clips)c.dur=Math.min(c.dur,3); switchSeq(padre);
  const iv3=state.clips.find(c=>c.id===inst.id), d3=state.clips.filter(isNestAudioClip)[0];
  R.trasAcortar={ nestDur:+mediaById(nest.id).dur.toFixed(2), video:+iv3.dur.toFixed(2), derivado:d3?+d3.dur.toFixed(2):null };
  // ---------- 7) ida y vuelta por serialización ----------
  const obj=JSON.parse(JSON.stringify(serProject()));
  const enIsp=[]; for(const m of obj.media){ if(m.kind==='nest')for(const c of (m.nestClips||[])) if(c.nestAudioOf!=null)enIsp.push({seq:m.id,id:c.id,nestAudioOf:c.nestAudioOf,link:c.link,avRole:c.avRole}); }
  R.serializado=enIsp;
  // ---------- 8) el proxy de composición conserva el audio: el camino de ncBuild es runExport({seqId:nest}) ----------
  { const nl=(nest.nestLanes||[]); const ev2=collectAudioEvents(nest.nestClips,nl,0,0,Infinity,0,[]);
    R.proxyConservaAudio={ eventosAlHornear:ev2.length, pistasAudioDelNest:nl.filter(l=>l.kind==='audio').length }; }
  renderTimeline(); renderInspector(); render();
  return {R, errs:window.__errs};
})()`;
evalInApp(expr).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error('ERR',e.message);process.exit(1);});
