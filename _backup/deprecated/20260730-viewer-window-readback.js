/* ARCHIVADO — ADR-0007 (código deprecado se archiva, no se borra)
 *
 * Origen : app.js · openViewerWindow() / closeViewerGL() / renderViewer(srcTex) + su estado
 *          (_viewerCam, _viewerGrid, _vFBO/_vTex/_vDepth/_vW/_vH/_vBuf/_vImg/_vImgCv) y la llamada
 *          `if(_viewerWin)renderViewer(_srcTex);` al final de render().
 * Fecha  : 2026-07-30
 * Ticket : R226 · Etapa 4 de la tanda de Beltrán (docs/NEXT.md) — «Viewer-only window: arreglar el cuelgue +
 *          vista COMPLEMENTARIA»
 *
 * CAUSA RAÍZ DEL CUELGUE (medida por CDP en la app real, dome 2D con UN clip de forma):
 *   render() costaba 0,05 ms con la ventana cerrada y 9,66 ms con ella abierta — 200×. Todo el coste era este
 *   espejo: se re-dibujaba la escena en una FBO propia y se traía a la CPU con `gl.readPixels` SÍNCRONO
 *   (3,3 MB a 944², 6,5 MB al tope de 1280²), lo que vacía la tubería de la GPU en cada fotograma, más un
 *   `putImageData` de todo el búfer. Desglose: readPixels 3,57 ms · putImageData 0,71 ms · drawImage 0,01 ms.
 *   Efecto medido en reproducción: 60,4 fps → 36,6 fps con una escena TRIVIAL; con vídeo real y un composite de
 *   4K el editor se va por debajo de 30 y deja de responder entre fotogramas — eso es lo que Beltrán vio como
 *   «se queda pegado». Y como cada gesto de la ventana (orbitar, rueda, botón de grilla) llamaba a `render()`,
 *   arrastrar dentro de la ventana bloqueaba también al editor.
 *   Fallo secundario: el botón de grilla se estilaba con `color:var(--ink)`, variable que vive en el documento
 *   del editor y NO en el `about:blank` de la emergente → texto casi invisible.
 *
 * SUSTITUTO (R226): `viewerPaint()` no lee píxeles. Intercambia los globales de vista (patrón de
 *   `lchEditorShot`), llama al `render()` de siempre con el modo COMPLEMENTARIO y el tamaño de la ventana, y
 *   copia `glc` + `gridc` a la emergente con `drawImage` (GPU→GPU). Coste medido: 1,73 ms por fotograma
 *   (5,6× mejor), y sólo cuando algo cambió (`_vDirty`), con bombeo desde el rAF PROPIO de la ventana.
 *   Ventaja de regalo: la sala 360 en 3D, los rótulos, la grilla y el pill de «Preparando medios…» salen gratis,
 *   porque es el mismo camino de dibujo del editor.
 *
 * Restaurar: pegar el bloque de abajo en app.js sustituyendo la sección «POP-OUT VIEWER WINDOW», devolver
 *   `if(_viewerWin)renderViewer(_srcTex);` al final de render() y quitar `_reuseComp`/`_lastSrcTex`.
 */

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
      buildDomeMesh(curCovHalf()); gl.useProgram(P3); gl.bindVertexArray(domeVAO); gl.uniformMatrix4fv(L3.mvp,false,(_mvpScratch.set(mvp),_mvpScratch)); gl.uniform1f(L3.grid,_viewerGrid?1:0); gl.uniform1f(L3.flipx,-1); gl.uniform1f(L3.hfade,state.view.hfade?HFADE:0); gl.uniform1f(L3.rimDeg,curCovDeg()); // pop-out viewer: grid off by default, toggled by its own button
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
