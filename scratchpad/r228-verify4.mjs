// [R228] parte 3 — diálogos (Enter con el botón ENFOCADO, Esc, appConfirm de 2 botones) + regresión general.
import { evalInApp } from './cdp.mjs';
const run = async (k, e) => { const v = await evalInApp(e, { timeout: 60000 }); console.log('· ' + k + ' → ' + JSON.stringify(v)); return v; };

const K = `const kd=(k)=>document.dispatchEvent(new KeyboardEvent('keydown',{key:k,bubbles:true,cancelable:true}));
  const tick=ms=>new Promise(r=>setTimeout(r,ms));`;

// restaurar los originales que dejó la parte 2
await run('restaurar-dobles', `(()=>{ const Q=window.__H; if(Q&&Q.oC){ window.appConfirm=Q.oC; window.appConfirm3=Q.oC3; Q.on=0; } return {appConfirmNativo:String(window.appConfirm).indexOf('_dialogBase')>=0, appConfirm3Nativo:String(window.appConfirm3).indexOf('_dialogBase')>=0}; })()`);

// ---- appConfirm3: Enter con DESCARTAR enfocado debe DESCARTAR (antes siempre Guardaba) ----
await run('c3-Enter-con-Descartar-enfocado', `(async()=>{ ${K}
  const p=appConfirm3('test'); await tick(60);
  const ov=document.getElementById('confirm3Ov'); if(!ov)return 'no salió el diálogo';
  const focoInicial=document.activeElement.id;
  document.getElementById('c3Discard').focus(); const foco=document.activeElement.id;
  kd('Enter'); const r=await p;
  return {focoInicial, focoTrasTab:foco, respuesta:r, limpio:!document.getElementById('confirm3Ov')}; })()`);

await run('c3-Enter-con-Cancel-enfocado', `(async()=>{ ${K}
  const p=appConfirm3('test'); await tick(60); document.getElementById('c3Cancel').focus(); kd('Enter');
  return {respuesta:await p}; })()`);

await run('c3-Enter-sin-tocar-el-foco-sigue-Guardando', `(async()=>{ ${K}
  const p=appConfirm3('test'); await tick(60); const f=document.activeElement.id; kd('Enter');
  return {foco:f, respuesta:await p}; })()`);

await run('c3-Escape-cancela', `(async()=>{ ${K}
  const p=appConfirm3('test'); await tick(60); kd('Escape'); return {respuesta:await p}; })()`);

await run('c3-clic-fuera-cancela', `(async()=>{ ${K}
  const p=appConfirm3('test'); await tick(60); const ov=document.getElementById('confirm3Ov');
  ov.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); return {respuesta:await p}; })()`);

await run('c3-los-tres-botones-y-el-orden', `(async()=>{ ${K}
  const p=appConfirm3('test',{save:'Guardar',discard:'Descartar'}); await tick(60);
  const ov=document.getElementById('confirm3Ov');
  const b=[...ov.querySelectorAll('button')].map(x=>x.id+'='+x.textContent+(x.classList.contains('on')?'*':''));
  const z=ov.style.zIndex; document.getElementById('c3Save').click(); await p;
  return {botones:b, z}; })()`);

// ---- appConfirm de 2 botones: Enter / Escape / callback ----
await run('cf-Enter-default-OK', `(async()=>{ ${K}
  let r; const p=new Promise(res=>{ appConfirm('test',v=>{ r=v; res(v); }); }); await tick(60);
  const ov=document.getElementById('confirmOv'); const b=[...ov.querySelectorAll('button')].map(x=>x.id+'='+x.textContent);
  const foco=document.activeElement.id; kd('Enter');
  return {botones:b, foco, callback:await p, limpio:!document.getElementById('confirmOv')}; })()`);

await run('cf-Enter-con-Cancel-enfocado', `(async()=>{ ${K}
  const p=new Promise(res=>{ appConfirm('test',res); }); await tick(60);
  document.getElementById('cfCancel').focus(); kd('Enter'); return {callback:await p}; })()`);

await run('cf-Escape-cancela', `(async()=>{ ${K}
  const p=new Promise(res=>{ appConfirm('test',res); }); await tick(60); kd('Escape'); return {callback:await p}; })()`);

await run('cf-danger-pinta-el-boton', `(async()=>{ ${K}
  const p=new Promise(res=>{ appConfirm('test',res,{ok:'Discard',danger:true}); }); await tick(60);
  const ok=document.getElementById('cfOk'); const st=ok.getAttribute('style')||''; ok.click();
  return {label:ok.textContent, tieneEstiloDanger:st.indexOf('33383F')>=0, callback:await p}; })()`);

// ---- flujo REAL con appConfirm de 2 botones: borrar una secuencia ----
await run('cf-flujo-real-borrar-secuencia', `(async()=>{ ${K}
  const seqs=state.media.filter(isSeqMedia); if(seqs.length<2)return {saltado:'sólo hay '+seqs.length+' secuencia(s)'};
  const victima=seqs.find(s=>s.id!==state.activeSeqId); const n0=state.media.filter(isSeqMedia).length;
  // el borrado de secuencia pasa por appConfirm; se responde con teclado, como un usuario
  let salio=false; const oC=window.appConfirm;
  window.appConfirm=function(m,cb,o){ salio=true; return oC.apply(this,arguments); };
  deleteSequenceMedia(victima.id); await tick(80);
  const ov=document.getElementById('confirmOv'); const txt=ov?ov.querySelector('div').textContent.slice(0,70):null;
  if(ov)kd('Escape'); await tick(80);
  const trasEsc=state.media.filter(isSeqMedia).length;
  deleteSequenceMedia(victima.id); await tick(80); kd('Enter'); await tick(150);
  window.appConfirm=oC;
  return {preguntó:salio, mensaje:txt, seqsAntes:n0, trasEscape:trasEsc, trasEnter:state.media.filter(isSeqMedia).length}; })()`);

await run('errs', `(window.__errs||[])`);
