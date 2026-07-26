import { evalInApp } from './cdp.mjs';
const P = { port: 9222 };
await evalInApp(`(()=>{ if(!document.getElementById('landingOv'))showLanding(); _lch.ptype='dome'; renderLauncher(); return true; })()`, P);
await new Promise(r => setTimeout(r, 1400));
console.log(await evalInApp(`(()=>{
  const ov=document.getElementById('landingOv'); if(!ov)return 'sin landing';
  const out={};
  for(const id of ['lchCvDome','lchCvDome3d']){
    const cv=ov.querySelector('#'+id); if(!cv){ out[id]='no existe'; continue; }
    const r=cv.getBoundingClientRect(); const p=cv.closest('.lch-pane').getBoundingClientRect();
    const x=cv.getContext('2d'); let rad=null;
    try{ const H=cv.height,W=cv.width; const row=x.getImageData(0,Math.round(H/2),W,1).data;
      let f=-1,l=-1; for(let i=0;i<W;i++){ if(row[i*4+3]>6){ if(f<0)f=i; l=i; } }
      rad = f>=0 ? Math.round((l-f)/2) : null; }catch(e){ rad='err '+e.message; }
    out[id]={ pane:[Math.round(p.width),Math.round(p.height)], cssCanvas:[Math.round(r.width),Math.round(r.height)],
      backing:[cv.width,cv.height], dpr:window.devicePixelRatio, diamDibujado:rad?rad*2:null,
      ocupaDelAncho: (typeof rad==='number'&&cv.width)? +((rad*2)/cv.width*100).toFixed(0)+'%' : null };
  }
  return JSON.stringify(out,null,1);
})()`, P));
