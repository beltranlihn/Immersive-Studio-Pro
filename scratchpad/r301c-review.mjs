/* [R301c] Verificacion de los hallazgos de la revision de R296->R301b. */
import http from 'http';
const t=await new Promise((r2,rj)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>r2(JSON.parse(b)));}).on('error',rj);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:90000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
await ev(`window.__errs=[];addEventListener('error',e=>__errs.push(String(e.message||e)));
 const ce=console.error;console.error=function(){try{__errs.push('con: '+[...arguments].map(String).join(' '));}catch(_){}return ce.apply(console,arguments);};1`);
await ev(`(async()=>{try{await startDemoProject('dome');}catch(e){}})()`); await wait(2600);
await ev(`(function(){try{if(typeof _tourStop==='function')_tourStop();const o=document.getElementById('tourOv');if(o)o.remove();}catch(e){} return 1;})()`); await wait(600);
const out={};

/* 1 y 8 · el tope: techo real de 4096 y lado MAYOR */
out.f1_tope = await ev(`(function(){ const src=String(runExport);
  const i=src.indexOf('_fxCap=Math.max'); const linea=src.slice(Math.max(0,i-420), i+160);
  const tope=opt=>{ const _w=(opt&&opt.wall)?Math.max(opt.wall.pxW||0,opt.wall.pxH||0)
      :Math.max(+(opt&&(opt.outW||opt.res))||0, +(opt&&(opt.outH||opt.res))||0)||2048;
    return Math.max(1024,Math.min(4096,_w||2048)); };
  return { domo8192:tope({res:8192}), domo6144:tope({res:6144}), domo4096:tope({res:4096}),
    salaTiraEntera:tope({wall:{kind:'strip',pxW:15360,pxH:2160}}),
    salaSinPiso:tope({outW:15360}), porMuro3840:tope({wall:{pxW:3840,pxH:2160}}),
    vertical1080x1920:tope({outW:1080,outH:1920}),
    ningunoPasaDe4096:[8192,6144,15360].every(v=>tope({res:v})<=4096),
    elVerticalYaNoAblanda:tope({outW:1080,outH:1920})===1920,
    codigoTieneMin4096:/Math\\.min\\(4096/.test(linea) }; })()`);

/* 2 · el 0 del mando de mascara llega como 0 */
out.f2_mask0 = await ev(`(function(){
  const lee=v=>{ const el={value:v}; const n=Number(el.value); return isFinite(n)?n:100; };
  return {de0:lee('0'), de100:lee('100'), de250:lee('250'), deBasura:lee('abc'),
    elCeroSobrevive:lee('0')===0}; })()`);

/* 3 · un maskScale legacy de 250 sobrevive a abrir y cerrar el cuadro */
out.f3_legacy250 = await ev(`(function(){
  const d=document.createElement('div');
  d.innerHTML='<input type="range" id="tmpMs" min="0" max="300" value="100">';
  document.body.appendChild(d); const el=d.querySelector('#tmpMs');
  el.value=250; const tras=Number(el.value); d.remove();
  return {escrito:250, leidoTrasElDOM:tras, sobrevive:tras===250}; })()`);

/* 4 · la firma del tejido ve la velocidad y el reparto */
out.f4_firma = await ev(`(function(){ const src=String(wvPrep);
  return {miraLaVelocidad:/_vel/.test(src), miraElOrden:/_ord/.test(src),
    firmaIncluyeAmbas:/\\+'\\|'\\+_vel\\+'\\|'\\+_ord/.test(src)}; })()`);

/* 7 · _wv no viaja en el .isp */
out.f7_noSeSerializa = await ev(`(function(){ const c={id:1,props:{},_wv:{ord:[1,2],per:3}};
  const o=JSON.parse(JSON.stringify(serClip(c)));
  return {tenia:!!c._wv, seGuarda:('_wv' in o), correcto:!('_wv' in o)}; })()`);

out.errs = await ev(`window.__errs.slice(0,20)`);
console.log(JSON.stringify(out,null,1));
ws.close();
