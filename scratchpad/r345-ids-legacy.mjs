/* [R345] La auditoria 2026-08-06 dejo marcado como NO CONFIRMADO «si los ids de efectos podrian mezclarse
   entre clips por alguna ruta que no encontro». Medido:

   · Los ids de EFECTO estan bien. Las siete busquedas de un efecto por id estan TODAS acotadas al clip
     (`(c.fx||[]).find(f=>f.id===...)`), ningun camino concatena arrays de `fx` -- `pasteAttrs` reemplaza el
     array entero-- y los DOS sitios que re-siembran `_id` al abrir un proyecto escanean los `fx` tanto de los
     clips de primer nivel como de los de dentro de un nido. Compartir un id entre clips distintos es inocuo
     porque nadie busca fuera del clip.

   · Pero comparando esos dos barridos aparece un hueco REAL al lado. `uid()` es un contador plano
     (`let _id=1; const uid=()=>_id++`), asi que al abrir un proyecto hay que ponerlo por encima del id mas alto
     que traiga el archivo. El barrido general (app.js ~11921) cubre marcadores y grupos de dentro de los nidos;
     el del camino LEGACY (`obj.sequences`, ~11969) NO -- y los medios de secuencia de ese camino se crean
     DESPUES del barrido general, asi que sus `nestGroups`/`nestMarkers` no los cuenta nadie.

   Consecuencia: al abrir un `.ise`/`.rdome` con grupos dentro de una secuencia, `_id` puede quedar por debajo
   del id de un grupo, y el siguiente `uid()` lo repite. Dos grupos con el mismo id es serio: `groupId` empareja
   clip y grupo, y R278 ya midio que un miembro con `slot` fuera de rango se ELIMINA en silencio al siguiente
   re-layout.

   Uso:  npx electron . --remote-debugging-port=9222   y luego   node scratchpad/r345-ids-legacy.mjs
*/
import http from 'http';

const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&/index\.html/.test(x.url));
if(!pg){ console.log('*** la app no esta escuchando en 9222'); process.exit(1); }
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0; const p=new Map(); ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise(r=>{const i=++id;p.set(i,m=>r(m.result&&m.result.exceptionDetails?('EXC '+(m.result.exceptionDetails.exception?.description||'').slice(0,300)):(m.result&&m.result.result&&m.result.result.value)));ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true,timeout:60000}}));});

const PAGINA=`(async()=>{ try{
  await newProject('dome',1024,1024,30,180,true); if(typeof hideLanding==='function')hideLanding();
  /* Proyecto en formato LEGACY: 'sequences', no 'openSeqs'. El caso realista NO es un id disparatado: es que
     lo ULTIMO que se creo antes de guardar fuera un grupo (o un marcador) DENTRO de una secuencia, que es lo
     que pasa si agrupas unos clips y guardas. Entonces su id es el mas alto del archivo, y si el barrido no lo
     mira, el contador se queda justo en el y el PROXIMO objeto que se cree lo repite.
     OJO al disenar esto: en la primera version puse el id del efecto POR ENCIMA del grupo, y como los efectos
     SI se barren, el resultado salia limpio por el motivo equivocado. */
  const ALTO_FX=8, ALTO_G=11, ALTO_M=12;
  const obj={ app:'dome-studio-pro', v:3, fps:30, seqW:1024, seqH:1024,
    media:[], lanes:[{id:1,name:'Video 1',tag:'V1',kind:'video'}], clips:[], markers:[], groups:[],
    sequences:[{ id:10, name:'Sec legacy', playhead:0,
      lanes:[{id:2,name:'Video 1',tag:'V1',kind:'video'}],
      clips:[{id:3,mediaId:null,adjust:true,lane:0,start:0,dur:5,inP:0,name:'Ajuste',color:'#B4BAC1',
              props:{opacity:100},kf:{},fx:[{id:ALTO_FX,type:'glow',on:true,params:{}}]}],
      groups:[{id:ALTO_G,name:'G',kind:'grid'}],
      markers:[{id:ALTO_M,time:1,name:'m',color:'#fff'}] }],
    activeSeqId:10 };
  /* loadProject DEVUELVE lo que devuelva _loadProjectCore -- que no es un booleano de exito--, asi que el
     valor de retorno no dice nada. Lo que hay que detectar es que LANCE. */
  let cargo=true, err='';
  try{ loadProject(obj); }catch(e){ cargo=false; err=String((e&&e.message)||e).slice(0,160); }
  // el id mas alto que el proyecto trae de verdad, mirando TODO
  let mx=0; const ver=v=>{ if(typeof v==='number'&&v>mx)mx=v; };
  for(const m of state.media){ ver(m.id);
    if(m.nestClips)for(const c of m.nestClips){ ver(c.id); if(c.fx)for(const f of c.fx)ver(f.id); }
    if(m.nestLanes)for(const l of m.nestLanes)ver(l.id);
    if(m.nestMarkers)for(const k of m.nestMarkers)ver(k.id);
    if(m.nestGroups)for(const g of m.nestGroups)ver(g.id); }
  for(const c of state.clips){ ver(c.id); if(c.fx)for(const f of c.fx)ver(f.id); }
  for(const l of state.lanes)ver(l.id);
  for(const g of (state.groups||[]))ver(g.id);
  for(const k of state.markers)ver(k.id);
  const siguiente=uid();                       // el proximo id que repartira la aplicacion
  return JSON.stringify({ok:cargo, err:err, mx:mx, siguiente:siguiente, colisiona:(siguiente<=mx),
    grupos:(state.media.filter(m=>m.nestGroups&&m.nestGroups.length).map(m=>m.nestGroups.map(g=>g.id))).flat(),
    marcas:(state.media.filter(m=>m.nestMarkers&&m.nestMarkers.length).map(m=>m.nestMarkers.map(k=>k.id))).flat()});
}catch(e){ return 'ERR '+String((e&&e.message)||e).slice(0,300); } })()`;

const r=await ev(PAGINA);
let o=null; try{ o=JSON.parse(r); }catch(e){ console.log('*** sonda rota -> '+String(r).slice(0,300)); ws.close(); process.exit(1); }
console.log('');
console.log('R345 - re-siembra de `uid()` al abrir un proyecto LEGACY (obj.sequences)');
console.log('   proyecto cargado: '+(o.ok?'si':'NO -> '+o.err));
if(!o.ok){ console.log('   *** la carga lanzo: la medida NO vale'); ws.close(); process.exit(1); }
console.log('   grupos dentro de la secuencia:    '+JSON.stringify(o.grupos));
console.log('   marcadores dentro de la secuencia: '+JSON.stringify(o.marcas));
console.log('   id mas alto que trae el proyecto:  '+o.mx);
console.log('   siguiente id que reparte uid():    '+o.siguiente);
console.log('');
if(o.colisiona){
  console.log('   *** COLISION: el siguiente id ('+o.siguiente+') es MENOR O IGUAL que uno que ya existe ('+o.mx+').');
  console.log('       El barrido del camino legacy no cuenta los grupos ni los marcadores de dentro de la secuencia.');
} else {
  console.log('   sin colision: uid() reparte por encima de todo lo que el proyecto trae');
}
ws.close(); process.exitCode = o.colisiona?1:0;
