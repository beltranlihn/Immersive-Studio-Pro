import { evalInApp } from './cdp.mjs';

const DIR = 'C:\\\\Users\\\\beltr\\\\Desktop\\\\Alma Digital Studio\\\\Projects\\\\Immersive Studio Pro\\\\scratchpad';

// The demuxer under test (range-read based). Kept as a string so it runs inside the app (WebCodecs + DSP available).
const DEMUX = `
async function demuxMP4(path){
  const id=await DSP.openRead(path); const st=await DSP.stat(path); const size=st.size;
  const rd=(p,l)=>DSP.readAt(id,p,l);
  const asDV=u=>new DataView(u.buffer,u.byteOffset,u.byteLength);
  const fourcc=(u,o)=>String.fromCharCode(u[o],u[o+1],u[o+2],u[o+3]);
  // walk top-level boxes from disk to find moov
  let p=0, moov=null;
  while(p+8<=size){ const h=await rd(p,16); if(!h||h.length<8)break; const dv=asDV(h); let sz=dv.getUint32(0); const t=fourcc(h,4); let hs=8; if(sz===1){ sz=Number(dv.getBigUint64(8)); hs=16; } else if(sz===0){ sz=size-p; }
    if(t==='moov'){ moov={start:p,size:sz,hs}; break; } if(sz<=0)break; p+=sz; }
  if(!moov){ await DSP.closeRead(id); throw new Error('no moov'); }
  const mv=await rd(moov.start,moov.size); const dv=asDV(mv);
  // in-memory box walker over mv (offsets relative to mv start)
  const boxes=(s,e)=>{ const out=[]; let q=s; while(q+8<=e){ let sz=dv.getUint32(q); const t=fourcc(mv,q+4); let hs=8; if(sz===1){ sz=Number(dv.getBigUint64(q+8)); hs=16; } else if(sz===0){ sz=e-q; } out.push({t,s:q,d:q+hs,e:q+sz}); if(sz<=0)break; q+=sz; } return out; };
  const find=(l,t)=>l.find(b=>b.t===t); const kid=(b,t)=>find(boxes(b.d,b.e),t);
  // pick the video trak
  let stbl=null,mdhd=null;
  for(const trak of boxes(moov.hs, moov.size).filter(b=>b.t==='trak')){
    const mdia=kid(trak,'mdia'); if(!mdia)continue; const hdlr=kid(mdia,'hdlr');
    const hs=hdlr?fourcc(mv,hdlr.d+8):''; if(hs!=='vide')continue;
    mdhd=kid(mdia,'mdhd'); const minf=kid(mdia,'minf'); const s=minf&&kid(minf,'stbl'); if(!s)continue; stbl=s; break;
  }
  if(!stbl){ await DSP.closeRead(id); throw new Error('no video stbl'); }
  const tsVer=dv.getUint8(mdhd.d); const timescale=tsVer===1?dv.getUint32(mdhd.d+20):dv.getUint32(mdhd.d+12);
  // sample description → codec + description + dims
  const stsd=kid(stbl,'stsd'); const ent=boxes(stsd.d+8,stsd.e)[0]; const fmt=ent.t; // hvc1/hev1/avc1/avc3
  const codedWidth=dv.getUint16(ent.d+24), codedHeight=dv.getUint16(ent.d+26);
  const cfgBox=kid({d:ent.d+78,e:ent.e},'hvcC')||kid({d:ent.d+78,e:ent.e},'avcC');
  const description=mv.slice(cfgBox.d,cfgBox.e);
  let codec=null;
  if(fmt==='avc1'||fmt==='avc3'){ const b=description; codec='avc1.'+[b[1],b[2],b[3]].map(x=>x.toString(16).padStart(2,'0')).join(''); }
  else { const lvl=dv.getUint8(cfgBox.d+12); for(const c of ['hvc1.2.4.L'+lvl+'.B0','hev1.2.4.L'+lvl+'.B0','hvc1.1.6.L'+lvl+'.B0']){ try{ const r=await VideoDecoder.isConfigSupported({codec:c,description,hardwareAcceleration:'prefer-hardware'}); if(r.supported){codec=c;break;} }catch(e){} } if(!codec)codec='hvc1.2.4.L'+lvl+'.B0'; }
  // tables
  const stsz=kid(stbl,'stsz'), stsc=kid(stbl,'stsc'), stco=kid(stbl,'stco'), co64=kid(stbl,'co64'), stss=kid(stbl,'stss'), stts=kid(stbl,'stts'), ctts=kid(stbl,'ctts');
  const ss=dv.getUint32(stsz.d+4), sc=dv.getUint32(stsz.d+8); const sizes=new Array(sc); for(let i=0;i<sc;i++)sizes[i]=ss!==0?ss:dv.getUint32(stsz.d+12+i*4);
  const scn=dv.getUint32(stsc.d+4); const sE=[]; for(let i=0;i<scn;i++){const o=stsc.d+8+i*12; sE.push({first:dv.getUint32(o),spc:dv.getUint32(o+4)});}
  const chn=stco?dv.getUint32(stco.d+4):dv.getUint32(co64.d+4); const choff=new Array(chn); for(let i=0;i<chn;i++)choff[i]=stco?dv.getUint32(stco.d+8+i*4):Number(dv.getBigUint64(co64.d+8+i*8));
  const key=new Set(); if(stss){const kn=dv.getUint32(stss.d+4); for(let i=0;i<kn;i++)key.add(dv.getUint32(stss.d+8+i*4)-1);} else for(let i=0;i<sc;i++)key.add(i);
  // decode-time deltas (stts) → dts; ctts → pts offset
  const dts=new Array(sc); { let ei=dv.getUint32(stts.d+4),o=stts.d+8,si=0,t=0; for(let e=0;e<ei;e++){ const cnt=dv.getUint32(o),del=dv.getUint32(o+4); o+=8; for(let k=0;k<cnt&&si<sc;k++){ dts[si++]=t; t+=del; } } while(si<sc)dts[si++]=t; }
  const cto=new Array(sc).fill(0); if(ctts){ let ei=dv.getUint32(ctts.d+4),o=ctts.d+8,si=0; for(let e=0;e<ei;e++){ const cnt=dv.getUint32(o),off=dv.getInt32(o+4); o+=8; for(let k=0;k<cnt&&si<sc;k++)cto[si++]=off; } }
  // sample offsets via stsc
  const spcFor=(ci)=>{ let spc=sE[0].spc; for(const e of sE){ if((e.first-1)<=ci)spc=e.spc; else break; } return spc; };
  const offs=new Array(sc); { let si=0; for(let ci=0;ci<chn&&si<sc;ci++){ let off=choff[ci]; const spc=spcFor(ci); for(let k=0;k<spc&&si<sc;k++){ offs[si]=off; off+=sizes[si]; si++; } } }
  const samples=new Array(sc); for(let i=0;i<sc;i++)samples[i]={offset:offs[i],size:sizes[i],key:key.has(i),pts:Math.round((dts[i]+cto[i])*1e6/timescale),dur:Math.round(1e6/(timescale/ (sc>1?((dts[sc-1]-dts[0])/(sc-1)):1) ))};
  return { path, codec, fmt, description, codedWidth, codedHeight, timescale, samples,
           readSample:(i)=>rd(samples[i].offset,samples[i].size), close:()=>DSP.closeRead(id) };
}
`;

