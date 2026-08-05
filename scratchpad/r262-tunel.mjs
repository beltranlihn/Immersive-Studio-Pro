/* [R262] Fundido del tunel: entrada y salida por separado.
   Tres cosas, todas cortas y sin exportar nada:
     A. COMPATIBILIDAD — un tunel viejo (sin fadeIn/fadeOut) tiene que dar la MISMA opacidad que la formula de
        R246, `100*sin^2(pi*u)`, fotograma a fotograma.
     B. APAGARLO — con las dos cantidades a 0 la opacidad debe ser 100 plana y sin modificador que evaluar.
     C. IDA Y VUELTA POR EL CUADRO — abrir la composicion guardada tiene que MOSTRAR lo guardado, y aplicar sin
        tocar nada no puede cambiarlo (que es justo lo que fallaba). */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise((res,rej)=>{const i=++id;p.set(i,r=>r.error?rej(new Error(JSON.stringify(r.error))):(r.result.exceptionDetails?rej(new Error(r.result.exceptionDetails.exception?.description||r.result.exceptionDetails.text)):res(r.result.result.value)));
  ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true}}));});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let fallos=0; const mal=(m)=>{ console.log('   *** '+m); fallos++; };

/* ---- A y B: la envolvente, sin tocar la interfaz ------------------------------------------- */
const env=await ev(`(function(){
  const gViejo={kind:'tunnel',speed:0.5,sizeFrom:1,sizeTo:200,curve:60};        // sin fadeIn/fadeOut: tunel de R246
  const gApagado={kind:'tunnel',speed:0.5,sizeFrom:1,sizeTo:200,curve:60,fadeIn:0,fadeOut:0};
  const gAsim={kind:'tunnel',speed:0.5,sizeFrom:1,sizeTo:200,curve:60,fadeIn:0.2,fadeOut:0.1};
  const opa=(g)=>{ const c={id:1,start:0,speed:1,props:compElProps(g,{_phase:0,az:0,size:1}),anim:compTunnelAnim(g,0)};
    const o=[]; for(let k=0;k<20;k++){ const u=k/20; o.push(+evalR(c,'opacity',u/g.speed).toFixed(3)); } return o; };
  const teor=[]; for(let k=0;k<20;k++){ const u=k/20; teor.push(+(100*Math.pow(Math.sin(Math.PI*u),2)).toFixed(3)); }
  return { viejo:opa(gViejo), teorico:teor, apagado:opa(gApagado), asim:opa(gAsim),
           modsApagado:compTunnelAnim(gApagado).length, modsViejo:compTunnelAnim(gViejo).length,
           baseApagado:compElProps(gApagado,{_phase:0,az:0,size:1}).opacity,
           baseViejo:compElProps(gViejo,{_phase:0,az:0,size:1}).opacity }; })()`);
console.log('A · un tunel VIEJO contra la formula de R246 (100*sin^2):');
let peor=0; for(let k=0;k<20;k++) peor=Math.max(peor,Math.abs(env.viejo[k]-env.teorico[k]));
console.log('   maxima diferencia en 20 puntos del ciclo: '+peor.toFixed(4)+(peor<0.01?'  → identico':'  *** DISTINTO'));
if(peor>=0.01) mal('el fundido de los tuneles existentes ha cambiado');
console.log('   opacidad base: '+env.baseViejo+' · modificadores: '+env.modsViejo);

console.log('B · fundido APAGADO (entrada 0 y salida 0):');
console.log('   opacidad a lo largo del ciclo: '+env.apagado.slice(0,6).join(' ')+' …  · base '+env.baseApagado+' · modificadores '+env.modsApagado);
if(env.apagado.some(v=>Math.abs(v-100)>0.001)) mal('con el fundido apagado la opacidad no es 100 plana');
if(env.modsApagado!==1) mal('con el fundido apagado deberia quedar SOLO el modificador de tamano (hay '+env.modsApagado+')');

console.log('C · entrada 20% / salida 10% (asimetrico):');
console.log('   ' + env.asim.join(' '));
if(Math.abs(env.asim[0])>0.001) mal('deberia empezar en 0');
if(env.asim[10]<99.9) mal('en mitad del ciclo deberia estar a plena opacidad');
{ const subeHasta=env.asim.findIndex((v,i)=>i>0&&v>=99.9);
  console.log('   llega a 100 en el punto '+subeHasta+'/20 (entrada 20% → toca en el 4)');
  if(subeHasta!==4) mal('la rampa de entrada no dura el 20% del ciclo');
  /* la salida ocupa el ULTIMO 10%: en f=0,90 aun vale 100 y en f=0,95 va por la mitad de la rampa */
  if(env.asim[18]<99.9) mal('en f=0,90 (justo donde empieza la salida) deberia seguir a 100');
  if(!(env.asim[19]<99)) mal('la rampa de salida no baja en el ultimo 10% (f=0,95 da '+env.asim[19]+')'); }

