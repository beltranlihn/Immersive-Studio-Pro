/* R346b — ¿el tope `Math.min(L-ph, L-2*TOL_DECOD)` del espejo del ping-pong es un ARREGLO o una REGRESIÓN?
   Réplica EXACTA de las dos versiones de `srcT` (app.js ~1088) y de la regla de elección de fotograma
   (`keyForTime`, app.js 8140) + `instanteDecod` (app.js 1138). Nada de aproximaciones: el texto de las dos
   ramas está copiado literal del repo (3d37b65 = antes, a9bce14 = después). */

const TOL_DECOD = 2e-6;
function instanteDecod(t){ const x=+t; return (isFinite(x)?x:0)+TOL_DECOD; }

/* --- srcT ANTES (3d37b65:app.js:1075) — sólo cambia la línea del loopRev --- */
function srcT_old(c,t){ const raw=(t-c.start)*(c.speed||1);
  if(c.loop&&c.loopLen>0){ const L=c.loopLen; let k=Math.floor(raw/L), ph=raw-k*L;
    ph=Math.round(ph*1e9)/1e9;
    if(ph>=L-1e-9){ ph=0; k++; } else if(ph<0){ ph+=L; k--; }
    if(c.loopRev&&(k&1))ph=L-ph;
    return (c.inP||0)+ph; }
  return raw+(c.inP||0); }

/* --- srcT DESPUÉS (a9bce14:app.js:1097) --- */
function srcT_new(c,t){ const raw=(t-c.start)*(c.speed||1);
  if(c.loop&&c.loopLen>0){ const L=c.loopLen; let k=Math.floor(raw/L), ph=raw-k*L;
    ph=Math.round(ph*1e9)/1e9;
    if(ph>=L-1e-9){ ph=0; k++; } else if(ph<0){ ph+=L; k--; }
    if(c.loopRev&&(k&1))ph=Math.min(L-ph, L-2*TOL_DECOD);
    return (c.inP||0)+ph; }
  return raw+(c.inP||0); }

/* --- candidatas para "el arreglo correcto" --- */
// A) espejo por PASO DE FOTOGRAMA: ph = L - ph - fd   (requiere conocer fps de la fuente: srcT NO lo conoce)
function srcT_frameStep(c,t,fd){ const raw=(t-c.start)*(c.speed||1);
  if(c.loop&&c.loopLen>0){ const L=c.loopLen; let k=Math.floor(raw/L), ph=raw-k*L;
    ph=Math.round(ph*1e9)/1e9;
    if(ph>=L-1e-9){ ph=0; k++; } else if(ph<0){ ph+=L; k--; }
    if(c.loopRev&&(k&1))ph=Math.max(0, L-ph-fd);
    return (c.inP||0)+ph; }
  return raw+(c.inP||0); }

/* --- Elección de fotograma: keyForTime (app.js 8140) sobre pts EXACTOS en µs.
       tt = Math.floor(t_us); último i con ptsExact[i] <= tt; res arranca en 0 (=> clamp abajo);
       arriba se queda en el último (clamp). Devuelve el ÍNDICE (la identidad del fotograma). */
function makeFrames(fpsSrc, durSec){ const n=Math.round(durSec*fpsSrc); const p=[]; for(let i=0;i<n;i++)p.push(i*1e6/fpsSrc); return p; }
function keyIdx(ptsExact, tSec){
  const t0 = instanteDecod(tSec)*1e6;            // así entra en el decodificador (vinstSeek → setTarget/currentTime)
  const tt = Math.floor(Math.max(0,t0));
  let lo=0, hi=ptsExact.length-1, res=0;
  while(lo<=hi){ const mid=(lo+hi)>>1; if(ptsExact[mid]<=tt){ res=mid; lo=mid+1; } else hi=mid-1; }
  return res;
}

/* --- métricas --- */
function runs(seq){ // series de 2+ idénticos consecutivos
  const out=[]; let i=0;
  while(i<seq.length){ let j=i; while(j+1<seq.length && seq[j+1]===seq[i]) j++; const len=j-i+1; if(len>=2) out.push({frame:seq[i], at:i, len}); i=j+1; }
  return out;
}
function gaps(seq){ // saltos de >1 fotograma entre entregas consecutivas (fotogramas SALTADOS)
  let n=0; for(let i=1;i<seq.length;i++){ const d=Math.abs(seq[i]-seq[i-1]); if(d>1)n+=d-1; } return n;
}

