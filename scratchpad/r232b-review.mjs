/* [R232b] Los hallazgos de las dos revisiones del diff de R232. */
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
await ev(`(function(){ _lch.ptype='room'; renderLauncher(); return 1; })()`); await wait(500);

/* ---------- 1 · cambiar la cuenta de muros deja el orden = recorrido físico ---------- */
out.f1_cuenta = await ev(`(function(){ const tira=()=>lchCfgWalls().map(w=>w.role);
  lchSetWallCount(4); const c4a=tira();
  lchSetWallCount(3); const c3=tira();
  lchSetWallCount(2); const c2=tira();
  lchSetWallCount(4); const c4b=tira();
  const perm=n=>JSON.stringify(lchActiveWalls().map(w=>w.ord).sort((a,b)=>a-b))===JSON.stringify([...Array(n)].map((_,i)=>i+1));
  return { cuatro:c4a, tres:c3, dos:c2, vueltaACuatro:c4b,
    vuelveAlCanonico:JSON.stringify(c4b)===JSON.stringify(['Front','Right','Back','Left']),
    permutacionOk:perm(4) }; })()`);

/* ---------- 2 · pulsar la cuenta YA activa no toca nada ---------- */
out.f2_noop = await ev(`(function(){ lchSetWallCount(4); lchSetOrder(0,3);      // orden a mano
  const antes=lchActiveWalls().map(w=>w.role+':'+w.ord);
  lchSetWallCount(4);                                                            // la misma cuenta otra vez
  const despues=lchActiveWalls().map(w=>w.role+':'+w.ord);
  return { antes, despues, respetado:JSON.stringify(antes)===JSON.stringify(despues) }; })()`);

/* ---------- 5 · confirmar el MISMO orden repinta el campo ---------- */
out.f5_repinta = await ev(`(function(){ lchSetWallCount(4); renderLauncher(); return 1; })()`);
await wait(400);
out.f5 = await ev(`(function(){ const inp=document.querySelector('.lch-wrow input[data-lk$="ord"]');
  const valReal=lchActiveWalls()[0].ord;
  inp.focus(); inp.value='0'+valReal;                       // «01»: mismo número, tecleado en crudo
  inp.dispatchEvent(new Event('input',{bubbles:true}));
  inp.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  const tras=document.querySelector('.lch-wrow input[data-lk$="ord"]').value;
  return { valReal, enElCampo:tras, limpiado:(String(tras)===String(valReal)) }; })()`);

/* ---------- 6 · las flechas mueven UN puesto, no diez ---------- */
out.f6_flechas = await ev(`(function(){ lchSetWallCount(4); renderLauncher(); return 1; })()`);
await wait(400);
out.f6 = await ev(`(function(){ const fila0=()=>document.querySelector('.lch-wrow input[data-lk$="ord"]');
  const ordAntes=lchActiveWalls()[0].ord;                    // el paso se mide RELATIVO: la fila puede venir en cualquier puesto
  const antes=lchActiveWalls().map(w=>w.role+':'+w.ord);
  const inp=fila0(); inp.focus();
  inp.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true}));
  const despues=lchActiveWalls().map(w=>w.role+':'+w.ord);
  const ordDespues=lchActiveWalls()[0].ord;
  const ords=lchActiveWalls().map(w=>w.ord).sort((a,b)=>a-b);
  return { antes, despues, ordAntes, ordDespues, subioUnPuesto:(ordDespues===ordAntes+1),
    permutacionOk:JSON.stringify(ords)===JSON.stringify([1,2,3,4]) }; })()`);

/* ---------- 3 · la fila del piso alineada con las de muro ---------- */
out.f3_piso = await ev(`(function(){ _lch.roomFloor=true; renderLauncher(); return 1; })()`);
await wait(450);
out.f3 = await ev(`(function(){ const filas=[...document.querySelectorAll('.lch-wrow')];
  const conIx=filas.find(f=>f.querySelector('.ix')), muro=filas.find(f=>f.querySelector('input[data-lk$="ord"]'));
  if(!conIx||!muro)return {sinFilaDePiso:!conIx};
  const x=e=>+e.getBoundingClientRect().left.toFixed(1);
  const primerCampo=f=>x(f.querySelectorAll('input,.lch-facing,.ix')[1]||f.children[1]);
  return { anchoIx:+conIx.querySelector('.ix').getBoundingClientRect().width.toFixed(1),
    anchoOrd:+muro.querySelector('input[data-lk$="ord"]').getBoundingClientRect().width.toFixed(1),
    segundaColumnaPiso:primerCampo(conIx), segundaColumnaMuro:primerCampo(muro),
    alineadas:Math.abs(primerCampo(conIx)-primerCampo(muro))<1.5 }; })()`);

/* ---------- 4 · el diálogo: el campo de orden no pierde el foco ---------- */
out.f4_dialogo = await ev(`(function(){ const sala={walls:['Front','Right','Back','Left'].map((r,i)=>({role:r,order:i+1,wcm:600,hcm:350,pxW:1920,pxH:1080})),floor:null};
  roomSetupDialog(()=>{},sala); return 1; })()`);
await wait(500);
out.f4 = await ev(`(function(){ const host=document.querySelector('#rsWalls');
  const inp=host.children[0].querySelector('[data-k=order]');
  inp.focus(); inp.value='3'; inp.dispatchEvent(new Event('change',{bubbles:true}));
  const act=document.activeElement;
  const ordenes=[...host.children].map(f=>f.querySelector('[data-k=order]').value);
  const roles=[...host.children].map(f=>f.querySelector('.rs-role').textContent.trim());
  const r={ conservaFoco:!!(act&&act.dataset&&act.dataset.k==='order'),
    focoEnLaMismaFila:(act===host.children[0].querySelector('[data-k=order]')),
    ordenes, roles, permutacion:JSON.stringify(ordenes.map(Number).sort())===JSON.stringify([1,2,3,4]) };
  /* y pulsar la cuenta ya activa no debe reescribir nada */
  const antes=[...host.children].map(f=>f.querySelector('[data-k=order]').value);
  const b=document.querySelector('#rsN button.on'); if(b)b.click();
  r.trasPulsarCuentaActiva=[...document.querySelectorAll('#rsWalls .rs-wall')].map(f=>f.querySelector('[data-k=order]').value);
  r.cuentaActivaRespeta=JSON.stringify(antes)===JSON.stringify(r.trasPulsarCuentaActiva);
  const ov=[...document.querySelectorAll('.overlay')].pop(); if(ov)ov.remove();
  return r; })()`);

out.errs = await ev(`window.__errs.slice(0,15)`);
console.log(JSON.stringify(out,null,1));
ws.close();
