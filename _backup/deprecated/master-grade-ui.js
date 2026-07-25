/* ============================================================================================================
   ARCHIVED — Master Grade inspector UI  ·  removed by the Claude Design "Rev 1" redesign (2026-07-25)
   ------------------------------------------------------------------------------------------------------------
   The redesign has NO always-visible "Master Grade" section: per-clip grading lives in the inspector's Color
   section. Per Beltrán's rule ("lo que no está en el diseño se saca → deprecated") this UI builder was pulled
   out of app.js. Only the *UI* was removed — the GRADE LOGIC stays live in app.js and keeps working:
     · state.seqGrade                         (the data; default all-0 = no-op)
     · masterGradeOn() / applyMasterGrade()   (grades the final composite in render + NDI/Spout + export)
     · _masterClip                            (LUT/curve texture-cache stand-in)
     · saveActiveSeq(): s.grade=state.seqGrade (per-sequence persistence)
   With no UI, state.seqGrade stays at its defaults, so the grade is dormant (identity). To restore editing,
   re-mount an #insMaster host and call renderMasterGrade() from renderInspector() again.

   Original location: app.js lines ~2848-2909 (between propLabel and renderInspector).
   ============================================================================================================ */

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
