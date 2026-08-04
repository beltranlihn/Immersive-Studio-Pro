import { evalInApp } from './cdp.mjs';
const DIR = String.raw`C:\Users\beltr\Desktop\Alma Digital Studio\Projects\Immersive Studio Pro\scratchpad`;
const port = +(process.argv[2] || 9223);
const P = f => (DIR + '\\' + f).replace(/\\/g, '\\\\');
const r = await evalInApp(`(async function(){
  const out={};
  try{ const st=await DSP.stat('${P('aud8b-viejo-resave.isp')}'); out.statResave=st&&st.size; }catch(e){ out.statResave='ERR '+e; }
  const t1=await DSP.readText('${P('aud8b-viejo-resave.isp')}'); out.leeResave=t1?t1.length:null;
  const t2=await DSP.readText('${P('aud8b-copiaprueba.isp')}');  out.leeCopia=t2?t2.length:null;
  const t3=await DSP.readText('${P('aud8b-viejo.isp')}');        out.leeViejo=t3?t3.length:null;
  if(t1){ out.bomResave = t1.charCodeAt(0)===0xFEFF; }
  return out; })()`, { port, timeout: 30000 });
console.log(JSON.stringify(r));
