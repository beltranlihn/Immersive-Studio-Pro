/* [R364] SONDA — al ABRIR un proyecto, el arbol de carpetas del panel de medios entra PLEGADO.
   ───────────────────────────────────────────────────────────────────────────────────────────────────────────
   Mide la CONCLUSION, no la premisa. La premisa seria «`collapsedGroups` tiene las claves puestas»; la
   conclusion es lo que el usuario VE: cuantas cabeceras de carpeta y cuantas filas de medio hay dibujadas en
   `#mediaList`. Con el arbol plegado, las subcarpetas y los medios de dentro NO estan en el DOM.

   Y SABE FALLAR. La fase 3 reconstruye el estado anterior al arreglo —`collapsedGroups={}` + `renderMedia()`,
   que es exactamente lo que pasaba al abrir antes de R364— y EXIGE que la medida cambie. Una sonda que no se
   ha visto roja no prueba nada.

   El proyecto de prueba se fabrica aqui (medios `kind:'text'`, que estan listos sin tocar el disco) y vive en
   `scratchpad/`, NUNCA sobre un proyecto de produccion: una sonda mia ya sobrescribio uno una vez.

   Uso:  matar la app instalada  →  npx electron . --remote-debugging-port=9222  →  node scratchpad/r364-carpetas-plegadas.mjs
*/
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const PORT = 9222;
const RAIZ = path.dirname(fileURLToPath(import.meta.url)); /* fileURLToPath y no `new URL(...).pathname`: la ruta del repo lleva un espacio y venia como %20 */
const ISP = path.join(RAIZ, 'r364-prueba.isp');

/* ── El proyecto de prueba: cuatro carpetas (dos de ellas anidadas) y cinco medios ───────────────────────── */
const CARPETAS = ['Video', 'Video/Camara A', 'Video/Camara B', 'Audio'];
const texto = (id, name, folder) => ({
  id, name, kind: 'text', w: 1920, h: 1080, dur: 6, fps: 0, color: '#4B84C4', folder,
  text: name, tfontSize: 120, tweight: '700', tfont: 'Inter, sans-serif',
  tcolor: '#ffffff', tbg: 'transparent', tstroke: false, tstrokeColor: '#000000',
});
fs.writeFileSync(ISP, JSON.stringify({
  app: 'DomeStudioPro', v: 4, fps: 60, lanes: null, playhead: 0,
  markers: [], groups: [], clips: [],
  media: [
    texto(101, 'Plano A', 'Video/Camara A'),
    texto(102, 'Plano B', 'Video/Camara A'),
    texto(103, 'Plano C', 'Video/Camara B'),
    texto(104, 'Musica', 'Audio'),
    texto(105, 'Suelto', null),
  ],
  workIn: null, workOut: null, folders: CARPETAS, folderColors: {},
  tl: { bpm: 120, sig: 4, tcMode: 'timecode', pxPerSec: 60, inlineCurves: false },
  exportPresets: [], seqW: 4096, seqH: 4096, reactive: null, autoItems: {},
}, null, 1));
console.log('· proyecto de prueba escrito:', ISP);

/* ── CDP ─────────────────────────────────────────────────────────────────────────────────────────────────── */
const lista = () => new Promise((res, rej) => {
  http.get({ host: '127.0.0.1', port: PORT, path: '/json/list' }, r => {
    let b = ''; r.on('data', c => b += c); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } });
  }).on('error', rej);
});

async function evalEn(url, expr, ms = 60000) {
  const ws = new WebSocket(url);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws no conecta')); });
  try {
    return await new Promise((res, rej) => {
      /* [trampa conocida] `awaitPromise` se cuelga SIN LIMITE si la promesa no resuelve: plazo propio siempre */
      const t = setTimeout(() => rej(new Error('CDP sin respuesta en ' + ms + ' ms')), ms);
      ws.onmessage = ev => {
        const m = JSON.parse(ev.data); if (m.id !== 1) return;
        clearTimeout(t);
        if (m.error) return rej(new Error('CDP: ' + JSON.stringify(m.error)));
        const r = m.result;
        if (r.exceptionDetails) return rej(new Error('la pagina reventó: ' +
          ((r.exceptionDetails.exception && (r.exceptionDetails.exception.description || r.exceptionDetails.exception.value)) || r.exceptionDetails.text)));
        res(r.result.value);
      };
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expr, awaitPromise: true, returnByValue: true, timeout: ms } }));
    });
  } finally { try { ws.close(); } catch (_) {} }
}

