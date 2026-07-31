/* [R234c] Reordenar muros: (a) sólo sigue a su muro el clip que CABE en él; (b) deshacer devuelve la geometría. */
import http from 'http';
const t=await new Promise((r2,rj)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>r2(JSON.parse(b)));}).on('error',rj);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:60000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
await ev(`window.__errs=[];addEventListener('error',e=>__errs.push(String(e.message||e)));
 const ce=console.error;console.error=function(){try{__errs.push('con: '+[...arguments].map(String).join(' '));}catch(_){}return ce.apply(console,arguments);};1`);
await ev(`(async()=>{try{await startDemoProject('room');}catch(e){window.__d=String(e);}})()`); await wait(2500);
await ev(`(function(){try{if(typeof _tourStop==='function')_tourStop();const o=document.getElementById('tourOv');if(o)o.remove();}catch(e){}
 document.querySelector('#viewModeSeg button[data-v="2d"]').click(); state.playhead=6; resize(); return 1;})()`); await wait(700);

const out={};
/* Se preparan DOS clips de muro: uno que cabe en Front y otro estirado sobre TODA la tira. */
out.setup = await ev(`(function(){ const as=activeSeq(), room=as.room;
  const wl=state.lanes.map((l,i)=>({i,surf:l.surf})).filter(l=>l.surf==='wall');
  const cs=state.clips.filter(c=>(state.lanes[c.lane]||{}).surf==='wall');
  window.__cCabe=cs[0]; window.__cAncho=cs[1]||cs[0];
  const fw=room.walls.find(w=>w.role==='Front')||room.walls[0];
  const anchoMuro=fw.x1-fw.x0, stripH=room.stripH;
  // el que CABE: centrado en Front y escalado para medir la mitad del muro
  const m1=mediaById(__cCabe.mediaId), ca1=(m1.w||16)/(m1.h||9), A=as.w/stripH;
  const wW1=ca1>=A?A:ca1; const escala=(0.5*anchoMuro/as.w*2)/wW1*100;
  Object.assign(__cCabe.props,{x:((fw.x0+anchoMuro/2)/as.w*2-1)*100, y:0, scale:escala, rot:0}); delete __cCabe.kf;
  // el ANCHO: centrado en la tira y estirado a lo ancho de todo
  Object.assign(__cAncho.props,{x:0,y:0,scale:400,rot:0}); delete __cAncho.kf;
  render();
  return {orden:room.walls.map(w=>w.role), stripW:as.w, anchoMuro,
    cabe:{x:+__cCabe.props.x.toFixed(2), semianchoPx:Math.round(clipHalfPx(__cCabe,as.w,stripH)), muroPx:anchoMuro},
    ancho:{x:+__cAncho.props.x.toFixed(2), semianchoPx:Math.round(clipHalfPx(__cAncho,as.w,stripH)), muroPx:anchoMuro}}; })()`);

/* Se manda Front del puesto 1 al 4 */
out.reorden = await ev(`(function(){ const as=activeSeq(), room=as.room;
  const antes={cabe:__cCabe.props.x, ancho:__cAncho.props.x};
  const cfg={walls:room.walls.map(w=>({role:w.role,order:(w.role==='Front'?4:(w.role==='Right'?1:(w.role==='Back'?2:3))),
      wcm:w.wcm,hcm:w.hcm,pxW:w.pxW,pxH:w.pxH})), fps:state.fps, floor:room.floor};
  applyRoomGeometry(cfg);
  const as2=activeSeq(), fw2=as2.room.walls.find(w=>w.role==='Front');
  const cxCabe=(__cCabe.props.x/100+1)/2*as2.w;
  return {ordenNuevo:as2.room.walls.map(w=>w.role), antes,
    cabe:{x:+__cCabe.props.x.toFixed(2), siguioASuMuro:cxCabe>=fw2.x0&&cxCabe<fw2.x1},
    ancho:{x:+__cAncho.props.x.toFixed(2), seQuedoQuieto:Math.abs(__cAncho.props.x-antes.ancho)<1e-6}}; })()`);

/* Deshacer: geometría Y clips vuelven juntos */
out.deshacer = await ev(`(function(){ const idCabe=__cCabe.id, idAncho=__cAncho.id, xAntes=__cCabe.props.x;
  undo();
  /* restore() reconstruye state.clips con objetos NUEVOS: hay que volver a buscarlos por id, no reusar la
     referencia vieja (ese fue el primer falso negativo de esta prueba). Ojo: nada de acentos graves aquí dentro,
     que esto vive en una plantilla de JS. */
  const c1=state.clips.find(c=>c.id===idCabe), c2=state.clips.find(c=>c.id===idAncho);
  const as=activeSeq(), fw=as.room.walls.find(w=>w.role==='Front');
  const cx=(c1.props.x/100+1)/2*as.w;
  return {orden:as.room.walls.map(w=>w.role), lienzo:as.w+'x'+as.h,
    xTrasReordenar:+xAntes.toFixed(2), xTrasDeshacer:+c1.props.x.toFixed(2),
    clipVuelveASuSitio:Math.abs(c1.props.x+75)<0.5, clipSigueEnFront:cx>=fw.x0&&cx<fw.x1,
    anchoQuieto:Math.abs(c2.props.x)<0.5}; })()`);

out.errs = await ev(`window.__errs.slice(0,20)`);
console.log(JSON.stringify(out,null,1));
ws.close();
