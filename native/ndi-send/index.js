// Thin loader for the NDI sender native addon. Degrades gracefully if the build is missing.
let addon = null, loadError = null;
try {
  addon = require('./build/Release/dsp_ndi.node');
} catch (e1) {
  try { addon = require('./build/Debug/dsp_ndi.node'); }
  catch (e2) { loadError = e1; }
}
if (addon) {
  module.exports = addon;
} else {
  module.exports = {
    _loadError: String((loadError && loadError.message) || loadError),
    available() { return false; },
    runtimeUrl() { return 'http://ndi.link/NDIRedistV6'; },
    start() { return false; },
    sendFrame() { return false; },
    connections() { return 0; },
    stop() {},
    probe() { return null; },
    findSources() { return []; },
    recvOpen() { return false; },
    recvRead() { return null; },
    recvClose() {},
    recvCloseAll() {},
    recvStats() { return null; }
  };
}
