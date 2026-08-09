/* [R346] Comprobacion del BANCO, no del codigo: r346-video-carrera midio 0 de diferencia entre fotogramas
   vecinos en material que R344 midio con 14,0. O el material no se mueve, o mis draws no dibujan nada.
   Sin esto, todo lo que diga el probe es un aprobado vacio. */
import http from 'http';
const S = 'C:/Users/beltr/Desktop/Alma Digital Studio/Projects/Immersive Studio Pro/scratchpad/media/';
const RUTA = process.argv[2] || (S + 'tunel-control.mp4');

const lista = await new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: 9222, path: '/json/list' }, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => res(JSON.parse(b))); }).on('error', rej); });
const pg = lista.find(x => x.type === 'page' && /index\.html/.test(x.url));
if (!pg) { console.log('*** la app no esta escuchando en 9222'); process.exit(2); }
const ws = new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const ev = x => new Promise(r => { const i = ++id; pend.set(i, m => r(m.result && m.result.exceptionDetails ? ('EXC ' + (m.result.exceptionDetails.exception?.description || '').slice(0, 400)) : (m.result && m.result.result && m.result.result.value))); ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: x, awaitPromise: true, returnByValue: true, timeout: 120000 } })); });

const r = await ev(`(async()=>{ let v=null; try{
  const RUTA=${JSON.stringify(RUTA)}, CW=320, CH=180;
  v=document.createElement('video'); v.src=DSP.toFileURL(RUTA); v.muted=true; v.playsInline=true; v.preload='auto';
  await new Promise((res,rej)=>{ v.onloadeddata=()=>res(); v.onerror=()=>rej(new Error('no carga')); });
  const c=document.createElement('canvas'); c.width=CW; c.height=CH; const x=c.getContext('2d',{willReadFrequently:true});
  const pix=()=>{ x.clearRect(0,0,CW,CH); x.drawImage(v,0,0,CW,CH); const d=x.getImageData(0,0,CW,CH).data;
    let s=0; for(let i=0;i<d.length;i+=4)s+=d[i]+d[i+1]+d[i+2]; return {d:d, luma:+(s/(d.length/4*3)).toFixed(2)}; };
  const seek=(t)=>new Promise(res=>{ const on=()=>{ v.removeEventListener('seeked',on); res(); }; v.addEventListener('seeked',on); v.currentTime=t; });
  const dif=(a,b)=>{ let s=0; for(let i=0;i<a.length;i+=4)s+=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]); return +(s/(a.length/4*3)).toFixed(3); };
  const filas=[]; let prev=null;
  for(const t of [1.0, 1.0416666, 2.0, 3.0, 5.0]){
    await seek(t); const p=pix();
    filas.push({t:t, ct:+v.currentTime.toFixed(4), rs:v.readyState, w:v.videoWidth, h:v.videoHeight, luma:p.luma, difPrev:prev?dif(prev,p.d):null});
    prev=p.d; }
  return JSON.stringify(filas);
}catch(e){ return 'ERR '+String((e&&e.message)||e).slice(0,300); } finally { try{ if(v){v.removeAttribute('src');v.load();} }catch(e){} } })()`);
console.log('');
console.log('R346 check - ' + RUTA.replace(/^.*\//, ''));
try { for (const f of JSON.parse(r)) console.log('   t=' + String(f.t).padEnd(10) + ' ct=' + String(f.ct).padEnd(8) + ' readyState=' + f.rs + ' ' + f.w + 'x' + f.h + '  luma=' + String(f.luma).padStart(7) + '  dif con el anterior: ' + f.difPrev); }
catch (e) { console.log('   *** ' + String(r).slice(0, 400)); }
ws.close();
