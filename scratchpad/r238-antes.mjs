/* [R238] Prueba de que el barrido VIEJO (sólo cambios de signo) perdía esos casos: se reimplementa aquí
   tal cual estaba en R232 y se cuenta cuántas raíces encontraba. */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:120000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const out=await ev(`(function(){
  const viejo=(F,R,B,L)=>{ const a=F/100,b=(L+R)/100,c=(R-L)/100,wB=B/100;
    const f=t=>Math.hypot(a+b*Math.sin(t),c*Math.cos(t))-wB;
    const LIM=Math.PI/2-1e-3,N=360; let n=0,pv=f(-LIM);
    for(let i=1;i<=N;i++){ const t=-LIM+2*LIM*i/N,v=f(t); if((pv<=0&&v>=0)||(pv>=0&&v<=0))n++; pv=v; } return n; };
  const F=500,R=400,L=600, g=__gmin(F,R,L)*100;
  const o={};
  for(const [k,B] of [['tangente',Math.round(g*100)/100],['+0.05cm',+(g+0.05).toFixed(3)],['+0.2cm',+(g+0.2).toFixed(3)],['+1cm',+(g+1).toFixed(3)],['+50cm',+(g+50).toFixed(3)]])
    o[k]={fondo:B, raicesBarridoViejo:viejo(F,R,B,L), ahoraCierra:!roomPlan(__W(F,R,B,L)).imposible};
  return o; })()`);
console.log(JSON.stringify(out,null,1));
ws.close();
