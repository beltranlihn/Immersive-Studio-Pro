/* ===================== [R183] PANEL DE EXPORT — hoja flotante con monitor de render =====================
   Recreado del handoff `scratchpad/redesign/export-panel/…/Export Panel - Rev 1.dc.html`.
   Qué cambia frente al diálogo viejo: deja de ser un overlay a pantalla completa y pasa a ser una HOJA
   centrada y arrastrable, con un velo ligero para que el editor siga legible detrás; gana un MONITOR que
   enseña el fotograma que el codificador acaba de escribir; el estado sube a bloque de primera clase; los
   ajustes van en rejilla de dos columnas; y el selector de resolución se convierte en «tamaño en píxeles»
   con Igualar a la fuente / Preajuste / Personalizado.
   La cola (`_exJobs`) sigue viva en el registro; su interfaz vuelve en otra revisión (decisión del handoff). */

let _exPaused=false; // lo sondean los tres bucles de runExport
async function exWaitPause(){ while(_exPaused&&!cancelExport)await new Promise(r=>setTimeout(r,80)); }

/* px() — LA fuente de verdad del tamaño de salida. El handoff lo pide explícito y con razón: el código viejo
   multiplicaba `res*res` en CINCO sitios distintos y se desincronizaban entre sí. De aquí salen la estimación,
   el bitrate automático, los bpp, el recuento de fotogramas, el aspecto del monitor y el nombre del render. */
function exPx(S){
  const as=activeSeq()||{}, dome=!isFlat();
  const sw=Math.max(16,as.w||(dome?4096:1920)), sh=Math.max(16,dome?sw:(as.h||1080));
  if(S.szMode==='preset'){ const p=Math.max(16,S.szPreset||sw);
    return dome?{w:p,h:p,src:'preset'}:{w:p,h:Math.max(16,Math.round(p*sh/sw/2)*2),src:'preset'}; }
  if(S.szMode==='custom'){ const w=Math.max(16,Math.min(16384,S.szW||sw));
    return {w, h:dome?w:Math.max(16,Math.min(16384,S.szH||sh)), src:'custom'}; }
  return {w:sw,h:sh,src:'match'};
}
function exFmtDur(s){ s=Math.max(0,Math.round(s)); const m=Math.floor(s/60); return (m<10?'0':'')+m+':'+((s%60)<10?'0':'')+(s%60); }

