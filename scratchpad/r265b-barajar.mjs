/* [R265b] El barajado reparte TODAS las fuentes entre las tiras del tejido (y no cambia el resto de composes). */
import http from 'http';
const t=await new Promise((r2,rj)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>r2(JSON.parse(b)));}).on('error',rj);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:60000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
console.log(JSON.stringify(await ev(`(function(){
  const rep=(porTira,n)=>{ const c={}; for(let k=0;k<n;k++)c[k]=0; for(const v of porTira)c[v]++; return c; };
  // A · TEJIDO: 200 tiradas con 8 tiras y 4 fuentes — ninguna puede dejarse una fuente fuera
  let peorDesvio=0, tiradasConFuenteAusente=0, ultima=null, tirasVistas=0, elementos=0;
  for(let n=0;n<200;n++){
    const g={kind:'weave',shuffle:true,bands:8,weaveMode:'v',fit:'along',count:8,cols:3,size:40,rand:[],_orderR:true};
    const lay=compLayoutFlat(g); elementos=lay.length;
    const tiras=[...new Set(lay.map(p=>p._src))].length; tirasVistas=tiras;
    ensureCompOrder(g,compOrderCount(lay),4);
    const porTira=[]; for(let s=0;s<tiras;s++)porTira.push(compMediaIndex(g,s,4));
    const c=rep(porTira,4); const vals=Object.values(c);
    peorDesvio=Math.max(peorDesvio, Math.max(...vals)-Math.min(...vals));
    if(Math.min(...vals)===0)tiradasConFuenteAusente++;
    ultima={porTira,reparto:c};
  }
  // B · el resto de composes (indexan por ELEMENTO) tienen que seguir igual: mapa del tamaño de los elementos
  const g2={kind:'domegrid',shuffle:true,rings:3,segs:8,size:40,rand:[],_orderR:true,cols:3,count:24,el:30,elMin:10,elMax:60,arc:140};
  const lay2=compLayout(g2);
  const dominio2=compOrderCount(lay2);
  ensureCompOrder(g2,dominio2,4);
  const porElem=lay2.map((_,i)=>compMediaIndex(g2,i,4)); const c2=rep(porElem,4); const v2=Object.values(c2);
  return { tejido:{ elementos, tiras:tirasVistas, tiradas:200, peorDesvioEntreFuentes:peorDesvio,
      tiradasConAlgunaFuenteAusente:tiradasConFuenteAusente, ejemplo:ultima },
    otrosComposes:{ kind:'domegrid', elementos:lay2.length, dominioDelMapa:dominio2,
      indexaPorElemento:dominio2===lay2.length, reparto:c2,
      desvio:Math.max(...v2)-Math.min(...v2) } }; })()`),null,1));
ws.close();
