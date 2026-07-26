import { evalInApp } from './cdp.mjs';
console.log(await evalInApp(`(async()=>{
  const m=state.media.find(x=>x.kind==='video');
  let st=null; try{ st=await DSP.stat(m.path); }catch(e){ st={err:String(e)}; }
  // ¿decodeAudioData con callbacks LLAMA a alguna de las dos? Se prueba con un buffer minusculo e invalido.
  let cb='sin respuesta en 4s';
  try{ const bad=new ArrayBuffer(64);
    cb=await Promise.race([
      new Promise(res=>{ try{ ACTX().decodeAudioData(bad, ()=>res('llamo a onSuccess'), ()=>res('llamo a onError')); }catch(e){ res('lanzo sincrono: '+e.name); } }),
      new Promise(res=>setTimeout(()=>res('NINGUNA de las dos en 4s'),4000))
    ]);
  }catch(e){ cb='err '+e.message; }
  return JSON.stringify({ medio:m.name, MB:st&&st.size?+(st.size/1e6).toFixed(1):st,
    yaTieneExAudio:!!m._exAudio, superaElTopeDe1500MB:!!(st&&st.size>15e8),
    decodeAudioDataCallbacks:cb }, null, 1);
})()`, { port: 9222 }));
