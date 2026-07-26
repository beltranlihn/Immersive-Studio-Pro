// ¿el .exe EMPAQUETADO trae R178? Recorrido por formato + barra vertical.
import { targets } from './cdp.mjs';
const wait = ms => new Promise(r => setTimeout(r, ms));
let idx = null;
for (let i = 0; i < 300; i++) { const l = await targets(9223).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(150); }
if (!idx) { console.log('el .exe no expuso la ventana'); process.exit(1); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws')); });
let _id = 0;
const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
const errs = []; await send('Runtime.enable', {});
ws.addEventListener('message', ev => { const x = JSON.parse(ev.data);
  if (x.method === 'Runtime.consoleAPICalled' && x.params.type === 'error') errs.push((x.params.args || []).map(a => a.value || a.description || '').join(' ').slice(0, 180));
  if (x.method === 'Runtime.exceptionThrown') errs.push('excepción: ' + ((x.params.exceptionDetails.exception && x.params.exceptionDetails.exception.description) || '').slice(0, 180)); });
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 250) }; return r.result.value; };
for (let i = 0; i < 90; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await wait(1200);

console.log('arranque limpio:', JSON.stringify(await evl(`({ launcher:!!document.getElementById('landingOv'), tour:!!document.getElementById('tourOv') })`)));

console.log('\ncrear domo →', JSON.stringify(await evl(`(async()=>{
  try{ ['dome','flat','room'].forEach(f=>localStorage.removeItem('dspTour_'+f)); }catch(e){}
  if(!document.getElementById('landingOv')) showLanding();
  await new Promise(r=>setTimeout(r,400));
  _lch.ptype='dome'; lchCreate(); await new Promise(r=>setTimeout(r,2400));
  const ov=document.getElementById('tourOv'); const t=ov?(ov.textContent||'').replace(/\\s+/g,' ').trim():'';
  return { tour:!!ov, textoDeDomo:/fisheye|azimut|azimuth/i.test(t), inicio:t.slice(0,70) }; })()`), null, 1));

console.log('\nbarra vertical:', JSON.stringify(await evl(`(()=>{
  const ov=document.getElementById('tourOv'); if(ov)ov.remove();
  const R=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {top:Math.round(r.top),bottom:Math.round(r.bottom)};};
  const b=R('#tlVZoom'), rg=R('#rulerCv'), pn=R('.timeline');
  return { puntos:document.querySelectorAll('#tlVZoom .tlvzcap').length,
    invadeLaRegla: b&&rg? b.top<rg.bottom : null,
    llegaAbajo: b&&pn? Math.abs(b.bottom-pn.bottom)<2 : null,
    recuperaAlAgrandar: (()=>{ // plegar y volver, por código: es la regla que fallaba
      const base=state.lanes.map(l=>l.h||(l.kind==='audio'?AUDIO_LANE_H:LANE_DEF_H));
      state.lanes.forEach(l=>{l.collapsed=true;});
      state.lanes.forEach((l,i)=>{ const suelo=laneFloorH(l); const nh=Math.round(base[i]*1.6);
        if(l.collapsed){ if(nh>=suelo){ l.collapsed=false; l.h=Math.max(suelo,Math.min(LANE_MAX_H,nh)); } return; } });
      const ok=state.lanes.every(l=>!l.collapsed); state.lanes.forEach((l,i)=>{l.h=base[i];l.collapsed=false;}); renderTimeline(); return ok; })() }; })()`), null, 1));
await wait(400);
console.log('\nerrores de consola en el .exe:', errs.length ? errs : 'ninguno');
ws.close();
