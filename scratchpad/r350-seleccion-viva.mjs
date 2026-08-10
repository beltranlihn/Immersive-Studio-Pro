/* [R350] Al arrastrar por la linea de tiempo, los clips se marcan A MEDIDA que el barrido los toca.

   Antes la seleccion se resolvia entera en el `pointerup`: durante todo el gesto no se veia nada y al soltar
   aparecian cuatro clips marcados de golpe. Lo pidio Beltran asi: «que se sienta realtime».

   Se mide la CONCLUSION -cuantos clips estan marcados EN PANTALLA en cada paso del arrastre- y no la premisa
   (que `state.selIds` se calcule): lo que el usuario ve es la clase `.sel` del nodo, y state podria ir bien con
   el DOM sin repintar. Y sabe fallar: la misma pasada mira ademas el ESTADO ANTERIOR, reconstruido pintando solo
   al soltar, y exige que ese caso se vea plano (0 marcados hasta el final).

   Uso:  npx electron . --remote-debugging-port=9222   y luego  node scratchpad/r350-seleccion-viva.mjs
*/
import http from 'http';

const lista = await new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: 9222, path: '/json/list' }, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => res(JSON.parse(b))); }).on('error', rej); });
const pg = lista.find(x => x.type === 'page' && /index\.html/.test(x.url));
if (!pg) { console.log('*** la app no esta escuchando en 9222'); process.exit(2); }
const ws = new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const ev = x => new Promise(r => { const i = ++id; pend.set(i, m => r(m.result && m.result.exceptionDetails ? ('EXC ' + (m.result.exceptionDetails.exception?.description || '').slice(0, 500)) : (m.result && m.result.result && m.result.result.value))); ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: x, awaitPromise: true, returnByValue: true, timeout: 120000 } })); });

/* vivo=false reconstruye el estado anterior: el barrido no pinta, todo se resuelve al soltar. */
const PAGINA = (vivo) => `(async()=>{ try{
  await newProject('dome',1024,1024,30,180,true); if(typeof hideLanding==='function')hideLanding();
  /* cuatro clips seguidos en la misma pista, con hueco entre ellos para que el barrido los cruce de uno en uno */
  for(let i=0;i<4;i++) _demoAddShape('rect','#888',0,i*2,1.5,{az:i*40,el:45,size:30});
  const puestos=state.clips.slice(-4);
  for(const c of puestos)c.lane=puestos[0].lane;
  state.selIds=[]; state.selId=null; state.tl.selA=null; state.tl.selB=null;
  renderTimeline(); await new Promise(z=>requestAnimationFrame(z));
  const marcados=()=>document.querySelectorAll('#tracks .clip.sel').length;

  const pps=state.tl.pxPerSec, rect=document.getElementById('tracks').getBoundingClientRect();
  const filaY=(()=>{ const n=document.querySelector('#tracks .clip[data-clip="'+puestos[0].id+'"]');
    const r=n.getBoundingClientRect(); return Math.round(r.top+r.height/2); })();
  /* se arranca en un hueco SIN clip (justo antes del primero) para que el gesto sea el de seleccion por rango */
  const x0=Math.round(rect.left+0.1*pps);
  const destinos=[1.9,3.9,5.9,7.9].map(t=>Math.round(rect.left+t*pps));

  const fondo=document.getElementById('tracks');
  fondo.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:x0,clientY:filaY,button:0,pointerId:1}));
  const durante=[];
  for(const x of destinos){
    window.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:x,clientY:filaY,pointerId:1}));
    await new Promise(z=>setTimeout(z,40));
    /* [reconstruccion del estado anterior] pintar al soltar = borrar aqui lo que el gesto haya marcado */
    if(!${vivo}){ document.querySelectorAll('#tracks .clip.sel').forEach(n=>n.classList.remove('sel')); }
    durante.push(marcados());
  }
  window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:destinos[destinos.length-1],clientY:filaY,pointerId:1}));
  await new Promise(z=>setTimeout(z,150));
  return JSON.stringify({durante:durante, alSoltar:marcados(), enEstado:state.selIds.length, clips:puestos.length});
}catch(e){ return 'ERR '+String((e&&(e.stack||e.message))||e).slice(0,400); } })()`;

console.log('');
console.log('R350 - la seleccion por arrastre se ve mientras se arrastra');
const malas = [];
for (const vivo of [false, true]) {
  const r = await ev(PAGINA(vivo));
  let o = null; try { o = JSON.parse(r); } catch (e) { console.log('   *** ' + String(r).slice(0, 400)); malas.push('no se pudo medir'); continue; }
  console.log('');
  console.log('   ' + (vivo ? 'COMO ESTA HOY' : 'ESTADO ANTERIOR (se resolvia todo al soltar)'));
  console.log('      clips marcados en los cuatro pasos del arrastre: ' + o.durante.join(' · ') + '  → al soltar: ' + o.alSoltar);
  if (!vivo) {
    if (o.durante.some(n => n > 0)) malas.push('la red NO sabe fallar: con el pintado suprimido durante el gesto se siguen viendo marcados');
    else console.log('      -> plano, como debe: durante el gesto no se ve nada'
      + '\n         (el 0 de «al soltar» es de la RECONSTRUCCION, no del programa: esta pasada le quita las clases'
      + '\n          por detras y la firma de pintarSel ya coincide, asi que no repinta algo que nadie deberia'
      + '\n          haber tocado. En la app nada las quita a mitad de gesto, y renderTimeline las repone desde'
      + '\n          state.selIds si llegara a reconstruir los nodos.)');
  } else {
    const creciente = o.durante.every((n, i) => i === 0 || n >= o.durante[i - 1]);
    if (!o.durante.some(n => n > 0)) malas.push('durante el arrastre no se marca ningun clip');
    else if (!creciente) malas.push('el recuento no crece con el barrido: ' + o.durante.join(','));
    else if (o.durante[o.durante.length - 1] !== o.clips) malas.push('al llegar al final no estan los ' + o.clips + ' clips: ' + o.durante.join(','));
    else if (o.alSoltar !== o.clips || o.enEstado !== o.clips) malas.push('soltar no deja la seleccion cerrada (pantalla ' + o.alSoltar + ', estado ' + o.enEstado + ')');
    else console.log('      -> los clips entran uno a uno segun los toca el barrido, y soltar no cambia nada');
  }
}
console.log('');
for (const x of malas) console.log('   *** ' + x);
ws.close();
process.exitCode = malas.length ? 1 : 0;
