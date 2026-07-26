// R166 · Los tres últimos checkboxes nativos pasan al interruptor .iosw del diseño.
import fs from 'fs';
let a = fs.readFileSync('app.js', 'utf8');
const log = [];
const r = (x, y, why) => { if (!a.includes(x)) { log.push('NO  ' + why); return; } a = a.replace(x, y); log.push('OK  ' + why); };

r(`        <label style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--ink-2);cursor:pointer;"><input type="checkbox" id="txtStroke" \${m.tstroke?'checked':''}> \${T('Outline','Contorno')}</label>`,
  `        \${ioswHtml('txtStroke',!!m.tstroke,T('Outline','Contorno'))}`,
  'texto: Contorno');
r(`trow.querySelector('#txtStroke').onchange=reTxt;`, `ioswBind(trow,'txtStroke').onchange=reTxt;`, 'texto: cableado');

r(`        <label style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--ink-3);cursor:pointer;" title="\${T('Animate live in the editor while paused','Animar en vivo en el editor en pausa')}"><input type="checkbox" id="motionPrev" \${state.motionPreview!==false?'checked':''}> \${T('Live','En vivo')}</label></div>`,
  `        \${ioswHtml('motionPrev',state.motionPreview!==false,T('Live','En vivo'),T('Animate live in the editor while paused','Animar en vivo en el editor en pausa'))}</div>`,
  'motion: En vivo');
r(`    $('#motionPrev').onchange=`, `    ioswBind(document,'motionPrev').onchange=`, 'motion: cableado');

fs.writeFileSync('app.js', a);
console.log(log.join('\n'));
