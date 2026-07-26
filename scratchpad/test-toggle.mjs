// El interruptor de cachés de composición: ¿existe, alterna, y afecta de verdad al motor?
import { evalInApp } from './cdp.mjs';
const P = { port: 9222 };
console.log(await evalInApp(`(async()=>{
  const ov=document.getElementById('landingOv'); if(ov)ov.remove();
  const t=document.getElementById('tourOv'); if(t)t.remove();
  await new Promise(r=>setTimeout(r,300));
  const seg=document.getElementById('nestCacheToggle'), b=seg&&seg.querySelector('button');
  if(!b) return JSON.stringify({ROTO:'no existe el interruptor'});
  const vis=(()=>{ const r=seg.getBoundingClientRect(); return {ancho:Math.round(r.width),alto:Math.round(r.height),visible:r.width>0&&r.height>0}; })();
  const px=(()=>{ const r=document.getElementById('proxyToggle').getBoundingClientRect(); const n=seg.getBoundingClientRect(); return {aLaDerechaDelProxy:n.left>=r.right-1, mismaFila:Math.abs(n.top-r.top)<3}; })();
  const est=[];
  est.push({paso:'inicio', on:b.classList.contains('on'), estado:state.view.useNestCache});
  b.click(); await new Promise(r=>setTimeout(r,250));
  est.push({paso:'1er clic', on:b.classList.contains('on'), estado:state.view.useNestCache});
  b.click(); await new Promise(r=>setTimeout(r,250));
  est.push({paso:'2o clic', on:b.classList.contains('on'), estado:state.view.useNestCache});
  // ¿afecta al motor? se finge un nest con caché
  const fake={kind:'nest', ncReady:true, ncUrl:'file:///x.mp4', ncStale:false};
  const conOn=ncUsable(fake);
  b.click(); await new Promise(r=>setTimeout(r,250));
  const conOff=ncUsable(fake);
  b.click(); await new Promise(r=>setTimeout(r,250));
  const vuelve=ncUsable(fake);
  return JSON.stringify({ etiqueta:b.textContent.trim(), tieneIcono:!!b.querySelector('i.ic'),
    posicion:px, geometria:vis, alternancia:est,
    motor:{conElInterruptorEncendido:conOn, apagado:conOff, alVolverAEncender:vuelve},
    veredicto:(est[0].on&&!est[1].on&&est[2].on&&conOn===true&&conOff===false&&vuelve===true&&px.aLaDerechaDelProxy&&px.mismaFila&&vis.visible)?'CORRECTO':'REVISAR' },null,1);
})()`, P));
