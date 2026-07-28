// [R200] Los cinco ajustes de Beltrán: lienzo cosido en negro · preajuste con muros Y suelo · los DOS visores 3D
// interactivos · en la sala, planta a la izquierda y 3D a la derecha · el desplegable de orientación abre.
import { targets } from './cdp.mjs';
import { spawn } from 'child_process';
const wait = ms => new Promise(r => setTimeout(r, ms));
const ROOT = 'C:\\Users\\beltr\\Desktop\\Alma Digital Studio\\Projects\\Immersive Studio Pro';
// `node r200-ajustes.mjs viejo` ataca el .exe INSTALADO (R199) como control: allí el menú nace con z-index 60.
const VIEJO = process.argv[2] === 'viejo', PORT = VIEJO ? 9223 : 9222;
const p = VIEJO
  ? spawn('C:\\Users\\beltr\\AppData\\Local\\Programs\\Immersive Studio Pro\\Immersive Studio Pro.exe', ['--remote-debugging-port=' + PORT], { stdio: 'ignore' })
  : spawn(ROOT + '\\node_modules\\electron\\dist\\electron.exe', ['.', '--remote-debugging-port=' + PORT], { cwd: ROOT, stdio: 'ignore' });
console.log(VIEJO ? '=== CONTROL: .exe instalado (R199) ===' : '=== dev (R200) ===');
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
await evl(`(()=>{ if(!document.getElementById('landingOv'))showLanding(); return 1; })()`);

console.log('\n--- 5 · el desplegable de orientación ABRE y se ve ---');
console.log(await evl(`(async()=>{
  _lch.ptype='room'; renderLauncher(); await new Promise(r=>setTimeout(r,300));
  document.querySelectorAll('.menu').forEach(x=>x.remove());
  const b=document.querySelector('#lchPanel [data-lface]'); if(!b)return 'no hay muros';
  const r=b.getBoundingClientRect(); b.onclick({clientX:r.left+10,clientY:r.bottom});
  const m=document.querySelector('.menu');
  if(!m)return JSON.stringify({abre:false});
  const cs=getComputedStyle(m), mr=m.getBoundingClientRect();
  const ovz=getComputedStyle(document.getElementById('landingOv')).zIndex;
  // ¿quién está de verdad en ese punto? si el menú queda debajo del overlay, elementFromPoint devuelve otra cosa
  const encima=document.elementFromPoint(mr.left+8, mr.top+8);
  const dentro=!!(encima&&m.contains(encima));
  const opciones=[...m.querySelectorAll('*')].filter(x=>x.children.length===0).map(x=>x.textContent.trim()).filter(Boolean);
  document.querySelectorAll('.menu').forEach(x=>x.remove());
  return JSON.stringify({abre:true, zMenu:cs.zIndex, zLanding:ovz, visibleDeVerdad:dentro, opciones}); })()`, 1));

console.log('\n--- 4 · planta a la IZQUIERDA, 3D a la DERECHA ---');
console.log(await evl(`(async()=>{
  _lch.ptype='room'; renderLauncher(); await new Promise(r=>setTimeout(r,400));
  const ov=document.getElementById('landingOv');
  const pl=ov.querySelector('#lchCvIso').getBoundingClientRect(), d3=ov.querySelector('#lchCvRoom3d').getBoundingClientRect();
  return JSON.stringify({plantaX:Math.round(pl.left), visor3dX:Math.round(d3.left),
    orden:(pl.left<d3.left)?'planta izquierda · 3D derecha ✓':'*** al revés ***'}); })()`));

console.log('\n--- 1 · el lienzo cosido, en negro ---');
console.log(await evl(`(()=>{ const ov=document.getElementById('landingOv');
  const box=ov.querySelector('.lch-stitch'), wrap=ov.querySelector('#lchCvStrip').parentElement;
  return JSON.stringify({caja:getComputedStyle(box).backgroundColor, lienzo:getComputedStyle(wrap).backgroundColor,
    panelesDeArriba:getComputedStyle(ov.querySelector('.lch-pane')).backgroundColor}); })()`));

