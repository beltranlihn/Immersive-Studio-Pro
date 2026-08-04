// [AUD 2026-08b] FIXTURE «proyecto viejo»: se construye CON EL CODIGO VIEJO (worktree a33c70b, puerto 9223),
// se guarda como .isp, se REABRE con esa misma app vieja y se toma la instantanea de verdad (estado + srcT +
// pixeles del composite). Esa instantanea es la linea base contra la que aud8b-compara.mjs mide el build nuevo.
// Requiere: la app VIEJA corriendo con --remote-debugging-port=9223 (ver ENCARGO §3).
import { evalInApp } from './cdp.mjs';
import fs from 'fs';

const DIR = String.raw`C:\Users\beltr\Desktop\Alma Digital Studio\Projects\Immersive Studio Pro\scratchpad`;
const MED = (DIR + '\\aud8b-media\\').replace(/\\/g, '\\\\');
const ISP = (DIR + '\\aud8b-viejo.isp').replace(/\\/g, '\\\\');

// ---- utilidades compartidas (mismo texto en aud8b-compara.mjs: la instantanea debe calcularse IGUAL) ----
const SNAP_FN = `
window.__snap = async function(){
  const S = {};
  const seqs = state.media.filter(isSeqMedia).map(m=>({id:m.id,name:m.name,mode:m.mode,comp:!!m.comp}));
  S.seqs = seqs.map(s=>s.name+':'+s.mode+(s.comp?':comp':''));
  saveActiveSeq();
  const cs = c => ({ name:c.name, lane:c.lane, start:+(+c.start).toFixed(4), dur:+(+c.dur).toFixed(4),
    inP:+((c.inP||0)).toFixed(4), loop:!!c.loop, loopLen:c.loopLen!=null?+(+c.loopLen).toFixed(4):null,
    loopRev:!!c.loopRev, speed:c.speed||1, link:!!c.link, avRole:c.avRole||null,
    props:(p=>({az:p.az,el:p.el,size:p.size,rot:p.rot,x:p.x,y:p.y,scale:p.scale,opacity:p.opacity,mask:p.mask,fulldome:!!p.fulldome,fisheye:!!p.fisheye}))(c.props||{}),
    anim:(c.anim||[]).map(a=>({param:a.param,mode:a.mode,speed:a.speed,amp:a.amp,phase:a.phase||0,on:!!a.on,tile:!!a.tile,grp:a.grp||null,gint:a.gint!=null?a.gint:null})),
    kf:Object.keys(c.kf||{}).sort().map(k=>k+'='+JSON.stringify(c.kf[k])) });
  S.porSeq = {};
  for (const sm of state.media.filter(isSeqMedia)) {
    const clips = (sm.id===state.activeSeqId) ? state.clips : (sm.nestClips||[]);
    S.porSeq[sm.name] = clips.slice().sort((a,b)=>a.start-b.start||a.lane-b.lane).map(cs);
  }
  // srcT: el fotograma de FUENTE que toca en cada instante — el invariante de los bucles
  S.srcT = {};
  for (const sm of state.media.filter(isSeqMedia)) {
    const clips = (sm.id===state.activeSeqId) ? state.clips : (sm.nestClips||[]);
    for (const c of clips) { if(!c.loop) continue;
      const ts=[0,1,3.7,7.2,15.9,33.3].filter(dt=>dt<c.dur);
      S.srcT[sm.name+'/'+c.name+'@'+c.start] = ts.map(dt=>+srcT(c,c.start+dt).toFixed(4));
    }
  }
  // composiciones: parametros + geometria interna + linea base de layout
  S.comps = {};
  for (const n of state.media.filter(m=>m.kind==='nest'&&m.comp)) {
    const g=n.comp;
    S.comps[n.name] = { kind:g.kind, count:g.count, mediaIds:(g.mediaIds||[]).slice(), size:g.size, el:g.el,
      jitter:g.jitter||0, randN:(g.rand||[]).length, nestW:n.w, nestH:n.h, mode:n.mode,
      els:(n.nestClips||[]).map(c=>({slot:c.slot,mediaId:c.mediaId,dur:+(+c.dur).toFixed(3),
        p:(p=>({az:p.az,el:p.el,size:p.size,rot:p.rot,x:p.x,y:p.y,scale:p.scale,opacity:p.opacity}))(c.props||{}),
        base:c._layBase?JSON.parse(JSON.stringify(c._layBase)):null })) };
  }
  return S;
};
// pixeles del COMPOSITE (FBO, independiente de la ventana). t con _previewClock=0 => determinista.
window.__pix = async function(ts){
  const out={};
  for (const t of ts) {
    state.playhead=t; _previewClock=0;
    render(); await new Promise(r=>requestAnimationFrame(r));   // pasada completa: calienta texturas y nidos
    try{ raInvalidate(); }catch(e){}
    _previewClock=0;
    render(); await new Promise(r=>requestAnimationFrame(r));   // recompone en compFBO por el MISMO camino del programa (prepNests incluido)
    const W=compW,H=compH; const buf=new Uint8Array(W*H*4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, compFBO);                // leer lo que render() dejo, sin recomponer por fuera
    gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,buf);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    let h1=5381,h2=52711,nz=0;
    for(let i=0;i<buf.length;i+=97){ const v=buf[i]; h1=((h1*33)^v)>>>0; h2=((h2*31)^v)>>>0; }
    for(let i=0;i<buf.length;i+=4){ if(buf[i]|buf[i+1]|buf[i+2]) nz++; }
    out['t'+t]={w:W,h:H,hash:h1.toString(16)+'-'+h2.toString(16),nz};
  }
  render();
  return out;
};
1`;

