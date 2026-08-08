/* [R314] Verificación de las regresiones que introdujeron R310-R313 y que cazó el repaso de código.
   Las sondas anteriores probaban que cada arreglo arreglaba SU fallo; ninguna probaba que no rompiera otra cosa,
   y varias montaban el proyecto en 2D, que es justo lo que escondió el `_arTime` congelado del domo.
     1 · la curva se RESTAURA al volver el arrastre a su origen (la guarda `!d` la dejaba pegada)
     2 · el recorte por TECLADO rebasa igual que el del ratón (trimNudge)
     3 · el PARTNER enlazado también rebasa (_mirrorLinkTrim, el punto único)
     4 · una curva de UN SOLO punto no se pierde: congela su valor
     5 · un clip SIN automatización no acaba con `kf`/`anim` materializados
     6 · duplicar una pista conserva el silencio de la mitad de vídeo (audio doble)
     7 · los menús con marcado a propósito siguen mostrando su rombo, y los nombres de usuario se escapan
     8 · la firma del tejido reacciona a un cambio en CUALQUIER clip, no sólo en el primero
   Uso:  npx electron . --remote-debugging-port=9222   y luego   node scratchpad/r314-verif.mjs
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
const casi=(a,b,tol)=>Math.abs(a-b)<=(tol||0.5);

console.log('\n── 1-5 · la familia del trim ──');
const t = await ev(`(async()=>{ try{
  await newProject('flat',1920,1080,30,180,true); if(typeof hideLanding==='function')hideLanding();
  const R={};
  const nuevo=()=>{ _demoAddShape('rect','#888888',0,0,6,{x:0,y:0,scale:100}); return state.clips[state.clips.length-1]; };
  const baseDe=c=>({start:c.start,dur:c.dur,inP:c.inP||0,after:new Map()});

  /* 1 · ida y vuelta: la curva tiene que quedar como estaba */
  { const c=nuevo(); setKf(c,'opacity',c.start+0,0,'linear'); setKf(c,'opacity',c.start+4,100,'linear');
    const antes=JSON.stringify(c.kf.opacity);
    const b=baseDe(c);
    applyTrim({kind:'rippleL',c},1,b);      // arrastra 1 s
    applyTrim({kind:'rippleL',c},0,b);      // y vuelve al origen
    R.idaVuelta={igual:JSON.stringify(c.kf.opacity)===antes, antes, ahora:JSON.stringify(c.kf.opacity)}; }

  /* 2 · el camino de TECLADO (trimNudge) rebasa */
  { const c=nuevo(); setKf(c,'opacity',c.start+0,0,'linear'); setKf(c,'opacity',c.start+4,100,'linear');
    const en2=evalP(c,'opacity',c.start+2);
    state.selId=c.id; state.tl.tool='trim'; state.playhead=c.start;   // cerca del borde izquierdo → rippleL
    trimNudge(1,30);                                                  // +1 s por teclado
    R.teclado={antes:en2, despues:evalP(c,'opacity',c.start+1), inP:c.inP}; }

  /* 3 · el PARTNER enlazado rebasa */
  { const v=nuevo(); const ai=state.lanes.findIndex(l=>l.kind==='audio');
    const a={id:uid(),mediaId:v.mediaId,lane:ai,start:v.start,dur:v.dur,inP:0,props:{},kf:{},link:4242,avRole:'a'};
    v.link=4242; v.avRole='v'; state.clips.push(a);
    setKf(a,'volume',a.start+0,0,'linear'); setKf(a,'volume',a.start+4,100,'linear');
    const en2=evalP(a,'volume',a.start+2);
    const b=baseDe(v); b.linkBase={start:a.start,dur:a.dur,inP:a.inP||0};
    applyTrim({kind:'rippleL',c:v},1,b);
    R.partner={antes:en2, despues:evalP(a,'volume',a.start+1), inP:a.inP}; }

  /* 4 · curva de UN punto: se congela, no se pierde */
  { const c=nuevo(); c.props.opacity=100; setKf(c,'opacity',c.start+1,37,'linear');
    applyTrim({kind:'rippleL',c},3,baseDe(c));
    R.unPunto={valor:evalP(c,'opacity',c.start+0.5)}; }

  /* 5 · clip SIN automatización: no se le materializa nada */
  { const c=nuevo(); delete c.kf; delete c.anim;
    applyTrim({kind:'rippleL',c},1,baseDe(c));
    R.sinAuto={kf:c.kf===undefined, anim:c.anim===undefined}; }
  return R;
}catch(e){ return {err:String(e&&e.message||e)}; } })()`);
if(t.err) mal('no se pudo evaluar: '+t.err);
else{
  if(!t.idaVuelta.igual) mal('ida y vuelta NO restaura la curva: '+t.idaVuelta.antes+' → '+t.idaVuelta.ahora);
  else bien('arrastrar y volver deja la curva como estaba');
  if(!casi(t.teclado.antes,t.teclado.despues,1)) mal('el recorte por TECLADO no rebasa ('+t.teclado.antes.toFixed(1)+' → '+t.teclado.despues.toFixed(1)+')');
  else bien('trimNudge rebasa igual que el raton ('+t.teclado.antes.toFixed(1)+' = '+t.teclado.despues.toFixed(1)+')');
  if(!casi(t.partner.antes,t.partner.despues,1)) mal('el PARTNER enlazado no rebasa ('+t.partner.antes.toFixed(1)+' → '+t.partner.despues.toFixed(1)+')');
  else bien('la mitad enlazada tambien sigue a su material');
  if(!casi(t.unPunto.valor,37,0.5)) mal('la curva de un solo punto se perdio: vale '+t.unPunto.valor+', se esperaba 37');
  else bien('una curva de un punto congela su valor (37)');
  if(!t.sinAuto.kf||!t.sinAuto.anim) mal('a un clip sin automatizacion se le materializo kf/anim: '+JSON.stringify(t.sinAuto));
  else bien('un clip sin automatizacion sigue sin kf ni anim');
}

console.log('\n── 6 · duplicar pista no duplica el audio ──');
const d6 = await ev(`(async()=>{ try{
  await newProject('flat',1920,1080,30,180,true); if(typeof hideLanding==='function')hideLanding();
  _demoAddShape('rect','#888888',0,0,4,{x:0,y:0,scale:100});
  const v=state.clips[state.clips.length-1]; v.link=99; v.avRole='v'; v.maskTex={};
  duplicateLane(v.lane);
  const copias=state.clips.filter(x=>x.id!==v.id&&x.mediaId===v.mediaId);
  return { copias:copias.length, mudas:copias.filter(x=>x.avRole==='v').length,
           conLink:copias.filter(x=>x.link===99).length,
           texturaMala:copias.some(x=>x.maskTex&&!(x.maskTex instanceof WebGLTexture)) };
}catch(e){ return {err:String(e&&e.message||e)}; } })()`);
if(d6.err) mal('no se pudo evaluar: '+d6.err);
else{
  if(d6.mudas!==d6.copias) mal('las copias han perdido avRole → sonarian por duplicado ('+d6.mudas+' de '+d6.copias+' mudas)');
  else bien('las copias conservan el silencio de la mitad de video');
  if(d6.conLink) mal(d6.conLink+' copia(s) conservan el enlace (partner fantasma)');
  else bien('las copias no arrastran el enlace');
  if(d6.texturaMala) mal('la copia trae una maskTex que no es textura');
  else bien('sin textura falsa (el arreglo de R313 sigue en pie)');
}

console.log('\n── 7 · menus: el marcado a proposito vive, los nombres se escapan ──');
const m7 = await ev(`(()=>{ try{
  const items=[{label:'<span style="color:red">◆</span>&nbsp;<b>Opacity</b>',html:true,fn:()=>{}},
               {label:'Move to: <img src=x onerror="window.__xss2=true">',fn:()=>{}}];
  window.__xss2=false; openMenu(10,10,items);
  const bs=document.querySelectorAll('.menu button');
  const conRombo=[...bs].some(b=>b.querySelector('b')&&b.textContent.indexOf('Opacity')>=0);
  const literal=[...bs].some(b=>b.textContent.indexOf('<img')>=0);
  const inyectado=document.querySelectorAll('.menu img[src="x"]').length;
  closeMenu();
  return {conRombo,literal,inyectado,ejecutado:!!window.__xss2};
}catch(e){ return {err:String(e&&e.message||e)}; } })()`);
if(m7.err) mal('no se pudo evaluar: '+m7.err);
else{
  if(!m7.conRombo) mal('la entrada con marcado a proposito ya no se renderiza como HTML');
  else bien('la entrada con html:true conserva su rombo y su negrita');
  if(m7.ejecutado||m7.inyectado) mal('un nombre de usuario en una etiqueta de menu SIGUE inyectando');
  else if(!m7.literal) mal('el nombre de usuario ni se ejecuta ni se ve: se ha perdido');
  else bien('el nombre de usuario se muestra literal, sin ejecutarse');
}

console.log('\n── 8 · la firma del tejido mira todos los clips ──');
const w8 = await ev(`(()=>{ try{
  const nido=v2=>({ comp:{kind:'weave',shuffle:true,bands:2,count:2,motion:'alt',order:[0,1]},
    nestClips:[{mediaId:1,props:{x:0,y:0},_layBase:{x:0,y:0},anim:[{param:'x',mode:'saw',speed:0.5,phase:0,amp:1,on:true}]},
               {mediaId:2,props:{x:1,y:0},_layBase:{x:1,y:0},anim:[{param:'x',mode:'saw',speed:v2,phase:0,amp:1,on:true}]}] });
  const a=nido(0.12), b=nido(0.90);   // cambia el SEGUNDO clip, no el primero
  wvPrep(a); wvPrep(b);
  return {a:a._wvSig,b:b._wvSig,distintas:a._wvSig!==b._wvSig};
}catch(e){ return {err:String(e&&e.message||e)}; } })()`);
if(w8.err) mal('no se pudo evaluar: '+w8.err);
else if(!w8.distintas) mal('cambiar la velocidad del SEGUNDO clip no altera la firma → wvPrep sigue saliendo antes');
else bien('un cambio en cualquier clip altera la firma ("'+w8.a.split('|')[5]+'" vs "'+w8.b.split('|')[5]+'")');

/* 9 · el diálogo responde a Enter aunque el último <div> de body NO sea un overlay.
   OJO AL ORDEN, que es donde falla la reproducción ingenua: el div de sobra tiene que añadirse DESPUÉS de abrir
   el cuadro. Con `:last-of-type` el fallo NO lo dispara un div que ya estuviera ahí —el overlay se añade al
   final y sigue siendo el último <div>—, sino algo que aparezca ENCIMA mientras el cuadro está abierto: un menú
   (`openMenu`), un fantasma de arrastre, el monitor de origen, o el propio tooltip `.dsp-tip` la primera vez
   que se crea. La primera versión de esta comprobación plantaba el div antes y pasaba con el fallo puesto. */
console.log('\n── 9 · el dialogo sigue respondiendo a Enter con otro div al final ──');
const d9 = await ev(`(async()=>{ try{
  document.querySelectorAll('.overlay').forEach(o=>o.remove());
  let resp=null; appConfirm('¿prueba?',v=>{resp=v;},{ok:'Si',cancel:'No'});
  await new Promise(r=>setTimeout(r,150));
  const habia=!!document.querySelector('#confirmOv');
  const sobra=document.createElement('div'); sobra.id='__sobra'; document.body.appendChild(sobra);  // aparece ENCIMA del cuadro
  document.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  await new Promise(r=>setTimeout(r,150));
  const cerrado=!document.querySelector('#confirmOv');
  document.querySelectorAll('.overlay').forEach(o=>o.remove()); sobra.remove();
  return {habia,cerrado,resp};
}catch(e){ return {err:String(e&&e.message||e)}; } })()`);
if(d9.err) mal('no se pudo evaluar: '+d9.err);
else if(!d9.habia) mal('el cuadro no llego a abrirse');
else if(!d9.cerrado) mal('Enter NO cierra el cuadro con otro div al final de body → los dialogos quedan sordos');
else bien('Enter responde (y devolvio '+d9.resp+') pese al div de mas abajo');

/* 10 · `_arTime` avanza durante un export de DOMO por FFmpeg — el camino que no pasa por renderExportFrame.
   Se muestrea DENTRO del bucle, por `job.frame`, que la rama llama justo después de componer cada fotograma.
   Leerlo al terminar no vale: `_exportCleanup` llama a `scrubRender()`, que repinta y deja `_arTime` en el
   cabezal — la primera versión de esta comprobación daba un falso fallo por eso. */
console.log('\n── 10 · el reloj de los FX reactivos avanza en domo por FFmpeg ──');
const a10 = await ev(`(async()=>{ try{
  await newProject('dome',512,512,30,180,true); if(typeof hideLanding==='function')hideLanding();
  _demoAddShape('rect','#40C0FF',0,0,1,{az:0,el:90,size:260});
  state.playhead=0;
  const vistos=[], err=[];
  const job={prog:()=>{},frame:()=>{ vistos.push(_arTime); },wrote:()=>{},label:()=>{},warn:()=>{},done:()=>{},fail:e=>err.push(String(e&&e.message||e))};
  await runExport({codec:'ffh264',res:512,outW:512,outH:512,fps:30,range:'clips',rangeT:[0,0.3],
    outDir:${JSON.stringify((process.env.TEMP||'C:/Windows/Temp').replace(/\\/g,'/'))},noAudio:true,silent:true,bitrate:20e6,ffq:{mbps:20,preset:'p3'},job});
  return {vistos, err};
}catch(e){ return {err2:String(e&&e.message||e)}; } })()`);
if(a10.err2) mal('no se pudo evaluar: '+a10.err2);
else if(a10.err&&a10.err.length) mal('el export fallo: '+a10.err.join(' · '));
else{
  const v=a10.vistos||[]; const distintos=new Set(v.map(x=>x.toFixed(4))).size;
  console.log('   _arTime por fotograma: ['+v.slice(0,5).map(x=>x.toFixed(3)).join(', ')+(v.length>5?', …':'')+']  ('+v.length+' fotogramas)');
  if(v.length<2) mal('no se muestrearon fotogramas suficientes');
  else if(distintos<2) mal('_arTime es el MISMO en todos los fotogramas → los FX reactivos salen CONGELADOS en el master de domo');
  else bien('_arTime avanza fotograma a fotograma ('+distintos+' valores distintos): la modulacion reactiva se hornea');
}

console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'las regresiones de R310-R313 quedan cerradas'));
ws.close(); process.exit(fallos?1:0);
