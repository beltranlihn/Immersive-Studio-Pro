import { evalInApp } from './cdp.mjs';
const DIR = String.raw`C:\Users\beltr\Desktop\Alma Digital Studio\Projects\Immersive Studio Pro\scratchpad`;
const ISP = (DIR + '\\aud8b-viejo.isp').replace(/\\/g, '\\\\');
const r = await evalInApp(`(async function(){
  const out={};
  try{ const t=await DSP.readText('${ISP}'); out.lee={ok:t!=null, len:t&&t.length}; }catch(e){ out.lee={err:String(e)}; }
  // cerrar el alert que quedo
  const b=document.querySelector('#alertOv button'); if(b)b.click();
  out.alertCerrado=!document.querySelector('#alertOv');
  return out;
})()`, { port: 9223, timeout: 30000 });
console.log(JSON.stringify(r));
