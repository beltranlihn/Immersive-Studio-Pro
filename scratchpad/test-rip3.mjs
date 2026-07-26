// 3ª pasada, bien sincronizada: ¿pinta el preview del visor? ¿queda el clip en la pista más alta?
import { targets } from './cdp.mjs';
const wait = ms => new Promise(r => setTimeout(r, ms));
let idx = null;
for (let i = 0; i < 300; i++) { const l = await targets(9222).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(150); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws')); });
let _id = 0;
const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
const errs = []; await send('Runtime.enable', {});
ws.addEventListener('message', ev => { const x = JSON.parse(ev.data);
  if (x.method === 'Runtime.consoleAPICalled' && x.params.type === 'error') errs.push((x.params.args || []).map(a => a.value || a.description || '').join(' ').slice(0, 200));
  if (x.method === 'Runtime.exceptionThrown') errs.push('excepción: ' + ((x.params.exceptionDetails.exception && x.params.exceptionDetails.exception.description) || '').slice(0, 220)); });
const evl = async (e, t = 900000) => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, timeout: t }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 400) }; return r.result.value; };

console.log('estado limpio:', JSON.stringify(await evl(`(()=>{
  const src=state.clips.find(c=>c.lane===0)||state.clips[0]; if(!src)return{error:'sin clip'};
  state.clips=[src]; src.lane=0; src.inP=4.0; src.start=0; src.dur=1.0;
  state.lanes=state.lanes.filter(l=>!/^RIP|^Render /.test(l.name));
  state.media=state.media.filter(m=>!/rendered clips/i.test(m.path||''));
  renderMedia(); renderTimeline(); render();
  return { clips:state.clips.length, pistas:state.lanes.map(l=>l.name), mediosHorneados:state.media.filter(m=>/rendered clips/i.test(m.path||'')).length };
})()`), null, 1));

await evl(`(()=>{ window._ripP=renderInPlace(state.clips[0]); return true; })()`);
// esperar de verdad a que exista el botón
let listo = false;
for (let i = 0; i < 60; i++) { if (await evl(`!!document.getElementById('ripGo')`)) { listo = true; break; } await wait(300); }
console.log('diálogo listo:', listo);
await evl(`document.getElementById('ripGo').click()`);

// esperar a que exista el visor y muestrearlo
let visor = false;
for (let i = 0; i < 60; i++) { if (await evl(`!!document.getElementById('ripPv')`)) { visor = true; break; } await wait(250); }
console.log('visor abierto:', visor);
const muestras = [];
for (let i = 0; i < 200; i++) {
  const s = await evl(`(()=>{ const pv=document.getElementById('ripPv'); if(!pv)return null;
    const c=document.createElement('canvas'); c.width=48;c.height=48; const x=c.getContext('2d'); x.drawImage(pv,0,0,48,48);
    const d=x.getImageData(0,0,48,48).data; let s=0,mx=0,nz=0; for(let k=0;k<d.length;k+=4){const v=(d[k]+d[k+1]+d[k+2])/3; s+=v; if(v>mx)mx=v; if(v>8)nz++;}
    return { pct:(document.getElementById('ripPct')||{}).textContent, eta:(document.getElementById('ripEta')||{}).textContent, medio:+(s/(48*48)).toFixed(1), max:Math.round(mx), pxConLuz:nz }; })()`);
  if (!s) break;
  muestras.push(s);
  await wait(1500);
}
console.log('preview durante el render:'); muestras.forEach(m => console.log('   ', JSON.stringify(m)));
await wait(4000);

console.log('\ncolocación final:', JSON.stringify(await evl(`(async()=>{
  const m=state.media.filter(x=>/rendered clips/i.test(x.path||'')).pop();
  if(!m)return {error:'no se importó nada'};
  let st=null; try{ st=await DSP.stat(m.path); }catch(e){}
  const nc=state.clips.find(c=>c.mediaId===m.id);
  const orig=state.clips.find(c=>c.lane===0);
  return { archivo:m.path.split('\\\\').pop(), MB:st?+(st.size/1e6).toFixed(2):null, dim:m.w+'x'+m.h, dur:+(m.dur||0).toFixed(2),
    clipNuevo: nc?{pista:nc.lane, nombrePista:state.lanes[nc.lane].name, start:+nc.start.toFixed(2), dur:+nc.dur.toFixed(2), fulldome:!!nc.props.fulldome, esLaMasAlta:nc.lane===state.lanes.length-1}:null,
    originalSigueAhi: !!orig, totalClips:state.clips.length, tieneAudio:!!(m.el&&m.el.mozHasAudio) };
})()`), null, 1));
console.log('\nerrores:', errs.length ? errs.slice(0, 8) : 'ninguno');
ws.close();
