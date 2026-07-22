// Dome Studio Pro — Electron main process
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

// --- Prefer the dedicated GPU (NVIDIA RTX) safely, without the Chromium flags that black out the 3D view.
// On Windows we register a per-app "High performance" GPU preference (HKCU, no admin) so the OS hands this
// app the discrete GPU. Harmless if the machine has a single GPU.
function preferHighPerfGPU(){ if(process.platform!=='win32')return; try{ const exe=process.execPath.replace(/"/g,'');
  exec(`reg add "HKCU\\Software\\Microsoft\\DirectX\\UserGpuPreferences" /v "${exe}" /t REG_SZ /d "GpuPreference=2;" /f`, ()=>{}); }catch(e){} }
preferHighPerfGPU();

// --- GPU ---
// Electron enables hardware acceleration by default, which renders WebGL correctly.
// We deliberately do NOT force ignore-gpu-blocklist / zero-copy: forcing those can select a
// non-compositing GPU path on hybrid (Intel+NVIDIA) laptops and render the 3D view BLACK.
// The WebGL context already requests powerPreference:'high-performance'; to pin the RTX,
// set Dome Studio Pro to "High performance" in Windows Graphics settings / NVIDIA Control Panel.
app.commandLine.appendSwitch('enable-accelerated-video-decode'); // safe: faster video decode for playback
// SharedArrayBuffer for the NDI input zero-copy path (page ⇄ preload share one buffer; contextBridge
// otherwise structured-CLONES every 4K frame = 33MB/frame). Feature flag only — NOT a GPU flag (safe on hybrid GPUs).
app.commandLine.appendSwitch('enable-features', 'SharedArrayBuffer');
// [R92-T3 C7] Windows marks fully-covered windows as "occluded" and Chromium stops issuing frames (rAF drops
// to ~1/s) even with backgroundThrottling:false — measured live. That kills NDI output to the dome the moment
// the window is covered during a show. Disabling the occlusion CALCULATION is a scheduling feature, not a GPU
// flag (safe on hybrid GPUs — verified: 3D view still renders).
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

let win;
let forceClose = false; // set true by the renderer's styled "close without saving" confirm
// --- double-click .rdome → open it. The path arrives as a CLI arg (Windows) or via 'open-file' (macOS). ---
let pendingOpenPath = null;
function rdomeFromArgv(argv){ try{ for(const a of (argv||[]).slice(1)){ if(a && /\.(isp|ise|rdome)$/i.test(a) && fs.existsSync(a)) return a; } }catch(e){} return null; } // .isp (Immersive Studio Pro) + legacy .ise/.rdome
pendingOpenPath = rdomeFromArgv(process.argv);

// --- UI state reported from renderer (for localized dialogs + unsaved-changes guard) ---
let uiDirty = false, uiLang = 'en';
const tt = (en, es) => (uiLang === 'es' ? es : en);

function createWindow() {
  win = new BrowserWindow({
    width: 1600,
    height: 980,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0E0F11',
    title: 'Immersive Studio Pro',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,            // allow preload to use fs/webUtils
      webgl: true,
      backgroundThrottling: false // keep rendering at full speed when not focused
    }
  });
  win.removeMenu();

  // Pop-out viewer window (window.open('domeViewer')): allow it as a native, movable/resizable, menu-less black window
  win.webContents.setWindowOpenHandler(({ frameName }) => {
    if (frameName === 'domeViewer') {
      return { action: 'allow', overrideBrowserWindowOptions: {
        width: 960, height: 960, minWidth: 240, minHeight: 240,
        backgroundColor: '#000000', title: 'Immersive Studio Pro — Viewer',
        autoHideMenuBar: true,
        webPreferences: { backgroundThrottling: false }
      } };
    }
    return { action: 'deny' };
  });

  // --- Unsaved-changes guard: ask the renderer to show a STYLED confirm (matches the app), not a native OS dialog.
  // LIFELINE: a crashed or hung renderer never takes the session down. Reload → fresh editor; the disk
  // autosave (every 15s) + the reopen-recovery offer restore the work (≤15s lost).
  win.webContents.on('render-process-gone', (e, details) => {
    if (!details || details.reason === 'clean-exit' || details.reason === 'killed') return;
    dialog.showMessageBox({ type: 'warning', message: tt('The editor crashed ('+details.reason+') and will reload now. Your work is protected by the disk autosave (max ~15s lost): reopen your project and accept "Restore autosave".', 'El editor se cayó ('+details.reason+') y se recargará ahora. Tu trabajo está protegido por el autoguardado en disco (máx. ~15s perdidos): reabre tu proyecto y acepta "Restaurar autoguardado".') })
      .then(() => { try { win.webContents.reload(); } catch (err) {} });
  });
  win.on('unresponsive', () => {
    dialog.showMessageBox(win, { type: 'warning', buttons: [tt('Keep waiting', 'Seguir esperando'), tt('Reload editor', 'Recargar editor')], defaultId: 0,
      message: tt('The editor is not responding. If it stays frozen, reload — the disk autosave protects your work.', 'El editor no responde. Si sigue congelado, recarga — el autoguardado en disco protege tu trabajo.') })
      .then(r => { if (r && r.response === 1) { try { win.webContents.reload(); } catch (err) {} } });
  });
  win.on('close', (e) => {
    if (forceClose || !uiDirty) return;
    e.preventDefault();
    try { win.webContents.send('dsp:confirmClose'); } catch (_) { forceClose = true; win.close(); }
  });

  win.loadFile('index.html');
  win.once('ready-to-show', () => win.show());
  // hand a double-clicked .rdome to the renderer once the UI is ready
  win.webContents.on('did-finish-load', () => { if (pendingOpenPath) { win.webContents.send('dsp:openPath', pendingOpenPath); pendingOpenPath = null; } });
}