/* [trampa conocida] Hay MAS DE UNA pagina (arranque + editor). Se prueba cada una: la del editor es la que
   tiene `state`. Coger la primera de /json/list da «state is not defined». */
async function paginaEditor() {
  for (const t of (await lista()).filter(t => t.type === 'page' && t.webSocketDebuggerUrl)) {
    try { if (await evalEn(t.webSocketDebuggerUrl, 'typeof state!=="undefined" && !!state.media', 8000)) return t.webSocketDebuggerUrl; }
    catch (_) {}
  }
  return null;
}

const dormir = ms => new Promise(r => setTimeout(r, ms));

/* Lo que el usuario VE en el panel: cabeceras de carpeta y filas de medio dibujadas. */
const MEDIDA = `(()=>{ const L=document.querySelector('#mediaList'); if(!L)return {error:'sin #mediaList'};
  const hdr=[...L.querySelectorAll('.folderhdr')].map(h=>h.dataset.fname===undefined?'?':h.dataset.fname);
  return { vista: state.mediaView, cabeceras: hdr, filas: L.querySelectorAll('.mitem').length,
           medios: state.media.length, cargando: state.media.filter(m=>m._loading).length,
           carpetas: (state.folders||[]).slice(), plegadas: Object.keys(state.collapsedGroups||{}).filter(k=>state.collapsedGroups[k]) }; })()`;

const fallos = [];
const exigir = (ok, msg) => { console.log((ok ? '  ✔ ' : '  ✘ ') + msg); if (!ok) fallos.push(msg); };

