/* ARCHIVADO 2026-07-30 · [R227] — ADR-0007 (archivar, no borrar)
   ============================================================================================================
   Los DIÁLOGOS DE CREACIÓN del menú File. El menú «File» tenía tres entradas de proyecto nuevo —«New dome
   project…», «New 2D project…» y «New 360 room…»— y cada una abría su propio diálogo modal para elegir
   resolución / cobertura / muros. Duplicaban lo que la pantalla de inicio (launcher, `showLanding`/`renderLauncher`)
   ya hace mejor: los tres formatos a la vista, TODOS los parámetros editables y una vista previa en vivo con el
   `render()` real (R182/R198). Desde R227 el menú File tiene UNA sola entrada, `New project…`, que lleva al
   launcher (`newProjectViaLanding`), así que estos dos diálogos se quedaron sin llamantes.
   `MENU_ROOM_LABEL` existía para que la etiqueta del ítem de menú y la pista del diálogo «New sequence» no se
   desincronizaran; la pista ahora apunta a `New project…` y la constante se quedó sin uso.
   `roomSetupDialog` NO está aquí: sigue vivo en app.js — lo usa Project → «Room geometry…» (`applyRoomGeometry`),
   que reconfigura la sala del proyecto abierto sin crear nada.
   Si algún día hace falta volver a crear un proyecto sin pasar por el launcher, el código está aquí íntegro y sus
   dependencias (`drawSeqViz`, `DOME_COV`, `ICO`, `T`) siguen existiendo tal cual.
   ============================================================================================================ */

const MENU_ROOM_LABEL=()=>T('New 360 room…','Nueva sala 360…'); // [R215] single source for the File-menu item's label (~8397) and the New-sequence hint below, so a rename of one can't desync the other

/* landing "New 2D project" resolution picker → cb(w,h,fps) */
function flatResDialog(cb){ const ov=document.createElement('div'); ov.className='overlay'; ov.style.zIndex='320';
  ov.innerHTML=`<div class="modal" style="width:420px;"><div class="mh"><span class="t">${T('New 2D project','Nuevo proyecto 2D')}</span></div><div class="mb">
    <canvas id="fpViz" class="rs-cv" width="776" height="300" style="height:150px;margin-bottom:12px;"></canvas>
    <div class="frow"><label>${T('Preset','Preajuste')}</label><select id="fpPre" style="flex:1;"><option value="1920x1080" selected>1080p · 1920×1080</option><option value="3840x2160">4K UHD · 3840×2160</option><option value="1080x1920">${T('Vertical','Vertical')} 9:16 · 1080×1920</option><option value="1080x1080">${T('Square','Cuadrado')} · 1080×1080</option><option value="custom">${T('Custom…','Personalizado…')}</option></select></div>
    <div class="frow"><label>${T('Resolution','Resolución')}</label><input type="number" class="tnum" id="fpW" value="1920" min="16" max="8192" style="width:78px;"><span style="color:var(--ink-dim);">×</span><input type="number" class="tnum" id="fpH" value="1080" min="16" max="8192" style="width:78px;"><span class="tnum" style="color:var(--ink-dim);">px</span></div>
    <div class="frow"><label>${T('Frame rate','Cuadros/s')}</label><select id="fpFps"><option>24</option><option>25</option><option>30</option><option>48</option><option>50</option><option selected>60</option></select><span class="tnum" style="color:var(--ink-dim);">fps</span></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px;"><button class="mbtn" id="fpCancel">${T('Cancel','Cancelar')}</button><button class="mbtn pri" id="fpGo">${T('Create','Crear')}</button></div></div></div>`;
  document.body.appendChild(ov); const close=()=>ov.remove(); const pre=ov.querySelector('#fpPre'), wI=ov.querySelector('#fpW'), hI=ov.querySelector('#fpH');
  const viz=()=>{ try{ drawSeqViz(ov.querySelector('#fpViz'),'flat',{w:+wI.value||1920,h:+hI.value||1080}); }catch(e){} };
  pre.onchange=()=>{ if(pre.value!=='custom'){ const p=pre.value.split('x'); wI.value=p[0]; hI.value=p[1]; } viz(); };
  wI.oninput=()=>{ pre.value='custom'; viz(); }; hI.oninput=()=>{ pre.value='custom'; viz(); }; viz();
  ov.querySelector('#fpCancel').onclick=close; ov.addEventListener('pointerdown',e=>{if(e.target===ov)close();});
  ov.querySelector('#fpGo').onclick=()=>{ const w=Math.max(16,Math.min(8192,+wI.value||1920)), h=Math.max(16,Math.min(8192,+hI.value||1080)), fps=+ov.querySelector('#fpFps').value||60; close(); cb(w,h,fps); }; }

/* landing "New dome project" → cb({res,cov,fps}) — resolution + fisheye coverage (FOV), with a live dome preview */
function domeSetupDialog(cb){ const ov=document.createElement('div'); ov.className='overlay'; ov.style.zIndex='320';
  ov.innerHTML=`<div class="modal" style="width:420px;"><div class="mh"><span style="color:var(--ink-2);display:flex;">${ICO('view3d',16)}</span><span class="t">${T('New dome project','Nuevo proyecto domo')}</span></div><div class="mb">
    <canvas id="dsViz" class="rs-cv" width="776" height="360" style="height:180px;margin-bottom:12px;"></canvas>
    <div class="frow"><label>${T('Resolution','Resolución')}</label><select id="dsRes"><option>2048</option><option>3072</option><option selected>4096</option><option>6144</option><option>8192</option></select><span class="tnum" style="color:var(--ink-dim);">px²</span></div>
    <div class="frow"><label>${T('Coverage','Cobertura')}</label><select id="dsCov">${DOME_COV.map(c=>`<option value="${c}" ${c===180?'selected':''}>${c}°${c===180?' · '+T('fulldome','domo completo'):''}</option>`).join('')}</select><span class="tnum" style="color:var(--ink-dim);">FOV</span></div>
    <div class="frow"><label>${T('Frame rate','Cuadros/s')}</label><select id="dsFps"><option>24</option><option>25</option><option>30</option><option>48</option><option>50</option><option selected>60</option></select><span class="tnum" style="color:var(--ink-dim);">fps</span></div>
    <div style="font-size:11px;color:var(--ink-dim);margin-top:2px;">${T('Coverage is the fisheye field of view. 180° is a full hemisphere; wider domes pull the horizon inward.','La cobertura es el campo del ojo de pez. 180° es un hemisferio completo; los domos más amplios acercan el horizonte al centro.')}</div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px;"><button class="mbtn" id="dsCancel">${T('Cancel','Cancelar')}</button><button class="mbtn pri" id="dsGo">${ICO('view3d')} ${T('Create','Crear')}</button></div></div></div>`;
  document.body.appendChild(ov); const close=()=>ov.remove(); ov.querySelector('#dsCancel').onclick=close; ov.addEventListener('pointerdown',e=>{if(e.target===ov)close();});
  const viz=()=>{ try{ drawSeqViz(ov.querySelector('#dsViz'),'dome',{cov:+ov.querySelector('#dsCov').value||180}); }catch(e){} };
  ov.querySelector('#dsCov').onchange=viz; viz();
  ov.querySelector('#dsGo').onclick=()=>{ const res=+ov.querySelector('#dsRes').value||4096, cov=+ov.querySelector('#dsCov').value||180, fps=+ov.querySelector('#dsFps').value||60; close(); cb({res,cov,fps}); }; }
