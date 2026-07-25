// Puente mínimo del splash de arranque. Sólo escucha: la ventana del splash no puede pedirle nada al sistema.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('SPLASH', {
  // datos fijos (línea de build) que manda el proceso principal al cargar
  onInit: (cb) => ipcRenderer.on('splash:init', (e, info) => { try { cb(info); } catch (_) {} }),
  // hitos reales del arranque del editor: (porcentaje, texto opcional)
  onProgress: (cb) => ipcRenderer.on('splash:progress', (e, pct, text) => { try { cb(pct, text); } catch (_) {} }),
  // el editor terminó de arrancar → completar la barra y desvanecerse
  onBye: (cb) => ipcRenderer.on('splash:bye', () => { try { cb(); } catch (_) {} })
});
