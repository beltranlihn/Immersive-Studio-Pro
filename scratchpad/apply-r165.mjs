// R165 · Restos del review sobre R152-R164. Sólo lo verificado.
import fs from 'fs';
const log = [];
let a = fs.readFileSync('app.js', 'utf8');
const r = (x, y, why) => { if (!a.includes(x)) { log.push('NO  ' + why); return; } a = a.replace(x, y); log.push('OK  ' + why); };

// — la regla: 22 cableado en cuatro sitios frente a RULER_H=24 (que se creó justo para no tener dos fuentes)
r(`rc.style.height='22px';`, `rc.style.height=RULER_H+'px';`, 'regla: alto del estilo');
r(`rc.height=Math.round(22*dpr);`, `rc.height=Math.round(RULER_H*dpr);`, 'regla: alto del lienzo');
r(`rx.clearRect(sl,0,viewW,22);`, `rx.clearRect(sl,0,viewW,RULER_H);`, 'regla: borrado');
// los tres pies de marca (el 22 de `if(spb*pps>=22)` NO es la altura: es un umbral de separación en píxeles)
const antesMarcas = (a.match(/rx\.moveTo\(x,22\)/g) || []).length + (a.match(/rx\.moveTo\(bx,22\)/g) || []).length;
a = a.replace(/rx\.moveTo\(x,22\)/g, 'rx.moveTo(x,RULER_H)').replace(/rx\.moveTo\(bx,22\)/g, 'rx.moveTo(bx,RULER_H)');
log.push('OK  regla: ' + antesMarcas + ' pies de marca (el umbral spb*pps>=22 se queda: son píxeles, no altura)');

// — hideLanding duplicada: la segunda copia gana por hoisting y deja muerta la primera
const hl = [...a.matchAll(/^function hideLanding\(\)/gm)].map(m => m.index);
if (hl.length === 2) {
  const ini = hl[1], fin = a.indexOf('\n', a.indexOf('}', ini));
  const cuerpo = a.slice(ini, fin);
  const primera = a.slice(hl[0], a.indexOf('\n', a.indexOf('}', hl[0])));
  if (cuerpo.replace(/\s/g, '') === primera.replace(/\s/g, '')) {
    a = a.slice(0, ini) + '/* [R165] había DOS hideLanding() idénticas; la segunda ganaba por hoisting y dejaba muerta a la primera. */\n' + a.slice(fin + 1);
    log.push('OK  hideLanding: fuera la copia (eran byte a byte iguales)');
  } else log.push('NO  hideLanding: las dos copias NO son iguales, hay que mirarlo a mano');
} else log.push('NO  hideLanding: no hay exactamente dos (' + hl.length + ')');

// — addLane('audio') y el auto-alta heredado meten el audio AL FINAL = arriba del todo (R155 lo puso abajo)
r(`if(!s.comp && !state.lanes.some(l=>l.kind==='audio')){ const n=state.lanes.filter(l=>l.kind==='audio').length+1; state.lanes.push({id:uid(),name:'Audio '+n,tag:'A'+n,kind:'audio'}); s.nestLanes=state.lanes; }`,
  `if(!s.comp && !state.lanes.some(l=>l.kind==='audio')){ const n=state.lanes.filter(l=>l.kind==='audio').length+1;
    /* [R165] unshift, no push: desde R155 el índice 0 es el FONDO de la pila, que es donde va el audio.
       Con push aparecía arriba del todo. Los clips guardan su pista por índice → hay que correrlos uno. */
    state.lanes.unshift({id:uid(),name:'Audio '+n,tag:'A'+n,kind:'audio'});
    for(const c of state.clips) if(c.lane!=null) c.lane++;
    s.nestLanes=state.lanes; }`,
  'audio heredado: nace abajo, no arriba');

fs.writeFileSync('app.js', a);

// — CSS: .tracks con min-height calc(100% - 22px) mientras la regla mide 24
let h = fs.readFileSync('index.html', 'utf8');
if (h.includes('min-height:calc(100% - 22px)')) {
  h = h.replace('min-height:calc(100% - 22px)', 'min-height:calc(100% - 24px)/* [R165] la regla mide 24 (RULER_H); con 22 sobraban 2px de desbordamiento permanente y la barra vertical calculaba mal su pulgar */');
  fs.writeFileSync('index.html', h); log.push('OK  .tracks: min-height 22 → 24');
} else log.push('NO  .tracks min-height');
console.log(log.join('\n'));
