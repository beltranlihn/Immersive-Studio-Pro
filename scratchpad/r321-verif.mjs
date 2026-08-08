/* [R321] LA RED DE LOS GESTOS DEL TIMELINE — la familia «el gesto mueve una mitad y deja la otra».
   Los seis MEDIA de §9 «Gestos del timeline» que seguían abiertos, más el gemelo que apareció al barrer.
   La regla que comprueban, dicha en una línea:
     **un gesto que mueve un clip mueve su mitad enlazada, y un gesto de grupo conserva los desfases.**

     1 · el ripple corría los clips de la pista y dejaba sus mitades de audio donde estaban
     2 · `rippleDelete` borraba media pareja y cerraba el hueco en una sola pista
     3 · el slide no acotaba el crecimiento del vecino IZQUIERDO a su fuente → fotograma congelado
     4 · el clamp del tirador izquierdo no dividía `inP` por la velocidad → a 0,5× no se recuperaba material
     5 · soltar dos clips a la vez: el segundo no cortaba el resto que creó el primero
     6 · el move multi-selección recortaba clip a clip contra 0 → desfases destruidos
     7 · el rebase del crossfade no sintetizaba el keyframe de frontera

   Uso:  npx electron . --remote-debugging-port=9222   y luego   node scratchpad/r321-verif.mjs
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

/* Dos pares A/V sobre una fuente de video sintetica de 30 s: el par 1 en 2..6, el par 2 en 8..12.
   Los pares se enlazan con `link`, que es lo que lee `linkPartner`. */
const MONTA=`
  await newProject('flat',1920,1080,30,180,true); if(typeof hideLanding==='function')hideLanding();
  const LV=state.lanes.findIndex(l=>l.kind!=='audio'), LA=state.lanes.findIndex(l=>l.kind==='audio');
  const MV={id:960001,kind:'video',name:'v',dur:30,w:1920,h:1080,fps:30,color:'#888'};
  const MA={id:960002,kind:'audio',name:'a',dur:30,fps:0,color:'#888'};
  state.media.push(MV,MA);
  const mk=(id,lane,mid,st,du,inP,link,rol)=>{ const c={id,lane,mediaId:mid,start:st,dur:du,inP,speed:1,link,avRole:rol,props:{}}; state.clips.push(c); return c; };
  const V1=mk(960101,LV,MV.id,2,4,0,'L1','video'), A1=mk(960102,LA,MA.id,2,4,0,'L1','audio');
  const V2=mk(960103,LV,MV.id,8,4,0,'L2','video'), A2=mk(960104,LA,MA.id,8,4,0,'L2','audio');
`;

/* ── 1 ── El ripple arrastra tambien las mitades enlazadas de los clips de aguas abajo. */
console.log('\n── 1 · el ripple no desfasa los pares de aguas abajo ──');
const e1 = await ev(`(async()=>{ try{
  ${MONTA}
  const base={start:V1.start,dur:V1.dur,inP:0,linkBase:{start:A1.start,dur:A1.dur,inP:0},after:_rippleAfter(V1,'rippleR')};
  const d=applyTrim({kind:'rippleR',c:V1}, 2, base);      // crecer 2 s: todo lo posterior se corre 2 s
  return {d, v2:+V2.start.toFixed(3), a2:+A2.start.toFixed(3), a1:+A1.start.toFixed(3), enAfter:base.after.size};
}catch(e){ return {err:String(e&&e.message||e)}; } })()`);
if(e1.err) mal('no se pudo evaluar: '+e1.err);
else{
  console.log('   d='+e1.d+'  ·  par 2: video en '+e1.v2+' / audio en '+e1.a2+'  ·  entradas en `after`: '+e1.enAfter);
  if(!e1.d) mal('el ripple no movio nada: la prueba no mide nada');
  else if(e1.v2===8) mal('el clip de aguas abajo no se movio: el ripple no arrastro nada');
  else if(e1.v2!==e1.a2) mal('el par de aguas abajo quedo DESFASADO: video en '+e1.v2+' y audio en '+e1.a2);
  else bien('el par de aguas abajo se mueve entero ('+e1.v2+')');
}

