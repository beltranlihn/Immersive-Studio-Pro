/* [R238] El solver de la planta perdía LAS DOS raíces cuando el mínimo de la curva roza el cero.
   La curva es g(t)=hypot(wF+(wL+wR)sin t,(wR-wL)cos t); en s=sin t es una parábola
   g² = (b²-c²)s² + 2ab s + (a²+c²)  con a=wF, b=wL+wR, c=wR-wL,
   así que su mínimo se calcula EXACTO y se puede construir el caso tangente a mano (wB = g_min) y el
   caso de dos raíces dentro de un mismo paso del barrido (wB = g_min + ε).                              */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:180000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const out={};
await ev(`(function(){ window.__errs=[]; addEventListener('error',e=>__errs.push(String(e.message||e)));
 if(!window.__errHook){ window.__errHook=1; const ce=console.error; console.error=function(){try{__errs.push('con: '+[...arguments].map(String).join(' '));}catch(_){}return ce.apply(console,arguments);}; }
 return 1; })()`);

/* utilidades en la página: construir muros y medir la planta que sale */
await ev(`window.__W=(F,R,B,L)=>[{role:'Front',wcm:F,hcm:300},{role:'Right',wcm:R,hcm:300},{role:'Back',wcm:B,hcm:300},{role:'Left',wcm:L,hcm:300}];
window.__gmin=(F,R,L)=>{ const a=F/100,b=(L+R)/100,c=(R-L)/100;                 // metros, como roomPlan
  const s=-a*b/(b*b-c*c); if(Math.abs(s)>=1)return null;
  return Math.sqrt(Math.max(0,(a*a+c*c)-a*a*b*b/(b*b-c*c))); };
window.__pl=(F,R,B,L)=>{ const p=roomPlan(__W(F,R,B,L));
  /* lado del cierre medido sobre la planta que devuelve: distancia entre las esquinas traseras vs el fondo */
  const [FL,FR,BR,BL]=p.poly; const dorso=Math.hypot(BR[0]-BL[0],BR[1]-BL[1])*100;
  return { imposible:!!p.imposible, motivo:p.motivo||null, dorso:+dorso.toFixed(2), fondoPedido:B,
    errorCierreCm:+Math.abs(dorso-B).toFixed(2) }; };1`);

/* --- 1 · caso TANGENTE construido: wB = g_min exacto ------------------------------------------- */
out['1_tangente']=await ev(`(function(){ const F=500,R=400,L=600; const g=__gmin(F,R,L); const B=Math.round(g*10000)/100;
  return { medidas:{F,R,B,L}, gminCm:+(g*100).toFixed(3), ...__pl(F,R,B,L) }; })()`);

/* --- 2 · DOS raíces dentro de un mismo paso del barrido (paso = 180°/360 = 0,5°) ---------------- */
out['2_dosRaicesJuntas']=await ev(`(function(){ const F=500,R=400,L=600; const g=__gmin(F,R,L);
  const o={}; for(const eps of [0.05,0.2,1]){ const B=+(g*100+eps).toFixed(3); o['fondo_+'+eps+'cm']=__pl(F,R,B,L); }
  return o; })()`);

/* --- 3 · por DEBAJO del mínimo no cierra de verdad (el aviso tiene que seguir saliendo) --------- */
out['3_bajoElMinimo']=await ev(`(function(){ const F=500,R=400,L=600; const g=__gmin(F,R,L);
  const o={}; for(const eps of [1,10,50]){ const B=+(g*100-eps).toFixed(3); o['fondo_-'+eps+'cm']=__pl(F,R,B,L); }
  return o; })()`);

/* --- 4 · no-regresión: barrido de 28 561 combinaciones ----------------------------------------- */
out['4_barrido']=await ev(`(function(){ const vals=[200,300,400,500,600,648,700,745,800,900,1000,1100,1200];
  let n=0, sanas=0, cruzadaAvisada=0, nocierra=0, cruzadaSILENCIO=0, sanaRECHAZADA=0, peorError=0, ejemplos=[];
  for(const F of vals)for(const R of vals)for(const B of vals)for(const L of vals){ n++;
    const p=roomPlan(__W(F,R,B,L)); const [FL,FR,BR,BL]=p.poly;
    const dorso=Math.hypot(BR[0]-BL[0],BR[1]-BL[1])*100, err=Math.abs(dorso-B);
    const cruz=(function(){ // ¿los dos laterales se cortan? (mismo criterio que planCruzada, medido sobre la planta)
      const s1=[FR,BR], s2=[BL,FL]; const cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
      const d1=cr(s1[0],s1[1],s2[0]), d2=cr(s1[0],s1[1],s2[1]), d3=cr(s2[0],s2[1],s1[0]), d4=cr(s2[0],s2[1],s1[1]);
      return ((d1>0)!==(d2>0))&&((d3>0)!==(d4>0)); })();
    const cierra=err<0.5; // el dorso resultante coincide con el fondo pedido
    if(!p.imposible){ sanas++;
      if(cruz){ cruzadaSILENCIO++; if(ejemplos.length<4)ejemplos.push({caso:'cruzada en silencio',F,R,B,L}); }
      if(!cierra){ sanaRECHAZADA++; if(ejemplos.length<4)ejemplos.push({caso:'no cierra y no avisa',F,R,B,L,err:+err.toFixed(2)}); }
      peorError=Math.max(peorError,err); }
    else if(p.motivo==='cruzada')cruzadaAvisada++; else nocierra++; }
  return { combinaciones:n, sanas, cruzadaAvisada, nocierra, cruzadaSILENCIO, sanaRECHAZADA,
    peorErrorDeCierreCm:+peorError.toFixed(4), ejemplos }; })()`);

/* --- 5 · el caso real de Beltrán (648/745/641/648) sigue dando la lectura rectangular ----------- */
out['5_beltran']=await ev(`(function(){ const p=roomPlan(__W(648,745,641,648)); const [FL,FR,BR,BL]=p.poly;
  const th=Math.atan2(BL[0]-FL[0], BL[1]-FL[1])*180/Math.PI;
  return { ...__pl(648,745,641,648), thetaGrados:+th.toFixed(2) }; })()`);

out.errs=await ev(`window.__errs.slice(0,20)`);
console.log(JSON.stringify(out,null,1));
ws.close();
