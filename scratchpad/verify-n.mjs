import { evalInApp } from './cdp.mjs';
const expr = `(async()=>{
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const out={};
  // shader sanity: PFD program compiled?
  out.pfdProgram = (typeof PFD!=='undefined') && !!PFD;
  out.lfdScaleLoc = (typeof LFD!=='undefined') && LFD.scale!==undefined && LFD.scale!==null;

  // [N1] fulldome scale — a shape clip set to fulldome, size 55 vs 110
  createShapeClip('rect'); const c=state.clips[state.clips.length-1]; const mm=mediaById(c.mediaId);
  if(mm){ mm.fill='#ffffff'; renderShapeMedia(mm); }
  state.selId=c.id; state.selIds=[c.id]; state.playhead=c.start+0.5;
  c.props.fulldome=true; c.props.opacity=100; c.props.size=55; render(); await wait(50);
  const glc=document.getElementById('gl'); const g=glc.getContext('webgl2'); const W=glc.width,H=glc.height;
  const px=(x,y)=>{const p=new Uint8Array(4); g.readPixels(x,H-1-y,1,1,g.RGBA,g.UNSIGNED_BYTE,p); return [p[0],p[1],p[2],p[3]];};
  out.fulldome_center_notBlack = px(Math.floor(W/2),Math.floor(H/2)).some(v=>v>10);

  // [N4] compose nest preserves inner tweaks + relative scale on recompose
  const shp={id:uid(),kind:'shape',name:'S',shape:'rect',fill:'#C9CDD3',stroke:'#000',strokeW:0,sw:256,sh:256,dur:6,fps:0,color:'#8ac',folder:null};
  renderShapeMedia(shp); state.media.push(shp);
  const nest = createComposition({kind:'ring', mediaIds:[shp.id], count:3, el:30, size:40});
  let n4={};
  if(nest && nest.comp){
    const inner=nest.nestClips[0];
    n4.baseSize = inner.props.size;                 // layout size (~40)
    inner.props.opacity=42;                          // manual tweak
    inner.props.size=inner.props.size+20;            // manual +20 delta
    const beforeSize=inner.props.size;
    nest.comp.size=60;                               // change global compose size (40->60, +20)
    regenComposeNest(nest);
    const inner2=nest.nestClips[0];
    n4.opacityPreserved = inner2.props.opacity===42;
    n4.sizeRelative = Math.round(inner2.props.size); // expect ~ 60(new base)+20(delta)=80, not 60 and not 40
    n4.sameObjectReused = inner2===inner;
  }
  out.N4 = n4;
  return JSON.stringify(out,null,1);
})()`;
console.log(await evalInApp(expr, { timeout: 25000 }));
