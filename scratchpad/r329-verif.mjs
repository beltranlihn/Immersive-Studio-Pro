/* [R329] Copias sueltas, curvas de Mix huerfanas y tres listas distintas de "que se ve" — del inventario.
     1 · Alt+arrastrar un par A/V copiaba las dos mitades SUELTAS: dejaban de moverse y borrarse juntas, y no
         habia forma de volver a enlazarlas. Ahora las copias se enlazan entre si con un enlace NUEVO.
     2 · Cambiarle el parametro a un Motion dejaba su curva de Mix en mot:<viejo>:mix: la mezcla saltaba al
         100 % y la curva quedaba invisible e imborrable. Ahora viaja con el modificador.
       2b es el CONTROL: si OTRO Motion sigue usando el parametro viejo, la curva es suya y NO se mueve.
     3 · El buscador del visor leia de activeClips, que no miraba disabled: un clip apagado e invisible encima
         le robaba el clic al que si se veia debajo.
     4 · La esfera equirect del visor 3D seguia ensenando un clip que el domo ya no pintaba (apagado o con la
         pista silenciada): los dos visores mostraban cosas distintas del mismo instante.

   Uso:  npx electron . --remote-debugging-port=9222   y luego   node scratchpad/r329-verif.mjs
*/
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0; const p=new Map(); ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise(r=>{const i=++id;p.set(i,m=>r(m.result&&m.result.exceptionDetails?('EXC '+(m.result.exceptionDetails.exception?.description||'').slice(0,80)):(m.result&&m.result.result&&m.result.result.value)));ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true,timeout:60000}}));});

console.log('');
console.log('R329 - copias sueltas, Mix huerfano y las tres listas de "que se ve"');
console.log('');

