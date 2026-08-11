/* [R351] Lo que de verdad le paso a Beltran: EDITAR MIENTRAS SE GENERAN PROXYS.

   Reconstruccion desde las marcas de tiempo del disco (no de oido):
     · 16:52  abre `RitoDome.isp` y trabaja — un solo autoguardado, o sea ~1 minuto de sesion sucia
     · 17:18-17:20  se crean DOCE proxys de material de 2560x1440 (mtime de los `.dsp-proxy-*.mp4`)
     · 17:18-17:24  sus autoguardados siguen: estaba editando MIENTRAS se generaban
     · mi sesion de medida no arranco hasta las 17:27, asi que nada de eso es mio
   Hasta R349 «Generar proxy» no encolaba nada (la marca `_pxGen` cerraba `enqProxy`), asi que esa carga de
   fondo es la PRIMERA vez que existe desde R326: no la habia visto nunca, y por eso «antes iba perfecto».

   Aqui se mide la reproduccion en t=33 s -donde se solapan dos composiciones de 9 elementos en un domo 4096- con
   y sin una generacion de proxy en marcha, para poner un numero a cuanto cuesta.

   Uso:  "…\Immersive Studio Pro.exe" --remote-debugging-port=9222  con RitoDome.isp abierto,
         y luego  node scratchpad/r351-proxy-vs-editor.mjs
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

/* conProxy=true lanza una generacion de proxy y reproduce ENCIMA, que es lo que el hacia. */
const correr = (conProxy) => J(`
  state.previewQuality=0.25; state.view.useProxy=true;
  if(state.playing)pause();
  state.playhead=33; scrubRender(); render();
  await new Promise(r=>setTimeout(r,1500));
  let gen=null;
  if(${conProxy}){
    gen=state.media.filter(m=>m.kind==='video'&&m.path).sort((a,b)=>(b.fsize||0)-(a.fsize||0))[0];
    if(gen){ gen.proxyReady=false; gen.proxyPct=0; if(gen.proxyPath)gen._proxyForce=true; enqProxy(gen); }
    await new Promise(r=>setTimeout(r,600));   /* que arranque de verdad antes de contar */
  }
  const dts=[]; let last=performance.now(), on=true;
  const tick=()=>{ if(!on)return; const n=performance.now(); dts.push(n-last); last=n; requestAnimationFrame(tick); };
  requestAnimationFrame(()=>{ last=performance.now(); requestAnimationFrame(tick); });
  play(); await new Promise(r=>setTimeout(r,14000)); on=false; pause();
  const pct=gen?gen.proxyPct:null, listo=gen?!!gen.proxyReady:null;
  /* si sigue generando, se le deja terminar para no dejar un .part suelto */
  if(gen){ const t0=performance.now(); while(!gen.proxyReady&&gen.proxyPct>=0&&performance.now()-t0<180000)await new Promise(r=>setTimeout(r,300)); }
  const e=dts.slice(3).sort((a,b)=>a-b);
  const p=v=>e.length?+e[Math.min(e.length-1,Math.floor(e.length*v))].toFixed(1):null;
  return {mediana:p(0.5), fps:+(1000/(p(0.5)||1)).toFixed(1), p90:p(0.9), peor:+(e[e.length-1]||0).toFixed(0),
          tirones:e.filter(x=>x>100).length, muyLargos:e.filter(x=>x>250).length, n:e.length,
          medio:gen?(gen.name||'').slice(0,22):null, pctAlAcabar:pct, listo:listo};`);

console.log('');
console.log('R351 - editar mientras se genera un proxy (t=33 s · 1/4 · con proxy de clip)');
const sin = await correr(false);
if (sin._err) { console.log('   *** ' + sin._err); process.exit(1); }
console.log('');
console.log('   SIN generacion de fondo:  ' + sin.fps + ' fps · mediana ' + sin.mediana + ' ms · p90 ' + sin.p90 + ' ms · peor ' + sin.peor + ' ms · tirones>100ms ' + sin.tirones);
const con = await correr(true);
if (con._err) { console.log('   *** ' + con._err); process.exit(1); }
console.log('   CON un proxy generandose: ' + con.fps + ' fps · mediana ' + con.mediana + ' ms · p90 ' + con.p90 + ' ms · peor ' + con.peor + ' ms · tirones>100ms ' + con.tirones + ' (>250ms: ' + con.muyLargos + ')');
console.log('      medio en generacion: ' + con.medio + ' · al acabar la medida iba por el ' + con.pctAlAcabar + '%');
console.log('');
const caida = sin.mediana && con.mediana ? (con.mediana / sin.mediana) : null;
console.log('   -> el fotograma tarda ' + (caida ? caida.toFixed(1) + '×' : '?') + ' mas, y aparecen ' + con.tirones + ' tirones donde antes habia ' + sin.tirones);
console.log('   (y Beltran tenia DOCE en cola, no uno)');
console.log('');
ws.close();
