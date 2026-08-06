/* [R279] La misma prueba del export PNG, pero con una FOTO DE VERDAD de la carpeta de descargas. La anterior
   salia con el fotograma vacio -el medio simulado no tenia archivo-, asi que probaba el alfa y la carpeta pero
   no el contenido. Aqui hay imagen, y eso permite comprobar lo que faltaba: que el fondo negro se mete DEBAJO
   sin tocar los pixeles del clip. Se comparan los dos exports pixel a pixel. */
import http from 'http'; import fs from 'fs';
const FOTO=process.argv[2]||'C:/Users/beltr/Downloads/EIT dia 1 (9).png';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise((res,rej)=>{const i=++id;p.set(i,r=>r.error?rej(new Error(JSON.stringify(r.error))):(r.result.exceptionDetails?rej(new Error(r.result.exceptionDetails.exception?.description||r.result.exceptionDetails.text)):res(r.result.result.value)));
  ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true}}));});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let fallos=0; const mal=m=>{ console.log('   *** '+m); fallos++; };

const BASE='C:/Users/beltr/AppData/Local/Temp/claude/C--Users-beltr-Desktop-Alma-Digital-Studio-Projects-Immersive-Studio-Pro/608b54d5-11b8-4b0b-9bce-10a09908c36b/scratchpad';
for(const d of ['r279f-alpha','r279f-negro']) fs.rmSync(BASE+'/'+d,{recursive:true,force:true});
if(!fs.existsSync(FOTO)){ console.log('*** no existe la foto: '+FOTO); process.exit(1); }
const bytes=fs.readFileSync(FOTO);
console.log('foto: '+FOTO.split('/').pop()+'  ('+Math.round(bytes.length/1024)+' KB)');

await ev(`(async()=>{ await newProject('dome',1024,1024,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()`);
await wait(1600);

/* Se entrega como File, que es por donde entra de verdad al importar: addImage(file,path). */
const nom=FOTO.split('/').pop();
const alta=await ev(`(async function(){
  const b64='${bytes.toString('base64')}';
  const bin=atob(b64); const u=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);
  const f=new File([u], ${JSON.stringify(nom)}, {type:'image/png'});
  addImage(f, ${JSON.stringify(FOTO)});
  for(let k=0;k<60;k++){ if(state.media.some(m=>m.kind==='image'))break; await new Promise(s=>setTimeout(s,100)); }
  const m=state.media.find(x=>x.kind==='image'); if(!m)return 'no ha entrado';
  /* DOS trampas juntas, y por eso las pruebas anteriores exportaban fotogramas vacios -no fallaba el export,
     fallaba el montaje-: state.lanes[0] es la pista de AUDIO, y addClip recibe el INDICE de la pista, no su
     id (dentro hace state.lanes.findIndex). Pasarle un id se interpreta como un indice inexistente. */
  const iv=state.lanes.findIndex(l=>l.kind==='video'); if(iv<0)return 'no hay pista de video';
  addClip(m,iv,0);
  const c=state.clips[state.clips.length-1]; c.dur=1; c.props.size=110; c.props.el=0;   /* grande y centrado: hace falta superficie opaca para comparar */
  state.playhead=0.2; renderTimeline(); render();
  return 'ok '+m.w+'x'+m.h; })()`);
console.log('importada: '+alta);
if(String(alta).indexOf('ok')!==0){ console.log('*** la foto no ha entrado en el proyecto'); process.exit(1); }
await wait(700);

const correr=async(dir,bg)=>{ const t0=Date.now();
  await ev(`runExport({codec:'png',res:512,outW:512,outH:512,fps:2,range:'clips',rangeT:[0,1],outDir:${JSON.stringify(dir)},pngBg:${JSON.stringify(bg)},silent:true,job:{prog:()=>{},frame:()=>{},wrote:()=>{},label:()=>{},done:()=>{},warn:()=>{},err:()=>{}}})`);
  return Date.now()-t0; };
const ms1=await correr(BASE+'/r279f-alpha','alpha');
const ms2=await correr(BASE+'/r279f-negro','black');
console.log('exportados en '+ms1+' ms y '+ms2+' ms (sin esperar ningun dialogo)');

