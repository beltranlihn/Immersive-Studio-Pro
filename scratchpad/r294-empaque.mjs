/* [R294] Que la app EMPAQUETADA use SU FFmpeg y no el del sistema. Es la diferencia entre funcionar aqui y
   funcionar en un equipo limpio. Se lanza el .exe instalado -no el de desarrollo- y se le pregunta. */
import http from 'http';
const t=await new Promise((r2,j)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>r2(JSON.parse(b)));}).on('error',j);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise((res,rej)=>{const i=++id;p.set(i,r=>r.error?rej(new Error(JSON.stringify(r.error))):(r.result.exceptionDetails?rej(new Error(r.result.exceptionDetails.exception?.description||'')):res(r.result.result.value)));ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true}}));});
let fallos=0; const mal=m=>{ console.log('   *** '+m); fallos++; };
const cap=await ev("DSP.ffProbe()");
if(!cap){ console.log('*** la app empaquetada NO encuentra ffmpeg'); process.exit(1); }
console.log('binario que usa: '+cap.path);
console.log('H.264: '+cap.h264.join(', '));
console.log('H.265: '+cap.hevc.join(', '));
/* La prueba real: que sea el de DENTRO de la app, no el que Beltran tiene en el PATH. En un equipo limpio no
   habria ninguno en el PATH, y si la app dependiera de eso no funcionaria. */
/* Sin expresion regular: los escapes de la barra invertida no sobreviven al paso por el interprete de
   ordenes y la comprobacion daba falso con la ruta CORRECTA delante. Comparar minusculas basta. */
const ruta=String(cap.path||'').toLowerCase().split(String.fromCharCode(92)).join('/');
if(ruta.indexOf('/resources/ffmpeg/')<0) mal('esta usando el del sistema ('+cap.path+'), no el empaquetado');
if(!cap.h264.some(e=>/nvenc/.test(e))) mal('el binario empaquetado no trae NVENC');
if(!cap.hevc.some(e=>/nvenc/.test(e))) mal('el binario empaquetado no trae HEVC por NVENC');
console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'la app empaquetada usa SU propio FFmpeg, con NVENC'));
ws.close();
/* [R295] Salir con codigo distinto de cero si algo fallo: imprimir «FALLOS» y devolver 0 hace que cualquier
   cosa que mire el codigo de salida -una tuberia, un gancho, un futuro yo con prisa- lea un fallo como un
   aprobado. Es la clase de prueba que da mas confianza de la que merece. */
process.exit(fallos?1:0);
