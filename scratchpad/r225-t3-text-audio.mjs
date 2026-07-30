// [R225·4/·5/·6] Motion/Effects sin párrafos · inspector de audio (sin fades + escala de onda) · texto sin campos de px
import { evalInApp } from './cdp.mjs';
const expr = `(async function(){
  const R={}; const txtOf=s=>(s||'').replace(/\\s+/g,' ').trim();
  // ================= TEXTO =================
  createTextClip({text:'HOLA MUNDO'});
  const tc=selClip(), tm=mediaById(tc.mediaId);
  R.text={ base:tm.tfontSize, lineH:tm.tlineH, w:tm.w, h:tm.h, aspecto:+(tm.w/tm.h).toFixed(4) };
  renderInspector();
  R.textCampos={ txtSize:!!document.querySelector('#txtSize'), txtLineH:!!document.querySelector('#txtLineH'),
                 txtColor:!!document.querySelector('#txtColor'), txtStrokeCol:!!document.querySelector('#txtStrokeCol'), txtStroke:!!document.querySelector('#txtStroke') };
  // el interruptor Outline SÍ funciona (evidencia): se compara el rásterizado con y sin contorno
  const hash=m=>{ const c=m.el; const x=c.getContext('2d'); const d=x.getImageData(0,0,Math.min(c.width,300),Math.min(c.height,120)).data; let h=5381; for(let i=0;i<d.length;i+=17)h=((h<<5)+h+d[i])>>>0; return h; };
  const h0=hash(tm);
  document.querySelector('#txtStroke').click();
  R.outline={ tstroke:tm.tstroke, hashCambia:(hash(tm)!==h0) };
  // y el color del contorno (mando que ANTES no existía) también cambia el rásterizado
  const h1=hash(tm); const cin=document.querySelector('#txtStrokeCol'); cin.value='#ff0000'; cin.dispatchEvent(new Event('input'));
  R.outlineColor={ valor:mediaById(selClip().mediaId).tstrokeColor, hashCambia:(hash(mediaById(selClip().mediaId))!==h1) };
  // proporción invariante al cuerpo: cambiar tfontSize a mano NO cambia el aspecto
  const a0=tm.w/tm.h; tm.tfontSize=90; renderTextMedia(tm); const a1=tm.w/tm.h;
  R.aspectoInvariante={ a300:+a0.toFixed(3), a90:+a1.toFixed(3), difRel:+(Math.abs(a1-a0)/a0).toFixed(4) };
  tm.tfontSize=TXT_BASE_PX; renderTextMedia(tm);
  // párrafo largo: el ajuste evita que el lienzo tope con 4096 y recorte
  const largo={...tm, id:uid(), text:'Una linea muy larga de credito que antes habria recortado el lienzo al topar con el limite de cuatro mil noventa y seis pixeles de ancho'};
  renderTextMedia(largo); R.parrafoLargo={ w:largo.w, h:largo.h, dentroDelLimite:(largo.w<=4096&&largo.h<=4096) };
  // ================= MOTION / EFFECTS: sin párrafos =================
  R.motionParrafos=[...document.querySelectorAll('#motionRows *')].filter(e=>e.children.length===0&&txtOf(e.textContent).length>55).map(e=>txtOf(e.textContent).slice(0,90));
  R.motionVacio=txtOf((document.querySelector('#motionFxBody')||{}).textContent||'').slice(0,40);
  // ================= AUDIO =================
  const am=state.media.find(m=>m.kind==='audio');
  const la=state.lanes.findIndex(l=>l.kind==='audio');
  const ca={id:uid(),mediaId:am.id,lane:la,start:0,dur:am.dur,inP:0,name:am.name,color:am.color,fadeIn:0.7,fadeOut:1.1,props:{volume:100},kf:{},fx:[]};
  state.clips.push(ca); state.selId=ca.id; state.selIds=[ca.id]; renderTimeline(); renderInspector();
  R.audio={ fadeIn:!!document.querySelector('#auFi'), fadeOut:!!document.querySelector('#auFo'),
            escala:!!document.querySelector('#auWScale'), volumen:!!document.querySelector('#auVol'), unLado:!!document.querySelector('#auHalf'),
            filas:[...document.querySelectorAll('#insAudio .prow')].map(r=>txtOf(r.textContent).slice(0,34)),
            fadesEnDatos:{fadeIn:ca.fadeIn,fadeOut:ca.fadeOut} };
  R.audioParrafos=[...document.querySelectorAll('#insAudio *')].filter(e=>e.children.length===0&&txtOf(e.textContent).length>60).map(e=>txtOf(e.textContent).slice(0,90));
  // la escala de onda cambia la altura dibujada: se mide el canvas del clip a 1x y a 4x
  const medir=()=>{ redrawAudioWaves(); const cd=[...document.querySelectorAll('.clip.audioclip')].find(d=>+d.dataset.clip===ca.id); const cv=cd&&cd.querySelector('canvas.awave'); if(!cv)return null;
    const x=cv.getContext('2d'); const d=x.getImageData(0,0,cv.width,cv.height).data; let alto=0;
    for(let px=0;px<cv.width;px+=7){ let top=cv.height; for(let y=0;y<cv.height;y++){ const i=(y*cv.width+px)*4; if(d[i+3]>40){ top=y; break; } } alto=Math.max(alto,cv.height-top); }
    return {alto, h:cv.height}; };
  state.tl.waveScale=1; const m1=medir();
  state.tl.waveScale=4; const m4=medir();
  R.waveScale={ x1:m1, x4:m4, crece:!!(m1&&m4&&m4.alto>m1.alto+2), waveScaleFn:[0.25,1,4,99].map(v=>{state.tl.waveScale=v; return waveScale();}) };
  state.tl.waveScale=1; redrawAudioWaves(); renderInspector();
  return {R, errs:window.__errs};
})()`;
evalInApp(expr).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error('ERR',e.message);process.exit(1);});
