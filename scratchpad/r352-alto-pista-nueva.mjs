/* [R352] Una pista nueva nace del alto que tienen las demas.

   Se creaban sin `h`, asi que `renderTimeline` las pintaba a la constante de fabrica (LANE_DEF_H = 57). Con la
   linea de tiempo agrandada o achicada a mano -Alt+rueda, que redimensiona TODAS a la vez- la recien anadida
   salia con otro alto y habia que reajustar el conjunto para volver a igualarlas. Lo pidio Beltran para las
   tres clases: audio, video y piso.

   Mide el alto RENDERIZADO del nodo `.lane` -que es lo que el usuario ve- y no la propiedad `l.h`: el estado
   podria estar bien y la pintura no. Y sabe fallar: reconstruye el estado anterior insertando una pista SIN
   pasar por `laneAplicaAlta` y exige que ese caso salga descuadrado.

   Uso:  npx electron . --remote-debugging-port=9222   y luego  node scratchpad/r352-alto-pista-nueva.mjs
*/
import http from 'http';

const lista = await new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: 9222, path: '/json/list' }, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => res(JSON.parse(b))); }).on('error', rej); });
const pg = lista.find(x => x.type === 'page' && /index\.html/.test(x.url));
if (!pg) { console.log('*** la app no esta escuchando en 9222'); process.exit(2); }
const ws = new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const ev = x => new Promise(r => { const i = ++id; pend.set(i, m => r(m.result && m.result.exceptionDetails ? ('EXC ' + (m.result.exceptionDetails.exception?.description || '').slice(0, 500)) : (m.result && m.result.result && m.result.result.value))); ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: x, awaitPromise: true, returnByValue: true, timeout: 120000 } })); });
const J = async src => { const r = await ev('(async()=>{ try{ return JSON.stringify(await (async()=>{' + src + '})()); }catch(e){ return "ERR "+String((e&&(e.stack||e.message))||e).slice(0,500); } })()'); try { return JSON.parse(r); } catch (e) { return { _err: String(r).slice(0, 500) }; } };

const malas = [];
const ok = (c, t, d) => { console.log('      ' + (c ? 'OK  ' : '*** ') + t + (d ? '  ' + d : '')); if (!c) malas.push(t + (d ? ' — ' + d : '')); };

console.log('');
console.log('R352 - el alto de una pista recien creada');

/* `pasos` vueltas de Alt+rueda: es el gesto real que descuadraba el resultado. */
const banco = (proyecto, pasos) => `
  ${proyecto}
  if(typeof hideLanding==='function')try{hideLanding();}catch(e){}
  for(let i=0;i<${pasos};i++) wheelResizeLanes({deltaY:-120});
  renderTimeline(); await new Promise(r=>requestAnimationFrame(r));
  const alto=li=>{ const n=document.querySelector('#tracks .lane[data-lane="'+li+'"]'); return n?Math.round(n.getBoundingClientRect().height):null; };
  const altosDe=()=>state.lanes.map((l,i)=>({i:i, kind:l.kind, surf:l.surf||null, px:alto(i)})).filter(x=>x.px!=null);
  const antes=altosDe();
  const mediana=(()=>{ const h=antes.map(x=>x.px).sort((a,b)=>a-b); return h[h.length>>1]; })();`;

