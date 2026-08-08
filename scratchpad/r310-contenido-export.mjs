/* [R310] LA SONDA QUE FALTABA: comprueba el CONTENIDO de lo que escribe cada camino de export, no sus metadatos.
   Por que hacia falta. Dos fallos convivian en la rama de FFmpeg tapandose el uno al otro:
     · `fn` no existia en ese ambito, asi que todo export lanzado desde la HOJA moria con ReferenceError. Las
       sondas no lo veian porque pasan `outPath` y el `||` cortocircuita la expresion que lo usaba.
     · Y el bucle convertia `compTex`, una textura que durante un export no escribe nadie: el MP4 salia con el
       ultimo fotograma del VISOR congelado. Tampoco se veia, porque r291 solo mira ffprobe (tamano, codec,
       etiquetas de color) y r292 solo comparaba los ROTULOS de la chapa — que los compone el shader de NV12
       aparte, asi que salian bien sobre una imagen equivocada.
   La leccion: validar metadatos no es validar el archivo. Esta sonda monta una escena cuyo color CAMBIA en el
   tiempo de forma conocida y comprueba que el archivo lo reproduce.

   El criterio es INTRINSECO (no necesita referencia, que es lo que pide NEXT.md): tres formas de color puro se
   suceden — rojo, verde, azul, 0,2 s cada una — y en el archivo se mira que fotograma manda cada canal donde
   toca. Sobrevive al cambio de espacio de color y a la compresion: se compara que canal DOMINA, no valores.
   De regalo cubre el caso «todos los fotogramas iguales», que es la firma exacta del fotograma congelado.

   Se prueban DOS caminos y se exigen iguales: `ffh264` (FFmpeg, el que estaba roto) y `h264` (WebCodecs, que
   funcionaba). Asi la sonda se valida a si misma: si el control tambien fallara, el error estaria en la escena
   o en el metodo, no en el codigo bajo prueba.

   Uso:  npx electron . --remote-debugging-port=9222     y luego     node scratchpad/r310-contenido-export.mjs
*/
import http from 'http'; import fs from 'fs'; import path from 'path';
import { execFileSync } from 'child_process';

const AQUI = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
const OUTDIR = path.join(AQUI, 'out', 'r310');
fs.mkdirSync(OUTDIR, { recursive: true });

/* El binario: el que viaja con la app primero, el del PATH despues — el mismo orden que usa main.js */
function buscarFF(nombre){
  const cand = [ path.join(AQUI,'..','vendor','ffmpeg','win',nombre+'.exe'),
                 'C:/Users/beltr/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1-full_build/bin/'+nombre+'.exe',
                 nombre ];
  for(const c of cand){ try{ execFileSync(c,['-hide_banner','-version'],{stdio:'ignore'}); return c; }catch(e){} }
  return null;
}
const FF = buscarFF('ffmpeg');
if(!FF){ console.log('*** no encuentro ffmpeg (ni empaquetado ni en el PATH)'); process.exit(1); }

/* --- CDP minimo, mismo patron que el resto de las sondas --- */
const targets = await new Promise((res,rej)=>{ http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{
  let b=''; r.on('data',c=>b+=c); r.on('end',()=>res(JSON.parse(b))); }).on('error',rej); });
const pg = targets.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
if(!pg){ console.log('*** la aplicacion no esta abierta con --remote-debugging-port=9222'); process.exit(1); }
const ws = new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let _id=0; const pend=new Map();
ws.onmessage = e => { const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){ pend.get(m.id)(m); pend.delete(m.id); } };
const ev = expr => new Promise((res,rej)=>{ const i=++_id; pend.set(i,r=>{
    if(r.error) return rej(new Error(JSON.stringify(r.error)));
    if(r.result.exceptionDetails) return rej(new Error(r.result.exceptionDetails.exception?.description||'excepcion en la pagina'));
    res(r.result.result.value); });
  ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:expr,awaitPromise:true,returnByValue:true,timeout:600000}})); });

let fallos=0; const mal=m=>{ console.log('   *** '+m); fallos++; };

/* --- La escena: tres colores puros que se suceden, uno cada 0,2 s --- */
const FPS=30, LADO=512, TRAMO=0.2, TOTAL=18;          // 18 fotogramas = 0,6 s = tres tramos de seis
const ESPERADO=['R','R','R','R','R','R','G','G','G','G','G','G','B','B','B','B','B','B'];

console.log('montando la escena (rojo | verde | azul, '+TRAMO+' s cada uno, '+LADO+'² a '+FPS+' fps)…');
const montaje = await ev(`(async()=>{ try{
  await newProject('dome',${LADO},${LADO},${FPS},180,true);
  if(typeof hideLanding==='function')hideLanding();
  const li=state.lanes.findIndex(l=>l.kind==='video');
  const P={az:0,el:90,size:260};                      // centrado en el cenit y desbordando el disco: llena el domo
  _demoAddShape('rect','#FF0000',li,0,${TRAMO},P);
  _demoAddShape('rect','#00FF00',li,${TRAMO},${TRAMO},P);
  _demoAddShape('rect','#0000FF',li,${TRAMO*2},${TRAMO},P);
  renderTimeline(); render();
  return {clips:state.clips.length, dur:duration()};
}catch(e){ return {err:String(e&&e.message||e)}; } })()`);
if(montaje.err||montaje.clips!==3){ console.log('*** no se pudo montar la escena: '+(montaje.err||('clips='+montaje.clips))); process.exit(1); }
await new Promise(r=>setTimeout(r,1200));             // que las tres formas terminen de subir su textura

