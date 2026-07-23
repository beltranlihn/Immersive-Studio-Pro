"use strict";
/* ===================== Dome Studio Pro — engine + UI ===================== */
const PI=Math.PI, HALF_PI=PI/2, D2R=PI/180, R2D=180/PI, COMP=2048;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let _id=1; const uid=()=>_id++;
/* [R102·D-T1] Espejo en JS de los tokens de :root. El canvas no puede leer var(), pero eso NO justifica una
   segunda paleta: se leen del CSS al arrancar, así que index.html sigue siendo la única fuente de verdad.
   Antes había 78 hex cableados aquí contra 4 usos de var() — el sistema existía y la UI lo ignoraba. */
const UI={};
/* [R102·rev] Se rellena en sitio (no se reasigna) y hay `refreshUI()`: es una FOTO de :root, y el comentario de
   arriba sólo es honesto mientras nadie cambie un token en runtime. El día que exista un tema claro, un ajuste
   de densidad o alto contraste, el DOM se re-tintaría solo y el canvas —waveforms, curvas, regla— se quedaría
   con la paleta vieja SIN error ni aviso (el warn de abajo no lo cubre: los tokens sí existían al arrancar).
   Quien toque :root en runtime debe llamar a refreshUI() + render(). */
function refreshUI(){ const cs=getComputedStyle(document.documentElement), g=n=>cs.getPropertyValue(n).trim();
  const p={ s0:g('--s0'), s1:g('--s1'), s2:g('--s2'), stateOn:g('--state-on'),
            ink:g('--ink'), ink2:g('--ink-2'), ink3:g('--ink-3'), inkDim:g('--ink-dim'),
            line:g('--line'), lineSoft:g('--line-soft'), lineStrong:g('--line-strong'),
            accLive:g('--auto-live'), accOvr:g('--auto-ovr'), danger:g('--danger') };
  for(const k in p){ if(!p[k])console.warn('[UI] token vacío:',k); UI[k]=p[k]; } // un token mal escrito daría canvas transparente en silencio
  return UI; }
refreshUI();
/* Preferencia de export: sobrevive al reinicio. Antes sólo vivía en memoria, así que "abre con lo último que
   usaste" se perdía al cerrar la app — y para quien exporta el mismo formato cada día, la sesión no es la
   unidad que importa. localStorage ya se usa aquí para recientes, así que es lo idiomático. */
const LAST_EXP_KEY='dspLastExport';
function lastExportGet(){ if(state.lastExport)return state.lastExport;
  try{ const s=localStorage.getItem(LAST_EXP_KEY); if(s)return (state.lastExport=JSON.parse(s)); }catch(_){} return null; }
function lastExportSet(v){ state.lastExport=v; try{ localStorage.setItem(LAST_EXP_KEY,JSON.stringify(v)); }catch(_){} }
const TRACK_COLORS=['#B4BAC1','#9EA5AD','#C5CAD0','#8A9199','#A7ADB5'];
/* [R102·D-T2] Color de clip = TIPO de medio, por TONO a luminosidad constante (L*=50.0, spread 0.26).
   Antes: 6 grises entre L* 19 y 29, saturación ~18%, repartidos POR TURNO (`colorIdx++`). Es decir: el color
   no significaba nada, no se distinguían entre sí, y encima ocupaban el eje de brillo.
   Ojo con la fuente: el informe decía que los 11 colores de strip de Blender están "todos a la misma
   luminosidad". Medidos en L* **se reparten 20.2** (43.0–63.2) — la afirmación salía de las medias RGB, no de
   L*, y venía marcada como inferencia, no como dato. Blender puede permitírselo porque su selección es un
   CONTORNO, no un cambio de brillo (la nuestra también: `.clip.sel .tt` usa inset box-shadow). Así que la
   luminosidad constante aquí no la pide el estado: la pide que **ningún tipo de medio grite más que otro**.
   `nest` va neutro: una secuencia es estructura, no medio — se dice desaturando, sin leyenda (Blender hace lo
   mismo con `scene`). El color se calcula, no se elige a ojo: ver scratchpad/ (búsqueda binaria de L* por tono). */
const CLIP_HUE={ video:'#4E78B3', image:'#B34FB3', audio:'#398559', sequence:'#9A6E42', text:'#7F7936',
                 shape:'#628037', ndi:'#8468BE', adjust:'#B75686', nest:'#777777' };
const CLIP_FALLBACK='#5E6570';
function clipColorFor(kind){ return CLIP_HUE[kind]||CLIP_FALLBACK; }
/* SÍ existe un selector de color por clip (openClipColorPopup) → una elección del usuario es sagrada y no se
   repinta. Pero estos valores nunca los eligió nadie: son los que repartía `colorIdx++` y el que escribe el
   propio botón "restablecer" del selector. Es decir, son el centinela de "sin color". Tratarlos como no-puestos
   deriva el color del tipo y **arregla también los proyectos ya guardados**, sin tocar ninguna elección real. */
const CLIP_COLORS=['#3C4046','#343941','#2E333A','#3F444B','#33383F','#2A2E34'];
const CLIP_AUTO=new Set([...CLIP_COLORS,'#454C55','#B4BAC1']); // + los que cableaban nest y audio/adjust
function clipTint(c,m){ const own=c&&c.color; if(own&&!CLIP_AUTO.has(String(own).toUpperCase()))return own; // elección del usuario
  return clipColorFor(m&&m.kind); }
/* [R102·rev] Aquí vivía `laneTint(c)`, con el fallback viejo `(c&&c.color)||'#3C4046'` y sin pasar por
   clipTint. Estaba MUERTO (0 llamadas), pero era una segunda fuente de verdad para el color de clip esperando
   a que alguien la usara: habría devuelto el gris heredado en vez del tono del tipo, y como `#3C4046` es justo
   el centinela de "sin color", el fallo habría sido silencioso. Borrado. El color de clip se pide a clipTint. */
function hexA(hex,a){ hex=(hex||'').replace('#',''); if(hex.length===3)hex=hex.split('').map(c=>c+c).join(''); const n=parseInt(hex,16)||0; return 'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+a+')'; }
/* readable text color for a clip-color headband (dark text on light colors, light on dark)
   [R94-UT5·U-26] real WCAG relative-luminance contrast ratio (was a 0.62 luma heuristic): pick whichever
   candidate (#0E0F11 dark / #F2F4F8 light) contrasts MORE against the background color */
const _wcagLin=c=>{ c/=255; return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4); };
const _wcagLum=(r,g,b)=>0.2126*_wcagLin(r)+0.7152*_wcagLin(g)+0.0722*_wcagLin(b);
const _LUM_DARK=_wcagLum(0x0E,0x0F,0x11), _LUM_LIGHT=_wcagLum(0xF2,0xF4,0xF8); // precomputed: textOn runs per clip per render
function textOn(hex){ try{ const L=_wcagLum(parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16));
  const rD=(Math.max(L,_LUM_DARK)+0.05)/(Math.min(L,_LUM_DARK)+0.05), rL=(Math.max(L,_LUM_LIGHT)+0.05)/(Math.min(L,_LUM_LIGHT)+0.05);
  return rD>=rL?'#0E0F11':'#F2F4F8'; }catch(e){ return '#F2F4F8'; } }

/* fill icon placeholders */
$$('[data-ico]').forEach(e=>{ e.innerHTML=ICO(e.dataset.ico, e.dataset.s?+e.dataset.s:13); e.style.display='inline-flex'; });

/* ===================== STATE ===================== */
const state = {
  fps:60, media:[],
  lanes:[ {id:uid(),name:'Video 1',tag:'V1',kind:'video'}, {id:uid(),name:'Video 2',tag:'V2',kind:'video'}, {id:uid(),name:'Video 3',tag:'V3',kind:'video'}, {id:uid(),name:'Video 4',tag:'V4',kind:'video'}, {id:uid(),name:'Audio 1',tag:'A1',kind:'audio'} ], // [R92-T9] default project = 4 video + 1 audio (Premiere)
  clips:[],
  playhead:0, playing:false, loop:false, follow:false,
  selId:null, selMediaId:null, selMediaIds:[], selMediaAnchor:null,
  view:{ mode:'2d', three:'orbit', zoom:0.92, pan:[0,0], showGrid:true, showSafe:false, showOutline:true, cull:false, useProxy:true, checkerBg:false,
         cw:400, ch:400, cam:{yaw:0, pitch:0.5, dist:3.0, fov:60, back:0.8} },
  tl:{ pxPerSec:80, tool:'select', snap:false, tcMode:'timecode', bpm:120, sig:4, gridDiv:0, gridFixed:false, gridFixedBase:1, selA:null, selB:null, audioCollapsed:false, simpleClips:true }, // [R94c/f] snap to grid OFF by default; simpleClips = Premiere-style whole-clip grab, ON by default. [R110] audioCollapsed = the audio module is compacted to just its bar
  workIn:null, workOut:null,
  prefs:{ reducedMotion:false, snapping:true, grid:true, safe:false, mediaCollapsed:false, inspCollapsed:false, tallInsp:false },
  mediaFilter:'all', mediaQuery:'', mediaGroupBy:'none', collapsedGroups:{}, folders:[], folderColors:{}, mediaView:'list', mediaFolder:null, selFolder:null,
  useProxies:true, previewQuality:1, markers:[], selMarkerId:null, clipboard:null,
  groups:[], selGroupId:null, dirty:false, selLane:null, selIds:[], openSeqs:[], activeSeqId:null, seqW:4096, seqH:4096, seqMode:'dome', seqCov:180, seqGrade:{exposure:0,contrast:0,saturation:0,temperature:0,tint:0}, // [master grade] per-sequence global grade over the final composite (phase 1: numeric)
  shapeBox:null, easeClip:null, shuttle:0, /* [R97] J/K/L speed: 0 = off (normal transport) · ±0.25…±8 */ // [R95] Shape Box holds live refs to keyframe objects → it must be dropped whenever those objects are replaced (undo, project/sequence load). easeClip = copied normalised easing. // [archivado 20260722·R137] autoRec (perform-and-bake) removido
  lang:'en',
  lastSaved:null,
};
try{ const _lg=localStorage.getItem('domeProLang'); if(_lg==='en'||_lg==='es')state.lang=_lg; }catch(e){}
try{ const _rm=localStorage.getItem('domeProRM'); // [R94-UT5·U-27] no saved choice → follow the OS prefers-reduced-motion; a saved user choice ('1'/'0') always wins
  state.prefs.reducedMotion=(_rm==null)?!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches):(_rm==='1');
  if(state.prefs.reducedMotion&&document.body)document.body.classList.add('rm-on'); }catch(e){}
/* i18n: T(english, spanish) — returns the active-language string */
function T(en,es){ return state.lang==='es'?es:en; }
/* default keyframe easing (Easing control removed from the inspector — per-keyframe easing now lives in the curve editor right-click menu) */
let DEFAULT_EASE='both';
function curEase(){ return DEFAULT_EASE; } // per-keyframe easing is edited in the curve right-click menu (the old #easeSel dropdown is gone)
const view=state.view;   // alias (cw/ch/cam/zoom/pan etc.)
/* [R92-T8] Premiere-style layout: video tracks grouped ON TOP, audio tracks grouped at the BOTTOM, split by a
   divider. Display-ONLY grouping — state.lanes (and every clip's lane INDEX) is untouched, so compositing/save/undo
   are unaffected. Within each group the previous top-first order is preserved. reverse(grouped) still reconstructs
   a valid array (all-audio-then-all-video), so the track-reorder drag keeps working with a same-group clamp. */
const lanesTopDown = ()=>{ const rev=state.lanes.map((l,i)=>i).reverse();
  return [...rev.filter(i=>state.lanes[i]&&state.lanes[i].kind!=='audio'), ...rev.filter(i=>state.lanes[i]&&state.lanes[i].kind==='audio')]; };
/* per-lane height + collapse (Ableton-style resizable/collapsible tracks) */
const LANE_DEF_H=82, LANE_MIN_H=34, LANE_MAX_H=260, LANE_COLLAPSED_H=20; // 82 → 4 video tracks fill the default 368px timeline exactly (track area 328 = 354 tlscroll − 26 ruler)
const AUDIO_LANE_H=Math.round(LANE_DEF_H/2); // [R110] audio tracks are a FIXED half-height (not resizable, not per-lane collapsible) — the module is exactly as tall as its tracks
function laneH(li){ const l=state.lanes[li]; if(!l)return LANE_DEF_H; if(l.kind==='audio')return AUDIO_LANE_H; if(l.collapsed)return LANE_COLLAPSED_H; return Math.max(LANE_MIN_H,Math.min(LANE_MAX_H,l.h||LANE_DEF_H)); }
function duration(){ let d=2; for(const c of state.clips) d=Math.max(d,c.start+c.dur); return d; }
function frameSnap(t){ const f=state.fps||30; return Math.max(0,Math.round(t*f)/f); } /* [T7] quantize a time to the project frame grid */
const TL_PPS_MIN=0.1, TL_PPS_MAX=2400; // [T2] timeline zoom range. Max raised 600→2400 so a frame is 40–80px wide at 24–30fps → the per-frame trim snap is clearly visible
function clipById(id){ return state.clips.find(c=>c.id===id); }
function mediaById(id){ return state.media.find(m=>m.id===id); }
function selClip(){ return clipById(state.selId); }

/* ===================== WEBGL ENGINE ===================== */
const glc=$('#gl'), gridc=$('#grid'), gx=gridc.getContext('2d');
const gl=glc.getContext('webgl2',{premultipliedAlpha:false,alpha:true,antialias:false,preserveDrawingBuffer:true,powerPreference:'high-performance'}); // [R92-T3] antialias off: everything composites in non-MSAA FBOs and blits — canvas MSAA only cost bandwidth
if(!gl){ document.body.innerHTML='<div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:var(--s0);color:var(--ink);font:14px/1.6 Inter,sans-serif;text-align:center;padding:40px;">WebGL2 is not available on this system.<br>Update your GPU drivers, or set this app to use the High-performance GPU.<br><span style="color:var(--ink-2);">WebGL2 no está disponible. Actualiza los controladores de la GPU o asigna la GPU de alto rendimiento a esta app.</span></div>'; throw new Error('WebGL2 unavailable'); }
/* ===================== DIAGNOSTICS LOG (full session capture for testing) ===================== */
const DIAG={buf:[],max:30000,seq:0,writtenSeq:0,path:null,dirty:false,t0:(window.performance&&performance.now)?performance.now():0};
function diag(level,tag,msg,extra){ try{ const ms=Math.round(((window.performance&&performance.now)?performance.now():0)-DIAG.t0); const e={i:++DIAG.seq,ms,level:level||'info',tag:tag||'',msg:(msg==null?'':String(msg)).slice(0,500)}; if(extra!==undefined){ try{e.x=JSON.parse(JSON.stringify(extra));}catch(_){e.x=String(extra).slice(0,300);} } DIAG.buf.push(e); if(DIAG.buf.length>DIAG.max)DIAG.buf.splice(0,DIAG.buf.length-DIAG.max); DIAG.dirty=true; }catch(_){} }
function diagLine(e){ return '['+String(Math.floor(e.ms/1000)).padStart(6,' ')+'.'+String(e.ms%1000).padStart(3,'0')+'] '+(e.level||'info').toUpperCase().padEnd(5)+' '+(e.tag||'')+' · '+e.msg+(e.x!==undefined?'  '+JSON.stringify(e.x):''); }
function diagText(){ return DIAG.buf.map(diagLine).join('\n'); }
async function diagFlush(){ const d=window.dsp; if(!d||!d.isElectron||!d.diagWrite){ DIAG.dirty=false; return; } const lines=DIAG.buf.filter(e=>e.i>DIAG.writtenSeq); if(!lines.length){ DIAG.dirty=false; return; } const last=lines[lines.length-1].i; const text=lines.map(diagLine).join('\n')+'\n'; try{ const p=await d.diagWrite(text,!DIAG.path); if(p){ DIAG.path=p; DIAG.writtenSeq=last; DIAG.dirty=false; } }catch(_){} }
function glCheck(tag){ try{ const er=gl.getError(); if(er&&er!==gl.NO_ERROR){ const nm={}; nm[gl.INVALID_ENUM]='INVALID_ENUM'; nm[gl.INVALID_VALUE]='INVALID_VALUE'; nm[gl.INVALID_OPERATION]='INVALID_OPERATION'; nm[gl.OUT_OF_MEMORY]='OUT_OF_MEMORY'; nm[gl.INVALID_FRAMEBUFFER_OPERATION]='INVALID_FB_OP'; diag('error','gl',(nm[er]||('0x'+er.toString(16)))+(tag?(' @ '+tag):'')); } }catch(_){} }
window.addEventListener('error',ev=>{ try{ diag('error','window',ev.message||'error',{src:(ev.filename||'').split(/[\\/]/).pop(),line:ev.lineno,stack:ev.error&&ev.error.stack?String(ev.error.stack).split('\n').slice(0,3).join(' | '):undefined}); diagFlush(); }catch(_){} });
window.addEventListener('unhandledrejection',ev=>{ try{ const r=ev.reason; diag('error','promise',(r&&r.message)||String(r),{stack:r&&r.stack?String(r.stack).split('\n').slice(0,3).join(' | '):undefined}); diagFlush(); }catch(_){} });
(function(){ ['warn','error'].forEach(k=>{ const o=console[k]?console[k].bind(console):function(){}; console[k]=function(){ try{ diag(k==='warn'?'warn':'error','console',[].map.call(arguments,x=>(x&&x.message)?x.message:(typeof x==='object'?(()=>{try{return JSON.stringify(x);}catch(_){return String(x);}})():String(x))).join(' ')); }catch(_){} return o.apply(console,arguments); }; });
  const oa=window.alert?window.alert.bind(window):null; window.alert=function(m){ try{ diag('error','alert',m); diagFlush(); }catch(_){} if(oa)return oa(m); }; })();
async function saveDiagLog(){ const text='Dome Studio Pro — diagnostics log\n'+diagText()+'\n'; const fn='dome-diagnostics.txt';
  try{ const d=window.dsp; if(d&&d.isElectron&&d.saveFile){ const p=await d.saveFile(fn,'txt','Text log'); if(p){ await d.writeText(p,text); flashStatus(T('Diagnostics log saved','Registro de diagnóstico guardado')); } } else { dlBlob(new Blob([text],{type:'text/plain'}),fn); } }catch(e){ try{flashStatus(T('Could not save the log','No se pudo guardar el registro'),'err');}catch(_){} } } // [R94-UT3·U-21]
let glLost=false, _glLostReload=0;
glc.addEventListener('webglcontextlost',e=>{ e.preventDefault(); glLost=true; try{cancelExport=true;}catch(_){ } try{if(state&&state.playing)pause();}catch(_){ } try{localStorage.setItem('domeProPro',JSON.stringify(serProject()));}catch(_){ } try{clearTimeout(_glLostReload);}catch(_){ } _glLostReload=setTimeout(()=>{ try{window.onbeforeunload=null;}catch(_){ } location.reload(); },1800); /* fallback: a real GPU reset often never fires 'restored' */ alert(T('Graphics context was lost (GPU reset). The app will reload to recover — your work was just autosaved; restore it from ⌘K (Restore autosave).','Se perdió el contexto gráfico (reinicio de GPU). La app se recargará para recuperarse — tu trabajo se acaba de autoguardar; restáuralo desde ⌘K (Restaurar autoguardado).')); });
glc.addEventListener('webglcontextrestored',()=>{ glLost=false; try{clearTimeout(_glLostReload);}catch(_){ } location.reload(); });
function sh(t,s){const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw gl.getShaderInfoLog(o);return o;}
function prog(v,f){const p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,v));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,f));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw gl.getProgramInfoLog(p);return p;}

/* warp: element (spherical cap, gnomonic) -> 2D master (azimuthal-equidistant, design contract) */
const VSW=`#version 300 es
precision highp float; in vec2 a_flat; in vec2 a_uv;
uniform vec3 u_d,u_u,u_v; uniform vec2 u_half; uniform float u_mir;
uniform float u_sector,u_azC,u_azSpan,u_elC,u_elSpan; // dome-tile (annular sector) mode
uniform float u_covHalf; // dome coverage half-angle in radians (π/2 = 180° fulldome); content radius rho = zenith / u_covHalf
uniform float u_flat; uniform vec2 u_fc,u_fx,u_fy; // FLAT (2D) mode: place a rotated rect at u_fc with half-axes u_fx,u_fy (uniform scale → no skew)
out vec2 v_uv; out vec2 v_flat; out float v_below;
const float HP=1.5707963267948966;
void main(){
  vec2 ndc;
  if(u_flat>0.5){ ndc = u_fc + a_flat.x*u_mir*u_fx + a_flat.y*u_fy; v_below=1.0; }
  else if(u_sector>0.5){ // annular sector: a_flat.x→azimuth span, a_flat.y→elevation band → tiles the dome's az/el grid seamlessly
    float az=u_azC + a_flat.x*0.5*u_azSpan*u_mir;
    float el=u_elC + a_flat.y*0.5*u_elSpan;
    v_below=sin(el);
    float rho=max(0.0,(HP-el)/u_covHalf); // clamp at the zenith so the top ring caps to the centre point (no flip past 90°); coverage scales where the horizon lands
    ndc=vec2(rho*sin(az), -rho*cos(az));
  } else { // gnomonic tangent patch (a flat window placed at the dome direction)
    vec3 ray=normalize(u_d + tan(u_half.x*a_flat.x)*(u_u*u_mir) + tan(u_half.y*a_flat.y)*u_v);
    v_below=ray.z;
    float zen=acos(clamp(ray.z,-1.0,1.0)); float rho=zen/u_covHalf;
    float h=atan(ray.y, ray.x);
    ndc=vec2(rho*sin(h), -rho*cos(h));
  }
  v_uv=a_uv; v_flat=a_flat; gl_Position=vec4(ndc,0.0,1.0);
}`;
const FSW=`#version 300 es
precision highp float; in vec2 v_uv; in vec2 v_flat; in float v_below;
uniform sampler2D u_tex; uniform sampler2D u_maskTex; uniform vec2 u_half; uniform float u_op,u_cull,u_blur,u_feather,u_crop,u_mask,u_exp,u_con,u_sat,u_tmp,u_tnt,u_glow,u_ca,u_premul,u_blend,u_tile,u_maskScale;
uniform highp sampler3D u_lut; uniform float u_hasLut,u_lutMix; // R116: creative 3D LUT (.cube) — trilinear via a 3D texture
uniform vec3 u_lift,u_gamma,u_gain; // R130: lift/gamma/gain color wheels (primary grade). Neutral: lift=0, gain=1, gamma=1 → identity
uniform sampler2D u_curve; uniform float u_hasCurve; // R132: tone curves — 256×1 LUT, RGBA = R/G/B/luma curves (identity when u_hasCurve=0)
out vec4 o;
void main(){
  if(u_cull>0.5 && v_below<-0.0015) discard;
  vec2 uv=(v_uv-0.5)/max(1.0-u_crop,0.02)+0.5;
  if(uv.x<0.0||uv.x>1.0||uv.y<0.0||uv.y>1.0){ discard; } // out-of-crop: discard (neutral for every blend; was o=vec4(0) which blackened darken/MIN)
  vec4 c;
  if(u_blur>0.0005){ vec3 acc=vec3(0.0); float ws=0.0;
    for(int i=-2;i<=2;i++)for(int j=-2;j<=2;j++){ vec2 tuv=uv+vec2(float(i),float(j))*u_blur; float inb=step(0.0,tuv.x)*step(tuv.x,1.0)*step(0.0,tuv.y)*step(tuv.y,1.0); vec4 s=texture(u_tex,tuv); acc+=s.rgb*s.a*inb; ws+=s.a*inb; } // skip taps outside the (cropped) source → no clamped-edge smear/halo
    vec4 s0=texture(u_tex,uv); c=vec4(ws>0.0?acc/ws:s0.rgb, s0.a); }
  else c=texture(u_tex,uv);
  if(u_ca>0.001){ vec2 cad=(uv-0.5); float caa=u_ca*0.004; c.r=texture(u_tex,uv+cad*caa).r; c.b=texture(u_tex,uv-cad*caa).b; } // chromatic aberration (radial)
  float a=c.a; float fe=max(u_feather,0.001);
  // mask coordinate: aspect-corrected so 'circle' is a TRUE circle (not stretched to the clip's 16:9), and
  // scalable via u_maskScale (resize the mask). Annular-sector tiles (u_tile) skip both correction and the edge feather so they abut seamlessly.
  vec2 mc=v_flat; float amin=min(u_half.x,u_half.y);
  if(u_tile<0.5 && amin>0.0001) mc=v_flat*(u_half/amin); // inscribe in the short angular edge → perfect circle regardless of clip aspect
  mc/=max(u_maskScale,0.02);
  if(u_mask<0.5){ if(u_tile<0.5) a*=min(smoothstep(1.0,1.0-fe,abs(v_flat.x)),smoothstep(1.0,1.0-fe,abs(v_flat.y))); }
  else if(u_mask<1.5){ a*=smoothstep(1.0,1.0-fe,length(mc)); }
  else if(u_mask<2.5){ vec2 q=abs(mc)-0.55; float r=length(max(q,0.0))+min(max(q.x,q.y),0.0)-0.42; a*=smoothstep(0.04,-fe,r); }
  else if(u_mask<3.5){ a*=smoothstep(1.0,1.0-fe,abs(mc.x)+abs(mc.y)); }
  else if(u_mask<4.5){ a*=smoothstep(1.0,0.25,length(mc)); }
  else { vec4 ms=texture(u_maskTex, v_flat*0.5+0.5); a*= (ms.a<0.999? ms.a : dot(ms.rgb,vec3(0.3333))); }
  vec3 col=c.rgb;
  col*=exp2(u_exp);                                   // exposure (stops)
  col=(col-0.5)*(1.0+u_con)+0.5;                       // contrast
  float L=dot(col,vec3(0.2126,0.7152,0.0722)); col=mix(vec3(L),col,1.0+u_sat); // saturation
  col*=vec3(1.0+u_tmp,1.0,1.0-u_tmp); col*=vec3(1.0-u_tnt*0.5,1.0+u_tnt,1.0-u_tnt*0.5); // temp / tint as a white-balance GAIN (neutral at 0; no additive highlight crush)
  col=pow(max(u_gain*col+u_lift,0.0), u_gamma); // R130: lift/gamma/gain primary grade (gain=highlights ×, lift=shadows +, gamma=midtone power), before glow/LUT
  if(u_glow>0.001){ vec3 gw=vec3(0.0); for(int gi=-2;gi<=2;gi++)for(int gj=-2;gj<=2;gj++){ vec2 guv=uv+vec2(float(gi),float(gj))*0.004; float inb=step(0.0,guv.x)*step(guv.x,1.0)*step(0.0,guv.y)*step(guv.y,1.0); gw+=max(texture(u_tex,guv).rgb-0.55,0.0)*inb; } col+=gw*(u_glow*0.05); } // glow / bloom (bright halo), taps clamped to the source bounds
  col=clamp(col,0.0,1.0);
  if(u_hasCurve>0.5){ // R132: per-channel RGB tone curves, then a master/luma curve (channel A) applied to each
    col.r=texture(u_curve,vec2(col.r,0.5)).r; col.g=texture(u_curve,vec2(col.g,0.5)).g; col.b=texture(u_curve,vec2(col.b,0.5)).b;
    col=vec3(texture(u_curve,vec2(col.r,0.5)).a, texture(u_curve,vec2(col.g,0.5)).a, texture(u_curve,vec2(col.b,0.5)).a); }
  if(u_hasLut>0.5){ col=mix(col, texture(u_lut, col).rgb, u_lutMix); } // creative LUT as the final look transform (trilinear-sampled 3D texture)
  float dz=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453); col+=(dz-0.5)/255.0; // dither (anti-banding)
  float ef=a*u_op; // effective coverage = masked alpha × opacity × fade
  if(u_blend>1.5){ o=vec4(mix(vec3(0.0),col,ef), 0.0); }        // lighten (MAX): neutral 0 where uncovered → dst unchanged
  else if(u_blend>0.5){ o=vec4(mix(vec3(1.0),col,ef), 1.0); }   // darken (MIN): neutral 1 where uncovered → dst unchanged
  else { o=vec4(mix(col,col*ef,u_premul), ef); }                // normal/add (premul 0) + screen/multiply (premul 1, RGB now weighted by mask×op too)
}`;
const PW=prog(VSW,FSW);
const LW={flat:gl.getAttribLocation(PW,'a_flat'),uv:gl.getAttribLocation(PW,'a_uv'),
  d:gl.getUniformLocation(PW,'u_d'),u:gl.getUniformLocation(PW,'u_u'),v:gl.getUniformLocation(PW,'u_v'),
  half:gl.getUniformLocation(PW,'u_half'),mir:gl.getUniformLocation(PW,'u_mir'),tex:gl.getUniformLocation(PW,'u_tex'),op:gl.getUniformLocation(PW,'u_op'),cull:gl.getUniformLocation(PW,'u_cull'),
  sector:gl.getUniformLocation(PW,'u_sector'),azC:gl.getUniformLocation(PW,'u_azC'),azSpan:gl.getUniformLocation(PW,'u_azSpan'),elC:gl.getUniformLocation(PW,'u_elC'),elSpan:gl.getUniformLocation(PW,'u_elSpan'),covHalf:gl.getUniformLocation(PW,'u_covHalf'),
  fmode:gl.getUniformLocation(PW,'u_flat'),fc:gl.getUniformLocation(PW,'u_fc'),fx:gl.getUniformLocation(PW,'u_fx'),fy:gl.getUniformLocation(PW,'u_fy'),
  blur:gl.getUniformLocation(PW,'u_blur'),feather:gl.getUniformLocation(PW,'u_feather'),crop:gl.getUniformLocation(PW,'u_crop'),mask:gl.getUniformLocation(PW,'u_mask'),exp:gl.getUniformLocation(PW,'u_exp'),con:gl.getUniformLocation(PW,'u_con'),sat:gl.getUniformLocation(PW,'u_sat'),tmp:gl.getUniformLocation(PW,'u_tmp'),tnt:gl.getUniformLocation(PW,'u_tnt'),glow:gl.getUniformLocation(PW,'u_glow'),ca:gl.getUniformLocation(PW,'u_ca'),premul:gl.getUniformLocation(PW,'u_premul'),blend:gl.getUniformLocation(PW,'u_blend'),maskTex:gl.getUniformLocation(PW,'u_maskTex'),tile:gl.getUniformLocation(PW,'u_tile'),maskScale:gl.getUniformLocation(PW,'u_maskScale'),lut:gl.getUniformLocation(PW,'u_lut'),hasLut:gl.getUniformLocation(PW,'u_hasLut'),lutMix:gl.getUniformLocation(PW,'u_lutMix'),
  lift:gl.getUniformLocation(PW,'u_lift'),gamma:gl.getUniformLocation(PW,'u_gamma'),gain:gl.getUniformLocation(PW,'u_gain'),
  curve:gl.getUniformLocation(PW,'u_curve'),hasCurve:gl.getUniformLocation(PW,'u_hasCurve')};
const BLEND_ID={normal:0,add:0,screen:0,multiply:0,darken:1,lighten:2}; // u_blend: 0=premul path, 1=darken(MIN-neutral white), 2=lighten(MAX-neutral black)
const MASK_IDX={none:0,circle:1,rounded:2,diamond:3,vignette:4,custom:5,pen:5}; // [I3] pen (point) masks rasterize into c.maskTex and reuse the custom sampler branch (index 5) — no shader change
gl.useProgram(PW); gl.uniform1f(LW.covHalf, HALF_PI); // safe default (180° fulldome) so a never-set uniform is never 0 → no divide-by-zero in the flat path
/* R116 · creative 3D LUT (.cube): a registry of GL 3D textures keyed by file path, an identity default so the
   sampler3D is always valid, a .cube parser, and per-clip {props.lut = path, props.lutMix = 0..100}. */
const _lutReg=new Map(); let _lutIdentity=null;
function makeLutTex(data,size){ const tex=gl.createTexture(); gl.bindTexture(gl.TEXTURE_3D,tex);
  gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_WRAP_R,gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false); gl.pixelStorei(gl.UNPACK_ALIGNMENT,1); // the app leaves FLIP_Y on for 2D image uploads; texImage3D with FLIP_Y=true is INVALID_OPERATION → the LUT would be empty (black)
  gl.texImage3D(gl.TEXTURE_3D,0,gl.RGBA8,size,size,size,0,gl.RGBA,gl.UNSIGNED_BYTE,data);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true); gl.pixelStorei(gl.UNPACK_ALIGNMENT,4); gl.bindTexture(gl.TEXTURE_3D,null); return tex; } // restore the app's prevailing 2D-upload defaults
(function(){ const N=2,d=new Uint8Array(N*N*N*4); let p=0; for(let b=0;b<N;b++)for(let g=0;g<N;g++)for(let r=0;r<N;r++){ d[p++]=r*255; d[p++]=g*255; d[p++]=b*255; d[p++]=255; } _lutIdentity=makeLutTex(d,N); })();
function parseCubeLUT(text){ let size=0; const vals=[];
  for(let line of text.split(/\r?\n/)){ line=line.trim(); if(!line||line[0]==='#')continue; const up=line.toUpperCase();
    if(up.startsWith('LUT_3D_SIZE')){ size=parseInt(line.split(/\s+/)[1],10)||0; continue; }
    if(up.startsWith('LUT_1D_SIZE'))return null; // 1D LUTs unsupported
    if(up.startsWith('TITLE')||up.startsWith('DOMAIN_')||up.startsWith('LUT_3D_INPUT'))continue;
    const p=line.split(/\s+/); if(p.length>=3){ const r=parseFloat(p[0]),g=parseFloat(p[1]),b=parseFloat(p[2]); if(!isNaN(r)&&!isNaN(g)&&!isNaN(b))vals.push(r,g,b); } }
  if(!size||vals.length!==size*size*size*3)return null;
  const d=new Uint8Array(size*size*size*4); // .cube order = R fastest → matches texImage3D (x=r fastest)
  for(let i=0,j=0;i<size*size*size;i++){ for(let k=0;k<3;k++)d[j++]=Math.max(0,Math.min(255,Math.round(vals[i*3+k]*255))); d[j++]=255; }
  return {size,data:d}; }
async function loadLUT(path){ if(!path)return null; if(_lutReg.has(path))return _lutReg.get(path); if(!(IS_ELEC&&DSP.readText))return null;
  let txt=null; try{ txt=await DSP.readText(path); }catch(e){} if(txt==null)return null;
  const parsed=parseCubeLUT(txt); if(!parsed)return null;
  const name=path.split(/[\\/]/).pop().replace(/\.cube$/i,''); const rec={tex:makeLutTex(parsed.data,parsed.size),size:parsed.size,name,path}; _lutReg.set(path,rec); return rec; }
function bindClipLUT(c,L){ L=L||LW; const rec=(c&&c.props&&c.props.lut)?_lutReg.get(c.props.lut):null; // set the LUT uniforms + bind on unit 2 (identity when none, so the sampler stays valid). L = target program's uniform struct (LW warp / LFD fulldome / LEQ equirect) → same grade chain on every dome path
  gl.uniform1f(L.hasLut, rec?1:0); gl.uniform1f(L.lutMix, rec?Math.max(0,Math.min(1,(c.props.lutMix==null?100:c.props.lutMix)/100)):0);
  gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_3D, rec?rec.tex:_lutIdentity); gl.uniform1i(L.lut,2); gl.activeTexture(gl.TEXTURE0);
  bindClipGrade(c,L); } // R130: lift/gamma/gain wheels share the color-set call
/* R130 · lift/gamma/gain color wheels. Per clip: props.cgLift/cgGamma/cgGain = [handleX, handleY, master] each in -1..1
   (handle = color balance on a DaVinci-layout wheel: R top, G lower-left, B lower-right; master = luminance offset). */
const _Z3=[0,0,0];
function wheelRGB(a,k){ const x=(a&&a[0])||0, y=(a&&a[1])||0, m=(a&&a[2])||0; // handle→per-channel offset + luminance master
  return [ y*k+m, (-0.5*y-0.8660*x)*k+m, (-0.5*y+0.8660*x)*k+m ]; }
function bindClipGrade(c,L){ L=L||LW; const p=(c&&c.props)||{};
  const lf=wheelRGB(p.cgLift||_Z3, 0.4);   // lift: additive shadow push (±0.4 balance + master)
  const gn=wheelRGB(p.cgGain||_Z3, 0.5);   // gain: multiplicative highlight (1 + ±0.5)
  const gm=wheelRGB(p.cgGamma||_Z3, 0.5);  // gamma: midtone power (exp = 1 - push, brighter mids when push>0)
  gl.uniform3f(L.lift, lf[0], lf[1], lf[2]);
  gl.uniform3f(L.gain, 1+gn[0], 1+gn[1], 1+gn[2]);
  gl.uniform3f(L.gamma, Math.max(0.1,1-gm[0]), Math.max(0.1,1-gm[1]), Math.max(0.1,1-gm[2]));
  bindClipCurve(c,L); } // R132: tone curves share the color-set call

/* R132 · tone curves. Per clip: props.curves = {l,r,g,b}, each an array of [x,y] control points in 0..1
   (default identity [[0,0],[1,1]]). Built into a 256×1 RGBA texture (R/G/B curves + luma in A), sampled in FSW. */
let _curveIdentity=null;
function makeCurveTex(){ const t=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,t);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  return t; }
function evalCurve(pts,x){ if(!pts||pts.length<2)return x; // sorted by x, linear interpolation, flat outside the endpoints
  if(x<=pts[0][0])return pts[0][1];
  for(let i=1;i<pts.length;i++){ if(x<=pts[i][0]){ const a=pts[i-1],b=pts[i]; const t=(x-a[0])/((b[0]-a[0])||1e-6); return a[1]+(b[1]-a[1])*t; } }
  return pts[pts.length-1][1]; }
function curveIsIdentity(cv){ if(!cv)return true; for(const k of ['l','r','g','b']){ const p=cv[k]; if(p&&!(p.length===2&&p[0][0]===0&&p[0][1]===0&&p[1][0]===1&&p[1][1]===1))return false; } return true; }
function buildCurveData(cv){ const d=new Uint8Array(256*4); const L=cv&&cv.l, R=cv&&cv.r, G=cv&&cv.g, B=cv&&cv.b;
  for(let i=0;i<256;i++){ const x=i/255; const cl=v=>Math.max(0,Math.min(255,Math.round(v*255)));
    d[i*4]=cl(evalCurve(R,x)); d[i*4+1]=cl(evalCurve(G,x)); d[i*4+2]=cl(evalCurve(B,x)); d[i*4+3]=cl(evalCurve(L,x)); }
  return d; }
function uploadCurveTex(tex,data){ gl.bindTexture(gl.TEXTURE_2D,tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false); gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,256,1,0,gl.RGBA,gl.UNSIGNED_BYTE,data);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true); gl.pixelStorei(gl.UNPACK_ALIGNMENT,4); gl.bindTexture(gl.TEXTURE_2D,null); } // restore the app's 2D-upload defaults
(function(){ const d=new Uint8Array(256*4); for(let i=0;i<256;i++){ d[i*4]=d[i*4+1]=d[i*4+2]=d[i*4+3]=i; } _curveIdentity=makeCurveTex(); uploadCurveTex(_curveIdentity,d); })();
function clipCurveTex(c){ const cv=c&&c.props&&c.props.curves; if(curveIsIdentity(cv))return null; // identity → no curve
  if(!c._curveTex)c._curveTex=makeCurveTex();
  if(c._curveDirty!==false){ uploadCurveTex(c._curveTex,buildCurveData(cv)); c._curveDirty=false; }
  return c._curveTex; }
function markCurveDirty(c){ if(c)c._curveDirty=true; }
function bindClipCurve(c,L){ L=L||LW; const tex=clipCurveTex(c); gl.uniform1f(L.hasCurve, tex?1:0);
  gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, tex||_curveIdentity); gl.uniform1i(L.curve,3); gl.activeTexture(gl.TEXTURE0); }
function preloadLUTs(){ const paths=new Set(); const scan=cs=>{ for(const c of (cs||[]))if(c&&c.props&&c.props.lut)paths.add(c.props.lut); }; // re-load LUTs referenced by a just-opened project so the look appears without a manual reload
  scan(state.clips); for(const m of state.media)if(isSeqMedia(m)){ scan(m.nestClips); if(m.grade&&m.grade.lut)paths.add(m.grade.lut); } // [master grade] also reload per-sequence master LUTs
  if(state.seqGrade&&state.seqGrade.lut)paths.add(state.seqGrade.lut);
  if(!paths.size)return; Promise.all([...paths].map(p=>loadLUT(p))).then(()=>{ try{ if(_raOn)raInvalidate(); render(); }catch(e){} }); }
const N=120, meshVAO=gl.createVertexArray(); gl.bindVertexArray(meshVAO); let meshCount=0;
(()=>{const vv=[],ix=[];for(let j=0;j<=N;j++)for(let i=0;i<=N;i++)vv.push((i/N)*2-1,(j/N)*2-1,i/N,j/N);
 const W=N+1;for(let j=0;j<N;j++)for(let i=0;i<N;i++){const a=j*W+i,b=a+1,c=a+W,d=c+1;ix.push(a,b,c,b,d,c);}
 const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vv),gl.STATIC_DRAW);
 gl.enableVertexAttribArray(LW.flat);gl.vertexAttribPointer(LW.flat,2,gl.FLOAT,false,16,0);
 gl.enableVertexAttribArray(LW.uv);gl.vertexAttribPointer(LW.uv,2,gl.FLOAT,false,16,8);
 const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(ix),gl.STATIC_DRAW);meshCount=ix.length;})();
gl.bindVertexArray(null);

/* blit master -> screen with pan/zoom */
const VSB=`#version 300 es
precision highp float; in vec2 a_p; uniform vec2 u_pan; uniform float u_zoom; uniform vec2 u_aspect; uniform vec2 u_uvsc,u_uvof; out vec2 v_uv; out vec2 v_p;
void main(){ vec2 sc=(u_uvsc.x<0.0001&&u_uvsc.y<0.0001)?vec2(1.0):u_uvsc; v_uv=vec2(a_p.x*0.5+0.5,a_p.y*0.5+0.5)*sc+u_uvof; v_p=a_p; gl_Position=vec4((a_p-u_pan)*u_zoom*u_aspect,0.0,1.0); }`;
const FSB=`#version 300 es
precision highp float; in vec2 v_uv; in vec2 v_p; uniform sampler2D u_tex; uniform float u_hfade,u_flat; out vec4 o;
void main(){ float r=length(v_p); if(u_flat<0.5 && r>1.0) discard; o=texture(u_tex,v_uv);
  if(u_hfade>0.0){ float f=smoothstep(1.0, 1.0-u_hfade, r); o.rgb*=f; o.a*=f; } }`; // u_flat: skip the dome disc clip so the flat rect shows fully; horizon fade softens the dome spring line
const PB=prog(VSB,FSB);
const LB={p:gl.getAttribLocation(PB,'a_p'),pan:gl.getUniformLocation(PB,'u_pan'),zoom:gl.getUniformLocation(PB,'u_zoom'),aspect:gl.getUniformLocation(PB,'u_aspect'),tex:gl.getUniformLocation(PB,'u_tex'),hfade:gl.getUniformLocation(PB,'u_hfade'),flat:gl.getUniformLocation(PB,'u_flat'),uvsc:gl.getUniformLocation(PB,'u_uvsc'),uvof:gl.getUniformLocation(PB,'u_uvof')};
const HFADE=0.14; // horizon-fade band (fraction of the dome radius) when enabled
const quadVAO=gl.createVertexArray(); gl.bindVertexArray(quadVAO);
(()=>{const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,-1,1,1,-1,1]),gl.STATIC_DRAW);gl.enableVertexAttribArray(LB.p);gl.vertexAttribPointer(LB.p,2,gl.FLOAT,false,0,0);})();
gl.bindVertexArray(null);
/* fulldome source: clip texture is already a fisheye/dome master → drawn 1:1 into the composite (no gnomonic patch warp) */
const VSFD=`#version 300 es
in vec2 a_p; uniform float u_mir,u_spin,u_scale; out vec2 v_uv; out vec2 v_p;
void main(){ v_p=a_p; float s=sin(u_spin),c=cos(u_spin); vec2 pr=vec2(a_p.x*c-a_p.y*s, a_p.x*s+a_p.y*c); pr/=max(u_scale,0.05); v_uv=vec2((pr.x*u_mir)*0.5+0.5, pr.y*0.5+0.5); gl_Position=vec4(a_p,0.0,1.0); }`; // [N1] u_scale zooms the fulldome content (scale>1 = bigger); the disc clip stays via v_p=a_p
const FSFD=`#version 300 es
precision highp float; in vec2 v_uv; in vec2 v_p; uniform sampler2D u_tex; uniform sampler2D u_maskTex; uniform float u_op,u_exp,u_con,u_sat,u_tmp,u_tnt,u_premul,u_mask,u_feather,u_blend,u_maskScale;
uniform highp sampler3D u_lut; uniform float u_hasLut,u_lutMix; uniform vec3 u_lift,u_gamma,u_gain; uniform sampler2D u_curve; uniform float u_hasCurve; // [grade gap] wheels/curves/LUT parity with FSW
out vec4 o;
void main(){ if(length(v_p)>1.0) discard; if(v_uv.x<0.0||v_uv.x>1.0||v_uv.y<0.0||v_uv.y>1.0) discard; vec4 c=texture(u_tex,v_uv); vec3 col=c.rgb; // [N1] zoom-out (scale<1) samples outside the source → discard for a clean transparent border instead of edge smear
  col*=exp2(u_exp); col=(col-0.5)*(1.0+u_con)+0.5; float L=dot(col,vec3(0.2126,0.7152,0.0722)); col=mix(vec3(L),col,1.0+u_sat); col*=vec3(1.0+u_tmp,1.0,1.0-u_tmp); col*=vec3(1.0-u_tnt*0.5,1.0+u_tnt,1.0-u_tnt*0.5);
  col=pow(max(u_gain*col+u_lift,0.0), u_gamma); col=clamp(col,0.0,1.0);                 // R130 lift/gamma/gain primary grade
  if(u_hasCurve>0.5){ col.r=texture(u_curve,vec2(col.r,0.5)).r; col.g=texture(u_curve,vec2(col.g,0.5)).g; col.b=texture(u_curve,vec2(col.b,0.5)).b; col=vec3(texture(u_curve,vec2(col.r,0.5)).a, texture(u_curve,vec2(col.g,0.5)).a, texture(u_curve,vec2(col.b,0.5)).a); } // R132 tone curves
  if(u_hasLut>0.5){ col=mix(col, texture(u_lut, col).rgb, u_lutMix); }                    // R116 creative 3D LUT
  float dz=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453); col+=(dz-0.5)/255.0;
  float a=c.a; float fe=max(u_feather,0.001); vec2 p=v_p/max(u_maskScale,0.02); // mask shapes use the dome-disc coordinate (scalable)
  if(u_mask<0.5){} else if(u_mask<1.5){ a*=smoothstep(1.0,1.0-fe,length(p)); }
  else if(u_mask<2.5){ vec2 q=abs(p)-0.55; float r=length(max(q,0.0))+min(max(q.x,q.y),0.0)-0.42; a*=smoothstep(0.04,-fe,r); }
  else if(u_mask<3.5){ a*=smoothstep(1.0,1.0-fe,abs(p.x)+abs(p.y)); }
  else if(u_mask<4.5){ a*=smoothstep(1.0,0.25,length(p)); }
  else { vec4 ms=texture(u_maskTex, p*0.5+0.5); a*=(ms.a<0.999?ms.a:dot(ms.rgb,vec3(0.3333))); }
  float ef=a*u_op;
  if(u_blend>1.5){ o=vec4(mix(vec3(0.0),col,ef),0.0); }
  else if(u_blend>0.5){ o=vec4(mix(vec3(1.0),col,ef),1.0); }
  else { o=vec4(mix(col,col*ef,u_premul), ef); } }`;
const PFD=prog(VSFD,FSFD);
const LFD={p:gl.getAttribLocation(PFD,'a_p'),mir:gl.getUniformLocation(PFD,'u_mir'),spin:gl.getUniformLocation(PFD,'u_spin'),tex:gl.getUniformLocation(PFD,'u_tex'),op:gl.getUniformLocation(PFD,'u_op'),exp:gl.getUniformLocation(PFD,'u_exp'),con:gl.getUniformLocation(PFD,'u_con'),sat:gl.getUniformLocation(PFD,'u_sat'),tmp:gl.getUniformLocation(PFD,'u_tmp'),tnt:gl.getUniformLocation(PFD,'u_tnt'),premul:gl.getUniformLocation(PFD,'u_premul'),mask:gl.getUniformLocation(PFD,'u_mask'),feather:gl.getUniformLocation(PFD,'u_feather'),blend:gl.getUniformLocation(PFD,'u_blend'),maskTex:gl.getUniformLocation(PFD,'u_maskTex'),maskScale:gl.getUniformLocation(PFD,'u_maskScale'),scale:gl.getUniformLocation(PFD,'u_scale'),
  lut:gl.getUniformLocation(PFD,'u_lut'),hasLut:gl.getUniformLocation(PFD,'u_hasLut'),lutMix:gl.getUniformLocation(PFD,'u_lutMix'),lift:gl.getUniformLocation(PFD,'u_lift'),gamma:gl.getUniformLocation(PFD,'u_gamma'),gain:gl.getUniformLocation(PFD,'u_gain'),curve:gl.getUniformLocation(PFD,'u_curve'),hasCurve:gl.getUniformLocation(PFD,'u_hasCurve')}; // [grade gap] wheels/curves/LUT
const fdVAO=gl.createVertexArray(); gl.bindVertexArray(fdVAO);
(()=>{const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,-1,1,1,-1,1]),gl.STATIC_DRAW);gl.enableVertexAttribArray(LFD.p);gl.vertexAttribPointer(LFD.p,2,gl.FLOAT,false,0,0);})();
gl.bindVertexArray(null);
/* [F7] equirectangular (360°) source → dome master: for each disc pixel, reconstruct the view ray (rho→zenith, azimuth),
   rotate it by yaw/pitch (the "camera"), then sample the 2:1 equirect. Additive — a separate program, the core warp is untouched. */
const VSEQ=`#version 300 es
in vec2 a_p; out vec2 v_p; void main(){ v_p=a_p; gl_Position=vec4(a_p,0.0,1.0); }`;
const FSEQ=`#version 300 es
precision highp float; in vec2 v_p; uniform sampler2D u_tex; uniform sampler2D u_maskTex;
uniform float u_op,u_exp,u_con,u_sat,u_tmp,u_tnt,u_premul,u_mask,u_feather,u_blend,u_maskScale,u_covHalf,u_yaw,u_pitch,u_mir;
uniform highp sampler3D u_lut; uniform float u_hasLut,u_lutMix; uniform vec3 u_lift,u_gamma,u_gain; uniform sampler2D u_curve; uniform float u_hasCurve; // [grade gap] wheels/curves/LUT parity with FSW
out vec4 o;
void main(){ float rho=length(v_p); if(rho>1.0) discard;
  float zen=rho*u_covHalf; float h=atan(v_p.x*u_mir, -v_p.y);
  vec3 ray=vec3(sin(zen)*cos(h), sin(zen)*sin(h), cos(zen));
  float cy=cos(u_yaw), sy=sin(u_yaw); ray=vec3(ray.x*cy-ray.y*sy, ray.x*sy+ray.y*cy, ray.z);          // yaw around zenith
  float cp=cos(u_pitch), sp=sin(u_pitch); ray=vec3(ray.x, ray.y*cp-ray.z*sp, ray.y*sp+ray.z*cp);       // pitch (tilt)
  float az=atan(ray.y, ray.x); float lat=asin(clamp(ray.z,-1.0,1.0));
  vec2 uv=vec2(az*0.15915494+0.5, 0.5 - lat*0.31830989); // az/(2π)+0.5 , 0.5 − lat/π
  vec4 c=texture(u_tex, uv); vec3 col=c.rgb;
  col*=exp2(u_exp); col=(col-0.5)*(1.0+u_con)+0.5; float L=dot(col,vec3(0.2126,0.7152,0.0722)); col=mix(vec3(L),col,1.0+u_sat); col*=vec3(1.0+u_tmp,1.0,1.0-u_tmp); col*=vec3(1.0-u_tnt*0.5,1.0+u_tnt,1.0-u_tnt*0.5);
  col=pow(max(u_gain*col+u_lift,0.0), u_gamma); col=clamp(col,0.0,1.0);                 // R130 lift/gamma/gain
  if(u_hasCurve>0.5){ col.r=texture(u_curve,vec2(col.r,0.5)).r; col.g=texture(u_curve,vec2(col.g,0.5)).g; col.b=texture(u_curve,vec2(col.b,0.5)).b; col=vec3(texture(u_curve,vec2(col.r,0.5)).a, texture(u_curve,vec2(col.g,0.5)).a, texture(u_curve,vec2(col.b,0.5)).a); } // R132 curves
  if(u_hasLut>0.5){ col=mix(col, texture(u_lut, col).rgb, u_lutMix); }                    // R116 LUT
  float a=c.a; float fe=max(u_feather,0.001); vec2 p=v_p/max(u_maskScale,0.02);
  if(u_mask<0.5){} else if(u_mask<1.5){ a*=smoothstep(1.0,1.0-fe,length(p)); } else if(u_mask<2.5){ vec2 q=abs(p)-0.55; float r=length(max(q,0.0))+min(max(q.x,q.y),0.0)-0.42; a*=smoothstep(0.04,-fe,r); } else if(u_mask<3.5){ a*=smoothstep(1.0,1.0-fe,abs(p.x)+abs(p.y)); } else if(u_mask<4.5){ a*=smoothstep(1.0,0.25,length(p)); } else { vec4 ms=texture(u_maskTex, p*0.5+0.5); a*=(ms.a<0.999?ms.a:dot(ms.rgb,vec3(0.3333))); }
  float ef=a*u_op;
  if(u_blend>1.5){ o=vec4(mix(vec3(0.0),col,ef),0.0); } else if(u_blend>0.5){ o=vec4(mix(vec3(1.0),col,ef),1.0); } else { o=vec4(mix(col,col*ef,u_premul), ef); } }`;
const PEQ=prog(VSEQ,FSEQ);
const LEQ={p:gl.getAttribLocation(PEQ,'a_p'),tex:gl.getUniformLocation(PEQ,'u_tex'),maskTex:gl.getUniformLocation(PEQ,'u_maskTex'),op:gl.getUniformLocation(PEQ,'u_op'),exp:gl.getUniformLocation(PEQ,'u_exp'),con:gl.getUniformLocation(PEQ,'u_con'),sat:gl.getUniformLocation(PEQ,'u_sat'),tmp:gl.getUniformLocation(PEQ,'u_tmp'),tnt:gl.getUniformLocation(PEQ,'u_tnt'),premul:gl.getUniformLocation(PEQ,'u_premul'),mask:gl.getUniformLocation(PEQ,'u_mask'),feather:gl.getUniformLocation(PEQ,'u_feather'),blend:gl.getUniformLocation(PEQ,'u_blend'),maskScale:gl.getUniformLocation(PEQ,'u_maskScale'),covHalf:gl.getUniformLocation(PEQ,'u_covHalf'),yaw:gl.getUniformLocation(PEQ,'u_yaw'),pitch:gl.getUniformLocation(PEQ,'u_pitch'),mir:gl.getUniformLocation(PEQ,'u_mir'),
  lut:gl.getUniformLocation(PEQ,'u_lut'),hasLut:gl.getUniformLocation(PEQ,'u_hasLut'),lutMix:gl.getUniformLocation(PEQ,'u_lutMix'),lift:gl.getUniformLocation(PEQ,'u_lift'),gamma:gl.getUniformLocation(PEQ,'u_gamma'),gain:gl.getUniformLocation(PEQ,'u_gain'),curve:gl.getUniformLocation(PEQ,'u_curve'),hasCurve:gl.getUniformLocation(PEQ,'u_hasCurve')}; // [grade gap] wheels/curves/LUT
const eqVAO=gl.createVertexArray(); gl.bindVertexArray(eqVAO);
(()=>{const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,-1,1,1,-1,1]),gl.STATIC_DRAW);gl.enableVertexAttribArray(LEQ.p);gl.vertexAttribPointer(LEQ.p,2,gl.FLOAT,false,0,0);})();
gl.bindVertexArray(null);

/* 3D dome */
const VS3=`#version 300 es
precision highp float; in vec3 a_pos; in vec2 a_uv; uniform mat4 u_mvp; uniform float u_flipx; out vec2 v_uv; out vec3 v_pos;
void main(){ v_uv=a_uv; v_pos=a_pos; vec4 p=u_mvp*vec4(a_pos,1.0); p.x*=u_flipx; gl_Position=p; }`;
const FS3=`#version 300 es
precision highp float; in vec2 v_uv; in vec3 v_pos; uniform sampler2D u_master; uniform float u_grid,u_hfade; out vec4 o;
void main(){
  vec4 m=texture(u_master,v_uv);
  vec3 base=vec3(0.0);
  vec3 col=mix(base,m.rgb,m.a);
  if(u_hfade>0.0){ float e=degrees(acos(clamp(v_pos.z,-1.0,1.0)))/90.0; col*=smoothstep(1.0,1.0-u_hfade,e); } // horizon fade near the dome spring line
  if(u_grid>0.5){ float e=degrees(acos(clamp(v_pos.z,-1.0,1.0))); float az=degrees(atan(v_pos.y,v_pos.x));
    float le=abs(fract(e/15.0-0.5)-0.5)/max(fwidth(e/15.0),1e-4); float la=abs(fract(az/30.0-0.5)-0.5)/max(fwidth(az/30.0),1e-4);
    col=mix(col,vec3(0.34,0.40,0.46),(1.0-min(min(le,la),1.0))*0.4);
    float dIn=(90.0-e)/max(fwidth(e),1e-4); // px inward from the mesh rim
    col=mix(col,vec3(0.52,0.56,0.60),(1.0-smoothstep(0.7,1.7,abs(dIn-2.6)))*0.5); } // [U4] the rim/spring line is now a thin GREY contour (was amber) — matches the grey grid lines; a ~2px band just inside the rim
  o=vec4(col,1.0);
}`;
const P3=prog(VS3,FS3);
const L3={pos:gl.getAttribLocation(P3,'a_pos'),uv:gl.getAttribLocation(P3,'a_uv'),mvp:gl.getUniformLocation(P3,'u_mvp'),master:gl.getUniformLocation(P3,'u_master'),grid:gl.getUniformLocation(P3,'u_grid'),flipx:gl.getUniformLocation(P3,'u_flipx'),hfade:gl.getUniformLocation(P3,'u_hfade')};
const domeVAO=gl.createVertexArray(); let domeCount=0, _domeVB=null, _domeCov=-1;
/* Dome cap mesh — a spherical cap of half-angle covHalf (π/2 = 180° hemisphere; >π/2 = past the spring line for
   210°+ domes). The UV (rho=rr) is coverage-independent, only the cap geometry (zen=rr·covHalf) changes, so a
   coverage switch just re-uploads the vertex buffer. Cached by _domeCov → cheap to call every frame. [R94f] S=256:
   the rim IS the spring line, so its polygon must be round enough to hide facets. */
function buildDomeMesh(covHalf){ if(Math.abs(covHalf-_domeCov)<1e-6)return; _domeCov=covHalf; const R=64,S=256,vv=[],needIx=(domeCount===0);
 for(let ri=0;ri<=R;ri++){const rr=ri/R,zen=rr*covHalf,sz=Math.sin(zen),cz=Math.cos(zen);
  for(let si=0;si<=S;si++){const aa=si/S*2*PI,ca=Math.cos(aa),sa=Math.sin(aa);
   const dir=rr<1e-6?[0,0,1]:[ca*sz,sa*sz,cz];
   const h=Math.atan2(dir[1],dir[0]); const u=rr*Math.sin(h)*0.5+0.5, v=-rr*Math.cos(h)*0.5+0.5;
   vv.push(dir[0],dir[1],dir[2],u,v);}}
 gl.bindVertexArray(domeVAO);
 if(!_domeVB)_domeVB=gl.createBuffer();
 gl.bindBuffer(gl.ARRAY_BUFFER,_domeVB);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vv),gl.STATIC_DRAW);
 gl.enableVertexAttribArray(L3.pos);gl.vertexAttribPointer(L3.pos,3,gl.FLOAT,false,20,0);
 gl.enableVertexAttribArray(L3.uv);gl.vertexAttribPointer(L3.uv,2,gl.FLOAT,false,20,12);
 if(needIx){ const ix=[],W=S+1;for(let ri=0;ri<R;ri++)for(let si=0;si<S;si++){const a=ri*W+si,b=a+1,c=a+W,d=c+1;ix.push(a,b,c,b,d,c);} const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(ix),gl.STATIC_DRAW);domeCount=ix.length; }
 gl.bindVertexArray(null); }
buildDomeMesh(HALF_PI);

/* 3D ROOM (360 immersive room) — textured quads (walls + floor). Positions in a normalized, centered room; each wall samples its sub-rect of the unwrapped strip, the floor samples the floor sequence, both stretched onto their real quads so non-90° corners + a deformed floor show ONLY here. */
const VSR=`#version 300 es
precision highp float; in vec3 a_pos; in vec2 a_uv; in float a_shade; in vec2 a_nrm; uniform mat4 u_mvp; out vec2 v_uv; out float v_sh; out vec3 v_wp; out vec2 v_nrm;
void main(){ v_uv=a_uv; v_sh=a_shade; v_wp=a_pos; v_nrm=a_nrm; gl_Position=u_mvp*vec4(a_pos,1.0); }`;
const FSR=`#version 300 es
precision highp float; in vec2 v_uv; in float v_sh; in vec3 v_wp; in vec2 v_nrm; uniform sampler2D u_tex; uniform vec3 u_base,u_cam; uniform float u_pass,u_outTex,u_backA; out vec4 o;
void main(){ vec4 t=texture(u_tex,v_uv); vec3 col=mix(u_base,t.rgb,t.a);
  if(u_pass>1.5){ o=vec4(col*v_sh,1.0); return; } // floor (always opaque)
  float inward = v_nrm.x*(u_cam.x-v_wp.x) + v_nrm.y*(u_cam.y-v_wp.y); // >0 → the room-facing (inside) surface is toward the camera
  if(u_pass>0.5){ if(inward<=0.0) discard; o=vec4(col*v_sh,1.0); } // inside pass = opaque
  else { if(inward>0.0) discard; vec3 c=(u_outTex>0.5)?col:u_base; o=vec4(c*v_sh,u_backA); } }`; // outside pass = translucent (flat, or the texture if enabled)
const PR=prog(VSR,FSR);
const LR={pos:gl.getAttribLocation(PR,'a_pos'),uv:gl.getAttribLocation(PR,'a_uv'),shade:gl.getAttribLocation(PR,'a_shade'),nrm:gl.getAttribLocation(PR,'a_nrm'),mvp:gl.getUniformLocation(PR,'u_mvp'),tex:gl.getUniformLocation(PR,'u_tex'),base:gl.getUniformLocation(PR,'u_base'),cam:gl.getUniformLocation(PR,'u_cam'),pass:gl.getUniformLocation(PR,'u_pass'),outTex:gl.getUniformLocation(PR,'u_outTex'),backA:gl.getUniformLocation(PR,'u_backA')};
const roomVAO=gl.createVertexArray(), roomVB=gl.createBuffer();
let _roomGeo=null, _roomGeoSeq=null;
let _roomFloorFBO=null,_roomFloorTex=null,_roomFloorSize=0;

gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);

const compTex=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,compTex);
gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,COMP,COMP,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
const compFBO=gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER,compFBO);
gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,compTex,0); gl.bindFramebuffer(gl.FRAMEBUFFER,null);
/* preview quality affects ONLY the clip composite (this master texture), not the screen canvas, dome mesh,
   grid or 2D overlays — so the dome grid always stays crisp while clips can render at 1/2 or 1/4. */
let compSize=COMP;
function setCompSize(s){ s=Math.max(256,Math.min(COMP,Math.round(s))); if(s===compSize)return; compSize=s; gl.bindTexture(gl.TEXTURE_2D,compTex); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,compSize,compSize,0,gl.RGBA,gl.UNSIGNED_BYTE,null); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE); gl.bindTexture(gl.TEXTURE_2D,null); }

/* math */
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>{const l=Math.hypot(a[0],a[1],a[2])||1;return[a[0]/l,a[1]/l,a[2]/l];};
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]], dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2], scl=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
function dirAzEl(az,el){az*=D2R;el*=D2R;const c=Math.cos(el);return [c*Math.cos(az),c*Math.sin(az),Math.sin(el)];}
function frame(az,el){ const d=dirAzEl(az,el); let u;
  if(Math.hypot(d[0],d[1])<1e-5){const a=az*D2R;u=[-Math.sin(a),Math.cos(a),0];} else u=norm(cross([0,0,1],d));
  const v=cross(d,u); return {d,u,v}; }

/* keyframes + easing */
function easeF(f,m){switch(m){case'in':return f*f;case'out':return 1-(1-f)*(1-f);case'both':return f<.5?2*f*f:1-Math.pow(-2*f+2,2)/2;case'hold':return 0;default:return f;}}
function hasKf(c,p){return c.kf&&c.kf[p]&&c.kf[p].length>0;}
/* cubic-bezier segment in (time,value) space using freeform handles on A.hOut and B.hIn */
function bezSegY(lt,A,B){ const seg=B.t-A.t; if(seg<=0)return A.v;
  const x0=A.t,x3=B.t,y0=A.v,y3=B.v;
  const oDt=A.hOut?Math.max(0,Math.min(seg,A.hOut.dt)):seg/3, oDv=A.hOut?A.hOut.dv:0;
  const iDt=B.hIn?Math.max(-seg,Math.min(0,B.hIn.dt)):-seg/3, iDv=B.hIn?B.hIn.dv:0;
  const x1=x0+oDt,y1=y0+oDv,x2=x3+iDt,y2=y3+iDv;
  let lo=0,hi=1,u=(lt-x0)/seg;
  for(let i=0;i<26;i++){ const mt=1-u; const x=mt*mt*mt*x0+3*mt*mt*u*x1+3*mt*u*u*x2+u*u*u*x3; if(x<lt)lo=u; else hi=u; u=(lo+hi)/2; }
  const mt=1-u; return mt*mt*mt*y0+3*mt*mt*u*y1+3*mt*u*u*y2+u*u*u*y3; }
function evalP(c,p,t){ const ks=c.kf&&c.kf[p]; const base=(typeof p==='string'&&p.indexOf('fx:')===0)?fxBaseFor(c,p):c.props[p];
  if(!ks||!ks.length) return base; // [A2/D1] After Effects model: a keyframed param ALWAYS follows its curve — automation never breaks (no _autoOff override)
  const lt=t-c.start; if(lt<=ks[0].t)return ks[0].v; const last=ks[ks.length-1]; if(lt>=last.t)return last.v;
  for(let i=0;i<ks.length-1;i++) if(lt>=ks[i].t&&lt<=ks[i+1].t){
    if(ks[i].e==='bezier'||ks[i].hOut||ks[i+1].hIn) return bezSegY(lt,ks[i],ks[i+1]);
    const f=easeF((lt-ks[i].t)/((ks[i+1].t-ks[i].t)||1),ks[i].e||'linear');return ks[i].v+(ks[i+1].v-ks[i].v)*f;}
  return base; }
function setKf(c,p,t,v,e){ if(!c.kf)c.kf={}; if(!c.kf[p])c.kf[p]=[]; let lt=Math.max(0,t-c.start); if(c.dur!=null)lt=Math.min(lt,c.dur); const ks=c.kf[p];
  const tol=Math.min(0.02,0.5/(state.fps||30)); // frame-aware merge window (≤ half a frame) — adjacent-frame keyframes stay distinct at 60 fps
  const i=ks.findIndex(k=>Math.abs(k.t-lt)<tol); if(i>=0){ks[i].v=v;if(e)ks[i].e=e;} else {ks.push({t:lt,v,e:e||'linear'});ks.sort((a,b)=>a.t-b.t);} }
function clearKf(c,p){ if(c.kf)delete c.kf[p]; }

/* ===================== PROCEDURAL MOTION (infinite, keyframe-independent — Unreal-style Rotator / Translator) =====================
   A clip carries an optional list c.anim=[{param,mode,speed,amp,phase,on}]. `mode:'linear'` is a continuous ramp
   (a Rotator/Translator: value += speed·t forever — angular params wrap seamlessly); `mode:'wave'` is a sine oscillation
   (pulse/sway/flicker). It is ADDED on top of the base/keyframed value at render time only (evalR), so it never bakes
   into the editable value. Driven by absolute timeline time → deterministic and correct in export; a live-preview clock
   advances it in the paused editor so the composition visibly "breathes". Applies to clips, stills, comps (spin rotates
   the whole dome disc), and tiles. */
const ANIM_PARAMS=[['spin','Rotate','Girar'],['az','Orbit (azimuth)','Orbitar (azimut)'],['el','Elevation','Elevación'],['size','Size','Tamaño'],['rot','Roll','Balanceo'],['opacity','Opacity','Opacidad']];
const ANIM_PRESETS=[
  {key:'spin',   param:'spin', mode:'linear', speed:30,  amp:0,  label:['Spin','Girar']},
  {key:'orbit',  param:'az',   mode:'linear', speed:24,  amp:0,  label:['Orbit','Orbitar']},
  {key:'bob',    param:'el',   mode:'wave',   speed:0.15, amp:14, label:['Bob','Vaivén ↕']},
  {key:'scroll', param:'el',   mode:'linear', speed:20,  amp:0,  label:['Scroll ↕','Desplazar ↕']},
  {key:'sway',   param:'az',   mode:'wave',   speed:0.1,  amp:22, label:['Sway','Vaivén ↔']},
  {key:'pulse',  param:'size', mode:'wave',   speed:0.4,  amp:16, label:['Pulse','Pulsar']},
  {key:'wobble', param:'rot',  mode:'wave',   speed:0.35, amp:12, label:['Wobble','Bambolear']},
  {key:'flicker',param:'opacity',mode:'wave', speed:0.9,  amp:22, label:['Flicker','Parpadeo']},
];
// Flat / 360-room motion set (2D transform params). Vertical movement tiles the clip infinitely so it loops.
const ANIM_PRESETS_FLAT=[
  {key:'rotate', param:'rot',  mode:'linear', speed:30,  amp:0,  label:['Rotate','Rotar']},
  {key:'pulse',  param:'scale',mode:'wave',   speed:0.4, amp:16, label:['Pulse','Pulsar']},
  {key:'hmove',  param:'x',    mode:'linear', speed:15,  amp:0,  label:['Horizontal','Horizontal']},
  {key:'vmove',  param:'y',    mode:'linear', speed:15,  amp:0,  tile:true, label:['Vertical','Vertical']},
];
function curAnimPresets(){ return isFlat()?ANIM_PRESETS_FLAT:ANIM_PRESETS; }
function hasLiveAnim(c){ return !!(c&&c.anim&&c.anim.some(a=>a.on)); }
function clipVTile(c){ return !!(c&&c.anim&&c.anim.some(a=>a.on&&a.tile&&a.param==='y')); } // vertical-movement modifier → tile the clip vertically for a seamless infinite scroll
function addAnimPreset(c,key){ if(!c)return; if(!c.anim)c.anim=[]; const p=ANIM_PRESETS.concat(ANIM_PRESETS_FLAT).find(x=>x.key===key)||ANIM_PRESETS[0]; c.anim.push({id:uid(),param:p.param,mode:p.mode,speed:p.speed,amp:p.amp,phase:0,on:true,tile:p.tile||false}); }
let _previewClock=0,_prevRaf=0,_prevLast=0;
function animTime(t){ return (state.playing||exporting)?t:(t+_previewClock); } // paused editor advances a preview clock; export/playback use the real frame time (deterministic)
/* per-modifier dry/wet (0..1) — keyframeable so the user can decide WHEN a motion ramps in on the timeline.
   Uses the real render time t (not the preview clock) so the ramp is anchored to the playhead; multiplies the offset. */
function evalWet(c,a,t){ const ks=a.wetKf; const base=(a.wet!=null?a.wet:1);
  if(!ks||!ks.length) return base;
  const lt=t-c.start; if(lt<=ks[0].t)return ks[0].v; const last=ks[ks.length-1]; if(lt>=last.t)return last.v;
  for(let i=0;i<ks.length-1;i++) if(lt>=ks[i].t&&lt<=ks[i+1].t){ const f=easeF((lt-ks[i].t)/((ks[i+1].t-ks[i].t)||1),ks[i].e||'linear'); return ks[i].v+(ks[i+1].v-ks[i].v)*f; }
  return base; }
function animOffset(c,p,t){ let o=0; const at=animTime(t);
  for(const a of c.anim){ if(!a.on||a.param!==p)continue;
    const w=Math.max(0,Math.min(1,evalWet(c,a,t))); if(w<=0)continue;
    const v=(a.mode==='wave') ? (a.amp||0)*Math.sin(6.283185307*((a.speed||0)*at+(a.phase||0))) : (a.speed||0)*at;
    o+=v*w; }
  return o; }
/* render-time evaluator = base (keyframe/props) + procedural offset. Used ONLY by the renderer so editing/keyframing stays on the base value. */
/* [R95·C1] The resolved value the RENDER sees = keyframes → motion modifiers → MODULATION STACK.
   evalP stays the pure keyframe/base value (the curve editor draws and edits THAT), so the stack never fights the editor. */
function evalR(c,p,t){ let v=evalP(c,p,t); if(v==null)v=0; if(c.anim&&c.anim.length)v+=animOffset(c,p,t); if(c.mod&&c.mod[p])v=evalModStack(c,p,t,v); return v; }
/* ===================== [R95·C1] MODULATION STACK — the unified, LEGIBLE model =====================
   Bitwig proves modulation belongs ON the control; Cavalry's Behaviour Mixer proves layers need EXPLICIT blend modes;
   Houdini's Layer CHOP proves the base must stay absolute. Nobody in video has any of it. Here a parameter is:
       base (keyframes) → layer₁ → layer₂ → …      each layer = source ⊗ blend ⊗ depth
   c.mod = { '<param>': [ {id,src,blend,depth,on,...srcParams} ] } — serialised with the clip; the curve editor is untouched.
   Sources: 'lfo' (free-running shapes) · 'audio' (band envelope, reuses the Reactive-FX chain) · 'space' (C3: dome az/el —
   nothing else on the market has this, because nothing else is fulldome). Signals are normalised 0..1. */
const MOD_BLENDS=[['add','+ Add','+ Sumar'],['sub','− Subtract','− Restar'],['mul','× Multiply','× Multiplicar'],['min','∧ Min','∧ Mín'],['max','∨ Max','∨ Máx'],['set','= Override','= Anular']];
const MOD_SRCS=[['lfo','LFO','LFO'],['audio','Audio','Audio'],['space','Dome space','Espacio del domo']];
const LFO_SHAPES=[['sine','Sine','Seno'],['tri','Triangle','Triángulo'],['saw','Saw','Diente'],['sq','Square','Cuadrada'],['rnd','Random','Aleatoria']];
function modDefaults(src){ const b={id:uid(),src,blend:(src==='space'?'mul':'add'),depth:(src==='space'?100:20),on:true};
  if(src==='lfo')return Object.assign(b,{shape:'sine',hz:0.5,phase:0,bpmSync:false,div:1});
  if(src==='audio')return Object.assign(b,{band:'bass',atk:8,rel:130,curve:50,inv:false,f0:0,f1:0}); // [R95·C2] band names MUST match computeBands (bass|mid|treble|bright) — a stray 'low' resolved to nothing and the signal was silently always 0. f0/f1 ≠ 0 → custom spectrum range.
  return Object.assign(b,{axis:'el',from:0,to:90,inv:false}); } // space: falloff along an axis (Cavalry's Falloffs, in fisheye coords)
/* one modulator's signal, normalised 0..1 (deterministic in export: everything derives from t, never from wall-clock) */
function modSignal(c,m,t){
  if(m.frz!=null)return m.frz; // [R95·D4] FREEZE — hold the layer's output at the value it had when you froze it. Essential live (the show must not follow the music at THIS moment) and almost nobody has it.
  if(m.src==='lfo'){ const hz=m.bpmSync?((state.tl.bpm||120)/60)/Math.max(0.0625,m.div||1):Math.max(0.001,m.hz||0.5);
    const ph=((t-c.start)*hz+(m.phase||0)/360)%1; const x=ph<0?ph+1:ph;
    switch(m.shape){ case 'tri': return 1-Math.abs(2*x-1)*1; case 'saw': return x; case 'sq': return x<0.5?1:0;
      case 'rnd': { const i=Math.floor((t-c.start)*hz); let h=(i*2654435761)>>>0; h^=h>>>15; h=(h*2246822507)>>>0; h^=h>>>13; return (h>>>8)/16777215; }
      default: return 0.5-0.5*Math.cos(2*Math.PI*x); } }
  if(m.src==='audio'){ const env=modAudioEnv(m); if(!env)return 0; const fps=(_arCache&&_arCache.fps)||30; const i=Math.max(0,Math.min(env.length-1,Math.round(t*fps)));
    let v=env[i]||0; const cu=m.curve!=null?m.curve:50; if(cu!==50)v=Math.pow(Math.min(1,v),Math.pow(4,(cu-50)/50)); if(m.inv)v=1-Math.min(1,v); return Math.max(0,Math.min(1,v)); }
  if(m.src==='space'){ const ax=m.axis||'el'; let v; // [R95·C3] the clip's own position on the dome drives the parameter
    if(ax==='az'){ const az=((evalP(c,'az',t)||0)%360+360)%360; v=az/360; }
    else if(ax==='dist'){ const el=evalP(c,'el',t)||0; v=1-Math.max(0,Math.min(90,el))/90; } // 0 at the zenith → 1 at the horizon
    else { v=Math.max(0,Math.min(90,evalP(c,'el',t)||0))/90; }
    const f=(m.from||0)/((ax==='az')?360:90), to=(m.to!=null?m.to:(ax==='az'?360:90))/((ax==='az')?360:90);
    const sp=(to-f)||1e-6; v=Math.max(0,Math.min(1,(v-f)/sp)); if(m.inv)v=1-v; return v; }
  return 0; }
let _modAudioCache=new Map(); // shaped band envelopes for modulators, keyed by band+attack+release (mirrors the Reactive-FX cache)
function modAudioEnv(m){ if(!_arCache)return null;
  const raw=(m.f0&&m.f1)?specRangeRaw(m.f0,m.f1):(_arCache.raw&&_arCache.raw[m.band||'bass']); if(!raw)return null; // [R95·C2] a custom f0..f1 range reads the real spectrum; named bands keep the filter-bank path
  const atk=m.atk!=null?m.atk:8, rel=m.rel!=null?m.rel:130; const key=((m.f0&&m.f1)?('f'+Math.round(m.f0)+'-'+Math.round(m.f1)):(m.band||'bass'))+'|'+atk+'|'+rel;
  const hit=_modAudioCache.get(key); if(hit)return hit;
  const dt=1/(_arCache.fps||30); const aA=Math.exp(-dt/Math.max(0.001,atk/1000)), aR=Math.exp(-dt/Math.max(0.001,rel/1000));
  const arr=new Float32Array(raw.length); let y=0;
  for(let i=0;i<raw.length;i++){ const x=raw[i]; const a=x>y?aA:aR; y=a*y+(1-a)*x; arr[i]=y; }
  if(_modAudioCache.size>64)_modAudioCache.clear(); _modAudioCache.set(key,arr); return arr; }
/* apply the stack. depth is in PARAMETER UNITS for add/sub, and 0..100 % for mul/min/max/set (Bitwig's relative depth). */
function evalModStack(c,p,t,base){ const st=c.mod&&c.mod[p]; if(!st||!st.length)return base;
  const d=paramDef(c,p); const mn=d?d[3]:0, mx=d?d[4]:100; let v=base;
  for(const m of st){ if(m.on===false)continue; const s=modSignal(c,m,t); const dep=(m.depth!=null?m.depth:20);
    switch(m.blend){
      case 'add': v+=s*dep; break;
      case 'sub': v-=s*dep; break;
      case 'mul': v*=(1-dep/100)+(dep/100)*s; break; // depth 100 % = full gate; 0 % = bypass
      case 'min': v=Math.min(v, mn+(mx-mn)*s*(dep/100)); break;
      case 'max': v=Math.max(v, mn+(mx-mn)*s*(dep/100)); break;
      case 'set': { const tgt=mn+(mx-mn)*s; v=v+(tgt-v)*(dep/100); break; } } }
  return Math.max(mn,Math.min(mx,v)); }
function hasMod(c,p){ const st=c&&c.mod&&c.mod[p]; return !!(st&&st.some(m=>m.on!==false)); }
function anyMod(){ for(const c of state.clips)if(c.mod)for(const p in c.mod)if(hasMod(c,p))return true; return false; }
/* [R95·C1] THE AUDIT LINE — plain text, always visible: "0.62 = base 0.40 + audio(low ×0.55, atk 8ms/rel 220ms)".
   The rule distilled from the whole research: the user must be able to answer "why is it that, right now?" without opening anything. */
function modFormula(c,p,t){ const st=(c.mod&&c.mod[p])||[]; const base=evalP(c,p,t)||0; const d=paramDef(c,p); const u=d?(d[2]||''):'';
  const f=v=>{ const r=Math.round(v*10)/10; return (r%1===0?r.toFixed(0):r.toFixed(1)); };
  let s=T('base','base')+' '+f(base)+u;
  for(const m of st){ if(m.on===false)continue; const sig=modSignal(c,m,t); const bl=(MOD_BLENDS.find(b=>b[0]===m.blend)||['','?'])[1].split(' ')[0];
    s+=' '+bl+' '+modLabel(m)+'('+Math.round(sig*100)+'%'+(m.blend==='add'||m.blend==='sub'?(' ×'+f(m.depth)+u):(' '+Math.round(m.depth)+'%'))+')'; }
  return f(evalR(c,p,t))+u+'  =  '+s; }
function modLabel(m){ if(m.frz!=null)return '❄'+(m.src==='lfo'?'LFO':m.src==='audio'?T('audio','audio'):T('dome','domo')); // [R95·D4] the audit line must say it's frozen — otherwise "why isn't it reacting?" has no visible answer
  if(m.src==='lfo')return 'LFO '+(m.bpmSync?('1/'+(m.div||1)):((m.hz||0.5)+'Hz'))+' '+(m.shape||'sine');
  if(m.src==='audio')return T('audio','audio')+'('+((m.f0&&m.f1)?(Math.round(Math.min(m.f0,m.f1))+'-'+Math.round(Math.max(m.f0,m.f1))+'Hz'):(m.band||'bass'))+')'; // [R95·C2] the audit line must name the REAL source — a custom window, not a band it isn't using
  return T('dome','domo')+'('+(m.axis||'el')+')'; }
function anyAnim(){ for(const c of state.clips){ if(hasLiveAnim(c)||hasLiveMod(c))return true; const m=mediaById(c.mediaId); if(m&&m.nestClips)for(const nc of m.nestClips)if(hasLiveAnim(nc)||hasLiveMod(nc))return true; } return false; } // [R95·C1] a free-running LFO must animate the idle preview exactly like a motion modifier does
function hasLiveMod(c){ if(!c||!c.mod)return false; for(const p in c.mod)for(const m of c.mod[p])if(m.on!==false&&(m.src==='lfo'))return true; return false; } // only the LFO runs off the clock; audio/space follow the playhead
let _motionDrawT=0;
function motionTick(){ _prevRaf=0; if(state.playing||exporting||state.motionPreview===false||!anyAnim())return;
  if(document.hidden){ _prevLast=0; _prevRaf=requestAnimationFrame(motionTick); return; } // [R92-T3 F14] parked while the window is hidden — don't composite an invisible master
  { const nw=performance.now(); if(nw-_motionDrawT<30){ _prevRaf=requestAnimationFrame(motionTick); return; } _motionDrawT=nw; } // [R92-T3 F14] idle motion preview capped at ~30fps (it used to composite at 60fps forever, GPU 30-60% with the app sitting idle)
  const now=performance.now(); const dt=_prevLast?Math.min(0.05,(now-_prevLast)/1000):0; _prevLast=now; _previewClock+=dt;
  // keep on-screen VIDEO clips PLAYING during the live motion preview (looping, muted) so the content isn't a frozen frame while the motion animates — the 3D room showed "moving but not playing"
  try{ const drawn=collectDrawnVideoClips(state.clips,state.lanes,state.playhead,0,[]); for(const {c,m} of drawn){ const vi=vinstEnsure(c,m); if(!vi||!vi.vel)continue; vi.vel.muted=true; try{vi.vel.loop=true;}catch(_){} (vi.loadP||Promise.resolve()).then(()=>{ if(vi.vel&&vi.vel.paused)vi.vel.play().catch(()=>{}); }); if(HAS_RVFC){ if(!vi.vf)pumpVFClip(vi); } else { try{upTex(vi.vtex,vi.vel);}catch(_){} vi.ready=true; } } }catch(e){}
  if(_raOn)raInvalidate(); render();
  _prevRaf=requestAnimationFrame(motionTick); }
function startMotionPreview(){ if(_prevRaf||state.playing||state.motionPreview===false)return; _prevLast=performance.now(); _prevRaf=requestAnimationFrame(motionTick); }
function stopMotionPreview(){ if(_prevRaf){cancelAnimationFrame(_prevRaf);_prevRaf=0;} if(!state.playing){ for(const [,vi] of _vinst){ try{ if(vi.vel){vi.vel.loop=false; vi.vel.pause();} }catch(e){} stopVFClip(vi); } } } // stop the preview video playback (don't fight real transport)

/* draw one clip into current FB */
function fadeFactor(c,t){ const lt=t-c.start; let fi=c.fadeIn||0,fo=c.fadeOut||0; if(fi+fo>c.dur){const s=c.dur/(fi+fo);fi*=s;fo*=s;} let f=1; if(fi>0&&lt<fi)f*=Math.max(0,lt/fi); if(fo>0&&lt>c.dur-fo)f*=Math.max(0,(c.dur-lt)/fo); return f; }
function srcT(c,t){ const raw=(t-c.start)*(c.speed||1); // timeline time → SOURCE-media time (R80: per-clip speed; R81: loopable clips wrap over [inP, inP+loopLen) so drawing/analysis/export all repeat automatically)
  if(c.loop&&c.loopLen>0){ const L=c.loopLen; let ph=raw-Math.floor(raw/L)*L;
    if(c.loopRev&&(Math.floor(raw/L)&1))ph=L-ph; // R88: ping-pong — odd cycles play backward (forward, back, forward, …)
    return (c.inP||0)+ph; }
  return raw+(c.inP||0); }
function loopCycleSec(c){ return (c.loop&&c.loopLen>0)?(c.loopLen/(c.speed||1)):0; } // one loop cycle length in TIMELINE seconds
function audioLevelAt(t){ let lv=0; const anySolo=state.lanes.some(l=>l.kind==='audio'&&l.solo); for(const c of state.clips){ const m=mediaById(c.mediaId); if(!m||m.kind!=='audio'||!m.peaks||c.disabled)continue; const lane=state.lanes[c.lane]; if(lane&&(lane.mute||(anySolo&&!lane.solo)))continue; if(t<c.start||t>c.start+c.dur)continue; const local=srcT(c,t); const idx=Math.floor(local/(m.dur||1)*m.peaks.length); if(idx>=0&&idx<m.peaks.length)lv=Math.max(lv,m.peaks[idx]); } return lv; }
function detectBeats(ab){ const ch=ab.getChannelData(0), sr=ab.sampleRate, win=Math.max(1,Math.floor(sr*0.02)); const en=[]; for(let i=0;i<ch.length;i+=win){ let e=0; for(let j=0;j<win&&i+j<ch.length;j++){const v=ch[i+j];e+=v*v;} en.push(e/win); }
  const beats=[]; let last=-99; for(let k=1;k<en.length;k++){ let avg=0,cnt=0; for(let m2=Math.max(0,k-8);m2<k;m2++){avg+=en[m2];cnt++;} avg/=Math.max(1,cnt); if(en[k]>avg*1.5&&en[k]>0.0004&&(k-last)>5){ beats.push(k*win/sr); last=k; } } return beats; }
function detectBeatsCmd(){ let clip=selClip(), m=clip&&mediaById(clip.mediaId);
  if(!(m&&m.kind==='audio'&&m.buffer)){ clip=state.clips.find(c=>{const mm=mediaById(c.mediaId);return mm&&mm.kind==='audio'&&mm.buffer;}); m=clip&&mediaById(clip.mediaId); }
  if(!(m&&m.buffer)){ flashStatus(T('Select an audio clip first','Selecciona un clip de audio primero')); return; }
  pushUndo(); const beats=detectBeats(m.buffer), inP=clip.inP||0; let added=0;
  for(const bt of beats){ if(bt<inP||bt>inP+clip.dur)continue; if(added>=400)break; state.markers.push({id:uid(),time:clip.start+(bt-inP),name:T('beat','beat'),color:'#9EA5AD'}); added++; }
  state.markers.sort((a,b)=>a.time-b.time); renderTimeline(); flashStatus(added+' '+T('beats → locators','beats → localizadores')); }
const NORMAL_BLEND=()=>{ gl.blendEquation(gl.FUNC_ADD); gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA); };
function setBlend(mode){ gl.blendEquation(gl.FUNC_ADD); switch(mode){
  case 'add':      gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE,gl.ONE,gl.ONE_MINUS_SRC_ALPHA); break;
  case 'screen':   gl.blendFuncSeparate(gl.ONE_MINUS_DST_COLOR,gl.ONE,gl.ONE,gl.ONE_MINUS_SRC_ALPHA); break;
  case 'multiply': gl.blendFuncSeparate(gl.DST_COLOR,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA); break;
  case 'darken':   gl.blendEquation(gl.MIN); gl.blendFuncSeparate(gl.ONE,gl.ONE,gl.ONE,gl.ONE); break;
  case 'lighten':  gl.blendEquation(gl.MAX); gl.blendFuncSeparate(gl.ONE,gl.ONE,gl.ONE,gl.ONE); break;
  default:         NORMAL_BLEND();
} }
let _drawFlat=false, _compAspect=1, _roomWrap=false; // the sequence currently being composited: flat mode + aspect (w/h) + (room strip → wrap clips across the seam). Nests may differ from the top sequence, so these are set before each composite() call.
/* Dome coverage (fisheye FOV). 180° = full hemisphere (fulldome standard). The content radius on the master is
   rho = zenithAngle / covHalf, so a wider coverage pulls the horizon inward. Single source of truth: state.seqCov. */
function curCovDeg(){ return (state.seqCov||180)/2; } // HALF-angle in degrees (90 = 180° fulldome)
function curCovHalf(){ return curCovDeg()*D2R; }      // ... in radians (warp uniform + fisheye inverse)
function isFlat(){ return state.seqMode==='flat'||state.seqMode==='room'; } // room = rectangular flat-strip compositing (walls unwrapped side by side); dome stays a separate path
function isRoom(){ return state.seqMode==='room'; }
function flatLikeMode(md){ return md==='flat'||md==='room'; } // "rectangular, not dome" — for export dims / format chip / nested-sequence draw
/* FLAT clip placement: return {fc,fx,fy,hw,hh} (NDC center + rotated half-axes, inscribed in the square composite with a UNIFORM scale so rotation isn't skewed). */
function flatPlace(c,m,t){ const A=_compAspect||1; const s=Math.min(2/A,2), Fx=s*A/2, Fy=s/2; // frame half-extents in square NDC (Fx=min(1,A), Fy=min(1,1/A))
  const ca=Math.max(0.01,(m.w||16)/(m.h||9));
  let wW,wH; if(ca>=A){ wW=A; wH=A/ca; } else { wH=1; wW=ca; } // contain the clip's aspect inside the A×1 frame
  const scale=Math.max(0.001,(evalR(c,'scale',t)||100)/100); const sxm=(c.props.scaleX==null?1:Math.max(0.001,c.props.scaleX)), sym=(c.props.scaleY==null?1:Math.max(0.001,c.props.scaleY)); const hw=wW/2*scale*sxm, hh=wH/2*scale*sym; // scaleX/scaleY = per-axis multipliers (Photoshop-style corner/edge resize); default 1 → uniform, flat clips unaffected
  const rot=(evalR(c,'rot',t)||0)*D2R, cs=Math.cos(rot), sn=Math.sin(rot);
  const x=(evalR(c,'x',t)||0)/100, y=(evalR(c,'y',t)||0)/100; // x/y are % of the frame half-extent (−100..100)
  return { fc:[x*Fx, y*Fy], fx:[s*hw*cs, s*hw*sn], fy:[s*hh*(-sn), s*hh*cs], hw, hh }; }
function drawClipFlat(c,m,t,xf,ntex,op){ const P=flatPlace(c,m,t);
  gl.useProgram(PW); gl.bindVertexArray(meshVAO);
  gl.uniform1f(LW.fmode,1); gl.uniform2f(LW.fx,P.fx[0],P.fx[1]); gl.uniform2f(LW.fy,P.fy[0],P.fy[1]);
  gl.uniform2f(LW.half,P.hw,P.hh); gl.uniform1f(LW.mir,c.props.mirror?-1:1); gl.uniform1f(LW.op,op);
  gl.uniform1f(LW.cull,0); gl.uniform1f(LW.sector,0); gl.uniform1f(LW.tile,0); gl.uniform1f(LW.maskScale,c.props.maskScale||1);
  gl.uniform1f(LW.blur,(evalP(c,'blur',t)||0)*0.0016); gl.uniform1f(LW.feather,(evalP(c,'feather',t)||0)/100); gl.uniform1f(LW.crop,(evalP(c,'crop',t)||0)/100*0.9);
  gl.uniform1f(LW.mask,MASK_IDX[c.props.mask||'none']||0);
  gl.uniform1f(LW.exp,(evalP(c,'exposure',t)||0)/100); gl.uniform1f(LW.con,(evalP(c,'contrast',t)||0)/100); gl.uniform1f(LW.sat,(evalP(c,'saturation',t)||0)/100);
  gl.uniform1f(LW.tmp,(evalP(c,'temperature',t)||0)/100*0.15); gl.uniform1f(LW.tnt,(evalP(c,'tint',t)||0)/100*0.15);
  gl.uniform1f(LW.glow,(evalP(c,'glow',t)||0)/100); gl.uniform1f(LW.ca,(evalP(c,'chroma',t)||0)/100); bindClipLUT(c);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,ntex); gl.uniform1i(LW.tex,0);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D,c.maskTex||ntex); gl.uniform1i(LW.maskTex,1);
  const bm=c.props.blend||'normal'; setBlend(bm); gl.uniform1f(LW.premul,(bm==='screen'||bm==='multiply')?1:0); gl.uniform1f(LW.blend,BLEND_ID[bm]||0);
  // seamless horizontal wrap (360-room strip only): a clip crossing the left/right seam reappears on the opposite side. One full strip = 2·Fx in fc-space.
  const offs=[0];
  if(_roomWrap){ const A=_compAspect||1, s=Math.min(2/A,2), Fx=s*A/2, span=2*Fx; const hx=Math.abs(P.fx[0])+Math.abs(P.fy[0]);
    if(P.fc[0]+hx> Fx)offs.push(-span); if(P.fc[0]-hx<-Fx)offs.push(span); }
  // vertical infinite tiling (Vertical-movement motion): repeat the clip by its own height to fill the frame → endless scroll
  let voffs=[0];
  if(clipVTile(c)){ const per=2*(Math.abs(P.fy[1])+Math.abs(P.fx[1]));
    if(per>0.02){ let kLo=Math.floor((-1.2-P.fc[1])/per), kHi=Math.ceil((1.2-P.fc[1])/per); if(kHi-kLo>60){kLo=-30;kHi=30;} voffs=[]; for(let k=kLo;k<=kHi;k++)voffs.push(k*per); } }
  const drawCopies=()=>{ for(const dy of voffs)for(const dx of offs){ gl.uniform2f(LW.fc,P.fc[0]+dx,P.fc[1]+dy); gl.drawElements(gl.TRIANGLES,meshCount,gl.UNSIGNED_INT,0); } };
  const mw=(_roomWrap&&c.props.maskWalls&&c.props.maskWalls.length)?roomWallScissorRects(c.props.maskWalls):null; // Mask to wall: clip to the chosen walls' regions
  if(mw&&mw.length){ gl.enable(gl.SCISSOR_TEST); for(const r of mw){ gl.scissor(r.x,r.y,r.w,r.h); drawCopies(); } gl.disable(gl.SCISSOR_TEST); } else drawCopies();
  if(bm!=='normal')NORMAL_BLEND(); gl.bindVertexArray(null); }
function drawClip(c,m,t,xf){
  if(!m) return; let ntex; if(isSeqMedia(m)) ntex=(c._ntex||m.tex); else if(m.kind==='video'){ const vi=_vinst.get(c.id); ntex=(vi&&vi.ready&&vi.vtex)?vi.vtex:m.tex; } else ntex=m.tex; if(!ntex) return; // nests sample their per-clip pool tex; videos sample their PER-CLIP decode tex so duplicated clips show different frames (fallback m.tex until the private decoder has its first frame)
  if(m.kind==='sequence'&&m.frames&&m.frames.length){ const idx=Math.max(0,Math.min(m.frames.length-1,Math.floor(srcT(c,t)*(m.fps||24)))); if(idx!==m._curFrame&&m.frames[idx]){ upTex(m.tex,m.frames[idx]); m._curFrame=idx; } }
  if(c.props.fisheye) ntex=applyFisheye(ntex, fxChainSize(), c); // R83: flat→fisheye pre-warp (before FX + dome placement) so flat clips gain the curvature a dome master needs
  if(hasFx(c)) ntex=applyChain(ntex, fxChainSize(), c, t); // Reactive FX: run the audio-reactive chain on the clip texture before dome/2D placement (dome+flat agnostic; deterministic in export)
  if(c.props.blackKey) ntex=applyBlackKey(ntex, fxChainSize(), c); // R85: luma-key the black background → real transparency (after FX so it keys the final look)
  if(_drawFlat){ const opf=Math.max(0,Math.min(1,evalR(c,'opacity',t)/100))*fadeFactor(c,t)*(xf==null?1:xf); drawClipFlat(c,m,t,xf,ntex,opf); return; } // FLAT (2D) sequence: place clip as a rectangle (x/y/scale/rot), no dome projection
  const spin=evalR(c,'spin',t); let az=evalR(c,'az',t)+spin, el=evalR(c,'el',t); let size=Math.max(1,evalR(c,'size',t)); if(c.props.react==='audio')size*=(1+audioLevelAt(t)*(c.props.reactAmt||0)/100*1.5);
  let op=Math.max(0,Math.min(1,evalR(c,'opacity',t)/100))*fadeFactor(c,t)*(xf==null?1:xf);
  if(c.props.equirect){ gl.useProgram(PEQ); gl.bindVertexArray(eqVAO); // [F7] equirectangular 360° source → dome: az (Azimuth+Spin) = yaw (rotate the camera), eqPitch tilts
    gl.uniform1f(LEQ.op,op); gl.uniform1f(LEQ.mir,c.props.mirror?-1:1); gl.uniform1f(LEQ.covHalf, curCovHalf()); gl.uniform1f(LEQ.yaw, az*D2R); gl.uniform1f(LEQ.pitch, (c.props.eqPitch||0)*D2R);
    gl.uniform1f(LEQ.exp,(evalP(c,'exposure',t)||0)/100); gl.uniform1f(LEQ.con,(evalP(c,'contrast',t)||0)/100); gl.uniform1f(LEQ.sat,(evalP(c,'saturation',t)||0)/100); gl.uniform1f(LEQ.tmp,(evalP(c,'temperature',t)||0)/100*0.15); gl.uniform1f(LEQ.tnt,(evalP(c,'tint',t)||0)/100*0.15);
    gl.uniform1f(LEQ.mask, MASK_IDX[c.props.mask||'none']||0); gl.uniform1f(LEQ.feather,(evalP(c,'feather',t)||0)/100); gl.uniform1f(LEQ.maskScale, c.props.maskScale||1);
    bindClipLUT(c,LEQ); // [grade gap] wheels + curves + LUT on the equirect path (units 2/3), restores TEXTURE0 before the tex bind below
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,ntex); gl.uniform1i(LEQ.tex,0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, c.maskTex||m.tex); gl.uniform1i(LEQ.maskTex,1);
    const bmq=c.props.blend||'normal'; setBlend(bmq); gl.uniform1f(LEQ.premul,(bmq==='screen'||bmq==='multiply')?1:0); gl.uniform1f(LEQ.blend,BLEND_ID[bmq]||0); gl.drawArrays(gl.TRIANGLES,0,6); if(bmq!=='normal')NORMAL_BLEND(); gl.bindVertexArray(null); return; }
  if(c.props.fulldome){ gl.useProgram(PFD); gl.bindVertexArray(fdVAO);
    gl.uniform1f(LFD.op,op); gl.uniform1f(LFD.mir,c.props.mirror?-1:1); gl.uniform1f(LFD.spin, az*D2R); gl.uniform1f(LFD.scale, Math.max(0.05, size/55)); // [N1] Size scales the fulldome content (55 = 1:1, the default → no change for existing clips); az/spin rotate it — so a compose nest behaves like a clip
    gl.uniform1f(LFD.exp,(evalP(c,'exposure',t)||0)/100); gl.uniform1f(LFD.con,(evalP(c,'contrast',t)||0)/100); gl.uniform1f(LFD.sat,(evalP(c,'saturation',t)||0)/100); gl.uniform1f(LFD.tmp,(evalP(c,'temperature',t)||0)/100*0.15); gl.uniform1f(LFD.tnt,(evalP(c,'tint',t)||0)/100*0.15);
    gl.uniform1f(LFD.mask, MASK_IDX[c.props.mask||'none']||0); gl.uniform1f(LFD.feather,(evalP(c,'feather',t)||0)/100); gl.uniform1f(LFD.maskScale, c.props.maskScale||1);
    bindClipLUT(c,LFD); // [grade gap] wheels + curves + LUT on the fulldome path (units 2/3), restores TEXTURE0 before the tex bind below
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,ntex); gl.uniform1i(LFD.tex,0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, c.maskTex||m.tex); gl.uniform1i(LFD.maskTex,1);
    const bm0=c.props.blend||'normal'; setBlend(bm0); gl.uniform1f(LFD.premul,(bm0==='screen'||bm0==='multiply')?1:0); gl.uniform1f(LFD.blend,BLEND_ID[bm0]||0); gl.drawArrays(gl.TRIANGLES,0,6); if(bm0!=='normal')NORMAL_BLEND(); gl.bindVertexArray(null); return; }
  { const p=((el%180)+180)%180; el=(p<=90)?p:(180-p); if(p>90)az+=180; } // diameter wrap: a linear 'el' scroll rises over the zenith and descends the far side, reappearing at the opposite dome edge (infinite strip). Identity for normal el∈[0,90].
  const fr=frame(az,el); const ax=(size*0.5)*D2R, ay=ax*(m.h/m.w);
  const rot=(evalR(c,'rot',t)||0)*D2R, cr=Math.cos(rot), sr=Math.sin(rot);
  const U=[fr.u[0]*cr+fr.v[0]*sr,fr.u[1]*cr+fr.v[1]*sr,fr.u[2]*cr+fr.v[2]*sr];
  const V=[-fr.u[0]*sr+fr.v[0]*cr,-fr.u[1]*sr+fr.v[1]*cr,-fr.u[2]*sr+fr.v[2]*cr];
  gl.useProgram(PW); gl.bindVertexArray(meshVAO); gl.uniform1f(LW.fmode,0); gl.uniform1f(LW.covHalf, curCovHalf()); // dome path: ensure flat mode off (a prior flat composite left u_flat=1); coverage half-angle drives the fisheye radius
  gl.uniform3fv(LW.d,fr.d); gl.uniform3fv(LW.u,U); gl.uniform3fv(LW.v,V);
  gl.uniform2f(LW.half,ax,ay); gl.uniform1f(LW.mir,c.props.mirror?-1:1); gl.uniform1f(LW.op,op);
  gl.uniform1f(LW.cull, state.view.cull?1:0);
  const sector=(c.props.warp==='dome'); gl.uniform1f(LW.sector, sector?1:0); gl.uniform1f(LW.tile, sector?1:0); // dome-tile (annular sector) → seamless rings/grids that follow the dome's az/el grid (tiles skip edge feather/aspect → no seams)
  gl.uniform1f(LW.maskScale, c.props.maskScale||1);
  if(sector){ gl.uniform1f(LW.azC, az*D2R); gl.uniform1f(LW.azSpan, (c.props.secAz||60)*D2R); gl.uniform1f(LW.elC, el*D2R); gl.uniform1f(LW.elSpan, (c.props.secEl||30)*D2R); }
  gl.uniform1f(LW.blur, (evalP(c,'blur',t)||0)*0.0016);
  gl.uniform1f(LW.feather, (evalP(c,'feather',t)||0)/100);
  gl.uniform1f(LW.crop, (evalP(c,'crop',t)||0)/100*0.9);
  gl.uniform1f(LW.mask, MASK_IDX[c.props.mask||'none']||0);
  gl.uniform1f(LW.exp,(evalP(c,'exposure',t)||0)/100); gl.uniform1f(LW.con,(evalP(c,'contrast',t)||0)/100); gl.uniform1f(LW.sat,(evalP(c,'saturation',t)||0)/100);
  gl.uniform1f(LW.tmp,(evalP(c,'temperature',t)||0)/100*0.15); gl.uniform1f(LW.tnt,(evalP(c,'tint',t)||0)/100*0.15);
  gl.uniform1f(LW.glow,(evalP(c,'glow',t)||0)/100); gl.uniform1f(LW.ca,(evalP(c,'chroma',t)||0)/100); bindClipLUT(c);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,ntex); gl.uniform1i(LW.tex,0);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, c.maskTex||ntex); gl.uniform1i(LW.maskTex,1);
  const bm=c.props.blend||'normal'; setBlend(bm); gl.uniform1f(LW.premul,(bm==='screen'||bm==='multiply')?1:0); gl.uniform1f(LW.blend,BLEND_ID[bm]||0);
  gl.drawElements(gl.TRIANGLES,meshCount,gl.UNSIGNED_INT,0);
  if(bm!=='normal') NORMAL_BLEND();
}
function activeClips(t){ const out=[]; for(const li of state.lanes.map((_,i)=>i)){ let best=null;
  for(const c of state.clips) if(c.lane===li && t>=c.start && t<c.start+c.dur) best=c; if(best)out.push(best);} return out; }
function compositeClips(t){ const anySolo=state.lanes.some(l=>l.kind==='video'&&l.solo); const out=[];
  for(let li=0;li<state.lanes.length;li++){ const lane=state.lanes[li]; if(!lane||lane.kind!=='video'||lane.mute||(anySolo&&!lane.solo))continue;
    const act=state.clips.filter(c=>c.lane===li&&!c.disabled&&t>=c.start&&t<c.start+c.dur).sort((a,b)=>a.start-b.start); // disabled (Ableton "0") clips are invisible
    if(!act.length)continue;
    const n=act.length;
    for(let i=0;i<n-2;i++) out.push({c:act[i],xf:1});               // underlying overlaps stay visible (painter order)
    if(n===1){ out.push({c:act[0],xf:1}); continue; }
    const a=act[n-2],b=act[n-1],ovS=b.start,ovE=Math.min(a.start+a.dur,b.start+b.dur),denom=ovE-ovS;
    if(denom>1e-6&&t>=ovS){const f=Math.max(0,Math.min(1,(t-ovS)/denom));
      // clean A→B dissolve: keep A fully under, fade B in over it → result stays opaque, no mid brightness/alpha dip (video & photo). dipBlack still ramps both to/from black.
      let aXf=1,bXf=f; if(b.trans==='dipBlack'){aXf=Math.max(0,1-2*f);bXf=Math.max(0,2*f-1);} out.push({c:a,xf:aXf});out.push({c:b,xf:bXf});}
    else {out.push({c:a,xf:1});out.push({c:b,xf:1});}
  } return out; }
function composite(t,size,opaque){
  gl.viewport(0,0,size,size); gl.clearColor(0,0,0,opaque?1:0); gl.clear(gl.COLOR_BUFFER_BIT);
  for(const x of compositeClips(t)){ if(x.c.adjust) drawAdjustment(x.c,t,x.xf); else drawClip(x.c,mediaById(x.c.mediaId),t,x.xf); }
}

/* ===================== RENDER ===================== */
let VSIZE=400;
function f2pix(nx,ny){const z=state.view.zoom,p=state.view.pan,W=view.cw,H=view.ch,mn=Math.min(W,H),ax=mn/W,ay=mn/H;const ndx=(nx-p[0])*z*ax,ndy=(ny-p[1])*z*ay;return[(ndx*0.5+0.5)*W,(1-(ndy*0.5+0.5))*H];}
function pix2f(px,py){const z=state.view.zoom,p=state.view.pan,W=view.cw,H=view.ch,mn=Math.min(W,H),ax=mn/W,ay=mn/H;const ndx=px/W*2-1,ndy=(1-py/H)*2-1;return[ndx/(z*ax)+p[0],ndy/(z*ay)+p[1]];}
/* fisheye f(nx,ny) -> az/el (design 2D master inverse) */
function f2azel(nx,ny){const r=Math.hypot(nx,ny); if(r<1e-6)return{az:0,el:90};
  const zen=Math.min(r,1)*curCovHalf(); const h=Math.atan2(nx,-ny); // rho→zenith scaled by coverage (edge = covHalf, which can dip below the horizon for >180°)
  const el=(HALF_PI-zen)*R2D; let az=h*R2D; az=((az%360)+360)%360; return{az,el};}
function azel2f(az,el){const zen=(90-el)*D2R; const rho=zen/curCovHalf(); const h=az*D2R; return[rho*Math.sin(h), -rho*Math.cos(h)];}

let exporting=false;
let _scopesCv=null,_scopesT=0;
function drawScopes(){ if(!state.view.showScopes){ if(_scopesCv)_scopesCv.style.display='none'; return; }
  const now=performance.now(); if(_scopesCv&&_scopesCv.style.display!=='none'&&now-_scopesT<120)return; _scopesT=now;
  if(!_scopesCv){ _scopesCv=document.createElement('canvas'); _scopesCv.width=256; _scopesCv.height=120; _scopesCv.style.cssText='position:fixed;z-index:50;border-radius:2px;box-shadow:0 4px 16px rgba(0,0,0,.5);pointer-events:none;background:rgba(8,9,11,.82);'; document.body.appendChild(_scopesCv); }
  const r=gridc.getBoundingClientRect(); _scopesCv.style.display='block'; _scopesCv.style.left=(r.left+10)+'px'; _scopesCv.style.top=(r.bottom-130)+'px';
  const W=glc.width,H=glc.height, buf=new Uint8Array(W*H*4); try{ gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,buf); }catch(e){ return; }
  const bins=64, hr=new Float32Array(bins),hg=new Float32Array(bins),hb=new Float32Array(bins);
  for(let i=0;i<buf.length;i+=28){ if(buf[i+3]<8)continue; hr[buf[i]>>2]++; hg[buf[i+1]>>2]++; hb[buf[i+2]>>2]++; }
  let mx=1; for(let k=0;k<bins;k++)mx=Math.max(mx,hr[k],hg[k],hb[k]);
  const cx=_scopesCv.getContext('2d'); cx.clearRect(0,0,256,120); cx.globalCompositeOperation='lighter';
  const plot=(hh,col)=>{ cx.fillStyle=col; const bw=256/bins; for(let k=0;k<bins;k++){ const bh=hh[k]/mx*112; cx.fillRect(k*bw,120-bh,bw,bh); } };
  plot(hr,'rgba(230,70,70,.65)'); plot(hg,'rgba(70,220,100,.6)'); plot(hb,'rgba(80,140,245,.6)'); cx.globalCompositeOperation='source-over';
  cx.fillStyle=UI.inkDim; cx.font='11px Geist'; cx.fillText('RGB',6,12); }
/* ===================== NESTS (compound sub-sequences) ===================== */
/* per-FRAME pool of COMP² nest render targets (reused every frame → no leak). Each active nest CLIP gets its own slot so the SAME nest media on two clips at different local times renders two different frames (not last-prep-wins). */
const _nestPool=[]; let _nestN=0;
/* nest render resolution: COMP (2048) for live preview; bumped to the export resolution during export so
   compositions/dome-fills aren't capped at 2048 then upscaled (that was the "pauperrima" export quality). */
let nestSize=COMP;
function nestSlot(){ let e=_nestPool[_nestN];
  if(!e){ const tex=newTex(); const fbo=gl.createFramebuffer(); e={fbo,tex,size:0}; _nestPool[_nestN]=e; }
  if(e.size!==nestSize){ gl.bindTexture(gl.TEXTURE_2D,e.tex); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,nestSize,nestSize,0,gl.RGBA,gl.UNSIGNED_BYTE,null); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE); gl.bindTexture(gl.TEXTURE_2D,null); gl.bindFramebuffer(gl.FRAMEBUFFER,e.fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,e.tex,0); gl.bindFramebuffer(gl.FRAMEBUFFER,null); e.size=nestSize; }
  _nestN++; return e; }
function freeNestPool(){ for(const e of _nestPool){ try{gl.deleteTexture(e.tex);}catch(_){} try{gl.deleteFramebuffer(e.fbo);}catch(_){} } _nestPool.length=0; _nestN=0; }
function prepNests(clips,t,depth){ if(!depth)_nestN=0; if((depth||0)>5||!clips)return; // post-order: render inner nests first, then each clip into its own slot
  for(const c of clips){ const m=mediaById(c.mediaId); if(!m||!isSeqMedia(m)){ c._ntex=null; continue; } if(t<c.start||t>=c.start+c.dur){ c._ntex=null; continue; }
    const lt=srcT(c,t); prepNests(m.nestClips,lt,(depth||0)+1);
    const e=nestSlot(); const oc=state.clips,ol=state.lanes,odf=_drawFlat,oca=_compAspect,orw=_roomWrap; state.clips=m.nestClips||[]; state.lanes=(m.nestLanes&&m.nestLanes.length?m.nestLanes:ol); _drawFlat=flatLikeMode(m.mode); _roomWrap=false; _compAspect=(m.w||1)/(m.h||1); gl.bindFramebuffer(gl.FRAMEBUFFER,e.fbo); composite(lt,nestSize,false); gl.bindFramebuffer(gl.FRAMEBUFFER,null); state.clips=oc; state.lanes=ol; _drawFlat=odf; _roomWrap=orw; _compAspect=oca; c._ntex=e.tex; } }
/* active video media at time t, descending into active nests (local-time-adjusted), deduped by media — so playback/scrub drive videos INSIDE nests, not just top-level clips. */
function collectActiveVideos(clips,lanes,t,depth,out,seen){ out=out||[]; seen=seen||new Set(); if((depth||0)>5||!clips||!lanes)return out;
  for(let li=0;li<lanes.length;li++){ let best=null; for(const c of clips){ if(c.lane===li && t>=c.start && t<c.start+c.dur) best=c; } if(!best)continue;
    const m=mediaById(best.mediaId); if(!m)continue; const lt=(best.inP||0)+(t-best.start);
    if(m.kind==='video'){ if(!seen.has(m.id)){ seen.add(m.id); out.push({m,local:lt}); } }
    else if(m.kind==='nest'&&m.nestClips){ collectActiveVideos(m.nestClips,m.nestLanes||lanes,lt,(depth||0)+1,out,seen); } }
  return out; }
function nestSelection(){ const ids=(state.selIds&&state.selIds.length)?state.selIds.slice():(state.selId!=null?[state.selId]:[]); const clips=ids.map(clipById).filter(Boolean); if(!clips.length){flashStatus(T('Select clips to nest','Selecciona clips para anidar'));return;}
  pushUndo();
  const minStart=Math.min(...clips.map(c=>c.start)), maxEnd=Math.max(...clips.map(c=>c.start+c.dur)), dur=Math.max(0.1,maxEnd-minStart);
  const used=[...new Set(clips.map(c=>c.lane))].sort((a,b)=>a-b); const lm={};
  const nestLanes=used.map((li,i)=>{ lm[li]=i; const L=state.lanes[li]; return {id:uid(),name:(L?L.name:'Video '+(i+1)),tag:(L?L.tag:'V'+(i+1)),kind:(L?L.kind:'video')}; });
  if(!nestLanes.length)nestLanes.push({id:uid(),name:'Video 1',tag:'V1',kind:'video'});
  const nestClips=clips.map(c=>({...c,id:uid(),start:c.start-minStart,lane:(lm[c.lane]||0),props:{...c.props},kf:JSON.parse(JSON.stringify(c.kf||{})),fx:JSON.parse(JSON.stringify(c.fx||[])),maskTex:null,_penCv:null,penMasks:c.penMasks?JSON.parse(JSON.stringify(c.penMasks)):undefined})); nestClips.forEach((nc,i)=>sepAuto(nc,clips[i]));
  for(const nc2 of nestClips)if(nc2.maskData||(nc2.penMasks&&nc2.penMasks.length))rebuildMaskTex(nc2);
  const nest=newSeqMedia(T('Nest ','Nido ')+(state.media.filter(isSeqMedia).length+1), state.fps, state.seqW, state.seqH, nestClips, nestLanes, isFlat()?'flat':'dome'); nest.dur=dur; // [R92-T1 C4] inherit the compositing mode — a nest made in a 2D/room sequence must NOT default to dome warping (room content nests as flat: the strip IS rectangular)
  state.media.push(nest);
  { const rx=state.reactive; if(rx&&rx.srcClipId!=null){ const ri=clips.findIndex(c=>c.id===rx.srcClipId); if(ri>=0){ rx.srcClipId=nestClips[ri].id; _arCache=null; try{arRecompute();}catch(e){} } } } // [R92-T1 C5] the reactive source clip gets a NEW id inside the nest — remap so audio-reactive FX keep reacting
  state.clips=state.clips.filter(c=>!ids.includes(c.id));
  const nc=makeClip(nest,(used[0]||0),minStart); nc.dur=dur; nc.props.fulldome=!isFlat(); state.clips.push(nc);
  state.selId=nc.id; state.selIds=[nc.id]; renderMedia(); renderSeqBar(); renderTimeline(); renderInspector(); render(); markDirty(); flashStatus(clips.length+T(' clips → nest','  clips → nido')); }
/* [T4] render-ahead: cache the flattened master composite per frame (downscaled via blitFramebuffer),
   so heavy playback can replay one flat texture instead of recompositing N layers + decoding N videos.
   The master composite is view-independent → serves both 2D and 3D. Flag-gated (_raOn, default off);
   a generation counter (bumped on edit) cheaply invalidates without deleting textures. */
let _raOn=false; const _ra=new Map(), _raPool=[]; let _raClock=0,_raGen=0,_raFBO=null; const RA_SIZE=1024,RA_MAX=120;
function raMakeTex(){ const t=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,t); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,RA_SIZE,RA_SIZE,0,gl.RGBA,gl.UNSIGNED_BYTE,null); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE); return t; }
function raReset(){ for(const [,v] of _ra){try{gl.deleteTexture(v.tex);}catch(e){}} _ra.clear(); while(_raPool.length){try{gl.deleteTexture(_raPool.pop());}catch(e){}} }
function raInvalidate(){ _raGen++; }
function _raFrame(t){ return Math.round(t*(state.fps||30)); }
function raGet(t){ if(!_raOn)return null; const e=_ra.get(_raFrame(t)); if(e&&e.gen===_raGen){ e.last=++_raClock; return e.tex; } return null; }
function raStore(t){ if(!_raOn)return; if(anyFeedbackFx())return; const F=_raFrame(t); const ex=_ra.get(F); if(ex&&ex.gen===_raGen){ex.last=++_raClock;return;} // feedback (Trails) is path-dependent → never cache, else scrubbing bakes temporally-wrong echoes
  if(!_raFBO)_raFBO=gl.createFramebuffer();
  const tex=ex?ex.tex:(_raPool.length?_raPool.pop():raMakeTex());
  gl.bindFramebuffer(gl.FRAMEBUFFER,_raFBO); gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER,compFBO); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,_raFBO);
  gl.blitFramebuffer(0,0,compSize,compSize, 0,0,RA_SIZE,RA_SIZE, gl.COLOR_BUFFER_BIT, gl.LINEAR);
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER,null); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,null); gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  _ra.set(F,{tex,last:++_raClock,gen:_raGen});
  if(_ra.size>RA_MAX){ let ok=null,ot=Infinity; for(const [k,v] of _ra){ if(v.last<ot){ot=v.last;ok=k;} } if(ok!=null){ const ev=_ra.get(ok); _ra.delete(ok); _raPool.push(ev.tex); } } }
/* [T4] cache-map bar — draws a Premiere-style render strip along the bottom of the ruler showing which frames are cached (current generation). */
function drawCacheMap(){ const rc=$('#rulerCv'), sc=$('#tlscroll'); if(!rc||!rc.width)return; const dpr=Math.min(window.devicePixelRatio||1,2); const sl=sc?(sc.scrollLeft||0):0; const vw=rc.width/dpr; const rx=rc.getContext('2d'); rx.setTransform(dpr,0,0,dpr,-sl*dpr,0); rx.clearRect(sl,19.5,vw,2.5); if(!_raOn)return; const pps=state.tl.pxPerSec, fps=state.fps||30, fw=Math.max(1,pps/fps); rx.fillStyle='#9EA5AD'; for(const [F,v] of _ra){ if(v.gen!==_raGen)continue; const x=(F/fps)*pps; if(x<sl-fw||x>sl+vw)continue; rx.fillRect(x,19.5,fw+0.6,2.5); } }
function raHas(t){ if(!_raOn)return false; const e=_ra.get(_raFrame(t)); return !!(e&&e.gen===_raGen); }
function _raVidFrame(m,t,c){ return Math.round(srcT(c,t)*(m.fps||30)); } // source-time mapping honors per-clip speed (R80)
/* [T4] pre-render a time range into the cache ("render in/out"). Decodes each active video layer's
   frame into the [T3] cache (async), then composites SYNCHRONOUSLY from those cached textures
   (saving/restoring m.tex with no await between) → atomic, no race with ploop. */
async function raPrerenderRange(t0,t1,onProg){ _raOn=true; try{fxResetHistory();}catch(e){} const fps=state.fps||30; const F0=Math.round(t0*fps),F1=Math.round(t1*fps); let done=0; const total=Math.max(1,F1-F0+1);
  for(let F=F0;F<=F1;F++){ const t=F/fps;
    if(!raHas(t)){ _arTime=t; await Promise.all(collectDrawnVideoClips(state.clips,state.lanes,t,0,[]).map(({c,m,local})=>vinstSeek(c,m,local))); // per-CLIP decode so nested/duplicated videos cache at their OWN local time
      prepNests(state.clips,t,0); // render active nests into their FBOs (now sampling the decoded frame for t)
      gl.bindFramebuffer(gl.FRAMEBUFFER,compFBO); composite(t,compSize,false); gl.bindFramebuffer(gl.FRAMEBUFFER,null); raStore(t); }
    done++; if(onProg&&(done%8===0||done===total))onProg(done,total); }
  return total; }
let _raIdleOn=false,_raIdleT=0;
function raStopIdle(){ _raIdleOn=false; if(_raIdleT){clearTimeout(_raIdleT);_raIdleT=0;} }
function raStartIdle(){ if(_raIdleOn)return; _raIdleOn=true; _raIdleT=setTimeout(raIdleTick,150); }
/* [T4] background scheduler: while render-ahead is on and the app is idle, pre-render the next
   uncached frame of the work-area into the cache; re-fills automatically after edits (gen bump). */
async function raIdleTick(){ _raIdleT=0; if(!_raIdleOn||!_raOn){ _raIdleOn=false; return; } let delay=150;
  if(!state.playing&&!exporting){ const fps=state.fps||30,dur=duration(); let t0=state.workIn!=null?state.workIn:0,t1=state.workOut!=null?state.workOut:dur; if(t1<=t0)t1=dur; const maxSpan=RA_MAX/fps; if(t1-t0>maxSpan)t1=t0+maxSpan;
    const F0=Math.round(t0*fps),F1=Math.round(t1*fps); let target=-1; for(let F=F0;F<=F1;F++){ if(!raHas(F/fps)){ target=F; break; } }
    if(target>=0){ try{ await raPrerenderRange(target/fps,target/fps); drawCacheMap(); }catch(e){} delay=0; } else delay=500; }
  if(_raIdleOn) _raIdleT=setTimeout(raIdleTick,delay); }
async function renderAheadWork(){ if(typeof HAS_WC!=='undefined'&&!HAS_WC){ flashStatus(T('Render-ahead needs WebCodecs','Render-ahead requiere WebCodecs'),'err'); return; } // [R94-UT3·U-21]
  const dur=duration(); let t0=state.workIn!=null?state.workIn:0, t1=state.workOut!=null?state.workOut:dur; if(t1<=t0)t1=dur;
  const fps=state.fps||30, maxSpan=RA_MAX/fps; let trunc=false; if(t1-t0>maxSpan){ t1=t0+maxSpan; trunc=true; }
  _raOn=true; state.renderAhead=true; raInvalidate(); flashStatus(T('Rendering ahead…','Renderizando…'));
  try{ await raPrerenderRange(t0,t1,(d,n)=>{ if(d%16===0)flashStatus(T('Rendering ahead… ','Renderizando… ')+Math.round(d/n*100)+'%'); });
    flashStatus(T('Render-ahead ready (auto-maintained)','Render-ahead listo (auto-mantenido)')+(trunc?(' · '+maxSpan.toFixed(1)+'s'):'')); render(); drawCacheMap(); raStartIdle();
  }catch(e){ console.warn('render-ahead',e); flashStatus(T('Render-ahead failed','Render-ahead falló'),'err'); } } // [R94-UT3·U-21]
function renderAheadOff(){ raStopIdle(); _raOn=false; state.renderAhead=false; raReset(); flashStatus(T('Render-ahead off · cache cleared','Render-ahead apagado · caché limpiado')); render(); drawCacheMap(); }
/* ===================== 3D ROOM VIEWER (F4) ===================== */
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
/* build the room's textured-quad geometry (normalized + centered) into roomVB; caches per active seq id */
function buildRoomGeo(seq){ const room=seq.room; const plan=roomPlan(room.walls); const stripW=seq.w||1, stripH=seq.h||1;
  let cx=0,cy=0,cnt=0; for(const s of plan.seg){ cx+=s.a[0]+s.b[0]; cy+=s.a[1]+s.b[1]; cnt+=2; } cx/=Math.max(1,cnt); cy/=Math.max(1,cnt);
  let rad=0.5,maxH=0.5; for(const s of plan.seg){ for(const p of [s.a,s.b])rad=Math.max(rad,Math.hypot(p[0]-cx,p[1]-cy)); maxH=Math.max(maxH,s.h); }
  const sc=1/Math.max(rad,maxH*0.6,0.5); const N=(x,y,z)=>[(x-cx)*sc,(y-cy)*sc,z*sc];
  const V=[]; const push=(P,u,v,sh,nx,ny)=>{ V.push(P[0],P[1],P[2],u,v,sh,nx||0,ny||0); }; // pos(3) uv(2) shade(1) inward-normal xy(2) = 8 floats
  const As=stripW/stripH, Fy=Math.min(1,1/As), vMax=(1+Fy)/2; const L=[0.32,-0.55]; // strip UV consts + light dir (xy) for shading
  const byRole={}; for(const w of room.walls)byRole[w.role]=w;
  for(const s of plan.seg){ const w=byRole[s.role]; const uL=w?(w.x1||stripW)/stripW:1, uR=w?(w.x0||0)/stripW:0; const pxH=w?w.pxH:stripH; const vBot=vMax-(pxH/stripH)*Fy, vTop=vMax; // uL/uR swapped: from INSIDE the room the wall's a→b runs right→left, so the strip content matches the 2D viewer (not mirrored)
    const A0=N(s.a[0],s.a[1],0),B0=N(s.b[0],s.b[1],0),Bt=N(s.b[0],s.b[1],s.h),At=N(s.a[0],s.a[1],s.h);
    let nx=-(s.b[1]-s.a[1]), ny=(s.b[0]-s.a[0]); const nl=Math.hypot(nx,ny)||1; nx/=nl; ny/=nl; const sh=0.62+0.38*Math.max(0,0.5+0.5*(nx*L[0]+ny*L[1])); // nx,ny = inward normal (CCW loop → left of travel = interior)
    push(A0,uL,vBot,sh,nx,ny); push(B0,uR,vBot,sh,nx,ny); push(Bt,uR,vTop,sh,nx,ny); push(A0,uL,vBot,sh,nx,ny); push(Bt,uR,vTop,sh,nx,ny); push(At,uL,vTop,sh,nx,ny); }
  const wallVerts=V.length/8; let floorVerts=0;
  if(room.floor && plan.poly && plan.poly.length>=3){ const poly=plan.poly; let mnx=1e9,mxx=-1e9,mny=1e9,mxy=-1e9; for(const p of poly){mnx=Math.min(mnx,p[0]);mxx=Math.max(mxx,p[0]);mny=Math.min(mny,p[1]);mxy=Math.max(mxy,p[1]);}
    const Af=(room.floor.pxW||1)/(room.floor.pxH||1),Fxf=Math.min(1,Af),Fyf=Math.min(1,1/Af); const uMn=(1-Fxf)/2,uMx=(1+Fxf)/2,vMn=(1-Fyf)/2,vMx=(1+Fyf)/2;
    const fuv=(x,y)=>[uMn+(mxx-x)/((mxx-mnx)||1)*(uMx-uMn), vMn+(y-mny)/((mxy-mny)||1)*(vMx-vMn)]; // U flipped to match the walls' inside-view handedness (2D floor editor orientation)
    for(let i=1;i<poly.length-1;i++){ const q=[poly[0],poly[i],poly[i+1]]; for(const p of q){ const P=N(p[0],p[1],0),u=fuv(p[0],p[1]); push(P,u[0],u[1],0.5,0,0); } }
    floorVerts=(V.length/8)-wallVerts; }
  gl.bindVertexArray(roomVAO); gl.bindBuffer(gl.ARRAY_BUFFER,roomVB); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(V),gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(LR.pos); gl.vertexAttribPointer(LR.pos,3,gl.FLOAT,false,32,0);
  gl.enableVertexAttribArray(LR.uv); gl.vertexAttribPointer(LR.uv,2,gl.FLOAT,false,32,12);
  gl.enableVertexAttribArray(LR.shade); gl.vertexAttribPointer(LR.shade,1,gl.FLOAT,false,32,20);
  gl.enableVertexAttribArray(LR.nrm); gl.vertexAttribPointer(LR.nrm,2,gl.FLOAT,false,32,24); gl.bindVertexArray(null);
  _roomGeo={ wallVerts, floorVerts, norm:{ cx,cy,sc, midZ:(maxH*0.5)*sc, standZ:Math.min(maxH*0.95,1.7)*sc, radius:rad*sc } }; _roomGeoSeq=seq.id; }
/* project the room's wall grid (3×4 subdivision, proportional) + per-wall role labels onto the 2D overlay, using the same 3D camera matrix. Gated by the Grid toggle. */
function drawRoomLabels3D(mvp){ gx.clearRect(0,0,view.cw,view.ch); if(!state.view.showGrid||!_roomGeo||!_roomGeo.norm)return; const seq=activeSeq(); const room=seq&&seq.room; if(!room)return;
  const {cx,cy,sc}=_roomGeo.norm; const N=(x,y,z)=>[(x-cx)*sc,(y-cy)*sc,z*sc]; const P=(x,y,z)=>proj3(N(x,y,z),mvp,1);
  const plan=roomPlan(room.walls); const seg=(l0)=>{gx.beginPath();gx.moveTo(l0[0][0],l0[0][1]);gx.lineTo(l0[1][0],l0[1][1]);gx.stroke();};
  for(const s of plan.seg){ const h=s.h; const pt=(u,v)=>{ const x=s.a[0]+(s.b[0]-s.a[0])*u, y=s.a[1]+(s.b[1]-s.a[1])*u; return P(x,y,h*v); };
    gx.lineWidth=1;
    for(let i=0;i<=ROOM_GRID_COLS;i++){ const a=pt(i/ROOM_GRID_COLS,0), b=pt(i/ROOM_GRID_COLS,1); if(a&&b){ gx.strokeStyle=(i===0||i===ROOM_GRID_COLS)?'rgba(255,255,255,0.34)':'rgba(255,255,255,0.13)'; seg([a,b]); } }
    for(let j=0;j<=ROOM_GRID_ROWS;j++){ const a=pt(0,j/ROOM_GRID_ROWS), b=pt(1,j/ROOM_GRID_ROWS); if(a&&b){ gx.strokeStyle=(j===0||j===ROOM_GRID_ROWS)?'rgba(255,255,255,0.34)':'rgba(255,255,255,0.13)'; seg([a,b]); } }
    // wall-role label PAINTED ON the wall plane (affine decal → follows perspective like the grid), small, in the bottom-left corner (from INSIDE). Aspect-corrected so it isn't stretched.
    const lbl=roomRoleLabel(s.role).toUpperCase(); const Fpx=44; gx.save(); gx.font='700 '+Fpx+'px Geist'; const tw=Math.max(1,gx.measureText(lbl).width), th=Fpx;
    const wallW=Math.hypot(s.b[0]-s.a[0],s.b[1]-s.a[1])||1, wallH=s.h||1; const wv=0.03, wu=Math.min(0.9, wv*(tw/th)*(wallH/wallW)); // wu from text aspect × wall's physical aspect → no horizontal stretch
    const uA=0.96, vA=0.04; const O=pt(uA,vA), Xp=pt(Math.max(0.02,uA-wu),vA), Yp=pt(uA,vA+wv);
    if(O&&Xp&&Yp){ gx.setTransform((Xp[0]-O[0])/tw,(Xp[1]-O[1])/tw,(O[0]-Yp[0])/th,(O[1]-Yp[1])/th,Yp[0],Yp[1]); gx.textAlign='left'; gx.textBaseline='top'; gx.fillStyle='rgba(208,212,218,0.5)'; gx.fillText(lbl,0,0); }
    gx.restore(); }
}
function roomCameraMVP(spec,aspect){ const g=(_roomGeo&&_roomGeo.norm)||{midZ:0.25,standZ:0.35,radius:1}; const cam=state.view.cam; aspect=aspect||(glc.width/glc.height||1);
  const proj=persp((spec?cam.fov:52)*D2R,aspect,0.005,60); let eye,ctr;
  if(spec){ const f=[Math.cos(cam.pitch)*Math.cos(cam.yaw),Math.cos(cam.pitch)*Math.sin(cam.yaw),Math.sin(cam.pitch)]; eye=[f[0]*cam.back,f[1]*cam.back,g.standZ+f[2]*cam.back]; ctr=[eye[0]+f[0],eye[1]+f[1],eye[2]+f[2]]; } // stand: eye at ~1.7m, look around (yaw/pitch), dolly along view
  else { ctr=[0,0,g.midZ]; const d=cam.dist; eye=[Math.cos(cam.pitch)*Math.cos(cam.yaw)*d,Math.cos(cam.pitch)*Math.sin(cam.yaw)*d,g.midZ+Math.sin(cam.pitch)*d]; }
  return {mvp:mul4(proj,lookAt(eye,ctr,[0,0,1])), eye}; }
function renderRoom3D(wallsTex){ const seq=activeSeq(); const room=seq&&seq.room; const W=glc.width,H=glc.height;
  gl.bindFramebuffer(gl.FRAMEBUFFER,null); gl.viewport(0,0,W,H); gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.clearColor(0,0,0,state.view.checkerBg?0:1); gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT); // [F8] transparent → CSS checkerboard shows behind the room
  if(!room){ gl.disable(gl.DEPTH_TEST); return; }
  if(_roomGeoSeq!==seq.id||!_roomGeo)buildRoomGeo(seq);
  let floorTex=null; if(room.floorSeqId){ const fm=mediaById(room.floorSeqId); if(fm&&isSeqMedia(fm))floorTex=compositeFloorTex(fm,1024); }
  gl.bindFramebuffer(gl.FRAMEBUFFER,null); gl.viewport(0,0,W,H); // compositeFloorTex rebinds → restore
  const cam=roomCameraMVP(state.view.three==='spec',W/H);
  gl.useProgram(PR); gl.uniformMatrix4fv(LR.mvp,false,new Float32Array(cam.mvp)); gl.uniform3f(LR.base,0,0,0); gl.uniform1i(LR.tex,0); // wall bg = black (matches the 2D strip); content shows over it, grid overlay gives structure
  gl.uniform3f(LR.cam,cam.eye[0],cam.eye[1],cam.eye[2]); gl.uniform1f(LR.outTex,state.view.roomOutTex?1:0); gl.uniform1f(LR.backA,0.17);
  gl.bindVertexArray(roomVAO); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,wallsTex);
  if(_roomGeo.wallVerts>0){ // pass 1: inside surfaces opaque (depth write) · pass 2: outside surfaces translucent (no depth write) → single composite, see-through from outside
    gl.depthMask(true); gl.uniform1f(LR.pass,1); gl.drawArrays(gl.TRIANGLES,0,_roomGeo.wallVerts);
    gl.depthMask(false); gl.uniform1f(LR.pass,0); gl.drawArrays(gl.TRIANGLES,0,_roomGeo.wallVerts); gl.depthMask(true); }
  if(floorTex&&_roomGeo.floorVerts>0){ gl.bindTexture(gl.TEXTURE_2D,floorTex); gl.uniform1f(LR.pass,2); gl.drawArrays(gl.TRIANGLES,_roomGeo.wallVerts,_roomGeo.floorVerts); }
  gl.bindVertexArray(null); gl.disable(gl.DEPTH_TEST); drawRoomLabels3D(cam.mvp); }
function render(){ if(glLost)return;
  if(exporting)return;
  const _flat=isFlat(); _drawFlat=_flat; _roomWrap=isRoom(); _compAspect=(state.seqW||1)/(state.seqH||1); _arTime=state.playhead;
  let _srcTex=compTex; const _raHit=raGet(state.playhead);
  if(_raHit){ _srcTex=_raHit; }
  else { prepNests(state.clips,state.playhead,0);
    gl.bindFramebuffer(gl.FRAMEBUFFER,compFBO); composite(state.playhead,compSize,false); gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    raStore(state.playhead); }
  if(masterGradeOn())_srcTex=applyMasterGrade(_srcTex,compSize); // [master grade] grade the FINAL composite — post render-ahead cache so grade edits stay live (not baked) and every view mode (2D/dome/room/viewer) shows it
  const W=glc.width,H=glc.height;
  if(state.view.mode==='3d' && isRoom()){ renderRoom3D(_srcTex); }
  else if(state.view.mode==='3d' && !_flat){
    gl.viewport(0,0,W,H); gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
    gl.clearColor(0,0,0,state.view.checkerBg?0:1); gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT); // [F8] transparent clear lets the CSS checkerboard show behind the dome
    const spec=state.view.three==='spec'; const mvp=cameraMVP(spec);
    buildDomeMesh(curCovHalf()); // cap geometry follows the sequence's coverage (cheap: rebuilds only on change)
    gl.useProgram(P3); gl.bindVertexArray(domeVAO);
    gl.uniformMatrix4fv(L3.mvp,false,new Float32Array(mvp)); gl.uniform1f(L3.grid,state.view.showGrid?1:0);
    gl.uniform1f(L3.flipx, -1); // orbit + spec both use the in-dome (audience) handedness so Right/Left aren't mirrored between modes
    gl.uniform1f(L3.hfade, state.view.hfade?HFADE:0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,_srcTex); gl.uniform1i(L3.master,0);
    gl.drawElements(gl.TRIANGLES,domeCount,gl.UNSIGNED_INT,0); gl.bindVertexArray(null); gl.disable(gl.DEPTH_TEST);
    drawLabels3D(mvp,spec);
  } else {
    gl.disable(gl.DEPTH_TEST); gl.viewport(0,0,W,H); gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(PB); gl.bindVertexArray(quadVAO);
    gl.uniform2f(LB.pan,state.view.pan[0],state.view.pan[1]); gl.uniform1f(LB.zoom,state.view.zoom);
    if(_flat){ const A=_compAspect, s=Math.min(2/A,2), Fx=s*A/2, Fy=s/2, wa=glc.width/glc.height; let sx,sy; if(A>=wa){ sx=1; sy=wa/A; } else { sy=1; sx=A/wa; }
      gl.uniform2f(LB.aspect,sx,sy); gl.uniform1f(LB.flat,1); gl.uniform2f(LB.uvsc,Fx,Fy); gl.uniform2f(LB.uvof,(1-Fx)/2,(1-Fy)/2); gl.uniform1f(LB.hfade,0); }
    else { const mn=Math.min(glc.width,glc.height); gl.uniform2f(LB.aspect, mn/glc.width, mn/glc.height); gl.uniform1f(LB.flat,0); gl.uniform2f(LB.uvsc,1,1); gl.uniform2f(LB.uvof,0,0); gl.uniform1f(LB.hfade, state.view.hfade?HFADE:0); }
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,_srcTex); gl.uniform1i(LB.tex,0);
    gl.drawArrays(gl.TRIANGLES,0,6); gl.bindVertexArray(null);
    drawGrid2D();
  }
  drawScopes();
  if(_viewerWin)renderViewer(_srcTex); // [V1] render the pop-out mirroring the editor mode (2D/3D) from the same composite texture
}
/* ===================== POP-OUT 3D VIEWER (independent dome on a second screen) ===================== */
let _viewerWin=null, _viewerCtx=null, _viewerCam={yaw:0.9,pitch:0.55,dist:3.2,fov:48}, _viewerGrid=false;
let _vFBO=null,_vTex=null,_vDepth=null,_vW=0,_vH=0,_vBuf=null,_vImg=null,_vImgCv=null;
/* A movable/resizable output window that MIRRORS the editor's current mode ([V1]): 3D dome (with its OWN orbit camera — drag to rotate, wheel to zoom, independent of the main viewport), 2D flat, or the 2D fisheye disc. Renders into an offscreen FBO at the window's aspect, reads it back, and draws it. Driven by the editor's render loop (backgroundThrottling:false → smooth on the unfocused second screen). */
function openViewerWindow(){ if(_viewerWin && !_viewerWin.closed){ try{_viewerWin.focus();}catch(e){} return; }
  const w=window.open('about:blank','domeViewer','width=960,height=960'); if(!w){ try{appAlert(T('Could not open the viewer window — allow pop-ups and try again.','No se pudo abrir el visor — permite las ventanas emergentes e inténtalo de nuevo.'));}catch(e){} return; }
  _viewerWin=w;
  try{ const d=w.document; d.title='Immersive Studio Pro — Viewer';
    d.documentElement.style.cssText='height:100%'; d.body.style.cssText='margin:0;height:100vh;background:#000;overflow:hidden;cursor:grab;';
    const cv=d.createElement('canvas'); cv.id='vwcv'; cv.style.cssText='position:fixed;inset:0;width:100%;height:100%;display:block;background:#000;'; d.body.appendChild(cv);
    _viewerCtx=cv.getContext('2d');
    // grid on/off toggle (overlay button, top-left) — the dome reference grid is off by default
    const gbtn=d.createElement('button'); gbtn.id='vwgrid';
    const paintGrid=()=>{ gbtn.textContent=(state.lang==='es'?'Grilla':'Grid')+' '+(_viewerGrid?'ON':'OFF'); gbtn.style.opacity=_viewerGrid?'1':'0.62'; };
    gbtn.style.cssText='position:fixed;top:10px;left:10px;z-index:10;height:24px;padding:0 11px;font:500 11px Geist,system-ui,sans-serif;letter-spacing:0.02em;color:var(--ink);background:rgba(20,22,26,0.78);border:.5px solid rgba(255,255,255,0.18);border-radius:2px;cursor:pointer;backdrop-filter:blur(6px);';
    paintGrid(); gbtn.onclick=()=>{ _viewerGrid=!_viewerGrid; paintGrid(); render(); }; d.body.appendChild(gbtn);
    // orbit + zoom the pop-out's OWN camera (independent of the main viewport)
    cv.addEventListener('pointerdown',ev=>{ ev.preventDefault(); const x0=ev.clientX,y0=ev.clientY,y=_viewerCam.yaw,p=_viewerCam.pitch; d.body.style.cursor='grabbing';
      const mv=e2=>{ _viewerCam.yaw=y-(e2.clientX-x0)*0.008; _viewerCam.pitch=Math.max(-1.35,Math.min(1.45,p+(e2.clientY-y0)*0.008)); render(); };
      const up=()=>{ try{d.body.style.cursor='grab';}catch(e){} w.removeEventListener('pointermove',mv); w.removeEventListener('pointerup',up); }; w.addEventListener('pointermove',mv); w.addEventListener('pointerup',up); });
    cv.addEventListener('wheel',ev=>{ ev.preventDefault(); _viewerCam.dist=Math.max(1.2,Math.min(12,_viewerCam.dist*Math.exp(ev.deltaY*0.0012))); render(); },{passive:false});
    w.addEventListener('resize',()=>{ try{render();}catch(e){} });
    w.addEventListener('beforeunload',()=>{ closeViewerGL(); _viewerWin=null; _viewerCtx=null; const b=$('#popoutBtn'); if(b)b.classList.remove('on'); });
    const b=$('#popoutBtn'); if(b)b.classList.add('on');
    render(); flashStatus(T('Viewer window opened — follows the editor (2D/3D); in 3D drag to orbit, wheel to zoom','Visor abierto — sigue al editor (2D/3D); en 3D arrastra para girar, rueda para zoom'));
  }catch(e){ _viewerWin=null; _viewerCtx=null; } }
function closeViewerGL(){ try{ if(_vFBO)gl.deleteFramebuffer(_vFBO); if(_vTex)gl.deleteTexture(_vTex); if(_vDepth)gl.deleteRenderbuffer(_vDepth); }catch(e){} _vFBO=_vTex=_vDepth=null; _vW=_vH=0; _vBuf=_vImg=null; }
function renderViewer(srcTex){ const w=_viewerWin; if(!w||w.closed||!_viewerCtx||!srcTex){ if(w&&w.closed){ closeViewerGL(); _viewerWin=null; _viewerCtx=null; const b=$('#popoutBtn'); if(b)b.classList.remove('on'); } return; }
  try{ const cv=w.document.getElementById('vwcv'); if(!cv)return; const dpr=w.devicePixelRatio||1;
    const W=Math.max(1,Math.round((w.innerWidth||960)*dpr)), H=Math.max(1,Math.round((w.innerHeight||960)*dpr));
    const cap=1280, sc=Math.min(1,cap/Math.max(W,H)); const rw=Math.max(2,Math.round(W*sc)), rh=Math.max(2,Math.round(H*sc));
    if(!_vFBO||_vW!==rw||_vH!==rh){ if(!_vFBO){_vFBO=gl.createFramebuffer();_vTex=gl.createTexture();_vDepth=gl.createRenderbuffer();}
      gl.bindTexture(gl.TEXTURE_2D,_vTex); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,rw,rh,0,gl.RGBA,gl.UNSIGNED_BYTE,null); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.bindFramebuffer(gl.FRAMEBUFFER,_vFBO); gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,_vTex,0);
      gl.bindRenderbuffer(gl.RENDERBUFFER,_vDepth); gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,rw,rh); gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,_vDepth);
      _vW=rw;_vH=rh; _vBuf=new Uint8Array(rw*rh*4); _vImg=new ImageData(rw,rh); if(!_vImgCv)_vImgCv=document.createElement('canvas'); _vImgCv.width=rw; _vImgCv.height=rh; }
    gl.bindFramebuffer(gl.FRAMEBUFFER,_vFBO); gl.viewport(0,0,rw,rh);
    const _vFlat=_drawFlat, _vDome3D=(state.view.mode==='3d' && !_vFlat && !_roomWrap); // [V1] the pop-out mirrors the editor: 3D dome (its OWN orbit cam) ↔ 2D (flat rect / fisheye disc). Room-3D falls to the flat strip (its 2D representation).
    if(_vDome3D){ gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.clearColor(0,0,0,1); gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      const mvp=cameraMVP(false,_viewerCam,rw/rh);
      buildDomeMesh(curCovHalf()); gl.useProgram(P3); gl.bindVertexArray(domeVAO); gl.uniformMatrix4fv(L3.mvp,false,new Float32Array(mvp)); gl.uniform1f(L3.grid,_viewerGrid?1:0); gl.uniform1f(L3.flipx,-1); gl.uniform1f(L3.hfade,state.view.hfade?HFADE:0); // pop-out viewer: grid off by default, toggled by its own button
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,srcTex); gl.uniform1i(L3.master,0);
      gl.drawElements(gl.TRIANGLES,domeCount,gl.UNSIGNED_INT,0); gl.bindVertexArray(null); gl.disable(gl.DEPTH_TEST);
    } else { // [V1] 2D blit — clean (no editor pan/zoom): flat = aspect-fit rect · dome-2D = centred fisheye disc
      gl.disable(gl.DEPTH_TEST); gl.clearColor(0,0,0,1); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(PB); gl.bindVertexArray(quadVAO); gl.uniform2f(LB.pan,0,0); gl.uniform1f(LB.zoom,1);
      if(_vFlat){ const A=_compAspect, s=Math.min(2/A,2), Fx=s*A/2, Fy=s/2, wa=rw/rh; let sx,sy; if(A>=wa){ sx=1; sy=wa/A; } else { sy=1; sx=A/wa; }
        gl.uniform2f(LB.aspect,sx,sy); gl.uniform1f(LB.flat,1); gl.uniform2f(LB.uvsc,Fx,Fy); gl.uniform2f(LB.uvof,(1-Fx)/2,(1-Fy)/2); gl.uniform1f(LB.hfade,0); }
      else { const mn=Math.min(rw,rh); gl.uniform2f(LB.aspect, mn/rw, mn/rh); gl.uniform1f(LB.flat,0); gl.uniform2f(LB.uvsc,1,1); gl.uniform2f(LB.uvof,0,0); gl.uniform1f(LB.hfade, state.view.hfade?HFADE:0); }
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,srcTex); gl.uniform1i(LB.tex,0);
      gl.drawArrays(gl.TRIANGLES,0,6); gl.bindVertexArray(null); }
    gl.readPixels(0,0,rw,rh,gl.RGBA,gl.UNSIGNED_BYTE,_vBuf); gl.bindFramebuffer(gl.FRAMEBUFFER,null); gl.viewport(0,0,glc.width,glc.height);
    _vImg.data.set(_vBuf); const ic=_vImgCv.getContext('2d'); ic.putImageData(_vImg,0,0);
    if(cv.width!==W||cv.height!==H){ cv.width=W; cv.height=H; }
    _viewerCtx.save(); _viewerCtx.setTransform(1,0,0,-1,0,H); _viewerCtx.drawImage(_vImgCv,0,0,rw,rh,0,0,W,H); _viewerCtx.restore(); // WebGL FBO is bottom-up → flip Y
  }catch(e){} }

/* ===================== NDI® OUTPUT — clean Dome master (1:1), 2048 or 4096 ===================== */
/* Broadcasts the fulldome master (no grid / no overlays) over the network. The master is composited into
   an offscreen FBO at the chosen size, read back (RGBA), and sent from the renderer via the native addon
   (preload) with a NEGATIVE line stride so the bottom-up WebGL buffer becomes top-down NDI with zero copy. */
let _ndiOn=false, _ndiRes=2048, _ndiFps=30, _ndiTimer=0, _ndiFBO=null, _ndiTex=null, _ndiBuf=null, _ndiFrames=0;
function ndiAvailable(){ try{ return !!(IS_ELEC && DSP.ndi && DSP.ndi.available()); }catch(e){ return false; } }
function ensureNdiFBO(res){ if(_ndiFBO&&_ndiRes===res&&_ndiBuf)return;
  if(_ndiFBO){ try{gl.deleteFramebuffer(_ndiFBO);}catch(e){} } if(_ndiTex){ try{gl.deleteTexture(_ndiTex);}catch(e){} }
  _ndiFBO=gl.createFramebuffer(); _ndiTex=gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D,_ndiTex); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,res,res,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.bindFramebuffer(gl.FRAMEBUFFER,_ndiFBO); gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,_ndiTex,0); gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  _ndiBuf=new Uint8Array(res*res*4); _ndiRes=res; }
function _closeNdiGL(){ try{ if(_ndiFBO)gl.deleteFramebuffer(_ndiFBO); if(_ndiTex)gl.deleteTexture(_ndiTex); }catch(e){} _ndiFBO=_ndiTex=null; _ndiBuf=null; }
function ndiTick(){ if(!_ndiOn||!DSP.ndi)return;
  try{ ensureNdiFBO(_ndiRes);
    const flatBak=_drawFlat, aspBak=_compAspect; _drawFlat=false; // NDI is ALWAYS the fulldome master (square 1:1, no grid/overlays)
    gl.bindFramebuffer(gl.FRAMEBUFFER,_ndiFBO); gl.disable(gl.DEPTH_TEST);
    composite(state.playhead,_ndiRes,true); // opaque black surround; the dome disc = the master
    if(masterGradeOn()){ applyMasterGrade(_ndiTex,_ndiRes); gl.bindFramebuffer(gl.FRAMEBUFFER,_mgRT.fbo); } // [master grade phase 2] NDI carries the graded master too
    gl.readPixels(0,0,_ndiRes,_ndiRes,gl.RGBA,gl.UNSIGNED_BYTE,_ndiBuf);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null); gl.viewport(0,0,glc.width,glc.height); _drawFlat=flatBak; _compAspect=aspBak;
    DSP.ndi.send(_ndiBuf,_ndiRes,_ndiRes,true); _ndiFrames++; // flipY: bottom-up WebGL → top-down NDI (negative stride, zero copy)
  }catch(e){} }
function startNDI(res){ if(!ndiAvailable()){ appAlert(T('The NDI runtime is not installed. Download the free NDI Tools / runtime from ndi.video and try again.','El runtime de NDI no está instalado. Descarga las NDI Tools / runtime gratuitas desde ndi.video e inténtalo de nuevo.')); return; }
  _ndiRes=res; _ndiFps=(res>=4096)?30:Math.max(1,Math.min(60,Math.round(state.fps||30)));
  if(!DSP.ndi.start('Immersive Studio Pro — Master', _ndiFps*1000, 1000)){ flashStatus(T('NDI output failed to start','No se pudo iniciar la salida NDI'),'err'); return; } // [R94-UT3·U-21]
  _ndiOn=true; ensureNdiFBO(res); clearInterval(_ndiTimer); _ndiTimer=setInterval(ndiTick,Math.max(8,Math.round(1000/_ndiFps)));
  const b=$('#ndiBtn'); if(b)b.classList.add('on');
  flashStatus(T('NDI output ON · ','Salida NDI activa · ')+res+'×'+res+' · '+_ndiFps+'fps'); }
function stopNDI(){ _ndiOn=false; clearInterval(_ndiTimer); _ndiTimer=0; try{DSP.ndi.stop();}catch(e){} _closeNdiGL(); const b=$('#ndiBtn'); if(b)b.classList.remove('on'); flashStatus(T('NDI output off','Salida NDI desactivada')); }
function ndiMenu(x,y){ if(!IS_ELEC||!DSP.ndi){ appAlert(T('NDI output is only available in the desktop app.','La salida NDI solo está disponible en la app de escritorio.')); return; }
  if(!ndiAvailable()){ appConfirm(T('The free NDI runtime is not installed. It is required to broadcast NDI. Open the download page?','El runtime gratuito de NDI no está instalado. Es necesario para transmitir por NDI. ¿Abrir la página de descarga?'),ok=>{ if(ok){ try{ const u=DSP.ndi.runtimeUrl(); window.open(u,'_blank'); }catch(e){} } }); return; }
  const ck=r=>(_ndiOn&&_ndiRes===r)?'  ✓':''; const items=[
    {label:T('Dome master 1:1 · 2048 × 2048','Máster Domo 1:1 · 2048 × 2048')+ck(2048),ico:'ndi',fn:()=>{ (_ndiOn&&_ndiRes===2048)?stopNDI():startNDI(2048); }},
    {label:T('Dome master 1:1 · 4096 × 4096','Máster Domo 1:1 · 4096 × 4096')+ck(4096),ico:'ndi',fn:()=>{ (_ndiOn&&_ndiRes===4096)?stopNDI():startNDI(4096); }} ];
  if(_ndiOn)items.push('sep',{label:T('Stop NDI output','Detener salida NDI'),danger:true,fn:stopNDI});
  openMenu(x,y,items); }
/* ===================== SPOUT® OUTPUT (local GPU-texture share, DirectX — the same-machine alternative to NDI) =====================
   Same pipeline as NDI: composite the clean fulldome master into an offscreen FBO, read it back, hand the pixels to the
   native SpoutDX sender (preload). Receivers on this machine (Resolume · TouchDesigner · OBS) get it as a shared texture. */
let _spoutOn=false, _spoutRes=2048, _spoutFps=30, _spoutTimer=0, _spoutFBO=null, _spoutTex=null, _spoutBuf=null;
function spoutAvailable(){ try{ return !!(IS_ELEC && DSP.spout && DSP.spout.available()); }catch(e){ return false; } }
function ensureSpoutFBO(res){ if(_spoutFBO&&_spoutRes===res&&_spoutBuf)return;
  if(_spoutFBO){ try{gl.deleteFramebuffer(_spoutFBO);}catch(e){} } if(_spoutTex){ try{gl.deleteTexture(_spoutTex);}catch(e){} }
  _spoutFBO=gl.createFramebuffer(); _spoutTex=gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D,_spoutTex); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,res,res,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.bindFramebuffer(gl.FRAMEBUFFER,_spoutFBO); gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,_spoutTex,0); gl.bindFramebuffer(gl.FRAMEBUFFER,null); gl.bindTexture(gl.TEXTURE_2D,null);
  _spoutBuf=new Uint8Array(res*res*4); _spoutRes=res; }
function _closeSpoutGL(){ try{ if(_spoutFBO)gl.deleteFramebuffer(_spoutFBO); if(_spoutTex)gl.deleteTexture(_spoutTex); }catch(e){} _spoutFBO=_spoutTex=null; _spoutBuf=null; }
function spoutTick(){ if(!_spoutOn||!DSP.spout)return;
  try{ ensureSpoutFBO(_spoutRes);
    const flatBak=_drawFlat, aspBak=_compAspect; _drawFlat=false; // ALWAYS the fulldome master (square 1:1, no grid/overlays)
    gl.bindFramebuffer(gl.FRAMEBUFFER,_spoutFBO); gl.disable(gl.DEPTH_TEST);
    composite(state.playhead,_spoutRes,true);
    if(masterGradeOn()){ applyMasterGrade(_spoutTex,_spoutRes); gl.bindFramebuffer(gl.FRAMEBUFFER,_mgRT.fbo); } // [master grade phase 2] Spout carries the graded master too
    gl.readPixels(0,0,_spoutRes,_spoutRes,gl.RGBA,gl.UNSIGNED_BYTE,_spoutBuf);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null); gl.viewport(0,0,glc.width,glc.height); _drawFlat=flatBak; _compAspect=aspBak;
    DSP.spout.send(_spoutBuf,_spoutRes,_spoutRes,true); // flipY: bottom-up WebGL → top-down Spout (flip done in the addon)
  }catch(e){} }
function startSpout(res){ if(!spoutAvailable()){ appAlert(T('Spout output is not available on this system.','La salida Spout no está disponible en este sistema.')); return; }
  _spoutRes=res; _spoutFps=(res>=4096)?30:Math.max(1,Math.min(60,Math.round(state.fps||30)));
  if(!DSP.spout.start('Immersive Studio Pro — Master')){ flashStatus(T('Spout output failed to start','No se pudo iniciar la salida Spout'),'err'); return; }
  _spoutOn=true; ensureSpoutFBO(res); clearInterval(_spoutTimer); _spoutTimer=setInterval(spoutTick,Math.max(8,Math.round(1000/_spoutFps)));
  const b=$('#spoutBtn'); if(b)b.classList.add('on');
  flashStatus(T('Spout output ON · ','Salida Spout activa · ')+res+'×'+res+' · '+_spoutFps+'fps'); }
function stopSpout(){ _spoutOn=false; clearInterval(_spoutTimer); _spoutTimer=0; try{DSP.spout.stop();}catch(e){} _closeSpoutGL(); const b=$('#spoutBtn'); if(b)b.classList.remove('on'); flashStatus(T('Spout output off','Salida Spout desactivada')); }
function spoutMenu(x,y){ if(!IS_ELEC||!DSP.spout){ appAlert(T('Spout output is only available in the desktop app.','La salida Spout solo está disponible en la app de escritorio.')); return; }
  const ck=r=>(_spoutOn&&_spoutRes===r)?'  ✓':''; const items=[
    {label:T('Dome master 1:1 · 2048 × 2048','Máster Domo 1:1 · 2048 × 2048')+ck(2048),ico:'ndi',fn:()=>{ (_spoutOn&&_spoutRes===2048)?stopSpout():startSpout(2048); }},
    {label:T('Dome master 1:1 · 4096 × 4096','Máster Domo 1:1 · 4096 × 4096')+ck(4096),ico:'ndi',fn:()=>{ (_spoutOn&&_spoutRes===4096)?stopSpout():startSpout(4096); }} ];
  if(_spoutOn)items.push('sep',{label:T('Stop Spout output','Detener salida Spout'),danger:true,fn:stopSpout});
  openMenu(x,y,items); }

/* ===================== NDI® INPUT — a live network source as a media clip ===================== */
/* A kind:'ndi' media whose GL texture is refreshed in real time from a received NDI stream. Drag it to the
   timeline like any clip; it always shows the CURRENT frame of the source, wherever the playhead sits. */
let _ndiPumpTimer=0, _ndiRenderRaf=0, _ndiDirty=false;
function ndiSourceLabel(name){ const m=/\(([^)]+)\)\s*$/.exec(name); return m?m[1]:name; } // "MACHINE (Source)" → "Source"
/* upload an NDI frame reusing the texture storage (texSubImage2D) — no per-frame realloc.
   FLIP_Y=false: the addon's capture thread already writes rows bottom-up — Chrome's UNPACK_FLIP_Y path
   re-copies the whole frame on the CPU (~27ms at 4K), so the flip lives in the C++ thread instead. */
function ndiUpload(m,w,h,u8){ gl.bindTexture(gl.TEXTURE_2D,m.tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
  if(m._texW===w&&m._texH===h){ try{ gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,u8); return; }catch(e){} }
  try{ gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,u8); m._texW=w; m._texH=h; }catch(e){} }
function makeNdiMedia(sourceName){ const nm=ndiSourceLabel(sourceName);
  const m={id:uid(),kind:'ndi',ndiSource:sourceName,name:'NDI · '+nm,w:16,h:16,dur:60,fps:0,color:clipColorFor('ndi'),tex:newTex(),thumb:null,_ndiLive:false,_thumbT:0};
  try{ upTexRaw(m.tex,16,16,new Uint8Array(16*16*4).fill(24)); }catch(e){} // dark placeholder until the first frame arrives
  try{ if(DSP&&DSP.ndi)DSP.ndi.recvOpen(sourceName); }catch(e){}
  state.media.push(m); renderMedia(); markDirty(); ndiStartPump(); return m; }
function addNdiInput(){ if(!IS_ELEC||!DSP.ndi){ appAlert(T('NDI is only available in the desktop app.','NDI solo está disponible en la app de escritorio.')); return; }
  if(!ndiAvailable()){ appConfirm(T('The free NDI runtime is not installed. Open the download page?','El runtime gratuito de NDI no está instalado. ¿Abrir la página de descarga?'),ok=>{ if(ok){ try{ window.open(DSP.ndi.runtimeUrl(),'_blank'); }catch(e){} } }); return; }
  flashStatus(T('Scanning for NDI sources…','Buscando fuentes NDI…'));
  // give the finder a moment to accumulate sources, then show the picker
  DSP.ndi.findSources(300);
  setTimeout(()=>{ let srcs=[]; try{ srcs=DSP.ndi.findSources(1200)||[]; }catch(e){}
    const have=new Set(state.media.filter(m=>m.kind==='ndi').map(m=>m.ndiSource));
    const fresh=srcs.filter(s=>s&&!have.has(s));
    if(!srcs.length){ appAlert(T('No NDI sources found on the network. Make sure a sender is running.','No se encontraron fuentes NDI en la red. Asegúrate de que haya un emisor activo.')); return; }
    const items=srcs.map(s=>({ label:ndiSourceLabel(s)+(have.has(s)?'  ✓':''), ico:'ndi', fn:()=>{ if(have.has(s)){ flashStatus(T('That NDI source is already added','Esa fuente NDI ya está añadida')); return; } const m=makeNdiMedia(s); flashStatus(T('NDI source added — drag it to the timeline','Fuente NDI añadida — arrástrala a la línea de tiempo')); } }));
    const r=$('#mediaList').getBoundingClientRect(); openMenu(r.left+20, Math.min(innerHeight-60, r.top+40), items);
  }, 340); }
function ndiMediaList(){ return state.media.filter(m=>m.kind==='ndi'); }
function ndiClipOnScreen(){ const t=state.playhead; return state.clips.some(c=>{ const mm=mediaById(c.mediaId); return mm&&mm.kind==='ndi'&&t>=c.start&&t<c.start+c.dur; }); }
/* Pump (setInterval ~120Hz, immune to rAF occlusion throttling via backgroundThrottling:false): receive + upload
   every frame with low latency. Rendering is driven separately by rAF (vsync-aligned) → smooth 60fps, no timer beat. */
function ndiStartPump(){ if(!_ndiPumpTimer){ _ndiPumpTimer=setInterval(()=>{ if(!ndiMediaList().length){ clearInterval(_ndiPumpTimer); _ndiPumpTimer=0; return; } ndiPump(); },8); }
  if(!_ndiRenderRaf)_ndiRenderRaf=requestAnimationFrame(ndiRenderLoop); }
function ndiRenderLoop(){ _ndiRenderRaf=0; if(!ndiMediaList().length)return;
  if(_ndiDirty && !state.playing && ndiClipOnScreen()){ _ndiDirty=false; render(); } // present the latest received frame at display rate
  _ndiRenderRaf=requestAnimationFrame(ndiRenderLoop); }
/* Zero-copy path (R77): the addon receives + swizzles on a BACKGROUND thread; recvRead(name,lastGen,sabView)
   just memcpys the newest frame into a SharedArrayBuffer the page shares with the preload (SABs cross the
   contextBridge shared, not cloned — a 4K frame used to cost a 33MB structured clone per read). WebGL rejects
   SAB-backed views, so the frame hops SAB→local staging (one fast memcpy) before texSubImage2D. If SAB is
   unavailable or the bridge rejects it, everything falls back to the old copy mode automatically. */
let _ndiSabMode=-1; // -1 untested · 1 zero-copy active · 0 fallback (clone per frame)
function ndiPump(){ if(!DSP||!DSP.ndi)return; const list=ndiMediaList(); if(!list.length)return; const now=performance.now();
  const sabOk=(_ndiSabMode!==0)&&(typeof SharedArrayBuffer!=='undefined');
  for(const m of list){ let fr=null;
    try{ fr=DSP.ndi.recvRead(m.ndiSource, m._ndiGen||0, (sabOk&&m._ndiView)?m._ndiView:null); }
    catch(e){ _ndiSabMode=0; m._ndiSAB=null; m._ndiView=null; try{ fr=DSP.ndi.recvRead(m.ndiSource, m._ndiGen||0, null); }catch(e2){} } // bridge rejected the SAB → permanent fallback
    if(!fr||!(fr.w>0&&fr.h>0))continue; // null = no frame newer than _ndiGen (cheap poll, no copies)
    m._ndiGen=fr.gen||0;
    const need=fr.w*fr.h*4; let pix=null;
    if(fr.copied&&m._ndiView){ if(_ndiSabMode<0){ _ndiSabMode=1; diag('info','ndi','SAB zero-copy input path active'); }
      if(!m._ndiPix||m._ndiPix.length!==need)m._ndiPix=new Uint8Array(need);
      m._ndiPix.set(m._ndiView.subarray(0,need)); pix=m._ndiPix; } // SAB → local staging (WebGL rejects SAB views)
    else if(fr.data){ pix=fr.data; }
    if(sabOk&&(!m._ndiSAB||m._ndiSAB.byteLength<need)){ try{ m._ndiSAB=new SharedArrayBuffer(need); m._ndiView=new Uint8Array(m._ndiSAB); }catch(e){ _ndiSabMode=0; } } // (re)arm the shared buffer for subsequent frames / resolution changes
    if(!pix)continue;
    const dim=(m.w!==fr.w||m.h!==fr.h); m.w=fr.w; m.h=fr.h; m._ndiLive=true; ndiUpload(m,fr.w,fr.h,pix); _ndiDirty=true;
    if(now-(m._thumbT||0)>1000){ m._thumbT=now; try{ const tc=document.createElement('canvas'); tc.width=108; tc.height=Math.max(1,Math.round(108*fr.h/fr.w)); const tx=tc.getContext('2d'); const id=new ImageData(new Uint8ClampedArray(pix.buffer,pix.byteOffset,need),fr.w,fr.h); const src=document.createElement('canvas'); src.width=fr.w; src.height=fr.h; src.getContext('2d').putImageData(id,0,0); tx.translate(0,tc.height); tx.scale(1,-1); tx.drawImage(src,0,0,tc.width,tc.height); m.thumb=tc.toDataURL('image/jpeg',0.6); renderMedia(); }catch(e){} } // un-flip: frames arrive bottom-up from the addon
    if(dim)renderInspector();
  } }
function closeNdiMedia(m){ if(!m||m.kind!=='ndi')return; try{ if(DSP&&DSP.ndi){ const others=state.media.some(x=>x!==m&&x.kind==='ndi'&&x.ndiSource===m.ndiSource); if(!others)DSP.ndi.recvClose(m.ndiSource); } }catch(e){} }
function closeAllNdi(){ try{ if(DSP&&DSP.ndi)DSP.ndi.recvCloseAll(); }catch(e){} if(_ndiPumpTimer){ clearInterval(_ndiPumpTimer); _ndiPumpTimer=0; } if(_ndiRenderRaf){ cancelAnimationFrame(_ndiRenderRaf); _ndiRenderRaf=0; } }
/* FLAT viewport: frame-coord (−1..1) → viewport pixel using the same aspect-fit + pan/zoom as the flat blit */
function flatMap(){ const A=(state.seqW||16)/(state.seqH||9), wa=view.cw/view.ch; let sx,sy; if(A>=wa){sx=1;sy=wa/A;}else{sy=1;sx=A/wa;}
  const z=state.view.zoom, p=state.view.pan;
  return { A,Fx:Math.min(1,A),Fy:Math.min(1,1/A), px:(fx,fy)=>{ const ndx=(fx-p[0])*z*sx, ndy=(fy-p[1])*z*sy; return [(ndx*0.5+0.5)*view.cw, (1-(ndy*0.5+0.5))*view.ch]; } }; }
function drawFlatFrame(){ const M=flatMap(); const a=M.px(-1,1), b=M.px(1,-1); const x0=a[0],y0=a[1],w=b[0]-a[0],h=b[1]-a[1];
  gx.lineWidth=1; gx.strokeStyle='rgba(255,255,255,0.30)'; gx.strokeRect(x0,y0,w,h);
  if(state.view.showGrid && !isRoom()){ gx.strokeStyle='rgba(255,255,255,0.09)'; for(let i=1;i<3;i++){ const xx=x0+w*i/3; gx.beginPath();gx.moveTo(xx,y0);gx.lineTo(xx,y0+h);gx.stroke(); const yy=y0+h*i/3; gx.beginPath();gx.moveTo(x0,yy);gx.lineTo(x0+w,yy);gx.stroke(); } } // room uses the per-wall grid (drawRoomGrid2D) instead of the generic thirds
  if(state.view.showSafe){ /* [R106] action-safe (inner 93%) + title-safe (inner 90%), broadcast convention, labelled */
    const rect=(inset,dash,col,lbl,bottom)=>{ const mx=w*inset,my=h*inset; gx.lineWidth=1; gx.strokeStyle=col; gx.setLineDash(dash); gx.strokeRect(x0+mx,y0+my,w-2*mx,h-2*my); gx.setLineDash([]);
      gx.font='10px Geist'; gx.textAlign='left'; gx.textBaseline='alphabetic'; const tx=x0+mx+4, ty=bottom?(y0+h-my-4):(y0+my+12), tw=gx.measureText(lbl).width; gx.fillStyle='rgba(6,7,9,0.6)'; gx.fillRect(tx-3,ty-10,tw+6,13); gx.fillStyle=col; gx.fillText(lbl,tx,ty); };
    rect(0.035,[5,4],'rgba(201,205,211,0.55)',T('ACTION SAFE','ACCIÓN'),false);
    rect(0.05 ,[3,4],'rgba(201,205,211,0.34)',T('TITLE SAFE','TÍTULOS'),true); } }
/* R91b: 360-room wall grid over the flat strip — vertical dividers at wall seams, a subtle role label bottom-left of each wall, and a dimmed dead-zone under walls shorter than the strip. Drawn by EXACT PIXELS (wall.x0/x1/pxH), never by physical cm. Only the walls strip carries a .room; the floor is a plain flat sequence with no grid. */
function drawRoomGrid2D(){ const as=activeSeq(); const room=as&&as.room; if(!room||!room.walls||!room.walls.length)return;
  const M=flatMap(); const stripW=as.w||state.seqW||1, stripH=as.h||state.seqH||1;
  const fx=px=>px/stripW*2-1, fy=py=>1-py/stripH*2; // fx: 0..stripW → -1..1 ; fy: py-from-top 0..stripH → 1..-1
  // dead zone below any wall shorter than the strip (those pixels belong to no wall)
  for(const w of room.walls){ if(w.pxH>=stripH)continue; const a=M.px(fx(w.x0),fy(w.pxH)), b=M.px(fx(w.x1),fy(stripH));
    gx.fillStyle='rgba(8,9,11,0.42)'; gx.fillRect(a[0],a[1],b[0]-a[0],b[1]-a[1]);
    gx.strokeStyle='rgba(255,255,255,0.16)'; gx.setLineDash([3,3]); gx.beginPath(); gx.moveTo(a[0],a[1]); gx.lineTo(b[0],a[1]); gx.stroke(); gx.setLineDash([]); }
  // per-wall subdivision grid (3 rows × 4 cols, proportional to each wall) — only when the Grid toggle is on
  if(state.view.showGrid){ gx.lineWidth=1; gx.strokeStyle='rgba(255,255,255,0.11)';
    for(const w of room.walls){ for(let i=1;i<ROOM_GRID_COLS;i++){ const x=fx(w.x0+(w.x1-w.x0)*i/ROOM_GRID_COLS); const a=M.px(x,fy(0)), b=M.px(x,fy(w.pxH)); gx.beginPath(); gx.moveTo(a[0],a[1]); gx.lineTo(b[0],b[1]); gx.stroke(); }
      for(let j=1;j<ROOM_GRID_ROWS;j++){ const yy=fy(w.pxH*j/ROOM_GRID_ROWS); const a=M.px(fx(w.x0),yy), b=M.px(fx(w.x1),yy); gx.beginPath(); gx.moveTo(a[0],a[1]); gx.lineTo(b[0],b[1]); gx.stroke(); } } }
  // vertical seams between walls (the outer L/R edges are drawn by drawFlatFrame)
  gx.strokeStyle='rgba(255,255,255,0.24)'; gx.lineWidth=1;
  for(let i=1;i<room.walls.length;i++){ const x=fx(room.walls[i].x0); const p0=M.px(x,fy(0)), p1=M.px(x,fy(stripH)); gx.beginPath(); gx.moveTo(p0[0],p0[1]); gx.lineTo(p1[0],p1[1]); gx.stroke(); }
  // subtle wall-role label, bottom-left inside each wall region
  gx.font='600 11px Geist'; gx.textAlign='left'; gx.textBaseline='alphabetic';
  for(const w of room.walls){ const p=M.px(fx(w.x0),fy(w.pxH)); const lbl=roomRoleLabel(w.role).toUpperCase(); const tw=gx.measureText(lbl).width;
    const lx=p[0]+7, ly=p[1]-7; gx.fillStyle='rgba(6,7,9,0.55)'; gx.fillRect(lx-3,ly-10,tw+6,14); gx.fillStyle='rgba(196,201,208,0.82)'; gx.fillText(lbl,lx,ly); }
}
function drawGrid2D(){
  gx.clearRect(0,0,view.cw,view.ch);
  if(isFlat()){ drawFlatFrame(); if(isRoom())drawRoomGrid2D(); if(state.view.showOutline)drawOutline2D(); drawFlatHandles(); return; }
  const c0=f2pix(0,0), e=f2pix(1,0); const R=Math.hypot(e[0]-c0[0],e[1]-c0[1]);
  gx.lineWidth=1; gx.strokeStyle='rgba(255,255,255,0.14)'; gx.beginPath(); gx.arc(c0[0],c0[1],R,0,7); gx.stroke();
  if(state.view.showGrid){
    gx.font='11px Geist'; gx.textAlign='center'; gx.textBaseline='middle';
    const covD=curCovDeg();
    for(const E of [15,30,45,60,75]){const r=(90-E)/covD*R; gx.strokeStyle='rgba(255,255,255,0.07)'; gx.beginPath();gx.arc(c0[0],c0[1],r,0,7);gx.stroke();}
    if(Math.abs(covD-90)>0.5){ const rh=90/covD*R; gx.strokeStyle='rgba(229,181,103,0.4)'; gx.setLineDash([2,4]); gx.beginPath();gx.arc(c0[0],c0[1],rh,0,7);gx.stroke(); gx.setLineDash([]); gx.fillStyle='rgba(229,181,103,0.75)'; gx.font='10px Geist'; gx.fillText(T('HORIZON','HORIZONTE'),c0[0],c0[1]-rh-7); } // >180° domes: the master rim dips below the horizon, so mark where el=0 actually lands
    for(let a=0;a<360;a+=30){const f=azel2f(a,0);const p=f2pix(f[0],f[1]);gx.strokeStyle='rgba(255,255,255,0.05)';gx.beginPath();gx.moveTo(c0[0],c0[1]);gx.lineTo(p[0],p[1]);gx.stroke();}
    const card=[[T('FRONT','FRENTE'),0,0,'#B4BAC1'],[T('RIGHT','DERECHA'),90,0,'#71777F'],[T('BACK','ATRÁS'),180,0,'#71777F'],[T('LEFT','IZQUIERDA'),270,0,'#71777F'],[T('ZENITH','CENIT'),0,90,'#71777F']];
    gx.font='11px Geist'; gx.fillStyle=UI.ink2;
    for(const [t,a,el,col] of card){const f=azel2f(a, el); const p=f2pix(f[0]*1.07,f[1]*1.07); gx.fillStyle=col; gx.fillText(t,p[0],p[1]);}
  }
  if(state.view.showSafe){ /* [R106] fulldome delivery guides: rings by ELEVATION (azimuthal-equidistant, like the grid), labelled. Keep critical action off the rim / edge-blend zone, titles tighter, and flag the neck-straining zenith. */
    const ring=(E,dash,col,lbl)=>{ const r=(90-E)/curCovDeg()*R; gx.lineWidth=1; gx.strokeStyle=col; gx.setLineDash(dash); gx.beginPath(); gx.arc(c0[0],c0[1],r,0,7); gx.stroke(); gx.setLineDash([]);
      if(lbl){ gx.font='10px Geist'; gx.textAlign='center'; gx.textBaseline='alphabetic'; const ly=c0[1]-r-4, tw=gx.measureText(lbl).width; gx.fillStyle='rgba(6,7,9,0.6)'; gx.fillRect(c0[0]-tw/2-3,ly-10,tw+6,13); gx.fillStyle=col; gx.fillText(lbl,c0[0],ly); } };
    ring(5 ,[5,4],'rgba(201,205,211,0.55)',T('ACTION SAFE','ACCIÓN')); /* rim / projector edge-blend margin */
    ring(15,[3,4],'rgba(201,205,211,0.34)',T('TITLE SAFE','TÍTULOS')); /* comfortable reading band */
    /* zenith caution: content within ~10° of straight-up makes the audience crane their necks */
    const rz=(90-80)/curCovDeg()*R; gx.strokeStyle='rgba(229,181,103,0.5)'; gx.setLineDash([2,3]); gx.beginPath(); gx.arc(c0[0],c0[1],rz,0,7); gx.stroke(); gx.setLineDash([]); }
  if(state.view.showOutline) drawOutline2D();
}
function drawOutline2D(){
  const c=selClip(); if(!c)return; const m=mediaById(c.mediaId); if(!m||m.kind==='audio')return; // audio clips have no dome/flat presence — never outline them
  if(isFlat()){ const M=flatMap(), Fx=M.Fx, Fy=M.Fy; const P=flatPlace(c,m,state.playhead);
    const corn=(sx,sy)=>{ const nx=P.fc[0]+sx*P.fx[0]+sy*P.fy[0], ny=P.fc[1]+sx*P.fx[1]+sy*P.fy[1]; return M.px(nx/Fx, ny/Fy); };
    const pts=[corn(-1,-1),corn(1,-1),corn(1,1),corn(-1,1)];
    gx.strokeStyle=UI.ink2; gx.lineWidth=1.4; gx.setLineDash([5,3]); gx.beginPath(); gx.moveTo(pts[0][0],pts[0][1]); for(let i=1;i<4;i++)gx.lineTo(pts[i][0],pts[i][1]); gx.closePath(); gx.stroke(); gx.setLineDash([]); return; }
  const t=state.playhead; const az=evalP(c,'az',t),el=evalP(c,'el',t),size=evalP(c,'size',t);
  const fr=frame(az,el); const ax=(size*.5)*D2R, ay=ax*(m.h/m.w);
  gx.strokeStyle=UI.ink2; gx.lineWidth=1.4; gx.setLineDash([5,3]); gx.beginPath();
  const seg=36; const edges=[]; for(let i=0;i<=seg;i++)edges.push([-1+2*i/seg,1]); for(let i=0;i<=seg;i++)edges.push([1,1-2*i/seg]); for(let i=0;i<=seg;i++)edges.push([1-2*i/seg,-1]); for(let i=0;i<=seg;i++)edges.push([-1,-1+2*i/seg]);
  let started=false;
  for(const [s,tt] of edges){ const ray=norm([fr.d[0]+Math.tan(ax*s*(c.props.mirror?-1:1))*fr.u[0]+Math.tan(ay*tt)*fr.v[0], fr.d[1]+Math.tan(ax*s*(c.props.mirror?-1:1))*fr.u[1]+Math.tan(ay*tt)*fr.v[1], fr.d[2]+Math.tan(ax*s*(c.props.mirror?-1:1))*fr.u[2]+Math.tan(ay*tt)*fr.v[2]]);
    if(ray[2]<-0.0015){started=false;continue;} const f=azel2f(Math.atan2(ray[1],ray[0])*R2D,(HALF_PI-Math.acos(Math.max(-1,Math.min(1,ray[2]))))*R2D); const p=f2pix(f[0],f[1]);
    if(!started){gx.moveTo(p[0],p[1]);started=true;}else gx.lineTo(p[0],p[1]); }
  gx.stroke(); gx.setLineDash([]);
}
/* Photoshop-style resize handles for the SELECTED flat/room clip — 4 corners + 4 edge midpoints. Always drawn (independent of the outline toggle) so they're a reliable grab target; caches _flatHandles for hit-testing. */
function drawFlatHandles(){ _flatHandles=null; const c=selClip(); if(!c||c.adjust)return; const m=mediaById(c.mediaId); if(!m||m.kind==='audio')return; const t=state.playhead; if(t<c.start||t>=c.start+c.dur)return;
  const M=flatMap(),Fx=M.Fx,Fy=M.Fy; const P=flatPlace(c,m,t);
  const corn=(sx,sy)=>M.px((P.fc[0]+sx*P.fx[0]+sy*P.fy[0])/Fx,(P.fc[1]+sx*P.fx[1]+sy*P.fy[1])/Fy);
  _flatHandles=[]; const hs=3.2;
  for(const [a,b] of [[-1,-1],[1,-1],[1,1],[-1,1],[0,-1],[1,0],[0,1],[-1,0]]){ const p=corn(a,b); _flatHandles.push({sx:a,sy:b,px:p[0],py:p[1]});
    gx.fillStyle=UI.s0; gx.strokeStyle=UI.ink2; gx.lineWidth=1; gx.beginPath(); gx.rect(p[0]-hs,p[1]-hs,hs*2,hs*2); gx.fill(); gx.stroke(); } }
/* 3D camera */
function persp(fovy,a,n,fr){const t=1/Math.tan(fovy/2),nf=1/(n-fr);return[t/a,0,0,0,0,t,0,0,0,0,(fr+n)*nf,-1,0,0,2*fr*n*nf,0];}
function lookAt(eye,ctr,up){const z=norm(sub(eye,ctr));let x=cross(up,z);if(x[0]*x[0]+x[1]*x[1]+x[2]*x[2]<1e-8)x=cross([0,1,0],z);x=norm(x);const y=cross(z,x);return[x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1];}
function mul4(a,b){const o=new Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o;}
function cameraMVP(spec,cam,asp){cam=cam||state.view.cam;asp=asp||(glc.width/glc.height||1);const proj=persp((spec?cam.fov:48)*D2R,asp,0.01,60);let eye,ctr;
  if(spec){const f=[Math.cos(cam.pitch)*Math.cos(cam.yaw),Math.cos(cam.pitch)*Math.sin(cam.yaw),Math.sin(cam.pitch)];const b=[0,0,0.05];eye=[b[0]-f[0]*cam.back,b[1]-f[1]*cam.back,b[2]-f[2]*cam.back];ctr=[eye[0]+f[0],eye[1]+f[1],eye[2]+f[2]];}
  else{ctr=[0,0,0.3];const d=cam.dist;eye=[Math.cos(cam.pitch)*Math.cos(cam.yaw)*d,Math.cos(cam.pitch)*Math.sin(cam.yaw)*d,ctr[2]+Math.sin(cam.pitch)*d];}
  return mul4(proj,lookAt(eye,ctr,[0,0,1]));}
function proj3(P,mvp,flipx){const x=P[0],y=P[1],z=P[2];let cx=mvp[0]*x+mvp[4]*y+mvp[8]*z+mvp[12],cy=mvp[1]*x+mvp[5]*y+mvp[9]*z+mvp[13],cw=mvp[3]*x+mvp[7]*y+mvp[11]*z+mvp[15];if(cw<=1e-4)return null;cx*=flipx;return[(cx/cw*0.5+0.5)*view.cw,(1-(cy/cw*0.5+0.5))*view.ch];}
function drawLabels3D(mvp,spec){const fx=-1;gx.clearRect(0,0,view.cw,view.ch);gx.font='11px Geist';gx.textAlign='center';gx.textBaseline='middle';
  const L=[[T('FRONT','FRENTE'),[1.05,0,0.02],'#B4BAC1'],[T('RIGHT','DERECHA'),[0,1.05,0.02],'#71777F'],[T('BACK','ATRÁS'),[-1.05,0,0.02],'#71777F'],[T('LEFT','IZQUIERDA'),[0,-1.05,0.02],'#71777F'],[T('ZENITH','CENIT'),[0,0,1.06],'#71777F']];
  for(const[t,P,c] of L){const p=proj3(P,mvp,fx);if(p){gx.fillStyle=c;gx.fillText(t,p[0],p[1]);}}}

function resize(){if(exporting)return;const r=$('#stage').getBoundingClientRect();const dpr=Math.min(window.devicePixelRatio||1,2); // screen canvas is always full-res; preview quality only shrinks the clip composite (setCompSize)
  if(state.view.mode==='3d'){ const W=Math.max(80,r.width),H=Math.max(80,r.height); view.cw=W; view.ch=H; VSIZE=Math.min(W,H);
    glc.style.width=W+'px';glc.style.height=H+'px';glc.style.left='0px';glc.style.top='0px';glc.width=Math.max(1,Math.round(W*dpr));glc.height=Math.max(1,Math.round(H*dpr));
    gridc.style.width=W+'px';gridc.style.height=H+'px';gridc.style.left='0px';gridc.style.top='0px';gridc.width=Math.round(W*dpr);gridc.height=Math.round(H*dpr);
  } else { const W=Math.max(80,r.width),H=Math.max(80,r.height); view.cw=W; view.ch=H; VSIZE=Math.min(W,H); // full panel; blit aspect-corrects so the dome disc stays circular & centered
    glc.style.width=W+'px';glc.style.height=H+'px';glc.style.left='0px';glc.style.top='0px';glc.width=Math.max(1,Math.round(W*dpr));glc.height=Math.max(1,Math.round(H*dpr));
    gridc.style.width=W+'px';gridc.style.height=H+'px';gridc.style.left='0px';gridc.style.top='0px';gridc.width=Math.round(W*dpr);gridc.height=Math.round(H*dpr); }
  gx.setTransform(dpr,0,0,dpr,0,0); render();}

/* ===================== MEDIA + PROXIES ===================== */
function newTex(){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t;}
function upTex(tex,src){const w=src.videoWidth||src.naturalWidth||src.displayWidth||src.width||0,h=src.videoHeight||src.naturalHeight||src.displayHeight||src.height||0; /* displayWidth/Height → also uploads a WebCodecs VideoFrame (R108 ClipDecoder), same FLIP_Y as <video> */
  gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
  try{ if(w&&h&&tex._w===w&&tex._h===h){ gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,src); } // [R92-T3] same-size re-upload without realloc (like the NDI path) — per-frame texImage2D reallocs pressure the driver with 3-4 videos on screen
    else { gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,src); tex._w=w; tex._h=h; } }catch(e){console.warn('upTex',e);}}
/* upload a raw RGBA byte buffer (w×h) into a texture — used for live NDI input frames */
function upTexRaw(tex,w,h,u8){gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);try{gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,u8);}catch(e){console.warn('upTexRaw',e);}}
/* Downscale oversized images so the texture always uploads (large camera JPGs can exceed the GPU's
   limits on integrated GPUs → silent upload failure → transparent image). The dome composite is 2048,
   so 4096 keeps full visual quality. Returns {src,w,h} (a canvas if scaled, else the original element). */
const MAX_IMG=Math.min(8192, gl.getParameter(gl.MAX_TEXTURE_SIZE)||4096); // keep originals crisp for 4K–8K export; downscale only what the GPU can't upload
function fitImage(el){ const w=el.naturalWidth||el.width||0, h=el.naturalHeight||el.height||0; const big=Math.max(w,h);
  if(big<=MAX_IMG||!big) return {src:el,w,h}; const s=MAX_IMG/big, cw=Math.max(1,Math.round(w*s)), ch=Math.max(1,Math.round(h*s));
  const cv=document.createElement('canvas'); cv.width=cw; cv.height=ch; cv.getContext('2d').drawImage(el,0,0,cw,ch); return {src:cv,w:cw,h:ch}; }
const HAS_WC=(typeof VideoEncoder!=='undefined')&&(typeof window.Mp4Muxer!=='undefined');
let colorIdx=0;
const DSP=window.dsp||null; const IS_ELEC=!!(DSP&&DSP.isElectron);
function filePath(f){ try{ return IS_ELEC?DSP.getPathForFile(f):null; }catch(e){ return null; } }
let _importFolder=null; // R88: media created by the add* functions below is filed into this folder path (set per-import; captured synchronously at each add* call)
function importFiles(files,folder){ let arr=[...files]; const dropFolder=folder!==undefined?(folder||null):null; // audit fix: NEVER fall back to the previous import's folder (stale) — callers pass the target explicitly
  // dedup: skip files already in Media (re-drops / double drop events). Key by absolute path (Electron) or name+byte-size. Missing media is skipped so re-importing one still relinks via adopt().
  { const seen=new Set(); for(const m of state.media){ if(m.missing)continue; if(m.path)seen.add('p:'+m.path); if(m.name!=null)seen.add('n:'+m.name+'|'+(m.fsize||0)); }
    let dups=0; const fresh=[]; for(const f of arr){ const p=filePath(f); const kp=p?'p:'+p:null; const kn='n:'+f.name+'|'+(f.size||0);
      if((kp&&seen.has(kp))||seen.has(kn)){ dups++; continue; } if(kp)seen.add(kp); seen.add(kn); fresh.push(f); }
    if(dups)flashStatus(dups+T(' duplicate file(s) skipped (already in Media)',' archivo(s) duplicado(s) omitido(s) (ya en Medios)'),'err'); // [R94-UT3·U-21]
    arr=fresh; if(!arr.length)return; }
  const seqs={}, rest=[], seqGroups=[];
  for(const f of arr){ if(f.type.startsWith('image')){ const mm=f.name.match(/^(.*?)(\d+)(\.[^.]+)$/); if(mm){ const k=mm[1]+'|'+mm[3]; (seqs[k]=seqs[k]||[]).push({f,n:+mm[2]}); continue; } } rest.push(f); }
  for(const k in seqs){ const g=seqs[k]; if(g.length>=3){ g.sort((a,b)=>a.n-b.n); seqGroups.push(g); } else rest.push(...g.map(x=>x.f)); }
  for(const f of rest){ const p=filePath(f); _importFolder=dropFolder; if(f.type.startsWith('video'))addVideo(f,p); else if(f.type.startsWith('image'))addImage(f,p); else if(f.type.startsWith('audio'))addAudio(f,p); } _importFolder=null; // reset so no later add* call inherits this import's folder
  // numbered PNG/JPG batches → timed video-like sequences; ask the frame rate once for the whole import
  if(seqGroups.length){ askSeqFps(seqGroups, fps=>{ for(const g of seqGroups){ _importFolder=dropFolder; addSequence(g.map(x=>x.f), g[0].f.name, fps); } _importFolder=null; }); } }
/* R88: drop from Windows Explorer — a dropped FOLDER is imported whole, recreating its subfolder tree under `baseFolder`. Falls back to a flat import if the entry API is unavailable. */
function importDropped(dt, baseFolder){ const items=(dt&&dt.items)?[...dt.items]:null;
  if(!items || !items.length || !items[0].webkitGetAsEntry){ importFiles(dt.files, baseFolder||null); return; }
  const entries=items.map(it=>it.webkitGetAsEntry&&it.webkitGetAsEntry()).filter(Boolean);
  if(!entries.length){ importFiles(dt.files, baseFolder||null); return; }
  const collected=[]; // {file, folder}
  const readAll=dirEntry=>new Promise(res=>{ const rd=dirEntry.createReader(); const all=[]; const batch=()=>rd.readEntries(es=>{ if(!es.length){res(all);return;} all.push(...es); batch(); }, ()=>res(all)); batch(); });
  const walk=async(entry,folderPath)=>{ if(entry.isFile){ await new Promise(r=>entry.file(f=>{ collected.push({file:f,folder:folderPath}); r(); }, r)); }
    else if(entry.isDirectory){ const sub=joinFolder(folderPath, sanitizeFolderName(entry.name)); if(!folderExists(sub)){ state.folders.push(sub); } const es=await readAll(entry); for(const e of es)await walk(e,sub); } };
  (async()=>{ for(const en of entries)await walk(en, baseFolder||null);
    if(!collected.length){ renderMedia(); return; }
    const byFolder={}; for(const c of collected){ const k=c.folder||''; (byFolder[k]=byFolder[k]||[]).push(c.file); }
    for(const k in byFolder){ importFiles(byFolder[k], k||null); }
    markDirty(); renderMedia(); flashStatus(T('Imported dropped folder','Carpeta importada')); })(); }
/* choose the frame rate for imported image sequences (PNG-sequence-as-video). Applies to every sequence in the batch. */
function askSeqFps(groups,cb){ const total=groups.reduce((s,g)=>s+g.length,0); const def=state.fps||24;
  const ov=document.createElement('div'); ov.className='overlay'; ov.style.alignItems='flex-start'; ov.id='seqFpsOv';
  const presets=[12,24,25,30,50,60];
  ov.innerHTML='<div class="modal" style="width:400px;margin-top:120px;padding:16px 18px;">'
    +'<div class="mh" style="padding:0 0 12px;border:none;"><span style="color:var(--ink-2);display:flex;">'+ICO('video',16)+'</span><span class="t">'+T('Import image sequence','Importar secuencia de imágenes')+'</span></div>'
    +'<div style="font-size:11px;color:var(--ink-2);line-height:1.5;margin-bottom:13px;">'+(groups.length===1?T('1 sequence','1 secuencia'):groups.length+' '+T('sequences','secuencias'))+' · '+total+' '+T('frames total — imported as a single video clip. Set its frame rate:','fotogramas en total — se importan como un clip de vídeo. Elige su velocidad:')+'</div>'
    +'<div class="frow" style="margin-bottom:11px;"><label style="width:auto;">'+T('Frame rate','Velocidad')+'</label><input type="number" class="tnum" id="sfFps" value="'+def+'" min="1" max="120" style="width:74px;flex:0 0 auto;"><span class="tnum" style="color:var(--ink-dim);">fps</span><div style="flex:1;"></div></div>'
    +'<div class="kindseg" id="sfPresets" style="margin-bottom:15px;">'+presets.map(p=>'<button data-f="'+p+'" class="'+(p===def?'on':'')+'">'+p+'</button>').join('')+'</div>'
    +'<div style="display:flex;gap:8px;justify-content:flex-end;"><button id="sfCancel" class="togbtn2">'+T('Cancel','Cancelar')+'</button><button id="sfOk" class="togbtn2 on">'+ICO('plus')+' '+T('Import','Importar')+'</button></div></div>';
  document.body.appendChild(ov); const fin=$('#sfFps'); setTimeout(()=>{try{fin.focus();fin.select();}catch(e){}},10);
  const mark=()=>{ const v=+fin.value; ov.querySelectorAll('#sfPresets button').forEach(b=>b.classList.toggle('on',+b.dataset.f===v)); };
  ov.querySelectorAll('#sfPresets button').forEach(b=>b.onclick=()=>{ fin.value=b.dataset.f; mark(); }); fin.oninput=mark;
  let done=false; const close=ok=>{ if(done)return; done=true; ov.remove(); if(ok&&cb)cb(Math.max(1,Math.min(120,+fin.value||def))); };
  $('#sfOk').onclick=()=>close(true); $('#sfCancel').onclick=()=>close(false);
  fin.addEventListener('keydown',e=>{ e.stopPropagation(); if(e.key==='Enter'){e.preventDefault();close(true);} else if(e.key==='Escape'){e.preventDefault();close(false);} });
  ov.addEventListener('pointerdown',e=>{ if(e.target===ov)close(false); }); }
/* numbered image batch -> one timed sequence clip (stop-motion / Higgsfield / PNG-sequence-as-video). fps chosen at import. */
function addSequence(files,name,fps){ fps=Math.max(1,Math.min(120,+fps||24)); const total=files.length, frames=new Array(total); const folder=_importFolder;
  const m={id:uid(),name:name.replace(/\d+(\.[^.]+)$/,'###$1')+' ['+total+'f]',kind:'sequence',frames,tex:newTex(),w:1,h:1,dur:total/fps,fps,thumb:null,color:clipColorFor('sequence'),framePaths:files.map(f=>filePath(f)),_frameUrls:[],_curFrame:-1,folder:folder||null};
  let loaded=0;
  files.forEach((f,i)=>{ const url=URL.createObjectURL(f); m._frameUrls.push(url); const img=new Image(); img.onload=()=>{ const fit=fitImage(img); frames[i]=fit.src; if(i===0){ m.w=fit.w; m.h=fit.h; m.thumb=url; upTex(m.tex,fit.src); m._curFrame=0; } if(++loaded===total){ renderMedia(); render(); } }; img.onerror=()=>{ if(++loaded===total)renderMedia(); }; img.src=url; });
  state.media.push(m); adopt(m); renderMedia(); markDirty(); return m; }
/* text / title clip — rendered to a canvas texture (no external media; round-trips in any build) */
/* [U8] custom fonts — load a .ttf/.otf/.woff2 from disk, register it with FontFace, and expose it in the text-tool font list (session-scoped) */
let _customFonts=[];
async function loadCustomFont(){ if(!(IS_ELEC&&DSP.pickFile&&DSP.openRead&&DSP.readAt)){ flashStatus(T('Loading fonts needs the desktop app','Cargar fuentes necesita la app de escritorio'),'err'); return null; }
  const p=await DSP.pickFile({name:'Font',extensions:['ttf','otf','woff','woff2'],title:T('Load font','Cargar fuente')}); if(!p)return null;
  try{ const h=await DSP.openRead(p); if(!h||!h.id&&h.id!==0){ throw new Error('open'); } const raw=await DSP.readAt(h.id,0,h.size||0); try{await DSP.closeRead(h.id);}catch(_){}
    let bytes; if(raw instanceof Uint8Array)bytes=raw; else if(raw instanceof ArrayBuffer)bytes=new Uint8Array(raw); else if(raw&&raw.buffer)bytes=new Uint8Array(raw.buffer); else if(raw&&Array.isArray(raw.data))bytes=Uint8Array.from(raw.data); else if(typeof raw==='string')bytes=Uint8Array.from(atob(raw),c=>c.charCodeAt(0)); else if(Array.isArray(raw))bytes=Uint8Array.from(raw); else throw new Error('bytes');
    const base=(DSP.basename?DSP.basename(p):(p.split(/[\\/]/).pop()||p)); const fam=base.replace(/\.(ttf|otf|woff2?|)$/i,'').trim()||'Custom';
    const ff=new FontFace(fam, bytes.buffer); await ff.load(); document.fonts.add(ff);
    if(!_customFonts.includes(fam))_customFonts.push(fam);
    flashStatus(T('Font loaded: ','Fuente cargada: ')+fam); return fam;
  }catch(e){ flashStatus(T('Could not load that font','No se pudo cargar esa fuente'),'err'); return null; } }
function renderTextMedia(m){ const fs=Math.max(8,m.tfontSize||140), ff=m.tfont||'Inter, sans-serif', weight=m.tweight||'700', style=m.titalic?'italic ':'', pad=Math.round(fs*0.4);
  const align=m.talign||'center', lhF=Math.max(0.7,m.tlineH||1.25); // [U8] paragraph controls: font · weight · italic · size · alignment · line height
  const meas=document.createElement('canvas').getContext('2d'); meas.font=style+weight+' '+fs+'px '+ff;
  const lines=String(m.text==null?'':m.text).split('\n'); let maxw=1; for(const ln of lines)maxw=Math.max(maxw,meas.measureText(ln||' ').width);
  const lh=fs*lhF, W=Math.min(4096,Math.max(8,Math.ceil(maxw)+pad*2)), H=Math.min(4096,Math.max(8,Math.ceil(lines.length*lh)+pad*2));
  const cv=document.createElement('canvas'); cv.width=W; cv.height=H; const x=cv.getContext('2d');
  if(m.tbg&&m.tbg!=='transparent'){ x.fillStyle=m.tbg; x.fillRect(0,0,W,H); }
  x.font=style+weight+' '+fs+'px '+ff; x.textAlign=align; x.textBaseline='middle';
  const ax=align==='left'?pad:align==='right'?(W-pad):W/2;
  lines.forEach((ln,i)=>{ const y=pad+lh*(i+0.5); if(m.tstroke){ x.lineWidth=Math.max(2,fs*0.09); x.strokeStyle=m.tstrokeColor||'#000000'; x.lineJoin='round'; x.strokeText(ln,ax,y); } x.fillStyle=m.tcolor||'#ffffff'; x.fillText(ln,ax,y); });
  m.w=W; m.h=H; m.el=cv; m.originalEl=cv; if(!m.tex)m.tex=newTex(); upTex(m.tex,cv); try{m.thumb=cv.toDataURL();}catch(e){} }
function createTextClip(preset){ preset=(preset&&typeof preset==='object'&&!preset.preventDefault)?preset:{};
  const m={id:uid(),kind:'text',name:preset.name||T('Text','Texto'),text:preset.text||'TITLE',tfontSize:preset.tfontSize||160,tweight:preset.tweight||'700',tfont:'Inter, sans-serif',tcolor:preset.tcolor||'#ffffff',tbg:'transparent',tstroke:!!preset.tstroke,tstrokeColor:'#000000',dur:6,fps:0,color:clipColorFor('text'),folder:(state.mediaView==='grid'&&state.mediaFolder)||null}; // file into the folder being browsed (R88 audit)
  renderTextMedia(m); state.media.push(m); renderMedia(); addClip(m);
  const c=state.clips[state.clips.length-1]; if(c){ if(preset.el!=null)c.props.el=preset.el; if(preset.size!=null)c.props.size=preset.size; if(preset.az!=null)c.props.az=preset.az; state.selId=c.id; state.selIds=[c.id]; }
  renderInspector(); renderTimeline(); render(); markDirty(); flashStatus(T('Text clip added','Clip de texto añadido'));
  try{ if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>{renderTextMedia(m);render();}); }catch(e){} }
/* vector shape clip — rect / ellipse / line rendered to canvas texture */
function renderShapeMedia(m){ const W=m.sw||512,H=m.sh||512, sw=m.strokeW||0, inset=sw/2+2;
  const cv=document.createElement('canvas'); cv.width=W; cv.height=H; const x=cv.getContext('2d'); x.clearRect(0,0,W,H);
  x.fillStyle=m.fill||'#ffffff'; x.strokeStyle=m.stroke||'#000000'; x.lineWidth=sw; x.lineJoin='round';
  if(m.shape==='ellipse'){ x.beginPath(); x.ellipse(W/2,H/2,Math.max(1,W/2-inset),Math.max(1,H/2-inset),0,0,7); x.fill(); if(sw>0)x.stroke(); }
  else if(m.shape==='line'){ x.beginPath(); x.moveTo(inset,H/2); x.lineTo(W-inset,H/2); x.lineCap='round'; x.lineWidth=Math.max(4,sw||Math.round(H*0.18)); x.strokeStyle=m.fill||'#ffffff'; x.stroke(); }
  else { x.beginPath(); x.rect(inset,inset,W-inset*2,H-inset*2); x.fill(); if(sw>0)x.stroke(); }
  m.w=W; m.h=H; m.el=cv; m.originalEl=cv; if(!m.tex)m.tex=newTex(); upTex(m.tex,cv); try{m.thumb=cv.toDataURL();}catch(e){} }
function createShapeClip(shape){ const m={id:uid(),kind:'shape',name:T('Shape','Forma'),shape:shape||'rect',fill:'#C9CDD3',stroke:'#0E0F11',strokeW:0,sw:512,sh:512,dur:6,fps:0,color:clipColorFor('shape'),folder:(state.mediaView==='grid'&&state.mediaFolder)||null};
  renderShapeMedia(m); state.media.push(m); renderMedia(); addClip(m); markDirty(); flashStatus(T('Shape clip added','Clip de forma añadido')); }
/* ---- AUDIO (Web Audio) ---- */
let actx=null,masterGain=null,analyser=null,audioSources=[],_audioGains={};
function ACTX(){ if(!actx){ actx=new (window.AudioContext||window.webkitAudioContext)(); masterGain=actx.createGain(); analyser=actx.createAnalyser(); analyser.fftSize=256; masterGain.connect(analyser); analyser.connect(actx.destination); } return actx; }
function addAudio(file,path){ const url=URL.createObjectURL(file); const folder=_importFolder;
  fetch(url).then(r=>r.arrayBuffer()).then(b=>ACTX().decodeAudioData(b)).then(async ab=>{
    const wv=await computeWave(ab); const m={id:uid(),name:file.name,kind:'audio',buffer:ab,peaks:wv.peak,rms:wv.rms,dur:ab.duration,w:1,h:1,color:clipColorFor('audio'),thumb:waveThumb(wv.peak,108,64),path:path||null,fsize:file.size||0,folder:folder||null};
    state.media.push(m); adopt(m); renderMedia(); markDirty(); if(state.playing)startAudio(); }).catch(e=>{console.error('audio decode',e);appAlert(T('Could not decode audio.','No se pudo decodificar el audio.'));}); } // reschedule if the buffer finished decoding after Play started. [R92-T3] armMediaBands moved to on-demand (Reactive panel / source change / first reactive FX): 3 OfflineAudioContext renders per import were ~700MB of churn nobody asked for
function computePeaks(ab,n){ const ch=ab.getChannelData(0); const block=Math.max(1,Math.floor(ch.length/n)); const out=new Float32Array(n);
  for(let i=0;i<n;i++){ let mx=0; const s=i*block; for(let j=0;j<block;j+=4){const v=Math.abs(ch[s+j]||0);if(v>mx)mx=v;} out[i]=mx; } return out; }
/* real waveform: per-bucket PEAK (max-abs) + RMS at duration-aware resolution. Mastered music peaks near 1.0
   everywhere (a solid block with peak-only), so the RMS body is what reveals the actual dynamics/shape.
   ASYNC + chunked (~8M samples per slice): a 75-min WAV is ~216M samples — one synchronous pass froze the UI on import. */
async function computeWave(ab){ const ch=ab.getChannelData(0); const dur=ab.duration||1; const n=Math.min(60000,Math.max(2000,Math.round(dur*120)));
  const block=Math.max(1,Math.floor(ch.length/n)); const peak=new Float32Array(n), rms=new Float32Array(n);
  const bps=Math.max(1,Math.ceil(8e6/block)); // buckets per slice ≈ 8M input samples (short files: single slice, no yields)
  for(let i0=0;i0<n;i0+=bps){ const i1=Math.min(n,i0+bps);
    for(let i=i0;i<i1;i++){ let mx=0,ss=0; const s=i*block, e=Math.min(ch.length,s+block); for(let j=s;j<e;j++){ const v=ch[j]||0, a=v<0?-v:v; if(a>mx)mx=a; ss+=v*v; } const cnt=Math.max(1,e-s); peak[i]=mx; rms[i]=Math.sqrt(ss/cnt); }
    if(i1<n)await new Promise(r=>setTimeout(r,0)); }
  return {peak,rms}; }
function waveThumb(peaks,W,H){ const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');x.fillStyle='#1C2024';x.fillRect(0,0,W,H);x.strokeStyle=UI.ink2;x.lineWidth=1;x.beginPath();
  for(let i=0;i<W;i++){const p=peaks[Math.floor(i/W*peaks.length)]||0;x.moveTo(i+.5,H/2-p*(H/2-2));x.lineTo(i+.5,H/2+p*(H/2-2));}x.stroke();return c.toDataURL(); }
/* flatten audible audio into absolute-timeline events, DESCENDING into nested sequences (mirrors collectActiveVideos) so nested audio plays + exports. Honors per-level mute/solo and clips nested audio to the nest clip's visible window.
   [R92-T2] clip times/windows are LOCAL to the current sequence level; `S` maps local seconds → TOP seconds (top = tlOffset + local*S), so a nest clip's SPEED scales its inner audio (rate & positions), its LOOP repeats the inner pass per cycle, and its volume/fades compose down (pVol / pFiEnd / pFoStart, in TOP time). Video media contribute when m._exAudio is set (export decode) — preview video audio goes through the per-clip <audio> elements instead. */
function collectAudioEvents(clips,lanes,tlOffset,winA,winB,depth,out,S,pVol,pFiEnd,pFoStart){ out=out||[]; if((depth||0)>6||!clips||!lanes)return out; S=S||1; pVol=(pVol==null)?1:pVol;
  const anySolo=lanes.some(l=>l&&l.kind==='audio'&&l.solo);
  for(const c of clips){ const lane=lanes[c.lane]; if(c.disabled)continue; if(lane&&(lane.mute||(anySolo&&lane.kind==='audio'&&!lane.solo)))continue;
    const m=mediaById(c.mediaId); if(!m)continue; const absStart=tlOffset+c.start*S, absEnd=absStart+c.dur*S;
    const visA=Math.max(winA,absStart), visB=Math.min(winB,absEnd); if(visB<=visA+1e-6)continue;
    const buf=(m.kind==='audio')?m.buffer:((m.kind==='video'&&m._exAudio)?m._exAudio:null);
    if(buf){ const front=(visA-absStart)/S; const rate=(c.speed||1)/S;
      let fi=Math.max(0,((c.fadeIn||0)-front))*S, fo=(absEnd<=visB+1e-6)?(c.fadeOut||0)*S:0; // [F13] no fade-out when the window cuts the clip's tail (the fade belongs to the REAL end, not the cut)
      if(pFiEnd!=null&&visA<pFiEnd) fi=Math.max(fi,Math.min(visB,pFiEnd)-visA); // parent nest fade-in composed (approximated as one ramp)
      if(pFoStart!=null&&visB>pFoStart) fo=Math.max(fo,visB-Math.max(visA,pFoStart));
      { const tot=visB-visA; fi=Math.min(fi,tot); fo=Math.min(fo,tot); if(fi+fo>tot&&fi+fo>1e-6){ const s=tot/(fi+fo); fi*=s; fo*=s; } } // [R92-T6] proportional rescale like fadeFactor — video crossfaded but its audio didn't when fadeIn+fadeOut > dur
      const e={id:c.id, buffer:buf, start:visA, off:Math.max(0,(c.inP||0)+front*(c.speed||1)), rate, dur:visB-visA, fadeIn:fi, fadeOut:fo, vol:pVol*(c.props&&c.props.volume!=null?Math.max(0,c.props.volume/100):1)};
      if(c.loop&&c.loopLen>0){ e.loopLen=c.loopLen; e.loopS=(c.inP||0); } out.push(e); } // R81: loopable audio carries its loop region
    else if(isSeqMedia(m)&&m.nestClips){
      const nl=(m.nestLanes&&m.nestLanes.length?m.nestLanes:lanes); const r=(c.speed||1); const S2=S/r; // one inner-local second lasts S/r top seconds
      const nVol=pVol*(c.props&&c.props.volume!=null?Math.max(0,c.props.volume/100):1);
      const nfi=(c.fadeIn||0)*S, nfo=(absEnd<=visB+1e-6)?(c.fadeOut||0)*S:0;
      const fiEnd=Math.max(pFiEnd!=null?pFiEnd:-Infinity, nfi>0?absStart+nfi:-Infinity), foStart=Math.min(pFoStart!=null?pFoStart:Infinity, nfo>0?absEnd-nfo:Infinity);
      const _fiEnd=(fiEnd>-Infinity)?fiEnd:null, _foStart=(foStart<Infinity)?foStart:null;
      const inP=(c.inP||0);
      if(c.loop&&c.loopLen>0){ const cycTop=c.loopLen*S2; if(cycTop>1e-4){ let k=Math.max(0,Math.floor((visA-absStart)/cycTop)); let guard=0; // nest LOOP: repeat the inner pass per cycle (inner audio used to go silent after the first pass)
        for(; absStart+k*cycTop<visB-1e-6 && guard<4000; k++,guard++){ const tk=absStart+k*cycTop;
          collectAudioEvents(m.nestClips, nl, tk-inP*S2, Math.max(visA,tk), Math.min(visB,tk+cycTop), (depth||0)+1, out, S2, nVol, _fiEnd, _foStart); } } }
      else collectAudioEvents(m.nestClips, nl, absStart-inP*S2, visA, visB, (depth||0)+1, out, S2, nVol, _fiEnd, _foStart); } }
  return out; }
function startAudio(){ const ctx=ACTX(); if(ctx.state==='suspended'){ try{ ctx.resume().then(()=>{ if(state.playing&&!audioSources.length)startAudio(); }); }catch(_){} } stopAudio(); const base=ctx.currentTime,ph=state.playhead; _audioBase=base; _audioHead=ph; // R88: if the context was suspended, sources scheduled at the frozen clock stay silent → reschedule once it's actually running. anchor the audio clock so ploop can slave the playhead to it (no A/V drift)
  for(const ev of collectAudioEvents(state.clips,state.lanes,0,0,Infinity,0,[])){ const rel=ev.start-ph; const bufDur=ev.buffer.duration;
    const src=ctx.createBufferSource(); src.buffer=ev.buffer; const g=ctx.createGain(); src.connect(g); g.connect(masterGain); // per-clip gain node → independent volume + fades
    const vol=(ev.vol!=null?Math.max(0,ev.vol):1), ctxStart=base+rel, ctxEnd=ctxStart+ev.dur, fi=Math.max(0,Math.min(ev.fadeIn||0,ev.dur)), fo=Math.max(0,Math.min(ev.fadeOut||0,ev.dur)), gv=Math.max(0.0001,vol);
    try{
      g.gain.cancelScheduledValues(0); // envelope in ABSOLUTE ctx time so a mid-clip start lands at the right gain
      const evS=Math.max(base,ctxStart); // [R92-T6] a clip that began before the playhead has ctxStart in the PAST (even negative on a fresh context) — clamp the envelope anchors to the current clock
      if(fi>0&&ctxStart+fi>evS+0.001){ g.gain.setValueAtTime(0.0001,evS); g.gain.exponentialRampToValueAtTime(gv,ctxStart+fi); } else g.gain.setValueAtTime(gv,evS);
      if(fo>0){ g.gain.setValueAtTime(gv,Math.max(evS,Math.max(ctxStart+fi,ctxEnd-fo))); g.gain.exponentialRampToValueAtTime(0.0001,Math.max(evS+0.001,ctxEnd)); }
      const rate=ev.rate||1; try{ src.playbackRate.value=rate; }catch(_){} // per-clip speed: buffer offsets/lengths are in SOURCE seconds (wall dur × rate)
      if(ev.loopLen>0){ src.loop=true; src.loopStart=ev.loopS; src.loopEnd=Math.min(bufDur,ev.loopS+ev.loopLen); // R81: looping audio wraps in [loopS, loopS+loopLen); stop() bounds the wall-clock span
        if(rel>=0){ const w=ev.loopS+(((ev.off-ev.loopS)%ev.loopLen)+ev.loopLen)%ev.loopLen; src.start(base+rel,Math.min(w,bufDur)); try{src.stop(base+rel+ev.dur);}catch(_){} }
        else { const playOff=ph-ev.start; if(playOff>=ev.dur)continue; const sp=ev.off+playOff*rate; const w=ev.loopS+(((sp-ev.loopS)%ev.loopLen)+ev.loopLen)%ev.loopLen; src.start(base,Math.min(w,bufDur)); try{src.stop(base+(ev.dur-playOff));}catch(_){} } }
      else if(rel>=0){ const o=Math.min(Math.max(0,ev.off),bufDur); const len=Math.min(ev.dur*rate,bufDur-o); if(len<=0)continue; src.start(base+rel,o,len); }
      else { const playOff=ph-ev.start; if(playOff>=ev.dur)continue; const o=Math.min(Math.max(0,ev.off+playOff*rate),bufDur); const len=Math.min((ev.dur-playOff)*rate,bufDur-o); if(len<=0)continue; src.start(base,o,len); }
      audioSources.push(src); if(ev.id!=null)_audioGains[ev.id]=g;
    }catch(e){} } }
function stopAudio(){ for(const s of audioSources){try{s.stop();}catch(e){}} audioSources=[]; _audioGains={}; }
function reschedAudio(){ if(state.playing)startAudio(); } // [R92-T2 F5] edits during playback re-schedule the whole mix (cheap) — a deleted/moved/muted clip used to keep SOUNDING its old schedule until pause/seek
function liveAudioGain(c){ if(!c||!actx)return; const g=_audioGains[c.id]; if(!g)return; const vol=(c.props&&c.props.volume!=null?Math.max(0,c.props.volume/100):1); try{ g.gain.cancelScheduledValues(actx.currentTime); g.gain.setValueAtTime(Math.max(0.0001,vol),actx.currentTime); }catch(e){} } // live tweak while playing
function meters(){ if(!analyser||!state.playing){setMeters(0);return;} const a=new Uint8Array(analyser.fftSize); analyser.getByteTimeDomainData(a); let sum=0; for(let i=0;i<a.length;i++){const v=(a[i]-128)/128;sum+=v*v;} setMeters(Math.min(1,Math.sqrt(sum/a.length)*2.6)); }
function setMeters(v){ const p=(v*100)+'%'; if($('#mL'))$('#mL').style.width=p; if($('#mR'))$('#mR').style.width=p; }
function addImage(file,path){ const url=URL.createObjectURL(file); const img=new Image(); const folder=_importFolder;
  img.onload=()=>{const fit=fitImage(img); const m={id:uid(),name:file.name,kind:'image',el:fit.src,originalEl:img,tex:newTex(),w:fit.w,h:fit.h,dur:5,fps:0,thumb:url,color:clipColorFor('image'),proxyReady:false,proxyPct:0,path:path||null,fsize:file.size||0,folder:folder||null}; // [M5] photos default to 5 s
    upTex(m.tex,fit.src); state.media.push(m); adopt(m); renderMedia(); render(); markDirty(); }; img.src=url; }
function addVideo(file,path){ const url=URL.createObjectURL(file); const folder=_importFolder; const v=document.createElement('video'); v.src=url;v.muted=true;v.playsInline=true;v.preload='auto';
  v.addEventListener('loadedmetadata',()=>{ const m={id:uid(),name:file.name,kind:'video',el:v,originalEl:v,srcUrl:url,tex:newTex(),w:v.videoWidth,h:v.videoHeight,dur:v.duration,fps:30,thumb:null,color:clipColorFor('video'),proxyReady:false,proxyPct:0,path:path||null,fsize:file.size||0,folder:folder||null};
    state.media.push(m); adopt(m); renderMedia(); markDirty();
    detectFps(v,m,()=>{ seekMedia(m,0,true).then(()=>{makeThumb(m);render();}); }); },{once:true}); } // proxies are MANUAL now (right-click media → Generate proxy)
function makeThumb(m){const c=document.createElement('canvas');c.width=108;c.height=64;try{c.getContext('2d').drawImage(m.originalEl||m.el,0,0,108,64);m.thumb=c.toDataURL();renderMedia();}catch(e){}}
function detectFps(v,m,done){let fin=false;const fn=f=>{if(fin)return;fin=true;if(f>0)m.fps=f;if(done)done();};
  if(!v.requestVideoFrameCallback){fn(0);return;} let last=null,d=[],n=0;
  const onf=(now,meta)=>{if(last!=null&&meta.mediaTime>last)d.push(meta.mediaTime-last);last=meta.mediaTime;n++;
   if(n<10)v.requestVideoFrameCallback(onf);else{v.pause();v.currentTime=0;d.sort((a,b)=>a-b);const md=d[Math.floor(d.length/2)]||0;let f=md>0?Math.round(1/md):0;for(const cc of[24,25,30,48,50,60])if(Math.abs(f-cc)<=1.2){f=cc;break;}fn(f);}};
  setTimeout(()=>fn(0),2500); v.muted=true; v.play().then(()=>v.requestVideoFrameCallback(onf)).catch(()=>fn(0)); }
/* proxies — persistent DISK cache (R78): the proxy MP4 streams to userData/proxies while encoding
   (RAM stays flat regardless of clip length — the old in-memory target held ~12Mbps × duration, multi-GB
   for long clips) and is REUSED across sessions/projects (keyed by source path+size → reopening a project
   binds the cached file instantly instead of re-encoding for the clip's whole duration). */
const PMAX=960,PMBPS=12,proxyQ=[]; let proxyBusy=false;
let _proxyDir=null; if(IS_ELEC&&DSP.proxyDir){ try{ DSP.proxyDir().then(d=>{_proxyDir=d||null;}); }catch(e){} }
function proxyHash(s){ let h=5381; for(let i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))>>>0; return h.toString(36); }
function proxyCachePath(m){ if(!_proxyDir||!m.path)return null; return _proxyDir+'\\px_'+proxyHash(m.path+'|'+(m.fsize||0))+'_'+PMAX+'.mp4'; }
/* preferred location: NEXT TO the source clip (travels with the media/drive) — "MiClip.dsp-proxy-<hash>.mp4";
   the hash (path|size) self-invalidates the proxy if the source file is replaced. Central cache = fallback. */
function proxyLocalPath(m){ if(!m.path)return null; const i=Math.max(m.path.lastIndexOf('\\'),m.path.lastIndexOf('/')); if(i<0)return null;
  const dir=m.path.slice(0,i), base=m.path.slice(i+1), stem=base.replace(/\.[^.]+$/,'');
  return dir+'\\'+stem+'.dsp-proxy-'+proxyHash(m.path+'|'+(m.fsize||0))+'.mp4'; }
function proxyCandidates(m){ return IS_ELEC?[proxyLocalPath(m),proxyCachePath(m)].filter(Boolean):[]; } // lookup/write order: junto al clip → caché central
/* every "<stem>.dsp-proxy-<hash>.mp4" sitting next to the source — rescues a proxy orphaned when the source file was
   moved/renamed (its hash no longer matches path|size, so proxyCandidates would miss it). Validated by duration in bindProxyFile. */
async function proxyScanDir(m){ if(!IS_ELEC||!DSP.listDir||!m.path)return []; const i=Math.max(m.path.lastIndexOf('\\'),m.path.lastIndexOf('/')); if(i<0)return [];
  const dir=m.path.slice(0,i), stem=m.path.slice(i+1).replace(/\.[^.]+$/,'');
  const re=new RegExp('^'+stem.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\.dsp-proxy-\\w+\\.mp4$','i');
  try{ const files=await DSP.listDir(dir); return files.filter(f=>re.test(f.name)).map(f=>dir+'\\'+f.name); }catch(e){ return []; } }
/* attach an existing on-disk proxy: exact-hash candidates first, then any sibling "<stem>.dsp-proxy-*.mp4". A file that
   won't decode (interrupted encode → no moov) or is a stale cut (duration mismatch) is DELETED so it stops shadowing a
   clean regenerate and stops the app silently falling back to the heavy original. Generation stays MANUAL. */
async function attachExistingProxy(m,clean){ if(!m||m.kind!=='video'||!m.path||/\.dsp-proxy-\w+\.mp4$/i.test(m.path))return false;
  const seen=new Set(); const list=[...proxyCandidates(m), ...await proxyScanDir(m)]; let removed=false;
  for(const cp of list){ if(!cp){continue;} const key=cp.toLowerCase(); if(seen.has(key))continue; seen.add(key);
    let ex=false; try{ ex=await DSP.exists(cp); }catch(_){}
    if(!ex)continue;
    try{ await bindProxyFile(m,cp); return true; }
    catch(e){ if(clean!==false && !(e&&e.timeout)){ try{ if(await DSP.deleteFile(cp))removed=true; }catch(_){} } } } // [R108-rev A2] never delete on a bind TIMEOUT (slow disk) — only on real corruption / stale-cut
  if(removed&&clean!==false)try{ flashStatus(T('Removed a corrupt proxy for ','Se eliminó un proxy corrupto de ')+m.name+T(' — right-click → Generate proxy to rebuild.',' — clic-derecho → Generar proxy para rehacerlo.')); }catch(_){}
  return false; }
/* bind a cached proxy file as this media's proxy — metadata load doubles as the integrity check
   (a partial file from a killed session has no moov with fastStart:false → error → regenerate) */
async function bindProxyFile(m,cachePath){ const purl=DSP.toFileURL(cachePath); const pv=document.createElement('video'); pv.src=purl; pv.muted=true; pv.playsInline=true; pv.preload='auto';
  await new Promise((res,rej)=>{ pv.addEventListener('loadedmetadata',res,{once:true}); pv.addEventListener('error',()=>rej(new Error('proxy file invalid')),{once:true}); setTimeout(()=>{ const e=new Error('proxy bind timeout'); e.timeout=true; rej(e); },15000); }); // [R108-rev A2] a slow disk (NAS/cold HDD) can take >8s to read a VALID proxy's metadata; marking timeout lets callers NOT delete it as if corrupt
  if(m.dur>0 && pv.duration>0 && Math.abs(pv.duration-m.dur)>Math.max(1,m.dur*0.03)){ try{pv.removeAttribute('src');pv.load();}catch(_){} throw new Error('proxy duration mismatch — stale cut'); } // a proxy found by basename (moved/rehashed source) must be of THIS cut, not an older one
  m.proxyEl=pv; m.el=pv; m.pw=pv.videoWidth; m.ph=pv.videoHeight; m.proxyUrl=purl; m.proxyPath=cachePath; m.proxyReady=true; m.proxyPct=100; m._proxyForce=false; renderMedia(); updProxyUI(m); scrubRender(); }
function enqProxy(m){proxyQ.push(m);pumpProxy();}
async function pumpProxy(){if(proxyBusy||!proxyQ.length)return;proxyBusy=true;const m=proxyQ.shift();try{await makeProxy(m);}catch(e){console.error('proxy',e);m.proxyPct=-1;renderMedia();updProxyUI(m);try{if(m._pfid!=null){DSP.fileClose(m._pfid);}}catch(_){} if(e&&e.userMsg)try{appAlert(e.userMsg);}catch(_){}}finally{ if(m._ppart){ try{ if(m._pfid!=null)await DSP.fileClose(m._pfid); }catch(_){} try{ await DSP.deleteFile(m._ppart); }catch(_){} m._ppart=null; } m._pfid=null; m._pxGen=false; renderMedia(); }proxyBusy=false;pumpProxy();}
function seekRaw(v,t){return new Promise(r=>{t=Math.max(0,Math.min((v.duration||0)-1e-3,t));if(Math.abs(v.currentTime-t)<1e-3&&v.readyState>=2){requestAnimationFrame(()=>r());return;}const on=()=>{v.removeEventListener('seeked',on);r();};v.addEventListener('seeked',on);v.currentTime=t;});}
async function makeProxy(m){
  if(/\.dsp-proxy-\w+\.mp4$/i.test(m.path||'')){ m.proxyUrl=m.srcUrl; m.proxyEl=m.el; m.proxyReady=true; m.proxyPct=100; renderMedia(); updProxyUI(m); return; } // the imported file IS a proxy — it is its own proxy (no proxy-of-proxy)
  const candidates=proxyCandidates(m);
  if(!m._proxyForce){ if(await attachExistingProxy(m,true))return; } // cache hit (exact hash, then any sibling proxy) → instant; a corrupt/stale file is deleted here, then we re-encode below
  const dec=document.createElement('video');dec.src=m.srcUrl;dec.muted=true;dec.playsInline=true;dec.preload='auto';
  await new Promise((res,rej)=>{ dec.addEventListener('loadedmetadata',res,{once:true}); dec.addEventListener('error',()=>rej(new Error('source unreadable')),{once:true}); setTimeout(()=>rej(new Error('source metadata timeout')),15000); }); // [R108-rev A1] a missing/dead source used to hang makeProxy forever → proxyBusy stuck → whole queue frozen
  const fps=m.fps||30,dur=dec.duration||m.dur,total=Math.max(1,Math.round(dur*fps));
  const s=Math.min(1,PMAX/Math.max(dec.videoWidth,dec.videoHeight));
  const pw=Math.max(2,Math.round(dec.videoWidth*s/2)*2),ph=Math.max(2,Math.round(dec.videoHeight*s/2)*2);
  const oc=document.createElement('canvas');oc.width=pw;oc.height=ph;const ox=oc.getContext('2d');
  let codec='avc1.42E01E';for(const cc of['avc1.42E01E','avc1.4D0028']){const sup=await VideoEncoder.isConfigSupported({codec:cc,width:pw,height:ph,bitrate:PMBPS*1e6,framerate:fps});if(sup.supported){codec=cc;break;}}
  // target: stream to disk when possible (flat RAM, persists) — next to the clip first, central cache if that
  // folder is not writable (read-only drive / network share); in-memory only as last resort (browser / no path)
  let fid=null,cache=null,part=null,_wr=[],_werr=false;
  for(const cp of candidates){ const pt=cp+'.part'; try{ fid=await DSP.fileOpen(pt); }catch(e){ fid=null; } if(fid!=null){ cache=cp; part=pt; break; } } // [R107] encode to <name>.part → atomic rename on finalize (a killed session never leaves a moov-less proxy at the real name)
  m._pfid=fid; m._ppart=part; // so a mid-generation failure closes the fd AND deletes the partial (pumpProxy finally)
  const target=(fid!=null)
    ? new Mp4Muxer.StreamTarget({onData:(data,position)=>{ _wr.push(DSP.fileWriteAt(fid,position,data).then(ok=>{ if(ok===false)_werr=true; }).catch(()=>{_werr=true;})); }, chunked:true})
    : new Mp4Muxer.ArrayBufferTarget();
  const mux=new Mp4Muxer.Muxer({target,video:{codec:'avc',width:pw,height:ph},fastStart:(fid!=null)?false:'in-memory'});
  m.frames=[]; m.decConfig=null; let _frBytes=0,_frOvf=false; const FR_BUDGET=256*1024*1024; /* [T2] cap in-RAM all-intra chunks; long clips fall back to <video> seek */
  const enc=new VideoEncoder({output:(c,meta)=>{ mux.addVideoChunk(c,meta); if(meta&&meta.decoderConfig&&!m.decConfig)m.decConfig=meta.decoderConfig; if(!_frOvf){ const buf=new Uint8Array(c.byteLength); c.copyTo(buf); _frBytes+=buf.length; m.frames.push({ts:c.timestamp,dur:c.duration,type:c.type,data:buf}); if(_frBytes>FR_BUDGET)_frOvf=true; } },error:e=>console.error(e)});
  enc.configure({codec,width:pw,height:ph,bitrate:PMBPS*1e6,framerate:fps});
  const us=1e6/fps,gop=Math.max(1,Math.round(fps));
  let _np=0; const _pxT0=performance.now();
  /* [R109] progress feedback: throttle the DOM update (150ms) and re-fire a status line with % + ETA (1.5s) so a long
     proxy (a 64-min film) visibly advances instead of looking dead. */
  const bump=(idx)=>{ m.proxyPct=Math.min(100,Math.round((idx+1)/Math.max(1,total)*100)); const nw=performance.now();
    if(nw-(m._pxT||0)>150){ m._pxT=nw; updProxyUI(m); }
    if(nw-(m._pxS||0)>1500){ m._pxS=nw; const el=(nw-_pxT0)/1000, pc=m.proxyPct; if(pc>0&&pc<100){ const eta=el/pc*(100-pc); try{ flashStatus(T('Generating proxy ','Generando proxy ')+m.name+' · '+pc+'% · ~'+fmtDur(eta)+T(' left',' restante')); }catch(e){} } } };
  const drawEnc=(idx)=>{ ox.drawImage(dec,0,0,pw,ph); const vf=new VideoFrame(oc,{timestamp:Math.round(idx*us),duration:Math.round(us)}); enc.encode(vf,{keyFrame:true}); vf.close(); bump(idx); };
  const drawEncFrame=(idx,frame)=>{ ox.drawImage(frame,0,0,pw,ph); const vf=new VideoFrame(oc,{timestamp:Math.round(idx*us),duration:Math.round(us)}); enc.encode(vf,{keyFrame:true}); vf.close(); bump(idx); };
  /* [R109] FAST capture: decode with WebCodecs (the R108 demuxer) instead of playing the <video> at 1× real-time —
     a 64-min film proxy drops from ~64 min to ~5 min (one VideoDecoder reaches ~800fps). Falls back to rVFC/seek on any error. */
  let usedFast=false;
  if(IS_ELEC && HAS_WEBCODECS && DSP.openRead && m.path && !/\.dsp-proxy-\w+\.mp4$/i.test(m.path)){
    let dx=null;
    try{ dx=await demuxMP4(m.path);
      let outN=0, decErr=null;
      const vdec=new VideoDecoder({ output:(f)=>{ if(decErr||outN>=total){f.close();return;} try{ drawEncFrame(outN,f); }catch(e){ decErr=String(e); } outN++; f.close(); }, error:(e)=>{ decErr=String((e&&e.message)||e); } });
      vdec.configure({codec:dx.codec, description:dx.description});
      let bufData=null,bufStart=0,bufEnd=0; const RA=4*1024*1024;
      const inBuf=s=>bufData&&s.offset>=bufStart&&(s.offset+s.size)<=bufEnd;
      for(let i=0;i<dx.samples.length && outN<total;i++){
        if(decErr)throw new Error(decErr);
        const s=dx.samples[i];
        if(!inBuf(s)){ const a=s.offset; const data=await dx.readRange(a,Math.max(s.size,RA)); if(!data)throw new Error('proxy read failed'); bufData=data;bufStart=a;bufEnd=a+data.length; }
        vdec.decode(new EncodedVideoChunk({type:s.key?'key':'delta',timestamp:s.pts,data:bufData.subarray(s.offset-bufStart,s.offset+s.size-bufStart)}));
        while((vdec.decodeQueueSize>24 || enc.encodeQueueSize>24) && !decErr){ await new Promise(r=>setTimeout(r,0)); }
      }
      try{ await vdec.flush(); }catch(e){} try{vdec.close();}catch(e){}
      if(decErr && outN<Math.min(total,10))throw new Error(decErr); // decoded almost nothing → real failure, use fallback
      _np=total; usedFast=true; // capture complete via WebCodecs → the real-time paths below self-skip (_np===total)
    }catch(e){ usedFast=false; } finally{ try{dx&&dx.close();}catch(_){} }
  }
  if(!usedFast && dec.requestVideoFrameCallback){ /* [T9] sequential 1x capture (rVFC): decoding stays in the browser media pipeline (off the UI thread) → far less jank than per-frame seek; output structure (contiguous all-intra m.frames) unchanged */
    await new Promise((resolve)=>{ let done=false, wd=0; const fin=()=>{ if(!done){done=true; if(wd)clearInterval(wd); resolve();} };
      dec.addEventListener('ended',fin,{once:true}); // ultra-bitrate/VFR captures make the media clock RACE to the end within seconds (observed: 850Mbps 4K60 → ended at ~2s of a 26s file) — bail out now, the seek pass below finishes the job
      let wnp=-1; wd=setInterval(()=>{ if(_np===wnp)fin(); wnp=_np; },4000); // stall watchdog: no frame progress in 4s → bail to the seek pass (used to sit frozen at ~6% until a minutes-long safety timeout)
      const onf=async(now,meta)=>{ try{ const mt=(meta&&meta.mediaTime!=null)?meta.mediaTime:dec.currentTime; const tgt=Math.min(total-1,Math.round(mt*fps));
        while(_np<=tgt){ drawEnc(_np); _np++; if(enc.encodeQueueSize>16)await new Promise(r=>setTimeout(r,0)); }
        if(_np>=total||dec.ended){ fin(); return; } dec.requestVideoFrameCallback(onf); }catch(e){ fin(); } };
      setTimeout(fin, Math.max(8000,(dur+5)*1600)); /* safety: never hang the import */
      dec.play().then(()=>dec.requestVideoFrameCallback(onf)).catch(()=>fin()); });
    try{dec.pause();}catch(e){}
  }
  /* Complete every remaining frame with BOUNDED per-frame seeks (also the full path when rVFC is unavailable).
     Robust against files where 1x playback under-delivers; a seek that times out encodes the current frame,
     and 5 consecutive timeouts stop seeking (pad fast) — the proxy ALWAYS finishes. */
  let _dups=0,_lastSig=null,_sigN=0; // frozen-frame detector: hash a few pixels per sampled seeked frame — a decoder that silently stops producing new frames (out-of-level bitrate, e.g. 913Mbps 4K60) yields identical frames
  { let seekFails=0;
    while(_np<total){ const i=_np;
      if(seekFails<5){ const ok=await Promise.race([seekRaw(dec,i/fps).then(()=>true), new Promise(r=>setTimeout(()=>r(false),1500))]); if(ok)seekFails=0; else seekFails++; }
      drawEnc(i); _np++;
      if((i&7)===0){ try{ const d=ox.getImageData((pw>>1)-2,(ph>>1)-2,4,4).data; let s=0; for(let k=0;k<64;k++)s=(s*31+d[k])>>>0; if(s===_lastSig)_dups++; _lastSig=s; _sigN++; }catch(e){} } // sample 1-in-8: getImageData forces a sync canvas flush (~15× slower if done per frame)
      if(enc.encodeQueueSize>4)await new Promise(r=>setTimeout(r,0)); } }
  if(_sigN>15 && _dups/_sigN>0.85){ // proxy would be a frozen frame — abort, discard the partial, and tell the user the SOURCE is the problem
    try{ enc.close(); }catch(e){}
    if(fid!=null){ try{ await Promise.all(_wr); await DSP.fileClose(fid); }catch(e){} m._pfid=null; try{ await DSP.deleteFile(part); }catch(e){} m._ppart=null; }
    if(dec.src)dec.removeAttribute('src'); m.frames=null; m.decConfig=null;
    const err=new Error('frozen decode'); err.userMsg=T('This clip cannot be decoded reliably (bitrate above the codec level limit). Re-encode it (e.g. HandBrake/ffmpeg at ≤100 Mbps) — playback of the original will also fail.','Este clip no se puede decodificar de forma fiable (bitrate por encima del límite del códec). Recodifícalo (p. ej. HandBrake/ffmpeg a ≤100 Mbps) — la reproducción del original también fallará.'); throw err; }
  await enc.flush();mux.finalize(); if(_frOvf){m.frames=null;m.decConfig=null;}
  if(fid!=null){ // disk mode: flush positional writes, close, then publish atomically (rename .part → final) and bind (validates it)
    await Promise.all(_wr); await DSP.fileClose(fid); m._pfid=null;
    if(dec.src)dec.removeAttribute('src');
    if(_werr){ try{ await DSP.deleteFile(part); }catch(e){} m._ppart=null; throw new Error('proxy disk write failed'); }
    let published=false; try{ published=await DSP.rename(part,cache); }catch(e){}
    if(!published){ try{ await DSP.deleteFile(part); }catch(e){} m._ppart=null; throw new Error('proxy publish failed'); }
    m._ppart=null;
    try{ await bindProxyFile(m,cache); }catch(e){ if(!(e&&e.timeout)){ try{ await DSP.deleteFile(cache); }catch(_){} } throw e; } // a finalized file that still won't decode must not be left as a landmine — but a slow-disk TIMEOUT is not corruption, keep it
    return;
  }
  const blob=new Blob([mux.target.buffer],{type:'video/mp4'});
  const purl=URL.createObjectURL(blob); const pv=document.createElement('video');pv.src=purl;pv.muted=true;pv.playsInline=true;pv.preload='auto';
  await new Promise(r=>pv.addEventListener('loadedmetadata',r,{once:true}));
  if(dec.src)dec.removeAttribute('src');
  m.proxyEl=pv;m.el=pv;m.pw=pw;m.ph=ph;m.proxyUrl=purl;m.proxyReady=true;m.proxyPct=100;renderMedia();updProxyUI(m);scrubRender();
}
function updProxyUI(m){const it=document.querySelector('.mitem[data-id="'+m.id+'"]');if(it){const b=it.querySelector('.pbar>i');if(b)b.style.width=Math.max(0,m.proxyPct||0)+'%'; const tx=it.querySelector('.pbar .pbtxt');if(tx)tx.textContent=m.proxyReady?'':(m.proxyPct>0?(m.proxyPct+'%'):'…');}
  document.querySelectorAll('.pdot[data-mid="'+m.id+'"]').forEach(el=>{ el.style.background=m.proxyReady?'#B4BAC1':'#5E646C'; el.title=m.proxyReady?T('Proxy ready','Proxy listo'):T('No proxy yet / generating','Sin proxy aún / generando'); });
  const rdy=!!m.proxyReady,pct=m.proxyPct||0;
  document.querySelectorAll('.cpx[data-mid="'+m.id+'"]').forEach(el=>{el.textContent=rdy?'⚡ PROXY':(pct>0?'PROXY '+pct+'%':'ORIGINAL');});
  document.querySelectorAll('.cpxbar[data-mid="'+m.id+'"]').forEach(el=>{el.style.display=(rdy||pct<=0)?'none':'block';const i=el.querySelector('i');if(i)i.style.width=pct+'%';}); }

/* ===================== MEDIA LIST UI ===================== */
const fmtDur=s=>{s=Math.max(0,s||0);const m=Math.floor(s/60),x=Math.floor(s%60);return (s>=60?(m+':'+String(x).padStart(2,'0')):(x+'s'));};
/* ---- R88: NESTED folders (path-based tree). A folder is a "/"-joined path in state.folders; m.folder = its containing folder path (leaf) or null. Back-compat: old flat names are just top-level paths (no "/"). ---- */
const FSEP='/';
function folderName(p){ if(!p)return ''; const i=p.lastIndexOf(FSEP); return i>=0?p.slice(i+1):p; }
function folderParent(p){ if(!p)return null; const i=p.lastIndexOf(FSEP); return i>=0?p.slice(0,i):null; }
function folderChildren(parent){ return state.folders.filter(f=>folderParent(f)===(parent||null)); } // direct subfolders (parent=null → top level)
function folderExists(p){ return state.folders.includes(p); }
function folderDescendants(p){ return state.folders.filter(f=>f===p||f.indexOf(p+FSEP)===0); }
function sanitizeFolderName(n){ return String(n||'').replace(/[\\/]+/g,' ').replace(/\s+/g,' ').trim(); }
function joinFolder(parent,name){ return parent?parent+FSEP+name:name; }
function folderCount(f){ return state.media.filter(x=>x.folder===f).length; } // media directly in this folder
/* rewrite the path prefix oldP → newP across folders, media, colors and the current view (rename + move) */
function _reprefixFolders(oldP,newP){ if(oldP===newP)return;
  state.folders=state.folders.map(x=> x===oldP?newP : (x.indexOf(oldP+FSEP)===0? newP+x.slice(oldP.length) : x));
  for(const m of state.media){ if(m.folder===oldP)m.folder=newP; else if(m.folder&&m.folder.indexOf(oldP+FSEP)===0)m.folder=newP+m.folder.slice(oldP.length); }
  const fc=state.folderColors||{}; const nfc={}; for(const k of Object.keys(fc)){ if(k===oldP)nfc[newP]=fc[k]; else if(k.indexOf(oldP+FSEP)===0)nfc[newP+k.slice(oldP.length)]=fc[k]; else nfc[k]=fc[k]; } state.folderColors=nfc; // colours follow the folder
  const cf=state.mediaFolder; if(cf===oldP)state.mediaFolder=newP; else if(cf&&cf.indexOf(oldP+FSEP)===0)state.mediaFolder=newP+cf.slice(oldP.length);
  const sf=state.selFolder; if(sf===oldP)state.selFolder=newP; else if(sf&&sf.indexOf(oldP+FSEP)===0)state.selFolder=newP+sf.slice(oldP.length); }
/* R90: rename a folder IN PLACE over its own label (tree .fnm / grid tile .tlbl); falls back to the prompt if the element is missing */
function renameFolderInline(f,el){ if(!el)el=document.querySelector('#mediaList .folderhdr[data-fname="'+f+'"] .fnm')||document.querySelector('#mediaList .foldertile[data-fname="'+f+'"] .tlbl');
  const commit=v=>{ v=sanitizeFolderName(v); if(!v||v===folderName(f)){ renderMedia(); return; } const np=joinFolder(folderParent(f),v); if(folderExists(np)){ flashStatus(T('A folder with that name already exists','Ya existe una carpeta con ese nombre')); renderMedia(); return; } pushUndo(); _reprefixFolders(f,np); renderMedia(); markDirty(); };
  if(!inlineEdit(el,folderName(f),commit)){ renameFolder(f); return; }
  el.addEventListener('blur',()=>setTimeout(()=>renderMedia(),0),{once:true}); } // re-render after the edit ends (restores the count badge the contenteditable wiped)
function folderColor(f){ return (state.folderColors||{})[f]||null; }
function moveFolder(src,destParent){ if(src==null||src===destParent)return false; if(destParent&&(destParent===src||destParent.indexOf(src+FSEP)===0)){ flashStatus(T("Can't move a folder into itself",'No se puede mover una carpeta dentro de sí misma'),'err'); return false; } // [R94-UT3·U-21]
  if(folderParent(src)===(destParent||null))return false; // already there
  const np=joinFolder(destParent||null,folderName(src)); if(folderExists(np)){ flashStatus(T('A folder with that name already exists there','Ya existe una carpeta con ese nombre ahí')); return false; }
  pushUndo(); _reprefixFolders(src,np); renderMedia(); markDirty(); flashStatus(T('Folder moved','Carpeta movida')); return true; }
function moveMediaTo(ids,folderPath){ if(!ids||!ids.length)return; pushUndo(); const set=new Set(ids); for(const m of state.media)if(set.has(m.id))m.folder=folderPath||null; renderMedia(); markDirty(); flashStatus(folderPath?T('Moved to ','Movido a ')+folderName(folderPath):T('Moved out of folder','Sacado de la carpeta')); }
function newFolderIn(parent){ let base=T('Folder ','Carpeta ')+(folderChildren(parent).length+1),nm=base,i=2; while(folderExists(joinFolder(parent,nm)))nm=base+' '+(i++);
  // [M1] create the folder instantly and rename it inline over its own label (no pop-up)
  const path=joinFolder(parent,nm); pushUndo(); state.folders.push(path);
  let p=parent; while(p!=null){ delete state.collapsedGroups['f_'+p]; p=folderParent(p); } // expand the chain so the new folder is visible
  state.selFolder=path; // Adobe-like: the new folder becomes the selection (next "New folder" nests inside it)
  if(state.mediaView!=='grid')showFolders(); renderMedia(); markDirty();
  setTimeout(()=>{ renameFolderInline(path); },0); } // inline-edit the fresh label once it's in the DOM
/* drag a folder TILE onto another folder / the back tile / the grid background → re-parent it (R88) */
const _clearDropFX=()=>{ $$('#mediaList .folderhdr.dragover,#mediaList .folderdrop.dragover,#mediaList .mediagrid.dragover').forEach(x=>x.classList.remove('dragover')); };
function _dropTargetAt(ev){ const el=document.elementFromPoint(ev.clientX,ev.clientY); if(!el)return null; const fe=el.closest&&el.closest('.folderhdr,.folderdrop'); if(fe)return {el:fe,path:fe.dataset.fname||null}; const g=el.closest&&el.closest('.mediagrid'); if(g)return {el:g,path:g.dataset.fname||null}; return null; }
let _folderJustDragged=false; // suppress the click that fires right after a folder drag ends (would toggle selection)
function startFolderDrag(e,srcPath){ const sx=e.clientX,sy=e.clientY; let started=false,ghost=null; // no preventDefault on pointerdown — it can suppress the dblclick that OPENS the folder (R88 audit); the 5px threshold gates the drag
  const mv=ev=>{ if(!started){ if(Math.abs(ev.clientX-sx)<5&&Math.abs(ev.clientY-sy)<5)return; started=true; ghost=document.createElement('div'); ghost.style.cssText='position:fixed;pointer-events:none;z-index:80;opacity:.9;background:var(--s1);border:.5px solid rgba(255,255,255,0.25);border-radius:3px;padding:5px 9px;font:600 11px Geist;color:var(--ink);'; ghost.innerHTML=ICO('folder',12)+' '+folderName(srcPath); document.body.appendChild(ghost); }
    ghost.style.left=(ev.clientX+8)+'px'; ghost.style.top=(ev.clientY+8)+'px'; _clearDropFX(); const t=_dropTargetAt(ev);
    if(t && t.path!==srcPath && t.path!==folderParent(srcPath) && !(t.path&&(t.path===srcPath||t.path.indexOf(srcPath+FSEP)===0))) t.el.classList.add('dragover'); };
  const up=ev=>{ window.removeEventListener('pointermove',mv); window.removeEventListener('pointerup',up); if(ghost)ghost.remove(); _clearDropFX(); if(!started)return; _folderJustDragged=true; setTimeout(()=>{_folderJustDragged=false;},0); const t=_dropTargetAt(ev); if(t)moveFolder(srcPath, t.path||null); };
  window.addEventListener('pointermove',mv); window.addEventListener('pointerup',up); }
function renderMedia(){
  try{updEnable();}catch(e){} // [R94-UT3·U-12] every media add/remove passes through here → keep Compose/Adjust availability in sync
  const list=$('#mediaList'); list.innerHTML='';
  $('#mediaCount').textContent=state.media.length;
  let items=state.media.filter(m=>(state.mediaFilter==='all'||m.kind===state.mediaFilter)&&(!state.mediaQuery||m.name.toLowerCase().includes(state.mediaQuery.toLowerCase())));
  if(!state.media.length){ list.innerHTML='<div class="drop" id="dropZone">'+T('Drag <b>videos / images / audio</b><br>or click to import','Arrastra <b>vídeos / imágenes / audio</b><br>o haz clic para importar')+'</div>';
    $('#dropZone').onclick=()=>$('#fileInput').click(); wireDrop($('#dropZone')); return; }
  if(!items.length){ list.innerHTML='<div style="padding:34px 16px;color:var(--ink-dim);text-align:center;font-size:11px;">'+T('No matching media.','No hay medios coincidentes.')+'</div>'; return; }
  if(state.mediaView==='grid'){ // square-tile view with NESTED folder navigation (double-click a folder to enter, ← to go back; drag onto a folder to file into it)
    const grid=document.createElement('div'); grid.className='mediagrid'; list.appendChild(grid);
    const cur=(state.mediaFolder&&folderExists(state.mediaFolder))?state.mediaFolder:null; state.mediaFolder=cur;
    grid.dataset.fname=cur||''; // the grid background is a drop target for the CURRENT folder (drop here = file into it / to root)
    if(cur){ const par=folderParent(cur); const back=document.createElement('div'); back.className='mtile backtile folderhdr'; back.dataset.fname=(par||''); back.title=T('Back','Atrás');
      back.innerHTML=`<div class="tthumb" style="display:flex;align-items:center;justify-content:center;font-size:20px;color:var(--ink-2);">←</div><div class="tlbl" style="border-top:2px solid #454C55;">${folderName(cur)}</div>`;
      back.onclick=()=>{ state.mediaFolder=par; renderMedia(); };
      grid.appendChild(back); }
    for(const f of folderChildren(cur)){ const cnt=folderCount(f)+folderChildren(f).length; const fcol=folderColor(f);
      const t=document.createElement('div'); t.className='mtile foldertile folderhdr'; t.dataset.fname=f; t.title=folderName(f)+' — '+T('double-click to open','doble-clic para abrir');
      t.innerHTML=`<div class="tthumb" style="display:flex;align-items:center;justify-content:center;color:${fcol||'#8A9199'};">${ICO('folder',26)}</div><div class="tlbl" style="border-top:2px solid ${fcol||'#454C55'};">${folderName(f)} <span style="color:var(--ink-dim);">${cnt}</span></div>`;
      t.ondblclick=e=>{ if(e.target.isContentEditable)return; state.mediaFolder=f; renderMedia(); };
      t.addEventListener('pointerdown',e=>{ if(e.button===0&&!e.target.isContentEditable)startFolderDrag(e,f); }); // drag a folder into another folder
      t.oncontextmenu=e=>{ e.preventDefault(); openMenu(e.clientX,e.clientY,[{label:T('Open folder','Abrir carpeta'),fn:()=>{state.mediaFolder=f;renderMedia();}},{label:T('New subfolder…','Nueva subcarpeta…'),ico:'folder',fn:()=>newFolderIn(f)},{label:T('Rename','Cambiar nombre'),fn:()=>renameFolderInline(f,t.querySelector('.tlbl'))},...(folderParent(f)!=null?[{label:T('Move to top level','Mover al nivel superior'),fn:()=>moveFolder(f,null)}]:[]),'sep',{swatches:{cur:folderColor(f),onPick:col=>{ state.folderColors=state.folderColors||{}; state.folderColors[f]=col; renderMedia(); markDirty(); },onClear:()=>{ if(state.folderColors)delete state.folderColors[f]; renderMedia(); markDirty(); }}},'sep',{label:T('Delete folder','Eliminar carpeta'),danger:true,fn:()=>deleteFolder(f)}]); };
      grid.appendChild(t); }
    for(const m of items.filter(x=> cur? x.folder===cur : (!x.folder||!folderExists(x.folder)) )) grid.appendChild(makeMediaTile(m));
    return;
  }
  const grp=(key,label,gi)=>{ if(!gi.length)return; const collapsed=state.collapsedGroups[key]; const h=document.createElement('div'); h.className='grphead2'; h.dataset.folder=key;
    h.innerHTML=`<span style="display:inline-flex;transform:rotate(${collapsed?-90:0}deg);">${ICO('chevDown',12)}</span>${label} <span style="color:#50565D;">${gi.length}</span>`;
    h.onclick=()=>{state.collapsedGroups[key]=!collapsed;renderMedia();}; list.appendChild(h);
    if(!collapsed)for(const m of gi)list.appendChild(makeMediaItem(m)); };
  if(state.mediaGroupBy==='type'){ for(const k of ['video','image','audio']) grp('t_'+k,k,items.filter(m=>m.kind===k)); return; }
  if(state.mediaGroupBy==='folder' || state.folders.length){ // R89b: folders are ALWAYS visible in the list (Adobe-like) — the tree renders whenever folders exist; "None" only stays flat with zero folders
    const IND=13;
    if(state.mediaFolder&&!folderExists(state.mediaFolder))state.mediaFolder=null; const cur=state.mediaFolder; // R89c: the list navigates INTO folders too (dblclick), sharing state.mediaFolder with the grid
    const selectHdr=(h,f)=>{ state.selFolder=(state.selFolder===f?null:f); $$('#mediaList .folderhdr.fsel').forEach(x=>x.classList.remove('fsel')); if(state.selFolder===f)h.classList.add('fsel'); }; // select IN PLACE (no re-render — a re-render would swap the element mid-double-click and kill the dblclick)
    const drawFolder=(f,depth)=>{ const key='f_'+f, collapsed=!!state.collapsedGroups[key]; const kids=folderChildren(f); const gi=items.filter(m=>m.folder===f);
      const fcol=folderColor(f);
      const h=document.createElement('div'); h.className='grphead2 folderhdr'+(state.selFolder===f?' fsel':''); h.dataset.folder=key; h.dataset.fname=f; h.style.paddingLeft=(6+depth*IND)+'px';
      h.innerHTML=`<span class="fchev" title="${collapsed?T('Expand','Expandir'):T('Collapse','Contraer')}" style="display:inline-flex;cursor:pointer;transform:rotate(${collapsed?-90:0}deg);">${ICO('chevDown',12)}</span><span style="color:${fcol||'#8A9199'};display:inline-flex;">${ICO('folder',12)}</span><span class="fnm" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;${fcol?'color:'+fcol+';':''}">${folderName(f)}</span><span style="color:#50565D;">${gi.length+kids.length}</span>`;
      h.querySelector('.fchev').onclick=e=>{ e.stopPropagation(); state.collapsedGroups[key]=!collapsed; renderMedia(); };
      h.onclick=e=>{ if(_folderJustDragged||e.target.closest('.fchev')||e.target.isContentEditable)return; selectHdr(h,f); }; // select (Adobe: "New folder" then creates inside it)
      h.ondblclick=e=>{ if(e.target.closest('.fchev')||e.target.isContentEditable)return; state.mediaFolder=f; state.selFolder=null; renderMedia(); }; // R89c: double-click ENTERS the folder
      h.oncontextmenu=e=>{ e.preventDefault(); openMenu(e.clientX,e.clientY,[{label:T('Open folder','Abrir carpeta'),fn:()=>{state.mediaFolder=f;state.selFolder=null;renderMedia();}},{label:T('New subfolder…','Nueva subcarpeta…'),ico:'folder',fn:()=>newFolderIn(f)},{label:T('Rename','Cambiar nombre'),fn:()=>renameFolderInline(f,h.querySelector('.fnm'))},...(folderParent(f)!=null?[{label:T('Move to top level','Mover al nivel superior'),fn:()=>moveFolder(f,null)}]:[]),'sep',{swatches:{cur:folderColor(f),onPick:col=>{ state.folderColors=state.folderColors||{}; state.folderColors[f]=col; renderMedia(); markDirty(); },onClear:()=>{ if(state.folderColors)delete state.folderColors[f]; renderMedia(); markDirty(); }}},'sep',{label:T('Delete folder','Eliminar carpeta'),danger:true,fn:()=>deleteFolder(f)}]); }; // R90b: colours INLINE in the menu; rename IN PLACE; delete only here or via the Delete key
      h.addEventListener('pointerdown',ev=>{ if(ev.button!==0)return; if(ev.target.closest('.fchev')||ev.target.isContentEditable)return; startFolderDrag(ev,f); }); // drag the folder into another folder
      list.appendChild(h);
      if(collapsed)return;
      for(const k of kids)drawFolder(k,depth+1);
      if(gi.length){ for(const m of gi){ const row=makeMediaItem(m); row.style.paddingLeft=(6+(depth+1)*IND)+'px'; list.appendChild(row); } }
      else if(!kids.length){ const ph=document.createElement('div'); ph.className='folderdrop'; ph.dataset.fname=f; ph.style.marginLeft=(6+(depth+1)*IND)+'px'; ph.textContent=T('Drag media here','Arrastra medios aquí'); list.appendChild(ph); } };
    if(cur){ // scoped view: breadcrumb back row + the folder's subtree/media at depth 0
      const bk=document.createElement('div'); bk.className='grphead2 folderhdr'; bk.dataset.fname=(folderParent(cur)||''); bk.style.cursor='pointer';
      bk.innerHTML=`<span style="display:inline-flex;color:var(--ink-2);">←</span><span style="color:var(--ink-2);display:inline-flex;">${ICO('folder',12)}</span><span class="fnm" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${cur}</span>`;
      bk.title=T('Back','Atrás'); bk.onclick=()=>{ state.mediaFolder=folderParent(cur); state.selFolder=null; renderMedia(); };
      list.appendChild(bk);
      for(const f of folderChildren(cur))drawFolder(f,0);
      const gi=items.filter(m=>m.folder===cur);
      for(const m of gi)list.appendChild(makeMediaItem(m));
      if(!gi.length&&!folderChildren(cur).length){ const ph=document.createElement('div'); ph.className='folderdrop'; ph.dataset.fname=cur; ph.textContent=T('Drag media here','Arrastra medios aquí'); list.appendChild(ph); }
      return;
    }
    for(const f of folderChildren(null))drawFolder(f,0);
    const un=items.filter(m=>!m.folder||!folderExists(m.folder));
    if(state.folders.length){ const rh=document.createElement('div'); rh.className='grphead2 folderhdr'; rh.dataset.fname=''; rh.style.opacity='.75'; // root header = drop target to UN-file media
      rh.innerHTML=`<span style="display:inline-flex;color:var(--ink-2);">${ICO('panelL',12)}</span>${T('Unfiled','Sin archivar')} <span style="color:#50565D;">${un.length}</span>`;
      rh.onclick=()=>{ state.selFolder=null; $$('#mediaList .folderhdr.fsel').forEach(x=>x.classList.remove('fsel')); }; list.appendChild(rh); }
    for(const m of un)list.appendChild(makeMediaItem(m));
    return;
  }
  for(const m of items) list.appendChild(makeMediaItem(m));
}
function makeMediaItem(m){
    const d=document.createElement('div'); d.className='mitem'+(selectedMediaIds().includes(m.id)?' sel':''); d.dataset.id=m.id; d.draggable=false;
    const loading=!!(m._loading&&m.missing), reallyMissing=(m.missing&&!m._loading); // decoding (esp. audio) ≠ missing
    if(reallyMissing){ d.style.boxShadow='inset 0 0 0 1px #E06A6A'; } // [M4] media whose original is missing → red
    let px=''; if(m.kind==='video'){ if(m.proxyReady)px=`<div class="pbar"><i style="width:100%;background:var(--ink-2)"></i></div>`; else if(m.proxyPct>0||m._pxGen)px=`<div class="pbar gen"><i style="width:${Math.max(0,m.proxyPct||0)}%"></i><span class="pbtxt">${m.proxyPct>0?(m.proxyPct+'%'):'…'}</span></div>`; }
    const isNdi=(m.kind==='ndi'); const seq=isSeqMedia(m); const isAdj=(m.kind==='adjust'); const dur=isNdi?'NDI':(seq?'SEQ':(isAdj?'ADJ':(m.kind==='image'?'IMG':fmtDur(m.dur))));
    const meta=reallyMissing?T('missing · re-import','ausente · reimportar'):(loading?T('loading…','cargando…'):(isNdi?(T('NDI input','Entrada NDI')+(m._ndiLive?' · '+m.w+'×'+m.h:' · '+T('connecting…','conectando…'))):(seq?(T('sequence','secuencia')+' · '+m.w+'² · '+(m.fps||60)+'p'):(isAdj?T('adjustment · FX below','ajuste · FX debajo'):(m.kind==='audio'?('audio · '+fmtDur(m.dur)):(m.kind+' · '+m.w+'×'+m.h))))));
    const thumbBg=isAdj?'repeating-linear-gradient(45deg,rgba(180,186,193,0.30) 0 9px,rgba(180,186,193,0.10) 9px 18px)':(m.thumb?`url(${m.thumb})`:'none');
    d.innerHTML=`<div class="mthumb${seq?' mseq':''}" style="background-image:${thumbBg}">
        <span class="dur"${seq?' style="background:var(--state-on);color:var(--ink);"':''}>${dur}</span>${px}</div>
      <div style="flex:1;min-width:0;"><div class="mname">${m.name}${m.kind==='video'?` <span class="mprx" style="color:var(--ink-dim);font-weight:400;font-size:10px;">${m.proxyReady?T('proxy','proxy'):T('original','original')}</span>`:''}</div>
      <div class="mmeta" style="${reallyMissing?'color:#E06A6A':''}">${meta}</div></div>
      ${m.kind==='video'?`<span class="pdot" data-mid="${m.id}" title="${m.proxyReady?T('Proxy ready','Proxy listo'):T('No proxy yet','Sin proxy aún')}" style="width:8px;height:8px;border-radius:50%;flex-shrink:0;background:${m.proxyReady?'#8A9199':'#5E646C'}"></span>`:''}
      ${isNdi?`<span class="pdot ndilive${m._ndiLive?' on':''}" title="${T('Live NDI','NDI en vivo')}" style="width:8px;height:8px;border-radius:50%;flex-shrink:0;background:${m._ndiLive?'#E8EAED':'#5E646C'}"></span>`:''}
      <span class="mdot" style="background:${m.color}"></span>`;
    d.addEventListener('dblclick',()=>{ if(seq)openSeq(m.id); else addClip(m); });
    d.addEventListener('pointerdown',e=>{ if(e.button===0){ const multi=e.shiftKey||e.ctrlKey||e.metaKey; if(multi||!selectedMediaIds().includes(m.id))selectMedia(m.id,e); if(!multi)startMediaDrag(e,m); } }); // plain press on an ALREADY-selected item keeps the multi-selection → you can drag the whole selection to a folder (R88 audit)
    d.addEventListener('contextmenu',e=>{ if(!selectedMediaIds().includes(m.id))selectMedia(m.id); openMediaCtx(e,m); }); // keep an existing multi-selection for the menu
    { const nmEl=d.querySelector('.mname'); if(nmEl)nmEl.addEventListener('dblclick',e=>{ e.stopPropagation(); renameMediaInline(m,nmEl); }); } // double-click the name → rename in place
    return d;
}
/* R90: media Properties dialog — everything the app knows about the file (resolution, fps, duration, size, bitrate, path, proxy) */
function fmtBytes(b){ if(!b)return '—'; if(b>=1e9)return (b/1e9).toFixed(2)+' GB'; if(b>=1e6)return (b/1e6).toFixed(1)+' MB'; return Math.round(b/1e3)+' KB'; }
function mediaProperties(m){ const rows=[]; const add=(k,v)=>{ if(v!=null&&v!=='')rows.push([k,String(v)]); };
  const kindLbl={video:T('Video','Vídeo'),image:T('Image','Imagen'),audio:'Audio',sequence:T('Image sequence','Secuencia de imágenes'),nest:T('Sequence / composition','Secuencia / composición'),text:T('Text','Texto'),shape:T('Shape','Forma'),ndi:'NDI',adjust:T('Adjustment','Ajuste')}[m.kind]||m.kind;
  add(T('Name','Nombre'),m.name); add(T('Type','Tipo'),kindLbl);
  if(m.kind!=='audio'&&m.w>1)add(T('Resolution','Resolución'),m.w+' × '+m.h+' px');
  if((m.kind==='video'||m.kind==='sequence'||m.kind==='nest')&&m.fps)add(T('Frame rate','Velocidad'),m.fps+' fps');
  if(m.dur&&m.kind!=='image')add(T('Duration','Duración'),fmtDur(m.dur)+'  ('+m.dur.toFixed(2)+' s)');
  if(m.kind==='sequence'&&m.framePaths)add(T('Frames','Fotogramas'),m.framePaths.length);
  if(m.buffer){ add(T('Sample rate','Frecuencia'),m.buffer.sampleRate+' Hz'); add(T('Channels','Canales'),m.buffer.numberOfChannels); }
  if(m.fsize)add(T('Size on disk','Tamaño en disco'),fmtBytes(m.fsize));
  if(m.fsize&&m.dur&&(m.kind==='video'||m.kind==='audio'))add(T('Average bitrate','Bitrate promedio'),(m.fsize*8/m.dur/1e6).toFixed(1)+' Mbps');
  if(m.kind==='video')add('Proxy',m.proxyReady?T('ready','listo'):(m.proxyPct>0?(T('generating ','generando ')+Math.round(m.proxyPct)+'%'):T('none','sin proxy')));
  if(m.folder)add(T('Folder','Carpeta'),m.folder);
  add(T('Location','Ubicación'),m.path||(m.kind==='text'||m.kind==='shape'||m.kind==='nest'||m.kind==='adjust'?T('(generated inside the project)','(generado dentro del proyecto)'):'—'));
  const ov=document.createElement('div'); ov.className='overlay';
  ov.innerHTML=`<div class="modal" style="width:460px;"><div class="mh"><span style="color:var(--ink-2);display:flex;">${ICO('panel',16)}</span><span class="t">${T('Properties','Propiedades')}</span></div><div class="mb">
    <div style="border:.5px solid rgba(255,255,255,0.08);border-radius:2px;overflow:hidden;">${rows.map((r,i)=>`<div style="display:flex;gap:12px;padding:7px 11px;background:${i%2?'transparent':'rgba(255,255,255,0.02)'};font-size:11px;"><span style="width:130px;flex-shrink:0;color:var(--ink-3);">${r[0]}</span><span class="tnum" style="flex:1;min-width:0;color:var(--ink);word-break:break-all;user-select:text;">${r[1]}</span></div>`).join('')}</div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:11px;">${(IS_ELEC&&m.path&&DSP.revealPath)?`<button class="mbtn" id="prReveal">${ICO('folder',13)} ${T('Reveal in Explorer','Mostrar en el Explorador')}</button>`:''}<button class="mbtn pri" id="prClose">${T('Close','Cerrar')}</button></div></div></div>`;
  document.body.appendChild(ov); const close=()=>ov.remove(); $('#prClose').onclick=close; ov.addEventListener('pointerdown',e=>{if(e.target===ov)close();});
  const rv=$('#prReveal'); if(rv)rv.onclick=()=>{ try{DSP.revealPath(m.path);}catch(e){} }; }
/* shared media right-click menu (list rows + grid tiles) */
function openMediaCtx(e,m){ e.preventDefault(); const seq=isSeqMedia(m); const items=[];
  const selIds=selectedMediaIds(); const composable=selIds.map(mediaById).filter(x=>x&&x.kind!=='audio'&&x.kind!=='adjust'&&!isSeqMedia(x)); // R88: compose from several media at once
  if(composable.length>=2 && selIds.includes(m.id)){ items.push({label:T('Create composition from these ','Crear composición desde estos ')+composable.length,ico:'ring',fn:()=>openCompose('ring',null,null,null,composable.map(x=>x.id))}); items.push('sep'); }
  if(seq) items.push({label:T('Open sequence','Abrir secuencia'),ico:'panel',fn:()=>openSeq(m.id)});
  items.push({label:seq?T('Add as nest','Añadir como nido'):T('Add to timeline','Añadir a la línea de tiempo'),ico:'plus',fn:()=>addClip(m)});
  items.push({label:T('Rename','Renombrar'),key:'⌘R',fn:()=>renameMediaInline(m,mediaNameEl(m.id))});
  items.push({label:T('Properties…','Propiedades…'),ico:'panel',fn:()=>mediaProperties(m)}); // R90: resolution / fps / size / bitrate / path
  if(IS_ELEC&&m.path&&DSP.revealPath) items.push({label:T('Reveal in Explorer','Mostrar en el Explorador'),ico:'folder',fn:()=>{ try{DSP.revealPath(m.path);}catch(e){} }}); // R90: locate media on disk
  if(m.kind==='video'){ const selVids=((selIds.includes(m.id)?selIds.map(mediaById):[m]).filter(x=>x&&x.kind==='video')); const many=selVids.length>1; // proxies are manual now: generate for the whole (shift-)selection
    items.push({label:many?(T('Generate proxies (','Generar proxys (')+selVids.length+')'):(m.proxyReady?T('Regenerate proxy','Regenerar proxy'):T('Generate proxy','Generar proxy')),ico:'video',fn:()=>{ if(!HAS_WC){flashStatus(T('Proxies need WebCodecs (browser build)','Los proxys requieren WebCodecs'));return;} for(const v of selVids){ v.proxyReady=false; v.proxyPct=0; v._pxGen=true; if(v.proxyPath)v._proxyForce=true; enqProxy(v); } renderMedia(); flashStatus(many?(T('Generating ','Generando ')+selVids.length+T(' proxies…',' proxys…')):T('Generating proxy…','Generando proxy…')); }}); }
  if(IS_ELEC && (m.kind==='video'||m.kind==='audio'||m.kind==='image')) items.push({label:T('Replace media…','Reemplazar medio…'),fn:()=>replaceMedia(m)});
  if(m.missing&&IS_ELEC) items.push({label:T('Locate file…','Localizar archivo…'),ico:'upload',fn:async()=>{ try{ const p=await DSP.pickMedia(); if(p){ m.path=p; await reloadMedia(m); flashStatus(T('Media re-linked','Medio re-vinculado')); } }catch(e){} }});
  if(state.folders.length){ items.push('sep'); const tgt=()=>selectedMediaIds().includes(m.id)?selectedMediaIds():[m.id]; // move the whole multi-selection (R88 audit) + undo/dirty via moveMediaTo
    for(const f of state.folders) items.push({label:(m.folder===f?'✓ ':'')+T('Move to: ','Mover a: ')+f,fn:()=>moveMediaTo(tgt(),f)});
    if(m.folder)items.push({label:T('Remove from folder','Quitar de carpeta'),fn:()=>moveMediaTo(tgt(),null)}); }
  items.push('sep',{label:seq?T('Delete sequence','Eliminar secuencia'):T('Delete media','Eliminar medio'),ico:'trash',danger:true,fn:()=>deleteMedia(m)});
  openMenu(e.clientX,e.clientY,items); }
/* grid tile (square) — same drag / dbl-click / context menu as a list row */
function makeMediaTile(m){ const seq=isSeqMedia(m), isNdi=(m.kind==='ndi');
  const d=document.createElement('div'); d.className='mtile'+((m.missing&&!m._loading)?' missing':'')+(selectedMediaIds().includes(m.id)?' sel':''); d.dataset.id=m.id; d.title=m.name;
  const isAdj=(m.kind==='adjust'); const dur=isNdi?'NDI':(seq?'SEQ':(isAdj?'ADJ':(m.kind==='image'?'IMG':fmtDur(m.dur))));
  const px=(m.kind==='video'&&!m.proxyReady&&m.proxyPct>0)?`<div class="tpbar"><i style="width:${m.proxyPct}%"></i></div>`:'';
  const tbg=isAdj?'repeating-linear-gradient(45deg,rgba(180,186,193,0.30) 0 9px,rgba(180,186,193,0.10) 9px 18px)':(m.thumb?`url(${m.thumb})`:'none');
  d.innerHTML=`<div class="tthumb${seq?' mseq':''}" style="background-image:${tbg};"><span class="tdur">${dur}</span>${m.kind==='video'&&m.proxyReady?'<span class="tprox">⚡</span>':''}${px}</div><div class="tlbl" style="border-top:2px solid ${m.color};">${m.name}</div>`;
  d.addEventListener('dblclick',()=>{ if(seq)openSeq(m.id); else addClip(m); });
  d.addEventListener('pointerdown',e=>{ if(e.button===0){ const multi=e.shiftKey||e.ctrlKey||e.metaKey; if(multi||!selectedMediaIds().includes(m.id))selectMedia(m.id,e); if(!multi)startMediaDrag(e,m); } }); // press on an already-selected tile keeps the multi-selection (drag the whole set)
  d.addEventListener('contextmenu',e=>{ if(!selectedMediaIds().includes(m.id))selectMedia(m.id); openMediaCtx(e,m); });
  { const lblEl=d.querySelector('.tlbl'); if(lblEl)lblEl.addEventListener('dblclick',e=>{ e.stopPropagation(); renameMediaInline(m,lblEl); }); } // double-click the label → rename in place
  return d; }
/* media selection — single click, or shift/ctrl-click to MULTI-select (R88, e.g. compose from several media). Takes Delete priority over the timeline clip selection (R86). */
function selectedMediaIds(){ return (state.selMediaIds&&state.selMediaIds.length)?state.selMediaIds.slice():(state.selMediaId!=null?[state.selMediaId]:[]); }
function paintMediaSel(){ const set=new Set(selectedMediaIds()); $$('#mediaList .mitem,#mediaList .mtile').forEach(x=>x.classList.toggle('sel',set.has(+x.dataset.id))); }
function orderedMediaIds(){ return [...$$('#mediaList .mitem,#mediaList .mtile')].map(x=>+x.dataset.id).filter(id=>!isNaN(id)); } // media ids in on-screen order (respects folders/collapse/filter)
function selectMedia(id,e){
  if(e&&e.shiftKey && state.selMediaAnchor!=null && state.selMediaAnchor!==id){ // R90c: SHIFT = contiguous RANGE from the anchor to here (Adobe/Explorer style)
    const ord=orderedMediaIds(); const a=ord.indexOf(state.selMediaAnchor), b=ord.indexOf(id);
    if(a>=0&&b>=0){ const lo=Math.min(a,b),hi=Math.max(a,b); state.selMediaIds=ord.slice(lo,hi+1); state.selMediaId=id; paintMediaSel(); return; } }
  if(e&&(e.ctrlKey||e.metaKey)){ state.selMediaIds=selectedMediaIds(); const i=state.selMediaIds.indexOf(id); if(i>=0)state.selMediaIds.splice(i,1); else state.selMediaIds.push(id); state.selMediaId=state.selMediaIds.length?state.selMediaIds[state.selMediaIds.length-1]:null; state.selMediaAnchor=id; } // CTRL/CMD = toggle one
  else { state.selMediaId=id; state.selMediaIds=[id]; state.selMediaAnchor=id; } // plain click = single + set the range anchor
  paintMediaSel(); }
function clearMediaSel(){ if(state.selFolder){ state.selFolder=null; $$('#mediaList .folderhdr.fsel').forEach(x=>x.classList.remove('fsel')); } // touching the timeline/viewport also drops the folder selection → Delete can't nuke a folder by surprise (R90)
  state.selMediaAnchor=null; if(state.selMediaId==null&&!(state.selMediaIds&&state.selMediaIds.length))return; state.selMediaId=null; state.selMediaIds=[]; $$('#mediaList .mitem.sel,#mediaList .mtile.sel').forEach(x=>x.classList.remove('sel')); }
function mediaNameEl(id){ return document.querySelector('#mediaList .mitem[data-id="'+id+'"] .mname')||document.querySelector('#mediaList .mtile[data-id="'+id+'"] .tlbl'); }
/* rename a media item IN PLACE (over its own label), not a floating dialog (R86) */
function renameMediaInline(m,el){ if(!m)return; el=el||mediaNameEl(m.id); if(!inlineEdit(el,m.name,v=>{ pushUndo(); m.name=v; renderMedia(); projTitle&&projTitle(); markDirty(); })) appPrompt(T('Media name:','Nombre del medio:'),m.name,n=>{ if(n!=null){ pushUndo(); m.name=n; renderMedia(); markDirty(); } }); }
/* delete a media item + its clips (shared by the context menu and the Delete key) */
function deleteMedia(m){ if(!m)return; if(isSeqMedia(m)){ deleteSequenceMedia(m.id); return; }
  const doIt=()=>{
    pushUndo(); for(const c of state.clips)if(c.mediaId===m.id&&c.maskTex){try{gl.deleteTexture(c.maskTex);}catch(e){}} try{disposeDecoder(m);}catch(e){} if(m.kind==='ndi')closeNdiMedia(m); state.mediaTrash=state.mediaTrash||{}; state.mediaTrash[m.id]=m; state.media=state.media.filter(x=>x.id!==m.id);
    if(m.path&&(m.kind==='video'||m.kind==='audio'||m.kind==='image')){ // [R92-T3 F2] the trash used to retain the decoded AudioBuffer (1.4GB/h), the <video> demuxer and the GPU texture for the whole session — undo re-loads from disk instead
      try{ if(m.el&&m.el.pause){m.el.pause();m.el.removeAttribute('src');m.el.load();} }catch(e){} m.el=null; m.originalEl=null;
      if(m.tex){try{gl.deleteTexture(m.tex);}catch(e){} m.tex=null;} m.buffer=null; m.frames=null; m._trashed=true; }
    state.clips=state.clips.filter(c=>c.mediaId!==m.id); for(const s of state.media)if(isSeqMedia(s)){ if(s.id===state.activeSeqId)s.nestClips=state.clips; else if(s.nestClips)s.nestClips=s.nestClips.filter(c=>c.mediaId!==m.id); }
    renderMedia();renderTimeline();render();updStatus(); };
  const others=state.media.filter(s=>isSeqMedia(s)&&s.id!==state.activeSeqId&&(s.nestClips||[]).some(c=>c.mediaId===m.id)); // [R92-T1 C6] undo only restores the ACTIVE sequence — warn before silently losing clips in other sequences
  if(others.length){ appConfirm(T('"'+m.name+'" is also used in '+others.length+' other sequence'+(others.length>1?'s':'')+' ('+others.map(s=>s.name).join(', ')+'). Deleting removes those clips too, and Undo only restores the current sequence.','"'+m.name+'" también se usa en '+others.length+' secuencia'+(others.length>1?'s':'')+' más ('+others.map(s=>s.name).join(', ')+'). Al borrar se eliminan también esos clips, y Deshacer solo restaura la secuencia actual.'), ok=>{ if(ok)doIt(); }, {ok:T('Delete','Eliminar'),danger:true}); return; }
  doIt(); }

/* ===================== TIMELINE ===================== */
function makeClip(m,lane,start,props,extra){
  return Object.assign({id:uid(),mediaId:m.id,lane,start:Math.max(0,start),dur:m.dur||6,inP:0,name:m.name,color:m.color,
    fadeIn:0,fadeOut:0,props:Object.assign({az:0,el:35,size:55,rot:0,spin:0,mirror:false,opacity:100,blur:0,feather:0,crop:0,mask:'none',blend:'normal',exposure:0,contrast:0,saturation:0,temperature:0,tint:0,glow:0,chroma:0,react:'none',reactAmt:60,fulldome:false,fisheye:false,fisheyeAmt:60,equirect:false,eqPitch:0,blackKey:false,blackKeyAmt:15,blackKeySoft:30,warp:'patch',secAz:60,secEl:30,volume:100,x:0,y:0,scale:100,lut:null,lutMix:100},props||{}),kf:{},fx:[]}, extra||{});
}
function addClip(m,lane,start){
  if(isSeqMedia(m)&&(m.id===state.activeSeqId||seqReaches(m.id,state.activeSeqId))){ flashStatus(T("Can't nest a sequence inside itself (would create a loop)",'No se puede anidar una secuencia que crearía un bucle'),'err'); return; } // [R94-UT3·U-21]
  if(m.kind==='adjust'){ pushUndo(); // adjustment media → an adjustment CLIP (its FX chain — colour AND audio-reactive — affects every layer below it)
    if(lane==null){ lane=state.lanes.findIndex(l=>l.kind==='video'); if(lane<0){ const n=state.lanes.filter(l=>l.kind==='video').length+1; state.lanes.push({id:uid(),name:'Video '+n,tag:'V'+n,kind:'video'}); lane=state.lanes.length-1; } }
    start=(start!=null)?start:state.playhead; const hasWork=(state.workIn!=null&&state.workOut!=null&&state.workOut>state.workIn); const dur=hasWork?(state.workOut-state.workIn):Math.max(6,m.dur||6);
    const c=makeAdjustClip(lane,start,dur); state.clips.push(c); state.selId=c.id; state.selIds=[c.id]; state.selGroupId=null; clearMediaSel(); renderTimeline(); renderInspector(); render(); updStatus(); return c; }
  diag('info','clip','add',{media:m&&m.name,kind:m&&m.kind,lane,start:(start!=null?+(+start).toFixed(2):'playhead')});
  pushUndo();
  if(lane==null){ const want=m.kind==='audio'?'audio':'video'; lane=state.lanes.findIndex(l=>l.kind===want);
    if(lane<0){ const n=state.lanes.filter(l=>l.kind===want).length+1; state.lanes.push({id:uid(),name:(want==='audio'?'Audio ':'Video ')+n,tag:(want==='audio'?'A':'V')+n,kind:want}); lane=state.lanes.length-1; } } // auto-create a track of the right kind (dragging audio in with no audio track makes one)
  start=(start!=null)?start:state.playhead;
  const c=makeClip(m,lane,start);
  state.clips.push(c); state.selId=c.id; state.selIds=[c.id]; state.selGroupId=null; clearMediaSel(); renderTimeline(); renderInspector(); render(); updStatus(); // adding to the timeline hands Delete-priority to the new clip (R86)
}
const TC=(s)=>{s=Math.max(0,s);const f=state.fps;const tf=Math.round(s*f);const ff=tf%f, ss=Math.floor(tf/f)%60, mm=Math.floor(tf/f/60);return String(mm).padStart(2,'0')+':'+String(ss).padStart(2,'0')+':'+String(ff).padStart(2,'0');};
function fmtTime(s){ const mode=state.tl.tcMode; if(mode==='frames')return String(Math.round(Math.max(0,s)*state.fps)); if(mode==='bars')return BBT(s); return TC(s); }
/* Ruler drawn into a VIEWPORT-SIZED canvas (positioned at scrollLeft, drawn in content coords via a −scrollLeft
   transform). A full-content-width canvas overflowed the browser's max canvas area at high zoom → the ruler
   went solid white. Windowed + only visible ticks drawn → correct + fast at any zoom. Re-run on scroll. */
function drawRuler(){ const rc=$('#rulerCv'), sc=$('#tlscroll'); if(!rc||!sc)return;
  const pps=state.tl.pxPerSec, dur=Math.max(0,state.tl._w||0), W=dur*pps, dpr=Math.min(window.devicePixelRatio||1,2);
  const sl=sc.scrollLeft||0, vw=sc.clientWidth||W||1, viewW=Math.max(1,Math.min(W||vw, vw+300));
  rc.style.position='absolute'; rc.style.top='0'; rc.style.left=sl+'px'; rc.style.width=viewW+'px'; rc.style.height='22px';
  rc.width=Math.max(1,Math.round(viewW*dpr)); rc.height=Math.round(22*dpr);
  const rx=rc.getContext('2d'); rx.setTransform(dpr,0,0,dpr,-sl*dpr,0); rx.clearRect(sl,0,viewW,22); rx.font='11px Geist'; rx.textBaseline='middle'; rx.fillStyle=UI.inkDim;
  const x0=sl-2, x1=sl+viewW+2;
  if(state.tl.tcMode==='bars'){ const spb=60/state.tl.bpm, barLen=spb*state.tl.sig; let bi=barLen; while(bi*pps<46)bi*=2;
    let bar=1; for(let tt=0; tt<=dur; tt+=barLen,bar++){ const x=tt*pps; if(x>=x0&&x<=x1){ rx.strokeStyle='rgba(255,255,255,0.1)';rx.beginPath();rx.moveTo(x,22);rx.lineTo(x,11);rx.stroke();
      if(barLen*pps>=46||bar%Math.round(bi/barLen)===1) rx.fillText(bar,x+3,7);
      if(spb*pps>=22) for(let bt=1;bt<state.tl.sig;bt++){const bx=(tt+bt*spb)*pps; if(bx<x0||bx>x1)continue; rx.strokeStyle='rgba(255,255,255,0.05)';rx.beginPath();rx.moveTo(bx,22);rx.lineTo(bx,16);rx.stroke();} } }
  } else { let iv=gridSec(); if(iv*pps<7)iv=Math.ceil(7/(iv*pps))*iv; // keep ticks readable even on a very narrow grid
    const startTt=Math.max(0, Math.floor((x0/pps)/iv)*iv);
    for(let tt=startTt; tt*pps<=x1 && tt<=dur+iv; tt+=iv){ const x=tt*pps; if(x<x0)continue; rx.strokeStyle='rgba(255,255,255,0.07)';rx.beginPath();rx.moveTo(x,22);rx.lineTo(x,14);rx.stroke();
      if((Math.round(tt/iv))%(Math.max(1,Math.round(66/(iv*pps))))===0) rx.fillText(fmtTime(tt),x+3,7); } }
  for(const mk of state.markers){ const x=mk.time*pps; if(x<x0-40||x>x1+40)continue; const selM=mk.id===state.selMarkerId; const col=selM?'#F2F4F6':(mk.color||'#B4BAC1');
    rx.fillStyle=col; rx.beginPath(); rx.moveTo(x,2); rx.lineTo(x+9,5); rx.lineTo(x,8); rx.closePath(); rx.fill(); rx.fillRect(x-0.5,2,1,18);
    if(selM){ rx.strokeStyle='rgba(255,255,255,0.85)'; rx.lineWidth=1; rx.beginPath(); rx.moveTo(x,2); rx.lineTo(x+9,5); rx.lineTo(x,8); rx.closePath(); rx.stroke(); }
    if(mk.name){ rx.font=(selM?'600 ':'')+'9px Inter'; rx.fillStyle=col; rx.textBaseline='middle'; rx.fillText(mk.name, x+12, 6); } }
  drawCacheMap(); }
/* draw the waveform for MEDIA-time range [t0,t1] into cvs (backing store already sized to display px).
   Sample-accurate min/max/RMS straight from the AudioBuffer when zoomed in (crisp transients), else the
   peak/RMS cache (aggregated per pixel). topHalf = Premiere-style single-sided for more vertical detail. */
function drawAudioWaveInto(cvs,m,t0,t1,topHalf,vol){
  const x=cvs.getContext('2d'); const W=cvs.width,H=cvs.height; x.clearRect(0,0,W,H); if(t1<=t0||W<1||H<1)return;
  const baseY=topHalf?H-1.5:H/2, amp=(topHalf?H-3:H/2-2), span=t1-t0;
  x.strokeStyle='rgba(255,255,255,0.10)'; x.beginPath(); x.moveTo(0,baseY+.5); x.lineTo(W,baseY+.5); x.stroke();
  const buf=m.buffer, ch=buf&&buf.getChannelData(0), sr=buf?buf.sampleRate:48000;
  const peaks=m.peaks||[], rms=m.rms||peaks, N=peaks.length, res=N/Math.max(1e-3,(m.dur||1));
  const useBuf=!!ch && span*sr < 4000000; // sample-accurate when the visible window is small enough
  const draw=(px,val,fill)=>{ x.fillStyle=fill; const a=Math.min(1,val*vol); const bh=Math.max(0.4,a*amp); if(topHalf)x.fillRect(px,baseY-bh,1,bh); else x.fillRect(px,baseY-bh,1,bh*2); };
  for(let pass=0;pass<2;pass++){ const fill=pass?'rgba(206,210,216,0.96)':'rgba(138,145,153,0.34)', boost=pass?1.7:1.0;
    for(let px=0;px<W;px++){ const a0=t0+(px/W)*span, a1=t0+((px+1)/W)*span; let val=0;
      if(useBuf){ let s=Math.max(0,(a0*sr)|0), e=Math.min(ch.length,Math.ceil(a1*sr)); if(e<=s)e=Math.min(ch.length,s+1);
        if(pass){ let ss=0; for(let j=s;j<e;j++){ const v=ch[j]; ss+=v*v; } val=Math.sqrt(ss/Math.max(1,e-s)); }
        else { let mx=0; for(let j=s;j<e;j++){ const v=ch[j]<0?-ch[j]:ch[j]; if(v>mx)mx=v; } val=mx; } }
      else { let i0=Math.max(0,Math.floor(a0*res)), i1=Math.min(N-1,Math.floor(a1*res)); if(i1<i0)i1=i0;
        if(pass){ let ss=0,cn=0; for(let i=i0;i<=i1;i++){ ss+=rms[i]*rms[i]; cn++; } val=Math.sqrt(ss/Math.max(1,cn)); }
        else { let mx=0; for(let i=i0;i<=i1;i++){ if(peaks[i]>mx)mx=peaks[i]; } val=mx; } }
      draw(px,val*boost,fill); } } }
let _waveRaf=0;
/* per audio clip: render ONLY the visible slice at screen resolution (re-run on scroll/zoom) → crisp at any zoom */
function redrawAudioWaves(){ const sc=$('#tlscroll'); if(!sc)return; const pps=state.tl.pxPerSec, vx0=sc.scrollLeft, vx1=vx0+sc.clientWidth, top=!!state.tl.waveTopHalf, dpr=Math.min(window.devicePixelRatio||1,2);
  for(const cd of $$('.clip.audioclip')){ const c=clipById(+cd.dataset.clip); if(!c)continue; const m=mediaById(c.mediaId); if(!m||!m.peaks)continue;
    const clipX0=c.start*pps, clipX1=(c.start+c.dur)*pps, vX0=Math.max(clipX0,vx0-40), vX1=Math.min(clipX1,vx1+40);
    let cvs=cd.querySelector('canvas.awave');
    if(vX1<=vX0){ if(cvs)cvs.style.display='none'; continue; }
    if(!cvs){ cvs=document.createElement('canvas'); cvs.className='awave'; cvs.style.cssText='position:absolute;top:0;height:100%;pointer-events:none;z-index:1;'; cd.insertBefore(cvs, cd.querySelector('.scrim')); }
    cvs.style.display=''; const LH=cd.clientHeight||48, pxW=Math.max(1,Math.round(vX1-vX0));
    cvs.style.left=(vX0-clipX0)+'px'; cvs.style.width=pxW+'px'; cvs.width=Math.max(1,Math.round(pxW*dpr)); cvs.height=Math.max(1,Math.round(LH*dpr));
    const inP=c.inP||0, t0=inP+(vX0-clipX0)/pps, t1=inP+(vX1-clipX0)/pps, vol=Math.max(0,(c.props&&c.props.volume!=null?c.props.volume/100:1));
    drawAudioWaveInto(cvs,m,t0,t1,top,vol); } }
function scheduleWaves(){ if(_waveRaf)return; _waveRaf=requestAnimationFrame(()=>{ _waveRaf=0; redrawAudioWaves(); }); }
function renderTimeline(){ reconcileVinst(); // free private decoders of clips that were deleted
  migrateArAuto(); // [R93] legacy per-clip Audio-React lanes → unified track lanes (idempotent, no-op when clean)
  const tracks=$('#tracks'), heads=$('#laneHeaders'); const pps=state.tl.pxPerSec; const dur=Math.max(12,neededSec()); state.tl._w=dur; const W=dur*pps;
  // ruler
  $('#ruler').style.width=W+'px'; drawRuler(); // ruler canvas is windowed to the viewport (full-width overflowed the canvas size limit at high zoom → white-out)
  // adaptive grid lines drawn on the tracks background (period scrolls with the content, frames/timecode aware)
  { const g=gridSec(), gp=g*pps; let majMul; if(state.tl.tcMode==='bars'){ const barLen=(60/state.tl.bpm)*state.tl.sig; majMul=Math.max(1,Math.round(barLen/g)); } else { majMul=g<1?Math.max(1,Math.round(1/g)):5; }
    const gpMaj=gp*majMul; const layers=[`repeating-linear-gradient(90deg, rgba(255,255,255,0.075) 0 1px, transparent 1px ${gpMaj.toFixed(2)}px)`];
    if(gp>=6) layers.push(`repeating-linear-gradient(90deg, rgba(255,255,255,0.03) 0 1px, transparent 1px ${gp.toFixed(2)}px)`);
    tracks.style.backgroundImage=layers.join(','); tracks.style.backgroundPosition='0 0'; tracks.style.backgroundRepeat='repeat'; tracks.style.width=W+'px'; } // explicit width so the grid background spans the whole content, not just the viewport
  const grl=$('#gridReadout'); if(grl)grl.textContent=(state.tl.gridFixed?'▦ ':'◇ ')+gridLabel();
  // lanes
  tracks.innerHTML=''; heads.innerHTML='';
  // [R92-T9] Premiere-style: audio lives in a PINNED module at the bottom. Its rows go in #audioZone (a sticky child
  // of #tracks → still matched by "#tracks .lane" so hit-testing/waves are unchanged) and its headers in the
  // sticky #audioHeadZone. Video scrolls behind. The AUDIO bar on top of the module is the collapse toggle (R110).
  const audioHeads=$('#audioHeadZone'); if(audioHeads)audioHeads.innerHTML='';
  const audioZone=document.createElement('div'); audioZone.className='audiozone'; audioZone.style.width=W+'px';
  const _order=lanesTopDown(); let _hasAudio=false, _hasVideo=false;
  for(const li of _order){
    const lane=state.lanes[li]; const LH=laneH(li); const collapsed=!!lane.collapsed;
    const _isAud=lane.kind==='audio'; const rowT=_isAud?audioZone:tracks; const hdrT=_isAud?(audioHeads||heads):heads;
    if(!_isAud&&!_hasVideo){ _hasVideo=true; } // [R110b] VIDEO label goes in the existing ruler-pad corner (set after the loop) — NOT a separate band
    if(_isAud&&!_hasAudio){ _hasAudio=true; // [R110] the AUDIO bar tops the module and TOGGLES its collapse (no longer a drag-resize grip; the module is auto-sized to its tracks)
      const _col=!!state.tl.audioCollapsed; const _chev='<span class="dvchev">'+(_col?'▸':'▾')+'</span>';
      const toggle=()=>{ state.tl.audioCollapsed=!state.tl.audioCollapsed; renderTimeline(); markDirty(); };
      const dvR=document.createElement('div'); dvR.className='trackdivider collapsible'; dvR.style.width=W+'px'; dvR.addEventListener('click',toggle); audioZone.appendChild(dvR);
      if(audioHeads){ const dvH=document.createElement('div'); dvH.className='trackdivider hdr collapsible'; dvH.innerHTML=_chev+'<span class="dvlab">'+T('Audio','Audio')+'</span>'; dvH.addEventListener('click',toggle); audioHeads.appendChild(dvH); } }
    if(_isAud&&state.tl.audioCollapsed)continue; // [R110] collapsed: only the bar shows, audio rows hidden
    const row=document.createElement('div'); row.className='lane'+(collapsed?' collapsed':''); row.style.height=LH+'px'; row.style.width=W+'px'; row.dataset.lane=li;
    for(const c of state.clips.filter(c=>c.lane===li)){
      const m=mediaById(c.mediaId); const cd=document.createElement('div'); cd.className='clip'+(state.selIds.includes(c.id)?' sel':'')+((c.groupId!=null&&c.groupId===state.selGroupId)?' gsel':'')+((!m||(m.missing&&!m._loading))?' offline':''); cd.dataset.clip=c.id; // [M4] media deleted/missing → red offline clip
      if(c.disabled)cd.classList.add('off'); // [R102·D-T2] Ableton "0": ni se renderiza ni suena. Antes se decía SOLO con opacidad+desaturación — es decir, sólo con color. Ahora lleva además una trama diagonal: "Avoid using color as the only way of communicating status" (HIG de Blender), y Resolve hace lo mismo ("A slash indicates when a track is disabled"). Importa para daltonismo y para poder leerlo de un vistazo entre 30 clips.
      else if(lane.mute)cd.classList.add('muted'); // [T5] pista silenciada → clip a opacidad ALTA (sigue claramente visible, no se oculta) + chapa de mute. Es un estado más suave que 'disabled' (.off), que gana si el clip además está deshabilitado.
      cd.style.left=(c.start*pps)+'px'; cd.style.width=Math.max(14,c.dur*pps)+'px'; cd.style.height=(LH-8)+'px';
      let kf=''; if(c.kf){const ts=new Set();for(const p in c.kf)for(const k of c.kf[p])ts.add(Math.round(k.t*1000)/1000);
        if(c.id===state.selId)kf='<div class="kfstrip">'+[...ts].map(t=>`<div class="kfd" data-t="${t}" title="${T('Keyframe','Fotograma clave')} · ${fmtTime(c.start+t)}" style="left:${t*pps}px"></div>`).join('')+'</div>';
        else if(ts.size)kf='<div class="kfstrip dim">'+[...ts].map(t=>`<div class="kfd" style="left:${t*pps}px"></div>`).join('')+'</div>';} // [R92-T4] passive hint: un-selected clips reveal they carry automation (dimmed diamonds, no handlers)
      let fades=''; const fiPx=(c.fadeIn||0)*pps, foPx=(c.fadeOut||0)*pps;
      if(c.fadeIn>0){const w=Math.min(c.fadeIn/c.dur*100,100);fades+=`<div style="position:absolute;left:0;top:0;bottom:0;width:${w}%;background:linear-gradient(90deg,rgba(0,0,0,0.6),transparent);pointer-events:none;"></div>`;}
      if(c.fadeOut>0){const w=Math.min(c.fadeOut/c.dur*100,100);fades+=`<div style="position:absolute;right:0;top:0;bottom:0;width:${w}%;background:linear-gradient(270deg,rgba(0,0,0,0.6),transparent);pointer-events:none;"></div>`;}
      // [7] fade drawn as the real opacity-envelope curve over the clip (rises over fade-in, falls over fade-out), with draggable corner handles
      if(c.fadeIn>0||c.fadeOut>0){ const cW=Math.max(14,c.dur*pps), cH=Math.max(8,(LH-8)), topY=2.5, botY=cH-2.5;
        const x1=Math.max(0,Math.min(fiPx,cW)), x2=Math.max(x1,cW-foPx);
        fades+=`<svg class="fadeenv" width="${cW}" height="${cH}" viewBox="0 0 ${cW} ${cH}" preserveAspectRatio="none"><polyline points="0,${c.fadeIn>0?botY:topY} ${x1.toFixed(1)},${topY} ${x2.toFixed(1)},${topY} ${cW},${c.fadeOut>0?botY:topY}"/></svg>`; }
      const isAud=!!(m&&m.kind==='audio'); const fillBg=c.adjust?'repeating-linear-gradient(45deg,rgba(180,186,193,0.30) 0 9px,rgba(180,186,193,0.10) 9px 18px)':'none'; // [R94b] the stretched-thumbnail fill is gone — Premiere-style HEAD THUMBNAIL instead (below)
      let cth=''; if(m&&m.thumb&&!isAud&&!collapsed){ const th=Math.max(8,LH-8-15), tw=Math.round(th*16/9); if(Math.max(14,c.dur*pps)>=tw+24) cth=`<div class="cthumb" style="width:${tw}px;background-image:url(${m.thumb})"></div>`; } // Premiere-style head thumbnail, pinned to the clip's own left edge; hidden in automation mode
      let px2=''; if(m&&m.kind==='video'){ const rdy=!!m.proxyReady,pct=m.proxyPct||0; px2='<div class="cpx" data-mid="'+c.mediaId+'">'+(rdy?'⚡ PROXY':(pct>0?'PROXY '+pct+'%':'ORIGINAL'))+'</div><div class="cpxbar" data-mid="'+c.mediaId+'" style="'+((rdy||pct<=0)?'display:none;':'')+'"><i style="width:'+pct+'%"></i></div>'; }
      const animBadge=hasLiveAnim(c)?`<div class="animbadge" title="${T('Live motion','Movimiento activo')}" style="position:absolute;top:3px;right:5px;width:15px;height:15px;border-radius:50%;background:var(--ink-2);color:#0b0d10;font-size:11px;line-height:15px;text-align:center;pointer-events:none;font-weight:700;z-index:3;">↻</div>`:'';
      const mutedBadge=(lane.mute&&!c.disabled)?`<div class="mutebadge" title="${T('Track muted','Pista silenciada')}">${ICO('mute',11)}</div>`:''; // [T5] chapa de mute (signo de forma, no de color → daltonismo)
      let loopMarks=''; const lcyc=loopCycleSec(c); // R81: subtle boundary ticks + a ↻ badge at each loop repeat
      if(lcyc>0.02){ for(let k=1;k*lcyc<c.dur-1e-3;k++){ const lx=k*lcyc*pps; loopMarks+=`<div style="position:absolute;left:${lx}px;top:0;bottom:0;width:1px;background:repeating-linear-gradient(180deg,rgba(255,255,255,0.55) 0 3px,transparent 3px 6px);pointer-events:none;z-index:2;"></div><div style="position:absolute;left:${lx+2}px;bottom:2px;font-size:11px;line-height:1;color:rgba(255,255,255,0.55);pointer-events:none;z-index:2;">↻</div>`; } }
      const _ct=clipTint(c,m); cd.innerHTML=`<div class="fill" style="background-image:${fillBg};background-color:${_ct}"></div><div class="scrim"></div>${cth}${fades}${loopMarks}<div class="tt" style="background:${_ct};color:${textOn(_ct)}">${c.loop?'↻ ':''}${c.name}</div>${px2}${animBadge}${mutedBadge}<div class="hd l"></div><div class="hd r"></div><div class="fadeh fadeL" style="left:${fiPx}px"></div><div class="fadeh fadeR" style="right:${foPx}px"></div>${kf}`; // R84c: clips use their OWN colour (lane colour tints only the header)
      cd.tabIndex=0; cd.setAttribute('aria-label',c.name||T('Clip','Clip')); // [R94-UT5·U-10b] Tab reaches every clip; Enter/Space selects (keydown delegated on #tracks)
      row.appendChild(cd);
      // drag-and-drop a Motion chip onto a clip to animate it
      cd.addEventListener('dragover',e=>{ if([...e.dataTransfer.types].includes('text/dsp-anim')){ e.preventDefault(); cd.style.outline='2px solid #C9CDD3'; cd.style.outlineOffset='-2px'; } });
      cd.addEventListener('dragleave',()=>{ cd.style.outline=''; });
      cd.addEventListener('drop',e=>{ let k=''; try{k=e.dataTransfer.getData('text/dsp-anim');}catch(_){ } if(!k)return; e.preventDefault(); cd.style.outline=''; pushUndo(); addAnimPreset(c,k); state.selId=c.id; state.selIds=[c.id]; renderInspector(); renderTimeline(); render(); startMotionPreview(); markDirty(); flashStatus(T('Motion added','Movimiento añadido')); });
      if(isAud) cd.classList.add('audioclip'); // waveform drawn (visible-window, sample-accurate) by redrawAudioWaves()
      attachClipAuto(cd,c,li); // automation envelope drawn on every (video) clip while automation mode is on
    }
    // crossfade indicators (Ableton-style X) where two clips on this lane overlap
    const laneClips=state.clips.filter(c=>c.lane===li).sort((a,b)=>a.start-b.start);
    for(let i=0;i<laneClips.length-1;i++){ const a=laneClips[i],b=laneClips[i+1]; const ovS=b.start, ovE=Math.min(a.start+a.dur,b.start+b.dur);
      if(ovE>ovS+1e-4){ const xf=document.createElement('div'); xf.className='xfade'; xf.style.left=(ovS*pps)+'px'; xf.style.width=((ovE-ovS)*pps)+'px'; row.appendChild(xf); } }
    rowT.appendChild(row);
    const hd=document.createElement('div'); hd.className='lanehdr'+(state.selLane===li?' sel':'')+(collapsed?' collapsed':'')+(_isAud?' aud':''); hd.style.height=LH+'px'; hd.dataset.lane=li; if(lane.color)hd.style.background=hexA(lane.color,state.selLane===li?0.34:0.16); // tint the whole header rectangle; brighter when selected (+ the .sel inset outline gives contrast over any colour)
    hd.innerHTML=`<span class="bar" style="background:${lane.color||TRACK_COLORS[li%TRACK_COLORS.length]}"></span>
      <button class="lcol" data-m="collapse" title="${collapsed?T('Expand track','Expandir pista'):T('Collapse track','Contraer pista')}"><span style="display:inline-flex;transform:rotate(${collapsed?-90:0}deg);">${ICO('chevDown',11)}</span></button>
      <span class="tag"${lane.color?' style="color:'+lane.color+'"':''}>${lane.tag}</span><span class="nm"${lane.color?' style="color:'+lane.color+'"':''}>${lane.name}</span>
      <button class="ms ${lane.mute?'on':''}" data-m="mute">M</button><button class="ms solo ${lane.solo?'on':''}" data-m="solo">S</button>
      <div class="laneres" data-m="resize" title="${T('Drag to resize track','Arrastra para redimensionar la pista')}"></div>`;
    hd.onclick=ev=>{ if(_laneJustDragged||ev.target.isContentEditable||ev.target.closest('[data-m]'))return; clearMediaSel(); state.selLane=li;
      state.selId=null; state.selIds=[]; state.selGroupId=null; renderInspector(); updStatus(); renderTimeline(); }; // [R93] selecting a TRACK deselects the clip (they were simultaneous → Ctrl+D was ambiguous)
    hd.tabIndex=0; hd.setAttribute('aria-label',lane.name); // [R94-UT5·U-10b] Tab reaches the track header; Enter/Space = same selection as a click
    hd.addEventListener('keydown',ev=>{ if(ev.target!==hd||!hd.matches(':focus-visible'))return; if(ev.key==='Enter'||ev.code==='Space'){ ev.preventDefault(); ev.stopPropagation(); hd.onclick(ev); } }); // :focus-visible → only KEYBOARD focus consumes Enter/Space (a mouse click leaves Space = play)
    hd.addEventListener('pointerdown',ev=>{ if(ev.button!==0)return; if(ev.target.closest('[data-m]')||ev.target.closest('button')||ev.target.isContentEditable)return; startLaneDrag(ev,li); }); // drag the header to reorder tracks
    hd.ondblclick=ev=>{ if(ev.target.isContentEditable||ev.target.closest('[data-m]'))return; renameLane(li); };
    hd.querySelector('[data-m=mute]').onclick=()=>{pushUndo();lane.mute=!lane.mute;renderTimeline();render();reschedAudio();};
    hd.querySelector('[data-m=solo]').onclick=()=>{pushUndo();lane.solo=!lane.solo;renderTimeline();render();reschedAudio();};
    hd.querySelector('[data-m=collapse]').onclick=ev=>{ev.stopPropagation();pushUndo();lane.collapsed=!lane.collapsed;renderTimeline();};
    if(!_isAud){ const rz=hd.querySelector('[data-m=resize]'); rz.addEventListener('pointerdown',ev=>{ ev.preventDefault(); ev.stopPropagation(); pushUndo(); if(lane.collapsed)lane.collapsed=false; const h0=laneH(li),y0=ev.clientY;
      const mv=e2=>{ lane.h=Math.max(LANE_MIN_H,Math.min(LANE_MAX_H,h0+(e2.clientY-y0))); scheduleTimeline(); };
      const up=()=>{ window.removeEventListener('pointermove',mv); window.removeEventListener('pointerup',up); renderTimeline(); }; window.addEventListener('pointermove',mv); window.addEventListener('pointerup',up); }); } // [R110] audio tracks are fixed-height → no per-lane resize
    hd.oncontextmenu=ev=>{ev.preventDefault();openMenu(ev.clientX,ev.clientY,[{label:T('Rename track','Cambiar nombre de pista'),key:'⌘R',fn:()=>renameLane(li)},{label:T('Set track color…','Elegir color de pista…'),fn:()=>openLaneColorPopup(li,ev.clientX,ev.clientY)},...trackCreateItems(lane.kind),{label:T('Duplicate track','Duplicar pista'),fn:()=>duplicateLane(li)},'sep',{label:T('Delete track','Eliminar pista'),danger:true,fn:()=>removeLane(li)}]);};
    // [R93] Ableton: automation mode puts the device+parameter choosers INSIDE the track header rectangle (primary overlay param)
    if(state.inlineCurves&&!_isAud&&!collapsed&&LH>=52){ const P=laneAutoP(lane,li);
      const ac=document.createElement('div'); ac.className='autoctl'; // [R94b] just the two choosers + '+' (swatch and A/↻ removed per request — override lives in the inspector)
      ac.style.setProperty('--pc',autoColor(P)); // [R95·E1] side bar in the parameter's hue
      const _sc=selClip(); const _foc=!!(_sc&&_sc.lane===li);
      const _pick=np=>{ lane._autoP=np; renderTimeline(); markDirty(); };
      ac.appendChild(_foc?autoDuo(li,P,_pick):autoDuoText(li,P,_pick)); // [A5] ONE automation at a time — the chooser swaps which param's curve overlays the clips; no more stacked sub-lanes / '+' add-lane button
      hd.appendChild(ac); }
    hdrT.appendChild(hd);
    // [R143] appendAutoLanes (sub-carriles apilados) archivado — el modelo vigente es la sola superposición por pista (attachClipAuto)
  }
  if(_hasAudio)tracks.appendChild(audioZone); // [R92-T9] pin the audio module at the bottom (sticky) — appended last, after all video rows
  if(_hasAudio){ // [R110] the module is EXACTLY as tall as its tracks (auto height, no drag-resize, no internal scroll); the AUDIO bar collapses it
    audioZone.style.height='auto'; audioZone.style.overflowY='visible';
    if(audioHeads){ audioHeads.style.height='auto'; audioHeads.style.overflowY='visible'; }
    { const sc=$('#tlscroll'); audioZone.classList.toggle('covers', !!sc&&sc.scrollHeight>sc.clientHeight+1); } } // [R94-UT2·U-01] top shadow on the module signals video rows are hidden behind it
  if(audioHeads)audioHeads.style.display=_hasAudio?'':'none';
  { const rp=$('#trackHdr .rulerpad'); if(rp)rp.innerHTML=_hasVideo?'<span class="dvlab">'+T('Video','Vídeo')+'</span>':''; } // [R110b] VIDEO label lives in the ruler-pad corner (the empty space above the track headers), matching the AUDIO bar's label style
  // [R94f] the empty-timeline hint was removed per request (no in-canvas instructions — the Media panel's drop-zone already says it)
  // (no "+ track" buttons — create a track via Ctrl+T or right-click → Create track)
  // marker dashed lines across tracks
  for(const mk of state.markers){ const ln=document.createElement('div'); ln.style.cssText=`position:absolute;top:0;bottom:0;left:${mk.time*pps}px;width:0;border-left:1px dashed ${mk.color||'#B4BAC1'};opacity:.5;pointer-events:none;z-index:5;`; tracks.appendChild(ln); }
  { const _trH=(tracks.offsetHeight||0); const ph=$('#playhead'); if(ph)ph.style.height=_trH+'px'; const sl=$('#snapline'); if(sl)sl.style.height=(22+_trH)+'px'; } // [R94f] the playhead line spans EVERY track but stops at the ruler (its head caps it there); the snap line still spans ruler + tracks
  // [R101] #tlscroll gives up `hsb` px to its horizontal scrollbar; the header column has no scrollbar, so its
  // client height was `hsb` TALLER — which means it could not scroll as far (max scrollTop = content − client).
  // Over the last hsb px of scroll the header column ran out of travel while the tracks kept going, so every
  // track name drifted out of line with its row and slid out from behind the pinned audio module. Giving the
  // header column the same bottom gutter makes both columns identical in height, travel and pinning — so the
  // sticky module now lands at bottom:0 in both and nothing has to be compensated after the fact.
  { const sc=$('#tlscroll'), th=$('#trackHdr'); const hsb=Math.max(0,(sc.offsetHeight||0)-(sc.clientHeight||0));
    if(th && th.style.marginBottom!==hsb+'px'){ th.style.marginBottom=hsb+'px'; th.scrollTop=sc.scrollTop; } }
  positionPlayhead(); const dt=$('#durTc'); if(dt)dt.textContent=TC(duration());
  renderWork(); renderClipExtent(); renderTimeSel(); applyToolCursor(); updEnable(); redrawAudioWaves(); // draw the visible slice of every audio waveform at screen resolution
  renderZoomBar(); // [T3] keep the custom zoom-scrollbar thumb sized to the current zoom/content
}
/* lanes */
/* [R93] selecting a CLIP deselects the track (mutual exclusion — Ctrl+T/Ctrl+D are contextual). Cheap: also strips the
   header highlight for paths that don't re-render the timeline (the tint alpha settles on the next full render). */
/* [R102·D-T2] Panel con foco → selección PLENA; el resto queda en standby (atenuado). Ableton envía
   `Selection` y `StandbySelection` como colores distintos por esto mismo: con medios, línea de tiempo e
   inspector compitiendo, si todo lo seleccionado se ve igual, el usuario no sabe sobre qué actúa el teclado.
   Se marca en pointerdown en fase de captura: así se pinta ANTES de que el clic cambie la selección, y ningún
   handler puede tragárselo con stopPropagation. */
function setFocusPane(p){ if(state._fp===p)return; state._fp=p;
  document.body.classList.remove('fp-media','fp-timeline','fp-inspector');
  if(p)document.body.classList.add('fp-'+p); }
document.addEventListener('pointerdown',e=>{ const t=e.target;
  if(t.closest&&t.closest('.timeline'))setFocusPane('timeline');
  else if(t.closest&&t.closest('#mediaPane'))setFocusPane('media');
  else if(t.closest&&t.closest('#insCtl,#inspector'))setFocusPane('inspector'); },true);
setFocusPane('timeline'); // el trabajo empieza en la línea de tiempo
function laneDesel(){ if(state.selLane==null)return; state.selLane=null; $$('#trackHdr .lanehdr.sel').forEach(h=>h.classList.remove('sel')); }
/* [R94-UT2·U-01] auto-scroll #tlscroll so a clip selected by a user gesture is not hidden behind the pinned
   audio module (or plain vertical overflow). Called ONLY from explicit selection gestures — never from renderTimeline. */
function ensureClipVisible(c){ if(!c)return; const sc=$('#tlscroll'); if(!sc)return;
  const row=document.querySelector('#tracks .lane[data-lane="'+c.lane+'"]'); if(!row)return;
  if(row.closest('.audiozone'))return; // audio rows scroll inside the pinned module — it manages its own reveal
  const az=document.querySelector('#tracks .audiozone');
  const scR=sc.getBoundingClientRect(), rr=row.getBoundingClientRect();
  const topLim=scR.top+22; // 22 = sticky ruler height
  const botLim=az?Math.min(az.getBoundingClientRect().top,scR.top+sc.clientHeight):(scR.top+sc.clientHeight); // the pinned audio module eats the bottom of the viewport
  let dy=0;
  if(rr.top<topLim) dy=rr.top-topLim;
  else if(rr.bottom>botLim) dy=Math.min(rr.bottom-botLim, rr.top-topLim); // never push the row's top above the ruler
  if(Math.abs(dy)>0.5) sc.scrollTop+=dy; }
function addLane(kind){ pushUndo(); const n=state.lanes.filter(l=>l.kind===kind).length+1; const nl={id:uid(),name:(kind==='audio'?'Audio ':'Video ')+n,tag:(kind==='audio'?'A':'V')+n,kind};
  if(kind==='audio'){ let at=state.lanes.findIndex(l=>l.kind==='audio'); if(at<0)at=state.lanes.length; // [R93b] audio grows DOWNWARD: the module displays audio lanes index-descending → the bottom slot is the smallest audio index
    state.lanes.splice(at,0,nl); for(const c of state.clips)if(c.lane>=at)c.lane++; if(state.selLane!=null&&state.selLane>=at)state.selLane++; }
  else state.lanes.push(nl); // video grows upward (new track on top), as before
  renderTimeline();
  if(kind==='audio'){ const az=document.querySelector('#tracks .audiozone'); if(az){ az.scrollTop=az.scrollHeight; state.tl._audioScroll=az.scrollTop; const ah=$('#audioHeadZone'); if(ah)ah.scrollTop=az.scrollTop; } } // reveal the new bottom track (the module keeps its height and scrolls)
  flashStatus(T('Track added','Pista añadida')); }
/* menu items for creating a track (Ctrl+T or right-click) — no toolbar button per request */
function trackCreateItems(kind){ const it=[]; // [R110b] filter by the clicked track's kind: on a video track don't offer "create audio" (and vice versa); empty areas (no kind) offer both
  if(kind!=='audio') it.push({label:T('Create video track','Crear pista de vídeo'),key:'⌘T',ico:'plus',fn:()=>addLane('video')});
  if(kind!=='video') it.push({label:T('Create audio track','Crear pista de audio'),ico:'plus',fn:()=>addLane('audio')});
  return it; }
function removeLane(li){ const lane=state.lanes[li]; if(!lane)return; const has=state.clips.some(c=>c.lane===li);
  if(lane.kind==='audio'&&state.lanes.filter(l=>l.kind==='audio').length<=1){ flashStatus(T('Keep at least one audio track','Mantén al menos una pista de audio')); return; } // [R92-T9] the audio module is always present
  if(lane.kind!=='audio'&&state.lanes.filter(l=>l.kind!=='audio').length<=1){ flashStatus(T('Keep at least one video track','Mantén al menos una pista de vídeo')); return; }
  const doIt=()=>{ pushUndo(); state.clips=state.clips.filter(c=>c.lane!==li); for(const c of state.clips)if(c.lane>li)c.lane--; state.lanes.splice(li,1); if(state.selLane===li)state.selLane=null; renderTimeline();renderInspector();render();updStatus(); };
  if(has) appConfirm(T('This track has clips. Delete it with its clips?','Esta pista contiene clips. ¿Eliminarla junto con sus clips?'), ok=>{ if(ok)doIt(); }, {ok:T('Delete','Eliminar'),danger:true}); else doIt(); }
/* Electron disables window.prompt() → custom in-app prompt modal (works in the packaged .exe). */
function appPrompt(message,def,cb){ try{closeMenu();}catch(e){}
  const ov=document.createElement('div'); ov.className='overlay'; ov.style.alignItems='flex-start'; ov.id='promptOv';
  ov.innerHTML='<div class="modal" style="width:360px;margin-top:120px;padding:14px 16px;"><div style="font-size:13px;color:var(--ink-2);margin-bottom:9px;">'+message+'</div><input id="apIn" type="text" spellcheck="false" style="width:100%;height:30px;box-sizing:border-box;background:var(--s0);border:.5px solid rgba(255,255,255,0.14);border-radius:2px;color:var(--ink);font-family:inherit;font-size:13px;padding:0 9px;outline:none;"><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:13px;"><button id="apCancel" class="togbtn2">'+T('Cancel','Cancelar')+'</button><button id="apOk" class="togbtn2 on">'+T('OK','Aceptar')+'</button></div></div>';
  document.body.appendChild(ov); const inp=ov.querySelector('#apIn'); inp.value=(def!=null?def:''); setTimeout(()=>{try{inp.focus();inp.select();}catch(e){}},10);
  let done=false; const fin=v=>{ if(done)return; done=true; ov.remove(); if(cb)cb(v); };
  ov.querySelector('#apOk').onclick=()=>fin(inp.value); ov.querySelector('#apCancel').onclick=()=>fin(null);
  inp.addEventListener('keydown',e=>{ e.stopPropagation(); if(e.key==='Enter'){e.preventDefault();fin(inp.value);} else if(e.key==='Escape'){e.preventDefault();fin(null);} });
  ov.addEventListener('pointerdown',e=>{ if(e.target===ov)fin(null); }); }
/* ===== Styled in-app dialogs (match the app aesthetic, replace native confirm/alert) ===== */
function appConfirm(message,cb,opts){ opts=opts||{}; try{closeMenu();}catch(e){}
  const ov=document.createElement('div'); ov.className='overlay'; ov.id='confirmOv';
  ov.innerHTML='<div class="modal" style="width:390px;padding:16px 18px;"><div style="font-size:13px;color:var(--ink-2);line-height:1.5;margin-bottom:15px;">'+message+'</div><div style="display:flex;gap:8px;justify-content:flex-end;"><button id="cfCancel" class="togbtn2">'+(opts.cancel||T('Cancel','Cancelar'))+'</button><button id="cfOk" class="togbtn2 on"'+(opts.danger?' style="background:#33383F;border-color:rgba(255,255,255,0.2);color:#fff;"':'')+'>'+(opts.ok||T('OK','Aceptar'))+'</button></div></div>';
  document.body.appendChild(ov); let done=false; const fin=v=>{ if(done)return; done=true; document.removeEventListener('keydown',onk,true); ov.remove(); if(cb)cb(v); };
  ov.querySelector('#cfOk').onclick=()=>fin(true); ov.querySelector('#cfCancel').onclick=()=>fin(false); ov.addEventListener('pointerdown',e=>{ if(e.target===ov)fin(false); });
  const onk=e=>{ e.stopPropagation(); if(e.key==='Escape'){e.preventDefault();fin(false);} else if(e.key==='Enter'){e.preventDefault();fin(true);} }; document.addEventListener('keydown',onk,true);
  setTimeout(()=>{try{ov.querySelector('#cfOk').focus();}catch(e){}},10); }
function appAlert(message,cb){ try{closeMenu();}catch(e){}
  const ov=document.createElement('div'); ov.className='overlay'; ov.style.alignItems='flex-start'; ov.id='alertOv';
  ov.innerHTML='<div class="modal" style="width:390px;margin-top:130px;padding:16px 18px;"><div style="font-size:13px;color:var(--ink-2);line-height:1.5;margin-bottom:15px;">'+message+'</div><div style="display:flex;justify-content:flex-end;"><button id="alOk" class="togbtn2 on">'+T('OK','Aceptar')+'</button></div></div>';
  document.body.appendChild(ov); let done=false; const fin=()=>{ if(done)return; done=true; document.removeEventListener('keydown',onk,true); ov.remove(); if(cb)cb(); };
  ov.querySelector('#alOk').onclick=fin; ov.addEventListener('pointerdown',e=>{ if(e.target===ov)fin(); });
  const onk=e=>{ e.stopPropagation(); if(e.key==='Escape'||e.key==='Enter'){e.preventDefault();fin();} }; document.addEventListener('keydown',onk,true);
  setTimeout(()=>{try{ov.querySelector('#alOk').focus();}catch(e){}},10); }

/* ===== Recent projects + Start screen (landing) ===== */
const LOGO_SVG='<svg viewBox="0 0 1024 1024" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="1024" height="1024" rx="236" fill="#14171C"/><g fill="none" stroke="#fff"><rect x="197" y="197" width="630" height="630" rx="206" stroke-width="80"/><rect x="335" y="335" width="354" height="354" rx="130" stroke-width="76"/><rect x="442" y="442" width="140" height="140" rx="56" stroke-width="60"/></g></svg>';
/* [U9] animated logo loop — 75 square PNG frames in assets/frames logo/. Preloaded, then cycled on an <img>. */
const LOGO_FRAMES=75;
function logoFramePath(i){ return 'assets/frames%20logo/frame_'+String(i).padStart(3,'0')+'.png'; }
let _logoImgs=null;
function preloadLogoFrames(){ if(_logoImgs)return _logoImgs; _logoImgs=[]; for(let i=0;i<LOGO_FRAMES;i++){ const im=new Image(); im.src=logoFramePath(i); _logoImgs.push(im); } return _logoImgs; }
function startLogoLoop(imgEl,fps,onLoop){ if(!imgEl)return ()=>{}; preloadLogoFrames(); fps=fps||26; let i=0,raf=0,last=0;
  imgEl.src=logoFramePath(0);
  const step=t=>{ if(!last)last=t; if(t-last>=1000/fps){ i=(i+1)%LOGO_FRAMES; if(i===0&&onLoop)onLoop(); imgEl.src=logoFramePath(i); last=t; } raf=requestAnimationFrame(step); }; // [R134] onLoop fires each time the loop wraps
  raf=requestAnimationFrame(step); return ()=>{ if(raf)cancelAnimationFrame(raf); raf=0; }; }
/* [R134] branded square splash: the logo loop plays in a small square window for `minLoops` cycles, then reveals. */
function showSplash(minLoops,onReady){ if(document.getElementById('splashOv')){ if(onReady)onReady(); return; }
  const ov=document.createElement('div'); ov.className='overlay'; ov.id='splashOv'; ov.style.background='#0E0F11'; ov.style.zIndex='360';
  ov.innerHTML=`<div class="splashcard"><img class="splashlogo" width="128" height="128" alt="Immersive Studio Pro"><div class="splashttl">Immersive Studio Pro</div></div>`;
  document.body.appendChild(ov); let loops=0, done=false;
  const stop=startLogoLoop(ov.querySelector('.splashlogo'),30,()=>{ if(++loops>=minLoops&&!done){ done=true; finish(); } });
  ov._stopLogo=stop;
  function finish(){ stop(); ov.style.transition='opacity .28s'; ov.style.opacity='0'; setTimeout(()=>{ ov.remove(); if(onReady)onReady(); },300); }
  setTimeout(()=>{ if(!done){ done=true; finish(); } }, minLoops*3200+1500); } // safety: never hang if rAF is throttled
function getRecents(){ try{ const a=JSON.parse(localStorage.getItem('domeProRecents')||'[]'); return Array.isArray(a)?a:[]; }catch(e){ return []; } }
function saveRecents(a){ try{ localStorage.setItem('domeProRecents', JSON.stringify(a.slice(0,12))); }catch(e){} }
function projThumb(){ try{ if(!glc.width)return null; const w=200, h=Math.max(1,Math.round(w*glc.height/glc.width)); const c=document.createElement('canvas'); c.width=w; c.height=h; c.getContext('2d').drawImage(glc,0,0,w,h); return c.toDataURL('image/jpeg',0.72); }catch(e){ return null; } }
function addRecent(path,thumb){ if(!path||!IS_ELEC)return; const base=(DSP.basename?DSP.basename(path):(path.split(/[\\/]/).pop()||path)); const name=base.replace(/\.(isp|ise|rdome)$/i,''); const folder=path.replace(/[\\/][^\\/]*$/,''); const prev=getRecents().find(r=>r.path===path); const a=getRecents().filter(r=>r.path!==path); a.unshift({path,name,folder,t:Date.now(),thumb:thumb||(prev&&prev.thumb)||null}); saveRecents(a); }
function relTime(ts){ if(!ts)return ''; const d=(Date.now()-ts)/1000; if(d<60)return T('just now','ahora mismo'); if(d<3600)return Math.floor(d/60)+' min'; if(d<86400)return Math.floor(d/3600)+' h'; if(d<604800)return Math.floor(d/86400)+' d'; try{return new Date(ts).toLocaleDateString();}catch(e){return '';} }
function hideLanding(){ const o=document.getElementById('landingOv'); if(o){ if(o._stopLogo)o._stopLogo(); o.remove(); } }
/* [U9] loading screen with the logo loop — shown while a project opens and its media/proxies buffer */
let _loadingOv=null,_loadingStop=null,_loadingPoll=0,_loadingLoops=0;
const LOADING_MIN_LOOPS=2; // [R134] the logo loop plays at least twice before the project is revealed
function showLoadingScreen(msg){ if(_loadingOv)return; _loadingLoops=0; const ov=document.createElement('div'); ov.id='loadingOv'; ov.className='overlay'; ov.style.background='#0E0F11'; ov.style.zIndex='340';
  ov.innerHTML=`<div class="splashcard"><img class="splashlogo" width="128" height="128" alt=""><div id="ldMsg" class="splashttl">${msg||T('Loading…','Cargando…')}</div></div>`;
  document.body.appendChild(ov); _loadingOv=ov; _loadingStop=startLogoLoop(ov.querySelector('.splashlogo'),30,()=>{ _loadingLoops++; }); }
function setLoadingMsg(m){ if(_loadingOv){ const e=_loadingOv.querySelector('#ldMsg'); if(e)e.textContent=m; } }
function hideLoadingScreen(){ if(_loadingPoll){clearTimeout(_loadingPoll);_loadingPoll=0;} if(_loadingStop){_loadingStop();_loadingStop=null;} if(_loadingOv){_loadingOv.remove();_loadingOv=null;} }
function loadingWaitMedia(deadline){ if(!_loadingOv)return; const anyLoading=state.media.some(m=>m._loading&&!m.missing); const proxying=state.media.some(m=>m._pxGen||(m.proxyPct>0&&!m.proxyReady));
  const loopsDone=_loadingLoops>=LOADING_MIN_LOOPS; // [R134] hold the splash until the loop has run twice AND media/proxies are ready (or the deadline)
  if((!anyLoading&&!proxying&&loopsDone)||Date.now()>deadline){ hideLoadingScreen(); return; }
  setLoadingMsg((anyLoading||proxying)?(proxying?T('Buffering proxies…','Cargando proxys…'):T('Loading media…','Cargando medios…')):T('Loading…','Cargando…'));
  _loadingPoll=setTimeout(()=>loadingWaitMedia(deadline),200); }
function escAttr(s){ return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }
function showLanding(){ if(document.getElementById('landingOv'))return;
  const recents=IS_ELEC?getRecents():[];
  const domeGlyph='<div style="width:38px;height:38px;opacity:0.5;">'+LOGO_SVG+'</div>';
  const card=r=>`<button class="lgcard" data-path="${escAttr(r.path)}" title="${escAttr(r.path)}" style="text-align:left;background:#15181C;border:.5px solid rgba(255,255,255,0.09);border-radius:9px;overflow:hidden;cursor:pointer;padding:0;display:flex;flex-direction:column;transition:border-color .12s;">
      <div style="aspect-ratio:16/10;background:var(--s0) ${r.thumb?`center/cover no-repeat url(${r.thumb})`:''};display:flex;align-items:center;justify-content:center;border-bottom:.5px solid rgba(255,255,255,0.06);">${r.thumb?'':domeGlyph}</div>
      <div style="padding:8px 11px;min-width:0;"><div style="font-size:13px;color:var(--ink);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escAttr(r.name)}</div><div style="font-size:11px;color:var(--ink-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px;">${relTime(r.t)}${r.folder?' · '+escAttr(r.folder.split(/[\\/]/).pop()):''}</div></div></button>`;
  const ov=document.createElement('div'); ov.className='overlay'; ov.id='landingOv'; ov.style.background='#0E0F11'; ov.style.zIndex='300';
  ov.innerHTML=`<div style="width:min(900px,92vw);max-height:88vh;display:flex;flex-direction:column;gap:22px;">
     <div style="display:flex;align-items:center;gap:20px;">
       <img id="lgLogo" width="104" height="104" style="width:104px;height:104px;flex-shrink:0;object-fit:contain;border-radius:22px;" alt="Immersive Studio Pro">
       <div><div style="font-size:25px;font-weight:600;color:var(--ink);letter-spacing:-0.015em;">Immersive Studio Pro</div>
         <div style="font-size:13px;color:var(--ink-3);margin-top:4px;">${T('Dome · 2D · 360 room','Domo · 2D · sala 360')} · <b style="color:var(--ink-2);font-weight:500;">Version 1.0</b></div></div>
     </div>
     <div style="display:flex;gap:12px;flex-wrap:wrap;">
       <button id="lgNew" class="mbtn pri" style="height:40px;padding:0 18px;font-size:13px;">${ICO('plus',16)} ${T('New dome project','Nuevo proyecto domo')}</button>
       <button id="lgNew2d" class="mbtn pri" style="height:40px;padding:0 18px;font-size:13px;background:var(--s2);color:var(--ink);">${ICO('plus',16)} ${T('New 2D project','Nuevo proyecto 2D')}</button>
       <button id="lgNewRoom" class="mbtn pri" style="height:40px;padding:0 18px;font-size:13px;background:var(--s2);color:var(--ink);">${ICO('plus',16)} ${T('New 360 room','Nueva sala 360')}</button>
       <button id="lgOpen" class="mbtn" style="height:40px;padding:0 16px;font-size:13px;">${ICO('folder',15)} ${T('Open project…','Abrir proyecto…')}</button>
     </div>
     <div style="display:flex;flex-direction:column;min-height:0;">
       <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.09em;color:var(--ink-dim);margin-bottom:11px;">${T('Recent','Recientes')}</div>
       <div id="lgRecents" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(188px,1fr));gap:12px;overflow-y:auto;padding-right:4px;">
         ${recents.length? recents.map(card).join('') : `<div style="color:var(--ink-2);font-size:13px;padding:6px 0;">${T('No recent projects yet — create one to get started.','Aún no hay proyectos recientes — crea uno para empezar.')}</div>`}
       </div>
     </div>
     <div style="font-size:11px;color:var(--ink-dim);letter-spacing:0.02em;padding-top:2px;">Created by Alma Digital Studio — all rights reserved</div>
   </div>`;
  document.body.appendChild(ov);
  ov._stopLogo=startLogoLoop(ov.querySelector('#lgLogo')); // [U9] animated logo loop
  ov.querySelector('#lgNew').onclick=()=>{ domeSetupDialog(cfg=>{ hideLanding(); newProject('dome',cfg.res,cfg.res,cfg.fps,cfg.cov); }); };
  ov.querySelector('#lgNew2d').onclick=()=>{ flatResDialog((w,h,fps)=>{ hideLanding(); newProject('flat',w,h,fps); }); };
  { const rb=ov.querySelector('#lgNewRoom'); if(rb)rb.onclick=()=>{ roomSetupDialog(cfg=>{ hideLanding(); newRoomProject(cfg); }); }; }
  ov.querySelector('#lgOpen').onclick=()=>{ openProject().then(()=>{}); }; // loadProject hides the landing on success
  ov.querySelectorAll('.lgcard').forEach(b=>{ b.onmouseenter=()=>b.style.borderColor='rgba(201,205,211,0.5)'; b.onmouseleave=()=>b.style.borderColor='rgba(255,255,255,0.09)';
    b.onclick=()=>{ const p=b.dataset.path; if(!p)return; if(IS_ELEC&&DSP.exists){ DSP.exists(p).then(ok=>{ if(ok)openProjectPath(p); else { appAlert(T('That project file was moved or deleted.','Ese archivo de proyecto se movió o eliminó.')); const a=getRecents().filter(r=>r.path!==p); saveRecents(a); hideLanding(); showLanding(); } }); } else openProjectPath(p); }; }); }

/* edit a label in place (contenteditable) — Enter commits, Esc cancels, blur commits. Used for clip/track/sequence rename so the edit happens where the text is, not in a floating dialog. */
function inlineEdit(el,value,commit){ if(!el)return false; try{closeMenu();}catch(e){}
  el.setAttribute('contenteditable','true'); el.spellcheck=false; el.textContent=value; el.style.cursor='text';
  const sel=window.getSelection(); const r=document.createRange(); r.selectNodeContents(el); sel.removeAllRanges(); sel.addRange(r); el.focus();
  let done=false,cancel=false;
  const fin=()=>{ if(done)return; done=true; el.removeEventListener('keydown',onk,true); el.removeEventListener('blur',onb,true); el.removeAttribute('contenteditable'); el.style.cursor='';
    const v=(el.textContent||'').replace(/\s+/g,' ').trim(); if(!cancel&&v&&v!==value)commit(v); else el.textContent=value; };
  const onk=ev=>{ ev.stopPropagation(); if(ev.key==='Enter'){ ev.preventDefault(); el.blur(); } else if(ev.key==='Escape'){ ev.preventDefault(); cancel=true; el.blur(); } };
  const onb=()=>fin();
  el.addEventListener('keydown',onk,true); el.addEventListener('blur',onb,true); return true; }
function renameLane(li){ const lane=state.lanes[li]; if(!lane)return; const el=document.querySelector('#laneHeaders .lanehdr[data-lane="'+li+'"] .nm');
  if(!inlineEdit(el,lane.name,v=>{ pushUndo(); lane.name=v; renderTimeline(); })) appPrompt(T('Track name:','Nombre de la pista:'),lane.name,n=>{ if(n!=null){ pushUndo(); lane.name=n; renderTimeline(); } }); }
/* Ctrl+R — rename whatever is selected: [M6] Media item / sequence / folder in the panel > marker > clip > track > active sequence (renames WHERE the selection is) */
function renameSelection(){
  { const mids=selectedMediaIds(); if(mids.length){ const mm=mediaById(mids[mids.length-1]); if(mm){ if(isSeqMedia(mm))renameSequence(mm.id); else renameMediaInline(mm,mediaNameEl(mm.id)); return; } } } // a media clip / sequence selected in Media → rename it there
  if(state.selFolder){ renameFolderInline(state.selFolder); return; } // a folder selected in the Media tree
  if(state.selMarkerId!=null){ const mk=state.markers.find(m=>m.id===state.selMarkerId); if(mk)renameLocatorInline(mk); return; }
  const c=selClip(); if(c){ const el=document.querySelector('.clip[data-clip="'+c.id+'"] .tt'); if(!inlineEdit(el,c.name,v=>{ pushUndo(); c.name=v; renderTimeline(); renderInspector(); })) appPrompt(T('Clip name:','Nombre del clip:'),c.name,n=>{ if(n!=null){ pushUndo(); c.name=n; renderTimeline(); renderInspector(); } }); return; }
  if(state.selLane!=null){ renameLane(state.selLane); return; }
  if(state.activeSeqId!=null){ renameSequence(state.activeSeqId); return; }
  flashStatus(T('Select a clip, track, locator or sequence to rename','Selecciona un clip, pista, localizador o secuencia para renombrar')); }
function duplicateLane(li){ const src=state.lanes[li]; if(!src)return; pushUndo(); const kind=src.kind; const n=state.lanes.filter(l=>l.kind===kind).length+1;
  const nl={id:uid(),name:src.name+' copy',tag:(kind==='audio'?'A':'V')+n,kind};
  const at=(kind==='audio')?li:li+1; // [R93b] audio duplicates BELOW the source (the module grows downward); video above — Premiere convention
  state.lanes.splice(at,0,nl);
  for(const c of state.clips)if(c.lane>=at)c.lane++;
  const srcLi=(kind==='audio')?li+1:li; // where the source landed after the insert
  for(const c of state.clips.filter(c=>c.lane===srcLi).map(c=>c)) state.clips.push(Object.assign({},JSON.parse(JSON.stringify(c)),{id:uid(),lane:at,groupId:undefined}));
  state.selLane=at; renderTimeline();renderInspector();render();updStatus(); flashStatus(T('Track duplicated','Pista duplicada')); }
/* drag a track header vertically to REORDER lanes (remaps every clip's lane index; handles the top-down display reversal) */
let _laneJustDragged=false;
function startLaneDrag(e,li){ e.preventDefault(); const disp=lanesTopDown(); const dragHd=document.querySelector('.lanehdr[data-lane="'+li+'"]'); if(!dragHd)return;
  const y0=e.clientY,x0=e.clientX; let started=false, dropDisp=disp.indexOf(li), ind=null, chip=null; const tlsc=document.querySelector('#tlscroll');
  const heads=()=>disp.map(idx=>document.querySelector('.lanehdr[data-lane="'+idx+'"]')).filter(Boolean);
  const move=ev=>{ if(!started){ if(Math.abs(ev.clientY-y0)<5&&Math.abs(ev.clientX-x0)<5)return; started=true;
      dragHd.style.opacity='0.55'; dragHd.style.outline='1px solid #C9CDD3'; dragHd.style.outlineOffset='-1px'; dragHd.style.boxShadow='0 3px 10px rgba(0,0,0,0.55)'; dragHd.style.zIndex='30'; document.body.style.cursor='grabbing';
      ind=document.createElement('div'); ind.style.cssText='position:fixed;height:3px;background:var(--ink-2);border-radius:1px;box-shadow:0 0 7px rgba(201,205,211,0.8);z-index:9999;pointer-events:none;'; document.body.appendChild(ind);
      chip=document.createElement('div'); chip.textContent=(state.lanes[li]||{}).name||''; chip.style.cssText='position:fixed;z-index:10000;pointer-events:none;font:600 10.5px Geist,sans-serif;color:var(--ink);background:var(--s1);border:.5px solid rgba(201,205,211,0.6);border-radius:2px;padding:2px 7px;box-shadow:0 2px 8px rgba(0,0,0,0.55);white-space:nowrap;'; document.body.appendChild(chip); }
    const hs=heads(); let pos=hs.length; for(let i=0;i<hs.length;i++){ const r=hs[i].getBoundingClientRect(); if(ev.clientY<r.top+r.height/2){ pos=i; break; } }
    { const isAud=(state.lanes[li]||{}).kind==='audio'; const inG=disp.map(idx=>((state.lanes[idx]||{}).kind==='audio')===isAud); const gLo=inG.indexOf(true),gHi=inG.lastIndexOf(true)+1; pos=Math.max(gLo,Math.min(gHi,pos)); } // [R92-T8] reorder only within the same group (can't drag video into the audio section or vice-versa)
    dropDisp=pos;
    const l0=hs[0].getBoundingClientRect().left, rEdge=tlsc?tlsc.getBoundingClientRect().right:hs[0].getBoundingClientRect().right;
    let ry; if(pos<hs.length){ ry=hs[pos].getBoundingClientRect().top; } else { ry=hs[hs.length-1].getBoundingClientRect().bottom; }
    ind.style.top=(ry-1.5)+'px'; ind.style.left=l0+'px'; ind.style.width=Math.max(60,rEdge-l0)+'px';
    if(chip){ chip.style.left=(ev.clientX+13)+'px'; chip.style.top=(ev.clientY-9)+'px'; } };
  const up=()=>{ window.removeEventListener('pointermove',move); window.removeEventListener('pointerup',up); if(ind)ind.remove(); if(chip)chip.remove(); document.body.style.cursor=''; dragHd.style.opacity=''; dragHd.style.outline=''; dragHd.style.boxShadow=''; dragHd.style.zIndex=''; if(!started)return;
    const cur=disp.slice(); const from=cur.indexOf(li); cur.splice(from,1); const to=dropDisp>from?dropDisp-1:dropDisp; cur.splice(Math.max(0,Math.min(cur.length,to)),0,li);
    const newOld=cur.slice().reverse(); const orig=state.lanes.slice(); const newLanes=newOld.map(oi=>orig[oi]); if(newLanes.some(l=>!l))return;
    const oldToNew=new Array(orig.length); newOld.forEach((oi,ni)=>oldToNew[oi]=ni);
    if(newLanes.every((l,i)=>l===orig[i])){ return; } // no change
    pushUndo(); state.lanes=newLanes; for(const c of state.clips)c.lane=oldToNew[c.lane]; if(state.selLane!=null)state.selLane=oldToNew[state.selLane];
    _laneJustDragged=true; setTimeout(()=>{_laneJustDragged=false;},0); renderTimeline(); render(); markDirty(); flashStatus(T('Track moved','Pista movida')); };
  window.addEventListener('pointermove',move); window.addEventListener('pointerup',up); }
/* markers */
function addMarker(){ const nm={id:uid(),time:state.playhead,name:T('Locator','Localizador'),color:'#B4BAC1'}; state.markers.push(nm); state.markers.sort((a,b)=>a.time-b.time); state.selMarkerId=nm.id; renderTimeline(); markDirty(); setTimeout(()=>renameLocatorInline(nm),0); } // R88: drop straight into inline name editing (deferred a tick so the triggering key doesn't type into the field)
/* [R97] ↑/↓ jump between CUTS — every edit point on the timeline (clip starts and ends), the universal way to travel a cut */
function jumpCut(dir){ const eps=1e-3; const pts=new Set([0]);
  for(const c of state.clips){ pts.add(+c.start.toFixed(4)); pts.add(+(c.start+c.dur).toFixed(4)); }
  const arr=[...pts].sort((a,b)=>a-b); const t=state.playhead;
  let tgt=null;
  if(dir<0){ for(let i=arr.length-1;i>=0;i--)if(arr[i]<t-eps){ tgt=arr[i]; break; } }
  else { for(let i=0;i<arr.length;i++)if(arr[i]>t+eps){ tgt=arr[i]; break; } }
  if(tgt==null){ flashStatus(dir<0?T('First edit point','Primer punto de edición'):T('Last edit point','Último punto de edición')); return; }
  state.playhead=Math.max(0,tgt); scrubRender(); positionPlayhead(); }
function jumpMarker(dir){ if(!state.markers.length)return; let tgt=null;
  if(dir>0){for(const m of state.markers)if(m.time>state.playhead+1e-3){tgt=m.time;break;}} else {for(let i=state.markers.length-1;i>=0;i--)if(state.markers[i].time<state.playhead-1e-3){tgt=state.markers[i].time;break;}}
  if(tgt!=null){state.playhead=tgt;scrubRender();} }
function BBT(s){ const spb=60/state.tl.bpm; const beats=s/spb; const bar=Math.floor(beats/state.tl.sig)+1; const beat=Math.floor(beats%state.tl.sig)+1; const tick=Math.floor((beats%1)*480); return bar+'.'+beat+'.'+String(tick).padStart(3,'0'); }
function positionPlayhead(){ const x=(state.playhead*state.tl.pxPerSec)+'px'; $('#playhead').style.left=x; const _pt=$('#phTri'); if(_pt)_pt.style.left=x; const t=$('#tc'); if(t)t.textContent=TC(state.playhead); const b=$('#bbt'); if(b)b.textContent=Math.round(state.playhead*(state.fps||30))+'f'; }
/* Follow mode: keep the playhead centred and let the timeline advance gradually under it (Premiere/Resolve-style smooth scroll) */
function followPlayhead(){ if(!state.follow)return; const sc=$('#tlscroll'); if(!sc)return; const vw=sc.clientWidth||1; const target=Math.max(0, state.playhead*state.tl.pxPerSec - vw/2);
  // grow the timeline width to cover the centred target BEFORE scrolling (same trick as tlZoomAt) so scrollLeft doesn't clamp against the infinite-scroll width
  if((target+vw) > (state.tl._w||0)*state.tl.pxPerSec){ state.tl._scrollTarget=target+vw; renderTimeline(); state.tl._scrollTarget=0; }
  sc.scrollLeft=target; } // counter is fixed: white = timecode, gray = frames (the TC/Frames toggle only changes the ruler/grid)
/* [T1] Zoom to clip — set the zoom so the clip fills ~96% of the visible timeline, then scroll its start to the left. */
function zoomToClip(c){ if(!c)return; const sc=$('#tlscroll'); if(!sc)return; const vw=sc.clientWidth||1;
  const dur=Math.max(0.05,c.dur); state.tl.pxPerSec=Math.max(TL_PPS_MIN,Math.min(TL_PPS_MAX,(vw*0.96)/dur));
  const target=Math.max(0, Math.round(c.start*state.tl.pxPerSec - vw*0.02)); // small left margin
  state.tl._scrollTarget=target+vw; renderTimeline(); state.tl._scrollTarget=0; // grow the content first so scrollLeft doesn't clamp (same trick as followPlayhead)
  sc.scrollLeft=target; }
/* work area */
/* [R94d] Premiere-style clip-extent bar in the ruler: where the sequence actually has content (first clip start → last clip end) */
function renderClipExtent(){ const el=$('#clipExtent'); if(!el)return; if(!state.clips.length){ el.style.display='none'; return; }
  let a=Infinity,b=0; for(const c of state.clips){ if(c.start<a)a=c.start; if(c.start+c.dur>b)b=c.start+c.dur; }
  if(!(b>a)){ el.style.display='none'; return; }
  const pps=state.tl.pxPerSec; el.style.display='block'; el.style.left=(a*pps)+'px'; el.style.width=Math.max(1,(b-a)*pps)+'px'; el.title=T('Clip extent','Extensión de los clips')+' · '+fmtTime(a)+' → '+fmtTime(b); }
function clipExtent(){ let a=Infinity,b=0; for(const c of state.clips){ if(c.start<a)a=c.start; if(c.start+c.dur>b)b=c.start+c.dur; } return (b>a)?[Math.max(0,a),b]:[0,duration()]; }
function renderWork(){ const w=$('#workArea'); updIOBtns(); // [R94e] the bracket buttons follow every path that touches the marks (loop, brace drag, project load)
  if(state.workIn==null||state.workOut==null||state.workOut<=state.workIn){w.style.display='none';return;} w.style.display='block'; w.style.left=(state.workIn*state.tl.pxPerSec)+'px'; w.style.width=((state.workOut-state.workIn)*state.tl.pxPerSec)+'px';
  const tr=$('#tracks'); w.style.top='0'; w.style.bottom='auto'; w.style.height=(22+((tr&&tr.offsetHeight)||0))+'px'; // span the ruler + EVERY track (not just the visible slice), like the playhead
  positionWorkBrace(); }
/* keep the loop's horizontal handle bar (.wkbrace) + resize grips pinned to the top of the VISIBLE area (the ruler), so they never scroll away — the work region itself scrolls with the content */
function positionWorkBrace(){ const w=$('#workArea'); if(!w||w.style.display==='none')return; const sc=$('#tlscroll'); const st=(sc&&sc.scrollTop)||0; const b=w.querySelector('.wkbrace'); if(b)b.style.top=st+'px'; w.querySelectorAll('.wkh').forEach(h=>h.style.top=st+'px'); }
function setWorkIn(){ state.workIn=state.playhead; if(state.workOut!=null&&state.workOut<=state.workIn)state.workOut=null; renderWork(); updIOBtns(); flashStatus(T('In ','Entrada ')+TC(state.playhead)); }
function setWorkOut(){ state.workOut=state.playhead; if(state.workIn!=null&&state.workIn>=state.workOut)state.workIn=null; renderWork(); updIOBtns(); flashStatus(T('Out ','Salida ')+TC(state.playhead)); }
function clearWork(){ state.workIn=state.workOut=null; renderWork(); updIOBtns(); flashStatus(T('In / Out cleared','Entrada / Salida borradas')); }
/* [R94e] the transport's bracket buttons mirror the I/O marks: lit when the mark is set */
function updIOBtns(){ const bi=$('#markIn'), bo=$('#markOut'); if(bi)bi.classList.toggle('on',state.workIn!=null); if(bo)bo.classList.toggle('on',state.workOut!=null); }
/* musical grid candidates for snapping */
function gridStep(){ const spb=60/state.tl.bpm;
  /* adaptive bar/beat grid: ~ a beat scaled so it isn't denser than ~20px */ let st=spb; while(st*state.tl.pxPerSec<20)st*=2; return st; }
/* mute/solo affects activeClips */
const _activeOrig=activeClips;
activeClips=function(t){ const anySolo=state.lanes.some(l=>l.solo); const out=[];
  for(const li of state.lanes.map((_,i)=>i)){ const lane=state.lanes[li]; if(lane.mute)continue; if(anySolo&&!lane.solo)continue;
    let best=null; for(const c of state.clips) if(c.lane===li&&t>=c.start&&t<c.start+c.dur)best=c; if(best)out.push(best); } return out; };

/* ===================== INTERACTION: timeline ===================== */
let drag=null;
$('#tracks').addEventListener('pointerdown',e=>{
  if(e.button!==0)return; // middle/right handled elsewhere (middle = pan)
  if(e.target.isContentEditable)return; // inline rename in progress on a clip title — let the browser edit text
  clearMediaSel(); // touching the timeline hands Delete-priority back to the timeline selection (R86)
  const cd=e.target.closest('.clip'); const tool=state.tl.tool;
  if(tool==='hand'){ startPan(e); return; }
  if(!cd){ if(tool==='zoom'){tlZoomAt(e,e.altKey?-1:1);} else { startTimeSelect(e); } return; } // empty area → time selection (Ableton)
  const id=+cd.dataset.clip, c=clipById(id);
  if(tool==='trackselect'){ e.preventDefault(); const from=c.start-0.002; const ids=state.clips.filter(o=>(e.shiftKey||o.lane===c.lane)&&o.start>=from).map(o=>o.id); // [U7] Premiere "Track Select Forward" (A): this clip + everything to its right on the track (Shift = all tracks)
    state.selIds=ids; state.selId=c.id; state.selGroupId=null; laneDesel(); $$('.clip').forEach(x=>x.classList.toggle('sel',ids.includes(+x.dataset.clip))); renderInspector(); updStatus(); flashStatus(ids.length+' '+T('clips selected forward','clips seleccionados hacia adelante')); return; }
  if(e.target.classList.contains('kfd')&&id===state.selId){ state.playhead=c.start+parseFloat(e.target.dataset.t); scrubRender(); return; }
  // double-click detection (the #tracks dblclick can be eaten by the move-drag, so detect it here):
  //  · a sequence/nest/compose clip → open it as a tab · a plain clip's TITLE → rename it in place (each cut portion is its own clip → renamed independently)
  { const _t=Date.now(); const mm=c&&mediaById(c.mediaId); if(state._lastClipClick&&state._lastClipClick.id===id&&(_t-state._lastClipClick.t)<400){ state._lastClipClick=null;
      if(mm&&isSeqMedia(mm)){ e.preventDefault(); openSeq(mm.id); return; }
      if(e.target.classList.contains('tt')){ e.preventDefault(); state.selIds=[id]; state.selId=id; state.selGroupId=null; $$('.clip').forEach(x=>x.classList.toggle('sel',+x.dataset.clip===id)); renderInspector();
        inlineEdit(e.target,c.name,v=>{ pushUndo(); c.name=v; renderTimeline(); renderInspector(); markDirty(); }); return; } }
    else state._lastClipClick={id,t:_t}; }
  const isL=e.target.classList.contains('l'),isR=e.target.classList.contains('r'),isTitle=e.target.classList.contains('tt'),isFade=e.target.classList.contains('fadeh');
  // [R97] TRIM tool (T): the zone under the cursor picks ripple / roll / slip / slide — no tool switching
  if(tool==='trim'){ e.preventDefault(); const r=cd.getBoundingClientRect(); const z=trimZone(c,e.clientX-r.left,r.width,isTitle);
    if(z.kind==='slide'){ const nb=laneNeighbours(c); z.prev=nb.prev; z.next=nb.next; }
    const base={start:c.start,dur:c.dur,inP:c.inP||0};
    if(z.kind==='roll'){ base.aDur=z.a.dur; base.aInP=z.a.inP||0; base.bStart=z.b.start; base.bDur=z.b.dur; base.bInP=z.b.inP||0; }
    if(z.kind==='rippleL'||z.kind==='rippleR'){ base.after=new Map(); const edge=c.start+(z.kind==='rippleL'?0:c.dur);
      for(const o of state.clips)if(o.lane===c.lane&&o!==c&&o.start>=edge-0.002)base.after.set(o.id,o.start); }
    if(z.kind==='slide'){ if(z.prev)base.pDur=z.prev.dur; if(z.next){ base.nStart=z.next.start; base.nDur=z.next.dur; base.nInP=z.next.inP||0; } }
    state.selIds=[c.id]; state.selId=c.id; laneDesel(); $$('.clip').forEach(x=>x.classList.toggle('sel',+x.dataset.clip===c.id));
    const x0=e.clientX; let pushed=false;
    const mv=ev=>{ if(!pushed){ pushUndo(); pushed=true; } const fps=state.fps||30; let dt=(ev.clientX-x0)/state.tl.pxPerSec;
      if(ev.shiftKey)dt*=0.25; else dt=Math.round(dt*fps)/fps; // [T2] frame-snap by default → the edge steps whole frames (clearly visible once zoomed in); hold Shift for sub-frame fine control
      const d=applyTrim(z,dt,base); scheduleTimeline(); render(); refreshInspector();
      flashStatus(T(TRIM_LABEL[z.kind][0],TRIM_LABEL[z.kind][1])+'  '+(d>=0?'+':'')+d.toFixed(3)+'s ('+(d>=0?'+':'')+Math.round(d*fps)+'f)'); };
    const up=()=>{ window.removeEventListener('pointermove',mv); window.removeEventListener('pointerup',up); renderTimeline(); renderInspector(); render(); reschedAudio(); markDirty(); };
    window.addEventListener('pointermove',mv); window.addEventListener('pointerup',up); return; }
  // razor / zoom tools act on the clip wherever you click it
  if(tool==='razor'){ const rect=$('#tracks').getBoundingClientRect(); const sn=applySnap((e.clientX-rect.left)/state.tl.pxPerSec,c.id); razorClip(c, sn.val); showSnap(null); return; }
  if(tool==='zoom'){ tlZoomAt(e,e.altKey?-1:1); return; }
  // Ableton: only the TITLE banner selects/moves the clip. Clicking the clip BODY places the playhead (white line) like empty area — without selecting the clip.
  // [R94c] Simple clip view (Premiere): the WHOLE clip is the grab/select surface — the body no longer starts a range selection (that only works outside clips).
  if(!isTitle&&!isL&&!isR&&!isFade&&!state.tl.simpleClips){ startTimeSelect(e); return; }
  // title / trim handle / fade handle → select the clip, then drag
  if(e.shiftKey){ const i=state.selIds.indexOf(id); if(i>=0)state.selIds.splice(i,1); else state.selIds.push(id); if(!state.selIds.includes(id))state.selId=state.selIds[state.selIds.length-1]||null; else state.selId=id; }
  else if(!state.selIds.includes(id)){ state.selIds=[id]; state.selId=id; }
  else { state.selId=id; }
  state.selGroupId=null; laneDesel(); renderInspector(); $$('.clip').forEach(x=>x.classList.toggle('sel',state.selIds.includes(+x.dataset.clip))); updStatus(); ensureClipVisible(c); // [R94-UT2·U-01]
  if(isFade){ startFadeDrag(e,c,e.target.classList.contains('fadeR')?'fadeOut':'fadeIn'); return; }
  // pushUndo is deferred until the drag actually changes something (avoids dead undo entries from a plain click)
  drag={id,mode:isL?'trimL':isR?'trimR':'move',x0:e.clientX,y0:e.clientY,start0:c.start,dur0:c.dur,inP0:c.inP,lane0:c.lane,_undone:false,
    items:state.selIds.map(sid=>{const sc=clipById(sid);return sc?{id:sid,start0:sc.start,dur0:sc.dur,inP0:sc.inP,kf0:JSON.parse(JSON.stringify(sc.kf||{})),anim0:sc.anim?JSON.parse(JSON.stringify(sc.anim)):null}:null;}).filter(Boolean)};
  window.addEventListener('pointermove',onTLMove); window.addEventListener('pointerup',onTLUp);
});
/* [R94-UT5·U-10b] keyboard: a clip focused via Tab is selected with Enter/Space — the same minimal path a title
   click takes (single selection). Gated on :focus-visible: KEYBOARD focus selects; after a mere mouse click
   (focus without ring) the keys fall through so Space keeps toggling playback like always. */
$('#tracks').addEventListener('keydown',e=>{ if(e.key!=='Enter'&&e.code!=='Space')return; const cd=e.target.closest&&e.target.closest('.clip'); if(!cd||!cd.matches(':focus-visible'))return;
  e.preventDefault(); e.stopPropagation(); const id=+cd.dataset.clip, c=clipById(id); if(!c)return;
  clearMediaSel(); state.selIds=[id]; state.selId=id; state.selGroupId=null; laneDesel(); renderInspector();
  $$('.clip').forEach(x=>x.classList.toggle('sel',+x.dataset.clip===id)); updStatus(); ensureClipVisible(c); });
/* lanes whose row overlaps a vertical screen range [yA,yB] (Ableton: time selection is bound to the tracks you drag across) */
function lanesBetweenY(yA,yB){ const lo=Math.min(yA,yB),hi=Math.max(yA,yB); const out=[]; for(const r of $$('#tracks .lane')){ const rr=r.getBoundingClientRect(); if(rr.bottom>=lo-0.5&&rr.top<=hi+0.5)out.push(+r.dataset.lane); } return out; }
/* time selection (drag the body / empty area) — highlighted span used by Loop (Ctrl+L); selects only the clips in the tracks the drag spans (drag up/down to add tracks, like Ableton) */
function startTimeSelect(e,c){ const rect=$('#tracks').getBoundingClientRect(); const xT=ev=>Math.max(0,(ev.clientX-rect.left)/state.tl.pxPerSec); const y0=e.clientY;
  const snap=v=>{ if(!e.altKey){ const sn=applySnap(v,c?c.id:null); if(sn.snap!=null)return sn.val; } return v; };
  let a=snap(xT(e)); state.tl.selA=a; state.tl.selB=a; state.tl.selLanes=c?[c.lane]:lanesBetweenY(y0,y0); renderTimeSel(); let moved=false; // click drops an insert marker; the playhead (thick line) does NOT move — play() starts from here
  const mv=ev=>{ let b=Math.max(0,(ev.clientX-rect.left)/state.tl.pxPerSec); if(state.tl.snap&&!ev.altKey){const sn=applySnap(b,c?c.id:null); if(sn.snap!=null)b=sn.val;} state.tl.selB=b; const ln=lanesBetweenY(y0,ev.clientY); state.tl.selLanes=ln.length?ln:(c?[c.lane]:state.tl.selLanes); if(Math.abs(b-a)>0.002)moved=true; renderTimeSel(); };
  const up=()=>{ window.removeEventListener('pointermove',mv); window.removeEventListener('pointerup',up);
    if(!moved){ /* pure click = keep a thin insert marker at the click on this one lane (does NOT move the playhead); deselect clips */ state.tl.selA=state.tl.selB=a; state.tl.selLanes=c?[c.lane]:lanesBetweenY(y0,y0); renderTimeSel(); if(c){ state.selIds=[c.id]; state.selId=c.id; laneDesel(); ensureClipVisible(c); /* [R94-UT2·U-01] */ } else { state.selIds=[]; state.selId=null; } state.selGroupId=null; renderInspector(); $$('.clip').forEach(x=>x.classList.toggle('sel',state.selIds.includes(+x.dataset.clip))); updStatus(); }
    else { const lo=Math.min(state.tl.selA,state.tl.selB),hi=Math.max(state.tl.selA,state.tl.selB); const lanes=state.tl.selLanes||[]; const ids=state.clips.filter(x=>lanes.includes(x.lane)&&x.start<hi-1e-4&&x.start+x.dur>lo+1e-4).map(x=>x.id); state.selIds=ids; state.selId=ids[ids.length-1]||null; state.selGroupId=null; if(ids.length)laneDesel(); renderInspector(); $$('.clip').forEach(x=>x.classList.toggle('sel',state.selIds.includes(+x.dataset.clip))); updStatus(); flashStatus(T('Selection ','Selección ')+fmtTime(lo)+' → '+fmtTime(hi)+' · '+lanes.length+(lanes.length===1?T(' track',' pista'):T(' tracks',' pistas'))); } };
  window.addEventListener('pointermove',mv); window.addEventListener('pointerup',up); }
function renderTimeSel(){ const el=$('#timeSel'); if(!el)return; const a=state.tl.selA,b=state.tl.selB; if(a==null||b==null){ el.style.display='none'; el.style.top=''; el.style.bottom=''; el.style.height=''; el.classList.remove('insert'); return; } const lo=Math.min(a,b),hi=Math.max(a,b); const isInsert=Math.abs(b-a)<1e-4; el.classList.toggle('insert',isInsert); el.style.display='block'; el.style.left=(lo*state.tl.pxPerSec)+'px'; el.style.width=(isInsert?0:((hi-lo)*state.tl.pxPerSec))+'px';
  const lanes=state.tl.selLanes; // span only the selected tracks vertically (Ableton)
  if(lanes&&lanes.length){ const sc=$('#tlscroll'),scR=sc.getBoundingClientRect(); let top=null,bot=null; for(const r of $$('#tracks .lane')){ if(!lanes.includes(+r.dataset.lane))continue; const rr=r.getBoundingClientRect(); const t=rr.top-scR.top+sc.scrollTop, bb=rr.bottom-scR.top+sc.scrollTop; top=(top==null?t:Math.min(top,t)); bot=(bot==null?bb:Math.max(bot,bb)); } if(top!=null){ el.style.top=top+'px'; el.style.bottom='auto'; el.style.height=(bot-top)+'px'; return; } }
  el.style.top='0'; el.style.bottom='0'; el.style.height=''; }
/* Loop Selection (Ctrl+L): set the loop region to the time selection (or selected clip) and toggle the loop */
function loopSelection(){ let a=null,b=null;
  if(state.tl.selA!=null&&state.tl.selB!=null&&Math.abs(state.tl.selB-state.tl.selA)>1e-3){ a=Math.min(state.tl.selA,state.tl.selB); b=Math.max(state.tl.selA,state.tl.selB); }
  else { const c=selClip(); if(c){ a=c.start; b=c.start+c.dur; } }
  if(a==null){ if(state.loop||state.workIn!=null){ state.workIn=state.workOut=null; state.loop=false; const lb=$('#loopBtn'); if(lb)lb.classList.remove('on'); renderWork(); flashStatus(T('Loop off','Bucle desactivado')); } else flashStatus(T('Select a range or a clip to loop','Selecciona un rango o un clip para el bucle')); return; } // no range/clip to loop → Ctrl+L clears an active loop (even after a plain single-click insert), else hints (user request R84b)
  if(state.loop&&Math.abs((state.workIn||-9)-a)<1e-4&&Math.abs((state.workOut||-9)-b)<1e-4){ state.workIn=state.workOut=null; state.loop=false; const lb=$('#loopBtn'); if(lb)lb.classList.remove('on'); renderWork(); flashStatus(T('Loop off','Bucle desactivado')); return; }
  state.workIn=a; state.workOut=b; state.loop=true; const lb=$('#loopBtn'); if(lb)lb.classList.add('on'); renderWork(); flashStatus(T('Loop: ','Bucle: ')+fmtTime(a)+' → '+fmtTime(b)); }
/* razor tool: live cut-line preview that follows the mouse and snaps (cursor evidences where the cut lands) */
$('#tracks').addEventListener('pointermove',e=>{ if(drag)return; const cd=e.target.closest('.clip'); if(state.tl.tool!=='razor'||!cd){ showSnap(null); return; } const rect=$('#tracks').getBoundingClientRect(); const sn=applySnap((e.clientX-rect.left)/state.tl.pxPerSec,+cd.dataset.clip); showSnap(sn.val, sn.snap==null); });
$('#tracks').addEventListener('pointerleave',()=>{ if(state.tl.tool==='razor')showSnap(null); });
$('#tracks').addEventListener('dblclick',e=>{ const cd=e.target.closest('.clip'); if(!cd)return; const c=clipById(+cd.dataset.clip), m=c&&mediaById(c.mediaId); if(m&&isSeqMedia(m))openSeq(m.id); }); // double-click a nest/sequence clip opens it as a tab
function snapTargets(exceptId){ const t=[state.playhead]; for(const c of state.clips){if(c.id===exceptId)continue;t.push(c.start,c.start+c.dur);} for(const mk of state.markers){if(mk.id===exceptId)continue;t.push(mk.time);} return t; }
/* zoom-adaptive base grid step (seconds) for timecode/frames modes */
function gridBaseAdaptive(){ if(state.tl.tcMode==='bars')return gridStep(); const pps=state.tl.pxPerSec; const steps=[1/state.fps,2/state.fps,5/state.fps,0.5,1,2,5,10,15,30,60,120,300,600,1200,1800,3600]; return steps.find(s=>s*pps>=15)||3600; } // R82: larger steps for extreme zoom-out (feature-length clips)
/* effective grid step (seconds): adaptive or fixed, scaled by narrow/widen (Ctrl+1 / Ctrl+2), clamped */
function gridSec(){ let base=state.tl.gridFixed?(state.tl.gridFixedBase||1):gridBaseAdaptive(); base*=Math.pow(2,-(state.tl.gridDiv||0)); return Math.max(1/((state.fps||30)*4),Math.min(3600,base)); }
function snapGrid(){ if(state.tl.tcMode==='bars')return gridStep()*Math.pow(2,-(state.tl.gridDiv||0)); return state.tl.snap?gridSec():0; }
function gridLabel(){ const g=gridSec(),fps=state.fps||30; if(state.tl.tcMode==='frames'||g<1){ const f=Math.max(1,Math.round(g*fps)); return f+' '+(f===1?T('frame','fotograma'):T('frames','fotogramas')); } return (g%1===0?g:g.toFixed(2))+' s'; }
function flashGrid(){ const el=$('#gridReadout'); if(el)el.textContent=(state.tl.gridFixed?'▦ ':'◇ ')+gridLabel(); flashStatus((state.tl.gridFixed?T('Fixed grid: ','Grilla fija: '):T('Adaptive grid: ','Grilla adaptativa: '))+gridLabel()); }
function gridNarrow(){ state.tl.gridDiv=Math.min(8,(state.tl.gridDiv||0)+1); renderTimeline(); flashGrid(); }
function gridWiden(){ state.tl.gridDiv=Math.max(-8,(state.tl.gridDiv||0)-1); renderTimeline(); flashGrid(); }
function gridToggleFixed(){ if(!state.tl.gridFixed){ state.tl.gridFixedBase=gridBaseAdaptive(); state.tl.gridDiv=0; } state.tl.gridFixed=!state.tl.gridFixed; renderTimeline(); flashGrid(); }
function toggleSnap(){ state.tl.snap=!state.tl.snap; const b=$('#snapBtn'); if(b)b.classList.toggle('on',state.tl.snap); flashStatus((state.tl.snap?T('Snap to Grid on','Ajuste a la cuadrícula activado'):T('Snap to Grid off','Ajuste a la cuadrícula desactivado'))); }
/* [R94c] Simple clip view (Premiere): drag/select the clip from anywhere on it; the timeline range selection then
   works only OUTSIDE clips (over a clip the gesture grabs the block instead). Off = Ableton model (title band grabs,
   body drags a range). View-only state — persisted with the project, no undo entry. */
function toggleSimpleClips(){ state.tl.simpleClips=!state.tl.simpleClips; syncSimpleUI(); markDirty();
  flashStatus(state.tl.simpleClips?T('Simple clips — drag from anywhere · range selection outside clips','Clips simples — arrastra desde cualquier punto · selección de rango fuera de los clips'):T('Clip body drags a range again','El cuerpo del clip vuelve a seleccionar rango')); }
function syncSimpleUI(){ const b=$('#simpleClipBtn'); if(b)b.classList.toggle('on',!!state.tl.simpleClips); document.body.classList.toggle('simpleclips',!!state.tl.simpleClips); applyToolCursor(); }
function applySnap(val,exceptId){ const px=9/state.tl.pxPerSec; // clip-edge/playhead/marker snapping is ALWAYS on (R80b) — the Snap button gates only the GRID (Alt bypasses everything at the call sites)
  let best=null,bd=px; for(const tg of snapTargets(exceptId)){const d=Math.abs(tg-val);if(d<bd){bd=d;best=tg;}}
  const st=snapGrid(); if(st>0){ const g=Math.round(val/st)*st; const d=Math.abs(g-val); if(d<bd){bd=d;best=g;} }
  return best!=null?{val:best,snap:best}:{val,snap:null}; }
function showSnap(t,free){ const sl=$('#snapline'); if(t==null){sl.style.display='none';return;} sl.style.display='block'; sl.style.left=(t*state.tl.pxPerSec)+'px'; sl.classList.toggle('free',!!free); }
/* ===================== [R97] CONTEXTUAL TRIM (T) — Resolve's model =====================
   Professional NLEs have five trims; Resolve proved you don't need five TOOLS: one key (T) and the CURSOR decides, by where
   it sits inside the clip. That removes the "which tool do I need?" tax, which the research flagged as the best cost/benefit
   move available to us. Zones: an edge that touches a neighbour = ROLL (move the cut) · a free edge = RIPPLE (trim + shift
   everything after) · the title band = SLIDE (move the clip, neighbours absorb it) · the body = SLIP (change the media range).
   Source limits are honoured exactly like the normal trim: you can never pull material that doesn't exist. */
function clipSrc(c){ const m=mediaById(c.mediaId); const lim=!!(m&&(m.kind==='video'||m.kind==='audio'||isSeqMedia(m)));
  const sd=(m&&isSeqMedia(m))?seqDur(m):(m?(m.dur||Infinity):Infinity); return {lim:lim&&!c.loop,sd}; }
function laneNeighbours(c){ const l=state.clips.filter(x=>x.lane===c.lane&&x!==c).sort((a,b)=>a.start-b.start); const eps=0.002;
  return { prev:l.filter(x=>Math.abs(x.start+x.dur-c.start)<eps).pop()||null, next:l.filter(x=>Math.abs(x.start-(c.start+c.dur))<eps)[0]||null }; }
/* which trim would a press here perform? px = pointer X relative to the clip element */
function trimZone(c,px,w,isTitle){ const EDGE=12; const nb=laneNeighbours(c);
  if(px<EDGE) return nb.prev?{kind:'roll',a:nb.prev,b:c}:{kind:'rippleL',c};
  if(px>w-EDGE) return nb.next?{kind:'roll',a:c,b:nb.next}:{kind:'rippleR',c};
  if(isTitle) return {kind:'slide',c};
  return {kind:'slip',c}; }
const TRIM_LABEL={roll:['Roll — move the cut','Roll — mover el corte'],rippleL:['Ripple in','Ripple de entrada'],rippleR:['Ripple out','Ripple de salida'],slide:['Slide — move clip, neighbours absorb','Slide — mover clip, los vecinos absorben'],slip:['Slip — change the media inside','Slip — cambiar el material interior']};
/* apply a trim by dt seconds. base = the frozen start values captured at pointerdown (so every drag frame is absolute). */
function applyTrim(z,dt,base){
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  if(z.kind==='roll'){ const A=z.a,B=z.b; const sa=clipSrc(A), sb=clipSrc(B);
    let lo=-(base.aDur-0.05), hi=(base.bDur-0.05); // can't shrink either side below 5 frames-ish
    if(sa.lim)hi=Math.min(hi,Math.max(0,(sa.sd-base.aInP)/(A.speed||1)-base.aDur)); // A can't grow past its source
    if(sb.lim)lo=Math.max(lo,-base.bInP/(B.speed||1));                              // B can't pull before its source start
    const d=clamp(dt,lo,hi);
    A.dur=base.aDur+d; B.start=base.bStart+d; B.dur=base.bDur-d; B.inP=base.bInP+d*(B.speed||1); return d; }
  if(z.kind==='rippleL'){ const c=z.c, s=clipSrc(c);
    let lo=s.lim?-base.inP/(c.speed||1):-base.start, hi=base.dur-0.05; lo=Math.max(lo,-base.start);
    const d=clamp(dt,lo,hi);
    c.dur=base.dur-d; c.inP=base.inP+d*(c.speed||1); // the clip's START stays put; everything after slides to close/open the gap
    for(const o of state.clips)if(o.lane===c.lane&&o!==c&&base.after.has(o.id))o.start=base.after.get(o.id)-d; return d; }
  if(z.kind==='rippleR'){ const c=z.c, s=clipSrc(c);
    let lo=-(base.dur-0.05), hi=s.lim?Math.max(0,(s.sd-base.inP)/(c.speed||1)-base.dur):1e6;
    const d=clamp(dt,lo,hi); c.dur=base.dur+d;
    for(const o of state.clips)if(o.lane===c.lane&&o!==c&&base.after.has(o.id))o.start=base.after.get(o.id)+d; return d; }
  if(z.kind==='slip'){ const c=z.c, s=clipSrc(c); if(!s.lim)return 0; // nothing to slip inside a generator/still
    const lo=-base.inP/(c.speed||1), hi=Math.max(0,(s.sd-base.inP)/(c.speed||1)-base.dur);
    const d=clamp(-dt,lo,hi); c.inP=base.inP+d*(c.speed||1); return d; } // drag right → reveal EARLIER material (film under the window)
  if(z.kind==='slide'){ const c=z.c; const P=z.prev,N=z.next;
    let lo=-1e6,hi=1e6;
    if(P){ lo=Math.max(lo,-(base.pDur-0.05)); } else lo=Math.max(lo,-base.start);
    if(N){ const sn=clipSrc(N); hi=Math.min(hi,base.nDur-0.05); if(sn.lim)lo=Math.max(lo,-base.nInP/(N.speed||1)); }
    const d=clamp(dt,lo,hi); c.start=base.start+d;
    if(P)P.dur=base.pDur+d;
    if(N){ N.start=base.nStart+d; N.dur=base.nDur-d; N.inP=base.nInP+d*(N.speed||1); } return d; }
  return 0; }
/* [R97] keyboard trim: nudge the edge nearest the playhead of the selected clip (ripple if free, roll if it meets a neighbour) */
function trimNudge(dir,frames){ const c=selClip(); if(!c)return; const dt=dir*frames/(state.fps||30);
  const nb=laneNeighbours(c); const dL=Math.abs(state.playhead-c.start), dR=Math.abs(state.playhead-(c.start+c.dur));
  const atL=dL<=dR; const z=atL?(nb.prev?{kind:'roll',a:nb.prev,b:c}:{kind:'rippleL',c}):(nb.next?{kind:'roll',a:c,b:nb.next}:{kind:'rippleR',c});
  const base={start:c.start,dur:c.dur,inP:c.inP||0};
  if(z.kind==='roll'){ base.aDur=z.a.dur; base.aInP=z.a.inP||0; base.bStart=z.b.start; base.bDur=z.b.dur; base.bInP=z.b.inP||0; }
  else { base.after=new Map(); const edge=c.start+(z.kind==='rippleL'?0:c.dur);
    for(const o of state.clips)if(o.lane===c.lane&&o!==c&&o.start>=edge-0.002)base.after.set(o.id,o.start); }
  pushUndo(); const d=applyTrim(z,dt,base); renderTimeline(); renderInspector(); render(); reschedAudio(); markDirty();
  flashStatus(T(TRIM_LABEL[z.kind][0],TRIM_LABEL[z.kind][1])+'  '+(d>=0?'+':'')+Math.round(d*(state.fps||30))+'f'); }
/* Ableton-style move: the original clip stays put; a translucent ghost shows where it will land. [R94e] Alt = copy (Premiere). Applied on pointerup. */
function clearMoveGhosts(){ $$('#tracks .moveghost').forEach(g=>g.remove()); }
function showMoveGhosts(d,applied,targetLane,copy){ clearMoveGhosts(); const pps=state.tl.pxPerSec, tracks=$('#tracks'); const single=!(d.items&&d.items.length>1);
  for(const it of d.items){ const oc=clipById(it.id); if(!oc)continue; const li=single?((targetLane!=null)?targetLane:oc.lane):(oc.lane+(d._laneDelta||0)); const rowEl=tracks.querySelector('.lane[data-lane="'+li+'"]'); if(!rowEl)continue;
    const ns=Math.max(0,it.start0+applied); const g=document.createElement('div'); g.className='moveghost'+(copy?' copy':'');
    g.style.cssText='position:absolute;pointer-events:none;z-index:30;border:1px solid '+(copy?'#C9CDD3':'rgba(255,255,255,0.7)')+';background:'+oc.color+';opacity:.42;border-radius:2px;box-shadow:0 2px 8px rgba(0,0,0,0.4);overflow:hidden;';
    const _gp=rowEl.offsetParent||tracks; // [R92-T9] audio rows live inside the sticky #audioZone (its own offsetParent) → append the ghost there so offsetTop lines up
    g.style.left=(ns*pps)+'px'; g.style.top=(rowEl.offsetTop+4)+'px'; g.style.width=Math.max(14,oc.dur*pps)+'px'; g.style.height=(rowEl.offsetHeight-8)+'px';
    g.innerHTML='<div style="position:absolute;left:0;top:0;right:0;height:15px;line-height:15px;font:600 10px Geist;padding:0 5px;color:'+textOn(oc.color)+';background:'+oc.color+';white-space:nowrap;overflow:hidden;">'+(copy?'＋ ':'')+oc.name+'</div>';
    _gp.appendChild(g); } }
function duplicateClipAt(c,start,lane){ const n=Object.assign({},c,{id:uid(),start:Math.max(0,start),lane:(lane!=null?lane:c.lane),maskTex:null,_penCv:null,penMasks:c.penMasks?JSON.parse(JSON.stringify(c.penMasks)):undefined,props:Object.assign({},c.props),kf:JSON.parse(JSON.stringify(c.kf||{})),fx:JSON.parse(JSON.stringify(c.fx||[]))});
  sepAuto(n,c);
  if(n.maskData||(n.penMasks&&n.penMasks.length))rebuildMaskTex(n); return n; }
function onTLMove(e){ if(!drag)return; const c=clipById(drag.id);if(!c)return; const dt=(e.clientX-drag.x0)/state.tl.pxPerSec; let snap=null;
  const m=mediaById(c.mediaId); const srcLim=!!(m&&(m.kind==='video'||m.kind==='audio'||isSeqMedia(m))); const srcDur=(m&&isSeqMedia(m))?seqDur(m):(m?m.dur:Infinity); // a nest clip can't exceed its inner content (live seqDur, not the possibly-stale m.dur)
  if(drag.mode==='move'){ let ns=Math.max(0,drag.start0+dt); const sn=applySnap(ns,c.id); const durMv=(drag.dur0!=null?drag.dur0:c.dur);
    const snE=applySnap(ns+durMv,c.id); // Premiere-style: the clip's END edge snaps to other clips/playhead/markers too — pick whichever edge is closer
    if(snE.snap!=null&&(sn.snap==null||Math.abs(snE.val-(ns+durMv))<Math.abs(sn.val-ns))){ ns=Math.max(0,snE.val-durMv); snap=snE.snap; }
    else { ns=Math.max(0,sn.val); snap=sn.snap; }
    const applied=ns-drag.start0;
    let targetLane=null;
    if(!(drag.items&&drag.items.length>1)){ // single: pick the lane under the cursor (same kind)
      const wantKind=(m&&m.kind==='audio')?'audio':'video';
      const rows=$$('#tracks .lane'); for(const r of rows){const rc=r.getBoundingClientRect(); if(e.clientY>=rc.top&&e.clientY<=rc.bottom){ const li=+r.dataset.lane; if(state.lanes[li]&&state.lanes[li].kind===wantKind)targetLane=li; break; }}
      drag._laneDelta=0;
    } else { // multi: RELATIVE lane shift (Premiere-style) — the anchor follows the cursor and every clip keeps its lane offset; only applied if every destination lane exists and kind-matches
      let hoverLane=null; const rows=$$('#tracks .lane'); for(const r of rows){const rc=r.getBoundingClientRect(); if(e.clientY>=rc.top&&e.clientY<=rc.bottom){ hoverLane=+r.dataset.lane; break; }}
      let delta=(hoverLane!=null)?(hoverLane-c.lane):0;
      if(delta!==0){ for(const it of drag.items){ const oc=clipById(it.id); if(!oc){delta=0;break;} const mm=mediaById(oc.mediaId); const kind=(mm&&mm.kind==='audio')?'audio':'video'; const nl=state.lanes[oc.lane+delta]; if(!nl||nl.kind!==kind){ delta=0; break; } } }
      drag._laneDelta=delta; }
    drag._applied=applied; drag._lane=(targetLane!=null?targetLane:c.lane); drag._copy=!!e.altKey; // [R94e] Alt-drag duplicates (Premiere); Ctrl is free again
    showSnap(snap); showMoveGhosts(drag,applied,targetLane,drag._copy); return; // original stays; ghost shows destination, applied on pointerup
  } else if(drag.mode==='trimL'){
    let ns=drag.start0+dt; const maxS=drag.start0+drag.dur0-0.05; const minS=srcLim?Math.max(0,drag.start0-drag.inP0):0; // inP can't go < 0
    ns=Math.max(minS,Math.min(ns,maxS)); const sn=applySnap(ns,c.id); ns=Math.max(minS,Math.min(sn.val,maxS)); snap=(sn.val===ns)?sn.snap:null;
    const delta=ns-drag.start0; if(delta!==0&&!drag._undone){pushUndo();drag._undone=true;} for(const it of drag.items) trimItem(it,'L',delta); // applies to all selected clips
  } else if(drag.mode==='trimR'){
    let ne=drag.start0+drag.dur0+dt; const sn=applySnap(ne,c.id); ne=sn.val; snap=sn.snap;
    let ndP=Math.max(0.05,ne-drag.start0); if(srcLim&&!c.loop)ndP=Math.min(ndP, Math.max(0.05, (srcDur-drag.inP0)/(c.speed||1))); const delta=ndP-drag.dur0; // timeline length available = source remainder ÷ speed (loopable clips can extend forever)
    if(delta!==0&&!drag._undone){pushUndo();drag._undone=true;} for(const it of drag.items) trimItem(it,'R',delta); // applies to all selected clips
    const cc=clipById(drag.id); if(snap!=null && cc && Math.abs((cc.start+cc.dur)-sn.val)>1e-3)snap=null;
  }
  showSnap(snap); scheduleTimeline(); render(); }
/* trim one clip's edge by `delta` seconds, clamped to its own source/content limits (multi-select trim applies the same delta to every selected clip) */
function trimItem(it,edge,delta){ const oc=clipById(it.id); if(!oc)return; const m=mediaById(oc.mediaId); const lim=!!(m&&(m.kind==='video'||m.kind==='audio'||isSeqMedia(m))); const sd=(m&&isSeqMedia(m))?seqDur(m):(m?m.dur:Infinity);
  if(edge==='L'){ const sp=(oc.speed||1); const minS=lim?Math.max(0,it.start0-it.inP0/sp):0, maxS=it.start0+it.dur0-0.05; const ns=Math.max(minS,Math.min(it.start0+delta,maxS)); const d=ns-it.start0; oc.start=ns; oc.dur=it.dur0-d; oc.inP=Math.max(0,it.inP0+d*sp); // [R92-T4 F6] inP is SOURCE seconds: a timeline shift of d consumes d×speed of source (the frame under the new edge no longer jumps on sped-up clips)
    if(it.kf0){ const nk={}; for(const p in it.kf0){ const src=it.kf0[p]; const a=src.map(k=>({...k,t:k.t-d,hOut:k.hOut?{...k.hOut}:undefined,hIn:k.hIn?{...k.hIn}:undefined})).filter(k=>k.t>=-1e-6);
      if(a.length<src.length&&src.length>1){ const synth={start:0,dur:1e9,props:{[p]:src[0].v},kf:{[p]:src}}; const v=evalP(synth,p,d); if(v!=null&&(!a.length||a[0].t>1e-6))a.unshift({t:0,v,e:'linear'}); } // [R92-T4 F7] boundary keyframe with the curve's value at the cut — trim-in used to silently discard the ramp start (permanently)
      if(a.length)nk[p]=a; } oc.kf=nk; }
    if(it.anim0){ oc.anim=it.anim0.map(aa=>({...aa,wetKf:Array.isArray(aa.wetKf)?aa.wetKf.map(k=>({...k,t:k.t-d})).filter(k=>k.t>=-1e-6):aa.wetKf})); } } // [R92-T4 F11] motion-mix (wetKf) ramps stay anchored to the content too
  else { let nd=Math.max(0.05,it.dur0+delta); if(lim&&!oc.loop)nd=Math.min(nd,Math.max(0.05,(sd-it.inP0)/(oc.speed||1))); oc.dur=nd; } } // loopable clips extend past source
/* [R92-T3 F3] light reposition path: during a trim drag only start/dur change — move/resize the existing
   clip nodes instead of rebuilding the whole timeline DOM (a full rebuild costs ~100ms at 300 clips → 10fps drags). */
function positionClips(){ const tr=$('#tracks'); if(!tr)return false; const pps=state.tl.pxPerSec; const nodes=tr.querySelectorAll('.clip[data-clip]'); if(!nodes.length)return false;
  for(const nd of nodes){ const c=clipById(+nd.dataset.clip); if(!c)return false; nd.style.left=(c.start*pps)+'px'; nd.style.width=Math.max(14,c.dur*pps)+'px'; }
  return true; }
let _tlRaf=0; function scheduleTimeline(){ if(_tlRaf)return; _tlRaf=requestAnimationFrame(()=>{_tlRaf=0;
  if(drag&&(drag.mode==='trimL'||drag.mode==='trimR')&&positionClips()){ scheduleWaves(); scheduleAutoCvs(); return; } // full rebuild happens once, on pointerup
  renderTimeline(); }); }
function onTLUp(){ showSnap(null);
  if(drag&&drag.mode==='move'){ const applied=drag._applied||0; const tgt=drag._lane; const single=!(drag.items&&drag.items.length>1);
    const laneDelta=drag._laneDelta||0;
    const changed=drag._copy||Math.abs(applied)>1e-6||(single&&tgt!=null&&tgt!==drag.lane0)||laneDelta!==0; if(changed&&!drag._undone){pushUndo();drag._undone=true;} // only record undo if the move/copy actually changes something
    if(drag._copy){ const newIds=[];
      for(const it of drag.items){ const oc=clipById(it.id); if(!oc)continue; const nc=duplicateClipAt(oc, it.start0+applied, single?tgt:(oc.lane+laneDelta)); state.clips.push(nc); newIds.push(nc.id); }
      if(newIds.length){ state.selIds=newIds; state.selId=newIds[newIds.length-1]; state.selGroupId=null; }
      flashStatus(T('Copied','Copiado')+' '+drag.items.length+' '+(drag.items.length===1?T('clip','clip'):T('clips','clips')));
    } else { for(const it of drag.items){ const oc=clipById(it.id); if(oc){ oc.start=Math.max(0,it.start0+applied); if(!single)oc.lane=oc.lane+laneDelta; } }
      if(single){ const oc=clipById(drag.id); if(oc&&tgt!=null)oc.lane=tgt; } } }
  clearMoveGhosts(); drag=null; window.removeEventListener('pointermove',onTLMove); window.removeEventListener('pointerup',onTLUp); renderTimeline(); renderInspector(); render(); updStatus(); reschedAudio(); }
/* Ableton-style fade: drag the corner handle inward to set fadeIn/fadeOut. Applies to every selected clip (multi-track fade). */
function startFadeDrag(e,c,which){ e.preventDefault(); e.stopPropagation(); const x0=e.clientX, pps=state.tl.pxPerSec; let _undone=false;
  const sel=(state.selIds&&state.selIds.includes(c.id)&&state.selIds.length>1?state.selIds:[c.id]).map(id=>clipById(id)).filter(Boolean);
  const base=sel.map(cc=>({cc,f0:cc[which]||0}));
  const mv=ev=>{ const d=(ev.clientX-x0)/pps; if(d!==0&&!_undone){pushUndo();_undone=true;} for(const {cc,f0} of base){ let nf=(which==='fadeIn')?(f0+d):(f0-d); nf=Math.max(0,Math.min(cc.dur, nf)); cc[which]=nf; } scheduleTimeline(); render(); };
  const up=()=>{ window.removeEventListener('pointermove',mv); window.removeEventListener('pointerup',up); renderTimeline(); refreshInspector(); }; window.addEventListener('pointermove',mv); window.addEventListener('pointerup',up); }
/* core split (no undo/render) → reusable by the razor tool and the Ctrl+E multi-split */
function razorCore(c,tAbs){ if(tAbs<=c.start+0.02||tAbs>=c.start+c.dur-0.02)return null; const left=tAbs-c.start;
  // [R70] value continuity at the cut: insert a boundary keyframe on every automated param whose segment crosses the cut,
  // so neither half flattens/jumps. Bezier segments are subdivided with de Casteljau → the curve shape is preserved exactly.
  if(c.kf)for(const p in c.kf){ const ks=c.kf[p]; if(!ks||ks.length<2)continue; if(ks.some(k=>Math.abs(k.t-left)<1e-4))continue;
    let A=null,B=null; for(let i=0;i<ks.length-1;i++)if(left>ks[i].t&&left<ks[i+1].t){A=ks[i];B=ks[i+1];break;} if(!A)continue;
    const seg=B.t-A.t;
    if(A.e==='bezier'||A.hOut||B.hIn){ const oDt=A.hOut?Math.max(0,Math.min(seg,A.hOut.dt)):seg/3, oDv=A.hOut?A.hOut.dv:0;
      const iDt=B.hIn?Math.max(-seg,Math.min(0,B.hIn.dt)):-seg/3, iDv=B.hIn?B.hIn.dv:0;
      const P=[[A.t,A.v],[A.t+oDt,A.v+oDv],[B.t+iDt,B.v+iDv],[B.t,B.v]]; const lerp=(a,b,f)=>[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f];
      let lo=0,hi=1,u=(left-A.t)/seg,q01,q12,q23,r0,r1,s; // bisect for the bezier parameter whose X == cut (X is monotonic: control X are clamped inside the segment)
      for(let i=0;i<24;i++){ q01=lerp(P[0],P[1],u);q12=lerp(P[1],P[2],u);q23=lerp(P[2],P[3],u); r0=lerp(q01,q12,u);r1=lerp(q12,q23,u); s=lerp(r0,r1,u); if(s[0]<left)lo=u; else hi=u; u=(lo+hi)/2; }
      A.e='bezier'; A.hOut={dt:q01[0]-A.t,dv:q01[1]-A.v}; B.hIn={dt:q23[0]-B.t,dv:q23[1]-B.v};
      ks.push({t:left,v:s[1],e:'bezier',hIn:{dt:r0[0]-s[0],dv:r0[1]-s[1]},hOut:{dt:r1[0]-s[0],dv:r1[1]-s[1]}});
    } else ks.push({t:left,v:evalP(c,p,tAbs),e:A.e||'linear'});
    ks.sort((a,b)=>a.t-b.t); }
  const reb=(kfo,lo,hi,shift)=>{ const r={}; for(const p in (kfo||{})){ const a=kfo[p].filter(k=>k.t>=lo-1e-6&&k.t<=hi+1e-6).map(k=>{ const n={...k,t:Math.max(0,k.t-shift)}; if(n.hOut)n.hOut={...n.hOut}; if(n.hIn)n.hIn={...n.hIn}; return n; }); if(a.length)r[p]=a; } return r; }; // handles deep-copied — the two halves must never share handle objects
  const c2={...c,id:uid(),start:tAbs,dur:c.dur-left,inP:c.inP+left*(c.speed||1),maskTex:null,_penCv:null,penMasks:c.penMasks?JSON.parse(JSON.stringify(c.penMasks)):undefined,props:{...c.props},kf:reb(c.kf,left,Infinity,left),fx:JSON.parse(JSON.stringify(c.fx||[])),fadeIn:0}; sepAuto(c2,c); // [R92-T4 F6] inP advances in SOURCE seconds (left×speed)
  if(Array.isArray(c2.anim)) c2.anim=c2.anim.map(aa=>({...aa,wetKf:Array.isArray(aa.wetKf)?aa.wetKf.map(k=>({...k,t:k.t-left})).filter(k=>k.t>=-1e-6):aa.wetKf})); // [R92-T4 F11] right half's wet ramps rebased like kf
  if(c2.maskData||(c2.penMasks&&c2.penMasks.length))rebuildMaskTex(c2); c.kf=reb(c.kf,0,left,0); c.dur=left; c.fadeOut=0; state.clips.push(c2); return c2; } // drop the fades that now land at the cut: left half keeps only its fadeIn, right half only its fadeOut
function razorClip(c,tAbs){ if(tAbs<=c.start+0.02||tAbs>=c.start+c.dur-0.02)return; pushUndo(); razorCore(c,tAbs); renderTimeline(); render(); reschedAudio(); }
/* Ctrl+E — Ableton-style Split: cut every clip crossing the time-selection boundaries (or the playhead if no range) */
function splitAtSelection(){ const s=state.tl; const hasRange=s.selA!=null&&s.selB!=null&&Math.abs(s.selB-s.selA)>1e-3; const hasInsert=s.selA!=null&&!hasRange;
  const times=hasRange?[Math.min(s.selA,s.selB),Math.max(s.selA,s.selB)]:(hasInsert?[s.selA]:[state.playhead]); // range → cut both edges; single insert line → cut there; nothing selected → cut at the playhead
  const laneSet=((hasRange||hasInsert)&&s.selLanes&&s.selLanes.length)?new Set(s.selLanes):null; // if the selection/insert was on specific lanes, only cut those
  const crosses=(c,t)=>t>c.start+0.02&&t<c.start+c.dur-0.02&&(!laneSet||laneSet.has(c.lane));
  if(!times.some(t=>state.clips.some(c=>crosses(c,t)))){ flashStatus(T('Nothing to split here','Nada que cortar aquí')); return; }
  pushUndo(); let n=0; for(const t of times){ for(const c of state.clips.filter(x=>crosses(x,t))){ if(razorCore(c,t))n++; } }
  renderTimeline(); render(); markDirty(); reschedAudio(); flashStatus(n+' '+(n===1?T('cut','corte'):T('cuts','cortes'))); }
function tlZoomAt(e,dir){ const sc=$('#tlscroll'); const rect=sc.getBoundingClientRect(); const off=e.clientX-rect.left; const tt=(off+sc.scrollLeft)/state.tl.pxPerSec;
  state.tl.pxPerSec=Math.max(TL_PPS_MIN,Math.min(TL_PPS_MAX,state.tl.pxPerSec*(dir>0?1.25:0.8))); // 0.1 floor: zoom out far enough to fit a whole feature-length clip (R82); 2400 ceiling: deep enough for per-frame trim [T2]
  const nx=Math.max(0,tt*state.tl.pxPerSec-off);
  // publish the target scroll so neededSec()/W grow to cover it DURING this render (setting scrollLeft first would clamp to the old, narrower width); then apply nx — no clamp → the time under the cursor stays fixed
  state.tl._scrollTarget=nx; renderTimeline(); sc.scrollLeft=nx; state.tl._scrollTarget=0; }
/* [T3] custom Premiere-style zoom-scrollbar: the thumb spans the visible time window over the whole content; its body
   drags to scroll, its circular end-caps drag to zoom (anchored to the opposite edge). Native h-scrollbar is hidden. */
function renderZoomBar(){ const sc=$('#tlscroll'), bar=$('#tlZoomBar'), track=$('#tlZoomTrack'), thumb=$('#tlZoomThumb'); if(!sc||!bar||!track||!thumb)return;
  const barR=bar.getBoundingClientRect(), scR=sc.getBoundingClientRect(); if(!scR.width)return;
  track.style.left=(scR.left-barR.left)+'px'; track.style.width=scR.width+'px'; // align the track under the #tlscroll viewport (offset past toolrail + header column)
  const w=scR.width, sw=Math.max(1,sc.scrollWidth), cw=Math.max(1,sc.clientWidth), sl=sc.scrollLeft||0;
  const thumbW=Math.max(24,Math.min(1,cw/sw)*w), maxSL=Math.max(0,sw-cw), travel=Math.max(0,w-thumbW);
  thumb.style.width=thumbW+'px'; thumb.style.left=(maxSL>0?(sl/maxSL)*travel:0).toFixed(1)+'px'; }
function startZoomBarDrag(e){ if(e.button!==0||e.target.classList.contains('tlzcap'))return; e.preventDefault(); // body drag = scroll
  const sc=$('#tlscroll'), track=$('#tlZoomTrack'), thumb=$('#tlZoomThumb'); const w=track.getBoundingClientRect().width;
  const sw=Math.max(1,sc.scrollWidth), cw=Math.max(1,sc.clientWidth), maxSL=Math.max(0,sw-cw); const thumbW=Math.max(24,Math.min(1,cw/sw)*w), travel=Math.max(1,w-thumbW);
  const x0=e.clientX, sl0=sc.scrollLeft; thumb.classList.add('drag');
  const mv=ev=>{ sc.scrollLeft=Math.max(0,Math.min(maxSL, sl0+((ev.clientX-x0)/travel)*maxSL)); }; // the scroll handler repaints ruler/waves/header + the bar
  const up=()=>{ thumb.classList.remove('drag'); window.removeEventListener('pointermove',mv); window.removeEventListener('pointerup',up); }; window.addEventListener('pointermove',mv); window.addEventListener('pointerup',up); }
function startZoomCapDrag(e,side){ e.preventDefault(); e.stopPropagation(); // end-cap drag = zoom, keeping the OPPOSITE edge's time fixed
  const sc=$('#tlscroll'), track=$('#tlZoomTrack'); const w=Math.max(1,track.getBoundingClientRect().width);
  const pps0=state.tl.pxPerSec, sl0=sc.scrollLeft, cw=Math.max(1,sc.clientWidth), sw0=Math.max(1,sc.scrollWidth);
  const totalDur=sw0/pps0, tLeft=sl0/pps0, tRight=(sl0+cw)/pps0, minWin=(cw/TL_PPS_MAX); const x0=e.clientX;
  const mv=ev=>{ const dDur=((ev.clientX-x0)/w)*totalDur; // bar-px → content-seconds (track width = whole content)
    let nLeft=tLeft, nRight=tRight;
    if(side==='r') nRight=Math.max(tLeft+minWin, tRight+dDur); else nLeft=Math.max(0,Math.min(tRight-minWin, tLeft+dDur));
    const winDur=Math.max(1e-4,nRight-nLeft); let nPps=Math.max(TL_PPS_MIN,Math.min(TL_PPS_MAX,cw/winDur));
    const nSL=Math.max(0,(side==='r'?tLeft:nLeft)*nPps); // anchor: right-cap keeps left edge, left-cap keeps right edge (via recomputed nLeft)
    state.tl.pxPerSec=nPps; state.tl._scrollTarget=nSL; renderTimeline(); sc.scrollLeft=nSL; state.tl._scrollTarget=0; };
  const up=()=>{ window.removeEventListener('pointermove',mv); window.removeEventListener('pointerup',up); markDirty(); }; window.addEventListener('pointermove',mv); window.addEventListener('pointerup',up); }
(function wireZoomBar(){ const thumb=$('#tlZoomThumb'); if(!thumb)return; thumb.addEventListener('pointerdown',startZoomBarDrag);
  $$('#tlZoomThumb .tlzcap').forEach(cap=>cap.addEventListener('pointerdown',e=>startZoomCapDrag(e,cap.dataset.cap))); renderZoomBar(); })();
/* pan tool */
function startPan(e){ const sl=$('#tlscroll'); const x0=e.clientX,s0=sl.scrollLeft; const mv=ev=>{sl.scrollLeft=s0-(ev.clientX-x0);}; const up=()=>{window.removeEventListener('pointermove',mv);window.removeEventListener('pointerup',up);}; window.addEventListener('pointermove',mv);window.addEventListener('pointerup',up); }
/* marquee multi-select: drag a rectangle over empty timeline to select the clips it touches */
function startMarquee(e){ const tr=$('#tracks'); const box=document.createElement('div'); box.style.cssText='position:absolute;border:1px solid #C9CDD3;background:rgba(201,205,211,0.14);z-index:8;pointer-events:none;'; tr.appendChild(box); const x0=e.clientX,y0=e.clientY;
  const upd=ev=>{ const r=tr.getBoundingClientRect(); box.style.left=(Math.min(x0,ev.clientX)-r.left)+'px'; box.style.top=(Math.min(y0,ev.clientY)-r.top)+'px'; box.style.width=Math.abs(ev.clientX-x0)+'px'; box.style.height=Math.abs(ev.clientY-y0)+'px'; }; upd(e);
  const up=ev=>{ window.removeEventListener('pointermove',upd); window.removeEventListener('pointerup',up); const r=tr.getBoundingClientRect(); const pps=state.tl.pxPerSec;
    const tA=(Math.min(x0,ev.clientX)-r.left)/pps, tB=(Math.max(x0,ev.clientX)-r.left)/pps, yA=Math.min(y0,ev.clientY)-r.top, yB=Math.max(y0,ev.clientY)-r.top;
    const sel=[]; for(const rowEl of $$('#tracks .lane')){ const rr=rowEl.getBoundingClientRect(); const top=rr.top-r.top, bot=rr.bottom-r.top; if(bot<yA||top>yB)continue; const li=+rowEl.dataset.lane; for(const c of state.clips){ if(c.lane===li && c.start+c.dur>=tA && c.start<=tB) sel.push(c.id); } } // [R92-T9] viewport-rect (not offsetTop) — robust to the audio rows being nested in the sticky #audioZone
    box.remove(); state.selIds=sel; state.selId=sel[sel.length-1]||null; state.selGroupId=null; renderTimeline(); renderInspector(); updStatus(); };
  window.addEventListener('pointermove',upd); window.addEventListener('pointerup',up); }
/* ruler: scrub playhead, or select + drag a locator (with snapping) */
$('#ruler').addEventListener('pointerdown',e=>{ if(e.button!==0)return;
  const xAt=ev=>ev.clientX-$('#ruler').getBoundingClientRect().left; // ruler is position:sticky → its rect.left already reflects horizontal scroll; adding scrollLeft double-counted it (playhead offset grew with zoom/scroll)
  const t0=Math.max(0,xAt(e)/state.tl.pxPerSec); const tol=8/state.tl.pxPerSec;
  const mk=state.markers.find(m=>Math.abs(m.time-t0)<tol);
  if(mk){ // select & drag locator
    state.selMarkerId=mk.id; pushUndo(); renderTimeline();
    const move=ev=>{ let nt=Math.max(0,xAt(ev)/state.tl.pxPerSec); const sn=applySnap(nt,mk.id); mk.time=sn.val; showSnap(sn.snap); scheduleTimeline(); };
    const up=()=>{ window.removeEventListener('pointermove',move); window.removeEventListener('pointerup',up); showSnap(null); state.markers.sort((a,b)=>a.time-b.time); renderTimeline(); };
    window.addEventListener('pointermove',move); window.addEventListener('pointerup',up); return; }
  if(state.selMarkerId!=null){ state.selMarkerId=null; renderTimeline(); }
  if(state.tl.selA!=null){ state.tl.selA=state.tl.selB=null; state.tl.selLanes=null; renderTimeSel(); } // scrubbing the ruler clears the timeline insert/selection → play resumes from the scrubbed playhead
  const go=ev=>{ state.playhead=frameSnap(xAt(ev)/state.tl.pxPerSec); scrubRender(); }; go(e); /* [T7] scrub snaps to frame grid */
  const up=()=>{window.removeEventListener('pointermove',go);window.removeEventListener('pointerup',up);}; window.addEventListener('pointermove',go);window.addEventListener('pointerup',up); });
/* rename a locator INLINE, over its own label on the ruler (not in a floating dialog) */
function renameLocatorInline(mk){ if(!mk)return; state.selMarkerId=mk.id; renderTimeline();
  const rr=$('#ruler').getBoundingClientRect(); const pps=state.tl.pxPerSec;
  const inp=document.createElement('input'); inp.type='text'; inp.spellcheck=false; inp.value=mk.name||'';
  const sx=Math.max(2,Math.min(innerWidth-96,rr.left+mk.time*pps+11)), sy=rr.top+1; // +11 = the label's x-offset in drawRuler
  inp.style.cssText='position:fixed;z-index:9999;left:'+sx+'px;top:'+sy+'px;height:'+Math.max(15,rr.height-3)+'px;min-width:74px;box-sizing:border-box;font:600 9px Inter,system-ui,sans-serif;color:var(--ink);background:var(--s0);border:.5px solid #C9CDD3;border-radius:2px;box-shadow:0 0 0 2px rgba(201,205,211,0.25);padding:0 4px;outline:none;';
  document.body.appendChild(inp); inp.focus(); inp.select();
  let done=false; const fin=ok=>{ if(done)return; done=true; if(ok){ const v=inp.value.trim(); if(v&&v!==mk.name){ pushUndo(); mk.name=v; renderTimeline(); markDirty(); } } inp.remove(); };
  inp.addEventListener('keydown',e=>{ e.stopPropagation(); if(e.key==='Enter'){e.preventDefault();fin(true);} else if(e.key==='Escape'){e.preventDefault();fin(false);} });
  inp.addEventListener('blur',()=>fin(true)); }
$('#ruler').addEventListener('dblclick',e=>{ const t=Math.max(0,(e.clientX-$('#ruler').getBoundingClientRect().left)/state.tl.pxPerSec); const tol=8/state.tl.pxPerSec;
  const mk=state.markers.find(m=>Math.abs(m.time-t)<tol);
  if(mk){ renameLocatorInline(mk); }
  else { pushUndo(); const nm={id:uid(),time:t,name:T('Locator','Localizador'),color:'#B4BAC1'}; state.markers.push(nm); state.markers.sort((a,b)=>a.time-b.time); state.selMarkerId=nm.id; renderTimeline(); } });
/* [R93b] video and audio are INDEPENDENT places: the wheel acts only on the section under the pointer.
   plain = scroll that section (video = #tlscroll, audio = inside its pinned module) · Alt = vertical zoom of
   that section's tracks only · Ctrl = timeline zoom · Shift = horizontal. */
function wheelResizeLanes(e,inAudio){ const f=e.deltaY<0?1.1:1/1.1; for(const l of state.lanes){ if((l.kind==='audio')!==inAudio)continue; if(l.collapsed)l.collapsed=false; l.h=Math.max(LANE_MIN_H,Math.min(LANE_MAX_H,Math.round((l.h||LANE_DEF_H)*f))); } scheduleTimeline(); }
function audioZoneScrollBy(dy){ const az=document.querySelector('#tracks .audiozone'); if(!az)return; az.scrollTop+=dy; state.tl._audioScroll=az.scrollTop; const ah=$('#audioHeadZone'); if(ah)ah.scrollTop=az.scrollTop; } // sync + persist immediately (the 'scroll' event fires async — waiting on it lagged the header column a frame)
$('#tlscroll').addEventListener('wheel',e=>{ const inAudio=!!e.target.closest('.audiozone');
  if(e.ctrlKey||e.metaKey){e.preventDefault();tlZoomAt(e,e.deltaY<0?1:-1);}
  else if(e.altKey){ e.preventDefault(); wheelResizeLanes(e,inAudio); } // Alt = resize only THIS section's tracks
  else if(e.shiftKey){e.preventDefault();$('#tlscroll').scrollLeft+=e.deltaY;}
  else if(inAudio){ e.preventDefault(); audioZoneScrollBy(e.deltaY); } },{passive:false}); // wheel over audio NEVER moves the video area (plain wheel over video keeps native vertical scroll — audio stays pinned)
/* scroll over the track-name sidebar: same per-section independence */
$('#trackHdr').addEventListener('wheel',e=>{ e.preventDefault(); const inAudio=!!e.target.closest('.audiozone');
  if(e.altKey){ wheelResizeLanes(e,inAudio); return; }
  if(inAudio)audioZoneScrollBy(e.deltaY); else $('#tlscroll').scrollTop+=e.deltaY; },{passive:false});
$('#trackHdr').addEventListener('contextmenu',e=>{ if(e.target.closest('.lanehdr'))return; e.preventDefault(); openMenu(e.clientX,e.clientY,trackCreateItems()); });
function neededSec(){ const sc=$('#tlscroll'); const screen=(sc.clientWidth||800)/state.tl.pxPerSec; const scl=Math.max(sc.scrollLeft, state.tl._scrollTarget||0); return Math.max(duration()+screen, (scl/state.tl.pxPerSec)+screen*1.6); }
$('#tlscroll').addEventListener('scroll',()=>{ const th=$('#trackHdr'); if(th)th.scrollTop=$('#tlscroll').scrollTop; if(neededSec()>(state.tl._w||0)+0.01)renderTimeline(); else { drawRuler(); renderWork(); renderTimeSel(); } positionWorkBrace(); scheduleWaves(); if(state.inlineCurves)scheduleAutoCvs(); renderZoomBar(); }); // [T3] keep the custom zoom-scrollbar thumb in sync with scroll // [R92-T9] header column now scrolls NATIVELY in sync (was a transform) so its sticky audio module pins exactly like the tracks' one
/* middle-mouse drag pans the timeline on both axes (Hand-like), regardless of active tool */
$('#tlscroll').addEventListener('pointerdown',e=>{ if(e.button!==1)return; e.preventDefault(); const sl=$('#tlscroll'); const x0=e.clientX,y0=e.clientY,sx=sl.scrollLeft,sy=sl.scrollTop; sl.style.cursor='grabbing';
  const mv=ev=>{ sl.scrollLeft=sx-(ev.clientX-x0); sl.scrollTop=sy-(ev.clientY-y0); }; const up=()=>{ sl.style.cursor=''; window.removeEventListener('pointermove',mv); window.removeEventListener('pointerup',up); }; window.addEventListener('pointermove',mv); window.addEventListener('pointerup',up); });
const RAZOR_CUR="url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"22\" height=\"22\" viewBox=\"0 0 22 22\"><line x1=\"11\" y1=\"1\" x2=\"11\" y2=\"21\" stroke=\"%233CE0D6\" stroke-width=\"2\"/><path d=\"M7 1 L11 5 L15 1 Z\" fill=\"%233CE0D6\"/></svg>') 11 11, crosshair";
function applyToolCursor(){ const cur={select:'default',trackselect:'e-resize',hand:'grab',razor:RAZOR_CUR,zoom:'zoom-in',trim:'col-resize'}[state.tl.tool]; $('#tracks').style.cursor=cur; $('#ruler').style.cursor='pointer';
  const sel=(state.tl.tool==='select'); $$('.clip').forEach(c=>c.style.cursor=sel?(state.tl.simpleClips?'grab':'default'):cur); } // select: body = arrow (the .tt headband keeps grab via CSS → hand only on the title bar) · [R94c] simple-clip view: the whole block grabs (inline style beats the CSS rule, so it must be set here)

/* media drag to timeline */
function startMediaDrag(e,m){ const ghost=e.currentTarget.cloneNode(true); ghost.style.cssText='position:fixed;pointer-events:none;z-index:80;opacity:.85;width:200px;left:'+e.clientX+'px;top:'+e.clientY+'px;background:var(--s1);border-radius:2px;padding:6px;';document.body.appendChild(ghost);
  const tracks=$('#tracks'); const wantKind=(m.kind==='audio')?'audio':'video'; const dur=m.dur||6; let tlg=null;
  const landing=ev=>{ const el=document.elementFromPoint(ev.clientX,ev.clientY); const laneEl=el&&el.closest('.lane'); if(!laneEl)return null; const li=+laneEl.dataset.lane; if(!state.lanes[li]||state.lanes[li].kind!==wantKind)return null;
    const rect=tracks.getBoundingClientRect(); let start=Math.max(0,(ev.clientX-rect.left)/state.tl.pxPerSec); const sn=applySnap(start,null); start=Math.max(0,sn.val); return {li,laneEl,start,snap:sn.snap}; };
  const folderAt=ev=>{ const el=document.elementFromPoint(ev.clientX,ev.clientY); if(!el)return null; const fe=el.closest&&el.closest('.folderhdr,.folderdrop,.mitem'); if(!fe)return null; if(fe.classList.contains('mitem')){ const om=mediaById(+fe.dataset.id); return (om&&om.folder)?om.folder:(om?null:undefined); } return fe.dataset.fname||null; }; // over a folder header/drop-zone → its name; over an item → that item's folder; '' means Unfiled area
  const clearFH=()=>{ $$('#mediaList .folderhdr.dragover,#mediaList .folderdrop.dragover').forEach(x=>x.classList.remove('dragover')); };
  const mv=ev=>{ ghost.style.left=(ev.clientX+8)+'px';ghost.style.top=(ev.clientY+8)+'px'; const L=landing(ev);
    if(L){ if(!tlg){ tlg=document.createElement('div'); tracks.appendChild(tlg); } tlg.className='moveghost';
      tlg.style.cssText='position:absolute;pointer-events:none;z-index:30;border:1px solid rgba(255,255,255,0.7);background:'+m.color+';opacity:.42;border-radius:2px;box-shadow:0 2px 8px rgba(0,0,0,0.4);overflow:hidden;';
      tlg.style.left=(L.start*state.tl.pxPerSec)+'px'; tlg.style.top=(L.laneEl.offsetTop+4)+'px'; tlg.style.width=Math.max(14,dur*state.tl.pxPerSec)+'px'; tlg.style.height=(L.laneEl.offsetHeight-8)+'px';
      tlg.innerHTML='<div style="position:absolute;left:0;top:0;right:0;height:15px;line-height:15px;font:600 10px Geist;padding:0 5px;color:'+textOn(m.color)+';background:'+m.color+';white-space:nowrap;overflow:hidden;">'+m.name+'</div>';
      ghost.style.opacity='.35'; showSnap(L.snap); clearFH(); }
    else { if(tlg){tlg.remove();tlg=null;} ghost.style.opacity='.85'; showSnap(null); // highlight the folder / back tile / grid background under the cursor (R88 drop target)
      _clearDropFX(); const t=_dropTargetAt(ev); if(t)t.el.classList.add('dragover'); } };
  const up=ev=>{ window.removeEventListener('pointermove',mv);window.removeEventListener('pointerup',up); ghost.remove(); if(tlg)tlg.remove(); showSnap(null); _clearDropFX();
    const L=landing(ev); if(L){ // [M5] drop the whole selection: Ctrl = stack onto lanes below, default = side by side on the same lane
      const ids=selectedMediaIds(); const sel=(ids.length>1&&ids.includes(m.id))?ids.map(mediaById).filter(x=>x&&(((x.kind==='audio')?'audio':'video')===wantKind)):null;
      if(sel&&sel.length>1){ if(ev.ctrlKey||ev.metaKey){ let li=L.li; for(const mm of sel){ while(li<state.lanes.length&&state.lanes[li]&&state.lanes[li].kind!==wantKind)li++; const target=(li<state.lanes.length)?li:null; addClip(mm,target,L.start); li=(target==null?state.lanes.length:li+1); } }
        else { let start=L.start; for(const mm of sel){ addClip(mm,L.li,start); start+=(mm.dur||6); } } }
      else addClip(m,L.li,L.start); return; }
    { const t=_dropTargetAt(ev); if(t){ const ids=selectedMediaIds().includes(m.id)?selectedMediaIds():[m.id]; const dest=t.path||null; if(ids.some(id=>{const mm=mediaById(id);return mm&&(mm.folder||null)!==dest;}))moveMediaTo(ids,dest); return; } } // R88: dropped on a folder / back / grid bg → file the (multi-)selection there
    if(m.kind==='audio'){ const el2=document.elementFromPoint(ev.clientX,ev.clientY); if(el2&&el2.closest('#tlscroll')){ const tr=tracks.getBoundingClientRect(); let start=Math.max(0,(ev.clientX-tr.left)/state.tl.pxPerSec); const sn=applySnap(start,null); start=Math.max(0,sn.val); addClip(m,null,start); } } }; // audio dropped without an audio track → auto-create one and drop there
  window.addEventListener('pointermove',mv);window.addEventListener('pointerup',up); }

/* ===================== VIEWPORT INTERACTION ===================== */
let vdrag=null, _flatHandles=null;
function setVpCursor(){ gridc.style.cursor = vdrag&&(vdrag.mode==='pan'||vdrag.mode==='orbit')?'grabbing':(vdrag&&vdrag.mode==='resizeFlat'?vdrag.cur:(state.view.mode==='3d'?'grab':'default')); }
/* which resize handle (if any) is under the cursor — returns {sx,sy} in {-1,0,1}² or null */
function flatHandleHit(px,py){ if(!_flatHandles)return null; for(const h of _flatHandles){ if(Math.abs(px-h.px)<=6 && Math.abs(py-h.py)<=6)return h; } return null; }
function _resizeCursor(sx,sy){ if(sx&&sy)return (sx*sy>0)?'nesw-resize':'nwse-resize'; return sx?'ew-resize':'ns-resize'; } // frame Y is up, screen Y is down → the diagonal cursor is flipped vs frame-space sign
/* 360-room snap targets in flat-frame coords (−1..1): vertical seams = wall x0/x1 + strip edges; horizontal = wall pxH bottoms + strip edges */
function roomSeamX(){ const as=activeSeq(),room=as&&as.room; const out=[-1,0,1]; if(room){ const sw=as.w||1; for(const w of room.walls)out.push(w.x0/sw*2-1, w.x1/sw*2-1, (w.x0+w.x1)/sw-1); } return out; } // strip edges + h-center + each wall's edges AND its horizontal centre
function roomSeamY(){ const as=activeSeq(),room=as&&as.room; const out=[-1,0,1]; if(room){ const sh=as.h||1; for(const w of room.walls){ out.push(1-2*w.pxH/sh, 1-w.pxH/sh); } } return out; } // strip edges + v-center + each wall's bottom AND its vertical centre (pxH/2 from top)
/* "Mask to wall": GL scissor rects (in the current square FBO) for the selected wall roles → the clip only paints inside those walls' strip regions. */
function roomWallScissorRects(roles){ const as=activeSeq(),room=as&&as.room; if(!room)return []; const vp=gl.getParameter(gl.VIEWPORT); const size=vp[2]||1; const sw=as.w||1, Fy=Math.min(1,(as.h||1)/sw); const out=[];
  for(const w of room.walls){ if(!roles.includes(w.role))continue; const x0=Math.round(w.x0/sw*size), x1=Math.round(w.x1/sw*size);
    const yTop=Math.round((Fy*0.5+0.5)*size), yBot=Math.round(((Fy-2*w.pxH/sw)*0.5+0.5)*size);
    out.push({x:x0,y:yBot,w:Math.max(1,x1-x0),h:Math.max(1,yTop-yBot)}); }
  return out; }
function snapFrame(v,seams,bypass){ if(bypass)return v; const thr=0.018/Math.max(0.2,state.view.zoom); let best=v,bd=thr; for(const s of seams){ const d=Math.abs(s-v); if(d<bd){bd=d;best=s;} } return best; }
function snapMoveAxis(center,half,seams,bypass){ if(bypass)return center; const thr=0.018/Math.max(0.2,state.view.zoom); let best=center,bd=thr; for(const s of seams)for(const edge of [center-half,center,center+half]){ const d=Math.abs(s-edge); if(d<bd){bd=d;best=center+(s-edge);} } return best; } // snap the clip's near edge OR center to a wall seam
/* capture base geometry for a corner/edge resize; the OPPOSITE handle stays fixed in frame space */
function beginFlatResize(c,h){ pushUndo(); const m=mediaById(c.mediaId),t=state.playhead; const M=flatMap(); const P=flatPlace(c,m,t);
  const fx0=Math.hypot(P.fx[0],P.fx[1]), fy0=Math.hypot(P.fy[0],P.fy[1]);
  const rot=(evalR(c,'rot',t)||0)*D2R, u=[Math.cos(rot),Math.sin(rot)], v=[-Math.sin(rot),Math.cos(rot)];
  const anchor=[P.fc[0]-h.sx*P.fx[0]-h.sy*P.fy[0], P.fc[1]-h.sx*P.fx[1]-h.sy*P.fy[1]]; // opposite handle
  const scale0=Math.max(0.001,(evalR(c,'scale',t)||100)/100), sxm0=(c.props.scaleX==null?1:c.props.scaleX), sym0=(c.props.scaleY==null?1:c.props.scaleY);
  return {mode:'resizeFlat',id:c.id,sx:h.sx,sy:h.sy,Fx:M.Fx,Fy:M.Fy,fx0,fy0,u,v,anchor,scale0,sxm0,sym0,cur:_resizeCursor(h.sx,h.sy)}; }
gridc.addEventListener('pointerdown',e=>{ const r=gridc.getBoundingClientRect(); const px=e.clientX-r.left,py=e.clientY-r.top; const mid=(e.button===1); if(mid)e.preventDefault(); clearMediaSel(); // touching the viewport hands Delete-priority back to the timeline (R86)
  if(state.view.mode==='3d'){ vdrag={mode:'orbit',x:e.clientX,y:e.clientY,yaw:state.view.cam.yaw,pitch:state.view.cam.pitch}; }
  else { // 2D: middle/shift drag pans (Hand-like); left click selects+moves element, else pans
    if(mid||e.shiftKey){ vdrag={mode:'pan',x:e.clientX,y:e.clientY,pan:[...state.view.pan]}; }
    else if(isFlat()){ // R88: 2D — ONLY the timeline-selected clip is draggable (so an overlapping clip on top can't hijack the drag; pick the one below via the timeline, then move it here)
      const sel=selClip();
      const hh=(sel && !sel.adjust)?flatHandleHit(px,py):null;
      if(hh){ vdrag=beginFlatResize(sel,hh); } // Photoshop-style corner/edge resize (opposite handle stays fixed)
      else if(sel && !sel.adjust && flatRectHit(sel,px,py)){ pushUndo(); vdrag={mode:'elemFlat',id:sel.id}; }
      else vdrag={mode:'pan',x:e.clientX,y:e.clientY,pan:[...state.view.pan]}; } // [R94e] the viewport never re-picks: selection comes from the timeline, so a clip under other layers stays draggable
    else { // dome 2D: same rule — only the timeline-selected clip is draggable (no hit-test stealing by the top layer)
      const sel=selClip(); const selHit=(sel&&!sel.adjust)?domeClipHit(sel,px,py):false;
      if(selHit){ pushUndo(); vdrag={mode:'elem',id:sel.id}; } else vdrag={mode:'pan',x:e.clientX,y:e.clientY,pan:[...state.view.pan]}; }
  }
  setVpCursor(); try{gridc.setPointerCapture(e.pointerId);}catch(_){}
});
gridc.addEventListener('pointermove',e=>{ if(!vdrag){ if(isFlat()&&state.view.mode!=='3d'&&_flatHandles){ const r0=gridc.getBoundingClientRect(); const h=flatHandleHit(e.clientX-r0.left,e.clientY-r0.top); gridc.style.cursor=h?_resizeCursor(h.sx,h.sy):'default'; } return; } const r=gridc.getBoundingClientRect(); const px=e.clientX-r.left,py=e.clientY-r.top;
  if(vdrag.mode==='orbit'){ const inv=(isRoom()&&state.view.three==='spec')?-1:1; state.view.cam.yaw=vdrag.yaw-(e.clientX-vdrag.x)*0.0065*inv; state.view.cam.pitch=Math.max(-HALF_PI+0.02,Math.min(HALF_PI-0.02,vdrag.pitch+(e.clientY-vdrag.y)*0.0065*inv)); render(); } // 3D-room Viewer = first-person look → invert drag
  else if(vdrag.mode==='pan'){ const S=Math.min(view.cw,view.ch); const d=[(e.clientX-vdrag.x)/(S/2),-(e.clientY-vdrag.y)/(S/2)]; state.view.pan=[vdrag.pan[0]-d[0]/state.view.zoom,vdrag.pan[1]-d[1]/state.view.zoom]; render(); }
  else if(vdrag.mode==='elem'){ const c=clipById(vdrag.id); if(!c)return; const f=pix2f(px,py); const ae=f2azel(f[0],f[1]);
    manualEdit(c,'az',ae.az); manualEdit(c,'el',ae.el); refreshInspector(); renderTimeline(); render(); updStatus(); }
  else if(vdrag.mode==='elemFlat'){ const c=clipById(vdrag.id); if(!c)return; const m=mediaById(c.mediaId); const fp=pix2frame(px,py); let nx=fp[0],ny=fp[1];
    if(isRoom()&&m){ const P=flatPlace(c,m,state.playhead),M=flatMap(); const hwx=(Math.abs(P.fx[0])+Math.abs(P.fy[0]))/M.Fx, hhy=(Math.abs(P.fx[1])+Math.abs(P.fy[1]))/M.Fy; nx=snapMoveAxis(fp[0],hwx,roomSeamX(),e.altKey); ny=snapMoveAxis(fp[1],hhy,roomSeamY(),e.altKey); }
    manualEdit(c,'x',Math.max(-150,Math.min(150,Math.round(nx*1000)/10))); manualEdit(c,'y',Math.max(-150,Math.min(150,Math.round(ny*1000)/10))); refreshInspector(); renderTimeline(); render(); updStatus(); }
  else if(vdrag.mode==='resizeFlat'){ const c=clipById(vdrag.id); if(!c)return; const d=vdrag;
    let fp=pix2frame(px,py); if(isRoom()){ fp=[snapFrame(fp[0],roomSeamX(),e.altKey), snapFrame(fp[1],roomSeamY(),e.altKey)]; }
    const q=[fp[0]*d.Fx,fp[1]*d.Fy], rel=[q[0]-d.anchor[0],q[1]-d.anchor[1]];
    const pu=rel[0]*d.u[0]+rel[1]*d.u[1], pv=rel[0]*d.v[0]+rel[1]*d.v[1];
    let nfx=d.fx0,nfy=d.fy0; if(d.sx!==0)nfx=Math.max(0.004,pu/(2*d.sx)); if(d.sy!==0)nfy=Math.max(0.004,pv/(2*d.sy));
    const corner=(d.sx!==0&&d.sy!==0);
    if(corner&&!e.shiftKey){ const k=nfx/d.fx0; nfy=d.fy0*k; manualEdit(c,'scale',Math.round(d.scale0*k*1000)/10); } // uniform corner (Shift = free aspect)
    else { if(d.sx!==0)c.props.scaleX=Math.max(0.01,d.sxm0*(nfx/d.fx0)); if(d.sy!==0)c.props.scaleY=Math.max(0.01,d.sym0*(nfy/d.fy0)); }
    const cx=d.anchor[0]+d.sx*nfx*d.u[0]+d.sy*nfy*d.v[0], cy=d.anchor[1]+d.sx*nfx*d.u[1]+d.sy*nfy*d.v[1];
    manualEdit(c,'x',Math.max(-300,Math.min(300,Math.round(cx/d.Fx*1000)/10))); manualEdit(c,'y',Math.max(-300,Math.min(300,Math.round(cy/d.Fy*1000)/10)));
    markDirty(); refreshInspector(); renderTimeline(); render(); updStatus(); }
});
function endVdrag(){ vdrag=null; setVpCursor(); }
gridc.addEventListener('pointerup',endVdrag); gridc.addEventListener('pointercancel',endVdrag); window.addEventListener('pointerup',()=>{ if(vdrag)endVdrag(); });
gridc.addEventListener('contextmenu',e=>{ if(state.view.mode==='3d')e.preventDefault(); });
gridc.addEventListener('wheel',e=>{ e.preventDefault();
  if(state.view.mode==='3d'){ if(state.view.three==='spec'){state.view.cam.back=Math.max(-0.9,Math.min(2.4,state.view.cam.back+e.deltaY*0.0016));$('#dollyRange').value=state.view.cam.back;$('#dollyLbl').textContent=state.view.cam.back.toFixed(1);} else {state.view.cam.dist=Math.max(1.2,Math.min(12,state.view.cam.dist*Math.exp(e.deltaY*0.0012)));const dr=$('#distRange');if(dr){dr.value=state.view.cam.dist;const dl=$('#distLbl');if(dl)dl.textContent=state.view.cam.dist.toFixed(1);}} render(); return; }
  const r=gridc.getBoundingClientRect();const px=e.clientX-r.left,py=e.clientY-r.top;const fu=pix2f(px,py); // fisheye point under cursor (pre-zoom)
  state.view.zoom=Math.max(0.2,Math.min(12,state.view.zoom*Math.exp(-e.deltaY*0.0015)));const af=pix2f(px,py);state.view.pan=[state.view.pan[0]+fu[0]-af[0],state.view.pan[1]+fu[1]-af[1]];vzLbl();render(); },{passive:false});
function pix2frame(px,py){ const A=(state.seqW||16)/(state.seqH||9), wa=view.cw/view.ch; let sx,sy; if(A>=wa){sx=1;sy=wa/A;}else{sy=1;sx=A/wa;} const z=state.view.zoom,p=state.view.pan; const ndx=(px/view.cw*2-1), ndy=(1-py/view.ch)*2-1; return [ndx/(z*sx)+p[0], ndy/(z*sy)+p[1]]; } // viewport px → flat frame coord (−1..1)
function pickClipFlat(px,py){ const fp=pix2frame(px,py), fx=fp[0],fy=fp[1]; const A=(state.seqW||16)/(state.seqH||9), Fx=Math.min(1,A),Fy=Math.min(1,1/A), t=state.playhead; let hit=null;
  for(const c of activeClips(t)){ const m=mediaById(c.mediaId); if(!m||m.kind==='audio')continue; const P=flatPlace(c,m,t);
    const cx=P.fc[0]/Fx, cy=P.fc[1]/Fy, hax=Math.abs(P.fx[0]/Fx)+Math.abs(P.fy[0]/Fx), hay=Math.abs(P.fx[1]/Fy)+Math.abs(P.fy[1]/Fy);
    if(Math.abs(fx-cx)<=hax && Math.abs(fy-cy)<=hay) hit=c; } // topmost active clip whose rect contains the cursor
  return hit; }
/* is the cursor over THIS clip's flat rect? (R88: 2D viewport drags only the selected clip, so an overlapping top clip can't steal it) */
function flatRectHit(c,px,py){ if(!c)return false; const m=mediaById(c.mediaId); if(!m||m.kind==='audio')return false; const t=state.playhead; if(t<c.start||t>=c.start+c.dur)return false;
  const fp=pix2frame(px,py), fx=fp[0],fy=fp[1]; const A=(state.seqW||16)/(state.seqH||9), Fx=Math.min(1,A),Fy=Math.min(1,1/A); const P=flatPlace(c,m,t);
  const cx=P.fc[0]/Fx, cy=P.fc[1]/Fy, hax=Math.abs(P.fx[0]/Fx)+Math.abs(P.fy[0]/Fx), hay=Math.abs(P.fx[1]/Fy)+Math.abs(P.fy[1]/Fy);
  return (Math.abs(fx-cx)<=hax && Math.abs(fy-cy)<=hay); }
/* [R94e] is the cursor over THIS clip in the dome? (same rule as flatRectHit: the 2D viewport only drags the timeline-selected clip) */
function domeClipHit(c,px,py){ if(!c)return false; const m=mediaById(c.mediaId); if(!m||m.kind==='audio')return false; const t=state.playhead; if(t<c.start||t>=c.start+c.dur)return false;
  const f=pix2f(px,py); const ae=f2azel(f[0],f[1]); const az=evalP(c,'az',t),el=evalP(c,'el',t),size=evalP(c,'size',t);
  return angDist(ae.az,ae.el,az,el) < size*0.55; }
function pickClip(f){ const ae=f2azel(f[0],f[1]); const t=state.playhead; let hit=null;
  for(const c of activeClips(t)){ const mm=mediaById(c.mediaId); if(!mm||mm.kind==='audio')continue; const az=evalP(c,'az',t),el=evalP(c,'el',t),size=evalP(c,'size',t); const d=angDist(ae.az,ae.el,az,el); if(d<size*0.55) hit=c; } return hit; } // audio / adjustment layers aren't selectable in the dome
function angDist(az1,el1,az2,el2){ const d1=dirAzEl(az1,el1),d2=dirAzEl(az2,el2); return Math.acos(Math.max(-1,Math.min(1,dot(d1,d2))))*R2D; }
/* [A6] manual edit of a parameter (inspector drag/type/wheel, viewport move). If the param is automated,
   editing by hand OVERRIDES the envelope (Ableton-style): the curve is bypassed (kept, not deleted) and the
   manual value is held; the Re-Enable affordance lights up. If not automated, it just writes the static value. */
// [archivado 20260722 · R137] perform-and-bake (_recTouch/autoRecOn/toggleAutoRec/recWrite/bakeRecorded) → _backup/deprecated/20260722-automation-override-and-perform-bake.js · sin efecto bajo el modelo After Effects (ADR-0006)
function manualEdit(c,p,v){ if(!c)return; v=+v;
  // [A2/D1] After Effects model: if the param is ALREADY automated, editing its value writes/updates a keyframe at the
  // playhead (the automation never breaks); if it isn't automated, editing just sets the static value (no keyframe).
  if(hasKf(c,p)) setKf(c,p,state.playhead,v,curEase()); else c.props[p]=v; }
// [archivado 20260722 · R137] override/re-enable (anyOverride/reenableAll/updReEnableGlobal) → _backup/deprecated/20260722-automation-override-and-perform-bake.js · sin efecto bajo el modelo After Effects (ADR-0006); #reEnAll ni existía en el DOM
function vzLbl(){ $('#vzReset').textContent=Math.round(state.view.zoom/0.92*100)+'%'; }

/* ===================== INSPECTOR ===================== */
const TF=[['az','Azimuth','°',0,360],['el','Elevation','°',0,90],['size','Size','°',5,300],['rot','Rotation','°',-180,180]]; // R88: dome Size up to 300° (was 160)
const TF_FLAT=[['x','Pos X','%',-100,100],['y','Pos Y','%',-100,100],['scale','Scale','%',0,1000],['rot','Rotation','°',-180,180]]; // 2D (flat) transform rows — R88: Scale up to 1000% (was 300); drawClipFlat has no upper clamp so type past it too
const FX=[['opacity','Opacity','%',0,100],['blur','Blur','px',0,20],['feather','Feather','%',0,100],['crop','Crop','%',0,90],['exposure','Exposure','',-100,100],['contrast','Contrast','',-100,100],['saturation','Saturation','',-100,100],['temperature','Temp','',-100,100],['tint','Tint','',-100,100],['glow','Glow','',0,100],['chroma','Chroma','',0,100]];
const FX_COLOR_KEYS=new Set(['exposure','contrast','saturation','temperature','tint','glow','chroma']); // [I2] these FX rows go to the Color section; the rest (opacity/blur/feather/crop) stay in Clip
const PLABELS={az:['Azimuth','Azimut'],el:['Elevation','Elevación'],size:['Size','Tamaño'],rot:['Rotation','Rotación'],x:['Pos X','Pos X'],y:['Pos Y','Pos Y'],scale:['Scale','Escala'],opacity:['Opacity','Opacidad'],blur:['Blur','Desenfoque'],feather:['Feather','Desvanecer'],crop:['Crop','Recortar'],exposure:['Exposure','Exposición'],contrast:['Contrast','Contraste'],saturation:['Saturation','Saturación'],temperature:['Temp','Temp'],tint:['Tint','Tinte'],glow:['Glow','Brillo'],chroma:['Chroma','Cromática']};
const propLabel=p=>{const m=PLABELS[p];return m?T(m[0],m[1]):p;};
/* [master grade] the sequence-level global grade UI — a compact, always-visible section at the top of the inspector.
   Independent of the selClip-bound clip color UI: reads/writes state.seqGrade and re-renders live. Phase 1: numeric. */
let _masterOpen=true;
const MASTER_PARAMS=[['exposure','Exposure','Exposición'],['contrast','Contrast','Contraste'],['saturation','Saturation','Saturación'],['temperature','Temp','Temperatura'],['tint','Tint','Tinte']];
function seqGradeObj(){ if(!state.seqGrade)state.seqGrade={exposure:0,contrast:0,saturation:0,temperature:0,tint:0}; return state.seqGrade; }
const MASTER_WHEELS=[['cgLift','Lift'],['cgGamma','Gamma'],['cgGain','Gain']];
function renderMasterGrade(){ const host=$('#insMaster'); if(!host)return; const g=seqGradeObj(); const on=masterGradeOn();
  const rows=MASTER_PARAMS.map(([k,en,es])=>`<div class="prow mgrow"><span class="lab">${T(en,es)}</span><input type="range" class="mgr" data-k="${k}" min="-100" max="100" value="${Math.round(g[k]||0)}" style="flex:1;height:18px;accent-color:var(--ink-3);"><span class="num mgv" data-k="${k}">${Math.round(g[k]||0)}</span></div>`).join('');
  const wheels=`<div class="prow mgrow" style="align-items:flex-start;"><span class="kf" style="cursor:default;visibility:hidden;"></span><div class="cwrap" style="flex:1;min-width:0;">`+
    MASTER_WHEELS.map(([k,lab])=>`<div class="cwcol" data-k="${k}"><div class="cwheel" data-k="${k}" title="${T('Drag = color balance · double-click = reset','Arrastrar = balance de color · doble clic = reiniciar')}"><span class="cwh"></span></div><input type="range" class="cwm" data-k="${k}" min="-100" max="100" value="0" title="${T('Luminance','Luminancia')}"><span class="cwlab">${lab}</span></div>`).join('')+`</div></div>`;
  const rec=(g.lut)?_lutReg.get(g.lut):null;
  const lut=`<div class="prow mgrow"><span class="lab">LUT</span><div style="flex:1;display:flex;align-items:center;gap:6px;min-width:0;"><button class="mbtn" id="mgLutLoad" style="height:18px;padding:0 8px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${g.lut?(rec?rec.name:'LUT').slice(0,16):T('Load…','Cargar…')}</button>${g.lut?`<input type="range" id="mgLutMix" min="0" max="100" value="${g.lutMix==null?100:g.lutMix}" style="flex:1;min-width:36px;"><span class="tnum" id="mgLutMixV" style="width:30px;color:var(--ink-dim);text-align:right;">${g.lutMix==null?100:g.lutMix}%</span><button class="mbtn" id="mgLutClear" title="${T('Remove LUT','Quitar LUT')}" style="height:18px;padding:0 7px;">✕</button>`:''}</div></div>`;
  const curves=`<div class="prow mgrow" style="align-items:flex-start;"><span class="kf" style="cursor:default;visibility:hidden;"></span><div style="flex:1;min-width:0;">
      <div style="display:flex;gap:3px;align-items:center;margin-bottom:4px;"><button class="ctab mgctab on" data-ch="l">${T('Luma','Luma')}</button><button class="ctab mgctab" data-ch="r">R</button><button class="ctab mgctab" data-ch="g">G</button><button class="ctab mgctab" data-ch="b">B</button><div style="flex:1;"></div><button class="mbtn" id="mgCurveReset" style="height:16px;padding:0 7px;" title="${T('Reset this channel','Reiniciar este canal')}">${T('Reset','Reiniciar')}</button></div>
      <canvas class="curvecv mgcurvecv" title="${T('Click = add point · drag = move · double-click = remove','Clic = añadir punto · arrastrar = mover · doble clic = quitar')}"></canvas></div></div>`;
  host.innerHTML=`<button class="sechead" id="secMaster"><span style="color:var(--ink-dim);display:flex;transform:rotate(${_masterOpen?0:-90}deg);">${ICO('chevDown')}</span><span class="t">${T('Master Grade','Grado máster')}</span><span class="ln"></span>${on?'<span class="mgdot" title="'+T('Active','Activo')+'"></span>':''}<button class="mbtn" id="mgReset" title="${T('Reset the whole-sequence grade','Reiniciar el grado de toda la secuencia')}" style="height:15px;padding:0 6px;margin-left:6px;${on?'':'opacity:.45;'}">${T('Reset','Reiniciar')}</button></button>
    <div id="masterRows" style="padding-bottom:5px;${_masterOpen?'':'display:none;'}">${rows}${wheels}${lut}${curves}</div>`;
  const head=host.querySelector('#secMaster'); if(head)head.onclick=e=>{ if(e.target.closest('#mgReset'))return; _masterOpen=!_masterOpen; renderMasterGrade(); };
  const rst=host.querySelector('#mgReset'); if(rst)rst.onclick=e=>{ e.stopPropagation(); if(!masterGradeOn())return; pushUndo(); state.seqGrade={exposure:0,contrast:0,saturation:0,temperature:0,tint:0}; markCurveDirty(_masterClip); render(); markDirty(); renderMasterGrade(); flashStatus(T('Master grade reset','Grado máster reiniciado')); };
  // wheels (lift/gamma/gain) — fresh handlers on state.seqGrade (the clip wheel UI is selClip-bound)
  host.querySelectorAll('.cwcol').forEach(col=>{ const k=col.dataset.k, wheel=col.querySelector('.cwheel'), hnd=col.querySelector('.cwh'), master=col.querySelector('.cwm');
    const cur=()=>{ const a=g[k]; return a?[a[0]||0,a[1]||0,a[2]||0]:[0,0,0]; };
    const place=()=>{ const [x,y,mm]=cur(); hnd.style.left=(50+x*46)+'%'; hnd.style.top=(50-y*46)+'%'; master.value=Math.round(mm*100); }; place();
    let drag=false; const setXY=(px,py)=>{ const r=wheel.getBoundingClientRect(); let x=(px-r.left)/r.width*2-1, y=-((py-r.top)/r.height*2-1); const d=Math.hypot(x,y); if(d>1){x/=d;y/=d;} const a=cur(); g[k]=[x,y,a[2]]; place(); render(); };
    wheel.onpointerdown=e=>{ e.preventDefault(); pushUndo(); drag=true; try{wheel.setPointerCapture(e.pointerId);}catch(_){} setXY(e.clientX,e.clientY); };
    wheel.onpointermove=e=>{ if(drag)setXY(e.clientX,e.clientY); };
    wheel.onpointerup=()=>{ if(drag){ drag=false; markDirty(); renderMasterGrade(); } };
    wheel.ondblclick=()=>{ pushUndo(); g[k]=[0,0,0]; place(); render(); markDirty(); renderMasterGrade(); };
    master.onpointerdown=()=>pushUndo();
    master.oninput=e=>{ const a=cur(); g[k]=[a[0],a[1],(+e.target.value)/100]; render(); };
    master.onchange=()=>{ markDirty(); renderMasterGrade(); }; });
  // master LUT (.cube) — reuses loadLUT/_lutReg like clips
  const ll=host.querySelector('#mgLutLoad'); if(ll)ll.onclick=async()=>{ if(!(IS_ELEC&&DSP.pickFile)){ flashStatus(T('LUT loading needs the desktop app','Cargar LUT necesita la app de escritorio'),'err'); return; }
    const p=await DSP.pickFile({name:'Cube LUT',extensions:['cube'],title:T('Load master LUT (.cube)','Cargar LUT máster (.cube)')}); if(!p)return; const r2=await loadLUT(p); if(!r2){ flashStatus(T('Not a valid 3D .cube LUT','No es una LUT .cube 3D válida'),'err'); return; }
    pushUndo(); g.lut=p; if(g.lutMix==null)g.lutMix=100; render(); markDirty(); renderMasterGrade(); flashStatus('LUT: '+r2.name); };
  const lm=host.querySelector('#mgLutMix'); if(lm){ lm.onpointerdown=()=>pushUndo(); lm.oninput=e=>{ g.lutMix=+e.target.value; const v=host.querySelector('#mgLutMixV'); if(v)v.textContent=g.lutMix+'%'; render(); }; lm.onchange=()=>markDirty(); }
  const lc=host.querySelector('#mgLutClear'); if(lc)lc.onclick=()=>{ pushUndo(); g.lut=null; render(); markDirty(); renderMasterGrade(); };
  // master curves (luma + R/G/B) — fresh editor on state.seqGrade.curves; the texture cache lives on _masterClip
  { const cvv=host.querySelector('.mgcurvecv'); const PAD=6, COL={l:'#E8EAED',r:'#E06A6A',g:'#5FC77E',b:'#5B8DEF'}; let mch='l';
    const ens=()=>{ if(!g.curves)g.curves={}; for(const k of ['l','r','g','b'])if(!g.curves[k])g.curves[k]=[[0,0],[1,1]]; return g.curves; };
    const pts=()=>{ ens(); return g.curves[mch]; };
    const bake=()=>{ markCurveDirty(_masterClip); render(); }; // curveIsIdentity() keeps it a no-op when flat
    const draw=()=>{ if(!cvv)return; const W=cvv.clientWidth||248,H=cvv.clientHeight||120,dpr=Math.min(window.devicePixelRatio||1,2); cvv.width=Math.round(W*dpr);cvv.height=Math.round(H*dpr); const x=cvv.getContext('2d'); x.setTransform(dpr,0,0,dpr,0,0); x.clearRect(0,0,W,H);
      const iw=W-2*PAD, ih=H-2*PAD, X=v=>PAD+v*iw, Y=v=>PAD+(1-v)*ih;
      x.strokeStyle='rgba(255,255,255,0.06)';x.lineWidth=1;x.beginPath();for(let i=0;i<=4;i++){const gx=PAD+iw*i/4,gy=PAD+ih*i/4;x.moveTo(gx,PAD);x.lineTo(gx,PAD+ih);x.moveTo(PAD,gy);x.lineTo(PAD+iw,gy);}x.stroke();
      x.strokeStyle='rgba(255,255,255,0.13)';x.beginPath();x.moveTo(X(0),Y(0));x.lineTo(X(1),Y(1));x.stroke();
      const P=(g.curves&&g.curves[mch])||[[0,0],[1,1]], col=COL[mch]; x.strokeStyle=col;x.lineWidth=1.5;x.beginPath();for(let i=0;i<=96;i++){const t=i/96,yy=evalCurve(P,t);i?x.lineTo(X(t),Y(yy)):x.moveTo(X(t),Y(yy));}x.stroke();
      x.fillStyle=col;for(const p of P){x.beginPath();x.arc(X(p[0]),Y(p[1]),3.5,0,7);x.fill();x.lineWidth=1;x.strokeStyle='#0a0a0a';x.stroke();} };
    const toC=ev=>{ const r=cvv.getBoundingClientRect(),iw=r.width-2*PAD,ih=r.height-2*PAD; return [Math.max(0,Math.min(1,(ev.clientX-r.left-PAD)/iw)),Math.max(0,Math.min(1,1-(ev.clientY-r.top-PAD)/ih))]; };
    const hit=ev=>{ const r=cvv.getBoundingClientRect(),iw=r.width-2*PAD,ih=r.height-2*PAD,P=pts(); for(let i=0;i<P.length;i++){const px=PAD+P[i][0]*iw,py=PAD+(1-P[i][1])*ih;if(Math.hypot(ev.clientX-r.left-px,ev.clientY-r.top-py)<9)return i;}return -1; };
    let drag=-1; const ap=ev=>{ if(drag<0)return; const P=pts(); let [nx,ny]=toC(ev); if(drag===0)nx=0;else if(drag===P.length-1)nx=1;else nx=Math.max(P[drag-1][0]+0.001,Math.min(P[drag+1][0]-0.001,nx)); P[drag]=[nx,ny]; bake(); draw(); };
    if(cvv){ cvv.onpointerdown=ev=>{ ev.preventDefault(); ens(); const P=pts(); let i=hit(ev); pushUndo(); if(i<0){const c2=toC(ev);const np=[c2[0],c2[1]];P.push(np);P.sort((a,b)=>a[0]-b[0]);i=P.indexOf(np);} drag=i; try{cvv.setPointerCapture(ev.pointerId);}catch(_){} ap(ev); };
      cvv.onpointermove=ev=>{ if(drag>=0)ap(ev); };
      cvv.onpointerup=()=>{ if(drag>=0){ drag=-1; markDirty(); renderMasterGrade(); } }; // rebuild to refresh the active dot
      cvv.ondblclick=ev=>{ const P=pts(),i=hit(ev); if(i>0&&i<P.length-1){ pushUndo(); P.splice(i,1); bake(); draw(); markDirty(); } };
      requestAnimationFrame(draw); }
    host.querySelectorAll('.mgctab').forEach(b=>b.onclick=()=>{ mch=b.dataset.ch; host.querySelectorAll('.mgctab').forEach(z=>z.classList.toggle('on',z===b)); draw(); });
    const cr=host.querySelector('#mgCurveReset'); if(cr)cr.onclick=()=>{ pushUndo(); ens(); g.curves[mch]=[[0,0],[1,1]]; bake(); draw(); markDirty(); renderMasterGrade(); }; }
  host.querySelectorAll('.mgr').forEach(r=>{ const k=r.dataset.k;
    r.onpointerdown=()=>pushUndo();
    r.oninput=e=>{ g[k]=+e.target.value; const v=host.querySelector('.mgv[data-k="'+k+'"]'); if(v)v.textContent=Math.round(+e.target.value); render(); }; // grade is applied post-cache → a plain render() re-grades live, no raInvalidate
    r.onchange=()=>{ markDirty(); renderMasterGrade(); }; }); } // re-render on release to refresh the active dot / Reset state
function renderInspector(){ try{ renderMasterGrade(); }catch(e){} try{ _renderInspectorMain(); }catch(e){ console.error('inspector',e); } try{ renderReactivePanel(); }catch(e){} applyInspTab(); }
function _renderInspectorMain(){
  const g=state.selGroupId!=null?groupById(state.selGroupId):null;
  if(g){ $('#insEmpty').style.display='none'; $('#insCtl').style.display='none'; $('#insGroup').style.display='block'; renderGroupInspector(g); return; }
  $('#insGroup').style.display='none';
  const c=selClip(); $('#insEmpty').style.display=c?'none':'flex'; $('#insCtl').style.display=c?'block':'none'; if(!c)return;
  const m=mediaById(c.mediaId);
  $('#selThumb').style.backgroundImage=m&&m.thumb?`url(${m.thumb})`:'none';
  $('#selName').textContent=c.name; $('#selMeta').textContent=(m?m.kind.toUpperCase():'')+' · '+fmtDur(c.dur);
  { const cb=$('#selColorBar'); if(cb){ cb.style.background=clipTint(c,mediaById(c.mediaId)); cb.title=T('Click to set the clip color','Clic para elegir el color del clip'); cb.onclick=e=>openClipColorPopup(e.clientX,e.clientY); } } // the selected clip's OWN colour (click = per-clip colour picker)
  // group membership chip
  const chost=$('#grpChipHost'); if(chost){ const gg=c.groupId!=null?groupById(c.groupId):null;
    chost.innerHTML = gg ? `<div class="grpchip" id="grpChip"><span class="gc">${ICO('ring',13)}</span><span style="flex:1;">${T('Part of','Parte de')} <b>${gg.name}</b></span><span style="color:var(--ink-3);">${T('Edit group','Editar grupo')} ›</span></div>` : '';
    if(gg) $('#grpChip').onclick=()=>selectGroup(gg.id); }
  // Adjustment layer: no source media / no transform — just opacity (wet/dry) + a pointer to the Reactive FX tab
  if(c.adjust){ $('#selMeta').textContent=T('Adjustment layer','Capa de ajuste');
    ['#secTf','#mirrorWrap','#tfRows','#secColor','#colorRows','#secMotion','#motionRows'].forEach(s=>{const el=$(s);if(el)el.style.display='none';});
    ['#secFx','#fxRows'].forEach(s=>{const el=$(s);if(el)el.style.display='';}); const ia0=$('#insAudio'); if(ia0)ia0.style.display='none';
    { const sf=$('#secFx'); if(sf){const tt=sf.querySelector('.t'); if(tt)tt.textContent=T('Adjustment Layer','Capa de ajuste');} }
    $('#fxRows').innerHTML=''; buildRows('#fxRows',[['opacity','Opacity','%',0,100]],c);
    const hint=document.createElement('div'); hint.style.cssText='padding:8px 14px 4px;font-size:11px;color:var(--ink-3);line-height:1.55;'; hint.innerHTML=T('Effects on this layer affect <b>everything below it</b> in the timeline. Add them in the <b>Reactive FX</b> tab.','Los efectos de esta capa afectan <b>todo lo de debajo</b> en la línea de tiempo. Añádelos en la pestaña <b>Reactive FX</b>.'); $('#fxRows').appendChild(hint);
    refreshInspector(); return; }
  // Audio clips get a dedicated Volume/Fade panel — the dome Transform/Effects don't apply to sound
  const isAud=!!(m&&m.kind==='audio')||isAudioClip(c);
  { const d=isAud?'none':''; ['#secTf','#mirrorWrap','#secFx','#tfRows','#fxRows','#secColor','#colorRows','#secMotion','#motionRows'].forEach(s=>{const el=$(s);if(el)el.style.display=d;}); const ia=$('#insAudio'); if(ia)ia.style.display=isAud?'block':'none'; }
  if(isAud){ $('#tfRows').innerHTML=''; $('#fxRows').innerHTML=''; buildAudioInspector(c,m); return; }
  $('#mirrorBtn').classList.toggle('on',c.props.mirror);
  { const st=$('#secTf'); if(st){ const tt=st.querySelector('.t'); if(tt)tt.textContent=isFlat()?T('Transform','Transformación'):T('Dome · Transform','Domo · Transformación'); } }
  { const sf=$('#secFx'); if(sf){ const tt=sf.querySelector('.t'); if(tt)tt.textContent=T('Clip','Clip'); } const sc=$('#secColor'); if(sc){ const tt=sc.querySelector('.t'); if(tt)tt.textContent=T('Color','Color'); } const sm=$('#secMotion'); if(sm){ const tt=sm.querySelector('.t'); if(tt)tt.textContent=T('Motion','Movimiento'); } } // [I2] section titles (secFx reused as the Clip section; Color/Motion are new)
  buildRows('#tfRows', isFlat()?TF_FLAT:TF, c);
  { const fxAll=(!isFlat()&&c.props.fulldome)?FX.filter(f=>['opacity','feather','exposure','contrast','saturation','temperature','tint'].includes(f[0])):FX; // fulldome path (PFD) supports opacity + grade + mask/feather
    buildRows('#fxRows', fxAll.filter(f=>!FX_COLOR_KEYS.has(f[0])), c);   // [I2] Clip section: opacity/blur/feather/crop + (below) mask/blend/loop/keys
    buildRows('#colorRows', fxAll.filter(f=>FX_COLOR_KEYS.has(f[0])), c); } // [I2] Color section: exposure/contrast/saturation/temp/tint/glow/chroma + (below) LUT
  // 360-room "Mask to wall": the clip is only visible inside the chosen wall(s) — multi-select
  if(isRoom()&&!c.adjust){ const room=activeSeq()&&activeSeq().room; if(room&&room.walls){ const host=$('#tfRows'); const cur=c.props.maskWalls||[];
    const row=document.createElement('div'); row.className='prow'; row.style.cssText='flex-direction:column;align-items:stretch;gap:6px;margin-top:2px;';
    row.innerHTML=`<span class="lab" style="width:auto;color:var(--ink-2);">${T('Mask to wall','Máscara a muro')}</span><div style="display:flex;flex-wrap:wrap;gap:6px;">`+
      room.walls.map(w=>{ const on=cur.includes(w.role); return `<button class="wmaskchip" data-role="${w.role}" style="font-size:11px;padding:3px 9px;border-radius:2px;border:.5px solid ${on?ROOM_ROLE_COL[w.role]:'rgba(255,255,255,0.14)'};background:${on?hexA(ROOM_ROLE_COL[w.role],0.28):'#24272C'};color:var(--ink);cursor:pointer;">${roomRoleLabel(w.role)}</button>`; }).join('')+`</div>`;
    host.appendChild(row);
    row.querySelectorAll('.wmaskchip').forEach(b=>b.onclick=()=>{ const cc=selClip(); if(!cc)return; pushUndo(); const arr=(cc.props.maskWalls||[]).slice(); const r=b.dataset.role; const i=arr.indexOf(r); if(i>=0)arr.splice(i,1); else arr.push(r); if(arr.length)cc.props.maskWalls=arr; else delete cc.props.maskWalls; renderInspector(); render(); markDirty(); }); } }
  // Composition tools — when the selected clip is a nest created from a Compose, expose its layout controls + live dome schematic
  if(m && m.comp){ const g=m.comp; const cap=s=>s.charAt(0).toUpperCase()+s.slice(1); const kinds=['ring','domegrid','grid','spiral','phyllo','wave','fib','line','random'];
    const isDG=g.kind==='domegrid', isGrid=g.kind==='grid', isSpi=(g.kind==='spiral'||g.kind==='wave'); // [N2] the quick fields follow the compose type
    let f1,f2; // [id, label, value, min, max, key]
    if(isDG){ f1=['icRings',T('Rings','Anillos'),g.rings||3,1,12,'rings']; f2=['icSegs',T('Segments','Segmentos'),g.segs||8,1,48,'segs']; }
    else if(isGrid){ f1=['icCols',T('Columns','Columnas'),g.cols||3,1,12,'cols']; f2=['icArc',T('Arc','Arco'),g.arc||140,10,360,'arc']; }
    else if(isSpi){ f1=['icN',T('Count','Cantidad'),g.count,2,32,'count']; f2=['icTurns',T('Turns','Vueltas'),g.turns||3,1,8,'turns']; }
    else { f1=['icN',T('Count','Cantidad'),g.count,2,32,'count']; f2=['icEl',T('Elevation','Elevación'),g.el,0,85,'el']; }
    const fld=f=>`<label class="cmini">${f[1]}<input type="number" id="${f[0]}" value="${f[2]}" min="${f[3]}" max="${f[4]}" data-key="${f[5]}"></label>`;
    const dgTog=isDG?`<div style="display:flex;flex-wrap:wrap;gap:10px;font-size:11px;color:var(--ink-2);">
        <label style="display:flex;align-items:center;gap:4px;cursor:pointer;" title="${T('Offset alternate rings','Desfasar anillos alternos')}"><input type="checkbox" id="icBrick" ${g.brick?'checked':''}> ${T('Brick','Ladrillo')}</label>
        <label style="display:flex;align-items:center;gap:4px;cursor:pointer;" title="${T('Undeformed tiles instead of warped sectors','Baldosas sin deformar en vez de sectores curvados')}"><input type="checkbox" id="icNoWarp" ${g.noWarp?'checked':''}> ${T('Flat tiles','Sin deformar')}</label>
        <label style="display:flex;align-items:center;gap:4px;cursor:pointer;" title="${T('Shuffle which media lands in each cell','Barajar qué medio va en cada celda')}"><input type="checkbox" id="icShuf" ${g.shuffle?'checked':''}> ${T('Randomize','Aleatorio')}</label>
      </div>`:'';
    const crow=document.createElement('div'); crow.className='prow'; crow.style.cssText='flex-direction:column;align-items:stretch;gap:8px;background:var(--s1);border:.5px solid rgba(255,255,255,0.12);border-radius:2px;padding:8px;margin-bottom:7px;';
    crow.innerHTML=`<span class="lab" style="width:auto;color:var(--ink-2);display:flex;align-items:center;gap:6px;">${ICO('ring',12)} ${T('Composition','Composición')}</span>
      <canvas id="icPrev" width="150" height="150" style="align-self:center;border-radius:7px;"></canvas>
      <div class="kindseg" id="icKind">${kinds.map(k=>`<button data-k="${k}" class="${k===g.kind?'on':''}">${cap(kindES(k))}</button>`).join('')}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">${fld(f1)}${fld(f2)}<label class="cmini">${T('Size','Tamaño')}<input type="number" id="icSize" value="${g.size}" min="5" max="120" data-key="size"></label></div>
      ${dgTog}
      <button class="mbtn" id="icMore" style="width:100%;">${T('More options…','Más opciones…')}</button>`;
    $('#tfRows').insertBefore(crow,$('#tfRows').firstChild);
    const draw=()=>drawComposePreview(g,crow.querySelector('#icPrev'));
    const apply=()=>{ pushUndo(); crow.querySelectorAll('input[data-key]').forEach(inp=>{ const k=inp.dataset.key; let v=+inp.value||0; if(k==='count')v=Math.max(2,Math.min(32,v||g.count)); g[k]=v; });
      if(isDG){ g.brick=crow.querySelector('#icBrick').checked; const nw=crow.querySelector('#icNoWarp').checked; g.noWarp=nw; const sh=crow.querySelector('#icShuf').checked; if(sh!==g.shuffle)g._orderR=true; g.shuffle=sh; }
      ensureRand(g); regenComposeNest(m); renderTimeline(); scrubRender(); markDirty(); draw(); }; // R88: scrubRender re-seeks the rebuilt inner videos to the CURRENT frame
    crow.querySelectorAll('#icKind button').forEach(b=>b.onclick=()=>{ g.kind=b.dataset.k; ensureRand(g); regenComposeNest(m); renderTimeline(); scrubRender(); markDirty(); renderInspector(); }); // [N2] changing the kind rebuilds the quick fields for that type
    crow.querySelectorAll('input[data-key]').forEach(inp=>{ inp.onchange=apply; });
    if(isDG)['#icBrick','#icNoWarp','#icShuf'].forEach(id=>{ const el=crow.querySelector(id); if(el)el.onchange=apply; });
    crow.querySelector('#icMore').onclick=()=>openCompose(g.kind,null,m);
    draw();
  }
  // Mask dropdown — [N3] compose nests don't get the mask option (shape/PNG/pen)
  if(!(m&&m.comp)){
  const mrow=document.createElement('div'); mrow.className='prow';
  mrow.innerHTML=`<span class="kf" style="cursor:default;"></span><span class="lab">${T('Mask','Máscara')}</span>
    <select class="selsel" id="maskSel" style="flex:1;height:18px;">
      <option value="none">${T('None','Ninguna')}</option><option value="circle">${T('Circle','Círculo')}</option><option value="rounded">${T('Rounded','Redondeada')}</option><option value="diamond">${T('Diamond','Rombo')}</option><option value="vignette">${T('Vignette','Viñeta')}</option><option value="custom">${T('Custom (PNG)','Personalizada (PNG)')}</option></select>
    <button class="kf" id="maskUp" title="${T('Import mask PNG','Importar máscara PNG')}" style="width:20px;height:20px;color:var(--ink-2);cursor:pointer;">${ICO('upload',14)}</button>`;
  $('#fxRows').appendChild(mrow);
  // Mask size (resize the shape mask — the aspect-corrected circle stays a perfect circle)
  const msrow=document.createElement('div'); msrow.className='prow';
  msrow.innerHTML=`<span class="kf" style="cursor:default;"></span><span class="lab">${T('Mask size','Tamaño máscara')}</span><input type="range" id="maskScaleR" min="20" max="200" value="${Math.round((c.props.maskScale||1)*100)}" style="flex:1;height:20px;"><span class="tnum" id="maskScaleV" style="width:40px;text-align:right;color:var(--ink-2);">${Math.round((c.props.maskScale||1)*100)}%</span>`;
  $('#fxRows').appendChild(msrow);
  const msShow=()=>{ const mk=(selClip()||c).props.mask||'none'; msrow.style.display=(mk!=='none'&&mk!=='custom')?'flex':'none'; };
  msrow.querySelector('#maskScaleR').oninput=e=>{ const cc=selClip(); if(!cc)return; cc.props.maskScale=Math.max(0.2,(+e.target.value)/100); msrow.querySelector('#maskScaleV').textContent=(+e.target.value)+'%'; render(); };
  msrow.querySelector('#maskScaleR').onchange=()=>markDirty();
  mrow.querySelector('#maskSel').value=c.props.mask||'none';
  mrow.querySelector('#maskSel').onchange=e=>{const cc=selClip();if(cc){pushUndo();cc.props.mask=e.target.value;render();} msShow();};
  msShow();
  mrow.querySelector('#maskUp').onclick=()=>{ const inp=document.createElement('input'); inp.type='file'; inp.accept='image/*'; inp.onchange=e=>{ const f=e.target.files[0]; if(!f)return; const url=URL.createObjectURL(f); const im=new Image(); im.onload=()=>{ const cc=selClip(); if(!cc)return; pushUndo();
    const big=Math.max(im.naturalWidth,im.naturalHeight)||1, s=Math.min(1,1024/big); const mc=document.createElement('canvas'); mc.width=Math.max(1,Math.round(im.naturalWidth*s)); mc.height=Math.max(1,Math.round(im.naturalHeight*s)); mc.getContext('2d').drawImage(im,0,0,mc.width,mc.height);
    cc.maskData=mc.toDataURL('image/png'); // persisted so the mask survives save/load
    if(!cc.maskTex)cc.maskTex=newTex(); upTex(cc.maskTex,mc); cc.props.mask='custom'; cc.maskName=f.name; mrow.querySelector('#maskSel').value='custom'; URL.revokeObjectURL(url); render(); flashStatus(T('Mask PNG applied','Máscara PNG aplicada')); }; im.src=url; }; inp.click(); };
  // [I3] pen (point) mask editor — separate from the shape/PNG mask above
  buildPenMaskUI($('#fxRows'),c);
  } // [N3] end mask section (skipped for compose nests)
  // Blend mode
  const brow=document.createElement('div'); brow.className='prow';
  brow.innerHTML=`<span class="kf" style="cursor:default;"></span><span class="lab">${T('Blend','Fusión')}</span>
    <select class="selsel" id="blendSel" style="flex:1;height:18px;">
      <option value="normal">${T('Normal','Normal')}</option><option value="add">${T('Add (light)','Aditivo (luz)')}</option><option value="screen">${T('Screen','Trama')}</option><option value="multiply">${T('Multiply','Multiplicar')}</option><option value="darken">${T('Darken','Oscurecer')}</option><option value="lighten">${T('Lighten','Aclarar')}</option></select>`;
  $('#fxRows').appendChild(brow);
  brow.querySelector('#blendSel').value=c.props.blend||'normal';
  brow.querySelector('#blendSel').onchange=e=>{const cc=selClip();if(cc){pushUndo();cc.props.blend=e.target.value;render();}};
  // React to audio (deterministic envelope — also bakes into export)
  const rrow=document.createElement('div'); rrow.className='prow';
  rrow.innerHTML=`<span class="kf" style="cursor:default;"></span><span class="lab">${T('React to audio','Reaccionar al audio')}</span>
    <select class="selsel" id="reactSel" style="flex:1;height:18px;"><option value="none">${T('Off','No')}</option><option value="audio">${T('Pulse size','Pulsar tamaño')}</option></select>
    <input type="number" id="reactAmt" value="${c.props.reactAmt!=null?c.props.reactAmt:60}" min="0" max="100" title="${T('Amount','Cantidad')}" style="width:50px;height:18px;background:var(--s2);border:.5px solid rgba(255,255,255,0.12);border-radius:2px;color:var(--ink);text-align:center;">`;
  $('#fxRows').appendChild(rrow);
  rrow.querySelector('#reactSel').value=c.props.react||'none';
  const reReact=()=>{const cc=selClip();if(cc){pushUndo();cc.props.react=$('#reactSel').value;cc.props.reactAmt=+$('#reactAmt').value||0;render();}};
  rrow.querySelector('#reactSel').onchange=reReact; rrow.querySelector('#reactAmt').onchange=reReact;
  // Fulldome source toggle — source is already a fisheye/dome master → fills the dome 1:1 (no patch warp). Dome-only.
  if(!isFlat()){ const fdrow=document.createElement('div'); fdrow.className='prow';
    fdrow.innerHTML=`<span class="kf" style="cursor:default;"></span><span class="lab">${T('Fulldome src','Fuente fulldome')}</span>
      <label style="display:flex;align-items:center;gap:6px;flex:1;font-size:11px;color:var(--ink-2);cursor:pointer;"><input type="checkbox" id="fdToggle" ${c.props.fulldome?'checked':''}> ${T('Map 1:1 to dome (no warp)','Mapear 1:1 al domo (sin warp)')}</label>`;
    $('#fxRows').appendChild(fdrow);
    fdrow.querySelector('#fdToggle').onchange=e=>{const cc=selClip();if(cc){pushUndo();cc.props.fulldome=e.target.checked; if(e.target.checked)cc.props.equirect=false; if(_raOn)raInvalidate();render();renderInspector();}};
    // [F7] Equirect 360° source: the clip is a 2:1 panorama → mapped onto the dome. Azimuth (Transform) = camera yaw; Tilt = pitch. Mutually exclusive with Fulldome src.
    const eqrow=document.createElement('div'); eqrow.className='prow';
    eqrow.innerHTML=`<span class="kf" style="cursor:default;"></span><span class="lab">${T('Equirect 360°','Equirect 360°')}</span>
      <label style="display:flex;align-items:center;gap:6px;flex:1;font-size:11px;color:var(--ink-2);cursor:pointer;"><input type="checkbox" id="eqToggle" ${c.props.equirect?'checked':''}> ${T('Map panorama to dome (Azimuth = camera yaw)','Mapear panorama al domo (Azimut = giro de cámara)')}</label>`;
    $('#fxRows').appendChild(eqrow);
    eqrow.querySelector('#eqToggle').onchange=e=>{const cc=selClip();if(cc){pushUndo();cc.props.equirect=e.target.checked; if(e.target.checked)cc.props.fulldome=false; if(_raOn)raInvalidate();render();renderInspector();}};
    if(c.props.equirect){ const eprow=document.createElement('div'); eprow.className='prow';
      eprow.innerHTML=`<span class="kf" style="cursor:default;visibility:hidden;"></span><span class="lab" style="font-size:11px;color:var(--ink-2);">${T('Tilt','Inclinación')}</span>
        <input type="range" id="eqPitch" min="-90" max="90" value="${Math.round(c.props.eqPitch||0)}" style="flex:1;height:20px;"><span class="tnum" id="eqPitchV" style="width:40px;text-align:right;color:var(--ink-dim);">${Math.round(c.props.eqPitch||0)}°</span>`;
      $('#fxRows').appendChild(eprow);
      const pr=eprow.querySelector('#eqPitch'); pr.onpointerdown=()=>pushUndo(); pr.oninput=e=>{ const cc=selClip(); if(!cc)return; cc.props.eqPitch=+e.target.value; eprow.querySelector('#eqPitchV').textContent=(+e.target.value)+'°'; if(_raOn)raInvalidate(); render(); }; pr.onchange=()=>markDirty(); }
    // Fisheye pre-warp (R83) — for FLAT clips that lack the fisheye curvature a dome master needs
    const fhrow=document.createElement('div'); fhrow.className='prow';
    fhrow.innerHTML=`<span class="kf" style="cursor:default;"></span><span class="lab">${T('Fisheye','Ojo de pez')}</span>
      <label style="display:flex;align-items:center;gap:6px;flex:1;font-size:11px;color:var(--ink-2);cursor:pointer;"><input type="checkbox" id="fhToggle" ${c.props.fisheye?'checked':''}> ${T('Warp flat → fisheye','Deformar plano → ojo de pez')}</label>
      <input type="number" id="fhAmt" value="${c.props.fisheyeAmt!=null?c.props.fisheyeAmt:60}" min="0" max="100" title="${T('Amount','Cantidad')}" style="width:46px;height:18px;background:var(--s2);border:.5px solid rgba(255,255,255,0.12);border-radius:2px;color:var(--ink);text-align:center;${c.props.fisheye?'':'opacity:.4;'}">`;
    $('#fxRows').appendChild(fhrow);
    fhrow.querySelector('#fhToggle').onchange=e=>{const cc=selClip();if(cc){pushUndo();cc.props.fisheye=e.target.checked;const inp=fhrow.querySelector('#fhAmt');if(inp)inp.style.opacity=e.target.checked?'1':'.4';if(_raOn)raInvalidate();render();}};
    fhrow.querySelector('#fhAmt').onchange=e=>{const cc=selClip();if(cc){pushUndo();cc.props.fisheyeAmt=Math.max(0,Math.min(100,+e.target.value||0));if(_raOn)raInvalidate();render();}}; }
  // R130 · lift/gamma/gain color wheels (primary grade) — any visual clip. Drag the handle = color balance; slider = luminance master; double-click = reset.
  if(m && m.kind!=='audio'){ const wrow=document.createElement('div'); wrow.className='prow'; wrow.style.alignItems='flex-start';
    const specs=[['cgLift','Lift'],['cgGamma','Gamma'],['cgGain','Gain']];
    wrow.innerHTML=`<span class="kf" style="cursor:default;visibility:hidden;"></span><div class="cwrap" style="flex:1;min-width:0;">`+
      specs.map(([k,lab])=>`<div class="cwcol" data-k="${k}">
        <div class="cwheel" data-k="${k}" title="${T('Drag = color balance · double-click = reset','Arrastrar = balance de color · doble clic = reiniciar')}"><span class="cwh"></span></div>
        <input type="range" class="cwm" data-k="${k}" min="-100" max="100" value="0" title="${T('Luminance','Luminancia')}">
        <span class="cwlab">${lab}</span></div>`).join('')+`</div>`;
    $('#colorRows').appendChild(wrow);
    wrow.querySelectorAll('.cwcol').forEach(col=>{ const k=col.dataset.k; const wheel=col.querySelector('.cwheel'); const hnd=col.querySelector('.cwh'); const master=col.querySelector('.cwm');
      const cur=()=>{ const cc=selClip(); const a=cc&&cc.props&&cc.props[k]; return a?[a[0]||0,a[1]||0,a[2]||0]:[0,0,0]; };
      const place=()=>{ const [x,y,mm]=cur(); hnd.style.left=(50+x*46)+'%'; hnd.style.top=(50-y*46)+'%'; master.value=Math.round(mm*100); };
      place();
      let drag=false;
      const setXY=(px,py)=>{ const r=wheel.getBoundingClientRect(); let x=(px-r.left)/r.width*2-1, y=-((py-r.top)/r.height*2-1); const d=Math.hypot(x,y); if(d>1){x/=d;y/=d;} const cc=selClip(); if(!cc)return; const a=cur(); cc.props[k]=[x,y,a[2]]; place(); if(_raOn)raInvalidate(); render(); };
      wheel.onpointerdown=e=>{ e.preventDefault(); const cc=selClip(); if(!cc)return; pushUndo(); drag=true; try{wheel.setPointerCapture(e.pointerId);}catch(_){} setXY(e.clientX,e.clientY); };
      wheel.onpointermove=e=>{ if(drag)setXY(e.clientX,e.clientY); };
      wheel.onpointerup=()=>{ if(drag){ drag=false; markDirty(); } };
      wheel.ondblclick=()=>{ const cc=selClip(); if(!cc)return; pushUndo(); cc.props[k]=[0,0,0]; place(); if(_raOn)raInvalidate(); render(); markDirty(); };
      master.onpointerdown=()=>pushUndo();
      master.oninput=e=>{ const cc=selClip(); if(!cc)return; const a=cur(); cc.props[k]=[a[0],a[1],(+e.target.value)/100]; if(_raOn)raInvalidate(); render(); };
      master.onchange=()=>markDirty(); }); }
  // R132 · tone curves (luma + R/G/B) — 256-entry 1D LUT built from draggable control points. Any visual clip.
  if(m && m.kind!=='audio'){ const crow=document.createElement('div'); crow.className='prow'; crow.style.alignItems='flex-start';
    crow.innerHTML=`<span class="kf" style="cursor:default;visibility:hidden;"></span><div style="flex:1;min-width:0;">
      <div style="display:flex;gap:3px;align-items:center;margin-bottom:4px;">
        <button class="ctab on" data-ch="l">${T('Luma','Luma')}</button><button class="ctab" data-ch="r">R</button><button class="ctab" data-ch="g">G</button><button class="ctab" data-ch="b">B</button>
        <div style="flex:1;"></div><button class="mbtn" id="curveReset" style="height:16px;padding:0 7px;" title="${T('Reset this channel','Reiniciar este canal')}">${T('Reset','Reiniciar')}</button>
      </div>
      <canvas class="curvecv" title="${T('Click = add point · drag = move · double-click = remove','Clic = añadir punto · arrastrar = mover · doble clic = quitar')}"></canvas></div>`;
    $('#colorRows').appendChild(crow);
    const cvv=crow.querySelector('.curvecv'); const PAD=6; let ch='l';
    const ensure=()=>{ const cc=selClip(); if(!cc)return null; if(!cc.props.curves)cc.props.curves={}; for(const k of ['l','r','g','b'])if(!cc.props.curves[k])cc.props.curves[k]=[[0,0],[1,1]]; return cc; };
    const pts=()=>{ const cc=ensure(); return cc?cc.props.curves[ch]:[[0,0],[1,1]]; };
    const COL={l:'#E8EAED',r:'#E06A6A',g:'#5FC77E',b:'#5B8DEF'};
    const draw=()=>{ const W=cvv.clientWidth||260, H=cvv.clientHeight||132; const dpr=Math.min(window.devicePixelRatio||1,2);
      cvv.width=Math.round(W*dpr); cvv.height=Math.round(H*dpr); const x=cvv.getContext('2d'); x.setTransform(dpr,0,0,dpr,0,0); x.clearRect(0,0,W,H);
      const iw=W-2*PAD, ih=H-2*PAD, X=v=>PAD+v*iw, Y=v=>PAD+(1-v)*ih;
      x.strokeStyle='rgba(255,255,255,0.06)'; x.lineWidth=1; x.beginPath(); for(let i=0;i<=4;i++){ const gx=PAD+iw*i/4, gy=PAD+ih*i/4; x.moveTo(gx,PAD); x.lineTo(gx,PAD+ih); x.moveTo(PAD,gy); x.lineTo(PAD+iw,gy);} x.stroke();
      x.strokeStyle='rgba(255,255,255,0.13)'; x.beginPath(); x.moveTo(X(0),Y(0)); x.lineTo(X(1),Y(1)); x.stroke();
      const P=pts(), col=COL[ch]; x.strokeStyle=col; x.lineWidth=1.5; x.beginPath();
      for(let i=0;i<=96;i++){ const t=i/96, yy=evalCurve(P,t); i?x.lineTo(X(t),Y(yy)):x.moveTo(X(t),Y(yy)); } x.stroke();
      x.fillStyle=col; for(const p of P){ x.beginPath(); x.arc(X(p[0]),Y(p[1]),3.5,0,7); x.fill(); x.lineWidth=1; x.strokeStyle='#0a0a0a'; x.stroke(); } };
    const toCurve=ev=>{ const r=cvv.getBoundingClientRect(), iw=r.width-2*PAD, ih=r.height-2*PAD; return [Math.max(0,Math.min(1,(ev.clientX-r.left-PAD)/iw)), Math.max(0,Math.min(1,1-(ev.clientY-r.top-PAD)/ih))]; };
    const hitPoint=ev=>{ const r=cvv.getBoundingClientRect(), iw=r.width-2*PAD, ih=r.height-2*PAD, P=pts(); for(let i=0;i<P.length;i++){ const px=PAD+P[i][0]*iw, py=PAD+(1-P[i][1])*ih; if(Math.hypot(ev.clientX-r.left-px, ev.clientY-r.top-py)<9)return i; } return -1; };
    let drag=-1;
    const applyDrag=ev=>{ const cc=selClip(); if(!cc||drag<0)return; const P=pts(); let [nx,ny]=toCurve(ev);
      if(drag===0)nx=0; else if(drag===P.length-1)nx=1; else nx=Math.max(P[drag-1][0]+0.001,Math.min(P[drag+1][0]-0.001,nx));
      P[drag]=[nx,ny]; markCurveDirty(cc); if(_raOn)raInvalidate(); render(); draw(); };
    cvv.onpointerdown=ev=>{ ev.preventDefault(); const cc=ensure(); if(!cc)return; const P=pts(); let i=hitPoint(ev); pushUndo();
      if(i<0){ const [nx,ny]=toCurve(ev); const np=[nx,ny]; P.push(np); P.sort((a,b)=>a[0]-b[0]); i=P.indexOf(np); }
      drag=i; try{cvv.setPointerCapture(ev.pointerId);}catch(_){} applyDrag(ev); };
    cvv.onpointermove=ev=>{ if(drag>=0)applyDrag(ev); };
    cvv.onpointerup=()=>{ if(drag>=0){ drag=-1; markDirty(); } };
    cvv.ondblclick=ev=>{ const cc=selClip(); if(!cc)return; const P=pts(), i=hitPoint(ev); if(i>0&&i<P.length-1){ pushUndo(); P.splice(i,1); markCurveDirty(cc); if(_raOn)raInvalidate(); render(); draw(); markDirty(); } };
    crow.querySelectorAll('.ctab').forEach(b=>b.onclick=()=>{ ch=b.dataset.ch; crow.querySelectorAll('.ctab').forEach(z=>z.classList.toggle('on',z===b)); draw(); });
    crow.querySelector('#curveReset').onclick=()=>{ const cc=ensure(); if(!cc)return; pushUndo(); cc.props.curves[ch]=[[0,0],[1,1]]; markCurveDirty(cc); if(_raOn)raInvalidate(); render(); draw(); markDirty(); };
    requestAnimationFrame(draw); }
  // R116 · creative LUT (.cube) — load a 3D LUT and blend it in as the final look (any visual clip)
  if(m && m.kind!=='audio'){ const rec=(c.props.lut)?_lutReg.get(c.props.lut):null; const lrow=document.createElement('div'); lrow.className='prow';
    lrow.innerHTML=`<span class="kf" style="cursor:default;"></span><span class="lab">LUT</span>
      <div style="flex:1;display:flex;align-items:center;gap:6px;min-width:0;">
        <button class="mbtn" id="lutLoad" style="height:18px;padding:0 8px;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${c.props.lut?(rec?rec.name:'LUT').slice(0,16):T('Load…','Cargar…')}</button>
        ${c.props.lut?`<input type="range" id="lutMix" min="0" max="100" value="${c.props.lutMix==null?100:c.props.lutMix}" style="flex:1;min-width:36px;"><span class="tnum" id="lutMixV" style="width:32px;color:var(--ink-dim);text-align:right;">${c.props.lutMix==null?100:c.props.lutMix}%</span><button class="mbtn" id="lutClear" title="${T('Remove LUT','Quitar LUT')}" style="height:18px;padding:0 7px;">✕</button>`:''}
      </div>`;
    $('#colorRows').appendChild(lrow); // [I2] LUT lives in the Color section
    lrow.querySelector('#lutLoad').onclick=async()=>{ if(!(IS_ELEC&&DSP.pickFile)){ flashStatus(T('LUT loading needs the desktop app','Cargar LUT necesita la app de escritorio'),'err'); return; }
      const p=await DSP.pickFile({name:'Cube LUT',extensions:['cube'],title:T('Load LUT (.cube)','Cargar LUT (.cube)')}); if(!p)return;
      const r2=await loadLUT(p); if(!r2){ flashStatus(T('Not a valid 3D .cube LUT','No es una LUT .cube 3D válida'),'err'); return; }
      const cc=selClip(); if(!cc)return; pushUndo(); cc.props.lut=p; if(cc.props.lutMix==null)cc.props.lutMix=100; if(_raOn)raInvalidate(); render(); refreshInspector(); markDirty(); flashStatus('LUT: '+r2.name); };
    const mix=lrow.querySelector('#lutMix'); if(mix){ mix.onpointerdown=()=>pushUndo();
      mix.oninput=e=>{ const cc=selClip(); if(!cc)return; cc.props.lutMix=+e.target.value; const v=lrow.querySelector('#lutMixV'); if(v)v.textContent=cc.props.lutMix+'%'; if(_raOn)raInvalidate(); render(); markDirty(); }; }
    const clr=lrow.querySelector('#lutClear'); if(clr)clr.onclick=()=>{ const cc=selClip(); if(!cc)return; pushUndo(); cc.props.lut=null; if(_raOn)raInvalidate(); render(); refreshInspector(); markDirty(); }; }
  // Loopable toggle — video / audio / sequence clips only: the source repeats, and the right edge can be dragged out forever (R81)
  if(m && (m.kind==='video'||m.kind==='audio'||isSeqMedia(m))){ const lrow=document.createElement('div'); lrow.className='prow';
    lrow.innerHTML=`<span class="kf" style="cursor:default;"></span><span class="lab">${T('Loop','Loop')}</span>
      <label style="display:flex;align-items:center;gap:6px;flex:1;font-size:11px;color:var(--ink-2);cursor:pointer;"><input type="checkbox" id="loopToggle" ${c.loop?'checked':''}> ${T('Loopable (extend the clip to repeat)','Loopeable (extiende el clip para repetir)')}</label>`;
    $('#fxRows').appendChild(lrow);
    lrow.querySelector('#loopToggle').onchange=()=>{const cc=selClip();if(cc)toggleLoop(cc);};
    if(c.loop && m.kind!=='audio'){ const lr=document.createElement('div'); lr.className='prow'; // R88: ping-pong reverse (video / sequence)
      lr.innerHTML=`<span class="kf" style="cursor:default;visibility:hidden;"></span><span class="lab" style="font-size:11px;color:var(--ink-2);">${T('Reverse','Inverso')}</span>
        <label style="display:flex;align-items:center;gap:6px;flex:1;font-size:11px;color:var(--ink-2);cursor:pointer;"><input type="checkbox" id="loopRevToggle" ${c.loopRev?'checked':''}> ${T('Ping-pong (fwd → back → fwd)','Ping-pong (ida → vuelta → ida)')}</label>`;
      $('#fxRows').appendChild(lr);
      lr.querySelector('#loopRevToggle').onchange=()=>{const cc=selClip();if(cc)toggleLoopReverse(cc);}; } }
  // Remove black (luma key) — any VISUAL clip: keys out the black background into real transparency (R85)
  if(m && m.kind!=='audio'){ const kr=document.createElement('div'); kr.className='prow';
    kr.innerHTML=`<span class="kf" style="cursor:default;"></span><span class="lab">${T('Remove black','Quitar negro')}</span>
      <label style="display:flex;align-items:center;gap:6px;flex:1;font-size:11px;color:var(--ink-2);cursor:pointer;"><input type="checkbox" id="bkToggle" ${c.props.blackKey?'checked':''}> ${T('Key the black background','Recortar el fondo negro')}</label>`;
    $('#fxRows').appendChild(kr);
    const bk2=document.createElement('div'); bk2.className='prow'; bk2.style.display=c.props.blackKey?'':'none';
    bk2.innerHTML=`<span class="kf" style="cursor:default;visibility:hidden;"></span><span class="lab" style="font-size:11px;color:var(--ink-2);">${T('Threshold / Soft','Umbral / Suave')}</span>
      <input type="number" id="bkThr" value="${c.props.blackKeyAmt!=null?c.props.blackKeyAmt:15}" min="0" max="100" title="${T('Threshold — raise to key darker grays','Umbral — súbelo para recortar grises oscuros')}" style="width:46px;height:18px;background:var(--s2);border:.5px solid rgba(255,255,255,0.12);border-radius:2px;color:var(--ink);text-align:center;">
      <input type="number" id="bkSoft" value="${c.props.blackKeySoft!=null?c.props.blackKeySoft:30}" min="0" max="100" title="${T('Softness — edge feather','Suavidad — difuminado del borde')}" style="width:46px;height:18px;background:var(--s2);border:.5px solid rgba(255,255,255,0.12);border-radius:2px;color:var(--ink);text-align:center;">`;
    $('#fxRows').appendChild(bk2);
    kr.querySelector('#bkToggle').onchange=e=>{const cc=selClip();if(cc){pushUndo();cc.props.blackKey=e.target.checked;bk2.style.display=e.target.checked?'':'none';if(_raOn)raInvalidate();render();}};
    bk2.querySelector('#bkThr').onchange=e=>{const cc=selClip();if(cc){pushUndo();cc.props.blackKeyAmt=Math.max(0,Math.min(100,+e.target.value||0));if(_raOn)raInvalidate();render();}};
    bk2.querySelector('#bkSoft').onchange=e=>{const cc=selClip();if(cc){pushUndo();cc.props.blackKeySoft=Math.max(0,Math.min(100,+e.target.value||0));if(_raOn)raInvalidate();render();}}; }
  // Text editor (only for text clips) — [U8] a useful paragraph tool: font · weight · italic · size · alignment · line height · colour · outline · load custom font
  if(m && m.kind==='text'){
    const FONTS=['Inter','Geist','Arial','Helvetica','Georgia','Times New Roman','Courier New','Verdana','Trebuchet MS','Tahoma','Impact'].concat(_customFonts.filter(f=>!['Inter','Geist'].includes(f)));
    const curFont=String(m.tfont||'Inter').replace(/,.*/,'').replace(/['"]/g,'').trim();
    const WEIGHTS=[['300','Light'],['400','Regular'],['500','Medium'],['700','Bold'],['900','Black']]; const curW=String(m.tweight||'700');
    const align=m.talign||'center';
    const inp='height:20px;background:var(--s2);border:.5px solid rgba(255,255,255,0.12);border-radius:2px;color:var(--ink);text-align:center;';
    const trow=document.createElement('div'); trow.className='prow'; trow.style.cssText='flex-direction:column;align-items:stretch;gap:6px;';
    trow.innerHTML=`<span class="lab" style="width:auto;">${T('Text content','Contenido de texto')}</span>
      <textarea id="txtContent" rows="2" spellcheck="false" style="width:100%;box-sizing:border-box;background:var(--s2);border:.5px solid rgba(255,255,255,0.12);border-radius:2px;color:var(--ink);font:13px/1.3 Inter;padding:6px;resize:vertical;"></textarea>
      <div style="display:flex;gap:6px;align-items:center;">
        <select id="txtFont" class="selsel" style="flex:1;min-width:100px;height:20px;">${FONTS.map(f=>`<option value="${f}" ${f===curFont?'selected':''}>${f}</option>`).join('')}</select>
        <select id="txtWeight" class="selsel" style="height:20px;width:84px;">${WEIGHTS.map(w=>`<option value="${w[0]}" ${w[0]===curW?'selected':''}>${w[1]}</option>`).join('')}</select>
        <button id="txtItalic" class="togbtn${m.titalic?' on':''}" title="${T('Italic','Itálica')}" style="height:20px;width:26px;justify-content:center;font-style:italic;font-weight:600;">I</button>
      </div>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
        <div class="seg2" id="txtAlign" style="height:20px;">${[['left','L'],['center','C'],['right','R']].map(a=>`<button data-a="${a[0]}" class="${align===a[0]?'on':''}" title="${a[0]}">${a[1]}</button>`).join('')}</div>
        <input type="number" id="txtSize" value="${m.tfontSize||160}" min="8" max="600" title="${T('Size (px)','Tamaño (px)')}" style="width:54px;${inp}">
        <input type="number" id="txtLineH" value="${(m.tlineH||1.25)}" min="0.7" max="3" step="0.05" title="${T('Line height','Interlineado')}" style="width:50px;${inp}">
        <input type="color" id="txtColor" value="${m.tcolor||'#ffffff'}" title="${T('Color','Color')}" style="width:30px;height:20px;padding:0;background:none;border:none;cursor:pointer;">
        <label style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--ink-2);cursor:pointer;"><input type="checkbox" id="txtStroke" ${m.tstroke?'checked':''}> ${T('Outline','Contorno')}</label>
      </div>
      <button class="mbtn" id="txtLoadFont" style="height:20px;justify-content:center;gap:6px;">${ICO('upload',12)} ${T('Load font…','Cargar fuente…')}</button>`;
    $('#fxRows').appendChild(trow);
    trow.querySelector('#txtContent').value=m.text||'';
    const reTxt=()=>{ const cc=selClip(); if(!cc)return; const mm=mediaById(cc.mediaId); if(!mm)return; mm.text=$('#txtContent').value; mm.tcolor=$('#txtColor').value; mm.tfontSize=+$('#txtSize').value||160; mm.tstroke=$('#txtStroke').checked; mm.tfont=$('#txtFont').value; mm.tweight=$('#txtWeight').value; mm.tlineH=Math.max(0.7,+$('#txtLineH').value||1.25); renderTextMedia(mm); renderMedia(); render(); markDirty(); };
    trow.querySelector('#txtContent').oninput=reTxt; trow.querySelector('#txtColor').oninput=reTxt; trow.querySelector('#txtSize').onchange=reTxt; trow.querySelector('#txtStroke').onchange=reTxt; trow.querySelector('#txtFont').onchange=reTxt; trow.querySelector('#txtWeight').onchange=reTxt; trow.querySelector('#txtLineH').onchange=reTxt;
    trow.querySelector('#txtItalic').onclick=()=>{ const cc=selClip(); if(!cc)return; const mm=mediaById(cc.mediaId); if(!mm)return; mm.titalic=!mm.titalic; trow.querySelector('#txtItalic').classList.toggle('on',mm.titalic); renderTextMedia(mm); renderMedia(); render(); markDirty(); };
    trow.querySelectorAll('#txtAlign button').forEach(b=>b.onclick=()=>{ const cc=selClip(); if(!cc)return; const mm=mediaById(cc.mediaId); if(!mm)return; mm.talign=b.dataset.a; trow.querySelectorAll('#txtAlign button').forEach(x=>x.classList.toggle('on',x===b)); renderTextMedia(mm); renderMedia(); render(); markDirty(); });
    trow.querySelector('#txtLoadFont').onclick=()=>loadCustomFont().then(fam=>{ if(fam){ const cc=selClip(); const mm=cc&&mediaById(cc.mediaId); if(mm){ mm.tfont=fam; renderTextMedia(mm); renderMedia(); render(); markDirty(); } } });
  }
  // Shape editor (only for shape clips)
  if(m && m.kind==='shape'){
    const srow=document.createElement('div'); srow.className='prow'; srow.style.cssText='flex-direction:column;align-items:stretch;gap:6px;';
    srow.innerHTML=`<span class="lab" style="width:auto;">${T('Shape','Forma')}</span>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <select id="shpType" class="selsel" style="height:18px;flex:1;min-width:90px;"><option value="rect">${T('Rectangle','Rectángulo')}</option><option value="ellipse">${T('Ellipse','Elipse')}</option><option value="line">${T('Line','Línea')}</option></select>
        <input type="color" id="shpFill" value="${m.fill||'#ffffff'}" title="${T('Fill','Relleno')}" style="width:32px;height:18px;padding:0;background:none;border:none;cursor:pointer;">
        <input type="color" id="shpStroke" value="${m.stroke||'#000000'}" title="${T('Stroke','Borde')}" style="width:32px;height:18px;padding:0;background:none;border:none;cursor:pointer;">
        <input type="number" id="shpStrokeW" value="${m.strokeW||0}" min="0" max="80" title="${T('Stroke width','Grosor de borde')}" style="width:54px;height:18px;background:var(--s2);border:.5px solid rgba(255,255,255,0.12);border-radius:2px;color:var(--ink);text-align:center;">
      </div>`;
    $('#fxRows').appendChild(srow);
    srow.querySelector('#shpType').value=m.shape||'rect';
    const reShp=()=>{ const cc=selClip(); if(!cc)return; const mm=mediaById(cc.mediaId); if(!mm)return; mm.shape=$('#shpType').value; mm.fill=$('#shpFill').value; mm.stroke=$('#shpStroke').value; mm.strokeW=+$('#shpStrokeW').value||0; renderShapeMedia(mm); renderMedia(); render(); markDirty(); };
    srow.querySelector('#shpType').onchange=reShp; srow.querySelector('#shpFill').oninput=reShp; srow.querySelector('#shpStroke').oninput=reShp; srow.querySelector('#shpStrokeW').onchange=reShp;
  }
  // ===== Motion (procedural infinite animation — Rotator/Translator, keyframe-independent) =====
  { $('#motionRows').innerHTML=''; // [I2] Motion has its own section — clear it each render (it isn't rebuilt via buildRows, so it would otherwise accumulate)
    const anrow=document.createElement('div'); anrow.className='prow'; anrow.style.cssText='flex-direction:column;align-items:stretch;gap:6px;';
    const chips=curAnimPresets().map(pz=>`<button class="animchip" draggable="true" data-k="${pz.key}" style="font-size:11px;padding:3px 9px;border-radius:2px;border:.5px solid rgba(255,255,255,0.14);background:var(--s2);color:var(--ink-2);cursor:grab;">${T(pz.label[0],pz.label[1])}</button>`).join('');
    anrow.innerHTML=`<div style="display:flex;align-items:center;gap:6px;">
        <span style="flex:1"></span>
        <label style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--ink-3);cursor:pointer;" title="${T('Animate live in the editor while paused','Animar en vivo en el editor en pausa')}"><input type="checkbox" id="motionPrev" ${state.motionPreview!==false?'checked':''}> ${T('Live','En vivo')}</label></div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">${chips}</div>
      <div id="animList" style="display:flex;flex-direction:column;gap:6px;"></div>
      <span style="font-size:11px;color:var(--ink-dim);line-height:1.35;">${T('Click or drag a chip onto the clip. Loops forever — independent of keyframes.','Haz clic o arrastra un chip al clip. Bucle infinito, independiente de los keyframes.')}</span>`;
    $('#motionRows').appendChild(anrow);
    $('#motionPrev').onchange=e=>{ state.motionPreview=e.target.checked; if(state.motionPreview)startMotionPreview(); else { stopMotionPreview(); _previewClock=0; render(); } };
    anrow.querySelectorAll('.animchip').forEach(b=>{ b.onclick=()=>{ const cc=selClip(); if(!cc)return; pushUndo(); addAnimPreset(cc,b.dataset.k); buildAnimList(cc); render(); renderTimeline(); startMotionPreview(); markDirty(); };
      b.addEventListener('dragstart', e=>{ try{ e.dataTransfer.setData('text/dsp-anim',b.dataset.k); e.dataTransfer.effectAllowed='copy'; }catch(_){} }); });
    buildAnimList(c);
  }
  applySecCollapse(); // [I1] Transform expanded, Clip/Color/Motion collapsed by default (persisted in state.insCol)
  refreshInspector();
}
/* draw a real (max-abs envelope) waveform, amplitude scaled by the clip volume */
function drawWaveInto(cv,peaks,vol,rms){ const x=cv.getContext('2d'); const W=cv.width,H=cv.height,mid=H/2,amp=H/2-2; x.clearRect(0,0,W,H); x.fillStyle='#12141A'; x.fillRect(0,0,W,H);
  x.strokeStyle='rgba(255,255,255,0.12)'; x.beginPath(); x.moveTo(0,mid+.5); x.lineTo(W,mid+.5); x.stroke();
  const N=peaks?peaks.length:0; if(!N)return; vol=Math.max(0,vol==null?1:vol); rms=rms||peaks;
  x.fillStyle='rgba(158,165,173,0.5)'; // peak (light)
  for(let px=0;px<W;px++){ const pi=Math.min(N-1,Math.floor(px/W*N)); const a=Math.min(1,(peaks[pi]||0)*vol); const bh=Math.max(0.6,a*amp); x.fillRect(px,mid-bh,1,bh*2); }
  x.fillStyle='#C5CAD0'; // RMS body (bright)
  for(let px=0;px<W;px++){ const pi=Math.min(N-1,Math.floor(px/W*N)); const a=Math.min(1,(rms[pi]||0)*vol*1.7); const bh=Math.max(0.4,a*amp); x.fillRect(px,mid-bh,1,bh*2); } }
/* Audio-clip inspector: waveform + per-clip Volume + Fade in/out (dome transform/FX hidden) */
function buildAudioInspector(c,m){ const host=$('#insAudio'); if(!host)return; const vol=(c.props&&c.props.volume!=null)?c.props.volume:100;
  const inp='width:64px;height:18px;background:var(--s2);border:.5px solid rgba(255,255,255,0.12);border-radius:2px;color:var(--ink);text-align:center;font-size:11px;';
  host.innerHTML=`<button class="sechead"><span style="color:var(--ink-dim);display:flex;">${ICO('chevDown',13)}</span><span class="t">${T('Audio','Audio')}</span><span class="ln"></span></button>
    <div style="padding:8px 14px;display:flex;flex-direction:column;gap:12px;">
      <canvas id="auWave" width="248" height="56" style="width:100%;height:56px;border-radius:2px;"></canvas>
      <div class="prow"><span class="lab" style="width:64px;">${T('Volume','Volumen')}</span><input type="range" id="auVol" min="0" max="200" value="${Math.round(vol)}" style="flex:1;height:16px;"><span class="tnum" id="auVolV" style="width:40px;text-align:right;font-size:11px;color:var(--ink-2);">${Math.round(vol)}%</span></div>
      <div class="prow"><span class="lab" style="width:64px;">${T('Fade in','Entrada')}</span><input type="number" id="auFi" class="tnum" value="${(+(c.fadeIn||0)).toFixed(2)}" min="0" max="60" step="0.1" style="${inp}"><span style="color:var(--ink-dim);font-size:11px;">s</span></div>
      <div class="prow"><span class="lab" style="width:64px;">${T('Fade out','Salida')}</span><input type="number" id="auFo" class="tnum" value="${(+(c.fadeOut||0)).toFixed(2)}" min="0" max="60" step="0.1" style="${inp}"><span style="color:var(--ink-dim);font-size:11px;">s</span></div>
      <div class="prow"><span class="lab" style="width:64px;">${T('Waveform','Onda')}</span><label style="display:flex;align-items:center;gap:6px;flex:1;font-size:11px;color:var(--ink-2);cursor:pointer;"><input type="checkbox" id="auHalf" ${state.tl.waveTopHalf?'checked':''}> ${T('Single-sided (Premiere-style)','Un solo lado (estilo Premiere)')}</label></div>
      <div style="font-size:11px;color:var(--ink-dim);line-height:1.4;">${T('Zoom the timeline in to see transients in sample detail. Per-clip volume & fades; each copy plays independently.','Acércate en la línea de tiempo para ver transientes con detalle de muestra. Volumen y fundidos por clip; cada copia suena independiente.')}</div>
    </div>`;
  const cv=host.querySelector('#auWave'); if(cv&&m&&m.peaks)drawWaveInto(cv,m.peaks,vol/100,m.rms);
  { const hf=host.querySelector('#auHalf'); if(hf)hf.onchange=()=>{ state.tl.waveTopHalf=hf.checked; redrawAudioWaves(); markDirty(); }; }
  const vr=host.querySelector('#auVol'), vv=host.querySelector('#auVolV');
  vr.onpointerdown=()=>{ const cc=selClip(); if(cc)pushUndo(); };
  vr.oninput=()=>{ const cc=selClip(); if(!cc)return; cc.props.volume=+vr.value; vv.textContent=(+vr.value)+'%'; if(cv&&m&&m.peaks)drawWaveInto(cv,m.peaks,(+vr.value)/100,m.rms); scheduleWaves(); liveAudioGain(cc); };
  vr.onchange=()=>{ renderTimeline(); markDirty(); };
  const fi=host.querySelector('#auFi'), fo=host.querySelector('#auFo');
  fi.onchange=()=>{ const cc=selClip(); if(!cc)return; pushUndo(); cc.fadeIn=Math.max(0,+fi.value||0); renderTimeline(); if(state.playing)startAudio(); markDirty(); };
  fo.onchange=()=>{ const cc=selClip(); if(!cc)return; pushUndo(); cc.fadeOut=Math.max(0,+fo.value||0); renderTimeline(); if(state.playing)startAudio(); markDirty(); };
}
/* [I3] pen (point) mask editor: draw silhouettes with points, invert, feather, expand — several per clip. Renders through
   rasterizePenMasks → c.maskTex (the custom-mask sampler). Points are 0..1 in the clip's mask space. */
function buildPenMaskUI(host,c){ if(!c)return; const S=220; const masks=c.penMasks||(c.penMasks=[]);
  if(c._penSel==null||c._penSel>=masks.length) c._penSel=masks.length?masks.length-1:-1;
  const wrap=document.createElement('div'); wrap.className='prow'; wrap.style.cssText='flex-direction:column;align-items:stretch;gap:6px;';
  wrap.innerHTML=`<div style="display:flex;align-items:center;gap:6px;">
      <span class="lab" style="width:auto;color:var(--ink-2);">${T('Point mask','Máscara de puntos')}</span><span style="flex:1"></span>
      <button class="mbtn" id="penAdd" style="height:18px;padding:0 8px;">${ICO('plus',11)} ${T('Add mask','Añadir máscara')}</button></div>
    <canvas id="penCv" width="${S}" height="${S}" style="width:100%;aspect-ratio:1;border:.5px solid rgba(255,255,255,0.12);border-radius:2px;background:#0c0d10;cursor:crosshair;touch-action:none;display:${masks.length?'block':'none'};"></canvas>
    <div id="penList" style="display:flex;flex-direction:column;gap:3px;"></div>
    <div class="prow" id="penExpRow" style="padding:0;gap:6px;display:${masks.length?'flex':'none'};"><span class="lab" style="width:auto;color:var(--ink-3);">${T('Expand','Expandir')}</span><input type="range" id="penExp" min="20" max="200" value="${Math.round((c.penExpand||1)*100)}" style="flex:1;"><span class="tnum" id="penExpV" style="width:38px;text-align:right;color:var(--ink-dim);">${Math.round((c.penExpand||1)*100)}%</span></div>
    <span style="font-size:11px;color:var(--ink-dim);line-height:1.35;display:${masks.length?'block':'none'}" id="penHint">${T('Click the canvas to add points · drag to move · double-click a point to remove.','Clic en el lienzo para añadir puntos · arrastra para mover · doble clic en un punto para quitarlo.')}</span>`;
  host.appendChild(wrap);
  const cv=wrap.querySelector('#penCv'), ctx=cv.getContext('2d'), m=mediaById(c.mediaId);
  const draw=()=>{ ctx.clearRect(0,0,S,S); ctx.fillStyle='#0c0d10'; ctx.fillRect(0,0,S,S);
    if(m&&m.thumb){ ctx.globalAlpha=0.18; const im=draw._im||(draw._im=new Image()); if(im.src!==m.thumb){ im.onload=draw; im.src=m.thumb; } if(im.complete&&im.naturalWidth)ctx.drawImage(im,0,0,S,S); ctx.globalAlpha=1; }
    ctx.strokeStyle='rgba(255,255,255,0.06)'; ctx.beginPath(); ctx.moveTo(S/2,0);ctx.lineTo(S/2,S);ctx.moveTo(0,S/2);ctx.lineTo(S,S/2);ctx.stroke();
    const ex=Math.max(0.2,c.penExpand||1);
    (c.penMasks||[]).forEach((mk,mi)=>{ if(!mk.pts||!mk.pts.length)return; const active=mi===c._penSel; const P=p=>[(0.5+(p[0]-0.5)*ex)*S,(0.5+(p[1]-0.5)*ex)*S];
      ctx.lineWidth=active?1.5:1; ctx.strokeStyle=active?'#4FC3E8':'rgba(255,255,255,0.4)'; ctx.fillStyle=active?'rgba(79,195,232,0.10)':'rgba(255,255,255,0.05)';
      ctx.beginPath(); mk.pts.forEach((p,i)=>{ const q=P(p); i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]); }); if(mk.pts.length>=3)ctx.closePath(); ctx.fill(); ctx.stroke();
      if(active)mk.pts.forEach(p=>{ const q=P(p); ctx.fillStyle='#4FC3E8'; ctx.beginPath(); ctx.arc(q[0],q[1],3.6,0,6.283); ctx.fill(); ctx.fillStyle='#0c0d10'; ctx.beginPath(); ctx.arc(q[0],q[1],1.5,0,6.283); ctx.fill(); }); }); };
  const commit=()=>{ rasterizePenMasks(c); render(); markDirty(); draw(); };
  const rebuildList=()=>{ const L=wrap.querySelector('#penList'); L.innerHTML='';
    (c.penMasks||[]).forEach((mk,mi)=>{ const row=document.createElement('div'); row.style.cssText='display:flex;align-items:center;gap:5px;font-size:11px;padding:2px 3px;border-radius:2px;background:'+(mi===c._penSel?'rgba(79,195,232,0.14)':'transparent')+';';
      row.innerHTML=`<button class="penSel" title="${T('Edit this mask','Editar esta máscara')}" style="width:15px;height:15px;border:none;background:none;color:${mi===c._penSel?'#4FC3E8':'var(--ink-3)'};cursor:pointer;font-size:10px;">◆</button>
        <span style="flex:0 0 auto;color:var(--ink-2);">${T('Mask','Máscara')} ${mi+1}</span>
        <label style="display:flex;align-items:center;gap:3px;color:var(--ink-3);cursor:pointer;"><input type="checkbox" class="penInv" ${mk.invert?'checked':''}> ${T('Invert','Invertir')}</label>
        <span style="color:var(--ink-3);flex-shrink:0;">${T('Feather','Suavizar')}</span><input type="range" class="penFe" min="0" max="60" value="${Math.round(mk.feather||0)}" style="flex:1;min-width:24px;">
        <button class="penDel" title="${T('Delete mask','Eliminar máscara')}" style="width:15px;height:15px;border:none;background:none;color:var(--ink-3);cursor:pointer;">✕</button>`;
      L.appendChild(row);
      row.querySelector('.penSel').onclick=()=>{ c._penSel=mi; rebuildList(); draw(); };
      row.querySelector('.penInv').onchange=e=>{ pushUndo(); mk.invert=e.target.checked; commit(); };
      const fe=row.querySelector('.penFe'); fe.oninput=e=>{ mk.feather=+e.target.value; rasterizePenMasks(c); render(); }; fe.onpointerdown=()=>pushUndo(); fe.onchange=()=>markDirty();
      row.querySelector('.penDel').onclick=()=>{ pushUndo(); c.penMasks.splice(mi,1); if(c._penSel>=c.penMasks.length)c._penSel=c.penMasks.length-1;
        const vis=c.penMasks.length?'block':'none'; cv.style.display=vis; wrap.querySelector('#penExpRow').style.display=c.penMasks.length?'flex':'none'; wrap.querySelector('#penHint').style.display=vis;
        if(!penMaskActive(c)&&c.props.mask==='pen')c.props.mask='none'; rebuildList(); commit(); }; }); };
  const toXY=e=>{ const r=cv.getBoundingClientRect(); const ex=Math.max(0.2,c.penExpand||1); // invert the expand so dragging lands where the cursor is
    return [Math.max(0,Math.min(1,0.5+(((e.clientX-r.left)/r.width)-0.5)/ex)), Math.max(0,Math.min(1,0.5+(((e.clientY-r.top)/r.height)-0.5)/ex))]; };
  const hit=(mk,xy)=>{ if(!mk||!mk.pts)return -1; const tol=(11/S); for(let i=0;i<mk.pts.length;i++){ const dx=mk.pts[i][0]-xy[0],dy=mk.pts[i][1]-xy[1]; if(dx*dx+dy*dy<tol*tol)return i; } return -1; };
  let drag=null;
  cv.addEventListener('pointerdown',e=>{ e.preventDefault(); const mk=c.penMasks[c._penSel]; if(!mk)return; const xy=toXY(e); const hi=hit(mk,xy);
    if(hi>=0){ drag={pi:hi}; pushUndo(); try{cv.setPointerCapture(e.pointerId);}catch(_){} } else { pushUndo(); mk.pts.push(xy); commit(); } });
  cv.addEventListener('pointermove',e=>{ if(!drag)return; const mk=c.penMasks[c._penSel]; if(!mk)return; mk.pts[drag.pi]=toXY(e); rasterizePenMasks(c); render(); draw(); });
  cv.addEventListener('pointerup',()=>{ if(drag){ drag=null; markDirty(); } });
  cv.addEventListener('dblclick',e=>{ const mk=c.penMasks[c._penSel]; if(!mk)return; const hi=hit(mk,toXY(e)); if(hi>=0&&mk.pts.length>3){ pushUndo(); mk.pts.splice(hi,1); commit(); } });
  wrap.querySelector('#penAdd').onclick=()=>{ pushUndo(); c.penMasks=c.penMasks||[]; c.penMasks.push({pts:[[0.35,0.35],[0.65,0.35],[0.65,0.65],[0.35,0.65]],feather:0,invert:false,on:true}); c._penSel=c.penMasks.length-1;
    cv.style.display='block'; wrap.querySelector('#penExpRow').style.display='flex'; wrap.querySelector('#penHint').style.display='block'; rebuildList(); commit(); };
  const expR=wrap.querySelector('#penExp'); if(expR){ expR.onpointerdown=()=>pushUndo(); expR.oninput=()=>{ c.penExpand=Math.max(0.2,(+expR.value)/100); wrap.querySelector('#penExpV').textContent=(+expR.value)+'%'; rasterizePenMasks(c); render(); draw(); }; expR.onchange=()=>markDirty(); }
  rebuildList(); if(masks.length)draw();
}
/* build the per-clip list of active motion modifiers into #animList */
function animWetKfAt(a,c){ if(!a.wetKf)return null; const lt=state.playhead-c.start; return a.wetKf.find(k=>Math.abs(k.t-lt)<0.03)||null; }
function animSetWet(a,c,v){ v=Math.max(0,Math.min(1,v)); if(a.wetKf&&a.wetKf.length){ const lt=Math.max(0,state.playhead-c.start); const i=a.wetKf.findIndex(k=>Math.abs(k.t-lt)<0.03); if(i>=0)a.wetKf[i].v=v; else { a.wetKf.push({t:lt,v,e:'linear'}); a.wetKf.sort((x,y)=>x.t-y.t); } } else a.wet=v; }
function animToggleWetKf(a,c){ if(!a.wetKf)a.wetKf=[]; const ex=animWetKfAt(a,c); if(ex){ a.wetKf=a.wetKf.filter(k=>k!==ex); if(!a.wetKf.length){ a.wet=(a.wet!=null?a.wet:1); delete a.wetKf; } } else { const lt=Math.max(0,state.playhead-c.start); a.wetKf.push({t:lt, v:Math.max(0,Math.min(1,evalWet(c,a,state.playhead))), e:'linear'}); a.wetKf.sort((x,y)=>x.t-y.t); } }
/* keep the Mix sliders / keyframe dots in sync with the playhead (called from refreshInspector on scrub) */
function refreshMotionWet(){ const c=selClip(); const host=$('#animList'); if(!c||!c.anim||!host)return; host.querySelectorAll('[data-ai]').forEach(it=>{ const a=c.anim[+it.dataset.ai]; if(!a)return; const p=Math.round(Math.max(0,Math.min(1,evalWet(c,a,state.playhead)))*100); const r=it.querySelector('.awet'), v=it.querySelector('.awetv'), kb=it.querySelector('.awetkf'); if(r&&document.activeElement!==r)r.value=p; if(v)v.textContent=p+'%'+((a.wetKf&&a.wetKf.length)?' ◆':''); if(kb){ const hasKf=!!(a.wetKf&&a.wetKf.length), kfHere=!!animWetKfAt(a,c); kb.style.color=hasKf?(kfHere?'#FFFFFF':'#C9CDD3'):'#5A6069'; } }); }
function buildAnimList(c){ const host=$('#animList'); if(!host)return; host.innerHTML='';
  if(!c||!c.anim||!c.anim.length){ host.innerHTML=`<span style="font-size:11px;color:#4d525a;">${T('No motion yet.','Sin movimiento aún.')}</span>`; return; }
  c.anim.forEach((a,i)=>{ const item=document.createElement('div'); item.dataset.ai=i; item.style.cssText='display:flex;flex-direction:column;gap:4px;background:#1b1e24;border:.5px solid rgba(255,255,255,0.09);border-radius:2px;padding:5px 6px;';
    const isWave=a.mode==='wave'; const wetPct=Math.round(Math.max(0,Math.min(1,evalWet(c,a,state.playhead)))*100);
    const hasKf=!!(a.wetKf&&a.wetKf.length), kfHere=!!animWetKfAt(a,c);
    item.innerHTML=`<div style="display:flex;align-items:center;gap:6px;">
        <button class="animon" title="${T('On/off','Activar/desactivar')}" style="width:15px;height:15px;border-radius:50%;border:none;cursor:pointer;background:${a.on?'#C9CDD3':'#3a3f47'};flex-shrink:0;"></button>
        <select class="asel aparam" style="height:18px;flex:1;min-width:58px;">${ANIM_PARAMS.map(([v,en,es])=>`<option value="${v}" ${a.param===v?'selected':''}>${T(en,es)}</option>`).join('')}</select>
        <select class="asel amode" style="height:18px;width:56px;"><option value="linear" ${!isWave?'selected':''}>${T('Loop','Bucle')}</option><option value="wave" ${isWave?'selected':''}>${T('Wave','Onda')}</option></select>
        <input class="anum aspeed" type="number" step="0.05" value="${a.speed}" title="${T('Speed (°/s or Hz)','Velocidad (°/s o Hz)')}" style="width:48px;height:24px;text-align:center;">
        <input class="anum aamp" type="number" step="1" value="${a.amp}" title="${T('Amount','Amplitud')}" style="width:42px;height:24px;text-align:center;${isWave?'':'visibility:hidden;'}">
        <button class="animdel" title="${T('Remove','Quitar')}" style="width:15px;height:22px;border:none;background:none;color:var(--ink-2);cursor:pointer;font-size:13px;line-height:1;">×</button></div>
      <div style="display:flex;align-items:center;gap:6px;">
        <button class="awetkf" title="${T('Keyframe the mix at the playhead — define when it ramps in','Fotograma del mix en el cabezal — define cuándo entra')}" style="width:16px;height:16px;border:none;background:none;cursor:pointer;color:${hasKf?(kfHere?'#FFFFFF':'#C9CDD3'):'#5A6069'};font-size:11px;line-height:1;flex-shrink:0;">◆</button>
        <span style="font-size:11px;color:var(--ink-3);width:22px;">${T('Mix','Mix')}</span>
        <input class="awet" type="range" min="0" max="100" value="${wetPct}" title="${T('Dry/wet 0–100% (multiplier)','Dry/wet 0–100% (multiplicador)')}" style="flex:1;height:15px;">
        <span class="awetv" style="font-size:11px;color:var(--ink-2);width:36px;text-align:right;">${wetPct}%${hasKf?' ◆':''}</span></div>`;
    item.querySelectorAll('.anum').forEach(el=>{ el.style.background='#24272C'; el.style.border='.5px solid rgba(255,255,255,0.12)'; el.style.borderRadius='2px'; el.style.color='#E8EAED'; el.style.fontSize='11px'; }); // [U-17] .asel now styled by the shared select rule (inline background here would wipe its chevron)
    item.querySelector('.animon').onclick=()=>{ a.on=!a.on; buildAnimList(selClip()); render(); renderTimeline(); startMotionPreview(); markDirty(); };
    item.querySelector('.aparam').onchange=e=>{ a.param=e.target.value; render(); startMotionPreview(); markDirty(); };
    item.querySelector('.amode').onchange=e=>{ a.mode=e.target.value; if(a.mode==='wave'&&!a.amp)a.amp=15; buildAnimList(selClip()); render(); startMotionPreview(); markDirty(); };
    item.querySelector('.aspeed').onchange=e=>{ a.speed=+e.target.value||0; render(); startMotionPreview(); markDirty(); };
    item.querySelector('.aamp').onchange=e=>{ a.amp=+e.target.value||0; render(); startMotionPreview(); markDirty(); };
    item.querySelector('.animdel').onclick=()=>{ pushUndo(); c.anim.splice(i,1); if(!c.anim.length)delete c.anim; buildAnimList(selClip()); render(); renderTimeline(); markDirty(); if(!anyAnim())stopMotionPreview(); };
    const wetR=item.querySelector('.awet'), wetV=item.querySelector('.awetv');
    wetR.oninput=()=>{ animSetWet(a,c,(+wetR.value)/100); wetV.textContent=(+wetR.value)+'%'+((a.wetKf&&a.wetKf.length)?' ◆':''); render(); startMotionPreview(); };
    wetR.onchange=()=>markDirty();
    item.querySelector('.awetkf').onclick=()=>{ pushUndo(); animToggleWetKf(a,c); buildAnimList(selClip()); render(); renderTimeline(); startMotionPreview(); markDirty(); };
    host.appendChild(item); });
}
function fadeDrag(box,key){ box.addEventListener('pointerdown',e=>{e.preventDefault();const c=selClip();const x0=e.clientX,v0=c[key]||0;pushUndo();
  const mv=ev=>{c[key]=Math.max(0,Math.min(c.dur/2,v0+(ev.clientX-x0)*0.02));box.querySelector('.num').textContent=c[key].toFixed(1);renderTimeline();render();};
  const up=()=>{window.removeEventListener('pointermove',mv);window.removeEventListener('pointerup',up);};window.addEventListener('pointermove',mv);window.addEventListener('pointerup',up);});}
function buildRows(sel,defs,c){ const host=$(sel); host.innerHTML='';
  for(const [p,label,unit,mn,mx] of defs){
    const row=document.createElement('div'); row.className='prow'+(hasKf(c,p)?' auto':''); // .auto = param already automated → brighter label (Ableton-style)
    row.innerHTML=`<span class="lab">${propLabel(p)}</span>
      <div class="field" data-p="${p}"><div class="track"><i style="width:0%"></i></div><div class="modarc"></div><div class="box"><span class="num">0</span><span class="u">${unit}</span></div></div>
      <button class="modb" data-p="${p}" title="${T('Modulation — LFO · audio · dome space','Modulación — LFO · audio · espacio del domo')}">${ICO('react',11)}</button>
      <div class="nav"><button data-k="prev" title="${T('Previous keyframe','Fotograma anterior')}">${ICO('kfprev',12)}</button><button data-k="add" title="${T('Add / remove keyframe here · right-click to clear automation','Añadir / quitar fotograma aquí · clic derecho borra la automatización')}">${ICO('diamond',12)}</button><button data-k="next" title="${T('Next keyframe','Fotograma siguiente')}">${ICO('kfnext',12)}</button></div>`;
    host.appendChild(row);
    row.querySelector('.modb').onclick=ev=>{ ev.stopPropagation(); openModPanel(selClip(),p,ev.currentTarget); }; // [R95·C1] the modulation stack lives behind this button
    // [A1] single point button: the diamond toggles a keyframe at the playhead (add if none / remove if on one); the first one reveals the curve on the track; right-click clears the whole automation
    row.querySelector('[data-k=add]').onclick=()=>{ const cc=selClip(); if(!cc)return; if(state.playhead<cc.start-1e-6||state.playhead>cc.start+cc.dur+1e-6){flashStatus(T('The playhead is outside this clip','El cabezal está fuera de este clip'),'err');return;}
      const wasAuto=hasKf(cc,p), onKf=kfAt(cc,p); pushUndo();
      if(onKf){ cc.kf[p]=cc.kf[p].filter(k=>k!==onKf); if(!cc.kf[p].length){ const v=evalP(cc,p,state.playhead); delete cc.kf[p]; cc.props[p]=v; } } // remove the point under the playhead; last one freezes the value
      else { setKf(cc,p,state.playhead,evalP(cc,p,state.playhead),curEase()); if(!wasAuto)openAuto(cc,p); } // first point reveals the single automation overlay on the track
      renderInspector();renderTimeline();render();markDirty(); };
    row.querySelector('[data-k=add]').oncontextmenu=e=>{ e.preventDefault(); const cc=selClip(); if(!cc||!hasKf(cc,p))return; const v=evalP(cc,p,state.playhead); pushUndo(); clearKf(cc,p); cc.props[p]=v; flashStatus(T('Automation cleared — Ctrl+Z restores it','Automatización borrada — Ctrl+Z la restaura')); renderInspector();renderTimeline();render();markDirty(); }; // [A1] right-click the diamond = remove the whole curve (freezes at the current value)
    row.querySelector('[data-k=prev]').onclick=()=>jumpKf(p,-1); row.querySelector('[data-k=next]').onclick=()=>jumpKf(p,1);
    const field=row.querySelector('.field'); const box=row.querySelector('.box');
    field.addEventListener('pointerdown',e=>{ if(e.target.tagName==='INPUT')return; startValDrag(e,p,mn,mx); });
    box.addEventListener('dblclick',e=>{ e.stopPropagation(); editNumberBox(box,p,mn,mx); });
    box.addEventListener('wheel',e=>{ e.preventDefault(); const cc=selClip(); if(!cc)return; const step=(e.shiftKey?0.1:e.altKey?5:1)*(e.deltaY<0?1:-1); const lo=UNBOUNDED_P.has(p)?-1e6:mn, hi=UNBOUNDED_P.has(p)?1e6:mx; pushUndo(); manualEdit(cc,p,Math.max(lo,Math.min(hi,evalP(cc,p,state.playhead)+step))); refreshInspector(); renderTimeline(); render(); },{passive:false}); // Pos X/Y unbounded when driven directly on the number (the fader keeps its visual range)
    field.addEventListener('contextmenu',e=>{ e.preventDefault(); const cc=selClip(); const def={az:0,el:35,size:55,rot:0,opacity:100,exposure:0,contrast:0,saturation:0,temperature:0,tint:0,glow:0,chroma:0,blur:0,feather:0,crop:0}[p]; if(def==null)return; pushUndo(); if(hasKf(cc,p))setKf(cc,p,state.playhead,def,curEase());else cc.props[p]=def; refreshInspector();renderTimeline();render(); });
  }
}
const UNBOUNDED_P=new Set(['x','y']); // params whose typed/wheeled number is not clamped to the fader range (Pos X / Pos Y → infinite)
function editNumberBox(box,p,mn,mx){ const c=selClip(); if(!c)return; const cur=evalP(c,p,state.playhead); const num=box.querySelector('.num');
  const inp=document.createElement('input'); inp.type='text'; inp.className='numedit'; inp.value=Math.round(cur*100)/100; num.style.display='none'; box.insertBefore(inp,num); inp.focus(); inp.select();
  let done=false; const commit=ok=>{ if(done)return; done=true; if(ok){ const v=parseFloat(inp.value.replace(',','.')); if(!isNaN(v)){ const lo=UNBOUNDED_P.has(p)?-1e6:mn, hi=UNBOUNDED_P.has(p)?1e6:mx; pushUndo(); manualEdit(c,p,Math.max(lo,Math.min(hi,v))); } } inp.remove(); num.style.display=''; refreshInspector(); renderTimeline(); render(); };
  inp.addEventListener('blur',()=>commit(true));
  inp.addEventListener('keydown',e=>{ e.stopPropagation(); if(e.key==='Enter')commit(true); else if(e.key==='Escape')commit(false); }); }
function renderGroupInspector(g){ const host=$('#insGroup'); const n=groupMembers(g).length; const MASKS=['none','circle','rounded','diamond','vignette'];
  host.innerHTML=`
    <div class="selhead"><div class="selthumb" style="display:grid;place-items:center;color:var(--ink-2);">${ICO('ring',18)}</div>
      <div style="flex:1;min-width:0;"><div class="selname">${g.name}</div><div class="selmeta">${T(kindES(g.kind)+' composition','Composición '+kindES(g.kind))} · ${n} ${T('items','elementos')}</div></div></div>
    <button class="sechead"><span style="color:var(--ink-dim);display:flex;">${ICO('chevDown')}</span><span class="t">${T('Group · Transform all','Grupo · Transformar todo')}</span><span class="ln"></span></button>
    <div class="prow"><span class="kf" style="cursor:default;"></span><span class="lab">${T('Count','Cantidad')}</span><input type="number" class="tnum" id="gCount" value="${g.count}" min="2" max="32" style="width:64px;height:18px;background:var(--s2);border:.5px solid rgba(255,255,255,0.12);border-radius:2px;color:var(--ink);text-align:center;"></div>
    <div class="prow"><span class="kf" style="cursor:default;"></span><span class="lab">${T('Spin','Giro')}</span><input type="range" class="grprng" id="gSpin" min="0" max="360" value="${Math.round(g.spin)}"><span class="num" id="gSpinV" style="width:42px;text-align:right;">${Math.round(g.spin)}°</span></div>
    <div class="prow"><span class="kf" style="cursor:default;"></span><span class="lab">${T('Elevation','Elevación')}</span><input type="range" class="grprng" id="gEl" min="0" max="90" value="${Math.round(g.el)}"><span class="num" id="gElV" style="width:42px;text-align:right;">${Math.round(g.el)}°</span></div>
    <div class="prow"><span class="kf" style="cursor:default;"></span><span class="lab">${T('Size','Tamaño')}</span><input type="range" class="grprng" id="gSize" min="5" max="160" value="${Math.round(g.size)}"><span class="num" id="gSizeV" style="width:42px;text-align:right;">${Math.round(g.size)}°</span></div>
    <div class="prow"><span class="kf" style="cursor:default;"></span><span class="lab">${T('Mask','Máscara')}</span><select class="selsel" id="gMask" style="flex:1;height:18px;">${MASKS.map(k=>`<option value="${k}" ${g.mask===k?'selected':''}>${maskES(k)}</option>`).join('')}</select></div>
    <div style="display:flex;gap:8px;padding:12px 14px 6px;"><button class="togbtn" id="gReshape" style="flex:1;justify-content:center;">${ICO('ring',13)} ${T('Reshape…','Reconfigurar…')}</button><button class="togbtn" id="gUngroup" style="flex:1;justify-content:center;">${T('Ungroup','Desagrupar')}</button></div>
    <div style="padding:0 14px 12px;"><button class="mbtn" id="gDelete" style="width:100%;justify-content:center;color:var(--ink-2);border-color:rgba(201,205,211,0.4);background:transparent;">${ICO('trash',13)} ${T('Delete composition','Eliminar composición')}</button></div>
    <div style="padding:0 14px 16px;font-size:11px;color:var(--ink-dim);line-height:1.5;">${T('Click any item in the timeline to edit it individually — group transforms preserve your per-item tweaks.','Haz clic en cualquier elemento de la línea de tiempo para editarlo individualmente: las transformaciones de grupo conservan tus ajustes por elemento.')}</div>`;
  $('#gCount').onchange=e=>{ pushUndo(); g.count=Math.max(2,Math.min(32,+e.target.value)); regenComp(g); renderTimeline(); renderInspector(); render(); updStatus(); };
  $('#gSpin').oninput=e=>{ groupSpin(g,+e.target.value); $('#gSpinV').textContent=Math.round(g.spin)+'°'; };
  $('#gEl').oninput=e=>{ groupRaise(g,+e.target.value); $('#gElV').textContent=Math.round(g.el)+'°'; };
  $('#gSize').oninput=e=>{ groupScale(g,+e.target.value); $('#gSizeV').textContent=Math.round(g.size)+'°'; };
  ['#gSpin','#gEl','#gSize'].forEach(id=>$(id).addEventListener('pointerdown',()=>{ pushUndo(); g._elB=g.el; g._szB=g.size; for(const cc of groupMembers(g)){ cc._elB=cc.props.el; cc._szB=cc.props.size; } }));
  $('#gMask').onchange=e=>{ pushUndo(); groupSetMask(g,e.target.value); };
  $('#gReshape').onclick=()=>openCompose(g.kind,g);
  $('#gUngroup').onclick=()=>deleteGroup(g.id,true);
  $('#gDelete').onclick=()=>deleteGroup(g.id,false);
}
function refreshInspector(){ const c=selClip(); if(!c)return; const t=state.playhead;
  refreshMotionWet(); refreshModFormula(); // keep the Motion Mix sliders / keyframe dots + the modulation audit line synced to the playhead
  for(const sel of ['#tfRows','#fxRows','#colorRows']) $$(sel+' .prow').forEach(row=>{ const field=row.querySelector('.field'); if(!field||!field.dataset.p)return; const p=field.dataset.p; const def=TF.concat(TF_FLAT).concat(FX).find(d=>d[0]===p); if(!def)return; const [_,__,unit,mn,mx]=def;
    const v=evalP(c,p,t); const vm=evalR(c,p,t); const md=hasMod(c,p); // [R95·C1] base vs resolved: the number reads the FINAL value, the track keeps the base — like Bitwig's ring over the knob
    row.classList.toggle('modon',!!md);
    row.querySelector('.num').textContent=Math.round((md?vm:v)*10)/10; row.querySelector('.track>i').style.width=((v-mn)/(mx-mn)*100)+'%';
    if(md){ const arc=row.querySelector('.modarc'); if(arc){ const a=Math.max(0,Math.min(100,(v-mn)/(mx-mn)*100)), b=Math.max(0,Math.min(100,(vm-mn)/(mx-mn)*100));
      arc.style.setProperty('--m0',Math.min(a,b)+'%'); arc.style.setProperty('--m1',Math.max(a,b)+'%'); } } // the span between base and modulated = what the modulation is doing right now
    row.classList.toggle('auto',!!hasKf(c,p)); // [A1] automated state = the row highlight (Ableton-style brighter label); the stopwatch is gone
    const ab=row.querySelector('[data-k=add]'); if(ab)ab.classList.toggle('on',!!kfAt(c,p)); // filled diamond = the playhead sits on a keyframe of this param
  });
}
function kfAt(c,p){ if(!hasKf(c,p))return null; const lt=state.playhead-c.start; return c.kf[p].find(k=>Math.abs(k.t-lt)<0.06)||null; }
function jumpKf(p,dir){ const c=selClip(); if(!hasKf(c,p))return; const lt=state.playhead-c.start; const ks=c.kf[p];
  let target=null; if(dir>0){for(const k of ks)if(k.t>lt+1e-3){target=k.t;break;}} else {for(let i=ks.length-1;i>=0;i--)if(ks[i].t<lt-1e-3){target=ks[i].t;break;}}
  if(target!=null){state.playhead=c.start+target;scrubRender();} }
function startValDrag(e,p,mn,mx){ e.preventDefault(); const c=selClip(); const x0=e.clientX; const v0=evalP(c,p,state.playhead); const span=(mx-mn);
  const mv=ev=>{ let sp=span/300; if(ev.shiftKey)sp/=5; if(ev.altKey)sp*=4; let nv=Math.max(mn,Math.min(mx,v0+(ev.clientX-x0)*sp));
    if(!startValDrag._pushed){pushUndo();startValDrag._pushed=true;} manualEdit(c,p,nv); refreshInspector(); renderTimeline(); render(); };
  const up=()=>{startValDrag._pushed=false;window.removeEventListener('pointermove',mv);window.removeEventListener('pointerup',up);};
  window.addEventListener('pointermove',mv);window.addEventListener('pointerup',up); }
$('#mirrorBtn').onclick=()=>{const c=selClip();if(!c)return;pushUndo();c.props.mirror=!c.props.mirror;$('#mirrorBtn').classList.toggle('on',c.props.mirror);render();};

/* ===================== CURVE EDITOR ===================== */
const CURVE_PARAMS=TF.concat(TF_FLAT).concat(FX);
/* [R92-T4] one FIXED hue per parameter (Ableton benchmark: with several lanes open, grey-on-grey was
   indistinguishable). Warm = transform · cool = optics · magenta/gold = color grade. Used consistently by
   the inspector swatch, the lane chip, the curve, and the breakpoints. */
/* [R95·E1] every parameter owns a HUE — never grey/white: the colour is what ties the header bar, the clip overlay and
   the sub-lane together (Blender's channel-swatch model). opacity/crop/contrast used to be greys, so their curve read as
   "no colour" and broke the mapping. Warm = transform · cool = optics · magenta/gold = colour grade. */
const PCOLOR={ az:'#E0954B', el:'#D8C24B', size:'#E0645C', rot:'#C58BD0', x:'#E0954B', y:'#D8C24B', scale:'#E0645C',
  opacity:'#7FB2E8', blur:'#4FB3C9', feather:'#6FBF95', crop:'#8FA8C0',
  exposure:'#E8C84B', contrast:'#B0C4DE', saturation:'#D06FB0', temperature:'#E08A4B', tint:'#B08AD0', glow:'#F0E68C', chroma:'#5FC9A8' };
/* [2] "Curves" no longer opens a window — it toggles the inline automation sub-lanes shown under the clips */
/* [R94-UT2·U-09] automation mode drives a body class: marks the
   clip title band as the grab zone (CSS in index.html). Called wherever state.inlineCurves changes. */
function syncAutoUI(){ document.body.classList.toggle('automode',!!state.inlineCurves); }
function toggleCurves(){ state.inlineCurves=!state.inlineCurves; $('#curvesBtn').classList.toggle('on',state.inlineCurves); syncAutoUI();
  // [R94b] no teaching flash — the button state is the feedback; the grammar lives in the hover tooltips (1s)
  renderTimeline(); }
/* [A1] The legacy "Curves" drawer was removed — automation now lives entirely in inline sub-lanes (drawAutoCurve).
   initBez is kept because the inline auto-curve menus reuse it to seed freeform bezier handles. */
function initBez(c,p,k){ const ks=c.kf[p]; const i=ks.indexOf(k); k.e='bezier';
  const nxt=ks[i+1], prv=ks[i-1];
  if(nxt){ const seg=nxt.t-k.t; k.hOut={dt:seg/3, dv:(nxt.v-k.v)/3}; }
  if(prv){ const seg=k.t-prv.t; k.hIn={dt:-seg/3, dv:-(k.v-prv.v)/3}; } }

/* ===================== INLINE AUTOMATION SUB-LANES (Ableton-style) — item [2] + re-enable [21] ===================== */
const AUTO_H=58, AUTO_MIN_H=30, AUTO_MAX_H=240, RES_TOP=15;
function autoColor(p){ if(PCOLOR[p])return PCOLOR[p]; if(typeof p==='string'&&(p.indexOf('fx:')===0||p.indexOf('fxt:')===0)){ let h=0; for(let i=0;i<p.length;i++)h=(h*31+p.charCodeAt(i))>>>0; return 'hsl('+(h%360)+',42%,62%)'; } return '#9AA0A8'; } // [R92-T4] fx-param lanes get a stable hue from their key (they were 0%-saturation greys)
/* param resolvers that understand BOTH inspector params (CURVE_PARAMS) and reactive-fx keys 'fx:<id>:<param>' */
function isFxKey(p){ return typeof p==='string'&&p.indexOf('fx:')===0; }
function fxBaseFor(c,key){ const parts=key.split(':'); const fx=(c&&c.fx)?c.fx.find(f=>f.id===+parts[1]):null; if(!fx)return 0; const k=parts[2]; return (k==='int')?(fx.int!=null?fx.int:0):(k==='amt')?(fx.amt!=null?fx.amt:100):((fx.params&&fx.params[k]!=null)?fx.params[k]:0); }
function paramBase(c,p){ return isFxKey(p)?fxBaseFor(c,p):c.props[p]; }
function setParamBase(c,p,v){ if(isFxKey(p)){ const parts=p.split(':'); const fx=(c.fx||[]).find(f=>f.id===+parts[1]); if(fx){ const k=parts[2]; if(k==='int')fx.int=v; else if(k==='amt')fx.amt=v; else {fx.params=fx.params||{};fx.params[k]=v;} } } else c.props[p]=v; }
function isFxtKey(p){ return typeof p==='string'&&p.indexOf('fxt:')===0; } // [R93] TRACK-level fx key 'fxt:<type>:<param>' — Ableton model: the lane names an EFFECT TYPE; each clip resolves it to its own instance
function laneKey(c,p){ if(isFxtKey(p)){ const q=p.split(':'); const fx=(c&&c.fx||[]).find(f=>f.type===q[1]&&FXBY[f.type]); return fx?('fx:'+fx.id+':'+q[2]):null; } return p; } // null = this clip has no instance of the lane's effect
function fxParamDefOf(def,p,k){ const nm=T(def.label[0],def.label[1]); if(k==='int')return [p,nm+' · '+T('Intensity','Intensidad'),'%',0,100]; if(k==='amt')return [p,nm+' · '+T('Reactivity','Reactividad'),'%',0,100]; const pd=(def.params||[]).find(x=>x.k===k); return pd?[p,nm+' · '+T(pd.label[0],pd.label[1]),pd.unit,pd.min,pd.max]:null; }
function paramDef(c,p){ if(isFxtKey(p)){ const q=p.split(':'); const def=(typeof FXBY!=='undefined')?FXBY[q[1]]:null; return def?fxParamDefOf(def,p,q[2]):null; } // type-based → no clip needed (lane headers/ranges work with an empty track)
  if(isFxKey(p)){ const parts=p.split(':'); const fx=(c&&c.fx)?c.fx.find(f=>f.id===+parts[1]):null; if(!fx)return null; const def=(typeof FXBY!=='undefined')?FXBY[fx.type]:null; return def?fxParamDefOf(def,p,parts[2]):null; } return CURVE_PARAMS.find(d=>d[0]===p); }
/* deep-copy the per-clip automation UI-state arrays onto a clone, so split/duplicate/nest don't share (and corrupt) them by reference */
function sepAuto(n,c){ if(Array.isArray(c.anim)) n.anim=JSON.parse(JSON.stringify(c.anim)); /* [R143] la copia de c._auto (lista legacy de clip) se archivó — ya no existe */ if(c.mod&&typeof c.mod==='object'){ n.mod=JSON.parse(JSON.stringify(c.mod)); for(const p in n.mod)for(const m of n.mod[p])m.id=uid(); }
  if(c.kfLink&&typeof c.kfLink==='object')n.kfLink=Object.assign({},c.kfLink); // [R95·D2] the copy stays an INSTANCE of the same item (that's the point of pooling: duplicate a clip, edit either, both follow)
  return n; } // [R95·C1] the modulation stack is deep-copied (fresh ids) — split/duplicate/nest must never share layer objects by reference // anim (motion modifiers + wetKf) deep-copied too — split/duplicate/nest copies must never share modifier objects
function isAudioClip(c){ const l=c&&state.lanes[c.lane]; return !!(l&&l.kind==='audio'); }
function openAuto(c,p){ if(!c||isAudioClip(c))return; const lane=state.lanes[c.lane]; if(!lane)return; lane._autoP=isFxKey(p)?(function(){ const q=p.split(':'); const fx=(c.fx||[]).find(f=>f.id===+q[1]); return (fx&&FXBY[fx.type])?('fxt:'+fx.type+':'+q[2]):null; })()||p:p; state.inlineCurves=true; syncAutoUI(); const cb=$('#curvesBtn'); if(cb)cb.classList.add('on'); renderTimeline(); } // [R93] armed param becomes the TRACK's primary overlay (Ableton: the chooser lives on the track header)
/* [R143] closeAuto (mantenía la lista legacy a nivel de clip c._auto, nunca renderizada; sus llamadores re-renderizan igual) ARCHIVADO → _backup/deprecated/20260723-automation-sublanes-and-clip-auto.js */
/* [R93] which fx TYPES exist on a track's clips (device dropdown), + all their lane keys */
function laneFxTypes(li){ const seen=[]; for(const c of state.clips)if(c.lane===li)for(const f of (c.fx||[]))if(FXBY[f.type]&&!seen.includes(f.type))seen.push(f.type); return seen; }
function laneFxKeys(li){ const out=[]; for(const ty of laneFxTypes(li)){ out.push('fxt:'+ty+':int','fxt:'+ty+':amt'); for(const p of (FXBY[ty].params||[]))out.push('fxt:'+ty+':'+p.k); } return out; }
function laneHasKf(li,p){ return state.clips.some(c=>{ if(c.lane!==li)return false; const kp=laneKey(c,p); return !!(kp&&c.kf&&c.kf[kp]&&c.kf[kp].length); }); }
/* [R93] the track's PRIMARY overlay param (drawn over the clips; chosen via the two dropdowns in the track header) */
function laneAutoP(lane,li){ const p=lane._autoP; if(p&&paramDef(null,p)&&(!isFxtKey(p)||laneFxTypes(li).includes(p.split(':')[1])))return p; // saved choice, unless its fx type left the track
  const anim=CURVE_PARAMS.find(d=>laneHasKf(li,d[0])); if(anim)return anim[0];
  return laneFxKeys(li).find(k=>laneHasKf(li,k))||'opacity'; }
/* [R143] addAutoLaneAt/addAutoLane (creaban sub-carriles apilados en lane._auto, ya sin render) ARCHIVADOS → _backup/deprecated/20260723-automation-sublanes-and-clip-auto.js */
/* [R93] the Ableton chooser pair: device (Clip | fx type on this track) + parameter. Reused by the track header and every sub-lane header. */
const XFORM_P=TF.concat(TF_FLAT).filter((d,i,a)=>a.findIndex(x=>x[0]===d[0])===i); // transform group (dome + flat, 'rot' deduped)
/* [R95·E4] Ableton's model: only the lane with focus shows the two dropdowns; the rest show the same information as
   plain 2-line text (device / parameter). Two selects + three buttons in a 152px header truncated to "Tra∨ ◆S∨" —
   unreadable. Clicking the text swaps it back to the live choosers. */
function autoDuoText(li,cur,onPick){ const wrap=document.createElement('div'); wrap.className='autoduo txt'; wrap.title=T('Click to change device / parameter','Clic para cambiar dispositivo / parámetro');
  const isT=isFxtKey(cur); const q=isT?cur.split(':'):null;
  const dev=isT?T(FXBY[q[1]].label[0],FXBY[q[1]].label[1]):(XFORM_P.some(d=>d[0]===cur)?T('Transform','Transformar'):T('Effects','Efectos'));
  const par=isT?fxParamLabel(q[1],q[2]):propLabel(cur);
  wrap.innerHTML=`<span class="adev-t">${dev}</span><span class="apar-t">${par}</span>`;
  wrap.addEventListener('pointerdown',e=>{ e.stopPropagation(); const live=autoDuo(li,cur,onPick); wrap.replaceWith(live); const s=live.querySelector('.apar'); if(s){try{s.focus();}catch(_){}} });
  return wrap; }
function fxParamLabel(ty,k){ const def=FXBY[ty]; if(!def)return k; if(k==='int')return T('Intensity','Intensidad'); if(k==='amt')return T('Reactivity','Reactividad'); const pd=(def.params||[]).find(x=>x.k===k); return pd?T(pd.label[0],pd.label[1]):k; }
function autoDuo(li,cur,onPick){ const types=laneFxTypes(li); const isT=isFxtKey(cur); const cq=isT?cur.split(':'):null;
  const isX=!isT&&XFORM_P.some(d=>d[0]===cur); // [R94b] device groups: Transform · Effects · each reactive fx loaded on the track's clips
  const wrap=document.createElement('div'); wrap.className='autoduo';
  const dev=document.createElement('select'); dev.className='aselect adev'; dev.title=T('Device / effect','Dispositivo / efecto');
  dev.innerHTML=`<option value="xf"${isX?' selected':''}>${T('Transform','Transformar')}</option>`+
    `<option value="ef"${(!isT&&!isX)?' selected':''}>${T('Effects','Efectos')}</option>`+
    types.map(ty=>`<option value="${ty}"${(isT&&ty===cq[1])?' selected':''}>${T(FXBY[ty].label[0],FXBY[ty].label[1])}</option>`).join('');
  const par=document.createElement('select'); par.className='aselect apar'; par.title=T('Parameter','Parámetro');
  const fill=sel=>{ const dv=dev.value;
    if(dv==='xf'||dv==='ef'){ const list=dv==='xf'?XFORM_P:FX; par.innerHTML=list.map(d=>`<option value="${d[0]}"${d[0]===sel?' selected':''}>${laneHasKf(li,d[0])?'◆ ':''}${propLabel(d[0])}</option>`).join(''); } // ◆ = already automated on this track
    else { const def=FXBY[dv]; const plist=[['int',T('Intensity','Intensidad')],['amt',T('Reactivity','Reactividad')]].concat((def.params||[]).map(p=>[p.k,T(p.label[0],p.label[1])]));
      par.innerHTML=plist.map(pp=>`<option value="${pp[0]}"${pp[0]===sel?' selected':''}>${laneHasKf(li,'fxt:'+dv+':'+pp[0])?'◆ ':''}${pp[1]}</option>`).join(''); } };
  fill(isT?cq[2]:cur);
  // [R94-UT2·U-15] the narrow selects truncate ("Opac∨") — mirror the selected option's full text into the tooltip
  const syncT=()=>{ const o1=dev.selectedOptions&&dev.selectedOptions[0], o2=par.selectedOptions&&par.selectedOptions[0];
    dev.title=o1?o1.textContent:T('Device / effect','Dispositivo / efecto'); par.title=o2?o2.textContent:T('Parameter','Parámetro'); };
  syncT();
  const emit=()=>{ const dv=dev.value; syncT(); onPick((dv==='xf'||dv==='ef')?par.value:('fxt:'+dv+':'+par.value)); };
  dev.onchange=()=>{ const dv=dev.value; fill(dv==='xf'?XFORM_P[0][0]:dv==='ef'?'opacity':'int'); emit(); }; par.onchange=emit;
  for(const ev of ['pointerdown','click','dblclick'])wrap.addEventListener(ev,e=>e.stopPropagation()); // the track header selects/drag-reorders/renames on these — the dropdowns must not trigger that
  wrap.appendChild(dev); wrap.appendChild(par); return wrap; }
/* [R93] legacy per-clip Audio-React lanes (c._arAuto, keys 'fx:<id>:<p>') → track lanes with type-keys */
function migrateArAuto(){ for(const c of state.clips){ if(!Array.isArray(c._arAuto)){ if(c._arAuto!=null)delete c._arAuto; continue; } const lane=state.lanes[c.lane];
  if(lane&&lane.kind!=='audio'){ for(const key of c._arAuto){ const q=String(key).split(':'); const fx=(c.fx||[]).find(f=>f.id===+q[1]); if(fx&&FXBY[fx.type]){ const lk='fxt:'+fx.type+':'+q[2]; if(!lane._autoP)lane._autoP=lk; } } } // [A5] one automation at a time — the first migrated key becomes the single overlay
  delete c._arAuto; } }
/* [R70] curve clipboard — copy a curve (or the selected breakpoints) and paste it into any lane/param */
function copyAutoCurve(c,p,set){ const ks=(c.kf&&c.kf[p])||[]; const src=(set&&set.size)?ks.filter(k=>set.has(k)):ks.slice(); if(!src.length){ flashStatus(T('Nothing to copy','Nada que copiar')); return; }
  const d=paramDef(c,p); const t0=Math.min(...src.map(k=>k.t));
  state.kfClipboard={mn:d?d[3]:0,mx:d?d[4]:100,ks:src.map(k=>({t:k.t-t0,v:k.v,e:k.e,hOut:k.hOut?{...k.hOut}:undefined,hIn:k.hIn?{...k.hIn}:undefined}))};
  flashStatus(src.length+' '+T('breakpoints copied','puntos copiados')); }
function pasteAutoAt(target,tAbs){ const kc=state.kfClipboard; if(!kc||!kc.ks||!kc.ks.length)return; const c=clipById(target.cid); if(!c)return; const p=target.p; const d=paramDef(c,p); if(!d)return;
  const mn=d[3],mx=d[4]; const sc=(kc.mx-kc.mn)>1e-9?(mx-mn)/(kc.mx-kc.mn):1; const same=Math.abs(kc.mn-mn)<1e-9&&Math.abs(kc.mx-mx)<1e-9;
  const lt0=Math.max(0,Math.min(c.dur,tAbs-c.start)); pushUndo();
  c.kf=c.kf||{}; const ks=c.kf[p]=c.kf[p]||[];
  for(const k of kc.ks){ const t=lt0+k.t; if(t>c.dur+1e-6)continue; const v=same?k.v:(mn+(k.v-kc.mn)*sc);
    const n={t,v:Math.max(mn,Math.min(mx,v)),e:k.e||'linear'}; if(k.hOut)n.hOut={dt:k.hOut.dt,dv:k.hOut.dv*(same?1:sc)}; if(k.hIn)n.hIn={dt:k.hIn.dt,dv:k.hIn.dv*(same?1:sc)};
    const i=ks.findIndex(x=>Math.abs(x.t-t)<1e-3); if(i>=0)ks[i]=n; else ks.push(n); }
  ks.sort((a,b)=>a.t-b.t); state.autoSel=null; renderTimeline(); renderInspector(); render(); markDirty(); flashStatus(T('Curve pasted','Curva pegada')); }
function copyAutoSel(){ const a=state.autoSel; if(!a)return; const c=clipById(a.cid); if(c)copyAutoCurve(c,a.p,a.set); }
function selectAllAuto(h){ const c=clipById(h.cid); const ks=c&&c.kf&&c.kf[h.p]; if(!ks||!ks.length){ flashStatus(T('No breakpoints in this lane','Sin puntos en este carril')); return; }
  state.autoSel={cid:h.cid,p:h.p,set:new Set(ks)}; renderTimeline(); flashStatus(ks.length+' '+T('breakpoints selected','puntos seleccionados')); }
/* [R70] arrow-key nudge of the selected breakpoints: ←/→ = grid step (Shift = 1 frame) · ↑/↓ = 1% of range (Shift = 0.1%) */
function nudgeAutoSel(e){ const a=state.autoSel; const c=a&&clipById(a.cid); const ks=c&&c.kf&&c.kf[a.p]; if(!c||!ks){ state.autoSel=null; renderTimeline(); return; }
  const live=[...a.set].filter(k=>ks.includes(k)); if(!live.length){ state.autoSel=null; renderTimeline(); return; }
  const d=paramDef(c,a.p); if(!d)return; const mn=d[3],mx=d[4];
  if(!e.repeat)pushUndo();
  if(e.key==='ArrowLeft'||e.key==='ArrowRight'){ const st=e.shiftKey?(1/(state.fps||30)):(snapGrid()||gridSec()||(1/(state.fps||30))); const dt=(e.key==='ArrowLeft'?-st:st); for(const k of live)k.t=Math.max(0,Math.min(c.dur,k.t+dt)); ks.sort((x,y)=>x.t-y.t); }
  else { const st=(mx-mn)*(e.shiftKey?0.001:0.01); const dv=(e.key==='ArrowDown'?-st:st); for(const k of live)k.v=Math.max(mn,Math.min(mx,k.v+dv)); }
  scheduleTimeline(); refreshInspector(); render(); markDirty(); }
/* ===================== [R95·B1] SHAPE BOX — Fusion's free-transform box over a breakpoint selection =====================
   The most complete retiming/reshaping gesture in the industry: ONE box that scales, stretches and SKEWS in time AND value
   at once. Corner handles = scale (Alt = mirror about the opposite handle) · edge handles = stretch one axis ·
   top corners dragged sideways = skew · inside = move. Shift+B toggles it on the current selection.
   state.shapeBox={cid,p,t0,t1,v0,v1,base:[{k,t,v}]} — 'base' freezes the original coords so every drag is absolute. */
function shapeBoxOpen(){ const a=state.autoSel; const c=a&&clipById(a.cid); const ks=c&&c.kf&&c.kf[a.p];
  if(!ks){ flashStatus(T('Select breakpoints first (drag a marquee on a curve)','Selecciona puntos primero (arrastra un marco sobre una curva)'),'err'); return; }
  const live=[...a.set].filter(k=>ks.includes(k)); if(live.length<2){ flashStatus(T('Select at least 2 breakpoints','Selecciona al menos 2 puntos'),'err'); return; }
  const ts=live.map(k=>k.t), vs=live.map(k=>k.v);
  state.shapeBox={cid:a.cid,p:a.p,t0:Math.min(...ts),t1:Math.max(...ts),v0:Math.min(...vs),v1:Math.max(...vs),
    base:live.map(k=>({k,t:k.t,v:k.v}))};
  renderTimeline(); flashStatus(T('Shape Box — corners scale · Alt mirrors · top corners skew · inside moves · Esc closes','Shape Box — esquinas escalan · Alt refleja · esquinas superiores sesgan · dentro mueve · Esc cierra')); }
function shapeBoxClose(){ if(!state.shapeBox)return; state.shapeBox=null; renderTimeline(); }
function shapeBoxToggle(){ state.shapeBox?shapeBoxClose():shapeBoxOpen(); }
/* re-read the box extents from the live points (after a drag) so the handles follow */
function shapeBoxSync(){ const b=state.shapeBox; if(!b)return; const ts=b.base.map(x=>x.k.t), vs=b.base.map(x=>x.k.v);
  b.t0=Math.min(...ts); b.t1=Math.max(...ts); b.v0=Math.min(...vs); b.v1=Math.max(...vs); }
/* apply the box transform: sx/sy = scale about the anchor · skew = shear in time proportional to normalised value */
function shapeBoxApply(sx,sy,ax,ay,skew,dt,dv,mn,mx,dur){ const b=state.shapeBox; if(!b)return;
  const spanV=(b.v1-b.v0)||1;
  for(const o of b.base){ let t=ax+(o.t-ax)*sx+dt, v=ay+(o.v-ay)*sy+dv;
    if(skew){ const nv=((o.v-b.v0)/spanV)-0.5; t+=skew*nv; } // shear: the further from the box's mid-value, the more it slides in time
    o.k.t=Math.max(0,Math.min(dur,t)); o.k.v=Math.max(mn,Math.min(mx,v)); }
  const c=clipById(b.cid); if(c&&c.kf&&c.kf[b.p])c.kf[b.p].sort((x,y)=>x.t-y.t); }
/* [R95·B2] TAPER (After Effects' Ctrl+Alt+corner): scale the AMPLITUDE about the selection's mid value — the shape stays,
   the excursion grows/shrinks. Different from scale: the timing never moves. */
function taperSel(f){ const a=state.autoSel; const c=a&&clipById(a.cid); const ks=c&&c.kf&&c.kf[a.p]; if(!ks)return;
  const live=[...a.set].filter(k=>ks.includes(k)); if(live.length<2)return; const d=paramDef(c,a.p); if(!d)return; const mn=d[3],mx=d[4];
  const mid=(Math.min(...live.map(k=>k.v))+Math.max(...live.map(k=>k.v)))/2; pushUndo();
  for(const k of live)k.v=Math.max(mn,Math.min(mx,mid+(k.v-mid)*f));
  renderTimeline(); renderInspector(); render(); markDirty(); }
/* ===================== [R95·D2] AUTOMATION ITEMS — the curve as a reusable, POOLED element =====================
   Reaper's most-praised feature and the one patent-free idea no video editor has: a curve becomes an ITEM you can drop on any
   parameter, repeat, and — crucially — POOL: edit one instance and every instance follows. Ours pools by PROPAGATION rather
   than by indirection: the editor keeps writing into c.kf[p] (so none of its 30+ call sites change, and evalP stays untouched),
   and commit() pushes the edit to the item + every other instance. Same promise to the user, a fraction of the risk.
   state.autoItems = { id: {id,name,kf:[…],dur} } · c.kfLink = { '<param>': itemId } */
function ensureItems(){ if(!state.autoItems)state.autoItems={}; return state.autoItems; }
function itemFromCurve(c,p,name){ const ks=(c.kf&&c.kf[p])||[]; if(ks.length<2)return null;
  const t0=ks[0].t, dur=Math.max(0.05,ks[ks.length-1].t-t0);
  const it={id:uid(),name:name||propLabel(p),dur,kf:ks.map(k=>({t:k.t-t0,v:k.v,e:k.e,hOut:k.hOut?{...k.hOut}:undefined,hIn:k.hIn?{...k.hIn}:undefined}))};
  ensureItems()[it.id]=it; return it; }
function linkItem(c,p,id){ c.kfLink=c.kfLink||{}; c.kfLink[p]=id; }
function unlinkItem(c,p){ if(c.kfLink){ delete c.kfLink[p]; if(!Object.keys(c.kfLink).length)delete c.kfLink; } }
/* write the edited instance back into its item and onto every sibling — "edit one, change all" */
function poolPropagate(c,p){ const id=c.kfLink&&c.kfLink[p]; if(!id)return; const it=ensureItems()[id]; if(!it)return;
  const ks=(c.kf&&c.kf[p])||[]; if(ks.length<2)return; const t0=ks[0].t;
  it.dur=Math.max(0.05,ks[ks.length-1].t-t0);
  it.kf=ks.map(k=>({t:k.t-t0,v:k.v,e:k.e,hOut:k.hOut?{...k.hOut}:undefined,hIn:k.hIn?{...k.hIn}:undefined}));
  for(const oc of state.clips){ if(oc===c)continue; const lid=oc.kfLink&&oc.kfLink[p]; if(lid!==id)continue;
    const oks=(oc.kf&&oc.kf[p])||[]; const ot0=oks.length?oks[0].t:0; applyItem(oc,p,it,ot0,false,false,true); } }
/* stamp an item onto (clip,param) starting at local time at0. loop = repeat until the clip ends · relative = each pass
   accumulates on the previous end value (Fusion's Set Relative / Cavalry's Loop+Offset: infinite pans for free). */
function applyItem(c,p,it,at0,loop,relative,silent){ if(!it||!it.kf.length)return; const d=paramDef(c,p); if(!d)return; const mn=d[3],mx=d[4];
  c.kf=c.kf||{}; const out=[]; const span=Math.max(0.05,it.dur); const last=it.kf[it.kf.length-1].v, first=it.kf[0].v; const delta=last-first;
  let base=0, n=0;
  for(let start=at0; start<(loop?c.dur:at0+span)-1e-4 || n===0; start+=span){
    for(const k of it.kf){ const t=start+k.t; if(t>c.dur+1e-4)break;
      if(n>0&&Math.abs(k.t)<1e-6)continue; // the seam point is already there from the previous pass
      out.push({t,v:Math.max(mn,Math.min(mx,k.v+(relative?base:0))),e:k.e,hOut:k.hOut?{...k.hOut}:undefined,hIn:k.hIn?{...k.hIn}:undefined}); }
    n++; if(relative)base+=delta; if(!loop)break; if(n>512)break; } // guard: a tiny item over a long clip must not explode
  const keep=((c.kf[p]||[]).filter(k=>k.t<at0-1e-4)); c.kf[p]=keep.concat(out).sort((a,b)=>a.t-b.t);
  if(!silent){ renderTimeline(); renderInspector(); render(); markDirty(); } }
function itemMenuItems(c,p,atT){ const items=ensureItems(); const ids=Object.keys(items);
  const out=[{label:T('Save curve as Automation Item…','Guardar curva como elemento de automatización…'),fn:()=>{
    appPrompt(T('Item name:','Nombre del elemento:'),propLabel(p),nm=>{ if(nm==null)return; pushUndo(); const it=itemFromCurve(c,p,nm||propLabel(p)); if(!it){ flashStatus(T('Need at least 2 breakpoints','Hacen falta al menos 2 puntos'),'err'); return; }
      linkItem(c,p,it.id); markDirty(); renderTimeline(); flashStatus(T('Automation Item saved — instances stay in sync','Elemento guardado — las instancias se sincronizan')); }); }}];
  if(ids.length){ const sub=ids.map(id=>({label:items[id].name+' ('+items[id].dur.toFixed(2)+'s)',fn:()=>{ pushUndo(); applyItem(c,p,items[id],Math.max(0,atT),false,false); linkItem(c,p,id); flashStatus(T('Item inserted','Elemento insertado')); }}));
    out.push('sep',...sub); }
  if(c.kfLink&&c.kfLink[p]){ const it=items[c.kfLink[p]];
    out.push('sep',{label:T('Repeat over the clip (loop)','Repetir a lo largo del clip (bucle)'),fn:()=>{ pushUndo(); applyItem(c,p,it,0,true,false); }},
      {label:T('Repeat + accumulate (relative)','Repetir acumulando (relativo)'),fn:()=>{ pushUndo(); applyItem(c,p,it,0,true,true); }},
      {label:T('Unlink (make unique)','Desvincular (hacer único)'),fn:()=>{ pushUndo(); unlinkItem(c,p); renderTimeline(); flashStatus(T('Curve unlinked — edits stay local','Curva desvinculada — los cambios quedan locales')); }}); }
  return out; }
/* [R95·A4] EASING LIBRARY over a NORMALISED 0–1 curve — the gap Flow / Ease and Wizz fill in After Effects (AE ships no
   preset library, which is why those plugins exist). Each preset is a CSS-style cubic-bezier [x1,y1,x2,y2]; applying it to a
   segment writes A.hOut / B.hIn scaled to that segment's real span, so one curve fits any duration or value range. */
const EASE_PRESETS=[
  ['Ease In-Out','Suave',[0.42,0,0.58,1]], ['Ease In','Entrada',[0.42,0,1,1]], ['Ease Out','Salida',[0,0,0.58,1]],
  ['Smooth','Sedoso',[0.25,0.1,0.25,1]], ['Slow Start','Arranque lento',[0.7,0,0.84,0]], ['Slow End','Final lento',[0.16,1,0.3,1]],
  ['Expo In','Expo entrada',[0.7,0,0.84,0]], ['Expo Out','Expo salida',[0.16,1,0.3,1]],
  ['Back Out (overshoot)','Rebote de salida',[0.34,1.56,0.64,1]], ['Back In (anticipate)','Anticipación',[0.36,0,0.66,-0.56]],
  ['Anticipate + Overshoot','Anticipar y pasarse',[0.68,-0.55,0.27,1.55]], ['Linear','Lineal',[0,0,1,1]] ];
function applyEasePreset(c,p,A,B,bez){ if(!A||!B)return; const seg=B.t-A.t, dv=B.v-A.v; if(seg<=0)return;
  A.e='bezier'; A.hOut={dt:seg*bez[0], dv:dv*bez[1]}; B.hIn={dt:-seg*(1-bez[2]), dv:-dv*(1-bez[3])}; delete A.hIn0; }
/* the segment(s) a preset applies to: every consecutive pair inside the selection, else the segment under the cursor */
function easeTargets(c,p,seg){ const ks=(c.kf&&c.kf[p])||[]; const sel=(state.autoSel&&state.autoSel.cid===c.id&&state.autoSel.p===p)?state.autoSel.set:null;
  if(sel&&sel.size>1){ const list=ks.filter(k=>sel.has(k)); const out=[]; for(let i=0;i<list.length-1;i++)out.push([list[i],list[i+1]]); return out; }
  return (seg&&seg.A&&seg.B)?[[seg.A,seg.B]]:[]; }
/* [R95·A3] Fusion's tri-mode numeric field over a multi-selection: Value assigns · Offset adds · Scale multiplies */
function autoSelApply(mode){ const a=state.autoSel; const c=a&&clipById(a.cid); const ks=c&&c.kf&&c.kf[a.p]; if(!ks)return;
  const live=[...a.set].filter(k=>ks.includes(k)); if(!live.length){ flashStatus(T('Select breakpoints first','Selecciona puntos primero'),'err'); return; }
  const d=paramDef(c,a.p); if(!d)return; const mn=d[3],mx=d[4];
  const avg=live.reduce((s,k)=>s+k.v,0)/live.length;
  const ttl={value:T('Set value','Fijar valor'),offset:T('Offset by','Desplazar en'),scale:T('Scale by (×)','Escalar por (×)')}[mode];
  const def=(mode==='value')?String(Math.round(avg*100)/100):(mode==='offset'?'0':'1');
  appPrompt(ttl+' — '+live.length+' '+T('breakpoints','puntos'),def,v=>{ if(v==null||v==='')return; const n=parseFloat(String(v).replace(',','.')); if(isNaN(n))return; pushUndo();
    for(const k of live){ const nv=(mode==='value')?n:(mode==='offset')?(k.v+n):(k.v*n); k.v=Math.max(mn,Math.min(mx,nv)); }
    renderTimeline(); renderInspector(); render(); markDirty(); flashStatus(live.length+' '+T('breakpoints updated','puntos actualizados')); }); }
/* [R70] curve simplification (Ramer-Douglas-Peucker in pixel space; hold/bezier points always kept) */
function rdpKeep(pts,eps){ const keep=new Set([0,pts.length-1]); const stack=[[0,pts.length-1]];
  while(stack.length){ const [i0,i1]=stack.pop(); if(i1<=i0+1)continue; const ax=pts[i0][0],ay=pts[i0][1],bx=pts[i1][0],by=pts[i1][1]; const dx=bx-ax,dy=by-ay; const len=Math.hypot(dx,dy)||1;
    let mi=-1,md=-1; for(let i=i0+1;i<i1;i++){ const dd=Math.abs((pts[i][0]-ax)*dy-(pts[i][1]-ay)*dx)/len; if(dd>md){md=dd;mi=i;} }
    if(md>eps){ keep.add(mi); stack.push([i0,mi],[mi,i1]); } }
  return keep; }
function simplifyAuto(c,p){ const ks=c.kf&&c.kf[p]; if(!ks||ks.length<4){ flashStatus(T('Nothing to simplify','Nada que simplificar')); return; } const d=paramDef(c,p); if(!d)return; const mn=d[3],mx=d[4];
  const pts=ks.map(k=>[k.t*state.tl.pxPerSec,(1-(k.v-mn)/((mx-mn)||1))*46]); const keep=rdpKeep(pts,1.6);
  const out=ks.filter((k,i)=>keep.has(i)||k.e==='hold'||k.e==='bezier'||k.hOut||k.hIn);
  if(out.length===ks.length){ flashStatus(T('Nothing to simplify','Nada que simplificar')); return; }
  pushUndo(); const rm=ks.length-out.length; c.kf[p]=out; state.autoSel=null; renderTimeline(); renderInspector(); render(); markDirty(); flashStatus(rm+' '+T('breakpoints removed','puntos eliminados')); }
/* ===================== [R95·C2] SPECTRUM PICKER — pick the band by drawing it on the real spectrum =====================
   Notch shows the frequency/amplitude graph while you choose the region; VDMX drags the source onto the target. Nobody joins
   them. Here: the live spectrum of the reactive source at the playhead (grey bars) with the picked window highlighted in cyan
   and its envelope drawn live. Drag across = set f0..f1 · drag inside the window = slide it · double-click = back to a named band. */
function specX(f,W){ const l0=Math.log(SPEC_F0), l1=Math.log(SPEC_F1); return (Math.log(Math.max(SPEC_F0,Math.min(SPEC_F1,f)))-l0)/(l1-l0)*W; }
function specF(x,W){ const l0=Math.log(SPEC_F0), l1=Math.log(SPEC_F1); return Math.exp(l0+(l1-l0)*Math.max(0,Math.min(1,x/W))); }
function drawSpecPicker(cv,m,c){ const dpr=Math.min(window.devicePixelRatio||1,2); const W=cv.clientWidth||336, H=cv.clientHeight||52;
  cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr); const x=cv.getContext('2d'); x.setTransform(dpr,0,0,dpr,0,0); x.clearRect(0,0,W,H);
  const src=reactiveSourceMedia(); const sp=src&&src.spec;
  x.fillStyle=UI.s0; x.fillRect(0,0,W,H);
  if(!sp){ x.fillStyle=UI.ink2; x.font='11px Geist'; x.textAlign='center'; x.fillText(src?T('Analysing spectrum…','Analizando espectro…'):T('Pick a Reactive FX audio source first','Elige primero una fuente de audio reactiva'),W/2,H/2); x.textAlign='left'; return; }
  const fr=Math.max(0,Math.min(sp.frames-1,Math.round(state.playhead*sp.fps))); const edges=specBandEdges();
  const custom=!!(m.f0&&m.f1); const lo=custom?Math.min(m.f0,m.f1):0, hi=custom?Math.max(m.f0,m.f1):0;
  for(let b=0;b<sp.bins;b++){ const x0=specX(edges[b],W), x1=specX(edges[b+1],W); const v=Math.pow(sp.data[fr*sp.bins+b]||0,0.55); const h=Math.max(1,v*(H-10)); // ^0.55 = visual lift only (the stored data stays linear and honest)
    const inWin=custom&&edges[b+1]>=lo&&edges[b]<=hi;
    x.fillStyle=inWin?'rgba(79,195,232,0.85)':'rgba(154,160,168,0.34)'; x.fillRect(x0+0.5,H-h-2,Math.max(1,x1-x0-1),h); }
  if(custom){ const a=specX(lo,W), b2=specX(hi,W); x.save(); x.strokeStyle='var(--auto-live)'; x.strokeStyle=UI.accLive; x.lineWidth=1; x.setLineDash([3,2]);
    x.strokeRect(a+0.5,1.5,Math.max(2,b2-a-1),H-3); x.setLineDash([]); x.fillStyle='rgba(79,195,232,0.10)'; x.fillRect(a,1,Math.max(2,b2-a),H-2); x.restore(); }
  x.font='11px Geist'; x.textBaseline='top'; // frequency ruler along the TOP: at the bottom the labels sat under the bars and got clipped ("100" read "10")
  for(const f of [100,1000,10000]){ const px=specX(f,W); x.fillStyle='rgba(255,255,255,0.10)'; x.fillRect(px,0,1,H);
    const lb=f>=1000?(f/1000)+'k':String(f); const tw=x.measureText(lb).width; x.fillStyle=UI.inkDim; x.fillText(lb,Math.max(1,Math.min(W-tw-1,px+2)),1); }
  x.textBaseline='alphabetic';
  cv._W=W; cv._H=H; }
function bindSpecPicker(cv,m,c,onChange){
  const paint=()=>drawSpecPicker(cv,m,c);
  requestAnimationFrame(paint); cv._paint=paint;
  const info=cv.parentElement.querySelector('.mpspecinfo');
  const setInfo=()=>{ if(!info)return; info.textContent=(m.f0&&m.f1)?(Math.round(Math.min(m.f0,m.f1))+' – '+Math.round(Math.max(m.f0,m.f1))+' Hz'):T('Drag across the spectrum to pick a band','Arrastra sobre el espectro para elegir una banda'); };
  setInfo();
  cv.addEventListener('pointerdown',e=>{ e.stopPropagation(); const r=cv.getBoundingClientRect(); const W=cv._W||r.width; const px=e.clientX-r.left;
    const inWin=(m.f0&&m.f1)&&px>=specX(Math.min(m.f0,m.f1),W)-3&&px<=specX(Math.max(m.f0,m.f1),W)+3;
    const f0=specF(px,W); const startLo=m.f0, startHi=m.f1;
    const mv=ev=>{ const p2=ev.clientX-r.left;
      if(inWin){ const d=specF(p2,W)/Math.max(1e-6,f0); m.f0=Math.max(SPEC_F0,Math.min(SPEC_F1,startLo*d)); m.f1=Math.max(SPEC_F0,Math.min(SPEC_F1,startHi*d)); } // slide the window (log-proportional → it keeps its musical width)
      else { m.f0=f0; m.f1=specF(p2,W); }
      setInfo(); paint(); };
    const up=()=>{ window.removeEventListener('pointermove',mv); window.removeEventListener('pointerup',up);
      if(Math.abs(specX(m.f1||0,W)-specX(m.f0||0,W))<4&&!inWin){ m.f0=0; m.f1=0; } // a click, not a drag → back to the named band
      setInfo(); paint(); if(onChange)onChange(); };
    window.addEventListener('pointermove',mv); window.addEventListener('pointerup',up); });
  cv.addEventListener('dblclick',e=>{ e.stopPropagation(); m.f0=0; m.f1=0; setInfo(); paint(); if(onChange)onChange(); }); }
/* [R95·C1] The modulation panel: the stack as an ordered, reorderable list of layers with an EXPLICIT blend per layer,
   and the audit line in plain text at the bottom. Anchored to its button, closes on outside click / Esc. */
let _modPanel=null;
function closeModPanel(){ if(_modPanel){ _modPanel.remove(); _modPanel=null; document.removeEventListener('pointerdown',_modOutside,true); } }
function _modOutside(e){ if(_modPanel&&!_modPanel.contains(e.target)&&!(e.target.closest&&e.target.closest('.modb')))closeModPanel(); }
function openModPanel(c,p,anchor){ closeModPanel(); if(!c)return; c.mod=c.mod||{}; c.mod[p]=c.mod[p]||[];
  const pan=document.createElement('div'); pan.className='modpan'; _modPanel=pan;
  const rebuild=()=>{ const st=c.mod[p]; const d=paramDef(c,p); const u=d?(d[2]||''):'';
    pan.innerHTML=`<div class="mph"><span class="asw" style="background:${autoColor(p)}"></span><b>${propLabel(p)}</b><span class="mpsub">${T('Modulation','Modulación')}</span><button class="mpx" title="${T('Close','Cerrar')}">${ICO('close',11)}</button></div>`;
    const list=document.createElement('div'); list.className='mplist'; pan.appendChild(list);
    if(!st.length){ const e=document.createElement('div'); e.className='mpempty'; e.textContent=T('No modulation — add a layer below','Sin modulación — añade una capa abajo'); list.appendChild(e); }
    st.forEach((m,i)=>{ const row=document.createElement('div'); row.className='mprow'+(m.on===false?' off':'');
      const srcSel=MOD_SRCS.map(s=>`<option value="${s[0]}"${s[0]===m.src?' selected':''}>${T(s[1],s[2])}</option>`).join('');
      const blSel=MOD_BLENDS.map(b=>`<option value="${b[0]}"${b[0]===m.blend?' selected':''}>${T(b[1],b[2])}</option>`).join('');
      const unitTxt=(m.blend==='add'||m.blend==='sub')?u:'%';
      row.innerHTML=`<div class="mpr1"><button class="mpon" title="${T('Enable / bypass','Activar / puentear')}">${m.on===false?'○':'●'}</button>
          <select class="mpsrc sysel">${srcSel}</select><select class="mpbl sysel">${blSel}</select>
          <input class="mpdep tnum" type="number" step="1" value="${Math.round(m.depth)}" title="${T('Depth','Profundidad')}"><span class="mpu">${unitTxt}</span>
          <button class="mpup" title="${T('Move up','Subir')}">↑</button><button class="mpdel" title="${T('Remove layer','Quitar capa')}">${ICO('close',10)}</button></div>
        <div class="mpr2"></div>`;
      const r2=row.querySelector('.mpr2');
      if(m.src==='lfo'){ r2.innerHTML=`<select class="mpshape sysel">${LFO_SHAPES.map(s=>`<option value="${s[0]}"${s[0]===m.shape?' selected':''}>${T(s[1],s[2])}</option>`).join('')}</select>
          <label class="mpsync"><input type="checkbox" class="mpbpm"${m.bpmSync?' checked':''}> ${T('sync','sinc')}</label>
          ${m.bpmSync?`<span class="mplab">1/</span><input class="mpdiv tnum" type="number" min="0.25" step="0.25" value="${m.div||1}">`:`<input class="mphz tnum" type="number" min="0.01" step="0.1" value="${m.hz||0.5}"><span class="mplab">Hz</span>`}
          <span class="mplab">${T('phase','fase')}</span><input class="mpph tnum" type="number" min="0" max="360" step="15" value="${m.phase||0}">`; }
      else if(m.src==='audio'){ const custom=!!(m.f0&&m.f1);
        r2.innerHTML=`<select class="mpband sysel"><option value="bass"${!custom&&m.band==='bass'?' selected':''}>${T('Bass','Graves')}</option><option value="mid"${!custom&&m.band==='mid'?' selected':''}>${T('Mid','Medios')}</option><option value="treble"${!custom&&m.band==='treble'?' selected':''}>${T('Treble','Agudos')}</option><option value="bright"${!custom&&m.band==='bright'?' selected':''}>${T('Bright','Brillo')}</option><option value="custom"${custom?' selected':''}>${T('Custom range…','Rango propio…')}</option></select>
          <span class="mplab">${T('atk','atq')}</span><input class="mpatk tnum" type="number" min="0" max="500" step="1" value="${m.atk}"><span class="mplab">ms</span>
          <span class="mplab">${T('rel','rel')}</span><input class="mprel tnum" type="number" min="0" max="2000" step="10" value="${m.rel}"><span class="mplab">ms</span>
          <label class="mpsync"><input type="checkbox" class="mpinv"${m.inv?' checked':''}> ${T('inv','inv')}</label>`;
        // [R95·C2] THE SPECTRUM PICKER: draw the band straight onto the live spectrum (Notch lets you SEE the band you pick;
        // VDMX lets you DRAG to assign — nobody joins the two). Drag across = pick f0..f1 · drag the box = move it.
        const sp=document.createElement('div'); sp.className='mpspec'; sp.innerHTML=`<canvas class="mpspeccv" width="672" height="104"></canvas><div class="mpspecinfo"></div>`; row.appendChild(sp);
        const scv=sp.querySelector('.mpspeccv'); scv._m=m; scv._c=c; bindSpecPicker(scv,m,c,()=>{ rebuild(); renderTimeline(); render(); markDirty(); }); }
      else { r2.innerHTML=`<select class="mpaxis sysel"><option value="el"${m.axis==='el'?' selected':''}>${T('Elevation','Elevación')}</option><option value="az"${m.axis==='az'?' selected':''}>${T('Azimuth','Azimut')}</option><option value="dist"${m.axis==='dist'?' selected':''}>${T('Distance from zenith','Distancia al cenit')}</option></select>
          <span class="mplab">${T('from','de')}</span><input class="mpfrom tnum" type="number" step="5" value="${m.from||0}">
          <span class="mplab">${T('to','a')}</span><input class="mpto tnum" type="number" step="5" value="${m.to}">
          <label class="mpsync"><input type="checkbox" class="mpinv"${m.inv?' checked':''}> ${T('inv','inv')}</label>`; }
      const upd=()=>{ renderTimeline(); render(); markDirty(); refreshModFormula(); };
      row.querySelector('.mpon').onclick=()=>{ m.on=(m.on===false); rebuild(); upd(); };
      row.querySelector('.mpsrc').onchange=e=>{ const nm=modDefaults(e.target.value); nm.id=m.id; nm.blend=m.blend; nm.depth=m.depth; st[i]=nm; rebuild(); upd(); };
      row.querySelector('.mpbl').onchange=e=>{ m.blend=e.target.value; rebuild(); upd(); };
      row.querySelector('.mpdep').onchange=e=>{ m.depth=+e.target.value||0; upd(); };
      row.querySelector('.mpup').onclick=()=>{ if(i>0){ st.splice(i-1,0,st.splice(i,1)[0]); rebuild(); upd(); } };
      row.querySelector('.mpdel').onclick=()=>{ pushUndo(); st.splice(i,1); if(!st.length)delete c.mod[p]; rebuild(); upd(); };
      const bind=(sel,f)=>{ const el=row.querySelector(sel); if(el)el.onchange=e=>{ f(e.target); upd(); }; };
      bind('.mpshape',t2=>m.shape=t2.value); bind('.mpbpm',t2=>{m.bpmSync=t2.checked;rebuild();}); bind('.mphz',t2=>m.hz=+t2.value||0.5); bind('.mpdiv',t2=>m.div=+t2.value||1); bind('.mpph',t2=>m.phase=+t2.value||0);
      bind('.mpband',t2=>{ if(t2.value==='custom'){ if(!m.f0||!m.f1){ m.f0=60; m.f1=250; } } else { m.band=t2.value; m.f0=0; m.f1=0; } rebuild(); }); bind('.mpatk',t2=>m.atk=+t2.value||0); bind('.mprel',t2=>m.rel=+t2.value||0); bind('.mpinv',t2=>m.inv=t2.checked);
      bind('.mpaxis',t2=>{m.axis=t2.value; m.from=0; m.to=(t2.value==='az')?360:90; rebuild();}); bind('.mpfrom',t2=>m.from=+t2.value||0); bind('.mpto',t2=>m.to=+t2.value||0);
      list.appendChild(row); });
    const add=document.createElement('div'); add.className='mpadd';
    add.innerHTML=MOD_SRCS.map(s=>`<button data-s="${s[0]}">+ ${T(s[1],s[2])}</button>`).join('');
    add.querySelectorAll('button').forEach(b=>b.onclick=()=>{ pushUndo(); c.mod[p].push(modDefaults(b.dataset.s)); rebuild(); renderTimeline(); render(); markDirty(); });
    pan.appendChild(add);
    const fx=document.createElement('div'); fx.className='mpformula'; fx.id='mpFormula'; pan.appendChild(fx); refreshModFormula();
    pan.querySelector('.mpx').onclick=closeModPanel; };
  pan._c=c; pan._p=p; rebuild(); document.body.appendChild(pan);
  const r=anchor.getBoundingClientRect(); pan.style.left=Math.max(6,Math.min(innerWidth-372,r.right-360))+'px'; pan.style.top=Math.min(innerHeight-40,r.bottom+5)+'px';
  setTimeout(()=>document.addEventListener('pointerdown',_modOutside,true),0); }
/* the audit line, refreshed on every playhead move (that's the point: it must be true NOW) */
function refreshModFormula(){ if(!_modPanel)return; const el=_modPanel.querySelector('#mpFormula'); if(!el)return; const c=_modPanel._c, p=_modPanel._p; // query INSIDE the panel: on first build it isn't in the document yet, so getElementById found nothing and the line stayed empty
  if(!c||!state.clips.includes(c)){ closeModPanel(); return; } el.textContent=modFormula(c,p,state.playhead);
  _modPanel.querySelectorAll('.mpspeccv').forEach(cv=>{ if(cv._paint)cv._paint(); }); } // [R95·C2] the spectrum must be LIVE — it repaints with the playhead, like Notch's
/* [A5] Show Automation: ensure inline lanes are visible and at least one lane is open for this clip */
function showAutomation(c){ if(!c||isAudioClip(c))return; state.inlineCurves=true; syncAutoUI(); const cb=$('#curvesBtn'); if(cb)cb.classList.add('on');
  { const lane=state.lanes[c.lane]; if(lane&&lane.kind!=='audio'){ const armed=CURVE_PARAMS.filter(d=>hasKf(c,d[0])).map(d=>d[0]);
    if(armed.length&&!(lane._autoP&&armed.includes(lane._autoP)))lane._autoP=armed[0]; } } // [A5] the clip's animated params open on ITS TRACK as the SINGLE overlay (first one, unless the current choice is already one of them) — one at a time
  renderTimeline(); }
/* [A5] Return to Default: drop all automation on the clip, freezing each param at its current value (curve removed) */
function returnToDefault(c){ if(!c)return; pushUndo(); for(const [p] of CURVE_PARAMS){ if(hasKf(c,p)){ c.props[p]=evalP(c,p,state.playhead); clearKf(c,p); } } renderTimeline(); renderInspector(); render(); flashStatus(T('Automation returned to default','Automatización restablecida')); } // [R143] c._auto=[] (lista legacy de clip) archivado
// [archivado 20260722 · R137] reenableAuto/setAutoOff → _backup/deprecated/20260722-automation-override-and-perform-bake.js · sin efecto bajo el modelo After Effects (ADR-0006)
/* draw one parameter's curve inside an inline sub-lane canvas. The canvas lives inside #tracks and so scrolls
   horizontally with the clips — X is timeline-absolute, no scroll compensation needed. Reuses evalP (no second engine). */
function autoSelMatch(c,p){ return (state.autoSel&&state.autoSel.cid===c.id&&state.autoSel.p===p)?state.autoSel.set:null; }
/* [R95·E2] which curve has focus: the hovered lane wins; otherwise the track of the selected clip; otherwise none.
   Focus only drives alpha/width — never geometry — so nothing moves when focus changes. */
function isAutoFocus(cv){ const h=state.hoverAuto; if(h&&h.cv)return h.cv===cv;
  const sc=selClip(); if(!sc)return true; // no selection → everything reads at full strength (nothing to de-emphasise against)
  return (cv._li!=null)?(cv._li===sc.lane):(cv._c&&cv._c.id===sc.id); }
/* [R92-T4] drawAutoCurve now renders ONE OR MANY clips: clip-overlay canvases pass their clip (cv._c),
   TRACK-level lane canvases (cv._li!=null) draw every clip of that lane — the Ableton model: the lane belongs
   to the track and shows the parameter across the whole timeline, selection or not. */
function drawAutoCurve(cv,c,p){ const laneMode=(cv._li!=null);
  const clist=laneMode?state.clips.filter(x=>x.lane===cv._li).sort((a,b)=>a.start-b.start):(c?[c]:[]);
  const def=paramDef(clist[0]||c,p)||CURVE_PARAMS.find(d=>d[0]===p); if(!def)return; const [,label,unit,mn,mx]=def; const col=autoColor(p);
  const foc=isAutoFocus(cv); const W_ON=foc?1.8:1.4, A_ON=foc?1:0.45; // [R95·E2] saturation = focus (Ableton): the lane you're editing is opaque, the rest keep the same hue at 45%
  const dpr=Math.min(window.devicePixelRatio||1,2),W=cv._W,H=cv._H; cv.width=Math.max(1,Math.round(W*dpr)); cv.height=Math.max(1,Math.round(H*dpr)); const ctx=cv.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,W,H);
  const pps=state.tl.pxPerSec, padT=6,padB=6,gh=Math.max(1,H-padT-padB);
  const ox=cv._ox!=null?cv._ox:((cv._local&&c)?c.start*pps:0); // absolute-px offset of the canvas's left edge — canvases are WINDOWED to the viewport (a full-width canvas dies past Chromium's 32767px limit)
  const Y=v=>padT+(1-(v-mn)/(mx-mn))*gh;
  const handles=[]; let firstVx=W;
  for(const cc of clist){ const cp=laneKey(cc,p); if(!cp)continue; // [R93] fx-type lanes resolve per clip; a clip without that effect draws nothing
    const X=t=>(cc.start+t)*pps-ox; const cx0=X(0),cx1=X(cc.dur); if(cx1<-4||cx0>W+4)continue;
    // [R102·D-T2] La rejilla sigue la polaridad de SU campo: en la banda de automatización el suelo es s1
    // (elevado) → la rejilla va OSCURA; sobre el clip el campo es el propio clip → sigue clara. Blender hace
    // exactamente esta inversión entre su editor de curvas y su secuenciador.
    ctx.strokeStyle=laneMode?'rgba(0,0,0,0.38)':'rgba(255,255,255,0.05)';ctx.lineWidth=1; {const y=padT+gh/2;ctx.beginPath();ctx.moveTo(Math.max(0,cx0),y);ctx.lineTo(Math.min(W,cx1),y);ctx.stroke();}
    const automated=!!(cc.kf&&cc.kf[cp]&&cc.kf[cp].length);
    const vx0=Math.max(cx0,-2), vx1=Math.min(cx1,W+2); if(vx0<firstVx)firstVx=vx0; // only the visible slice of the clip is sampled
    if(vx1>vx0){ ctx.setLineDash(automated?[]:[5,4]); ctx.globalAlpha=A_ON; ctx.strokeStyle=automated?col:'rgba(232,236,242,0.5)'; ctx.lineWidth=automated?W_ON:1.4; ctx.beginPath();
      const t0=Math.max(0,(vx0+ox)/pps-cc.start), t1=Math.min(cc.dur,(vx1+ox)/pps-cc.start); const SS=Math.max(8,Math.floor((vx1-vx0)/3)+1);
      const ks=automated?cc.kf[cp]:null; let si=0; // incremental segment walk (t is monotonic) — no per-sample O(n) rescan
      for(let i=0;i<=SS;i++){ const t=t0+(t1-t0)*i/SS; let v;
        if(!ks){ v=automated?evalP(cc,cp,cc.start+t):paramBase(cc,cp); }
        else if(t<=ks[0].t)v=ks[0].v; else if(t>=ks[ks.length-1].t)v=ks[ks.length-1].v;
        else { while(si<ks.length-2&&t>ks[si+1].t)si++; while(si>0&&t<ks[si].t)si--; const A=ks[si],B=ks[si+1];
          if(A.e==='bezier'||A.hOut||B.hIn)v=bezSegY(t,A,B); else { const f=easeF((t-A.t)/((B.t-A.t)||1),A.e||'linear'); v=A.v+(B.v-A.v)*f; } }
        const x=X(t),y=Y(v); i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);} ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha=1; }
    if(cc.kf&&cc.kf[cp]){ const ks=cc.kf[cp]; for(let i=0;i<ks.length;i++){ const k=ks[i]; if(!(k.e==='bezier'||k.hOut||k.hIn))continue; const kx=X(k.t),ky=Y(k.v); if(kx<-60||kx>W+60)continue;
      const dh=(dt,dv,kind)=>{ const hx=X(k.t+dt),hy=Y(k.v+dv); ctx.strokeStyle='rgba(255,255,255,0.35)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(kx,ky);ctx.lineTo(hx,hy);ctx.stroke();ctx.fillStyle=UI.ink;ctx.beginPath();ctx.arc(hx,hy,2.4,0,7);ctx.fill();handles.push({k,kind,x:hx,y:hy,c:cc});};
      if(i<ks.length-1&&k.hOut)dh(k.hOut.dt,k.hOut.dv,'out'); if(i>0&&k.hIn)dh(k.hIn.dt,k.hIn.dv,'in'); } }
    // breakpoints as small squares; hovered = white, selected = white with gray ring
    const selset=autoSelMatch(cc,cp);
    if(cc.kf&&cc.kf[cp])for(const k of cc.kf[cp]){const x=X(k.t); if(x<-24||x>W+24)continue; const y=Y(k.v),hov=(cv._hoverKf===k),isS=selset&&selset.has(k),s=(hov||isS)?6:4;
      if(hov||isS){ ctx.strokeStyle=col; ctx.globalAlpha=isS?0.5:0.3; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(x,y,s+5,0,7); ctx.stroke(); ctx.globalAlpha=1; } // pre-click grab ring
      ctx.globalAlpha=(hov||isS)?1:A_ON; // [R95·E2/E5] points fade with their lane, but hover/selection always reads at full white
      ctx.fillStyle=isS?'#FFFFFF':(hov?'#fff':col);ctx.strokeStyle=UI.s0;ctx.lineWidth=1;ctx.beginPath();ctx.rect(x-s,y-s,2*s,2*s);ctx.fill();ctx.stroke(); ctx.globalAlpha=1;
      if(isS){ctx.strokeStyle=UI.ink2;ctx.lineWidth=1;ctx.strokeRect(x-s-2,y-s-2,2*s+4,2*s+4);}}
  }
  // [R70] scale labels (sub-lanes) / param label (clip overlays) + value at the playhead
  const fmtV=v=>{const r=Math.round(v*10)/10;return (r%1===0?r.toFixed(0):r.toFixed(1))+(unit||'');};
  const lx=Math.max(3,(laneMode?0:firstVx)+3);
  if(cv._label){ ctx.font='600 11px Geist'; ctx.fillStyle='rgba(232,234,237,0.55)'; ctx.textBaseline='top'; ctx.fillText(cv._label,lx,2); ctx.textBaseline='alphabetic'; }
  else if(H>=30){ ctx.font='11px Geist'; ctx.fillStyle='rgba(154,160,168,0.55)'; ctx.textBaseline='top'; ctx.fillText(fmtV(mx),lx,1); ctx.textBaseline='alphabetic'; ctx.fillText(fmtV(mn),lx,H-2); }
  // [R94b] the playhead value dot + % label was removed per request (it didn't track playback — stale value mid-play)
  // [R95·B3] curve ghosting (Cavalry): while a gesture is live, the curve as it was before the drag stays behind in grey —
  // free differential feedback ("where was it?"). Built from a snapshot, so it costs nothing when idle.
  if(cv._ghostK&&cv._ghostK.c&&clist.includes(cv._ghostK.c)){ const gk=cv._ghostK; const gc=Object.assign({},gk.c,{kf:Object.assign({},gk.c.kf,{[gk.p]:gk.ks})});
    const X=t=>(gk.c.start+t)*pps-ox; const vx0=Math.max(X(0),-2), vx1=Math.min(X(gk.c.dur),W+2);
    if(vx1>vx0&&gk.ks.length){ ctx.save(); ctx.strokeStyle='rgba(201,205,211,0.30)'; ctx.lineWidth=1.2; ctx.setLineDash([3,3]); ctx.beginPath();
      const t0=Math.max(0,(vx0+ox)/pps-gk.c.start), t1=Math.min(gk.c.dur,(vx1+ox)/pps-gk.c.start); const SS=Math.max(8,Math.floor((vx1-vx0)/3)+1);
      for(let i=0;i<=SS;i++){ const t=t0+(t1-t0)*i/SS; const v=evalP(gc,gk.p,gk.c.start+t); const x=X(t),y=Y(v); i===0?ctx.moveTo(x,y):ctx.lineTo(x,y); }
      ctx.stroke(); ctx.setLineDash([]); ctx.restore(); } }
  // [R95·A1] pre-click affordance: light up the SEGMENT the pointer would act on (Bitwig 6 highlights the active zone
  // before you press). Fixes the most-cited friction of every curve editor — "one pixel off and you grabbed the wrong thing".
  if(cv._hoverSeg&&cv._hoverSeg.c){ const hs=cv._hoverSeg, hc=hs.c; if(clist.includes(hc)){ const kp=laneKey(hc,p); const X=t=>(hc.start+t)*pps-ox;
    const t0=hs.A?hs.A.t:0, t1=hs.B?hs.B.t:hc.dur; const SS=Math.max(6,Math.floor((X(t1)-X(t0))/4)+1);
    ctx.save(); ctx.strokeStyle=col; ctx.globalAlpha=0.28; ctx.lineWidth=7; ctx.lineCap='round'; ctx.beginPath();
    for(let i=0;i<=SS;i++){ const t=t0+(t1-t0)*i/SS; const v=evalP(hc,kp,hc.start+t); const x=X(t),y=Y(v); i===0?ctx.moveTo(x,y):ctx.lineTo(x,y); }
    ctx.stroke(); ctx.restore(); } }
  // [R95·B1] Shape Box over this curve's selection: dashed frame + 8 handles (corners scale/skew · edges stretch)
  cv._sbHandles=null;
  { const b=state.shapeBox; const sbC=b&&clist.find(x=>x.id===b.cid);
    if(b&&sbC&&laneKey(sbC,p)===b.p){ const X=t=>(sbC.start+t)*pps-ox;
      const x0=X(b.t0),x1=X(b.t1),y1=Y(b.v0),y0=Y(b.v1); // note: y0 = TOP (max value)
      const bx0=Math.min(x0,x1),bx1=Math.max(x0,x1),by0=Math.min(y0,y1),by1=Math.max(y0,y1);
      ctx.save(); ctx.setLineDash([4,3]); ctx.strokeStyle='rgba(201,205,211,0.85)'; ctx.lineWidth=1; ctx.strokeRect(bx0,by0,bx1-bx0,by1-by0); ctx.setLineDash([]);
      ctx.fillStyle='rgba(201,205,211,0.05)'; ctx.fillRect(bx0,by0,bx1-bx0,by1-by0);
      const hs=[]; const HS=3.5;
      for(const [hx,hy,kind] of [[bx0,by0,'nw'],[bx1,by0,'ne'],[bx1,by1,'se'],[bx0,by1,'sw'],[(bx0+bx1)/2,by0,'n'],[(bx0+bx1)/2,by1,'s'],[bx0,(by0+by1)/2,'w'],[bx1,(by0+by1)/2,'e']]){
        ctx.fillStyle=UI.s0; ctx.strokeStyle=UI.ink2; ctx.lineWidth=1; ctx.beginPath(); ctx.rect(hx-HS,hy-HS,HS*2,HS*2); ctx.fill(); ctx.stroke(); hs.push({x:hx,y:hy,kind}); }
      ctx.restore(); cv._sbHandles={hs,bx0,bx1,by0,by1,c:sbC}; } }
  // marquee selection rectangle
  if(cv._marq){const q=cv._marq;ctx.fillStyle='rgba(201,205,211,0.14)';ctx.strokeStyle='rgba(201,205,211,0.7)';ctx.lineWidth=1;ctx.fillRect(q.x0,q.y0,q.x1-q.x0,q.y1-q.y0);ctx.strokeRect(q.x0,q.y0,q.x1-q.x0,q.y1-q.y0);}
  // ghost breakpoint where a click would add (hover affordance)
  if(cv._ghost&&cv._ghost.c){ const gc=cv._ghost.c; const gx=(gc.start+cv._ghost.t)*pps-ox,gy=Y(cv._ghost.v); ctx.globalAlpha=0.5;ctx.strokeStyle=col;ctx.lineWidth=1;ctx.beginPath();ctx.rect(gx-3,gy-3,6,6);ctx.stroke();ctx.globalAlpha=1; }
  // value tooltip near the active point/segment
  if(cv._tip){ ctx.font='11px Geist'; const txt=cv._tip.text,tw=ctx.measureText(txt).width+8; let bx=Math.min(W-tw-1,Math.max(1,cv._tip.x-tw/2)),by=Math.max(1,cv._tip.y-16);
    ctx.fillStyle='rgba(10,11,13,0.92)';ctx.strokeStyle='rgba(255,255,255,0.18)';ctx.lineWidth=1;ctx.beginPath();ctx.rect(bx,by,tw,13);ctx.fill();ctx.stroke(); ctx.fillStyle=UI.ink;ctx.textBaseline='middle';ctx.fillText(txt,bx+4,by+7);ctx.textBaseline='alphabetic'; }
  cv._handles=handles; cv._map={c:laneMode?null:c,li:laneMode?cv._li:null,p,mn,mx,padT,gh,pps,unit,ox};
}
/* which envelope segment does clip-local time t fall on? lead = before first bp (flat), trail = after last (flat),
   mid = between two bps, flat = no bps at all (static value line). Used for Ableton-style vertical segment drag. */
function segAround(ks,t){ if(!ks||!ks.length)return {kind:'flat'}; if(t<=ks[0].t)return {kind:'lead',A:ks[0]}; if(t>=ks[ks.length-1].t)return {kind:'trail',A:ks[ks.length-1]};
  for(let i=0;i<ks.length-1;i++)if(t>=ks[i].t&&t<=ks[i+1].t)return {kind:'mid',A:ks[i],B:ks[i+1]}; return {kind:'flat'}; }
/* Ableton-style envelope editing on one canvas. Click line=add breakpoint · click point=SELECT (Shift extends,
   Alt+click deletes) · drag point=move (whole selection if selected) · drag segment vertically=move segment ·
   Alt-drag=curve · Alt-dbl-click=straighten · dbl-click point=numeric time/value editor · background drag=marquee ·
   background click=insert marker · right-click=menu (easing/copy/paste/simplify). Lazy pushUndo. Reuses the kf engine. */
let _glRaf=0; function scheduleGL(){ if(_glRaf)return; _glRaf=requestAnimationFrame(()=>{ _glRaf=0; render(); }); } // coalesce GL re-renders during curve drags to one per frame
/* [R94b] live refresh of a clip's keyframe-diamond strip while its curve is edited (renderTimeline only runs at gesture end) */
function updKfStrip(c){ if(!c)return; const cd=document.querySelector('.clip[data-clip="'+c.id+'"]'); if(!cd)return; const pps=state.tl.pxPerSec;
  const ts=new Set(); if(c.kf)for(const p in c.kf)for(const k of c.kf[p])ts.add(Math.round(k.t*1000)/1000);
  let strip=cd.querySelector('.kfstrip');
  if(!ts.size){ if(strip)strip.remove(); return; }
  const sel=(c.id===state.selId);
  if(!strip){ strip=document.createElement('div'); strip.className='kfstrip'+(sel?'':' dim'); cd.appendChild(strip); }
  strip.classList.toggle('dim',!sel);
  strip.innerHTML=[...ts].map(t=>sel?`<div class="kfd" data-t="${t}" title="${T('Keyframe','Fotograma clave')} · ${fmtTime(c.start+t)}" style="left:${t*pps}px"></div>`:`<div class="kfd" style="left:${t*pps}px"></div>`).join(''); }
function bindAutoCurve(cv){
  const M=()=>cv._map;
  const RK=c=>c?laneKey(c,M().p):null; // [R93] concrete per-clip kf key — fx-type lane keys resolve to the clip's own effect instance
  const fmtTip=v=>{ const m=M(),u=m&&m.unit?(' '+m.unit):''; return (Math.round(v*10)/10)+u; };
  // [R92-T4] lane-mode canvases (cv._li) cover MANY clips: inv() resolves the clip under the pointer; clip-overlay canvases keep their fixed clip.
  function inv(e){ const m=M(); if(!m)return null; const r=cv.getBoundingClientRect(); const lpx=e.clientX-r.left, lpy=e.clientY-r.top; const absT=(lpx+(m.ox||0))/m.pps;
    const tolT=10/(m.pps||120); // [L6] ~10px edge tolerance so keyframes sitting on a clip boundary are grabbable from just outside
    let c=m.c; if(m.li!=null){ c=null; for(const x of state.clips)if(x.lane===m.li&&absT>=x.start-tolT&&absT<=x.start+x.dur+tolT)if(!c||x.start>c.start)c=x; }
    else if(absT<m.c.start-tolT||absT>m.c.start+m.c.dur+tolT)return null;
    if(c&&!laneKey(c,m.p))c=null; // [R93] fx-type lane over a clip WITHOUT that effect → behaves like empty background
    const t=c?Math.max(0,Math.min(c.dur,absT-c.start)):null; const v=Math.max(m.mn,Math.min(m.mx,m.mn+(1-(lpy-m.padT)/m.gh)*(m.mx-m.mn))); return {t,v,m,lpx,lpy,c,absT}; }
  function kxy(k,c){ const m=M(); return {x:(c.start+k.t)*m.pps-(m.ox||0), y:m.padT+(1-(k.v-m.mn)/((m.mx-m.mn)||1))*m.gh}; }
  function nearKf2(r){ const c=r&&r.c; const kp=RK(c); if(!kp||!(c.kf&&c.kf[kp]))return null; let best=null,bd=24; for(const k of c.kf[kp]){ const q=kxy(k,c); const d=Math.hypot(q.x-r.lpx,q.y-r.lpy); if(d<bd){bd=d;best=k;} } return best?{k:best,d:bd}:null; } // [L6] wide grab-zone (24px) — easy to catch points, even edge ones
  function nearKf(r){ const n=nearKf2(r); return n?n.k:null; }
  function nearHandle(e){ if(!cv._handles)return null; const r=cv.getBoundingClientRect(); const mx=e.clientX-r.left,my=e.clientY-r.top; let best=null,bd=10; for(const h of cv._handles){ const d=Math.hypot(h.x-mx,h.y-my); if(d<bd){bd=d;best=h;} } return best?{h:best,d:bd}:null; }
  function lineDy(r){ const m=M(); const kp=RK(r.c); if(!kp)return 1e9; const lv=evalP(r.c,kp,r.c.start+r.t); const ly=m.padT+(1-(lv-m.mn)/((m.mx-m.mn)||1))*m.gh; return r.lpy-ly; }
  function selSetFor(c){ return (c&&state.autoSel&&state.autoSel.cid===c.id&&state.autoSel.p===RK(c))?state.autoSel.set:null; }
  function setTip(k,c){ const q=kxy(k,c); cv._tip={x:q.x,y:q.y,text:fmtTip(k.v)}; }
  function redraw(){ const m=M(); drawAutoCurve(cv,m.c,m.p); }
  /* [R95·B3] snapshot the curve for the ghost trail; cleared on pointerup */
  function ghostOn(C,P){ const ks=(C&&C.kf&&C.kf[P])||null; cv._ghostK=ks?{c:C,p:P,ks:JSON.parse(JSON.stringify(ks))}:null; }
  function ghostOff(){ if(cv._ghostK){ cv._ghostK=null; redraw(); } }
  function commit(){ const m0=M(); if(m0){ const cc=m0.c||selClip(); if(cc&&cc.kfLink&&cc.kfLink[m0.p])poolPropagate(cc,m0.p); } // [R95·D2] editing a pooled instance updates the item + every sibling
    redraw(); refreshInspector(); scheduleGL(); markDirty(); updKfStrip(selClip()); } // light per-move path: value refresh + one GL render per frame + live keyframe-diamond strip (it used to go stale until the next full renderTimeline); markDirty also invalidates the RA cache
  cv.addEventListener('pointerdown',e=>{ if(e.button!==0)return; if(state.tl.tool&&state.tl.tool!=='select')return; // razor/hand/zoom: let the event bubble to #tracks so the tools keep working over automation
    // [R95·B1] the Shape Box owns the pointer while it's open: handles first, then "inside = move", then fall through
    if(state.shapeBox&&cv._sbHandles){ const sb=cv._sbHandles, b=state.shapeBox; const rc=cv.getBoundingClientRect(); const px=e.clientX-rc.left, py=e.clientY-rc.top;
      let hit=null,bd=9; for(const h of sb.hs){ const d=Math.hypot(h.x-px,h.y-py); if(d<bd){bd=d;hit=h;} }
      const inside=(px>=sb.bx0-2&&px<=sb.bx1+2&&py>=sb.by0-2&&py<=sb.by1+2);
      if(hit||inside){ e.stopPropagation(); const mm=M(); const C0=sb.c; const d=paramDef(C0,b.p); if(!d)return; const mn=d[3],mx=d[4];
        const t0=b.t0,t1=b.t1,v0=b.v0,v1=b.v1; const spanT=(t1-t0)||1e-6, spanV=(v1-v0)||1e-6;
        const kind=hit?hit.kind:'move'; const downX=e.clientX, downY=e.clientY; let pushed=false; ghostOn(C0,b.p); // [R95·B3] ghost the pre-transform curve
        const mv=ev=>{ if(!pushed){pushUndo();pushed=true;}
          const dtT=((ev.clientX-downX)/mm.pps), dvV=-((ev.clientY-downY)/mm.gh)*(mx-mn);
          let sx=1,sy=1,ax=t0,ay=v0,skew=0,mt=0,mv2=0;
          const mir=ev.altKey; // [R95·B1] Alt = mirror about the opposite handle (Live 12 / Fusion)
          if(kind==='move'){ mt=dtT; mv2=dvV; }
          else if(kind==='e'){ ax=mir?(t0+t1)/2:t0; sx=1+dtT/(mir?spanT/2:spanT); }
          else if(kind==='w'){ ax=mir?(t0+t1)/2:t1; sx=1-dtT/(mir?spanT/2:spanT); }
          else if(kind==='n'){ ay=mir?(v0+v1)/2:v0; sy=1+dvV/(mir?spanV/2:spanV); }
          else if(kind==='s'){ ay=mir?(v0+v1)/2:v1; sy=1-dvV/(mir?spanV/2:spanV); }
          else { // corners: Ctrl = SKEW in time (shear), else scale on both axes
            const east=(kind==='ne'||kind==='se'), north=(kind==='nw'||kind==='ne');
            if(ev.ctrlKey||ev.metaKey){ skew=dtT*(north?1:-1); }
            else { ax=mir?(t0+t1)/2:(east?t0:t1); sx=east?(1+dtT/(mir?spanT/2:spanT)):(1-dtT/(mir?spanT/2:spanT));
                   ay=mir?(v0+v1)/2:(north?v0:v1); sy=north?(1+dvV/(mir?spanV/2:spanV)):(1-dvV/(mir?spanV/2:spanV)); } }
          shapeBoxApply(sx,sy,ax,ay,skew,mt,mv2,mn,mx,C0.dur); shapeBoxSync(); redraw(); refreshInspector(); scheduleGL(); markDirty(); };
        const up=()=>{ window.removeEventListener('pointermove',mv); window.removeEventListener('pointerup',up); cv._ghostK=null; shapeBoxSync(); renderTimeline(); renderInspector(); };
        window.addEventListener('pointermove',mv); window.addEventListener('pointerup',up); return; } }
    const m=M(); if(!m)return; const r=inv(e); const hh=nearHandle(e); const kk0=r?nearKf2(r):null;
    const h=(hh&&(!kk0||hh.d<=kk0.d))?hh.h:null; // when a handle and a point overlap, the CLOSER one wins (handles used to mask points)
    if(!h&&!r)return; e.stopPropagation();
    const C=(h&&h.c)||(r&&r.c)||null; // the clip this gesture edits (resolved per-pointer in lane mode)
    const P=RK(C); // concrete kf key for C (inv() already dropped clips that can't resolve the lane's fx)
    if(C&&state.selId!==C.id){ state.selId=C.id; state.selIds=[C.id]; state.selGroupId=null; laneDesel(); $$('.clip').forEach(x=>x.classList.toggle('sel',x.dataset.clip==C.id)); refreshInspector(); updStatus(); }
    let pushed=false; const undo=()=>{ if(!pushed){pushUndo();pushed=true;} };
    // [R92-T4] DRAW MODE (D): drag paints the curve — grid-quantized steps (hold), Alt = freehand (linear)
    if(state.tl.draw&&r&&C){ undo(); const paint=ev=>{ const rr=inv(ev); if(!rr||!rr.c)return; const cc=rr.c; const kp=RK(cc); if(!kp)return; cc.kf=cc.kf||{}; const ks=cc.kf[kp]=cc.kf[kp]||[];
        if(ev.altKey){ const tol=0.5/(state.fps||30); const i=ks.findIndex(kq=>Math.abs(kq.t-rr.t)<tol); if(i>=0){ks[i].v=rr.v;ks[i].e='linear';delete ks[i].hOut;delete ks[i].hIn;} else ks.push({t:rr.t,v:rr.v,e:'linear'}); }
        else { const g=Math.max(0.01,snapGrid()||gridSec()||0.25); const cellA=Math.max(0,Math.floor(rr.absT/g)*g-cc.start); const cellB=Math.min(cc.dur,cellA+g);
          for(let i=ks.length-1;i>=0;i--)if(ks[i].t>cellA+1e-6&&ks[i].t<cellB-1e-6)ks.splice(i,1);
          const i=ks.findIndex(kq=>Math.abs(kq.t-cellA)<1e-4); if(i>=0){ks[i].v=rr.v;ks[i].e='hold';delete ks[i].hOut;delete ks[i].hIn;} else ks.push({t:cellA,v:rr.v,e:'hold'}); }
        ks.sort((a,b)=>a.t-b.t); commit(); };
      ghostOn(C,P); paint(e); const up=ev=>{window.removeEventListener('pointermove',paint);window.removeEventListener('pointerup',up); cv._ghostK=null; // [R95·B3]
        if(ev&&ev.altKey){ const cc=(inv(ev)||{}).c||C; const kp=cc?RK(cc):null; const ks=kp&&cc.kf&&cc.kf[kp]; // [R95·A5] freehand auto-reduces to the fewest points on release (Bitwig/Reaper): the stroke stays editable instead of leaving one key per frame. Grid-quantised painting keeps its steps.
          if(ks&&ks.length>3){ const d=paramDef(cc,kp); if(d){ const mn=d[3],mx=d[4]; const pts=ks.map(k=>[k.t*state.tl.pxPerSec,(1-(k.v-mn)/((mx-mn)||1))*(cv._H||46)]); const keep=rdpKeep(pts,1.6);
            const out=ks.filter((k,i)=>keep.has(i)||k.e==='hold'); const rm=ks.length-out.length; if(rm>0){ cc.kf[kp]=out; flashStatus(rm+' '+T('points reduced','puntos reducidos')); } } } }
        renderInspector(); commit(); };
      window.addEventListener('pointermove',paint);window.addEventListener('pointerup',up); return; }
    // bezier tangent handle drag (fine curve shaping)
    if(h){ const move=ev=>{ const rr=inv(ev); if(!rr)return; undo(); const k=h.k,dt=(rr.absT-((h.c||C).start))-k.t,dv=rr.v-k.v; if(k.e!=='bezier')k.e='bezier'; if(h.kind==='out')k.hOut={dt:Math.max(0,dt),dv}; else k.hIn={dt:Math.min(0,dt),dv}; commit(); }; const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);renderInspector();}; window.addEventListener('pointermove',move);window.addEventListener('pointerup',up); return; }
    if(!C)
    { const downX=e.clientX; let moved=false; // lane-mode click on empty track space: plain click drops the insert marker
      const up=ev=>{ window.removeEventListener('pointerup',up); if(Math.abs(ev.clientX-downX)<3){ state.autoSel=null; const m2=M(); state.tl.selA=state.tl.selB=(ev.clientX-cv.getBoundingClientRect().left+(m2.ox||0))/m2.pps; state.tl.selLanes=[m2.li!=null?m2.li:0]; renderTimeSel(); redraw(); } };
      window.addEventListener('pointerup',up); return; }
    const k=kk0?kk0.k:null; const onLine=Math.abs(lineDy(r))<=6;
    // [R95·A2] ALT on a point: DRAG curves BOTH neighbouring segments symmetrically (Bitwig — one gesture for an ease in/out
    // around a key) · plain ALT+click (no drag) still deletes it, as before.
    if(e.altKey&&k){ const ks0=C.kf[P]; const i=ks0.indexOf(k); const A=ks0[i-1]||null, B=ks0[i+1]||null; const downY=e.clientY; let moved=false; ghostOn(C,P); // [R95·B3]
      const move=ev=>{ if(!moved&&Math.abs(ev.clientY-downY)<3)return; if(!moved){undo();moved=true;}
        const bend=((downY-ev.clientY)/m.gh)*(m.mx-m.mn)*0.66; // up = ease out of the previous / into the next (the curve bulges toward the key)
        if(A){ const seg=k.t-A.t; if(seg>0){ A.e='bezier'; A.hOut={dt:seg/3,dv:bend}; k.hIn={dt:-seg/3,dv:bend}; } }
        if(B){ const seg=B.t-k.t; if(seg>0){ k.e='bezier'; k.hOut={dt:seg/3,dv:-bend}; B.hIn={dt:-seg/3,dv:-bend}; } }
        cv._hoverKf=k; commit(); };
      const up=()=>{ window.removeEventListener('pointermove',move); window.removeEventListener('pointerup',up);
        if(!moved){ pushUndo(); C.kf[P]=C.kf[P].filter(x=>x!==k); if(!C.kf[P].length)delete C.kf[P]; const sel0=selSetFor(C); if(sel0){sel0.delete(k); if(!sel0.size)state.autoSel=null;} cv._hoverKf=null; cv._tip=null; commit(); } // ALT+click (no drag) = delete
        else renderInspector(); };
      window.addEventListener('pointermove',move); window.addEventListener('pointerup',up); return; }
    // ALT-drag a segment → curve it (Ableton)
    if(e.altKey&&!k){ const ks=C.kf&&C.kf[P]; if(ks&&ks.length>=2&&r.t>ks[0].t&&r.t<ks[ks.length-1].t){ let A=null,B=null; for(let i=0;i<ks.length-1;i++){if(r.t>=ks[i].t&&r.t<=ks[i+1].t){A=ks[i];B=ks[i+1];break;}} if(A&&B){ const move=ev=>{ const rr=inv(ev); if(!rr||rr.c!==C)return; undo(); const seg=B.t-A.t; if(seg<=0)return; const u=(rr.t-A.t)/seg, straight=A.v+(B.v-A.v)*u, bend=(rr.v-straight)*1.33; A.e='bezier'; A.hOut={dt:seg/3,dv:bend}; B.hIn={dt:-seg/3,dv:bend}; commit(); }; const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);renderInspector();}; window.addEventListener('pointermove',move);window.addEventListener('pointerup',up); return; } } }
    // POINT: drag = move (with selection); plain click (no move) = DELETE it (Ableton-style quick remove); Shift+click = extend/toggle the selection
    if(k){ const downX=e.clientX,downY=e.clientY,downT=r.t,downV=r.v,kt0=k.t; let moved=false; const sel=selSetFor(C); const grp=(sel&&sel.has(k))?[...sel]:[k]; const base=grp.map(g=>({g,t:g.t,v:g.v}));
      cv._hoverKf=k; setTip(k,C); ghostOn(C,P); // [R95·B3]
      const move=ev=>{ if(!moved&&Math.hypot(ev.clientX-downX,ev.clientY-downY)<3)return; if(!moved){undo();moved=true;} const rr=inv(ev); if(!rr)return; let dt=(rr.absT-C.start)-downT, dv=rr.v-downV; if(ev.shiftKey){dt*=0.25;dv*=0.25;}
        if(state.tl.snap&&!ev.altKey&&!ev.ctrlKey&&!ev.metaKey){ const g=snapGrid(); if(g>0){ const tt=kt0+dt,sn=Math.round(tt/g)*g; if(Math.abs((sn-tt)*m.pps)<7)dt=sn-kt0; } } // snap vs the DRAG-ORIGIN time (the live k.t moves every frame → snapping against it double-counted the delta and never landed on the grid)
        for(const b of base){ b.g.t=Math.max(0,Math.min(C.dur,b.t+dt)); b.g.v=Math.max(m.mn,Math.min(m.mx,b.v+dv)); }
        C.kf[P].sort((a,b2)=>a.t-b2.t); cv._hoverKf=k; setTip(k,C); commit(); };
      const up=()=>{ window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up); cv._tip=null; cv._ghostK=null; // [R95·B3]
        if(!moved){ const sel0=selSetFor(C);
          if(e.shiftKey){ if(sel0){ sel0.has(k)?sel0.delete(k):sel0.add(k); if(!sel0.size)state.autoSel=null; } else state.autoSel={cid:C.id,p:P,set:new Set([k])}; } // Shift = selection (marquee-compatible)
          else { undo(); C.kf[P]=C.kf[P].filter(x=>x!==k); if(!C.kf[P].length)delete C.kf[P]; if(sel0){sel0.delete(k); if(!sel0.size)state.autoSel=null;} cv._hoverKf=null; } } // [R93] plain click ON a point removes it
        else { const ks=C.kf&&C.kf[P]; if(ks){ const tol=Math.min(0.02,0.5/(state.fps||30)); for(let i=ks.length-1;i>=0;i--){ const kk=ks[i]; if(grp.includes(kk))continue; if(grp.some(g=>Math.abs(g.t-kk.t)<tol))ks.splice(i,1); } } } // [R92-T4] Ableton: dragging a point over a neighbour swallows it (no more two points on the same frame)
        commit(); };
      window.addEventListener('pointermove',move);window.addEventListener('pointerup',up); return; }
    // LINE: drag = move segment vertically; click (no move) = add breakpoint
    if(onLine){ const ks=(C.kf&&C.kf[P])?C.kf[P]:null; const s=segAround(ks,r.t); const downX=e.clientX,downY=e.clientY; let moved=false; const baseA=s.A?s.A.v:paramBase(C,P), baseB=s.B?s.B.v:null; ghostOn(C,P); // [R95·B3]
      const move=ev=>{ if(!moved&&Math.hypot(ev.clientX-downX,ev.clientY-downY)<4)return; if(!moved){undo();moved=true;} let dv=(downY-ev.clientY)/m.gh*(m.mx-m.mn); if(ev.shiftKey)dv*=0.25; const cl=v=>Math.max(m.mn,Math.min(m.mx,v));
        if(s.kind==='flat'){ setParamBase(C,P,cl(baseA+dv)); } else if(s.kind==='mid'){ s.A.v=cl(baseA+dv); s.B.v=cl(baseB+dv); } else { s.A.v=cl(baseA+dv); }
        const vv=(s.kind==='flat')?paramBase(C,P):s.A.v; cv._tip={x:ev.clientX-cv.getBoundingClientRect().left, y:m.padT+(1-(vv-m.mn)/((m.mx-m.mn)||1))*m.gh, text:fmtTip(vv)}; commit(); };
      const up=()=>{ window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up); cv._tip=null; cv._ghostK=null; // [R95·B3]
        if(!moved){ const ks2=(C.kf&&C.kf[P])?C.kf[P]:[]; const near=ks2.find(x=>Math.abs(x.t-r.t)<0.02); if(near){ state.autoSel={cid:C.id,p:P,set:new Set([near])}; } else { undo(); setKf(C,P,C.start+r.t,r.v,curEase()); } commit(); }
        else { commit(); } };
      window.addEventListener('pointermove',move);window.addEventListener('pointerup',up); return; }
    // BACKGROUND: drag = marquee-select breakpoints (of the clip where the drag started); plain click = clear selection + drop the timeline insert marker (play starts here — same model as clicking a clip body)
    { const downX=e.clientX,downY=e.clientY; let moved=false; const rect=cv.getBoundingClientRect();
      const move=ev=>{ if(!moved&&Math.hypot(ev.clientX-downX,ev.clientY-downY)<3)return; moved=true; const x0=Math.min(downX,ev.clientX)-rect.left,x1=Math.max(downX,ev.clientX)-rect.left,y0=Math.min(downY,ev.clientY)-rect.top,y1=Math.max(downY,ev.clientY)-rect.top; cv._marq={x0,y0,x1,y1};
        const set=new Set(); if(C.kf&&C.kf[P])for(const kk of C.kf[P]){const q=kxy(kk,C); if(q.x>=x0&&q.x<=x1&&q.y>=y0&&q.y<=y1)set.add(kk);} state.autoSel=set.size?{cid:C.id,p:P,set}:null; redraw(); };
      const up=ev=>{ window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up); cv._marq=null;
        if(!moved){ state.autoSel=null; const rr=inv(ev)||r; if(rr){ state.tl.selA=state.tl.selB=rr.absT; state.tl.selLanes=[C.lane]; renderTimeSel(); } }
        redraw(); };
      window.addEventListener('pointermove',move);window.addEventListener('pointerup',up); return; }
  });
  cv.addEventListener('pointermove',e=>{ if(e.buttons)return; const m=M(); if(!m)return;
    if(state.tl.tool&&state.tl.tool!=='select'){ if(cv._ghost||cv._hoverKf||cv._tip){cv._ghost=null;cv._hoverKf=null;cv._tip=null;redraw();} cv.style.cursor='inherit'; cv.title=''; return; } // [R94-UT2·U-06] no point-tooltip outside the select tool
    const r=inv(e);
    if(!r||!r.c){ if(cv._ghost||cv._hoverKf||cv._tip){cv._ghost=null;cv._hoverKf=null;cv._tip=null;redraw();} cv.style.cursor=(r&&state.tl.draw)?'crosshair':'default'; cv.title=''; if(state.hoverAuto&&state.hoverAuto.cv===cv&&!r)state.hoverAuto=null; return; }
    state.hoverAuto={cid:r.c.id,p:RK(r.c),cv,t:r.absT}; // Ctrl+A / Ctrl+V target the hovered lane (concrete per-clip key); [L5] t = the absolute time under the cursor so paste lands at the click/hover, not the playhead
    if(state.tl.draw){ cv.style.cursor='crosshair'; cv.title=''; if(cv._hoverKf||cv._ghost||cv._tip){cv._hoverKf=null;cv._ghost=null;cv._tip=null;redraw();} return; } // [R94-UT2·U-06]
    const k=nearKf(r); const onLine=Math.abs(lineDy(r))<=6;
    if(!k&&!onLine&&!cv._ghost&&!cv._hoverKf&&!cv._tip&&!cv._hoverSeg){ cv.style.cursor='crosshair'; return; } // nothing hover-visual changed — skip the redraw
    if(k){ cv.style.cursor='move'; cv.title=T('Drag moves · click removes · Alt+drag curves both sides · right-click edits value','Arrastrar mueve · clic elimina · Alt+arrastrar curva ambos lados · clic derecho edita el valor'); cv._hoverKf=k; cv._ghost=null; cv._hoverSeg=null; setTip(k,r.c); } // move = drag is the primary gesture · [R94-UT2·U-06] title feeds the .dsp-tip hover tooltip
    else if(onLine){ cv.style.cursor='ns-resize'; cv.title=T('Drag moves the segment · click adds a point · Alt+drag curves it','Arrastrar mueve el segmento · clic añade un punto · Alt+arrastrar lo curva'); cv._hoverKf=null; cv._ghost={t:r.t,v:evalP(r.c,RK(r.c),r.c.start+r.t),c:r.c}; cv._tip=null;
      { const kp=RK(r.c); const ks=(r.c.kf&&r.c.kf[kp])?r.c.kf[kp]:null; const s=segAround(ks,r.t); cv._hoverSeg={A:s.A||null,B:s.B||null,c:r.c}; } } // [R95·A1] light up the very segment this press would act on
    else { cv.style.cursor='crosshair'; cv.title=''; cv._hoverKf=null; cv._ghost=null; cv._tip=null; cv._hoverSeg=null; }
    redraw(); });
  cv.addEventListener('pointerleave',()=>{ const m=M(); cv.title=''; if(state.hoverAuto&&state.hoverAuto.cv===cv)state.hoverAuto=null; if(cv._hoverKf||cv._ghost||cv._tip||cv._hoverSeg){cv._hoverKf=null;cv._ghost=null;cv._tip=null;cv._hoverSeg=null;if(m)redraw();} }); // [R94-UT2·U-06]
  // dbl-click a point → inline numeric editor for BOTH time (absolute s, like the ruler) and value
  function openKfEditor(k,kc){ const m=M(); if(!m)return; const c=kc||m.c; const q=kxy(k,c); const rc=cv.getBoundingClientRect();
    const wrap=document.createElement('div'); wrap.style.cssText='position:fixed;z-index:9999;display:flex;gap:4px;align-items:center;';
    const mk=(val,title)=>{ const i=document.createElement('input'); i.type='text'; i.value=val; i.title=title; i.style.cssText='width:56px;height:18px;text-align:right;font-family:Geist,system-ui,sans-serif;font-variant-numeric:tabular-nums;font-size:11px;color:var(--ink);background:var(--s0);border:.5px solid #C9CDD3;border-radius:2px;box-shadow:0 0 0 2px rgba(201,205,211,0.25);padding:0 4px;outline:none;'; return i; };
    const ti=mk(Math.round((c.start+k.t)*1000)/1000,T('Time (s)','Tiempo (s)')), vi=mk(Math.round(k.v*100)/100,T('Value','Valor'));
    wrap.appendChild(ti); wrap.appendChild(vi);
    wrap.style.left=Math.max(4,Math.min(innerWidth-130,rc.left+q.x-60))+'px'; wrap.style.top=Math.max(4,rc.top+q.y-26)+'px'; document.body.appendChild(wrap); vi.focus(); vi.select();
    let done=false; const fin=ok=>{ if(done)return; done=true; if(ok){ const nv=parseFloat(vi.value.replace(',','.')), nt=parseFloat(ti.value.replace(',','.'));
        const chV=!isNaN(nv)&&Math.abs(nv-k.v)>1e-9, chT=!isNaN(nt)&&Math.abs(nt-(c.start+k.t))>1e-9;
        if(chV||chT){ pushUndo(); const kp=RK(c); if(chV)k.v=Math.max(m.mn,Math.min(m.mx,nv)); if(chT){ k.t=Math.max(0,Math.min(c.dur,nt-c.start)); if(kp&&c.kf[kp])c.kf[kp].sort((a,b)=>a.t-b.t); } commit(); } } wrap.remove(); };
    const key=ev=>{ ev.stopPropagation(); if(ev.key==='Enter'){ev.preventDefault();fin(true);} else if(ev.key==='Escape'){ev.preventDefault();fin(false);} };
    const blur=()=>{ setTimeout(()=>{ if(!wrap.contains(document.activeElement))fin(true); },0); };
    for(const i of [ti,vi]){ i.addEventListener('keydown',key); i.addEventListener('blur',blur); } }
  cv.addEventListener('dblclick',e=>{ if(state.tl.tool&&state.tl.tool!=='select')return; const r=inv(e); if(!r||!r.c)return; e.stopPropagation(); const C=r.c; const P=RK(C); if(!P)return;
    if(e.altKey){ const ks=C.kf&&C.kf[P]; if(!ks)return; const s=segAround(ks,r.t); pushUndo(); if(s.A){s.A.e='linear';delete s.A.hOut;delete s.A.hIn;} if(s.B){s.B.e='linear';delete s.B.hIn;delete s.B.hOut;} commit(); return; } // Alt-dbl-click = straighten
    let k=nearKf(r); if(!k && Math.abs(lineDy(r))<=8){ pushUndo(); setKf(C,P,C.start+r.t,r.v,curEase()); if(C.kf[P])C.kf[P].sort((a,b)=>a.t-b.t); k=(C.kf[P]||[]).find(x=>Math.abs(x.t-r.t)<0.03); commit(); } // dbl-click empty line = add a point then edit it
    if(k)openKfEditor(k,C); }); // dbl-click a point = type exact time/value
  cv.addEventListener('contextmenu',e=>{ const r=inv(e); if(!r||!r.c)return; e.preventDefault(); e.stopPropagation(); const m=M(); const C=r.c; const P=RK(C); if(!P)return; const k=nearKf(r); const sel=selSetFor(C);
    if(k){ openKfEditor(k,C); return; } // [R93] right-click ON a point = type its exact time/value (click deletes, so the editor moved here)
    const items=[];
    // [R70→R93→R95·A4] easing: the preset LIBRARY over a normalised curve first (applies to the segment under the cursor,
    // or to every consecutive pair inside the selection), then the plain point-easing types.
    { const ks=C.kf&&C.kf[P]; const s=segAround(ks||[],r.t);
      const pairs=easeTargets(C,P,s);
      if(pairs.length){ for(const [en,es,bz] of EASE_PRESETS) items.push({label:T(en,es),fn:()=>{ pushUndo(); for(const [A,B] of pairs){ if(bz[0]===0&&bz[1]===0&&bz[2]===1&&bz[3]===1){ A.e='linear'; delete A.hOut; delete B.hIn; } else applyEasePreset(C,P,A,B,bz); } commit(); }});
        items.push('sep',{label:T('Copy easing','Copiar suavizado'),fn:()=>{ const [A,B]=pairs[0]; const seg=B.t-A.t,dv=B.v-A.v; state.easeClip=(A.hOut&&B.hIn&&seg>0)?[A.hOut.dt/seg, dv?A.hOut.dv/dv:0, 1+B.hIn.dt/seg, dv?1+B.hIn.dv/dv:1]:[0,0,1,1]; flashStatus(T('Easing copied','Suavizado copiado')); }});
        if(state.easeClip) items.push({label:T('Paste easing','Pegar suavizado'),fn:()=>{ pushUndo(); for(const [A,B] of pairs)applyEasePreset(C,P,A,B,state.easeClip); commit(); }});
        items.push('sep'); }
      if(s.A||(sel&&sel.size)){ const targets=()=>((sel&&sel.size)?[...sel]:[s.A].filter(Boolean));
        const ease=(lbl,fn)=>({label:lbl,fn:()=>{ pushUndo(); for(const kk of targets())fn(kk); commit(); }});
        items.push(
          ease(T('Hold','Mantener'),kk=>{kk.e='hold';delete kk.hOut;delete kk.hIn;}),
          ease(T('Free bezier','Bezier libre'),kk=>initBez(C,P,kk)),
          'sep'); } }
    if(sel&&sel.size>1) items.push({label:T('Set value…','Fijar valor…'),fn:()=>autoSelApply('value')},{label:T('Offset…','Desplazar…'),fn:()=>autoSelApply('offset')},{label:T('Scale…','Escalar…'),fn:()=>autoSelApply('scale')},'sep'); // [R95·A3] Fusion's Value/Offset/Scale over a multi-selection
    if(sel&&sel.size>1) items.push({label:(state.shapeBox?'✓ ':'')+T('Shape Box','Caja de forma'),key:'⇧B',fn:()=>shapeBoxToggle()},
      {label:T('Taper: amplify ×1.25','Amplitud ×1,25'),fn:()=>taperSel(1.25)},{label:T('Taper: reduce ×0.8','Amplitud ×0,8'),fn:()=>taperSel(0.8)},'sep'); // [R95·B1/B2]
    items.push({label:T('Add breakpoint here','Añadir punto aquí'),ico:'diamond',fn:()=>{pushUndo();setKf(C,P,C.start+r.t,r.v,curEase());commit();}});
    if(sel&&sel.size) items.push({label:T('Delete selected','Eliminar selección')+' ('+sel.size+')',danger:true,fn:()=>{pushUndo();C.kf[P]=C.kf[P].filter(x=>!sel.has(x));if(!C.kf[P]||!C.kf[P].length)delete C.kf[P];state.autoSel=null;commit();}});
    items.push('sep',{label:T('Copy curve','Copiar curva')+((sel&&sel.size)?' ('+sel.size+')':''),key:'⌘C',fn:()=>copyAutoCurve(C,P,sel)});
    if(state.kfClipboard&&state.kfClipboard.ks&&state.kfClipboard.ks.length) items.push({label:T('Paste here','Pegar aquí'),key:'⌘V',fn:()=>pasteAutoAt({cid:C.id,p:P},C.start+r.t)});
    if(C.kf&&C.kf[P]&&C.kf[P].length>3) items.push({label:T('Simplify curve','Simplificar curva'),fn:()=>simplifyAuto(C,P)});
    // [R92-T4] Insert shape (Ableton Live 12): scaled to the time-selection when it overlaps this clip, else to one grid step at the click
    { const sA=state.tl.selA,sB=state.tl.selB; const hasSel=(sA!=null&&sB!=null&&Math.abs(sB-sA)>1e-3);
      const rng=()=>{ if(hasSel){ const a=Math.max(0,Math.min(sA,sB)-C.start), b=Math.min(C.dur,Math.max(sA,sB)-C.start); if(b>a+1e-3)return [a,b]; } const g=Math.max(0.05,snapGrid()||gridSec()||1); const a=Math.max(0,Math.min(C.dur-0.05,r.t)); return [a,Math.min(C.dur,a+g)]; };
      const SH=(lbl,pts)=>({label:lbl,fn:()=>{ pushUndo(); const [a,b]=rng(); const span=b-a; C.kf=C.kf||{}; const ks=C.kf[P]=(C.kf[P]||[]).filter(x=>x.t<a-1e-6||x.t>b+1e-6);
        for(const q of pts)ks.push({t:a+q[0]*span,v:m.mn+q[1]*(m.mx-m.mn),e:q[2]||'linear'}); ks.sort((x,y)=>x.t-y.t); state.autoSel=null; commit(); }});
      const sine=[]; for(let i=0;i<=16;i++)sine.push([i/16,0.5-0.5*Math.cos(2*Math.PI*i/16)]);
      items.push('sep',
        SH(T('Insert shape: Sine','Insertar forma: Seno'),sine),
        SH(T('Insert shape: Triangle','Insertar forma: Triángulo'),[[0,0],[0.5,1],[1,0]]),
        SH(T('Insert shape: Square','Insertar forma: Cuadrada'),[[0,1,'hold'],[0.5,0,'hold'],[1,1,'hold']]),
        SH(T('Insert shape: Ramp up','Insertar forma: Rampa asc.'),[[0,0],[1,1]]),
        SH(T('Insert shape: Ramp down','Insertar forma: Rampa desc.'),[[0,1],[1,0]])); }
    items.push('sep',...itemMenuItems(C,P,r.t)); // [R95·D2] Automation Items: save / insert / loop / relative / unlink
    items.push('sep',{label:T('Clear this automation','Borrar esta automatización'),danger:true,fn:()=>{pushUndo();if(C.kf)delete C.kf[P];unlinkItem(C,P);state.autoSel=null;commit();}});
    openMenu(e.clientX,e.clientY,items); });
}
/* Primary automation param (index 0) is drawn as a canvas that is a CHILD of the clip, covering the clip body
   below a reserved title band (so the clip's title/trim/fade/kfstrip stay grabbable and clip move/trim still work).
   Shown on EVERY (video) clip while automation mode is on (Ableton-style); the param chip shows on the selected clip.
   [R70] The canvas is WINDOWED to the visible viewport slice (full-width canvases silently die past Chromium's
   32767px limit — same fix as the ruler and the audio waveforms) and repositioned/redrawn on scroll. */
function windowAutoCv(cv){ const sc=$('#tlscroll'); const pps=state.tl.pxPerSec; const c=cv._c; if(!c&&cv._li==null)return; const MARGIN=260; // [R92-T4] track-level lane canvases have no fixed clip
  const vx0=(sc?sc.scrollLeft:0)-MARGIN, vx1=(sc?sc.scrollLeft+sc.clientWidth:1600)+MARGIN;
  if(cv._kind==='clip'){ const x0=c.start*pps, x1=x0+Math.max(14,c.dur*pps); const w0=Math.max(x0,vx0), w1=Math.min(x1,vx1);
    if(w1<=w0){ cv.style.display='none'; cv._ox=x0; cv._W=1; return; }
    cv.style.display=''; cv.style.left=(w0-x0)+'px'; cv.style.width=(w1-w0)+'px'; cv._W=Math.max(1,Math.round(w1-w0)); cv._ox=w0; }
  else { const W=(state.tl._w||0)*pps; const w0=Math.max(0,vx0), w1=Math.min(W,Math.max(w0+1,vx1)); cv.style.left=w0+'px'; cv.style.width=Math.max(1,w1-w0)+'px'; cv._W=Math.max(1,Math.round(w1-w0)); cv._ox=w0; }
  drawAutoCurve(cv,cv._c,cv._p); }
let _autoCvRaf=0; function scheduleAutoCvs(){ if(_autoCvRaf)return; _autoCvRaf=requestAnimationFrame(()=>{ _autoCvRaf=0; for(const cv of $$('#tracks canvas.clipautocv, #tracks canvas.autocv')){ if(cv._c||cv._li!=null)windowAutoCv(cv); } }); } // re-window + redraw the visible slice on scroll (like scheduleWaves)
function attachClipAuto(cd,c,li){ if(!state.inlineCurves)return; const lane=state.lanes[li]; if(lane&&(lane.kind==='audio'||lane.collapsed))return;
  const clipH=Math.max(8,laneH(li)-8); const bandH=clipH-RES_TOP-1; if(bandH<26)return; // no usable curve area
  const p=laneAutoP(lane,li); const cp=laneKey(c,p); if(!cp)return; // [R93] the TRACK's primary param (chosen in the track header, Ableton-style); a clip without the lane's fx draws nothing
  const cv=document.createElement('canvas'); cv.className='clipautocv'; cv.style.top=RES_TOP+'px'; cv.style.height=bandH+'px'; cv._H=bandH; cv._c=c; cv._p=p; cv._kind='clip'; cd.appendChild(cv); // [R94e] no param label painted on the clip — the track header's choosers already name it
  windowAutoCv(cv); bindAutoCurve(cv); // [R93] the param chip moved to the TRACK HEADER (autoctl) — nothing else lives on the clip
}
/* [R143] TRACK-level stacked automation sub-lanes (lane._auto / lane._autoH) + laneAutoH/appendAutoLanes ARCHIVADOS →
   _backup/deprecated/20260723-automation-sublanes-and-clip-auto.js · render ya neutralizado por [A5] (`return;`); el
   modelo vigente es la SOLA superposición por pista (lane._autoP + attachClipAuto + chooser de cabecera). */

/* ===================== PLAYBACK ===================== */
/* [T1/T2/T3] WebCodecs random-access decode + LRU frame-texture cache + lookahead.
   All-intra proxy chunks → reused VideoDecoder per source; decoded frames are cached as GPU
   textures (pooled + LRU-evicted, never evicting a displayed one) so revisits cost ~0 and
   forward motion prefetches the next frames. Replaces <video>+seek for scrub. */
const _vdec=new Map();
function ensureDecoder(m){ if(!m||!m.frames||!m.decConfig)return null; let d=_vdec.get(m.id); if(d)return d;
  d={pending:null,chain:Promise.resolve(),dec:null};
  try{ d.dec=new VideoDecoder({output:f=>{ if(d.pending){const p=d.pending;d.pending=null;p(f);} else f.close(); },error:e=>{ console.warn('vdec',e); try{d.dec.close();}catch(_){} _vdec.delete(m.id); }}); d.dec.configure(m.decConfig); }catch(e){ console.warn('vdec cfg',e); return null; }
  _vdec.set(m.id,d); return d; }
const _fcache=new Map(), _fpool=[]; let _fclock=0; const FC_MAX=64;
function _fcEvict(){ if(_fcache.size<=FC_MAX)return; const inUse=new Set(state.media.map(x=>x.tex)); for(const [k,v] of _fcache){ if(_fcache.size<=FC_MAX)break; if(inUse.has(v.tex))continue; _fcache.delete(k); _fpool.push(v.tex); } }
function decodeIntoCache(m,F){ const d=ensureDecoder(m); if(!d)return Promise.resolve(false); F=Math.max(0,Math.min(m.frames.length-1,F|0)); const key=m.id+':'+F;
  const hit=_fcache.get(key); if(hit){ hit.last=++_fclock; return Promise.resolve(true); }
  d.chain=d.chain.then(()=>new Promise(res=>{ const h2=_fcache.get(key); if(h2){h2.last=++_fclock;res(true);return;} const ch=m.frames[F]; if(!ch){res(false);return;}
    d.pending=f=>{ try{ const tex=_fpool.length?_fpool.pop():newTex(); upTex(tex,f); _fcache.set(key,{tex,last:++_fclock}); _fcEvict(); }catch(err){} f.close(); res(true); };
    try{ d.dec.decode(new EncodedVideoChunk({type:'key',timestamp:ch.ts,duration:ch.dur,data:ch.data})); d.dec.flush().catch(()=>{}); }catch(err){ d.pending=null; res(false); } }));
  return d.chain; }
function showFrame(m,F){ F=Math.max(0,Math.min(m.frames.length-1,F|0)); return decodeIntoCache(m,F).then(ok=>{ if(ok){ const e=_fcache.get(m.id+':'+F); if(e){ m.tex=e.tex; m._texFrame=F; e.last=++_fclock; } } for(let k=1;k<=2;k++){ const nf=F+k; if(nf<m.frames.length&&!_fcache.has(m.id+':'+nf)) decodeIntoCache(m,nf); } return ok; }); }
function decodeFrameToTex(m,F){ return showFrame(m,F); }
function disposeDecoder(m){ if(!m)return; const d=_vdec.get(m.id); if(d){try{d.dec.close();}catch(e){} _vdec.delete(m.id);} for(const [k,v] of _fcache){ if(k.indexOf(m.id+':')===0){ _fcache.delete(k); try{gl.deleteTexture(v.tex);}catch(e){} } } }
function clearFrameCache(){ for(const [,v] of _fcache){try{gl.deleteTexture(v.tex);}catch(e){}} _fcache.clear(); while(_fpool.length){try{gl.deleteTexture(_fpool.pop());}catch(e){}} }
function seekMedia(m,t,useOrig){ if(!useOrig&&m&&m.frames&&m.decConfig){ return showFrame(m,Math.round(t*(m.fps||30))).then(()=>{}); }
  return new Promise(res=>{ const v=useOrig?m.originalEl:(m.el||m.originalEl); if(!v||m.kind==='image'){res();return;}
  t=Math.max(0,Math.min((v.duration||0)-1e-3,t)); if(Math.abs(v.currentTime-t)<1e-3&&v.readyState>=2){upTex(m.tex,v);requestAnimationFrame(()=>res());return;}
  const on=()=>{v.removeEventListener('seeked',on);upTex(m.tex,v);res();};v.addEventListener('seeked',on);v.currentTime=t; }); }
let seekTok=0;
async function scrubRender(){ const tok=++seekTok; positionPlayhead(); refreshInspector();
  const drawn=collectDrawnVideoClips(state.clips,state.lanes,state.playhead,0,[]);
  await Promise.all(drawn.map(({c,m,local})=>vinstSeek(c,m,local)));
  if(tok===seekTok) render(); }
const HAS_RVFC = (typeof HTMLVideoElement!=='undefined') && ('requestVideoFrameCallback' in HTMLVideoElement.prototype);
/* upload a video frame to its texture only when a NEW frame is presented (vs re-uploading every rAF) */
function pumpVF(m){ const v=m.el; if(!v||!v.requestVideoFrameCallback)return; const cb=()=>{ if(!state.playing||v.paused){m._vf=0;return;} upTex(m.tex,v); m._vf=v.requestVideoFrameCallback(cb); }; m._vf=v.requestVideoFrameCallback(cb); }
function stopVF(m){ if(m._vf&&m.el&&m.el.cancelVideoFrameCallback){try{m.el.cancelVideoFrameCallback(m._vf);}catch(e){}} m._vf=0; }
/* ===================== [R108] WebCodecs decode path: MP4 (HEVC · H.264) range demuxer =====================
   Premiere runs 4× HEVC 10-bit no-proxy because it owns its decode pipeline; our per-clip <video> tops out at
   ~3 concurrent HW decoders (MEASURED — the 4th collapses to software). WebCodecs VideoDecoder has no such cliff
   (measured: 4 decoders → 196fps each; 6 → 130). This demuxer reads the moov + samples out of a huge source by
   RANGE (DSP.openRead/readAt) — never loads the whole file — and yields EncodedVideoChunk-ready samples + the
   decoder config. Handles hvc1/hev1/avc1/avc3, faststart or moov-at-end, stco/co64, real stts, ctts (B-frame
   PTS) and stss. Verified end-to-end (demux → VideoDecoder → 150/150 frames, 0 errors) on HEVC10 + H.264. */
async function demuxMP4(path){
  if(!(IS_ELEC && DSP.openRead && DSP.readAt)) throw new Error('range reads unavailable');
  const id=await DSP.openRead(path); if(id==null) throw new Error('openRead failed');
  const rd=(p,l)=>DSP.readAt(id,p,l); const fc=(u,o)=>String.fromCharCode(u[o],u[o+1],u[o+2],u[o+3]);
  try{
    const st=await DSP.stat(path); const size=(st&&st.size)||0; // [R108-rev B1] inside try → the fd is closed even if stat rejects
    let p=0, moov=null; // walk top-level box headers to find moov (may sit after mdat)
    while(p+8<=size){ const h=await rd(p,16); if(!h||h.length<8)break; const dv=new DataView(h.buffer,h.byteOffset,h.byteLength);
      let sz=dv.getUint32(0); const t=fc(h,4); let hs=8; if(sz===1){ sz=Number(dv.getBigUint64(8)); hs=16; } else if(sz===0){ sz=size-p; }
      if(t==='moov'){ moov={start:p,size:sz,hs}; break; } if(sz<=0)break; p+=sz; }
    if(!moov) throw new Error('no moov');
    const mv=await rd(moov.start,moov.size); const dv=new DataView(mv.buffer,mv.byteOffset,mv.byteLength);
    const boxes=(s,e)=>{ const out=[]; let q=s; while(q+8<=e){ let sz=dv.getUint32(q); const t=fc(mv,q+4); let hs=8;
      if(sz===1){ sz=Number(dv.getBigUint64(q+8)); hs=16; } else if(sz===0){ sz=e-q; } out.push({t,d:q+hs,e:q+sz}); if(sz<=0)break; q+=sz; } return out; };
    const kid=(b,t)=>boxes(b.d,b.e).find(x=>x.t===t);
    let stbl=null,mdhd=null;
    for(const trak of boxes(moov.hs,moov.size).filter(b=>b.t==='trak')){
      const mdia=kid(trak,'mdia'); if(!mdia)continue; const hdlr=kid(mdia,'hdlr'); if(!hdlr||fc(mv,hdlr.d+8)!=='vide')continue;
      mdhd=kid(mdia,'mdhd'); const minf=kid(mdia,'minf'); const s=minf&&kid(minf,'stbl'); if(s){ stbl=s; break; } }
    if(!stbl||!mdhd) throw new Error('no video track');
    const timescale=(dv.getUint8(mdhd.d)===1)?dv.getUint32(mdhd.d+20):dv.getUint32(mdhd.d+12);
    const stsd=kid(stbl,'stsd'); const ent=boxes(stsd.d+8,stsd.e)[0]; const fmt=ent.t;
    const codedWidth=dv.getUint16(ent.d+24), codedHeight=dv.getUint16(ent.d+26);
    const cfg=kid({d:ent.d+78,e:ent.e},'hvcC')||kid({d:ent.d+78,e:ent.e},'avcC'); if(!cfg) throw new Error('no codec config');
    const description=mv.slice(cfg.d,cfg.e); let codec=null;
    if(fmt==='avc1'||fmt==='avc3'){ codec='avc1.'+[description[1],description[2],description[3]].map(x=>x.toString(16).padStart(2,'0')).join(''); }
    else { const lvl=dv.getUint8(cfg.d+12); for(const c of ['hvc1.2.4.L'+lvl+'.B0','hev1.2.4.L'+lvl+'.B0','hvc1.1.6.L'+lvl+'.B0']){ try{ if((await VideoDecoder.isConfigSupported({codec:c,description})).supported){ codec=c; break; } }catch(e){} } if(!codec)codec='hvc1.2.4.L'+lvl+'.B0'; }
    const stsz=kid(stbl,'stsz'), stsc=kid(stbl,'stsc'), stco=kid(stbl,'stco'), co64=kid(stbl,'co64'), stss=kid(stbl,'stss'), stts=kid(stbl,'stts'), ctts=kid(stbl,'ctts');
    const ss=dv.getUint32(stsz.d+4), sc=dv.getUint32(stsz.d+8); const sizes=new Array(sc); for(let i=0;i<sc;i++)sizes[i]=ss!==0?ss:dv.getUint32(stsz.d+12+i*4);
    const scn=dv.getUint32(stsc.d+4); const sE=[]; for(let i=0;i<scn;i++){ const o=stsc.d+8+i*12; sE.push({first:dv.getUint32(o),spc:dv.getUint32(o+4)}); }
    const chn=stco?dv.getUint32(stco.d+4):dv.getUint32(co64.d+4); const choff=new Array(chn); for(let i=0;i<chn;i++)choff[i]=stco?dv.getUint32(stco.d+8+i*4):Number(dv.getBigUint64(co64.d+8+i*8));
    const key=new Set(); if(stss){ const kn=dv.getUint32(stss.d+4); for(let i=0;i<kn;i++)key.add(dv.getUint32(stss.d+8+i*4)-1); } else for(let i=0;i<sc;i++)key.add(i);
    const dts=new Array(sc); { let ne=dv.getUint32(stts.d+4),o=stts.d+8,si=0,t=0; for(let e=0;e<ne;e++){ const cnt=dv.getUint32(o),del=dv.getUint32(o+4); o+=8; for(let k=0;k<cnt&&si<sc;k++){ dts[si++]=t; t+=del; } } while(si<sc){ dts[si]=t; si++; } }
    const cto=new Array(sc).fill(0); if(ctts){ let ne=dv.getUint32(ctts.d+4),o=ctts.d+8,si=0; for(let e=0;e<ne;e++){ const cnt=dv.getUint32(o),off=dv.getInt32(o+4); o+=8; for(let k=0;k<cnt&&si<sc;k++)cto[si++]=off; } }
    const spcFor=(ci)=>{ let spc=sE[0].spc; for(const e of sE){ if((e.first-1)<=ci)spc=e.spc; else break; } return spc; };
    const offs=new Array(sc); { let si=0; for(let ci=0;ci<chn&&si<sc;ci++){ let off=choff[ci]; const spc=spcFor(ci); for(let k=0;k<spc&&si<sc;k++){ offs[si]=off; off+=sizes[si]; si++; } } }
    const samples=new Array(sc); for(let i=0;i<sc;i++)samples[i]={offset:offs[i],size:sizes[i],key:key.has(i),pts:Math.round((dts[i]+cto[i])*1e6/timescale)};
    const durSec=((dts[sc-1]||0))/timescale; const fps=(sc>1&&durSec>0)?((sc-1)/durSec):30;
    return { path, codec, fmt, description, codedWidth, codedHeight, timescale, fps, samples,
             readSample:(i)=>rd(samples[i].offset,samples[i].size), readRange:(pos,len)=>rd(pos,len), close:()=>{ try{ DSP.closeRead(id); }catch(e){} } };
  }catch(e){ try{ await DSP.closeRead(id); }catch(_){}; throw e; }
}
/* [R108·E3] ClipDecoder — per-source decode-ahead engine that replaces the <video> element for heavy media.
   One VideoDecoder per source + a bounded ring of decoded VideoFrames kept just ahead of the local playhead.
   frameAt(t) returns the nearest cached frame synchronously for the render loop; the pump decodes ahead and
   evicts behind; seeks reset to the keyframe before the target; a run of decode errors marks it dead → the caller
   falls back to <video>. Measured: 4 concurrent on the same HEVC10 1080p60 source → 97–100% frame-hit, <1-frame
   lag, ~10 frames cached each. This is what lets us play 4 walls with NO proxy where <video> collapsed at the 4th. */
function makeClipDecoder(d){
  const N=d.samples.length;
  const order=Array.from({length:N},(_,i)=>i).sort((a,b)=>d.samples[a].pts-d.samples[b].pts);
  const dispPts=order.map(i=>d.samples[i].pts);
  const frameDur=Math.max(1,Math.round(1e6/(d.fps||30)));
  const AHEAD=18*frameDur, BEHIND=16*frameDur, CAP=72, GOP_SKIP=90; // BEHIND ~0.25s tolerates GPU-shared decode latency (NVDEC vs WebGL) so delayed frames survive eviction
  const keyBefore=(di)=>{ for(let i=di;i>=0;i--)if(d.samples[i].key)return i; return 0; };
  const decIdxForTime=(t)=>{ let lo=0,hi=N-1,res=0; while(lo<=hi){const m=(lo+hi)>>1; if(dispPts[m]<=t){res=m;lo=m+1;}else hi=m-1;} return order[res]; };
  const cache=new Map(); let dec=null, feed=0, feedBase=0, feedBasePts=0, lastFedPts=-1, closed=false, dead=false, targetUs=0, err=null, fails=0, prevT=0;
  /* bulk read-ahead: reading one sample per IPC round-trip caps decode at ~60fps (disk+IPC latency) and starves the
     ring after a seek. One ~4MB range read covers dozens of samples in decode order (mdat is decode-ordered), so the
     decoder runs at full speed (measured 196fps) and can outrun the playhead to fill the ring. */
  let bufData=null, bufStart=0, bufEnd=0; const READAHEAD=4*1024*1024;
  const inBuf=(s)=>bufData&&s.offset>=bufStart&&(s.offset+s.size)<=bufEnd;
  const ensureBuf=async(i)=>{ const s=d.samples[i]; if(inBuf(s))return true; const a=s.offset;
    const data=await d.readRange(a, Math.max(s.size, READAHEAD)); if(!data)return false; bufData=data; bufStart=a; bufEnd=a+data.length; return inBuf(s); };
  const mkDec=()=>{ dec=new VideoDecoder({output:f=>{ if(closed){f.close();return;} const o=cache.get(f.timestamp); if(o&&o!==f){try{o.close();}catch(e){}} cache.set(f.timestamp,f); fails=0; }, error:e=>{ err=String((e&&e.message)||e); }}); dec.configure({codec:d.codec,description:d.description}); };
  let resets=0;
  const resetTo=(di)=>{ resets++; if(dec){try{dec.close();}catch(e){}} for(const[,f]of cache){try{f.close();}catch(e){}} cache.clear(); mkDec(); feed=keyBefore(di); feedBase=feed; feedBasePts=d.samples[feed].pts; lastFedPts=-1; err=null; };
  const evict=()=>{ const lo=targetUs-BEHIND; for(const[ts,f]of cache){ if(ts<lo){try{f.close();}catch(e){} cache.delete(ts);} }
    if(cache.size>CAP){ const ks=[...cache.keys()].sort((a,b)=>a-b); for(const k of ks){ if(cache.size<=CAP)break; if(k<targetUs-frameDur){try{cache.get(k).close();}catch(e){} cache.delete(k);} } } };
  const delay=ms=>new Promise(r=>setTimeout(r,ms));
  /* [R108·E7] SYNCHRONOUS feed from the read-ahead buffer — no per-sample await. Called once per RENDER frame from
     driveCD (guaranteed 60fps cadence) so feeding is never starved by the event loop, plus by the async keeper so it
     keeps running while paused. Only the 4MB buffer refill is async (keeper). This is what let the ring outrun the
     playhead in-app where the setTimeout pump couldn't. */
  const step=()=>{ if(closed||dead)return;
    if(err){ if(++fails>6){ dead=true; return; } resetTo(decIdxForTime(targetUs)); }
    /* reset decision is TIME-based (NOT decode-index based) — with HEVC B-frames decode order ≠ display order, so the
       decode index for a time is non-monotonic and an index test (feedBase>tgtDec / keyBefore-feed) fired a spurious
       reset every GOP that flushed the ring. */
    const back=targetUs<prevT-frameDur;
    if(!dec){ resetTo(decIdxForTime(targetUs)); }
    else if(lastFedPts>=0 && targetUs>lastFedPts+2000000){ resetTo(decIdxForTime(targetUs)); }       // fell >2s behind, or a big forward jump → restart at the target's keyframe
    else if(back && targetUs<feedBasePts-frameDur){ let have=false; for(const ts of cache.keys()){ if(ts<=targetUs&&ts>=targetUs-2*frameDur){have=true;break;} } if(!have)resetTo(decIdxForTime(targetUs)); } // backward BEFORE our decode start → reset only if the frame isn't still cached
    prevT=targetUs;
    let n=0;
    while(feed<N && dec.decodeQueueSize<12 && (lastFedPts<0||lastFedPts<targetUs+AHEAD) && n<96){
      const s=d.samples[feed]; if(!inBuf(s))break;                                                  // buffer exhausted → the keeper refills; resume next call
      const data=bufData.subarray(s.offset-bufStart, s.offset+s.size-bufStart);
      try{ dec.decode(new EncodedVideoChunk({type:s.key?'key':'delta',timestamp:s.pts,data})); }catch(e){ err=String(e); }
      lastFedPts=s.pts; feed++; n++;
    }
    evict(); };
  (async function keeper(){ while(!closed){ try{
    if(!dead && dec && feed<N && !inBuf(d.samples[feed]) && (lastFedPts<0||lastFedPts<targetUs+AHEAD)){ await ensureBuf(feed); if(closed)break; }
    step();
  }catch(e){ err=String(e); await delay(20); } await delay(4); } })();
  return {
    width:d.codedWidth, height:d.codedHeight, fps:d.fps, codec:d.codec,
    setTarget:(t)=>{ targetUs=Math.max(0,t); },
    pump:()=>{ try{ step(); }catch(e){} },
    frameAt:(t)=>{ let best=-1; for(const ts of cache.keys()){ if(ts<=t&&ts>best)best=ts; } return best>=0?cache.get(best):null; },
    isDead:()=>dead, stats:()=>({cache:cache.size, feed, dead, err, resets}),
    close:()=>{ closed=true; if(dec){try{dec.close();}catch(e){}} for(const[,f]of cache){try{f.close();}catch(e){}} cache.clear(); try{d.close();}catch(e){} }
  };
}
/* ---- Per-CLIP video decode instances -------------------------------------------------------------
   ONE <video>+texture per MEDIA holds only ONE frame at a time, so several clips of the same source at
   different points on the timeline all showed the SAME frame (they looked permanently "synced"). Each
   DRAWN video clip now gets its own private <video> decoder + GPU texture (keyed by clip id) so copies
   play independently — in preview, playback AND export, including inside nests and across crossfades.
   Instances are lazily created for drawn clips, LRU-capped, and GC'd when their clip disappears. Nothing
   is stored on the clip object → serialize/undo/save are untouched. */
const _vinst=new Map(); let _vinstClock=0; const VINST_MAX=32;
let _exportQuality=false; // export/still bind instances to the ORIGINAL source; preview binds proxy-if-ready
const HAS_WEBCODECS=(typeof VideoDecoder!=='undefined');
function _vinstUrl(m){ return (!_exportQuality && state.view.useProxy!==false && m.proxyReady && m.proxyUrl) ? m.proxyUrl : (m.srcUrl||null); }
/* [R108·E4] use the WebCodecs ClipDecoder when this clip would otherwise decode the ORIGINAL heavy file through a
   <video> element (no usable proxy) — the exact case where the 4th <video> decoder collapses. Proxied playback keeps
   the proven <video> path; a demux/codec failure sets m._cdFail → permanent fallback to <video> for that media. */
function _useCD(m){ if(!state.view.wcDecode)return false; // [R108] engine complete + verified in isolation (4× HEVC10 @60fps, ring full), but the in-app playback loop starves the decode pumps on the main thread → OFF by default until that's moved off-thread (worker) / root-caused. Flip state.view.wcDecode=true to try it.
  if(!(IS_ELEC && HAS_WEBCODECS && !_exportQuality))return false;
  if(!m||m.kind!=='video'||!m.path||m._cdFail)return false;
  if(/\.dsp-proxy-\w+\.mp4$/i.test(m.path))return false;                                   // a proxy is light — <video> handles it
  const usingProxy=(state.view.useProxy!==false && m.proxyReady && m.proxyUrl); return !usingProxy; }
function vinstEnsure(c,m){ if(!m||m.kind!=='video')return null; const url=_vinstUrl(m); if(!url)return null;
  let vi=_vinst.get(c.id);
  if(!vi){ vi={vel:document.createElement('video'),vtex:newTex(),vsrc:null,ready:false,vf:0,last:0,loadP:null,cd:null,cdPending:false,cdReadyP:null}; vi.vel.muted=true; vi.vel.playsInline=true; vi.vel.preload='auto'; _vinst.set(c.id,vi); }
  vi.last=++_vinstClock;
  if(_useCD(m)){ // WebCodecs path: kick off the demux once; the <video> stays unbound (no second decoder competing)
    if(!vi.cd && !vi.cdPending){ vi.cdPending=true;
      vi.cdReadyP=demuxMP4(m.path).then(dd=>{ if(_vinst.get(c.id)!==vi){ try{dd.close();}catch(e){} return; } vi.cd=makeClipDecoder(dd); }).catch(e=>{ m._cdFail=true; }).finally(()=>{ vi.cdPending=false; }); } // [R108-rev M1] compare IDENTITY not has(): a recycled vi (LRU dispose + re-add mid-demux) would orphan a zombie decoder (fd + VideoFrame leak + spinning pump)
  } else {
    if(vi.cd){ try{vi.cd.close();}catch(e){} vi.cd=null; }                                  // fell back to <video> (proxy became ready / export)
    if(vi.vsrc!==url){ vi.vsrc=url; vi.ready=false; try{vi.vel.pause();}catch(e){} vi.vel.src=url;
      vi.loadP=new Promise(r=>{ const on=()=>{ vi.vel.removeEventListener('loadeddata',on); r(); }; vi.vel.addEventListener('loadeddata',on); try{vi.vel.load();}catch(e){} if(vi.vel.readyState>=2){ vi.vel.removeEventListener('loadeddata',on); r(); } }); }
  }
  vinstCap();
  return vi; }
function vinstCap(){ if(_vinst.size<=VINST_MAX)return; const arr=[..._vinst.entries()].sort((a,b)=>a[1].last-b[1].last); for(let i=0;i<arr.length&&_vinst.size>VINST_MAX;i++) vinstDispose(arr[i][0]); }
function vinstDispose(id){ const vi=_vinst.get(id); if(!vi)return; if(vi.cd){try{vi.cd.close();}catch(e){} vi.cd=null;} if(vi.vf&&vi.vel&&vi.vel.cancelVideoFrameCallback){try{vi.vel.cancelVideoFrameCallback(vi.vf);}catch(e){}} try{vi.vel.pause();}catch(e){} try{vi.vel.removeAttribute('src');vi.vel.load();}catch(e){} if(vi.ael){try{vi.ael.pause();vi.ael.removeAttribute('src');vi.ael.load();}catch(e){}} if(vi.vtex){try{gl.deleteTexture(vi.vtex);}catch(e){}} _vinst.delete(id); }
/* [R92-T2 C1] per-clip <audio> element for PREVIEW sound of video clips. Always bound to the ORIGINAL file
   (proxies carry no audio track); decodes only the audio stream, so it's cheap even on a 12GB movie.
   [R92-T6] keyed by URL: it used to cache `null` forever if srcUrl wasn't loaded yet, and kept playing the OLD
   file's sound after Replace/Locate media. preservesPitch=false matches the export (which resamples). */
function vinstAudio(vi,m){ const url=m&&m.srcUrl; if(!url||m._noAudio)return (m&&m._noAudio)?null:(vi.ael||null); // [R92-T6] a probed-silent video never gets a demuxer again
  if(vi.ael&&vi._aelUrl===url)return vi.ael;
  if(vi.ael){ try{vi.ael.pause();vi.ael.removeAttribute('src');vi.ael.load();}catch(e){} }
  const a=new Audio(); a.preload='auto'; try{a.preservesPitch=false;}catch(e){} a.src=url; vi.ael=a; vi._aelUrl=url; return a; }
/* [R92-T6] auto-probe: a video with NO audio track still costs a full 60+Mbps demux pipeline per clip — six
   silent ring members took playback from 57fps to 6fps (measured). After ~0.4s of playback with zero decoded
   audio bytes, the media is marked silent and its <audio> elements are torn down for the session. */
function aelProbeSilent(vi,m,a){ if(m._noAudio)return true; if(a.paused)return false;
  let played=0; try{ for(let i=0;i<a.played.length;i++)played+=a.played.end(i)-a.played.start(i); }catch(e){ return false; } // [R92-T7] measure REAL played media time (a.played), not a.currentTime — a clip starting mid-film has a huge currentTime on frame 1 and was falsely flagged silent, muting a clip that HAS audio
  if(played<0.5)return false;
  if(a.webkitAudioDecodedByteCount===0){ m._noAudio=true; try{a.pause();a.removeAttribute('src');a.load();}catch(e){} vi.ael=null; vi._aelUrl=null; return true; } return false; }
function disposeAllVinst(){ for(const id of [..._vinst.keys()]) vinstDispose(id); }
function reconcileVinst(){ if(!_vinst.size)return; const live=new Set(); for(const c of state.clips)live.add(c.id); for(const s of state.media)if(s.kind==='nest'&&s.nestClips)for(const c of s.nestClips)live.add(c.id); for(const id of [..._vinst.keys()])if(!live.has(id))vinstDispose(id); }
function vinstSeek(c,m,local){ const vi=vinstEnsure(c,m); if(!vi)return Promise.resolve();
  if(vi.cd||vi.cdPending){ // [R108·E5] WebCodecs scrub: point the decoder at the target and wait (briefly) for the frame
    const seekCD=()=>{ if(vi.cd&&vi.cd.isDead()){ try{vi.cd.close();}catch(e){} vi.cd=null; m._cdFail=true; } if(!vi.cd)return Promise.resolve(); const tus=Math.max(0,(local||0)*1e6); vi.cd.setTarget(tus); // [R108-rev M2] a decoder that died while paused/scrubbing must be torn down + flagged for <video> fallback (driveCD only runs while playing)
      return new Promise(res=>{ let n=0; const tick=()=>{ if(!vi.cd){res();return;} const f=vi.cd.frameAt(tus); if(f){ upTex(vi.vtex,f); vi.ready=true; res(); } else if(++n>90){ res(); } else requestAnimationFrame(tick); }; tick(); }); };
    return (vi.cd?Promise.resolve():(vi.cdReadyP||Promise.resolve())).then(seekCD); }
  return (vi.loadP||Promise.resolve()).then(()=>new Promise(res=>{ const v=vi.vel; if(!v){res();return;}
    const t=Math.max(0,Math.min((v.duration||0)-1e-3, local||0));
    if(Math.abs(v.currentTime-t)<1e-3 && v.readyState>=2){ upTex(vi.vtex,v); vi.ready=true; requestAnimationFrame(()=>res()); return; }
    const on=()=>{ v.removeEventListener('seeked',on); upTex(vi.vtex,v); vi.ready=true; res(); }; v.addEventListener('seeked',on); try{ v.currentTime=t; }catch(e){ v.removeEventListener('seeked',on); res(); } })); }
function pumpVFClip(vi){ const v=vi.vel; if(!v||!v.requestVideoFrameCallback)return; const cb=()=>{ if(!state.playing||v.paused){vi.vf=0;return;} upTex(vi.vtex,v); vi.ready=true; vi.vf=v.requestVideoFrameCallback(cb); }; vi.vf=v.requestVideoFrameCallback(cb); }
function stopVFClip(vi){ if(vi.vf&&vi.vel&&vi.vel.cancelVideoFrameCallback){try{vi.vel.cancelVideoFrameCallback(vi.vf);}catch(e){}} vi.vf=0; }
/* [R108·E4] drive this clip's ClipDecoder to `local` (seconds) and upload the nearest cached frame. Returns true when
   the ClipDecoder owns this clip's VIDEO (so the caller skips the <video> servo); audio still runs off vi.ael. A dead
   decoder is dropped and the media flagged for permanent <video> fallback. */
function driveCD(vi,c,m,local){ if(!vi)return false;
  if(vi.cd){ if(vi.cd.isDead()){ try{vi.cd.close();}catch(e){} vi.cd=null; m._cdFail=true; return false; }
    const tus=Math.max(0,(local||0)*1e6); vi.cd.setTarget(tus); vi.cd.pump(); const f=vi.cd.frameAt(tus); if(f){ upTex(vi.vtex,f); vi.ready=true; } return true; } // [R108·E7] pump() feeds synchronously in-frame → never starved by the render loop
  return !!vi.cdPending; } // pending → suppress <video>; the clip shows its poster (m.tex) until the first frame lands
/* clips (top-level + inside active nests, including crossfade pairs) whose VIDEO the compositor will draw at t.
   [R92-T2 C1] each entry carries `gain` = clip volume × fades × track mute, composed through the nest chain — the preview audio elements follow it.
   [R92-T6] and `rate` = the EFFECTIVE playback rate (clip speed × every parent nest's speed) — the media elements
   used to play at the inner clip's own speed and get seek-corrected every ~200ms inside a sped-up nest (visible judder). */
function collectDrawnVideoClips(clips,lanes,t,depth,out,pGain,pRate){ out=out||[]; if((depth||0)>6||!clips||!lanes)return out; const pg=(pGain==null)?1:pGain, pr=(pRate==null)?1:pRate;
  const sc=state.clips, sl=state.lanes; state.clips=clips; state.lanes=lanes; let drawn; try{ drawn=compositeClips(t); }finally{ state.clips=sc; state.lanes=sl; }
  for(const x of drawn){ const c=x.c, m=mediaById(c.mediaId); if(!m)continue; const lt=srcT(c,t);
    const lane=lanes[c.lane]; const g=pg*((lane&&lane.mute)?0:1)*fadeFactor(c,t)*((c.props&&c.props.volume!=null)?Math.max(0,c.props.volume/100):1); const rr=pr*(c.speed||1);
    if(m.kind==='video') out.push({c,m,local:lt,gain:g,rate:rr});
    else if(m.kind==='nest'&&m.nestClips) collectDrawnVideoClips(m.nestClips,(m.nestLanes&&m.nestLanes.length?m.nestLanes:lanes),lt,(depth||0)+1,out,g,rr); }
  return out; }
let playRaf=0,lastT=0,_phLast=null,_audioBase=0,_audioHead=0;
function play(){ if(state.playing)return; if(state.tl.selA!=null){ let _p=Math.min(state.tl.selA, state.tl.selB==null?state.tl.selA:state.tl.selB); if(state.loop&&state.workIn!=null&&state.workOut!=null)_p=Math.max(state.workIn,Math.min(state.workOut,_p)); state.playhead=_p; positionPlayhead(); } /* start from the timeline insert/selection (clamped into an active loop region); else resume where the playhead is */ diag('info','transport','play',{at:+state.playhead.toFixed(2)}); state.playing=true; stopMotionPreview(); _previewClock=0; $('#playBtn').innerHTML=ICO('pause'); lastT=performance.now();
  for(const {c,m,local,gain,rate} of collectDrawnVideoClips(state.clips,state.lanes,state.playhead,0,[])){ const vi=vinstEnsure(c,m); if(vi&&vi.vel){ const eff=Math.max(0.0625,Math.min(16,rate||c.speed||1)); (vi.loadP||Promise.resolve()).then(()=>{ try{vi.vel.currentTime=local;}catch(e){} }); vi.vel.muted=true; try{vi.vel.loop=false;}catch(e){} try{vi.vel.playbackRate=eff;}catch(e){} vi.vel.play().catch(()=>{});
    const a=vinstAudio(vi,m); if(a){ try{a.currentTime=local;}catch(e){} try{a.playbackRate=eff;}catch(e){} a.volume=Math.max(0,Math.min(1,gain==null?1:gain)); a.muted=(gain!=null&&gain<=0.001); a.play().catch(()=>{}); } } } startAudio(); ploop(); } // loop=false: the timeline (ploop) governs clip-bounded looping, not the element. [R92-T2 C1] the paired <audio> (original file) carries the video's sound. [R92-T6] eff = rate composed through the nest chain
/* ===================== [R97] J / K / L — the universal shuttle =====================
   The one standard every NLE shares (Premiere, Avid, Resolve, FCP) and the clearest "this is a real NLE" signal:
   J = back · K = stop · L = forward, and pressing again doubles the speed (1×→2×→4×→8×). Holding K with J/L = slow (¼×).
   Design: at 1× we hand over to the normal transport (audio-clocked, sound on). Any other speed runs its OWN rAF that scrubs
   — the WebAudio graph can't play at 4× or backwards, and slaving the playhead to actx.currentTime (what ploop does) makes
   variable speed impossible. Shuttling is therefore silent above 1×, which is exactly what the classic decks do anyway.
   Capped at 30 fps of seeking: at 8× a 60 fps seek storm would drown the video decoder. */
const SHUTTLE_MAX=8; let _shRaf=0,_shLast=0,_kHeld=false;
function shuttleOn(){ return !!state.shuttle; }
function startShuttle(v){ v=Math.max(-SHUTTLE_MAX,Math.min(SHUTTLE_MAX,v));
  if(v===1){ stopShuttle(); if(!state.playing)play(); return; } // 1× = the real transport (with audio)
  if(state.playing)pause(); state.shuttle=v; _shLast=performance.now(); updShuttleUI();
  if(!_shRaf)_shRaf=requestAnimationFrame(shuttleTick); }
function stopShuttle(){ state.shuttle=0; if(_shRaf){cancelAnimationFrame(_shRaf);_shRaf=0;} updShuttleUI(); }
function updShuttleUI(){ const b=$('#playBtn'); if(b&&!state.playing)b.innerHTML=ICO('play');
  const s=$('#statAuto'); if(s&&state.shuttle){ s.textContent=(state.shuttle>0?'▶▶ ':'◀◀ ')+Math.abs(state.shuttle)+'×'; s.style.color='var(--ink-2)'; } }
function shuttleTick(){ if(!state.shuttle){_shRaf=0;return;}
  const now=performance.now(); const dt=Math.min(0.06,(now-_shLast)/1000);
  if(dt<0.033){ _shRaf=requestAnimationFrame(shuttleTick); return; } // ~30 fps ceiling: seeking faster than this just starves the decoder
  _shLast=now; const dur=duration();
  let p=state.playhead+dt*state.shuttle;
  if(p<=0){ p=0; state.playhead=p; scrubRender(); positionPlayhead(); stopShuttle(); return; }
  if(p>=dur){ p=dur; state.playhead=p; scrubRender(); positionPlayhead(); stopShuttle(); return; }
  state.playhead=p; scrubRender(); positionPlayhead(); _shRaf=requestAnimationFrame(shuttleTick); }
function shuttleKey(dir){ // dir −1 = J · +1 = L
  const cur=state.shuttle||(state.playing?1:0);
  if(_kHeld){ startShuttle(0.25*dir); return; } // K+L / K+J = slow motion
  let v;
  if(cur===0)v=dir; // stopped → play at 1× in that direction
  else if(Math.sign(cur)!==dir)v=dir; // reversing direction → 1× the other way
  else v=Math.min(SHUTTLE_MAX,Math.abs(cur)*2)*dir; // same direction again → double
  startShuttle(v); }
function pause(){ state.playing=false; stopShuttle(); $('#playBtn').innerHTML=ICO('play'); if(playRaf)cancelAnimationFrame(playRaf); for(const m of state.media)if(m.kind==='video'&&m.el){try{m.el.pause();}catch(e){} stopVF(m);} for(const [,vi] of _vinst){ try{vi.vel&&vi.vel.pause();}catch(e){} try{vi.ael&&vi.ael.pause();}catch(e){} stopVFClip(vi); } stopAudio(); setMeters(0); startMotionPreview(); } // guard m.el: a missing/unrelinked video has el=null; resume live motion preview
function ploop(){ if(!state.playing)return; const now=performance.now(),dt=(now-lastT)/1000;lastT=now;
  if(_phLast!=null && Math.abs(state.playhead-_phLast)>0.06) startAudio(); // playhead was seeked externally while playing → reschedule audio to the new position
  if(audioSources.length&&actx){ state.playhead=_audioHead+(actx.currentTime-_audioBase); } else { state.playhead+=dt; } // slave visuals to the audio clock when audio is playing (no drift); else free-run on rAF
  const hasWork=state.workIn!=null&&state.workOut!=null&&state.workOut>state.workIn;
  const endT=hasWork?state.workOut:duration(), startT=hasWork?state.workIn:0;
  if(state.playhead>=endT){ if(state.loop||hasWork){state.playhead=startT;for(const m of state.media)if(m.kind==='video'&&m.el){try{m.el.currentTime=0;}catch(e){}} startAudio();} else {state.playhead=endT;pause();} }
  { const ra=raHas(state.playhead); const drawn=collectDrawnVideoClips(state.clips,state.lanes,state.playhead,0,[]); const act=new Set(); // [R92-T6] the drawn pass runs EVERY frame now: with render-ahead serving cached frames, the per-clip <audio> used to go orphan (kept playing stale volume/position)
    for(const {c,m,local,gain,rate} of drawn){ act.add(c.id); const vi=vinstEnsure(c,m); if(!vi||!vi.vel)continue; const v=vi.vel; const eff=Math.max(0.0625,Math.min(16,rate||c.speed||1)); const cdOn=driveCD(vi,c,m,local); // [R108·E4] ClipDecoder owns VIDEO when active; <video> below is skipped, audio still runs
      /* [R104] TORMENTA DE SEEKS. R92 metió el servo de velocidad pero dejó el seek duro a 0.2s de deriva.
         Con material pesado (HEVC 10-bit 1080p60) el decodificador no llega → la deriva pasa de 0.2 → seek duro
         → **el seek VACÍA la tubería del decodificador** → la deriva empeora → otro seek. Medido con
         RIto_Film_1080.mp4 duplicado: **56 seeks en 4s con 3 clips** (0 con 1 ó 2). Un seek cuesta mucho más
         que la deriva que corrige, así que la "corrección" era el problema.
         Ahora: el servo manda (±12% en vez de ±6%, ganancia 0.5 en vez de 0.35 → recupera 0.2s en ~1.7s en vez
         de 3.3s), y el seek duro queda sólo para deriva irrecuperable Y como mucho ~1 vez por segundo y clip.
         El elemento de vídeo va muted (el audio es otro elemento), así que subir el rate no altera el tono. */
      if(!ra&&!cdOn){ try{v.loop=false;}catch(e){} if(v.paused)v.play().catch(()=>{}); const vd=v.currentTime-local;
        const _nw=performance.now();
        if(Math.abs(vd)>0.6 && _nw-(vi._seekT||0)>800){ vi._seekT=_nw; try{v.currentTime=local;}catch(e){} }
        else { try{v.playbackRate=eff*(1-Math.max(-0.12,Math.min(0.12,vd*0.5)));}catch(e){} }
        if(HAS_RVFC){if(!vi.vf)pumpVFClip(vi);}else{upTex(vi.vtex,v);vi.ready=true;} }
      const a=vinstAudio(vi,m); const revMute=(c.loop&&c.loopRev); // [R92-T7] ping-pong reverse: the video plays backwards but audio can't → mute preview instead of stuttering (documented limitation)
      if(a&&!revMute&&!aelProbeSilent(vi,m,a)){ const g=Math.max(0,Math.min(1,gain==null?1:gain)); a.volume=g; a.muted=(g<=0.001); if(a.muted){ if(!a.paused){try{a.pause();}catch(e){}} } else { if(a.paused)a.play().catch(()=>{}); const ad=a.currentTime-local; if(Math.abs(ad)>0.2){try{a.currentTime=local;}catch(e){}} else {try{a.playbackRate=eff*(1-Math.max(-0.08,Math.min(0.08,ad*0.4)));}catch(e){}} } }
      else if(a&&revMute&&!a.paused){ try{a.pause();}catch(e){} } } // [R92-T2 C1 + T6] audio servo: closes the 150-240ms start drift in ~1s without audible seeking
    for(const [id,vi] of _vinst){ if(!act.has(id)){ if(!ra&&vi.vel&&!vi.vel.paused){ try{vi.vel.pause();}catch(e){} stopVFClip(vi); } if(vi.ael&&!vi.ael.paused){ try{vi.ael.pause();}catch(e){} } } } }
  positionPlayhead(); followPlayhead(); refreshInspector(); render(); meters(); _phLast=state.playhead; playRaf=requestAnimationFrame(ploop); }

/* ===================== EXPORT ===================== */
async function seekExport(t){ const drawn=collectDrawnVideoClips(state.clips,state.lanes,t,0,[]); await Promise.all(drawn.map(({c,m,local})=>vinstSeek(c,m,local))); } // per-CLIP original-source decode (via _exportQuality) so duplicated clips export at their OWN local time, not last-decode-wins
function dlBlob(b,n){const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=n;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),6000);}
/* ---- export supersampling (SSAA): render the dome at ss×res into an offscreen FBO, then box-downsample to res.
   Kills the texture-minification aliasing of the fisheye warp (clean edges + far more compressible → the requested
   bitrate buys real detail instead of shimmer). Reuses the circular-mask blit (PB) for the downsample. ---- */
let _exFBO=null,_exTex=null,_exSR=0;
function ensureExportFBO(SR){ if(_exTex&&_exSR===SR)return; freeExportFBO(); _exSR=SR;
  _exTex=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,_exTex); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,SR,SR,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  _exFBO=gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER,_exFBO); gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,_exTex,0); gl.bindFramebuffer(gl.FRAMEBUFFER,null); gl.bindTexture(gl.TEXTURE_2D,null); }
function freeExportFBO(){ if(_exTex){gl.deleteTexture(_exTex);_exTex=null;} if(_exFBO){gl.deleteFramebuffer(_exFBO);_exFBO=null;} _exSR=0; }
function exportSS(res){ const glMax=gl.getParameter(gl.MAX_TEXTURE_SIZE)||4096; return (res*2<=Math.min(glMax,8192))?2:1; }
/* render one export frame into glc at `res`, supersampled ×ss (opaque black bg for MP4). gl.finish() before read. */
function renderExportFrame(t,res,ss,wall){ const flat=isFlat(); _drawFlat=flat; _roomWrap=isRoom(); _compAspect=(state.seqW||1)/(state.seqH||1); _arTime=t; const SR=res*ss; ensureExportFBO(SR); // FBO→PB blit; dome clips to the disc, flat extracts the rect region into glc (w×h)
  gl.bindFramebuffer(gl.FRAMEBUFFER,_exFBO); composite(t,SR,true);
  gl.bindFramebuffer(gl.FRAMEBUFFER,null); gl.viewport(0,0,glc.width,glc.height); gl.disable(gl.DEPTH_TEST); gl.clearColor(0,0,0,1); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(PB); gl.bindVertexArray(quadVAO); gl.uniform2f(LB.pan,0,0); gl.uniform1f(LB.zoom,1); gl.uniform2f(LB.aspect,1,1);
  if(wall){ const A=_compAspect, s=Math.min(2/A,2), Fx=s*A/2, Fy=s/2; const sw=wall.stripW||1, sh=wall.stripH||1; // F5 per-wall: crop this wall's strip sub-rect (top-aligned) → resample into glc (pxW×pxH)
    const uSc=(wall.x1-wall.x0)/sw*Fx, uOf=(1-Fx)/2+wall.x0/sw*Fx, vSc=(wall.pxH/sh)*Fy, vOf=(1+Fy)/2-(wall.pxH/sh)*Fy;
    gl.uniform1f(LB.flat,1); gl.uniform2f(LB.uvsc,uSc,vSc); gl.uniform2f(LB.uvof,uOf,vOf); gl.uniform1f(LB.hfade,0); }
  else if(flat){ const A=_compAspect, s=Math.min(2/A,2), Fx=s*A/2, Fy=s/2; gl.uniform1f(LB.flat,1); gl.uniform2f(LB.uvsc,Fx,Fy); gl.uniform2f(LB.uvof,(1-Fx)/2,(1-Fy)/2); gl.uniform1f(LB.hfade,0); }
  else { gl.uniform1f(LB.flat,0); gl.uniform2f(LB.uvsc,1,1); gl.uniform2f(LB.uvof,0,0); gl.uniform1f(LB.hfade, state.view.hfade?HFADE:0); }
  const _exOut=masterGradeOn()?applyMasterGrade(_exTex,SR):_exTex; // [master grade] bake the sequence master grade into the exported frame → export matches preview (WYSIWYG)
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,_exOut); gl.uniform1i(LB.tex,0); gl.drawArrays(gl.TRIANGLES,0,6); gl.bindVertexArray(null);
  gl.finish();
}
let cancelExport=false;
/* suggested H.264 bitrate (Mbps) for a generous ~0.18 bits/pixel — keeps fulldome masters crisp instead of starved */
function suggestBitrate(res,fps,w,h){ const px=(w&&h)?w*h:res*res; return Math.max(8,Math.min(800,Math.round(px*fps*0.18/1e6))); } // flat passes w,h (rect); dome passes res (square)
async function pickAvcCodec(w,h,bitrate,fps){
  // try profiles high/main/baseline × levels 6.2→4.0 and return the first the encoder accepts at this size
  const profiles=['6400','4d00','4200']; const levels=['3e','3d','3c','34','33','32','2a','28'];
  for(const p of profiles) for(const l of levels){ const codec='avc1.'+p+l;
    try{ const s=await VideoEncoder.isConfigSupported({codec,width:w,height:h,bitrate,framerate:fps}); if(s&&s.supported)return codec; }catch(e){} }
  return null;
}
async function pickHevcCodec(w,h,bitrate,fps){ if(typeof VideoEncoder==='undefined')return null;
  // H.265 (Main profile) — NVENC handles up to 8192²; probe hvc1/hev1 × levels 6.2→3.1 and return the first accepted
  const pre=['hvc1.1.6.','hev1.1.6.']; const levels=['L186','L183','L180','L156','L153','L150','L123','L120','L93'];
  for(const p of pre) for(const l of levels){ const codec=p+l+'.B0';
    try{ const s=await VideoEncoder.isConfigSupported({codec,width:w,height:h,bitrate,framerate:fps}); if(s&&s.supported)return codec; }catch(e){} }
  return null;
}
/* ---- audio bake for export ---- */
function audioBufferToWav(buf){ const ch=buf.numberOfChannels, sr=buf.sampleRate, n=buf.length; const bytes=44+n*ch*2; const dv=new DataView(new ArrayBuffer(bytes)); let p=0;
  const w8=s=>{for(let i=0;i<s.length;i++)dv.setUint8(p++,s.charCodeAt(i));}, w16=v=>{dv.setUint16(p,v,true);p+=2;}, w32=v=>{dv.setUint32(p,v,true);p+=4;};
  w8('RIFF');w32(bytes-8);w8('WAVE');w8('fmt ');w32(16);w16(1);w16(ch);w32(sr);w32(sr*ch*2);w16(ch*2);w16(16);w8('data');w32(n*ch*2);
  const chans=[]; for(let c=0;c<ch;c++)chans.push(buf.getChannelData(c));
  for(let i=0;i<n;i++)for(let c=0;c<ch;c++){ let s=Math.max(-1,Math.min(1,chans[c][i]||0)); dv.setInt16(p, s<0?s*0x8000:s*0x7FFF, true); p+=2; }
  return new Uint8Array(dv.buffer); }
async function exportAudioMix(t0,endT){ if(typeof OfflineAudioContext==='undefined')return null;
  const dur=Math.max(0.05,endT-t0);
  const evs=collectAudioEvents(state.clips,state.lanes,0,t0,endT,0,[]); // descends into nests; already front-trimmed + window-clipped
  if(!evs.length)return null;
  const sr=48000,ch=2,octx=new OfflineAudioContext(ch,Math.max(1,Math.ceil(dur*sr)),sr);
  for(const ev of evs){ const src=octx.createBufferSource(); src.buffer=ev.buffer; const gain=octx.createGain(); src.connect(gain); gain.connect(octx.destination);
    const rate=ev.rate||1; try{ src.playbackRate.value=rate; }catch(_){} // per-clip speed in the export mix too
    const when=Math.max(0,ev.start-t0), off=Math.max(0,ev.off), len=Math.min(ev.dur*rate,(ev.buffer.duration-off)); if(len<=0)continue;
    const fi=ev.fadeIn||0, fo=Math.min(ev.fadeOut||0,ev.dur), vol=Math.max(0.0001,(ev.vol!=null?ev.vol:1)); // per-clip volume baked into the export mix
    const span=(ev.loopLen>0)?ev.dur:Math.min(ev.dur,len/rate); // [R92-T6] span is WALL-CLOCK output seconds — `len` is SOURCE seconds, so with speed≠1 the fade-out used to land at the wrong output time (diverging from the preview)
    if(fi>0){ gain.gain.setValueAtTime(0.0001,when); gain.gain.exponentialRampToValueAtTime(vol,when+Math.min(span,fi)); } else gain.gain.setValueAtTime(vol,when); // [R92-T2 F13] exponential like startAudio — a long fade used to sound different in the exported MP4 than in the monitor
    if(fo>0){ gain.gain.setValueAtTime(vol,Math.max(when,when+span-fo)); gain.gain.exponentialRampToValueAtTime(0.0001,when+span); }
    if(ev.loopLen>0){ src.loop=true; src.loopStart=ev.loopS; src.loopEnd=Math.min(ev.buffer.duration,ev.loopS+ev.loopLen); const w=ev.loopS+(((off-ev.loopS)%ev.loopLen)+ev.loopLen)%ev.loopLen; try{ src.start(when,Math.min(w,ev.buffer.duration)); src.stop(when+ev.dur); }catch(e){} } // R81 looping audio in the export mix
    else { try{ src.start(when,off,len); }catch(e){} } }
  try{ return await octx.startRendering(); }catch(e){ console.warn('audio mix',e); return null; } }
async function muxAudioAAC(mux,buf){ if(typeof AudioEncoder==='undefined')return false; const sr=buf.sampleRate,ch=buf.numberOfChannels,n=buf.length; let err=null,sup;
  try{ sup=await AudioEncoder.isConfigSupported({codec:'mp4a.40.2',sampleRate:sr,numberOfChannels:ch,bitrate:192000}); }catch(e){ return false; }
  if(!sup||!sup.supported)return false;
  const enc=new AudioEncoder({output:(c,m)=>mux.addAudioChunk(c,m),error:e=>{err=e;}}); enc.configure({codec:'mp4a.40.2',sampleRate:sr,numberOfChannels:ch,bitrate:192000});
  const chans=[]; for(let c=0;c<ch;c++)chans.push(buf.getChannelData(c)); const B=1024;
  for(let i=0;i<n&&!err;i+=B){ const len=Math.min(B,n-i); const data=new Float32Array(len*ch); for(let c=0;c<ch;c++)data.set(chans[c].subarray(i,i+len),c*len);
    const ad=new AudioData({format:'f32-planar',sampleRate:sr,numberOfFrames:len,numberOfChannels:ch,timestamp:Math.round(i/sr*1e6),data}); enc.encode(ad); ad.close();
    if(enc.encodeQueueSize>16)await new Promise(r=>setTimeout(r,0)); }
  try{ await enc.flush(); }catch(e){ err=err||e; } try{ enc.close(); }catch(e){} return !err; }
async function runExport(opt){ if(state.playing)pause(); cancelExport=false;
  let _rsSeq=null; if(opt.seqId && isSeqMedia(mediaById(opt.seqId)) && opt.seqId!==state.activeSeqId){ _rsSeq=state.activeSeqId; switchSeq(opt.seqId); } // F5: export another sequence (e.g. the room floor) in its own job, then restore
  const res=opt.res, fps=opt.fps; diag('info','export','start',{codec:opt.codec,res,fps,bitrate:opt.bitrate, seq:activeSeq()&&activeSeq().name});
  // [R94d] range chosen in the export dialog: 'inout' = the I/O marks · 'clips' = the clip extent (default). Legacy jobs with no range keep the old behaviour (I/O if set).
  const hasWork=state.workIn!=null&&state.workOut!=null&&state.workOut>state.workIn;
  const useIO=(opt.range==='inout')||(opt.range==null&&hasWork);
  const _ce=clipExtent(); let t0=useIO?state.workIn:_ce[0], endT=useIO?state.workOut:_ce[1]; if(opt.rangeT){ t0=Math.max(0,opt.rangeT[0]); endT=Math.max(t0+0.02,opt.rangeT[1]); } let dur=Math.max(0.05,endT-t0), total=Math.max(1,Math.round(dur*fps));
  const _ripSaved=opt.isolateClips?state.clips:null; if(opt.isolateClips)state.clips=opt.isolateClips; // [R115] render-in-place: composite ONLY these clips → excludes external adjustment layers (nest-internal ones stay, composited inside the nest)
  const flat=isFlat(); const wall=opt.wall||null; const stripW=state.seqW||1920, stripH=state.seqH||1080; // F5 per-wall: composite the full strip at native res, then crop this wall to its own pxW×pxH file
  const eW=wall?wall.pxW:(flat?(state.seqW||1920):res), eH=wall?wall.pxH:(flat?(state.seqH||1080):res), qRes=wall?Math.max(stripW,stripH):(flat?Math.max(eW,eH):res), dimStr=wall?(wall.pxW+'x'+wall.pxH):(flat?(eW+'x'+eH):(res+'')); // flat exports at the sequence's W×H (rect); dome stays square
  const filePre=wall?('wall_'+String(wall.role||'').toLowerCase()):(flat?'2d':'dome');
  const job=opt.job; const oW=glc.width,oH=glc.height; if(state.playing)pause(); // never export over a live transport — the playback rAF loop and the export seeker would fight over the media elements
  exporting=true; _exportQuality=true; try{ if($('#renderMask'))$('#renderMask').classList.add('on'); }catch(_){} // [R2] mask the viewport while glc is resized to export dims (else it shows a stretched stale frame)
  _drawFlat=flat; _roomWrap=isRoom(); _compAspect=(state.seqW||1)/(state.seqH||1); glc.width=eW;glc.height=eH; try{fxResetHistory();}catch(e){} // fresh feedback buffers → export is byte-deterministic regardless of prior scrub state
  // render nests/compositions at the export resolution (×SSAA, capped to the GPU limit) so dome-fills/ring grids aren't capped at 2048 then upscaled
  { const glMaxTex=gl.getParameter(gl.MAX_TEXTURE_SIZE)||8192; nestSize=Math.min(qRes*exportSS(qRes), glMaxTex, 8192); }
  let expOut=null; // R82: the written file/folder → offer to reveal it after a successful export
  try{
    if(opt.codec!=='still'){ // [R92-T2 C1] decode the audio track of exported VIDEO clips into m._exAudio so it lands in the mix (Chromium's decodeAudioData demuxes MP4/MOV audio). ≤1.5GB source cap: decodeAudioData needs the whole file as one ArrayBuffer.
      const vmap=new Map(); (function walk(cs,d){ if(d>6||!cs)return; for(const c of cs){ if(c.disabled)continue; const m=mediaById(c.mediaId); if(!m)continue; if(m.kind==='video'&&m.path&&!vmap.has(m.id))vmap.set(m.id,m); else if(isSeqMedia(m))walk(m.nestClips,d+1); } })(state.clips,0);
      const skipped=[];
      for(const m of vmap.values()){ if(cancelExport)break; if(m._exAudio)continue; try{ const st=await DSP.stat(m.path); if(!st||!st.size)continue;
          if(st.size>15e8){ skipped.push(m.name); continue; }
          if(job&&job.label)job.label(T('Decoding video audio…','Decodificando audio de vídeos…'));
          const ab=await (await fetch(DSP.toFileURL(m.path))).arrayBuffer(); m._exAudio=await new Promise((res,rej)=>ACTX().decodeAudioData(ab,res,rej)); }
        catch(e){} } // no audio track / unsupported → the clip simply stays silent, like before
      if(skipped.length) flashStatus(T('Video audio skipped (file >1.5GB): ','Audio de vídeo omitido (archivo >1,5GB): ')+skipped.join(', '),'err'); } // [R94-UT3·U-21]
    const audioBuf = (opt.codec==='still') ? null : await exportAudioMix(t0,endT); // a still has no audio
    if(opt.codec==='still'){ // single high-quality PNG of the current frame, rendered from ORIGINAL media (seekExport→seekMedia useOrig=true), with SSAA
      const t=state.playhead; await seekExport(t); prepNests(state.clips,t,0); renderExportFrame(t,qRes,exportSS(qRes),wall);
      const blob=await new Promise(r=>glc.toBlob(r,'image/png'));
      if(!cancelExport && blob){ const fn=`${filePre}_still_${dimStr}_${TC(t).replace(/:/g,'-')}.png`;
        if(IS_ELEC && DSP.saveFile){ const p=await DSP.saveFile(fn,'png','PNG image'); if(p){ job.label(T('Saving…','Guardando…')); const ok=await DSP.writeBinary(p, new Uint8Array(await blob.arrayBuffer())); if(ok===false)throw new Error(T('Write failed (disk full, locked, or no permission).','Fallo de escritura (disco lleno, bloqueado o sin permiso).')); expOut=p; } }
        else dlBlob(blob,fn); }
      job.prog(1,1);
    } else if(opt.codec==='png'){ const pad=Math.max(6,String(total).length), fnum=i=>String(i+1).padStart(pad,'0'); // [R96] IMERSA/AFDI Dome Master Spec: 6-digit frame number STARTING AT 1 ("Name_000001.png"). We shipped base-0 with a padding that shrank with the take length ("dome_000.png") — a planetarium can't ingest that without renaming every frame, and two exports of different lengths sorted inconsistently.
      const renderFrame=async i=>{ const t=t0+i/fps; await seekExport(t); prepNests(state.clips,t,0); if(flat){ renderExportFrame(t,qRes,1,wall); } else { composite(t,res,false); gl.finish(); } return await new Promise(r=>glc.toBlob(r,'image/png')); };
      if(IS_ELEC && DSP.chooseExportDir){ // stream to disk, no RAM buildup (handles 75-min 4K+)
        const dir=await DSP.chooseExportDir();
        if(!dir){ cancelExport=true; }
        else { const sub=dir+'/'+filePre+'_'+dimStr+'_'+fps+'fps'; if(!(await DSP.ensureDir(sub)))throw new Error(T('Cannot create export folder (not writable).','No se pudo crear la carpeta de exportación (sin permiso).'));
          for(let i=0;i<total;i++){ if(cancelExport)break; const blob=await renderFrame(i); if(!(await DSP.writeBinary(sub+'/'+filePre+'_'+fnum(i)+'.png', new Uint8Array(await blob.arrayBuffer()))))throw new Error(T('Write failed (disk full or folder not writable).','Fallo de escritura (disco lleno o carpeta sin permiso).')); job.prog(i+1,total); }
          if(!cancelExport && audioBuf){ job.label(T('Writing audio…','Escribiendo audio…')); await DSP.writeBinary(sub+'/audio.wav', audioBufferToWav(audioBuf)); }
          if(!cancelExport){ expOut=sub; flashStatus(T('PNG sequence + audio written to folder','Secuencia PNG + audio escritos en carpeta')); } }
      } else { const zip=new Zip();
        for(let i=0;i<total;i++){ if(cancelExport)break; const blob=await renderFrame(i); zip.add(filePre+'_'+fnum(i)+'.png',new Uint8Array(await blob.arrayBuffer())); job.prog(i+1,total); await new Promise(r=>setTimeout(r,0)); }
        if(!cancelExport){ if(audioBuf)zip.add('audio.wav',audioBufferToWav(audioBuf)); job.label(T('Packaging…','Empaquetando…'));await new Promise(r=>setTimeout(r,30));dlBlob(zip.finish(),`${filePre}_${dimStr}_${fps}fps.zip`); } }
    } else if(opt.codec==='hap'||opt.codec==='hapq'){ // R100: Hap1 / HapY .mov — GPU DXT + Snappy + our own QuickTime muxer, no FFmpeg
      const F=HAP_FMT[opt.codec];
      if(!(IS_ELEC && DSP.fileOpen && DSP.saveFile)) throw new Error(T('HAP export needs the desktop app.','El export HAP necesita la app de escritorio.'));
      const fn=`${filePre}_${dimStr}_${fps}fps_${F.label}.mov`;
      const path=await DSP.saveFile(fn,'mov','QuickTime movie');
      if(!path) cancelExport=true;
      else {
        const fid=await DSP.fileOpen(path);
        if(fid==null) throw new Error(T('Cannot write there (locked or no permission).','No se puede escribir ahí (bloqueado o sin permiso).'));
        let pos=0, wq=Promise.resolve(), wErr=null, pending=0;
        const put=u8=>{ const at=pos; pos+=u8.length; // a VIEW would structured-clone its whole backing buffer over IPC → copy those
          const buf=(u8.byteOffset===0&&u8.byteLength===u8.buffer.byteLength)?u8:u8.slice(); pending++;
          wq=wq.then(()=>DSP.fileWriteAt(fid,at,buf)).then(ok=>{ pending--; if(ok===false)wErr=wErr||new Error('disk write failed'); },e=>{ pending--; wErr=wErr||e; }); return at; };
        put(movFtyp());
        const mdatStart=pos; put(_bytes(16,(dv,b)=>{ dv.setUint32(0,1); b.set(_fcc('mdat'),4); })); // size=1 → 64-bit largesize, patched once we know it
        const chunks=(opt.chunks==='auto'||opt.chunks==null)?hapAutoChunks():(+opt.chunks||1);
        const ssE=exportSS(qRes);
        const pcm=audioBuf?audioPCM16(audioBuf):null, aSR=audioBuf?audioBuf.sampleRate:0, aCH=audioBuf?audioBuf.numberOfChannels:0, aN=audioBuf?audioBuf.length:0;
        const frames=[], aChunks=[];
        for(let i=0;i<total;i++){ if(cancelExport||wErr)break;
          const t=t0+i/fps; await seekExport(t); prepNests(state.clips,t,0); renderExportFrame(t,qRes,ssE,wall);
          const frame=hapFrame(dxtEncodeCanvas(F.tex,eW,eH),opt.codec,chunks);
          frames.push({off:put(frame),size:frame.length});
          if(pcm){ const s0=Math.floor(i*aSR/fps), s1=Math.min(aN,Math.floor((i+1)*aSR/fps)); // interleave the audio a frame at a time
            if(s1>s0) aChunks.push({off:put(pcm.slice(s0*aCH*2,s1*aCH*2)),samples:s1-s0}); }
          job.prog(i+1,total);
          while(pending>3&&!wErr) await new Promise(r=>setTimeout(r,0)); }
        try{ await wq; }catch(e){ wErr=wErr||e; }
        if(!wErr&&!cancelExport){ job.label(T('Writing index…','Escribiendo el índice…'));
          const mdatSize=pos-mdatStart;
          await DSP.fileWriteAt(fid,mdatStart+8,_bytes(8,(dv)=>{ dv.setUint32(0,Math.floor(mdatSize/4294967296)); dv.setUint32(4,mdatSize>>>0); }));
          put(movBuild({fourcc:F.fourcc,w:eW,h:eH,depth:F.depth,fps,frames,audio:(pcm&&aChunks.length)?{sr:aSR,ch:aCH,chunks:aChunks}:null}));
          try{ await wq; }catch(e){ wErr=wErr||e; } }
        try{ await DSP.fileClose(fid); }catch(e){}
        if(wErr) throw new Error(T('Write failed during HAP export (disk full or no permission).','Fallo de escritura durante el export HAP (disco lleno o sin permiso).'));
        if(!cancelExport){ expOut=path; job.label(T('Saved','Guardado')); } }
    } else {
      const isHevc=opt.codec==='hevc';
      const codec=isHevc?await pickHevcCodec(eW,eH,opt.bitrate,fps):await pickAvcCodec(eW,eH,opt.bitrate,fps);
      if(!codec) throw new Error(isHevc?T('H.265/HEVC is not available at '+res+'² on this GPU. Try H.264 at ≤4096², or PNG sequence (.zip).','H.265/HEVC no está disponible a '+res+'² en esta GPU. Prueba H.264 a ≤4096², o Secuencia PNG (.zip).'):T('This resolution exceeds H.264 limits. Use H.265/HEVC or PNG sequence (.zip) for '+res+'², or pick 4096² or lower for H.264.','Esta resolución supera el límite de H.264. Usa H.265/HEVC o Secuencia PNG (.zip) para '+res+'², o elige 4096² o menos para H.264.'));
      const fn=`${filePre}_${dimStr}_${fps}fps.mp4`;
      // STREAMING-TO-DISK path (Electron): muxer output is written straight to the file via random-access fd writes → no multi-GB RAM buffer. (StreamTarget+writeAt reconstructs a byte-identical MP4 — verified in Node against ArrayBufferTarget.)
      const canStream=IS_ELEC && !!DSP.fileOpen && !!DSP.saveFile;
      let streamPath=null,fileId=null,wq=Promise.resolve(),wErr=null,pending=0;
      if(canStream){ streamPath=opt.outPath||await DSP.saveFile(fn,'mp4','MP4 video'); if(!streamPath){ if(_ripSaved)state.clips=_ripSaved; try{ if($('#renderMask'))$('#renderMask').classList.remove('on'); }catch(_){} glc.width=oW;glc.height=oH; freeExportFBO(); nestSize=COMP; freeNestPool(); exporting=false; _exportQuality=false; disposeAllVinst(); for(const m of state.media)if(m._exAudio)delete m._exAudio; if(_rsSeq)switchSeq(_rsSeq); resize(); try{scrubRender();}catch(_){} job.done(true); return; } fileId=await DSP.fileOpen(streamPath); } // FULL cleanup on this early return — it used to leak _exportQuality=true (viewer stuck binding heavy originals: "the editor went crazy after export")
      const streaming=canStream && fileId!=null;
      const muxCfg={video:{codec:isHevc?'hevc':'avc',width:eW,height:eH}};
      if(streaming){ muxCfg.fastStart=false; muxCfg.target=new Mp4Muxer.StreamTarget({chunked:true,onData:(data,position)=>{ const buf=data.slice(); pending++; wq=wq.then(()=>DSP.fileWriteAt(fileId,position,buf)).then(ok=>{pending--; if(ok===false)wErr=wErr||new Error('disk write failed');},e=>{pending--;wErr=wErr||e;}); }}); }
      else { muxCfg.fastStart='in-memory'; muxCfg.target=new Mp4Muxer.ArrayBufferTarget(); }
      let wantAudio=false; if(audioBuf && typeof AudioEncoder!=='undefined'){ try{ const sup=await AudioEncoder.isConfigSupported({codec:'mp4a.40.2',sampleRate:audioBuf.sampleRate,numberOfChannels:audioBuf.numberOfChannels,bitrate:192000}); wantAudio=!!(sup&&sup.supported); }catch(e){ wantAudio=false; } } // only declare the AAC track if it will actually encode (else valid silent MP4)
      if(wantAudio) muxCfg.audio={codec:'aac',numberOfChannels:audioBuf.numberOfChannels,sampleRate:audioBuf.sampleRate};
      const mux=new Mp4Muxer.Muxer(muxCfg);
      let encErr=null; const enc=new VideoEncoder({output:(c,m)=>mux.addVideoChunk(c,m),error:e=>{encErr=e;console.error('VideoEncoder:',e);}});
      enc.configure({codec,width:eW,height:eH,bitrate:opt.bitrate,framerate:fps,bitrateMode:'variable',latencyMode:'quality'});
      const us=1e6/fps,gop=Math.max(1,Math.round(fps)); const ssE=exportSS(qRes); // supersampling factor (2× when the GPU allows)
      for(let i=0;i<total;i++){ if(cancelExport||encErr||wErr)break; const t=t0+i/fps; await seekExport(t); prepNests(state.clips,t,0); renderExportFrame(t,qRes,ssE,wall);
        if(enc.state!=='configured'){encErr=encErr||new Error('codec closed');break;}
        const vf=new VideoFrame(glc,{timestamp:Math.round(i*us),duration:Math.round(us)});
        try{ enc.encode(vf,{keyFrame:i%gop===0}); }catch(e){ encErr=e; vf.close(); break; }
        vf.close(); job.prog(i+1,total); while((enc.encodeQueueSize>6||pending>4)&&!encErr&&!wErr)await new Promise(r=>setTimeout(r,0)); } // backpressure: also cap pending disk writes so RAM stays bounded
      try{ if(enc.state==='configured')await enc.flush(); }catch(e){ encErr=encErr||e; }
      try{ enc.close(); }catch(e){}
      if(wantAudio && !cancelExport && !encErr){ job.label(T('Encoding audio…','Codificando audio…')); try{ await muxAudioAAC(mux,audioBuf); }catch(e){ console.warn('audio mux',e); } }
      if(!encErr && !cancelExport) mux.finalize();
      if(streaming){ try{ await wq; }catch(e){} try{ await DSP.fileClose(fileId); }catch(e){} }
      if(encErr) throw new Error(T('H.264 encoding failed at '+res+'² (','La codificación H.264 falló a '+res+'² (')+(encErr.message||encErr)+T('). Try a lower resolution or PNG sequence.','). Prueba una resolución menor o Secuencia PNG.'));
      if(wErr) throw new Error(T('Write failed during MP4 export (disk full or no permission).','Fallo de escritura durante el export MP4 (disco lleno o sin permiso).'));
      if(!cancelExport){
        if(streaming){ job.label(T('Saved','Guardado')); expOut=streamPath; } // already written to disk chunk-by-chunk
        else if(IS_ELEC && DSP.saveFile){ const p=streamPath||opt.outPath||await DSP.saveFile(fn,'mp4','MP4 video'); // native Save dialog → IPC write (not a silent Downloads drop)
          if(p){ job.label(T('Saving…','Guardando…')); const ok=await DSP.writeBinary(p, new Uint8Array(mux.target.buffer)); if(ok===false)throw new Error(T('Write failed (disk full, locked, or no permission).','Fallo de escritura (disco lleno, bloqueado o sin permiso).')); expOut=p; } }
        else dlBlob(new Blob([mux.target.buffer],{type:'video/mp4'}),fn); }
    }
  }catch(err){console.error(err);appAlert(T('Error export: ','Error de exportación: ')+err.message);}
  diag('info','export',cancelExport?'cancelled':'done',{codec:opt.codec,res}); diagFlush();
  if(_ripSaved)state.clips=_ripSaved; // [R115] restore the full clip list after an isolated render-in-place
  glc.width=oW;glc.height=oH; try{ if($('#renderMask'))$('#renderMask').classList.remove('on'); }catch(_){} freeExportFBO(); dxtFree(); nestSize=COMP; freeNestPool(); exporting=false; _exportQuality=false; disposeAllVinst(); for(const m of state.media)if(m._exAudio)delete m._exAudio; if(_rsSeq)switchSeq(_rsSeq); resize(); try{scrubRender();}catch(_){} job.done(cancelExport); // _exAudio freed: decoded video audio is export-only (1h ≈ 1.4GB PCM)
  if(!cancelExport && expOut && !opt.silent && IS_ELEC && DSP.revealPath){ appConfirm(T('Export complete. Open the folder?','Exportación completa. ¿Abrir la carpeta?'),ok=>{ if(ok)try{DSP.revealPath(expOut);}catch(e){} },{ok:T('Open folder','Abrir carpeta'),cancel:T('Close','Cerrar')}); } // R82: offer to reveal the exported file/folder
}
/* ===================== R115 · RENDER IN PLACE ===================== */
/* Bake a clip/nest (its own fx + automation, at the layout size) to a light MP4 in <project>/rendered clips/ and
   replace that timeline instance with it. External adjustment layers are NOT included (isolated render); a nest's
   own sequence stays in Media — only its timeline instance is swapped. */
function addVideoFromPath(path,name){ return new Promise(resolve=>{ if(!(IS_ELEC&&DSP.toFileURL)){ resolve(null); return; }
  const url=DSP.toFileURL(path); const v=document.createElement('video'); v.src=url; v.muted=true; v.playsInline=true; v.preload='auto';
  let done=false; const fail=()=>{ if(!done){ done=true; resolve(null); } };
  v.addEventListener('error',fail,{once:true}); setTimeout(fail,20000);
  v.addEventListener('loadedmetadata',async()=>{ if(done)return; done=true;
    let fsize=0; try{ const st=await DSP.stat(path); fsize=(st&&st.size)||0; }catch(e){}
    const m={id:uid(),name:name||path.split(/[\\/]/).pop(),kind:'video',el:v,originalEl:v,srcUrl:url,tex:newTex(),w:v.videoWidth,h:v.videoHeight,dur:v.duration,fps:30,thumb:null,color:clipColorFor('video'),proxyReady:false,proxyPct:0,path:path,fsize,folder:null};
    state.media.push(m); adopt(m); renderMedia(); markDirty();
    detectFps(v,m,()=>{ seekMedia(m,0,true).then(()=>{makeThumb(m);render();}); });
    resolve(m); },{once:true}); }); }
function ripFormatDialog(m,c,layoutStr,flat){ return new Promise(resolve=>{ const ov=document.createElement('div'); ov.className='overlay'; ov.style.zIndex='320';
  ov.innerHTML=`<div class="modal" style="width:410px;"><div class="mh"><span style="color:var(--ink-2);display:flex;">${ICO('layers',16)}</span><span class="t">${T('Render in place','Renderizar en el sitio')}</span></div><div class="mb">
    <div class="frow"><label>${T('Clip','Clip')}</label><span class="tnum" style="color:var(--ink-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${(m.name||'').slice(0,34)}${isSeqMedia(m)?' · '+T('composition','composición'):''}</span></div>
    <div class="frow"><label>${T('Duration','Duración')}</label><span class="tnum" style="color:var(--ink-2);">${c.dur.toFixed(2)} s · ${layoutStr}</span></div>
    <div class="frow"><label>${T('Format','Formato')}</label><select id="ripFmt" style="flex:1;"><option value="hevc" ${!flat?'selected':''}>HEVC · H.265</option><option value="h264" ${flat?'selected':''}>H.264</option></select><span class="tnum" style="color:var(--ink-dim);">.mp4</span></div>
    <div style="font-size:11px;color:var(--ink-dim);margin-top:2px;line-height:1.5;">${T('Bakes this clip’s effects & automation into a light file in the project’s “rendered clips” folder and replaces it here. External adjustment layers are not included; the source stays in Media.','Hornea los efectos y la automatización de este clip en un archivo liviano en la carpeta “rendered clips” del proyecto y lo reemplaza aquí. Las capas de ajuste externas no se incluyen; la fuente queda en Media.')}</div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;"><button class="mbtn" id="ripCancel">${T('Cancel','Cancelar')}</button><button class="mbtn pri" id="ripGo">${ICO('layers')} ${T('Render','Renderizar')}</button></div></div></div>`;
  document.body.appendChild(ov); const close=r=>{ ov.remove(); resolve(r); };
  ov.querySelector('#ripCancel').onclick=()=>close(null); ov.addEventListener('pointerdown',e=>{if(e.target===ov)close(null);});
  ov.querySelector('#ripGo').onclick=()=>close({format:ov.querySelector('#ripFmt').value}); }); }
async function renderInPlace(clip){
  if(!IS_ELEC){ appAlert(T('Render in place needs the desktop app.','Renderizar en el sitio necesita la app de escritorio.')); return; }
  const c=clip||selClip(); if(!c)return; const m=mediaById(c.mediaId); if(!m||m.kind==='audio'){ flashStatus(T('Pick a video or composition clip','Elige un clip de vídeo o composición'),'err'); return; }
  if(!currentPath){ appAlert(T('Save the project first — the rendered clip goes beside it in a “rendered clips” folder.','Guarda el proyecto primero — el clip renderizado va junto a él en una carpeta “rendered clips”.')); return; }
  const as=activeSeq(); const flat=isFlat(); const layoutStr=flat?((as.w||1920)+'×'+(as.h||1080)):((as.w||4096)+'²');
  const choice=await ripFormatDialog(m,c,layoutStr,flat); if(!choice)return;
  const fps=as.fps||state.fps||60, res=flat?(as.w||1920):(as.w||4096);
  const codec=(choice.format==='h264')?'h264':'hevc'; // render-in-place is H.264 / H.265 only (no PNG-seq / HAP)
  const eW=flat?(as.w||1920):res, eH=flat?(as.h||1080):res, br=suggestBitrate(res,fps,flat?eW:0,flat?eH:0)*1e6;
  const i=Math.max(currentPath.lastIndexOf('\\'),currentPath.lastIndexOf('/')), projDir=currentPath.slice(0,i), dir=projDir+'\\rendered clips';
  try{ if(DSP.ensureDir)await DSP.ensureDir(dir); }catch(e){ appAlert(T('Could not create the “rendered clips” folder.','No se pudo crear la carpeta “rendered clips”.')); return; }
  const safe=(m.name||'clip').replace(/[\\/:*?"<>|]/g,'_').slice(0,60);
  const outPath=dir+'\\'+safe+' ['+layoutStr.replace('×','x')+' '+codec+'] '+uid().slice(0,5)+'.mp4';
  let cancelled=false; const job={ prog:(n,t)=>{ if(n===1||n>=t||n%8===0)flashStatus(T('Rendering in place… ','Renderizando en el sitio… ')+Math.round(n/t*100)+'%'); }, label:()=>{}, done:cx=>{ cancelled=!!cx; } };
  flashStatus(T('Rendering in place…','Renderizando en el sitio…'));
  try{ await runExport({codec,res,fps,bitrate:br,range:'clips',rangeT:[c.start,c.start+c.dur],isolateClips:[c],outPath,silent:true,job}); }
  catch(e){ flashStatus(T('Render in place failed','Falló el render en el sitio'),'err'); return; }
  let ok=false; try{ const st=await DSP.stat(outPath); ok=!!(st&&st.size>0); }catch(e){}
  if(cancelled||!ok){ flashStatus(T('Render in place cancelled','Render en el sitio cancelado'),'err'); return; }
  const nm=await addVideoFromPath(outPath,safe); if(!nm){ flashStatus(T('Could not import the rendered file','No se pudo importar el archivo renderizado'),'err'); return; }
  pushUndo();
  const lane=c.lane, start=c.start, dur=c.dur; const nc=makeClip(nm,lane,start); nc.start=start; nc.dur=dur; nc.inP=0;
  if(!flat)nc.props.fulldome=true; // dome master fills the dome 1:1 (no re-warp)
  const idx=state.clips.indexOf(c); if(idx>=0)state.clips.splice(idx,1);
  state.clips.push(nc); state.selId=nc.id; state.selIds=[nc.id]; state.selGroupId=null;
  renderMedia(); renderTimeline(); renderInspector(); render(); updStatus(); markDirty();
  flashStatus(T('Rendered in place → ','Renderizado en el sitio → ')+nm.name);
}
/* [R1] Render a TIME SELECTION (in/out) in place: bake the FULL composite over [a,b] (all clips + adjustment layers → a
   true flatten) to a light MP4 and drop it as one clip on a NEW top video track covering the range. Non-destructive —
   the source clips stay underneath; undo with ⌘Z. */
async function renderRangeInPlace(){
  if(!IS_ELEC){ appAlert(T('Render in place needs the desktop app.','Renderizar en el sitio necesita la app de escritorio.')); return; }
  const sA=state.tl.selA, sB=state.tl.selB; let a,b;
  if(sA!=null&&sB!=null&&Math.abs(sB-sA)>1e-3){ a=Math.min(sA,sB); b=Math.max(sA,sB); }
  else if(state.workIn!=null&&state.workOut!=null&&state.workOut>state.workIn+1e-3){ a=state.workIn; b=state.workOut; }
  else { flashStatus(T('Make a time selection (or set In/Out) first','Haz una selección de tiempo (o define Entrada/Salida) primero'),'err'); return; }
  if(!currentPath){ appAlert(T('Save the project first — the rendered clip goes beside it in a “rendered clips” folder.','Guarda el proyecto primero — el clip renderizado va junto a él en una carpeta “rendered clips”.')); return; }
  const as=activeSeq(); const flat=isFlat(); const layoutStr=flat?((as.w||1920)+'×'+(as.h||1080)):((as.w||4096)+'²'); const dur=b-a;
  const choice=await ripFormatDialog({name:T('Time selection','Selección de tiempo'),kind:'video'},{dur},layoutStr,flat); if(!choice)return;
  const fps=as.fps||state.fps||60, res=flat?(as.w||1920):(as.w||4096);
  const codec=(choice.format==='h264')?'h264':'hevc';
  const eW=flat?(as.w||1920):res, eH=flat?(as.h||1080):res, br=suggestBitrate(res,fps,flat?eW:0,flat?eH:0)*1e6;
  const i=Math.max(currentPath.lastIndexOf('\\'),currentPath.lastIndexOf('/')), projDir=currentPath.slice(0,i), dir=projDir+'\\rendered clips';
  try{ if(DSP.ensureDir)await DSP.ensureDir(dir); }catch(e){ appAlert(T('Could not create the “rendered clips” folder.','No se pudo crear la carpeta “rendered clips”.')); return; }
  const safe='selection '+fmtTime(a).replace(/[:.]/g,'-');
  const outPath=dir+'\\'+safe+' ['+layoutStr.replace('×','x')+' '+codec+'] '+uid().slice(0,5)+'.mp4';
  let cancelled=false; const job={ prog:(n,t)=>{ if(n===1||n>=t||n%8===0)flashStatus(T('Rendering selection… ','Renderizando selección… ')+Math.round(n/t*100)+'%'); }, label:()=>{}, done:cx=>{ cancelled=!!cx; } };
  flashStatus(T('Rendering selection…','Renderizando selección…'));
  try{ await runExport({codec,res,fps,bitrate:br,range:'clips',rangeT:[a,b],outPath,silent:true,job}); } // NO isolateClips → full composite over the range (a real flatten)
  catch(e){ flashStatus(T('Render failed','Falló el render'),'err'); return; }
  let ok=false; try{ const st=await DSP.stat(outPath); ok=!!(st&&st.size>0); }catch(e){}
  if(cancelled||!ok){ flashStatus(T('Render cancelled','Render cancelado'),'err'); return; }
  const nm=await addVideoFromPath(outPath,T('Selection','Selección')); if(!nm){ flashStatus(T('Could not import the rendered file','No se pudo importar el archivo renderizado'),'err'); return; }
  pushUndo();
  const n=state.lanes.filter(l=>l.kind==='video').length+1; const nl={id:uid(),name:'Render '+n,tag:'V'+n,kind:'video'}; state.lanes.push(nl); const li=state.lanes.length-1; // new video lane at the top (push keeps existing clip lane-indices valid)
  const nc=makeClip(nm,li,a); nc.start=a; nc.dur=b-a; nc.inP=0; if(!flat)nc.props.fulldome=true;
  state.clips.push(nc); state.selId=nc.id; state.selIds=[nc.id]; state.selGroupId=null;
  state.tl.selA=state.tl.selB=null; state.tl.selLanes=null; // the range is now baked → clear the selection
  renderMedia(); renderTimeline(); renderInspector(); renderTimeSel(); render(); updStatus(); markDirty();
  flashStatus(T('Rendered selection → new track · ','Renderizado la selección → pista nueva · ')+fmtTime(dur));
}

/* ===================== HAP (Vidvox) — DXT en GPU + Snappy + muxer QuickTime =====================
   Hap is the interchange codec of the live/immersive world (Resolume · disguise · Watchout · TouchDesigner
   · Millumin): fixed-rate DXT texture data the GPU uploads without a CPU decode, so a machine plays several
   4K layers at once where H.264 chokes on one. We can author it WITHOUT FFmpeg because every stage is ours:
   the frame is already on the GPU (→ compress it there), Snappy is small, and the .mov is written by hand.
   Spec: github.com/Vidvox/hap · documentation/HapVideoDRAFT.md (section type values are NOT sequential —
   0xAB/0xBB/0xCB = DXT1, 0xAE/0xBE/0xCE = DXT5, 0xAF/0xBF/0xCF = scaled YCoCg; read them from the table). */
const HAP_FMT={
  hap : {fourcc:'Hap1', tex:'dxt1',  depth:24, bpb:8,  none:0xAB, snappy:0xBB, chunked:0xCB, label:'Hap1', bpp:0.5}, // RGB · DXT1/BC1
  hapq: {fourcc:'HapY', tex:'ycocg', depth:24, bpb:16, none:0xAF, snappy:0xBF, chunked:0xCF, label:'HapY', bpp:1  }, // scaled YCoCg · DXT5/BC3
};
function u8cat(list){ let n=0; for(const a of list)n+=a.length; const o=new Uint8Array(n); let p=0; for(const a of list){ o.set(a,p); p+=a.length; } return o; }

/* ---- Snappy (raw block format, not the framed stream): varint uncompressed length, then literal/copy tags.
   Mirrors the reference CompressFragment — the input is walked in 64KB fragments so a back-reference always
   fits the 2-byte copy form and we never need the 4-byte one. ---- */
function snappyCompress(src){
  const n=src.length, out=new Uint8Array(32+n+Math.ceil(n/6)); let op=0,v=n;
  while(v>=128){ out[op++]=(v&127)|128; v=Math.floor(v/128); } out[op++]=v;
  for(let bs=0;bs<n;bs+=65536) op=_snapFrag(src,bs,Math.min(65536,n-bs),out,op);
  return out.subarray(0,op);
}
function _snapFrag(src,base,len,out,op){
  const end=base+len;
  const emitLit=(s,l)=>{ if(l<=0)return; const m=l-1;
    if(m<60) out[op++]=m<<2;
    else { let nb=0,x=m; while(x>0){ nb++; x>>>=8; } out[op++]=(59+nb)<<2; x=m; for(let i=0;i<nb;i++){ out[op++]=x&255; x>>>=8; } }
    out.set(src.subarray(s,s+l),op); op+=l; };
  const emitCopy=(off,l)=>{
    while(l>=68){ out[op++]=(63<<2)|2; out[op++]=off&255; out[op++]=(off>>>8)&255; l-=64; }
    if(l>64){ out[op++]=(59<<2)|2; out[op++]=off&255; out[op++]=(off>>>8)&255; l-=60; }
    if(l>=4&&l<=11&&off<2048){ out[op++]=1|((l-4)<<2)|(((off>>>8)&7)<<5); out[op++]=off&255; }
    else { out[op++]=2|((l-1)<<2); out[op++]=off&255; out[op++]=(off>>>8)&255; } };
  if(len<15){ emitLit(base,len); return op; }
  let tsz=256,shift=24; while(tsz<len&&tsz<16384){ tsz<<=1; shift--; }
  const tab=new Int32Array(tsz).fill(base), mask=tsz-1;
  const ld=i=>(src[i]|(src[i+1]<<8)|(src[i+2]<<16)|(src[i+3]<<24))>>>0;
  const hs=x=>(Math.imul(x,0x1e35a7bd)>>>shift)&mask;
  const limit=end-15;
  let ip=base+1, anchor=base, nextHash=hs(ld(ip)), done=false;
  while(!done){
    let skip=32, nextIp=ip, cand=base;
    for(;;){ ip=nextIp; const h=nextHash; nextIp=ip+(skip>>>5); skip++;
      if(nextIp>limit){ done=true; break; }
      nextHash=hs(ld(nextIp)); cand=tab[h]; tab[h]=ip;
      if(cand<ip && ld(ip)===ld(cand)) break; } // cand<ip: a zero offset would be an invalid copy tag
    if(done)break;
    emitLit(anchor,ip-anchor);
    for(;;){ const bip=ip; let m=4;
      while(ip+m<end && src[cand+m]===src[ip+m]) m++;
      ip+=m; emitCopy(bip-cand,m); anchor=ip;
      if(ip>limit){ done=true; break; }
      tab[hs(ld(ip-1))]=ip-1;
      const h=hs(ld(ip)); cand=tab[h]; tab[h]=ip;
      if(cand>=ip || ld(ip)!==ld(cand)) break; }
    if(done)break;
    nextHash=hs(ld(ip+1)); ip++;
  }
  emitLit(anchor,end-anchor);
  return op;
}

/* ---- DXT/BC compression on the GPU. One fragment invocation per 4×4 block, rendering into an RGBA32UI
   FBO where each texel IS a block (BC1 uses .rg = 8 bytes, BC3 uses .rgba = 16). readPixels then hands us
   the block stream in row-major order, which is exactly the layout DXT wants — no CPU repacking.
   The vertical flip lives in the fetch: GL row 0 is the image BOTTOM, so buffer row r must hold top block
   row r → source y = (H-1) - (r*4+j). Blocks past the edge clamp (HAP pads to a multiple of 4, and every
   decoder aligns the coded size the same way). ---- */
const DXT_FS=`precision highp float; precision highp int;
uniform sampler2D u_src; uniform ivec2 u_dim;
out uvec4 o_blk;
uint pk565(vec3 c){ uvec3 q=uvec3(floor(clamp(c,0.0,1.0)*vec3(31.0,63.0,31.0)+0.5)); return (q.r<<11)|(q.g<<5)|q.b; }
vec3 up565(uint v){ uint r=(v>>11)&31u,g=(v>>5)&63u,b=v&31u; return vec3(float((r<<3)|(r>>2)),float((g<<2)|(g>>4)),float((b<<3)|(b>>2)))/255.0; }
void colorBlock(vec3 c[16], out uint w0, out uint w1){
  vec3 mu=vec3(0.0), mn=vec3(1.0), mx=vec3(0.0);
  for(int k=0;k<16;k++){ mu+=c[k]; mn=min(mn,c[k]); mx=max(mx,c[k]); }
  mu*=0.0625;
  /* Endpoints must lie on the block's PRINCIPAL AXIS, not on the per-channel bounding box. A block of red
     and cyan has a box spanning black→white, so a box-based encoder emits a grey ramp and every pixel
     quantises to grey (measured: 27 dB vs ffmpeg's 42 on the same frame). Covariance + power iteration
     recovers the real colour axis — the same thing stb_dxt does. */
  float cxx=0.0,cxy=0.0,cxz=0.0,cyy=0.0,cyz=0.0,czz=0.0;
  for(int k=0;k<16;k++){ vec3 d=c[k]-mu; cxx+=d.x*d.x; cxy+=d.x*d.y; cxz+=d.x*d.z; cyy+=d.y*d.y; cyz+=d.y*d.z; czz+=d.z*d.z; }
  vec3 v=mx-mn; if(dot(v,v)<1e-9) v=vec3(0.299,0.587,0.114); /* seed with the box diagonal; luma axis when the block is flat */
  for(int i=0;i<8;i++){
    vec3 nv=vec3(cxx*v.x+cxy*v.y+cxz*v.z, cxy*v.x+cyy*v.y+cyz*v.z, cxz*v.x+cyz*v.y+czz*v.z);
    float mg=max(max(abs(nv.x),abs(nv.y)),abs(nv.z));
    if(mg<1e-9) break; /* covariance collapsed (solid block) → keep the seed */
    v=nv/mg; }
  if(dot(v,v)<1e-9) v=vec3(0.299,0.587,0.114);
  float dmin=1e9,dmax=-1e9; vec3 pmn=c[0],pmx=c[0];
  for(int k=0;k<16;k++){ float d=dot(c[k],v); if(d<dmin){dmin=d;pmn=c[k];} if(d>dmax){dmax=d;pmx=c[k];} }
  uint c0=pk565(pmx), c1=pk565(pmn);
  if(c0<c1){ uint t=c0; c0=c1; c1=t; } /* BC1 needs c0>c1 for 4-colour mode; the 565 packing is not monotonic in RGB so compare PACKED */
  uint idx=0u;
  if(c0!=c1){ /* c0==c1 → solid block, all indices 0 (and 3-colour mode would give the same colour anyway) */
    vec3 p0=up565(c0), p1=up565(c1);
    vec3 pal[4]; pal[0]=p0; pal[1]=p1; pal[2]=(2.0*p0+p1)/3.0; pal[3]=(p0+2.0*p1)/3.0;
    for(int k=0;k<16;k++){ float bd=1e9; uint bi=0u;
      for(int q=0;q<4;q++){ vec3 d=c[k]-pal[q]; float dd=dot(d,d); if(dd<bd){ bd=dd; bi=uint(q); } }
      idx|=bi<<uint(2*k); } }
  w0=c0|(c1<<16); w1=idx;
}
void alphaBlock(float a[16], out uint w0, out uint w1){
  float amn=1.0,amx=0.0; for(int k=0;k<16;k++){ amn=min(amn,a[k]); amx=max(amx,a[k]); }
  uint a0=uint(floor(amx*255.0+0.5)), a1=uint(floor(amn*255.0+0.5));
  uint lo=0u, hi=0u; /* 48 bits of 3-bit indices, LSB-first */
  if(a0!=a1){ float f0=float(a0), f1=float(a1);
    for(int k=0;k<16;k++){ float av=a[k]*255.0; float bd=1e9; uint bi=0u;
      for(int q=0;q<8;q++){ float pv = (q==0)? f0 : ((q==1)? f1 : ((float(8-q)*f0+float(q-1)*f1)/7.0));
        float d=abs(av-pv); if(d<bd){ bd=d; bi=uint(q); } }
      uint bp=uint(3*k);
      if(bp<32u){ lo|=bi<<bp; if(bp>29u) hi|=bi>>(32u-bp); } else hi|=bi<<(bp-32u); } }
  w0=a0|(a1<<8)|((lo&0xFFFFu)<<16); w1=(lo>>16)|(hi<<16);
}
void main(){
  ivec2 b=ivec2(gl_FragCoord.xy);
  vec4 t[16];
  for(int j=0;j<4;j++) for(int i=0;i<4;i++){
    ivec2 p=clamp(ivec2(b.x*4+i, u_dim.y-1-(b.y*4+j)), ivec2(0), u_dim-ivec2(1));
    t[j*4+i]=texelFetch(u_src,p,0); }
#if VAR==1
  vec3 c[16]; for(int k=0;k<16;k++) c[k]=t[k].rgb;
  uint w0,w1; colorBlock(c,w0,w1); o_blk=uvec4(w0,w1,0u,0u);
#else
  /* Scaled YCoCg (HapY): Y goes in the BC3 alpha block (8-bit endpoints + 3-bit lerp = a good luma), and
     (Co,Cg,scale) in the colour block. Chroma is scaled up per block to use the full 565 range and the
     factor is stashed in blue as (scale-1)*8 — the three legal values (0/8/24) survive 5-bit quantisation
     EXACTLY, which is the whole reason the format encodes it that way. Decoder: scale = blue*255/8 + 1. */
  vec3 ch[16]; float y[16]; float m=0.0;
  for(int k=0;k<16;k++){ vec3 s=t[k].rgb;
    float Y=(s.r+2.0*s.g+s.b)*0.25, Co=(s.r-s.b)*0.5, Cg=(-s.r+2.0*s.g-s.b)*0.25;
    ch[k]=vec3(Co,Cg,0.0); y[k]=Y; m=max(m,max(abs(Co),abs(Cg))); }
  float mb=m*255.0, sc=1.0; if(mb<63.0) sc=2.0; if(mb<31.0) sc=4.0;
  float bl=(sc-1.0)*8.0/255.0;
  vec3 c[16];
  for(int k=0;k<16;k++) c[k]=vec3(clamp(ch[k].x*sc+0.50196078,0.0,1.0), clamp(ch[k].y*sc+0.50196078,0.0,1.0), bl);
  uint aw0,aw1,cw0,cw1; alphaBlock(y,aw0,aw1); colorBlock(c,cw0,cw1);
  o_blk=uvec4(aw0,aw1,cw0,cw1);
#endif
}`;
const _dxtProg={}; let _dxtFBO=null,_dxtTex=null,_dxtBW=0,_dxtBH=0,_dxtSrcTex=null,_dxtSrcW=0,_dxtSrcH=0,_dxtBuf=null;
function dxtProgram(kind){ if(_dxtProg[kind])return _dxtProg[kind];
  return _dxtProg[kind]=ppCompile('#version 300 es\n#define VAR '+(kind==='dxt1'?1:7)+'\n'+DXT_FS); }
function dxtFree(){ for(const k in _dxtProg){ try{gl.deleteProgram(_dxtProg[k]);}catch(e){} delete _dxtProg[k]; }
  if(_dxtTex){gl.deleteTexture(_dxtTex);_dxtTex=null;} if(_dxtFBO){gl.deleteFramebuffer(_dxtFBO);_dxtFBO=null;}
  if(_dxtSrcTex){gl.deleteTexture(_dxtSrcTex);_dxtSrcTex=null;} _dxtBW=_dxtBH=_dxtSrcW=_dxtSrcH=0; _dxtBuf=null; }
function dxtEnsure(bw,bh,W,H){
  if(_dxtSrcTex&&(_dxtSrcW!==W||_dxtSrcH!==H)){ gl.deleteTexture(_dxtSrcTex); _dxtSrcTex=null; }
  if(!_dxtSrcTex){ _dxtSrcTex=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,_dxtSrcTex);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    _dxtSrcW=W; _dxtSrcH=H; }
  if(_dxtTex&&(_dxtBW!==bw||_dxtBH!==bh)){ gl.deleteTexture(_dxtTex); gl.deleteFramebuffer(_dxtFBO); _dxtTex=null; _dxtFBO=null; }
  if(!_dxtTex){ _dxtTex=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,_dxtTex);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32UI,bw,bh,0,gl.RGBA_INTEGER,gl.UNSIGNED_INT,null);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    _dxtFBO=gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER,_dxtFBO);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,_dxtTex,0);
    const st=gl.checkFramebufferStatus(gl.FRAMEBUFFER); gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    if(st!==gl.FRAMEBUFFER_COMPLETE){ dxtFree(); throw new Error('DXT FBO incomplete (0x'+st.toString(16)+')'); }
    _dxtBW=bw; _dxtBH=bh; _dxtBuf=new Uint32Array(bw*bh*4); } }
/* Compress whatever is currently in the canvas. Returns a VIEW over the scratch buffer — valid until the
   next call, which is fine because the caller packs the frame synchronously. */
function dxtEncodeCanvas(kind,W,H){
  const bw=Math.ceil(W/4), bh=Math.ceil(H/4); dxtEnsure(bw,bh,W,H);
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  gl.bindTexture(gl.TEXTURE_2D,_dxtSrcTex); gl.copyTexImage2D(gl.TEXTURE_2D,0,gl.RGBA,0,0,W,H,0);
  const p=dxtProgram(kind);
  gl.bindFramebuffer(gl.FRAMEBUFFER,_dxtFBO); gl.viewport(0,0,bw,bh);
  gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
  gl.useProgram(p); gl.bindVertexArray(_ppVAO);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,_dxtSrcTex);
  gl.uniform1i(gl.getUniformLocation(p,'u_src'),0); gl.uniform2i(gl.getUniformLocation(p,'u_dim'),W,H);
  gl.drawArrays(gl.TRIANGLES,0,6);
  gl.readPixels(0,0,bw,bh,gl.RGBA_INTEGER,gl.UNSIGNED_INT,_dxtBuf);
  gl.bindVertexArray(null); gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  if(kind==='dxt1'){ // BC1 is 8 bytes/block: keep .rg, drop the unused .ba (Uint32Array→bytes is LE, which is what DXT wants)
    const out=new Uint8Array(bw*bh*8), o32=new Uint32Array(out.buffer);
    for(let i=0,n=bw*bh;i<n;i++){ o32[2*i]=_dxtBuf[4*i]; o32[2*i+1]=_dxtBuf[4*i+1]; } return out; }
  return new Uint8Array(_dxtBuf.buffer,0,bw*bh*16);
}

/* ---- HAP frame: section header is 4 bytes (24-bit size + type), or 8 when the size needs more. ---- */
function hapSection(type,payload){ const n=payload.length;
  if(n<0x1000000){ const h=new Uint8Array(4); h[0]=n&255; h[1]=(n>>>8)&255; h[2]=(n>>>16)&255; h[3]=type; return [h,payload]; }
  const h=new Uint8Array(8); h[3]=type; h[4]=n&255; h[5]=(n>>>8)&255; h[6]=(n>>>16)&255; h[7]=(n>>>24)&255; return [h,payload]; }
/* Chunks exist so the DECODER can spread a frame over several threads: each chunk is compressed
   independently, so N chunks = N cores able to inflate at once. Cost is a little ratio (each chunk
   restarts the Snappy window) — worth it for 4K, pointless for small frames. */
function hapFrame(tex,fmt,chunks){
  const F=HAP_FMT[fmt], bpb=F.bpb;
  const nb=Math.floor(tex.length/bpb); // split on BLOCK boundaries so every chunk is whole blocks
  const want=Math.max(1,Math.min(64,chunks|0));
  const per=Math.max(1,Math.ceil(nb/want)), real=Math.ceil(nb/per);
  const comp=[];
  for(let i=0;i<real;i++){ const raw=tex.subarray(i*per*bpb, Math.min(tex.length,(i+1)*per*bpb));
    const c=snappyCompress(raw);
    comp.push(c.length<raw.length?{d:c,t:0x0B}:{d:raw,t:0x0A}); } // incompressible → store it raw, like the reference encoder
  if(real===1) return u8cat(hapSection(comp[0].t===0x0B?F.snappy:F.none, comp[0].d));
  const ct=new Uint8Array(real); for(let i=0;i<real;i++) ct[i]=comp[i].t;              // 0x02 compressor table
  const szb=new Uint8Array(real*4), dv=new DataView(szb.buffer);                       // 0x03 size table (COMPRESSED sizes)
  for(let i=0;i<real;i++) dv.setUint32(i*4,comp[i].d.length,true);
  const di=u8cat([].concat(hapSection(0x02,ct),hapSection(0x03,szb)));
  const inner=u8cat([].concat(hapSection(0x01,di), comp.map(c=>c.d)));                 // instructions, then the chunk data
  return u8cat(hapSection(F.chunked,inner));
}

/* ---- QuickTime .mov writer (big-endian atoms). Video: one sample per chunk. Audio: 16-bit PCM 'sowt',
   interleaved a frame at a time. co64 + a 64-bit mdat throughout — HAP at 4K runs GBs per minute and
   32-bit offsets would silently wrap. ---- */
function _fcc(s){ const u=new Uint8Array(4); for(let i=0;i<4;i++)u[i]=s.charCodeAt(i); return u; }
function _atom(type,parts){ let n=8; for(const p of parts)n+=p.length; const h=new Uint8Array(8); new DataView(h.buffer).setUint32(0,n>>>0); h.set(_fcc(type),4); return u8cat([h].concat(parts)); }
function _bytes(n,fill){ const b=new Uint8Array(n); const dv=new DataView(b.buffer); if(fill)fill(dv,b); return b; }
const _MATRIX=(()=>{ const b=new Uint8Array(36), dv=new DataView(b.buffer); dv.setUint32(0,0x00010000); dv.setUint32(16,0x00010000); dv.setUint32(32,0x40000000); return b; })();
function _hdlr(ctype,subtype,name){ const nm=new TextEncoder().encode(name);
  return _atom('hdlr',[_bytes(25+nm.length,(dv,b)=>{ b.set(_fcc(ctype),4); b.set(_fcc(subtype),8); b[24]=nm.length; b.set(nm,25); })]); }
function _dinf(){ return _atom('dinf',[_atom('dref',[_bytes(8,(dv)=>{dv.setUint32(4,1);}), _bytes(12,(dv,b)=>{ dv.setUint32(0,12); b.set(_fcc('url '),4); dv.setUint32(8,1); })])]); }
function _stts(entries){ return _atom('stts',[_bytes(8+entries.length*8,(dv)=>{ dv.setUint32(4,entries.length); entries.forEach((e,i)=>{ dv.setUint32(8+i*8,e[0]); dv.setUint32(12+i*8,e[1]); }); })]); }
function _stsc(entries){ return _atom('stsc',[_bytes(8+entries.length*12,(dv)=>{ dv.setUint32(4,entries.length); entries.forEach((e,i)=>{ dv.setUint32(8+i*12,e[0]); dv.setUint32(12+i*12,e[1]); dv.setUint32(16+i*12,e[2]); }); })]); }
function _stszTab(sizes){ return _atom('stsz',[_bytes(12+sizes.length*4,(dv)=>{ dv.setUint32(8,sizes.length); sizes.forEach((s,i)=>dv.setUint32(12+i*4,s)); })]); }
function _stszFix(sz,count){ return _atom('stsz',[_bytes(12,(dv)=>{ dv.setUint32(4,sz); dv.setUint32(8,count); })]); }
function _co64(offs){ return _atom('co64',[_bytes(8+offs.length*8,(dv)=>{ dv.setUint32(4,offs.length); offs.forEach((o,i)=>{ dv.setUint32(8+i*8,Math.floor(o/4294967296)); dv.setUint32(12+i*8,o>>>0); }); })]); }
function _mvhd(ts,dur,nextId){ return _atom('mvhd',[u8cat([_bytes(20,(dv)=>{ dv.setUint32(12,ts); dv.setUint32(16,dur); }), _bytes(4,(dv)=>dv.setUint32(0,0x00010000)), _bytes(2,(dv)=>dv.setUint16(0,0x0100)), new Uint8Array(10), _MATRIX, new Uint8Array(24), _bytes(4,(dv)=>dv.setUint32(0,nextId))])]); }
function _tkhd(id,dur,w,h,vol){ return _atom('tkhd',[u8cat([
  _bytes(24,(dv)=>{ dv.setUint32(0,0x00000003); dv.setUint32(12,id); dv.setUint32(20,dur); }), // flags 3 = enabled + in movie
  new Uint8Array(8), _bytes(8,(dv)=>{ dv.setUint16(4,vol); }), _MATRIX,
  _bytes(8,(dv)=>{ dv.setUint32(0,w*65536); dv.setUint32(4,h*65536); })])]); }
function _mdhd(ts,dur){ return _atom('mdhd',[_bytes(24,(dv)=>{ dv.setUint32(12,ts); dv.setUint32(16,dur); dv.setUint16(20,0x55C4); })]); } // 0x55C4 = 'und'
function _stsdVideo(fourcc,w,h,depth){ const cn=new TextEncoder().encode('Hap');
  const e=_bytes(86,(dv,b)=>{ dv.setUint32(0,86); b.set(_fcc(fourcc),4); dv.setUint16(14,1); dv.setUint32(28,0x200);
    dv.setUint16(32,w); dv.setUint16(34,h); dv.setUint32(36,0x00480000); dv.setUint32(40,0x00480000); dv.setUint16(48,1);
    b[50]=cn.length; b.set(cn,51); dv.setUint16(82,depth); dv.setInt16(84,-1); });
  return _atom('stsd',[_bytes(8,(dv)=>dv.setUint32(4,1)), e]); }
function _stsdPCM(ch,sr){ const e=_bytes(36,(dv,b)=>{ dv.setUint32(0,36); b.set(_fcc('sowt'),4); dv.setUint16(14,1);
    dv.setUint16(24,ch); dv.setUint16(26,16); dv.setUint32(32,sr*65536); });
  return _atom('stsd',[_bytes(8,(dv)=>dv.setUint32(4,1)), e]); }
function _rleStsc(counts){ const out=[]; for(let i=0;i<counts.length;i++) if(!out.length||out[out.length-1][1]!==counts[i]) out.push([i+1,counts[i],1]); return out; }
function movBuild(c){
  const TS=1000, nF=c.frames.length, durMs=Math.round(nF/c.fps*TS);
  const vStbl=_atom('stbl',[_stsdVideo(c.fourcc,c.w,c.h,c.depth), _stts([[nF,1]]), _stsc([[1,1,1]]), _stszTab(c.frames.map(f=>f.size)), _co64(c.frames.map(f=>f.off))]);
  const vTrak=_atom('trak',[_tkhd(1,durMs,c.w,c.h,0), _atom('mdia',[_mdhd(c.fps,nF), _hdlr('mhlr','vide','VideoHandler'),
    _atom('minf',[_atom('vmhd',[_bytes(12,(dv)=>dv.setUint32(0,1))]), _hdlr('dhlr','alis','DataHandler'), _dinf(), vStbl])])]);
  const parts=[_mvhd(TS,durMs,c.audio?3:2), vTrak];
  if(c.audio){ const a=c.audio, nS=a.chunks.reduce((s,x)=>s+x.samples,0);
    const aStbl=_atom('stbl',[_stsdPCM(a.ch,a.sr), _stts([[nS,1]]), _stsc(_rleStsc(a.chunks.map(x=>x.samples))), _stszFix(a.ch*2,nS), _co64(a.chunks.map(x=>x.off))]);
    parts.push(_atom('trak',[_tkhd(2,Math.round(nS/a.sr*TS),0,0,0x0100), _atom('mdia',[_mdhd(a.sr,nS), _hdlr('mhlr','soun','SoundHandler'),
      _atom('minf',[_atom('smhd',[new Uint8Array(8)]), _hdlr('dhlr','alis','DataHandler'), _dinf(), aStbl])])])); }
  return _atom('moov',parts);
}
function movFtyp(){ return _atom('ftyp',[u8cat([_fcc('qt  '), _bytes(4,(dv)=>dv.setUint32(0,0x20050300)), _fcc('qt  ')])]); }
function audioPCM16(buf){ const ch=buf.numberOfChannels, n=buf.length, out=new Uint8Array(n*ch*2), dv=new DataView(out.buffer);
  const chans=[]; for(let c=0;c<ch;c++)chans.push(buf.getChannelData(c));
  let p=0; for(let i=0;i<n;i++)for(let c=0;c<ch;c++){ const s=Math.max(-1,Math.min(1,chans[c][i]||0)); dv.setInt16(p,s<0?s*0x8000:s*0x7FFF,true); p+=2; }
  return out; }
function hapAutoChunks(){ const n=(navigator.hardwareConcurrency||4); let p=1; while(p*2<=n&&p<8)p*=2; return p; } // power of two, capped at 8

/* zip */
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);t[n]=c>>>0;}return t;})();
function crc32(b){let c=0xFFFFFFFF;for(let i=0;i<b.length;i++)c=CRC[(c^b[i])&0xFF]^(c>>>8);return(c^0xFFFFFFFF)>>>0;}
class Zip{constructor(){this.p=[];this.c=[];this.o=0;this.e=new TextEncoder();}
  add(n,d){const nb=this.e.encode(n),crc=crc32(d),sz=d.length;const lh=new DataView(new ArrayBuffer(30));lh.setUint32(0,0x04034b50,true);lh.setUint16(4,20,true);lh.setUint32(14,crc,true);lh.setUint32(18,sz,true);lh.setUint32(22,sz,true);lh.setUint16(26,nb.length,true);this.p.push(new Uint8Array(lh.buffer),nb,d);
   const cd=new DataView(new ArrayBuffer(46));cd.setUint32(0,0x02014b50,true);cd.setUint16(4,20,true);cd.setUint16(6,20,true);cd.setUint32(16,crc,true);cd.setUint32(20,sz,true);cd.setUint32(24,sz,true);cd.setUint16(28,nb.length,true);cd.setUint32(42,this.o,true);this.c.push(new Uint8Array(cd.buffer),nb);this.o+=30+nb.length+sz;}
  finish(){let cs=0;for(const x of this.c)cs+=x.length;const n=this.c.length/2;const eo=new DataView(new ArrayBuffer(22));eo.setUint32(0,0x06054b50,true);eo.setUint16(8,n,true);eo.setUint16(10,n,true);eo.setUint32(12,cs,true);eo.setUint32(16,this.o,true);return new Blob([...this.p,...this.c,new Uint8Array(eo.buffer)],{type:'application/zip'});}}

/* ===================== EXPORT MODAL ===================== */
const _exq=[]; let _exbusy=false;
const _exJobs=[]; // [R94-UT3·U-02] persistent job registry {id,name,status:'queued'|'running'|'cancelling'|'done'|'cancelled',p,labelTxt,opt} — the modal's #exQueue is just a VIEW of this list, so the queue survives closing/reopening the Export dialog
function exJobRow(rec){ const q=document.getElementById('exQueue'); if(!q)return; q.style.display='block';
  const jd=document.createElement('div'); jd.className='qjob'; jd.dataset.jid=rec.id;
  jd.innerHTML=`<span class="tnum" style="color:var(--ink-2);">${rec.name}</span><div class="qbar"><i></i></div><span class="tnum jpct" style="width:64px;text-align:right;color:var(--ink-2);">0%</span><button class="ibtn jx" title="${T('Cancel this export','Cancelar esta exportación')}">✕</button>`;
  jd.querySelector('.jx').onclick=()=>exCancelJob(rec); // [R92-T5 P2] a 60-min export finally has a Cancel · [R94-UT3·U-02] same routine as the status-bar ✕
  q.appendChild(jd); exPaintJob(rec); }
function exPaintJob(rec){ const jd=document.querySelector('#exQueue .qjob[data-jid="'+rec.id+'"]'); if(!jd)return; const bar=jd.querySelector('.qbar>i'),pct=jd.querySelector('.jpct'); // [R94-UT3·U-02] paint state → row (looked up by id: rows are rebuilt when the modal reopens)
  const p=Math.round((rec.p||0)*100); if(bar)bar.style.width=p+'%';
  if(rec.status==='done'){ pct.textContent=T('✓ done','✓ listo'); pct.style.color='#B4BAC1'; }
  else if(rec.status==='cancelled'){ pct.textContent=T('cancelled','cancelado'); pct.style.color='#C9CDD3'; }
  else if(rec.status==='cancelling'){ pct.textContent=T('cancelling…','cancelando…'); }
  else if(rec.labelTxt){ pct.textContent=rec.labelTxt; }
  else pct.textContent=(rec.status==='queued'?T('queued','en cola')+' · ':'')+p+'%';
  const xb=jd.querySelector('.jx'); if(xb)xb.style.display=(rec.status==='done'||rec.status==='cancelled')?'none':''; }
function exCancelJob(rec){ if(!rec)return; // [R94-UT3·U-02] queued → remove from the queue; running → same cancelExport flag the encoder loop polls
  if(rec.status==='queued'){ const i=_exq.indexOf(rec.opt); if(i>=0)_exq.splice(i,1); rec.status='cancelled'; exPaintJob(rec); flashStatus(T('Export cancelled','Exportación cancelada'),'err'); }
  else if(rec.status==='running'||rec.status==='cancelling'){ cancelExport=true; rec.status='cancelling'; exPaintJob(rec); }
  updExportUI(); }
function exCancelActive(){ const rec=_exJobs.find(j=>j.status==='running'||j.status==='cancelling'); if(rec)exCancelJob(rec); } // [R94-UT3·U-02c] status-bar ✕ → cancel the ACTIVE job
function updExportUI(){ // [R94-UT3·U-02c/U-33] status-bar ✕ + Export button badge reflect the live queue
  const running=_exJobs.some(j=>j.status==='running'||j.status==='cancelling');
  const n=_exJobs.filter(j=>j.status==='running'||j.status==='cancelling'||j.status==='queued').length;
  const x=document.getElementById('statXBtn'); if(x)x.style.display=running?'':'none'; // '' → the stylesheet's .ibtn display:grid (keeps the ✕ centered)
  const eb=document.getElementById('exportBtn');
  if(eb){ let bg=eb.querySelector('.exbadge'); if(n>0){ if(!bg){ bg=document.createElement('span'); bg.className='exbadge'; eb.insertBefore(bg,eb.firstChild); eb.style.paddingRight='22px'; } bg.textContent=n; } else if(bg){ bg.remove(); eb.style.paddingRight=''; } } } // badge goes FIRST (position:absolute anyway): applyLang's tn() relies on the button's lastChild being the text node
function pumpExportQ(){ if(_exbusy||!_exq.length)return; _exbusy=true; const opt=_exq.shift(); if(opt._rec){ opt._rec.status='running'; exPaintJob(opt._rec); } updExportUI(); Promise.resolve(runExport(opt)).then(()=>{ _exbusy=false; pumpExportQ(); }).catch(()=>{ _exbusy=false; pumpExportQ(); }); }
/* [R94d] which range the export dialog is set to (I/O marks vs the clip extent) + its length in seconds */
function exRangeMode(){ const io=document.querySelector('#exRange [data-rg=inout]'); return (io&&io.classList.contains('on'))?'inout':'clips'; }
function exRangeSecs(){ if(exRangeMode()==='inout'&&state.workIn!=null&&state.workOut!=null)return Math.max(0.05,state.workOut-state.workIn); const r=clipExtent(); return Math.max(0.05,r[1]-r[0]); }
function openExport(){ if(!state.clips.length){appAlert(T('Add clips to the timeline first.','Primero añade clips a la línea de tiempo.'));return;}
  /* [R102·rev] Si ya está abierto, NO abrir otro. El overlay tapa el ratón pero NO el teclado, así que un
     segundo Ctrl+Shift+E volvía a llamar aquí y dejaba DOS modales: veías el de arriba, pero `$()` es
     querySelector = PRIMER match, así que todo el cableado (`#exCodec`, `#exGo`…) se enganchaba al de abajo,
     el viejo y oculto. Medido: el botón Export del modal visible se quedaba con onclick == null → pulsabas
     Exportar y no pasaba nada. Lo encontró la revisión de código, no las 55 aserciones: ninguna preguntaba
     "¿y si lo abre dos veces?". */
  if(document.getElementById('exOv'))return;
  const ov=document.createElement('div'); ov.className='overlay'; ov.id='exOv';
  const _exTitle=isRoom()?T('Export 360 room','Exportar sala 360'):(isFlat()?T('Export 2D master','Exportar máster 2D'):T('Export dome master','Exportar máster del domo'));
  ov.innerHTML=`<div class="modal"><div class="mh"><span style="color:var(--ink-2);display:flex;">${ICO('share',16)}</span><span class="t">${_exTitle}</span></div>
   <div class="mb">
    <div class="frow"><label>${T('Preset','Preajuste')}</label><select id="exPreset" style="flex:1;"><option value="">—</option></select><button class="mbtn" id="exSavePreset" style="height:18px;padding:0 10px;">${T('Save','Guardar')}</button></div>
    <div class="frow"><label>${T('Codec','Códec')}</label><select id="exCodec"><option value="png" selected>${T('PNG sequence (.zip · alpha, lossless)','Secuencia PNG (.zip · alfa, sin pérdida)')}</option><option value="mp4">MP4 · H.264 (${T('black bg, ≤4K','fondo negro, ≤4K')})</option><option value="hevc">MP4 · H.265 / HEVC (${T('black bg, 4K+','fondo negro, 4K+')})</option><option value="hap">MOV · HAP (${T('live playback — Resolume, disguise, Watchout','reproducción en directo — Resolume, disguise, Watchout')})</option><option value="hapq">MOV · HAP Q (${T('live playback, higher quality, ~2× the size','reproducción en directo, más calidad, ~2× el tamaño')})</option><option value="still">${T('Still frame (PNG · current frame, originals)','Fotograma (PNG · cuadro actual, originales)')}</option></select></div>
    <div class="frow" id="exChunkRow" style="display:none;"><label>${T('Chunks','Trozos')}</label><select id="exChunks"><option value="auto" selected>${T('Auto','Auto')}</option><option value="1">1</option><option value="2">2</option><option value="4">4</option><option value="8">8</option><option value="16">16</option></select><span class="tnum" style="color:var(--ink-faint);flex:1;" id="exChunkHint"></span></div>
    <div class="frow"><label>${T('Range','Rango')}</label><div class="kindseg" id="exRange"><button data-rg="clips">${T('Clip extent','Extensión de clips')}</button><button data-rg="inout">${T('In / Out','Entrada / Salida')}</button></div><span class="tnum" id="exRangeTc" style="color:var(--ink-faint);white-space:nowrap;"></span></div>
    <div id="exRoomRow"></div>
    <div class="frow"><label>${T('Resolution','Resolución')}</label><select id="exRes"><option>2048</option><option>3072</option><option selected>4096</option><option>6144</option><option>8192</option></select><span class="tnum" style="color:var(--ink-dim);">px²</span></div>
    <div class="frow"><label>FPS</label><select id="exFps"><option>24</option><option>25</option><option>30</option><option>48</option><option>50</option><option selected>60</option></select></div>
    <div class="frow" id="exBrRow"><label>${T('Bitrate','Tasa de bits')}</label><input type="number" class="tnum" id="exBr" value="120" min="1" max="800"><span class="tnum" style="color:var(--ink-dim);">Mbps</span><button class="mbtn" id="exBrAuto" style="padding:2px 8px;font-size:11px;" title="${T('Set a generous bitrate for this resolution/fps','Tasa de bits generosa para esta resolución/fps')}">${T('Auto','Auto')}</button></div>
    <div class="frow"><label>${T('Estimated','Estimado')}</label><span class="tnum" id="exEst" style="color:var(--ink-2);">—</span></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px;"><button class="mbtn" id="exClose">${T('Close','Cerrar')}</button><button class="mbtn pri" id="exGo">${ICO('share')} ${T('Add to queue & export','Añadir a la cola y exportar')}</button></div>
    <div class="queue" id="exQueue" style="display:none;"></div>
   </div></div>`;
  document.body.appendChild(ov);
  // [R94d] range picker: I/O when marks exist (default then), else the clip extent — and the I/O button is disabled without marks
  { const hw=state.workIn!=null&&state.workOut!=null&&state.workOut>state.workIn; const rg=$('#exRange');
    const io=rg.querySelector('[data-rg=inout]'), cl=rg.querySelector('[data-rg=clips]');
    io.disabled=!hw; setDis(io,!hw,hw?T('Export the I/O range','Exportar el rango de entrada/salida'):T('Set In (I) and Out (O) marks on the timeline first','Marca antes Entrada (I) y Salida (O) en la línea de tiempo'));
    (hw?io:cl).classList.add('on');
    const tc=()=>{ const useIO=io.classList.contains('on'); const r=useIO?[state.workIn,state.workOut]:clipExtent(); $('#exRangeTc').textContent=fmtTime(r[0])+' → '+fmtTime(r[1]); };
    rg.querySelectorAll('button').forEach(b=>b.onclick=()=>{ if(b.disabled)return; rg.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b)); tc(); upd(); }); tc(); }
  for(const rec of _exJobs) exJobRow(rec); // [R94-UT3·U-02b] rebuild the queue view from the persistent registry — running/queued jobs reappear with progress + a working Cancel
  { const as=activeSeq(); if(as){ const ro=$('#exRes').querySelector('option[value="'+as.w+'"]')||[...$('#exRes').options].find(o=>+o.value===as.w); if(ro)$('#exRes').value=as.w; const fo=[...$('#exFps').options].find(o=>+o.value===as.fps); if(fo)$('#exFps').value=as.fps;
    if(as.mode==='flat'){ $('#exBr').value=suggestBitrate(0,as.fps||60,as.w,as.h); const rl=$('#exRes').parentElement; if(rl){ const rs=rl.querySelector('.tnum'); if(rs)rs.textContent=''; $('#exRes').style.display='none'; const sp=document.createElement('span'); sp.className='tnum'; sp.style.cssText='color:var(--ink-2);flex:1;'; sp.textContent=(as.w||1920)+'×'+(as.h||1080)+' px'; rl.insertBefore(sp,$('#exRes')); } } } } // default to the active sequence's resolution / fps (flat shows W×H, exports at the sequence size)
  // F5: 360-room export options — full unwrapped strip OR one file per wall (native pxW×pxH), + the floor sequence as its own file
  if(isRoom()){ const as=activeSeq(), room=as&&as.room; const rr=$('#exRoomRow');
    const nWalls=(room&&room.walls&&room.walls.length)||0; const hasFloor=!!(room&&room.floorSeqId&&mediaById(room.floorSeqId));
    rr.innerHTML=`<div class="frow"><label>${T('Room','Sala')}</label><div class="kindseg" id="exRoomMode"><button data-rm="strip" class="on">${T('Full strip','Tira completa')}</button><button data-rm="walls">${T('Per wall','Por muro')} (${nWalls})</button></div></div>`+
      (hasFloor?`<div class="frow"><label></label><label style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--ink-2);cursor:pointer;"><input type="checkbox" id="exFloor" checked> ${T('Also export the floor (its own file)','Exportar también el piso (archivo propio)')}</label></div>`:'');
    rr.querySelectorAll('#exRoomMode button').forEach(b=>b.onclick=()=>rr.querySelectorAll('#exRoomMode button').forEach(x=>x.classList.toggle('on',x===b))); }
  if(!HAS_WC){ ['mp4','hevc'].forEach(cv=>{ const mo=$('#exCodec').querySelector('option[value="'+cv+'"]'); if(mo){ mo.disabled=true; mo.textContent+=' '+T('(unavailable)','(no disponible)'); } }); }
  const upd=()=>{ const res=+$('#exRes').value,fps=+$('#exFps').value,br=+$('#exBr').value; const codec=$('#exCodec').value; const isVid=(codec==='mp4'||codec==='hevc'); const isHap=(codec==='hap'||codec==='hapq');
    $('#exBrRow').style.display=isVid?'flex':'none';
    $('#exChunkRow').style.display=isHap?'flex':'none';
    if(isHap){ const F=HAP_FMT[codec], as0=activeSeq(), fl=!!(as0&&flatLikeMode(as0.mode));
      const W=fl?(as0.w||res):res, H=fl?(as0.h||res):res, nf=Math.round(exRangeSecs()*fps);
      const per=Math.ceil(W/4)*Math.ceil(H/4)*F.bpb; // HAP is FIXED-RATE: the texture size IS the frame size (Snappy only shaves the flat areas)
      const cv=$('#exChunks').value, ch=(cv==='auto')?hapAutoChunks():+cv;
      $('#exChunkHint').textContent=(cv==='auto'?ch+' · ':'')+T('parallel decode threads on the player','hilos de decodificación en paralelo en el reproductor');
      $('#exEst').textContent=fmtBytes(per*nf*0.85)+' · '+nf+' '+T('frames','fotogramas')+' · '+fmtBytes(per*fps*0.85)+'/s · '+F.label;
      $('#exEst').style.color=(per*fps>3.5e8)?'#E5B567':'#9AA0A8'; // >~350MB/s of playback needs an SSD that can actually feed it
      const fcH=$('#fmtChip'); if(fcH){ fcH._codec=F.label; fcH.textContent=(fl?(W+'×'+H):(res+'²'))+' · '+fps+'p · '+F.label; }
      if($('#exGo')){ $('#exGo').disabled=false; setDis($('#exGo'),false); } return; }
    if(codec==='still'){ $('#exEst').textContent=res+'×'+res+' PNG · 1 '+T('frame (current playhead, full quality)','fotograma (cabezal actual, máxima calidad)'); const fc0=$('#fmtChip'); if(fc0){ fc0._codec='PNG'; fc0.textContent=res+'² · '+T('still','foto'); } if($('#exGo')){$('#exGo').disabled=false;setDis($('#exGo'),false);} return; } // [R94-UT5·U-30]
    const secs=exRangeSecs(); const est= isVid? (br*1e6/8*secs) : (res*res*1.2*Math.round(secs*fps)); // [R94d] the estimate follows the Range picker
    const estWarn=(codec==='png'&&est>1.5e9); // [U-13] readable GB/MB via fmtBytes; amber when the large-RAM warning fires
    let estTxt=fmtBytes(est)+' · '+Math.round(secs*fps)+' '+T('frames','fotogramas'); if(estWarn)estTxt+=' ⚠ '+T('large — high RAM','grande — mucha RAM');
    if(isVid){ const bpp=br*1e6/(res*res*fps); const hevcEdge=(codec==='hevc'?0.6:1); const q=bpp>=0.15*hevcEdge?'●●● '+T('High','Alta'):bpp>=0.08*hevcEdge?'●●○ '+T('Good','Buena'):'●○○ '+T('Low — raise bitrate','Baja — sube el bitrate'); estTxt+=' · '+bpp.toFixed(2)+' bpp · '+q+(codec==='hevc'?' · H.265':''); }
    $('#exEst').textContent=estTxt; $('#exEst').style.color=estWarn?'#E5B567':'#9AA0A8';
    const fc=$('#fmtChip'); if(fc){ fc._codec=codec.toUpperCase(); fc.textContent=res+'² · '+fps+'p · '+codec.toUpperCase(); }
    validateRes(); };
  async function validateRes(){ const codec=$('#exCodec').value, sel=$('#exRes'), go=$('#exGo'); if(!go)return;
    if(codec!=='mp4'&&codec!=='hevc'){ go.disabled=false; setDis(go,false); return; } // [R94-UT5·U-30]
    const res=+sel.value, br=(+$('#exBr').value||120)*1e6, fps=+$('#exFps').value, isHevc=(codec==='hevc');
    go.disabled=true; let ok=false; try{ ok=!!(await (isHevc?pickHevcCodec(res,res,br,fps):pickAvcCodec(res,res,br,fps))); }catch(e){}
    if(!document.getElementById('exGo')||$('#exCodec').value!==codec||+$('#exRes').value!==res)return; // stale: dialog closed or selection changed
    /* [R105] El motivo ya existía pero iba SÓLO al texto de estimación: pasabas el ratón por el botón gris y
       la barra no decía nada. Ahora se lo damos también a setDis → la Info View lo pinta en ámbar. Es el único
       momento en que el usuario mira ahí, y por tanto el único en que quiere aprender. */
    const _why=!ok ? (isHevc?T('H.265 unavailable at '+res+'² on this GPU — use PNG sequence.','H.265 no disponible a '+res+'² en esta GPU — usa Secuencia PNG.')
                            :T('H.264 tops out near 4096² on this GPU — switch to H.265 or PNG for '+res+'².','H.264 se topa cerca de 4096² en esta GPU — cambia a H.265 o PNG para '+res+'².')) : null;
    go.disabled=!ok; setDis(go,!ok,_why); // [R94-UT5·U-30]
    if(!ok)$('#exEst').textContent=_why; }
  let _brTouched=false;
  const autoBr=()=>{ const as=activeSeq(); $('#exBr').value=(as&&flatLikeMode(as.mode))?suggestBitrate(0,+$('#exFps').value,as.w,as.h):suggestBitrate(+$('#exRes').value,+$('#exFps').value); };
  $('#exCodec').onchange=upd;
  $('#exChunks').onchange=upd;
  $('#exRes').onchange=()=>{ if(!_brTouched)autoBr(); upd(); };
  $('#exFps').onchange=()=>{ if(!_brTouched)autoBr(); upd(); };
  $('#exBr').oninput=()=>{ _brTouched=true; upd(); };
  $('#exBrAuto').onclick=()=>{ _brTouched=false; autoBr(); upd(); };
  autoBr(); upd(); // start from a resolution-aware suggestion (e.g. 4096²/60 → ~180 Mbps, not a starved 120)
  $('#exClose').onclick=()=>{ const fc=$('#fmtChip'); if(fc)fc._codec=null; ov.remove(); updFmtChip(); for(let i=_exJobs.length-1;i>=0;i--)if(_exJobs[i].status==='done'||_exJobs[i].status==='cancelled')_exJobs.splice(i,1); }; // restore the chip to the active sequence's format (dialog tweaks shouldn't stick if not exported) · [R94-UT3·U-02] finished/cancelled jobs are pruned on close (live ones persist and reappear on reopen)
  /* [R102·D-T4] El diálogo abre con LO ÚLTIMO QUE USASTE, no con valores de fábrica.
     Es la mitad aplicable de "Operate → Adjust" (HIG de Blender: ejecutar con los últimos ajustes en vez de
     interrogar antes). La otra mitad —disparar sin diálogo— NO aplica al export y no se hizo: su
     justificación es *"evita popups que te obligan a decidir antes de saber cómo quedará"*, y en un export sí
     sabes cómo quedará (es tu línea de tiempo) mientras que equivocarte cuesta minutos de render y un fichero
     escrito. Ni Premiere ni Resolve disparan un export sin diálogo. Inconsistencia deliberada, anotada.
     Medido antes de tocar: cambiabas a MP4/2048/24, cerrabas, reabrías → PNG/4096/60 otra vez. */
  { const L=lastExportGet(); if(L){ for(const [id,v] of [['exCodec',L.codec],['exRes',L.res],['exFps',L.fps],['exBr',L.br]]){
      const e=$('#'+id); if(!e||v==null)continue;
      if(e.tagName==='SELECT'&&![...e.options].some(o=>o.value===String(v)))continue; // un códec que ya no exista no debe dejar el select en blanco
      e.value=String(v); }
    try{ upd(); }catch(_){} } } // asignar .value NO dispara change → sin esto, el bitrate y el aviso de tamaño se quedarían mostrando lo del códec anterior
  for(const id of ['exCodec','exRes','exFps','exBr']){ const e=$('#'+id); if(!e)continue;
    e.addEventListener('change',()=>{ lastExportSet({codec:$('#exCodec')?$('#exCodec').value:null, res:$('#exRes')?$('#exRes').value:null,
      fps:$('#exFps')?$('#exFps').value:null, br:$('#exBr')?$('#exBr').value:null}); }); } // se recuerda al elegir, no al exportar: cerrar sin exportar también es información
  const ps=$('#exPreset'); function fillPresets(){ ps.innerHTML='<option value="">—</option>'+(state.exportPresets||[]).map((p,i)=>`<option value="${i}">${p.name}</option>`).join(''); } fillPresets();
  ps.onchange=()=>{ const p=(state.exportPresets||[])[+ps.value]; if(!p)return; $('#exCodec').value=p.codec; $('#exRes').value=p.res; $('#exFps').value=p.fps; if(p.bitrate)$('#exBr').value=Math.round(p.bitrate/1e6); upd(); };
  $('#exSavePreset').onclick=()=>{ appPrompt(T('Preset name:','Nombre del preajuste:'),$('#exCodec').value.toUpperCase()+' '+$('#exRes').value,name=>{ if(!name)return; state.exportPresets=state.exportPresets||[]; state.exportPresets.push({name,codec:$('#exCodec').value,res:+$('#exRes').value,fps:+$('#exFps').value,bitrate:(+$('#exBr').value)*1e6}); markDirty(); fillPresets(); ps.value=state.exportPresets.length-1; flashStatus(T('Preset saved','Preajuste guardado')); }); };
  $('#exGo').onclick=()=>{ const codec=$('#exCodec').value,res=+$('#exRes').value,fps=+$('#exFps').value,br=(+$('#exBr').value)*1e6; const range=exRangeMode(); // [R94d] freeze the chosen range into every job queued by this click (the marks may move later)
    const chunks=$('#exChunks')?$('#exChunks').value:'auto', cLbl=HAP_FMT[codec]?HAP_FMT[codec].label:codec.toUpperCase();
    const addJob=(extra,labelTxt)=>{ const rec={id:uid(),name:labelTxt,status:'queued',p:0,labelTxt:null,opt:null}; _exJobs.push(rec); exJobRow(rec); // [R94-UT3·U-02] the job lives in the module registry; the row is just its view
      let _lastStat=0; const stat=(txt)=>{ const now=performance.now(); if(now-_lastStat<500)return; _lastStat=now; const sa=$('#statAuto'); sa.textContent=txt; sa.style.color=''; try{ if(IS_ELEC&&DSP.setProgress)DSP.setProgress(parseFloat(txt)/100||0); }catch(e){} }; // [R92-T5 P2] progress survives the modal: status bar + Windows taskbar
      const job={prog:(n,tot)=>{rec.p=n/tot; rec.labelTxt=null; exPaintJob(rec); stat(Math.round(rec.p*100)+'% · '+T('Exporting ','Exportando ')+labelTxt);},
        label:t=>{rec.labelTxt=t; exPaintJob(rec);},
        done:cx=>{rec.status=cx?'cancelled':'done'; if(!cx)rec.p=1; rec.labelTxt=null; exPaintJob(rec); _lastStat=0; flashStatus(cx?T('Export cancelled','Exportación cancelada'):T('Export finished','Exportación terminada'),cx?'err':undefined); try{ if(IS_ELEC&&DSP.setProgress)DSP.setProgress(-1); }catch(e){} updExportUI();}};
      const opt=Object.assign({codec,res,fps,bitrate:br,chunks,range,job,_rec:rec},extra||{}); rec.opt=opt; _exq.push(opt); updExportUI(); };
    const queueJob=()=>{ const as=activeSeq(); const room=isRoom()?(as&&as.room):null;
      const rm=room?(($('#exRoomMode')&&$('#exRoomMode').querySelector('button.on'))||{dataset:{}}).dataset.rm:null;
      if(room && rm==='walls'){ const sw=as.w||1, sh=as.h||1; for(const w of room.walls){ addJob({wall:{role:w.role,x0:w.x0,x1:w.x1,pxW:w.pxW,pxH:w.pxH,stripW:sw,stripH:sh}}, roomRoleLabel(w.role).toUpperCase()+' · '+w.pxW+'×'+w.pxH+' '+cLbl); } }
      else { addJob(null, (room?(T('Walls','Muros')+' · '):'')+(isFlat()?((as.w||res)+'×'+(as.h||res)):(res+'²'))+' '+cLbl); }
      if(room && $('#exFloor') && $('#exFloor').checked){ const fm=mediaById(room.floorSeqId); if(fm && (fm.nestClips||[]).length){ addJob({seqId:fm.id}, T('Floor','Piso')+' · '+(fm.w||1920)+'×'+(fm.h||1080)+' '+cLbl); } else if(fm){ flashStatus(T('Floor has no clips — skipped','El piso no tiene clips — omitido'),'err'); } } // [R94-UT3·U-21]
      pumpExportQ(); };
    if((codec==='mp4'||codec==='hevc') && !(IS_ELEC && DSP.fileOpen)){ const secs=exRangeSecs(); const estGB=br/8*secs/1e9; // only warn when we can't stream to disk (browser); the .exe streams MP4 chunk-by-chunk
      if(estGB>1.8){ appConfirm(T('This MP4 is about ','Este MP4 pesa ~')+estGB.toFixed(1)+T(' GB and is assembled in memory before saving — it may run out of RAM. For very long/large renders use a PNG sequence (streamed to disk). Continue anyway?',' GB y se arma en memoria antes de guardar — podría quedarse sin RAM. Para renders muy largos/grandes usa Secuencia PNG (escrita a disco). ¿Continuar igual?'), ok=>{ if(ok)queueJob(); }, {ok:T('Continue anyway','Continuar igual')}); return; } }
    queueJob(); };
}

/* ===================== PROYECTO: NUEVO / GUARDAR / ABRIR (sin pérdida de datos) ===================== */
let currentPath=null;
function markDirty(){ state.dirty=true; projTitle(); raInvalidate(); }
function currentTitle(){ return (currentPath&&IS_ELEC)?DSP.basename(currentPath).replace(/\.(isp|ise|rdome)$/i,''):T('Untitled project','Proyecto sin título'); }
function projTitle(){ const md=(activeSeq()&&activeSeq().mode)||state.seqMode; const pre=md==='flat'?'2D':md==='room'?T('360 Room','Sala 360'):T('Immersive Dome','Domo inmersivo'); const t=$('#projTitle'); if(t)t.textContent=pre+' · '+currentTitle()+(state.dirty?' *':''); if(IS_ELEC){try{DSP.setTitle('Immersive Studio Pro — '+currentTitle()+(state.dirty?' *':''));}catch(e){} try{if(DSP.setUiState)DSP.setUiState({dirty:!!state.dirty,lang:state.lang});}catch(e){}} }
function serMedia(m){ return {id:m.id,name:m.name,kind:m.kind,w:m.w,h:m.h,mode:m.mode||null,cov:m.cov||null,room:m.room||null,roomFloorOf:m.roomFloorOf||null,dur:m.dur,fps:m.fps,color:m.color,path:m.path||null,fsize:m.fsize||0,folder:m.folder||null,framePaths:m.framePaths||null,ndiSource:m.ndiSource||null,
  text:m.text,tfontSize:m.tfontSize,tweight:m.tweight,tfont:m.tfont,talign:m.talign,tlineH:m.tlineH,titalic:m.titalic,tcolor:m.tcolor,tbg:m.tbg,tstroke:m.tstroke,tstrokeColor:m.tstrokeColor,
  shape:m.shape,fill:m.fill,stroke:m.stroke,strokeW:m.strokeW,sw:m.sw,sh:m.sh,
  nestClips:(m.kind==='nest'?(m.nestClips||[]).map(serClip):null), nestLanes:(m.kind==='nest'?m.nestLanes:null),
  nestMarkers:(m.kind==='nest'?(m.nestMarkers||[]):null), nestGroups:(m.kind==='nest'?(m.nestGroups||[]):null), nestPlayhead:(m.kind==='nest'?(m.nestPlayhead||0):null), nestWorkIn:(m.kind==='nest'?(m.nestWorkIn??null):null), nestWorkOut:(m.kind==='nest'?(m.nestWorkOut??null):null), comp:(m.comp||null), grade:(m.kind==='nest'?(m.grade||null):null),
  thumb:(m.kind==='audio'?m.thumb:null)}; }
let _serLight=false; // when true (autosave), drop heavy fields (maskData PNGs) to stay under the localStorage quota
function serClip(c){ const o=JSON.parse(JSON.stringify(c)); delete o.maskTex; delete o._penCv; delete o._elB; delete o._szB; delete o._curveTex; delete o._curveDirty; if(_serLight)delete o.maskData; return o; } // R132: _curveTex is a live GL texture (rebuilt from props.curves), _curveDirty a transient flag // maskTex is a live GL texture; _penCv is the pen-mask raster canvas (rebuilt from penMasks); _elB/_szB are transient drag baselines; maskData (dataURL) kept except in the light autosave copy
/* ===================== SEQUENCES (Premiere-style; a sequence IS a media item, kind 'nest') ===================== */
function isSeqMedia(m){ return !!(m&&m.kind==='nest'); }
function seqReaches(rootId,targetId){ const seen=new Set(); const walk=id=>{ if(id===targetId)return true; if(seen.has(id))return false; seen.add(id); const mm=mediaById(id); return !!(mm&&isSeqMedia(mm)&&(mm.nestClips||[]).some(c=>walk(c.mediaId))); }; return walk(rootId); } // does sequence rootId (transitively) already contain targetId?
function activeSeq(){ return mediaById(state.activeSeqId); }
function seqDur(m){ let e=0; for(const c of (m&&m.nestClips||[]))e=Math.max(e,c.start+c.dur); return Math.max(0.1,e); }
function defLanes(){ return [{id:uid(),name:'Video 1',tag:'V1',kind:'video'},{id:uid(),name:'Video 2',tag:'V2',kind:'video'},{id:uid(),name:'Video 3',tag:'V3',kind:'video'},{id:uid(),name:'Video 4',tag:'V4',kind:'video'},{id:uid(),name:'Audio 1',tag:'A1',kind:'audio'}]; } // [R92-T9] 4 video + 1 audio
function newSeqMedia(name,fps,w,h,clips,lanes,mode,cov){ return {id:uid(),kind:'nest',name:name||'Sequence',fps:fps||60,w:w||4096,h:h||4096,mode:mode||'dome',cov:((mode||'dome')==='dome'?(cov||180):null),color:clipColorFor('nest'),thumb:null,
  nestClips:clips||[], nestLanes:lanes||defLanes(), nestMarkers:[], nestGroups:[], nestPlayhead:0, nestWorkIn:null, nestWorkOut:null, dur:6 }; }
function ensureSequences(){ let seqs=state.media.filter(isSeqMedia);
  if(!seqs.length){ const m=newSeqMedia('Sequence 1',state.fps||60,state.seqW||4096,state.seqH||4096,(state.clips&&state.clips.length?state.clips:null),(state.lanes&&state.lanes.length?state.lanes:null),state.seqMode||'dome',state.seqCov||180);
    m.nestMarkers=state.markers||[]; m.nestGroups=state.groups||[]; m.nestPlayhead=state.playhead||0; m.nestWorkIn=state.workIn??null; m.nestWorkOut=state.workOut??null; state.media.push(m); seqs=[m]; }
  if(!state.openSeqs||!state.openSeqs.length || !state.openSeqs.some(id=>isSeqMedia(mediaById(id)))) state.openSeqs=[seqs[0].id];
  if(!activeSeq()) state.activeSeqId=state.openSeqs[0]||seqs[0].id;
  loadSeqIntoState(activeSeq()); }
function saveActiveSeq(){ const s=activeSeq(); if(!s)return; s.nestClips=state.clips; s.nestLanes=state.lanes; s.nestMarkers=state.markers; s.nestGroups=state.groups; s.nestPlayhead=state.playhead; s.nestWorkIn=state.workIn; s.nestWorkOut=state.workOut; s.grade=state.seqGrade; s.dur=seqDur(s); } // [master grade] per-sequence grade travels with the nest media // nests render via the per-frame _nestPool (no per-media FBO); serMedia omits transient GL fields
function loadSeqIntoState(s){ if(!s)return; state.clips=s.nestClips||[]; state.lanes=(s.nestLanes&&s.nestLanes.length?s.nestLanes:defLanes());
  if(!s.comp && !state.lanes.some(l=>l.kind==='audio')){ const n=state.lanes.filter(l=>l.kind==='audio').length+1; state.lanes.push({id:uid(),name:'Audio '+n,tag:'A'+n,kind:'audio'}); s.nestLanes=state.lanes; } /* [R92-T9] audio module always present on real timelines (old projects get one); compositions (m.comp) stay video-only; no markDirty (idempotent) */
  state.markers=s.nestMarkers||[]; state.groups=s.nestGroups||[]; state.playhead=s.nestPlayhead||0; state.workIn=s.nestWorkIn??null; state.workOut=s.nestWorkOut??null; state.fps=s.fps||state.fps||60; state.seqW=s.w||state.seqW||4096; state.seqH=s.h||state.seqH||4096; state.seqMode=s.mode||'dome'; state.seqCov=s.cov||180; state.seqGrade=Object.assign({exposure:0,contrast:0,saturation:0,temperature:0,tint:0}, s.grade||{}); /* [master grade] restore this sequence's grade (identity default) */ state.selId=null; state.selIds=[]; state.selGroupId=null; state.selMarkerId=null; state.autoSel=null; state.hoverAuto=null; state.shapeBox=null; /* [R95·B1] the box holds live keyframe refs — undo/sequence switch replaces those objects, so it must go with them */ _arCache=null; try{raInvalidate();}catch(e){} try{updModeUI();}catch(e){} } // invalidate render-ahead + reactive cache: a cached flat frame / band cache belongs to the previous sequence
function updModeUI(){ const fl=isFlat(), room=isRoom(); // a 360 room has a real 3D view (assembled walls); plain 2D flat does not
  const b3=document.querySelector('#viewModeSeg button[data-v="3d"]'); if(b3){ b3.style.display=(fl&&!room)?'none':''; b3.textContent=room?T('3D Room','Sala 3D'):T('3D Preview','Vista 3D'); }
  const b2=document.querySelector('#viewModeSeg button[data-v="2d"]'); if(b2){ const lb=fl?T('2D Master','Máster 2D'):T('Dome Master','Máster de domo'); const last=b2.lastChild; if(last&&last.nodeType===3)last.textContent=' '+lb; else b2.textContent=lb; } // [U-42] dome shows "Dome Master"; flat/room keep "2D Master" (last text node → the icon survives)
  const bh=document.querySelector('#dispSeg button[data-d="hfade"]'); if(bh)bh.style.display=fl?'none':''; // horizon fade is dome-only
  const azr=document.getElementById('azelReadout'); if(azr)azr.style.display=(fl||state.view.mode==='3d')?'none':'inline-flex';
  if(fl && !room && state.view.mode==='3d'){ state.view.mode='2d'; document.querySelectorAll('#viewModeSeg button').forEach(x=>x.classList.toggle('on',x.dataset&&x.dataset.v==='2d')); } }
function openSeq(id){ const m=mediaById(id); if(!isSeqMedia(m))return; if(!state.openSeqs)state.openSeqs=[]; if(!state.openSeqs.includes(id))state.openSeqs.push(id); switchSeq(id); }
function switchSeq(id){ const m=mediaById(id); if(!isSeqMedia(m))return; if(id===state.activeSeqId){ if(!state.openSeqs.includes(id))state.openSeqs.push(id); renderSeqBar(); return; }
  saveActiveSeq(); state.activeSeqId=id; if(!state.openSeqs.includes(id))state.openSeqs.push(id); loadSeqIntoState(m); // [R92-T1] per-sequence undo stacks survive the switch
  renderSeqBar(); renderMedia(); renderTimeline(); renderInspector(); renderWork(); render(); updStatus(); updFmtChip(); flashStatus(T('Sequence: ','Secuencia: ')+m.name); }
function closeSeqTab(id){ if(!state.openSeqs)return; const wasActive=(id===state.activeSeqId); if(wasActive)saveActiveSeq();
  const next=state.openSeqs.filter(x=>x!==id); if(!next.length){ flashStatus(T('At least one sequence stays open','Al menos una secuencia queda abierta')); return; } state.openSeqs=next;
  if(wasActive){ state.activeSeqId=state.openSeqs[state.openSeqs.length-1]; loadSeqIntoState(activeSeq()); renderMedia(); renderTimeline(); renderInspector(); renderWork(); render(); updStatus(); updFmtChip(); }
  renderSeqBar(); }
function renameSequence(id){ const m=mediaById(id); if(!isSeqMedia(m))return; const el=document.querySelector('#seqTabs .seqtab[data-seq="'+id+'"] .seqlab');
  if(!inlineEdit(el,m.name,v=>{ m.name=v; renderSeqBar(); renderMedia(); projTitle(); markDirty(); })) appPrompt(T('Sequence name:','Nombre de la secuencia:'),m.name,n=>{ if(n!=null){ m.name=n; renderSeqBar(); renderMedia(); projTitle(); markDirty(); } }); }
function deleteSequenceMedia(id){ const m=mediaById(id); if(!isSeqMedia(m))return; if(state.media.filter(isSeqMedia).length<=1){ flashStatus(T('Keep at least one sequence','Mantén al menos una secuencia')); return; }
  const usedElsewhere=state.media.some(s=>isSeqMedia(s)&&s.id!==id&&(s.nestClips||[]).some(c=>c.mediaId===id));
  appConfirm(T('Delete this sequence?','¿Eliminar esta secuencia?')+(usedElsewhere?T(' It is nested inside another sequence.',' Está anidada dentro de otra secuencia.'):''), ok=>{ if(!ok)return;
    const wasActive=(id===state.activeSeqId); if(wasActive)saveActiveSeq();
    disposeMedia(m); state.media=state.media.filter(x=>x.id!==id); state.openSeqs=(state.openSeqs||[]).filter(x=>x!==id);
    state.clips=state.clips.filter(c=>c.mediaId!==id); for(const s of state.media)if(isSeqMedia(s)&&s.nestClips)s.nestClips=s.nestClips.filter(c=>c.mediaId!==id); // remove orphan nest clips that referenced the deleted sequence
    { const as=activeSeq(); if(as)as.nestClips=state.clips; } // re-heal the state.clips ⇄ activeSeq().nestClips alias broken by the filters above
    if(!state.openSeqs.length)state.openSeqs=[state.media.filter(isSeqMedia)[0].id];
    if(wasActive){ state.activeSeqId=state.openSeqs[state.openSeqs.length-1]; loadSeqIntoState(activeSeq()); }
    clearAllUndo(); renderMedia(); renderSeqBar(); renderTimeline(); renderInspector(); renderWork(); render(); updStatus(); updFmtChip(); markDirty(); }, {ok:T('Delete','Eliminar'),danger:true}); } // clearAllUndo: other sequences' histories may reference the deleted sequence's media id — resurrecting those clips would orphan them
const DOME_COV=[180,200,210,220]; // fisheye coverage presets (deg). 180° = full hemisphere (fulldome standard)
function fmtAspect(w,h){ if(!w||!h)return ''; const gcd=(a,b)=>b?gcd(b,a%b):a; const d=gcd(w,h)||1; const rw=Math.round(w/d), rh=Math.round(h/d); return (rw>40||rh>40)?((w/h).toFixed(2)+':1'):(rw+':'+rh); }
/* Live format preview for the create dialogs (parity with the 360-room schematic): a proportion rectangle for 2D,
   a fisheye disc for Dome where the horizon ring moves inward as the coverage (FOV) grows. */
function drawSeqViz(cv,kind,o){ if(!cv)return; const ctx=cv.getContext('2d'); const W=cv.width,H=cv.height; const rc=cv.getBoundingClientRect(); const U=(rc.width>0?W/rc.width:2); ctx.clearRect(0,0,W,H);
  if(kind!=='dome'){ const w=Math.max(1,o.w||1920), h=Math.max(1,o.h||1080), pad=30*U, aw=W-2*pad, ah=H-2*pad, s=Math.min(aw/w,ah/h), rw=w*s, rh=h*s, x=(W-rw)/2, y=(H-rh)/2;
    ctx.fillStyle='rgba(150,170,195,0.07)'; ctx.fillRect(x,y,rw,rh);
    ctx.strokeStyle='rgba(255,255,255,0.05)'; ctx.lineWidth=1*U; for(let i=1;i<3;i++){ ctx.beginPath();ctx.moveTo(x+rw*i/3,y);ctx.lineTo(x+rw*i/3,y+rh);ctx.stroke(); ctx.beginPath();ctx.moveTo(x,y+rh*i/3);ctx.lineTo(x+rw,y+rh*i/3);ctx.stroke(); }
    ctx.strokeStyle='rgba(184,190,197,0.75)'; ctx.lineWidth=1.4*U; ctx.strokeRect(x,y,rw,rh);
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle='#E6E8EB'; ctx.font=`600 ${11*U}px Geist,system-ui`; ctx.fillText(w+' × '+h, W/2, y+rh/2-7*U);
    ctx.fillStyle='rgba(165,165,165,0.9)'; ctx.font=`500 ${9*U}px Geist,system-ui`; ctx.fillText(fmtAspect(w,h), W/2, y+rh/2+9*U); return; }
  const cx=W/2, cy=H/2, R=Math.min(W,H)/2-26*U, covD=(o.cov||180)/2;
  const g=ctx.createRadialGradient(cx,cy-R*0.25,R*0.08,cx,cy,R); g.addColorStop(0,'rgba(95,125,160,0.20)'); g.addColorStop(1,'rgba(28,36,50,0.10)');
  ctx.fillStyle=g; ctx.beginPath();ctx.arc(cx,cy,R,0,7);ctx.fill();
  for(let a=0;a<360;a+=30){ const rad=a*D2R; ctx.strokeStyle='rgba(255,255,255,0.045)'; ctx.lineWidth=1*U; ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.sin(rad)*R,cy-Math.cos(rad)*R);ctx.stroke(); }
  for(const E of [15,30,45,60,75]){ const r=(90-E)/covD*R; if(r<2)continue; ctx.strokeStyle='rgba(255,255,255,0.08)'; ctx.lineWidth=1*U; ctx.beginPath();ctx.arc(cx,cy,r,0,7);ctx.stroke(); }
  ctx.strokeStyle='rgba(255,255,255,0.18)'; ctx.lineWidth=1.3*U; ctx.beginPath();ctx.arc(cx,cy,R,0,7);ctx.stroke();
  ctx.textAlign='center'; ctx.textBaseline='middle';
  if(Math.abs(covD-90)>0.5){ const rh=90/covD*R; ctx.strokeStyle='rgba(229,181,103,0.8)'; ctx.setLineDash([3*U,3*U]); ctx.lineWidth=1.3*U; ctx.beginPath();ctx.arc(cx,cy,rh,0,7);ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle='rgba(229,181,103,0.9)'; ctx.font=`600 ${7.5*U}px Geist,system-ui`; ctx.fillText(T('HORIZON','HORIZONTE'), cx, cy-rh-6*U); }
  ctx.fillStyle='rgba(184,184,184,0.85)'; ctx.font=`600 ${8*U}px Geist,system-ui`;
  ctx.fillText(T('FRONT','FRENTE'), cx, cy+R+11*U); ctx.fillText(T('BACK','ATRÁS'), cx, cy-R-11*U);
  ctx.textAlign='left'; ctx.fillText(T('RIGHT','DER'), cx+R+6*U, cy); ctx.textAlign='right'; ctx.fillText(T('LEFT','IZQ'), cx-R-6*U, cy);
  ctx.fillStyle='rgba(224,224,224,0.7)'; ctx.beginPath();ctx.arc(cx,cy,1.8*U,0,7);ctx.fill();
  ctx.textAlign='left'; ctx.textBaseline='alphabetic'; ctx.fillStyle='rgba(150,150,150,0.9)'; ctx.font=`600 ${8*U}px Geist,system-ui`; ctx.fillText((o.cov||180)+'° '+T('coverage','cobertura'), 10*U, H-9*U); }
function newSequenceDialog(){ const n=state.media.filter(isSeqMedia).length+1; const ov=document.createElement('div'); ov.className='overlay';
  ov.innerHTML=`<div class="modal" style="width:440px;"><div class="mh"><span class="t">${T('New sequence','Nueva secuencia')}</span></div><div class="mb">
    <canvas id="nsViz" class="rs-cv" width="816" height="300" style="height:150px;margin-bottom:12px;"></canvas>
    <div class="frow"><label>${T('Name','Nombre')}</label><input id="nsName" value="${T('Sequence','Secuencia')} ${n}"></div>
    <div class="frow"><label>${T('Type','Tipo')}</label><div class="kindseg" id="nsMode" style="flex:1;"><button data-m="dome" class="on">${T('Dome','Domo')}</button><button data-m="flat">${T('2D (flat)','2D (plano)')}</button></div></div>
    <div class="frow" id="nsDomeRow"><label>${T('Resolution','Resolución')}</label><select id="nsRes"><option>2048</option><option>3072</option><option selected>4096</option><option>6144</option><option>8192</option></select><span class="tnum" style="color:var(--ink-dim);">px²</span></div>
    <div class="frow" id="nsCovRow"><label>${T('Coverage','Cobertura')}</label><select id="nsCov">${DOME_COV.map(c=>`<option value="${c}" ${c===180?'selected':''}>${c}°${c===180?' · '+T('fulldome','domo completo'):''}</option>`).join('')}</select><span class="tnum" style="color:var(--ink-dim);">FOV</span></div>
    <div class="frow" id="nsFlatRow" style="display:none;"><label>${T('Resolution','Resolución')}</label><input type="number" class="tnum" id="nsW" value="1920" min="16" max="8192" style="width:74px;"><span style="color:var(--ink-dim);">×</span><input type="number" class="tnum" id="nsH" value="1080" min="16" max="8192" style="width:74px;"><span class="tnum" style="color:var(--ink-dim);">px</span></div>
    <div class="frow"><label>${T('Frame rate','Cuadros/s')}</label><select id="nsFps"><option>24</option><option>25</option><option>30</option><option>48</option><option>50</option><option selected>60</option></select><span class="tnum" style="color:var(--ink-dim);">fps</span></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px;"><button class="mbtn" id="nsCancel">${T('Cancel','Cancelar')}</button><button class="mbtn pri" id="nsGo">${T('Create','Crear')}</button></div></div></div>`;
  document.body.appendChild(ov); const close=()=>ov.remove(); $('#nsCancel').onclick=close; ov.addEventListener('pointerdown',e=>{if(e.target===ov)close();});
  let mode='dome';
  const viz=()=>{ try{ drawSeqViz($('#nsViz'), mode, mode==='dome'?{cov:+$('#nsCov').value||180}:{w:+$('#nsW').value||1920,h:+$('#nsH').value||1080}); }catch(e){} };
  ov.querySelectorAll('#nsMode button').forEach(b=>b.onclick=()=>{ mode=b.dataset.m; ov.querySelectorAll('#nsMode button').forEach(x=>x.classList.toggle('on',x===b)); const dm=mode==='dome'; $('#nsDomeRow').style.display=dm?'flex':'none'; $('#nsCovRow').style.display=dm?'flex':'none'; $('#nsFlatRow').style.display=dm?'none':'flex'; viz(); });
  $('#nsCov').onchange=viz; { const h=()=>viz(); $('#nsW').oninput=h; $('#nsH').oninput=h; }
  viz();
  $('#nsGo').onclick=()=>{ const fps=+$('#nsFps').value, name=($('#nsName').value||(T('Sequence','Secuencia')+' '+n)).trim(); const cov=+$('#nsCov').value||180;
    let w,h; if(mode==='flat'){ w=Math.max(16,Math.min(8192,+$('#nsW').value||1920)); h=Math.max(16,Math.min(8192,+$('#nsH').value||1080)); } else { w=h=+$('#nsRes').value; }
    saveActiveSeq(); const m=newSeqMedia(name,fps,w,h,null,null,mode,cov); state.media.push(m); state.openSeqs=state.openSeqs||[]; state.openSeqs.push(m.id); state.activeSeqId=m.id; loadSeqIntoState(m); // [R92-T1] fresh sequence starts with its own empty per-seq undo stack
    renderMedia(); renderSeqBar(); renderTimeline(); renderInspector(); renderWork(); render(); updStatus(); updFmtChip(); markDirty(); close(); flashStatus(T('New sequence','Nueva secuencia')+': '+name); }; }
/* landing "New 2D project" resolution picker → cb(w,h,fps) */
function flatResDialog(cb){ const ov=document.createElement('div'); ov.className='overlay'; ov.style.zIndex='320';
  ov.innerHTML=`<div class="modal" style="width:420px;"><div class="mh"><span class="t">${T('New 2D project','Nuevo proyecto 2D')}</span></div><div class="mb">
    <canvas id="fpViz" class="rs-cv" width="776" height="300" style="height:150px;margin-bottom:12px;"></canvas>
    <div class="frow"><label>${T('Preset','Preajuste')}</label><select id="fpPre" style="flex:1;"><option value="1920x1080" selected>1080p · 1920×1080</option><option value="3840x2160">4K UHD · 3840×2160</option><option value="1080x1920">${T('Vertical','Vertical')} 9:16 · 1080×1920</option><option value="1080x1080">${T('Square','Cuadrado')} · 1080×1080</option><option value="custom">${T('Custom…','Personalizado…')}</option></select></div>
    <div class="frow"><label>${T('Resolution','Resolución')}</label><input type="number" class="tnum" id="fpW" value="1920" min="16" max="8192" style="width:78px;"><span style="color:var(--ink-dim);">×</span><input type="number" class="tnum" id="fpH" value="1080" min="16" max="8192" style="width:78px;"><span class="tnum" style="color:var(--ink-dim);">px</span></div>
    <div class="frow"><label>${T('Frame rate','Cuadros/s')}</label><select id="fpFps"><option>24</option><option>25</option><option>30</option><option>48</option><option>50</option><option selected>60</option></select><span class="tnum" style="color:var(--ink-dim);">fps</span></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px;"><button class="mbtn" id="fpCancel">${T('Cancel','Cancelar')}</button><button class="mbtn pri" id="fpGo">${T('Create','Crear')}</button></div></div></div>`;
  document.body.appendChild(ov); const close=()=>ov.remove(); const pre=ov.querySelector('#fpPre'), wI=ov.querySelector('#fpW'), hI=ov.querySelector('#fpH');
  const viz=()=>{ try{ drawSeqViz(ov.querySelector('#fpViz'),'flat',{w:+wI.value||1920,h:+hI.value||1080}); }catch(e){} };
  pre.onchange=()=>{ if(pre.value!=='custom'){ const p=pre.value.split('x'); wI.value=p[0]; hI.value=p[1]; } viz(); };
  wI.oninput=()=>{ pre.value='custom'; viz(); }; hI.oninput=()=>{ pre.value='custom'; viz(); }; viz();
  ov.querySelector('#fpCancel').onclick=close; ov.addEventListener('pointerdown',e=>{if(e.target===ov)close();});
  ov.querySelector('#fpGo').onclick=()=>{ const w=Math.max(16,Math.min(8192,+wI.value||1920)), h=Math.max(16,Math.min(8192,+hI.value||1080)), fps=+ov.querySelector('#fpFps').value||60; close(); cb(w,h,fps); }; }
/* landing "New dome project" → cb({res,cov,fps}) — resolution + fisheye coverage (FOV), with a live dome preview */
function domeSetupDialog(cb){ const ov=document.createElement('div'); ov.className='overlay'; ov.style.zIndex='320';
  ov.innerHTML=`<div class="modal" style="width:420px;"><div class="mh"><span style="color:var(--ink-2);display:flex;">${ICO('view3d',16)}</span><span class="t">${T('New dome project','Nuevo proyecto domo')}</span></div><div class="mb">
    <canvas id="dsViz" class="rs-cv" width="776" height="360" style="height:180px;margin-bottom:12px;"></canvas>
    <div class="frow"><label>${T('Resolution','Resolución')}</label><select id="dsRes"><option>2048</option><option>3072</option><option selected>4096</option><option>6144</option><option>8192</option></select><span class="tnum" style="color:var(--ink-dim);">px²</span></div>
    <div class="frow"><label>${T('Coverage','Cobertura')}</label><select id="dsCov">${DOME_COV.map(c=>`<option value="${c}" ${c===180?'selected':''}>${c}°${c===180?' · '+T('fulldome','domo completo'):''}</option>`).join('')}</select><span class="tnum" style="color:var(--ink-dim);">FOV</span></div>
    <div class="frow"><label>${T('Frame rate','Cuadros/s')}</label><select id="dsFps"><option>24</option><option>25</option><option>30</option><option>48</option><option>50</option><option selected>60</option></select><span class="tnum" style="color:var(--ink-dim);">fps</span></div>
    <div style="font-size:11px;color:var(--ink-dim);margin-top:2px;">${T('Coverage is the fisheye field of view. 180° is a full hemisphere; wider domes pull the horizon inward.','La cobertura es el campo del ojo de pez. 180° es un hemisferio completo; los domos más amplios acercan el horizonte al centro.')}</div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px;"><button class="mbtn" id="dsCancel">${T('Cancel','Cancelar')}</button><button class="mbtn pri" id="dsGo">${ICO('view3d')} ${T('Create','Crear')}</button></div></div></div>`;
  document.body.appendChild(ov); const close=()=>ov.remove(); ov.querySelector('#dsCancel').onclick=close; ov.addEventListener('pointerdown',e=>{if(e.target===ov)close();});
  const viz=()=>{ try{ drawSeqViz(ov.querySelector('#dsViz'),'dome',{cov:+ov.querySelector('#dsCov').value||180}); }catch(e){} };
  ov.querySelector('#dsCov').onchange=viz; viz();
  ov.querySelector('#dsGo').onclick=()=>{ const res=+ov.querySelector('#dsRes').value||4096, cov=+ov.querySelector('#dsCov').value||180, fps=+ov.querySelector('#dsFps').value||60; close(); cb({res,cov,fps}); }; }
/* R91: 360 immersive-room setup → cb({walls:[{role,order,wcm,hcm,pxW,pxH}], floor:{wcm,dcm,pxW,pxH}|null, fps}). Number in "order" = position in the 2D strip; role = physical wall used to assemble the 3D room. */
const ROOM_ROLES=['Front','Right','Back','Left']; // canonical loop order for the 3D (angles fall out of dimensions, not forced 90°)
const ROOM_ROLE_COL={Front:'#5AA9E6',Right:'#6FCF97',Back:'#E6A15A',Left:'#C98BE0'};
const ROOM_GRID_ROWS=3, ROOM_GRID_COLS=4; // per-wall subdivision: 3 vertical divisions × 4 horizontal, proportional to each wall
function roomRoleLabel(r){ return {Front:T('Front','Frente'),Back:T('Back','Fondo'),Left:T('Left','Izquierda'),Right:T('Right','Derecha')}[r]||r; }
/* Shared room floor-plan geometry (METERS): from wall roles + widths(cm) + heights(cm) → footprint segments {role,a:[x,y],b:[x,y],h}. The angles come from the dimensions (Front/Back parallel & centered; sides slant if widths differ → non-90°), exactly what only the 3D shows. Used by the setup schematic AND the 3D viewer. */
function roomPlan(walls){ const by={}; for(const w of walls)by[w.role]=w;
  const has=r=>!!by[r], Wm=r=>by[r]?Math.max(0.02,by[r].wcm/100):0, Hm=r=>by[r]?Math.max(0.02,by[r].hcm/100):0; const seg=[];
  if(has('Front')&&has('Right')&&has('Back')&&has('Left')){
    const wF=Wm('Front'),wB=Wm('Back'),wL=Wm('Left'),wR=Wm('Right'); const off=(wF-wB)/2, avg=(wL+wR)/2, D=Math.sqrt(Math.max(0.04,avg*avg-off*off));
    const FL=[-wF/2,0],FR=[wF/2,0],BR=[wB/2,D],BL=[-wB/2,D];
    seg.push({role:'Front',a:FL,b:FR,h:Hm('Front')},{role:'Right',a:FR,b:BR,h:Hm('Right')},{role:'Back',a:BR,b:BL,h:Hm('Back')},{role:'Left',a:BL,b:FL,h:Hm('Left')}); return {seg,closed:true,poly:[FL,FR,BR,BL]}; }
  if(has('Front')&&has('Left')&&has('Right')){
    const wF=Wm('Front'),wL=Wm('Left'),wR=Wm('Right'); const FL=[-wF/2,0],FR=[wF/2,0],BR=[wF/2,wR],BL=[-wF/2,wL];
    seg.push({role:'Front',a:FL,b:FR,h:Hm('Front')},{role:'Right',a:FR,b:BR,h:Hm('Right')},{role:'Left',a:BL,b:FL,h:Hm('Left')}); return {seg,closed:false,poly:[FL,FR,BR,BL]}; }
  if(has('Front')&&has('Left')){
    const wF=Wm('Front'),wL=Wm('Left'); const FL=[-wF/2,0],FR=[wF/2,0],BL=[-wF/2,wL];
    seg.push({role:'Front',a:FL,b:FR,h:Hm('Front')},{role:'Left',a:BL,b:FL,h:Hm('Left')}); return {seg,closed:false,poly:[FL,FR,BL]}; }
  // generic fallback (non-canonical role mix): walk a loop at equal angles honoring each width
  let ang=0,p=[0,0]; const step=2*Math.PI/Math.max(3,walls.length||3); const poly=[];
  for(const w of walls){ const len=Math.max(0.02,(w.wcm||100)/100); const b=[p[0]+Math.cos(ang)*len,p[1]+Math.sin(ang)*len]; seg.push({role:w.role,a:p.slice(),b,h:Math.max(0.02,(w.hcm||300)/100)}); poly.push(p.slice()); p=b; ang+=step; } return {seg,closed:false,poly}; }
/* Two synced schematics of the room: a 3D iso (left) for shape/orientation and a to-scale top-down PLAN
   (right, with a metre bar) for exact footprint measurements. The wall under edit lights up in both. Drawn
   at ~2× for crispness; fonts sized to the app's scale via U = W/528 (so N*U renders at ~N screen px). */
function drawRoomIso(cv,walls,floorOn,activeRole){ if(!cv)return; const ctx=cv.getContext('2d'); const W=cv.width,H=cv.height,U=W/528; ctx.clearRect(0,0,W,H);
  const plan=roomPlan(walls); if(!plan.seg.length)return;
  const ca=Math.cos(Math.PI/6),sa=Math.sin(Math.PI/6);
  const line=(A,B,st,lw)=>{ ctx.strokeStyle=st; ctx.lineWidth=lw; ctx.beginPath(); ctx.moveTo(A[0],A[1]); ctx.lineTo(B[0],B[1]); ctx.stroke(); };
  const roleCol=r=>ROOM_ROLE_COL[r]||'#8892A0', wallOf=r=>walls.find(x=>x.role===r)||{wcm:0,hcm:0};
  const quad=plan.poly.length===4;
  const split=Math.round(W*0.58), padT=20*U, pad=13*U;
  line([split,12*U],[split,H-12*U],'rgba(255,255,255,0.07)',1*U); // panel divider
  ctx.textBaseline='alphabetic'; ctx.textAlign='left'; ctx.font=`600 ${8*U}px Geist,system-ui`; ctx.fillStyle='rgba(150,150,150,0.9)';
  ctx.fillText('3D',13*U,15*U); ctx.fillText('PLAN',split+13*U,15*U); const pw=ctx.measureText('PLAN').width;
  ctx.font=`500 ${8*U}px Geist,system-ui`; ctx.fillStyle='rgba(109,109,109,0.85)'; ctx.fillText('  cm',split+13*U+pw,15*U);
  // ---- bounds (iso projected · plan world) + centroid ----
  let iMnX=1e9,iMxX=-1e9,iMnY=1e9,iMxY=-1e9;
  for(const s of plan.seg)for(const c of [[s.a[0],s.a[1],0],[s.b[0],s.b[1],0],[s.a[0],s.a[1],s.h],[s.b[0],s.b[1],s.h]]){ const ix=(c[0]-c[1])*ca, iy=(c[0]+c[1])*sa-c[2]; if(ix<iMnX)iMnX=ix; if(ix>iMxX)iMxX=ix; if(iy<iMnY)iMnY=iy; if(iy>iMxY)iMxY=iy; }
  const isoW=(iMxX-iMnX)||1, isoH=(iMxY-iMnY)||1;
  let pMnX=1e9,pMxX=-1e9,pMnY=1e9,pMxY=-1e9; for(const p of plan.poly){ if(p[0]<pMnX)pMnX=p[0]; if(p[0]>pMxX)pMxX=p[0]; if(p[1]<pMnY)pMnY=p[1]; if(p[1]>pMxY)pMxY=p[1]; }
  const plW=(pMxX-pMnX)||1, plH=(pMxY-pMnY)||1;
  let cX=0,cY=0; for(const p of plan.poly){ cX+=p[0]; cY+=p[1]; } cX/=plan.poly.length; cY/=plan.poly.length;
  const availLW=split-2*pad, availRW=(W-split)-2*pad, availH=H-padT-pad;
  const lmx=30*U, lmy=15*U, availRWp=availRW-2*lmx, availHPp=availH-16*U-2*lmy; // plan reserves margins for edge labels + a strip for the scale bar
  const sIso=Math.min(availLW/isoW, availH/isoH), sPlan=Math.min(availRWp/plW, availHPp/plH);
  const oxI=pad+(availLW-isoW*sIso)/2, oyI=padT+(availH-isoH*sIso)/2;
  const IP=(x,y,z)=>[ oxI+((x-y)*ca-iMnX)*sIso, oyI+((x+y)*sa-z-iMnY)*sIso ];
  const oxP=split+pad+lmx+(availRWp-plW*sPlan)/2, oyP=padT+lmy+(availHPp-plH*sPlan)/2;
  const PP=(x,y)=>[ oxP+(x-pMnX)*sPlan, oyP+(pMxY-y)*sPlan ]; // flip Y so Front (min y) sits at the bottom, like standing inside
  // ================= LEFT · 3D iso =================
  if(floorOn){ ctx.beginPath(); const c0=IP(plan.seg[0].a[0],plan.seg[0].a[1],0); ctx.moveTo(c0[0],c0[1]); for(const s of plan.seg){const b=IP(s.b[0],s.b[1],0);ctx.lineTo(b[0],b[1]);} ctx.closePath(); ctx.fillStyle='rgba(150,170,195,0.07)'; ctx.fill();
    if(quad){ const [FL,FR,BR,BL]=plan.poly, GN=4; for(let i=1;i<GN;i++){ const u=i/GN;
      line(IP(FL[0]+(FR[0]-FL[0])*u,FL[1]+(FR[1]-FL[1])*u,0),IP(BL[0]+(BR[0]-BL[0])*u,BL[1]+(BR[1]-BL[1])*u,0),'rgba(255,255,255,0.05)',1*U);
      line(IP(FL[0]+(BL[0]-FL[0])*u,FL[1]+(BL[1]-FL[1])*u,0),IP(FR[0]+(BR[0]-FR[0])*u,FR[1]+(BR[1]-FR[1])*u,0),'rgba(255,255,255,0.05)',1*U); } }
    ctx.setLineDash([3*U,3*U]); ctx.strokeStyle='rgba(160,180,205,0.28)'; ctx.lineWidth=1*U; ctx.stroke(); ctx.setLineDash([]); }
  { const vp=IP(cX,cY,0); ctx.strokeStyle='rgba(224,224,224,0.6)'; ctx.lineWidth=1.2*U; ctx.beginPath(); ctx.ellipse(vp[0],vp[1],5*U,2.5*U,0,0,7); ctx.stroke(); ctx.fillStyle='rgba(224,224,224,0.9)'; ctx.beginPath(); ctx.arc(vp[0],vp[1],1.5*U,0,7); ctx.fill(); }
  const sorted=plan.seg.map(s=>({s,d:(s.a[0]+s.a[1]+s.b[0]+s.b[1])/2})).sort((A,B)=>A.d-B.d); // far→near
  for(const {s} of sorted){ const a0=IP(s.a[0],s.a[1],0),b0=IP(s.b[0],s.b[1],0),bt=IP(s.b[0],s.b[1],s.h),at=IP(s.a[0],s.a[1],s.h);
    const col=roleCol(s.role), act=(activeRole===s.role), dim=(activeRole&&!act);
    ctx.beginPath(); ctx.moveTo(a0[0],a0[1]); ctx.lineTo(b0[0],b0[1]); ctx.lineTo(bt[0],bt[1]); ctx.lineTo(at[0],at[1]); ctx.closePath(); ctx.fillStyle=hexA(col,act?0.42:dim?0.1:0.22); ctx.fill();
    if(act){ const wq=(u,v)=>{ const bx=a0[0]+(b0[0]-a0[0])*u,by=a0[1]+(b0[1]-a0[1])*u,tx=at[0]+(bt[0]-at[0])*u,ty=at[1]+(bt[1]-at[1])*u; return [bx+(tx-bx)*v,by+(ty-by)*v]; }; // per-wall content grid, only on the lit wall (clean by default)
      for(let i=1;i<ROOM_GRID_COLS;i++) line(wq(i/ROOM_GRID_COLS,0),wq(i/ROOM_GRID_COLS,1),'rgba(255,255,255,0.13)',1*U);
      for(let j=1;j<ROOM_GRID_ROWS;j++) line(wq(0,j/ROOM_GRID_ROWS),wq(1,j/ROOM_GRID_ROWS),'rgba(255,255,255,0.13)',1*U); }
    ctx.strokeStyle=hexA(col,act?1:dim?0.45:0.8); ctx.lineWidth=(act?1.6:1.1)*U; ctx.beginPath(); ctx.moveTo(a0[0],a0[1]); ctx.lineTo(b0[0],b0[1]); ctx.lineTo(bt[0],bt[1]); ctx.lineTo(at[0],at[1]); ctx.closePath(); ctx.stroke();
    const cx=(a0[0]+b0[0]+bt[0]+at[0])/4, cy=(a0[1]+b0[1]+bt[1]+at[1])/4; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle=dim?'rgba(224,224,224,0.45)':'#EDEFF2'; ctx.font=`600 ${9*U}px Geist,system-ui`; ctx.fillText(roomRoleLabel(s.role).toUpperCase(),cx,cy); }
  // ================= RIGHT · to-scale PLAN =================
  { let p0=PP(plan.poly[0][0],plan.poly[0][1]); ctx.beginPath(); ctx.moveTo(p0[0],p0[1]); for(let i=1;i<plan.poly.length;i++){const q=PP(plan.poly[i][0],plan.poly[i][1]);ctx.lineTo(q[0],q[1]);} if(quad)ctx.closePath(); ctx.fillStyle='rgba(150,170,195,0.06)'; ctx.fill(); }
  if(quad){ const [FL,FR,BR,BL]=plan.poly, GN=4; for(let i=1;i<GN;i++){ const u=i/GN;
    line(PP(FL[0]+(FR[0]-FL[0])*u,FL[1]+(FR[1]-FL[1])*u),PP(BL[0]+(BR[0]-BL[0])*u,BL[1]+(BR[1]-BL[1])*u),'rgba(255,255,255,0.05)',1*U);
    line(PP(FL[0]+(BL[0]-FL[0])*u,FL[1]+(BL[1]-FL[1])*u),PP(FR[0]+(BR[0]-FR[0])*u,FR[1]+(BR[1]-FR[1])*u),'rgba(255,255,255,0.05)',1*U); } }
  { const vp=PP(cX,cY); ctx.strokeStyle='rgba(224,224,224,0.55)'; ctx.lineWidth=1.2*U; ctx.beginPath(); ctx.arc(vp[0],vp[1],3*U,0,7); ctx.stroke(); ctx.fillStyle='rgba(224,224,224,0.9)'; ctx.beginPath(); ctx.arc(vp[0],vp[1],1.3*U,0,7); ctx.fill();
    const f=PP(cX, cY-Math.min(plH*0.34,(cY-pMnY)*0.7)||0.001); line(vp,f,'rgba(224,224,224,0.4)',1*U); } // forward tick toward Front
  for(const s of plan.seg){ const A=PP(s.a[0],s.a[1]), B=PP(s.b[0],s.b[1]); const col=roleCol(s.role), act=(activeRole===s.role), dim=(activeRole&&!act);
    line(A,B,hexA(col,act?1:dim?0.4:0.85),(act?3:2)*U);
    const mx=(s.a[0]+s.b[0])/2, my=(s.a[1]+s.b[1])/2; let ox=mx-cX, oy=my-cY; const ol=Math.hypot(ox,oy)||1; const sox=ox/ol, soy=-oy/ol; // outward, world→screen (screen Y is flipped)
    const M=PP(mx,my), off=12*U, lx=M[0]+sox*off, ly=M[1]+soy*off; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle=dim?'rgba(230,232,235,0.4)':'#E6E8EB'; ctx.font=`600 ${8.5*U}px Geist,system-ui`; ctx.fillText(String(wallOf(s.role).wcm), lx, ly-4*U);
    ctx.fillStyle=dim?'rgba(150,150,150,0.4)':hexA(col,0.95); ctx.font=`600 ${7*U}px Geist,system-ui`; ctx.fillText(roomRoleLabel(s.role).toUpperCase(), lx, ly+5*U); }
  // scale bar (metrically exact for the plan): pick the largest round length that fits ~half the panel
  { let m=1; for(const c of [10,5,2,1,0.5,0.2]){ if(c*sPlan<=availRW*0.5){ m=c; break; } } const bp=m*sPlan, bx=split+pad, by=H-pad*0.7;
    line([bx,by],[bx+bp,by],'rgba(200,200,200,0.7)',1.4*U); line([bx,by-3*U],[bx,by+3*U],'rgba(200,200,200,0.7)',1.4*U); line([bx+bp,by-3*U],[bx+bp,by+3*U],'rgba(200,200,200,0.7)',1.4*U);
    ctx.textAlign='left'; ctx.textBaseline='middle'; ctx.fillStyle='rgba(170,170,170,0.9)'; ctx.font=`500 ${7.5*U}px Geist,system-ui`; ctx.fillText((m>=1?m+' m':(m*100)+' cm'), bx+bp+5*U, by); } }
function getRoomPresets(){ try{ return JSON.parse(localStorage.getItem('iseRoomPresets')||'[]'); }catch(e){ return []; } }
function saveRoomPresets(a){ try{ localStorage.setItem('iseRoomPresets',JSON.stringify(a)); }catch(e){} }
/* [F5] the "screen order" canvas: the walls as the summed 2D strip, in order 1..N, each with its resolution + the total width in px */
function drawRoomStrip(cv,walls,floorOn,activeRole){ if(!cv)return; const ctx=cv.getContext('2d'); const W=cv.width,H=cv.height,U=W/1056; ctx.clearRect(0,0,W,H);
  const ordered=[...walls].sort((a,b)=>(a.order||0)-(b.order||0)); if(!ordered.length)return;
  const totalPx=ordered.reduce((s,w)=>s+(+w.pxW||0),0)||1; const maxH=Math.max(...ordered.map(w=>+w.pxH||0),1);
  const pad=12*U, gap=3*U, labelH=30*U, availW=W-pad*2-gap*(ordered.length-1), availH=H-pad-labelH;
  let x=pad;
  ordered.forEach((w,i)=>{ const ww=Math.max(6*U, availW*((+w.pxW||0)/totalPx)); const hh=Math.max(4*U, (availH-6*U)*((+w.pxH||0)/maxH)); const col=ROOM_ROLE_COL[w.role]||'#8892A0'; const act=(w.role===activeRole);
    const y=pad+(availH-hh);
    ctx.fillStyle=hexA(col,act?0.34:0.18); ctx.strokeStyle=act?'#fff':col; ctx.lineWidth=act?1.5:1; ctx.fillRect(x,y,ww,hh); ctx.strokeRect(x+0.5,y+0.5,ww-1,hh-1);
    ctx.fillStyle=col; ctx.font=`700 ${13*U}px Geist`; ctx.textAlign='center'; ctx.textBaseline='middle'; if(ww>14*U)ctx.fillText(String(i+1), x+ww/2, y+hh/2);
    ctx.fillStyle='#C9CDD3'; ctx.font=`${10*U}px Geist`; ctx.textBaseline='alphabetic'; ctx.fillText(roomRoleLabel(w.role), x+ww/2, pad+availH+11*U);
    ctx.fillStyle='#7B828C'; ctx.font=`${9*U}px Geist`; ctx.fillText((+w.pxW||0)+'×'+(+w.pxH||0), x+ww/2, pad+availH+22*U);
    x+=ww+gap; });
  ctx.textAlign='right'; ctx.textBaseline='alphabetic'; ctx.fillStyle='#9AA0A8'; ctx.font=`600 ${10*U}px Geist`;
  ctx.fillText(T('Total','Total')+': '+totalPx+' × '+maxH+' px', W-pad, H-4*U); ctx.textAlign='left'; }
function roomSetupDialog(cb){ const ov=document.createElement('div'); ov.className='overlay'; ov.style.zIndex='320'; ov.style.alignItems='flex-start';
  const defWall=(role,order)=>({role,order,wcm:(role==='Left'||role==='Right')?400:500,hcm:300,pxW:1920,pxH:1080});
  let n=4, floor=true, walls=[defWall('Front',1),defWall('Right',2),defWall('Back',3),defWall('Left',4)];
  const well=(v,kk,mn,mx,unit)=>`<label class="rs-well"><input type="number" class="tnum" data-k="${kk}" value="${v}" min="${mn||1}" max="${mx||99999}">${unit?`<span class="u">${unit}</span>`:''}</label>`;
  let activeRole=null;
  ov.innerHTML=`<div class="modal" style="width:560px;margin-top:56px;"><div class="mh"><span style="color:var(--ink-2);display:flex;">${ICO('ring',16)}</span><span class="t">${T('New 360 room','Nueva sala 360')}</span></div><div class="mb">
    <canvas id="rsIso" class="rs-cv" width="1056" height="440"></canvas>
    <div class="rs-sec" style="margin-top:8px;">${T('Screen order','Orden de pantallas')}<span class="rs-note">${T('the 2D strip, in order · summed resolution','la tira 2D, en orden · resolución sumada')}</span></div>
    <canvas id="rsStrip" width="1056" height="150" style="width:100%;height:75px;display:block;background:var(--s0);border-radius:2px;"></canvas>
    <div class="frow" style="margin-top:12px;"><label>${T('Preset','Preajuste')}</label><select id="rsPreset" style="flex:1;"><option value="">—</option></select><button class="mbtn" id="rsSavePreset" style="height:20px;padding:0 10px;">${T('Save','Guardar')}</button><button class="mbtn" id="rsDelPreset" title="${T('Delete preset','Eliminar preajuste')}" style="height:20px;padding:0 9px;">✕</button></div>
    <div class="frow"><label>${T('Walls','Muros')}</label><div class="kindseg" id="rsN" style="max-width:160px;">${[2,3,4].map(k=>`<button data-n="${k}" class="${k===n?'on':''}">${k}</button>`).join('')}</div>
      <label class="chk" style="display:flex;align-items:center;gap:7px;margin-left:auto;color:var(--ink-2);cursor:pointer;white-space:nowrap;"><input type="checkbox" id="rsFloor" ${floor?'checked':''}> ${T('Add floor','Añadir piso')}</label></div>
    <div class="rs-sec">${T('Walls','Muros')}<span class="rs-note">${T('order = position in the 2D strip','orden = posición en la tira 2D')}</span></div>
    <div class="rs-hdr"><span></span><span style="justify-self:center;">${T('Order','Orden')}</span><span>${T('Wall','Muro')}</span><span>${T('Width','Ancho')}</span><span>${T('Height','Alto')}</span><span>${T('Pixels','Píxeles')}</span></div>
    <div id="rsWalls" style="display:flex;flex-direction:column;gap:3px;"></div>
    <div id="rsFloorRow"></div>
    <div class="rs-sec">${T('Output','Salida')}</div>
    <div class="frow"><label>${T('Frame rate','Cuadros/s')}</label><select id="rsFps" style="max-width:120px;"><option>24</option><option>25</option><option>30</option><option>48</option><option>50</option><option selected>60</option></select><span class="tnum" style="color:var(--ink-dim);">fps</span></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;"><button class="mbtn" id="rsCancel">${T('Cancel','Cancelar')}</button><button class="mbtn pri" id="rsGo">${ICO('ring')} ${T('Create room','Crear sala')}</button></div></div></div>`;
  document.body.appendChild(ov); const close=()=>ov.remove(); ov.querySelector('#rsCancel').onclick=close; ov.addEventListener('pointerdown',e=>{if(e.target===ov)close();});
  const refreshIso=()=>{ try{ drawRoomIso($('#rsIso'),walls,floor,activeRole); }catch(e){} try{ drawRoomStrip($('#rsStrip'),walls,floor,activeRole); }catch(e){} };
  const setActive=(r)=>{ activeRole=r; ov.querySelectorAll('#rsWalls .rs-wall').forEach(x=>x.classList.toggle('act',x.dataset.role===r)); refreshIso(); };
  const drawWalls=()=>{ const host=$('#rsWalls'); host.innerHTML='';
    walls.forEach((w,i)=>{ w.order=i+1; const row=document.createElement('div'); row.className='rs-wall'; row.dataset.i=i; row.dataset.role=w.role; // [F3] Order = the row's position (screen order), fixed
      row.innerHTML=`<span class="rs-dot" style="background:${ROOM_ROLE_COL[w.role]||'#8892A0'};"></span>
        <span class="rs-ordnum">${i+1}</span>
        <select data-k="role" class="sysel rs-role">${ROOM_ROLES.map(r=>`<option value="${r}" ${r===w.role?'selected':''}>${roomRoleLabel(r)}</option>`).join('')}</select>
        ${well(w.wcm,'wcm',1,100000,'cm')}
        ${well(w.hcm,'hcm',1,100000,'cm')}
        <div class="rs-px">${well(w.pxW,'pxW',16,16384)}<span class="x">×</span>${well(w.pxH,'pxH',16,16384)}</div>`;
      row.addEventListener('pointerenter',()=>setActive(walls[i].role));
      row.addEventListener('pointerleave',()=>setActive(null));
      // [F3] Wall roles are unique: picking a role already used elsewhere SWAPS the two walls (dims travel; the fixed Order positions stay), so you always have exactly Front/Right/Back/Left once
      row.querySelector('[data-k=role]').onchange=e=>{ const nr=e.target.value; const j=walls.findIndex((ww,k)=>k!==i&&ww.role===nr);
        if(j>=0){ const t=walls[i]; walls[i]=walls[j]; walls[j]=t; walls[i].order=i+1; walls[j].order=j+1; } else { walls[i].role=nr; }
        drawWalls(); setActive(walls[i].role); };
      row.querySelectorAll('input[data-k]').forEach(inp=>{ inp.addEventListener('focus',()=>setActive(walls[i].role));
        const h=e=>{ walls[i][e.target.dataset.k]=+e.target.value||walls[i][e.target.dataset.k]; refreshIso(); }; inp.onchange=h; inp.oninput=h; });
      host.appendChild(row); }); refreshIso(); };
  const drawFloor=()=>{ const host=$('#rsFloorRow'); if(!floor){ host.innerHTML=''; return; } host.dataset.wcm=host.dataset.wcm||500; host.dataset.dcm=host.dataset.dcm||400; host.dataset.pxW=host.dataset.pxW||1920; host.dataset.pxH=host.dataset.pxH||1080;
    host.innerHTML=`<div class="rs-sec">${T('Floor','Piso')}<span class="rs-note">${T('separate flat sequence · depth spans front-to-back','secuencia plana aparte · el fondo va de frente a fondo')}</span></div>
      <div class="rs-hdr"><span></span><span>${T('Surface','Superficie')}</span><span></span><span>${T('Width','Ancho')}</span><span>${T('Depth','Fondo')}</span><span>${T('Pixels','Píxeles')}</span></div>
      <div class="rs-wall" style="cursor:default;">
        <span class="rs-dot" style="background:#6B7480;box-shadow:none;"></span>
        <span style="display:flex;align-items:center;gap:6px;color:var(--ink-2);font-size:11px;min-width:0;">${ICO('grid',12)} ${T('Floor','Piso')}</span>
        <span></span>
        ${well(+host.dataset.wcm,'fwcm',1,100000,'cm')}
        ${well(+host.dataset.dcm,'fdcm',1,100000,'cm')}
        <div class="rs-px">${well(+host.dataset.pxW,'fpxW',16,16384)}<span class="x">×</span>${well(+host.dataset.pxH,'fpxH',16,16384)}</div>
      </div>`;
    host.querySelectorAll('input[data-k]').forEach(inp=>inp.onchange=e=>{ host.dataset[{fwcm:'wcm',fdcm:'dcm',fpxW:'pxW',fpxH:'pxH'}[e.target.dataset.k]]=+e.target.value||0; }); };
  const setN=k=>{ n=k; ov.querySelectorAll('#rsN button').forEach(b=>b.classList.toggle('on',+b.dataset.n===k));
    const roles=({2:['Left','Front'],3:['Left','Front','Right'],4:['Front','Right','Back','Left']})[k];
    walls=roles.map((r,i)=>{ const ex=walls.find(w=>w.role===r); return ex?{...ex,order:i+1}:defWall(r,i+1); }); drawWalls(); };
  ov.querySelectorAll('#rsN button').forEach(b=>b.onclick=()=>setN(+b.dataset.n));
  $('#rsFloor').onchange=e=>{ floor=e.target.checked; drawFloor(); refreshIso(); };
  // room presets (localStorage, reusable across projects) — save/load the whole wall+floor+fps config by name
  const fillPresets=()=>{ const ps=getRoomPresets(); $('#rsPreset').innerHTML='<option value="">—</option>'+ps.map((p,i)=>`<option value="${i}">${(p.name||'Preset').replace(/</g,'')}</option>`).join(''); };
  fillPresets();
  $('#rsPreset').onchange=()=>{ const p=getRoomPresets()[+$('#rsPreset').value]; if(!p)return; floor=!!p.floor; walls=(p.walls||[]).map(w=>({...w})); n=walls.length; ov.querySelectorAll('#rsN button').forEach(b=>b.classList.toggle('on',+b.dataset.n===n)); $('#rsFloor').checked=floor;
    const h=$('#rsFloorRow'); if(p.floorCfg){ h.dataset.wcm=p.floorCfg.wcm; h.dataset.dcm=p.floorCfg.dcm; h.dataset.pxW=p.floorCfg.pxW; h.dataset.pxH=p.floorCfg.pxH; } if(p.fps){ const fo=[...$('#rsFps').options].find(o=>+o.value===p.fps); if(fo)$('#rsFps').value=p.fps; } drawWalls(); drawFloor(); refreshIso(); };
  $('#rsSavePreset').onclick=()=>{ appPrompt(T('Preset name:','Nombre del preajuste:'),T('My room','Mi sala'),name=>{ if(!name)return; const h=$('#rsFloorRow'); const p={name:name.trim(),floor,walls:walls.map(w=>({...w})),fps:+$('#rsFps').value||60,floorCfg:{wcm:+h.dataset.wcm||500,dcm:+h.dataset.dcm||400,pxW:+h.dataset.pxW||1920,pxH:+h.dataset.pxH||1080}}; const ps=getRoomPresets(); ps.push(p); saveRoomPresets(ps); fillPresets(); $('#rsPreset').value=ps.length-1; flashStatus(T('Room preset saved','Preajuste de sala guardado')); }); };
  $('#rsDelPreset').onclick=()=>{ const i=+$('#rsPreset').value; if($('#rsPreset').value===''||isNaN(i))return; const ps=getRoomPresets(); ps.splice(i,1); saveRoomPresets(ps); fillPresets(); flashStatus(T('Preset deleted','Preajuste eliminado')); };
  drawWalls(); drawFloor(); refreshIso();
  $('#rsGo').onclick=()=>{ const fps=+$('#rsFps').value||60;
    const seen={}; for(const w of walls){ if(seen[w.role]){ flashStatus(T('Two walls share the same role — pick distinct Front/Back/Left/Right','Dos muros tienen el mismo rol — elige Front/Back/Left/Right distintos')); return; } seen[w.role]=1; }
    const cfg={ walls:walls.map(w=>({role:w.role,order:Math.max(1,Math.round(w.order)),wcm:Math.max(1,w.wcm),hcm:Math.max(1,w.hcm),pxW:Math.max(16,Math.round(w.pxW)),pxH:Math.max(16,Math.round(w.pxH))})), fps, floor:null };
    if(floor){ const h=$('#rsFloorRow'); cfg.floor={ wcm:Math.max(1,+h.dataset.wcm||500), dcm:Math.max(1,+h.dataset.dcm||400), pxW:Math.max(16,+h.dataset.pxW||1920), pxH:Math.max(16,+h.dataset.pxH||1080) }; }
    close(); cb(cfg); }; }
function updFmtChip(){ const as=activeSeq(); const fc=$('#fmtChip'); if(fc&&as){ const suf=(fc._codec||'PNG'); const dim=flatLikeMode(as.mode)?((as.w||1920)+'×'+(as.h||1080)):((as.w||4096)+'²'); const pre=(as.mode==='room')?(T('Room','Sala')+' · '):''; const cov=(as.mode!=='flat'&&as.mode!=='room'&&as.cov&&as.cov!==180)?(' · '+as.cov+'°'):''; fc.textContent=pre+dim+cov+' · '+(as.fps||60)+'p · '+suf; } }
/* Re-configure the ACTIVE sequence after creation. Today: dome coverage (FOV) — changing it live re-deforms every clip
   to the new fisheye (state.seqCov drives the warp), so a finished dome film can be retargeted to a 200/210° dome and
   exported without rebuilding it. Reached from the format chip and the sequence-tab menu. */
function openSeqSettings(){ const as=activeSeq(); if(!as)return; const isDome=(as.mode!=='flat'&&as.mode!=='room'); const origCov=as.cov||180;
  const ov=document.createElement('div'); ov.className='overlay'; ov.style.zIndex='320';
  ov.innerHTML=`<div class="modal" style="width:420px;"><div class="mh"><span class="t">${T('Sequence settings','Ajustes de secuencia')}</span></div><div class="mb">
    ${isDome?`<canvas id="ssViz" class="rs-cv" width="776" height="330" style="height:165px;margin-bottom:12px;"></canvas>
    <div class="frow"><label>${T('Resolution','Resolución')}</label><select id="ssRes" style="flex:1;">${(function(){ const opts=[1024,2048,3072,4096,6144,8192]; const cur=as.w||4096; if(!opts.includes(cur))opts.push(cur); opts.sort((a,b)=>a-b); return opts.map(r=>`<option value="${r}" ${r===cur?'selected':''}>${r} × ${r} px</option>`).join(''); })()}</select></div>
    <div class="frow"><label>${T('Coverage','Cobertura')}</label><select id="ssCov">${DOME_COV.map(c=>`<option value="${c}" ${c===origCov?'selected':''}>${c}°${c===180?' · '+T('fulldome','domo completo'):''}</option>`).join('')}</select><span class="tnum" style="color:var(--ink-dim);">FOV</span></div>
    <div style="font-size:11px;color:var(--ink-dim);margin-top:2px;">${T('Resolution is the export size; coverage re-deforms every clip to the new fisheye — both update live.','La resolución es el tamaño de export; la cobertura redeforma cada clip al nuevo ojo de pez — ambas se actualizan en vivo.')}</div>`
    :as.mode==='room'?`<div class="frow"><label>${T('Format','Formato')}</label><span class="tnum" style="color:var(--ink-2);">${T('360 Room','Sala 360')} · ${as.w} × ${as.h} px</span></div>
      <div style="font-size:11px;color:var(--ink-dim);margin-top:2px;">${T('The room resolution comes from the walls (set at creation).','La resolución de la sala viene de los muros (definidos al crear).')}</div>`
    :`<div class="frow"><label>${T('Resolution','Resolución')}</label><input id="ssW" type="number" class="tnum" value="${as.w}" min="128" max="8192" style="width:78px;"><span style="color:var(--ink-dim);">×</span><input id="ssH" type="number" class="tnum" value="${as.h}" min="128" max="8192" style="width:78px;"><span class="tnum" style="color:var(--ink-dim);">px</span></div>
      <div style="font-size:11px;color:var(--ink-dim);margin-top:2px;">${T('Changing the resolution re-adapts the 2D canvas live (clips are placed proportionally).','Cambiar la resolución re-adapta el lienzo 2D en vivo (los clips se colocan proporcionalmente).')}</div>`}
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;"><button class="mbtn pri" id="ssDone">${T('Done','Listo')}</button></div></div></div>`;
  document.body.appendChild(ov); const close=()=>ov.remove(); ov.querySelector('#ssDone').onclick=close; ov.addEventListener('pointerdown',e=>{if(e.target===ov)close();});
  // [F1] resolution is editable and re-adapts live (output/export size; clips are placed proportionally so nothing needs rebuilding)
  const applyRes=(w,h)=>{ w=Math.max(128,Math.min(8192,Math.round(w||as.w))); h=Math.max(128,Math.min(8192,Math.round(h||as.h))); as.w=w; as.h=h; if(as.id===state.activeSeqId){ state.seqW=w; state.seqH=h; } markDirty(); if(_raOn)raInvalidate(); render(); updFmtChip(); };
  { const rs=ov.querySelector('#ssRes'); if(rs)rs.onchange=e=>{ const v=+e.target.value||4096; applyRes(v,v); flashStatus(T('Resolution','Resolución')+': '+v+'²'); };
    const sw=ov.querySelector('#ssW'), sh=ov.querySelector('#ssH'); if(sw&&sh){ const fh=()=>{ applyRes(+sw.value,+sh.value); flashStatus(T('Resolution','Resolución')+': '+as.w+'×'+as.h); }; sw.onchange=fh; sh.onchange=fh; } }
  if(isDome){ const viz=()=>{ try{ drawSeqViz(ov.querySelector('#ssViz'),'dome',{cov:+ov.querySelector('#ssCov').value||180}); }catch(e){} }; viz();
    ov.querySelector('#ssCov').onchange=e=>{ const cov=+e.target.value||180; as.cov=cov; if(as.id===state.activeSeqId)state.seqCov=cov; viz(); markDirty(); if(_raOn)raInvalidate(); render(); updFmtChip(); flashStatus(T('Coverage','Cobertura')+': '+cov+'°'); }; } }
function serSeqRef(){ return { openSeqs:(state.openSeqs||[]).slice(), activeSeqId:state.activeSeqId }; }
/* timeline-header sequence tabs (open sequences, Premiere-style; switch / close / new) */
let _seqDragged=false; // [R3] set on a real tab drag so the trailing click doesn't ALSO switch sequences
/* [R3] drag a sequence tab left/right to reorder #seqTabs (Premiere-style). Horizontal analog of startLaneDrag; reorders state.openSeqs. */
function startSeqTabDrag(e,id){ if(e.button!==0)return; if(e.target.closest('.seqx')||e.target.isContentEditable)return; // ignore close-btn / inline rename
  const bar=$('#seqTabs'); if(!bar)return; const dragTab=bar.querySelector('.seqtab[data-seq="'+id+'"]'); if(!dragTab)return;
  e.preventDefault(); // avoid selecting the label text while dragging (does NOT cancel the click/dblclick that follow)
  const x0=e.clientX,y0=e.clientY; let started=false, dropIdx=0, ind=null, chip=null;
  const order=()=>(state.openSeqs||[]).filter(x=>isSeqMedia(mediaById(x)));
  const tabs=()=>order().map(sid=>bar.querySelector('.seqtab[data-seq="'+sid+'"]')).filter(Boolean);
  const move=ev=>{ if(!started){ if(Math.abs(ev.clientX-x0)<5&&Math.abs(ev.clientY-y0)<5)return; started=true;
      dragTab.style.opacity='0.55'; dragTab.style.outline='1px solid var(--ink-2)'; dragTab.style.outlineOffset='-1px'; document.body.style.cursor='grabbing';
      ind=document.createElement('div'); ind.style.cssText='position:fixed;width:3px;background:var(--ink-2);border-radius:1px;box-shadow:0 0 7px rgba(201,205,211,0.8);z-index:9999;pointer-events:none;'; document.body.appendChild(ind);
      chip=document.createElement('div'); chip.textContent=(mediaById(id)||{}).name||''; chip.style.cssText='position:fixed;z-index:10000;pointer-events:none;font:600 10.5px Geist,sans-serif;color:var(--ink);background:var(--s1);border:.5px solid rgba(201,205,211,0.6);border-radius:2px;padding:2px 7px;box-shadow:0 2px 8px rgba(0,0,0,0.55);white-space:nowrap;'; document.body.appendChild(chip); }
    const ts=tabs(); dropIdx=ts.length; for(let i=0;i<ts.length;i++){ const r=ts[i].getBoundingClientRect(); if(ev.clientX<r.left+r.width/2){ dropIdx=i; break; } }
    const br=bar.getBoundingClientRect(); let ix; if(dropIdx<ts.length){ ix=ts[dropIdx].getBoundingClientRect().left; } else { ix=ts.length?ts[ts.length-1].getBoundingClientRect().right:br.left+4; }
    ind.style.left=(ix-1.5)+'px'; ind.style.top=(br.top+3)+'px'; ind.style.height=Math.max(14,br.height-6)+'px';
    chip.style.left=(ev.clientX+13)+'px'; chip.style.top=(ev.clientY-9)+'px'; };
  const up=()=>{ window.removeEventListener('pointermove',move); window.removeEventListener('pointerup',up); if(ind)ind.remove(); if(chip)chip.remove(); document.body.style.cursor=''; dragTab.style.opacity=''; dragTab.style.outline=''; if(!started)return;
    _seqDragged=true; setTimeout(()=>{_seqDragged=false;},0); // suppress the trailing click's switchSeq
    const cur=order(); const from=cur.indexOf(id); if(from<0)return; cur.splice(from,1); const to=Math.max(0,Math.min(cur.length,dropIdx>from?dropIdx-1:dropIdx)); cur.splice(to,0,id);
    if(cur.every((x,i)=>x===order()[i])){ return; } // no change
    const rest=(state.openSeqs||[]).filter(x=>!isSeqMedia(mediaById(x))); state.openSeqs=cur.concat(rest); // keep any non-seq ids (defensive) at the end
    renderSeqBar(); markDirty(); flashStatus(T('Sequence moved','Secuencia movida')); };
  window.addEventListener('pointermove',move); window.addEventListener('pointerup',up); }
function renderSeqBar(){ const bar=$('#seqTabs'); if(!bar)return; bar.innerHTML='';
  for(const id of (state.openSeqs||[])){ const m=mediaById(id); if(!isSeqMedia(m))continue; const on=(id===state.activeSeqId);
    const t=document.createElement('div'); t.className='seqtab'+(on?' on':''); t.dataset.seq=id; t.title=T('Click to switch · double-click rename · right-click options','Clic para cambiar · doble-clic renombrar · clic-derecho opciones');
    const lab=document.createElement('span'); lab.className='seqlab'; lab.textContent=m.name; t.appendChild(lab);
    const x=document.createElement('span'); x.className='seqx'; x.innerHTML='✕'; x.title=T('Close','Cerrar'); x.onclick=e=>{ e.stopPropagation(); closeSeqTab(id); }; t.appendChild(x);
    t.onpointerdown=e=>startSeqTabDrag(e,id); // [R3] drag to reorder
    t.onclick=e=>{ if(e.target.isContentEditable||_seqDragged)return; switchSeq(id); }; t.ondblclick=()=>renameSequence(id);
    t.oncontextmenu=e=>{ e.preventDefault(); openMenu(e.clientX,e.clientY,[{label:T('Rename','Renombrar'),fn:()=>renameSequence(id)},{label:T('Settings…','Ajustes…'),ico:'gear',fn:()=>{ if(id!==state.activeSeqId)switchSeq(id); openSeqSettings(); }},{label:T('Close tab','Cerrar pestaña'),fn:()=>closeSeqTab(id)},'sep',{label:T('Delete sequence','Eliminar secuencia'),danger:true,fn:()=>deleteSequenceMedia(id)}]); };
    bar.appendChild(t); }
  const add=document.createElement('button'); add.className='seqtab seqadd'; add.textContent='＋'; add.title=T('New sequence','Nueva secuencia'); add.onclick=newSequenceDialog; bar.appendChild(add); }
function serProject(){ saveActiveSeq(); return { app:'DomeStudioPro', v:4, fps:state.fps, lanes:state.lanes, playhead:state.playhead, markers:[], groups:[], clips:[], media:state.media.map(serMedia), workIn:state.workIn, workOut:state.workOut, folders:state.folders, folderColors:state.folderColors||{}, tl:{bpm:state.tl.bpm,sig:state.tl.sig,tcMode:state.tl.tcMode,pxPerSec:state.tl.pxPerSec,inlineCurves:!!state.inlineCurves,audioH:state.tl.audioH||null,snap:!!state.tl.snap,simpleClips:!!state.tl.simpleClips}, exportPresets:state.exportPresets||[], openSeqs:(state.openSeqs||[]).slice(), activeSeqId:state.activeSeqId, seqW:state.seqW, seqH:state.seqH, reactive:state.reactive||null, autoItems:state.autoItems||{} }; } // [R95·D2] the Automation Item library travels with the project (clips reference items by id via kfLink) // v4: the active sequence's clips/markers/groups live in its nest media (serMedia); top-level kept empty to avoid doubling the heaviest data (kf + maskData)
async function saveProject(saveAs){ const json=JSON.stringify(serProject());
  if(IS_ELEC){ let p=currentPath; if(saveAs||!p){ p=await DSP.saveDialog(p||((currentTitle()==='Untitled project'?T('untitled','proyecto'):currentTitle())+'.isp')); if(!p)return; }
    try{ const old=await DSP.readText(p); if(old&&old.length>2)await DSP.writeText(p+'.bak',old); }catch(e){} // rotate a .bak of the previous save — protects against a corrupted/interrupted overwrite
    try{ const ok=await DSP.writeText(p,json); if(ok===false)throw new Error('write returned false'); currentPath=p; state.dirty=false; projTitle(); flashStatus(T('Project saved','Proyecto guardado')); addRecent(p, projThumb()); clearLiveAutosaves(); } // the file is now the newest copy → drop the crash autosaves so a later open never falsely offers "restore a newer autosave"
    catch(e){ appAlert(T('Could not save the project (disk full, locked file, or no permission). Try Save As to another location.','No se pudo guardar el proyecto (disco lleno, archivo bloqueado o sin permiso). Prueba Guardar como en otra ubicación.')); } }
  else { dlBlob(new Blob([json],{type:'application/json'}),(currentTitle()==='Untitled project'?'proyecto':currentTitle())+'.isp'); state.dirty=false; projTitle(); flashStatus(T('Project saved','Proyecto guardado')); } }
function confirmDiscard(){ return new Promise(res=>{ if(!state.dirty){ res(true); return; } appConfirm(T('There are unsaved changes. Continue and discard them?','Hay cambios sin guardar. ¿Continuar y descartarlos?'), res, {ok:T('Discard','Descartar'),danger:true}); }); }
async function openProject(){ if(!(await confirmDiscard()))return;
  if(IS_ELEC){ const p=await DSP.openDialog(); if(!p)return; const txt=await DSP.readText(p); if(txt==null){appAlert(T('Could not read the file.','No se pudo leer el archivo.'));return;} let obj; try{obj=JSON.parse(txt);}catch(e){appAlert(T('Invalid project','Proyecto no válido'));return;} currentPath=p; hideLanding(); loadProject(await maybeOfferAutosave(p,obj)); } // hide the landing FIRST so the recovery prompt (if any) shows on a clean screen, not buried behind the start screen
  else { $('#projInput').click(); } }
async function openProjectPath(p){ if(!p||!IS_ELEC)return; if(!(await confirmDiscard()))return; // open a .rdome handed in by a double-click (file association)
  try{ const txt=await DSP.readText(p); if(txt==null){appAlert(T('Could not read the file.','No se pudo leer el archivo.'));return;} let obj; try{obj=JSON.parse(txt);}catch(e){appAlert(T('Invalid project','Proyecto no válido'));return;} currentPath=p; hideLanding(); loadProject(await maybeOfferAutosave(p,obj)); } // hide the landing FIRST so the recovery prompt shows on a clean screen
  catch(e){ appAlert(T('Could not open the project.','No se pudo abrir el proyecto.')); } }
function disposeMedia(m){ try{ disposeDecoder(m); if(m.srcUrl)URL.revokeObjectURL(m.srcUrl); if(m.proxyUrl)URL.revokeObjectURL(m.proxyUrl); if(m._frameUrls)m._frameUrls.forEach(u=>{try{URL.revokeObjectURL(u);}catch(e){}}); if(m.thumb&&typeof m.thumb==='string'&&m.thumb.indexOf('blob:')===0)URL.revokeObjectURL(m.thumb); if(m.tex)gl.deleteTexture(m.tex); if(m.fbo){try{gl.deleteFramebuffer(m.fbo);}catch(e){}} if(m.nestClips)for(const c of m.nestClips)if(c.maskTex){try{gl.deleteTexture(c.maskTex);}catch(e){}} }catch(e){} }
async function newProject(mode,w,h,fps,cov){ if(!(await confirmDiscard()))return; if(state.playing)pause(); disposeAllVinst();
  for(const c of state.clips){ try{ if(c.maskTex)gl.deleteTexture(c.maskTex); }catch(e){} }
  try{ closeAllNdi(); }catch(e){} for(const m of state.media) disposeMedia(m); for(const id in (state.mediaTrash||{})) disposeMedia(state.mediaTrash[id]); state.mediaTrash={}; clearFrameCache();
  state.media=[]; state.clips=[]; state.groups=[]; state.markers=[]; state.selId=null; state.selGroupId=null; state.selMarkerId=null; state.playhead=0; state.workIn=null; state.workOut=null; state.folders=[]; state.folderColors={}; state.selFolder=null; state.mediaFolder=null; state.selIds=[];
  state.reactive=null; _arCache=null; _fxEnvCache.clear(); try{freeFxResources();}catch(e){}
  state.lanes=defLanes();
  const _fl=(mode==='flat'); state.seqMode=_fl?'flat':'dome'; state.seqW=_fl?(w||1920):4096; state.seqH=_fl?(h||1080):4096; state.seqCov=_fl?180:(cov||180); if(fps)state.fps=fps;
  state.openSeqs=[]; state.activeSeqId=null; ensureSequences();
  clearAllUndo(); currentPath=null; state.dirty=false;
  renderMedia(); renderSeqBar(); renderTimeline(); renderInspector(); render(); updStatus(); projTitle(); updFmtChip(); flashStatus(_fl?T('New 2D project','Nuevo proyecto 2D'):T('New project','Proyecto nuevo')); }
/* R91: create a 360-room project — a 'room' sequence (walls unwrapped into a strip) + an optional 'flat' floor sequence, linked by room.floorSeqId. */
async function newRoomProject(cfg){ if(!(await confirmDiscard()))return; if(state.playing)pause(); disposeAllVinst();
  for(const c of state.clips){ try{ if(c.maskTex)gl.deleteTexture(c.maskTex); }catch(e){} }
  try{ closeAllNdi(); }catch(e){} for(const m of state.media) disposeMedia(m); for(const id in (state.mediaTrash||{})) disposeMedia(state.mediaTrash[id]); state.mediaTrash={}; clearFrameCache();
  state.media=[]; state.clips=[]; state.groups=[]; state.markers=[]; state.selId=null; state.selGroupId=null; state.selMarkerId=null; state.playhead=0; state.workIn=null; state.workOut=null; state.folders=[]; state.folderColors={}; state.selFolder=null; state.mediaFolder=null; state.selIds=[];
  state.reactive=null; _arCache=null; _fxEnvCache.clear(); try{freeFxResources();}catch(e){}
  state.lanes=defLanes(); if(cfg.fps)state.fps=cfg.fps;
  const walls=cfg.walls.map(w=>({id:uid(),...w})).sort((a,b)=>a.order-b.order); // strip order = the 2D "order" number
  // R91b: the flat strip is laid out by NATIVE PIXELS per wall — the 2D editor is exact pixelage, not physical size. Each wall keeps its own pxW×pxH buffer; the cm (wcm/hcm) are geometry-only, consumed by the 3D viewer to place walls (angles fall out of the dimensions, not forced 90°) and to stretch each wall's pixels onto its real quad.
  const stripH=Math.max(16,Math.max(...walls.map(w=>w.pxH)));
  let x=0; for(const w of walls){ w.x0=Math.round(x); w.x1=Math.round(x)+w.pxW; x=w.x1; } const stripW=Math.max(16,Math.round(x));
  const room={ walls, floorSeqId:null, floor:cfg.floor||null };
  const wseq=newSeqMedia(T('Walls','Muros'),state.fps,stripW,stripH,null,null,'room'); wseq.room=room; state.media.push(wseq);
  if(cfg.floor){ const fseq=newSeqMedia(T('Floor','Piso'),state.fps,cfg.floor.pxW,cfg.floor.pxH,null,null,'flat'); fseq.roomFloorOf=wseq.id; room.floorSeqId=fseq.id; state.media.push(fseq); }
  state.seqMode='room'; state.seqW=stripW; state.seqH=stripH;
  state.openSeqs=state.media.filter(isSeqMedia).map(s=>s.id); state.activeSeqId=wseq.id; loadSeqIntoState(wseq);
  clearAllUndo(); currentPath=null; state.dirty=false;
  renderMedia(); renderSeqBar(); renderTimeline(); renderInspector(); render(); updStatus(); projTitle(); updFmtChip();
  flashStatus(T('New 360 room','Nueva sala 360')+' · '+walls.length+' '+T('walls','muros')+(cfg.floor?' + '+T('floor','piso'):'')); }
function rebuildMaskTex(c){ if(c&&c.penMasks&&c.penMasks.length){ rasterizePenMasks(c); return; } if(!c||!c.maskData)return; const im=new Image(); im.onload=()=>{ if(!c.maskTex)c.maskTex=newTex(); upTex(c.maskTex,im); render(); }; im.src=c.maskData; }
/* [I3] pen (point) masks — a per-clip list of polygons (points in 0..1), each with feather + invert. Rasterised (union)
   to c.maskTex via a 2D canvas and rendered through the existing custom-mask sampler (u_mask=5). Independent of the
   shape/PNG mask. penExpand scales every point around the centre (works in dome AND flat; baked into the raster). */
function penMaskActive(c){ return !!(c&&Array.isArray(c.penMasks)&&c.penMasks.some(mk=>mk&&mk.on!==false&&Array.isArray(mk.pts)&&mk.pts.length>=3)); }
function rasterizePenMasks(c){ if(!c)return;
  if(!penMaskActive(c)){ if(c.props&&c.props.mask==='pen')c.props.mask='none'; return; }
  const S=512; let cv=c._penCv; if(!cv){ cv=c._penCv=document.createElement('canvas'); cv.width=cv.height=S; }
  const x=cv.getContext('2d'); x.clearRect(0,0,S,S);
  let sc=rasterizePenMasks._sc; if(!sc){ sc=rasterizePenMasks._sc=document.createElement('canvas'); sc.width=sc.height=S; }
  const sx=sc.getContext('2d'); const ex=Math.max(0.05,c.penExpand||1); // expand: scale points around the centre
  x.globalCompositeOperation='lighten'; // union of all masks (max of the white channel)
  for(const mk of c.penMasks){ if(!mk||mk.on===false||!Array.isArray(mk.pts)||mk.pts.length<3)continue;
    sx.setTransform(1,0,0,1,0,0); sx.clearRect(0,0,S,S); sx.globalCompositeOperation='source-over';
    const fe=Math.max(0,Math.min(1,(mk.feather||0)/100))*S*0.5; // feather radius (px)
    sx.beginPath(); mk.pts.forEach((p,i)=>{ const px=(0.5+(p[0]-0.5)*ex)*S, py=(0.5+(p[1]-0.5)*ex)*S; if(i===0)sx.moveTo(px,py); else sx.lineTo(px,py); }); sx.closePath();
    sx.fillStyle='#fff'; if(fe>0.5){ sx.shadowColor='#fff'; sx.shadowBlur=fe; } sx.fill(); sx.shadowBlur=0;
    if(mk.invert){ sx.globalCompositeOperation='source-out'; sx.fillStyle='#fff'; sx.fillRect(0,0,S,S); sx.globalCompositeOperation='source-over'; } // invert = white where the polygon ISN'T (feathered edge preserved)
    x.drawImage(sc,0,0);
  }
  x.globalCompositeOperation='source-over';
  if(!c.maskTex)c.maskTex=newTex(); upTex(c.maskTex,cv); c.props.mask='pen'; }
function loadProject(obj){ try{ showLoadingScreen(T('Loading project…','Cargando proyecto…')); }catch(e){} // [U9] logo-loop loading screen while the project + its proxies buffer
  if(state.playing)pause(); disposeAllVinst(); try{freeFxResources();}catch(e){} for(const _tid in (state.mediaTrash||{})) disposeMedia(state.mediaTrash[_tid]); state.mediaTrash={}; // free deleted-media textures + FX history from the previous project
  clearAllUndo(); // [R92-T1 C2] undo history belongs to the PREVIOUS project — Ctrl+Z after opening must never inject its clips here (newProject already did this; loadProject didn't)
  state.fps=obj.fps||60; state.lanes=obj.lanes||state.lanes; state.clips=(obj.clips||[]).map(c=>({...c,kf:c.kf||{},maskTex:null})); state.playhead=obj.playhead||0; state.markers=obj.markers||[]; state.selMarkerId=null; state.groups=obj.groups||[]; state.selGroupId=null;
  // restore custom PNG masks from their persisted dataURL (or drop a stale 'custom' that has no data)
  for(const c of state.clips){ if((c.penMasks&&c.penMasks.length)||c.maskData)rebuildMaskTex(c); else if(c.props&&(c.props.mask==='custom'||c.props.mask==='pen'))c.props.mask='none'; }
  state.media=(obj.media||[]).map(md=>({...md,el:null,originalEl:null,tex:null,buffer:null,missing:true,_loading:true,proxyReady:false,proxyPct:0})); // _loading: file exists but is still decoding → show "loading", NOT "missing" (esp. audio, which decodes slowly)
  try{ closeAllNdi(); }catch(e){} // drop any NDI receivers from the previous project
  for(const m of state.media){ if(m.kind==='text'){ renderTextMedia(m); m.missing=false; } else if(m.kind==='shape'){ renderShapeMedia(m); m.missing=false; } else if(m.kind==='ndi'){ m.tex=newTex(); try{ upTexRaw(m.tex,16,16,new Uint8Array(16*16*4).fill(24)); }catch(e){} m.w=m.w||16; m.h=m.h||16; m.dur=m.dur||60; m._ndiLive=false; m._thumbT=0; m.missing=false; try{ if(m.ndiSource&&DSP&&DSP.ndi)DSP.ndi.recvOpen(m.ndiSource); }catch(e){} ndiStartPump(); } else if(m.kind==='nest'){ m.nestClips=(m.nestClips||[]).map(c=>({...c,maskTex:null,kf:c.kf||{}})); for(const c of m.nestClips)if(c.maskData)rebuildMaskTex(c); m.nestLanes=(m.nestLanes&&m.nestLanes.length)?m.nestLanes:defLanes(); m.nestMarkers=m.nestMarkers||[]; m.nestGroups=m.nestGroups||[]; m.fbo=null; m.tex=null; m.w=m.w||4096; m.h=m.h||4096; m.fps=m.fps||obj.fps||60; m.missing=false; } } // text/shape re-render from params; nest = a sequence (keeps its own w/h/fps)
  for(const m of state.media)if(m.missing===false)m._loading=false; // text/shape/ndi/nest are ready synchronously → not loading
  let mx=0; const fxMx=c=>{ if(c&&c.fx)for(const f of c.fx)mx=Math.max(mx,f.id||0); }; for(const c of state.clips){mx=Math.max(mx,c.id);fxMx(c);} for(const l of state.lanes)mx=Math.max(mx,l.id); for(const m of state.media){ mx=Math.max(mx,m.id); if(m.nestClips)for(const c of m.nestClips){mx=Math.max(mx,c.id);fxMx(c);} if(m.nestLanes)for(const l of m.nestLanes)mx=Math.max(mx,l.id); if(m.nestMarkers)for(const k of m.nestMarkers)mx=Math.max(mx,k.id); if(m.nestGroups)for(const g of m.nestGroups)mx=Math.max(mx,g.id); if(m.comp&&m.comp.id)mx=Math.max(mx,m.comp.id); } for(const g of (state.groups||[]))mx=Math.max(mx,g.id); for(const k of state.markers)mx=Math.max(mx,k.id); _id=mx+1;
  state.selId=null; state.dirty=false;
  state.autoItems=(obj.autoItems&&typeof obj.autoItems==='object')?obj.autoItems:{}; // [R95·D2]
  state.workIn=(obj.workIn!=null?obj.workIn:null); state.workOut=(obj.workOut!=null?obj.workOut:null); state.folders=Array.isArray(obj.folders)?obj.folders:[]; state.folderColors=(obj.folderColors&&typeof obj.folderColors==='object')?obj.folderColors:{}; state.exportPresets=Array.isArray(obj.exportPresets)?obj.exportPresets:[];
  state.reactive=obj.reactive||null; _arCache=null; _fxEnvCache.clear(); // Reactive FX config (source clip + sensitivity) — bands re-analyzed lazily when the panel opens
  if(obj.tl){ if(obj.tl.bpm)state.tl.bpm=obj.tl.bpm; if(obj.tl.sig)state.tl.sig=obj.tl.sig; if(obj.tl.tcMode)state.tl.tcMode=obj.tl.tcMode; if(obj.tl.pxPerSec)state.tl.pxPerSec=obj.tl.pxPerSec;
    state.tl.audioCollapsed=!!obj.tl.audioCollapsed; state.tl._audioScroll=0; // [R110] the audio module reopens collapsed if it was saved collapsed
    state.tl.snap=!!obj.tl.snap; { const sb=$('#snapBtn'); if(sb)sb.classList.toggle('on',state.tl.snap); } // [R94c] snap to grid + simple-clip view reopen as saved (both default off)
    state.tl.simpleClips=(obj.tl.simpleClips!=null)?!!obj.tl.simpleClips:true; syncSimpleUI(); // [R94f] projects saved before the flag existed open in Simple (the new default)
    state.inlineCurves=!!obj.tl.inlineCurves; const cb=$('#curvesBtn'); if(cb)cb.classList.toggle('on',state.inlineCurves); syncAutoUI(); } // [R92-T4] the automation view (and each track's lane layout, in lanes[]._auto) reopens as saved · [R94-UT2·U-05/U-09] legend + grab-band state restored too
  state.seqW=obj.seqW||4096; state.seqH=obj.seqH||4096;
  // SEQUENCES (unified: sequences are nest media). v4: openSeqs/activeSeqId. Back-compat: v3 obj.sequences[] → convert; v≤2 single timeline → one sequence.
  if(Array.isArray(obj.openSeqs)&&state.media.some(isSeqMedia)){
    state.openSeqs=obj.openSeqs.filter(id=>isSeqMedia(mediaById(id)));
    if(!state.openSeqs.length)state.openSeqs=[state.media.filter(isSeqMedia)[0].id];
    state.activeSeqId=(obj.activeSeqId&&isSeqMedia(mediaById(obj.activeSeqId)))?obj.activeSeqId:state.openSeqs[0]; loadSeqIntoState(activeSeq());
  } else if(Array.isArray(obj.sequences)&&obj.sequences.length){ const ids=[]; let mx2=_id-1;
    for(const sq of obj.sequences){ const m=newSeqMedia(sq.name||'Sequence',obj.fps||60,obj.seqW||4096,obj.seqH||4096,(sq.clips||[]).map(c=>({...c,kf:c.kf||{},maskTex:null})),sq.lanes||defLanes());
      if(sq.id)m.id=sq.id; m.nestMarkers=sq.markers||[]; m.nestGroups=sq.groups||[]; m.nestPlayhead=sq.playhead||0; m.nestWorkIn=sq.workIn??null; m.nestWorkOut=sq.workOut??null;
      for(const c of m.nestClips){ if((c.penMasks&&c.penMasks.length)||c.maskData)rebuildMaskTex(c); else if(c.props&&(c.props.mask==='custom'||c.props.mask==='pen'))c.props.mask='none'; mx2=Math.max(mx2,c.id); if(c.fx)for(const f of c.fx)mx2=Math.max(mx2,f.id||0); } for(const l of m.nestLanes)mx2=Math.max(mx2,l.id); mx2=Math.max(mx2,m.id);
      state.media.push(m); ids.push(m.id); }
    _id=mx2+1; state.openSeqs=ids; state.activeSeqId=(obj.activeSeqId&&ids.includes(obj.activeSeqId))?obj.activeSeqId:ids[0]; loadSeqIntoState(activeSeq());
  } else { state.openSeqs=[]; state.activeSeqId=null; ensureSequences(); }
  renderSeqBar(); updFmtChip();
  renderWork();
  if(IS_ELEC){ for(const m of state.media) reloadMedia(m); }
  renderMedia(); renderTimeline(); renderInspector(); render(); updRelink(); updStatus(); projTitle(); try{preloadLUTs();}catch(e){} flashStatus(T('Project loaded','Proyecto cargado'));
  hideLanding(); if(currentPath)addRecent(currentPath, projThumb());
  try{ loadingWaitMedia(Date.now()+20000); }catch(e){ hideLoadingScreen(); } } // [U9] keep the loading screen until media/proxies finish buffering (or a 20 s deadline)
async function reloadMedia(m){
  if(m.kind==='adjust'){ m.missing=false; m._loading=false; return; } // adjustment layer template — no file
  if(m.kind==='ndi'){ m.missing=false; m._loading=false; return; } // live NDI input — no file to relink
  if(m.kind==='sequence'){ if(!m.framePaths||!m.framePaths.length){ m.missing=true; m._loading=false; renderMedia(); updRelink(); return; }
    const total=m.framePaths.length, frames=new Array(total); m.tex=m.tex||newTex(); m._curFrame=-1; let loaded=0;
    m.framePaths.forEach((fp,i)=>{ if(!fp){ if(++loaded===total){ m._loading=false; renderMedia(); } return; } const img=new Image(); img.onload=()=>{ const fit=fitImage(img); frames[i]=fit.src; if(i===0){ m.w=fit.w; m.h=fit.h; upTex(m.tex,fit.src); m._curFrame=0; m.thumb=DSP.toFileURL(fp); m.missing=false; } if(++loaded===total){ m.missing=false; m._loading=false; renderMedia(); render(); } }; img.onerror=()=>{ if(++loaded===total){ m._loading=false; renderMedia(); } }; img.src=DSP.toFileURL(fp); });
    m.frames=frames; return; }
  if(!m.path){ m._loading=false; return; } let ok=true; try{ ok=await DSP.exists(m.path); }catch(e){ ok=false; } if(!ok){ m.missing=true; m._loading=false; renderMedia(); updRelink(); return; }
  const url=DSP.toFileURL(m.path);
  if(m.kind==='image'){ const img=new Image(); img.onload=()=>{ const fit=fitImage(img); m.el=fit.src;m.originalEl=img;m.tex=newTex();upTex(m.tex,fit.src);m.w=fit.w;m.h=fit.h;m.missing=false;m._loading=false;m.thumb=url;renderMedia();render(); }; img.onerror=()=>{ m.missing=true;m._loading=false;renderMedia();updRelink(); }; img.src=url; }
  else if(m.kind==='video'){ const v=document.createElement('video'); v.src=url;v.muted=true;v.playsInline=true;v.preload='auto';
    v.addEventListener('loadedmetadata',()=>{ m.el=v;m.originalEl=v;m.srcUrl=url;m.tex=newTex();m.w=v.videoWidth;m.h=v.videoHeight;m.missing=false;m._loading=false;
      detectFps(v,m,()=>{ seekMedia(m,0,true).then(()=>{makeThumb(m);render();}); }); renderMedia();
      delete m._noAudio; // fresh silent-probe after relink/replace
      if(!m.proxyReady){ attachExistingProxy(m,true); } // [R92-T6 / R107] re-bind an existing on-disk proxy on reopen (exact hash OR sibling by basename); a corrupt/stale one is deleted with a status note. Generation stays MANUAL.
      },{once:true}); // proxies MANUAL (right-click → Generate proxy); existing ones re-attach automatically
    v.addEventListener('error',()=>{ m.missing=true;m._loading=false;renderMedia();updRelink(); },{once:true}); }
  else if(m.kind==='audio'){ fetch(url).then(r=>r.arrayBuffer()).then(b=>ACTX().decodeAudioData(b)).then(async ab=>{ m.buffer=ab; const wv=await computeWave(ab); m.peaks=wv.peak; m.rms=wv.rms; m.dur=ab.duration;m.missing=false;m._loading=false;m.thumb=waveThumb(m.peaks,108,64);renderMedia(); if(state.playing)startAudio(); }).catch(()=>{ m.missing=true;m._loading=false;renderMedia();updRelink(); }); } } // reschedule if the audio decoded after Play started (a long film track can finish decoding a beat after load → was silent until re-play)
/* Replace media (offline→online workflow): swap this media's FILE for another of the same kind. Clips
   reference media by id, so every cut/keyframe/fx survives; proxy/bands/thumb reset and rebuild (the new
   file's proxy is picked from its own cache if it exists). If the new file is shorter, clips past its end
   hold the last frame — trim manually. */
async function replaceMedia(m){ if(!IS_ELEC)return;
  const p=await DSP.pickMedia(); if(!p)return;
  const ext=(p.split('.').pop()||'').toLowerCase();
  const kind=/^(mp4|mov|webm|mkv|avi)$/.test(ext)?'video':/^(wav|mp3|ogg|flac|aac|m4a)$/.test(ext)?'audio':/^(png|jpe?g|webp|gif|bmp)$/.test(ext)?'image':null;
  if(kind!==m.kind){ appAlert(T('Pick a file of the same type as the original.','Elige un archivo del mismo tipo que el original.')); return; }
  pushUndo(); const oldDur=m.dur;
  let sz=0; try{ const st=await DSP.stat(p); sz=(st&&st.size)||0; }catch(e){}
  m.path=p; m.fsize=sz; m.name=DSP.basename(p); m.missing=false;
  m.proxyReady=false; m.proxyPct=0; m.proxyUrl=null; m.proxyEl=null; m._proxyForce=false; m.bands=null; m._bandsBusy=false; m.thumb=null; m._texW=null; m._texH=null; m.peaks=null; m.rms=null; m.buffer=null;
  try{ disposeAllVinst(); }catch(e){} try{ if(_arCache)arRecompute(); }catch(e){}
  await reloadMedia(m); renderMedia(); renderTimeline(); renderInspector(); render(); markDirty();
  flashStatus(T('Media replaced — all clips keep their edits','Medio reemplazado — todos los clips conservan su edición')); }
function adopt(m){ // relink a re-imported file to a missing slot — prefer an exact name+size match, fall back to name-only
  let i=state.media.findIndex(x=>x.missing&&x.kind===m.kind&&x.name===m.name&&x.fsize&&m.fsize&&x.fsize===m.fsize&&x.id!==m.id);
  if(i<0)i=state.media.findIndex(x=>x.missing&&x.kind===m.kind&&x.name===m.name&&x.id!==m.id);
  if(i>=0){m.id=state.media[i].id;state.media.splice(i,1);renderTimeline();renderInspector();} updRelink(); }
let saveVer=1;
function saveIncremental(){ saveVer++; const json=JSON.stringify(serProject()); const name=(currentTitle()==='Untitled project'?'proyecto':currentTitle())+'_v'+String(saveVer).padStart(2,'0')+'.isp';
  if(IS_ELEC&&currentPath){ DSP.saveDialog(name).then(p=>{ if(p){DSP.writeText(p,json);flashStatus(T('Saved v','Guardado v')+saveVer);} }); }
  else { dlBlob(new Blob([json],{type:'application/json'}),name); flashStatus(T('Saved v','Guardado v')+saveVer); } }
async function restoreAutosave(){ if(!(await confirmDiscard()))return;
  if(IS_ELEC){ // disk candidates, newest first: project-local autosave folder + LEGACY sidecar next to the project + the unsaved-project pair
    const bases=[]; { const b=autosaveBase(); if(b)bases.push(b); } if(currentPath)bases.push(currentPath); if(_asDir){ bases.push(_asDir+'\\unsaved.isp'); bases.push(_asDir+'\\unsaved.ise'); bases.push(_asDir+'\\unsaved.rdome'); }
    const withT=[]; for(const b of bases)for(const s of ['.autosave1','.autosave2']){ try{ const st=await DSP.stat(b+s); if(st&&st.size>2)withT.push({p:b+s,t:st.mtimeMs||0}); }catch(e){} }
    withT.sort((x,y)=>y.t-x.t);
    for(const c of withT){ try{ const txt=await DSP.readText(c.p); if(!txt)continue; loadProject(JSON.parse(txt)); flashStatus(T('Autosave restored','Autoguardado restaurado')); return; }catch(e){} } } // unparseable (torn write) → try the next-newest copy
  try{ const s=localStorage.getItem('domeProPro'); if(!s){flashStatus(T('No autosave found','No se encontró autoguardado'));return;} loadProject(JSON.parse(s)); flashStatus(T('Autosave restored','Autoguardado restaurado')); }catch(e){appAlert(T('Could not restore.','No se pudo restaurar.'));} }
/* opening a project whose autosave on disk is NEWER than the file itself (crash without manual save) → offer recovery */
async function maybeOfferAutosave(p,obj){ try{ const stP=await DSP.stat(p); let best=null;
    const i=Math.max(p.lastIndexOf('\\'),p.lastIndexOf('/')); const cands=[]; if(i>=0)cands.push(p.slice(0,i)+'\\autosave\\'+p.slice(i+1)); cands.push(p); // project-local autosave folder + LEGACY sidecar
    for(const bp of cands)for(const s of ['.autosave1','.autosave2']){ try{ const st=await DSP.stat(bp+s); if(st&&st.size>2&&(!best||(st.mtimeMs||0)>best.t))best={p:bp+s,t:st.mtimeMs||0}; }catch(e){} }
    if(best&&stP&&best.t>(stP.mtimeMs||0)+2000){
      const yes=await new Promise(r=>appConfirm(T('An autosave newer than this file exists (possible crash). Restore it?','Existe un autoguardado más reciente que este archivo (posible cierre inesperado). ¿Restaurarlo?'),r,{ok:T('Restore autosave','Restaurar autoguardado'),cancel:T('Open the file','Abrir el archivo')}));
      if(yes){ const txt=await DSP.readText(best.p); if(txt)return JSON.parse(txt); } } }catch(e){}
  return obj; }
/* Recovery history (R82c): browse the last hour of autosave snapshots + the two live crash files; open any
   one as a NEW project (currentPath cleared → re-saving asks for a fresh name, so the current work is safe). */
function _agoStr(ms){ const s=Math.max(0,Math.round(ms/1000)); if(s<60)return T('just now','recién'); const m=Math.round(s/60); if(m<60)return T('','hace ')+m+' '+T('min ago','min'); return T('','hace ')+Math.round(m/60)+' h'; }
async function openRecoveryHistory(){ if(!IS_ELEC||!DSP.listDir){ restoreAutosave(); return; }
  const dir=projAutosaveDir(); const bn=autosaveBaseName(); const now=Date.now(); let entries=[];
  try{ const files=await DSP.listDir(dir); for(const f of files){ if(f.name.indexOf(bn+'.')!==0)continue; const isSnap=/\.snap$/.test(f.name), isCrash=/\.autosave[12]$/.test(f.name); if(!isSnap&&!isCrash)continue; if((f.size||0)<=2)continue; entries.push({p:dir+'\\'+f.name, t:f.mtimeMs||0, crash:isCrash}); } }catch(e){}
  entries.sort((x,y)=>y.t-x.t);
  const ov=document.createElement('div'); ov.className='overlay';
  const rows = entries.length ? entries.map((e,i)=>`<button class="rhrow" data-i="${i}" style="display:flex;align-items:center;gap:12px;width:100%;text-align:left;padding:8px 10px;border:none;border-bottom:.5px solid rgba(255,255,255,0.06);background:${i%2?'transparent':'rgba(255,255,255,0.02)'};color:var(--ink);cursor:pointer;font-size:11px;">
      <span style="color:var(--ink-2);flex:1;min-width:0;">${new Date(e.t).toLocaleTimeString()}<span style="color:var(--ink-dim);"> · ${_agoStr(now-e.t)}</span></span>
      <span style="font-size:11px;color:var(--ink-dim);">${e.crash?T('live','en vivo'):T('snapshot','snapshot')}</span></button>`).join('')
    : `<div style="padding:20px;color:var(--ink-dim);font-size:11px;text-align:center;">${T('No recovery snapshots yet — they build up as you work.','Aún no hay snapshots de recuperación — se acumulan mientras trabajas.')}</div>`;
  ov.innerHTML=`<div class="modal" style="width:440px;"><div class="mh"><span style="color:var(--ink-2);display:flex;">${ICO('undo',16)}</span><span class="t">${T('Recovery history','Historial de recuperación')}</span></div><div class="mb">
    <div style="font-size:11px;color:var(--ink-dim);padding:0 2px 8px;line-height:1.5;">${T('Autosaves from the last hour. Opening one loads it as a NEW project — your current work stays untouched until you save.','Autoguardados de la última hora. Al abrir uno se carga como proyecto NUEVO — tu trabajo actual queda intacto hasta que guardes.')}</div>
    <div style="max-height:340px;overflow-y:auto;border:.5px solid rgba(255,255,255,0.08);border-radius:2px;">${rows}</div>
    <div style="display:flex;justify-content:flex-end;margin-top:11px;"><button class="mbtn" id="rhClose">${T('Close','Cerrar')}</button></div></div></div>`;
  document.body.appendChild(ov); const close=()=>ov.remove(); $('#rhClose').onclick=close; ov.addEventListener('pointerdown', e=>{if(e.target===ov)close();});
  ov.querySelectorAll('.rhrow').forEach(b=>b.onclick=async()=>{ const e=entries[+b.dataset.i]; close(); if(!(await confirmDiscard()))return;
    try{ const txt=await DSP.readText(e.p); if(!txt){appAlert(T('Could not read that snapshot.','No se pudo leer ese snapshot.'));return;} const obj=JSON.parse(txt); currentPath=null; loadProject(obj); state.dirty=true; projTitle(); flashStatus(T('Recovery snapshot opened as a new project — Save to keep it','Snapshot de recuperación abierto como proyecto nuevo — Guarda para conservarlo')); }
    catch(err){ appAlert(T('That snapshot is corrupt.','Ese snapshot está dañado.')); } }); }
function updRelink(){ const miss=state.media.filter(m=>m.missing&&!m._loading); if(miss.length)flashStatus(T('Missing media: ','Medios ausentes: ')+miss.map(m=>m.name).join(', '),'err'); } // only GENUINE failures — a file that's still decoding is "loading", not missing · [R94-UT3·U-21]

/* ===================== UNDO / AUTOSAVE / STATUS ===================== */
/* [R92-T1] undo/redo PER SEQUENCE — switching tabs (or exporting another sequence, which switches internally)
   no longer destroys the history. Snapshots only capture the active sequence, so each sequence keeps its own stacks. */
const _undoBySeq={}; const UNDO_BYTE_CAP=250e6; // large-project guard: 80 snapshots of a feature-film timeline could be hundreds of MB
function _ustk(){ const id=state.activeSeqId!=null?state.activeSeqId:'_'; return _undoBySeq[id]||(_undoBySeq[id]={u:[],r:[],bytes:0}); }
function clearAllUndo(){ for(const k in _undoBySeq)delete _undoBySeq[k]; }
function snapshot(){ return JSON.stringify({clips:state.clips.map(serClip),lanes:state.lanes,selId:state.selId,selIds:state.selIds,selLane:state.selLane,markers:state.markers,selMarkerId:state.selMarkerId,groups:state.groups,selGroupId:state.selGroupId,reactive:state.reactive||null,autoItems:state.autoItems||{}}); } // [R95·D2] items are undoable state too: editing a pooled curve rewrites the item
function pushUndo(){ const st=_ustk(); const s=snapshot(); st.u.push(s); st.bytes+=s.length; st.r.length=0;
  let total=0,count=0; for(const k in _undoBySeq){ total+=_undoBySeq[k].bytes; count+=_undoBySeq[k].u.length; }
  while(count>80||(total>UNDO_BYTE_CAP&&count>8)){ let bk=null; for(const k in _undoBySeq)if(_undoBySeq[k].u.length&&(bk==null||_undoBySeq[k].bytes>_undoBySeq[bk].bytes))bk=k; if(bk==null)break; const d=_undoBySeq[bk].u.shift(); _undoBySeq[bk].bytes-=d.length; total-=d.length; count--; } // evict oldest from the heaviest sequence — caps are global across all stacks
  markDirty(); }
function restore(s){ const o=JSON.parse(s); state.clips=o.clips.map(c=>({...c,maskTex:null})); state.lanes=o.lanes; state.autoSel=null; state.hoverAuto=null; state.shapeBox=null; /* [R95·B1] the box holds live keyframe refs — undo/sequence switch replaces those objects, so it must go with them */ state.selId=o.selId; state.selIds=Array.isArray(o.selIds)?o.selIds:(o.selId!=null?[o.selId]:[]); state.selLane=o.selLane??null; if(o.markers)state.markers=o.markers; state.selMarkerId=o.selMarkerId??null; state.groups=o.groups||[]; state.selGroupId=o.selGroupId??null; if(o.reactive!==undefined){state.reactive=o.reactive;} if(o.autoItems!==undefined)state.autoItems=o.autoItems; /* [R95·D2] */ _arCache=null; _fxEnvCache.clear(); for(const c of state.clips)if(c.maskData||(c.penMasks&&c.penMasks.length))rebuildMaskTex(c);
  if(state.mediaTrash){ const need=new Set(); for(const s of state.media)if(isSeqMedia(s)){ const arr=(s.id===state.activeSeqId?state.clips:s.nestClips)||[]; for(const c of arr)need.add(c.mediaId); } for(const c of state.clips)need.add(c.mediaId); for(const id in state.mediaTrash){ if(need.has(+id)){ if(!mediaById(+id)){ const tm=state.mediaTrash[id]; state.media.push(tm); if(tm._trashed){ delete tm._trashed; tm.missing=false; tm._loading=true; try{ reloadMedia(tm); }catch(e){} } } delete state.mediaTrash[id]; } } renderMedia(); }
  saveActiveSeq(); markDirty(); // re-heal the state.clips ⇄ activeSeq().nestClips alias (stale nestClips broke seqDur/seqReaches after undo) + an undone edit IS an unsaved change
  renderTimeline();renderInspector();render();updStatus(); reschedAudio(); }
function undo(){ const st=_ustk(); if(!st.u.length)return; st.r.push(snapshot()); const s=st.u.pop(); st.bytes-=s.length; restore(s); }
function redo(){ const st=_ustk(); if(!st.r.length)return; const s=snapshot(); st.u.push(s); st.bytes+=s.length; restore(st.r.pop()); }
let flashT=0;
function flashStatus(msg,kind){ diag('info','status',msg); const a=$('#statAuto'); a.textContent=msg; a.style.color=(kind==='err')?'#E5B567':''; clearTimeout(flashT); flashT=setTimeout(()=>{ a.textContent=state.lastSaved?(T('Autosaved ','Autoguardado ')+state.lastSaved):T('Ready','Listo'); a.style.color=''; },(kind==='err')?6000:2600); } // [R94-UT3·U-21] kind 'err' → amber + 6s so errors outlive the 2.6s info flash; no kind = identical to before
function updStatus(){ const c=selClip(); const md=T('media','medios'); $('#statSel').textContent=c?(c.name+' · '+state.media.length+' '+md+' · '+state.clips.length+' clips'):(state.clips.length+' clips · '+state.media.length+' '+md); updEnable(); }
/* [R94-UT5·U-30] single disabled-state helper: .dis (visual) + aria-disabled (assistive tech) always in sync */
/* [R102·D-T4] El tercer argumento, cuando el control está deshabilitado, es POR QUÉ lo está — y por convención
   los que llaman ya pasan ahí el motivo. Se marca como `data-why` explícito en vez de deducirlo: la Info View
   pinta el motivo en ámbar, y sin este dato pintaría en ámbar la etiqueta normal de cualquier control
   bloqueado sin motivo ("Previous locator · ,"), afirmando una causa que nadie le dio. */
function setDis(el,dis,title){ if(!el)return; el.classList.toggle('dis',!!dis); if(dis)el.setAttribute('aria-disabled','true'); else el.removeAttribute('aria-disabled'); if(title!=null)el.title=title;
  if(dis&&title!=null)el.dataset.why=title; else delete el.dataset.why; }
function updEnable(){ const hasSel=!!selClip(), hasClips=state.clips.length>0, hasMk=state.markers.length>0, hasVis=state.media.some(m=>m.kind!=='audio'&&!isSeqMedia(m)); // [R94-UT3·U-12] hasVis = the exact test openCompose uses to reject
  /* [R105] TODO control bloqueado explica POR QUÉ. El mecanismo (`data-why` → Info View en ámbar) existe desde
     R102·D-T4, pero sólo lo usaba 1 sitio de la app. El fallo era sutil: `#ringBtn`/`#adjLayerBtn` SÍ tenían
     motivo, pero se escribía en `.title` DESPUÉS de llamar a setDis → `data-why` nunca se ponía y la barra lo
     leía como una etiqueta normal, sin ámbar. Y prevMk/nextMk/exportBtn no tenían motivo ninguno.
     Ahora el motivo entra por el 3er argumento, que es el único camino que marca `data-why`.
     Enseñar el atajo en el motivo es deliberado: es el instante en que el usuario mira y quiere aprender. */
  const setBtn=(sel,on,tOn,tOff)=>{ const el=$(sel); if(!el)return; setDis(el,!on,on?tOn:tOff); };
  const impFirst=T('Import images or videos first','Importa imágenes o vídeos primero'); // [R94-UT3·U-12] los botones bloqueados se explican en el cursor, no sólo con un flash lejano
  const noMk=T('No locators yet — add one with M','Aún no hay localizadores — añade uno con M');
  setBtn('#prevMk',hasMk,T('Previous locator · ,','Localizador anterior · ,'),noMk);
  setBtn('#nextMk',hasMk,T('Next locator · .','Localizador siguiente · .'),noMk);
  setBtn('#exportBtn',hasClips,T('Export · Ctrl+Shift+E','Exportar · Ctrl+Shift+E'),T('Add clips to the timeline first','Añade clips a la línea de tiempo primero'));
  setBtn('#ringBtn',hasVis,T('Create composition (ring / grid / random)','Crear composición (anillo / cuadrícula / aleatorio)'),impFirst);
  setBtn('#adjLayerBtn',hasVis,T('Create an adjustment layer — its Reactive FX affect everything below it','Crear una capa de ajuste — sus FX reactivos afectan todo lo de debajo'),impFirst); }
/* AUTOSAVE (R79): DISK-first in Electron, full fidelity, alternating two files — a crash mid-write can
   never destroy the only good copy. Files: "<proyecto>.rdome.autosave1/2" (or userData/autosave/unsaved.rdome.*
   before the first manual save). localStorage stays as the browser/secondary path only (quota ~10MB — a
   feature-film project can exceed it, and the old code even DELETED the previous autosave on failure). */
let _asDir=null; if(IS_ELEC&&DSP.autosaveDir){ try{ DSP.autosaveDir().then(d=>{_asDir=d||null;}); }catch(e){} }
/* LIFELINE (renderer side): any uncaught error → immediate disk autosave (throttled 5s) + diag, so even a
   broken state right before a crash loses ≤ the last edit, not the last 15s window. */
let _emergT=0; function emergencySave(){ const now=Date.now(); if(now-_emergT<5000)return; _emergT=now;
  try{ const base=IS_ELEC?autosaveBase():null; if(base){ const j=JSON.stringify(serProject()); const dir=projAutosaveDir(); const w=()=>DSP.writeText(base+'.autosave1',j); if(dir&&DSP.ensureDir)DSP.ensureDir(dir).then(w).catch(w); else w(); } }catch(e){} }
window.addEventListener('error',e=>{ try{diag('error','uncaught',String(e.message||'').slice(0,300));}catch(_){} emergencySave(); });
window.addEventListener('unhandledrejection',e=>{ try{diag('error','unhandledrejection',String(e.reason&&e.reason.message||e.reason||'').slice(0,300));}catch(_){} emergencySave(); });
let _asFlip=false, _asBusy=false;
/* autosaves live in an "autosave" folder NEXT TO the project (R82b, user request); before the first manual
   save they go to userData/autosave. autosaveBase() = "<dir>\autosave\<projectFile>" → +".autosave1/2". */
function projAutosaveDir(){ if(!currentPath)return _asDir; const i=Math.max(currentPath.lastIndexOf('\\'),currentPath.lastIndexOf('/')); return i>=0?currentPath.slice(0,i)+'\\autosave':_asDir; }
function autosaveBaseName(){ return currentPath?currentPath.slice(Math.max(currentPath.lastIndexOf('\\'),currentPath.lastIndexOf('/'))+1):'unsaved.isp'; }
function autosaveBase(){ const dir=projAutosaveDir(); if(!dir)return null; return dir+'\\'+autosaveBaseName(); }
/* after a manual save the .rdome IS the latest state → delete the live crash autosaves so the next open (recents OR double-click) is always in sync with the save and never offers a stale "newer autosave" (R87). */
function clearLiveAutosaves(){ if(!IS_ELEC||!DSP.deleteFile)return; const base=autosaveBase(); if(!base)return; for(const s of ['.autosave1','.autosave2']){ try{ DSP.deleteFile(base+s); }catch(e){} } _asFlip=false; }
/* history (R82c): a timestamped snapshot ~once/min, pruned to the last hour → open any as a recovery file */
function fmtStamp(d){ const z=n=>String(n).padStart(2,'0'); return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate())+'_'+z(d.getHours())+'-'+z(d.getMinutes())+'-'+z(d.getSeconds()); }
let _lastHistT=0;
async function writeHistory(jsonFull){ if(!IS_ELEC||!DSP.writeText)return; const dir=projAutosaveDir(); if(!dir)return;
  try{ const hp=dir+'\\'+autosaveBaseName()+'.'+fmtStamp(new Date())+'.snap'; await DSP.writeText(hp,jsonFull); await pruneHistory(dir); }catch(e){} }
async function pruneHistory(dir){ if(!DSP.listDir||!DSP.deleteFile)return; try{ const files=await DSP.listDir(dir); const cut=Date.now()-3600*1000; const bn=autosaveBaseName();
  for(const f of files){ if(!/\.snap$/.test(f.name)||f.name.indexOf(bn+'.')!==0)continue; if((f.mtimeMs||0)<cut)DSP.deleteFile(dir+'\\'+f.name); } }catch(e){} } // keep only the last hour, for THIS project's snapshots
setInterval(async ()=>{ if(_asBusy)return; if(!state.dirty)return; // nothing UNSAVED to protect — never autosave a clean/just-loaded project (a redundant autosave would out-date the .rdome → false "newer autosave" prompt on next open)
  const a=$('#statAuto'); let saved=false; let jsonFull=null;
  const base=IS_ELEC?autosaveBase():null;
  if(base){ _asBusy=true; try{ const dir=projAutosaveDir(); if(dir&&DSP.ensureDir)await DSP.ensureDir(dir); jsonFull=JSON.stringify(serProject()); const p=base+(_asFlip?'.autosave2':'.autosave1');
      const ok=await DSP.writeText(p,jsonFull); if(ok!==false){ saved=true; _asFlip=!_asFlip; } }catch(e){} _asBusy=false; }
  if(saved&&jsonFull!=null){ const now=Date.now(); if(now-_lastHistT>=55000){ _lastHistT=now; writeHistory(jsonFull); } } // per-minute history snapshot
  if(!saved){ let json=null; _serLight=true; try{ json=JSON.stringify(serProject()); }catch(e){} _serLight=false; // light copy: drop maskData PNGs (the localStorage quota hog)
    if(json!=null){ try{ localStorage.setItem('domeProPro',json); saved=true; }catch(e){ try{localStorage.removeItem('domeProPro');}catch(_){ } } } }
  if(saved){ const d=new Date(); state.lastSaved=String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); if(a)a.textContent=T('Autosaved ','Autoguardado ')+state.lastSaved; }
  else if(a)a.textContent=T('⚠ Autosave failed — save to a file','⚠ Falló el autoguardado — guarda a un archivo');
},15000);

/* ===================== WIRE UI ===================== */
function wireDrop(el){ el.addEventListener('dragover',e=>e.preventDefault()); el.addEventListener('drop',e=>{e.preventDefault();
  let target=null; if(el.id==='mediaList'){ const fe=e.target&&e.target.closest&&e.target.closest('.folderhdr,.folderdrop'); if(fe&&fe.dataset.fname!==undefined)target=fe.dataset.fname||null; else target=(state.mediaView==='grid')?state.mediaFolder:(state.selFolder||state.mediaFolder||null); }
  importDropped(e.dataTransfer, target); }); } // R89: OS files/folders dropped ONTO a folder header land in that folder; otherwise in the browsed (grid) or selected (tree) folder
$('#importBtn').onclick=()=>$('#fileInput').click();
/* [R92-T5 P1] media search — the state.mediaQuery filter existed in renderMedia; the input never did */
{ const si=$('#mediaSearch'), sc=$('#mediaSearchClr'); if(si){ let _msDeb=0;
  const apply=()=>{ state.mediaQuery=si.value.trim(); if(sc)sc.style.display=si.value?'':'none'; renderMedia(); };
  si.oninput=()=>{ clearTimeout(_msDeb); _msDeb=setTimeout(apply,150); };
  si.onkeydown=e=>{ e.stopPropagation(); if(e.key==='Escape'){ si.value=''; apply(); si.blur(); } if(e.key==='Enter')apply(); };
  if(sc)sc.onclick=()=>{ si.value=''; apply(); }; } }
/* [R93c] the ⚡ toolbar button was removed per request — proxies are generated via right-click on media (multi-selection supported) */
$('#textBtn').onclick=()=>createTextClip();
$('#textBtn').addEventListener('contextmenu',e=>{ e.preventDefault(); openMenu(e.clientX,e.clientY,[
  {label:T('Plain text','Texto simple'),ico:'plus',fn:()=>createTextClip()},
  {label:T('Title (upper dome)','Título (domo superior)'),fn:()=>createTextClip({text:'TITLE',tfontSize:190,el:62,size:55})},
  {label:T('Subtitle','Subtítulo'),fn:()=>createTextClip({text:'Subtitle',tfontSize:90,tcolor:'#C9CDD3',el:48,size:40})},
  {label:T('Lower third','Tercio inferior'),fn:()=>createTextClip({text:'NAME\nRole',tfontSize:84,tstroke:true,el:18,size:44})},
  {label:T('Credits','Créditos'),fn:()=>createTextClip({text:'Directed by\nNAME',tfontSize:74,el:35,size:50})} ]); });
$('#shapeBtn').onclick=()=>createShapeClip('rect');
$('#fileInput').onchange=e=>{importFiles(e.target.files, state.mediaView==='grid'?state.mediaFolder:(state.selFolder||state.mediaFolder||null));e.target.value='';}; // Import button files into the folder you're in (browsed or selected)
wireDrop($('#mediaList')); wireDrop($('#stage'));
/* right-click the empty media area → Import / New folder (items and folder headers keep their own menus) */
$('#mediaList').addEventListener('contextmenu',e=>{ if(e.target.closest('.mitem')||e.target.closest('.folderhdr')||e.target.closest('.folderdrop'))return; e.preventDefault();
  const items=[{label:T('Import media…','Importar medios…'),ico:'plus',fn:()=>$('#fileInput').click()},{label:T('Import image sequence…','Importar secuencia de imágenes…'),ico:'video',fn:()=>$('#fileInput').click()}];
  if(IS_ELEC&&window.dsp&&window.dsp.ndi) items.push({label:T('Add NDI source…','Añadir fuente NDI…'),ico:'ndi',fn:()=>addNdiInput()});
  items.push('sep',{label:T('New folder','Nueva carpeta'),ico:'folder',fn:()=>$('#newFolderBtn').click()});
  openMenu(e.clientX,e.clientY,items); });
$('#filtSeg').querySelectorAll('button').forEach(b=>b.onclick=()=>{state.mediaFilter=b.dataset.f;$('#filtSeg').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));renderMedia();});
$('#groupSeg').querySelectorAll('button').forEach(b=>b.onclick=()=>{state.mediaGroupBy=b.dataset.g;$('#groupSeg').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));renderMedia();});
if($('#mediaViewBtn'))$('#mediaViewBtn').onclick=()=>{ state.mediaView=(state.mediaView==='grid')?'list':'grid'; $('#mediaViewBtn').classList.toggle('on',state.mediaView==='grid'); flashStatus(state.mediaView==='grid'?T('Media: grid view','Medios: vista de cuadrícula'):T('Media: list view','Medios: vista de lista')); renderMedia(); }; // R89c: both views navigate folders (dblclick) and SHARE state.mediaFolder — switching views keeps you in the same folder
$('#ringBtn').onclick=()=>openCompose('ring'); // openCompose itself rejects with the "Import images or videos first" flash when the library is empty
if($('#adjLayerBtn'))$('#adjLayerBtn').onclick=()=>{ if($('#adjLayerBtn').classList.contains('dis')){ flashStatus(T('Import images or videos first.','Primero importa imágenes o vídeos.'),'err'); return; } createAdjustMedia(); }; // sidebar (Media panel): create a draggable Adjustment media item (R87) — the reactive panel's "Add Adjustment Layer" still drops one straight onto the timeline · [R94-UT3·U-12] .dis keeps pointer-events for the tooltip, so guard the click
function showFolders(){ state.mediaGroupBy='folder'; $('#groupSeg').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x.dataset.g==='folder')); }
$('#newFolderBtn').onclick=()=>newFolderIn(state.mediaView==='grid'?state.mediaFolder:(state.selFolder||state.mediaFolder||null)); // R89c: create INSIDE where you are — browsed folder (grid/list navigation) or selected folder (tree), like Adobe
{ const ml=$('#mediaList'); if(ml)ml.addEventListener('pointerdown',e=>{ if(e.button!==0)return; if(e.target.closest('.mitem,.mtile,.folderhdr,.foldertile,.backtile,.grphead2,.drop,input,[contenteditable="true"]'))return; if(selectedMediaIds().length||state.selFolder)clearMediaSel(); }); } // [M2] click empty Media space → deselect
function renameFolder(f){ appPrompt(T('Folder name:','Nombre de la carpeta:'),folderName(f),n=>{ n=sanitizeFolderName(n); if(!n||n===folderName(f))return; const np=joinFolder(folderParent(f),n); if(folderExists(np)){ flashStatus(T('A folder with that name already exists','Ya existe una carpeta con ese nombre')); return; } pushUndo(); _reprefixFolders(f,np); renderMedia(); markDirty(); }); }
function deleteFolder(f){ const desc=folderDescendants(f); const n=state.media.filter(m=>desc.includes(m.folder)).length; const go=()=>{ pushUndo(); state.folders=state.folders.filter(x=>!desc.includes(x)); for(const m of state.media)if(desc.includes(m.folder))m.folder=null; if(desc.includes(state.mediaFolder))state.mediaFolder=folderParent(f); if(desc.includes(state.selFolder))state.selFolder=folderParent(f); if(state.folderColors)for(const d of desc)delete state.folderColors[d]; for(const k of Object.keys(state.collapsedGroups))if(k==='f_'+f||k.indexOf('f_'+f+FSEP)===0)delete state.collapsedGroups[k]; renderMedia(); markDirty(); flashStatus(T('Folder deleted (media kept)','Carpeta eliminada (medios conservados)')); }; if(n>0)appConfirm(T('Delete this folder (and its subfolders)? Its '+n+' media stay in the panel.','¿Eliminar esta carpeta (y sus subcarpetas)? Sus '+n+' medios permanecen en el panel.'),go); else go(); }
$('#newFolderBtn').oncontextmenu=e=>{ e.preventDefault(); if(!state.folders.length){ flashStatus(T('No folders yet','Aún no hay carpetas')); return; } openMenu(e.clientX,e.clientY,state.folders.map(f=>({label:f,ico:'folder',fn:()=>{ if(state.mediaView==='grid')state.mediaFolder=f; else showFolders(); renderMedia(); }}))); };
function setPaneCollapsed(pane,on){ $(pane).classList.toggle('pane-collapsed',on); resize(); saveWorkspace(); }
$('#hideMedia').onclick=()=>{ state.prefs.mediaCollapsed=true; setPaneCollapsed('#mediaPane',true); };
$('#mediaRail').onclick=()=>{ state.prefs.mediaCollapsed=false; setPaneCollapsed('#mediaPane',false); };
$('#hideInsp').onclick=()=>{ state.prefs.inspCollapsed=true; setPaneCollapsed('#inspPane',true); };
$('#inspRail').onclick=()=>{ state.prefs.inspCollapsed=false; setPaneCollapsed('#inspPane',false); };
/* full-height inspector column: reparent #inspPane (+#gutterR) between .mid (standard) and #bodyRow (spans mid+transport+timeline) */
function setTallInsp(on){ on=!!on; state.prefs.tallInsp=on; const insp=$('#inspPane'), grt=$('#gutterR'), bodyRow=$('#bodyRow'), mid=document.querySelector('.mid'), btn=$('#tallInspBtn');
  if(!insp||!bodyRow||!mid)return;
  if(on){ if(grt&&grt.parentNode!==bodyRow)bodyRow.appendChild(grt); if(insp.parentNode!==bodyRow)bodyRow.appendChild(insp); document.body.classList.add('layout-tall-insp'); }
  else { if(grt&&grt.parentNode!==mid)mid.appendChild(grt); if(insp.parentNode!==mid)mid.appendChild(insp); document.body.classList.remove('layout-tall-insp'); }
  if(btn){ btn.classList.toggle('on',on); btn.title=on?T('Inspector: full height (click for standard)','Inspector: alto completo (clic para estándar)'):T('Full-height inspector column (shrinks the timeline width)','Inspector a alto completo (reduce el ancho del timeline)'); }
  saveWorkspace(); try{resize();}catch(e){} renderTimeline(); }
if($('#tallInspBtn'))$('#tallInspBtn').onclick=()=>setTallInsp(!state.prefs.tallInsp);
/* per-track color: a small swatch popup (right-click track → Track color…) */
const LANE_PALETTE=['#E0645C','#E0954B','#D8C24B','#6FBF95','#4FB3C9','#5B8DEF','#9B72D0','#C58BD0','#B0B7C0','#7A828B'];
/* generic swatch popup: pick from the palette, or clear to default. onPick(col)/onClear() do the mutation. */
function colorPopup(x,y,cur,onPick,onClear){ document.querySelectorAll('.lanecolpop').forEach(m=>m.remove());
  const m=document.createElement('div'); m.className='menu lanecolpop'; m.style.left=x+'px'; m.style.top=y+'px'; m.style.minWidth='0'; m.style.padding='8px';
  const grid=document.createElement('div'); grid.style.cssText='display:grid;grid-template-columns:repeat(5,18px);gap:6px;';
  LANE_PALETTE.forEach(col=>{ const b=document.createElement('button'); b.title=col; b.style.cssText='width:18px;height:18px;border-radius:3px;border:.5px solid rgba(255,255,255,0.25);background:'+col+';cursor:pointer;padding:0;'+(cur===col?'box-shadow:0 0 0 2px #E8EAED;':''); b.onclick=()=>{ onPick(col); m.remove(); }; grid.appendChild(b); });
  m.appendChild(grid);
  const none=document.createElement('button'); none.textContent=T('Default (no color)','Por defecto (sin color)'); none.style.cssText='display:block;width:100%;margin-top:8px;padding:5px 8px;border:none;border-radius:2px;background:transparent;color:var(--ink-2);cursor:pointer;font-size:11px;text-align:left;'; none.onmouseenter=()=>none.style.background='#2B2F35'; none.onmouseleave=()=>none.style.background='transparent'; none.onclick=()=>{ onClear(); m.remove(); };
  m.appendChild(none); document.body.appendChild(m);
  const r=m.getBoundingClientRect(); if(r.right>innerWidth)m.style.left=Math.max(4,innerWidth-r.width-8)+'px'; if(r.bottom>innerHeight)m.style.top=Math.max(4,innerHeight-r.height-8)+'px';
  const off=()=>{ m.remove(); document.removeEventListener('pointerdown',close,true); document.removeEventListener('keydown',esc,true); };
  const close=e=>{ if(!m.contains(e.target))off(); }; const esc=e=>{ if(e.key==='Escape')off(); };
  setTimeout(()=>{ document.addEventListener('pointerdown',close,true); document.addEventListener('keydown',esc,true); },0); }
function openLaneColorPopup(li,x,y){ const lane=state.lanes[li]; if(!lane)return; colorPopup(x,y,lane.color,col=>{ pushUndo(); lane.color=col; renderTimeline(); render(); markDirty(); }, ()=>{ pushUndo(); delete lane.color; renderTimeline(); render(); markDirty(); }); } // track colour = the lane header only (R84c)
function openClipColorPopup(x,y){ const sel=(state.selIds&&state.selIds.length?state.selIds:(state.selId!=null?[state.selId]:[])).map(clipById).filter(Boolean); if(!sel.length)return; colorPopup(x,y,sel[0].color,col=>{ pushUndo(); for(const c of sel)c.color=col; renderTimeline(); render(); renderInspector(); markDirty(); }, ()=>{ pushUndo(); for(const c of sel)c.color=null; renderTimeline(); render(); renderInspector(); markDirty(); }); } // per-clip colour (all selected)
function insColState(){ if(!state.insCol)state.insCol={clip:true,color:true,motion:true}; return state.insCol; } // [I1] default: Transform expanded, Clip/Color/Motion collapsed
function applySecCollapse(){ const st=insColState(); document.querySelectorAll('#insCtl .sechead[data-sec]').forEach(h=>{ const col=!!st[h.dataset.sec];
    h.classList.toggle('seccollapsed',col); const chev=h.querySelector('.ic'); if(chev)chev.style.transform=col?'rotate(-90deg)':'';
    let n=h.nextElementSibling; while(n && !(n.classList&&n.classList.contains('sechead'))){ if(n.id!=='insAudio')n.style.display=col?'none':''; n=n.nextElementSibling; } }); } // walk this header's rows up to the next header; insAudio is never section-owned
function wireSecHeads(){ document.querySelectorAll('#insCtl .sechead[data-sec]').forEach(h=>{ if(h._wired)return; h._wired=true; h.onclick=()=>{ const st=insColState(); st[h.dataset.sec]=!st[h.dataset.sec]; applySecCollapse(); }; }); }
wireSecHeads();
function openSaveMenu(x,y){ openMenu(x,y,[{label:T('Save','Guardar'),key:'⌘S',ico:'save',fn:()=>saveProject()},{label:T('Save As… (new file)','Guardar como… (archivo nuevo)'),key:'⇧⌘S',fn:()=>saveProject(true)},{label:T('Save incremental (_vNN)','Guardar incremental (_vNN)'),fn:saveIncremental}]); }
$('#saveBtn').onclick=()=>saveProject(); $('#saveBtn').oncontextmenu=e=>{ e.preventDefault(); openSaveMenu(e.clientX,e.clientY); }; // right-click the Save button → Save As / incremental
if($('#saveMenuBtn'))$('#saveMenuBtn').onclick=e=>{ const r=e.currentTarget.getBoundingClientRect(); openSaveMenu(r.left, r.bottom+4); }; // visible caret → Save As… / incremental (R87)
$('#exportBtn').onclick=openExport; if($('#newBtn'))$('#newBtn').onclick=newProject; if($('#openBtn'))$('#openBtn').onclick=()=>openProject();
if($('#statXBtn'))$('#statXBtn').onclick=()=>exCancelActive(); // [R94-UT3·U-02c] cancel the running export from the status bar, modal closed or not
if($('#undoBtn'))$('#undoBtn').onclick=()=>undo(); if($('#redoBtn'))$('#redoBtn').onclick=()=>redo(); // [U-07] visible undo/redo affordance in the top bar (same path as Ctrl+Z / Ctrl+Shift+Z)
if($('#helpBtn'))$('#helpBtn').onclick=()=>openPalette(); // [U-08] "?" opens the command palette (all commands + shortcuts)
$('#projInput').onchange=e=>{const f=e.target.files[0];e.target.value='';if(!f)return;const r=new FileReader();r.onload=()=>{try{loadProject(JSON.parse(r.result));}catch(err){appAlert(T('Invalid project','Proyecto no válido'));}};r.readAsText(f);};
if(IS_ELEC&&DSP.onOpenPath)DSP.onOpenPath(p=>openProjectPath(p)); // double-clicked .rdome (file association)

/* viewport toolbar */
function roomStandDefaults(){ const c=state.view.cam; c.yaw=-Math.PI/2; c.pitch=0; c.fov=60; c.back=-0.5; } // 3D-room Viewer: stand at ~1.7m looking straight at the FRONT wall
$('#viewModeSeg').querySelectorAll('button').forEach(b=>b.onclick=()=>{ state.view.mode=b.dataset.v; $('#viewModeSeg').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));
  const is3=state.view.mode==='3d'; if(is3&&isRoom()){ const c=state.view.cam; if(!(c.dist>=1.4&&c.dist<=6))c.dist=2.7; if(c.pitch<0.12&&state.view.three!=='spec')c.pitch=0.5; if(state.view.three==='spec')roomStandDefaults(); } // frame the room on first entry (orbit) / face front (Viewer)
  $('#d3sep').style.display=is3?'block':'none'; $('#threeModeSeg').style.display=is3?'inline-flex':'none';
  $('#azelReadout').style.display=is3?'none':'inline-flex'; updViewCtl(); setVpCursor(); resize(); });
$('#threeModeSeg').querySelectorAll('button').forEach(b=>b.onclick=()=>{ state.view.three=b.dataset.m; $('#threeModeSeg').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b)); if(b.dataset.m==='spec'&&isRoom())roomStandDefaults(); updViewCtl(); render(); }); // entering Viewer in a room → face the front wall (FOV 60, dolly −0.5)
// 3D-room walls are see-through from OUTSIDE (translucent flat); this button also paints the clip texture translucent on the outside
{ const seg=$('#threeModeSeg'); if(seg&&seg.parentElement){ const b=document.createElement('button'); b.id='roomOutBtn'; b.className='togbtn'; b.style.cssText='display:none;height:24px;padding:0 10px;font-size:11px;'; b.textContent=T('Outside tex','Textura ext.'); b.title=T('Show the clip texture (translucent) on the outside of the walls too','Mostrar la textura del clip (translúcida) también por fuera de los muros'); b.onclick=()=>{ state.view.roomOutTex=!state.view.roomOutTex; b.classList.toggle('on',state.view.roomOutTex); render(); }; seg.parentElement.insertBefore(b, seg.nextSibling); } }
function updViewCtl(){ const is3=state.view.mode==='3d',spec=state.view.three==='spec'; $('#fovCtl').style.display=(is3&&spec)?'inline-flex':'none'; $('#dollyCtl').style.display=(is3&&spec)?'inline-flex':'none';
  { const ro=$('#roomOutBtn'); if(ro){ ro.style.display=(is3&&isRoom())?'inline-flex':'none'; ro.classList.toggle('on',!!state.view.roomOutTex); } }
  if(is3&&spec){ const fr=$('#fovRange'); if(fr){ fr.value=state.view.cam.fov; faderFill(fr); const fl=$('#fovLbl'); if(fl)fl.textContent=Math.round(state.view.cam.fov)+'°'; } const dr2=$('#dollyRange'); if(dr2){ dr2.value=state.view.cam.back; faderFill(dr2); const dl2=$('#dollyLbl'); if(dl2)dl2.textContent=(+state.view.cam.back).toFixed(1); } } // reflect the live FOV/dolly on the sliders when entering Viewer mode
  const dc=$('#distCtl'); if(dc){ dc.style.display=(is3&&!spec)?'inline-flex':'none'; const dr=$('#distRange'); if(dr){ dr.value=state.view.cam.dist; faderFill(dr); const dl=$('#distLbl'); if(dl)dl.textContent=(+state.view.cam.dist).toFixed(1); } } } // orbit: on-screen DIST (zoom) slider
$('#dispSeg').querySelectorAll('button').forEach(b=>b.onclick=()=>{ const d=b.dataset.d; if(d==='grid')state.view.showGrid=!state.view.showGrid; if(d==='safe')state.view.showSafe=!state.view.showSafe; if(d==='outline')state.view.showOutline=!state.view.showOutline; if(d==='hfade'){ state.view.hfade=!state.view.hfade; flashStatus(state.view.hfade?T('Horizon fade on','Desvanecido de horizonte activado'):T('Horizon fade off','Desvanecido de horizonte desactivado')); }
  if(d==='checker'){ state.view.checkerBg=!state.view.checkerBg; const cb=$('#checkerBg'); if(cb)cb.classList.toggle('on',state.view.checkerBg); flashStatus(state.view.checkerBg?T('Alpha checkerboard on','Cuadrícula de alpha activada'):T('Alpha checkerboard off','Cuadrícula de alpha desactivada')); } // [F8]
  b.classList.toggle('on', d==='grid'?state.view.showGrid:d==='safe'?state.view.showSafe:d==='outline'?state.view.showOutline:d==='checker'?state.view.checkerBg:state.view.hfade); render(); });
/* [R105] La calidad de previsualización se persiste entre sesiones. NO era el bug de coherencia que creí
   (verificado: newProject y cambiar de modo la respetan, y el botón siempre dice la verdad) — el hueco real
   es que no sobrevivía al reinicio y volvía a Full. Se guarda en localStorage, como el último export. */
function applyPreviewQuality(q){ q=parseFloat(q)||1; state.previewQuality=q;
  $('#qualitySeg').querySelectorAll('button').forEach(x=>x.classList.toggle('on',parseFloat(x.dataset.q)===q));
  setCompSize(COMP*q); }
$('#qualitySeg').querySelectorAll('button').forEach(b=>b.onclick=()=>{ applyPreviewQuality(b.dataset.q); render();
  try{ localStorage.setItem('dspPreviewQuality',String(state.previewQuality)); }catch(_){}
  flashStatus(b.dataset.q==='1'?T('Preview: full quality','Previsualización: calidad completa'):(T('Preview at ','Previsualización a ')+(b.textContent.trim())+T(' quality',' de calidad'))); });
(function restorePreviewQuality(){ try{ const s=localStorage.getItem('dspPreviewQuality'); if(s&&parseFloat(s)!==1)applyPreviewQuality(s); }catch(_){} })();
{ const pb=$('#proxyToggle button'); if(pb)pb.onclick=()=>{ state.view.useProxy=!state.view.useProxy; pb.classList.toggle('on',state.view.useProxy); disposeAllVinst(); scrubRender(); render(); flashStatus(state.view.useProxy?T('Viewport: proxies (fast)','Visor: proxies (rápido)'):T('Viewport: original clips','Visor: clips originales')); }; }
function faderFill(el){ if(!el)return; const mn=+el.min||0,mx=+el.max||1,v=+el.value; el.style.setProperty('--pct',(mx>mn?((v-mn)/(mx-mn))*100:0).toFixed(1)+'%'); } // [T4] paint the fader's filled portion (left of the thumb) via the --pct CSS var
$('#fovRange').oninput=e=>{state.view.cam.fov=+e.target.value;$('#fovLbl').textContent=Math.round(+e.target.value)+'°';faderFill(e.target);render();};
$('#dollyRange').oninput=e=>{state.view.cam.back=+e.target.value;$('#dollyLbl').textContent=(+e.target.value).toFixed(1);faderFill(e.target);render();};
{ const dr=$('#distRange'); if(dr)dr.oninput=e=>{state.view.cam.dist=+e.target.value;const dl=$('#distLbl');if(dl)dl.textContent=(+e.target.value).toFixed(1);faderFill(e.target);render();}; }
$('#vzIn').onclick=()=>{state.view.zoom=Math.min(12,state.view.zoom*1.2);vzLbl();render();};
$('#vzOut').onclick=()=>{state.view.zoom=Math.max(0.2,state.view.zoom/1.2);vzLbl();render();};
$('#vzReset').onclick=()=>{state.view.zoom=0.92;state.view.pan=[0,0];vzLbl();render();};
if($('#popoutBtn'))$('#popoutBtn').onclick=openViewerWindow;
/* [V2] Full Performance: the viewer takes over the whole window (editor stays in the DOM, just covered); Esc exits */
function setPerfMode(on){ on=!!on; document.body.classList.toggle('perfmode',on); const b=$('#perfBtn'); if(b)b.classList.toggle('on',on); try{ resize(); }catch(e){} render(); flashStatus(on?T('Full performance — Esc to exit','Rendimiento total — Esc para salir'):T('Editor restored','Editor restaurado')); }
{ const pb=$('#perfBtn'); if(pb)pb.onclick=()=>setPerfMode(!document.body.classList.contains('perfmode')); const pe=$('#perfExit'); if(pe)pe.onclick=()=>setPerfMode(false); }
if($('#ndiBtn')){ const nb=$('#ndiBtn'); nb.onclick=e=>{ const r=nb.getBoundingClientRect(); ndiMenu(r.left, r.bottom+4); }; if(!(IS_ELEC&&window.dsp&&window.dsp.ndi))nb.style.display='none'; } // NDI is desktop-only
if($('#spoutBtn')){ const sb=$('#spoutBtn'); sb.onclick=e=>{ const r=sb.getBoundingClientRect(); spoutMenu(r.left, r.bottom+4); }; if(!(IS_ELEC&&window.dsp&&window.dsp.spout))sb.style.display='none'; } // Spout is Windows desktop-only
if($('#fmtChip'))$('#fmtChip').onclick=openSeqSettings; // click the format chip → re-configure the active sequence (dome coverage)

/* transport */
$('#playBtn').onclick=()=>state.playing?pause():play();
{ const fb=$('#followBtn'); if(fb)fb.onclick=()=>{ state.follow=!state.follow; fb.classList.toggle('on',state.follow); if(state.follow)followPlayhead(); flashStatus(state.follow?T('Follow on — timeline scrolls with playback','Seguir activado — el timeline se mueve con la reproducción'):T('Follow off','Seguir desactivado')); }; }
$('#toStart').onclick=()=>{state.playhead=0;scrubRender();};
$('#toEnd').onclick=()=>{state.playhead=duration();scrubRender();};
$('#loopBtn').onclick=()=>loopSelection(); // same as Ctrl+L: set the loop region to the time selection (or selected clip) and toggle
/* (BPM box removed from the transport — tempo/bars no longer exposed in the header) */
$('#tcModeSeg').querySelectorAll('button').forEach(b=>b.onclick=()=>{state.tl.tcMode=b.dataset.t;$('#tcModeSeg').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));renderTimeline();positionPlayhead();});
$('#curvesBtn').onclick=toggleCurves; // [R93] single Automation button — the old Audio React view merged into it (fx lanes live in the same list)
/* [A2] re-enable removed — the After-Effects model never overrides automation, so there is nothing to re-enable */
// [archivado 20260722·R137] #autoRecBtn removido del DOM (perform-and-bake fuera) → _backup/deprecated/
/* [R94e] Mark In / Mark Out from the transport brackets (same as the I / O keys); right-click on either clears the range */
{ const bi=$('#markIn'), bo=$('#markOut');
  if(bi){ bi.onclick=()=>setWorkIn(); bi.addEventListener('contextmenu',e=>{e.preventDefault();clearWork();}); }
  if(bo){ bo.onclick=()=>setWorkOut(); bo.addEventListener('contextmenu',e=>{e.preventDefault();clearWork();}); } }
$('#snapBtn').onclick=()=>toggleSnap();
{ const b=$('#simpleClipBtn'); if(b)b.onclick=()=>toggleSimpleClips(); } // [R94c]
/* [U6] gridReadout button removed — grid spacing stays adjustable via Ctrl+1/2 (narrower/wider), Ctrl+5 (fixed/adaptive), Ctrl+4 (snap) */
/* loop brace: drag the top strip to move the loop, the ends to resize (snaps to grid) */
(function wireLoopBrace(){ const w=$('#workArea'); if(!w)return; w.addEventListener('pointerdown',e=>{ if(e.button!==0)return; if(state.workIn==null||state.workOut==null)return; e.stopPropagation(); e.preventDefault();
  const pps=state.tl.pxPerSec, downX=e.clientX, a0=state.workIn, b0=state.workOut; const mode=e.target.classList.contains('l')?'l':e.target.classList.contains('r')?'r':'mid';
  const snap=v=>{ if(!e.altKey){ const sn=applySnap(v,null); if(sn.snap!=null)return sn.val; } return v; };
  const mv=ev=>{ const dt=(ev.clientX-downX)/pps; if(mode==='l'){ state.workIn=Math.max(0,Math.min(b0-0.05,snap(a0+dt))); } else if(mode==='r'){ state.workOut=Math.max(a0+0.05,snap(b0+dt)); } else { const len=b0-a0; let na=Math.max(0,snap(a0+dt)); state.workIn=na; state.workOut=na+len; } renderWork(); render(); };
  const up=()=>{ window.removeEventListener('pointermove',mv); window.removeEventListener('pointerup',up); flashStatus(T('Loop: ','Bucle: ')+fmtTime(state.workIn)+' → '+fmtTime(state.workOut)); }; window.addEventListener('pointermove',mv); window.addEventListener('pointerup',up); }); })();
function deleteSel(){ const ids=(state.selIds&&state.selIds.length)?state.selIds.slice():(state.selId!=null?[state.selId]:[]); if(!ids.length)return; diag('info','clip','delete',{n:ids.length}); pushUndo(); if(state.autoSel&&ids.includes(state.autoSel.cid))state.autoSel=null; for(const _id of ids){ try{freeFxHistFor(_id);}catch(e){} } // free per-clip FX feedback buffers
  for(const c of state.clips)if(ids.includes(c.id)&&c.maskTex){try{gl.deleteTexture(c.maskTex);}catch(e){}}
  state.clips=state.clips.filter(x=>!ids.includes(x.id)); state.selId=null; state.selIds=[]; renderTimeline();renderInspector();render();updStatus(); reschedAudio(); }
$('#prevMk').onclick=()=>jumpMarker(-1); $('#addMk').onclick=addMarker; $('#nextMk').onclick=()=>jumpMarker(1);
$('#tlZoomIn').onclick=()=>{state.tl.pxPerSec=Math.min(TL_PPS_MAX,state.tl.pxPerSec*1.25);renderTimeline();};
$('#tlZoomOut').onclick=()=>{state.tl.pxPerSec=Math.max(TL_PPS_MIN,state.tl.pxPerSec*0.8);renderTimeline();};
/* tools */
$('#toolRail').querySelectorAll('button').forEach(b=>b.onclick=()=>setTool(b.dataset.t));
function setTool(t){ state.tl.tool=t; $('#toolRail').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x.dataset.t===t)); applyToolCursor(); }

/* panel resize */
function gutter(el,pane,which){ el.addEventListener('pointerdown',e=>{ const w0=pane.offsetWidth,x0=e.clientX; const mv=ev=>{let w=which==='L'?w0+(ev.clientX-x0):w0-(ev.clientX-x0);w=Math.max(180,Math.min(560,w));pane.style.width=w+'px';resize();}; const up=()=>{window.removeEventListener('pointermove',mv);window.removeEventListener('pointerup',up);saveWorkspace();};window.addEventListener('pointermove',mv);window.addEventListener('pointerup',up); }); }
gutter($('#gutterL'),$('#mediaPane'),'L'); gutter($('#gutterR'),$('#inspPane'),'R');
/* horizontal resize: drag the top edge of the timeline / curve panels */
function hResize(handle,target,minH,maxH,after){ const hEl=$(handle); if(!hEl)return; hEl.addEventListener('pointerdown',e=>{ e.preventDefault(); const t=$(target); const h0=t.offsetHeight,y0=e.clientY;
  const mv=ev=>{ let h=Math.max(minH,Math.min(maxH,h0-(ev.clientY-y0))); t.style.height=h+'px'; if(after)after(); };
  const up=()=>{window.removeEventListener('pointermove',mv);window.removeEventListener('pointerup',up);}; window.addEventListener('pointermove',mv);window.addEventListener('pointerup',up); }); }
hResize('#tlResize','.timeline',170,Math.round(innerHeight*0.78),()=>{resize();renderTimeline();});
function saveWorkspace(){ try{ const prev=JSON.parse(localStorage.getItem('domeProWs')||'{}'); const mc=state.prefs.mediaCollapsed, ic=state.prefs.inspCollapsed;
  localStorage.setItem('domeProWs', JSON.stringify({ mediaW: mc?(prev.mediaW||292):$('#mediaPane').offsetWidth, inspW: ic?(prev.inspW||300):$('#inspPane').offsetWidth, mediaCollapsed:mc, inspCollapsed:ic, tallInsp:!!state.prefs.tallInsp })); }catch(e){} }
function loadWorkspace(){ try{ const s=localStorage.getItem('domeProWs'); if(!s)return; const w=JSON.parse(s);
  if(w.mediaW)$('#mediaPane').style.width=w.mediaW+'px'; if(w.inspW)$('#inspPane').style.width=w.inspW+'px';
  state.prefs.mediaCollapsed=!!w.mediaCollapsed; state.prefs.inspCollapsed=!!w.inspCollapsed; state.prefs.tallInsp=!!w.tallInsp;
  $('#mediaPane').classList.toggle('pane-collapsed',state.prefs.mediaCollapsed); $('#inspPane').classList.toggle('pane-collapsed',state.prefs.inspCollapsed); }catch(e){} }

/* keyboard */
function nudgeSel(dt,noUndo){ const ids=(state.selIds&&state.selIds.length)?state.selIds:(state.selId!=null?[state.selId]:[]); if(!ids.length)return; if(!noUndo)pushUndo(); for(const id of ids){ const c=clipById(id); if(c)c.start=Math.max(0,c.start+dt); } renderTimeline(); render(); reschedAudio(); }
/* clicking any non-form surface (timeline, viewport, panels) blurs a lingering <select>/<input> so keyboard shortcuts keep working — a focused <select> otherwise swallows Ctrl combos + Space */
document.addEventListener('pointerdown',e=>{ const ae=document.activeElement; if(ae&&/^(SELECT|INPUT|TEXTAREA)$/.test(ae.tagName)){ const t=e.target; if(!(t&&t.closest&&t.closest('input,select,textarea,[contenteditable]'))){ try{ae.blur();}catch(_){}} } },true);
/* [R72] drag-to-scrub on EVERY <input type=number> (dialogs, group inspector, etc.) — like the inspector faders: horizontal drag changes the value, a plain click still focuses for typing. Shift = fine (¼ step), Alt = coarse (×5). */
document.addEventListener('pointerdown',e=>{ const inp=e.target; if(!(inp&&inp.tagName==='INPUT'&&inp.type==='number')||e.button!==0)return;
  const x0=e.clientX, v0=parseFloat(inp.value)||0; const step=parseFloat(inp.step)||1; const mn=inp.min!==''?parseFloat(inp.min):-Infinity, mx=inp.max!==''?parseFloat(inp.max):Infinity;
  const dec=(String(step).split('.')[1]||'').length; // preserve step precision
  let scrub=false;
  const mv=ev=>{ const dx=ev.clientX-x0; if(!scrub){ if(Math.abs(dx)<4)return; scrub=true; document.body.style.userSelect='none'; try{inp.blur();}catch(_){} } ev.preventDefault();
    const mul=(ev.shiftKey?0.25:1)*(ev.altKey?5:1); let nv=v0+Math.round(dx/3)*step*mul; nv=Math.max(mn,Math.min(mx,nv)); nv=dec?+nv.toFixed(dec):Math.round(nv);
    if(String(nv)!==inp.value){ inp.value=nv; inp.dispatchEvent(new Event('input',{bubbles:true})); } };
  const up=()=>{ document.removeEventListener('pointermove',mv); document.removeEventListener('pointerup',up); document.body.style.userSelect=''; if(scrub)inp.dispatchEvent(new Event('change',{bubbles:true})); };
  document.addEventListener('pointermove',mv); document.addEventListener('pointerup',up); },true);
window.addEventListener('keydown',e=>{ const tag=(e.target.tagName||'').toLowerCase(); const mod=e.ctrlKey||e.metaKey;
  if(e.key==='Escape'&&document.body.classList.contains('perfmode')&&!document.querySelector('.overlay')){ e.preventDefault(); setPerfMode(false); return; } // [V2] Esc leaves Full Performance (unless a modal is open — that Esc closes the modal)
  if(tag==='input'||tag==='textarea'||e.target.isContentEditable)return; // typing in a text field — leave the keys to the field
  if(tag==='select'&&!mod&&e.code!=='Space')return; // a focused <select> keeps its own nav keys, but Ctrl/Cmd shortcuts + Space (play) still fire
  if(document.querySelector('.overlay'))return; // a modal (Export/Compose/Prefs/New-sequence/palette) is open — don't fire timeline shortcuts behind it (Escape still handled separately)
  if(e.key==='F1'||e.key==='?'){ e.preventDefault(); openPalette(); return; }
  if(mod&&e.key.toLowerCase()==='k'){e.preventDefault();openPalette();return;}
  if(mod&&e.key===','){e.preventDefault();openPrefs();return;}
  if(mod&&e.key.toLowerCase()==='n'){e.preventDefault();newProject();return;}
  if(mod&&e.key.toLowerCase()==='s'){e.preventDefault();saveProject(e.shiftKey);return;}
  if(mod&&e.key.toLowerCase()==='e'){e.preventDefault(); if(e.shiftKey)openExport(); else { splitAtSelection(); flashStatus(T('Split (Ctrl+E) — Export is Ctrl+Shift+E','Dividir (Ctrl+E) — Exportar es Ctrl+Shift+E')); } return;} // Ctrl+E = Split (Ableton) · Ctrl+Shift+E = Export · [R94-UT2·U-25] disambiguate for users expecting Export
  if(mod&&e.key.toLowerCase()==='i'){e.preventDefault();$('#fileInput').click();return;}
  if(mod&&e.key.toLowerCase()==='f'){e.preventDefault(); const si=$('#mediaSearch'); if(si){ si.focus(); si.select(); } return;} // [R92-T5] Ctrl+F = media search
  if(mod&&e.key.toLowerCase()==='o'){e.preventDefault();openProject();return;}
  if(mod&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();return;}
  if(mod&&e.key.toLowerCase()==='c'&&state.autoSel&&state.autoSel.set&&state.autoSel.set.size){e.preventDefault();copyAutoSel();return;} // selected breakpoints → copy the curve slice, not the clip
  if(mod&&e.key.toLowerCase()==='v'&&state.hoverAuto&&state.kfClipboard&&state.kfClipboard.ks&&state.kfClipboard.ks.length){e.preventDefault();pasteAutoAt(state.hoverAuto, state.hoverAuto.t!=null?state.hoverAuto.t:state.playhead);return;} // [L5] pointer over an automation lane → paste the curve at the CURSOR position (not the playhead)
  if(mod&&e.key.toLowerCase()==='a'&&state.hoverAuto){e.preventDefault();selectAllAuto(state.hoverAuto);return;} // Ctrl+A over a lane = select all its breakpoints
  if(mod&&e.key.toLowerCase()==='c'){e.preventDefault();copyClip();return;}
  if(mod&&e.key.toLowerCase()==='v'){e.preventDefault();pasteClip();return;}
  if(mod&&e.key.toLowerCase()==='d'){e.preventDefault(); if(selClip())duplicateClip(); else if(state.selLane!=null)duplicateLane(state.selLane); return;} // [R93] clip first (selection is now exclusive: track OR clip)
  if(mod&&e.key.toLowerCase()==='r'){e.preventDefault(); renameSelection(); return;}
  if(mod&&e.key.toLowerCase()==='t'){e.preventDefault(); const sc=selClip(); const sl=(state.selLane!=null)?state.lanes[state.selLane]:(sc?state.lanes[sc.lane]:null); addLane(sl&&sl.kind==='audio'?'audio':'video'); return;} // [R93] Ctrl+T follows the context: selected track's kind, else the selected clip's track kind (audio context → audio things)
  if(mod&&e.key.toLowerCase()==='l'){e.preventDefault(); loopSelection(); return;} // Ableton: Loop Selection
  if(mod&&e.key==='1'){e.preventDefault(); gridNarrow(); return;}
  if(mod&&e.key==='2'){e.preventDefault(); gridWiden(); return;}
  if(mod&&e.key==='4'){e.preventDefault(); toggleSnap(); return;}
  if(mod&&e.key==='5'){e.preventDefault(); gridToggleFixed(); return;}
  if(e.code==='Space'){e.preventDefault(); (state.playing||shuttleOn())?pause():play(); return;}
  // [R97] J/K/L shuttle — checked before the single-letter tools below (which ignore modifiers)
  if((e.key==='j'||e.key==='J')&&!mod){ e.preventDefault(); shuttleKey(-1); return; }
  if((e.key==='l'||e.key==='L')&&!mod){ e.preventDefault(); shuttleKey(1); return; }
  if((e.key==='k'||e.key==='K')&&!mod){ e.preventDefault(); _kHeld=true; if(state.playing||shuttleOn())pause(); return; }
  if((e.key==='ArrowUp'||e.key==='ArrowDown')&&!e.altKey&&!(state.autoSel&&state.autoSel.set&&state.autoSel.set.size)){ e.preventDefault(); jumpCut(e.key==='ArrowUp'?-1:1); return; } // [R97] ↑/↓ = previous/next cut (universal)
  /* [R103] Los atajos de herramienta exigen la tecla DESNUDA. Antes ignoraban los modificadores —el propio
     comentario de abajo lo admitía— y sólo se salvaban V/Z/C/T porque Ctrl+V/Z/C/T ya tenían dueño y hacían
     `return` antes de llegar aquí. B y H no lo tenían, así que caían: **Ctrl+B armaba el RAZOR** (memoria
     muscular de "negrita" en cualquier app → siguiente clic = corte en un clip) y Ctrl+H dejaba la mano.
     Medido: 9 combinaciones armaban herramienta por accidente. Que V/Z/C/T se salvaran no era diseño: era
     que otro handler los interceptaba primero. */
  const bare=!mod&&!e.shiftKey&&!e.altKey;
  if(bare&&(e.key==='v'||e.key==='V'))setTool('select'); if(bare&&(e.key==='h'||e.key==='H'))setTool('hand');
  /* [R95·B1] Shift+B = Shape Box sobre los puntos seleccionados (Fusion).
     [R103] Ya no hace falta que preceda al razor —ahora el razor exige la tecla desnuda— pero se queda aquí
     por claridad. Y si no hay puntos seleccionados se DICE: antes caía al razor en silencio; luego, al arreglar
     eso, no pasaba nada y el usuario tampoco sabía por qué. Un atajo que calla no enseña. */
  if((e.key==='B'||e.key==='b')&&e.shiftKey&&!mod){ e.preventDefault();
    if(state.autoSel){ shapeBoxToggle(); }
    else flashStatus(T('Shape Box: select breakpoints on a curve first','Shape Box: primero selecciona puntos en una curva'));
    return; }
  if(bare&&(e.key==='t'||e.key==='T')){ setTool(state.tl.tool==='trim'?'select':'trim'); return; } // [R97] T = trim contextual (alterna); Ctrl+T (pista nueva) se maneja arriba. [R103] `!mod` no bastaba: dejaba pasar Shift+T.
  if(bare&&(e.key==='b'||e.key==='B'))setTool('razor'); if(bare&&(e.key==='z'||e.key==='Z'))setTool('zoom');
  if(bare&&(e.key==='c'||e.key==='C'))setTool('razor'); // C = Razor tool; cut lands where you click on the clip (with snap), not at the playhead
  if(e.key==='a'||e.key==='A'){ toggleCurves(); return; } // [R92-T4] A = Automation view (Ableton)
  if(e.key==='d'||e.key==='D'){ state.tl.draw=!state.tl.draw; if(state.tl.draw&&!state.inlineCurves)toggleCurves(); flashStatus(state.tl.draw?T('Draw mode on — drag on a lane to paint (Alt = freehand) · D to exit','Modo dibujo activo — arrastra sobre un carril para pintar (Alt = a mano alzada) · D para salir'):T('Draw mode off','Modo dibujo desactivado')); return; } // [R92-T4] D = Draw (B is the razor here)
  if(e.key==='s'||e.key==='S'){ toggleSnap(); return; } // [R92-T5] S = Snapping — the tooltips/palette always said so; the binding didn't exist
  if(e.key==='+'||e.key==='='){ state.tl.pxPerSec=Math.min(TL_PPS_MAX,state.tl.pxPerSec*1.25); renderTimeline(); return; } // [R92-T5] +/− timeline zoom (the palette promised them)
  if(e.key==='-'||e.key==='_'){ state.tl.pxPerSec=Math.max(TL_PPS_MIN,state.tl.pxPerSec*0.8); renderTimeline(); return; }
  if(e.key==='0'&&!mod){ toggleDisable(); return; } // Ableton: 0 disables/enables the selected clips or the time-selection slice
  if(e.key==='Escape'&&state.shapeBox){ shapeBoxClose(); return; } // [R95·B1] Esc closes the Shape Box before clearing the selection
  if(e.key==='Escape'&&state.autoSel){ state.autoSel=null; renderTimeline(); return; } // Escape clears the breakpoint selection
  if((e.key==='Delete'||e.key==='Backspace')&&state.autoSel&&state.autoSel.set&&state.autoSel.set.size){ const a=state.autoSel,c=clipById(a.cid); const ks=c&&c.kf&&c.kf[a.p]; const live=ks?ks.filter(x=>a.set.has(x)):[]; state.autoSel=null;
    if(live.length){ pushUndo(); c.kf[a.p]=ks.filter(x=>!a.set.has(x)); if(!c.kf[a.p].length)delete c.kf[a.p]; } // stale selection (after undo/split) → just clear it: no bogus undo entry, and NEVER fall through to clip deletion
    renderTimeline(); renderInspector(); render(); return; } // delete selected breakpoints
  if((e.key==='ArrowLeft'||e.key==='ArrowRight'||e.key==='ArrowUp'||e.key==='ArrowDown')&&state.autoSel&&state.autoSel.set&&state.autoSel.set.size){ e.preventDefault(); nudgeAutoSel(e); return; } // nudge selected breakpoints (←→ grid/frame · ↑↓ value)
  if((e.key==='Delete'||e.key==='Backspace')&&(state.selMediaId!=null||(state.selMediaIds&&state.selMediaIds.length))){ const ids=selectedMediaIds(); state.selMediaId=null; state.selMediaIds=[]; for(const id of ids){ const mm=mediaById(id); if(mm)deleteMedia(mm); } return; } // media selected → Delete removes them (not the timeline clip) (R86/R88)
  if((e.key==='Delete'||e.key==='Backspace')&&state.selFolder&&folderExists(state.selFolder)){ deleteFolder(state.selFolder); return; } // R90: Delete removes the SELECTED folder (confirms if it has media); cleared when you touch the timeline
  if(e.shiftKey&&(e.key==='Delete'||e.key==='Backspace')){rippleDelete();return;}
  if((e.key==='Delete'||e.key==='Backspace')&&state.selMarkerId!=null){ pushUndo(); state.markers=state.markers.filter(m=>m.id!==state.selMarkerId); state.selMarkerId=null; renderTimeline(); return; }
  if((e.key==='Delete'||e.key==='Backspace')&&state.selGroupId!=null&&!selClip()){ deleteGroup(state.selGroupId,false); return; }
  if(e.key==='Delete'||e.key==='Backspace')deleteSel();
  if(e.key==='Home'){state.playhead=0;scrubRender();} if(e.key==='End'){state.playhead=duration();scrubRender();}
  // [R97] with the TRIM tool armed, ←/→ trim the selected clip's nearest edge by keyboard: 1 frame, Shift = 10. Precision
  // without hunting pixels — the Avid/Kdenlive habit the research calls out as "trim without touching the mouse".
  if((e.key==='ArrowLeft'||e.key==='ArrowRight')&&state.tl.tool==='trim'&&selClip()&&!e.altKey){ e.preventDefault(); trimNudge(e.key==='ArrowRight'?1:-1,e.shiftKey?10:1); return; }
  if(e.key==='ArrowLeft'){ e.preventDefault(); if(e.altKey){nudgeSel(-(e.shiftKey?1:1/state.fps),e.repeat);} else {const f=state.fps||30;state.playhead=Math.max(0,(Math.round(state.playhead*f)-1)/f);scrubRender();positionPlayhead();} } /* [T7] frame-exact step (preventDefault: no page scroll) */
  if(e.key==='ArrowRight'){ e.preventDefault(); if(e.altKey){nudgeSel(e.shiftKey?1:1/state.fps,e.repeat);} else {const f=state.fps||30;state.playhead=(Math.round(state.playhead*f)+1)/f;scrubRender();positionPlayhead();} }
  if(e.key==='m'||e.key==='M')addMarker(); // [R97] marker moved L→M (the industry-standard key) so L can be the shuttle
  if(e.key===',')jumpMarker(-1); if(e.key==='.')jumpMarker(1);
  if(e.key==='i'||e.key==='I')setWorkIn(); if(e.key==='o'||e.key==='O')setWorkOut(); if(e.key==='x'||e.key==='X')clearWork();
});

window.addEventListener('keyup',e=>{ if(e.key==='k'||e.key==='K')_kHeld=false; }); // [R97] K held + J/L = slow motion (classic deck behaviour)
window.addEventListener('blur',()=>{ _kHeld=false; }); // never leave K stuck if the window loses focus mid-hold
window.addEventListener('resize',()=>{resize();renderTimeline();});
window.addEventListener('beforeunload',e=>{ if(!IS_ELEC&&state.dirty){ e.preventDefault(); e.returnValue=''; } });
window.addEventListener('keydown',e=>{ if(e.key==='Escape'){ const ovs=document.querySelectorAll('.overlay'); if(!ovs.length)return; const ov=ovs[ovs.length-1]; const cb=ov.querySelector('#exClose, #prefClose, [data-close], .mclose'); if(cb)cb.click(); else ov.remove(); } }); // [U-23] Escape runs the modal's real close handler (fmtChip restore etc.); bare remove() only as fallback

/* ===================== CLIPBOARD / EDIT COMMANDS ===================== */
function duplicateClip(){ const c=selClip(); if(!c)return; pushUndo(); const n={...c,id:uid(),start:c.start+c.dur,maskTex:null,_penCv:null,penMasks:c.penMasks?JSON.parse(JSON.stringify(c.penMasks)):undefined,groupId:undefined,slot:undefined,props:{...c.props},kf:JSON.parse(JSON.stringify(c.kf||{})),fx:JSON.parse(JSON.stringify(c.fx||[]))}; sepAuto(n,c); if(n.maskData||(n.penMasks&&n.penMasks.length))rebuildMaskTex(n); state.clips.push(n); state.selId=n.id; state.selIds=[n.id]; laneDesel(); renderTimeline();renderInspector();render(); reschedAudio(); }
function copyClip(){ const c=selClip(); if(c)state.clipboard=JSON.parse(JSON.stringify(c)); }
function pasteClip(){ if(!state.clipboard)return; const src=JSON.parse(JSON.stringify(state.clipboard)); const m=mediaById(src.mediaId);
  if(!m){ flashStatus(T("Can't paste — the clip's media no longer exists",'No se puede pegar — el medio del clip ya no existe'),'err'); return; } // [R92-T1 F8] clipboard can outlive its media · [R94-UT3·U-21]
  if(isSeqMedia(m)&&(m.id===state.activeSeqId||seqReaches(m.id,state.activeSeqId))){ flashStatus(T("Can't nest a sequence inside itself (would create a loop)",'No se puede anidar una secuencia que crearía un bucle'),'err'); return; } // [R92-T1 F8] same cycle guard as addClip — a pasted loop used to persist into the .isp · [R94-UT3·U-21]
  pushUndo(); const n={...src,id:uid(),start:state.playhead,maskTex:null,groupId:undefined,slot:undefined};
  { const kind=(m.kind==='audio')?'audio':'video'; const L=state.lanes[n.lane]; // [R92-T1 F8] clamp the lane: pasting into a sequence with fewer/other tracks left the clip invisible (and audio kept SOUNDING with no visible clip)
    if(!L||L.kind!==kind){ let li=state.lanes.findIndex(l=>l.kind===kind); if(li<0){ const t=state.lanes.filter(l=>l.kind===kind).length+1; state.lanes.push({id:uid(),name:(kind==='audio'?'Audio ':'Video ')+t,tag:(kind==='audio'?'A':'V')+t,kind}); li=state.lanes.length-1; } n.lane=li; } }
  if(n.maskData||(n.penMasks&&n.penMasks.length))rebuildMaskTex(n); state.clips.push(n); state.selId=n.id; state.selIds=[n.id]; renderTimeline();renderInspector();render(); reschedAudio(); }
function rippleDelete(){ const c=selClip(); if(!c)return; pushUndo(); const lane=c.lane,end=c.start+c.dur,gap=c.dur; state.clips=state.clips.filter(x=>x.id!==c.id);
  for(const x of state.clips) if(x.lane===lane&&x.start>=end) x.start-=gap; state.selId=null; state.selIds=[]; renderTimeline();renderInspector();render();updStatus(); reschedAudio(); }

/* ===================== CONTEXT MENUS ===================== */
let _menu=null;
function closeMenu(){ if(_menu){_menu.remove();_menu=null;} document.querySelectorAll('.menubtn.on').forEach(b=>b.classList.remove('on')); } // [R135] clear the app-menu highlight when any menu closes
/* [R92-T5] shortcut glyphs per platform: menus/palette said ⌘R/⇧⌘S on a Windows app while tooltips said Ctrl+ — one formatter for all */
function fmtKey(s){ if(!s)return s; if(navigator.platform&&/mac/i.test(navigator.platform))return s; return String(s).replace(/⇧⌘/g,'Ctrl+Shift+').replace(/⌘/g,'Ctrl+').replace(/⇧/g,'Shift+').replace(/⌥/g,'Alt+').replace(/⌫/g,'Del'); }
function openMenu(x,y,items){ closeMenu(); const m=document.createElement('div'); m.className='menu'; m.setAttribute('role','menu'); m.style.left=x+'px'; m.style.top=y+'px'; // [R94-UT5·U-10a]
  for(const it of items){ if(it==='sep'){const s=document.createElement('div');s.className='sep';m.appendChild(s);continue;}
    if(it.swatches){ const row=document.createElement('div'); row.style.cssText='display:flex;gap:6px;padding:6px 11px;flex-wrap:wrap;max-width:150px;align-items:center;'; // R90b: inline colour row INSIDE the menu (no extra popup)
      LANE_PALETTE.forEach(col=>{ const b=document.createElement('button'); b.title=col; b.style.cssText='width:16px;height:16px;border-radius:3px;border:.5px solid rgba(255,255,255,0.25);background:'+col+';cursor:pointer;padding:0;flex:0 0 auto;'+(it.swatches.cur===col?'box-shadow:0 0 0 2px #E8EAED;':''); b.onclick=e=>{ e.stopPropagation(); closeMenu(); it.swatches.onPick(col); }; row.appendChild(b); });
      const nx=document.createElement('button'); nx.title=T('No color','Sin color'); nx.textContent='✕'; nx.style.cssText='width:16px;height:16px;border-radius:3px;border:.5px dashed rgba(255,255,255,0.35);background:transparent;color:var(--ink-2);cursor:pointer;padding:0;font-size:11px;line-height:1;flex:0 0 auto;'; nx.onclick=e=>{ e.stopPropagation(); closeMenu(); it.swatches.onClear(); }; row.appendChild(nx);
      m.appendChild(row); continue; }
    const b=document.createElement('button'); if(it.danger)b.className='danger'; b.setAttribute('role','menuitem'); b.innerHTML=(it.ico?ICO(it.ico,13):'')+'<span style="flex:1">'+it.label+'</span>'+(it.key?('<span class="tnum" style="color:var(--ink-2);font-size:11px">'+fmtKey(it.key)+'</span>'):''); b.style.gap='9px'; // [R94-UT5·U-10a]
    b.onclick=()=>{closeMenu();it.fn();}; m.appendChild(b); }
  /* [R94-UT5·U-10a] keyboard-navigable menu: ArrowUp/Down cycle the enabled buttons (separators are divs → skipped
     naturally), Home/End jump, Escape closes, Enter/Space activate via the native <button> default. Every key is
     handled INSIDE the menu (stopPropagation) so nothing leaks to the app-wide shortcut handler while it is open. */
  m.addEventListener('keydown',e=>{ e.stopPropagation(); const bs=[...m.querySelectorAll('button')].filter(b=>!b.disabled); if(!bs.length)return; const i=bs.indexOf(document.activeElement);
    if(e.key==='ArrowDown'){ e.preventDefault(); bs[(i+1)%bs.length].focus(); }
    else if(e.key==='ArrowUp'){ e.preventDefault(); bs[(i<0?0:i)===0?bs.length-1:i-1].focus(); }
    else if(e.key==='Home'){ e.preventDefault(); bs[0].focus(); }
    else if(e.key==='End'){ e.preventDefault(); bs[bs.length-1].focus(); }
    else if(e.key==='Escape'){ e.preventDefault(); closeMenu(); } });
  document.body.appendChild(m); const r=m.getBoundingClientRect(); if(r.right>innerWidth)m.style.left=(x-r.width)+'px'; if(r.bottom>innerHeight)m.style.top=(y-r.height)+'px'; _menu=m;
  { const fb=m.querySelector('button:not(:disabled)'); if(fb)fb.focus(); } } // [R94-UT5·U-10a] focus lands on the first enabled item on open
window.addEventListener('pointerdown',e=>{ if(_menu&&!_menu.contains(e.target)&&!(e.target.closest&&e.target.closest('.menubtn')))closeMenu(); },true); // [R135] a menubtn manages its own open/close
/* [R135·D3] application menu bar (File / Edit / Window) — reuses existing commands; the menu is just another access path. */
function openAppMenu(which,btn){ const r=btn.getBoundingClientRect(); const x=r.left, y=r.bottom+3; let items;
  if(which==='file') items=[
    {label:T('New dome project…','Nuevo proyecto domo…'),ico:'plus',fn:()=>domeSetupDialog(cfg=>{ hideLanding(); newProject('dome',cfg.res,cfg.res,cfg.fps,cfg.cov); })},
    {label:T('New 2D project…','Nuevo proyecto 2D…'),fn:()=>flatResDialog((w,h,fps)=>{ hideLanding(); newProject('flat',w,h,fps); })},
    {label:T('New 360 room…','Nueva sala 360…'),fn:()=>roomSetupDialog(cfg=>{ hideLanding(); newRoomProject(cfg); })},
    'sep',
    {label:T('Open…','Abrir…'),key:'⌘O',ico:'folder',fn:()=>openProject()},
    {label:T('Save','Guardar'),key:'⌘S',ico:'save',fn:()=>saveProject(false)},
    {label:T('Save As…','Guardar como…'),key:'⇧⌘S',fn:()=>saveProject(true)},
    'sep',
    {label:T('Export…','Exportar…'),key:'⇧⌘E',ico:'share',fn:openExport} ];
  else if(which==='edit') items=[
    {label:T('Undo','Deshacer'),key:'⌘Z',fn:undo},
    {label:T('Redo','Rehacer'),key:'⇧⌘Z',fn:redo},
    'sep',
    {label:T('Cut','Cortar'),key:'⌘X',fn:()=>{ copyClip(); deleteSel(); }},
    {label:T('Copy','Copiar'),key:'⌘C',fn:copyClip},
    {label:T('Paste','Pegar'),key:'⌘V',fn:pasteClip},
    {label:T('Duplicate','Duplicar'),key:'⌘D',ico:'diamond',fn:duplicateClip},
    'sep',
    {label:T('Delete','Eliminar'),key:'⌫',ico:'trash',danger:true,fn:deleteSel},
    {label:T('Ripple delete','Eliminación con arrastre'),key:'⇧⌫',danger:true,fn:rippleDelete},
    'sep',
    {label:T('Nest selection','Anidar selección'),fn:nestSelection} ];
  else items=[
    {label:(state.prefs.mediaCollapsed?'':'✓  ')+T('Media panel','Panel de medios'),fn:()=>{ const c=!state.prefs.mediaCollapsed; state.prefs.mediaCollapsed=c; setPaneCollapsed('#mediaPane',c); }},
    {label:(state.prefs.inspCollapsed?'':'✓  ')+T('Inspector panel','Panel de inspector'),fn:()=>{ const c=!state.prefs.inspCollapsed; state.prefs.inspCollapsed=c; setPaneCollapsed('#inspPane',c); }},
    'sep',
    {label:T('Viewer-only window','Ventana solo-visor'),ico:'popout',fn:openViewerWindow},
    {label:T('Full performance','Rendimiento total'),fn:()=>setPerfMode(true)},
    'sep',
    {label:T('All commands & shortcuts','Todos los comandos y atajos'),key:'F1',fn:()=>{ const h=$('#helpBtn'); if(h)h.click(); }} ];
  document.querySelectorAll('.menubtn').forEach(b=>b.classList.toggle('on',b===btn)); openMenu(x,y,items); }
document.querySelectorAll('#menubar .menubtn').forEach(btn=>{ const which=btn.dataset.menu;
  btn.onclick=e=>{ e.stopPropagation(); if(btn.classList.contains('on')){ closeMenu(); return; } openAppMenu(which,btn); };
  btn.onmouseenter=()=>{ if(_menu)openAppMenu(which,btn); }; }); // hover switches menus while the bar is open (standard menubar behaviour)
/* "Make unique": deep-copy the nest/compose media this clip points to (new independent copy) so its parameters can be edited without affecting the other instances. */
function makeClipUnique(c){ if(!c)return; const m=mediaById(c.mediaId); if(!m||!isSeqMedia(m)){ flashStatus(T('Only sequences/compositions can be made unique','Solo secuencias/composiciones pueden hacerse únicas')); return; } pushUndo();
  const nm=JSON.parse(JSON.stringify(serMedia(m))); // deep copy (serMedia already drops live GL fields)
  nm.id=uid(); nm.name=(m.name||'Nest')+' '+T('(unique)','(único)');
  nm.el=null; nm.originalEl=null; nm.tex=null; nm.fbo=null; nm.buffer=null; nm.missing=false;
  nm.nestClips=(nm.nestClips||[]).map(cc=>({...cc, id:uid(), maskTex:null, kf:cc.kf||{}}));
  nm.nestLanes=(nm.nestLanes&&nm.nestLanes.length)?nm.nestLanes:defLanes(); nm.nestMarkers=nm.nestMarkers||[]; nm.nestGroups=nm.nestGroups||[];
  if(nm.comp)nm.comp={...nm.comp, id:uid()};
  state.media.push(nm);
  for(const cc of nm.nestClips) if(cc.maskData||(cc.penMasks&&cc.penMasks.length)) rebuildMaskTex(cc);
  c.mediaId=nm.id;
  renderMedia(); renderTimeline(); renderInspector(); render(); markDirty(); flashStatus(T('Made unique — edit its parameters independently','Convertido en único — edita sus parámetros por separado')); }
/* ---- R80-1: per-clip speed ---- */
function setClipSpeed(c,pct){ const sp=Math.max(6.25,Math.min(1600,pct))/100; pushUndo(); c.speed=(Math.abs(sp-1)<1e-4)?undefined:sp; if(c.speed===undefined)delete c.speed; disposeAllVinst(); renderTimeline(); renderInspector(); scheduleWaves(); render(); markDirty(); reschedAudio(); flashStatus(T('Speed: ','Velocidad: ')+Math.round(sp*100)+'%'); }
function speedMenu(c){ const cur=Math.round((c.speed||1)*100); const opts=[25,50,75,100,150,200,400];
  openMenu(innerWidth/2-80,innerHeight/2-120,[...opts.map(p=>({label:p+'%'+(p===cur?'  ✓':''),fn:()=>setClipSpeed(c,p)})),'sep',
    {label:T('Custom…','Personalizada…'),fn:()=>appPrompt(T('Speed % (100 = normal)','Velocidad % (100 = normal)'),String(cur),v=>{ if(v==null)return; const nv=parseFloat(String(v).replace(',','.')); if(!isNaN(nv)&&nv>0)setClipSpeed(c,nv); })}]); }
/* ---- R81: loopable clip (Ableton-style) — the source [inP, inP+loopLen) repeats; the right edge can be
   dragged out forever, and subtle ticks mark each loop boundary ---- */
function toggleLoop(c){ if(!c)return; const m=mediaById(c.mediaId); if(!(m&&(m.kind==='video'||m.kind==='audio'||isSeqMedia(m)))){ flashStatus(T('Only video / audio / sequence clips can loop','Solo clips de vídeo / audio / secuencia pueden loopear')); return; }
  pushUndo();
  if(c.loop){ // turn OFF — clamp dur back to the available source (a stretched clip would otherwise show past-source frozen frames)
    const srcDur=isSeqMedia(m)?seqDur(m):(m.dur||Infinity); const maxDur=Math.max(0.05,(srcDur-(c.inP||0))/(c.speed||1));
    c.loop=false; delete c.loopLen; if(c.dur>maxDur)c.dur=maxDur; flashStatus(T('Loop off','Loop desactivado'));
  } else { const srcDur=isSeqMedia(m)?seqDur(m):(m.dur||Infinity); // capture the CURRENT source segment as the loop cycle
    c.loopLen=Math.max(0.05,Math.min(c.dur*(c.speed||1), srcDur-(c.inP||0))); c.loop=true; flashStatus(T('Loop on — drag the right edge to extend','Loop activado — arrastra el borde derecho para extender'));
  }
  if(!c.loop)delete c.loopRev; // loop off → reverse no longer applies
  disposeAllVinst(); renderTimeline(); renderInspector(); render(); markDirty(); reschedAudio(); }
/* R88: ping-pong loop — forward one cycle, backward the next. Turns loop on if it wasn't. */
function toggleLoopReverse(c){ if(!c)return; const m=mediaById(c.mediaId); if(!(m&&(m.kind==='video'||isSeqMedia(m)))){ flashStatus(T('Loop reverse works on video / sequence clips','El loop inverso funciona en clips de vídeo / secuencia')); return; }
  if(!c.loop){ toggleLoop(c); if(!c.loop)return; } // needs a loop region first
  pushUndo(); c.loopRev=!c.loopRev; disposeAllVinst(); renderTimeline(); renderInspector(); render(); markDirty(); flashStatus(c.loopRev?T('Loop reverse on (ping-pong)','Loop inverso activado (ping-pong)'):T('Loop reverse off','Loop inverso desactivado')); }
/* ---- R80-2: Ableton-style "0" — disable the selected clips, or the time-selection slice of them (split first) ---- */
function toggleDisable(){ const a=state.tl.selA,b=state.tl.selB; const hasRange=(a!=null&&b!=null&&Math.abs(b-a)>1e-3);
  if(hasRange){ const lo=Math.min(a,b),hi=Math.max(a,b); const lanes=state.tl.selLanes&&state.tl.selLanes.length?new Set(state.tl.selLanes):null; pushUndo();
    const hits=state.clips.filter(c=>(!lanes||lanes.has(c.lane))&&c.start<hi-0.02&&c.start+c.dur>lo+0.02);
    if(!hits.length){ flashStatus(T('No clips in the selection','No hay clips en la selección')); return; }
    for(const c of hits.slice()){ if(lo>c.start+0.02&&lo<c.start+c.dur-0.02)razorCore(c,lo); }
    const hits2=state.clips.filter(c=>(!lanes||lanes.has(c.lane))&&c.start<hi-0.02&&c.start+c.dur>lo+0.02);
    for(const c of hits2.slice()){ if(hi>c.start+0.02&&hi<c.start+c.dur-0.02)razorCore(c,hi); }
    const mids=state.clips.filter(c=>(!lanes||lanes.has(c.lane))&&c.start>=lo-0.02&&c.start+c.dur<=hi+0.02);
    const anyOn=mids.some(c=>!c.disabled); for(const c of mids)c.disabled=anyOn; // Ableton: mixed → all off; all off → all on
    renderTimeline(); render(); markDirty(); reschedAudio(); flashStatus(anyOn?T('Section disabled','Sección desactivada'):T('Section enabled','Sección activada')); return; }
  const sel=state.selIds.map(clipById).filter(Boolean); if(!sel.length){ flashStatus(T('Select a clip (or a range) first','Selecciona un clip (o un rango) primero')); return; }
  pushUndo(); const anyOn=sel.some(c=>!c.disabled); for(const c of sel)c.disabled=anyOn;
  renderTimeline(); render(); markDirty(); reschedAudio(); flashStatus(anyOn?T('Clip disabled','Clip desactivado'):T('Clip enabled','Clip activado')); }
/* ---- R80-3: copy/paste attributes (props/fx/kf/anim; fx ids re-minted + kf keys remapped) ---- */
let _attrClip=null;
function copyAttributes(c){ _attrClip=JSON.parse(JSON.stringify({props:c.props||{},fx:c.fx||[],kf:c.kf||{},anim:c.anim||null,speed:c.speed||null})); flashStatus(T('Attributes copied','Atributos copiados')); }
function pasteAttributes(){ if(!_attrClip){ flashStatus(T('Copy attributes from a clip first','Copia primero los atributos de un clip')); return; }
  const sel=state.selIds.map(clipById).filter(Boolean); if(!sel.length){ flashStatus(T('Select target clips','Selecciona clips de destino')); return; }
  pushUndo();
  for(const c of sel){ const src=JSON.parse(JSON.stringify(_attrClip)); const idMap={};
    for(const f of src.fx){ const nid=uid(); idMap[f.id]=nid; f.id=nid; }
    const remap=k=>{ const mm=/^fx:(\d+):(.*)$/.exec(k); return (mm&&idMap[+mm[1]]!=null)?('fx:'+idMap[+mm[1]]+':'+mm[2]):k; };
    const nkf={}; for(const k of Object.keys(src.kf))nkf[remap(k)]=src.kf[k];
    c.props=Object.assign({},c.props,src.props); c.fx=src.fx; c.kf=nkf;
    if(src.anim)c.anim=src.anim; if(src.speed)c.speed=src.speed; else delete c.speed; }
  disposeAllVinst(); renderTimeline(); renderInspector(); render(); markDirty(); flashStatus(T('Attributes pasted to ','Atributos pegados en ')+sel.length+' clip(s)'); }
$('#tracks').addEventListener('contextmenu',e=>{ const cd=e.target.closest('.clip');
  if(!cd){ e.preventDefault(); const ln=e.target.closest('.lane'); const li=ln?+ln.dataset.lane:null; const knd=(li!=null&&state.lanes[li])?state.lanes[li].kind:undefined; openMenu(e.clientX,e.clientY,trackCreateItems(knd)); return; } // [R110b] right-click on a track row filters create-track by that row's kind
  /* [T1] a `//` comment here used to swallow this whole body → the clip menu never got `id`/preventDefault and broke. */
  e.preventDefault(); const id=+cd.dataset.clip; state.selId=id; if(!state.selIds.includes(id))state.selIds=[id]; laneDesel(); renderInspector(); renderTimeline(); ensureClipVisible(clipById(id)); // select the clip under the cursor (keep an existing multi-selection); re-render first so the fresh row is measured
  openMenu(e.clientX,e.clientY,[ {label:T('Rename','Renombrar'),key:'⌘R',fn:()=>{ state.selIds=[id]; state.selId=id; renameSelection(); }},
    {label:T('Split at playhead','Dividir en el cabezal'),ico:'split',fn:()=>{const c=clipById(id);if(c)razorClip(c,state.playhead);}},
    {label:T('Zoom to clip','Ampliar al clip'),ico:'zoomIn',fn:()=>{const c=clipById(id);if(c)zoomToClip(c);}}, // [T1]
    {label:T('Duplicate','Duplicar'),key:'⌘D',ico:'diamond',fn:duplicateClip}, {label:T('Copy','Copiar'),key:'⌘C',fn:copyClip}, 'sep',
    {label:T('Set clip color…','Elegir color del clip…'),fn:()=>{ if(!state.selIds.includes(id)){state.selIds=[id];state.selId=id;} openClipColorPopup(e.clientX,e.clientY); }},
    {label:T('Change speed…','Cambiar velocidad…'),fn:()=>{const c=clipById(id);if(c)speedMenu(c);}},
    {label:(()=>{const c=clipById(id);return (c&&c.loop)?T('Loop: on ✓','Loop: activado ✓'):T('Loopable','Loopeable');})(),fn:()=>{const c=clipById(id);if(c)toggleLoop(c);}},
    {label:(()=>{const c=clipById(id);return (c&&c.loopRev)?T('Loop reverse: on ✓','Loop inverso: activado ✓'):T('Loop reverse (ping-pong)','Loop inverso (ping-pong)');})(),fn:()=>{const c=clipById(id);if(c)toggleLoopReverse(c);}},
    {label:(()=>{const c=clipById(id);return (c&&c.disabled)?T('Enable','Activar'):T('Disable','Desactivar');})(),key:'0',fn:()=>{const c=clipById(id);if(c)toggleDisable();}},
    {label:T('Copy attributes','Copiar atributos'),fn:()=>{const c=clipById(id);if(c)copyAttributes(c);}},
    {label:T('Paste attributes','Pegar atributos'),fn:pasteAttributes}, 'sep',
    ...((()=>{const cc=clipById(id),mm=cc&&mediaById(cc.mediaId);return (mm&&mm.kind!=='audio'&&!isSeqMedia(mm))?[{label:T('Create composition from clip…','Crear composición desde el clip…'),ico:'ring',fn:()=>{const c2=clipById(id);if(c2)openCompose('ring',null,null,c2);}}]:[];})()),
    {label:T('Nest selection','Anidar selección'),ico:'ring',fn:nestSelection},
    ...((()=>{const cc=clipById(id),mm=cc&&mediaById(cc.mediaId);return (mm&&isSeqMedia(mm))?[{label:T('Open sequence','Abrir secuencia'),ico:'panel',fn:()=>openSeq(mm.id)},{label:T('Make unique','Convertir en único'),ico:'ring',fn:()=>{const c2=clipById(id);if(c2)makeClipUnique(c2);}}]:[];})()),
    ...((()=>{const cc=clipById(id),mm=cc&&mediaById(cc.mediaId);return (mm&&mm.kind!=='audio')?[{label:T('Render in place…','Renderizar en el sitio…'),ico:'layers',fn:()=>{const c2=clipById(id);if(c2)renderInPlace(c2);}}]:[];})()),
    ...((()=>{ const sA=state.tl.selA,sB=state.tl.selB; return (sA!=null&&sB!=null&&Math.abs(sB-sA)>1e-3)?[{label:T('Render selection in place…','Renderizar la selección en el sitio…'),ico:'layers',fn:renderRangeInPlace}]:[]; })()), // [R1] bake the in/out time selection → new top track
    'sep',
    {label:T('Show automation','Mostrar la automatización'),ico:'curves',fn:()=>{const c=clipById(id);if(c)showAutomation(c);}},
    {label:T('Reset to default','Restablecer el valor por defecto'),fn:()=>{const c=clipById(id);if(c)returnToDefault(c);}}, // (no key hint — Delete deletes the clip, not the automation)
    'sep',
    {label:T('Delete','Eliminar'),key:'⌫',ico:'trash',danger:true,fn:deleteSel}, {label:T('Ripple delete','Eliminación con arrastre'),key:'⇧⌫',danger:true,fn:rippleDelete} ]); });
$('#ruler').addEventListener('contextmenu',e=>{ e.preventDefault(); const rect=$('#ruler').getBoundingClientRect(); const t=Math.max(0,(e.clientX-rect.left)/state.tl.pxPerSec);
  const tol=8/state.tl.pxPerSec; const near=state.markers.find(m=>Math.abs(m.time-t)<tol);
  const items=[];
  if(near){ state.selMarkerId=near.id; renderTimeline();
    items.push({label:T('Rename locator','Cambiar nombre del localizador'),fn:()=>renameLocatorInline(near)});
    items.push({label:T('Delete this locator','Eliminar este localizador'),danger:true,fn:()=>{pushUndo();state.markers=state.markers.filter(m=>m!==near);if(state.selMarkerId===near.id)state.selMarkerId=null;renderTimeline();}}); items.push('sep'); }
  items.push({label:T('Add locator here','Añadir localizador aquí'),ico:'flag',fn:()=>{pushUndo();const nm={id:uid(),time:t,name:T('Locator','Localizador'),color:'#B4BAC1'};state.markers.push(nm);state.markers.sort((a,b)=>a.time-b.time);state.selMarkerId=nm.id;renderTimeline();}});
  items.push({label:T('Clear locators','Borrar localizadores'),danger:true,fn:()=>{pushUndo();state.markers=[];state.selMarkerId=null;renderTimeline();}});
  openMenu(e.clientX,e.clientY,items); });

/* ===================== COMMAND PALETTE (Ctrl+K) ===================== */
function commandList(){ const c1=T('Transport','Reproducción'),c2=T('File','Archivo'),c3=T('Create','Crear'),c4=T('Edit','Editar'),c5=T('Timeline','Línea de tiempo'),c6=T('Locators','Localizadores'),c7=T('View','Vista'),c8=T('Tools','Herramientas'),c9=T('Panels','Paneles'); return [
  [c1,T('Play / Pause','Reproducir / Pausar'),'Space',()=>state.playing?pause():play()],
  [c1,T('Go to start','Ir al inicio'),'Home',()=>{state.playhead=0;scrubRender();}],
  [c1,T('Go to end','Ir al final'),'End',()=>{state.playhead=duration();scrubRender();}],
  [c1,T('Toggle loop','Activar/desactivar bucle'),'',()=>$('#loopBtn').click()],
  [c1,T('Render-ahead: cache range for smooth playback','Render-ahead: cachear rango para playback fluido'),'',renderAheadWork],
  [c1,T('Render-ahead: off + clear cache','Render-ahead: apagar + limpiar caché'),'',renderAheadOff],
  [c2,T('New project','Nuevo proyecto'),'⌘N',()=>newProject()],[c2,T('New sequence','Nueva secuencia'),'',newSequenceDialog],
  [c2,T('Save','Guardar'),'⌘S',saveProject],[c2,T('Import media…','Importar medios…'),'⌘I',()=>$('#fileInput').click()],
  [c2,T('Export master…','Exportar máster…'),'⇧⌘E',openExport],[c2,T('Open project','Abrir proyecto'),'⌘O',()=>openProject()],[c2,T('Preferences…','Preferencias…'),'⌘,',openPrefs],
  [c2,T('Save As… (new file)','Guardar como… (archivo nuevo)'),'⇧⌘S',()=>saveProject(true)],[c2,T('Save incremental (_vNN.isp)','Guardar incremental (_vNN.isp)'),'',saveIncremental],[c2,T('Restore last autosave','Restaurar último autoguardado'),'',restoreAutosave],[c2,T('Recovery history…','Historial de recuperación…'),'',openRecoveryHistory],
  [c2,T('Save diagnostics log…','Guardar registro de diagnóstico…'),'',saveDiagLog],
  [c3,T('Ring composition…','Composición en anillo…'),'',()=>openCompose('ring')],[c3,T('Grid composition…','Composición en cuadrícula…'),'',()=>openCompose('grid')],[c3,T('Random composition…','Composición aleatoria…'),'',()=>openCompose('random')],
  [c3,T('Add video track','Añadir pista de vídeo'),'',()=>addLane('video')],[c3,T('Add audio track','Añadir pista de audio'),'',()=>addLane('audio')],
  [c4,T('Undo','Deshacer'),'⌘Z',undo],[c4,T('Redo','Rehacer'),'⇧⌘Z',redo],[c4,T('Duplicate','Duplicar'),'⌘D',duplicateClip],
  [c4,T('Delete','Eliminar'),'⌫',deleteSel],[c4,T('Ripple delete','Eliminación con arrastre'),'⇧⌫',rippleDelete],[c4,T('Copy','Copiar'),'⌘C',copyClip],[c4,T('Paste','Pegar'),'⌘V',pasteClip],[c4,T('Nest selection','Anidar selección'),'',nestSelection],
  [c5,T('Split at selection / playhead','Dividir en la selección / cabezal'),'⌘E',splitAtSelection],
  [c5,T('Set clip start (seconds)…','Inicio del clip (segundos)…'),'',()=>{const c=selClip();if(!c){flashStatus(T('Select a clip','Selecciona un clip'));return;}appPrompt(T('Start time (seconds):','Inicio (segundos):'),(+c.start).toFixed(2),v=>{if(v!=null&&v!==''&&!isNaN(+v)){pushUndo();c.start=Math.max(0,+v);renderTimeline();render();flashStatus(T('Clip moved','Clip movido'));}});}],
  [c5,T('Nudge clip ±1 frame / ±1 s','Desplazar clip ±1 frame / ±1 s'),'Alt+←/→',()=>flashStatus(T('Alt+Arrow nudges the selected clip (add Shift for 1 s)','Alt+Flecha desplaza el clip seleccionado (Shift = 1 s)'))],
  [c5,T('Toggle Snap to Grid','Activar/desactivar ajuste a la cuadrícula'),'S',()=>$('#snapBtn').click()],[c5,T('Toggle simple clips (Premiere-style)','Activar/desactivar clips simples (estilo Premiere)'),'',toggleSimpleClips],[c5,T('Zoom in','Acercar'),'+',()=>$('#tlZoomIn').click()],[c5,T('Zoom out','Alejar'),'−',()=>$('#tlZoomOut').click()],
  [c6,T('Add locator','Añadir localizador'),'M',addMarker],[c6,T('Next','Siguiente'),'.',()=>jumpMarker(1)],[c6,T('Previous','Anterior'),',',()=>jumpMarker(-1)],
  [c1,T('Shuttle back (J · press again = 2×/4×/8×)','Retroceder (J · repetir = 2×/4×/8×)'),'J',()=>shuttleKey(-1)],
  [c1,T('Shuttle forward (L · press again = 2×/4×/8×)','Avanzar (L · repetir = 2×/4×/8×)'),'L',()=>shuttleKey(1)],
  [c1,T('Stop shuttle','Detener transporte'),'K',()=>pause()],
  [c5,T('Previous cut','Corte anterior'),'↑',()=>jumpCut(-1)],[c5,T('Next cut','Corte siguiente'),'↓',()=>jumpCut(1)],
  [c6,T('Detect beats on audio → locators','Detectar beats en audio → localizadores'),'',detectBeatsCmd],
  [c7,isFlat()?T('2D Master','Máster 2D'):T('Dome Master','Máster de domo'),'',()=>$('#viewModeSeg button[data-v="2d"]').click()],[c7,isRoom()?T('3D Room','Sala 3D'):T('3D Preview','Vista 3D'),'',()=>$('#viewModeSeg button[data-v="3d"]').click()],
  [c7,T('Toggle grid','Activar/desactivar cuadrícula'),'',()=>$('#dispSeg button[data-d="grid"]').click()],[c7,T('Toggle outline','Activar/desactivar contorno'),'',()=>$('#dispSeg button[data-d="outline"]').click()],[c7,T('Toggle horizon fade','Activar/desactivar desvanecido de horizonte'),'',()=>$('#dispSeg button[data-d="hfade"]').click()],[c7,T('Toggle scopes (histogram)','Mostrar/ocultar scopes (histograma)'),'',()=>{state.view.showScopes=!state.view.showScopes;render();flashStatus(state.view.showScopes?T('Scopes on','Scopes activados'):T('Scopes off','Scopes desactivados'));}],
  [c8,T('Select','Seleccionar'),'V',()=>setTool('select')],[c8,T('Hand / Pan','Mano / Desplazar'),'H',()=>setTool('hand')],[c8,T('Razor','Cuchilla'),'B',()=>setTool('razor')],[c8,T('Zoom','Zoom'),'Z',()=>setTool('zoom')],
  [c9,T('Toggle media browser','Mostrar/ocultar navegador de medios'),'',()=>$('#hideMedia').click()],
]; }
function openPalette(){ closeMenu(); let ov=$('#palOv'); if(ov)ov.remove();
  ov=document.createElement('div'); ov.className='overlay'; ov.id='palOv'; ov.style.alignItems='flex-start';
  ov.innerHTML=`<div class="modal" style="width:520px;margin-top:80px;"><div class="mh" style="padding:10px 14px;"><span style="color:var(--ink-2);display:flex;">${ICO('search',15)}</span><input id="palIn" placeholder="${T('Search command…','Buscar comando…')}" style="flex:1;background:transparent;border:none;outline:none;color:var(--ink);font-family:inherit;font-size:13px;"></div>
    <div id="palList" style="max-height:380px;overflow-y:auto;padding:6px;"></div></div>`;
  document.body.appendChild(ov);
  const inp=$('#palIn'),list=$('#palList'); let sel=0,filtered=[]; const CMDS=commandList();
  function build(){ const q=inp.value.toLowerCase(); filtered=CMDS.filter(c=>(c[0]+' '+c[1]).toLowerCase().includes(q)); sel=Math.min(sel,filtered.length-1); if(sel<0)sel=0;
    list.innerHTML=filtered.map((c,i)=>`<button data-i="${i}" style="display:flex;align-items:center;gap:12px;width:100%;text-align:left;padding:8px 10px;border:none;border-radius:2px;background:${i===sel?'#454C55':'transparent'};color:var(--ink);cursor:pointer;font-size:13px;">
      <span class="tnum" style="color:var(--ink-dim);font-size:11px;width:62px;text-transform:uppercase;">${c[0]}</span><span style="flex:1">${c[1]}</span><span class="tnum" style="color:var(--ink-2);font-size:11px;">${fmtKey(c[2]||'')}</span></button>`).join('');
    list.querySelectorAll('button').forEach(b=>{b.onclick=()=>{run(+b.dataset.i);};}); }
  function run(i){ if(filtered[i]){ov.remove(); filtered[i][3]();} }
  inp.oninput=build; inp.onkeydown=e=>{ if(e.key==='ArrowDown'){e.preventDefault();sel=Math.min(filtered.length-1,sel+1);build();} else if(e.key==='ArrowUp'){e.preventDefault();sel=Math.max(0,sel-1);build();} else if(e.key==='Enter'){e.preventDefault();run(sel);} else if(e.key==='Escape')ov.remove(); };
  ov.addEventListener('pointerdown',e=>{if(e.target===ov)ov.remove();});
  build(); inp.focus();
}

/* ===================== PREFERENCES ===================== */
function openPrefs(){ closeMenu(); const ov=document.createElement('div'); ov.className='overlay'; ov.id='prefOv';
  const sw=(id,on,label)=>`<div class="frow" style="justify-content:space-between;"><label style="width:auto;">${label}</label><button class="iosw ${on?'on':''}" data-sw="${id}"><i></i></button></div>`;
  ov.innerHTML=`<div class="modal" style="width:380px;"><div class="mh"><span style="color:var(--ink-2);display:flex;">${ICO('gear',16)}</span><span class="t">${T('Preferences','Preferencias')}</span></div><div class="mb">
    <div class="frow" style="justify-content:space-between;"><label style="width:auto;">${T('Language','Idioma')}</label><div class="kindseg" id="prefLang" style="width:auto;flex:0 0 auto;"><button data-l="en" class="${state.lang==='en'?'on':''}" style="flex:0 0 auto;padding:0 14px;">English</button><button data-l="es" class="${state.lang==='es'?'on':''}" style="flex:0 0 auto;padding:0 14px;">Español</button></div></div>
    ${sw('reducedMotion',state.prefs.reducedMotion,T('Reduced motion','Movimiento reducido'))}${sw('snapping',state.tl.snap,T('Snap to Grid','Ajustar a la cuadrícula'))}${sw('simpleclips',state.tl.simpleClips,T('Simple clips (Premiere-style)','Clips simples (estilo Premiere)'))}${sw('grid',state.view.showGrid,T('Reference grid','Cuadrícula de referencia'))}${sw('safe',state.view.showSafe,T('Safe-zone overlay','Superposición de zona segura'))}
    <div class="frow" style="justify-content:space-between;margin-top:6px;"><label style="width:auto;">${T('Project FPS','FPS del proyecto')}</label><select id="prefFps" style="flex:0 0 90px;"><option>24</option><option>25</option><option>30</option><option>48</option><option>50</option><option selected>60</option></select></div>
    <div style="display:flex;justify-content:flex-end;margin-top:10px;"><button class="mbtn pri" id="prefClose">${T('Close','Cerrar')}</button></div></div></div>`;
  document.body.appendChild(ov); $('#prefFps').value=state.fps;
  $('#prefLang').querySelectorAll('button').forEach(b=>b.onclick=()=>{ if(b.dataset.l!==state.lang){ setLang(b.dataset.l); ov.remove(); openPrefs(); } });
  ov.querySelectorAll('[data-sw]').forEach(b=>b.onclick=()=>{ const k=b.dataset.sw; b.classList.toggle('on');
    if(k==='reducedMotion'){state.prefs.reducedMotion=b.classList.contains('on');document.body.classList.toggle('rm-on',state.prefs.reducedMotion);try{localStorage.setItem('domeProRM',state.prefs.reducedMotion?'1':'0');}catch(e){}}
    if(k==='snapping'){state.tl.snap=b.classList.contains('on');$('#snapBtn').classList.toggle('on',state.tl.snap);}
    if(k==='simpleclips'){state.tl.simpleClips=b.classList.contains('on');syncSimpleUI();markDirty();} // [R94c]
    if(k==='grid'){state.view.showGrid=b.classList.contains('on');$('#dispSeg button[data-d=grid]').classList.toggle('on',state.view.showGrid);render();}
    if(k==='safe'){state.view.showSafe=b.classList.contains('on');$('#dispSeg button[data-d=safe]').classList.toggle('on',state.view.showSafe);render();} });
  $('#prefFps').onchange=e=>{state.fps=+e.target.value; const as=activeSeq(); if(as)as.fps=state.fps; markDirty(); updFmtChip(); positionPlayhead();renderTimeline();}; // [U-11] persist to the active sequence + dirty flag — no more silent revert on seq switch
  $('#prefClose').onclick=()=>ov.remove(); ov.addEventListener('pointerdown',e=>{if(e.target===ov)ov.remove();}); }

/* ===================== COMPOSITION GROUPS (ring / grid / random) ===================== */
const kindES=k=>T({ring:'ring',grid:'grid',random:'random',spiral:'spiral',phyllo:'sunflower',wave:'wave',fib:'dome scatter',line:'line',domegrid:'dome fill',row:'row',col:'column'}[k]||k,{ring:'anillo',grid:'cuadrícula',random:'aleatorio',spiral:'espiral',phyllo:'girasol',wave:'onda',fib:'esparcido',line:'línea',domegrid:'relleno',row:'fila',col:'columna'}[k]||k);
const FLAT_COMP_KINDS=['grid','row','col','random']; // flat/room compositions use x/y/scale, not dome az/el
/* flat/room composition layout → {x,y,scale} in % (x/y −100..100). g.infinite (room) spreads across the FULL strip so it tiles seamlessly. */
function compLayoutFlat(g){ const out=[],n=Math.max(1,g.count); const inf=!!g.infinite; const xSpan=inf?200:150, xL=-xSpan/2, sc=g.size;
  if(g.kind==='grid'){ const cols=Math.max(1,g.cols), rows=Math.max(1,Math.ceil(n/cols)); let i=0;
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){ if(i>=n)break; const x=cols>1?(xL+c*xSpan/(inf?cols:(cols-1))):0; const y=rows>1?(70-r*140/(rows-1)):0; out.push({x,y,scale:sc}); i++; } }
  else if(g.kind==='row'){ for(let i=0;i<n;i++){ const x=inf?(xL+i*xSpan/n):(n>1?xL+i*xSpan/(n-1):0); out.push({x,y:0,scale:sc}); } }
  else if(g.kind==='col'){ for(let i=0;i<n;i++){ const f=n>1?i/(n-1):0.5; out.push({x:0,y:70-f*140,scale:sc}); } }
  else { ensureRand(g); for(let i=0;i<n;i++){ const a=g.rand[i]; out.push({x:(a.a*2-1)*(xSpan/2),y:(a.e*2-1)*70,scale:sc*(0.7+0.6*a.s)}); } }
  if(g.jitter>0){ ensureRand(g); const J=g.jitter/100; for(let i=0;i<out.length;i++){ const a=g.rand[i]||{a:.5,e:.5,s:.5}; out[i].x+=(a.a*2-1)*40*J; out[i].y+=(a.e*2-1)*40*J; out[i].scale=Math.max(3,out[i].scale*(1+(a.s*2-1)*0.6*J)); } }
  return out; }
const maskES=k=>({none:T('None','Ninguna'),circle:T('Circle (alpha)','Círculo (alfa)'),rounded:T('Rounded','Redondeada'),diamond:T('Diamond','Rombo'),vignette:T('Vignette','Viñeta'),custom:T('Custom (PNG)','Personalizada (PNG)')}[k]||k);
function groupById(id){ return state.groups.find(g=>g.id===id); }
function groupMembers(g){ return state.clips.filter(c=>c.groupId===g.id).sort((a,b)=>(a.slot||0)-(b.slot||0)); }
function ensureRand(g){ g.rand=g.rand||[]; while(g.rand.length<g.count) g.rand.push({a:Math.random(),e:Math.random(),s:Math.random()}); }
function compLayout(g){ const out=[],n=g.count;
  if(g.kind==='ring'){ for(let i=0;i<n;i++) out.push({az:(g.spin+i*360/n+360)%360, el:g.el, size:g.size}); }
  else if(g.kind==='grid'){ const cols=Math.max(1,g.cols), rows=Math.max(1,Math.ceil(n/cols)); let i=0;
    for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){ if(i>=n)break;
      const az=(cols>1? -g.arc/2 + c*g.arc/(cols-1) : 0)+g.spin;
      const el=(rows>1? g.elMax - r*(g.elMax-g.elMin)/(rows-1) : (g.elMax+g.elMin)/2);
      out.push({az:(az+360)%360, el, size:g.size}); i++; } }
  else if(g.kind==='spiral'){ const turns=Math.max(1,g.turns||3); for(let i=0;i<n;i++){ const f=n>1?i/(n-1):0; out.push({az:(g.spin+f*360*turns+360)%360, el:g.elMin+(g.elMax-g.elMin)*f, size:g.size*(0.55+0.7*f)}); } }
  else if(g.kind==='phyllo'){ for(let i=0;i<n;i++){ const f=Math.sqrt((i+0.5)/n); out.push({az:(g.spin+i*137.507+360)%360, el:g.elMax-(g.elMax-g.elMin)*f, size:g.size}); } } // sunflower / golden-angle
  else if(g.kind==='wave'){ const cyc=Math.max(1,g.turns||2); for(let i=0;i<n;i++){ const f=n>1?i/(n-1):0; out.push({az:(g.spin+f*360+360)%360, el:(g.elMin+g.elMax)/2+(g.elMax-g.elMin)/2*Math.sin(f*Math.PI*2*cyc), size:g.size}); } }
  else if(g.kind==='fib'){ for(let i=0;i<n;i++){ const z=1-(i+0.5)/n; const el=Math.asin(Math.max(-1,Math.min(1,z)))*R2D; out.push({az:(g.spin+i*137.507+360)%360, el:g.elMin+(Math.max(0,Math.min(90,el))/90)*(g.elMax-g.elMin), size:g.size}); } } // even dome scatter (fibonacci)
  else if(g.kind==='domegrid'){ // stacked tiled rings filling the dome — annular sectors with per-element spans
    const rings=Math.max(1,Math.min(12,Math.round(g.rings||3))); let segs=Math.max(1,Math.min(48,Math.round(g.segs||8))); if(rings*segs>160)segs=Math.max(1,Math.floor(160/rings));
    const elFrom=Math.min(g.elMin,g.elMax), elTo=Math.max(g.elMin,g.elMax), bandTotal=(elTo-elFrom)/rings;
    // tiny bleed when there's no explicit gap → adjacent sectors overlap by a hair instead of leaving sub-pixel black seams (rho is clamped at the zenith so the cap doesn't overshoot)
    const blAz=(g.gapAz||0)<=0?0.6:0, blEl=(g.gapEl||0)<=0?0.6:0;
    const secAz=Math.max(2,360/segs-(g.gapAz||0))+blAz, secEl=Math.max(2,bandTotal-(g.gapEl||0))+blEl;
    for(let r=0;r<rings;r++){ const elC=elFrom+bandTotal*(r+0.5); const azOff=(g.brick&&(r%2))?(360/segs)/2:0;
      for(let s=0;s<segs;s++){ out.push({az:((g.spin||0)+azOff+s*360/segs)%360, el:elC, size:g.size, _secAz:secAz, _secEl:secEl}); } } }
  else if(g.kind==='line'){ for(let i=0;i<n;i++){ const f=n>1?i/(n-1):0.5; const s=f*2-1; // -1..+1 across the FULL dome diameter (edge → zenith → opposite edge) — always full width
      out.push({az:((g.spin||0)+(s<0?180:0)+360)%360, el:Math.max(0.5,Math.min(90, 90*(1-Math.abs(s)))), size:g.size}); } }
  else { ensureRand(g); for(let i=0;i<n;i++){ const a=g.rand[i]; out.push({az:(a.a*360+g.spin)%360, el:g.elMin+(g.elMax-g.elMin)*a.e, size:g.size*(0.7+0.6*a.s)}); } }
  // R88: RANDOMIZE overlay — works on ANY structured mode (not the seamless dome-grid/tiled sectors, not the already-random scatter): jitter each element's az/el/size by g.jitter%
  if(g.jitter>0 && g.kind!=='domegrid' && g.kind!=='random' && !g.tile){ ensureRand(g); const J=g.jitter/100; // !g.tile: jittering seamless mosaic sectors would open seams (R88 audit)
    for(let i=0;i<out.length;i++){ if(out[i]._secAz!=null)continue; const a=g.rand[i]||{a:0.5,e:0.5,s:0.5};
      out[i].az=((out[i].az+(a.a*2-1)*60*J)%360+360)%360;
      out[i].el=Math.max(0,Math.min(90,out[i].el+(a.e*2-1)*30*J));
      out[i].size=Math.max(3,out[i].size*(1+(a.s*2-1)*0.6*J)); } }
  return out; }
/* props for one composed element. With g.tile, the element is an annular SECTOR (dome-tile) sized to seamlessly tile its ring/grid cell — perfect rings, no diagonal overlap. */
function compElProps(g,p){ if(p.x!=null){ return { x:Math.round(p.x*10)/10, y:Math.round(p.y*10)/10, scale:Math.round(p.scale), rot:0, mask:g.mask||'none' }; } // flat/room element: x/y/scale
  const noWarp=!!g.noWarp; // [N5] Dome Fill "flat tiles": place undeformed patches at the ring/segment centres instead of warped annular sectors
  const dome=(!noWarp&&p._secAz!=null)||(!noWarp&&g.tile&&(g.kind==='ring'||g.kind==='grid'));
  const pr={az:dome?p.az:Math.round(p.az), el:dome?p.el:Math.round(p.el), size:Math.round(p.size), mask:g.mask||'none'}; // keep centers EXACT in dome mode so adjacent sectors tile with no seam
  if(!noWarp&&p._secAz!=null){ pr.warp='dome'; pr.secAz=p._secAz; pr.secEl=p._secEl; } // per-element spans (domegrid)
  else if(!noWarp&&g.tile){ let secAz=360/Math.max(1,g.count||1), secEl=(g.band||30);
    if(g.kind==='grid'){ const cols=Math.max(1,g.cols||1), rows=Math.max(1,Math.ceil((g.count||1)/cols)); secAz=(cols>1?(g.arc||360)/(cols-1):(g.arc||60)); secEl=(rows>1?(g.elMax-g.elMin)/(rows-1):((g.elMax-g.elMin)||30)); }
    pr.warp='dome'; pr.secAz=secAz; pr.secEl=secEl; }
  return pr; }
/* ensure at least n video lanes exist; return their indices (top-down stable order) */
function ensureVideoLanes(n){ let vids=state.lanes.map((l,i)=>({l,i})).filter(o=>o.l.kind==='video').map(o=>o.i);
  while(vids.length<n){ const k=state.lanes.filter(l=>l.kind==='video').length+1; state.lanes.push({id:uid(),name:'V'+k,tag:'V'+k,kind:'video'}); vids.push(state.lanes.length-1); } return vids; }
function regenComp(g){ const m=mediaById(g.mediaId); if(!m)return; ensureRand(g);
  const lay=compLayout(g);
  // [20] each composition element lives on its OWN lane → no same-lane overlap → no spurious crossfade.
  const vids=ensureVideoLanes(lay.length);
  // Preserve per-member tweaks (fades, opacity, mask, keyframes, custom mask) by reusing the existing
  // clip object for each surviving slot and only updating the positional props (az/el/size) + lane.
  const existing=groupMembers(g); const bySlot={}; for(const c of existing) bySlot[c.slot]=c;
  const baseStart=existing.length?existing[0].start:state.playhead;
  for(const c of existing){ if(c.slot>=lay.length&&c.maskTex){ try{gl.deleteTexture(c.maskTex);}catch(e){} } } // free dropped members' masks
  state.clips=state.clips.filter(c=>c.groupId!==g.id||c.slot<lay.length);
  lay.forEach((p,i)=>{ const ex=bySlot[i];
    if(ex){ ex.lane=vids[i]; ex.props.az=Math.round(p.az); ex.props.el=Math.round(p.el); ex.props.size=Math.round(p.size); ex.props.mask=g.mask||'none'; }
    else state.clips.push(makeClip(m,vids[i],baseStart,{az:Math.round(p.az),el:Math.round(p.el),size:Math.round(p.size),mask:g.mask||'none'},{groupId:g.id,slot:i,name:m.name+' ['+(i+1)+']',color:CLIP_COLORS[i%CLIP_COLORS.length]}));
  }); }
/* media assignment for composed elements: sequential (i % n) by default, or a STABLE shuffle when g.shuffle
   is on (so a multi-media dome-fill/grid isn't always ordered). The shuffle map (g.order) is kept so re-renders
   stay put; set g._orderR to force a fresh reshuffle. Distributes each media ~evenly, then randomizes positions. */
function ensureCompOrder(g,count,mcount){ if(!g.shuffle||mcount<=1){ if(!g.shuffle)g.order=null; return; }
  if(!Array.isArray(g.order)||g.order.length!==count||g._orderM!==mcount||g._orderR){ const a=[]; for(let i=0;i<count;i++)a.push(i%mcount); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); const t=a[i]; a[i]=a[j]; a[j]=t; } g.order=a; g._orderM=mcount; g._orderR=false; } }
function compMediaIndex(g,i,mcount){ if(g.shuffle&&Array.isArray(g.order)&&g.order[i]!=null) return ((g.order[i]%mcount)+mcount)%mcount; return i%mcount; }
/* Premiere-style: a composition becomes a NEST clip inside the current sequence (double-click to edit it as its own sequence). */
function createComposition(opts){ pushUndo();
  const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
  const g=Object.assign({id:uid(),kind:'ring',mediaId:null,mediaIds:null,count:6,spin:0,el:30,size:40,arc:140,cols:3,elMin:10,elMax:60,turns:3,lineRot:true,mask:'none',shuffle:false,rand:[]},opts);
  const ids=(g.mediaIds&&g.mediaIds.length)?g.mediaIds:(g.mediaId!=null?[g.mediaId]:[]); const srcs=ids.map(mediaById).filter(Boolean);
  if(!srcs.length){ flashStatus(T('Pick a media for the composition','Elige un medio para la composición')); return; }
  g.mediaIds=srcs.map(s=>s.id); g.mediaId=srcs[0].id;
  const scope=opts._scope||null; delete g._scope; if(scope){ g.scopeInP=scope.inP||0; if(scope.speed&&scope.speed!==1)g.scopeSpeed=scope.speed; } // R88: PERSIST the cut in-point on the comp group so re-generating (edit params) keeps the trim, not frame 0
  const flat=isFlat(); const compMode=flat?state.seqMode:'dome'; // flat/room compositions place elements with x/y/scale in their own format
  ensureRand(g); const lay=flat?compLayoutFlat(g):compLayout(g); const dur=scope?Math.max(0.1,scope.dur):Math.max(0.1, Math.max(...srcs.map(s=>s.dur||6)));
  // build the nest: one composed element per nest-lane (no same-lane overlap → no spurious crossfade), geometry from compLayout; media cycle across elements
  const nestLanes=lay.map((p,i)=>({id:uid(),name:'V'+(i+1),tag:'V'+(i+1),kind:'video'}));
  ensureCompOrder(g,lay.length,srcs.length);
  const nestClips=lay.map((p,i)=>{ const src=srcs[compMediaIndex(g,i,srcs.length)]; const layP=compElProps(g,p); const c=makeClip(src,i,0,layP,{name:src.name+' ['+(i+1)+']',color:CLIP_COLORS[i%CLIP_COLORS.length]}); c.dur=dur; c.slot=i; c._layBase={...layP}; if(scope){ c.inP=scope.inP||0; if(scope.speed&&scope.speed!==1)c.speed=scope.speed; } return c; }); // [N4] _layBase = the layout baseline so later recomposes preserve the user's manual delta
  if(!flat && g.kind==='line'&&g.scroll) for(const cc of nestClips) cc.anim=[{id:uid(),param:'el',mode:'linear',speed:(g.scrollSpeed!=null?g.scrollSpeed:20),amp:0,phase:0,on:true}]; // dome infinite strip: scroll along the diameter (wrap makes it reappear)
  if(flat && g.infinite) for(const cc of nestClips) cc.anim=[{id:uid(),param:'x',mode:'linear',speed:(g.scrollSpeed!=null?g.scrollSpeed:12),amp:0,phase:0,on:true}]; // 360 infinite extension: scroll horizontally (room wrap makes it seamless)
  const ncount=state.media.filter(m=>m.kind==='nest').length;
  const nest=newSeqMedia(cap(kindES(g.kind))+(ncount?' '+(ncount+1):''), state.fps, state.seqW, state.seqH, nestClips, nestLanes, compMode); nest.dur=dur; nest.comp=g;
  state.media.push(nest);
  // R88: EVERY composition lands on a BRAND-NEW top video lane (never reuses an existing track → no accidental overlap)
  const vn=state.lanes.filter(l=>l.kind==='video').length+1; state.lanes.push({id:uid(),name:'V'+vn,tag:'V'+vn,kind:'video'}); const vlane=state.lanes.length-1;
  const start=scope?(scope.start!=null?scope.start:state.playhead):state.playhead;
  const nc=makeClip(nest,vlane,start); nc.dur=dur; if(!flat)nc.props.fulldome=true; state.clips.push(nc);
  state.selId=nc.id; state.selIds=[nc.id]; state.selGroupId=null;
  renderMedia(); renderSeqBar(); renderTimeline(); renderInspector(); render(); markDirty();
  flashStatus(cap(kindES(g.kind))+' → '+T('nest · ','nido · ')+g.count+' '+T('items','elementos')); return nest; }
/* rebuild a compose-nest's inner clips/lanes from its stored comp params (live edit from the inspector / Recompose dialog) */
function regenComposeNest(m){ if(!m||!m.comp)return false; const g=m.comp; const ids=(g.mediaIds&&g.mediaIds.length)?g.mediaIds:(g.mediaId!=null?[g.mediaId]:[]); const srcs=ids.map(mediaById).filter(Boolean); if(!srcs.length)return false; g.mediaIds=srcs.map(s=>s.id); g.mediaId=srcs[0].id; ensureRand(g); const flat=flatLikeMode(m.mode); const lay=flat?compLayoutFlat(g):compLayout(g);
  const dur=Math.max(0.1, m.dur||Math.max(...srcs.map(s=>s.dur||6)));
  const prev=Array.isArray(m.nestClips)?m.nestClips:[]; // [N4] reuse the existing inner clips so per-element tweaks survive a recompose
  for(const c of prev)if(c.slot>=lay.length&&c.maskTex){try{gl.deleteTexture(c.maskTex);}catch(e){}} // free dropped slots' masks
  m.nestLanes=lay.map((p,i)=>({id:uid(),name:'V'+(i+1),tag:'V'+(i+1),kind:'video'}));
  ensureCompOrder(g,lay.length,srcs.length);
  m.nestClips=lay.map((p,i)=>{ const src=srcs[compMediaIndex(g,i,srcs.length)]; const layP=compElProps(g,p); const ex=prev[i];
    if(ex && ex.mediaId===src.id){ // [N4] keep this element's manual tweaks (opacity/mask/fades/keyframes/fx) AND apply the new layout RELATIVE to the user's delta, so a hand-scaled item doesn't snap back to 0
      const base=ex._layBase||{};
      for(const k in layP){ if(typeof layP[k]==='number'){ const d=(typeof ex.props[k]==='number'&&typeof base[k]==='number')?(ex.props[k]-base[k]):0; ex.props[k]=layP[k]+d; } } // numeric positional props carry the user's offset; mask (string) is left as the user set it
      for(const k of ['warp','secAz','secEl']){ if(layP[k]!=null)ex.props[k]=layP[k]; else delete ex.props[k]; } // [N5] warp/sector props are layout-controlled (not user tweaks) → follow the layout (e.g. Flat tiles removes them)
      ex._layBase={...layP}; ex.lane=i; ex.slot=i; ex.dur=dur; if(g.scopeInP!=null)ex.inP=g.scopeInP; if(g.scopeSpeed)ex.speed=g.scopeSpeed; return ex; }
    const c=makeClip(src,i,0,layP,{name:src.name+' ['+(i+1)+']',color:CLIP_COLORS[i%CLIP_COLORS.length]}); c.dur=dur; c.slot=i; c._layBase={...layP}; if(g.scopeInP!=null)c.inP=g.scopeInP; if(g.scopeSpeed)c.speed=g.scopeSpeed; return c; }); // R88: re-apply the persisted cut in-point (don't revert to the source's frame 0)
  if(!flat && g.kind==='line'&&g.scroll) for(const cc of m.nestClips) cc.anim=[{id:uid(),param:'el',mode:'linear',speed:(g.scrollSpeed!=null?g.scrollSpeed:20),amp:0,phase:0,on:true}]; // dome infinite strip scroll
  if(flat && g.infinite) for(const cc of m.nestClips) cc.anim=[{id:uid(),param:'x',mode:'linear',speed:(g.scrollSpeed!=null?g.scrollSpeed:12),amp:0,phase:0,on:true}]; // 360 infinite extension scroll
  m.dur=dur; if(m.id===state.activeSeqId)loadSeqIntoState(m); raInvalidate(); return true; }
/* dome schematic: plot the composition's elements on a fisheye disc (front=bottom, right=right) so you can see what the layout will do */
function drawComposePreview(g,canvas){ if(!canvas)return; const x=canvas.getContext('2d'); const W=canvas.width,H=canvas.height,cx=W/2,cy=H/2,R=Math.min(W,H)/2-7; x.clearRect(0,0,W,H);
  if(FLAT_COMP_KINDS.includes(g.kind)){ // flat/room composition preview: a frame with x/y positioned dots
    const A=(state.seqW||16)/(state.seqH||9); let bw=W-14,bh=bw/A; if(bh>H-14){ bh=H-14; bw=bh*A; } const bx=(W-bw)/2, by=(H-bh)/2;
    x.fillStyle=UI.s0; x.fillRect(bx,by,bw,bh); x.strokeStyle='rgba(255,255,255,0.16)'; x.lineWidth=1; x.strokeRect(bx,by,bw,bh);
    let lay=[]; try{ ensureRand(g); lay=compLayoutFlat(g); }catch(e){}
    lay.forEach((p,i)=>{ const px=bx+bw*(p.x/200+0.5), py=by+bh*(0.5-p.y/200); const sz=Math.max(4,Math.min(bw*0.5,bw*(p.scale/300)));
      x.globalAlpha=0.92; x.fillStyle=CLIP_COLORS[i%CLIP_COLORS.length]; x.strokeStyle='rgba(0,0,0,0.55)'; x.lineWidth=1; x.beginPath(); x.rect(px-sz/2,py-sz/2,sz,sz); x.fill(); x.stroke();
      x.globalAlpha=1; x.fillStyle=textOn(CLIP_COLORS[i%CLIP_COLORS.length]); x.font='700 11px Inter'; x.textAlign='center'; x.textBaseline='middle'; if(sz>=11)x.fillText(String(i+1),px,py); });
    x.globalAlpha=1; return; }
  x.fillStyle=UI.s0; x.beginPath(); x.arc(cx,cy,R,0,7); x.fill();
  x.strokeStyle='rgba(255,255,255,0.16)'; x.lineWidth=1; x.beginPath(); x.arc(cx,cy,R,0,7); x.stroke();
  x.strokeStyle='rgba(255,255,255,0.06)'; for(const f of [0.33,0.66]){ x.beginPath(); x.arc(cx,cy,R*f,0,7); x.stroke(); }
  x.fillStyle=UI.inkDim; x.font='11px Inter'; x.textBaseline='middle'; x.textAlign='center'; x.fillText('FRONT',cx,cy+R-4); x.fillText('BACK',cx,cy-R+7); x.textAlign='left'; x.fillText('R',cx+R-7,cy); x.textAlign='right'; x.fillText('L',cx-R+7,cy);
  let lay=[]; try{ ensureRand(g); lay=compLayout(g); }catch(e){}
  if(g.tile||g.kind==='domegrid'){ // seamless dome-tile: draw each element as the annular SECTOR it will actually fill
    lay.forEach((p,i)=>{ const sp=compElProps(g,p); const secAz=sp.secAz||(360/Math.max(1,lay.length)), secEl=sp.secEl||30;
      const rIn=R*Math.max(0,Math.min(1,(90-(p.el+secEl/2))/90)), rOut=R*Math.max(0,Math.min(1,(90-(p.el-secEl/2))/90));
      const a0=(p.az-secAz/2)*D2R, a1=(p.az+secAz/2)*D2R, steps=Math.max(2,Math.round(secAz/5));
      x.beginPath(); for(let s=0;s<=steps;s++){ const a=a0+(a1-a0)*s/steps, px=cx+rOut*Math.sin(a), py=cy+rOut*Math.cos(a); s===0?x.moveTo(px,py):x.lineTo(px,py); }
      for(let s=steps;s>=0;s--){ const a=a0+(a1-a0)*s/steps; x.lineTo(cx+rIn*Math.sin(a), cy+rIn*Math.cos(a)); } x.closePath();
      x.globalAlpha=0.9; x.fillStyle=CLIP_COLORS[i%CLIP_COLORS.length]; x.fill(); x.globalAlpha=1; x.lineWidth=0.6; x.strokeStyle='rgba(0,0,0,0.55)'; x.stroke();
      const am=(a0+a1)/2, rm=(rIn+rOut)/2; if(rOut-rIn>11){ x.fillStyle=textOn(CLIP_COLORS[i%CLIP_COLORS.length]); x.font='700 11px Inter'; x.textAlign='center'; x.textBaseline='middle'; x.fillText(String(i+1), cx+rm*Math.sin(am), cy+rm*Math.cos(am)); } });
    x.globalAlpha=1; return; }
  lay.forEach((p,i)=>{ const r=R*Math.max(0,Math.min(1,(90-p.el)/90)), a=p.az*D2R; const px=cx+r*Math.sin(a), py=cy+r*Math.cos(a); const sz=Math.max(5,Math.min(R*0.9,R*(p.size/170)));
    x.globalAlpha=0.92; x.fillStyle=CLIP_COLORS[i%CLIP_COLORS.length]; x.strokeStyle='rgba(0,0,0,0.55)'; x.lineWidth=1; x.beginPath(); x.arc(px,py,sz/2,0,7); x.fill(); x.stroke();
    x.globalAlpha=1; x.fillStyle=textOn(CLIP_COLORS[i%CLIP_COLORS.length]); x.font='700 11px Inter'; x.textAlign='center'; x.textBaseline='middle'; if(sz>=11)x.fillText(String(i+1),px,py); });
  x.globalAlpha=1; }
function selectGroup(id){ state.selGroupId=id; state.selId=null; renderTimeline(); renderInspector(); }
function deleteGroup(id,keepClips){ pushUndo(); const g=groupById(id); if(!g)return;
  if(keepClips){ for(const c of groupMembers(g)) delete c.groupId; } else { state.clips=state.clips.filter(c=>c.groupId!==id); }
  state.groups=state.groups.filter(x=>x.id!==id); if(state.selGroupId===id)state.selGroupId=null;
  renderTimeline(); renderInspector(); render(); updStatus(); }
/* transform whole group by delta, preserving per-member individual offsets */
function groupSpin(g,val){ const d=val-g.spin; g.spin=val; for(const c of groupMembers(g)) c.props.az=((c.props.az+d)%360+360)%360; render(); }
function groupRaise(g,val){ const base=(g._elB!=null?g._elB:g.el), d=val-base; g.el=val; for(const c of groupMembers(g)) c.props.el=Math.max(0,Math.min(90,(c._elB!=null?c._elB:c.props.el)+d)); render(); }
function groupScale(g,val){ const base=(g._szB!=null?g._szB:g.size)||1, r=val/base; g.size=val; for(const c of groupMembers(g)) c.props.size=Math.max(5,Math.min(300,(c._szB!=null?c._szB:c.props.size)*r)); render(); } // 300 = new TF size max (R88 audit: was still 160)
function groupSetMask(g,mk){ g.mask=mk; for(const c of groupMembers(g)) c.props.mask=mk; render(); }
function openCompose(initialKind,editGroup,nestMedia,scopeClip,preselIds){ const vids=state.media.filter(m=>m.kind!=='audio'&&!isSeqMedia(m)); if(!vids.length){flashStatus(T('Import images or videos first.','Primero importa imágenes o vídeos.'),'err');return;} // [R94-UT3·U-21] // scopeClip (R82): compose from ONE clip's cut portion → the result is a NEW media on a NEW track, only that clip's length. preselIds (R88): pre-check several media (compose from a media multi-selection)
  const pre=editGroup||(nestMedia&&nestMedia.comp)||null; const _flatComp=isFlat();
  let kind=(pre&&pre.kind)||initialKind||(_flatComp?'grid':'ring'); if(_flatComp&&!FLAT_COMP_KINDS.includes(kind))kind='grid';
  let _infinite=(pre&&pre.infinite)||false; const ov=document.createElement('div'); ov.className='overlay'; ov.id='compOv';
  const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
  const seg=()=>(_flatComp?FLAT_COMP_KINDS:['ring','domegrid','grid','spiral','phyllo','wave','fib','line','random']).map(k=>`<button data-k="${k}" class="${k===kind?'on':''}">${cap(kindES(k))}</button>`).join('');
  ov.innerHTML=`<div class="modal" style="width:648px;"><div class="mh"><span style="color:var(--ink-2);display:flex;">${ICO('ring',16)}</span><span class="t">${T('Create composition','Crear composición')}</span></div><div class="mb">
   <div style="display:flex;gap:16px;align-items:stretch;">
    <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px;height:420px;overflow-y:auto;">
    <div class="frow" style="align-items:flex-start;"><label style="padding-top:3px;">${T('Media','Medios')}</label><div id="cMedia" class="cmedialist">${vids.map(m=>`<label class="cmediaitem" title="${m.name}"><input type="checkbox" value="${m.id}"><span class="mdot" style="background:${m.color};flex-shrink:0;"></span><span class="cmname">${m.name}</span></label>`).join('')}</div></div>
    <div class="frow"><label>${T('Layout','Disposición')}</label><div class="kindseg" id="cKind">${seg()}</div></div>
    <div class="frow" data-only="count"><label>${T('Count','Cantidad')}</label><input type="number" class="tnum" id="cN" value="6" min="2" max="32"></div>
    <div class="frow" data-only="domegrid"><label>${T('Rings','Anillos')}</label><input type="number" class="tnum" id="cRings" value="3" min="1" max="12"></div>
    <div class="frow" data-only="domegrid"><label>${T('Segments','Segmentos')}</label><input type="number" class="tnum" id="cSegs" value="8" min="1" max="48"></div>
    <div class="frow" data-only="domegrid"><label>${T('Ring gap','Sep. anillos')}</label><input type="number" class="tnum" id="cGapEl" value="0" min="0" max="40"><span class="tnum" style="color:var(--ink-dim);">°</span></div>
    <div class="frow" data-only="domegrid"><label>${T('Seg gap','Sep. segmentos')}</label><input type="number" class="tnum" id="cGapAz" value="0" min="0" max="40"><span class="tnum" style="color:var(--ink-dim);">°</span></div>
    <div class="frow" data-only="domegrid"><label>${T('Offset','Desfase')}</label><label style="display:flex;align-items:center;gap:6px;flex:1;font-size:11px;color:var(--ink-2);cursor:pointer;"><input type="checkbox" id="cBrick"> ${T('Brick (alternate rings)','Ladrillo (alternar anillos)')}</label></div>
    <div class="frow" data-only="domegrid"><label>${T('Order','Orden')}</label><label style="display:flex;align-items:center;gap:6px;flex:1;font-size:11px;color:var(--ink-2);cursor:pointer;"><input type="checkbox" id="cShuffle"> ${T('Randomize (shuffle media)','Aleatorizar (barajar medios)')}</label><button class="mbtn" id="cReshuffle" type="button" title="${T('Reshuffle','Rebarajar')}" style="height:24px;padding:0 9px;font-size:13px;">↻</button></div>
    <div class="frow" data-only="line"><label>${T('Scroll','Desplazar')}</label><label style="display:flex;align-items:center;gap:6px;flex:1;font-size:11px;color:var(--ink-2);cursor:pointer;"><input type="checkbox" id="cScroll"> ${T('Infinite strip','Tira infinita')}</label><input type="number" class="tnum" id="cScrollSpd" value="20" min="-120" max="120" title="${T('Scroll speed °/s (negative = down)','Velocidad °/s (negativo = abajo)')}" style="width:52px;"><span class="tnum" style="color:var(--ink-dim);">°/s</span></div>
    <div class="frow" data-only="spiralwave"><label>${T('Turns','Vueltas')}</label><input type="number" class="tnum" id="cTurns" value="3" min="1" max="12"></div>
    <div class="frow" data-only="grid"><label>${T('Columns','Columnas')}</label><input type="number" class="tnum" id="cCols" value="3" min="1" max="8"></div>
    <div class="frow" data-only="grid"><label>${T('Az span','Rango de azimut')}</label><input type="number" class="tnum" id="cArc" value="140" min="20" max="360"><span class="tnum" style="color:var(--ink-dim);">°</span></div>
    <div class="frow" data-only="ring"><label>${T('Elevation','Elevación')}</label><input type="number" class="tnum" id="cEl" value="30" min="0" max="85"><span class="tnum" style="color:var(--ink-dim);">°</span></div>
    <div class="frow" data-only="gridrand"><label>${T('Elev. range','Rango de elevación')}</label><input type="number" class="tnum" id="cElMin" value="10" min="0" max="89" style="width:64px;"><span class="tnum" style="color:var(--ink-dim);">–</span><input type="number" class="tnum" id="cElMax" value="60" min="0" max="90" style="width:64px;"><span class="tnum" style="color:var(--ink-dim);">°</span></div>
    <div class="frow"><label>${T('Size','Tamaño')}</label><input type="number" class="tnum" id="cSize" value="40" min="5" max="120"><span class="tnum" id="cSizeU" style="color:var(--ink-dim);">°</span></div>
    <div class="frow" data-only="flatinf" id="cInfRow" style="display:none;"><label>${T('Extend','Extender')}</label><label style="display:flex;align-items:center;gap:6px;flex:1;font-size:11px;color:var(--ink-2);cursor:pointer;"><input type="checkbox" id="cInfinite"> ${T('Infinite (wrap around the room)','Infinito (envuelve la sala)')}</label></div>
    <div class="frow"><label>${T('Mask','Máscara')}</label><select id="cMask"><option value="none">${T('None','Ninguna')}</option><option value="circle">${T('Circle (alpha)','Círculo (alfa)')}</option><option value="rounded">${T('Rounded','Redondeada')}</option><option value="diamond">${T('Diamond','Rombo')}</option><option value="vignette">${T('Vignette','Viñeta')}</option></select></div>
    <div class="frow" data-only="tile"><label>${T('Tile','Mosaico')}</label><label style="display:flex;align-items:center;gap:6px;flex:1;font-size:11px;color:var(--ink-2);cursor:pointer;"><input type="checkbox" id="cTile"> ${T('Seamless dome tiling (perfect ring)','Mosaico continuo del domo (anillo perfecto)')}</label></div>
    <div class="frow" data-only="tileband"><label>${T('Band','Banda')}</label><input type="number" class="tnum" id="cBand" value="30" min="4" max="90"><span class="tnum" style="color:var(--ink-dim);">°</span></div>
    </div>
    <div style="width:236px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:8px;border-left:.5px solid rgba(255,255,255,0.09);padding-left:14px;">
      <span class="lab" style="width:auto;align-self:flex-start;color:var(--ink-2);font-size:11px;">${T('Preview','Vista previa')}</span>
      <canvas id="cPrev" width="222" height="222" style="border-radius:2px;"></canvas>
      <span class="tnum" style="font-size:11px;color:var(--ink-dim);text-align:center;line-height:1.4;" id="cPrevLbl"></span></div>
   </div>
   <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:11px;"><button class="mbtn" id="cCancel">${T('Cancel','Cancelar')}</button><button class="mbtn pri" id="cGo">${ICO('ring')} ${T('Create','Crear')}</button></div></div></div>`;
  document.body.appendChild(ov); $('#cCancel').onclick=()=>ov.remove(); ov.addEventListener('pointerdown',e=>{if(e.target===ov)ov.remove();});
  const checkedIds=()=>{ const ids=[...$('#cMedia').querySelectorAll('input:checked')].map(i=>+i.value); if(!ids.length){ const f=$('#cMedia').querySelector('input'); if(f)ids.push(+f.value); } return ids; };
  let _jit=(pre&&pre.jitter)||0, _rand=(pre&&pre.rand)?pre.rand.slice():[]; // R88: element-position randomize (jitter% + persisted seeds)
  const readForm=()=>{ const ids=checkedIds(); const rings=+($('#cRings')?$('#cRings').value:3)||3, segs=+($('#cSegs')?$('#cSegs').value:8)||8;
    return { id:(pre&&pre.id)||0, kind, mediaIds:ids, mediaId:ids[0], count:kind==='domegrid'?Math.min(160,rings*segs):Math.max(2,Math.min(32,+$('#cN').value||6)), cols:+$('#cCols').value||3, arc:+$('#cArc').value||140, el:+$('#cEl').value||30, elMin:+$('#cElMin').value||10, elMax:+$('#cElMax').value||60, size:+$('#cSize').value||40, turns:+($('#cTurns')?$('#cTurns').value:3)||3, lineRot:$('#cLineRot')?$('#cLineRot').checked:true, tile:$('#cTile')?$('#cTile').checked:false, band:+($('#cBand')?$('#cBand').value:30)||30, rings, segs, gapEl:+($('#cGapEl')?$('#cGapEl').value:0)||0, gapAz:+($('#cGapAz')?$('#cGapAz').value:0)||0, brick:$('#cBrick')?$('#cBrick').checked:false, shuffle:$('#cShuffle')?$('#cShuffle').checked:false, mask:$('#cMask').value, spin:(pre&&pre.spin)||0, rand:_rand, jitter:_jit, infinite:($('#cInfinite')?$('#cInfinite').checked:_infinite) }; };
  let reshuf=false; // "reshuffle" clicked → force a fresh media order on Create/Apply
  { // R88: Randomize row (jitter positions in ANY mode) — injected above the footer
    const jr=document.createElement('div'); jr.className='frow'; jr.style.marginTop='2px';
    jr.innerHTML=`<label>${T('Randomize','Aleatorizar')}</label><button class="mbtn" id="cRandomize" type="button" style="height:24px;padding:0 10px;font-size:11px;">${T('Shuffle positions','Mezclar posiciones')} ↻</button><input type="range" id="cJit" min="0" max="100" value="${_jit}" style="flex:1;height:20px;"><span class="tnum" id="cJitV" style="width:34px;text-align:right;color:var(--ink-2);">${_jit}%</span>`;
    const footer=$('#cGo').closest('div'); if(footer&&footer.parentNode)footer.parentNode.insertBefore(jr,footer);
    $('#cJit').oninput=()=>{ _jit=+$('#cJit').value; $('#cJitV').textContent=_jit+'%'; preview(); };
    $('#cRandomize').onclick=()=>{ _rand=[]; if(_jit<10){ _jit=35; $('#cJit').value=35; $('#cJitV').textContent='35%'; } preview(); }; } // fresh seeds + a default amount if it was off
  const preview=()=>{ const g=readForm(); drawComposePreview(g,$('#cPrev')); const lbl=$('#cPrevLbl'); if(lbl)lbl.textContent=g.count+' '+T('elements','elementos')+' · '+kindES(kind)+(g.tile?' · '+T('tiled','mosaico'):'')+(g.mediaIds.length>1?(' · '+g.mediaIds.length+' '+T('media','medios')):''); };
  const sync=()=>{ const lineRot=$('#cLineRot')&&$('#cLineRot').checked, tile=$('#cTile')&&$('#cTile').checked;
    if(_flatComp){ // flat/room: no dome params — only Count, Columns (grid), Scale, Infinite (room), Mask
      ov.querySelectorAll('[data-only]').forEach(el=>{ const mm=el.dataset.only; el.style.display=(mm==='count'||(mm==='flatinf'&&isRoom()))?'flex':'none'; });
      const colRow=$('#cCols')&&$('#cCols').closest('.frow'); if(colRow)colRow.style.display=(kind==='grid')?'flex':'none';
      const su=$('#cSizeU'); if(su)su.textContent='%'; const sl=$('#cSize')?$('#cSize').closest('.frow').querySelector('label'):null; if(sl)sl.textContent=T('Scale','Escala');
      preview(); return; }
    ov.querySelectorAll('[data-only]').forEach(el=>{ const mm=el.dataset.only; let show;
      if(mm==='ring')show=(kind==='ring'); else if(mm==='grid')show=(kind==='grid'); else if(mm==='spiralwave')show=(kind==='spiral'||kind==='wave'); else if(mm==='line')show=(kind==='line');
      else if(mm==='domegrid')show=(kind==='domegrid'); else if(mm==='count')show=(kind!=='domegrid');
      else if(mm==='tile')show=(kind==='ring'||kind==='grid'); else if(mm==='tileband')show=(kind==='ring'&&tile);
      else if(mm==='gridrand'){ show = (kind!=='ring'&&kind!=='line'); } else if(mm==='flatinf'){ show=false; } else show=false; // elev range = grid/spiral/.../domegrid coverage (line is full-diameter, no range)
      el.style.display=show?'flex':'none'; }); preview(); };
  const domegridDefaults=()=>{ if(kind==='domegrid'&&!pre){ if($('#cElMin'))$('#cElMin').value=0; if($('#cElMax'))$('#cElMax').value=90; } }; // dome fill = whole dome (horizon→zenith) by default → no central black hole
  $('#cKind').querySelectorAll('button').forEach(b=>b.onclick=()=>{ kind=b.dataset.k; domegridDefaults(); $('#cKind').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b)); sync(); });
  ['#cN','#cTurns','#cCols','#cArc','#cEl','#cElMin','#cElMax','#cSize','#cMask','#cBand','#cRings','#cSegs','#cGapEl','#cGapAz'].forEach(id=>{ const el=ov.querySelector(id); if(el){ el.oninput=preview; el.onchange=preview; } });
  $('#cMedia').addEventListener('change',preview); const lr=$('#cLineRot'); if(lr)lr.onchange=sync; const ct=$('#cTile'); if(ct)ct.onchange=sync; const cb=$('#cBrick'); if(cb)cb.onchange=preview;
  { const csc=$('#cScroll'); if(csc)csc.onchange=preview; const cscs=$('#cScrollSpd'); if(cscs){ cscs.oninput=preview; cscs.onchange=preview; } }
  { const ci=$('#cInfinite'); if(ci){ ci.checked=_infinite; ci.onchange=()=>{ _infinite=ci.checked; preview(); }; } }
  { const cs=$('#cShuffle'); if(cs)cs.onchange=()=>{ reshuf=true; preview(); }; const crs=$('#cReshuffle'); if(crs)crs.onclick=()=>{ reshuf=true; if(pre)pre._orderR=true; if($('#cShuffle'))$('#cShuffle').checked=true; flashStatus(T('Order reshuffled — Apply to see it','Orden rebarajado — Aplica para verlo')); }; }
  if(pre){ $('#cKind').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x.dataset.k===kind));
    const preIds=(pre.mediaIds&&pre.mediaIds.length)?pre.mediaIds:(pre.mediaId!=null?[pre.mediaId]:[]);
    $('#cMedia').querySelectorAll('input').forEach(i=>{ i.checked=preIds.includes(+i.value); });
    $('#cN').value=pre.count; $('#cCols').value=pre.cols; $('#cArc').value=pre.arc; $('#cEl').value=pre.el; $('#cElMin').value=pre.elMin; $('#cElMax').value=pre.elMax; $('#cSize').value=pre.size; if($('#cTurns'))$('#cTurns').value=pre.turns||3; if(lr)lr.checked=(pre.lineRot!==false); if($('#cTile'))$('#cTile').checked=!!pre.tile; if($('#cBand'))$('#cBand').value=pre.band||30; if($('#cRings'))$('#cRings').value=pre.rings||3; if($('#cSegs'))$('#cSegs').value=pre.segs||8; if($('#cGapEl'))$('#cGapEl').value=pre.gapEl||0; if($('#cGapAz'))$('#cGapAz').value=pre.gapAz||0; if($('#cBrick'))$('#cBrick').checked=!!pre.brick; if($('#cShuffle'))$('#cShuffle').checked=!!pre.shuffle; if($('#cScroll'))$('#cScroll').checked=!!pre.scroll; if($('#cScrollSpd'))$('#cScrollSpd').value=(pre.scrollSpeed!=null?pre.scrollSpeed:20); $('#cMask').value=pre.mask;
    const tt=ov.querySelector('.t'); if(tt)tt.textContent=nestMedia?T('Recompose','Recomponer'):T('Edit composition','Editar composición'); $('#cGo').innerHTML=ICO('ring')+' '+T('Apply','Aplicar'); }
  else if(scopeClip){ const mid=scopeClip.mediaId; $('#cMedia').querySelectorAll('input').forEach(i=>{ i.checked=(+i.value===mid); }); const tt=ov.querySelector('.t'); if(tt)tt.textContent=T('Compose from clip','Componer desde el clip'); } // scope: only this clip's media
  else if(preselIds&&preselIds.length){ const set=new Set(preselIds); $('#cMedia').querySelectorAll('input').forEach(i=>{ i.checked=set.has(+i.value); }); if(preselIds.length>1&&$('#cShuffle'))$('#cShuffle').checked=true; } // R88: compose from a media multi-selection
  else { const f0=$('#cMedia').querySelector('input'); if(f0)f0.checked=true; } // default-select the first media for a new composition
  domegridDefaults(); sync();
  $('#cGo').onclick=()=>{ const ids=checkedIds(); const first=mediaById(ids[0]);
    const opts={ kind, mediaIds:ids, mediaId:ids[0], count:Math.max(2,Math.min(32,+$('#cN').value)), cols:+$('#cCols').value, arc:+$('#cArc').value,
      el:+$('#cEl').value, elMin:+$('#cElMin').value, elMax:+$('#cElMax').value, size:+$('#cSize').value, turns:+($('#cTurns')?$('#cTurns').value:3), lineRot:lr?lr.checked:true, tile:$('#cTile')?$('#cTile').checked:false, band:+($('#cBand')?$('#cBand').value:30)||30, rings:+($('#cRings')?$('#cRings').value:3)||3, segs:+($('#cSegs')?$('#cSegs').value:8)||8, gapEl:+($('#cGapEl')?$('#cGapEl').value:0)||0, gapAz:+($('#cGapAz')?$('#cGapAz').value:0)||0, brick:$('#cBrick')?$('#cBrick').checked:false, shuffle:$('#cShuffle')?$('#cShuffle').checked:false, scroll:$('#cScroll')?$('#cScroll').checked:false, scrollSpeed:+($('#cScrollSpd')?$('#cScrollSpd').value:20)||0, mask:$('#cMask').value, jitter:_jit, rand:_rand, name:(pre&&pre.name)?pre.name:((first?first.name:'')+(ids.length>1?' +'+(ids.length-1):'')+' · '+kindES(kind)) };
    if(kind==='domegrid')opts.count=Math.min(160,(opts.rings||3)*(opts.segs||8));
    if(nestMedia){ pushUndo(); nestMedia.comp=Object.assign(nestMedia.comp||{id:uid(),spin:0,shuffle:false,rand:[]},opts); if(reshuf)nestMedia.comp._orderR=true; regenComposeNest(nestMedia); renderMedia(); renderTimeline(); renderInspector(); scrubRender(); updStatus(); markDirty(); flashStatus(T('Composition updated','Composición actualizada')); }
    else if(editGroup){ pushUndo(); Object.assign(editGroup,opts,{mediaId:ids[0]}); regenComp(editGroup); state.selGroupId=editGroup.id; state.selId=null; renderTimeline(); renderInspector(); render(); updStatus(); flashStatus(T('Composition updated','Composición actualizada')); }
    else { if(scopeClip)opts._scope={inP:scopeClip.inP||0, dur:scopeClip.dur, start:scopeClip.start, speed:scopeClip.speed||1}; createComposition(opts); }
    ov.remove(); };
}

/* ===================== I18N (apply language to static chrome) ===================== */
function setLang(l){ state.lang=(l==='es')?'es':'en'; try{localStorage.setItem('domeProLang',state.lang);}catch(e){} try{if(IS_ELEC&&DSP.setUiState)DSP.setUiState({dirty:!!state.dirty,lang:state.lang});}catch(e){}
  applyLang(); renderMedia(); renderTimeline(); renderInspector(); updStatus(); render(); }
function applyLang(){ const L=state.lang; document.documentElement.lang=L;
  const txt=(s,en,es)=>{const e=$(s);if(e)e.textContent=T(en,es);};
  const ttl=(s,en,es)=>{const e=$(s);if(e)e.title=T(en,es);};
  const ph=(s,en,es)=>{const e=$(s);if(e)e.placeholder=T(en,es);};
  const tn=(s,en,es)=>{const e=$(s);if(!e)return;const last=e.lastChild;if(last&&last.nodeType===3)last.textContent=' '+T(en,es);else e.textContent=T(en,es);};
  tn('#menubar [data-menu=file]','File','Archivo'); tn('#menubar [data-menu=edit]','Edit','Editar'); tn('#menubar [data-menu=window]','Window','Ventana'); // [R135] app menu bar
  tn('#newBtn','New','Nuevo'); ttl('#newBtn','New project · Ctrl+N','Nuevo proyecto · Ctrl+N');
  tn('#openBtn','Open','Abrir'); ttl('#openBtn','Open project · Ctrl+O','Abrir proyecto · Ctrl+O');
  tn('#saveBtn','Save','Guardar'); ttl('#saveBtn','Save · Ctrl+S · right-click for Save As','Guardar · Ctrl+S · clic derecho para Guardar como');
  tn('#exportBtn','Export','Exportar'); ttl('#exportBtn','Export · Ctrl+Shift+E','Exportar · Ctrl+Shift+E');
  ttl('#statXBtn','Cancel export','Cancelar exportación'); // [R94-UT3·U-02c]
  ttl('#undoBtn','Undo · Ctrl+Z','Deshacer · Ctrl+Z'); ttl('#redoBtn','Redo · Ctrl+Shift+Z','Rehacer · Ctrl+Shift+Z'); // [U-07]
  ttl('#helpBtn','All commands & shortcuts · F1','Todos los comandos y atajos · F1'); // [U-08]
  ttl('#mediaRail','Expand media panel','Expandir panel de medios'); txt('#mediaRail .rlab','Media','Medios');
  txt('#mediaPane .pantab .ttl','Media','Medios');
  ttl('#newFolderBtn','New folder','Nueva carpeta'); ttl('#importBtn','Import media','Importar medios'); ttl('#textBtn','Add text / title','Añadir texto / título'); ttl('#shapeBtn','Add shape','Añadir forma'); ttl('#hideMedia','Hide panel','Ocultar panel');
  txt('#filtSeg button[data-f="all"]','All','Todos');
  ttl('#filtSeg button[data-f="video"]','Video','Vídeo'); ttl('#filtSeg button[data-f="image"]','Image','Imagen'); ttl('#filtSeg button[data-f="audio"]','Audio','Audio');
  txt('#groupLbl','Group','Agrupar');
  txt('#groupSeg button[data-g="none"]','None','Ninguno'); txt('#groupSeg button[data-g="folder"]','Folder','Carpeta'); txt('#groupSeg button[data-g="type"]','Type','Tipo');
  tn('#ringBtn','Compose','Componer'); ttl('#ringBtn','Create composition (ring / grid / random)','Crear composición (anillo / cuadrícula / aleatorio)');
  tn('#adjLayerBtn','Adjust','Ajuste'); ttl('#adjLayerBtn','Create an adjustment layer — its Reactive FX affect everything below it','Crear una capa de ajuste — sus FX reactivos afectan todo lo de debajo');
  if(isFlat()){ tn('#viewModeSeg button[data-v="2d"]','2D Master','Máster 2D'); }else{ tn('#viewModeSeg button[data-v="2d"]','Dome Master','Máster de domo'); } // [U-42]
  if(isRoom()){ tn('#viewModeSeg button[data-v="3d"]','3D Room','Sala 3D'); }else{ tn('#viewModeSeg button[data-v="3d"]','3D Preview','Vista 3D'); } // [U-42] respect the per-mode relabel from updModeUI
  tn('#threeModeSeg button[data-m="spec"]','Viewer','Espectador'); tn('#threeModeSeg button[data-m="orbit"]','Orbit','Órbita');
  tn('#dispSeg button[data-d="grid"]','Grid','Cuadrícula'); tn('#dispSeg button[data-d="safe"]','Safe','Zona segura'); tn('#dispSeg button[data-d="outline"]','Outline','Contorno'); tn('#dispSeg button[data-d="hfade"]','Horizon','Horizonte');
  ttl('#qualitySeg','Preview quality (does not affect export)','Calidad de previsualización (no afecta la exportación)');
  ttl('#proxyToggle','Viewport uses proxies (faster). Turn off to preview the original clips.','El visor usa proxies (más rápido). Desactiva para ver los clips originales.');
  ttl('#popoutBtn','Open a viewer-only window — drag it to a second screen','Abrir una ventana solo-visor — arrástrala a una segunda pantalla');
  ttl('#ndiBtn','NDI output — broadcast the clean Dome master (1:1) over the network','Salida NDI — transmite el máster Domo limpio (1:1) por la red');
  txt('#qualitySeg button[data-q="1"]','Full','Completa');
  ttl('#inspRail','Expand inspector','Expandir inspector'); txt('#inspRail .rlab','Inspector','Inspector');
  txt('#inspPane .pantab .ttl','Inspector','Inspector'); ttl('#hideInsp','Collapse panel','Contraer panel');
  const ie=$('#insEmpty'); if(ie){ ie.innerHTML='<span style="opacity:.5;"><i class="ic" data-ico="panel" data-s="26"></i></span>'+T('Select a clip','Selecciona un clip')+'<br>'+T('in the timeline or viewport','en la línea de tiempo o el visor'); const ic=ie.querySelector('[data-ico]'); if(ic){ic.innerHTML=ICO(ic.dataset.ico,+ic.dataset.s||13);ic.style.display='inline-flex';} }
  { const secLbl=(sec,en,es)=>{const h=document.querySelector('#insCtl .sechead[data-sec="'+sec+'"] .t'); if(h)h.textContent=T(en,es);}; secLbl('tf',isFlat()?'Transform':'Dome · Transform',isFlat()?'Transformar':'Domo · Transformar'); secLbl('clip','Clip','Clip'); secLbl('color','Color','Color'); secLbl('motion','Motion','Movimiento'); }
  tn('#mirrorBtn','Mirror','Reflejar');
  ttl('#toStart','Go to start · Home','Ir al inicio · Inicio'); ttl('#playBtn','Play / Pause · Space','Reproducir / Pausar · Espacio'); ttl('#toEnd','Go to end · End','Ir al final · Fin'); ttl('#loopBtn','Loop selection · Ctrl+L','Bucle de selección · Ctrl+L');
  ttl('#prevMk','Previous locator · ,','Localizador anterior · ,'); ttl('#addMk','Add locator · L','Añadir localizador · L'); ttl('#nextMk','Next locator · .','Localizador siguiente · .');
  ttl('#bpmBox','Tempo — drag to change','Tempo — arrastra para cambiar');
  txt('#tcModeSeg button[data-t="frames"]','Frames','Fotogramas'); txt('#tcModeSeg button[data-t="bars"]','Bars','Compases');
  ttl('#markIn','Mark In · I (right-click clears the range)','Marcar entrada · I (clic derecho borra el rango)'); ttl('#markOut','Mark Out · O (right-click clears the range)','Marcar salida · O (clic derecho borra el rango)'); // [R94e]
  ttl('#snapBtn','Snap to Grid · S','Ajustar a la cuadrícula · S'); // [U1] icon-only
  tn('#simpleClipBtn','Simple','Simple'); ttl('#simpleClipBtn','Simple clips (Premiere-style): drag and select a clip from anywhere on it — range selection works outside clips only','Clips simples (estilo Premiere): arrastra y selecciona el clip desde cualquier punto — la selección de rango solo funciona fuera de los clips'); // [R94c]
  ttl('#curvesBtn','Show/hide automation (clip parameters + reactive FX) · A','Mostrar/ocultar automatización (parámetros del clip + FX reactivos) · A'); // [U1] icon-only
  ttl('#tlZoomOut','Zoom out timeline','Alejar línea de tiempo'); ttl('#tlZoomIn','Zoom in timeline','Acercar línea de tiempo');
  ttl('#toolRail button[data-t="select"]','Select (V)','Seleccionar (V)'); ttl('#toolRail button[data-t="hand"]','Hand / Pan (H)','Mano / Desplazar (H)'); ttl('#toolRail button[data-t="razor"]','Razor (B / C)','Cuchilla (B / C)'); ttl('#toolRail button[data-t="zoom"]','Zoom (Z)','Zoom (Z)');
  if(!state.lastSaved){ const sa=$('#statAuto'); if(sa)sa.textContent=T('Ready','Listo'); }
  projTitle();
}

/* ===================== HOVER TOOLTIPS (≈1s) ===================== */
(function tooltips(){ let tip=null, timer=0, curEl=null;
  function ensure(){ if(!tip){ tip=document.createElement('div'); tip.className='dsp-tip'; document.body.appendChild(tip); } return tip; }
  function hide(){ clearTimeout(timer); timer=0; if(tip){ tip.classList.remove('show'); tip.style.left='-9999px'; } curEl=null; }
  /* convert native title→data-tip once, so the OS tooltip never double-shows and the text survives (also mirror to aria-label) */
  function tipText(el){ if(el.hasAttribute('title')){ const t=el.getAttribute('title')||''; if(t){ el.setAttribute('data-tip',t); if(!el.getAttribute('aria-label'))el.setAttribute('aria-label',t); } el.removeAttribute('title'); } return el.getAttribute('data-tip')||''; }
  function showFor(el){ const txt=tipText(el); if(!txt)return; const t=ensure(); t.textContent=txt;
    const r=el.getBoundingClientRect(); t.style.left='-9999px'; t.style.top='0px'; t.classList.add('show');
    const tr=t.getBoundingClientRect(); let x=r.left+r.width/2-tr.width/2; let y=r.top-tr.height-7;
    if(y<4){ y=r.bottom+7; } x=Math.max(4,Math.min(innerWidth-tr.width-4,x)); t.style.left=x+'px'; t.style.top=y+'px'; }
  /* [R102·D-T4] Info View: mismo texto, pero AL INSTANTE y abajo a la izquierda, donde no tapa nada. El
     tooltip flotante sigue saliendo a 1s para quien se queda quieto; la barra es para quien está trabajando.
     Contrato del tooltip (HIG de Blender): "Nombre — qué hace · ATAJO". Se parte por el primer guión largo o
     paréntesis, así que los 151 títulos que ya existen funcionan sin reescribir ninguno. */
  const info=()=>document.getElementById('statInfo');
  function setInfo(el){ const bar=info(); if(!bar)return;
    if(!el){ bar.textContent=''; bar.classList.remove('why'); return; }
    const txt=(el.getAttribute('data-tip')||'').trim(); if(!txt){ bar.textContent=''; bar.classList.remove('why'); return; }
    // Ámbar SOLO con un motivo explícito (data-why, que pone setDis). Un control bloqueado sin motivo se lee
    // como cualquier otro: mejor no decir nada que inventar una causa.
    const why=el.dataset&&el.dataset.why;
    bar.classList.toggle('why',!!why);
    if(why){ bar.textContent=why; return; }
    /* [R102·rev] Se extrae el ATAJO PRIMERO y luego se parte nombre/descripción. La versión anterior hacía lo
       contrario: partía por el primer delimitador, y como `(` era uno de ellos, "Trim (T) — the cursor picks
       it…" se cortaba DENTRO del paréntesis → salía «Trim — T) — the cursor picks it…», con el paréntesis
       huérfano (el `replace(/\)$/)` sólo quitaba paréntesis FINALES) y sin detectar el atajo.
       Además el código tiene DOS convenciones de tooltip y la anterior sólo entendía una:
         "Select (V)" · "Trim (T) — descripción"   → atajo entre paréntesis
         "Undo · Ctrl+Z"                            → atajo tras un ·
       Aquí se aceptan las dos. */
    const SC='(?:Ctrl|Shift|Alt|⌘|⇧|⌥)\\+\\S+|[A-Z0-9]';
    let body=txt, sc='';
    let mm=body.match(new RegExp('\\s*\\((' + SC + ')\\)'));                 // "(V)" / "(Ctrl+Z)", esté donde esté
    if(mm){ sc=mm[1]; body=(body.slice(0,mm.index)+body.slice(mm.index+mm[0].length)).trim(); }
    else { mm=body.match(new RegExp('\\s*·\\s*(' + SC + ')\\s*$')); if(mm){ sc=mm[1]; body=body.slice(0,mm.index).trim(); } }
    const md=body.match(/^(.+?)\s*(?:—|–|\s-\s)\s*(.*)$/);                  // "Nombre — descripción"
    const name=(md?md[1]:body).trim(), desc=md?md[2].trim():'';
    bar.innerHTML='';
    const k=document.createElement('span'); k.className='k'; k.textContent=name; bar.appendChild(k); // textContent, no innerHTML: el texto no puede inyectar marcado
    if(desc)bar.appendChild(document.createTextNode(' — '+desc));
    if(sc){ const s=document.createElement('span'); s.className='sc'; s.textContent=sc; bar.appendChild(s); }
  }
  document.addEventListener('pointerover',e=>{ const el=e.target.closest&&e.target.closest('[title],[data-tip]'); if(!el||el===curEl)return; hide(); curEl=el; tipText(el); /* strip native title now */ setInfo(el); timer=setTimeout(()=>{ if(curEl===el&&el.isConnected)showFor(el); },1000); });
  document.addEventListener('pointerout',e=>{ if(curEl&&!curEl.contains(e.relatedTarget)){ hide(); setInfo(null); } });
  document.addEventListener('pointerdown',()=>hide(),true);
  window.addEventListener('blur',()=>hide());
})();

/* live CPU / RAM / GPU usage in the status bar (CPU% normalized to all cores, RAM = app working set, GPU via nvidia-smi) */
function fmtMB(mb){ return (mb>=1024)?(mb/1024).toFixed(1)+' GB':Math.round(mb)+' MB'; }
let _perfTimer=null;
function startPerfMeters(){ const el=$('#statPerf'); if(!el||_perfTimer)return;
  const tick=async()=>{ try{
    if(IS_ELEC&&DSP.metrics){ const m=await DSP.metrics(); if(!m)return; const parts=[];
      parts.push('CPU '+(m.cpu!=null?m.cpu+'%':'—'));
      parts.push('RAM '+fmtMB(m.ramMB));
      if(m.gpuUtil!=null){ let g='GPU '+Math.round(m.gpuUtil)+'%'; if(m.gpuMemUsed!=null&&m.gpuMemTotal)g+=' '+(m.gpuMemUsed/1024).toFixed(1)+'/'+(m.gpuMemTotal/1024).toFixed(1)+' GB'; parts.push(g); }
      else parts.push('GPU '+T('n/a','n/d'));
      el.textContent=parts.join('   ·   ');
    } else if(window.performance&&performance.memory){ el.textContent='RAM '+fmtMB(Math.round(performance.memory.usedJSHeapSize/1048576)); } }catch(e){} };
  tick(); _perfTimer=setInterval(tick,1500); }
/* ===================== AUDIO-REACTIVE FX ("Reactive FX") =====================
   Resolume/TouchDesigner-style reactive chain. Offline per-band audio analysis
   (bass/mid/treble/bright + per-band spectral-flux onsets + BPM/beat-phase) drives a
   reorderable chain of GPU post-process passes applied to a clip's texture BEFORE
   dome/2D placement — identical in dome and flat. Analysis is precomputed +
   time-addressed → preview and export are frame-deterministic. ROUND 76 modulation:
   per-effect attack/release, response curve, invert, spring (Lag-CHOP bounce),
   BPM-synced LFOs (sine/tri/saw/square/S&H) and per-band ADSR triggers. */
if(!state.inspTab)state.inspTab='insp';

/* ---- offline per-band analysis: OfflineAudioContext biquad split → RMS envelopes + per-band spectral-flux
   onsets (kick/snare/hat-style triggers) + BPM/beat-phase (autocorrelation) + brightness band. Format v2. ---- */
const AR_SR=16000, AR_FPS=90;
/* ===================== [R95·C2] REAL SPECTRUM (for "draw the band on the spectrum") =====================
   computeBands is a 3-filter bank — it can never answer "give me 220–480 Hz". So: ONE extra pass with our own radix-2 FFT
   over the decimated mono signal → SPEC_BINS log-spaced bands per frame. One pass (not N offline renders, which would be
   ~288 MB each on a 75-min track), ~17 MB for a feature film, and it leaves m.bands untouched so Reactive FX can't break. */
const SPEC_BINS=32, SPEC_F0=40, SPEC_F1=12000, SPEC_SR=16000, SPEC_FFT=1024; // decimate to 16 kHz first → bin = 15.6 Hz regardless of the source rate (at 44.1 kHz a 512-pt FFT gives 86 Hz bins: bass was unusable and a 100 Hz tone landed two bands off)
function _fftRadix2(re,im){ const n=re.length; for(let i=1,j=0;i<n;i++){ let bit=n>>1; for(;j&bit;bit>>=1)j^=bit; j^=bit; if(i<j){ const tr=re[i];re[i]=re[j];re[j]=tr; const ti=im[i];im[i]=im[j];im[j]=ti; } }
  for(let len=2;len<=n;len<<=1){ const ang=-2*Math.PI/len, wr=Math.cos(ang), wi=Math.sin(ang);
    for(let i=0;i<n;i+=len){ let cr=1,ci=0;
      for(let k=0;k<len/2;k++){ const ur=re[i+k],ui=im[i+k]; const vr=re[i+k+len/2]*cr-im[i+k+len/2]*ci, vi=re[i+k+len/2]*ci+im[i+k+len/2]*cr;
        re[i+k]=ur+vr; im[i+k]=ui+vi; re[i+k+len/2]=ur-vr; im[i+k+len/2]=ui-vi; const ncr=cr*wr-ci*wi; ci=cr*wi+ci*wr; cr=ncr; } } } }
function specBandEdges(){ const e=new Float32Array(SPEC_BINS+1); const l0=Math.log(SPEC_F0), l1=Math.log(SPEC_F1); for(let i=0;i<=SPEC_BINS;i++)e[i]=Math.exp(l0+(l1-l0)*i/SPEC_BINS); return e; }
async function computeSpectrum(ab){ if(!ab)return null;
  const dur=ab.duration||0, n=Math.max(2,Math.round(dur*AR_FPS)); if(!dur)return null;
  // decimate to SPEC_SR with box-average anti-aliasing → fixed resolution + cost independent of the source rate
  const src=ab.getChannelData(0), sr0=ab.sampleRate; const dec=Math.max(1,Math.round(sr0/SPEC_SR)); const sr=sr0/dec;
  const dl=Math.floor(src.length/dec); const ch=new Float32Array(dl);
  for(let i=0;i<dl;i++){ let s=0; for(let j=0;j<dec;j++)s+=src[i*dec+j]||0; ch[i]=s/dec; }
  const hop=Math.max(1,Math.floor(sr/AR_FPS));
  const edges=specBandEdges(); const binHz=sr/SPEC_FFT; const win=new Float32Array(SPEC_FFT); for(let i=0;i<SPEC_FFT;i++)win[i]=0.5-0.5*Math.cos(2*Math.PI*i/(SPEC_FFT-1)); // Hann
  const out=new Float32Array(n*SPEC_BINS); const re=new Float32Array(SPEC_FFT), im=new Float32Array(SPEC_FFT);
  for(let f=0;f<n;f++){
    const s0=f*hop; for(let i=0;i<SPEC_FFT;i++){ const s=s0+i; re[i]=(s<ch.length?ch[s]:0)*win[i]; im[i]=0; }
    _fftRadix2(re,im);
    for(let b=0;b<SPEC_BINS;b++){ const k0=Math.max(1,Math.round(edges[b]/binHz)), k1=Math.max(k0,Math.min(SPEC_FFT/2-1,Math.round(edges[b+1]/binHz)-1)); // −1: bands must be EXCLUSIVE at the top edge. Sharing the boundary bin made a tone show up in two bands with the same peak, and the lower one won → every tone read one band flat.
      let pk=0; for(let k=k0;k<=k1;k++){ const mg=Math.sqrt(re[k]*re[k]+im[k]*im[k]); if(mg>pk)pk=mg; } out[f*SPEC_BINS+b]=pk; } // PEAK, not mean: averaging let a wide low band that clipped one hot bin beat the narrow band the tone actually sits in
    if((f&1023)===0)await new Promise(r=>setTimeout(r,0)); } // yield: a 75-min track is ~135k frames — never block the UI
  { let mx=0; for(let i=0;i<out.length;i++)if(out[i]>mx)mx=out[i]; const inv=1/Math.max(1e-6,mx); for(let i=0;i<out.length;i++)out[i]=out[i]*inv; } // normalise to the track's peak and STOP: an extra ×3.2 "headroom" clipped neighbouring bands to 1.0 each, so leakage tied with the real peak and the lowest band won every time. Visual gain belongs in the painter; loudness gain is the user's gain/gate.
  return {data:out,frames:n,bins:SPEC_BINS,fps:AR_FPS,f0:SPEC_F0,f1:SPEC_F1}; }
/* the raw envelope of an arbitrary f0..f1 window, built on demand from the spectrum and cached on the media */
function specRangeRaw(f0,f1){ const m=_arCache&&_arCache.clip&&mediaById(_arCache.clip.mediaId); const sp=m&&m.spec; if(!sp)return null;
  const key='r'+Math.round(f0)+'-'+Math.round(f1); m._specRaw=m._specRaw||{}; if(m._specRaw[key])return m._specRaw[key];
  const edges=specBandEdges(); const lo=Math.min(f0,f1), hi=Math.max(f0,f1);
  const out=new Float32Array(sp.frames); const cfg=ensureReactive(); const g=Math.max(0,cfg.gain/100), gate=Math.max(0,Math.min(0.95,cfg.gate/100)), gs=1/Math.max(0.05,1-gate);
  for(let f=0;f<sp.frames;f++){ let acc=0,cnt=0;
    for(let b=0;b<sp.bins;b++){ const c0=edges[b],c1=edges[b+1]; if(c1<lo||c0>hi)continue; acc+=sp.data[f*sp.bins+b]; cnt++; }
    let x=cnt?acc/cnt:0; x=(x-gate)*gs; if(x<0)x=0; x*=g; out[f]=x>1?1:x; }
  if(Object.keys(m._specRaw).length>24)m._specRaw={}; m._specRaw[key]=out; return out; }
function armMediaSpectrum(m,ab){ if(!m||m.spec||m._specBusy)return; if(!ab)ab=m.buffer; if(!ab)return; m._specBusy=true;
  computeSpectrum(ab).then(sp=>{ m.spec=sp; m._specBusy=false; try{ if(_modPanel)refreshModFormula(); }catch(e){} }).catch(()=>{ m._specBusy=false; }); }
async function computeBands(ab){ if(typeof OfflineAudioContext==='undefined'||!ab)return null;
  const dur=Math.max(0.05,ab.duration||0.05), n=Math.max(2,Math.round(dur*AR_FPS)), len=Math.max(1,Math.ceil(dur*AR_SR));
  const renderBand=async(build)=>{ const oc=new OfflineAudioContext(1,len,AR_SR); const src=oc.createBufferSource(); src.buffer=ab; let node=src; for(const f of build(oc)){ node.connect(f); node=f; } node.connect(oc.destination); src.start(); const rb=await oc.startRendering(); return rb.getChannelData(0); };
  const lp=(oc,f)=>{ const b=oc.createBiquadFilter(); b.type='lowpass'; b.frequency.value=f; b.Q.value=0.7; return b; };
  const hp=(oc,f)=>{ const b=oc.createBiquadFilter(); b.type='highpass'; b.frequency.value=f; b.Q.value=0.7; return b; };
  const env=async(d)=>{ const out=new Float32Array(n), hop=d.length/n, step=Math.max(1,Math.floor(4e6/Math.max(1,hop))); // ~4M input samples per slice → the UI never stalls on long tracks
    for(let i0=0;i0<n;i0+=step){ const i1=Math.min(n,i0+step);
      for(let i=i0;i<i1;i++){ let s=Math.floor(i*hop),e=Math.floor((i+1)*hop); if(e<=s)e=s+1; if(e>d.length)e=d.length; let ss=0; for(let j=s;j<e;j++){const v=d[j]||0;ss+=v*v;} out[i]=Math.sqrt(ss/(e-s)); }
      if(i1<n)await new Promise(r=>setTimeout(r,0)); }
    return out; };
  const norm=(a)=>{ const s=Float32Array.from(a).sort(); const p=s[Math.min(s.length-1,Math.floor(s.length*0.98))]||1e-6, inv=1/Math.max(1e-4,p); for(let i=0;i<a.length;i++){ const v=a[i]*inv; a[i]=v>1?1:v; } return a; };
  // render → envelope per band SEQUENTIALLY: each 16kHz render of a long track is huge (75 min ≈ 288 MB) — envelope it and drop it before rendering the next (peak = 1 render, not 3)
  const ping=(i)=>{ try{ if(dur>120)flashStatus(T('Analyzing audio bands… ','Analizando bandas de audio… ')+i+'/3'); }catch(e){} }; // progress only for long tracks
  ping(1); const eB=await env(await renderBand(oc=>[lp(oc,160),lp(oc,160)]));
  ping(2); const eM=await env(await renderBand(oc=>[hp(oc,300),lp(oc,2600)]));
  ping(3); const eT=await env(await renderBand(oc=>[hp(oc,3500)]));
  const bright=new Float32Array(n); for(let i=0;i<n;i++){ const tot=eB[i]+eM[i]+eT[i]; bright[i]=tot>1e-5?eT[i]/tot:0; } // spectral-brightness proxy: treble share of total energy (before normalization)
  norm(eB); norm(eM); norm(eT); norm(bright);
  // spectral flux = rectified envelope derivative; adaptive-threshold peak-picking (prefix sums → O(N))
  const flux=(a)=>{ const f=new Float32Array(a.length); for(let i=1;i<a.length;i++){ const d=a[i]-a[i-1]; f[i]=d>0?d:0; } return f; };
  const pickOnsets=(f,minSep)=>{ const N=f.length, W=Math.round(AR_FPS*0.5); const cs=new Float64Array(N+1), cs2=new Float64Array(N+1);
    for(let i=0;i<N;i++){ cs[i+1]=cs[i]+f[i]; cs2[i+1]=cs2[i]+f[i]*f[i]; }
    const out=[]; let last=-9;
    for(let i=2;i<N-2;i++){ const v=f[i]; if(v<f[i-1]||v<f[i-2]||v<f[i+1]||v<f[i+2])continue; // local max
      const a=Math.max(0,i-W), b=Math.min(N,i+W), cnt=b-a; const mean=(cs[b]-cs[a])/cnt; const sd=Math.sqrt(Math.max(0,(cs2[b]-cs2[a])/cnt-mean*mean));
      if(v>mean+sd*1.4+0.015 && (i/AR_FPS-last)>=minSep){ out.push(i/AR_FPS); last=i/AR_FPS; } }
    return out; };
  const fB=flux(eB), fM=flux(eM), fT=flux(eT);
  const onsets={bass:pickOnsets(fB,0.12),mid:pickOnsets(fM,0.09),treble:pickOnsets(fT,0.05)};
  const comb=new Float32Array(n); for(let i=0;i<n;i++)comb[i]=fB[i]*2+fM[i]+fT[i]*0.8; // combined onset strength (bass-weighted)
  // BPM via autocorrelation on a ≤150s middle slice (cost cap), folded to 70-180; beat phase = best-aligned grid offset
  let bpm=0, beat0=0;
  { const S=Math.min(n,AR_FPS*150), off0=Math.max(0,Math.floor((n-S)/2)); const seg=comb.subarray(off0,off0+S);
    const lo=Math.round(AR_FPS*60/200), hi=Math.min(S-2,Math.round(AR_FPS*60/60)); let bl=0,bs=-1;
    for(let lag=lo;lag<=hi;lag++){ let s=0; for(let i=0;i+lag<S;i++)s+=seg[i]*seg[i+lag]; s/=Math.max(1,S-lag); if(s>bs){bs=s;bl=lag;} }
    if(bl>0&&bs>1e-7){ bpm=60*AR_FPS/bl; while(bpm<70)bpm*=2; while(bpm>180)bpm/=2;
      const per=60*AR_FPS/bpm, K=Math.floor((S-1)/per); let bo=0,bv=-1;
      for(let off=0;off<per;off++){ let s=0; for(let k=0;k<=K;k++){ const idx=Math.round(off+k*per); if(idx<S)s+=seg[idx]; } if(s>bv){bv=s;bo=off;} }
      const abs0=(bo+off0)/AR_FPS, perS=60/bpm; beat0=abs0-Math.floor(abs0/perS)*perS; } // reduce to phase anchor near t=0
  }
  let beats=pickOnsets(comb,0.10); if(!beats.length){ try{ beats=detectBeats(ab)||[]; }catch(e){} }
  return {v:2,fps:AR_FPS,dur,bass:eB,mid:eM,treble:eT,bright,onsets,beats,bpm:Math.round(bpm*10)/10,beat0}; }
function armMediaBands(m,ab){ if(!m||m.bands||m._bandsBusy)return; if(!ab)ab=m.buffer; if(!ab)return; m._bandsBusy=true;
  try{ flashStatus(T('Analyzing audio bands…','Analizando bandas de audio…')); }catch(e){}
  computeBands(ab).then(bd=>{ m._bandsBusy=false; if(!bd)return; m.bands=bd; if(reactiveSourceMedia()===m){ arRecompute(); if(_raOn)raInvalidate(); try{render();}catch(e){} if(state.inspTab==='react')renderReactivePanel(); } try{ flashStatus(T('Audio bands ready','Bandas de audio listas')); }catch(e){}
    armMediaSpectrum(m,ab); }) // [R95·C2] the spectrum rides along after the bands (lower priority): it powers the frequency picker + custom ranges
  .catch(e=>{ m._bandsBusy=false; }); }

/* ---- reactive config + deterministic band eval ---- */
function ensureReactive(){ if(!state.reactive)state.reactive={srcClipId:null,gain:130,gate:5,attack:8,release:130,bpm:0}; return state.reactive; } // bpm 0 = auto (detected)
let _arCache=null; const _fxEnvCache=new Map(); // per-effect shaped envelopes (attack/release + spring), keyed by fx.id + shaping signature — deterministic; cleared on engine-config change, capped at 128 entries
function reactiveSourceClip(){ const id=ensureReactive().srcClipId; if(id==null)return null; const c=clipById(id); if(c)return c;
  for(const m of state.media)if(isSeqMedia(m)&&m.id!==state.activeSeqId&&m.nestClips){ const n=m.nestClips.find(x=>x.id===id); if(n)return n; } return null; } // [R92-T1 C5] resolve the source even when it lives inside a nest (or another open sequence) — band timing is exact when the nest sits at t=0 (the usual full-track nest)
function reactiveSourceMedia(){ const c=reactiveSourceClip(); return c?mediaById(c.mediaId):null; }
function arRecompute(){ const cfg=ensureReactive(), clip=reactiveSourceClip(), m=clip&&mediaById(clip.mediaId);
  _fxEnvCache.clear();
  if(!m||!m.bands){ _arCache=null; return; }
  const bd=m.bands, dt=1/(bd.fps||AR_FPS), g=Math.max(0,cfg.gain/100), gate=Math.max(0,Math.min(0.95,cfg.gate/100)), gs=1/Math.max(0.05,1-gate);
  const gg=(arr)=>{ const out=new Float32Array(arr.length); for(let i=0;i<arr.length;i++){ let x=(arr[i]-gate)*gs; if(x<0)x=0; x*=g; out[i]=x>1?1:x; } return out; }; // gate+gain only — per-effect smoothing happens in fxEnvFor
  const aA=Math.exp(-dt/Math.max(0.001,cfg.attack/1000)), aR=Math.exp(-dt/Math.max(0.001,cfg.release/1000));
  const smooth=(arr)=>{ const out=new Float32Array(arr.length); let y=0; for(let i=0;i<arr.length;i++){ const x=arr[i]; const a=x>y?aA:aR; y=a*y+(1-a)*x; out[i]=y; } return out; }; // engine-default A/R (meter + effects without their own)
  const rb=gg(bd.bass), rm=gg(bd.mid), rt2=gg(bd.treble), rr=gg(bd.bright||bd.treble);
  _arCache={clip,raw:{bass:rb,mid:rm,treble:rt2,bright:rr},bass:smooth(rb),mid:smooth(rm),treble:smooth(rt2),bright:smooth(rr),onsets:bd.onsets||null,beats:bd.beats||[],bpm:bd.bpm||0,beat0:bd.beat0||0,fps:bd.fps||AR_FPS}; }
function _arSamp(arr,fps,local){ if(!arr||!arr.length)return 0; const x=local*fps; let i=Math.floor(x); if(i<0)return arr[0]; if(i>=arr.length-1)return arr[arr.length-1]; const f=x-i; return arr[i]*(1-f)+arr[i+1]*f; }
function bandLevelAt(band,t){ if(!_arCache)return 0; const c=_arCache.clip; if(!c||t<c.start||t>c.start+c.dur)return 0; const local=srcT(c,t); const arr=_arCache[band==='bass'?'bass':band==='mid'?'mid':band==='treble'?'treble':band==='bright'?'bright':'']; return arr?_arSamp(arr,_arCache.fps,local):0; }
let _arTime=0; // top-timeline time used for the audio-reactive term — so FX on clips INSIDE a nest still follow the TOP-timeline audio source (not nest-local time). Keyframes keep using nest-local host time.
/* per-effect envelope: engine raw band → this effect's attack/release smoothing → optional under-damped
   spring (Lag-CHOP-style organic overshoot/bounce). Baked to an array (stateful ODE) → export-deterministic. */
function fxEnvFor(fx){ if(!_arCache)return null; const cfg=ensureReactive();
  const band=(fx.band&&fx.band!=='none')?fx.band:null; if(!band)return null; const raw=_arCache.raw[band]; if(!raw)return null;
  const atk=fx.atk!=null?fx.atk:cfg.attack, rel=fx.rel!=null?fx.rel:cfg.release, spr=fx.spring||0;
  const key=fx.id+':'+band+'|'+atk+'|'+rel+'|'+spr; // signature IN the key: split/duplicated clips share fx.id — same-id entries with different shaping must coexist (id-only key = recompute thrash every frame)
  const hit=_fxEnvCache.get(key); if(hit)return hit;
  const fps=_arCache.fps, dt=1/fps;
  const aA=Math.exp(-dt/Math.max(0.001,atk/1000)), aR=Math.exp(-dt/Math.max(0.001,rel/1000));
  let arr=new Float32Array(raw.length); let y=0;
  for(let i=0;i<raw.length;i++){ const x=raw[i]; const a=x>y?aA:aR; y=a*y+(1-a)*x; arr[i]=y; }
  if(spr>0){ const k=30+(spr/100)*(spr/100)*900, zeta=0.28, cd=2*Math.sqrt(k)*zeta, h=dt/2; // 2 substeps → stable Euler at 90fps
    let p=0,v=0; const out=new Float32Array(arr.length);
    for(let i=0;i<arr.length;i++){ for(let s2=0;s2<2;s2++){ const acc=k*(arr[i]-p)-cd*v; v+=acc*h; p+=v*h; } out[i]=p<0?0:p; } arr=out; }
  if(_fxEnvCache.size>128)_fxEnvCache.clear(); // bounded: fader drags create one entry per step; cap + full reset keeps memory flat (arrays rebuild lazily)
  _fxEnvCache.set(key,arr); return arr; }
/* response shaping: curve 0..100 → exponent 0.25..4 (50 = linear), then optional invert */
function fxShape(fx,v){ v=Math.min(1.25,Math.max(0,v)); const cu=fx.curve!=null?fx.curve:50;
  if(cu!==50)v=Math.pow(Math.min(1,v),Math.pow(4,(cu-50)/50))*(v>1?v:1); // spring overshoot >1 survives the pow
  if(fx.inv)v=1-Math.min(1,v); return v>1?1:v; }
/* trigger mode: per-band onsets (kick/snare/hat) → attack ramp + exponential release (analytic = deterministic) */
function fxTrigEnv(fx,t){ if(!_arCache)return 0; const c=_arCache.clip; if(!c||t<c.start||t>c.start+c.dur)return 0; const local=srcT(c,t);
  const os=(_arCache.onsets&&fx.band&&fx.band!=='none'&&_arCache.onsets[fx.band])||_arCache.beats; if(!os||!os.length)return 0;
  let lo=0,hi=os.length-1,last=-1; while(lo<=hi){ const md=(lo+hi)>>1; if(os[md]<=local){last=os[md];lo=md+1;}else hi=md-1; } if(last<0)return 0;
  const cfg=ensureReactive(), atkS=Math.max(0.001,(fx.atk!=null?fx.atk:cfg.attack)/1000), relS=Math.max(0.03,(fx.rel!=null?fx.rel:cfg.release)/1000); // defaults = engine values (what fxParamVal displays)
  const d=local-last; if(d<0)return 0; if(d<atkS)return d/atkS; return Math.exp(-(d-atkS)/relS); }
/* LFO mode: phase-locked to the detected (or manual) BPM via beat0 — pure function of t, no state */
const LFO_DIVS={'4bar':16,'2bar':8,'1bar':4,'1/2':2,'1/4':1,'1/8':0.5,'1/16':0.25}; // division → beats per cycle (4/4)
function fxLfoVal(fx,t){ const cfg=ensureReactive(); const bpm=(cfg.bpm>0?cfg.bpm:(_arCache&&_arCache.bpm)||120);
  let beats; if(_arCache&&_arCache.clip){ const c=_arCache.clip; beats=((srcT(c,t))-(_arCache.beat0||0))*bpm/60; } else beats=t*bpm/60;
  const div=LFO_DIVS[fx.lfoDiv]||1; let ph=beats/div; ph-=Math.floor(ph);
  switch(fx.lfoShape){ case 'saw': return 1-ph; case 'tri': return ph<0.5?ph*2:2-ph*2; case 'square': return ph<0.5?1:0;
    case 'sh': { const ci=Math.floor(beats/div); return Math.abs(Math.sin(ci*127.1)*43758.5453)%1; } // deterministic hash per cycle
    default: return 0.5-0.5*Math.cos(ph*6.283185307179586); } }
function fxModLevel(fx){ const t=_arTime; let v;
  if(fx.mode==='lfo') v=fxLfoVal(fx,t);
  else if(fx.mode==='trigger') v=fxTrigEnv(fx,t);
  else { if(!fx.band||fx.band==='none')return 0; // no source → static effect (int only), invert intentionally not applied
    const c=_arCache&&_arCache.clip; if(!c||t<c.start||t>c.start+c.dur)v=0;
    else { const arr=fxEnvFor(fx); v=arr?_arSamp(arr,_arCache.fps,srcT(c,t)):0; } }
  return fxShape(fx,v); }
function clamp01(v){ return v<0?0:v>1?1:v; }
function evalKf(ks,base,lt){ if(!ks||!ks.length)return base; if(lt<=ks[0].t)return ks[0].v; const last=ks[ks.length-1]; if(lt>=last.t)return last.v;
  for(let i=0;i<ks.length-1;i++)if(lt>=ks[i].t&&lt<=ks[i+1].t){ if(ks[i].e==='bezier'||ks[i].hOut||ks[i+1].hIn)return bezSegY(lt,ks[i],ks[i+1]); const f=easeF((lt-ks[i].t)/((ks[i+1].t-ks[i].t)||1),ks[i].e||'linear'); return ks[i].v+(ks[i+1].v-ks[i].v)*f; } return base; }
function evalFxParam(host,fx,k,t){ return evalP(host,'fx:'+fx.id+':'+k,t); } // unified with evalP so the Audio-React automation curve == the rendered value
function fxIntensity(host,fx,t){ const base=clamp01(evalFxParam(host,fx,'int',t)/100), react=clamp01(evalFxParam(host,fx,'amt',t)/100); return clamp01(base+react*fxModLevel(fx)); }

/* ---- GPU post-process chain (ping-pong FBO) ---- */
const VSPP=`#version 300 es
precision highp float; in vec2 a_p; out vec2 v_uv; void main(){ v_uv=a_p*0.5+0.5; gl_Position=vec4(a_p,0.0,1.0); }`;
function ppCompile(fs){ const p=gl.createProgram(); gl.attachShader(p,sh(gl.VERTEX_SHADER,VSPP)); gl.attachShader(p,sh(gl.FRAGMENT_SHADER,fs)); gl.bindAttribLocation(p,0,'a_p'); gl.linkProgram(p); if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw gl.getProgramInfoLog(p); return p; }
const _ppVAO=gl.createVertexArray(); gl.bindVertexArray(_ppVAO); (()=>{ const vb=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,vb); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,-1,1,1,-1,1]),gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0); })(); gl.bindVertexArray(null);
/* R83: flat → fisheye pre-warp — barrel-remap the source radius so FLAT (rectilinear) clips get the fisheye
   curvature a real dome master has. rs = tan(d·k)/tan(k): k→0 = identity (1:1), k→~1.4 = strong fisheye; the
   edge always maps to the edge (fills the disc, no black ring). Runs on the clip texture BEFORE dome placement. */
const _FISHFS=`#version 300 es
precision highp float; in vec2 v_uv; out vec4 o; uniform sampler2D u_tex; uniform float u_k;
void main(){ vec2 xy=(v_uv-0.5)*2.0; float d=length(xy);
  if(d<1e-4){ o=texture(u_tex,v_uv); return; }
  float tk=max(tan(u_k),1e-4); float rs=tan(min(d,1.0)*u_k)/tk;
  vec2 uv=(xy/d)*rs*0.5+0.5; o=texture(u_tex,clamp(uv,0.0,1.0)); }`;
const _FISH=ppCompile(_FISHFS); const _FISHu={tex:gl.getUniformLocation(_FISH,'u_tex'),k:gl.getUniformLocation(_FISH,'u_k')};
let _fishRT=null;
function _fishTarget(size){ if(!_fishRT){ _fishRT={tex:gl.createTexture(),fbo:gl.createFramebuffer(),size:0}; } if(_fishRT.size!==size){ _ppTex(_fishRT.tex,size); gl.bindFramebuffer(gl.FRAMEBUFFER,_fishRT.fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,_fishRT.tex,0); gl.bindFramebuffer(gl.FRAMEBUFFER,null); _fishRT.size=size; } return _fishRT; }
function applyFisheye(inTex,size,c){ const amt=Math.max(0,Math.min(100,c.props.fisheyeAmt!=null?c.props.fisheyeAmt:60)); const k=0.02+amt/100*1.35;
  const prevFBO=gl.getParameter(gl.FRAMEBUFFER_BINDING), pv=gl.getParameter(gl.VIEWPORT); const rt=_fishTarget(size);
  gl.disable(gl.BLEND); gl.bindVertexArray(_ppVAO); gl.useProgram(_FISH);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,inTex); gl.uniform1i(_FISHu.tex,0); gl.uniform1f(_FISHu.k,k);
  gl.bindFramebuffer(gl.FRAMEBUFFER,rt.fbo); gl.viewport(0,0,size,size); gl.drawArrays(gl.TRIANGLES,0,6);
  gl.bindVertexArray(null); gl.bindFramebuffer(gl.FRAMEBUFFER,prevFBO); gl.viewport(pv[0],pv[1],pv[2],pv[3]); gl.enable(gl.BLEND); NORMAL_BLEND();
  return rt.tex; }
/* R85: "Remove black" — luma key. Sets the clip's ALPHA from pixel brightness (max of R,G,B, so saturated
   colours survive), so a black background becomes truly TRANSPARENT (a real key, not "screen" which only
   brightens). Threshold = where the cut sits; Softness = edge feather. Runs as the last clip pre-pass. */
const _KEYFS=`#version 300 es
precision highp float; in vec2 v_uv; out vec4 o; uniform sampler2D u_tex; uniform float u_thr,u_soft;
void main(){ vec4 c=texture(u_tex,v_uv); float v=max(c.r,max(c.g,c.b));
  float a=smoothstep(u_thr, u_thr+max(0.004,u_soft), v);
  o=vec4(c.rgb, c.a*a); }`;
const _KEY=ppCompile(_KEYFS); const _KEYu={tex:gl.getUniformLocation(_KEY,'u_tex'),thr:gl.getUniformLocation(_KEY,'u_thr'),soft:gl.getUniformLocation(_KEY,'u_soft')};
let _keyRT=null;
function _keyTarget(size){ if(!_keyRT){ _keyRT={tex:gl.createTexture(),fbo:gl.createFramebuffer(),size:0}; } if(_keyRT.size!==size){ _ppTex(_keyRT.tex,size); gl.bindFramebuffer(gl.FRAMEBUFFER,_keyRT.fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,_keyRT.tex,0); gl.bindFramebuffer(gl.FRAMEBUFFER,null); _keyRT.size=size; } return _keyRT; }
function applyBlackKey(inTex,size,c){ const thr=Math.max(0,Math.min(100,c.props.blackKeyAmt!=null?c.props.blackKeyAmt:15))/100*0.6; const soft=Math.max(0,Math.min(100,c.props.blackKeySoft!=null?c.props.blackKeySoft:30))/100*0.5;
  const prevFBO=gl.getParameter(gl.FRAMEBUFFER_BINDING), pv=gl.getParameter(gl.VIEWPORT); const rt=_keyTarget(size);
  gl.disable(gl.BLEND); gl.bindVertexArray(_ppVAO); gl.useProgram(_KEY);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,inTex); gl.uniform1i(_KEYu.tex,0); gl.uniform1f(_KEYu.thr,thr); gl.uniform1f(_KEYu.soft,soft);
  gl.bindFramebuffer(gl.FRAMEBUFFER,rt.fbo); gl.viewport(0,0,size,size); gl.drawArrays(gl.TRIANGLES,0,6);
  gl.bindVertexArray(null); gl.bindFramebuffer(gl.FRAMEBUFFER,prevFBO); gl.viewport(pv[0],pv[1],pv[2],pv[3]); gl.enable(gl.BLEND); NORMAL_BLEND();
  return rt.tex; }
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
const _FH=`#version 300 es
precision highp float; in vec2 v_uv; out vec4 o; uniform sampler2D u_tex; uniform vec2 u_res; uniform float u_t,u_amt;`;
const FXCATS={distort:['Distort','Distorsión'],stylize:['Stylize','Estilizar'],color:['Color','Color'],feedback:['Feedback','Realimentación'],dome:['Dome','Domo']};
const FXTYPES=[
 /* ---- COLOR ---- */
 {key:'rgbsplit',cat:'color',label:['RGB Split','RGB Split'],
  params:[{k:'angle',label:['Angle','Ángulo'],min:0,max:360,def:0,unit:'°'},{k:'spread',label:['Spread','Separación'],min:0,max:100,def:50,unit:''}],
  frag:_FH+`uniform float u_angle,u_spread; void main(){ float ph=radians(u_angle); vec2 dir=vec2(cos(ph),sin(ph)); vec2 off=dir*(u_amt*u_spread*0.003);
   vec4 b=texture(u_tex,v_uv); vec4 pr=texture(u_tex,v_uv+off), nr=texture(u_tex,v_uv-off);
   o=vec4(pr.r,b.g,nr.b,max(b.a,max(pr.a,nr.a))); }`},
 {key:'hue',cat:'color',label:['Hue Shift','Matiz'],
  params:[{k:'shift',label:['Shift','Giro'],min:0,max:360,def:180,unit:'°'}],
  frag:_FH+`uniform float u_shift; vec3 hrot(vec3 c,float a){ const vec3 k=vec3(0.57735); float cs=cos(a),sn=sin(a); return c*cs+cross(k,c)*sn+k*dot(k,c)*(1.0-cs); }
   void main(){ vec4 c=texture(u_tex,v_uv); o=vec4(clamp(hrot(c.rgb,radians(u_shift)*u_amt),0.0,1.0),c.a); }`},
 /* ---- STYLIZE ---- */
 {key:'strobe',cat:'stylize',label:['Strobe','Estrobo'],
  params:[{k:'bright',label:['Flash','Destello'],min:-100,max:100,def:100,unit:''},{k:'hard',label:['Hardness','Dureza'],min:0,max:100,def:70,unit:''}],
  frag:_FH+`uniform float u_bright,u_hard; void main(){ vec4 c=texture(u_tex,v_uv); float h=max(0.02,1.0-u_hard*0.01); float k=smoothstep(0.0,h,u_amt); vec3 col=clamp(c.rgb+vec3(u_bright*0.01)*k,0.0,1.0); o=vec4(col,c.a); }`},
 {key:'edge',cat:'stylize',label:['Edge','Bordes'],
  params:[{k:'thick',label:['Thickness','Grosor'],min:1,max:5,def:1,unit:'px'},{k:'mix',label:['Mix','Mezcla'],min:0,max:100,def:100,unit:''}],
  frag:_FH+`uniform float u_thick,u_mix; float lm(vec2 uv){ vec3 c=texture(u_tex,uv).rgb; return dot(c,vec3(0.299,0.587,0.114)); }
   void main(){ vec2 e=vec2(max(1.0,u_thick))/u_res;
    float tl=lm(v_uv+vec2(-e.x,e.y)),tm=lm(v_uv+vec2(0.0,e.y)),tr=lm(v_uv+vec2(e.x,e.y));
    float ml=lm(v_uv+vec2(-e.x,0.0)),mr=lm(v_uv+vec2(e.x,0.0));
    float bl=lm(v_uv+vec2(-e.x,-e.y)),bm=lm(v_uv+vec2(0.0,-e.y)),br=lm(v_uv+vec2(e.x,-e.y));
    float gx=-tl-2.0*ml-bl+tr+2.0*mr+br, gy=tl+2.0*tm+tr-bl-2.0*bm-br;
    float g=clamp(length(vec2(gx,gy)),0.0,1.0); vec4 s=texture(u_tex,v_uv);
    vec3 res=mix(s.rgb, mix(clamp(s.rgb+vec3(g),0.0,1.0), vec3(g), u_mix*0.01), u_amt); o=vec4(res,s.a); }`},
 {key:'posterize',cat:'stylize',label:['Posterize','Posterizar'],
  params:[{k:'levels',label:['Levels','Niveles'],min:2,max:16,def:5,unit:''}],
  frag:_FH+`uniform float u_levels; void main(){ float L=max(2.0,u_levels); vec4 c=texture(u_tex,v_uv); vec3 p=clamp(floor(c.rgb*L)/(L-1.0),0.0,1.0); o=vec4(mix(c.rgb,p,u_amt),c.a); }`},
 {key:'scanlines',cat:'stylize',label:['Scanlines / CRT','Scanlines / CRT'],
  params:[{k:'count',label:['Lines','Líneas'],min:80,max:1200,def:500,unit:''},{k:'strength',label:['Strength','Fuerza'],min:0,max:100,def:60,unit:''},{k:'chroma',label:['Chroma','Croma'],min:0,max:100,def:40,unit:''}],
  frag:_FH+`uniform float u_count,u_strength,u_chroma; void main(){ vec2 uv=v_uv; float ch=u_chroma*0.002*u_amt; vec4 c; c.r=texture(u_tex,uv+vec2(ch,0.0)).r; c.g=texture(u_tex,uv).g; c.b=texture(u_tex,uv-vec2(ch,0.0)).b; c.a=texture(u_tex,uv).a;
    float sl=0.5+0.5*sin(uv.y*u_count*6.2831853); float scan=mix(1.0,sl,u_strength*0.01*u_amt); c.rgb*=scan;
    float vg=smoothstep(1.1,0.35,length(uv-0.5)); c.rgb*=mix(1.0,vg,u_amt*0.35); o=c; }`},
 /* ---- DISTORT ---- */
 {key:'glitch',cat:'distort',label:['Glitch','Glitch'],
  params:[{k:'block',label:['Blocks','Bloques'],min:2,max:120,def:24,unit:''},{k:'rgb',label:['RGB','RGB'],min:0,max:100,def:60,unit:''},{k:'rate',label:['Rate','Ritmo'],min:1,max:30,def:12,unit:''}],
  frag:_FH+`uniform float u_block,u_rgb,u_rate; float h1(float x){ return fract(sin(x*127.1)*43758.5453); } float h2(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
   void main(){ float tt=floor(u_t*max(1.0,u_rate)); float rows=max(2.0,u_block); float ry=floor(v_uv.y*rows);
    float g=h2(vec2(ry,tt)); float act=step(1.0-u_amt,g); float big=step(0.9,h2(vec2(ry*0.3,tt*1.7)))*act;
    float shf=(h2(vec2(ry*1.7,tt+3.0))-0.5)*(0.05+big*0.45)*u_amt;
    vec2 uv=vec2(fract(v_uv.x+shf),v_uv.y); float bx=mix(1.0,50.0,act); uv.x=mix(uv.x,(floor(uv.x*bx)+0.5)/bx,act*0.55);
    float cs=u_rgb*0.006*u_amt*act; vec4 c; c.r=texture(u_tex,uv+vec2(cs,0.0)).r; c.g=texture(u_tex,uv).g; c.b=texture(u_tex,uv-vec2(cs,0.0)).b; c.a=texture(u_tex,uv).a;
    float drop=step(0.965,h2(vec2(ry*2.3,tt*3.1)))*act; c.rgb=mix(c.rgb,vec3(step(0.5,h1(ry+tt))),drop*u_amt*0.85);
    c.rgb+=(h2(vec2(v_uv.x*rows,ry+tt))-0.5)*act*u_amt*0.18; o=clamp(c,0.0,1.0); }`},
 {key:'datamosh',cat:'distort',label:['Datamosh','Datamosh'],prev:true,
  params:[{k:'amount',label:['Smear','Arrastre'],min:0,max:100,def:80,unit:''},{k:'dirx',label:['Dir X','Dir X'],min:0,max:100,def:60,unit:''},{k:'diry',label:['Dir Y','Dir Y'],min:0,max:100,def:50,unit:''}],
  frag:_FH+`uniform sampler2D u_prev; uniform float u_amount,u_dirx,u_diry; void main(){ vec2 d=vec2(u_dirx-50.0,u_diry-50.0)*0.0006*(u_amount*0.01); vec3 pv=texture(u_prev,v_uv-d).rgb; vec4 cur=texture(u_tex,v_uv); o=vec4(mix(cur.rgb,pv,u_amt*0.9),cur.a); }`},
 {key:'slice',cat:'distort',label:['Slice','Cortes'],
  params:[{k:'slices',label:['Slices','Cortes'],min:2,max:60,def:16,unit:''},{k:'rate',label:['Rate','Ritmo'],min:1,max:24,def:8,unit:''}],
  frag:_FH+`uniform float u_slices,u_rate; float hs(float x){ return fract(sin(x*91.7)*47453.53); }
   void main(){ float n=max(2.0,u_slices); float sy=floor(v_uv.y*n); float rnd=hs(sy+floor(u_t*max(1.0,u_rate))); float sh=(rnd-0.5)*u_amt*0.35*step(0.4,rnd); o=texture(u_tex,vec2(fract(v_uv.x+sh),v_uv.y)); }`},
 {key:'pixelate',cat:'distort',label:['Pixelate','Pixelar'],
  params:[{k:'size',label:['Blocks','Bloques'],min:4,max:300,def:64,unit:''}],
  frag:_FH+`uniform float u_size; void main(){ float n=max(4.0,u_size); vec2 uv=(floor(v_uv*n)+0.5)/n; vec4 p=texture(u_tex,uv), s=texture(u_tex,v_uv); o=mix(s,p,u_amt); }`},
 {key:'kaleido',cat:'distort',label:['Kaleidoscope','Caleidoscopio'],
  params:[{k:'seg',label:['Segments','Segmentos'],min:2,max:24,def:6,unit:''},{k:'angle',label:['Angle','Ángulo'],min:0,max:360,def:0,unit:'°'},{k:'zoom',label:['Zoom','Zoom'],min:30,max:200,def:100,unit:'%'}],
  frag:_FH+`uniform float u_seg,u_angle,u_zoom; void main(){ vec2 c=v_uv-0.5; float r=length(c); float a=atan(c.y,c.x)+radians(u_angle); float seg=max(1.0,u_seg); float sa=6.2831853/seg; a=mod(a,sa); a=abs(a-sa*0.5); vec2 uv=vec2(cos(a),sin(a))*r*(100.0/max(1.0,u_zoom))+0.5; vec4 k=texture(u_tex,fract(uv)), s=texture(u_tex,v_uv); o=mix(s,k,u_amt); }`},
 {key:'mirror',cat:'distort',label:['Mirror','Espejo'],
  params:[{k:'mode',label:['Mode 0-4','Modo 0-4'],min:0,max:4,def:0,unit:''}],
  frag:_FH+`uniform float u_mode; void main(){ vec2 uv=v_uv; float m=u_mode;
    if(m<0.5){ uv.x=uv.x<0.5?uv.x:1.0-uv.x; } else if(m<1.5){ uv.y=uv.y<0.5?uv.y:1.0-uv.y; }
    else if(m<2.5){ uv.x=uv.x<0.5?uv.x:1.0-uv.x; uv.y=uv.y<0.5?uv.y:1.0-uv.y; }
    else if(m<3.5){ uv.x=1.0-uv.x; } else { uv.y=1.0-uv.y; }
    vec4 mm=texture(u_tex,uv), s=texture(u_tex,v_uv); o=mix(s,mm,u_amt); }`},
 {key:'wave',cat:'distort',label:['Wave','Onda'],
  params:[{k:'amp',label:['Amount','Cantidad'],min:0,max:100,def:30,unit:''},{k:'freq',label:['Frequency','Frecuencia'],min:1,max:40,def:8,unit:''},{k:'speed',label:['Speed','Velocidad'],min:0,max:20,def:4,unit:''}],
  frag:_FH+`uniform float u_amp,u_freq,u_speed; void main(){ float ph=u_t*u_speed; float dx=sin(v_uv.y*u_freq*6.2831853+ph)*u_amp*0.01*u_amt; float dy=cos(v_uv.x*u_freq*6.2831853+ph)*u_amp*0.01*u_amt; o=texture(u_tex,fract(v_uv+vec2(dx,dy))); }`},
 {key:'zoomblur',cat:'distort',label:['Zoom Blur','Zoom Blur'],
  params:[{k:'strength',label:['Strength','Fuerza'],min:0,max:100,def:55,unit:''},{k:'cx',label:['Center X','Centro X'],min:0,max:100,def:50,unit:''},{k:'cy',label:['Center Y','Centro Y'],min:0,max:100,def:50,unit:''}],
  frag:_FH+`uniform float u_strength,u_cx,u_cy; void main(){ vec2 ctr=vec2(u_cx*0.01,u_cy*0.01); vec2 dir=v_uv-ctr; float amt=u_amt*u_strength*0.012; vec4 acc=vec4(0.0); const int N=14; for(int i=0;i<N;i++){ float s=1.0-amt*(float(i)/float(N)); acc+=texture(u_tex,ctr+dir*s); } o=acc/float(N); }`},
 /* ---- FEEDBACK ---- */
 {key:'trails',cat:'feedback',label:['Trails / Echo','Estelas / Eco'],prev:true,
  params:[{k:'decay',label:['Decay','Caída'],min:0,max:100,def:86,unit:''}],
  frag:_FH+`uniform sampler2D u_prev; uniform float u_decay; void main(){ vec4 c=texture(u_tex,v_uv); vec4 p=texture(u_prev,v_uv); float d=(u_decay*0.01)*clamp(u_amt,0.0,1.0); o=vec4(max(c.rgb,p.rgb*d),max(c.a,p.a*d)); }`},
 {key:'feedbackzoom',cat:'feedback',label:['Feedback Zoom','Zoom Feedback'],prev:true,
  params:[{k:'zoom',label:['Zoom','Zoom'],min:-40,max:40,def:12,unit:''},{k:'rotate',label:['Rotate','Rotar'],min:-30,max:30,def:4,unit:'°'},{k:'decay',label:['Decay','Caída'],min:0,max:100,def:88,unit:''}],
  frag:_FH+`uniform sampler2D u_prev; uniform float u_zoom,u_rotate,u_decay; void main(){ vec2 c=v_uv-0.5; float z=1.0-u_zoom*0.01*u_amt; float a=radians(u_rotate)*u_amt; float s=sin(a),co=cos(a); vec2 p=mat2(co,s,-s,co)*c*z+0.5; vec3 fb=texture(u_prev,p).rgb*(u_decay*0.01); vec4 cur=texture(u_tex,v_uv); o=vec4(max(cur.rgb,fb),cur.a); }`},
 /* ---- ROUND 76: pro additions ---- */
 {key:'bloom',cat:'stylize',label:['Bloom / Glow','Bloom / Glow'],apply:'bloom', // multi-pass: bright-pass → separable gaussian at half res → screen composite
  params:[{k:'thresh',label:['Threshold','Umbral'],min:0,max:100,def:50,unit:''},{k:'radius',label:['Radius','Radio'],min:0,max:100,def:45,unit:''},{k:'boost',label:['Boost','Empuje'],min:0,max:300,def:150,unit:'%'}]},
 {key:'noisewarp',cat:'distort',label:['Noise Warp','Ruido líquido'],
  params:[{k:'scale',label:['Scale','Escala'],min:1,max:20,def:4,unit:''},{k:'warp',label:['Amount','Cantidad'],min:0,max:100,def:45,unit:''},{k:'speed',label:['Speed','Velocidad'],min:0,max:20,def:5,unit:''}],
  frag:_FH+`uniform float u_scale,u_warp,u_speed;
   vec2 h2v(vec2 p){ return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453)*2.0-1.0; }
   float n2(vec2 p){ vec2 i=floor(p),f=fract(p); vec2 u=f*f*(3.0-2.0*f);
    return mix(mix(dot(h2v(i),f),dot(h2v(i+vec2(1,0)),f-vec2(1,0)),u.x),mix(dot(h2v(i+vec2(0,1)),f-vec2(0,1)),dot(h2v(i+vec2(1,1)),f-vec2(1,1)),u.x),u.y); }
   float fbm(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<3;i++){ s+=a*n2(p); p*=2.03; a*=0.5; } return s; }
   void main(){ float tt=u_t*u_speed*0.25; vec2 p=v_uv*u_scale;
    vec2 off=vec2(fbm(p+vec2(tt,1.7)),fbm(p+vec2(5.2,tt)))*(u_warp*0.01)*u_amt*0.35;
    o=texture(u_tex,clamp(v_uv+off,0.0,1.0)); }`},
 {key:'feedbackflow',cat:'feedback',label:['Feedback Flow','Flujo Feedback'],prev:true, // TD-style psychedelic tunnel: zoom+rotate+hue-rotate+warp inside the feedback loop
  params:[{k:'zoom',label:['Zoom','Zoom'],min:-40,max:40,def:10,unit:''},{k:'rotate',label:['Rotate','Rotar'],min:-45,max:45,def:8,unit:'°'},{k:'huerot',label:['Hue Cycle','Ciclo de matiz'],min:0,max:90,def:20,unit:'°'},{k:'warp',label:['Warp','Deformar'],min:0,max:100,def:25,unit:''},{k:'decay',label:['Decay','Caída'],min:50,max:99,def:91,unit:''}],
  frag:_FH+`uniform sampler2D u_prev; uniform float u_zoom,u_rotate,u_huerot,u_warp,u_decay;
   vec3 hr(vec3 c,float a){ const vec3 k=vec3(0.57735); float cs=cos(a),sn=sin(a); return c*cs+cross(k,c)*sn+k*dot(k,c)*(1.0-cs); }
   void main(){ vec2 c=v_uv-0.5; float z=1.0-u_zoom*0.01*u_amt; float an=radians(u_rotate)*u_amt*0.5; float s=sin(an),co=cos(an);
    vec2 p=mat2(co,s,-s,co)*c*z;
    p+=vec2(sin(v_uv.y*11.0+u_t*2.0),cos(v_uv.x*11.0+u_t*1.6))*(u_warp*0.0006)*u_amt; p+=0.5;
    vec4 pv=texture(u_prev,p); vec3 fb=clamp(hr(pv.rgb,radians(u_huerot)),0.0,1.0)*(u_decay*0.01);
    vec4 cur=texture(u_tex,v_uv); o=vec4(max(cur.rgb,fb),max(cur.a,pv.a*(u_decay*0.01))); }`},
 {key:'pulse',cat:'color',label:['Chroma Pulse','Pulso cromático'], // radial chromatic aberration + center breathe (dome zenith by default)
  params:[{k:'strength',label:['Strength','Fuerza'],min:0,max:100,def:55,unit:''},{k:'cx',label:['Center X','Centro X'],min:0,max:100,def:50,unit:''},{k:'cy',label:['Center Y','Centro Y'],min:0,max:100,def:50,unit:''}],
  frag:_FH+`uniform float u_strength,u_cx,u_cy; void main(){ vec2 ctr=vec2(u_cx,u_cy)*0.01; vec2 d=v_uv-ctr; float r=length(d);
   float k=u_amt*u_strength*0.0022*r; vec4 c; c.r=texture(u_tex,v_uv+d*k*2.0).r; c.g=texture(u_tex,v_uv+d*k*0.5).g; c.b=texture(u_tex,v_uv-d*k*1.5).b; c.a=texture(u_tex,v_uv).a;
   float vig=1.0+u_amt*0.25*(1.0-smoothstep(0.0,0.9,r)); o=vec4(clamp(c.rgb*vig,0.0,1.0),c.a); }`},
 {key:'lumaflash',cat:'color',label:['Flash','Flash'],
  params:[{k:'fmode',label:['Mode W/B/Inv','Modo B/N/Inv'],min:0,max:2,def:0,unit:''}],
  frag:_FH+`uniform float u_fmode; void main(){ vec4 c=texture(u_tex,v_uv); vec3 tgt=u_fmode<0.5?vec3(1.0):(u_fmode<1.5?vec3(0.0):1.0-c.rgb); o=vec4(mix(c.rgb,tgt,clamp(u_amt,0.0,1.0)),c.a); }`},
 /* ---- DOME (uv center = zenith on the 1:1 master; use on an adjustment layer for full-dome sweeps) ---- */
 {key:'domerings',cat:'dome',label:['Dome Rings','Anillos de domo'],
  params:[{k:'count',label:['Rings','Anillos'],min:1,max:24,def:7,unit:''},{k:'sharp',label:['Sharpness','Nitidez'],min:0,max:100,def:70,unit:''},{k:'speed',label:['Travel','Viaje'],min:-200,max:200,def:80,unit:''}],
  frag:_FH+`uniform float u_count,u_sharp,u_speed; void main(){ vec2 d=v_uv-0.5; float r=length(d)*2.0; vec4 c=texture(u_tex,v_uv);
   float ph=r*u_count-u_t*u_speed*0.02; float w=0.5+0.5*sin(ph*6.2831853); float band=pow(w,mix(1.0,14.0,u_sharp*0.01));
   float k=band*u_amt; o=vec4(clamp(c.rgb*(1.0+k*1.1)+vec3(k*0.10),0.0,1.0),c.a); }`},
 {key:'domespiral',cat:'dome',label:['Spiral Twist','Espiral'],
  params:[{k:'twist',label:['Twist','Torsión'],min:-360,max:360,def:120,unit:'°'},{k:'speed',label:['Rotation','Rotación'],min:-20,max:20,def:3,unit:''}],
  frag:_FH+`uniform float u_twist,u_speed; void main(){ vec2 d=v_uv-0.5; float r=length(d)*2.0; float a=atan(d.y,d.x);
   a+=radians(u_twist)*r*u_amt+u_t*u_speed*0.1*u_amt; vec2 uv=vec2(cos(a),sin(a))*r*0.5+0.5;
   o=texture(u_tex,clamp(uv,0.0,1.0)); }`},
 {key:'dometunnel',cat:'dome',label:['Tunnel','Túnel'],
  params:[{k:'depth',label:['Depth','Profundidad'],min:0,max:100,def:50,unit:''},{k:'speed',label:['Flight','Vuelo'],min:-20,max:20,def:6,unit:''}],
  frag:_FH+`uniform float u_depth,u_speed; void main(){ vec2 d=v_uv-0.5; float r=length(d)*2.0; float a=atan(d.y,d.x);
   float k=u_amt*u_depth*0.01; float rr=pow(max(r,1e-4),1.0-k*0.65); rr-=u_t*u_speed*0.03*u_amt;
   rr=abs(fract(rr*0.5)*2.0-1.0); vec2 uv=vec2(cos(a),sin(a))*rr*0.5+0.5; // mirrored radial wrap → seamless flight
   vec4 w=texture(u_tex,clamp(uv,0.0,1.0)); vec4 s=texture(u_tex,v_uv); o=mix(s,w,clamp(k*3.0,0.0,1.0)); }`},
];
const FXBY={};
for(const d of FXTYPES){ try{ if(d.frag){ d.prog=ppCompile(d.frag); const gu=n=>gl.getUniformLocation(d.prog,n); d.uni={tex:gu('u_tex'),prev:gu('u_prev'),res:gu('u_res'),t:gu('u_t'),amt:gu('u_amt')}; for(const p of d.params)d.uni['u_'+p.k]=gu('u_'+p.k); } d.needsPrev=!!d.prev; FXBY[d.key]=d; }catch(e){ console.error('FX compile '+d.key,e); } } // frag-less entries (bloom) run through a custom multi-pass apply instead
/* ---- Bloom: bright-pass → separable gaussian at half res (2 H/V rounds) → screen composite ---- */
const _BLOOM_BP=ppCompile(`#version 300 es
precision highp float; in vec2 v_uv; out vec4 o; uniform sampler2D u_tex; uniform float u_thresh;
void main(){ vec4 c=texture(u_tex,v_uv); float l=dot(c.rgb,vec3(0.299,0.587,0.114)); float th=u_thresh*0.01; float m=smoothstep(th,th+0.22,l); o=vec4(c.rgb*m*c.a,1.0); }`);
const _BLOOM_BL=ppCompile(`#version 300 es
precision highp float; in vec2 v_uv; out vec4 o; uniform sampler2D u_tex; uniform vec2 u_dir;
void main(){ vec4 s=texture(u_tex,v_uv)*0.227027;
 s+=(texture(u_tex,v_uv+u_dir*1.3846)+texture(u_tex,v_uv-u_dir*1.3846))*0.3162162;
 s+=(texture(u_tex,v_uv+u_dir*3.2308)+texture(u_tex,v_uv-u_dir*3.2308))*0.0702703; o=s; }`);
const _BLOOM_MX=ppCompile(`#version 300 es
precision highp float; in vec2 v_uv; out vec4 o; uniform sampler2D u_tex,u_glow; uniform float u_boost;
void main(){ vec4 s=texture(u_tex,v_uv); vec3 g=clamp(texture(u_glow,v_uv).rgb*u_boost,0.0,1.0);
 float gl2=max(g.r,max(g.g,g.b)); o=vec4(1.0-(1.0-clamp(s.rgb,0.0,1.0))*(1.0-g), clamp(s.a+gl2*0.85,0.0,1.0)); }`); // screen blend; alpha extends into the halo so glow shows outside the silhouette
const _BU={bpTex:gl.getUniformLocation(_BLOOM_BP,'u_tex'),bpTh:gl.getUniformLocation(_BLOOM_BP,'u_thresh'),
  blTex:gl.getUniformLocation(_BLOOM_BL,'u_tex'),blDir:gl.getUniformLocation(_BLOOM_BL,'u_dir'),
  mxTex:gl.getUniformLocation(_BLOOM_MX,'u_tex'),mxGlow:gl.getUniformLocation(_BLOOM_MX,'u_glow'),mxBoost:gl.getUniformLocation(_BLOOM_MX,'u_boost')};
let _bloomRT=[null,null];
function _bloomHalfRT(i,size){ let e=_bloomRT[i]; if(!e){ e={tex:gl.createTexture(),fbo:gl.createFramebuffer(),size:0}; _bloomRT[i]=e; } if(e.size!==size){ _ppTex(e.tex,size); gl.bindFramebuffer(gl.FRAMEBUFFER,e.fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,e.tex,0); gl.bindFramebuffer(gl.FRAMEBUFFER,null); e.size=size; } return e; }
const FX_APPLY={ bloom:(src,size,host,fx,t,amt,di)=>{
  const hs=Math.max(8,size>>1); const A=_bloomHalfRT(0,hs), B=_bloomHalfRT(1,hs); const out=_ppRT(di,size); // allocate BEFORE binding units/FBOs (same rule as applyChain)
  const th=evalFxParam(host,fx,'thresh',t), rad=Math.max(0,evalFxParam(host,fx,'radius',t)), boost=Math.max(0,evalFxParam(host,fx,'boost',t))*0.01*amt;
  gl.useProgram(_BLOOM_BP); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,src); gl.uniform1i(_BU.bpTex,0); gl.uniform1f(_BU.bpTh,th);
  gl.bindFramebuffer(gl.FRAMEBUFFER,A.fbo); gl.viewport(0,0,hs,hs); gl.drawArrays(gl.TRIANGLES,0,6);
  gl.useProgram(_BLOOM_BL); gl.uniform1i(_BU.blTex,0);
  let cur=A, dst=B; const st=(0.6+rad*0.045);
  for(const d of [[1,0],[0,1],[2.2,0],[0,2.2]]){ gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,cur.tex); gl.uniform2f(_BU.blDir,d[0]*st/hs,d[1]*st/hs); gl.bindFramebuffer(gl.FRAMEBUFFER,dst.fbo); gl.viewport(0,0,hs,hs); gl.drawArrays(gl.TRIANGLES,0,6); const tmp=cur; cur=dst; dst=tmp; }
  gl.useProgram(_BLOOM_MX); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,src); gl.uniform1i(_BU.mxTex,0); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D,cur.tex); gl.uniform1i(_BU.mxGlow,1); gl.uniform1f(_BU.mxBoost,boost);
  gl.bindFramebuffer(gl.FRAMEBUFFER,out.fbo); gl.viewport(0,0,size,size); gl.drawArrays(gl.TRIANGLES,0,6);
  return out.tex; } };
function fxDefaults(type){ const d=FXBY[type], params={}; if(d)for(const p of d.params)params[p.k]=p.def; return params; }
function newFx(type){ const cfg=ensureReactive(); return {id:uid(),type,on:true,band:'bass',mode:'follow',int:0,amt:100,atk:cfg.attack,rel:cfg.release,curve:50,spring:0,inv:false,lfoShape:'sine',lfoDiv:'1/4',params:fxDefaults(type)}; } // per-effect shaping seeded from the engine defaults; old saved fx without these fields fall back to engine values at eval time
let _fxRT=[null,null]; const _fxHist=new Map();
function _ppTex(tex,size){ gl.bindTexture(gl.TEXTURE_2D,tex); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,size,size,0,gl.RGBA,gl.UNSIGNED_BYTE,null); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE); gl.bindTexture(gl.TEXTURE_2D,null); }
function _ppRT(i,size){ let e=_fxRT[i]; if(!e){ e={tex:gl.createTexture(),fbo:gl.createFramebuffer(),size:0}; _fxRT[i]=e; } if(e.size!==size){ _ppTex(e.tex,size); gl.bindFramebuffer(gl.FRAMEBUFFER,e.fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,e.tex,0); gl.bindFramebuffer(gl.FRAMEBUFFER,null); e.size=size; } return e; }
function _fxHistFor(id,size){ let h=_fxHist.get(id); if(!h){ h={tex:gl.createTexture(),fbo:gl.createFramebuffer(),size:0,lastT:-999}; _fxHist.set(id,h); } if(h.size!==size){ _ppTex(h.tex,size); gl.bindFramebuffer(gl.FRAMEBUFFER,h.fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,h.tex,0); gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT); gl.bindFramebuffer(gl.FRAMEBUFFER,null); h.size=size; } return h; }
function enabledFx(host){ return (host&&host.fx&&host.fx.length)?host.fx.filter(f=>f&&f.on!==false&&FXBY[f.type]):[]; }
function hasFx(host){ return enabledFx(host).length>0; }
function applyChain(inputTex,size,host,t){ const list=enabledFx(host); if(!list.length)return inputTex;
  const prevFBO=gl.getParameter(gl.FRAMEBUFFER_BINDING), pv=gl.getParameter(gl.VIEWPORT);
  gl.disable(gl.BLEND); gl.bindVertexArray(_ppVAO);
  let src=inputTex, di=0;
  for(const fx of list){ const def=FXBY[fx.type], amt=fxIntensity(host,fx,t);
    if(amt<=0.001 && !def.needsPrev) continue;
    if(def.apply){ src=FX_APPLY[def.apply](src,size,host,fx,t,amt,di); di^=1; continue; } // custom multi-pass (bloom)
    const rt=_ppRT(di,size); const h=def.needsPrev?_fxHistFor(host.id+':'+fx.id,size):null; // allocate RT + history FIRST — their internal bindTexture/bindFramebuffer must run before the units/FBO we set below, or they clobber them
    gl.useProgram(def.prog); const U=def.uni;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,src); if(U.tex)gl.uniform1i(U.tex,0);
    if(h){ gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D,h.tex); if(U.prev)gl.uniform1i(U.prev,1); }
    gl.bindFramebuffer(gl.FRAMEBUFFER,rt.fbo); gl.viewport(0,0,size,size); // bind the RT last: allocations above may have changed the FBO binding
    if(U.res)gl.uniform2f(U.res,size,size); if(U.t)gl.uniform1f(U.t,t); if(U.amt)gl.uniform1f(U.amt,amt);
    for(const p of def.params){ const loc=U['u_'+p.k]; if(loc)gl.uniform1f(loc,evalFxParam(host,fx,p.k,t)); }
    gl.drawArrays(gl.TRIANGLES,0,6);
    if(h && h.lastT!==t){ gl.bindFramebuffer(gl.READ_FRAMEBUFFER,rt.fbo); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,h.fbo); gl.blitFramebuffer(0,0,size,size,0,0,size,size,gl.COLOR_BUFFER_BIT,gl.NEAREST); gl.bindFramebuffer(gl.READ_FRAMEBUFFER,null); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,null); h.lastT=t; }
    src=rt.tex; di^=1;
  }
  gl.bindVertexArray(null); gl.bindFramebuffer(gl.FRAMEBUFFER,prevFBO); gl.viewport(pv[0],pv[1],pv[2],pv[3]); gl.enable(gl.BLEND); NORMAL_BLEND();
  return src; }
function fxChainSize(){ return exporting ? Math.min(2048, nestSize||2048) : 1280; }
/* does any (nested) clip use a feedback effect (Trails) whose output is path-dependent? Used to skip the render-ahead cache, which would otherwise bake temporally-wrong trails when populated out of order (scrubbing). */
function anyFeedbackFx(clips){ clips=clips||state.clips; if(!clips)return false; for(const c of clips){ if(c.fx&&c.fx.some(f=>f&&f.on!==false&&FXBY[f.type]&&FXBY[f.type].needsPrev))return true; const m=mediaById(c.mediaId); if(m&&m.nestClips&&anyFeedbackFx(m.nestClips))return true; } return false; }
/* clear all feedback-history buffers → deterministic first frame for export / render-ahead (no leftover scrub state) */
function fxResetHistory(){ for(const [,h] of _fxHist){ try{ gl.bindFramebuffer(gl.FRAMEBUFFER,h.fbo); gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT); }catch(e){} h.lastT=-999; } gl.bindFramebuffer(gl.FRAMEBUFFER,null); }
/* GPU resource disposal (the _fxHist history textures/FBOs otherwise leak on clip/fx/project churn) */
function freeFxHistOne(hostId,fxId){ const k=hostId+':'+fxId, h=_fxHist.get(k); if(h){ try{gl.deleteTexture(h.tex);}catch(e){} try{gl.deleteFramebuffer(h.fbo);}catch(e){} _fxHist.delete(k); } }
function freeFxHistFor(hostId){ const pre=hostId+':'; for(const k of [..._fxHist.keys()]){ if(k.indexOf(pre)===0){ const h=_fxHist.get(k); try{gl.deleteTexture(h.tex);}catch(e){} try{gl.deleteFramebuffer(h.fbo);}catch(e){} _fxHist.delete(k); } } }
function freeFxResources(){ for(const [,h] of _fxHist){ try{gl.deleteTexture(h.tex);}catch(e){} try{gl.deleteFramebuffer(h.fbo);}catch(e){} } _fxHist.clear(); for(const e of _fxRT){ if(e){ try{gl.deleteTexture(e.tex);}catch(x){} try{gl.deleteFramebuffer(e.fbo);}catch(x){} } } _fxRT=[null,null]; for(const e of _bloomRT){ if(e){ try{gl.deleteTexture(e.tex);}catch(x){} try{gl.deleteFramebuffer(e.fbo);}catch(x){} } } _bloomRT=[null,null]; if(_fishRT){ try{gl.deleteTexture(_fishRT.tex);}catch(x){} try{gl.deleteFramebuffer(_fishRT.fbo);}catch(x){} _fishRT=null; } if(_keyRT){ try{gl.deleteTexture(_keyRT.tex);}catch(x){} try{gl.deleteFramebuffer(_keyRT.fbo);}catch(x){} _keyRT=null; } if(_fxSnap){ try{gl.deleteTexture(_fxSnap.tex);}catch(e){} try{gl.deleteFramebuffer(_fxSnap.fbo);}catch(e){} _fxSnap=null; } }

/* ---- Adjustment layer: applies its FX chain to the composite of EVERYTHING BELOW it (Premiere-style) ---- */
const PMIX=ppCompile(`#version 300 es
precision highp float; in vec2 v_uv; uniform sampler2D u_a,u_b; uniform float u_wet; out vec4 o;
void main(){ vec4 a=texture(u_a,v_uv), b=texture(u_b,v_uv); o=mix(a,b,clamp(u_wet,0.0,1.0)); }`);
const LMIX={a:gl.getUniformLocation(PMIX,'u_a'),b:gl.getUniformLocation(PMIX,'u_b'),wet:gl.getUniformLocation(PMIX,'u_wet')};
let _fxSnap=null;
function _fxSnapRT(size){ if(!_fxSnap)_fxSnap={tex:gl.createTexture(),fbo:gl.createFramebuffer(),size:0}; if(_fxSnap.size!==size){ _ppTex(_fxSnap.tex,size); gl.bindFramebuffer(gl.FRAMEBUFFER,_fxSnap.fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,_fxSnap.tex,0); gl.bindFramebuffer(gl.FRAMEBUFFER,null); _fxSnap.size=size; } return _fxSnap; }
function drawAdjustment(c,t,xf){ if(!hasFx(c))return; const op=Math.max(0,Math.min(1,evalR(c,'opacity',t)/100))*fadeFactor(c,t)*(xf==null?1:xf); if(op<=0.001)return;
  const prevFBO=gl.getParameter(gl.FRAMEBUFFER_BINDING), pv=gl.getParameter(gl.VIEWPORT), size=pv[2]||compSize;
  const snap=_fxSnapRT(size); // 1) copy the current composite (everything drawn below) into snap
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER,prevFBO); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,snap.fbo); gl.blitFramebuffer(0,0,size,size,0,0,size,size,gl.COLOR_BUFFER_BIT,gl.NEAREST); gl.bindFramebuffer(gl.READ_FRAMEBUFFER,null); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,null); gl.bindFramebuffer(gl.FRAMEBUFFER,prevFBO);
  const outTex=applyChain(snap.tex,size,c,t); // 2) run the chain on the snapshot (restores prevFBO on exit)
  gl.bindFramebuffer(gl.FRAMEBUFFER,prevFBO); gl.viewport(0,0,size,size); gl.disable(gl.BLEND); gl.bindVertexArray(_ppVAO); // 3) write back = mix(original, processed, opacity)
  gl.useProgram(PMIX); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,snap.tex); gl.uniform1i(LMIX.a,0); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D,outTex); gl.uniform1i(LMIX.b,1); gl.uniform1f(LMIX.wet,op);
  gl.drawArrays(gl.TRIANGLES,0,6); gl.bindVertexArray(null); gl.enable(gl.BLEND); NORMAL_BLEND(); gl.viewport(pv[0],pv[1],pv[2],pv[3]); }
function makeAdjustClip(lane,start,dur){ return {id:uid(),adjust:true,mediaId:null,lane,start:Math.max(0,start),dur:dur||6,inP:0,name:T('Adjustment','Ajuste'),color:'#B4BAC1',fadeIn:0,fadeOut:0,props:{opacity:100},kf:{},fx:[]}; }
/* an adjustment layer as a reusable MEDIA item (R87): the sidebar "Adjust" creates it in the Media panel; drag it onto a track to stamp an adjustment clip. Its FX chain (colour + audio-reactive) affects everything below. */
function newAdjustMedia(){ return {id:uid(),kind:'adjust',name:T('Adjustment','Ajuste'),color:clipColorFor('adjust'),dur:6,missing:false,_loading:false,folder:(state.mediaView==='grid'&&state.mediaFolder)||null}; }
function createAdjustMedia(){ pushUndo(); const m=newAdjustMedia(); state.media.push(m); selectMedia(m.id); renderMedia(); markDirty(); flashStatus(T('Adjustment added to Media — drag it onto a track (its FX affect everything below)','Ajuste añadido a Medios — arrástralo a una pista (sus FX afectan todo lo de debajo)')); return m; }
function addAdjustmentLayer(){ pushUndo();
  state.lanes.push({id:uid(),name:T('Adjustment','Ajuste'),tag:'ADJ',kind:'video'}); const li=state.lanes.length-1; // top-most lane → drawn last → affects every lane below
  const hasWork=(state.workIn!=null&&state.workOut!=null&&state.workOut>state.workIn);
  const dur=hasWork?(state.workOut-state.workIn):Math.max(6,duration()), start=hasWork?state.workIn:0;
  const c=makeAdjustClip(li,start,dur); state.clips.push(c); state.selId=c.id; state.selIds=[c.id]; state.selGroupId=null;
  renderTimeline(); renderInspector(); render(); markDirty(); flashStatus(T('Adjustment layer added — add Reactive FX to affect everything below','Capa de ajuste añadida — añade FX reactivos para afectar todo lo de debajo')); }

/* ---- Reactive FX inspector panel ---- */
function reactiveAudioClips(){ return state.clips.filter(c=>{ const m=mediaById(c.mediaId); return m&&m.kind==='audio'; }); }
function fxKey(f,k){ return 'fx:'+f.id+':'+k; }
function fxHasKf(host,f,k){ const key=fxKey(f,k); return !!(host.kf&&host.kf[key]&&host.kf[key].length); }
function fxKfToggle(host,f,k){ const key=fxKey(f,k); pushUndo(); if(fxHasKf(host,f,k)){ delete host.kf[key]; }
  else { if(!host.kf)host.kf={}; const base=(k==='int'?f.int:k==='amt'?f.amt:(f.params?f.params[k]:0)); host.kf[key]=[{t:Math.max(0,state.playhead-host.start),v:base,e:curEase()}];
    { const lane=state.lanes[host.lane]; if(lane&&lane.kind!=='audio'&&FXBY[f.type])lane._autoP='fxt:'+f.type+':'+k; } state.inlineCurves=true; syncAutoUI(); { const b=$('#curvesBtn'); if(b)b.classList.add('on'); } renderTimeline(); } // [R93] reveal in the unified automation view: the track's primary lane shows this fx param
  markDirty(); }
/* [A3] Show Automation for an effect: reveal its curve on the track (the single overlay), picking an already-automated param if there is one, else Intensity */
function fxShowAutomation(host,f){ const def=FXBY[f.type]; if(!def)return; if(isAudioClip(host)){ flashStatus(T('Audio clips have no visual automation','Los clips de audio no tienen automatización visual'),'err'); return; }
  const keys=['int','amt'].concat((def.params||[]).map(p=>p.k)); let k=keys.find(kk=>fxHasKf(host,f,kk))||'int';
  const lane=state.lanes[host.lane]; if(lane&&lane.kind!=='audio')lane._autoP='fxt:'+f.type+':'+k;
  state.inlineCurves=true; syncAutoUI(); { const b=$('#curvesBtn'); if(b)b.classList.add('on'); } renderTimeline(); flashStatus(T('Showing automation · ','Mostrando automatización · ')+T(def.label[0],def.label[1])); }
const _fxCollapsed=new Set(); // collapsed effect cards (by fx id) — UI only, not serialized
const FX_META={atk:1,rel:1,curve:1,spring:1}; // per-effect modulation-shaping fields (live on the fx object, not automatable shader params)
function setFxParam(host,fx,k,v){ if(FX_META[k]){ fx[k]=v; return; } if(k==='int')fx.int=v; else if(k==='amt')fx.amt=v; else { fx.params=fx.params||{}; fx.params[k]=v; } } // meta changes need no cache invalidation: the shaping signature is part of the env-cache key
function fxParamVal(fx,k){ if(FX_META[k]){ const cfg=ensureReactive(); return fx[k]!=null?fx[k]:(k==='atk'?cfg.attack:k==='rel'?cfg.release:k==='curve'?50:0); }
  return (k==='int')?(fx.int!=null?fx.int:0):(k==='amt')?(fx.amt!=null?fx.amt:100):((fx.params&&fx.params[k]!=null)?fx.params[k]:0); }
/* app-styled fader — reuses the inspector .field/.track/.box; drag to scrub (shift=fine, alt=coarse), dbl-click to type */
function startFxFader(e,host,fx,k,mn,mx){ e.preventDefault(); const field=e.currentTarget; const x0=e.clientX, v0=fxParamVal(fx,k), span=(mx-mn)||1; let pushed=false; const bar=field.querySelector('.track>i'), num=field.querySelector('.num');
  const mv=ev=>{ let sp=span/300; if(ev.shiftKey)sp/=5; if(ev.altKey)sp*=4; let nv=Math.max(mn,Math.min(mx,v0+(ev.clientX-x0)*sp)); nv=Math.round(nv*100)/100; if(!pushed){pushUndo();pushed=true;} setFxParam(host,fx,k,nv); if(bar)bar.style.width=((nv-mn)/span*100)+'%'; if(num)num.textContent=Math.round(nv*10)/10; if(_raOn)raInvalidate(); render(); };
  const up=()=>{ pushed=false; markDirty(); window.removeEventListener('pointermove',mv); window.removeEventListener('pointerup',up); }; window.addEventListener('pointermove',mv); window.addEventListener('pointerup',up); }
function fxEditVal(host,fx,k,field){ const mn=+field.dataset.mn,mx=+field.dataset.mx; appPrompt(field.dataset.lbl||T('Value','Valor'),String(fxParamVal(fx,k)),v=>{ if(v==null)return; const nv=parseFloat(String(v).replace(',','.')); if(isNaN(nv))return; pushUndo(); setFxParam(host,fx,k,Math.max(mn,Math.min(mx,nv))); markDirty(); if(_raOn)raInvalidate(); renderReactivePanel(); render(); }); }
function fxFaderRow(host,fx,k,label,mn,mx,unit,showKf){ const v=fxParamVal(fx,k), pct=Math.max(0,Math.min(100,(v-mn)/((mx-mn)||1)*100)), kfOn=showKf&&fxHasKf(host,fx,k);
  return `<div class="prow fxrow" data-k="${k}" style="gap:6px;">
    ${showKf?`<button class="kf ${kfOn?'on':''}" data-kf title="${T('Animate','Animar')}">${ICO(kfOn?'kfFull':'kfEmpty',12)}</button>`:`<span class="kf" style="cursor:default;visibility:hidden;"></span>`}
    <span class="lab">${label}</span>
    <div class="field" data-k="${k}" data-mn="${mn}" data-mx="${mx}" data-lbl="${label}"><div class="track"><i style="width:${pct}%"></i></div><div class="box"><span class="num">${Math.round(v*10)/10}</span><span class="u">${unit}</span></div></div>
  </div>`; }
/* audio-engine fader (same look), bound to state.reactive[prop] */
function arFaderRow(prop,label,mn,mx,val,unit){ const pct=Math.max(0,Math.min(100,(val-mn)/((mx-mn)||1)*100)); return `<div class="prow" style="gap:8px;"><span class="kf" style="cursor:default;visibility:hidden;"></span><span class="lab">${label}</span><div class="field arfld" data-prop="${prop}" data-mn="${mn}" data-mx="${mx}" data-lbl="${label}"><div class="track"><i style="width:${pct}%"></i></div><div class="box"><span class="num">${Math.round(val)}</span><span class="u">${unit}</span></div></div></div>`; }
function fxAnyKf(c,f){ const def=FXBY[f.type]; if(!def)return false; if(fxHasKf(c,f,'int')||fxHasKf(c,f,'amt'))return true; return (def.params||[]).some(p=>fxHasKf(c,f,p.k)); } // [A5] any of this effect's parameters carries automation
function fxCardHtml(c,f){ const def=FXBY[f.type]; if(!def)return ''; const nm=T(def.label[0],def.label[1]); const open=!_fxCollapsed.has(c.id+':'+f.id); const on=f.on!==false; const autod=fxAnyKf(c,f);
  const bands=[['bass',T('Bass','Bajo')],['mid',T('Mid','Medio')],['treble',T('Treble','Agudo')],['bright',T('Bright','Brillo')],['none',T('None','Ninguna')]];
  const modes=[['follow',T('Follow','Seguir')],['trigger',T('Trigger','Disparo')],['lfo','LFO']];
  const shapes=[['sine','Sine'],['tri','Tri'],['saw','Saw'],['square','Square'],['sh',T('Random','Aleatorio')]];
  const divs=[['4bar','4 '+T('bars','compases')],['2bar','2 '+T('bars','compases')],['1bar','1 '+T('bar','compás')],['1/2','1/2'],['1/4','1/4'],['1/8','1/8'],['1/16','1/16']];
  const isLfo=f.mode==='lfo', isFollow=(f.mode||'follow')==='follow';
  const body = open ? `<div class="fxbody">
      <div class="fxsec">${T('Routing','Ruteo')}</div>
      <div class="fxseg">
        <select class="fxband selsel" title="${T('React to band','Reaccionar a la banda')}" style="flex:1;height:18px;${isLfo?'opacity:.45;':''}" ${isLfo?'disabled':''}>${bands.map(b=>`<option value="${b[0]}" ${f.band===b[0]?'selected':''}>${b[1]}</option>`).join('')}</select>
        <select class="fxmode selsel" title="${T('Follow the envelope, trigger on the band onsets, or run a BPM-synced LFO','Seguir la envolvente, disparar en los golpes de esta banda, o LFO sincronizado al BPM')}" style="flex:1;height:18px;">${modes.map(b=>`<option value="${b[0]}" ${f.mode===b[0]?'selected':''}>${b[1]}</option>`).join('')}</select>
        <button class="fxinv" title="${T('Invert the modulation','Invertir la modulación')}" style="width:26px;height:18px;font-size:11px;font-weight:700;letter-spacing:.03em;border-radius:2px;border:.5px solid rgba(255,255,255,${f.inv?'0.35':'0.12'});background:${f.inv?'#2A2E35':'transparent'};color:${f.inv?'#E8EAED':'#71777F'};cursor:pointer;">INV</button>
      </div>
      ${isLfo?`<div class="fxseg">
        <select class="fxshape selsel" title="${T('LFO shape','Forma del LFO')}" style="flex:1;height:18px;">${shapes.map(b=>`<option value="${b[0]}" ${f.lfoShape===b[0]?'selected':''}>${b[1]}</option>`).join('')}</select>
        <select class="fxdiv selsel" title="${T('Cycle length (synced to BPM)','Duración del ciclo (sincronizado al BPM)')}" style="flex:1;height:18px;">${divs.map(b=>`<option value="${b[0]}" ${f.lfoDiv===b[0]?'selected':''}>${b[1]}</option>`).join('')}</select>
      </div>`:''}
      <div class="fxsec">${T('Response','Respuesta')}</div>
      ${fxFaderRow(c,f,'int',T('Intensity','Intensidad'),0,100,'%',true)}
      ${fxFaderRow(c,f,'amt',T('Reactivity','Reactividad'),0,100,'%',true)}
      ${!isLfo?fxFaderRow(c,f,'atk',T('Attack','Ataque'),0,400,'ms',false)+fxFaderRow(c,f,'rel',T('Release','Caída'),10,1500,'ms',false):''}
      ${fxFaderRow(c,f,'curve',T('Curve','Curva'),0,100,'',false)}
      ${isFollow?fxFaderRow(c,f,'spring',T('Bounce','Rebote'),0,100,'',false):''}
      ${def.params.length?`<div class="fxsec">${T('Parameters','Parámetros')}</div>
      ${def.params.map(p=>fxFaderRow(c,f,p.k,T(p.label[0],p.label[1]),p.min,p.max,p.unit,true)).join('')}`:''}
    </div>` : '';
  const ib='width:16px;height:16px;display:flex;align-items:center;justify-content:center;border-radius:2px;padding:0;cursor:pointer;';
  return `<div class="fxcard${on?'':' fxoff'}" data-fx="${f.id}" style="margin:0 10px 5px;border:.5px solid rgba(255,255,255,0.10);border-radius:2px;background:var(--s0);overflow:hidden;${on?'':'opacity:.5;'}">
    <div class="fxhdr" style="display:flex;align-items:center;gap:2px;padding:3px 5px 3px 3px;background:var(--s1);">
      <span class="fxdrag" title="${T('Drag to reorder','Arrastra para reordenar')}" style="cursor:grab;color:#565C66;display:flex;padding:0 1px;">${ICO('grip',12)}</span>
      <button class="fxtog" title="${on?T('Bypass effect','Omitir efecto'):T('Enable effect','Activar efecto')}" style="${ib}color:${on?'#C9CDD3':'#565C66'};">${ICO('power',11)}</button>
      <span class="fxname" title="${T('Collapse / expand','Contraer / expandir')}" style="flex:1;min-width:0;font-size:11px;color:${on?'#DEE1E5':'#8b929c'};font-weight:600;letter-spacing:.01em;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${nm}</span>
      <span class="fxauto" title="${T('This effect has automation — right-click the header to show it','Este efecto tiene automatización — clic derecho en la cabecera para verla')}" style="flex-shrink:0;font-size:10px;color:var(--auto-live);${autod?'':'display:none;'}">◆</span>
      <i class="fxsig" data-fxid="${f.id}" title="${T('Live modulation level','Nivel de modulación en vivo')}" style="width:26px;height:4px;border-radius:2px;background:#23262B;overflow:hidden;display:block;position:relative;margin:0 2px;"><b style="position:absolute;left:0;top:0;bottom:0;width:0%;background:var(--ink);display:block;"></b></i>
      <button class="fxcol" title="${open?T('Collapse','Contraer'):T('Expand','Expandir')}" style="${ib}color:var(--ink-3);"><span style="display:inline-flex;transform:rotate(${open?0:-90}deg);">${ICO('chevDown',11)}</span></button>
      <button class="fxdel" title="${T('Remove','Quitar')}" style="${ib}color:var(--ink-3);">${ICO('trash',11)}</button>
    </div>${body}</div>`; }
function renderReactivePanel(){ const host=$('#insReactive'); if(!host)return; const cfg=ensureReactive();
  if(!_arCache){ const sm=reactiveSourceMedia(); if(sm){ if(sm.bands)arRecompute(); else armMediaBands(sm,sm.buffer); } }
  const auds=reactiveAudioClips();
  const srcOpts=['<option value="">'+T('None','Ninguna')+'</option>'].concat(auds.map(c=>{ const m=mediaById(c.mediaId); const tag=m&&m._bandsBusy?' …':(m&&!m.bands?' ⚠':''); return `<option value="${c.id}" ${cfg.srcClipId===c.id?'selected':''}>${(m?m.name:'audio')}${tag}</option>`; })).join('');
  const c=selClip();
  const chainHtml = c ? ((c.fx&&c.fx.length)?c.fx.map(f=>fxCardHtml(c,f)).join(''):`<div style="padding:14px;color:var(--ink-dim);font-size:11px;">${T('No effects yet. Add one below.','Sin efectos aún. Añade uno abajo.')}</div>`)
    : `<div style="padding:18px 14px;color:var(--ink-dim);font-size:11px;line-height:1.5;">${T('Select a clip in the timeline to build its reactive effect chain.','Selecciona un clip en la línea de tiempo para construir su cadena de efectos reactiva.')}</div>`;
  host.innerHTML=`
    <div class="selhead"><div class="selthumb" style="display:grid;place-items:center;color:var(--ink-2);">${ICO('curves',18)}</div>
      <div style="flex:1;min-width:0;"><div class="selname">${T('Reactive FX','FX Reactivos')}</div><div class="selmeta">${c?c.name:T('Audio-reactive effect chain','Cadena reactiva al audio')}</div></div></div>
    <button class="sechead"><span style="color:var(--ink-dim);display:flex;">${ICO('chevDown')}</span><span class="t">${T('Audio Engine','Motor de audio')}</span><span class="ln"></span></button>
    <div style="padding:1px 12px 6px;display:flex;flex-direction:column;gap:2px;">
      <div class="prow" style="gap:6px;"><span class="kf" style="cursor:default;visibility:hidden;"></span><span class="lab">${T('Source','Fuente')}</span><select class="selsel" id="arSrc" style="flex:1;height:18px;">${srcOpts}</select></div>
      <div style="padding:2px 0 5px;"><canvas id="arMeter" width="252" height="54" style="width:100%;height:54px;border-radius:2px;background:var(--s0);display:block;"></canvas></div>
      <div class="prow" style="gap:8px;"><span class="kf" style="cursor:default;visibility:hidden;"></span><span class="lab">BPM</span>
        <div id="arBpmBox" title="${T('Click to set manually (0 = auto)','Clic para fijar manualmente (0 = auto)')}" style="flex:1;display:flex;align-items:center;gap:6px;cursor:pointer;height:18px;">
          <span id="arBpmV" style="font-size:11px;color:var(--ink);font-weight:600;">${(cfg.bpm>0)?Math.round(cfg.bpm):((_arCache&&_arCache.bpm)?Math.round(_arCache.bpm):'—')}</span>
          <span style="font-size:11px;color:var(--ink-dim);letter-spacing:.04em;">${(cfg.bpm>0)?'MANUAL':'AUTO'}</span>
        </div></div>
      ${arFaderRow('gain',T('Gain','Ganancia'),0,300,cfg.gain,'%')}
      ${arFaderRow('gate',T('Gate','Puerta'),0,80,cfg.gate,'%')}
      ${arFaderRow('attack',T('Attack','Ataque'),1,300,Math.round(cfg.attack),'ms')}
      ${arFaderRow('release',T('Release','Caída'),10,900,Math.round(cfg.release),'ms')}
    </div>
    <button class="sechead"><span style="color:var(--ink-dim);display:flex;">${ICO('chevDown')}</span><span class="t">${T('Effects Chain','Cadena de efectos')}</span><span class="ln"></span></button>
    <div id="arChain">${chainHtml}</div>
    <div style="padding:6px 12px 4px;"><button class="mbtn" id="arAddFx" ${c?'':'disabled style="opacity:.5;"'} style="width:100%;justify-content:center;gap:6px;height:24px;font-size:11px;border-radius:2px;">${ICO('plus',12)} ${T('Add Effect','Añadir efecto')}</button></div>
    <div style="padding:0 12px 14px;"><button class="mbtn" id="arAddAdj" title="${T('A layer whose effects affect everything below it','Una capa cuyos efectos afectan todo lo de debajo')}" style="width:100%;justify-content:center;gap:6px;height:24px;font-size:11px;border-radius:2px;">${ICO('plus',12)} ${T('Add Adjustment Layer','Añadir capa de ajuste')}</button></div>`;
  $('#arSrc').onchange=e=>{ pushUndo(); cfg.srcClipId=e.target.value?(+e.target.value):null; const m=reactiveSourceMedia(); if(m&&!m.bands&&!m._bandsBusy)armMediaBands(m,m.buffer); arRecompute(); if(_raOn)raInvalidate(); render(); markDirty(); renderReactivePanel(); };
  { const bb=$('#arBpmBox'); if(bb)bb.onclick=()=>{ appPrompt(T('BPM (0 = auto)','BPM (0 = auto)'),String(cfg.bpm||0),v=>{ if(v==null)return; const nv=parseFloat(String(v).replace(',','.')); if(isNaN(nv))return; pushUndo(); cfg.bpm=Math.max(0,Math.min(300,nv)); if(_raOn)raInvalidate(); markDirty(); renderReactivePanel(); render(); }); }; }
  // audio-engine faders (app-styled .field, drag + dbl-click to type)
  $$('#insReactive .arfld').forEach(field=>{ const prop=field.dataset.prop, mn=+field.dataset.mn, mx=+field.dataset.mx;
    field.addEventListener('pointerdown',e=>{ if(e.button!==0)return; e.preventDefault(); const x0=e.clientX, v0=cfg[prop], span=(mx-mn)||1; let pushed=false; const bar=field.querySelector('.track>i'), num=field.querySelector('.num');
      const mv=ev=>{ let sp=span/300; if(ev.shiftKey)sp/=5; if(ev.altKey)sp*=4; let nv=Math.max(mn,Math.min(mx,v0+(ev.clientX-x0)*sp)); nv=Math.round(nv); if(!pushed){pushUndo();pushed=true;} cfg[prop]=nv; if(bar)bar.style.width=((nv-mn)/span*100)+'%'; if(num)num.textContent=nv; arRecompute(); if(_raOn)raInvalidate(); render(); };
      const up=()=>{ pushed=false; markDirty(); window.removeEventListener('pointermove',mv); window.removeEventListener('pointerup',up); }; window.addEventListener('pointermove',mv); window.addEventListener('pointerup',up); });
    field.addEventListener('dblclick',()=>{ appPrompt(field.dataset.lbl||prop,String(cfg[prop]),v=>{ if(v==null)return; const nv=parseFloat(String(v).replace(',','.')); if(isNaN(nv))return; pushUndo(); cfg[prop]=Math.max(mn,Math.min(mx,nv)); arRecompute(); if(_raOn)raInvalidate(); markDirty(); renderReactivePanel(); render(); }); });
  });
  const addb=$('#arAddFx'); if(addb&&c)addb.onclick=(e)=>openFxMenu(e);
  const adjb=$('#arAddAdj'); if(adjb)adjb.onclick=()=>addAdjustmentLayer();
  wireReactiveChain(c); arMeterStart();
}
function wireReactiveChain(c){ if(!c)return; $$('#arChain .fxcard').forEach(card=>{ const id=+card.dataset.fx; const f=(c.fx||[]).find(x=>x.id===id); if(!f)return;
  const tog=card.querySelector('.fxtog'); if(tog)tog.onclick=()=>{ pushUndo(); f.on=(f.on===false); if(_raOn)raInvalidate(); render(); markDirty(); renderReactivePanel(); };
  { const hdr=card.querySelector('.fxhdr'); if(hdr)hdr.oncontextmenu=ev=>{ ev.preventDefault(); ev.stopPropagation(); openMenu(ev.clientX,ev.clientY,[ // [A3] right-click the effect → Show Automation (reveals its curve on the track)
    {label:T('Show Automation','Mostrar automatización'),ico:'curves',fn:()=>fxShowAutomation(c,f)},
    {label:(f.on===false)?T('Enable effect','Activar efecto'):T('Bypass effect','Omitir efecto'),fn:()=>{ pushUndo(); f.on=(f.on===false); if(_raOn)raInvalidate(); render(); markDirty(); renderReactivePanel(); }},
    'sep',
    {label:T('Remove','Quitar'),danger:true,fn:()=>{ const del=card.querySelector('.fxdel'); if(del)del.onclick&&del.onclick(); }}
  ]); }; }
  const _coll=()=>{ const ck=c.id+':'+id; if(_fxCollapsed.has(ck))_fxCollapsed.delete(ck); else _fxCollapsed.add(ck); renderReactivePanel(); };
  const col=card.querySelector('.fxcol'); if(col)col.onclick=_coll;
  const nmEl=card.querySelector('.fxname'); if(nmEl)nmEl.onclick=_coll;
  const del=card.querySelector('.fxdel'); if(del)del.onclick=()=>{ pushUndo(); freeFxHistOne(c.id,id); _fxCollapsed.delete(c.id+':'+id); c.fx=(c.fx||[]).filter(x=>x.id!==id);
    const pre='fx:'+id+':'; if(c.kf)for(const k of Object.keys(c.kf))if(k.indexOf(pre)===0)delete c.kf[k]; if(state.autoSel&&state.autoSel.cid===c.id&&state.autoSel.p.indexOf(pre)===0)state.autoSel=null;
    for(const l of state.lanes){ if(l._autoP&&isFxtKey(l._autoP)&&!laneFxTypes(state.lanes.indexOf(l)).includes(l._autoP.split(':')[1]))delete l._autoP; } // [R93] si el TIPO de fx dejó la pista, quita su superposición · [R143] el filtro de lane._auto (sub-carriles) se archivó
    renderReactivePanel(); renderTimeline(); render(); markDirty(); };
  const drag=card.querySelector('.fxdrag'); if(drag)drag.addEventListener('pointerdown',e=>fxDragHandle(e,c,id));
  const bs=card.querySelector('.fxband'); if(bs)bs.onchange=e=>{ pushUndo(); f.band=e.target.value; if(_raOn)raInvalidate(); render(); markDirty(); };
  const ms=card.querySelector('.fxmode'); if(ms)ms.onchange=e=>{ pushUndo(); f.mode=e.target.value; if(_raOn)raInvalidate(); render(); markDirty(); renderReactivePanel(); }; // re-render: the body swaps LFO/shaping rows per mode
  const iv=card.querySelector('.fxinv'); if(iv)iv.onclick=()=>{ pushUndo(); f.inv=!f.inv; if(_raOn)raInvalidate(); render(); markDirty(); renderReactivePanel(); };
  const shp=card.querySelector('.fxshape'); if(shp)shp.onchange=e=>{ pushUndo(); f.lfoShape=e.target.value; if(_raOn)raInvalidate(); render(); markDirty(); };
  const dv=card.querySelector('.fxdiv'); if(dv)dv.onchange=e=>{ pushUndo(); f.lfoDiv=e.target.value; if(_raOn)raInvalidate(); render(); markDirty(); };
  card.querySelectorAll('.fxrow').forEach(row=>{ const k=row.dataset.k, field=row.querySelector('.field');
    if(field){ field.addEventListener('pointerdown',ev=>{ if(ev.button!==0||ev.target.tagName==='INPUT')return; startFxFader(ev,c,f,k,+field.dataset.mn,+field.dataset.mx); }); field.addEventListener('dblclick',()=>fxEditVal(c,f,k,field)); }
    const kf=row.querySelector('.kf[data-kf]'); if(kf)kf.onclick=()=>{ fxKfToggle(c,f,k); renderReactivePanel(); render(); }; });
}); }
function addFxToClip(c,key){ if(!c)return; pushUndo(); if(!c.fx)c.fx=[]; c.fx.push(newFx(key));
  if(ensureReactive().srcClipId==null){ const a=reactiveAudioClips()[0]; if(a){ ensureReactive().srcClipId=a.id; const m=mediaById(a.mediaId); if(m&&!m.bands)armMediaBands(m,m.buffer); arRecompute(); } }
  renderReactivePanel(); render(); markDirty(); }
function openFxMenu(e){ const c=selClip(); if(!c){ flashStatus(T('Select a clip first','Selecciona un clip primero')); return; }
  const items=[]; let first=true;
  for(const cat of ['distort','stylize','color','feedback','dome']){ const defs=FXTYPES.filter(d=>d.cat===cat); if(!defs.length)continue; if(!first)items.push('sep'); first=false;
    for(const d of defs) items.push({label:T(d.label[0],d.label[1]), fn:()=>addFxToClip(c,d.key)}); }
  const r=e.target.getBoundingClientRect(); openMenu(r.left, Math.max(46, r.top-8-Math.min(items.length,20)*22), items); }
/* drag-reorder an effect card by its grip */
function fxDragHandle(e,host,fxId){ e.preventDefault(); const chain=$('#arChain'); if(!chain)return; const card=[...chain.querySelectorAll('.fxcard')].find(cc=>+cc.dataset.fx===fxId); if(!card)return;
  card.style.opacity='0.4'; chain.style.position='relative';
  const ind=document.createElement('div'); ind.style.cssText='position:absolute;left:12px;right:12px;height:2px;background:var(--ink-2);border-radius:2px;pointer-events:none;z-index:9;'; chain.appendChild(ind);
  let target=host.fx.findIndex(f=>f.id===fxId);
  const move=ev=>{ const cs=[...chain.querySelectorAll('.fxcard')]; target=cs.length; for(let i=0;i<cs.length;i++){ const r=cs[i].getBoundingClientRect(); if(ev.clientY < r.top + r.height/2){ target=i; break; } } const cr=chain.getBoundingClientRect(); let y; if(target<cs.length){ y=cs[target].getBoundingClientRect().top-cr.top; } else { const last=cs[cs.length-1].getBoundingClientRect(); y=last.bottom-cr.top; } ind.style.top=(y-1)+'px'; };
  const up=()=>{ window.removeEventListener('pointermove',move); window.removeEventListener('pointerup',up); ind.remove(); const from=host.fx.findIndex(f=>f.id===fxId); let to=target; if(to>from)to--; if(to!==from && to>=0){ pushUndo(); const [it]=host.fx.splice(from,1); host.fx.splice(Math.max(0,Math.min(host.fx.length,to)),0,it); markDirty(); if(_raOn)raInvalidate(); render(); } renderReactivePanel(); };
  window.addEventListener('pointermove',move); window.addEventListener('pointerup',up); }
let _arMeterRaf=0;
function arMeterStart(){ if(_arMeterRaf)return; const tick=()=>{ _arMeterRaf=0; if(state.inspTab!=='react'||!$('#arMeter'))return; arDrawMeter(); arDrawSigs(); _arMeterRaf=requestAnimationFrame(tick); }; _arMeterRaf=requestAnimationFrame(tick); }
function _arLastOnsetAge(band,t){ if(!_arCache||!_arCache.onsets)return 99; const c=_arCache.clip; if(!c||t<c.start||t>c.start+c.dur)return 99; const local=srcT(c,t), os=_arCache.onsets[band]; if(!os||!os.length)return 99;
  let lo=0,hi=os.length-1,last=-1; while(lo<=hi){ const md=(lo+hi)>>1; if(os[md]<=local){last=os[md];lo=md+1;}else hi=md-1; } return last<0?99:(local-last); }
function arDrawMeter(){ const cv=$('#arMeter'); if(!cv)return; const x=cv.getContext('2d'), W=cv.width,H=cv.height; x.clearRect(0,0,W,H);
  const t=state.playhead, vals=[['BASS','bass','#8A9199'],['MID','mid','#B4BAC1'],['TREB','treble','#E8EAED'],['BRT','bright','#F2F4F6']];
  const bw=(W-16)/4; vals.forEach((bar,i)=>{ const lv=bandLevelAt(bar[1],t); const bx=8+i*bw, iw=bw-12, bh=Math.max(1,lv*(H-14));
    x.fillStyle='#151922'; x.fillRect(bx+5,4,iw,H-14); x.fillStyle=bar[2]; x.fillRect(bx+5,4+(H-14-bh),iw,bh);
    if(bar[1]!=='bright'&&_arLastOnsetAge(bar[1],t)<0.11){ x.fillStyle='#FFFFFF'; x.fillRect(bx+5,4,iw,2); } // onset flash on the band top
    x.fillStyle=UI.ink3; x.font='11px Geist'; x.textAlign='center'; x.fillText(bar[0],bx+5+iw/2,H-3); });
  // beat-grid blink (top-right dot, phase-locked to the detected/manual BPM)
  const cfg=ensureReactive(), bpm=(cfg.bpm>0?cfg.bpm:(_arCache&&_arCache.bpm)||0);
  if(bpm>0&&_arCache&&_arCache.clip){ const c=_arCache.clip; if(t>=c.start&&t<=c.start+c.dur){ const beats=((srcT(c,t))-(_arCache.beat0||0))*bpm/60; const ph=beats-Math.floor(beats);
    x.fillStyle=ph<0.18?'#FFFFFF':'#2A2E35'; x.beginPath(); x.arc(W-9,9,3.4,0,6.2832); x.fill(); } } }
/* live modulator lamps on the effect cards — shows exactly what each effect is "feeling" */
function arDrawSigs(){ const c=selClip(); const els=$$('#arChain .fxsig>b'); if(!els.length)return;
  const ot=_arTime; _arTime=state.playhead;
  for(const el of els){ const id=+el.parentNode.dataset.fxid; const f=(c&&c.fx||[]).find(x=>x.id===id); el.style.width=(f?Math.round(clamp01(fxModLevel(f))*100):0)+'%'; }
  _arTime=ot; }
function applyInspTab(){ const r=state.inspTab==='react'; const rv=$('#insReactive'); if(rv)rv.style.display=r?'block':'none'; if(r){ ['#insEmpty','#insGroup','#insCtl'].forEach(s=>{const e=$(s);if(e)e.style.display='none';}); }
  $$('#inspTabs .instab').forEach(b=>{ const on=(b.dataset.tab==='react')===r; b.classList.toggle('on',on); b.style.opacity=on?'1':'0.5'; b.style.borderBottom=on?'2px solid #E8EAED':'2px solid transparent'; }); }
$$('#inspTabs .instab').forEach(b=>{ b.onclick=()=>{ state.inspTab=b.dataset.tab; renderInspector(); if(state.inspTab==='react')arMeterStart(); }; });

/* ===================== INIT ===================== */
function init(){
  loadWorkspace(); applyLang(); syncSimpleUI(); // [R94f] Simple clips is the default → light the button + set body.simpleclips on boot
  ensureSequences(); renderSeqBar();
  renderMedia(); renderTimeline(); renderInspector(); vzLbl(); updViewCtl(); updStatus(); projTitle();
  if(state.prefs.tallInsp){ try{setTallInsp(true);}catch(e){} }
  requestAnimationFrame(()=>{resize();requestAnimationFrame(resize);}); setTimeout(resize,200);
  if(!HAS_WC) $('#statEngine').textContent='WebGL · MediaRecorder';
  // diagnostics: session header + periodic flush / GL-error check / heartbeat; final flush on close
  let glRenderer=null; try{ const di=gl.getExtension('WEBGL_debug_renderer_info'); glRenderer=di?gl.getParameter(di.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER); }catch(_){}
  diag('info','session','Dome Studio Pro session start',{ ua:navigator.userAgent, electron:IS_ELEC, hasWebCodecs:HAS_WC, gpu:glRenderer, maxTex:(()=>{try{return gl.getParameter(gl.MAX_TEXTURE_SIZE);}catch(_){return null;}})(), screen:[screen.width,screen.height], dpr:window.devicePixelRatio, lang:state.lang });
  if(IS_ELEC&&DSP.diagPath){ DSP.diagPath().then(p=>{ if(p)diag('info','session','log file: '+p); }); }
  diagFlush(); startPerfMeters(); startMotionPreview();
  // drop a Motion chip on the dome viewport → apply to the selected clip
  gridc.addEventListener('dragover',e=>{ if([...e.dataTransfer.types].includes('text/dsp-anim')){ e.preventDefault(); } });
  gridc.addEventListener('drop',e=>{ let k=''; try{k=e.dataTransfer.getData('text/dsp-anim');}catch(_){ } if(!k)return; e.preventDefault(); const cc=selClip(); if(!cc){ flashStatus(T('Select a clip first','Selecciona un clip primero')); return; } pushUndo(); addAnimPreset(cc,k); renderInspector(); renderTimeline(); render(); startMotionPreview(); markDirty(); flashStatus(T('Motion added','Movimiento añadido')); });
  setInterval(()=>{ glCheck('tick'); let mem=null; try{ if(performance.memory)mem=Math.round(performance.memory.usedJSHeapSize/1048576); }catch(_){} diag('debug','heartbeat','',{seq:activeSeq()&&activeSeq().name, clips:state.clips.length, media:state.media.length, playing:state.playing, ph:+state.playhead.toFixed(2), heapMB:mem}); diagFlush(); }, 5000);
  window.addEventListener('beforeunload',()=>{ try{stopNDI();}catch(_){ } try{closeAllNdi();}catch(_){ } diag('info','session','session end'); diagFlush(); });
  document.addEventListener('visibilitychange',()=>{ if(document.hidden){ diag('info','session','hidden'); diagFlush(); } });
  showSplash(2, ()=>{ if(!document.getElementById('loadingOv') && !currentPath) showLanding(); }); // [R134] branded logo-loop splash (~2 cycles) → start screen, unless a double-clicked project is already opening
  if(IS_ELEC&&DSP.onConfirmClose){ DSP.onConfirmClose(()=>{ appConfirm(T('You have unsaved changes. Close without saving?','Hay cambios sin guardar. ¿Cerrar sin guardar?'),ok=>{ if(ok&&DSP.forceClose)DSP.forceClose(); },{ok:T('Close without saving','Cerrar sin guardar'),cancel:T('Cancel','Cancelar'),danger:true}); }); } // styled close confirm (replaces the native OS dialog)
}
init();
