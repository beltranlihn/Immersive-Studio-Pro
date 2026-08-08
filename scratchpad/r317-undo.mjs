/* [R317] LA RED DE LA FAMILIA «pushUndo ausente».
   La auditoría (§11, patrón 1) contó ~10 miembros vivos y observó que todos se detectan igual: por ASIMETRÍA
   con un camino gemelo que sí empuja deshacer. Se habían ido arreglando de uno en uno, y cada ronda aparecía
   otro. Esto es el equivalente para esta familia de lo que `tests/paridad-serializacion.test.mjs` es para la de
   «heredar del proyecto anterior»: en vez de comprobar el parche, comprueba la REGLA.

   La regla, dicha en una línea: **un gesto que cambia el proyecto se deshace con un Ctrl+Z.**
   Para cada gesto: se toma una foto del estado, se hace el gesto, se comprueba que CAMBIÓ (si no, la
   comprobación no probaría nada), se llama a `undo()` una vez, y se exige que el estado vuelva a la foto.

   No hace falta que el gesto sea deshacible «a mano»: el propio `undo()` es el juez. Y comprobar primero que
   el gesto cambia algo es lo que impide el falso aprobado más tonto de todos — un selector que ya no existe,
   un handler que no se dispara, y la sonda felicitándose por un no-cambio que se deshace solo.

   TRAMPA que costó dos intentos: `state.lanes[0]` PUEDE SER DE AUDIO — `loadSeqIntoState` inserta la pista de
   audio al principio —, y con el clip en una pista de audio el inspector renderiza su variante, que esconde
   Transform, Motion y FX. Los `.aspeed`/`.aamp`/`.amode` no existían en el DOM y la sonda lo leía como fallo del
   código. La pista se elige por `kind`, nunca por índice; es la regla que ESTRUCTURA-DEL-CODIGO ya advierte.

   Uso:  npx electron . --remote-debugging-port=9222   y luego   node scratchpad/r317-undo.mjs
*/
import http from 'http';
const targets = await new Promise((res,rej)=>{ http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{
  let b=''; r.on('data',c=>b+=c); r.on('end',()=>res(JSON.parse(b))); }).on('error',rej); });
const pg = targets.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
if(!pg){ console.log('*** la aplicacion no esta abierta con --remote-debugging-port=9222'); process.exit(1); }
const ws = new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let _id=0; const pend=new Map();
ws.onmessage = e => { const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){ pend.get(m.id)(m); pend.delete(m.id); } };
const ev = expr => new Promise((res,rej)=>{ const i=++_id; pend.set(i,r=>{
    if(r.error) return rej(new Error(JSON.stringify(r.error)));
    if(r.result.exceptionDetails) return rej(new Error(r.result.exceptionDetails.exception?.description||'excepcion'));
    res(r.result.result.value); });
  ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:expr,awaitPromise:true,returnByValue:true,timeout:120000}})); });

let fallos=0;

