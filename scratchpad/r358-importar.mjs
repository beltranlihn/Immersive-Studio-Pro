/* [R358] La prueba del sintoma del usuario: cargar el proyecto e IMPORTAR archivos, vigilando los hilos. */
import http from 'http';
const lista=()=>new Promise((r2,rj)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>r2(JSON.parse(b)));}).on('error',rj);});
const probar=async(u)=>{ const w=new WebSocket(u); try{ await new Promise((ok,mal)=>{w.onopen=ok;w.onerror=mal;setTimeout(()=>mal(new Error('t')),4000);}); }catch(e){ return null; }
  const res=await new Promise(ok=>{ w.onmessage=e=>{const m=JSON.parse(e.data); if(m.id===1)ok(m);};
    w.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:'typeof state!=="undefined" && !!state.media',returnByValue:true}}));
    setTimeout(()=>ok(null),5000); });
  if(res&&res.result&&res.result.result&&res.result.result.value===true) return w;
  try{w.close();}catch(e){} return null; };
let ws=null;
for(let k=0;k<30&&!ws;k++){ const t=await lista();
  for(const pg of t.filter(x=>x.type==='page'&&x.webSocketDebuggerUrl)){ ws=await probar(pg.webSocketDebuggerUrl); if(ws)break; }
  if(!ws) await new Promise(r=>setTimeout(r,2000)); }
if(!ws){ console.log('sin ventana'); process.exit(1); }
let id=1;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const to=(pr,ms)=>Promise.race([pr,new Promise((_,rj)=>setTimeout(()=>rj(new Error('TIMEOUT')),ms))]);
const ev=async(x,ms=200000)=>{const r=await to(cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:ms}),ms);if(r.exceptionDetails)throw new Error(String(r.exceptionDetails.text).slice(0,200));return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const R='/Users/vicentemanzano/Desktop/RITO DIGITAL MASTER/Film Rito Digital/Rito Dome/Rito Dome.isp';
await wait(10000);
await ev(`(async()=>{ state.dirty=false; const t=await DSP.readText(${JSON.stringify(R)}); loadProject(JSON.parse(stripBom(t))); return 1; })()`);
let est=0;
for(let i=0;i<120;i++){ await wait(3000);
  const s=JSON.parse(await ev('JSON.stringify({n:state.media.length,c:state.media.filter(m=>m._loading).length})'));
  if(s.n>=880&&s.c===0){ if(++est>=3)break; } else est=0; }
console.log('cargado:', await ev('JSON.stringify({medios:state.media.length,videos:state.media.filter(m=>m.kind==="video").length})'));
// importa 25 videos del propio proyecto (rutas reales), como haria el usuario
const rutas=await ev(`JSON.stringify(state.media.filter(m=>m.kind==='video'&&m.path).slice(0,25).map(m=>m.path))`).then(JSON.parse);
console.log('importando '+rutas.length+' archivos…');
for(let i=0;i<rutas.length;i++){
  await ev(`(async()=>{ await addVideoFromPath(${JSON.stringify(rutas[i])},'prueba'+${i}); return 1; })()`,120000);
  if(i%5===4){ const n=await ev('state.media.length'); console.log('  tras '+(i+1)+' importados: medios='+n); }
}
await wait(4000);
console.log('FINAL:', await ev(`JSON.stringify({medios:state.media.length, videosConElemento:state.media.filter(m=>m.kind==='video'&&m.el).length, instancias:_vinst.size})`));
process.exit(0);
