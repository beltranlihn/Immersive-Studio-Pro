// Verifica el launcher: estructura, alto estable entre tipos, campos numéricos, tabla de muros, visores reales.
import { targets } from './cdp.mjs';
import fs from 'fs';
const wait = ms => new Promise(r => setTimeout(r, ms));
let idx = null;
for (let i = 0; i < 140; i++) { const l = await targets(9222).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(150); }
if (!idx) { console.log('sin editor'); process.exit(1); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws')); });
let _id = 0;
const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error('threw: ' + JSON.stringify(r.exceptionDetails).slice(0, 500)); return r.result.value; };
const errors = [];
await send('Runtime.enable', {});
ws.addEventListener('message', ev => { const x = JSON.parse(ev.data); if (x.method === 'Runtime.consoleAPICalled' && x.params.type === 'error') errors.push((x.params.args || []).map(a => a.value || a.description || '').join(' ')); });

await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false, screenWidth: 1600, screenHeight: 1000 });
await send('Page.reload', { ignoreCache: true }); await wait(1800);
for (let i = 0; i < 60; i++) { try { if (await evl('typeof showLanding!=="undefined" && !!document.getElementById("tracks")')) break; } catch (e) {} await wait(400); }
await evl(`(()=>{ try{localStorage.setItem('dspOnboardV1','1')}catch(e){} document.body.classList.remove('preboot'); document.querySelectorAll('#tourOv').forEach(o=>o.remove()); if(!document.getElementById('landingOv'))showLanding(); return 1; })()`);
await wait(600);

const per = {};
for (const t of ['dome', 'flat', 'room']) {
  await evl(`(()=>{ _lch.ptype='${t}'; renderLauncher(); return 1; })()`); await wait(350);
  per[t] = await evl(`(()=>{
    const R=el=>{ if(!el)return null; const b=el.getBoundingClientRect(); return {w:Math.round(b.width),h:Math.round(b.height)}; };
    const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
    const wrap=$('#landingOv .lch-wrap');
    const cvs=$$('#lchViewer canvas').map(c=>({id:c.id,w:c.width,h:c.height,pintado:(()=>{try{const x=c.getContext('2d').getImageData(0,0,c.width,c.height).data;for(let i=3;i<x.length;i+=4*97)if(x[i]>8)return true;return false;}catch(e){return 'n/a';}})()}));
    return { panel:R($('#lchPanel')), viewer:R($('#lchViewer')), work:R($('.lch-work')), pagina:R(wrap),
      scrollea: wrap.scrollHeight>wrap.clientHeight+1,
      tiles:$$('#lchPanel [data-ltype]').map(b=>({t:b.dataset.ltype,on:b.classList.contains('on')})),
      filas:$$('#lchPanel .lch-row').length, muros:$$('#lchPanel .lch-wrow').length,
      out:$$('#lchPanel .lch-outrow').map(r=>r.querySelector('.k').textContent+': '+r.querySelector('.v').textContent),
      crear:($('#lchCreate')||{}).textContent, canvas:cvs };
  })()`);
}

// campos numéricos: teclado + clamp + intercambio de orientación
const num = await evl(`(()=>{
  _lch.ptype='dome'; renderLauncher();
  const i=document.querySelector('[data-lk="domeRes"]'); const r={};
  i.focus(); i.value='7000'; i.dispatchEvent(new Event('input',{bubbles:true}));
  r.borradorNoAplica = _lch.domeRes;
  i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  r.trasEnter = _lch.domeRes;
  const i2=document.querySelector('[data-lk="domeRes"]'); i2.focus();
  i2.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true}));
  r.trasFlecha = _lch.domeRes;
  const i3=document.querySelector('[data-lk="domeRes"]'); i3.focus(); i3.value='99999'; i3.dispatchEvent(new Event('input',{bubbles:true}));
  i3.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  r.clamp = _lch.domeRes;
  const i4=document.querySelector('[data-lk="domeCov"]'); i4.focus(); i4.value='210'; i4.dispatchEvent(new Event('input',{bubbles:true}));
  i4.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  r.escDescarta = _lch.domeCov;
  _lch.ptype='room'; renderLauncher();
  const antes=_lch.walls.slice(0,4).map(w=>w.role).join(',');
  document.querySelector('[data-lface="0"]').click();
  r.facing = { antes, despues:_lch.walls.slice(0,4).map(w=>w.role).join(','), sinRepetidos:new Set(_lch.walls.slice(0,4).map(w=>w.role)).size===4 };
  _lch.roomUniform=true; renderLauncher();
  const w0=document.querySelector('[data-lk="w0pxW"]'); w0.focus(); w0.value='2000'; w0.dispatchEvent(new Event('input',{bubbles:true}));
  w0.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  r.uniforme = _lch.walls.map(w=>w.pxW).join(',');
  return r;
})()`);

const res = { porTipo: per, numericos: num, consoleErrors: errors };
fs.writeFileSync('scratchpad/verify-launcher.json', JSON.stringify(res, null, 2));
console.log(JSON.stringify(res, null, 2));
ws.close();
