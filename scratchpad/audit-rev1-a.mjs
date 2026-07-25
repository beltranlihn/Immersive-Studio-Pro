// AUDITORÍA REDISEÑO Rev 1 — parte A: §0 reglas globales + §1 top bar + §2 panel Media.
// Devuelve MEDICIONES (no juicios): alturas, superficies, uppercase residual, estructura del DOM.
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

await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false, screenWidth: 1920, screenHeight: 1080 });
await send('Page.reload', { ignoreCache: true });
await wait(1600);
for (let i = 0; i < 60; i++) { try { if (await evl('typeof state!=="undefined" && typeof renderTimeline!=="undefined" && !!document.getElementById("tracks")')) break; } catch (e) {} await wait(400); }
await evl(`(()=>{ try{localStorage.setItem('dspOnboardV1','1')}catch(e){} document.querySelectorAll('.overlay,#splashOv,#tourOv').forEach(o=>{try{if(o._stopLogo)o._stopLogo();}catch(e){}o.remove();}); document.body.classList.remove('preboot'); try{resize();}catch(e){} render(); return 1; })()`);
await wait(300);
await evl(`(async()=>{ state.dirty=false; await buildDemoProject(); render(); renderTimeline(); renderMedia(); return 1; })()`);
await wait(700);

const out = await evl(`(()=>{
  const R = el => { if(!el) return null; const b=el.getBoundingClientRect(); return {w:Math.round(b.width*10)/10,h:Math.round(b.height*10)/10,x:Math.round(b.x),y:Math.round(b.y)}; };
  const CS = (el,p) => el ? getComputedStyle(el)[p] : null;
  const hex = c => { if(!c) return c; const m=c.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/); return m? '#'+[m[1],m[2],m[3]].map(n=>(+n).toString(16).padStart(2,'0')).join('').toUpperCase() : c; };
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];

  // ---- §0 · UPPERCASE RESIDUAL (regla: sólo tolerado en micro-metadata gris de 10px) ----
  const upper=[];
  for(const el of $$('body *')){
    const cs=getComputedStyle(el);
    if(cs.textTransform!=='uppercase') continue;
    if(!el.offsetParent && cs.position!=='fixed') continue;              // sólo lo visible
    const txt=(el.textContent||'').trim().slice(0,28);
    if(!txt) continue;
    if(el.querySelector('*') && !el.matches('button,span,b,div.t,.lab')) continue; // evitar contenedores
    upper.push({ sel: el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+(el.className&&typeof el.className==='string'?'.'+el.className.trim().split(/\\s+/).slice(0,2).join('.'):''),
                 txt, fs: cs.fontSize, color: hex(cs.color) });
  }

  // ---- §0 · ALTURAS DE BARRA (deben ser 28px; status 22) ----
  const bars = {
    topbar:  R($('.topbar')||$('#topbar')),
    mediaHeader: R($('#mediaPane .panhead')),
    inspHeader:  R($('#inspTabs')),
    vptool:  R($('.vptool')),
    transport: R($('.transport')),
    status:  R($('.statusbar')||$('#statusBar')||$('.status'))
  };

  // ---- §0 · SUPERFICIES ----
  const surf = {
    panel: hex(CS($('#mediaPane'),'backgroundColor')),
    topbar: hex(CS($('.topbar')||$('#topbar'),'backgroundColor')),
    transport: hex(CS($('.transport'),'backgroundColor')),
    well: hex(CS($('.well'),'backgroundColor')),
    wellBtnOn: hex(CS($('.well button.on'),'backgroundColor')),
    timeline: hex(CS($('.timeline'),'backgroundColor'))
  };

  // ---- §0 · WELLS y CONTROLES (well 22px, botones internos 16px) ----
  const wells = $$('.well,.vseg,.editseg,.transport .seqtabs').filter(e=>e.offsetParent).map(w=>({
    id: w.id||('.'+(typeof w.className==='string'?w.className.trim().split(/\\s+/)[0]:'')),
    h: Math.round(w.getBoundingClientRect().height*10)/10,
    btnH: [...new Set([...w.querySelectorAll('button')].filter(b=>b.offsetParent).map(b=>Math.round(b.getBoundingClientRect().height*10)/10))],
    n: w.querySelectorAll('button').length
  }));

  // ---- §0 · TOGGLE SWITCH (26×15, knob 11px, verde al on) ----
  const sw = $('.iosw');
  const swKnob = sw && sw.querySelector('i');
  const toggle = sw ? { size:R(sw), knob:R(swKnob), onColor: getComputedStyle(document.documentElement).getPropertyValue('--toggle-on').trim() } : 'ningún .iosw visible ahora';

  // ---- §1 · TOP BAR ----
  const tb = $('.topbar')||$('#topbar');
  const topbar = {
    h: R(tb) && R(tb).h,
    children: tb ? [...tb.children].map(c=>({tag:c.tagName.toLowerCase(), id:c.id||null, cls:(typeof c.className==='string'?c.className:''), txt:(c.textContent||'').trim().slice(0,34), w:Math.round(c.getBoundingClientRect().width)})) : null,
    menubarButtons: $$('#menubar .menubtn').map(b=>b.textContent.trim()),
    removed: ['newBtn','openBtn','saveBtn','saveMenuBtn','exportBtn'].map(id=>({id, present: !!document.getElementById(id), visible: !!(document.getElementById(id)||{}).offsetParent })),
    viewModeSegInTopbar: !!(tb && tb.querySelector('#viewModeSeg'))
  };

  // ---- §2 · PANEL MEDIA ----
  const media = {
    header: { h: R($('#mediaPane .panhead')) && R($('#mediaPane .panhead')).h,
              hasViewWell: !!$('#mediaViewSeg'), viewWellIsWell: !!($('#mediaViewSeg')||{}).classList?.contains('well'),
              viewBtns: $$('#mediaViewSeg button').map(b=>({mv:b.dataset.mv,on:b.classList.contains('on')})) },
    filtRow: { filtIsWell: !!($('#filtSeg')||{}).classList?.contains('well'),
               filtBtns: $$('#filtSeg button').map(b=>b.dataset.f),
               sortBtn: !!$('#mediaSortBtn'), sortLabel: ($('#mediaSortLbl')||{}).textContent,
               groupSegVisible: !!($('#groupSeg')||{}).offsetParent },
    createRow: $$('.crrow .crbtn').map(b=>({id:b.id, pri:b.classList.contains('pri'), lbl:(b.querySelector('.crlbl')||{}).textContent||null, lblShown: !!(b.querySelector('.crlbl')&&getComputedStyle(b.querySelector('.crlbl')).display!=='none'), h:Math.round(b.getBoundingClientRect().height*10)/10})),
    hidden: { search: !!document.getElementById('mediaSearch') && getComputedStyle(document.getElementById('mediaSearch')).display, newFolder: !!document.getElementById('newFolderBtn') && getComputedStyle(document.getElementById('newFolderBtn')).display },
    paneW: Math.round(($('#mediaPane')||{getBoundingClientRect:()=>({width:0})}).getBoundingClientRect().width)
  };

  return { upper, bars, surf, wells, toggle, topbar, media };
})()`);

fs.writeFileSync('scratchpad/audit-rev1-a.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
console.log('ERRORS:', errors.length ? errors : 'none');
const cap = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 700, height: 200, scale: 1 } });
fs.writeFileSync('scratchpad/audit-rev1-a.png', Buffer.from(cap.data, 'base64'));
console.log('→ scratchpad/audit-rev1-a.png');
ws.close();
