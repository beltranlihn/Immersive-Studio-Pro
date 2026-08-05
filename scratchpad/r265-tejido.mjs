/* [R265] Los mandos del tejido que pidio Beltran.
   A. DIRECCION en tres opciones (un sentido / el otro / intercalado) + quieto, y que «el otro» sea de verdad el
      contrario de «un sentido».
   B. SHUFFLE: que reparta que fuente va a cada TIRA (antes solo se ofrecia en el relleno de domo, y el tejido ni
      lo miraba porque usaba el indice de tira directo).
   C. Los tres segmentados marcan lo guardado al reabrir (llevaban «on» fijo en la primera opcion).
   D. Un tejido viejo con flip:true se ve igual: el sentido se pliega en la opcion mostrada. */
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
await ev(`(function(){ for(let k=0;k<4;k++) state.media.push({id:uid(),name:'m'+k+'.mp4',kind:'video',w:1920,h:1080,dur:10,fps:30,color:'#888',path:'x'+k,folder:null}); renderMedia(); return 1; })()`);

/* A · sentidos */
const dirs=await ev(`(function(){
  const ids=state.media.filter(m=>m.kind==='video').map(m=>m.id);
  const base={kind:'weave',mediaIds:ids,mediaId:ids[0],bands:4,bandW:100,density:1,weaveMode:'weave',fit:'across',
              speed:0.12,speedV:0.12,interlace:true,flip:false,shuffle:false,rand:[],jitter:0,_aspect:1,_aspects:[1,1,1,1]};
  const sent=(mov)=>{ const l=weaveLayout({...base,motion:mov}); const v=[]; let last=null;
    for(const q of l){ if(q._src!==last){ v.push(q._dir); last=q._src; } } return v.slice(0,8); };
  return { unSentido:sent('same'), elOtro:sent('rev'), intercalado:sent('alternate'), quieto:sent('still') }; })()`);
console.log('A · sentido por tira (una entrada por tira):');
for(const [k,v] of Object.entries(dirs)) console.log('   '+k.padEnd(12)+v.join(', '));
if(!dirs.unSentido.every(v=>v===1)) mal('«un sentido» no va todo en el mismo sentido');
if(!dirs.elOtro.every(v=>v===-1)) mal('«el otro» no es el contrario de «un sentido»');
if(!(dirs.intercalado[0]!==dirs.intercalado[1])) mal('«intercalado» no alterna entre tiras contiguas');
if(!dirs.quieto.every(v=>v===0)) mal('«quieto» no deja las tiras quietas');

/* B · shuffle por tira */
const shuf=await ev(`(function(){
  const ids=state.media.filter(m=>m.kind==='video').map(m=>m.id);
  const base={kind:'weave',mediaIds:ids,mediaId:ids[0],bands:4,bandW:100,density:1,weaveMode:'weave',fit:'across',
              motion:'alternate',speed:0.12,speedV:0.12,interlace:true,flip:false,rand:[],jitter:0,_aspect:1,_aspects:[1,1,1,1]};
  const reparto=(g)=>{ const srcs=g.mediaIds.map(mediaById); const lay=weaveLayout(g); ensureCompOrder(g,lay.length,srcs.length);
    const porTira=new Map();
    lay.forEach((q,i)=>{ const s=srcs[compMediaIndex(g,(q._src!=null?q._src:i),srcs.length)];
      if(!porTira.has(q._src))porTira.set(q._src,new Set()); porTira.get(q._src).add(s.name); });
    return { fuentePorTira:[...porTira.entries()].slice(0,8).map(([k,v])=>[...v].join('+')),
             algunaTiraMezclada:[...porTira.values()].some(v=>v.size>1) }; };
  const sin=reparto({...base,shuffle:false});
  const con=reparto({...base,shuffle:true,_orderR:true});
  return {sin,con}; })()`);
console.log('\nB · que fuente va a cada tira:');
console.log('   sin barajar: '+shuf.sin.fuentePorTira.join(' | '));
console.log('   barajando  : '+shuf.con.fuentePorTira.join(' | '));
if(shuf.sin.algunaTiraMezclada||shuf.con.algunaTiraMezclada) mal('una tira ha recibido MAS DE UNA fuente: rompe la regla de una fuente por tira');
if(shuf.sin.fuentePorTira.join()===shuf.con.fuentePorTira.join()) mal('barajar no cambia el reparto (puede ser casualidad: repetir)');

/* C y D · el cuadro */
const cuadro=await ev(`(async function(){
  const ids=state.media.filter(m=>m.kind==='video').map(m=>m.id);
  const g={id:5,kind:'weave',mediaIds:ids,mediaId:ids[0],bands:7,bandW:60,density:0.8,weaveMode:'v',fit:'along',
           motion:'same',flip:true,speed:0.3,speedV:0.2,interlace:false,shuffle:true,size:40,el:30,cols:3,arc:140,mask:'none',rand:[],jitter:0};
  openCompose('weave',g,null,null,null); await new Promise(r=>setTimeout(r,500));
  const on=(host)=>{ const h=document.querySelector(host); const b=h?h.querySelector('button.on'):null; return b?(b.dataset.w||b.dataset.f||b.dataset.m):null; };
  const visto={ modo:on('#cWMode'), lado:on('#cWFit'), sentido:on('#cWMov'),
                tiras:document.querySelector('#cWBands')?document.querySelector('#cWBands').value:null,
                ancho:document.querySelector('#cWBandW')?document.querySelector('#cWBandW').value:null,
                barajar:document.querySelector('#cShuffle')?document.querySelector('#cShuffle').checked:null,
                filaBarajarVisible:(function(){ const r=document.querySelector('#cShuffle'); const f=r?r.closest('.frow'):null; return f?getComputedStyle(f).display!=='none':null; })(),
                hayInvertir:!!document.querySelector('#cWFlip') };
  try{ document.querySelector('#cGo').click(); }catch(e){}
  await new Promise(r=>setTimeout(r,400));
  return { visto, guardado:{motion:g.motion, flip:g.flip, weaveMode:g.weaveMode, fit:g.fit, bands:g.bands, shuffle:g.shuffle} }; })()`);
console.log('\nC y D · el cuadro con un tejido guardado (modo v, lado along, «a la vez»+invertir, 7 tiras, barajar):');
console.log('   muestra : '+JSON.stringify(cuadro.visto));
console.log('   guarda  : '+JSON.stringify(cuadro.guardado));
if(cuadro.visto.modo!=='v') mal('la disposicion no se marca');
if(cuadro.visto.lado!=='along') mal('el lado largo no se marca');
if(cuadro.visto.sentido!=='rev') mal('«a la vez»+invertir deberia mostrarse como «el otro sentido» (muestra '+cuadro.visto.sentido+')');
if(cuadro.visto.hayInvertir) mal('la casilla Invertir sigue ahi');
if(cuadro.visto.filaBarajarVisible!==true) mal('la fila de Barajar no se ve con un tejido');
if(+cuadro.visto.tiras!==7||+cuadro.visto.ancho!==60) mal('tiras/ancho no se restauran');
if(cuadro.guardado.motion!=='rev'||cuadro.guardado.flip!==false) mal('al aplicar no se guarda el sentido plegado');
if(cuadro.guardado.shuffle!==true) mal('al aplicar se pierde el barajar');

console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'los mandos del tejido, correctos'));
ws.close();
