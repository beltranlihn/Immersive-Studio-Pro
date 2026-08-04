/* [R248] La prueba honesta: abrir el dialogo de cada composicion y Aplicar sin tocar nada NO puede cambiar
   NI UN PIXEL de lo que se ve. Compara el render real antes y despues, no la forma del objeto. */
import http from 'http'; import fs from 'fs'; import crypto from 'crypto';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:90000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const sha=s=>crypto.createHash('sha1').update(s).digest('hex').slice(0,12);

/* pone CADA nido en la linea de tiempo por turno y saca su render */
await ev(`window.__tira=async function(){ const out=[];
  for(const n of state.media.filter(x=>x.kind==='nest'&&x.comp)){
    state.clips=[]; const vl=state.lanes.findIndex(l=>l.kind==='video');
    const c=makeClip(n,vl<0?0:vl,0); c.dur=n.dur||5; c.props.fulldome=true; c.props.equirect=false;
    if(n.comp.kind==='weave'){ c.props.fisheye=true; c.props.fisheyeAmt=50; }
    state.clips.push(c);
    for(const T of [0,1.7]){ state.playhead=T; _previewClock=T; render(); await new Promise(r=>requestAnimationFrame(r));
      const S=Math.min(glc.width,glc.height), sx=(glc.width-S)/2, sy=(glc.height-S)/2;
      const cv=document.createElement('canvas'); cv.width=cv.height=180; const g=cv.getContext('2d');
      g.fillStyle='#000'; g.fillRect(0,0,180,180); g.drawImage(glc,sx,sy,S,S,0,0,180,180);
      out.push(n.name+'@'+T+':'+cv.toDataURL('image/png')); } }
  return out; };1`);

const antes=await ev(`__tira()`);
const hAntes=antes.map(l=>l.split(':')[0]+' '+sha(l));
console.log('render ANTES:'); hAntes.forEach(h=>console.log('   '+h));

const r=await ev(`(async()=>{ for(const n of state.media.filter(x=>x.kind==='nest'&&x.comp).slice()){
    openCompose(null,null,n,null,null); await new Promise(r=>setTimeout(r,150));
    document.querySelector('#cGo').click(); await new Promise(r=>setTimeout(r,250)); }
  return document.querySelectorAll('#compOv').length; })()`);
console.log('\ndialogos abiertos que quedan: '+r+(r===0?'  (todos cerrados, correcto)':'  *** alguno quedo abierto ***'));

const despues=await ev(`__tira()`);
const hDesp=despues.map(l=>l.split(':')[0]+' '+sha(l));
console.log('\nrender DESPUES de abrir + Aplicar sin tocar nada:');
let mal=0;
hAntes.forEach((h,i)=>{ const ok=(h===hDesp[i]); if(!ok)mal++;
  console.log('   '+hDesp[i]+(ok?'   IDENTICO':'   *** CAMBIO: era '+h+' ***')); });
console.log('\n'+(mal?('*** '+mal+' render(s) cambiaron ***'):'Ningun pixel cambio en ningun nido.'));
ws.close();
