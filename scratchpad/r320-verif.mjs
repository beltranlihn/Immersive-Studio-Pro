/* [R320] La tanda que sale del segundo repaso de código: trece regresiones introducidas arreglando trece
   hallazgos. Ocho de ellas eran el MISMO error —arreglar la copia y dejar el original—, así que esta sonda no
   comprueba parches sueltos sino que los GEMELOS quedaron cerrados.

     1 · la familia del trim: `slip` no rebasaba la curva del clip agarrado (su mitad enlazada SÍ, lo que dejaba
         el vídeo y el audio de un par A/V con la automatización desalineada), `slide` no rebasaba a su vecino
         de la derecha, y dos de los siete puntos de llamada de `_mirrorLinkTrim` iban sin instantánea.
     2 · `trimItem` conservaba la guarda `src.length>1` que R314 quitó de su copia: una curva de UN punto que se
         salía del borde se perdía entera. Ahora hay UNA implementación, no dos.
     3 · el fader de Mix y el botón de encendido de un modificador de Motion no empujaban deshacer, siendo los
         únicos de su fila que no lo hacían.
     4 · `beginFlatResize` conservaba el `||100` que R319 arregló en `flatPlace`: agarrar el tirador de escala en
         un clip a escala 0 lo devolvía a tamaño completo antes de mover el ratón.
     5 · la hoja de export cerraba con Escape aunque hubiera un cuadro ENCIMA, cancelando el render en marcha.
     6 · en cuadrícula, una entrada Spout se rotulaba «NDI» (la vista de lista ya los distinguía).
     7 · diez mutaciones que repintaban sin invalidar la generación del fotograma: scopes, NDI, Spout y el
         indicador de fotograma caliente se quedaban con el anterior.
     8 · el panel de export ofrecía H.265 por FFmpeg sin comprobar que ese FFmpeg traiga el codificador, y
         nombraba «H.264» al avisar de que H.265 no cabía.

   Uso:  npx electron . --remote-debugging-port=9222   y luego   node scratchpad/r320-verif.mjs
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

/* Montaje comun: un par A/V enlazado sobre una fuente de video sintetica de 30 s, con una curva de opacidad en
   la mitad de video y una de volumen en la de audio. Las dos mitades tienen que moverse igual. */
const MONTA=`
  await newProject('flat',1920,1080,30,180,true); if(typeof hideLanding==='function')hideLanding();
  const LV=state.lanes.findIndex(l=>l.kind!=='audio'), LA=state.lanes.findIndex(l=>l.kind==='audio');
  const MV={id:970001,kind:'video',name:'v',dur:30,w:1920,h:1080,fps:30,color:'#888'};
  const MA={id:970002,kind:'audio',name:'a',dur:30,fps:0,color:'#888'};
  state.media.push(MV,MA);
  const V={id:970101,lane:LV,mediaId:MV.id,start:2,dur:4,inP:5,speed:1,link:'L1',avRole:'video',
           props:{opacity:100},kf:{opacity:[{t:0,v:0,e:'linear'},{t:3,v:100,e:'linear'}]}};
  const A={id:970102,lane:LA,mediaId:MA.id,start:2,dur:4,inP:5,speed:1,link:'L1',avRole:'audio',
           props:{vol:100},kf:{vol:[{t:0,v:0,e:'linear'},{t:3,v:100,e:'linear'}]}};
  state.clips.push(V,A);
`;

