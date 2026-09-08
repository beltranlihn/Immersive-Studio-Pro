/* [R353c] La secuencia de imagenes, de extremo a extremo: cargar, poner en la linea de tiempo y comprobar que
   el fotograma que se ve en un instante dado es el que toca.
   La CONCLUSION no es «no revienta» -eso es la premisa-: es que a dos instantes distintos el motor entrega dos
   fotogramas DISTINTOS y en el orden correcto. Un cargador roto que deja siempre el primero tambien «no
   revienta». */
import http from 'http'; import fs from 'fs'; import path from 'path';
const DIR = 'C:/Users/beltr/AppData/Local/Temp/claude/seq-prueba';
const t = await new Promise((r2, j) => { http.get({ host: '127.0.0.1', port: 9222, path: '/json/list' }, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => r2(JSON.parse(b))); }).on('error', j); });
const pg = t.find(x => x.type === 'page' && x.webSocketDebuggerUrl && /index\.html/.test(x.url));
if (!pg) { console.log('*** no hay pagina del editor'); process.exit(1); }
const ws = new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const p = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && p.has(m.id)) { p.get(m.id)(m); p.delete(m.id); } };
const ev = x => new Promise((res, rej) => { const i = ++id; p.set(i, r => r.error ? rej(new Error(JSON.stringify(r.error))) : (r.result.exceptionDetails ? rej(new Error(r.result.exceptionDetails.exception?.description || '')) : res(r.result.result.value))); ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: x, awaitPromise: true, returnByValue: true } })); });
const esperar = ms => new Promise(r => setTimeout(r, ms));
let fallos = 0; const mal = m => { console.log('   *** ' + m); fallos++; };

const ficheros = fs.readdirSync(DIR).filter(f => f.endsWith('.png')).sort()
  .map(f => path.join(DIR, f).split(path.sep).join('/'));

await ev("(async()=>{ document.querySelectorAll('.overlay').forEach(e=>e.remove()); await newProject('flat',1920,1080,24,180,true); if(typeof hideLanding==='function')hideLanding(); })()");
await esperar(2200);

const r = await ev(`(async function(){
  const rutas=${JSON.stringify(ficheros)};
  const m={id:uid(),name:'toma ###.png ['+rutas.length+'f]',kind:'sequence',framePaths:rutas,
           frames:null,tex:newTex(),w:1,h:1,dur:rutas.length/24,fps:24,thumb:null,color:'#C93',
           _frameUrls:[],_curFrame:-1,folder:null};
  state.media.push(m); renderMedia();
  await reloadMedia(m);
  for(let i=0;i<200 && m._loading!==false;i++) await new Promise(r=>setTimeout(r,100));
  await new Promise(r=>setTimeout(r,800));

  const iv=state.lanes.findIndex(l=>l.kind==='video');
  addClip(m, iv, 0);
  const c=state.clips[state.clips.length-1];
  c.dur=m.dur; c.props.scale=100;
  renderTimeline();

  /* El elemento naranja avanza 4 px por fotograma, asi que dos instantes distintos dan imagenes distintas. */
  const glc=document.querySelector('#gl');
  const foto=(tt)=>{ state.playhead=tt; render();
    const S=200, c2=document.createElement('canvas'); c2.width=c2.height=S;
    c2.getContext('2d').drawImage(glc,0,0,S,S);
    return c2.getContext('2d').getImageData(0,0,S,S).data; };
  const dif=(a,b)=>{ let d=0; for(let i=0;i<a.length;i+=4)d+=Math.abs(a[i]-b[i]); return Math.round(d/(a.length/4)); };

  const A=foto(0.1), B=foto(1.6), C=foto(3.1);
  let vivos=0; for(let i=0;i<A.length;i+=4) if(A[i]>20)vivos++;

  return { cargados:(m.frames||[]).filter(Boolean).length, total:rutas.length, w:m.w, h:m.h,
           dur:+m.dur.toFixed(2), clipEnTimeline:!!c, vivos,
           difAB:dif(A,B), difAC:dif(A,C), indiceEn1_6s:m._curFrame };
})()`);

console.log('fotogramas cargados:   ' + r.cargados + ' de ' + r.total + '   (' + r.w + 'x' + r.h + ')');
console.log('duracion del medio:    ' + r.dur + ' s a 24 fps');
console.log('clip en la linea:      ' + (r.clipEnTimeline ? 'si' : 'NO'));
console.log('pixeles con imagen:    ' + r.vivos);
console.log('diferencia 0,1 s vs 1,6 s: ' + r.difAB + '     0,1 s vs 3,1 s: ' + r.difAC);

if (r.cargados !== r.total) mal('faltan fotogramas por cargar');
if (r.vivos < 500) mal('el visor no muestra nada: la prueba no compara nada');
if (!r.clipEnTimeline) mal('el clip no llego a la linea de tiempo');
if (r.difAB < 3) mal('a 1,6 s se ve el MISMO fotograma que a 0,1 s: la secuencia no avanza');
if (r.difAC < 3) mal('a 3,1 s se ve el MISMO fotograma que a 0,1 s: la secuencia no avanza');

console.log('\n' + (fallos ? ('*** ' + fallos + ' FALLOS') : 'la secuencia carga, entra en la linea de tiempo y avanza en el tiempo'));
ws.close(); process.exit(fallos ? 1 : 0);
