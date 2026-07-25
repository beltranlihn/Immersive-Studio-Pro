// Verifica los arreglos de la auditoría Rev 1: alturas, wells, superficies, toggles de Source/Playback,
// hint de herramienta en el status, Ctrl+F de búsqueda, y que la barra del visor ya NO salte al pasar 2D↔3D.
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
for (let i = 0; i < 60; i++) { try { if (await evl('typeof state!=="undefined" && !!document.getElementById("tracks")')) break; } catch (e) {} await wait(400); }
await evl(`(()=>{ try{localStorage.setItem('dspOnboardV1','1')}catch(e){} document.querySelectorAll('.overlay,#splashOv,#tourOv').forEach(o=>{try{if(o._stopLogo)o._stopLogo();}catch(e){}o.remove();}); document.body.classList.remove('preboot'); try{resize();}catch(e){} render(); return 1; })()`);
await wait(300);
await evl(`(async()=>{ state.dirty=false; await buildDemoProject(); render(); renderTimeline(); renderMedia(); return 1; })()`);
await wait(700);

// --- barra del visor: posiciones en 2D y en 3D ---
const posOf = () => evl(`(()=>{ const g={}; for(const id of ['viewModeSeg','dispSeg','qualitySeg','proxyToggle','threeModeSeg']){ const e=document.getElementById(id); g[id]= e? {x:Math.round(e.getBoundingClientRect().x), vis:getComputedStyle(e).display!=='none'} : null; } const vp=document.querySelector('.vptool'); return {mode:state.view.mode, g, overflow: vp.scrollWidth>vp.clientWidth}; })()`);
await evl(`(()=>{ const b=document.querySelector('#viewModeSeg button[data-v="2d"]'); if(b)b.click(); return 1; })()`); await wait(500);
const v2 = await posOf();
await evl(`(()=>{ const b=document.querySelector('#viewModeSeg button[data-v="3d"]'); if(b)b.click(); return 1; })()`); await wait(700);
const v3 = await posOf();
await evl(`(()=>{ const b=document.querySelector('#viewModeSeg button[data-v="2d"]'); if(b)b.click(); return 1; })()`); await wait(500);

// --- Ctrl+F: revelar la búsqueda ---
const search = await evl(`(()=>{ showMediaSearch(true); const si=document.getElementById('mediaSearch');
  const shown=getComputedStyle(si).display!=='none', focused=document.activeElement===si, w=Math.round(si.getBoundingClientRect().width);
  si.value='shape'; state.mediaQuery='shape'; renderMedia(); const filtered=document.querySelectorAll('#mediaList .mitem').length;
  showMediaSearch(false);
  return { shown, focused, w, filteredItems:filtered, hiddenAfter:getComputedStyle(si).display==='none', queryCleared:state.mediaQuery==='' }; })()`);
await wait(300);
await evl(`(()=>{ state.mediaQuery=''; renderMedia(); return 1; })()`);

// --- inspector: seleccionar un clip de vídeo/shape para ver Source ---
await evl(`(()=>{ const c=state.clips.find(c=>c.kind!=='audio')||state.clips[0]; if(c){ state.selIds=[c.id]; state.selId=c.id; state.selLane=null; renderInspector(); } return !!c; })()`);
await wait(500);

const out = await evl(`(()=>{
  const R = el => { if(!el) return null; const b=el.getBoundingClientRect(); return {w:Math.round(b.width*10)/10,h:Math.round(b.height*10)/10}; };
  const hex = c => { if(!c) return c; const m=c.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/); return m? '#'+[m[1],m[2],m[3]].map(n=>(+n).toString(16).padStart(2,'0')).join('').toUpperCase() : c; };
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const H = el => R(el) && R(el).h;
  return {
    alturas: { top:H($('.top')), mediaHead:H($('#mediaPane .panhead')), inspHead:H($('#inspTabs')),
               vptool:H($('.vptool')), transport:H($('.transport')), status:H($('.status')),
               editSeg:H($('#tlEditSeg')), snapBtn:H($('#snapBtn')), zoomGrp:H($('.zoomgrp')) },
    superficies: { top:hex(getComputedStyle($('.top')).backgroundColor), transport:hex(getComputedStyle($('.transport')).backgroundColor),
                   status:hex(getComputedStyle($('.status')).backgroundColor), mediaHead:hex(getComputedStyle($('#mediaPane .panhead')).backgroundColor) },
    editSegBtns: $$('#tlEditSeg button').map(b=>({id:b.id,h:Math.round(b.getBoundingClientRect().height*10)/10})),
    zoomBtns: $$('.zoomgrp button').map(b=>Math.round(b.getBoundingClientRect().height*10)/10),
    toggles: { ioswEnInspector:$$('#insCtl .iosw').length, checkboxesCrudos:$$('#insCtl input[type=checkbox]').length,
               muestra:(()=>{ const s=$('#insCtl .iosw'); return s? {size:R(s), knob:R(s.querySelector('i'))}:null; })(),
               sourceRows:$$('#sourceRows .prow').map(r=>({lab:(r.querySelector('.lab')||{}).textContent, sw:!!r.querySelector('.iosw')})) },
    statusHint: (()=>{ const e=$('#statInfo'); return {txt:(e.textContent||'').trim().slice(0,90), k:(e.querySelector('.k')||{}).textContent, sc:(e.querySelector('.sc')||{}).textContent}; })(),
    tituloTransform: ($('#secTf .t')||{}).textContent,
    micro: { mmeta:(()=>{const e=$('.mmeta'); return e? {fs:getComputedStyle(e).fontSize, tt:getComputedStyle(e).textTransform}:null;})(),
             selmeta:(()=>{const e=$('#selMeta'); return e? {fs:getComputedStyle(e).fontSize, tt:getComputedStyle(e).textTransform}:null;})() },
    fitTooltip: ($('#fitAllBtn')||{}).title || ($('#fitAllBtn')||{}).getAttribute?.('data-tip')
  };
})()`);

const res = { viewerBar: { v2, v3 }, search, ...out };
fs.writeFileSync('scratchpad/verify-audit-fixes.json', JSON.stringify(res, null, 2));
console.log(JSON.stringify(res, null, 2));
console.log('ERRORS:', errors.length ? errors : 'none');
ws.close();