function evaluate(cfg){
  const {fpsSrc, fpsOut, L, inP, mediaDur, start=0, speed=1, cycles=4} = cfg;
  const pts = makeFrames(fpsSrc, mediaDur);
  const c = {start, speed, loop:true, loopLen:L, loopRev:true, inP};
  const fd = 1/fpsSrc;
  const nOut = Math.round(cycles*L*fpsOut/speed);
  const rows=[];
  for(let i=0;i<=nOut;i++){
    const t = start + i/fpsOut;
    rows.push({ i, t,
      o: srcT_old(c,t), n: srcT_new(c,t), f: srcT_frameStep(c,t,fd) });
  }
  const mk = (key)=>rows.map(r=>keyIdx(pts, r[key]));
  const so=mk('o'), sn=mk('n'), sf=mk('f');
  // ventana [inP, inP+L): fotogramas cuyo intervalo de presentación toca la ventana
  const inWin=(idx)=>{ const a=pts[idx], b=(idx+1<pts.length)?pts[idx+1]:Infinity; return b>inP*1e6+1e-6 && a < (inP+L)*1e6-1e-6; };
  const outOf=(s)=>s.filter(x=>!inWin(x)).length;
  const outTime=(key)=>rows.filter(r=>{ const v=r[key]; return v < inP-1e-12 || v >= inP+L-1e-12; }).length;
  return { rows, so, sn, sf, pts,
    stats:{
      old:{ outWinFrames:outOf(so), outWinTime:outTime('o'), holds:runs(so), skipped:gaps(so), distinct:new Set(so).size },
      neu:{ outWinFrames:outOf(sn), outWinTime:outTime('n'), holds:runs(sn), skipped:gaps(sn), distinct:new Set(sn).size },
      fst:{ outWinFrames:outOf(sf), outWinTime:outTime('f'), holds:runs(sf), skipped:gaps(sf), distinct:new Set(sf).size },
    } };
}

const CFGS = [
  { name:'A  24fps src · 24fps out · L=1.0s (múltiplo exacto) · inP=0 · media 3s', fpsSrc:24, fpsOut:24, L:1.0, inP:0, mediaDur:3 },
  { name:'B  24fps src · 24fps out · L=1.0s · inP=2.0s (a fotograma) · media 6s',  fpsSrc:24, fpsOut:24, L:1.0, inP:2.0, mediaDur:6 },
  { name:'C  24fps src · 24fps out · L=10/24s (múltiplo de 1/fps, no entero)',     fpsSrc:24, fpsOut:24, L:10/24, inP:0, mediaDur:3 },
  { name:'D  24fps src · 24fps out · L=0.4s (NO múltiplo de 1/24)',                fpsSrc:24, fpsOut:24, L:0.4, inP:0, mediaDur:3 },
  { name:'E  30fps src · 30fps out · L=1.0s · inP=0 · media 3s',                   fpsSrc:30, fpsOut:30, L:1.0, inP:0, mediaDur:3 },
  { name:'F  30fps src · 24fps out · L=1.0s · inP=0 (cadencias distintas)',        fpsSrc:30, fpsOut:24, L:1.0, inP:0, mediaDur:3 },
  { name:'G  24fps src · 30fps out · L=1.0s · inP=0 (cadencias distintas)',        fpsSrc:24, fpsOut:30, L:1.0, inP:0, mediaDur:3 },
  { name:'H  24fps src · 24fps out · L=1.0s · inP=2.0104s (NO a fotograma)',       fpsSrc:24, fpsOut:24, L:1.0, inP:2.0104, mediaDur:6 },
  { name:'I  24fps src · 24fps out · L=1.0s · inP=0 · media = 1.0s (bucle = clip entero)', fpsSrc:24, fpsOut:24, L:1.0, inP:0, mediaDur:1.0 },
  { name:'J  24fps src · 24fps out · L=0.5s · inP=0 · media 3s',                   fpsSrc:24, fpsOut:24, L:0.5, inP:0, mediaDur:3 },
  { name:'K  25fps src · 25fps out · L=2.0s · inP=1.0s · media 8s',                fpsSrc:25, fpsOut:25, L:2.0, inP:1.0, mediaDur:8 },
];

const pad=(s,n)=>String(s).padEnd(n);
const padl=(s,n)=>String(s).padStart(n);

