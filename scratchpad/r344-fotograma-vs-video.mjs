/* [R344] El ClipDecoder entrega el MISMO fotograma que <video>, medido por el camino del export.

   `r342-verif.mjs` mide `elstOff` y `pts0` -o sea, que el demuxador LEE la edit list-, pero no que el
   ClipDecoder ENTREGUE el fotograma correcto, que es lo unico que le importa al export. R342 vivio dos
   rondas dado por bueno con esa sonda siendo inerte. Aqui se mide el FOTOGRAMA: para cada instante t se coge
   el del ClipDecoder por el camino EXACTO del export (`passed` y luego `frameNear`, igual que `seekCDExport`)
   y se compara pixel a pixel contra <video> posicionado en varios desplazamientos.

   Cuatro cosas que esta sonda hace y la anterior no:

   1) VENTANA QUE INCLUYE EL PELIGRO. Comparar solo con +-2 fotogramas no sirve para vigilar R342: perderlo
      desplaza 14 fotogramas en `tunel-elst`, y un desplazamiento fuera de ventana salia "no concluyente", o
      sea VERDE. Se prueba tambien el desplazamiento exacto que produciria perder R342 (`peligro`), asi que la
      red puede ponerse roja por su propio motivo.
   2) SABE DECIR "NO SE PUEDE AFIRMAR". Si los candidatos empatan (tramo quieto), el instante es NO
      CONCLUYENTE. Tampoco se lee como fallo: el argmin caeria en el primero por orden de recorrido.
   3) SE COMPRUEBA A SI MISMA, Y CONTRA EL VALOR EXACTO. Reconstruye el estado PRE-R342 sobre los sellos de
      tiempo (sin tocar app.js) y exige cazarlo EN `peligro`, no en "algun sitio distinto de cero".
   4) NO SE LLEVA RECURSOS POR DELANTE. `finally` cierra el decodificador y el <video> tambien cuando algo
      lanza; si no, quedaba vivo en la app un `keeper` despertando cada 4 ms para siempre, y las redes que
      corren despues median tiempos contaminados.

   Material (comprobado con `r344-lee-elst.mjs`, lector de cajas independiente del demuxador de la app, porque
   si el juez y el acusado son el mismo codigo la prueba no vale):

     OBLIGATORIO, y se rehace con `node scratchpad/r344-material.mjs`:
       tunel-elst.mp4     media_time 7168/12288 = 0,5833 s = 14 fotogramas -> recorte de verdad
       tunel-control.mp4  media_time 1024/12288 = 0,0833 s =  2 fotogramas -> retardo de reordenacion
     OPCIONAL (de la carpeta de descargas; si no estan, se dice y no pasa nada):
       futuristic-...mp4  media_time 1024/15360 =  2 fotogramas
       typewriter-...mp4  media_time 0

   OJO con los dos opcionales: son casi estaticos (0,1 de diferencia entre fotogramas frente a 14,0 del
   tunel), asi que NINGUNA comparacion de vecinos discrimina con ellos y sus filas salen siempre no
   concluyentes. Estan por completitud, no como prueba. Lo que NO es cierto -y R344 lo escribio mal antes de
   medirlo- es que una edit list de 2 fotogramas "no pueda desplazar nada": SI desplaza, y con `tunel-control`
   se mide (ver `r344-comprueba-2frames.mjs`). Lo que se cancela con el `ctts` es el ARRANQUE, no la
   correspondencia instante->fotograma.

   Uso:  npx electron . --remote-debugging-port=9222   y luego   node scratchpad/r344-fotograma-vs-video.mjs
   Codigos de salida: 0 correcto · 1 fallo · 3 no medida (falta el material obligatorio)
*/
import http from 'http';
import { existsSync } from 'fs';

