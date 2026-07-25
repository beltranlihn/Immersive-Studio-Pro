// Verifica el control Speed en la sección Playback para media temporal (video/audio/secuencia).
import { targets } from './cdp.mjs';
const page = (await targets(9222)).find(t => t.type === 'page' && t.webSocketDebuggerUrl);
if (!page) { console.log('no page'); process.exit(1); }
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws')); });
let _id = 0;
const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error('threw: ' + JSON.stringify(r.exceptionDetails).slice(0, 400)); return r.result.value; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const errors = [];
await send('Runtime.enable', {});
ws.addEventListener('message', ev => { const x = JSON.parse(ev.data); if (x.method === 'Runtime.consoleAPICalled' && x.params.type === 'error') errors.push((x.params.args || []).map(a => a.value || a.description || '').join(' ')); });

await send('Page.reload', { ignoreCache: true });
await wait(1400);
for (let i = 0; i < 50; i++) { try { if (await evl('typeof state!=="undefined" && typeof renderInspector!=="undefined" && !!document.getElementById("tracks")')) break; } catch (e) {} await wait(400); }
await evl(`(()=>{ document.querySelectorAll('.overlay,#splashOv,#tourOv').forEach(o=>{try{if(o._stopLogo)o._stopLogo();}catch(e){}o.remove();}); document.body.classList.remove('preboot'); try{resize();}catch(e){} return 1; })()`);
await evl(`(async()=>{ state.dirty=false; await buildDemoProject(); return 1; })()`);
await wait(400);

const out = await evl(`(()=>{
  const c = state.clips[1] || state.clips[0]; const m = mediaById(c.mediaId); const k0 = m.kind;
  // caso 1: shape/text estático → Playback debe estar oculto (sin speed)
  state.selId=c.id; state.selIds=[c.id]; renderInspector();
  const pbStatic = getComputedStyle(document.getElementById('secPlayback')).display;
  const speedStatic = !!document.getElementById('spRange');
  // caso 2: forzar kind='video' temporalmente → Playback muestra Speed
  m.kind='video'; renderInspector();
  const pbVid = getComputedStyle(document.getElementById('secPlayback')).display;
  const spRange = document.getElementById('spRange'); const spV0 = document.getElementById('spV');
  const initLabel = spV0 ? spV0.textContent : null;
  let after=null;
  if(spRange){ spRange.value='200'; spRange.dispatchEvent(new Event('input',{bubbles:true})); spRange.dispatchEvent(new Event('change',{bubbles:true})); after={ clipSpeed:c.speed, label:document.getElementById('spV')?.textContent }; }
  m.kind=k0; c.speed=1; renderInspector(); // restaurar
  return { staticKind:k0, playbackHiddenForStatic: pbStatic==='none', noSpeedForStatic: !speedStatic, playbackVisibleForVideo: pbVid!=='none', hasSpeedSlider: !!spRange, initialSpeedLabel: initLabel, afterSet200: after };
})()`);
console.log(JSON.stringify(out, null, 2));
console.log('ERRORS:', errors.length ? errors : 'none');
ws.close();