/* ── 2 ── `rippleDelete` se lleva la pareja entera y cierra el hueco en las dos pistas. */
console.log('\n── 2 · la eliminacion con arrastre no deja media pareja ni desfasa ──');
const e2 = await ev(`(async()=>{ try{
  ${MONTA}
  state.selId=V1.id; state.selIds=[V1.id];
  rippleDelete();
  const vivos=state.clips.map(c=>c.id);
  return {quedaA1:vivos.includes(960102), quedanV2A2:vivos.includes(960103)&&vivos.includes(960104),
          v2:+(state.clips.find(c=>c.id===960103)||{start:-1}).start.toFixed(3),
          a2:+(state.clips.find(c=>c.id===960104)||{start:-1}).start.toFixed(3), n:vivos.length};
}catch(e){ return {err:String(e&&e.message||e)}; } })()`);
if(e2.err) mal('no se pudo evaluar: '+e2.err);
else{
  console.log('   quedan '+e2.n+' clips  ·  par 2: video en '+e2.v2+' / audio en '+e2.a2+'  ·  media pareja huerfana: '+(e2.quedaA1?'SI':'no'));
  if(e2.quedaA1) mal('la mitad de audio del clip borrado sobrevivio, con su `link` colgando');
  else if(!e2.quedanV2A2) mal('se borro de mas: el par 2 no deberia tocarse');
  else if(e2.v2!==e2.a2) mal('el par de aguas abajo quedo DESFASADO: video en '+e2.v2+' y audio en '+e2.a2);
  else if(e2.v2!==4) mal('el hueco no se cerro bien (video en '+e2.v2+', se esperaba 4)');
  else bien('se lleva la pareja entera y cierra el hueco en las dos pistas ('+e2.v2+')');
}

/* ── 2b ── [R323] Y el ALCANCE: un ripple es de su pista (mas las mitades enlazadas de lo que arrastra), nunca
   de todo el proyecto. R322 reescribio `rippleDelete` con un modelo de bloque y se dejo el filtro de pista: medido,
   borrar un clip de video movia clips sin relacion de la pista de audio y de una tercera pista. */
console.log('\n── 2b · la eliminacion con arrastre no toca pistas ajenas ──');
const e2b = await ev(`(async()=>{ try{
  ${MONTA}
  const otraV=state.lanes.findIndex((l,i)=>l.kind!=='audio'&&i!==LV);
  /* En la pista del PARTNER tambien hay un hueco, asi que lo de despues SI debe correrse aunque no este
     enlazado — el primer intento de esta sonda lo daba por fallo, y el equivocado era el intento. */
  mk(960301,LA,MA.id,20,4,null,null);                                   // pista del partner: DEBE moverse
  if(otraV>=0)mk(960302,otraV,MV.id,24,4,null,null);                    // pista AJENA: no debe moverse
  state.selId=V1.id; state.selIds=[V1.id]; rippleDelete();
  const g=i=>{const c=state.clips.find(x=>x.id===i);return c?+c.start.toFixed(2):null;};
  return {enPistaDelPartner:g(960301), ajeno:g(960302), hayOtraV:otraV>=0, v2:g(960103)};
}catch(e){ return {err:String(e&&e.message||e)}; } })()`);
if(e2b.err) mal('no se pudo evaluar: '+e2b.err);
else{
  console.log('   par 2 en '+e2b.v2+'  ·  pista del partner: 20 → '+e2b.enPistaDelPartner+'  ·  pista ajena: 24 → '+e2b.ajeno);
  if(e2b.v2===8) mal('no movio ni su propia pista: la prueba no mide nada');
  else if(e2b.enPistaDelPartner===20) mal('no cerro el hueco en la pista del partner: ahi tambien se borro material');
  else if(e2b.hayOtraV&&e2b.ajeno!==24) mal('movio un clip de una pista AJENA (24 -> '+e2b.ajeno+'): un ripple es de su pista, no de todo el proyecto');
  else bien('cierra el hueco en las dos pistas de la pareja y deja las ajenas donde estaban');
}

/* ── 2c ── [R324] Y el TOPE: el suelo va por clip, no recortando el desplazamiento comun. R323 acotaba el
   desplazamiento por el clip mas a la izquierda de TODOS los que mueve, asi que uno suelto cerca del origen
   colapsaba el gesto entero: medido, borrar un video de 10 s cerraba 1 s y dejaba un hueco de 11. */
