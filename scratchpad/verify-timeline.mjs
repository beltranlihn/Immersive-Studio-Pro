// Verifica el timeline unificado: audio inline en #tracks/#laneHeaders (no en .audiozone), al fondo, sin barra "Audio".
import { targets } from './cdp.mjs';
import fs from 'fs';
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
await wait(1200);
for (let i = 0; i < 50; i++) { try { if (await evl('typeof state!=="undefined" && typeof render!=="undefined" && typeof renderTimeline!=="undefined" && !!document.getElementById("tracks")')) break; } catch (e) {} await wait(400); }
await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false, screenWidth: 1920, screenHeight: 1080 });
await evl(`(()=>{ try{localStorage.setItem('dspOnboardV1','1')}catch(e){} document.querySelectorAll('.overlay,#splashOv,#tourOv').forEach(o=>{try{if(o._stopLogo)o._stopLogo();}catch(e){}o.remove();}); document.body.classList.remove('preboot'); try{resize();}catch(e){} render(); return 1; })()`);
await wait(400);

// demo + asegurar una pista de audio (addLane('audio') si no hay); repartir clips
await evl(`(async()=>{ state.dirty=false; await buildDemoProject();
  if(!state.lanes.some(l=>l.kind==='audio')){ try{ addLane('audio'); }catch(e){} }
  renderTimeline(); render(); return 1; })()`);
await wait(500);

const info = await evl(`(()=>{
  const q=s=>document.querySelector(s), qa=s=>[...document.querySelectorAll(s)];
  const heads=qa('#laneHeaders .lanehdr').map(h=>({tag:h.querySelector('.tag')?.textContent, aud:h.classList.contains('aud'), y:Math.round(h.getBoundingClientRect().y)}));
  const audHead=q('#laneHeaders .lanehdr.aud');
  const lastHead=heads[heads.length-1];
  return {
    audiozoneInTracks: !!q('#tracks .audiozone') ? 'PRESENT (bad)' : 'absent (good)',
    audioHeadZoneVisible: (()=>{const z=q('#audioHeadZone'); if(!z)return 'absent'; return getComputedStyle(z).display==='none'?'hidden (good)':'shown (bad)';})(),
    trackDividerCount: qa('#tracks .trackdivider, #laneHeaders .trackdivider').length,
    laneHeaders: heads,
    audioHeaderInMainColumn: !!audHead ? 'yes (good)' : 'no audio lane',
    audioHeaderIsLast: audHead && lastHead && lastHead.aud ? 'yes (bottom, good)' : (audHead?'NOT last (bad)':'n/a'),
    lanesInTracks: qa('#tracks .lane').length,
    rulerPadLabel: q('#trackHdr .rulerpad')?.textContent || '(empty)',
    tracksOffsetH: q('#tracks').offsetHeight,
  };
})()`);
console.log('TIMELINE STRUCTURE:');
console.log(JSON.stringify(info, null, 2));

// screenshot del timeline completo (parte inferior)
const rect = await evl(`(()=>{const t=document.querySelector('.timeline').getBoundingClientRect();return [Math.round(t.x),Math.round(t.y),Math.round(t.width),Math.round(t.height)];})()`);
const cap = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: Math.max(0, rect[1]), width: 1920, height: Math.min(1080 - rect[1], rect[3] + 40), scale: 1 } });
fs.writeFileSync('scratchpad/verify-timeline.png', Buffer.from(cap.data, 'base64'));
console.log('  → scratchpad/verify-timeline.png');
console.log('CONSOLE ERRORS:', errors.length ? errors : 'none');
ws.close();
console.log('listo');
