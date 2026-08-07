// Dome Studio Pro — Electron main process
const { app, BrowserWindow, ipcMain, dialog, shell, powerSaveBlocker } = require('electron');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

// --- Prefer the dedicated GPU (NVIDIA RTX) safely, without the Chromium flags that black out the 3D view.
// On Windows we register a per-app "High performance" GPU preference (HKCU, no admin) so the OS hands this
// app the discrete GPU. Harmless if the machine has a single GPU.
/* [R206] MENÚ DE macOS — el único obstáculo para que Cmd haga lo mismo que Ctrl.
   `win.removeMenu()` vale en Windows pero en macOS no hace nada: allí el menú es de la APLICACIÓN, así que
   Electron instala el suyo por defecto y sus atajos se atienden ANTES de que la tecla llegue a la página.
   Eso traía tres choques: **Cmd+R = Recargar**, que en un programa que guarda el proyecto en memoria significa
   perder el trabajo sin guardar; Cmd+Z/X/C/V/A capturados por los papeles del menú Edición, que sólo actúan
   sobre campos de texto y dejarían muertos el deshacer y el copiar/pegar de clips; y Cmd+0/± haciendo zoom de
   toda la interfaz.
   Solución: un menú propio SIN el menú Ver —no hay nada que recargar ni que ampliar— con Aplicación y Ventana
   estándar (Cmd+Q, Cmd+M, Cmd+W, como espera un Mac) y un menú Edición cuyas entradas NO usan los papeles del
   sistema: reenvían la orden a la página, que decide según dónde esté el foco. Así no se cambia ni un atajo
   respecto a Windows y no se pierde ninguno. */
function menuMac(win){ if(process.platform!=='darwin')return;
  const { Menu } = require('electron');
  const ed=(id,label,acc)=>({ label, accelerator:acc, click:()=>{ try{ if(win&&!win.isDestroyed())win.webContents.send('dsp:edit',id); }catch(_){} } });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { role: 'appMenu' },                       // Acerca de · Ocultar · Salir (Cmd+Q)
    { label: 'Edit', submenu: [
      ed('undo','Undo','CommandOrControl+Z'),
      ed('redo','Redo','Shift+CommandOrControl+Z'),
      { type: 'separator' },
      ed('cut','Cut','CommandOrControl+X'),
      ed('copy','Copy','CommandOrControl+C'),
      ed('paste','Paste','CommandOrControl+V'),
      ed('selectAll','Select All','CommandOrControl+A')
    ]},
    { role: 'windowMenu' }                     // Minimizar · Zoom · Cerrar (el guardián de cambios sin guardar sigue en win.on('close'))
  ]));
}
/* Edición NATIVA (la que harían los papeles del menú) — la pide la página cuando el foco está en un campo de
   texto. `webContents.paste()` es imprescindible: `document.execCommand('paste')` está prohibido en la web. */
ipcMain.handle('dsp:nativeEdit', (e, id) => { try { const wc = e.sender;
  if (['undo','redo','cut','copy','paste','selectAll'].includes(id) && typeof wc[id] === 'function') { wc[id](); return true; } } catch (_) {} return false; });
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
let unresponsiveDialogOpen = false; // [AUDITORIA-2026-07 §Etapa1-4] guardia anti-apilado del diálogo de win.on('unresponsive')

// --- diagnostics log path + tiny SYNC helper, definidos temprano: los handlers de crash del proceso de más
// abajo pueden dispararse antes de que exista ninguna ventana, así que necesitan dónde escribir ya mismo.
// El canal IPC 'dsp:diagWrite' (más abajo) sigue usando su propio fsp.appendFile async para el renderer;
// éste es sólo la red de seguridad del proceso main. ---
const DIAG_LOG = path.join(app.getPath('userData'), 'dome-diagnostics.log');
function diagAppend(text) { try { fs.appendFileSync(DIAG_LOG, text); } catch (_) {} }

