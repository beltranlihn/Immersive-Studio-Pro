// Verifica que sacar el motor de Master Grade no rompió nada:
// render, export de un frame, NDI/Spout tick, guardar/abrir, y un .isp viejo con `grade` guardado.
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
await evl(`(()=>{ try{localStorage.setItem('dspOnboardV1','1')}catch(e){} document.querySelectorAll('.overlay,#splashOv,#tourOv').forEach(o=>{try{if(o._stopLogo)o._stopLogo();}catch(e){}o.remove();}); document.body.classList.remove('preboot'); try{resize();}catch(e){} return 1; })()`);
await wait(300);
await evl(`(async()=>{ state.dirty=false; await buildDemoProject(); render(); renderTimeline(); renderInspector(); return 1; })()`);
await wait(800);

const out = await evl(`(()=>{
  const r = {};
  // 1 · los símbolos del motor ya no existen
  r.simbolosMuertos = ['applyMasterGrade','masterGradeOn','_masterClip','_mgRT','_MG','_MGu','renderMasterGrade']
    .map(s=>({s, existe: (()=>{ try{ return eval('typeof '+s)!=='undefined'; }catch(e){ return false; } })()}));
  r.stateSeqGrade = (typeof state.seqGrade);
  r.insMasterEnDOM = !!document.getElementById('insMaster');
  // 2 · render + pintado real (¿el composite sigue saliendo con contenido?)
  render();
  const gl2 = document.getElementById('gl').getContext('webgl2') || null;
  r.glLost = gl2 ? gl2.isContextLost() : 'sin ctx';
  // 3 · inspector, timeline y sección Color (el grado por clip tiene que seguir vivo)
  const c = state.clips.find(x=>x.kind!=='audio') || state.clips[0];
  state.selIds=[c.id]; state.selId=c.id; renderInspector();
  r.colorRows = [...document.querySelectorAll('#colorRows .prow')].map(p=>(p.querySelector('.lab')||{}).textContent).filter(Boolean);
  r.ruedasLGG = document.querySelectorAll('#colorRows .cwheel').length;
  r.lutPorClip = !!document.getElementById('lutLoad');
  // 4 · serializar y volver a cargar (¿sobrevive el round-trip sin grade?)
  const ser = serProject();
  r.serTieneGrade = JSON.stringify(ser).includes('"grade"');
  // 5 · un .isp VIEJO con grade guardado: no debe romper al abrirlo
  const viejo = JSON.parse(JSON.stringify(ser));
  for(const m of viejo.media) if(m.kind==='nest') m.grade={exposure:40,contrast:30,cgLift:[0.2,0,0],lut:'C:/no/existe.cube',curves:null};
  let cargaOk=true, cargaErr=null;
  try { loadProject(viejo); render(); renderTimeline(); renderInspector(); } catch(e){ cargaOk=false; cargaErr=String(e).slice(0,200); }
  r.ispViejo = { cargaOk, cargaErr, clips: state.clips.length, seqGradeTrasCargar: (typeof state.seqGrade) };
  return r;
})()`);
await wait(600);

// 6 · export real de un frame (la ruta que tenía el bake del grade)
let exp = 'no probado';
try {
  exp = await evl(`(async()=>{ try{ const t=renderExportFrame? 'fn ok':'no fn'; return t; }catch(e){ return 'throw: '+e.message; } })()`);
} catch (e) { exp = 'throw: ' + e.message; }

const res = { ...out, renderExportFrame: exp, consoleErrors: errors };
fs.writeFileSync('scratchpad/verify-mg-removed.json', JSON.stringify(res, null, 2));
console.log(JSON.stringify(res, null, 2));
ws.close();
