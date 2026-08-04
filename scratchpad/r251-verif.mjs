/* [R251] 1) copiar/pegar VARIOS clips  2) el compose busca pista con hueco en vez de crear una nueva siempre. */
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
await ev(`(async()=>{ await newProject('dome',2048,2048,60,180,true); if(typeof hideLanding==='function')hideLanding(); })()`); await wait(1100);

/* medios de prueba */
await ev(`window.__medios=function(n){ const out=[];
  for(let i=0;i<n;i++){ const cv=document.createElement('canvas'); cv.width=cv.height=64;
    const m={id:uid(),kind:'image',name:'M'+(i+1),el:cv,originalEl:cv,tex:newTex(),w:1920,h:1080,dur:8,fps:0,color:'#888',missing:false,_loading:false};
    state.media.push(m); out.push(m); }
  renderMedia(); return out; };
window.__vlanes=function(){ return state.lanes.map((l,i)=>({i,tag:l.tag,kind:l.kind})).filter(o=>o.kind==='video'); };
window.__mapa=function(){ return state.clips.map(c=>({lane:state.lanes[c.lane]?state.lanes[c.lane].tag:'?',start:+c.start.toFixed(2),dur:+c.dur.toFixed(2),n:c.name})).sort((a,b)=>a.lane.localeCompare(b.lane)||a.start-b.start); };1`);

/* ---------- 1) copiar y pegar VARIOS ---------- */
const c1=await ev(`(function(){ state.clips=[]; const ms=__medios(3);
  const vl=state.lanes.map((l,i)=>({l,i})).filter(o=>o.l.kind==='video').map(o=>o.i);
  /* tres clips, en pistas distintas y con separaciones distintas */
  const a=makeClip(ms[0],vl[0],2); a.dur=3;
  const b=makeClip(ms[1],vl[1],4); b.dur=2;
  const c=makeClip(ms[2],vl[0],7); c.dur=1.5;
  state.clips.push(a,b,c);
  state.selIds=[a.id,b.id,c.id]; state.selId=a.id;
  copyClip();
  const guardados=(state.clipboard&&state.clipboard.items)?state.clipboard.items.length:1;
  state.playhead=20; pasteClip();
  const pegados=state.clips.length-3;
  const nuevos=state.clips.slice(3).map(x=>({lane:state.lanes[x.lane].tag,start:+x.start.toFixed(2),dur:+x.dur.toFixed(2)}));
  return { copiados:guardados, pegados, nuevos,
           originales:[{lane:'V1',start:2},{lane:'V2',start:4},{lane:'V1',start:7}] }; })()`);
console.log('1) COPIAR / PEGAR VARIOS');
console.log('   guardados en el portapapeles: '+c1.copiados+(c1.copiados===3?'  (los 3)':'  *** deberian ser 3 ***'));
console.log('   pegados                     : '+c1.pegados+(c1.pegados===3?'  (los 3)':'  *** deberian ser 3 ***'));
console.log('   donde caen (cabezal en 20)  : '+JSON.stringify(c1.nuevos));
console.log('   separaciones conservadas    : '+((c1.nuevos[0].start===20&&c1.nuevos[1].start===22&&c1.nuevos[2].start===25)?'si (20, 22, 25 = 0, +2, +5)':'*** NO ***')
  +'  ·  pistas conservadas: '+((c1.nuevos[0].lane===c1.nuevos[2].lane&&c1.nuevos[1].lane!==c1.nuevos[0].lane)?'si':'*** NO ***'));

/* ---------- 2) el compose busca pista ---------- */
const c2=await ev(`(function(){ state.clips=[]; state.media=state.media.filter(m=>m.kind!=='nest');
  const ms=__medios(2); const ids=ms.map(m=>m.id);
  const vl=state.lanes.map((l,i)=>({l,i})).filter(o=>o.l.kind==='video').map(o=>o.i);
  const antesPistas=__vlanes().length;
  /* V1 ocupada justo donde va a caer; V2, V3, V4 libres */
  const occ=makeClip(ms[0],vl[0],0); occ.dur=30; state.clips.push(occ);
  state.playhead=5; state.selId=occ.id; state.selIds=[occ.id];   // trabajando en V1 → la mas cercana con hueco es V2
  const n1=createComposition({kind:'ring',mediaIds:ids,count:6,size:40,el:30});
  const trasUno={ pistas:__vlanes().length, mapa:__mapa() };
  /* otra composicion en el mismo sitio: V2 ya esta ocupada → V3 */
  state.playhead=5;
  const n2=createComposition({kind:'ring',mediaIds:ids,count:6,size:40,el:30});
  const trasDos={ pistas:__vlanes().length, mapa:__mapa() };
  /* y otra, y otra: hasta agotar V4 y recien ahi crear pista */
  state.playhead=5; createComposition({kind:'ring',mediaIds:ids,count:6,size:40,el:30});
  const trasTres={ pistas:__vlanes().length };
  state.playhead=5; createComposition({kind:'ring',mediaIds:ids,count:6,size:40,el:30});
  const trasCuatro={ pistas:__vlanes().length };
  /* ahora una en un hueco LIBRE de tiempo: el minuto 2, donde no hay nada */
  state.playhead=120; createComposition({kind:'ring',mediaIds:ids,count:6,size:40,el:30});
  const trasHueco={ pistas:__vlanes().length, ultimo:state.clips[state.clips.length-1] };
  return { antesPistas, trasUno, trasDos, trasTres, trasCuatro,
           trasHueco:{ pistas:trasHueco.pistas, lane:state.lanes[trasHueco.ultimo.lane].tag, start:trasHueco.ultimo.start } }; })()`);
console.log('\n2) DONDE CAE UN COMPOSE  (4 pistas de video de partida, V1 ocupada 0-30 s, cabezal en 5)');
console.log('   1a composicion → pistas: '+c2.trasUno.pistas+(c2.trasUno.pistas===4?'  (ninguna nueva)':'  *** creo pista ***'));
console.log('      '+JSON.stringify(c2.trasUno.mapa));
console.log('   2a composicion → pistas: '+c2.trasDos.pistas+(c2.trasDos.pistas===4?'  (ninguna nueva)':'  *** creo pista ***'));
console.log('   3a composicion → pistas: '+c2.trasTres.pistas+(c2.trasTres.pistas===4?'  (ninguna nueva)':'  *** creo pista ***'));
console.log('   4a composicion → pistas: '+c2.trasCuatro.pistas+(c2.trasCuatro.pistas===5?'  (agotadas las 4 → crea la 5a, correcto)':'  *** esperaba 5 ***'));
console.log('   en el minuto 2 (libre)  → pista '+c2.trasHueco.lane+' · pistas totales '+c2.trasHueco.pistas
  +(c2.trasHueco.pistas===5?'  (reutiliza, no crea)':'  *** creo otra ***'));
console.log('\nerrs:',JSON.stringify(await ev(`window.__errs.slice(0,6)`)));
ws.close();
