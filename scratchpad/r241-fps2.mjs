/* [R241] ¿detecta ahora los 60 fps reales del material de Beltrán? Se importan los nueve clips en una app
   recién arrancada y se compara con lo que dice ffprobe (60/1 en los nueve). */
import http from 'http';
const PORT=process.argv[2]||9224;
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:PORT,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:900000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const DIR='C:\\Users\\beltr\\Desktop\\Alma Digital Studio\\Studio\\Reel 360\\Edit Reel 360\\Neurocosm 360';
const NOMS=['Neuro1_7196.mp4','Neuro2_7196.mp4','Neuro3_7196.mp4','Neuro4_7196.mp4','Neuro5_7196.mp4','Neuro6_7196.mp4','Neuro7_7196.mp4','Neuro8_7196.mp4','Neuro9_7196.mp4'];
await ev('window.__dir='+JSON.stringify(DIR)+'; window.__noms='+JSON.stringify(NOMS)+';1');
const r=await ev([
 '(async function(){ const o=[]; const sep=String.fromCharCode(92);',
 '  for(const n of window.__noms){ const t0=performance.now();',
 '    const m=await addVideoFromPath(window.__dir+sep+n,n);',
 '    await new Promise(r=>setTimeout(r,9000));',
 '    o.push({n, fps:m?m.fps:null, px:m?(m.w+"x"+m.h):null, ms:Math.round(performance.now()-t0)}); }',
 '  return { clips:o, aciertos60:o.filter(x=>x.fps===60).length, total:o.length }; })()'
].join('\n'));
console.log(JSON.stringify(r,null,1));
ws.close();