/* ---- D: ida y vuelta por el cuadro de dialogo ---------------------------------------------- */
/* el cuadro necesita al menos un medio en el proyecto: se inventa uno, que para esto basta */
await ev(`(function(){ if(!state.media.some(m=>m.kind==='video')){
    state.media.push({id:uid(),name:'falso.mp4',kind:'video',w:1920,h:1080,dur:10,fps:30,color:'#888',path:'x',folder:null});
    renderMedia(); } return state.media.length; })()`);
await wait(300);
const ida=await ev(`(async function(){
  const mid=state.media.find(m=>m.kind==='video').id;
  const g={id:9,kind:'tunnel',mediaIds:[mid],mediaId:mid,count:6,sizeFrom:12,sizeTo:180,speed:0.35,curve:25,twist:40,
           fadeIn:0.2,fadeOut:0,cols:3,arc:140,el:30,elMin:10,elMax:60,size:40,mask:'none',rand:[],jitter:0};
  openCompose('tunnel',g,null,null,null); await new Promise(r=>setTimeout(r,500));
  if(!document.querySelector('#cTFrom')) return {abierto:false};
  const v=(id)=>{ const e=document.querySelector(id); return e?(e.type==='checkbox'?e.checked:e.value):null; };
  const mostrado={ abierto:true, from:v('#cTFrom'), to:v('#cTTo'), speed:v('#cTSpeed'), curve:v('#cTCurve'), twist:v('#cTTwist'),
                   fiOn:v('#cTFadeIn'), fiA:v('#cTFadeInA'), foOn:v('#cTFadeOut'), foA:v('#cTFadeOutA') };
  try{ if(typeof _cerrarComp==='function')_cerrarComp(); }catch(e){}
  return mostrado; })()`);
if(!ida.abierto) mal('el cuadro de composicion no llego a abrirse');
console.log('D · reabrir la composicion guardada (De→a 12→180, vel 0.35, prof 25, giro 40, entrada 20%, salida apagada):');
console.log('   el cuadro muestra: ' + JSON.stringify(ida));
if(+ida.from!==12||+ida.to!==180) mal('«De → a» no se restaura');
if(+ida.speed!==35) mal('la velocidad no se restaura');
if(+ida.curve!==25) mal('la profundidad no se restaura');
if(+ida.twist!==40) mal('el giro no se restaura');
if(ida.fiOn!==true||+ida.fiA!==20) mal('el fundido de ENTRADA no se restaura');
if(ida.foOn!==false) mal('el fundido de SALIDA apagado no se restaura (esto es el bug que reporto Beltran)');

/* ---- E: APLICAR tiene que guardar lo del cuadro (el fallo de fondo) ------------------------ */
const apl=await ev(`(async function(){
  const mid=state.media.find(m=>m.kind==='video').id;
  const g={id:9,kind:'tunnel',mediaIds:[mid],mediaId:mid,count:6,sizeFrom:1,sizeTo:200,speed:0.12,curve:60,twist:0,
           fadeIn:0.5,fadeOut:0.5,cols:3,arc:140,el:30,elMin:10,elMax:60,size:40,mask:'none',rand:[],jitter:0,clips:[]};
  openCompose('tunnel',g,null,null,null); await new Promise(r=>setTimeout(r,500));
  /* se APAGA la salida y se cambian dos mandos mas, como haria Beltran */
  const q=(s)=>document.querySelector(s);
  q('#cTFadeOut').checked=false; q('#cTFadeInA').value=30; q('#cTTwist').value=77; q('#cTTo').value=150;
  try{ q('#cGo').click(); }catch(e){}
  await new Promise(r=>setTimeout(r,400));
  return { fadeIn:g.fadeIn, fadeOut:g.fadeOut, twist:g.twist, sizeTo:g.sizeTo, id:g.id }; })()`);
console.log('E · aplicar con la SALIDA apagada, entrada 30%, giro 77, hasta 150:');
console.log('   lo guardado: ' + JSON.stringify(apl));
if(apl.fadeOut!==0) mal('la salida apagada NO se guarda (fadeOut='+apl.fadeOut+')');
if(Math.abs(apl.fadeIn-0.3)>0.001) mal('la cantidad de entrada no se guarda');
if(apl.twist!==77) mal('el giro no se guarda');
if(apl.sizeTo!==150) mal('el «hasta» no se guarda');
if(apl.id!==9) mal('el identificador de la composicion se ha perdido');

console.log('\n'+(fallos? '*** '+fallos+' FALLOS':'los cinco puntos, correctos'));
ws.close();
