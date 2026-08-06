// [R223] ÍTEM 6 a fondo: solape = corte no destructivo + crossfade manual con el handle de fade
import { fn, shot, errs, close } from './lib.mjs';
const out = {};

// helpers instalados en la página
await fn(`
  window.__snap = () => state.clips.map(c=>({id:c.id,lane:c.lane,start:+c.start.toFixed(3),dur:+c.dur.toFixed(3),
    inP:+(c.inP||0).toFixed(3),fi:+(c.fadeIn||0).toFixed(3),fo:+(c.fadeOut||0).toFixed(3),role:c.avRole||null,name:c.name}));
  window.__ovl = li => { const cs=state.clips.filter(c=>c.lane===li).sort((a,b)=>a.start-b.start); const o=[];
    for(let i=0;i<cs.length-1;i++){ const s=Math.max(cs[i].start,cs[i+1].start), e=Math.min(cs[i].start+cs[i].dur,cs[i+1].start+cs[i+1].dur);
      if(e>s+1e-4)o.push({a:cs[i].id,b:cs[i+1].id,from:+s.toFixed(3),to:+e.toFixed(3),len:+(e-s).toFixed(3)}); } return o; };
  // arrastre sintético de un clip por su banda de título
  window.__dragClip = async (id, dSec, dLane) => { const cd=document.querySelector('.clip[data-clip="'+id+'"]'); const r=cd.getBoundingClientRect();
    const tt=cd.querySelector('.tt'); const x0=r.left+Math.min(40,r.width/2), y0=r.top+4;
    let y1=y0; if(dLane!=null){ const row=document.querySelector('#tracks .lane[data-lane="'+dLane+'"]'); const rr=row.getBoundingClientRect(); y1=rr.top+rr.height/2; }
    (tt||cd).dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:x0,clientY:y0}));
    const x1=x0+dSec*state.tl.pxPerSec;
    window.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:x1,clientY:y1}));
    await new Promise(r=>setTimeout(r,50));
    window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:x1,clientY:y1}));
    await new Promise(r=>setTimeout(r,180)); };
  // arrastre del handle de RESIZE (borde) — dSec>0 alarga por la derecha / mueve el borde izquierdo a la derecha
  window.__dragEdge = async (id, side, dSec) => { const cd=document.querySelector('.clip[data-clip="'+id+'"]');
    const hd=cd.querySelector('.hd.'+side); const r=hd.getBoundingClientRect(); const x0=r.left+r.width/2, y0=r.top+r.height/2;
    hd.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:x0,clientY:y0}));
    const x1=x0+dSec*state.tl.pxPerSec;
    window.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:x1,clientY:y0}));
    await new Promise(r=>setTimeout(r,50));
    window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:x1,clientY:y0}));
    await new Promise(r=>setTimeout(r,180)); };
  // arrastre del handle de FADE — el gesto del crossfade
  window.__dragFade = async (id, which, dSec) => { const cd=document.querySelector('.clip[data-clip="'+id+'"]');
    const fh=cd.querySelector('.fadeh.'+(which==='fadeOut'?'fadeR':'fadeL')); const r=fh.getBoundingClientRect();
    const x0=r.left+r.width/2, y0=r.top+4;
    fh.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:x0,clientY:y0}));
    const x1=x0+dSec*state.tl.pxPerSec;
    window.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:x1,clientY:y0}));
    await new Promise(r=>setTimeout(r,60));
    window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:x1,clientY:y0}));
    await new Promise(r=>setTimeout(r,200)); };
  window.__build = (specs) => { // specs: [{media:'A'|'B', lane, start, dur}]
    state.clips=[]; state.markers=[]; state.selId=null; state.selIds=[]; state.selMarkerId=null; state.selLane=null;
    const mA=state.media.find(m=>m.name==='Multimedia2.mp4'), mB=state.media.find(m=>m.name==='Multimedia3.mp4');
    const ids=[];
    for(const s of specs){ const m=(s.media==='A')?mA:mB;
      const c={id:uid(),mediaId:m.id,lane:s.lane,start:s.start,dur:s.dur,inP:s.inP||0,name:s.name||m.name,color:m.color,
        fadeIn:0,fadeOut:0,props:(state.lanes[s.lane].kind==='audio')?{volume:100}:{},kf:{},fx:[]};
      state.clips.push(c); ids.push(c.id); }
    clearAllUndo();
    renderTimeline(); render(); reschedAudio(); return ids; };
  return true;
`);

