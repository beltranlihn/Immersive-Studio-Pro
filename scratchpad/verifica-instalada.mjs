/* VERIFICADOR DE LA APP INSTALADA — ¿el `.exe` que hay en el ordenador lleva de verdad las rondas que se
   dieron por desplegadas?
   ───────────────────────────────────────────────────────────────────────────────────────────────────────────
   El sha1 del `app.asar` (lo que compara `scripts/deploy-verificado.ps1`) dice que las tres instalaciones son
   IGUALES entre sí y a la compilación; no dice qué CÓDIGO llevan. Esto se lo pregunta al programa en marcha
   —por un símbolo que sólo existe desde cada ronda—, que es la diferencia entre «desplegado» y «supuesto».

   Nació de un caso real (2026-09-10): Beltrán guardó un proyecto 2D y no se creó la carpeta de proyecto de
   R360. El `.isp` no traía la clave `managed`, que `serProject` escribe SIEMPRE — o sea que lo guardó una
   versión anterior, con el asar nuevo ya en disco: la ventana llevaba abierta desde antes del despliegue, y
   Electron lee el asar al ARRANCAR. Un asar nuevo bajo un proceso vivo no cambia nada.

   Uso:  "…\\Immersive Studio Pro.exe" --remote-debugging-port=9222   ->   node scratchpad/verifica-instalada.mjs
*/
import http from 'http';

const PORT = 9222;

/* Un símbolo por ronda: tiene que ser algo que ANTES no existía, no un nombre que lleve ahí desde siempre. */
const RONDAS = {
  'R360 · proyecto-carpeta':        "('managed' in serProject())",
  'R363 · proxy de imagen':         "typeof attachExistingImgProxy==='function'",
  'R364 · carpetas plegadas':       "typeof plegarTodasLasCarpetas==='function'",
  'R365/R368 · bucles':             "typeof acotarBucle==='function'",
  'R367 · proxies huérfanos':       "typeof limpiarProxiesDeOtroTamano==='function'",
  'R370 · PNG con alfa':            "typeof _exportAlfa!=='undefined'",
  'R370 · salida en vivo por modo': "typeof salidaVivaRect==='function' && typeof salidaVivaEtiqueta==='function'",
  'R370 · nido no cuadrado':        "typeof NC_FMT!=='undefined'",
};

const lista = () => new Promise((res, rej) => {
  http.get({ host:'127.0.0.1', port:PORT, path:'/json/list' }, r => {
    let b=''; r.on('data',c=>b+=c); r.on('end',()=>{ try{res(JSON.parse(b));}catch(e){rej(e);} });
  }).on('error', rej);
});
async function evalEn(url, expr, ms=30000) {
  const ws = new WebSocket(url);
  await new Promise((res,rej)=>{ ws.onopen=res; ws.onerror=()=>rej(new Error('ws no conecta')); });
  try {
    return await new Promise((res,rej)=>{
      const t=setTimeout(()=>rej(new Error('CDP sin respuesta')), ms);
      ws.onmessage=ev=>{ const m=JSON.parse(ev.data); if(m.id!==1)return; clearTimeout(t);
        if(m.error)return rej(new Error('CDP: '+JSON.stringify(m.error)));
        const r=m.result;
        if(r.exceptionDetails)return rej(new Error('la pagina reventó: '+((r.exceptionDetails.exception&&r.exceptionDetails.exception.description)||r.exceptionDetails.text)));
        res(r.result.value); };
      ws.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:expr,awaitPromise:true,returnByValue:true,timeout:ms}}));
    });
  } finally { try{ws.close();}catch(_){} }
}

(async () => {
  let pag=null;
  for(const t of (await lista()).filter(t=>t.type==='page'&&t.webSocketDebuggerUrl)){
    try{ if(await evalEn(t.webSocketDebuggerUrl,'typeof state!=="undefined" && !!state && typeof serProject==="function"',8000)){ pag=t.webSocketDebuggerUrl; break; } }catch(_){}
  }
  if(!pag){ console.error('✘ no encuentro la pagina del editor — ¿lanzaste el .exe con --remote-debugging-port=9222?'); process.exitCode=2; return; }

  const donde = await evalEn(pag, "location.href.indexOf('app.asar')>=0 ? 'app.asar — INSTALADA' : ('arbol de desarrollo: '+location.href)");
  console.log('· corriendo desde: ' + donde);
  if(donde.indexOf('INSTALADA') < 0)
    console.log('  ⚠ OJO: esto NO es la app instalada, asi que no prueba lo que se ha desplegado.');

  const faltan = [];
  for(const [nombre, expr] of Object.entries(RONDAS)) {
    let ok=false;
    try { ok = (await evalEn(pag, '(()=>{ try{ return !!('+expr+'); }catch(e){ return false; } })()')) === true; } catch(e){}
    console.log((ok?'  ✔ ':'  ✘ ') + nombre);
    if(!ok) faltan.push(nombre);
  }
  console.log('\n' + (faltan.length
    ? '✘ la app instalada NO lleva: ' + faltan.join(' · ')
    : '✔ la app instalada lleva todas las rondas comprobadas'));
  process.exitCode = faltan.length ? 1 : 0;
})().catch(e=>{ console.error('✘ verificador reventado:', e.message); process.exitCode=2; });
