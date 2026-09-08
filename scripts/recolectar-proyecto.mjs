#!/usr/bin/env node
/* [R360] Recolector OFFLINE de proyectos .isp → carpeta de proyecto autocontenida (estilo Ableton/Unreal).
   Uso:  node scripts/recolectar-proyecto.mjs "<origen.isp>" "<carpetaDestino>" [--solo-usados]

   Produce:  <carpetaDestino>/<Nombre>.isp  (managed:true, rutas absolutas nuevas + rel/relFrames/ncRel)
             <carpetaDestino>/Media/<bins del panel>/…   (espejo de la organizacion del panel de Medios)
             <carpetaDestino>/Media/_LUTs/…              (LUTs .cube referenciadas por clips)
             <carpetaDestino>/Proxies/…                  (proxies de medio px_<hash>_960.mp4 + proxies de composicion)
             <carpetaDestino>/INFORME-RECOLECCION.txt

   Con --solo-usados, los medios (video/imagen/audio/secuencia-de-imagenes) que NINGUNA secuencia referencia
   quedan FUERA del proyecto nuevo (se listan en el informe). Las secuencias (kind 'nest') se conservan todas.

   Regla "no perder material": el original NO se toca jamas (solo lecturas); cada copia se verifica por tamano;
   una copia fallida deja la referencia apuntando al original (ruta absoluta vieja) y se anota en el informe.

   El hash del proxy replica proxyHash de app.js (djb2 base36) con clave nombre|tamano (proxyProjPath [R360]). */
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

