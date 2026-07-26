// R171 · Los tres ajustes de Beltrán sobre la captura del timeline.
import fs from 'fs';
const log = [];
let a = fs.readFileSync('app.js', 'utf8');
const r = (x, y, why) => { if (!a.includes(x)) { log.push('NO  ' + why); return; } a = a.replace(x, y); log.push('OK  ' + why); };

// ── 1 · las pistas de audio miden lo mismo que las de vídeo
r("const AUDIO_LANE_H=44; // altura POR DEFECTO del audio (no fija): se redimensiona igual que el vídeo",
  "const AUDIO_LANE_H=LANE_DEF_H; /* [R171] el audio mide lo MISMO que el vídeo. Era 44 contra 57 y se notaba a\n"
  + "   simple vista; con clips enlazados A/V, además, la mitad de audio quedaba visiblemente más baja que su\n"
  + "   pareja. Sigue siendo sólo el valor POR DEFECTO: Alt+rueda las escala todas juntas. */",
  '1 · audio con la misma altura que vídeo');

// ── 2 · la chapa ORIGINAL/PROXY pasa a ir junto al nombre, en gris y sin mayúsculas
r("px2='<div class=\"cpx\" data-mid=\"'+c.mediaId+'\">'+(rdy?'⚡ PROXY':(pct>0?'PROXY '+pct+'%':'ORIGINAL'))+'</div>",
  "px2='<div class=\"cpxbarwrap\">"  // el bloque flotante desaparece; queda sólo la barra de progreso
  , '2a · fuera la chapa flotante');
r("<div class=\"tt\" style=\"background:${_ct};color:${textOn(_ct)}\">${c.loop?'↻ ':''}${c.name}</div>",
  "<div class=\"tt\" style=\"background:${_ct};color:${textOn(_ct)}\">${c.loop?'↻ ':''}${c.name}${pxTag}</div>",
  '2b · la fuente va dentro del título');

// ── 3 · el panel del timeline nunca más alto que sus pistas
r("hResize('#tlResize','.timeline',170,tlMaxH,()=>{resize();renderTimeline();});",
  "hResize('#tlResize','.timeline',170,tlMaxH,()=>{resize();renderTimeline();});\n"
  + "/* [R171] `tlMaxH` sólo limitaba el ARRASTRE. La altura de partida está cableada en el CSS (402px) y no se\n"
  + "   recalcula al colapsar, quitar o escalar pistas, así que sobraba banda vacía debajo de la última. Esto la\n"
  + "   recorta al alto real de las pistas. Sólo hacia ABAJO: si el usuario la ha dejado más pequeña, se respeta. */\n"
  + "function clampTimelineH(){ const el=document.querySelector('.timeline'); if(!el)return;\n"
  + "  const max=tlMaxH(), cur=el.getBoundingClientRect().height;\n"
  + "  if(cur>max+0.5){ el.style.height=max+'px'; try{ resize(); }catch(e){} } }",
  '3 · función de recorte del panel');

fs.writeFileSync('app.js', a);
console.log(log.join('\n'));
