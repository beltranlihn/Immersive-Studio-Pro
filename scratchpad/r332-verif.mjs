/* [R332] El visor emergente y los recursos que no se soltaban — del inventario (§9 render, §10 BAJA).
     1 · `_lastSrcTex` se reutilizaba SIN comprobar. El visor emergente repinta por el mismo `render()` con
         `_reuseComp`, y ese puntero puede venir del adelanto, que RECICLA texturas por un pool: bastaba con que
         el cabezal se moviera entre el render del editor y el del visor (pasa en cada reproduccion: son dos rAF
         distintos) para estampar un fotograma de otro tiempo -y el repintado de restauracion lo estampaba
         tambien EN EL EDITOR-. Se mide por PIXELES: dos clips de colores distintos, y se comprueba que el
         segundo render ensena el color del instante nuevo. 1b es el control con el cabezal quieto: ahi la
         reutilizacion SI vale y no debe recomponerse de mas.
     2 · `resize`/`beforeunload` van sobre la VENTANA, que sobrevive al `innerHTML=''` del auto-sanado: cada
         remontaje anadia otro par, y el remontaje puede dispararse en cada fotograma. 2b: una ventana nueva si
         recibe los suyos.
     3 · `c._curveTex` (la rampa de las curvas de color) nunca pasaba por `deleteTexture`.
     4 · `_arCache.clip` es el objeto del clip, no un id: borrar la cancion dejaba los FX reactivos leyendo el
         `start`/`dur` de un clip que ya no esta en la linea de tiempo.

   Uso:  npx electron . --remote-debugging-port=9222   y luego   node scratchpad/r332-verif.mjs
*/
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0; const p=new Map(); ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise(r=>{const i=++id;p.set(i,m=>r(m.result&&m.result.exceptionDetails?('EXC '+(m.result.exceptionDetails.exception?.description||'').slice(0,80)):(m.result&&m.result.result&&m.result.result.value)));ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true,timeout:60000}}));});

/* dos clips seguidos de colores muy distintos, y un lector del pixel central del lienzo */
const ESCENA=`
  await newProject('flat',1920,1080,30,180,true); if(typeof hideLanding==='function')hideLanding();
  const LV=state.lanes.findIndex(l=>l.kind!=='audio');
  _demoAddShape('rect','#FF0000',LV,0,1,{x:0,y:0,scale:100});
  _demoAddShape('rect','#00FF00',LV,1,1,{x:0,y:0,scale:100});
  const pixel=()=>{ const cx=document.createElement('canvas'); cx.width=1; cx.height=1;
    const g2=cx.getContext('2d'); g2.drawImage(glc, Math.round(glc.width/2), Math.round(glc.height/2), 1,1, 0,0,1,1);
    const d=g2.getImageData(0,0,1,1).data; return [d[0],d[1],d[2]]; };
  const rojo=v=>v[0]>120&&v[1]<80, verde=v=>v[1]>120&&v[0]<80;`;

console.log('');
console.log('R332 - el visor emergente y los recursos que no se soltaban');
console.log('');

