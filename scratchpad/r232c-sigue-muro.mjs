/* [R232c] Al reordenar los muros, el contenido sigue a SU muro (y la máscara vuelve a coincidir). */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:60000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const out={};
await ev(`window.__errs=[];addEventListener('error',e=>__errs.push(String(e.message||e)));localStorage.removeItem('ispRoomVp');1`);
await ev(`(async()=>{try{await startDemoProject('room');}catch(e){window.__d=String(e);}})()`); await wait(2500);
await ev(`(function(){try{if(typeof _tourStop==='function')_tourStop();const o=document.getElementById('tourOv');if(o)o.remove();}catch(e){}
 document.querySelector('#viewModeSeg button[data-v="2d"]').click(); resize(); renderTimeline(); return 1;})()`); await wait(700);

/* centro de un clip, en píxeles de la tira, y en qué muro cae */
await ev(`window.__donde=function(c){ const as=activeSeq(), W=as.w, cx=(c.props.x/100+1)/2*W;
  const w=(as.room.walls||[]).find(w=>cx>=w.x0&&cx<w.x1);
  return {px:Math.round(cx), muro:w?w.role:null, u:w?+((cx-w.x0)/(w.x1-w.x0)).toFixed(4):null}; };1`);

/* se planta un clip en el CENTRO de Front y otro en el de Back, y se les pone máscara a su muro */
out.antes = await ev(`(function(){ const as=activeSeq(), W=as.w;
  const liMuro=state.lanes.findIndex(l=>l&&l.surf==='wall');
  const pon=(rol,cid)=>{ const w=as.room.walls.find(x=>x.role===rol); const cx=(w.x0+w.x1)/2;
    const c=state.clips.find(x=>x.id===cid)||state.clips.filter(x=>{const l=state.lanes[x.lane];return l&&l.surf==='wall';})[0];
    return {rol,cx}; };
  const muroClips=state.clips.filter(x=>{const l=state.lanes[x.lane];return l&&l.surf==='wall';});
  if(muroClips.length<2)return {pocosClips:muroClips.length};
  const centra=(c,rol)=>{ const w=as.room.walls.find(x=>x.role===rol); const cx=(w.x0+w.x1)/2;
    c.props.x=Math.round(((cx/W*2-1)*100)*10)/10; c.props.y=0; c.props.maskWalls=[rol];
    c.kf=c.kf||{}; c.kf.x=[{t:0,v:c.props.x,e:'linear'},{t:1,v:c.props.x,e:'linear'}]; }; // + una curva, para ver que viaja
  centra(muroClips[0],'Front'); centra(muroClips[1],'Back');
  return { stripW:W, orden:as.room.walls.map(w=>w.role),
    a:{id:muroClips[0].id, x:muroClips[0].props.x, mask:muroClips[0].props.maskWalls, ...__donde(muroClips[0]), kf:muroClips[0].kf.x.map(k=>k.v)},
    b:{id:muroClips[1].id, x:muroClips[1].props.x, mask:muroClips[1].props.maskWalls, ...__donde(muroClips[1]), kf:muroClips[1].kf.x.map(k=>k.v)} }; })()`);

/* ---------- se REORDENA la tira: Front al último puesto ---------- */
out.tras = await ev(`(function(){ const as=activeSeq();
  const cfg={ walls: as.room.walls.map(w=>({role:w.role,order:w.order,wcm:w.wcm,hcm:w.hcm,pxW:w.pxW,pxH:w.pxH})),
              floor: as.room.floor, fps: state.fps };
  /* Front pasa al puesto 4 e intercambia con quien lo tuviera — la misma permutación que hace la UI */
  const f=cfg.walls.find(w=>w.role==='Front'), n=cfg.walls.length;
  const otro=cfg.walls.find(w=>w.order===n); const cur=f.order; if(otro)otro.order=cur; f.order=n;
  applyRoomGeometry(cfg);
  return { ordenPedido: cfg.walls.slice().sort((x,y)=>x.order-y.order).map(w=>w.role) }; })()`);

out.resultado = await ev(`(function(){ const as=activeSeq();
  const muroClips=state.clips.filter(x=>{const l=state.lanes[x.lane];return l&&l.surf==='wall';});
  const a=muroClips[0], b=muroClips[1];
  return { ordenNuevo:as.room.walls.map(w=>w.role), stripW:as.w,
    a:{x:a.props.x, mask:a.props.maskWalls, ...__donde(a), kf:(a.kf&&a.kf.x||[]).map(k=>k.v)},
    b:{x:b.props.x, mask:b.props.maskWalls, ...__donde(b), kf:(b.kf&&b.kf.x||[]).map(k=>k.v)} }; })()`);

out.veredicto = await ev(`(function(){ const muroClips=state.clips.filter(x=>{const l=state.lanes[x.lane];return l&&l.surf==='wall';});
  const a=muroClips[0], b=muroClips[1]; const da=__donde(a), db=__donde(b);
  return { clipA_sigueEnSuMuro:(da.muro==='Front'&&a.props.maskWalls[0]==='Front'),
    clipB_sigueEnSuMuro:(db.muro==='Back'&&b.props.maskWalls[0]==='Back'),
    clipA_sigueCentrado:Math.abs(da.u-0.5)<0.01, clipB_sigueCentrado:Math.abs(db.u-0.5)<0.01,
    curvaViajo:(a.kf&&a.kf.x||[]).every(k=>Math.abs(k.v-a.props.x)<0.15) }; })()`);

out.errs = await ev(`window.__errs.slice(0,15)`);
console.log(JSON.stringify(out,null,1));
ws.close();
