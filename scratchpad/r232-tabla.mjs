/* [R232] La tabla del launcher, pintada de verdad: orientación como rótulo y orden como campo. */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:60000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const out={};
await ev(`window.__errs=[];addEventListener('error',e=>__errs.push(String(e.message||e)));1`);

await ev(`showLanding()`); await wait(500);
await ev(`(function(){ const b=document.querySelector('#landingOv [data-lg="ptype"] button[data-v="room"]')||[...document.querySelectorAll('#landingOv button')].find(x=>/360/.test(x.textContent));
  if(b)b.click(); return 1; })()`); await wait(600);

out.tabla = await ev(`(function(){ const filas=[...document.querySelectorAll('.lch-wrow')];
  return { filas:filas.length,
    selectoresDeOrientacion:document.querySelectorAll('[data-lface]').length,
    orientacionSonRotulos:filas.every(f=>{ const e=f.querySelector('.lch-facing'); return e&&e.tagName==='SPAN'; }),
    orientaciones:filas.map(f=>f.querySelector('.lch-facing').textContent.trim()),
    campos:filas.map(f=>[...f.querySelectorAll('input')].map(i=>i.dataset.lk)),
    cabecera:[...document.querySelectorAll('.lch-whead span')].map(s=>s.textContent.trim()) }; })()`);

/* teclear un orden en el campo de la primera fila y confirmar con Enter */
out.tecleado = await ev(`(function(){ const filas=[...document.querySelectorAll('.lch-wrow')];
  const inp=filas[0].querySelector('input[data-lk$="ord"]'); if(!inp)return {sinCampo:true};
  const antes=lchActiveWalls().map(w=>w.role+':'+w.ord);
  inp.focus(); inp.value='4';
  inp.dispatchEvent(new Event('input',{bubbles:true}));
  inp.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  const despues=lchActiveWalls().map(w=>w.role+':'+w.ord);
  const ords=lchActiveWalls().map(w=>w.ord).sort((a,b)=>a-b);
  return { antes, despues, tira:lchCfgWalls().map(w=>w.role),
    permutacionValida:JSON.stringify(ords)===JSON.stringify([1,2,3,4]) }; })()`);
await wait(400);
out.trasRepintar = await ev(`(function(){ const filas=[...document.querySelectorAll('.lch-wrow')];
  return { orientaciones:filas.map(f=>f.querySelector('.lch-facing').textContent.trim()),
    ordenes:filas.map(f=>f.querySelector('input[data-lk$="ord"]').value) }; })()`);

{ const {data}=await cmd('Page.captureScreenshot',{format:'png'});
  const fs=await import('fs'), os=await import('os'), path=await import('path');
  const dir=path.join(os.tmpdir(),'isp-r232'); try{fs.mkdirSync(dir,{recursive:true});}catch(_){}
  fs.writeFileSync(path.join(dir,'launcher.png'),Buffer.from(data,'base64')); out.shot=path.join(dir,'launcher.png'); }

out.errs = await ev(`window.__errs.slice(0,15)`);
console.log(JSON.stringify(out,null,1));
ws.close();
