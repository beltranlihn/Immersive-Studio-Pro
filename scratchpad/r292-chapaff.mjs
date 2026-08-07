/* [R292] La chapa en la ruta de FFmpeg. Se exporta DOS veces lo mismo, con chapa y sin ella, y se comprueba:
     - que con chapa aparecen datos FUERA del circulo y ninguno DENTRO;
     - que el contador AVANZA entre fotogramas;
     - que subir lo estatico una sola vez no ha costado velocidad. */
import http from 'http'; import fs from 'fs'; import { execFileSync } from 'child_process';
const FF='C:/Users/beltr/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1-full_build/bin/ffmpeg.exe';
const BASE='C:/Users/beltr/AppData/Local/Temp/claude/C--Users-beltr-Desktop-Alma-Digital-Studio-Projects-Immersive-Studio-Pro/608b54d5-11b8-4b0b-9bce-10a09908c36b/scratchpad';
const SIN=BASE+'/r292-sin.mp4', CON=BASE+'/r292-con.mp4';
for(const f of [SIN,CON]) try{ fs.unlinkSync(f); }catch(e){}
const t=await new Promise((r2,j)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>r2(JSON.parse(b)));}).on('error',j);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise((res,rej)=>{const i=++id;p.set(i,r=>r.error?rej(new Error(JSON.stringify(r.error))):(r.result.exceptionDetails?rej(new Error(r.result.exceptionDetails.exception?.description||'')):res(r.result.result.value)));ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true}}));});
let fallos=0; const mal=m=>{ console.log('   *** '+m); fallos++; };
await ev("(async()=>{ await newProject('dome',1024,1024,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()");
await new Promise(r=>setTimeout(r,2200));
const bytes=fs.readFileSync('C:/Users/beltr/Downloads/EIT dia 1 (9).png');
await ev(`(async function(){
  const b64='${bytes.toString('base64')}'; const bin=atob(b64);
  const u=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);
  addImage(new File([u],'foto.png',{type:'image/png'}),'foto.png');
  for(let k=0;k<60;k++){ if(state.media.some(m=>m.kind==='image'))break; await new Promise(s=>setTimeout(s,100)); }
  const m=state.media.find(x=>x.kind==='image');
  addClip(m,state.lanes.findIndex(l=>l.kind==='video'),0);
  const c=state.clips[state.clips.length-1]; c.dur=1; c.props.size=110; c.props.el=0;
  renderTimeline(); render(); return 1; })()`);
const logo=await ev("(function(){ const cv=document.createElement('canvas'); cv.width=cv.height=64; const x=cv.getContext('2d'); x.fillStyle='#E03C3C'; x.fillRect(0,0,64,64); return cv.toDataURL('image/png'); })()");
const correr=async(out,slate)=>{ const t0=Date.now();
  const r=await ev(`(async function(){ try{ await runExport({codec:'ffh264',res:1024,outW:1024,outH:1024,fps:10,range:'clips',rangeT:[0,0.6],
    outPath:${JSON.stringify(out)},noAudio:true,silent:true,ffq:{mbps:80,preset:'p4'},slate:${JSON.stringify(slate)},
    job:{prog:()=>{},frame:()=>{},wrote:()=>{},label:()=>{},done:()=>{},warn:()=>{},err:()=>{}}}); return {ok:true};
  }catch(e){ return {ok:false,err:String(e&&e.message||e)}; } })()`);
  return {r, ms:Date.now()-t0}; };
const a=await correr(SIN,{on:false});
if(!a.r.ok){ console.log('*** sin chapa fallo: '+a.r.err); process.exit(1); }
const b=await correr(CON,{on:true,obra:'Rito Digital',autor:'Alma Digital Studio',logo,durTxt:'00:00:45'});
if(!b.r.ok){ console.log('*** con chapa fallo: '+b.r.err); process.exit(1); }
console.log('sin chapa: '+(a.ms/1000).toFixed(1)+' s   con chapa: '+(b.ms/1000).toFixed(1)+' s');
/* Se saca el flujo ENTERO en crudo y se trocea por fotogramas: el filtro `select` con la coma escapada no
   sobrevive al paso por el interprete de ordenes, y perseguir eso no aporta nada a lo que se quiere medir. */
const crudo=o=>execFileSync(FF,['-hide_banner','-loglevel','error','-i',o,'-f','rawvideo','-pix_fmt','rgb24','-'],
  {maxBuffer:1<<30, stdio:['ignore','pipe','ignore']});
const FR=1024*1024*3;
const todoC=crudo(CON), todoS=crudo(SIN);
const f1=todoC.subarray(FR*1,FR*2), f4=todoC.subarray(FR*4,FR*5), s1=todoS.subarray(FR*1,FR*2);
console.log('fotogramas leidos: '+Math.floor(todoC.length/FR)+' con chapa, '+Math.floor(todoS.length/FR)+' sin');
const W=1024,H=1024;
let dentro=0,fuera=0,rojo=0, cambia=0, cambiaFuera=0;
const R=W/2, cx=W/2, cy=H/2;
for(let y=0;y<H;y++)for(let x=0;x<W;x++){ const i=(y*W+x)*3;
  const dif=Math.abs(f1[i]-s1[i])+Math.abs(f1[i+1]-s1[i+1])+Math.abs(f1[i+2]-s1[i+2]);
  const d=(x-cx)*(x-cx)+(y-cy)*(y-cy);
  if(dif>30){ if(d<R*R)dentro++; else fuera++; }
  if(d>=R*R && x<cx && y<cy && f1[i]>150 && f1[i+1]<90 && f1[i+2]<90) rojo++;
  const dd=Math.abs(f1[i]-f4[i])+Math.abs(f1[i+1]-f4[i+1])+Math.abs(f1[i+2]-f4[i+2]);
  if(dd>30){ cambia++; if(!(x>=cx&&y>=cy))cambiaFuera++; } }
console.log('con chapa vs sin chapa -> px distintos FUERA del circulo: '+fuera+'   DENTRO: '+dentro);
console.log('logo rojo arriba-izquierda: '+rojo+' px');
console.log('entre fotograma 1 y 4 cambian '+cambia+' px, fuera de la esquina del contador: '+cambiaFuera);
if(fuera<300) mal('la chapa no se ve en el export por FFmpeg ('+fuera+' px)');
if(dentro>400) mal(dentro+' px cambiados DENTRO del circulo: la chapa invade lo proyectable');
if(!rojo) mal('el logo no aparece');
if(!cambia) mal('el contador no avanza entre fotogramas');
if(b.ms>a.ms*2.2) mal('la chapa cuesta demasiado: '+(b.ms/a.ms).toFixed(1)+'x mas lento');
console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'la chapa aparece en el export por FFmpeg, avanza y no toca el circulo'));
ws.close();
