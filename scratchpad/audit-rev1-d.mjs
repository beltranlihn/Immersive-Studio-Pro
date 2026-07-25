// AUDITORÍA REDISEÑO Rev 1 — parte D: cierre de huecos.
// header de item del inspector + barra de color del clip · waveform de audio · desplazamiento 2D↔3D
// de la barra del visor · umbral de labels de la Create row · dónde vive el toggle .iosw.
import { targets } from './cdp.mjs';
import fs from 'fs';
const page = (await targets(9222)).find(t => t.type === 'page' && t.webSocketDebuggerUrl);
if (!page) { console.log('no page'); process.exit(1); }
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws')); });
let _id = 0;
const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error('threw: ' + JSON.stringify(r.exceptionDetails).slice(0, 500)); return r.result.value; };
const wait = ms => new Promise(r => setTimeout(r, ms));

// --- 1. desplazamiento de los grupos del visor entre 2D y 3D ---
const pos = async () => evl(`(()=>{ const vp=document.querySelector('.vptool'); const g={}; for(const c of vp.children){ const k=c.id||null; if(!k) continue; const cs=getComputedStyle(c); g[k]={x:Math.round(c.getBoundingClientRect().x), vis:cs.display!=='none'}; } return {mode:state.view.mode, g}; })()`);
await evl(`(()=>{ const b=document.querySelector('#viewModeSeg button[data-m="2d"]')||document.querySelector('#viewModeSeg button'); if(b)b.click(); return 1; })()`); await wait(500);
const p2d = await pos();
await evl(`(()=>{ const b=document.querySelector('#viewModeSeg button[data-m="3d"]')||document.querySelector('#viewModeSeg button:last-child'); if(b)b.click(); return 1; })()`); await wait(700);
const p3d = await pos();
await evl(`(()=>{ const b=document.querySelector('#viewModeSeg button[data-m="2d"]')||document.querySelector('#viewModeSeg button'); if(b)b.click(); return 1; })()`); await wait(500);

// --- 2. umbral de labels de la Create row: ensanchar el panel Media ---
const crAt = async w => evl(`(()=>{ const p=document.getElementById('mediaPane'); p.style.width='${w}px'; void p.offsetWidth;
  const l=document.querySelector('#importBtn .crlbl'); return {paneW:${w}, labelShown: l? getComputedStyle(l).display!=='none' : null}; })()`);
const thr = [];
for (const w of [292, 310, 322, 330, 360]) { thr.push(await crAt(w)); await wait(120); }
await evl(`(()=>{ document.getElementById('mediaPane').style.width='292px'; return 1; })()`);

// --- 3. añadir un clip de AUDIO para auditar el waveform y la lane de audio ---
await evl(`(async()=>{
  const m={id:uid(),kind:'audio',name:'Audit tone',dur:6,missing:false,_loading:false,color:'#5A8D7E'};
  state.media.push(m);
  const li=state.lanes.findIndex(l=>l.kind==='audio');
  if(li>=0){ addClip(m, li, 0); }
  renderMedia(); renderTimeline(); return 1;
})()`);
await wait(800);

const out = await evl(`(()=>{
  const R = el => { if(!el) return null; const b=el.getBoundingClientRect(); return {w:Math.round(b.width*10)/10,h:Math.round(b.height*10)/10}; };
  const hex = c => { if(!c) return c; const m=c.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/); return m? '#'+[m[1],m[2],m[3]].map(n=>(+n).toString(16).padStart(2,'0')).join('').toUpperCase() : c; };
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];

  // header de item del inspector: volcamos los primeros hijos de #insCtl para ver qué hay realmente
  const insCtl=$('#insCtl');
  const insTop = insCtl? [...insCtl.children].slice(0,6).map(c=>({tag:c.tagName.toLowerCase(), id:c.id||null, cls:(typeof c.className==='string'?c.className:''),
      h:Math.round(c.getBoundingClientRect().height*10)/10, txt:(c.textContent||'').trim().replace(/\\s+/g,' ').slice(0,44)})) : null;
  // ¿hay una franja de color de clip en algún lado del inspector?
  const stripCands = insCtl? [...insCtl.querySelectorAll('*')].filter(e=>{const b=e.getBoundingClientRect(); return b.height>0 && b.height<=6 && b.width>200;})
      .slice(0,4).map(e=>({cls:(typeof e.className==='string'?e.className:''), h:Math.round(e.getBoundingClientRect().height*10)/10, bg:hex(getComputedStyle(e).backgroundColor)})) : null;

  // waveform + lane de audio
  const audClip = $('.clip.audioclip') || $$('.clip').find(c=>c.className.includes('audio'));
  const audio = { clipFound: !!audClip,
    svg: audClip? audClip.querySelectorAll('svg').length : 0,
    waveEl: audClip? [...audClip.querySelectorAll('*')].map(e=>e.tagName.toLowerCase()+'.'+(typeof e.className==='string'?e.className:(e.className.baseVal||''))).slice(0,10) : null,
    laneH: (()=>{ const h=$$('#laneHeaders .lanehdr').find(x=>x.classList.contains('aud')); return h? Math.round(h.getBoundingClientRect().height*10)/10 : null; })(),
    resizeGrip: (()=>{ const h=$$('#laneHeaders .lanehdr').find(x=>x.classList.contains('aud')); return h? !!h.querySelector('[data-m=resize]') : null; })(),
    collapseBtn: (()=>{ const h=$$('#laneHeaders .lanehdr').find(x=>x.classList.contains('aud')); return h? !!h.querySelector('[data-m=collapse]') : null; })()
  };

  // dónde vive el toggle .iosw (spec §0: 26×15 verde)
  const iosw = $$('.iosw').map(s=>({parent:(s.parentElement||{}).className||'', size:R(s), on:s.classList.contains('on')}));
  const ioswCSS = (()=>{ for(const sh of document.styleSheets){ try{ for(const r of sh.cssRules){ if(r.selectorText==='.iosw') return r.style.cssText.slice(0,160); } }catch(e){} } return 'no hallada'; })();

  return { insTop, stripCands, audio, iosw, ioswCSS };
})()`);

const res = { viewerBarShift: { p2d, p3d }, createRowThreshold: thr, ...out };
fs.writeFileSync('scratchpad/audit-rev1-d.json', JSON.stringify(res, null, 2));
console.log(JSON.stringify(res, null, 2));
ws.close();
