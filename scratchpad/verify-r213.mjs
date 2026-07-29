import { evalInApp } from './cdp.mjs';

const step = async (label, expr, timeout = 30000) => {
  try {
    const r = await evalInApp(expr, { port: 9222, timeout });
    console.log('OK  ' + label + ' -> ' + JSON.stringify(r));
    return r;
  } catch (e) {
    console.log('ERR ' + label + ' -> ' + String(e));
    return null;
  }
};
const wait = ms => new Promise(r => setTimeout(r, ms));

// 1. reload to a clean state
await step('reload', `(async()=>{ location.reload(); return 'reloading'; })()`);
await wait(4000);

// 2. install error collector
await step('install collector', `(()=>{ window.__errs=[]; window.addEventListener('error',e=>{try{window.__errs.push(String((e&&e.message)||e));}catch(_){}}); window.addEventListener('unhandledrejection',e=>{try{window.__errs.push('unhandled: '+String(e.reason));}catch(_){}}); return 'ok'; })()`);

// 3. create a dome project
await step('newProject dome', `(async()=>{ await newProject('dome',4096,4096,30,180); return {seqMode:state.seqMode, clips:state.clips.length}; })()`);
await wait(500);

// 4. import an mp4 by path
const m = await step('addVideoFromPath', `(async()=>{ const m=await addVideoFromPath('C:\\\\Users\\\\beltr\\\\Downloads\\\\2.mp4','2.mp4'); return m?{id:m.id,name:m.name,w:m.w,h:m.h,dur:m.dur}:null; })()`, 25000);

// 5. add clip to timeline
await step('addClip', `(()=>{ const m=state.media.find(x=>x.name==='2.mp4'); if(!m)return 'no media'; const c=addClip(m,null,0); return c?{id:c.id,lane:c.lane,start:c.start,dur:c.dur}:'addClip failed'; })()`);
await wait(300);

// 6. play 5s
await step('play', `(()=>{ play(); return 'playing'; })()`);
await wait(5000);
await step('pause', `(()=>{ pause(); return {playhead:state.playhead}; })()`);

// 7. errors check + canvas has content
await step('errors+canvas', `(()=>{ const gl=glc.getContext?glc.getContext('webgl2'):null; let hasContent=false; try{ const px=new Uint8Array(4); const ctx=glc.getContext('webgl2'); ctx.readPixels(glc.width>>1,glc.height>>1,1,1,ctx.RGBA,ctx.UNSIGNED_BYTE,px); hasContent=(px[0]+px[1]+px[2]+px[3])>0; }catch(e){} return {errs:window.__errs, hasContent}; })()`);

// 8. reconcileVinst / LUT registry sanity read
await step('sanity reads', `(()=>{ return { lutRegSize:(typeof _lutReg!=='undefined')?_lutReg.size:'n/a', vinstSig:(typeof _vinstSig!=='undefined')?(_vinstSig&&_vinstSig.length):'n/a', ndiCacheKeyFn: typeof ndiTick, spoutCacheKeyFn: typeof spoutTick, mvpScratchLen:(typeof _mvpScratch!=='undefined')?_mvpScratch.length:'n/a' }; })()`);

// 9. programmatic drag of the clip on the timeline
await step('drag clip', `(async()=>{
  const cd=document.querySelector('.clip[data-clip]'); if(!cd) return 'no clip dom node';
  const title=cd.querySelector('.title')||cd;
  const r=title.getBoundingClientRect();
  const x0=r.left+r.width/2, y0=r.top+r.height/2;
  const down=new PointerEvent('pointerdown',{clientX:x0,clientY:y0,bubbles:true,cancelable:true,pointerId:1,button:0});
  title.dispatchEvent(down);
  await new Promise(res=>setTimeout(res,50));
  for(let i=1;i<=5;i++){
    const mv=new PointerEvent('pointermove',{clientX:x0+i*20,clientY:y0,bubbles:true,cancelable:true,pointerId:1});
    window.dispatchEvent(mv);
    await new Promise(res=>setTimeout(res,20));
  }
  const up=new PointerEvent('pointerup',{clientX:x0+100,clientY:y0,bubbles:true,cancelable:true,pointerId:1});
  window.dispatchEvent(up);
  await new Promise(res=>setTimeout(res,100));
  return {errs:window.__errs, dragCacheCleared: (typeof _dragLaneRects!=='undefined')?_dragLaneRects:'n/a'};
})()`);

await step('final errors', `(()=>{ return window.__errs; })()`);
