/* [R344b] La prediccion que la revision de R344 hizo sobre el codigo que R344 NO tocaba.

   La rama de reinicio por salto grande de `step()` compara contra `lastFedPts`:

       else if(lastFedPts!==null && targetUs>lastFedPts+2000000){ resetTo(decIdxForTime(targetUs)); }

   Tras un reinicio se alimenta desde el fotograma clave K, y el bucle de alimentacion se para en cuanto
   `dec.decodeQueueSize` llega a 12 (la cola solo se vacia de forma asincrona, asi que dentro de una vuelta
   sincrona no baja): o sea que una vuelta avanza ~12 fotogramas, y `lastFedPts` queda en K+0,2 s a 60 fps.
   Si el destino esta a MAS de ~2 s de K, la vuelta siguiente vuelve a cumplir la condicion y reinicia otra
   vez -- en el MISMO fotograma clave, porque `decIdxForTime` lleva al mismo sitio. No converge nunca.

   Con GOP de 2 s eso no puede pasar: destino menos K es siempre < 2 s, y por eso la sonda de R344, que solo
   usaba `gop120`, no podia verlo. `gop240` (clave cada 4 s) si puede: los ultimos ~2 s de cada GOP quedarian
   fuera de alcance -> 10 s sin fotograma -> `_cdFail` -> el medio entero cae al camino <video>.

   Esto NO lo introdujo R344 (con el `-1` de R343 pasaba igual en cuanto se alimentaba la primera muestra, y
   antes de R343 tambien). Lo que hace R344 es dejar el area medida, y esta sonda cierra el hueco.

   Uso:  npx electron . --remote-debugging-port=9222   y luego   node scratchpad/r344-gop-mayor-2s.mjs
*/
import http from 'http';
import { existsSync } from 'fs';

const M='C:/Users/beltr/Desktop/Alma Digital Studio/Projects/Immersive Studio Pro/scratchpad/media/';
const CLIPS=[
  {n:'gop240-60fps.mp4 (clave cada 4 s)', p:M+'gop240-60fps.mp4', claves:[0,4,8],
   t:[0.5, 1.9, 2.5, 3.9, 4.5, 7.9]},
  {n:'gop120-60fps.mp4 (clave cada 2 s)', p:M+'gop120-60fps.mp4', claves:[0,2,4,6,8],
   t:[0.5, 1.9, 2.1, 7.5]},
];
const faltan=CLIPS.filter(c=>!existsSync(c.p));
if(faltan.length){
  console.log('   NO MEDIDA: falta '+faltan.map(c=>c.p).join(', '));
  console.log('   Se rehace con:  node scratchpad/r344-material.mjs');
  process.exit(3); }

const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&/index\.html/.test(x.url));
if(!pg){ console.log('*** la app no esta escuchando en 9222'); process.exit(1); }
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0; const p=new Map(); ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise(r=>{const i=++id;p.set(i,m=>r(m.result&&m.result.exceptionDetails?('EXC '+(m.result.exceptionDetails.exception?.description||'').slice(0,300)):(m.result&&m.result.result&&m.result.result.value)));ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true,timeout:150000}}));});

/* --- dentro de la app. Sin acentos ni backticks. --- */
const PAGINA=(ruta,destinos)=>`(async()=>{ const vivos=[]; try{
  const RUTA=${JSON.stringify(ruta)}, DEST=${JSON.stringify(destinos)};
  const buscaComoExport=(cd,t)=>{ const tus=t*1e6; cd.setTarget(tus); const t0=performance.now();
    return new Promise(res=>{ const tick=()=>{ try{ cd.pump(); }catch(e){}
      if(cd.isDead()){ res({ms:performance.now()-t0, ok:false, motivo:'el decodificador murio'}); return; }
      if(cd.passed(tus)){ res({ms:performance.now()-t0, ok:!!cd.frameNear(tus)}); return; }
      if(performance.now()-t0>10000){ res({ms:performance.now()-t0, ok:false, motivo:'10 s sin fotograma: es lo que marca _cdFail'}); return; }
      setTimeout(tick,0); }; tick(); }); };
  // fotogramas clave REALES del archivo, para no dar por supuesto lo que ffmpeg dijo que hizo
  const d0=await demuxMP4(RUTA);
  const claves=[]; for(const s of d0.samples) if(s.key) claves.push(+(s.ptsExact/1e6).toFixed(4));
  claves.sort((a,b)=>a-b);
  const fps=d0.fps; try{ d0.close(); }catch(e){}
  const filas=[];
  for(const t of DEST){
    const d=await demuxMP4(RUTA); const cd=makeClipDecoder(d,true); vivos.push(cd);
    await new Promise(r=>setTimeout(r,120));
    const r0=cd.stats().resets;
    const r=await buscaComoExport(cd,t);
    const s=cd.stats();
    let K=0; for(const k of claves) if(k<=t) K=k;
    filas.push({t:t, K:K, delta:+(t-K).toFixed(3), ms:+r.ms.toFixed(1), ok:r.ok, motivo:r.motivo||'',
                reinicios:s.resets-r0, cache:s.cache});
    cd.close(); vivos.pop();
  }
  return JSON.stringify({fps:+fps.toFixed(2), claves:claves, filas:filas});
}catch(e){ return 'ERR '+String((e&&e.message)||e).slice(0,300);
} finally { for(const c of vivos){ try{ c.close(); }catch(e){} } } })()`;

console.log('');
console.log('R344b - un destino a mas de 2 s de su fotograma clave');
const malas=[];
for(const c of CLIPS){
  console.log('');
  console.log('== '+c.n);
  const r=await ev(PAGINA(c.p,c.t));
  let o=null; try{ o=JSON.parse(r); }catch(e){ console.log('   *** sonda rota -> '+String(r).slice(0,240)); malas.push(c.n+': sonda rota'); continue; }
  // no dar por buena la premisa: comprobar los fotogramas clave de VERDAD
  const esp=c.claves.join(','), real=o.claves.join(',');
  console.log('   claves reales: '+real+'   (se esperaban '+esp+')');
  if(esp!==real){ malas.push(c.n+': los fotogramas clave no son los que se supone ('+real+'): la premisa del contraste no se sostiene'); }
  console.log('   destino     K    destino-K     ms      reinicios   cache');
  for(const f of o.filas){
    console.log('   '+String(f.t).padStart(6)+' s  '+String(f.K).padStart(4)+'   '+String(f.delta).padStart(7)+' s  '+String(f.ms).padStart(8)+'   '+String(f.reinicios).padStart(6)+'      '+f.cache+(f.ok?'':('   *** '+(f.motivo||'sin fotograma'))));
    if(!f.ok) malas.push(c.n+': destino '+f.t+' s (a '+f.delta+' s de su clave) NO entrega fotograma en '+f.ms+' ms -> '+(f.motivo||'?'));
    else if(f.reinicios>1) malas.push(c.n+': destino '+f.t+' s (a '+f.delta+' s de su clave) cuesta '+f.reinicios+' reinicios');
  }
}
console.log('');
for(const m of malas) console.log('   *** '+m);
console.log(malas.length?('*** '+malas.length+' FALLOS'):'sin fallos: ningun destino se sale del camino rapido');
ws.close(); process.exitCode = malas.length?1:0;