function openExport(){ if(!state.clips.length){appAlert(T('Add clips to the timeline first.','Primero añade clips a la línea de tiempo.'));return;}
  if(document.getElementById('exOv'))return; // [R102·rev] nunca dos hojas: `$()` es querySelector y el cableado se enganchaba a la vieja y oculta
  const as=activeSeq()||{}, dome=!isFlat(), room=isRoom();
  const S={ szMode:'match', szPreset:(as.w||4096), szW:(as.w||1920), szH:(dome?(as.w||4096):(as.h||1080)),
            codec:'png', fps:(as.fps||state.fps||60), br:120, brTouched:false, chunks:'auto',
            roomMode:'strip', floor:true, phase:'idle', pct:0, frame:0, frames:0, t0:0, tPause:0, bytes:0 };
  { const L=lastExportGet(); if(L){ if(L.codec)S.codec=L.codec; if(L.fps)S.fps=+L.fps; if(L.br)S.br=+L.br;
      if(L.res){ S.szMode='preset'; S.szPreset=+L.res; } } } // [R102·D-T4] abre con lo último que usaste, no con valores de fábrica

  const ov=document.createElement('div'); ov.className='exs-scrim'; ov.id='exOv';
  const title=room?T('Export 360 room','Exportar sala 360'):(dome?T('Export dome master','Exportar máster del domo'):T('Export 2D master','Exportar máster 2D'));
  const roomWalls=(room&&as.room&&as.room.walls&&as.room.walls.length)||0;
  const hasFloor=!!(room&&as.room&&as.room.floorSeqId&&mediaById(as.room.floorSeqId));
  ov.innerHTML=`<div class="exs" id="exSheet">
   <div class="exs-hd" id="exHd"><span class="ic">${ICO('share',13)}</span><span class="t">${title}</span>
     <span class="exs-chip" id="exChip">${T('Idle','En reposo')}</span>
     <span class="exs-key">Ctrl+Shift+E</span><button class="exs-x" id="exX" title="${T('Close','Cerrar')}">✕</button></div>
   <div class="exs-body">
    <div class="exs-top">
      <div><div class="exs-lab">${T('Render monitor','Monitor de render')}</div>
        <div class="exs-well"><div class="exs-screen"><canvas id="exMon" width="160" height="90"></canvas></div>
          <div class="exs-mfoot"><span class="exs-dot" id="exDot"></span><span id="exProxy">—</span><span id="exFit">—</span><span class="tc" id="exTc">--:--</span></div></div></div>
      <div class="exs-st">
        <div class="exs-phase"><span class="p" id="exPhase">${T('Ready','Listo')}</span><span class="pc" id="exPct">0%</span></div>
        <div class="exs-sub" id="exSub">—</div>
        <div class="exs-rail" id="exRail"><i></i></div>
        <div class="exs-cells">
          <div class="exs-cell"><span class="k">${T('Elapsed','Transcurrido')}</span><span class="v" id="exElapsed">—</span></div>
          <div class="exs-cell"><span class="k">${T('Remaining','Restante')}</span><span class="v" id="exRemain">—</span></div>
          <div class="exs-cell"><span class="k">${T('Written','Escrito')}</span><span class="v" id="exWrote">—</span></div></div>
        <div class="exs-note" id="exNote">${T('Monitor shows the current playhead frame','El monitor muestra el fotograma del cabezal')}</div>
        <div class="exs-acts" id="exActs" style="display:none;">
          <button class="exs-btn" id="exPause">${T('Pause','Pausar')}</button>
          <button class="exs-btn danger" id="exCancel">${T('Cancel','Cancelar')}</button></div>
      </div>
    </div>
    <div class="exs-grid">
      <div class="exs-row"><label>${T('Preset','Preajuste')}</label><select id="exPreset" style="flex:1;"></select><button class="exs-btn" id="exSavePreset">${T('Save','Guardar')}</button></div>
      <div class="exs-row"><label>${T('Range','Rango')}</label><div class="exs-seg" id="exRange"><button data-rg="clips">${T('Clip extent','Extensión')}</button><button data-rg="inout">${T('In / Out','Entrada / Salida')}</button></div><span class="exs-hint" id="exRangeTc"></span></div>
      <div class="exs-row"><label>${T('Codec','Códec')}</label><select id="exCodec" style="flex:1;">
        <option value="png">${T('PNG sequence · alpha, lossless','Secuencia PNG · alfa, sin pérdida')}</option>
        <option value="mp4">MP4 · H.264</option><option value="hevc">MP4 · H.265 / HEVC</option>
        <option value="hap">MOV · HAP</option><option value="hapq">MOV · HAP Q</option>
        <option value="still">${T('Still frame · PNG','Fotograma · PNG')}</option></select></div>
      <div class="exs-row"><label>${T('Frame rate','Cuadros/s')}</label><select id="exFps">${[24,25,30,48,50,60].map(f=>`<option value="${f}">${f}</option>`).join('')}</select><span class="exs-unit">fps</span></div>
      <div class="exs-row span"><label>${T('Pixel size','Tamaño en píxeles')}</label>
        <div style="display:flex;align-items:center;gap:8px;width:100%;">
          <div class="exs-seg" id="exSz"><button data-sz="match">${T('Match source','Igualar fuente')}</button><button data-sz="preset">${T('Preset','Preajuste')}</button><button data-sz="custom">${T('Custom','Personalizado')}</button></div>
          <span id="exSzCtl" style="display:flex;align-items:center;gap:6px;min-width:0;flex:1;"></span></div></div>
      <div class="exs-row" id="exBrRow"><label>${T('Bitrate','Tasa de bits')}</label><input type="number" id="exBr" min="1" max="800" style="width:66px;"><span class="exs-unit">Mbps</span><button class="exs-btn" id="exBrAuto">${T('Auto','Auto')}</button></div>
      <div class="exs-row" id="exChunkRow"><label>${T('Chunks','Trozos')}</label><select id="exChunks"><option value="auto">${T('Auto','Auto')}</option><option value="1">1</option><option value="2">2</option><option value="4">4</option><option value="8">8</option><option value="16">16</option></select><span class="exs-hint" id="exChunkHint"></span></div>
      ${room?`<div class="exs-row" id="exRoomRow"><label>${T('Room','Sala')}</label><div class="exs-seg" id="exRoomMode"><button data-rm="strip" class="on">${T('Full strip','Tira completa')}</button><button data-rm="walls">${T('Per wall','Por muro')} · ${roomWalls}</button></div></div>`:''}
      ${(room&&hasFloor)?`<div class="exs-row"><label></label><label style="display:flex;align-items:center;gap:6px;font-size:10.5px;color:#8C8C8C;cursor:pointer;"><input type="checkbox" id="exFloor" checked> ${T('Also export the floor','Exportar también el piso')}</label></div>`:''}
      <div class="exs-est" id="exEst">—</div>
    </div>
   </div>
   <div class="exs-ft"><span class="exs-dest" id="exDest"></span>
     <button class="exs-btn" id="exClose">${T('Close','Cerrar')}</button>
     <button class="exs-pri" id="exGo">${ICO('share',12)} <span id="exGoTxt">${T('Export','Exportar')}</span></button></div>
  </div>`;
  document.body.appendChild(ov);
  const $$=s=>ov.querySelector(s);

  /* --- arrastrar por la cabecera. El centrado lo hace el grid del velo; el arrastre suma un translate encima. --- */
  { const hd=$$('#exHd'), sh=$$('#exSheet'); let dx=0,dy=0,ox=0,oy=0,on=false;
    hd.addEventListener('pointerdown',e=>{ if(e.target.closest('button'))return; on=true; ox=e.clientX-dx; oy=e.clientY-dy;
      hd.classList.add('drag'); hd.setPointerCapture(e.pointerId); });
    hd.addEventListener('pointermove',e=>{ if(!on)return; dx=e.clientX-ox; dy=e.clientY-oy; sh.style.transform='translate('+dx+'px,'+dy+'px)'; });
    const up=e=>{ on=false; hd.classList.remove('drag'); try{hd.releasePointerCapture(e.pointerId);}catch(_){} };
    hd.addEventListener('pointerup',up); hd.addEventListener('pointercancel',up); }

  /* --- monitor: 160×90 fijos, y el lienzo exportado LETTERBOXEADO dentro, para que domo, 2D y sala compartan
         una sola pantalla sin deformarse. Nunca se amplía por encima de la caja. --- */
  const mon=$$('#exMon'), mctx=mon.getContext('2d');
  function exFit(){ const p=exPx(S), W=mon.width, H=mon.height, ar=p.w/Math.max(1,p.h);
    let w=W, h=Math.round(W/ar); if(h>H){ h=H; w=Math.round(H*ar); }
    return {x:Math.round((W-w)/2), y:Math.round((H-h)/2), w:Math.max(1,w), h:Math.max(1,h), p}; }
  function exDrawMon(){ try{ const f=exFit();
      mctx.fillStyle='#000'; mctx.fillRect(0,0,mon.width,mon.height);
      mctx.drawImage(glc,f.x,f.y,f.w,f.h);
      if(S.phase==='run'){ const x=Math.round((S.frames?S.frame/S.frames:0)*mon.width);
        mctx.fillStyle='rgba(255,255,255,0.16)'; mctx.fillRect(x,0,1,mon.height); }
    }catch(e){} } // en try/catch a propósito: un fallo de dibujo NUNCA puede congelar el modelo de progreso

  function exSetPhase(ph){ S.phase=ph;
    const chip=$$('#exChip'), dot=$$('#exDot'), rail=$$('#exRail'), acts=$$('#exActs');
    chip.className='exs-chip'+(ph==='run'?' run':ph==='pause'?' pause':ph==='done'?' done':'');
    chip.textContent=ph==='run'?T('Rendering','Renderizando'):ph==='pause'?T('Paused','En pausa'):ph==='done'?T('Done','Terminado'):T('Idle','En reposo');
    dot.className='exs-dot'+(ph==='run'?' run':ph==='pause'?' pause':ph==='done'?' done':'');
    rail.className='exs-rail'+(ph==='pause'?' pause':ph==='done'?' done':'');
    acts.style.display=(ph==='run'||ph==='pause')?'flex':'none';
    $$('#exPhase').textContent=ph==='run'?T('Rendering','Renderizando'):ph==='pause'?T('Paused','En pausa'):ph==='done'?T('Finished','Terminado'):T('Ready','Listo');
    $$('#exGoTxt').textContent=(ph==='run'||ph==='pause')?T('Restart render','Reiniciar render'):ph==='done'?T('Export again','Exportar de nuevo'):T('Export','Exportar');
  }

  /* --- estimación y validaciones: la lógica del diálogo viejo, ahora leyendo de exPx() --- */
  function exSecs(){ return exRangeSecs(); }
  function exFrames(){ return Math.max(1,Math.round(exSecs()*S.fps)); }
  function exEstBytes(){ const p=exPx(S), n=exFrames(), c=S.codec;
    if(c==='still')return p.w*p.h*1.2;
    if(c==='png')return p.w*p.h*1.2*n;
    if(c==='hap'||c==='hapq'){ const F=HAP_FMT[c]; return Math.ceil(p.w/4)*Math.ceil(p.h/4)*F.bpb*16*n*0.85; }
    return S.br*1e6/8*exSecs(); }
  function exAutoBr(){ const p=exPx(S); return Math.max(24,Math.min(800,Math.round(p.w*p.h*S.fps*0.11/1e6))); }

  function exPaintSz(){ const host=$$('#exSzCtl'), p=exPx(S), as2=activeSeq()||{};
    ov.querySelectorAll('#exSz button').forEach(b=>b.classList.toggle('on',b.dataset.sz===S.szMode));
    if(S.szMode==='match'){ host.innerHTML=`<span class="exs-hint">${p.w} × ${p.h} px · ${T('from the active sequence','de la secuencia activa')}</span>`; return; }
    if(S.szMode==='preset'){ host.innerHTML=`<select id="exSzP">${[2048,3072,4096,6144,8192].map(v=>`<option value="${v}"${v===S.szPreset?' selected':''}>${v}</option>`).join('')}</select><span class="exs-unit">${dome?'px²':T('px wide','px de ancho')}</span><span class="exs-hint">${p.w} × ${p.h} px</span>`;
      host.querySelector('#exSzP').onchange=e=>{ S.szPreset=+e.target.value; exUpd(); }; return; }
    host.innerHTML=`<input type="number" id="exSzW" min="16" max="16384" step="2" value="${p.w}" style="width:74px;"><span class="exs-unit">×</span>`+
      `<input type="number" id="exSzH" min="16" max="16384" step="2" value="${p.h}" style="width:74px;"${dome?' disabled':''}><span class="exs-unit">px</span>`+
      `<span class="exs-hint">${dome?T('square — height follows width','cuadrado — el alto sigue al ancho'):(room?T('unwrapped strip','tira desenrollada'):'')}</span>`;
    const wI=host.querySelector('#exSzW'), hI=host.querySelector('#exSzH');
    const clamp=v=>Math.max(16,Math.min(16384,Math.round(+v||16)));
    const commit=()=>{ S.szW=clamp(wI.value); if(dome)S.szH=S.szW; else S.szH=clamp(hI.value); exUpd(); };
    for(const el of [wI,hI]){ if(!el)continue; el.onkeydown=e=>{ e.stopPropagation();
        if(e.key==='Enter'){ e.preventDefault(); commit(); } else if(e.key==='Escape'){ e.preventDefault(); exPaintSz(); } };
      el.onblur=commit; } }

  async function exValidate(){ const go=$$('#exGo'); if(!go)return;
    const c=S.codec; if(c!=='mp4'&&c!=='hevc'){ go.disabled=false; return; }
    const p=exPx(S); go.disabled=true;
    let ok=false; try{ ok=!!(await (c==='hevc'?pickHevcCodec(p.w,p.h,S.br*1e6,S.fps):pickAvcCodec(p.w,p.h,S.br*1e6,S.fps))); }catch(e){}
    if(!document.getElementById('exGo')||S.codec!==c)return; // obsoleto: se cerró la hoja o cambió la selección
    go.disabled=!ok;
    if(!ok){ const est=$$('#exEst'); est.classList.add('warn');
      est.textContent=(c==='hevc')?T('H.265 is not available at '+p.w+'×'+p.h+' on this build — use AV1-grade sizes or a PNG sequence.','H.265 no está disponible a '+p.w+'×'+p.h+' en esta compilación — usa una secuencia PNG.')
                                  :T('H.264 tops out near 3072² on this GPU — use H.265 or a PNG sequence for '+p.w+'×'+p.h+'.','H.264 se topa cerca de 3072² en esta GPU — usa H.265 o una secuencia PNG para '+p.w+'×'+p.h+'.'); } }

  function exUpd(){ const p=exPx(S), c=S.codec, isVid=(c==='mp4'||c==='hevc'), isHap=(c==='hap'||c==='hapq');
    $$('#exCodec').value=c; $$('#exFps').value=String(S.fps);
    $$('#exBrRow').style.display=isVid?'flex':'none';
    $$('#exChunkRow').style.display=isHap?'flex':'none';
    if(!S.brTouched){ S.br=exAutoBr(); }
    $$('#exBr').value=S.br;
    exPaintSz();
    // monitor: proxy real y nota de encaje
    const f=exFit(); $$('#exProxy').textContent=f.w+'×'+f.h+' '+T('proxy','proxy');
    $$('#exFit').textContent=(dome?T('Dome 1:1 in 16:9','Domo 1:1 en 16:9'):room?T('Strip in 16:9','Tira en 16:9'):T('16:9 fills the box','16:9 llena la caja'));
    // estimación
    const n=exFrames(), est=exEstBytes(); const e=$$('#exEst'); let warn=false;
    let txt=fmtBytes(est)+' · '+n+' '+T('frames','fotogramas')+' · '+p.w+' × '+p.h;
    if(isHap){ const F=HAP_FMT[c]; const cv=S.chunks, ch=(cv==='auto')?hapAutoChunks():+cv;
      $$('#exChunkHint').textContent=(cv==='auto'?ch+' · ':'')+T('parallel decode threads','hilos de decodificación');
      txt+=' · '+F.label; }
    else if(isVid){ const bpp=S.br*1e6/(p.w*p.h*S.fps);
      const q=bpp>=0.15?T('High','Alta'):bpp>=0.08?T('Good','Buena'):T('Low — raise bitrate','Baja — sube el bitrate');
      txt+=' · '+bpp.toFixed(2)+' bpp · '+q; }
    else if(c==='png'&&est>1.5e9){ warn=true; txt+=' · '+T('large, high RAM','grande, mucha RAM'); }
    e.textContent=txt; e.classList.toggle('warn',warn);
    if(S.phase==='idle'){ $$('#exSub').textContent=n+' '+T('frames','fotogramas')+' · '+exFmtDur(exSecs())+' '+T('of timeline','de la línea de tiempo'); }
    const fc=$('#fmtChip'); if(fc){ fc._codec=(HAP_FMT[c]?HAP_FMT[c].label:c.toUpperCase()); fc.textContent=(dome?(p.w+'²'):(p.w+'×'+p.h))+' · '+S.fps+'p · '+fc._codec; }
    exDrawMon(); exValidate();
    lastExportSet({codec:S.codec,res:(S.szMode==='preset'?S.szPreset:null),fps:S.fps,br:S.br}); }

  /* --- rango: I/O sólo si hay marcas (regla existente) --- */
  { const hw=state.workIn!=null&&state.workOut!=null&&state.workOut>state.workIn; const rg=$$('#exRange');
    const io=rg.querySelector('[data-rg=inout]'), cl=rg.querySelector('[data-rg=clips]');
    io.disabled=!hw; (hw?io:cl).classList.add('on');
    const tc=()=>{ const useIO=io.classList.contains('on'); const r=useIO?[state.workIn,state.workOut]:clipExtent();
      $$('#exRangeTc').textContent=fmtTime(r[0])+' → '+fmtTime(r[1]); };
    rg.querySelectorAll('button').forEach(b=>b.onclick=()=>{ if(b.disabled)return;
      rg.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b)); tc(); exUpd(); }); tc(); }
  if(room) ov.querySelectorAll('#exRoomMode button').forEach(b=>b.onclick=()=>{ S.roomMode=b.dataset.rm;
    ov.querySelectorAll('#exRoomMode button').forEach(x=>x.classList.toggle('on',x===b)); });
  if(!HAS_WC){ ['mp4','hevc'].forEach(cv=>{ const mo=$$('#exCodec').querySelector('option[value="'+cv+'"]');
    if(mo){ mo.disabled=true; mo.textContent+=' '+T('(unavailable)','(no disponible)'); } }); }

  ov.querySelectorAll('#exSz button').forEach(b=>b.onclick=()=>{ const m=b.dataset.sz;
    if(m==='custom'){ const p=exPx(S); S.szW=p.w; S.szH=p.h; } // Personalizado arranca desde el tamaño actual
    S.szMode=m; exUpd(); });
  $$('#exCodec').onchange=e=>{ S.codec=e.target.value; S.brTouched=false; exUpd(); };
  $$('#exFps').onchange=e=>{ S.fps=+e.target.value; S.brTouched=false; exUpd(); };
  $$('#exBr').oninput=e=>{ S.brTouched=true; S.br=Math.max(1,Math.min(800,+e.target.value||1)); exUpd(); };
  $$('#exBrAuto').onclick=()=>{ S.brTouched=false; exUpd(); };
  $$('#exChunks').onchange=e=>{ S.chunks=e.target.value; exUpd(); };

  /* --- preajustes --- */
  const ps=$$('#exPreset');
  const fillPresets=()=>{ ps.innerHTML='<option value="">—</option>'+(state.exportPresets||[]).map((p,i)=>`<option value="${i}">${lchEsc(p.name)}</option>`).join(''); };
  fillPresets();
  ps.onchange=()=>{ const p=(state.exportPresets||[])[+ps.value]; if(!p)return;
    S.codec=p.codec; S.fps=+p.fps; if(p.res){ S.szMode='preset'; S.szPreset=+p.res; }
    if(p.bitrate){ S.br=Math.round(p.bitrate/1e6); S.brTouched=true; } exUpd(); };
  $$('#exSavePreset').onclick=()=>{ const p=exPx(S);
    appPrompt(T('Preset name:','Nombre del preajuste:'),S.codec.toUpperCase()+' '+p.w,name=>{ if(!name)return;
      state.exportPresets=state.exportPresets||[];
      state.exportPresets.push({name,codec:S.codec,res:p.w,fps:S.fps,bitrate:S.br*1e6});
      markDirty(); fillPresets(); ps.value=state.exportPresets.length-1; flashStatus(T('Preset saved','Preajuste guardado')); }); };

  /* --- destino --- */
  $$('#exDest').textContent=T('Destination · chosen when the render starts','Destino · se elige al arrancar el render');

  /* --- cerrar --- */
  const close=()=>{ const fc=$('#fmtChip'); if(fc)fc._codec=null; ov.remove(); updFmtChip();
    for(let i=_exJobs.length-1;i>=0;i--)if(_exJobs[i].status==='done'||_exJobs[i].status==='cancelled')_exJobs.splice(i,1);
    document.removeEventListener('keydown',onKey,true); };
  const onKey=e=>{ if(e.key==='Escape'&&!e.target.closest('input,select')){ e.preventDefault(); e.stopPropagation(); close(); } };
  document.addEventListener('keydown',onKey,true);
  $$('#exX').onclick=close; $$('#exClose').onclick=close;

  /* --- pausa / cancelar --- */
  $$('#exPause').onclick=()=>{ if(S.phase==='run'){ _exPaused=true; S.tPause=performance.now(); exSetPhase('pause'); $$('#exPause').textContent=T('Resume','Reanudar'); }
    else if(S.phase==='pause'){ S.t0+=performance.now()-S.tPause; _exPaused=false; exSetPhase('run'); $$('#exPause').textContent=T('Pause','Pausar'); } }; // al reanudar se corrige t0: si no, el tiempo transcurrido pega un salto y la ETA se dispara
  $$('#exCancel').onclick=()=>{ _exPaused=false; cancelExport=true; };

  /* --- exportar --- */
  $$('#exGo').onclick=()=>{ const p=exPx(S), n=exFrames();
    const codec=S.codec, fps=S.fps, br=S.br*1e6, range=exRangeMode();
    const cLbl=HAP_FMT[codec]?HAP_FMT[codec].label:codec.toUpperCase();
    S.frames=n; S.frame=0; S.bytes=0; S.t0=performance.now(); _exPaused=false; exSetPhase('run');
    $$('#exPause').textContent=T('Pause','Pausar');
    const addJob=(extra,labelTxt)=>{ const rec={id:uid(),name:labelTxt,status:'queued',p:0,labelTxt:null,opt:null};
      _exJobs.push(rec);
      let _lastStat=0;
      const job={
        prog:(k,tot)=>{ rec.p=k/tot; S.frame=k; S.frames=tot;
          const el=(performance.now()-S.t0)/1000, f=k/Math.max(1,tot);
          $$('#exPct').textContent=Math.round(f*100)+'%'; $$('#exRail').firstElementChild.style.width=(f*100).toFixed(1)+'%';
          $$('#exSub').textContent=T('frame ','fotograma ')+k+' / '+tot+' · '+cLbl+' · '+p.w+'×'+p.h;
          $$('#exElapsed').textContent=exFmtDur(el);
          $$('#exRemain').textContent=(k>=3&&k<tot)?exFmtDur(el/k*(tot-k)):'—';
          $$('#exWrote').textContent=S.bytes?fmtBytes(S.bytes):'—';
          $$('#exTc').textContent=exFmtDur(k/Math.max(1,S.fps));
          const fps2=k/Math.max(0.001,el), mbs=S.bytes/Math.max(0.001,el)/1e6;
          $$('#exNote').textContent=fps2.toFixed(1)+' '+T('fps rendered','fps renderizados')+(S.bytes?(' · '+mbs.toFixed(0)+' MB/s '+T('to disk','a disco')):'');
          const now=performance.now(); if(now-_lastStat>500){ _lastStat=now; const sa=$('#statAuto');
            if(sa){ sa.textContent=Math.round(f*100)+'% · '+T('Exporting ','Exportando ')+labelTxt; sa.style.color=''; }
            try{ if(IS_ELEC&&DSP.setProgress)DSP.setProgress(f); }catch(e){} } },
        label:t=>{ rec.labelTxt=t; $$('#exPhase').textContent=t; },
        frame:()=>exDrawMon(),                       // [R179] el mismo enganche que usa el visor del render in place
        wrote:b=>{ S.bytes+=b||0; },
        done:cx=>{ rec.status=cx?'cancelled':'done'; if(!cx)rec.p=1;
          _exPaused=false; exSetPhase(cx?'idle':'done');
          if(!cx){ $$('#exPct').textContent='100%'; $$('#exRail').firstElementChild.style.width='100%';
            $$('#exSub').textContent=S.frames+' '+T('frames written','fotogramas escritos')+(S.bytes?(' · '+fmtBytes(S.bytes)):'');
            $$('#exNote').textContent=T('Saved to the chosen destination','Guardado en el destino elegido'); }
          else { $$('#exNote').textContent=T('Cancelled · partial output kept','Cancelado · se conserva lo escrito'); }
          flashStatus(cx?T('Export cancelled','Exportación cancelada'):T('Export finished','Exportación terminada'),cx?'err':undefined);
          try{ if(IS_ELEC&&DSP.setProgress)DSP.setProgress(-1); }catch(e){} updExportUI(); } };
      const opt=Object.assign({codec,res:p.w,outW:p.w,outH:p.h,fps,bitrate:br,chunks:S.chunks,range,job,_rec:rec},extra||{});
      rec.opt=opt; _exq.push(opt); updExportUI(); };
    const queueJob=()=>{ const rm=room?S.roomMode:null;
      if(room&&rm==='walls'){ const sw=as.w||1, sh=as.h||1;
        for(const w of as.room.walls) addJob({wall:{role:w.role,x0:w.x0,x1:w.x1,pxW:w.pxW,pxH:w.pxH,stripW:sw,stripH:sh}}, roomRoleLabel(w.role)+' · '+w.pxW+'×'+w.pxH+' '+cLbl); }
      else addJob(null,(room?(T('Walls','Muros')+' · '):'')+p.w+'×'+p.h+' '+cLbl);
      if(room && $$('#exFloor') && $$('#exFloor').checked){ const fm=mediaById(as.room.floorSeqId);
        if(fm&&(fm.nestClips||[]).length) addJob({seqId:fm.id}, T('Floor','Piso')+' · '+(fm.w||1920)+'×'+(fm.h||1080)+' '+cLbl);
        else if(fm) flashStatus(T('Floor has no clips — skipped','El piso no tiene clips — omitido'),'err'); }
      pumpExportQ(); };
    if((codec==='mp4'||codec==='hevc') && !(IS_ELEC && DSP.fileOpen)){ const estGB=br/8*exSecs()/1e9; // sólo avisa cuando NO se puede escribir en streaming (navegador); el .exe escribe el MP4 trozo a trozo
      if(estGB>1.8){ appConfirm(T('This MP4 is about ','Este MP4 pesa ~')+estGB.toFixed(1)+T(' GB and is assembled in memory before saving — it may run out of RAM. Use a PNG sequence for very large renders. Continue anyway?',' GB y se arma en memoria antes de guardar — podría quedarse sin RAM. Usa una secuencia PNG para renders muy grandes. ¿Continuar igual?'),
          ok=>{ if(ok)queueJob(); else exSetPhase('idle'); },{ok:T('Continue anyway','Continuar igual')}); return; } }
    queueJob(); };

  exSetPhase('idle'); exUpd();
}
