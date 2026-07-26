import { evalInApp } from './cdp.mjs';
console.log(await evalInApp(`(async()=>{
  const m=mediaById(window._N);
  const v=document.createElement('video'); v.muted=true; v.src=m.ncUrl;
  await new Promise(r=>{v.onloadedmetadata=r;setTimeout(r,9000);});
  await new Promise(r=>{v.currentTime=0.5;v.onseeked=r;setTimeout(r,9000);});
  const c=document.createElement('canvas');c.width=32;c.height=32;const x=c.getContext('2d',{willReadFrequently:true});
  x.drawImage(v,0,0,32,32); const d=x.getImageData(0,0,32,32).data;
  const filas=[]; for(let y=0;y<32;y++){ let s=0; for(let xx=0;xx<32;xx++){const i=(y*32+xx)*4; s+=(d[i]+d[i+1]+d[i+2])/3;} filas.push(Math.round(s/32)); }
  return JSON.stringify({ archivoCache:{w:v.videoWidth,h:v.videoHeight},
    perfilDeFilas:filas,
    filasNegrasArriba:filas.findIndex(f=>f>3),
    filasNegrasAbajo:32-1-filas.map((f,i)=>[f,i]).filter(p=>p[0]>3).map(p=>p[1]).pop(),
    esperadoSiLetterbox169EnCuadrado:'~4,5 filas negras arriba y abajo (de 32)'},null,1);
})()`,{port:9222}));
