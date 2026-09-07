/* [R357] ¿El proxy de foto toca la ENTREGA? Se dibuja un fotograma de export con una imagen grande y se
   vuelca su huella. Debe ser IDENTICA con y sin el cambio; la PREVISUALIZACION, en cambio, debe diferir
   -si no difiere, el proxy no esta actuando y la sonda no prueba nada-. */
import http from 'http';
const ETIQ=process.argv[2]||'?', FOTO=process.argv[3];
const lista=()=>new Promise((r2,rj)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>r2(JSON.parse(b)));}).on('error',rj);});
const probar=async(u)=>{ const w=new WebSocket(u); try{ await new Promise((ok,mal)=>{w.onopen=ok;w.onerror=mal;setTimeout(()=>mal(new Error('t')),4000);}); }catch(e){ return null; }
  const res=await new Promise(ok=>{ w.onmessage=e=>{const m=JSON.parse(e.data); if(m.id===1)ok(m);};
    w.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:'typeof state!=="undefined" && !!state.media',returnByValue:true}}));
    setTimeout(()=>ok(null),5000); });
  if(res&&res.result&&res.result.result&&res.result.result.value===true) return w;
  try{w.close();}catch(e){} return null; };
let ws=null;
for(let k=0;k<40&&!ws;k++){ const t=await lista();
  for(const pg of t.filter(x=>x.type==='page'&&x.webSocketDebuggerUrl)){ ws=await probar(pg.webSocketDebuggerUrl); if(ws)break; }
  if(!ws) await new Promise(r=>setTimeout(r,3000)); }
if(!ws){ console.log('sin ventana de editor'); process.exit(1); }
let id=1;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async(x,ms=300000)=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:ms});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
await ev('(async()=>{try{await startDemoProject("dome");}catch(e){}})()'); await wait(2600);
await ev('(function(){try{if(typeof _tourStop==="function")_tourStop();const o=document.getElementById("tourOv");if(o)o.remove();}catch(e){}return 1;})()'); await wait(600);
const r=await ev(`(async function(){
  const ruta=${JSON.stringify(FOTO)};
  const im=await new Promise((ok,mal)=>{const i=new Image(); i.onload=()=>ok(i); i.onerror=mal; i.src=DSP.toFileURL(ruta);});
  const fit=fitImage(im, (typeof IMG_PREVIEW_MAX!=='undefined')?IMG_PREVIEW_MAX:MAX_IMG);
  const m={id:uid(),name:'foto',kind:'image',el:fit.src,originalEl:im,tex:newTex(),w:fit.w,h:fit.h,dur:5,fps:0,
           color:clipColorFor('image'),path:ruta,thumb:null,proxyReady:false,proxyPct:0};
  if(typeof IMG_PREVIEW_MAX!=='undefined') m._texTope=IMG_PREVIEW_MAX;
  upTex(m.tex,fit.src); mipTex(m.tex,fit.tw||fit.w,fit.th||fit.h);
  state.media.push(m);
  const c=makeClip(m,0,0,{az:0,el:90,size:100},{name:'foto'}); c.dur=5; c.lane=0;
  state.clips=[c]; state.lanes=[{id:uid(),name:'V1',tag:'V1',kind:'video'}];
  const huella=(S)=>{ const px=new Uint8Array(S*S*4); gl.readPixels(0,0,S,S,gl.RGBA,gl.UNSIGNED_BYTE,px);
    let h=2166136261; for(let i=0;i<px.length;i+=97){ h^=px[i]; h=Math.imul(h,16777619); }
    let sum=0,mx=0; for(let i=0;i<px.length;i+=4){ const l=px[i]+px[i+1]+px[i+2]; sum+=l; if(l>mx)mx=l; }
    return { hash:(h>>>0), media:+(sum/(px.length/4)).toFixed(3), max:mx }; };
  // PREVISUALIZACION
  gl.bindFramebuffer(gl.FRAMEBUFFER,null); prepNests(state.clips,1); composite(1,512,false);
  const prev=huella(512);
  // EXPORT: mismo camino que usa runExport (seekExport sube la imagen entera)
  const oq=_exportQuality, oe=exporting; _exportQuality=true; exporting=true;
  await seekExport(1);
  gl.bindFramebuffer(gl.FRAMEBUFFER,null); prepNests(state.clips,1); composite(1,512,false);
  const exp=huella(512);
  const tope=m._texTope;
  _exportQuality=oq; exporting=oe;
  return { previsualizacion:prev, exportacion:exp, topeDeTexturaTrasExport:tope, medidasDelMedio:[m.w,m.h] };
})()`);
console.log(ETIQ, JSON.stringify(r));
process.exit(0);
