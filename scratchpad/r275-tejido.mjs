/* [R275] Los tres del tejido: 11 (aleatorio DENTRO de cada tira), 12 (separar tiras sin encoger) y 13 (rotacion). */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise((res,rej)=>{const i=++id;p.set(i,r=>r.error?rej(new Error(JSON.stringify(r.error))):(r.result.exceptionDetails?rej(new Error(r.result.exceptionDetails.exception?.description||r.result.exceptionDetails.text)):res(r.result.result.value)));
  ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true}}));});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let fallos=0; const mal=m=>{ console.log('   *** '+m); fallos++; };
await ev(`(async()=>{ await newProject('dome',1024,1024,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()`);
await wait(1400);
await ev(`(function(){ for(let k=0;k<4;k++) state.media.push({id:uid(),name:'m'+k+'.mp4',kind:'video',w:1920,h:1080,dur:10,fps:30,color:'#888',path:'x'+k,folder:null}); renderMedia(); return 1; })()`);

const r=await ev(`(function(){
  const ids=state.media.filter(m=>m.kind==='video').map(m=>m.id); const srcs=ids.map(mediaById);
  const base={kind:'weave',mediaIds:ids,mediaId:ids[0],bands:4,bandW:60,density:1,weaveMode:'weave',fit:'across',
              motion:'alternate',speed:0.12,speedV:0.12,interlace:true,flip:false,_aspect:1,_aspects:[1,1,1,1]};
  const reparto=(g)=>{ const lay=weaveLayout(g); ensureCompOrder(g,compOrderCount(lay),srcs.length);
    const porTira=new Map();
    lay.forEach((q,i)=>{ const s=srcs[compMediaIndex(g,(q._src!=null?q._src:i),srcs.length)];
      const k=q._elem!=null?String(q.x)+'|'+String(q.y).slice(0,1):'?';
      const tira=Math.floor(i/ (lay.length/8) );
      if(!porTira.has(tira))porTira.set(tira,[]); porTira.get(tira).push(s.name); });
    return [...porTira.values()].slice(0,3).map(v=>v.slice(0,6).join(' ')); };
  const sinBarajar=reparto({...base,shuffle:false});
  const barajando=reparto({...base,shuffle:true,_orderR:true});
  /* 12 · separacion sin encoger */
  const medidas=(gap)=>{ const l=weaveLayout({...base,gap}); const a=l[0];
    const centros=[...new Set(l.filter(q=>q._axis==='x').map(q=>+q.y.toFixed(2)))].sort((u,v)=>u-v);
    return { escala:+a.scale.toFixed(3), pasoEntreTiras:centros.length>1?+(centros[1]-centros[0]).toFixed(2):null }; };
  const g0=medidas(0), g60=medidas(60);
  /* 13 · rotacion */
  /* una muestra POR TIRA, no los ocho primeros elementos: los ocho primeros son todos de la MISMA tira, asi que
     el modo «alterno» -que alterna por tira- salia constante y parecia roto */
  const rota=(dir)=>{ const g={...base,rotSpeed:45,rotDir:dir}; const l=weaveLayout(g);
    const vistas=new Set(), mods=[];
    for(const q of l){ if(vistas.has(q._src))continue; vistas.add(q._src);
      const a=compWeaveAnim(g,q).find(x=>x.param==='rot'); mods.push(a?a.speed:null); if(mods.length>=8)break; }
    return mods; };
  const sinRot=(function(){ const g={...base,rotSpeed:0}; const l=weaveLayout(g); return compWeaveAnim(g,l[0]).some(x=>x.param==='rot'); })();
  return { sinBarajar, barajando, g0, g60, rSame:rota('same'), rAlt:rota('alt'), rRand:rota('rand'), sinRot }; })()`);

console.log('11 · fuentes DENTRO de cada tira (primeros 6 clips de 3 tiras):');
console.log('   sin barajar:'); r.sinBarajar.forEach(x=>console.log('      '+x));
console.log('   barajando  :'); r.barajando.forEach(x=>console.log('      '+x));
const uniforme=a=>a.every(f=>new Set(f.split(' ')).size===1);
if(!uniforme(r.sinBarajar)) mal('sin barajar, una tira deberia llevar UNA sola fuente');
if(uniforme(r.barajando)) mal('barajando, los clips deberian alternar DENTRO de la tira');

console.log('\n12 · separar sin encoger:');
console.log('   sin separacion: escala '+r.g0.escala+'  paso entre tiras '+r.g0.pasoEntreTiras);
console.log('   al 60%       : escala '+r.g60.escala+'  paso entre tiras '+r.g60.pasoEntreTiras);
if(Math.abs(r.g0.escala-r.g60.escala)>1e-4) mal('separar ha cambiado el tamano del clip');
if(!(r.g60.pasoEntreTiras>r.g0.pasoEntreTiras*1.4)) mal('las tiras no se han separado');

console.log('\n13 · rotacion (grados/s por clip, primeros 8):');
console.log('   todos igual: '+r.rSame.join(' '));
console.log('   alterno    : '+r.rAlt.join(' '));
console.log('   aleatorio  : '+r.rRand.join(' '));
if(r.sinRot) mal('con rotacion 0 no deberia haber modificador');
if(!r.rSame.every(v=>v===45)) mal('«todos igual» deberia dar el mismo sentido');
if(new Set(r.rAlt).size<2) mal('«alterno» deberia alternar el sentido');
if(new Set(r.rRand).size<2) mal('«aleatorio» deberia mezclar sentidos');
console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'los tres del tejido, correctos'));
ws.close();
