/* R346b — barrido: en cuántas configuraciones REALISTAS cambia algo el tope, y en qué dirección.
   Misma réplica exacta de srcT (antes/después) y de keyForTime que en r346b-pingpong.mjs. */
const TOL_DECOD=2e-6; const instanteDecod=t=>{const x=+t;return (isFinite(x)?x:0)+TOL_DECOD;};
function srcT_old(c,t){ const raw=(t-c.start)*(c.speed||1);
  if(c.loop&&c.loopLen>0){ const L=c.loopLen; let k=Math.floor(raw/L), ph=raw-k*L; ph=Math.round(ph*1e9)/1e9;
    if(ph>=L-1e-9){ ph=0; k++; } else if(ph<0){ ph+=L; k--; }
    if(c.loopRev&&(k&1))ph=L-ph; return (c.inP||0)+ph; } return raw+(c.inP||0); }
function srcT_new(c,t){ const raw=(t-c.start)*(c.speed||1);
  if(c.loop&&c.loopLen>0){ const L=c.loopLen; let k=Math.floor(raw/L), ph=raw-k*L; ph=Math.round(ph*1e9)/1e9;
    if(ph>=L-1e-9){ ph=0; k++; } else if(ph<0){ ph+=L; k--; }
    if(c.loopRev&&(k&1))ph=Math.min(L-ph, L-2*TOL_DECOD); return (c.inP||0)+ph; } return raw+(c.inP||0); }
function srcT_fd(c,t,fd){ const raw=(t-c.start)*(c.speed||1);
  if(c.loop&&c.loopLen>0){ const L=c.loopLen; let k=Math.floor(raw/L), ph=raw-k*L; ph=Math.round(ph*1e9)/1e9;
    if(ph>=L-1e-9){ ph=0; k++; } else if(ph<0){ ph+=L; k--; }
    if(c.loopRev&&(k&1))ph=Math.max(0,L-ph-fd); return (c.inP||0)+ph; } return raw+(c.inP||0); }
function keyIdx(pts,tSec){ const tt=Math.floor(Math.max(0,instanteDecod(tSec)*1e6)); let lo=0,hi=pts.length-1,res=0;
  while(lo<=hi){const mid=(lo+hi)>>1; if(pts[mid]<=tt){res=mid;lo=mid+1;} else hi=mid-1;} return res; }
const holdExtra=s=>{let n=0,mx=1,run=1; for(let i=1;i<s.length;i++){ if(s[i]===s[i-1]){run++;n++;} else {mx=Math.max(mx,run);run=1;} } return {n,mx:Math.max(mx,run)};};
const skips=s=>{let n=0;for(let i=1;i<s.length;i++){const d=Math.abs(s[i]-s[i-1]); if(d>1)n+=d-1;} return n;};