const expr = `(async()=>{
  ${DEMUX}
  const clips=[['dm_hevc_fast',150,'hevc'],['dm_hevc_slow',150,'hevc'],['dm_h264',150,'h264']];
  const out=[];
  for(const [name,nframes,kind] of clips){
    const path=${JSON.stringify(DIR)}+'\\\\'+name+'.mp4';
    try{
      const d=await demuxMP4(path);
      const checks=[];
      checks.push('samples='+d.samples.length+(d.samples.length===nframes?' ok':' FAIL(exp '+nframes+')'));
      checks.push('firstKey='+(d.samples[0].key?'ok':'FAIL'));
      checks.push('dims='+d.codedWidth+'x'+d.codedHeight+(d.codedWidth===1280&&d.codedHeight===720?' ok':' FAIL'));
      checks.push('codec='+d.codec);
      // END-TO-END: decode every sample, count frames
      let outN=0, errN=0;
      const dec=new VideoDecoder({output:f=>{outN++;f.close();},error:e=>{errN++;}});
      dec.configure({codec:d.codec,description:d.description,hardwareAcceleration:'prefer-hardware'});
      for(let i=0;i<d.samples.length;i++){ const data=await d.readSample(i); const s=d.samples[i];
        dec.decode(new EncodedVideoChunk({type:s.key?'key':'delta',timestamp:s.pts,data}));
        if(dec.decodeQueueSize>16)await new Promise(r=>setTimeout(r,0)); }
      await dec.flush(); dec.close(); await d.close();
      checks.push('decoded='+outN+'/'+d.samples.length+(outN===d.samples.length&&errN===0?' ok':' FAIL(err '+errN+')'));
      out.push(name+':\\n   '+checks.join('\\n   '));
    }catch(e){ out.push(name+': THREW '+e.message); }
  }
  return out.join('\\n');
})()`;

try { console.log(await evalInApp(expr, { timeout: 90000 })); }
catch (e) { console.error('ERROR:', e.message); process.exit(1); }
