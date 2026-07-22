import { evalInApp } from './cdp.mjs';
const CLIP = 'C:\\\\Users\\\\beltr\\\\Desktop\\\\Alma Digital Studio\\\\Projects\\\\Immersive Studio Pro\\\\scratchpad\\\\pxbig.mp4';
const expr = `(async()=>{
  const path=${JSON.stringify(CLIP)};
  const m={id:uid(),kind:'video',name:'pxbig.mp4',path,srcUrl:DSP.toFileURL(path),fps:60,dur:30,w:1920,h:1080,proxyReady:false,proxyPct:0,_proxyForce:false};
  const finalPath=proxyLocalPath(m); try{ await DSP.deleteFile(finalPath); }catch(_){}
  const t0=performance.now();
  try{ await makeProxy(m); }catch(e){ return 'makeProxy THREW: '+e.message; }
  const secs=((performance.now()-t0)/1000).toFixed(1);
  return JSON.stringify({ seconds:+secs, proxyReady:!!m.proxyReady, pct:m.proxyPct, pw:m.pw, path:(m.proxyPath||'').slice(-40) });
})()`;
console.log(await evalInApp(expr, { timeout: 120000 }));
