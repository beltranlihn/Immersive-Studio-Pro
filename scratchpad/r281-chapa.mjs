/* [R281] Datos en las esquinas del master de domo. Lo que hay que demostrar:
     - el circulo NO se toca: ningun pixel dentro del disco cambia respecto al mismo export sin chapa;
     - los datos SI estan, en las cuatro esquinas;
     - los fotogramas y el timecode AVANZAN entre un fotograma y el siguiente;
     - un nombre larguisimo no desborda ni invade. */
import http from 'http'; import fs from 'fs';
const FOTO='C:/Users/beltr/Downloads/EIT dia 1 (9).png';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise((res,rej)=>{const i=++id;p.set(i,r=>r.error?rej(new Error(JSON.stringify(r.error))):(r.result.exceptionDetails?rej(new Error(r.result.exceptionDetails.exception?.description||r.result.exceptionDetails.text)):res(r.result.result.value)));
  ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true}}));});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let fallos=0; const mal=m=>{ console.log('   *** '+m); fallos++; };

const BASE='C:/Users/beltr/AppData/Local/Temp/claude/C--Users-beltr-Desktop-Alma-Digital-Studio-Projects-Immersive-Studio-Pro/608b54d5-11b8-4b0b-9bce-10a09908c36b/scratchpad';
for(const d of ['r281-sin','r281-con']) fs.rmSync(BASE+'/'+d,{recursive:true,force:true});
const bytes=fs.readFileSync(FOTO);

await ev(`(async()=>{ await newProject('dome',1024,1024,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()`);
await wait(1600);
const alta=await ev(`(async function(){
  const b64='${bytes.toString('base64')}';
  const bin=atob(b64); const u=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);
  addImage(new File([u],'foto.png',{type:'image/png'}), 'foto.png');
  for(let k=0;k<60;k++){ if(state.media.some(m=>m.kind==='image'))break; await new Promise(s=>setTimeout(s,100)); }
  const m=state.media.find(x=>x.kind==='image'); if(!m)return 'no';
  const iv=state.lanes.findIndex(l=>l.kind==='video');
  addClip(m,iv,0); const c=state.clips[state.clips.length-1];
  c.dur=2; c.props.size=110; c.props.el=0; renderTimeline(); render(); return 'ok'; })()`);
if(alta!=='ok'){ console.log('*** la foto no ha entrado'); process.exit(1); }
await wait(700);

/* Un logo sintetico: un cuadrado rojo, facil de localizar despues. */
const logo=await ev(`(function(){ const cv=document.createElement('canvas'); cv.width=cv.height=64;
  const x=cv.getContext('2d'); x.fillStyle='#E03C3C'; x.fillRect(0,0,64,64); return cv.toDataURL('image/png'); })()`);

const OBRA='Rito Digital con un titulo larguisimo que no cabe';
const correr=async(dir,slate)=>ev(`runExport({codec:'png',res:1024,outW:1024,outH:1024,fps:4,range:'clips',rangeT:[0,0.75],outDir:${JSON.stringify(dir)},pngBg:'black',
   slate:${JSON.stringify(slate)},silent:true,job:{prog:()=>{},frame:()=>{},wrote:()=>{},label:()=>{},done:()=>{},warn:()=>{},err:()=>{}}})`);
await correr(BASE+'/r281-sin',{on:false});
await correr(BASE+'/r281-con',{on:true,obra:OBRA,autor:'Alma Digital Studio',logo:logo,durTxt:'00:00:45'});

const buscar=raiz=>{ if(!fs.existsSync(raiz))return null;
  const subs=fs.readdirSync(raiz,{withFileTypes:true}).filter(d=>d.isDirectory());
  const dir=subs.length?raiz+'/'+subs[0].name:raiz;
  const png=fs.readdirSync(dir).filter(f=>f.endsWith('.png')).sort();
  return png.length?{dir,files:png.map(f=>dir+'/'+f)}:null; };
const SIN=buscar(BASE+'/r281-sin'), CON=buscar(BASE+'/r281-con');
if(!SIN||!CON){ console.log('*** no se ha exportado'); process.exit(1); }
console.log('fotogramas: '+SIN.files.length+' sin chapa, '+CON.files.length+' con chapa');

