/* [R253e] Humo de EXPORTACION: en toda la tanda no se corrio una exportacion real, y es donde un fallo cuesta una
   noche de render. Exporta un domo corto y pequeno con lo que la tanda toco: un clip recortado por marcas de
   origen, un clip en bucle, una composicion (colocada por la regla nueva de pista) y un Motion Flotar.
   Comprueba que el archivo sale, pesa, y que ffprobe lo lee con la duracion y el tamano pedidos. */
import http from 'http'; import fs from 'fs'; import path from 'path';
import { execFileSync } from 'child_process';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:300000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let fallos=0; const ok=(t,c,d)=>{ if(!c)fallos++; console.log('   '+(c?'OK  ':'*** FALLA *** ')+t+(d?' - '+d:'')); };

await cmd('Page.enable'); await cmd('Page.reload',{ignoreCache:true}); await wait(3800);
await ev(`(function(){ window.__errs=[]; addEventListener('error',e=>__errs.push(String(e.message||e))); return 1; })()`);
console.log('GPU:', await ev(`(function(){const d=gl.getExtension('WEBGL_debug_renderer_info'); return d?gl.getParameter(d.UNMASKED_RENDERER_WEBGL):'?';})()`));
await ev(`(async()=>{ await newProject('dome',1024,1024,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()`); await wait(1200);

const OUT=path.join(process.cwd(),'scratchpad','r253e-export.mp4');
try{ fs.rmSync(OUT); }catch(e){}

/* un video real: toggleLoop y las marcas solo valen para video/audio/secuencia, no para imagenes */
await ev(`window.__vid=function(ruta,nombre){ return new Promise(res=>{ const url=DSP.toFileURL(ruta); const v=document.createElement("video"); v.preload="metadata"; v.src=url;
  v.addEventListener("loadedmetadata",()=>{ const m={id:uid(),name:nombre,kind:"video",el:v,originalEl:v,srcUrl:url,tex:newTex(),w:v.videoWidth,h:v.videoHeight,dur:v.duration,fps:30,color:clipColorFor("video"),proxyReady:false,proxyPct:0,path:ruta,fsize:0,folder:null,missing:false,_loading:false};
    state.media.push(m); renderMedia(); res(+m.dur.toFixed(2)); }); v.addEventListener("error",()=>res(null)); }); };1`);
const durVid=await ev(`__vid(${JSON.stringify("C:/Users/beltr/Desktop/Alma Digital Studio/Code/Alma Digital Portfolio/Asset/Reel Portfolio/Reel Portfolio.mp4")},"reel.mp4")`);
console.log("video real: "+durVid+" s");
if(!durVid){ console.log("no cargo el video"); process.exit(1); }

/* escenario con TODO lo que la tanda toco */
const arm=await ev(`(function(){
  state.clips=[]; state.media=state.media.filter(m=>m.kind==='nest'||m.kind==='video');
  const V=state.media.find(m=>m.kind==='video');
  const mk=(n,c)=>{ const cv=document.createElement('canvas'); cv.width=cv.height=256; const x=cv.getContext('2d');
    x.fillStyle=c; x.fillRect(0,0,256,256); x.fillStyle='#000'; x.font='700 40px Inter'; x.fillText(n,20,140);
    const m={id:uid(),kind:'image',name:n,el:cv,originalEl:cv,tex:newTex(),w:256,h:256,dur:20,fps:0,color:c,missing:false,_loading:false};
    upTex(m.tex,cv); try{m.thumb=cv.toDataURL();}catch(e){} state.media.push(m); return m; };
  const A=mk('A','#7FD4FF'), B=mk('B','#FFB37F'), C=mk('C','#C8A2FF');
  const vl=state.lanes.map((l,i)=>({l,i})).filter(o=>o.l.kind==='video').map(o=>o.i);

  /* 1) clip recortado por MARCAS de origen (R249/R253) */
  V.srcIn=4; V.srcOut=7; addClip(V,vl[0],0,srcRange(V)); const c1=state.clips[state.clips.length-1]; // el rango se pasa igual que en el arrastre; // [gotcha] addClip no devuelve el clip

  /* 2) clip en BUCLE con tramo corto (R250) */
  const c2=makeClip(V,vl[1],0); c2.dur=4; c2.inP=1; state.clips.push(c2);
  state.selId=c2.id; state.selIds=[c2.id]; toggleLoop(c2); setLoopRange(c2,1.2); c2.dur=4;

  /* 3) Motion FLOTAR con intensidad (R252/b) */
  const c3=makeClip(C,vl[2],0); c3.dur=4; c3.props.az=90; c3.props.el=40; state.clips.push(c3);
  state.selId=c3.id; state.selIds=[c3.id]; addAnimPreset(c3,'float');
  const gid=c3.anim[0].gid; setAnimGroupInt(c3,gid,1.6);

  /* 4) una COMPOSICION, que ademas prueba la colocacion nueva de pista (R251) */
  state.playhead=0; state.selLane=null;
  const nest=createComposition({kind:'ring',mediaIds:[A.id,B.id,C.id],count:6,size:35,el:25});
  const nc=state.clips.find(c=>{const m=mediaById(c.mediaId);return m&&m.kind==='nest';});
  if(nc){ nc.start=0; nc.dur=4; }

  renderTimeline(); render();
  return { clips:state.clips.length, pistas:state.lanes.filter(l=>l.kind==='video').length,
           c1:{inP:+(c1?c1.inP:0).toFixed(2), dur:+(c1?c1.dur:0).toFixed(2)},
           bucle:{loopLen:(c2.loopLen!=null?+c2.loopLen.toFixed(2):null), enBucle:!!c2.loop, dur:c2.dur},
           flotar:c3.anim.length, nestEnPista:nc?state.lanes[nc.lane].tag:'-' }; })()`);
