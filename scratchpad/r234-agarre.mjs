/* [R234] Arrastrar un clip debe anclarse DONDE SE AGARRÓ, no recentrarse en el cursor. */
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

for(const fmt of ['room','dome']){
  await ev(`state.dirty=false;1`); // si no, el segundo demo abre el diálogo de descartar y el evaluate se queda esperando
  await ev(`(async()=>{try{await startDemoProject('${fmt}');}catch(e){window.__d=String(e);}})()`); await wait(2600);
  await ev(`(function(){try{if(typeof _tourStop==='function')_tourStop();const o=document.getElementById('tourOv');if(o)o.remove();}catch(e){}
    const b=document.querySelector('#viewModeSeg button[data-v="2d"]'); if(b)b.click(); state.playhead=6; resize(); vpFit(); render(); return 1;})()`); await wait(800);

  out[fmt] = await ev(`(function(){
    const esRoom=isRoom();
    const c=state.clips.find(x=>{ const l=state.lanes[x.lane]; if(esRoom) return l&&l.surf==='wall'; return l&&l.kind!=='audio'; });
    if(!c)return {sinClip:true};
    state.selId=c.id; state.selIds=[c.id];
    if(state.playhead<c.start||state.playhead>=c.start+c.dur)state.playhead=c.start+0.1;
    if(isFlat())Object.assign(c.props,{x:0,y:0,rot:0,scale:60}); else Object.assign(c.props,{az:0,el:45,rot:0,size:40});
    render();
    const m=mediaById(c.mediaId), t=state.playhead;
    /* punto de agarre: claramente DESCENTRADO dentro del clip (hacia una esquina) */
    let centroPx, agarrePx;
    if(isFlat()){ const CP=clipPanel(c), M=flatMap(CP), P=flatPlace(c,m,t,clipSurfA(c));
      centroPx=M.px(P.fc[0]/M.Fx,P.fc[1]/M.Fy);
      const esq=M.px((P.fc[0]+P.fx[0]*0.6+P.fy[0]*0.6)/M.Fx,(P.fc[1]+P.fx[1]*0.6+P.fy[1]*0.6)/M.Fy);
      agarrePx=esq; }
    else { centroPx=f2pix(...azel2f(evalP(c,'az',t),evalP(c,'el',t)));
      agarrePx=f2pix(...azel2f(evalP(c,'az',t)+8,evalP(c,'el',t)+5)); }
    const antes=isFlat()?{x:c.props.x,y:c.props.y}:{az:c.props.az,el:c.props.el};
    const el=gridc, r=el.getBoundingClientRect();
    const ptr=(tipo,x,y,btn)=>el.dispatchEvent(new PointerEvent(tipo,{clientX:r.left+x,clientY:r.top+y,button:0,buttons:btn===undefined?1:btn,bubbles:true,pointerId:1}));
    ptr('pointerdown',agarrePx[0],agarrePx[1]);
    const trasAgarrar=isFlat()?{x:c.props.x,y:c.props.y}:{az:c.props.az,el:c.props.el};
    /* mover 40 px a la derecha */
    ptr('pointermove',agarrePx[0]+40,agarrePx[1]);
    const trasMover=isFlat()?{x:c.props.x,y:c.props.y}:{az:c.props.az,el:c.props.el};
    ptr('pointerup',agarrePx[0]+40,agarrePx[1],0);
    /* ¿saltó al agarrar? el pointerdown NO debe mover el clip */
    const saltoAlAgarrar=isFlat()
      ? (Math.abs(trasAgarrar.x-antes.x)>0.05||Math.abs(trasAgarrar.y-antes.y)>0.05)
      : (Math.abs(trasAgarrar.az-antes.az)>0.05||Math.abs(trasAgarrar.el-antes.el)>0.05);
    return { modo:state.seqMode, centro:[Math.round(centroPx[0]),Math.round(centroPx[1])],
      agarre:[Math.round(agarrePx[0]),Math.round(agarrePx[1])],
      distanciaAgarreDelCentro:Math.round(Math.hypot(agarrePx[0]-centroPx[0],agarrePx[1]-centroPx[1])),
      antes, trasAgarrar, trasMover, saltoAlAgarrar }; })()`);
}
out.errs = await ev(`window.__errs.slice(0,10)`);
console.log(JSON.stringify(out,null,1));
ws.close();
