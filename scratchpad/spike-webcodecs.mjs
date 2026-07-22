import { evalInApp } from './cdp.mjs';

const CLIP = 'C:\\\\Users\\\\beltr\\\\Desktop\\\\Alma Digital Studio\\\\Projects\\\\Immersive Studio Pro\\\\scratchpad\\\\spike.mp4';

const expr = `(async()=>{
  const w=(ms)=>new Promise(r=>setTimeout(r,ms));
  if(typeof VideoDecoder==='undefined')return 'NO WebCodecs VideoDecoder';
  const buf=await fetch(DSP.toFileURL(${JSON.stringify(CLIP)})).then(r=>r.arrayBuffer());
  const dv=new DataView(buf);
  const boxes=(s,e)=>{ const out=[]; let p=s; while(p+8<=e){ let sz=dv.getUint32(p); const t=String.fromCharCode(dv.getUint8(p+4),dv.getUint8(p+5),dv.getUint8(p+6),dv.getUint8(p+7)); let hs=8; if(sz===1){sz=Number(dv.getBigUint64(p+8));hs=16;}else if(sz===0){sz=e-p;} out.push({t,start:p,d:p+hs,e:p+sz}); if(sz<=0)break; p+=sz; } return out; };
  const find=(l,t)=>l.find(b=>b.t===t);
  const kid=(b,t)=>find(boxes(b.d,b.e),t);
  const top=boxes(0,buf.byteLength); const moov=find(top,'moov'); if(!moov)return 'no moov';
  // pick the video trak
  let stbl=null,hvcC=null;
  for(const trak of boxes(moov.d,moov.e).filter(b=>b.t==='trak')){
    const mdia=kid(trak,'mdia'); if(!mdia)continue; const hdlr=kid(mdia,'hdlr');
    const hs=hdlr?String.fromCharCode(dv.getUint8(hdlr.d+8),dv.getUint8(hdlr.d+9),dv.getUint8(hdlr.d+10),dv.getUint8(hdlr.d+11)):'';
    if(hs!=='vide')continue;
    const minf=kid(mdia,'minf'); const st=minf&&kid(minf,'stbl'); if(!st)continue; stbl=st;
    const stsd=kid(st,'stsd'); const entries=boxes(stsd.d+8,stsd.e); const ent=entries[0]; // hvc1/hev1
    hvcC=kid({d:ent.d+78,e:ent.e},'hvcC'); break;
  }
  if(!stbl||!hvcC)return 'no stbl/hvcC';
  const desc=new Uint8Array(buf.slice(hvcC.d,hvcC.e));
  // sample tables
  const rd=(b)=>({v:b, dv, });
  const stsz=kid(stbl,'stsz'), stsc=kid(stbl,'stsc'), stco=kid(stbl,'stco'), co64=kid(stbl,'co64'), stss=kid(stbl,'stss');
  const ss=dv.getUint32(stsz.d+4), sc=dv.getUint32(stsz.d+8); const sizes=[]; for(let i=0;i<sc;i++)sizes.push(ss!==0?ss:dv.getUint32(stsz.d+12+i*4));
  const scn=dv.getUint32(stsc.d+4); const stscE=[]; for(let i=0;i<scn;i++){const o=stsc.d+8+i*12; stscE.push({first:dv.getUint32(o),spc:dv.getUint32(o+4)});}
  const chn=stco?dv.getUint32(stco.d+4):dv.getUint32(co64.d+4); const choff=[]; for(let i=0;i<chn;i++){ choff.push(stco?dv.getUint32(stco.d+8+i*4):Number(dv.getBigUint64(co64.d+8+i*8))); }
  const key=new Set(); if(stss){const kn=dv.getUint32(stss.d+4); for(let i=0;i<kn;i++)key.add(dv.getUint32(stss.d+8+i*4)-1);} else { for(let i=0;i<sc;i++)key.add(i); }
  // sample offsets via stsc
  const spcFor=(ci)=>{ let spc=stscE[0].spc; for(const e of stscE){ if((e.first-1)<=ci)spc=e.spc; else break; } return spc; };
  const offs=[]; let si=0; for(let ci=0;ci<chn && si<sc;ci++){ let off=choff[ci]; const spc=spcFor(ci); for(let k=0;k<spc && si<sc;k++){ offs.push(off); off+=sizes[si]; si++; } }
  const samples=offs.map((o,i)=>({data:new Uint8Array(buf.slice(o,o+sizes[i])), key:key.has(i)}));
  // codec string: probe candidates with hardware preference
  const cands=['hvc1.2.4.L123.B0','hev1.2.4.L123.B0','hvc1.2.4.L123.90','hvc1.1.2.L123.B0'];
  let codec=null,accel=null;
  for(const c of cands){ try{ const r=await VideoDecoder.isConfigSupported({codec:c,description:desc,hardwareAcceleration:'prefer-hardware'}); if(r.supported){ codec=c; accel=(r.config&&r.config.hardwareAcceleration)||'?'; break; } }catch(e){} }
  if(!codec){ for(const c of cands){ try{ const r=await VideoDecoder.isConfigSupported({codec:c,description:desc}); if(r.supported){codec=c;accel='(default)';break;} }catch(e){} } }
  if(!codec)return 'codec no soportado; desc '+desc.length+'B, samples '+samples.length;
  const frameDur=Math.round(1e6/60);
  async function trial(N){
    const decs=[]; let running=true;
    for(let n=0;n<N;n++){ const d={i:0,ts:0,count:0}; d.dec=new VideoDecoder({output:f=>{d.count++;f.close();},error:e=>{d.err=String(e);}});
      d.dec.configure({codec,description:desc,hardwareAcceleration:'prefer-hardware'}); decs.push(d); }
    const pump=async(d)=>{ while(running){ if(d.dec.decodeQueueSize<8){ const s=samples[d.i]; try{ d.dec.decode(new EncodedVideoChunk({type:s.key?'key':'delta',timestamp:d.ts,duration:frameDur,data:s.data})); }catch(e){ d.err=String(e); running=false; break; } d.ts+=frameDur; d.i++; if(d.i>=samples.length)d.i=0; } else { await w(1); } } };
    decs.forEach(d=>pump(d));
    await w(1000); // warm
    const c0=decs.map(d=>d.count); const t0=performance.now();
    await w(3000);
    const dt=(performance.now()-t0)/1000; const per=decs.map((d,i)=>+((d.count-c0[i])/dt).toFixed(1));
    running=false; await w(50);
    for(const d of decs){ try{ await d.dec.flush(); }catch(e){} try{ d.dec.close(); }catch(e){} }
    return { decoders:N, perDecoderFps:per, total:+per.reduce((a,b)=>a+b,0).toFixed(1), err:decs.map(d=>d.err).filter(Boolean) };
  }
  const R={codec,accel,samples:samples.length,descBytes:desc.length};
  R.t1=await trial(1); await w(300);
  R.t3=await trial(3); await w(300);
  R.t4=await trial(4); await w(300);
  R.t6=await trial(6);
  return JSON.stringify(R,null,1);
})()`;

try { console.log(await evalInApp(expr, { timeout: 90000 })); }
catch (e) { console.error('ERROR:', e.message); process.exit(1); }