/* Cada caso: `monta` deja el proyecto listo, `foto` extrae lo que debe volver, `gesto` es la acción bajo prueba. */
const CASOS = [
  { n:'Añadir localizador con la tecla M',
    monta:`const LV=state.lanes.findIndex(l=>l.kind!=='audio'); _demoAddShape('rect','#888',LV,0,4,{x:0,y:0,scale:100}); state.playhead=1;`,
    foto :`(state.markers||[]).length`,
    gesto:`addMarker()` },
  { n:'Quitar el color de una carpeta',
    monta:`state.folders=['Carpeta']; state.folderColors={'Carpeta':'#E0954B'};`,
    foto :`String((state.folderColors||{})['Carpeta'])`,
    gesto:`pushUndo(); bumpMeta(); delete state.folderColors['Carpeta'];` },
  { n:'Renombrar una carpeta',
    monta:`state.folders=['Vieja']; state.folderColors={};`,
    foto :`(state.folders||[]).join('|')`,
    gesto:`pushUndo(); bumpMeta(); _reprefixFolders('Vieja','Nueva');` },
  { n:'Tamaño de máscara',
    monta:`const LV=state.lanes.findIndex(l=>l.kind!=='audio'); _demoAddShape('rect','#888',LV,0,4,{x:0,y:0,scale:100}); const c=state.clips[state.clips.length-1]; state.selId=c.id; c.props.maskScale=1;`,
    foto :`String(selClip().props.maskScale)`,
    gesto:`pushUndo(); selClip().props.maskScale=0.4;` },
  /* Los tres de Motion se disparan por el DOM REAL — su `<select>`/`<input>` con un evento `change`—, que es lo
     único que prueba de verdad que el handler empuja deshacer. Los de arriba reproducen la mutación a mano:
     comprueban que `snapshot`/`restore` CUBREN ese campo, que es la otra mitad del problema (un handler puede
     llamar a pushUndo y aun así no ser deshacible si la foto no guarda el campo), pero no que el handler llame.
     Se distingue en el rótulo para no reclamar más de lo que se mide.
     Ojo: la sección Motion nace PLEGADA (`insColState` la marca `motion:true`), y sus filas no existen en el
     DOM hasta abrirla — el primer intento de esta sonda buscaba `.aspeed` y no lo encontraba. */
  { n:'Velocidad de un modificador de Motion [DOM]',
    monta:`const LV=state.lanes.findIndex(l=>l.kind!=='audio'); _demoAddShape('rect','#888',LV,0,4,{x:0,y:0,scale:100}); const c=state.clips[state.clips.length-1]; state.selId=c.id; addAnimPreset(c,'hmove'); c.anim[0].speed=0.2; insColState().motion=false; renderInspector();`,
    foto :`String(selClip().anim[0].speed)`,
    gesto:`{ const el=document.querySelector('.aspeed'); if(!el)throw new Error('no encuentro .aspeed en el inspector'); el.value='3'; el.dispatchEvent(new Event('change')); }` },
  { n:'Amplitud de un modificador de Motion [DOM]',
    monta:`const LV=state.lanes.findIndex(l=>l.kind!=='audio'); _demoAddShape('rect','#888',LV,0,4,{x:0,y:0,scale:100}); const c=state.clips[state.clips.length-1]; state.selId=c.id; addAnimPreset(c,'hmove'); c.anim[0].amp=10; insColState().motion=false; renderInspector();`,
    foto :`String(selClip().anim[0].amp)`,
    gesto:`{ const el=document.querySelector('.aamp'); if(!el)throw new Error('no encuentro .aamp en el inspector'); el.value='99'; el.dispatchEvent(new Event('change')); }` },
  { n:'Modo de un modificador de Motion [DOM]',
    monta:`const LV=state.lanes.findIndex(l=>l.kind!=='audio'); _demoAddShape('rect','#888',LV,0,4,{x:0,y:0,scale:100}); const c=state.clips[state.clips.length-1]; state.selId=c.id; addAnimPreset(c,'hmove'); c.anim[0].mode='linear'; insColState().motion=false; renderInspector();`,
    foto :`String(selClip().anim[0].mode)`,
    gesto:`{ const el=document.querySelector('.amode'); if(!el)throw new Error('no encuentro .amode en el inspector'); el.value='wave'; el.dispatchEvent(new Event('change')); }` },
];