// ═══ 6.1 · B sobre A → CORTE sin fundido ═══
out.t1_cut = await fn(`
  const [A,B]=__build([{media:'A',lane:0,start:0,dur:6,name:'A'},{media:'B',lane:0,start:8,dur:6,name:'B'}]);
  window.__t1={A,B};
  const before=__snap();
  await __dragClip(B,-4);                       // B: 8 → 4 (pisa A de 4 a 6)
  const after=__snap();
  return {before, after, overlaps:__ovl(0),
    A:{dur:+clipById(A).dur.toFixed(3), inP:+(clipById(A).inP||0).toFixed(3), fo:+(clipById(A).fadeOut||0).toFixed(3)},
    B:{start:+clipById(B).start.toFixed(3), fi:+(clipById(B).fadeIn||0).toFixed(3)},
    noFades: state.clips.every(c=>(c.fadeIn||0)<1e-6 && (c.fadeOut||0)<1e-6),
    noOverlap: __ovl(0).length===0};
`);
await shot('r223-6.1-cut-sin-fundido');

// ═══ 6.2 · re-extender A recupera material (no destructivo) ═══
out.t2_reextend = await fn(`
  const {A,B}=window.__t1;
  await __dragClip(B, 6);                       // aparta B (4 → 10)
  const gap={A:+clipById(A).dur.toFixed(3), B:+clipById(B).start.toFixed(3)};
  await __dragEdge(A,'r', 2.0);                 // re-extender el borde derecho de A +2s
  const rec={A_dur:+clipById(A).dur.toFixed(3), A_inP:+(clipById(A).inP||0).toFixed(3)};
  return {gap, rec, recovered: rec.A_dur>5.9, snap:__snap()};
`);
await shot('r223-6.2-reextender-recupera');

// ═══ 6.3 · corte cuando el clip movido cae DENTRO del viejo → dos restos ═══
out.t3_split = await fn(`
  const [A,B]=__build([{media:'A',lane:0,start:0,dur:10,name:'A'},{media:'B',lane:0,start:14,dur:3,name:'B'}]);
  await __dragClip(B,-10);                      // B: 14 → 4 (dentro de A: 4-7)
  const cs=state.clips.filter(c=>c.lane===0).sort((a,b)=>a.start-b.start);
  return {n:cs.length, clips:cs.map(c=>({name:c.name,start:+c.start.toFixed(3),dur:+c.dur.toFixed(3),inP:+(c.inP||0).toFixed(3)})),
    overlaps:__ovl(0), splitIntoTwoRemnants: cs.length===3 && cs[0].name==='A' && cs[2].name==='A'};
`);
await shot('r223-6.3-corte-en-medio');

// ═══ 6.4 · el movido TAPA al viejo → el viejo desaparece (no queda un resto de 2 frames) ═══
out.t4_cover = await fn(`
  const [A,B]=__build([{media:'A',lane:0,start:4,dur:3,name:'A'},{media:'B',lane:0,start:14,dur:8,name:'B'}]);
  await __dragClip(B,-11);                      // B: 14 → 3, dur 8 → cubre 3-11 ⊃ A(4-7)
  return {n:state.clips.filter(c=>c.lane===0).length, clips:__snap(), covered: !clipById(A), overlaps:__ovl(0)};
`);

