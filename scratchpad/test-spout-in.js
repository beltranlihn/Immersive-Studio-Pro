// Prueba del lado receptor contra el emisor REAL que Beltrán tiene encendido (TDSyphonSpoutOut).
// Se ejecuta con electron (el .node está compilado contra sus cabeceras), no con node a secas.
const path = require('path');
// la ruta del require es relativa AL ARCHIVO, no al directorio de trabajo
const sp = require(path.join(__dirname, '..', 'native', 'spout-send', 'build', 'Release', 'dsp_spout.node'));
// sin ventana no hay quien cierre un diálogo de error: que un fallo termine el proceso, no lo cuelgue
process.on('uncaughtException', e => { console.log('EXCEPCIÓN:', e.message); process.exit(1); });
const esperar = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  console.log('emisores en la máquina:', JSON.stringify(sp.inList()));
  const abierto = sp.inOpen('');            // vacío = el emisor activo del sistema
  console.log('receptor abierto:', abierto);

  let conseguidos = 0, ultimo = null;
  for (let i = 0; i < 40; i++) {
    const f = sp.inFrame(true);             // true = invertido, que es lo que quiere WebGL
    if (f && f.nuevo && f.data) {
      conseguidos++;
      if (!ultimo) {
        // ¿son píxeles de verdad o un búfer en negro?
        const d = f.data; let noNegros = 0, suma = 0;
        for (let k = 0; k < d.length; k += 4 * 97) { const v = d[k] + d[k+1] + d[k+2]; suma += v; if (v > 12) noNegros++; }
        const muestras = Math.ceil(d.length / (4 * 97));
        ultimo = { nombre: f.nombre, w: f.w, h: f.h, bytes: d.length,
                   esperados: f.w * f.h * 4, coincide: d.length === f.w * f.h * 4,
                   proporcionNoNegra: +(noNegros / muestras).toFixed(3),
                   brilloMedio: +(suma / muestras / 3).toFixed(1) };
      }
    }
    await esperar(50);
  }
  console.log('fotogramas nuevos en 2s:', conseguidos, '/ 40 intentos');
  console.log('primer fotograma:', JSON.stringify(ultimo, null, 2));

  // ¿cambia la imagen entre dos capturas separadas? (un emisor vivo no manda siempre lo mismo)
  const a = sp.inFrame(true); await esperar(400); const b = sp.inFrame(true);
  if (a && b && a.data && b.data && a.data.length === b.data.length) {
    let dif = 0; for (let k = 0; k < a.data.length; k += 4 * 97) if (Math.abs(a.data[k] - b.data[k]) > 6) dif++;
    console.log('píxeles que cambian entre dos capturas:', dif, '(>0 = la fuente está viva)');
  }
  sp.inClose();
  console.log('receptor cerrado');
  process.exit(0);
})();
