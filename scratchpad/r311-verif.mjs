/* [R311] Verificación de los tres arreglos de la ronda contra la aplicación viva.
   A11 · la fila «Cantidad» del diálogo de composición vuelve a existir en una secuencia de domo (un `else if`
        que estaba tragado por el comentario de la línea de arriba).
   A12 · la firma del tejido barajado ya incluye la VELOCIDAD (buscaba el diente de sierra por `k`/`p`, dos
        propiedades que no existen — el esquema es `mode`/`param`).
   A13 · File→New ya no hereda la biblioteca de automatización ni los preajustes de export del proyecto abierto.
   Uso:  npx electron . --remote-debugging-port=9222   y luego   node scratchpad/r311-verif.mjs
*/
import http from 'http';
const targets = await new Promise((res,rej)=>{ http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{
  let b=''; r.on('data',c=>b+=c); r.on('end',()=>res(JSON.parse(b))); }).on('error',rej); });
const pg = targets.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
if(!pg){ console.log('*** la aplicacion no esta abierta con --remote-debugging-port=9222'); process.exit(1); }
const ws = new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let _id=0; const pend=new Map();
ws.onmessage = e => { const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){ pend.get(m.id)(m); pend.delete(m.id); } };
const ev = expr => new Promise((res,rej)=>{ const i=++_id; pend.set(i,r=>{
    if(r.error) return rej(new Error(JSON.stringify(r.error)));
    if(r.result.exceptionDetails) return rej(new Error(r.result.exceptionDetails.exception?.description||'excepcion'));
    res(r.result.result.value); });
  ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:expr,awaitPromise:true,returnByValue:true,timeout:120000}})); });

let fallos=0; const mal=m=>{ console.log('   *** '+m); fallos++; };
const bien=m=>console.log('   ✓ '+m);

/* ── A12 ── Se prueba `wvPrep` DIRECTAMENTE con un nido sintético: es determinista y no depende de montar un
   tejido por la interfaz. Lo que estaba roto: dos tejidos idénticos salvo la velocidad daban la MISMA firma. */
console.log('\n── A12 · la velocidad entra en la firma del tejido ──');
const a12 = await ev(`(()=>{ try{
  const nido=v=>({ comp:{kind:'weave',shuffle:true,bands:2,count:2,motion:'alt',order:[0,1]},
    nestClips:[{mediaId:1,props:{x:0,y:0},_layBase:{x:0,y:0},anim:[{param:'x',mode:'saw',speed:v,phase:0,amp:1,on:true}]},
               {mediaId:2,props:{x:1,y:0},_layBase:{x:1,y:0},anim:[{param:'x',mode:'saw',speed:v,phase:0,amp:1,on:true}]}] });
  const a=nido(0.12), b=nido(0.80);
  wvPrep(a); wvPrep(b);
  return {a:a._wvSig, b:b._wvSig, distintas:a._wvSig!==b._wvSig};
}catch(e){ return {err:String(e&&e.message||e)}; } })()`);
if(a12.err) mal('no se pudo evaluar: '+a12.err);
else if(!a12.distintas) mal('dos tejidos con velocidad distinta dan la MISMA firma → el arreglo de R301c sigue muerto');
else bien('velocidades 0,12 y 0,80 dan firmas distintas — el tramo de velocidad es "'+a12.a.split('|')[5]+'" vs "'+a12.b.split('|')[5]+'"');

