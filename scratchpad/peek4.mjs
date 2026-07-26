import { evalInApp } from './cdp.mjs';
const P = { port: 9222 };
const shot = `(async()=>{ await scrubRender(); await new Promise(r=>setTimeout(r,900));
  const c=document.createElement('canvas'); c.width=72;c.height=72; const x=c.getContext('2d',{willReadFrequently:true});
  x.drawImage(glc,0,0,72,72); const d=x.getImageData(0,0,72,72).data;
  const px=[]; for(let i=0;i<d.length;i+=4)px.push(d[i],d[i+1],d[i+2]); return px.join(','); })()`;
const bench = `(async()=>{ const t0=performance.now(); const N=20;
  for(let i=0;i<N;i++){ state.playhead=0.1+i*0.08;
    await Promise.all(collectDrawnVideoClips(state.clips,state.lanes,state.playhead,0,[]).map(({c,m,local})=>vinstSeek(c,m,local)));
    prepNests(state.clips,state.playhead,0);
    gl.bindFramebuffer(gl.FRAMEBUFFER,compFBO); composite(state.playhead,compSize,false); gl.bindFramebuffer(gl.FRAMEBUFFER,null); }
  gl.finish(); const ms=performance.now()-t0;
  return JSON.stringify({fps:+(N/(ms/1000)).toFixed(1), decodificadores:collectDrawnVideoClips(state.clips,state.lanes,1.0,0,[]).length}); })()`;

console.log('velocidad CON cache:', await evalInApp(`(async()=>{ state.view.useNestCache=true; state.playhead=1.0; await scrubRender(); await new Promise(r=>setTimeout(r,1200)); return await (${bench}); })()`, P));
const con = await evalInApp(`(async()=>{ state.view.useNestCache=true; state.playhead=1.0; return await (${shot}); })()`, P);
console.log('velocidad SIN cache:', await evalInApp(`(async()=>{ state.view.useNestCache=false; state.playhead=1.0; await scrubRender(); await new Promise(r=>setTimeout(r,900)); return await (${bench}); })()`, P));
const ref = await evalInApp(`(async()=>{ state.view.useNestCache=false; state.playhead=1.0; return await (${shot}); })()`, P);
await evalInApp(`(async()=>{ state.view.useNestCache=true; await scrubRender(); return true; })()`, P);

const A = ref.split(',').map(Number), B = con.split(',').map(Number);
let se = 0, mx = 0; for (let i = 0; i < A.length; i++) { const e = A[i] - B[i]; se += e * e; if (Math.abs(e) > mx) mx = Math.abs(e); }
const mse = se / A.length, psnr = mse > 0 ? (10 * Math.log10(65025 / mse)).toFixed(1) : 'INF';
const cm = a => { let sx=0,sy=0,s=0; for(let y=0;y<72;y++)for(let x=0;x<72;x++){const i=(y*72+x)*3;const v=a[i]+a[i+1]+a[i+2];sx+=x*v;sy+=y*v;s+=v;} return s>0?[+(sx/s).toFixed(2),+(sy/s).toFixed(2)]:[0,0]; };
const a = cm(A), b = cm(B);
console.log('\nENCUADRE domo:', JSON.stringify({ psnr, errorMax: mx, centroSinCache: a, centroConCache: b,
  desplazamiento: [+(b[0]-a[0]).toFixed(2), +(b[1]-a[1]).toFixed(2)],
  veredicto: (Math.abs(b[0]-a[0]) < 1 && Math.abs(b[1]-a[1]) < 1) ? 'ENCUADRE IGUAL - OK' : 'DESAJUSTE' }, null, 1));

console.log('\nexport vuelve a las fuentes:', await evalInApp(`(()=>{
  const m=mediaById(window._N);
  const prev={usable:ncUsable(m),decod:collectDrawnVideoClips(state.clips,state.lanes,1.0,0,[]).length};
  _exportQuality=true;
  const exp={usable:ncUsable(m),url:_vinstUrl(m),decod:collectDrawnVideoClips(state.clips,state.lanes,1.0,0,[]).length};
  _exportQuality=false;
  const back={usable:ncUsable(m),decod:collectDrawnVideoClips(state.clips,state.lanes,1.0,0,[]).length};
  return JSON.stringify({prev,exp,back,veredicto:(prev.usable&&prev.decod===1&&!exp.usable&&exp.url===null&&exp.decod===6&&back.usable&&back.decod===1)?'CORRECTO':'REVISAR'}); })()`, P));

console.log('\nnest 16:9 rechazado:', await evalInApp(`(async()=>{
  const m=mediaById(window._N); const w=m.w,h=m.h; m.w=1920; m.h=1080;
  ncBuild(m); await new Promise(r=>setTimeout(r,800));
  const ov=[...document.querySelectorAll('.overlay')].map(o=>(o.textContent||'').replace(/\\s+/g,' ')).join(' ');
  [...document.querySelectorAll('.overlay')].forEach(o=>o.remove()); m.w=w; m.h=h;
  return JSON.stringify({aviso:ov.slice(0,120), correcto:/square compositions|composiciones cuadradas/.test(ov)}); })()`, P));
