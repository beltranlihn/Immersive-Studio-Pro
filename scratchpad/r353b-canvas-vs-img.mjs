/* [R353b] Por que la misma secuencia mata un equipo y no otro.
   R353 refuto la sospecha inicial: 80 `Image` retenidos costaron 14 MB, no 320. Chromium no conserva el mapa de
   bits de un <img>; guarda el fichero codificado y descodifica cuando hace falta.
   Pero `fitImage` NO siempre devuelve el <img>: si la imagen supera `MAX_IMG` la redibuja en un CANVAS, y un
   canvas SI retiene su superficie. Y `MAX_IMG = min(8192, gl.MAX_TEXTURE_SIZE)` depende de la GPU del equipo.
   Aqui se miden las dos formas con el MISMO numero de fotogramas y el mismo tamano. */
import http from 'http';
const t = await new Promise((r2, j) => { http.get({ host: '127.0.0.1', port: 9222, path: '/json/list' }, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => r2(JSON.parse(b))); }).on('error', j); });
const pg = t.find(x => x.type === 'page' && x.webSocketDebuggerUrl && /index\.html/.test(x.url));
if (!pg) { console.log('*** no hay pagina del editor'); process.exit(1); }
const ws = new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const p = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && p.has(m.id)) { p.get(m.id)(m); p.delete(m.id); } };
const ev = x => new Promise((res, rej) => { const i = ++id; p.set(i, r => r.error ? rej(new Error(JSON.stringify(r.error))) : (r.result.exceptionDetails ? rej(new Error(r.result.exceptionDetails.exception?.description || '')) : res(r.result.result.value))); ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: x, awaitPromise: true, returnByValue: true } })); });
const esperar = ms => new Promise(r => setTimeout(r, ms));

const lim = await ev("({ MAX_IMG: (typeof MAX_IMG!=='undefined'?MAX_IMG:null), maxTex: gl.getParameter(gl.MAX_TEXTURE_SIZE) })");
console.log('este equipo:  MAX_TEXTURE_SIZE=' + lim.maxTex + '   MAX_IMG=' + lim.MAX_IMG);
console.log('=> aqui un fotograma de 4096 NO se convierte en canvas; en una GPU con limite 2048, SI.\n');

const medir = () => ev("(async()=>{ const m=await DSP.metrics(); return m.ramMB; })()");
const N = 80, S = 1024;

const prueba = async (nombre, expr) => {
  await ev("window._sujeto=null; if(window.gc)gc();");
  await esperar(1500);
  const antes = await medir();
  await ev(expr);
  await esperar(2500);
  const despues = await medir();
  console.log(nombre.padEnd(34) + (despues - antes) + ' MB');
  return despues - antes;
};

const teorico = Math.round(N * S * S * 4 / 1048576);
console.log('retener ' + N + ' fotogramas de ' + S + 'x' + S + ' descodificados costaria ' + teorico + ' MB\n');

const dImg = await prueba('retenidos como <img>:',
  `(async function(){ const a=[];
     for(let i=0;i<${N};i++){ const im=new Image(); im.src='data:image/svg+xml,'+encodeURIComponent(
       '<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}"><rect width="100%" height="100%" fill="rgb('+(i%255)+',80,40)"/></svg>');
       await im.decode().catch(()=>{}); a.push(im); }
     window._sujeto=a; return a.length; })()`);

const dCv = await prueba('retenidos como <canvas>:',
  `(function(){ const a=[];
     for(let i=0;i<${N};i++){ const c=document.createElement('canvas'); c.width=${S}; c.height=${S};
       const x=c.getContext('2d'); x.fillStyle='rgb('+(i%255)+',80,40)'; x.fillRect(0,0,${S},${S}); a.push(c); }
     window._sujeto=a; return a.length; })()`);

await ev("window._sujeto=null;");

console.log('\n--- lectura ---');
if (dCv > teorico * 0.5 && dImg < teorico * 0.4) {
  console.log('CONFIRMADO: el <canvas> retiene su superficie y el <img> no.');
  console.log('Una secuencia cuyos fotogramas pasen por `fitImage` a canvas retiene ancho x alto x 4 por CADA uno.');
  console.log('Con MAX_IMG bajo -GPU modesta- una secuencia normal se convierte entera en canvas y agota la memoria.');
} else {
  console.log('la diferencia entre las dos formas NO explica el consumo: img=' + dImg + ' MB, canvas=' + dCv + ' MB');
  console.log('hay que buscar la causa en otra parte.');
}
ws.close(); process.exit(0);
