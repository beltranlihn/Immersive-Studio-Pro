/* [R346] RED: un export 1:1 entrega fotogramas consecutivos, por los DOS caminos.

   El fallo que cierra: el bucle del export pide `t = t0 + i/fps`, y cuando la cadencia de salida es la de la
   fuente eso cae en el comienzo exacto de cada fotograma. Ahi tanto `keyForTime` (que compara contra
   `Math.floor(t_us)`) como Chromium por dentro se iban al fotograma ANTERIOR siempre que `i/fps` no fuese
   exacto en binario. Medido antes del arreglo, en un tramo seguido de 40 fotogramas a 24 fps: 13 repetidos y
   13 saltados. Un master que deberia ser fotograma a fotograma daba un tiron cada tres.

   CRITERIO SIN ORACULO, que es lo unico que lo caza: los dos caminos se equivocaban EN LO MISMO -0 diferencias
   entre ellos en 54 comparaciones-, asi que enfrentar el ClipDecoder con <video> sale "identico bit a bit", que
   es justo lo que concluyo R189. Aqui no se compara con nada: en un tramo seguido de un export 1:1 los
   fotogramas entregados tienen que ir DE UNO EN UNO.

   [R346b] Tres cosas que la revision encontro en esta red y que estaban de mas o de menos:

   1) EL JUEZ DEL REPLIEGUE ERA CIEGO A LA MITAD DEL SINTOMA. Comparaba pixeles entre lecturas consecutivas, o
      sea que sabia ver un fotograma REPETIDO y no sabia ver uno SALTADO — y el fallo medido eran 13 repetidos
      Y 13 saltados. Una regresion que devolviera solo los saltos la dejaba verde. Ahora los dos caminos se
      leen igual, por el fotograma que ENTREGAN: el ClipDecoder por el `timestamp` del VideoFrame que sube a la
      textura (envolviendo `upTex`, o sea observando la llamada de verdad), y el repliegue por el `mediaTime`
      de `requestVideoFrameCallback`, que es lo que las sondas hermanas de esta ronda ya usaban. De paso deja
      de depender de que el material se mueva, asi que el archivo de 60 fps -que es casi estatico- entra.
   2) EL CONTADOR NO SABIA VER UN FOTOGRAMA HACIA ATRAS. `rep` y `salt` no cubren un paso negativo, que es
      exactamente la regresion de 28,27 dB que cerro R344c (un vecino desalojado): la sucesion 90,91,92,91,92
      puntuaba perfecta. Se cuenta `atras` aparte, como ya hacia `r346-mapa-fotogramas.mjs`.
   3) NO RECOGIA. Dejaba el medio, el clip, la instancia con su `<video>` y su textura, y `_cdFail` puesto si
      algo lanzaba — y es la ultima red de la lista, asi que nadie limpiaba detras. Ahora todo va en `finally`.

   Y cubre los DOS archivos, cada uno con la cadencia que dice su demuxador: el caso de 60 fps (1 repetido y 2
   saltados antes del arreglo) no tenia red propia y los documentos decian que si.

   SABE FALLAR, y se comprueba en cada corrida: `vinstSeek` suma `TOL_DECOD` por dentro, asi que pedirle
   `t - TOL_DECOD` reconstruye EXACTAMENTE el estado anterior al arreglo sin tocar app.js. Si esa mitad no
   reproduce el fallo, la red no esta midiendo nada y lo dice (codigo 1), en vez de aprobar en vacio.

   Uso:  npx electron . --remote-debugging-port=9222   y luego  node scratchpad/r346-verif.mjs
   Codigos: 0 correcto · 1 fallo · 3 no medida (falta el material)
*/
import http from 'http';
import { existsSync } from 'fs';

const S = 'C:/Users/beltr/Desktop/Alma Digital Studio/Projects/Immersive Studio Pro/scratchpad/media/';
const ARCHIVOS = [S + 'tunel-control.mp4', S + 'gop240-60fps.mp4'];
const faltan = ARCHIVOS.filter(p => !existsSync(p));
if (faltan.length) {
  console.log('   NO MEDIDA: falta ' + faltan.join(', '));
  console.log('   Se rehace con:  node scratchpad/r344-material.mjs');
  process.exit(3);
}