console.log('\n── un gesto que cambia el proyecto se deshace con UN Ctrl+Z ──');
for(const c of CASOS){
  const r = await ev(`(async()=>{ try{
    await newProject('flat',1920,1080,30,180,true); if(typeof hideLanding==='function')hideLanding();
    ${c.monta}
    /* El historial se vacia DESPUES del montaje. Antes iba delante, y el propio montaje dejaba su entrada
       (_demoAddShape empuja la suya): undo() consumia ESA y restauraba de rebote un estado anterior al gesto,
       asi que el caso pasaba aunque el gesto no empujara nada. La red mentia.
       (Y ojo: nada de acentos graves aqui dentro, que cierran la plantilla de la sonda.) */
    clearAllUndo();
    const antes=${c.foto};
    const pila0=_ustk().u.length;
    ${c.gesto};
    const pila1=_ustk().u.length;
    const tras=${c.foto};
    undo();
    const vuelta=${c.foto};
    return {antes:String(antes),tras:String(tras),vuelta:String(vuelta),pila0,pila1};
  }catch(e){ return {err:String(e&&e.message||e)}; } })()`);
  if(r.err){ console.log('   *** '+c.n+' — no se pudo evaluar: '+r.err); fallos++; continue; }
  if(r.antes===r.tras){ console.log('   *** '+c.n+' — el gesto NO cambio nada ('+r.antes+'): la comprobacion no prueba nada'); fallos++; continue; }
  /* La asercion DIRECTA de la familia: el gesto tiene que haber apilado una foto. Sin ella, un `undo()` que
     restaura por casualidad —consumiendo una entrada ajena— daria por bueno un handler sin `pushUndo`. */
  if(r.pila1<=r.pila0){ console.log('   *** '+c.n+' — el gesto NO empujo deshacer (pila '+r.pila0+' → '+r.pila1+'): le falta pushUndo()'); fallos++; continue; }
  if(r.vuelta!==r.antes){ console.log('   *** '+c.n+' — Ctrl+Z no lo restaura: '+r.antes+' → '+r.tras+' → '+r.vuelta); fallos++; continue; }
  console.log('   ✓ '+c.n+'  ('+r.antes+' → '+r.tras+' → '+r.vuelta+')');
}

/* Y la otra mitad de la familia: los `pushUndo` de MÁS, que apilan una foto sin cambio y hacen que el
   siguiente Ctrl+Z «no haga nada». Se comprueba que un gesto que NO cambia nada tampoco consume historial. */
console.log('\n── un gesto que no cambia nada no consume historial ──');
const vac = await ev(`(async()=>{ try{
  await newProject('flat',1920,1080,30,180,true); if(typeof hideLanding==='function')hideLanding();
  const LV=state.lanes.findIndex(l=>l.kind!=='audio');
  _demoAddShape('rect','#888',LV,0,4,{x:0,y:0,scale:100});
  clearAllUndo();
  const c=state.clips[state.clips.length-1]; state.selId=c.id;
  pushUndo(); c.props.opacity=42;                 // una edicion de verdad
  const pilaTrasEdicion=_ustk().u.length;
  state.selIds=[]; state.selId=null; state.tl.selA=0; state.tl.selB=0;
  toggleDisable();                                 // rango vacio: no debe cambiar nada
  const pilaTrasNoOp=_ustk().u.length;
  undo();
  return {pilaTrasEdicion,pilaTrasNoOp,opacityTrasUndo:String(c.props.opacity)};
}catch(e){ return {err:String(e&&e.message||e)}; } })()`);
if(vac.err){ console.log('   *** no se pudo evaluar: '+vac.err); fallos++; }
else{
  console.log('   pila: '+vac.pilaTrasEdicion+' tras editar → '+vac.pilaTrasNoOp+' tras el gesto vacio');
  if(vac.pilaTrasNoOp>vac.pilaTrasEdicion) console.log('   *** un gesto sin efecto apilo una foto: el siguiente Ctrl+Z parecera «no hacer nada»'), fallos++;
  else if(vac.opacityTrasUndo!=='undefined'&&vac.opacityTrasUndo!=='42') console.log('   ✓ el Ctrl+Z va directo a la edicion real (opacity '+vac.opacityTrasUndo+')');
  else console.log('   ✓ el gesto vacio no consume historial');
}

console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'la familia «pushUndo ausente» queda cubierta por esta red'));
ws.close(); process.exit(fallos?1:0);
