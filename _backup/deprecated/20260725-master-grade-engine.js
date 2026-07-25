/* ============================================================================================================
   ARCHIVED — Master Grade ENGINE  ·  removed 2026-07-25 (R150)
   ------------------------------------------------------------------------------------------------------------
   Origen:   app.js — shader _MGFS / programa _MG / _MGu / _masterClip / _mgRT / _mgTarget / masterGradeOn() /
             applyMasterGrade(), state.seqGrade, y sus seis call-sites (preview, NDI, Spout, export, save, load).
             Commit previo: 028948b "R148 · Rediseño Rev 1".
   Sacado:   2026-07-25
   Motivo:   Decisión de Beltrán: "Eso nunca lo voy a aplicar, no me interesa. Que salga del code y se vaya a
             deprecated." El rediseño "Rev 1" ya había sacado la UI (ver master-grade-ui.js, 2026-07-25); el motor
             quedaba vivo pero sin forma de editarse ni resetearse — un grado guardado en un .isp viejo se seguía
             aplicando sin nada en pantalla que lo dijera. Beltrán confirmó que no tiene proyectos activos, así que
             no hay compatibilidad que preservar.
   Restaurar:1) pegar el BLOQUE DEL MOTOR de abajo en app.js justo después de applyBlackKey (antes de const _FH).
             2) volver a poner los seis call-sites en sus funciones (cada uno está abajo con su ubicación).
             3) restaurar state.seqGrade en el init de state (L85).
             4) para poder EDITARLO hace falta además la UI: ver _backup/deprecated/master-grade-ui.js.
   Relacion: REDISEÑO-UI.md §4, ADR-0007 (archivar no borrar), ADR-0008 (regla de poda), AUDITORIA-REV1.md
   ============================================================================================================ */

/* ------------------------------------------------------------------------------------------------------------
   1 · ESTADO — dentro del objeto literal `state` (app.js ~L85), entre `seqCov:180,` y `groups:[]`
   ------------------------------------------------------------------------------------------------------------ */
// seqGrade:{exposure:0,contrast:0,saturation:0,temperature:0,tint:0}, // [master grade] per-sequence global grade over the final composite (phase 1: numeric)

/* ------------------------------------------------------------------------------------------------------------
   2 · CALL-SITES (uno por línea, en el orden en que aparecían en app.js)
   ------------------------------------------------------------------------------------------------------------ */

// preloadLUTs (~L297-298) — que el LUT máster también se precargue. Eran DOS trozos: el de la secuencia activa
// (línea propia) y el de cada nest, embebido en el scan de media.
if(state.seqGrade&&state.seqGrade.lut)paths.add(state.seqGrade.lut);
//   ...y dentro del bucle de media:   if(m.grade&&m.grade.lut)paths.add(m.grade.lut);   // per-sequence master LUTs

// render() (~L945) — grade del composite final, post render-ahead cache
if(masterGradeOn())_srcTex=applyMasterGrade(_srcTex,compSize); // [master grade] grade the FINAL composite — post render-ahead cache so grade edits stay live (not baked) and every view mode (2D/dome/room/viewer) shows it

// ndiTick (~L1050) — NDI emite el máster ya graduado
if(masterGradeOn()){ applyMasterGrade(_ndiTex,_ndiRes); gl.bindFramebuffer(gl.FRAMEBUFFER,_mgRT.fbo); } // [master grade phase 2] NDI carries the graded master too

// spoutTick (~L1087) — Spout idem
if(masterGradeOn()){ applyMasterGrade(_spoutTex,_spoutRes); gl.bindFramebuffer(gl.FRAMEBUFFER,_mgRT.fbo); } // [master grade phase 2] Spout carries the graded master too

// renderExportFrame (~L4349) — hornear el grade en el frame exportado
const _exOut=masterGradeOn()?applyMasterGrade(_exTex,SR):_exTex; // [master grade] bake the sequence master grade into the exported frame → export matches preview (WYSIWYG)

