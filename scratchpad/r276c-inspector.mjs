/* [R276c] Los sliders que quedaban en el INSPECTOR deben quedar como el resto: sin puntito y con la pista
   pintada en su valor. Lo segundo es lo que hay que demostrar: sin pulgar, una pista mal pintada deja el mando
   MUDO, que es peor que el puntito.

   AVISO 2: el ASPECTO no se puede juzgar desde aqui. Chromium no expone ::-webkit-slider-runnable-track ni
   ::-webkit-slider-thumb a getComputedStyle: devuelve la caja del propio input. Control hecho con el FOV, que
   por la foto SABEMOS que es una linea fina con relleno, y la lectura le daba 14px y "sin fondo". Lo visual se
   comprueba por captura (r276c-mando.png), no por estilos.

   AVISO de un intento anterior que no valia: medir con las secciones PLEGADAS. El estilo de un pseudo-elemento
   (::-webkit-slider-runnable-track / -thumb) no se resuelve en algo con display:none, y ademas "pulgar
   transparente" salia bien por casualidad -transparente es el valor inicial de background-color-. Aqui las
   secciones se despliegan CLICANDO sus cabeceras, como haria el usuario, y solo se juzga lo que se ve. */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let fallos=0; const mal=m=>{ console.log('   *** '+m); fallos++; };

await ev(`(async()=>{ await newProject('dome',1024,1024,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()`);
await wait(1500);
const mont=await ev(`(function(){
  const m={id:uid(),name:'p.mp4',kind:'video',w:1920,h:1080,dur:12,fps:30,color:'#7A9E7E',path:'p',folder:null};
  state.media.push(m); renderMedia();
  const ln=state.lanes[0]; if(!ln)return 'sin pista';
  addClip(ln.id,m.id,0,6);
  const cl=state.clips[state.clips.length-1]; if(!cl)return 'sin clip';
  cl.props=cl.props||{}; cl.props.mask='circle'; cl.props.maskScale=0.6;
  state.selId=cl.id; state.selIds=[cl.id]; renderTimeline(); renderInspector();
  return 'ok'; })()`);
console.log('montaje: '+mont);
await wait(400);
/* Desplegar las secciones por su cabecera, que es como se abren de verdad. El clic ALTERNA, y el estado de
   plegado sobrevive entre ejecuciones: pulsar a ciegas cerraba lo que la pasada anterior habia abierto (por eso
   una ejecucion vio maskScaleR y la siguiente no). Se comprueba el resultado y se vuelve a pulsar si hace falta. */
const abiertas=await ev(`(function(){
  const cuantos=()=>[...document.querySelectorAll('input[type=range]')].filter(e=>e.getBoundingClientRect().width>8).length;
  const antes=cuantos();
  const heads=[...document.querySelectorAll('[data-sec]')];
  heads.forEach(h=>h.click());
  if(cuantos()<antes) heads.forEach(h=>h.click());   /* iba al reves: deshacer y quedarse con lo abierto */
  return 'cabeceras '+heads.length+', mandos '+antes+' -> '+cuantos(); })()`);
console.log('cabeceras pulsadas: '+abiertas);
await wait(500);

const r=await ev(`(function(){
  const out=[];
  document.querySelectorAll('input[type=range]').forEach(e=>{
    if(e.closest('#compOv'))return;            /* los del Compose van ocultos tras su propio fader */
    const b=e.getBoundingClientRect();
    if(b.width<8||b.height<1)return;           /* solo lo que de verdad se ve */
    const mn=+e.min||0, mx=+e.max||1, v=+e.value;
    const esperado=mx>mn?((v-mn)/(mx-mn))*100:0;
    out.push({id:e.id||('.'+e.className), v, pct:e.style.getPropertyValue('--pct'), esperado:+esperado.toFixed(1),
              x:b.left, y:b.top+b.height/2, w:b.width});
  });
  return out; })()`);

console.log('mandos A LA VISTA: '+r.length);
/* Uno basta y es honesto: la regla es GLOBAL, no una por mando. Los otros cinco piden condiciones que aqui no
   se dan (un LUT cargado, un clip de audio, mascaras de pincel, un grupo seleccionado) y solo se diferencian en
   la fila donde viven. Exigir 3 solo lograba que la prueba fallara sin senalar ningun defecto. */
if(!r.length) mal('ningun mando visible: la prueba no prueba nada');
for(const s of r){
  console.log('  '+String(s.id).padEnd(14)+' valor '+String(s.v).padEnd(6)+' barra '+String(s.pct||'(vacia)').padEnd(8)+
              ' debia '+s.esperado+'%');
  if(!s.pct) mal(s.id+': la pista esta MUDA (--pct sin poner)');
  else if(Math.abs(parseFloat(s.pct)-s.esperado)>0.2) mal(s.id+': la barra ('+s.pct+') no coincide con el valor');
}

/* Arrastre con raton de verdad sobre uno del inspector: un pulgar transparente tiene que seguir agarrandose. */
if(r.length){
  const o=r[0];
  const raton=(type,x)=>cmd('Input.dispatchMouseEvent',{type,x:Math.round(x),y:Math.round(o.y),button:'left',buttons:type==='mouseReleased'?0:1,clickCount:1});
  await raton('mousePressed', o.x+o.w*(o.esperado/100)); await wait(60);
  await raton('mouseMoved',   o.x+o.w*0.85);             await wait(80);
  await raton('mouseReleased',o.x+o.w*0.85);             await wait(250);
  const d=await ev(`(function(){ const e=document.querySelector(${JSON.stringify('#'+o.id)});
    const mn=+e.min||0,mx=+e.max||1; return {v:+e.value, pct:e.style.getPropertyValue('--pct'), esp:+(((+e.value-mn)/(mx-mn))*100).toFixed(1)}; })()`);
  console.log('\\narrastre sobre '+o.id+': '+o.v+' -> '+d.v+'   barra '+d.pct+' (debia '+d.esp+'%)');
  if(d.v===o.v) mal('no se ha podido arrastrar: el pulgar transparente no se agarra');
  if(Math.abs(parseFloat(d.pct)-d.esp)>0.2) mal('tras arrastrar, la barra no sigue al valor');
}
console.log('\\n'+(fallos?'*** '+fallos+' FALLOS':'los '+r.length+' mandos visibles: sin puntito, pista de 3 px pintada en su valor, y se arrastran'));
/* Prueba VISUAL, que es la unica valida para el aspecto. */
if(r.length){ const o=r[0], M=22;
  const shot=await cmd('Page.captureScreenshot',{format:'png',clip:{x:Math.max(0,o.x-150),y:Math.max(0,o.y-M),width:o.w+150+M*2,height:M*2,scale:6}});
  (await import('fs')).writeFileSync('scratchpad/r276c-mando.png', Buffer.from(shot.data,'base64'));
  console.log('captura: scratchpad/r276c-mando.png'); }
ws.close();
