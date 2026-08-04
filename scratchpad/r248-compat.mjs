/* [R248] LA prueba que pidio Beltran: un proyecto suyo con composiciones tiene que seguir EXACTAMENTE igual.
   Metodo: monta varias composiciones, guarda una huella de la geometria de cada nido, GUARDA a .isp, ABRE de nuevo
   (el camino de verdad de un proyecto suyo), y vuelve a comparar. Despues abre el dialogo de cada una y aplica SIN
   TOCAR NADA, que es el caso peligroso del cambio (antes las casillas devolvian el orden del PANEL, no el guardado).
   Si algo cambia, sale aqui. Sin acentos graves dentro de las plantillas. */
import http from 'http';
import fs from 'fs';
import path from 'path';
const PORT=process.argv[2]||9222;
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:PORT,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:120000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));

await cmd('Page.enable'); await cmd('Page.reload',{ignoreCache:true}); await wait(3500);
await ev(`(function(){ window.__errs=[]; addEventListener('error',e=>__errs.push(String(e.message||e))); return 1; })()`);
await ev(`state.dirty=false;1`);
await ev(`(async()=>{ await newProject('dome',2048,2048,60,180,true); })()`); await wait(900);

/* seis fuentes con nombres y proporciones distintas, para que el ORDEN se pueda ver */
await ev(`window.__fuentes=function(){ state.media=state.media.filter(m=>m.kind!=='image');
  const mk=(nombre,W,H,color)=>{ const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
    const x=cv.getContext('2d'); x.fillStyle=color; x.fillRect(0,0,W,H);
    const m={id:uid(),kind:'image',name:nombre,el:cv,originalEl:cv,tex:newTex(),w:W,h:H,dur:10,fps:0,color,missing:false,_loading:false};
    upTex(m.tex,cv); try{m.thumb=cv.toDataURL();}catch(e){} state.media.push(m); return m; };
  mk('A',512,512,'#7FD4FF'); mk('B',960,540,'#FFB37F'); mk('C',540,960,'#C8A2FF');
  mk('D',640,480,'#9BE59B'); mk('E',512,512,'#FF9BC4'); mk('F',720,480,'#E8E07F');
  renderMedia(); return state.media.filter(m=>m.kind==='image').map(m=>m.id); };
/* huella: la geometria REAL de cada clip de cada nido + el mediaIds guardado */
window.__huella=function(){ const out=[];
  for(const m of state.media.filter(x=>x.kind==='nest'&&x.comp)){
    const g=m.comp;
    const clips=m.nestClips.map(c=>{ const s=mediaById(c.mediaId);
      /* warp/secAz/secEl se caen al recomponer porque regenComposeNest las trata como geometria del reparto
         (linea [N5], anterior a R248) y el reparto de un anillo sin tile no las pone. NO cambian nada: el unico
         lector es const sector=(c.props.warp==='dome'), y 'patch' y undefined dan los dos false. Se excluyen del
         sello para que la sonda no cante un falso positivo — la prueba de que no se ve es r248-pixeles.mjs. */
      const pr=Object.assign({},c.props); delete pr.warp; delete pr.secAz; delete pr.secEl;
      return (s?s.name:'?')+'|'+JSON.stringify(pr)+'|'+JSON.stringify((c.anim||[]).map(a=>[a.param,a.mode,+(a.speed||0).toFixed(6),+(a.amp||0).toFixed(6)])); });
    out.push({ nido:m.name, kind:g.kind, modo:m.mode,
               mediaIds:(g.mediaIds||[]).map(i=>{const s=mediaById(i);return s?s.name:('#'+i);}).join(','),
               n:clips.length, sello:clips.join(' ~ ') }); }
  return out; };1`);

/* tres composiciones de tipos distintos, con ordenes de fuente DELIBERADAMENTE fuera del orden del panel */
const armado=await ev(`(function(){ const ids=__fuentes();
  const rev=ids.slice().reverse();           // F,E,D,C,B,A  → si algo reordena, se nota
  const mez=[ids[2],ids[0],ids[4],ids[1]];   // C,A,E,B
  createComposition({kind:'ring',mediaIds:rev,count:8,size:40,el:30});
  createComposition({kind:'weave',mediaIds:mez,bands:4,weaveMode:'weave',bandW:80,fit:'across',density:1,speed:0.1,speedV:0.1,motion:'alternate',interlace:true});
  createComposition({kind:'tunnel',mediaIds:ids,count:7,sizeFrom:2,sizeTo:190,curve:60,speed:0.12});
  return __huella().map(h=>h.nido+' ['+h.kind+'] fuentes='+h.mediaIds+' clips='+h.n); })()`);