// serMedia (~L5040) — fragmento dentro del objeto serializado:
//   grade:(m.kind==='nest'?(m.grade||null):null),

// saveActiveSeq (~L5058) — fragmento:
//   s.grade=state.seqGrade;   // [master grade] per-sequence grade travels with the nest media

// loadSeqIntoState (~L5061) — fragmento:
//   state.seqGrade=Object.assign({exposure:0,contrast:0,saturation:0,temperature:0,tint:0}, s.grade||{}); /* [master grade] restore this sequence's grade (identity default) */

/* ------------------------------------------------------------------------------------------------------------
   3 · CSS huérfano — iba en index.html justo después de `.sechead .ln` (lo usaba la UI archivada en
       master-grade-ui.js; quedó sin dueño al sacar el motor, así que se archiva acá)
   ------------------------------------------------------------------------------------------------------------
  /* [master grade] sequence-level grade section at the top of the inspector * /
  #insMaster{border-bottom:.5px solid rgba(255,255,255,0.07);}
  #insMaster .mgdot{width:6px;height:6px;border-radius:50%;background:var(--ink);flex-shrink:0;margin-left:6px;box-shadow:0 0 5px rgba(224,224,224,0.5);}
  #insMaster .mgrow{padding:2px 12px;}
  #insMaster .mgrow .lab{font-size:11px;color:var(--ink-2);}
  #insMaster .mgrow .num{font-variant-numeric:tabular-nums;font-size:11px;color:var(--ink);}
   ------------------------------------------------------------------------------------------------------------ */

/* ------------------------------------------------------------------------------------------------------------
   4 · BLOQUE DEL MOTOR — iba en app.js entre applyBlackKey() y const _FH
   ------------------------------------------------------------------------------------------------------------ */
/* [master grade] sequence-level global grade applied to the FINAL composite (after all clips), before the view
   projection/export blit. Phase 1: numeric grade (exposure/contrast/saturation/temp/tint) — same math as FSW so it
   matches per-clip grading. Runs as one full-screen pass; skipped entirely when the grade is identity (zero cost). */
const _MGFS=`#version 300 es
precision highp float; in vec2 v_uv; out vec4 o; uniform sampler2D u_tex; uniform float u_exp,u_con,u_sat,u_tmp,u_tnt;
uniform vec3 u_lift,u_gamma,u_gain; uniform sampler2D u_curve; uniform float u_hasCurve; uniform highp sampler3D u_lut; uniform float u_hasLut,u_lutMix; // [master grade phase 2] wheels + curves + LUT (same chain as FSW)
void main(){ vec4 c=texture(u_tex,v_uv); vec3 col=c.rgb;
  col*=exp2(u_exp); col=(col-0.5)*(1.0+u_con)+0.5; float L=dot(col,vec3(0.2126,0.7152,0.0722)); col=mix(vec3(L),col,1.0+u_sat); col*=vec3(1.0+u_tmp,1.0,1.0-u_tmp); col*=vec3(1.0-u_tnt*0.5,1.0+u_tnt,1.0-u_tnt*0.5);
  col=pow(max(u_gain*col+u_lift,0.0), u_gamma); col=clamp(col,0.0,1.0);                 // R130 lift/gamma/gain
  if(u_hasCurve>0.5){ col.r=texture(u_curve,vec2(col.r,0.5)).r; col.g=texture(u_curve,vec2(col.g,0.5)).g; col.b=texture(u_curve,vec2(col.b,0.5)).b; col=vec3(texture(u_curve,vec2(col.r,0.5)).a, texture(u_curve,vec2(col.g,0.5)).a, texture(u_curve,vec2(col.b,0.5)).a); } // R132 curves
  if(u_hasLut>0.5){ col=mix(col, texture(u_lut, col).rgb, u_lutMix); }                    // R116 LUT
  o=vec4(col, c.a); }`; // alpha preserved (dome surround stays transparent); grade only touches rgb
