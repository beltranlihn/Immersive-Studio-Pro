/* [R256] El export corto que revisa Beltran. Sobre el .exe INSTALADO. Un clip en bucle de 0,4 s (12 fotogramas)
   durante 36 fotogramas = tres vueltas exactas: si el bucle cierra, los fotogramas 1-12, 13-24 y 25-36 son la
   misma serie repetida tres veces. Se exporta a PNG (fotograma exacto, sin ruido de codificador). */
import http from 'http'; import fs from 'fs'; import path from 'path'; import crypto from 'crypto';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:900000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const VID='C:/Users/beltr/Desktop/Alma Digital Studio/Code/Alma Digital Portfolio/Asset/Reel Portfolio/Reel Portfolio.mp4';
const N=36, FPS=30, SEGS=N/FPS, LOOP=0.4;
console.log('GPU: '+await ev(`(function(){const d=gl.getExtension('WEBGL_debug_renderer_info'); return d?gl.getParameter(d.UNMASKED_RENDERER_WEBGL):'?';})()`));
await ev(`(async()=>{ await newProject('dome',1024,1024,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()`); await wait(1400);
await ev(`window.__vid=function(ruta,nombre){ return new Promise(res=>{ const url=DSP.toFileURL(ruta); const v=document.createElement("video"); v.preload="metadata"; v.src=url;
  v.addEventListener("loadedmetadata",()=>{ const m={id:uid(),name:nombre,kind:"video",el:v,originalEl:v,srcUrl:url,tex:newTex(),w:v.videoWidth,h:v.videoHeight,dur:v.duration,fps:30,color:clipColorFor("video"),proxyReady:false,proxyPct:0,path:ruta,fsize:0,folder:null,missing:false,_loading:false};
    state.media.push(m); renderMedia(); res(1); }); v.addEventListener("error",()=>res(0)); }); };1`);
await ev(`__vid(${JSON.stringify(VID)},"reel.mp4")`);
const DIR=path.join(process.cwd(),'scratchpad','r256-entrega');
fs.rmSync(DIR,{recursive:true,force:true}); fs.mkdirSync(DIR,{recursive:true});
const t0=Date.now();
const r=await ev(`(async()=>{ state.clips=[];
  const V=state.media.find(m=>m.kind==='video'); const vl=state.lanes.findIndex(l=>l.kind==='video');
  const c=makeClip(V,vl,0); c.dur=${SEGS}; c.inP=4; c.props.el=90; c.props.size=90; state.clips.push(c);
  state.selId=c.id; state.selIds=[c.id]; toggleLoop(c); setLoopRange(c,${LOOP}); c.dur=${SEGS};
  renderTimeline(); render();
  const ui=ripProgress('R256','entrega',1);
  try{ await runExport({codec:'png',res:1024,fps:${FPS},range:'clips',rangeT:[0,${SEGS}],outW:1024,outH:1024,
                        outDir:${JSON.stringify(DIR)},silent:true,noAudio:true,job:ui.job}); }finally{ ui.close(); }
  return { cdFail:!!V._cdFail, inP:c.inP, loopLen:c.loopLen }; })()`);
const ms=Date.now()-t0;
function lista(d){ const o=[]; for(const e of fs.readdirSync(d,{withFileTypes:true})){ const q=d+'/'+e.name;
  if(e.isDirectory())o.push(...lista(q)); else if(/\.png$/i.test(e.name))o.push(q); } return o.sort(); }
const f=lista(DIR), sha=x=>crypto.createHash('sha1').update(fs.readFileSync(x)).digest('hex').slice(0,8);
console.log('\n'+f.length+' PNG a 1024x1024 en '+(ms/1000).toFixed(1)+' s ('+Math.round(ms/N)+' ms/fotograma)'
  +'   se rindio el decodificador: '+(r.cdFail?'SI':'no'));
console.log('carpeta: '+path.dirname(f[0]));
const s=f.map(sha);
console.log('\nvuelta 1 (1-12): '+s.slice(0,12).join(' '));
console.log('vuelta 2 (13-24): '+s.slice(12,24).join(' '));
console.log('vuelta 3 (25-36): '+s.slice(24,36).join(' '));
let ok=0; for(let i=0;i<12;i++) if(s[i]===s[i+12]&&s[i]===s[i+24])ok++;
console.log('\nfotogramas cuyas tres vueltas son IDENTICAS bit a bit: '+ok+' de 12');
ws.close();
