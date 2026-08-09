/* [R345] `uid()` reparte por encima de todo lo que el proyecto trae — en los DOS caminos de carga.

   `uid()` es un contador plano (`let _id=1`), asi que al abrir un proyecto hay que dejarlo por encima del id
   mas alto del archivo; si no, el siguiente objeto que se cree repite un id que ya existe. Ese barrido vive en
   `maxIdEnClip`/`maxIdEnMedio` y lo usan los dos sitios que re-siembran `_id`: el general y el del camino
   LEGACY (`obj.sequences`). R345 nacio porque las dos copias habian divergido.

   [R345b] Esta red estaba mal disenada de tres maneras, todas de la misma familia -aprobar por el motivo
   equivocado- y las tres corregidas aqui:

   1) EL CONTENEDOR VIGILADO TIENE QUE SER EL MAS ALTO, Y DE UNO EN UNO. La primera version puso el id del
      efecto por encima del grupo (los efectos SI se barrian, asi que tapaba el hueco); la segunda puso el
      marcador por encima del grupo (mismo error, otro contenedor). Ahora se corre UNA PASADA POR CONTENEDOR,
      y en cada una ese contenedor lleva el id mas alto del archivo.

   2) NO SE MIDE CON `uid()` A SECAS. La carga gasta ids por su cuenta (`loadSeqIntoState` crea la pista de
      audio que falte), asi que "el siguiente uid() es mayor que el maximo" tenia holgura y podia tapar un
      duplicado REAL ya creado. Lo que se comprueba ahora es la propiedad de verdad: **que no haya dos objetos
      con el mismo id** en el proyecto cargado, y ademas que `uid()` quede por encima del maximo.

   3) EL INVENTARIO DE IDS NO SE ESCRIBE A MANO. Enumerar contenedores en la sonda la hace ciega exactamente a
      los que el codigo tambien olvido -que es el bug-. Se recorre el proyecto SERIALIZADO (`serProject()`, que
      es lo que de verdad se guarda) y se recoge TODO campo `id`/`gid` numerico a cualquier profundidad. Contar
      de mas es inofensivo; contar de menos es el fallo.

   Uso:  npx electron . --remote-debugging-port=9222   y luego   node scratchpad/r345-ids-legacy.mjs
   Codigos de salida: 0 correcto - 1 fallo
*/
import http from 'http';

const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&/index\.html/.test(x.url));
if(!pg){ console.log('*** la app no esta escuchando en 9222'); process.exit(1); }
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0; const p=new Map(); ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise(r=>{const i=++id;p.set(i,m=>r(m.result&&m.result.exceptionDetails?('EXC '+(m.result.exceptionDetails.exception?.description||'').slice(0,300)):(m.result&&m.result.result&&m.result.result.value)));ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true,timeout:60000}}));});