console.log('\n── 2c · un clip suelto cerca del origen no colapsa el gesto ──');
const e2c = await ev(`(async()=>{ try{ ${MONTA}
  state.clips.length=0;                                                  // monta propio, mas claro
  mk(960401,LV,MV.id,0,10,'J','video'); mk(960402,LA,MA.id,0,0.5,'J','audio');  // J-cut con colita de audio de 0,5 s
  mk(960403,LA,MA.id,1,2,null,null);                                     // suelto, cerca del origen
  mk(960404,LV,MV.id,12,4,null,null);                                    // lo que debe cerrar el hueco de 10 s
  state.selId=960401; state.selIds=[960401]; rippleDelete();
  const g=i=>{const c=state.clips.find(x=>x.id===i);return c?+c.start.toFixed(2):null;};
  return {desplazamiento:+(12-g(960404)).toFixed(2), bloque:10, suelto:g(960403), negativos:state.clips.filter(x=>x.start<0).length};
}catch(e){ return {err:String(e&&e.message||e)}; } })()`);
if(e2c.err) mal('no se pudo evaluar: '+e2c.err);
else{
  console.log('   bloque de '+e2c.bloque+' s → se desplaza '+e2c.desplazamiento+' s  ·  el suelto queda en '+e2c.suelto+'  ·  negativos: '+e2c.negativos);
  if(e2c.negativos) mal('algun clip quedo en start negativo: el motor no sabe dibujarlo');
  else if(e2c.desplazamiento<e2c.bloque-0.01) mal('el gesto se colapso: cerro '+e2c.desplazamiento+' s de los '+e2c.bloque+' del bloque, dejando el hueco casi entero');
  else bien('el bloque se cierra entero y el clip suelto se recorta contra 0 por su cuenta');
}

/* ── 3 ── El slide no deja crecer al vecino izquierdo mas alla de su fuente. */
console.log('\n── 3 · el slide acota el crecimiento del vecino izquierdo a su fuente ──');
const e3 = await ev(`(async()=>{ try{
  ${MONTA}
  /* P pegado a V2 por la izquierda y ya al final de su material: no le queda nada que revelar. */
  const P={id:960201,lane:LV,mediaId:MV.id,start:4,dur:4,inP:26,speed:1,props:{}};   // inP 26 + dur 4 = 30 = fin de la fuente
  const N={id:960202,lane:LV,mediaId:MV.id,start:12,dur:4,inP:0,speed:1,props:{}};
  state.clips.push(P,N); V2.start=8;
  const base={start:V2.start,dur:V2.dur,inP:0,linkBase:null,pDur:P.dur,pInP:P.inP,nStart:N.start,nDur:N.dur,nInP:N.inP};
  const d=applyTrim({kind:'slide',c:V2,prev:P,next:N}, 3, base);   // pedir +3 s: P no tiene material para crecer
  const agotado={d, pDur:+P.dur.toFixed(3), sobra:+(30-(P.inP+P.dur)).toFixed(3)};
  /* CONTROL POSITIVO: el mismo gesto con material de sobra TIENE que moverse. Sin esto, un slide que no se
     mueve NUNCA pasaria la prueba de arriba, que es el falso aprobado clasico de una guarda nueva. */
  P.inP=0; P.dur=4; P.start=4; V2.start=8; N.start=12; N.dur=4; N.inP=0;
  const base2={start:V2.start,dur:V2.dur,inP:0,linkBase:null,pDur:P.dur,pInP:P.inP,nStart:N.start,nDur:N.dur,nInP:N.inP};
  const d2=applyTrim({kind:'slide',c:V2,prev:P,next:N}, 3, base2);
  return {...agotado, holgado:{d:d2, pDur:+P.dur.toFixed(3)}};
}catch(e){ return {err:String(e&&e.message||e)}; } })()`);
if(e3.err) mal('no se pudo evaluar: '+e3.err);
else{
  console.log('   sin material: d='+e3.d+', P.dur='+e3.pDur+', sobrante='+e3.sobra+' s  ·  con material: d='+e3.holgado.d+', P.dur='+e3.holgado.pDur);
  if(e3.sobra<-1e-6) mal('P crecio '+(-e3.sobra)+' s mas alla de su fuente: ese tramo sale como fotograma congelado');
  else if(e3.d>0.001) mal('el slide se movio '+e3.d+' s cuando P no tenia material: deberia haberse quedado en 0');
  else if(e3.holgado.d<2.999) mal('el control positivo falla: con material de sobra el slide solo movio '+e3.holgado.d+' s de los 3 pedidos — la guarda nueva acota de mas');
  else bien('se para donde se acaba el material de P, y con material de sobra se mueve los 3 s pedidos');
}

