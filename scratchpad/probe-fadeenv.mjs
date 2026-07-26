import { targets } from './cdp.mjs';
const wait = ms => new Promise(r => setTimeout(r, ms));
const l = await targets(9222);
const idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || ''));
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws')); });
let _id = 0;
const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true }); if (r.exceptionDetails) throw new Error('threw: ' + JSON.stringify(r.exceptionDetails).slice(0, 300)); return r.result.value; };
await evl(`(()=>{ if(state.inlineCurves){const b=document.getElementById('curvesBtn'); if(b)b.click();} return 1; })()`);
await wait(500);
console.log(JSON.stringify(await evl(`(()=>{
  const out=[];
  document.querySelectorAll('#tracks .clip').forEach((cd,i)=>{ if(i>2)return;
    const b=cd.getBoundingClientRect();
    const sv=cd.querySelector('svg.fadeenv');
    const pl=sv&&sv.querySelector('polyline');
    const c=state.clips.find(x=>x.id===+cd.dataset.clip);
    out.push({ clip:cd.dataset.clip, nombre:c&&c.name, fadeIn:c&&c.fadeIn, fadeOut:c&&c.fadeOut,
      clipW:Math.round(b.width), clipH:Math.round(b.height),
      svgAttrW:sv&&sv.getAttribute('width'), svgAttrH:sv&&sv.getAttribute('height'), viewBox:sv&&sv.getAttribute('viewBox'),
      svgCssW:sv&&Math.round(sv.getBoundingClientRect().width), svgCssH:sv&&Math.round(sv.getBoundingClientRect().height),
      puntos:pl&&pl.getAttribute('points'),
      otrosSvg:[...cd.querySelectorAll('svg')].map(s=>s.getAttribute('class')||'(sin clase)') }); });
  return out;
})()`), null, 2));
ws.close();
