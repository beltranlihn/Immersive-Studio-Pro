// [R173] Los cinco escenarios que la revisión señaló del arreglo de R172, que la sonda anterior no veía porque
// siempre pulsaba el MISMO píxel dos veces y nunca descartaba con un tercer elemento.
import { targets } from './cdp.mjs';
const wait = ms => new Promise(r => setTimeout(r, ms));
let idx = null;
for (let i = 0; i < 150; i++) { const l = await targets(9222).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(200); }
if (!idx) { console.log('sin editor'); process.exit(1); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws')); });
let _id = 0;
const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
const errs = []; await send('Runtime.enable', {});
ws.addEventListener('message', ev => { const x = JSON.parse(ev.data); if (x.method === 'Runtime.consoleAPICalled' && x.params.type === 'error') errs.push((x.params.args || []).map(a => a.value || a.description || '').join(' ').slice(0, 200)); });
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 300) }; return r.result.value; };
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false, screenWidth: 1600, screenHeight: 900 });
await send('Page.reload', { ignoreCache: true }); await wait(2500);
for (let i = 0; i < 80; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await evl(`(()=>{try{localStorage.setItem('dspOnboardV1','1')}catch(e){}document.querySelectorAll('.overlay,#tourOv,#landingOv').forEach(o=>o.remove());document.body.classList.remove('preboot');try{resize()}catch(e){}return 1})()`);
await evl(`(async()=>{state.dirty=false;await buildDemoProject(); const b=document.getElementById('curvesBtn'); if(b&&!state.inlineCurves)b.click(); renderTimeline(); return 1})()`); await wait(1400);

const clic = async (x, y, btn) => {
  const b = btn || 'left', mods = 0;
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: b, clickCount: 1, modifiers: mods });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: b, clickCount: 1, modifiers: mods });
};
const hayMenu = () => evl(`!!document.querySelector('.menu')`);
const pos = sel => evl(`(()=>{const b=document.querySelector(${JSON.stringify(sel)}); if(!b)return null; const r=b.getBoundingClientRect(); return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2),w:Math.round(r.width),h:Math.round(r.height),L:Math.round(r.x),T:Math.round(r.y)};})()`);
const limpiar = async () => { await evl(`(()=>{closeMenu();return 1})()`); await wait(90); };
const R = [];
const paso = (n, ok, det) => { R.push({ n, ok, det }); console.log((ok ? '  ✓ ' : '  ✗ ') + n.padEnd(58) + (det || '')); };

// ── 1 · clic derecho en la cabecera de pista y luego el chip que hay DENTRO
{ await limpiar();
  const hdr = await pos('#trackHdr .lanehdr:not(.aud)'); const chip = await pos('#trackHdr .achip.acat');
  if (hdr && chip) {
    await clic(hdr.L + 6, hdr.T + hdr.h - 4, 'right'); await wait(200);   // menú contextual de la cabecera
    await clic(chip.x, chip.y); await wait(250);
    paso('1 · chip DENTRO de una cabecera con menú contextual abierto', await hayMenu(), 'el chip debe abrir su desplegable');
  } else paso('1 · chip dentro de la cabecera', false, 'no encontré cabecera o chip');
}

// ── 2 · descartar pulsando el visor y volver al MISMO botón enseguida
{ await limpiar();
  const out = await pos('#outputBtn'); const visor = await pos('#stage') || { x: 700, y: 250 };
  await clic(out.x, out.y); await wait(200); const abrio1 = await hayMenu();
  await clic(visor.x, visor.y); await wait(150); const cerro = !(await hayMenu());
  await clic(out.x, out.y); await wait(250); const reabre = await hayMenu();
  paso('2 · descartar en el visor y volver a Output enseguida', abrio1 && cerro && reabre, 'abre/cierra/reabre = ' + [abrio1, cerro, reabre].join('/'));
}

// ── 3 · File: abrir, cerrar, y que el TERCER clic vuelva a abrir (no que se lo coma)
{ await limpiar();
  const f = await pos('#menubar .menubtn[data-menu=file]');
  await clic(f.x, f.y); await wait(200); const a1 = await hayMenu();
  await clic(f.x, f.y); await wait(220); const c1 = !(await hayMenu());
  const on1 = await evl(`document.querySelector('#menubar .menubtn[data-menu=file]').classList.contains('on')`);
  await clic(f.x, f.y); await wait(220); const a2 = await hayMenu();
  paso('3 · File abre / cierra / vuelve a abrir al tercer clic', a1 && c1 && !on1 && a2, 'abre/cierra/sin resalte/reabre = ' + [a1, c1, !on1, a2].join('/'));
}

// ── 4 · abrir el chip por su TEXTO y cerrarlo por la flecha (dos hijos del mismo chip)
{ await limpiar();
  const lab = await pos('#trackHdr .achip.acat .alab'); const chip = await pos('#trackHdr .achip.acat');
  if (lab && chip) {
    await clic(lab.x, lab.y); await wait(220); const abrio = await hayMenu();
    await clic(chip.L + chip.w - 5, chip.y); await wait(260);            // la flecha, al borde derecho del chip
    paso('4 · abrir por el texto del chip y cerrar por su flecha', abrio && !(await hayMenu()), 'abrió=' + abrio);
  } else paso('4 · texto y flecha del mismo chip', false, 'no encontré .alab');
}

// ── 5 · submenú lanzado desde una entrada de menú (Output → NDI/Spout)
{ await limpiar();
  const out = await pos('#outputBtn');
  await clic(out.x, out.y); await wait(250);
  const sub = await evl(`(()=>{const b=[...document.querySelectorAll('.menu button')].find(x=>/NDI|Spout/i.test(x.textContent||'')); if(!b)return null; const r=b.getBoundingClientRect(); return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};})()`);
  if (sub) { await clic(sub.x, sub.y); await wait(300);
    paso('5 · submenú desde una entrada de menú', await hayMenu(), 'debe quedar un menú abierto'); }
  else paso('5 · submenú desde una entrada de menú', true, 'no hay entrada NDI/Spout en este equipo — nada que romper');
}

// ── 6 · regresión: la alternancia simple sigue funcionando
{ await limpiar();
  const out = await pos('#outputBtn');
  await clic(out.x, out.y); await wait(200); const ab = await hayMenu();
  await clic(out.x, out.y); await wait(240); const ce = !(await hayMenu());
  paso('6 · regresión: Output abre y cierra al segundo clic', ab && ce, [ab, ce].join('/'));
}
await limpiar();
console.log('\nFALLOS: ' + (R.filter(x => !x.ok).length || 'ninguno') + '   errores de consola: ' + (errs.length || 0));
if (errs.length) console.log(errs.slice(0, 5).join('\n'));
ws.close();