/* ── 4 ── El clamp del tirador izquierdo cuenta el material en segundos de LINEA DE TIEMPO. */
console.log('\n── 4 · a media velocidad se puede recuperar todo el material que hay detras ──');
const e4 = await ev(`(async()=>{ try{
  const bruto=await (await fetch('app.js')).text();
  const t=bruto.replace(/\\/\\*[\\s\\S]*?\\*\\//g,' ').replace(/\\/\\/[^\\n]*/g,' ');
  return { ok:/const minS=srcLim\\?Math\\.max\\(0,drag\\.start0-drag\\.inP0\\/\\(c\\.speed\\|\\|1\\)\\):0/.test(t) };
}catch(e){ return {err:String(e&&e.message||e)}; } })()`);
if(e4.err) mal('no se pudo leer el fuente: '+e4.err);
else if(!e4.ok) mal('el clamp del arrastre sigue sin dividir `inP0` por la velocidad');
else bien('el clamp divide por la velocidad, como ya hacia el de trimItem');

/* ── 5 ── Soltar dos clips a la vez sobre el mismo vecino: no sobrevive ningun solape. */
console.log('\n── 5 · dos clips soltados a la vez no dejan solape sin cortar ──');
const e5 = await ev(`(async()=>{ try{
  await newProject('flat',1920,1080,30,180,true); if(typeof hideLanding==='function')hideLanding();
  const LV=state.lanes.findIndex(l=>l.kind!=='audio');
  const M={id:960301,kind:'video',name:'v',dur:60,w:1920,h:1080,fps:30,color:'#888'}; state.media.push(M);
  const mk=(id,st,du)=>{ const c={id,lane:LV,mediaId:M.id,start:st,dur:du,inP:0,speed:1,props:{}}; state.clips.push(c); return c; };
  const quieto=mk(960401,0,20);                       // el que recibe
  const a=mk(960402,4,3), b=mk(960403,12,3);          // dos soltados a la vez, DENTRO del quieto
  cutOverlapsOnDrop([a.id,b.id]);
  /* solape residual entre cualquier par de la pista */
  const cl=state.clips.filter(c=>c.lane===LV).sort((x,y)=>x.start-y.start);
  let peor=0; for(let i=0;i<cl.length-1;i++){ const s=(cl[i].start+cl[i].dur)-cl[i+1].start; if(s>peor)peor=s; }
  return {n:cl.length, peor:+peor.toFixed(3), tramos:cl.map(c=>[+c.start.toFixed(2),+(c.start+c.dur).toFixed(2)])};
}catch(e){ return {err:String(e&&e.message||e)}; } })()`);
if(e5.err) mal('no se pudo evaluar: '+e5.err);
else{
  console.log('   '+e5.n+' clips: '+JSON.stringify(e5.tramos)+'  ·  peor solape residual: '+e5.peor+' s');
  if(e5.peor>0.01) mal('quedo un solape de '+e5.peor+' s sin cortar: el segundo clip no vio el resto que creo el primero');
  else bien('ningun solape sobrevive al gesto');
}