const espera = ms => new Promise(r => setTimeout(r, ms));
const ev = (x, t) => evalInApp(x, { port: 9223, timeout: t || 120000 });

console.log('— comprobando que es la app VIEJA (a33c70b) —');
const ver = await ev(`({viejo: typeof setLoopRange==='undefined' && typeof openSourceMonitor==='undefined' && typeof weaveLayout==='undefined', gpu:(function(){try{const e=gl.getExtension('WEBGL_debug_renderer_info');return gl.getParameter(e.UNMASKED_RENDERER_WEBGL);}catch(x){return '?';}})()})`);
console.log(ver);
if (!ver.viejo) { console.error('*** ESTO NO ES LA APP VIEJA — abortando ***'); process.exit(1); }

console.log('\n— construyendo el proyecto de riesgo con el codigo viejo —');
const built = await ev(`(async function(){
  window.__errs=[]; window.onerror=(m)=>{__errs.push(String(m));};
  const R={};
  await newProject('dome',2048,2048,30,180,true);
  const mainSeq=state.activeSeqId;
  // --- medios ---
  const vidC=await addVideoFromPath('${MED}vidC.mp4'); const vidA=await addVideoFromPath('${MED}vidA.mp4'); const vidB=await addVideoFromPath('${MED}vidB.mp4');
  const mkFile=async(p,nm,ty)=>{ const b=await (await fetch(DSP.toFileURL(p))).blob(); return new File([b],nm,{type:ty}); };
  addImage(await mkFile('${MED}imgA.png','imgA.png','image/png'),'${MED}imgA.png');
  addImage(await mkFile('${MED}imgB.png','imgB.png','image/png'),'${MED}imgB.png');
  addImage(await mkFile('${MED}imgC.png','imgC.png','image/png'),'${MED}imgC.png');
  addAudio(await mkFile('${MED}audA.wav','audA.wav','audio/wav'),'${MED}audA.wav');
  const t0=Date.now(); let imgs,aud;
  while(Date.now()-t0<20000){ await new Promise(r=>setTimeout(r,150));
    imgs=state.media.filter(m=>m.kind==='image'); aud=state.media.find(m=>m.kind==='audio');
    if(imgs.length===3&&imgs.every(m=>m.w>0)&&aud&&aud.dur>0)break; }
  const imgA=state.media.find(m=>m.name==='imgA.png'), imgB=state.media.find(m=>m.name==='imgB.png'), imgC=state.media.find(m=>m.name==='imgC.png');
  if(!vidC||!vidA||!vidB||!imgA||!imgB||!imgC||!aud) return {err:'faltan medios', tengo:state.media.map(m=>m.name)};
  R.durC=vidC.dur;
  // --- pistas: V1..V3 + A1 ---
  while(state.lanes.filter(l=>l.kind==='video').length<3) state.lanes.push({id:uid(),name:'V'+(state.lanes.filter(l=>l.kind==='video').length+1),tag:'V'+(state.lanes.filter(l=>l.kind==='video').length+1),kind:'video'});
  if(!state.lanes.some(l=>l.kind==='audio')) state.lanes.push({id:uid(),name:'Audio 1',tag:'A1',kind:'audio'});
  const V1=state.lanes.findIndex(l=>l.tag==='V1'), V2=state.lanes.findIndex(l=>l.tag==='V2'), V3=state.lanes.findIndex(l=>l.tag==='V3');
  // --- bucles sobre vidC ---
  const c_full=addClip(vidC,V1,0);      // bucle del archivo entero
  const cFull=state.clips[state.clips.length-1]; cFull.name='c_full'; toggleLoop(cFull);
  addClip(vidC,V1,55); const cTrim=state.clips[state.clips.length-1]; cTrim.name='c_trim'; cTrim.inP=20; cTrim.dur=6.5; toggleLoop(cTrim); // recortar y LUEGO encender: loopLen 6.5 sobre [20,26.5)
  addClip(vidC,V1,65); const cRev=state.clips[state.clips.length-1]; cRev.name='c_rev'; toggleLoop(cRev); toggleLoopReverse(cRev); cRev.dur=8;
  addClip(vidC,V2,45); const cStr=state.clips[state.clips.length-1]; cStr.name='c_stretch'; cStr.inP=20; cStr.dur=6; toggleLoop(cStr); cStr.dur=40; // estirado mas alla de la fuente: [45,85)
  // --- par A/V enlazado + bucle en las dos mitades (addClip auto-engancha el audio; esperamos el enlace) ---
  addClip(vidA,V2,0); const cAv=state.clips[state.clips.length-1]; cAv.name='c_av';
  { const tl=Date.now(); while(!cAv.link&&Date.now()-tl<12000) await new Promise(r=>setTimeout(r,150)); }
  toggleLoop(cAv); // con el enlace ya hecho, el bucle viaja a la mitad de audio (linkPartner)
  { const pa=linkPartner(cAv); if(pa)pa.name='c_av_audio'; }
  // --- nido loopeado con clip loopeado dentro ---
  const innerLanes=[{id:uid(),name:'V1',tag:'V1',kind:'video'}];
  const inner=makeClip(vidA,0,0); inner.name='n_inner'; inner.dur=12; inner.loop=true; inner.loopLen=vidA.dur;
  const nestL=newSeqMedia('NestLoop',30,2048,2048,[inner],innerLanes,'dome'); nestL.dur=12; state.media.push(nestL);
  addClip(nestL,V2,20); const cNest=state.clips[state.clips.length-1]; cNest.name='c_nest'; toggleLoop(cNest); cNest.loopLen=5; cNest.dur=18; // bucle de 5 s del nido, estirado a 18
  // --- kf + mascara ---
  addClip(imgA,V3,100); const cKf=state.clips[state.clips.length-1]; cKf.name='c_kf'; cKf.dur=10; cKf.props.mask='circle';
  setKf(cKf,'size',101,30); setKf(cKf,'size',105,80); setKf(cKf,'az',101,-40); setKf(cKf,'az',108,40);
  // --- fx/fy manual (la envoltura del disco que R247c cambio) ---
  addClip(imgB,V3,115); const cFx=state.clips[state.clips.length-1]; cFx.name='c_fx'; cFx.dur=8;
  cFx.props.el=35; cFx.props.size=30;
  cFx.anim=[{id:uid(),param:'fx',mode:'wave',speed:0.11,amp:0.9,phase:0,on:true},{id:uid(),param:'fy',mode:'wave',speed:0.07,amp:0.5,phase:0.3,on:true}];
  cFx.props['mot:fx:mix']=100; cFx.props['mot:fy:mix']=100;
  // --- pulse de DOMO (siempre funciono) ---
  addClip(imgC,V3,104); const cPd=state.clips[state.clips.length-1]; cPd.name='c_pulsedome'; cPd.dur=6; cPd.props.el=60; cPd.props.size=25; addAnimPreset(cPd,'pulse');
  // --- audio suelto ---
  addClip(aud,null,30); const cAu=state.clips[state.clips.length-1]; cAu.name='c_audio'; toggleLoop(cAu); cAu.dur=25;
  // --- composiciones (en t=100.5 para la ventana de pixeles sin video) ---
  state.playhead=100.5;
  const compRing=createComposition({kind:'ring',mediaIds:[imgB.id,imgA.id],mediaId:imgB.id,count:6,size:40,el:30,arc:140,elMin:10,elMax:60,cols:3,mask:'none',jitter:0,rand:[]});
  if(compRing){ compRing.name='compRing'; const cc=state.clips[state.clips.length-1]; cc.start=100.5; cc.dur=8; }
  state.playhead=100.8;
  const compGrid=createComposition({kind:'grid',mediaIds:[imgA.id,imgB.id,imgC.id],mediaId:imgA.id,count:6,cols:3,size:26,el:30,arc:140,elMin:10,elMax:60,mask:'none',jitter:0,rand:[]});
  if(compGrid){ compGrid.name='compGrid'; const cc=state.clips[state.clips.length-1]; cc.start=100.8; cc.dur=8;
    // retoques manuales por elemento (el delta que _layBase debe conservar)
    if(compGrid.nestClips[1]){ compGrid.nestClips[1].props.az+=15; compGrid.nestClips[1].props.size+=8; }
    if(compGrid.nestClips[2]){ compGrid.nestClips[2].props.opacity=50; } }
  state.playhead=101.0;
  const compRand=createComposition({kind:'random',mediaIds:[imgC.id,imgB.id],mediaId:imgC.id,count:8,size:20,el:30,arc:140,elMin:10,elMax:60,cols:3,mask:'none',jitter:35,rand:[]});
  if(compRand){ compRand.name='compRand'; const cc=state.clips[state.clips.length-1]; cc.start=101.0; cc.dur=8; }
  // --- secuencia 2D con el pulse VIEJO (que estampa size) ---
  const flat=newSeqMedia('Flat2D',30,1920,1080,[],[{id:uid(),name:'V1',tag:'V1',kind:'video'}],'flat'); state.media.push(flat);
  openSeq(flat.id); await new Promise(r=>setTimeout(r,120));
  addClip(imgA,0,0); const f1=state.clips[state.clips.length-1]; f1.name='f_pulse'; f1.dur=8; f1.props.scale=40; addAnimPreset(f1,'pulse');
  addClip(imgB,0,9); const f2=state.clips[state.clips.length-1]; f2.name='f_hmove'; f2.dur=6; f2.props.scale=30; addAnimPreset(f2,'hmove');
  R.f_pulse_params=(f1.anim||[]).map(a=>a.param); // el bug viejo: aqui sale 'size'
  openSeq(mainSeq); await new Promise(r=>setTimeout(r,120));
  // esperar a que los enganches de audio pendientes (attachLinkedAudio async) terminen de aterrizar
  { let prev=-1; const tl=Date.now(); while(Date.now()-tl<15000){ await new Promise(r=>setTimeout(r,700)); if(state.clips.length===prev)break; prev=state.clips.length; } }
  R.clips=state.clips.length; R.media=state.media.length; R.errs=__errs;
  // --- guardar ---
  saveActiveSeq(); const ok=await DSP.writeText('${ISP}', JSON.stringify(serProject()));
  R.guardado=ok!==false;
  return R;
})()`, 240000);
console.log(JSON.stringify(built, null, 1));
if (built.err) process.exit(1);

