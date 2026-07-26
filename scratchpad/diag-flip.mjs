import { evalInApp } from './cdp.mjs';
console.log(await evalInApp(`(async()=>{
  const m=mediaById(window._N); const c=state.clips.find(x=>x.mediaId===m.id);
  const perfil=(tex,N)=>{ const fb=gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER,fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);
    const ok=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;
    if(!ok){ gl.bindFramebuffer(gl.FRAMEBUFFER,null); gl.deleteFramebuffer(fb); return null; }
    const px=new Uint8Array(N*N*4); gl.readPixels(0,0,N,N,gl.RGBA,gl.UNSIGNED_BYTE,px);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null); gl.deleteFramebuffer(fb);
    const filas=[]; for(let y=0;y<N;y++){ let s=0; for(let x=0;x<N;x++){ const i=(y*N+x)*4; s+=(px[i]+px[i+1]+px[i+2])/3; } filas.push(Math.round(s/N)); }
    return filas; };
  // pool (cache OFF)
  state.view.useNestCache=false; await scrubRender(); await new Promise(r=>setTimeout(r,500));
  prepNests(state.clips,0.5,0);
  const pool=perfil(c._ntex,24);
  // cache ON
  state.view.useNestCache=true; await scrubRender(); await new Promise(r=>setTimeout(r,900));
  prepNests(state.clips,0.5,0);
  const vi=_vinst.get(c.id);
  const cache=vi&&vi.vtex?perfil(vi.vtex,24):null;
  const centro=f=>{ if(!f)return null; let s=0,sy=0; f.forEach((v,i)=>{s+=v;sy+=v*i;}); return s>0?+(sy/s).toFixed(2):null; };
  return JSON.stringify({ pool, cache, centroPool:centro(pool), centroCache:centro(cache),
    centroCacheSiSeVoltea:cache?centro(cache.slice().reverse()):null },null,1);
})()`,{port:9222}));