(async () => {
  const pag = await paginaEditor();
  if (!pag) { console.error('✘ no encuentro la pagina del editor. ¿Lanzaste `npx electron . --remote-debugging-port=9222` y esperaste el arranque?'); process.exit(2); }
  console.log('· pagina del editor encontrada');

  /* ── FASE 1 · abrir el proyecto ────────────────────────────────────────────────────────────────────────── */
  console.log('\n[1] abriendo el proyecto de prueba');
  await evalEn(pag, `openProjectPath(${JSON.stringify(ISP)}, true)`, 120000);
  /* [trampa conocida] Las esperas se cumplen EN VACIO: exigir el numero de medios ESPERADO y que nada
     siga `_loading`, y que se MANTENGA varias muestras seguidas (el arranque puede pisar lo que cargues). */
  /* MEDIOS = los 5 del archivo + el nido de la secuencia que `ensureSequences()` crea al no traer ninguna.
     Ese nido no tiene carpeta, asi que cuenta como una fila mas de «sin archivar». */
  const N_MEDIOS = 6, FILAS_SUELTAS = 2;
  let est = 0, m = null;
  for (let i = 0; i < 60 && est < 3; i++) {
    await dormir(1000);
    m = await evalEn(pag, MEDIDA, 20000);
    est = (m.medios === N_MEDIOS && m.cargando === 0) ? est + 1 : 0;
  }
  if (est < 3) { console.error('✘ el proyecto no se estabilizó:', JSON.stringify(m)); process.exit(2); }
  console.log('  proyecto estable:', JSON.stringify(m));

  /* ── FASE 2 · la conclusion: el arbol entra PLEGADO ────────────────────────────────────────────────────── */
  console.log('\n[2] ¿entra plegado?');
  const plegado = m;
  exigir(plegado.vista === 'list', 'el panel abre en vista de lista (donde vive el arbol)');
  exigir(plegado.cabeceras.includes('Video') && plegado.cabeceras.includes('Audio'),
    'las carpetas de PRIMER nivel se ven (Video, Audio)');
  exigir(!plegado.cabeceras.includes('Video/Camara A') && !plegado.cabeceras.includes('Video/Camara B'),
    'las SUBcarpetas no estan dibujadas: su padre esta plegado');
  exigir(plegado.filas === FILAS_SUELTAS,
    'solo se dibujan las ' + FILAS_SUELTAS + ' filas SIN archivar, no las ' + N_MEDIOS + ' — hay ' + plegado.filas);
  exigir(CARPETAS.every(f => plegado.plegadas.includes('f_' + f)),
    'las CUATRO carpetas quedan marcadas como plegadas, tambien las hijas');

  /* ── FASE 3 · ¿sabe fallar? ────────────────────────────────────────────────────────────────────────────── */
  console.log('\n[3] control negativo — reconstruyo el estado ANTERIOR al arreglo');
  const antes = await evalEn(pag, `(()=>{ state.collapsedGroups={}; renderMedia(); return ${MEDIDA}; })()`, 30000);
  console.log('  con collapsedGroups={} (o sea, como antes de R364):', JSON.stringify({ cabeceras: antes.cabeceras, filas: antes.filas }));
  exigir(antes.filas === N_MEDIOS,
    'desplegado se dibujan las ' + N_MEDIOS + ' filas de medio: la medida SI distingue los dos estados — hay ' + antes.filas);
  exigir(antes.cabeceras.includes('Video/Camara A'), 'desplegado aparecen las subcarpetas');
  exigir(antes.filas !== plegado.filas, 'la sonda sabe fallar: plegado ' + plegado.filas + ' filas vs desplegado ' + antes.filas);

  /* El control negativo DEJA el arbol desplegado: hay que devolverlo a la linea de salida o las fases
     siguientes miden sobre el estado que acaba de romper esta. (Lo cazo la propia sonda en su primera pasada.) */
  const vuelta = await evalEn(pag, `(()=>{ plegarTodasLasCarpetas(); renderMedia(); return ${MEDIDA}; })()`, 30000);
  exigir(vuelta.filas === FILAS_SUELTAS, 'restaurada la linea de salida para las fases siguientes — hay ' + vuelta.filas + ' filas');

  /* ── FASE 4 · [R364b] buscar ATRAVIESA el plegado ──────────────────────────────────────────────────────── */
  console.log('\n[4] con el arbol plegado, ¿la busqueda encuentra lo de dentro?');
  const buscando = await evalEn(pag, `(()=>{ state.mediaQuery='Plano'; renderMedia(); return ${MEDIDA}; })()`, 30000);
  console.log('  buscando "Plano":', JSON.stringify({ cabeceras: buscando.cabeceras, filas: buscando.filas }));
  exigir(buscando.filas === 3, 'salen los 3 medios que casan («Plano A/B/C»), aunque vivan en carpetas plegadas — hay ' + buscando.filas);
  exigir(buscando.cabeceras.includes('Video/Camara A'), 'la busqueda destapa las subcarpetas donde estan las coincidencias');
  exigir(buscando.plegadas.length === 4, 'y NO desmarca nada: `collapsedGroups` sigue con las 4 (se destapa al dibujar, no mutando)');

  const trasBorrar = await evalEn(pag, `(()=>{ state.mediaQuery=''; renderMedia(); return ${MEDIDA}; })()`, 30000);
  exigir(trasBorrar.filas === FILAS_SUELTAS, 'al vaciar la caja el arbol se vuelve a plegar solo — hay ' + trasBorrar.filas + ' filas');

  /* ── FASE 5 · [R364b] renombrar/mover se lleva el plegado ──────────────────────────────────────────────── */
  console.log('\n[5] al renombrar una carpeta plegada, ¿se lleva su plegado?');
  /* `_reprefixFolders` es el nucleo COMPARTIDO por renombrar (renameFolderInline) y mover (moveFolder): es el
     punto exacto donde la clave se quedaba huerfana. */
  const tras = await evalEn(pag, `(()=>{ _reprefixFolders('Video','Cine'); renderMedia(); return ${MEDIDA}; })()`, 30000);
  console.log('  renombrada Video→Cine:', JSON.stringify({ cabeceras: tras.cabeceras, plegadas: tras.plegadas }));
  exigir(tras.plegadas.includes('f_Cine') && tras.plegadas.includes('f_Cine/Camara A'),
    'la clave viaja con la carpeta y con sus hijas');
  exigir(!tras.plegadas.some(k => k === 'f_Video' || k.indexOf('f_Video/') === 0),
    'no queda ninguna clave huerfana apuntando al nombre viejo');
  exigir(!tras.cabeceras.includes('Cine/Camara A'),
    'y sobre todo: la carpeta renombrada SIGUE plegada, no se despliega sola');

  console.log('\n' + (fallos.length ? '✘ ' + fallos.length + ' comprobacion(es) en rojo' : '✔ todo verde'));
  process.exit(fallos.length ? 1 : 0);
})().catch(e => { console.error('✘ sonda reventada:', e.message); process.exit(2); });