// single instance: a second double-clicked .rdome reuses this window instead of spawning a new app
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); }
else {
  app.on('second-instance', (e, argv) => { const p = rdomeFromArgv(argv); if (win) { if (win.isMinimized()) win.restore(); win.focus(); if (p) win.webContents.send('dsp:openPath', p); } });
  app.on('open-file', (e, p) => { e.preventDefault(); if (win && win.webContents) win.webContents.send('dsp:openPath', p); else pendingOpenPath = p; }); // macOS
  app.whenReady().then(createWindow);
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
}

// --- IPC: UI state report (dirty flag + language) ---
ipcMain.handle('dsp:setUiState', (e, s) => { if (s) { uiDirty = !!s.dirty; if (s.lang === 'en' || s.lang === 'es') uiLang = s.lang; } return true; });

// --- IPC: file dialogs + filesystem for project save/open with no data loss ---
ipcMain.handle('dsp:saveDialog', async (e, defaultPath) => {
  const r = await dialog.showSaveDialog(win, {
    title: tt('Save project', 'Guardar proyecto'),
    defaultPath: defaultPath || 'proyecto.isp',
    filters: [{ name: tt('Immersive Studio project', 'Proyecto Immersive Studio'), extensions: ['isp', 'ise', 'rdome'] }]
  });
  return r.canceled ? null : r.filePath;
});
ipcMain.handle('dsp:saveFile', async (e, defaultPath, ext, label) => {
  const r = await dialog.showSaveDialog(win, {
    title: tt('Export', 'Exportar'),
    defaultPath: defaultPath || 'export',
    filters: ext ? [{ name: label || String(ext).toUpperCase(), extensions: [ext] }] : undefined
  });
  return r.canceled ? null : r.filePath;
});

ipcMain.handle('dsp:openDialog', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: tt('Open project', 'Abrir proyecto'),
    properties: ['openFile'],
    filters: [{ name: tt('Immersive Studio project', 'Proyecto Immersive Studio'), extensions: ['isp', 'ise', 'rdome', 'json'] }]
  });
  return (r.canceled || !r.filePaths.length) ? null : r.filePaths[0];
});

ipcMain.handle('dsp:pickMedia', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: tt('Locate media', 'Localizar medio'),
    properties: ['openFile'],
    filters: [{ name: tt('Media', 'Medios'), extensions: ['mp4','mov','webm','mkv','png','jpg','jpeg','gif','wav','mp3','aac','m4a','ogg'] }]
  });
  return (r.canceled || !r.filePaths.length) ? null : r.filePaths[0];
});

ipcMain.handle('dsp:chooseExportDir', async () => {
  const r = await dialog.showOpenDialog(win, { title: uiLang === 'es' ? 'Carpeta de exportación' : 'Export folder', properties: ['openDirectory', 'createDirectory'] });
  return (r.canceled || !r.filePaths.length) ? null : r.filePaths[0];
});
ipcMain.handle('dsp:pickFile', async (e, opts) => { // generic open picker with custom filters (e.g. .cube LUTs)
  const o = opts || {};
  const r = await dialog.showOpenDialog(win, {
    title: o.title || (uiLang === 'es' ? 'Abrir archivo' : 'Open file'),
    properties: ['openFile'],
    filters: o.extensions ? [{ name: o.name || 'File', extensions: o.extensions }] : undefined
  });
  return (r.canceled || !r.filePaths.length) ? null : r.filePaths[0];
});
ipcMain.handle('dsp:writeBinary', async (e, filePath, data) => {
  try { await fsp.writeFile(filePath, Buffer.from(data)); return true; } catch (err) { return false; }
});
ipcMain.handle('dsp:ensureDir', async (e, dirPath) => {
  try { await fsp.mkdir(dirPath, { recursive: true }); return true; } catch (err) { return false; }
});

