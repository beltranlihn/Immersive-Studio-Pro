/* ARCHIVED (deprecated / unused) — Immersive Studio Pro
 * Origen:   app.js · drawRoomFloorDock2D(seq,room,tex) + globals _dockVAO/_dockVB, called from render()'s flat-blit
 *           branch, fed by a compositeFloorTex(fm,1024) call also removed from render() and from renderRoom3D
 * Sacado:   2026-07-29 (R221)
 * Motivo:   [R221] the room's floor stopped being a separate flat sequence composited into its own square FBO and
 *           glued below the canvas as an "unfolded cube" dock. It is now just the bottom pixel slice of the SAME
 *           canvas as the walls strip (seq.h = room.stripH + floorH), so its content paints as part of the normal
 *           flat blit in render() — no second quad, no second texture, no compositeFloorTex() call needed for the
 *           2D viewer. The overlay (outline/grid/"FLOOR" label) that used to ride alongside this draw now lives
 *           directly in drawRoomGrid2D (see the room.floor block there, which uses room.stripH instead of gluing
 *           past the frame's bottom edge).
 * Restaurar:Re-insert this function + `let _dockVAO=null,_dockVB=null;` near drawRoomLabels3D in app.js. In
 *           render()'s flat-blit branch, before drawGrid2D(), rebuild the `_dockTex` compositeFloorTex(fm,1024)
 *           call (see git history around R211/R220 for the exact block) and call
 *           `if(_dockTex)drawRoomFloorDock2D(_dockSeq,_dockRoom,_dockTex)`. Only valid together with reverting the
 *           rest of R221 (room.floorSeqId as a live separate sequence, not just a migration artifact).
 * Relacion: R221, R211 (original), ADR-0007
 */
/* [R211] floor "dock" — the room's floor sequence pinned just below the Front wall in the 2D strip viewer, like an
   unfolded paper cube. Display-only (compositing/export/click-mapping untouched): reuses PB (already bound) and the
   pan/zoom/aspect/flat uniforms render() just set for the strip, only swapping u_uvsc/u_uvof + a small dynamic quad
   appended past the strip's bottom edge (a_p.y beyond -1, same coordinate space quadVAO already occupies). */
let _dockVAO=null,_dockVB=null;
function drawRoomFloorDock2D(seq,room,tex){
  const stripW=seq.w||1, stripH=seq.h||1;
  const fw=room.walls.find(w=>w.role==='Front')||room.walls[0]; if(!fw)return;
  const fx0=fw.x0,fx1=fw.x1, fd=room.floor.pxH*((fx1-fx0)/(room.floor.pxW||1));
  const ax0=-1+2*fx0/stripW, ax1=-1+2*fx1/stripW, ayTop=-1, ayBot=-1-2*fd/stripH;
  if(!_dockVAO){ _dockVAO=gl.createVertexArray(); _dockVB=gl.createBuffer();
    gl.bindVertexArray(_dockVAO); gl.bindBuffer(gl.ARRAY_BUFFER,_dockVB); gl.enableVertexAttribArray(LB.p); gl.vertexAttribPointer(LB.p,2,gl.FLOAT,false,0,0); gl.bindVertexArray(null); }
  gl.bindVertexArray(_dockVAO); gl.bindBuffer(gl.ARRAY_BUFFER,_dockVB);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([ax0,ayTop, ax1,ayTop, ax0,ayBot, ax1,ayTop, ax1,ayBot, ax0,ayBot]),gl.DYNAMIC_DRAW);
  const Af=(room.floor.pxW||1)/(room.floor.pxH||1), Fxf=Math.min(1,Af), Fyf=Math.min(1,1/Af);
  const uMn=(1-Fxf)/2, uMx=(1+Fxf)/2, vMn=(1-Fyf)/2, vMx=(1+Fyf)/2;
  const uvscX=(uMx-uMn)/(((ax1-ax0)*0.5)||1e-6), uvofX=uMn-(ax0*0.5+0.5)*uvscX;
  const uvscY=(vMx-vMn)/(((ayBot-ayTop)*0.5)||-1e-6), uvofY=vMn-(ayTop*0.5+0.5)*uvscY; // negative: v flips vs the floor's own editor, matching the unfolded-cube fold
  gl.uniform2f(LB.uvsc,uvscX,uvscY); gl.uniform2f(LB.uvof,uvofX,uvofY);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,tex); gl.uniform1i(LB.tex,0);
  gl.drawArrays(gl.TRIANGLES,0,6); gl.bindVertexArray(null);
}
