/* [R291] La rama de export por FFmpeg, de verdad: runExport con codec ffh264 a 4096, y el archivo comprobado
   con ffprobe. Es la primera vez que se pide 4096 en MP4 a la aplicacion y sale algo. */
import http from 'http'; import fs from 'fs'; import { execFileSync } from 'child_process';
const FFP='C:/Users/beltr/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1-full_build/bin/ffprobe.exe';
const BASE='C:/Users/beltr/AppData/Local/Temp/claude/C--Users-beltr-Desktop-Alma-Digital-Studio-Projects-Immersive-Studio-Pro/608b54d5-11b8-4b0b-9bce-10a09908c36b/scratchpad';
const OUT=BASE+'/r291-4096.mp4'; try{ fs.unlinkSync(OUT); }catch(e){}
const t=await new Promise((r2,j)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>r2(JSON.parse(b)));}).on('error',j);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise((res,rej)=>{const i=++id;p.set(i,r=>r.error?rej(new Error(JSON.stringify(r.error))):(r.result.exceptionDetails?rej(new Error(r.result.exceptionDetails.exception?.description||'')):res(r.result.result.value)));ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true}}));});
let fallos=0; const mal=m=>{ console.log('   *** '+m); fallos++; };
await ev("(async()=>{ await newProject('dome',4096,4096,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()");
await new Promise(r=>setTimeout(r,2500));
const bytes=fs.readFileSync('C:/Users/beltr/Downloads/EIT dia 1 (9).png');
const alta=await ev(`(async function(){
  const b64='${bytes.toString('base64')}'; const bin=atob(b64);
  const u=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);
  addImage(new File([u],'foto.png',{type:'image/png'}),'foto.png');
  for(let k=0;k<60;k++){ if(state.media.some(m=>m.kind==='image'))break; await new Promise(s=>setTimeout(s,100)); }
  const m=state.media.find(x=>x.kind==='image'); if(!m)return 'no';
  addClip(m,state.lanes.findIndex(l=>l.kind==='video'),0);
  const c=state.clips[state.clips.length-1]; c.dur=1; c.props.size=120; c.props.el=0;
  renderTimeline(); render(); return 'ok'; })()`);
if(alta!=='ok'){ console.log('*** la foto no entro'); process.exit(1); }
console.log('exportando 4096x4096 en H.264 por GPU...');
const t0=Date.now();
const r=await ev(`(async function(){ try{
  await runExport({codec:'ffh264',res:4096,outW:4096,outH:4096,fps:30,range:'clips',rangeT:[0,1],
    outPath:${JSON.stringify(OUT)},noAudio:true,silent:true,ffq:{mbps:150,preset:'p5'},
    job:{prog:()=>{},frame:()=>{},wrote:()=>{},label:()=>{},done:()=>{},warn:()=>{},err:()=>{}}});
  return {ok:true}; }catch(e){ return {ok:false,err:String(e&&e.message||e)}; } })()`);
const ms=Date.now()-t0;
if(!r.ok){ console.log('*** el export fallo: '+r.err); process.exit(1); }
console.log('terminado en '+(ms/1000).toFixed(1)+' s');
if(!fs.existsSync(OUT)) mal('no hay archivo');
else{
  const mb=(fs.statSync(OUT).size/1048576).toFixed(1);
  const j=JSON.parse(execFileSync(FFP,['-v','quiet','-print_format','json','-show_streams',OUT]).toString());
  const v=j.streams.find(s=>s.codec_type==='video');
  console.log('archivo: '+mb+' MB   '+v.codec_name+'  '+v.width+'x'+v.height+'  '+v.nb_frames+' fotogramas  '+(v.color_space||'(sin etiqueta)')+'/'+(v.color_range||'?'));
  console.log('velocidad: '+(+v.nb_frames*1000/ms).toFixed(1)+' fps');
  if(v.width!==4096||v.height!==4096) mal('no es 4096x4096');
  if(+v.nb_frames!==30) mal('faltan fotogramas: '+v.nb_frames+' de 30');
  if(v.codec_name!=='h264') mal('codec inesperado: '+v.codec_name);
  if(v.color_space!=='bt709') mal('el color no va etiquetado como bt709: '+v.color_space);
  if(v.color_range!=='tv') mal('el rango no va etiquetado como tv: '+v.color_range);
}
console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'la aplicacion exporta MP4 de 4096x4096, etiquetado y por GPU'));
ws.close();
