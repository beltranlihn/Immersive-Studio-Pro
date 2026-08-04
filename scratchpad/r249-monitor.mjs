/* [R249] El monitor de origen, de punta a punta y con un VIDEO REAL de Neurocosm (que es material largo, el caso
   que motivo la herramienta). Comprueba: doble clic abre · el transporte corre · las marcas se ponen y se guardan
   en el .isp · arrastrar suelta SOLO el trozo marcado · el boton del inspector abre con la entrada/salida del clip.
   Sin acentos graves dentro de las plantillas. */
import http from 'http'; import fs from 'fs'; import path from 'path';
const PORT=process.argv[2]||9222;
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:PORT,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:120000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));

await cmd('Page.enable'); await cmd('Page.reload',{ignoreCache:true}); await wait(3500);
await ev(`(function(){ window.__errs=[]; addEventListener('error',e=>__errs.push(String(e.message||e))); return 1; })()`);
await ev(`state.dirty=false;1`);
await ev(`(async()=>{ await newProject('dome',2048,2048,60,180,true); })()`); await wait(1000);
await ev(`(function(){ if(typeof hideLanding==='function')hideLanding(); resize(); render(); return 1; })()`); await wait(300);

/* un video real del material de Beltran */
const RAIZ='C:\\Users\\beltr\\Desktop\\Alma Digital Studio';
function buscaVideo(dir,prof){ if(prof>4)return null;
  let ent=[]; try{ ent=fs.readdirSync(dir,{withFileTypes:true}); }catch(e){ return null; }
  for(const e of ent){ if(e.isFile()&&/\.(mp4|mov|m4v)$/i.test(e.name)){ const p2=path.join(dir,e.name); if(fs.statSync(p2).size>2e6)return p2; } }
  for(const e of ent){ if(e.isDirectory()){ const r=buscaVideo(path.join(dir,e.name),prof+1); if(r)return r; } }
  return null; }
const VID=buscaVideo(RAIZ,0);
if(!VID){ console.log('no encontre video en '+RAIZ); ws.close(); process.exit(0); }
console.log('material: '+path.basename(VID));

await ev(`window.__addVid=function(ruta,nombre){ return new Promise(res=>{
  const url=DSP.toFileURL(ruta); const v=document.createElement('video'); v.preload='metadata'; v.src=url;
  v.addEventListener('loadedmetadata',()=>{ const m={id:uid(),name:nombre,kind:'video',el:v,originalEl:v,srcUrl:url,tex:newTex(),
      w:v.videoWidth,h:v.videoHeight,dur:v.duration,fps:30,thumb:null,color:clipColorFor('video'),proxyReady:false,proxyPct:0,
      path:ruta,fsize:0,folder:null,missing:false,_loading:false};
    state.media.push(m); renderMedia(); res({n:nombre,dur:+m.dur.toFixed(2),w:m.w,h:m.h}); });
  v.addEventListener('error',()=>res(null)); }); };1`);
const info=await ev(`__addVid(${JSON.stringify(VID)},${JSON.stringify(path.basename(VID))})`);
if(!info){ console.log('el video no cargo'); ws.close(); process.exit(0); }
console.log('   '+info.w+'x'+info.h+'  '+info.dur+' s');

/* 1) doble clic en el panel abre el monitor (y NO suelta un clip en la linea de tiempo) */
const r1=await ev(`(function(){ const antes=state.clips.length;
  const it=document.querySelector('#mediaList .mitem'); if(!it)return {err:'sin fila en el panel'};
  it.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));
  const mon=document.querySelector('#srcMon');
  return { abre:!!mon, clipsAntes:antes, clipsDespues:state.clips.length,
           nombre:mon?mon.querySelector('.smname').textContent:'-',
           hayVideo:!!(mon&&mon.querySelector('video')) }; })()`);
await wait(900);
console.log('\n1) doble clic → monitor      : '+(r1.abre?'abre':'*** NO abre ***')+
            '   ·  clips en la linea: '+r1.clipsAntes+' → '+r1.clipsDespues+(r1.clipsDespues===r1.clipsAntes?'  (no suelta nada, correcto)':'  *** solto un clip ***'));

/* 2) el transporte corre de verdad */
const r2=await ev(`(async()=>{ smSeek(2); const t0=_srcMon.t; smAccion('play');
  await new Promise(r=>setTimeout(r,1200));
  const t1=_srcMon.t, sonando=_srcMon.playing; smAccion('play');
  return { t0:+t0.toFixed(2), t1:+t1.toFixed(2), avanzo:+(t1-t0).toFixed(2), sonando, paradoDespues:!_srcMon.playing }; })()`);