/* [AUDITORIA-2026-07 §Etapa1-2] Sin esto, un uncaughtException/unhandledRejection en el proceso MAIN (no el
   renderer) tira abajo TODO Electron sin aviso — a mitad de un export o de una sesión NDI. Sólo logueamos:
   nunca relanzamos, cerramos la app ni mostramos diálogo propio (ese terreno ya lo cubre 'render-process-gone'
   para el renderer); un crash real de main es tan raro que preferimos dejarlo seguir vivo antes que arriesgar
   una re-entrada rara de diálogos o un cierre que pierda más trabajo del que evita. */
process.on('uncaughtException', (err) => {
  console.error('[main] uncaughtException:', err);
  diagAppend('\n[main uncaughtException] ' + new Date().toISOString() + ' ' + ((err && err.stack) || err) + '\n');
});
process.on('unhandledRejection', (reason) => {
  console.error('[main] unhandledRejection:', reason);
  diagAppend('\n[main unhandledRejection] ' + new Date().toISOString() + ' ' + ((reason && reason.stack) || reason) + '\n');
});

/* ============================================================================================================
   ARRANQUE EN DOS VENTANAS (rediseño de Claude Design, handoff launcher+splash)
   El splash dejó de ser una capa dentro del editor y pasó a ser una VENTANA PROPIA cuadrada que se muestra
   sola mientras el editor arranca; recién cuando el editor avisa que terminó se abre la ventana principal
   en 16:9 y el splash se desvanece. Así nunca se ve el cromo del editor a medio armar.
   ============================================================================================================ */
let splashWin = null;
let bootDone = false;
let bootTimer = null;
const BOOT_TIMEOUT_MS = 25000; // salvavidas: si el editor nunca avisa (cuelgue), igual mostramos la ventana

function buildLabel() {
  // "1.0.0  ·  Build AAAA-MM-DD" — la versión sale de package.json; la fecha, del mtime del asar/app.js,
  // que es lo más cercano a "cuándo se compiló esto" sin agregar un paso de build (ADR-0001).
  let v = '1.0.0';
  try { v = require('./package.json').version || v; } catch (_) {}
  let d = '';
  try { d = new Date(fs.statSync(path.join(__dirname, 'app.js')).mtimeMs).toISOString().slice(0, 10); } catch (_) {}
  return d ? (v + '  ·  Build ' + d) : v;
}

/* [R209] La pantalla "de lanzamiento": la que tiene el cursor al abrir la app — el clic del Dock, acceso
   directo o Finder ocurre en la pantalla donde está el usuario. Antes splash y principal se centraban en la
   PRIMARIA (`getPrimaryDisplay` + `center:true`), y con un monitor externo cada ventana podía caer en una
   pantalla distinta. Se captura UNA vez para que las dos caigan en la MISMA aunque el cursor se mueva durante
   el arranque. Sólo puede llamarse con la app ready (el módulo `screen` lo exige; createSplash ya cumplía). */
let _launchDisplay = null;
function launchDisplay() {
  if (_launchDisplay) return _launchDisplay;
  const { screen } = require('electron');
  try { _launchDisplay = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()); }
  catch (_) { _launchDisplay = screen.getPrimaryDisplay(); }
  return _launchDisplay;
}
function centerOnLaunch(bw) { // centrar la ventana en el área útil de la pantalla de lanzamiento
  try { const wa = launchDisplay().workArea; const b = bw.getBounds();
    bw.setPosition(Math.round(wa.x + (wa.width - b.width) / 2), Math.round(wa.y + (wa.height - b.height) / 2));
  } catch (_) {}
}