// ═══ 6.5 · CROSSFADE manual con el handle de fade (vídeo) ═══
out.t5_xfade = await fn(`
  const [A,B]=__build([{media:'A',lane:0,start:0,dur:6,name:'A'},{media:'B',lane:0,start:6,dur:6,inP:3,name:'B'}]);
  window.__t5={A,B};
  const before={B_start:clipById(B).start,B_dur:clipById(B).dur,B_inP:clipById(B).inP};
  // seleccionar B y arrastrar su handle fadeIn 1s a la IZQUIERDA (sobre el corte con A)
  state.selId=B; state.selIds=[B]; renderTimeline();
  await __dragFade(B,'fadeIn',-1.0);
  const ov=__ovl(0);
  const at=(ov[0]?(ov[0].from+ov[0].to)/2:0);
  const comp=compositeClips(at).map(x=>({id:x.c.id,name:x.c.name,xf:+x.xf.toFixed(3)}));
  return {before, after:{B_start:+clipById(B).start.toFixed(3),B_dur:+clipById(B).dur.toFixed(3),B_inP:+(clipById(B).inP||0).toFixed(3),
      B_fi:+(clipById(B).fadeIn||0).toFixed(3), A_fo:+(clipById(A).fadeOut||0).toFixed(3), A_dur:+clipById(A).dur.toFixed(3)},
    overlaps:ov, compositeAtMid:{t:+at.toFixed(3), draw:comp},
    xfadeBadge: !!document.querySelector('#tracks .xfade'),
    createdCrossfade: ov.length===1 && Math.abs(ov[0].len-1.0)<0.15,
    videoUsesGeometry: (clipById(A).fadeOut||0)<1e-6 && (clipById(B).fadeIn||0)<1e-6,
    dissolveMid: comp.length===2 && comp[0].xf===1 && comp[1].xf>0.3 && comp[1].xf<0.7};
`);
// captura del composite EN MEDIO del crossfade
out.t5_shot = await fn(`
  const ov=__ovl(0); state.playhead=(ov[0].from+ov[0].to)/2; positionPlayhead(); scrubRender();
  await new Promise(r=>setTimeout(r,700)); render(); await new Promise(r=>setTimeout(r,300));
  return {playhead:+state.playhead.toFixed(3), drawn:compositeClips(state.playhead).length};
`);
await shot('r223-6.5-crossfade-dissolve');
out.t5_shot_A = await fn(`state.playhead=2.0; positionPlayhead(); scrubRender(); await new Promise(r=>setTimeout(r,700)); render(); await new Promise(r=>setTimeout(r,250)); return true;`);
await shot('r223-6.5-solo-A');
out.t5_shot_B = await fn(`state.playhead=8.0; positionPlayhead(); scrubRender(); await new Promise(r=>setTimeout(r,700)); render(); await new Promise(r=>setTimeout(r,250)); return true;`);
await shot('r223-6.5-solo-B');

// ═══ 6.6 · reajustar el crossfade (más ancho) y 6.7 eliminarlo (arrastrar a cero) ═══
out.t6_readjust = await fn(`
  const {A,B}=window.__t5;
  state.selId=B; state.selIds=[B]; renderTimeline();
  await __dragFade(B,'fadeIn',-0.8);            // 1.0 → 1.8
  const wide=__ovl(0);
  await __dragFade(B,'fadeIn', 3.0);            // arrastrar de vuelta muy a la derecha → fuera del solape
  const gone=__ovl(0);
  return {wide, gone, B:{start:+clipById(B).start.toFixed(3),dur:+clipById(B).dur.toFixed(3),inP:+(clipById(B).inP||0).toFixed(3),fi:+(clipById(B).fadeIn||0).toFixed(3)},
    widened: wide.length===1 && wide[0].len>1.5,
    removed: gone.length===0 && Math.abs(clipById(B).start-6)<0.05 && Math.abs(clipById(B).dur-6)<0.05};
`);
await shot('r223-6.7-crossfade-eliminado');

// ═══ 6.8 · límite = material disponible ═══
out.t8_limit = await fn(`
  // B con inP=0.4 → sólo 0.4s de material propio hacia atrás; el crossfade no puede pasar de ahí
  const [A,B]=__build([{media:'A',lane:0,start:0,dur:6,name:'A'},{media:'B',lane:0,start:6,dur:6,inP:0.4,name:'B'}]);
  state.selId=B; state.selIds=[B]; renderTimeline();
  await __dragFade(B,'fadeIn',-4.0);            // pedir 4s de crossfade
  const ov=__ovl(0);
  return {overlaps:ov, B_inP:+(clipById(B).inP||0).toFixed(3),
    clampedToMaterial: ov.length===1 && ov[0].len<=0.45 && ov[0].len>0.3};
`);