console.log('escenario: '+arm.clips+' clips en '+arm.pistas+' pistas de video');
console.log('   recortado por marcas: inP '+arm.c1.inP+' dur '+arm.c1.dur+'  ·  bucle de '+arm.bucle.loopLen+'s en un clip de '+arm.bucle.dur+'s');
console.log('   Flotar: '+arm.flotar+' modificadores  ·  composicion en la pista '+arm.nestEnPista);

console.log('\nexportando 4 s a 512x512 H.264...');
const t0=Date.now();
/* `runExport` llama a job.done() y job.wrote() SIN guarda, asi que necesita un job de verdad: se usa el mismo
   que el horneado en el sitio (ripProgress), que ademas ensena el progreso en pantalla. */
const r=await ev(`(async()=>{ const ui=ripProgress('Humo de exportacion','512x512 · H.264',1); try{
    await runExport({codec:'h264', res:512, fps:30, bitrate:8, range:'clips', rangeT:[0,4],
                     outW:512, outH:512, outPath:${JSON.stringify(OUT)}, silent:true, noAudio:true, job:ui.job});
    ui.close(); return { ok:true, errs:window.__errs.slice(0,3) };
  }catch(e){ try{ui.close();}catch(_){} return { ok:false, err:String(e&&e.message||e), errs:window.__errs.slice(0,3) }; } })()`);
const secs=((Date.now()-t0)/1000).toFixed(1);
ok('runExport termina sin excepcion', r.ok, r.ok? (secs+' s') : r.err);
ok('sin errores JS durante el render', !r.errs||r.errs.length===0, JSON.stringify(r.errs));

const existe=fs.existsSync(OUT);
ok('el archivo existe', existe, existe? (Math.round(fs.statSync(OUT).size/1024)+' KB') : OUT);
if(existe){
  try{
    const j=JSON.parse(execFileSync('ffprobe',['-v','quiet','-print_format','json','-show_streams','-show_format',OUT],{encoding:'utf8'}));
    const v=(j.streams||[]).find(s=>s.codec_type==='video')||{};
    const dur=+(j.format&&j.format.duration||0);
    console.log('   ffprobe: '+v.codec_name+' '+v.width+'x'+v.height+' '+(v.r_frame_rate||'')+'  dur '+dur.toFixed(2)+'s  ('+Math.round((j.format.size||0)/1024)+' KB)');
    ok('lo lee un decodificador externo', !!v.codec_name, v.codec_name);
    ok('tamano pedido', v.width===512 && v.height===512, v.width+'x'+v.height);
    ok('duracion aproximada (4 s)', Math.abs(dur-4)<0.6, dur.toFixed(2)+'s');
    ok('tiene fotogramas de verdad', (+v.nb_frames||0)>=100 || dur>3.4, (v.nb_frames||'?')+' fotogramas');
  }catch(e){ ok('ffprobe disponible', false, String(e.message||e).slice(0,90)); }
}
console.log('\nerrs JS: ' + JSON.stringify(await ev(`window.__errs.slice(0,5)`)));
console.log(fallos ? ('\n=== *** ' + fallos + ' fallos *** ===') : '\n=== EXPORTACION OK ===');
ws.close();
