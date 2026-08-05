/* [R259] Que forma de ruta acepta DSP.readText. Escrito con la herramienta Write, NO por heredoc: el shell se
   come las barras invertidas y eso ya ha costado tres intentos. */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise((res,rej)=>{const i=++id;p.set(i,r=>r.error?rej(new Error(JSON.stringify(r.error))):res(r.result.result.value));
  ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true}}));});

const base='C:/Users/beltr/Desktop/Alma Digital Studio/Projects/Immersive Studio Pro/scratchpad/aud8b-rito-copia.isp';
const variantes=[['barras normales', base], ['barras invertidas', base.split('/').join('\\')]];
for(const [etiqueta,ruta] of variantes){
  const r=await ev(`(async()=>{ try{ const t=await DSP.readText(${JSON.stringify(ruta)}); return t==null?'NULL':(t.length+' caracteres'); }catch(e){ return 'EXCEPCION '+e.message; } })()`);
  console.log('  '+etiqueta.padEnd(22)+r);
}
console.log('  DSP.stat: '+JSON.stringify(await ev(`DSP.stat(${JSON.stringify(base)}).then(s=>s?{size:s.size}:'null').catch(e=>'exc '+e.message)`)));
console.log('  metodos de DSP: '+String(await ev(`Object.keys(DSP).join(', ')`)).slice(0,260));
ws.close();