const PMAX=960;
function proxyHash(s){ let h=5381; for(let i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))>>>0; return h.toString(36); }
function fsSafeName(s){ return String(s||'').replace(/[\\/:*?"<>|]/g,'_').replace(/\s+$/,'').slice(0,120)||'_'; }
/* replica de subSecuencia de app.js [R361]: misma formula ⇒ el primer Collect en la app no tiene que mudar nada */
function subSecuencia(n){ return fsSafeName(String(n||'seq').replace(/\s*\[\d+f\]\s*$/i,'').replace(/#+/g,'').replace(/\.[a-z0-9]{2,4}\s*$/i,'').replace(/[.\s_-]+$/,'').trim())||'seq'; }
const norm=p=>String(p||'').replace(/\\/g,'/'); // rutas escritas en Windows dentro de un .isp que ahora vive en mac
const base=p=>norm(p).split('/').pop();

const [,,srcIsp,destRootArg,...flags]=process.argv;
if(!srcIsp||!destRootArg){ console.error('Uso: node recolectar-proyecto.mjs "<origen.isp>" "<carpetaDestino>" [--solo-usados]'); process.exit(1); }
const destRoot=path.resolve(destRootArg); // sin barra final: los `rel` se cortan con destRoot.length+1 y una barra de mas se comia el primer caracter
const soloUsados=flags.includes('--solo-usados');

const txt=fs.readFileSync(srcIsp,'utf8');
const o=JSON.parse(txt.charCodeAt(0)===0xFEFF?txt.slice(1):txt);
const stem=path.basename(srcIsp).replace(/\.isp$/i,'');
const mediaDir=path.join(destRoot,'Media'), proxDir=path.join(destRoot,'Proxies');
fs.mkdirSync(mediaDir,{recursive:true}); fs.mkdirSync(proxDir,{recursive:true});

const informe=[]; const log=s=>{ informe.push(s); console.log(s); };
log('Recoleccion de "'+srcIsp+'"');
log('Destino: '+destRoot+(soloUsados?'  (solo medios usados en secuencias)':''));
log('Fecha: '+new Date().toISOString()); log('');

// ---- 1) que se usa ----
const media=o.media||[];
const usados=new Set();
for(const n of media)if(n.kind==='nest'){ usados.add(n.id); for(const c of (n.nestClips||[]))usados.add(c.mediaId); }
for(const c of (o.clips||[]))usados.add(c.mediaId);
const conserva=m=>!soloUsados||m.kind==='nest'||usados.has(m.id);
const fuera=media.filter(m=>!conserva(m));
const dentro=media.filter(conserva);

// ---- 2) copiar con verificacion ----
let bytes=0,copiados=0,reusados=0; const fallos=[];
const porSrc=new Map();   // origen (normalizado, lower) -> destino ya copiado
const tomados=new Set();  // destinos reclamados (lower) — homonimos distintos no se pisan
async function copia(src,dirDst,nombre){ // -> ruta destino o null
  src=norm(src); const key=src.toLowerCase();
  if(porSrc.has(key))return porSrc.get(key);
  let st=null; try{ st=await fsp.stat(src); }catch(e){}
  if(!st){ fallos.push(src+'  (origen ausente)'); return null; }
  const b=nombre||base(src), st2=b.replace(/\.[^.]+$/,''), ext=(b.match(/\.[^.]+$/)||[''])[0];
  for(let k=1;k<=999;k++){ const dst=path.join(dirDst,(k===1)?b:(st2+'-'+k+ext)), dk=dst.toLowerCase();
    if(tomados.has(dk))continue;
    let ex=null; try{ ex=await fsp.stat(dst); }catch(e){}
    if(ex&&ex.size!==st.size)continue;               // ocupado por un archivo distinto → sufijo
    tomados.add(dk);
    if(!ex){ await fsp.mkdir(path.dirname(dst),{recursive:true});
      await fsp.copyFile(src,dst);
      const v=await fsp.stat(dst);
      if(v.size!==st.size){ await fsp.unlink(dst).catch(()=>{}); fallos.push(src+'  (copia no verificada)'); tomados.delete(dk); return null; }
      copiados++; bytes+=st.size; }
    else reusados++;                                  // ya recolectado antes (mismo nombre y tamano)
    porSrc.set(key,dst); return dst; }
  fallos.push(src+'  (sin destino libre)'); return null; }
const dirDeBin=bin=>bin?path.join(mediaDir,...String(bin).split('/').map(fsSafeName)):mediaDir;

let hechos=0; const total=dentro.filter(m=>m.path||m.framePaths||(m.kind==='nest'&&m.ncPath)).length;
for(const m of dentro){
  if(m.kind==='sequence'&&m.framePaths&&m.framePaths.length){
    const dir=path.join(dirDeBin(m.folder),subSecuencia(m.name));
    const nf=[]; for(const fp of m.framePaths)nf.push((await copia(fp,dir))||fp);
    m.framePaths=nf; m.relFrames=nf.map(p2=>p2.startsWith(destRoot+path.sep)?p2.slice(destRoot.length+1).split(path.sep).join('/'):null);
  }
  else if((m.kind==='video'||m.kind==='image'||m.kind==='audio')&&m.path){
    const src=norm(m.path); let sz=0; try{ sz=(await fsp.stat(src)).size; }catch(e){}
    const dst=await copia(src,dirDeBin(m.folder));
    if(dst){ m.path=dst; m.fsize=sz||m.fsize; m.rel=dst.slice(destRoot.length+1).split(path.sep).join('/');
      if(m.kind==='video'){ // proxy hermano ya generado → Proxies/ con el nombre-hash de la identidad nueva
        const d=path.dirname(src), s0=base(src).replace(/\.[^.]+$/,'');
        let cands=[]; try{ cands=(await fsp.readdir(d)).filter(n=>n.toLowerCase().startsWith(s0.toLowerCase()+'.dsp-proxy-')&&n.toLowerCase().endsWith('.mp4')); }catch(e){}
        if(cands.length){ if(cands.length>1){ const conFecha=[]; for(const n of cands){ let t=0; try{ t=(await fsp.stat(path.join(d,n))).mtimeMs; }catch(e){} conFecha.push([t,n]); } conFecha.sort((a,b)=>b[0]-a[0]); cands=conFecha.map(x=>x[1]); } // el mas reciente: la app valida duracion al enganchar y tira los rancios
          const pxName='px_'+proxyHash(base(dst).toLowerCase()+'|'+(m.fsize||0))+'_'+PMAX+'.mp4';
          await copia(path.join(d,cands[0]),proxDir,pxName); } } }
    else { m.rel=null; }
  }
  else if(m.kind==='nest'&&m.ncPath){
    const dst=await copia(m.ncPath,proxDir);
    if(dst){ m.ncPath=dst; m.ncRel=dst.slice(destRoot.length+1).split(path.sep).join('/'); }
    else { log('  proxy de composicion no copiado (se regenera en la app): '+base(m.ncPath)); m.ncPath=null; m.ncSig=null; m.ncRel=null; }
  }
  if(m.path||m.framePaths||m.ncPath){ if(++hechos%50===0)console.log('  … '+hechos+' / '+total); }
}

// ---- 3) LUTs de los clips ----
const lutMap=new Map();
const scanL=cs=>{ for(const c of (cs||[]))if(c&&c.props&&c.props.lut)lutMap.set(norm(c.props.lut),null); };
scanL(o.clips); for(const m of dentro)if(m.kind==='nest')scanL(m.nestClips);
for(const src of lutMap.keys())lutMap.set(src,await copia(src,path.join(mediaDir,'_LUTs')));
const reL=cs=>{ for(const c of (cs||[]))if(c&&c.props&&c.props.lut){ const nd=lutMap.get(norm(c.props.lut)); if(nd)c.props.lut=nd; } };
reL(o.clips); for(const m of dentro)if(m.kind==='nest')reL(m.nestClips);

// ---- 4) recomponer el proyecto ----
o.media=dentro; o.managed=true;
if(soloUsados){ // bins que quedan con contenido (y sus ancestros); los vaciados se van con sus medios
  const vivos=new Set(); for(const m of dentro)if(m.folder){ const seg=String(m.folder).split('/'); for(let i=1;i<=seg.length;i++)vivos.add(seg.slice(0,i).join('/')); }
  o.folders=(o.folders||[]).filter(f=>vivos.has(f));
  if(o.folderColors)for(const k of Object.keys(o.folderColors))if(!vivos.has(k))delete o.folderColors[k];
}
const outIsp=path.join(destRoot,stem+'.isp');
fs.writeFileSync(outIsp,JSON.stringify(o));

// ---- 5) informe ----
log(''); log('== RESULTADO ==');
log('Medios conservados: '+dentro.length+' de '+media.length+(soloUsados?('  ·  excluidos por no usarse: '+fuera.length):''));
log('Archivos copiados: '+copiados+'  ('+(bytes/1e9).toFixed(2)+' GB)  ·  reutilizados (ya dentro): '+reusados);
log('Fallos de copia: '+fallos.length);
for(const f of fallos)log('   FALLO  '+f);
if(soloUsados&&fuera.length){ log(''); log('== EXCLUIDOS (no aparecen en ninguna secuencia; sus archivos ORIGINALES no se tocaron) ==');
  for(const m of fuera)log('   '+(m.kind||'?').padEnd(6)+' '+(m.name||'')+'   ['+(m.folder||'raiz')+']   '+(m.path||'')); }
log(''); log('Proyecto nuevo: '+outIsp);
fs.writeFileSync(path.join(destRoot,'INFORME-RECOLECCION.txt'),informe.join('\n')+'\n');
if(fallos.length)process.exitCode=2;
