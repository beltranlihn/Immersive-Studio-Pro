// [R225] Migración de .isp con nest en Patch · botones ⚡Clip/⚡Comp · regresión (undo/redo, guardar+reabrir, play, domo 3D)
import { evalInApp } from './cdp.mjs';
const expr = `(async function(){
  const R={}; const txtOf=s=>(s||'').replace(/\\s+/g,' ').trim();
  // ---------- botones de la barra del visor ----------
  const bp=document.querySelector('#proxyToggle button'), bn=document.querySelector('#nestCacheToggle button');
  R.botones={ clip:{ txt:txtOf(bp.textContent), ico:bp.querySelector('i')&&bp.querySelector('i').dataset.ico, svg:!!bp.querySelector('svg'), on:bp.classList.contains('on') },
              comp:{ txt:txtOf(bn.textContent), ico:bn.querySelector('i')&&bn.querySelector('i').dataset.ico, svg:!!bn.querySelector('svg'), on:bn.classList.contains('on') } };
  R.botonesFuncionan=(()=>{ const a=state.view.useProxy, b=state.view.useNestCache; bp.click(); bn.click(); const r={proxy:state.view.useProxy!==a, comp:state.view.useNestCache!==b}; bp.click(); bn.click(); return r; })();
  // ---------- .isp de "ayer": nest con el clip en Patch (fulldome:false) + equirect ----------
  const antes=JSON.parse(JSON.stringify(serProject()));
  const viejo=JSON.parse(JSON.stringify(antes));
  let tocados=0;
  for(const m of viejo.media){ if(m.kind!=='nest')continue;
    for(const c of (m.nestClips||[])){ const cm=viejo.media.find(x=>x.id===c.mediaId); if(cm&&cm.kind==='nest'&&!c.nestAudioOf){ c.props.fulldome=false; c.props.equirect=true; tocados++; } } }
  R.ispViejo={ clipsEnPatch:tocados };
  loadProject(viejo);
  await new Promise(r=>setTimeout(r,400));
  let enPatch=0, total=0;
  for(const m of state.media){ if(m.kind!=='nest')continue; for(const c of (m.nestClips||[])){ const cm=mediaById(c.mediaId); if(cm&&cm.kind==='nest'){ total++; if(!c.props.fulldome||c.props.equirect)enPatch++; } } }
  R.trasMigrar={ nestClips:total, siguenEnPatch:enPatch, derivadosVivos:state.clips.filter(isNestAudioClip).length, abre:true };
  // ---------- regresión: undo / redo ----------
  const n0=state.clips.length;
  pushUndo(); state.clips.push({id:uid(),mediaId:state.media.find(m=>m.kind==='shape').id,lane:state.lanes.findIndex(l=>l.kind==='video'),start:20,dur:2,inP:0,name:'undoTest',props:{az:0,el:30,size:40,opacity:100},kf:{},fx:[]});
  const n1=state.clips.length; undo(); const n2=state.clips.length; redo(); const n3=state.clips.length; undo();
  R.undo={ n0,n1,n2,n3, ok:(n1===n0+1 && n2===n0 && n3===n0+1) };
  // ---------- regresión: guardar + reabrir en memoria ----------
  const ser=JSON.parse(JSON.stringify(serProject())); const nClips=state.clips.length, nMedia=state.media.length;
  loadProject(ser); await new Promise(r=>setTimeout(r,400));
  R.roundtrip={ clipsAntes:nClips, clipsDespues:state.clips.length, mediaAntes:nMedia, mediaDespues:state.media.length, igual:(state.clips.length===nClips) };
  // ---------- regresión: reproducción ----------
  state.playhead=0; play(); await new Promise(r=>setTimeout(r,700)); const ph=state.playhead; pause();
  R.play={ avanzo:+ph.toFixed(2), ok:ph>0.2 };
  // ---------- regresión: domo 3D ----------
  const px3=(modo)=>{ state.view.mode=modo; render();
    const cv=document.querySelector('#gl'); const g=gl; const w=g.drawingBufferWidth,h=g.drawingBufferHeight;
    const p=new Uint8Array(w*h*4); g.bindFramebuffer(g.FRAMEBUFFER,null); g.readPixels(0,0,w,h,g.RGBA,g.UNSIGNED_BYTE,p);
    let no=0; for(let i=0;i<p.length;i+=4*97){ if(p[i]+p[i+1]+p[i+2]>26)no++; } return {w,h,muestrasConTinta:no}; };
  R.render2d=px3('2d'); R.render3d=px3('3d'); state.view.mode='2d'; render();
  R.tres_d_ok=R.render3d.muestrasConTinta>0;
  return {R, errs:window.__errs};
})()`;
evalInApp(expr).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error('ERR',e.message);process.exit(1);});