console.log('1) con el cabezal movido, el repintado del visor NO estampa el fotograma viejo');
const r1 = await ev(`(async()=>{ try{ ${ESCENA}
  _raOn=true; try{raInvalidate();}catch(e){}
  state.playhead=0.5; render(); const a=pixel();          // el editor deja el composite del clip ROJO
  state.playhead=1.5;                                     // el cabezal avanza SIN render del editor
  _reuseComp=true; try{ render(); } finally { _reuseComp=false; }
  const b=pixel();
  _raOn=false;
  return JSON.stringify({primero:a, segundo:b, primeroRojo:rojo(a), segundoVerde:verde(b)});
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r1);

console.log('1b) con el cabezal quieto, la reutilizacion sigue valiendo (control)');
const r1b = await ev(`(async()=>{ try{ ${ESCENA}
  _raOn=true; try{raInvalidate();}catch(e){}
  state.playhead=1.5; render(); const a=pixel();
  const texAntes=_lastSrcTex, fAntes=_lastSrcF;
  _reuseComp=true; try{ render(); } finally { _reuseComp=false; }
  const b=pixel();
  _raOn=false;
  return JSON.stringify({primero:a, segundo:b, ambosVerdes:verde(a)&&verde(b),
    reutilizaLaMisma: _lastSrcTex===texAntes && _lastSrcF===fAntes});
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r1b);

console.log('2) remontar el documento de la emergente no acumula oyentes de ventana');
const r2 = await ev(`(()=>{ try{
  const ctxBak=_viewerCtx, barBak=_viewerBar;
  const finge=()=>{ const d=document.implementation.createHTMLDocument('x'); const cuenta={};
    return { document:d, cuenta, addEventListener:(t2)=>{ cuenta[t2]=(cuenta[t2]||0)+1; }, removeEventListener:()=>{} }; };
  const w1=finge();
  let ok1=true; for(let k=0;k<3;k++) ok1=viewerBuildDoc(w1)&&ok1;   // uno de apertura + dos auto-sanados
  const w2=finge(); const ok2=viewerBuildDoc(w2);                    // ventana NUEVA: sus propios oyentes
  _viewerCtx=ctxBak; _viewerBar=barBak;
  return JSON.stringify({montajes:3, montaBien:ok1&&ok2,
    resize:w1.cuenta.resize||0, beforeunload:w1.cuenta.beforeunload||0,
    unaSolaVez:(w1.cuenta.resize===1&&w1.cuenta.beforeunload===1),
    laNuevaLosRecibe:(w2.cuenta.resize===1&&w2.cuenta.beforeunload===1)});
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r2);

console.log('3) borrar un clip suelta su textura de curvas');
const r3 = await ev(`(async()=>{ try{
  await newProject('flat',1920,1080,30,180,true); if(typeof hideLanding==='function')hideLanding();
  const LV=state.lanes.findIndex(l=>l.kind!=='audio');
  _demoAddShape('rect','#888',LV,0,2,{x:0,y:0,scale:100});
  const c=state.clips[state.clips.length-1];
  c.props.curves={l:[[0,0],[0.5,0.7],[1,1]]};   // los canales son l/r/g/b (ver curveIsIdentity)
  const tex=clipCurveTex(c); if(!tex) return JSON.stringify({err:'no se creo la textura de curvas'});
  const viva=gl.isTexture(tex);
  _quitarClips([c.id]);
  return JSON.stringify({vivaAntes:viva, vivaDespues:gl.isTexture(tex), soltada:viva&&!gl.isTexture(tex)});
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r3);

console.log('4) borrar el clip fuente suelta la cache de bandas');
const r4 = await ev(`(async()=>{ try{
  await newProject('flat',1920,1080,30,180,true); if(typeof hideLanding==='function')hideLanding();
  const LV=state.lanes.findIndex(l=>l.kind!=='audio');
  _demoAddShape('rect','#888',LV,0,4,{x:0,y:0,scale:100});
  const c=state.clips[state.clips.length-1];
  _arCache={clip:c, fps:30, raw:{bass:new Float32Array(8)}, bass:new Float32Array(8),
            mid:new Float32Array(8), treble:new Float32Array(8), bright:new Float32Array(8), beats:[], bpm:0, beat0:0};
  const antes=!!(_arCache&&_arCache.clip&&_arCache.clip.id===c.id);
  const nivelAntes=bandLevelAt('bass',1);
  _quitarClips([c.id]);
  const sigueAgarrada=!!(_arCache&&_arCache.clip&&_arCache.clip.id===c.id);
  return JSON.stringify({estabaPuesta:antes, nivelAntes:+nivelAntes.toFixed(3),
    sigueAgarrada, sueltaAlBorrar: antes&&!sigueAgarrada});
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r4);

const malas=[];
const J=s=>{ try{ return JSON.parse(s); }catch(e){ return {err:String(s).slice(0,90)}; } };
const o1=J(r1),o1b=J(r1b),o2=J(r2),o3=J(r3),o4=J(r4);
for(const [n,o] of [['1',o1],['1b',o1b],['2',o2],['3',o3],['4',o4]]) if(o.err) malas.push('sonda '+n+' rota: '+o.err);
if(!o1.err){ if(!o1.primeroRojo) malas.push('la escena no se pinto como se esperaba: la sonda no mide nada ('+o1.primero+')');
  if(!o1.segundoVerde) malas.push('el repintado estampa el fotograma de otro tiempo ('+o1.segundo+' en vez de verde)'); }
if(!o1b.err){ if(!o1b.ambosVerdes) malas.push('con el cabezal quieto el color cambia: regresion');
  if(!o1b.reutilizaLaMisma) malas.push('con el cabezal quieto ya no se reutiliza el composite: se recompone de mas'); }
if(!o2.err){ if(!o2.montaBien) malas.push('viewerBuildDoc no monta sobre la ventana de prueba');
  if(!o2.unaSolaVez) malas.push('los oyentes de ventana se acumulan: '+o2.resize+' resize / '+o2.beforeunload+' beforeunload en 3 montajes');
  if(!o2.laNuevaLosRecibe) malas.push('una ventana NUEVA se queda sin sus oyentes'); }
if(!o3.err&&!o3.soltada) malas.push('la textura de curvas sigue viva tras borrar el clip');
if(!o4.err&&!o4.sueltaAlBorrar) malas.push('la cache de bandas sigue agarrada al clip borrado');
console.log('');
for(const m of malas) console.log('   *** '+m);
console.log(malas.length ? ('*** '+malas.length+' FALLOS') : 'el visor no estampa fotogramas viejos y los recursos se sueltan');
ws.close(); process.exit(malas.length?1:0);
