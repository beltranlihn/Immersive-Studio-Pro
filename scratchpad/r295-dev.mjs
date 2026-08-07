/* [R295] En DESARROLLO, la app tiene que encontrar el binario de vendor/ffmpeg/<os>/ y no depender del PATH.
   Se comprueba mirando QUE ruta elige: si elige la vendorizada, en una maquina sin ffmpeg instalado tambien
   funcionara. Antes de este arreglo la candidata apuntaba a la ruta plana de antes de R294 y nunca acertaba. */
import http from 'http';
const t=await new Promise((r2,j)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>r2(JSON.parse(b)));}).on('error',j);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise((res,rej)=>{const i=++id;p.set(i,r=>r.error?rej(new Error(JSON.stringify(r.error))):(r.result.exceptionDetails?rej(new Error(r.result.exceptionDetails.exception?.description||'')):res(r.result.result.value)));ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true}}));});
let fallos=0; const mal=m=>{ console.log('   *** '+m); fallos++; };
const cap=await ev("DSP.ffProbe()");
if(!cap){ console.log('*** no encuentra ffmpeg en desarrollo'); process.exit(1); }
console.log('binario elegido en desarrollo: '+cap.path);
const ruta=String(cap.path||'').toLowerCase().split(String.fromCharCode(92)).join('/');
if(ruta.indexOf('/vendor/ffmpeg/win/')<0) mal('no esta usando el binario vendorizado: en una maquina sin ffmpeg en el PATH esto no funcionaria');
if(!cap.h264.some(e=>/nvenc/.test(e))) mal('sin NVENC');
console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'en desarrollo tambien usa el binario del repositorio'));
ws.close(); process.exit(fallos?1:0);
