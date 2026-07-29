import { evalInApp } from './cdp.mjs';
const expr = `(async function(){
  window.__errs=[]; const out={};
  const A=()=>state.clips.find(c=>c.lane===0);
  { const c=A(), lane=state.lanes[0], f=c.fx&&c.fx[0];
    c.kf['mot:spin:mix']=[{t:0,v:0,e:'linear'},{t:4,v:100,e:'linear'}];
    if(f)c.kf['fx:'+f.id+':block']=[{t:0,v:2,e:'linear'},{t:4,v:18,e:'linear'}];
    c.kf['saturation']=[{t:0,v:0,e:'linear'},{t:3,v:60,e:'linear'}];
    lane._autoP='mot:spin:mix'; if(!state.inlineCurves)toggleCurves(); renderTimeline();
    out.before={kf:Object.keys(c.kf).sort(), mixBase:c.props['mot:spin:mix'], autoP:lane._autoP, wet_mid:Math.round(evalWet(c,c.anim[0],c.start+2)*1000)/1000, anim:c.anim.length}; }
  const json=JSON.stringify(serProject());
  out.jsonHasMot=json.indexOf('mot:spin:mix')>=0;
  loadProject(JSON.parse(json));
  await new Promise(r=>setTimeout(r,300));
  { const c=A(), lane=state.lanes[0];
    out.after={kf:Object.keys(c.kf).sort(), mixBase:c.props['mot:spin:mix'], autoP:lane._autoP, wet_mid:Math.round(evalWet(c,c.anim[0],c.start+2)*1000)/1000, anim:c.anim.length,
      chips:(function(){const h=document.querySelector('#laneHeaders .lanehdr[data-lane="0"]');return h?{cat:h.querySelector('.acat .alab').textContent,par:h.querySelector('.apac .alab').textContent}:null;})(),
      inlineCurves:!!state.inlineCurves}; }
  // ---- proyecto LEGACY: a.wetKf en 0..1 debe migrar a mot:<param>:mix en 0..100
  { const o=JSON.parse(json); const pools=[o.clips||[]].concat((o.media||[]).filter(m=>m.nestClips).map(m=>m.nestClips)).concat((o.sequences||[]).map(s=>s.clips||[]));
    let nc=null; for(const p of pools){ const f=p.find(c=>c.anim&&c.anim.length); if(f){nc=f;break;} }
    out.legacyFound=!!nc; if(!nc){ out.pools=pools.map(p=>p.length); out.errs=window.__errs; return out; }
    nc.kf=nc.kf||{}; nc.props=nc.props||{}; delete nc.kf['mot:spin:mix']; delete nc.props['mot:spin:mix'];
    nc.anim[0].wetKf=[{t:0,v:0,e:'linear'},{t:4,v:0.5,e:'linear'}];
    loadProject(o); await new Promise(r=>setTimeout(r,300)); renderTimeline();
    const c=A(); out.legacy={kf:(c.kf['mot:spin:mix']||[]).map(k=>[k.t,k.v]), wetKf:c.anim[0].wetKf===undefined, wet_at4:Math.round(evalWet(c,c.anim[0],c.start+4)*1000)/1000, base:c.props['mot:spin:mix']}; }
  out.errs=window.__errs;
  return out;
})()`;
evalInApp(expr).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error('ERR',e.message);process.exit(1);});
