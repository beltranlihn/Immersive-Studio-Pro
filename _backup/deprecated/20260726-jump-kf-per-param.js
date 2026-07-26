/* ARCHIVADO — 2026-07-26 · R161
 * Origen:   app.js (junto a kfAt / jumpAnyKf, ~L3650)
 * Motivo:   R159 quitó los botones «fotograma anterior / siguiente» de cada fila del inspector —eran los 40px
 *           que le faltaban al fader para medir como el prototipo—, y con ellos desapareció el único llamador
 *           de esta función. El salto por parámetro se sustituye por `jumpAnyKf(dir)` (Alt+, / Alt+.), que
 *           recorre los keyframes de TODOS los parámetros automatizados del clip: es lo que el usuario piensa
 *           («el próximo keyframe»), no «el próximo de Opacidad».
 * Restaurar: pegar la función de vuelta en app.js y volver a añadir los botones `[data-k=prev]` /
 *           `[data-k=next]` en el markup de `buildRows`, con
 *           `row.querySelector('[data-k=prev]').onclick=()=>jumpKf(p,-1);` y su gemelo para next.
 *           Ojo: el fader vuelve a encogerse de ~129px a ~53px.
 */

function jumpKf(p,dir){ const c=selClip(); if(!hasKf(c,p))return; const lt=state.playhead-c.start; const ks=c.kf[p];
  let target=null; if(dir>0){for(const k of ks)if(k.t>lt+1e-3){target=k.t;break;}} else {for(let i=ks.length-1;i>=0;i--)if(ks[i].t<lt-1e-3){target=ks[i].t;break;}}
  if(target!=null){state.playhead=c.start+target;scrubRender();} }