/* --- Exportar por un camino y devolver la ruta del archivo escrito ---
   `outDir` (no `outPath`) A PROPOSITO: es lo que pasa la hoja de export, y es el camino donde vivia el
   ReferenceError. Con `outPath` la sonda se saltaria justo el fallo que viene a cazar. */
async function exportar(codec, etiqueta){
  const dir = path.join(OUTDIR, etiqueta);
  fs.rmSync(dir,{recursive:true,force:true}); fs.mkdirSync(dir,{recursive:true});
  const t0=Date.now();
  const r = await ev(`(async()=>{ let err=null;
    const job={prog:()=>{},frame:()=>{},wrote:()=>{},label:()=>{},warn:()=>{},done:()=>{},fail:e=>{err=String(e&&e.message||e);}};
    try{
      await runExport({codec:${JSON.stringify(codec)},res:${LADO},outW:${LADO},outH:${LADO},fps:${FPS},
        range:'clips',rangeT:[0,${TOTAL/FPS}],outDir:${JSON.stringify(dir.replace(/\\/g,'/'))},
        noAudio:true,silent:true,bitrate:40e6,ffq:{mbps:40,preset:'p5'},job});
    }catch(e){ err=err||String(e&&e.message||e); }
    return {err}; })()`);
  const ms=Date.now()-t0;
  if(r.err) return {err:r.err, ms};
  const escritos=fs.readdirSync(dir).filter(f=>/\.(mp4|mov)$/i.test(f));
  if(!escritos.length) return {err:'no se escribio ningun archivo en '+dir, ms};
  return {file:path.join(dir,escritos[0]), ms};
}

/* --- Leer el archivo COMO PIXELES: 8×8 en crudo por fotograma, sin dependencias --- */
function coloresDe(file){
  const N=8;
  const raw = execFileSync(FF,['-v','quiet','-i',file,'-vf','scale='+N+':'+N,'-f','rawvideo','-pix_fmt','rgb24','-'],
                           {maxBuffer:1<<28});
  const porFrame=N*N*3, n=Math.floor(raw.length/porFrame), out=[];
  for(let f=0;f<n;f++){ let R=0,G=0,B=0;
    for(let p=0;p<N*N;p++){ const o=f*porFrame+p*3; R+=raw[o]; G+=raw[o+1]; B+=raw[o+2]; }
    R/=N*N; G/=N*N; B/=N*N;
    /* Que canal manda. El umbral evita clasificar ruido en un fotograma casi negro. */
    const mx=Math.max(R,G,B), sum=R+G+B;
    const dom = (sum<24) ? '·' : (mx===R?'R':mx===G?'G':'B');
    out.push({dom, R:Math.round(R), G:Math.round(G), B:Math.round(B)});
  }
  return out;
}

const resultados={};
for(const [codec,etiqueta,titulo] of [['ffh264','ffmpeg','FFmpeg (la rama que estaba rota)'],
                                      ['h264','webcodecs','WebCodecs (control: ya funcionaba)']]){
  console.log('\n── '+titulo+' ──');
  const ex = await exportar(codec, etiqueta);
  if(ex.err){ mal(codec+': el export fallo — '+ex.err); resultados[codec]=null; continue; }
  console.log('   archivo: '+path.basename(ex.file)+'  ('+(fs.statSync(ex.file).size/1024).toFixed(0)+' KB, '+(ex.ms/1000).toFixed(1)+' s)');
  const cols = coloresDe(ex.file);
  const patron = cols.map(c=>c.dom).join('');
  console.log('   patron : '+patron);
  console.log('   esperado: '+ESPERADO.join(''));
  resultados[codec]=patron;

  if(cols.length<TOTAL) mal(codec+': el archivo trae '+cols.length+' fotogramas, se pedian '+TOTAL);
  /* El fallo que nadie veia: todos los fotogramas iguales (el composite del visor, congelado) */
  const distintos=new Set(patron.split('')).size;
  if(distintos<=1) mal(codec+': TODOS los fotogramas son iguales — el archivo no sigue a la linea de tiempo (fotograma congelado)');
  /* Y el contenido, tramo a tramo */
  let errores=0;
  for(let i=0;i<Math.min(TOTAL,cols.length);i++) if(cols[i].dom!==ESPERADO[i]) errores++;
  if(errores) mal(codec+': '+errores+' de '+TOTAL+' fotogramas no llevan el color que les toca'
                  +'  (p. ej. #0 = rgb('+cols[0].R+','+cols[0].G+','+cols[0].B+'), se esperaba rojo)');
  else console.log('   ✓ los '+TOTAL+' fotogramas llevan el color que les toca');
}

/* La sonda se valida a si misma: los dos caminos tienen que contar lo mismo */
if(resultados.ffh264 && resultados.h264 && resultados.ffh264!==resultados.h264)
  mal('los dos caminos no coinciden — FFmpeg dice "'+resultados.ffh264+'" y WebCodecs "'+resultados.h264+'"');

console.log('\n'+(fallos ? '*** '+fallos+' FALLOS' : 'los dos caminos escriben el CONTENIDO de la linea de tiempo, fotograma a fotograma'));
console.log('volcados en '+OUTDIR);
ws.close();
process.exit(fallos?1:0);
