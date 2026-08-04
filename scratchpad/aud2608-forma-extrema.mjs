/* [AUDIT 2026-08] Casos extremos de forma del composite de relleno (R237), sobre el .exe/RTX.
   Hipótesis a probar: con lienzos de aspecto extremo, el clamp mínimo de 64 px de setCompSize distorsiona la
   forma de la textura y el viewport de relleno (compH/Fy) puede superar MAX_VIEWPORT_DIMS → el driver lo recorta
   y el mapeo mstrU/mstrV deja de corresponder al viewport real. */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:120000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const out={};
await ev(`(function(){ window.__errs=[]; addEventListener('error',e=>__errs.push(String(e.message||e))); return 1; })()`);
out.limites=await ev(`(function(){ return { GL_MAXSIDE, COMP_MAXTEXELS, maxViewport:[...gl.getParameter(gl.MAX_VIEWPORT_DIMS)], maxTex:gl.getParameter(gl.MAX_TEXTURE_SIZE) }; })()`);

/* proyecto 2D plano limpio (sin diálogo: forzamos el lienzo a mano después) */
await ev(`state.dirty=false;1`);
await ev(`(async()=>{try{await startDemoProject('flat');}catch(e){window.__d=String(e);}})()`); await wait(2500);
await ev(`(function(){try{if(typeof _tourStop==='function')_tourStop();const o=document.getElementById('tourOv');if(o)o.remove();}catch(e){}
  const b=document.querySelector('#viewModeSeg button[data-v="2d"]'); if(b)b.click(); resize(); return 1;})()`); await wait(600);

/* medir un caso: fija el lienzo, compone con relleno y compara el viewport REAL contra compFillVp() */
await ev(`window.__caso=function(W,H){
  const as=activeSeq(); as.w=W; as.h=H; state.seqW=W; state.seqH=H;
  _compAspect=W/H; syncCompSize();
  gl.bindFramebuffer(gl.FRAMEBUFFER,compFBO); composite(0.5,null,false,true);
  const vpReal=[...gl.getParameter(gl.VIEWPORT)]; gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  const V=compFillVp();
  const u0=mstrU(0,W),u1=mstrU(W,W),v0=mstrV(H,H),v1=mstrV(0,H);
  return { lienzo:[W,H], comp:[compW,compH], texelsM:+((compW*compH)/1e6).toFixed(1),
    formaTex:+(compW/compH).toFixed(2), formaLienzo:+(W/H).toFixed(2),
    vpCalc:[V.x,V.y,V.w,V.h], vpReal,
    vpClampeado:(vpReal[2]!==V.w||vpReal[3]!==V.h||vpReal[0]!==V.x||vpReal[1]!==V.y),
    relleno:{u0:+u0.toFixed(5),u1:+u1.toFixed(5),v0:+v0.toFixed(5),v1:+v1.toFixed(5)},
    desvTexels:{x:+Math.max(Math.abs(u0)*compW,Math.abs(u1-1)*compW).toFixed(2),
                y:+Math.max(Math.abs(v0)*compH,Math.abs(v1-1)*compH).toFixed(2)} }; };1`);

out.a_tiraReal      = await ev(`__caso(7196,912)`);
out.b_tiraGrande    = await ev(`__caso(16000,2000)`);
out.c_casiCuadrado  = await ev(`__caso(9000,8999)`);
out.d_salaCuatro4K  = await ev(`__caso(15360,2160)`);
out.e_aspecto300    = await ev(`__caso(12000,40)`);
out.f_aspecto800    = await ev(`__caso(16000,20)`);
out.g_vertical800   = await ev(`__caso(20,16000)`);

/* restaurar un lienzo sano y dejar la app limpia */
await ev(`(function(){ const as=activeSeq(); as.w=1920; as.h=1080; state.seqW=1920; state.seqH=1080; _compAspect=1920/1080; syncCompSize(); render(); state.dirty=false; return 1; })()`);
out.errs=await ev(`window.__errs.slice(0,20)`);
console.log(JSON.stringify(out,null,1));
ws.close();
