/* [R345] La otra que la auditoria 2026-08-06 dejo marcada como NO CONFIRMADA: «si la caja de forma podria
   quedar apuntando a algo inexistente».

   La caja guarda REFERENCIAS VIVAS a los objetos keyframe (`base:[{k,t,v}]`), no indices ni tiempos, asi que
   cualquier cosa que reemplace o quite esos objetos la deja apuntando al vacio. R328 decidio no cerrarla en
   cada sitio que borra puntos -eran cinco, y anadir la llamada en cada uno es pedir que el sexto se olvide-
   sino COMPROBARLA antes de usarla (`shapeBoxVivo`). Esto mide que esa guarda cubre de verdad los caminos.

   Se prueba cada camino por separado, y en cada uno se exige lo mismo: despues de la accion, usar la caja NO
   puede actuar sobre fantasmas. Vale que se cierre sola (lo esperado) o que siga viva y COHERENTE; lo que no
   vale es que siga abierta apuntando a puntos que ya no estan en la curva.

   Uso:  npx electron . --remote-debugging-port=9222   y luego   node scratchpad/r345-shapebox.mjs
*/
import http from 'http';

const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&/index\.html/.test(x.url));
if(!pg){ console.log('*** la app no esta escuchando en 9222'); process.exit(1); }
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0; const p=new Map(); ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise(r=>{const i=++id;p.set(i,m=>r(m.result&&m.result.exceptionDetails?('EXC '+(m.result.exceptionDetails.exception?.description||'').slice(0,300)):(m.result&&m.result.result&&m.result.result.value)));ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true,timeout:60000}}));});

const PAGINA=`(async()=>{ try{
  const filas=[];
  /* Monta un clip con automatizacion y abre la caja sobre tres puntos. Devuelve el clip. */
  const montar=async()=>{
    await newProject('dome',1024,1024,30,180,true); if(typeof hideLanding==='function')hideLanding();
    const m={id:uid(),kind:'shape',name:'F',shape:'rect',fill:'#fff',stroke:'#000',strokeW:0,sw:64,sh:64,dur:6,fps:0,color:'#888'};
    state.media.push(m);
    const vl=state.lanes.findIndex(l=>l.kind==='video');
    const c=makeClip(m,vl,0); c.dur=6; state.clips.push(c);
    c.kf={size:[{t:0,v:10},{t:1,v:40},{t:2,v:70},{t:3,v:20}]};
    state.selId=c.id; state.selIds=[c.id];
    const ks=c.kf.size;
    state.autoSel={cid:c.id,p:'size',set:new Set([ks[0],ks[1],ks[2]])};
    shapeBoxOpen();
    return c; };
  /* La caja de R328 es DELIBERADAMENTE perezosa: no se cierra en cada sitio que borra puntos -eran cinco y el
     sexto se olvidaria- sino que se valida AL USARSE. Asi que juzgar por «sigue en state despues de borrar» es
     medir la premisa y no la conclusion: lo que importa es que USARLA no actue sobre fantasmas.
     Se mide: (a) no lanza, (b) despues de usarla se ha cerrado sola, (c) la curva no se ha tocado.
     El CONTROL exige lo contrario -que siga viva y que la curva SI cambie-, porque una prueba en la que el
     caso sano y el roto dan lo mismo no distingue nada. */
  /* [R345b] La foto se saca de los puntos que la caja SUJETA (b.base[].k), no de la curva del clip. Leerla a
     traves de clipById(b.cid) dejaba el detector de fantasmas CIEGO justo en los casos que mas importan: con
     el clip borrado o la curva limpiada, antes y despues eran los dos null y cambio no podia moverse.
     Y son esas referencias vivas las que shapeBoxApply mutaria si actuase sobre fantasmas. */
  const foto=(b)=>b?JSON.stringify(b.base.map(o=>[o.k.t,o.k.v])):null;
  const juzgar=(nombre)=>{
    const b=state.shapeBox;
    const antes=foto(b);
    let lanzo=''; try{ shapeBoxSync(); shapeBoxApply(1.1,1,0,0,0,0,0,-1e9,1e9,6); }
    catch(e){ lanzo=String((e&&e.message)||e).slice(0,90); }
    const viva=!!state.shapeBox;
    const despues=foto(b);
    filas.push({caso:nombre, habia:!!b, viva:viva, lanzo:lanzo, cambio:(antes!==despues)});
  };

  // 1) el CLIP entero desaparece
  { const c=await montar(); state.clips=state.clips.filter(x=>x.id!==c.id); juzgar('se borra el clip'); }
  // 2) la curva entera se limpia
  { const c=await montar(); delete c.kf.size; juzgar('se limpia la automatizacion del parametro'); }
  // 3) los objetos keyframe se REEMPLAZAN por otros equivalentes (lo que hace deshacer)
  { const c=await montar(); c.kf.size=c.kf.size.map(k=>({t:k.t,v:k.v})); juzgar('deshacer: los puntos se reemplazan por copias'); }
  // 4) se borran algunos de los puntos que la caja tenia cogidos
  { const c=await montar(); c.kf.size=c.kf.size.slice(2); juzgar('se borran dos de los tres puntos'); }
  /* 5) el CLIP ENTERO se reemplaza por una copia equivalente, que es lo que hace restore() al deshacer.
        [R345b] Antes esta fila llamaba a loadSeqIntoState, y esa funcion pone state.shapeBox=null ELLA
        MISMA: la caja llegaba cerrada a juzgar, la fila imprimia "se cierra sola (bien)" sin haber usado la
        guarda, y seguia verde aunque shapeBoxVivo devolviera siempre true. Contaba como uno de los cinco
        caminos y no cubria ninguno. Reemplazar el clip si deja la caja apuntando a objetos huerfanos. */
  { const c=await montar(); state.clips=state.clips.map(x=>x.id===c.id?{...x,kf:{size:x.kf.size.map(k=>({t:k.t,v:k.v}))}}:x);
    juzgar('deshacer: el clip entero se reemplaza por una copia'); }
  // 6) sano: nada cambia, la caja tiene que SEGUIR viva (si no, la prueba no distingue nada)
  { await montar(); juzgar('CONTROL: no se toca nada'); }
  return JSON.stringify({filas});
}catch(e){ return 'ERR '+String((e&&e.message)||e).slice(0,300); } })()`;

