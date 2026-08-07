// Dome Studio Pro — secure preload bridge (contextIsolation ON)
const { contextBridge, ipcRenderer, webUtils } = require('electron');
const path = require('path');

// --- NDI® output (native addon; loaded here in the preload, which has Node access). The dome master
// frames are sent straight from the renderer's WebGL readback → no per-frame IPC to the main process. ---
let _ndi = null; try { _ndi = require('dsp-ndi-send'); } catch (e) { _ndi = null; }
const ndiApi = {
  available: () => { try { return !!(_ndi && _ndi.available()); } catch (e) { return false; } },
  runtimeUrl: () => { try { return (_ndi && _ndi.runtimeUrl && _ndi.runtimeUrl()) || 'http://ndi.link/NDIRedistV6'; } catch (e) { return 'http://ndi.link/NDIRedistV6'; } },
  loadError: () => { try { return _ndi && _ndi._loadError || null; } catch (e) { return String(e); } },
  start: (name, frN, frD) => { try { return !!(_ndi && _ndi.start(String(name || 'Dome Studio Pro'), frN | 0, frD | 0)); } catch (e) { return false; } },
  // frame: a Uint8Array of RGBA bytes (w*h*4). Wrapped as a Node Buffer (no copy) and handed to the addon.
  send: (u8, w, h, flipY) => { try { if (!_ndi) return false; const b = Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength); return !!_ndi.sendFrame(b, w | 0, h | 0, !!flipY); } catch (e) { return false; } },
  connections: () => { try { return (_ndi && _ndi.connections()) | 0; } catch (e) { return 0; } },
  stop: () => { try { if (_ndi) _ndi.stop(); } catch (e) {} },
  probe: (sub, timeout) => { try { return _ndi ? _ndi.probe(String(sub || ''), timeout | 0) : null; } catch (e) { return null; } },
  // --- NDI input (receive) ---
  findSources: (timeout) => { try { return _ndi ? _ndi.findSources(timeout | 0) : []; } catch (e) { return []; } },
  recvOpen: (name) => { try { return !!(_ndi && _ndi.recvOpen(String(name || ''))); } catch (e) { return false; } },
  // recvRead(name, lastGen, dst?) -> {w,h,gen,copied:true} | {w,h,gen,data:Uint8Array} | null
  // null = no frame newer than lastGen (cheap poll). dst: a SharedArrayBuffer-backed Uint8Array from the
  // page — SABs cross the contextBridge SHARED (structured clone), so the addon memcpys the frame straight
  // into the page's memory: zero per-frame clones. Fallback (no/small dst): fresh Buffer as before.
  recvRead: (name, lastGen, dst) => { try { if (!_ndi) return null;
    // only forward dst if it arrived truly SHARED — if the bridge ever hands us a plain clone instead,
    // the addon would fill the clone and the page would show black frames. Clone → fall back to data mode.
    if (dst && !(dst.buffer instanceof SharedArrayBuffer)) dst = undefined;
    const r = _ndi.recvRead(String(name || ''), +lastGen || 0, dst || undefined); if (!r) return null;
    if (r.copied) return { w: r.w, h: r.h, gen: r.gen, copied: true };
    if (!r.data) return null;
    return { w: r.w, h: r.h, gen: r.gen, data: new Uint8Array(r.data.buffer, r.data.byteOffset, r.data.byteLength) }; } catch (e) { return null; } },
  recvClose: (name) => { try { if (_ndi) _ndi.recvClose(String(name || '')); } catch (e) {} },
  recvCloseAll: () => { try { if (_ndi) _ndi.recvCloseAll(); } catch (e) {} }
};

