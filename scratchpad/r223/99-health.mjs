// [R223] salud final: sin errores, sin diálogos colgados, estado coherente
import { fn, shot, errs, close } from './lib.mjs';
const r = await fn(`
  return {
    errs: (window.__errs||[]).slice(),
    overlays: document.querySelectorAll('.overlay').length,
    menus: document.querySelectorAll('.menu,.lanecolpop').length,
    strayInputs: document.querySelectorAll('body > input').length,
    clips: state.clips.length, lanes: state.lanes.map(l=>l.kind).join(','),
    media: state.media.length, seqMode: state.seqMode, playing: state.playing,
    activeSeqOk: !!mediaById(state.activeSeqId),
    glLost: !!(gl && gl.isContextLost && gl.isContextLost()),
    glError: gl?gl.getError():null,
    render2d: (()=>{ try{ state.view.mode='2d'; render(); return 'ok'; }catch(e){ return 'ERR '+e.message; } })(),
    render3d: (()=>{ try{ state.view.mode='3d'; render(); state.view.mode='2d'; render(); return 'ok'; }catch(e){ return 'ERR '+e.message; } })(),
    timelineOk: (()=>{ try{ renderTimeline(); renderInspector(); updStatus(); return 'ok'; }catch(e){ return 'ERR '+e.message; } })()
  };
`, 60000);
console.log(JSON.stringify(r, null, 2));
console.log(await shot('r223-99-health'));
console.log('ERRS-after', JSON.stringify(await errs()));
close();