const D='C:/Users/beltr/Downloads/';
const S='C:/Users/beltr/Desktop/Alma Digital Studio/Projects/Immersive Studio Pro/scratchpad/media/';
const CASO=S+'tunel-elst.mp4';
const ARCHIVOS=[
  {n:'CASO: recorte real (14 fotogramas de edit list) + mucho movimiento', p:CASO, req:true},
  {n:'CASO: mismo material, edit list de 2 fotogramas (retardo de reordenacion)', p:S+'tunel-control.mp4', req:true},
  {n:'EXTRA: futuristic del inventario (casi estatico, no puede discriminar)', p:D+'futuristic-circular-minimal-hud-animation-tech-int-2026-01-28-05-35-47-utc.mp4', req:false},
  {n:'EXTRA: typewriter, sin edit list (casi estatico, no puede discriminar)', p:D+'typewriter-2026-07-11-17-31-07.mp4', req:false},
];
const faltanReq=ARCHIVOS.filter(a=>a.req&&!existsSync(a.p));
if(faltanReq.length){
  console.log('   NO MEDIDA: falta el material obligatorio -> '+faltanReq.map(a=>a.p).join(', '));
  console.log('   Se rehace con:  node scratchpad/r344-material.mjs');
  process.exit(3); }

const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&/index\.html/.test(x.url));
if(!pg){ console.log('*** la app no esta escuchando en 9222'); process.exit(1); }
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0; const p=new Map(); ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
/* Por debajo del plazo de `correr-redes.mjs` (180 s): si el lanzador mata antes, el diagnostico propio de la
   sonda no llega a imprimirse y el fallo se lee como "quedo colgada". */
const ev=x=>new Promise(r=>{const i=++id;p.set(i,m=>r(m.result&&m.result.exceptionDetails?('EXC '+(m.result.exceptionDetails.exception?.description||'').slice(0,300)):(m.result&&m.result.result&&m.result.result.value)));ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true,timeout:60000}}));});