function createSplash() {
  // El diseño es de 1080×1080 fijos. En una pantalla de 1080p esa altura no entra, así que se toma el lado
  // mayor que quepa en el área de trabajo y el HTML escala su lienzo de 1080 a ese tamaño (proporción intacta).
  // SPLASH_SCALE: pedido de Beltrán — la ventana al 70% de lo que daba antes; ocupaba demasiada pantalla.
  // [R176] 0.49 = otro 70% sobre el 0.70 anterior, a petición de Beltrán. El splash es una tarjeta de 1080²
  // escalada por transform, así que la tipografía y todo lo demás encogen en la MISMA proporción: no hay dos
  // diagramaciones que mantener.
  const SPLASH_SCALE = 0.49;
  let side = 1080;
  try {
    const wa = launchDisplay().workArea; // [R209] medir sobre la pantalla de lanzamiento, no la primaria
    side = Math.min(1080, Math.floor(Math.min(wa.width, wa.height) * 0.92));
  } catch (_) {}
  side = Math.max(360, Math.round(side * SPLASH_SCALE));
  splashWin = new BrowserWindow({
    width: side, height: side,
    frame: false, transparent: true, resizable: false, movable: true,
    center: true, show: false, skipTaskbar: false,
    title: 'Immersive Studio Pro',
    webPreferences: { preload: path.join(__dirname, 'splash-preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  splashWin.removeMenu();
  centerOnLaunch(splashWin); // [R209] pisa el `center:true` (que centra en la primaria) ANTES del show
  splashWin.loadFile('splash.html');
  splashWin.once('ready-to-show', () => { if (splashWin && !splashWin.isDestroyed()) splashWin.show(); });
  splashWin.webContents.on('did-finish-load', () => { splashSend('splash:init', { build: buildLabel() }); });
  splashWin.on('closed', () => { splashWin = null; });
}

function splashSend(channel, ...args) {
  try { if (splashWin && !splashWin.isDestroyed()) splashWin.webContents.send(channel, ...args); } catch (_) {}
}

// El editor terminó de arrancar (o se acabó el tiempo): mostrar la ventana principal y despedir al splash.
function finishBoot() {
  if (bootDone) return; bootDone = true;
  if (bootTimer) { clearTimeout(bootTimer); bootTimer = null; }
  splashSend('splash:bye');
  // La principal se muestra PRIMERO y el splash se va encima: si fuese al revés se ve el escritorio en el medio.
  try { if (win && !win.isDestroyed()) { win.show(); win.focus(); } } catch (_) {}
  setTimeout(() => { try { if (splashWin && !splashWin.isDestroyed()) splashWin.close(); } catch (_) {} }, 420);
}
// --- double-click .rdome → open it. The path arrives as a CLI arg (Windows) or via 'open-file' (macOS). ---
let pendingOpenPath = null;
function rdomeFromArgv(argv){ try{ for(const a of (argv||[]).slice(1)){ if(a && /\.(isp|ise|rdome)$/i.test(a) && fs.existsSync(a)) return a; } }catch(e){} return null; } // .isp (Immersive Studio Pro) + legacy .ise/.rdome
pendingOpenPath = rdomeFromArgv(process.argv);
/* [R175] El renderer PREGUNTA si este arranque trae proyecto, en vez de esperar el mensaje `dsp:openPath`.
   Ese mensaje sale en `did-finish-load` y llegaba DESPUÉS de que el editor decidiera revelarse: una carrera
   que perdía, y por eso salían dos pantallas de carga seguidas. Esta copia no se limpia nunca: sólo dice si
   el arranque venía con un archivo. */
const bootProjectPath = pendingOpenPath;
ipcMain.on('dsp:bootProject', (e) => { e.returnValue = bootProjectPath || null; });

// --- UI state reported from renderer (for localized dialogs + unsaved-changes guard) ---
let uiDirty = false, uiLang = 'en';
const tt = (en, es) => (uiLang === 'es' ? es : en);

// Tamaño inicial 16:9 que entre en el área de trabajo (pedido de Beltrán: "abre la app en 16/9").
// Es sólo el tamaño de ARRANQUE — la ventana sigue siendo redimensionable a lo que el usuario quiera.
function initialSize169() {
  let W = 1600, H = 900;
  try {
    const wa = launchDisplay().workArea; // [R209] misma pantalla que el splash
    W = Math.min(1600, wa.width - 80);
    H = Math.round(W * 9 / 16);
    if (H > wa.height - 80) { H = wa.height - 80; W = Math.round(H * 16 / 9); }
    W = Math.max(1100, W); H = Math.max(619, H);
  } catch (_) {}
  return { width: W, height: H };
}

function createWindow() {
  const sz = initialSize169();
  win = new BrowserWindow({
    width: sz.width,
    height: sz.height,
    useContentSize: true, // el 16:9 se mide sobre el ÁREA ÚTIL, no sobre el marco: es lo que se ve, no lo que decora
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
  win.removeMenu(); // Windows/Linux: quita la barra de menú de la ventana. En macOS NO hace nada (el menú es de la APP) → menuMac()
  menuMac(win);
  centerOnLaunch(win); // [R209] la principal se muestra recién en finishBoot(), pero su posición queda fijada ya, en la MISMA pantalla que el splash

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
    // [AUDITORIA-2026-07 §Etapa1-1] cualquier FileHandle abierto en _fds (export a MP4 en curso, lectura de un
    // origen pesado) queda HUÉRFANO si el renderer muere: en Windows un handle sin cerrar deja el archivo
    // BLOQUEADO (no se puede reabrir/borrar/mover) hasta matar el proceso main entero. Se cierra ANTES del
    // `return` de abajo — hasta un 'clean-exit'/'killed' puede caer a mitad de un export, y cerrar handles
    // que ya no tienen dueño no tiene downside.
    for (const [, fh] of _fds) { try { fh.close(); } catch (_) {} }
    _fds.clear();
    if (!details || details.reason === 'clean-exit' || details.reason === 'killed') return;
    dialog.showMessageBox({ type: 'warning', message: tt('The editor crashed ('+details.reason+') and will reload now. Your work is protected by the disk autosave (max ~15s lost): reopen your project and accept "Restore autosave".', 'El editor se cayó ('+details.reason+') y se recargará ahora. Tu trabajo está protegido por el autoguardado en disco (máx. ~15s perdidos): reabre tu proyecto y acepta "Restaurar autoguardado".') })
      .then(() => { try { win.webContents.reload(); } catch (err) {} });
  });
  win.on('unresponsive', () => {
    // [AUDITORIA-2026-07 §Etapa1-4] anti-apilado: Electron puede disparar 'unresponsive' varias veces seguidas
    // mientras la ventana sigue congelada; sin esta guardia cada disparo abría OTRO showMessageBox encima del anterior.
    if (unresponsiveDialogOpen) return;
    unresponsiveDialogOpen = true;
    dialog.showMessageBox(win, { type: 'warning', buttons: [tt('Keep waiting', 'Seguir esperando'), tt('Reload editor', 'Recargar editor')], defaultId: 0,
      message: tt('The editor is not responding. If it stays frozen, reload — the disk autosave protects your work.', 'El editor no responde. Si sigue congelado, recarga — el autoguardado en disco protege tu trabajo.') })
      .then(r => { unresponsiveDialogOpen = false; if (r && r.response === 1) { try { win.webContents.reload(); } catch (err) {} } });
  });
  win.on('responsive', () => { unresponsiveDialogOpen = false; }); // se recuperó sola: liberar la guardia sin esperar a que se cierre un diálogo que nunca se abrió
  win.on('close', (e) => {
    if (forceClose || !uiDirty) return;
    e.preventDefault();
    try { win.webContents.send('dsp:confirmClose'); } catch (_) { forceClose = true; win.close(); }
  });

  win.loadFile('index.html');
  // NO se muestra al estar lista: la ventana espera a que el editor avise que terminó de arrancar
  // (ipc 'dsp:bootReady'), y mientras tanto el usuario ve el splash. El temporizador es el salvavidas.
  bootTimer = setTimeout(finishBoot, BOOT_TIMEOUT_MS);
  win.webContents.on('render-process-gone', () => finishBoot()); // si el renderer muere durante el arranque, no dejar al usuario sin ventana
  // hand a double-clicked .rdome to the renderer once the UI is ready
  win.webContents.on('did-finish-load', () => { if (pendingOpenPath) { win.webContents.send('dsp:openPath', pendingOpenPath); pendingOpenPath = null; } });
}

// single instance: a second double-clicked .rdome reuses this window instead of spawning a new app
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); }
else {
  app.on('second-instance', (e, argv) => { const p = rdomeFromArgv(argv); if (win && !win.isDestroyed()) { if (win.isMinimized()) win.restore(); win.focus(); if (p && win.webContents && !win.webContents.isDestroyed()) win.webContents.send('dsp:openPath', p); } else if (p) pendingOpenPath = p; }); // [R209] !isDestroyed: un proceso principal que sobrevive a su ventana (o durante el arranque) lanzaba "Object has been destroyed" al reenfocar la ventana muerta
  app.on('open-file', (e, p) => { e.preventDefault(); if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) win.webContents.send('dsp:openPath', p); else pendingOpenPath = p; }); // macOS
  app.whenReady().then(() => { createSplash(); createWindow(); }); // splash cuadrado primero; la ventana 16:9 se revela al terminar el arranque
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
  /* [R242·Aud-4.2] macOS: al reabrir desde el Dock (Cmd+W deja la app viva sin ventana), la ventana nueva nace
     con show:false y sólo la muestra finishBoot()… cuyo guard `bootDone` quedó en true desde el PRIMER arranque:
     la ventana no se mostraba nunca y la app parecía muerta (única salida: Cmd+Q). Se rearma el ciclo de boot
     antes de crear — sin splash (splashWin es null y splashSend/close lo toleran), el bootReady del renderer
     vuelve a ser quien la revela, con el salvavidas de 25 s que arma createWindow(). */
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) { bootDone = false; createWindow(); } });
}

