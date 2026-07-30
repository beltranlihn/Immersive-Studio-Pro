/* ARCHIVADO — ADR-0007 (código deprecado se archiva, no se borra)
 *
 * Origen : app.js · buildPenMaskUI(host,c) — el MINI-EDITOR de máscaras de pluma del inspector
 *          (lienzo #penCv de 220 px con miniatura al 18 %, cruz de centro, polígonos y puntos,
 *           + toXY / hit / pointerdown / pointermove / pointerup / dblclick sobre ese lienzo)
 * Fecha  : 2026-07-30
 * Ticket : R226 · Etapa 4 de la tanda de Beltrán (docs/NEXT.md) — «Pen mask editable EN EL CANVAS»
 * Motivo : la máscara se editaba a ciegas: 220 px cuadrados con una miniatura al 18 % de opacidad no dicen
 *          dónde cae el recorte sobre el clip REAL, y en el domo no lo dicen en absoluto (el contenido va
 *          deformado por el warp y el mini-lienzo lo mostraba plano). Beltrán pidió que la edición pase al
 *          lienzo del visor principal, con los puntos proyectados por el MISMO camino que el contenido.
 *          Sustituto: `_maskEdit` / `startMaskEdit` / `endMaskEdit` / `drawMaskEditOverlay` /
 *          `penLocal`+`penUnlocal`+`penPix`+`penFromPix`+`penDomeBasis` + los gestos de `gridc`
 *          (`maskEditPointerDown` / `maskEditPointerMove` / dblclick). Del inspector sobreviven la lista de
 *          máscaras (invert / feather / borrar), Expand, «Add mask» y el botón «Edit on canvas».
 * Datos  : `c.penMasks` / `c._penSel` / `c.penExpand` / `c._penCv` NO cambian, y `rasterizePenMasks` tampoco:
 *          sólo se retiró la superficie de edición. Los proyectos `.isp` viejos siguen abriéndose igual.
 * Restaurar: pegar la función de abajo de vuelta en app.js (sustituye a la nueva `buildPenMaskUI`) y volver a
 *          quitar la llamada a `startMaskEdit` del botón «Add mask». Ojo: la nueva versión ya no crea `#penCv`,
 *          así que nada más del código vivo depende de ese id.
 */

/* [I3] pen (point) mask editor: draw silhouettes with points, invert, feather, expand — several per clip. Renders through
   rasterizePenMasks → c.maskTex (the custom-mask sampler). Points are 0..1 in the clip's mask space. */
