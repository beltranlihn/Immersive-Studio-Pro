// [R226] escenarios base + colector de errores
import { run } from './cdp2.mjs';
export async function errsHook(){
  await run(`if(!window.__errs){ window.__errs=[]; window.addEventListener('error',e=>window.__errs.push(String(e.message||e))); window.addEventListener('unhandledrejection',e=>window.__errs.push('rej:'+String(e.reason))); } return 1;`);
}
export async function killTour(){ await run(`_tourSkipNext=true; const t=document.getElementById('tourOv'); if(t)t.remove(); document.querySelectorAll('.overlay').forEach(o=>o.remove()); render(); return 1;`); }
async function clean(){ await run(`state.dirty=false; _tourSkipNext=true; const t=document.getElementById('tourOv'); if(t)t.remove(); document.querySelectorAll('.overlay').forEach(o=>o.remove()); hideLanding(); return 1;`); }
const CLIP = `
  state.clips=[];
  const mkm=(f)=>{const m={id:uid(),kind:'shape',name:'S',shape:'rect',fill:f,stroke:'#000',strokeW:0,sw:512,sh:512,dur:6,fps:0,color:clipColorFor('shape')};renderShapeMedia(m);state.media.push(m);return m;};
  const mm=mkm(COL);
  const P={az:0,el:35,size:70,rot:0,spin:0,opacity:100,blur:0,feather:0,crop:0,exposure:0,contrast:0,saturation:0,temperature:0,tint:0,glow:0,chroma:0,x:0,y:0,scale:100,volume:100,fulldome:false,fisheye:false,equirect:false,mask:'none',blend:'normal'};
  const vl=state.lanes.findIndex(l=>l.kind==='video');
  const c={id:uid(),mediaId:mm.id,lane:vl,start:0,dur:6,inP:0,name:'C',props:P,kf:{},fx:[]};
  state.clips.push(c); state.selId=c.id; state.selIds=[c.id]; state.playhead=1; state.inspTab='clip';
  _tourSkipNext=true; const t2=document.getElementById('tourOv'); if(t2)t2.remove();
  renderMedia(); renderTimeline(); renderInspector(); render();
  return {clip:c.id, mode:state.view.mode, seqMode:state.seqMode};`;
export async function domeScene(){ await clean();
  await run(`return newProject('dome',2048,2048,30,180).then(()=>1);`);
  const r=await run(`const COL='#ff4020';`+CLIP); await killTour(); return r; }
export async function flatScene(){ await clean();
  await run(`return newProject('flat',1920,1080,30).then(()=>1);`);
  const r=await run(`const COL='#40a0ff';`+CLIP); await killTour(); return r; }
export async function roomScene(){ await clean();
  await run(`return newRoomProject({walls:[{role:'Front',order:1,wcm:600,hcm:300,pxW:1920,pxH:1080},{role:'Left',order:2,wcm:400,hcm:300,pxW:1280,pxH:1080},{role:'Right',order:3,wcm:400,hcm:300,pxW:1280,pxH:1080}],fps:30,floor:null}).then(()=>1);`);
  const r=await run(`const COL='#40ff80';`+CLIP); await killTour(); return r; }