// --- Spout output (native addon, DirectX). Same idea as NDI but shares the dome master as a LOCAL GPU texture
// (Resolume / TouchDesigner / OBS on the same machine receive it zero-copy) instead of over the network.
let _spout = null; try { _spout = require('dsp-spout-send'); } catch (e) { _spout = null; }
const spoutApi = {
  available: () => { try { return !!(_spout && _spout.available()); } catch (e) { return false; } },
  loadError: () => { try { return (_spout && _spout._loadError) || null; } catch (e) { return String(e); } },
  start: (name) => { try { return !!(_spout && _spout.start(String(name || 'Immersive Studio Pro'))); } catch (e) { return false; } },
  send: (u8, w, h, flipY) => { try { if (!_spout) return false; const b = Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength); return !!_spout.send(b, w | 0, h | 0, !!flipY); } catch (e) { return false; } },
  stop: () => { try { if (_spout) _spout.stop(); } catch (e) {} },
  // --- [V3] Spout input (receive) — instancia aparte de la del emisor, así que emitir y recibir a la vez es válido.
  // Sin el truco del SharedArrayBuffer que usa NDI: Spout ya es local y el receptor entrega un Buffer que sólo
  // cruza el puente cuando HAY fotograma nuevo (`nuevo`), no en cada sondeo.
  inList: () => { try { return (_spout && _spout.inList()) || []; } catch (e) { return []; } },
  inOpen: (name) => { try { return !!(_spout && _spout.inOpen(String(name || ''))); } catch (e) { return false; } },
  inFrame: (flipY) => { try { if (!_spout) return null; const f = _spout.inFrame(!!flipY); if (!f) return null;
    return { w: f.w, h: f.h, nuevo: !!f.nuevo, nombre: f.nombre || '',
      data: f.data ? new Uint8Array(f.data.buffer, f.data.byteOffset, f.data.byteLength) : null }; } catch (e) { return null; } },
  inClose: () => { try { if (_spout) _spout.inClose(); } catch (e) {} }
};

