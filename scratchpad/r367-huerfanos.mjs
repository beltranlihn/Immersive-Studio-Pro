/* [R367] SONDA — la limpieza se lleva SOLO los proxies de otro tamaño.
   Planta señuelos en la carpeta real del proyecto y exige que sobreviva todo lo que debe sobrevivir:
   los proxies del tamaño de hoy, los de COMPOSICION (otro patron de nombre) y los `.part` a medio escribir.
   Sin esos controles, una limpieza demasiado glotona daria verde igualmente.
   Uso: npx electron . --remote-debugging-port=9222 · proyecto abierto · node scratchpad/r367-huerfanos.mjs */
import http from 'http'; import fs from 'fs'; import path from 'path';
const PX='/Users/vicentemanzano/Desktop/RITO DIGITAL MASTER/Film Rito Digital/Rito Dome/Rito Dome/Proxies';
const L=p=>new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:p},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)))}).on('error',rej)});
let url=null;
for(const t of (await L('/json/list')).filter(t=>t.type==='page'&&t.webSocketDebuggerUrl)){
  const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
  const v=await new Promise(r=>{ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id===1)r(m.result&&m.result.result&&m.result.result.value)};
    ws.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:"typeof limpiarProxiesDeOtroTamano==='function'",returnByValue:true}}))});
  ws.close(); if(v){url=t.webSocketDebuggerUrl;break;}
}
if(!url){console.error('editor sin R367');process.exit(2);}
const ws=new WebSocket(url); await new Promise(r=>ws.onopen=r);
let id=0; const pend=new Map();
ws.onmessage=e=>{const m=JSON.parse(e.data); if(pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id);}};
const send=(m,p={})=>new Promise((res,rej)=>{const i=++id;pend.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:p}))});
const ev=async(e,ms=300000)=>{const r=await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true,timeout:ms});
  if(r.exceptionDetails)throw new Error(r.exceptionDetails.text);return r.result.value};

const fallos=[]; const exigir=(ok,m)=>{console.log((ok?'  ✔ ':'  ✘ ')+m); if(!ok)fallos.push(m);};
const cuenta=()=>fs.readdirSync(PX).filter(f=>/^px_[0-9a-z]+_720\.mp4$/i.test(f)||/^pxi_[0-9a-z]+_1024\.png$/i.test(f)).length;

const reales=cuenta();
console.log('· proxies BUENOS antes de plantar nada:',reales);
const SENUELOS={
  'px_zzpar1_960.mp4'         : 'HUERFANO  (video de 960 CON su relevo de 720 al lado)',
  'px_zzpar1_720.mp4'         : 'control   (el relevo: tiene que quedarse)',
  'pxi_zzpar2_512.png'        : 'HUERFANO  (foto de 512 CON su relevo de 1024)',
  'pxi_zzpar2_1024.png'       : 'control   (el relevo)',
  'px_zzsolo_960.mp4'         : 'control   (960 SIN relevo: no se toca — [R367b])',
  'pxi_zzsolo_512.png'        : 'control   (512 SIN relevo: no se toca — [R367b])',
  'Ring 999 [2048x2048] 1.mp4': 'control   (proxy de COMPOSICION)',
  'px_zzparte_960.mp4.part'   : 'control   (a medio escribir)',
};
for(const f of Object.keys(SENUELOS)) fs.writeFileSync(path.join(PX,f), Buffer.alloc(2048,7));
console.log('· plantados',Object.keys(SENUELOS).length,'señuelos');
for(const [f,q] of Object.entries(SENUELOS)) exigir(fs.existsSync(path.join(PX,f)), 'existe antes: '+f+'  — '+q);

const n=await ev('limpiarProxiesDeOtroTamano()');
console.log('\n· la limpieza dice haber borrado',n,'archivos\n');
exigir(!fs.existsSync(path.join(PX,'px_zzpar1_960.mp4')),  'se lleva el video de 960 QUE TIENE relevo');
exigir(!fs.existsSync(path.join(PX,'pxi_zzpar2_512.png')), 'se lleva la foto de 512 QUE TIENE relevo');
exigir(fs.existsSync(path.join(PX,'px_zzsolo_960.mp4')),   '[R367b] RESPETA el 960 SIN relevo — borrarlo dejaria al medio sin proxy');
exigir(fs.existsSync(path.join(PX,'pxi_zzsolo_512.png')),  '[R367b] RESPETA el 512 SIN relevo');
exigir(fs.existsSync(path.join(PX,'px_zzpar1_720.mp4')),   'RESPETA el relevo de 720 (el tamaño de hoy)');
exigir(fs.existsSync(path.join(PX,'pxi_zzpar2_1024.png')), 'RESPETA el relevo de 1024');
exigir(fs.existsSync(path.join(PX,'Ring 999 [2048x2048] 1.mp4')), 'RESPETA el proxy de COMPOSICION');
exigir(fs.existsSync(path.join(PX,'px_zzparte_960.mp4.part')),  'RESPETA el .part a medio escribir');
exigir(n===2, 'borra EXACTAMENTE 2, ni uno mas — dice '+n);
exigir(cuenta()===reales+2, 'los '+reales+' proxies reales del proyecto siguen ahi (mas los 2 relevos del tamaño de hoy)');

for(const f of Object.keys(SENUELOS)){ try{ fs.unlinkSync(path.join(PX,f)); }catch(_){} }
console.log('\n· señuelos retirados · proxies reales:',cuenta());
exigir(cuenta()===reales, 'la carpeta queda como estaba: '+cuenta()+' proxies');
console.log('\n'+(fallos.length?'✘ '+fallos.length+' en rojo':'✔ todo verde'));
process.exit(fallos.length?1:0);
