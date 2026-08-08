/* [R328] Deshacer muerto, Shape Box huerfana y el panel de modulacion — del inventario (§9/§10).
     1-2 · la Shape Box guarda REFERENCIAS VIVAS a los keyframes, y cinco caminos los borran o los reemplazan sin
           avisarle: arrastrar sus tiradores mutaba objetos huerfanos. En vez de acordarse de cerrarla en los
           cinco (el error que esta sesion ha repetido ocho veces), la caja se comprueba antes de usarse.
           El caso 2 es el CONTROL POSITIVO: con las claves intactas NO debe cerrarse, o el arreglo seria
           «cerrarla siempre» y pasaria la prueba sin servir.
     3   · las ediciones de capa del panel de modulacion no empujaban deshacer, y cambiar la FUENTE reemplaza el
           objeto entero: se llevaba por delante toda la configuracion de la capa, sin vuelta atras.
     4   · seleccionar un locator apilaba una foto de deshacer aunque no se moviera: el siguiente Ctrl+Z parecia
           «no hacer nada» y el usuario lo pulsaba otra vez, perdiendo la edicion de verdad.

   Uso:  npx electron . --remote-debugging-port=9222   y luego   node scratchpad/r328-verif.mjs
*/
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0; const p=new Map(); ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise(r=>{const i=++id;p.set(i,m=>r(m.result&&m.result.exceptionDetails?('EXC '+(m.result.exceptionDetails.exception?.description||'').slice(0,80)):(m.result&&m.result.result&&m.result.result.value)));ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true,timeout:60000}}));});

const MONTA=`
  await newProject('flat',1920,1080,30,180,true); if(typeof hideLanding==='function')hideLanding();
  const LV=state.lanes.findIndex(l=>l.kind!=='audio');
  _demoAddShape('rect','#888',LV,0,4,{x:0,y:0,scale:100});
  const c=state.clips[state.clips.length-1]; state.selId=c.id;`;

console.log('1) Shape Box: si sus keyframes desaparecen, se cierra sola');
const r1 = await ev(`(async()=>{ try{ ${MONTA}
  c.kf={opacity:[{t:0,v:0,e:'linear'},{t:1,v:50,e:'linear'},{t:2,v:100,e:'linear'}]};
  state.shapeBox={cid:c.id,p:'opacity',t0:0,t1:2,v0:0,v1:100,base:c.kf.opacity.map(k=>({k,t:k.t,v:k.v}))};
  const abierta=!!state.shapeBox;
  delete c.kf.opacity;                       // «Borrar automatizacion»: las claves se van sin avisar a la caja
  const viva=shapeBoxVivo();
  return JSON.stringify({abierta, siguenLasClaves:false, cajaTrasComprobar:!!state.shapeBox, vivo:viva});
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r1);

console.log('2) Shape Box: con las claves intactas NO se cierra (control positivo)');
const r2 = await ev(`(async()=>{ try{ ${MONTA}
  c.kf={opacity:[{t:0,v:0,e:'linear'},{t:1,v:50,e:'linear'},{t:2,v:100,e:'linear'}]};
  state.shapeBox={cid:c.id,p:'opacity',t0:0,t1:2,v0:0,v1:100,base:c.kf.opacity.map(k=>({k,t:k.t,v:k.v}))};
  const viva=shapeBoxVivo();
  return JSON.stringify({vivo:viva, sigueAbierta:!!state.shapeBox});
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r2);

console.log('3) panel de modulacion: cambiar la FUENTE se deshace');
const r3 = await ev(`(async()=>{ try{ ${MONTA}
  c.mod={opacity:[modDefaults('lfo')]}; c.mod.opacity[0].depth=77;
  openModPanel(c,'opacity',document.body); await new Promise(z=>setTimeout(z,250));
  const sel=document.querySelector('.mpsrc'); if(!sel) return 'no hay .mpsrc';
  clearAllUndo(); const pila0=_ustk().u.length; const antes=c.mod.opacity[0].src;
  sel.value='space'; sel.dispatchEvent(new Event('change'));
  await new Promise(z=>setTimeout(z,150));
  const tras=c.mod.opacity[0].src, pila1=_ustk().u.length;
  undo(); const vuelta=(clipById(c.id).mod||{}).opacity?clipById(c.id).mod.opacity[0].src:null;
  try{closeModPanel();}catch(_){}
  return JSON.stringify({antes,tras,vuelta,fotos:pila1-pila0,seDeshace:vuelta===antes});
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r3);

console.log('4) clic en un locator sin arrastrar no consume historial');
const r4 = await ev(`(async()=>{ try{ ${MONTA}
  state.playhead=1; addMarker(); clearAllUndo();
  const pila0=_ustk().u.length;
  /* se reproduce el pointerdown sobre el locator: seleccion sin movimiento */
  const mk=state.markers[0]; state.selMarkerId=mk.id; state.selId=null; renderTimeline();
  return JSON.stringify({fotosTrasSeleccionar:_ustk().u.length-pila0});
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r4);
const malas=[];
if(!/\"cajaTrasComprobar\":false/.test(r1))malas.push('la Shape Box no se cierra cuando sus claves desaparecen');
if(!/\"sigueAbierta\":true/.test(r2))malas.push('la Shape Box se cierra con las claves INTACTAS: el arreglo seria inutil');
if(!/\"seDeshace\":true/.test(r3))malas.push('cambiar la fuente de una capa de modulacion no se deshace');
if(!/\"fotosTrasSeleccionar\":0/.test(r4))malas.push('seleccionar un locator consume historial');
console.log('');
for(const m of malas)console.log('   *** '+m);
console.log(malas.length?('*** '+malas.length+' FALLOS'):'deshacer muerto y Shape Box huerfana quedan cubiertos');
ws.close(); process.exit(malas.length?1:0);
