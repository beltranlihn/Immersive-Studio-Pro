/* [R232] Planta sin cruces + orientación fija y orden del lienzo editable. */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:60000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const out={};
await ev(`window.__errs=[];addEventListener('error',e=>__errs.push(String(e.message||e)));
 const ce=console.error;console.error=function(){try{__errs.push('con: '+[...arguments].map(String).join(' '));}catch(_){}return ce.apply(console,arguments);};1`);
await ev(`window.__cruces=function(segs){ const eq=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1])<1e-9; const out=[];
  for(let i=0;i<segs.length;i++)for(let j=i+1;j<segs.length;j++){ const s1=segs[i],s2=segs[j];
    if(eq(s1.a,s2.a)||eq(s1.a,s2.b)||eq(s1.b,s2.a)||eq(s1.b,s2.b))continue;
    if(segCruza(s1.a,s1.b,s2.a,s2.b))out.push(s1.role+'x'+s2.role); } return out; };1`);

/* ---------- 1 · la sala de la captura ya no se cruza ---------- */
out.captura = await ev(`(function(){ const walls=['Front','Right','Back','Left'].map(r=>({role:r,
    wcm:{Front:648,Right:745,Back:641,Left:648}[r],hcm:350,pxW:1900,pxH:912}));
  const pl=roomPlan(walls);
  return { cruces:__cruces(pl.seg), imposible:!!pl.imposible,
    poly:pl.poly.map(q=>q.map(v=>+v.toFixed(2))) }; })()`);

/* ---------- 2 · barrido: ninguna combinación razonable debe cruzarse ---------- */
out.barrido = await ev(`(function(){ let n=0,mal=0,imp=0; const ejemplos=[];
  for(let f=300;f<=900;f+=100)for(let b=300;b<=900;b+=100)for(let l=300;l<=900;l+=200)for(let r=300;r<=900;r+=200){
    const walls=['Front','Right','Back','Left'].map(rol=>({role:rol,wcm:{Front:f,Right:r,Back:b,Left:l}[rol],hcm:300,pxW:1900,pxH:912}));
    const pl=roomPlan(walls); const c=__cruces(pl.seg); n++;
    if(pl.imposible)imp++;
    if(c.length&&!pl.imposible){ mal++; if(ejemplos.length<5)ejemplos.push({f,r,b,l,c}); } }
  return {casos:n, cruzadasSinAvisar:mal, marcadasImposibles:imp, ejemplos}; })()`);

/* ---------- 3 · launcher: orientación fija, orden editable ---------- */
out.tabla = await ev(`(function(){ _lch=lchInit(); _lch.ptype='room'; showLanding&&showLanding(); return 1; })()`);
await wait(600);
out.ui = await ev(`(function(){
  const filas=[...document.querySelectorAll('.lch-wrow')];
  const selectores=document.querySelectorAll('[data-lface]').length;
  const rotulos=[...document.querySelectorAll('.lch-wrow .lch-facing')].map(e=>e.textContent.trim());
  const ordInputs=[...document.querySelectorAll('.lch-wrow input')].filter(i=>/ord$/.test(i.dataset.lk||''));
  return { filas:filas.length, selectoresDeOrientacion:selectores, orientaciones:rotulos,
    camposDeOrden:ordInputs.length, valores:ordInputs.map(i=>i.value),
    hayFacingMenu:(typeof lchFacingMenu), hayFacingSet:(typeof lchSetFacing) }; })()`);

/* ---------- 4 · cambiar el orden INTERCAMBIA y el lienzo obedece ---------- */
out.intercambio = await ev(`(function(){ const antes=lchActiveWalls().map(w=>w.role+':'+w.ord);
  const tiraAntes=lchCfgWalls().map(w=>w.role);
  lchSetOrder(0,3);                                   // Front (fila 1) se va al puesto 3
  const despues=lchActiveWalls().map(w=>w.role+':'+w.ord);
  const tiraDespues=lchCfgWalls().map(w=>w.role);
  const ords=lchActiveWalls().map(w=>w.ord).sort((a,b)=>a-b);
  const permutacionValida=JSON.stringify(ords)===JSON.stringify([1,2,3,4]);
  const filasSiguenFijas=lchActiveWalls().map(w=>w.role);
  return { antes, tiraAntes, despues, tiraDespues, permutacionValida, filasSiguenFijas }; })()`);

/* ---------- 5 · la planta NO depende del orden del lienzo ---------- */
out.plantaEstable = await ev(`(function(){ const a=JSON.stringify(roomPlan(lchCfgWalls()).poly.map(q=>q.map(v=>+v.toFixed(3))));
  lchSetOrder(0,1); lchSetOrder(1,4);
  const b=JSON.stringify(roomPlan(lchCfgWalls()).poly.map(q=>q.map(v=>+v.toFixed(3))));
  return { iguales:(a===b), poly:a }; })()`);

/* ---------- 6 · bajar de muros renormaliza el orden ---------- */
out.cuenta = await ev(`(function(){ lchSetWallCount(3);
  const r3=lchActiveWalls().map(w=>w.role+':'+w.ord);
  const ok3=JSON.stringify(lchActiveWalls().map(w=>w.ord).sort())===JSON.stringify([1,2,3]);
  lchSetWallCount(4); const r4=lchActiveWalls().map(w=>w.role+':'+w.ord);
  const ok4=JSON.stringify(lchActiveWalls().map(w=>w.ord).sort())===JSON.stringify([1,2,3,4]);
  return { tres:r3, permutacion3:ok3, cuatro:r4, permutacion4:ok4 }; })()`);

/* ---------- 7 · el diálogo de geometría: filas por orientación, orden editable ---------- */
out.dialogo = await ev(`(function(){ const sala={walls:[
    {role:'Back',order:1,wcm:641,hcm:350,pxW:1672,pxH:912},
    {role:'Front',order:2,wcm:648,hcm:350,pxW:1692,pxH:912},
    {role:'Left',order:3,wcm:648,hcm:350,pxW:1912,pxH:912},
    {role:'Right',order:4,wcm:745,hcm:350,pxW:1920,pxH:912}], floor:null};
  roomSetupDialog(()=>{},sala); return 1; })()`);
await wait(500);
out.dialogoUI = await ev(`(function(){ const filas=[...document.querySelectorAll('#rsWalls .rs-wall')];
  const r={ filas:filas.length,
    orientaciones:filas.map(f=>f.querySelector('.rs-role').textContent.trim()),
    ordenes:filas.map(f=>f.querySelector('[data-k=order]').value),
    selectDeRol:document.querySelectorAll('#rsWalls select[data-k=role]').length,
    ordEsInput:filas.every(f=>f.querySelector('input.rs-ordnum')) };
  const ov=document.querySelector('.overlay[style*="320"]')||[...document.querySelectorAll('.overlay')].pop(); if(ov)ov.remove();
  return r; })()`);

out.errs = await ev(`window.__errs.slice(0,15)`);
console.log(JSON.stringify(out,null,1));
ws.close();