// --- IPC: UI state report (dirty flag + language) ---
ipcMain.handle('dsp:setUiState', (e, s) => { if (s) { uiDirty = !!s.dirty; if (s.lang === 'en' || s.lang === 'es') uiLang = s.lang; } return true; });
// --- arranque: el editor reporta hitos REALES al splash y avisa cuando terminó ---
ipcMain.handle('dsp:bootProgress', (e, pct, text) => { if (!bootDone) splashSend('splash:progress', pct, text); return true; });
ipcMain.handle('dsp:bootReady', () => { finishBoot(); return true; });

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
/* [R242·Aud-4.1] Abrir una URL en el navegador del SISTEMA. El setWindowOpenHandler deniega (bien) todo
   window.open que no sea el visor emergente, así que la página de descarga del runtime NDI llevaba muerta desde
   entonces. Allowlist estricta: sólo http(s) hacia los dominios de NDI — este canal no es un "abrir cualquier
   cosa" genérico, y si mañana hace falta otro dominio se añade aquí a conciencia. */
ipcMain.handle('dsp:openExternal', async (e, u) => {
  try { const url = new URL(String(u || ''));
    const ok = (url.protocol === 'http:' || url.protocol === 'https:') && /(^|\.)ndi\.(video|link)$/i.test(url.hostname);
    if (ok) { await shell.openExternal(url.href); return true; }
  } catch (_) {}
  return false;
});
ipcMain.handle('dsp:revealPath', async (e, p) => { try { if (!p) return false; const st = await fsp.stat(p).catch(() => null); if (st && st.isDirectory()) { await shell.openPath(p); } else { shell.showItemInFolder(p); } return true; } catch (err) { return false; } }); // reveal an exported file / folder in the OS file manager
ipcMain.handle('dsp:autosaveDir', async () => { try { const d = path.join(app.getPath('userData'), 'autosave'); await fsp.mkdir(d, { recursive: true }); return d; } catch (err) { return null; } }); // disk autosave for not-yet-saved projects

