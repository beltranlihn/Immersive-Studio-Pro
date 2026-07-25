/* ============================================================================================================
   ARCHIVED — pantalla de inicio "landing" v1 (showLanding) · reemplazada 2026-07-25 (R153)
   ------------------------------------------------------------------------------------------------------------
   Origen:   app.js · `showLanding()`. Commit previo: 42241aa.
   Sacado:   2026-07-25
   Motivo:   El handoff de Claude Design ("Launcher - Rev 4.dc.html") reemplaza esta pantalla por un LAUNCHER:
             tres tipos de proyecto con todos sus parámetros a la vista, visores técnicos en vivo, tabla de muros
             y una fila de proyectos recientes. El landing viejo eran cuatro botones que abrían los diálogos de
             creación; el launcher expone los parámetros y crea el proyecto sin pasar por ellos.
   Restaurar:pegar esta función en lugar de `showLanding`/`renderLauncher` y quitar el CSS `.lch-*` de index.html.
             Los diálogos que usaba (domeSetupDialog / flatResDialog / roomSetupDialog) siguen vivos — los usa el
             menú File — así que no hay que restaurar nada más.
   Relacion: handoff launcher+splash, R153, ADR-0007, ADR-0008
   ============================================================================================================ */

function showLanding(){ if(document.getElementById('landingOv'))return;
  const recents=IS_ELEC?getRecents():[];
  const domeGlyph='<div style="width:38px;height:38px;opacity:0.5;">'+LOGO_SVG+'</div>';
  const card=r=>`<button class="lgcard" data-path="${escAttr(r.path)}" title="${escAttr(r.path)}" style="text-align:left;background:#15181C;border:.5px solid rgba(255,255,255,0.09);border-radius:9px;overflow:hidden;cursor:pointer;padding:0;display:flex;flex-direction:column;transition:border-color .12s;">
      <div style="aspect-ratio:16/10;background:var(--s0) ${r.thumb?`center/cover no-repeat url(${r.thumb})`:''};display:flex;align-items:center;justify-content:center;border-bottom:.5px solid rgba(255,255,255,0.06);">${r.thumb?'':domeGlyph}</div>
      <div style="padding:8px 11px;min-width:0;"><div style="font-size:13px;color:var(--ink);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escAttr(r.name)}</div><div style="font-size:11px;color:var(--ink-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px;">${relTime(r.t)}${r.folder?' · '+escAttr(r.folder.split(/[\\/]/).pop()):''}</div></div></button>`;
  const ov=document.createElement('div'); ov.className='overlay'; ov.id='landingOv'; ov.style.background='#0E0F11'; ov.style.zIndex='300';
  ov.innerHTML=`<div style="width:min(900px,92vw);max-height:88vh;display:flex;flex-direction:column;gap:22px;">
     <div style="display:flex;align-items:center;gap:20px;">
       <img id="lgLogo" width="104" height="104" style="width:104px;height:104px;flex-shrink:0;object-fit:contain;border-radius:22px;" alt="Immersive Studio Pro">
       <div><div style="font-size:25px;font-weight:600;color:var(--ink);letter-spacing:-0.015em;">Immersive Studio Pro</div>
         <div style="font-size:13px;color:var(--ink-3);margin-top:4px;">${T('Dome · 2D · 360 room','Domo · 2D · sala 360')} · <b style="color:var(--ink-2);font-weight:500;">Version 1.0</b></div></div>
     </div>
     <div style="display:flex;gap:12px;flex-wrap:wrap;">
       <button id="lgNew" class="mbtn pri" style="height:40px;padding:0 18px;font-size:13px;">${ICO('plus',16)} ${T('New dome project','Nuevo proyecto domo')}</button>
       <button id="lgNew2d" class="mbtn pri" style="height:40px;padding:0 18px;font-size:13px;background:var(--s2);color:var(--ink);">${ICO('plus',16)} ${T('New 2D project','Nuevo proyecto 2D')}</button>
       <button id="lgNewRoom" class="mbtn pri" style="height:40px;padding:0 18px;font-size:13px;background:var(--s2);color:var(--ink);">${ICO('plus',16)} ${T('New 360 room','Nueva sala 360')}</button>
       <button id="lgOpen" class="mbtn" style="height:40px;padding:0 16px;font-size:13px;">${ICO('folder',15)} ${T('Open project…','Abrir proyecto…')}</button>
     </div>
     <div style="display:flex;flex-direction:column;min-height:0;">
       <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.09em;color:var(--ink-dim);margin-bottom:11px;">${T('Recent','Recientes')}</div>
       <div id="lgRecents" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(188px,1fr));gap:12px;overflow-y:auto;padding-right:4px;">
         ${recents.length? recents.map(card).join('') : `<div style="color:var(--ink-2);font-size:13px;padding:6px 0;">${T('No recent projects yet — create one to get started.','Aún no hay proyectos recientes — crea uno para empezar.')}</div>`}
       </div>
     </div>
     <div style="font-size:11px;color:var(--ink-dim);letter-spacing:0.02em;padding-top:2px;">Created by Alma Digital Studio — all rights reserved</div>
   </div>`;
  document.body.appendChild(ov);
  ov._stopLogo=startLogoLoop(ov.querySelector('#lgLogo')); // [U9] animated logo loop
  ov.querySelector('#lgNew').onclick=()=>{ domeSetupDialog(cfg=>{ hideLanding(); newProject('dome',cfg.res,cfg.res,cfg.fps,cfg.cov); }); };
  ov.querySelector('#lgNew2d').onclick=()=>{ flatResDialog((w,h,fps)=>{ hideLanding(); newProject('flat',w,h,fps); }); };
  { const rb=ov.querySelector('#lgNewRoom'); if(rb)rb.onclick=()=>{ roomSetupDialog(cfg=>{ hideLanding(); newRoomProject(cfg); }); }; }
  ov.querySelector('#lgOpen').onclick=()=>{ openProject().then(()=>{}); }; // loadProject hides the landing on success
  ov.querySelectorAll('.lgcard').forEach(b=>{ b.onmouseenter=()=>b.style.borderColor='rgba(201,205,211,0.5)'; b.onmouseleave=()=>b.style.borderColor='rgba(255,255,255,0.09)';
    b.onclick=()=>{ const p=b.dataset.path; if(!p)return; if(IS_ELEC&&DSP.exists){ DSP.exists(p).then(ok=>{ if(ok)openProjectPath(p); else { appAlert(T('That project file was moved or deleted.','Ese archivo de proyecto se movió o eliminó.')); const a=getRecents().filter(r=>r.path!==p); saveRecents(a); hideLanding(); showLanding(); } }); } else openProjectPath(p); }; }); }