console.log('1) Alt+arrastrar un par A/V produce DOS copias enlazadas ENTRE SI');
const r1 = await ev(`(async()=>{ try{
  await newProject('flat',1920,1080,30,180,true); if(typeof hideLanding==='function')hideLanding();
  const LV=state.lanes.findIndex(l=>l.kind!=='audio');
  let LA=state.lanes.findIndex(l=>l.kind==='audio');
  if(LA<0){ state.lanes.push({name:'A1',kind:'audio',h:56}); LA=state.lanes.length-1; }
  _demoAddShape('rect','#888',LV,2,3,{x:0,y:0,scale:100});
  const v=state.clips[state.clips.length-1];
  const MA={id:990102,kind:'audio',name:'a',dur:60,color:'#777'}; state.media.push(MA);
  const a={id:990202,lane:LA,mediaId:MA.id,start:2,dur:3,inP:0,speed:1,props:{}};
  state.clips.push(a);
  const enlace='L-990'; v.link=enlace; v.avRole='v'; a.link=enlace; a.avRole='a';
  const antes=state.clips.length;
  state.selIds=[v.id]; state.selId=v.id;
  const items=[{id:v.id,start0:v.start,dur0:v.dur,inP0:v.inP,lane0:v.lane,linked:false,kf0:null,anim0:null},
               {id:a.id,start0:a.start,dur0:a.dur,inP0:a.inP,lane0:a.lane,linked:true, kf0:null,anim0:null}];
  drag={id:v.id,mode:'move',x0:0,y0:0,start0:v.start,dur0:v.dur,inP0:v.inP,lane0:v.lane,_undone:false,
        primaryIds:new Set([v.id]),items};
  onTLMove({clientX:8*state.tl.pxPerSec, clientY:0, target:null, altKey:true, shiftKey:false});
  onTLUp();
  const nuevas=state.clips.filter(c=>c.id!==v.id&&c.id!==a.id);
  const enl=nuevas.map(c=>c.link||null);
  return JSON.stringify({creadas:state.clips.length-antes, enlaces:enl,
    copiasEnlazadas: nuevas.length===2 && !!enl[0] && enl[0]===enl[1],
    enlaceNuevo: nuevas.every(c=>c.link!==enlace),
    papeles: nuevas.map(c=>c.avRole||'?').sort().join(','),
    socioReal: nuevas.length===2 && linkPartner(nuevas[0])===nuevas[1],
    originalIntacto: v.link===enlace && a.link===enlace});
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r1);

console.log('2) cambiar el parametro de un Motion se lleva su curva de Mix');
const r2 = await ev(`(async()=>{ try{
  await newProject('dome',2048,2048,30,180,true); if(typeof hideLanding==='function')hideLanding();
  const LV=state.lanes.findIndex(l=>l.kind!=='audio');
  _demoAddShape('rect','#888',LV,0,5,{x:0,y:0,scale:100});
  const c=state.clips[state.clips.length-1]; state.selId=c.id; state.selIds=[c.id];
  c.anim=[{on:true,param:'x',mode:'wave',speed:1,amp:20}];
  c.kf=c.kf||{}; c.kf['mot:x:mix']=[{t:0,v:0,e:'linear'},{t:2,v:100,e:'linear'}];
  renderInspector();
  const sel=document.querySelector('.aparam');
  if(!sel) return JSON.stringify({err:'no hay fila de Motion en el inspector'});
  const cid=c.id;
  sel.value='y'; sel.onchange({target:sel});
  const cc=clipById(cid);
  const ok1=!(cc.kf&&cc.kf['mot:x:mix']), ok2=!!(cc.kf&&cc.kf['mot:y:mix']&&cc.kf['mot:y:mix'].length===2);
  undo(); const cd=clipById(cid);
  return JSON.stringify({param:cc.anim[0].param, viejaVacia:ok1, nuevaConLaCurva:ok2,
    seDeshace: !!(cd&&cd.kf&&cd.kf['mot:x:mix'])&&cd.anim[0].param==='x'});
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r2);

console.log('2b) si OTRO Motion sigue usando el parametro viejo, la curva NO se mueve (control)');
const r2b = await ev(`(async()=>{ try{
  await newProject('dome',2048,2048,30,180,true); if(typeof hideLanding==='function')hideLanding();
  const LV=state.lanes.findIndex(l=>l.kind!=='audio');
  _demoAddShape('rect','#888',LV,0,5,{x:0,y:0,scale:100});
  const c=state.clips[state.clips.length-1]; state.selId=c.id; state.selIds=[c.id];
  c.anim=[{on:true,param:'x',mode:'wave',speed:1,amp:20},{on:true,param:'x',mode:'saw',speed:2,amp:10}];
  c.kf=c.kf||{}; c.kf['mot:x:mix']=[{t:0,v:0,e:'linear'},{t:2,v:100,e:'linear'}];
  renderInspector();
  const sels=document.querySelectorAll('.aparam');
  if(sels.length<2) return JSON.stringify({err:'no hay segunda fila de Motion ('+sels.length+')'});
  const cid=c.id; sels[1].value='y'; sels[1].onchange({target:sels[1]});
  const cc=clipById(cid);
  return JSON.stringify({laViejaSigue: !!(cc.kf&&cc.kf['mot:x:mix']&&cc.kf['mot:x:mix'].length===2),
    noSeHaCopiado: !(cc.kf&&cc.kf['mot:y:mix'])});
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r2b);

console.log('3) un clip apagado NO le roba el clic al que si se ve debajo');
const r3 = await ev(`(async()=>{ try{
  await newProject('flat',1920,1080,30,180,true); if(typeof hideLanding==='function')hideLanding();
  while(state.lanes.filter(l=>l.kind!=='audio').length<2) state.lanes.unshift({name:'V+',kind:'video',h:56});
  const lv=state.lanes.map((l,i)=>[l,i]).filter(x=>x[0].kind!=='audio').map(x=>x[1]);
  _demoAddShape('rect','#888',lv[0],0,5,{x:0,y:0,scale:100}); const abajo=state.clips[state.clips.length-1];
  _demoAddShape('rect','#999',lv[1],0,5,{x:0,y:0,scale:100}); const arriba=state.clips[state.clips.length-1];
  state.playhead=1;
  const P=vpPanels()[0]; const cx=P.x+P.w/2, cy=P.y+P.h/2;
  const h1=pickClipFlat(cx,cy); const sinApagar=h1?h1.id:null;
  arriba.disabled=true;
  const h2=pickClipFlat(cx,cy); const conApagado=h2?h2.id:null;
  const dib=compositeClips(1).map(x=>x.c.id);
  return JSON.stringify({sinApagar: sinApagar===arriba.id?'el de arriba':(sinApagar===abajo.id?'el de abajo':String(sinApagar)),
    apagandoElDeArriba: conApagado===arriba.id?'el de arriba':(conApagado===abajo.id?'el de abajo':String(conApagado)),
    cedeElClic: conApagado===abajo.id, elApagadoNoSeDibuja: dib.indexOf(arriba.id)<0});
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r3);

console.log('4) la esfera equirect deja de ensenar lo que el domo ya no pinta');
const r4 = await ev(`(async()=>{ try{
  await newProject('dome',2048,2048,30,180,true); if(typeof hideLanding==='function')hideLanding();
  const LV=state.lanes.findIndex(l=>l.kind!=='audio');
  _demoAddShape('rect','#888',LV,0,5,{x:0,y:0,scale:100});
  const c=state.clips[state.clips.length-1];
  c.props.equirect=true; c.props.eqPitch=0; state.playhead=1;
  const m=mediaById(c.mediaId); if(!m||!m.tex) return JSON.stringify({err:'la forma no tiene textura'});
  const encendido=!!equirectClipAt(1);
  c.disabled=true;  const apagado=!!equirectClipAt(1);
  c.disabled=false; state.lanes[LV].mute=true; const silenciado=!!equirectClipAt(1);
  state.lanes[LV].mute=false;
  return JSON.stringify({encendido, trasApagarlo:apagado, conLaPistaSilenciada:silenciado,
    obedece: encendido===true && apagado===false && silenciado===false});
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r4);

const malas=[];
const J=s=>{ try{ return JSON.parse(s); }catch(e){ return {err:String(s).slice(0,90)}; } };
const o1=J(r1),o2=J(r2),o2b=J(r2b),o3=J(r3),o4=J(r4);
for(const [n,o] of [['1',o1],['2',o2],['2b',o2b],['3',o3],['4',o4]]) if(o.err) malas.push('sonda '+n+' rota: '+o.err);
if(!o1.err){ if(!o1.copiasEnlazadas) malas.push('Alt+arrastrar un par A/V deja las copias SUELTAS');
  if(!o1.enlaceNuevo||!o1.socioReal||!o1.originalIntacto) malas.push('el enlace de las copias no es uno nuevo e independiente del original');
  if(o1.papeles!=='a,v') malas.push('las copias no conservan sus papeles de audio y video'); }
if(!o2.err){ if(!o2.viejaVacia||!o2.nuevaConLaCurva) malas.push('cambiar el parametro no se lleva la curva de Mix');
  if(!o2.seDeshace) malas.push('el movimiento de la curva de Mix no se deshace'); }
if(!o2b.err&&(!o2b.laViejaSigue||!o2b.noSeHaCopiado)) malas.push('la curva se mueve aunque otro Motion siga usando el parametro viejo');
if(!o3.err&&(!o3.cedeElClic||!o3.elApagadoNoSeDibuja)) malas.push('un clip apagado sigue siendo seleccionable en el visor');
if(!o4.err&&!o4.obedece) malas.push('la esfera equirect ignora disabled o el mute de pista');
console.log('');
for(const m of malas) console.log('   *** '+m);
console.log(malas.length ? ('*** '+malas.length+' FALLOS') : 'copias enlazadas, Mix que viaja y una sola lista de lo que se ve');
ws.close(); process.exit(malas.length?1:0);
