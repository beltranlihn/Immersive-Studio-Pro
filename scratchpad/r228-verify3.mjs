// [R228] parte 2 — trampa de la puerta única del launcher.
// NOTA: `DSP` viene de contextBridge y está CONGELADO → no se puede sustituir `DSP.openDialog` por un doble. El
// «cancelar el selector de archivos» se reproduce llamando a `confirmDiscard(lchConsent())` —que es exactamente lo
// único que `openProject` hace ANTES de abrir el selector— y comprobando después que el consentimiento sigue vivo:
// eso es la regresión que se arregla (antes lo consumía esa misma llamada aunque el selector se cancelara luego).
import { evalInApp } from './cdp.mjs';
const run = async (k, e) => { const v = await evalInApp(e, { timeout: 30000 }); console.log('· ' + k + ' → ' + JSON.stringify(v)); return v; };

const H = `
  window.__H=window.__H||{};
  if(!window.__H.on){ window.__H.on=1; window.__H.pregs=[];
    window.__H.oC=window.appConfirm; window.__H.oC3=window.appConfirm3;
    window.appConfirm=function(msg,cb,opts){ window.__H.pregs.push('confirm'); if(window.__H.autoC!==undefined){ const v=window.__H.autoC; setTimeout(()=>cb&&cb(v),0); return Promise.resolve(v); } return window.__H.oC.apply(this,arguments); };
    window.appConfirm3=function(msg,opts){ window.__H.pregs.push('confirm3'); if(window.__H.autoC3!==undefined)return Promise.resolve(window.__H.autoC3); return window.__H.oC3.apply(this,arguments); };
  }
  const Q=window.__H;
  const snap=()=>({lch:lchShowing(), back:!!document.getElementById('lchBack'), volver:_lchVolver, consent:lchConsent(), dirty:state.dirty, pregs:Q.pregs.slice(), seq:(activeSeq()||{}).name});
`;

await run('setup-proyecto-sucio', `(async()=>{ ${H}
  Q.pregs=[]; Q.autoC=undefined; Q.autoC3=undefined;
  if(lchShowing()){ _lchVolver=false; if(_lch)_lch.discardOk=false; hideLanding(); }
  if(!state.clips.length){ Q.autoC=true; await newProject('dome',2048,2048,60,180); Q.autoC=undefined; }
  markDirty(); return snap(); })()`);

await run('paso1-NewProject+Descartar', `(async()=>{ ${H}
  Q.pregs=[]; Q.autoC3='discard'; await newProjectViaLanding(); Q.autoC3=undefined;
  return snap(); })()`);

await run('paso2-Open-cancelado-NO-gasta-el-consentimiento', `(async()=>{ ${H}
  Q.pregs=[];
  const paso=await confirmDiscard(lchConsent());   // lo único que openProject hace antes del selector
  // …y el usuario cierra el selector sin elegir → openProject vuelve sin tocar nada más
  return Object.assign(snap(),{confirmDiscardDijo:paso}); })()`);

await run('paso3-Create-NO-vuelve-a-preguntar', `(async()=>{ ${H}
  Q.pregs=[]; Q.autoC=undefined; Q.autoC3=undefined;   // cualquier pregunta que salga es REAL y se registra
  _lch.ptype='dome'; _lch.pname='Trampa'; lchCreate();
  await new Promise(r=>setTimeout(r,1200));
  return Object.assign(snap(),{seqMode:state.seqMode, dialogosAbiertos:[...document.querySelectorAll('#confirmOv,#confirm3Ov')].map(o=>o.id)}); })()`);

// ---- cancelar la creación: el launcher CONSERVA «Back to project» y volver funciona ----
await run('paso4-cancelar-la-creacion', `(async()=>{ ${H}
  Q.pregs=[]; Q.autoC=undefined; Q.autoC3='discard'; markDirty(); await newProjectViaLanding(); Q.autoC3=undefined;
  const antes=snap();
  _lch.discardOk=false;                 // se fuerza el camino en que confirmDiscard SÍ pregunta
  Q.autoC=false;                        // …y el usuario cancela
  _lch.ptype='flat'; lchCreate(); await new Promise(r=>setTimeout(r,900)); Q.autoC=undefined;
  return {antes, despues:snap()}; })()`);

await run('paso5-cancelar-un-demo', `(async()=>{ ${H}
  Q.pregs=[]; _lch.discardOk=false; Q.autoC=false;
  await startDemoProject('room'); Q.autoC=undefined;
  return snap(); })()`);

await run('paso6-Back-to-project-sigue-funcionando', `(async()=>{ ${H}
  const b=document.getElementById('lchBack'); if(!b)return {err:'NO hay Back to project — la trampa sigue'};
  b.click(); await new Promise(r=>setTimeout(r,250));
  return Object.assign(snap(),{seqMode:state.seqMode, titulo:document.title}); })()`);

await run('errs', `(window.__errs||[])`);
