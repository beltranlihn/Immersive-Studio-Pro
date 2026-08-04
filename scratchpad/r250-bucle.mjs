/* [R250] Que hace HOY el bucle, medido: de donde sale el rango loopeable y que pasa al apagarlo. */
import http from 'http'; import fs from 'fs'; import path from 'path';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:60000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));

const r=await ev(`(function(){ const m=state.media.find(x=>x.kind==='video'); if(!m)return {err:'sin video'};
  const out={durArchivo:+m.dur.toFixed(2)};
  const nuevo=(inP,dur)=>{ state.clips=[]; const c=makeClip(m,state.lanes.findIndex(l=>l.kind==='video'),0); c.inP=inP; c.dur=dur; state.clips.push(c); return c; };

  /* A) el caso comun: clip entero, se enciende el bucle */
  let c=nuevo(0,m.dur); toggleLoop(c);
  out.A={ que:'clip entero → Loop', dur:+c.dur.toFixed(2), loopLen:+(c.loopLen||0).toFixed(2) };

  /* B) recortar PRIMERO y despues encender el bucle */
  c=nuevo(0,6); toggleLoop(c);
  out.B={ que:'recortado a 6 s → Loop', dur:+c.dur.toFixed(2), loopLen:+(c.loopLen||0).toFixed(2) };

  /* C) el que sale del monitor: inP 20, dura lo marcado */
  c=nuevo(20,6.5); toggleLoop(c);
  out.C={ que:'del monitor (inP 20, 6,5 s) → Loop', inP:c.inP, dur:+c.dur.toFixed(2), loopLen:+(c.loopLen||0).toFixed(2) };
  /* ...y al estirarlo, que fotograma toca a los 10 s de linea de tiempo */
  c.dur=40; const src10=srcT(c,10), src20=srcT(c,20);
  out.C.aLos10s=+src10.toFixed(2); out.C.aLos20s=+src20.toFixed(2);
  out.C.envuelveEn=[+(c.inP).toFixed(2), +(c.inP+c.loopLen).toFixed(2)];

  /* D) apagar el bucle con el clip ya estirado: que le pasa a la duracion */
  const durAntes=c.dur; toggleLoop(c);
  out.D={ que:'apagar Loop con el clip estirado a 40 s', durAntes:+durAntes.toFixed(2), durDespues:+c.dur.toFixed(2), loopLen:(c.loopLen||null) };

  /* E) estirar el borde derecho SIN bucle: hasta donde deja */
  c=nuevo(20,6.5); const it={id:c.id,start0:c.start,dur0:c.dur,inP0:c.inP};
  trimItem(it,'R',999); out.E={ que:'estirar el borde derecho (sin bucle)', dur:+c.dur.toFixed(2), restoDelArchivo:+(m.dur-20).toFixed(2) };
  /* F) y el borde izquierdo, para recuperar lo de antes de la entrada */
  c=nuevo(20,6.5); const it2={id:c.id,start0:c.start,dur0:c.dur,inP0:c.inP,kf0:null,anim0:null};
  trimItem(it2,'L',-999); out.F={ que:'arrastrar el borde izquierdo hacia atras', inP:+(c.inP!=null?c.inP:0).toFixed(2), start:+c.start.toFixed(2) };
  state.clips=[]; renderTimeline();
  return out; })()`);
if(r.err){ console.log(r.err); ws.close(); process.exit(0); }
console.log('archivo de '+r.durArchivo+' s\n');
for(const k of ['A','B','C','D','E','F']){ const o=r[k]; console.log(k+') '+o.que); 
  for(const kk of Object.keys(o)) if(kk!=='que') console.log('     '+kk+': '+JSON.stringify(o[kk])); }
ws.close();
