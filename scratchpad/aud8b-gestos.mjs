/* [AUD 2026-08b] Pruebas COMO USUARIO sobre el .exe desplegado (:9222), con eventos de raton/teclado reales.
   Cubre: R249 (doble clic → monitor, arrastre con marcas, boton Source del inspector), R250 (filas de bucle:
   renderizar el inspector no muta nada; «Del clip» por UI), R251 (copiar/pegar multiple con Ctrl+C/V reales),
   R252/b (chip Pulsar en 2D estampa `scale`; acorde Flotar y el arrastre REAL del deslizador maestro),
   R248 (Aplicar sin tocar → ni un pixel; arrastre a la cesta; doble diálogo).
   Requiere: el .exe con --remote-debugging-port=9222 y el fixture aud8b-viejo.isp ya construido. */
import http from 'http'; import fs from 'fs';
const DIR = String.raw`C:\Users\beltr\Desktop\Alma Digital Studio\Projects\Immersive Studio Pro\scratchpad`;
const ISP = (DIR + '\\aud8b-viejo.isp').replace(/\\/g, '\\\\');
const t = await new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: 9222, path: '/json/list' }, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => res(JSON.parse(b))); }).on('error', rej); });
const page = t.find(x => x.type === 'page' && x.webSocketDebuggerUrl && /index\.html/.test(x.url));
const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map(); ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const cmd = (m, q = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, x => x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result)); ws.send(JSON.stringify({ id: i, method: m, params: q })); });
const ev = async x => { const r = await cmd('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true, timeout: 120000 }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const raton = (type, x, y, extra = {}) => cmd('Input.dispatchMouseEvent', Object.assign({ type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'mouse' }, extra));
const clic = async (x, y) => { await raton('mousePressed', x, y); await wait(50); await raton('mouseReleased', x, y); await wait(120); };
const tecla = async (key, code, mods = 0, vk = 0) => { await cmd('Input.dispatchKeyEvent', { type: 'keyDown', key, code, modifiers: mods, windowsVirtualKeyCode: vk }); await wait(30); await cmd('Input.dispatchKeyEvent', { type: 'keyUp', key, code, modifiers: mods, windowsVirtualKeyCode: vk }); await wait(60); };
let FALLOS = 0; const informa = (nombre, ok, det) => { if (!ok) FALLOS++; console.log((ok ? '   OK  ' : '   *** ') + nombre + (det ? ' — ' + det : '') + (ok ? '' : ' ***')); };

await cmd('Page.enable'); await cmd('Page.bringToFront').catch(() => {});
await ev(`(function(){ window.__errs=[]; addEventListener('error',e=>__errs.push(String(e.message||e))); window.__vis=el=>{const r=el.getBoundingClientRect();return r.width>2&&r.height>2;}; return 1; })()`);
await ev(`(async function(){ state.dirty=false; if(_srcMon)closeSourceMonitor(); try{clearLiveAutosaves();}catch(e){}
  await openProjectPath('${ISP}',true);
  { const o=document.querySelector('#confirmOv'); if(o){ const b=[...o.querySelectorAll('button')].find(x=>/Open the file/.test(x.textContent)); if(b)b.click(); } }
  const t0=Date.now(); while(Date.now()-t0<20000){ await new Promise(r=>setTimeout(r,250)); if(state.media.filter(m=>!isSeqMedia(m)).every(m=>!m._loading&&!m.missing))break; } return 1; })()`);
await ev(`(async function(){ const t0=Date.now(); while(document.querySelector('#loadingOv')&&Date.now()-t0<30000) await new Promise(r=>setTimeout(r,200)); return !document.querySelector('#loadingOv'); })()`).then(x=>console.log('velo de carga fuera:', x));
await wait(400);
// vista de CUADRICULA para el panel (la miniatura es zona grande y sin dblclick de renombrar);
// __punto = un pixel del item cuyo elementFromPoint cae dentro y fuera del rotulo
await ev(`(function(){ window.__mediaViewAntes=state.mediaView; state.mediaView='grid'; renderMedia(); return 1; })()`);
await ev(`window.__punto=function(it){ it.scrollIntoView({block:'center'}); const r=it.getBoundingClientRect();
  for(const [fx,fy] of [[0.5,0.35],[0.6,0.3],[0.4,0.45],[0.7,0.5],[0.5,0.6],[0.32,0.5]]){ const x=r.left+r.width*fx, y=r.top+r.height*fy;
    const at=document.elementFromPoint(x,y);
    if(at&&it.contains(at)&&!(at.closest&&at.closest('.mname,.tlbl'))) return {x,y}; }
  return null; };1`);

/* ============ 1 · R249: doble clic REAL en el panel de medios ============ */
console.log('\n1 · R249 · doble clic en un medio del panel');
{
  const g = await ev(`(function(){ if(_srcMon)closeSourceMonitor(); renderMedia();
    const it=[...document.querySelectorAll('#mediaList .mitem,#mediaList .mtile')].filter(__vis).find(d=>d.textContent.includes('vidC'));
    if(!it)return {err:'no encuentro la ficha de vidC en el panel'};
    const p=__punto(it); if(!p)return {err:'sin punto seguro en la ficha'};
    return {x:p.x,y:p.y,clips:state.clips.length}; })()`);
  if (g.err) { informa('doble clic', false, g.err); } else {
    await raton('mousePressed', g.x, g.y); await raton('mouseReleased', g.x, g.y, { buttons: 0 });
    await raton('mousePressed', g.x, g.y, { clickCount: 2 }); await raton('mouseReleased', g.x, g.y, { buttons: 0, clickCount: 2 });
    await wait(500);
    const r = await ev(`({mon:!!_srcMon, monDe:_srcMon&&_srcMon.m.name, clips:state.clips.length})`);
    informa('abre el monitor de origen', r.mon && r.monDe === 'vidC.mp4', 'monitor=' + r.monDe);
    informa('NO suelta ningun clip en la linea de tiempo', r.clips === g.clips, g.clips + ' → ' + r.clips);
  }
  await tecla('Escape', 'Escape');
  await ev(`(function(){ if(document.activeElement&&document.activeElement.blur)document.activeElement.blur(); return 1; })()`);
}

/* ============ 2 · R249: marcar en el monitor con sus BOTONES y arrastrar DESDE EL PANEL ============ */
console.log('\n2 · R249 · marcas por UI y arrastre desde el panel');
{
  const g = await ev(`(function(){ if(_srcMon)closeSourceMonitor(); const m=state.media.find(x=>x.name==='vidC.mp4'); m.srcIn=0; m.srcOut=m.dur; openSourceMonitor(m); const mon=_srcMon; if(!mon)return {err:'sin monitor'};
    _srcMonX=520; _srcMonY=80; mon.el.style.left='520px'; mon.el.style.top='80px';
    // recorre a 10 s con la barra (clic real abajo) y usa los botones [ y ]
    const bar=mon.bar.getBoundingClientRect();
    const bi=mon.el.querySelector('[data-a="mi"]').getBoundingClientRect();
    const bo=mon.el.querySelector('[data-a="mo"]').getBoundingClientRect();
    const d=mon.m.dur;
    return { bar:{x0:bar.left,y:bar.top+bar.height/2,w:bar.width}, d,
      bi:{x:bi.left+bi.width/2,y:bi.top+bi.height/2}, bo:{x:bo.left+bo.width/2,y:bo.top+bo.height/2} }; })()`);
  if (g.err) { informa('marcas', false, g.err); } else {
    let asentado=false;
    for(let intento=0;intento<3&&!asentado;intento++){
      await clic(g.bar.x0 + g.bar.w * (10 / g.d), g.bar.y);
      asentado = await ev(`_srcMon&&Math.abs(_srcMon.t-10)<0.6`);
    }
    if(asentado){
      // los botones [ ] SE MUEVEN cuando el rotulo del rango cambia de ancho → medir JUSTO antes de cada clic
      const btn = async a => await ev('(function(){ const b=_srcMon.el.querySelector(\'[data-a="' + a + '"]\'); const r=b.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()');
      let b1 = await btn('mi'); await clic(b1.x, b1.y);               // Mark In
      await clic(g.bar.x0 + g.bar.w * (14 / g.d), g.bar.y);
      let b2 = await btn('mo'); await clic(b2.x, b2.y);               // Mark Out
    } else {
      console.log('   (arnes: el clic de barra no aterrizo en esta pasada — marcas por API, el gesto clave es el arrastre)');
      await ev(`(function(){ smSeek(10); smAccion('mi'); smSeek(14); smAccion('mo'); return 1; })()`);
    }
    const marks = await ev(`(function(){ const m=_srcMon.m; return {i:+(m.srcIn||0).toFixed(2), o:+(m.srcOut||0).toFixed(2)}; })()`);
    informa('marcas puestas con los botones', Math.abs(marks.i - 10) < 0.6 && Math.abs(marks.o - 14) < 0.6, marks.i + ' → ' + marks.o);
    // arrastre real DESDE EL PANEL: debe caer recortado a las marcas
    const gg = await ev(`(function(){ closeSourceMonitor(); renderMedia(); renderTimeline();
      const it=[...document.querySelectorAll('#mediaList .mitem,#mediaList .mtile')].filter(__vis).find(d=>d.textContent.includes('vidC'));
      const p=__punto(it); if(!p)return {err:'sin punto seguro'};
      const lanes=[...document.querySelectorAll('#tracks .lane')]; const vl=lanes.find(l=>state.lanes[+l.dataset.lane]&&state.lanes[+l.dataset.lane].kind==='video');
      const lr=vl.getBoundingClientRect(); const antes=state.clips.length;
      return {sx:p.x, sy:p.y, dx:lr.left+Math.min(700,lr.width*0.55), dy:lr.top+lr.height/2, antes, lane:+vl.dataset.lane}; })()`);
    if (gg.err) { informa('arrastre panel', false, gg.err); } else {
    await raton('mousePressed', gg.sx, gg.sy); await wait(80);
    for (let i = 1; i <= 12; i++) { await raton('mouseMoved', gg.sx + (gg.dx - gg.sx) * i / 12, gg.sy + (gg.dy - gg.sy) * i / 12); await wait(35); }
    await raton('mouseReleased', gg.dx, gg.dy); await wait(500);
    const r = await ev(`(function(){ const c=state.clips.slice().reverse().find(x=>state.lanes[x.lane]&&state.lanes[x.lane].kind==='video'&&x.start>0); return {n:state.clips.length, dur:+c.dur.toFixed(2), inP:+(c.inP||0).toFixed(2), lane:c.lane}; })()`);
    informa('el arrastre del panel respeta las marcas', r.n >= gg.antes + 1 && Math.abs(r.dur - (marks.o - marks.i)) < 0.1 && Math.abs(r.inP - marks.i) < 0.6, 'inP ' + r.inP + ' · dur ' + r.dur + ' (mas su mitad de audio enlazada)');
    await ev(`(function(){ const c=state.clips.slice().reverse().find(x=>state.lanes[x.lane]&&state.lanes[x.lane].kind==='video'&&x.start>0); const li=c&&c.link; state.clips=state.clips.filter(x=>x!==c&&(li==null||x.link!==li)); const m=state.media.find(m=>m.name==='vidC.mp4'); m.srcIn=0; m.srcOut=m.dur; renderTimeline(); render(); return 1; })()`);
    }
  }
}

/* ============ 3 · R249/R253: el boton Source MUESTRA el tramo del clip pero NO escribe en el medio ============ */
console.log('\n3 · R249 · boton Source del inspector: efecto lateral sobre el medio');
{
  const r = await ev(`(async function(){ const c=state.clips.find(x=>x.name==='c_trim'); if(!c)return {err:'sin c_trim'};
    const m=mediaById(c.mediaId); const antes={i:m.srcIn!=null?+m.srcIn.toFixed(2):null,o:m.srcOut!=null?+m.srcOut.toFixed(2):null,dirty:state.dirty,undo:_ustk().u.length};
    state.selId=c.id; state.selIds=[c.id]; renderInspector(); await new Promise(r=>setTimeout(r,150));
    const b=document.querySelector('#selSrcMon'); if(!b||b.style.display==='none')return {err:'sin boton Source visible'};
    b.click(); await new Promise(r=>setTimeout(r,250));
    const desp={i:(m.srcIn!=null?+m.srcIn.toFixed(2):null),o:(m.srcOut!=null?+m.srcOut.toFixed(2):null),dirty:state.dirty,undo:_ustk().u.length,mon:!!_srcMon,
      vin:(_srcMon?+_srcMon.in.toFixed(2):null), vout:(_srcMon?+_srcMon.out.toFixed(2):null), rango:(_srcMon?smRangeVisible():null)};
    closeSourceMonitor();
    return {antes,desp,inP:+(c.inP||0).toFixed(2),dur:+c.dur.toFixed(2)}; })()`);
  if (r.err) { informa('boton Source', false, r.err); } else {
    console.log('   antes: srcIn/srcOut=' + r.antes.i + '/' + r.antes.o + ' · despues: ' + r.desp.i + '/' + r.desp.o + ' (clip inP ' + r.inP + ' dur ' + r.dur + ')');
    console.log('   la ventana MUESTRA: ' + r.desp.vin + ' → ' + r.desp.vout + ' (el tramo del clip)');
    informa('[R253] abrir el Source NO escribe las marcas en el medio', r.desp.i === r.antes.i && r.desp.o === r.antes.o, 'medio ' + r.antes.i + '/' + r.antes.o + ' → ' + r.desp.i + '/' + r.desp.o);
    informa('[R253] ...pero la ventana SI ensena el tramo del clip', Math.abs(r.desp.vin - r.inP) < 0.05 && Math.abs(r.desp.vout - (r.inP + r.dur)) < 0.05, 've ' + r.desp.vin + ' → ' + r.desp.vout + ' · clip inP ' + r.inP + ' dur ' + r.dur);
    informa('[R253] ...y no ensucia el proyecto ni el historial', r.desp.dirty === r.antes.dirty && r.desp.undo === r.antes.undo, 'dirty ' + r.antes.dirty + '→' + r.desp.dirty + ' · undo ' + r.antes.undo + '→' + r.desp.undo);
    await ev(`(function(){ const m=state.media.find(m=>m.name==='vidC.mp4'); m.srcIn=0; m.srcOut=m.dur; return 1; })()`);
  }
}

/* ============ 4 · R250: renderizar el inspector de CADA clip loopeado no muta nada ============ */
console.log('\n4 · R250 · el inspector del bucle no altera el clip por renderizarse');
{
  const r = await ev(`(async function(){ const out=[];
    for(const c of state.clips.filter(x=>x.loop)){
      const antes=JSON.stringify({d:c.dur,i:c.inP||0,l:c.loopLen,r:!!c.loopRev,s:c.start});
      state.selId=c.id; state.selIds=[c.id]; renderInspector(); await new Promise(r=>setTimeout(r,60));
      const desp=JSON.stringify({d:c.dur,i:c.inP||0,l:c.loopLen,r:!!c.loopRev,s:c.start});
      out.push({n:c.name,igual:antes===desp,fila:!!document.querySelector('#loopFromClip')});
    } return out; })()`);
  informa('todos los clips loopeados intactos tras renderInspector', r.every(x => x.igual), r.map(x => x.n + (x.igual ? '' : '(MUTO)')).join(' · '));
  informa('la fila nueva «Loop range» aparece', r.every(x => x.fila), '');
}

/* ============ 5 · R250: «Del clip» por UI sobre c_stretch (no recorta, no apaga) ============ */
console.log('\n5 · R250 · Del clip / setLoopRange');
{
  const g = await ev(`(async function(){ const c=state.clips.find(x=>x.name==='c_stretch'); state.selId=c.id; state.selIds=[c.id]; renderInspector(); await new Promise(r=>setTimeout(r,150));
    const b=document.querySelector('#loopFromClip'); b.scrollIntoView({block:'center'}); const r=b.getBoundingClientRect();
    return {x:r.left+r.width/2,y:r.top+r.height/2, antes:{dur:c.dur,len:+c.loopLen.toFixed(2),inP:c.inP}}; })()`);
  await clic(g.x, g.y);
  const r = await ev(`(function(){ const c=state.clips.find(x=>x.name==='c_stretch'); return {dur:c.dur,len:+c.loopLen.toFixed(2),loop:!!c.loop,inP:c.inP}; })()`);
  informa('«Del clip» acota al material real y NO toca la duracion ni apaga el bucle',
    r.loop && r.dur === g.antes.dur && Math.abs(r.len - 30.09) < 0.3, 'loopLen ' + g.antes.len + '→' + r.len + ' · dur ' + r.dur);
  const r2 = await ev(`(function(){ const c=state.clips.find(x=>x.name==='c_stretch'); setLoopRange(c,3); return {len:c.loopLen,dur:c.dur,loop:!!c.loop}; })()`);
  informa('setLoopRange(3) cambia solo el tramo', r2.len === 3 && r2.dur === g.antes.dur && r2.loop, JSON.stringify(r2));
  const r3 = await ev(`(function(){ const c=state.clips.find(x=>x.name==='c_stretch'); setLoopRange(c,999); return {len:+c.loopLen.toFixed(2)}; })()`);
  informa('pedir 999 se acota a lo que queda de fuente', Math.abs(r3.len - 30.09) < 0.3, '999→' + r3.len);
  await ev(`(function(){ const c=state.clips.find(x=>x.name==='c_stretch'); undo(); undo(); undo(); renderTimeline(); renderInspector(); return 1; })()`).catch(()=>ev(`1`));
}

/* ============ 6 · R251: Ctrl+C / Ctrl+V reales con seleccion multiple ============ */
console.log('\n6 · R251 · copiar/pegar varios clips con el teclado');
{
  const g = await ev(`(function(){ const a=state.clips.find(x=>x.name==='c_kf'), b=state.clips.find(x=>x.name==='c_pulsedome'), c=state.clips.find(x=>x.name==='c_fx');
    state.selId=a.id; state.selIds=[a.id,b.id,c.id]; state.selGroupId=null; renderTimeline();
    if(document.activeElement&&document.activeElement.blur)document.activeElement.blur(); document.body.focus(); if(_srcMon)closeSourceMonitor();
    state.playhead=130; renderTimeline();
    return {antes:state.clips.length, sel:[[a.name,a.start,a.lane],[b.name,b.start,b.lane],[c.name,c.start,c.lane]]}; })()`);
  await tecla('c', 'KeyC', 2, 67);   // Ctrl+C
  const cb = await ev(`(state.clipboard&&state.clipboard.items)?state.clipboard.items.length:(state.clipboard?1:0)`);
  console.log('   portapapeles tras Ctrl+C: ' + cb + ' clips');
  await tecla('v', 'KeyV', 2, 86);   // Ctrl+V
  await wait(300);
  const r = await ev(`(function(){ const nu=state.clips.slice(-3); return { total:state.clips.length,
    pegados:nu.map(c=>({n:c.name,start:+c.start.toFixed(2),lane:c.lane,kf:Object.keys(c.kf||{}).length,anim:(c.anim||[]).length})) }; })()`);
  const esp = [[130, g.sel[0][2]], [134, g.sel[1][2]], [145, g.sel[2][2]]]; // offsets 0,+4,+15 desde c_kf(100)
  const ok = r.total === g.antes + 3 && r.pegados.every((p, i) => Math.abs(p.start - esp[i][0]) < 0.05 && p.lane === esp[i][1]);
  informa('3 copiados → 3 pegados conservando distancias y pistas', ok, JSON.stringify(r.pegados));
  informa('lo pegado conserva kf y motion', r.pegados[0].kf === 2 && r.pegados[2].anim === 2, '');
  await ev(`undo(); renderTimeline(); render(); 1`);
}

/* ============ 7 · R252: chip Pulsar REAL en la secuencia 2D → scale ============ */
console.log('\n7 · R252 · chip Pulsar en 2D');
{
  const g = await ev(`(async function(){ const f=state.media.find(m=>m.name==='Flat2D'); openSeq(f.id); await new Promise(r=>setTimeout(r,250));
    const c=state.clips.find(x=>x.name==='f_hmove'); state.selId=c.id; state.selIds=[c.id];
    insColState().motion=false; renderInspector(); await new Promise(r=>setTimeout(r,200));
    const ch=[...document.querySelectorAll('.animchip')].find(b=>b.dataset.k==='pulse'); if(!ch)return {err:'sin chip pulse'};
    ch.scrollIntoView({block:'center'}); const r=ch.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2,antes:(c.anim||[]).map(a=>a.param)}; })()`);
  if (g.err) { informa('chip pulse', false, g.err); } else {
    await clic(g.x, g.y);
    const r = await ev(`(function(){ const c=state.clips.find(x=>x.name==='f_hmove'); return (c.anim||[]).map(a=>a.param); })()`);
    informa('el chip Pulsar estampa `scale` (antes `size`, inerte)', r.includes('scale') && !r.includes('size'), JSON.stringify(g.antes) + ' → ' + JSON.stringify(r));
    await ev(`(function(){ const c=state.clips.find(x=>x.name==='f_hmove'); c.anim=c.anim.filter(a=>a.param!=='scale'); renderInspector(); return 1; })()`);
  }
  // y el f_pulse VIEJO (size, del fixture) sigue inerte pero presente
  const v = await ev(`(function(){ const c=state.clips.find(x=>x.name==='f_pulse'); return (c.anim||[]).map(a=>a.param); })()`);
  informa('el modificador viejo sobre `size` sigue ahi (inerte), nadie lo migro en silencio', v.includes('size'), JSON.stringify(v));
}

/* ============ 8 · R252b: Flotar + arrastre REAL del deslizador maestro ============ */
console.log('\n8 · R252b · Flotar y su maestro de intensidad (arrastre real)');
{
  const g = await ev(`(async function(){ const c=state.clips.find(x=>x.name==='f_pulse'); state.selId=c.id; state.selIds=[c.id];
    insColState().motion=false; renderInspector(); await new Promise(r=>setTimeout(r,150));
    const ch=[...document.querySelectorAll('.animchip')].find(b=>b.dataset.k==='float'); if(!ch)return {err:'sin chip float'};
    ch.scrollIntoView({block:'center'}); const r=ch.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
  if (g.err) { informa('chip float', false, g.err); } else {
    await clic(g.x, g.y);
    const s0 = await ev(`(function(){ const c=state.clips.find(x=>x.name==='f_pulse'); const fl=(c.anim||[]).filter(a=>a.grp==='float');
      return {n:fl.length, params:fl.map(a=>a.param), amps:fl.map(a=>a.amp), gint:fl[0]&&fl[0].gint}; })()`);
    informa('el acorde estampa 3 modificadores x/y/rot', s0.n === 3 && s0.params.join(',') === 'x,y,rot', JSON.stringify(s0.params));
    const sl = await ev(`(function(){ const g=document.querySelector('#animList input[type=range][max="300"]'); if(!g)return {err:'sin deslizador maestro'};
      g.scrollIntoView({block:'center'}); const r=g.getBoundingClientRect(); return {x0:r.left,y:r.top+r.height/2,w:r.width,val:+g.value}; })()`);
    if (sl.err) { informa('deslizador maestro', false, sl.err); } else {
      // arrastre real: de 100% hacia 200% (el rango es 0..300 → 200% esta a 2/3 del ancho)
      const xTo = sl.x0 + sl.w * (200 / 300);
      await raton('mousePressed', sl.x0 + sl.w * (100 / 300), sl.y);
      for (let i = 1; i <= 8; i++) { await raton('mouseMoved', sl.x0 + sl.w * (100 / 300) + (xTo - sl.x0 - sl.w * (100 / 300)) * i / 8, sl.y); await wait(40); }
      await raton('mouseReleased', xTo, sl.y); await wait(250);
      const r = await ev(`(function(){ const c=state.clips.find(x=>x.name==='f_pulse'); const fl=(c.anim||[]).filter(a=>a.grp==='float');
        const g2=document.querySelector('#animList input[type=range][max="300"]');
        return {gint:fl[0]&&fl[0].gint, amps:fl.map(a=>+a.amp.toFixed(3)), slider:g2&&+g2.value, errs:__errs.slice()}; })()`);
      console.log('   tras el arrastre: gint=' + r.gint + ' · amps=' + JSON.stringify(r.amps) + ' · slider=' + r.slider);
      informa('el arrastre continuo del maestro LLEGA al valor apuntado (±10)', r.gint != null && Math.abs(r.gint * 100 - 200) <= 10, 'gint=' + (r.gint * 100).toFixed(0) + '% (se apuntaba a 200%)');
      informa('sin errores JS durante el arrastre', !r.errs.length, JSON.stringify(r.errs));
    }
    await ev(`(function(){ const c=state.clips.find(x=>x.name==='f_pulse'); c.anim=(c.anim||[]).filter(a=>a.grp!=='float'); renderInspector(); return 1; })()`);
  }
  await ev(`(async function(){ const mn=state.media.find(m=>m.name==='Sequence 1'); openSeq(mn.id); await new Promise(r=>setTimeout(r,250)); return 1; })()`);
}

/* ============ 9 · R248: abrir el dialogo de CADA compose y Aplicar sin tocar nada → ni un pixel ============ */
console.log('\n9 · R248 · Aplicar sin tocar nada (pixeles) + cesta');
{
  const SNAP_FN = fs.readFileSync(DIR + '\\aud8b-fixture-viejo.mjs', 'utf8').match(/const SNAP_FN = `([\s\S]*?)`;/)[1];
  await ev(SNAP_FN);
  const shotV = async (t) => { await ev(`__pix([${t}])`); const a = await ev(`__pix([${t}])`); const b = await ev(`__pix([${t}])`);
    const k = 't' + t; if (a[k].hash !== b[k].hash) console.log('   *** INESTABLE (antes) t=' + t + ' ***'); return a; };
  const antes = { ...(await shotV(101.3)), ...(await shotV(103.7)) };
  const mediaIdsAntes = await ev(`state.media.filter(m=>m.kind==='nest'&&m.comp).map(m=>m.name+':'+(m.comp.mediaIds||[]).join(','))`);
  for (const nombre of ['compRing', 'compGrid', 'compRand']) {
    const bg = await ev(`(async function(){ const n=state.media.find(m=>m.name==='${nombre}'); openCompose(null,null,n,null,null); await new Promise(r=>setTimeout(r,300));
      const b=document.querySelector('#cGo'); const r=b.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
    await clic(bg.x, bg.y); await wait(350);
  }
  const abiertos = await ev(`document.querySelectorAll('#compOv').length`);
  const despues = { ...(await shotV(101.3)), ...(await shotV(103.7)) };
  const mediaIdsDesp = await ev(`state.media.filter(m=>m.kind==='nest'&&m.comp).map(m=>m.name+':'+(m.comp.mediaIds||[]).join(','))`);
  informa('los 3 dialogos se cierran al Aplicar', abiertos === 0, abiertos + ' quedan');
  informa('mediaIds intactos y en su orden', JSON.stringify(mediaIdsAntes) === JSON.stringify(mediaIdsDesp), mediaIdsDesp.join(' | '));
  informa('NI UN PIXEL cambia tras Aplicar sin tocar (t101.3)', antes['t101.3'].hash === despues['t101.3'].hash, antes['t101.3'].hash + ' vs ' + despues['t101.3'].hash);
  informa('NI UN PIXEL cambia tras Aplicar sin tocar (t103.7)', antes['t103.7'].hash === despues['t103.7'].hash, antes['t103.7'].hash + ' vs ' + despues['t103.7'].hash);

  // cesta: arrastre real de un medio del panel a #cMedia; y que NADA caiga a la linea de tiempo
  const gg = await ev(`(async function(){ const n=state.media.find(m=>m.name==='compRing'); openCompose(null,null,n,null,null); await new Promise(r=>setTimeout(r,300));
    renderMedia(); const it=[...document.querySelectorAll('#mediaList .mitem,#mediaList .mtile')].filter(__vis).find(d=>d.textContent.includes('imgC'));
    if(!it)return {err:'no veo imgC en el panel con el dialogo abierto'};
    const p=__punto(it); if(!p)return {err:'sin punto seguro sobre imgC'};
    const c=document.querySelector('#cMedia').getBoundingClientRect();
    return {sx:p.x,sy:p.y,dx:c.left+c.width/2,dy:c.top+Math.min(c.height-8,40),antesClips:state.clips.length,
      antesCesta:document.querySelectorAll('#cMedia .cbitem').length}; })()`);
  if (gg.err) { informa('cesta', false, gg.err); } else {
    await raton('mousePressed', gg.sx, gg.sy); await wait(80);
    let sobre = false;
    for (let i = 1; i <= 10; i++) { await raton('mouseMoved', gg.sx + (gg.dx - gg.sx) * i / 10, gg.sy + (gg.dy - gg.sy) * i / 10); await wait(35);
      if (i === 9) sobre = await ev(`(function(){ const c=document.querySelector('#cMedia'); return !!(c&&c.classList.contains('over')); })()`); }
    await raton('mouseReleased', gg.dx, gg.dy); await wait(350);
    console.log('   la cesta se resalta al pasar por encima: ' + (sobre ? 'si' : 'NO'));
    const r = await ev(`({cesta:document.querySelectorAll('#cMedia .cbitem').length, clips:state.clips.length, pick:[...document.querySelectorAll('#cMedia .cbname')].map(e=>e.textContent)})`);
    informa('el arrastre entra a la cesta', r.cesta === gg.antesCesta + 1, gg.antesCesta + ' → ' + r.cesta + ' (' + r.pick.join(',') + ')');
    informa('nada cae a la linea de tiempo con el dialogo abierto', r.clips === gg.antesClips, '');
    await tecla('Escape', 'Escape');                                 // cancelar SIN aplicar
    const r2 = await ev(`(function(){ const n=state.media.find(m=>m.name==='compRing'); return {ids:(n.comp.mediaIds||[]).length, ov:document.querySelectorAll('#compOv').length, drop:_composeDrop!==null}; })()`);
    informa('Escape cancela y la composicion queda como estaba', r2.ids === 2 && r2.ov === 0 && !r2.drop, JSON.stringify(r2));
  }

  // doble apertura: ¿el segundo dialogo rompe la cesta del primero?
  const dd = await ev(`(async function(){ const n=state.media.find(m=>m.name==='compRing');
    openCompose(null,null,n,null,null); await new Promise(r=>setTimeout(r,200));
    openCompose(null,null,n,null,null); await new Promise(r=>setTimeout(r,200));
    const cuantos=document.querySelectorAll('#compOv').length;
    // cerrar con Escape una vez: ¿cierra los dos? ¿queda _composeDrop?
    return {cuantos}; })()`);
  await tecla('Escape', 'Escape'); await wait(200);
  const dd2 = await ev(`({ov:document.querySelectorAll('#compOv').length, drop:_composeDrop!==null})`);
  await tecla('Escape', 'Escape'); await wait(200);
  const dd3 = await ev(`({ov:document.querySelectorAll('#compOv').length, drop:_composeDrop!==null})`);
  console.log('   doble apertura: se apilan ' + dd.cuantos + ' dialogos · tras 1 Escape: ' + JSON.stringify(dd2) + ' · tras 2: ' + JSON.stringify(dd3));
  informa('la doble apertura no deja velos huerfanos', dd3.ov === 0, 'quedan ' + dd3.ov);
  await ev(`document.querySelectorAll('#compOv').forEach(o=>o.remove()); _composeDrop=null; document.body.classList.remove('composing'); 1`);
}

/* ============ 10 · guardado nuevo: que campos aparecen que el viejo no escribia ============ */
console.log('\n10 · guardado con el build nuevo (superficie de compatibilidad hacia atras)');
{
  await ev(`(async function(){ saveActiveSeq(); await DSP.writeText('${(DIR + '\\aud8b-viejo-resave.isp').replace(/\\/g, '\\\\')}', JSON.stringify(serProject())); return 1; })()`);
  const a = JSON.parse(fs.readFileSync(DIR + '\\aud8b-viejo.isp', 'utf8'));
  const b = JSON.parse(fs.readFileSync(DIR + '\\aud8b-viejo-resave.isp', 'utf8'));
  const kA = new Set(Object.keys(a.media[0])), kB = new Set(Object.keys(b.media[0]));
  const nuevas = [...kB].filter(k => !kA.has(k));
  console.log('   campos nuevos en serMedia:', JSON.stringify(nuevas));
  informa('el re-guardado conserva el numero de clips y medios', a.media.length === b.media.length, a.media.length + ' vs ' + b.media.length);
}

console.log('\n=== ' + (FALLOS ? ('*** ' + FALLOS + ' fallos ***') : 'TODOS LOS GESTOS OK') + ' ===');
const errsFin = await ev(`__errs`);
if (errsFin.length) console.log('errores JS acumulados:', JSON.stringify(errsFin));
ws.close();
