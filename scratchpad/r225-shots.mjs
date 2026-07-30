import { evalInApp } from './cdp.mjs';
import { capture } from './cap.mjs';
import fs from 'fs';
fs.mkdirSync(new URL('./r225/', import.meta.url), { recursive: true });
const run = e => evalInApp('(function(){' + e + '})()');
const shot = async n => { await capture('../r225/' + n); console.log('shot', n); };

// ---- escenario limpio: dos formas de color + capa de ajuste ----
await run(`
  state.media=(state.media||[]).filter(m=>m.kind==='nest');
  state.clips=[]; state.lanes=[{id:uid(),name:'Audio 1',tag:'A1',kind:'audio'},{id:uid(),name:'Video 1',tag:'V1',kind:'video'},{id:uid(),name:'Video 2',tag:'V2',kind:'video'}];
  const mk=f=>{const m={id:uid(),kind:'shape',name:'S',shape:'rect',fill:f,stroke:'#000',strokeW:0,sw:512,sh:512,dur:6,fps:0,color:clipColorFor('shape')};renderShapeMedia(m);state.media.push(m);return m;};
  const s1=mk('#ff2020'), s2=mk('#2040ff');
  const P=az=>({az,el:25,size:60,rot:0,spin:0,opacity:100,blur:0,feather:0,crop:0,exposure:0,contrast:0,saturation:0,temperature:0,tint:0,glow:0,chroma:0,x:0,y:0,scale:100,volume:100,fulldome:false,fisheye:false,equirect:false,mask:'none',blend:'normal'});
  state.clips.push({id:uid(),mediaId:s1.id,lane:1,start:0,dur:6,inP:0,name:'Rojo',props:P(-70),kf:{},fx:[]});
  state.clips.push({id:uid(),mediaId:s2.id,lane:2,start:0,dur:6,inP:0,name:'Azul',props:P(70),kf:{},fx:[]});
  state.playhead=1; state.selId=null; state.selIds=[]; renderMedia(); renderTimeline(); renderInspector(); render(); return 1;`);
await shot('01-antes-del-ajuste');

await run(`addAdjustmentLayer(); const a=selClip(); a.start=0; a.dur=6; state.inspTab='clip'; renderTimeline(); renderInspector(); render(); return 1;`);
await shot('02-inspector-capa-de-ajuste');

await run(`const a=selClip(); a.fx=[newFx('hue')]; const f=a.fx[0]; f.int=100; f.band='none'; a.props['fx:'+f.id+':shift']=180;
  renderTimeline(); renderInspector(); render(); return 1;`);
await shot('03-ajuste-con-efecto-de-color-sobre-los-dos');

// ---- nest: inspector sin conmutador ----
await run(`const a=selClip(); state.clips=state.clips.filter(c=>!c.adjust); state.lanes=state.lanes.slice(0,3);
  state.selIds=state.clips.map(c=>c.id); state.selId=state.clips[0].id; nestSelection(); state.inspTab='clip'; renderInspector(); return 1;`);
await shot('04-inspector-de-nest-sin-conmutador');

// ---- audio: escala de onda a 1x y a 4x ----
await run(`
  const ctx=ACTX(); const b=ctx.createBuffer(1,Math.round(ctx.sampleRate*6),ctx.sampleRate); const d=b.getChannelData(0);
  for(let i=0;i<d.length;i++){ const t=i/ctx.sampleRate; d[i]=0.32*Math.sin(2*Math.PI*110*t)*(0.4+0.6*Math.abs(Math.sin(t*2.2))); }
  const N=600,pk=new Float32Array(N); for(let i=0;i<N;i++){ let mx=0; const s=Math.floor(i/N*d.length),e=Math.floor((i+1)/N*d.length); for(let j=s;j<e;j++){const v=Math.abs(d[j]); if(v>mx)mx=v;} pk[i]=mx; }
  const am={id:uid(),kind:'audio',name:'Umbral.wav',dur:6,buffer:b,peaks:pk,rms:pk,color:clipColorFor('audio')}; state.media.push(am);
  const la=state.lanes.findIndex(l=>l.kind==='audio');
  const ca={id:uid(),mediaId:am.id,lane:la,start:0,dur:6,inP:0,name:am.name,color:am.color,fadeIn:0,fadeOut:0,props:{volume:100},kf:{},fx:[]};
  state.clips.push(ca); state.selId=ca.id; state.selIds=[ca.id]; state.tl.waveScale=1; state.tl.pxPerSec=110;
  renderMedia(); renderTimeline(); renderInspector(); scheduleWaves(); return 1;`);
await new Promise(r=>setTimeout(r,300));
await shot('05-audio-escala-1x');
await run(`state.tl.waveScale=4; renderInspector(); redrawAudioWaves(); return 1;`);
await new Promise(r=>setTimeout(r,300));
await shot('06-audio-escala-4x');
await run(`state.tl.waveScale=1; renderInspector(); redrawAudioWaves(); return 1;`);

// ---- texto: inspector sin campos de píxeles + nitidez a escala alta ----
await run(`createTextClip({text:'TITULO'}); const c=selClip(); c.props.size=95; state.inspTab='clip'; renderInspector(); render(); return 1;`);
await shot('07-inspector-de-texto');
await run(`state.view.mode='2d'; render(); return 1;`);
await shot('08-texto-a-escala-95');

// ---- barra del visor: rayo + Clip / rayo + Comp ----
await shot('09-barra-proxy-clip-comp');
console.log('listo');
