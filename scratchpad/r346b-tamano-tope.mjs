/* R346b — ¿de qué TAMAÑO tiene que ser el tope para no crear la meseta?
   El espejo `ph → L-ph` es simétrico respecto de t=L: la muestra i-1 antes del vértice y la i+1 después caen
   en el MISMO tiempo de origen por construcción. Lo único que las separaba era que el vértice cayera en un
   fotograma distinto. Luego cualquier tope MENOR que un fotograma garantiza tres iguales seguidos.
   Aquí se barre el tope de 0 a 2 fotogramas y se mide. */
const TOL_DECOD=2e-6; const inst=t=>t+TOL_DECOD;
function srcT(c,t,tope){ const raw=(t-c.start)*(c.speed||1); const L=c.loopLen; let k=Math.floor(raw/L), ph=raw-k*L;
  ph=Math.round(ph*1e9)/1e9; if(ph>=L-1e-9){ph=0;k++;} else if(ph<0){ph+=L;k--;}
  if(c.loopRev&&(k&1))ph=Math.min(L-ph, L-tope); return (c.inP||0)+ph; }
function keyIdx(pts,s){ const tt=Math.floor(Math.max(0,inst(s)*1e6)); let lo=0,hi=pts.length-1,res=0;
  while(lo<=hi){const m=(lo+hi)>>1; if(pts[m]<=tt){res=m;lo=m+1;} else hi=m-1;} return res; }

const fpsSrc=24, fpsOut=24, L=1.0, inP=0, mediaDur=3, fd=1/fpsSrc;
const pts=[]; for(let i=0;i<Math.round(mediaDur*fpsSrc);i++)pts.push(i*1e6/fpsSrc);
const c={start:0,speed:1,loop:true,loopLen:L,loopRev:true,inP};
const TOPES=[
  ['0 (el original, ph=L-ph)',0],
  ['2*TOL_DECOD = 4 µs  ← LO QUE SE DESPLEGÓ',2*TOL_DECOD],
  ['1 ms',1e-3],
  ['10 ms',1e-2],
  ['medio fotograma (20,83 ms)',fd/2],
  ['un fotograma menos 1 µs',fd-1e-6],
  ['UN FOTOGRAMA (41,667 ms)',fd],
  ['un fotograma + 1 µs',fd+1e-6],
  ['dos fotogramas',2*fd],
];
console.log('24 fps fuente · 24 fps salida · L=1,0 s · inP=0 — secuencia alrededor del vértice (i=20..28)\n');
console.log('tope'.padEnd(34)+'secuencia entregada'.padEnd(44)+'serie máx   fuera de ventana');
console.log('-'.repeat(104));
for(const [nombre,tope] of TOPES){
  const seq=[]; for(let i=20;i<=28;i++) seq.push(keyIdx(pts,srcT(c,0+i/fpsOut,tope)));
  // periodo entero para el recuento
  const full=[]; for(let i=0;i<=Math.round(4*L*fpsOut);i++) full.push(keyIdx(pts,srcT(c,i/fpsOut,tope)));
  let mx=1,run=1; for(let i=1;i<full.length;i++){ if(full[i]===full[i-1])run++; else {mx=Math.max(mx,run);run=1;} } mx=Math.max(mx,run);
  const fuera=full.filter(x=>{const a=pts[x],b=(x+1<pts.length)?pts[x+1]:Infinity;return !(b>inP*1e6+1e-6&&a<(inP+L)*1e6-1e-6);}).length;
  const s=seq.map((x,j)=>(j===4?'['+x+']':''+x)).join(',');
  console.log(nombre.padEnd(34)+s.padEnd(44)+String(mx).padEnd(12)+fuera);
}

console.log('\n\n=== CARA A CARA en el caso que R346 llama «lo normal»: máster a la cadencia de la fuente ===');
console.log('(fpsOut = fpsSrc, loopLen múltiplo del fotograma — 4 ciclos)\n');
const CASOS=[[24,1.0,0],[24,0.5,0],[25,2.0,1.0],[30,1.0,0],[48,0.25,0],[50,1.0,0.5],[60,0.5,0]];
console.log('fps  L      inP   |  ANTES (ph=L-ph)                 | DESPUES (tope 4 µs)              | fotograma (ph=L-fd-ph)');
console.log('                  |  fuera / congel / serie          | fuera / congel / serie           | fuera / congel / serie');
console.log('-'.repeat(120));
function medir(fps,LL,ip,modo){
  const p=[]; const dur=Math.max(ip+LL+1,6); for(let i=0;i<Math.round(dur*fps);i++)p.push(i*1e6/fps);
  const cc={start:0,speed:1,loop:true,loopLen:LL,loopRev:true,inP:ip}; const f=1/fps;
  const seq=[]; for(let i=0;i<=Math.round(4*LL*fps);i++){ const t=i/fps; let s;
    if(modo==='old') s=srcT(cc,t,0); else if(modo==='new') s=srcT(cc,t,2*TOL_DECOD);
    else { const raw=t; let k=Math.floor(raw/LL), ph=raw-k*LL; ph=Math.round(ph*1e9)/1e9;
           if(ph>=LL-1e-9){ph=0;k++;} else if(ph<0){ph+=LL;k--;} if(k&1)ph=Math.max(0,LL-ph-f); s=ip+ph; }
    seq.push(keyIdx(p,s)); }
  let mx=1,run=1,cong=0; for(let i=1;i<seq.length;i++){ if(seq[i]===seq[i-1]){run++;cong++;} else {mx=Math.max(mx,run);run=1;} } mx=Math.max(mx,run);
  const fuera=seq.filter(x=>{const a=p[x],b=(x+1<p.length)?p[x+1]:Infinity;return !(b>ip*1e6+1e-6&&a<(ip+LL)*1e6-1e-6);}).length;
  return fuera+' / '+cong+' / '+mx;
}
for(const [fps,LL,ip] of CASOS){
  console.log(String(fps).padEnd(5)+String(LL).padEnd(7)+String(ip).padEnd(6)+'|  '
    +medir(fps,LL,ip,'old').padEnd(32)+'| '+medir(fps,LL,ip,'new').padEnd(33)+'| '+medir(fps,LL,ip,'fd'));
}
