// AUDITORÍA REDISEÑO Rev 1 — parte C: §5 transport + §6 timeline + §7 status
// + residual 2D↔3D de la barra del visor + colores de la sección Color + header de item del inspector.
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
const errors = [];
await send('Runtime.enable', {});
ws.addEventListener('message', ev => { const x = JSON.parse(ev.data); if (x.method === 'Runtime.consoleAPICalled' && x.params.type === 'error') errors.push((x.params.args || []).map(a => a.value || a.description || '').join(' ')); });

// --- residual 2D↔3D: medir el ancho usado de la barra del visor en cada modo ---
const bar2d = await evl(`(()=>{ const vp=document.querySelector('.vptool'); const used=[...vp.children].filter(c=>getComputedStyle(c).display!=='none').reduce((s,c)=>s+c.getBoundingClientRect().width,0); return {mode:state.view.mode, used:Math.round(used), bar:Math.round(vp.getBoundingClientRect().width), scrollW:vp.scrollWidth, clientW:vp.clientWidth}; })()`);
await evl(`(()=>{ const b=document.querySelector('#viewModeSeg button[data-m="3d"]')||document.querySelector('#viewModeSeg button:last-child'); if(b)b.click(); return 1; })()`);
await wait(700);
const bar3d = await evl(`(()=>{ const vp=document.querySelector('.vptool'); const used=[...vp.children].filter(c=>getComputedStyle(c).display!=='none').reduce((s,c)=>s+c.getBoundingClientRect().width,0); return {mode:state.view.mode, used:Math.round(used), bar:Math.round(vp.getBoundingClientRect().width), scrollW:vp.scrollWidth, clientW:vp.clientWidth, overflow: vp.scrollWidth>vp.clientWidth, groupsVisible:[...vp.children].filter(c=>getComputedStyle(c).display!=='none').map(c=>c.id||c.className)}; })()`);
await evl(`(()=>{ const b=document.querySelector('#viewModeSeg button[data-m="2d"]')||document.querySelector('#viewModeSeg button'); if(b)b.click(); return 1; })()`);
await wait(500);

// --- activar modo automatización para auditar cabeceras + curvas ---
await evl(`(()=>{ if(!state.inlineCurves){ const b=document.getElementById('curvesBtn'); if(b)b.click(); } return state.inlineCurves; })()`);
await wait(600);

