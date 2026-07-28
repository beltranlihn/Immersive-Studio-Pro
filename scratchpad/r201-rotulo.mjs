// [R201] ¿Qué proporción del ALTO DE SU MURO ocupa el rótulo (FRONT/LEFT/…) en cada visor?
// En el lienzo 2D es un tamaño fijo de pantalla (11px), así que su proporción sale de cuánto mide el muro en
// pantalla; en el 3D es una fracción fija del muro (wv). Aquí se miden las dos para poder igualarlas.
import { targets } from './cdp.mjs';
import { spawn } from 'child_process';
const wait = ms => new Promise(r => setTimeout(r, ms));
const ROOT = 'C:\\Users\\beltr\\Desktop\\Alma Digital Studio\\Projects\\Immersive Studio Pro';
const p = spawn(ROOT + '\\node_modules\\electron\\dist\\electron.exe', ['.', '--remote-debugging-port=9222'], { cwd: ROOT, stdio: 'ignore' });
let idx = null;
for (let i = 0; i < 250; i++) { const l = await targets(9222).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(200); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws')); });
let _id = 0;
const send = (m, pr) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: pr })); });
await send('Runtime.enable', {});
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, timeout: 120000 }); return r.exceptionDetails ? JSON.stringify(r.exceptionDetails).slice(0, 400) : r.result.value; };
for (let i = 0; i < 150; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await wait(2500);
await evl(`(()=>{ if(!document.getElementById('landingOv'))showLanding(); _lch.ptype='room'; renderLauncher(); return 1; })()`);
await wait(900);

const medir = (cw, ch, zoom) => `(()=>{
  const S=state,V=state.view, out={};
  const bak={w:S.seqW,h:S.seqH,mode:S.seqMode,clips:S.clips,vmode:V.mode,media:S.media,aseq:S.activeSeqId,
             cw:view.cw,ch:view.ch,vs:VSIZE,gw:glc.width,gh:glc.height,rw:gridc.width,rh:gridc.height,ra:_raOn,
             geo:_roomGeo,geoSeq:_roomGeoSeq,zoom:V.zoom};
  try{
    const r={width:${cw},height:${ch}};
    const seq=lchRoomSeqTemp(lchRoomCfg());
    S.media=[seq]; S.activeSeqId=seq.id; S.seqW=seq.w; S.seqH=seq.h; S.seqMode='room'; S.clips=[]; V.mode='2d'; _raOn=false;
    V.zoom=${zoom};
    view.cw=r.width; view.ch=r.height; VSIZE=Math.min(r.width,r.height);
    _drawFlat=true; _roomWrap=true; _compAspect=seq.w/seq.h;
    // el mismo mapeo que usa drawRoomGrid2D
    const M=flatMap(), stripH=seq.h, fy=py=>1-py/stripH*2, fx=px=>px/seq.w*2-1;
    const w0=seq.room.walls[0];
    const arriba=M.px(fx(w0.x0),fy(0)), abajo=M.px(fx(w0.x0),fy(w0.pxH));
    const altoMuroEnPantalla=Math.abs(abajo[1]-arriba[1]);
    const real=11/altoMuroEnPantalla;
    out.lienzo2D={ panel:[Math.round(r.width),Math.round(r.height)], altoDelMuroEnPantalla:+altoMuroEnPantalla.toFixed(1),
      rotuloPx:11, proporcionMEDIDA:+real.toFixed(4) };
    /* Lo que el 3D va a usar. Se mide por OTRO camino que el 2D (aquí, flatMap sobre el mapeo real del visor;
       allí, el reparto de render()), así que coincidir es una comprobación de verdad y no una tautología. */
    const calc=(typeof labelWallFrac==='function')?labelWallFrac(seq.room,seq,w0.role):0.03;
    out.visor3D={ wvCALCULADA:+calc.toFixed(4), antesEraFija:0.03 };
    out.coinciden=Math.abs(calc-real)/real < 0.02 ? 'sí (dentro del 2%)' : '*** NO: '+(+(calc/real).toFixed(3))+'× ***';
    out.factorFrenteAlViejo=+(real/0.03).toFixed(2);
  } finally {
    S.seqW=bak.w;S.seqH=bak.h;S.seqMode=bak.mode;S.clips=bak.clips;V.mode=bak.vmode;S.media=bak.media;S.activeSeqId=bak.aseq;
    view.cw=bak.cw;view.ch=bak.ch;VSIZE=bak.vs;glc.width=bak.gw;glc.height=bak.gh;gridc.width=bak.rw;gridc.height=bak.rh;
    _raOn=bak.ra;_roomGeo=bak.geo;_roomGeoSeq=bak.geoSeq;V.zoom=bak.zoom;
  }
  return JSON.stringify(out,null,1); })()`;

for (const [n, cw, ch, z] of [
  ['panel del launcher (1062×129, zoom .92)', 1062, 129, 0.92],
  ['visor del editor (1000×520, zoom .92)', 1000, 520, 0.92],
  ['visor del editor ESTRECHO (520×700, zoom .92)', 520, 700, 0.92],
  ['editor con zoom 2×', 1000, 520, 2],
]) { console.log('\n### ' + n); console.log(await evl(medir(cw, ch, z))); }
try { ws.close(); } catch (_) { } try { p.kill('SIGKILL'); } catch (_) { }
