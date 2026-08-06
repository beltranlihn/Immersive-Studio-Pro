// [R223] regresión: reproducción con audio linkeado · domo 3D · guardar+reabrir con crossfades y linkeados
import { fn, shot, errs, close } from './lib.mjs';
import { installHelpers } from './helpers.mjs';
const out = {};
await installHelpers();

// ── escena: par linkeado A/V + segundo par, crossfade manual en vídeo Y en audio ──
out.build = await fn(`
  state.clips=[]; state.markers=[]; state.selId=null; state.selIds=[]; state.selMarkerId=null;
  const mA=state.media.find(m=>m.name==='Multimedia2.mp4'), mB=state.media.find(m=>m.name==='Multimedia3.mp4');
  const vLane=state.lanes.findIndex(l=>l.kind==='video');
  // Primero A y su audio; se RECORTA a 6s ANTES de añadir B, para que el audio de B quepa en la MISMA pista de
  // audio (nearestAudioLane crea una pista nueva si la encuentra ocupada, y ahí el crossfade de audio no tiene
  // vecino con el que cruzar — que es justo lo que hay que probar).
  addClip(mA,vLane,0);
  for(let i=0;i<160 && state.clips.length<2;i++) await new Promise(r=>setTimeout(r,150));
  for(const c of state.clips){ c.dur=6; c.inP=0; }
  renderTimeline();
  const vLane2=state.clips.find(c=>c.avRole==='v').lane;
  addClip(mB,vLane2,6);
  for(const i of [0]) {}
  for(let i=0;i<160 && state.clips.length<4;i++) await new Promise(r=>setTimeout(r,150));
  const V=state.clips.filter(c=>c.avRole==='v').sort((a,b)=>a.start-b.start);
  const A1=V[0], B1=V[1];
  B1.dur=6; B1.inP=3;
  for(const c of state.clips) if(c.avRole==='a'){ const p=linkPartner(c); if(p){ c.start=p.start; c.dur=p.dur; c.inP=p.inP||0; c.lane=c.lane; } }
  renderTimeline(); render(); reschedAudio(); clearAllUndo();
  // crossfade manual de 1,5s arrastrando el handle fadeIn del clip de VÍDEO B (el partner de audio debe seguirlo)
  state.selId=B1.id; state.selIds=[B1.id]; renderTimeline();
  await __dragFade(B1.id,'fadeIn',-1.5);
  const vL=A1.lane, aL=linkPartner(A1).lane;
  window.__rids={A:A1.id,B:B1.id,Aa:linkPartner(A1).id,Ba:(linkPartner(B1)||{}).id,vL,aL};
  return {clips:__snap(), lanes:state.lanes.map((l,i)=>i+':'+l.kind), vLane:vL, aLane:aL,
    vOverlaps:__ovl(vL), aOverlaps:__ovl(aL), ids:window.__rids};
`, 240000);

// ── R1: el partner de audio siguió al crossfade (sync A/V) y cruza por ganancia ──
out.r1_linkSync = await fn(`
  const {A,B,Aa,Ba}=window.__rids;
  const cB=clipById(B), cBa=clipById(Ba), cA=clipById(A), cAa=clipById(Aa);
  return {video:{start:+cB.start.toFixed(3),dur:+cB.dur.toFixed(3),inP:+(cB.inP||0).toFixed(3),fi:+(cB.fadeIn||0).toFixed(3)},
    audio:{start:+cBa.start.toFixed(3),dur:+cBa.dur.toFixed(3),inP:+(cBa.inP||0).toFixed(3),fi:+(cBa.fadeIn||0).toFixed(3)},
    prevAudioFo:+(cAa.fadeOut||0).toFixed(3), prevVideoFo:+(cA.fadeOut||0).toFixed(3),
    avInSync: Math.abs(cB.start-cBa.start)<0.01 && Math.abs(cB.dur-cBa.dur)<0.01 && Math.abs((cB.inP||0)-(cBa.inP||0))<0.01,
    audioCrossesByGain: (cBa.fadeIn||0)>0.5 && Math.abs((cBa.fadeIn||0)-(cAa.fadeOut||0))<0.02,
    videoStaysGeometric: (cB.fadeIn||0)<1e-6 && (cA.fadeOut||0)<1e-6};
`);

// ── R1b: arrastrar el handle de la mitad de AUDIO no debe crear fundido en el VÍDEO (fundiría a negro sobre el
//        dissolve), y un fundido propio del partner no se pisa al salir del crossfade ──
out.r1b_audioHandle = await fn(`
  const {A,B,Aa,Ba}=window.__rids;
  // deshacer el crossfade y darle al VÍDEO B un fadeIn propio, que no debe tocarse
  state.selId=Ba; state.selIds=[Ba]; renderTimeline();
  await __dragFade(Ba,'fadeIn',1.0);   // vuelve al contacto (y algo hacia dentro)
  clipById(B).fadeIn=0.4;              // fundido manual propio del vídeo
  const before={vFi:+(clipById(B).fadeIn||0).toFixed(3)};
  state.selId=Ba; state.selIds=[Ba]; renderTimeline();
  await __dragFade(Ba,'fadeIn',-1.0);  // crossfade DESDE la mitad de audio
  const aud=window.__rids.aL, vid=window.__rids.vL;
  const after={vFi:+(clipById(B).fadeIn||0).toFixed(3), aFi:+(clipById(Ba).fadeIn||0).toFixed(3),
    prevAFo:+(clipById(Aa).fadeOut||0).toFixed(3), prevVFo:+(clipById(A).fadeOut||0).toFixed(3)};
  return {before, after, aOverlaps:__ovl(aud), vOverlaps:__ovl(vid),
    videoFadeUntouched: Math.abs((clipById(B).fadeIn||0)-0.4)<1e-6,
    audioCrossed: (clipById(Ba).fadeIn||0)>0.5 && (clipById(Aa).fadeOut||0)>0.5,
    videoAlsoOverlapsGeometrically: __ovl(vid).length===1};
`, 120000);

