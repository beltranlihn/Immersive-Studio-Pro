// [R223] helpers de página compartidos por los scripts de verificación (snapshot, solapes, arrastres sintéticos)
import { fn } from './lib.mjs';
export async function installHelpers() {
  await fn(`
  window.__snap = () => state.clips.map(c=>({id:c.id,lane:c.lane,start:+c.start.toFixed(3),dur:+c.dur.toFixed(3),
    inP:+(c.inP||0).toFixed(3),fi:+(c.fadeIn||0).toFixed(3),fo:+(c.fadeOut||0).toFixed(3),role:c.avRole||null,name:c.name}));
  window.__ovl = li => { const cs=state.clips.filter(c=>c.lane===li).sort((a,b)=>a.start-b.start); const o=[];
    for(let i=0;i<cs.length-1;i++){ const s=Math.max(cs[i].start,cs[i+1].start), e=Math.min(cs[i].start+cs[i].dur,cs[i+1].start+cs[i+1].dur);
      if(e>s+1e-4)o.push({a:cs[i].id,b:cs[i+1].id,from:+s.toFixed(3),to:+e.toFixed(3),len:+(e-s).toFixed(3)}); } return o; };
  window.__dragClip = async (id, dSec, dLane) => { const cd=document.querySelector('.clip[data-clip="'+id+'"]'); const r=cd.getBoundingClientRect();
    const tt=cd.querySelector('.tt'); const x0=r.left+Math.min(40,r.width/2), y0=r.top+4;
    let y1=y0; if(dLane!=null){ const row=document.querySelector('#tracks .lane[data-lane="'+dLane+'"]'); const rr=row.getBoundingClientRect(); y1=rr.top+rr.height/2; }
    (tt||cd).dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:x0,clientY:y0}));
    const x1=x0+dSec*state.tl.pxPerSec;
    window.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:x1,clientY:y1}));
    await new Promise(r=>setTimeout(r,50));
    window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:x1,clientY:y1}));
    await new Promise(r=>setTimeout(r,180)); };
  window.__dragEdge = async (id, side, dSec) => { const cd=document.querySelector('.clip[data-clip="'+id+'"]');
    const hd=cd.querySelector('.hd.'+side); const r=hd.getBoundingClientRect(); const x0=r.left+r.width/2, y0=r.top+r.height/2;
    hd.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:x0,clientY:y0}));
    const x1=x0+dSec*state.tl.pxPerSec;
    window.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:x1,clientY:y0}));
    await new Promise(r=>setTimeout(r,50));
    window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:x1,clientY:y0}));
    await new Promise(r=>setTimeout(r,180)); };
  window.__dragFade = async (id, which, dSec) => { const cd=document.querySelector('.clip[data-clip="'+id+'"]');
    const fh=cd.querySelector('.fadeh.'+(which==='fadeOut'?'fadeR':'fadeL')); const r=fh.getBoundingClientRect();
    const x0=r.left+r.width/2, y0=r.top+4;
    fh.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:x0,clientY:y0}));
    const x1=x0+dSec*state.tl.pxPerSec;
    window.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:x1,clientY:y0}));
    await new Promise(r=>setTimeout(r,60));
    window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:x1,clientY:y0}));
    await new Promise(r=>setTimeout(r,200)); };
  return true;
`);
}