const r=await ev(PAGINA);
let o=null; try{ o=JSON.parse(r); }catch(e){ console.log('*** sonda rota -> '+String(r).slice(0,300)); ws.close(); process.exit(1); }
console.log('');
console.log('R345 - la caja de forma ante lo que le quita los puntos de debajo');
const malas=[];
for(const f of o.filas){
  const ctrl=/^CONTROL/.test(f.caso);
  let veredicto;
  if(ctrl){
    const bien=f.habia&&f.viva&&f.cambio&&!f.lanzo;
    veredicto=bien?'sigue viva y SI mueve la curva (la prueba distingue)':'*** el CONTROL falla: la prueba no distingue nada';
    if(!bien) malas.push(f.caso+': con todo sano la caja deberia seguir viva y mover la curva (viva='+f.viva+', movio='+f.cambio+(f.lanzo?', lanzo: '+f.lanzo:'')+')');
  } else {
    /* [R345b] `habia` se juzga: si la caja no estaba abierta al empezar la fila, esa fila no mide nada — y
       `shapeBoxOpen` NO lanza cuando falla (avisa por pantalla y retorna), asi que un `montar()` que dejara de
       funcionar daba habia=false/viva=false/cambio=false, byte a byte igual que un aprobado legitimo. */
    if(!f.habia){ veredicto='*** la caja NO estaba abierta: la fila no mide nada'; malas.push(f.caso+': montar() no dejo la caja abierta, la fila no prueba nada'); }
    else if(f.lanzo){ veredicto='*** LANZA al usarla: '+f.lanzo; malas.push(f.caso+': usar la caja lanza -> '+f.lanzo); }
    else if(f.cambio){ veredicto='*** ACTUO SOBRE FANTASMAS: la curva cambio'; malas.push(f.caso+': la caja actuo sobre puntos que ya no estaban'); }
    else if(f.viva){ veredicto='*** sigue viva tras usarla: la guarda no la cerro'; malas.push(f.caso+': tras usarla la caja sigue abierta pese a que sus puntos no estan'); }
    else veredicto='se cierra sola al usarla (bien)';
  }
  console.log('   '+f.caso.padEnd(46)+' -> '+veredicto);
}
console.log('');
for(const m of malas) console.log('   *** '+m);
console.log(malas.length?('*** '+malas.length+' FALLOS'):'sin fallos: la caja no sobrevive a que le quiten los puntos, y el control sigue vivo');
ws.close(); process.exitCode = malas.length?1:0;
