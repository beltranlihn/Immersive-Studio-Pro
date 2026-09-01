/* [R354] ¿Se ve IGUAL con los proxies puestos que recomponiendo en vivo, en el proyecto real y cruzando
   vueltas del bucle? Se compara el composite del master con el cache puesto y quitado. */
import http from 'http';
const t=await new Promise((r2,rj)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>r2(JSON.parse(b)));}).on('error',rj);});
const ws=new WebSocket(t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl).webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async(x,ms=180000)=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:false,returnByValue:true,timeout:ms});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const RUTA=process.argv[2];
await ev(`state.dirty=false; openProjectPath(${JSON.stringify(RUTA)},true); 1`);
for(let i=0;i<60;i++){ const st=await ev('({n:state.media.length, faltan:state.media.filter(m=>m.missing).length, ruta:currentPath})');
  if(st.n>=483 && st.faltan===0 && st.ruta===RUTA) break; await wait(2000); }
await wait(3000);
console.log('proxys usables:', await ev("state.media.filter(m=>m.kind==='nest'&&ncUsable(m)).length"));
const out=[];
/* En PAUSA los proxys se quedan en el fotograma donde pararon: hay que pedirles la busqueda a su instante y
   esperar a que lleguen. Sin esto se compara "el proxy donde se quedo" contra "el vivo en T", que no dice nada
   (daba 20/255 de diferencia media y parecia que el proxy no valia). */
await ev(`window.__pedir=function(T){ var l=collectDrawnVideoClips(state.clips,state.lanes,T), n=0;
  for(var i=0;i<l.length;i++){ var it=l[i]; if(it.m.kind!=='nest')continue; var v=_vinst.get(it.c.id);
    if(v){ vinstSeek(it.c,it.m,it.local); n++; } } return n; };
 window.__listos=function(T){ var l=collectDrawnVideoClips(state.clips,state.lanes,T), ok=0, tot=0;
  for(var i=0;i<l.length;i++){ var it=l[i]; if(it.m.kind!=='nest')continue; tot++; var v=_vinst.get(it.c.id);
    /* vel es el elemento de video; vsrc es solo la URL */
    if(v&&v.ready&&v.vtex&&v.vel&&Math.abs(v.vel.currentTime-it.local)<0.06) ok++; }
  return {ok:ok,tot:tot}; }; 1`);
for(const T of [636,639,643,647,651,655]){
  await ev(`state.playhead=${T}; state.view.useNestCache=true; prepNests(state.clips,${T}); 1`);
  let est=null;
  for(let i=0;i<40;i++){ await ev(`__pedir(${T})`); await wait(400);
    est=await ev(`__listos(${T})`); if(est&&est.tot>0&&est.ok===est.tot)break; }
  await wait(600);
  out.push(await ev(`(function(){ var T=${T}, S=256;
    var lee=function(){ gl.bindFramebuffer(gl.FRAMEBUFFER,null); prepNests(state.clips,T); composite(T,S,false);
      var px=new Uint8Array(S*S*4); gl.readPixels(0,0,S,S,gl.RGBA,gl.UNSIGNED_BYTE,px); return px; };
    state.view.useNestCache=true;  var a=lee();
    state.view.useNestCache=false; var b=lee();
    state.view.useNestCache=true;
    var d=0,n=0,mx=0; for(var i=0;i<a.length;i+=4){ for(var k=0;k<3;k++){ var q=Math.abs(a[i+k]-b[i+k]); d+=q; if(q>mx)mx=q; n++; } }
    return { t:T, difMedia:+(d/n).toFixed(2), difMax:mx }; })()`));
  console.log('t='+T, JSON.stringify(out[out.length-1]), 'proxysEnSuSitio='+JSON.stringify(est));
}
const med=out.reduce((s,x)=>s+x.difMedia,0)/out.length;
console.log('diferencia media global (0-255):', med.toFixed(2));
ws.close(); process.exit(0);
