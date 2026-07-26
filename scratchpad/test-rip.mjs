// R179 · Render in place de extremo a extremo en una secuencia de DOMO 4096² real.
import { targets } from './cdp.mjs';
const wait = ms => new Promise(r => setTimeout(r, ms));
let idx = null;
for (let i = 0; i < 300; i++) { const l = await targets(9222).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(150); }
if (!idx) { console.log('la app no expuso la ventana'); process.exit(1); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws')); });
let _id = 0;
const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
const errs = []; await send('Runtime.enable', {});
ws.addEventListener('message', ev => { const x = JSON.parse(ev.data);
  if (x.method === 'Runtime.consoleAPICalled' && x.params.type === 'error') errs.push((x.params.args || []).map(a => a.value || a.description || '').join(' ').slice(0, 200));
  if (x.method === 'Runtime.exceptionThrown') errs.push('excepción: ' + ((x.params.exceptionDetails.exception && x.params.exceptionDetails.exception.description) || '').slice(0, 200)); });
const evl = async (e, t = 900000) => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, timeout: t }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 400) }; return r.result.value; };
for (let i = 0; i < 90; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await wait(1500);

const SRC = 'C:\\\\Users\\\\beltr\\\\Desktop\\\\Rito Movie\\\\Asset\\\\Creation\\\\Front1.mp4';
const OUTDIR = 'C:\\\\Users\\\\beltr\\\\AppData\\\\Local\\\\Temp\\\\claude\\\\rip-test';

// ---- 1. Montar una secuencia de domo 4096² con un clip real
console.log('montaje:', JSON.stringify(await evl(`(async()=>{
  const ov=document.getElementById('landingOv'); if(ov)ov.remove();
  const t=document.getElementById('tourOv'); if(t)t.remove();
  const as=activeSeq(); as.w=4096; as.h=4096; as.fps=60; state.fps=60; state.seqW=4096; state.seqH=4096; state.seqMode='dome';
  await DSP.ensureDir('${OUTDIR}');
  currentPath='${OUTDIR}\\\\prueba.isp';
  const m=await addVideoFromPath('${SRC}','Front1');
  if(!m) return {error:'no cargó el vídeo'};
  const c=makeClip(m,0,0); c.start=0; c.dur=1.0; c.inP=0; state.clips.push(c);
  renderTimeline(); render();
  return { seq:state.seqW+'x'+state.seqH+'@'+ (activeSeq().fps), esDomo:!isFlat(), clips:state.clips.length, pistas:state.lanes.length, medio:{w:m.w,h:m.h,dur:+m.dur.toFixed(2)} };
})()`), null, 1));

// ---- 2. ¿qué códecs ofrece a 4096²?
console.log('\ncódecs ofrecidos a 4096²:', JSON.stringify(await evl(`(async()=>{
  const o=await ripCodecOptions(4096,4096,60);
  return o.map(x=>x.kind+' → '+x.codec+' @ '+Math.round(x.bitrate/1e6)+' Mbps');
})()`), null, 1));

// ---- 3. Lanzar render in place y contestar el diálogo
console.log('\nabriendo Render in place…');
await evl(`(()=>{ window._ripP = renderInPlace(state.clips[0]); return true; })()`);
await wait(2500);
console.log('diálogo:', JSON.stringify(await evl(`(()=>{
  const go=document.getElementById('ripGo'), sel=document.getElementById('ripFmt');
  const md=document.querySelector('.overlay .modal');
  return { hayDialogo:!!go, opciones: sel?[...sel.options].map(o=>o.textContent):null,
           elegido: sel?sel.options[sel.selectedIndex].textContent:null,
           info:(document.getElementById('ripInfo')||{}).textContent,
           texto:(md?md.textContent:'').replace(/\\s+/g,' ').slice(0,260) };
})()`), null, 1));

console.log('\n→ Render…');
await evl(`(()=>{ document.getElementById('ripGo').click(); return true; })()`);
await wait(3000);
console.log('visor de avance:', JSON.stringify(await evl(`(()=>{
  const pv=document.getElementById('ripPv');
  let pintado=null;
  if(pv){ try{ const c=document.createElement('canvas'); c.width=32;c.height=32; const x=c.getContext('2d'); x.drawImage(pv,0,0,32,32);
    const d=x.getImageData(0,0,32,32).data; let s=0; for(let i=0;i<d.length;i+=4)s+=d[i]+d[i+1]+d[i+2]; pintado=Math.round(s/(32*32*3)); }catch(e){ pintado='err'; } }
  return { hayVisor:!!pv, barra:(document.getElementById('ripBar')||{}).style?document.getElementById('ripBar').style.width:null,
           pct:(document.getElementById('ripPct')||{}).textContent, etiqueta:(document.getElementById('ripLbl')||{}).textContent,
           eta:(document.getElementById('ripEta')||{}).textContent, brilloPreview:pintado };
})()`), null, 1));

// ---- 4. Esperar a que termine
console.log('\nesperando el render…');
for (let i = 0; i < 240; i++) {
  const s = await evl(`(()=>{ const p=document.getElementById('ripPct'); return p?p.textContent:'FIN'; })()`);
  if (s === 'FIN') break;
  if (i % 6 === 0) console.log('   ', s, await evl(`(()=>{const l=document.getElementById('ripLbl');return l?l.textContent:'';})()`));
  await wait(2000);
}
await wait(3000);

console.log('\nresultado:', JSON.stringify(await evl(`(async()=>{
  const nuevas=state.lanes.map((l,i)=>({i,nombre:l.name,kind:l.kind}));
  const cl=state.clips.map(c=>({lane:c.lane,start:+c.start.toFixed(2),dur:+c.dur.toFixed(2),medio:(mediaById(c.mediaId)||{}).name,fulldome:!!c.props.fulldome}));
  const files=[]; try{ const L=await DSP.listDir('${OUTDIR}\\\\rendered clips'); for(const f of (L||[])) files.push((f.name||f)+' '+(f.size!=null?Math.round(f.size/1e6)+'MB':'')); }catch(e){ files.push('listDir: '+e.message); }
  const nm=state.media.filter(m=>m.kind==='video'&&/rendered clips/i.test(m.path||'')).map(m=>({name:m.name,w:m.w,h:m.h,dur:+(m.dur||0).toFixed(2),reproducible:!!(m.el&&m.el.videoWidth)}));
  return { pistas:nuevas, clips:cl, archivos:files, importado:nm, statusBar:(document.getElementById('statusMsg')||{}).textContent };
})()`), null, 1));

console.log('\nerrores de consola:', errs.length ? errs.slice(0, 12) : 'ninguno');
ws.close();
