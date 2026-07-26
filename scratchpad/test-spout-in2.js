const path = require('path');
const sp = require(path.join(__dirname, '..', 'native', 'spout-send', 'build', 'Release', 'dsp_spout.node'));
process.on('uncaughtException', e => { console.log('EXCEPCIÓN:', e.message); process.exit(1); });
const esperar = ms => new Promise(r => setTimeout(r, ms));

function analizar(d, w, h) {
  let maxR=0,maxG=0,maxB=0,maxA=0, sum=0, n=0, opacos=0;
  for (let k = 0; k < d.length; k += 4 * 13) {
    const R=d[k],G=d[k+1],B=d[k+2],A=d[k+3];
    if(R>maxR)maxR=R; if(G>maxG)maxG=G; if(B>maxB)maxB=B; if(A>maxA)maxA=A;
    if(A>250)opacos++; sum += (R+G+B)/3; n++;
  }
  return { maxR, maxG, maxB, maxAlfa: maxA, brilloMedio:+(sum/n).toFixed(1), proporcionOpaca:+(opacos/n).toFixed(3) };
}

(async () => {
  for (const nombre of sp.inList()) {
    sp.inOpen(nombre);
    let mejor = null, intentos = 0;
    for (let i = 0; i < 30; i++) {
      const f = sp.inFrame(true); intentos++;
      if (f && f.nuevo && f.data) {
        const a = analizar(f.data, f.w, f.h);
        if (!mejor || a.brilloMedio > mejor.brilloMedio) mejor = { ...a, w: f.w, h: f.h, conectadoA: f.nombre };
      }
      await esperar(60);
    }
    console.log('· ' + nombre + ' →', JSON.stringify(mejor));
    sp.inClose();
    await esperar(200);
  }
  process.exit(0);
})();
