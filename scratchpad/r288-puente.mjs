/* [R288·fase 3] El puente a FFmpeg, de punta a punta: fotogramas de NUESTRA GPU a 4096x4096, por la tuberia,
   codificados con NVENC, y el archivo resultante comprobado con ffprobe. Lo que hay que demostrar:
     - que el binario se encuentra y declara sus codificadores;
     - que sale un MP4 REAL de 4096x4096 que otro programa sabe leer;
     - que la MEMORIA se queda plana: si la contrapresion no funcionara, 64 MB por fotograma se acumularian;
     - que cancelar mata el proceso de verdad. */
import http from 'http'; import fs from 'fs';
const t=await new Promise((r2,j)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>r2(JSON.parse(b)));}).on('error',j);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise((res,rej)=>{const i=++id;p.set(i,r=>r.error?rej(new Error(JSON.stringify(r.error))):(r.result.exceptionDetails?rej(new Error(r.result.exceptionDetails.exception?.description||'')):res(r.result.result.value)));ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true}}));});
let fallos=0; const mal=m=>{ console.log('   *** '+m); fallos++; };
const BASE='C:/Users/beltr/AppData/Local/Temp/claude/C--Users-beltr-Desktop-Alma-Digital-Studio-Projects-Immersive-Studio-Pro/608b54d5-11b8-4b0b-9bce-10a09908c36b/scratchpad';
const OUT=BASE+'/r288.mp4'; try{ fs.unlinkSync(OUT); }catch(e){}

await ev("(async()=>{ await newProject('dome',4096,4096,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()");
await new Promise(r=>setTimeout(r,2500));

const cap=await ev("DSP.ffProbe()");
console.log('binario: '+(cap?cap.path:'(no encontrado)'));
if(!cap){ console.log('*** sin ffmpeg no hay nada que probar'); process.exit(1); }
console.log('H.264 disponibles: '+cap.h264.join(', '));
console.log('H.265 disponibles: '+cap.hevc.join(', '));
if(!cap.h264.length) mal('el binario no declara ningun codificador H.264');

const N=24;
const r=await ev(`(async function(){
  const W=4096,H=4096,FPS=30;
  const enc=${JSON.stringify(cap.h264[0]||'libx264')};
  const args=['-hide_banner','-loglevel','error','-y',
    '-f','rawvideo','-pix_fmt','rgba','-s',W+'x'+H,'-r',String(FPS),'-i','-',
    '-an','-c:v',enc,'-preset','p5','-rc','vbr','-b:v','200M','-maxrate','300M',
    '-spatial-aq','1','-temporal-aq','1','-pix_fmt','yuv420p',${JSON.stringify(OUT)}];
  const st=await DSP.ffStart(args,${JSON.stringify(OUT)});
  if(!st||!st.id)return {err:'no arranco: '+(st&&st.err)};

  /* Un FBO de 4096, que es lo que el export tiene delante de verdad. */
  const tex=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,tex);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,W,H,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  const fb=gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER,fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);
  gl.viewport(0,0,W,H);
  const buf=new Uint8Array(W*H*4);
  const memIni=(performance.memory&&performance.memory.usedJSHeapSize)||0;
  let memMax=memIni;
  const t0=performance.now();
  for(let i=0;i<${N};i++){
    /* cada fotograma con un color distinto: si el video sale congelado se nota */
    gl.clearColor(i/${N},0.35,1-i/${N},1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,buf);
    await DSP.ffWrite(st.id,buf);          /* ESPERAR: aqui esta la contrapresion */
    const m=(performance.memory&&performance.memory.usedJSHeapSize)||0; if(m>memMax)memMax=m;
  }
  const msEnc=performance.now()-t0;
  const fin=await DSP.ffEnd(st.id);
  gl.bindFramebuffer(gl.FRAMEBUFFER,null); gl.deleteFramebuffer(fb); gl.deleteTexture(tex);

  /* y que cancelar mate de verdad */
  const st2=await DSP.ffStart(args.slice(0,-1).concat([${JSON.stringify(BASE+'/r288-cancel.mp4')}]),${JSON.stringify(BASE+'/r288-cancel.mp4')});
  const matado=st2&&st2.id?await DSP.ffKill(st2.id):false;

  return { enc, ok:fin.ok, code:fin.code, err:(fin.err||'').slice(0,180),
           fps:+(${N}*1000/msEnc).toFixed(1), ms:Math.round(msEnc),
           memMB:+((memMax-memIni)/1048576).toFixed(1), matado }; })()`);

if(r.err){ console.log('*** '+r.err); process.exit(1); }
console.log('codificador usado: '+r.enc+'   terminado ok: '+r.ok+(r.code?('  (codigo '+r.code+')'):''));
if(r.err) console.log('   stderr: '+r.err);
console.log('velocidad de punta a punta: '+r.fps+' fps a 4096x4096  ('+r.ms+' ms para '+N+' fotogramas)');
console.log('memoria del renderer durante el volcado: +'+r.memMB+' MB');
console.log('cancelar mata el proceso: '+r.matado);

if(!r.ok) mal('el codificador no termino bien');
if(!fs.existsSync(OUT)) mal('no hay archivo de salida');
else {
  const kb=Math.round(fs.statSync(OUT).size/1024);
  console.log('archivo: '+kb+' KB');
  if(kb<200) mal('el archivo es sospechosamente pequeno ('+kb+' KB)');
  const FF='C:/Users/beltr/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1-full_build/bin/ffprobe.exe';
  if(fs.existsSync(FF)){
    const { execFileSync }=await import('child_process');
    const j=JSON.parse(execFileSync(FF,['-v','quiet','-print_format','json','-show_streams',OUT]).toString());
    const v=j.streams.find(s=>s.codec_type==='video');
    console.log('ffprobe: '+v.codec_name+'  '+v.width+'x'+v.height+'  '+v.nb_frames+' fotogramas');
    if(v.width!==4096||v.height!==4096) mal('el video no es 4096x4096: '+v.width+'x'+v.height);
    if(+v.nb_frames!==N) mal('faltan fotogramas: '+v.nb_frames+' de '+N);
    if(!/h264|hevc/.test(v.codec_name)) mal('codec inesperado: '+v.codec_name);
  }
}
/* 24 fotogramas de 64 MB son 1,5 GB: si la contrapresion no funcionara, se veria aqui */
if(r.memMB>350) mal('la memoria ha crecido +'+r.memMB+' MB: la contrapresion no esta frenando al renderer');
if(!r.matado) mal('cancelar no mata el proceso');
console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'MP4 de 4096x4096 por NVENC, memoria plana y cancelacion efectiva'));
ws.close();