/* --- dentro de la app. Sin acentos NI BACKTICKS: viaja dentro de una plantilla. --- */
const PAGINA=(ruta,pre)=>`(async()=>{ let cd=null, v=null; try{
  const RUTA=${JSON.stringify(ruta)}, PRE=${pre?'true':'false'};
  let d=await demuxMP4(RUTA); const off=d.elstOff;
  if(PRE){
    /* Estado PRE-R342 SIN tocar app.js: antes, el demuxador entregaba el sello del MEDIO en vez del de
       PRESENTACION. Se deshace el desfase sumandolo de vuelta a cada muestra. */
    d={...d, samples:d.samples.map(s=>({...s, ptsExact:s.ptsExact+off*1e6, pts:Math.round(s.ptsExact+off*1e6)}))};
  }
  const fps=d.fps||30, fdur=1/fps;
  const peligro=-Math.round(off*fps);          // el desplazamiento que produce PERDER R342 en este archivo
  cd=makeClipDecoder(d,true);                  // ex=true: el mismo modo que usa el export
  const CW=320, CH=180;
  const mk=()=>{ const c=document.createElement('canvas'); c.width=CW; c.height=CH; return [c,c.getContext('2d',{willReadFrequently:true})]; };
  const [c1,x1]=mk(), [c2,x2]=mk();
  v=document.createElement('video'); v.src=DSP.toFileURL(RUTA); v.muted=true; v.playsInline=true; v.preload='auto';
  await new Promise((res,rej)=>{ v.onloadeddata=()=>res(); v.onerror=()=>rej(new Error('el <video> no carga el archivo')); });
  const dur=v.duration;                        // duracion de PRESENTACION: es la linea en la que se posiciona <video>

  const pixVideo=async(t)=>{ await new Promise(res=>{ const on=()=>{ v.removeEventListener('seeked',on); res(); }; v.addEventListener('seeked',on); v.currentTime=t; });
    x2.drawImage(v,0,0,CW,CH); return x2.getImageData(0,0,CW,CH).data; };
  const pixCD=async(t)=>{ const tus=t*1e6; cd.setTarget(tus); const t0=performance.now();
    while(!cd.passed(tus)){ cd.pump(); await new Promise(r=>setTimeout(r,2));
      if(cd.isDead()) throw new Error('el decodificador murio en t='+t);
      /* el mismo techo que el export (seekCDExport): con uno mas generoso, un medio que alla marca _cdFail aqui pasaria */
      if(performance.now()-t0>10000) throw new Error('el decodificador no llega a t='+t+' en 10 s (stats '+JSON.stringify(cd.stats())+')'); }
    const f=cd.frameNear(tus); if(!f) throw new Error('sin fotograma en t='+t);
    x1.drawImage(f,0,0,CW,CH); return x1.getImageData(0,0,CW,CH).data; };
  const dif=(a,b)=>{ let s=0,n=0; for(let i=0;i<a.length;i+=4){ s+=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]); n+=3; } return s/n; };

  // vecindad inmediata MAS el desplazamiento que delataria la perdida de R342
  const ks=[...new Set([-2,-1,0,1,2, peligro-1, peligro, peligro+1])].sort((a,b)=>a-b);
  /* Los instantes se reparten por la ventana en la que TODOS los desplazamientos caben dentro del archivo.
     Si no, el candidato del desplazamiento peligroso se sale por abajo (con 14 fotogramas de desfase, un
     instante al 5% de la duracion pide un tiempo NEGATIVO), se descarta en silencio y la comparacion se
     decide entre los que quedan: la red se pone roja sin que pase nada malo. Lo que se sacrifica es el
     ARRANQUE, no la cola -- el ultimo instante sigue pegado al final, que es donde vive el fallo de R194
     (fotogramas duplicados en silencio si passed da por cerrado el archivo antes de tiempo). */
  const lo=Math.max(0, -ks[0]*fdur)+fdur, hi=dur-Math.max(0,ks[ks.length-1])*fdur-2*fdur;
  const NINST=PRE?3:6;
  const instantes=[]; for(let i=0;i<NINST;i++) instantes.push(+(lo+(hi-lo)*i/(NINST-1)).toFixed(4));
  if(!(hi>lo)) throw new Error('el archivo es demasiado corto para medir un desplazamiento de '+peligro+' fotogramas');
  const filas=[];
  for(const t of instantes){
    const a=await pixCD(t); const ds={};
    for(const k of ks){ const tt=t+k*fdur; if(tt<0||tt>=dur-fdur) continue; ds[k]=+dif(a,await pixVideo(tt)).toFixed(3); }
    let mejor=null, mv=Infinity, seg=Infinity;
    for(const k of Object.keys(ds)) if(ds[k]<mv){ mv=ds[k]; mejor=+k; }
    for(const k of Object.keys(ds)) if(+k!==mejor && ds[k]<seg) seg=ds[k];
    filas.push({t:t, mejor:mejor, gana:mv, seg:(seg===Infinity?null:seg),
                cero:(ds[0]==null?null:ds[0]), enPeligro:(ds[peligro]==null?null:ds[peligro])});
  }
  return JSON.stringify({fps:+fps.toFixed(3), dur:+dur.toFixed(3), off:+off.toFixed(6), peligro:peligro, ks:ks, filas:filas});
}catch(e){ return 'ERR '+String((e&&e.message)||e).slice(0,300);
} finally { try{ cd&&cd.close(); }catch(e){} try{ if(v){ v.removeAttribute('src'); v.load(); } }catch(e){} } })()`;

/* El ganador tiene que DESTACAR sobre el segundo; si no, el instante no prueba nada. */
const destaca=(g,s)=>s!==null&&s>g*3+1.0;

