/* [R277] Las pestanas de secuencia: ancho FIJO -que no lo mande el nombre- y que quepan tres, cortando el resto
   con desplazamiento horizontal. Se comprueba con nombres de largo muy distinto, que es lo que rompia antes. */
import http from 'http'; import fs from 'fs';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let fallos=0; const mal=m=>{ console.log('   *** '+m); fallos++; };

await ev(`(async()=>{ await newProject('dome',1024,1024,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()`);
await wait(1600);
/* Seis secuencias abiertas con nombres de largo dispar: el caso que Beltran describe. */
const n=await ev(`(function(){
  const base=state.media.find(isSeqMedia); if(!base)return 'no hay secuencia base';
  const nombres=['Intro','Un nombre francamente larguisimo para una secuencia','B','Escena 4 - alternativa','Creditos finales del montaje','C2'];
  nombres.forEach(nb=>{ const m=JSON.parse(JSON.stringify(base)); m.id=uid(); m.name=nb; state.media.push(m); state.openSeqs.push(m.id); });
  renderSeqBar(); renderMedia(); return state.openSeqs.length; })()`);
console.log('secuencias abiertas: '+n);
await wait(500);

const r=await ev(`(function(){
  const bar=document.querySelector('#seqTabs');
  const tabs=[...bar.querySelectorAll('.seqtab:not(.seqadd)')];
  const anchos=tabs.map(t=>Math.round(t.getBoundingClientRect().width));
  const w=bar.getBoundingClientRect().width;
  /* cuantas caben ENTERAS dentro del hueco visible */
  const l0=bar.getBoundingClientRect().left;
  const caben=tabs.filter(t=>{ const b=t.getBoundingClientRect(); return b.right<=l0+w+0.5; }).length;
  /* la barra de transporte: la pestana no debe llegar a los botones de reproduccion */
  const play=document.querySelector('#playBtn')||document.querySelector('[id*=play]');
  const hueco=play?Math.round(play.getBoundingClientRect().left-(l0+w)):null;
  /* [R277c] «que no se alcance a ver la cabecita del otro»: ninguna pestana puede quedar A MEDIAS dentro del
     hueco visible. Se cuentan las que asoman sin caber enteras. */
  const asoman=tabs.filter(t=>{ const b=t.getBoundingClientRect(); return b.left<l0+w-0.5 && b.right>l0+w+0.5; }).length;
  const mas=document.querySelector('.transport > .seqadd');
  return {anchos, w:Math.round(w), scrollW:Math.round(bar.scrollWidth), caben, hueco, asoman,
          masFuera:!!mas, masVisible:mas?Math.round(mas.getBoundingClientRect().width)>0:false,
          rotulos:tabs.map(t=>t.querySelector('.seqlab').textContent.length),
          tooltip:(tabs[1]&&tabs[1].title||'').slice(0,42), x:Math.round(l0), y:Math.round(bar.getBoundingClientRect().top), h:Math.round(bar.getBoundingClientRect().height)}; })()`);

console.log('anchos de pestana: '+r.anchos.join(', '));
console.log('largo de los rotulos: '+r.rotulos.join(', ')+'  (los nombres SI son dispares)');
console.log('barra: '+r.w+' px visibles de '+r.scrollW+' px totales   caben enteras: '+r.caben+'   asoman a medias: '+r.asoman+'   boton + fuera: '+r.masFuera);
console.log('hueco hasta el boton de reproducir: '+r.hueco+' px');
console.log('tooltip de la 2a: "'+r.tooltip+'..."');

const unico=[...new Set(r.anchos)];
if(unico.length!==1) mal('las pestanas NO miden lo mismo: '+unico.join('/')+' -> el nombre sigue mandando');
if(new Set(r.rotulos).size<3) mal('los nombres de prueba no son bastante dispares: no se prueba nada');
if(r.caben!==3) mal('caben '+r.caben+' pestanas enteras y se pidieron 3');
if(r.asoman) mal('asoma '+r.asoman+' pestana a medias: se pidio que no se viera la cabeza de la siguiente');
if(!r.masFuera) mal('el boton + sigue dentro de la tira: se perderia al desplazar');
if(!r.masVisible) mal('el boton + no se ve');
if(r.scrollW<=r.w+4) mal('no hay nada que desplazar: la barra no llega a cortarse con 6 secuencias');
if(r.hueco!=null&&r.hueco<0) mal('la barra se solapa con los botones de reproduccion');

/* Y que el desplazamiento horizontal funcione de verdad. */
const d=await ev(`(function(){ const b=document.querySelector('#seqTabs'); const a=b.scrollLeft; b.scrollLeft=9999; return {a, b:Math.round(b.scrollLeft)}; })()`);
console.log('desplazamiento: '+d.a+' -> '+d.b);
if(d.b<=d.a) mal('no se puede desplazar horizontalmente');
await ev(`document.querySelector('#seqTabs').scrollLeft=0`); await wait(200);

const shot=await cmd('Page.captureScreenshot',{format:'png',clip:{x:Math.max(0,r.x-8),y:Math.max(0,r.y-8),width:r.w+320,height:r.h+16,scale:4}});
fs.writeFileSync('scratchpad/r277-pestanas.png', Buffer.from(shot.data,'base64'));
console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'ancho fijo, tres a la vista y el resto por desplazamiento')+'   ·   captura: scratchpad/r277-pestanas.png');
ws.close();