/* ── 1 ── SLIP: el material resbala bajo la ventana; las DOS curvas tienen que seguirlo. */
console.log('\n── 1 · slip: la curva sigue al material, y la mitad enlazada tambien ──');
const e1 = await ev(`(async()=>{ try{
  ${MONTA}
  const base={start:V.start,dur:V.dur,inP:V.inP,linkBase:{start:A.start,dur:A.dur,inP:A.inP}};
  const d=applyTrim({kind:'slip',c:V}, -1, base);        // dt negativo -> d=+1 s de material
  return {d, kfV:V.kf.opacity.map(k=>+k.t.toFixed(3)), kfA:A.kf.vol.map(k=>+k.t.toFixed(3)),
          inPV:+V.inP.toFixed(3), inPA:+A.inP.toFixed(3)};
}catch(e){ return {err:String(e&&e.message||e)}; } })()`);
if(e1.err) mal('no se pudo evaluar: '+e1.err);
else{
  console.log('   d='+e1.d+'  ·  video inP='+e1.inPV+' kf='+JSON.stringify(e1.kfV)+'  ·  audio inP='+e1.inPA+' kf='+JSON.stringify(e1.kfA));
  if(!e1.d) mal('el slip no movio nada: la prueba no mide nada');
  else if(JSON.stringify(e1.kfV)==='[0,3]') mal('la curva del clip agarrado NO se movio: sigue anclada a la ventana mientras el material resbala');
  else if(JSON.stringify(e1.kfV)!==JSON.stringify(e1.kfA)) mal('las dos mitades del par A/V quedaron con curvas distintas: '+JSON.stringify(e1.kfV)+' vs '+JSON.stringify(e1.kfA));
  else bien('las dos curvas se corren con el material, y por igual ('+JSON.stringify(e1.kfV)+')');
}

/* ── 1b ── SLIDE: el clip se mueve y el VECINO DE LA DERECHA cambia su `inP`. */
console.log('\n── 1b · slide: el vecino de la derecha rebasa su automatizacion ──');
const e1b = await ev(`(async()=>{ try{
  ${MONTA}
  const N={id:970103,lane:LV,mediaId:MV.id,start:6,dur:4,inP:9,speed:1,
           props:{opacity:100},kf:{opacity:[{t:0,v:0,e:'linear'},{t:3,v:100,e:'linear'}]}};
  state.clips.push(N);
  const base={start:V.start,dur:V.dur,inP:V.inP,linkBase:null,pDur:0,nStart:N.start,nDur:N.dur,nInP:N.inP};
  const d=applyTrim({kind:'slide',c:V,prev:null,next:N}, 1, base);
  return {d, kfN:N.kf.opacity.map(k=>+k.t.toFixed(3)), inPN:+N.inP.toFixed(3), kfV:V.kf.opacity.map(k=>+k.t.toFixed(3))};
}catch(e){ return {err:String(e&&e.message||e)}; } })()`);
if(e1b.err) mal('no se pudo evaluar: '+e1b.err);
else{
  console.log('   d='+e1b.d+'  ·  vecino inP='+e1b.inPN+' kf='+JSON.stringify(e1b.kfN)+'  ·  agarrado kf='+JSON.stringify(e1b.kfV));
  if(!e1b.d) mal('el slide no movio nada: la prueba no mide nada');
  else if(JSON.stringify(e1b.kfN)==='[0,3]') mal('el vecino movio su material y su curva NO: queda descolgada');
  else if(JSON.stringify(e1b.kfV)!=='[0,3]') mal('el clip agarrado, que solo cambia `start`, ha rebasado su curva de mas: las claves son relativas a start y viajan con el');
  else bien('el vecino corre su curva ('+JSON.stringify(e1b.kfN)+') y el agarrado conserva la suya');
}

