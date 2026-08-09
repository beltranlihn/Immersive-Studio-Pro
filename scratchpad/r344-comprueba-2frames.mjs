/* [R344b] Comprobar una afirmacion MIA antes de dejarla escrita.

   En R344 escribi -en PLAN.md, COMPONENTS.md y docs/NEXT.md- que una edit list de 2 fotogramas (la
   compensacion del retardo de reordenacion) "por construccion no puede desplazar nada", y por eso el archivo
   del inventario servia de control y no de caso. La revision lo puso en duda con un argumento concreto:

     post-R342:  pts_i = (dts_i + cto_i)/ts - desf   ->  presentacion i/fps            (correcto)
     pre-R342:   pts_i = (dts_i + cto_i)/ts          ->  i/fps + desf                  (desplazado)
     => keyForTime(t) elegiria floor(t*fps) - 2 mientras <video> muestra floor(t*fps)

   O sea: lo que arranca en 0 es la PRESENTACION, pero la correspondencia instante->fotograma SI se desplaza.
   Si eso es cierto, mi afirmacion es falsa y hay que corregir los tres documentos.

   Se mide sobre `tunel-control.mp4`, que tiene exactamente esa edit list de 2 fotogramas Y movimiento de
   sobra para discriminar. Ventana +-4 para poder ver el desplazamiento con holgura.

   Uso:  npx electron . --remote-debugging-port=9222   y luego   node scratchpad/r344-comprueba-2frames.mjs
*/
import http from 'http';
import { existsSync } from 'fs';

const S='C:/Users/beltr/Desktop/Alma Digital Studio/Projects/Immersive Studio Pro/scratchpad/media/';
const CLIP=S+'tunel-control.mp4';
if(!existsSync(CLIP)){ console.log('   -- falta '+CLIP+' (se rehace con node scratchpad/r344-material.mjs)'); process.exit(0); }

const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&/index\.html/.test(x.url));
if(!pg){ console.log('*** la app no esta escuchando en 9222'); process.exit(1); }
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0; const p=new Map(); ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise(r=>{const i=++id;p.set(i,m=>r(m.result&&m.result.exceptionDetails?('EXC '+(m.result.exceptionDetails.exception?.description||'').slice(0,300)):(m.result&&m.result.result&&m.result.result.value)));ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true,timeout:150000}}));});

