// Auditoría completa: mide en la app los mismos valores que declara el prototipo, región por región.
import { targets } from './cdp.mjs';
import fs from 'fs';
const wait = ms => new Promise(r => setTimeout(r, ms));
let idx = null;
for (let i = 0; i < 140; i++) { const l = await targets(9222).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(150); }
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
await send('Page.reload', { ignoreCache: true }); await wait(1800);
for (let i = 0; i < 60; i++) { try { if (await evl('typeof state!=="undefined" && !!document.getElementById("tracks")')) break; } catch (e) {} await wait(400); }
await evl(`(()=>{ try{localStorage.setItem('dspOnboardV1','1')}catch(e){} document.querySelectorAll('.overlay,#tourOv,#landingOv').forEach(o=>o.remove()); document.body.classList.remove('preboot'); try{resize();}catch(e){} return 1; })()`);
await wait(300);
await evl(`(async()=>{ state.dirty=false; await buildDemoProject(); render(); renderTimeline(); const c=state.clips.find(x=>x.kind!=='audio')||state.clips[0]; if(c){state.selIds=[c.id];state.selId=c.id;} renderInspector(); return 1; })()`);
await wait(800);

const out = await evl(`(()=>{
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const hex=c=>{ if(!c)return c; const m=c.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/); return m?'#'+[m[1],m[2],m[3]].map(n=>(+n).toString(16).padStart(2,'0')).join('').toUpperCase():c; };
  const M=(sel,el)=>{ el=el||$(sel); if(!el)return {FALTA:sel}; const b=el.getBoundingClientRect(), cs=getComputedStyle(el);
    return { w:Math.round(b.width*10)/10, h:Math.round(b.height*10)/10, pad:cs.padding, gap:cs.gap==='normal'?'':cs.gap,
      r:cs.borderRadius, fs:cs.fontSize, fw:cs.fontWeight, ls:cs.letterSpacing, bg:hex(cs.backgroundColor), col:hex(cs.color) }; };
  const r={};
  // §2 MEDIA
  r.media={ header:M('#mediaPane .panhead'), badge:M('#mediaCount'),
    viewWell:M('#mediaViewSeg'), viewBtn:M(null,$('#mediaViewSeg button')),
    filtWell:M('#filtSeg'), filtAll:M(null,$('#filtSeg button[data-f=all]')),
    sortBtn:M('#mediaSortBtn'), createRow:M('.crrow'), createImport:M('#importBtn'), createText:M('#textBtn'),
    list:M('#mediaList'), item:M(null,$('#mediaList .mitem')), thumb:M(null,$('#mediaList .mthumb')) };
  // §3 VISOR
  r.visor={ bar:M('.vptool'), modeWell:M('#viewModeSeg'), modeBtn:M(null,$('#viewModeSeg button')),
    modeLabels:$$('#viewModeSeg button').map(b=>b.textContent.trim()),
    dispWell:M('#dispSeg'), dispBtn:M(null,$('#dispSeg button')),
    dispLabels:$$('#dispSeg button').map(b=>({d:b.dataset.d,txt:b.textContent.trim()})),
    qWell:M('#qualitySeg'), qBtn:M(null,$('#qualitySeg button')),
    zoomWell:M(null,$('#vzOut')&&$('#vzOut').parentElement), zoomBtn:M('#vzOut'), zoomReset:M('#vzReset'),
    fov:M('#fovCtl'), dist:M('#distCtl') };
  // §4 INSPECTOR
  r.insp={ header:M('#inspTabs'), tabsWell:M('#inspTabs .well'), tab:M(null,$('#inspTabs .instab')),
    colorBar:M('#selColorBar'), selhead:M('.selhead'), selthumb:M('.selthumb'), selname:M('.selname'), selmeta:M('#selMeta'),
    sechead:M('#secTf'), secTitle:M(null,$('#secTf .t')),
    prow:M(null,$('#tfRows .prow')), plab:M(null,$('#tfRows .prow .lab')),
    ptrack:M(null,$('#tfRows .prow .track')), pnum:M(null,$('#tfRows .prow .num')), pkf:M(null,$('#tfRows .prow .kf')),
    mirror:M('#mirrorBtn') };
  // §5 TRANSPORT
  r.tr={ bar:M('.transport'), seqWell:M('#seqTabs'), seqTab:M(null,$('#seqTabs .seqtab')),
    tbtn:M('#markIn'), play:M('#playBtn'), tcbox:M('.tcbox'), tc:M('#tc'),
    tcMode:M('#tcModeSeg'), editSeg:M('#tlEditSeg'), zoomGrp:M('.zoomgrp'), zoomBtn:M('#tlZoomOut') };
  // §6 TIMELINE
  r.tl={ ruler:M('.ruler'), rulerpad:M('.trackhdr .rulerpad'), hdr:M('#trackHdr'), toolrail:M('#toolRail'),
    lane:M(null,$('#laneHeaders .lanehdr')), clip:M(null,$('#tracks .clip')), clipTitle:M(null,$('#tracks .clip .tt')),
    fade:(()=>{ const f=$('.clip .fadeh'); if(!f)return 'sin'; const cs=getComputedStyle(f,'::after'); return {w:cs.width,h:cs.height,r:cs.borderRadius,bg:hex(cs.backgroundColor),top:cs.top}; })(),
    playhead:M('#playhead'), hbar:M('#tlZoomBar'), htrack:M('#tlZoomTrack'), hthumb:M('#tlZoomThumb'),
    hcap:(()=>{const c=$('.tlzcap'); return c?M(null,c):'sin';})(),
    vbar:M('#tlVZoom'), vtrack:M('#tlVZoomTrack'), vthumb:M('#tlVZoomThumb'),
    vcap:(()=>{const c=$('.tlvzcap'); return c?M(null,c):'sin';})() };
  // §7 STATUS
  r.status=M('.status');
  return r;
})()`);
fs.writeFileSync('scratchpad/audit-full.json', JSON.stringify({ ...out, consoleErrors: errors }, null, 2));
console.log(JSON.stringify({ ...out, consoleErrors: errors }, null, 2));
ws.close();
