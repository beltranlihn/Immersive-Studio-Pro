/* [R351] «La app corre mucho peor que antes y crasheo en un minuto» — medida, no diagnostico de oido.

   Abre el proyecto de Beltran en el .exe INSTALADO (que es el que corre en la RTX) y mide tres cosas:
     · que arrastra cada medio en RAM: la tabla de fotogramas `m.frames` que deja el generador de proxys,
       con su peso real en bytes;
     · el monton de JS al cargar y como crece;
     · los tiempos de fotograma reproduciendo, con la mediana y el peor.

   Por que `m.frames`: `makeProxy` va llenando esa tabla MIENTRAS codifica (hasta FR_BUDGET = 256 MB POR MEDIO)
   y solo la suelta si desborda ese tope; el camino de disco publica el proxy y vuelve sin tocarla. Como
   «Generar proxy» llevaba rondas sin generar nada (R349), ese camino no lo pisaba nadie desde R326.

   Uso:  "…\Immersive Studio Pro.exe" --remote-debugging-port=9222   y luego  node scratchpad/r351-perf-rito.mjs
*/
import http from 'http';

const PROY = process.argv[2] || 'C:\\Users\\beltr\\Desktop\\Rito Movie\\Dome\\RitoDome.isp';

const lista = await new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: 9222, path: '/json/list' }, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => res(JSON.parse(b))); }).on('error', rej); });
const pg = lista.find(x => x.type === 'page' && /index\.html/.test(x.url));
if (!pg) { console.log('*** la app no esta escuchando en 9222'); process.exit(2); }
const ws = new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const ev = x => new Promise(r => { const i = ++id; pend.set(i, m => r(m.result && m.result.exceptionDetails ? ('EXC ' + (m.result.exceptionDetails.exception?.description || '').slice(0, 500)) : (m.result && m.result.result && m.result.result.value))); ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: x, awaitPromise: true, returnByValue: true, timeout: 240000 } })); });
const J = async src => { const r = await ev('(async()=>{ try{ return JSON.stringify(await (async()=>{' + src + '})()); }catch(e){ return "ERR "+String((e&&(e.stack||e.message))||e).slice(0,500); } })()'); try { return JSON.parse(r); } catch (e) { return { _err: String(r).slice(0, 500) }; } };

console.log('');
console.log('R351 - por que va peor: medida sobre ' + PROY);

const carga = await J(`
  if(typeof hideLanding==='function')try{hideLanding();}catch(e){}
  if(currentPath!==${JSON.stringify(PROY)} || !state.clips.length){
    openProjectPath(${JSON.stringify(PROY)});
    /* [R351] El proyecto puede pararse en un dialogo -«existe un autoguardado mas nuevo (posible cierre
       inesperado)»- que en un arnes sin manos no contesta nadie: la sonda se quedaba colgada y parecia que la
       carga no terminaba nunca. Se contesta «Abrir el archivo», que es el estado reproducible. */
    for(let i=0;i<40;i++){ await new Promise(r=>setTimeout(r,250));
      const b=[...document.querySelectorAll('button')].find(x=>/Open the file|Abrir el archivo/i.test(x.textContent||''));
      if(b){ b.click(); break; }
      if(state.clips.length)break; }
    for(let i=0;i<120 && !state.clips.length;i++)await new Promise(r=>setTimeout(r,250));
  }
  await new Promise(r=>setTimeout(r,1500));
  const heap=()=>{ try{ return Math.round(performance.memory.usedJSHeapSize/1048576); }catch(e){ return null; } };
  const pesoFrames=m=>{ if(!Array.isArray(m.frames))return 0; let b=0; for(const f of m.frames)b+=(f&&f.data&&f.data.length)||0; return b; };
  const medios=state.media.filter(m=>m.kind==='video').map(m=>({
    n:(m.name||'').slice(0,28), w:m.w, h:m.h, dur:+(m.dur||0).toFixed(1),
    proxy:!!m.proxyReady, nFrames:Array.isArray(m.frames)?m.frames.length:0,
    framesMB:+(pesoFrames(m)/1048576).toFixed(1) }));
  return {clips:state.clips.length, medios:medios, heapMB:heap(),
          totalFramesMB:+(medios.reduce((s,x)=>s+x.framesMB,0)).toFixed(1),
          conTabla:medios.filter(x=>x.nFrames>0).length};`);

if (carga._err) { console.log('   *** no se pudo cargar: ' + carga._err); ws.close(); process.exit(1); }
console.log('');
console.log('   proyecto: ' + carga.clips + ' clips · ' + carga.medios.length + ' medios de video · monton JS ' + carga.heapMB + ' MB');
console.log('');
console.log('   medio                          tamano      proxy  fotogramas en RAM');
for (const m of carga.medios)
  console.log('   ' + m.n.padEnd(30) + (m.w + 'x' + m.h).padEnd(12) + (m.proxy ? 'si   ' : 'no   ') + (m.nFrames ? (m.nFrames + ' · ' + m.framesMB + ' MB') : '—'));
console.log('');
console.log('   TABLAS DE FOTOGRAMAS RETENIDAS: ' + carga.conTabla + ' medios · ' + carga.totalFramesMB + ' MB de monton');

/* ---- reproduccion: tiempos de fotograma y crecimiento del monton ---- */
const play = await J(`
  const heap=()=>{ try{ return Math.round(performance.memory.usedJSHeapSize/1048576); }catch(e){ return null; } };
  state.playhead=0; if(state.playing)pause();
  const h0=heap();
  const dts=[]; let last=performance.now(), corriendo=true;
  const tick=()=>{ if(!corriendo)return; const n=performance.now(); dts.push(n-last); last=n; requestAnimationFrame(tick); };
  requestAnimationFrame(()=>{ last=performance.now(); requestAnimationFrame(tick); });
  play();
  await new Promise(r=>setTimeout(r,20000));
  corriendo=false; pause();
  const h1=heap();
  const e=dts.slice(2).sort((a,b)=>a-b);
  const pct=q=>e.length?+e[Math.min(e.length-1,Math.floor(e.length*q))].toFixed(1):null;
  return {n:e.length, mediana:pct(0.5), p90:pct(0.9), peor:+(e[e.length-1]||0).toFixed(1),
          fpsMediana:+(1000/(pct(0.5)||1)).toFixed(1), heapAntes:h0, heapDespues:h1,
          largos:e.filter(x=>x>100).length};`);

console.log('');
if (play._err) console.log('   *** la reproduccion no se pudo medir: ' + play._err);
else {
  console.log('   20 s de reproduccion · ' + play.n + ' fotogramas');
  console.log('      mediana ' + play.mediana + ' ms (' + play.fpsMediana + ' fps) · p90 ' + play.p90 + ' ms · peor ' + play.peor + ' ms · tirones >100 ms: ' + play.largos);
  console.log('      monton JS: ' + play.heapAntes + ' → ' + play.heapDespues + ' MB');
}
console.log('');
ws.close();
