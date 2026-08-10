/* [R319] Tanda de MEDIA de la auditoría — los que se notan en uso normal.
     1 · el rombo del Mix se pintaba SIEMPRE (usaba `hasKf`, la FUNCIÓN global, siempre truthy)
     2 · la estimación de tamaño de HAP se iba ×16 (bpb son bytes por BLOQUE, no por píxel)
     3 · los dos códecs por FFmpeg se ofrecían sin comprobar que el binario exista
     4 · el punto «en vivo» de una entrada Spout leía la bandera de NDI
     5 · cambiar la resolución de NDI/Spout con la salida viva duplicaba el contador de powerSave
     6 · una escala de 0 se convertía en 100: el clip reaparecía a tamaño completo
     7 · abrir un `.isp` dañado por el menú dejaba `currentPath` apuntando al archivo nuevo
     8 · «Rebarajar» + Cancelar dejaba la bandera pegada y rebarajaba en la siguiente recomposición
   Uso:  npx electron . --remote-debugging-port=9222   y luego   node scratchpad/r319-verif.mjs
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

/* Varios de estos viven en el FUENTE (plantillas, listas de códecs), donde mirar el texto es la comprobación
   honesta. Se limpian los comentarios antes — la lección de R315/R318: analizar fuente sin limpiar es analizar
   también lo que se dice DE él. */
console.log('\n── comprobaciones sobre el fuente ──');
const f = await ev(`(async()=>{ try{
  const bruto=await (await fetch('app.js')).text();
  const t=bruto.replace(/\\/\\*[\\s\\S]*?\\*\\//g,' ').replace(/\\/\\/[^\\n]*/g,' ');
  return {
    hap     :/Math\\.ceil\\(p\\.w\\/4\\)\\*Math\\.ceil\\(p\\.h\\/4\\)\\*F\\.bpb\\*n\\*0\\.85/.test(t),
    /* [R320] Ahora se sondea POR FILA: ffh264 y ffhevc no dependen del mismo codificador, y comprobar solo
       que el binario exista ofrecia H.265 en un FFmpeg compilado sin libx265.
       (Sin acentos graves aqui dentro: cierran la plantilla de la sonda.) */
    ffProbe : /if\\(c\\.ff\\)\\{ filas\\.push\\(\\{c,cabe:await ffDisponible\\(c\\.v\\)/.test(t),
    spLive  : /m\\.kind==='spout'\\)\\?m\\._spLive:m\\._ndiLive/.test(t),
    psNdi   : /function startNDI\\(res\\)\\{ if\\(_ndiOn\\)stopNDI\\(\\)/.test(t),
    psSpout : /function startSpout\\(res\\)\\{ if\\(_spoutOn\\)stopSpout\\(\\)/.test(t),
    /* [R320 -> R322] R319 capturaba el fallo pero REPONIA la ruta del proyecto anterior, que estaba bien: como
       saveProject solo abre dialogo cuando no hay ruta, un Ctrl+S posterior escribia el estado a medias encima
       del proyecto bueno y sin preguntar. R320 lo dejo sin ruta, pero SOLO en el catch de openProject; los otros
       seis caminos de carga seguian igual. R322 lo movio al finally de loadProject, que es por donde pasan los
       siete, asi que la comprobacion ya no es sobre el catch del menu sino sobre el envoltorio. */
    openTry : /currentPath=p; hideLanding\\(\\);\\s*try\\{ loadProject/.test(t)
              && /function loadProject\\(obj\\)\\{[\\s\\S]{0,1600}?finally\\{[\\s\\S]{0,1200}?currentPath=null;/.test(t),
  };
}catch(e){ return {err:String(e&&e.message||e)}; } })()`);
if(f.err) mal('no se pudo leer el fuente: '+f.err);
else{
  const casos=[['hap','la estimacion HAP ya no multiplica por 16'],
               ['ffProbe','el panel sondea FFmpeg antes de ofrecer sus codecs'],
               ['spLive','el punto en vivo distingue Spout de NDI'],
               ['psNdi','startNDI para la salida anterior antes de relanzar'],
               ['psSpout','startSpout hace lo mismo'],
               ['openTry','abrir por el menu captura el fallo y se queda SIN ruta (R320: reponer la anterior permitia pisarla con Ctrl+S)']];
  for(const [k,txt] of casos){ if(f[k])bien(txt); else mal('NO aplicado: '+txt); }
}

