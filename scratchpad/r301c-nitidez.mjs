/* [R301c] LA MEDIDA QUE FALTABA. R301 midio el PROBLEMA (la composicion rendia el 53% de la nitidez del PNG
   directo) pero NO la mejora: al volver a renderizar, la textura del nido esta cacheada y el arnes acaba
   midiendo dos veces el mismo fotograma. Aqui se rompe esa cache a mano entre pasadas.
   Se compara el MISMO fotograma de la MISMA composicion con el tope de la cadena de FX en 2048 (lo de antes)
   y en 4096 (lo de ahora), midiendo energia de gradiente = nitidez. */
import http from 'http'; import fs from 'fs'; import os from 'os'; import path from 'path';
const SHOTS=(process.env.ISP_SHOTS||path.join(os.tmpdir(),'isp-r301c'))+path.sep;
try{ fs.mkdirSync(SHOTS,{recursive:true}); }catch(_){}
const t=await new Promise((r2,rj)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>r2(JSON.parse(b)));}).on('error',rj);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:180000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
await ev(`window.__errs=[];addEventListener('error',e=>__errs.push(String(e.message||e)));
 const ce=console.error;console.error=function(){try{__errs.push('con: '+[...arguments].map(String).join(' '));}catch(_){}return ce.apply(console,arguments);};1`);
await ev(`(async()=>{try{await startDemoProject('dome');}catch(e){window.__d=String(e);}})()`); await wait(2600);
await ev(`(function(){try{if(typeof _tourStop==='function')_tourStop();const o=document.getElementById('tourOv');if(o)o.remove();}catch(e){} resize(); return 1;})()`); await wait(700);

const out={};
/* La regla del tope, leida directamente: es lo que R301 cambio. */
out.A_regla = await ev(`(function(){ const bak=exporting, bc=_fxCap, bn=nestSize;
  const lee=(cap,ns)=>{ exporting=true; _fxCap=cap; nestSize=ns; const v=fxChainSize(); return v; };
  const r={ antes_fijo2048: 2048,
    export4096: lee(4096,4096), export2048: lee(2048,2048), export8192: lee(8192,8192),
    porMuro3840: lee(3840,3840), visor: (exporting=false, fxChainSize()) };
  exporting=bak; _fxCap=bc; nestSize=bn; return r; })()`);

/* Nitidez REAL del mismo fotograma con el tope viejo y con el nuevo, rompiendo la cache entre pasadas. */
out.B_nitidez = await ev(`(async function(){
  /* [R301c] TIENE que ser 4096: el cuello de 2048 solo aprieta cuando la SALIDA es mayor que el. Midiendo a
     2048 las dos pasadas dan lo mismo -comprobado: 0,6432 vs 0,6430- y no se prueba nada. Este es justo el
     caso de Beltran: una composicion montada a 4096. */
  const RES=4096;
  // se busca un clip con ojo de pez; si no lo hay, se le pone a uno para reproducir el caso de Beltran
  let c=state.clips.find(x=>x.props&&x.props.fisheye);
  if(!c){ c=state.clips.find(x=>{const m=mediaById(x.mediaId);return m&&m.kind!=='audio';}); if(!c)return {saltado:'sin clips'};
    c.props.fisheye=true; c.props.fisheyeAmt=60; }
  const t=state.playhead;
  const maxTex=gl.getParameter(gl.MAX_TEXTURE_SIZE)||0; if(maxTex<RES*2)return {saltado:'MAX_TEXTURE_SIZE '+maxTex+' insuficiente'};
  const medir=async(cap)=>{
    // romper TODA cache: el pool de nidos, el render-ahead y las instancias
    try{ freeNestPool(); }catch(_){} try{ raInvalidate(); }catch(_){} try{ disposeAllVinst(); }catch(_){}
    try{ freeFxResources(); }catch(_){}                       // los objetivos intermedios, tambien
    const bakE=exporting, bakC=_fxCap, bakN=nestSize, bakQ=_exportQuality;
    exporting=true; _exportQuality=true; _fxCap=cap; nestSize=cap;
    ensureExportFBO(RES); prepNests(state.clips,t,0); renderExportFrame(t,RES,1,null);
    const px=new Uint8Array(RES*RES*4);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    const gl2=glc.getContext?null:null;                        // el fotograma ya esta en glc
    const cv=document.createElement('canvas'); cv.width=RES; cv.height=RES;
    const cx=cv.getContext('2d'); cx.drawImage(glc,0,0,RES,RES);
    const d=cx.getImageData(0,0,RES,RES).data;
    exporting=bakE; _fxCap=bakC; nestSize=bakN; _exportQuality=bakQ;
    // energia de gradiente: suma de |dI/dx|+|dI/dy| sobre el luma, normalizada por pixeles con contenido
    let e=0, n=0;
    for(let y=1;y<RES-1;y+=2){ for(let x=1;x<RES-1;x+=2){
      const i=(y*RES+x)*4; if(d[i+3]<8)continue;
      const L=(a)=>(d[a]*0.299+d[a+1]*0.587+d[a+2]*0.114);
      e+=Math.abs(L(i)-L(i+8))+Math.abs(L(i)-L(i+RES*8)); n++; } }
    return {cap, energia:+(e/Math.max(1,n)).toFixed(4), pixelesConContenido:n};
  };
  const viejo=await medir(2048);
  const nuevo=await medir(4096);
  return {viejo, nuevo,
    mejoraPorcentual:+(((nuevo.energia-viejo.energia)/Math.max(1e-6,viejo.energia))*100).toFixed(1),
    elNuevoEsMasNitido: nuevo.energia>viejo.energia*1.02}; })()`);

out.errs = await ev(`window.__errs.slice(0,20)`);
console.log(JSON.stringify(out,null,1));
ws.close();
