// ¿Por qué la sala por muro escribe un solo archivo con contenido?
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
  if (x.method === 'Runtime.consoleAPICalled') errs.push(x.params.type + ': ' + (x.params.args || []).map(a => a.value || a.description || '').join(' ').slice(0, 160));
  if (x.method === 'Runtime.exceptionThrown') errs.push('EXC: ' + ((x.params.exceptionDetails.exception || {}).description || '').slice(0, 160)); });
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, timeout: 300000 }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 260) }; return r.result.value; };
for (let i = 0; i < 120; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await wait(1300);

const SRC = 'C:\\\\Users\\\\beltr\\\\Desktop\\\\Rito Movie\\\\Asset\\\\Creation\\\\Front1.mp4';
const OUT = 'C:\\\\Users\\\\beltr\\\\AppData\\\\Local\\\\Temp\\\\claude\\\\muros';

console.log('montaje:', await evl(`(async()=>{
  const o=document.getElementById('landingOv'); if(o)o.remove(); const t=document.getElementById('tourOv'); if(t)t.remove();
  await DSP.ensureDir('${OUT}'); currentPath='${OUT}\\\\p.isp';
  const m=await addVideoFromPath('${SRC}','Front1');
  state.clips=[]; const c=makeClip(m,0,0); c.start=0;c.dur=1;c.inP=3; c.props.scale=420; state.clips.push(c); // escala 420: el clip cubre la TIRA ENTERA, asi que los tres muros deben traer imagen
  state.workIn=null;state.workOut=null;
  const as=activeSeq(); as.w=1920;as.h=360;as.mode='room';as.fps=30; state.seqW=1920;state.seqH=360;state.seqMode='room';state.fps=30;
  as.room={walls:[{role:'front',x0:0,x1:640,pxW:640,pxH:360,wcm:800,hcm:450,order:0},
                  {role:'right',x0:640,x1:1280,pxW:640,pxH:360,wcm:800,hcm:450,order:1},
                  {role:'back', x0:1280,x1:1920,pxW:640,pxH:360,wcm:800,hcm:450,order:2}],floorSeqId:null};
  // se anota por trabajo: ruta, bytes contados, si hubo fileOpen y en que etapa acabo
  window._log=[]; let k=0; window._origRun=runExport;
  window.runExport=function(op){ const i=k++; const path='${OUT}\\\\m'+i+'.mp4'; op.outPath=path;
    const e={i,path:'m'+i+'.mp4',bytes:0,fin:null};
    const ow=op.job.wrote, od=op.job.done;
    op.job.wrote=b=>{ e.bytes+=b||0; if(ow)ow(b); };
    op.job.done=cx=>{ e.fin=cx?'cancelado':'ok'; e.etapa=_exStage; if(od)od(cx); };
    window._log.push(e);
    return window._origRun(op); };
  return 'ok'; })()`));

await evl(`(()=>{ const p=document.getElementById('exOv'); if(p)p.remove(); openExport(); return true; })()`);
for (let i = 0; i < 40; i++) { if (await evl(`(()=>{const s=document.getElementById('exCodec');return s&&s.options.length>0;})()`)) break; await wait(300); }
await evl(`(()=>{ document.querySelector('#exRoomMode button[data-rm="walls"]').click();
  const s=document.getElementById('exCodec'); s.value='mp4'; s.dispatchEvent(new Event('change')); return true; })()`);
for (let i = 0; i < 40; i++) { if (await evl(`(()=>{const b=document.getElementById('exGo');return !!b&&!b.disabled;})()`)) break; await wait(400); }
await evl(`(()=>{ document.getElementById('exGo').click(); return true; })()`);
for (let i = 0; i < 70; i++) { await wait(1500); if (/"exporting":false/.test(await evl(`(()=>JSON.stringify({exporting:exporting,cola:_exq.length}))()`))) { await wait(1500); break; } }

console.log('\npor trabajo:', await evl(`(()=>JSON.stringify(window._log,null,1))()`));
console.log('\narchivos en disco:', await evl(`(async()=>{ const r=[]; for(let i=0;i<3;i++){ try{const s=await DSP.stat('${OUT}\\\\m'+i+'.mp4'); r.push('m'+i+' '+(s.size/1e6).toFixed(2)+'MB');}catch(e){r.push('m'+i+' NO EXISTE');} } return JSON.stringify(r); })()`));
console.log('\ntrabajos en el registro:', await evl(`(()=>JSON.stringify(_exJobs.map(j=>({n:j.name,s:j.status,p:+(j.p||0).toFixed(2)}))))()`));
await evl(`(()=>{ if(window._origRun)window.runExport=window._origRun; return true; })()`);
console.log('\nconsola:', errs.length ? errs.slice(0, 10) : 'nada');
ws.close();