/* ── 1 ── El rombo del Mix. [R349] Antes esto era un patron de texto sobre el FUENTE
   (el trozo de plantilla que pintaba el rombo), o sea la premisa: comprobaba como estaba ESCRITO el sitio donde vivia la senal, no que
   la senal fuera correcta — y en cuanto R349 rehizo la fila de Motion con la estetica del inspector, la fila
   dejo de existir tal cual y la red se puso roja sin que nada se hubiera roto. Ahora se mide la CONCLUSION: sin
   curva de Mix el rombo esta apagado y la fila no aparece automatizada; con curva, encendido. Eso caza el fallo
   original de R224 (el rombo pintado SIEMPRE porque se leia `hasKf`, la funcion global, que devuelve `undefined`
   y no `false`) y tambien su inverso, y no depende de como este escrita la plantilla. */
console.log('\n── el rombo del Mix sigue a la curva, no esta siempre puesto ──');
const e1 = await ev(`(async()=>{ try{
  await newProject('dome',1024,1024,30,180,true); if(typeof hideLanding==='function')hideLanding();
  _demoAddShape('rect','#888',0,0,4,{az:0,el:45,size:40});
  const c=state.clips[state.clips.length-1]; state.selId=c.id; state.selIds=[c.id];
  c.anim=[]; addAnimPreset(c,'spin');
  state.insCol=state.insCol||{}; state.insCol.motion=false;
  renderInspector(); await new Promise(z=>setTimeout(z,150));
  const trasRender=document.querySelectorAll('#animList [data-ai]').length;
  buildAnimList(c);   /* explicito: renderInspector puede haber repintado despues por otro camino */
  const leer=()=>{ const it=document.querySelector('#animList [data-ai]'); if(!it)return null;
    const kb=it.querySelector('.awetkf'); const fila=it.querySelector('.awrow')||it;
    if(!kb)return null;
    return {rombo:kb.classList.contains('on')||/#FFFFFF|#C9CDD3/i.test(kb.style.color||''),
            auto:fila.classList.contains('auto')}; };
  const sin=leer(); if(!sin)return {err:'no encuentro la fila del Mix · anim='+((c.anim||[]).length)
    +' lista='+(!!document.getElementById('animList'))+' items='+document.querySelectorAll('#animList [data-ai]').length
    +' sel='+(selClip()===c)+' trasRender='+trasRender};
  const a=c.anim[0]; state.playhead=c.start+0.5;
  animToggleWetKf(a,c); buildAnimList(c); await new Promise(z=>setTimeout(z,120));
  const con=leer();
  return {sin,con};
}catch(e){ return {err:String(e&&e.message||e)}; } })()`);
if(e1.err) mal('no se pudo evaluar: '+e1.err);
else{
  console.log('   sin curva: '+JSON.stringify(e1.sin)+'  ·  con curva: '+JSON.stringify(e1.con));
  if(e1.sin.rombo) mal('el rombo aparece ENCENDIDO sin ninguna curva de Mix (el fallo de R224, de vuelta)');
  else if(!e1.con.rombo) mal('con una curva de Mix en el cabezal el rombo sigue apagado');
  else if(!e1.con.auto) mal('la fila no se marca como automatizada teniendo curva');
  else bien('el rombo y el resaltado de la fila siguen a la curva del Mix');
}

