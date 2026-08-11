/* [R351] Que deja en RAM cada proxy generado, medido sobre el material real de Beltran.

   Recien abierto el proyecto, la reproduccion va a 60 fps clavados y el monton de JS se queda en 10 MB: los
   proxys se re-enganchan del disco con `bindProxyFile` y eso NO llena `m.frames`. El regimen que hay que mirar
   es el OTRO: la sesion en la que los proxys se GENERAN, que es la que Beltran tuvo por primera vez desde R326
   (hasta R349, «Generar proxy» no encolaba nada).

   `makeProxy` va empujando cada trozo codificado a `m.frames` mientras codifica, hasta `FR_BUDGET` = 256 MB POR
   MEDIO, y solo la suelta si DESBORDA ese tope; el camino de disco publica el proxy y vuelve sin tocarla. Con
   catorce medios, si cada uno retiene decenas de MB, el monton se va a mas de un giga en una sesion.

   Se generan TRES (no los catorce: reescribir catorce archivos del usuario para una medida es caro y ademas
   basta con ver si la retencion se ACUMULA de uno a otro). El contenido es identico -mismo codificador, misma
   ruta deterministica por hash-, asi que los proxys quedan como estaban.

   Uso:  "…\Immersive Studio Pro.exe" --remote-debugging-port=9222  con RitoDome.isp abierto,
         y luego  node scratchpad/r351-frames-ram.mjs
*/
import http from 'http';

const lista = await new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: 9222, path: '/json/list' }, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => res(JSON.parse(b))); }).on('error', rej); });
const pg = lista.find(x => x.type === 'page' && /index\.html/.test(x.url));
if (!pg) { console.log('*** la app no esta escuchando en 9222'); process.exit(2); }
const ws = new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const ev = x => new Promise(r => { const i = ++id; pend.set(i, m => r(m.result && m.result.exceptionDetails ? ('EXC ' + (m.result.exceptionDetails.exception?.description || '').slice(0, 500)) : (m.result && m.result.result && m.result.result.value))); ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: x, awaitPromise: true, returnByValue: true, timeout: 300000 } })); });
const J = async src => { const r = await ev('(async()=>{ try{ return JSON.stringify(await (async()=>{' + src + '})()); }catch(e){ return "ERR "+String((e&&(e.stack||e.message))||e).slice(0,500); } })()'); try { return JSON.parse(r); } catch (e) { return { _err: String(r).slice(0, 500) }; } };

console.log('');
console.log('R351 - lo que cada proxy generado deja retenido en el monton de JS');

const r = await J(`
  const heap=()=>{ try{ return Math.round(performance.memory.usedJSHeapSize/1048576); }catch(e){ return null; } };
  const pesoFrames=m=>{ if(!Array.isArray(m.frames))return 0; let b=0; for(const f of m.frames)b+=(f&&f.data&&f.data.length)||0; return b; };
  const totalFrames=()=>state.media.reduce((s,m)=>s+pesoFrames(m),0);
  const vids=state.media.filter(m=>m.kind==='video'&&m.path).slice(0,3);
  if(vids.length<3)return {salta:'hacen falta 3 medios de video con ruta'};
  const pasos=[{n:'al empezar', heap:heap(), framesMB:+(totalFrames()/1048576).toFixed(1), conTabla:0}];
  for(const v of vids){
    /* exactamente lo que hace la entrada «Regenerar proxy» del menu contextual */
    v.proxyReady=false; v.proxyPct=0; if(v.proxyPath)v._proxyForce=true; enqProxy(v);
    const t0=performance.now();
    while(!v.proxyReady && v.proxyPct>=0 && performance.now()-t0<180000) await new Promise(r=>setTimeout(r,200));
    pasos.push({n:(v.name||'').slice(0,24), dur:+(v.dur||0).toFixed(1), fps:v.fps,
      heap:heap(), framesMB:+(totalFrames()/1048576).toFixed(1),
      suyosMB:+(pesoFrames(v)/1048576).toFixed(1), nFrames:Array.isArray(v.frames)?v.frames.length:0,
      conTabla:state.media.filter(m=>Array.isArray(m.frames)&&m.frames.length).length,
      ms:Math.round(performance.now()-t0)});
  }
  return {pasos:pasos, medios:state.media.filter(m=>m.kind==='video').length};`);

if (r._err) { console.log('   *** ' + r._err); ws.close(); process.exit(1); }
if (r.salta) { console.log('   -- ' + r.salta); ws.close(); process.exit(3); }

console.log('');
console.log('   paso                       dur    monton   frames retenidos   medios con tabla');
for (const p of r.pasos)
  console.log('   ' + String(p.n).padEnd(26) + String(p.dur != null ? p.dur + 's' : '').padEnd(7) + String(p.heap + ' MB').padEnd(9) + String(p.framesMB + ' MB' + (p.suyosMB != null ? ' (+' + p.suyosMB + ')' : '')).padEnd(19) + p.conTabla);
const ult = r.pasos[r.pasos.length - 1], pri = r.pasos[0];
console.log('');
console.log('   tras generar 3 de ' + r.medios + ': monton ' + pri.heap + ' → ' + ult.heap + ' MB · ' + ult.framesMB + ' MB retenidos en tablas de fotogramas');
if (ult.conTabla > 0) {
  const porMedio = ult.framesMB / ult.conTabla;
  console.log('   media por medio: ' + porMedio.toFixed(1) + ' MB  →  los ' + r.medios + ' del proyecto proyectarian ~' + Math.round(porMedio * r.medios) + ' MB');
  console.log('   (la ultima cifra es ARITMETICA sobre lo medido, no una medida: los tres generados si lo son)');
} else console.log('   NINGUNA tabla retenida: la hipotesis de `m.frames` es FALSA y hay que buscar en otro sitio');
console.log('');
ws.close();