/* ── 2 ── `trimItem` delegado: una curva de UN SOLO punto que se sale por el borde congela su valor. */
console.log('\n── 2 · trimItem: una curva de un solo punto no se pierde al recortar por la izquierda ──');
const e2 = await ev(`(async()=>{ try{
  ${MONTA}
  V.kf={opacity:[{t:0.5,v:42,e:'linear'}]};                      // UNA sola clave, dentro del primer segundo
  const it={id:V.id,start0:V.start,dur0:V.dur,inP0:V.inP,kf0:JSON.parse(JSON.stringify(V.kf)),anim0:null};
  trimItem(it,'L',2);                                             // recorte de 2 s por la izquierda: la clave se sale
  const k=(V.kf&&V.kf.opacity)||null;
  return {hay:!!k, n:k?k.length:0, v:k&&k.length?k[0].v:null, t:k&&k.length?+k[0].t.toFixed(3):null};
}catch(e){ return {err:String(e&&e.message||e)}; } })()`);
if(e2.err) mal('no se pudo evaluar: '+e2.err);
else{
  console.log('   tras el recorte: '+(e2.hay?e2.n+' clave(s), la primera v='+e2.v+' en t='+e2.t:'ninguna clave'));
  if(!e2.hay||!e2.n) mal('la curva se perdio ENTERA: el parametro salta al valor viejo de props sin avisar (guarda src.length>1)');
  else if(e2.v!==42) mal('la clave de frontera no conserva el valor de la curva en el corte (v='+e2.v+', se esperaba 42)');
  else bien('la clave de frontera congela el valor en el corte, con curvas de un solo punto');
}

/* ── 3 ── Deshacer en la fila de Motion: el on/off y el fader de Mix. */
console.log('\n── 3 · el on/off y el Mix de un modificador de Motion se deshacen ──');
for(const caso of [
  {n:'on/off',  sel:'.animon',  foto:'String(selClip().anim[0].on)', gesto:"document.querySelector('.animon').click()"},
  /* El Mix NO se guarda en `a.wet`: `animSetWet` pasa por `manualEdit`, que escribe `c.props[motKeyFor(a)]`
     (o una clave, si el parametro ya esta automatizado). El primer intento leia `a.wet` y siempre veia 1 —un
     no-cambio que la sonda habria dado por bueno si no exigiera que el gesto cambie algo. */
  /* [R322] El gesto empieza con un `pointerdown`, que es donde el fader empuja ahora la foto de deshacer. R320 lo
     hacia con un pestillo rearmado en `change`, y `change` NO dispara si se suelta en el valor de partida: tras
     un arrastre de ida y vuelta el pestillo se quedaba puesto y el arrastre siguiente no empujaba nada. Se adopto
     el patron del hermano `#maskScaleR` (foto en el pointerdown), asi que la sonda tiene que reproducir el gesto
     COMPLETO — con solo `input` medía un arrastre que en la aplicación real no existe. */
  {n:'fader Mix', sel:'.awet',  foto:"String(selClip().props[motKeyFor(selClip().anim[0])])",
   gesto:"{ const el=document.querySelector('.awet'); el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); el.value='30'; el.dispatchEvent(new Event('input')); el.dispatchEvent(new Event('change')); }"},
]){
  const r = await ev(`(async()=>{ try{
    await newProject('flat',1920,1080,30,180,true); if(typeof hideLanding==='function')hideLanding();
    const LV=state.lanes.findIndex(l=>l.kind!=='audio');
    _demoAddShape('rect','#888',LV,0,4,{x:0,y:0,scale:100});
    const c=state.clips[state.clips.length-1]; state.selId=c.id; addAnimPreset(c,'hmove');
    insColState().motion=false; renderInspector();
    if(!document.querySelector('${caso.sel}')) return {err:'no encuentro ${caso.sel} en el inspector'};
    clearAllUndo();
    const antes=${caso.foto}, pila0=_ustk().u.length;
    ${caso.gesto};
    const tras=${caso.foto}, pila1=_ustk().u.length;
    undo(); const vuelta=${caso.foto};
    return {antes,tras,vuelta,pila0,pila1};
  }catch(e){ return {err:String(e&&e.message||e)}; } })()`);
  if(r.err){ mal(caso.n+' — no se pudo evaluar: '+r.err); continue; }
  if(r.antes===r.tras){ mal(caso.n+' — el gesto no cambio nada ('+r.antes+'): la comprobacion no prueba nada'); continue; }
  if(r.pila1<=r.pila0){ mal(caso.n+' — no empujo deshacer (pila '+r.pila0+' → '+r.pila1+')'); continue; }
  if(r.vuelta!==r.antes){ mal(caso.n+' — Ctrl+Z no lo restaura: '+r.antes+' → '+r.tras+' → '+r.vuelta); continue; }
  bien(caso.n+'  ('+r.antes+' → '+r.tras+' → '+r.vuelta+')');
}