function buildPenMaskUI(host,c){ if(!c)return; const S=220; const masks=c.penMasks||(c.penMasks=[]);
  if(c._penSel==null||c._penSel>=masks.length) c._penSel=masks.length?masks.length-1:-1;
  const wrap=document.createElement('div'); wrap.className='prow'; wrap.style.cssText='flex-direction:column;align-items:stretch;gap:6px;';
  wrap.innerHTML=`<div style="display:flex;align-items:center;gap:6px;">
      <span class="lab" style="width:auto;color:var(--ink-2);">${T('Point mask','Máscara de puntos')}</span><span style="flex:1"></span>
      <button class="mbtn" id="penAdd" style="height:18px;padding:0 8px;">${ICO('plus',11)} ${T('Add mask','Añadir máscara')}</button></div>
    <canvas id="penCv" width="${S}" height="${S}" style="width:100%;aspect-ratio:1;border:.5px solid rgba(255,255,255,0.12);border-radius:2px;background:#0c0d10;cursor:crosshair;touch-action:none;display:${masks.length?'block':'none'};"></canvas>
    <div id="penList" style="display:flex;flex-direction:column;gap:3px;"></div>
    <div class="prow" id="penExpRow" style="padding:0;gap:6px;display:${masks.length?'flex':'none'};"><span class="lab" style="width:auto;color:var(--ink-3);">${T('Expand','Expandir')}</span><input type="range" id="penExp" min="20" max="200" value="${Math.round((c.penExpand||1)*100)}" style="flex:1;"><span class="tnum" id="penExpV" style="width:38px;text-align:right;color:var(--ink-dim);">${Math.round((c.penExpand||1)*100)}%</span></div>
    <span style="font-size:11px;color:var(--ink-dim);line-height:1.35;display:${masks.length?'block':'none'}" id="penHint">${T('Click the canvas to add points · drag to move · double-click a point to remove.','Clic en el lienzo para añadir puntos · arrastra para mover · doble clic en un punto para quitarlo.')}</span>`;
  host.appendChild(wrap);
  const cv=wrap.querySelector('#penCv'), ctx=cv.getContext('2d'), m=mediaById(c.mediaId);
  const draw=()=>{ ctx.clearRect(0,0,S,S); ctx.fillStyle='#0c0d10'; ctx.fillRect(0,0,S,S);
    if(m&&m.thumb){ ctx.globalAlpha=0.18; const im=draw._im||(draw._im=new Image()); if(im.src!==m.thumb){ im.onload=draw; im.src=m.thumb; } if(im.complete&&im.naturalWidth)ctx.drawImage(im,0,0,S,S); ctx.globalAlpha=1; }
    ctx.strokeStyle='rgba(255,255,255,0.06)'; ctx.beginPath(); ctx.moveTo(S/2,0);ctx.lineTo(S/2,S);ctx.moveTo(0,S/2);ctx.lineTo(S,S/2);ctx.stroke();
    const ex=Math.max(0.2,c.penExpand||1);
    (c.penMasks||[]).forEach((mk,mi)=>{ if(!mk.pts||!mk.pts.length)return; const active=mi===c._penSel; const P=p=>[(0.5+(p[0]-0.5)*ex)*S,(0.5+(p[1]-0.5)*ex)*S];
      ctx.lineWidth=active?1.5:1; ctx.strokeStyle=active?'#4FC3E8':'rgba(255,255,255,0.4)'; ctx.fillStyle=active?'rgba(79,195,232,0.10)':'rgba(255,255,255,0.05)';
      ctx.beginPath(); mk.pts.forEach((p,i)=>{ const q=P(p); i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]); }); if(mk.pts.length>=3)ctx.closePath(); ctx.fill(); ctx.stroke();
      if(active)mk.pts.forEach(p=>{ const q=P(p); ctx.fillStyle='#4FC3E8'; ctx.beginPath(); ctx.arc(q[0],q[1],3.6,0,6.283); ctx.fill(); ctx.fillStyle='#0c0d10'; ctx.beginPath(); ctx.arc(q[0],q[1],1.5,0,6.283); ctx.fill(); }); }); };
  const commit=()=>{ rasterizePenMasks(c); render(); markDirty(); draw(); };
  const rebuildList=()=>{ const L=wrap.querySelector('#penList'); L.innerHTML='';
    (c.penMasks||[]).forEach((mk,mi)=>{ const row=document.createElement('div'); row.style.cssText='display:flex;align-items:center;gap:5px;font-size:11px;padding:2px 3px;border-radius:2px;background:'+(mi===c._penSel?'rgba(79,195,232,0.14)':'transparent')+';';
      row.innerHTML=`<button class="penSel" title="${T('Edit this mask','Editar esta máscara')}" style="width:15px;height:15px;border:none;background:none;color:${mi===c._penSel?'#4FC3E8':'var(--ink-3)'};cursor:pointer;font-size:10px;">◆</button>
        <span style="flex:0 0 auto;color:var(--ink-2);">${T('Mask','Máscara')} ${mi+1}</span>
        <label style="display:flex;align-items:center;gap:3px;color:var(--ink-3);cursor:pointer;"><input type="checkbox" class="penInv" ${mk.invert?'checked':''}> ${T('Invert','Invertir')}</label>
        <span style="color:var(--ink-3);flex-shrink:0;">${T('Feather','Suavizar')}</span><input type="range" class="penFe" min="0" max="60" value="${Math.round(mk.feather||0)}" style="flex:1;min-width:24px;">
        <button class="penDel" title="${T('Delete mask','Eliminar máscara')}" style="width:15px;height:15px;border:none;background:none;color:var(--ink-3);cursor:pointer;">✕</button>`;
      L.appendChild(row);
      row.querySelector('.penSel').onclick=()=>{ c._penSel=mi; rebuildList(); draw(); };
      row.querySelector('.penInv').onchange=e=>{ pushUndo(); mk.invert=e.target.checked; commit(); };
      const fe=row.querySelector('.penFe'); fe.oninput=e=>{ mk.feather=+e.target.value; rasterizePenMasks(c); render(); }; fe.onpointerdown=()=>pushUndo(); fe.onchange=()=>markDirty();
      row.querySelector('.penDel').onclick=()=>{ pushUndo(); c.penMasks.splice(mi,1); if(c._penSel>=c.penMasks.length)c._penSel=c.penMasks.length-1;
        const vis=c.penMasks.length?'block':'none'; cv.style.display=vis; wrap.querySelector('#penExpRow').style.display=c.penMasks.length?'flex':'none'; wrap.querySelector('#penHint').style.display=vis;
        if(!penMaskActive(c)&&c.props.mask==='pen')c.props.mask='none'; rebuildList(); commit(); }; }); };
  const toXY=e=>{ const r=cv.getBoundingClientRect(); const ex=Math.max(0.2,c.penExpand||1); // invert the expand so dragging lands where the cursor is
    return [Math.max(0,Math.min(1,0.5+(((e.clientX-r.left)/r.width)-0.5)/ex)), Math.max(0,Math.min(1,0.5+(((e.clientY-r.top)/r.height)-0.5)/ex))]; };
  const hit=(mk,xy)=>{ if(!mk||!mk.pts)return -1; const tol=(11/S); for(let i=0;i<mk.pts.length;i++){ const dx=mk.pts[i][0]-xy[0],dy=mk.pts[i][1]-xy[1]; if(dx*dx+dy*dy<tol*tol)return i; } return -1; };
  let drag=null;
  cv.addEventListener('pointerdown',e=>{ e.preventDefault(); const mk=c.penMasks[c._penSel]; if(!mk)return; const xy=toXY(e); const hi=hit(mk,xy);
    if(hi>=0){ drag={pi:hi}; pushUndo(); try{cv.setPointerCapture(e.pointerId);}catch(_){} } else { pushUndo(); mk.pts.push(xy); commit(); } });
  cv.addEventListener('pointermove',e=>{ if(!drag)return; const mk=c.penMasks[c._penSel]; if(!mk)return; mk.pts[drag.pi]=toXY(e); rasterizePenMasks(c); render(); draw(); });
  cv.addEventListener('pointerup',()=>{ if(drag){ drag=null; markDirty(); } });
  cv.addEventListener('dblclick',e=>{ const mk=c.penMasks[c._penSel]; if(!mk)return; const hi=hit(mk,toXY(e)); if(hi>=0&&mk.pts.length>3){ pushUndo(); mk.pts.splice(hi,1); commit(); } });
  wrap.querySelector('#penAdd').onclick=()=>{ pushUndo(); c.penMasks=c.penMasks||[]; c.penMasks.push({pts:[[0.35,0.35],[0.65,0.35],[0.65,0.65],[0.35,0.65]],feather:0,invert:false,on:true}); c._penSel=c.penMasks.length-1;
    cv.style.display='block'; wrap.querySelector('#penExpRow').style.display='flex'; wrap.querySelector('#penHint').style.display='block'; rebuildList(); commit(); };
  const expR=wrap.querySelector('#penExp'); if(expR){ expR.onpointerdown=()=>pushUndo(); expR.oninput=()=>{ c.penExpand=Math.max(0.2,(+expR.value)/100); wrap.querySelector('#penExpV').textContent=(+expR.value)+'%'; rasterizePenMasks(c); render(); draw(); }; expR.onchange=()=>markDirty(); }
  rebuildList(); if(masks.length)draw();
}
