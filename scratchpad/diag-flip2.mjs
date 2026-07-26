// Experimento decisivo: contenido SOLO en la banda superior de un nest 16:9.
// Con cache: ¿aparece abajo (VOLTEO) o aplastado hacia el centro (LETTERBOX)?
import { targets } from './cdp.mjs';
const wait = ms => new Promise(r => setTimeout(r, ms));
let idx = null;
for (let i = 0; i < 300; i++) { const l = await targets(9222).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(150); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws')); });
let _id = 0;
const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
await send('Runtime.enable', {});
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, timeout: 300000 }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 260) }; return r.result.value; };
for (let i = 0; i < 120; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await wait(1300);

const OUT = 'C:\\\\Users\\\\beltr\\\\AppData\\\\Local\\\\Temp\\\\claude\\\\flip2';

console.log('montaje (nest 16:9, barra SOLO arriba):', await evl(`(async()=>{
  const o=document.getElementById('landingOv'); if(o)o.remove(); const t=document.getElementById('tourOv'); if(t)t.remove();
  const as=activeSeq(); as.w=1920;as.h=1080;as.mode='flat';as.fps=30; state.seqW=1920;state.seqH=1080;state.seqMode='flat';state.fps=30;
  await DSP.ensureDir('${OUT}'); currentPath='${OUT}\\\\f.isp';
  // una FORMA blanca fina, pegada al borde SUPERIOR del lienzo del nest
  const m={id:uid(),kind:'shape',name:'Barra',shape:'rect',fill:'#FFFFFF',stroke:'#0E0F11',strokeW:0,sw:512,sh:512,dur:6,fps:0,color:clipColorFor('shape'),folder:null};
  renderShapeMedia(m); state.media.push(m);
  const nl=[{id:uid(),name:'V1',tag:'V1',kind:'video'}];
  const c=makeClip(m,0,0); c.start=0;c.dur=1;c.inP=0;
  c.props.x=0; c.props.y=78; c.props.scale=80; c.props.scaleY=0.12;   // barra fina arriba del todo
  const nest={id:uid(),name:'N169',kind:'nest',w:1920,h:1080,dur:1,fps:30,mode:'flat',
    nestClips:[c],nestLanes:nl,nestMarkers:[],nestGroups:[],tex:newTex(),thumb:null,color:clipColorFor('nest'),folder:null};
  state.media.push(nest); adopt(nest);
  state.clips=[]; const nc=makeClip(nest,0,0); nc.start=0;nc.dur=1;nc.inP=0; state.clips.push(nc);
  window._N=nest.id; state.playhead=0.5; renderMedia(); renderTimeline(); render();
  return 'ok'; })()`));

const perfil = () => evl(`(async()=>{ await scrubRender(); await new Promise(r=>setTimeout(r,700));
  const c=document.createElement('canvas'); c.width=32;c.height=32; const x=c.getContext('2d',{willReadFrequently:true});
  x.drawImage(glc,0,0,32,32); const d=x.getImageData(0,0,32,32).data;
  const filas=[]; for(let Y=0;Y<32;Y++){ let s=0; for(let X=0;X<32;X++){const i=(Y*32+X)*4; s+=(d[i]+d[i+1]+d[i+2])/3;} filas.push(Math.round(s/32)); }
  let mejor=0,fila=-1; filas.forEach((v,i)=>{ if(v>mejor){mejor=v;fila=i;} });
  return JSON.stringify({filaMasBrillante:fila, brillo:mejor, perfil:filas}); })()`);

console.log('\nSIN cache:', await evl(`(async()=>{ state.view.useNestCache=false; return true; })()`) && await perfil());

console.log('\ngenerando el proxy…');
await evl(`(()=>{ window._P=ncBuild(mediaById(window._N)); return true; })()`);
for (let i = 0; i < 60; i++) { if (await evl(`!!document.getElementById('ncGo')`)) break; await wait(300); }
await evl(`document.getElementById('ncGo').click()`);
for (let i = 0; i < 40; i++) { if (await evl(`!!document.getElementById('ripPv')`)) break; await wait(250); }
for (let i = 0; i < 160; i++) { if (!(await evl(`!!document.getElementById('ripPv')`))) break; await wait(1200); }
for (let i = 0; i < 40; i++) { if (await evl(`(()=>{const m=mediaById(window._N);return !!m.ncReady;})()`)) break; await wait(700); }
console.log('cache:', await evl(`(()=>{const m=mediaById(window._N);return JSON.stringify({listo:!!m.ncReady,rancio:!!m.ncStale,dim:m.ncW+'x'+m.ncH});})()`));

await evl(`(async()=>{ state.view.useNestCache=true; await scrubRender(); await new Promise(r=>setTimeout(r,1500)); return true; })()`);
console.log('\nCON cache:', await perfil());
ws.close();
