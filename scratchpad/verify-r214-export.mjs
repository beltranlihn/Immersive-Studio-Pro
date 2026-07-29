// Short real export via outPath to verify _exportCleanup (R214) doesn't break runExport.
import { evalInApp } from './cdp.mjs';

const SRC = 'C:\\Users\\beltr\\Desktop\\Rito Movie\\Asset\\Creation\\Front1.mp4';
const OUT = 'C:\\Users\\beltr\\AppData\\Local\\Temp\\claude\\r214-export';
const SRCq = JSON.stringify(SRC);
const OUTq = JSON.stringify(OUT);
const OUTFILEq = JSON.stringify(OUT + '\\out.mp4');

async function run() {
  console.log('setup:', await evalInApp(`(async()=>{
    document.querySelectorAll('.overlay,.exs-scrim').forEach(o=>o.remove());
    const as=activeSeq(); as.w=480; as.h=270; as.fps=30; state.fps=30; state.seqW=480; state.seqH=270; state.seqMode='flat';
    await DSP.ensureDir(${OUTq});
    const m=await addVideoFromPath(${SRCq},'Front1'); if(!m)return 'no media';
    state.clips=[]; const c=makeClip(m,1,0); c.start=0; c.dur=1; c.inP=3; state.clips.push(c);
    state.workIn=null; state.workOut=null; renderTimeline(); render();
    return 'ok media=' + m.id;
  })()`));

  console.log('run export:', await evalInApp(`(async()=>{
    const job={ label(){},prog(){},frame(){},wrote(){},fail(e){window._exErr=e;},done(v){window._exDone=v;} };
    window._exDone=undefined; window._exErr=undefined;
    await runExport({codec:'mp4',res:480,fps:30,bitrate:4,range:'clips',outPath:${OUTFILEq},job,silent:true});
    return JSON.stringify({exDone:window._exDone, exErr: window._exErr && String(window._exErr.message||window._exErr), exporting, _exportQuality, _exCD, _ncSquare});
  })()`, {timeout: 60000}));

  console.log('file:', await evalInApp(`(async()=>{try{const s=await DSP.stat(${OUTFILEq});return 'bytes='+s.size;}catch(e){return 'MISSING: '+e.message;}})()`));
}
run().catch(e=>{console.error('FATAL',e);process.exit(1);});
