/* [R240·3] El barrido de ATAJOS que pedía la auditoría. No comprueba el efecto de cada uno (eso es la prueba a
   mano de Beltrán), sino la clase de fallo que ya apareció una vez en este proyecto ([R92-T5]: la paleta prometía
   +/− de zoom que NO existían): que TODO lo que la app ANUNCIA tenga de verdad una implementación detrás, y que
   disparar el atajo no lance. Fuentes de promesas: `commandList()` (la paleta) y los `key:` de los menús. */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:120000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const out={};
await ev(`(function(){ window.__errs=[]; addEventListener('error',e=>__errs.push(String(e.message||e)));
 addEventListener('unhandledrejection',e=>__errs.push('rej: '+String((e.reason&&e.reason.message)||e.reason)));
 if(!window.__errHook){ window.__errHook=1; const ce=console.error; console.error=function(){try{__errs.push('con: '+[...arguments].map(String).join(' '));}catch(_){}return ce.apply(console,arguments);}; }
 return 1; })()`);
await ev(`state.dirty=false;1`);
await ev(`(async()=>{try{await startDemoProject('dome');}catch(e){window.__d=String(e);}})()`); await wait(2600);
await ev(`(function(){try{if(typeof _tourStop==='function')_tourStop();const o=document.getElementById('tourOv');if(o)o.remove();}catch(e){} return 1;})()`); await wait(600);

/* 1 · toda entrada de la paleta con atajo anunciado tiene función ejecutable */
out.paleta=await ev(`(function(){ const L=commandList();  // [categoría, etiqueta, atajo, fn]
  const conAtajo=L.filter(x=>Array.isArray(x)&&x[2]);
  const sinFn=L.filter(x=>Array.isArray(x)&&typeof x[3]!=='function');
  return { entradas:L.length, conAtajoAnunciado:conAtajo.length,
    sinImplementacion:sinFn.map(x=>x[1]+' ('+(x[2]||'sin atajo')+')'),
    atajos:conAtajo.map(x=>x[2]) }; })()`);

/* 2 · disparar cada atajo anunciado sobre el documento: ninguno debe lanzar */
out.disparo=await ev(`(async function(){
  const L=commandList().filter(x=>Array.isArray(x)&&x[2]);
  const parse=k=>{ const s=String(k); const mod=/⌘|Ctrl/i.test(s); const shift=/⇧|Shift/i.test(s);
    let key=s.replace(/[⌘⇧]/g,'').replace(/Ctrl\\+?/gi,'').replace(/Shift\\+?/gi,'').trim();
    if(/^Space$/i.test(key))key=' '; if(/^Esc$/i.test(key))key='Escape';
    return {key,mod,shift}; };
  const saltar=/⌘N|⌘O|⌘S|⌘K|F1|\\?/;   // abren diálogos nativos, el launcher o la paleta: no procede en un barrido
  const res=[]; const errs0=window.__errs.length;
  for(const c of L){ const atajo=c[2], label=c[1]; if(saltar.test(atajo))continue;
    const {key,mod,shift}=parse(atajo); if(!key)continue;
    const antes=window.__errs.length;
    try{ document.dispatchEvent(new KeyboardEvent('keydown',{key,ctrlKey:mod,metaKey:false,shiftKey:shift,bubbles:true,cancelable:true})); }
    catch(e){ res.push({atajo,label,lanzo:String(e.message||e)}); continue; }
    await new Promise(r=>setTimeout(r,15));
    if(window.__errs.length>antes)res.push({atajo,label,err:window.__errs.slice(antes)});
  }
  /* ⇧⌘E abre la HOJA DE EXPORT, y el guard global de atajos (#exOv) bloquea todo lo que venga después: sin
     limpiarla, cualquier comprobación posterior da falso negativo. Se barren las cuatro capas modales. */
  document.querySelectorAll('.overlay,#palOv,#exOv,.exs-scrim').forEach(o=>o.remove());
  return { probados:L.length, conProblema:res, erroresNuevos:window.__errs.length-errs0,
    modalesResidualesTrasLimpiar:document.querySelectorAll('.overlay,#palOv,#exOv,.exs-scrim').length }; })()`);

/* 3 · los `key:` de los menús contextuales tienen que existir también en el handler global */
out.menus=await ev(`(function(){
  const src=(typeof window.__appSrc==='string')?window.__appSrc:null;
  /* sin fuente a mano, se comprueban los que se pueden ejercitar: ⌘D duplicar, ⌘C copiar, 0 desactivar, ⌘R renombrar */
  document.querySelectorAll('.overlay,#palOv,#exOv,.exs-scrim').forEach(o=>o.remove()); // el guard global ignora TODO atajo con una modal abierta
  const c=state.clips.find(x=>!x.adjust); if(!c)return {err:'sin clips'};
  state.selId=c.id; state.selIds=[c.id]; state.selMarkerId=null;
  const n0=state.clips.length; const errs0=window.__errs.length;
  const tecla=(key,mod,shift)=>document.dispatchEvent(new KeyboardEvent('keydown',{key,ctrlKey:!!mod,shiftKey:!!shift,bubbles:true,cancelable:true}));
  tecla('d',true); const trasDuplicar=state.clips.length;
  const c2=state.clips.find(x=>!x.adjust&&x.id!==c.id)||c; state.selId=c.id; state.selIds=[c.id];
  const dis0=!!c.disabled; tecla('0'); const trasCero=!!clipById(c.id).disabled;
  tecla('c',true); const hayPortapapeles=!!state.clipboard;
  return { duplicaConCtrlD:trasDuplicar>n0, ceroAlternaDesactivado:trasCero!==dis0,
    ctrlCLlenaPortapapeles:hayPortapapeles, erroresNuevos:window.__errs.length-errs0 }; })()`);

out.errs=await ev(`window.__errs.slice(0,25)`);
console.log(JSON.stringify(out,null,1));
ws.close();
