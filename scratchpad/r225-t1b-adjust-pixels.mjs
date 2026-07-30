// [R225·1] Prueba de PÍXELES: un efecto de color en la capa de ajuste cambia LOS DOS clips de debajo como conjunto.
// Dos formas (texturas reales) en az opuestos + capa de ajuste encima. Se leen los píxeles del composite con y sin el efecto.
import { evalInApp } from './cdp.mjs';
const expr = `(async function(){
  const R={};
  state.clips=[]; state.media=(state.media||[]).filter(m=>m.kind==='nest'||m.kind==='video'||m.kind==='image'||m.kind==='audio');
  state.lanes=[{id:uid(),name:'Audio 1',tag:'A1',kind:'audio'},{id:uid(),name:'Video 1',tag:'V1',kind:'video'},{id:uid(),name:'Video 2',tag:'V2',kind:'video'}];
  const mkShape=(fill)=>{ const m={id:uid(),kind:'shape',name:'S',shape:'rect',fill,stroke:'#000',strokeW:0,sw:512,sh:512,dur:6,fps:0,color:clipColorFor('shape')}; renderShapeMedia(m); state.media.push(m); return m; };
  const s1=mkShape('#ff2020'), s2=mkShape('#2040ff');
  const P=(az,el)=>({az,el,size:60,rot:0,spin:0,opacity:100,blur:0,feather:0,crop:0,exposure:0,contrast:0,saturation:0,temperature:0,tint:0,glow:0,chroma:0,x:0,y:0,scale:100,volume:100,fulldome:false,fisheye:false,equirect:false,mask:'none',blend:'normal'});
  const c1={id:uid(),mediaId:s1.id,lane:1,start:0,dur:6,inP:0,name:'Rojo',props:P(-70,25),kf:{},fx:[]};
  const c2={id:uid(),mediaId:s2.id,lane:2,start:0,dur:6,inP:0,name:'Azul',props:P(70,25),kf:{},fx:[]};
  state.clips.push(c1,c2);
  state.playhead=1; renderTimeline(); render();
  // muestreo del composite: se busca el píxel más rojo y el más azul del máster
  const leer=()=>{ render(); const N=compSize; const px=new Uint8Array(N*N*4);
    gl.bindFramebuffer(gl.FRAMEBUFFER,compFBO); gl.readPixels(0,0,N,N,gl.RGBA,gl.UNSIGNED_BYTE,px); gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    let a=null,b=null,ma=-1,mb=-1, n=0;
    for(let y=0;y<N;y+=8)for(let x=0;x<N;x+=8){ const i=(y*N+x)*4; const r=px[i],g=px[i+1],bl=px[i+2],al=px[i+3]; if(al<128)continue; n++;
      const sr=r-bl, sb=bl-r; if(sr>ma){ma=sr;a=[r,g,bl];} if(sb>mb){mb=sb;b=[r,g,bl];} }
    return {rojo:a,azul:b,pintados:n}; };
  const antes=leer();
  // ---- capa de ajuste con un efecto de tono al 100 % ----
  addAdjustmentLayer(); const adj=selClip(); adj.start=0; adj.dur=6;
  adj.fx=[newFx('hue')]; const f=adj.fx[0]; f.int=100; f.band='none';
  for(const p of (FXBY.hue.params||[])) adj.props['fx:'+f.id+':'+p.k]=(p.k==='amt'||p.k==='shift')?180:(p.max!=null?p.max:100);
  R.paramsHue=(FXBY.hue.params||[]).map(p=>p.k+'='+adj.props['fx:'+f.id+':'+p.k]);
  freeFxResources&&0; render();
  const despues=leer();
  R.antes=antes; R.despues=despues;
  const dif=(x,y)=>x&&y?Math.round(Math.abs(x[0]-y[0])+Math.abs(x[1]-y[1])+Math.abs(x[2]-y[2])):-1;
  R.difRojo=dif(antes.rojo,despues.rojo); R.difAzul=dif(antes.azul,despues.azul);
  R.losDosCambian=(R.difRojo>30 && R.difAzul>30);
  // y sin el efecto vuelve todo a su sitio (drawAdjustment sale por hasFx)
  adj.fx=[]; const vuelta=leer(); R.vuelta=vuelta; R.reversible=(dif(antes.rojo,vuelta.rojo)<12 && dif(antes.azul,vuelta.azul)<12);
  adj.fx=[newFx('hue')]; { const g=adj.fx[0]; g.int=100; g.band='none'; for(const p of (FXBY.hue.params||[])) adj.props['fx:'+g.id+':'+p.k]=(p.k==='amt'||p.k==='shift')?180:(p.max!=null?p.max:100); }
  render(); renderTimeline(); renderInspector();
  return {R, errs:window.__errs};
})()`;
evalInApp(expr).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error('ERR',e.message);process.exit(1);});