const _MG=ppCompile(_MGFS); const _MGu={tex:gl.getUniformLocation(_MG,'u_tex'),exp:gl.getUniformLocation(_MG,'u_exp'),con:gl.getUniformLocation(_MG,'u_con'),sat:gl.getUniformLocation(_MG,'u_sat'),tmp:gl.getUniformLocation(_MG,'u_tmp'),tnt:gl.getUniformLocation(_MG,'u_tnt'),
  lift:gl.getUniformLocation(_MG,'u_lift'),gamma:gl.getUniformLocation(_MG,'u_gamma'),gain:gl.getUniformLocation(_MG,'u_gain'),curve:gl.getUniformLocation(_MG,'u_curve'),hasCurve:gl.getUniformLocation(_MG,'u_hasCurve'),lut:gl.getUniformLocation(_MG,'u_lut'),hasLut:gl.getUniformLocation(_MG,'u_hasLut'),lutMix:gl.getUniformLocation(_MG,'u_lutMix')}; // field names match the L-struct that bindClipLUT/Grade/Curve expect → reuse the clip grade pipeline
const _masterClip={props:null}; // a stand-in "clip" so bindClipLUT/Grade/Curve can drive the master grade (holds _curveTex/_curveDirty for the curve-texture cache)
let _mgRT=null;
function _mgTarget(size){ if(!_mgRT){ _mgRT={tex:gl.createTexture(),fbo:gl.createFramebuffer(),size:0}; } if(_mgRT.size!==size){ _ppTex(_mgRT.tex,size); gl.bindFramebuffer(gl.FRAMEBUFFER,_mgRT.fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,_mgRT.tex,0); gl.bindFramebuffer(gl.FRAMEBUFFER,null); _mgRT.size=size; } return _mgRT; }
function masterGradeOn(){ const g=state.seqGrade; if(!g)return false;
  if((g.exposure||0)||(g.contrast||0)||(g.saturation||0)||(g.temperature||0)||(g.tint||0))return true;
  const w=a=>a&&((a[0]||0)||(a[1]||0)||(a[2]||0)); if(w(g.cgLift)||w(g.cgGamma)||w(g.cgGain))return true; // wheels
  if(g.lut)return true; // master LUT
  if(g.curves&&!curveIsIdentity(g.curves))return true; // curves
  return false; }
function applyMasterGrade(inTex,size){ if(!masterGradeOn())return inTex; const g=state.seqGrade;
  const prevFBO=gl.getParameter(gl.FRAMEBUFFER_BINDING), pv=gl.getParameter(gl.VIEWPORT); const rt=_mgTarget(size);
  gl.disable(gl.BLEND); gl.bindVertexArray(_ppVAO); gl.useProgram(_MG);
  gl.uniform1f(_MGu.exp,(g.exposure||0)/100); gl.uniform1f(_MGu.con,(g.contrast||0)/100); gl.uniform1f(_MGu.sat,(g.saturation||0)/100); gl.uniform1f(_MGu.tmp,(g.temperature||0)/100*0.15); gl.uniform1f(_MGu.tnt,(g.tint||0)/100*0.15);
  _masterClip.props=g; bindClipLUT(_masterClip,_MGu); // [phase 2] reuse the clip grade pipeline: sets wheels+curve+LUT on units 2/3, restores TEXTURE0
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,inTex); gl.uniform1i(_MGu.tex,0);
  gl.bindFramebuffer(gl.FRAMEBUFFER,rt.fbo); gl.viewport(0,0,size,size); gl.drawArrays(gl.TRIANGLES,0,6);
  gl.bindVertexArray(null); gl.bindFramebuffer(gl.FRAMEBUFFER,prevFBO); gl.viewport(pv[0],pv[1],pv[2],pv[3]); gl.enable(gl.BLEND); NORMAL_BLEND();
  return rt.tex; }
