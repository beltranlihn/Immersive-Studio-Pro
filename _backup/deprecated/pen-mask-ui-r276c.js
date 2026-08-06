/* [R276c] Version anterior del panel «Add mask», con estilos sueltos en linea. Reemplazada por una que sigue
   la gramatica del inspector (fila = etiqueta + mando + recuadro). */
function buildPenMaskUI(host,c){ if(!c)return; const masks=c.penMasks||(c.penMasks=[]);
  if(c._penSel==null||c._penSel>=masks.length) c._penSel=masks.length?masks.length-1:-1;
  const editing=(maskEditClip()===c);
  const wrap=document.createElement('div'); wrap.className='prow'; wrap.style.cssText='flex-direction:column;align-items:stretch;gap:6px;';
  wrap.innerHTML=`<div style="display:flex;align-items:center;gap:6px;">
      <span class="lab" style="width:auto;color:var(--ink-2);">${T('Point mask','Máscara de puntos')}</span><span style="flex:1"></span>
      <button class="mbtn" id="penAdd" style="height:18px;padding:0 8px;">${ICO('plus',11)} ${T('Add mask','Añadir máscara')}</button></div>
    <div id="penList" style="display:flex;flex-direction:column;gap:3px;"></div>
    <button class="mbtn${editing?' on':''}" id="penEdit" style="height:22px;display:${masks.length?'inline-flex':'none'};justify-content:center;">${editing?T('Done','Terminar'):T('Edit on canvas','Editar en el lienzo')}</button>
    <div class="prow" id="penExpRow" style="padding:0;gap:6px;display:${masks.length?'flex':'none'};"><span class="lab" style="width:auto;color:var(--ink-3);">${T('Expand','Expandir')}</span><input type="range" id="penExp" min="20" max="200" value="${Math.round((c.penExpand||1)*100)}" style="flex:1;"><span class="tnum" id="penExpV" style="width:38px;text-align:right;color:var(--ink-dim);">${Math.round((c.penExpand||1)*100)}%</span></div>
    <span style="font-size:11px;color:var(--ink-dim);line-height:1.35;display:${masks.length?'block':'none'}" id="penHint">${editing
      ? T('On the viewer: click the outline to add a point · drag to move · double-click to remove · Esc to finish.','En el visor: clic en el contorno para añadir un punto · arrastra para mover · doble clic para quitar · Esc para terminar.')
      : T('Edit the points on the viewer canvas, right over the clip.','Los puntos se editan en el lienzo del visor, sobre el clip.')}</span>`;
  host.appendChild(wrap);
  const syncVis=()=>{ const on=!!(c.penMasks&&c.penMasks.length);
    wrap.querySelector('#penEdit').style.display=on?'inline-flex':'none';
    wrap.querySelector('#penExpRow').style.display=on?'flex':'none';
    wrap.querySelector('#penHint').style.display=on?'block':'none'; };
  const commit=()=>{ rasterizePenMasks(c); render(); markDirty(); };
  const rebuildList=()=>{ const L=wrap.querySelector('#penList'); L.innerHTML='';
    (c.penMasks||[]).forEach((mk,mi)=>{ const row=document.createElement('div'); row.style.cssText='display:flex;align-items:center;gap:5px;font-size:11px;padding:2px 3px;border-radius:2px;background:'+(mi===c._penSel?'rgba(79,195,232,0.14)':'transparent')+';';
      row.innerHTML=`<button class="penSel" title="${T('Edit this mask','Editar esta máscara')}" style="width:15px;height:15px;border:none;background:none;color:${mi===c._penSel?'#4FC3E8':'var(--ink-3)'};cursor:pointer;font-size:10px;">◆</button>
        <span style="flex:0 0 auto;color:var(--ink-2);">${T('Mask','Máscara')} ${mi+1}</span>
        <label style="display:flex;align-items:center;gap:3px;color:var(--ink-3);cursor:pointer;"><input type="checkbox" class="penInv" ${mk.invert?'checked':''}> ${T('Invert','Invertir')}</label>
        <span style="color:var(--ink-3);flex-shrink:0;">${T('Feather','Suavizar')}</span><input type="range" class="penFe" min="0" max="60" value="${Math.round(mk.feather||0)}" style="flex:1;min-width:24px;">
        <button class="penDel" title="${T('Delete mask','Eliminar máscara')}" style="width:15px;height:15px;border:none;background:none;color:var(--ink-3);cursor:pointer;">✕</button>`;
      L.appendChild(row);
      row.querySelector('.penSel').onclick=()=>{ c._penSel=mi; rebuildList(); render(); }; // render(): el polígono activo se resalta en el visor
      row.querySelector('.penInv').onchange=e=>{ pushUndo(); mk.invert=e.target.checked; commit(); };
      const fe=row.querySelector('.penFe'); fe.oninput=e=>{ mk.feather=+e.target.value; rasterizePenMasks(c); render(); }; fe.onpointerdown=()=>pushUndo(); fe.onchange=()=>markDirty();
      row.querySelector('.penDel').onclick=()=>{ pushUndo(); c.penMasks.splice(mi,1); if(c._penSel>=c.penMasks.length)c._penSel=c.penMasks.length-1;
        if(!c.penMasks.length){ _maskEdit=null; _maskDrag=null; setVpCursor(); } // sin máscaras no hay nada que editar en el lienzo (sin renderInspector: estamos DENTRO del panel que reconstruiría)
        if(!penMaskActive(c)&&c.props.mask==='pen')c.props.mask='none'; rebuildList(); syncVis(); commit(); }; }); };
  wrap.querySelector('#penAdd').onclick=()=>{ pushUndo(); c.penMasks=c.penMasks||[]; c.penMasks.push({pts:[[0.35,0.35],[0.65,0.35],[0.65,0.65],[0.35,0.65]],feather:0,invert:false,on:true}); c._penSel=c.penMasks.length-1;
    rasterizePenMasks(c); markDirty(); startMaskEdit(c,c._penSel); }; // crear una máscara entra directo al lienzo: es donde se dibuja
  wrap.querySelector('#penEdit').onclick=()=>{ if(maskEditClip()===c)endMaskEdit(); else startMaskEdit(c,c._penSel); };
  const expR=wrap.querySelector('#penExp'); if(expR){ expR.onpointerdown=()=>pushUndo(); expR.oninput=()=>{ c.penExpand=Math.max(0.2,(+expR.value)/100); wrap.querySelector('#penExpV').textContent=(+expR.value)+'%'; rasterizePenMasks(c); render(); }; expR.onchange=()=>markDirty(); }
  rebuildList();
}
