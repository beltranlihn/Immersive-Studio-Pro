/* [R278b] Par VIEJO de copiar/pegar atributos (R80-3), retirado tras la auditoria. Convivia con el de R278 en el
   MISMO menu contextual y con el MISMO rotulo, pero fusionaba props en vez de reemplazar y no recortaba la
   automatizacion a la duracion del destino. Lo unico suyo que valia -re-acunar los ids de fx y remapear las
   claves fx:<id>:<param>- se ha llevado a pasteAttrs. */
/* ---- R80-3: copy/paste attributes (props/fx/kf/anim; fx ids re-minted + kf keys remapped) ---- */
let _attrClip=null;
function copyAttributes(c){ _attrClip=JSON.parse(JSON.stringify({props:c.props||{},fx:c.fx||[],kf:c.kf||{},anim:c.anim||null,speed:c.speed||null})); flashStatus(T('Attributes copied','Atributos copiados')); }
function pasteAttributes(){ if(!_attrClip){ flashStatus(T('Copy attributes from a clip first','Copia primero los atributos de un clip')); return; }
  const sel=state.selIds.map(clipById).filter(Boolean); if(!sel.length){ flashStatus(T('Select target clips','Selecciona clips de destino')); return; }
  pushUndo();
  for(const c of sel){ const src=JSON.parse(JSON.stringify(_attrClip)); const idMap={};
    for(const f of src.fx){ const nid=uid(); idMap[f.id]=nid; f.id=nid; }
    const remap=k=>{ const mm=/^fx:(\d+):(.*)$/.exec(k); return (mm&&idMap[+mm[1]]!=null)?('fx:'+idMap[+mm[1]]+':'+mm[2]):k; };
    const nkf={}; for(const k of Object.keys(src.kf))nkf[remap(k)]=src.kf[k];
    c.props=Object.assign({},c.props,src.props); c.fx=src.fx; c.kf=nkf;
    if(src.anim)c.anim=src.anim; if(src.speed)c.speed=src.speed; else delete c.speed; }
  disposeAllVinst(); renderTimeline(); renderInspector(); render(); markDirty(); flashStatus(T('Attributes pasted to ','Atributos pegados en ')+sel.length+' clip(s)'); }
