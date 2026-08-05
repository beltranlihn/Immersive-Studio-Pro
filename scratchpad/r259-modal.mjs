import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise((res,rej)=>{const i=++id;p.set(i,r=>r.error?rej(new Error(JSON.stringify(r.error))):res(r.result.result.value));
  ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true}}));});
console.log('dialogos visibles: '+JSON.stringify(await ev(`[...document.querySelectorAll('dialog[open],.modal,.ovl,#confirmOv,#promptOv')].map(e=>({id:e.id,cls:e.className,txt:(e.textContent||'').slice(0,80)}))`)));
console.log('landing visible: '+await ev(`(function(){const l=document.getElementById('landing'); return l? getComputedStyle(l).display : 'no existe';})()`));
/* se prueba la apertura PASO A PASO para ver donde se cae */
const P='C:\\Users\\beltr\\Desktop\\Alma Digital Studio\\Projects\\Immersive Studio Pro\\scratchpad\\aud8b-rito-copia.isp';
console.log('DSP.readText devuelve: '+await ev(`DSP.readText('${P}').then(t=>t==null?'NULL':(t.length+' caracteres'))`));
console.log('confirmDiscard(true): '+await ev(`confirmDiscard(true)`));
console.log('hay autoguardado mas nuevo: '+await ev(`(async function(){ const st=await DSP.stat('${P}'); let best=null;
  const d='C:\\Users\\beltr\\Desktop\\Alma Digital Studio\\Projects\\Immersive Studio Pro\\scratchpad';
  for(const bp of [d+'\\autosave\\aud8b-rito-copia.isp','${P}']) for(const s of ['.autosave1','.autosave2']){
    try{ const q=await DSP.stat(bp+s); if(q&&q.size>2&&(!best||(q.mtimeMs||0)>best.t))best={p:bp+s,t:q.mtimeMs||0}; }catch(e){} }
  return best? (best.p+'  mas nuevo por '+Math.round(((best.t-(st.mtimeMs||0))/1000))+' s') : 'ninguno'; })()`));
ws.close();