/* ═══ [R288] PUENTE A FFmpeg ══════════════════════════════════════════════════════════════════════════════
   El renderer no puede lanzar procesos, asi que el proceso principal hace de puente: encuentra el binario,
   lanza el codificador, le mete los fotogramas por la entrada estandar y devuelve el progreso.

   POR QUE UN PROCESO Y NO UNA BIBLIOTECA: un proceso aparte se puede MATAR. Si el codificador se atasca o el
   usuario cancela, se acaba y ya; enlazado dentro, un cuelgue se lleva la app y el proyecto sin guardar.

   LA CONTRAPRESION ES LO QUE IMPORTA. A 4096x4096 cada fotograma son 64 MB. `stdin.write` devuelve `false`
   cuando el buffer del sistema esta lleno, y si se ignora, Electron acumula fotogramas en RAM hasta reventar:
   30 fotogramas de retraso son 2 GB. Aqui se ESPERA al 'drain' antes de aceptar el siguiente, asi que el
   renderer avanza al ritmo que el codificador traga y la memoria se queda plana. */
const _ff = new Map(); let _ffSeq = 1;

/* El binario: primero el que viaje con la app (cuando se empaquete), luego el del sistema. Se prueba
   ejecutandolo, no mirando si el archivo existe: un binario para otra arquitectura existe igual y falla luego. */