console.log('2) transporte                : '+r2.t0+'s → '+r2.t1+'s  (avanzo '+r2.avanzo+'s)'+
            (r2.avanzo>0.5?'  reproduce':'  *** no avanza ***')+(r2.paradoDespues?'  ·  pausa OK':'  *** no pausa ***'));

/* 3) marcar entrada y salida */
const r3=await ev(`(function(){ const m=_srcMon.m;
  smSeek(5.0); smAccion('mi');
  smSeek(9.5); smAccion('mo');
  const r=srcRange(m);
  return { srcIn:+m.srcIn.toFixed(2), srcOut:+m.srcOut.toFixed(2), rango:r?{inP:+r.inP.toFixed(2),dur:+r.dur.toFixed(2)}:null,
           barra:document.querySelector('#srcMon .smsel').style.width }; })()`);
console.log('3) marcas                    : entrada '+r3.srcIn+'s · salida '+r3.srcOut+'s → rango '+JSON.stringify(r3.rango)+'  (barra '+r3.barra+')');

/* 4) arrastrar desde el monitor: el clip que cae dura SOLO lo marcado */
const r4=await ev(`(function(){ const m=_srcMon.m; const antes=state.clips.length;
  addClip(m,null,0,srcRange(m));                       // el mismo camino que usa el drop
  const c=state.clips[state.clips.length-1];
  return { nuevos:state.clips.length-antes, inP:+(c.inP||0).toFixed(2), dur:+c.dur.toFixed(2), durMedio:+m.dur.toFixed(2) }; })()`);
console.log('4) al soltar en la linea     : inP '+r4.inP+'s · dura '+r4.dur+'s'+
            (Math.abs(r4.dur-4.5)<0.06?'  (los 4,5 s marcados, no los '+r4.durMedio+' del archivo)':'  *** dura '+r4.dur+', esperaba 4,5 ***'));

/* 5) las marcas sobreviven a guardar y abrir */
const ISP=path.join(process.cwd(),'scratchpad','r249-marcas.isp');
try{fs.rmSync(ISP);}catch(e){}
await ev(`(async()=>{ await DSP.writeText(${JSON.stringify(ISP)}, JSON.stringify(serProject())); })()`);
await ev(`(async()=>{ const txt=await DSP.readText(${JSON.stringify(ISP)}); currentPath=${JSON.stringify(ISP)}; loadProject(JSON.parse(stripBom(txt))); })()`); await wait(1800);
const r5=await ev(`(function(){ const m=state.media.find(x=>x.kind==='video');
  return m?{ srcIn:(m.srcIn!=null?+m.srcIn.toFixed(2):null), srcOut:(m.srcOut!=null?+m.srcOut.toFixed(2):null) }:{err:1}; })()`);
console.log('5) tras guardar y reabrir    : entrada '+r5.srcIn+'s · salida '+r5.srcOut+'s'+
            ((r5.srcIn===r3.srcIn&&r5.srcOut===r3.srcOut)?'  (se conservan)':'  *** se perdieron ***'));

/* 6) el boton del inspector abre con la entrada/salida DEL CLIP */
const r6=await ev(`(function(){ if(_srcMon)closeSourceMonitor();
  const c=state.clips.find(x=>{const mm=mediaById(x.mediaId);return mm&&mm.kind==='video';});
  if(!c)return {err:'sin clip de video en la linea'};
  c.inP=12; c.dur=3; state.selId=c.id; state.selIds=[c.id]; renderInspector();
  const b=document.querySelector('#selSrcMon');
  if(!b||b.style.display==='none')return {err:'el boton no aparece'};
  b.click();
  const m=_srcMon&&_srcMon.m;
  return { abrio:!!_srcMon, srcIn:m?+m.srcIn.toFixed(2):null, srcOut:m?+m.srcOut.toFixed(2):null }; })()`);
console.log('6) boton del inspector       : '+(r6.err?('*** '+r6.err+' ***'):('abre con entrada '+r6.srcIn+'s y salida '+r6.srcOut+'s'+((r6.srcIn===12&&r6.srcOut===15)?'  (las del clip)':'  *** no coinciden con el clip (12/15) ***'))));

/* 7) cerrar deja limpio */
const r7=await ev(`(function(){ closeSourceMonitor();
  return { ventana:!!document.querySelector('#srcMon'), estado:!!_srcMon }; })()`);
console.log('7) al cerrar                 : '+((!r7.ventana&&!r7.estado)?'ventana y estado limpios':'*** queda algo: '+JSON.stringify(r7)+' ***'));

console.log('\nerrs:',JSON.stringify(await ev(`window.__errs.slice(0,8)`)));
ws.close();
