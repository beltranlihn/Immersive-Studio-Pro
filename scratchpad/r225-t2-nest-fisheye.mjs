// [R225·2/·3] Nest siempre dome master (sin toggle, sin equirect) · Fisheye sólo con fulldome src
import { evalInApp } from './cdp.mjs';
const expr = `(async function(){
  const R={}; const txtOf=s=>(s||'').replace(/\\s+/g,' ').trim();
  // ---------- 1) crear un nest desde 2 clips ----------
  state.clips=[]; state.lanes=[{id:uid(),name:'Audio 1',tag:'A1',kind:'audio'},{id:uid(),name:'Video 1',tag:'V1',kind:'video'},{id:uid(),name:'Video 2',tag:'V2',kind:'video'}];
  const sh=state.media.filter(m=>m.kind==='shape'); const s1=sh[0], s2=sh[1]||sh[0];
  const P=(az)=>({az,el:25,size:60,rot:0,spin:0,opacity:100,blur:0,feather:0,crop:0,exposure:0,contrast:0,saturation:0,temperature:0,tint:0,glow:0,chroma:0,x:0,y:0,scale:100,volume:100,fulldome:false,fisheye:false,equirect:false,mask:'none',blend:'normal'});
  const c1={id:uid(),mediaId:s1.id,lane:1,start:0,dur:5,inP:0,name:'S1',props:P(-60),kf:{},fx:[]};
  const c2={id:uid(),mediaId:s2.id,lane:2,start:0,dur:5,inP:0,name:'S2',props:P(60),kf:{},fx:[]};
  state.clips.push(c1,c2); state.selIds=[c1.id,c2.id]; state.selId=c1.id;
  nestSelection();
  const nc=selClip(); const nm=mediaById(nc.mediaId);
  R.nest={ esNest:isSeqMedia(nm), fulldome:nc.props.fulldome, equirect:nc.props.equirect, dur:nc.dur, modo:nm.mode };
  renderInspector();
  R.sinToggle = !document.querySelector('#domeModeSeg');
  R.sourceFilas=[...document.querySelectorAll('#sourceRows .prow')].map(r=>({txt:txtOf(r.textContent).slice(0,42),ids:[...r.querySelectorAll('[id]')].map(e=>e.id),op:r.style.opacity||''}));
  R.equirectPresente = !!document.querySelector('#eqToggle');
  R.fisheyePresente  = !!document.querySelector('#fhToggle');
  R.fisheyeHabilitadoEnNest = !!(document.querySelector('#fhToggle') && document.querySelector('#fhToggle').getAttribute('aria-disabled')!=='true');
  // ---------- 2) clip normal: fisheye deshabilitado sin fulldome, habilitado con él ----------
  state.selId=c1.id; state.selIds=[c1.id];
  const cc=clipById(c1.id) || (mediaById(state.activeSeqId).nestClips||[])[0];
  // el clip c1 se fue dentro del nest → se usa un clip nuevo de nivel superior
  const c3={id:uid(),mediaId:s1.id,lane:1,start:6,dur:4,inP:0,name:'S3',props:P(0),kf:{},fx:[]};
  state.clips.push(c3); state.selId=c3.id; state.selIds=[c3.id]; renderTimeline(); renderInspector();
  const leerFh=()=>{ const b=document.querySelector('#fhToggle'); const row=b&&b.closest('.prow');
    return { existe:!!b, deshabilitado:!!(b&&b.getAttribute('aria-disabled')==='true'), pointer:b?b.style.pointerEvents:'', opacidad:row?row.style.opacity:'', titulo:row?row.title:'' }; };
  R.fhSinFulldome=leerFh();
  // encender fulldome por el interruptor real
  document.querySelector('#fdToggle').click();
  R.trasEncenderFulldome={ fulldome:selClip().props.fulldome, fh:leerFh() };
  // encender fisheye y luego APAGAR fulldome → el fisheye tiene que caer también
  document.querySelector('#fhToggle').click();
  R.fisheyeEncendido=selClip().props.fisheye;
  R.amountVisible=!!document.querySelector('#fhAmt');
  document.querySelector('#fdToggle').click();
  R.trasApagarFulldome={ fulldome:selClip().props.fulldome, fisheye:selClip().props.fisheye, fh:leerFh(), amount:!!document.querySelector('#fhAmt') };
  return {R, errs:window.__errs};
})()`;
evalInApp(expr).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error('ERR',e.message);process.exit(1);});