/* ── 4 ── `beginFlatResize` con escala 0: agarrar el tirador no debe devolver el clip a tamaño completo. */
console.log('\n── 4 · agarrar el tirador de escala en un clip a escala 0 ──');
const e4 = await ev(`(async()=>{ try{
  await newProject('flat',1920,1080,30,180,true); if(typeof hideLanding==='function')hideLanding();
  const LV=state.lanes.findIndex(l=>l.kind!=='audio');
  _demoAddShape('rect','#FFFFFF',LV,0,4,{x:0,y:0,scale:100});
  const c=state.clips[state.clips.length-1]; state.selId=c.id; state.playhead=1;
  c.props.scale=0; render();
  const g=beginFlatResize(c,{sx:1,sy:1});
  return {scale0:g?+g.scale0.toFixed(4):null, animS:g?+g.animS.toFixed(4):null};
}catch(e){ return {err:String(e&&e.message||e)}; } })()`);
if(e4.err) mal('no se pudo evaluar: '+e4.err);
else{
  console.log('   scale0='+e4.scale0+'   animS='+e4.animS);
  if(e4.scale0==null) mal('beginFlatResize devolvio null: la prueba no mide nada');
  else if(e4.scale0>=0.5) mal('con escala 0 el gesto arranca desde escala '+(e4.scale0*100)+'%: el clip reaparece a tamaño completo');
  else bien('el gesto arranca desde la escala real, no desde 100%');
}

/* ── 5 ── Escape con un cuadro ENCIMA de la hoja de export no cierra la hoja. */
console.log('\n── 5 · Escape con un cuadro encima no cierra la hoja de export ──');
const e5 = await ev(`(async()=>{ try{
  await newProject('flat',1920,1080,30,180,true); if(typeof hideLanding==='function')hideLanding();
  const LV=state.lanes.findIndex(l=>l.kind!=='audio');
  _demoAddShape('rect','#888',LV,0,4,{x:0,y:0,scale:100});
  openExport(); await new Promise(z=>setTimeout(z,350));
  if(!document.getElementById('exOv')) return {err:'no se abrio la hoja de export'};
  appConfirm('prueba');  await new Promise(z=>setTimeout(z,250));       // un cuadro ENCIMA
  const cuadros=document.querySelectorAll('.overlay').length;
  document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  await new Promise(z=>setTimeout(z,250));
  const hojaViva=!!document.getElementById('exOv'), cuadrosTras=document.querySelectorAll('.overlay').length;
  document.querySelectorAll('.overlay').forEach(o=>o.remove());
  const x=document.getElementById('exX'); if(x)x.click();
  return {cuadros,hojaViva,cuadrosTras};
}catch(e){ return {err:String(e&&e.message||e)}; } })()`);
if(e5.err) mal('no se pudo evaluar: '+e5.err);
else if(!e5.cuadros) mal('no llego a abrirse ningun cuadro encima: la prueba no mide nada');
else if(!e5.hojaViva) mal('el Escape cerro la hoja de export que estaba DEBAJO (y con un render vivo lo habria cancelado)');
else bien('el Escape se lo queda el cuadro de arriba; la hoja sigue abierta ('+e5.cuadros+' → '+e5.cuadrosTras+' cuadros)');

/* ── 6-8 ── Lo que se comprueba sobre el FUENTE, que es donde vive el hallazgo. Comentarios fuera antes de
   mirar: la leccion de R315/R318 —analizar fuente sin limpiar es analizar tambien lo que se dice DE el. */