const b64=f=>fs.readFileSync(f).toString('base64');
const r=await ev(`(async function(){
  const leer=src=>new Promise(res=>{ const im=new Image(); im.onload=()=>{ const cv=document.createElement('canvas');
      cv.width=im.width; cv.height=im.height; const x=cv.getContext('2d'); x.drawImage(im,0,0);
      res(x.getImageData(0,0,im.width,im.height)); }; im.onerror=()=>res(null); im.src=src; });
  const a=await leer('data:image/png;base64,${b64(SIN.files[0])}');
  const b=await leer('data:image/png;base64,${b64(CON.files[0])}');
  const c=await leer('data:image/png;base64,${b64(CON.files[1])}');
  if(!a||!b||!c)return null;
  const W=a.width,H=a.height,cx=W/2,cy=H/2,R=Math.min(W,H)/2;
  let dentroDistintos=0, fueraDistintos=0, dentroTotal=0;
  const esq={ai:0,ad:0,bi:0,bd:0};
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){ const i=(y*W+x)*4;
    const dif=(a.data[i]!==b.data[i]||a.data[i+1]!==b.data[i+1]||a.data[i+2]!==b.data[i+2]);
    const dd=(x-cx)*(x-cx)+(y-cy)*(y-cy);
    if(dd<R*R){ dentroTotal++; if(dif)dentroDistintos++; }
    else if(dif){ fueraDistintos++;
      if(x<cx&&y<cy)esq.ai++; else if(x>=cx&&y<cy)esq.ad++; else if(x<cx)esq.bi++; else esq.bd++; } }
  /* que el fotograma 2 se diferencie del 1 SOLO en la esquina de abajo-derecha (fotogramas y timecode) */
  let cambiaEntreFrames=0, cambiaFueraDeEsaEsquina=0;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){ const i=(y*W+x)*4;
    if(b.data[i]!==c.data[i]||b.data[i+1]!==c.data[i+1]||b.data[i+2]!==c.data[i+2]){
      cambiaEntreFrames++; if(!(x>=cx&&y>=cy))cambiaFueraDeEsaEsquina++; } }
  /* el logo rojo, arriba a la izquierda */
  let rojo=0; for(let y=0;y<H/2;y++)for(let x=0;x<W/2;x++){ const i=(y*W+x)*4;
    if(b.data[i]>180&&b.data[i+1]<90&&b.data[i+2]<90)rojo++; }
  return {W,H,dentroTotal,dentroDistintos,fueraDistintos,esq,cambiaEntreFrames,cambiaFueraDeEsaEsquina,rojo}; })()`);

console.log('circulo: '+r.dentroTotal+' px   alterados por la chapa: '+r.dentroDistintos);
console.log('fuera del circulo, px con datos: '+r.fueraDistintos+'   por esquina '+JSON.stringify(r.esq));
console.log('logo rojo detectado: '+r.rojo+' px');
console.log('entre el fotograma 1 y el 2 cambian '+r.cambiaEntreFrames+' px, de ellos fuera de la esquina inferior derecha: '+r.cambiaFueraDeEsaEsquina);

if(r.dentroDistintos) mal(r.dentroDistintos+' pixeles DENTRO del circulo han cambiado: la chapa invade lo que se proyecta');
if(r.fueraDistintos<3000) mal('apenas hay datos dibujados ('+r.fueraDistintos+' px)');
for(const k of ['ai','ad','bi','bd']) if(r.esq[k]<200) mal('la esquina '+k+' esta vacia ('+r.esq[k]+' px)');
if(!r.rojo) mal('el logo no se ha dibujado');
if(!r.cambiaEntreFrames) mal('los fotogramas no avanzan: el contador y el timecode estan congelados');
if(r.cambiaFueraDeEsaEsquina) mal(r.cambiaFueraDeEsaEsquina+' px cambian fuera de la esquina del contador entre fotograma y fotograma');

console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'los datos ocupan las cuatro esquinas, avanzan, y no tocan un solo pixel del circulo'));
ws.close();
