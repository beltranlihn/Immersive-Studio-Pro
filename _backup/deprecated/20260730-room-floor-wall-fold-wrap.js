/* ARCHIVADO 2026-07-30 · R230 (Etapa 3 del visor 360) — fold-wrap piso↔muro de R222.
   Por qué se va: desde R229 (Etapa 1) cada clip se coloca en el marco de SU superficie y se recorta con
   scissor a su sub-rect del lienzo (clipSurfRect / surfaceScissorRect / drawClipFlat). Un clip del piso ya
   NO puede desbordar a los muros, así que el plegado que dibujaba la parte desbordada girada sobre el muro
   vecino dejó de tener trabajo: era código muerto en la ruta de render. Verificado por píxeles en R229
   (scratchpad/r230-surfaces.mjs: wallsUnderFloorCols=0 con el clip del piso a escala 300).
   Si algún día se quiere un piso que 'derrame' sobre los muros, esto es el punto de partida — pero tendría
   que convivir con el scissor de superficie, no reemplazarlo.
   Vivía en app.js: los vars junto a _roomGeo, y las dos funciones justo antes de drawClipFlat. */

let _roomFold=null, _roomFoldSeq=null; // [R222] floor↔wall fold-wrap geometry cache, keyed like _roomGeo

/* [R222] Floor↔wall fold-wrap — same "infinite" feel as the horizontal seam wrap below, but the floor meets its
   Left/Right/Back walls at a 90° hinge instead of sitting side by side in the strip, so crossing those edges needs
   a ROTATION (not just an x-shift). The Front edge (room.walls.Front's row) is already contiguous for free: floor
   and Front sit in the SAME canvas, at the SAME columns (fx0..fx1) and adjacent rows (wallsH) — no wrap needed.
   Derivation (pixel space, y-down — same coords as room.walls x0/x1/pxW and room.stripH):
   buildRoomGeo bottom-anchors every wall's floor-contact row at py=wallsH, and its uv mapping runs a→b as
   uL=x1@a, uR=x0@b (comment there: "the wall's a→b runs right→left"). Combined with roomPlan's corner loop
   (Front:[FL,FR] Left:[FR,BR] Back:[BR,BL] Right:[BL,FL]) and the floor's own fuv (X flipped, Y direct, dock
   rect = Front's column span fx0..fx1), each floor↔wall corner correspondence works out to:
     LEFT   (floor px<fx0   → Left wall):  px'=Left.x1 -(Left.pxW/floorH)*(py-wallsH)   py'=wallsH-fx0+px
     RIGHT  (floor px>fx1   → Right wall): px'=Right.x0+(Right.pxW/floorH)*(py-wallsH)  py'=wallsH+fx1-px
     BOTTOM (floor py>wallsH+floorH → Back wall): px'=Back.x1-(Back.pxW/floorW)*(px-fx0) py'=2·wallsH+floorH-py
   Each is stored as a RAW pixel affine map px'=a·px+b·py+c, py'=d·px+e·py+f (not pre-rotated into NDC) so the
   scale mismatch between the floor's own resolution and each wall's own resolution — independently authored
   media, rarely equal — falls out for free instead of assuming square pixels. All three have positive
   determinant (pure rotation+anisotropic-scale, no mirroring) — verified by hand and confirmed by the CDP capture
   at each seam (see R222 verification notes in PLAN.md). */
function computeRoomFold(seq){ const room=seq&&seq.room; if(!room||!room.floor)return null;
  const walls=room.walls||[]; const byRole={}; for(const w of walls)byRole[w.role]=w;
  const fw=byRole.Front; if(!fw)return null;
  const stripW=seq.w||1, wallsH=room.stripH||seq.h||1, floorH=Math.max(1,(seq.h||1)-wallsH);
  const fx0=fw.x0||0, fx1=fw.x1||stripW, floorW=Math.max(1,fx1-fx0);
  const edges={}; const L=byRole.Left, R=byRole.Right, B=byRole.Back;
  if(L&&L.x1>L.x0){ const w=L.x1-L.x0; edges.left  ={a:0,          b:-w/floorH, c:L.x1+(w/floorH)*wallsH, d:1, e:0,  f:wallsH-fx0, role:'Left'}; }
  if(R&&R.x1>R.x0){ const w=R.x1-R.x0; edges.right ={a:0,          b: w/floorH, c:R.x0-(w/floorH)*wallsH, d:-1,e:0,  f:wallsH+fx1, role:'Right'}; }
  if(B&&B.x1>B.x0){ const w=B.x1-B.x0; edges.bottom={a:-w/floorW,  b:0,         c:B.x1+(w/floorW)*fx0,    d:0, e:-1, f:2*wallsH+floorH, role:'Back'}; }
  if(!Object.keys(edges).length)return null;
  return {stripW,wallsH,floorH,fx0,fx1,floorW,edges}; }
/* Cached like _roomGeo (keyed on state.activeSeqId, not re-derived per clip) — applyRoomGeometry() and
   lchEditorShot() reset _roomFoldSeq=null wherever they already reset _roomGeoSeq for the same reason (geometry
   can change without the sequence id changing). */
function roomFold(){ if(_roomFoldSeq!==state.activeSeqId){ const seq=activeSeq(); _roomFold=(seq&&seq.room)?computeRoomFold(seq):null; _roomFoldSeq=state.activeSeqId; } return _roomFold; }
