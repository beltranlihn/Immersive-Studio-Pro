// [R207 · pendiente del Mac] ¿`dist:win` con `npmRebuild:false` empaqueta unos addons que CARGAN?
// Se prueba el .exe recién EMPAQUETADO (dist\win-unpacked), no las instalaciones de Beltrán: si fallara, sus
// instalaciones siguen intactas. Los .node se recompilaron antes contra Node (ABI de Node, no de Electron),
// que es lo que dejaría un `npm install` limpio — si no fuese ABI-estable, aquí se caería.
import { targets } from './cdp.mjs';
import { spawn } from 'child_process';
const wait = ms => new Promise(r => setTimeout(r, ms));
const EXE = 'C:\\Users\\beltr\\Desktop\\Alma Digital Studio\\Projects\\Immersive Studio Pro\\dist\\win-unpacked\\Immersive Studio Pro.exe';
const p = spawn(EXE, ['--remote-debugging-port=9224'], { stdio: 'ignore' });
let idx = null;
for (let i = 0; i < 300; i++) { const l = await targets(9224).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(200); }
if (!idx) { console.log('*** el .exe empaquetado NO ARRANCA ***'); process.exit(1); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws')); });
let _id = 0;
const send = (m, pr) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: pr })); });
const errs = []; await send('Runtime.enable', {});
ws.addEventListener('message', ev => { const x = JSON.parse(ev.data); if (x.method === 'Runtime.exceptionThrown') errs.push(((x.params.exceptionDetails.exception || {}).description || '').slice(0, 200)); });
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, timeout: 120000 }); return r.exceptionDetails ? JSON.stringify(r.exceptionDetails).slice(0, 400) : r.result.value; };
for (let i = 0; i < 200; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await wait(2500);

console.log('=== .exe empaquetado con npmRebuild:false ===\n');
console.log('addons nativos:', await evl(`JSON.stringify({
  // Spout no necesita runtime externo: available()===true PRUEBA que el .node se cargó en Electron
  spout_addonCargado: (()=>{ try{ return !!(DSP.spout && DSP.spout.available()); }catch(e){ return 'EXCEPCION: '+e.message; } })(),
  // NDI depende además del NDI Runtime del sistema; se informan las dos cosas por separado
  ndi_runtimeListo: (()=>{ try{ return !!(DSP.ndi && DSP.ndi.available()); }catch(e){ return 'EXCEPCION: '+e.message; } })(),
  ndi_errorDeCarga: (()=>{ try{ return DSP.ndi.loadError(); }catch(e){ return 'EXCEPCION: '+e.message; } })(),
  // listar fuentes ejerce el addon de verdad (recorre la API nativa), no sólo su bandera
  ndi_listarFuentes: (()=>{ try{ const s=DSP.ndi.findSources(300); return Array.isArray(s)?('ok, '+s.length+' fuentes'):'no devolvió lista'; }catch(e){ return 'EXCEPCION: '+e.message; } })(),
  spout_listarEntradas: (()=>{ try{ const s=DSP.spout.inList(); return Array.isArray(s)?('ok, '+s.length+' emisores'):'no devolvió lista'; }catch(e){ return 'EXCEPCION: '+e.message; } })()
},null,1)`));

console.log('\nmotor vivo:', await evl(`JSON.stringify({ webgl:!!(typeof gl!=='undefined'&&gl&&!gl.isContextLost()), perdido:(typeof glLost!=='undefined')?glLost:null })`));
console.log('\nerrores de consola:', errs.length ? errs.slice(0, 6) : 'ninguno');
try { ws.close(); } catch (_) { } try { p.kill('SIGKILL'); } catch (_) { }
