/* [R241·diag] ¿Está el motor dibujando de verdad? Números de 0,07 ms/render con cuatro capas de 7196×912 no
   son creíbles: antes de reportar hay que saber si hay textura de vídeo y si el composite sale con tinta. */
import http from 'http';
const PORT=process.argv[2]||9223;
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:PORT,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:300000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const out={};

out.estado=await ev(`(function(){ const t=state.playhead;
  const act=state.clips.filter(c=>t>=c.start&&t<c.start+c.dur);
  return { playhead:t, clipsTotales:state.clips.length, activosAquí:act.length,
    clips:state.clips.map(c=>({ id:c.id, lane:c.lane, laneKind:(state.lanes[c.lane]||{}).kind,
      surf:(state.lanes[c.lane]||{}).surf||null, mute:!!(state.lanes[c.lane]||{}).mute,
      start:+c.start.toFixed(2), dur:+c.dur.toFixed(2),
      medio:(mediaById(c.mediaId)||{}).name, px:((mediaById(c.mediaId)||{}).w||'')+'x'+((mediaById(c.mediaId)||{}).h||''),
      texLista:clipTexReady(c,mediaById(c.mediaId)), op:c.props.opacity })),
    dibujados:compositeClips(t).length }; })()`);

out.decodificadores=await ev(`(function(){ const r=[];
  try{ for(const [cid,vi] of _vinst){ r.push({ clip:cid, ready:!!(vi&&vi.ready), tieneTex:!!(vi&&vi.vtex),
    w:vi&&vi.w, h:vi&&vi.h, tiempo:vi&&vi.t }); } }catch(e){ return {err:String(e.message||e)}; }
  return { instancias:r.length, detalle:r }; })()`);

/* ¿el composite sale con tinta? se cuenta cobertura real leyendo el FBO a calidad baja (barato) */
out.tinta=await ev(`(function(){ const q=state.previewQuality||1; applyPreviewQuality(0.25); render();
  const w=compW,h=compH,px=new Uint8Array(w*h*4);
  gl.bindFramebuffer(gl.FRAMEBUFFER,compFBO); gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,px); gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  let n=0,suma=0; for(let i=0;i<w*h;i++){ const o=i*4; if(px[o+3]>16){ n++; suma+=px[o]+px[o+1]+px[o+2]; } }
  applyPreviewQuality(q); render();
  return { composite:[w,h], pintados:n, cobertura:+(n/(w*h)).toFixed(4), brilloMedio:n?Math.round(suma/(3*n)):0 }; })()`);

/* coste REAL del composite aislado (sin el resto de render()) y del blit a pantalla */
out.coste=await ev(`(function(){ const mid=(f,n)=>{ const a=[]; for(let i=0;i<n;i++){ const t0=performance.now(); f(); gl.finish(); a.push(performance.now()-t0); }
    a.sort((x,y)=>x-y); return +a[Math.floor(a.length/2)].toFixed(2); };
  const t=state.playhead;
  return {
    compositeSolo: mid(()=>{ gl.bindFramebuffer(gl.FRAMEBUFFER,compFBO); composite(t,null,false,true); gl.bindFramebuffer(gl.FRAMEBUFFER,null); },12),
    renderCompleto: mid(()=>render(),12),
    prepNests: mid(()=>prepNests(state.clips,t,0),12) }; })()`);

out.errs=await ev(`window.__errs.slice(-8)`);
console.log(JSON.stringify(out,null,1));
ws.close();
