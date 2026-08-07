/* [MANUAL] Los ultimos catalogos que solo existen DENTRO de un cuadro abierto: codecs de export, modos de sala,
   presets, tipos de composicion del cuadro y las herramientas de la barra lateral. */
import http from 'http'; import fs from 'fs';
const t=await new Promise((r2,j)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>r2(JSON.parse(b)));}).on('error',j);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise((res,rej)=>{const i=++id;p.set(i,r=>r.error?rej(new Error(JSON.stringify(r.error))):(r.result.exceptionDetails?rej(new Error(r.result.exceptionDetails.exception?.description||'')):res(r.result.result.value)));ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true}}));});
const esperar=ms=>new Promise(r=>setTimeout(r,ms));
const D={};
await ev("(async()=>{ document.querySelectorAll('.overlay,#exOv,#compOv').forEach(e=>e.remove()); await startDemoProject('dome'); await new Promise(r=>setTimeout(r,1800)); if(_tourStop)_tourStop(); openExport(); })()");
await esperar(2600);
D.codecs = await ev("[...document.querySelectorAll('#exCodec option')].map(o=>o.textContent.trim())");
D.calidad = await ev("[...document.querySelectorAll('#exOv [id*=Q] button, #exFfQ button')].map(b=>b.textContent.trim())");
D.tamPx   = await ev("[...document.querySelectorAll('#exOv .seg button')].map(b=>b.textContent.trim())");
D.filasExport = await ev("[...document.querySelectorAll('#exOv label, #exOv .frow>label')].map(l=>l.textContent.trim()).filter(Boolean)");
await ev("(function(){ document.querySelectorAll('.overlay,#exOv').forEach(e=>e.remove()); openCompose('domegrid'); })()");
await esperar(1800);
D.composeTipos = await ev("[...document.querySelectorAll('#compOv .kindseg button, #compOv [data-k]')].map(b=>(b.dataset&&b.dataset.k?b.dataset.k+' = ':'')+b.textContent.trim()).filter(Boolean)");
D.composeFilas = await ev("[...document.querySelectorAll('#compOv .frow')].map(r=>{const l=r.querySelector('label'); return (l?l.textContent.trim():'')+(r.dataset&&r.dataset.only?('   [solo '+r.dataset.only+']'):'');}).filter(Boolean)");
await ev("(function(){ try{if(typeof _cerrarComp==='function')_cerrarComp();}catch(e){} document.querySelectorAll('.overlay,#compOv').forEach(e=>e.remove()); })()");
D.herramientas = await ev("[...document.querySelectorAll('#toolRail button')].map(b=>(b.title||b.dataset.tool||'?'))");
D.visorBarra   = await ev("[...document.querySelectorAll('#dispSeg button')].map(b=>(b.title||b.dataset.d||'')+' / '+b.textContent.trim())");
fs.writeFileSync('docs/manual/build/datos2.json', JSON.stringify(D,null,1));
for(const k of Object.keys(D)) console.log('== '+k+' ==\n  '+(Array.isArray(D[k])?D[k].join('\n  '):JSON.stringify(D[k])));
ws.close(); process.exit(0);
