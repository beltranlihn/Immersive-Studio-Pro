/* [R282] La chapa en el VISOR: se enciende desde Window, se rellena desde su cuadro, y lo que se ve es lo
   mismo que se hornea porque los datos viven en el proyecto, no duplicados en la hoja de export. */
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
const r=await ev(`(function(){
  const out={};
  out.apagadaAlInicio=!(state.slate&&state.slate.viewer);
  out.capaAntes=!!document.querySelector('#slateOv');
  state.slate.obra='Rito Digital'; state.slate.autor='Alma Digital Studio'; state.slate.viewer=true; render();
  const ov=document.querySelector('#slateOv');
  out.capaDespues=!!ov; out.visible=ov?getComputedStyle(ov).display:'(no hay)';
  if(ov){ const c=document.createElement('canvas'); c.width=c.height=ov.width; c.getContext('2d').drawImage(ov,0,0);
    const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    const R=c.width/2, cx=R, cy=R; let dentro=0, fuera=0;
    for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){ const i=(y*c.width+x)*4; if(d[i+3]<8)continue;
      if((x-cx)*(x-cx)+(y-cy)*(y-cy)<R*R)dentro++; else fuera++; }
    out.pxDentro=dentro; out.pxFuera=fuera; }
  state.slate.viewer=false; render();
  out.trasApagar=document.querySelector('#slateOv')?getComputedStyle(document.querySelector('#slateOv')).display:'(no hay)';
  /* que el proyecto se los lleve */
  const j=JSON.parse(JSON.stringify(serProject()));
  out.enProyecto=!!(j.slate&&j.slate.obra==='Rito Digital');
  return out; })()`);
console.log('apagada al iniciar: '+r.apagadaAlInicio+'   capa antes de encender: '+r.capaAntes);
console.log('al encender -> capa: '+r.capaDespues+'  display: '+r.visible+'   px fuera del circulo: '+r.pxFuera+'   DENTRO: '+r.pxDentro);
console.log('al apagar -> display: '+r.trasApagar+'   guardada en el .isp: '+r.enProyecto);
if(!r.apagadaAlInicio) mal('la chapa nace encendida: nadie la ha pedido todavia');
if(!r.capaDespues||r.visible==='none') mal('no aparece al encenderla');
if(!r.pxFuera||r.pxFuera<200) mal('no ha dibujado datos ('+r.pxFuera+' px)');
if(r.pxDentro) mal(r.pxDentro+' px dentro del circulo: en el visor tambien invade');
if(r.trasApagar!=='none') mal('no se apaga desde Window');
if(!r.enProyecto) mal('los datos no viajan en el .isp');
console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'la chapa se ve en el visor, se apaga, no toca el circulo, y viaja con el proyecto'));
ws.close();
