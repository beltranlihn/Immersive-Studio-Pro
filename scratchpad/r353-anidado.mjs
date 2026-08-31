/* [R353] Deteccion del reloj en nidos ANIDADOS + coste por fotograma. Ojo: medir ANTES de quitar los
   medios de state.media — `nestConReloj` desciende via `mediaById`, y si ya no estan da un falso NO. */
import http from 'http';
const t=await new Promise((r2,rj)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>r2(JSON.parse(b)));}).on('error',rj);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:120000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
await ev(`(async()=>{try{await startDemoProject('dome');}catch(e){}})()`); await wait(2600);
await ev(`(function(){try{if(typeof _tourStop==='function')_tourStop();const o=document.getElementById('tourOv');if(o)o.remove();}catch(e){} return 1;})()`); await wait(600);
console.log(JSON.stringify(await ev(`(function(){
  const src=state.media.find(m=>m.kind!=='audio'&&!isSeqMedia(m));
  const hacer=(nom,hijo,ponReloj)=>{ const n=newSeqMedia(nom,state.fps,1024,1024,null,null,'dome',180);
    n.nestClips=[]; n.nestLanes=[{id:uid(),name:'V1',tag:'V1',kind:'video'}];
    for(let i=0;i<3;i++){ const c=makeClip((i===2&&hijo)?hijo:src,0,0,{az:0,el:45,size:40},{}); c.dur=4; c.lane=0; n.nestClips.push(c); }
    if(ponReloj) n.nestClips[2].anim=[{k:'saw',p:'az',amt:360,speed:0.25}];
    n.dur=4; n.ncReady=true; n.ncUrl='file:///x.mp4'; n.ncStale=false; state.media.push(n); return n; };
  // reloj SOLO en el nivel mas profundo
  const hondo=hacer('h',null,true), medio=hacer('m',hondo,false), raiz=hacer('r',medio,false);
  // y un arbol gemelo SIN reloj en ningun nivel
  const h2=hacer('h2',null,false), m2=hacer('m2',h2,false), r2=hacer('r2',m2,false);
  const cRaiz=makeClip(raiz,0,0,{},{}); cRaiz.dur=8; cRaiz.loop=true; cRaiz.loopLen=2; cRaiz.inP=0;
  const cR2  =makeClip(r2  ,0,0,{},{}); cR2.dur=8;  cR2.loop=true;  cR2.loopLen=2;  cR2.inP=0;
  const r={ elHijoResuelve: !!mediaById(raiz.nestClips[2].mediaId),
    relojEnNivel3_detectado: nestConReloj(raiz),   // debe ser TRUE (baja 3 niveles)
    relojEnNivel2_detectado: nestConReloj(medio),  // TRUE
    relojEnNivel1_detectado: nestConReloj(hondo),  // TRUE (directo)
    arbolSinReloj_detectado: nestConReloj(r2),     // debe ser FALSE
    decisionAnidada:  ncUsableFor(cRaiz,raiz),     // debe ser FALSE (no usar cache)
    decisionSinReloj: ncUsableFor(cR2,r2) };       // debe ser TRUE
  [raiz,medio,hondo,r2,m2,h2].forEach(n=>{state.media=state.media.filter(m=>m.id!==n.id);});
  return r; })()`),null,1));
ws.close();
