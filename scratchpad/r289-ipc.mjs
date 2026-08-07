/* [R289] Aislar el IPC. Se manda a un sumidero (-f null): sin codificar y sin escribir a disco, lo unico que
   queda medido es el viaje renderer -> proceso principal. Se prueban los dos tamanos que importan: 64 MB (RGBA,
   lo de ahora) y 24 MB (NV12, a donde iriamos). Si el tiempo cae en proporcion, NV12 sirve; si apenas baja, el
   coste es por LLAMADA y habria que cambiar de camino, no de tamano. */
import http from 'http';
const t=await new Promise((r2,j)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>r2(JSON.parse(b)));}).on('error',j);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise((res,rej)=>{const i=++id;p.set(i,r=>r.error?rej(new Error(JSON.stringify(r.error))):(r.result.exceptionDetails?rej(new Error(r.result.exceptionDetails.exception?.description||'')):res(r.result.result.value)));ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true}}));});
const r=await ev(`(async function(){
  const out=[];
  const casos=[ {n:'RGBA 4096 (hoy)', bytes:4096*4096*4, args:['-f','rawvideo','-pix_fmt','rgba','-s','4096x4096','-r','30','-i','-']},
                {n:'NV12 4096 (meta)', bytes:4096*4096*3/2, args:['-f','rawvideo','-pix_fmt','nv12','-s','4096x4096','-r','30','-i','-']} ];
  for(const c of casos){
    const st=await DSP.ffStart(['-hide_banner','-loglevel','error','-y'].concat(c.args).concat(['-f','null','-']),'nul');
    if(!st||!st.id){ out.push({n:c.n,err:(st&&st.err)||'no arranco'}); continue; }
    const buf=new Uint8Array(c.bytes);
    await DSP.ffWrite(st.id,buf);                     /* calentamiento */
    const M=10, t0=performance.now();
    for(let i=0;i<M;i++) await DSP.ffWrite(st.id,buf);
    const ms=(performance.now()-t0)/M;
    await DSP.ffEnd(st.id);
    out.push({n:c.n, mb:+(c.bytes/1048576).toFixed(1), ms:+ms.toFixed(1), mbps:Math.round(c.bytes/1048576/(ms/1000))});
  }
  return out; })()`);
for(const c of r){ if(c.err){ console.log(c.n+': *** '+c.err); continue; }
  console.log(c.n.padEnd(20)+c.mb+' MB  ->  '+c.ms+' ms por fotograma  ('+c.mbps+' MB/s)'); }
if(r.length===2&&!r[0].err&&!r[1].err){
  const prop=r[0].bytes/r[1].bytes, real=r[0].ms/r[1].ms;
  console.log('\nbytes: '+(r[0].mb/r[1].mb).toFixed(2)+'x mas en RGBA   ·   tiempo: '+real.toFixed(2)+'x mas');
  console.log(real>2.0 ? '=> el coste es POR BYTE: NV12 lo baja en proporcion y es el camino'
    : real<1.3 ? '=> el coste es POR LLAMADA: NV12 no arregla nada, hay que cambiar de camino (socket)'
    : '=> mezcla de las dos cosas: NV12 ayuda pero no basta');
}
ws.close();
