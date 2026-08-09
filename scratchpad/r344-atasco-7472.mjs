/* [R344] Un salto cuesta un reinicio, no una tormenta; el bucle sigue entero; y el atasco 7472 no existe.

   Tres medidas sobre material de GOP LARGO fabricado desde los clips de Rito Movie:

   A) REINICIOS QUE CUESTA UN SALTO. `resetTo` destruye y recrea un VideoDecoder; R259 ya midio que una
      tormenta de reinicios hace que el driver tire el contexto grafico entero. El contraste esta elegido para
      separar la causa de la carga: el destino de 2,1 s decodifica POCOS fotogramas y el de 1,9 s MUCHOS, y el
      numero de fotogramas lo devuelve la propia sonda (antes era una tabla escrita a mano que se seguia
      imprimiendo aunque se rehiciera el material con otros fps).

   B) ATASCO 7472. Salto atras por detras del arranque de decodificacion con un vecino a <=2 fotogramas en
      cache: la rama de reinicio (`step()`) no dispararia porque encuentra ese vecino, y el antiatasco de R256
      tampoco porque exige que el destino sea mas viejo que TODA la cache. Se mapea la cache de verdad y se
      busca si existe algun destino que cumpla las dos condiciones. Si no existe ninguno, se dice.

   C) CASO GEMELO: EL BUCLE. R256/R260 nacieron ahi. Se comprueba que sigue entregando todos los fotogramas
      Y QUE SON LOS CORRECTOS -- contar fotogramas entregados no vale: `frameNear` repliega al vecino, asi que
      un bucle que devuelva el fotograma equivocado en cada vuelta puntuaria perfecto. Se compara el
      `timestamp` del fotograma contra el que `keyForTime` manda entregar.

   Dos trampas del arnes que costaron una conclusion falsa cada una, y como se evitan aqui:
     · `passed()` toma MICROSEGUNDOS. Pasarle segundos devuelve `false` educadamente y el mapa sale vacio.
     · el mapa NO se consulta con el pts REDONDEADO: `keyForTime` compara `Math.floor(t)` contra el `ptsExact`
       SIN redondear (por diseno, R189), asi que para un tercio de los fotogramas la consulta caeria en el
       anterior. Se consulta con `Math.ceil(ptsExact)`, que es el menor instante que mapea a ese fotograma.
     · y el mapa se contrasta SIEMPRE con `stats().cache` -- tambien en el barrido, que es el que sostiene la
       conclusion negativa. `passed()` devuelve true para cualquier instante al final del archivo
       (`feed>=N && vaciado`), asi que un mapa degenerado y un cero genuino se imprimirian igual.

   Uso:  npx electron . --remote-debugging-port=9222   y luego   node scratchpad/r344-atasco-7472.mjs
   Codigos de salida: 0 correcto · 1 fallo · 3 no medida (falta el material)
*/
import http from 'http';
import { existsSync } from 'fs';

const M='C:/Users/beltr/Desktop/Alma Digital Studio/Projects/Immersive Studio Pro/scratchpad/media/';
const CLIP=M+'gop120-60fps.mp4';
if(!existsSync(CLIP)){
  console.log('   NO MEDIDA: falta '+CLIP);
  console.log('   Se rehace con:  node scratchpad/r344-material.mjs');
  process.exit(3); }

const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&/index\.html/.test(x.url));
if(!pg){ console.log('*** la app no esta escuchando en 9222'); process.exit(1); }
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0; const p=new Map(); ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise(r=>{const i=++id;p.set(i,m=>r(m.result&&m.result.exceptionDetails?('EXC '+(m.result.exceptionDetails.exception?.description||'').slice(0,300)):(m.result&&m.result.result&&m.result.result.value)));ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true,timeout:150000}}));});