const buscar=raiz=>{ if(!fs.existsSync(raiz))return null;
  const subs=fs.readdirSync(raiz,{withFileTypes:true}).filter(d=>d.isDirectory());
  const dir=subs.length?raiz+'/'+subs[0].name:raiz;
  const png=fs.readdirSync(dir).filter(f=>f.endsWith('.png')).sort();
  return png.length?{dir,file:dir+'/'+png[0],n:png.length}:null; };
const A=buscar(BASE+'/r279f-alpha'), N=buscar(BASE+'/r279f-negro');
if(!A||!N){ mal('el export no ha escrito en la carpeta dada'); }
else{
  const b64=f=>fs.readFileSync(f).toString('base64');
  const r=await ev(`(async function(){
    const leer=src=>new Promise(res=>{ const im=new Image(); im.onload=()=>{
        const cv=document.createElement('canvas'); cv.width=im.width; cv.height=im.height;
        const cx=cv.getContext('2d'); cx.drawImage(im,0,0); res(cx.getImageData(0,0,im.width,im.height)); };
      im.onerror=()=>res(null); im.src=src; });
    const a=await leer('data:image/png;base64,${b64(A.file)}');
    const n=await leer('data:image/png;base64,${b64(N.file)}');
    if(!a||!n)return null;
    const da=a.data, dn=n.data; const N2=a.width*a.height;
    let opA=0, opN=0, conColor=0, igualesDondeOpaco=0, distintos=0;
    for(let i=0;i<da.length;i+=4){
      if(da[i+3]===255)opA++; if(dn[i+3]===255)opN++;
      /* SOLO alfa 255. Con 251-254, componer sobre negro oscurece el pixel una fraccion -es la formula
         src-over, no un fallo-, y contarlos como «alterados» daba un falso positivo de 18 px. */
      if(da[i+3]===255){ conColor++;
        /* donde el clip era OPACO, el fondo no debe haber cambiado nada */
        if(da[i]===dn[i]&&da[i+1]===dn[i+1]&&da[i+2]===dn[i+2])igualesDondeOpaco++; else distintos++; }
    }
    const esq=[dn[0],dn[1],dn[2],dn[3]], esqA=[da[0],da[1],da[2],da[3]];
    return {w:a.width,pctOpA:Math.round(opA*100/N2),pctOpN:Math.round(opN*100/N2),
            conColor, igualesDondeOpaco, distintos, esq, esqA}; })()`);
  console.log('con alfa  -> '+r.pctOpA+'% opaco   esquina RGBA='+r.esqA.join(','));
  console.log('con negro -> '+r.pctOpN+'% opaco   esquina RGBA='+r.esq.join(','));
  console.log('pixeles del clip (opacos): '+r.conColor+'   identicos en los dos: '+r.igualesDondeOpaco+'   alterados: '+r.distintos);
  /* Umbral honesto: una foto 2,5:1 deformada sobre el disco del domo a 512 px deja unos pocos miles de pixeles
   COMPLETAMENTE opacos; el resto del disco queda en cobertura parcial. Con exigir 20 000 solo lograba que la
   prueba fallara sin senalar ningun defecto. Lo que importa no es cuantos son, sino que ninguno cambie. */
if(r.conColor<1000) mal('apenas hay imagen en el fotograma ('+r.conColor+' px): la prueba no compara nada');
  if(r.pctOpA>85) mal('el export con alfa casi no tiene transparencia: no distingue');
  if(r.pctOpN!==100) mal('con fondo negro quedan pixeles no opacos');
  if(r.esq[3]!==255||r.esq[0]||r.esq[1]||r.esq[2]) mal('la esquina no es negro opaco: '+r.esq.join(','));
  if(r.esqA[3]!==0) mal('el export con alfa ha dejado de ser transparente');
  if(r.distintos) mal(r.distintos+' pixeles del clip han cambiado de color: el fondo se esta mezclando con la imagen, no metiendose debajo');
}
console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'con una foto real: el negro se mete DEBAJO sin tocar un solo pixel de la imagen'));
ws.close();
