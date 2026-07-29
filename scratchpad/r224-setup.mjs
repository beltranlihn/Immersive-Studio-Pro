import { evalInApp } from './cdp.mjs';
const expr = `(async function(){
  window.__errs = window.__errs || [];
  if(!window.__errHook){ window.__errHook=1; window.addEventListener('error',e=>window.__errs.push(String(e.message))); window.addEventListener('unhandledrejection',e=>window.__errs.push('rej:'+String(e.reason))); }
  // cerrar landing / tour si están
  try{ if(typeof closeLanding==='function')closeLanding(); }catch(_){}
  document.querySelectorAll('.lch, #tourOv, .tourcard').forEach(el=>el.remove());
  state.seqMode='dome';
  // OJO: no se pisa state.media — la secuencia activa (media kind:'nest') tiene que seguir ahí o serProject/loadProject no cierran el círculo
  state.media = (state.media||[]).filter(m=>m.kind==='nest');
  // reparar el contador de ids si una corrida previa lo dejó en NaN (ids de media como texto envenenaban _id en loadProject)
  if(!Number.isFinite(uid())) _id=1000;
  for(const m of state.media) if(!Number.isFinite(m.id)) m.id=uid();
  state.openSeqs=state.media.filter(m=>m.kind==='nest').map(m=>m.id); state.activeSeqId=state.openSeqs[0];
  const MV1=uid(), MV2=uid();
  const vm1 = {id:MV1, kind:'video', name:'VideoA.mp4', w:1920,h:1080, dur:10, fps:30, path:'C:/fake/VideoA.mp4', thumb:null, buffer:null, proxyReady:false};
  const vm2 = {id:MV2, kind:'video', name:'VideoB.mp4', w:1920,h:1080, dur:10, fps:30, path:'C:/fake/VideoB.mp4', thumb:null, buffer:null, proxyReady:false};
  state.media.push(vm1, vm2);
  state.lanes = [
    {id:'lv1', name:'Video 1', tag:'V1', kind:'video', h:64},
    {id:'lv2', name:'Video 2', tag:'V2', kind:'video', h:64},
    {id:'la1', name:'Audio 1', tag:'A1', kind:'audio'}
  ];
  const P=()=>({az:0,el:35,size:55,rot:0,spin:0,opacity:100,blur:0,feather:0,crop:0,exposure:0,contrast:0,saturation:0,temperature:0,tint:0,glow:0,chroma:0,x:0,y:0,scale:100,volume:100});
  const cA = {id:uid(), mediaId:MV1, lane:0, start:0, dur:5, inP:0, name:'VideoA', props:P(), kf:{}, fx:[], fadeIn:0.8, fadeOut:1.2};
  const cB = {id:uid(), mediaId:MV2, lane:1, start:1, dur:5, inP:0, name:'VideoB', props:P(), kf:{}, fx:[], fadeIn:0, fadeOut:0};
  state.clips=[cA,cB];
  // Motion "Spin" + Effect glitch en cA
  addAnimPreset(cA,'spin');
  addFxToClip ? null : null;
  if(!cA.fx)cA.fx=[];
  cA.fx.push(newFx('glitch'));
  state.markers=[]; state.selId=cA.id; state.selIds=[cA.id]; state.selLane=null; state.selMarkerId=null; state.selGroupId=null;
  state.playhead=2;
  renderTimeline(); renderInspector(); render();
  const gl=cA.fx[0];
  return {
    ok:true, seqMode:state.seqMode, isFlat:isFlat(),
    clipA:cA.id, clipB:cB.id,
    anim:cA.anim.map(a=>({param:a.param,mode:a.mode,mixBase:cA.props['mot:'+a.param+':mix']})),
    fx:{type:gl.type, params:(FXBY[gl.type].params||[]).map(p=>p.k)},
    fxtypes: Object.keys(FXBY).slice(0,40),
    errs: window.__errs
  };
})()`;
evalInApp(expr).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error('ERR',e.message);process.exit(1);});
