/* [R351] Rendimiento DONDE HAY MATERIAL, que es lo que la primera medida no hizo.

   La primera pasada reprodujo desde t=0 durante 20 s y dio 60 fps clavados... porque en `RitoDome.isp` los
   clips estan en 32,2 s · 64,4 s · 94,9 s: se midio un tramo VACIO. Es exactamente el fallo que el metodo
   persigue —medir la premisa (la aplicacion corre) en vez de la conclusion (SU material se reproduce)— y por
   poco me lleva a decirle a Beltran que no habia nada que arreglar.

   Aqui se barren los tres tramos con contenido, y en cada uno las combinaciones que el usa: calidad de
   previsualizacion Full y 1/4, con proxy de clip y sin el. En 32,2 s se solapan DOS composiciones de 9
   elementos cada una en una secuencia de domo 4096x4096, y ninguna tiene proxy de composicion (`ncPath` no
   existe ni en el .isp guardado ni en el autoguardado: no se ha perdido nada, nunca se horneo).

   Uso:  "…\Immersive Studio Pro.exe" --remote-debugging-port=9222  con RitoDome.isp abierto,
         y luego  node scratchpad/r351-perf-donde-hay.mjs
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

const mapa = await J(`
  const dib=t=>collectDrawnVideoClips(state.clips,state.lanes,t,0,[]).length;
  return {puntos:state.clips.map(c=>({t:+(c.start+0.5).toFixed(1), m:(mediaById(c.mediaId)||{}).name})),
          calidad:state.previewQuality, proxy:state.view.useProxy, comp:state.view.useNestCache,
          dibujadosEn:[0,33,65,95].map(t=>({t:t, n:dib(t)}))};`);
if (mapa._err) { console.log('*** ' + mapa._err); process.exit(1); }
console.log('');
console.log('R351 - rendimiento donde SI hay material');
console.log('   clips dibujados por instante: ' + mapa.dibujadosEn.map(x => 't=' + x.t + 's → ' + x.n).join(' · '));

const medir = async (t, q, proxy) => await J(`
  state.previewQuality=${q}; state.view.useProxy=${proxy};
  try{ disposeAllVinst(); }catch(e){}
  try{ syncCompSize(); }catch(e){}
  if(state.playing)pause();
  state.playhead=${t}; scrubRender(); render();
  await new Promise(r=>setTimeout(r,1800));            /* que se enganchen los decodificadores antes de contar */
  const dts=[]; let last=performance.now(), on=true;
  const tick=()=>{ if(!on)return; const n=performance.now(); dts.push(n-last); last=n; requestAnimationFrame(tick); };
  requestAnimationFrame(()=>{ last=performance.now(); requestAnimationFrame(tick); });
  play(); await new Promise(r=>setTimeout(r,12000)); on=false; pause();
  const e=dts.slice(3).sort((a,b)=>a-b);
  const pc=v=>e.length?+e[Math.min(e.length-1,Math.floor(e.length*v))].toFixed(1):null;
  return {mediana:pc(0.5), fps:+(1000/(pc(0.5)||1)).toFixed(1), p90:pc(0.9), peor:+(e[e.length-1]||0).toFixed(0),
          tirones:e.filter(x=>x>100).length, n:e.length,
          dibujados:collectDrawnVideoClips(state.clips,state.lanes,${t},0,[]).length};`);

console.log('');
console.log('   instante  calidad  proxy   fps      mediana   p90     peor    tirones>100ms  clips dibujados');
for (const t of [33, 65, 95]) {
  for (const [q, ql] of [[1, 'Full'], [0.25, '1/4']]) {
    for (const px of [true, false]) {
      const r = await medir(t, q, px);
      if (r._err) { console.log('   t=' + t + ' ' + ql + ' → *** ' + r._err); continue; }
      console.log('   t=' + String(t + 's').padEnd(8) + ql.padEnd(9) + (px ? 'si ' : 'no ').padEnd(7)
        + String(r.fps).padEnd(9) + String(r.mediana + ' ms').padEnd(10) + String(r.p90 + ' ms').padEnd(8)
        + String(r.peor + ' ms').padEnd(8) + String(r.tirones).padEnd(15) + r.dibujados);
    }
  }
}
await J(`state.previewQuality=${mapa.calidad}; state.view.useProxy=${mapa.proxy}; try{disposeAllVinst();syncCompSize();}catch(e){} render(); return 1;`);
console.log('');
ws.close();
