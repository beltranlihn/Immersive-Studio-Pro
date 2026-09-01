/* [R354] Genera proxies de composicion en lote para los composes mas pesados, a 2048 (= la resolucion del
   master del domo, asi que en previsualizacion no se pierde nitidez) y con el bucle horneado. */
import http from 'http';
const t=await new Promise((r2,rj)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>r2(JSON.parse(b)));}).on('error',rj);});
const ws=new WebSocket(t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl).webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async(x,ms=1800000)=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:ms});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
/* Se trabaja sobre una COPIA en la MISMA carpeta -para que la carpeta "nest proxies" y las rutas absolutas
   sean las de siempre- y solo se sustituye el original despues de verificar. */
const RUTA='/Users/vicentemanzano/Desktop/RITO DIGITAL MASTER/Film Rito Digital/Rito Dome/Rito Dome (con proxies).isp';
const MEDIOS_ESPERADOS=483, CLIPS_ESPERADOS=276;
await ev('window.__errs=[];addEventListener("error",e=>__errs.push(String(e.message||e).slice(0,150)));1');
await ev(`state.dirty=false; openProjectPath(${JSON.stringify(RUTA)},true); 1`);
/* GUARDA: esperar a que el proyecto este DE VERDAD cargado. Antes se esperaba a "0 faltantes", que ya se
   cumple con el proyecto vacio de arranque: la espera salia enseguida y despues se guardaba encima. */
let cargado=false;
for(let i=0;i<60;i++){ const st=await ev('({n:state.media.length, faltan:state.media.filter(m=>m.missing).length, ruta:(typeof currentPath!=="undefined"?currentPath:null)})');
  if(st.n>=MEDIOS_ESPERADOS && st.faltan===0 && st.ruta===RUTA){ cargado=true; break; } await wait(2000); }
if(!cargado){ console.log('NO se cargo el proyecto — se aborta sin guardar:', JSON.stringify(await ev('({n:state.media.length, ruta:currentPath})'))); ws.close(); process.exit(1); }
console.log('proyecto abierto:', JSON.stringify(await ev('({medios:state.media.length, faltan:state.media.filter(m=>m.missing).length, seq:(activeSeq()||{}).name})')));
// dialogo respondido a 2048 automaticamente
await ev('window.__dlg=ncDialog; ncDialog=async function(m,o){ return {s:2048,w:2048,h:2048}; }; 1');
// candidatos: nidos cuadrados usados en la secuencia activa, por peso, con horneado <= 120 s
const lista=await ev(`(function(){ const raiz=activeSeq(); const peso={};
  for(const c of (raiz.nestClips||[])){ const m=mediaById(c.mediaId); if(m&&m.kind==='nest') peso[m.id]=(peso[m.id]||0)+ (m.nestClips||[]).length; }
  const out=[];
  for(const k of Object.keys(peso).sort((a,b)=>peso[b]-peso[a])){ const m=mediaById(+k); if(!m||m.w!==m.h)continue;
    const pl=ncPlanBucle(m); const dur=pl?pl.span:(m.dur||1); if(dur>120)continue;
    out.push({id:m.id,nombre:m.name,dur:+dur.toFixed(1),bucle:pl?pl.len:0}); }
  return out.slice(0,20); })()`);
console.log('a hornear: '+lista.length+' composes, '+lista.reduce((a,b)=>a+b.dur,0).toFixed(0)+' s de video');
let ok=0, fallos=[];
for(let i=0;i<lista.length;i++){ const it=lista[i];
  const t0=Date.now();
  try{
    const r=await ev(`(async function(){ const m=mediaById(${it.id}); await ncBuild(m);
      return { ruta:!!m.ncPath, listo:!!m.ncReady, bucle:m.ncLoop||0, cubre:+(m.ncSpan||0).toFixed(1) }; })()`);
    const seg=((Date.now()-t0)/1000).toFixed(0);
    if(r.ruta){ ok++; console.log(`[${i+1}/${lista.length}] ${it.nombre} · ${it.dur}s · bucle ${r.bucle||'-'} · ${seg}s  OK`); }
    else { fallos.push(it.nombre); console.log(`[${i+1}/${lista.length}] ${it.nombre}  SIN PROXY`); }
  }catch(e){ fallos.push(it.nombre+': '+e.message.slice(0,80)); console.log(`[${i+1}/${lista.length}] ${it.nombre}  ERROR`); }
}
await ev('ncDialog=window.__dlg; 1');
/* GUARDA: no guardar si el proyecto no sigue entero o si no se horneo nada */
const antes=await ev('({n:state.media.length, clips:(activeSeq()||{nestClips:[]}).nestClips.length, ruta:currentPath})');
if(antes.n<MEDIOS_ESPERADOS || antes.clips<CLIPS_ESPERADOS || antes.ruta!==RUTA || ok===0){
  console.log('NO se guarda (proyecto incompleto o sin horneados):', JSON.stringify(antes), 'ok='+ok); ws.close(); process.exit(1); }
console.log('guardando…');
await ev('(async function(){ await saveProject(false); return 1; })()');
await wait(2500);
console.log('RESUMEN:', JSON.stringify(await ev(`(function(){ const n=state.media.filter(m=>m.kind==='nest');
  return { horneados:${ok}, conProxy:n.filter(m=>m.ncPath).length, conBucleHorneado:n.filter(m=>m.ncPath&&m.ncLoop>0).length,
           usables:n.filter(m=>ncUsable(m)).length, errores:(window.__errs||[]).slice(0,4) }; })()`)));
if(fallos.length) console.log('fallos:', JSON.stringify(fallos));
ws.close(); process.exit(0);