/* --- dentro de la app. Sin acentos ni backticks. --- */
const PAGINA=`(async()=>{ try{
  const filas=[];
  /* Recoge TODO id/gid numerico a cualquier profundidad. Generico a proposito: enumerar contenedores a mano
     haria la sonda ciega justo a los que el codigo tambien olvido, que es el bug.
     OJO con hacerlo sobre el proyecto SERIALIZADO: la secuencia activa sale dos veces -como state.clips y
     otra vez dentro de su medio de nido, que son LOS MISMOS objetos por referencia-, asi que aparecian
     "duplicados" que no lo eran. Se recorre el estado VIVO con un WeakSet: cada objeto se visita una vez, y
     entonces un id repetido significa de verdad dos objetos distintos. */
  const SALTAR=new Set(['el','originalEl','tex','maskTex','_penCv','buffer','frames','peaks','thumb']);
  const idsDe=(o,out,vis)=>{ if(o===null||typeof o!=='object')return out;
    if(vis.has(o))return out; vis.add(o);
    if(Array.isArray(o)){ for(const v of o)idsDe(v,out,vis); return out; }
    const pr=Object.getPrototypeOf(o); if(pr!==Object.prototype&&pr!==null)return out;   // texturas, nodos, AudioBuffer...
    for(const k in o){ if(SALTAR.has(k))continue; const v=o[k];
      if((k==='id'||k==='gid')&&typeof v==='number'&&isFinite(v)&&v>0) out.push(v);
      else idsDe(v,out,vis); }
    return out; };

  /* Un proyecto minimo con UN contenedor llevando el id mas alto. donde elige cual. */
  const fixture=(donde,modo)=>{
    const BAJO=5, ALTO=40;                       // ALTO es el mas alto del archivo salvo que se diga otra cosa
    const clip={id:BAJO+1,mediaId:null,adjust:true,lane:0,start:0,dur:5,inP:0,name:'Ajuste',color:'#B4BAC1',
                props:{opacity:100},kf:{},fx:[{id:donde==='fx'?ALTO:BAJO+2,type:'glow',on:true,params:{}}],
                anim:[{id:donde==='anim'?ALTO:BAJO+3,gid:(donde==='gid'?ALTO:undefined),param:'size',mode:'sine',speed:1,amp:10,phase:0,on:true}]};
    const seq={ id:BAJO, name:'Sec', playhead:0,
      lanes:[{id:BAJO+4,name:'Video 1',tag:'V1',kind:'video'},{id:BAJO+5,name:'Audio 1',tag:'A1',kind:'audio'}],
      clips:[clip],
      groups:[{id:donde==='grupo'?ALTO:BAJO+6,name:'G',kind:'grid'}],
      markers:[{id:donde==='marca'?ALTO:BAJO+7,time:1,name:'m',color:'#fff'}] };
    const base={ app:'dome-studio-pro', v:3, fps:30, seqW:1024, seqH:1024,
      lanes:[{id:1,name:'Video 1',tag:'V1',kind:'video'}], clips:[], markers:[], groups:[],
      autoItems:(donde==='autoItems'?{'x':{id:ALTO,name:'it',pts:[]}}:{}) };
    if(modo==='legacy') return {...base, media:[], sequences:[seq], activeSeqId:seq.id};
    /* modo MODERNO: la secuencia es un medio de nido en obj.media + openSeqs -- el camino que recorre
       cualquier .isp de hoy, y que la version anterior de esta red no llegaba a tocar (iba con media vacio). */
    const nido={ id:seq.id, kind:'nest', name:seq.name, w:1024, h:1024, dur:10, fps:30, mode:'dome', cov:180,
      nestClips:seq.clips, nestLanes:seq.lanes, nestMarkers:seq.markers, nestGroups:seq.groups, nestPlayhead:0 };
    return {...base, media:[nido], openSeqs:[nido.id], activeSeqId:nido.id};
  };

  for(const modo of ['legacy','moderno'])
  for(const donde of ['grupo','marca','fx','anim','gid','autoItems']){
    await newProject('dome',1024,1024,30,180,true); if(typeof hideLanding==='function')hideLanding();
    let cargo=true, err='';
    try{ loadProject(fixture(donde,modo)); }catch(e){ cargo=false; err=String((e&&e.message)||e).slice(0,120); }
    if(!cargo){ filas.push({modo,donde,ok:false,motivo:'la carga lanzo: '+err}); continue; }
    const ids=idsDe({media:state.media,clips:state.clips,lanes:state.lanes,groups:state.groups,
                     markers:state.markers,autoItems:state.autoItems},[],new WeakSet());
    const mx=ids.length?Math.max(...ids):0;
    const vistos=new Set(), dup=[]; for(const v of ids){ if(vistos.has(v))dup.push(v); vistos.add(v); }
    const traeElAlto=ids.includes(40);                 // el material discriminante SOBREVIVIO a la carga
    const siguiente=uid();
    filas.push({modo, donde, ok:(!dup.length && siguiente>mx && traeElAlto),
                dup:[...new Set(dup)], mx, siguiente, traeElAlto});
  }
  return JSON.stringify({filas});
}catch(e){ return 'ERR '+String((e&&e.message)||e).slice(0,300); } })()`;

const r=await ev(PAGINA);
let o=null; try{ o=JSON.parse(r); }catch(e){ console.log('*** sonda rota -> '+String(r).slice(0,300)); ws.close(); process.exit(1); }
console.log('');
console.log('R345 - uid() reparte por encima de todo lo que trae el proyecto');
console.log('   camino     contenedor con el id mas alto   maximo   siguiente   duplicados');
const malas=[];
for(const f of o.filas){
  if(f.motivo){ console.log('   '+f.modo.padEnd(9)+'  '+f.donde.padEnd(28)+' *** '+f.motivo); malas.push(f.modo+'/'+f.donde+': '+f.motivo); continue; }
  console.log('   '+f.modo.padEnd(9)+'  '+f.donde.padEnd(28)+' '+String(f.mx).padStart(6)+'   '+String(f.siguiente).padStart(9)+'   '+(f.dup.length?JSON.stringify(f.dup):'ninguno')+(f.ok?'':'   ***'));
  /* Si el id alto no aparece en el proyecto cargado, la pasada no midio nada: el material no sobrevivio. */
  if(!f.traeElAlto) malas.push(f.modo+'/'+f.donde+': el id mas alto no esta en el proyecto cargado, la pasada NO mide nada');
  else if(f.dup.length) malas.push(f.modo+'/'+f.donde+': DOS objetos con el mismo id '+JSON.stringify(f.dup)+' tras la carga');
  else if(f.siguiente<=f.mx) malas.push(f.modo+'/'+f.donde+': uid() reparte '+f.siguiente+' y ya existe el '+f.mx);
}
console.log('');
for(const m of malas) console.log('   *** '+m);
console.log(malas.length?('*** '+malas.length+' FALLOS'):'sin fallos: ni duplicados ni ids repetibles, en los dos caminos y por cada contenedor');
ws.close(); process.exitCode = malas.length?1:0;
