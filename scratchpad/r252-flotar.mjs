/* [R252] El efecto Flotar: que estampe los tres modificadores, que MUEVA de verdad en los tres ejes, y que el
   recorrido no se repita a cada vuelta. De paso, el fallo de `pulse` en secuencias planas. */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:90000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
await cmd('Page.enable'); await cmd('Page.reload',{ignoreCache:true}); await wait(3800);
await ev(`(function(){ window.__errs=[]; addEventListener('error',e=>__errs.push(String(e.message||e))); return 1; })()`);

/* ---------- DOMO ---------- */
await ev(`(async()=>{ await newProject('dome',2048,2048,60,180,true); if(typeof hideLanding==='function')hideLanding(); })()`); await wait(1100);
const dom=await ev(`(function(){
  const cv=document.createElement('canvas'); cv.width=cv.height=64; cv.getContext('2d').fillRect(0,0,64,64);
  const m={id:uid(),kind:'image',name:'F',el:cv,originalEl:cv,tex:newTex(),w:1000,h:1000,dur:60,fps:0,color:'#888',missing:false,_loading:false};
  state.media.push(m); renderMedia();
  const c=makeClip(m,state.lanes.findIndex(l=>l.kind==='video'),0); c.dur=60; state.clips.push(c);
  state.selId=c.id; state.selIds=[c.id];
  addAnimPreset(c,'float');
  const partes=c.anim.map(a=>({p:a.param,modo:a.mode,vel:a.speed,amp:a.amp,fase:a.phase}));
  /* el recorrido REAL: az/el del clip a lo largo de un minuto */
  const rec=[]; for(let i=0;i<=60;i++){ const T=i;
    rec.push([+animOffset(c,'fx',T).toFixed(4), +animOffset(c,'fy',T).toFixed(4), +animOffset(c,'rot',T).toFixed(3)]); }
  const rango=k=>{ const v=rec.map(r=>r[k]); return +(Math.max(...v)-Math.min(...v)).toFixed(4); };
  /* ¿se repite el recorrido al cabo de un ciclo del mas lento (18,2 s)? */
  const d=(a,b)=>Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])+Math.abs(a[2]-b[2])/50;
  return { partes, recorridoFx:rango(0), recorridoFy:rango(1), recorridoRot:rango(2),
           mix:['fx','fy','rot'].map(k=>c.props['mot:'+k+':mix']),
           difA18s:+d(rec[0],rec[18]).toFixed(4), difA36s:+d(rec[0],rec[36]).toFixed(4) }; })()`);
console.log('DOMO · Flotar');
console.log('   modificadores: '+JSON.stringify(dom.partes));
console.log('   recorrido real en 60 s → fx '+dom.recorridoFx+'  fy '+dom.recorridoFy+'  rot '+dom.recorridoRot+'°');
console.log('   mix de cada uno: '+JSON.stringify(dom.mix)+(dom.mix.every(v=>v===100)?'  (100, correcto)':'  *** ***'));
console.log('   ¿vuelve al mismo punto? a los 18 s: '+dom.difA18s+' · a los 36 s: '+dom.difA36s
  +((dom.difA18s>0.01&&dom.difA36s>0.01)?'   (no se repite, correcto)':'   *** el recorrido se cierra ***'));

/* ---------- PLANO ---------- */
const flat=await ev(`(async()=>{ await newProject('flat',1920,1080,60,180,true); if(typeof hideLanding==='function')hideLanding();
  await new Promise(r=>setTimeout(r,900));
  const cv=document.createElement('canvas'); cv.width=cv.height=64; cv.getContext('2d').fillRect(0,0,64,64);
  const m={id:uid(),kind:'image',name:'F',el:cv,originalEl:cv,tex:newTex(),w:1000,h:1000,dur:60,fps:0,color:'#888',missing:false,_loading:false};
  state.media.push(m); renderMedia();
  const c=makeClip(m,state.lanes.findIndex(l=>l.kind==='video'),0); c.dur=60; state.clips.push(c);
  state.selId=c.id; state.selIds=[c.id];
  addAnimPreset(c,'float');
  const partes=c.anim.map(a=>a.param);
  const rango=k=>{ let mn=1e9,mx=-1e9; for(let i=0;i<=60;i++){ const v=animOffset(c,k,i); if(v<mn)mn=v; if(v>mx)mx=v; } return +(mx-mn).toFixed(3); };
  /* y el fallo de pulse: en una secuencia PLANA debe animar scale, no size */
  const c2=makeClip(m,state.lanes.findIndex(l=>l.kind==='video'),0); state.clips.push(c2);
  state.selId=c2.id; addAnimPreset(c2,'pulse');
  return { partes, x:rango('x'), y:rango('y'), rot:rango('rot'),
           pulseParam:c2.anim[0].param, esFlat:isFlat() }; })()`);
console.log('\nPLANO · Flotar');
console.log('   modificadores: '+JSON.stringify(flat.partes)+(JSON.stringify(flat.partes)==='["x","y","rot"]'?'  (correcto)':'  *** ***'));
console.log('   recorrido en 60 s → x '+flat.x+'  y '+flat.y+'  rot '+flat.rot+'°');
console.log('   [fallo de paso] chip Pulsar en secuencia plana → anima "'+flat.pulseParam+'"'
  +(flat.pulseParam==='scale'?'   (scale, correcto)':'   *** deberia ser scale ***'));
console.log('\nerrs:',JSON.stringify(await ev(`window.__errs.slice(0,6)`)));
ws.close();
