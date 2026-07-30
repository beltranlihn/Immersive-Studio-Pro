// [R225] Salud final: renderInspector sobre TODOS los tipos de clip, ida y vuelta entre ellos, y en los 3 modos.
import { evalInApp } from './cdp.mjs';
const expr = `(async function(){
  const R={errores:[]};
  const seq=mediaById(state.activeSeqId);
  const orig=console.error; const capt=[]; console.error=(...a)=>{capt.push(a.map(String).join(' ')); orig(...a);};
  const P=()=>({az:0,el:30,size:55,rot:0,spin:0,opacity:100,blur:0,feather:0,crop:0,exposure:0,contrast:0,saturation:0,temperature:0,tint:0,glow:0,chroma:0,x:0,y:0,scale:100,volume:100,fulldome:false,fisheye:false,equirect:false,mask:'none',blend:'normal'});
  const ctx=ACTX(); const buf=ctx.createBuffer(1,ctx.sampleRate*4,ctx.sampleRate); const d=buf.getChannelData(0); for(let i=0;i<d.length;i++)d[i]=0.3*Math.sin(i/40);
  const pk=new Float32Array(300).fill(0.3);
  state.media=state.media.filter(m=>m.kind==='nest');
  const sh={id:uid(),kind:'shape',name:'Forma',shape:'rect',fill:'#c8c8c8',stroke:'#000',strokeW:0,sw:512,sh:512,dur:6,fps:0,color:clipColorFor('shape')}; renderShapeMedia(sh); state.media.push(sh);
  const au={id:uid(),kind:'audio',name:'A.wav',dur:4,buffer:buf,peaks:pk,rms:pk,color:clipColorFor('audio')}; state.media.push(au);
  const vi={id:uid(),kind:'video',name:'V.mp4',w:1920,h:1080,dur:6,fps:30,path:'C:/fake/V.mp4',color:clipColorFor('video'),proxyReady:false}; state.media.push(vi);
  const im={id:uid(),kind:'image',name:'I.jpg',w:1600,h:900,dur:5,fps:0,path:'C:/fake/I.jpg',color:clipColorFor('image')}; state.media.push(im);
  for(const modo of ['dome','flat','room']){
    seq.mode=modo; state.seqMode=modo; if(modo==='room'&&!seq.room)seq.room={walls:[{role:'front',pxW:1920,pxH:1080,w:600,h:300}],stripH:1080};
    state.clips=[]; state.lanes=[{id:uid(),name:'Audio 1',tag:'A1',kind:'audio'},{id:uid(),name:'Video 1',tag:'V1',kind:'video'}];
    createTextClip({text:'T'});
    const tx=selClip();
    state.clips.push({id:uid(),mediaId:sh.id,lane:1,start:7,dur:3,inP:0,name:'Forma',props:P(),kf:{},fx:[]});
    state.clips.push({id:uid(),mediaId:vi.id,lane:1,start:11,dur:4,inP:0,name:'Video',props:P(),kf:{},fx:[]});
    state.clips.push({id:uid(),mediaId:im.id,lane:1,start:16,dur:3,inP:0,name:'Imagen',props:P(),kf:{},fx:[]});
    state.clips.push({id:uid(),mediaId:au.id,lane:0,start:0,dur:4,inP:0,name:'Audio',props:{volume:100},kf:{},fx:[]});
    addAdjustmentLayer();
    // un nest, para el caso de secuencia anidada
    state.selIds=[tx.id]; state.selId=tx.id; nestSelection();
    const orden=state.clips.map(c=>c.id);
    for(let pase=0; pase<2; pase++) for(const id of orden){ state.selId=id; state.selIds=[id]; renderInspector(); refreshInspector(); }
    renderTimeline(); render();
    R[modo]={ clips:state.clips.length, ok:true };
  }
  seq.mode='dome'; state.seqMode='dome'; state.clips=[]; state.lanes=[{id:uid(),name:'Audio 1',tag:'A1',kind:'audio'},{id:uid(),name:'Video 1',tag:'V1',kind:'video'}];
  renderTimeline(); renderInspector(); render();
  console.error=orig;
  R.consoleError=capt.filter(s=>/inspector|Uncaught|TypeError|ReferenceError/i.test(s));
  return {R, errs:window.__errs};
})()`;
evalInApp(expr).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error('ERR',e.message);process.exit(1);});
