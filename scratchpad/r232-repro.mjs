/* [R232] Reproduce la sala de la captura de Beltrán y comprueba si la PLANTA se cruza consigo misma. */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:60000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const out={};
await ev(`window.__errs=[];addEventListener('error',e=>__errs.push(String(e.message||e)));1`);

/* helper: ¿se cruzan dos segmentos que no comparten extremo? */
await ev(`window.__cruzan=function(segs){ const o=(a,b,c)=>Math.sign((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]));
  const comparte=(s1,s2)=>{ const eq=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1])<1e-9;
    return eq(s1.a,s2.a)||eq(s1.a,s2.b)||eq(s1.b,s2.a)||eq(s1.b,s2.b); };
  const out=[];
  for(let i=0;i<segs.length;i++)for(let j=i+1;j<segs.length;j++){ const s1=segs[i],s2=segs[j];
    if(comparte(s1,s2))continue;
    const d1=o(s1.a,s1.b,s2.a), d2=o(s1.a,s1.b,s2.b), d3=o(s2.a,s2.b,s1.a), d4=o(s2.a,s2.b,s1.b);
    if(d1!==d2&&d3!==d4)out.push(s1.role+'×'+s2.role); }
  return out; };1`);

/* la sala EXACTA de la captura: filas Left/Front/Right/Back con esos cm */
out.captura = await ev(`(function(){ const walls=[
    {role:'Left', wcm:648,hcm:350,pxW:1912,pxH:912},
    {role:'Front',wcm:648,hcm:350,pxW:1692,pxH:912},
    {role:'Right',wcm:745,hcm:350,pxW:1920,pxH:912},
    {role:'Back', wcm:641,hcm:350,pxW:1672,pxH:912}];
  const pl=roomPlan(walls);
  return { imposible:!!pl.imposible, closed:pl.closed,
    poly:pl.poly.map(q=>q.map(v=>+v.toFixed(2))),
    seg:pl.seg.map(s=>({role:s.role,a:s.a.map(v=>+v.toFixed(2)),b:s.b.map(v=>+v.toFixed(2)),len:+Math.hypot(s.b[0]-s.a[0],s.b[1]-s.a[1]).toFixed(2)})),
    cruces:__cruzan(pl.seg) }; })()`);

/* ¿y qué pasa si los roles NO están en el ciclo canónico? (lo que hoy permite el selector) */
out.rolesDesordenados = await ev(`(function(){ const casos={
    canonico:['Front','Right','Back','Left'],
    capturaOrden:['Left','Front','Right','Back'],
    cruzado:['Front','Back','Right','Left'] };
  const cm={Front:648,Right:745,Back:641,Left:648};
  const r={};
  for(const k in casos){ const walls=casos[k].map(rol=>({role:rol,wcm:cm[rol],hcm:350,pxW:1900,pxH:912}));
    const pl=roomPlan(walls); r[k]={ cruces:__cruzan(pl.seg), imposible:!!pl.imposible,
      poly:pl.poly.map(q=>q.map(v=>+v.toFixed(1))) }; }
  return r; })()`);

/* medidas que NO cierran ninguna sala: ¿qué se dibuja? */
out.imposibles = await ev(`(function(){ const pruebas=[
    {n:'fondo enorme', cm:{Front:200,Right:300,Back:2000,Left:300}},
    {n:'frente enorme',cm:{Front:2000,Right:300,Back:200,Left:300}},
    {n:'captura',      cm:{Front:648,Right:745,Back:641,Left:648}} ];
  return pruebas.map(p=>{ const walls=['Front','Right','Back','Left'].map(rol=>({role:rol,wcm:p.cm[rol],hcm:350,pxW:1900,pxH:912}));
    const pl=roomPlan(walls); return {caso:p.n, imposible:!!pl.imposible, cruces:__cruzan(pl.seg)}; }); })()`);

out.errs = await ev(`window.__errs.slice(0,10)`);
console.log(JSON.stringify(out,null,1));
ws.close();
