/* [R353d] La tercera hipotesis, y la unica que el codigo sostiene.
   Una SECUENCIA usa UNA textura y va cambiandole el contenido (`upTex(m.tex, m.frames[idx])`, drawClip).
   Las mismas imagenes importadas SUELTAS crean UN MEDIO CON SU PROPIA TEXTURA CADA UNA.
   Una textura si es memoria retenida de verdad -y ademas en la GPU-. Se mide `gpuMemUsed` en los dos casos. */
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

const ficheros = fs.readdirSync(DIR).filter(f => f.endsWith('.png')).sort()
  .map(f => path.join(DIR, f).split(path.sep).join('/'));
const N = ficheros.length, S = 1024;
console.log(N + ' imagenes de ' + S + 'x' + S + '.  Una textura RGBA cuesta ' + (S * S * 4 / 1048576).toFixed(1) + ' MB.');
console.log('si cada imagen lleva la suya: ' + Math.round(N * S * S * 4 / 1048576) + ' MB de GPU.\n');

const gpu = () => ev("(async()=>{ const m=await DSP.metrics(); return {gpu:m.gpuMemUsed||0, ram:m.ramMB}; })()");

const limpio = async () => {
  await ev("(async()=>{ document.querySelectorAll('.overlay').forEach(e=>e.remove()); await newProject('flat',1920,1080,24,180,true); if(typeof hideLanding==='function')hideLanding(); })()");
  await esperar(2500);
};

/* --- A: como SECUENCIA (una textura) --- */
await limpio();
const a0 = await gpu();
await ev(`(async function(){
  const rutas=${JSON.stringify(ficheros)};
  const m={id:uid(),name:'sec',kind:'sequence',framePaths:rutas,frames:null,tex:newTex(),w:1,h:1,
           dur:rutas.length/24,fps:24,thumb:null,color:'#C93',_frameUrls:[],_curFrame:-1,folder:null};
  state.media.push(m); await reloadMedia(m);
  for(let i=0;i<200 && m._loading!==false;i++) await new Promise(r=>setTimeout(r,100));
  return 1; })()`);
await esperar(3000);
const a1 = await gpu();
const texSec = await ev("state.media.filter(m=>m.tex).length");
console.log('SECUENCIA   -> texturas de medio: ' + texSec + '   GPU: +' + (a1.gpu - a0.gpu) + ' MB   RAM: +' + (a1.ram - a0.ram) + ' MB');

/* --- B: como imagenes SUELTAS (una textura por imagen) --- */
await limpio();
const b0 = await gpu();
await ev(`(async function(){
  const rutas=${JSON.stringify(ficheros)};
  for(const fp of rutas){
    const img=new Image(); img.src=DSP.toFileURL(fp);
    await img.decode().catch(()=>{});
    const fit=fitImage(img);
    const m={id:uid(),name:fp.split('/').pop(),kind:'image',el:fit.src,originalEl:fit.src,tex:newTex(),
             w:fit.w,h:fit.h,dur:5,fps:0,color:'#C93',folder:null,path:fp};
    upTex(m.tex,fit.src); state.media.push(m);
  }
  renderMedia(); return state.media.length; })()`);
await esperar(3000);
const b1 = await gpu();
const texSueltas = await ev("state.media.filter(m=>m.tex).length");
console.log('SUELTAS     -> texturas de medio: ' + texSueltas + '   GPU: +' + (b1.gpu - b0.gpu) + ' MB   RAM: +' + (b1.ram - b0.ram) + ' MB');

const teorico = Math.round(N * S * S * 4 / 1048576);
console.log('\n--- lectura ---');
console.log('coste teorico de ' + N + ' texturas: ' + teorico + ' MB');
if ((b1.gpu - b0.gpu) > (a1.gpu - a0.gpu) + teorico * 0.4) {
  console.log('CONFIRMADO: importar las imagenes SUELTAS cuesta una textura por imagen; como SECUENCIA, una sola.');
  console.log('Con fotogramas de 4096x4096, cada textura son 64 MB: 300 imagenes sueltas piden ' + Math.round(300 * 64) + ' MB de GPU.');
} else {
  console.log('la diferencia medida NO alcanza para explicar un agotamiento de memoria:');
  console.log('  secuencia +' + (a1.gpu - a0.gpu) + ' MB de GPU, sueltas +' + (b1.gpu - b0.gpu) + ' MB.');
  console.log('El contador de GPU del sistema puede no reflejar las texturas de este proceso; el numero de');
  console.log('TEXTURAS (' + texSec + ' frente a ' + texSueltas + ') si es un hecho del codigo, y esa es la diferencia estructural.');
}
ws.close(); process.exit(0);
