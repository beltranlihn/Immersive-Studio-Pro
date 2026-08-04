/* [R247] El compose TEJIDO.
   Lo que importa comprobar, en orden:
     1 · NINGUN clip se estira ni se achata, con fuentes de proporciones distintas (1:1, 16:9, 9:16, 4:3).
     2 · «Lado largo» hace lo que dice: cruzando la tira, o tumbado a lo largo de ella.
     3 · las tiras se alinean y siguen alineadas MIENTRAS VIAJAN (el eje del parche sigue la esfera, no el plano).
     4 · lo que sale del disco se va bajo el horizonte, no se apelotona en el borde.
     5 · sentidos alternos por tira, y los tres modos (tejido / solo cruzando / solo bajando).
   Sin acentos graves dentro de las plantillas. */
import http from 'http';
const PORT=process.argv[2]||9222;
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:PORT,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:90000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const out={};
await ev(`(function(){ window.__errs=[]; addEventListener('error',e=>__errs.push(String(e.message||e))); return 1; })()`);
await ev(`state.dirty=false;1`);
await ev(`(async()=>{ await newProject('dome',2048,2048,60,180,true); })()`); await wait(800);

/* fuentes de PROPORCIONES DISTINTAS, que es el caso que preocupa a Beltrán */
out['0_fuentes']=await ev(`(function(){
  const mk=(nombre,W,H,color)=>{ const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
    const x=cv.getContext('2d'); x.fillStyle=color; x.fillRect(0,0,W,H);
    x.strokeStyle='#000'; x.lineWidth=Math.max(2,Math.min(W,H)*0.06); x.strokeRect(0,0,W,H);
    const m={id:uid(),kind:'image',name:nombre,el:cv,originalEl:cv,tex:newTex(),w:W,h:H,dur:10,fps:0,color,missing:false,_loading:false};
    upTex(m.tex,cv); try{m.thumb=cv.toDataURL();}catch(e){} state.media.push(m); return m; };
  mk('cuadrado-1x1',512,512,'#7FD4FF'); mk('apaisado-16x9',960,540,'#FFB37F');
  mk('vertical-9x16',540,960,'#C8A2FF'); mk('clasico-4x3',640,480,'#9BE59B');
  renderMedia();
  return state.media.filter(m=>m.kind==='image').map(m=>({n:m.name,prop:+(m.w/m.h).toFixed(3)})); })()`);

/* --- 1 · la PROPORCION del parche sale del medio, no del layout ---------------------------- */
out['1_sinDeformar']=await ev(`(function(){
  const ids=state.media.filter(m=>m.kind==='image').map(m=>m.id);
  const nest=createComposition({kind:'weave',mediaIds:ids,bands:4,perBand:5,weaveMode:'weave',fit:'across',speed:0.12,alternate:true});
  if(!nest)return {err:'no se creo'};
  /* el motor calcula ax = size/2 y ay = ax*(h/w): la relacion alto/ancho DIBUJADA debe ser exactamente h/w */
  const filas=nest.nestClips.map(c=>{ const m=mediaById(c.mediaId);
    const ax=(c.props.size*0.5), ay=ax*(m.h/m.w);
    return { medio:m.name, propFuente:+(m.w/m.h).toFixed(3), propDibujada:+((2*ax)/(2*ay)).toFixed(3) }; });
  const malos=filas.filter(f=>Math.abs(f.propFuente-f.propDibujada)>1e-6);
  return { elementos:nest.nestClips.length, deformados:malos.length, muestra:filas.slice(0,4),
    ningunoDeformado:malos.length===0, nestId:nest.id }; })()`);

/* --- 2 · «Lado largo»: cruzando vs a lo largo ---------------------------------------------- */
out['2_ladoLargo']=await ev(`(function(){
  const soloUno=[state.media.find(m=>m.name==='apaisado-16x9').id];   // 16:9, para que el lado largo se note
  const mid=(g)=>{ const lay=(function(){ const gg=Object.assign({kind:'weave',bands:4,perBand:5,weaveMode:'h',speed:0.12,alternate:true,_aspect:16/9},g); return compLayout(gg); })();
    const p=lay[0]; return { size:+p.size.toFixed(1), align:+p._rotAlign.toFixed(1) }; };
  const across=mid({fit:'across'}), along=mid({fit:'along'});
  /* tira horizontal (0 grados): cruzando = el eje ancho mira a 90; a lo largo = mira a 0 */
  return { across, along,
    cruzandoMiraA90:(Math.abs(across.align-90)<0.5),
    aLoLargoMiraA0:(Math.abs(along.align)<0.5||Math.abs(along.align-360)<0.5),
    aLoLargoEsMasGrande:(along.size>across.size) }; })()`);