console.log('\n— reabriendo el .isp con la app VIEJA y tomando la instantanea de verdad —');
await ev(`(async function(){ state.dirty=false; await openProjectPath('${ISP}',true); return 1; })()`, 120000);
// esperar a que los medios re-carguen
await ev(`(async function(){ const t0=Date.now(); while(Date.now()-t0<30000){ if(state.media.every(m=>!m._loading||m.missing)) break; await new Promise(r=>setTimeout(r,200)); } return state.media.filter(m=>m.missing).map(m=>m.name); })()`, 40000).then(m => console.log('medios ausentes tras reabrir (debe ser []):', JSON.stringify(m)));
await espera(1500);

await ev(SNAP_FN);
const snap = await ev(`__snap()`, 120000);
const pix = await ev(`__pix([101.3,103.7,116.1,117.6])`, 120000);
// pixeles de la secuencia 2D (solo fijas)
const pixFlat = await ev(`(async function(){ const f=state.media.find(m=>m.name==='Flat2D'); openSeq(f.id); await new Promise(r=>setTimeout(r,150)); const o=await __pix([1.0,3.4]); const mn=state.media.find(m=>isSeqMedia(m)&&m.name!=='Flat2D'&&!m.comp&&m.name!=='NestLoop'); openSeq(mn.id); await new Promise(r=>setTimeout(r,120)); return o; })()`, 120000);

const out = { fecha: new Date().toISOString(), commit: 'a33c70b', snap, pix, pixFlat };
fs.writeFileSync(DIR + '\\aud8b-viejo-estado.json', JSON.stringify(out, null, 1));
console.log('instantanea escrita: aud8b-viejo-estado.json');
console.log('secuencias:', snap.seqs.join(' · '));
console.log('bucles con srcT:', Object.keys(snap.srcT).length);
console.log('pixeles:', JSON.stringify(pix), JSON.stringify(pixFlat));