/* ── A11 ── La fila «Cantidad» en una secuencia de domo. Se abre el diálogo de composición y se mira el DOM. */
console.log('\n── A11 · la fila «Cantidad» existe en domo ──');
const a11 = await ev(`(async()=>{ try{
  await newProject('dome',1024,1024,30,180,true); if(typeof hideLanding==='function')hideLanding();
  // dos medios cualesquiera para que el diálogo tenga cesta
  _demoAddShape('rect','#888888',0,0,2,{az:0,el:45,size:40});
  _demoAddShape('rect','#444444',0,2,2,{az:90,el:45,size:40});
  const ids=state.media.filter(m=>m.kind==='shape').map(m=>m.id);
  state.selMediaIds=ids.slice(); state.selMediaId=ids[0];
  openCompose();
  await new Promise(r=>setTimeout(r,260));
  const fila=document.querySelector('[data-only="count"]');
  if(!fila) return {err:'no existe la fila count en el DOM'};
  /* Ojo: #cKind NO es un select, es un segmentado de BOTONES (div.kindseg con data-k). Asignarle .value no hace
     nada y la sonda daria el mismo resultado para los cuatro tipos — falso positivo. Hay que pulsar.
     (Y ojo dos: nada de acentos graves aqui dentro; cierran la plantilla de la sonda.) */
  const elegir=k=>{ const b=document.querySelector('#cKind button[data-k="'+k+'"]'); if(!b)return false; b.click(); return true; };
  const visible=k=>{ if(!elegir(k))return null; return getComputedStyle(fila).display!=='none'; };
  const r={ ring:visible('ring'), spiral:visible('spiral'), weave:visible('weave'), domegrid:visible('domegrid') };
  if(Object.values(r).some(v=>v===null)) return {err:'algun tipo no existe en el segmentado #cKind'};
  const ov=document.querySelector('.overlay'); if(ov)ov.remove();
  return r;
}catch(e){ return {err:String(e&&e.message||e)}; } })()`);
if(a11.err) mal('no se pudo evaluar: '+a11.err);
else{
  if(!a11.ring) mal('con «anillo» la fila Cantidad sigue oculta'); else bien('anillo → la fila Cantidad se ve');
  if(!a11.spiral) mal('con «espiral» la fila Cantidad sigue oculta'); else bien('espiral → la fila Cantidad se ve');
  if(a11.weave) mal('con «tejido» la fila Cantidad NO deberia verse (deriva su conteo)'); else bien('tejido → oculta, como debe');
  if(a11.domegrid) mal('con «rejilla de domo» la fila Cantidad NO deberia verse'); else bien('rejilla de domo → oculta, como debe');
}

/* ── A13 ── Un proyecto nuevo no hereda la biblioteca de automatización ni los preajustes de export. */
console.log('\n── A13 · File→New no hereda del proyecto anterior ──');
const a13 = await ev(`(async()=>{ try{
  await newProject('dome',1024,1024,30,180,true); if(typeof hideLanding==='function')hideLanding();
  state.autoItems={ 99:{id:99,name:'curva de prueba',kf:[],dur:1} };
  state.exportPresets=[{name:'preajuste de prueba',codec:'ffh264',res:4096,fps:60}];
  state.tl.pxPerSec=1234;
  const antes={items:Object.keys(state.autoItems).length, presets:state.exportPresets.length, zoom:state.tl.pxPerSec};
  await newProject('dome',1024,1024,30,180,true);
  const despues={items:Object.keys(state.autoItems||{}).length, presets:(state.exportPresets||[]).length, zoom:state.tl.pxPerSec};
  return {antes,despues};
}catch(e){ return {err:String(e&&e.message||e)}; } })()`);
if(a13.err) mal('no se pudo evaluar: '+a13.err);
else{
  console.log('   antes de File→New: '+JSON.stringify(a13.antes));
  console.log('   despues:           '+JSON.stringify(a13.despues));
  if(a13.despues.items) mal('la biblioteca de automatizacion se ha heredado ('+a13.despues.items+' items)'); else bien('autoItems limpio');
  if(a13.despues.presets) mal('los preajustes de export se han heredado ('+a13.despues.presets+')'); else bien('exportPresets limpio');
  if(a13.despues.zoom===1234) mal('el zoom de la linea de tiempo se ha heredado'); else bien('zoom de vuelta a fabrica ('+a13.despues.zoom+')');
}

console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'los tres arreglos de R311 verificados sobre la aplicacion viva'));
ws.close(); process.exit(fallos?1:0);
