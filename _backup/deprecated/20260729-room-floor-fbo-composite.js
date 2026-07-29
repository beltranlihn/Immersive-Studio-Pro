/* ARCHIVED (deprecated / unused) — Immersive Studio Pro
 * Origen:   app.js · ensureRoomFloorFBO(sz) + compositeFloorTex(m,sz), globals `_roomFloorFBO`/`_roomFloorTex`/
 *           `_roomFloorSize` (declared near the PR program setup, ~L571: `let _roomFloorFBO=null,_roomFloorTex=null,
 *           _roomFloorSize=0;` — that declaration line was ALSO removed, see Restaurar)
 * Sacado:   2026-07-29 (R221)
 * Motivo:   [R221] the floor stopped being its own 'flat' sequence composited into a dedicated square FBO — it's
 *           now a pixel region of the SAME canvas/composite as the walls strip. renderRoom3D draws the floor quads
 *           with the same `wallsTex` it already uses for the walls (new UVs from buildRoomGeo point at the dock
 *           rect of that composite), and the 2D viewer's floor content paints as part of the normal flat blit.
 *           No callers left anywhere in app.js once those two call sites were removed — verified by grep.
 * Restaurar:Re-add `let _roomFloorFBO=null,_roomFloorTex=null,_roomFloorSize=0;` near the PR/LR program setup, then
 *           this block right before buildRoomGeo. In renderRoom3D, before building the camera, restore:
 *             `let floorTex=null; if(room.floorSeqId){ const fm=mediaById(room.floorSeqId); if(fm&&isSeqMedia(fm))floorTex=compositeFloorTex(fm,1024); }
 *              gl.bindFramebuffer(gl.FRAMEBUFFER,null); gl.viewport(0,0,W,H); // compositeFloorTex rebinds → restore`
 *           and change the floor draw back to `if(floorTex&&_roomGeo.floorVerts>0){ gl.bindTexture(gl.TEXTURE_2D,floorTex); ... }`.
 *           Only valid together with reverting the rest of R221 (buildRoomGeo's floor UVs, room.floorSeqId as a
 *           live separate sequence).
 * Relacion: R221, ADR-0007
 */
function ensureRoomFloorFBO(sz){ if(_roomFloorFBO&&_roomFloorSize===sz)return;
  if(_roomFloorFBO){ try{gl.deleteFramebuffer(_roomFloorFBO);gl.deleteTexture(_roomFloorTex);}catch(e){} }
  _roomFloorTex=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,_roomFloorTex);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,sz,sz,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  _roomFloorFBO=gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER,_roomFloorFBO); gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,_roomFloorTex,0); gl.bindFramebuffer(gl.FRAMEBUFFER,null); _roomFloorSize=sz; }
/* composite a floor sequence's own clips into a square FBO (letterboxed to its aspect) → texture for the 3D floor */
function compositeFloorTex(m,sz){ ensureRoomFloorFBO(sz);
  const oc=state.clips,ol=state.lanes,odf=_drawFlat,oca=_compAspect,orw=_roomWrap;
  state.clips=m.nestClips||[]; state.lanes=(m.nestLanes&&m.nestLanes.length?m.nestLanes:defLanes()); _drawFlat=true; _roomWrap=false; _compAspect=(m.w||1)/(m.h||1);
  prepNests(state.clips,state.playhead,0);
  gl.bindFramebuffer(gl.FRAMEBUFFER,_roomFloorFBO); composite(state.playhead,sz,false); gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  state.clips=oc; state.lanes=ol; _drawFlat=odf; _roomWrap=orw; _compAspect=oca; return _roomFloorTex; }