function _ffCandidatos() {
  const exe = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  const out = [];
  try { out.push(path.join(process.resourcesPath || '', 'ffmpeg', exe)); } catch (e) {}
  try { out.push(path.join(__dirname, 'vendor', 'ffmpeg', exe)); } catch (e) {}
  out.push(exe);                                  // el del PATH
  if (process.platform !== 'win32') { out.push('/opt/homebrew/bin/ffmpeg'); out.push('/usr/local/bin/ffmpeg'); }
  return out;
}
let _ffPath = null;
function _ffBuscar() {
  if (_ffPath) return _ffPath;
  for (const c of _ffCandidatos()) {
    try {
      const r = require('child_process').spawnSync(c, ['-hide_banner', '-version'], { timeout: 8000 });
      if (r.status === 0) { _ffPath = c; return c; }
    } catch (e) {}
  }
  return null;
}
ipcMain.handle('dsp:ffProbe', async () => {
  const bin = _ffBuscar(); if (!bin) return null;
  try {
    const r = require('child_process').spawnSync(bin, ['-hide_banner', '-encoders'], { timeout: 15000, maxBuffer: 8 << 20 });
    const txt = String(r.stdout || '');
    /* Se declara lo que ESTE binario dice tener. Que ademas acepte el tamano pedido se comprueba aparte,
       codificando de verdad: un encoder listado puede negarse a 4096 y solo se sabe intentandolo. */
    const tiene = n => new RegExp('^\\s*V\\S*\\s+' + n + '\\b', 'm').test(txt);
    return { path: bin,
      h264: ['h264_nvenc', 'h264_videotoolbox', 'h264_amf', 'h264_qsv', 'libx264'].filter(tiene),
      hevc: ['hevc_nvenc', 'hevc_videotoolbox', 'hevc_amf', 'hevc_qsv', 'libx265'].filter(tiene) };
  } catch (e) { return null; }
});
/* Lanza el codificador. `args` los arma el renderer, que es quien sabe de codecs y calidad; aqui solo se
   comprueba que la salida sea una ruta y que el binario exista. */
ipcMain.handle('dsp:ffStart', async (e, args, outPath) => {
  const bin = _ffBuscar(); if (!bin) return { id: null, err: 'ffmpeg no encontrado' };
  if (!outPath || typeof outPath !== 'string') return { id: null, err: 'destino no valido' };
  try {
    const ch = require('child_process').spawn(bin, args, { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] });
    const id = _ffSeq++;
    const st = { ch, err: '', fin: null, code: null, drenando: null };
    /* stderr es donde FFmpeg cuenta lo que hace. Se guarda SOLO el final: un export largo escupe megabytes de
       lineas de progreso y guardarlas todas seria una fuga lenta. Lo que hace falta al fallar es el ultimo tramo. */
    ch.stderr.on('data', d => { st.err = (st.err + d.toString()).slice(-8000); });
    st.fin = new Promise(res => { ch.on('close', c => { st.code = c; res(c); }); });
    ch.on('error', () => { st.code = -1; });
    /* Una sola promesa de 'drain' compartida: si llegan varios write seguidos con el buffer lleno, todos
       esperan al MISMO drain en vez de apilar escuchadores sobre el mismo evento. */
    ch.stdin.on('drain', () => { const d = st.drenando; st.drenando = null; if (d) d(); });
    ch.stdin.on('error', () => {});          // si el proceso muere, el write revienta: se ignora y lo cuenta el close
    _ff.set(id, st);
    return { id, path: bin };
  } catch (err) { return { id: null, err: String(err && err.message || err) }; }
});
/* Un fotograma. Devuelve cuando el codificador lo ha aceptado: ahi esta la contrapresion. */
ipcMain.handle('dsp:ffWrite', async (e, id, data) => {
  const st = _ff.get(id); if (!st || st.code !== null) return false;
  try {
    const buf = Buffer.from(data.buffer || data, data.byteOffset || 0, data.byteLength || data.length);
    if (st.ch.stdin.write(buf)) return true;
    if (!st.drenando) st.drenando = null;
    await new Promise(res => { st.drenando = res; setTimeout(() => { if (st.drenando === res) { st.drenando = null; res(); } }, 30000); });
    return true;
  } catch (err) { return false; }
});
/* Cierra la entrada y espera a que termine de escribir el archivo. Sin esperar, el MP4 se queda sin su indice
   final y no lo abre nadie. */
