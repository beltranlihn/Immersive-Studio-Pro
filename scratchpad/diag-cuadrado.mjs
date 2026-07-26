import { targets } from './cdp.mjs';
const wait = ms => new Promise(r => setTimeout(r, ms));
let idx = null;
for (let i = 0; i < 300; i++) { const l = await targets(9222).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(150); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws')); });
let _id = 0;
const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
await send('Runtime.enable', {});
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, timeout: 300000 }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 300) }; return r.result.value; };
for (let i = 0; i < 120; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await wait(1200);

const SRC = 'C:\\\\Users\\\\beltr\\\\Desktop\\\\Rito Movie\\\\Asset\\\\Creation\\\\Front1.mp4';
const OUT = 'C:\\\\Users\\\\beltr\\\\AppData\\\\Local\\\\Temp\\\\claude\\\\cuad';

console.log('montaje domo 2048² con nest de 3 clips:', await evl(`(async()=>{
  const o=document.getElementById('landingOv'); if(o)o.remove(); const t=document.getElementById('tourOv'); if(t)t.remove();
  const as=activeSeq(); as.w=2048;as.h=2048;as.mode='dome';as.fps=30; state.seqW=2048;state.seqH=2048;state.seqMode='dome';state.fps=30;
  await DSP.ensureDir('${OUT}'); currentPath='${OUT}\\\\c.isp';
  state.media=state.media.filter(x=>x.kind==='video');
  let m=state.media[0]; if(!m) m=await addVideoFromPath('${SRC}','Front1');
  const nl=[],ncl=[];
  for(let i=0;i<3;i++){ nl.push({id:uid(),name:'V'+(i+1),tag:'V'+(i+1),kind:'video'});
    const c=makeClip(m,i,0); c.start=0;c.dur=1;c.inP=3+i*0.5; c.props.az=i*90; c.props.el=30; c.props.size=45; ncl.push(c); }
  const nest={id:uid(),name:'Comp',kind:'nest',w:2048,h:2048,dur:1,fps:30,mode:'dome',
    nestClips:ncl,nestLanes:nl,nestMarkers:[],nestGroups:[],tex:newTex(),thumb:null,color:clipColorFor('nest'),folder:null};
  state.media.push(nest); adopt(nest); window._N=nest.id;
  state.clips=[]; const nc=makeClip(nest,0,0); nc.start=0;nc.dur=1;nc.inP=0; state.clips.push(nc);
  state.view.useNestCache=false; state.playhead=0.5; renderMedia(); renderTimeline(); render(); return 'ok'; })()`));

const huella = `(async()=>{ await scrubRender(); await new Promise(r=>setTimeout(r,800));
  const c=document.createElement('canvas'); c.width=32;c.height=32; const x=c.getContext('2d',{willReadFrequently:true});
  x.drawImage(glc,0,0,32,32); const d=x.getImageData(0,0,32,32).data; const v=[];
  for(let i=0;i<d.length;i+=4)v.push(Math.round((d[i]+d[i+1]+d[i+2])/3)); return v.join(','); })()`;
const sin = await evl(huella);

await evl(`(()=>{ window._P=ncBuild(mediaById(window._N)); return true; })()`);
for (let i = 0; i < 60; i++) { if (await evl(`!!document.getElementById('ncGo')`)) break; await wait(300); }
console.log('dialogo:', await evl(`(()=>{const m=document.querySelector('.overlay .modal'); return (m?m.textContent:'').replace(/\\s+/g,' ').slice(0,150);})()`));
await evl(`document.getElementById('ncGo').click()`);
for (let i = 0; i < 40; i++) { if (await evl(`!!document.getElementById('ripPv')`)) break; await wait(250); }
for (let i = 0; i < 200; i++) { if (!(await evl(`!!document.getElementById('ripPv')`))) break; await wait(1200); }
await wait(2500);
console.log('estado del cache:', await evl(`(()=>{const m=mediaById(window._N);
  return JSON.stringify({ncPath:!!m.ncPath, ready:!!m.ncReady, stale:!!m.ncStale, usable:ncUsable(m), dim:m.ncW+'x'+m.ncH});})()`));

await evl(`(async()=>{ state.view.useNestCache=true; await scrubRender(); return true; })()`);
let listo = false;
for (let i = 0; i < 60; i++) { const st = await evl(`(()=>{ const c=state.clips[0]; const vi=_vinst.get(c.id);
  return JSON.stringify({hayVi:!!vi, ready:!!(vi&&vi.ready), rs:vi&&vi.vel?vi.vel.readyState:null, usable:ncUsable(mediaById(window._N))}); })()`);
  if (i === 0 || i === 20) console.log('  instancia:', st);
  if (/"ready":true/.test(st)) { listo = true; break; } await wait(400); }
console.log('instancia lista:', listo);
await evl(`(async()=>{ await scrubRender(); await new Promise(r=>setTimeout(r,700)); return true; })()`);
const con = await evl(huella);

const A = sin.split(',').map(Number), B = con.split(',').map(Number);
let se = 0, mx = 0; for (let i = 0; i < A.length; i++) { const e = A[i] - B[i]; se += e * e; if (Math.abs(e) > mx) mx = Math.abs(e); }
const mse = se / A.length, psnr = mse > 0 ? (10 * Math.log10(65025 / mse)).toFixed(1) : 'INF';
const cm = a => { let sx = 0, sy = 0, s = 0; for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) { const v = a[y * 32 + x]; sx += x * v; sy += y * v; s += v; } return s > 0 ? [+(sx / s).toFixed(2), +(sy / s).toFixed(2)] : [0, 0]; };
const p = cm(A), q = cm(B);
console.log('\nCUADRADO:', JSON.stringify({ psnr, errorMax: mx, centroSin: p, centroCon: q, desplazamiento: +Math.hypot(q[0] - p[0], q[1] - p[1]).toFixed(2) }));
ws.close();
