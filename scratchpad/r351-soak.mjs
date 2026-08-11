/* [R351] Prueba LARGA: lo unico que una medida de 15 s no puede ver es lo que CRECE.

   Beltran dice que se traba «constantemente» y que crasheo «en un minuto». Todas las medidas cortas de esta
   ronda dan 60 fps clavados en su proyecto (t=33 s, dos composiciones de 9 elementos, domo 4096, Full y 1/4,
   con proxy y sin el). Asi que si hay algo, esta en la DERIVA: memoria de GPU, decodificadores por clip,
   texturas o monton de JS que suben mientras se reproduce.

   Reproduce en bucle sobre su tramo con material durante varios minutos y muestrea cada 10 s: RAM del proceso,
   memoria de GPU (las mismas cifras de la barra de estado), instancias `_vinst` vivas, entradas del pool de
   nidos y el monton de JS. Si alguna sube sin bajar, ahi esta.

   Uso:  "…\Immersive Studio Pro.exe" --remote-debugging-port=9222  con RitoDome.isp abierto,
         y luego  node scratchpad/r351-soak.mjs [minutos]
*/
import http from 'http';

const MIN = +(process.argv[2] || 4);
const PROXY = process.argv[3] !== 'noproxy';      // [R351] 3er argumento: `noproxy` = como lo usa Beltran
const BUCLE = process.argv[4] !== 'sinbucle';     // 4o argumento: `sinbucle` = reproduccion recta, para aislar la vuelta

const lista = await new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: 9222, path: '/json/list' }, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => res(JSON.parse(b))); }).on('error', rej); });
const pg = lista.find(x => x.type === 'page' && /index\.html/.test(x.url));
if (!pg) { console.log('*** la app no esta escuchando en 9222'); process.exit(2); }
const ws = new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const ev = x => new Promise(r => { const i = ++id; pend.set(i, m => r(m.result && m.result.exceptionDetails ? ('EXC ' + (m.result.exceptionDetails.exception?.description || '').slice(0, 400)) : (m.result && m.result.result && m.result.result.value))); ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: x, awaitPromise: true, returnByValue: true, timeout: 60000 } })); });

console.log('');
console.log('R351 - prueba larga de ' + MIN + ' min · Full · ' + (PROXY?'CON proxy':'SIN proxy') + ' · ' + (BUCLE?'en bucle 32-52 s':'reproduccion RECTA desde 32 s'));

const arranque = await ev(`(async()=>{ try{
  state.previewQuality=1; state.view.useProxy=${PROXY};
  if(${BUCLE}){ state.workIn=32; state.workOut=52; state.loop=true; }   /* bucle sobre las dos composiciones */
  else { state.workIn=null; state.workOut=null; state.loop=false; }
  if(state.playing)pause();
  state.playhead=33; scrubRender(); render();
  await new Promise(r=>setTimeout(r,1200));
  play();
  window.__soak={dts:[],on:true};
  let last=performance.now();
  const tick=()=>{ if(!window.__soak.on)return; const n=performance.now(); window.__soak.dts.push(n-last); last=n; requestAnimationFrame(tick); };
  requestAnimationFrame(()=>{ last=performance.now(); requestAnimationFrame(tick); });
  return 'ok';
}catch(e){ return 'ERR '+String(e&&e.message||e); } })()`);
if (String(arranque).startsWith('ERR')) { console.log('   *** ' + arranque); process.exit(1); }

const muestra = () => ev(`(async()=>{ try{
  let m=null; try{ m=await DSP.metrics(); }catch(e){}
  const d=window.__soak?window.__soak.dts.splice(0):[];
  const e=d.slice().sort((a,b)=>a-b);
  const p=v=>e.length?+e[Math.min(e.length-1,Math.floor(e.length*v))].toFixed(1):null;
  return JSON.stringify({
    ramMB:m?m.ramMB:null, gpuPct:m&&m.gpuUtil!=null?Math.round(m.gpuUtil):null,
    gpuGB:m&&m.gpuMemUsed!=null?+(m.gpuMemUsed/1024).toFixed(2):null,
    heapMB:(()=>{try{return Math.round(performance.memory.usedJSHeapSize/1048576);}catch(_){return null;}})(),
    vinst:(typeof _vinst!=='undefined')?_vinst.size:null,
    /* [R351] Los registros que pueden retener memoria de GPU. El que crezca sin bajar es el culpable, y esto lo
       dice sin adivinar leyendo codigo: _ra es la cache de scrub-ahead, _nestPool los destinos de composicion,
       _fxHist el historial de los efectos de realimentacion, y cd el anillo de VideoFrames de cada ClipDecoder
       vivo, que son superficies de GPU y no objetos de JS. */
    ra:(typeof _ra!=='undefined')?_ra.size:null, raPool:(typeof _raPool!=='undefined')?_raPool.length:null,
    nestPool:(typeof _nestPool!=='undefined')?_nestPool.length:null,
    fxHist:(typeof _fxHist!=='undefined')?(_fxHist.size!=null?_fxHist.size:Object.keys(_fxHist).length):null,
    cds:(()=>{ try{ let n=0,fr=0; for(const [,vi] of _vinst){ if(vi&&vi.cd){ n++; const s=vi.cd.stats?vi.cd.stats():null; fr+=(s&&s.cache)||0; } } return n+'/'+fr; }catch(e){ return null; } })(),
    fps:p(0.5)?+(1000/p(0.5)).toFixed(1):null, p90:p(0.9), peor:+(e[e.length-1]||0).toFixed(0),
    tirones:e.filter(x=>x>100).length, ph:+state.playhead.toFixed(1), sonando:state.playing
  });
}catch(e){ return 'ERR '+String(e&&e.message||e); } })()`);

console.log('');
console.log('   min:seg   fps    p90     peor    tirones  RAM       GPU        VRAM     vinst  monton  registros                          cabezal');
const t0 = Date.now();
let vivo = true;
for (let s = 10; s <= MIN * 60; s += 10) {
  await new Promise(r => setTimeout(r, 10000));
  const raw = await muestra();
  if (raw == null || String(raw).startsWith('ERR')) { console.log('   *** la app dejo de responder a los ' + Math.round((Date.now() - t0) / 1000) + ' s: ' + raw); vivo = false; break; }
  let o; try { o = JSON.parse(raw); } catch (e) { console.log('   *** ' + String(raw).slice(0, 200)); vivo = false; break; }
  const mm = String(Math.floor(s / 60)) + ':' + String(s % 60).padStart(2, '0');
  console.log('   ' + mm.padEnd(10) + String(o.fps).padEnd(7) + String(o.p90 + 'ms').padEnd(8) + String(o.peor + 'ms').padEnd(8)
    + String(o.tirones).padEnd(9) + String(o.ramMB + ' MB').padEnd(10) + String((o.gpuPct != null ? o.gpuPct + '%' : '—')).padEnd(11)
    + String((o.gpuGB != null ? o.gpuGB + ' GB' : '—')).padEnd(9) + String(o.vinst).padEnd(7) + String(o.heapMB + 'MB').padEnd(8) + ('ra=' + o.ra + '/' + o.raPool + ' nest=' + o.nestPool + ' fx=' + o.fxHist + ' cd=' + o.cds).padEnd(34) + o.ph + (o.sonando ? '' : ' (PARADO)'));
}
if (vivo) await ev(`(()=>{ try{ window.__soak.on=false; pause(); state.loop=false; state.workIn=null; state.workOut=null; }catch(e){} return 1; })()`);
console.log('');
ws.close();