// random-access file streaming (MP4 export writes chunks straight to disk — no multi-GB RAM buffer)
const _fds = new Map(); let _fdSeq = 1;
ipcMain.handle('dsp:proxyDir', async () => { try { const d = path.join(app.getPath('userData'), 'proxies'); await fsp.mkdir(d, { recursive: true }); return d; } catch (err) { return null; } }); // persistent proxy cache dir (survives sessions/projects)
ipcMain.handle('dsp:revealPath', async (e, p) => { try { if (!p) return false; const st = await fsp.stat(p).catch(() => null); if (st && st.isDirectory()) { await shell.openPath(p); } else { shell.showItemInFolder(p); } return true; } catch (err) { return false; } }); // reveal an exported file / folder in the OS file manager
ipcMain.handle('dsp:autosaveDir', async () => { try { const d = path.join(app.getPath('userData'), 'autosave'); await fsp.mkdir(d, { recursive: true }); return d; } catch (err) { return null; } }); // disk autosave for not-yet-saved projects
ipcMain.handle('dsp:fileOpen', async (e, p) => { try { const fh = await fsp.open(p, 'w'); const id = _fdSeq++; _fds.set(id, fh); return id; } catch (err) { return null; } });
ipcMain.handle('dsp:fileWriteAt', async (e, id, position, data) => { try { const fh = _fds.get(id); if (!fh) return false; const buf = Buffer.from(data.buffer || data, data.byteOffset || 0, data.byteLength != null ? data.byteLength : data.length); await fh.write(buf, 0, buf.length, position); return true; } catch (err) { return false; } });
ipcMain.handle('dsp:fileClose', async (e, id) => { try { const fh = _fds.get(id); if (fh) { await fh.close(); _fds.delete(id); } return true; } catch (err) { return false; } });
/* [R108·E1] Binary range reads for the WebCodecs decode path — read the moov + individual samples out of a huge
   (12GB+) source on demand, without pulling the whole file into RAM. Persistent read fd (reused across sample reads). */
ipcMain.handle('dsp:openRead', async (e, p) => { try { const fh = await fsp.open(p, 'r'); const id = _fdSeq++; _fds.set(id, fh); return id; } catch (err) { return null; } });
ipcMain.handle('dsp:readAt', async (e, id, position, length) => { try { const fh = _fds.get(id); if (!fh || length <= 0 || length > 268435456) return null; const buf = Buffer.alloc(length); const { bytesRead } = await fh.read(buf, 0, length, position); return bytesRead === length ? buf : buf.subarray(0, bytesRead); } catch (err) { return null; } }); // Buffer.alloc (NOT allocUnsafe) → dedicated ArrayBuffer of exact size: allocUnsafe is pool-backed and IPC would ship the whole shared pool (leaking adjacent memory). Short read at EOF returns the partial slice.
ipcMain.handle('dsp:closeRead', async (e, id) => { try { const fh = _fds.get(id); if (fh) { await fh.close(); _fds.delete(id); } return true; } catch (err) { return false; } });
// diagnostics session log — appended to userData so it survives even a crash; read it back after a test session
const DIAG_LOG = path.join(app.getPath('userData'), 'dome-diagnostics.log');
ipcMain.handle('dsp:diagWrite', async (e, text, reset) => { try { if (reset) await fsp.writeFile(DIAG_LOG, text, 'utf8'); else await fsp.appendFile(DIAG_LOG, text, 'utf8'); return DIAG_LOG; } catch (err) { return null; } });
ipcMain.handle('dsp:diagPath', async () => DIAG_LOG);
ipcMain.handle('dsp:readText', async (e, p) => { try { return await fsp.readFile(p, 'utf8'); } catch (err) { return null; } });
/* [R96] ATOMIC write: temp file in the SAME folder → fsync → rename over the target. rename() is atomic on the volume, so a
   crash, a power cut or a cloud client (Drive/Dropbox/OneDrive) syncing mid-write can never leave a truncated .isp — the
   documented way Premiere projects die. Readers see either the old file or the new one, never a half-written one. */
