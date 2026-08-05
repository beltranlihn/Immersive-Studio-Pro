/* [R259] El arreglo de R256, sobre el PROYECTO REAL de Beltran (copia): 44 clips, 32 en bucle, nidos anidados,
   60 fps. Se exporta DOS veces el mismo tramo —uno que CRUZA la vuelta de varios bucles— y se compara por
   PIXELES, no por hash (dos pasadas identicas difieren en un pixel de 1/255 por redondeo de la GPU).
   Lo que se busca: que ningun medio se rinda (_cdFail) y que las dos pasadas sean la misma imagen. */
import http from 'http'; import fs from 'fs'; import path from 'path'; import cp from 'child_process';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
/* Abrir un proyecto NAVEGA la pagina, asi que la conexion CDP se cae: hay que saber reconectar. */
let ws=null, id=0; const p=new Map();
async function conectar(){
  for(let intento=0;intento<20;intento++){
    try{
      const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
      const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
      if(page){ const w=new WebSocket(page.webSocketDebuggerUrl); await new Promise((r,j)=>{w.onopen=r;w.onerror=j;});
        p.clear(); w.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}}; ws=w; return; }
    }catch(e){}
    await wait(700);
  }
  throw new Error('no se pudo conectar');
}
await conectar();
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
/* Si la pagina navego (abrir proyecto), se reconecta y se reintenta UNA vez. */
const ev=async(x,rein=true)=>{
  let r; try{ r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:1800000}); }
  catch(e){ if(rein && /navigated or closed|not found/i.test(String(e.message))){ await wait(2500); await conectar(); await wait(2500); return ev(x,false); } throw e; }
  if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);
  return r.result.value; };
const ISP=String.raw`C:\Users\beltr\Desktop\Alma Digital Studio\Projects\Immersive Studio Pro\scratchpad\aud8b-rito-copia.isp`.replace(/\\/g,'\\\\');
console.log('GPU: '+await ev(`(function(){const d=gl.getExtension('WEBGL_debug_renderer_info'); return d?gl.getParameter(d.UNMASKED_RENDERER_WEBGL):'?';})()`));

await ev(`(async function(){ state.dirty=false; await openProjectPath('${ISP}',true); return 1; })()`);
await wait(7000);
const abrir=await ev(`(function(){ return { medios:state.media.length, fps:state.fps,
  faltan:state.media.filter(m=>m.missing).map(m=>m.name),
  nidos:state.media.filter(m=>m.kind==='nest').map(m=>({id:m.id,n:m.name,bucles:(m.nestClips||[]).filter(c=>c.loop).length})) }; })()`);
console.log('proyecto: '+abrir.medios+' medios · '+abrir.fps+' fps · faltan '+(abrir.faltan.length?abrir.faltan.join(', '):'ninguno'));
console.log('nidos: '+abrir.nidos.map(n=>n.n+'('+n.bucles+')').join(' · '));

/* Se entra al nido con mas bucles y se busca un tramo que CRUCE una vuelta. */
const objetivo=abrir.nidos.filter(n=>n.bucles>0).sort((a,b)=>b.bucles-a.bucles)[0];
const prep=await ev(`(async function(){ const N=state.media.find(m=>m.id===${JSON.stringify(objetivo.id)});
  openSeq(N.id); await new Promise(r=>setTimeout(r,900));
  const L=state.clips.filter(c=>c.loop&&c.loopLen>0);
  const vueltas=L.map(c=>({n:(mediaById(c.mediaId)||{}).name, start:c.start, loopLen:+c.loopLen.toFixed(3),
     primera:+(c.start+c.loopLen/(c.speed||1)).toFixed(3)})).sort((a,b)=>a.primera-b.primera);
  return { seq:N.name, clips:state.clips.length, bucles:L.length, vueltas:vueltas.slice(0,6) }; })()`);
console.log('\nsecuencia "'+prep.seq+'": '+prep.clips+' clips, '+prep.bucles+' en bucle');
console.log('primeras vueltas en: '+prep.vueltas.map(v=>v.primera+'s').join(', '));
const T0=Math.max(0, prep.vueltas[0].primera-0.4);   // el tramo abraza la vuelta mas temprana
const FPS=30, N=48, SEGS=N/FPS;
console.log('tramo exportado: '+T0.toFixed(3)+' -> '+(T0+SEGS).toFixed(3)+' s  ('+N+' fotogramas a '+FPS+' fps)');

async function pasada(i){
  const DIR=path.join(process.cwd(),'scratchpad','r259-p'+i);
  fs.rmSync(DIR,{recursive:true,force:true}); fs.mkdirSync(DIR,{recursive:true});
  const t0=Date.now();
  const r=await ev(`(async function(){ const ui=ripProgress('R259','pasada ${i}',1);
    try{ await runExport({codec:'png',res:512,fps:${FPS},range:'clips',rangeT:[${T0},${T0+SEGS}],
                          outW:512,outH:512,outDir:${JSON.stringify(DIR)},silent:true,noAudio:true,job:ui.job}); }
    finally{ ui.close(); }
    return { rendidos:state.media.filter(m=>m._cdFail).map(m=>m.name) }; })()`);
  const ms=Date.now()-t0;
  const lst=(d)=>{ const o=[]; for(const e of fs.readdirSync(d,{withFileTypes:true})){ const q=d+'/'+e.name;
    if(e.isDirectory())o.push(...lst(q)); else if(/\.png$/i.test(e.name))o.push(q); } return o.sort(); };
  const f=lst(DIR);
  console.log('  pasada '+i+': '+f.length+' PNG en '+(ms/1000).toFixed(1)+' s ('+Math.round(ms/Math.max(1,f.length))+' ms/f)'
    +'   se rindieron: '+(r.rendidos.length?r.rendidos.join(', '):'ninguno'));
  return f;
}
console.log('');
const A=await pasada(1), B=await pasada(2);
function psnr(a,b){ const r=cp.spawnSync('ffmpeg',['-hide_banner','-i',a,'-i',b,'-lavfi','psnr','-f','null','-'],{encoding:'utf8'});
  const m=/average:([0-9.]+|inf)/.exec(String(r.stderr||'')); if(!m)throw new Error('sin PSNR'); return m[1]==='inf'?Infinity:+m[1]; }
let malos=0, peor=Infinity, peorN='', ident=0;
for(let i=0;i<Math.min(A.length,B.length);i++){ const v=psnr(A[i],B[i]);
  if(v===Infinity){ident++;continue;} if(v<peor){peor=v;peorN=path.basename(A[i]);} if(v<90){malos++; if(malos<=5)console.log('   *** '+path.basename(A[i])+'  '+v.toFixed(2)+' dB');} }
console.log('\npasada 1 vs 2: '+Math.min(A.length,B.length)+' fotogramas · '+ident+' identicos bit a bit · '
  +(malos?malos+' POR DEBAJO DE 90 dB  *** MAL ***':'ninguno por debajo de 90 dB  OK')
  +(peor===Infinity?'':'  · el peor: '+peorN+' '+peor.toFixed(2)+' dB'));
ws.close();
