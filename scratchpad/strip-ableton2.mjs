import fs from 'fs';
const log = [];
function edit(path, ops) {
  const raw = fs.readFileSync(path, 'utf8');
  const nl = raw.includes('\r\n') ? '\r\n' : '\n';
  let L = raw.split(/\r?\n/);
  for (const [kind, needle, repl, why] of ops) {
    const i = L.findIndex(l => l.includes(needle));
    if (i < 0) { log.push('✗ ' + why); continue; }
    if (kind === 'dropline') L.splice(i, 1); else L[i] = L[i].replace(needle, repl);
    log.push('✓ ' + why);
  }
  fs.writeFileSync(path, L.join(nl), 'utf8');
}
edit('app.js', [
  ['repl', "selA:null, selB:null, audioCollapsed:false, simpleClips:true },", "selA:null, selB:null, audioCollapsed:false },", 'estado: fuera tl.simpleClips'],
  ['repl', "[c5,T('Toggle simple clips (Premiere-style)','Activar/desactivar clips simples (estilo Premiere)'),'',()=>$('#simpleClipBtn').click()],", "", 'paleta: fuera la entrada del conmutador'],
  ['repl', "${sw('simpleclips',state.tl.simpleClips,T('Simple clips','Clips simples'))}", "", 'Preferences: fuera el interruptor'],
  ['repl', "loadWorkspace(); applyLang(); syncSimpleUI(); // [R94f] Simple clips is the default → light the button + set body.simpleclips on boot",
           "loadWorkspace(); applyLang(); syncSimpleUI(); // [R155] fija el agarre estilo Premiere (único modo)", 'init: comentario al día'],
]);
edit('index.html', [
  ['dropline', '<button id="simpleClipBtn"', null, 'transport: fuera el botón Simple'],
  ['repl', 'body.simpleclips .clip{cursor:grab;} body.simpleclips .clip:active{cursor:grabbing;}',
           '/* [R155] `simpleclips` ya no es un modo conmutable: se fija al arrancar y es el único agarre (Premiere). */\n  body.simpleclips .clip{cursor:grab;} body.simpleclips .clip:active{cursor:grabbing;}', 'css: nota de modo único'],
]);
console.log(log.join('\n'));
