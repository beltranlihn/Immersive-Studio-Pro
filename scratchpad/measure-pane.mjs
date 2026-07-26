import { evalInApp } from './cdp.mjs';
console.log(await evalInApp(`(()=>{
  const ov=document.getElementById('landingOv'); if(!ov)return 'sin landing';
  const out={};
  for(const id of ['lchCvDome','lchCvDome3d']){
    const cv=ov.querySelector('#'+id); if(!cv){ out[id]='no existe'; continue; }
    const r=cv.getBoundingClientRect(); const p=cv.closest('.lch-pane').getBoundingClientRect();
    // radio real dibujado: barrer la fila central buscando el ultimo pixel no negro
    const x=cv.getContext('2d'); let rad=null;
    try{ const H=cv.height, W=cv.width; const row=x.getImageData(0,Math.round(H/2),W,1).data;
      let first=-1,last=-1; for(let i=0;i<W;i++){ const a=row[i*4+3]; if(a>6){ if(first<0)first=i; last=i; } }
      rad = first>=0 ? Math.round((last-first)/2) : null; }catch(e){ rad='err'; }
    out[id]={ pane:[Math.round(p.width),Math.round(p.height)], cssCanvas:[Math.round(r.width),Math.round(r.height)],
      backing:[cv.width,cv.height], dpr:window.devicePixelRatio, radioDibujadoPx:rad,
      ocupacion: rad? +((rad*2)/cv.width*100).toFixed(0)+'% del ancho' : null };
  }
  return JSON.stringify(out,null,1);
})()`, { port: 9222 }));
