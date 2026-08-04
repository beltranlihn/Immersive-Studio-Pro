/* [R252b] El maestro de intensidad: escala los tres, conserva proporciones, respeta retoques a mano,
   sobrevive al 0 y viaja en el .isp. */
import http from 'http'; import fs from 'fs'; import path from 'path';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:90000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
await cmd('Page.enable'); await cmd('Page.reload',{ignoreCache:true}); await wait(3800);
await ev(`(function(){ window.__errs=[]; addEventListener('error',e=>__errs.push(String(e.message||e))); return 1; })()`);
await ev(`(async()=>{ await newProject('dome',2048,2048,60,180,true); if(typeof hideLanding==='function')hideLanding(); })()`); await wait(1100);
const r=await ev(`(function(){
  const cv=document.createElement('canvas'); cv.width=cv.height=64; cv.getContext('2d').fillRect(0,0,64,64);
  const m={id:uid(),kind:'image',name:'F',el:cv,originalEl:cv,tex:newTex(),w:1000,h:1000,dur:60,fps:0,color:'#888',missing:false,_loading:false};
  state.media.push(m); renderMedia();
  const c=makeClip(m,state.lanes.findIndex(l=>l.kind==='video'),0); c.dur=60; state.clips.push(c);
  state.selId=c.id; state.selIds=[c.id];
  addAnimPreset(c,'float'); renderInspector();
  const amps=()=>c.anim.map(a=>+a.amp.toFixed(5));
  const out={ alPonerlo:amps(), grupos:animGroups(c).length, filaEnPantalla:!!document.querySelector('#animList input[type=range]') };
  const gid=c.anim[0].gid;
  setAnimGroupInt(c,gid,2);      out.al200=amps();
  setAnimGroupInt(c,gid,0.5);    out.al50=amps();
  /* retoque a mano del balanceo, y despues mover el maestro */
  const rot=c.anim.find(a=>a.param==='rot'); rot.amp=0.5;   // a mano: que gire mucho menos
  setAnimGroupInt(c,gid,1);      out.trasRetoqueY100=amps();
  /* a cero y de vuelta */
  setAnimGroupInt(c,gid,0);      out.a0=amps();
  setAnimGroupInt(c,gid,1);      out.deVueltaA100=amps();
  return out; })()`);
console.log('al ponerlo (100%)        : '+JSON.stringify(r.alPonerlo)+'   grupos: '+r.grupos+'   fila visible: '+r.filaEnPantalla);
console.log('al 200%                  : '+JSON.stringify(r.al200)+(r.al200.every((v,i)=>Math.abs(v-r.alPonerlo[i]*2)<1e-6)?'   (x2 exacto)':'   *** ***'));
console.log('al 50%                   : '+JSON.stringify(r.al50)+(r.al50.every((v,i)=>Math.abs(v-r.alPonerlo[i]*0.5)<1e-6)?'   (x0,5 exacto)':'   *** ***'));
console.log('rot bajado a mano a 0,5 y maestro al 100%:');
console.log('                           '+JSON.stringify(r.trasRetoqueY100)
  +(Math.abs(r.trasRetoqueY100[2]-1)<1e-6?'   (rot=1 = 0,5 x2, el retoque SOBREVIVE)':'   *** el retoque se perdio ***'));
console.log('a 0%                     : '+JSON.stringify(r.a0)+(r.a0.every(v=>v===0)?'   (todo quieto)':'   *** ***'));
console.log('de vuelta al 100%        : '+JSON.stringify(r.deVueltaA100)
  +(r.deVueltaA100.every((v,i)=>Math.abs(v-r.trasRetoqueY100[i])<1e-6)?'   (recupera las proporciones)':'   *** se perdieron ***'));

/* que viaje en el .isp */
const ISP=path.join(process.cwd(),'scratchpad','r252b.isp');
try{fs.rmSync(ISP);}catch(e){}
await ev(`(async()=>{ setAnimGroupInt(state.clips[0],state.clips[0].anim[0].gid,1.7);
  await DSP.writeText(${JSON.stringify(ISP)}, JSON.stringify(serProject())); })()`);
await ev(`(async()=>{ const txt=await DSP.readText(${JSON.stringify(ISP)}); currentPath=${JSON.stringify(ISP)}; loadProject(JSON.parse(stripBom(txt))); })()`); await wait(1600);
const r2=await ev(`(function(){ const c=state.clips[0]; if(!c||!c.anim)return {err:1};
  const g=animGroups(c)[0];
  return { intensidad:g?g.int:null, miembros:g?g.n:0, amps:c.anim.map(a=>+a.amp.toFixed(5)) }; })()`);
console.log('\ntras guardar y reabrir   : intensidad '+r2.intensidad+' · '+r2.miembros+' miembros · amps '+JSON.stringify(r2.amps)
  +(r2.intensidad===1.7?'   (se conserva)':'   *** se perdio ***'));
console.log('\nerrs:',JSON.stringify(await ev(`window.__errs.slice(0,6)`)));
ws.close();
