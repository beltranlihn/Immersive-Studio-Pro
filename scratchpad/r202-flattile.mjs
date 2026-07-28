// [R202 · tanda 5] «Flat tile» en la configuración del relleno de domo.
// Se comprueba: la casilla existe y sólo en relleno · llega al proyecto · los clips salen SIN sector curvado y
// conservan su proporción · la vista previa deja de dibujar sectores · el modo sobrevive a reabrir el diálogo.
import { targets } from './cdp.mjs';
import { spawn } from 'child_process';
const wait = ms => new Promise(r => setTimeout(r, ms));
const ROOT = 'C:\\Users\\beltr\\Desktop\\Alma Digital Studio\\Projects\\Immersive Studio Pro';
const VIEJO = process.argv[2] === 'viejo', PORT = VIEJO ? 9223 : 9222;
const p = VIEJO
  ? spawn('C:\\Users\\beltr\\AppData\\Local\\Programs\\Immersive Studio Pro\\Immersive Studio Pro.exe', ['--remote-debugging-port=' + PORT], { stdio: 'ignore' })
  : spawn(ROOT + '\\node_modules\\electron\\dist\\electron.exe', ['.', '--remote-debugging-port=' + PORT], { cwd: ROOT, stdio: 'ignore' });
console.log(VIEJO ? '=== CONTROL: .exe instalado (R201, sin la opción) ===' : '=== dev (R202) ===');
let idx = null;
for (let i = 0; i < 250; i++) { const l = await targets(PORT).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(200); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws')); });
let _id = 0;
const send = (m, pr) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: pr })); });
const errs = []; await send('Runtime.enable', {});
ws.addEventListener('message', ev => { const x = JSON.parse(ev.data); if (x.method === 'Runtime.exceptionThrown') errs.push(((x.params.exceptionDetails.exception || {}).description || '').slice(0, 200)); });
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, timeout: 120000 }); return r.exceptionDetails ? JSON.stringify(r.exceptionDetails).slice(0, 400) : r.result.value; };
for (let i = 0; i < 150; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await wait(2500);
// un proyecto domo con un medio (forma) para poder componer, y matar el autoguardado que cuelga los scripts
await evl(`setInterval(()=>{const b=document.querySelector('#confirmOv #cfCancel'); if(b)b.click();},120);1`);
console.log('proyecto de prueba:', await evl(`(async()=>{ try{ hideLanding(); }catch(e){}
  await newProject('dome',2048,2048,60,180);
  const m={id:uid(),kind:'shape',name:'T',shape:'rect',fill:'#8ab',stroke:'#000',strokeW:0,sw:1600,sh:900,dur:6,fps:0,color:clipColorFor('shape')};
  renderShapeMedia(m); state.media.push(m); renderMedia(); return state.media.length; })()`));

console.log('\n--- la casilla existe y SÓLO en relleno de domo ---');
console.log(await evl(`(()=>{ document.querySelectorAll('#compOv').forEach(x=>x.remove());
  openCompose('domegrid');
  const box=document.getElementById('cNoWarp'); if(!box)return JSON.stringify({existe:false});
  const fila=box.closest('.frow');
  const visibleEnRelleno=fila.style.display!=='none';
  // cambiar a 'anillo' debe esconderla
  document.querySelector('#cKind [data-k=ring]').onclick();
  const visibleEnAnillo=fila.style.display!=='none';
  document.querySelector('#cKind [data-k=domegrid]').onclick();
  const r=JSON.stringify({existe:true, visibleEnRelleno, visibleEnAnillo,
    etiqueta:fila.textContent.trim().slice(0,60),
    veredicto:(visibleEnRelleno&&!visibleEnAnillo)?'correcto':'*** MAL ***'});
  return r; })()`));

// createComposition crea un NIDO (media kind:'nest' con .comp), no un grupo de state.groups
console.log('\n--- crear con la casilla marcada: llega al proyecto y los clips salen SIN sector ---');
console.log(await evl(`(()=>{
  const box=document.getElementById('cNoWarp'); if(!box)return 'no hay casilla';
  document.getElementById('cRings').value=3; document.getElementById('cSegs').value=6;
  box.checked=true; box.onchange&&box.onchange();
  document.getElementById('cGo').onclick();
  const nest=state.media.filter(m=>isSeqMedia(m)&&m.comp).pop(); if(!nest)return 'no se creó el nido';
  window.__nest=nest;
  const clips=nest.nestClips||[];
  /* Lo que decide si el clip se estira hasta llenar su celda es SOLO warp==='dome' (app.js:844, uniforme
     LW.sector). El valor 'patch' es el modo sin deformar, y secAz/secEl quedan de relleno sin efecto: mirarlos
     tambien —como hacia la primera version de esta prueba— marcaba como deformados clips que no lo estan. */
  const conSector=clips.filter(c=>c.props&&c.props.warp==='dome').length;
  const els=[...new Set(clips.map(c=>c.props&&Math.round(c.props.el)))].sort((a,b)=>a-b);
  return JSON.stringify({ noWarpEnLaComposicion:!!nest.comp.noWarp, clips:clips.length,
    clipsConSectorCurvado:conSector, elevacionesDistintas:els,
    veredicto:(nest.comp.noWarp&&clips.length===18&&conSector===0&&els.length===3)?'correcto: 3 anillos × 6, sin deformar':'*** MAL ***'},null,1); })()`));

console.log('\n--- la MISMA composición sin la casilla sí lleva sector (control interno) ---');
console.log(await evl(`(()=>{
  const nest=window.__nest; if(!nest)return 'sin nido';
  nest.comp.noWarp=false; regenComposeNest(nest);
  const conSector=(nest.nestClips||[]).filter(c=>c.props&&c.props.warp==='dome'&&c.props.secAz!=null).length;
  nest.comp.noWarp=true; regenComposeNest(nest);
  const conSector2=(nest.nestClips||[]).filter(c=>c.props&&c.props.warp==='dome'&&c.props.secAz!=null).length;
  return JSON.stringify({sinLaCasilla_conSector:conSector, conLaCasilla_conSector:conSector2,
    veredicto:(conSector>0&&conSector2===0)?'correcto: la casilla es lo que quita la deformación':'*** MAL ***'}); })()`));

console.log('\n--- la vista previa deja de dibujar sectores ---');
console.log(await evl(`(()=>{
  const cv=document.createElement('canvas'); cv.width=222; cv.height=222;
  const g={kind:'domegrid',mediaIds:[state.media[1].id],count:18,rings:3,segs:6,elMin:0,elMax:90,size:40,gapEl:0,gapAz:0,mask:'none',rand:[],jitter:0,spin:0};
  /* Se mide QUÉ PARTE DEL DISCO queda cubierta por elementos. Los sectores lo embaldosan casi entero; las
     baldosas planas son 18 manchas sueltas. Comparar las dos imágenes píxel a píxel NO valía: en el build viejo
     también salen distintas, porque sin secAz los sectores se dibujan más estrechos — o sea que cambiaban sin
     que la opción hiciera nada. Contar píxeles opacos tampoco (el disco de fondo es opaco) ni "tinta de color"
     (los colores de clip son grises: #3C4046…). */
  const cx=111, cy=111, R=111-7;   // el mismo radio que usa drawComposePreview (min(W,H)/2 - 7)
  // el color REAL del disco es UI.s0 (lo pinta drawComposePreview); tomarlo de una esquina daba el lienzo vacío
  const ref=document.createElement('canvas'); ref.width=ref.height=1;
  { const rx=ref.getContext('2d'); rx.fillStyle=UI.s0; rx.fillRect(0,0,1,1); }
  const bg=ref.getContext('2d').getImageData(0,0,1,1).data;
  /* Se mide el ANILLO EXTERIOR del disco (0,92R–0,99R). Con el relleno de 0° a 90° los sectores llegan al borde y
     lo cubren entero; las baldosas planas del anillo de abajo se quedan cortas, así que ahí no hay casi nada.
     Es lo que separa de verdad los dos dibujos: la cobertura del disco completo daba 35% contra 29% —demasiado
     cerca para fiarse—, porque en el build viejo los sectores salen más estrechos pero siguen siendo sectores. */
  const anillo=()=>{ const d=cv.getContext('2d').getImageData(0,0,222,222).data; let dentro=0, conElemento=0;
    for(let y=0;y<222;y++)for(let x=0;x<222;x++){ const r=Math.hypot(x-cx,y-cy); if(r<R*0.92||r>R*0.99)continue; dentro++;
      const i=(y*222+x)*4; if(Math.abs(d[i]-bg[0])>8||Math.abs(d[i+1]-bg[1])>8||Math.abs(d[i+2]-bg[2])>8)conElemento++; }
    return +(100*conElemento/Math.max(1,dentro)).toFixed(1); };
  drawComposePreview({...g,noWarp:false},cv); const conSector=anillo();
  drawComposePreview({...g,noWarp:true},cv);  const plano=anillo();
  return JSON.stringify({bordeCubiertoConSectores:conSector+'%', bordeCubiertoConBaldosas:plano+'%',
    veredicto:(conSector>85 && plano<25)?'correcto: los sectores llegan al borde, las baldosas no':'*** MAL ***'}); })()`));

console.log('\n--- reabrir el diálogo conserva la casilla ---');
console.log(await evl(`(()=>{
  const nest=window.__nest; if(!nest)return 'sin nido';
  document.querySelectorAll('#compOv').forEach(x=>x.remove());
  openCompose(nest.comp.kind,null,nest);
  const box=document.getElementById('cNoWarp');
  const r=JSON.stringify({composicionTiene:!!nest.comp.noWarp, casillaMarcada:!!(box&&box.checked),
    veredicto:(box&&box.checked===!!nest.comp.noWarp)?'correcto':'*** MAL ***'});
  document.querySelectorAll('#compOv').forEach(x=>x.remove());
  return r; })()`));

console.log('\nerrores:', errs.length ? errs.slice(0, 6) : 'ninguno');
try { ws.close(); } catch (_) { } try { p.kill('SIGKILL'); } catch (_) { }