// ── R2: reproducción — el audio linkeado suena (eventos programados + nodos con ganancia) ──
out.r2_playback = await fn(`
  state.playhead=0; play();
  await new Promise(r=>setTimeout(r,1600));
  const ev=collectAudioEvents(state.clips,state.lanes,0,0,14,0,[]);
  const st={playing:state.playing, ph:+state.playhead.toFixed(2),
    actxState:(typeof actx!=='undefined'&&actx)?actx.state:null,
    events:ev.map(e=>({id:e.id,start:+e.start.toFixed(2),dur:+e.dur.toFixed(2),fi:+e.fadeIn.toFixed(2),fo:+e.fadeOut.toFixed(2),vol:e.vol,buf:!!e.buffer})),
    srcCount:(typeof _aSrcs!=='undefined'&&_aSrcs)?_aSrcs.length:null};
  pause(); await new Promise(r=>setTimeout(r,200));
  st.advanced = st.ph>0.8;
  st.audioScheduled = st.events.length===2 && st.events.every(e=>e.buf);
  return st;
`, 60000);
await shot('r223-reg-playback');

// ── R3: visor 3D del domo ──
out.r3_dome3d = await fn(`
  state.playhead=3.0; await scrubRender();
  state.view.mode='3d'; render(); await new Promise(r=>setTimeout(r,600)); render();
  const cv=document.querySelector('#gl'); const buf=new Uint8Array(cv.width*cv.height*4);
  render(); gl.readPixels(0,0,cv.width,cv.height,gl.RGBA,gl.UNSIGNED_BYTE,buf);
  let nz=0; for(let i=0;i<buf.length;i+=4) if(buf[i]+buf[i+1]+buf[i+2]>24) nz++;
  return {mode:state.view.mode, canvas:cv.width+'x'+cv.height, nonBlackPx:nz, renders3D: nz>2000};
`, 60000);
await shot('r223-reg-dome-3d');
await fn(`state.view.mode='2d'; render(); return true;`);

// ── R4: guardar y reabrir — la serialización sobrevive ──
out.r4_roundtrip = await fn(`
  const before=__snap();
  const beforeLinks=state.clips.map(c=>({id:c.id,link:c.link||null,role:c.avRole||null}));
  const beforeOv={v:__ovl(window.__rids.vL), a:__ovl(window.__rids.aL)};
  const json=JSON.stringify(serProject());
  window.__json=json;
  loadProject(JSON.parse(json));
  await new Promise(r=>setTimeout(r,900));
  const after=__snap();
  const afterLinks=state.clips.map(c=>({id:c.id,link:c.link||null,role:c.avRole||null}));
  const afterOv={v:__ovl(window.__rids.vL), a:__ovl(window.__rids.aL)};
  const key=a=>a.map(c=>[c.lane,c.start,c.dur,c.inP,c.fi,c.fo,c.role].join('|')).sort().join(' / ');
  const pairs=a=>a.filter(x=>x.link).length;
  return {bytes:json.length, before, after, beforeOv, afterOv,
    geometrySurvived: key(before)===key(after),
    crossfadesSurvived: JSON.stringify(beforeOv.v.map(o=>o.len))===JSON.stringify(afterOv.v.map(o=>o.len))
                     && JSON.stringify(beforeOv.a.map(o=>o.len))===JSON.stringify(afterOv.a.map(o=>o.len)),
    linksSurvived: pairs(beforeLinks)===pairs(afterLinks) && pairs(afterLinks)===4
                 && state.clips.filter(c=>c.avRole==='v').every(c=>!!linkPartner(c))};
`, 120000);
await shot('r223-reg-roundtrip');

// ── R5: tras reabrir, el crossfade sigue produciendo el dissolve ──
out.r5_afterReload = await fn(`
  const ov=__ovl(window.__rids.vL); const t=ov.length?(ov[0].from+ov[0].to)/2:0;
  const draw=compositeClips(t).map(x=>({name:x.c.name,xf:+x.xf.toFixed(3)}));
  state.playhead=t; await scrubRender(); render(); await new Promise(r=>setTimeout(r,500)); render();
  return {t:+t.toFixed(3), draw, dissolveAlive: draw.length===2 && draw[0].xf===1 && draw[1].xf>0.2 && draw[1].xf<0.8};
`, 60000);
await shot('r223-reg-dissolve-tras-reabrir');

console.log(JSON.stringify(out, null, 2));
console.log('ERRS', JSON.stringify(await errs(), null, 1));
close();