/* ── 6 ── La escala 0, medida sobre el render real. */
console.log('\n── una escala de 0 no reaparece a tamaño completo ──');
const e6 = await ev(`(async()=>{ try{
  await newProject('flat',1920,1080,30,180,true); if(typeof hideLanding==='function')hideLanding();
  const LV=state.lanes.findIndex(l=>l.kind!=='audio');
  _demoAddShape('rect','#FFFFFF',LV,0,4,{x:0,y:0,scale:100});
  const c=state.clips[state.clips.length-1]; state.selId=c.id;
  state.playhead=1;
  c.props.scale=100; render();
  const grande=(()=>{ const px=new Uint8Array(4); gl.readPixels(Math.floor(glc.width/2),Math.floor(glc.height/2),1,1,gl.RGBA,gl.UNSIGNED_BYTE,px); return px[0]; })();
  c.props.scale=0; render();
  const cero=(()=>{ const px=new Uint8Array(4); gl.readPixels(Math.floor(glc.width/2),Math.floor(glc.height/2),1,1,gl.RGBA,gl.UNSIGNED_BYTE,px); return px[0]; })();
  return {grande,cero};
}catch(e){ return {err:String(e&&e.message||e)}; } })()`);
if(e6.err) mal('no se pudo evaluar: '+e6.err);
else{
  console.log('   pixel central: '+e6.grande+' con escala 100 → '+e6.cero+' con escala 0');
  if(e6.grande<80) mal('la forma no se veia ni con escala 100: la prueba no mide nada');
  else if(e6.cero>=80) mal('con escala 0 el clip SIGUE a tamaño completo ('+e6.cero+')');
  else bien('con escala 0 el clip desaparece, como debe');
}

/* ── 8 ── Rebarajar y cancelar no deja la bandera pegada. */
console.log('\n── «Rebarajar» + Cancelar no deja la bandera puesta ──');
const e8 = await ev(`(async()=>{ try{
  await newProject('dome',1024,1024,30,180,true); if(typeof hideLanding==='function')hideLanding();
  _demoAddShape('rect','#888',0,0,2,{az:0,el:45,size:40});
  _demoAddShape('rect','#444',0,2,2,{az:90,el:45,size:40});
  const ids=state.media.filter(m=>m.kind==='shape').map(m=>m.id);
  state.selMediaIds=ids.slice(); state.selMediaId=ids[0];
  openCompose(); await new Promise(z=>setTimeout(z,300));
  const go=document.querySelector('#cGo'); if(go)go.click();      // crear la composicion
  await new Promise(z=>setTimeout(z,400));
  const nest=state.media.filter(m=>m.kind==='nest'&&m.comp).pop();
  if(!nest) return {err:'no se creo la composicion'};
  const antes=!!nest.comp._orderR;
  openCompose(null,nest.comp,nest); await new Promise(z=>setTimeout(z,300));
  const crs=document.querySelector('#cReshuffle'); if(!crs) return {err:'no hay boton Rebarajar'};
  crs.click(); await new Promise(z=>setTimeout(z,150));
  const durante=!!nest.comp._orderR;
  if(_cerrarComp)_cerrarComp();                                    // CANCELAR (cerrar sin Aplicar)
  await new Promise(z=>setTimeout(z,200));
  const despues=!!nest.comp._orderR;
  return {antes,durante,despues};
}catch(e){ return {err:String(e&&e.message||e)}; } })()`);
if(e8.err) mal('no se pudo evaluar: '+e8.err);
else{
  console.log('   _orderR: '+e8.antes+' al entrar → '+e8.durante+' tras pulsar Rebarajar → '+e8.despues+' tras Cancelar');
  if(!e8.durante) mal('pulsar Rebarajar no marco nada: la vista previa no mostraria el reparto nuevo');
  else if(e8.despues!==e8.antes) mal('Cancelar dejo la bandera pegada: la siguiente recomposicion rebarajaria sola');
  else bien('Cancelar devuelve la bandera a como estaba');
}

console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'la tanda de MEDIA queda verificada'));
ws.close(); process.exit(fallos?1:0);