// ═══ 6.9 · crossfade de AUDIO = ganancia cruzada ═══
out.t9_audio = await fn(`
  const aud=state.lanes.findIndex(l=>l.kind==='audio');
  // armar los búferes REALES de audio de los dos mp4 (si no, collectAudioEvents no tiene qué programar)
  for(const m of state.media) if(m.kind==='video' && !m.buffer) await armMediaAudio(m);
  const [A,B]=__build([{media:'A',lane:aud,start:0,dur:6,name:'Aud A'},{media:'B',lane:aud,start:6,dur:6,inP:3,name:'Aud B'}]);
  state.selId=B; state.selIds=[B]; renderTimeline();
  await __dragFade(B,'fadeIn',-1.2);
  const ov=__ovl(aud);
  const ev=(typeof collectAudioEvents==='function')?collectAudioEvents(state.clips,state.lanes,0,0,14,0,[]).map(e=>({id:e.id,start:+e.start.toFixed(3),dur:+e.dur.toFixed(3),fi:+e.fadeIn.toFixed(3),fo:+e.fadeOut.toFixed(3)})):null;
  const buffers=state.media.map(m=>({name:m.name,buf:!!m.buffer}));
  // la ganancia del solape debe SUMAR ~1 en todo el cruce (equal-gain): fade lineal de salida + entrada
  const gainAt=t=>state.clips.filter(c=>c.lane===aud&&t>=c.start&&t<c.start+c.dur).reduce((s,c)=>s+fadeFactor(c,t),0);
  const sum=[0.1,0.3,0.5,0.7,0.9].map(f=>+gainAt(ov[0]?ov[0].from+(ov[0].to-ov[0].from)*f:0).toFixed(3));
  return {overlaps:ov, A:{fo:+(clipById(A).fadeOut||0).toFixed(3)}, B:{fi:+(clipById(B).fadeIn||0).toFixed(3),start:+clipById(B).start.toFixed(3)},
    audioEvents:ev, buffers, gainSumAcrossCross:sum,
    bothScheduled: !!(ev && ev.length===2 && ev.every(e=>e.fi>0.5||e.fo>0.5)),
    equalGain: sum.every(v=>Math.abs(v-1)<0.06),
    gainCrossSymmetric: ov.length===1 && Math.abs((clipById(A).fadeOut||0)-(clipById(B).fadeIn||0))<0.02 && (clipById(B).fadeIn||0)>0.5};
`, 180000);
await shot('r223-6.9-audio-ganancia-cruzada');

// ═══ 6.10 · undo / redo del flujo completo ═══
out.t10_undo = await fn(`
  const [A,B]=__build([{media:'A',lane:0,start:0,dur:6,name:'A'},{media:'B',lane:0,start:8,dur:6,inP:3,name:'B'}]);
  const s0=__snap();
  await __dragClip(B,-4);           const s1=__snap();   // corte
  state.selId=B; state.selIds=[B]; renderTimeline();
  await __dragFade(B,'fadeIn',-1.0); const s2=__snap();  // crossfade
  const ov2=__ovl(0);
  undo(); await new Promise(r=>setTimeout(r,150)); const u1=__snap();
  undo(); await new Promise(r=>setTimeout(r,150)); const u2=__snap();
  redo(); await new Promise(r=>setTimeout(r,150)); const r1=__snap();
  redo(); await new Promise(r=>setTimeout(r,150)); const r2=__snap();
  const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  return {s0,s1,s2,ov2,u1,u2,r1,r2,
    cutHappened: !eq(s0,s1), xfadeHappened: !eq(s1,s2) && ov2.length===1,
    undoBackToCut: eq(u1,s1), undoBackToStart: eq(u2,s0), redoToCut: eq(r1,s1), redoToXfade: eq(r2,s2)};
`);

// ═══ 6.11 · undo del corte que PARTE / BORRA clips (cutOverlapsOnDrop crea y elimina clips) ═══
out.t11_undo_destructive = await fn(`
  const [A,B]=__build([{media:'A',lane:0,start:0,dur:10,name:'A'},{media:'B',lane:0,start:14,dur:3,name:'B'}]);
  const s0=__snap();
  await __dragClip(B,-10);            // B cae dentro de A → A se parte en dos restos
  const s1=__snap();
  undo(); await new Promise(r=>setTimeout(r,150)); const u=__snap();
  redo(); await new Promise(r=>setTimeout(r,150)); const r=__snap();
  const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  return {n0:s0.length, n1:s1.length, nUndo:u.length, nRedo:r.length,
    splitTo3:s1.length===3, undoRestores: eq(u,s0), redoRepeats: eq(r,s1)};
`);

// ═══ 6.12 · el corte también vale al SOLTAR desde el bin de medios ═══
out.t12_media_drop = await fn(`
  const [A]=__build([{media:'A',lane:0,start:0,dur:8,name:'A'}]);
  const mB=state.media.find(m=>m.name==='Multimedia3.mp4');
  const before=new Set(state.clips.map(c=>c.id));
  addClip(mB,0,5); await new Promise(r=>setTimeout(r,120));
  const nuevos=state.clips.filter(c=>!before.has(c.id)).map(c=>c.id);
  cutOverlapsOnDrop(nuevos); renderTimeline(); render();
  return {clips:__snap().filter(c=>c.lane===0).sort((a,b)=>a.start-b.start), overlaps:__ovl(0),
    aTrimmedTo5: Math.abs(clipById(A).dur-5)<0.02, noOverlap:__ovl(0).length===0};
`, 60000);

console.log(JSON.stringify(out, null, 2));
console.log('ERRS', JSON.stringify(await errs(), null, 1));
close();
