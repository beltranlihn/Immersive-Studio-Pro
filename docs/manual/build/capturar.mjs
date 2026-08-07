/* [MANUAL] Las FOTOS del manual, tomadas de la aplicacion de verdad. Cada toma lleva su preparacion (montar el
   proyecto demo, abrir el cuadro que toca) y su recorte por selector, para que la imagen encuadre lo que el
   texto explica en vez de una pantalla entera donde no se distingue nada.
   Se captura a escala 2 porque el destino es un PDF impreso: a escala 1 el texto de la interfaz sale sucio. */
import http from 'http'; import fs from 'fs'; import path from 'path';
const DIR='docs/manual/img'; fs.mkdirSync(DIR,{recursive:true});
const t=await new Promise((r2,j)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>r2(JSON.parse(b)));}).on('error',j);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
if(!pg){ console.log('*** no hay pagina del editor'); process.exit(1); }
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(method,params)=>new Promise((res,rej)=>{const i=++id;p.set(i,r=>r.error?rej(new Error(JSON.stringify(r.error))):res(r.result));ws.send(JSON.stringify({id:i,method,params}));});
const ev=x=>cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true}).then(r=>{ if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||'err'); return r.result.value; });
const esperar=ms=>new Promise(r=>setTimeout(r,ms));

async function foto(nombre, sel, pad=0, marcas=null, rect=null, discos=false){
  let clip=null;
  /* Una franja de la interfaz puede no tener contenedor propio -la barra del visor son seis grupos sueltos-,
     asi que se admite un rectangulo explicito ademas del selector. */
  if(rect){ clip={x:rect[0],y:rect[1],width:rect[2],height:rect[3],scale:2}; }
  else if(sel){
    /* Los selectores se prueban EN ORDEN, uno a uno. Con `querySelector('a, b')` el navegador devuelve el
       primero en orden del DOCUMENTO, no el de la lista: el contenedor del velo salia elegido antes que el
       cuadro de dentro y la foto era la ventana entera. */
    const r=await ev(`(function(){ for(const s of ${JSON.stringify(sel)}.split(',')){
        const e=document.querySelector(s.trim()); if(!e)continue;
        const b=e.getBoundingClientRect(); if(b.width<8||b.height<8)continue;
        return {x:b.x,y:b.y,w:b.width,h:b.height}; } return null; })()`);
    if(!r){ console.log('   -- '+nombre+': no existe '+sel); return false; }
    if(r.w<8||r.h<8){ console.log('   -- '+nombre+': '+sel+' mide '+Math.round(r.w)+'x'+Math.round(r.h)+', no se captura'); return false; }
    clip={x:Math.max(0,r.x-pad),y:Math.max(0,r.y-pad),width:r.w+pad*2,height:r.h+pad*2,scale:2};
  }
  const o=await cmd('Page.captureScreenshot', clip?{format:'png',clip,captureBeyondViewport:false}:{format:'png'});
  /* Las MARCAS: rectangulos de los controles que el texto numera, en pixeles de la imagen ya capturada (por eso
     se restan el origen del recorte y se multiplican por la escala). Los dibuja `anotar.py`. */
  if(marcas && marcas.length){
    const rs=await ev(`(function(){ return ${JSON.stringify(marcas)}.map(function(s){
        const e=document.querySelector(s); if(!e)return null;
        const b=e.getBoundingClientRect(); return {x:b.x,y:b.y,w:b.width,h:b.height}; }); })()`);
    const ox=clip?clip.x:0, oy=clip?clip.y:0, k=clip?clip.scale:1;
    const fuera=[];
    const conv=rs.map((r,i)=>{ if(!r){ fuera.push(marcas[i]); return null; }
      return {n:i+1, x:Math.round((r.x-ox)*k), y:Math.round((r.y-oy)*k),
              w:Math.round(r.w*k), h:Math.round(r.h*k), discos:!!discos}; }).filter(Boolean);
    if(fuera.length) console.log('   !! '+nombre+': sin localizar '+fuera.join(', '));
    fs.writeFileSync(path.join(DIR,nombre+'.marcas.json'), JSON.stringify(conv));
  }
  const f=path.join(DIR,nombre+'.png');
  fs.writeFileSync(f, Buffer.from(o.data,'base64'));
  const kb=Math.round(fs.statSync(f).size/1024);
  console.log('   ok '+nombre+'.png  '+kb+' KB'+(clip?('  '+Math.round(clip.width)+'x'+Math.round(clip.height)):' (ventana)'));
  return true;
}

const TOMAS=JSON.parse(fs.readFileSync(process.argv[2]||'docs/manual/build/tomas.json','utf8'));
let hechas=0, fallos=0;
for(const s of TOMAS){
  try{
    if(s.prep){ await ev(s.prep); }
    await esperar(s.espera||700);
    const ok=await foto(s.n, s.sel||null, s.pad||0, s.marcas||null, s.rect||null, !!s.discos);
    if(ok)hechas++; else fallos++;
  }catch(e){ console.log('   ** '+s.n+': '+String(e.message).split('\n')[0].slice(0,120)); fallos++; }
}
console.log('\n'+hechas+' fotos'+(fallos?('   *** '+fallos+' sin tomar'):''));
ws.close(); process.exit(0);