ipcMain.handle('dsp:ffEnd', async (e, id) => {
  const st = _ff.get(id); if (!st) return { ok: false, err: 'sin trabajo' };
  try { st.ch.stdin.end(); } catch (err) {}
  const code = await st.fin;
  _ff.delete(id);
  return { ok: code === 0, code, err: code === 0 ? '' : st.err.slice(-1200) };
});
/* Cancelar de verdad: matar el proceso. Es la razon de haber elegido proceso y no biblioteca. */
ipcMain.handle('dsp:ffKill', async (e, id) => {
  const st = _ff.get(id); if (!st) return true;
  try { st.ch.kill('SIGKILL'); } catch (err) {}
  _ff.delete(id); return true;
});
/* Y que no sobreviva ninguno a la app: un ffmpeg huerfano sigue escribiendo en un archivo que el usuario cree
   cancelado, y en Windows deja el archivo bloqueado. */
app.on('before-quit', () => { for (const [, st] of _ff) { try { st.ch.kill('SIGKILL'); } catch (e) {} } _ff.clear(); });

ipcMain.handle('dsp:fileOpen', async (e, p) => { try { const fh = await fsp.open(p, 'w'); const id = _fdSeq++; _fds.set(id, fh); return id; } catch (err) { return null; } });
ipcMain.handle('dsp:fileWriteAt', async (e, id, position, data) => { try { const fh = _fds.get(id); if (!fh) return false; const buf = Buffer.from(data.buffer || data, data.byteOffset || 0, data.byteLength != null ? data.byteLength : data.length); await fh.write(buf, 0, buf.length, position); return true; } catch (err) { return false; } });
ipcMain.handle('dsp:fileClose', async (e, id) => { try { const fh = _fds.get(id); if (fh) { await fh.close(); _fds.delete(id); } return true; } catch (err) { return false; } });
/* [R108·E1] Binary range reads for the WebCodecs decode path — read the moov + individual samples out of a huge
   (12GB+) source on demand, without pulling the whole file into RAM. Persistent read fd (reused across sample reads). */
