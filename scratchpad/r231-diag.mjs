/* [R231] Diagnóstico fino: por qué el clic sobre la arista no insertó, y el caso de audio con medio de vídeo. */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:60000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const out={};
await ev(`window.__errs=window.__errs||[];1`);

out.elemento = await ev(`({ gridcId:(typeof gridc!=='undefined'&&gridc)?gridc.id:'??', hayGrid:!!document.getElementById('grid'), hayGridc:!!document.getElementById('gridc') })`);

/* rehacer el caso de la máscara, esta vez llamando al manejador DIRECTAMENTE y mirando cada guarda */
out.mask = await ev(`(function(){ const c=state.clips.find(x=>{const l=state.lanes[x.lane];return l&&l.surf==='wall';});
  if(!c)return {sinClip:true};
  state.selId=c.id; state.selIds=[c.id];
  if(state.playhead<c.start||state.playhead>=c.start+c.dur)state.playhead=c.start+0.1;
  /* la máscara del sondeo salía de 5 px en pantalla: se agranda el clip para que las aristas sean agarrables */
  Object.assign(c.props,{x:0,y:0,scale:60,rot:0});
  c.penMasks=[{pts:[[0.2,0.2],[0.8,0.2],[0.8,0.8],[0.2,0.8]],feather:0,invert:false,on:true}]; c._penSel=0;
  startMaskEdit(c,0); render();
  const mk=c.penMasks[0], m=mediaById(c.mediaId), t=state.playhead;
  const a=penPtPix(c,m,t,mk.pts[0]), b=penPtPix(c,m,t,mk.pts[1]);
  const mx=(a[0]+b[0])/2, my=(a[1]+b[1])/2;
  const CP=clipPanel(c);
  const hit=maskSegHit(mx,my);
  const ls=hit?penFromPix(c,m,t,hit.x,hit.y):null;
  const n0=mk.pts.length;
  const ret=maskEditPointerDown({button:0,shiftKey:false},mx,my); // llamada DIRECTA, sin pasar por el DOM
  const n1=mk.pts.length;
  const res={ ladoPx:Math.round(Math.hypot(b[0]-a[0],b[1]-a[1])), enClip:(t>=c.start&&t<c.start+c.dur),
    panel:CP?CP.surf:null, dentroDelPanel:CP?(hit.x>=CP.x&&hit.x<CP.x+CP.w&&hit.y>=CP.y&&hit.y<CP.y+CP.h):null,
    hit:hit?{si:hit.si}:null, penFromPixOk:!!ls, devuelve:ret,
    antes:n0, despues:n1, insertado:(n1===n0+1),
    ordenCorrecto:(n1===n0+1)?JSON.stringify(mk.pts.map(q=>[+q[0].toFixed(2),+q[1].toFixed(2)])):null };
  /* y ahora por el DOM, en el elemento correcto */
  const el=(typeof gridc!=='undefined'&&gridc)?gridc:document.getElementById('grid');
  const r=el.getBoundingClientRect();
  const n2=mk.pts.length;
  el.dispatchEvent(new PointerEvent('pointerdown',{clientX:r.left+mx,clientY:r.top+my+0.0,button:0,buttons:1,bubbles:true,pointerId:1}));
  res.porDOM_antes=n2; res.porDOM_despues=mk.pts.length;
  /* clic en el vacío: no debe añadir */
  const centro=penPtPix(c,m,t,[0.5,0.5]); const n3=mk.pts.length;
  const retVacio=maskEditPointerDown({button:0,shiftKey:false},centro[0],centro[1]);
  res.vacio_antes=n3; res.vacio_despues=mk.pts.length; res.vacio_devuelve=retVacio;
  endMaskEdit(true); c.penMasks=[]; delete c._penSel; render(); return res; })()`);

/* audio de un clip de vídeo: la pista manda sobre el medio */
out.audio = await ev(`(function(){ const li=state.lanes.findIndex(l=>l.kind==='audio');
  if(li<0)return {sinPistaDeAudio:true};
  const falso={id:-999,lane:li,mediaId:'no-existe',start:0,dur:2,props:{}};
  state.clips.push(falso);
  const enAudio=isAudioClip(falso);
  const destino=m=>(isAudioClip(falso)||(m&&m.kind==='audio'))?'audio':'video';
  const r={ pistaAudioIdx:li, enPistaDeAudio:enAudio,
    conMedioDeVideo:destino({kind:'video'}),   // el caso del bug: audio de un vídeo
    conMedioDeAudio:destino({kind:'audio'}) };
  /* y el contrario: un clip en pista de VÍDEO con medio de vídeo sigue siendo vídeo */
  const lv=state.lanes.findIndex(l=>l.kind==='video');
  falso.lane=lv; r.enPistaDeVideo_destino=(isAudioClip(falso)||false)?'audio':'video';
  state.clips.pop(); return r; })()`);

out.errs = await ev(`window.__errs.slice(0,20)`);
console.log(JSON.stringify(out,null,1));
ws.close();
