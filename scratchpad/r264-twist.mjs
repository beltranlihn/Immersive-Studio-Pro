/* [R264] ¿Que hace el Giro (twist) del tunel y por que no se ve? */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise((res,rej)=>{const i=++id;p.set(i,r=>r.error?rej(new Error(JSON.stringify(r.error))):(r.result.exceptionDetails?rej(new Error(r.result.exceptionDetails.exception?.description||r.result.exceptionDetails.text)):res(r.result.result.value)));
  ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true}}));});
const r=await ev(`(function(){
  const base={kind:'tunnel',mediaIds:[],mediaId:null,count:6,sizeFrom:1,sizeTo:200,speed:0.12,curve:60,spin:0,mask:'none',rand:[],jitter:0};
  const az=(tw)=>compLayout({...base,twist:tw}).map(p=>+(p.az||0).toFixed(1));
  /* y lo que acaba en el clip, que es lo que lee el dibujo */
  const props=(tw)=>compLayout({...base,twist:tw}).map(p=>compElProps({...base,twist:tw},p)).map(q=>({az:q.az,el:q.el,fulldome:!!q.fulldome}));
  /* ¿el azimut cambia con el tiempo? (un tirabuzon de verdad giraria segun avanza) */
  const g={...base,twist:180};
  const c={id:1,start:0,speed:1,props:compElProps(g,compLayout(g)[1]),anim:compTunnelAnim(g,compLayout(g)[1]._phase)};
  const azT=[0,0.25,0.5,0.75].map(u=>+evalR(c,'az',u/g.speed).toFixed(2));
  const szT=[0,0.25,0.5,0.75].map(u=>+evalR(c,'size',u/g.speed).toFixed(1));
  return { az0:az(0), az180:az(180), props180:props(180)[1], azEnElTiempo:azT, tamEnElTiempo:szT,
           modificadores:c.anim.map(a=>a.param) }; })()`);
console.log('azimut por elemento con Giro 0   : '+r.az0.join(', '));
console.log('azimut por elemento con Giro 180 : '+r.az180.join(', '));
console.log('lo que recibe el clip (elemento 2): '+JSON.stringify(r.props180));
console.log('\nmodificadores que se le ponen al clip: '+r.modificadores.join(', '));
console.log('azimut a lo largo del ciclo (0/0,25/0,5/0,75): '+r.azEnElTiempo.join(', ')+'   <- si no cambia, el giro es ESTATICO');
console.log('tamano  a lo largo del ciclo                : '+r.tamEnElTiempo.join(', '));
ws.close();
