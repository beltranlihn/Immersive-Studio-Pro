// Caso 2D: ¿ofrece H.264 primero, coloca bien en rectangular y no rompe el export normal?
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

console.log('pasar a 2D 1920×1080:', JSON.stringify(await evl(`(()=>{
  const as=activeSeq(); as.w=1920; as.h=1080; as.fps=60; state.seqW=1920; state.seqH=1080; state.seqMode='flat';
  const src=state.clips.find(c=>c.lane===0)||state.clips[0];
  state.clips=[src]; src.lane=0; src.start=0; src.dur=1.0; src.inP=4.0;
  state.lanes=state.lanes.filter(l=>!/^RIP|^Render /.test(l.name));
  state.media=state.media.filter(m=>!/rendered clips/i.test(m.path||''));
  renderMedia(); renderTimeline(); render();
  return { esFlat:isFlat(), seq:state.seqW+'x'+state.seqH, clips:state.clips.length };
})()`), null, 1));

console.log('\ncódecs a 1920×1080:', JSON.stringify(await evl(`(async()=>{
  const o=await ripCodecOptions(1920,1080,60); return o.map(x=>x.kind+' → '+x.codec+' @ '+Math.round(x.bitrate/1e6)+' Mbps'); })()`), null, 1));

await evl(`(()=>{ window._ripP=renderInPlace(state.clips[0]); return true; })()`);
for (let i = 0; i < 60; i++) { if (await evl(`!!document.getElementById('ripGo')`)) break; await wait(300); }
console.log('\ndiálogo:', JSON.stringify(await evl(`(()=>{ const s=document.getElementById('ripFmt');
  return { elegido:s.options[s.selectedIndex].textContent, todas:[...s.options].map(o=>o.textContent), info:document.getElementById('ripInfo').textContent,
    aspectoPreview:null }; })()`), null, 1));
await evl(`document.getElementById('ripGo').click()`);
for (let i = 0; i < 60; i++) { if (await evl(`!!document.getElementById('ripPv')`)) break; await wait(250); }
console.log('lienzo del visor:', JSON.stringify(await evl(`(()=>{ const pv=document.getElementById('ripPv'); return pv?{w:pv.width,h:pv.height,ratio:+(pv.width/pv.height).toFixed(2)}:null; })()`)));
for (let i = 0; i < 120; i++) { if (!(await evl(`!!document.getElementById('ripPv')`))) break; await wait(1000); }
await wait(3500);

console.log('\nresultado 2D:', JSON.stringify(await evl(`(async()=>{
  const m=state.media.filter(x=>/rendered clips/i.test(x.path||'')).pop(); if(!m)return{error:'nada importado'};
  let st=null; try{ st=await DSP.stat(m.path); }catch(e){}
  const nc=state.clips.find(c=>c.mediaId===m.id);
  return { archivo:m.path.split('\\\\').pop(), MB:st?+(st.size/1e6).toFixed(2):null, dim:m.w+'x'+m.h, dur:+(m.dur||0).toFixed(2),
    clipNuevo:nc?{pista:nc.lane,nombrePista:state.lanes[nc.lane].name,start:+nc.start.toFixed(2),dur:+nc.dur.toFixed(2),fulldome:!!nc.props.fulldome,esLaMasAlta:nc.lane===state.lanes.length-1}:null,
    originalSigueAhi:!!state.clips.find(c=>c.lane===0), totalClips:state.clips.length };
})()`), null, 1));

// el export normal debe seguir intacto
console.log('\nexport normal (diálogo abre y ofrece códecs):', JSON.stringify(await evl(`(()=>{
  try{ openExport(); }catch(e){ return {ROTO:String(e)}; }
  const sel=document.getElementById('exCodec');
  const r={ abre:!!document.getElementById('exClose'), codecs:sel?[...sel.options].map(o=>o.value+':'+o.textContent.trim()):null };
  const cl=document.getElementById('exClose'); if(cl)cl.click();
  return r; })()`), null, 1));

console.log('\nerrores:', errs.length ? errs.slice(0, 8) : 'ninguno');
ws.close();
