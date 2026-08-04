import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:60000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
console.log(await ev(`(function(){ const m=state.media.find(x=>x.kind==='video');
  state.clips=[]; const c=makeClip(m,state.lanes.findIndex(l=>l.kind==='video'),30); c.inP=20; c.dur=6.5; state.clips.push(c);
  const antes={start:c.start,inP:c.inP,dur:c.dur};
  const it={id:c.id,start0:c.start,dur0:c.dur,inP0:c.inP,kf0:null,anim0:null};
  trimItem(it,'L',-999);                          // arrastrar el borde izquierdo todo lo que se pueda
  const dsp={start:+c.start.toFixed(2),inP:+(c.inP||0).toFixed(2),dur:+c.dur.toFixed(2)};
  state.clips=[]; renderTimeline();
  return { antes, despues:dsp,
           recupero:+(antes.inP-(c.inP||0)).toFixed(2)+' s de material anterior a la marca de entrada' }; })()`));
ws.close();