const FPS=[23.976,24,25,29.97,30,48,50,60];
const LENS=[0.25,0.4,0.5,1,10/24,2/3,1.5,2,3,5/6];
let rnd=(()=>{let s=20260810;return()=>{s=(s*1103515245+12345)&0x7fffffff;return s/0x7fffffff;};})();
const buckets={igual:0, nuevoMejor:0, nuevoPeor:0, mixto:0};
const ejemplosPeor=[], ejemplosMejor=[], ejemplosCanje=[];
const porCadencia={decima:{canje:0,limpio:0},igualOsube:{canje:0,limpio:0}};
let totOldOut=0,totNewOut=0,totOldHold=0,totNewHold=0,totFdOut=0,totFdHold=0,totOldMx=0,totNewMx=0,totFdMx=0,n=0;
for(let it=0; it<4000; it++){
  const fpsSrc=FPS[(rnd()*FPS.length)|0], fpsOut=FPS[(rnd()*FPS.length)|0];
  const L=LENS[(rnd()*LENS.length)|0];
  const speed=[1,1,1,1,0.5,2][(rnd()*6)|0];
  const inPmode=(rnd()*3)|0; // 0 = 0, 1 = a fotograma, 2 = arbitrario
  const inP= inPmode===0?0 : inPmode===1? Math.round(rnd()*40)/fpsSrc : +(rnd()*3).toFixed(4);
  const start=[0,0,0,1,+(rnd()*2).toFixed(3)][(rnd()*5)|0];
  const mediaDur=Math.max(inP+L+1, 6);
  const pts=[]; { const nf=Math.round(mediaDur*fpsSrc); for(let i=0;i<nf;i++)pts.push(i*1e6/fpsSrc); }
  const c={start,speed,loop:true,loopLen:L,loopRev:true,inP}; const fd=1/fpsSrc;
  const nOut=Math.max(24,Math.round(4*L*fpsOut/speed));
  const so=[],sn=[],sf=[]; let oOut=0,nOut2=0,fOut=0;
  const winA=inP*1e6, winB=(inP+L)*1e6;
  const inWin=(i)=>{const a=pts[i],b=(i+1<pts.length)?pts[i+1]:Infinity; return b>winA+1e-6 && a<winB-1e-6;};
  for(let i=0;i<=nOut;i++){ const t=start+i/fpsOut;
    const a=keyIdx(pts,srcT_old(c,t)), b=keyIdx(pts,srcT_new(c,t)), d=keyIdx(pts,srcT_fd(c,t,fd));
    so.push(a); sn.push(b); sf.push(d); if(!inWin(a))oOut++; if(!inWin(b))nOut2++; if(!inWin(d))fOut++; }
  const ho=holdExtra(so), hn=holdExtra(sn), hf=holdExtra(sf);
  totOldOut+=oOut; totNewOut+=nOut2; totFdOut+=fOut; totOldHold+=ho.n; totNewHold+=hn.n; totFdHold+=hf.n;
  totOldMx=Math.max(totOldMx,ho.mx); totNewMx=Math.max(totNewMx,hn.mx); totFdMx=Math.max(totFdMx,hf.mx); n++;
  const same=so.every((x,i)=>x===sn[i]);
  const desc=`fpsSrc=${fpsSrc} fpsOut=${fpsOut} L=${L.toFixed(4)} inP=${inP.toFixed(4)} start=${start} speed=${speed}`;
  if(same) buckets.igual++;
  else {
    const dOut=nOut2-oOut, dHold=hn.n-ho.n, dSkip=skips(sn)-skips(so);
    const dec = fpsOut/speed < fpsSrc-1e-9; // la salida DIEZMA la fuente (menos muestras que fotogramas)
    if(dHold>0){ buckets.mixto++; (dec?porCadencia.decima:porCadencia.igualOsube).canje++;
                 if(ejemplosCanje.length<6)ejemplosCanje.push({desc,dOut,dHold,dSkip,mxO:ho.mx,mxN:hn.mx}); }
    else if(dHold<0){ buckets.nuevoMejor++; if(ejemplosMejor.length<5)ejemplosMejor.push({desc,dOut,dHold,dSkip}); }
    else { buckets.nuevoPeor++; (dec?porCadencia.decima:porCadencia.igualOsube).limpio++;
           if(ejemplosPeor.length<5)ejemplosPeor.push({desc,dOut,dHold,dSkip,mxO:ho.mx,mxN:hn.mx}); }
  }
}
console.log('BARRIDO — 4000 configuraciones aleatorias realistas (loopRev siempre ON), 4 ciclos cada una\n');
console.log('  idénticas (el tope no cambia nada) : '+buckets.igual+'  ('+(100*buckets.igual/4000).toFixed(1)+'%)');
console.log('  CANJE — gana ventana PERO AÑADE congelación : '+buckets.mixto+'  ('+(100*buckets.mixto/(4000-buckets.igual)).toFixed(1)+'% de las que cambian)');
console.log('  GANANCIA LIMPIA — gana ventana sin añadir congelación : '+buckets.nuevoPeor+'  ('+(100*buckets.nuevoPeor/(4000-buckets.igual)).toFixed(1)+'%)');
console.log('  el NUEVO QUITA congelación : '+buckets.nuevoMejor);
console.log('  desglose del canje por cadencia: salida que DIEZMA la fuente → canje '+porCadencia.decima.canje+' / limpio '+porCadencia.decima.limpio
          +'  ·  salida igual o MÁS densa que la fuente → canje '+porCadencia.igualOsube.canje+' / limpio '+porCadencia.igualOsube.limpio);
console.log('\nTOTALES agregados sobre las 4000 configuraciones:');
console.log('             fuera-de-ventana   fotogramas congelados   serie máxima');
console.log('  ANTES   : '+String(totOldOut).padStart(10)+String(totOldHold).padStart(22)+String(totOldMx).padStart(15));
console.log('  DESPUES : '+String(totNewOut).padStart(10)+String(totNewHold).padStart(22)+String(totNewMx).padStart(15));
console.log('  fdstep  : '+String(totFdOut).padStart(10)+String(totFdHold).padStart(22)+String(totFdMx).padStart(15));
console.log('\nEjemplos del CANJE (ventana a cambio de congelación):');
for(const e of ejemplosCanje)console.log('   '+e.desc+'  → fuera '+e.dOut+', congelados +'+e.dHold+', saltos '+e.dSkip+', serie máx '+e.mxO+'→'+e.mxN);
console.log('\nEjemplos de GANANCIA LIMPIA (siempre con la salida diezmando la fuente):');
for(const e of ejemplosPeor)console.log('   '+e.desc+'  → fuera '+e.dOut+', congelados '+e.dHold+', saltos '+e.dSkip+', serie máx '+e.mxO+'→'+e.mxN);
