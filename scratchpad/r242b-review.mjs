/* [R242b] Los cuatro hallazgos de la revisión del diff de R242.
   1 · `audioCollapsed` retirado: ni se serializa ni queda estado vivo.
   2 · `inlineCurves` NO se hereda con un archivo sin bloque `tl` (y el botón acompaña).
   3 · `selFolder`/`mediaFolder` no sobreviven a `loadProject`.
   4 · `abrirDescargaNDI()` comprueba el resultado de `openExternal` (y la allowlist sigue cerrada). */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:60000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const SP='C:\\\\Users\\\\beltr\\\\Desktop\\\\Alma Digital Studio\\\\Projects\\\\Immersive Studio Pro\\\\scratchpad';
const out={};
await ev(`(function(){ window.__errs=[]; addEventListener('error',e=>__errs.push(String(e.message||e)));
  if(!window.__alertHook){ window.__alertHook=1; window.__alerts=[]; window.appAlert=function(m,cb){ __alerts.push(String(m)); if(cb)cb(); }; }
  return 1; })()`);

/* --- 1 · audioCollapsed retirado ------------------------------------------------------------ */
out['1_audioCollapsed']=await ev(`(function(){ const tl=serProject().tl;
  return { enSerProject:('audioCollapsed' in tl), enState:('audioCollapsed' in state.tl), clavesTl:Object.keys(tl) }; })()`);

/* --- 2 · inlineCurves NO se hereda ---------------------------------------------------------- */
out['2_inlineCurves']=await ev(`(async function(){
  state.dirty=false; await newProject('flat',1920,1080,60,180,true);
  toggleCurves(); // encender el modo automatización a mano (es el gesto real)
  const antes={ inline:state.inlineCurves, boton:!!document.querySelector('#curvesBtn.on') };
  state.dirty=false;
  await openProjectPath('${SP}\\\\aud2608-legacy-v2.rdome'); // legacy SIN bloque tl
  const despues={ inline:state.inlineCurves, boton:!!document.querySelector('#curvesBtn.on') };
  const guardado=!!serProject().tl.inlineCurves;
  return { antes, despues, seEscribiriaEnElArchivo:guardado,
    ok:(antes.inline===true && despues.inline===false && despues.boton===false && guardado===false) }; })()`);
await wait(500);

/* --- 3 · selFolder/mediaFolder no se heredan ------------------------------------------------ */
out['3_carpetas']=await ev(`(async function(){
  state.dirty=false; await newProject('flat',1920,1080,60,180,true);
  state.folders=['Material']; state.mediaFolder='Material'; state.selFolder='Material';
  const antes={ mediaFolder:state.mediaFolder, selFolder:state.selFolder };
  state.dirty=false;
  await openProjectPath('${SP}\\\\aud2608-legacy-v2.rdome');
  const despues={ mediaFolder:state.mediaFolder, selFolder:state.selFolder };
  return { antes, despues, ok:(despues.mediaFolder===null && despues.selFolder===null) }; })()`);
await wait(500);

/* --- 4 · abrirDescargaNDI comprueba el resultado --------------------------------------------- */
out['4_ndiDownload']=await ev(`(async function(){ __alerts.length=0;
  const fn=(typeof abrirDescargaNDI==='function')?abrirDescargaNDI.toString():'';
  const r={ existe:typeof abrirDescargaNDI, compruebaResultado:/await DSP\\.openExternal/.test(fn)&&/if\\(!ok\\)/.test(fn),
    allowlistCerrada:{ ajeno:await DSP.openExternal('https://evil.example.com'),
                       parecido:await DSP.openExternal('https://evilndi.link'),
                       subdominioFalso:await DSP.openExternal('https://ndi.link.evil.com'),
                       userinfo:await DSP.openExternal('http://ndi.link@evil.com') } };
  r.ningunaColada=Object.values(r.allowlistCerrada).every(v=>v===false);
  return r; })()`);

await ev(`(async()=>{ state.dirty=false; await newProject('dome',4096,4096,60,180,true); })()`);
out.errs=await ev(`window.__errs.slice(0,10)`);
console.log(JSON.stringify(out,null,1));
ws.close();