const lista = await new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: 9222, path: '/json/list' }, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => res(JSON.parse(b))); }).on('error', rej); });
const pg = lista.find(x => x.type === 'page' && x.webSocketDebuggerUrl && /index\.html/.test(x.url));
if (!pg) { console.log('*** la app no esta escuchando en 9222'); process.exit(2); }
const ws = new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const ev = x => new Promise(r => { const i = ++id; pend.set(i, m => r(m.result && m.result.exceptionDetails ? ('EXC ' + (m.result.exceptionDetails.exception?.description || '').slice(0, 400)) : (m.result && m.result.result && m.result.result.value))); ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: x, awaitPromise: true, returnByValue: true, timeout: 150000 } })); });
const esperar = ms => new Promise(r => setTimeout(r, ms));

await ev(`(async()=>{ await newProject('dome',1024,1024,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()`);
await esperar(1200);

const PAGINA = (ruta) => `(async()=>{
  /* [R346c] La recogida se arma ANTES de coger nada. La version anterior asignaba restaurar despues de crear
     la textura, empujar el medio y llamar a addClip -que por dentro hace pushUndo, renderTimeline,
     renderInspector y un render() de GL-, asi que cualquier fallo en esa ventana dejaba el finally sin nada
     que llamar: exactamente la fuga que el encabezado dice cerrada. Ahora los huecos se rellenan segun se
     cogen y restaurar suelta lo que haya. */
  let m=null, c=null, v0=null, upOrig=null;
  const restaurar=()=>{
    try{ if(upOrig)upTex=upOrig; }catch(e){}
    try{ _exCD=false; }catch(e){}
    try{ if(m)m._cdFail=false; }catch(e){}
    try{ if(c)vinstDispose(c.id); }catch(e){}
    try{ if(m&&m.tex)gl.deleteTexture(m.tex); }catch(e){}
    try{ if(c){ const ic=state.clips.indexOf(c); if(ic>=0)state.clips.splice(ic,1); } }catch(e){}
    try{ if(m){ const im=state.media.indexOf(m); if(im>=0)state.media.splice(im,1); } }catch(e){}
    try{ if(v0){ v0.removeAttribute('src'); v0.load(); } }catch(e){}
    try{ renderMedia(); }catch(e){}
  };
  try{
  const RUTA=${JSON.stringify(ruta)}, I0=90, NUM=40;
  /* La cadencia sale del demuxador, no de una constante: la red cubre dos archivos de distinta cadencia. */
  const dd=await demuxMP4(RUTA); const fps=dd.fps||24; try{dd.close();}catch(e){}

  /* --- el medio y su clip, como los crea la aplicacion --- */
  const url=DSP.toFileURL(RUTA);
  v0=document.createElement('video'); v0.preload='metadata'; v0.src=url;
  await new Promise((res,rej)=>{ v0.addEventListener('loadedmetadata',()=>res()); v0.addEventListener('error',()=>rej(new Error('el medio no carga'))); });
  m={id:uid(),name:'r346',kind:'video',el:v0,originalEl:v0,srcUrl:url,tex:newTex(),w:v0.videoWidth,h:v0.videoHeight,
    dur:v0.duration,fps:fps,color:clipColorFor('video'),proxyReady:false,proxyPct:0,path:RUTA,fsize:0,folder:null,missing:false,_loading:false};
  state.media.push(m); renderMedia();
  addClip(m,0,0); c=state.clips[state.clips.length-1];
  if(!c) throw new Error('no se creo el clip');

  /* --- observar la llamada de VERDAD: que VideoFrame sube el codigo a la textura --- */
  upOrig=upTex; let ultimo=null, vistas=0;
  upTex=function(tex,src){ vistas++; if(src&&typeof src.timestamp==='number')ultimo=src.timestamp; return upOrig.apply(this,arguments); };

  const kDeUs=(us)=>us==null?null:Math.round(us/1e6*fps);
  const kDeSeg=(s)=>s==null?null:Math.round(s*fps);

  /* --- camino ClipDecoder, que es el del export --- */
  const porDecodificador=async(cancelarTol)=>{
    m._cdFail=false; vinstDispose(c.id);
    _exCD=true;
    const ks=[];
    try{
      for(let i=I0;i<I0+NUM;i++){
        const t=i/fps; ultimo=null;
        await vinstSeek(c,m,cancelarTol?(t-TOL_DECOD):t);
        ks.push(kDeUs(ultimo)); }
    } finally { _exCD=false; }
    return ks; };

  /* --- camino <video>, el repliegue: el fotograma PRESENTADO, por mediaTime --- */
  /* [R346c] _exCD=true TAMBIEN aqui. Con el a false, _useCD sale por su primera linea
     -if(!(_exCD||state.view.wcDecode))return false- y ni siquiera LEE _cdFail: el camino <video> se tomaba
     porque WebCodecs esta apagado en previsualizacion, no por el repliegue, y el guardia if(vi.cd) throw era
     inalcanzable dijera lo que dijera la bandera. Con los dos puestos se reproduce la configuracion de
     produccion que motivo toda la investigacion: export (_exCD) con el medio caido al repliegue (_cdFail),
     y el guardia pasa a significar algo. */
  const porVideo=async(cancelarTol)=>{
    vinstDispose(c.id);
    m._cdFail=true; _exCD=true;
    const ks=[]; let sinPresentar=0;
    try{
      /* CALENTAMIENTO, y no es un detalle: recien creado, el <video> presenta su primer fotograma por su
         cuenta, asi que la primera llamada de rVFC de la primera vuelta traia el fotograma 0 en vez del
         pedido — un salto de 89 que la red leia como fallo (y con I0=90 salia el mismo 90 en los dos
         archivos, que es lo que delato que era el instrumento y no el codigo). Con una posicion previa ya
         asentada, la unica presentacion nueva que queda es la que provoca el seek que se mide. */
      await vinstSeek(c,m,(I0-2)/fps);
      { const vi0=vinstEnsure(c,m); if(vi0&&vi0.vel){ let mm=null; const h0=vi0.vel.requestVideoFrameCallback((n,x)=>{mm=x;});
          const w0=performance.now(); while(!mm && performance.now()-w0<400) await new Promise(r=>setTimeout(r,2));
          if(!mm){ try{vi0.vel.cancelVideoFrameCallback(h0);}catch(e){} } } }
      for(let i=I0;i<I0+NUM;i++){
        const t=i/fps;
        const vi=vinstEnsure(c,m); if(!vi||!vi.vel) throw new Error('sin <video> en el repliegue');
        if(vi.cd) throw new Error('el repliegue no se activo: sigue habiendo ClipDecoder');
        const v=vi.vel;
        let meta=null; const h=v.requestVideoFrameCallback((now,mm)=>{ meta=mm; });
        await vinstSeek(c,m,cancelarTol?(t-TOL_DECOD):t);
        const t0=performance.now();
        while(!meta && performance.now()-t0<400) await new Promise(r=>setTimeout(r,2));
        if(!meta){ try{v.cancelVideoFrameCallback(h);}catch(e){} sinPresentar++; }
        /* Sin presentacion nueva es que sigue en pantalla el mismo fotograma: eso ES un repetido, y se
           arrastra el anterior para que la sucesion quede completa y el contador lo vea como tal. */
        ks.push(meta?kDeSeg(meta.mediaTime):(ks.length?ks[ks.length-1]:null)); }
    } finally { m._cdFail=false; _exCD=false; }
    return {ks:ks, sinPresentar:sinPresentar}; };

  /* rep + salt + atras: las TRES maneras de romper "de uno en uno". La de atras es la de R344c. */
  const cuenta=(ks)=>{ let rep=0, salt=0, atras=0, nulos=0;
    for(let i=0;i<ks.length;i++){ if(ks[i]==null){ nulos++; continue; }
      if(i>0&&ks[i-1]!=null){ const d=ks[i]-ks[i-1];
        if(d===0)rep++; else if(d<0)atras++; else if(d>1)salt+=d-1; } }
    return {rep:rep, salt:salt, atras:atras, nulos:nulos}; };

  const cdBien=await porDecodificador(false), cdMal=await porDecodificador(true);
  const vBien=await porVideo(false),          vMal=await porVideo(true);

  return JSON.stringify({ fps:+fps.toFixed(3), vistas:vistas, tol:TOL_DECOD,
    cd:{bien:cuenta(cdBien), mal:cuenta(cdMal)},
    vid:{bien:cuenta(vBien.ks), mal:cuenta(vMal.ks), n:vBien.ks.length,
         sinPresentar:vBien.sinPresentar, sinPresentarMal:vMal.sinPresentar} });
}catch(e){ return 'ERR '+String((e&&e.message)||e).slice(0,300);
} finally { try{ if(restaurar)restaurar(); }catch(e){} } })()`;

