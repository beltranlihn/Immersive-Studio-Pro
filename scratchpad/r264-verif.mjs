/* [R264] Giro (tirabuzon) y Helice del tunel, separados.
   A. GIRO: ahora es progresivo -> la rotacion del elemento CAMBIA a lo largo del ciclo (antes era estatica).
   B. HELICE: el elemento se aparta del eje, mas cuanto mas cerca, y la direccion da una vuelta por ciclo.
   C. Con los dos a cero, nada cambia respecto de antes (ni props ni modificadores de mas).
   D. El cuadro los guarda y los restaura. */
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

const r=await ev(`(function(){
  const base={kind:'tunnel',mediaIds:[],mediaId:null,count:6,sizeFrom:1,sizeTo:200,speed:0.5,curve:60,spin:0,mask:'none',rand:[],jitter:0};
  const traza=(g,param)=>{ const lay=compLayout(g); const p=lay[1];
    const c={id:1,start:0,speed:1,props:compElProps(g,p),anim:compTunnelAnim(g,p._phase||0)};
    return [0,0.25,0.5,0.75].map(u=>+ (evalR(c,param,u/g.speed)||0).toFixed(2)); };
  const props=(g)=>{ const lay=compLayout(g); return compElProps(g,lay[1]); };
  const mods=(g)=>{ const lay=compLayout(g); return compTunnelAnim(g,lay[1]._phase||0).map(a=>a.param); };
  return {
    rotSin:  traza({...base,twist:0,helix:0},'rot'),
    rotCon:  traza({...base,twist:360,helix:0},'rot'),
    hAngSin: traza({...base,twist:0,helix:0},'helixAng'),
    hAngCon: traza({...base,twist:0,helix:60},'helixAng'),
    propsCero: props({...base,twist:0,helix:0}),
    propsHel:  props({...base,twist:0,helix:60}),
    modsCero: mods({...base,twist:0,helix:0}),
    modsAmbos: mods({...base,twist:360,helix:60}) }; })()`);
console.log('A · GIRO (rotacion del elemento a lo largo del ciclo 0/0,25/0,5/0,75)');
console.log('   giro 0   : '+r.rotSin.join(', '));
console.log('   giro 360 : '+r.rotCon.join(', ')+'   <- tiene que AVANZAR');
if(r.rotCon.every(v=>v===r.rotCon[0])) mal('el giro sigue siendo estatico');
if(!r.rotSin.every(v=>v===0)) mal('con giro 0 no deberia haber rotacion');
if(Math.abs(r.rotCon[3]-r.rotCon[0]-270)>1) mal('el giro no avanza 360 grados por ciclo (deberia ir 0,90,180,270)');

console.log('\nB · HELICE');
console.log('   helice 0  : angulo '+r.hAngSin.join(', ')+' · helix en props: '+r.propsCero.helix);
console.log('   helice 60 : angulo '+r.hAngCon.join(', ')+' · helix en props: '+r.propsHel.helix.toFixed(3));
if(!(r.propsHel.helix>0)) mal('la helice no llega a las props del clip');
if(r.hAngCon.every(v=>v===r.hAngCon[0])) mal('la direccion de la helice no gira');
if(Math.abs((r.hAngCon[3]-r.hAngCon[0])-270)>1) mal('la direccion no da una vuelta entera por ciclo');

console.log('\nC · con los dos a cero: modificadores '+r.modsCero.join(', ')+' · con los dos: '+r.modsAmbos.join(', '));
if(r.modsCero.length!==2) mal('con giro y helice a cero deberian quedar solo size y opacity');
if(r.propsCero.helix!==0) mal('con helice 0 la prop deberia ser 0');
if(!(r.modsAmbos.includes('rot')&&r.modsAmbos.includes('helixAng'))) mal('faltan modificadores con los dos activos');

/* D · ida y vuelta por el cuadro */
await ev(`(function(){ if(!state.media.some(m=>m.kind==='video')) state.media.push({id:uid(),name:'f.mp4',kind:'video',w:1920,h:1080,dur:10,fps:30,color:'#888',path:'x',folder:null}); renderMedia(); return 1; })()`);
const d=await ev(`(async function(){ const mid=state.media.find(m=>m.kind==='video').id;
  const g={id:7,kind:'tunnel',mediaIds:[mid],mediaId:mid,count:6,sizeFrom:1,sizeTo:200,speed:0.12,curve:60,
           twist:180,helix:45,fadeIn:0.5,fadeOut:0.5,cols:3,arc:140,el:30,elMin:10,elMax:60,size:40,mask:'none',rand:[],jitter:0};
  openCompose('tunnel',g,null,null,null); await new Promise(r=>setTimeout(r,500));
  const q=s=>document.querySelector(s);
  const visto={ twist:q('#cTTwist')?q('#cTTwist').value:null, helix:q('#cTHelix')?q('#cTHelix').value:null };
  q('#cTHelix').value=70; q('#cTTwist').value=90;
  try{ q('#cGo').click(); }catch(e){}
  await new Promise(r=>setTimeout(r,400));
  return { visto, guardado:{twist:g.twist, helix:g.helix} }; })()`);
console.log('\nD · el cuadro muestra ' + JSON.stringify(d.visto) + ' y tras aplicar guarda ' + JSON.stringify(d.guardado));
if(+d.visto.twist!==180||+d.visto.helix!==45) mal('el cuadro no restaura giro/helice');
if(d.guardado.twist!==90||d.guardado.helix!==70) mal('aplicar no guarda giro/helice');

console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'giro y helice, correctos'));
ws.close();
