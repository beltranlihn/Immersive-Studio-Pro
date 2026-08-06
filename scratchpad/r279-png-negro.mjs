/* [R279] El eslabon que importa, de punta a punta: un export PNG DE VERDAD (2 fotogramas, 256 px) con carpeta
   dada y fondo negro. Prueba las dos cosas a la vez: que `outDir` evita el dialogo nativo -si no lo evitara,
   esto se quedaria colgado esperando un dialogo que nadie va a cerrar- y que el PNG sale OPACO sobre negro.
   Se compara contra el mismo export con alfa, que es lo que lo hace discriminante: si el fondo no se aplicara,
   los dos saldrian iguales. */
import http from 'http'; import fs from 'fs';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise((res,rej)=>{const i=++id;p.set(i,r=>r.error?rej(new Error(JSON.stringify(r.error))):(r.result.exceptionDetails?rej(new Error(r.result.exceptionDetails.exception?.description||r.result.exceptionDetails.text)):res(r.result.result.value)));
  ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true}}));});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let fallos=0; const mal=m=>{ console.log('   *** '+m); fallos++; };

const BASE='C:/Users/beltr/AppData/Local/Temp/claude/C--Users-beltr-Desktop-Alma-Digital-Studio-Projects-Immersive-Studio-Pro/608b54d5-11b8-4b0b-9bce-10a09908c36b/scratchpad';
for(const d of ['r279-alpha','r279-negro']) fs.rmSync(BASE+'/'+d,{recursive:true,force:true});

await ev(`(async()=>{ await newProject('dome',1024,1024,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()`);
await wait(1600);
/* Un clip PEQUENO en el centro del domo: asi queda periferia vacia, que es donde se ve el fondo. */
await ev(`(function(){ const m={id:uid(),name:'x.mp4',kind:'video',w:512,h:512,dur:4,fps:30,color:'#C86A3A',path:'x',folder:null};
  state.media.push(m); renderMedia(); addClip(m,state.lanes[0].id,0);
  const c=state.clips[state.clips.length-1]; c.dur=1; c.props.size=25; c.props.el=60;
  state.playhead=0; renderTimeline(); render(); return 1; })()`);
await wait(500);

const correr=async(dir,bg)=>{ const t0=Date.now();
  await ev(`runExport({codec:'png',res:256,outW:256,outH:256,fps:2,range:'clips',rangeT:[0,1],outDir:${JSON.stringify(dir)},pngBg:${JSON.stringify(bg)},silent:true,job:{prog:()=>{},frame:()=>{},wrote:()=>{},label:()=>{},done:()=>{},warn:()=>{},err:()=>{}}})`);
  return Date.now()-t0; };
console.log('exportando con alfa...');   const ms1=await correr(BASE+'/r279-alpha','alpha');
console.log('exportando sobre negro...'); const ms2=await correr(BASE+'/r279-negro','black');
console.log('   ('+ms1+' ms y '+ms2+' ms: no ha esperado a ningun dialogo nativo)');

const buscar=raiz=>{ if(!fs.existsSync(raiz))return null;
  const subs=fs.readdirSync(raiz,{withFileTypes:true}).filter(d=>d.isDirectory());
  const dir=subs.length?raiz+'/'+subs[0].name:raiz;
  const png=fs.readdirSync(dir).filter(f=>f.endsWith('.png')).sort();
  return png.length?{dir,file:dir+'/'+png[0],n:png.length}:null; };
const A=buscar(BASE+'/r279-alpha'), N=buscar(BASE+'/r279-negro');
console.log('con alfa:  '+(A?A.n+' PNG en '+A.dir.split('/').pop():'(nada)'));
console.log('con negro: '+(N?N.n+' PNG en '+N.dir.split('/').pop():'(nada)'));
if(!A||!N){ mal('el export no ha escrito nada: la carpeta dada no se ha usado'); }
else {
  /* PNG: el tipo de color esta en el byte 25 de la cabecera IHDR. 6 = RGBA, 2 = RGB sin alfa.
     Chromium siempre escribe RGBA desde canvas, asi que hay que mirar los PIXELES, no la cabecera:
     se compara el TAMANO y, sobre todo, se decodifica con la propia app. */
  const b64=f=>fs.readFileSync(f).toString('base64');
  const r=await ev(`(async function(){
    const carga=src=>new Promise(res=>{ const im=new Image(); im.onload=()=>res(im); im.onerror=()=>res(null); im.src=src; });
    const leer=async src=>{ const im=await carga(src); if(!im)return null;
      const cv=document.createElement('canvas'); cv.width=im.width; cv.height=im.height;
      const cx=cv.getContext('2d'); cx.drawImage(im,0,0);
      const d=cx.getImageData(0,0,im.width,im.height).data;
      let opacos=0, transp=0; const N=im.width*im.height;
      for(let i=3;i<d.length;i+=4){ if(d[i]===255)opacos++; else if(d[i]===0)transp++; }
      /* esquina superior izquierda: fuera del disco del domo, siempre vacia */
      const e=[d[0],d[1],d[2],d[3]];
      return {w:im.width,h:im.height,pctOpaco:Math.round(opacos*100/N),pctTransp:Math.round(transp*100/N),esquina:e}; };
    return { alfa: await leer('data:image/png;base64,${b64(A.file)}'),
             negro:await leer('data:image/png;base64,${b64(N.file)}') }; })()`);
  console.log('con alfa  -> opaco '+r.alfa.pctOpaco+'%  transparente '+r.alfa.pctTransp+'%   esquina RGBA='+r.alfa.esquina.join(','));
  console.log('con negro -> opaco '+r.negro.pctOpaco+'%  transparente '+r.negro.pctTransp+'%   esquina RGBA='+r.negro.esquina.join(','));
  if(r.alfa.pctTransp<20) mal('el export con alfa apenas tiene transparencia: la prueba no distingue nada');
  if(r.negro.pctOpaco!==100) mal('con fondo negro quedan pixeles no opacos ('+r.negro.pctOpaco+'% opaco)');
  if(r.negro.esquina[3]!==255) mal('la esquina sigue siendo transparente');
  if(!(r.negro.esquina[0]===0&&r.negro.esquina[1]===0&&r.negro.esquina[2]===0)) mal('la esquina no es NEGRA: '+r.negro.esquina.join(','));
  if(r.alfa.esquina[3]!==0) mal('el export con alfa ya no es transparente: se ha roto lo que funcionaba');
}
console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'la carpeta se usa sin dialogo, y el PNG sobre negro sale opaco sin dejar de ser PNG sin perdida'));
ws.close();
