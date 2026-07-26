// Arma un timeline de mentira (clips repartidos en V1-V4 + A1) y captura el editor.
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
await send('Page.enable', {});
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false, screenWidth: 1600, screenHeight: 900 });
await send('Page.reload', { ignoreCache: true }); await wait(1800);
for (let i = 0; i < 60; i++) { try { if (await evl('typeof state!=="undefined" && !!document.getElementById("tracks")')) break; } catch (e) {} await wait(400); }
await evl(`(()=>{ try{localStorage.setItem('dspOnboardV1','1')}catch(e){} document.querySelectorAll('.overlay,#tourOv,#landingOv').forEach(o=>o.remove()); document.body.classList.remove('preboot'); try{resize();}catch(e){} return 1; })()`);
await wait(400);

// escena de mentira: formas de colores repartidas por las pistas + un clip de audio
await evl(`(async()=>{
  state.dirty=false; await buildDemoProject();
  const SH=[['rect','#8A8D5A'],['ellipse','#A8924C'],['rect','#5A8D7E'],['line','#8A6FA8'],['ellipse','#A85A5A'],['rect','#5A7FA8']];
  const mk=(i)=>{ const m={id:uid(),kind:'shape',name:'Shape '+(i+1),shape:SH[i%SH.length][0],fill:SH[i%SH.length][1],stroke:'#0E0F11',strokeW:0,w:512,h:512,dur:6,missing:false,_loading:false,color:SH[i%SH.length][1]};
    state.media.push(m); return m; };
  const lay=[[0,0,4.5],[0,5.2,3.4],[1,1.2,5.0],[1,7.0,3.0],[2,0.6,6.2],[2,7.4,2.6],[3,2.0,4.0],[3,6.6,3.6]];
  const vids=state.lanes.map((l,i)=>i).filter(i=>state.lanes[i].kind!=='audio');
  lay.forEach((L,k)=>{ const m=mk(k); const li=vids[L[0]%vids.length]; if(li==null)return;
    const c={id:uid(),name:m.name,mediaId:m.id,lane:li,start:L[1],dur:L[2],inP:0,props:{},kf:{},color:m.color,fadeIn:0.4,fadeOut:0.5};
    state.clips.push(c); });
  const ai=state.lanes.findIndex(l=>l.kind==='audio');
  if(ai>=0){ const am={id:uid(),kind:'audio',name:'Ambient.wav',dur:11,missing:false,_loading:false,color:'#5A8D7E'};
    state.media.push(am); state.clips.push({id:uid(),name:am.name,mediaId:am.id,lane:ai,start:0.8,dur:9.4,inP:0,props:{},kf:{},color:'#5A8D7E'}); }
  state.playhead=3.1; state.tl.pxPerSec=96;
  const c0=state.clips.find(c=>c.lane===vids[1]); if(c0){ state.selIds=[c0.id]; state.selId=c0.id; }
  renderMedia(); renderTimeline(); renderInspector(); render(); return state.clips.length;
})()`);
await wait(900);

const shot = async (name, clip) => { const c = await send('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale: 1 } }); fs.writeFileSync('scratchpad/' + name + '.png', Buffer.from(c.data, 'base64')); };
// el modo automatización se persiste en el espacio de trabajo: forzarlo a OFF para el primer par de capturas
await evl(`(()=>{ if(state.inlineCurves){ const b=document.getElementById('curvesBtn'); if(b)b.click(); } return state.inlineCurves; })()`); await wait(600);
await shot('editor-full', { x: 0, y: 0, width: 1600, height: 900 });
const tlY = await evl(`Math.round(document.querySelector('.transport').getBoundingClientRect().y)`);
await shot('editor-timeline', { x: 0, y: tlY - 4, width: 1600, height: 900 - tlY + 4 });
// y el mismo timeline en modo automatizaciÃ³n, para ver que los fades desaparecen
await evl(`(()=>{ const b=document.getElementById('curvesBtn'); if(b&&!state.inlineCurves)b.click(); return state.inlineCurves; })()`);
await wait(700);
await shot('editor-automode', { x: 0, y: tlY - 4, width: 1600, height: 900 - tlY + 4 });
const chk = await evl(`(()=>({ fadesVisibles:[...document.querySelectorAll('.clip .fadeh')].filter(f=>getComputedStyle(f).display!=='none').length,
  automode:document.body.classList.contains('automode'), simpleBtn:!!document.getElementById('simpleClipBtn'),
  modb:document.querySelectorAll('.prow .modb').length, clips:state.clips.length }))()`);
console.log(JSON.stringify(chk, null, 2));
console.log('ERRORS:', errors.length ? errors : 'none');
ws.close();


