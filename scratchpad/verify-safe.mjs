import { evalInApp } from './cdp.mjs';

const expr = `(function(){
  const out=[];
  const cv=document.getElementById('grid'); const ctx=cv.getContext('2d');
  const ink=()=>{ const d=ctx.getImageData(0,0,cv.width,cv.height).data; let n=0; for(let i=3;i<d.length;i+=4) if(d[i]>0)n++; return n; };
  function run(label){
    try{
      state.view.showSafe=false; drawGrid2D(); const off=ink();
      state.view.showSafe=true;  drawGrid2D(); const on=ink();
      out.push((on>off?'ok   ':'FAIL ')+label+': off='+off+' on='+on+(on>off?'  (Safe ON añade tinta)':'  (sin cambio!)'));
    }catch(e){ out.push('FAIL '+label+': LANZÓ '+e.message); }
  }
  const sm=state.seqMode;
  state.seqMode='dome'; run('domo (anillos elevación)');
  state.seqMode='flat'; run('flat (action/title-safe)');
  state.seqMode=sm; state.view.showSafe=false; drawGrid2D();
  return out.join('\\n');
})()`;

try { console.log(await evalInApp(expr)); }
catch (e) { console.error('ERROR:', e.message); process.exit(1); }
