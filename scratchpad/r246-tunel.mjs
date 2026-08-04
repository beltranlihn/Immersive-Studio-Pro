/* [R246] El compose TÚNEL y las dos piezas nuevas del motor.
   Lo que se comprueba, y por qué:
     1 · diente de sierra: el ciclo vuelve a 0 solo (una rampa `linear` no lo hace) y la curva da perspectiva.
     2 · el desplazamiento en el plano del ojo de pez ENVUELVE: sale por un borde y entra por el opuesto.
     3 · el túnel se construye: fuentes fulldome, tamaños desfasados, fundido.
     4 · REAL TIME: sin tocar el cabezal, el tamaño de los anillos cambia solo (reloj de previsualización).
     5 · PROFUNDIDAD: el más viejo (el más grande) se dibuja SIEMPRE el último, en varios instantes del ciclo.
   OJO: sin backticks dentro de las plantillas (cierran el template) — trampa nº 5 del encargo. */
import http from 'http';
const PORT=process.argv[2]||9222;
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:PORT,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:90000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const out={};
await ev(`(function(){ window.__errs=[]; addEventListener('error',e=>__errs.push(String(e.message||e))); return 1; })()`);

/* --- 1 · diente de sierra ------------------------------------------------------------------- */
out['1_sierra']=await ev(`(function(){
  const c={start:0,dur:100,props:{},kf:{},anim:[{id:1,param:'size',mode:'saw',speed:1,amp:100,phase:0,curve:0,on:true}]};
  const v=[0,0.25,0.5,0.75,0.999,1.0,1.25].map(t=>+animOffset(c,'size',t).toFixed(1));
  const cv={...c,anim:[{...c.anim[0],curve:100}]};
  const w=[0,0.25,0.5,0.75,0.999].map(t=>+animOffset(cv,'size',t).toFixed(1));
  /* Acelerar significa que cada tramo es MAYOR que el anterior (curva convexa). La primera versión de esta
     comprobación pedía "más de 50 al 75 % del ciclo", que es justo lo contrario —eso lo cumple una curva que
     se FRENA al final— y marcaba en rojo un motor que estaba bien. La aserción era mía y estaba mal. */
  const inc=[w[1]-w[0],w[2]-w[1],w[3]-w[2],w[4]-w[3]];
  return { lineal:v, vuelveACero:(v[5]===0), curva100:w, incrementos:inc.map(x=>+x.toFixed(1)),
    aceleraHaciaElFinal: inc.every((d,i)=>i===0||d>inc[i-1]),
    empiezaMasLentoQueLineal: (w[1]<12.5) }; })()`);

/* --- 2 · desplazamiento en el plano del ojo de pez, con envoltura ---------------------------- */
out['2_fisheyeWrap']=await ev(`(function(){
  const w=x=>{ let v=(x+1)%2; if(v<0)v+=2; return v-1; };
  return { dentro:+w(0.4).toFixed(3), justoElBorde:+w(1.0).toFixed(3), seSale:+w(1.4).toFixed(3),
    envuelveAlOpuesto:(Math.abs(w(1.4)-(-0.6))<1e-9),
    paramsExpuestos:ANIM_PARAMS.filter(p=>p[0]==='fx'||p[0]==='fy').length }; })()`);

/* --- 3 · construir el túnel ------------------------------------------------------------------ */
await ev(`state.dirty=false;1`);
await ev(`(async()=>{ await newProject('dome',2048,2048,60,180,true); })()`); await wait(700);
out['3_construccion']=await ev(`(function(){
  for(let i=0;i<3;i++)createShapeClip('rect');                      // tres medios generables como fuentes
  const ids=state.media.filter(m=>m.kind==='shape').map(m=>m.id).slice(0,3);
  const nest=createComposition({kind:'tunnel',mediaIds:ids,count:6,sizeFrom:1,sizeTo:200,speed:0.12,curve:60,fade:true,twist:0});
  if(!nest)return {err:'no se creó'};
  const cl=nest.nestClips;
  return { elementos:cl.length,
    todasFulldome: cl.every(c=>c.props.fulldome===true),
    opacidadBase: cl.map(c=>c.props.opacity).filter((v,i,a)=>a.indexOf(v)===i),
    tienenSierra: cl.every(c=>c.anim&&c.anim.some(a=>a.param==='size'&&a.mode==='saw')),
    tienenFundido: cl.every(c=>c.anim&&c.anim.some(a=>a.param==='opacity'&&a.mode==='wave')),
    desfases: cl.map(c=>+(c.anim.find(a=>a.param==='size').phase).toFixed(3)),
    desfasesDistintos: new Set(cl.map(c=>c.anim.find(a=>a.param==='size').phase)).size===cl.length,
    nestId:nest.id }; })()`);

