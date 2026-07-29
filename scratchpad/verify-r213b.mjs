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

await step('seek 0 + render', `(()=>{ state.playhead=0; render(); return 'ok'; })()`);
await wait(200);
await step('play', `(()=>{ play(); return 'playing'; })()`);
await wait(5000);
await step('pause', `(()=>{ pause(); return {playhead:state.playhead}; })()`);

await step('errors+canvas', `(()=>{ const ctx=glc.getContext('webgl2'); let hasContent=false, px=[0,0,0,0]; try{ px=new Uint8Array(4); ctx.readPixels(glc.width>>1,glc.height>>1,1,1,ctx.RGBA,ctx.UNSIGNED_BYTE,px); hasContent=(px[0]+px[1]+px[2])>0; }catch(e){} return {errs:window.__errs, hasContent, px:Array.from(px)}; })()`);

await step('sanity reads', `(()=>{ return { lutRegSize:_lutReg.size, vinstSig:_vinstSig, ndiTickFn: typeof ndiTick, spoutTickFn: typeof spoutTick, mvpScratchLen:_mvpScratch.length, reconcileFn: typeof reconcileVinst }; })()`);

// programmatic drag of the clip on the timeline
await step('drag clip', `(async()=>{
  const cd=document.querySelector('.clip[data-clip]'); if(!cd) return 'no clip dom node';
  const title=cd.querySelector('.title')||cd;
  const r=title.getBoundingClientRect();
  const x0=r.left+Math.min(r.width-2,20), y0=r.top+r.height/2;
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
  await new Promise(res=>setTimeout(res,150));
  return {errs:window.__errs, dragCacheAfterUp: _dragLaneRects, clipStart: (clipById && clipById(state.selId))?clipById(state.selId).start:'n/a'};
})()`);

await step('LUT load smoke (identity fallback)', `(async()=>{ const c=state.clips[0]; if(!c)return 'no clip'; c.props=c.props||{}; c.props.lut='C:/nonexistent/fake.cube'; render(); return {errs:window.__errs}; })()`);

await step('final errors', `(()=>{ return window.__errs; })()`);