ipcMain.handle('dsp:openRead', async (e, p) => { try { const fh = await fsp.open(p, 'r'); const id = _fdSeq++; _fds.set(id, fh); return id; } catch (err) { return null; } });
ipcMain.handle('dsp:readAt', async (e, id, position, length) => { try { const fh = _fds.get(id); if (!fh || length <= 0 || length > 268435456) return null; const buf = Buffer.alloc(length); const { bytesRead } = await fh.read(buf, 0, length, position); return bytesRead === length ? buf : buf.subarray(0, bytesRead); } catch (err) { return null; } }); // Buffer.alloc (NOT allocUnsafe) → dedicated ArrayBuffer of exact size: allocUnsafe is pool-backed and IPC would ship the whole shared pool (leaking adjacent memory). Short read at EOF returns the partial slice.
ipcMain.handle('dsp:closeRead', async (e, id) => { try { const fh = _fds.get(id); if (fh) { await fh.close(); _fds.delete(id); } return true; } catch (err) { return false; } });
// diagnostics session log — appended to userData so it survives even a crash; read it back after a test session
// (DIAG_LOG y diagAppend están declarados arriba del todo, junto a los handlers de crash del proceso)
ipcMain.handle('dsp:diagWrite', async (e, text, reset) => {
  try {
    if (reset) { await fsp.writeFile(DIAG_LOG, text, 'utf8'); return DIAG_LOG; }
    // [AUDITORIA-2026-07 §Etapa1-5] rotación simple: sin esto el log crece sin límite a lo largo de semanas de
    // uso. Al pasar los 5MB se vacía con una línea de aviso en vez de seguir apendando — nada de recortar por
    // la mitad (leer+reescribir varios MB en cada rotación saldría más caro que el propio log) ni traer una lib
    // de rotación: es un log de diagnóstico de SESIÓN, no un historial que haga falta conservar entero.
    try { const st = await fsp.stat(DIAG_LOG); if (st.size > 5 * 1024 * 1024) await fsp.writeFile(DIAG_LOG, '[log rotated ' + new Date().toISOString() + ']\n', 'utf8'); } catch (_) {}
    await fsp.appendFile(DIAG_LOG, text, 'utf8');
    return DIAG_LOG;
  } catch (err) { return null; }
});
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
// [R204] Sólo los nombres de las SUBCARPETAS. Va en un canal propio y no ampliando `dsp:listDir` a propósito:
// ese devuelve únicamente archivos y de él dependen el rescate de proxies y el historial de autoguardado, que
// filtran por nombre — colarles carpetas sería pedir un falso positivo. Lo usa el reenlace junto al proyecto.
ipcMain.handle('dsp:listSubdirs', async (e, dir) => { try { const names = await fsp.readdir(dir); const out = []; for (const n of names) { try { const s = await fsp.stat(path.join(dir, n)); if (s.isDirectory()) out.push(n); } catch (_) {} } return out; } catch (err) { return []; } });
ipcMain.handle('dsp:deleteFile', async (e, p) => { try { await fsp.unlink(p); return true; } catch (err) { return false; } }); // prune old autosave-history snapshots
ipcMain.handle('dsp:rename', async (e, from, to) => { try { await fsp.rename(from, to); return true; } catch (err) { try { await fsp.copyFile(from, to); await fsp.unlink(from); return true; } catch (_) { return false; } } }); // atomic proxy publish: encode to <name>.part, rename over the final name only on success → an interrupted encode never leaves a moov-less (corrupt) proxy at the real name
ipcMain.handle('dsp:exists', async (e, p) => { try { return fs.existsSync(p); } catch (err) { return false; } });
ipcMain.handle('dsp:setTitle', (e, t) => { if (win) win.setTitle(t); });
ipcMain.handle('dsp:setProgress', (e, v) => { try { if (win) win.setProgressBar(typeof v === 'number' && v >= 0 ? Math.min(1, v) : -1); } catch (err) {} }); // [R92-T5] taskbar progress for exports
ipcMain.handle('dsp:forceClose', () => { forceClose = true; if (win) win.close(); return true; }); // renderer confirmed "close without saving"

// [AUDITORIA-2026-07 §Etapa1-3] impedir que Windows/macOS suspendan la app durante un export largo o una
// emisión NDI/Spout — ambos pueden solaparse (export mientras se transmite a la sala en vivo), así que un
// contador de referencias evita que el segundo `off` corte el bloqueo que el primero todavía necesita. Los
// call-sites en app.js los agrega el otro agente en paralelo; acá sólo queda el canal, tolerante a llamadas
// desbalanceadas (el contador nunca baja de 0).
let _psbId = null, _psbRefs = 0;
ipcMain.handle('dsp:powerSave', (e, on) => {
  try {
    if (on) {
      _psbRefs++;
      if (_psbRefs === 1) _psbId = powerSaveBlocker.start('prevent-app-suspension');
    } else if (_psbRefs > 0) {
      _psbRefs--;
      if (_psbRefs === 0 && _psbId != null) { powerSaveBlocker.stop(_psbId); _psbId = null; }
    }
  } catch (_) {}
  return { active: _psbRefs > 0, refs: _psbRefs };
});

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
