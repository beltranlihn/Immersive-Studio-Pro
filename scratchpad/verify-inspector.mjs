// Verifica el inspector rediseñado: Master Grade fuera, secciones Source/Playback dentro, orden correcto, sin errores.
import { targets } from './cdp.mjs';
import fs from 'fs';
const page = (await targets(9222)).find(t => t.type === 'page' && t.webSocketDebuggerUrl);
if (!page) { console.log('no page — ¿bootea el .exe?'); process.exit(1); }
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws')); });
let _id = 0;
const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error('threw: ' + JSON.stringify(r.exceptionDetails).slice(0, 300)); return r.result.value; };
const wait = ms => new Promise(r => setTimeout(r, ms));

// capturar errores de consola
const errors = [];
await send('Runtime.enable', {});
ws.addEventListener('message', ev => { const x = JSON.parse(ev.data); if (x.method === 'Runtime.consoleAPICalled' && x.params.type === 'error') errors.push((x.params.args || []).map(a => a.value || a.description || '').join(' ')); });

for (let i = 0; i < 40; i++) { try { if (await evl('typeof state!=="undefined" && !!document.getElementById("insBody")')) break; } catch (e) {} await wait(400); }
await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false, screenWidth: 1920, screenHeight: 1080 });
await evl(`(()=>{ try{localStorage.setItem('dspOnboardV1','1')}catch(e){} document.querySelectorAll('.overlay,#splashOv,#tourOv').forEach(o=>{try{if(o._stopLogo)o._stopLogo();}catch(e){}o.remove();}); document.body.classList.remove('preboot'); try{resize();}catch(e){} render(); return 1; })()`);
await wait(400);

// construir demo + seleccionar un clip visual (shape) para poblar el inspector
await evl(`(async()=>{ state.dirty=false; await buildDemoProject(); const c=state.clips.find(x=>{const m=mediaById(x.mediaId);return m&&(m.kind==='shape'||m.kind==='video'||m.kind==='image');})||state.clips[0]; if(c){ state.selId=c.id; state.selIds=[c.id]; } renderInspector(); render(); return 1; })()`);
await wait(400);

// asserts estructurales
const info = await evl(`(()=>{
  const q=s=>document.querySelector(s);
  const vis=el=>{ if(!el)return 'absent'; const cs=getComputedStyle(el); return (cs.display==='none')?'hidden':'shown'; };
  const secOrder=[...document.querySelectorAll('#insCtl .sechead')].map(h=>h.querySelector('.t')?.textContent||h.id);
  return {
    insMaster: q('#insMaster')?'PRESENT (bad)':'absent (good)',
    secMaster: q('#secMaster')?'PRESENT (bad)':'absent (good)',
    secSource: vis(q('#secSource')), sourceRows: (q('#sourceRows')?.children.length)||0,
    secPlayback: vis(q('#secPlayback')), playbackRows: (q('#playbackRows')?.children.length)||0,
    secColor: vis(q('#secColor')), secMotion: vis(q('#secMotion')),
    sectionOrder: secOrder,
    selName: q('#selName')?.textContent,
    renderMasterGradeDefined: (typeof renderMasterGrade!=='undefined'),
    applyMasterGradeDefined: (typeof applyMasterGrade!=='undefined'),
    masterGradeOnDefined: (typeof masterGradeOn!=='undefined'),
  };
})()`);
console.log('INSPECTOR STRUCTURE:');
console.log(JSON.stringify(info, null, 2));

// screenshot del panel inspector (aprox. derecha)
const r = await send('Page.captureScreenshot', { format: 'png', clip: { x: 1610, y: 40, width: 310, height: 1000, scale: 1 } });
fs.writeFileSync('scratchpad/verify-inspector.png', Buffer.from(r.data, 'base64'));
console.log('  → scratchpad/verify-inspector.png');

console.log('CONSOLE ERRORS:', errors.length ? errors : 'none');
ws.close();
console.log('listo');
