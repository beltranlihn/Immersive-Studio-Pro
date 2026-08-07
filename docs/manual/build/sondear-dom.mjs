/* [MANUAL] Lista los controles reales de cada zona de la interfaz, con su selector, para poder NUMERARLOS sobre
   las capturas. Adivinar selectores produce marcas que apuntan a nada. */
import http from 'http';
const t=await new Promise((r2,j)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>r2(JSON.parse(b)));}).on('error',j);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise((res,rej)=>{const i=++id;p.set(i,r=>r.error?rej(new Error(JSON.stringify(r.error))):(r.result.exceptionDetails?rej(new Error(r.result.exceptionDetails.exception?.description||'')):res(r.result.result.value)));ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true}}));});

await ev("(async()=>{ document.querySelectorAll('.overlay,#compOv,#srcMon,#exOv').forEach(e=>e.remove()); await startDemoProject('dome'); await new Promise(r=>setTimeout(r,1800)); if(_tourStop)_tourStop(); document.querySelector('#viewModeSeg button[data-v=\"2d\"]').click(); })()");
await new Promise(r=>setTimeout(r,3000));

const zonas={
  'barra del visor':'#stage',
  'transport':'.transport',
  'cabecera de medios':'#mediaPane',
  'inspector':'#inspPane',
  'barra superior':'#topbar,.topbar,#menubar',
};
for(const [nombre,sel] of Object.entries(zonas)){
  const r=await ev(`(function(){ const z=document.querySelector('${sel.split(',')[0]}'); if(!z)return null;
    const raiz=z.parentElement||z;
    const out=[];
    for(const e of raiz.querySelectorAll('[id],button,.seg,.well,.iosw')){
      const b=e.getBoundingClientRect(); if(b.width<6||b.height<6)continue;
      const et=(e.textContent||'').trim().replace(/\\s+/g,' ').slice(0,26);
      out.push((e.id?('#'+e.id):('.'+(e.className||'').toString().split(' ')[0]))+'  ['+e.tagName.toLowerCase()+']  "'+et+'"  '+
        Math.round(b.x)+','+Math.round(b.y)+' '+Math.round(b.width)+'x'+Math.round(b.height));
    }
    return out.slice(0,60); })()`);
  console.log('\n===== '+nombre+' =====');
  console.log((r||['(no encontrado)']).join('\n'));
}
ws.close(); process.exit(0);