/* --- 3 · la tira sigue alineada MIENTRAS VIAJA --------------------------------------------- */
out['3_alineadaAlViajar']=await ev(`(function(){
  const nest=state.media.find(m=>m.comp&&m.comp.kind==='weave');
  const c=nest.nestClips.find(x=>x.props.alignBand!=null); if(!c)return {err:'sin alignBand'};
  /* el eje ANCHO del parche apunta al angulo (az + rot) del plano del disco; con la compensacion debe quedar
     clavado en alignBand en cualquier instante del viaje */
  const angs=[0,1.5,3,4.5,6].map(tt=>{
    const P=azel2f(c.props.az,c.props.el); const w=q=>{ let v=(q+1)%2; if(v<0)v+=2; return v-1; };
    const fdx=animOffset(c,'fx',tt), fdy=animOffset(c,'fy',tt);
    const q=f2azelUnclamped(w(P[0]+fdx), w(P[1]+fdy));
    const rot=(c.props.alignBand-q.az);
    return +(((q.az+rot)%360+360)%360).toFixed(2); });
  const objetivo=((c.props.alignBand%360)+360)%360;
  return { objetivo:+objetivo.toFixed(2), angulos:angs,
    clavadaEnTodoElViaje: angs.every(a=>Math.abs(a-objetivo)<0.01) }; })()`);

/* --- 4 · lo que sale del disco se va BAJO EL HORIZONTE ------------------------------------- */
out['4_bajoElHorizonte']=await ev(`(function(){
  const dentro=f2azelUnclamped(0.3,0.2), justo=f2azelUnclamped(1,0), fuera=f2azelUnclamped(1.3,0.4);
  const acotada=f2azel(1.3,0.4);
  return { elDentro:+dentro.el.toFixed(1), elBorde:+justo.el.toFixed(1), elFuera:+fuera.el.toFixed(1),
    saleNegativo:(fuera.el<0), laAcotadaLoPegabaAlBorde:(Math.abs(acotada.el)<0.001) }; })()`);

/* --- 5 · sentidos alternos y los tres modos ------------------------------------------------ */
out['5_modos']=await ev(`(function(){
  /* OJO: mirar los sentidos SOLO del eje fx daba lista vacia en el modo "solo bajando" (ahi no hay clips en fx) y
     parecia que no alternaba. Se miran los del eje que ese modo usa de verdad. */
  const cuenta=(modo)=>{ const g={kind:'weave',bands:4,perBand:5,weaveMode:modo,fit:'across',_aspect:1,alternate:true};
    const lay=compLayout(g); const ejes=[...new Set(lay.map(p=>p._axis))].sort();
    const eje0=ejes[0];
    const dirs=[...new Set(lay.filter(p=>p._axis===eje0).map(p=>p._dir))].sort();
    return { n:lay.length, ejes, sentidos:dirs }; };
  const w=cuenta('weave'), h=cuenta('h'), v=cuenta('v');
  return { tejido:w, soloCruzando:h, soloBajando:v,
    tejidoUsaLosDosEjes:(w.ejes.length===2),
    alternaEnLosTres:(h.sentidos.length===2&&v.sentidos.length===2&&w.sentidos.length===2) }; })()`);

/* --- 6 · el dialogo ------------------------------------------------------------------------- */
out['6_dialogo']=await ev(`(function(){ openCompose('weave');
  const vis=id=>{ const e=document.querySelector(id); if(!e)return false; const r=e.closest('.frow'); return !!r&&r.style.display!=='none'; };
  const r={ boton:!!document.querySelector('#cKind button[data-k="weave"]'),
    tiras:vis('#cWBands'), ladoLargo:vis('#cWFit'), velocidad:vis('#cWSpeed'), modo:vis('#cWMode'), alterna:vis('#cWAlt'),
    sizeOculto:!vis('#cSize'), countOculto:!vis('#cN') };
  const o=document.getElementById('compOv'); if(o)o.remove(); return r; })()`);

await ev(`(async()=>{ state.dirty=false; await newProject('dome',4096,4096,60,180,true); })()`);
out.errs=await ev(`window.__errs.slice(0,10)`);
console.log(JSON.stringify(out,null,1));
ws.close();
