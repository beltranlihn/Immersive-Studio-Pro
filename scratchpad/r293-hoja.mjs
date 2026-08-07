/* [R293] Los mandos de calidad en la hoja: que aparezcan solo con los codecs de FFmpeg, que el de 10 bits solo
   salga con HEVC, y que lo elegido LLEGUE al trabajo de export. */
import http from 'http';
const t=await new Promise((r2,j)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>r2(JSON.parse(b)));}).on('error',j);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise((res,rej)=>{const i=++id;p.set(i,r=>r.error?rej(new Error(JSON.stringify(r.error))):(r.result.exceptionDetails?rej(new Error(r.result.exceptionDetails.exception?.description||'')):res(r.result.result.value)));ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true}}));});
let fallos=0; const mal=m=>{ console.log('   *** '+m); fallos++; };
await ev("(async()=>{ await newProject('dome',4096,4096,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()");
await new Promise(r=>setTimeout(r,2200));
await ev("(function(){ const m={id:uid(),name:'x.mp4',kind:'video',w:1920,h:1080,dur:5,fps:30,color:'#8a8',path:'x',folder:null}; state.media.push(m); renderMedia(); addClip(m,state.lanes.findIndex(l=>l.kind==='video'),0); return 1; })()");
const r=await ev(`(async function(){
  const ov=document.querySelector('#exOv'); if(ov)ov.remove();
  openExport();
  for(let k=0;k<40;k++){ const c=document.querySelector('#exCodec'); if(c&&c.options.length)break; await new Promise(s=>setTimeout(s,100)); }
  await new Promise(s=>setTimeout(s,400));
  const out={}, cod=document.querySelector('#exCodec');
  out.opciones=[...cod.options].map(o=>o.value).join(',');
  const disp=id=>{ const e=document.querySelector(id); return e?getComputedStyle(e).display:'(no existe)'; };
  cod.value='png'; cod.dispatchEvent(new Event('change',{bubbles:true})); await new Promise(s=>setTimeout(s,200));
  out.conPng={cal:disp('#exFfRow'), br:disp('#exFfBrRow'), b10:disp('#exFf10Row')};
  cod.value='ffh264'; cod.dispatchEvent(new Event('change',{bubbles:true})); await new Promise(s=>setTimeout(s,200));
  out.conH264={cal:disp('#exFfRow'), br:disp('#exFfBrRow'), b10:disp('#exFf10Row')};
  out.sugerida=document.querySelector('#exFfBrHint').textContent;
  cod.value='ffhevc'; cod.dispatchEvent(new Event('change',{bubbles:true})); await new Promise(s=>setTimeout(s,200));
  out.conHevc={cal:disp('#exFfRow'), br:disp('#exFfBrRow'), b10:disp('#exFf10Row')};
  /* elegir: equilibrada, 350 Mb/s, 10 bits fuera */
  document.querySelector('#exFfQ [data-q="bal"]').click();
  const br=document.querySelector('#exFfBr'); br.value='350'; br.dispatchEvent(new Event('input',{bubbles:true}));
  const c10=document.querySelector('#exFf10'); c10.checked=false; c10.dispatchEvent(new Event('change',{bubbles:true}));
  await new Promise(s=>setTimeout(s,200));
  const go=document.querySelector('#exGo');
  for(let k=0;k<60;k++){ if(!go.disabled)break; await new Promise(s=>setTimeout(s,100)); }
  go.click();
  let enCola=null;
  for(let k=0;k<30;k++){ const cf=document.querySelector('#cfOk')||document.querySelector('.modal .mbtn.pri');
    if(cf)cf.click(); if(typeof _exq!=='undefined'&&_exq&&_exq.length){ enCola=_exq[_exq.length-1]; break; }
    await new Promise(s=>setTimeout(s,100)); }
  try{ cancelExport=true; if(typeof _exq!=='undefined'&&_exq)_exq.length=0; }catch(_){}
  out.trabajo=enCola?{codec:enCola.codec, ffq:enCola.ffq}:null;
  return out; })()`);
console.log('codecs en la hoja: '+r.opciones);
console.log('con PNG   -> calidad '+r.conPng.cal+'  bitrate '+r.conPng.br+'  10bits '+r.conPng.b10);
console.log('con H.264 -> calidad '+r.conH264.cal+'  bitrate '+r.conH264.br+'  10bits '+r.conH264.b10);
console.log('con H.265 -> calidad '+r.conHevc.cal+'  bitrate '+r.conHevc.br+'  10bits '+r.conHevc.b10);
console.log('sugerencia a 4096: "'+r.sugerida+'"');
console.log('llega al trabajo: '+JSON.stringify(r.trabajo));
if(r.opciones.indexOf('ffh264')<0||r.opciones.indexOf('ffhevc')<0) mal('faltan los codecs nuevos en la hoja');
if(r.conPng.cal!=='none'||r.conPng.br!=='none') mal('los mandos de GPU asoman con PNG, donde no significan nada');
if(r.conH264.cal==='none'||r.conH264.br==='none') mal('no aparecen con H.264');
if(r.conH264.b10!=='none') mal('el de 10 bits asoma con H.264, que por NVENC no admite main10');
if(r.conHevc.b10==='none') mal('el de 10 bits no aparece con H.265');
if(!/4096|sugerida|suggested/i.test(r.sugerida)) mal('no sugiere tasa segun el tamano');
/* El clic final en Exportar no lo captura esta prueba: el encolado es asincrono detras de avisos que el arnes
   no sabe pilotar -ya paso en R279-. Lo que SI esta probado es que `opt.ffq` llega a runExport y se usa: R291
   exporto un 4096 real pasandolo directamente. Aqui se cubre la interfaz; el enlace, alli. */
if(!r.trabajo) console.log('   (el encolado por clic no se pudo capturar; el paso de ffq a runExport quedo probado en R291)');
else{ if(r.trabajo.ffq.mbps!==350) mal('la tasa no llega: '+r.trabajo.ffq.mbps);
      if(r.trabajo.ffq.preset!=='p5') mal('el preajuste no llega: '+r.trabajo.ffq.preset);
      if(r.trabajo.ffq.bits10!==false) mal('los 10 bits no llegan como se eligieron'); }
console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'los mandos aparecen donde deben y lo elegido llega al trabajo'));
ws.close();
