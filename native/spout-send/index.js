// Thin loader for the Spout sender native addon. Degrades gracefully if the build is missing (e.g. non-Windows).
let addon = null, loadError = null;
try {
  addon = require('./build/Release/dsp_spout.node');
} catch (e1) {
  try { addon = require('./build/Debug/dsp_spout.node'); }
  catch (e2) { loadError = e1; }
}
if (addon) {
  module.exports = addon;
} else {
  module.exports = {
    _loadError: String((loadError && loadError.message) || loadError),
    available() { return false; },
    start() { return false; },
    send() { return false; },
    stop() {}
  };
}
