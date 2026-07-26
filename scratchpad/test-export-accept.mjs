// Lista de aceptacion del handoff, punto por punto.
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
  if (x.method === 'Runtime.consoleAPICalled' && x.params.type === 'error') errs.push((x.params.args || []).map(a => a.value || a.description || '').join(' ').slice(0, 150));
  if (x.method === 'Runtime.exceptionThrown') errs.push(((x.params.exceptionDetails.exception || {}).description || '').slice(0, 150)); });
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, timeout: 120000 }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 250) }; return r.result.value; };
for (let i = 0; i < 120; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await wait(1300);

const SRC = 'C:\\\\Users\\\\beltr\\\\Desktop\\\\Rito Movie\\\\Asset\\\\Creation\\\\Front1.mp4';
await evl(`(async()=>{ const o=document.getElementById('landingOv'); if(o)o.remove(); const t=document.getElementById('tourOv'); if(t)t.remove();
  if(!state.media.some(m=>m.kind==='video')){ const m=await addVideoFromPath('${SRC}','Front1');
    state.clips=[]; const c=makeClip(m,0,0); c.start=0;c.dur=2;c.inP=3; state.clips.push(c); }
  return true; })()`);

const setSeq = (mode, w, h) => evl(`(()=>{ const as=activeSeq(); as.w=${w}; as.h=${h}; as.mode='${mode}'; as.fps=30;
  state.seqW=${w}; state.seqH=${h}; state.seqMode='${mode}'; state.fps=30;
  if('${mode}'==='room'&&!as.room)as.room={walls:[{role:'front',x0:0,x1:0.25,pxW:1920,pxH:1080,wcm:800,hcm:450,order:0},{role:'right',x0:0.25,x1:0.5,pxW:1920,pxH:1080,wcm:800,hcm:450,order:1},{role:'back',x0:0.5,x1:0.75,pxW:1920,pxH:1080,wcm:800,hcm:450,order:2}],floorSeqId:null};
  const p=document.getElementById('exOv'); if(p)p.remove(); openExport(); return true; })()`);

const probe = () => evl(`(()=>{ const o=document.getElementById('exOv');
  const fit=(()=>{ const c=document.getElementById('exMon'); const x=c.getContext('2d');
    const d=x.getImageData(0,0,c.width,c.height).data; let x0=-1,x1=-1,y0=-1,y1=-1;
    for(let X=0;X<c.width;X++){let a=false;for(let Y=0;Y<c.height;Y++){const i=(Y*c.width+X)*4;if(d[i+3]>0){a=true;break;}}if(a){if(x0<0)x0=X;x1=X;}}
    for(let Y=0;Y<c.height;Y++){let a=false;for(let X=0;X<c.width;X++){const i=(Y*c.width+X)*4;if(d[i+3]>0){a=true;break;}}if(a){if(y0<0)y0=Y;y1=Y;}}
    return {x0,x1,y0,y1}; })();
  return JSON.stringify({ proxy:o.querySelector('#exProxy').textContent, encaje:o.querySelector('#exFit').textContent,
    filaSala:!!o.querySelector('#exRoomRow'), est:(o.querySelector('#exEst').textContent||'').slice(0,46), lienzoPintado:fit }); })()`);

for (const [m, w, h, nota] of [['dome', 4096, 4096, 'domo 1:1 → 90x90 centrado'], ['flat', 1920, 1080, '2D 16:9 → llena la caja'], ['room', 5760, 1080, 'sala 5.3:1 → barras arriba/abajo']]) {
  await setSeq(m, w, h); await wait(800);
  console.log(m.padEnd(5), await probe(), ' ·', nota);
}

console.log('\narrastre por la cabecera:', await evl(`(()=>{ const sh=document.getElementById('exSheet'), hd=document.getElementById('exHd');
  const a=sh.getBoundingClientRect().left;
  hd.dispatchEvent(new PointerEvent('pointerdown',{clientX:400,clientY:100,bubbles:true,pointerId:1}));
  hd.dispatchEvent(new PointerEvent('pointermove',{clientX:520,clientY:160,bubbles:true,pointerId:1}));
  hd.dispatchEvent(new PointerEvent('pointerup',{clientX:520,clientY:160,bubbles:true,pointerId:1}));
  const b=sh.getBoundingClientRect().left;
  return JSON.stringify({movio:Math.round(b-a), transform:sh.style.transform}); })()`));

console.log('\nsin mayusculas sostenidas (salvo acronimos de codec):', await evl(`(()=>{
  const o=document.getElementById('exOv'); const mal=[];
  o.querySelectorAll('label,.exs-lab,.exs-cell .k,.exs-seg button,.exs-hd .t,.exs-btn,.exs-pri').forEach(e=>{
    const t=(e.textContent||'').trim(); if(!t)return;
    const letras=t.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g,''); if(letras.length<3)return;
    if(letras===letras.toUpperCase() && !/^(PNG|HAP|HEVC|MOV|MP4|FPS)$/i.test(t)) mal.push(t.slice(0,26)); });
  return JSON.stringify(mal.length?mal:'ninguna'); })()`));

console.log('\nglifos de macOS:', await evl(`(()=>{ const t=document.getElementById('exOv').textContent;
  return JSON.stringify({hay:/[⌘⌥⇧⌃]/.test(t), atajo:document.querySelector('.exs-key').textContent}); })()`));

console.log('\nerrores de consola:', errs.length ? errs.slice(0, 6) : 'ninguno');
ws.close();