const out = await evl(`(()=>{
  const R = el => { if(!el) return null; const b=el.getBoundingClientRect(); return {w:Math.round(b.width*10)/10,h:Math.round(b.height*10)/10}; };
  const hex = c => { if(!c) return c; const m=c.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/); return m? '#'+[m[1],m[2],m[3]].map(n=>(+n).toString(16).padStart(2,'0')).join('').toUpperCase() : c; };
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];

  // ---- §5 · TRANSPORT (3 zonas: secuencias | transporte | edición+zoom) ----
  const tr=$('.transport');
  const transport = {
    h: R(tr).h, bg: hex(getComputedStyle(tr).backgroundColor),
    zones: [...tr.children].filter(c=>getComputedStyle(c).display!=='none').map(c=>({id:c.id||null, cls:(typeof c.className==='string'?c.className:''), x:Math.round(c.getBoundingClientRect().x), w:Math.round(c.getBoundingClientRect().width), h:Math.round(c.getBoundingClientRect().height*10)/10, txt:(c.textContent||'').trim().replace(/\\s+/g,' ').slice(0,28)})),
    seqTabs: { inTransport: !!$('.transport #seqTabs'), h: R($('#seqTabs')) && R($('#seqTabs')).h,
               tabs: $$('#seqTabs .seqtab').map(t=>({txt:(t.textContent||'').trim().slice(0,18), on:t.classList.contains('on'), add:t.classList.contains('seqadd'), h:Math.round(t.getBoundingClientRect().height*10)/10})) },
    editSeg: { h: R($('#tlEditSeg')) && R($('#tlEditSeg')).h, bg:hex(getComputedStyle($('#tlEditSeg')).backgroundColor),
               btns: $$('#tlEditSeg button').map(b=>({id:b.id, txt:(b.textContent||'').trim(), on:b.classList.contains('on'), h:Math.round(b.getBoundingClientRect().height*10)/10})) },
    snapOutsideWell: !!($('#snapBtn') && !$('#snapBtn').closest('#tlEditSeg')),
    tcBox: (()=>{ const e=$('#tc'); return e? {txt:e.textContent.trim(), fs:getComputedStyle(e).fontSize, bg:hex(getComputedStyle(e.parentElement).backgroundColor)} : null; })(),
    zoomGrp: !!$('.zoomgrp')
  };

  // ---- §6 · TIMELINE ----
  const hdr0=$('.lanehdr');
  const timeline = {
    toolRailW: R($('#toolRail')) && R($('#toolRail')).w,
    trackHdrW: R($('#trackHdr')) && R($('#trackHdr')).w,
    rulerpadH: R($('#trackHdr .rulerpad')) && R($('#trackHdr .rulerpad')).h,
    rulerpadEmpty: (($('#trackHdr .rulerpad')||{}).textContent||'').trim()==='',
    // unificación: cuántas lanes hay en la columna principal y cuántas en el módulo viejo
    lanesInMain: $$('#laneHeaders .lanehdr').length,
    lanesInAudioZone: $$('#audioHeadZone .lanehdr').length,
    audioZoneDisplay: ($('#audioHeadZone')? getComputedStyle($('#audioHeadZone')).display : 'no existe'),
    audioBarPresent: !!$('.trackdivider.collapsible'),
    laneOrder: $$('#laneHeaders .lanehdr').map(h=>({tag:(h.querySelector('.ltag')||h.querySelector('[class*=tag]')||{}).textContent, aud:h.classList.contains('aud'), h:Math.round(h.getBoundingClientRect().height*10)/10})),
    // chips de automatización (2 chips: effect-type + parameter con swatch)
    autoChips: $$('.autoduo.txt').slice(0,3).map(d=>({chips:$$('.achip',d).length===0?[...d.querySelectorAll('.achip')].length:[...d.querySelectorAll('.achip')].length,
        labels:[...d.querySelectorAll('.alab')].map(l=>l.textContent.trim()),
        swatch:(()=>{const s=d.querySelector('.asw2'); return s? hex(getComputedStyle(s).backgroundColor):null;})(),
        truncated:[...d.querySelectorAll('.alab')].map(l=>l.scrollWidth>l.clientWidth+1)})),
    // fades = cuadraditos (border-radius 2px, no 50%)
    fadeHandle: (()=>{ const f=$('.clip .fadeh'); if(!f) return 'sin handle'; const cs=getComputedStyle(f,'::after'); return {radius:cs.borderRadius, w:cs.width, h:cs.height, top:cs.top}; })(),
    // V-zoom
    vzoom: { present:!!$('#tlVZoom'), w:R($('#tlVZoom')) && R($('#tlVZoom')).w, thumb:R($('#tlVZoomThumb')), visible: !!($('#tlVZoomThumb')||{}).offsetParent },
    // curva de automatización coloreada
    autoCurve: (()=>{ const c=$('.autocv,.lane canvas[class*=auto]'); return c? {found:true, w:Math.round(c.getBoundingClientRect().width)} : {found:false}; })(),
    waveform: $$('.clip svg.wave, .clip .wave').length,
    playheadW: (()=>{ const p=$('#playhead'); return p? getComputedStyle(p).width : null; })(),
    zoomBar: !!$('#tlZoomBar')
  };

  // ---- §7 · STATUS ----
  const st=$('.statusbar')||$('#statusBar')||$('.status');
  const status = st? { h:R(st).h, txt:(st.textContent||'').trim().replace(/\\s+/g,' ').slice(0,120), kids:[...st.children].map(c=>(c.textContent||'').trim().slice(0,26)).filter(Boolean) } : 'no encontrado';

  // ---- extra: colores de la sección Color + header de item del inspector ----
  const colorRows = $$('#colorRows .prow').map(r=>({lab:(r.querySelector('.lab')||{}).textContent, pc:(r.style.getPropertyValue('--pc')||'').trim()||null}));
  const itemHdr = (()=>{ const h=$('#insCtl .inshdr,#insCtl .itemhdr,#insHdr'); if(!h) return 'no encontrado (selector)';
      return {thumb:R(h.querySelector('img,canvas,.mthumb')), name:(h.querySelector('.nm,.name,b')||{}).textContent, meta:(h.querySelector('.mmeta,.selmeta')||{}).textContent}; })();
  const selMeta = (()=>{ const e=$('#selMeta'); return e? {txt:e.textContent.trim(), fs:getComputedStyle(e).fontSize, tt:getComputedStyle(e).textTransform, color:hex(getComputedStyle(e).color)} : null; })();

  return { transport, timeline, status, colorRows, itemHdr, selMeta };
})()`);

const res = { bar2d, bar3d, ...out };
fs.writeFileSync('scratchpad/audit-rev1-c.json', JSON.stringify(res, null, 2));
console.log(JSON.stringify(res, null, 2));
console.log('ERRORS:', errors.length ? errors : 'none');
ws.close();
