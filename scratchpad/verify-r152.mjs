// Verifica R152: pistas audio/vídeo con el mismo comportamiento, barra vertical única, barra del visor responsiva.
import { targets } from './cdp.mjs';
import fs from 'fs';
const wait = ms => new Promise(r => setTimeout(r, ms));
let idx = null;
for (let i = 0; i < 120; i++) { const l = await targets(9222).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(150); }
if (!idx) { console.log('sin editor'); process.exit(1); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws')); });
let _id = 0;
const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error('threw: ' + JSON.stringify(r.exceptionDetails).slice(0, 400)); return r.result.value; };
const errors = [];
await send('Runtime.enable', {});
ws.addEventListener('message', ev => { const x = JSON.parse(ev.data); if (x.method === 'Runtime.consoleAPICalled' && x.params.type === 'error') errors.push((x.params.args || []).map(a => a.value || a.description || '').join(' ')); });

await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false, screenWidth: 1920, screenHeight: 1080 });
await send('Page.reload', { ignoreCache: true }); await wait(1700);
for (let i = 0; i < 60; i++) { try { if (await evl('typeof state!=="undefined" && !!document.getElementById("tracks")')) break; } catch (e) {} await wait(400); }
await evl(`(()=>{ try{localStorage.setItem('dspOnboardV1','1')}catch(e){} document.querySelectorAll('.overlay,#splashOv,#tourOv,#landingOv').forEach(o=>{try{if(o._stopLogo)o._stopLogo();}catch(e){}o.remove();}); document.body.classList.remove('preboot'); try{resize();}catch(e){} return 1; })()`);
await wait(300);
await evl(`(async()=>{ state.dirty=false; await buildDemoProject(); render(); renderTimeline(); return 1; })()`);
await wait(700);

const out = await evl(`(()=>{
  const R=el=>{ if(!el)return null; const b=el.getBoundingClientRect(); return {w:Math.round(b.width),h:Math.round(b.height)}; };
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const r={};
  // 1 · orden y alturas de pista
  r.constantes={LANE_DEF_H,LANE_MIN_H,LANE_MAX_H,LANE_COLLAPSED_H,AUDIO_LANE_H,RULER_H};
  r.lanes=$$('#laneHeaders .lanehdr').map(h=>({tag:(h.querySelector('.ltag')||h.querySelector('[class*=tag]')||{}).textContent, aud:h.classList.contains('aud'), h:Math.round(h.getBoundingClientRect().height), grip:!!h.querySelector('[data-m=resize]'), collapse:!!h.querySelector('[data-m=collapse]')}));
  r.reglaAlto=R($('#tracks').parentElement.querySelector('.ruler'));
  // 2 · lanesTopDown ya no particiona: mover el audio arriba debe reflejarse en pantalla
  const before=lanesTopDown().slice();
  const ai=state.lanes.findIndex(l=>l.kind==='audio');
  r.audioIdxAntes=ai;
  if(ai>=0){ const l=state.lanes.splice(ai,1)[0]; state.clips.forEach(c=>{ if(c.lane===ai)c.lane=-1; else if(c.lane>ai)c.lane--; });
    state.lanes.push(l); const ni=state.lanes.length-1; state.clips.forEach(c=>{ if(c.lane===-1)c.lane=ni; });
    renderTimeline(); }
  r.ordenTrasMover=$$('#laneHeaders .lanehdr').map(h=>h.classList.contains('aud')?'A':'V').join('');
  // 3 · barra vertical: una sola, con casquetes, y la nativa oculta
  const sc=$('#tlscroll');
  r.vbar={ existe:!!$('#tlVZoom'), thumb:R($('#tlVZoomThumb')), casquetes:$$('#tlVZoom .tlvzcap').length,
           anchoBarra:R($('#tlVZoom')) && R($('#tlVZoom')).w,
           nativaOculta: sc.offsetWidth-sc.clientWidth===0 };
  r.hbar={ existe:!!$('#tlZoomBar'), thumb:R($('#tlZoomThumb')), casquetes:$$('#tlZoomBar .tlzcap').length, anchoBarra:R($('#tlZoomBar')) && R($('#tlZoomBar')).h };
  return r;
})()`);

// 4 · barra del visor responsiva: medir a varios anchos de ventana
const bar = [];
for (const w of [1920, 1500, 1200, 900, 700]) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: 1000, deviceScaleFactor: 1, mobile: false, screenWidth: w, screenHeight: 1000 });
  await wait(320);
  bar.push(await evl(`(()=>{ try{updViewCtl();}catch(e){}
    const vis=s=>{const e=document.querySelector(s);return !!(e&&getComputedStyle(e).display!=='none');};
    const vp=document.querySelector('.vptool');
    return { win:innerWidth, vptool:Math.round(vp.getBoundingClientRect().width), overflow:vp.scrollWidth>vp.clientWidth+1,
      overlays:vis('#dispSeg'), calidad:vis('#qualitySeg'), output:vis('#outWell'), azel:vis('#azelReadout'), more:vis('#vpMoreBtn') }; })()`));
}
const res = { ...out, barraVisor: bar, consoleErrors: errors };
fs.writeFileSync('scratchpad/verify-r152.json', JSON.stringify(res, null, 2));
console.log(JSON.stringify(res, null, 2));
ws.close();
