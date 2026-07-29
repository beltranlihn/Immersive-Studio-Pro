import { connect } from './r222-lib.mjs';
const { evalExpr, ws } = await connect();

// Define a reusable page-side placement helper + create the asymmetric test clip.
const setup = await evalExpr(`(function(){
  window.__frame = function(){
    const A=(state.seqW||1)/(state.seqH||1), s=Math.min(2/A,2), Fx=s*A/2, Fy=s/2, K=2*Fx/(state.seqW||1);
    return {A,s,Fx,Fy,K,stripW:state.seqW,canvasH:state.seqH};
  };
  window.__placeAtPixel = function(c, pxCenter, pyCenter, pxHalfWidth, rotDeg){
    const F=window.__frame(); const m=mediaById(c.mediaId);
    const nx=px=>F.K*px-F.Fx, ny=py=>F.Fy-F.K*py;
    c.props.x = (nx(pxCenter)/F.Fx)*100;
    c.props.y = (ny(pyCenter)/F.Fy)*100;
    c.props.rot = rotDeg||0;
    // measure hw at scale=100 to solve for the scale hitting the target pixel half-width
    c.props.scale = 100;
    let P = flatPlace(c, m, state.playhead);
    const s0 = Math.hypot(P.fx[0], P.fx[1]); // NDC half-width magnitude at scale=100 (rot=0 baseline; rot doesn't change magnitude)
    const targetNdc = pxHalfWidth * F.K;
    c.props.scale = 100 * (targetNdc / Math.max(1e-6, s0));
    P = flatPlace(c, m, state.playhead);
    return { x:c.props.x, y:c.props.y, scale:c.props.scale, hwNdc:Math.hypot(P.fx[0],P.fx[1]), hwPx: Math.hypot(P.fx[0],P.fx[1])/F.K };
  };
  if(!mediaById(window.__testTextId)){
    const m={id:uid(),kind:'text',name:'FoldTest',text:'F',tfontSize:220,tweight:'900',tfont:'Inter, sans-serif',tcolor:'#ffffff',tbg:'#e0405a',tstroke:false,tstrokeColor:'#000',dur:20,fps:0,color:clipColorFor('text')};
    state.media.push(m); window.__testTextId=m.id;
    addClip(m, null, 0);
    window.__testClipId = state.selId;
  }
  const c = state.clips.find(cc=>cc.id===window.__testClipId);
  c.dur = 20; c.start=0;
  return { mediaId: window.__testTextId, clipId: window.__testClipId, frame: window.__frame() };
})()`);
console.log(JSON.stringify(setup, null, 2));
ws.close();
