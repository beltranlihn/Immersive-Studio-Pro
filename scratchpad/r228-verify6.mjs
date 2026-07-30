// [R228] parte 5 — guardar/reabrir un demo, reciente desde el launcher, borrar secuencia, copy 2D en pantalla.
import { evalInApp } from './cdp.mjs';
import { shot } from './r228-shot.mjs';
const run = async (k, e) => { const v = await evalInApp(e, { timeout: 60000 }); console.log('· ' + k + ' → ' + JSON.stringify(v)); return v; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const H = `const tick=ms=>new Promise(r=>setTimeout(r,ms));
  const snap=()=>({lch:lchShowing(), back:!!document.getElementById('lchBack'), volver:_lchVolver, consent:lchConsent(), dirty:state.dirty, seq:(activeSeq()||{}).name, mode:state.seqMode});
  const foto=()=>({clips:state.clips.length, mode:state.seqMode,
    eases:[...new Set(state.clips.flatMap(c=>Object.values(c.kf||{}).flat().map(k=>k.e)))].sort(),
    curvas:state.clips.flatMap(c=>Object.keys(c.kf||{})).sort(),
    fx:state.clips.flatMap(c=>(c.fx||[]).map(f=>f.type+':'+f.int)).sort(),
    motion:state.clips.flatMap(c=>(c.anim||[]).map(a=>a.key||a.param)).sort(),
    nests:state.media.filter(m=>m.kind==='nest').length,
    muros:((activeSeq()||{}).room||{walls:[]}).walls.length});
  const RUTA=String.raw\`C:\\Users\\beltr\\Desktop\\Alma Digital Studio\\Projects\\Immersive Studio Pro\\scratchpad\\r228-demo-room.isp\`;`;

await run('limpiar', `(()=>{ ${H} state.dirty=false; if(lchShowing()){_lchVolver=false; if(_lch)_lch.discardOk=false; hideLanding();} if(_tourStop)_tourStop(); return snap(); })()`);

await run('demo-room-construir', `(async()=>{ ${H} state.dirty=false; await startDemoProject('room'); await tick(900); return Object.assign(snap(),foto()); })()`);
await sleep(500);

await run('demo-room-guardar-a-disco', `(async()=>{ ${H}
  const antes=foto(); const json=JSON.stringify(serProject());
  const ok=await DSP.writeText(RUTA,json);
  return {escrito:ok!==false, bytes:json.length, antes}; })()`);

await run('demo-room-reabrir', `(async()=>{ ${H}
  const antes=foto();
  const txt=await DSP.readText(RUTA); if(txt==null)return 'no se pudo leer';
  currentPath=RUTA; state.dirty=false; loadProject(JSON.parse(txt)); await tick(1500);
  const despues=foto();
  return {identico:JSON.stringify(antes)===JSON.stringify(despues), antes, despues, volver:_lchVolver, consent:lchConsent()}; })()`);

await run('launcher-abrir-reciente', `(async()=>{ ${H}
  addRecent(RUTA,null); state.dirty=false; _lchVolver=true; showLanding(); await tick(300);
  const back=!!document.getElementById('lchBack');
  const card=document.querySelector('.lch-rcard[data-path*="r228-demo-room"]');
  if(!card)return {err:'el reciente no aparece', recientes:[...document.querySelectorAll('.lch-rcard')].map(c=>c.dataset.path).slice(0,4)};
  card.click(); await tick(1800);
  return Object.assign(snap(),{backAntes:back, clips:state.clips.length, muros:((activeSeq()||{}).room||{walls:[]}).walls.length}); })()`);

await run('cf-flujo-real-borrar-secuencia', `(async()=>{ ${H}
  const kd=k=>document.dispatchEvent(new KeyboardEvent('keydown',{key:k,bubbles:true,cancelable:true}));
  const seqs=state.media.filter(isSeqMedia); const victima=seqs.find(s=>s.id!==state.activeSeqId);
  if(!victima)return {saltado:'sólo '+seqs.length+' secuencia(s)', nombres:seqs.map(s=>s.name)};
  const n0=seqs.length;
  deleteSequenceMedia(victima.id); await tick(120);
  const ov=document.getElementById('confirmOv');
  const msg=ov?ov.querySelector('div').textContent.slice(0,60):null;
  const botones=ov?[...ov.querySelectorAll('button')].map(b=>b.id+'='+b.textContent):null;
  kd('Escape'); await tick(120); const trasEsc=state.media.filter(isSeqMedia).length;
  deleteSequenceMedia(victima.id); await tick(120); kd('Enter'); await tick(350);
  return {mensaje:msg, botones, seqsAntes:n0, trasEscape:trasEsc, trasEnter:state.media.filter(isSeqMedia).length}; })()`);

await run('demo-flat-tour-canvas', `(async()=>{ ${H}
  state.dirty=false; await startDemoProject('flat'); await tick(900);
  if(_tourStop)_tourStop(); startTour('flat',true); await tick(250);
  const card=()=>document.querySelector('#tourOv > div:nth-child(2)');
  for(let i=0;i<12;i++){ const t=card().querySelector('div:nth-child(2)').textContent; if(t.indexOf('anvas')>=0||t.indexOf('ienzo')>=0)break; card().querySelector('#tourNext').click(); await tick(80); }
  const b3=document.querySelector('#viewModeSeg button[data-v="3d"]'), b2=document.querySelector('#viewModeSeg button[data-v="2d"]');
  return {paso:card().querySelector('div:nth-child(1)').textContent, titulo:card().querySelector('div:nth-child(2)').textContent,
    cuerpo:card().querySelector('div:nth-child(3)').textContent, b3oculto:b3.style.display==='none', b2:b2.textContent.trim()}; })()`);

await sleep(500);
console.log('· captura → ' + await shot('scratchpad/r228-demo-flat-canvas.png'));

await run('cerrar', `(()=>{ if(_tourStop)_tourStop(); return {tour:!document.getElementById('tourOv'), errs:(window.__errs||[]), diagErr:DIAG.buf.filter(e=>e.level==='error').map(e=>e.tag+':'+e.msg).slice(-10)}; })()`);
