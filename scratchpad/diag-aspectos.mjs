// ¿Coincide el caché con la composición recompuesta en VARIAS relaciones de aspecto y posiciones?
import { targets } from './cdp.mjs';
const wait = ms => new Promise(r => setTimeout(r, ms));
let idx = null;
for (let i = 0; i < 300; i++) { const l = await targets(9222).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(150); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws')); });
let _id = 0;
const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
const errs = []; await send('Runtime.enable', {});
ws.addEventListener('message', ev => { const x = JSON.parse(ev.data); if (x.method === 'Runtime.exceptionThrown') errs.push(((x.params.exceptionDetails.exception || {}).description || '').slice(0, 140)); });
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, timeout: 300000 }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 260) }; return r.result.value; };
for (let i = 0; i < 120; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await wait(1200);

const OUT = 'C:\\\\Users\\\\beltr\\\\AppData\\\\Local\\\\Temp\\\\claude\\\\aspectos';
await evl(`(async()=>{ const o=document.getElementById('landingOv'); if(o)o.remove(); const t=document.getElementById('tourOv'); if(t)t.remove();
  await DSP.ensureDir('${OUT}'); currentPath='${OUT}\\\\a.isp';
  const m={id:uid(),kind:'shape',name:'Barra',shape:'rect',fill:'#FFFFFF',stroke:'#0E0F11',strokeW:0,sw:512,sh:512,dur:6,fps:0,color:clipColorFor('shape'),folder:null};
  renderShapeMedia(m); state.media.push(m); window._M=m.id; return true; })()`);

// huella: mapa de brillo 24x24 del visor, comparable pixel a pixel
const huella = `(async()=>{ await scrubRender(); await new Promise(r=>setTimeout(r,800));
  const c=document.createElement('canvas'); c.width=24;c.height=24; const x=c.getContext('2d',{willReadFrequently:true});
  x.drawImage(glc,0,0,24,24); const d=x.getImageData(0,0,24,24).data; const v=[];
  for(let i=0;i<d.length;i+=4)v.push(Math.round((d[i]+d[i+1]+d[i+2])/3));
  return v.join(','); })()`;

const casos = [
  ['16:9  1920x1080', 1920, 1080, { x: 0, y: 78, scale: 80, scaleY: 0.12 }],
  ['16:9  1920x1080 · esquina', 1920, 1080, { x: -62, y: -55, scale: 34, scaleY: 1 }],
  ['4:3   1440x1080', 1440, 1080, { x: 40, y: 20, scale: 45, scaleY: 1 }],
  ['2.39  2560x1072', 2560, 1072, { x: -30, y: 0, scale: 55, scaleY: 1 }],
  ['cuadr 1080x1080', 1080, 1080, { x: 0, y: 40, scale: 50, scaleY: 1 }],
];

for (const [nombre, w, h, pr] of casos) {
  await evl(`(async()=>{ const m=mediaById(window._M);
    const as=activeSeq(); as.w=${w};as.h=${h};as.mode='flat';as.fps=30; state.seqW=${w};state.seqH=${h};state.seqMode='flat';state.fps=30;
    state.media=state.media.filter(x=>x.kind!=='nest');
    const nl=[{id:uid(),name:'V1',tag:'V1',kind:'video'}];
    const ci=makeClip(m,0,0); ci.start=0;ci.dur=1;ci.inP=0; Object.assign(ci.props,${JSON.stringify(pr)});
    const nest={id:uid(),name:'N',kind:'nest',w:${w},h:${h},dur:1,fps:30,mode:'flat',
      nestClips:[ci],nestLanes:nl,nestMarkers:[],nestGroups:[],tex:newTex(),thumb:null,color:clipColorFor('nest'),folder:null};
    state.media.push(nest); adopt(nest); window._N=nest.id;
    state.clips=[]; const nc=makeClip(nest,0,0); nc.start=0;nc.dur=1;nc.inP=0; state.clips.push(nc);
    state.view.useNestCache=false; state.playhead=0.5; renderMedia(); renderTimeline(); render(); return true; })()`);
  const sin = await evl(huella);

  await evl(`(()=>{ window._P=ncBuild(mediaById(window._N)); return true; })()`);
  for (let i = 0; i < 60; i++) { if (await evl(`!!document.getElementById('ncGo')`)) break; await wait(300); }
  await evl(`document.getElementById('ncGo').click()`);
  for (let i = 0; i < 40; i++) { if (await evl(`!!document.getElementById('ripPv')`)) break; await wait(250); }
  for (let i = 0; i < 200; i++) { if (!(await evl(`!!document.getElementById('ripPv')`))) break; await wait(1200); }
  for (let i = 0; i < 40; i++) { if (await evl(`(()=>{const m=mediaById(window._N);return !!m.ncReady;})()`)) break; await wait(700); }
  // esperar a que la instancia del cache tenga su PRIMER fotograma: si no, se mide negro contra imagen
  await evl(`(async()=>{ state.view.useNestCache=true; await scrubRender(); return true; })()`);
  let listo=false;
  for(let i=0;i<50;i++){ listo=await evl(`(()=>{ const c=state.clips[0]; const vi=_vinst.get(c.id); return !!(vi&&vi.ready); })()`); if(listo)break; await wait(400); }
  await evl(`(async()=>{ await scrubRender(); await new Promise(r=>setTimeout(r,600)); return true; })()`);
  const con = await evl(huella);
  if(!listo) console.log('   (aviso: la instancia del cache no reporto listo)');

  if (typeof sin !== 'string' || typeof con !== 'string') { console.log(nombre.padEnd(26), 'ROTO'); continue; }
  const A = sin.split(',').map(Number), B = con.split(',').map(Number);
  let se = 0, mx = 0; for (let i = 0; i < A.length; i++) { const e = A[i] - B[i]; se += e * e; if (Math.abs(e) > mx) mx = Math.abs(e); }
  const cm = a => { let sx = 0, sy = 0, s = 0; for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) { const v = a[y * 24 + x]; sx += x * v; sy += y * v; s += v; } return s > 0 ? [+(sx / s).toFixed(2), +(sy / s).toFixed(2)] : [0, 0]; };
  const p = cm(A), q = cm(B);
  const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
  console.log(nombre.padEnd(26), JSON.stringify({ errorMax: mx, desplazamientoCentro: +d.toFixed(2), veredicto: (d < 0.6 && mx < 60) ? 'COINCIDE' : 'DIFIERE' }));
}
console.log('\nerrores:', errs.length ? errs.slice(0, 5) : 'ninguno');
ws.close();