/* ── 6 ── Arrastrar una seleccion mas alla del origen conserva los desfases. */
console.log('\n── 6 · el move multi-seleccion conserva los desfases relativos ──');
const e6 = await ev(`(async()=>{ try{
  await newProject('flat',1920,1080,30,180,true); if(typeof hideLanding==='function')hideLanding();
  const LV=state.lanes.findIndex(l=>l.kind!=='audio');
  const M={id:960501,kind:'video',name:'v',dur:60,w:1920,h:1080,fps:30,color:'#888'}; state.media.push(M);
  const mk=(id,st)=>{ const c={id,lane:LV,mediaId:M.id,start:st,dur:2,inP:0,speed:1,props:{}}; state.clips.push(c); return c; };
  const a=mk(960601,1), b=mk(960602,5), c3=mk(960603,9);
  /* [R322] Se conduce el GESTO REAL: se arma el mismo objeto de arrastre que el pointerdown y se llama a
     onTLMove y onTLUp. El primer intento reproducia la aritmetica del suelo DENTRO de la sonda —minStart0, el
     Math.max, el bucle de aplicacion— asi que comprobaba su propia copia: revirtiendo el arreglo entero en
     app.js, el caso seguia dando el visto bueno. Una sonda que no puede fallar no cubre nada.
     (Y por septima vez: nada de acentos graves aqui dentro, que cierran la plantilla de la sonda.) */
  state.selIds=[a.id,b.id,c3.id]; state.selId=a.id;
  const items=[a,b,c3].map(x=>({id:x.id,start0:x.start,dur0:x.dur,inP0:x.inP,lane0:x.lane,linked:false,kf0:null,anim0:null}));
  drag={id:a.id,mode:'move',x0:0,y0:0,start0:a.start,dur0:a.dur,inP0:a.inP,lane0:a.lane,_undone:false,
        primaryIds:new Set(state.selIds),items};
  const pps=state.tl.pxPerSec;
  onTLMove({clientX:-4*pps, clientY:0, target:null, altKey:false, shiftKey:false});   // pedir 4 s a la izquierda: el primero se saldria del origen
  const aplicado=drag._applied;
  onTLUp();
  const g=i=>{const x=state.clips.find(y=>y.id===i);return x?+x.start.toFixed(3):null;};
  return {aplicado:+aplicado.toFixed(3), starts:[g(960601),g(960602),g(960603)],
          desfases:[g(960602)-g(960601), g(960603)-g(960602)]};
}catch(e){ return {err:String(e&&e.message||e)}; } })()`);
if(e6.err) mal('no se pudo evaluar: '+e6.err);
else{
  console.log('   aplicado='+e6.aplicado+'  ·  starts='+JSON.stringify(e6.starts)+'  ·  desfases='+JSON.stringify(e6.desfases));
  if(e6.desfases[0]!==4||e6.desfases[1]!==4) mal('los desfases se destruyeron: eran 4 y 4, ahora son '+JSON.stringify(e6.desfases));
  else if(e6.starts[0]!==0) mal('el bloque no se paro donde debia (el primero deberia quedar en 0, esta en '+e6.starts[0]+')');
  else bien('el bloque se para en el origen y los desfases se conservan');
}

/* ── 7 ── El rebase del crossfade delega, asi que hereda el keyframe de frontera. */
console.log('\n── 7 · el rebase del crossfade sintetiza el keyframe de frontera ──');
const e7 = await ev(`(async()=>{ try{
  const bruto=await (await fetch('app.js')).text();
  const t=bruto.replace(/\\/\\*[\\s\\S]*?\\*\\//g,' ').replace(/\\/\\/[^\\n]*/g,' ');
  return { delega:/const rebaseKf=cc=>rebaseAutoPorMaterial\\(cc,xf\\.kfBase,xf\\.animBase,cc\\.start-xf\\.startBase\\)/.test(t),
           sinCopia:!/const sh=xf\\.startBase-cc\\.start/.test(t) };
}catch(e){ return {err:String(e&&e.message||e)}; } })()`);
if(e7.err) mal('no se pudo leer el fuente: '+e7.err);
else if(!e7.delega||!e7.sinCopia) mal('el crossfade sigue con su propia copia del rebase, sin keyframe de frontera');
else bien('delega en rebaseAutoPorMaterial: no queda una tercera copia');

/* ── 8 ── Y la estructural de la familia: el ripple arma su conjunto por UN solo camino. */
console.log('\n── 8 · el arrastre y el teclado arman el mismo conjunto ──');
const e8 = await ev(`(async()=>{ try{
  const bruto=await (await fetch('app.js')).text();
  const t=bruto.replace(/\\/\\*[\\s\\S]*?\\*\\//g,' ').replace(/\\/\\/[^\\n]*/g,' ');
  const usos=(t.match(/_rippleAfter\\(/g)||[]).length;
  /* [R322] Anclado con \\b: sin anclar contaba tambien el po.start>=edge-0.002 que R322 anadio DENTRO de la
     funcion (la prueba de posicion del partner), y ponia la red en rojo por un arreglo correcto. */
  const restos=(t.match(/\\bo\\.start>=edge-0\\.002/g)||[]).length;
  return {usos,restos};
}catch(e){ return {err:String(e&&e.message||e)}; } })()`);
if(e8.err) mal('no se pudo leer el fuente: '+e8.err);
else{
  console.log('   llamadas a _rippleAfter: '+e8.usos+'  ·  copias sueltas del filtro: '+e8.restos);
  if(e8.usos<2) mal('solo '+e8.usos+' llamada(s): uno de los dos caminos (arrastre / teclado) sigue con su copia');
  else if(e8.restos) mal('queda '+e8.restos+' copia(s) del filtro fuera de la funcion');
  else bien('los dos caminos pasan por la misma funcion');
}

console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'la familia de gestos del timeline queda cubierta por esta red'));
ws.close(); process.exit(fallos?1:0);