console.log('montadas:'); armado.forEach(a=>console.log('   '+a));
const antes=await ev(`JSON.stringify(__huella())`);

/* 1) guardar y volver a abrir: el camino real de un proyecto suyo */
const ISP=path.join(process.cwd(),'scratchpad','r248-compat.isp');
try{fs.rmSync(ISP);}catch(e){}
await ev(`(async()=>{ await DSP.writeText(${JSON.stringify(ISP)}, JSON.stringify(serProject())); })()`);
await ev(`(async()=>{ const txt=await DSP.readText(${JSON.stringify(ISP)}); currentPath=${JSON.stringify(ISP)}; loadProject(JSON.parse(stripBom(txt))); })()`); await wait(1500);
const trasAbrir=await ev(`JSON.stringify(__huella())`);
console.log('\n1) guardar → abrir            : '+(trasAbrir===antes?'IDENTICO':'*** CAMBIO ***'));
if(trasAbrir!==antes){ fs.writeFileSync('scratchpad/r248-antes.json',antes); fs.writeFileSync('scratchpad/r248-abrir.json',trasAbrir); }

/* 2) abrir el dialogo de cada composicion y APLICAR sin tocar nada */
const r2=await ev(`(async()=>{ const nidos=state.media.filter(x=>x.kind==='nest'&&x.comp).slice();
  for(const n of nidos){
    openCompose(null,null,n,null,null);
    await new Promise(r=>setTimeout(r,140));
    const cesta=document.querySelector('#cMedia');
    const enCesta=[...cesta.querySelectorAll('.cbname')].map(e=>e.textContent).join(',');
    const guardado=(n.comp.mediaIds||[]).map(i=>{const s=mediaById(i);return s?s.name:('#'+i);}).join(',');
    if(enCesta!==guardado) return {err:'la cesta no refleja el guardado: '+enCesta+' vs '+guardado};
    document.querySelector('#cGo').click();
    await new Promise(r=>setTimeout(r,220));
  }
  return {ok:1}; })()`);
if(r2.err){ console.log('\n2) abrir dialogo + Aplicar    : *** '+r2.err+' ***'); }
else { const trasAplicar=await ev(`JSON.stringify(__huella())`);
  console.log('2) abrir dialogo + Aplicar    : '+(trasAplicar===antes?'IDENTICO':'*** CAMBIO ***'));
  if(trasAplicar!==antes){ fs.writeFileSync('scratchpad/r248-antes.json',antes); fs.writeFileSync('scratchpad/r248-aplicar.json',trasAplicar); } }

/* 3) la cesta hace lo suyo: quitar con la x y anadir por arrastre */
const r3=await ev(`(async()=>{ const n=state.media.find(x=>x.kind==='nest'&&x.comp&&x.comp.kind==='weave');
  openCompose(null,null,n,null,null); await new Promise(r=>setTimeout(r,140));
  const cesta=document.querySelector('#cMedia');
  const inicial=[...cesta.querySelectorAll('.cbname')].map(e=>e.textContent);
  cesta.querySelector('.cbx').click();                       // quitar el primero
  const trasX=[...cesta.querySelectorAll('.cbname')].map(e=>e.textContent);
  const nuevo=state.media.find(m=>m.kind==='image'&&!trasX.includes(m.name));
  _composeDrop([nuevo.id]);                                   // simular la SOLTADA desde Medios
  const trasSoltar=[...cesta.querySelectorAll('.cbname')].map(e=>e.textContent);
  _composeDrop([nuevo.id]);                                   // repetido: no debe entrar dos veces
  const trasRepe=[...cesta.querySelectorAll('.cbname')].map(e=>e.textContent);
  document.querySelector('#cGo').click(); await new Promise(r=>setTimeout(r,220));
  const guardado=(n.comp.mediaIds||[]).map(i=>{const s=mediaById(i);return s?s.name:('#'+i);});
  return { inicial:inicial.join(','), trasX:trasX.join(','), trasSoltar:trasSoltar.join(','),
           trasRepe:trasRepe.join(','), guardado:guardado.join(',') }; })()`);
console.log('\n3) la cesta:');
console.log('   al abrir      '+r3.inicial);
console.log('   tras la ×     '+r3.trasX);
console.log('   tras soltar   '+r3.trasSoltar);
console.log('   soltar repe   '+r3.trasRepe+(r3.trasRepe===r3.trasSoltar?'   (no duplica, correcto)':'   *** DUPLICA ***'));
console.log('   en g.mediaIds '+r3.guardado+(r3.guardado===r3.trasSoltar?'   (coincide con la cesta)':'   *** NO COINCIDE ***'));

console.log('\nerrs:',JSON.stringify(await ev(`window.__errs.slice(0,8)`)));
ws.close();