/* --- dentro de la app. Sin acentos ni backticks. --- */
const PAGINA=`(async()=>{ const vivos=[]; try{
  const RUTA=${JSON.stringify(CLIP)};
  const nuevo=async()=>{ const d=await demuxMP4(RUTA); const cd=makeClipDecoder(d,true); vivos.push(cd); return {d,cd}; };

  // el bucle EXACTO del export (seekCDExport): setTimeout(tick,0) llamando a pump() en cada vuelta
  const buscaComoExport=(cd,t)=>{ const tus=t*1e6; cd.setTarget(tus); const t0=performance.now();
    return new Promise(res=>{ const tick=()=>{ try{ cd.pump(); }catch(e){}
      if(cd.isDead()){ res({ms:performance.now()-t0, ok:false, ts:null, motivo:'el decodificador murio'}); return; }
      if(cd.passed(tus)){ const f=cd.frameNear(tus); res({ms:performance.now()-t0, ok:!!f, ts:f?f.timestamp:null}); return; }
      if(performance.now()-t0>10000){ res({ms:performance.now()-t0, ok:false, ts:null, motivo:'10 s sin fotograma: es lo que marca _cdFail'}); return; }
      setTimeout(tick,0); }; tick(); }); };

  // ---------- indices del archivo, replicando lo que hace makeClipDecoder ----------
  const base=await demuxMP4(RUTA);
  const N=base.samples.length, fps=base.fps||60;
  const order=Array.from({length:N},(_,i)=>i).sort((a,b)=>base.samples[a].pts-base.samples[b].pts);
  const dispPts=order.map(i=>base.samples[i].pts);
  const dispX=order.map(i=>base.samples[i].ptsExact);
  const decIdxForTime=(us)=>{ let lo=0,hi=N-1,res=0; while(lo<=hi){const m=(lo+hi)>>1; if(dispPts[m]<=us){res=m;lo=m+1;}else hi=m-1;} return order[res]; };
  const keyBefore=(di)=>{ for(let i=di;i>=0;i--) if(base.samples[i].key) return i; return 0; };
  // replica FIEL de keyForTime (app.js): trunca el instante y lo compara con el ptsExact SIN redondear
  const claveParaTiempo=(t0)=>{ const tt=Math.floor(Math.max(0,t0)); let lo=0,hi=N-1,res=0;
    while(lo<=hi){ const m=(lo+hi)>>1; if(dispX[m]<=tt){res=m;lo=m+1;} else hi=m-1; } return dispPts[res]; };
  const instanteDe=(k)=>Math.ceil(dispX[k]);      // menor instante que mapea al fotograma k
  const aDecodificar=(t)=>{ const di=decIdxForTime(t*1e6); return di-keyBefore(di)+1; };

  // ---------- A) reinicios por salto ----------
  // Se cuentan los que CUESTA EL SALTO: el keeper arranca solo al nacer y ya gasta uno para empezar en 0.
  const A=[];
  for(const t of [0.5,1.9,2.1,7.5]){
    const {cd}=await nuevo();
    await new Promise(r=>setTimeout(r,120));           // que el keeper haga su arranque, fuera de la medida
    const r0=cd.stats().resets;
    const r=await buscaComoExport(cd,t);
    const s=cd.stats();
    A.push({t:t, dec:aDecodificar(t), ms:+r.ms.toFixed(1), ok:r.ok, motivo:r.motivo||'',
            reinicios:s.resets-r0, cache:s.cache, err:s.err||''});
    cd.close(); vivos.pop();
  }

  // ---------- B) atasco 7472 ----------
  const {cd}=await nuevo();
  const frameDurUs=cd.frameDurUs;
  const analiza=async(T)=>{
    await buscaComoExport(cd,T);
    const enCache=[]; for(let k=0;k<N;k++) if(cd.passed(instanteDe(k))) enCache.push(dispPts[k]);
    const fiable=(enCache.length===cd.stats().cache);   // si no cuadra, la medida NO vale y hay que decirlo
    const fb=base.samples[keyBefore(decIdxForTime(T*1e6))].pts;
    let huecos=0; for(let k=1;k<enCache.length;k++) if(Math.round((enCache[k]-enCache[k-1])/frameDurUs)>1) huecos++;
    const sc=new Set(enCache); const cand=[];
    for(let k=0;k<N;k++){ const T0=dispPts[k];
      if(!(T0 < T*1e6 - frameDurUs)) continue;          // tiene que ser salto ATRAS
      if(!(T0 < fb - frameDurUs)) continue;             // ...por detras del arranque de decodificacion
      if(sc.has(T0)) continue;                          // si el exacto esta cacheado no hay atasco
      for(const ts of enCache){ if(ts<=T0 && ts>=T0-2*frameDurUs){ cand.push({T0:T0, vecino:ts}); break; } } }
    return {T:T, fiable:fiable, cache:enCache.length, nStats:cd.stats().cache, feedBase:+(fb/1e6).toFixed(4),
            masViejo:enCache.length?+(enCache[0]/1e6).toFixed(4):null,
            masNuevo:enCache.length?+(enCache[enCache.length-1]/1e6).toFixed(4):null,
            huecos:huecos, cand:cand.length, primero:cand[0]||null}; };
  const B=[]; for(const T of [5.0,2.5,3.3,6.2,7.7,9.0]) B.push(await analiza(T));
  // si hay algun candidato, se conduce de verdad y se mide cuanto se cuelga
  let vivido=null; const conCand=B.find(x=>x.primero);
  if(conCand){ const r=await buscaComoExport(cd,conCand.primero.T0/1e6);
    vivido={T0:+(conCand.primero.T0/1e6).toFixed(4), vecino:+(conCand.primero.vecino/1e6).toFixed(4),
            ms:+r.ms.toFixed(1), ok:r.ok, motivo:r.motivo||''}; }
  cd.close(); vivos.pop();

  // ---------- C) caso gemelo: el BUCLE ----------
  const {cd:cd2}=await nuevo();
  const A0=3.0, A1=4.0, vueltas=5, porVuelta=Math.round((A1-A0)*fps);
  let pedidos=0, sinEntregar=0, equivocados=0, peor=0;
  for(let v=0; v<vueltas; v++){
    for(let i=0;i<porVuelta;i++){
      const t=A0+i/fps;                                  // indice entero: sin acumular error de coma flotante
      const r=await buscaComoExport(cd2,t); pedidos++;
      if(!r.ok) sinEntregar++;
      else if(r.ts!==claveParaTiempo(t*1e6)) equivocados++;   // ENTREGADO != el que toca -> el fallo silencioso de R194
      if(r.ms>peor) peor=r.ms; } }
  const s2=cd2.stats();
  const C={pedidos:pedidos, sinEntregar:sinEntregar, equivocados:equivocados, peor:+peor.toFixed(1),
           reinicios:s2.resets, muerto:s2.dead, err:s2.err||''};
  cd2.close(); vivos.pop();
  try{ base.close(); }catch(e){}

  return JSON.stringify({fps:+fps.toFixed(2), N:N, A:A, B:B, vivido:vivido, C:C});
}catch(e){ return 'ERR '+String((e&&e.message)||e).slice(0,300);
} finally { for(const c of vivos){ try{ c.close(); }catch(e){} } } })()`;

