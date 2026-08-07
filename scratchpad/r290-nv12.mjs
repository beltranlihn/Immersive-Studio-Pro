/* [R290] El shader NV12, juzgado por un tercero. Se codifica EL MISMO fotograma por dos caminos:
     A) el nuestro:  GPU -> NV12 -> FFmpeg
     B) el control:  GPU -> RGBA -> FFmpeg, que convierte con swscale
   y se comparan los dos videos decodificados. Criterio del diseno: PSNR > 45 dB. Por debajo, la matriz o el
   submuestreo estan mal; un error de RANGO (limitado contra completo) se delata solo porque hunde el PSNR a
   ~30 dB. Comparar contra uno mismo no valdria: solo diria que el shader es consistente, no que es correcto. */
import http from 'http'; import fs from 'fs'; import { execFileSync } from 'child_process';
const FF='C:/Users/beltr/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1-full_build/bin/ffmpeg.exe';
const BASE='C:/Users/beltr/AppData/Local/Temp/claude/C--Users-beltr-Desktop-Alma-Digital-Studio-Projects-Immersive-Studio-Pro/608b54d5-11b8-4b0b-9bce-10a09908c36b/scratchpad';
const A=BASE+'/r290-nuestro.mp4', B=BASE+'/r290-control.mp4';
for(const f of [A,B]) try{ fs.unlinkSync(f); }catch(e){}
const t=await new Promise((r2,j)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>r2(JSON.parse(b)));}).on('error',j);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise((res,rej)=>{const i=++id;p.set(i,r=>r.error?rej(new Error(JSON.stringify(r.error))):(r.result.exceptionDetails?rej(new Error(r.result.exceptionDetails.exception?.description||'')):res(r.result.result.value)));ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true}}));});
let fallos=0; const mal=m=>{ console.log('   *** '+m); fallos++; };

await ev("(async()=>{ await newProject('dome',2048,2048,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()");
await new Promise(r=>setTimeout(r,2200));

const N=8;
const r=await ev(`(async function(){
  const W=2048,H=2048;
  if(!nv12Cabe(W,H))return {err:'la GPU no admite el FBO que hace falta'};
  /* Fuente EXIGENTE: color saturado, degradados y bordes duros. Un gris plano no distinguiria una matriz mal
     puesta de una bien puesta. Se pinta con el shader de fondo, que ya sabe hacer degradados... o a mano. */
  const tex=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,tex);
  const px=new Uint8Array(W*H*4);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){ const i=(y*W+x)*4;
    const bloque=((x>>7)+(y>>7))&1;
    px[i  ]=bloque? 255*(x/W) : 255;             /* rojo saturado contra degradado */
    px[i+1]=bloque? 40 : 255*(y/H);
    px[i+2]=bloque? 255*(1-y/H) : 20;            /* azul, que es donde mas se nota el croma */
    px[i+3]=255; }
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);   /* la fuente va tal cual: el vuelco lo hace el shader */
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,W,H,0,gl.RGBA,gl.UNSIGNED_BYTE,px);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);

  const banderas=['-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-color_range','tv'];
  const salida=['-an','-c:v','h264_nvenc','-preset','p7','-rc','vbr','-b:v','300M','-maxrate','400M','-pix_fmt','yuv420p'];

  /* A) el nuestro: NV12 ya convertido */
  const t0=performance.now();
  const stA=await DSP.ffStart(['-hide_banner','-loglevel','error','-y','-f','rawvideo','-pix_fmt','nv12','-s',W+'x'+H,'-r','30','-i','-']
    .concat(banderas).concat(salida).concat([${JSON.stringify(A)}]),${JSON.stringify(A)});
  if(!stA||!stA.id)return {err:'no arranco el nuestro'};
  for(let i=0;i<${N};i++){ const buf=nv12Read(tex,W,H); if(!buf)return {err:'nv12Read devolvio null'}; await DSP.ffWrite(stA.id,buf); }
  const finA=await DSP.ffEnd(stA.id); const msA=performance.now()-t0;

  /* B) el control: RGBA crudo, que convierte swscale */
  const t1=performance.now();
  /* El control tiene que ser INEQUIVOCO: swscale elige matriz y rango por su cuenta -601 o 709 segun el tamano,
     y el rango segun le parezca-, asi que una discrepancia no diria de quien es la culpa. Se le dicta todo:
     entrada RGB de rango completo, salida BT.709 de rango limitado. Eso es exactamente lo que hace el shader. */
  const stB=await DSP.ffStart(['-hide_banner','-loglevel','error','-y','-f','rawvideo','-pix_fmt','rgba','-s',W+'x'+H,'-r','30','-i','-',
      '-vf','scale=in_range=full:out_range=tv:out_color_matrix=bt709:flags=full_chroma_int+accurate_rnd']
    .concat(banderas).concat(salida).concat([${JSON.stringify(B)}]),${JSON.stringify(B)});
  if(!stB||!stB.id)return {err:'no arranco el control'};
  const fb=gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER,fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);
  const rgba=new Uint8Array(W*H*4);
  /* readPixels lee de abajo arriba; el control tiene que entregar la imagen en el MISMO sentido que el shader */
  const fila=new Uint8Array(W*4), vuelta=new Uint8Array(W*H*4);
  for(let i=0;i<${N};i++){
    gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,rgba);
    for(let y=0;y<H;y++) vuelta.set(rgba.subarray((H-1-y)*W*4,(H-y)*W*4), y*W*4);
    await DSP.ffWrite(stB.id,vuelta); }
  const finB=await DSP.ffEnd(stB.id); const msB=performance.now()-t1;
  gl.bindFramebuffer(gl.FRAMEBUFFER,null); gl.deleteFramebuffer(fb); gl.deleteTexture(tex);
  return { okA:finA.ok, okB:finB.ok, errA:(finA.err||'').slice(0,150), errB:(finB.err||'').slice(0,150),
           msA:Math.round(msA/${N}), msB:Math.round(msB/${N}) }; })()`);

if(r.err){ console.log('*** '+r.err); process.exit(1); }
console.log('nuestro (NV12): '+(r.okA?'ok':'FALLO '+r.errA)+'   '+r.msA+' ms/fotograma');
console.log('control (RGBA): '+(r.okB?'ok':'FALLO '+r.errB)+'   '+r.msB+' ms/fotograma');
if(!r.okA) mal('el camino NV12 no termino');
if(!r.okB) mal('el control no termino');
if(r.okA&&r.okB){
  const out=execFileSync(FF,['-hide_banner','-i',A,'-i',B,'-lavfi','psnr=stats_file=-','-f','null','-'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
  const m=/average:([0-9.]+|inf)/i.exec(out)||/psnr_avg:([0-9.]+|inf)/i.exec(out);
  const db=m?(m[1].toLowerCase()==='inf'?999:parseFloat(m[1])):null;
  console.log('PSNR contra la conversion de FFmpeg: '+(db===999?'identico':db+' dB'));
  if(db==null) mal('no se pudo medir el PSNR');
  else if(db<45) mal('PSNR '+db+' dB, por debajo de los 45 exigidos'+(db<35?' — huele a error de RANGO (limitado vs completo)':' — matriz o submuestreo'));
  console.log('mejora de transporte: '+r.msB+' -> '+r.msA+' ms  ('+(r.msB/Math.max(1,r.msA)).toFixed(2)+'x)');
  if(r.msA>=r.msB) mal('NV12 no es mas rapido que RGBA: no compensa');
}
console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'el shader NV12 coincide con la conversion de FFmpeg y transporta menos'));
ws.close();