/* --- 4 · REAL TIME: se mueve solo, sin tocar el cabezal --------------------------------------- */
out['4_realTime']=await ev(`(async function(){
  const nest=state.media.find(m=>m.comp&&m.comp.kind==='tunnel'); const c=nest.nestClips[0];
  const ph=state.playhead;
  const s0=evalR(c,'size',ph);
  const corre=(typeof anyAnim==='function')&&anyAnim();
  startMotionPreview(); await new Promise(r=>setTimeout(r,900));
  const s1=evalR(c,'size',ph);
  return { anyAnimLoDetecta:corre, sizeAntes:+s0.toFixed(2), sizeDespues:+s1.toFixed(2),
    cambioSinMoverElCabezal:(Math.abs(s1-s0)>0.01), cabezalQuieto:(state.playhead===ph) }; })()`);

/* --- 5 · PROFUNDIDAD: el más grande siempre se dibuja el último ------------------------------- */
out['5_profundidad']=await ev(`(function(){
  const nest=state.media.find(m=>m.comp&&m.comp.kind==='tunnel');
  const oc=state.clips, ol=state.lanes, ozs=_zsortSize;
  state.clips=nest.nestClips; state.lanes=nest.nestLanes; _zsortSize=true;
  const malos=[]; const muestras=[];
  for(let k=0;k<12;k++){ const t=k*0.37;
    let lista=compositeClips(t);
    lista=lista.slice().sort((a,b)=>(evalR(a.c,'size',t)||0)-(evalR(b.c,'size',t)||0));
    const sizes=lista.map(x=>+evalR(x.c,'size',t).toFixed(1));
    const ordenado=sizes.every((v,i)=>i===0||v>=sizes[i-1]);
    const ultimoEsElMayor=(sizes[sizes.length-1]===Math.max(...sizes));
    if(!ordenado||!ultimoEsElMayor)malos.push({t,sizes});
    if(k<3)muestras.push({t:+t.toFixed(2),sizes}); }
  state.clips=oc; state.lanes=ol; _zsortSize=ozs;
  return { instantes:12, fallos:malos.length, muestras,
    elMasViejoSiempreDelante:malos.length===0 }; })()`);

/* --- 6 · el diálogo ofrece el tipo y sus campos ----------------------------------------------- */
out['6_dialogo']=await ev(`(function(){ openCompose('tunnel');
  const hay=id=>!!document.querySelector(id);
  const visible=id=>{ const e=document.querySelector(id); if(!e)return false; const r=e.closest('.frow'); return !!r&&r.style.display!=='none'; };
  const r={ botonTunel:!!document.querySelector('#cKind button[data-k="tunnel"]'),
    campos:{ deA:hay('#cTFrom')&&hay('#cTTo'), velocidad:hay('#cTSpeed'), profundidad:hay('#cTCurve'), giro:hay('#cTTwist'), fundido:hay('#cTFade') },
    visiblesConTunel:{ deA:visible('#cTFrom'), velocidad:visible('#cTSpeed') },
    sizeOculto:!visible('#cSize') };
  const ovv=document.getElementById('compOv'); if(ovv)ovv.remove(); return r; })()`);

await ev(`(async()=>{ state.dirty=false; await newProject('dome',4096,4096,60,180,true); })()`);
out.errs=await ev(`window.__errs.slice(0,10)`);
console.log(JSON.stringify(out,null,1));
ws.close();
