/* [MANUAL] Vuelca los CATALOGOS REALES de la aplicacion viva: comandos y atajos, efectos, presets de
   movimiento, tipos de composicion y menus. El manual se escribe desde aqui, no desde la memoria: un manual que
   documenta funciones que no existen es peor que no tener manual. */
import http from 'http'; import fs from 'fs';
const t=await new Promise((r2,j)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>r2(JSON.parse(b)));}).on('error',j);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
if(!pg){ console.log('*** no hay pagina del editor'); process.exit(1); }
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise((res,rej)=>{const i=++id;p.set(i,r=>r.error?rej(new Error(JSON.stringify(r.error))):(r.result.exceptionDetails?rej(new Error(r.result.exceptionDetails.exception?.description||'')):res(r.result.result.value)));ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true}}));});

const D={};
D.comandos = await ev(`(function(){ try{ return commandList().map(c=>({cat:c[0],label:c[1],key:c[2]||''})); }catch(e){ return {error:''+e}; } })()`);
D.efectos  = await ev(`(function(){ try{ return FXTYPES.map(d=>({key:d.key,cat:d.cat||'',label:d.label?d.label[0]:d.key,
   params:(d.params||[]).map(q=>({k:q.k,label:(q.label?q.label[0]:q.k),min:q.min,max:q.max,def:q.def})), feedback:!!d.prev})); }catch(e){ return {error:''+e}; } })()`);
D.motionDomo = await ev(`(function(){ try{ return ANIM_PRESETS.map(a=>({key:a.key,label:a.label[0],param:a.param||'(acorde)',mode:a.mode||'',partes:(a.parts||[]).length})); }catch(e){ return {error:''+e}; } })()`);
D.motionFlat = await ev(`(function(){ try{ return ANIM_PRESETS_FLAT.map(a=>({key:a.key,label:a.label[0],param:a.param||'(acorde)',mode:a.mode||'',partes:(a.parts||[]).length})); }catch(e){ return {error:''+e}; } })()`);
D.animParams = await ev(`(function(){ try{ return Object.keys(ANIM_PARAMS).map(k=>k+' = '+JSON.stringify(ANIM_PARAMS[k]).slice(0,120)); }catch(e){ return {error:''+e}; } })()`);
D.mascaras = await ev(`(function(){ try{ return MASK_IDX?Object.keys(MASK_IDX):null; }catch(e){ return {error:''+e}; } })()`);
D.mezclas = await ev(`(function(){ try{ return Object.keys(BLEND_ID); }catch(e){ return {error:''+e}; } })()`);
D.ordenMedios = await ev(`(function(){ try{ return MEDIA_SORTS.map(s=>Array.isArray(s)?s.join(' / '):JSON.stringify(s)); }catch(e){ return {error:''+e}; } })()`);
D.easing = await ev(`(function(){ try{ return Object.keys(EASE_PRESETS); }catch(e){ return {error:''+e}; } })()`);
/* Los menus se leen ABRIENDOLOS, que es lo unico que garantiza que lo documentado es lo que se ve. */
D.menus = await ev(`(async function(){ const out={};
  for(const b of document.querySelectorAll('#menubar [data-menu], #menubar button')){
    const nombre=(b.textContent||'').trim(); if(!nombre)continue;
    b.click(); await new Promise(r=>setTimeout(r,90));
    const m=document.querySelector('.menu, #menuPop, .menupop');
    out[nombre]=m?[...m.querySelectorAll('button,.mi,.menuitem')].map(i=>(i.textContent||'').trim().replace(/\\s+/g,' ')).filter(Boolean):['(no legible)'];
    document.body.click(); await new Promise(r=>setTimeout(r,60));
  } return out; })()`);
D.composeTipos = await ev(`(function(){ const o={};
  try{ o.desdeCodigo = (typeof COMP_TYPES!=='undefined')?COMP_TYPES:null; }catch(e){}
  try{ const s=openCompose.toString(); const m=s.match(/kind:'[a-z]+'/g); o.kinds=[...new Set((m||[]).map(x=>x.slice(6,-1)))]; }catch(e){ o.err=''+e; }
  return o; })()`);
D.version = await ev(`(function(){ return {ua:navigator.userAgent.match(/Electron\\/[\\d.]+/)?.[0]||'?', gl:(function(){try{const g=document.createElement('canvas').getContext('webgl2');const d=g.getExtension('WEBGL_debug_renderer_info');return g.getParameter(d.UNMASKED_RENDERER_WEBGL);}catch(e){return '?';}})()}; })()`);

fs.writeFileSync('docs/manual/build/datos.json', JSON.stringify(D,null,1));
const n=o=>Array.isArray(o)?o.length:(o&&typeof o==='object'?Object.keys(o).length:0);
for(const k of Object.keys(D)) console.log(k.padEnd(14), Array.isArray(D[k])&&D[k].error?('ERROR '+D[k].error):(n(D[k])+' entradas'));
ws.close(); process.exit(0);
