import { evalInApp } from './cdp.mjs';
const RUTA = String.raw`C:\Users\beltr\Desktop\Alma Digital Studio\Projects\Immersive Studio Pro\scratchpad\r225media\r225clip.mp4`.replace(/\\/g,'\\\\');
const expr = `(async function(){
  const RUTA='${RUTA}';
  const st=await DSP.stat(RUTA);
  const fake={path:RUTA, fsize:(st&&st.size)||0};
  return { proxyLocal:proxyLocalPath(fake), fsize:fake.fsize, dir:pdir(RUTA) };
})()`;
evalInApp(expr).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error('ERR',e.message);process.exit(1);});
