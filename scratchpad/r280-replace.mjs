/* [R280] Replace media sobre clips LOOPEADOS:
     - el clip pasa a loopear el medio nuevo ENTERO (inP 0, largo = duracion nueva);
     - su duracion en el timeline NO cambia: solo cambian las divisiones;
     - efectos y automatizaciones intactos;
     - alcanza tambien a los clips que viven DENTRO de nests/composiciones.
   Y se comprueba de paso que el cambio de largo de bucle desde el visor ya llegaba a los nests. */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise((res,rej)=>{const i=++id;p.set(i,r=>r.error?rej(new Error(JSON.stringify(r.error))):(r.result.exceptionDetails?rej(new Error(r.result.exceptionDetails.exception?.description||r.result.exceptionDetails.text)):res(r.result.result.value)));
  ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true}}));});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let fallos=0; const mal=m=>{ console.log('   *** '+m); fallos++; };

await ev(`(async()=>{ await newProject('dome',1024,1024,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()`);
await wait(1600);

const r=await ev(`(function(){
  const out={};
  const m={id:uid(),name:'viejo.mp4',kind:'video',w:1920,h:1080,dur:12,fps:30,color:'#8a8',path:'v',folder:null};
  state.media.push(m); renderMedia();
  const iv=state.lanes.findIndex(l=>l.kind==='video');   /* addClip toma el INDICE, y lanes[0] es audio */
  addClip(m,iv,0);
  const c=state.clips[state.clips.length-1];
  /* Clip loopeado con un tramo A MANO (no un ciclo entero): es el caso que antes NO se reajustaba. */
  c.dur=40; c.loop=true; c.inP=3; c.loopLen=4;
  c.props.opacity=55; c.fx=[{id:7,type:'pulsescale',int:60,amt:30,on:true}];
  c.kf={ opacity:[{t:0,v:0},{t:20,v:100}] };

  /* El MISMO medio, dentro de una secuencia anidada que no es la activa. */
  const nest=state.media.find(isSeqMedia);
  const otra={id:uid(),name:'Nido',kind:'nest',dur:30,color:'#679',nestClips:[
    {id:uid(),mediaId:m.id,lane:0,start:0,dur:25,inP:5,loop:true,loopLen:2,props:{opacity:100},kf:{}}
  ]};
  state.media.push(otra); renderMedia();

  out.antes={ dur:c.dur, inP:c.inP, loopLen:c.loopLen, opacity:c.props.opacity, fx:(c.fx||[]).length, kf:(c.kf.opacity||[]).length,
              nido:{dur:otra.nestClips[0].dur, inP:otra.nestClips[0].inP, loopLen:otra.nestClips[0].loopLen} };

  /* El reemplazo: el archivo pasa a durar 7 s. Se llama a la reconciliacion, que es lo que replaceMedia
     ejecuta despues de recargar el medio (el dialogo nativo no se puede pilotar desde aqui). */
  const oldDur=m.dur; m.dur=7;
  out.info=reconciliarDuracion(m,oldDur);

  out.despues={ dur:c.dur, inP:c.inP, loopLen:c.loopLen, opacity:c.props.opacity, fx:(c.fx||[]).length, kf:(c.kf.opacity||[]).length,
                nido:{dur:otra.nestClips[0].dur, inP:otra.nestClips[0].inP, loopLen:otra.nestClips[0].loopLen} };

  /* Y el cambio de largo de bucle desde el visor: tiene que tocar el clip del nido tambien. */
  const n=aplicarTramoAClipsEnBucle(m,1,4);
  out.tramo={ tocados:n, clip:{inP:c.inP,loopLen:c.loopLen,dur:c.dur},
              nido:{inP:otra.nestClips[0].inP,loopLen:otra.nestClips[0].loopLen,dur:otra.nestClips[0].dur} };
  return out; })()`);

console.log('antes:   '+JSON.stringify(r.antes));
console.log('despues: '+JSON.stringify(r.despues));
console.log('aviso:   '+r.info.trim());
const A=r.antes, D=r.despues;
if(D.dur!==A.dur) mal('ha cambiado la duracion del clip en el timeline ('+A.dur+' -> '+D.dur+')');
if(D.inP!==0) mal('el punto de entrada no ha vuelto a 0: no loopea el medio COMPLETO (inP='+D.inP+')');
if(Math.abs(D.loopLen-7)>1e-6) mal('el bucle no mide la duracion nueva del medio: '+D.loopLen);
if(D.opacity!==A.opacity||D.fx!==A.fx||D.kf!==A.kf) mal('se han perdido efectos o automatizaciones');
if(D.nido.dur!==A.nido.dur) mal('ha cambiado la duracion del clip dentro del nido');
if(D.nido.inP!==0||Math.abs(D.nido.loopLen-7)>1e-6) mal('el clip DENTRO del nido no se ha reajustado: '+JSON.stringify(D.nido));

console.log('tramo del visor -> tocados: '+r.tramo.tocados+'   clip: '+JSON.stringify(r.tramo.clip)+'   nido: '+JSON.stringify(r.tramo.nido));
if(r.tramo.tocados<2) mal('el cambio de largo de bucle no ha alcanzado a los dos clips (solo '+r.tramo.tocados+')');
if(Math.abs(r.tramo.clip.inP-1)>1e-4||Math.abs(r.tramo.clip.loopLen-3)>1e-4) mal('el tramo no se ha aplicado al clip del timeline');
if(Math.abs(r.tramo.nido.inP-1)>1e-4||Math.abs(r.tramo.nido.loopLen-3)>1e-4) mal('el tramo no ha llegado al clip del nido');
if(r.tramo.clip.dur!==A.dur||r.tramo.nido.dur!==A.nido.dur) mal('el tramo ha cambiado duraciones, y solo debia cambiar divisiones');

console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'el replace loopea el medio nuevo entero sin tocar duraciones, dentro y fuera de los nidos'));
ws.close();
