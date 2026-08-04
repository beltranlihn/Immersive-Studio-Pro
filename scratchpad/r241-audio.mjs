/* [R241] Un clip SIN pista de audio no debe dejar rechazos sin capturar. */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9224,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:600000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
await ev("window.__rej=[];addEventListener('unhandledrejection',e=>__rej.push(String((e.reason&&e.reason.message)||e.reason)));1");
const DIR='C:\Users\beltr\Desktop\Alma Digital Studio\Studio\Reel 360\Edit Reel 360\Neurocosm 360';
await ev('window.__d='+JSON.stringify(DIR)+';1');
const r=await ev([
 '(async function(){ const sep=String.fromCharCode(92); const ns=["Neuro1_7196.mp4","Neuro2_7196.mp4","Neuro3_7196.mp4"];',
 ' const ms=[]; for(const n of ns){ const m=await addVideoFromPath(window.__d+sep+n,n); ms.push(m); }',
 ' await new Promise(r=>setTimeout(r,2000));',
 ' for(const m of ms){ if(m) await armMediaAudio(m); }',
 ' await new Promise(r=>setTimeout(r,2500));',
 ' return { clips:ms.length, sinAudioMarcado:ms.filter(m=>m&&m._noAudio).length, rechazosSinCapturar:window.__rej.slice(0,8) }; })()'
].join('\n'));
console.log(JSON.stringify(r,null,1));
ws.close();
