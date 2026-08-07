/* [R300] La rotacion de fuente del tejido barajado, con los numeros REALES del proyecto de Beltran (Test.isp):
   una tira de 7 elementos separados 40, con un diente de sierra de speed 0.3 y amp 40, y cuatro anillos
   distintos repartidos por el barajado.

   Lo que hay que demostrar es una igualdad, no un parecido: JUSTO DESPUES de que el diente vuelva, cada
   POSICION de la pantalla tiene que estar enseñando la misma imagen que enseñaba justo antes. Si es asi, el
   salto es un no-op perfecto y no se ve. */
import http from 'http';
const t=await new Promise((r2,j)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>r2(JSON.parse(b)));}).on('error',j);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise((res,rej)=>{const i=++id;p.set(i,r=>r.error?rej(new Error(JSON.stringify(r.error))):(r.result.exceptionDetails?rej(new Error(r.result.exceptionDetails.exception?.description||'')):res(r.result.result.value)));ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true}}));});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let fallos=0; const mal=m=>{ console.log('   *** '+m); fallos++; };

await ev("(async()=>{ await newProject('dome',1024,1024,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()");
await wait(2000);

const r=await ev(`(function(){
  const SP=40, SPD=0.3, N=7;
  /* Cuatro anillos, como los suyos, repartidos por el barajado en una tira de 7. */
  const orden=[2,0,0,2,3,1,0];
  const cl=[];
  for(let i=0;i<N;i++) cl.push({ id:100+i, mediaId:1000+orden[i], lane:i, start:0, dur:5, inP:0,
    props:{x:-140+i*SP,y:-80,scale:20}, _layBase:{x:-140+i*SP,y:-80,scale:20},
    anim:[{id:200+i,param:'x',mode:'saw',speed:SPD,amp:SP,phase:0,curve:0,on:true,_lay:1}] });
  const nido={ id:900, kind:'nest', name:'Tejido', dur:5, nestClips:cl,
               comp:{ id:17, kind:'weave', shuffle:true, bands:1, count:N, motion:'same' } };
  wvPrep(nido);
  const per=1/SPD;
  const tienen=cl.filter(c=>c._wv).length;
  /* El reloj de los modificadores en un instante dado -aqui sin nidos loopeados de por medio, animTime = t-. */
  const posDe=(c,tt)=>{ const f=((SPD*tt)%1+1)%1; return (c._layBase.x)+SP*f; };
  const mapa=tt=>{ const m={}; for(const c of cl) m[Math.round(posDe(c,tt)*100)/100]=mediaEfId(c,tt); return m; };
  const D=0.004, tv=per;                    /* la primera vuelta del diente */
  const antes=mapa(tv-D), despues=mapa(tv+D);
  /* Se comparan las posiciones que existen en los DOS mapas: el elemento que sale por un extremo y el que
     entra por el otro no tienen pareja, y compararlos seria comparar cosas distintas. */
  let comunes=0, iguales=0, distintas=[];
  for(const k of Object.keys(antes)){
    const k2=Object.keys(despues).find(x=>Math.abs(+x-+k)<0.5);
    if(k2==null)continue; comunes++;
    if(antes[k]===despues[k2])iguales++; else distintas.push(k+': '+antes[k]+' -> '+despues[k2]);
  }
  return { tienen, per, comunes, iguales, distintas:distintas.slice(0,4),
           ord:(cl[0]._wv?cl[0]._wv.ord.join(','):'(sin rotacion)') }; })()`);

console.log('elementos con rotacion: '+r.tienen+' de 7   orden de la tira: '+r.ord);
console.log('periodo del diente: '+r.per.toFixed(3)+' s');
console.log('posiciones comparables al cruzar la vuelta: '+r.comunes+'   con la MISMA imagen: '+r.iguales);
if(r.distintas.length) console.log('   cambian: '+r.distintas.join('   '));
if(r.tienen!==7) mal('la rotacion no se ha derivado para los 7 elementos');
if(!r.comunes) mal('no hay posiciones comparables: la prueba no compara nada');
if(r.iguales!==r.comunes) mal((r.comunes-r.iguales)+' posiciones cambian de imagen al volver el diente: el salto se sigue viendo');
console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'al volver el diente, cada posicion sigue enseñando la misma imagen: el salto es invisible'));
ws.close(); process.exit(fallos?1:0);
