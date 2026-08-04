/* [R241] Confirma que el camino de decodificación SE EJERCITA (114 MB < LINK_MAX_BYTES=1,2 GB) y que
   tras el arreglo el clip queda marcado _noAudio sin dejar rechazos sueltos. */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9224,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:600000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const r=await ev([
 '(async function(){ window.__rej=[]; addEventListener("unhandledrejection",e=>__rej.push(String((e.reason&&e.reason.message)||e.reason)));',
 ' let m=state.media.find(x=>x.kind==="video"&&x.name==="Neuro1_7196.mp4"); if(!m){ const sep=String.fromCharCode(92); m=await addVideoFromPath("C:"+sep+"Users"+sep+"beltr"+sep+"Desktop"+sep+"Alma Digital Studio"+sep+"Studio"+sep+"Reel 360"+sep+"Edit Reel 360"+sep+"Neurocosm 360"+sep+"Neuro1_7196.mp4","Neuro1_7196.mp4"); } if(!m)return {err:"sin medio"};',
 ' const st=await DSP.stat(m.path);',
 ' delete m._noAudio; delete m._audioBusy; delete m.buffer;',
 ' const ok=await armMediaAudio(m);',
 ' await new Promise(r=>setTimeout(r,2500));',
 ' return { tamMB:Math.round(st.size/1048576), tope:LINK_MAX_BYTES/1e9+" GB", dentroDelTope:st.size<=LINK_MAX_BYTES,',
 '   armDevolvio:ok, marcadoSinAudio:!!m._noAudio, rechazosSinCapturar:window.__rej.slice(0,5) }; })()'
].join('\n'));
console.log(JSON.stringify(r,null,1));
ws.close();
