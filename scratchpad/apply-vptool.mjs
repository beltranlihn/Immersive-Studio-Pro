// R157 · Barra del visor: orden del prototipo + hueco fijo para los controles de cámara.
import fs from 'fs';
const P = 'index.html';
let s = fs.readFileSync(P, 'utf8');
const log = [];
const rep = (a, b, why) => { if (!s.includes(a)) { log.push('✗ ' + why); return; } s = s.replace(a, b); log.push('✓ ' + why); };

// 1 · Proxy pasa al lado DERECHO (el prototipo lo pone después del espaciador, junto al zoom y Output)
rep(`        <div class="vseg" id="proxyToggle" title="Viewport uses proxies (faster). Turn off to preview the original clips."><button data-p="proxy" class="on"><i class="ic" data-ico="bolt"></i> Proxy</button></div>\n`,
    '', 'quitar Proxy del clúster izquierdo');

// 2 · los controles de cámara viven en un HUECO DE ANCHO FIJO: al alternar Orbit↔Viewer cambia lo que hay dentro,
//     pero el hueco mide lo mismo, así que nada de lo que persiste (zoom, Output, Proxy) se mueve de sitio.
rep(`        <div style="flex:1;"></div>
        <div class="vslab" id="azelReadout">`,
    `        <div style="flex:1;"></div>
        <!-- [R157] Hueco de cámara de ancho FIJO. Pedido de Beltrán: al pasar de Orbit a Viewer los botones que
             persisten no se mueven; sólo cambia lo que hay DENTRO de este hueco, y lo nuevo entra por la derecha.
             El ancho es el del caso más ancho (FOV + DOLLY), así que nunca encoge ni empuja. -->
        <div class="camslot" id="camSlot">
        <div class="vslab" id="azelReadout">`, 'abrir el hueco de cámara');
rep(`        <div class="vslab" id="distCtl" style="display:none;"><span class="k">DIST</span><input type="range" min="1.2" max="12" step="0.1" value="3" id="distRange" class="vfader"><span class="v" id="distLbl" style="width:26px;text-align:right;">3.0</span></div>
        <div class="vdiv"></div>`,
    `        <div class="vslab" id="distCtl" style="display:none;"><span class="k">DIST</span><input type="range" min="1.2" max="12" step="0.1" value="3" id="distRange" class="vfader"><span class="v" id="distLbl" style="width:26px;text-align:right;">3.0</span></div>
        </div>
        <div class="vseg" id="proxyToggle" title="Viewport uses proxies (faster). Turn off to preview the original clips."><button data-p="proxy" class="on"><i class="ic" data-ico="bolt"></i> Proxy</button></div>
        <div class="vdiv" id="zoomSep"></div>`, 'cerrar el hueco + Proxy a la derecha + separador con id');

// 3 · el botón "More" del prototipo dice "…", no "···"
rep('<button class="vmore" id="vpMoreBtn" title="More viewer controls" style="display:none;">···</button>',
    '<button class="vmore" id="vpMoreBtn" title="More viewport controls" style="display:none;">…</button>', 'More: "…" como el prototipo');

// 4 · CSS del hueco
rep('  .vmore{width:28px;',
    `  /* [R157] hueco de cámara: ancho fijo para que Orbit↔Viewer no mueva nada de lo que persiste a su derecha */
  .camslot{display:flex;align-items:center;gap:var(--sp-8);flex-shrink:0;justify-content:flex-end;min-width:236px;}
  .vmore{width:28px;`, 'CSS del hueco de cámara');
fs.writeFileSync(P, s, 'utf8');
console.log(log.join('\\n'));
