/* [R263] Los mandos rapidos de composicion del INSPECTOR con cada tipo. Lo que se comprueba:
     - que el tipo actual quede MARCADO (con tunel/tejido no habia boton, asi que parecia roto y pulsar
       cualquiera convertia la composicion en otra cosa);
     - que no se ofrezca "Tamano" donde no significa nada (tunel y tejido);
     - que un nido PLANO ofrezca los tipos planos, no los de domo. */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise((res,rej)=>{const i=++id;p.set(i,r=>r.error?rej(new Error(JSON.stringify(r.error))):(r.result.exceptionDetails?rej(new Error(r.result.exceptionDetails.exception?.description||r.result.exceptionDetails.text)):res(r.result.result.value)));
  ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true}}));});
let fallos=0; const mal=m=>{ console.log('   *** '+m); fallos++; };

await ev(`(async()=>{ await newProject('dome',1024,1024,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()`);
await new Promise(r=>setTimeout(r,1200));
await ev(`window.__probar=function(kind,modo){
  state.media=state.media.filter(m=>m.kind!=='nest');
  const n={id:uid(),name:'nido '+kind,kind:'nest',w:1024,h:1024,mode:modo,dur:5,fps:30,color:'#888',
    nestClips:[],nestLanes:[],comp:{id:uid(),kind:kind,mediaIds:[],mediaId:null,count:6,el:30,size:40,cols:3,arc:140,
      rings:3,segs:8,turns:3,sizeFrom:1,sizeTo:180,bands:7,bandW:80,mask:'none',rand:[],jitter:0}};
  state.media.push(n);
  state.clips=[]; const c=makeClip(n,state.lanes.findIndex(l=>l.kind==='video'),0); c.dur=5; state.clips.push(c);
  state.selId=c.id; state.selIds=[c.id]; renderInspector();
  const seg=document.querySelector('#icKind');
  const bots=seg?[...seg.querySelectorAll('button')].map(b=>b.dataset.k):[];
  const on=seg?[...seg.querySelectorAll('button.on')].map(b=>b.dataset.k):[];
  const campos=[...document.querySelectorAll('#tfRows input[data-key]')].map(i=>i.dataset.key);
  return { botones:bots, marcado:on, campos }; };1`);

for(const [kind,modo,esperados] of [['tunnel','dome',['count','sizeTo']],['weave','flat',null],['ring','dome',['count','el','size']],['grid','flat',['count','cols']]]){
  const r=await ev(`__probar(${JSON.stringify(kind)},${JSON.stringify(modo)})`);
  console.log(kind.padEnd(7)+' ('+modo+')  botones: '+r.botones.join(',')+'\n         marcado: '+(r.marcado.join(',')||'NINGUNO')+'   ·  campos: '+r.campos.join(', '));
  if(!r.botones.includes(kind)) mal(kind+': su propio tipo no esta en la lista del inspector');
  if(r.marcado.join(',')!==kind) mal(kind+': no queda marcado (marcado: '+(r.marcado.join(',')||'ninguno')+')');
  if((kind==='tunnel'||kind==='weave') && r.campos.includes('size')) mal(kind+': ofrece «Tamano», que ahi no significa nada');
  if(!r.botones.includes('ring')) mal(kind+': en una secuencia de DOMO deberian ofrecerse los tipos de domo');
}
/* y en una secuencia PLANA la lista tiene que ser la plana (es la secuencia quien manda, no el nido) */
await ev(`(async()=>{ await newProject('flat',1920,1080,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()`);
await new Promise(r=>setTimeout(r,1400));
{ const r=await ev(`__probar('grid','flat')`);
  console.log('\nsecuencia PLANA · grid   botones: '+r.botones.join(',')+'\n         marcado: '+(r.marcado.join(',')||'NINGUNO')+'   ·  campos: '+r.campos.join(', '));
  if(r.botones.includes('ring')) mal('en una secuencia plana se siguen ofreciendo tipos de domo');
  if(r.marcado.join(',')!=='grid') mal('en una secuencia plana el tipo actual no queda marcado');
  if(r.campos.includes('el')) mal('en una secuencia plana se ofrece Elevacion, que no existe ahi'); }
console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'inspector correcto en los cuatro casos'));
ws.close();
