// Deja SÓLO el modo Premiere de agarre de clip: fuera el conmutador y la rama Ableton.
import fs from 'fs';
const log = [];
function edit(path, ops) {
  const raw = fs.readFileSync(path, 'utf8');
  const nl = raw.includes('\r\n') ? '\r\n' : '\n';
  let L = raw.split(/\r?\n/);
  for (const op of ops) {
    const [kind, needle, repl, why] = op;
    const i = L.findIndex(l => l.includes(needle));
    if (i < 0) { log.push('✗ ' + why); continue; }
    if (kind === 'dropline') L.splice(i, 1);
    else if (kind === 'drop2') L.splice(i, 2);
    else L[i] = L[i].replace(needle, repl);
    log.push('✓ ' + why);
  }
  fs.writeFileSync(path, L.join(nl), 'utf8');
}

edit('app.js', [
  // el modo Premiere pasa a ser el único: fuera la rama que hacía selección de rango sobre el cuerpo del clip
  ['dropline', "if(!isTitle&&!isL&&!isR&&!isFade&&!state.tl.simpleClips){ startTimeSelect(e); return; }", null,
   'quitar la rama Ableton del hit-test'],
  // el conmutador y su sincronización se van; queda una función que sólo fija el estado permanente
  ['drop2', 'function toggleSimpleClips(){', null, 'quitar toggleSimpleClips (2 líneas)'],
  ['repl', "function syncSimpleUI(){ const b=$('#simpleClipBtn'); if(b)b.classList.toggle('on',!!state.tl.simpleClips); document.body.classList.toggle('simpleclips',!!state.tl.simpleClips); applyToolCursor(); }",
   "/* [R155] Sólo queda el agarre estilo Premiere (arrastrar el clip desde cualquier punto). La clase se fija una\n   vez y para siempre, en vez de borrarla de todas las reglas de CSS que dependen de ella. */\nfunction syncSimpleUI(){ document.body.classList.add('simpleclips'); applyToolCursor(); }",
   'syncSimpleUI fija la clase (sin conmutador)'],
  // cursor: siempre grab con la herramienta de selección
  ['repl', "const sel=(state.tl.tool==='select'); $$('.clip').forEach(c=>c.style.cursor=sel?(state.tl.simpleClips?'grab':'default'):cur); }",
   "const sel=(state.tl.tool==='select'); $$('.clip').forEach(c=>c.style.cursor=sel?'grab':cur); } // [R155] el clip siempre se agarra",
   'cursor del clip siempre grab'],
  // abrir proyecto: ya no se restaura la preferencia
  ['repl', "state.tl.simpleClips=(obj.tl.simpleClips!=null)?!!obj.tl.simpleClips:true; syncSimpleUI(); // [R94f] projects saved before the flag existed open in Simple (the new default)",
   "syncSimpleUI(); // [R155] el modo de agarre ya no es una preferencia: un `tl.simpleClips` guardado se ignora",
   'loadProject deja de restaurar el modo'],
  ['dropline', "{ const b=$('#simpleClipBtn'); if(b)b.onclick=()=>toggleSimpleClips(); } // [R94c]", null, 'quitar el wiring del botón'],
  ['dropline', "if(k==='simpleclips'){state.tl.simpleClips=", null, 'quitar el interruptor de Preferences (handler)'],
  ['dropline', "tn('#simpleClipBtn','Simple','Simple');", null, 'quitar la traducción del botón'],
]);
console.log(log.join('\n'));