/* ---- domo: video y audio ---- */
console.log('');
console.log('   proyecto de domo · pistas agrandadas a mano');
{
  const r = await J(banco(`await newProject('dome',1024,1024,30,180,true);`, 4) + `
    addLane('video'); addLane('audio');
    renderTimeline(); await new Promise(r=>requestAnimationFrame(r));
    const despues=altosDe();
    const nuevos=despues.filter(x=>!antes.some(a=>a.i===x.i&&a.px===x.px)||despues.length!==antes.length);
    /* la pista nueva de cada clase se localiza por nombre, que es lo unico estable tras el reindexado */
    const idxV=state.lanes.findIndex(l=>l.tag==='V5'), idxA=state.lanes.findIndex(l=>l.kind==='audio'&&l.tag==='A2');
    /* [R352] el ESTADO ANTERIOR: una pista insertada sin pasar por laneAplicaAlta, o sea sin h */
    state.lanes.push({id:uid(),name:'Vieja',tag:'VX',kind:'video'});
    renderTimeline(); await new Promise(r=>requestAnimationFrame(r));
    const idxX=state.lanes.findIndex(l=>l.tag==='VX');
    return {mediana:mediana, base:antes.map(x=>x.px),
            nuevaVideo:alto(idxV), nuevaAudio:alto(idxA), sinArreglo:alto(idxX)};`);
  if (r._err) ok(false, 'la sonda no corrio', r._err);
  else {
    console.log('      alto de las pistas existentes: ' + r.base.join(' · ') + '  (mediana ' + r.mediana + ')');
    ok(r.sinArreglo !== r.mediana, 'la red sabe fallar: sin el arreglo la pista nueva sale descuadrada', r.sinArreglo + ' px contra ' + r.mediana);
    ok(r.nuevaVideo === r.mediana, 'una pista de VIDEO nueva mide lo mismo que el resto', r.nuevaVideo + ' px');
    ok(r.nuevaAudio === r.mediana, 'una pista de AUDIO nueva mide lo mismo que el resto', r.nuevaAudio + ' px');
  }
}

/* ---- sala: piso ---- */
console.log('');
console.log('   proyecto de sala 360 · pistas achicadas a mano');
{
  /* [R352] La sala se crea con `newRoomProject` directamente, no con `startDemoProject('room')`: el demo monta
     ademas material y lanza el recorrido guiado, y la sonda se quedaba colgada esperandolo. Los muros son los
     mismos cuatro que usa el demo. */
  const r = await J(banco(`await newRoomProject({walls:NS_ROOM_ROLES_BY_N[4].map((rr,i)=>({role:rr,order:i+1,wcm:(rr==='Left'||rr==='Right')?400:500,hcm:300,pxW:1920,pxH:1080})),floor:roomFloorDefault(NS_ROOM_ROLES_BY_N[4].map((rr,i)=>({role:rr,order:i+1,wcm:(rr==='Left'||rr==='Right')?400:500,hcm:300,pxW:1920,pxH:1080}))),fps:60}, true);`, -3).replace('for(let i=0;i<-3;i++) wheelResizeLanes({deltaY:-120});',
      'for(let i=0;i<3;i++) wheelResizeLanes({deltaY:120});   /* achicar, no agrandar: el descuadre tiene que verse en los dos sentidos */') + `
    if(!isRoom())return {salta:'el demo de sala no dejo una secuencia de sala'};
    addLane('video','floor');
    renderTimeline(); await new Promise(r=>requestAnimationFrame(r));
    const idxF=state.lanes.map((l,i)=>({l,i})).filter(o=>o.l.surf==='floor').map(o=>o.i).pop();
    state.lanes.push({id:uid(),name:'Vieja',tag:'FX',kind:'video',surf:'floor'});
    renderTimeline(); await new Promise(r=>requestAnimationFrame(r));
    const idxX=state.lanes.findIndex(l=>l.tag==='FX');
    return {mediana:mediana, base:antes.map(x=>x.px), nuevaPiso:alto(idxF), sinArreglo:alto(idxX)};`);
  if (r._err) ok(false, 'la sonda de la sala no corrio', r._err);
  else if (r.salta) console.log('      -- ' + r.salta);
  else {
    console.log('      alto de las pistas existentes: ' + r.base.join(' · ') + '  (mediana ' + r.mediana + ')');
    ok(r.sinArreglo !== r.mediana, 'la red sabe fallar tambien achicando', r.sinArreglo + ' px contra ' + r.mediana);
    ok(r.nuevaPiso === r.mediana, 'una pista de PISO nueva mide lo mismo que el resto', r.nuevaPiso + ' px');
  }
}

console.log('');
if (malas.length) { console.log('   ' + malas.length + ' FALLO(S):'); for (const x of malas) console.log('      *** ' + x); }
else console.log('   todo verde');
ws.close();
process.exitCode = malas.length ? 1 : 0;
