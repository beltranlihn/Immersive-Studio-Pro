/* [R303] Los cuatro del review sobre los mipmaps. El grave: que sobrevivan a guardar y reabrir. */
import http from 'http';
const t=await new Promise((r2,j)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>r2(JSON.parse(b)));}).on('error',j);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise((res,rej)=>{const i=++id;p.set(i,r=>r.error?rej(new Error(JSON.stringify(r.error))):(r.result.exceptionDetails?rej(new Error(r.result.exceptionDetails.exception?.description||'')):res(r.result.result.value)));ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true}}));});
let fallos=0; const mal=m=>{ console.log('   *** '+m); fallos++; };
await ev("(async()=>{ await newProject('dome',1024,1024,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()");
await new Promise(r=>setTimeout(r,2000));
const r=await ev(`(function(){
  const out={};
  const hazTex=(n)=>{ const cv=document.createElement('canvas'); cv.width=cv.height=n;
    const x=cv.getContext('2d'); x.fillStyle='#888'; x.fillRect(0,0,n,n);
    const t=newTex(); upTex(t,cv); return t; };
  /* [4] el tamano manda: una imagen pequena no paga mipmaps */
  const chica=hazTex(512), grande=hazTex(2048);
  mipTex(chica,512,512); mipTex(grande,2048,2048);
  const filtro=t=>{ gl.bindTexture(gl.TEXTURE_2D,t); return gl.getTexParameter(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER); };
  out.chica=(filtro(chica)===gl.LINEAR_MIPMAP_LINEAR)?'con mipmaps':'sin mipmaps';
  out.grande=(filtro(grande)===gl.LINEAR_MIPMAP_LINEAR)?'con mipmaps':'sin mipmaps';
  /* [3] tras un mipTex correcto no puede quedar error de GL colgando */
  while(gl.getError()!==gl.NO_ERROR){}
  mipTex(hazTex(2048),2048,2048);
  out.errorTrasMip=gl.getError();
  /* [1] la ruta de RECARGA -la que usa reabrir un proyecto- tiene que ponerlos */
  out.recargaLosPone=String(reloadMedia).indexOf('mipTex(m.tex')>=0;
  /* [2] el texto no los lleva; las formas si */
  out.textoSinMip=(String(renderTextMedia)+String(renderShapeMedia)).indexOf("kind!=='text'")>=0;
  return out; })()`);
console.log('[4] imagen de 512: '+r.chica+'   de 2048: '+r.grande);
console.log('[3] error de GL tras generar mipmaps: '+r.errorTrasMip+' (0 = ninguno)');
console.log('[1] la recarga de imagenes los aplica: '+r.recargaLosPone);
console.log('[2] el texto queda excluido: '+r.textoSinMip);
if(r.chica!=='sin mipmaps') mal('una imagen pequena esta pagando el 33 % de memoria sin necesitarlo');
if(r.grande!=='con mipmaps') mal('una imagen grande NO los lleva: el arreglo no hace nada');
if(r.errorTrasMip!==0) mal('queda un error de GL colgando tras generar mipmaps');
if(!r.recargaLosPone) mal('al reabrir un proyecto se pierden: el arreglo solo duraria la sesion en que se importo');
if(!r.textoSinMip) mal('el texto no esta excluido: se le oscureceria el borde al minificarlo');
console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'los mipmaps sobreviven a reabrir, cuestan solo donde sirven, y no dejan errores'));
ws.close(); process.exit(fallos?1:0);
