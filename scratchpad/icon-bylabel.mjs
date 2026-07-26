// Compara icono a icono EMPAREJANDO POR RÓTULO, no adivinando selectores.
// Lado maqueta: cada <svg> del .dc.html con el texto del botón que lo contiene.
// Lado app: cada <svg> vivo en el DOM con el texto de su botón.
// Sólo se comparan los que tienen rótulo en los dos lados: lo demás es decoración y no se puede emparejar.
import { targets } from './cdp.mjs';
import fs from 'fs';
const wait = ms => new Promise(r => setTimeout(r, ms));

const norm = at => String(at).replace(/\s(stroke|fill|stroke-width|stroke-linecap|stroke-linejoin|vector-effect|opacity|class|style)="[^"]*"/g, '').replace(/\/\s*$/, '').replace(/\s+/g, ' ').trim();
const clave = t => String(t).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 14);

// — maqueta —
const html = fs.readFileSync('scratchpad/redesign/design_handoff_immersive_studio/Editor Domo - Rev 1.dc.html', 'utf8');
const dis = new Map();
for (const m of html.matchAll(/<svg\b[^>]*>[\s\S]*?<\/svg>/g)) {
  const fin = m.index + m[0].length;
  // el botón que lo envuelve: retrocede hasta el <button/<div más cercano y toma su texto visible
  const ini = html.lastIndexOf('<button', m.index);
  const cierre = ini >= 0 ? html.indexOf('</button>', fin) : -1;
  if (ini < 0 || cierre < 0 || cierre - ini > 1200) continue;
  const rotulo = html.slice(fin, cierre).replace(/<[^>]*>/g, ' ').replace(/\{\{[^}]*\}\}/g, '').replace(/\s+/g, ' ').trim();
  if (!rotulo) continue;
  const geo = [...m[0].matchAll(/<(path|circle|rect|line|ellipse|polygon|polyline)\b([^>]*)>/g)].map(h => h[1] + ' ' + norm(h[2])).join(' | ');
  if (geo) dis.set(clave(rotulo), { rotulo, geo });
}

// — app viva —
let idx = null;
for (let i = 0; i < 120; i++) { const l = await targets(9222).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(150); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws')); });
let _id = 0;
const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300)); return r.result.value; };
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false, screenWidth: 1600, screenHeight: 900 });
await send('Page.reload', { ignoreCache: true }); await wait(2200);
for (let i = 0; i < 60; i++) { try { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")')) break; } catch (e) {} await wait(400); }
await evl(`(()=>{ try{localStorage.setItem('dspOnboardV1','1')}catch(e){} document.querySelectorAll('.overlay,#tourOv,#landingOv').forEach(o=>o.remove()); document.body.classList.remove('preboot'); try{resize();}catch(e){} return 1; })()`);
await evl(`(async()=>{ state.dirty=false; await buildDemoProject(); const c=state.clips.find(x=>{const m=mediaById(x.mediaId);return m&&m.kind==='shape';}); if(c){state.selIds=[c.id];state.selId=c.id;renderInspector();} return 1; })()`);
await wait(900);
const vivos = await evl(`(()=>{ const out=[];
  for(const b of document.querySelectorAll('button')){
    const sv=b.querySelector('svg'); if(!sv)continue;
    const rotulo=(b.textContent||'').replace(/\\s+/g,' ').trim(); if(!rotulo)continue;
    const geo=[...sv.querySelectorAll('path,circle,rect,ellipse,line,polygon,polyline')]
      .map(n=>n.tagName.toLowerCase()+' '+(n.getAttribute('d')?'d="'+n.getAttribute('d')+'"':[...n.attributes].filter(a=>!/^(stroke|fill|class|style)/.test(a.name)).map(a=>a.name+'="'+a.value+'"').join(' '))).join(' | ');
    if(geo) out.push({rotulo, geo, id:b.id||''});
  } return out; })()`);
ws.close();

const app = new Map();
for (const v of vivos) if (!app.has(clave(v.rotulo))) app.set(clave(v.rotulo), v);

const iguales = [], distintos = [], soloMaqueta = [];
for (const [k, d] of dis) {
  const a = app.get(k);
  if (!a) { soloMaqueta.push(d); continue; }
  const gd = norm(d.geo).replace(/d="/g, '').replace(/"/g, ''), ga = norm(a.geo).replace(/d="/g, '').replace(/"/g, '');
  (gd === ga ? iguales : distintos).push({ rotulo: d.rotulo, maqueta: d.geo, app: a.geo, id: a.id });
}
console.log('botones con rótulo en la maqueta:', dis.size, '· con gemelo por rótulo en la app:', dis.size - soloMaqueta.length);
console.log('IGUALES:', iguales.length, '· DISTINTOS:', distintos.length, '· sólo en la maqueta:', soloMaqueta.length);
console.log('\n=== DISTINTOS (mismo botón, otro dibujo) ===');
for (const d of distintos) { console.log('· ' + d.rotulo + (d.id ? '  #' + d.id : '')); console.log('   maqueta: ' + d.maqueta.slice(0, 120)); console.log('   app    : ' + d.app.slice(0, 120)); }
console.log('\n=== sólo en la maqueta (ese botón no existe en la app o no lleva rótulo) ===');
for (const d of soloMaqueta) console.log('· ' + d.rotulo.slice(0, 34).padEnd(36) + d.geo.slice(0, 88));
fs.writeFileSync('scratchpad/icon-bylabel.json', JSON.stringify({ iguales, distintos, soloMaqueta }, null, 2));