console.log('\n── 6-8 · comprobaciones sobre el fuente ──');
const f = await ev(`(async()=>{ try{
  const bruto=await (await fetch('app.js')).text();
  const t=bruto.replace(/\\/\\*[\\s\\S]*?\\*\\//g,' ').replace(/\\/\\/[^\\n]*/g,' ');
  return {
    spoutChip : /isNdi\\?\\(m\\.kind==='spout'\\?'SPOUT':'NDI'\\)/.test(t),
    ffPorFila : /ffDisponible\\(c\\.v\\)/.test(t) && /_ffCap\\.hevc:_ffCap\\.h264/.test(t),
    nomCodec  : /\\/hevc\\/i\\.test\\(mio\\.c\\.v\\)/.test(t),
    /* Tres llamadas (FFmpeg, PNG a disco, PNG a ZIP) y UNA definicion, que al escribirse con un = entre el
       nombre y el parentesis NO casa con el patron de llamada: el primer intento exigia 4 y contaba 3.
       (Y nada de acentos graves aqui dentro, que cierran la plantilla de la sonda.) */
    unSoloPintar : (t.match(/pintarFotograma\\(/g)||[]).length===3 && /const pintarFotograma=/.test(t)
                   && !/if\\(flat\\)\\{ renderExportFrame\\(t,qRes,ssExport,wall\\); \\} else \\{ composite\\(/.test(t),
    unSoloRebase : !/if\\(a\\.length<src\\.length&&src\\.length>1\\)/.test(t),
    trimDelega   : /rebaseAutoPorMaterial\\(oc,it\\.kf0,it\\.anim0,d\\)/.test(t),
    ovTopExport  : /if\\(!ov\\.isConnected\\)\\{document\\.removeEventListener\\('keydown',onKey,true\\);return;\\}\\s*if\\(!ovTop\\(ov\\)\\)return;/.test(t),
  };
}catch(e){ return {err:String(e&&e.message||e)}; } })()`);
if(f.err) mal('no se pudo leer el fuente: '+f.err);
else{
  const casos=[['spoutChip','en cuadricula una entrada Spout se rotula SPOUT, no NDI'],
               ['ffPorFila','el panel sondea el CODIFICADOR de cada fila, no solo que exista el binario'],
               ['nomCodec','el aviso de tamaño nombra el codec de la fila (ffhevc ya no dice H.264)'],
               ['unSoloPintar','los tres bucles de export pintan por el mismo punto (el reloj reactivo, en uno)'],
               ['unSoloRebase','ya no queda una segunda copia del rebase con la guarda src.length>1'],
               ['trimDelega','trimItem delega en rebaseAutoPorMaterial: una sola implementacion'],
               ['ovTopExport','la hoja de export cede el Escape al cuadro de arriba']];
  for(const [k,txt] of casos){ if(f[k])bien(txt); else mal('NO aplicado: '+txt); }
}

/* ── 7 ── Diez mutaciones que repintaban sin invalidar la generacion del fotograma. */
console.log('\n── 7 · una mutacion de grupo invalida la generacion del fotograma ──');
const e7 = await ev(`(async()=>{ try{
  await newProject('dome',1024,1024,30,180,true); if(typeof hideLanding==='function')hideLanding();
  _demoAddShape('rect','#888',0,0,4,{az:0,el:45,size:40});
  _demoAddShape('rect','#444',0,0,4,{az:90,el:45,size:40});
  const cs=state.clips.slice(-2); const g={id:uid(),spin:0,el:45,size:40,members:cs.map(c=>c.id)};
  state.groups=state.groups||[]; state.groups.push(g); for(const c of cs)c.groupId=g.id;
  _raOn=false; const antes=_raGen; groupSpin(g,90); const tras=_raGen;
  return {antes,tras,az:cs[0].props.az};
}catch(e){ return {err:String(e&&e.message||e)}; } })()`);
if(e7.err) mal('no se pudo evaluar: '+e7.err);
else if(e7.tras<=e7.antes) mal('girar un grupo no avanzo la generacion ('+e7.antes+' → '+e7.tras+'): scopes, NDI y Spout seguirian con el fotograma viejo');
else bien('girar un grupo invalida la generacion ('+e7.antes+' → '+e7.tras+', az='+e7.az+')');

console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'la tanda R320 queda verificada'));
ws.close(); process.exit(fallos?1:0);
