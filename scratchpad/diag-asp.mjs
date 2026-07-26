import { evalInApp } from './cdp.mjs';
console.log(await evalInApp(`(async()=>{
  const m=mediaById(window._N);
  const v=document.createElement('video'); v.muted=true; v.src=m.ncUrl;
  const meta=await new Promise(r=>{let d=false;v.onloadedmetadata=()=>{if(!d){d=true;r({w:v.videoWidth,h:v.videoHeight});}};v.onerror=()=>{if(!d){d=true;r({e:'err'});}};setTimeout(()=>{if(!d){d=true;r({e:'to'});}},9000);});
  const c=state.clips.find(x=>x.mediaId===m.id);
  const vi=_vinst.get(c.id);
  return JSON.stringify({ archivoDelCache:meta, ncSquareExiste:(typeof _ncSquare!=='undefined'), ncSquareAhora:(typeof _ncSquare!=='undefined'?_ncSquare:null),
    nest:{w:m.w,h:m.h}, seq:{w:state.seqW,h:state.seqH}, nestSizePool:nestSize, compAspect:_compAspect,
    vtexListo:!!(vi&&vi.ready) },null,1);
})()`,{port:9222}));
