/* [R353] Cuanta memoria retiene una SECUENCIA DE IMAGENES.
   El amigo de Beltran importo una y el editor murio por falta de memoria. La sospecha: `m.frames` guarda TODOS
   los fotogramas ya descodificados, a la vez y para siempre.
   Se mide el consumo real del proceso (dsp.metrics -> workingSetSize) antes y despues de cargar N fotogramas y
   se compara con lo que costaria retenerlos todos descodificados: N x ancho x alto x 4.
   La CONCLUSION no es «gasta memoria» -eso es la premisa-: es si el gasto ESCALA con el numero de fotogramas. */
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
console.log('fotogramas en disco: ' + ficheros.length);

await ev("(async()=>{ await newProject('dome',2048,2048,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()");
await esperar(2200);

const medir = () => ev("(async()=>{ const m=await DSP.metrics(); return m.ramMB; })()");
const base = await medir();
console.log('memoria del proceso antes:   ' + base + ' MB');

const r = await ev(`(async function(){
  const rutas=${JSON.stringify(ficheros)};
  const m={id:uid(),name:'prueba ###.png ['+rutas.length+'f]',kind:'sequence',framePaths:rutas,
           frames:null,tex:newTex(),w:1,h:1,dur:rutas.length/24,fps:24,thumb:null,color:'#C93',
           _frameUrls:[],_curFrame:-1,folder:null};
  state.media.push(m);
  const t0=performance.now();
  await reloadMedia(m);
  for(let i=0;i<200 && m._loading!==false;i++) await new Promise(r=>setTimeout(r,100));
  await new Promise(r=>setTimeout(r,1500));
  const vivos=(m.frames||[]).filter(Boolean).length;
  const w=m.w||0,h=m.h||0;
  return { vivos, total:rutas.length, w, h, ms:Math.round(performance.now()-t0), bytes:vivos*w*h*4 };
})()`);

await esperar(2500);
const despues = await medir();
const delta = despues - base;
const teorico = Math.round(r.bytes / 1048576);
console.log('fotogramas retenidos:        ' + r.vivos + ' de ' + r.total + '   (' + r.w + 'x' + r.h + ')');
console.log('memoria del proceso despues: ' + despues + ' MB   (subida: ' + delta + ' MB)');
console.log('coste teorico de retenerlos todos descodificados: ' + teorico + ' MB');
console.log('tiempo de carga: ' + r.ms + ' ms');

if (r.vivos !== r.total) mal('no se cargaron todos los fotogramas: la medida no vale');
if (r.w < 64) mal('los fotogramas no llegaron a medir: la prueba no mide nada');

if (delta < teorico * 0.45) {
  console.log('\nla memoria NO escala con los fotogramas (' + delta + ' MB frente a ' + teorico + ' MB): la causa es otra');
} else {
  const cuatroK = Math.round(300 * 4096 * 4096 * 4 / 1048576);
  console.log('\nCONFIRMADO: la memoria escala con el numero de fotogramas.');
  console.log('Una secuencia de 300 fotogramas de 4096x4096 pediria ' + cuatroK + ' MB solo en fotogramas.');
}
console.log(fallos ? ('*** ' + fallos + ' FALLOS') : 'medicion valida');
ws.close(); process.exit(fallos ? 1 : 0);