console.log('='.repeat(112));
console.log('TABLA 1 — recuento sobre 4 ciclos completos de ping-pong (ida+vuelta), por configuración');
console.log('  fuera = fotogramas entregados FUERA de la ventana [inP, inP+loopLen)');
console.log('  hold  = fotogramas de más por congelación (suma de (len-1) de cada serie repetida) / serie más larga');
console.log('  salt. = fotogramas SALTADOS (huecos >1 entre entregas consecutivas)');
console.log('='.repeat(112));
console.log(pad('config',66)+padl('fuera',7)+padl('hold',10)+padl('salt.',7)+'   |'+padl('fuera',7)+padl('hold',10)+padl('salt.',7));
console.log(pad('',66)+padl('ANTES',7)+padl('ANTES',10)+padl('ANTES',7)+'   |'+padl('DESPUES',7)+padl('DESPUES',10)+padl('DESPUES',7));
console.log('-'.repeat(112));
const all=[];
for(const cfg of CFGS){
  const r = evaluate(cfg); all.push({cfg,r});
  const h=(s)=>{ const tot=s.holds.reduce((a,x)=>a+x.len-1,0); const mx=s.holds.reduce((a,x)=>Math.max(a,x.len),0); return tot+'/'+mx; };
  console.log(pad(cfg.name,66)
    +padl(r.stats.old.outWinFrames,7)+padl(h(r.stats.old),10)+padl(r.stats.old.skipped,7)+'   |'
    +padl(r.stats.neu.outWinFrames,7)+padl(h(r.stats.neu),10)+padl(r.stats.neu.skipped,7));
}

console.log('\n'+'='.repeat(112));
console.log('TABLA 2 — la SECUENCIA de fotogramas entregados alrededor del giro (índice de fotograma de la fuente)');
console.log('='.repeat(112));
for(const {cfg,r} of all){
  // localizar el primer giro: donde srcT_old da el ph máximo (k pasa de par a impar)
  let turn=-1; for(let i=1;i<r.rows.length;i++){ const kOld=Math.floor(((r.rows[i].t-(cfg.start||0))*(cfg.speed||1))/cfg.L); const kPrev=Math.floor(((r.rows[i-1].t-(cfg.start||0))*(cfg.speed||1))/cfg.L); if(kOld!==kPrev && (kOld&1)){ turn=i; break; } }
  if(turn<0) turn=Math.round(cfg.L*cfg.fpsOut);
  const a=Math.max(0,turn-4), b=Math.min(r.so.length-1,turn+4);
  const w=(s)=>s.slice(a,b+1).map((x,j)=>{ const abs=a+j; return (abs===turn?'['+x+']':''+x); }).join(', ');
  console.log('\n'+cfg.name);
  console.log('   salidas i='+a+'..'+b+'   ([] = primera salida del ciclo INVERSO)');
  console.log('   ANTES   : '+w(r.so));
  console.log('   DESPUES : '+w(r.sn));
  console.log('   fdstep  : '+w(r.sf));
  const tOld=r.rows.slice(a,b+1).map(x=>x.o.toFixed(6)).join(' ');
  const tNew=r.rows.slice(a,b+1).map(x=>x.n.toFixed(6)).join(' ');
  console.log('   t_src ANTES  : '+tOld);
  console.log('   t_src DESPUES: '+tNew);
}

console.log('\n'+'='.repeat(112));
console.log('TABLA 3 — periodo completo (config A), los 4 ciclos seguidos');
console.log('='.repeat(112));
{
  const {r}=all[0];
  console.log('ANTES  : '+r.so.join(','));
  console.log('DESPUES: '+r.sn.join(','));
  console.log('fdstep : '+r.sf.join(','));
}

console.log('\n'+'='.repeat(112));
console.log('TABLA 4 — la tercera opción: espejo por PASO DE FOTOGRAMA (necesita fps de la fuente)');
console.log('='.repeat(112));
console.log(pad('config',66)+padl('fuera',7)+padl('hold',10)+padl('salt.',7));
for(const {cfg,r} of all){
  const s=r.stats.fst; const tot=s.holds.reduce((a,x)=>a+x.len-1,0); const mx=s.holds.reduce((a,x)=>Math.max(a,x.len),0);
  console.log(pad(cfg.name,66)+padl(s.outWinFrames,7)+padl(tot+'/'+mx,10)+padl(s.skipped,7));
}