console.log('');
console.log('R346 - un export 1:1 entrega fotogramas consecutivos, por los dos caminos');
const malas = [];
for (const ruta of ARCHIVOS) {
  const nom = ruta.replace(/^.*\//, '');
  const r = await ev(PAGINA(ruta));
  let o = null;
  try { o = JSON.parse(r); } catch (e) { console.log('   *** ' + nom + ': ' + String(r).slice(0, 400)); malas.push(nom + ': la sonda no llego a medir'); continue; }

  /* [R346c] DOS criterios, no uno. `rotas` (que incluye `nulos`) dice si el tramo esta bien; `discrimina` NO
     incluye `nulos`, porque un instrumento averiado —el decodificador que se rinde y deja de entregar sellos,
     o el sondeo de rVFC agotando sus 400 ms— produce `nulos` y con el criterio unico eso bastaba para dar por
     buena la mitad de «esta red sabe fallar». O sea: una red sin poder de discriminacion se aprobaba a si
     misma. Que el estado anterior se reproduzca tiene que demostrarlo un REPETIDO o un SALTO, que es el fallo
     que se esta vigilando, no la ausencia de medida. */
  const rotas = x => x.rep + x.salt + x.atras + x.nulos;
  const discrimina = x => x.rep + x.salt + x.atras;
  console.log('   ' + nom + '  (' + o.fps + ' fps · tolerancia ' + (o.tol * 1e6).toFixed(1) + ' us · ' + o.vistas + ' subidas observadas)');
  console.log('      ClipDecoder  ARREGLADO: ' + o.cd.bien.rep + ' rep, ' + o.cd.bien.salt + ' salt, ' + o.cd.bien.atras + ' atras, ' + o.cd.bien.nulos + ' sin sello');
  console.log('      ClipDecoder  sin tolerancia (estado anterior): ' + o.cd.mal.rep + ' rep, ' + o.cd.mal.salt + ' salt, ' + o.cd.mal.atras + ' atras, ' + o.cd.mal.nulos + ' sin sello');
  console.log('      <video>      ARREGLADO: ' + o.vid.bien.rep + ' rep, ' + o.vid.bien.salt + ' salt, ' + o.vid.bien.atras + ' atras, ' + o.vid.bien.nulos + ' sin sello  (de ' + o.vid.n + ', ' + o.vid.sinPresentar + ' sin presentacion nueva)');
  console.log('      <video>      sin tolerancia (estado anterior): ' + o.vid.mal.rep + ' rep, ' + o.vid.mal.salt + ' salt, ' + o.vid.mal.atras + ' atras, ' + o.vid.mal.nulos + ' sin sello, ' + o.vid.sinPresentarMal + ' sin presentacion nueva');

  if (!o.vistas) malas.push(nom + ': no se observo ni una subida de textura, la red no ha medido nada');
  if (!(o.tol > 0)) malas.push(nom + ': TOL_DECOD es ' + o.tol + ', el arreglo no esta puesto');
  if (rotas(o.cd.bien)) malas.push(nom + ' ClipDecoder: el tramo NO es consecutivo (' + o.cd.bien.rep + ' rep, ' + o.cd.bien.salt + ' salt, ' + o.cd.bien.atras + ' atras, ' + o.cd.bien.nulos + ' sin sello)');
  if (rotas(o.vid.bien)) malas.push(nom + ' <video>: el tramo NO es consecutivo (' + o.vid.bien.rep + ' rep, ' + o.vid.bien.salt + ' salt, ' + o.vid.bien.atras + ' atras, ' + o.vid.bien.nulos + ' sin sello)');
  /* [R346c] El instrumento tiene que haber funcionado: en la corrida BUENA cada seek presenta un fotograma
     nuevo, asi que un `sinPresentar` distinto de cero es el sondeo de rVFC agotandose, no material repetido. */
  if (o.vid.sinPresentar) malas.push(nom + ' <video>: ' + o.vid.sinPresentar + ' seeks sin presentacion nueva en la corrida buena — el instrumento (rVFC) no esta midiendo');
  /* La otra mitad: si el estado anterior no se reproduce, esta red no discrimina y no vale como red. */
  if (!discrimina(o.cd.mal)) malas.push(nom + ': la red NO SABE FALLAR — sin la tolerancia el ClipDecoder sigue consecutivo');
  if (!discrimina(o.vid.mal)) malas.push(nom + ': la red NO SABE FALLAR — sin la tolerancia el repliegue <video> sigue consecutivo');
}

console.log('');
for (const x of malas) console.log('   *** ' + x);
if (!malas.length) console.log('   OK - los dos caminos consecutivos en los dos archivos, y los cuatro vuelven a fallar al cancelar la tolerancia.');
ws.close();
process.exitCode = malas.length ? 1 : 0;