console.log('');
console.log('R344 - el fotograma que entrega el ClipDecoder contra el que muestra <video>');
console.log('       (camino del export: passed + frameNear, igual que seekCDExport)');
const malas=[], dudosas=[];
let hechos=0;
for(const a of ARCHIVOS){
  if(!existsSync(a.p)){ console.log(''); console.log('== '+a.n); console.log('   (ausente, se omite: es opcional)'); continue; }
  console.log('');
  console.log('== '+a.n);
  const r=await ev(PAGINA(a.p,false));
  let o=null; try{ o=JSON.parse(r); }catch(e){ malas.push(a.n+': sonda rota -> '+String(r).slice(0,240)); console.log('   *** '+String(r).slice(0,240)); continue; }
  hechos++;
  console.log('   fps '+o.fps+'  presentacion '+o.dur+' s  edit list '+o.off+' s  ->  perder R342 desplazaria '+o.peligro+' fotogramas');
  for(const f of o.filas){
    let et;
    if(f.mejor===o.peligro && o.peligro!==0 && destaca(f.gana,f.seg)){
      et='t'+o.peligro+'f  *** R342 PERDIDO';
      malas.push(a.n+': en t='+f.t+' el fotograma coincide con <video> en t'+o.peligro+'f ('+f.gana+') y no en t ('+f.cero+'): es exactamente el desplazamiento de la edit list');
    } else if(!destaca(f.gana,f.seg)){
      et='no concluyente (empate)';
      dudosas.push(a.n+': en t='+f.t+' los candidatos empatan (gana '+f.gana+', segundo '+f.seg+'): tramo demasiado quieto para probar nada');
    } else if(f.mejor===0){ et='t  (bien)'; }
    else { et='t'+(f.mejor>0?'+':'')+f.mejor+'f  *** DESPLAZADO';
      malas.push(a.n+': en t='+f.t+' el fotograma coincide con <video> en t'+(f.mejor>0?'+':'')+f.mejor+'f ('+f.gana+') y no en t ('+f.cero+')'); }
    console.log('   t='+String(f.t).padStart(7)+'  en t: '+String(f.cero).padStart(8)+'   en t'+String(o.peligro)+'f: '+String(f.enPeligro).padStart(8)+'   gana -> '+et);
  }
}

/* ---- la sonda contra si misma: sin R342 esto TIENE que salir en `peligro`, no "en algun sitio" ---- */
console.log('');
console.log('== AUTOCOMPROBACION: el mismo CASO con los sellos de tiempo PRE-R342');
console.log('   si la sonda no caza esto EN SU SITIO EXACTO, no vale para afirmar nada de lo de arriba');
const rp=await ev(PAGINA(CASO,true));
let op=null; try{ op=JSON.parse(rp); }catch(e){ op=null; }
if(!op){ console.log('   *** autocomprobacion rota -> '+String(rp).slice(0,240)); malas.push('la autocomprobacion de la sonda no corre'); }
else {
  let cazado=0;
  for(const f of op.filas){
    const ok=destaca(f.gana,f.seg) && f.mejor===op.peligro;
    if(ok)cazado++;
    console.log('   t='+String(f.t).padStart(7)+' -> gana t'+(f.mejor>0?'+':'')+f.mejor+'f (dif '+f.gana+', en t '+f.cero+')'+(ok?'   cazado en su sitio':'   *** NO cazado (se esperaba t'+op.peligro+'f)'));
  }
  console.log('   desplazamiento que predice la edit list: '+op.peligro+' fotogramas ('+op.off+' s a '+op.fps+' fps)');
  if(cazado<op.filas.length) malas.push('la sonda NO caza el estado pre-R342 en su desplazamiento exacto ('+op.peligro+'f) en '+(op.filas.length-cazado)+' instante(s): no tiene dientes, y lo de arriba no queda probado');
}

console.log('');
for(const m of malas)   console.log('   *** '+m);
for(const m of dudosas) console.log('   ??? '+m);
if(malas.length){ console.log('*** '+malas.length+' FALLOS'); }
else { console.log('OK - el ClipDecoder entrega el mismo fotograma que <video> en los '+hechos+' archivos medidos,');
       console.log('     incluido un recorte real de 14 fotogramas; y la sonda caza el estado pre-R342 en su sitio exacto.');
       if(dudosas.length) console.log('     ('+dudosas.length+' instantes no concluyentes, todos en material estatico opcional)'); }
ws.close(); process.exitCode = malas.length?1:0;
