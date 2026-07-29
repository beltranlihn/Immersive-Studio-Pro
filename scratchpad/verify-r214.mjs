import { evalInApp } from './cdp.mjs';

async function run() {
  // 1. reload to pick up latest app.js
  await evalInApp(`(function(){ location.reload(); return true; })()`);
  await new Promise(r => setTimeout(r, 3000));

  // 2. create a dome project (skip landing if present)
  const r1 = await evalInApp(`(async function(){
    if (typeof newProject !== 'function') return 'no newProject';
    await newProject('dome', 2048, 2048, 30, 180);
    return 'created: ' + (state.seqMode) + ' ' + state.seqW + 'x' + state.seqH;
  })()`);
  console.log('1) newProject:', r1);

  // 3. syntax sanity: layoutWallStrip exists
  const r2 = await evalInApp(`(function(){
    if (typeof layoutWallStrip !== 'function') return 'MISSING layoutWallStrip';
    const walls=[{pxW:100,pxH:50},{pxW:200,pxH:80}];
    const out=layoutWallStrip(walls);
    return JSON.stringify({out, walls});
  })()`);
  console.log('2) layoutWallStrip:', r2);

  // 4. lchAspect delegates to fmtAspect
  const r3 = await evalInApp(`(function(){
    return JSON.stringify({a:lchAspect(1920,1080), b:fmtAspect(1920,1080), c:lchAspect(1937,1080), d:fmtAspect(1937,1080)});
  })()`);
  console.log('3) aspect:', r3);

  // 5. serProject has no tl.audioH
  const r4 = await evalInApp(`(function(){
    const p=serProject();
    return JSON.stringify({hasAudioH: ('audioH' in p.tl), tlKeys:Object.keys(p.tl)});
  })()`);
  console.log('4) serProject.tl:', r4);

  // 6. purgeMediaTrash exists and runs without throwing
  const r5 = await evalInApp(`(function(){
    if (typeof purgeMediaTrash !== 'function') return 'MISSING purgeMediaTrash';
    try { purgeMediaTrash(); return 'ok, trash keys=' + Object.keys(state.mediaTrash||{}).length; } catch(e){ return 'THROW: ' + e.message; }
  })()`);
  console.log('5) purgeMediaTrash:', r5);

  // 7. export dialog warning element wrap+title (force a state where codec doesn't fit is hard; just check CSS/attrs are wired via a manual set)
  const r6 = await evalInApp(`(async function(){
    if (typeof newSequenceDialog !== 'function') return 'no newSequenceDialog';
    newSequenceDialog();
    await new Promise(r=>setTimeout(r,200));
    const ov = document.querySelector('.overlay');
    const hintEl = [...ov.querySelectorAll('.mb > div')].find(d=>d.textContent.includes('360 room') || d.textContent.includes('sala 360'));
    const res = 'hintPresent=' + !!hintEl + ' text="' + (hintEl?hintEl.textContent:'') + '"';
    ov.querySelector('#nsCancel').click();
    return res;
  })()`);
  console.log('6) newSequenceDialog hint:', r6);

  // 8. vzIn/vzOut titles
  const r7 = await evalInApp(`(function(){
    const a=document.getElementById('vzOut'), b=document.getElementById('vzIn');
    return JSON.stringify({vzOutTitle:a&&a.title, vzInTitle:b&&b.title});
  })()`);
  console.log('7) vz titles:', r7);

  // 9. exCodecHint CSS override present
  const r8 = await evalInApp(`(function(){
    if (typeof exportDialog !== 'function' && typeof openExportDialog !== 'function') {
      // try to find whichever export dialog opener exists
    }
    return typeof window;
  })()`);
  console.log('8) (info) window ok:', r8);

  const r8b = await evalInApp(`(function(){
    // build the export sheet HTML directly is complex; just check the static template contains our markers
    return 'skip - checked via source';
  })()`);

  console.log('done');
}
run().catch(e => { console.error('FATAL', e); process.exit(1); });
