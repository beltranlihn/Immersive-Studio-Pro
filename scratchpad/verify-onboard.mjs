// [D7] Verify onboarding: build demo + tour, inspect DOM/state, screenshot the overlay.
import { targets, evalInApp } from './cdp.mjs';

async function screenshot(path, port=9222){
  const list = await targets(port); const page = list.find(t=>t.type==='page'&&t.webSocketDebuggerUrl);
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res,rej)=>{ ws.onopen=res; ws.onerror=()=>rej(new Error('ws fail')); });
  const send=(id,method,params)=>new Promise((res,rej)=>{ const h=ev=>{ const m=JSON.parse(ev.data); if(m.id!==id)return; ws.removeEventListener('message',h); m.error?rej(new Error(JSON.stringify(m.error))):res(m.result); }; ws.addEventListener('message',h); ws.send(JSON.stringify({id,method,params})); });
  const r = await send(1,'Page.captureScreenshot',{format:'png'});
  const fs = await import('fs'); fs.writeFileSync(path, Buffer.from(r.data,'base64'));
  ws.close();
}

const step = process.argv[2]||'build';

if(step==='build'){
  const r = await evalInApp(`(async()=>{
    try{ localStorage.removeItem('dspOnboardV1'); }catch(e){}
    if(_tourStop)_tourStop();
    await startOnboarding();
    const ov=document.getElementById('tourOv');
    const card=ov&&ov.querySelector('div:last-child');
    const shapeClips=state.clips.filter(c=>{const m=mediaById(c.mediaId);return m&&(m.kind==='shape'||m.kind==='text');});
    return { tour: !!ov, clips: state.clips.length, shapeAndText: shapeClips.length,
             kinds: state.media.map(m=>m.kind).join(','), seqMode: state.seqMode, playhead: state.playhead,
             cardText: card?card.textContent.slice(0,90):null, done_now: onboardDone() };
  })()`);
  console.log(JSON.stringify(r,null,1));
  await screenshot('scratchpad/onboard-1.png');
  console.log('wrote scratchpad/onboard-1.png');
}
else if(step==='inspector'){ // advance to the inspector step (index 3) and shoot
  const r = await evalInApp(`(()=>{ const nx=document.querySelector('#tourNext'); return !!nx; })()`);
  // click Next 3 times via dispatched clicks
  await evalInApp(`(()=>{ for(let k=0;k<3;k++){ const b=document.querySelector('#tourNext'); if(b)b.click(); } return document.querySelector('#tourOv div:last-child').textContent.slice(0,60); })()`);
  await screenshot('scratchpad/onboard-inspector.png');
  console.log('advanced, wrote scratchpad/onboard-inspector.png');
}
else if(step==='finish'){
  const r = await evalInApp(`(()=>{
    // step to the last, click Done, verify flag + overlay gone
    for(let k=0;k<6;k++){ const b=document.querySelector('#tourNext'); if(b)b.click(); }
    return { overlayGone: !document.getElementById('tourOv'), done: onboardDone() };
  })()`);
  console.log(JSON.stringify(r));
}
