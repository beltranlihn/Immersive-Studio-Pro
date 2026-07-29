/* ARCHIVED (deprecated / unused) — Immersive Studio Pro
 * Origen:   app.js · `autoDuo(li,cur,onPick)` (variante del chooser device+param con dos <select> nativos)
 *           CSS asociado en index.html: `.autoduo .aselect / .adev / .apar` (se deja: es inofensivo y documenta la variante)
 * Sacado:   2026-07-30
 * Motivo:   SIN LLAMADORES desde [R156], que dejó `autoDuoText` (los dos chips + menú) como única representación del
 *           chooser: la variante con selects es más alta y a 57px de pista —la altura del diseño Rev 1— empujaba la fila
 *           de identidad fuera de la cabecera. [R224] rediseña el chooser (categorías Transform/Clip/Color + un
 *           dispositivo por Motion/Effect aplicado) y esta copia habría quedado como un segundo modelo divergente de
 *           lo mismo: dos entradas fijas ("Transform" / cajón "Effects") y los efectos listados por tipo de pista.
 * Restaurar:re-insertar la función tras `fxParamLabel` y llamarla desde el bloque `state.inlineCurves` de la cabecera de
 *           pista en `renderTimeline` (hoy `ac.appendChild(autoDuoText(li,P,_pick))`). Necesitaría reescribirse contra
 *           `autoCats(li)` para no volver al modelo viejo de categorías.
 * Relacion: R156, R224, docs/adr/adr-0007-archivar-no-borrar.md
 */

function autoDuo(li,cur,onPick){ const types=laneFxTypes(li); const isT=isFxtKey(cur); const cq=isT?cur.split(':'):null;
  const isX=!isT&&XFORM_P.some(d=>d[0]===cur); // [R94b] device groups: Transform · Effects · each reactive fx loaded on the track's clips
  const wrap=document.createElement('div'); wrap.className='autoduo';
  const dev=document.createElement('select'); dev.className='aselect adev'; dev.title=T('Device / effect','Dispositivo / efecto');
  dev.innerHTML=`<option value="xf"${isX?' selected':''}>${T('Transform','Transformar')}</option>`+
    `<option value="ef"${(!isT&&!isX)?' selected':''}>${T('Effects','Efectos')}</option>`+
    types.map(ty=>`<option value="${ty}"${(isT&&ty===cq[1])?' selected':''}>${T(FXBY[ty].label[0],FXBY[ty].label[1])}</option>`).join('');
  const par=document.createElement('select'); par.className='aselect apar'; par.title=T('Parameter','Parámetro');
  const fill=sel=>{ const dv=dev.value;
    if(dv==='xf'||dv==='ef'){ const list=dv==='xf'?XFORM_P:FX; par.innerHTML=list.map(d=>`<option value="${d[0]}"${d[0]===sel?' selected':''}>${laneHasKf(li,d[0])?'◆ ':''}${propLabel(d[0])}</option>`).join(''); } // ◆ = already automated on this track
    else { const def=FXBY[dv]; const plist=[['int',T('Intensity','Intensidad')],['amt',T('Reactivity','Reactividad')]].concat((def.params||[]).map(p=>[p.k,T(p.label[0],p.label[1])]));
      par.innerHTML=plist.map(pp=>`<option value="${pp[0]}"${pp[0]===sel?' selected':''}>${laneHasKf(li,'fxt:'+dv+':'+pp[0])?'◆ ':''}${pp[1]}</option>`).join(''); } };
  fill(isT?cq[2]:cur);
  // [R94-UT2·U-15] the narrow selects truncate ("Opac∨") — mirror the selected option's full text into the tooltip
  const syncT=()=>{ const o1=dev.selectedOptions&&dev.selectedOptions[0], o2=par.selectedOptions&&par.selectedOptions[0];
    dev.title=o1?o1.textContent:T('Device / effect','Dispositivo / efecto'); par.title=o2?o2.textContent:T('Parameter','Parámetro'); };
  syncT();
  const emit=()=>{ const dv=dev.value; syncT(); onPick((dv==='xf'||dv==='ef')?par.value:('fxt:'+dv+':'+par.value)); };
  dev.onchange=()=>{ const dv=dev.value; fill(dv==='xf'?XFORM_P[0][0]:dv==='ef'?'opacity':'int'); emit(); }; par.onchange=emit;
  for(const ev of ['pointerdown','click','dblclick'])wrap.addEventListener(ev,e=>e.stopPropagation()); // the track header selects/drag-reorders/renames on these — the dropdowns must not trigger that
  wrap.appendChild(dev); wrap.appendChild(par); return wrap; }
