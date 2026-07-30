// [R225·6] EVIDENCIA de que el interruptor Outline sí hace algo (y de que su color, mando nuevo, también).
import { evalInApp } from './cdp.mjs';
const expr = `(async function(){
  const R={};
  const tm=state.media.filter(m=>m.kind==='text').pop();
  R.medio={ id:tm.id, texto:tm.text, w:tm.w, h:tm.h };
  // firma sobre TODO el lienzo: nº de píxeles opacos + suma de canales (no una esquina vacía como en el intento anterior)
  const firma=m=>{ const c=m.el, x=c.getContext('2d'); const d=x.getImageData(0,0,c.width,c.height).data;
    let op=0, sr=0, sg=0, sb=0; for(let i=0;i<d.length;i+=4){ if(d[i+3]>32){ op++; sr+=d[i]; sg+=d[i+1]; sb+=d[i+2]; } }
    return {op, r:Math.round(sr/Math.max(1,op)), g:Math.round(sg/Math.max(1,op)), b:Math.round(sb/Math.max(1,op))}; };
  tm.tstroke=false; tm.tstrokeColor='#000000'; renderTextMedia(tm); const sinC=firma(tm);
  tm.tstroke=true;                              renderTextMedia(tm); const conNegro=firma(tm);
  tm.tstrokeColor='#ff0000';                    renderTextMedia(tm); const conRojo=firma(tm);
  R.firmas={sinContorno:sinC, contornoNegro:conNegro, contornoRojo:conRojo};
  R.contornoAnadePixeles = conNegro.op > sinC.op*1.05;
  R.colorDelContornoImporta = Math.abs(conRojo.r-conNegro.r) > 4;
  R.conclusion = (R.contornoAnadePixeles && R.colorDelContornoImporta)
    ? 'Outline FUNCIONA; lo que faltaba era el selector de color (tstrokeColor se guardaba sin mando) — no se archiva'
    : 'revisar';
  tm.tstroke=false; tm.tstrokeColor='#000000'; renderTextMedia(tm); render();
  return {R, errs:window.__errs};
})()`;
evalInApp(expr).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error('ERR',e.message);process.exit(1);});
