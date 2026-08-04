// [AUD 2026-08b] La envoltura fx/fy del domo cambio en R247c: antes `f2azel` (ACOTADA: lo que sale del disco se
// apelotona en el borde), ahora `f2azelUnclamped` (lo que sale se va bajo el horizonte y desaparece).
// ¿Cuanto difiere DE VERDAD para un clip con Slide/fx como los que puede tener un proyecto viejo?
// Barrido numerico sobre el c_fx del fixture usando LAS DOS formulas (ambas existen en el build nuevo).
import { evalInApp } from './cdp.mjs';
const r = await evalInApp(`(function(){
  const c = state.clips.find(x=>x.name==='c_fx'); if(!c) return {err:'sin c_fx (abrir aud8b-viejo.isp antes)'};
  const w=x=>{ let v=(x+1)%2; if(v<0)v+=2; return v-1; };
  const out=[]; let nDif=0, peor=0, tPeor=null;
  for(let dt=0; dt<=8; dt+=0.1){ const t=c.start+dt; _previewClock=0;
    const az=evalR(c,'az',t)||0, el=evalR(c,'el',t)||0;
    const fdx=animOffset(c,'fx',t), fdy=animOffset(c,'fy',t);
    const P=azel2f(az,el); const nx=w(P[0]+fdx), ny=w(P[1]+fdy);
    const qV=f2azel(nx,ny);           // formula VIEJA (acotada)
    const qN=f2azelUnclamped(nx,ny);  // formula NUEVA
    const dEl=Math.abs(qV.el-qN.el);
    if(dEl>0.01){ nDif++; if(dEl>peor){peor=dEl;tPeor=+t.toFixed(2);} }
    if(dEl>0.01 && out.length<10) out.push({t:+t.toFixed(2), r:+Math.hypot(nx,ny).toFixed(3), elViejo:+qV.el.toFixed(2), elNuevo:+qN.el.toFixed(2)});
  }
  return { muestras:81, fueraDelDisco:nDif, peorDif:+peor.toFixed(2), tPeor, ejemplos:out,
    anim:c.anim.map(a=>({p:a.param,amp:a.amp,speed:a.speed})) };
})()`, { port: 9222, timeout: 60000 });
console.log(JSON.stringify(r, null, 1));