console.log('\n--- 3 · los DOS visores 3D responden al arrastre y a la rueda ---');
console.log(await evl(`(async()=>{
  const ov=document.getElementById('landingOv');
  const tinta=cv=>{ const d=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data; let s=0;
    for(let i=0;i<d.length;i+=4)s+=d[i+1]; return s; };
  const gira=async(tipo,paneSel,cvSel)=>{
    _lch.ptype=tipo==='dome'?'dome':'room'; renderLauncher(); await new Promise(r=>setTimeout(r,450));
    const pane=ov.querySelector(paneSel), cv=ov.querySelector(cvSel);
    if(!pane||!cv)return {hayPanel:false};
    const antes=tinta(cv), camA={...(_lch[tipo==='dome'?'domeCam':'roomCam'])};
    const r=pane.getBoundingClientRect(), x=r.left+r.width/2, y=r.top+r.height/2;
    pane.onpointerdown({button:0,clientX:x,clientY:y,pointerId:1,preventDefault(){}});
    pane.dispatchEvent(new PointerEvent('pointermove',{clientX:x+120,clientY:y+30,bubbles:true}));
    pane.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));
    const camB={...(_lch[tipo==='dome'?'domeCam':'roomCam'])}, tras=tinta(cv);
    pane.dispatchEvent(new WheelEvent('wheel',{deltaY:-240,bubbles:true,cancelable:true}));
    const camC={...(_lch[tipo==='dome'?'domeCam':'roomCam'])};
    return { arrastreMueveLaCamara:(camA.yaw!==camB.yaw||camA.pitch!==camB.pitch),
             laImagenCambia:(antes!==tras), ruedaAcerca:(camB.dist!==camC.dist),
             yaw:[+camA.yaw.toFixed(3),+camB.yaw.toFixed(3)], dist:[+camB.dist.toFixed(2),+camC.dist.toFixed(2)] }; };
  return JSON.stringify({ domo:await gira('dome','#lchCvDome3dPane','#lchCvDome3d'),
                          sala:await gira('room','#lchRoom3d','#lchCvRoom3d') },null,1); })()`));

console.log('\n--- 2 · el preajuste guarda muros Y suelo ---');
console.log(await evl(`(()=>{
  try{ localStorage.removeItem('ispRoomPresets'); }catch(e){}
  _lch.ptype='room'; lchSetWallCount(4);
  _lch.walls.find(w=>w.role==='Front').wcm=1234; _lch.walls.find(w=>w.role==='Front').pxW=3000;
  _lch.walls.find(w=>w.role==='Left').hcm=321;
  _lch.roomFloor=true; lchApply('fpxW',2560); lchApply('fpxH',1440);
  const antes={muros:lchCfgWalls(), piso:lchFloorCfg(lchCfgWalls()), piso_on:_lch.roomFloor};
  // guardar (appPrompt es asíncrono con UI → se replica su cuerpo tal cual lo hace lchSaveUserPreset)
  const piso=lchFloorCfg(lchCfgWalls());
  localStorage.setItem('ispRoomPresets',JSON.stringify([{label:'Mi sala',count:_lch.roomCount,
    walls:lchActiveWalls().map(w=>({role:w.role,pxW:w.pxW,pxH:w.pxH,wcm:w.wcm,hcm:w.hcm})),
    floor:!!_lch.roomFloor, floorPx:{pxW:piso.pxW,pxH:piso.pxH}}]));
  // destrozarlo todo y recuperar
  lchSetWallCount(2); _lch.walls.forEach(w=>{ w.wcm=100; w.hcm=100; w.pxW=64; w.pxH=64; });
  _lch.roomFloor=false; _lch.floorPx=null;
  lchApplyPreset('u:0');
  const tras={muros:lchCfgWalls(), piso:lchFloorCfg(lchCfgWalls()), piso_on:_lch.roomFloor};
  const roles=_lch.walls.map(w=>w.role);
  try{ localStorage.removeItem('ispRoomPresets'); }catch(e){}
  return JSON.stringify({ antes, tras,
    murosIguales:JSON.stringify(antes.muros)===JSON.stringify(tras.muros),
    pisoIgual:JSON.stringify(antes.piso)===JSON.stringify(tras.piso)&&antes.piso_on===tras.piso_on,
    rolesUnicos:new Set(roles).size===roles.length, roles },null,1); })()`));

console.log('\nerrores:', errs.length ? errs.slice(0, 8) : 'ninguno');
try { ws.close(); } catch (_) { } try { p.kill('SIGKILL'); } catch (_) { }