const PAGINA=(pre)=>`(async()=>{ let cd=null, v=null; try{
  const RUTA=${JSON.stringify(CLIP)}, PRE=${pre?'true':'false'}, WIN=4;
  let d=await demuxMP4(RUTA); const off=d.elstOff;
  if(PRE) d={...d, samples:d.samples.map(s=>({...s, ptsExact:s.ptsExact+off*1e6, pts:Math.round(s.ptsExact+off*1e6)}))};
  const fps=d.fps||24, fdur=1/fps;
  cd=makeClipDecoder(d,true);
  const CW=320,CH=180;
  const mk=()=>{const c=document.createElement('canvas');c.width=CW;c.height=CH;return [c,c.getContext('2d',{willReadFrequently:true})];};
  const [c1,x1]=mk(), [c2,x2]=mk();
  v=document.createElement('video'); v.src=DSP.toFileURL(RUTA); v.muted=true; v.playsInline=true; v.preload='auto';
  await new Promise((res,rej)=>{ v.onloadeddata=()=>res(); v.onerror=()=>rej(new Error('el <video> no carga')); });
  const dur=v.duration;                                   // duracion de PRESENTACION, no la del medio
  const pixV=async(t)=>{ await new Promise(res=>{const on=()=>{v.removeEventListener('seeked',on);res();};v.addEventListener('seeked',on);v.currentTime=t;});
    x2.drawImage(v,0,0,CW,CH); return x2.getImageData(0,0,CW,CH).data; };
  const pixC=async(t)=>{ const tus=t*1e6; cd.setTarget(tus); const t0=performance.now();
    while(!cd.passed(tus)){ cd.pump(); await new Promise(r=>setTimeout(r,2));
      if(cd.isDead()) throw new Error('decodificador muerto en '+t);
      if(performance.now()-t0>10000) throw new Error('sin llegar a '+t); }
    const f=cd.frameNear(tus); if(!f) throw new Error('sin fotograma en '+t);
    x1.drawImage(f,0,0,CW,CH); return x1.getImageData(0,0,CW,CH).data; };
  const dif=(a,b)=>{let s=0,n=0;for(let i=0;i<a.length;i+=4){s+=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]);n+=3;}return s/n;};
  const filas=[];
  for(const t of [1.5,3.0,4.5,6.0]){
    if(t>=dur-5*fdur) continue;
    const a=await pixC(t); const ds={};
    for(let k=-WIN;k<=WIN;k++){ const tt=t+k*fdur; if(tt<0||tt>=dur-fdur) continue; ds[k]=+dif(a,await pixV(tt)).toFixed(3); }
    let mejor=null,mv=Infinity,seg=Infinity;
    for(const k of Object.keys(ds)) if(ds[k]<mv){mv=ds[k];mejor=+k;}
    for(const k of Object.keys(ds)) if(+k!==mejor&&ds[k]<seg) seg=ds[k];
    filas.push({t:t,mejor:mejor,gana:mv,seg:(seg===Infinity?null:seg)});
  }
  return JSON.stringify({fps:+fps.toFixed(3), off:+off.toFixed(6), durPres:+dur.toFixed(3), filas:filas});
}catch(e){ return 'ERR '+String((e&&e.message)||e).slice(0,200);
} finally { try{cd&&cd.close();}catch(e){} try{ if(v){v.removeAttribute('src');v.load();} }catch(e){} } })()`;

const destaca=(g,s)=>s!==null&&s>g*3+1.0;
console.log('');
console.log('R344b - una edit list de 2 fotogramas, ?desplaza o no desplaza?');
console.log('        material: tunel-control.mp4 (media_time 1024/12288 = 2 fotogramas a 24 fps)');
const malas=[];
for(const pre of [false,true]){
  const r=await ev(PAGINA(pre));
  let o=null; try{ o=JSON.parse(r); }catch(e){ console.log('   *** '+String(r).slice(0,200)); malas.push('sonda rota'); continue; }
  console.log('');
  console.log('   '+(pre?'PRE-R342 (sellos crudos, como antes del arreglo)':'CON R342 (estado actual)')
             +'   desfase '+o.off+' s a '+o.fps+' fps = '+Math.round(o.off*o.fps)+' fotogramas');
  for(const f of o.filas){
    const disc=destaca(f.gana,f.seg);
    console.log('      t='+String(f.t).padStart(5)+' -> gana t'+(f.mejor>0?'+':'')+f.mejor+'f  (dif '+f.gana+', segundo '+f.seg+')'+(disc?'':'   [no discrimina]'));
    if(!disc) malas.push((pre?'PRE':'CON')+' t='+f.t+': la medida no discrimina, no prueba nada');
    else if(!pre && f.mejor!==0) malas.push('CON R342, t='+f.t+': el fotograma sale desplazado t'+(f.mejor>0?'+':'')+f.mejor+'f');
    else if(pre && f.mejor===0) malas.push('PRE-R342, t='+f.t+': NO se desplaza, o sea que una edit list de 2 fotogramas efectivamente no cambia el fotograma elegido');
  }
}
console.log('');
for(const m of malas) console.log('   *** '+m);
console.log('');
console.log('   Lectura: si PRE sale en t-2f, mi afirmacion de que "2 fotogramas no desplazan nada" es FALSA');
console.log('   y hay que corregir PLAN.md, COMPONENTS.md y docs/NEXT.md.');
ws.close(); process.exitCode = malas.length?1:0;