contextBridge.exposeInMainWorld('dsp', {
  isElectron: true,
  // Absolute path of a dropped/picked File (Electron >= 32 way; replaces the removed File.path)
  getPathForFile: (file) => { try { return webUtils.getPathForFile(file); } catch (e) { return (file && file.path) || null; } },
  // Project file dialogs + IO
  saveDialog: (defaultPath) => ipcRenderer.invoke('dsp:saveDialog', defaultPath),
  saveFile: (defaultPath, ext, label) => ipcRenderer.invoke('dsp:saveFile', defaultPath, ext, label),
  openDialog: () => ipcRenderer.invoke('dsp:openDialog'),
  pickFile: (opts) => ipcRenderer.invoke('dsp:pickFile', opts),
  pickMedia: () => ipcRenderer.invoke('dsp:pickMedia'),
  chooseExportDir: () => ipcRenderer.invoke('dsp:chooseExportDir'),
  writeBinary: (filePath, data) => ipcRenderer.invoke('dsp:writeBinary', filePath, data),
  diagWrite: (text, reset) => ipcRenderer.invoke('dsp:diagWrite', text, reset),
  diagPath: () => ipcRenderer.invoke('dsp:diagPath'),
  proxyDir: () => ipcRenderer.invoke('dsp:proxyDir'),
  autosaveDir: () => ipcRenderer.invoke('dsp:autosaveDir'),
  revealPath: (p) => ipcRenderer.invoke('dsp:revealPath', p),
  openExternal: (u) => ipcRenderer.invoke('dsp:openExternal', u), // [R242·Aud-4.1] navegador del sistema (allowlist en main) — window.open('_blank') está denegado a propósito

  listDir: (dir) => ipcRenderer.invoke('dsp:listDir', dir),
  listSubdirs: (dir) => ipcRenderer.invoke('dsp:listSubdirs', dir), // [R204] reenlace de medios junto al proyecto
  // [R206] menú Edición de macOS → la página decide según el foco; `nativeEdit` hace lo que harían los papeles
  onEdit: (cb) => ipcRenderer.on('dsp:edit', (e, id) => { try { cb(id); } catch (_) {} }),
  nativeEdit: (id) => ipcRenderer.invoke('dsp:nativeEdit', id),
  // [R204] Separador de rutas del sistema. El renderer arma rutas a mano (proxies, autoguardado, render en el
  // sitio) y las tenía con `\` escrita a mano: en macOS eso no falla, crea archivos con una barra invertida DENTRO
  // del nombre y un nivel por encima de donde tocaba. Partir rutas ya valía en los dos (se busca `\` y `/`); lo
  // que había que arreglar era UNIRLAS.
  sep: path.sep,
  deleteFile: (p) => ipcRenderer.invoke('dsp:deleteFile', p),
  rename: (from, to) => ipcRenderer.invoke('dsp:rename', from, to),
  // [R175] síncrono a propósito: se consulta UNA vez al arrancar, antes de que nada decida revelar el editor
  bootProject: () => { try { return ipcRenderer.sendSync('dsp:bootProject'); } catch (e) { return null; } },
  onOpenPath: (cb) => ipcRenderer.on('dsp:openPath', (e, p) => { try { cb(p); } catch (_) {} }),
  onConfirmClose: (cb) => ipcRenderer.on('dsp:confirmClose', () => { try { cb(); } catch (_) {} }),
  forceClose: () => ipcRenderer.invoke('dsp:forceClose'),
  metrics: () => ipcRenderer.invoke('dsp:metrics'),
  fileOpen: (p) => ipcRenderer.invoke('dsp:fileOpen', p),
  fileWriteAt: (id, position, data) => ipcRenderer.invoke('dsp:fileWriteAt', id, position, data),
  fileClose: (id) => ipcRenderer.invoke('dsp:fileClose', id),
  /* [R288] Puente a FFmpeg. `ffWrite` DEVUELVE UNA PROMESA que no resuelve hasta que el codificador ha tragado
     el fotograma: esa espera es la contrapresion, y es lo que impide que el renderer acumule fotogramas de
     64 MB en RAM mientras FFmpeg va por detras. Hay que esperarla, no dispararla y seguir. */
  ffProbe: () => ipcRenderer.invoke('dsp:ffProbe'),
  ffStart: (args, outPath) => ipcRenderer.invoke('dsp:ffStart', args, outPath),
  ffWrite: (id, data) => ipcRenderer.invoke('dsp:ffWrite', id, data),
  ffEnd: (id) => ipcRenderer.invoke('dsp:ffEnd', id),
  ffKill: (id) => ipcRenderer.invoke('dsp:ffKill', id),
  openRead: (p) => ipcRenderer.invoke('dsp:openRead', p),
  readAt: (id, position, length) => ipcRenderer.invoke('dsp:readAt', id, position, length),
  closeRead: (id) => ipcRenderer.invoke('dsp:closeRead', id),
  ensureDir: (dirPath) => ipcRenderer.invoke('dsp:ensureDir', dirPath),
  readText: (p) => ipcRenderer.invoke('dsp:readText', p),
  writeText: (p, txt) => ipcRenderer.invoke('dsp:writeText', p, txt),
  stat: (p) => ipcRenderer.invoke('dsp:stat', p),
  exists: (p) => ipcRenderer.invoke('dsp:exists', p),
  setTitle: (t) => ipcRenderer.invoke('dsp:setTitle', t),
  setProgress: (v) => ipcRenderer.invoke('dsp:setProgress', v), // [R92-T5] Windows taskbar progress during exports (-1 clears)
  // [AUDITORIA-2026-07 §Etapa1-3] evitar que el SO suspenda la app durante un export largo o una emisión NDI/Spout.
  // Contado por referencias del lado de main (export y NDI pueden solaparse) — acá sólo se pasa el on/off.
  powerSave: (on) => ipcRenderer.invoke('dsp:powerSave', !!on),
  // UI state report (dirty flag + language) for the unsaved-changes close guard
  setUiState: (s) => ipcRenderer.invoke('dsp:setUiState', s),
  // Arranque: hitos reales hacia el splash (ventana aparte) y aviso de "listo" que revela la ventana 16:9
  bootProgress: (pct, text) => ipcRenderer.invoke('dsp:bootProgress', pct, text),
  bootReady: () => ipcRenderer.invoke('dsp:bootReady'),
  ndi: ndiApi,
  spout: spoutApi,
  // Helpers
  basename: (p) => { try { return path.basename(p); } catch (e) { return p; } },
  toFileURL: (p) => {
    try {
      let u = p.replace(/\\/g, '/');
      if (!u.startsWith('/')) u = '/' + u;
      return 'file://' + encodeURI(u).replace(/#/g, '%23').replace(/\?/g, '%3F');
    } catch (e) { return p; }
  }
});
