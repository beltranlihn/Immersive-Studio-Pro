/* [R290b] El shader NV12, aislado. La prueba anterior comparaba dos VIDEOS CODIFICADOS, y el codificador mete
   su propio ruido: 28 dB podian ser del shader o de NVENC. Aqui no se codifica nada. Se sacan de la pagina dos
   archivos crudos -el RGBA de origen y el NV12 que produce nuestro shader-, se le pide a FFmpeg que convierta
   ESE MISMO RGBA a NV12, y se comparan los dos NV12 byte a byte. Si el shader esta bien, coinciden salvo
   redondeo. */
import http from 'http'; import fs from 'fs'; import { execFileSync } from 'child_process';
const FF='C:/Users/beltr/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1-full_build/bin/ffmpeg.exe';
const BASE='C:/Users/beltr/AppData/Local/Temp/claude/C--Users-beltr-Desktop-Alma-Digital-Studio-Projects-Immersive-Studio-Pro/608b54d5-11b8-4b0b-9bce-10a09908c36b/scratchpad';
const RGBA=BASE+'/r290b.rgba', MIO=BASE+'/r290b-mio.nv12', SUYO=BASE+'/r290b-ff.nv12';
for(const f of [RGBA,MIO,SUYO]) try{ fs.unlinkSync(f); }catch(e){}
const t=await new Promise((r2,j)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>r2(JSON.parse(b)));}).on('error',j);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise((res,rej)=>{const i=++id;p.set(i,r=>r.error?rej(new Error(JSON.stringify(r.error))):(r.result.exceptionDetails?rej(new Error(r.result.exceptionDetails.exception?.description||'')):res(r.result.result.value)));ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true}}));});
let fallos=0; const mal=m=>{ console.log('   *** '+m); fallos++; };
const W=512,H=512;   /* pequeno a proposito: aqui se busca CORRECCION, no velocidad */

await ev("(async()=>{ await newProject('dome',1024,1024,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()");
await new Promise(r=>setTimeout(r,2200));

const r=await ev(`(async function(){
  const W=${W},H=${H};
  const tex=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,tex);
  const px=new Uint8Array(W*H*4);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){ const i=(y*W+x)*4;
    const b=((x>>5)+(y>>5))&1;
    px[i]=b?Math.round(255*x/(W-1)):255; px[i+1]=b?40:Math.round(255*y/(H-1));
    px[i+2]=b?Math.round(255*(1-y/(H-1))):20; px[i+3]=255; }
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,W,H,0,gl.RGBA,gl.UNSIGNED_BYTE,px);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
  const nv=nv12Read(tex,W,H); if(!nv)return {err:'nv12Read null'};
  /* El RGBA que se guarda es el que el shader VE, en el mismo orden en que produce sus filas: la fila 0 de
     salida es la de arriba de la imagen, o sea px tal cual. Asi FFmpeg convierte exactamente lo mismo. */
  await DSP.writeBinary(${JSON.stringify(RGBA)}, px);
  await DSP.writeBinary(${JSON.stringify(MIO)}, nv);
  gl.deleteTexture(tex);
  return {ok:true, bytesNv:nv.length, esperado:W*H*1.5}; })()`);
if(r.err){ console.log('*** '+r.err); process.exit(1); }
console.log('NV12 del shader: '+r.bytesNv+' bytes (esperados '+r.esperado+')');
if(r.bytesNv!==r.esperado) mal('el tamano del buffer no es W*H*1.5');

execFileSync(FF,['-hide_banner','-loglevel','error','-y','-f','rawvideo','-pix_fmt','rgba','-s',W+'x'+H,'-i',RGBA,
  /* vflip EN LA REFERENCIA, y esta vez el equivocado era el control. El shader asume el origen de GL -fila 0
     abajo-, que es lo correcto en el export real, donde lee de un FBO. Aqui el RGBA se guardo en orden natural
     (fila 0 arriba), asi que hay que darle la vuelta a la referencia para comparar lo mismo. Sin esto la
     diferencia media salia en 71 y parecia un error de formula. */
  '-vf','vflip,scale=in_range=full:out_range=tv:out_color_matrix=bt709:flags=full_chroma_int+accurate_rnd',
  '-f','rawvideo','-pix_fmt','nv12',SUYO]);
const a=fs.readFileSync(MIO), b=fs.readFileSync(SUYO);
console.log('NV12 de FFmpeg:  '+b.length+' bytes');
if(a.length!==b.length){ mal('tamanos distintos'); }
else{
  const nY=W*H;
  const est=(ini,fin)=>{ let s=0,mx=0,n=0; for(let i=ini;i<fin;i++){ const d=Math.abs(a[i]-b[i]); s+=d; if(d>mx)mx=d; n++; } return {media:+(s/n).toFixed(2),max:mx}; };
  const y=est(0,nY), uv=est(nY,a.length);
  console.log('plano Y  -> diferencia media '+y.media+'  maxima '+y.max);
  console.log('plano UV -> diferencia media '+uv.media+'  maxima '+uv.max);
  console.log('primeros Y  nuestro: '+[...a.subarray(0,8)].join(',')+'   FFmpeg: '+[...b.subarray(0,8)].join(','));
  console.log('primeros UV nuestro: '+[...a.subarray(nY,nY+8)].join(',')+'   FFmpeg: '+[...b.subarray(nY,nY+8)].join(','));
  /* Redondeo: el shader trabaja en flotante y swscale en enteros con su propio redondeo. 1-2 de diferencia es
     normal; mas es un error de formula. */
  if(y.media>1.5) mal('el plano Y no coincide (media '+y.media+'): la formula de luma o el rango estan mal');
  if(uv.media>2.5) mal('el plano UV no coincide (media '+uv.media+'): la matriz de croma o el submuestreo estan mal');
}
console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'el shader produce el MISMO NV12 que FFmpeg, salvo redondeo'));
ws.close();
