/* [R268] Mascara en TODOS los composes + tamano de mascara.
   A. la fila de mascara se ve en los cuatro tipos (tunel incluido, que la tenia prohibida desde R246)
   B. compElProps la lleva a los clips en las TRES ramas (plano, tejido, tunel) con su tamano
   C. la fila de tamano solo aparece con mascara puesta
   D. aplicar guarda mascara y tamano, y reabrir los muestra */
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
await ev(`(function(){ for(let k=0;k<3;k++) state.media.push({id:uid(),name:'m'+k+'.mp4',kind:'video',w:1920,h:1080,dur:10,fps:30,color:'#888',path:'x'+k,folder:null}); renderMedia(); return 1; })()`);

/* B · las tres ramas de compElProps */
const props=await ev(`(function(){
  const base={mediaIds:[],mediaId:null,count:6,size:40,el:30,cols:3,arc:140,rand:[],jitter:0,mask:'circle',maskScale:180,
              bands:4,bandW:100,density:1,weaveMode:'weave',fit:'across',motion:'alternate',speed:0.12,speedV:0.12,
              interlace:true,flip:false,sizeFrom:1,sizeTo:200,curve:60,_aspect:1,_aspects:[1,1,1,1]};
  const uno=(kind,layFn)=>{ const g={...base,kind}; const lay=layFn(g); return compElProps(g,lay[1]); };
  return { anillo:uno('ring',compLayout), tejido:uno('weave',weaveLayout), tunel:uno('tunnel',compLayout),
           plano:(function(){ const g={...base,kind:'grid'}; const lay=compLayoutFlat(g); return compElProps(g,lay[1]); })() }; })()`);
console.log('B · lo que llega a los clips:');
for(const [k,v] of Object.entries(props)) console.log('   '+k.padEnd(8)+'mask='+v.mask+'  maskScale='+v.maskScale);
for(const [k,v] of Object.entries(props)){
  if(v.mask!=='circle') mal(k+': no lleva la mascara ('+v.mask+')');
  if(Math.abs(v.maskScale-1.8)>0.001) mal(k+': el tamano de mascara no llega ('+v.maskScale+')'); }

/* A, C y D · el cuadro */
const cuadro=await ev(`(async function(){ const mid=state.media.find(m=>m.kind==='video').id;
  const res={};
  for(const kind of ['ring','weave','tunnel','grid']){
    const g={id:1,kind,mediaIds:[mid],mediaId:mid,count:6,size:40,el:30,cols:3,arc:140,elMin:10,elMax:60,rand:[],jitter:0,
             mask:'vignette',maskScale:220,bands:4,bandW:100,density:1,weaveMode:'weave',fit:'across',motion:'alternate',
             speed:0.12,speedV:0.12,interlace:true,sizeFrom:1,sizeTo:200,curve:60};
    openCompose(kind,g,null,null,null); await new Promise(s=>setTimeout(s,420));
    const q=s=>document.querySelector(s);
    const filaVisible=(sel)=>{ const e=q(sel); const f=e?e.closest('.frow'):null; return f?getComputedStyle(f).display!=='none':null; };
    res[kind]={ filaMascara:filaVisible('#cMask'), valor:q('#cMask')?q('#cMask').value:null,
                filaTamano:filaVisible('#cMaskSz'), tamano:q('#cMaskSz')?q('#cMaskSz').value:null };
    if(kind==='ring'){ /* al poner «ninguna» la fila de tamano debe esconderse */
      q('#cMask').value='none'; q('#cMask').dispatchEvent(new Event('change')); await new Promise(s=>setTimeout(s,120));
      res.sinMascara={ filaTamano:filaVisible('#cMaskSz') };
      q('#cMask').value='vignette'; q('#cMask').dispatchEvent(new Event('change')); await new Promise(s=>setTimeout(s,120));
      q('#cMaskSz').value=140; try{ q('#cGo').click(); }catch(e){}
      await new Promise(s=>setTimeout(s,300)); res.guardado={mask:g.mask, maskScale:g.maskScale}; continue; }
    try{ if(typeof _cerrarComp==='function')_cerrarComp(); }catch(e){}
    await new Promise(s=>setTimeout(s,150));
  }
  return res; })()`);
console.log('\nA · la fila de mascara por tipo:');
for(const k of ['ring','weave','tunnel','grid']){ const r=cuadro[k];
  console.log('   '+k.padEnd(8)+'fila mascara: '+r.filaMascara+' ('+r.valor+')   fila tamano: '+r.filaTamano+' ('+r.tamano+'%)');
  if(!r.filaMascara) mal(k+': no se ofrece la mascara');
  if(!r.filaTamano) mal(k+': no se ofrece el tamano de mascara');
  if(r.valor!=='vignette') mal(k+': la mascara guardada no se restaura');
  if(+r.tamano!==220) mal(k+': el tamano guardado no se restaura'); }
console.log('\nC · con la mascara en «ninguna», la fila de tamano se ve: '+cuadro.sinMascara.filaTamano);
if(cuadro.sinMascara.filaTamano!==false) mal('la fila de tamano deberia esconderse sin mascara');
console.log('D · tras aplicar con tamano 140: '+JSON.stringify(cuadro.guardado));
if(cuadro.guardado.mask!=='vignette'||cuadro.guardado.maskScale!==140) mal('aplicar no guarda mascara/tamano');

console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'mascara y tamano, correctos en los cuatro tipos'));
ws.close();
