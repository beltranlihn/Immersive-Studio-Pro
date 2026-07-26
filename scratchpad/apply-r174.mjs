// R174 · La barra del visor, botón por botón contra el handoff.
import fs from 'fs';
const log = [];
let h = fs.readFileSync('index.html', 'utf8'), a = fs.readFileSync('app.js', 'utf8');
const rh = (x, y, w) => { if (!h.includes(x)) { log.push('NO  ' + w); return; } h = h.replace(x, y); log.push('OK  ' + w); };
const ra = (x, y, w) => { if (!a.includes(x)) { log.push('NO  ' + w); return; } a = a.replace(x, y); log.push('OK  ' + w); };

// ── 1 · fuera Safe: el handoff tiene CUATRO superposiciones (Grid · Outline · Horizon/Center/Seam · Alpha)
rh(`          <button data-d="safe" title="Safe-zone overlay"><i class="ic" data-ico="safe"></i> Safe</button>\n`, '',
  '1 · fuera el botón Safe');

// ── 2 · fuera DIST (Orbit) y DOLLY (Viewer): en Viewer sólo queda FOV
rh(`        <div class="vslab" id="dollyCtl"`, `        <div class="vslab" id="dollyCtl" hidden data-retirado="R174"`, '2a · DOLLY retirado');
rh(`        <div class="vslab" id="distCtl"`, `        <div class="vslab" id="distCtl" hidden data-retirado="R174"`, '2b · DIST retirado');

// ── 3 · las superposiciones nacen SOLO ICONO, como el prototipo (su `vpLbl` arranca en 'icons')
rh(`        <!-- [REDISEÑO Rev1] overlays icon-only (tooltip) -->\n        <div class="vseg" id="dispSeg">`,
  `        <!-- [R174] El prototipo las dibuja SOLO ICONO por defecto: su \`vpLbl\` nace en 'icons' y el rótulo va\n`
  + `             con display:none. El texto sólo aparece en el panel "More", donde sí hace falta leerlo. -->\n`
  + `        <div class="vseg iconly" id="dispSeg">`, '3 · grupo de superposiciones sólo icono');

fs.writeFileSync('index.html', h);

// ── 4 · el grupo de superposiciones NO desaparece en 3D (en el prototipo sólo depende del ANCHO)
ra(`  const bh=document.querySelector('#dispSeg button[data-d="hfade"]');`,
  `  /* [R174] El grupo de superposiciones ya NO se esconde en 3D: en el prototipo su visibilidad depende sólo del\n`
  + `     ancho (\`dispInline: centerW>=620\`), y en Orbit y en Viewer sigue ahí. */\n`
  + `  const bh=document.querySelector('#dispSeg button[data-d="hfade"]');`, '4 · nota del grupo en 3D');

// el manejador de clic ya no tiene rama 'safe'
ra(`if(d==='safe')state.view.showSafe=!state.view.showSafe; `, '', '4b · fuera la rama safe del manejador');

fs.writeFileSync('app.js', a);
console.log(log.join('\n'));
