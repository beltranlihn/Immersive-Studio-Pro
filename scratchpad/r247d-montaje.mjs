/* [R247d] Recorrido por los parametros: una tras otra, las composiciones que salen moviendo cada mando.
   Cada variante se graba con su rotulo, para que se vea QUE se toco y COMO responde.
   Sin acentos graves dentro de las plantillas. */
import http from 'http';
import fs from 'fs';
import path from 'path';
const PORT=process.argv[2]||9222;
const FPS=25, SEGS=2.8;
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:PORT,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:120000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));

console.log('GPU:', await ev(`(function(){const d=gl.getExtension('WEBGL_debug_renderer_info'); return d?gl.getParameter(d.UNMASKED_RENDERER_WEBGL):'?';})()`));
await ev(`state.dirty=false;1`);
await ev(`(async()=>{ await newProject('dome',2048,2048,60,180,true); })()`); await wait(900);
await ev(`(function(){ const b=document.querySelector('#viewModeSeg button[data-v="2d"]'); if(b)b.click();
  state.view.showGrid=false; state.view.showOutline=false; state.view.hfade=false; state.motionPreview=true;
  state.view.zoom=1; state.view.pan=[0,0]; resize(); render(); return 1; })()`); await wait(400);

await ev(`window.__opacas=function(){ state.media=state.media.filter(m=>m.kind!=='image');
  const mk=(nombre,W,H,color)=>{ const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
    const x=cv.getContext('2d'); x.fillStyle=color; x.fillRect(0,0,W,H);
    const r=Math.min(W,H)*0.33; x.strokeStyle='rgba(255,255,255,.5)'; x.lineWidth=Math.max(2,Math.min(W,H)*0.018);
    x.beginPath(); x.arc(W/2,H/2,r,0,7); x.stroke();
    const m={id:uid(),kind:'image',name:nombre,el:cv,originalEl:cv,tex:newTex(),w:W,h:H,dur:10,fps:0,color,missing:false,_loading:false};
    upTex(m.tex,cv); try{m.thumb=cv.toDataURL();}catch(e){} state.media.push(m); return m; };
  mk('1x1',512,512,'#7FD4FF'); mk('16x9',960,540,'#FFB37F'); mk('9x16',540,960,'#C8A2FF');
  mk('4x3',640,480,'#9BE59B'); mk('1x1b',512,512,'#FF9BC4'); mk('3x2',720,480,'#E8E07F');
  renderMedia(); return state.media.filter(m=>m.kind==='image').map(m=>m.id); };
window.__monta=function(cfg){ state.clips=[]; state.media=state.media.filter(m=>m.kind!=='nest');
  const ids=__opacas();
  const nest=createComposition(Object.assign({kind:'weave',mediaIds:ids},cfg));
  state.playhead=1; renderTimeline(); render(); return nest?nest.nestClips.length:0; };
window.__grabR=function(clock,titulo,pie){ _previewClock=clock; render();
  const S=Math.min(glc.width,glc.height), sx=Math.round((glc.width-S)/2), sy=Math.round((glc.height-S)/2);
  const W=520,H=580; const cv=document.createElement('canvas'); cv.width=W; cv.height=H; const g=cv.getContext('2d');
  g.fillStyle='#08090B'; g.fillRect(0,0,W,H);
  g.drawImage(glc, sx,sy,S,S, 10,10,500,500);
  g.fillStyle='#E8EAED'; g.font='600 20px Inter,system-ui,sans-serif'; g.textAlign='center';
  g.fillText(titulo, W/2, 542);
  g.fillStyle='#8A9199'; g.font='400 13px ui-monospace,monospace';
  g.fillText(pie, W/2, 564);
  return cv.toDataURL('image/png'); };1`);

const BASE={bands:5,weaveMode:'weave',bandW:100,fit:'across',density:1,speed:0.10,speedV:0.10,motion:'alternate',interlace:true};
const pasos=[
 ['Tejido lleno',            'tiras 5 · ancho 100% · alterno',            {}],
 ['Ancho de tira 75%',       'empieza a abrirse el hueco',                {bandW:75}],
 ['Ancho de tira 50%',       'cesteria suelta sobre negro',               {bandW:50}],
 ['Ancho de tira 28%',       'casi solo las lineas',                      {bandW:28}],
 ['12 tiras',                'tiras 12 · ancho 90% · mucho mas fino',     {bands:12,bandW:90}],
 ['3 tiras',                 'tiras 3 · ancho 100% · piezas enormes',     {bands:3}],
 ['Lado largo a lo largo',   'el clip se tumba en la direccion de avance',{fit:'along',bands:4}],
 ['Empaque 65%',             'aire ENTRE clips, sin solaparse nunca',     {density:0.65,bandW:70}],
 ['Movimiento a la vez',     'todas las tiras al mismo lado',             {motion:'same'}],
 ['Invertir',                'el mismo, del reves',                       {motion:'same',flip:true}],
 ['Movimiento quieto',       'sin modificador: el tejido se para',        {motion:'still'}],
 ['Dos velocidades',         'la familia vertical seis veces mas rapida', {motion:'same',speed:0.05,speedV:0.30}],
 ['Sin entrelazar',          'la familia de arriba pasa por encima entera',{bandW:62,interlace:false}],
 ['Solo lineas ↔',           '4 lineas · ancho 35% · a lo largo',         {weaveMode:'h',bands:4,bandW:35,fit:'along'}],
 ['Solo lineas ↕',           '9 lineas · ancho 70% · cruzando',           {weaveMode:'v',bands:9,bandW:70}],
];

const dir=path.join(process.cwd(),'scratchpad','r247d-mont');
fs.rmSync(dir,{recursive:true,force:true}); fs.mkdirSync(dir,{recursive:true});
let f=0;
for(const [titulo,pie,delta] of pasos){
  const n=await ev(`__monta(${JSON.stringify(Object.assign({},BASE,delta))})`); await wait(500);
  const N=Math.round(FPS*SEGS);
  for(let i=0;i<N;i++){
    const url=await ev(`__grabR(${(i/FPS).toFixed(4)},${JSON.stringify(titulo)},${JSON.stringify(pie)})`);
    fs.writeFileSync(path.join(dir,'f'+String(f++).padStart(5,'0')+'.png'), Buffer.from(url.split(',')[1],'base64'));
  }
  console.log(titulo.padEnd(24)+' '+String(n).padStart(4)+' clips');
}
console.log('total '+f+' fotogramas');
await ev(`_previewClock=0; state.view.zoom=0.92; render(); 1`);
ws.close();
