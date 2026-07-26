import { targets } from './cdp.mjs';
const wait = ms => new Promise(r => setTimeout(r, ms));
let idx = null;
for (let i = 0; i < 120; i++) { const l = await targets(9222).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(150); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws')); });
let _id = 0;
const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) return { THREW: JSON.stringify(r.exceptionDetails).slice(0, 400) }; return r.result.value; };
const errs = [];
await send('Runtime.enable', {});
ws.addEventListener('message', ev => { const x = JSON.parse(ev.data); if (x.method === 'Runtime.consoleAPICalled' && x.params.type === 'error') errs.push((x.params.args || []).map(a => a.value || a.description || '').join(' ').slice(0, 300)); });
await send('Page.reload', { ignoreCache: true }); await wait(1900);
for (let i = 0; i < 60; i++) { const r = await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")'); if (r === true) break; await wait(400); }
await evl(`(()=>{ try{localStorage.setItem('dspOnboardV1','1')}catch(e){} document.querySelectorAll('.overlay,#tourOv,#landingOv').forEach(o=>o.remove()); document.body.classList.remove('preboot'); try{resize();}catch(e){} return 1; })()`);
await evl(`(async()=>{ await buildDemoProject(); const c=state.clips[1]||state.clips[0]; state.selIds=[c.id]; state.selId=c.id; renderInspector(); return 1; })()`);
await wait(700);
console.log('erroresConsola:', errs.length ? errs : 'ninguno');
console.log(JSON.stringify(await evl(`(()=>{
  const c=selClip(); const m=c&&mediaById(c.mediaId);
  const out={ clip:!!c, mediaKind:m&&m.kind, isFlat:isFlat(), TF:(typeof TF!=='undefined'&&TF.length), TF_FLAT:(typeof TF_FLAT!=='undefined'&&TF_FLAT.length),
    tfRowsAntes:document.querySelectorAll('#tfRows .prow').length, secTfDisplay:getComputedStyle(document.getElementById('secTf')).display };
  try{ buildRows('#tfRows', isFlat()?TF_FLAT:TF, c); out.tfRowsTrasLlamar=document.querySelectorAll('#tfRows .prow').length; }
  catch(e){ out.buildRowsError=String(e&&e.message).slice(0,200); }
  return out;
})()`), null, 2));
ws.close();