ipcMain.handle('dsp:writeText', async (e, p, txt) => {
  const tmp = p + '.tmp-' + process.pid + '-' + Date.now();
  let fh = null;
  try {
    fh = await fsp.open(tmp, 'w');
    await fh.writeFile(txt, 'utf8');
    await fh.sync();            // force to disk before the rename — otherwise the rename can land while the data is still buffered
    await fh.close(); fh = null;
    await fsp.rename(tmp, p);   // atomic swap
    return true;
  } catch (err) {
    try { if (fh) await fh.close(); } catch (_) {}
    try { await fsp.unlink(tmp); } catch (_) {}                          // never leave .tmp litter next to the user's project
    try { await fsp.writeFile(p, txt, 'utf8'); return true; } catch (_) { return false; } // last resort (e.g. rename across a weird mount): the old direct write
  }
});
ipcMain.handle('dsp:stat', async (e, p) => { try { const s = await fsp.stat(p); return { size: s.size, mtimeMs: s.mtimeMs }; } catch (err) { return null; } });
ipcMain.handle('dsp:listDir', async (e, dir) => { try { const names = await fsp.readdir(dir); const out = []; for (const n of names) { try { const s = await fsp.stat(path.join(dir, n)); if (s.isFile()) out.push({ name: n, mtimeMs: s.mtimeMs, size: s.size }); } catch (_) {} } return out; } catch (err) { return []; } }); // list files (name+mtime+size) for the autosave history
ipcMain.handle('dsp:deleteFile', async (e, p) => { try { await fsp.unlink(p); return true; } catch (err) { return false; } }); // prune old autosave-history snapshots
ipcMain.handle('dsp:rename', async (e, from, to) => { try { await fsp.rename(from, to); return true; } catch (err) { try { await fsp.copyFile(from, to); await fsp.unlink(from); return true; } catch (_) { return false; } } }); // atomic proxy publish: encode to <name>.part, rename over the final name only on success → an interrupted encode never leaves a moov-less (corrupt) proxy at the real name
ipcMain.handle('dsp:exists', async (e, p) => { try { return fs.existsSync(p); } catch (err) { return false; } });
ipcMain.handle('dsp:setTitle', (e, t) => { if (win) win.setTitle(t); });
ipcMain.handle('dsp:setProgress', (e, v) => { try { if (win) win.setProgressBar(typeof v === 'number' && v >= 0 ? Math.min(1, v) : -1); } catch (err) {} }); // [R92-T5] taskbar progress for exports
ipcMain.handle('dsp:forceClose', () => { forceClose = true; if (win) win.close(); return true; }); // renderer confirmed "close without saving"

// --- live performance meters (CPU / RAM / GPU). GPU via nvidia-smi (cached); silently null on non-NVIDIA or if not on PATH. ---
const _gpu = { util: null, memUsed: null, memTotal: null, t: 0 }; let _nvBusy = false, _nvOff = false;
function queryGPU() {
  if (_nvBusy || _nvOff) return; const now = Date.now(); if (now - _gpu.t < 1200) return; _nvBusy = true;
  exec('nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total --format=csv,noheader,nounits', { timeout: 2500, windowsHide: true }, (err, stdout) => {
    _nvBusy = false; _gpu.t = Date.now();
    if (err) { if (err.code === 'ENOENT') _nvOff = true; _gpu.util = null; return; } // no NVIDIA tool → stop trying
    try { const p = String(stdout).trim().split('\n')[0].split(',').map(s => parseFloat(s.trim())); if (p.length >= 3 && !isNaN(p[0])) { _gpu.util = p[0]; _gpu.memUsed = p[1]; _gpu.memTotal = p[2]; } } catch (e) {}
  });
}
ipcMain.handle('dsp:metrics', () => {
  let cpu = 0, ram = 0; try { const ms = app.getAppMetrics(); for (const m of ms) { if (m.cpu && typeof m.cpu.percentCPUUsage === 'number') cpu += m.cpu.percentCPUUsage; if (m.memory && m.memory.workingSetSize) ram += m.memory.workingSetSize; } } catch (e) {}
  const cores = (os.cpus() || []).length || 1; queryGPU();
  return { cpu: Math.max(0, Math.min(100, Math.round(cpu / cores))), ramMB: Math.round(ram / 1024), sysTotalMB: Math.round(os.totalmem() / 1048576), gpuUtil: _gpu.util, gpuMemUsed: _gpu.memUsed, gpuMemTotal: _gpu.memTotal };
});
