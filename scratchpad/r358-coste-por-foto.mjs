/* [R358] Cuanto cuesta HOY una foto importada suelta, con R357 dentro.
   R357 sube las texturas de foto reducidas a IMG_PREVIEW_MAX para previsualizar. La medicion de R353 se hizo
   con imagenes de 1024, justo el tope, asi que no podia ver el efecto: hay que medir donde R357 ACTUA.
   Se comprueban dos cosas distintas:
     1. Un HECHO del codigo: que tamano de textura elige `fitImage` para una imagen de 4096.
     2. Una MEDIDA: cuanta memoria pide el proceso por cada foto de 4096 importada suelta.
   La segunda sin la primera no distingue «R357 funciona» de «R357 no llega a este camino». */
import http from 'http'; import fs from 'fs'; import path from 'path';
const DIR = 'C:/Users/beltr/AppData/Local/Temp/claude/seq-4k';
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
const N = ficheros.length;

await ev("(async()=>{ document.querySelectorAll('.overlay').forEach(e=>e.remove()); await newProject('dome',2048,2048,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()");
await esperar(2500);

/* --- 1. el HECHO: que decide fitImage --- */
const hecho = await ev(`(async function(){
  const img=new Image(); img.src=DSP.toFileURL(${JSON.stringify(ficheros[0])});
  await img.decode();
  /* El tope viaja como SEGUNDO ARGUMENTO. La primera version lo omitia y medía un camino que en produccion
     no existe: daba 4096 y acusaba al codigo de no reducir. Sin acentos graves aqui dentro: estamos DENTRO
     de una plantilla y la cerrarian. */
  const fit=fitImage(img,IMG_PREVIEW_MAX);
  return { archivo:[img.naturalWidth,img.naturalHeight],
           medidasReales:[fit.w,fit.h],
           textura:[fit.tw||fit.w,fit.th||fit.h],
           IMG_PREVIEW_MAX:(typeof IMG_PREVIEW_MAX!=='undefined'?IMG_PREVIEW_MAX:null),
           MAX_IMG:(typeof MAX_IMG!=='undefined'?MAX_IMG:null) };
})()`);
console.log('archivo:            ' + hecho.archivo.join('x'));
console.log('medidas del medio:  ' + hecho.medidasReales.join('x') + '   (de aqui salen aspecto y equirect)');
console.log('TEXTURA que sube:   ' + hecho.textura.join('x') + '   (IMG_PREVIEW_MAX=' + hecho.IMG_PREVIEW_MAX + ', MAX_IMG=' + hecho.MAX_IMG + ')');
const texMB = hecho.textura[0] * hecho.textura[1] * 4 / 1048576;
const crudoMB = hecho.archivo[0] * hecho.archivo[1] * 4 / 1048576;
console.log('coste de esa textura: ' + texMB.toFixed(1) + ' MB   (sin reducir serian ' + crudoMB.toFixed(0) + ' MB)\n');

if (hecho.medidasReales[0] !== hecho.archivo[0]) mal('las medidas del medio ya no son las del archivo: aspecto y equirect dependen de ellas');

/* --- 2. la MEDIDA: memoria por foto suelta --- */
const medir = () => ev("(async()=>{ const m=await DSP.metrics(); return m.ramMB; })()");
const antes = await medir();
await ev(`(async function(){
  for(const fp of ${JSON.stringify(ficheros)}){
    const img=new Image(); img.src=DSP.toFileURL(fp);
    await img.decode().catch(()=>{});
    const fit=fitImage(img,IMG_PREVIEW_MAX);
    const m={id:uid(),name:fp.split('/').pop(),kind:'image',el:fit.src,originalEl:img,tex:newTex(),
             w:fit.w,h:fit.h,_texTope:IMG_PREVIEW_MAX,dur:5,fps:0,color:'#C93',folder:null,path:fp};
    upTex(m.tex,fit.src); if(typeof mipTex==='function')mipTex(m.tex,fit.tw||fit.w,fit.th||fit.h);
    state.media.push(m);
  }
  renderMedia(); render(); return state.media.length; })()`);
await esperar(3500);
const despues = await medir();
const delta = despues - antes;
const porFoto = delta / N;

console.log(N + ' fotos de 4096x4096 importadas SUELTAS');
console.log('memoria del proceso: +' + delta + ' MB   ->  ' + porFoto.toFixed(1) + ' MB por foto');
console.log('sin la reduccion de R357 cada una costaria al menos ' + crudoMB.toFixed(0) + ' MB de textura\n');

console.log('--- que significa para un proyecto real ---');
for (const n of [100, 300, 600]) {
  console.log('  ' + String(n).padStart(3) + ' fotos sueltas  ->  ' + (n * porFoto / 1024).toFixed(1) + ' GB');
}

console.log('\n--- lectura ---');
if (texMB < crudoMB * 0.5) {
  console.log('R357 ACTUA: la textura de previsualizacion baja de ' + crudoMB.toFixed(0) + ' a ' + texMB.toFixed(1) + ' MB.');
} else {
  mal('la textura NO se esta reduciendo: R357 no llega a este camino');
}
if (porFoto > 12) console.log('AUN ASI cada foto cuesta ' + porFoto.toFixed(1) + ' MB: cientos de fotos sueltas siguen siendo un problema.');
else console.log('Con ' + porFoto.toFixed(1) + ' MB por foto, unos cientos de fotos ya no agotan la memoria.');
console.log(fallos ? ('*** ' + fallos + ' FALLOS') : 'medicion valida');
ws.close(); process.exit(fallos ? 1 : 0);
