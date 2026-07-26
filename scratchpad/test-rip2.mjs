// ¿El horneado tiene IMAGEN de verdad, y el preview del visor pinta? Se usa un tramo con contenido.
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
  if (x.method === 'Runtime.consoleAPICalled' && x.params.type === 'error') errs.push((x.params.args || []).map(a => a.value || a.description || '').join(' ').slice(0, 200));
  if (x.method === 'Runtime.exceptionThrown') errs.push('excepción: ' + ((x.params.exceptionDetails.exception && x.params.exceptionDetails.exception.description) || '').slice(0, 220)); });
const evl = async (e, t = 900000) => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, timeout: t }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 400) }; return r.result.value; };

// Mover el clip original a un tramo CON imagen (in-point 4 s) y borrar lo horneado antes
console.log('preparar:', JSON.stringify(await evl(`(()=>{
  // dejar sólo el clip fuente, en la pista 0, tomando del segundo 4 del material
  const src=state.clips.find(c=>c.lane===0); if(!src)return {error:'sin clip fuente'};
  state.clips=[src]; state.lanes=state.lanes.filter(l=>!/^RIP/.test(l.name));
  src.inP=4.0; src.start=0; src.dur=1.0;
  state.playhead=0.5; renderTimeline(); render();
  return { clips:state.clips.length, pistas:state.lanes.length, inP:src.inP };
})()`), null, 1));

// brillo del COMPOSITE original a media duración (referencia)
await evl(`(async()=>{ await seekExport(0.5); prepNests(state.clips,0.5,0); return true; })()`);
console.log('\nbrillo del composite original:', await evl(`(()=>{
  renderExportFrame(0.5, 2048, 1, null);
  const c=document.createElement('canvas'); c.width=64;c.height=64; const x=c.getContext('2d'); x.drawImage(glc,0,0,64,64);
  const d=x.getImageData(0,0,64,64).data; let s=0,mx=0; for(let i=0;i<d.length;i+=4){const v=(d[i]+d[i+1]+d[i+2])/3; s+=v; if(v>mx)mx=v;}
  return { medio:Math.round(s/(64*64)), max:Math.round(mx) };
})()`));

// lanzar RIP y muestrear el preview a mitad
console.log('\n→ Render in place…');
await evl(`(()=>{ window._ripP=renderInPlace(state.clips[0]); return true; })()`);
await wait(2200);
await evl(`(()=>{ const g=document.getElementById('ripGo'); if(g)g.click(); return true; })()`);

const muestras = [];
for (let i = 0; i < 200; i++) {
  const s = await evl(`(()=>{ const pv=document.getElementById('ripPv'); if(!pv)return null;
    const c=document.createElement('canvas'); c.width=32;c.height=32; const x=c.getContext('2d'); x.drawImage(pv,0,0,32,32);
    const d=x.getImageData(0,0,32,32).data; let s=0,mx=0; for(let k=0;k<d.length;k+=4){const v=(d[k]+d[k+1]+d[k+2])/3; s+=v; if(v>mx)mx=v;}
    return { pct:(document.getElementById('ripPct')||{}).textContent, medio:Math.round(s/(32*32)), max:Math.round(mx) }; })()`);
  if (!s) break;
  muestras.push(s);
  await wait(1200);
}
console.log('muestras del preview:', JSON.stringify(muestras.filter((_, i) => i % 3 === 0).slice(0, 8)));
await wait(4000);

// comprobar el fichero horneado: reproducirlo y medir brillo
console.log('\nfichero horneado:', JSON.stringify(await evl(`(async()=>{
  const m=state.media.filter(x=>/rendered clips/i.test(x.path||'')).pop();
  if(!m)return {error:'no se importó nada'};
  let st=null; try{ st=await DSP.stat(m.path); }catch(e){}
  const v=document.createElement('video'); v.muted=true; v.src=DSP.toFileURL(m.path);
  const meta=await new Promise(r=>{ let d=false; v.onloadedmetadata=()=>{if(!d){d=true;r({w:v.videoWidth,h:v.videoHeight,dur:+v.duration.toFixed(2)});}}; v.onerror=()=>{if(!d){d=true;r({error:'no carga'});}}; setTimeout(()=>{if(!d){d=true;r({error:'timeout'});}},15000); });
  let px=null;
  if(!meta.error){ await new Promise(r=>{ v.currentTime=0.5; v.onseeked=r; setTimeout(r,8000); });
    const c=document.createElement('canvas'); c.width=64;c.height=64; const x=c.getContext('2d'); x.drawImage(v,0,0,64,64);
    const d=x.getImageData(0,0,64,64).data; let s=0,mx=0; for(let k=0;k<d.length;k+=4){const q=(d[k]+d[k+1]+d[k+2])/3; s+=q; if(q>mx)mx=q;}
    px={medio:Math.round(s/(64*64)),max:Math.round(mx)}; }
  const nc=state.clips.find(c=>c.mediaId===m.id);
  return { nombre:m.name, MB:st?+(st.size/1e6).toFixed(2):null, meta, brillo:px,
           clip:nc?{lane:nc.lane,start:+nc.start.toFixed(2),dur:+nc.dur.toFixed(2),fulldome:!!nc.props.fulldome,esPistaMasAlta:nc.lane===state.lanes.length-1}:null,
           originalIntacto: !!state.clips.find(c=>c.lane===0) };
})()`), null, 1));

console.log('\nerrores:', errs.length ? errs.slice(0, 8) : 'ninguno');
ws.close();
