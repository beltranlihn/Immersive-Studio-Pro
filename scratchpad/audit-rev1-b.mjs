// AUDITORÍA REDISEÑO Rev 1 — parte B: top bar real + §3 barra del visor + §4 inspector.
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

// selecciona un clip para que el inspector se construya entero
await evl(`(()=>{ const c=state.clips.find(c=>c.kind!=='audio')||state.clips[0]; if(c){ state.selIds=[c.id]; state.selId=c.id; state.selLane=null; renderInspector(); renderTimeline(); } return !!c; })()`);
await wait(600);

const out = await evl(`(()=>{
  const R = el => { if(!el) return null; const b=el.getBoundingClientRect(); return {w:Math.round(b.width*10)/10,h:Math.round(b.height*10)/10}; };
  const hex = c => { if(!c) return c; const m=c.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/); return m? '#'+[m[1],m[2],m[3]].map(n=>(+n).toString(16).padStart(2,'0')).join('').toUpperCase() : c; };
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];

  // ---- localizar la TOP BAR real (primer hijo de body/#app con altura ~28 arriba del todo) ----
  const cands=[...document.querySelectorAll('body > div, #app > div')].filter(e=>{const b=e.getBoundingClientRect(); return b.y<6 && b.height>0 && b.height<40 && b.width>1200;});
  const topbar = cands.map(e=>({ tag:e.tagName.toLowerCase(), id:e.id||null, cls:(typeof e.className==='string'?e.className:''), h:Math.round(e.getBoundingClientRect().height*10)/10,
      bg:hex(getComputedStyle(e).backgroundColor),
      kids:[...e.children].map(c=>({id:c.id||null, cls:(typeof c.className==='string'?c.className:''), txt:(c.textContent||'').trim().slice(0,30), w:Math.round(c.getBoundingClientRect().width)})) }));

  // ---- §3 · BARRA DEL VISOR ----
  const vp=$('.vptool');
  const vis = {
    h: R(vp) && R(vp).h,
    groups: vp ? [...vp.children].map(c=>({id:c.id||null, cls:(typeof c.className==='string'?c.className:''), w:Math.round(c.getBoundingClientRect().width), vis:getComputedStyle(c).display!=='none', txt:(c.textContent||'').trim().slice(0,30)})) : null,
    overlaysIconOnly: $$('#dispSeg button').map(b=>({d:b.dataset.d, txt:(b.textContent||'').trim(), title:b.title||''})),
    output: { present:!!$('#outputBtn'), on:!!($('#outputBtn')||{}).classList?.contains('on') },
    removed: ['perfBtn','popoutBtn','ndiBtn','spoutBtn'].map(id=>({id, present:!!document.getElementById(id)})),
    viewModeSegParent: ($('#viewModeSeg')||{}).parentElement ? (($('#viewModeSeg').parentElement.id)||$('#viewModeSeg').parentElement.className) : null,
    totalWidthUsed: vp ? [...vp.children].filter(c=>getComputedStyle(c).display!=='none').reduce((s,c)=>s+c.getBoundingClientRect().width,0) : 0,
    barWidth: vp ? Math.round(vp.getBoundingClientRect().width) : 0
  };

  // ---- §4 · INSPECTOR ----
  const insp = {
    headerH: R($('#inspTabs')) && R($('#inspTabs')).h,
    tabsInWell: !!($('#inspTabs .well')),
    tabs: $$('#inspTabs .instab').map(b=>({tab:b.dataset.tab, on:b.classList.contains('on'), txt:(b.textContent||'').trim()})),
    hasTallBtn: !!$('#tallInspBtn'), hasHideBtn: !!$('#hideInsp'),
    clipColorBar: (()=>{ const e=$('#insCtl .clipcolorbar,#insCtl .colorbar,#insHdrColor'); return e? {found:true,h:R(e).h}: {found:false}; })(),
    sections: $$('#insCtl .sechead').map(s=>({id:s.id, sec:s.dataset.sec, txt:(s.querySelector('.t')||{}).textContent, shown:getComputedStyle(s).display!=='none',
        tt:getComputedStyle(s.querySelector('.t')||s).textTransform, fs:getComputedStyle(s.querySelector('.t')||s).fontSize})),
    masterGradeGone: { insMaster: !!document.getElementById('insMaster'), fn: (typeof renderMasterGrade) },
    sourceRows: $$('#sourceRows .prow').map(r=>({lab:(r.querySelector('.lab')||{}).textContent, ctl:[...r.querySelectorAll('input,select,button')].map(i=>i.type||i.tagName.toLowerCase())})),
    playbackRows: $$('#playbackRows .prow').map(r=>({lab:(r.querySelector('.lab')||{}).textContent, ctl:[...r.querySelectorAll('input,select,button')].map(i=>i.type||i.tagName.toLowerCase())})),
    ioswCount: $$('.iosw').length,
    rawCheckboxes: $$('#insCtl input[type=checkbox]').length,
    // color por parámetro: --pc en las filas y su diamante
    paramColors: $$('#tfRows .prow, #fxRows .prow, #colorRows .prow').slice(0,14).map(r=>({
        lab:(r.querySelector('.lab')||{}).textContent,
        pc:(r.style.getPropertyValue('--pc')||'').trim()||null,
        fill: hex(getComputedStyle(r.querySelector('.track>i')||r).backgroundColor)
      })),
    kfDiamondColored: (()=>{ const r=$$('#tfRows .prow').find(x=>x.classList.contains('auto')); return r? {lab:(r.querySelector('.lab')||{}).textContent, btnColor:hex(getComputedStyle(r.querySelector('.nav button[data-k=add]')||r).color)} : 'ninguna fila automatizada'; })()
  };
  return { topbar, vis, insp };
})()`);

fs.writeFileSync('scratchpad/audit-rev1-b.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
console.log('ERRORS:', errors.length ? errors : 'none');
ws.close();