const r=await ev(PAGINA);
let o=null; try{ o=JSON.parse(r); }catch(e){ console.log('*** sonda rota -> '+String(r).slice(0,300)); ws.close(); process.exit(1); }

const malas=[];
console.log('');
console.log('R344 - ClipDecoder sobre GOP largo ('+o.N+' fotogramas a '+o.fps+' fps, clave cada 2 s)');
console.log('');
console.log('A) REINICIOS QUE CUESTA EL SALTO  (0 si basta seguir hacia delante, 1 si hay que cambiar de clave)');
console.log('   destino   fotogr. a decodificar   ms      reinicios   cache');
for(const a of o.A){
  console.log('   '+String(a.t).padStart(5)+' s   '+String(a.dec).padStart(8)+'              '+String(a.ms).padStart(7)+'   '+String(a.reinicios).padStart(6)+'      '+a.cache+(a.ok?'':('   *** '+(a.motivo||'sin fotograma'))));
  if(!a.ok) malas.push('el salto a '+a.t+' s no entrega fotograma: '+(a.motivo||'?'));
  if(a.reinicios>1) malas.push('el salto a '+a.t+' s recrea el VideoDecoder '+a.reinicios+' veces (1 basta): tormenta de reinicios');
}
const bajo=o.A.find(x=>x.t===1.9), alto=o.A.find(x=>x.t===2.1);
if(bajo&&alto) console.log('   -> el de 2,1 s decodifica '+alto.dec+' fotogramas y cuesta '+alto.reinicios+' reinicios;\n      el de 1,9 s decodifica '+bajo.dec+' y cuesta '+bajo.reinicios+'. La carga y los reinicios no van juntos.');
console.log('');
console.log('B) ATASCO 7472  (salto atras con vecino a <=2 fotogramas en cache)');
console.log('   asentado   cache   huecos   arranque   de        a         candidatos');
let totalCand=0;
for(const b of o.B){
  totalCand+=b.cand;
  console.log('   '+String(b.T).padStart(6)+' s  '+String(b.cache).padStart(5)+'   '+String(b.huecos).padStart(6)+'   '+String(b.feedBase).padStart(7)+' s  '+String(b.masViejo).padStart(7)+'  '+String(b.masNuevo).padStart(7)+'   '+b.cand+(b.fiable?'':'   *** MAPA NO FIABLE'));
  if(!b.fiable) malas.push('en '+b.T+' s el mapa de la cache ('+b.cache+') no cuadra con stats() ('+b.nStats+'): la medida de B no vale');
  if(b.huecos>0) malas.push('en '+b.T+' s la cache tiene '+b.huecos+' hueco(s): la inferencia de contigüidad no se sostiene y el atasco SI seria alcanzable');
}
if(o.vivido){
  console.log('   conducido a '+o.vivido.T0+' s (vecino en '+o.vivido.vecino+' s): '+o.vivido.ms+' ms  '+(o.vivido.ok?'entrega fotograma':'*** '+o.vivido.motivo));
  if(!o.vivido.ok) malas.push('ATASCO 7472 REPRODUCIDO: destino '+o.vivido.T0+' s, '+o.vivido.ms+' ms sin fotograma -> _cdFail');
} else if(!totalCand && o.B.every(b=>b.fiable&&b.huecos===0)){
  console.log('   -> 0 candidatos en los '+o.B.length+' puntos, con la cache CONTIGUA y siempre por encima del arranque');
  console.log('      de decodificacion: un vecino a <=2 fotogramas implica que el exacto tambien esta cacheado, asi');
  console.log('      que el atasco 7472 no es alcanzable con material de GOP CERRADO (que es el que producimos).');
}
console.log('');
console.log('C) CASO GEMELO: BUCLE de 1 s x 5 vueltas (lo que hace un clip en bucle en el export)');
console.log('   '+o.C.pedidos+' pedidos, '+o.C.sinEntregar+' sin entregar, '+o.C.equivocados+' EQUIVOCADOS, peor espera '+o.C.peor+' ms, '+o.C.reinicios+' reinicios'+(o.C.muerto?' *** DECODIFICADOR MUERTO':''));
if(o.C.sinEntregar) malas.push('el bucle deja '+o.C.sinEntregar+' fotograma(s) sin entregar: el camino de R256/R260 esta roto');
if(o.C.equivocados) malas.push('el bucle entrega '+o.C.equivocados+' fotograma(s) EQUIVOCADO(s): es el fallo silencioso que R194 existe para impedir');
if(o.C.muerto) malas.push('el bucle mata el decodificador'+(o.C.err?' ('+o.C.err+')':''));
if(o.C.peor>10000) malas.push('el bucle llega a '+o.C.peor+' ms en un fotograma: es el limite que marca _cdFail');
console.log('');
for(const m of malas) console.log('   *** '+m);
console.log(malas.length?('*** '+malas.length+' FALLOS'):'sin fallos');
ws.close(); process.exitCode = malas.length?1:0;
