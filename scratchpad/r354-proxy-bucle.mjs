/* [R354] ¿El proxy que lleva el bucle horneado entrega los MISMOS fotogramas que la recomposicion en vivo,
   cruzando vueltas? Se compara por PIXELES con el proxy puesto y quitado. Control negativo: hornear sin el
   plan de bucle (lo de antes) tiene que DIVERGIR — si no, la sonda no sabe fallar. */
import http from 'http';
const t=await new Promise((r2,rj)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>r2(JSON.parse(b)));}).on('error',rj);});
const ws=new WebSocket(t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl).webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async(x,ms=600000)=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:ms});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const DIR='/private/tmp/claude-501/-Users-vicentemanzano-Desktop-Immersive-Studio-Pro/3cfceee5-d8c2-4775-bd7f-c99aa482a586/scratchpad/nc';
await ev('window.__errs=[];addEventListener("error",e=>__errs.push(String(e.message||e).slice(0,150)));1');
await ev('(async()=>{try{await startDemoProject("dome");}catch(e){}})()'); await wait(2600);
await ev('(function(){try{if(typeof _tourStop==="function")_tourStop();const o=document.getElementById("tourOv");if(o)o.remove();}catch(e){}return 1;})()'); await wait(600);

// escenario + plan
console.log('plan:', JSON.stringify(await ev(`(async function(){
  const src=state.media.find(m=>m.kind!=="audio"&&!isSeqMedia(m));
  const n=newSeqMedia("Bucle",state.fps,512,512,null,null,"dome",180);
  const inner=makeClip(src,0,0,{az:0,el:45,size:70},{name:"movil"}); inner.dur=2; inner.lane=0;
  inner.anim=[{id:1,param:"az",mode:"saw",speed:0.15,amp:70,phase:0,curve:0,on:true}];  // periodo 6,67 s: NO cierra con el bucle de 2 s
  n.nestClips=[inner]; n.nestLanes=[{id:uid(),name:"V1",tag:"V1",kind:"video"}]; n.dur=2;
  state.media.push(n);
  const c=makeClip(n,0,0,{},{name:"enBucle"}); c.dur=8; c.lane=0; c.loop=true; c.loopLen=2; c.inP=0;
  state.clips=[c]; state.lanes=[{id:uid(),name:"V1",tag:"V1",kind:"video"}];
  window.__n=n; window.__c=c;
  try{ if(DSP.ensureDir) await DSP.ensureDir(${JSON.stringify(DIR)}); }catch(e){}
  currentPath=${JSON.stringify(DIR)}+PSEP+"p.isp";
  const pl=ncPlanBucle(n);
  return { plan:pl, nidoDur:n.dur, clipDur:c.dur, reloj:nestConReloj(n) }; })()`)));

// hornear (con el dialogo respondido a 256 automaticamente)
await ev('window.__dlg=ncDialog; ncDialog=async function(m,o){ return {s:256,w:256,h:256}; }; 1');
console.log('horneando…');
console.log('horneado:', JSON.stringify(await ev(`(async function(){ await ncBuild(__n);
  return { ruta:!!__n.ncPath, listo:!!__n.ncReady, bucleHorneado:__n.ncLoop, cubre:__n.ncSpan,
           usaElProxy:ncUsableFor(__c,__n) }; })()`)));

// comparar PIXELES: proxy puesto vs quitado, cruzando vueltas
const comparar=async(etiq)=>{
  const out=[];
  for(const T of [0.5,2.5,4.5,6.5,0.5]){   // el 0,5 se repite al final: si el primero desviaba por asentamiento del video, el segundo lo dira
    await ev('state.playhead='+T+'; state.view.useNestCache=true; prepNests(state.clips,'+T+'); 1');
    /* SIEMPRE hay que pedir la busqueda: mirar primero si la instancia esta "lista" y salir en ese caso deja
       la textura clavada en el fotograma anterior — el centroide del proxy salia congelado en todos los
       instantes y parecia un fallo del motor cuando era de la sonda. Se espera a que el video llegue AL
       tiempo pedido, no solo a que este listo. */
    const obj=await ev('(function(){var v=_vinst.get(__c.id); var u=ncLocalT(__c,__n,'+T+',srcT(__c,'+T+'));'+
      ' if(v)vinstSeek(__c,__n,u); return u;})()');
    for(let i=0;i<40;i++){ const st=await ev('(function(){var v=_vinst.get(__c.id); if(!v)return null;'+
      ' return {listo:!!(v.ready&&v.vtex), t:(v.vsrc?v.vsrc.currentTime:null)};})()');
      if(st&&st.listo&&st.t!=null&&Math.abs(st.t-obj)<0.06)break;
      await wait(250);
      await ev('(function(){var v=_vinst.get(__c.id); if(v&&!v.ready)vinstSeek(__c,__n,'+ '(' +'0'+'+'+'0'+')||0); return 1;})()'.replace('(0+0)||0',String(obj))); }
    await wait(500);   // asentar la subida de la textura antes de leer
    out.push(await ev(`(function(){ var T=${T};
      /* CENTROIDE del elemento: robusto a compresion y a la diferencia de resolucion entre el proxy y el
         recompuesto. Es ademas la magnitud del sintoma: "se resetea la POSICION de los elementos". */
      var cen=function(){ var S=128; gl.bindFramebuffer(gl.FRAMEBUFFER,null); prepNests(state.clips,T); composite(T,S,false);
        var px=new Uint8Array(S*S*4); gl.readPixels(0,0,S,S,gl.RGBA,gl.UNSIGNED_BYTE,px);
        var sx=0,sy=0,sw=0;
        for(var y=0;y<S;y++)for(var x=0;x<S;x++){ var i=(y*S+x)*4; var l=px[i]+px[i+1]+px[i+2];
          if(l>60){ sx+=x*l; sy+=y*l; sw+=l; } }
        return sw>0?[sx/sw,sy/sw,sw]:null; };
      state.view.useNestCache=true;  var a=cen();
      state.view.useNestCache=false; var b=cen();
      state.view.useNestCache=true;
      if(!a||!b) return { t:T, sinContenido:true, conProxy:!!a, enVivo:!!b };
      var d=Math.hypot(a[0]-b[0],a[1]-b[1]);
      return { t:T, proxy:[+a[0].toFixed(1),+a[1].toFixed(1)], vivo:[+b[0].toFixed(1),+b[1].toFixed(1)], desviacion_px:+d.toFixed(2) }; })()`));
  }
  console.log(etiq, JSON.stringify(out));
  return out;
};
const MODO=process.argv[2]||'plan';
if(MODO==='plan') await comparar('CON plan de bucle (debe seguir al vivo):');

if(MODO==='control'){   // CONTROL NEGATIVO: hornear como antes (sin plan) y forzar la puerta -> debe DIVERGIR
  await ev('window.__plan=ncPlanBucle; ncPlanBucle=function(){ return null; }; 1');
  await ev('(async function(){ ncDetach(__n,false); await ncBuild(__n); __n.ncLoop=2; __n.ncSpan=8; return 1; })()');
  await comparar('SIN plan (control, debe DIVERGIR):');
  await ev('ncPlanBucle=window.__plan; 1');
}
await ev('ncDialog=window.__dlg; 1');
console.log('errores:', JSON.stringify(await ev('__errs.slice(0,5)')));
ws.close(); process.exit(0);
