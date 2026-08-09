/* [R344] Lector de `elst` INDEPENDIENTE de la app: comprueba que el material de prueba tiene de verdad la
   edit list que se le supone. Si el juez y el acusado son el mismo demuxador, la prueba no vale.
   Uso: node scratchpad/r344-lee-elst.mjs <archivo.mp4> [...] */
import { readFileSync } from 'fs';

function cajas(b, ini, fin){ const out=[]; let p=ini;
  while(p+8<=fin){ let sz=b.readUInt32BE(p); const t=b.toString('latin1',p+4,p+8); let d=p+8;
    if(sz===1){ sz=Number(b.readBigUInt64BE(p+8)); d=p+16; } else if(sz===0){ sz=fin-p; }
    if(sz<8||p+sz>fin) break;
    out.push({t, d, fin:p+sz}); p+=sz; }
  return out; }
const hija=(b,c,t)=>cajas(b,c.d,c.fin).find(x=>x.t===t);

for(const ruta of process.argv.slice(2)){
  const b=readFileSync(ruta);
  const moov=cajas(b,0,b.length).find(x=>x.t==='moov');
  if(!moov){ console.log(ruta+'\n   *** sin moov'); continue; }
  const mvhd=hija(b,moov,'mvhd');
  const movTs=mvhd?(b.readUInt8(mvhd.d)===1?b.readUInt32BE(mvhd.d+20):b.readUInt32BE(mvhd.d+12)):0;
  const traks=cajas(b,moov.d,moov.fin).filter(x=>x.t==='trak');
  console.log('');
  console.log(ruta.split(/[\\/]/).pop()+'   (timescale de pelicula '+movTs+')');
  traks.forEach((tr,i)=>{
    const mdia=hija(b,tr,'mdia'); const mdhd=mdia?hija(b,mdia,'mdhd'):null;
    const mts=mdhd?(b.readUInt8(mdhd.d)===1?b.readUInt32BE(mdhd.d+20):b.readUInt32BE(mdhd.d+12)):0;
    const hdlr=mdia?hija(b,mdia,'hdlr'):null; const tipo=hdlr?b.toString('latin1',hdlr.d+8,hdlr.d+12):'????';
    const edts=hija(b,tr,'edts'); const elst=edts?hija(b,edts,'elst'):null;
    if(!elst){ console.log('   pista '+i+' ('+tipo+', timescale '+mts+'): SIN edit list'); return; }
    const v=b.readUInt8(elst.d), n=b.readUInt32BE(elst.d+4); let p=elst.d+8; const ent=[];
    for(let k=0;k<n;k++){
      let dur, mt;
      if(v===1){ dur=Number(b.readBigUInt64BE(p)); mt=Number(b.readBigInt64BE(p+8)); p+=20; }
      else { dur=b.readUInt32BE(p); mt=b.readInt32BE(p+4); p+=12; }
      ent.push({dur, mt}); }
    const desc=ent.map(e=>'media_time '+e.mt+(e.mt>=0&&mts?(' = '+(e.mt/mts).toFixed(4)+' s'):' (hueco vacio)')+', duracion '+e.dur+(movTs?(' = '+(e.dur/movTs).toFixed(4)+' s'):'')).join(' | ');
    console.log('   pista '+i+' ('+tipo+', timescale '+mts+'): edit list v'+v+', '+n+' entrada(s) -> '+desc);
  });
}
console.log('');
